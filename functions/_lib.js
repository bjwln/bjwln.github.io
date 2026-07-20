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