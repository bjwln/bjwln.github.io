// 共享工具函数 (Pages Functions)
// 同源调用, CORS 头保留以兼容旧客户端但不再需要预检

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Vary': 'Origin',
};

export const MAX_NICKNAME = 30;
export const MAX_CONTENT = 1000;
export const RATE_LIMIT_MS = 60_000;

export function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function avatarUrl(email) {
  const e = (email || '').trim().toLowerCase();
  // QQ 邮箱 (纯数字@qq.com): 直接用 QQ 头像, 国内速度快
  const qqMatch = e.match(/^(\d+)@qq\.com$/);
  if (qqMatch) {
    return `https://q1.qlogo.cn/g?b=qq&nk=${qqMatch[1]}&s=100`;
  }
  // 其他邮箱: Gravatar
  const hash = await sha256hex(e);
  return `https://cravatar.cn/avatar/${hash}?d=monsterid&s=80`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_RE = /^https?:\/\/[^\s]+$/i;

export function normalizeWebsite(website) {
  if (!website) return null;
  website = website.trim();
  if (!website) return null;
  if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
  if (!URL_RE.test(website)) return null;
  return website.slice(0, 200);
}

export async function initTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS page_views (
      path TEXT PRIMARY KEY,
      pv INTEGER DEFAULT 0,
      uv INTEGER DEFAULT 0
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS uv_log (
      key TEXT PRIMARY KEY,
      expire INTEGER
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      nickname TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ip_hash TEXT,
      status TEXT DEFAULT 'approved'
    )`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_comments_path ON comments(path, created_at)`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)`
  ).run();
}

export function handleOptions() {
  return new Response(null, {
    headers: { ...CORS, 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  });
}

// ---------- 追番 ----------
export async function initBangumiTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS bangumi_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort INTEGER DEFAULT 0
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS bangumi_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      image TEXT DEFAULT '',
      link TEXT DEFAULT '',
      intro TEXT DEFAULT '',
      episode TEXT DEFAULT '',
      status TEXT DEFAULT '在看',
      category_id INTEGER,
      sort INTEGER DEFAULT 0,
      updated_at INTEGER
    )`
  ).run();
  // 旧库补列:total = 最新更新集数(自动同步)
  try {
    await env.DB.prepare(`ALTER TABLE bangumi_items ADD COLUMN total TEXT DEFAULT ''`).run();
  } catch (e) { /* 列已存在 */ }
}

const BANGUMI_SEED_CATEGORIES = ['动态漫', '动画', '电视剧', '短剧'];
const BANGUMI_SEED_ITEMS = [
  {
    title: '我的徒弟都是大反派',
    author: '无',
    image: 'https://tse1-mm.cn.bing.net/th/id/OIP-C.uxXqXygj4vFGmaISAD-pWwHaEQ?w=309&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
    link: 'https://www.bilibili.com/video/BV1Pguz6GEit/?spm_id_from=333.788.videopod.episodes&vd_source=022c4b6ee0ef30b6211660b7c17095cf&p=2',
    intro: '五师妹想回师门，但是被老头拒绝。小师妹刚突破境界.6.16.42',
    episode: '114',
    status: '在看',
    category: '动态漫',
  },
  {
    title: '我在大明那些年',
    author: '布墨迹',
    image: 'https://vcover-hz-pic.puui.qpic.cn/vcover_hz_pic/0/mzc003wploktyii1769347115/0',
    link: 'https://www.bilibili.com/video/BV15KhJ6fEsL/?spm_id_from=333.1387.homepage.video_card.click&vd_source=022c4b6ee0ef30b6211660b7c17095cf',
    intro: '皇帝找来道士被布青发现，布青退朝游历到张居正那里，并且捐献1000两银子用来建造学塾',
    episode: '559',
    status: '在看',
    category: '动态漫',
  },
  {
    title: '凡人修仙传',
    author: '不知道',
    image: 'https://tse4-mm.cn.bing.net/th/id/OIP-C.ZqZC7vZQSRKqiPdE1PaxnwHaEK?w=290&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
    link: 'https://www.bilibili.com/bangumi/play/ss28747?spm_id_from=333.337.0.0',
    intro: '晶龙阁元婴交换会正式开启，韩立拿出妖丹换材料，寻找庚精，和一众元婴老怪以物易物，这是天南交易会',
    episode: '167',
    status: '在看',
    category: '动画',
  },
];

// 首次访问时自动建表，并把 bangumi.yml 里的旧数据迁移进去
export async function seedBangumi(env) {
  const catRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM bangumi_categories').first();
  if (!catRow || !catRow.n) {
    for (let i = 0; i < BANGUMI_SEED_CATEGORIES.length; i++) {
      await env.DB.prepare('INSERT INTO bangumi_categories (name, sort) VALUES (?, ?)')
        .bind(BANGUMI_SEED_CATEGORIES[i], i)
        .run();
    }
  }
  const itemRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM bangumi_items').first();
  if (!itemRow || !itemRow.n) {
    const cats = await env.DB.prepare('SELECT id, name FROM bangumi_categories').all();
    const byName = {};
    (cats.results || []).forEach((c) => { byName[c.name] = c.id; });
    for (let i = 0; i < BANGUMI_SEED_ITEMS.length; i++) {
      const s = BANGUMI_SEED_ITEMS[i];
      await env.DB.prepare(
        'INSERT INTO bangumi_items (title, author, image, link, intro, episode, status, category_id, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(s.title, s.author, s.image, s.link, s.intro, s.episode, s.status, byName[s.category] || null, i, Date.now()).run();
    }
  }
}