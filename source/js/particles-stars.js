// 荧光粒子效果 - 嵌套在 #web_bg 容器中
(function() {
  'use strict';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  const config = {
    count: 80,
    layers: [
      { size: 1, speed: 0.3, opacity: 0.5, color: '#aaccff' },
      { size: 1.5, speed: 0.4, opacity: 0.7, color: '#88aaff' },
      { size: 2, speed: 0.5, opacity: 0.9, color: '#aaddff' },
    ]
  };

  function resizeCanvas() {
    const webBg = document.getElementById('web_bg');
    if (webBg) {
      canvas.width = webBg.offsetWidth;
      canvas.height = webBg.offsetHeight;
    } else {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  class Particle {
    constructor() {
      this.layer = config.layers[Math.floor(Math.random() * config.layers.length)];
      this.reset();
    }

    reset() {
      const spawnSide = Math.random();
      if (spawnSide < 0.4) {
        this.x = -20 - Math.random() * 100;
        this.y = Math.random() * canvas.height;
      } else if (spawnSide < 0.8) {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20 + Math.random() * 50;
      } else {
        this.x = -20 - Math.random() * 100;
        this.y = canvas.height + 20 + Math.random() * 50;
      }
      this.size = this.layer.size + (Math.random() - 0.5) * 0.5;
      this.speedX = (Math.random() * 0.5 + 0.5) * this.layer.speed;
      this.speedY = -(Math.random() * 0.2 + 0.15) * this.layer.speed;
      this.opacity = this.layer.opacity * (0.8 + Math.random() * 0.2);
      this.decay = Math.random() * 0.0003 + 0.0001;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.opacity -= this.decay;

      if (this.x > canvas.width + 50 || this.y < -50 || this.opacity <= 0) {
        this.reset();
      }
    }

    draw() {
      ctx.save();

      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size * 4
      );
      gradient.addColorStop(0, this.layer.color);
      gradient.addColorStop(0.3, this.layer.color + 'aa');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = this.opacity * 0.5;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = this.opacity;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.layer.color;
      ctx.fillStyle = this.layer.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = this.opacity * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function init() {
    const webBg = document.getElementById('web_bg');
    if (!webBg) {
      console.log('web_bg 容器不存在');
      return;
    }

    resizeCanvas();
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;
    webBg.appendChild(canvas);

    particles = [];
    for (let i = 0; i < config.count; i++) {
      particles.push(new Particle());
    }

    animate();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resizeCanvas);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();