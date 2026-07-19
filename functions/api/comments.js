import { json, initTables, handleOptions, avatarUrl, sha256hex, EMAIL_RE, normalizeWebsite, MAX_NICKNAME, MAX_CONTENT, RATE_LIMIT_MS } from '../_lib';

export async function onRequestGet(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  const url = new URL(request.url);
  const pagePath = url.searchParams.get('path') || '/';
  const { results } = await env.DB.prepare(
    `SELECT id, path, parent_id, nickname, website, content, created_at, email
     FROM comments WHERE path = ? AND status = 'approved' ORDER BY created_at ASC`
  ).bind(pagePath).all();

  const data = await Promise.all(
    (results || []).map(async (r) => ({
      id: r.id, path: r.path, parent_id: r.parent_id, nickname: r.nickname,
      website: r.website, content: r.content, created_at: r.created_at,
      avatar: await avatarUrl(r.email),
    }))
  );
  return json({ path: pagePath, total: data.length, data });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const pagePath = (body.path || '').trim().slice(0, 500);
  if (!pagePath) return json({ error: 'path required' }, 400);
  const nickname = (body.nickname || '').trim().slice(0, MAX_NICKNAME);
  if (!nickname) return json({ error: 'nickname required' }, 400);
  const email = (body.email || '').trim();
  if (!EMAIL_RE.test(email)) return json({ error: 'invalid email' }, 400);
  const website = normalizeWebsite(body.website);
  const content = (body.content || '').trim();
  if (!content) return json({ error: 'content required' }, 400);
  if (content.length > MAX_CONTENT) return json({ error: 'content too long' }, 400);

  let parentId = null;
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = Number(body.parent_id);
    if (!Number.isInteger(parentId) || parentId < 1) return json({ error: 'invalid parent_id' }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipHash = await sha256hex(ip);
  const now = Date.now();

  const recent = await env.DB.prepare(
    'SELECT id FROM comments WHERE ip_hash = ? AND created_at > ? LIMIT 1'
  ).bind(ipHash, now - RATE_LIMIT_MS).first();
  if (recent) return json({ error: 'rate_limited' }, 429);

  const result = await env.DB.prepare(
    `INSERT INTO comments (path, parent_id, nickname, email, website, content, created_at, ip_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).bind(pagePath, parentId, nickname, email, website, content, now, ipHash).run();

  const row = await env.DB.prepare('SELECT id, path, parent_id, nickname, website, content, created_at FROM comments WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return json({
    ok: true,
    comment: { ...row, avatar: await avatarUrl(email) },
  });
}

export async function onRequestOptions() {
  return handleOptions();
}