'use strict';
// 追番「更新至」集数自动同步
// 番剧(ss/ep)与普通视频(BV)走 B 站 API;动态漫多为 UP 主合集,从 ugc_season 取全部分集取最大集数;
// 其他站点退化为抓取网页 HTML 正则匹配「更新至第 N 集 / 全 N 集」。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT = 12000;
const cf = require('./cf');
const settings = require('./settings');
const { execFile } = require('child_process');

// B站会对无 cookie 的请求返回 412 风控:先访问首页拿 buvid,之后所有请求带上
let jar = '';
let jarAt = 0;

async function ensureCookies() {
  // 用户在设置里粘贴的 B站 登录 Cookie 优先(不会被风控)
  try {
    const s = await settings.load();
    if (s.biliCookie) {
      if (jar !== s.biliCookie) { jar = s.biliCookie; jarAt = Date.now(); }
      return;
    }
  } catch { /* 设置读取失败则用自动 cookie */ }
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

async function fetchTextOnce(url, referer) {
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

// B站风控是按请求随机拦截的:412/非JSON 时换 UA 指纹重试最多 3 次
// Node 的 TLS 指纹会被B站风控识别(412/风控页),本机 curl.exe 不会:优先走 curl
function curlFetch(url, referer, withCookie) {
  return new Promise((resolve, reject) => {
    const args = ['-s', '-L', '--max-time', String(TIMEOUT / 1000), '-A', UA,
      '-H', 'Referer: ' + (referer || 'https://www.bilibili.com/'),
      '-H', 'Accept-Language: zh-CN,zh;q=0.9'];
    if (withCookie && jar) args.push('-H', 'Cookie: ' + jar);
    args.push(url);
    execFile('curl', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true, timeout: TIMEOUT + 3000 },
      (err, stdout) => {
        if (!stdout) return reject(err || new Error('curl 无输出'));
        resolve(stdout);
      });
  });
}

async function fetchText(url, referer) {
  await ensureCookies();
  let lastErr;
  const attempts = [
    () => curlFetch(url, referer, true),   // curl + cookie
    () => curlFetch(url, referer, false),  // curl 无 cookie
    () => fetchTextOnce(url, referer),     // Node fetch 兜底
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const text = await attempts[i]();
      if (/<!DOCTYPE html/i.test(text.slice(0, 60))) throw new Error('命中风控页');
      return text;
    } catch (e) {
      lastErr = e;
      if (String(e.message).indexOf('abort') !== -1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr || new Error('请求失败');
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

// 从一批标题里解析最大集数:强信号「第N集」,弱信号退化到首个数字(官方UP的
// 分集标题通常带系列名,而搜索兜底里无系列名的标题不可靠,故本函数用于可信来源)
// 含「预告」的标题不算正片集数(如「第N集预告」视频)
function maxEpFromTitles(titles) {
  let strongMax = null, weakMax = null;
  for (const t of titles || []) {
    const s = String(t || '');
    if (/预告/.test(s)) continue;
    const m = s.match(/第\s*(\d{1,4})\s*[集话]/);
    const n = Number(m ? m[1] : firstNum(s));
    if (!Number.isFinite(n) || n <= 0 || n >= 3000) continue;
    if (m) { if (strongMax == null || n > strongMax) strongMax = n; }
    else if (weakMax == null || n > weakMax) weakMax = n;
  }
  return String(strongMax != null ? strongMax : weakMax);
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
  // 「预告」分集不进统计:预告上线后仍留在分集列表里(badge=预告),凡人修仙传/牧神记
  // 都因此被顶高过一集,必须先过滤;new_ep 万一指向预告时同样不认
  const eps = r.episodes || [];
  const isPreview = e => /预告/.test(String(e && e.badge || '') + String(e && e.title || '') + String(e && e.long_title || ''));
  const previewIds = new Set(eps.filter(isPreview).map(e => e.id));
  const nums = eps.filter(e => !isPreview(e))
    .map(e => firstNum(e.title, e.long_title))
    .filter(Boolean).map(Number).filter(n => n > 0 && n < 3000);
  const official = r.new_ep && !previewIds.has(r.new_ep.id) ? (Number(firstNum(r.new_ep.title)) || 0) : 0;
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
        // 单集连载:link 指向最新一集,标题里直接带「第N集」
        const tm = videoTitle.match(/第\s*(\d{1,4})\s*[集话]/);
        if (tm) {
          const nt = Number(tm[1]);
          if (Number.isFinite(nt) && nt > 0 && nt < 3000) {
            return { total: String(nt), source: 'BV标题解析' };
          }
        }
        break; // view 成功但没有合集/分P/分集标题 → 走搜索兜底
      }
    } catch { /* 换下一个 view 通道 */ }
  }

  // 搜索兜底:按条目标题搜最新投稿取最大集数。
  // 只认「标题含系列名 + 带第N集标记」的强信号,宁可漏更新也不写入错误集数
  const keyword = String(fallbackTitle || '').trim();
  if (!keyword) return null;
  let result = [];
  try {
    const d = await fetchJson('https://api.bilibili.com/x/web-interface/search/type?search_type=video&order=pubdate&keyword=' + encodeURIComponent(keyword));
    result = (d && d.data && d.data.result) || [];
  } catch { return null; }
  const kw = keyword.replace(/\s+/g, '');
  let max = null;
  for (const v of result) {
    const t = String(v.title || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    const hasKw = t.includes(kw);
    if (!hasKw) continue;  // 标题必须包含系列名,防止噪声标题里的数字被误判
    if (/预告/.test(t)) continue;  // 「第N集预告」投稿不算正片集数
    const m = t.match(/第\s*(\d{1,4})\s*[集话]/);
    if (!m) continue;  // 只看带「第N集」标记的
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0 || n >= 3000) continue;
    if (max == null || n > max) max = n;
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

// UP主空间链接(sync_url):按发布时间取该 UP 最新投稿,从标题解析最新集数
async function totalFromSpace(syncUrl) {
  const m = String(syncUrl || '').match(/space\.bilibili\.com\/(\d+)/);
  if (!m) return null;
  const mid = m[1];
  // 通道一:动态 feed。空间归档接口(recArchivesByKeywords / arc/search)风控极严,
  // 登录 Cookie 也常返回 -400/-799;feed 接口带登录 Cookie 基本可用。
  // 动态按发布时间倒序,视频动态的标题即最新分集;取前几页视频动态标题里的最大集数
  try {
    const allTitles = [];
    let offset = null;
    for (let page = 0; page < 3; page++) {
      const url = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=' + mid
        + (offset ? '&offset_dynamic=' + encodeURIComponent(offset) : '');
      const d = await fetchJson(url, 'https://space.bilibili.com/' + mid);
      if (d.code !== 0 || !d.data) break;
      for (const it of (d.data.items || [])) {
        const ar = it.modules && it.modules.module_dynamic && it.modules.module_dynamic.major
          && it.modules.module_dynamic.major.archive;
        if (ar && ar.title) allTitles.push(ar.title);
      }
      const off = d.data.offset && d.data.offset.offset_dynamic;
      if (!off) break;
      offset = off;
    }
    const n = maxEpFromTitles(allTitles);
    if (n != null) return { total: n, source: 'UP主动态最新投稿' };
    if (allTitles.length) return null; // feed 正常但都是非视频动态
  } catch { /* feed 被风控时继续尝试空间归档接口 */ }
  // 通道二:空间归档接口(本机直连 → Cloudflare Worker 出口),保留作后备
  const sources = [
    async () => fetchJson('https://api.bilibili.com/x/series/recArchivesByKeywords?mid=' + mid + '&ps=30'),
    async () => {
      const r = await cf.spaceArchives(mid);
      if (!r || r.code !== 0 || !r.data) throw new Error((r && r.message) || '线上空间接口无数据');
      return r;
    },
  ];
  let lastErr;
  for (const attempt of sources) {
    try {
      const d = await attempt();
      if (d.code !== 0 || !d.data) throw new Error((d && d.message) || 'UP主空间数据为空');
      const archives = d.data.archives || [];
      if (!archives.length) return null;
      // 按发布时间倒序(接口默认),取最近投稿里能解析出的最大集数
      const n = maxEpFromTitles(archives.map(a => a.title || ''));
      if (n != null) return { total: String(n), source: 'UP主空间最新投稿' };
      return null;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('UP主空间接口不可用');
}

// 入口:返回 { total, source } 或 null(无法识别)
async function fetchTotal(link, fallbackTitle, syncUrl) {
  // 用户显式提供的同步源(UP主空间)优先级最高;失败则降级到 link 解析链,
  // 避免空间接口被风控时整条同步失败(空间接口风控最严,登录 Cookie 也常被拒)
  if (syncUrl && /space\.bilibili\.com/.test(syncUrl)) {
    try {
      const r = await totalFromSpace(syncUrl);
      if (r) return r;
    } catch { /* 空间接口被风控/无数据时继续尝试 link */ }
  }
  if (!link) throw new Error('没有填写链接');
  let r = await fromBangumiPage(link);
  if (r) return r;
  const bv = link.match(/video\/(BV[0-9A-Za-z]+)/);
  if (bv) r = await totalFromVideo(bv[1], fallbackTitle);
  if (r) return r;
  // 空间链接存在但上面没解析出集数时,再试一次网页兜底(用空间地址本身)
  if (syncUrl && /^https?:\/\//.test(syncUrl)) { try { r = await fromHtml(syncUrl); } catch {} }
  if (r) return r;
  if (/^https?:\/\//.test(link)) r = await fromHtml(link);
  return r;
}

  // ---------- UP主追踪(动态漫/沙雕动画等) ----------
  // B站:空间链接(或搜索链接) → 多通道取该 UP 的投稿列表:
  //   通道一 recArchivesByKeywords(带系列名关键词) → 通道二 同接口不带关键词(全部投稿)
  //   → 通道三 搜索接口(风控最松,按发布时间,再按 UP 过滤)
  // 未看数 = 用户填的「已看视频链接」在投稿列表(按时间倒序)中的位置
  // 「看到」可在条目未填时由已看视频自动推出(第N集标记,或投稿序号)
  // 抖音:风控较强,自动抓取大概率失败 → 降级为手动填写

  const douyinVideoId = url => {
    const s = String(url || '')
    let m = s.match(/video\/(\d{15,})/)
    if (m) return m[1]
    m = s.match(/modal_id=(\d{15,})/)
    if (m) return m[1]
    return null
  }

  async function fetchUpInfo(item) {
    const syncUrl = String(item.sync_url || '')
    const title = String(item.title || '').trim()

    // ---- 抖音:尽力抓一次创作者页,失败则明确降级 ----
    if (/douyin\.com/.test(syncUrl)) {
      let got = null
      try {
        const html = await fetchText(syncUrl, 'https://www.douyin.com/')
        const ids = [...html.matchAll(/"aweme_id":"(\d{15,})"/g)].map(x => x[1])
        const covers = [...html.matchAll(/"cover":\{[^}]*?"url_list":\["([^"]+)"/g)].map(x => x[1].replace(/\u002F/g, '/'))
        if (ids.length) {
          const desc = (html.match(/"desc":"([^"]{5,80})"/) || [])[1] || ''
          got = {
            total: null,
            source: '抖音创作者页',
            latest_title: desc ? desc.replace(/\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16))) : '最新视频',
            latest_cover: covers[0] || '',
            latest_url: ids[0] ? 'https://www.douyin.com/video/' + ids[0] : '',
            latest_pubdate: null,
          }
        }
      } catch { /* 降级 */ }
      if (!got) throw new Error('抖音风控较强,无法自动同步:请在条目里手动填写「更新至」与最新视频信息')
      return got
    }

    // ---- B站:空间链接(space.bilibili.com/<mid>)或搜索链接(?keyword=xxx) ----
    const midM = syncUrl.match(/space\.bilibili\.com\/(\d+)/)
    const mid = midM ? midM[1] : ''
    const kwM = syncUrl.match(/[?&]keyword=([^&]+)/)
    let searchKeyword = ''
    if (kwM) { try { searchKeyword = decodeURIComponent(kwM[1].replace(/\+/g, ' ')).trim() } catch {} }
    if (!mid && !searchKeyword) return null // 不认识的链接,交给通用解析链

    const watchedBvid = (String(item.watched_url || '').match(/video\/(BV[0-9A-Za-z]+)/) || [])[1] || ''

    // 空间投稿接口拉取(带重试,可翻页):返回 { archives, complete }
    let lastMsg = ''
    const fetchArchives = async (m, keywords) => {
      const all = []
      const PS = 50
      for (let pn = 1; pn <= 10; pn++) {
        let rows = null
        for (let attempt = 0; attempt < 2 && rows == null; attempt++) {
          try {
            const d = await fetchJson('https://api.bilibili.com/x/series/recArchivesByKeywords?mid=' + m +
              '&keywords=' + encodeURIComponent(keywords || '') + '&ps=' + PS + '&pn=' + pn, 'https://space.bilibili.com/' + m)
            if (d.code === 0 && d.data) rows = d.data.archives || []
            else lastMsg = (d && d.message) || 'UP主空间数据为空'
          } catch (e) { lastMsg = e.message }
          if (rows == null) await new Promise(r2 => setTimeout(r2, 1500))
        }
        if (rows == null) break // 重试仍失败 → 用已抓到的部分
        all.push(...rows)
        if (rows.length < PS) return { archives: all, complete: true }
      }
      return { archives: all, complete: false }
    }

    // 通道一:带系列名关键词(连载UP的合集精准匹配) → 通道二:不带关键词(全部投稿,翻页统计总数)
    let archives = []
    let complete = false
    if (mid) {
      for (const kw of [title, '']) {
        const got = await fetchArchives(mid, kw)
        if (!got.archives.length) continue
        const hasEp = got.archives.some(a => /第\s*\d{1,4}\s*[集话]/.test(String(a.title || '')))
        if (hasEp || got.complete || kw === '') {
          archives = got.archives
          complete = got.complete
          break
        }
        // 带关键词抓到但不完整又没分集编号 → 换全量通道
      }
    }
    // 通道三:搜索接口(按发布时间,抓两页;按 UP 过滤,防止关键词噪声混入)
    if (!archives.length) {
      const keyword = searchKeyword || title
      if (keyword) {
        for (let page = 1; page <= 2 && !archives.length; page++) {
          try {
            const d = await fetchJson('https://api.bilibili.com/x/web-interface/search/type?search_type=video&order=pubdate&keyword=' + encodeURIComponent(keyword) + '&page=' + page)
            let rows = ((d.data || {}).result || [])
              .filter(v => v.bvid)
              .map(v => ({ bvid: v.bvid, title: String(v.title || '').replace(/<[^>]+>/g, ''), pic: v.pic || '', pubdate: v.pubdate || 0, mid: String(v.mid || '') }))
            if (!mid && watchedBvid) {
              const mine = rows.find(v => v.bvid === watchedBvid)
              if (mine) rows = rows.filter(v => v.mid === mine.mid) // 用已看视频定位 UP,滤掉同关键词的其他UP
            }
            archives = rows.filter(v => !mid || v.mid === mid)
          } catch (e) { lastMsg = e.message }
          if (!archives.length) await new Promise(r2 => setTimeout(r2, 800))
        }
      }
    }
    if (!archives.length) throw new Error((lastMsg || '未找到该UP主的投稿') + '(可能被B站风控,稍后自动重试)')

    archives = archives.slice().sort((a, b) => (b.pubdate || 0) - (a.pubdate || 0))
    const newest = archives[0]

    // 总数:优先认「第N集/话」强标记(连载UP);没有编号的杂谈型UP用投稿总数
    let maxEp = null
    for (const a of archives) {
      const m2 = String(a.title || '').match(/第\s*(\d{1,4})\s*[集话]/)
      if (!m2) continue
      const n = Number(m2[1])
      if (Number.isFinite(n) && n > 0 && n < 3000 && (maxEp == null || n > maxEp)) maxEp = n
    }
    const count = archives.length
    const result = {
      total: maxEp != null ? String(maxEp) : (complete ? String(count) : null),
      source: 'UP主最新投稿',
      latest_title: String(newest.title || ''),
      latest_cover: String(newest.pic || '').replace(/^http:\/\//, 'https://'),
      latest_url: newest.bvid ? 'https://www.bilibili.com/video/' + newest.bvid : '',
      latest_pubdate: newest.pubdate || null,
    }
    if (result.total == null) throw new Error('该UP投稿超过500条且标题无「第N集」编号,无法统计总数')

    // 未看对比:已看视频在投稿列表(新→旧)中的位置 = 之后还有几支没看;
    // 「看到」自动填写:已看视频标题带第N集直接用;否则用投稿序号(第 count-wi 支)
    const wi = watchedBvid ? archives.findIndex(a => a.bvid === watchedBvid) : -1
    if (wi >= 0) {
      result.unwatched = wi
      const wm = String(archives[wi].title || '').match(/第\s*(\d{1,4})\s*[集话]/)
      if (wm) {
        const we = Number(wm[1])
        if (Number.isFinite(we) && we > 0 && we < 3000) result.episode = String(we)
      } else if (complete) {
        result.episode = String(count - wi)
      }
    }
    return result
  }

// 全量同步:遍历所有条目抓取「更新至」,有变化就写回线上(路由与定时器共用)
async function syncAll() {
  const list = await cf.listBangumi();
  const results = [];
  for (const item of (list.items || [])) {
    const row = { id: item.id, title: item.title, old: item.total || '', total: item.total || '', changed: false, source: '', error: '', unwatched: null };
    try {
      const isUp = /space\.bilibili\.com|search\.bilibili\.com|douyin\.com/.test(item.sync_url || '')
      const r = isUp
        ? await fetchUpInfo(item)
        : await fetchTotal(item.link || '', item.title || '', item.sync_url || '');
      if (r && r.total != null) {
        row.total = String(r.total);
        row.source = r.source;
        row.unwatched = r.unwatched != null ? r.unwatched : null;
        // 「看到」自动填写:仅当条目还没填且同步结果能推出时
        const epAuto = r.episode != null && !String(item.episode || '').trim();
        row.changed = String(r.total) !== String(item.total || '') || String(r.latest_url || '') !== String(item.latest_url || '') || epAuto;
        if (row.changed) {
          if (isUp) {
            // UP条目:整体保存(含自动推出的「看到」),再写最新视频信息
            await cf.bangumiAction({ action: 'item.save', id: item.id, title: item.title, author: item.author || '', image: item.image || '', link: item.link || '', intro: item.intro || '', episode: epAuto ? r.episode : (item.episode || ''), total: row.total, sync_url: item.sync_url || '', watched_url: item.watched_url || '', status: item.status || '在看', category_id: item.category_id, sort: item.sort || 0 });
          }
          const payload = { action: 'item.setTotal', id: item.id, total: row.total };
          if (r.latest_title !== undefined) {
            payload.latest_title = r.latest_title || ''
            payload.latest_cover = r.latest_cover || ''
            payload.latest_url = r.latest_url || ''
            payload.latest_pubdate = r.latest_pubdate || null
          }
          await cf.bangumiAction(payload);
        }
      } else {
        row.error = '无法从链接识别集数';
      }
    } catch (e) {
      const s = String((e && e.message) || e);
      row.error = /banned|412|风控/i.test(s)
        ? '被B站风控拦截:可在「设置」填写B站Cookie后重试,或稍后再试'
        : s;
    }
    results.push(row);
    await new Promise(r2 => setTimeout(r2, 400)); // 温和限速,避免触发B站风控
  }
  return { results };
}

module.exports = { fetchTotal, syncAll };
