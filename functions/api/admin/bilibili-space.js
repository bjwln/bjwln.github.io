import { json, initTables, handleOptions } from '../../_lib';

// GET /api/admin/bilibili-space?mid=xxx
// 本地管理端的空间接口被风控时,借 Cloudflare Worker 出口重试
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
  const mid = String(new URL(request.url).searchParams.get('mid') || '').trim();
  if (!/^\d+$/.test(mid)) return json({ error: 'invalid mid' }, 400);
  try {
    const resp = await fetch('https://api.bilibili.com/x/series/recArchivesByKeywords?mid=' + mid + '&ps=30', {
      headers: { 'User-Agent': UA, Referer: 'https://space.bilibili.com/', Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    const data = await resp.json();
    return json({ code: data.code, message: data.message, data: data.data || null });
  } catch (e) {
    return json({ error: 'fetch failed: ' + e.message }, 502);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
