import { animate } from './render/engine.js';
import { initControls } from './controls/init.js';

initControls();
requestAnimationFrame(animate);
