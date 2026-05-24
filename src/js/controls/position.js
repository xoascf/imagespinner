import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { getExportSeconds } from '../render/engine.js';

export function positionIds(layer) {
  if (layer === 'rear') return { x: 'rearBgX', y: 'rearBgY', xr: 'rearBgXRange', yr: 'rearBgYRange', xt: 'rearBgXText', yt: 'rearBgYText' };
  return layer === 'bg'
    ? { x: 'bgX', y: 'bgY', xr: 'bgXRange', yr: 'bgYRange', xt: 'bgXText', yt: 'bgYText' }
    : { x: 'fgX', y: 'fgY', xr: 'fgXRange', yr: 'fgYRange', xt: 'fgXText', yt: 'fgYText' };
}

export function updateCoordinateLimits() {
  const xMin = -canvas.width;
  const xMax = canvas.width * 2;
  const yMin = -canvas.height;
  const yMax = canvas.height * 2;
  ['rearBgXRange', 'bgXRange', 'fgXRange'].forEach(id => {
    $(id).min = xMin;
    $(id).max = xMax;
  });
  ['rearBgYRange', 'bgYRange', 'fgYRange'].forEach(id => {
    $(id).min = yMin;
    $(id).max = yMax;
  });
}

export function updatePositionControls() {
  updateCoordinateLimits();
  ['rear', 'bg', 'fg'].forEach(layer => {
    const ids = positionIds(layer);
    const x = Math.round(Number($(ids.x).value) || canvas.width / 2);
    const y = Math.round(Number($(ids.y).value) || canvas.height / 2);
    $(ids.x).value = x;
    $(ids.y).value = y;
    $(ids.xr).value = x;
    $(ids.yr).value = y;
    $(ids.xt).textContent = x;
    $(ids.yt).textContent = y;
  });
  updateMeta();
}

export function setLayerPosition(layer, x, y) {
  const ids = positionIds(layer);
  $(ids.x).value = Math.round(x);
  $(ids.y).value = Math.round(y);
  updatePositionControls();
}

export function nudgeLayer(dx, dy, amount) {
  const layer = $('moveLayer').value;
  const ids = positionIds(layer);
  setLayerPosition(
    layer,
    (Number($(ids.x).value) || canvas.width / 2) + dx * amount,
    (Number($(ids.y).value) || canvas.height / 2) + dy * amount
  );
}

export function centerSelectedLayer() {
  setLayerPosition($('moveLayer').value, canvas.width / 2, canvas.height / 2);
}

export function centerLayers() {
  $('rearBgX').value = Math.round(canvas.width / 2);
  $('rearBgY').value = Math.round(canvas.height / 2);
  $('bgX').value = Math.round(canvas.width / 2);
  $('bgY').value = Math.round(canvas.height / 2);
  $('fgX').value = Math.round(canvas.width / 2);
  $('fgY').value = Math.round(canvas.height / 2);
  updatePositionControls();
}

export function updateNumbers() {
  $('speedText').textContent = $('speed').value;
  $('bgScaleText').textContent = $('bgScale').value;
  $('fgScaleText').textContent = $('fgScale').value;
  if ($('rearBgScaleText')) $('rearBgScaleText').textContent = $('rearBgScale').value;
  $('audioScaleText').textContent = $('audioScaleAmount').value;
  if ($('watermarkSizeText')) $('watermarkSizeText').textContent = $('watermarkSize').value;
  if ($('sizeResponseText')) $('sizeResponseText').textContent = $('sizeResponse').value;
  if ($('bassSensitivityText')) $('bassSensitivityText').textContent = $('bassSensitivity').value;
  $('tolText').textContent = $('tol').value;
  $('softText').textContent = $('soft').value;
  const loop = Math.max(0.05, Number($('loopSeconds').value) || 1);
  const ang = Number($('syncAngle').value) || 0;
  const mult = Math.max(0.05, Number($('loopMultiple').value) || 1);
  $('computedSpeed').textContent = (ang / (loop * mult)).toFixed(2);
  updateMeta();
}

export function updateMeta() {
  if (!$('canvasStat')) return;
  const canvasText = canvas.width + 'x' + canvas.height;
  const secs = getExportSeconds();
  const mode = $('recDuration') ? $('recDuration').value : 'custom';
  const secsLabel = mode !== 'custom' ? mode + '° ' + secs.toFixed(1) + 's' : secs.toFixed(2) + 's';
  const exportText = secsLabel + ' / ' + (Number($('recFps').value) || 20) + 'fps';
  const spinLabels = {
    fg: t('fgSpinnerShort'),
    bg: t('bgSpinnerShort'),
    both: t('bothSpin')
  };
  const audioText = state.audio ? (state.audio.paused ? t('audioLoaded') : t('audioPlaying')) : t('audioIdle');
  const moveLayer = $('moveLayer') ? $('moveLayer').value : 'fg';
  const moveIds = positionIds(moveLayer);
  const posText = moveLayer.toUpperCase() + ' ' + (Math.round(Number($(moveIds.x).value) || 0)) + ',' + (Math.round(Number($(moveIds.y).value) || 0));
  $('canvasStat').textContent = canvasText;
  $('exportStat').textContent = exportText;
  $('canvasChip').textContent = canvasText;
  $('spinChip').textContent = spinLabels[$('spinTarget').value] || t('spinReady');
  if ($('positionChip')) $('positionChip').textContent = posText;
  $('audioChip').textContent = audioText;
}
