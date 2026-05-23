import { $ } from '../utils/dom.js';
import { downloadBlob } from '../utils/files.js';
import { currentMediaFiles } from '../consts.js';
import { scriptOnce } from '../utils/async.js';
import { updateFileName, loadRearBackground, loadBackground, loadForeground, loadAudioFile } from '../media/layers.js';

function collectSettings() {
  const ids = [
    'languageSelect','backColor','transparentBg','watermarkOn','watermarkText','watermarkSize','watermarkPosition',
    'speed','bgScale','fgScale','rearBgScale','spinTarget','audioScaleOn','audioScaleAmount','soundTarget',
    'sizeResponse','bassSensitivity','canvasW','canvasH','rearBgX','rearBgY','bgX','bgY','fgX','fgY',
    'syncOn','loopSeconds','syncAngle','loopMultiple','keyOn','keyColor','tol','soft','recSeconds','recFps',
    'webmMbps','gifQuality'
  ];
  const settings = {};
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') settings[id] = el.checked;
    else settings[id] = el.value;
  });
  settings.defaultRearBgName = currentMediaFiles.rear?.name || '';
  settings.defaultBgName = currentMediaFiles.bg?.name || '';
  settings.defaultFgName = currentMediaFiles.fg?.name || '';
  settings.defaultAudioName = currentMediaFiles.audio?.name || '';
  return settings;
}

function applySettings(settings) {
  Object.entries(settings).forEach(([id, value]) => {
    if (id.startsWith('default')) return;
    const el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = String(value);
  });
  import('./position.js').then(m => { m.updateNumbers(); m.updatePositionControls(); });
  import('../utils/i18n.js').then(m => m.applyLanguage());
}

function saveStatus(key) {
  import('./status.js').then(m => m.status(key));
}

export function downloadJsonPreset() {
  const settings = collectSettings();
  const json = JSON.stringify(settings, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, 'image-spinner-preset.json');
  saveStatus('presetSaved');
}

export async function loadJsonPreset(file) {
  try {
    const text = await file.text();
    const settings = JSON.parse(text);
    applySettings(settings);
    saveStatus('presetLoaded');
  } catch (e) {
    console.error(e);
    saveStatus('presetLoadFailed');
  }
}

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  try {
    await scriptOnce('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  } catch {
    await scriptOnce('https://unpkg.com/jszip@3.10.1/dist/jszip.min.js');
  }
  if (!window.JSZip) throw new Error('JSZip could not be loaded');
  return window.JSZip;
}

export async function downloadZippedProject() {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  zip.file('settings.json', JSON.stringify(collectSettings(), null, 2));

  const mediaMap = [
    ['rear', 'defaultRearBgName'],
    ['bg', 'defaultBgName'],
    ['fg', 'defaultFgName'],
    ['audio', 'defaultAudioName']
  ];
  for (const [key, nameKey] of mediaMap) {
    const file = currentMediaFiles[key];
    if (!file) continue;
    zip.file(file.name, file);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'image-spinner-project.zip');
  saveStatus('projectSaved');
}

export async function loadZippedProject(file) {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);

    const settingsFile = zip.file('settings.json');
    if (!settingsFile) throw new Error('No settings.json in project');
    const text = await settingsFile.async('string');
    const settings = JSON.parse(text);
    applySettings(settings);

    const mediaMap = [
      ['rear', settings.defaultRearBgName, loadRearBackground, 'rearBgFile'],
      ['bg', settings.defaultBgName, loadBackground, 'bgFile'],
      ['fg', settings.defaultFgName, loadForeground, 'fgFile'],
      ['audio', settings.defaultAudioName, loadAudioFile, 'audioFile']
    ];
    for (const [key, filename, loadFn, inputId] of mediaMap) {
      if (!filename) continue;
      const zipEntry = zip.file(filename);
      if (!zipEntry) continue;
      const blob = await zipEntry.async('blob');
      const fileObj = new File([blob], filename, { type: blob.type || '' });
      currentMediaFiles[key] = fileObj;
      updateFileName(inputId, fileObj);
      loadFn(fileObj);
    }

    saveStatus('projectLoaded');
  } catch (e) {
    console.error(e);
    saveStatus('projectLoadFailed');
  }
}

export function downloadHtmlWithDefaults() {
  downloadJsonPreset();
}
