/* ============================================================
   几猫港区 · Jimao Port —— 浏览器 FPS
   灵感致敬小红书 @7Hui「几猫」概念演示(复刻练习)
   Three.js r152 · 贴图与音效全部由代码实时生成 · 本地运行无联网
   ============================================================ */
import * as THREE from '/js/lib/three.module.min.js';

/* ---------- 小工具 ---------- */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

const stage = $('jm-stage');
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* ---------- 全局状态 ---------- */
const MISSION_TIME = 342; // 05:42
const phase = { cur: 'loading' };
const game = {
  elapsed: 0, remaining: MISSION_TIME,
  hp: 100, lastHurt: -99,
  mag: 30, reserve: 150,
  kills: 0, shots: 0, hits: 0,
  relaysDone: 0, extract: false, firstContact: false,
  introFired: [false, false, false, false], warn60: false, tipReload: false,
};
const DIFFS = {
  easy: { dmg: .55, rof: 1.35, vision: .8, regen: 10 },
  normal: { dmg: 1, rof: 1, vision: 1, regen: 6 },
  hard: { dmg: 1.5, rof: .72, vision: 1.18, regen: 3.5 },
};
let diff = DIFFS.normal;
const settings = Object.assign(
  { sens: 1, vol: 0.8, quality: IS_TOUCH ? 'low' : 'high', difficulty: 'normal' },
  JSON.parse(localStorage.getItem('jm-settings') || '{}')
);
const saveSettings = () => localStorage.setItem('jm-settings', JSON.stringify(settings));

/* ============================================================
   音频:全部由 WebAudio 程序化合成
   ============================================================ */
const AudioFX = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let ambNodes = null;
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = settings.vol * 0.9;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function noise({ f = 1000, type = 'bandpass', q = 1, peak = .5, dec = .1, when = 0, dur = .3 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + .005);
    g.gain.exponentialRampToValueAtTime(.001, t0 + dec);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + Math.max(dur, dec) + .05);
  }
  function tone({ f = 440, f2, dur = .12, type = 'sine', peak = .25, when = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + .008);
    g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .05);
  }
  return {
    init, resume,
    setVol(v) { if (master) master.gain.value = v * 0.9; },
    shot() {
      noise({ f: 760, q: .8, peak: .8, dec: .11 });
      noise({ f: 3400, type: 'highpass', peak: .3, dec: .05 });
      tone({ f: 120, f2: 44, dur: .1, type: 'triangle', peak: .5 });
      noise({ f: 430, type: 'lowpass', peak: .24, dec: .36, when: .02 }); // 湿区回响尾
    },
    shotPistol() {
      noise({ f: 1100, q: .8, peak: .62, dec: .05 });
      noise({ f: 3600, type: 'highpass', peak: .26, dec: .03 });
      tone({ f: 150, f2: 55, dur: .08, type: 'triangle', peak: .4 });
    },
    horn() {
      tone({ f: 116, f2: 96, dur: 1.6, type: 'sawtooth', peak: .2 });
      tone({ f: 174, f2: 142, dur: 1.6, type: 'sawtooth', peak: .1, when: .06 });
    },
    enemyShot(d) {
      const k = clamp(1 - d / 55, .12, 1);
      noise({ f: clamp(2400 - d * 30, 500, 2400), type: 'lowpass', peak: .5 * k, dec: .12 });
      tone({ f: 100, f2: 40, dur: .1, type: 'triangle', peak: .3 * k });
    },
    dry() { tone({ f: 1500, dur: .03, type: 'square', peak: .1 }); noise({ f: 2000, type: 'highpass', peak: .08, dec: .03 }); },
    reload() {
      noise({ f: 900, peak: .2, dec: .05, when: .15 });
      noise({ f: 650, peak: .22, dec: .07, when: .95 }); tone({ f: 260, f2: 130, dur: .08, type: 'square', peak: .1, when: .95 });
      noise({ f: 1200, peak: .25, dec: .07, when: 1.75 });
    },
    tick(kill) {
      tone({ f: 2200, f2: 1800, dur: .05, type: 'square', peak: .16 });
      if (kill) tone({ f: 660, f2: 260, dur: .14, type: 'sine', peak: .22, when: .03 });
    },
    hurt() { noise({ f: 300, type: 'lowpass', peak: .45, dec: .13 }); tone({ f: 90, f2: 55, dur: .16, type: 'triangle', peak: .3 }); },
    step() { noise({ f: rand(360, 460), type: 'lowpass', peak: .1, dec: .07 }); },
    zap() { noise({ f: 2600, q: 3, peak: .3, dec: .22 }); tone({ f: 1700, f2: 240, dur: .22, type: 'sawtooth', peak: .12 }); },
    objective() { tone({ f: 660, dur: .12, peak: .2 }); tone({ f: 880, dur: .16, peak: .2, when: .12 }); },
    ui() { tone({ f: 1050, dur: .04, type: 'square', peak: .08 }); },
    warn() { tone({ f: 880, dur: .1, type: 'square', peak: .14 }); tone({ f: 880, dur: .1, type: 'square', peak: .14, when: .18 }); },
    radio() { tone({ f: 1350, dur: .05, type: 'square', peak: .05 }); tone({ f: 1350, dur: .05, type: 'square', peak: .05, when: .08 }); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: .18, peak: .18, when: i * .14 })); },
    lose() { tone({ f: 220, f2: 90, dur: .7, type: 'sawtooth', peak: .2 }); },
    ambStart() {
      if (!ctx || ambNodes) return;
      const mk = (freq, type, g0) => {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = 0;
        g.gain.linearRampToValueAtTime(g0, ctx.currentTime + 1.6);
        src.connect(fl); fl.connect(g); g.connect(master); src.start();
        return { src, g };
      };
      ambNodes = [mk(260, 'lowpass', .05), mk(1500, 'highpass', .075)];
    },
    ambStop() {
      if (!ambNodes) return;
      ambNodes.forEach(n => { try { n.g.gain.linearRampToValueAtTime(0, ctx.currentTime + .4); n.src.stop(ctx.currentTime + .5); } catch (e) { } });
      ambNodes = null;
    },
  };
})();

/* ============================================================
   渲染器 / 场景
   ============================================================ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  $('jm-webgl-err').hidden = false;
  $('jm-loading').hidden = true;
  throw e;
}
renderer.domElement.classList.add('jm-canvas');
stage.insertBefore(renderer.domElement, stage.firstChild);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x131720, 0.0058);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 800);
camera.rotation.order = 'YXZ';
scene.add(camera);

const sunDir = new THREE.Vector3(0.22, 0.14, -0.96).normalize();

/* 天空穹 */
{
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: { value: sunDir.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun;
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 col = mix(vec3(0.135,0.10,0.082), vec3(0.024,0.032,0.058), smoothstep(0.0,0.42,h));
        col = mix(col, vec3(0.30,0.18,0.10), exp(-abs(h)*11.0)*0.5);
        float s = max(dot(vDir,uSun),0.0);
        col += vec3(1.0,0.52,0.22)*(pow(s,32.0)*1.0 + pow(s,7.0)*0.2);
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), skyMat));
}

/* 灯光 */
scene.add(new THREE.HemisphereLight(0x54648c, 0x2c251c, 1.15));
const sun = new THREE.DirectionalLight(0xffab68, 2.4);
sun.position.copy(sunDir).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun); scene.add(sun.target);

/* 太阳光斑(加色精灵,不受雾) */
function makeGlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glowTex = makeGlowTex();
{
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: .9 }));
  sunSpr.scale.set(78, 78, 1);
  sunSpr.position.copy(sunDir).multiplyScalar(430);
  scene.add(sunSpr);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  core.scale.set(26, 26, 1);
  core.position.copy(sunDir).multiplyScalar(428);
  scene.add(core);
}

/* ============================================================
   程序化贴图
   ============================================================ */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
/* 集装箱波纹板(灰度,实例颜色染色;带品牌 stencil 印刷) */
function texContainer() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, 0, 6, h);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 9, 0, 3, h);
    }
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 14, w, 14);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h / 2 - 3, w, 6);
    // 门缝竖线
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(3, 26, 3, h - 52); g.fillRect(w - 7, 26, 3, h - 52);
    // stencil 印刷:中文品牌大字 + 航线名 + 箱号(染色后呈深色,各色箱体通用)
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.font = '900 46px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('几猫航运', 16, 148);
    g.font = '700 17px "Arial Narrow", Impact, sans-serif';
    g.fillText('JIMAO SHIPPING LINE', 16, 184);
    g.textAlign = 'right';
    g.font = '600 15px Consolas, monospace';
    g.fillStyle = 'rgba(0,0,0,.44)';
    g.fillText('JMAU ' + (300000 + Math.floor(Math.random() * 999999)), w - 14, h - 28);
    // 掉漆磨损
    for (let i = 0; i < 46; i++) {
      g.fillStyle = `rgba(22,18,14,${rand(.04, .14)})`;
      g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(6, 30), rand(4, 16), rand(0, 3), 0, 7); g.fill();
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(rand(0, w - 40), rand(20, h - 40), rand(18, 42), 3); }
  });
}
function texAsphalt() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#17191d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.28)';
      g.fillRect(rand(0, w), rand(0, h), rand(1, 2.6), rand(1, 2.6));
    }
    g.strokeStyle = 'rgba(0,0,0,.3)';
    for (let i = 0; i < 5; i++) {
      g.beginPath(); let x = rand(0, w), y = rand(0, h); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
  }, [24, 18]);
}
function texRib() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9ba1a6'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 14) {
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, 0, 4, h);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 6, 0, 3, h);
    }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(40,38,34,${rand(.05, .16)})`; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(10, 40), rand(8, 22), 0, 0, 7); g.fill(); }
  }, [6, 2]);
}
function texFence() {
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,158,166,.9)'; g.lineWidth = 2;
    for (let i = -h; i < w; i += 13) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
  }, [30, 2]);
}
function texStar() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.5, 'rgba(255,180,90,.5)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
  g.fillStyle = 'rgba(255,230,180,.95)';
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -3); g.lineTo(26, 0); g.lineTo(0, 3); g.fill(); }
  return new THREE.CanvasTexture(c);
}
function texRing() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,90,50,.95)'; g.lineWidth = 5;
  g.beginPath(); g.arc(32, 32, 22, 0, 7); g.stroke();
  g.fillStyle = 'rgba(255,90,50,.95)'; g.beginPath(); g.arc(32, 32, 4.5, 0, 7); g.fill();
  return new THREE.CanvasTexture(c);
}
function texLabel(text, color) {
  return canvasTex(256, 80, (g, w, h) => {
    g.fillStyle = 'rgba(8,12,18,.75)';
    g.beginPath(); g.roundRect ? g.roundRect(2, 2, w - 4, h - 4, 12) : g.rect(2, 2, w - 4, h - 4); g.fill();
    g.strokeStyle = color; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#e8ecf0'; g.font = '600 30px "PingFang SC","Microsoft YaHei",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
function texWindows() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#141821'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 18) for (let x = 10; x < w - 10; x += 20) {
      g.fillStyle = Math.random() < .72 ? 'rgba(255,214,150,.92)' : 'rgba(60,66,78,.9)';
      g.fillRect(x, y, 11, 8);
    }
  });
}
/* 湿地面:roughness/metalness 共享斑点的成对贴图(拉丝 + 洼陷光泽) */
function texWetPair() {
  const spots = [];
  for (let i = 0; i < 30; i++) spots.push({ x: rand(0, 512), y: rand(0, 512), rx: rand(14, 44), ry: rand(5, 14), rot: rand(0, 3.2), v: Math.floor(rand(130, 200)) });
  const mk = kind => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = kind === 'rough' ? '#e2e2e2' : '#000';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 10; i++) {
      const y = rand(0, 512), hh = rand(4, 14);
      g.fillStyle = kind === 'rough' ? 'rgba(150,150,150,.2)' : 'rgba(50,50,50,.3)';
      g.fillRect(0, y, 512, hh);
    }
    for (const s of spots) {
      const v = kind === 'rough' ? s.v : Math.min(255, s.v + 25);
      g.save(); g.translate(s.x, s.y); g.rotate(s.rot); g.scale(1, s.ry / s.rx);
      g.fillStyle = `rgba(${v},${v},${v},.45)`;
      g.beginPath(); g.arc(0, 0, s.rx, 0, 7); g.fill(); g.restore();
    }
    for (let i = 0; i < 900; i++) {
      const v = Math.floor(rand(150, 245));
      g.fillStyle = kind === 'rough' ? `rgba(${v},${v},${v},.25)` : 'rgba(0,0,0,.2)';
      g.fillRect(rand(0, 512), rand(0, 512), 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(24, 18);
    return t;
  };
  return { rough: mk('rough'), metal: mk('metal') };
}

/* ============================================================
   世界
   ============================================================ */
const worldGroup = new THREE.Group(); scene.add(worldGroup);
const occluders = [];   // 敌人视线遮挡体
const colliders = [];   // {x0,x1,z0,z1} 圆柱碰撞盒(XZ 平面)
const palette = ['#8a4a32', '#3e5a70', '#33564e', '#a06b35', '#5a5e63', '#6e3b3b'];
let groundMesh = null, seaMesh = null;
const puddleMeshes = [];

/* ---------- 平面反射:一面镜像相机 + 低分辨率 RT,水洼/海面共享 ---------- */
let reflRT = null, mirrorCam = null, reflEnabled = false, reflFrame = 0;
let reflMatPuddle = null, reflMatSea = null, puddleFallbackMat = null, seaFallbackMat = null;
const BIAS_M = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
const _reflM = new THREE.Matrix4(), _dirR = new THREE.Vector3(), _tgtR = new THREE.Vector3();

const REFL_VERT = `
  uniform mat4 uReflMat;
  varying vec4 vRefl;
  varying vec3 vWorld;
  varying vec2 vUvC;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vRefl = uReflMat * wp;
    vUvC = uv;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const REFL_FRAG = `
  uniform sampler2D tRefl;
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uRain;
  uniform vec3 uCam;
  uniform float uRipple;
  uniform float uEdge;
  uniform float uReflK;
  uniform float uWaves;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec4 vRefl;
  varying vec3 vWorld;
  varying vec2 vUvC;
  void main() {
    vec2 uv = vRefl.xy / max(vRefl.w, 0.0001);
    float w1 = sin(uTime * 2.3 + vWorld.x * 3.1 + vWorld.z * 1.7);
    float w2 = cos(uTime * 3.4 + vWorld.z * 4.3 - vWorld.x * 1.3);
    uv += vec2(w1, w2) * (0.0022 + uRain * 0.0032) * uRipple;
    vec3 refl = texture2D(tRefl, uv).rgb;
    float dCam = distance(uCam.xz, vWorld.xz);
    float nearF = smoothstep(70.0, 6.0, dCam);
    vec3 col = mix(uTint, refl, uReflK * nearF);
    // 波浪明暗调制:把倒影切成流动的水纹
    float wave = 0.55 + 0.45 * sin(vWorld.z * 2.2 + uTime * 1.6) * sin(vWorld.z * 3.7 - uTime * 1.1 + vWorld.x * .6);
    col *= mix(1.0, wave, uWaves);
    float sparkle = pow(max(w1 * w2, 0.0), 30.0) * uRain;
    col += vec3(1.0, 0.88, 0.72) * sparkle * 0.55;
    float fogDepth = distance(uCam, vWorld);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * fogDepth * fogDepth);
    col = mix(col, uFogColor, fogF);
    float a = 1.0;
    if (uEdge > 0.5) {
      float r = length(vUvC - 0.5) * 2.0;
      a = 1.0 - smoothstep(0.72, 1.0, r);
    }
    gl_FragColor = vec4(col, a);
  }`;

