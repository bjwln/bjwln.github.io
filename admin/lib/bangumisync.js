'use strict';
// 追番「更新至」集数自动同步
// 番剧(ss/ep)与普通视频(BV)走 B 站 API;动态漫多为 UP 主合集,从 ugc_season 取全部分集取最大集数;
// 其他站点退化为抓取网页 HTML 正则匹配「更新至第 N 集 / 全 N 集」。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT = 12000;
const cf = require('./cf');

// B站会对无 cookie 的请求返回 412 风控:先访问首页拿 buvid,之后所有请求带上
let jar = '';
let jarAt = 0;

async function ensureCookies() {
  if (jar && Date.now() - jarAt < 6 * 3600e3) return;
  try {
    const r = await fetch('https://www.bilibili.com/', {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (set.length) {
      jar = set.map(c => c.split(';')[0]).join('; ');
      jarAt = Date.now();
    }
  } catch { /* 拿不到也继续尝试 */ }
}

function collectCookies(resp) {
  const set = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
  if (!set.length) return;
  const have = new Set(jar ? jar.split('; ').map(c => c.split('=')[0]) : []);
  for (const c of set) {
    const pair = c.split(';')[0];
    const name = pair.split('=')[0];
    if (have.has(name)) jar = jar.replace(new RegExp('(?:^|; )' + name + '=[^;]*'), '').replace(/^; /, '');
    jar = jar ? jar + '; ' + pair : pair;
  }
}

async function fetchText(url, referer) {
  await ensureCookies();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': referer || 'https://www.bilibili.com/', 'Accept-Language': 'zh-CN,zh;q=0.9', Cookie: jar },
      signal: ctrl.signal,
    });
    collectCookies(resp);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, referer) {
  const text = await fetchText(url, referer);
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('返回的不是 JSON(可能被风控)'); }
  return d;
}

function firstNum() {
  for (let i = 0; i < arguments.length; i++) {
    const m = String(arguments[i] == null ? '' : arguments[i]).match(/(\d+)/);
    if (m) return m[1];
  }
  return null;
}

// B站番剧(ss/ep 链接) → pgc season API
async function fromBangumiPage(link) {
  const m = link.match(/bangumi\/play\/(ss|ep)(\d+)/);
  if (!m) return null;
  const q = m[1] === 'ss' ? 'season_id=' + m[2] : 'ep_id=' + m[2];
  const d = await fetchJson('https://api.bilibili.com/pgc/view/web/season?' + q);
  const r = d && d.result;
  if (!r) throw new Error((d && d.message) || '番剧数据为空');
  // 取「分集编号最大值」与官方 new_ep.title 的较大者;
  // 注意 new_ep.desc 是排期文案(如「6月13日起 每周六11:00」),不能从中提取集数
  const nums = (r.episodes || [])
    .map(e => firstNum(e.title, e.long_title))
    .filter(Boolean).map(Number).filter(n => n > 0 && n < 3000);
  const official = Number(firstNum(r.new_ep && r.new_ep.title)) || 0;
  const best = Math.max(official, nums.length ? Math.max(...nums) : 0);
  if (!best) return null;
  return { total: String(best), source: 'B站番剧' };
}

// B站普通视频(BV 链接) → 合集(ugc_season)或分P;view 接口被风控(412)时退化为按条目标题搜索
async function totalFromVideo(bvid, fallbackTitle) {
  let videoTitle = fallbackTitle || '';
  let pages = 0;

  // 两个 view 通道:本机直连 → Cloudflare Worker 出口(本机 IP 被风控 412 时启用)
  const viewSources = [
    async () => fetchJson('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid),
    async () => {
      const r = await cf.viewVideo(bvid);
      if (!r || r.code !== 0 || !r.data) throw new Error((r && r.message) || '线上 view 无数据');
      return r;
    },
  ];

  for (const attempt of viewSources) {
    try {
      const v = await attempt();
      if (v) {
        videoTitle = v.title || videoTitle;
        pages = (v.pages || []).length;
        if (v.ugc_season && Array.isArray(v.ugc_season.sections)) {
          const eps = [];
          v.ugc_season.sections.forEach(s => (s.episodes || []).forEach(e => eps.push(e)));
          const nums = eps.map(e => firstNum(e.title, e.long_title)).filter(Boolean).map(Number);
          if (nums.length) return { total: String(Math.max(...nums)), source: 'B站合集「' + (v.ugc_season.title || '') + '」' };
          if (eps.length) return { total: String(eps.length), source: 'B站合集「' + (v.ugc_season.title || '') + '」' };
        }
        if (Array.isArray(v.pages) && v.pages.length > 1) {
          return { total: String(v.pages.length), source: 'B站分P' };
        }
        break; // view 成功但没有合集/分P → 走搜索兜底
      }
    } catch { /* 换下一个 view 通道 */ }
  }

  // 搜索兜底:按条目标题搜最新投稿,标题含该名称的结果里取最大集数
  const keyword = String(fallbackTitle || '').trim();
  if (!keyword) throw new Error('view 接口被风控且没有标题可用');
  const d = await fetchJson('https://api.bilibili.com/x/web-interface/search/type?search_type=video&order=pubdate&keyword=' + encodeURIComponent(keyword));
  const result = (d && d.data && d.data.result) || [];
  const kw = keyword.replace(/\s+/g, '');
  let max = null;
  for (const v of result) {
    const t = String(v.title || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    if (!t.includes(kw)) continue;  // 只要标题确实包含系列名的
    const m = t.match(/第\s*(\d{1,4})\s*[集话]/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 3000 && (max == null || n > max)) max = n;
    }
  }
  if (max != null) return { total: String(max), source: 'bilibili 搜索' };
  return null;
}

// 其他站点:抓页面正则
async function fromHtml(link) {
  const html = await fetchText(link, link);
  const m = html.match(/更新至第?\s*(\d+)\s*[集话期]/)
    || html.match(/全\s*(\d+)\s*[集话期]/)
    || html.match(/共\s*(\d+)\s*[集话期]/)
    || html.match(/"total":\s*(\d+)/);
  return m ? { total: m[1], source: '网页解析' } : null;
}

// 入口:返回 { total, source } 或 null(无法识别)
async function fetchTotal(link, fallbackTitle) {
  if (!link) throw new Error('没有填写链接');
  let r = await fromBangumiPage(link);
  if (r) return r;
  const bv = link.match(/video\/(BV[0-9A-Za-z]+)/);
  if (bv) r = await totalFromVideo(bv[1], fallbackTitle);
  if (r) return r;
  if (/^https?:\/\//.test(link)) r = await fromHtml(link);
  return r;
}

module.exports = { fetchTotal };
