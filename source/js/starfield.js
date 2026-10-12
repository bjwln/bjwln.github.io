/**
 * 背景 canvas 特效
 * 夜间：250 颗星点持续右下飘动并闪烁（叠加在站点夜间背景图之上）
 * 日间：白云缓慢飘动 + 太阳（叠加在 CSS 提供的蓝天渐变之上）
 */
(function () {
  if (document.getElementById('starfield-canvas')) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'starfield-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var stars = [];
  var clouds = [];
  var lastTime = null;
  var rafId = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;
  var isLight = false;

  var STAR_COUNT = 250;
  var CLOUD_COUNT = 7;

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* ---------- 夜间：星点 ---------- */

  function createStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.3, 1.5),
        twinkle: rand(0.4, 1),
        phase: rand(0, Math.PI * 2),
        vx: rand(0.3, 0.9),
        vy: rand(0.1, 0.35)
      });
    }
  }

  function drawStars(time, dt) {
    for (var i = 0; i < stars.length; i++) {
      var star = stars[i];
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      if (star.x > W + 10) star.x = -10;
      if (star.x < -10) star.x = W + 10;
      if (star.y > H + 10) star.y = -10;
      if (star.y < -10) star.y = H + 10;

      var twinkle = 0.5 + 0.5 * Math.sin(0.002 * time + star.phase);
      var alpha = Math.min(1, Math.max(0.2, star.twinkle * twinkle));
      ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- 日间：云朵与太阳 ---------- */

  function makeCloud(initial) {
    var scale = rand(0.55, 1.35);
    var baseR = 24 * scale;
    var puffCount = 4 + Math.floor(Math.random() * 3);
    var puffs = [];

    for (var j = 0; j < puffCount; j++) {
      var mid = (puffCount - 1) / 2;
      var edge = Math.abs(j - mid) / mid;
      puffs.push({
        dx: (j - mid) * baseR * 0.9,
        dy: rand(-baseR * 0.2, baseR * 0.05) - (1 - edge) * baseR * 0.22,
        r: baseR * rand(0.62, 0.95) * (1 - edge * 0.28)
      });
    }

    return {
      x: initial ? Math.random() * (W + 200) - 100 : -baseR * 5,
      y: rand(H * 0.04, H * 0.42),
      vx: rand(0.1, 0.42),
      alpha: rand(0.55, 0.9),
      puffs: puffs,
      width: (puffCount - 1) * baseR * 0.9 + baseR * 2
    };
  }

  function createClouds() {
    clouds = [];
    for (var i = 0; i < CLOUD_COUNT; i++) {
      clouds.push(makeCloud(true));
    }
  }

  function drawCloud(cloud, dt) {
    cloud.x += cloud.vx * dt;

    if (cloud.x - cloud.width > W) {
      var fresh = makeCloud(false);
      cloud.y = fresh.y;
      cloud.vx = fresh.vx;
      cloud.alpha = fresh.alpha;
      cloud.puffs = fresh.puffs;
      cloud.width = fresh.width;
      cloud.x = fresh.x;
    }

    ctx.save();
    ctx.globalAlpha = cloud.alpha;

    for (var pass = 0; pass < 2; pass++) {
      // 第一遍：底部淡灰蓝阴影，第二遍：白色主体
      ctx.fillStyle = pass === 0 ? 'rgba(148, 179, 217, 0.4)' : 'rgba(255, 255, 255, 0.96)';
      for (var j = 0; j < cloud.puffs.length; j++) {
        var puff = cloud.puffs[j];
        ctx.beginPath();
        ctx.arc(
          cloud.x + puff.dx,
          cloud.y + puff.dy + (pass === 0 ? puff.r * 0.2 : 0),
          puff.r,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawSun(time) {
    var sunX = W * 0.82;
    var sunY = H * 0.16;
    var coreR = Math.max(24, Math.min(W, H) * 0.032);
    var breathe = 1 + 0.06 * Math.sin(time * 0.0011);
    var glowR = coreR * 3.4 * breathe;

    var glow = ctx.createRadialGradient(sunX, sunY, coreR * 0.2, sunX, sunY, glowR);
    glow.addColorStop(0, 'rgba(255, 243, 176, 0.85)');
    glow.addColorStop(0.35, 'rgba(255, 224, 110, 0.4)');
    glow.addColorStop(1, 'rgba(255, 224, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, glowR, 0, Math.PI * 2);
    ctx.fill();

    var core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, coreR);
    core.addColorStop(0, '#FFFCE8');
    core.addColorStop(0.5, '#FFEB8A');
    core.addColorStop(1, '#FFD54F');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, coreR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDay(time, dt) {
    drawSun(time);
    for (var i = 0; i < clouds.length; i++) {
      drawCloud(clouds[i], dt);
    }
  }

  /* ---------- 主题检测与主循环 ---------- */

  function detectTheme() {
    isLight = document.documentElement.getAttribute('data-theme') === 'light';
  }

  var themeObserver = new MutationObserver(detectTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  function frame(time) {
    var dt = lastTime ? Math.min((time - lastTime) / 16.7, 3) : 1;
    lastTime = time;

    ctx.clearRect(0, 0, W, H);
    if (isLight) {
      drawDay(time, dt);
    } else {
      drawStars(time, dt);
    }
    rafId = requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createStars();
    createClouds();
  }

  detectTheme();
  resize();
  window.addEventListener('resize', resize);
  rafId = requestAnimationFrame(frame);
})();