function makeReflMat(tint, ripple, edgeFade, reflK, waves) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tRefl: { value: null },
      uReflMat: { value: new THREE.Matrix4() },
      uTint: { value: new THREE.Color(tint) },
      uTime: { value: 0 },
      uRain: { value: 1 },
      uCam: { value: new THREE.Vector3() },
      uRipple: { value: ripple },
      uEdge: { value: edgeFade ? 1 : 0 },
      uReflK: { value: reflK },
      uWaves: { value: waves },
      uFogColor: { value: new THREE.Color(0x10131c) },
      uFogDensity: { value: 0.0058 },
    },
    vertexShader: REFL_VERT,
    fragmentShader: REFL_FRAG,
    transparent: true, depthWrite: false,
  });
}

function buildReflector() {
  reflRT = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: true });
  reflRT.texture.colorSpace = THREE.SRGBColorSpace;
  mirrorCam = new THREE.PerspectiveCamera(75, 1, 0.1, 700);
  reflMatPuddle = makeReflMat(0x0a1018, 1.0, true, .9, .3);
  reflMatSea = makeReflMat(0x0a1420, 2.6, false, .5, 1.0);
  reflMatSea.uniforms.uFogDensity.value = 0.0085; // 海面雾更浓,远处沉入夜色
  reflMatPuddle.uniforms.tRefl.value = reflRT.texture;
  reflMatSea.uniforms.tRefl.value = reflRT.texture;
  puddleFallbackMat = new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: .06, metalness: .75 });
  seaFallbackMat = new THREE.MeshStandardMaterial({ color: 0x0a0d13, roughness: .08, metalness: .85 });
}

function updateReflector() {
  if (!reflEnabled || !reflRT) return;
  reflFrame++;
  const cad = settings.quality === 'high' ? 2 : 3; // 倒影 15-30fps 足够,省一半渲染
  if (reflFrame % cad) return;
  // 隐藏反射面自身与雨,避免自反射与穿帮
  const hidden = [];
  if (groundMesh && groundMesh.visible) { groundMesh.visible = false; hidden.push(groundMesh); }
  if (seaMesh && seaMesh.visible) { seaMesh.visible = false; hidden.push(seaMesh); }
  for (const m of puddleMeshes) if (m.visible) { m.visible = false; hidden.push(m); }
  const rainWas = rainLayers.map(l => l.lines.visible);
  rainLayers.forEach(l => { l.lines.visible = false; });
  // 镜像相机:位置/注视点关于地面(y=0)镜像
  camera.getWorldDirection(_dirR);
  _tgtR.copy(camera.position).add(_dirR);
  mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
  _tgtR.y = -_tgtR.y;
  mirrorCam.up.set(0, 1, 0);
  mirrorCam.lookAt(_tgtR);
  mirrorCam.fov = camera.fov;
  mirrorCam.aspect = camera.aspect;
  mirrorCam.near = camera.near; mirrorCam.far = camera.far;
  mirrorCam.updateProjectionMatrix();
  mirrorCam.updateMatrixWorld();
  // 世界空间投影矩阵:clip = bias * P * V
  _reflM.copy(BIAS_M).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
  const t = nowSec;
  for (const m of [reflMatPuddle, reflMatSea]) {
    m.uniforms.uReflMat.value.copy(_reflM);
    m.uniforms.uTime.value = t;
    m.uniforms.uCam.value.copy(camera.position);
  }
  const prevRT = renderer.getRenderTarget();
  renderer.setRenderTarget(reflRT);
  renderer.render(scene, mirrorCam);
  renderer.setRenderTarget(prevRT);
  hidden.forEach(m => { m.visible = true; });
  rainLayers.forEach((l, i) => { l.lines.visible = rainWas[i]; });
}

function addCollider(x, z, hx, hz) { colliders.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz }); }
function solidBox(w, h, d, mat, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false; m.receiveShadow = true;
  worldGroup.add(m);
  if (opts.occ) occluders.push(m);
  return m;
}

let matContainer, matConcrete, matWood, matDark, matSteel, matYellow;

function buildGround() {
  const wet = texWetPair();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 174),
    new THREE.MeshStandardMaterial({
      map: texAsphalt(), roughnessMap: wet.rough, metalnessMap: wet.metal,
      roughness: 1, metalness: 1, color: 0xdde3e8,
    })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -7);
  ground.receiveShadow = true;
  worldGroup.add(ground);
  occluders.push(ground);
  groundMesh = ground;

  /* 水面(平面反射 shader,倒映龙门吊/货轮/灯火) */
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 160), reflMatSea);
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.22, -164);
  worldGroup.add(water);
  seaMesh = water;

  /* 码头边缘 */
  solidBox(240, 1.3, 2.2, matConcrete, 0, 0.42, -83.4);

  /* 主路标线 */
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xa58f3f, roughness: 1 });
  const dashGeo = new THREE.PlaneGeometry(3, .3);
  for (let x = -74; x <= 74; x += 8) {
    const d = new THREE.Mesh(dashGeo, lineMat);
    d.rotation.x = -Math.PI / 2; d.position.set(x, .02, 52);
    worldGroup.add(d);
  }
  const edgeGeo = new THREE.PlaneGeometry(150, .26);
  [48.4, 55.6].forEach(z => {
    const e = new THREE.Mesh(edgeGeo, lineMat);
    e.rotation.x = -Math.PI / 2; e.position.set(-6, .02, z);
    worldGroup.add(e);
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a3, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(.8, 6.4), whiteMat);
    bar.rotation.x = -Math.PI / 2; bar.position.set(-60.4 + i * 1.7, .025, 52);
    worldGroup.add(bar);
  }
}

/* 堆场集装箱 */
let containerIM;
function buildContainers() {
  // 横排:[x, z, len, levels, colorIdx];纵列(rot90°):[x, z, 0, len, levels, colorIdx]
  const defs = [
    // 堆场横排
    [-56, -24, 12, 2, 0], [-42, -24, 6, 1, 1], [-34, -24, 6, 2, 3], [-16, -24, 12, 1, 2],
    [-58, -12, 6, 3, 1], [-48, -12, 12, 2, 4], [-32, -12, 6, 1, 0], [-22, -12, 6, 2, 5],
    [-54, 0, 6, 1, 3], [-44, 0, 6, 2, 0], [-28, 0, 6, 3, 2], [-14, 0, 12, 1, 1],
    [-56, 10, 12, 2, 5], [-40, 10, 6, 1, 2], [-30, 10, 6, 3, 4], [-16, 10, 6, 2, 0],
    [-50, 20, 6, 1, 1], [-38, 20, 12, 2, 3], [-20, 20, 6, 1, 5],
    // 堆场纵列
    [-8, -18, 0, 6, 2, 4], [-8, 2, 0, 12, 2, 0], [-64, -14, 0, 6, 1, 2], [-66, 12, 0, 6, 2, 5],
    // 码头沿线
    [-34, -64, 12, 1, 1], [-20, -64, 6, 2, 4], [8, -58, 0, 6, 1, 3],
    [24, -62, 6, 1, 0], [36, -64, 12, 2, 2], [52, -62, 6, 1, 5],
    // 仓库周边 / 散置
    [30, -30, 0, 6, 1, 3], [58, 2, 0, 6, 1, 1], [-46, 40, 6, 1, 2], [-13, 34, 6, 1, 4],
    // 二期加料:补足层次
    [-4, 44, 6, 1, 5], [-70, 36, 6, 1, 1], [12, 30, 6, 1, 2], [20, 36, 12, 1, 3],
    [-2, -36, 12, 2, 4], [14, -40, 6, 1, 1], [44, -30, 6, 2, 0], [56, -24, 12, 1, 4],
    [-24, -46, 6, 1, 2], [60, -46, 6, 1, 3], [16, -44, 0, 6, 1, 5], [68, -10, 0, 6, 1, 2],
  ];
  let count = 0;
  defs.forEach(d => { count += d.length === 5 ? d[3] : d[4]; });
  containerIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matContainer, count);
  containerIM.castShadow = containerIM.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const e = new THREE.Euler(), col = new THREE.Color();
  let i = 0;
  defs.forEach(d => {
    let x, z, len, lv, ci, rotY;
    if (d.length === 5) { x = d[0]; z = d[1]; len = d[2]; lv = d[3]; ci = d[4]; rotY = 0; }
    else { x = d[0]; z = d[1]; len = d[3]; lv = d[4]; ci = d[5]; rotY = Math.PI / 2; }
    const hx = rotY === 0 ? len / 2 : 1.32;
    const hz = rotY === 0 ? 1.32 : len / 2;
    addCollider(x, z, hx, hz);
    e.set(0, rotY, 0);
    for (let k = 0; k < lv; k++) {
      p.set(x, 1.31 + 2.62 * k, z);
      q.setFromEuler(e);
      s.set(len, 2.6, 2.6);
      m4.compose(p, q, s);
      containerIM.setMatrixAt(i, m4);
      col.set(palette[ci]).multiplyScalar(rand(1.02, 1.32));
      containerIM.setColorAt(i, col);
      i++;
    }
  });
  containerIM.count = i;
  containerIM.instanceMatrix.needsUpdate = true;
  if (containerIM.instanceColor) containerIM.instanceColor.needsUpdate = true;
  worldGroup.add(containerIM);
  occluders.push(containerIM);
}

/* 仓库 */
function buildWarehouse() {
  const wallMat = new THREE.MeshStandardMaterial({ map: texRib(), roughness: .8, metalness: .1, color: 0xcfd4d8 });
  const wh = new THREE.Group();
  // 北墙 / 南墙(z=-24 / -8),x 28..64
  const n = new THREE.Mesh(new THREE.BoxGeometry(36, 12, .6), wallMat); n.position.set(46, 6, -24.3);
  const s = new THREE.Mesh(new THREE.BoxGeometry(36, 12, .6), wallMat); s.position.set(46, 6, -7.7);
  const e = new THREE.Mesh(new THREE.BoxGeometry(.6, 12, 16), wallMat); e.position.set(64.3, 6, -16);
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(.6, 12, 6), wallMat); w1.position.set(27.7, 6, -21);
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(.6, 12, 4), wallMat); w2.position.set(27.7, 6, -10);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(.6, 7.5, 6), wallMat); lintel.position.set(27.7, 8.25, -15);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(37, .5, 17), matDark); roof.position.set(46, 12.2, -16);
  [n, s, e, w1, w2, lintel, roof].forEach(m => { m.castShadow = m.receiveShadow = true; wh.add(m); occluders.push(m); });
  // 内部地坪
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(35.6, 15.4), new THREE.MeshStandardMaterial({ color: 0x3d4046, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(46, .02, -16); floor.receiveShadow = true;
  wh.add(floor);
  // 卷帘门装饰(南墙)
  const door = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, .2), new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: .6, metalness: .4 }));
  door.position.set(40, 2.85, -7.55); wh.add(door);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLabel('几猫港务 · 4号库', '#ffb877'), transparent: true, fog: false }));
  sign.scale.set(7, 2.2, 1); sign.position.set(40, 7.2, -7.4); wh.add(sign);
  worldGroup.add(wh);
  addCollider(46, -24.3, 18.3, .9); addCollider(46, -7.7, 18.3, .9);
  addCollider(64.3, -16, .9, 8.3);
  addCollider(27.7, -21, .9, 3.3); addCollider(27.7, -10, .9, 2.3);
  // 内部料箱
  [[36, -21, 2], [56, -10, 1], [35, -11, 1], [58, -20, 2]].forEach(([x, z, lv]) => {
    for (let k = 0; k < lv; k++) solidBox(1.5, 1.5, 1.5, matWood, x + rand(-.1, .1), .78 + 1.52 * k, z, { occ: k === 0 });
    addCollider(x, z, .85, .85);
  });
  // 内部吊灯
  [[40, -16], [54, -16]].forEach(([x, z]) => {
    const pl = new THREE.PointLight(0xffd2a0, 20, 26, 2); pl.position.set(x, 8.6, z); scene.add(pl);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 }));
    glow.scale.set(1.6, 1.6, 1); glow.position.set(x, 8.4, z); scene.add(glow);
  });
}

/* 龙门吊 */
function buildCrane(cx, cz) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x323844, roughness: .7, metalness: .35 });
  const legGeo = new THREE.BoxGeometry(1.2, 19, 1.2);
  [[-4, 11], [4, 11], [-4, -11], [4, -11]].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(cx + dx, 9.5, cz + dz); leg.castShadow = true;
    g.add(leg); occluders.push(leg);
    addCollider(cx + dx, cz + dz, .8, .8);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 30), legMat);
  beam.position.set(cx, 19.6, cz); beam.castShadow = true; g.add(beam);
  const house = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 4.4), legMat);
  house.position.set(cx, 21.1, cz + 9); g.add(house);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 12), legMat);
  boom.position.set(cx, 20.2, cz - 19.5); boom.rotation.x = -.1; g.add(boom);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.8), matSteel);
  trolley.position.set(cx, 18.4, cz - 1); g.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 13, 6), matDark);
  cable.position.set(cx, 11.9, cz - 1); g.add(cable);
  const spreader = new THREE.Mesh(new THREE.BoxGeometry(2.6, .3, .4), matYellow);
  spreader.position.set(cx, 5.2, cz - 1); g.add(spreader);
  const hangC = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.6), matContainer);
  hangC.position.set(cx, 3.7, cz - 1); hangC.castShadow = true; g.add(hangC);
  const warn = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff4040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8, fog: false }));
  warn.scale.set(2.4, 2.4, 1); warn.position.set(cx, 22.8, cz + 9); g.add(warn);
  worldGroup.add(g);
}

/* 货轮 */
let navLight;
function buildShip() {
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: .6, metalness: .3 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(58, 7, 15), hullMat);
  hull.position.set(2, 4, -97); hull.castShadow = true;
  worldGroup.add(hull); occluders.push(hull); addCollider(2, -97, 29, 7.5);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(58.6, .9, 15.6), new THREE.MeshStandardMaterial({ color: 0x5e2f23, roughness: .8 }));
  stripe.position.set(2, 1.1, -97); worldGroup.add(stripe);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x30353d, roughness: .9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(57, .4, 14.4), deckMat);
  deck.position.set(2, 7.6, -97); worldGroup.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 12), new THREE.MeshStandardMaterial({ map: texWindows(), emissive: 0xffd9a0, emissiveMap: texWindows(), emissiveIntensity: 1.5, roughness: .7, color: 0x2a2f38 }));
  bridge.position.set(20, 12.1, -100); bridge.castShadow = true;
  worldGroup.add(bridge); occluders.push(bridge);
  // 甲板集装箱
  [[-14, 8.8, -99, 0], [-14, 11.4, -99, 1], [2, 8.8, -99, 2], [2, 8.8, -95, 4], [18, 8.8, -97, 3], [-4, 8.8, -97, 5]].forEach(([x, y, z, ci]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), matContainer);
    c.position.set(x, y, z); c.castShadow = true; worldGroup.add(c);
  });
  navLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff4040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  navLight.scale.set(3, 3, 1); navLight.position.set(20, 17.4, -100);
  scene.add(navLight);
  // 登船舷梯
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.2, .14, 7.4), matSteel);
  ramp.position.set(10, .35, -86.6); ramp.rotation.x = .16;
  worldGroup.add(ramp);
}

