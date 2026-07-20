(function () {
  // Single source of truth for the needle colour.  Format: "R, G, B".
  var FIBER_RGB = '255, 255, 255';   // light needles on the dark section

  var SCALE = 0.85;                              // overall beam length (bigger)
  var XSCALE = 1.18, YSCALE = 0.9;              // stretch wider, flatten height
  var TIME_SPEED = 1.3;                          // autonomous sway / morph speed
  var PUSH = 85;                                // cursor push distance
  var SPRING_STIFF = 0.045, SPRING_DAMP = 0.86;   // rebound springiness (looser / slower settle)
  var NUM_FIBERS = 140;
  var MOUSE_RADIUS = 220, MOUSE_STRENGTH = 0.7;

  // metric palette (brand teal + complements) and colour helpers
  var METRIC_COLORS = [[66, 234, 206], [255, 157, 92], [183, 139, 255], [90, 162, 255]];  // teal / orange / purple / blue
  function lighten(rgb, t) { return [Math.round(rgb[0] + (255 - rgb[0]) * t), Math.round(rgb[1] + (255 - rgb[1]) * t), Math.round(rgb[2] + (255 - rgb[2]) * t)]; }
  function rgbaStr(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }

  function start() {
    var canvas = document.getElementById('nb-canvas');
    if (!canvas) { return; }   // page without the needle beam section
    if (!canvas.getBoundingClientRect().width) { return setTimeout(start, 60); }

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, paused = false, time = 0, lastTime = performance.now();
    var mouseX = -9999, mouseY = -9999, mouseActive = false;
    var fibers = [];
    var activeRGB = METRIC_COLORS[0].slice();   // colour currently shown by the graphic
    var targetRGB = METRIC_COLORS[0].slice();   // colour of the selected metric

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      W = r.width; H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(canvas); } catch (e) {} }
    window.addEventListener('resize', resize);

    var host = canvas.parentElement;   // listen on the section so beams react even over the content
    host.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouseX = e.clientX - r.left; mouseY = e.clientY - r.top; mouseActive = true;
    });
    host.addEventListener('mouseleave', function () { mouseActive = false; });

    class SubFiber {
      constructor(baseAngle, lengthFraction, parentLength, opacityMult, lineWidthMult, dotRadius) {
        this.angleOffset = (Math.random() - 0.5) * 0.06;
        this.baseAngle = baseAngle + (Math.random() - 0.5) * 0.08;
        this.angle = this.baseAngle + this.angleOffset;
        this.length = parentLength * lengthFraction;
        this.opacityMult = opacityMult;
        this.lineWidthMult = lineWidthMult;
        this.dotRadius = dotRadius;
        this.swaySpeed = 0.00016 + Math.random() * 0.00032;
        this.swayAmp = 0.015 + Math.random() * 0.042;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed2 = 0.00024 + Math.random() * 0.00035;
        this.swayPhase2 = Math.random() * Math.PI * 2;
        this.swaySpeed3 = 0.00007 + Math.random() * 0.00015;
        this.swayPhase3 = Math.random() * Math.PI * 2;
        this.swayAmp3 = 0.006 + Math.random() * 0.015;
        this.maxDotRadius = this.dotRadius;
        this.dotPulseSpeed = 0.0008 + Math.random() * 0.0015;
        this.dotPulsePhase = Math.random() * Math.PI * 2;
        this.tipOffsetX = 0; this.tipOffsetY = 0; this.tipVelX = 0; this.tipVelY = 0;
      }
      update(t) {
        const sway1 = Math.sin(t * this.swaySpeed + this.swayPhase) * this.swayAmp;
        const sway2 = Math.sin(t * this.swaySpeed2 + this.swayPhase2) * this.swayAmp * 0.6;
        const sway3 = Math.sin(t * this.swaySpeed3 + this.swayPhase3) * this.swayAmp3;
        this.angle = this.baseAngle + this.angleOffset + sway1 + sway2 + sway3;
      }
      draw(ctx, cx, cy, alpha, lineWidth, t) {
        let tipX = cx + Math.cos(this.angle) * this.length * XSCALE;
        let tipY = cy + Math.sin(this.angle) * this.length * YSCALE;
        let tipOffsetX = 0, tipOffsetY = 0;
        if (mouseActive) {
          const dx = tipX - mouseX, dy = tipY - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const lenFactor = Math.max(this.length / 350, 0.4);
          const effectiveRadius = MOUSE_RADIUS * lenFactor + 72;
          if (dist < effectiveRadius && dist > 0.1) {
            const norm = dist / effectiveRadius;
            const force = Math.pow(1 - norm, 3) * MOUSE_STRENGTH;
            tipOffsetX = (dx / dist) * force * PUSH;
            tipOffsetY = (dy / dist) * force * PUSH;
          }
        }
        this.tipVelX = (this.tipVelX + (tipOffsetX - this.tipOffsetX) * SPRING_STIFF) * SPRING_DAMP; this.tipOffsetX += this.tipVelX;
        this.tipVelY = (this.tipVelY + (tipOffsetY - this.tipOffsetY) * SPRING_STIFF) * SPRING_DAMP; this.tipOffsetY += this.tipVelY;
        tipX += this.tipOffsetX; tipY += this.tipOffsetY;
        const a = alpha * this.opacityMult;
        const lw = lineWidth * this.lineWidthMult;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = `rgba(${FIBER_RGB}, ${a * 0.95})`;
        ctx.lineWidth = lw; ctx.stroke();
        const subDotPulse = 0.55 + 0.45 * Math.sin(t * this.dotPulseSpeed + this.dotPulsePhase);
        const subDotR = this.maxDotRadius * subDotPulse;
        ctx.beginPath(); ctx.arc(tipX, tipY, subDotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${FIBER_RGB}, ${a})`; ctx.fill();
      }
    }

    class Fiber {
      constructor(index, total) {
        const startAngle = -190;
        const angleStep = 200 / (total - 1);
        this.baseAngle = (startAngle + angleStep * index) * (Math.PI / 180);
        this.index = index;
        this.angleOffset = (Math.random() - 0.5) * 0.04;
        this.angle = this.baseAngle + this.angleOffset;
        const normPos = index / (total - 1);
        const sinFactor = Math.sin(normPos * Math.PI);
        const widthStretch = 1.0 + (1.0 - sinFactor) * 0.35;
        const outlierChance = Math.random();
        let outlierBonus = 0;
        if (outlierChance > 0.92) outlierBonus = 100 + Math.random() * 60;
        else if (outlierChance > 0.85) outlierBonus = 40 + Math.random() * 80;
        else if (outlierChance > 0.7) outlierBonus = 15 + Math.random() * 35;
        const baseLen = (270 + sinFactor * 160 + Math.random() * 60 + outlierBonus) * widthStretch;
        this.maxLength = baseLen * SCALE;
        this.length = this.maxLength;
        this.maxDotRadius = 0.8 + Math.random() * 1.2;
        this.dotRadius = this.maxDotRadius;
        this.dotPulseSpeed = 0.0006 + Math.random() * 0.0012;
        this.dotPulsePhase = Math.random() * Math.PI * 2;
        this.opacity = 0.88 + Math.random() * 0.12;
        this.baseOpacity = this.opacity;
        this.fadeTarget = this.opacity;
        this.fadePhase = Math.random() * Math.PI * 2;
        this.fadeSpeed = 0.0002 + Math.random() * 0.0004;
        this.fadeChance = 0.003 + Math.random() * 0.004;
        this.isFading = false;
        this.fadeTarget = this.opacity;
        this.lineWidth = (0.1 + Math.random() * 0.3) * (1 + sinFactor * 0.8);
        this.swaySpeed = 0.00011 + Math.random() * 0.00024;
        this.swayAmp = 0.01 + Math.random() * 0.03;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed2 = 0.00016 + Math.random() * 0.00026;
        this.swayPhase2 = Math.random() * Math.PI * 2;
        this.swaySpeed3 = 0.00004 + Math.random() * 0.0001;
        this.swayPhase3 = Math.random() * Math.PI * 2;
        this.swayAmp3 = 0.004 + Math.random() * 0.01;
        this.curveBend = (Math.random() - 0.5) * 0.12;
        this.curveBendTarget = this.curveBend;
        this.mouseAngleOffset = 0; this.mouseCurveOffset = 0;
        this.subFibers = [];
        // shorter sub-needles read as pointing at the viewer — keep them the MOST solid, not the least
        this.subFibers.push(new SubFiber(this.baseAngle, 0.65 + Math.random() * 0.2, this.maxLength, 0.85, 0.85, 0.8 + Math.random() * 1.0));
        this.subFibers.push(new SubFiber(this.baseAngle, 0.4 + Math.random() * 0.2, this.maxLength, 0.95, 0.9, 0.6 + Math.random() * 0.9));
        if (Math.random() > 0.3) {
          this.subFibers.push(new SubFiber(this.baseAngle, 0.18 + Math.random() * 0.17, this.maxLength, 1.0, 0.95, 0.5 + Math.random() * 0.7));
        }
      }
      update(dt, t) {
        const sway1 = Math.sin(t * this.swaySpeed + this.swayPhase) * this.swayAmp;
        const sway2 = Math.sin(t * this.swaySpeed2 + this.swayPhase2) * this.swayAmp * 0.6;
        const sway3 = Math.sin(t * this.swaySpeed3 + this.swayPhase3) * this.swayAmp3;
        this.angle = this.baseAngle + this.angleOffset + sway1 + sway2 + sway3;
        if (!this.isFading && Math.random() < this.fadeChance * dt) {
          this.isFading = true; this.fadeTarget = 0.35 + Math.random() * 0.2;
        } else if (this.isFading && this.opacity <= this.fadeTarget + 0.02) {
          this.isFading = false; this.fadeTarget = this.baseOpacity * (0.9 + Math.random() * 0.1);
        }
        this.opacity += (this.fadeTarget - this.opacity) * 0.015;
        this.curveBend += (this.curveBendTarget - this.curveBend) * 0.02;
        if (Math.random() < 0.002) { this.curveBendTarget = (Math.random() - 0.5) * 0.12; }
        for (const sub of this.subFibers) sub.update(t);
      }
      draw(ctx, cx, cy, t) {
        const alpha = this.opacity;
        const angle = this.angle;
        let tipX = cx + Math.cos(angle) * this.length * XSCALE;
        let tipY = cy + Math.sin(angle) * this.length * YSCALE;
        let tipOffsetX = 0, tipOffsetY = 0;
        if (mouseActive) {
          const dx = tipX - mouseX, dy = tipY - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const lenFactor = Math.max(this.length / 350, 0.4);
          const effectiveRadius = MOUSE_RADIUS * lenFactor + 72;
          if (dist < effectiveRadius && dist > 0.1) {
            const norm = dist / effectiveRadius;
            const force = Math.pow(1 - norm, 3) * MOUSE_STRENGTH;
            tipOffsetX = (dx / dist) * force * PUSH;
            tipOffsetY = (dy / dist) * force * PUSH;
          }
        }
        if (this.tipOffsetX === undefined) { this.tipOffsetX = 0; this.tipOffsetY = 0; this.tipVelX = 0; this.tipVelY = 0; }
        this.tipVelX = (this.tipVelX + (tipOffsetX - this.tipOffsetX) * SPRING_STIFF) * SPRING_DAMP; this.tipOffsetX += this.tipVelX;
        this.tipVelY = (this.tipVelY + (tipOffsetY - this.tipOffsetY) * SPRING_STIFF) * SPRING_DAMP; this.tipOffsetY += this.tipVelY;
        tipX += this.tipOffsetX; tipY += this.tipOffsetY;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = `rgba(${FIBER_RGB}, ${alpha})`;
        ctx.lineWidth = this.lineWidth; ctx.stroke();
        const dotPulse = 0.55 + 0.45 * Math.sin(t * this.dotPulseSpeed + this.dotPulsePhase);
        const currentDotR = this.maxDotRadius * dotPulse;
        ctx.beginPath(); ctx.arc(tipX, tipY, currentDotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${FIBER_RGB}, ${alpha})`; ctx.fill();
        for (const sub of this.subFibers) sub.draw(ctx, cx, cy, alpha, this.lineWidth, time);
      }
    }

    for (var i = 0; i < NUM_FIBERS; i++) fibers.push(new Fiber(i, NUM_FIBERS));

    function drawCentralGlow() {
      var cx = W / 2, cy = H;
      var base = [Math.round(activeRGB[0]), Math.round(activeRGB[1]), Math.round(activeRGB[2])];
      var core = lighten(base, 0.42);
      var g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 480);
      g1.addColorStop(0, rgbaStr(core, 0.18));
      g1.addColorStop(0.15, rgbaStr(base, 0.10));
      g1.addColorStop(0.4, rgbaStr(base, 0.05));
      g1.addColorStop(0.7, rgbaStr(base, 0.02));
      g1.addColorStop(1, rgbaStr(base, 0));
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160);
      g2.addColorStop(0, rgbaStr(lighten(base, 0.72), 0.22));
      g2.addColorStop(0.4, rgbaStr(core, 0.08));
      g2.addColorStop(1, rgbaStr(base, 0));
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    }

    function animate(now) {
      if (paused) return;
      var dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now; time += dt * 16.67 * TIME_SPEED;
      // ease the graphic colour toward the selected metric
      activeRGB[0] += (targetRGB[0] - activeRGB[0]) * 0.08;
      activeRGB[1] += (targetRGB[1] - activeRGB[1]) * 0.08;
      activeRGB[2] += (targetRGB[2] - activeRGB[2]) * 0.08;
      var ar = [Math.round(activeRGB[0]), Math.round(activeRGB[1]), Math.round(activeRGB[2])];
      FIBER_RGB = lighten(ar, 0.45).join(', ');   // light-tinted needles carry the hue
      ctx.clearRect(0, 0, W, H);
      drawCentralGlow();
      var cx = W / 2, cy = H + 5;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (var f = 0; f < fibers.length; f++) { fibers[f].update(dt, time); fibers[f].draw(ctx, cx, cy, time); }
      ctx.restore();
      var g3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 110);
      g3.addColorStop(0, rgbaStr(lighten(ar, 0.5), 0.12));
      g3.addColorStop(1, rgbaStr(ar, 0));
      ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);
      requestAnimationFrame(animate);
    }
    function setupMetrics() {
      var stats = document.getElementById('nb-stats');
      var slider = document.getElementById('nb-slider');
      if (!stats || !slider) { return setTimeout(setupMetrics, 60); }
      var cells = stats.querySelectorAll('.nb-metric');
      var nums = stats.querySelectorAll('.nb-num');
      function select(i) {
        var c = METRIC_COLORS[i];
        targetRGB = c.slice();                                  // graphic eases to this colour
        slider.style.transform = 'translateX(' + (i * 100) + '%)';
        slider.style.borderColor = rgbaStr(c, 0.6);
        slider.style.background = rgbaStr(c, 0.07);
        slider.style.boxShadow = '0 24px 60px -34px ' + rgbaStr(c, 0.6);
        for (var n = 0; n < nums.length; n++) nums[n].style.color = (n === i) ? '#fff' : 'rgba(255,255,255,.5)';
      }
      for (var k = 0; k < cells.length; k++) {
        (function (idx) { cells[idx].addEventListener('click', function () { select(idx); }); })(k);
      }
      select(0);
    }
    setupMetrics();

    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
