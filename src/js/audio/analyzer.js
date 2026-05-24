import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { status } from '../controls/status.js';
import { waitWithTimeout } from '../utils/async.js';

export function setupAudioGraph() {
  if (!state.audio) return null;
  if (!state.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audioCtx = new AudioContextClass();
    state.audioAnalyser = state.audioCtx.createAnalyser();
    state.audioAnalyser.fftSize = 4096;
    state.audioAnalyser.smoothingTimeConstant = 0.55;
    state.audioData = new Uint8Array(state.audioAnalyser.frequencyBinCount);
    state.audioStreamDest = state.audioCtx.createMediaStreamDestination();
  }
  if (!state.audioSource) {
    state.audioSource = state.audioCtx.createMediaElementSource(state.audio);
    state.audioSource.connect(state.audioAnalyser);
    state.audioAnalyser.connect(state.audioCtx.destination);
    state.audioSource.connect(state.audioStreamDest);
  }
  return state.audioCtx;
}

export async function prepareAudioForPlayback() {
  const graph = setupAudioGraph();
  if (graph && graph.state === 'suspended') await graph.resume();
  return graph;
}

let _frameCount = 0;
const _domUpdateInterval = 6;

export function currentAudioLevel() {
  if (!state.audioAnalyser || !state.audioData || !state.audio || state.audio.paused) {
    state.audioLevelSmoothed *= 0.82;
    state.lastBassDisplayLevel = state.audioLevelSmoothed;
    _frameCount = (_frameCount + 1) % _domUpdateInterval;
    if (_frameCount === 0 && $('bassLevelText')) {
      $('bassLevelText').textContent = Math.round(state.lastBassDisplayLevel * 100);
    }
    return state.audioLevelSmoothed;
  }

  state.audioAnalyser.getByteFrequencyData(state.audioData);

  const sampleRate = state.audioCtx ? state.audioCtx.sampleRate : 44100;
  const binHz = sampleRate / state.audioAnalyser.fftSize;
  const lowHz = 25;
  const highHz = 180;
  const startBin = Math.max(1, Math.ceil(lowHz / binHz));
  const endBin = Math.min(state.audioData.length - 1, Math.floor(highHz / binHz));
  let sumSquares = 0;
  let peak = 0;
  let count = 0;

  for (let i = startBin; i <= endBin; i++) {
    const value = state.audioData[i] / 255;
    sumSquares += value * value;
    if (value > peak) peak = value;
    count++;
  }

  const bandRms = count ? Math.sqrt(sumSquares / count) : 0;
  const sensitivity = Math.max(0.05, (Number($('bassSensitivity') ? $('bassSensitivity').value : 250) || 250) / 100);
  let level = Math.max(bandRms, peak * 0.85) * sensitivity * 1.35;
  level = Math.min(1, Math.max(0, level));
  level = Math.pow(level, 0.78);

  state.audioLevelSmoothed = state.audioLevelSmoothed * 0.25 + level * 0.75;
  state.lastBassDisplayLevel = state.audioLevelSmoothed;

  _frameCount = (_frameCount + 1) % _domUpdateInterval;
  if (_frameCount === 0 && $('bassLevelText')) {
    $('bassLevelText').textContent = Math.round(state.lastBassDisplayLevel * 100);
  }
  return state.audioLevelSmoothed;
}

export async function getAudioTracksForExport() {
  if (!state.audio) return [];

  const cloneTracks = tracks => {
    return tracks.map(track => {
      try { return track.clone ? track.clone() : track; }
      catch (e) { return track; }
    });
  };

  const captureAudioTracksFromElement = () => {
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
  };

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
    await waitWithTimeout(50);
  }

  try {
    await state.audio.play();
  } catch (err) {
    status('audioPlayFailed');
  }
  return tracks;
}