/* 路灯 / 火桶 / 杂物 */
const lampLights = [];
function buildProps() {
  const poleMat = matSteel;
  function lamp(x, z, dir, lit) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 7.4, 8), poleMat);
    pole.position.set(x, 3.7, z); pole.castShadow = true; worldGroup.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, 1.7), poleMat);
    arm.position.set(x, 7.2, z + dir * .8); worldGroup.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.36, .14, .7), new THREE.MeshStandardMaterial({ color: 0x2a2e36, emissive: 0xffd9a8, emissiveIntensity: lit ? .9 : .25 }));
    head.position.set(x, 7.1, z + dir * 1.55); worldGroup.add(head);
    if (lit) {
      const pl = new THREE.PointLight(0xffd9a0, 16, 26, 2);
      pl.position.set(x, 6.9, z + dir * 1.55);
      scene.add(pl); lampLights.push(pl);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: lit ? .85 : .3 }));
    glow.scale.set(2.8, 2.8, 1); glow.position.set(x, 6.9, z + dir * 1.55); scene.add(glow);
    addCollider(x, z, .3, .3);
  }
  // lit=1 才挂真实点光源(前向渲染每盏灯都是逐像素开销),其余只留自发光灯头+光晕
  [[-52, 58.5, -1, 1], [-20, 58.5, -1, 1], [12, 58.5, -1, 1], [44, 58.5, -1, 1], [-40, -79, 1, 1], [-8, -79, 1, 1], [24, -79, 1, 1]].forEach(a => lamp(...a));

  function fireBarrel(x, z) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.4, .42, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: .8 }));
    b.position.set(x, .55, z); b.castShadow = true; worldGroup.add(b);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8c30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flame.scale.set(1.5, 2, 1); flame.position.set(x, 1.6, z); scene.add(flame);
    const pl = new THREE.PointLight(0xff8c40, 18, 16, 2); pl.position.set(x, 1.8, z);
    scene.add(pl); lampLights.push(pl);
    fireFlames.push({ flame, pl, x, z });
    addCollider(x, z, .5, .5);
  }
  fireBarrel(-44, 26); fireBarrel(18, -76);

  // 岗亭 & 拦车杆 & 锥桶
  const booth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.7, 2.6), new THREE.MeshStandardMaterial({ color: 0x8f979e, roughness: .7 }));
  booth.position.set(-6, 1.35, 58); booth.castShadow = true;
  worldGroup.add(booth); occluders.push(booth); addCollider(-6, 58, 1.4, 1.4);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, .1), new THREE.MeshStandardMaterial({ color: 0x1c2128, emissive: 0xffe9b8, emissiveIntensity: .5, roughness: .3 }));
  win.position.set(-6, 1.6, 56.66); worldGroup.add(win);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, 4.6), new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: .6 }));
  bar.position.set(-2.6, 1.1, 52.6); bar.rotation.z = -.42; worldGroup.add(bar);
  [[-10, 49], [-12, 53.5], [-8.5, 55]].forEach(([x, z]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.28, .7, 10), new THREE.MeshStandardMaterial({ color: 0xd8642c, roughness: .7 }));
    cone.position.set(x, .35, z); cone.castShadow = true; worldGroup.add(cone);
  });

  // 叉车
  {
    const fl = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.9), new THREE.MeshStandardMaterial({ color: 0xc7902e, roughness: .6 }));
    body.position.y = .78; body.castShadow = true; fl.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.05, .8, 1.1), matDark);
    cab.position.set(0, 1.6, -.25); fl.add(cab);
    const mast1 = new THREE.Mesh(new THREE.BoxGeometry(.1, 2.5, .12), matSteel); mast1.position.set(-.42, 1.35, 1.05);
    const mast2 = mast1.clone(); mast2.position.x = .42;
    fl.add(mast1, mast2);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(.9, .06, .7), matSteel);
    fork.position.set(0, .3, 1.6); fl.add(fork);
    [[-.6, .8], [.6, .8], [-.6, -.7], [.6, -.7]].forEach(([x, z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .2, 10), matDark);
      w.rotation.z = Math.PI / 2; w.position.set(x, .3, z); fl.add(w);
    });
    fl.position.set(-34, 0, 38); fl.rotation.y = .7;
    worldGroup.add(fl); addCollider(-34, 38, .9, 1.1);
  }

  // 护栏墩 & 泊位系船柱
  for (let x = -44; x <= 70; x += 14) {
    const jb = new THREE.Mesh(new THREE.BoxGeometry(2.4, .85, .5), new THREE.MeshStandardMaterial({ color: 0x9aa0a3, roughness: .9 }));
    jb.position.set(x, .43, 44.2); jb.castShadow = true; worldGroup.add(jb);
    addCollider(x, 44.2, 1.3, .35);
  }
  [-44, -32, -4, 20, 32, 44].forEach(x => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.32, .38, .55, 10), matDark);
    b.position.set(x, .28, -81.5); b.castShadow = true; worldGroup.add(b);
    addCollider(x, -81.5, .38, .38);
  });

  // 水洼(平面反射,倒映实景)
  [[-52, 44, 3.2], [-20, 50, 2.4], [8, 46, 3.6], [-36, 8, 2.8], [-8, -14, 3], [30, -70, 3.4], [-46, -72, 2.6], [44, 4, 2.2],
   [-26, -18, 2.2], [-52, -18, 2.4], [-14, 15, 2], [-60, -2, 2.6], [2, -6, 2.2], [12, -36, 2.4]].forEach(([x, z, r]) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), reflMatPuddle);
    p.rotation.x = -Math.PI / 2; p.position.set(x, .021, z);
    p.renderOrder = 1;
    worldGroup.add(p);
    puddleMeshes.push(p);
  });

  // 铁丝网围栏(南 / 西 / 东)
  const fenceMat = new THREE.MeshBasicMaterial({ map: texFence(), transparent: true, alphaTest: .4, side: THREE.DoubleSide, color: 0x8a929a });
  function fenceRun(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), fenceMat);
    f.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2);
    f.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    worldGroup.add(f);
    const n = Math.round(len / 8);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.8, 6), matDark);
      post.position.set(lerp(x0, x1, t), 1.4, lerp(z0, z1, t));
      worldGroup.add(post);
    }
  }
  fenceRun(-77, 66, 77, 66);
  fenceRun(-77, -58, -77, 66);
  fenceRun(77, -58, 77, 66);
}
const fireFlames = [];

/* 场景杂物:托盘 / 轮胎堆 / 电缆盘 */
function buildClutter() {
  const palletMat = new THREE.MeshStandardMaterial({ color: 0x5e5142, roughness: .9 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: .95 });
  [[-44, 2], [-26, -18], [-10, 28], [6, 20], [20, -50], [-2, -40]].forEach(([x, z]) => {
    const n = 2 + (Math.random() * 2 | 0);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, .13, 1.3), palletMat);
      m.position.set(x + rand(-.06, .06), .08 + k * .14, z + rand(-.06, .06));
      m.rotation.y = rand(0, 3); m.castShadow = true;
      worldGroup.add(m);
    }
  });
  [[-62, 30], [-4, -30], [34, 30]].forEach(([x, z]) => {
    for (let k = 0; k < 3; k++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(.5, .2, 8, 16), tireMat);
      t.rotation.x = Math.PI / 2; t.position.set(x + rand(-.1, .1), .22 + k * .4, z);
      t.castShadow = true; worldGroup.add(t);
    }
  });
  [[-14, 40], [52, -8]].forEach(([x, z]) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .35, 14), matDark);
    r.rotation.z = Math.PI / 2; r.rotation.y = rand(0, 3);
    r.position.set(x, .72, z); r.castShadow = true;
    worldGroup.add(r);
  });
}

/* 地面雾气体积感:缓慢漂移的低空雾片 */
const mistSprites = [];
function buildMist() {
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x46536e, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: .05 + Math.random() * .04,
    }));
    m.scale.set(rand(22, 34), rand(7, 12), 1);
    m.position.set(rand(-70, 60), rand(1.2, 3.2), rand(-78, 60));
    scene.add(m);
    mistSprites.push({ m, seed: rand(0, 9), spd: rand(.15, .35) });
  }
}
function updateMist(dt) {
  for (const ms of mistSprites) {
    ms.m.position.x += Math.sin(nowSec * .12 + ms.seed) * ms.spd * dt;
    ms.m.position.z += Math.cos(nowSec * .09 + ms.seed * 1.7) * ms.spd * dt;
    ms.m.material.opacity = .05 + Math.sin(nowSec * .2 + ms.seed) * .018;
  }
}

/* 中继装置 */
const relays = [];
function buildRelays() {
  const defs = [
    { x: -36, z: -6, label: '堆场中继' },
    { x: 46, z: -14, label: '仓库中继' },
    { x: -16, z: -70, label: '码头中继' },
  ];
  defs.forEach((d, idx) => {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, .14, 18), matConcrete);
    pad.position.y = .07; pad.receiveShadow = true; g.add(pad);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(.36, 1.05, .36), matDark);
    pedestal.position.y = .62; pedestal.castShadow = true; g.add(pedestal);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.52, .4, .42), matSteel);
    head.position.y = 1.35; g.add(head);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.44, .07, .02), new THREE.MeshStandardMaterial({ color: 0x0c1116, emissive: 0x36e0ff, emissiveIntensity: 2.2 }));
    strip.position.set(0, 1.35, .22); g.add(strip);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .8, 6), matSteel);
    ant.position.set(.12, 1.95, 0); g.add(ant);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, .028, 8, 40), new THREE.MeshBasicMaterial({ color: 0x36e0ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .18; g.add(ring);
    const light = new THREE.PointLight(0x36e0ff, 9, 15, 2);
    light.position.y = 1.6; g.add(light);
    const labelSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLabel(d.label, 'rgba(89,215,255,.9)'), transparent: true, fog: false }));
    labelSpr.scale.set(2.6, .82, 1); labelSpr.position.y = 2.55; g.add(labelSpr);
    g.position.set(d.x, 0, d.z);
    worldGroup.add(g);
    occluders.push(pedestal);
    addCollider(d.x, d.z, .45, .45);
    relays.push({ ...d, idx, group: g, ring, light, strip, done: false, progress: 0 });
  });
}

/* 撤离信标 */
let beacon, beaconLight, beaconLabel;
function buildBeacon() {
  beacon = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x52e09a, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  pillar.position.y = 13; beacon.add(pillar);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x52e09a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9 }));
  glow.scale.set(4.5, 4.5, 1); glow.position.y = 1.2; beacon.add(glow);
  beaconLight = new THREE.PointLight(0x52e09a, 22, 26, 2);
  beaconLight.position.y = 1.6; beacon.add(beaconLight);
  beaconLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLabel('四号泊位 · 登船点', 'rgba(82,224,154,.95)'), transparent: true, fog: false }));
  beaconLabel.scale.set(3.4, 1.06, 1); beaconLabel.position.y = 3; beacon.add(beaconLabel);
  beacon.position.set(10, 0, -80.5);
  beacon.visible = false;
  scene.add(beacon);
}
const EXTRACT = new THREE.Vector3(10, 0, -80.5);

/* ============================================================
   敌人
   ============================================================ */
const ENEMY_DEFS = [
  { x: -52, z: -18, wp: [[-52, -18], [-14, -18]] },
  { x: -18, z: 5, wp: [[-18, 5], [-46, 5]] },
  { x: -60, z: 15, wp: [[-60, 15], [-14, 15]] },
  { x: 38, z: -16, wp: [[38, -16], [58, -16]] },
  { x: 24, z: -15, wp: [[20, -15], [38, -15]] },
  { x: 40, z: 40, wp: [[40, 40], [-40, 40]] },
  { x: -44, z: -72, wp: [[-44, -72], [0, -72]] },
  { x: 20, z: -72, wp: [[20, -72], [56, -72]] },
  { x: -30, z: 28, wp: [[-30, 28], [-30, 42]] },
];
const enemies = [];
const enemyRoot = new THREE.Group(); scene.add(enemyRoot);
const losRay = new THREE.Raycaster();
losRay.camera = camera;

