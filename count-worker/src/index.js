// numberofvisitors worker
// 功能 1: 页面浏览量 (PV/UV)  -- 原有
// 功能 2: 文章评论             -- 新增
// 存储: Cloudflare D1 (binding: DB, database: number_of_visitors)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

const MAX_NICKNAME = 30;
const MAX_CONTENT = 1000;
const RATE_LIMIT_MS = 60_000; // 同 IP 60 秒内最多 1 条评论

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

// SHA-256 -> hex (用于头像 hash 和 IP hash)
async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 头像 URL (cravatar 国内镜像, 兼容 gravatar; 默认 monsterid 头像)
async function avatarUrl(email) {
  const hash = await sha256hex((email || '').trim().toLowerCase());
  return `https://cravatar.cn/avatar/${hash}?d=monsterid&s=80`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function normalizeWebsite(website) {
  if (!website) return null;
  website = website.trim();
  if (!website) return null;
  if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
  if (!URL_RE.test(website)) return null;
  return website.slice(0, 200);
}

// 幂等建表
async function initTables(env) {
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (path === '/' || path === '/ping') {
      return json({ ok: true, time: Date.now() });
    }

    try {
      await initTables(env);
    } catch (e) {
      return json({ error: 'init table failed: ' + e.message }, 500);
    }

    // ============ 浏览量: 读取 (只读, 不计数) ============
    // GET /api/pv?path=/2026/06/24/xxx/
    if (path === '/api/pv' && request.method === 'GET') {
      const pagePath = url.searchParams.get('path') || '/';
      const row = await env.DB.prepare('SELECT pv, uv FROM page_views WHERE path = ?')
        .bind(pagePath)
        .first();
      return json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 });
    }

    // ============ 浏览量: 记录访问 (PV+1, UV 去重) ============
    // POST /api/visit  body: { path: "/2026/06/24/xxx/" }
    if (path === '/api/visit' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      const pagePath = body.path || '/';

      const visitorKey = request.headers.get('cf-connecting-ip') || 'unknown';
      const uvFlag = 'uv_' + pagePath + '_' + visitorKey;

      const now = Date.now();
      const existing = await env.DB.prepare(
        'SELECT key FROM uv_log WHERE key = ? AND expire > ?'
      )
        .bind(uvFlag, now)
        .first();
      const isNewUV = !existing;

      await env.DB.prepare(
        `INSERT INTO page_views (path, pv, uv) VALUES (?, 1, 0)
         ON CONFLICT(path) DO UPDATE SET pv = pv + 1`
      )
        .bind(pagePath)
        .run();

      if (isNewUV) {
        await env.DB.prepare(
          `INSERT INTO uv_log (key, expire) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET expire = ?`
        )
          .bind(uvFlag, now + 86_400_000, now + 86_400_000)
          .run();
        await env.DB.prepare('UPDATE page_views SET uv = uv + 1 WHERE path = ?')
          .bind(pagePath)
          .run();
      }

      const row = await env.DB.prepare('SELECT pv, uv FROM page_views WHERE path = ?')
        .bind(pagePath)
        .first();
      return json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 });
    }

    // ============ 浏览量: 管理接口, 查看所有文章浏览量 ============
    // GET /api/all
    if (path === '/api/all' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT path, pv, uv FROM page_views ORDER BY pv DESC LIMIT 500'
      ).all();
      return json({ total: results.length, data: results });
    }

    // ============ 评论: 获取某文章评论列表 (扁平, 含 parent_id) ============
    // GET /api/comments?path=/2026/06/24/xxx/
    if (path === '/api/comments' && request.method === 'GET') {
      const pagePath = url.searchParams.get('path') || '/';
      const { results } = await env.DB.prepare(
        `SELECT id, path, parent_id, nickname, website, content, created_at, email
         FROM comments
         WHERE path = ? AND status = 'approved'
         ORDER BY created_at ASC`
      )
        .bind(pagePath)
        .all();

      // 异步计算头像 (email -> sha256 -> avatar url)
      const data = await Promise.all(
        (results || []).map(async (r) => ({
          id: r.id,
          path: r.path,
          parent_id: r.parent_id,
          nickname: r.nickname,
          website: r.website,
          content: r.content,
          created_at: r.created_at,
          avatar: await avatarUrl(r.email),
        }))
      );
      return json({ path: pagePath, total: data.length, data });
    }

    // ============ 评论: 提交评论 ============
    // POST /api/comment  body: { path, parent_id?, nickname, email, website?, content }
    if (path === '/api/comment' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }

      const pagePath = (body.path || '').trim().slice(0, 500);
      if (!pagePath) return json({ error: 'path required' }, 400);

      const nickname = (body.nickname || '').trim().slice(0, MAX_NICKNAME);
      if (!nickname) return json({ error: 'nickname required' }, 400);

      const email = (body.email || '').trim();
      if (!EMAIL_RE.test(email)) return json({ error: 'invalid email' }, 400);

      const website = normalizeWebsite(body.website);

      const content = (body.content || '').trim();
      if (!content) return json({ error: 'content required' }, 400);
      if (content.length > MAX_CONTENT)
        return json({ error: 'content too long' }, 400);

      let parentId = null;
      if (body.parent_id != null && body.parent_id !== '') {
        parentId = Number(body.parent_id);
        if (!Number.isInteger(parentId) || parentId < 1)
          return json({ error: 'invalid parent_id' }, 400);
      }

      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const ipHash = await sha256hex(ip);
      const now = Date.now();

      // 频率限制: 同 IP 60 秒内最多 1 条
      const recent = await env.DB.prepare(
        'SELECT id FROM comments WHERE ip_hash = ? AND created_at > ? LIMIT 1'
      )
        .bind(ipHash, now - RATE_LIMIT_MS)
        .first();
      if (recent) return json({ error: 'rate_limited' }, 429);

      // 校验 parent_id 是否存在且属于同一文章
      if (parentId != null) {
        const parent = await env.DB.prepare(
          "SELECT id, path, parent_id FROM comments WHERE id = ? AND status = 'approved'"
        )
          .bind(parentId)
          .first();
        if (!parent) return json({ error: 'parent not found' }, 400);
        if (parent.path !== pagePath)
          return json({ error: 'parent path mismatch' }, 400);
        // 仅允许两层: 被回复的不能是回复
        if (parent.parent_id != null)
          return json({ error: 'reply depth exceeded' }, 400);
      }

      const result = await env.DB.prepare(
        `INSERT INTO comments (path, parent_id, nickname, email, website, content, created_at, ip_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`
      )
        .bind(pagePath, parentId, nickname, email, website, content, now, ipHash)
        .run();

      const id = result.meta?.last_row_id;
      const comment = {
        id,
        path: pagePath,
        parent_id: parentId,
        nickname,
        website,
        content,
        created_at: now,
        avatar: await avatarUrl(email),
      };
      return json({ ok: true, comment });
    }

    // ============ 评论: 管理员删除 ============
    // POST /api/comment/delete  header: X-Admin-Token  body: { id }
    if (path === '/api/comment/delete' && request.method === 'POST') {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1)
        return json({ error: 'invalid id' }, 400);

      // 删除评论及其所有回复
      await env.DB.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?')
        .bind(id, id)
        .run();
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },
};
