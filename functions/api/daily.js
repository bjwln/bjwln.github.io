// 每日资讯数据源: GET /api/daily
// 聚合: 新闻 RSS(国内+国际)、新浪行情(金价+股指)、汇率、每日一言
// 设计: 全部上游并发抓取、单源超时、部分失败不影响整体; 边缘缓存 10 分钟
// 想加减数据源改下面的常量即可
import { json, handleOptions } from '../_lib';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SINA_HEADERS = { Referer: 'https://finance.sina.com.cn/', 'User-Agent': UA };
const TIMEOUT_MS = 4500;

// 新浪 hq.sinajs.cn 代码（股指）
const STOCK_CODES = [
  's_sh000001', // 上证指数
  's_sz399001', // 深证成指
  's_sz399006', // 创业板指
  's_sh000300', // 沪深300
  'hkHSI',      // 恒生指数
  'int_dji',    // 道琼斯
  'int_nasdaq', // 纳斯达克
  'int_sp500',  // 标普500
];
// 金价代码: gds_AU9999 沪金99(元/克) / hf_XAU 伦敦金现(美元/盎司)
const GOLD_CODES = ['gds_AU9999', 'hf_XAU'];
const OZ_TO_GRAM = 31.1035;

// 新闻 RSS 源
const FEEDS = {
  cn: [
    { url: 'https://www.chinanews.com.cn/rss/scroll-news.xml', source: '中国新闻网' },
    { url: 'https://www.people.com.cn/rss/politics.xml', source: '人民网' },
  ],
  world: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: '纽约时报' },
  ],
};
const NEWS_PER_GROUP = 8;