class Enemy {
  constructor(def, idx) {
    this.idx = idx;
    this.spawn = { x: def.x, z: def.z };
    this.wp = def.wp; this.wpIdx = 0;
    this.pos = new THREE.Vector3(def.x, 0, def.z);
    this.yaw = 0;
    this.hp = 100; this.dead = false; this.deadT = 0;
    this.state = 'patrol';
    this.alerted = false;
    this.lastSeen = new THREE.Vector3();
    this.lostT = 0; this.searchT = 0;
    this.fireT = rand(.5, 1.4);
    this.perceiveT = Math.random() * .2;
    this.canSee = false;
    this.walkT = rand(0, 9);
    this.flashT = 0;
    this.buildMesh();
  }
  buildMesh() {
    const g = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({ color: 0x3d4c60, roughness: .8 });
    const matDark2 = new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: .85 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: .9 });
    this.matBody = matBody;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.46, .62, .3), matBody);
    torso.position.y = .93; torso.castShadow = true;
    torso.userData = { enemy: this, part: 'body' };
    const head = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 8), matSkin);
    head.position.y = 1.4; head.castShadow = true;
    head.userData = { enemy: this, part: 'head' };
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(.17, .18, .1, 10), matDark2);
    helmet.position.y = 1.49;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.16, .05, .03),
      new THREE.MeshStandardMaterial({ color: 0x111418, emissive: 0x59d7ff, emissiveIntensity: 1.8, roughness: .4 }));
    visor.position.set(0, 1.42, .12);   // 发光目镜:远景轮廓辨识点
    g.add(visor);
    const legGeo = new THREE.BoxGeometry(.16, .58, .16);
    this.legL = new THREE.Group(); this.legL.position.set(-.12, .62, 0);
    this.legR = new THREE.Group(); this.legR.position.set(.12, .62, 0);
    [this.legL, this.legR].forEach(lg => {
      const m = new THREE.Mesh(legGeo, matDark2);
      m.position.y = -.29; m.castShadow = true;
      m.userData = { enemy: this, part: 'body' };
      lg.add(m);
    });
    const armGeo = new THREE.BoxGeometry(.11, .48, .11);
    const armL = new THREE.Mesh(armGeo, matBody); armL.position.set(-.31, 1.02, .05); armL.rotation.x = -1.1;
    const armR = new THREE.Mesh(armGeo, matBody); armR.position.set(.31, 1.02, .05); armR.rotation.x = -1.1;
    const gun = new THREE.Group();
    const gbody = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .58), matDark2);
    gbody.position.z = .1; gun.add(gbody);
    this.gunTip = new THREE.Object3D(); this.gunTip.position.set(0, 0, .42); gun.add(this.gunTip);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.set(.42, .42, 1); this.flash.visible = false;
    this.gunTip.add(this.flash);
    gun.position.set(.2, 1.12, .28);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    mark.scale.set(.55, .55, 1); mark.position.y = 2.05; mark.visible = false;
    this.mark = mark;
    g.add(torso, head, helmet, this.legL, this.legR, armL, armR, gun, mark);
    g.traverse(o => {
      if (o.isMesh && !o.userData.enemy) o.userData = { enemy: this, part: 'body' };
    });
    g.position.copy(this.pos);
    this.group = g;
    enemyRoot.add(g);
  }
  reset() {
    this.pos.set(this.spawn.x, 0, this.spawn.z);
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.hp = 100; this.dead = false; this.deadT = 0;
    this.state = 'patrol'; this.alerted = false; this.canSee = false;
    this.wpIdx = 0; this.fireT = rand(.5, 1.4);
    this.flashT = 0; this.flash.visible = false;
    this.mark.visible = false;
    this.matBody.emissive.setHex(0x000000);
  }
  eyePos(v) { return v.set(this.pos.x, 1.45, this.pos.z); }
  losToPlayer(dist) {
    this.eyePos(_v1);
    _v2.set(player.pos.x, player.pos.y + player.eyeH * .9, player.pos.z);
    const dir = _v3.subVectors(_v2, _v1);
    const d = dir.length();
    if (d > dist) return false;
    dir.normalize();
    losRay.set(_v1, dir);
    losRay.far = d - .4;
    const hits = losRay.intersectObjects(occluders, false);
    return hits.length === 0;
  }
  hearNoise(pos) {
    if (this.dead) return;
    if (!game.firstContact) {
      game.firstContact = true;
      say('锈锚佣兵', '「发现几猫!全体压上去,别放跑了那只猫!」', 3);
    }
    this.alerted = true;
    this.lastSeen.copy(pos);
    if (this.state === 'patrol') this.state = 'hunt';
  }
  damage(amount, part, point) {
    if (this.dead) return;
    this.hp -= part === 'head' ? 100 : amount;
    this.flashT = .16;
    this.matBody.emissive.setHex(0x881414);
    this.hearNoise(player.pos);
    spawnSparks(point, 4, 0xc03040);
    if (this.hp <= 0) this.die();
    return this.dead;
  }
  die() {
    this.dead = true; this.deadT = 0;
    this.mark.visible = false;
    game.kills++;
    AudioFX.tick(true);
    showHitmark(true);
  }
  fire() {
    const d = this.pos.distanceTo(player.pos);
    AudioFX.enemyShot(d);
    this.flash.visible = true; this.flashT = .06;
    const hitChance = clamp(.4 - d * .009 - (player.moveFactor > .2 ? .1 : 0) - (player.crouch ? .07 : 0), .06, .4);
    const hit = Math.random() < hitChance;
    _v2.set(player.pos.x, player.pos.y + player.eyeH * .82, player.pos.z);
    if (!hit) { _v2.x += rand(-1.7, 1.7); _v2.y += rand(-.5, 1.1); _v2.z += rand(-1.7, 1.7); }
    this.gunTip.getWorldPosition(_v1);
    spawnTracer(_v1, _v2, 0xffa060);
    if (hit) playerDamage(rand(7, 13) * diff.dmg);
  }
  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      const t = Math.min(1, this.deadT / .45);
      this.group.rotation.z = (this.idx % 2 ? 1 : -1) * 1.5 * t;
      this.group.position.y = -.12 * t;
      if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.matBody.emissive.setHex(0x000000); }
      return;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flash.visible = false; this.matBody.emissive.setHex(0x000000); }
    }
    // 感知(错峰)
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = .2 + this.idx * .015;
      const d = this.pos.distanceTo(player.pos);
      const detect = (this.alerted ? 46 : (player.crouch ? 14 : 26)) * diff.vision;
      if (d < detect && !player.dead) {
        // 视角夹角
        _v1.subVectors(player.pos, this.pos).normalize();
        const facing = _v2.set(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
        const dot = _v1.dot(facing);
        const inFov = this.alerted ? true : dot > 0.34;
        this.canSee = inFov && this.losToPlayer(detect);
        if (this.canSee) {
          this.lastSeen.copy(player.pos);
          if (!this.alerted) { this.alerted = true; AudioFX.warn(); }
          this.state = 'combat'; this.lostT = 0;
        }
      } else this.canSee = false;
      if (this.state === 'combat' && !this.canSee) {
        this.lostT += .22;
        if (this.lostT > 3.2) { this.state = 'hunt'; }
      }
    }
    // 行为
    let mvx = 0, mvz = 0, speed = 0;
    if (this.state === 'patrol') {
      const t = this.wp[this.wpIdx];
      const dx = t[0] - this.pos.x, dz = t[1] - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < .6) this.wpIdx = (this.wpIdx + 1) % this.wp.length;
      else { mvx = dx / d; mvz = dz / d; speed = 1.5; }
    } else if (this.state === 'hunt') {
      const dx = this.lastSeen.x - this.pos.x, dz = this.lastSeen.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) { this.searchT += dt; if (this.searchT > 3) { this.searchT = 0; this.state = 'patrol'; this.alerted = false; } }
      else { mvx = dx / d; mvz = dz / d; speed = 3; }
    } else if (this.state === 'combat') {
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      if (d > 17 && this.canSee) { mvx = dx / d; mvz = dz / d; speed = 2.6; }
      else if (!this.canSee) { mvx = dx / d; mvz = dz / d; speed = 3; }
      if (this.canSee && d < 34) {
        this.fireT -= dt;
        if (this.fireT <= 0) { this.fire(); this.fireT = rand(.85, 1.5) * diff.rof; }
      }
    }
    if (speed > 0) {
      slideMove(this.pos, mvx * speed * dt, mvz * speed * dt, .35);
      this.yaw = Math.atan2(mvx, mvz);
      this.walkT += dt * speed * 2.4;
    } else this.walkT *= .9;
    this.group.position.set(this.pos.x, Math.abs(Math.sin(this.walkT)) * .04, this.pos.z);
    // 平滑转向
    let dy = this.yaw - this.group.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.group.rotation.y += dy * Math.min(1, dt * 8);
    this.legL.rotation.x = Math.sin(this.walkT) * .55 * (speed > 0 ? 1 : 0);
    this.legR.rotation.x = -Math.sin(this.walkT) * .55 * (speed > 0 ? 1 : 0);
    this.mark.visible = this.state === 'combat';
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

function buildEnemies() {
  ENEMY_DEFS.forEach((d, i) => enemies.push(new Enemy(d, i)));
}

/* ============================================================
   特效池:火花 / 弹壳 / 曳光 / 枪口焰
   ============================================================ */
const starTex = texStar();
const sparks = [];
function buildEffects() {
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.visible = false; scene.add(s);
    sparks.push({ s, vel: new THREE.Vector3(), life: 0 });
  }
  for (let i = 0; i < 14; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffc890, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.visible = false; scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const cGeo = new THREE.BoxGeometry(.015, .015, .04);
  const cMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: .4, metalness: .7 });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(cGeo, cMat);
    m.visible = false; scene.add(m);
    casings.push({ m, vel: new THREE.Vector3(), life: 0, rs: rand(6, 14) });
  }
}
const tracers = [], casings = [];
function spawnSparks(point, n, color) {
  let c = 0;
  for (const sp of sparks) {
    if (sp.life > 0) continue;
    sp.life = rand(.14, .26);
    sp.s.visible = true;
    sp.s.position.copy(point);
    sp.s.material.color.setHex(color || 0xffa050);
    sp.s.scale.setScalar(rand(.1, .22));
    sp.vel.set(rand(-2.2, 2.2), rand(1.4, 3.6), rand(-2.2, 2.2));
    if (++c >= n) break;
  }
}
function spawnTracer(a, b, color) {
  for (const t of tracers) {
    if (t.life > 0) continue;
    t.life = .09;
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = .55;
    t.line.visible = true;
    return;
  }
}
function spawnCasing() {
  for (const c of casings) {
    if (c.life > 0) continue;
    c.life = 1;
    muzzle.getWorldPosition(c.m.position);
    camera.getWorldDirection(_v1);
    _v2.crossVectors(_v1, camera.up).normalize();
    c.m.position.addScaledVector(_v2, .12).addScaledVector(_v1, -.3);
    c.vel.copy(_v2).multiplyScalar(rand(1, 1.8)); c.vel.y = rand(1.5, 2.6);
    c.m.visible = true;
    return;
  }
}
/* 弹孔 decal 池 */
const decals = [];
let decalIdx = 0;
const _m4tmp = new THREE.Matrix4(), _nm3 = new THREE.Matrix3();
function texHole() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(8,8,10,.95)');
  gr.addColorStop(.45, 'rgba(20,18,16,.72)');
  gr.addColorStop(.75, 'rgba(30,28,26,.26)');
  gr.addColorStop(1, 'rgba(30,28,26,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  g.strokeStyle = 'rgba(10,10,12,.55)';
  for (let i = 0; i < 7; i++) {
    const a = rand(0, 6.3), r1 = rand(8, 16), r2 = rand(18, 27);
    g.beginPath(); g.moveTo(32 + Math.cos(a) * r1, 32 + Math.sin(a) * r1);
    g.lineTo(32 + Math.cos(a) * r2, 32 + Math.sin(a) * r2); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function buildDecals() {
  const holeTex = texHole();
  const g = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      map: holeTex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0,
    }));
    m.visible = false; m.renderOrder = 2;
    scene.add(m);
    decals.push({ m, life: 0 });
  }
}
function spawnDecal(hit) {
  if (!hit.face || !hit.object) return;
  const o = hit.object;
  const n = hit.face.normal.clone();
  if (o.isInstancedMesh && hit.instanceId !== undefined) {
    o.getMatrixAt(hit.instanceId, _m4tmp);
    n.transformDirection(_m4tmp);
  } else {
    _nm3.getNormalMatrix(o.matrixWorld);
    n.applyMatrix3(_nm3);
  }
  n.normalize();
  const d = decals[decalIdx++ % decals.length];
  d.life = 20;
  d.m.visible = true;
  d.m.material.opacity = .9;
  d.m.position.copy(hit.point).addScaledVector(n, .028);
  const s = rand(.16, .3);
  d.m.scale.set(s, s, 1);
  if (Math.abs(n.y) > .9) d.m.rotation.set(n.y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, rand(0, 6.3));
  else { d.m.lookAt(hit.point.x + n.x, hit.point.y + n.y, hit.point.z + n.z); d.m.rotateZ(rand(0, 6.3)); }
}
function updateDecals(dt) {
  for (const d of decals) {
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life < 3) d.m.material.opacity = Math.max(0, d.life / 3 * .9);
    if (d.life <= 0) d.m.visible = false;
  }
}

function updateEffects(dt) {
  for (const sp of sparks) {
    if (sp.life <= 0) continue;
    sp.life -= dt;
    sp.vel.y -= 7 * dt;
    sp.s.position.addScaledVector(sp.vel, dt);
    sp.s.material.opacity = clamp(sp.life / .2, 0, 1);
    if (sp.life <= 0) sp.s.visible = false;
  }
  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.line.material.opacity = t.life / .09 * .55;
    if (t.life <= 0) t.line.visible = false;
  }
  for (const c of casings) {
    if (c.life <= 0) continue;
    c.life -= dt;
    c.vel.y -= 9 * dt;
    c.m.position.addScaledVector(c.vel, dt);
    c.m.rotation.x += c.rs * dt; c.m.rotation.z += c.rs * dt;
    if (c.m.position.y < .03) { c.m.position.y = .03; c.vel.set(0, 0, 0); }
    if (c.life <= 0) c.m.visible = false;
  }
}

/* ============================================================
   雨
   ============================================================ */
/* 雨:远近两层,近层粗快、远层细慢,拉开纵深 */
const rainLayers = [];
function makeRainLayer(N, len, speed, opacity, slant) {
  const posArr = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x93a7bd, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  const off = [];
  for (let i = 0; i < N; i++) off.push({ x: rand(-42, 42), y: rand(0, 26), z: rand(-42, 42) });
  scene.add(lines);
  const layer = { lines, off, N, len, speed, slant, arr: posArr };
  rainLayers.push(layer);
  return layer;
}
function buildRain() {
  makeRainLayer(IS_TOUCH ? 380 : 780, .62, 28, .3, .12);
  makeRainLayer(IS_TOUCH ? 220 : 460, .36, 21, .15, .2);
}
function updateRain(dt) {
  if (!rainLayers[0] || !rainLayers[0].lines.visible) return;
  for (const L of rainLayers) {
    const arr = L.arr;
    for (let i = 0; i < L.N; i++) {
      const o = L.off[i];
      o.y -= L.speed * dt;
      if (o.y < -1) { o.y += 26; o.x = rand(-42, 42); o.z = rand(-42, 42); }
      const bx = camera.position.x + o.x, by = camera.position.y + o.y - 4, bz = camera.position.z + o.z;
      const j = i * 6;
      arr[j] = bx; arr[j + 1] = by; arr[j + 2] = bz;
      arr[j + 3] = bx + L.slant; arr[j + 4] = by - L.len; arr[j + 5] = bz;
    }
    L.lines.geometry.attributes.position.needsUpdate = true;
  }
}

/* ============================================================
   玩家 & 武器
   ============================================================ */
const player = {
  pos: new THREE.Vector3(-66, 0, 54),
  vy: 0, grounded: true,
  yaw: 0, pitch: 0,
  eyeH: 1.66, crouch: false,
  dead: false, moveFactor: 0, bobT: 0, stepAcc: 0,
};
const keys = {};
let firing = false, adsHold = false, adsT = 0, touchAds = false, touchFire = false, touchUse = false, touchCrouch = false;
let noLockMode = false; // 指针锁定不可用时(iframe/受限环境)的降级:右键拖动转视角,左键开火
let recoilPitch = 0, recoilHeat = 0, gunKick = 0, spreadVis = .012;
// 键盘视角/备用开火(鼠标输入被面板拦截时仍可完整游玩)
let kbLeft = false, kbRight = false, kbUp = false, kbDown = false;
let reloading = false, reloadT = 0;
/* 武器系统:步枪(全自动) + 手枪(半自动副武器,Q/1/2 或触屏切换) */
const WEAPONS = {
  rifle: { name: '几猫九式·改', magSize: 30, auto: true, dmg: 34, rof: .105, rld: 2.1, mag: 30, reserve: 150 },
  pistol: { name: '几猫短刃', magSize: 12, auto: false, dmg: 62, rof: .22, rld: 1.5, mag: 12, reserve: 36 },
};
let curWeapon = 'rifle', prevFiring = false, switchT = -1, gunPistol = null, muzzle2 = null, muzzleFlash2 = null;
const RELOAD_DUR = 2.1; // 兼容旧引用,实际换弹时长取 WEAPONS[curWeapon].rld
let autoReloadT = -1; // 空仓后自动换弹的倒计时(-1 = 未触发)
let lastShot = 0, dryPlayed = false;

const raycaster = new THREE.Raycaster();
raycaster.far = 300;
raycaster.camera = camera; // Sprite.raycast 需要引用相机,否则 intersectObjects 会空指针

