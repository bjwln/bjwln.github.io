// GitHub 每日热门数据源: GET /api/github-trending
// 服务端抓取 github.com/trending (daily 区间) 解析前 10 名。
// GitHub 无官方 Trending API 且浏览器直抓会被 CORS 拦截, 故在边缘函数里抓;
// Trending 每天一更, 边缘缓存 30 分钟足够 (失败响应短缓存, 便于快速自愈)。
import { json, handleOptions } from '../_lib';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_URL = 'https://github.com/trending';
const TIMEOUT_MS = 6000;   // CF 边缘到 GitHub 通常 <1s; 两次尝试共 12s, 与前端超时对齐
const MAX_REPOS = 10;
const CACHE_OK_S = 1800;
const CACHE_FAIL_S = 120;

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// 解析 trending 页面 (article.Box-row)。GitHub 改版导致解析为空时返回 [],
// 上层以 ok:false 降级, 前端显示"暂不可用"。
export function parseTrending(html, max = MAX_REPOS) {
  const out = [];
  const blocks = html.split(/<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>/i).slice(1);
  for (const chunk of blocks) {
    if (out.length >= max) break;
    const b = chunk.split(/<\/article>/i)[0];
    const repoM = b.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"#?]+)"/i);
    if (!repoM) continue;
    const repo = repoM[1].replace(/\/+$/, '').trim();
    if (!repo.includes('/') || repo.length > 120) continue;
    // 简介: 锚定 col-9 class, 回退到任意 <p>; \b 防止误匹配 <picture> 等标签
    const descM =
      b.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
      b.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const langM = b.match(/itemprop="programmingLanguage">([^<]+)</i);
    const starsM = b.match(/href="\/[^"]+\/stargazers"[^>]*>(?:\s*<svg[\s\S]*?<\/svg>)?\s*([\d,]+)/i);
    const todayM = b.match(/([\d,]+)\s+stars\s+today/i);
    const desc = decodeEntities((descM ? descM[1] : '').replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ').trim();
    out.push({
      repo,
      url: 'https://github.com/' + repo,
      description: desc.slice(0, 200),
      language: langM ? langM[1].trim() : '',
      stars: starsM ? starsM[1] : '',
      starsToday: todayM ? todayM[1] : '',
    });
  }
  return out;
}

async function fetchTrending(url) {
  let lastErr;
  // 失败重试一次: 上游偶发抖动时第二次尝试通常即可恢复
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return parseTrending(await r.text());
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export async function onRequestGet(context) {
  const { request } = context;
  try {
    const cached = await caches.default.match(request);
    if (cached) return cached;
  } catch (e) { /* 本地预览等环境无 caches, 直接走实时 */ }

  // TRENDING_URL 仅用于本地测试注入留档页面, 生产走默认官方地址
  const url = (context.env && context.env.TRENDING_URL) || DEFAULT_URL;
  const data = { ts: Date.now(), ok: false, repos: [] };
  try {
    const repos = await fetchTrending(url);
    if (repos.length) { data.ok = true; data.repos = repos; }
  } catch (e) { /* 抓取失败: ok=false, 前端降级显示 */ }

  const res = json(data);
  res.headers.set('Cache-Control', `public, max-age=${data.ok ? CACHE_OK_S : CACHE_FAIL_S}`);
  try { context.waitUntil(caches.default.put(request, res.clone())); } catch (e) { /* ignore */ }
  return res;
}

export async function onRequestOptions() {
  return handleOptions();
}
