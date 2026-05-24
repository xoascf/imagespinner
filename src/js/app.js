import { animate } from './render/engine.js';
import { initControls } from './controls/init.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service Worker registration failed: ', err);
    });
  });
}

initControls();
requestAnimationFrame(animate);
