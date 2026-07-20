import { json, initTables, handleOptions, avatarUrl } from '../_lib';

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

export async function onRequestOptions() {
  return handleOptions();
}