import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { revokeIfBlobUrl } from '../utils/files.js';
import { currentMediaFiles } from '../consts.js';
import { isVideoFileObject, isVideoFilename, isGifFilename, loadStillImageFile, loadVideoFileObject } from './loader.js';
import { loadGif, loadGifFromUrl } from '../gif-utils.js';
import { applyAudioDuration } from '../controls/presets.js';
import { status } from '../controls/status.js';
import { updateMeta, updateNumbers } from '../controls/position.js';
import { t } from '../utils/i18n.js';

export function updateFileName(id, file) {
  const nameEl = $(id + 'Name');
  if (!nameEl) return;
  const picker = nameEl.closest('.file-picker');
  const removeBtn = picker?.querySelector('.file-remove');
  if (file) {
    nameEl.textContent = file.name;
    nameEl.removeAttribute('data-i18n');
    if (removeBtn) removeBtn.hidden = false;
  } else {
    nameEl.dataset.i18n = 'noFile';
    nameEl.textContent = t('noFile');
    if (removeBtn) removeBtn.hidden = true;
  }
}

export function loadRearBackground(file) {
  if (!file) return;
  state.rearBg = null;
  state.rearBgType = 'none';
  revokeIfBlobUrl(state.rearBgUrl);
  state.rearBgUrl = null;

  if (isVideoFileObject(file)) {
    loadVideoFileObject(file, (video, url) => {
      revokeIfBlobUrl(state.rearBgUrl);
      state.rearBgUrl = url;
      state.rearBg = video;
      state.rearBgType = 'video';
    }, 'bgVideoLoaded', 'bgVideoFailed');
    return;
  }

  loadStillImageFile(file, (drawable, url) => {
    revokeIfBlobUrl(state.rearBgUrl);
    state.rearBgUrl = url;
    state.rearBg = drawable;
    state.rearBgType = 'image';
  }, 'bgImageLoaded', 'bgImageFailed');
}

export function loadBackground(file) {
  if (!file) return;
  state.bgLoadToken++;
  state.bg = null;
  state.bgType = 'none';
  revokeIfBlobUrl(state.bgUrl);
  state.bgUrl = null;

  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  if (isGif) { loadGif(file, 'bg'); return; }

  if (isVideoFileObject(file)) {
    loadVideoFileObject(file, (video, url) => {
      revokeIfBlobUrl(state.bgUrl);
      state.bgUrl = url;
      state.bg = video;
      state.bgType = 'video';
    }, 'bgVideoLoaded', 'bgVideoFailed');
    return;
  }

  loadStillImageFile(file, (drawable, url) => {
    revokeIfBlobUrl(state.bgUrl);
    state.bgUrl = url;
    state.bg = drawable;
    state.bgType = 'image';
  }, 'bgImageLoaded', 'bgImageFailed');
}

export function loadForeground(file) {
  if (!file) return;
  state.gifLoadToken++;
  state.fg = null;
  state.fgType = 'none';
  revokeIfBlobUrl(state.fgUrl);
  state.fgUrl = null;

  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  if (isGif) { loadGif(file, 'fg'); return; }

  if (isVideoFileObject(file)) {
    const video = loadVideoFileObject(file, (video, url) => {
      revokeIfBlobUrl(state.fgUrl);
      state.fgUrl = url;
      state.fg = video;
      state.fgType = 'video';
      if (Number.isFinite(video.duration) && video.duration > 0) {
        $('loopSeconds').value = video.duration.toFixed(2);
        updateNumbers();
      }
    }, 'fgVideoLoaded', 'fgVideoFailed');
    if (video) {
      video.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          $('loopSeconds').value = video.duration.toFixed(2);
          updateNumbers();
        }
      });
    }
    return;
  }

  loadStillImageFile(file, (drawable, url) => {
    revokeIfBlobUrl(state.fgUrl);
    state.fgUrl = url;
    state.fg = drawable;
    state.fgType = 'image';
  }, 'fgImageLoaded', 'fgImageFailed');
}

export function loadAudioFile(file) {
  if (!file) return;
  updateFileName('audioFile', file);
  if (state.audio) state.audio.pause();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  state.audio = new Audio(state.audioUrl);
  state.audio.loop = true;
  state.audio.volume = 0.8;
  state.audio.addEventListener('loadedmetadata', () => {
    applyAudioDuration(false);
  }, { once: true });
  state.audioSource = null;
  state.audioLevelSmoothed = 0;
  state.audioBassFloor = 0;
  state.audioBassPeak = 0.08;
  updateMeta();
  status('audioLoadedStatus');
}

