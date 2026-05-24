import { $ } from '../utils/dom.js';
import { formatStatus, t } from '../utils/i18n.js';
import { state } from '../state.js';

let statusTimeout = null;

export function status(key, params, persistent = false) {
  const el = $('status');
  if (!el) return;
  el.dataset.statusKey = key;
  el.dataset.statusParams = params ? JSON.stringify(params) : '';
  
  const textEl = $('statusText');
  if (textEl) textEl.textContent = formatStatus(key, params);
  
  el.classList.add('visible');
  
  if (statusTimeout) clearTimeout(statusTimeout);
  
  if (!persistent) {
    statusTimeout = setTimeout(() => {
      el.classList.remove('visible');
    }, 4000);
  }
}

// Bind close button if exists
setTimeout(() => {
  if ($('closeStatusBtn')) {
    $('closeStatusBtn').addEventListener('click', () => {
      if (statusTimeout) clearTimeout(statusTimeout);
      $('status').classList.remove('visible');
    });
  }
}, 0);

export function updatePauseBtnText() {
  $('pauseBtn').textContent = state.paused ? t('play') : t('pause');
}

export function cancelExport() {
  state.exportCancelled = true;
}

export function setExporting(isExporting) {
  const btns = ['webmBtn', 'gifBtn', 'apngBtn', 'htmlBtn'];
  btns.forEach(id => {
    if ($(id)) $(id).disabled = isExporting;
  });
  if ($('webmBtn')) $('webmBtn').textContent = isExporting ? t('exporting') : t('saveWebm');
  if ($('gifBtn')) $('gifBtn').textContent = isExporting ? t('exporting') : t('saveGif');
  if ($('apngBtn')) $('apngBtn').textContent = isExporting ? t('exporting') : t('saveApng');
  if ($('htmlBtn')) $('htmlBtn').textContent = isExporting ? t('exporting') : t('saveHtml');
  if ($('cancelExportBtn')) {
    $('cancelExportBtn').hidden = !isExporting;
    $('cancelExportBtn').disabled = false;
  }
}
