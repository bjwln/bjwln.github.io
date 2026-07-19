import { json, initTables, handleOptions } from '../_lib';

export async function onRequestGet(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  const url = new URL(request.url);
  const pagePath = url.searchParams.get('path') || '/';
  const row = await env.DB.prepare('SELECT pv, uv FROM page_views WHERE path = ?').bind(pagePath).first();
  return json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 });
}

export async function onRequestOptions() {
  return handleOptions();
}