/* 枪模:「几猫九式·改」能量突击步枪(程序化拼装,科技感) */
const gun = new THREE.Group();
let magMesh, muzzle, muzzleFlash, muzzleLight, reticleMesh, gunCellMat, ammoPanelTex;
function makeAmmoPanelTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  ammoPanelTex = new THREE.CanvasTexture(c);
  ammoPanelTex.colorSpace = THREE.SRGBColorSpace;
  drawAmmoPanel(30);
  return ammoPanelTex;
}
function drawAmmoPanel(n) {
  if (!ammoPanelTex) return;
  const g = ammoPanelTex.image.getContext('2d');
  g.fillStyle = 'rgba(5,12,17,.92)'; g.fillRect(0, 0, 64, 32);
  g.strokeStyle = 'rgba(55,226,255,.55)'; g.lineWidth = 2; g.strokeRect(1.5, 1.5, 61, 29);
  g.fillStyle = n <= 6 ? '#ff8a4a' : '#5ce6ff';
  g.font = 'bold 21px Consolas, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n).padStart(2, '0'), 32, 17);
  ammoPanelTex.needsUpdate = true;
}
function buildGun() {
  const matBody = new THREE.MeshStandardMaterial({ color: 0x161a21, roughness: .38, metalness: .72 });  // 钨钢机匣
  const matPanel = new THREE.MeshStandardMaterial({ color: 0x1d232e, roughness: .3, metalness: .8 });   // 面板甲
  const matDark2 = new THREE.MeshStandardMaterial({ color: 0x0f131a, roughness: .5, metalness: .6 });   // 深色件
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x37e2ff, emissiveIntensity: 2.2, roughness: .4 }); // 能量辉光条
  gunCellMat = new THREE.MeshStandardMaterial({ color: 0x0c1c26, emissive: 0x2ad4ff, emissiveIntensity: 1.6, transparent: true, opacity: .94, roughness: .3 }); // 能量弹匣
  const mk = (w, h, d, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.x = rx;
    gun.add(m); return m;
  };
  // —— 上下两段式机匣 + 顶部导轨 ——
  mk(.078, .05, .5, matBody, 0, .028, -.05);
  mk(.072, .078, .42, matBody, 0, -.038, -.02);
  mk(.076, .02, .52, matPanel, 0, .062, -.05);
  for (let i = 0; i < 5; i++) mk(.078, .008, .022, matDark2, 0, .075, -.24 + i * .09);   // 导轨齿
  // —— 护木 + 发光散热鳍 ——
  mk(.06, .06, .3, matPanel, 0, -.005, -.4);
  for (let i = 0; i < 3; i++) mk(.064, .012, .05, matGlow, 0, .016, -.33 - i * .09);
  // —— 枪管 + 双线圈环 ——
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .3, 10), matDark2);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .012, -.63); gun.add(barrel);
  const ringGeo = new THREE.TorusGeometry(.03, .007, 6, 16);
  const ring1 = new THREE.Mesh(ringGeo, matGlow); ring1.position.set(0, .012, -.55); gun.add(ring1);
  const ring2 = new THREE.Mesh(ringGeo, matGlow); ring2.position.set(0, .012, -.66); gun.add(ring2);
  // —— 能量喷口 ——
  mk(.034, .034, .07, matDark2, 0, .012, -.8);
  mk(.018, .018, .034, matGlow, 0, .012, -.845);
  // —— 能量弹匣(半透明发光,换弹动画引用) ——
  magMesh = mk(.052, .17, .1, gunCellMat, 0, -.15, .02, .14);
  mk(.056, .02, .104, matDark2, 0, -.058, .02, .14);
  // —— 握把 / 骨架枪托 ——
  mk(.044, .12, .058, matDark2, 0, -.128, .16, .18);
  mk(.04, .05, .2, matBody, 0, -.02, .32);
  mk(.012, .08, .045, matBody, 0, -.058, .4);
  // —— 全息瞄具 ——
  mk(.05, .026, .13, matBody, 0, .085, -.12);
  mk(.006, .05, .12, matDark2, -.024, .108, -.12);
  mk(.006, .05, .12, matDark2, .024, .108, -.12);
  mk(.05, .006, .12, matDark2, 0, .136, -.12);
  mk(.028, .01, .018, matGlow, .026, .088, -.06);   // 瞄具能量接头
  reticleMesh = new THREE.Mesh(new THREE.PlaneGeometry(.05, .05),
    new THREE.MeshBasicMaterial({ map: texRing(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  reticleMesh.position.set(0, .108, -.06);
  gun.add(reticleMesh);
  // —— 枪身弹药读数屏(实时刷新) ——
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(.052, .026),
    new THREE.MeshBasicMaterial({ map: makeAmmoPanelTex(), transparent: true }));
  panel.position.set(-.04, .012, .04); panel.rotation.y = -Math.PI / 2;
  gun.add(panel);
  // —— 侧面能量导管 ——
  mk(.008, .012, .36, matGlow, -.038, .024, -.18);
  // —— 枪口锚点 / 枪口焰 / 枪口灯 ——
  muzzle = new THREE.Object3D(); muzzle.position.set(0, .012, -.87); gun.add(muzzle);
  muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffd090, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  muzzleFlash.scale.set(.26, .26, 1); muzzleFlash.visible = false;
  muzzle.add(muzzleFlash);
  muzzleLight = new THREE.PointLight(0xffb36b, 0, 8, 2);
  muzzleLight.position.set(0, .05, -.8); gun.add(muzzleLight);
  // —— 第一人称双手(右手握把 + 左手护木) ——
  const matGlove = new THREE.MeshStandardMaterial({ color: 0x20252f, roughness: .85 });
  const matSleeve = new THREE.MeshStandardMaterial({ color: 0x2c3544, roughness: .88 });
  const foreR = new THREE.Mesh(new THREE.BoxGeometry(.085, .085, .3), matSleeve);
  foreR.position.set(.02, -.055, .2); foreR.rotation.x = .5; gun.add(foreR);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .13), matGlove);
  handR.position.set(0, -.118, .15); handR.rotation.x = .18; gun.add(handR);
  const foreL = new THREE.Mesh(new THREE.BoxGeometry(.085, .085, .34), matSleeve);
  foreL.position.set(-.095, -.1, -.22); foreL.rotation.set(.5, -.35, .18); gun.add(foreL);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(.075, .095, .14), matGlove);
  handL.position.set(-.028, -.052, -.36); handL.rotation.y = .2; gun.add(handL);
  gun.traverse(o => { o.castShadow = false; o.receiveShadow = false; if (o.material) o.material.fog = false; });
  gun.position.set(.22, -.24, -.46);
  camera.add(gun);
}

/* 副武器:几猫短刃(半自动手枪) */
function buildPistol() {
  gunPistol = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color: 0x1d222c, roughness: .4, metalness: .7 });
  const matDark2 = new THREE.MeshStandardMaterial({ color: 0x0f131a, roughness: .5, metalness: .6 });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x37e2ff, emissiveIntensity: 2, roughness: .4 });
  const mk = (w, h, d, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.x = rx;
    gunPistol.add(m); return m;
  };
  mk(.048, .052, .27, matBody, 0, .01, -.1);          // 套筒
  mk(.044, .05, .2, matDark2, 0, -.032, -.12);        // 下枪身
  mk(.04, .11, .05, matDark2, 0, -.1, -.02, .2);      // 握把
  mk(.008, .008, .16, matGlow, .026, .012, -.1);      // 侧发光条
  mk(.014, .014, .04, matGlow, 0, .01, -.26);         // 能量喷口
  mk(.012, .02, .02, matDark2, 0, .042, .0);          // 照门
  // 手(右手持枪)
  const matGlove = new THREE.MeshStandardMaterial({ color: 0x20252f, roughness: .85 });
  const matSleeve = new THREE.MeshStandardMaterial({ color: 0x2c3544, roughness: .88 });
  const hand = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .12), matGlove);
  hand.position.set(0, -.085, -.01); hand.rotation.x = .2; gunPistol.add(hand);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(.085, .085, .3), matSleeve);
  fore.position.set(.02, -.11, .12); fore.rotation.x = .5; gunPistol.add(fore);
  muzzle2 = new THREE.Object3D(); muzzle2.position.set(0, .01, -.29); gunPistol.add(muzzle2);
  muzzleFlash2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffd090, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  muzzleFlash2.scale.set(.2, .2, 1); muzzleFlash2.visible = false;
  muzzle2.add(muzzleFlash2);
  gunPistol.traverse(o => { o.castShadow = false; o.receiveShadow = false; if (o.material) o.material.fog = false; });
  gunPistol.position.set(.2, -.23, -.42);
  gunPistol.visible = false;
  camera.add(gunPistol);
}

const GUN_HIP = { x: .22, y: -.24, z: -.46 };
const GUN_ADS = { x: 0, y: -.108, z: -.34 };

function shoot() {
  if (reloading || player.dead) return;
  const now = game.elapsed;
  if (game.mag <= 0) {
    if (!dryPlayed) { AudioFX.dry(); dryPlayed = true; }
    if (game.reserve > 0) autoReloadT = 0; // 触发空仓自动换弹
    if (!game.tipReload) {
      game.tipReload = true;
      showTip(IS_TOUCH ? '弹匣打空了——点「换弹」按钮' : '弹匣打空了——按 R 换弹', 3.2);
    }
    return;
  }
  const W = WEAPONS[curWeapon];
  if (now - lastShot < W.rof) return;
  lastShot = now;
  game.mag--; game.shots++;
  dryPlayed = false;
  // 散布
  const spread = .011 + (1 - adsT) * .013 + player.moveFactor * .02 + recoilHeat * .022;
  spreadVis = spread;
  camera.getWorldDirection(_v1);
  _v1.x += rand(-spread, spread); _v1.y += rand(-spread, spread); _v1.z += rand(-spread, spread);
  _v1.normalize();
  _v2.set(camera.position.x, camera.position.y - .02, camera.position.z);
  raycaster.set(_v2, _v1);
  const mz = curWeapon === 'rifle' ? muzzle : muzzle2;
  mz.getWorldPosition(_v3);
  let tracerEnd = null;
  for (const h of hits) {
    const ud = h.object.userData;
    if (ud && ud.enemy && !ud.enemy.dead) {
      game.hits++;
      tracerEnd = h.point;
      const killed = ud.enemy.damage(W.dmg, ud.part, h.point);
      if (!killed) { AudioFX.tick(false); showHitmark(false); }
      break;
    }
    if (h.distance > .8) {
      spawnDecal(h);
      spawnSparks(h.point, 3, 0xffa050);
      tracerEnd = h.point;
      break;
    }
  }
  if (tracerEnd && tracerEnd.distanceTo(_v3) > 2.5) spawnTracer(_v3, tracerEnd, 0xffd2a8);
  // 后坐
  recoilHeat = Math.min(1, recoilHeat + .11);
  recoilPitch += .011 + rand(0, .004);
  gunKick = 1;
  const flash = curWeapon === 'rifle' ? muzzleFlash : muzzleFlash2;
  flash.visible = true;
  flash.material.rotation = rand(0, 6.3);
  flash.scale.setScalar(curWeapon === 'rifle' ? rand(.3, .45) : rand(.2, .3));
  muzzleLight.intensity = 30;
  spawnCasing();
  if (curWeapon === 'rifle') AudioFX.shot(); else AudioFX.shotPistol();
  // 枪声惊动周围敌人
  for (const e of enemies) {
    if (!e.dead && e.pos.distanceTo(player.pos) < 45) e.hearNoise(player.pos);
  }
  updateAmmoHUD();
}

function startReload() {
  const W = WEAPONS[curWeapon];
  if (reloading || switchT >= 0 || game.mag >= W.magSize || game.reserve <= 0 || player.dead) return;
  reloading = true; reloadT = 0;
  AudioFX.reload();
}
function finishReloadStep() {
  const W = WEAPONS[curWeapon];
  const need = W.magSize - game.mag;
  const take = Math.min(need, game.reserve);
  game.mag += take; game.reserve -= take;
  updateAmmoHUD();
}
function switchWeapon(w) {
  if (w === curWeapon || switchT >= 0) return;
  const cur = WEAPONS[curWeapon];
  cur.mag = game.mag; cur.reserve = game.reserve;      // 存回当前
  reloading = false; reloadT = 0;
  curWeapon = w;
  game.mag = WEAPONS[w].mag; game.reserve = WEAPONS[w].reserve; // 载入目标
  firing = false; touchFire = false;                   // 切枪期间禁止幻影开火
  gun.visible = w === 'rifle';
  if (gunPistol) gunPistol.visible = w === 'pistol';
  (w === 'rifle' ? gun : gunPistol).add(muzzleLight);  // 枪口灯跟随武器
  muzzleLight.position.set(0, .05, -.7);
  switchT = 0; adsT = 0; dryPlayed = false; autoReloadT = -1;
  updateAmmoHUD();
  AudioFX.ui();
}

function playerDamage(d) {
  if (player.dead || phase.cur !== 'playing') return;
  game.hp -= d;
  game.lastHurt = game.elapsed;
  AudioFX.hurt();
  updateHealthHUD();
  if (game.hp <= 0) {
    game.hp = 0;
    player.dead = true;
    lose(LOSE_DEATH_TEXT);
  }
}

/* 碰撞:点是否落在(按半径膨胀的)碰撞盒内 */
function hitCollider(px, pz, r) {
  for (const b of colliders) {
    if (px > b.x0 - r && px < b.x1 + r && pz > b.z0 - r && pz < b.z1 + r) return true;
  }
  return false;
}
function slideMove(pos, dx, dz, r) {
  if (!hitCollider(pos.x + dx, pos.z, r)) pos.x += dx;
  if (!hitCollider(pos.x, pos.z + dz, r)) pos.z += dz;
  pos.x = clamp(pos.x, -76.5, 76.5);
  pos.z = clamp(pos.z, -82, 64.5);
}

function updatePlayer(dt) {
  // 输入方向
  let ix = 0, iz = 0;
  if (!IS_TOUCH) {
    if (keys.KeyW) iz -= 1;
    if (keys.KeyS) iz += 1;
    if (keys.KeyA) ix -= 1;
    if (keys.KeyD) ix += 1;
  } else { ix = stickVec.x; iz = stickVec.y; }
  const imLen = Math.hypot(ix, iz);
  if (imLen > 1) { ix /= imLen; iz /= imLen; }
  player.crouch = !!(keys.KeyC || touchCrouch);
  // 瞄准不再受移动限制(移动时精度下降,但可以边走边瞄)
  const wantADS = (adsHold || touchAds) && !reloading;
  adsT = clamp(adsT + (wantADS ? 1 : -1) * dt * 6.5, 0, 1);
  const sprintKey = !!(keys.ShiftLeft || keys.ShiftRight);
  const sprinting = sprintKey && iz < -.3 && !player.crouch && adsT < .4 && !reloading && imLen > .2;
  const speed = player.crouch ? 2.7 : sprinting ? 8.2 : lerp(5.4, 3.6, adsT);
  // 世界方向(forward = (-sinYaw, -cosYaw),right = (cosYaw, -sinYaw))
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const dirX = (-sy) * (-iz) + cy * ix;
  const dirZ = (-cy) * (-iz) + (-sy) * ix;
  player.moveFactor = lerp(player.moveFactor, clamp(imLen * (sprinting ? 1.5 : 1), 0, 1.5), Math.min(1, dt * 8));
  slideMove(player.pos, dirX * speed * dt, dirZ * speed * dt, .38);
  // 跳跃 & 重力
  if (player.grounded && (keys.Space || touchJumpQueued)) {
    player.vy = 7.2; player.grounded = false;
    touchJumpQueued = false;
  }
  player.vy -= 21 * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; player.grounded = true; }
  // 脚步声
  if (player.grounded && imLen > .2) {
    player.stepAcc += speed * dt;
    if (player.stepAcc > 2.4) { player.stepAcc = 0; AudioFX.step(); }
    player.bobT += dt * (sprinting ? 11 : 7.5);
  } else player.bobT *= .95;
  // 键盘视角(方向键;鼠标输入被拦截时的备用通道)
  if (kbLeft) player.yaw += 2.4 * dt;
  if (kbRight) player.yaw -= 2.4 * dt;
  if (kbUp) player.pitch = clamp(player.pitch + 1.5 * dt, -1.45, 1.45);
  if (kbDown) player.pitch = clamp(player.pitch - 1.5 * dt, -1.45, 1.45);
  // 视高
  const eyeTarget = player.crouch ? .98 : 1.66;
  player.eyeH = lerp(player.eyeH, eyeTarget, Math.min(1, dt * 10));
  // 回血
  if (game.elapsed - game.lastHurt > 4 && game.hp > 0 && game.hp < 100) {
    game.hp = Math.min(100, game.hp + diff.regen * dt);
    updateHealthHUD();
  }
}
let touchJumpQueued = false;

function updateCamera(dt) {
  recoilPitch += (0 - recoilPitch) * Math.min(1, dt * 9);
  recoilHeat = Math.max(0, recoilHeat - dt * 1.3);
  const bobY = player.grounded ? Math.abs(Math.sin(player.bobT)) * .028 * (1 - adsT) : 0;
  camera.position.set(player.pos.x, player.pos.y + player.eyeH + bobY, player.pos.z);
  camera.rotation.set(player.pitch + recoilPitch, player.yaw, 0);
  // FOV
  const targetFov = 75 - adsT * (curWeapon === 'rifle' ? 17 : 7);
  if (Math.abs(camera.fov - targetFov) > .05) {
    camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 10));
    camera.updateProjectionMatrix();
  }
}

