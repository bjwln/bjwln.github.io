/**
 * 星空粒子背景（参数对齐 et001.com 的 start-bg-canvas）
 * 透明 canvas：250 颗星点持续右下飘动并闪烁
 * 叠加在站点背景图（#web_bg）之上、页面内容之下
 */
(function () {
  if (document.getElementById('starfield-canvas')) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'starfield-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var stars = [];
  var lastTime = null;
  var rafId = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;

  var STAR_COUNT = 250;

  function rand(min, max) { return min + Math.random() * (max - min); }

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

  function frame(time) {
    var dt = lastTime ? Math.min((time - lastTime) / 16.7, 3) : 1;
    lastTime = time;

    ctx.clearRect(0, 0, W, H);
    drawStars(time, dt);
    rafId = requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createStars();
  }

  resize();
  window.addEventListener('resize', resize);
  rafId = requestAnimationFrame(frame);
})();
