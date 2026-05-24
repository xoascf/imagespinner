import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { downloadBlob } from '../utils/files.js';
import { sleep } from '../utils/async.js';
import { resetLoopingMediaForExport, spinSpeed, drawFrame, getExportSeconds, isAutoExportDuration, getExportAngle } from '../render/engine.js';
import { waitForGifFirstFrame } from '../gif-utils.js';
import { playExportMedia } from '../media/layers.js';
import { status } from '../controls/status.js';
import { setExporting } from '../controls/status.js';

export async function saveApng() {
  if (typeof UPNG === 'undefined') {
    status('apngFailed');
    return;
  }

  setExporting(true);
  const savedAngle = state.angle;
  state.exportActive = true;
  state.exportCancelled = false;
  state.angle = 0;
  state.audioLevelSmoothed = 0;
  state.audioBassFloor = 0;
  state.audioBassPeak = 0.08;
  await resetLoopingMediaForExport();

  try {
    const fps = Math.max(1, Math.min(60, Number($('recFps').value) || 20));
    const seconds = getExportSeconds();
    const frames = Math.max(1, Math.round(seconds * fps));
    const delay = Math.round(1000 / fps);
    const autoLoop = isAutoExportDuration();
    const spinSign = spinSpeed() >= 0 ? 1 : -1;
    const exportArcRad = getExportAngle() * Math.PI / 180;
    const exportSpinSpeedRad = spinSpeed() * Math.PI / 180;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;

    const frameBuffers = [];
    const delays = [];

    for (let i = 0; i < frames; i++) {
      if (state.exportCancelled) {
        state.angle = savedAngle;
        state.exportActive = false;
        setExporting(false);
        status('exportCancelled');
        return;
      }

      if (i === 0) {
        if (state.fgType === 'gif' && state.fg) await waitForGifFirstFrame(state.fg, 300);
        state.angle = 0;
        drawFrame(0);
        await playExportMedia();
      } else {
        if (i % 8 === 0) await sleep(0);
        if (autoLoop) {
          state.angle = spinSign * exportArcRad * i / frames;
        } else {
          state.angle = exportSpinSpeedRad * i * (1 / fps);
        }
        drawFrame(0);
      }

      const imageData = ctx.getImageData(0, 0, w, h);
      frameBuffers.push(imageData.data.buffer.slice(0));
      delays.push(delay);
      status('apngFrames', { done: i + 1, total: frames });
    }

    if (state.exportCancelled) {
      state.angle = savedAngle;
      state.exportActive = false;
      setExporting(false);
      status('exportCancelled');
      return;
    }

    status('apngEncoding');
    await sleep(50); // let UI update

    const apngData = UPNG.encode(frameBuffers, w, h, 0, delays);
    const blob = new Blob([apngData], { type: 'image/apng' });
    downloadBlob(blob, 'image-spinner.apng');
    status('apngSaved');
  } catch (e) {
    console.error(e);
    status('apngFailed');
  } finally {
    state.angle = savedAngle;
    state.exportActive = false;
    setExporting(false);
  }
}
