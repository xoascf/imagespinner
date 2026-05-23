import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { DEFAULT_MEDIA, DEFAULT_EMBEDDED_MEDIA, currentMediaFiles } from '../consts.js';
import { fileFromUrl } from '../utils/files.js';
import { isVideoFilename, isGifFilename } from './loader.js';
import { loadGifFromUrl } from '../gif-utils.js';
import { updateFileName, loadBackground, loadForeground, loadRearBackground, loadAudioFile, loadBackgroundFromUrl, loadForegroundFromUrl, loadRearBackgroundFromUrl, loadAudioFromUrl } from './layers.js';
import { applyAudioDuration } from '../controls/presets.js';
import { status } from '../controls/status.js';
import { updateMeta } from '../controls/position.js';

export function defaultMediaEntries() {
  return [
    ['rear', 'rearBgFile', loadRearBackground],
    ['bg', 'bgFile', loadBackground],
    ['fg', 'fgFile', loadForeground],
    ['audio', 'audioFile', loadAudioFile]
  ];
}

export function hasDefaultMedia() {
  return !!(DEFAULT_MEDIA.rear || DEFAULT_MEDIA.bg || DEFAULT_MEDIA.fg || DEFAULT_MEDIA.audio);
}

function setDefaultFileName(fileId, name, note) {
  const nameEl = $(fileId + 'Name');
  if (!nameEl) return;
  nameEl.textContent = note ? name + ' ' + note : name;
  nameEl.removeAttribute('data-i18n');
}

function fileFromEmbeddedDefault(key) {
  const item = DEFAULT_EMBEDDED_MEDIA[key];
  if (!item || !item.data) return null;

  const match = String(item.data).match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!match) return null;

  const mime = item.type || match[1] || 'application/octet-stream';
  const encoded = match[3] || '';
  let bytes;
  if (match[2]) {
    const binary = atob(encoded);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    const text = decodeURIComponent(encoded);
    bytes = new TextEncoder().encode(text);
  }

  return new File([bytes], item.name || DEFAULT_MEDIA[key] || (key + '-default'), { type: mime });
}

function sameOriginHttpUrl(value) {
  try {
    const url = new URL(value, document.baseURI);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.origin !== location.origin) return null;
    return url;
  } catch (e) {
    return null;
  }
}

function defaultFileNameFromUrl(value, fallback) {
  try {
    const url = new URL(value, document.baseURI);
    return decodeURIComponent(url.pathname.split('/').pop()) || fallback || 'default';
  } catch (e) {
    return fallback || value || 'default';
  }
}

function directLoadDefaultImage(url, key, fileId, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (key === 'rear') { state.rearBg = img; state.rearBgType = 'image'; }
      else if (key === 'bg') { state.bg = img; state.bgType = 'image'; }
      else if (key === 'fg') { state.fg = img; state.fgType = 'image'; }
      setDefaultFileName(fileId, name, '(website)');
      updateMeta();
      status(key === 'fg' ? 'fgImageLoaded' : 'bgImageLoaded');
      resolve();
    };
    img.onerror = () => reject(new Error('Could not load ' + url.href));
    img.src = url.href;
  });
}

function directLoadDefaultVideo(url, key, fileId, name) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url.href;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.addEventListener('loadeddata', () => {
      if (key === 'rear') { state.rearBg = video; state.rearBgType = 'video'; }
      else if (key === 'bg') { state.bg = video; state.bgType = 'video'; }
      else if (key === 'fg') { state.fg = video; state.fgType = 'video'; }
      setDefaultFileName(fileId, name, '(website)');
      updateMeta();
      video.play().catch(() => status(key === 'fg' ? 'fgVideoAutoplay' : 'bgVideoAutoplay'));
      status(key === 'fg' ? 'fgVideoLoaded' : 'bgVideoLoaded');
      resolve();
    }, { once: true });
    video.addEventListener('error', () => reject(new Error('Could not load ' + url.href)), { once: true });
  });
}

