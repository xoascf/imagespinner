import { state } from './state.js';
import { $ } from './utils/dom.js';
import { scriptOnce } from './utils/async.js';
import { status } from './controls/status.js';

export async function parseGifDuration(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let frames = 0;
  let totalHundredths = 0;
  const delays = [];

  for (let i = 0; i < bytes.length - 9; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9 && bytes[i + 2] === 0x04) {
      const delay = bytes[i + 4] | (bytes[i + 5] << 8);
      const safeDelay = delay > 0 ? delay : 10;
      totalHundredths += safeDelay;
      delays.push(safeDelay * 10);
      frames++;
      i += 7;
    }
  }

  if (!frames || totalHundredths <= 0) return { seconds: 0, frames: 0, delays: [] };
  return { seconds: totalHundredths / 100, frames, delays };
}

export function canvasHasPaintedPixels(testCanvas) {
  if (!testCanvas || !testCanvas.width || !testCanvas.height) return false;
  try {
    const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });
    const w = testCanvas.width;
    const h = testCanvas.height;
    const stepX = Math.max(1, Math.floor(w / 12));
    const stepY = Math.max(1, Math.floor(h / 12));
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const p = testCtx.getImageData(Math.min(x, w - 1), Math.min(y, h - 1), 1, 1).data;
        if (p[3] > 0 || p[0] || p[1] || p[2]) return true;
      }
    }
  } catch (err) {
    return true;
  }
  return false;
}

export function waitForGifFirstFrame(testCanvas, timeoutMs) {
  const deadline = performance.now() + (timeoutMs || 650);
  return new Promise(resolve => {
    const tick = () => {
      if (canvasHasPaintedPixels(testCanvas) || performance.now() >= deadline) {
        resolve(canvasHasPaintedPixels(testCanvas));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function restartGifCanvasForExport(target) {
  const isBg = target === 'bg';
  const url = isBg ? state.bgUrl : state.fgUrl;
  if (!url || !(isBg ? state.bgType === 'gif' : state.fgType === 'gif') || !window.gifler) return;

  const previousCanvas = isBg ? state.bg : state.fg;
  try {
    const gifCanvas = document.createElement('canvas');
    const animator = await new Promise((resolve, reject) => {
      try {
        window.gifler(url).get(resolve);
      } catch (err) {
        reject(err);
      }
    });

    gifCanvas.width = animator.width || (previousCanvas && previousCanvas.width) || 1;
    gifCanvas.height = animator.height || (previousCanvas && previousCanvas.height) || 1;
    animator.animateInCanvas(gifCanvas);

    const painted = await waitForGifFirstFrame(gifCanvas, 700);
    if (!painted && previousCanvas) {
      console.warn('GIF restart did not paint in time; keeping previous canvas to avoid a blank export frame.');
      return;
    }

    if (isBg) {
      state.bg = gifCanvas;
      state.bgGifAnimator = animator;
    } else {
      state.fg = gifCanvas;
      state.fgGifAnimator = animator;
    }
  } catch (err) {
    console.warn('Could not restart GIF animation for export', err);
  }
}

export async function loadGif(file, target) {
  const isBg = target === 'bg';
  const token = isBg ? ++state.bgLoadToken : ++state.gifLoadToken;
  const url = URL.createObjectURL(file);
  if (isBg) {
    if (state.bgUrl) URL.revokeObjectURL(state.bgUrl);
    state.bgUrl = url;
    state.bg = null;
    state.bgType = 'none';
    state.bgGifDuration = 0;
    state.bgGifFrames = 0;
    state.bgGifDelays = [];
    state.bgGifAnimator = null;
  } else {
    if (state.fgUrl) URL.revokeObjectURL(state.fgUrl);
    state.fgUrl = url;
    state.fg = null;
    state.fgType = 'none';
    state.fgGifDuration = 0;
    state.fgGifFrames = 0;
    state.fgGifDelays = [];
    state.fgGifAnimator = null;
  }
  status('loadingGif');

  parseGifDuration(file).then(info => {
    if (token !== (isBg ? state.bgLoadToken : state.gifLoadToken)) return;
    if (isBg) {
      state.bgGifDuration = info.seconds;
      state.bgGifFrames = info.frames;
      state.bgGifDelays = info.delays || [];
    } else {
      state.fgGifDuration = info.seconds;
      state.fgGifFrames = info.frames;
      state.fgGifDelays = info.delays || [];
    }
  }).catch(err => console.warn('Could not parse GIF duration', err));

  try {
    if (!window.gifler) {
      try { await scriptOnce('https://cdn.jsdelivr.net/npm/gifler@0.1.0/gifler.min.js'); }
      catch (e) { await scriptOnce('https://unpkg.com/gifler@0.1.0/gifler.min.js'); }
    }
    if (token !== (isBg ? state.bgLoadToken : state.gifLoadToken)) return;
    if (!window.gifler) throw new Error('gifler missing');

    const gifCanvas = document.createElement('canvas');
    window.gifler(url).get(animator => {
      if (token !== (isBg ? state.bgLoadToken : state.gifLoadToken)) return;
      gifCanvas.width = animator.width || 1;
      gifCanvas.height = animator.height || 1;
      animator.animateInCanvas(gifCanvas);
      if (isBg) {
        state.bg = gifCanvas;
        state.bgType = 'gif';
        state.bgGifAnimator = animator;
      } else {
        state.fg = gifCanvas;
        state.fgType = 'gif';
        state.fgGifAnimator = animator;
      }
      import('./controls/position.js').then(m => m.updateMeta());
      status('gifLoaded');
    });
  } catch (e) {
    console.error(e);
    status('gifSupportFailed');
  }
}

export async function loadGifFromUrl(url, target, displayName) {
  const isBg = target === 'bg';
  const token = isBg ? ++state.bgLoadToken : ++state.gifLoadToken;
  if (isBg) {
    state.bg = null;
    state.bgType = 'none';
    state.bgGifDuration = 0;
    state.bgGifFrames = 0;
    state.bgGifDelays = [];
    state.bgGifAnimator = null;
  } else {
    state.fg = null;
    state.fgType = 'none';
    state.fgGifDuration = 0;
    state.fgGifFrames = 0;
    state.fgGifDelays = [];
    state.fgGifAnimator = null;
  }
  status('loadingGif');
  try {
    if (!window.gifler) {
      try { await scriptOnce('https://cdn.jsdelivr.net/npm/gifler@0.1.0/gifler.min.js'); }
      catch (e) { await scriptOnce('https://unpkg.com/gifler@0.1.0/gifler.min.js'); }
    }
    if (token !== (isBg ? state.bgLoadToken : state.gifLoadToken)) return;
    if (!window.gifler) throw new Error('gifler missing');

    const gifCanvas = document.createElement('canvas');
    window.gifler(url).get(animator => {
      if (token !== (isBg ? state.bgLoadToken : state.gifLoadToken)) return;
      gifCanvas.width = animator.width || 1;
      gifCanvas.height = animator.height || 1;
      animator.animateInCanvas(gifCanvas);
      if (isBg) {
        state.bg = gifCanvas;
        state.bgType = 'gif';
        state.bgGifAnimator = animator;
      } else {
        state.fg = gifCanvas;
        state.fgType = 'gif';
        state.fgGifAnimator = animator;
      }
      import('./controls/position.js').then(m => m.updateMeta());
      status('gifLoaded');
    });
  } catch (e) {
    console.error('Could not load default GIF directly:', displayName || url, e);
    status('gifSupportFailed');
  }
}
