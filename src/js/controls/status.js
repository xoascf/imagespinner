import { $ } from '../utils/dom.js';
import { formatStatus, t } from '../utils/i18n.js';
import { state } from '../state.js';

export function status(key, params) {
  $('status').dataset.statusKey = key;
  $('status').dataset.statusParams = params ? JSON.stringify(params) : '';
  $('status').textContent = formatStatus(key, params);
}

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
