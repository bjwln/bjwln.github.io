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
  let starsObj = null;

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
    starsObj = stars;
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
  let dotsPts = null;
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
    dotsPts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#5eb0ff', size: 0.0115, sizeAttenuation: true,
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    spin.add(dotsPts);
  }

  // ---------- 国界线 ----------
  let bordersLines = null;
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
    bordersLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: '#6fc0ff', transparent: true, opacity: 0.26, depthWrite: false,
    }));
    spin.add(bordersLines);
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
  const arcsGroup = new THREE.Group();
  spin.add(arcsGroup);
  const barsGroup = new THREE.Group();
  spin.add(barsGroup);

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
    arcsGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
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
    arcsGroup.add(sprite);
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
    arcsGroup.add(dot);
    // 柱状图:城市上方的发光柱(默认关闭,顶部 chips 可开)
    const h = 0.035 + (((i * 7) % 13) / 13) * 0.075;
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.008, h, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: '#5da8e8', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    const n = cityV[i].clone().normalize();
    bar.position.copy(n).multiplyScalar(1 + h / 2);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    barsGroup.add(bar);
  });

  // 中枢:金色光核 + 双呼吸波纹(调弱,别抢景点视角的戏)
  let hubCore = null;
  {
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GOLD, color: '#ffe9b8', transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.position.copy(hubV);
    core.scale.setScalar(0.085);
    spin.add(core);
    hubCore = core;
  }
  const pulses = [];
  {
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffcf7a', transparent: true, opacity: 0.4,
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

  // ============================================================
  // 编号景点视角(致敬 [3]. 海岛 ・ IsLand ・ 小島 的交互式)
  // 在球面放置 5 个编号景点:点击数字,相机飞到该处放大,
  // 以"全息微缩景象"呈现该地样貌(灯塔/小船/沙滩/飞鸟/礁石)
  // ============================================================
  const holoMat = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opacity == null ? 0.85 : opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mk = (geo, color, opt) => {
    const m = new THREE.Mesh(geo, holoMat(color, opt && opt.o));
    if (opt) {
      if (opt.p) m.position.set(opt.p[0], opt.p[1], opt.p[2]);
      if (opt.r) m.rotation.set(opt.r[0], opt.r[1], opt.r[2]);
      if (opt.s) m.scale.set(opt.s[0], opt.s[1], opt.s[2]);
    }
    return m;
  };
  const mkGlow = (tex, color, scale, opacity) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color, transparent: true, opacity: opacity == null ? 1 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.setScalar(scale);
    return sp;
  };

  // 1 灯塔:岩座 + 白塔红顶 + 旋转光束与信标
  const buildLighthouse = g => {
    g.add(mk(new THREE.IcosahedronGeometry(0.05, 0), '#3d6ca6', { p: [0, 0.008, 0], s: [1.5, 0.4, 1.15], o: 0.5 }));
    g.add(mk(new THREE.IcosahedronGeometry(0.032, 0), '#4a7ab8', { p: [0.052, 0.01, 0.018], s: [1.15, 0.5, 1], o: 0.45 }));
    g.add(mk(new THREE.IcosahedronGeometry(0.026, 0), '#345e96', { p: [-0.048, 0.008, -0.02], s: [1.1, 0.45, 1], o: 0.45 }));
    g.add(mk(new THREE.CylinderGeometry(0.028, 0.034, 0.012, 16), '#8fb8e0', { p: [0, 0.022, 0], o: 0.7 }));
    g.add(mk(new THREE.CylinderGeometry(0.014, 0.021, 0.075, 12), '#e8f4ff', { p: [0, 0.062, 0], o: 0.92 }));
    g.add(mk(new THREE.CylinderGeometry(0.019, 0.019, 0.011, 12), '#ff8a6b', { p: [0, 0.09, 0], o: 0.85 }));
    g.add(mk(new THREE.CylinderGeometry(0.011, 0.011, 0.016, 10), '#ffcf8f', { p: [0, 0.103, 0], o: 0.95 }));
    g.add(mk(new THREE.ConeGeometry(0.015, 0.026, 12), '#ff7a5c', { p: [0, 0.123, 0], o: 0.9 }));
    const beacon = mkGlow(TEX_GOLD, '#ffe9b8', 0.05);
    beacon.position.set(0, 0.104, 0); g.add(beacon);
    const beamHolder = new THREE.Group();
    beamHolder.position.set(0, 0.104, 0); g.add(beamHolder);
    const beam = mk(new THREE.ConeGeometry(0.02, 0.14, 12, 1, true), '#a8d8ff', { o: 0.12 });
    beam.position.set(0.078, 0.02, 0); beam.rotation.z = -Math.PI / 2 + 0.28;
    beamHolder.add(beam);
    const beam2 = beam.clone();
    beam2.position.x = -0.078; beam2.rotation.z = Math.PI / 2 - 0.28;
    beamHolder.add(beam2);
    return t => {
      beacon.material.opacity = 0.5 + 0.5 * Math.sin(t * 3.1);
      beamHolder.rotation.y = t * 0.85;
    };
  };

  // 2 小船:起伏海面 + 扩散波纹 + 白帆小舟
  const buildBoat = g => {
    g.add(mk(new THREE.CircleGeometry(0.1, 32), '#2f7fd0', { p: [0, 0.001, 0], r: [-Math.PI / 2, 0, 0], o: 0.18 }));
    const ring1 = mk(new THREE.RingGeometry(0.86, 1, 40), '#7fd0ff', { p: [0, 0.003, 0], r: [-Math.PI / 2, 0, 0] });
    const ring2 = mk(new THREE.RingGeometry(0.86, 1, 40), '#7fd0ff', { p: [0, 0.003, 0], r: [-Math.PI / 2, 0, 0] });
    g.add(ring1); g.add(ring2);
    const boat = new THREE.Group();
    boat.position.set(0, 0.013, 0); boat.rotation.y = 0.6; g.add(boat);
    const hull = mk(new THREE.CylinderGeometry(0.014, 0.006, 0.03, 3), '#d8ecff', { o: 0.9 });
    hull.rotation.z = Math.PI / 2; boat.add(hull);
    boat.add(mk(new THREE.CylinderGeometry(0.0012, 0.0012, 0.042, 6), '#cfe4ff', { p: [0, 0.021, 0], o: 0.9 }));
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0.019, 0.004); sailShape.lineTo(0, 0.03); sailShape.closePath();
    const sailGeo = new THREE.ShapeGeometry(sailShape);
    const sail = new THREE.Mesh(sailGeo, holoMat('#ffffff', 0.85));
    sail.position.set(0.0015, 0.006, 0.003); boat.add(sail);
    const sail2 = new THREE.Mesh(sailGeo, holoMat('#bfe0ff', 0.7));
    sail2.rotation.y = Math.PI; sail2.position.set(-0.0015, 0.006, -0.003); boat.add(sail2);
    return t => {
      boat.rotation.z = Math.sin(t * 1.3) * 0.09;
      boat.position.y = 0.013 + Math.sin(t * 1.3 + 1.2) * 0.004;
      const k1 = (t * 0.32) % 1, k2 = (t * 0.32 + 0.5) % 1;
      ring1.scale.setScalar(0.03 + k1 * 0.07); ring1.material.opacity = 0.45 * (1 - k1);
      ring2.scale.setScalar(0.03 + k2 * 0.07); ring2.material.opacity = 0.45 * (1 - k2);
    };
  };

  // 3 沙滩:金沙滩洲 + 双棕榈 + 贝壳微光
  const buildBeach = g => {
    g.add(mk(new THREE.CircleGeometry(0.11, 32), '#3f9fe0', { p: [0, 0.001, 0], r: [-Math.PI / 2, 0, 0], o: 0.14 }));
    g.add(mk(new THREE.SphereGeometry(0.07, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#dcc890', { p: [0, 0.002, 0], s: [1.35, 0.38, 1], o: 0.42 }));
    const palm = (x, z, h, lean) => {
      const tr = new THREE.Group();
      tr.position.set(x, 0.02, z); tr.rotation.z = lean; g.add(tr);
      tr.add(mk(new THREE.CylinderGeometry(0.0022, 0.0042, h, 6), '#7fbf9f', { p: [0, h / 2, 0], o: 0.8 }));
      const crown = new THREE.Group();
      crown.position.set(0, h, 0); tr.add(crown);
      for (let i = 0; i < 5; i++) {
        const lw = new THREE.Group();
        lw.rotation.y = (i / 5) * Math.PI * 2 + lean * 2;
        lw.rotation.z = -0.55;
        lw.add(mk(new THREE.PlaneGeometry(0.04, 0.009), '#58d9a8', { p: [0.019, -0.003, 0], r: [0.3, 0, 0], o: 0.85 }));
        crown.add(lw);
      }
      return tr;
    };
    palm(0.045, 0.018, 0.058, -0.16);
    palm(-0.042, -0.028, 0.042, 0.22);
    const shells = [mkGlow(TEX_WHITE, '#f0e8d0', 0.014), mkGlow(TEX_WHITE, '#ffe9c8', 0.011)];
    shells[0].position.set(-0.02, 0.012, 0.04);
    shells[1].position.set(0.055, 0.01, -0.03);
    shells.forEach(sp => g.add(sp));
    return t => {
      shells[0].material.opacity = 0.4 + 0.4 * Math.sin(t * 1.7);
      shells[1].material.opacity = 0.4 + 0.4 * Math.sin(t * 1.7 + 2.1);
    };
  };

  // 4 飞鸟:云影 + 绕圈海燕(扑翼)
  const buildBirds = g => {
    const c1 = mkGlow(TEX_WHITE, '#9cc8f0', 0.1, 0.25); c1.position.set(-0.05, 0.075, -0.02); g.add(c1);
    const c2 = mkGlow(TEX_WHITE, '#8cc0f0', 0.075, 0.22); c2.position.set(0.06, 0.055, 0.03); g.add(c2);
    const birds = [];
    const mkBird = () => {
      const b = new THREE.Group();
      const body = mk(new THREE.ConeGeometry(0.0045, 0.016, 6), '#eaf4ff', { o: 0.9 });
      body.rotation.x = Math.PI / 2; b.add(body);
      const wl = new THREE.Group(); wl.add(mk(new THREE.PlaneGeometry(0.02, 0.007), '#cfe8ff', { p: [0.01, 0, 0], o: 0.9 }));
      const wr = new THREE.Group(); wr.add(mk(new THREE.PlaneGeometry(0.02, 0.007), '#cfe8ff', { p: [-0.01, 0, 0], o: 0.9 }));
      b.add(wl); b.add(wr);
      g.add(b);
      birds.push({ b, wl, wr });
    };
    mkBird(); mkBird(); mkBird();
    return t => {
      for (let i = 0; i < birds.length; i++) {
        const o = birds[i];
        const a = t * (0.5 + i * 0.14) + i * 2.2;
        const r = 0.048 + i * 0.018;
        o.b.position.set(Math.cos(a) * r, 0.062 + Math.sin(t * 1.1 + i * 1.3) * 0.009, Math.sin(a) * r);
        o.b.rotation.y = -a;
        const flap = 0.35 + Math.sin(t * 8 + i * 1.7) * 0.5;
        o.wl.rotation.z = flap; o.wr.rotation.z = -flap;
      }
    };
  };

  // 5 礁石:礁岩群 + 浪花呼吸与环波
  const buildReef = g => {
    g.add(mk(new THREE.CircleGeometry(0.1, 32), '#2f7fd0', { p: [0, 0.001, 0], r: [-Math.PI / 2, 0, 0], o: 0.16 }));
    const rocks = [
      mk(new THREE.IcosahedronGeometry(0.034, 0), '#4a7ab0', { p: [0, 0.014, 0], s: [1.2, 0.75, 1], o: 0.55 }),
      mk(new THREE.IcosahedronGeometry(0.026, 0), '#5585bc', { p: [0.046, 0.01, 0.02], s: [1, 0.7, 1.1], o: 0.5 }),
      mk(new THREE.IcosahedronGeometry(0.02, 0), '#3f6ea4', { p: [-0.042, 0.009, -0.014], s: [1.1, 0.6, 1], o: 0.5 }),
      mk(new THREE.IcosahedronGeometry(0.015, 0), '#6a95c8', { p: [0.018, 0.006, -0.046], s: [1, 0.55, 1], o: 0.45 }),
    ];
    rocks.forEach(r => g.add(r));
    const foam = [];
    for (let i = 0; i < 4; i++) {
      const sp = mkGlow(TEX_WHITE, '#eaf6ff', 0.016, 0.5);
      const a = (i / 4) * Math.PI * 2 + 0.5;
      sp.position.set(Math.cos(a) * 0.052, 0.008, Math.sin(a) * 0.052);
      g.add(sp); foam.push(sp);
    }
    const ring = mk(new THREE.RingGeometry(0.86, 1, 40), '#7fd0ff', { p: [0, 0.003, 0], r: [-Math.PI / 2, 0, 0] });
    g.add(ring);
    return t => {
      foam.forEach((sp, i) => {
        const k = (t * 0.42 + i * 0.25) % 1;
        sp.material.opacity = 0.55 * (1 - k);
        sp.scale.setScalar(0.01 + k * 0.024);
      });
      const k = (t * 0.26) % 1;
      ring.scale.setScalar(0.03 + k * 0.072);
      ring.material.opacity = 0.4 * (1 - k);
    };
  };

  // 景点数据:编号 / 名称 / 位置 / 介绍(介绍文案致敬海岛篇) / 景象构建
  const SITES = [
    {
      name: '灯塔', en: 'LIGHTHOUSE', region: '中国 · 舟山群岛', lon: 122.4, lat: 30.0, build: buildLighthouse,
      off: [24, 18], // 屏幕偏移:避开紧邻的浙江中枢标签,防止叠字
      desc: '矗立在海岸的岩石之上，白色的塔身与红色的塔屋，在湛蓝的天空和深蓝的大海映衬下，醒目而美丽。夜幕降临，光束缓缓扫过海面，为归航的船指引方向。',
    },
    {
      name: '小船', en: 'BOAT', region: '中国 · 南海', lon: 111.8, lat: 16.5, build: buildBoat,
      desc: '梦中又见那宁静的大海，我前进了，驶向远方。我知道我是船，只属于远方——这一天，我用奋斗作为白帆，要和明天一起飘扬。',
    },
    {
      name: '沙滩', en: 'BEACH', region: '澳大利亚 · 大堡礁', lon: 146.3, lat: -18.9, build: buildBeach,
      desc: '宇宙展开的一小角。不想说来这里是暗自疗伤，那过于矫情——只想对每一粒沙子、每一朵浪花，问声你们好吗。',
    },
    {
      name: '飞鸟', en: 'SEABIRD', region: '厄瓜多尔 · 加拉帕戈斯群岛', lon: -90.8, lat: -0.6, build: buildBirds,
      desc: '在苍茫的大海上，狂风卷集着乌云。在乌云和大海之间，海燕像黑色的闪电，在高傲地飞翔。',
    },
    {
      name: '礁石', en: 'REEF', region: '挪威 · 罗弗敦群岛', lon: 13.9, lat: 68.4, build: buildReef,
      desc: '寂寞又怎么样？礁石都不说话，但是水流过去之后，礁石留下。',
    },
  ];
  const siteV = SITES.map(s => ll2v(s.lon, s.lat, 1.008));
  const siteGroups = [];
  SITES.forEach((s, i) => {
    const root = new THREE.Group();
    root.position.copy(siteV[i]);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), siteV[i].clone().normalize());
    // 门户基座:双光环 + 中心辉光
    const base = new THREE.Group();
    base.rotation.x = -Math.PI / 2; root.add(base);
    const r1 = mk(new THREE.RingGeometry(0.078, 0.085, 48), '#6fc0ff', { o: 0.5 }); base.add(r1);
    const r2 = mk(new THREE.RingGeometry(0.05, 0.054, 48), '#a8dcff', { o: 0.6 }); base.add(r2);
    base.add(mkGlow(TEX_CYAN, '#bfe8ff', 0.1, 0.5));
    const stageG = new THREE.Group(); root.add(stageG);
    const anim = s.build(stageG);
    root.scale.setScalar(0.001); root.visible = false;
    spin.add(root);
    siteGroups.push({ root, r1, r2, anim });
  });
  const siteFade = SITES.map(() => 0);

  // ---------- HTML 标签层 ----------
  let labelsOn = true;
  const labels = [];
  const addLabel = (text, isHub, anchorObj, localPos, onClick) => {
    const el = document.createElement('div');
    el.className = 'earth-label' + (isHub ? ' is-hub' : '');
    el.textContent = text;
    if (onClick) {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    }
    stage.appendChild(el);
    labels.push({ el, anchorObj, localPos });
  };

  // ---------- 城市信息卡(点击标签弹出) ----------
  const distKm = (a, b) => {
    const f1 = a.lat * DEG, f2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
    const c = Math.sin(f1) * Math.sin(f2) + Math.cos(f1) * Math.cos(f2) * Math.cos(dl);
    return Math.round(Math.acos(Math.max(-1, Math.min(1, c))) * 6371);
  };
  const bearingCN = (a, b) => {
    const f1 = a.lat * DEG, f2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
    const t = Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl));
    const names = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
    return names[Math.round(((t / DEG + 360) % 360) / 45) % 8];
  };
  const coordText = (lon, lat) => Math.abs(lon).toFixed(1) + '°' + (lon >= 0 ? 'E' : 'W') + ' / ' + Math.abs(lat).toFixed(1) + '°' + (lat >= 0 ? 'N' : 'S');
  const card = document.createElement('div');
  card.className = 'earth-card';
  stage.appendChild(card);
  const showCard = (en, title, rows) => {
    card.innerHTML = '<button class="earth-card-close" type="button">✕ 关闭</button>'
      + '<div class="earth-card-tag">' + en + '</div>'
      + '<h4 class="earth-card-title">' + title + '</h4>'
      + rows.map(r => '<div class="earth-card-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    card.classList.add('is-show');
  };
  card.addEventListener('click', e => {
    if (e.target.classList.contains('earth-card-close')) card.classList.remove('is-show');
    if (e.target.classList.contains('earth-card-back')) exitFocus();
  });

  addLabel(HUB.name, true, spin, hubV.clone(), () => showCard('HUB · ZHEJIANG', HUB.name, [
    ['角色', '全球航线中枢'],
    ['坐标', coordText(HUB.lon, HUB.lat)],
    ['覆盖航线', CITIES.length + ' 条'],
  ]));
  CITIES.forEach((c, i) => addLabel(c[0], false, spin, cityV[i].clone(), () => {
    const dist = distKm(HUB, { lon: c[1], lat: c[2] });
    const status = ORANGE[c[0]] ? '洲际干线' : (LONG_HAUL[c[0]] ? '长途航线' : '区域航线');
    showCard(status.toUpperCase(), c[0], [
      ['坐标', coordText(c[1], c[2])],
      ['距浙江', dist.toLocaleString() + ' km'],
      ['航向', bearingCN(HUB, { lon: c[1], lat: c[2] })],
      ['航线状态', '✈ 已开通'],
    ]);
  }));

  // ============================================================
  // 编号景点交互(仿 [3]. 海岛:点击数字 → 相机飞到该处放大看景象)
  // ============================================================
  const pointEls = [];
  SITES.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'earth-point';
    el.innerHTML = '<div class="ep-label">' + (i + 1) + '</div><span class="ep-name">' + s.name + ' · ' + s.region + '</span>';
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', e => { e.stopPropagation(); focusSite(i); });
    stage.appendChild(el);
    pointEls.push(el);
  });

  // 把球面点 (lon,lat) 转到相机正前方所需的 spin.y / tilt.x 解析解
  // 推导:世界方向 = Rx(tiltX)·Ry(spinY)·p,要求等于相机方向 camBase。
  // 先用 Ry 把点转到 x 分量 = camBase.x 的位置(两个分支,取 |tilt| 更小者),
  // 再用 Rx 绕 x 轴把 (y,z) 角转到相机方向。Rx 保留 x,故该解为精确解。
  const alignView = (lon, lat) => {
    const p = ll2v(lon, lat, 1).normalize();
    const cx = camBase.x, cy = camBase.y, cz = camBase.z;
    const r = Math.hypot(p.x, p.z);                        // 点到自转轴的水平距
    const aP = Math.atan2(p.z, p.x);                       // 点的 xz 平面角
    const bc = Math.atan2(cz, cy);                         // 相机方向的 (y,z) 角
    const ph = Math.acos(Math.max(-1, Math.min(1, cx / r))); // 中间向量的 xz 角幅值
    const w = Math.sqrt(Math.max(0, r * r - cx * cx));     // 中间向量的 |z|
    const t1 = bc - Math.atan2(w, p.y);                    // 分支 +: z 取正
    const t2 = bc - Math.atan2(-w, p.y);                   // 分支 -: z 取负
    const plus = Math.abs(t1) <= Math.abs(t2);
    return { ry: plus ? aP - ph : aP + ph, rx: plus ? t1 : t2 };
  };

  // 视角补间(自研轻量 tween,替代 TWEEN.js;同一时间只保留最新一个)
  const easeInOutCubic = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const wrapPi = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  let viewTween = null;
  const animateView = (ry, rx, dist, dur, cb) => {
    const from = { ry: spin.rotation.y, rx: tilt.rotation.x, d: camTarget };
    viewTween = { t0: performance.now(), dur, from, to: { ry: from.ry + wrapPi(ry - from.ry), rx, d: dist }, cb };
  };

  // 景点介绍卡(复用右侧信息面板)
  const showSiteCard = i => {
    const s = SITES[i];
    card.innerHTML = '<button class="earth-card-close" type="button">✕ 关闭</button>'
      + '<div class="earth-card-tag">VIEWPOINT 0' + (i + 1) + ' · ' + s.en + '</div>'
      + '<h4 class="earth-card-title">' + s.name + '</h4>'
      + '<p class="earth-card-desc">' + s.desc + '</p>'
      + '<div class="earth-card-row"><span>位置</span><b>' + s.region + '</b></div>'
      + '<div class="earth-card-row"><span>坐标</span><b>' + coordText(s.lon, s.lat) + '</b></div>'
      + '<button class="earth-card-back" type="button">↩ 返回全景</button>';
    card.classList.add('is-show');
  };

  let focusIdx = -1;
  const focusSite = i => {
    focusIdx = i;
    const v = alignView(SITES[i].lon, SITES[i].lat);
    animateView(v.ry, v.rx, 1.85, 1500);
    lastTouch = performance.now();
    showSiteCard(i);
  };
  const exitFocus = () => {
    if (focusIdx < 0 && !viewTween) return;
    focusIdx = -1;
    animateView(spin.rotation.y, 0, 3.55, 1400);
    card.classList.remove('is-show');
  };

  // ESC 返回全景
  window.addEventListener('keydown', e => { if (e.key === 'Escape') exitFocus(); });

  // 编号徽章投影(背面隐藏,规则同城市标签)
  const updatePoints = () => {
    for (let i = 0; i < SITES.length; i++) {
      const el = pointEls[i];
      if (!labelsOn) { el.style.visibility = 'hidden'; continue; }
      spin.localToWorld(wp.copy(siteV[i]));
      const facing = wp.clone().normalize().dot(camBase);
      const o = facing > 0.16 ? Math.min(1, (facing - 0.16) / 0.22) : 0;
      proj.copy(wp).project(camera);
      const off = focusIdx === i ? [0, 0] : (SITES[i].off || [0, 0]); // 聚焦时居中,平时错开冲突标签
      el.style.transform = 'translate(' + ((proj.x * 0.5 + 0.5) * W + off[0]).toFixed(1) + 'px,' + ((-proj.y * 0.5 + 0.5) * H + off[1]).toFixed(1) + 'px) translate(-50%,-50%)';
      el.style.opacity = o.toFixed(2);
      el.style.visibility = o > 0.03 ? 'visible' : 'hidden';
      el.classList.toggle('is-active', focusIdx === i);
    }
  };

  // 景象淡入/收回 + 各景点自身动画
  const easeOutBack = k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  const updateSites = (t, dt) => {
    for (let i = 0; i < siteGroups.length; i++) {
      const G = siteGroups[i];
      siteFade[i] += ((focusIdx === i ? 1 : 0) - siteFade[i]) * Math.min(1, dt * 3);
      if (siteFade[i] <= 0.012) { G.root.visible = false; continue; }
      G.root.visible = true;
      G.root.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, Math.max(0, siteFade[i])))));
      G.r1.rotation.z = t * 0.4;
      G.r2.rotation.z = -t * 0.3;
      G.anim(t);
    }
  };

  // ============================================================
  // 实时数据层(致敬 God's Eye View:公开数据源,全部无需 Key)
  //   ✈ 航班:OpenSky Network(东亚范围,10 分钟刷新)
  //   🌍 地震:USGS 24h Feed(5 分钟刷新,M≥5 有扩散脉冲)
  //   🛰 ISS:WhereTheISS.at(12 秒刷新)
  // ============================================================
  const liveGroup = new THREE.Group();
  spin.add(liveGroup);
  const quakesGroup = new THREE.Group();
  liveGroup.add(quakesGroup);
  const issGroup = new THREE.Group();
  spin.add(issGroup);
  let planesOn = true, quakesOn = true, issOn = true;
  let planesPts = null, planesList = [];
  const quakePulses = [];
  const issSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_GOLD, color: '#ffe9b8', transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  issSprite.scale.setScalar(0.085);
  issGroup.add(issSprite);
  const issLabel = document.createElement('div');
  issLabel.className = 'earth-label is-iss';
  issLabel.textContent = '🛰 ISS';
  stage.appendChild(issLabel);
  const issData = { lat: 0, lon: 0, alt: 0, at: 0 };
  const issPos = new THREE.Vector3();

  // HUD 状态条
  const liveBar = document.createElement('div');
  liveBar.className = 'earth-live';
  liveBar.innerHTML = '<span id="live-f">✈ 航班加载中</span><span id="live-q">🌍 地震加载中</span><span id="live-i">🛰 ISS …</span>';
  stage.appendChild(liveBar);
  const liveF = liveBar.querySelector('#live-f');
  const liveQ = liveBar.querySelector('#live-q');
  const liveI = liveBar.querySelector('#live-i');

  const fetchJSON = async (url, ms) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 15000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  };
  const minsAgo = ts => { const m = Math.round((Date.now() - ts) / 60000); return m <= 0 ? '刚刚' : m + ' 分钟前'; };

  // ---- 航班 ----
  function setPlanes(states) {
    const rows = (states || []).filter(s => s[5] != null && s[6] != null && !s[8]);
    planesList = rows;
    const pos = new Float32Array(rows.length * 3);
    const col = new Float32Array(rows.length * 3);
    const cLow = new THREE.Color('#eaf4ff'), cMid = new THREE.Color('#7fd0ff'), cHigh = new THREE.Color('#3f8dff');
    const v = new THREE.Vector3();
    rows.forEach((s, i) => {
      const alt = Math.max(0, s[7] || 0);
      v.copy(ll2v(s[5], s[6], 1.005 + Math.min(0.018, alt / 900000)));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const c = alt < 3000 ? cLow : alt < 9000 ? cMid : cHigh;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (planesPts) { liveGroup.remove(planesPts); planesPts.geometry.dispose(); planesPts.material.dispose(); }
    planesPts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.012, vertexColors: true, map: TEX_WHITE, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    planesPts.visible = planesOn;
    liveGroup.add(planesPts);
    liveF.textContent = '✈ ' + rows.length.toLocaleString() + ' 架在空 · ' + minsAgo(Date.now());
    liveF.dataset.ok = '1';
  }
  let flightFails = 0;
  async function pollFlights() {
    if (document.hidden) return;
    liveF.textContent = '✈ 航班刷新中…';
    try {
      const d = await fetchJSON('https://opensky-network.org/api/states/all?lamin=0&lomin=70&lamax=55&lomax=150', 20000);
      flightFails = 0;
      setPlanes(d.states || []);
    } catch (e) {
      liveF.textContent = '✈ 航班源限流,稍后自动重试';
      liveF.dataset.ok = '0';
      flightFails++;
      if (flightFails <= 3) setTimeout(pollFlights, 90000); // 快速重试几次,别让首访一直等
    }
  }

  // ---- 地震 ----
  function setQuakes(features) {
    quakesGroup.clear();
    quakePulses.length = 0;
    const rows = (features || []).filter(f => f.geometry && f.geometry.coordinates);
    const pos = new Float32Array(rows.length * 3);
    const v = new THREE.Vector3();
    rows.forEach((f, i) => {
      const [lon, lat, dep] = f.geometry.coordinates;
      v.copy(ll2v(lon, lat, 1.004 + Math.min(0.01, Math.max(0, dep) / 500000)));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      if ((f.properties.mag || 0) >= 5 && quakePulses.length < 14) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: TEX_GOLD, color: '#ff9c6b', transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
        }));
        sp.position.copy(v);
        quakesGroup.add(sp);
        quakePulses.push({ sprite: sp, phase: Math.random(), mag: f.properties.mag || 5 });
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    quakesGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#ff8a5c', size: 0.011, map: TEX_WHITE, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })));
    liveQ.textContent = '🌍 ' + rows.length + ' 次地震(24h) · ' + minsAgo(Date.now());
    liveQ.dataset.ok = '1';
  }
  async function pollQuakes() {
    if (document.hidden) return;
    try {
      const d = await fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', 15000);
      setQuakes(d.features || []);
    } catch (e) {
      liveQ.textContent = '🌍 地震源暂不可用';
    }
  }

  // ---- ISS ----
  async function pollISS() {
    if (document.hidden) return;
    try {
      const d = await fetchJSON('https://api.wheretheiss.at/v1/satellites/25544', 10000);
      issData.lat = d.latitude; issData.lon = d.longitude; issData.alt = d.altitude; issData.at = Date.now();
      issPos.copy(ll2v(d.longitude, d.latitude, 1 + Math.max(0, d.altitude) / 6371000));
      issSprite.position.copy(issPos);
      liveI.textContent = '🛰 ISS ' + Math.round(d.altitude) + 'km';
      liveI.dataset.ok = '1';
    } catch (e) { /* 保持上次位置 */ }
  }
  pollFlights(); pollQuakes(); pollISS();
  setInterval(pollFlights, 600000);
  setInterval(pollQuakes, 300000);
  setInterval(pollISS, 12000);
  setInterval(() => { // HUD 时效性(不依赖 rAF)
    if (liveF.dataset.ok === '1') liveF.textContent = '✈ ' + planesList.length.toLocaleString() + ' 架在空 · ' + minsAgo(Date.now());
    if (liveQ.dataset.ok === '1') liveQ.textContent = liveQ.textContent.replace(/ · .*$/, '') + ' · ' + minsAgo(Date.now());
    if (issData.at) liveI.textContent = '🛰 ISS ' + Math.round(issData.alt) + 'km · ' + Math.round((Date.now() - issData.at) / 1000) + 's 前';
  }, 4000);

  // ---- 点选航班 → 信息卡 ----
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.018;
  const ndc = new THREE.Vector2();
  let downX = 0, downY = 0, downT = 0;
  stage.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
  stage.addEventListener('click', e => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5 || performance.now() - downT > 700) return;
    if (!planesOn || !planesPts || !planesList.length) return;
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(planesPts);
    if (hits.length && hits[0].index != null) {
      const s = planesList[hits[0].index];
      const cs = String(s[1] || '').trim();
      showCard('LIVE FLIGHT', cs || String(s[0]).toUpperCase(), [
        ['ICAO24', String(s[0])],
        ['注册地', String(s[2] || '-')],
        ['高度', Math.round(s[7] || 0).toLocaleString() + ' m'],
        ['地速', Math.round(s[9] || 0) + ' km/h'],
        ['航向', Math.round(s[10] || 0) + '°'],
      ]);
    } else {
      card.classList.remove('is-show');
    }
  });

  // 每帧更新:地震脉冲 + ISS 动态标签
  const issWp = new THREE.Vector3();
  function updateLive(t) {
    for (const p of quakePulses) {
      const k = (t * 0.45 + p.phase) % 1;
      p.sprite.scale.setScalar(0.05 + k * (0.14 + p.mag * 0.035));
      p.sprite.material.opacity = 0.55 * (1 - k);
    }
    if (!issOn || !issData.at) { issLabel.style.visibility = 'hidden'; return; }
    issSprite.getWorldPosition(issWp);
    const facing = issWp.clone().normalize().dot(camBase);
    proj.copy(issWp).project(camera);
    const x = (proj.x * 0.5 + 0.5) * W;
    const y = (-proj.y * 0.5 + 0.5) * H;
    issLabel.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-150%)';
    const o = facing > -0.05 ? 1 : 0;
    issLabel.style.opacity = o.toFixed(2);
    issLabel.style.visibility = o > 0 ? 'visible' : 'hidden';
  }

  // ---------- 图层开关(顶部 chips,对应视频左侧菜单) ----------
  const LAYERS = {
    dots:   { on: true, apply: v => { if (dotsPts) dotsPts.visible = v; } },
    border: { on: true, apply: v => { if (bordersLines) bordersLines.visible = v; } },
    flight: { on: true, apply: v => { arcsGroup.visible = v; } },
    bars:   { on: false, apply: v => { barsGroup.visible = v; } },
    ring:   { on: true, apply: v => { ringGroup.visible = v; } },
    stars:  { on: true, apply: v => { if (starsObj) starsObj.visible = v; } },
    label:  { on: true, apply: v => { labelsOn = v; if (!v) card.classList.remove('is-show'); } },
    planes: { on: true, apply: v => { planesOn = v; if (planesPts) planesPts.visible = v; } },
    quakes: { on: true, apply: v => { quakesOn = v; quakesGroup.visible = v; } },
    iss:    { on: true, apply: v => { issOn = v; issGroup.visible = v; if (!v) issLabel.style.visibility = 'hidden'; } },
  };
  document.querySelectorAll('.earth-chip[data-layer]').forEach(chip => {
    const L = LAYERS[chip.dataset.layer];
    if (!L) return;
    const sync = () => chip.classList.toggle('is-off', !L.on);
    chip.addEventListener('click', e => { e.preventDefault(); L.on = !L.on; L.apply(L.on); sync(); });
    L.apply(L.on); sync();
  });

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
    if (viewTween) return; // 视角飞行中不接管拖拽
    dragging = true; lastX = e.clientX; lastY = e.clientY; velY = 0;
    stage.classList.add('is-dragging');
    lastTouch = performance.now();
  };
  const onMove = e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    spin.rotation.y += dx * 0.005;
    // 相机从上方俯视:dy<0(上滑)需增大 rotation.x 才能让球面点跟着鼠标向上走
    // 景点聚焦时放宽俯仰限制(南半球景点需要更大的翻转角)
    const lim = focusIdx >= 0 ? 2.2 : 0.7;
    tilt.rotation.x = Math.max(-lim, Math.min(lim, tilt.rotation.x - dy * 0.002));
    velY = dx * 0.005;
    lastTouch = performance.now();
  };
  const onUp = () => { dragging = false; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    camTarget = Math.max(1.6, Math.min(5.6, camTarget + e.deltaY * 0.0016));
    lastTouch = performance.now();
  }, { passive: false });
  stage.addEventListener('dblclick', () => {
    if (focusIdx >= 0) exitFocus();       // 景点视角下双击 = 返回全景
    else animateView(spin.rotation.y, 0, 3.55, 900); // 平滑复位
  });

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

  // 标签投影(首帧与每帧共用)
  const updateLabels = () => {
    for (const L of labels) {
      // 景点聚焦时收起城市/中枢标签,避免压在景象上
      if (!labelsOn || focusIdx >= 0) { L.el.style.visibility = 'hidden'; continue; }
      L.anchorObj.localToWorld(wp.copy(L.localPos));
      const facing = wp.clone().normalize().dot(camBase);
      proj.copy(wp).project(camera);
      const x = (proj.x * 0.5 + 0.5) * W;
      const y = (-proj.y * 0.5 + 0.5) * H;
      L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-140%)';
      const o = facing > 0.16 ? Math.min(1, (facing - 0.16) / 0.22) : 0;
      L.el.style.opacity = o.toFixed(2);
      L.el.style.visibility = o > 0.03 ? 'visible' : 'hidden';
    }
  };

  // 首帧同步渲染:后台标签页 rAF 暂停时也立刻可见,不再卡加载圈
  try { renderer.render(scene, camera); } catch { }
  updateLabels();
  if (loading) loading.style.display = 'none';

  const frame = () => {
    requestAnimationFrame(frame);
    // 尺寸自愈:主题布局/字体加载晚于首帧时跟上
    if (stage.clientWidth !== lastW || stage.clientHeight !== lastH) resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // 惯性 + 闲置自转(景点聚焦时暂停,保持对准视角)
    if (!dragging) {
      spin.rotation.y += velY;
      velY *= 0.93;
      if (!reduced && focusIdx < 0 && !viewTween && performance.now() - lastTouch > 2600) spin.rotation.y += 0.05 * dt;
    }

    // 视角飞行(编号景点 / 复位)
    if (viewTween) {
      const k = Math.min(1, (performance.now() - viewTween.t0) / viewTween.dur);
      const e = easeInOutCubic(k);
      spin.rotation.y = viewTween.from.ry + (viewTween.to.ry - viewTween.from.ry) * e;
      tilt.rotation.x = viewTween.from.rx + (viewTween.to.rx - viewTween.from.rx) * e;
      camTarget = viewTween.from.d + (viewTween.to.d - viewTween.from.d) * e;
      if (k >= 1) { const cb = viewTween.cb; viewTween = null; cb && cb(); }
    }

    // 飞线脉冲
    for (const f of flights) {
      const k = (t * f.speed + f.phase) % 1;
      f.curve.getPoint(k, f.sprite.position);
      const fade = Math.sin(k * Math.PI);
      f.sprite.material.opacity = 0.35 + 0.65 * fade;
    }
    // 中枢呼吸波纹(聚焦景点时隐藏)
    for (const p of pulses) {
      const k = (t * 0.5 + p.phase) % 1;
      p.mesh.visible = focusIdx < 0;
      const s = 0.03 + k * 0.22;
      p.mesh.scale.setScalar(s);
      p.mesh.material.opacity = 0.36 * (1 - k);
    }
    // 聚焦景点时收起航线与中枢光核,让景象独占视野(退出后恢复)
    arcsGroup.visible = LAYERS.flight.on && focusIdx < 0;
    hubCore.visible = focusIdx < 0;
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
    updateLabels();
    // 编号景点徽章投影 + 景象淡入与自身动画
    updatePoints();
    updateSites(t, dt);
    // 实时层:地震脉冲 + ISS 动态标签
    updateLive(t);

    renderer.render(scene, camera);
  };
  frame();
  // 调试钩子(控制台:__earth() 查看当前旋转/缩放)
  window.__earth = () => ({ tiltX: tilt.rotation.x, spinY: spin.rotation.y, dist: camDist });
})();
