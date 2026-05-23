import { $, off, offCtx } from '../utils/dom.js';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

export function chromaSource(src, w, h) {
  off.width = w;
  off.height = h;
  offCtx.clearRect(0, 0, w, h);
  offCtx.drawImage(src, 0, 0, w, h);
  const image = offCtx.getImageData(0, 0, w, h);
  const data = image.data;
  const key = hexToRgb($('keyColor').value);
  const tol = Number($('tol').value) || 0;
  const soft = Number($('soft').value) || 0;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - key.r;
    const dg = data[i + 1] - key.g;
    const db = data[i + 2] - key.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tol) data[i + 3] = 0;
    else if (soft > 0 && dist < tol + soft) data[i + 3] = Math.round(data[i + 3] * ((dist - tol) / soft));
  }
  offCtx.putImageData(image, 0, 0);
  return off;
}
