/* ============================================================
 * 星航线 · 3D 地球(Three.js)
 * 深蓝数字地球:陆地点阵 + 国界线 + 浙江中枢飞线 + 城市标签
 * + 土星式粒子光环 + 星海。拖动旋转 / 滚轮缩放 / 闲置自转。
 * 数据:earth-data.js(Natural Earth 110m 预采样,公有领域)
 * ============================================================ */
(() => {
  'use strict';

  const stage = document.getElementById('earth-stage');
  if (!stage) return;
  const loading = stage.querySelector('.earth-loading');
  const errorBox = stage.querySelector('.earth-error');

  if (!window.THREE || !window.EARTH_DATA) {
    if (loading) loading.style.display = 'none';
    if (errorBox) errorBox.style.display = 'flex';
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    if (loading) loading.style.display = 'none';
    if (errorBox) errorBox.style.display = 'flex';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const DEG = Math.PI / 180;

  // ---------- 经纬度 -> 三维坐标(全场景统一映射) ----------
  const ll2v = (lon, lat, r) => {
    const phi = (90 - lat) * DEG;
    const theta = (lon + 180) * DEG;
    const s = Math.sin(phi);
    return new THREE.Vector3(-r * s * Math.cos(theta), r * Math.cos(phi), r * s * Math.sin(theta));
  };

  // ---------- 组层级:tilt(俯仰) > spin(自转/拖拽) > 地球一切 ----------
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);

  // ---------- 程序化贴图(光晕/圆点) ----------
  const glowTexture = (inner, outer) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.4, outer);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };
  const TEX_WHITE = glowTexture('rgba(255,255,255,1)', 'rgba(150,205,255,.55)');
  const TEX_GOLD = glowTexture('rgba(255,236,180,1)', 'rgba(255,180,70,.5)');
  const TEX_CYAN = glowTexture('rgba(210,238,255,1)', 'rgba(90,170,255,.45)');

  // ---------- 星海 ----------
  {
    const N = 1400;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // 远天球壳上均匀撒点
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = 26 + Math.random() * 16;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(t);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(t);
      const b = 0.35 + Math.random() * 0.65;
      col[i * 3] = b * (0.85 + Math.random() * 0.15);
      col[i * 3 + 1] = b * 0.92;
      col[i * 3 + 2] = b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.55, sizeAttenuation: true, vertexColors: true,
      map: TEX_WHITE, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    stars.name = 'stars';
    scene.add(stars);
  }

  // ---------- 地球本体:深海军蓝 + 边缘泛光(着色器) ----------
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      cBase: { value: new THREE.Color('#050f22') },
      cRim: { value: new THREE.Color('#1c4d85') },
    },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 cBase; uniform vec3 cRim;
      varying vec3 vN;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vec3(0.0, 0.0, 1.0))), 2.4);
        gl_FragColor = vec4(mix(cBase, cRim, f), 1.0);
      }`,
  });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat));

  // ---------- 大气辉光(背面壳) ----------
  {
    const mat = new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color('#3f86ff') } },
      vertexShader: `
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 c; varying vec3 vN;
        void main() {
          float i = pow(0.62 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.2);
          gl_FragColor = vec4(c, 1.0) * i;
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(1.16, 48, 48), mat));
  }

  // ---------- 陆地点阵 ----------
  {
    const dots = EARTH_DATA.dots;
    const pos = new Float32Array(dots.length * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < dots.length; i++) {
      v.copy(ll2v(dots[i][0], dots[i][1], 1.004));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    spin.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#5eb0ff', size: 0.0115, sizeAttenuation: true,
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  }

  // ---------- 国界线 ----------
  {
    const arcs = EARTH_DATA.arcs;
    let segCount = 0;
    for (const a of arcs) segCount += a.length / 2 - 1;
    const pos = new Float32Array(segCount * 6);
    let k = 0;
    const v = new THREE.Vector3();
    const put = (lon, lat) => {
      v.copy(ll2v(lon, lat, 1.002));
      pos[k++] = v.x; pos[k++] = v.y; pos[k++] = v.z;
    };
    for (const a of arcs) {
      for (let i = 0; i < a.length - 2; i += 2) {
        put(a[i], a[i + 1]); put(a[i + 2], a[i + 3]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    spin.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: '#6fc0ff', transparent: true, opacity: 0.26, depthWrite: false,
    })));
  }

  // ---------- 中枢(浙江)与城市 ----------
  const HUB = { name: '浙江', lon: 120.1, lat: 30.3 };
  const CITIES = [
    ['东京', 139.7, 35.7], ['首尔', 127.0, 37.5], ['新加坡', 103.8, 1.35], ['曼谷', 100.5, 13.75],
    ['新德里', 77.2, 28.6], ['莫斯科', 37.6, 55.75], ['巴黎', 2.35, 48.85], ['伦敦', -0.13, 51.5],
    ['迪拜', 55.3, 25.2], ['开罗', 31.2, 30.0], ['内罗毕', 36.8, -1.29], ['悉尼', 151.2, -33.87],
    ['纽约', -74.0, 40.7], ['洛杉矶', -118.2, 34.05], ['圣保罗', -46.6, -23.55], ['约翰内斯堡', 28.0, -26.2],
    ['乌兰巴托', 106.9, 47.9], ['雅加达', 106.8, -6.2], ['马尼拉', 121.0, 14.6], ['珀斯', 115.9, -32.0],
    ['苏瓦', 178.4, -18.1], ['安克雷奇', -149.9, 61.2],
  ];
  const LONG_HAUL = { '巴黎': 1, '伦敦': 1, '纽约': 1, '洛杉矶': 1, '圣保罗': 1, '约翰内斯堡': 1, '苏瓦': 1, '安克雷奇': 1, '莫斯科': 1 };
  const ORANGE = { '洛杉矶': 1, '圣保罗': 1, '苏瓦': 1, '安克雷奇': 1, '约翰内斯堡': 1, '巴黎': 1 };

  const hubV = ll2v(HUB.lon, HUB.lat, 1.006);
  const cityV = CITIES.map(c => ll2v(c[1], c[2], 1.006));

  // 飞线:二次贝塞尔,高度随角距
  const flights = [];
  CITIES.forEach((c, i) => {
    const a = hubV, b = cityV[i];
    const ang = a.angleTo(b);
    const mid = a.clone().add(b).normalize().multiplyScalar(1 + 0.16 + 0.42 * (ang / Math.PI));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(72);
    const pos = new Float32Array(pts.length * 3);
    pts.forEach((p, k) => { pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const orange = ORANGE[c[0]];
    spin.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: orange ? '#ffb36b' : '#7fd0ff',
      transparent: true, opacity: orange ? 0.34 : 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    // 脉冲光点沿线巡航
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: orange ? TEX_GOLD : TEX_WHITE, color: orange ? '#ffcf8f' : '#eaf6ff',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.setScalar(orange ? 0.075 : 0.055);
    spin.add(sprite);
    flights.push({
      curve, sprite,
      speed: 0.05 + Math.random() * 0.06,
      phase: Math.random(),
      long: !!LONG_HAUL[c[0]],
    });
    // 城市端点光珠
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_CYAN, color: '#bfe0ff', transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
    }));
    dot.position.copy(cityV[i]);
    dot.scale.setScalar(0.032);
    spin.add(dot);
  });

  // 中枢:金色光核 + 双呼吸波纹
  {
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GOLD, color: '#ffe9b8', transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.position.copy(hubV);
    core.scale.setScalar(0.13);
    spin.add(core);
  }
  const pulses = [];
  {
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffcf7a', transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), mat);
      ring.position.copy(ll2v(HUB.lon, HUB.lat, 1.008));
      ring.lookAt(ring.position.clone().multiplyScalar(2)); // 贴着球面切平面
      spin.add(ring);
      pulses.push({ mesh: ring, phase: i * 0.5 });
    }
  }

  // ---------- 土星式粒子光环 + 卫星 ----------
  const ringGroup = new THREE.Group();
  ringGroup.rotation.set(-0.30, 0, -0.10);
  scene.add(ringGroup);
  {
    const mkCircle = (radius, opacity) => {
      const N = 160;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        pos[i * 3] = Math.cos(t) * radius;
        pos[i * 3 + 2] = Math.sin(t) * radius;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
        color: '#5f9bdc', transparent: true, opacity, depthWrite: false,
      }));
    };
    ringGroup.add(mkCircle(2.3, 0.34));
    ringGroup.add(mkCircle(2.62, 0.16));
    // 粒子带
    const N = 800;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 2.14 + Math.random() * 0.72;
      const t = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(t) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      pos[i * 3 + 2] = Math.sin(t) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const band = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#7fb2e8', size: 0.014, sizeAttenuation: true,
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    band.name = 'band';
    ringGroup.add(band);
  }
  const sats = [];
  {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX_WHITE, color: '#dceeff', transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
      }));
      s.scale.setScalar(0.05);
      ringGroup.add(s);
      sats.push({ sprite: s, r: 2.3 + Math.random() * 0.42, speed: 0.1 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ---------- HTML 标签层 ----------
  const labels = [];
  const addLabel = (text, isHub, anchorObj, localPos) => {
    const el = document.createElement('div');
    el.className = 'earth-label' + (isHub ? ' is-hub' : '');
    el.textContent = text;
    stage.appendChild(el);
    labels.push({ el, anchorObj, localPos });
  };
  addLabel(HUB.name, true, spin, hubV.clone());
  CITIES.forEach((c, i) => addLabel(c[0], false, spin, cityV[i].clone()));

  // ---------- 相机:初始对准浙江 ----------
  const camDir = hubV.clone().normalize();
  const camBase = camDir.clone().multiplyScalar(3.05).add(new THREE.Vector3(0, 1.02, 0)).normalize();
  let camDist = 3.55, camTarget = 3.55;
  const setCam = () => camera.position.copy(camBase).multiplyScalar(camDist);
  camera.position.copy(camBase).multiplyScalar(camDist);
  camera.lookAt(0, 0, 0);

  // ---------- 交互:拖拽 + 惯性 + 滚轮 ----------
  let dragging = false, lastX = 0, lastY = 0, velY = 0, lastTouch = 0;
  const onDown = e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; velY = 0;
    stage.classList.add('is-dragging');
    lastTouch = performance.now();
  };
  const onMove = e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    spin.rotation.y += dx * 0.005;
    tilt.rotation.x = Math.max(-0.7, Math.min(0.7, tilt.rotation.x + dy * 0.003));
    velY = dx * 0.005;
    lastTouch = performance.now();
  };
  const onUp = () => { dragging = false; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    camTarget = Math.max(1.9, Math.min(5.6, camTarget + e.deltaY * 0.0016));
    lastTouch = performance.now();
  }, { passive: false });
  stage.addEventListener('dblclick', () => { camTarget = 3.55; tilt.rotation.x = 0; });

  // ---------- 尺寸 ----------
  let W = 1, H = 1, lastW = 0, lastH = 0;
  const resize = () => {
    W = Math.max(1, stage.clientWidth);
    H = Math.max(1, stage.clientHeight);
    lastW = W; lastH = H;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
  };
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  // ---------- 主循环 ----------
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const wp = new THREE.Vector3();
  const proj = new THREE.Vector3();
  let firstFrame = true;

  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    // 尺寸自愈:主题布局/字体加载晚于首帧时跟上
    if (stage.clientWidth !== lastW || stage.clientHeight !== lastH) resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // 惯性 + 闲置自转
    if (!dragging) {
      spin.rotation.y += velY;
      velY *= 0.93;
      if (!reduced && performance.now() - lastTouch > 2600) spin.rotation.y += 0.05 * dt;
    }

    // 飞线脉冲
    for (const f of flights) {
      const k = (t * f.speed + f.phase) % 1;
      f.curve.getPoint(k, f.sprite.position);
      const fade = Math.sin(k * Math.PI);
      f.sprite.material.opacity = 0.35 + 0.65 * fade;
    }
    // 中枢呼吸波纹
    for (const p of pulses) {
      const k = (t * 0.5 + p.phase) % 1;
      const s = 0.03 + k * 0.3;
      p.mesh.scale.setScalar(s);
      p.mesh.material.opacity = 0.55 * (1 - k);
    }
    // 光环自转 + 卫星
    const band = ringGroup.getObjectByName('band');
    if (band) band.rotation.y = t * 0.03;
    for (const s of sats) {
      const a = t * s.speed + s.phase;
      s.sprite.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r);
    }

    // 相机推拉平滑
    camDist += (camTarget - camDist) * 0.12;
    setCam();

    // 标签投影
    for (const L of labels) {
      L.anchorObj.localToWorld(wp.copy(L.localPos));
      const facing = wp.clone().normalize().dot(camBase);
      proj.copy(wp).project(camera);
      const x = (proj.x * 0.5 + 0.5) * W;
      const y = (-proj.y * 0.5 + 0.5) * H;
      L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-140%)';
      const o = facing > 0.16 ? Math.min(1, (facing - 0.16) / 0.22) : 0;
      L.el.style.opacity = o.toFixed(2);
    }

    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      if (loading) loading.style.display = 'none';
    }
  };
  frame();
})();
