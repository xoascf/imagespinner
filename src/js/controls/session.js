import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { SETTING_IDS } from '../registry.js';
import { saveToIDB, getFromIDB, clearIDB } from '../utils/storage-idb.js';
import { status } from './status.js';
import { updateNumbers, updatePositionControls } from './position.js';
import { loadBackground, loadForeground, loadRearBackground, loadAudioFile } from '../media/layers.js';

let autosaveTimer = null;

export function triggerAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveSession, 1000);
}

async function saveSession() {
  try {
    const settings = {};
    SETTING_IDS.forEach(id => {
      const el = $(id);
      if (!el) return;
      settings[id] = el.type === 'checkbox' ? el.checked : el.value;
    });

    const sessionData = {
      settings,
      bgUrl: state.bgUrl && state.bgUrl.startsWith('data:') ? state.bgUrl : null,
      fgUrl: state.fgUrl && state.fgUrl.startsWith('data:') ? state.fgUrl : null,
      rearBgUrl: state.rearBgUrl && state.rearBgUrl.startsWith('data:') ? state.rearBgUrl : null,
      audioUrl: state.audioUrl && state.audioUrl.startsWith('data:') ? state.audioUrl : null,
      // If using Blobs for media instead of base64 data URLs, we'd need to store the File/Blob objects directly.
      // But currently layers.js uses object URLs. We need to save the File objects themselves if we want to restore them.
      // For now, if we don't have the File objects stored in state, we might not be able to save large files easily.
      // We will enhance this to save the raw files if they exist in state.
      bgFile: state.bgFile || null,
      fgFile: state.fgFile || null,
      rearBgFile: state.rearBgFile || null,
      audioFile: state.audioFile || null
    };

    await saveToIDB('currentSession', sessionData);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      status('storageFull');
    } else {
      console.error('Autosave failed', e);
    }
  }
}

export async function loadSession() {
  try {
    const sessionData = await getFromIDB('currentSession');
    if (!sessionData) return;

    if (sessionData.settings) {
      Object.entries(sessionData.settings).forEach(([id, val]) => {
        const el = $(id);
        if (el) {
          if (el.type === 'checkbox') el.checked = val;
          else el.value = val;
        }
      });
      updateNumbers();
      updatePositionControls();
      import('./init.js').then(m => { if (m.resizeCanvas) m.resizeCanvas(true, false); });
    }

    if (sessionData.rearBgFile) await loadRearBackground(sessionData.rearBgFile);
    if (sessionData.bgFile) await loadBackground(sessionData.bgFile);
    if (sessionData.fgFile) await loadForeground(sessionData.fgFile);
    if (sessionData.audioFile) await loadAudioFile(sessionData.audioFile);

  } catch (e) {
    console.error('Failed to load session', e);
  }
}

export async function clearWorkspace() {
  if (!confirm(document.querySelector('[data-i18n="confirmClear"]')?.textContent || "Are you sure you want to clear your current workspace? This cannot be undone.")) {
    return;
  }
  
  await clearIDB();
  location.reload(); // Quickest way to fully reset all DOM and state
}
