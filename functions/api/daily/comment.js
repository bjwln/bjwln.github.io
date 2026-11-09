// 每日资讯 AI 点评: GET /api/daily/comment
// 用 Workers AI 结合当天新闻标题 + 金价/股指数据, 生成「原因与建议」点评。
// 结果按 URL 边缘缓存 30 分钟; 任何失败返回 { comment: null }, 前端用规则建议兜底。
import { json, handleOptions } from '../../_lib';
import { buildDaily } from '../daily';

// 模型按序尝试, 任一成功即用（中文优先 Qwen）
const MODELS = ['@cf/qwen/qwen3-30b-a3b-fp8', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
const AI_TIMEOUT_MS = 25000;
const CACHE_MAX_AGE = 1800;

const SYSTEM_PROMPT = [
  '你是一位中文财经生活简报编辑，为个人博客「摸鱼」板块的「每日资讯」撰写当日解读。',
  '写作要求：',
  '1. 输出 3 个自然段，共 260-420 字，用纯文本，段落之间空一行，禁止使用任何标题符号、列表符号、加粗或表情。',
  '2. 第一段：概括今日市场整体基调与可能的原因。只能基于给出的新闻标题做克制的联想（用「或与…有关」「市场关注…」这类表述），严禁编造数据、事件细节或把涨跌归因于具体某条新闻。',
  '3. 第二段：点评金价与主要股指的现状，点出涨跌结构（如普跌/分化/强弱），不做任何涨跌预测。',
  '4. 第三段：给普通读者 2-3 条务实建议（风险控制、仓位与现金流、信息甄别、出行生活等），要贴合当天数据。',
  '5. 语气平实友好，像懂行的朋友在聊天；不要分析师腔，不要问候语，不要免责声明（页面已有）。',
].join('\n');

function buildUserPrompt(d) {
  const dateStr = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date());
  const lines = ['【日期】' + dateStr];
  if (d.gold) {
    const g = [];
    if (d.gold.au) g.push('沪金99主力 ' + d.gold.au.price + ' 元/克（较昨结 ' + (d.gold.au.pct > 0 ? '+' : '') + d.gold.au.pct + '%）');
    if (d.gold.xau) g.push('伦敦金现 ' + d.gold.xau.usd + ' 美元/盎司' + (d.gold.xau.cnyPerGram ? '（约 ' + d.gold.xau.cnyPerGram + ' 元/克）' : ''));
    if (g.length) lines.push('【贵金属】' + g.join('；'));
  }
  if (d.stocks && d.stocks.length) {
    lines.push('【股指】' + d.stocks.map((s) => s.name + ' ' + s.price + '（' + (s.pct > 0 ? '+' : '') + s.pct + '%）').join('；'));
  }
  const titles = (arr, n) => arr.slice(0, n).map((x, i) => (i + 1) + '. ' + x.title).join('\n');
  if (d.news && d.news.cn && d.news.cn.length) lines.push('【国内新闻标题】\n' + titles(d.news.cn, 6));
  if (d.news && d.news.world && d.news.world.length) lines.push('【国际新闻标题】\n' + titles(d.news.world, 6));
  return lines.join('\n\n');
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

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const cached = await caches.default.match(request);
    if (cached) return cached;
  } catch (e) { /* ignore */ }

  if (!env || !env.AI) {
    return json({ comment: null, reason: 'AI 绑定未配置（本地预览属正常现象）' });
  }

  // 尽量复用 /api/daily 的边缘缓存，避免重复抓上游
  let d = null;
  try {
    const dailyReq = new Request(new URL('/api/daily', request.url).toString());
    const cachedDaily = await caches.default.match(dailyReq);
    d = cachedDaily ? await cachedDaily.json() : await buildDaily();
  } catch (e) {
    try { d = await buildDaily(); } catch (e2) { d = null; }
  }
  if (!d || (!(d.stocks && d.stocks.length) && !(d.news && (d.news.cn.length || d.news.world.length)))) {
    return json({ comment: null, reason: '行情/新闻数据暂不可用' });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(d) },
  ];
  let text = null;
  for (const model of MODELS) {
    try {
      const out = await withTimeout(env.AI.run(model, { messages, temperature: 0.6, max_tokens: 700 }), AI_TIMEOUT_MS);
      text = extractText(out);
      if (text && text.trim()) break;
      text = null;
    } catch (e) { text = null; }
  }
  if (!text) return json({ comment: null, reason: 'AI 生成失败，稍后再试' });

  // 轻量清理：去掉可能出现的 markdown 符号
  text = text.replace(/\*\*/g, '').replace(/^#{1,6}\s*/gm, '').replace(/^[*-]\s+/gm, '').trim();

  const res = json({ comment: text });
  res.headers.set('Cache-Control', 'public, max-age=' + CACHE_MAX_AGE);
  try { context.waitUntil(caches.default.put(request, res.clone())); } catch (e) { /* ignore */ }
  return res;
}

export async function onRequestOptions() {
  return handleOptions();
}