async function directLoadDefaultWebsiteAsset(key, fileId, value) {
  const url = sameOriginHttpUrl(value);
  if (!url) return false;
  const name = defaultFileNameFromUrl(value, key + '-default');
  const ext = name.toLowerCase().split('.').pop();

  if (key === 'audio' || /^(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(ext)) {
    if (state.audio) state.audio.pause();
    if (state.audioUrl && state.audioUrl.startsWith('blob:')) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = url.href;
    state.audio = new Audio(state.audioUrl);
    state.audio.loop = true;
    state.audio.volume = 0.8;
    state.audio.addEventListener('loadedmetadata', () => applyAudioDuration(false), { once: true });
    state.audioSource = null;
    state.audioLevelSmoothed = 0;
    setDefaultFileName(fileId, name, '(website)');
    updateMeta();
    status('audioLoadedStatus');
    return true;
  }

  if (/^(mp4|webm|mov|m4v|ogv)$/i.test(ext)) {
    await directLoadDefaultVideo(url, key, fileId, name);
    return true;
  }

  await directLoadDefaultImage(url, key, fileId, name);
  return true;
}

export async function loadDefaultAssets() {
  let blockedAny = false;

  for (const [key, fileId, loader] of defaultMediaEntries()) {
    const value = DEFAULT_MEDIA[key];
    if (!value && !DEFAULT_EMBEDDED_MEDIA[key]) continue;

    if (value && /^https?:$/.test(location.protocol)) {
      try {
        const loadedDirect = await directLoadDefaultWebsiteAsset(key, fileId, value);
        if (loadedDirect) continue;
      } catch (directError) {
        console.warn('Same-origin website default load failed, trying File/Blob path:', value, directError);
      }
    }

    try {
      let file = await fileFromEmbeddedDefault(key);
      if (!file) {
        const absoluteUrl = new URL(value, document.baseURI).href;
        file = await fileFromUrl(absoluteUrl);
      }
      currentMediaFiles[key] = file;
      updateFileName(fileId, file);
      loader(file);
    } catch (e) {
      console.warn('Default File/Blob load failed:', value, e);
      blockedAny = true;
      setDefaultFileName(fileId, value, '(choose folder)');
    }
  }

  setDefaultFolderPrompt(blockedAny && hasDefaultMedia());
}

function setDefaultFolderPrompt(show) {
  const btn = $('defaultFolderBtn');
  const hint = $('defaultFolderHint');
  if (btn) btn.hidden = !show;
  if (hint) hint.hidden = !show;
}

export async function loadDefaultAssetsFromFolder() {
  if (!hasDefaultMedia()) return;
  if (!window.showDirectoryPicker) {
    $('status').textContent = 'This browser cannot pick a folder. Use Chrome/Edge, or serve the HTML from a local web server so default files can auto-load safely.';
    return;
  }

  let dir;
  try {
    dir = await window.showDirectoryPicker({ mode: 'read' });
  } catch (e) {
    return;
  }

  let loadedAny = false;
  for (const [key, fileId, loader] of defaultMediaEntries()) {
    const name = DEFAULT_MEDIA[key];
    if (!name) continue;
    try {
      const handle = await dir.getFileHandle(name);
      const file = await handle.getFile();
      currentMediaFiles[key] = file;
      updateFileName(fileId, file);
      loader(file);
      loadedAny = true;
    } catch (e) {
      console.warn('Could not load default file from selected folder:', name, e);
      setDefaultFileName(fileId, name, '(not found in folder)');
    }
  }
  if (loadedAny) {
    setDefaultFolderPrompt(false);
    $('status').textContent = 'Default files loaded from folder. WebM/GIF saving should stay safe because these are real File objects.';
  } else {
    $('status').textContent = 'No default files were found in that folder. Check the filenames and capitalization.';
  }
}
