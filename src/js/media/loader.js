import { $ } from '../utils/dom.js';
import { fileToDataUrlString, revokeIfBlobUrl } from '../utils/files.js';

export function isVideoFileObject(file) {
  return !!file && ((file.type && file.type.startsWith('video/')) || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name || ''));
}

export function isVideoFilename(name) {
  return /\.(mp4|webm|mov|m4v|ogv)$/i.test(name || '');
}

export function isGifFilename(name) {
  return /\.gif(?:$|[?#])/i.test(name || '');
}

export function sourceSize(src) {
  if (!src) return { w: 0, h: 0 };
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth || 0, h: src.videoHeight || 0 };
  return { w: src.width || 0, h: src.height || 0 };
}

export function loadImageFromFile(file, callback, label) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    callback(img);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    import('../controls/status.js').then(m => m.status('Could not load ' + label.toLowerCase() + '.'));
  };
  img.src = url;
}

export function loadStillImageFile(file, assign, successKey, failKey) {
  if (!file) return;
  let finished = false;
  const finishSuccess = (drawable, backingUrl) => {
    if (finished) return;
    finished = true;
    assign(drawable, backingUrl || null);
    import('../controls/position.js').then(m => m.updateMeta());
    import('../controls/status.js').then(m => m.status(successKey));
  };
  const finishFail = () => {
    if (finished) return;
    finished = true;
    import('../controls/status.js').then(m => m.status(failKey));
  };

  if (window.createImageBitmap) {
    createImageBitmap(file).then(bitmap => {
      finishSuccess(bitmap, null);
    }).catch(() => {
      loadStillImageViaUrl(file, finishSuccess, finishFail);
    });
    return;
  }

  loadStillImageViaUrl(file, finishSuccess, finishFail);
}

export function loadStillImageViaUrl(file, finishSuccess, finishFail) {
  const blobUrl = URL.createObjectURL(file);
  const img = new Image();
  let triedDataUrl = false;
  img.onload = () => finishSuccess(img, blobUrl);
  img.onerror = () => {
    if (triedDataUrl) {
      revokeIfBlobUrl(blobUrl);
      finishFail();
      return;
    }
    triedDataUrl = true;
    fileToDataUrlString(file).then(dataUrl => {
      revokeIfBlobUrl(blobUrl);
      const dataImg = new Image();
      dataImg.onload = () => finishSuccess(dataImg, dataUrl);
      dataImg.onerror = finishFail;
      dataImg.src = dataUrl;
    }).catch(() => {
      revokeIfBlobUrl(blobUrl);
      finishFail();
    });
  };
  img.src = blobUrl;
}

export function loadVideoFileObject(file, assign, successKey, failKey) {
  if (!file) return null;
  const video = document.createElement('video');
  let currentUrl = URL.createObjectURL(file);
  let finished = false;
  let triedDataUrl = false;

  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  const finishSuccess = () => {
    if (finished) return;
    const hasSize = (video.videoWidth || 0) > 0 && (video.videoHeight || 0) > 0;
    if (!hasSize) return;
    finished = true;
      assign(video, currentUrl);
    import('../controls/position.js').then(m => m.updateMeta());
    import('../controls/status.js').then(m => m.status(successKey));
    video.play().catch(() => import('../controls/status.js').then(m => m.status(successKey === 'fgVideoLoaded' ? 'fgVideoAutoplay' : 'bgVideoAutoplay')));
  };

  const useFallback = () => {
    if (finished) return;
    if (triedDataUrl) { import('../controls/status.js').then(m => m.status(failKey)); return; }
    triedDataUrl = true;
    fileToDataUrlString(file).then(url => {
      revokeIfBlobUrl(currentUrl);
      currentUrl = url;
      video.src = url;
      video.load();
    }).catch(() => import('../controls/status.js').then(m => m.status(failKey)));
  };

  video.addEventListener('loadedmetadata', finishSuccess);
  video.addEventListener('loadeddata', finishSuccess);
  video.addEventListener('canplay', finishSuccess);
  video.addEventListener('error', useFallback);
  video.src = currentUrl;
  video.load();
  return video;
}

export function waitForVideoSeek(video, seconds) {
  return new Promise(resolve => {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) { resolve(); return; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      video.removeEventListener('loadeddata', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 450);
    video.addEventListener('seeked', finish, { once: true });
    video.addEventListener('loadeddata', finish, { once: true });
    try {
      video.pause();
      video.currentTime = Math.min(Math.max(0, seconds || 0), Math.max(0, video.duration - 0.001));
    } catch (e) {
      finish();
    }
  });
}
