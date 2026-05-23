import { $, canvas, ctx } from '../utils/dom.js';

let _wmCache = { text: '', size: 0, width: 0 };

export function drawWatermark() {
  const wmOnEl = $('watermarkOn');
  if (!wmOnEl || !wmOnEl.checked) return;
  const wmTextEl = $('watermarkText');
  const text = (wmTextEl && wmTextEl.value.trim()) || 'Trassel Vardias';
  const wmSizeEl = $('watermarkSize');
  const size = Math.max(8, Number(wmSizeEl ? wmSizeEl.value : 28) || 28);
  const wmPosEl = $('watermarkPosition');
  const pos = wmPosEl ? wmPosEl.value : 'bottom-right';
  const pad = Math.max(8, Math.round(size * 0.65));
  const font = '700 ' + size + 'px Arial, sans-serif';

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  // Cache measureText — only recompute when text or size changes
  if (_wmCache.text !== text || _wmCache.size !== size) {
    _wmCache.text = text;
    _wmCache.size = size;
    _wmCache.width = ctx.measureText(text).width;
  }

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
