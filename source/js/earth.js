/* ============================================================
 * 地球 · The Earth(Three.js ESM)
 * 真实贴图地球:NASA 蓝色大理石 + 云层 + 大气辉光 + 全球首都标注
 * + 浙江中枢飞线 + 土星式粒子光环 + 星海 + 实时图层(航班/地震/ISS)
 * 海岛秘境:点击南海水面,渐进式穿越云层进入 3D 海岛(island.glb,
 * 模型致敬 dragonir/3d「[3]. 海岛 ・ IsLand ・ 小島」),退出渐进回退。
 * ============================================================ */
import * as THREE from '/js/lib/three.module.min.js';
import { GLTFLoader } from '/js/lib/addons/loaders/GLTFLoader.js';
import { Water } from '/js/lib/addons/objects/Water.js';

(() => {
  'use strict';

  const stage = document.getElementById('earth-stage');
  if (!stage) return;
  const loading = stage.querySelector('.earth-loading');
  const errorBox = stage.querySelector('.earth-error');

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

  // ---------- 灯光(真实贴图需要) ----------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.32);
  scene.add(ambientLight);
  // 太阳跟随相机方向(headlight),保证可见面始终受光,观感与参考图一致
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  scene.add(sunLight);
  // 海岛世界的暖色太阳(进入海岛时启用)
  const isleSun = new THREE.DirectionalLight(0xffe9c8, 0.85);
  isleSun.position.set(180, 260, 120);
  isleSun.visible = false;
  scene.add(isleSun);

  // 相机参数档案:地球轨道 / 海岛世界
  const CAM_EARTH = { n: 0.05, f: 120, fov: 38 };
  const CAM_ISLE = { n: 1, f: 30000, fov: 55 };
  const applyCamProfile = p => {
    camera.near = p.n; camera.far = p.f; camera.fov = p.fov;
    camera.updateProjectionMatrix();
  };

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

  // ---------- 地球本体:真实贴图(NASA 蓝色大理石 + 海面高光 + 地形浮雕) ----------
  const TEX = '/images/earth/';
  let loadingDone = false;
  const hideLoading = () => {
    if (loadingDone) return;
    loadingDone = true;
    if (loading) loading.style.display = 'none';
  };
  const loadingManager = new THREE.LoadingManager();
  loadingManager.onLoad = hideLoading;
  loadingManager.onError = hideLoading;
  setTimeout(hideLoading, 10000); // 兜底:个别贴图超时也不卡加载圈
  const tl = new THREE.TextureLoader(loadingManager);
  const dayTex = tl.load(TEX + 'earth_atmos_2048.jpg');
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.MeshPhongMaterial({
      map: dayTex,
      specularMap: tl.load(TEX + 'earth_specular_2048.jpg'),
      specular: new THREE.Color(0x5a7ba6),
      shininess: 14,
      normalMap: tl.load(TEX + 'earth_normal_2048.jpg'),
      normalScale: new THREE.Vector2(0.8, 0.8),
      // 轻微自发光贴图:让海洋与大陆的色彩更浓郁(贴近参考图)
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.2,
      emissiveMap: dayTex,
    })
  );
  spin.add(earthMesh);

  // ---------- 云层壳(可穿越:进入海岛时相机将穿过它) ----------
  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.065, 64, 64),
    new THREE.MeshLambertMaterial({
      map: tl.load(TEX + 'earth_clouds_1024.png'),
      transparent: true, opacity: 0.42, depthWrite: false,
    })
  );
  spin.add(cloudMesh);

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
          gl_FragColor = vec4(c, 1.0) * i * 0.55;
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(1.125, 48, 48), mat));
  }

  // ---------- 中枢(浙江)与柱状图城市 ----------
  const HUB = { name: '浙江', lon: 120.1, lat: 30.3 };
  const ROUTES = [
    ['东京', 139.7, 35.7], ['首尔', 127.0, 37.5], ['新加坡', 103.8, 1.35], ['曼谷', 100.5, 13.75],
    ['新德里', 77.2, 28.6], ['莫斯科', 37.6, 55.75], ['巴黎', 2.35, 48.85], ['伦敦', -0.13, 51.5],
    ['利雅得', 46.7, 24.7], ['开罗', 31.2, 30.0], ['内罗毕', 36.8, -1.29], ['堪培拉', 149.13, -35.28],
    ['华盛顿', -77.0, 38.9], ['墨西哥城', -99.1, 19.4], ['布宜诺斯艾利斯', -58.4, -34.6],
    ['比勒陀利亚', 28.2, -25.75], ['惠灵顿', 174.8, -41.3], ['雅加达', 106.8, -6.2],
  ];

  const hubV = ll2v(HUB.lon, HUB.lat, 1.006);
  const cityV = ROUTES.map(c => ll2v(c[1], c[2], 1.006));
  const barsGroup = new THREE.Group();
  spin.add(barsGroup);

  // 柱状图:城市上方的发光柱(默认关闭,顶部 chips 可开)
  ROUTES.forEach((c, i) => {
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
  // 全球首都标注(金色小点 + 首都名,点击看详情)
  // tier 1 = 主要首都,全景即显示;tier 2 = 拉近后显示,避免拥挤
  // ============================================================
  const CAPITALS = [
    // ---- 东亚 · 东南亚 · 南亚 · 中亚 · 西亚 ----
    ['北京', '中国', 116.41, 39.90, 1],
    ['东京', '日本', 139.69, 35.69, 1],
    ['首尔', '韩国', 126.98, 37.57, 1],
    ['平壤', '朝鲜', 125.75, 39.03, 2],
    ['乌兰巴托', '蒙古', 106.91, 47.89, 2],
    ['河内', '越南', 105.85, 21.03, 2],
    ['万象', '老挝', 102.63, 17.97, 2],
    ['金边', '柬埔寨', 104.92, 11.55, 2],
    ['曼谷', '泰国', 100.52, 13.75, 1],
    ['内比都', '缅甸', 96.13, 19.76, 2],
    ['吉隆坡', '马来西亚', 101.69, 3.14, 2],
    ['新加坡', '新加坡', 103.82, 1.35, 1],
    ['雅加达', '印度尼西亚', 106.85, -6.21, 1],
    ['马尼拉', '菲律宾', 120.98, 14.60, 2],
    ['斯里巴加湾市', '文莱', 114.72, 4.89, 2],
    ['帝力', '东帝汶', 125.57, -8.56, 2],
    ['新德里', '印度', 77.21, 28.61, 1],
    ['伊斯兰堡', '巴基斯坦', 73.05, 33.69, 2],
    ['喀布尔', '阿富汗', 69.17, 34.53, 2],
    ['加德满都', '尼泊尔', 85.32, 27.71, 2],
    ['廷布', '不丹', 89.64, 27.47, 2],
    ['达卡', '孟加拉国', 90.41, 23.81, 2],
    ['科伦坡', '斯里兰卡', 79.86, 6.93, 2],
    ['阿斯塔纳', '哈萨克斯坦', 71.43, 51.13, 2],
    ['塔什干', '乌兹别克斯坦', 69.24, 41.30, 2],
    ['比什凯克', '吉尔吉斯斯坦', 74.60, 42.87, 2],
    ['杜尚别', '塔吉克斯坦', 68.79, 38.56, 2],
    ['阿什哈巴德', '土库曼斯坦', 58.38, 37.95, 2],
    ['德黑兰', '伊朗', 51.39, 35.69, 2],
    ['巴格达', '伊拉克', 44.36, 33.31, 2],
    ['利雅得', '沙特阿拉伯', 46.71, 24.71, 1],
    ['科威特城', '科威特', 47.98, 29.38, 2],
    ['多哈', '卡塔尔', 51.53, 25.29, 2],
    ['麦纳麦', '巴林', 50.59, 26.23, 2],
    ['阿布扎比', '阿联酋', 54.37, 24.47, 2],
    ['马斯喀特', '阿曼', 58.54, 23.61, 2],
    ['萨那', '也门', 44.21, 15.35, 2],
    ['安卡拉', '土耳其', 32.86, 39.93, 1],
    ['尼科西亚', '塞浦路斯', 33.36, 35.17, 2],
    ['耶路撒冷', '以色列', 35.21, 31.77, 2],
    ['第比利斯', '格鲁吉亚', 44.83, 41.72, 2],
    ['埃里温', '亚美尼亚', 44.51, 40.18, 2],
    ['巴库', '阿塞拜疆', 49.87, 40.41, 2],
    // ---- 欧洲 ----
    ['莫斯科', '俄罗斯', 37.62, 55.75, 1],
    ['基辅', '乌克兰', 30.52, 50.45, 2],
    ['明斯克', '白俄罗斯', 27.56, 53.90, 2],
    ['维尔纽斯', '立陶宛', 25.28, 54.69, 2],
    ['里加', '拉脱维亚', 24.11, 56.95, 2],
    ['塔林', '爱沙尼亚', 24.75, 59.44, 2],
    ['赫尔辛基', '芬兰', 24.94, 60.17, 2],
    ['斯德哥尔摩', '瑞典', 18.07, 59.33, 2],
    ['奥斯陆', '挪威', 10.75, 59.91, 2],
    ['哥本哈根', '丹麦', 12.57, 55.68, 2],
    ['柏林', '德国', 13.40, 52.52, 1],
    ['阿姆斯特丹', '荷兰', 4.90, 52.37, 2],
    ['布鲁塞尔', '比利时', 4.35, 50.85, 1],
    ['卢森堡', '卢森堡', 6.13, 49.61, 2],
    ['巴黎', '法国', 2.35, 48.86, 1],
    ['马德里', '西班牙', -3.70, 40.42, 1],
    ['里斯本', '葡萄牙', -9.14, 38.72, 2],
    ['罗马', '意大利', 12.50, 41.90, 1],
    ['伯尔尼', '瑞士', 7.45, 46.95, 2],
    ['维也纳', '奥地利', 16.37, 48.21, 1],
    ['布拉格', '捷克', 14.42, 50.09, 2],
    ['华沙', '波兰', 21.01, 52.23, 1],
    ['布达佩斯', '匈牙利', 19.04, 47.50, 2],
    ['布加勒斯特', '罗马尼亚', 26.10, 44.43, 2],
    ['索菲亚', '保加利亚', 23.32, 42.70, 2],
    ['贝尔格莱德', '塞尔维亚', 20.46, 44.82, 2],
    ['萨格勒布', '克罗地亚', 15.98, 45.81, 2],
    ['卢布尔雅那', '斯洛文尼亚', 14.51, 46.05, 2],
    ['萨拉热窝', '波黑', 18.41, 43.86, 2],
    ['地拉那', '阿尔巴尼亚', 19.82, 41.33, 2],
    ['斯科普里', '北马其顿', 21.43, 42.00, 2],
    ['雅典', '希腊', 23.73, 37.98, 1],
    ['都柏林', '爱尔兰', -6.26, 53.35, 2],
    ['伦敦', '英国', -0.13, 51.51, 1],
    ['雷克雅未克', '冰岛', -21.94, 64.15, 2],
    // ---- 非洲 ----
    ['开罗', '埃及', 31.24, 30.04, 1],
    ['的黎波里', '利比亚', 13.19, 32.89, 2],
    ['突尼斯市', '突尼斯', 10.18, 36.80, 2],
    ['阿尔及尔', '阿尔及利亚', 3.06, 36.75, 2],
    ['拉巴特', '摩洛哥', -6.84, 34.02, 2],
    ['努瓦克肖特', '毛里塔尼亚', -15.97, 18.08, 2],
    ['达喀尔', '塞内加尔', -17.45, 14.72, 2],
    ['班珠尔', '冈比亚', -16.58, 13.45, 2],
    ['比绍', '几内亚比绍', -15.60, 11.86, 2],
    ['科纳克里', '几内亚', -13.71, 9.64, 2],
    ['弗里敦', '塞拉利昂', -13.23, 8.48, 2],
    ['蒙罗维亚', '利比里亚', -10.80, 6.31, 2],
    ['亚穆苏克罗', '科特迪瓦', -5.28, 6.83, 2],
    ['阿克拉', '加纳', -0.19, 5.60, 2],
    ['洛美', '多哥', 1.22, 6.13, 2],
    ['波多诺伏', '贝宁', 2.61, 6.48, 2],
    ['阿布贾', '尼日利亚', 7.49, 9.06, 2],
    ['尼亚美', '尼日尔', 2.11, 13.51, 2],
    ['瓦加杜古', '布基纳法索', -1.53, 12.37, 2],
    ['班吉', '中非', 18.56, 4.36, 2],
    ['恩贾梅纳', '乍得', 15.05, 12.11, 2],
    ['喀土穆', '苏丹', 32.53, 15.55, 2],
    ['朱巴', '南苏丹', 31.58, 4.85, 2],
    ['亚的斯亚贝巴', '埃塞俄比亚', 38.75, 9.02, 2],
    ['阿斯马拉', '厄立特里亚', 38.93, 15.34, 2],
    ['吉布提市', '吉布提', 43.15, 11.59, 2],
    ['摩加迪沙', '索马里', 45.34, 2.04, 2],
    ['内罗毕', '肯尼亚', 36.82, -1.29, 1],
    ['坎帕拉', '乌干达', 32.58, 0.32, 2],
    ['基加利', '卢旺达', 30.06, -1.94, 2],
    ['布琼布拉', '布隆迪', 29.36, -3.38, 2],
    ['金沙萨', '刚果(金)', 15.31, -4.32, 2],
    ['布拉柴维尔', '刚果(布)', 15.24, -4.26, 2],
    ['利伯维尔', '加蓬', 9.45, 0.39, 2],
    ['马拉博', '赤道几内亚', 8.78, 3.75, 2],
    ['罗安达', '安哥拉', 13.23, -8.84, 2],
    ['卢萨卡', '赞比亚', 28.28, -15.41, 2],
    ['哈拉雷', '津巴布韦', 31.05, -17.83, 2],
    ['利隆圭', '马拉维', 33.79, -13.97, 2],
    ['多多马', '坦桑尼亚', 35.74, -6.16, 2],
    ['温得和克', '纳米比亚', 17.08, -22.57, 2],
    ['哈博罗内', '博茨瓦纳', 25.92, -24.65, 2],
    ['比勒陀利亚', '南非', 28.19, -25.75, 1],
    ['马普托', '莫桑比克', 32.57, -25.97, 2],
    ['维多利亚', '塞舌尔', 55.45, -4.62, 2],
    ['路易港', '毛里求斯', 57.50, -20.16, 2],
    // ---- 美洲 ----
    ['渥太华', '加拿大', -75.70, 45.42, 1],
    ['华盛顿', '美国', -77.04, 38.90, 1],
    ['墨西哥城', '墨西哥', -99.13, 19.43, 1],
    ['危地马拉城', '危地马拉', -90.51, 14.63, 2],
    ['贝尔莫潘', '伯利兹', -88.77, 17.25, 2],
    ['特古西加尔巴', '洪都拉斯', -87.21, 14.08, 2],
    ['圣萨尔瓦多', '萨尔瓦多', -89.19, 13.69, 2],
    ['马那瓜', '尼加拉瓜', -86.27, 12.14, 2],
    ['圣何塞', '哥斯达黎加', -84.09, 9.93, 2],
    ['巴拿马城', '巴拿马', -79.52, 8.98, 2],
    ['哈瓦那', '古巴', -82.37, 23.11, 2],
    ['金斯敦', '牙买加', -76.79, 17.97, 2],
    ['太子港', '海地', -72.34, 18.54, 2],
    ['圣多明各', '多米尼加', -69.90, 18.48, 2],
    ['波哥大', '哥伦比亚', -74.07, 4.71, 2],
    ['加拉加斯', '委内瑞拉', -66.90, 10.49, 2],
    ['乔治敦', '圭亚那', -58.16, 6.80, 2],
    ['帕拉马里博', '苏里南', -55.17, 5.85, 2],
    ['基多', '厄瓜多尔', -78.47, -0.18, 2],
    ['利马', '秘鲁', -77.03, -12.05, 2],
    ['拉巴斯', '玻利维亚', -68.15, -16.50, 2],
    ['巴西利亚', '巴西', -47.93, -15.78, 1],
    ['亚松森', '巴拉圭', -57.63, -25.28, 2],
    ['蒙得维的亚', '乌拉圭', -56.19, -34.90, 2],
    ['布宜诺斯艾利斯', '阿根廷', -58.38, -34.60, 1],
    ['圣地亚哥', '智利', -70.67, -33.45, 2],
    // ---- 大洋洲 ----
    ['堪培拉', '澳大利亚', 149.13, -35.28, 1],
    ['惠灵顿', '新西兰', 174.78, -41.29, 1],
    ['莫尔兹比港', '巴布亚新几内亚', 147.18, -9.44, 2],
    ['苏瓦', '斐济', 178.44, -18.14, 2],
  ];
  const capitals = [];
  const addCap = row => {
    const [n, c, lon, lat, tier] = row;
    const el = document.createElement('div');
    el.className = 'earth-cap' + (tier === 1 ? ' is-major' : '');
    el.innerHTML = '<i></i>' + n;
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (mode !== 'earth' || viewTween) return;
      const dist = distKm(HUB, { lon, lat });
      showCard(c.toUpperCase() + ' · CAPITAL', n, [
        ['国家', c],
        ['坐标', coordText(lon, lat)],
        ['距浙江', dist.toLocaleString() + ' km'],
        ['航向', bearingCN(HUB, { lon, lat })],
      ]);
    });
    stage.appendChild(el);
    capitals.push({ n, c, lon, lat, tier, el, v: ll2v(lon, lat, 1.006), x: -1, y: -1, vis: null });
  };
  CAPITALS.forEach(addCap);

  // 每帧投影:背面隐藏;全景只显主要首都,拉近显示全部;位置不变时跳过 DOM 写入
  const capTmp = new THREE.Vector3();
  const capDir = new THREE.Vector3();
  const updateCapitals = () => {
    const setHidden = C => { if (C.vis !== false) { C.vis = false; C.el.style.visibility = 'hidden'; } };
    if (mode !== 'earth') { capitals.forEach(setHidden); return; }
    const majorOnly = camDist > 2.75;
    for (const C of capitals) {
      if (!labelsOn || (C.tier === 2 && majorOnly)) { setHidden(C); continue; }
      capTmp.copy(C.v); spin.localToWorld(capTmp);
      capDir.copy(capTmp).normalize();
      const facing = capDir.dot(camBase);
      if (facing < 0.12) { setHidden(C); continue; }
      proj.copy(capTmp).project(camera);
      const x = (proj.x * 0.5 + 0.5) * W, y = (-proj.y * 0.5 + 0.5) * H;
      if (C.vis !== true || Math.abs(x - C.x) > 0.6 || Math.abs(y - C.y) > 0.6) {
        C.x = x; C.y = y; C.vis = true;
        C.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        C.el.style.opacity = Math.min(1, (facing - 0.12) / 0.16).toFixed(2);
        C.el.style.visibility = 'visible';
      }
    }
  };
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
    if (e.target.classList.contains('earth-card-back') && mode === 'island') exitIsland();
  });

  addLabel(HUB.name, true, spin, hubV.clone(), () => showCard('HUB · ZHEJIANG', HUB.name, [
    ['角色', '全球航线中枢'],
    ['坐标', coordText(HUB.lon, HUB.lat)],
    ['覆盖航线', ROUTES.length + ' 条'],
  ]));

  // ============================================================
  // 视角补间(地球模式:对准目标经纬 + 推近;支持逐帧回调)
  // ============================================================
  const easeInOutCubic = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const wrapPi = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  let viewTween = null;
  const animateView = (ry, rx, dist, dur, cb, step) => {
    const from = { ry: spin.rotation.y, rx: tilt.rotation.x, d: camTarget };
    viewTween = { t0: performance.now(), dur, from, to: { ry: from.ry + wrapPi(ry - from.ry), rx, d: dist }, cb, step };
  };
  // 把球面点 (lon,lat) 转到相机正前方所需的 spin.y / tilt.x 解析解
  // 推导:世界方向 = Rx(tiltX)·Ry(spinY)·p,要求等于相机方向 camBase。
  // 先用 Ry 把点转到 x 分量 = camBase.x 的位置(两个分支,取 |tilt| 更小者),
  // 再用 Rx 绕 x 轴把 (y,z) 角转到相机方向。Rx 保留 x,故该解为精确解。
  const alignView = (lon, lat) => {
    const p = ll2v(lon, lat, 1).normalize();
    const cx = camBase.x, cy = camBase.y, cz = camBase.z;
    const r = Math.hypot(p.x, p.z);
    const aP = Math.atan2(p.z, p.x);
    const bc = Math.atan2(cz, cy);
    const ph = Math.acos(Math.max(-1, Math.min(1, cx / r)));
    const w = Math.sqrt(Math.max(0, r * r - cx * cx));
    const t1 = bc - Math.atan2(w, p.y);
    const t2 = bc - Math.atan2(-w, p.y);
    const plus = Math.abs(t1) <= Math.abs(t2);
    return { ry: plus ? aP - ph : aP + ph, rx: plus ? t1 : t2 };
  };

  // ============================================================
  // 海岛秘境(模型致敬 dragonir/3d「[3]. 海岛 ・ IsLand ・ 小島」)
  // 全景:南海海面上摆着真实 3D 小岛 + 呼吸光环;点击水面,
  // 相机推进穿过云层 → 白雾 → 切换海岛世界并缓降海面;
  // 退出时白雾 → 拉升 → 切回地球全景,全程渐进过渡。
  // ============================================================
  const ISLE = { lon: 112.5, lat: 12.0 };
  const isleV = ll2v(ISLE.lon, ISLE.lat, 1.0);
  let mode = 'earth'; // earth → toIsland → island → fromIsland
  const birdMixers = [];
  const isleAnims = []; // 海岛自研小物件的逐帧动画
  let islandScene = null;

  // ---- 海岛世界(独立组,默认隐藏) ----
  const isleWorld = new THREE.Group();
  isleWorld.visible = false;
  scene.add(isleWorld);

  // 海面:three.js 反射水面(与 dragonir/3d 海岛篇同款,法线扰动画出波光)
  const water = new Water(new THREE.PlaneGeometry(9000, 9000), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(TEX + 'waternormals.jpg', t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }),
    sunDirection: new THREE.Vector3(0.45, 0.8, 0.35).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x005e9e,
    distortionScale: 3.2,
  });
  water.rotation.x = -Math.PI / 2;
  isleWorld.add(water);

  // 天空:渐变穹顶 + 太阳方向增亮
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(8000, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `
        varying vec3 vP;
        void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vP;
        void main() {
          float h = normalize(vP).y * 0.5 + 0.5;
          vec3 col = mix(vec3(0.87, 0.92, 0.95), vec3(0.92, 0.95, 0.97), smoothstep(0.42, 0.5, h));
          col = mix(col, vec3(0.50, 0.73, 0.93), smoothstep(0.5, 0.72, h));
          col = mix(col, vec3(0.20, 0.45, 0.82), smoothstep(0.72, 1.0, h));
          float s = pow(max(dot(normalize(vP), normalize(vec3(0.45, 0.8, 0.35))), 0.0), 240.0);
          col += vec3(1.0, 0.95, 0.8) * s * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  isleWorld.add(skyDome);

  // 太阳光斑与高空流云(退出拉升时会从云朵间穿过)
  {
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GOLD, color: '#fff6dd', transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sunSp.scale.setScalar(1100);
    sunSp.position.set(2400, 4300, 1900);
    isleWorld.add(sunSp);
    for (let i = 0; i < 12; i++) {
      const cx = (Math.random() - 0.5) * 2600;
      const cz = (Math.random() - 0.5) * 2600;
      const cy = 620 + Math.random() * 900;
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: TEX_WHITE, color: '#ffffff', transparent: true,
          opacity: 0.5 + Math.random() * 0.25, depthWrite: false,
        }));
        sp.position.set(cx + (Math.random() - 0.5) * 260, cy + (Math.random() - 0.5) * 130, cz + (Math.random() - 0.5) * 260);
        sp.scale.setScalar(300 + Math.random() * 380);
        isleWorld.add(sp);
      }
    }
  }

  // 岛与火烈鸟(GLTF 异步加载;全景用缩小克隆贴在球面海面上)
  new GLTFLoader().load(TEX + 'island.glb', gltf => {
    islandScene = gltf.scene;
    islandScene.traverse(o => {
      if (o.isMesh) { o.material.metalness = 0.35; o.material.roughness = 0.62; }
    });
    const mini = islandScene.clone();
    mini.position.copy(isleV);
    mini.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), isleV.clone().normalize());
    mini.scale.setScalar(0.0011);
    spin.add(mini);
    islandScene.position.set(0, -2, 0);
    islandScene.scale.setScalar(33);
    isleWorld.add(islandScene);
    islandLoaded = true;
  });
  new GLTFLoader().load(TEX + 'flamingo.glb', gltf => {
    const mesh = gltf.scene.children[0];
    mesh.scale.setScalar(0.35);
    mesh.position.set(-110, 78, -290);
    mesh.rotation.y = -1;
    isleWorld.add(mesh);
    const m1 = new THREE.AnimationMixer(mesh);
    m1.clipAction(gltf.animations[0]).setDuration(1.2).play();
    birdMixers.push(m1);
    const b2 = mesh.clone();
    b2.position.set(150, 82, -480);
    isleWorld.add(b2);
    const m2 = new THREE.AnimationMixer(b2);
    m2.clipAction(gltf.animations[0]).setDuration(1.8).play();
    birdMixers.push(m2);
  });

  // ---- 自研小物件:木船 / 篝火 / 浮标(在原项目海岛模型基础上添加) ----
  const woodMat = c => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 8 });
  {
    // 木船:近岸漂浮,随浪轻摇
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.4, 8.5, 4, 1), woodMat('#8a5a33'));
    hull.rotation.z = Math.PI / 2; hull.rotation.y = Math.PI / 4;
    hull.scale.set(1, 1, 0.55);
    boat.add(hull);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.5, 4, 1, true), woodMat('#a8703f'));
    rim.rotation.z = Math.PI / 2; rim.rotation.y = Math.PI / 4;
    rim.scale.set(1, 1, 0.55); rim.position.y = 0.9;
    boat.add(rim);
    const bench1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 2.4), woodMat('#b98a55'));
    bench1.position.set(-1.6, 0.7, 0); boat.add(bench1);
    const bench2 = bench1.clone(); bench2.position.x = 1.6; boat.add(bench2);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 6), woodMat('#c89a66'));
    oar.rotation.z = 0.9; oar.position.set(0.6, 0.9, 1.2); boat.add(oar);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.9), woodMat('#c89a66'));
    blade.position.set(2.1, 2.6, 1.2); blade.rotation.z = 0.9; boat.add(blade);
    boat.position.set(98, 1.1, 62);
    boat.rotation.y = 2.3;
    isleWorld.add(boat);
    isleAnims.push(t => {
      boat.position.y = 1.1 + Math.sin(t * 0.85) * 0.55;
      boat.rotation.z = Math.sin(t * 0.85 + 0.8) * 0.055;
      boat.rotation.x = Math.sin(t * 0.6) * 0.03;
    });

    // 篝火:海滩边,柴堆 + 火苗闪烁 + 暖光
    const fire = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.6, 6), woodMat('#6d4526'));
      log.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2, 0);
      log.position.y = 0.35;
      fire.add(log);
    }
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), new THREE.MeshPhongMaterial({ color: '#7c8288', flatShading: true }));
      const a = (i / 6) * Math.PI * 2;
      stone.position.set(Math.cos(a) * 1.7, 0.15, Math.sin(a) * 1.7);
      fire.add(stone);
    }
    const flameMat1 = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.92 });
    const flame1 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 7), flameMat1);
    flame1.position.y = 1.7; fire.add(flame1);
    const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 7), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.95 }));
    flame2.position.y = 1.5; fire.add(flame2);
    const fireLight = new THREE.PointLight(0xff9a50, 0, 160, 2);
    fireLight.position.y = 2.2; fire.add(fireLight);
    fire.position.set(-30, 4.2, 70);
    isleWorld.add(fire);
    isleAnims.push(t => {
      const f = 0.75 + Math.sin(t * 9.3) * 0.14 + Math.sin(t * 17.7) * 0.08;
      flame1.scale.set(1, f, 1);
      flame2.scale.set(1, 0.8 + f * 0.3, 1);
      flameMat1.opacity = 0.75 + Math.sin(t * 11) * 0.15;
      fireLight.intensity = 1.6 + Math.sin(t * 9.3) * 0.5;
    });

    // 浮标:远处海面,红白相间,随浪起伏
    const buoy = (x, z, tilt) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), new THREE.MeshPhongMaterial({ color: '#e04b3a', flatShading: true })));
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.5, 8), new THREE.MeshPhongMaterial({ color: '#f2f2ea', flatShading: true }));
      top.position.y = 0.95; g.add(top);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 8), new THREE.MeshPhongMaterial({ color: '#e04b3a', flatShading: true }));
      cap.position.y = 1.85; g.add(cap);
      g.position.set(x, 0.4, z);
      g.rotation.z = tilt;
      isleWorld.add(g);
      isleAnims.push(t => {
        g.position.y = 0.4 + Math.sin(t * 0.9 + x) * 0.4;
        g.rotation.x = Math.sin(t * 0.8 + z) * 0.09;
      });
    };
    buoy(96, -78, 0.05);
    buoy(-118, 20, -0.06);
  }

  // ---- 全景入口标记:呼吸光环 + 点击命中盘 ----
  const markerGroup = new THREE.Group();
  markerGroup.position.copy(ll2v(ISLE.lon, ISLE.lat, 1.004));
  markerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), markerGroup.position.clone().normalize());
  const isleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.052, 0.06, 48),
    new THREE.MeshBasicMaterial({ color: '#8fe0ff', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  isleRing.rotation.x = -Math.PI / 2;
  markerGroup.add(isleRing);
  const islePulse = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 48),
    new THREE.MeshBasicMaterial({ color: '#8fe0ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  islePulse.rotation.x = -Math.PI / 2;
  markerGroup.add(islePulse);
  const isleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_CYAN, color: '#c8f0ff', transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  isleGlow.scale.setScalar(0.085);
  markerGroup.add(isleGlow);
  const isleHitDisk = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 24),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  isleHitDisk.rotation.x = -Math.PI / 2;
  isleHitDisk.position.y = 0.004;
  markerGroup.add(isleHitDisk);
  spin.add(markerGroup);

  // 入口 HTML 标签(点击直接进入)
  const isleLabel = document.createElement('div');
  isleLabel.className = 'earth-label is-isle';
  isleLabel.textContent = '南海 · 秘境海岛';
  isleLabel.style.pointerEvents = 'auto';
  isleLabel.style.cursor = 'pointer';
  isleLabel.addEventListener('click', e => { e.stopPropagation(); enterIsland(); });
  stage.appendChild(isleLabel);
  labels.push({ el: isleLabel, anchorObj: spin, localPos: ll2v(ISLE.lon, ISLE.lat, 1.02) });

  // ---- 穿云过渡层:天空 + 持续飞掠的云朵(加载期=穿云期) ----
  const whiteout = document.createElement('div');
  whiteout.className = 'earth-whiteout';
  whiteout.innerHTML = '<div class="ew-clouds"></div><span class="ew-text"></span>';
  {
    // 三层景深云朵:远景小而慢、中景居中、近景大而快带模糊,负延迟让开场就有云在飞
    const cloudBox = whiteout.querySelector('.ew-clouds');
    const LAYERS_CONF = [
      { s: [90, 200], d: [8, 12], b: 2, o: [0.35, 0.55], y: [6, 66] },
      { s: [160, 320], d: [5, 8], b: 4, o: [0.5, 0.75], y: [18, 78] },
      { s: [280, 540], d: [2.8, 4.6], b: 8, o: [0.68, 0.95], y: [28, 88] },
    ];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i');
      p.className = 'ew-puff';
      const c = LAYERS_CONF[i % 3];
      const rnd = (a, b) => (a + Math.random() * (b - a));
      p.style.setProperty('--s', rnd(c.s[0], c.s[1]).toFixed(0) + 'px');
      p.style.setProperty('--d', rnd(c.d[0], c.d[1]).toFixed(2) + 's');
      p.style.setProperty('--b', c.b + 'px');
      p.style.setProperty('--o', rnd(c.o[0], c.o[1]).toFixed(2));
      p.style.setProperty('--ty', rnd(c.y[0], c.y[1]).toFixed(0) + '%');
      p.style.setProperty('--dl', (-rnd(0, c.d[1])).toFixed(2) + 's');
      cloudBox.appendChild(p);
    }
  }
  stage.appendChild(whiteout);
  const ewText = whiteout.querySelector('.ew-text');
  const showWhite = txt => { ewText.textContent = txt || ''; whiteout.classList.add('is-on'); };
  const hideWhite = () => { whiteout.classList.remove('is-on'); };

  // ---- 海岛视角轨道相机参数 + 补间 ----
  let isleAz = 0, isleEl = 0.36, isleDist = 1807;
  let camTween = null;
  const isleApplyCam = () => {
    camera.position.set(
      isleDist * Math.cos(isleEl) * Math.sin(isleAz),
      isleDist * Math.sin(isleEl) + 8,
      isleDist * Math.cos(isleEl) * Math.cos(isleAz)
    );
    camera.lookAt(0, 8, 0);
  };
  const animateCam = (to, dur, cb) => {
    camTween = { t0: performance.now(), dur, from: { az: isleAz, el: isleEl, d: isleDist }, to, cb };
  };

  // ---- 海岛介绍卡 ----
  const showIsleCard = () => {
    card.innerHTML = '<button class="earth-card-close" type="button">✕ 关闭</button>'
      + '<div class="earth-card-tag">SECRET ISLE · 南海秘境</div>'
      + '<h4 class="earth-card-title">海岛</h4>'
      + '<p class="earth-card-desc">穿过云层之后，是一片被时间遗忘的珊瑚小岛：木屋立在栈桥上，棕榈在海风里摇晃，火烈鸟贴着浪尖飞。什么都不用做，发呆就好。</p>'
      + '<div class="earth-card-row"><span>位置</span><b>中国 · 南海</b></div>'
      + '<div class="earth-card-row"><span>坐标</span><b>' + coordText(ISLE.lon, ISLE.lat) + '</b></div>'
      + '<div class="earth-card-row"><span>岛民</span><b>火烈鸟 × 2</b></div>'
      + '<div class="earth-card-row"><span>新增物件</span><b>木船 · 篝火 · 浮标</b></div>'
      + '<button class="earth-card-back" type="button">↩ 退出海岛</button>';
    card.classList.add('is-show');
  };

  // ---- 进入海岛:推近穿云 → 白雾切换 → 高空缓降 ----
  const enterIsland = () => {
    if (mode !== 'earth') return;
    mode = 'toIsland';
    card.classList.remove('is-show');
    lastTouch = performance.now();
    let whiteStarted = false;
    const v = alignView(ISLE.lon, ISLE.lat);
    animateView(v.ry, v.rx, 1.02, 2500, () => {
      // 白雾已全屏:切换到海岛世界
      scene.fog = new THREE.Fog(0xcfe4f2, 700, 3200);
      isleWorld.visible = true;
      tilt.visible = false;
      isleSun.visible = true;
      sunLight.visible = false;
      applyCamProfile(CAM_ISLE);
      isleAz = 0; isleEl = 0.36; isleDist = 1807;
      isleApplyCam();
      camDist = 3.55; camTarget = 3.55;
      tilt.rotation.x = 0;
      setTimeout(() => {
        hideWhite();
        mode = 'island';
        // 从高空缓降到海面
        animateCam({ az: 0, el: 0.3, d: 170 }, 3000, showIsleCard);
      }, 420);
    }, k => {
      // 推进途中:扩视场增加速度感,过半后白雾升起
      camera.fov = 38 + 14 * easeInOutCubic(k);
      camera.updateProjectionMatrix();
      if (k > 0.55 && !whiteStarted) { whiteStarted = true; showWhite('正在穿越云层…'); }
    });
  };

  // ---- 退出海岛:白雾 → 拉升 → 切回地球全景 ----
  const exitIsland = () => {
    if (mode !== 'island') return;
    mode = 'fromIsland';
    card.classList.remove('is-show');
    showWhite('正在返回轨道…');
    setTimeout(() => {
      animateCam({ az: isleAz, el: 0.36, d: 1807 }, 1500, () => {
        scene.fog = null;
        isleWorld.visible = false;
        tilt.visible = true;
        isleSun.visible = false;
        sunLight.visible = true;
        applyCamProfile(CAM_EARTH);
        camTarget = 3.55; camDist = 3.55;
        tilt.rotation.x = 0;
        setCam();
        camera.lookAt(0, 0, 0);
        setTimeout(() => {
          hideWhite();
          mode = 'earth';
          // 重新对准地球(轨道相机的 lookAt 在上一帧覆盖了朝向)
          setCam();
          camera.lookAt(0, 0, 0);
        }, 420);
      });
    }, 450);
  };

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mode === 'island') exitIsland();
  });

  // ============================================================
  // 实时数据层(公开数据源,全部无需 Key)
  //   🌍 地震:USGS 24h Feed(5 分钟刷新,M≥5 有扩散脉冲)
  //   🛰 ISS:WhereTheISS.at(12 秒刷新)
  // ============================================================
  const liveGroup = new THREE.Group();
  spin.add(liveGroup);
  const quakesGroup = new THREE.Group();
  liveGroup.add(quakesGroup);
  const issGroup = new THREE.Group();
  spin.add(issGroup);
  let quakesOn = true, issOn = true;
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
  liveBar.innerHTML = '<span id="live-q">🌍 地震加载中</span><span id="live-i">🛰 ISS …</span>';
  stage.appendChild(liveBar);
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
  pollQuakes(); pollISS();
  setInterval(pollQuakes, 300000);
  setInterval(pollISS, 12000);
  setInterval(() => { // HUD 时效性(不依赖 rAF)
    if (liveQ.dataset.ok === '1') liveQ.textContent = liveQ.textContent.replace(/ · .*$/, '') + ' · ' + minsAgo(Date.now());
    if (issData.at) liveI.textContent = '🛰 ISS ' + Math.round(issData.alt) + 'km · ' + Math.round((Date.now() - issData.at) / 1000) + 's 前';
  }, 4000);

  // ---- 点选海面 → 进入海岛 ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downX = 0, downY = 0, downT = 0;
  stage.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
  stage.addEventListener('click', e => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5 || performance.now() - downT > 700) return;
    if (mode !== 'earth') return;
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    // 海面入口:点击南海水面进入海岛
    if (raycaster.intersectObject(isleHitDisk).length) { enterIsland(); return; }
    card.classList.remove('is-show');
  });

  // 悬停南海水面 → 指针提示可进入
  stage.addEventListener('pointermove', e => {
    if (mode !== 'earth' || dragging) { renderer.domElement.style.cursor = ''; return; }
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    renderer.domElement.style.cursor = raycaster.intersectObject(isleHitDisk).length ? 'pointer' : '';
  });

  // 每帧更新:地震脉冲 + ISS 动态标签
  const issWp = new THREE.Vector3();
  function updateLive(t) {
    for (const p of quakePulses) {
      const k = (t * 0.45 + p.phase) % 1;
      p.sprite.scale.setScalar(0.05 + k * (0.14 + p.mag * 0.035));
      p.sprite.material.opacity = 0.55 * (1 - k);
    }
    if (mode !== 'earth' || !issOn || !issData.at) { issLabel.style.visibility = 'hidden'; return; }
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

  // ---------- 图层开关(顶部 chips) ----------
  const LAYERS = {
    bars:   { on: false, apply: v => { barsGroup.visible = v; } },
    ring:   { on: false, apply: v => { ringGroup.visible = v; } },
    stars:  { on: true, apply: v => { if (starsObj) starsObj.visible = v; } },
    label:  { on: true, apply: v => { labelsOn = v; if (!v) card.classList.remove('is-show'); } },
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

  // ---------- 穿云云带:沿相机-球心连线布置实体云朵 ----------
  // 平时隐藏;进入海岛时淡入,相机推近时从云朵间穿行,配合白雾完成"穿云"
  const travelClouds = new THREE.Group();
  travelClouds.visible = false;
  scene.add(travelClouds);
  const cloudPuffs = [];
  {
    const axis = camBase.clone().normalize();
    const perp1 = new THREE.Vector3(0, 1, 0).cross(axis).normalize();
    const perp2 = axis.clone().cross(perp1).normalize();
    for (let i = 0; i < 14; i++) {
      const d = 1.28 + Math.random() * 0.75;      // 云层高度带(1.28~2.03)
      const pos = axis.clone().multiplyScalar(d)
        .addScaledVector(perp1, (Math.random() - 0.5) * 0.9)
        .addScaledVector(perp2, (Math.random() - 0.5) * 0.9);
      const cluster = new THREE.Group();
      cluster.position.copy(pos);
      const n = 3 + Math.floor(Math.random() * 3); // 每朵云 3~5 个云絮
      for (let j = 0; j < n; j++) {
        const mat = new THREE.SpriteMaterial({
          map: TEX_WHITE, color: '#ffffff', transparent: true, opacity: 0,
          depthWrite: false,
        });
        const sp = new THREE.Sprite(mat);
        sp.position.set((Math.random() - 0.5) * 0.24, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.24);
        sp.scale.setScalar(0.22 + Math.random() * 0.3);
        cluster.add(sp);
        cloudPuffs.push({ mat, base: 0.5 + Math.random() * 0.32 });
      }
      travelClouds.add(cluster);
    }
  }
  let cloudFade = 0; // 0 隐藏 → 1 完全显示(穿行中)

  // ---------- 交互:拖拽 + 惯性 + 滚轮 ----------
  let dragging = false, lastX = 0, lastY = 0, velY = 0, lastTouch = 0;
  const onDown = e => {
    if (viewTween || camTween) return; // 飞行 / 缓降中不接管拖拽
    dragging = true; lastX = e.clientX; lastY = e.clientY; velY = 0;
    stage.classList.add('is-dragging');
    lastTouch = performance.now();
  };
  const onMove = e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (mode === 'island') {
      // 海岛世界:环绕轨道视角(拖右 → 场景跟手向右转)
      isleAz -= dx * 0.005;
      isleEl = Math.max(0.08, Math.min(1.32, isleEl + dy * 0.003));
    } else {
      spin.rotation.y += dx * 0.005;
      // 俯仰放宽到 ±2.4rad:足够把南北极都拖进视野
      tilt.rotation.x = Math.max(-2.4, Math.min(2.4, tilt.rotation.x - dy * 0.002));
      velY = dx * 0.005;
    }
    lastTouch = performance.now();
  };
  const onUp = () => { dragging = false; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    if (mode === 'island') isleDist = Math.max(70, Math.min(900, isleDist + e.deltaY * 0.4));
    else camTarget = Math.max(1.6, Math.min(5.6, camTarget + e.deltaY * 0.0016));
    lastTouch = performance.now();
  }, { passive: false });
  stage.addEventListener('dblclick', () => {
    if (mode !== 'earth') return;
    animateView(spin.rotation.y, 0, 3.55, 900); // 平滑复位
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
      // 非地球全景时收起标签(海岛世界 / 过渡中)
      if (!labelsOn || mode !== 'earth') { L.el.style.visibility = 'hidden'; continue; }
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

  // 首帧同步渲染:后台标签页 rAF 暂停时也立刻可见
  // 贴图就绪后由 loadingManager.onLoad 撤掉加载层(10s 兜底)
  try { renderer.render(scene, camera); } catch { }
  updateLabels();

  const frame = () => {
    requestAnimationFrame(frame);
    // 尺寸自愈:主题布局/字体加载晚于首帧时跟上
    if (stage.clientWidth !== lastW || stage.clientHeight !== lastH) resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const earthish = mode === 'earth' || mode === 'toIsland';

    // 惯性 + 闲置自转(仅地球全景)
    if (!dragging) {
      spin.rotation.y += velY;
      velY *= 0.93;
      if (!reduced && mode === 'earth' && !viewTween && performance.now() - lastTouch > 2600) spin.rotation.y += 0.05 * dt;
    }

    // 地球视角飞行(进入海岛 / 双击复位)
    if (viewTween) {
      const k = Math.min(1, (performance.now() - viewTween.t0) / viewTween.dur);
      const e = easeInOutCubic(k);
      spin.rotation.y = viewTween.from.ry + (viewTween.to.ry - viewTween.from.ry) * e;
      tilt.rotation.x = viewTween.from.rx + (viewTween.to.rx - viewTween.from.rx) * e;
      camTarget = viewTween.from.d + (viewTween.to.d - viewTween.from.d) * e;
      if (viewTween.step) viewTween.step(k);
      if (k >= 1) { const cb = viewTween.cb; viewTween = null; cb && cb(); }
    }

    // 海岛世界:轨道相机补间 + 应用(带轻微海面浮沉)
    if (camTween) {
      const k = Math.min(1, (performance.now() - camTween.t0) / camTween.dur);
      const e = easeInOutCubic(k);
      isleAz = camTween.from.az + (camTween.to.az - camTween.from.az) * e;
      isleEl = camTween.from.el + (camTween.to.el - camTween.from.el) * e;
      isleDist = camTween.from.d + (camTween.to.d - camTween.from.d) * e;
      if (k >= 1) { const cb = camTween.cb; camTween = null; cb && cb(); }
    }
    if (mode === 'island' || mode === 'fromIsland') {
      camera.position.set(
        isleDist * Math.cos(isleEl) * Math.sin(isleAz),
        isleDist * Math.sin(isleEl) + 8 + Math.sin(t * 0.8) * 1.4,
        isleDist * Math.cos(isleEl) * Math.cos(isleAz)
      );
      camera.lookAt(0, 8, 0);
    }

    // 太阳跟随相机(地球模式);云层缓慢漂移
    sunLight.position.copy(camBase).multiplyScalar(10);
    cloudMesh.rotation.y += dt * 0.012;

    // 穿云云带:穿行时淡入并缓慢漂移,其余时段隐藏
    const cloudTarget = (mode === 'toIsland' || mode === 'fromIsland') ? 1 : 0;
    cloudFade += (cloudTarget - cloudFade) * Math.min(1, dt * 2.5);
    travelClouds.visible = cloudFade > 0.02;
    if (travelClouds.visible) {
      travelClouds.quaternion.setFromAxisAngle(camBase, t * 0.06);
      for (const p of cloudPuffs) p.mat.opacity = p.base * cloudFade;
    }

    // 中枢呼吸波纹(仅地球模式可见)
    for (const p of pulses) {
      const k = (t * 0.5 + p.phase) % 1;
      p.mesh.visible = earthish;
      const s = 0.03 + k * 0.22;
      p.mesh.scale.setScalar(s);
      p.mesh.material.opacity = 0.36 * (1 - k);
    }
    hubCore.visible = earthish;
    barsGroup.visible = LAYERS.bars.on && earthish;
    ringGroup.visible = LAYERS.ring.on && earthish;
    if (starsObj) starsObj.visible = LAYERS.stars.on && earthish;
    // 光环自转 + 卫星
    const band = ringGroup.getObjectByName('band');
    if (band) band.rotation.y = t * 0.03;
    for (const s of sats) {
      const a = t * s.speed + s.phase;
      s.sprite.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r);
    }

    // 海岛世界动效:水面波光时间 + 鸟扑翼 + 自研物件 + 入口呼吸光环
    if (isleWorld.visible) {
      water.material.uniforms['time'].value += dt;
      for (const m of birdMixers) m.update(dt);
      for (const fn of isleAnims) fn(t, dt);
    }
    if (earthish) {
      const pk = (t * 0.5) % 1;
      islePulse.scale.setScalar(0.05 + pk * 0.08); // 小呼吸环,环绕海岛入口
      islePulse.material.opacity = 0.45 * (1 - pk);
      isleRing.rotation.z = t * 0.3;
    }

    // 相机推拉平滑(地球轨道)
    if (earthish) {
      camDist += (camTarget - camDist) * 0.12;
      setCam();
    }

    // 标签投影 + 首都标注 + 实时层
    updateLabels();
    updateCapitals();
    updateLive(t);

    renderer.render(scene, camera);
  };
  frame();
  // 调试钩子(控制台:__earth() 查看当前模式/旋转/缩放)
  window.__earth = () => ({ mode, tiltX: tilt.rotation.x, spinY: spin.rotation.y, dist: camDist });
})();
