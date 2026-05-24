import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { getExportSeconds } from '../render/engine.js';
import { INPUT_IDS } from '../registry.js';

export function positionIds(layer) {
  if (layer === 'rear') return { x: 'rearBgX', y: 'rearBgY' };
  return layer === 'bg'
    ? { x: 'bgX', y: 'bgY' }
    : { x: 'fgX', y: 'fgY' };
}

export function updatePositionControls() {
  ['rear', 'bg', 'fg'].forEach(layer => {
    const ids = positionIds(layer);
    const xVal = $(ids.x).value;
    const yVal = $(ids.y).value;
    const x = Math.round(xVal === '' ? canvas.width / 2 : Number(xVal));
    const y = Math.round(yVal === '' ? canvas.height / 2 : Number(yVal));
    $(ids.x).value = x;
    $(ids.y).value = y;
    if ($(ids.x + 'Range')) $(ids.x + 'Range').value = x;
    if ($(ids.y + 'Range')) $(ids.y + 'Range').value = y;
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
  INPUT_IDS.forEach(id => {
    if ($(id) && $(id + 'Range')) {
      $(id + 'Range').value = $(id).value;
    }
  });

  const durationMode = $('recDuration') ? $('recDuration').value : 'custom';
  const isCustom = durationMode === 'custom';
  const isAngle = durationMode === 'angle';

  if ($('recAngleContainer')) $('recAngleContainer').hidden = !isAngle;
  if ($('recSeconds')) {
    $('recSeconds').readOnly = !isCustom;
    if (!isCustom) {
      $('recSeconds').value = getExportSeconds().toFixed(2);
    } else if (!(Number($('recSeconds').value) > 0)) {
      $('recSeconds').value = 3;
    }
  }

  const loop = Math.max(0.05, Number($('loopSeconds').value) || 1);
  const ang = Number($('syncAngle').value) || 0;
  const mult = Math.max(0.05, Number($('loopMultiple').value) || 1);
  if ($('computedSpeed')) $('computedSpeed').textContent = (ang / (loop * mult)).toFixed(2);
  updateMeta();
}

export function updateMeta() {
  if (!$('canvasStat')) return;
  const canvasText = canvas.width + '×' + canvas.height;
  const secs = getExportSeconds();
  const mode = $('recDuration') ? $('recDuration').value : 'custom';
  let secsLabel;
  if (mode === 'custom') {
    secsLabel = secs.toFixed(2) + 's';
  } else if (mode === 'audio') {
    secsLabel = 'Audio ' + secs.toFixed(1) + 's';
  } else {
    const angle = mode === 'angle' ? (Number($('recAngle').value) || 360) : mode;
    secsLabel = angle + '° ' + secs.toFixed(1) + 's';
  }
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
  $('exportStat').textContent = exportText;
  $('canvasChip').textContent = canvasText;
  $('spinChip').textContent = spinLabels[$('spinTarget').value] || t('spinReady');
  if ($('positionChip')) $('positionChip').textContent = posText;
  $('audioChip').textContent = audioText;
}
