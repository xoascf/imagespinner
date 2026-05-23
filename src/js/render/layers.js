import { state } from '../state.js';
import { $, canvas, ctx } from '../utils/dom.js';
import { sourceSize } from '../media/loader.js';
import { currentAudioLevel } from '../audio/analyzer.js';

export function drawRearBackground(src) {
  if (!src) return;
  const s = sourceSize(src);
  if (!s.w || !s.h) return;
  const baseCover = Math.max(canvas.width / s.w, canvas.height / s.h);
  const extraScale = Math.max(0.01, (Number($('rearBgScale') ? $('rearBgScale').value : 100) || 100) / 100);
  const w = s.w * baseCover * extraScale;
  const h = s.h * baseCover * extraScale;
  const x = Number($('rearBgX') ? $('rearBgX').value : canvas.width / 2) || canvas.width / 2;
  const y = Number($('rearBgY') ? $('rearBgY').value : canvas.height / 2) || canvas.height / 2;
  ctx.drawImage(src, x - w / 2, y - h / 2, w, h);
}

export function drawCentered(src, x, y, scalePct, rot) {
  if (!src) return;
  const s = sourceSize(src);
  if (!s.w || !s.h) return;
  const scale = scalePct / 100;
  const w = s.w * scale;
  const h = s.h * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function spinnerScale(baseScale, layer) {
  const base = Number(baseScale) || 100;
  if (!$('audioScaleOn').checked) return base;
  const target = $('soundTarget') ? $('soundTarget').value : 'bg';
  if (target !== 'both' && target !== layer) return base;
  const pulseAmount = Math.max(0, (Number($('audioScaleAmount').value) || 0) / 100);
  const response = Math.max(0, (Number($('sizeResponse') ? $('sizeResponse').value : 250) || 250) / 100);
  const sizeBoost = Math.min(12, currentAudioLevel() * pulseAmount * response);
  return base * (1 + sizeBoost);
}
