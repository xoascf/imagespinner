import { $, off, offCtx } from '../utils/dom.js';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

let _chromaCache = { src: null, key: '', tol: 0, soft: 0, w: 0, h: 0 };

export function chromaSource(src, w, h) {
  const keyVal = $('keyColor').value;
  const tolVal = Number($('tol').value) || 0;
  const softVal = Number($('soft').value) || 0;

  // For non-video/non-canvas sources, return cached result if params unchanged
  const isStatic = !(src instanceof HTMLVideoElement) && !(src instanceof HTMLCanvasElement);
  if (isStatic && _chromaCache.src === src && _chromaCache.key === keyVal
      && _chromaCache.tol === tolVal && _chromaCache.soft === softVal
      && _chromaCache.w === w && _chromaCache.h === h) {
    return off;
  }

  off.width = w;
  off.height = h;
  offCtx.clearRect(0, 0, w, h);
  offCtx.drawImage(src, 0, 0, w, h);
  const image = offCtx.getImageData(0, 0, w, h);
  const data = image.data;
  const key = hexToRgb(keyVal);
  const tol = tolVal;
  const soft = softVal;
  const tolSq = tol * tol;
  const softSq = soft > 0 ? (tol + soft) * (tol + soft) : 0;
  const len = data.length;

  if (soft > 0) {
    for (let i = 0; i < len; i += 4) {
      const dr = data[i] - key.r;
      const dg = data[i + 1] - key.g;
      const db = data[i + 2] - key.b;
      const distSq = dr * dr + dg * dg + db * db;
      if (distSq <= tolSq) {
        data[i + 3] = 0;
      } else if (distSq < softSq) {
        const alpha = (Math.sqrt(distSq) - tol) / soft;
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alpha)));
      }
    }
  } else {
    for (let i = 0; i < len; i += 4) {
      const dr = data[i] - key.r;
      const dg = data[i + 1] - key.g;
      const db = data[i + 2] - key.b;
      if (dr * dr + dg * dg + db * db <= tolSq) data[i + 3] = 0;
    }
  }

  offCtx.putImageData(image, 0, 0);
  _chromaCache = { src, key: keyVal, tol: tolVal, soft: softVal, w, h };
  return off;
}
