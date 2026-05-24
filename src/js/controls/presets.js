import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { status } from './status.js';
import { centerLayers, updatePositionControls, updateNumbers, updateMeta } from './position.js';

export function applyBalancedSettings(showStatus) {
  $('backColor').value = '#ffffff';
  if ($('transparentBg')) $('transparentBg').checked = false;
  $('spinTarget').value = 'bg';
  $('speed').value = 30;
  $('bgScale').value = 121;
  $('fgScale').value = 108;
  if ($('rearBgScale')) $('rearBgScale').value = 100;
  $('audioScaleOn').checked = false;
  $('audioScaleAmount').value = 35;
  if ($('watermarkOn')) $('watermarkOn').checked = true;
  if ($('watermarkText')) $('watermarkText').value = 'Trassel Vardias';
  if ($('watermarkSize')) $('watermarkSize').value = 28;
  if ($('watermarkPosition')) $('watermarkPosition').value = 'bottom-right';
  if ($('soundTarget')) $('soundTarget').value = 'bg';
  if ($('sizeResponse')) $('sizeResponse').value = 250;
  if ($('bassSensitivity')) $('bassSensitivity').value = 250;
  $('syncOn').checked = false;
  $('syncAngle').value = 360;
  $('loopMultiple').value = 1;
  $('keyOn').checked = false;
  $('recFps').value = 20;
  $('webmMbps').value = 12;
  $('gifQuality').value = 8;
  centerLayers();
  $('fgY').value = Math.round(canvas.height / 2);
  updatePositionControls();
  updateNumbers();
  if (showStatus) status('settingsBalanced');
}

export function applyAudioDuration(showMissing) {
  if (!state.audio || !Number.isFinite(state.audio.duration) || state.audio.duration <= 0) {
    if (showMissing) status('audioDurationMissing');
    return false;
  }
  const seconds = Math.min(600, Math.max(0.05, state.audio.duration));
  if ($('recDuration')) $('recDuration').value = 'custom';
  $('recSeconds').value = seconds.toFixed(2);
  $('recSeconds').hidden = false;
  if ($('recSecondsLabel')) $('recSecondsLabel').hidden = false;
  $('loopSeconds').value = state.audio.duration.toFixed(2);
  updateNumbers();
  status('audioDurationApplied');
  return true;
}

export function resetSettings() {
  $('canvasW').value = 800;
  $('canvasH').value = 800;
  import('./init.js').then(m => { if (m.resizeCanvas) m.resizeCanvas(true, false); });
  if ($('recDuration')) $('recDuration').value = '360';
  $('recSeconds').value = 0;
  $('recSeconds').hidden = true;
  if ($('recSecondsLabel')) $('recSecondsLabel').hidden = true;
  applyBalancedSettings(false);
  status('settingsReset');
}

export function applyForegroundGifLoop() {
  if (state.fgType !== 'gif' || !state.fgGifDuration || !Number.isFinite(state.fgGifDuration) || state.fgGifDuration <= 0) {
    status('gifLoopMissing');
    return false;
  }

  const actualDuration = state.fgGifDelays && state.fgGifDelays.length ? state.fgGifDelays.reduce((a, b) => a + b, 0) / 1000 : state.fgGifDuration;
  const seconds = Math.max(0.05, Math.min(600, actualDuration));
  const rounded = seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  $('loopSeconds').value = rounded;
  if ($('recDuration')) $('recDuration').value = 'custom';
  $('recSeconds').value = rounded;
  $('recSeconds').hidden = false;
  if ($('recSecondsLabel')) $('recSecondsLabel').hidden = false;
  if (state.fgGifFrames && state.fgGifFrames > 0) {
    $('recFps').value = Math.max(1, Math.min(60, Math.round(state.fgGifFrames / seconds)));
  }
  $('syncOn').checked = true;
  updateNumbers();
  status('gifLoopApplied');
  return true;
}