// ---------- 基础工具 ----------
function fetchT(url, ms = TIMEOUT_MS, opts = {}) {
  return fetch(url, {
    ...opts,
    signal: AbortSignal.timeout(ms),
    headers: { 'user-agent': UA, ...(opts.headers || {}) },
  });
}

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function cleanText(s) {
  return decodeEntities(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ').trim();
}

function tagText(item, tag) {
  const m = item.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? m[1] : '';
}

// 按响应头/xml 声明选择解码（人民网等源可能是 GBK）
function decodeBuf(buf, contentType) {
  let cs = '';
  const m = /charset=([\w-]+)/i.exec(contentType || '');
  if (m) cs = m[1].toLowerCase();
  if (!cs) {
    try {
      const head = new TextDecoder('utf-8').decode(buf.slice(0, 200));
      const d = /encoding=["']([\w-]+)["']/i.exec(head);
      if (d) cs = d[1].toLowerCase();
    } catch (e) { /* ignore */ }
  }
  if (/^gb2312|gbk|gb18030/.test(cs)) {
    try { return new TextDecoder('gbk').decode(buf); } catch (e) { /* fallthrough */ }
  }
  return new TextDecoder('utf-8').decode(buf);
}

function fmtPubTime(pub) {
  if (!pub) return '';
  const d = new Date(pub.trim());
  if (isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return f.format(d).replace(/\//g, '-');
}

// ---------- 新闻 RSS ----------
export function parseRss(xml, source, max) {
  const out = [];
  const chunks = xml.split(/<item(?:\s[^>]*)?>/i);
  for (let i = 1; i < chunks.length && out.length < max * 2; i++) {
    const seg = chunks[i].split(/<\/item>/i)[0];
    const title = cleanText(tagText(seg, 'title'));
    let link = cleanText(tagText(seg, 'link'));
    if (!title || !/^https?:\/\//i.test(link)) continue;
    link = decodeEntities(link);
    out.push({ title, link, time: fmtPubTime(tagText(seg, 'pubDate')), source });
  }
  return out;
}

async function fetchFeedGroup(feeds, max) {
  const results = await Promise.allSettled(feeds.map(async (f) => {
    const r = await fetchT(f.url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    return parseRss(decodeBuf(buf, r.headers.get('content-type') || ''), f.source, max * 2);
  }));
  const items = [];
  const seen = new Set();
  for (const g of results) {
    if (g.status !== 'fulfilled') continue;
    for (const it of g.value) {
      const k = it.title.slice(0, 24);
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(it);
    }
  }
  // 多源合并后按时间取最新，陈年旧文自然沉底
  items.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return items.slice(0, max);
}

// ---------- 新浪行情 ----------
function parseSina(text) {
  const map = {};
  const re = /var\s+hq_str_(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) map[m[1]] = m[2];
  return map;
}

function sinaStocks(map) {
  const out = [];
  for (const code of STOCK_CODES) {
    const raw = map[code];
    if (!raw) continue;
    const f = raw.split(',');
    let it = null;
    if (code.startsWith('s_')) {
      if (f.length >= 4) it = { key: code, name: f[0], price: +f[1], change: +f[2], pct: +f[3] };
    } else if (code === 'hkHSI') {
      if (f.length >= 9) it = { key: code, name: f[1], price: +f[2], change: +f[7], pct: +f[8] };
    } else if (code.startsWith('int_')) {
      if (f.length >= 4) it = { key: code, name: f[0], price: +f[1], change: +f[2], pct: +f[3] };
    }
    if (it && isFinite(it.price) && it.price > 0) {
      it.price = +it.price.toFixed(2);
      it.change = +it.change.toFixed(2);
      it.pct = +it.pct.toFixed(2);
      out.push(it);
    }
  }
  return out;
}

function sinaGold(map, usdcny) {
  const gold = {};
  const au = map['gds_AU9999'];
  if (au) {
    const f = au.split(',');
    const price = +f[7], prev = +f[8]; // [7]=最新价 [8]=昨结算
    if (isFinite(price) && price > 0 && isFinite(prev) && prev > 0) {
      gold.au = {
        name: cleanText(f[13]) || '沪金99',
        price, prev,
        change: +(price - prev).toFixed(2),
        pct: +(((price - prev) / prev) * 100).toFixed(2),
      };
    }
  }
  const xau = map['hf_XAU'];
  if (xau) {
    const f = xau.split(',');
    const usd = +f[0]; // [0]=最新价（与 gold-api 实测一致）
    if (isFinite(usd) && usd > 0) {
      gold.xau = {
        name: cleanText(f[13]) || '伦敦金现',
        usd,
        cnyPerGram: usdcny ? +((usd * usdcny) / OZ_TO_GRAM).toFixed(1) : null,
      };
    }
  }
  return Object.keys(gold).length ? gold : null;
}

async function fetchSina() {
  const codes = [...STOCK_CODES, ...GOLD_CODES].join(',');
  const r = await fetchT('https://hq.sinajs.cn/list=' + codes, TIMEOUT_MS, { headers: SINA_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  return parseSina(decodeBuf(buf, 'text/plain; charset=gbk'));
}

// ---------- 汇率 / 金价兜底 / 一言 ----------
async function fetchUsdCny() {
  const r = await fetchT('https://open.er-api.com/v6/latest/USD', 5000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const cny = j && j.rates && j.rates.CNY;
  if (!isFinite(cny) || cny <= 0) throw new Error('no CNY rate');
  return +cny.toFixed(4);
}

async function fetchXauFallback() {
  const r = await fetchT('https://api.gold-api.com/price/XAU', 5000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j && isFinite(j.price) && j.price > 0 ? +j.price.toFixed(2) : null;
}

async function fetchQuote() {
  const r = await fetchT('https://v1.hitokoto.cn/?c=c&c=d&c=i&max_length=42&encode=json', 5000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j && j.hitokoto ? { text: j.hitokoto, from: j.from || '', who: j.from_who || '' } : null;
}

// ---------- 聚合 ----------
export async function buildDaily() {
  const [sinaRes, fxRes, cnRes, worldRes, quoteRes] = await Promise.allSettled([
    fetchSina(),
    fetchUsdCny(),
    fetchFeedGroup(FEEDS.cn, NEWS_PER_GROUP),
    fetchFeedGroup(FEEDS.world, NEWS_PER_GROUP),
    fetchQuote(),
  ]);

  const data = { ts: Date.now(), ok: {}, gold: null, stocks: [], news: { cn: [], world: [] }, quote: null };
  let map = null, usdcny = null;
  if (sinaRes.status === 'fulfilled') { map = sinaRes.value; data.ok.sina = true; }
  if (fxRes.status === 'fulfilled') usdcny = fxRes.value;
  data.ok.fx = usdcny != null;

  if (map) {
    data.stocks = sinaStocks(map);
    data.gold = sinaGold(map, usdcny);
  }
  // 国际金价兜底源（新浪不可达时）
  if (!data.gold || !data.gold.xau) {
    try {
      const usd = await fetchXauFallback();
      if (usd) {
        data.gold = data.gold || {};
        data.gold.xau = { name: '伦敦金现', usd, cnyPerGram: usdcny ? +((usd * usdcny) / OZ_TO_GRAM).toFixed(1) : null };
      }
    } catch (e) { /* 兜底失败就显示空 */ }
  }

  if (cnRes.status === 'fulfilled') data.news.cn = cnRes.value;
  if (worldRes.status === 'fulfilled') data.news.world = worldRes.value;
  if (quoteRes.status === 'fulfilled') data.quote = quoteRes.value;
  data.ok.newsCn = data.news.cn.length > 0;
  data.ok.newsWorld = data.news.world.length > 0;
  return data;
}

// ---------- 路由 ----------
export async function onRequestGet(context) {
  const { request } = context;
  try {
    const cached = await caches.default.match(request);
    if (cached) return cached;
  } catch (e) { /* 本地预览等环境无 caches, 直接走实时 */ }

  const data = await buildDaily();
  const res = json(data);
  res.headers.set('Cache-Control', 'public, max-age=300');
  try { context.waitUntil(caches.default.put(request, res.clone())); } catch (e) { /* ignore */ }
  return res;
}

export async function onRequestOptions() {
  return handleOptions();
}