function updateGun(dt) {
  // 空仓自动换弹:松开扳机一小段时间后自动上弹
  if (autoReloadT >= 0) {
    if (game.mag > 0 || game.reserve <= 0 || reloading) autoReloadT = -1;
    else {
      autoReloadT += dt;
      if (autoReloadT >= .45) { autoReloadT = -1; startReload(); }
    }
  }
  gunKick = Math.max(0, gunKick - dt * 7);
  if (gunCellMat) gunCellMat.emissiveIntensity = 1.5 + Math.sin(nowSec * 5) * .4; // 弹匣能量呼吸
  if (muzzleFlash.visible && game.elapsed - lastShot > .045) muzzleFlash.visible = false;
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 160);
  if (reloading) {
    reloadT += dt;
    const finT = WEAPONS[curWeapon].rld - .55;
    if (reloadT >= finT && reloadT - dt < finT) finishReloadStep();
    if (reloadT >= WEAPONS[curWeapon].rld) { reloading = false; magMesh.position.set(0, -.15, .02); magMesh.rotation.x = .14; magMesh.visible = true; }
  }
  // 姿态
  const isRifle = curWeapon === 'rifle';
  const g = isRifle ? gun : gunPistol;
  const HIP = isRifle ? { x: .27, y: -.285, z: -.55 } : { x: .21, y: -.24, z: -.5 };
  const ADSP = isRifle ? { x: 0, y: -.108, z: -.34 } : { x: 0, y: -.078, z: -.3 };
  const t = ss(0, 1, adsT);
  const bx = lerp(HIP.x, ADSP.x, t);
  const by = lerp(HIP.y, ADSP.y, t);
  const bz = lerp(HIP.z, ADSP.z, t);
  let swapDip = 0;
  if (switchT >= 0) {
    switchT += dt;
    swapDip = -.26 * Math.sin(Math.min(1, switchT / .38) * Math.PI);
    if (switchT >= .38) switchT = -1;
  }
  const bobAmp = (player.grounded ? .013 : .004) * (1 - adsT * .85) * clamp(player.moveFactor, 0, 1);
  const breath = Math.sin(performance.now() / 1000 * 1.7) * .0032 * (1 - adsT);
  let rx = gunKick * .09 + breath * 2;
  let ry = 0, rz = Math.sin(player.bobT) * bobAmp * .4;
  let my = 0, mr = .14, mVis = true;
  if (reloading) {
    const p = reloadT / WEAPONS[curWeapon].rld;
    const dip = ss(0, .22, p) * (1 - ss(.82, 1, p));
    rx -= .55 * dip; rz += .3 * dip;
    // 弹匣动画
    if (p > .3 && p < .55) { my = -(p - .3) / .25 * .24; }
    else if (p >= .55 && p < .75) { mVis = false; my = .24; }
    else if (p >= .75 && p < .95) { my = -(1 - (p - .75) / .2) * .24; }
  }
  g.position.set(
    bx + Math.sin(player.bobT) * bobAmp * .6,
    by + Math.abs(Math.cos(player.bobT)) * bobAmp + breath + swapDip,
    bz + gunKick * .05
  );
  g.rotation.set(rx, ry, rz);
  if (isRifle) {
    magMesh.position.set(0, -.15 + my, .02);
    magMesh.rotation.x = mr;
    magMesh.visible = mVis;
    reticleMesh.material.opacity = adsT * .95;
  } else if (reticleMesh) reticleMesh.material.opacity = 0;
  // 准星
  const xh = 7 + spreadVis * 240;
  crossEl.style.setProperty('--xh', xh.toFixed(1) + 'px');
  crossEl.style.opacity = (1 - adsT).toFixed(2);
  reticleEl.style.opacity = adsT.toFixed(2);
}

/* ============================================================
   任务流程
   ============================================================ */
/* 剧情线:主控 AI「绫」凌晨倒戈,玩家为几猫突击小队 B4 队员 */
const introEvents = [
  { t: .8, who: '指挥中心', text: '几猫队员,这里是指挥中心。凌晨 05:42,港区主控 AI「绫」突然倒戈——泊区防御网反转,炮口对准了我们。' },
  { t: 7.2, who: '指挥中心', text: '她在堆场、仓库、码头部署了三台中继站,把整个泊区锁死了。我要你徒手掐断这三根线。' },
  { t: 13.6, who: '夜枭', text: '我是夜枭,在你的耳机里。守卫是「锈锚」的佣兵——枪声会引来他们,别恋战。' },
  { t: 19.4, who: '指挥中心', text: '撤离艇在四号泊位待命。05:42 封港倒计时一过,谁都走不了。行动。' },
];
const relayLines = [
  '堆场中继离线!「绫」把一半巡逻调去了仓库那边——压力会小一点,快走。',
  '仓库中继离线……等等,货架上全是空箱子。他们把「绫」的核心模组装上船了,就是四号泊位那艘货轮!',
  '三处中继全部切断!——等等,频道里有杂音……「绫」:小猫,船是我的了。队员,做好最坏打算,快登船!',
];
const LOSE_TIMEOUT_TEXT = '05:42 到了,泊区封锁完成,撤离窗口关闭。指挥中心:我们失去了一位好队员……还有那艘船。';
const LOSE_DEATH_TEXT = '你在港区的雨夜里倒下了。夜枭:记下你的位置了,兄弟。下一个五分钟,我们替你掐断它。';
const WIN_TEXT = '你跳上舷梯的瞬间,「绫」的声音在雾里散了。货轮拉响汽笛驶出港区,指挥中心在频道里沉默了很久,然后说:欢迎回家,几猫。';

/* 字幕 */
const subQ = [];
let subT = 0, subShowing = false;
function say(who, text, dur = 4.2) { subQ.push({ who, text, dur }); }
function updateSub(dt) {
  const el = $('jm-sub');
  if (subShowing) {
    subT -= dt;
    if (subT <= 0) { el.classList.remove('jm-show'); subShowing = false; subT = .35; }
  } else {
    subT -= dt;
    if (subT <= 0 && subQ.length) {
      const s = subQ.shift();
      AudioFX.radio();
      $('jm-sub-who').textContent = s.who;
      $('jm-sub-text').textContent = s.text;
      el.classList.add('jm-show');
      subShowing = true; subT = s.dur;
    }
  }
}
let tipT = 0, tipHideTimer = null;
function showTip(text, dur = 3) {
  const el = $('jm-tip');
  clearTimeout(tipHideTimer);
  el.textContent = text; el.hidden = false; el.style.opacity = 1;
  tipT = dur;
}
function updateTip(dt) {
  if (tipT > 0) {
    tipT -= dt;
    if (tipT <= 0) {
      $('jm-tip').style.opacity = 0;
      tipHideTimer = setTimeout(() => { $('jm-tip').hidden = true; }, 350);
      tipT = 0;
    }
  }
}

/* 命中标记 */
let hmTimer = null;
function showHitmark(kill) {
  const el = $('jm-hitmark');
  el.classList.remove('jm-show', 'jm-kill');
  void el.offsetWidth;
  el.classList.add('jm-show');
  if (kill) el.classList.add('jm-kill');
  clearTimeout(hmTimer);
  hmTimer = setTimeout(() => el.classList.remove('jm-show'), 220);
}

/* HUD 更新 */
const crossEl = $('jm-cross'), reticleEl = $('jm-reticle');
function updateAmmoHUD() {
  drawAmmoPanel(game.mag);
  const W = WEAPONS[curWeapon];
  $('jm-ammo-name').textContent = W.name;
  const magEl = $('jm-ammo-mag');
  magEl.textContent = game.mag;
  $('jm-ammo-res').textContent = game.reserve;
  const lowAt = Math.ceil(W.magSize / 5);
  magEl.classList.toggle('jm-ammo-low', game.mag <= lowAt);
  $('jm-ammo-warn').hidden = game.mag > lowAt || (game.mag === 0 && game.reserve === 0);
  if (game.mag === 0 && game.reserve === 0) { $('jm-ammo-warn').hidden = false; $('jm-ammo-warn').textContent = '弹药耗尽'; }
  else $('jm-ammo-warn').textContent = '弹药不足';
}
function updateHealthHUD() {
  const hp = Math.round(game.hp);
  $('jm-health-num').textContent = hp;
  $('jm-health-fill').style.width = hp + '%';
  $('jm-health').classList.toggle('jm-low', hp <= 32);
}

/* 罗盘 */
const PPD = 2.2, HALF_W = 170;
let compassMarks = [];
function buildCompass() {
  const tape = $('jm-compass-tape');
  const letters = ['北', '东', '南', '西']; // 与原版视频一致,罗盘用中文方位
  for (let i = -60; i <= 780; i += 15) {
    const deg = ((i % 360) + 360) % 360;
    const left = (i + 60) * PPD;
    if (deg % 90 === 0) {
      const b = document.createElement('b');
      b.textContent = letters[deg / 90];
      b.style.left = left + 'px';
      tape.appendChild(b);
    } else if (deg % 30 === 0) {
      const b = document.createElement('b');
      b.className = 'jm-deg';
      b.textContent = String(deg).padStart(3, '0');
      b.style.left = left + 'px';
      tape.appendChild(b);
    } else {
      const sp = document.createElement('span');
      sp.className = deg % 45 === 0 ? 'jm-tick-big' : '';
      sp.style.left = left + 'px';
      tape.appendChild(sp);
    }
  }
  compassMarks = [];
  for (let i = 0; i < 3; i++) {
    const u = document.createElement('u');
    u.className = 'jm-mk';
    tape.appendChild(u);
    compassMarks.push(u);
  }
  const ext = document.createElement('u');
  ext.className = 'jm-mk-ext';
  ext.style.display = 'none';
  tape.appendChild(ext);
  compassMarks.push(ext);
}
function bearingDeg(tx, tz) {
  const dx = tx - player.pos.x, dz = tz - player.pos.z;
  let b = Math.atan2(dx, -dz) * 180 / Math.PI;
  return (b + 360) % 360;
}
function updateCompass() {
  const heading = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
  $('jm-compass-tape').style.transform = `translateX(${(HALF_W - (heading + 60) * PPD).toFixed(1)}px)`;
  const targets = relays.map(r => r);
  compassMarks.forEach((u, i) => {
    let bx, bz, done;
    if (i < 3) { bx = targets[i].x; bz = targets[i].z; done = targets[i].done; }
    else { bx = EXTRACT.x; bz = EXTRACT.z; done = true; }
    if (i === 3 && !game.extract) { u.style.display = 'none'; return; }
    u.style.display = '';
    const b = bearingDeg(bx, bz);
    let rel = ((b - heading + 540) % 360) - 180;
    if (Math.abs(rel) > 62) { u.style.opacity = 0; return; }
    u.style.opacity = 1;
    const left = ((b + 360 * Math.round((heading - b) / 360)) + 60) * PPD;
    u.style.left = left + 'px';
    if (i < 3) u.classList.toggle('jm-mk-done', done);
  });
  // 目标列表:实时距离 + 当前目标高亮
  let curObj = -1;
  for (let i = 0; i < 3; i++) {
    const r = relays[i];
    const d = Math.hypot(r.x - player.pos.x, r.z - player.pos.z);
    const el = document.getElementById('jm-obj-dist-' + i);
    if (el) el.textContent = r.done ? '✓' : Math.round(d) + 'm';
    if (!r.done && curObj < 0) curObj = i;
  }
  for (let i = 0; i < 3; i++) {
    const el = $('jm-obj-' + i);
    if (el) el.classList.toggle('jm-current', i === curObj && !game.extract);
  }
}

/* 互动:切断中继 */
function updateInteract(dt) {
  const prompt = $('jm-prompt');
  let near = null, nd = 1e9;
  for (const r of relays) {
    if (r.done) continue;
    const d = Math.hypot(r.x - player.pos.x, r.z - player.pos.z);
    if (d < 3.4 && d < nd) { nd = d; near = r; }
  }
  const holding = keys.KeyE || touchUse;
  if (near) {
    prompt.hidden = false;
    $('jm-prompt-text').textContent = `切断${near.label.replace('中继', '')}中继`;
    if (holding) {
      near.progress += dt / 1.9;
      if (near.progress >= 1) completeRelay(near);
    } else near.progress = Math.max(0, near.progress - dt * 1.2);
    $('jm-prompt-fill').style.width = (near.progress * 100).toFixed(0) + '%';
  } else {
    prompt.hidden = true;
    for (const r of relays) if (!r.done) r.progress = Math.max(0, r.progress - dt * 1.2);
  }
  const useBtn = document.querySelector('.jm-tbtn-use');
  if (useBtn) useBtn.hidden = !near;
}
function completeRelay(r) {
  r.done = true;
  r.progress = 0;
  r.ring.material.color.setHex(0x52e09a);
  r.light.color.setHex(0x52e09a);
  r.strip.material.emissive.setHex(0x52e09a);
  AudioFX.zap(); AudioFX.objective();
  game.relaysDone++;
  game.reserve = Math.min(240, game.reserve + 30);
  updateAmmoHUD();
  const obj = $('jm-obj-' + r.idx);
  obj.classList.remove('jm-active'); obj.classList.add('jm-done');
  say('指挥中心', relayLines[r.idx], 4.4);
  if (game.relaysDone >= 3) {
    game.extract = true;
    AudioFX.horn();
    $('jm-obj-ext').hidden = false;
    beacon.visible = true;
    showTip('跟随罗盘上的绿色标记,前往四号泊位登船', 4);
  }
}

/* 主更新(子系统报错隔离:单个系统抛错不再拖垮整局) */
let damageAlpha = 0;
const safeErr = {};
function safe(name, fn) {
  try { fn(); } catch (e) {
    if (!safeErr[name]) { safeErr[name] = 1; console.error('[jimao:' + name + ']', e); }
  }
}
function update(dt) {
  game.elapsed += dt;
  game.remaining = MISSION_TIME - game.elapsed;
  // 开场字幕
  introEvents.forEach((ev, i) => {
    if (!game.introFired[i] && game.elapsed >= ev.t) {
      game.introFired[i] = true;
      say(ev.who, ev.text, 4.6);
    }
  });
  if (!game.warn60 && game.remaining <= 60) {
    game.warn60 = true;
    say('指挥中心', '还剩一分钟,泊区封锁即将完成——快!', 3.5);
    AudioFX.warn();
  }
  if (game.remaining <= 0) {
    lose(LOSE_TIMEOUT_TEXT);
    return;
  }
  safe('player', () => updatePlayer(dt));
  safe('camera', () => updateCamera(dt));
  safe('gun', () => updateGun(dt));
  safe('fire', () => {
    const wantFire = firing || touchFire;
    const W = WEAPONS[curWeapon];
    if (wantFire && (W.auto || !prevFiring) && switchT < 0) shoot();
    if (!wantFire) spreadVis = lerp(spreadVis, .011 + (1 - adsT) * .013 + player.moveFactor * .02, Math.min(1, dt * 6));
    prevFiring = wantFire;
  });
  safe('enemies', () => { for (const e of enemies) e.update(dt); });
  safe('fx', () => { updateEffects(dt); updateDecals(dt); updateRain(dt); });
  safe('interact', () => updateInteract(dt));
  safe('ui', () => { updateSub(dt); updateTip(dt); updateCompass(); });
  // 灯光呼吸 / 火焰 / 信标
  const t = game.elapsed;
  for (let i = 0; i < fireFlames.length; i++) {
    const f = fireFlames[i];
    f.flame.scale.set(1.4 + Math.sin(t * 9 + i * 2) * .18, 1.9 + Math.sin(t * 12 + i) * .3, 1);
    f.pl.intensity = 16 + Math.sin(t * 11 + i * 3) * 5;
  }
  for (const r of relays) {
    if (!r.done) {
      const s = 1 + Math.sin(t * 2.4 + r.idx) * .14;
      r.ring.scale.setScalar(s);
      r.light.intensity = 5 + Math.sin(t * 3 + r.idx) * 2;
    } else r.ring.scale.setScalar(1);
  }
  if (beacon.visible) {
    beacon.getObjectByProperty('type', 'Sprite').scale.setScalar(4 + Math.sin(t * 3) * .8);
    beaconLight.intensity = 20 + Math.sin(t * 3) * 7;
  }
  if (navLight) navLight.material.opacity = (Math.sin(t * 2.2) > .3) ? 1 : .12;
  // 受伤红晕
  const hurtRecent = clamp(1 - (game.elapsed - game.lastHurt) / 1.1, 0, 1);
  const lowHp = game.hp < 32 ? .3 + Math.sin(t * 5) * .12 : 0;
  damageAlpha = lerp(damageAlpha, Math.max(hurtRecent * .85, lowHp), Math.min(1, dt * 6));
  $('jm-damage').style.opacity = damageAlpha.toFixed(3);
  // 计时
  const timerEl = $('jm-timer');
  const txt = fmtTime(game.remaining);
  if (timerEl.textContent !== txt) timerEl.textContent = txt;
  timerEl.classList.toggle('jm-timer-warn', game.remaining <= 60);
  // 撤离判定
  if (game.extract && player.pos.distanceTo(EXTRACT) < 4.2) win();
}

