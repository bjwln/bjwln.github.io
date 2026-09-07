/**
 * 星空粒子背景（参数对齐 et001.com 的 start-bg-canvas）
 * 透明 canvas：星点持续右下飘动并闪烁，流星周期性斜向划过
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
  var meteors = [];
  var lastTime = null;
  var rafId = null;
  var meteorTimer = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;

  var STAR_COUNT = 250;
  var METEOR_COUNT = 4;
  var METEOR_INTERVAL = 5000;

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

  function spawnMeteors() {
    if (meteors.length < METEOR_COUNT) {
      var remaining = METEOR_COUNT - meteors.length;
      var count = Math.max(1, Math.floor(Math.random() * remaining) + 1);
      for (var i = 0; i < count; i++) {
        meteors.push({
          x: W * rand(-0.1, 1.1),
          y: H * rand(-0.3, 0.4),
          len: rand(120, 300),
          speed: rand(4, 10),
          alpha: 1,
          angle: rand(140, 160) * Math.PI / 180
        });
      }
    }

    var delay = METEOR_INTERVAL * (0.4 + Math.random()) + Math.random() * METEOR_INTERVAL * 0.2;
    meteorTimer = setTimeout(spawnMeteors, Math.max(400, delay));
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

  function drawMeteors() {
    var nextMeteors = [];
    for (var i = 0; i < meteors.length; i++) {
      var meteor = meteors[i];
      meteor.x += Math.cos(meteor.angle) * meteor.speed;
      meteor.y += Math.sin(meteor.angle) * meteor.speed;
      meteor.alpha -= 0.008;

      var tailX = meteor.x - Math.cos(meteor.angle) * meteor.len;
      var tailY = meteor.y - Math.sin(meteor.angle) * meteor.len;
      var alpha = Math.max(0, meteor.alpha);
      var gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, ' + (0.35 * alpha).toFixed(3) + ')');
      gradient.addColorStop(1, 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(meteor.x, meteor.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2);
      ctx.fill();

      if (meteor.alpha > 0 && meteor.x > -0.2 * W && meteor.y < 1.2 * H) {
        nextMeteors.push(meteor);
      }
    }
    meteors = nextMeteors;
  }

  function frame(time) {
    var dt = lastTime ? Math.min((time - lastTime) / 16.7, 3) : 1;
    lastTime = time;

    ctx.clearRect(0, 0, W, H);
    drawStars(time, dt);
    drawMeteors();
    rafId = requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createStars();
    meteors = [];
  }

  resize();
  window.addEventListener('resize', resize);
  spawnMeteors();
  rafId = requestAnimationFrame(frame);
})();
