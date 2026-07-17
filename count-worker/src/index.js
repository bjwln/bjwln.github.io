export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 健康检查
    if (path === '/' || path === '/ping') {
      return Response.json({ ok: true, time: Date.now() }, { headers: corsHeaders });
    }

    // ============ 建表(首次访问自动建) ============
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS page_views (
          path TEXT PRIMARY KEY,
          pv INTEGER DEFAULT 0,
          uv INTEGER DEFAULT 0
        )`
      ).run();
    } catch (e) {
      return Response.json({ error: 'init table failed: ' + e.message }, { status: 500, headers: corsHeaders });
    }

    // ============ 获取浏览量(只读,不计数) ============
    // GET /api/pv?path=/2026/06/24/xxx/
    if (path === '/api/pv' && request.method === 'GET') {
      const pagePath = url.searchParams.get('path') || '/';
      const row = await env.DB.prepare(
        'SELECT pv, uv FROM page_views WHERE path = ?'
      ).bind(pagePath).first();
      return Response.json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 }, { headers: corsHeaders });
    }

    // ============ 记录访问(PV+1, UV 去重) ============
    // POST /api/visit  body: { path: "/2026/06/24/xxx/" }
    if (path === '/api/visit' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid json' }, { status: 400, headers: corsHeaders });
      }
      const pagePath = body.path || '/';

      // 用访客 IP 做简单的 UV 去重(同一 IP 24 小时内只算一次 UV)
      const visitorKey = request.headers.get('cf-connecting-ip') || 'unknown';
      const uvFlag = 'uv_' + pagePath + '_' + visitorKey;

      // 检查这个 IP 今天是否访问过这篇文章(用 KV 风格,这里用 D1 的另一张表)
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS uv_log (
          key TEXT PRIMARY KEY,
          expire INTEGER
        )`
      ).run();

      const now = Date.now();
      const existing = await env.DB.prepare(
        'SELECT key FROM uv_log WHERE key = ? AND expire > ?'
      ).bind(uvFlag, now).first();

      const isNewUV = !existing;

      // PV +1
      await env.DB.prepare(
        `INSERT INTO page_views (path, pv, uv) VALUES (?, 1, 0)
         ON CONFLICT(path) DO UPDATE SET pv = pv + 1`
      ).bind(pagePath).run();

      // 如果是新 UV,UV +1,并记录访客标记(24小时过期)
      if (isNewUV) {
        await env.DB.prepare(
          `INSERT INTO uv_log (key, expire) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET expire = ?`
        ).bind(uvFlag, now + 86400000, now + 86400000).run();

        await env.DB.prepare(
          `UPDATE page_views SET uv = uv + 1 WHERE path = ?`
        ).bind(pagePath).run();
      }

      const row = await env.DB.prepare(
        'SELECT pv, uv FROM page_views WHERE path = ?'
      ).bind(pagePath).first();

      return Response.json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 }, { headers: corsHeaders });
    }

    // ============ 管理接口:查看所有文章浏览量 ============
    // GET /api/all
    if (path === '/api/all' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT path, pv, uv FROM page_views ORDER BY pv DESC LIMIT 500'
      ).all();
      return Response.json({ total: results.length, data: results }, { headers: corsHeaders });
    }

    return Response.json({ error: 'not found' }, { status: 404, headers: corsHeaders });
  }
};