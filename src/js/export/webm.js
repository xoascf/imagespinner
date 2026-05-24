import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { downloadBlob } from '../utils/files.js';
import { sleep, waitWithTimeout } from '../utils/async.js';
import { resetLoopingMediaForExport, spinSpeed, drawFrame, getExportSeconds, isAutoExportDuration, getExportAngle } from '../render/engine.js';
import { playExportMedia } from '../media/layers.js';
import { status } from '../controls/status.js';
import { setExporting } from '../controls/status.js';
import { prepareAudioForPlayback } from '../audio/analyzer.js';

function chooseWebmMimeType(includeAudio) {
  const audioOptions = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  const videoOptions = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  const options = includeAudio ? audioOptions : videoOptions;
  for (const type of options) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function cloneTracks(tracks) {
  return tracks.map(track => {
    try { return track.clone ? track.clone() : track; }
    catch (e) { return track; }
  });
}

function captureAudioTracksFromElement() {
  if (!state.audio) return [];
  try {
    const capture = state.audio.captureStream || state.audio.mozCaptureStream;
    if (typeof capture === 'function') {
      const audioStream = capture.call(state.audio);
      const tracks = audioStream.getAudioTracks ? audioStream.getAudioTracks() : [];
      if (tracks && tracks.length) return cloneTracks(tracks);
    }
  } catch (e) {
    console.warn('Audio element capture failed', e);
  }
  return [];
}

async function getAudioTracksForExport() {
  if (!state.audio) return [];
  let tracks = [];
  try {
    await prepareAudioForPlayback();
    try { state.audio.pause(); } catch (e) {}
    try { state.audio.currentTime = 0; } catch (e) {}

    tracks = captureAudioTracksFromElement();
    const playStarted = await waitWithTimeout(state.audio.play(), 1400);
    if (!playStarted) throw new Error('Audio play did not start in time');

    if (!tracks.length) tracks = captureAudioTracksFromElement();
    if (!tracks.length && state.audioStreamDest && state.audioStreamDest.stream) {
      tracks = cloneTracks(state.audioStreamDest.stream.getAudioTracks());
    }
  } catch (e) {
    console.warn(e);
    tracks.forEach(track => { try { track.stop(); } catch (err) {} });
    tracks = [];
    status('audioCaptureBlocked');
  }
  return tracks;
}

export async function saveWebM() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    status('recordingUnsupported');
    return;
  }

  setExporting(true);
  const savedAngle = state.angle;
  let stream = null;
  let rec = null;
  let rafId = null;
  let hardStopTimer = null;
  let audioExportTracks = [];

  try {
    state.exportActive = true;
    state.angle = 0;
    state.audioLevelSmoothed = 0;
    state.audioBassFloor = 0;
    state.audioBassPeak = 0.08;
    await resetLoopingMediaForExport();

    const fps = Math.max(1, Number($('recFps').value) || 20);
    const seconds = getExportSeconds();
    const mbps = Math.max(1, Number($('webmMbps').value) || 12);
    const bitsPerSecond = mbps * 1000 * 1000;
    const exactMs = seconds * 1000;
    const totalFrames = Math.max(1, Math.round(seconds * fps));
    const frameDuration = 1 / fps;

    stream = canvas.captureStream(fps);
    const videoTrack = stream.getVideoTracks()[0];

    if (state.audio) {
      audioExportTracks = await getAudioTracksForExport();
      audioExportTracks.forEach(track => {
        try { stream.addTrack(track); } catch (e) { console.warn(e); }
      });
    }

    const mimeType = chooseWebmMimeType(audioExportTracks.length > 0);
    const chunks = [];
    try {
      const options = mimeType ? { mimeType, videoBitsPerSecond: bitsPerSecond } : { videoBitsPerSecond: bitsPerSecond };
      rec = new MediaRecorder(stream, options);
    } catch (e) {
      try { rec = new MediaRecorder(stream, { videoBitsPerSecond: bitsPerSecond }); }
      catch (e2) { rec = new MediaRecorder(stream); }
    }

    const stopped = new Promise(resolve => {
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = e => { console.error(e.error || e); resolve(); };
      rec.onstop = resolve;
    });

    const stopRecorder = () => {
      if (!rec || rec.state === 'inactive') return;
      try { if (typeof rec.requestData === 'function') rec.requestData(); } catch (e) {}
      try { rec.stop(); } catch (e) { console.warn(e); }
    };

    const autoLoop = isAutoExportDuration();
    const spinSign = spinSpeed() >= 0 ? 1 : -1;
    const exportArcRad = getExportAngle() * Math.PI / 180;

    function drawExportFrame(frameIndex) {
      if (autoLoop) {
        // Exact fractional positioning: seamless regardless of rounding
        state.angle = spinSign * exportArcRad * frameIndex / totalFrames;
      } else {
        state.angle = spinSpeed() * Math.PI / 180 * frameIndex * frameDuration;
      }
      drawFrame(0);
      if (videoTrack && typeof videoTrack.requestFrame === 'function') videoTrack.requestFrame();
    }

    status('recordingStart', { mbps, seconds });
    drawExportFrame(0);
    if (videoTrack && typeof videoTrack.requestFrame === 'function') videoTrack.requestFrame();
    rec.start(100);
    await playExportMedia();

    const startTime = performance.now();
    let lastFrameIndex = -1;
    const tick = now => {
      const elapsedMs = Math.min(exactMs, Math.max(0, now - startTime));
      const frameIndex = Math.min(totalFrames - 1, Math.floor(elapsedMs / 1000 * fps));
      if (frameIndex !== lastFrameIndex) {
        lastFrameIndex = frameIndex;
        drawExportFrame(frameIndex);
        status('recordingFrames', { done: Math.min(frameIndex + 1, totalFrames), total: totalFrames });
      }

      if (frameIndex >= totalFrames - 1) {
        // Last unique frame already drawn above — stop promptly
        setTimeout(stopRecorder, 0);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    hardStopTimer = setTimeout(stopRecorder, Math.ceil(exactMs) + 1200);
    await Promise.race([stopped, sleep(Math.ceil(exactMs) + 2500)]);

    if (rec && rec.state !== 'inactive') stopRecorder();
    if (hardStopTimer) clearTimeout(hardStopTimer);
    hardStopTimer = null;

    const type = (rec && rec.mimeType) || mimeType || 'video/webm';
    const blob = new Blob(chunks, { type });
    if (!blob.size) {
      status('webmEmpty');
      return;
    }
    downloadBlob(blob, 'image-spinner.webm');
    status('webmSaved', { seconds: Number(seconds.toFixed(3)), fps });
  } catch (e) {
    console.error(e);
    status('webmFailed');
  } finally {
    if (rafId) cancelAnimationFrame(rafId);
    if (hardStopTimer) clearTimeout(hardStopTimer);
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) {}
    if (state.audio) state.audio.pause();
    if (state.bgType === 'video' && state.bg) state.bg.pause();
    if (state.fgType === 'video' && state.fg) state.fg.pause();
    audioExportTracks.forEach(track => { try { track.stop(); } catch (e) {} });
    if (stream) stream.getTracks().forEach(track => { try { track.stop(); } catch (e) {} });
    state.angle = savedAngle;
    state.exportActive = false;
    setExporting(false);
  }
}
