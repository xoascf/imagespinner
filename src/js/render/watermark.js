import { $, canvas, ctx } from '../utils/dom.js';

export function drawWatermark() {
  if (!$('watermarkOn') || !$('watermarkOn').checked) return;
  const text = ($('watermarkText') && $('watermarkText').value.trim()) || 'Trassel Vardias';
  const size = Math.max(8, Number($('watermarkSize') ? $('watermarkSize').value : 28) || 28);
  const pos = $('watermarkPosition') ? $('watermarkPosition').value : 'bottom-right';
  const pad = Math.max(8, Math.round(size * 0.65));

  ctx.save();
  ctx.font = '700 ' + size + 'px Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const height = size;
  let x = canvas.width - pad;
  let y = canvas.height - pad;
  let align = 'right';

  if (pos === 'bottom-left') {
    x = pad;
    y = canvas.height - pad;
    align = 'left';
  } else if (pos === 'top-right') {
    x = canvas.width - pad;
    y = pad + height;
    align = 'right';
  } else if (pos === 'top-left') {
    x = pad;
    y = pad + height;
    align = 'left';
  } else if (pos === 'center') {
    x = canvas.width / 2;
    y = canvas.height / 2 + height / 3;
    align = 'center';
  }

  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.lineWidth = Math.max(2, Math.round(size / 8));
  ctx.strokeText(text, x, y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(text, x, y);
  ctx.restore();
}