export function loadBackgroundFromUrl(url, displayName) {
  state.bgLoadToken++;
  state.bg = null;
  state.bgType = 'none';
  if (state.bgUrl) { URL.revokeObjectURL(state.bgUrl); state.bgUrl = null; }
  if (isGifFilename(displayName || url)) { loadGifFromUrl(url, 'bg', displayName); return; }
  if (isVideoFilename(displayName || url)) {
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.addEventListener('loadeddata', () => {
      state.bg = video;
      state.bgType = 'video';
      updateMeta();
      video.play().catch(() => status('bgVideoAutoplay'));
      status('bgVideoLoaded');
    });
    video.addEventListener('error', () => status('bgVideoFailed'));
    return;
  }
  const img = new Image();
  img.onload = () => { state.bg = img; state.bgType = 'image'; updateMeta(); status('bgImageLoaded'); };
  img.onerror = () => status('bgImageFailed');
  img.src = url;
}

export function loadForegroundFromUrl(url, displayName) {
  state.gifLoadToken++;
  state.fg = null;
  state.fgType = 'none';
  if (state.fgUrl) { URL.revokeObjectURL(state.fgUrl); state.fgUrl = null; }
  if (isGifFilename(displayName || url)) { loadGifFromUrl(url, 'fg', displayName); return; }
  if (isVideoFilename(displayName || url)) {
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        $('loopSeconds').value = video.duration.toFixed(2);
        updateNumbers();
      }
    });
    video.addEventListener('loadeddata', () => {
      state.fg = video;
      state.fgType = 'video';
      updateMeta();
      video.play().catch(() => status('fgVideoAutoplay'));
      status('fgVideoLoaded');
    });
    video.addEventListener('error', () => status('fgVideoFailed'));
    return;
  }
  const img = new Image();
  img.onload = () => { state.fg = img; state.fgType = 'image'; updateMeta(); status('fgImageLoaded'); };
  img.onerror = () => status('fgImageFailed');
  img.src = url;
}

export function loadRearBackgroundFromUrl(url, displayName) {
  state.rearBg = null;
  state.rearBgType = 'none';
  if (state.rearBgUrl) { URL.revokeObjectURL(state.rearBgUrl); state.rearBgUrl = null; }
  if (isVideoFilename(displayName || url)) {
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.addEventListener('loadeddata', () => {
      state.rearBg = video;
      state.rearBgType = 'video';
      updateMeta();
      video.play().catch(() => status('bgVideoAutoplay'));
      status('bgVideoLoaded');
    });
    video.addEventListener('error', () => status('bgVideoFailed'));
    return;
  }
  const img = new Image();
  img.onload = () => { state.rearBg = img; state.rearBgType = 'image'; updateMeta(); status('bgImageLoaded'); };
  img.onerror = () => status('bgImageFailed');
  img.src = url;
}

export function loadAudioFromUrl(url, displayName) {
  if (state.audio) state.audio.pause();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  state.audio = new Audio(url);
  state.audio.loop = true;
  state.audio.volume = 0.8;
  state.audio.addEventListener('loadedmetadata', () => {
    applyAudioDuration(false);
  }, { once: true });
  state.audioSource = null;
  state.audioLevelSmoothed = 0;
  state.audioBassFloor = 0;
  state.audioBassPeak = 0.08;
  updateMeta();
  status('audioLoadedStatus');
}

export function clearFile(inputId, mediaKey) {
  currentMediaFiles[mediaKey] = null;
  updateFileName(inputId, null);

  switch (mediaKey) {
    case 'rear':
      state.rearBg = null;
      state.rearBgType = 'none';
      revokeIfBlobUrl(state.rearBgUrl);
      state.rearBgUrl = null;
      break;
    case 'bg':
      state.bg = null;
      state.bgType = 'none';
      revokeIfBlobUrl(state.bgUrl);
      state.bgUrl = null;
      state.bgGifDuration = 0;
      state.bgGifFrames = 0;
      state.bgGifDelays = [];
      state.bgGifAnimator = null;
      break;
    case 'fg':
      state.fg = null;
      state.fgType = 'none';
      revokeIfBlobUrl(state.fgUrl);
      state.fgUrl = null;
      state.fgGifDuration = 0;
      state.fgGifFrames = 0;
      state.fgGifDelays = [];
      state.fgGifAnimator = null;
      break;
    case 'audio':
      if (state.audio) state.audio.pause();
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
      state.audioUrl = null;
      state.audio = null;
      state.audioSource = null;
      state.audioLevelSmoothed = 0;
      state.audioBassFloor = 0;
      state.audioBassPeak = 0.08;
      break;
  }

  updateMeta();
  status('removedFile');
}

export function playExportMedia() {
  const videos = [];
  if (state.rearBgType === 'video' && state.rearBg) videos.push(state.rearBg);
  if (state.bgType === 'video' && state.bg) videos.push(state.bg);
  if (state.fgType === 'video' && state.fg) videos.push(state.fg);
  for (const video of videos) {
    try {
      video.loop = true;
      video.muted = true;
      video.play();
    } catch (e) {
      console.warn(e);
    }
  }
}
