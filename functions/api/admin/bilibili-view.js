import { json, initTables, handleOptions } from '../../_lib';

// GET /api/admin/bilibili-view?bvid=BVxxx
// 本地管理端的同步在 view 接口被本机 IP 风控(412)时,借 Cloudflare Worker 出口重试一次
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
  const bvid = String(new URL(request.url).searchParams.get('bvid') || '').trim();
  if (!/^BV[0-9A-Za-z]+$/.test(bvid)) return json({ error: 'invalid bvid' }, 400);
  try {
    const resp = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' },
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
