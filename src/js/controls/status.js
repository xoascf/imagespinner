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

export function setExporting(isExporting) {
  $('webmBtn').disabled = isExporting;
  $('gifBtn').disabled = isExporting;
  $('webmBtn').textContent = isExporting ? t('exporting') : t('saveWebm');
  $('gifBtn').textContent = isExporting ? t('exporting') : t('saveGif');
}
