import { state } from '../state.js';
import { $, canvas, ctx } from '../utils/dom.js';
import { chromaSource } from './chroma.js';
import { drawWatermark } from './watermark.js';
import { drawRearBackground, drawCentered, spinnerScale } from './layers.js';
import { sourceSize, waitForVideoSeek } from '../media/loader.js';
import { restartGifCanvasForExport } from '../gif-utils.js';
import { t } from '../utils/i18n.js';

let _lastFgW = 0;
let _lastFgH = 0;

export function spinSpeed() {
  if (!$('syncOn').checked) return Number($('speed').value) || 0;
  const loop = Math.max(0.05, Number($('loopSeconds').value) || 1);
  const ang = Number($('syncAngle').value) || 0;
  const mult = Math.max(0.05, Number($('loopMultiple').value) || 1);
  return ang / (loop * mult);
}

export function getExportSeconds() {
  const raw = Number($('recSeconds').value);
  if (raw > 0) return Math.max(0.05, Math.min(600, raw));
  // Auto: one full 360° rotation
  const speed = Math.abs(spinSpeed());
  if (speed < 0.01) return 3; // near-zero speed fallback
  return Math.max(0.1, Math.min(600, 360 / speed));
}

export function isAutoExportDuration() {
  return !(Number($('recSeconds').value) > 0);
}

let _emptyGuideShown = false;

export function drawFrame(dt) {
  if (!state.paused && !state.exportActive) state.angle += spinSpeed() * Math.PI / 180 * dt;

  // Cache all DOM reads once per frame
  const spinTarget = $('spinTarget').value;
  const transparentBgEl = $('transparentBg');
  const isTransparent = transparentBgEl && transparentBgEl.checked;
  const cw = canvas.width;
  const ch = canvas.height;
  const halfW = cw / 2;
  const halfH = ch / 2;

  ctx.clearRect(0, 0, cw, ch);
  if (!isTransparent) {
    ctx.fillStyle = $('backColor').value;
    ctx.fillRect(0, 0, cw, ch);
  }
  drawRearBackground(state.rearBg);

  const hasMedia = !!(state.rearBg || state.bg || state.fg);
  if (!hasMedia) {
    if (!_emptyGuideShown) _emptyGuideShown = true;
    ctx.save();
    ctx.strokeStyle = '#dfe5e7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfW - 76, halfH);
    ctx.lineTo(halfW + 76, halfH);
    ctx.moveTo(halfW, halfH - 76);
    ctx.lineTo(halfW, halfH + 76);
    ctx.stroke();
    ctx.strokeStyle = '#cbd5d9';
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(halfW - 112, halfH - 112, 224, 224);
    ctx.setLineDash([]);
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 28px Arial';
    ctx.fillText(t('viewerWorking'), halfW, halfH - 22);
    ctx.font = '17px Arial';
    ctx.fillText(t('loadFilesHint'), halfW, halfH + 20);
    ctx.restore();
    drawWatermark();
    return;
  }
  _emptyGuideShown = false;

  const bgScaleVal = $('bgScale').value;
  const bgXVal = Number($('bgX').value) || halfW;
  const bgYVal = Number($('bgY').value) || halfH;

  drawCentered(
    state.bg,
    bgXVal,
    bgYVal,
    spinnerScale(bgScaleVal, 'bg'),
    spinTarget === 'bg' || spinTarget === 'both' ? state.angle : 0
  );

  if (state.fg) {
    let drawable = state.fg;
    const s = sourceSize(state.fg);
    _lastFgW = s.w;
    _lastFgH = s.h;
    const keyOnEl = $('keyOn');
    if (keyOnEl && keyOnEl.checked && s.w && s.h) drawable = chromaSource(state.fg, s.w, s.h);
    const fgScaleVal = $('fgScale').value;
    const fgXVal = Number($('fgX').value) || halfW;
    const fgYVal = Number($('fgY').value) || halfH;
    drawCentered(
      drawable,
      fgXVal,
      fgYVal,
      spinnerScale(fgScaleVal, 'fg'),
      spinTarget === 'fg' || spinTarget === 'both' ? state.angle : 0
    );
  }

  drawWatermark();
}

export function drawExportFrame(dt) {
  state.angle += spinSpeed() * Math.PI / 180 * dt;
  drawFrame(0);
}

export function animate(now) {
  const dt = Math.min(0.1, (now - state.lastTime) / 1000);
  state.lastTime = now;
  drawFrame(dt);
  requestAnimationFrame(animate);
}

export async function resetLoopingMediaForExport() {
  await restartGifCanvasForExport('bg');
  await restartGifCanvasForExport('fg');

  const videos = [];
  if (state.rearBgType === 'video' && state.rearBg) videos.push(state.rearBg);
  if (state.bgType === 'video' && state.bg) videos.push(state.bg);
  if (state.fgType === 'video' && state.fg) videos.push(state.fg);

  for (const video of videos) {
    try {
      video.loop = true;
      video.muted = true;
      await waitForVideoSeek(video, 0);
      video.pause();
    } catch (e) {
      console.warn(e);
    }
  }
}
