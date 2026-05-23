import { $, canvas } from '../utils/dom.js';
import { downloadBlob, fileToDataUrlWithInfo } from '../utils/files.js';

export async function downloadHtmlWithDefaults() {
  const doc = document.cloneNode(true);

  const controlIds = [
    'languageSelect','backColor','transparentBg','watermarkOn','watermarkText','watermarkSize','watermarkPosition',
    'speed','bgScale','fgScale','rearBgScale','spinTarget','audioScaleOn','audioScaleAmount','soundTarget',
    'sizeResponse','bassSensitivity','canvasW','canvasH','rearBgX','rearBgY','bgX','bgY','fgX','fgY',
    'syncOn','loopSeconds','syncAngle','loopMultiple','keyOn','keyColor','tol','soft','recSeconds','recFps',
    'webmMbps','gifQuality','defaultRearBgName','defaultBgName','defaultFgName','defaultAudioName'
  ];
  controlIds.forEach(id => {
    const live = $(id);
    const clone = doc.getElementById(id);
    if (!live || !clone) return;
    if (live.type === 'checkbox') {
      if (live.checked) clone.setAttribute('checked', 'checked');
      else clone.removeAttribute('checked');
    } else if (live.tagName === 'SELECT') {
      Array.from(clone.options).forEach(option => {
        if (option.value === live.value) option.setAttribute('selected', 'selected');
        else option.removeAttribute('selected');
      });
    } else {
      clone.setAttribute('value', live.value);
    }
  });

  const panel = doc.getElementById('settingsSaverPanel');
  if (panel) panel.setAttribute('hidden', 'hidden');

  // Remove only CDN-loaded scripts, keep the main module script
  doc.querySelectorAll('script[src*="cdn."], script[src*="unpkg."]').forEach(script => script.remove());

  let html = '<!doctype html>\n' + doc.documentElement.outerHTML;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, 'image-spinner-saved-defaults.html');
  import('./status.js').then(m => m.status('settingsBalanced'));
}
