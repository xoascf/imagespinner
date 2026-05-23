import { state } from '../state.js';
import { $, canvas, ctx } from '../utils/dom.js';
import { status } from './status.js';
import { updateNumbers } from './position.js';

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * canvas.width / rect.width,
    y: (e.clientY - rect.top) * canvas.height / rect.height
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
}

export function pickColorFromCanvasEvent(e) {
  if (!state.colorPickTarget) return false;
  const point = canvasPoint(e);
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
  try {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    $(state.colorPickTarget).value = rgbToHex(pixel[0], pixel[1], pixel[2]);
    status('colorPicked');
    updateNumbers();
  } catch (err) {
    console.warn(err);
  }
  state.colorPickTarget = null;
  canvas.style.cursor = '';
  return true;
}

export function startColorPick(target) {
  state.colorPickTarget = target;
  canvas.style.cursor = 'crosshair';
  status('colorPickHint');
}
