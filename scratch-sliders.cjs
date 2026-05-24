const fs = require('fs');
let html = fs.readFileSync('src/index.html', 'utf-8');

const inputsToConvert = [
  'speed',
  'bgScale', 'fgScale', 'rearBgScale',
  'canvasW', 'canvasH',
  'bgX', 'bgY', 'fgX', 'fgY', 'rearBgX', 'rearBgY',
  'watermarkSize', 'audioScaleAmount', 'sizeResponse', 'bassSensitivity',
  'syncAngle', 'loopMultiple', 'loopSeconds',
  'webmMbps', 'gifQuality', 'recFps'
];

for (const id of inputsToConvert) {
  if (id === 'speed') {
    html = html.replace(
      '<div class="row">\n          <input id="speed" type="number" value="30" min="-360" max="360" step="1">\n          <select id="spinTarget">',
      '<div class="slider-row">\n          <input id="speedRange" type="range" value="30" min="-360" max="360" step="1">\n          <input id="speed" type="number" value="30" min="-360" max="360" step="1">\n        </div>\n        <div class="label" data-i18n="spinTarget">Spin target</div>\n        <select id="spinTarget">'
    );
    continue;
  }
  const regex = new RegExp('<input\\s+id="' + id + '"\\s+type="number"([^>]*)>', 'g');
  html = html.replace(regex, '<div class="slider-row"><input id="' + id + 'Range" type="range"$1><input id="' + id + '" type="number"$1></div>');
}

fs.writeFileSync('src/index.html', html);
