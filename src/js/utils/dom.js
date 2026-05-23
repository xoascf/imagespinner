export const $ = id => document.getElementById(id);

export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

export const off = document.createElement('canvas');
export const offCtx = off.getContext('2d', { willReadFrequently: true });
