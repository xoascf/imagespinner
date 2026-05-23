import { state } from './state.js';
import { $, canvas } from './utils/dom.js';
import { fileFromUrl } from './utils/files.js';
import { loadBackground, loadForeground, loadAudioFile } from './media/layers.js';
import { updatePositionControls, updateNumbers } from './controls/position.js';

export async function loadQueryAssets() {
  const params = new URLSearchParams(location.search);
  const hasBg = params.has('bg');
  const hasFg = params.has('fg');
  if (params.has('spin')) $('spinTarget').value = params.get('spin');
  else if (hasBg && hasFg) $('spinTarget').value = 'bg';
  if (params.has('fgScale')) $('fgScale').value = params.get('fgScale');
  else if (hasFg) $('fgScale').value = 108;
  if (params.has('bgScale')) $('bgScale').value = params.get('bgScale');
  else if (hasBg) $('bgScale').value = 121;
  if (hasFg && !params.has('fgY')) $('fgY').value = Math.round(canvas.height / 2);
  ['bgX', 'bgY', 'fgX', 'fgY'].forEach(id => {
    if (params.has(id)) $(id).value = params.get(id);
  });
  updatePositionControls();
  updateNumbers();
  const entries = [
    ['bg', 'bgFile', loadBackground],
    ['fg', 'fgFile', loadForeground],
    ['audio', 'audioFile', loadAudioFile]
  ];
  for (const [param, fileId, loader] of entries) {
    const value = params.get(param);
    if (!value) continue;
    try {
      const file = await fileFromUrl(new URL(value, location.href).href);
      const { updateFileName } = await import('./media/layers.js');
      updateFileName(fileId, file);
      loader(file);
    } catch (e) {
      console.error(e);
    }
  }
}
