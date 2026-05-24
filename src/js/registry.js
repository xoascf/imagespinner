// Single source of truth for all element IDs used across the app.
// saver.js, init.js, and presets.js all import from here.

// All settings element IDs that get saved/restored in presets and projects.
export const SETTING_IDS = [
  'languageSelect', 'backColor', 'transparentBg',
  'watermarkOn', 'watermarkText', 'watermarkSize', 'watermarkPosition',
  'speed', 'bgScale', 'fgScale', 'rearBgScale', 'spinTarget',
  'audioScaleOn', 'audioScaleAmount', 'soundTarget',
  'sizeResponse', 'bassSensitivity',
  'canvasW', 'canvasH',
  'rearBgX', 'rearBgY', 'bgX', 'bgY', 'fgX', 'fgY',
  'syncOn', 'loopSeconds', 'syncAngle', 'loopMultiple',
  'keyOn', 'keyColor', 'tol', 'soft',
  'recDuration', 'recSeconds', 'recFps',
  'webmMbps', 'gifQuality', 'moveLayer'
];

// IDs that trigger updateNumbers() on input/change events.
export const INPUT_IDS = [
  'speed', 'bgScale', 'fgScale', 'rearBgScale',
  'audioScaleAmount', 'sizeResponse', 'bassSensitivity',
  'tol', 'soft', 'loopSeconds', 'syncAngle', 'loopMultiple',
  'syncOn', 'spinTarget', 'soundTarget', 'moveLayer',
  'recDuration', 'recSeconds', 'recFps',
  'transparentBg', 'watermarkOn', 'watermarkText',
  'watermarkSize', 'watermarkPosition',
  'canvasW', 'canvasH', 'rearBgX', 'rearBgY', 'bgX', 'bgY', 'fgX', 'fgY'
];

// IDs that reset audio state when changed.
export const AUDIO_RESET_IDS = ['bassSensitivity', 'sizeResponse', 'soundTarget'];
