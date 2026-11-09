// GitHub 每日热门数据源: GET /api/github-trending
// 服务端抓取 github.com/trending (daily 区间) 解析前 10 名;
// 简介用 Workers AI 翻译成中文 (D1 持久缓存, 只翻译新项目), 失败回退英文原文。
// GitHub 无官方 Trending API 且浏览器直抓会被 CORS 拦截, 故在边缘函数里抓;
// Trending 每天一更, 边缘缓存 30 分钟足够 (失败响应短缓存, 便于快速自愈)。
import { json, handleOptions } from '../_lib';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_URL = 'https://github.com/trending';
const TIMEOUT_MS = 6000;   // CF 边缘到 GitHub 通常 <1s; 两次尝试共 12s, 与前端超时对齐
const MAX_REPOS = 10;
const CACHE_OK_S = 1800;
const CACHE_FAIL_S = 120;

// ---------- 中文翻译 (Workers AI, 与 /api/daily/comment 同款模型策略) ----------
const AI_MODELS = ['@cf/qwen/qwen3-30b-a3b-fp8', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
const AI_TIMEOUT_MS = 15000;
const ZH_TABLE = 'gh_trending_desc_zh';

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

function extractText(out) {
  if (!out) return null;
  if (typeof out === 'string') return out;
  return out.response || out.content || out.result || null;
}

function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('AI 超时')), ms)),
  ]);
}

function buildTranslatePrompt(items) {
  return [
    '把下面 JSON 数组里的 GitHub 开源项目简介翻译成简体中文。',
    '要求：',
    '1. 专有名词与技术名词（如 Kubernetes、LLM、CLI、Agent、Rust）保留英文原文；',
    '2. 语义准确、表达简洁通顺，不要逐字直译；',
    '3. 已是中文的条目原样保留；',
    '4. 只输出一个 JSON 字符串数组，元素与输入一一对应、顺序一致，不要输出任何解释、标题或代码块标记。',
    '',
    JSON.stringify(items.map((x) => x.description)),
  ].join('\n');
}

// 返回与 items 等长的中文数组; 失败返回 null (调用方回退英文)
export async function translateBatch(ai, items) {
  const messages = [
    { role: 'system', content: '你是专业的开发者文档翻译。只输出 JSON 字符串数组，不输出任何其他内容。' },
    { role: 'user', content: buildTranslatePrompt(items) },
  ];
  let text = null;
  for (const model of AI_MODELS) {
    try {
      const out = await withTimeout(ai.run(model, { messages, temperature: 0.2, max_tokens: 1500 }), AI_TIMEOUT_MS);
      text = extractText(out);
      if (text && text.trim()) break;
      text = null;
    } catch (e) { text = null; }
  }
  if (!text) return null;
  // 解析: 优先截取 JSON 数组, 兜底按行去序号
  try {
    const m = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : text);
    if (Array.isArray(arr) && arr.length === items.length) {
      return arr.map((s) => String(s).replace(/\s+/g, ' ').trim());
    }
  } catch (e) { /* fallthrough */ }
  const lines = text.split('\n')
    .map((s) => s.replace(/^\s*(?:\d+[.、)])\s*/, '').replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  return lines.length === items.length ? lines : null;
}

let zhTableReady = null; // 每个 isolate 只建表一次
function ensureZhTable(db) {
  if (!zhTableReady) {
    zhTableReady = db.prepare(
      `CREATE TABLE IF NOT EXISTS ${ZH_TABLE} (
        repo TEXT NOT NULL,
        description TEXT NOT NULL,
        description_zh TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (repo, description)
      )`
    ).run().catch((e) => { zhTableReady = null; throw e; });
  }
  return zhTableReady;
}

function zhKey(repo, desc) { return repo + '|' + desc; }

async function loadZhCache(db, repos) {
  const map = new Map();
  if (!db) return map;
  await ensureZhTable(db);
  const placeholders = repos.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT repo, description, description_zh FROM ${ZH_TABLE} WHERE repo IN (${placeholders})`
  ).bind(...repos.map((r) => r.repo)).all();
  for (const row of results || []) {
    if (row && row.description_zh) map.set(zhKey(row.repo, row.description), row.description_zh);
  }
  return map;
}

// 给 repos 补中文简介: D1 缓存优先, 缺失的走一次 AI 批量翻译; 任何失败回退英文。
// 返回待写入的 D1 持久化 promise (供 context.waitUntil, 不阻塞响应)。
export function addChinese(env, repos) {
  const ai = env && env.AI;
  const db = env && env.DB;
  if (!ai || !repos.length) return null;
  return (async () => {
    let zhMap = new Map();
    try { if (db) zhMap = await loadZhCache(db, repos); } catch (e) { zhMap = new Map(); }
    const need = repos.filter((r) => r.description && !zhMap.has(zhKey(r.repo, r.description)));
    let pendingSave = null;
    if (need.length) {
      const out = await translateBatch(ai, need);
      if (out) {
        need.forEach((r, i) => { if (out[i]) zhMap.set(zhKey(r.repo, r.description), out[i]); });
        if (db) {
          const now = Date.now();
          const stmts = need
            .map((r, i) => (out[i] && db.prepare(
              `INSERT INTO ${ZH_TABLE} (repo, description, description_zh, created_at) VALUES (?, ?, ?, ?)
               ON CONFLICT (repo, description) DO UPDATE SET description_zh = excluded.description_zh, created_at = excluded.created_at`
            ).bind(r.repo, r.description, out[i], now)))
            .filter(Boolean);
          if (stmts.length) {
            pendingSave = ensureZhTable(db).then(() => db.batch(stmts)).catch(() => { /* 缓存写失败不影响响应 */ });
          }
        }
      }
    }
    for (const r of repos) {
      const zh = zhMap.get(zhKey(r.repo, r.description)) || '';
      if (zh && zh !== r.description) {
        r.descriptionEn = r.description; // 悬停浮窗里保留英文原文
        r.description = zh;
      }
    }
    return pendingSave;
  })();
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
  const { request, env } = context;
  try {
    const cached = await caches.default.match(request);
    if (cached) return cached;
  } catch (e) { /* 本地预览等环境无 caches, 直接走实时 */ }

  // TRENDING_URL 仅用于本地测试注入留档页面, 生产走默认官方地址
  const url = (env && env.TRENDING_URL) || DEFAULT_URL;
  const data = { ts: Date.now(), ok: false, repos: [] };
  let pendingSave = null;
  try {
    const repos = await fetchTrending(url);
    if (repos.length) {
      data.ok = true;
      data.repos = repos;
      try { pendingSave = await addChinese(env, repos); } catch (e) { /* 翻译失败回退英文 */ }
    }
  } catch (e) { /* 抓取失败: ok=false, 前端降级显示 */ }
  if (pendingSave) { try { context.waitUntil(pendingSave); } catch (e) { /* ignore */ } }

  const res = json(data);
  res.headers.set('Cache-Control', `public, max-age=${data.ok ? CACHE_OK_S : CACHE_FAIL_S}`);
  try { context.waitUntil(caches.default.put(request, res.clone())); } catch (e) { /* ignore */ }
  return res;
}

export async function onRequestOptions() {
  return handleOptions();
}
