import { state } from '../state.js';
import { $, canvas, ctx } from '../utils/dom.js';
import { chromaSource } from './chroma.js';
import { drawWatermark } from './watermark.js';
import { drawRearBackground, drawCentered, spinnerScale } from './layers.js';
import { sourceSize, waitForVideoSeek } from '../media/loader.js';
import { restartGifCanvasForExport } from '../gif-utils.js';
import { t } from '../utils/i18n.js';

export function spinSpeed() {
  if (!$('syncOn').checked) return Number($('speed').value) || 0;
  const loop = Math.max(0.05, Number($('loopSeconds').value) || 1);
  const ang = Number($('syncAngle').value) || 0;
  const mult = Math.max(0.05, Number($('loopMultiple').value) || 1);
  return ang / (loop * mult);
}

export function drawFrame(dt) {
  if (!state.paused && !state.exportActive) state.angle += spinSpeed() * Math.PI / 180 * dt;
  const spinTarget = $('spinTarget').value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!$('transparentBg') || !$('transparentBg').checked) {
    ctx.fillStyle = $('backColor').value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawRearBackground(state.rearBg);

  if (!state.rearBg && !state.bg && !state.fg) {
    ctx.save();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.strokeStyle = '#dfe5e7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 76, cy);
    ctx.lineTo(cx + 76, cy);
    ctx.moveTo(cx, cy - 76);
    ctx.lineTo(cx, cy + 76);
    ctx.stroke();
    ctx.strokeStyle = '#cbd5d9';
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(cx - 112, cy - 112, 224, 224);
    ctx.setLineDash([]);
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 28px Arial';
    ctx.fillText(t('viewerWorking'), canvas.width / 2, canvas.height / 2 - 22);
    ctx.font = '17px Arial';
    ctx.fillText(t('loadFilesHint'), canvas.width / 2, canvas.height / 2 + 20);
    ctx.restore();
  }

  drawCentered(
    state.bg,
    Number($('bgX').value) || canvas.width / 2,
    Number($('bgY').value) || canvas.height / 2,
    spinnerScale($('bgScale').value, 'bg'),
    spinTarget === 'bg' || spinTarget === 'both' ? state.angle : 0
  );

  if (state.fg) {
    let drawable = state.fg;
    const s = sourceSize(state.fg);
    if ($('keyOn').checked && s.w && s.h) drawable = chromaSource(state.fg, s.w, s.h);
    drawCentered(
      drawable,
      Number($('fgX').value) || canvas.width / 2,
      Number($('fgY').value) || canvas.height / 2,
      spinnerScale($('fgScale').value, 'fg'),
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
