import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { downloadBlob } from '../utils/files.js';
import { sleep, scriptOnce } from '../utils/async.js';
import { resetLoopingMediaForExport, spinSpeed, drawFrame, getExportSeconds, isAutoExportDuration, getExportAngle } from '../render/engine.js';
import { waitForGifFirstFrame } from '../gif-utils.js';
import { prepareAudioForPlayback } from '../audio/analyzer.js';
import { playExportMedia, resumeMediaState } from '../media/layers.js';
import { status, setExporting } from '../controls/status.js';

function makeGifWorkerUrl() {
  // In bundled build, __gifWorkerCode is inlined by build.mjs
  // In dev mode, fall back to CDN importScripts
  const workerCode = typeof __gifWorkerCode !== 'undefined'
    ? __gifWorkerCode
    : "importScripts('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');";
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

export async function saveGif() {
  setExporting(true);
  const savedAngle = state.angle;
  state.exportActive = true;
  state.exportCancelled = false;
  state.angle = 0;
  state.audioLevelSmoothed = 0;
  state.audioBassFloor = 0;
  state.audioBassPeak = 0.08;
  const wasAudioPlaying = state.audio && !state.audio.paused;
  if (state.audio) {
    try { state.audio.pause(); } catch (e) {}
  }
  await resetLoopingMediaForExport();

  if (!window.GIF) {
    // In dev mode, gif.js isn't bundled — try loading from CDN
    if (typeof __gifWorkerCode === 'undefined') {
      try {
        await scriptOnce('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js', 'GIF');
      } catch (e) {
        setExporting(false);
        resumeMediaState();
        return;
      }
    }
  }

  if (!window.GIF) {
    status('gifExporterMissing');
    state.angle = savedAngle;
    state.exportActive = false;
    setExporting(false);
    resumeMediaState();
    return;
  }

  let fps = Math.max(1, Math.min(60, Number($('recFps').value) || 20));
  let seconds = getExportSeconds();
  const matchedFgGif = state.fgType === 'gif' && state.fgGifDuration > 0 && Math.abs(seconds - state.fgGifDuration) < 0.02 && state.fgGifFrames > 0;
  const matchedDelays = matchedFgGif && state.fgGifDelays && state.fgGifDelays.length ? state.fgGifDelays.slice(0, state.fgGifFrames) : [];
  let frames = matchedFgGif ? state.fgGifFrames : Math.round(fps * seconds);
  let delay = matchedFgGif
    ? Math.max(20, Math.round((state.fgGifDuration * 1000) / state.fgGifFrames))
    : Math.round(1000 / fps);
  if (matchedFgGif) {
    seconds = matchedDelays.length ? matchedDelays.reduce((a, b) => a + b, 0) / 1000 : (delay * frames) / 1000;
    fps = frames / seconds;
  }
  const quality = Math.max(1, Math.min(30, Number($('gifQuality').value) || 8));
  const workerUrl = makeGifWorkerUrl();
  let playedAudioForGif = false;
  const finishGifExport = () => {
    if (playedAudioForGif && state.audio) state.audio.pause();
    state.angle = savedAngle;
    state.exportActive = false;
    setExporting(false);
    resumeMediaState();
    if (wasAudioPlaying && state.audio) {
      try { state.audio.play(); } catch (e) {}
    }
  };

  const hasVideoGif = state.bgType === 'video' || state.bgType === 'gif' || state.fgType === 'video' || state.fgType === 'gif';
  const hasAudioPulse = state.audio && $('audioScaleOn').checked;

  const gif = new GIF({
    workers: Math.min(navigator.hardwareConcurrency || 4, 8),
    quality,
    width: canvas.width,
    height: canvas.height,
    workerScript: workerUrl,
    dither: false
  });

  status('gifFrames', { done: 0, total: frames });

  if (state.audio && $('audioScaleOn').checked) {
    try {
      await prepareAudioForPlayback();
      state.audio.currentTime = 0;
      await state.audio.play();
      playedAudioForGif = true;
    } catch (e) {
      console.warn(e);
    }
  }

  // Use a dedicated snapshot canvas with willReadFrequently hint
  // so gif.js getImageData readbacks are fast and warning-free
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = canvas.width;
  snapCanvas.height = canvas.height;
  const snapCtx = snapCanvas.getContext('2d', { willReadFrequently: true });

  const autoLoop = isAutoExportDuration() && !matchedFgGif;

  try {
    let elapsedMs = 0;
    const exportSpinSpeedRad = spinSpeed() * Math.PI / 180;
    // In auto mode, use exact fractional angle for seamless loops:
    // angle = exportArc × i / frames (guarantees frame 0 and N-1 are evenly spaced)
    const spinSign = spinSpeed() >= 0 ? 1 : -1;
    const exportArcRad = getExportAngle() * Math.PI / 180;

    for (let i = 0; i < frames; i++) {
      const frameDelay = matchedDelays[i] || delay;

      if (i === 0) {
        if (state.fgType === 'gif' && state.fg) await waitForGifFirstFrame(state.fg, 300);
        state.angle = 0;
        drawFrame(0);
        await playExportMedia();
      } else {
        const previousDelay = matchedDelays[i - 1] || delay;
        if (hasVideoGif || hasAudioPulse) {
          await sleep(previousDelay);
        } else if (i % 8 === 0) {
          await sleep(0);
        }
        elapsedMs += previousDelay;

        if (matchedFgGif) {
          const loopMs = Math.max(1, matchedDelays.reduce((a, b) => a + b, 0));
          const timeInLoop = Math.min(elapsedMs, Math.max(0, loopMs - frameDelay));
          state.angle = exportSpinSpeedRad * (timeInLoop / 1000);
        } else if (autoLoop) {
          // Exact fractional positioning: seamless regardless of rounding
          state.angle = spinSign * exportArcRad * i / frames;
        } else {
          state.angle += exportSpinSpeedRad * (previousDelay / 1000);
        }
        drawFrame(0);
      }

      snapCtx.drawImage(canvas, 0, 0);
      gif.addFrame(snapCanvas, { copy: true, delay: frameDelay });
      status('gifFrames', { done: i + 1, total: frames });

      if (state.exportCancelled) {
        gif.abort();
        URL.revokeObjectURL(workerUrl);
        state.angle = savedAngle;
        state.exportActive = false;
        setExporting(false);
        status('exportCancelled');
        return;
      }
    }
  } catch (e) {
    console.error(e);
    URL.revokeObjectURL(workerUrl);
    finishGifExport();
    status('gifFrameFailed');
    return;
  }

  gif.on('finished', blob => {
    URL.revokeObjectURL(workerUrl);
    finishGifExport();
    if (!blob || !blob.size) {
      status('gifEmpty');
      return;
    }
    downloadBlob(blob, 'image-spinner.gif');
    status('gifSaved');
  });

  gif.on('abort', () => {
    URL.revokeObjectURL(workerUrl);
    finishGifExport();
    status('gifAborted');
  });

  try {
    status('gifRendering');
    gif.render();
  } catch (e) {
    console.error(e);
    URL.revokeObjectURL(workerUrl);
    finishGifExport();
    status('gifRenderFailed');
  }
}
