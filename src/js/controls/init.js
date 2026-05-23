import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { currentMediaFiles } from '../consts.js';
import { t, setLanguage, applyLanguage } from '../utils/i18n.js';
import { updateFileName, loadRearBackground, loadBackground, loadForeground, loadAudioFile, clearFile } from '../media/layers.js';
import { loadDefaultAssets, loadDefaultAssetsFromFolder } from '../media/defaults.js';
import { loadQueryAssets } from '../url-loader.js';
import { applyBalancedSettings, applyAudioDuration, resetSettings, applyForegroundGifLoop } from './presets.js';
import { status } from './status.js';
import { updatePauseBtnText, setExporting } from './status.js';
import { updatePositionControls, updateNumbers, updateMeta, nudgeLayer, centerSelectedLayer, setLayerPosition, positionIds } from './position.js';
import { pickColorFromCanvasEvent, startColorPick } from './color-picker.js';
import { saveWebM } from '../export/webm.js';
import { saveGif } from '../export/gif.js';
import { downloadJsonPreset, loadJsonPreset, downloadZippedProject, loadZippedProject } from './saver.js';

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * canvas.width / rect.width,
    y: (e.clientY - rect.top) * canvas.height / rect.height
  };
}

const filePickers = [
  ['rearBgFile', 'rear', loadRearBackground],
  ['bgFile', 'bg', loadBackground],
  ['fgFile', 'fg', loadForeground],
  ['audioFile', 'audio', loadAudioFile]
];

function handleFileSelected(inputId, mediaKey, loadFn, file) {
  if (!file) return;
  currentMediaFiles[mediaKey] = file;
  updateFileName(inputId, file);
  loadFn(file);
  $(inputId).value = '';
}

function setupFileDrop(inputId, mediaKey, loadFn) {
  const input = $(inputId);
  const picker = input.closest('.file-picker') || input.parentElement;

  picker.addEventListener('dragover', e => {
    e.preventDefault();
    picker.classList.add('drag-over');
  });

  picker.addEventListener('dragleave', () => {
    picker.classList.remove('drag-over');
  });

  picker.addEventListener('drop', e => {
    e.preventDefault();
    picker.classList.remove('drag-over');
    handleFileSelected(inputId, mediaKey, loadFn, e.dataTransfer.files[0]);
  });
}

function setupFileRemove(inputId, mediaKey) {
  const picker = $(inputId).closest('.file-picker');
  const removeBtn = picker?.querySelector('.file-remove');
  if (!removeBtn) return;
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearFile(inputId, mediaKey);
    $(inputId).value = '';
  });
}

