import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { downloadBlob } from '../utils/files.js';
import { spinSpeed } from '../render/engine.js';
import { status, setExporting } from '../controls/status.js';
import { standalonePlayback } from './playback.js';

function imageToDataURL(img) {
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.videoWidth || img.width;
  c.height = img.naturalHeight || img.videoHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

export async function saveHtml(mode = 'embed') {
  setExporting(true);
  try {
    const w = canvas.width;
    const h = canvas.height;
    const speed = spinSpeed();
    const bgScale = Number($('bgScale').value) || 100;
    const fgScale = Number($('fgScale').value) || 100;
    const spinTarget = $('spinTarget').value;
    const bgColor = $('backColor').value || '#ffffff';
    const transparent = $('transparentBg')?.checked;

    const audioScaleOn = $('audioScaleOn')?.checked || false;
    const audioScaleAmount = Number($('audioScaleAmount').value) || 35;
    const soundTarget = $('soundTarget').value || 'bg';

    const useZip = mode === 'zip';

    // Collect Data URLs if embedded, or just filenames if ZIP
    let bgDataUrl = null;
    let fgDataUrl = null;
    let audioDataUrl = null;
    
    let bgFilename = null;
    let fgFilename = null;
    let audioFilename = null;

    let zip = null;
    if (useZip) {
      if (!window.JSZip) throw new Error('JSZip library not found');
      zip = new window.JSZip();
      
      if (state.bgFile) {
        bgFilename = 'bg_' + state.bgFile.name;
        zip.file(bgFilename, state.bgFile);
      }
      if (state.fgFile) {
        fgFilename = 'fg_' + state.fgFile.name;
        zip.file(fgFilename, state.fgFile);
      }
      if (state.audioFile) {
        audioFilename = 'audio_' + state.audioFile.name;
        zip.file(audioFilename, state.audioFile);
      }
    } else {
      if (state.bg && (state.bgType === 'image' || state.bgType === 'gif')) {
        bgDataUrl = imageToDataURL(state.bg);
      }
      if (state.fg && (state.fgType === 'image' || state.fgType === 'gif')) {
        fgDataUrl = imageToDataURL(state.fg);
      }
      // Audio embedding (base64) can be huge, but possible
      if (state.audioFile) {
        audioDataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(state.audioFile);
        });
      }
    }

    const bgX = Number($('bgX').value) || w / 2;
    const bgY = Number($('bgY').value) || h / 2;
    const fgX = Number($('fgX').value) || w / 2;
    const fgY = Number($('fgY').value) || h / 2;

    const bgSrc = useZip ? (bgFilename ? `'${bgFilename}'` : 'null') : (bgDataUrl ? `'${bgDataUrl}'` : 'null');
    const fgSrc = useZip ? (fgFilename ? `'${fgFilename}'` : 'null') : (fgDataUrl ? `'${fgDataUrl}'` : 'null');
    const audioSrc = useZip ? (audioFilename ? `'${audioFilename}'` : 'null') : (audioDataUrl ? `'${audioDataUrl}'` : 'null');

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Image Spinner Wallpaper</title>
<style>
*{margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:${transparent ? 'transparent' : bgColor}}
canvas{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);max-width:100vw;max-height:100vh}
</style>
</head>
<body>
<canvas id="c" width="${w}" height="${h}"></canvas>
<script>
// Configuration
var speed=${speed}, bgScale=${bgScale/100}, fgScale=${fgScale/100};
var spinTarget='${spinTarget}';
var bgX=${bgX}, bgY=${bgY}, fgX=${fgX}, fgY=${fgY};
var audioScaleOn=${audioScaleOn}, audioScaleAmount=${audioScaleAmount/100}, soundTarget='${soundTarget}';
var bgSrc=${bgSrc}, fgSrc=${fgSrc}, audioSrc=${audioSrc};
var w=${w}, h=${h}, transparent=${transparent}, bgColor='${bgColor}';

// Engine
(${standalonePlayback.toString()})();
<\/script>
</body>
</html>`;

    if (useZip) {
      zip.file('index.html', html);
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'image-spinner-project.zip');
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      downloadBlob(blob, 'image-spinner-wallpaper.html');
    }
    status('htmlSaved');
  } catch (e) {
    console.error('HTML export failed', e);
    status('htmlFailed');
  } finally {
    setExporting(false);
  }
}
