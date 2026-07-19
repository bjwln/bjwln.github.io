import { json, initTables, handleOptions } from '../_lib';

export async function onRequestPost(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const pagePath = body.path || '/';

  const visitorKey = request.headers.get('cf-connecting-ip') || 'unknown';
  const uvFlag = 'uv_' + pagePath + '_' + visitorKey;
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT key FROM uv_log WHERE key = ? AND expire > ?').bind(uvFlag, now).first();
  const isNewUV = !existing;

  await env.DB.prepare(
    `INSERT INTO page_views (path, pv, uv) VALUES (?, 1, 0)
     ON CONFLICT(path) DO UPDATE SET pv = pv + 1`
  ).bind(pagePath).run();

  if (isNewUV) {
    await env.DB.prepare(
      `INSERT INTO uv_log (key, expire) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET expire = ?`
    ).bind(uvFlag, now + 86_400_000, now + 86_400_000).run();
    await env.DB.prepare('UPDATE page_views SET uv = uv + 1 WHERE path = ?').bind(pagePath).run();
  }

  const row = await env.DB.prepare('SELECT pv, uv FROM page_views WHERE path = ?').bind(pagePath).first();
  return json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 });
}

export async function onRequestOptions() {
  return handleOptions();
}