/* ============================================================
   输入
   ============================================================ */
const stickVec = { x: 0, y: 0 };
function bindInput() {
  // 触摸守卫:触屏操作后浏览器会补发模拟 mouse 事件,700ms 内全部忽略,
  // 否则点触屏按钮会被当成"全局开火"(切枪/换弹被幻影射击吞掉的根因)
  let touchGuardUntil = 0;
  const guardTouch = () => { touchGuardUntil = performance.now() + 700; };
  window.addEventListener('touchstart', guardTouch, true);
  window.addEventListener('touchend', guardTouch, true);
  window.addEventListener('touchmove', guardTouch, true);
  window.addEventListener('keydown', e => {
    if (phase.cur !== 'playing' && phase.cur !== 'paused') return;
    keys[e.code] = true;
    if (phase.cur === 'playing') {
      if (e.code === 'Space') { e.preventDefault(); touchJumpQueued = true; }
      if (e.code === 'KeyR') startReload();
      if (e.code === 'ArrowLeft') { e.preventDefault(); kbLeft = true; }
      if (e.code === 'ArrowRight') { e.preventDefault(); kbRight = true; }
      if (e.code === 'ArrowUp') { e.preventDefault(); kbUp = true; }
      if (e.code === 'ArrowDown') { e.preventDefault(); kbDown = true; }
      if (e.code === 'KeyQ' || e.code === 'Digit2') switchWeapon(curWeapon === 'rifle' ? 'pistol' : 'rifle');
      if (e.code === 'Digit1') switchWeapon('rifle');
      if (e.code === 'Escape' && !IS_TOUCH && !document.pointerLockElement) pauseGame();
    }
    if (e.code === 'Escape' && phase.cur === 'paused') resumeGame();
  });
  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'ArrowLeft') kbLeft = false;
    if (e.code === 'ArrowRight') kbRight = false;
    if (e.code === 'ArrowUp') kbUp = false;
    if (e.code === 'ArrowDown') kbDown = false;
  });

  stage.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => {
    if (phase.cur !== 'playing') return;
    if (performance.now() < touchGuardUntil) return;
    const dragLook = noLockMode && (e.buttons & 2) !== 0;
    if (!document.pointerLockElement && !dragLook) return;
    const s = .0021 * settings.sens * (adsT > .5 ? .62 : 1);
    player.yaw -= e.movementX * s;
    player.pitch = clamp(player.pitch - e.movementY * s, -1.45, 1.45);
  });
  document.addEventListener('mousedown', e => {
    if (phase.cur !== 'playing') return;
    if (performance.now() < touchGuardUntil) return; // 触屏按钮操作后的模拟鼠标不触发射击
    // 触屏笔记本同样走鼠标路径;指针锁定改为"附带尝试"——按下永远计入开火,
    // 不再被锁定流程拦截(修复:锁定挂起/失败的环境里第一击无效 → 开不了火)
    if (!document.pointerLockElement && !noLockMode) lockPointer();
    if (e.button === 0) firing = true;
    if (e.button === 2) adsHold = true;
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) firing = false;
    if (e.button === 2) adsHold = false;
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && phase.cur === 'playing' && !IS_TOUCH) pauseGame();
  });
  renderer.domElement.addEventListener('click', () => {
    if (phase.cur === 'playing' && !document.pointerLockElement && performance.now() >= touchGuardUntil) lockPointer();
  });

  /* 触屏(常驻绑定:手机 / 触屏本 / 窄窗口通用,桌面鼠标互不干扰) */
  {
    let stickId = null, lookId = null, lookLast = null;
    const stickEl = $('jm-stick'), knob = $('jm-stick-knob');
    const zone = { x: 0, y: 0 };
    stage.addEventListener('touchstart', e => {
      if (phase.cur !== 'playing') return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.target.closest('.jm-tbtn') || t.target.closest('a')) continue;
        const r = stage.getBoundingClientRect();
        const lx = t.clientX - r.left, ly = t.clientY - r.top;
        if (stickId === null && lx < r.width * .42 && ly > r.height * .2) {
          stickId = t.identifier;
          zone.x = lx; zone.y = ly;
          stickEl.style.left = (lx - 52) + 'px';
          stickEl.style.bottom = 'auto';
          stickEl.style.top = (ly - 52) + 'px';
        } else if (lookId === null) {
          lookId = t.identifier;
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });
    stage.addEventListener('touchmove', e => {
      if (phase.cur !== 'playing') return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const r = stage.getBoundingClientRect();
          let dx = (t.clientX - r.left) - zone.x, dy = (t.clientY - r.top) - zone.y;
          const d = Math.hypot(dx, dy);
          if (d > 46) { dx *= 46 / d; dy *= 46 / d; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          stickVec.x = dx / 46; stickVec.y = dy / 46;
        } else if (t.identifier === lookId && lookLast) {
          const s = .0042 * settings.sens;
          player.yaw -= (t.clientX - lookLast.x) * s;
          player.pitch = clamp(player.pitch - (t.clientY - lookLast.y) * s, -1.45, 1.45);
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });
    const endTouch = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; stickVec.x = 0; stickVec.y = 0;
          knob.style.transform = 'translate(0,0)';
          const st = $('jm-stick');
          st.style.left = '74px'; st.style.top = 'auto'; st.style.bottom = '84px';
        }
        if (t.identifier === lookId) { lookId = null; lookLast = null; }
      }
    };
    stage.addEventListener('touchend', endTouch);
    stage.addEventListener('touchcancel', endTouch);

    document.querySelectorAll('.jm-tbtn[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      const isPause = act === 'pause';
      btn.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        if (isPause) { if (phase.cur === 'playing') pauseGame(); return; }
        if (act === 'fire') touchFire = true;
        if (act === 'ads') { touchAds = !touchAds; btn.classList.toggle('jm-on', touchAds); }
        if (act === 'reload') startReload();
        if (act === 'swap') switchWeapon(curWeapon === 'rifle' ? 'pistol' : 'rifle');
        if (act === 'jump') touchJumpQueued = true;
        if (act === 'crouch') { touchCrouch = !touchCrouch; btn.classList.toggle('jm-on', touchCrouch); }
        if (act === 'use') touchUse = true;
        if (phase.cur === 'playing') AudioFX.resume();
      }, { passive: false });
      btn.addEventListener('touchend', e => {
        e.preventDefault();
        if (act === 'fire') touchFire = false;
        if (act === 'use') touchUse = false;
      }, { passive: false });
    });
  }
}
function lockPointer() {
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {
      noLockMode = true;
      if (phase.cur === 'playing') showTip('当前环境不支持锁定鼠标:按住右键拖动转视角,左键开火', 5);
    });
    // 兜底:某些环境请求静默挂起(既不锁定也不报错),800ms 后仍无锁定即降级
    setTimeout(() => {
      if (phase.cur === 'playing' && !document.pointerLockElement && !noLockMode) {
        noLockMode = true;
        showTip('当前环境不支持锁定鼠标:按住右键拖动转视角,左键开火', 5);
      }
    }, 800);
  } catch (e) { noLockMode = true; }
}
document.addEventListener('pointerlockerror', () => {
  noLockMode = true;
  if (phase.cur === 'playing') showTip('当前环境不支持锁定鼠标:按住右键拖动转视角,左键开火', 5);
});

/* ============================================================
   流程控制
   ============================================================ */
function setPhase(p) {
  phase.cur = p;
  stage.classList.toggle('jm-playing', p === 'playing');
  stage.scrollTop = 0; stage.scrollLeft = 0; // 防御:内部滚动容器归零
  stage.classList.toggle('jm-menu-open', p === 'menu' || p === 'loading');
  if (gun) gun.visible = (p === 'playing' || p === 'paused') && curWeapon === 'rifle';
  if (gunPistol) gunPistol.visible = (p === 'playing' || p === 'paused') && curWeapon === 'pistol';
}
function startGame() {
  AudioFX.init(); AudioFX.resume();
  resetGame();
  const menuEl = $('jm-menu');
  menuEl.classList.add('jm-exit');
  setTimeout(() => { menuEl.hidden = true; menuEl.classList.remove('jm-exit'); }, 400);
  $('jm-pause').hidden = true;
  $('jm-result').hidden = true;
  $('jm-hud').hidden = false;
  if (IS_TOUCH || innerWidth < 700) $('jm-touch').hidden = false; // 窄屏窗口也给出触屏按钮
  AudioFX.ambStart();
  setPhase('playing');
  lockPointer(); // 纯平板上会失败 → noLockMode 降级,不影响触屏操作
}
function resetGame() {
  game.elapsed = 0; game.remaining = MISSION_TIME;
  game.hp = 100; game.lastHurt = -99;
  game.mag = 30; game.reserve = 150;
  game.kills = 0; game.shots = 0; game.hits = 0;
  game.relaysDone = 0; game.extract = false; game.firstContact = false;
  game.introFired = [false, false, false, false];
  game.warn60 = false; game.tipReload = false;
  player.pos.set(-66, 0, 54); player.vy = 0; player.grounded = true;
  player.yaw = 0; player.pitch = 0; player.dead = false;
  player.eyeH = 1.66; player.moveFactor = 0;
  firing = false; adsHold = false; adsT = 0; touchAds = false; touchFire = false; touchUse = false; touchCrouch = false;
  recoilPitch = 0; recoilHeat = 0; gunKick = 0; spreadVis = .012;
  reloading = false; reloadT = 0; dryPlayed = false; autoReloadT = -1;
  curWeapon = 'rifle'; prevFiring = false; switchT = -1;
  WEAPONS.rifle.mag = 30; WEAPONS.rifle.reserve = 150;
  WEAPONS.pistol.mag = 12; WEAPONS.pistol.reserve = 36;
  if (gunPistol) gunPistol.visible = false;
  diff = DIFFS[settings.difficulty] || DIFFS.normal;
  subQ.length = 0; subShowing = false; subT = 0;
  $('jm-sub').classList.remove('jm-show');
  $('jm-tip').hidden = true; tipT = 0;
  $('jm-obj-ext').hidden = true;
  beacon.visible = false;
  relays.forEach(r => {
    r.done = false; r.progress = 0;
    r.ring.material.color.setHex(0x36e0ff);
    r.light.color.setHex(0x36e0ff);
    r.strip.material.emissive.setHex(0x36e0ff);
    const obj = $('jm-obj-' + r.idx);
    obj.classList.remove('jm-done', 'jm-active');
  });
  $('jm-obj-0').classList.add('jm-active');
  enemies.forEach(e => e.reset());
  $('jm-timer').textContent = fmtTime(MISSION_TIME);
  $('jm-timer').classList.remove('jm-timer-warn');
  updateAmmoHUD(); updateHealthHUD();
  $('jm-prompt').hidden = true;
  damageAlpha = 0; $('jm-damage').style.opacity = 0;
  const touchUseBtn = document.querySelector('.jm-tbtn-use');
  if (touchUseBtn) touchUseBtn.hidden = true;
}
function pauseGame() {
  if (phase.cur !== 'playing') return;
  setPhase('paused');
  $('jm-pause').hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
  AudioFX.ambStop();
}
function resumeGame() {
  if (phase.cur !== 'paused') return;
  $('jm-pause').hidden = true;
  $('jm-modal').hidden = true;
  AudioFX.ambStart(); AudioFX.resume();
  setPhase('playing');
  if (!IS_TOUCH) lockPointer();
}
function win() {
  if (phase.cur !== 'playing') return;
  setPhase('win');
  if (document.pointerLockElement) document.exitPointerLock();
  AudioFX.ambStop(); AudioFX.win();
  $('jm-hud').hidden = true;
  $('jm-touch').hidden = true;
  const title = $('jm-result-title');
  title.textContent = '任务完成 · 撤离成功';
  title.classList.remove('jm-bad');
  $('jm-result-desc').textContent = WIN_TEXT;
  const acc = game.shots ? Math.round(game.hits / game.shots * 100) : 0;
  $('jm-result-stats').innerHTML =
    `<div><span>行动用时</span><b>${fmtTime(game.elapsed)}</b></div>` +
    `<div><span>击倒敌人</span><b>${game.kills} / ${enemies.length}</b></div>` +
    `<div><span>命中率</span><b>${acc}%</b></div>` +
    `<div><span>剩余生命</span><b>${Math.round(game.hp)}</b></div>`;
  $('jm-result').hidden = false;
  try {
    const best = JSON.parse(localStorage.getItem('jm-best') || 'null');
    if (!best || game.elapsed < best.t) localStorage.setItem('jm-best', JSON.stringify({ t: game.elapsed, k: game.kills }));
  } catch (e) { }
}
function lose(desc) {
  if (phase.cur !== 'playing') return;
  setPhase('lose');
  player.dead = true;
  if (document.pointerLockElement) document.exitPointerLock();
  AudioFX.ambStop(); AudioFX.lose();
  $('jm-hud').hidden = true;
  $('jm-touch').hidden = true;
  const title = $('jm-result-title');
  title.textContent = '任务失败';
  title.classList.add('jm-bad');
  $('jm-result-desc').textContent = desc;
  $('jm-result-stats').innerHTML =
    `<div><span>坚持时间</span><b>${fmtTime(game.elapsed)}</b></div>` +
    `<div><span>击倒敌人</span><b>${game.kills} / ${enemies.length}</b></div>`;
  $('jm-result').hidden = false;
}

