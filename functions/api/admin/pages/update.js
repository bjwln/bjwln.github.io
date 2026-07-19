import { json, initTables, handleOptions } from '../../../_lib';

export async function onRequestPost(context) {
  const { request, env } = context;
  try { await initTables(env); } catch (e) { return json({ error: 'init table failed: ' + e.message }, 500); }
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const p = String(body.path || '').trim();
  const pv = Number(body.pv);
  const uv = Number(body.uv);
  if (!p || !Number.isInteger(pv) || pv < 0 || !Number.isInteger(uv) || uv < 0) return json({ error: 'invalid params' }, 400);
  await env.DB.prepare('UPDATE page_views SET pv = ?, uv = ? WHERE path = ?').bind(pv, uv, p).run();
  return json({ ok: true });
}

export async function onRequestOptions() {
  return handleOptions();
}