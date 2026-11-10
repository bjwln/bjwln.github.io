/* ============================================================
 * 江苏 · 雨夜便利店街角(三渲二微缩景观)
 * 由 earth.js 惰性构建:buildStoreWorld(THREE)
 * 返回 { world, update(t, dt) } —— world 默认隐藏,进入时点亮
 * 全程序化建模:方形底座 + 日式便利店 + 街角元素 + 雨夜动效
 * ============================================================ */

export function buildStoreWorld(THREE) {
  'use strict';

  const world = new THREE.Group();
  world.visible = false;
  const anims = [];
  const update = (t, dt) => { for (let i = 0; i < anims.length; i++) anims[i](t, dt); };

  const rand = (a, b) => a + Math.random() * (b - a);
  const easeIO = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  // ---------------- 三渲二基础:四阶色阶 + 材质缓存 ----------------
  const gradData = new Uint8Array([
    88, 96, 118, 255, 148, 156, 176, 255, 210, 216, 228, 255, 255, 255, 255, 255,
  ]);
  const gradMap = new THREE.DataTexture(gradData, 4, 1, THREE.RGBAFormat);
  gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter;
  gradMap.needsUpdate = true;

  const matCache = new Map();
  const toon = (color, emissive, eI) => {
    const key = color + '|' + (emissive || 0) + '|' + (eI || 0);
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: gradMap });
      if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = eI || 1; }
      matCache.set(key, m);
    }
    return m;
  };

  const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x090d18, side: THREE.BackSide });
  const outline = (mesh, k) => {
    const o = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
    o.scale.setScalar(k || 1.04);
    mesh.add(o);
    return mesh;
  };

  const B = (w, h, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
    m.position.set(x, y, z);
    world.add(m);
    return m;
  };

  // ---------------- 画布贴图小工具 ----------------
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  const softTex = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.45, 'rgba(255,255,255,.5)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
  // 地面反光条:上端亮(贴着光源)向下淡出
  const streakTex = canvasTex(64, 128, (g) => {
    const l = g.createLinearGradient(0, 0, 0, 128);
    l.addColorStop(0, 'rgba(255,255,255,.95)');
    l.addColorStop(0.35, 'rgba(255,255,255,.38)');
    l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l; g.fillRect(0, 0, 64, 128);
  });
  const glowPoolTex = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,.9)');
    r.addColorStop(0.55, 'rgba(255,255,255,.32)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });

  // 店招:蓝星マート
  const signTex = canvasTex(1024, 224, (g) => {
    g.fillStyle = '#0c1424'; g.fillRect(0, 0, 1024, 224);
    g.strokeStyle = '#24425e'; g.lineWidth = 8; g.strokeRect(8, 8, 1008, 208);
    // 月亮商标
    g.save();
    g.shadowColor = '#7fe3ff'; g.shadowBlur = 26;
    g.fillStyle = '#9feaff';
    g.beginPath(); g.arc(120, 108, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c1424';
    g.beginPath(); g.arc(146, 92, 52, 0, Math.PI * 2); g.fill();
    g.restore();
    // 主字
    g.save();
    g.shadowColor = '#6fd8ff'; g.shadowBlur = 30;
    const grad = g.createLinearGradient(0, 40, 0, 190);
    grad.addColorStop(0, '#eafcff'); grad.addColorStop(0.5, '#a5ecff'); grad.addColorStop(1, '#5fc4ee');
    g.fillStyle = grad;
    g.font = '700 118px "PingFang SC","Microsoft YaHei",sans-serif';
    g.textBaseline = 'middle';
    g.fillText('蓝星マート', 220, 112);
    g.restore();
    g.fillStyle = '#ffc98a';
    g.font = '600 40px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText('24時間', 250, 196);
    g.fillStyle = '#5a7a9a';
    g.font = '500 30px sans-serif';
    g.fillText('BLUE STAR MART', 470, 198);
  });
  // 贩卖机正面
  const vendTex = canvasTex(256, 512, (g) => {
    g.fillStyle = '#c93a30'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#101a2e'; g.fillRect(18, 22, 220, 260);
    const cols = ['#e8604a', '#ffd257', '#7fd8e8', '#8fe08a', '#f0f0f0', '#e88ab0'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = cols[(r * 4 + c) % 6];
      g.fillRect(34 + c * 52, 44 + r * 58, 34, 42);
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillRect(34 + c * 52, 44 + r * 58 + 18, 34, 5);
    }
    g.fillStyle = 'rgba(190,225,255,.18)'; g.fillRect(18, 22, 220, 34);
    g.fillStyle = '#f2ede2'; g.fillRect(18, 306, 220, 130);
    g.fillStyle = '#c93a30'; g.beginPath(); g.arc(70, 370, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 34px sans-serif'; g.fillText('青', 56, 383);
    g.fillStyle = '#2a3242'; g.font = '600 26px sans-serif'; g.fillText('ドリンク', 120, 352);
    g.fillStyle = '#3a4254'; g.fillRect(120, 372, 100, 14);
    g.fillStyle = '#141a26'; g.fillRect(18, 452, 220, 42);
    g.fillStyle = '#7f8ba0'; g.fillRect(150, 460, 60, 26);
  });
  const menuTex = canvasTex(512, 128, (g) => {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 512, 128);
    const cols = ['#e8a0a8', '#a8c8e8', '#e8d8a0', '#a8e0c0', '#e8b890', '#c0a8e0'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cols[i]; g.fillRect(24 + i * 80, 22, 44, 34);
      g.fillStyle = '#b8b2a4'; g.fillRect(24 + i * 80, 66, 44, 8);
      g.fillStyle = '#d8d2c4'; g.fillRect(24 + i * 80, 82, 32, 8);
    }
  });
  const posterTexA = canvasTex(256, 352, (g) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 256, 352);
    g.fillStyle = '#3a7fc8'; g.fillRect(0, 0, 256, 92);
    g.fillStyle = '#fff'; g.font = '700 40px sans-serif'; g.fillText('新食感', 28, 62);
    g.fillStyle = '#e8a030'; g.beginPath(); g.arc(128, 190, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c8543c'; g.beginPath(); g.arc(170, 220, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9aa4b2'; g.fillRect(28, 276, 200, 12); g.fillRect(28, 300, 160, 12);
  });
  const posterTexB = canvasTex(256, 352, (g) => {
    g.fillStyle = '#18243c'; g.fillRect(0, 0, 256, 352);
    g.save(); g.shadowColor = '#ffd98a'; g.shadowBlur = 30;
    g.fillStyle = '#ffe0a0'; g.beginPath(); g.arc(128, 120, 58, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#8fa8cc'; g.font = '600 34px sans-serif'; g.fillText('夜を照らす', 36, 240);
    g.fillStyle = '#4a5c7c'; g.fillRect(36, 270, 184, 10); g.fillRect(36, 292, 140, 10);
  });
  const alleyPosterTex = canvasTex(256, 352, (g) => {
    g.fillStyle = '#22304a'; g.fillRect(0, 0, 256, 352);
    g.fillStyle = '#7fd8e8'; g.beginPath(); g.arc(178, 84, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#22304a'; g.beginPath(); g.arc(196, 72, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c8d8ec'; g.font = '600 44px sans-serif'; g.fillText('夜間', 36, 200);
    g.fillStyle = '#3c5074'; g.font = '500 30px sans-serif'; g.fillText('営業中', 36, 248);
    g.fillStyle = '#2c3c5c'; g.fillRect(36, 280, 184, 10);
  });
  const plaqueTex = canvasTex(512, 128, (g) => {
    g.fillStyle = '#0a0f1c'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#233250'; g.lineWidth = 4; g.strokeRect(6, 6, 500, 116);
    g.save(); g.shadowColor = '#7fe3ff'; g.shadowBlur = 16;
    g.fillStyle = '#bfeaff'; g.font = '700 56px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText('江苏 · 雨夜商店街', 92, 62);
    g.restore();
    g.fillStyle = '#55708e'; g.font = '400 26px sans-serif';
    g.fillText('JIANGSU RAINY CORNER · No.07', 96, 104);
  });

  // ================= 底座(可收藏模型感) =================
  {
    const plinth = B(13.0, 0.86, 13.0, 0x0c111f, 0, -0.43, 0);
    plinth.material = new THREE.MeshPhongMaterial({ color: 0x0c111f, shininess: 30, specular: 0x2a3a55 });
    B(13.6, 0.18, 13.6, 0x06080f, 0, -0.95, 0);
    B(12.42, 0.05, 12.42, 0x1b2540, 0, -0.015, 0); // 顶面倒角亮边
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.06), [
      toon(0x0a0f1c), toon(0x0a0f1c), toon(0x0a0f1c), toon(0x0a0f1c),
      new THREE.MeshBasicMaterial({ map: plaqueTex }),
      toon(0x0a0f1c),
    ]);
    plaque.position.set(0, -0.44, 6.52);
    world.add(plaque);
  }

  // ================= 地面分区 =================
  // 广场(店块人行道)x[-6,3.2] z[-6,0.8] / 前路 z[0.8,3.0] / 右路 x[3.2,5.4] / 远侧人行道
  const ROAD_Y = 0.05, PLAZA_Y = 0.14;
  const roadMat = new THREE.MeshPhongMaterial({ color: 0x2c3550, specular: 0x647c9e, shininess: 56 });
  const roadMat2 = new THREE.MeshPhongMaterial({ color: 0x303a58, specular: 0x647c9e, shininess: 56 });
  {
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(9.2, PLAZA_Y, 6.8), toon(0x36425e));
    plaza.position.set(-1.4, PLAZA_Y / 2, -2.6); world.add(plaza);
    const roadF = new THREE.Mesh(new THREE.BoxGeometry(12, ROAD_Y, 2.2), roadMat);
    roadF.position.set(0, ROAD_Y / 2, 1.9); world.add(roadF);
    const roadR = new THREE.Mesh(new THREE.BoxGeometry(2.2, ROAD_Y, 6.8), roadMat2);
    roadR.position.set(4.3, ROAD_Y / 2, -2.6); world.add(roadR);
    const walkFarF = new THREE.Mesh(new THREE.BoxGeometry(12, PLAZA_Y, 3.0), toon(0x31405c));
    walkFarF.position.set(0, PLAZA_Y / 2, 4.5); world.add(walkFarF);
    const walkFarR = new THREE.Mesh(new THREE.BoxGeometry(0.6, PLAZA_Y, 9.0), toon(0x31405c));
    walkFarR.position.set(5.7, PLAZA_Y / 2, -1.5); world.add(walkFarR);
    // 广场石板缝(细线)
    const lineMat = toon(0x2c3852);
    for (let x = -5.4; x <= 2.6; x += 1.2) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 6.4), lineMat);
      l.position.set(x, PLAZA_Y + 0.004, -2.6); world.add(l);
    }
    for (let z = -5.4; z <= 0.2; z += 1.2) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.012, 0.03), lineMat);
      l.position.set(-1.4, PLAZA_Y + 0.004, z); world.add(l);
    }
    // 路缘石
    const curb = toon(0x5f6d8a);
    const curbStrip = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), curb);
      m.position.set(x, 0.08, z); world.add(m);
    };
    curbStrip(9.3, 0.1, -1.35, 0.78);
    curbStrip(0.1, 6.9, 3.18, -2.6);
    curbStrip(12.1, 0.1, 0, 3.02);
    curbStrip(0.1, 9.1, 5.42, -1.5);
    // 道路中线(虚线,避开斑马线)
    const dash = toon(0xb8c2ce);
    for (let x = -5.4; x <= 2.6; x += 0.85) {
      if (x > -2.6 && x < 0.7) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.07), dash);
      m.position.set(x, ROAD_Y + 0.008, 1.9); world.add(m);
    }
    for (let z = -5.4; z <= -1.0; z += 0.85) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.42), dash);
      m.position.set(4.3, ROAD_Y + 0.008, z); world.add(m);
    }
  }
  // 斑马线(湿面反光)
  const zebraMat = new THREE.MeshPhongMaterial({ color: 0xd9dfe8, specular: 0xa4bad4, shininess: 84 });
  const zebra = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.014, 1.86), zebraMat);
    m.position.set(-2.3 + i * 0.52, ROAD_Y + 0.012, 1.9); world.add(m); zebra.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.014, 0.3), zebraMat);
    m.position.set(4.3, ROAD_Y + 0.012, 0.12 - i * 0.5); world.add(m); zebra.push(m);
  }
  // 停车位(白线框)
  {
    const pm = toon(0xcdd6e2);
    const line = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), pm);
      m.position.set(x, ROAD_Y + 0.01, z); world.add(m);
    };
    line(0.06, 2.0, 3.4, -3.6); line(0.06, 2.0, 4.24, -3.6);
    line(0.9, 0.06, 3.82, -2.62);
    line(0.9, 0.06, 3.82, -4.58);
  }
  // 排水沟 + 雨水箅
  {
    const gutterMat = toon(0x121724);
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.016, 0.13), gutterMat);
    g1.position.set(-1.4, ROAD_Y + 0.006, 0.98); world.add(g1);
    const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.016, 6.4), gutterMat);
    g2.position.set(3.38, ROAD_Y + 0.006, -2.6); world.add(g2);
    const barMat = toon(0x3c475c);
    [[-4.6, 0.98], [-1.4, 0.98], [1.6, 0.98], [3.42, 0.98], [3.38, -1.2], [3.38, -3.4]].forEach(p => {
      const grate = new THREE.Mesh(new THREE.BoxGeometry(p[0] > 3.3 ? 0.11 : 0.44, 0.02, p[0] > 3.3 ? 0.44 : 0.11), barMat);
      grate.position.set(p[0], ROAD_Y + 0.012, p[1]); world.add(grate);
    });
  }
  // 积水洼(高光镜面)
  const puddleMat = new THREE.MeshPhongMaterial({ color: 0x0d1526, specular: 0x93aacb, shininess: 140, transparent: true, opacity: 0.94 });
  const puddles = [];
  [[-1.2, 1.95, 0.85], [-3.6, 1.5, 0.6], [1.6, 2.35, 0.7], [2.7, 1.25, 0.5],
   [4.35, -1.4, 0.8], [4.65, 0.6, 0.55], [3.95, -3.4, 0.7], [4.1, 1.8, 0.6],
   [-2.6, 2.6, 0.45], [0.4, 2.7, 0.5]].forEach(p => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 22), puddleMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(p[0], ROAD_Y + 0.018, p[1]);
    m.scale.set(p[2], p[2] * rand(0.55, 0.8), 1);
    m.rotation.z = rand(0, Math.PI);
    world.add(m); puddles.push(m);
  });

  // 灯光在湿地面的反光条(卡通式长条反光)
  const streakQuad = (w, h, color, opacity, x, z, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: streakTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2; if (rot) m.rotation.z = rot;
    m.position.set(x, ROAD_Y + 0.024, z);
    m.renderOrder = 3;
    world.add(m);
    return m;
  };
  const signStreak = streakQuad(2.2, 1.3, 0x5fc8e8, 0.3, -1.1, 1.55);
  streakQuad(1.2, 0.8, 0xff9a80, 0.16, 2.15, 0.95);
  streakQuad(4.6, 1.3, 0xffcf96, 0.1, -1.7, 1.5); // 橱窗暖光在湿路上的长反光
  streakQuad(1.0, 1.5, 0x9fd8ff, 0.1, -4.5, 1.2);  // 冷柜青光溢出一点
  const trafficStreak = streakQuad(0.55, 1.7, 0xff5a4a, 0.17, 4.85, -1.35);
  // 路灯暖色光池(径向)
  {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.3), new THREE.MeshBasicMaterial({
      map: glowPoolTex, color: 0xffc890, transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(-4.55, ROAD_Y + 0.02, 1.7);
    pool.renderOrder = 2; world.add(pool);
  }
  // 店门暖光洒出(自动门开合时增减)
  const doorGlowMat = new THREE.MeshBasicMaterial({
    map: glowPoolTex, color: 0xffdcae, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), doorGlowMat);
    q.rotation.x = -Math.PI / 2; q.position.set(0.95, ROAD_Y + 0.02, 0.35);
    q.renderOrder = 2; world.add(q);
    const q2 = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), doorGlowMat);
    q2.rotation.x = -Math.PI / 2; q2.position.set(0.95, PLAZA_Y + 0.02, -0.72);
    q2.renderOrder = 2; world.add(q2);
  }
  // 橱窗暖光常亮洒在门前人行道上(店内外冷暖对比的关键一抹)
  {
    const shopGlowMat = new THREE.MeshBasicMaterial({
      map: glowPoolTex, color: 0xffdcae, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.0), shopGlowMat);
    sq.rotation.x = -Math.PI / 2; sq.position.set(-2.1, PLAZA_Y + 0.018, 0.15);
    sq.renderOrder = 2; world.add(sq);
  }

  // ================= 远景围合立面(让角落有"街区"的边界) =================
  {
    const facadeF = B(12, 2.4, 0.42, 0x111a30, 0, 1.2, 5.78);
    facadeF.material = toon(0x111a30);
    const facadeR = B(0.42, 1.7, 9.0, 0x0f1729, 5.86, 0.85, -1.5);
    const winCols = [0xffb86b, 0x7fd8e8, 0xffd98a, 0x5a7ec8];
    let seed = 7;
    const wr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9; i++) {
      if (wr() < 0.3) continue;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46),
        new THREE.MeshBasicMaterial({ color: winCols[Math.floor(wr() * 4)] }));
      w.position.set(-5.2 + i * 1.28, 1.0 + (wr() < 0.5 ? 0.55 : 0), 5.56);
      world.add(w);
    }
    for (let i = 0; i < 7; i++) {
      if (wr() < 0.28) continue;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42),
        new THREE.MeshBasicMaterial({ color: winCols[Math.floor(wr() * 4)] }));
      w.rotation.y = -Math.PI / 2;
      w.position.set(5.64, 0.8 + (wr() < 0.5 ? 0.45 : 0), -5.2 + i * 1.4);
      world.add(w);
    }
  }

  // ================= 便利店主体 =================
  // 体块 x[-4.8,1.6] z[-5.4,-0.4] 檐口高 3.3
  const WALL_H = 3.3;
  const wallC = 0xe7e1d3, wallSide = 0xd9d2c2, trimC = 0x2b3548;
  {
    // 左墙 / 右墙 / 后墙
    B(0.14, WALL_H, 5.14, wallSide, -4.87, WALL_H / 2, -2.9);
    B(0.14, WALL_H, 5.14, wallSide, 1.67, WALL_H / 2, -2.9);
    B(6.82, WALL_H, 0.14, wallC, -1.6, WALL_H / 2, -5.47);
    // 檐口横带(门头上墙)
    B(6.82, 0.78, 0.16, wallC, -1.6, 2.92, -0.42);
    B(6.82, 0.1, 0.2, trimC, -1.6, 3.32, -0.42); // 深色压顶
    B(6.82, 0.1, 0.2, trimC, -1.6, 2.5, -0.42);
    // 屋顶
    const roof = B(6.86, 0.16, 5.2, 0x39445c, -1.6, 3.4, -2.92);
    outline(roof, 1.03);
    B(6.86, 0.26, 0.1, 0x46536e, -1.6, 3.56, -0.36); // 女儿墙
    B(6.86, 0.26, 0.1, 0x46536e, -1.6, 3.56, -5.48);
    B(0.1, 0.26, 5.2, 0x46536e, -4.99, 3.56, -2.92);
    B(0.1, 0.26, 5.2, 0x46536e, 1.79, 3.56, -2.92);
  }
  // 屋顶设备:空调外机 ×2 + 通风管 + 天线(红色航空灯)
  {
    const ac = (x, z) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.5, 0.6), toon(0x9aa6b8));
      body.position.y = 0.25; g.add(body);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.52, 16), toon(0x273044));
      fan.rotation.x = Math.PI / 2; fan.position.set(0.22, 0.25, 0); g.add(fan);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 8, 20), toon(0x5d6b84));
      ring.position.set(0.22, 0.25, 0.27); g.add(ring);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), toon(0x4a5568));
        leg.position.set(i % 2 ? 0.38 : -0.38, -0.02, i < 2 ? 0.22 : -0.22); g.add(leg);
      }
      g.position.set(x, 3.48, z); g.rotation.y = x > 0 ? 0.5 : -0.35;
      world.add(g);
      return g;
    };
    ac(0.6, -1.7); ac(-3.2, -4.4);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 10), toon(0x7f8ba0));
    pipe.position.set(-2.0, 4.1, -4.8); world.add(pipe);
    const pipeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), toon(0x5d6b84));
    pipeCap.position.set(-2.0, 4.82, -4.8); world.add(pipeCap);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.3, 6), toon(0x3c475c));
    ant.position.set(1.2, 4.15, -4.6); world.add(ant);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), beaconMat);
    beacon.position.set(1.2, 4.84, -4.6); world.add(beacon);
    anims.push(t => { const k = (Math.sin(t * 2.2) + 1) / 2; beaconMat.color.setRGB(0.55 + k * 0.45, 0.12 + k * 0.16, 0.1 + k * 0.1); });
  }

  // 店招(闪灯)——挂在檐口带外侧(z 正方向朝街)
  const signGroup = new THREE.Group();
  {
    const board = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.66, 0.18), toon(0x0d1626));
    board.position.set(-1.75, 2.94, -0.3);
    signGroup.add(board);
    outline(board, 1.045);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.58), new THREE.MeshBasicMaterial({ map: signTex }));
    face.position.set(0, 0, 0.095);
    board.add(face);
    // 霓虹描边(细发光条)
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x6fd8ff });
    const neon = new THREE.Mesh(new THREE.BoxGeometry(5.66, 0.03, 0.03), neonMat);
    neon.position.set(0, -0.36, 0.085); board.add(neon);
    const neon2 = neon.clone(); neon2.position.y = 0.36; board.add(neon2);
    signGroup.userData = { face: face.material, neonMat, board };
    world.add(signGroup);
    // 立杆小灯箱(门口右侧)
    const mini = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.08), toon(0x0d1626));
    mini.position.set(1.82, 1.62, -0.24); mini.rotation.y = -0.25; world.add(mini);
    const miniFace = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.42), new THREE.MeshBasicMaterial({ map: posterTexB }));
    miniFace.position.set(0, 0, 0.045); mini.add(miniFace);
    const miniPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), toon(0x2c3648));
    miniPost.position.set(1.82, 0.82, -0.24); world.add(miniPost);
  }
  const signLight = new THREE.PointLight(0x6fd8ff, 0.85, 8, 2);
  signLight.position.set(-1.75, 2.9, 0.4);
  world.add(signLight);
  // 招牌闪烁节奏
  let flickNext = 4, flickUntil = -1;
  anims.push(t => {
    let v = 0.86 + 0.14 * Math.sin(t * 21.7) * Math.sin(t * 3.1);
    if (t > flickNext) { flickUntil = t + rand(0.12, 0.34); flickNext = t + rand(5, 12); }
    if (t < flickUntil) v *= 0.3 + 0.5 * Math.abs(Math.sin(t * 47));
    const u = signGroup.userData;
    u.face.color.setScalar(v);
    u.neonMat.color.setRGB(0.44 * v, 0.85 * v, 1.0 * v);
    signLight.intensity = 0.85 * v;
  });

  // 玻璃橱窗 + 自动门
  const glassMat = new THREE.MeshPhongMaterial({
    color: 0x9cc4e4, specular: 0xcfe8ff, shininess: 96,
    transparent: true, opacity: 0.16, depthWrite: false,
  });
  const mullion = toon(trimC);
  let doorL, doorR;
  const doorLight = new THREE.PointLight(0xffe2b8, 0.0, 4.5, 2);
  doorLight.position.set(0.95, 1.9, -0.7);
  world.add(doorLight);
  {
    // 底部踢脚 + 上横档
    B(5.16, 0.22, 0.13, trimC, -2.13, 0.25, -0.42);
    B(5.16, 0.16, 0.13, trimC, -2.13, 2.44, -0.42);
    // 门上楣
    B(1.34, 0.3, 0.13, trimC, 0.95, 2.39, -0.42);
    // 竖梃:左侧橱窗 -4.66..0.28
    const xs = [-4.66, -3.56, -2.46, -1.36, -0.26, 0.28, 1.62];
    for (let i = 0; i < xs.length; i++) {
      const isDoorEdge = i === 5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.12), mullion);
      m.position.set(xs[i], 1.32, -0.42); world.add(m);
      if (!isDoorEdge && i < 5) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(xs[i + 1] - xs[i] - 0.1, 2.02, 0.025), glassMat);
        g.position.set((xs[i] + xs[i + 1]) / 2, 1.32, -0.42); world.add(g);
      }
    }
    // 门框竖柱
    B(0.1, 2.2, 0.13, trimC, 0.33, 1.32, -0.42);
    B(0.1, 2.2, 0.13, trimC, 1.57, 1.32, -0.42);
    // 感应器
    B(0.3, 0.08, 0.1, 0x1c2636, 0.95, 2.5, -0.36);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.024, 8), new THREE.MeshBasicMaterial({ color: 0x7fe0a8 }));
    eye.position.set(0.95, 2.5, -0.3); world.add(eye);
    // 两扇玻璃移门
    const mkPanel = (cx) => {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.56, 2.02, 0.035), glassMat);
      glass.position.y = 1.26; g.add(glass);
      const st = toon(0x3a4a63);
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.06, 0.05), st); l1.position.set(-0.28, 1.26, 0); g.add(l1);
      const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.06, 0.05), st); l2.position.set(0.28, 1.26, 0); g.add(l2);
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.05), st); t1.position.set(0, 2.3, 0); g.add(t1);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.09, 0.05), st); b1.position.set(0, 0.26, 0); g.add(b1);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.05), toon(0x8fa0b8));
      bar.position.set(0, 1.05, 0.04); g.add(bar);
      g.position.set(cx, 0, -0.42);
      world.add(g);
      return g;
    };
    doorL = mkPanel(0.66); doorR = mkPanel(1.24);
  }
  // 自动门状态机
  const doorState = { phase: 'idle', k: 0, next: 3.2 };
  anims.push((t, dt) => {
    const s = doorState;
    if (s.phase === 'idle' && t > s.next) { s.phase = 'open'; s.k = 0; }
    if (s.phase === 'open') {
      s.k = Math.min(1, s.k + dt / 0.75);
      const e = easeIO(s.k);
      doorL.position.x = 0.66 - 0.53 * e;
      doorR.position.x = 1.24 + 0.53 * e;
      doorGlowMat.opacity = 0.08 + 0.15 * e;
      doorLight.intensity = 0.7 * e;
      if (s.k >= 1) { s.phase = 'hold'; s.next = t + 2.4; }
    } else if (s.phase === 'hold') {
      if (t > s.next) { s.phase = 'close'; }
    } else if (s.phase === 'close') {
      s.k = Math.max(0, s.k - dt / 0.75);
      const e = easeIO(s.k);
      doorL.position.x = 0.66 - 0.53 * e;
      doorR.position.x = 1.24 + 0.53 * e;
      doorGlowMat.opacity = 0.08 + 0.15 * e;
      doorLight.intensity = 0.7 * e;
      if (s.k <= 0) { s.phase = 'idle'; s.next = t + rand(4.5, 8.5); }
    }
  });
  // 门口地垫
  {
    const mat0 = B(1.34, 0.024, 0.62, 0x1e3a34, 0.95, PLAZA_Y + 0.012, -0.02);
    B(1.4, 0.012, 0.68, 0x16302b, 0.95, PLAZA_Y + 0.006, -0.02);
    // 垫上字
    const welcome = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 96, (g) => {
        g.clearRect(0, 0, 256, 96);
        g.fillStyle = 'rgba(210,235,225,.85)';
        g.font = '600 44px "PingFang SC",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('いらっしゃい', 128, 50);
      }), transparent: true,
    }));
    welcome.rotation.x = -Math.PI / 2; welcome.position.set(0.95, PLAZA_Y + 0.026, -0.02);
    world.add(welcome);
  }

  // 雨棚(条纹) + 檐口滴水
  const dripSpots = [];
  {
    const awnTex = canvasTex(256, 64, (g) => {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? '#22485a' : '#e8e2d2';
        g.fillRect(i * 16, 0, 16, 64);
      }
    });
    awnTex.wrapS = THREE.RepeatWrapping; awnTex.repeat.set(2, 1);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 1.05),
      new THREE.MeshToonMaterial({ map: awnTex, gradientMap: gradMap }));
    awn.position.set(-1.6, 2.36, 0.1);
    awn.rotation.x = 0.14;
    world.add(awn);
    const awnEdge = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.09, 0.06), toon(0x1a3a48));
    awnEdge.position.set(-1.6, 2.28, 0.62); awnEdge.rotation.x = 0.14; world.add(awnEdge);
    // 雨棚支架
    for (const x of [-4.4, -1.6, 1.2]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), toon(0x3a465c));
      rod.position.set(x, 2.72, -0.22); rod.rotation.x = 0.5; world.add(rod);
    }
    for (let i = 0; i < 7; i++) dripSpots.push({ x: -4.6 + i * 0.98 + rand(-0.1, 0.1), z: 0.63 });
  }

  // ================= 店内(透过橱窗可见的温暖世界) =================
  const INT_FLOOR = PLAZA_Y + 0.02;
  {
    const floorMat = new THREE.MeshToonMaterial({ color: 0xd8d0bd, gradientMap: gradMap, emissive: 0x6a5c44, emissiveIntensity: 0.42 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.32, 0.04, 4.72), floorMat);
    floor.position.set(-1.6, INT_FLOOR, -2.9); world.add(floor);
    const ceilMat = new THREE.MeshToonMaterial({ color: 0xefe9da, gradientMap: gradMap, emissive: 0x8a7c60, emissiveIntensity: 0.4 });
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(6.32, 0.08, 4.72), ceilMat);
    ceil.position.set(-1.6, 2.98, -2.9); world.add(ceil);
    // 顶部灯带
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2 });
    for (const x of [-3.5, -1.6, 0.5]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.55), panelMat);
      p.position.set(x, 2.93, -2.9); world.add(p);
    }
    const warm1 = new THREE.PointLight(0xffe2b8, 1.35, 8.5, 2);
    warm1.position.set(-2.8, 2.5, -3.2); world.add(warm1);
    const warm2 = new THREE.PointLight(0xffe2b8, 1.2, 8, 2);
    warm2.position.set(0.4, 2.5, -1.8); world.add(warm2);
    const warm3 = new THREE.PointLight(0xffd9a8, 0.8, 5, 2);
    warm3.position.set(-3.0, 2.2, -1.3); world.add(warm3);
  }
  // 靠墙货架 ×2(带商品)
  const goodsBoxGeo = new THREE.BoxGeometry(0.17, 0.2, 0.13);
  const goodsBottleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8);
  const goodsSlots = [];   // {x,y,z,type}
  const shelfBoardMat = toon(0xe8e0cc);
  const shelfFrameMat = toon(0xcfc6ae);
  const mkShelfUnit = (x0, x1, z, tiers, h0, h1, backPanel) => {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    if (backPanel) B(len, h1 - h0 + 0.3, 0.05, 0xd2c9b2, cx, (h0 + h1) / 2 + 0.12, z - 0.14);
    // 两侧立柱
    for (const px of [x0, x1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, h1 - h0, 0.4), shelfFrameMat);
      p.position.set(px, (h0 + h1) / 2, z); world.add(p);
    }
    for (let i = 0; i < tiers; i++) {
      const y = h0 + (i / (tiers - 1)) * (h1 - h0);
      const board = new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, 0.045, 0.42), shelfBoardMat);
      board.position.set(cx, y, z); world.add(board);
      // 价格条(暖黄)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len - 0.14, 0.028, 0.02), toon(0xf0b050));
      rail.position.set(cx, y - 0.05, z + 0.21); world.add(rail);
      // 商品位
      for (let gx = x0 + 0.16; gx < x1 - 0.12; gx += 0.2) {
        goodsSlots.push({ x: gx + rand(-0.015, 0.015), y: y + 0.13, z: z + rand(-0.04, 0.04), type: Math.random() < 0.3 ? 1 : 0, ry: rand(-0.08, 0.08) });
      }
    }
  };
  mkShelfUnit(-4.55, -2.35, -5.15, 4, 0.42, 2.1, true);
  mkShelfUnit(-2.1, 0.35, -5.15, 4, 0.42, 2.1, true);
  // 中岛双面货架 ×2
  const gondola = (x0, x1, z) => {
    mkShelfUnit(x0, x1, z - 0.11, 3, 0.35, 1.42, false);
    mkShelfUnit(x0, x1, z + 0.11, 3, 0.35, 1.42, false);
    const top = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.6), shelfBoardMat);
    top.position.set((x0 + x1) / 2, 1.5, z); world.add(top);
  };
  gondola(-3.85, -1.55, -3.55);
  gondola(-3.85, -1.55, -2.6);
  // 饮料柜(左墙,青白光)
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.05, 2.72), toon(0xe4e8ec));
    body.position.set(0, 1.16, 0); g.add(body);
    outline(body, 1.04);
    const glassF = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.72, 2.56), glassMat);
    glassF.position.set(0.32, 1.2, 0); g.add(glassF);
    const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.7), new THREE.MeshBasicMaterial({ color: 0xeaf8ff }));
    backGlow.rotation.y = -Math.PI / 2; backGlow.position.set(-0.28, 1.2, 0); g.add(backGlow);
    for (let i = 0; i < 4; i++) {
      const y = 0.5 + i * 0.42;
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 2.5), toon(0xdfe4ea));
      board.position.set(0, y, 0); g.add(board);
      for (let bz = -1.15; bz <= 1.15; bz += 0.17) {
        goodsSlots.push({ x: -4.62 + rand(-0.02, 0.02), y: y + 0.11, z: bz + rand(-0.02, 0.02), type: 1, ry: 0, cooler: true });
      }
    }
    g.position.set(-4.64, 0, -3.55);
    world.add(g);
    const coolLight = new THREE.PointLight(0xbfe8ff, 0.5, 3.5, 2);
    coolLight.position.set(-4.2, 1.4, -3.5); world.add(coolLight);
    anims.push(t => { coolLight.intensity = 0.46 + 0.06 * Math.sin(t * 1.7); });
  }
  // 便当岛(橱窗前,最有食欲的一块)
  {
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.78, 0.88), toon(0xe4ddc9));
    table.position.set(-3.0, INT_FLOOR + 0.41, -1.35); world.add(table);
    outline(table, 1.035);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 0.94), toon(0xf2ecda));
    top.position.set(-3.0, INT_FLOOR + 0.82, -1.35); world.add(top);
    const bentoCols = ['#43382e', '#2c303c', '#4c3a2c', '#38302c'];
    for (let i = 0; i < 5; i++) {
      const bx = -3.68 + (i % 3) * 0.36, bz = -1.62 + Math.floor(i / 3) * 0.3;
      const bento = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.22), toon(bentoCols[i % 4]));
      bento.position.set(bx, INT_FLOOR + 0.89, bz); world.add(bento);
      const label = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.1), toon(0xf0ead8));
      label.position.set(bx, INT_FLOOR + 0.945, bz); world.add(label);
    }
    // 饭团(三角柱 + 海苔)
    for (let i = 0; i < 4; i++) {
      const on = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 3), toon(0xf6f4ee));
      on.position.set(-3.0 + (i % 2) * 0.3, INT_FLOOR + 0.9, -1.18 + Math.floor(i / 2) * 0.24);
      on.rotation.y = 0.5; world.add(on);
      const nori = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), toon(0x1c2830));
      nori.position.set(on.position.x, INT_FLOOR + 0.9, on.position.z + 0.075); world.add(nori);
    }
    // 三明治
    for (let i = 0; i < 3; i++) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.12), toon(0xe8d8a8));
      sw.position.set(-2.4, INT_FLOOR + 0.88, -1.55 + i * 0.18); world.add(sw);
    }
  }
  // 收银台(门左侧)+ 咖啡机 + 关东煮
  {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.92, 0.6), toon(0xe9e2cf));
    counter.position.set(-0.35, INT_FLOOR + 0.48, -1.05); world.add(counter);
    outline(counter, 1.035);
    const ctop = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.05, 0.68), toon(0xf4eedd));
    ctop.position.set(-0.35, INT_FLOOR + 0.96, -1.05); world.add(ctop);
    // 收银机
    const reg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.3), toon(0x2c3648));
    reg.position.set(0.05, INT_FLOOR + 1.07, -1.1); world.add(reg);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.03), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
    scr.position.set(0.05, INT_FLOOR + 1.18, -0.94); scr.rotation.x = -0.3; world.add(scr);
    // 购物篮
    for (let i = 0; i < 3; i++) {
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.22), toon(0x3a8a5c));
      bk.position.set(-0.95, INT_FLOOR + 1.02 + i * 0.075, -1.0); world.add(bk);
    }
    // 咖啡机
    const cof = new THREE.Group();
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.32), toon(0x8c3a34));
    cbody.position.y = 0.24; cof.add(cbody);
    const cface = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.02), toon(0xd8d2c4));
    cface.position.set(0, 0.22, 0.17); cof.add(cface);
    const cspout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 8), toon(0x2c3648));
    cspout.position.set(0, 0.06, 0.14); cof.add(cspout);
    cof.position.set(-0.85, INT_FLOOR + 0.985, -1.05);
    world.add(cof);
    // 关东煮柜(暖光 + 热气)
    const oden = new THREE.Group();
    const obase = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.46), toon(0xd8dee6));
    obase.position.y = 0.2; oden.add(obase);
    const oglass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.02), glassMat);
    oglass.position.set(0, 0.34, 0.235); oden.add(oglass);
    const osoup = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.38), new THREE.MeshBasicMaterial({ color: 0xe8c890 }));
    osoup.rotation.x = -Math.PI / 2; osoup.position.y = 0.38; oden.add(osoup);
    const ingCols = ['#e8dcc8', '#c8a070', '#8fa8b8', '#e8e0d0'];
    for (let i = 0; i < 4; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 10), toon(ingCols[i]));
      cup.position.set(-0.18 + i * 0.12, 0.42, rand(-0.08, 0.08)); oden.add(cup);
    }
    oden.position.set(-1.5, INT_FLOOR, -0.78);
    world.add(oden);
    outline(obase, 1.05);
    const odenLight = new THREE.PointLight(0xffbe80, 0.35, 2.5, 2);
    odenLight.position.set(-1.5, INT_FLOOR + 0.9, -0.78); world.add(odenLight);
    // 热气(3 缕)
    const steams = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTex, color: 0xe8f0f4, transparent: true, opacity: 0, depthWrite: false,
      }));
      sp.position.set(-1.5 + rand(-0.12, 0.12), INT_FLOOR + 0.6, -0.78 + rand(-0.1, 0.1));
      sp.scale.setScalar(0.16);
      world.add(sp);
      steams.push({ sp, ph: i * 0.8, sp0: sp.position.clone() });
    }
    anims.push(t => {
      for (const s of steams) {
        const k = ((t * 0.32 + s.ph) % 1);
        s.sp.position.y = s.sp0.y + k * 0.75;
        s.sp.position.x = s.sp0.x + Math.sin(t * 1.8 + s.ph * 7) * 0.05;
        const sc = 0.14 + k * 0.3;
        s.sp.scale.setScalar(sc);
        s.sp.material.opacity = 0.26 * Math.sin(Math.PI * k);
      }
    });
  }
  // 杂志架 + 后场门 + 店内灯箱 + 玻璃海报 + 地面导视
  {
    const rack = new THREE.Group();
    const rbody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.15, 0.4), toon(0xcfc8b4));
    rbody.position.y = 0.575; rack.add(rbody);
    const magCols = ['#e8604a', '#3a7fc8', '#e8a030', '#3a8a5c', '#8a5cc8', '#d84a7c', '#4ac8c0', '#e8d850'];
    for (let i = 0; i < 8; i++) {
      const mg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.015), toon(magCols[i]));
      mg.position.set(-0.21 + (i % 4) * 0.14, 0.42 + Math.floor(i / 4) * 0.32, 0.21);
      mg.rotation.x = -0.22; rack.add(mg);
    }
    rack.position.set(1.28, INT_FLOOR, -2.35); rack.rotation.y = -Math.PI / 2;
    world.add(rack);
    // 后场门
    const staff = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.92, 0.06), toon(0x9aa2b2));
    staff.position.set(0.85, INT_FLOOR + 0.98, -5.4); world.add(staff);
    const spush = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.04), toon(0x6a7484));
    spush.position.set(0.85, INT_FLOOR + 1.0, -5.36); world.add(spush);
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshBasicMaterial({ color: 0xf0ece0 }));
    sgn.position.set(0.85, INT_FLOOR + 1.62, -5.36); world.add(sgn);
    // 店内灯箱菜单
    const lb = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.44, 0.06), toon(0x2c3648));
    lb.position.set(-2.2, 2.3, -5.4); world.add(lb);
    const lbFace = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.36), new THREE.MeshBasicMaterial({ map: menuTex }));
    lbFace.position.set(0, 0, 0.035); lb.add(lbFace);
    // 橱窗内侧海报
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.72), new THREE.MeshBasicMaterial({ map: posterTexA }));
    p1.position.set(-3.95, 1.62, -0.5); world.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.72), new THREE.MeshBasicMaterial({ map: posterTexB }));
    p2.position.set(-0.85, 1.68, -0.5); world.add(p2);
    // 地面导视贴条
    const tape = toon(0x3a9a6c);
    for (const z of [-0.72, -1.0]) {
      const tp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.012, 0.07), tape);
      tp.position.set(0.95, INT_FLOOR + 0.026, z); world.add(tp);
    }
  }
  // 商品实例化(货架 + 柜内饮料)
  {
    const N = goodsSlots.length;
    const boxes = new THREE.InstancedMesh(goodsBoxGeo, new THREE.MeshToonMaterial({ gradientMap: gradMap }), N);
    const bottles = new THREE.InstancedMesh(goodsBottleGeo, new THREE.MeshToonMaterial({ gradientMap: gradMap }), N);
    const palette = [0xe8a0a8, 0xa8c8e8, 0xe8d8a0, 0xa8e0c0, 0xe8b890, 0xc0a8e0, 0xf0f0e8, 0xe87a70, 0x7fc8d8, 0xf0c860];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    const C = new THREE.Color();
    let bi = 0, li = 0;
    for (const s of goodsSlots) {
      P.set(s.x, s.y, s.z);
      Q.setFromEuler(new THREE.Euler(0, s.ry || 0, 0));
      if (s.type === 1) {
        S.set(1, rand(0.9, 1.12), 1);
        M.compose(P, Q, S); bottles.setMatrixAt(li, M);
        bottles.setColorAt(li, C.set(palette[Math.floor(Math.random() * palette.length)]));
        li++;
      } else {
        S.set(rand(0.85, 1.15), rand(0.8, 1.2), rand(0.9, 1.1));
        M.compose(P, Q, S); boxes.setMatrixAt(bi, M);
        boxes.setColorAt(bi, C.set(palette[Math.floor(Math.random() * palette.length)]));
        bi++;
      }
    }
    boxes.count = bi; bottles.count = li;
    boxes.instanceMatrix.needsUpdate = true; bottles.instanceMatrix.needsUpdate = true;
    world.add(boxes); world.add(bottles);
  }

  // ================= 街角陈设 =================
  // 小组阴影(假 AO)
  const blobShadow = (x, z, r, y, o) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({
      color: 0x060a14, transparent: true, opacity: o == null ? 0.32 : o, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.scale.set(r, r * 0.8, 1);
    m.renderOrder = 1;
    world.add(m);
    return m;
  };
  // 自动贩卖机(正红,经典)
  {
    const v = new THREE.Group();
    const mats = [toon(0xb8382e), toon(0xb8382e), toon(0xc94238), toon(0xa83228),
      new THREE.MeshBasicMaterial({ map: vendTex }), toon(0xb8382e)];
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.86, 0.72), mats);
    body.position.y = 0.93; v.add(body);
    outline(body, 1.035);
    // 顶部灯带
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.07, 0.74), new THREE.MeshBasicMaterial({ color: 0xfff2dc }));
    strip.position.y = 1.9; v.add(strip);
    v.position.set(2.18, PLAZA_Y, 0.08);
    v.rotation.y = 0.06;
    world.add(v);
    blobShadow(2.18, 0.14, 0.62, PLAZA_Y + 0.015, 0.3);
    const vlight = new THREE.PointLight(0xffd8c0, 0.32, 3, 2);
    vlight.position.set(2.18, 1.5, 0.75); world.add(vlight);
    anims.push(t => { vlight.intensity = 0.3 + 0.05 * Math.sin(t * 2.3); });
  }
  // 自行车(靠柱停放)
  {
    const bi = new THREE.Group();
    const tireM = toon(0x22262e), frameM = toon(0x4a80aa), metal = toon(0x9aa4b4);
    const wheel = (x, z) => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.028, 8, 24), tireM);
      w.rotation.y = Math.PI / 2; w.position.set(x, 0.27, z); bi.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), metal);
      hub.rotation.z = Math.PI / 2; hub.position.set(x, 0.27, z); bi.add(hub);
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.5, 0.01), metal);
        sp.position.set(x, 0.27, z); sp.rotation.x = i * Math.PI / 3; bi.add(sp);
      }
    };
    wheel(0, 0.52); wheel(0, -0.52);
    const tube = (a, b, r) => {
      const v1 = new THREE.Vector3().copy(a), v2 = new THREE.Vector3().copy(b);
      const d = v2.clone().sub(v1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r || 0.022, r || 0.022, d.length(), 6), frameM);
      m.position.copy(v1).add(v2).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      bi.add(m);
    };
    tube(new THREE.Vector3(0, 0.27, 0.52), new THREE.Vector3(0, 0.72, 0.05));
    tube(new THREE.Vector3(0, 0.72, 0.05), new THREE.Vector3(0, 0.82, -0.42));
    tube(new THREE.Vector3(0, 0.27, -0.52), new THREE.Vector3(0, 0.72, 0.05));
    tube(new THREE.Vector3(0, 0.27, -0.52), new THREE.Vector3(0, 0.82, -0.42));
    tube(new THREE.Vector3(0, 0.86, 0.5), new THREE.Vector3(0, 0.82, -0.42));
    // 车把 / 车座 / 筐
    tube(new THREE.Vector3(0, 0.82, -0.42), new THREE.Vector3(0, 0.95, -0.52));
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), metal);
    hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.97, -0.54); bi.add(hb);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.26), toon(0x1c222c));
    seat.position.set(0, 0.86, 0.18); bi.add(seat);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.18), toon(0x5a6472));
    basket.position.set(0, 0.78, -0.52); bi.add(basket);
    bi.position.set(2.82, PLAZA_Y, -0.42);
    bi.rotation.y = 0.42;
    world.add(bi);
    blobShadow(2.82, -0.42, 0.6, PLAZA_Y + 0.015, 0.26);
  }
  // 雨伞架(门口,插着三把伞)
  {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.42, 14, 1, true), toon(0x2c5a50));
    shell.position.y = 0.21; g.add(shell);
    const baseD = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14), toon(0x244a42));
    baseD.position.y = 0.015; g.add(baseD);
    const umCols = [0xc85450, 0x3a6ea8, 0xd8b04a];
    umCols.forEach((c, i) => {
      const a = i * 2.1;
      const um = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.78, 6), toon(c));
      um.position.set(Math.cos(a) * 0.05, 0.48, Math.sin(a) * 0.05);
      um.rotation.z = Math.cos(a) * 0.1; um.rotation.x = Math.sin(a) * 0.1;
      g.add(um);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 8), toon(c));
      tip.position.set(um.position.x + Math.sin(um.rotation.z) * -0.36, 0.86, um.position.z);
      g.add(tip);
    });
    g.position.set(1.78, PLAZA_Y, -0.1);
    world.add(g);
  }
  // 垃圾桶
  {
    const bin = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.72, 0.3), toon(0x55616e));
    bodyM.position.y = 0.36; bin.add(bodyM);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.32), toon(0xe8e2d2));
    band.position.y = 0.58; bin.add(band);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.02), toon(0x1c222c));
    slot.position.set(0, 0.72, 0.15); bin.add(slot);
    bin.position.set(2.85, PLAZA_Y, 0.14);
    world.add(bin);
    blobShadow(2.85, 0.14, 0.3, PLAZA_Y + 0.015, 0.3);
  }
  // 电线杆 ×3 + 变压器 + 电线(弧垂)
  const poleTop = (x, z, h) => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, h, 10), toon(0x4c5464));
    p.position.y = h / 2; g.add(p);
    const armY = h - 0.5;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), toon(0x4c5464));
    arm.position.y = armY; g.add(arm);
    for (const ix of [-0.36, -0.12, 0.12, 0.36]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 6), toon(0xd8dce2));
      ins.position.set(ix, armY + 0.08, 0); g.add(ins);
    }
    g.position.set(x, PLAZA_Y, z);
    world.add(g);
    blobShadow(x, z, 0.34, PLAZA_Y + 0.015, 0.34);
    return g;
  };
  const poleA = poleTop(-5.35, -0.15, 4.6);
  const poleB = poleTop(3.0, 0.42, 4.3);
  const poleC = poleTop(5.55, 2.55, 3.7);
  {
    // 变压器(杆 A)
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.52, 12), toon(0x59616e));
    tr.position.set(-5.35, 3.45, -0.15); world.add(tr);
    const trTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 10), toon(0x4a5262));
    trTop.position.set(-5.35, 3.76, -0.15); world.add(trTop);
    // 接线盒
    const jb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.12), toon(0x7c8496));
    jb.position.set(-5.23, 2.3, -0.15); world.add(jb);
  }
  const wireMat = toon(0x0a0d14);
  const wire = (a, b, sag) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.013, 5, false), wireMat);
    world.add(m);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  wire(V(-5.35, 4.0, -0.15), V(3.0, 3.75, 0.42), 0.42);
  wire(V(-5.35, 4.12, -0.15), V(3.0, 3.87, 0.42), 0.4);
  wire(V(3.0, 3.75, 0.42), V(5.55, 3.2, 2.55), 0.3);
  wire(V(3.0, 3.87, 0.42), V(5.55, 3.32, 2.55), 0.28);
  wire(V(-5.35, 4.06, -0.15), V(-4.95, 3.42, -0.42), 0.12);
  wire(V(3.0, 3.7, 0.42), V(1.75, 3.44, -0.42), 0.18);
  wire(V(5.55, 3.2, 2.55), V(5.85, 2.32, 5.4), 0.2);

  // 路灯(暖光 + 光锥)
  {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.0, 8), toon(0x39435c));
    p.position.y = 1.5; g.add(p);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8), toon(0x39435c));
    arm.rotation.x = Math.PI / 2 - 0.25;
    arm.position.set(0, 3.02, 0.5); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.3), toon(0x2c3446));
    head.position.set(0, 3.05, 1.02); g.add(head);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), new THREE.MeshBasicMaterial({ color: 0xffdca6 }));
    bulb.position.set(0, 2.99, 1.02); g.add(bulb);
    g.position.set(-5.05, PLAZA_Y, 0.3);
    world.add(g);
    outline(head, 1.1);
    blobShadow(-5.05, 0.3, 0.3, PLAZA_Y + 0.015, 0.3);
    const lampLight = new THREE.PointLight(0xffcf96, 1.2, 8.5, 2);
    lampLight.position.set(-5.05, 2.9, 1.15);
    world.add(lampLight);
    anims.push(t => { lampLight.intensity = 1.15 + 0.06 * Math.sin(t * 6.1) + 0.03 * Math.sin(t * 23); });
    // 光锥
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.9, 20, 1, true), new THREE.MeshBasicMaterial({
      color: 0xffcf96, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    cone.position.set(-5.05, 1.6, 1.15);
    world.add(cone);
  }
  // 交通信号灯(远端,红绿微变)
  let tlMats, tlLight;
  {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 3.1, 8), toon(0x39435c));
    p.position.y = 1.55; g.add(p);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), toon(0x39435c));
    arm.rotation.z = Math.PI / 2; arm.position.set(-0.42, 3.0, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.2), toon(0x1c2436));
    head.position.set(-0.85, 2.85, 0); g.add(head);
    outline(head, 1.12);
    const mk = (y, c) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(0, y, 0.105);
      head.add(m);
      return m.material;
    };
    tlMats = [mk(0.24, 0x552222), mk(0, 0x554422), mk(-0.24, 0x225533)];
    g.position.set(5.55, PLAZA_Y, -2.4);
    world.add(g);
    tlLight = new THREE.PointLight(0xff5a4a, 0.35, 4, 2);
    tlLight.position.set(4.6, 2.7, -2.3);
    world.add(tlLight);
  }
  anims.push(t => {
    const ph = (t * 0.11) % 1;
    let r = 0.14, a = 0.14, g = 0.14, lc = 0xff5a4a;
    if (ph < 0.42) { r = 1; }
    else if (ph < 0.5) { a = 1; lc = 0xffc257; }
    else if (ph < 0.92) { g = 1; lc = 0x57e07f; }
    else { a = 1; lc = 0xffc257; }
    const pulse = 0.82 + 0.18 * Math.sin(t * 5.3);
    tlMats[0].color.setRGB(0.55 * r * pulse + 0.06, 0.12 * r + 0.08, 0.1 * r + 0.07);
    tlMats[1].color.setRGB(0.9 * a * pulse + 0.08, 0.62 * a * pulse + 0.08, 0.12 * a + 0.06);
    tlMats[2].color.setRGB(0.1 * g + 0.06, 0.85 * g * pulse + 0.1, 0.4 * g * pulse + 0.08);
    tlLight.color.setHex(lc);
    tlLight.intensity = 0.3 + 0.12 * pulse;
    trafficStreak.material.color.setHex(lc);
    trafficStreak.material.opacity = 0.1 + 0.09 * pulse;
  });

  // 路牌(止まれ 倒三角 + 蓝色指示牌)
  {
    const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 2.1, 8), toon(0x8a94a6));
    pole1.position.set(0.9, PLAZA_Y + 1.05, 0.58); world.add(pole1);
    const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 3), toon(0xd84a3a));
    tri.rotation.x = Math.PI / 2; tri.rotation.y = Math.PI; tri.position.set(0.9, 2.25, 0.58);
    tri.scale.z = 0.3; world.add(tri);
    const triW = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.03, 3), toon(0xf0ede4));
    triW.rotation.copy(tri.rotation); triW.position.set(0.9, 2.25, 0.545); triW.scale.z = 0.3; world.add(triW);
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 2.3, 8), toon(0x8a94a6));
    pole2.position.set(5.56, PLAZA_Y + 1.15, -0.5); world.add(pole2);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.03), toon(0x2a6ac8));
    sq.position.set(5.56, 2.42, -0.5); sq.rotation.y = Math.PI / 4; world.add(sq);
    const sqBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.035), toon(0xf0ede4));
    sqBar.position.set(5.56, 2.42, -0.495); sqBar.rotation.y = Math.PI / 4; world.add(sqBar);
  }
  // 街角护栏(右路外侧)
  {
    const railM = toon(0x97a5b8);
    const mkRail = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      for (let d = 0; d <= len; d += 0.78) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.6, 0.055), railM);
        post.position.set(x0 + dx * (d / len), PLAZA_Y + 0.3, z0 + dz * (d / len));
        world.add(post);
      }
      for (const ry of [0.42, 0.62]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, len), railM);
        r.position.set((x0 + x1) / 2, PLAZA_Y + ry, (z0 + z1) / 2);
        r.rotation.y = ang;
        world.add(r);
      }
    };
    mkRail(5.42, -5.6, 5.42, 2.7);
    mkRail(-5.9, 3.14, -2.4, 3.14);
  }
  // 公告栏(玻璃橱窗式)
  {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.24, 0.1), toon(0x6a7690));
    frame.position.y = 1.08; g.add(frame);
    outline(frame, 1.05);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.08, 0.02), glassMat);
    glass.position.set(0, 0, 0.055); frame.add(glass);
    const inner = [0xe8a030, 0x3a7fc8, 0xd84a7c];
    for (let i = 0; i < 3; i++) {
      const pp = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), toon(inner[i]));
      pp.position.set(-0.26 + i * 0.26, 0.05, 0.042); frame.add(pp);
    }
    for (const px of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), toon(0x4a5568));
      leg.position.set(px, -0.82, 0); frame.add(leg);
    }
    g.position.set(-5.32, PLAZA_Y, -1.6);
    g.rotation.y = -0.3;
    world.add(g);
    blobShadow(-5.32, -1.6, 0.55, PLAZA_Y + 0.015, 0.3);
  }
  // 盆栽 ×2
  {
    const plant = (x, z, s) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 10), toon(0x8a5a3c));
      pot.position.y = 0.11; g.add(pot);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10), toon(0x2c2420));
      soil.position.y = 0.22; g.add(soil);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(rand(0.07, 0.12), 8, 6), toon(0x3f7a4a));
        leaf.position.set(rand(-0.08, 0.08), 0.3 + rand(0, 0.18), rand(-0.08, 0.08));
        leaf.scale.y = 1.25; g.add(leaf);
      }
      g.position.set(x, PLAZA_Y, z); g.scale.setScalar(s);
      world.add(g);
    };
    plant(-0.28, -0.14, 1);
    plant(2.9, -0.12, 0.85);
  }
  // 小巷:空调外机 + 墙上海报 + 垃圾袋 + 纸箱
  {
    const acu = new THREE.Group();
    const abody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.6), toon(0xb0bac8));
    abody.position.y = 1.62; acu.add(abody);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 14), toon(0x273044));
    fan.rotation.z = Math.PI / 2; fan.position.set(0.14, 1.62, 0); acu.add(fan);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 18), toon(0x7c8798));
    ring.rotation.y = Math.PI / 2; ring.position.set(0.135, 1.62, 0); acu.add(ring);
    const drip1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5), toon(0x2c3852));
    drip1.position.set(0.125, 1.2, 0.26); acu.add(drip1);
    acu.position.set(1.73, 0, -1.15);
    world.add(acu);
    const ap = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.72), new THREE.MeshBasicMaterial({ map: alleyPosterTex }));
    ap.rotation.y = Math.PI / 2;
    ap.position.set(1.68, 1.55, -3.1);
    world.add(ap);
    // 垃圾袋
    for (const p of [[2.55, -3.5, 0.19], [2.78, -3.72, 0.15]]) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(p[2], 9, 7), toon(0x1a2030));
      bag.scale.y = 0.72; bag.position.set(p[0], PLAZA_Y + p[2] * 0.62, p[1]);
      world.add(bag);
    }
    // 纸箱堆
    for (let i = 0; i < 3; i++) {
      const bx = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.34), toon(0x8a7048));
      bx.position.set(2.62 + (i % 2) * 0.06, PLAZA_Y + 0.15 + Math.floor(i / 2) * 0.31, -4.5 + (i % 2) * 0.4);
      bx.rotation.y = rand(-0.2, 0.2);
      world.add(bx);
    }
    // 巷内湿痕
    const wet = new THREE.Mesh(new THREE.CircleGeometry(1, 18), puddleMat);
    wet.rotation.x = -Math.PI / 2;
    wet.position.set(2.5, PLAZA_Y + 0.012, -2.6);
    wet.scale.set(0.8, 1.5, 1);
    world.add(wet);
  }

  // ================= 夜空 / 雨 / 涟漪 =================
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(64, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP;
        void main(){
          float h = clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(vec3(0.016,0.024,0.05), vec3(0.043,0.063,0.11), smoothstep(0.0,0.34,h));
          col = mix(col, vec3(0.075,0.11,0.19), smoothstep(0.34,0.72,h));
          col = mix(col, vec3(0.10,0.145,0.24), smoothstep(0.72,1.0,h));
          float glow = pow(max(1.0 - abs(normalize(vP).y - 0.02) * 4.0, 0.0), 3.0);
          col += vec3(0.10,0.13,0.19) * glow * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    world.add(sky);
  }
  // 雨(LineSegments 斜落)
  const RAIN_N = 620;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainSpd = new Float32Array(RAIN_N);
  const rainX = new Float32Array(RAIN_N), rainY = new Float32Array(RAIN_N), rainZ = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i++) {
    rainX[i] = rand(-7.6, 7.6); rainY[i] = rand(0.3, 13); rainZ[i] = rand(-7.6, 7.6);
    rainSpd[i] = rand(8.5, 13.5);
  }
  const rainGeo = new THREE.BufferGeometry();
  const rainAttr = new THREE.BufferAttribute(rainPos, 3);
  rainAttr.setUsage(THREE.DynamicDrawUsage);
  rainGeo.setAttribute('position', rainAttr);
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
    color: 0x9dbde0, transparent: true, opacity: 0.32,
  }));
  rain.frustumCulled = false;
  world.add(rain);
  anims.push((t, dt) => {
    for (let i = 0; i < RAIN_N; i++) {
      rainY[i] -= rainSpd[i] * dt;
      rainX[i] += dt * 0.55;
      // 落到地面 / 落到屋顶(建筑体块内)都重置,避免"室内下雨"
      const onRoof = rainY[i] < 3.5 && rainX[i] > -5.0 && rainX[i] < 1.8 && rainZ[i] > -5.6 && rainZ[i] < -0.25;
      if (rainY[i] < 0.12 || onRoof) {
        rainY[i] += 12.8;
        rainX[i] = rand(-7.6, 7.6); rainZ[i] = rand(-7.6, 7.6);
      }
      const i6 = i * 6;
      rainPos[i6] = rainX[i]; rainPos[i6 + 1] = rainY[i]; rainPos[i6 + 2] = rainZ[i];
      rainPos[i6 + 3] = rainX[i] - 0.045; rainPos[i6 + 4] = rainY[i] + 0.3; rainPos[i6 + 5] = rainZ[i];
    }
    rainAttr.needsUpdate = true;
  });
  // 地面涟漪池
  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.3, 0.37, 20);
  const rippleSpots = [];
  puddles.forEach(p => rippleSpots.push([p.position.x + rand(-0.2, 0.2), p.position.z + rand(-0.15, 0.15), p.position.y + 0.008]));
  for (let i = 0; i < 12; i++) rippleSpots.push([rand(-5.5, 5.5), rand(0.9, 2.8), ROAD_Y + 0.028]);
  for (let i = 0; i < 5; i++) rippleSpots.push([rand(3.4, 5.2), rand(-5.5, 0.6), ROAD_Y + 0.028]);
  for (let i = 0; i < 18; i++) {
    const spot = rippleSpots[i % rippleSpots.length];
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({
      color: 0xa8cce8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(spot[0] + rand(-0.1, 0.1), spot[2], spot[1]);
    m.renderOrder = 4;
    world.add(m);
    ripples.push({ m, t: Math.random() * 1.4, dur: rand(0.85, 1.5) });
  }
  anims.push((t, dt) => {
    for (const r of ripples) {
      r.t += dt;
      const k = (r.t % r.dur) / r.dur;
      r.m.scale.setScalar(0.22 + k * 1.05);
      r.m.material.opacity = 0.34 * (1 - k) * Math.min(1, k / 0.05);
    }
  });
  // 檐口滴水(雨棚前缘 → 地面小涟漪)
  {
    const dropGeo = new THREE.BoxGeometry(0.02, 0.15, 0.02);
    const drips = dripSpots.map((s, i) => {
      const m = new THREE.Mesh(dropGeo, new THREE.MeshBasicMaterial({ color: 0xbcd8f0, transparent: true, opacity: 0 }));
      m.position.set(s.x, 2.3, s.z);
      world.add(m);
      const rp = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({
        color: 0xa8cce8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      rp.rotation.x = -Math.PI / 2;
      rp.position.set(s.x, PLAZA_Y + 0.03, s.z + 0.05);
      rp.renderOrder = 4;
      world.add(rp);
      return { m, rp, next: 1 + i * 0.7, fall: 0, falling: false };
    });
    anims.push((t, dt) => {
      for (const d of drips) {
        if (!d.falling) {
          if (t > d.next) { d.falling = true; d.fall = 0; d.m.visible = true; }
        } else {
          d.fall += dt;
          const y = 2.3 - d.fall * 6.2;
          if (y <= PLAZA_Y + 0.1) {
            d.falling = false;
            d.m.visible = false;
            d.next = t + rand(0.5, 1.6);
            d.rp.scale.setScalar(0.1);
            d.rp.material.opacity = 0.4;
            d.rk = 0;
          } else {
            d.m.position.y = y;
            d.m.material.opacity = 0.55;
          }
        }
        if (d.rk != null) {
          d.rk += dt;
          const k = d.rk / 0.6;
          if (k >= 1) { d.rp.material.opacity = 0; d.rk = null; }
          else {
            d.rp.scale.setScalar(0.1 + k * 0.55);
            d.rp.material.opacity = 0.38 * (1 - k);
          }
        }
      }
    });
  }
  // 玻璃上的雨水滑痕(自动门玻璃 + 橱窗)
  {
    const streakGeo = new THREE.PlaneGeometry(0.016, 0.42);
    const streaks = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({
        color: 0xd8ecfa, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      const bx = i < 5 ? rand(-4.4, -0.5) : rand(0.45, 1.45);
      m.position.set(bx, 1.4, -0.36);
      m.renderOrder = 5;
      world.add(m);
      streaks.push({ m, ph: Math.random(), spd: rand(0.1, 0.2), x0: bx });
    }
    anims.push(t => {
      for (const s of streaks) {
        const k = (t * s.spd + s.ph) % 1;
        s.m.position.y = 2.3 - k * 1.95;
        s.m.position.x = s.x0 + Math.sin(t * 1.7 + s.ph * 9) * 0.02;
        s.m.material.opacity = 0.2 * Math.sin(Math.PI * Math.min(1, k * 1.15));
      }
    });
  }

  // ================= 环境光(整个世界的夜色基调) =================
  {
    const amb = new THREE.AmbientLight(0x33415e, 0.62);
    world.add(amb);
    const moon = new THREE.DirectionalLight(0x7f9fd8, 0.28);
    moon.position.set(-8, 12, 6);
    world.add(moon);
    const hemi = new THREE.HemisphereLight(0x2a3a5c, 0x141824, 0.5);
    world.add(hemi);
  }

  return { world, update };
}