/* 弹窗 */
function openModal(title, html) {
  $('jm-modal-title').textContent = title;
  $('jm-modal-body').innerHTML = html;
  $('jm-modal').hidden = false;
  AudioFX.ui();
}
function closeModal() { $('jm-modal').hidden = true; }
function settingsHTML() {
  return `
    <div class="jm-set-row"><label>鼠标 / 视角灵敏度</label><input type="range" id="jm-set-sens" min="0.4" max="2" step="0.05" value="${settings.sens}"><b id="jm-set-sens-v">${Number(settings.sens).toFixed(2)}</b></div>
    <div class="jm-set-row"><label>音量</label><input type="range" id="jm-set-vol" min="0" max="1" step="0.05" value="${settings.vol}"><b id="jm-set-vol-v">${Number(settings.vol).toFixed(2)}</b></div>
    <div class="jm-set-row"><label>难度</label><select id="jm-set-diff">
      <option value="easy"${settings.difficulty === 'easy' ? ' selected' : ''}>简单(侦察渗入)</option>
      <option value="normal"${settings.difficulty === 'normal' ? ' selected' : ''}>普通</option>
      <option value="hard"${settings.difficulty === 'hard' ? ' selected' : ''}>困难(锈锚精锐)</option>
    </select></div>
    <div class="jm-set-row"><label>画质</label><select id="jm-set-q">
      <option value="high"${settings.quality === 'high' ? ' selected' : ''}>高(阴影 + 全特效)</option>
      <option value="mid"${settings.quality === 'mid' ? ' selected' : ''}>中</option>
      <option value="low"${settings.quality === 'low' ? ' selected' : ''}>低(流畅优先)</option>
    </select></div>
    <p style="font-size:12px;color:#6d757e;margin-top:10px;">设置即时生效并保存在本地浏览器。</p>`;
}
function bindSettings() {
  const sens = $('jm-set-sens'), vol = $('jm-set-vol'), q = $('jm-set-q'), df = $('jm-set-diff');
  if (!sens) return;
  sens.addEventListener('input', () => { settings.sens = +sens.value; $('jm-set-sens-v').textContent = settings.sens.toFixed(2); saveSettings(); });
  vol.addEventListener('input', () => { settings.vol = +vol.value; $('jm-set-vol-v').textContent = settings.vol.toFixed(2); AudioFX.setVol(settings.vol); saveSettings(); });
  q.addEventListener('change', () => { settings.quality = q.value; saveSettings(); applyQuality(); });
  if (df) df.addEventListener('change', () => { settings.difficulty = df.value; diff = DIFFS[settings.difficulty] || DIFFS.normal; saveSettings(); });
}
function bindUI() {
  $('jm-btn-start').addEventListener('click', () => { AudioFX.init(); AudioFX.ui(); startGame(); });
  $('jm-btn-again').addEventListener('click', () => { AudioFX.ui(); startGame(); });
  $('jm-btn-resume').addEventListener('click', () => { AudioFX.ui(); resumeGame(); });
  $('jm-btn-restart').addEventListener('click', () => { AudioFX.ui(); startGame(); });
  $('jm-btn-help').addEventListener('click', () => openModal('操作说明', `
    <h3>移动</h3><b>W A S D</b> 移动 · <b>SHIFT</b> 冲刺 · <b>SPACE</b> 跳跃 · <b>C</b> 蹲伏(蹲伏更难被察觉)
    <h3>备用通道</h3><b>← → ↑ ↓</b> 转动视角(鼠标异常时可用)
    <h3>战斗</h3><b>左键</b> 开火(全自动) · <b>右键</b> 全息瞄准 · <b>R</b> 换弹 · 爆头一枪倒地
    <h3>任务</h3>走近中继装置,按住 <b>E</b> 约 2 秒切断;切断全部三处后,前往四号泊位登船撤离。
    <h3>提示</h3>枪声会惊动 45 米内的巡逻兵;利用集装箱转角和仓库掩体周旋;05:42 内完成全部任务。`));
  $('jm-btn-about').addEventListener('click', () => openModal('项目介绍', `
    <h3>几猫港区 Jimao Port</h3>
    一个跑在浏览器里的第一人称射击任务关卡:雨夜、逆光、集装箱迷宫、龙门吊与货轮。
    <h3>技术</h3>Three.js r152 渲染,全部贴图(集装箱、路面、雨、枪口焰)与音效(WebAudio 合成)均由代码实时生成,零外部资源、零联网、开箱即玩。
    <h3>致意</h3>玩法概念致敬小红书 @7Hui 的「几猫」网页 FPS 演示视频——本页面为独立复刻练习,与原作者无关。「3A大作」是个玩笑,摸鱼要适度。`));
  $('jm-btn-settings').addEventListener('click', () => { openModal('设置', settingsHTML()); bindSettings(); });
  $('jm-btn-psettings').addEventListener('click', () => { openModal('设置', settingsHTML()); bindSettings(); });
  $('jm-modal-close').addEventListener('click', closeModal);
  document.addEventListener('visibilitychange', () => { if (document.hidden && phase.cur === 'playing') pauseGame(); });
  window.addEventListener('resize', onResize);
}
function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ============================================================
   画质
   ============================================================ */
function applyQuality() {
  const q = settings.quality;
  const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.75 : q === 'mid' ? 1.4 : 1.1);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = q !== 'low';
  sun.shadow.mapSize.setScalar(q === 'high' ? 2048 : q === 'mid' ? 1024 : 512);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  // 双层雨:低画质只留近层
  if (rainLayers.length) {
    rainLayers[0].lines.visible = q !== 'low';
    if (rainLayers[1]) rainLayers[1].lines.visible = q !== 'low';
  }
  // 平面反射:高/中开启,低画质降级为光泽材质
  const useRefl = q !== 'low' && !!reflRT;
  reflEnabled = useRefl;
  puddleMeshes.forEach(m => { m.material = useRefl ? reflMatPuddle : puddleFallbackMat; });
  if (seaMesh) seaMesh.material = useRefl ? reflMatSea : seaFallbackMat;
  if (q === 'low' && lampLights.length) {
    lampLights.forEach((l, i) => { l.visible = i % 2 === 0; });
  } else lampLights.forEach(l => { l.visible = true; });
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  onResize();
}

/* ============================================================
   加载 & 主循环
   ============================================================ */
function setLoading(pct, msg) {
  $('jm-loading-fill').style.width = pct + '%';
  if (msg) $('jm-loading-sub').textContent = msg;
}

/* 菜单运镜:贴地穿行堆场巷道(attract mode) */
const MENU_PATH = [
  { p: [-64, 1.8, 48], l: [-38, 1.9, 44] },
  { p: [-40, 1.8, 44], l: [-27, 1.8, 16] },
  { p: [-27, 1.8, 15], l: [-36, 1.7, -6] },
  { p: [-36, 1.7, -6], l: [-70, 1.8, -6] },
  { p: [-70, 1.8, -6], l: [-70, 1.8, -16] },
  { p: [-70, 1.8, -16], l: [-70, 1.8, 28] },
  { p: [-70, 1.8, 28], l: [-64, 1.8, 48] },
];
let menuT = 0;
function menuCamera(dt) {
  menuT += dt * .3;
  const n = MENU_PATH.length;
  const f = menuT % n;
  const i = Math.floor(f), t = ss(0, 1, f - i);
  const a = MENU_PATH[i], b = MENU_PATH[(i + 1) % n];
  camera.position.set(
    lerp(a.p[0], b.p[0], t),
    lerp(a.p[1], b.p[1], t) + Math.sin(menuT * 7) * .02,
    lerp(a.p[2], b.p[2], t)
  );
  _v1.set(lerp(a.l[0], b.l[0], t), lerp(a.l[1], b.l[1], t), lerp(a.l[2], b.l[2], t));
  camera.lookAt(_v1);
}

let lastT = performance.now();
let nowSec = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (t - lastT) / 1000);
  lastT = t;
  nowSec = t / 1000;
  if (phase.cur === 'playing') update(dt);
  else if (phase.cur === 'menu' || phase.cur === 'loading') {
    menuCamera(dt);
    updateRain(dt);
    const tt = nowSec;
    fireFlames.forEach((f, i) => {
      f.flame.scale.set(1.4 + Math.sin(tt * 9 + i * 2) * .18, 1.9 + Math.sin(tt * 12 + i) * .3, 1);
      f.pl.intensity = 16 + Math.sin(tt * 11 + i * 3) * 5;
    });
    if (navLight) navLight.material.opacity = (Math.sin(tt * 2.2) > .3) ? 1 : .12;
    for (const r of relays) {
      const s = 1 + Math.sin(tt * 2.4 + r.idx) * .14;
      r.ring.scale.setScalar(s);
    }
  }
  updateMist(dt);
  updateReflector();
  renderer.render(scene, camera);
}

async function boot() {
  try {
    // 主题祖先若带 transform/filter,position:fixed 会退化为相对定位 → 逐个清除
    let anc = stage.parentElement;
    while (anc && anc !== document.body) {
      const cs = getComputedStyle(anc);
      if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || (cs.willChange || '').includes('transform') || (cs.contain || '').includes('paint')) {
        anc.style.transform = 'none';
        anc.style.filter = 'none';
        anc.style.willChange = 'auto';
        anc.style.contain = 'none';
      }
      anc = anc.parentElement;
    }
    setLoading(4, '正在准备脊峰画面');
    const t0 = performance.now();
    matContainer = new THREE.MeshStandardMaterial({ map: texContainer(), roughness: .82, metalness: .12 });
    matConcrete = new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: .95 });
    matWood = new THREE.MeshStandardMaterial({ color: 0x6b543a, roughness: .9 });
    matDark = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: .7, metalness: .2 });
    matSteel = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: .65, metalness: .35 });
    matYellow = new THREE.MeshStandardMaterial({ color: 0xc7902e, roughness: .6 });
    // 全同步构建:不依赖任何定时器/rAF,后台标签被强节流也不会卡死
    buildReflector();
    buildGround(); setLoading(16, '正在浇湿港区地面');
    buildContainers(); setLoading(34, '正在堆放集装箱');
    buildWarehouse(); setLoading(46, '正在给仓库拉闸');
    buildCrane(-16, -69); buildCrane(45, -62); buildShip(); setLoading(56, '正在唤醒龙门吊与货轮');
    buildProps(); buildClutter(); buildMist(); setLoading(68, '正在点亮码头路灯');
    buildRelays(); buildBeacon(); setLoading(76, '正在部署三处中继');
    buildEnemies(); setLoading(84, '正在安排巡逻兵摸鱼');
    buildGun(); buildPistol(); buildEffects(); buildDecals(); buildRain(); setLoading(92, '正在给弹匣压入子弹');
    buildCompass(); bindUI(); bindInput(); applyQuality(); setLoading(98, '正在校准全息瞄具');
    setLoading(100, '行动准备完毕');
    const wait = Math.max(0, 1400 - (performance.now() - t0));
    await new Promise(r => setTimeout(r, wait + 30));
    $('jm-loading').classList.add('jm-hide');
    setTimeout(() => { $('jm-loading').hidden = true; }, 700);
    setPhase('menu');
    $('jm-menu').hidden = false;
    const best = JSON.parse(localStorage.getItem('jm-best') || 'null');
    if (best) {
      $('jm-menu-best').hidden = false;
      $('jm-menu-best').textContent = `最佳战绩 ${fmtTime(best.t)} · 击倒 ${best.k}`;
    }
    lastT = performance.now();
    requestAnimationFrame(loop);
  } catch (err) {
    $('jm-loading-sub').textContent = '初始化失败:' + ((err && err.message) || err);
    console.error(err);
  }
}
boot().catch(err => {
  $('jm-loading-sub').textContent = '初始化失败:' + ((err && err.message) || err);
  console.error(err);
});

/* 供自动化测试与调参使用 */
window.__jm = {
  game, player, enemies, relays, keys, shoot, startReload, settings, EXTRACT, decals,
  setADS(on) { adsHold = !!on; },
  tick(dt = .016) { update(dt); updateReflector(); renderer.render(scene, camera); },
  probe(nx, ny) {
    const r2 = new THREE.Raycaster();
    r2.camera = camera;
    r2.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hits = r2.intersectObjects([worldGroup, enemyRoot], true);
    return hits.slice(0, 3).map(h => ({
      dist: +h.distance.toFixed(1),
      pos: h.point.toArray().map(v => +v.toFixed(1)),
      type: h.object.type,
      instanced: !!h.object.isInstancedMesh,
      mat: h.object.material && h.object.material.type,
    }));
  },
  readPixel(pageX, pageY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const px = Math.floor((pageX - rect.left) * renderer.getPixelRatio());
    const py = Math.floor(rect.height * renderer.getPixelRatio() - (pageY - rect.top) * renderer.getPixelRatio());
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const buf = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return [...buf];
  },
  scene, renderer, camera,
  layoutCheck() {
    const sels = {
      compass: '.jm-compass', objectives: '.jm-objectives', pauseBtn: '.jm-tbtn-pause',
      sub: '.jm-sub', stick: '.jm-stick', fire: '.jm-tbtn-fire', ads: '[data-act="ads"]',
      reload: '[data-act="reload"]', swap: '[data-act="swap"]', jump: '[data-act="jump"]',
      crouch: '[data-act="crouch"]', use: '.jm-tbtn-use', health: '.jm-health', ammo: '.jm-ammo',
    };
    const boxes = {};
    for (const [k, sel] of Object.entries(sels)) {
      const el = document.querySelector(sel);
      if (!el) { boxes[k] = null; continue; }
      const r = el.getBoundingClientRect();
      boxes[k] = { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) };
    }
    // 成对交叠检测(可见的都查)
    const names = Object.keys(boxes).filter(k => boxes[k] && boxes[k].r > boxes[k].x && boxes[k].b > boxes[k].y);
    const overlaps = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = boxes[names[i]], b = boxes[names[j]];
      const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (ox > 4 && oy > 4) overlaps.push(names[i] + '×' + names[j] + ` (${Math.round(ox)}x${Math.round(oy)})`);
    }
    // 按钮点击区 ≥44×44
    const smallBtns = ['fire', 'ads', 'reload', 'swap', 'jump', 'crouch', 'pauseBtn'].filter(k => boxes[k] && boxes[k].r - boxes[k].x > 2 && (boxes[k].r - boxes[k].x < 44 || boxes[k].b - boxes[k].y < 44));
    const stEl = document.getElementById('jm-stage');
    const stR = stEl.getBoundingClientRect();
    const stageScroll = { top: stEl.scrollTop, left: stEl.scrollLeft };
    // 内部滚动会把子元素 rect 顶出可视区:安全判定计入滚动偏移
    const clippedByScroll = stageScroll.top > 1 || stageScroll.left > 1;
    return {
      stage: { x: Math.round(stR.left), y: Math.round(stR.top), w: Math.round(stR.width), h: Math.round(stR.height) },
      stageScroll,
      scrollHeight: document.documentElement.scrollHeight,
      viewport: [innerWidth, innerHeight],
      overlaps,
      smallBtns,
      inSafeArea: !clippedByScroll && Object.values(boxes).filter(Boolean).every(b => b.x >= 0 && b.y >= 0 && b.r <= innerWidth + 1 && b.b <= innerHeight + 40),
    };
  },
  dbg() { return { phase: phase.cur, elapsed: +game.elapsed.toFixed(2), firing, noLockMode, locked: !!document.pointerLockElement, reloading, curWeapon, mag: game.mag, lastShot: +lastShot.toFixed(2) }; },
  perf() { const i = renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geo: i.memory.geometries, tex: i.memory.textures }; },
  lights() {
    const L = [];
    scene.traverse(o => { if (o.isLight) L.push({ type: o.type, i: +o.intensity.toFixed(1), color: o.color.getHexString(), pos: o.position.toArray().map(v => +v.toFixed(1)), vis: o.visible }); });
    return L;
  },
  seaInfo() {
    return {
      reflEnabled, quality: settings.quality,
      seaMatType: seaMesh && seaMesh.material.type,
      uReflK: seaMesh && seaMesh.material.uniforms ? seaMesh.material.uniforms.uReflK.value : null,
    };
  },
};
