export function standalonePlayback() {
  'use strict';
  
  var c = document.getElementById('c'), ctx = c.getContext('2d');
  // Variables mapped from template literal injection:
  // speed, bgScale, fgScale, spinTarget, bgX, bgY, fgX, fgY, audioScaleOn, audioScaleAmount, soundTarget, bgSrc, fgSrc, audioSrc, w, h, transparent, bgColor

  var bgImg = null, fgImg = null, angle = 0, last = performance.now();
  
  if (bgSrc) { bgImg = new Image(); bgImg.src = bgSrc; }
  if (fgSrc) { fgImg = new Image(); fgImg.src = fgSrc; }

  var audioLevel = 0;
  window.updateAudioLevel = function() {};

  if (window.wallpaperRegisterAudioListener) {
    window.wallpaperRegisterAudioListener(function(audioArray) {
      var sum = 0;
      for (var i = 0; i < 10; i++) sum += audioArray[i]; // bass frequencies
      var avg = sum / 10;
      audioLevel = audioLevel * 0.8 + avg * 0.2;
    });
  } else if (audioSrc && audioScaleOn) {
    try {
      var audio = new Audio(audioSrc);
      audio.loop = true;
      var actx = new (window.AudioContext || window.webkitAudioContext)();
      var analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      var source = actx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(actx.destination);
      var data = new Uint8Array(analyser.frequencyBinCount);
      
      window.addEventListener('click', function() {
        if (actx.state === 'suspended') actx.resume();
        audio.play();
      });
      audio.play().catch(function(e) { console.log("Autoplay prevented, click to play"); });

      window.updateAudioLevel = function() {
        try {
          analyser.getByteFrequencyData(data);
          var sum = 0;
          for(var i=0; i<10; i++) sum += data[i]; // bass frequencies
          var avg = sum / 10 / 255;
          audioLevel = audioLevel * 0.8 + avg * 0.2; // smoothing
        } catch (e) {}
      };
    } catch (e) {
      console.warn("Web Audio API failed (likely CORS on file:///)");
    }
  }

  function draw(now) {
    var dt = (now - last) / 1000;
    last = now;
    angle += speed * Math.PI / 180 * dt;
    
    if (audioScaleOn) window.updateAudioLevel();

    var currentBgScale = bgScale;
    var currentFgScale = fgScale;
    
    if (audioScaleOn) {
      var pulse = audioLevel * audioScaleAmount;
      if (soundTarget === 'bg' || soundTarget === 'both') currentBgScale += pulse;
      if (soundTarget === 'fg' || soundTarget === 'both') currentFgScale += pulse;
    }

    ctx.clearRect(0, 0, w, h);
    if (!transparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    if (bgImg && bgImg.complete) {
      ctx.save();
      ctx.translate(bgX, bgY);
      if (spinTarget === 'bg' || spinTarget === 'both') ctx.rotate(angle);
      var bw = bgImg.naturalWidth * currentBgScale, bh = bgImg.naturalHeight * currentBgScale;
      ctx.drawImage(bgImg, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    }

    if (fgImg && fgImg.complete) {
      ctx.save();
      ctx.translate(fgX, fgY);
      if (spinTarget === 'fg' || spinTarget === 'both') ctx.rotate(angle);
      var fw = fgImg.naturalWidth * currentFgScale, fh = fgImg.naturalHeight * currentFgScale;
      ctx.drawImage(fgImg, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