export function initControls() {
  filePickers.forEach(([inputId, mediaKey, loadFn]) => {
    $(inputId).addEventListener('change', e => {
      handleFileSelected(inputId, mediaKey, loadFn, e.target.files[0]);
    });
    setupFileDrop(inputId, mediaKey, loadFn);
    setupFileRemove(inputId, mediaKey);
  });

  $('audioBtn').addEventListener('click', async () => {
    if (!state.audio) { status('chooseAudio'); return; }
    if (state.audio.paused) {
      try {
        const { prepareAudioForPlayback } = await import('../audio/analyzer.js');
        await prepareAudioForPlayback();
        await state.audio.play();
        updateMeta();
      } catch (e) {
        status('audioPlayFailed');
      }
    } else {
      state.audio.pause();
      updateMeta();
    }
  });

  $('pauseBtn').addEventListener('click', () => {
    state.paused = !state.paused;
    updatePauseBtnText();
    if (state.fgType === 'video' && state.fg) {
      if (state.paused) state.fg.pause();
      else state.fg.play().catch(() => {});
    }
    if (state.rearBgType === 'video' && state.rearBg) {
      if (state.paused) state.rearBg.pause();
      else state.rearBg.play().catch(() => {});
    }
    if (state.bgType === 'video' && state.bg) {
      if (state.paused) state.bg.pause();
      else state.bg.play().catch(() => {});
    }
  });

  canvas.addEventListener('click', e => {
    if (pickColorFromCanvasEvent(e)) return;
    if (state.fgType === 'video' && state.fg) state.fg.play().catch(() => {});
    if (state.rearBgType === 'video' && state.rearBg) state.rearBg.play().catch(() => {});
    if (state.bgType === 'video' && state.bg) state.bg.play().catch(() => {});
  });

  canvas.addEventListener('pointerdown', e => {
    if (state.colorPickTarget) return;
    state.draggingLayer = $('moveLayer').value;
    state.dragLastPoint = canvasPoint(e);
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!state.draggingLayer || !state.dragLastPoint) return;
    const p = canvasPoint(e);
    const ids = positionIds(state.draggingLayer);
    setLayerPosition(
      state.draggingLayer,
      (Number($(ids.x).value) || canvas.width / 2) + p.x - state.dragLastPoint.x,
      (Number($(ids.y).value) || canvas.height / 2) + p.y - state.dragLastPoint.y
    );
    state.dragLastPoint = p;
  });

  function stopDraggingLayer() {
    state.draggingLayer = null;
    state.dragLastPoint = null;
    canvas.classList.remove('dragging');
  }

  canvas.addEventListener('pointerup', stopDraggingLayer);
  canvas.addEventListener('pointercancel', stopDraggingLayer);

  $('resizeBtn').addEventListener('click', () => {
    const w = Math.max(100, Number($('canvasW').value) || 800);
    const h = Math.max(100, Number($('canvasH').value) || 800);
    canvas.width = w;
    canvas.height = h;
    centerLayers();
    updateMeta();
  });

  [
    ['rearBgX', 'rearBgXRange'],
    ['rearBgY', 'rearBgYRange'],
    ['bgX', 'bgXRange'],
    ['bgY', 'bgYRange'],
    ['fgX', 'fgXRange'],
    ['fgY', 'fgYRange']
  ].forEach(([numberId, rangeId]) => {
    $(numberId).addEventListener('input', () => {
      $(rangeId).value = $(numberId).value;
      updatePositionControls();
    });
    $(rangeId).addEventListener('input', () => {
      $(numberId).value = $(rangeId).value;
      updatePositionControls();
    });
  });

  document.querySelectorAll('[data-nudge]').forEach(btn => {
    btn.addEventListener('click', e => {
      const [dx, dy] = e.currentTarget.dataset.nudge.split(',').map(Number);
      nudgeLayer(dx, dy, e.shiftKey ? 10 : 2);
    });
  });

  $('centerSelectedBtn').addEventListener('click', centerSelectedLayer);
  $('pickBackColorBtn').addEventListener('click', () => startColorPick('backColor'));
  $('pickKeyColorBtn').addEventListener('click', () => startColorPick('keyColor'));
  $('balancedPresetBtn').addEventListener('click', () => applyBalancedSettings(true));
  $('audioLengthBtn').addEventListener('click', () => applyAudioDuration(true));
  $('resetSettingsBtn').addEventListener('click', resetSettings);
  $('matchFgGifBtn').addEventListener('click', applyForegroundGifLoop);

  ['speed','bgScale','fgScale','rearBgScale','audioScaleAmount','sizeResponse','bassSensitivity','tol','soft','loopSeconds','syncAngle','loopMultiple','syncOn','spinTarget','soundTarget','moveLayer','recSeconds','recFps','transparentBg','watermarkOn','watermarkText','watermarkSize','watermarkPosition'].forEach(id => {
    $(id).addEventListener('input', () => {
      if (id === 'bassSensitivity' || id === 'sizeResponse' || id === 'soundTarget') {
        state.audioLevelSmoothed = 0;
      }
      updateNumbers();
    });
    $(id).addEventListener('change', updateNumbers);
  });

  $('languageSelect').addEventListener('change', e => {
    setLanguage(e.target.value);
    applyLanguage();
  });

  $('webmBtn').addEventListener('click', saveWebM);
  $('gifBtn').addEventListener('click', saveGif);

  if ($('downloadPresetBtn')) $('downloadPresetBtn').addEventListener('click', downloadJsonPreset);
  if ($('downloadProjectBtn')) $('downloadProjectBtn').addEventListener('click', downloadZippedProject);

  if ($('loadPresetBtn')) $('loadPresetBtn').addEventListener('click', () => $('loadPresetFile').click());
  if ($('loadPresetFile')) $('loadPresetFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadJsonPreset(file);
    e.target.value = '';
  });

  if ($('loadProjectBtn')) $('loadProjectBtn').addEventListener('click', () => $('loadProjectFile').click());
  if ($('loadProjectFile')) $('loadProjectFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadZippedProject(file);
    e.target.value = '';
  });
  if ($('defaultFolderBtn')) $('defaultFolderBtn').addEventListener('click', loadDefaultAssetsFromFolder);

  applyLanguage();
  updateNumbers();
  updatePositionControls();
  loadDefaultAssets().then(loadQueryAssets);
  setInterval(updateMeta, 500);
}
