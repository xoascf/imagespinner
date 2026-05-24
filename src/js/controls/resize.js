import { $, canvas } from '../utils/dom.js';
import { centerLayers, updateMeta } from './position.js';

export function resizeCanvas(force = false, center = true) {
  const w = Math.max(100, Number($('canvasW').value) || 800);
  const h = Math.max(100, Number($('canvasH').value) || 800);
  if (force || canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    const wrapper = canvas.parentElement;
    if (wrapper && wrapper.classList.contains('canvas-wrapper')) {
      wrapper.style.aspectRatio = `${w} / ${h}`;
    }
    if (center !== false) {
      centerLayers();
    }
    updateMeta();
  }
}
