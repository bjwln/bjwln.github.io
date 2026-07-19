import { json, initTables, handleOptions } from '../_lib';

export async function onRequestGet(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  const { results } = await env.DB.prepare('SELECT path, pv, uv FROM page_views ORDER BY pv DESC LIMIT 500').all();
  return json({ total: results.length, data: results });
}

export async function onRequestOptions() {
  return handleOptions();
}