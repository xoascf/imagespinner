import { state } from '../state.js';
import { $, canvas } from '../utils/dom.js';
import { downloadBlob } from '../utils/files.js';
import { spinSpeed, drawFrame } from '../render/engine.js';
import { status } from '../controls/status.js';
import { setExporting } from '../controls/status.js';

function imageToDataURL(img) {
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.videoWidth || img.width;
  c.height = img.naturalHeight || img.videoHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

export async function saveHtml() {
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

    // Capture current images as data URIs
    let bgDataUrl = null;
    let fgDataUrl = null;
    if (state.bg && (state.bgType === 'image' || state.bgType === 'gif')) {
      bgDataUrl = imageToDataURL(state.bg);
    }
    if (state.fg && (state.fgType === 'image' || state.fgType === 'gif')) {
      fgDataUrl = imageToDataURL(state.fg);
    }

    // Capture current canvas as fallback
    const canvasDataUrl = canvas.toDataURL('image/png');

    const bgX = Number($('bgX').value) || w / 2;
    const bgY = Number($('bgY').value) || h / 2;
    const fgX = Number($('fgX').value) || w / 2;
    const fgY = Number($('fgY').value) || h / 2;

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
'use strict';
var c=document.getElementById('c'),ctx=c.getContext('2d');
var speed=${speed},bgScale=${bgScale/100},fgScale=${fgScale/100};
var spinTarget='${spinTarget}';
var bgX=${bgX},bgY=${bgY},fgX=${fgX},fgY=${fgY};
var bgImg=null,fgImg=null,angle=0,last=performance.now();
${bgDataUrl ? `bgImg=new Image();bgImg.src=${JSON.stringify(bgDataUrl)};` : ''}
${fgDataUrl ? `fgImg=new Image();fgImg.src=${JSON.stringify(fgDataUrl)};` : ''}
function draw(now){
  var dt=(now-last)/1000;last=now;
  angle+=speed*Math.PI/180*dt;
  ctx.clearRect(0,0,${w},${h});
  ${!transparent ? `ctx.fillStyle='${bgColor}';ctx.fillRect(0,0,${w},${h});` : ''}
  if(bgImg&&bgImg.complete){
    ctx.save();ctx.translate(bgX,bgY);
    if(spinTarget==='bg'||spinTarget==='both')ctx.rotate(angle);
    var bw=bgImg.naturalWidth*bgScale,bh=bgImg.naturalHeight*bgScale;
    ctx.drawImage(bgImg,-bw/2,-bh/2,bw,bh);
    ctx.restore();
  }
  if(fgImg&&fgImg.complete){
    ctx.save();ctx.translate(fgX,fgY);
    if(spinTarget==='fg'||spinTarget==='both')ctx.rotate(angle);
    var fw=fgImg.naturalWidth*fgScale,fh=fgImg.naturalHeight*fgScale;
    ctx.drawImage(fgImg,-fw/2,-fh/2,fw,fh);
    ctx.restore();
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    downloadBlob(blob, 'image-spinner-wallpaper.html');
    status('htmlSaved');
  } catch (e) {
    console.error(e);
    status('htmlFailed');
  } finally {
    setExporting(false);
  }
}
