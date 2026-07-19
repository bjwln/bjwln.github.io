import { json, initTables, handleOptions } from '../../_lib';

export async function onRequestGet(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare(
    `SELECT id, path, parent_id, nickname, website, content, created_at, status
     FROM comments ORDER BY created_at DESC LIMIT 500`
  ).all();
  return json({ data: results || [] });
}

export async function onRequestOptions() {
  return handleOptions();
}