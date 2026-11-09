/* ============================================================
 * 摸鱼 · 每日资讯（m-brief）前端
 * ------------------------------------------------------------
 * 行情/新闻/一言: GET /api/daily（Cloudflare Pages Function,
 * sessionStorage 缓存 5 分钟, 点「刷新」绕过缓存）
 * GitHub 热门: GET /api/github-trending (边缘抓取 github.com/trending,
 * sessionStorage 缓存 30 分钟)
 * AI 点评: GET /api/daily/comment（Workers AI, 失败静默）
 * 天气: 浏览器定位 → ipwho.is 兜底 → 手动搜城市,
 *       Open-Meteo 直连(免 key, CORS), localStorage 缓存 30 分钟
 * 建议: 天气/行情规则建议(始终显示) + AI 点评(增强, 可选)
 * ============================================================ */
(function () {
  'use strict';

  var API_DAILY = '/api/daily';
  var API_COMMENT = '/api/daily/comment';
  var API_GITHUB = '/api/github-trending';
  var LS_CITY = 'mb-city';        // 手动选择的城市 {name, lat, lon}
  var LS_WEATHER = 'mb-weather';  // 天气缓存 {ts, city, cur, today}
  var SS_DAILY = 'mb-daily';      // /api/daily 缓存 {ts, data}
  var SS_GH = 'mb-github';        // /api/github-trending 缓存 {ts, data}
  var LS_COLLAPSED = 'mb-collapsed'; // 每日资讯收起偏好
  var OZ = 31.1035;
  var UP = 'up', DOWN = 'down';

  var state = { daily: null, weather: null, aiTried: false, aiPending: false, dailyFail: false, wxFail: false };

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(key, store) {
    try { var s = store.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function writeJSON(key, val, store) {
    try { store.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function fetchJSON(url, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).finally(function () { if (timer) clearTimeout(timer); });
  }
  function pctStr(v) { return (v > 0 ? '+' : '') + (+v).toFixed(2) + '%'; }
  function pctCls(v) { return v > 0 ? UP : v < 0 ? DOWN : 'flat'; }
  function loadingHtml(text) {
    return '<div class="mb-loading"><i class="fas fa-spinner fa-spin"></i> ' + esc(text || '加载中…') + '</div>';
  }
  function errHtml(text) {
    return '<div class="mb-err"><i class="fas fa-circle-exclamation"></i> ' + esc(text) + '</div>';
  }
  function setUpdated() {
    var el = $('mb-updated');
    if (!el) return;
    var d = state.daily;
    if (d && d.ts) {
      var t = new Date(d.ts);
      var hh = ('0' + t.getHours()).slice(-2), mm = ('0' + t.getMinutes()).slice(-2);
      el.textContent = '行情/新闻更新于 ' + hh + ':' + mm;
    }
  }

  /* ---------- 日期头 ---------- */
  function renderDate() {
    var el = $('mb-date');
    if (!el) return;
    var d = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    el.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
  }

  /* ---------- /api/daily ---------- */
  function loadDaily(force) {
    if (!force) {
      var c = readJSON(SS_DAILY, sessionStorage);
      if (c && c.data && Date.now() - c.ts < 5 * 60000) {
        state.daily = c.data;
        renderDaily();
        return;
      }
    }
    fetchJSON(API_DAILY + (force ? '?t=' + Date.now() : ''), 12000).then(function (d) {
      state.daily = d;
      state.dailyFail = false;
      writeJSON(SS_DAILY, { ts: Date.now(), data: d }, sessionStorage);
      renderDaily();
    }).catch(function () {
      state.dailyFail = true;
      var m = $('mb-market'), cn = $('mb-news-cn'), wd = $('mb-news-world');
      if (m) m.innerHTML = errHtml('行情暂时不可用，点右上角刷新试试');
      if (cn) cn.innerHTML = errHtml('新闻暂时不可用');
      if (wd) wd.innerHTML = errHtml('新闻暂时不可用');
      renderAdvice();
      renderMini();
    });
  }

  function marketItem(name, val, sub, pct) {
    var cls = pct != null ? ' ' + pctCls(pct) : '';
    var subHtml;
    if (pct != null) {
      subHtml = (sub ? '<i>' + esc(sub) + '</i> ' : '') + '<b>' + pctStr(pct) + '</b>';
    } else {
      subHtml = sub ? esc(sub) : '&nbsp;';
    }
    return '<div class="mb-mi' + cls + '">'
      + '<span class="mb-mi-name">' + esc(name) + '</span>'
      + '<span class="mb-mi-val">' + esc(val) + '</span>'
      + '<span class="mb-mi-sub">' + subHtml + '</span>'
      + '</div>';
  }

  function renderMarket() {
    var host = $('mb-market');
    if (!host) return;
    var d = state.daily;
    if (!d || !(d.stocks || []).length && !d.gold) {
      host.innerHTML = errHtml('行情暂时不可用');
      return;
    }
    var html = [];
    var g = d.gold;
    if (g) {
      if (g.au) html.push(marketItem(g.au.name || '沪金99', g.au.price.toFixed(2), '元/克', g.au.pct));
      if (g.xau) {
        html.push(marketItem(g.xau.name || '伦敦金现', g.xau.usd.toFixed(2),
          g.xau.cnyPerGram != null ? '≈ ¥' + g.xau.cnyPerGram + '/克' : '美元/盎司', null));
      }
    }
    (d.stocks || []).forEach(function (s) {
      html.push(marketItem(s.name, s.price.toFixed(2), '', s.pct));
    });
    host.innerHTML = html.length ? html.join('') : errHtml('行情暂时不可用');
  }

  function newsItem(n) {
    var meta = [n.source, n.time].filter(Boolean).join(' · ');
    return '<a class="mb-n" href="' + esc(n.link) + '" target="_blank" rel="noopener nofollow">'
      + '<span class="mb-n-t">' + esc(n.title) + '</span>'
      + (meta ? '<span class="mb-n-m">' + esc(meta) + '</span>' : '')
      + '</a>';
  }

  function renderNews() {
    var d = state.daily;
    var cn = $('mb-news-cn'), wd = $('mb-news-world');
    if (!cn || !wd) return;
    var cnList = (d && d.news && d.news.cn) || [];
    var wdList = (d && d.news && d.news.world) || [];
    cn.innerHTML = cnList.length
      ? cnList.map(newsItem).join('')
      : errHtml('国内新闻暂时不可用');
    wd.innerHTML = wdList.length
      ? wdList.map(newsItem).join('')
      : errHtml('国际新闻暂时不可用');
  }

  function renderQuote() {
    var host = $('mb-quote');
    if (!host) return;
    var q = state.daily && state.daily.quote;
    if (!q || !q.text) { host.innerHTML = ''; return; }
    var from = q.who || '';
    if (from && q.from) from += '《' + q.from + '》';
    else if (q.from) from = '《' + q.from + '》';
    host.innerHTML = '「' + esc(q.text) + '」' + (from ? '<span class="mb-quote-f">—— ' + esc(from) + '</span>' : '');
  }

  function renderDaily() {
    renderMarket();
    renderNews();
    renderQuote();
    renderAdvice();
    renderMini();
    setUpdated();
    loadComment();
  }

  /* ---------- 天气 ---------- */
  var WMO_RANGES = [
    [[0, 0], '晴', '☀️'], [[1, 1], '大致晴', '🌤️'], [[2, 2], '多云', '⛅'], [[3, 3], '阴', '☁️'],
    [[45, 48], '雾', '🌫️'],
    [[51, 55], '毛毛雨', '🌦️'], [[56, 57], '冻毛毛雨', '🌧️'],
    [[61, 62], '小雨', '🌧️'], [[63, 65], '中到大雨', '🌧️'], [[66, 67], '冻雨', '🌧️'],
    [[71, 75], '雪', '🌨️'], [[77, 77], '雪粒', '🌨️'],
    [[80, 81], '阵雨', '🌦️'], [[82, 82], '强阵雨', '⛈️'], [[85, 86], '阵雪', '🌨️'],
    [[95, 95], '雷阵雨', '⛈️'], [[96, 99], '雷阵雨伴冰雹', '⛈️'],
  ];
  function wmoInfo(code) {
    for (var i = 0; i < WMO_RANGES.length; i++) {
      var r = WMO_RANGES[i][0];
      if (code >= r[0] && code <= r[1]) return { text: WMO_RANGES[i][1], emoji: WMO_RANGES[i][2] };
    }
    return { text: '——', emoji: '🌡️' };
  }

  function locateBrowser() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('no geolocation'));
      // 权限弹窗未决时 getCurrentPosition 的 timeout 不生效, 自己加一层竞速
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; reject(new Error('geolocation slow')); }
      }, 7000);
      navigator.geolocation.getCurrentPosition(
        function (p) {
          if (!settled) { settled = true; clearTimeout(timer); resolve({ lat: p.coords.latitude, lon: p.coords.longitude, precise: true }); }
        },
        function (err) {
          if (!settled) { settled = true; clearTimeout(timer); reject(err); }
        },
        { timeout: 6000, maximumAge: 600000 }
      );
    });
  }

  function locateIp() {
    // 多源兜底: ipwho.is 挂/限流时走 geojs
    return fetchJSON('https://ipwho.is/?lang=zh', 7000).then(function (j) {
      if (!j || j.success === false || !isFinite(j.latitude)) throw new Error('ipwho fail');
      return { lat: j.latitude, lon: j.longitude, city: j.city || '', precise: false };
    }).catch(function () {
      return fetchJSON('https://get.geojs.io/v1/ip/geo.json', 7000).then(function (j) {
        var lat = parseFloat(j && j.latitude), lon = parseFloat(j && j.longitude);
        if (!isFinite(lat) || !isFinite(lon)) throw new Error('geojs fail');
        return { lat: lat, lon: lon, city: (j.city && j.city !== 'null' ? j.city : '') || '', precise: false };
      });
    });
  }

  function reverseGeocode(lat, lon) {
    return fetchJSON('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon +
      '&format=jsonv2&accept-language=zh&zoom=10', 6000).then(function (j) {
        var a = (j && j.address) || {};
        var city = a.city || a.town || a.county || a.village || a.state || '';
        if (!city) throw new Error('no city');
        return city;
      });
  }

  function resolveLocation() {
    var saved = readJSON(LS_CITY, localStorage);
    if (saved && isFinite(saved.lat) && isFinite(saved.lon)) {
      return Promise.resolve({ lat: saved.lat, lon: saved.lon, city: saved.name, manual: true });
    }
    return locateBrowser().catch(function () { return locateIp(); });
  }

  function fetchWeather(loc) {
    var base = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
      '&timezone=auto&forecast_days=2';
    var nameStep;
    if (loc.city) nameStep = Promise.resolve(loc.city);
    else nameStep = reverseGeocode(loc.lat, loc.lon).catch(function () {
      return locateIp().then(function (ip) { return ip.city || ''; }).catch(function () { return ''; });
    });
    return nameStep.then(function (city) {
      return fetchJSON(base, 9000).then(function (j) {
        if (!j || !j.current) throw new Error('weather failed');
        var cur = j.current, day = (j.daily || {});
        return {
          ts: Date.now(),
          city: city || (loc.manual ? loc.city : '当前位置'),
          cur: {
            t: cur.temperature_2m, feels: cur.apparent_temperature,
            code: cur.weather_code, hum: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
          },
          today: {
            code: day.weather_code && day.weather_code[0],
            max: day.temperature_2m_max && day.temperature_2m_max[0],
            min: day.temperature_2m_min && day.temperature_2m_min[0],
            pp: day.precipitation_probability_max && day.precipitation_probability_max[0],
            uv: day.uv_index_max && day.uv_index_max[0],
          },
        };
      });
    });
  }

  function loadWeather(force) {
    var host = $('mb-weather');
    if (!host) return;
    if (!force) {
      var c = readJSON(LS_WEATHER, localStorage);
      if (c && c.cur && Date.now() - c.ts < 30 * 60000) {
        state.weather = c;
        renderWeather();
        return;
      }
    }
    host.innerHTML = loadingHtml('正在定位…');
    resolveLocation().then(fetchWeather).then(function (w) {
      state.weather = w;
      state.wxFail = false;
      writeJSON(LS_WEATHER, w, localStorage);
      renderWeather();
    }).catch(function () {
      state.wxFail = true;
      host.innerHTML = '<div class="mb-err"><i class="fas fa-circle-exclamation"></i> 天气获取失败，可尝试搜索城市 <button type="button" class="mb-link-btn" id="mb-w-retry">重新定位</button></div>';
      var btn = $('mb-w-retry');
      if (btn) btn.addEventListener('click', function () { loadWeather(true); });
      renderMini();
    });
  }

  function renderWeather() {
    var host = $('mb-weather');
    if (!host) return;
    var w = state.weather;
    if (!w || !w.cur) { host.innerHTML = errHtml('天气暂不可用'); return; }
    var info = wmoInfo(w.cur.code);
    var t = w.cur.t;
    var cityName = w.city || '当前位置';
    var meta = [];
    if (w.today && w.today.max != null && w.today.min != null) {
      meta.push('今日 <b>' + Math.round(w.today.min) + '~' + Math.round(w.today.max) + '°C</b>');
    }
    if (w.today && w.today.pp != null) meta.push('降水概率 <b>' + w.today.pp + '%</b>');
    if (w.cur.hum != null) meta.push('湿度 <b>' + Math.round(w.cur.hum) + '%</b>');
    if (w.cur.wind != null) meta.push('风速 <b>' + Math.round(w.cur.wind) + 'km/h</b>');
    if (w.cur.feels != null && Math.abs(w.cur.feels - t) >= 2) meta.push('体感 <b>' + Math.round(w.cur.feels) + '°C</b>');

    host.innerHTML =
      '<div class="mb-w-row">'
      + '<span class="mb-w-icon" aria-hidden="true">' + info.emoji + '</span>'
      + '<div class="mb-w-main">'
      + '<div class="mb-w-city"><i class="fas fa-location-dot" aria-hidden="true"></i> ' + esc(cityName)
      + '<button type="button" class="mb-link-btn" id="mb-w-change">换城市</button></div>'
      + '<div class="mb-w-desc">' + esc(info.text) + ' · ' + esc(wmoInfo(w.today ? w.today.code : w.cur.code).text) + '</div>'
      + '</div>'
      + '<div class="mb-w-temp">' + (isFinite(t) ? Math.round(t) : '——') + '<small>°C</small></div>'
      + '<div class="mb-w-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>'
      + '</div>'
      + '<div class="mb-w-search" id="mb-w-search">'
      + '<input type="text" id="mb-w-input" placeholder="输入城市名，如：杭州 / Tokyo" maxlength="40" />'
      + '<div class="mb-w-sug" id="mb-w-sug" hidden></div>'
      + '</div>';

    var btn = $('mb-w-change');
    if (btn) btn.addEventListener('click', toggleCitySearch);
    renderMini();
  }

  function toggleCitySearch() {
    var box = $('mb-w-search');
    if (!box) return;
    var open = box.classList.toggle('open');
    if (!open) return;
    var input = $('mb-w-input'), sug = $('mb-w-sug');
    if (!input) return;
    input.focus();
    if (input.dataset.bound) return;
    input.dataset.bound = '1';
    var timer = null;
    input.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 1) { sug.hidden = true; return; }
      timer = setTimeout(function () {
        fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) +
          '&count=6&language=zh&format=json', 7000).then(function (j) {
            var list = (j && j.results) || [];
            if (!list.length) { sug.hidden = true; return; }
            sug.innerHTML = list.map(function (r, i) {
              var label = r.name + (r.admin1 && r.admin1 !== r.name ? ' · ' + r.admin1 : '') + (r.country ? ' · ' + r.country : '');
              return '<button type="button" data-i="' + i + '">' + esc(label) + '</button>';
            }).join('');
            sug.hidden = false;
            sug.querySelectorAll('button').forEach(function (b) {
              b.addEventListener('click', function () {
                var r = list[+b.dataset.i];
                if (!r) return;
                writeJSON(LS_CITY, { name: r.name, lat: r.latitude, lon: r.longitude }, localStorage);
                sug.hidden = true;
                box.classList.remove('open');
                loadWeather(true);
              });
            });
          }).catch(function () { sug.hidden = true; });
      }, 350);
    });
  }

  /* ---------- GitHub 今日热门 ---------- */
  var GH_LANG_COLORS = {
    Python: '#3572A5', TypeScript: '#3178c6', JavaScript: '#f1e05a',
    Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d', C: '#555555',
    Java: '#b07219', 'C#': '#178600', Shell: '#89e051', HTML: '#e34c26',
    CSS: '#563d7c', Vue: '#41b883', Dart: '#00B4AB', Kotlin: '#A97BFF',
    Swift: '#F05138', Ruby: '#701516', PHP: '#4F5D95', Zig: '#ec915c',
    'Jupyter Notebook': '#DA5B0B',
  };

  function ghLangDot(lang) {
    return '<i class="mb-gh-dot" style="background:' + (GH_LANG_COLORS[lang] || '#8f8e9a') + '"></i>';
  }

  function trendingItem(it, i) {
    var desc = it.description || '';
    if (desc.length > 76) desc = desc.slice(0, 74) + '…';
    return '<a class="mb-gh-item" href="' + esc(it.url) + '" target="_blank" rel="noopener nofollow">'
      + '<span class="mb-gh-rank" aria-hidden="true">' + (i + 1) + '</span>'
      + '<span class="mb-gh-main">'
      + '<span class="mb-gh-name">' + esc(it.repo) + '</span>'
      + (desc ? '<span class="mb-gh-desc">' + esc(desc) + '</span>' : '')
      + '<span class="mb-gh-meta">'
      + (it.language ? '<span class="mb-gh-lang">' + ghLangDot(it.language) + esc(it.language) + '</span>' : '')
      + '<span class="mb-gh-stars"><i class="far fa-star" aria-hidden="true"></i>' + esc(it.stars || '—') + '</span>'
      + (it.starsToday ? '<span class="mb-gh-today">今日 +' + esc(it.starsToday) + '</span>' : '')
      + '</span></span></a>';
  }

  function renderTrending(d) {
    var host = $('mb-github');
    if (!host) return;
    hideGhTip();
    var list = (d && d.ok && d.repos) || [];
    if (!list.length) {
      host.innerHTML = errHtml('GitHub 趋势暂时不可用，稍后再试');
      return;
    }
    host.innerHTML = list.map(trendingItem).join('');
    // 悬停浮窗: 完整中文介绍 + 英文原文
    var items = host.querySelectorAll('.mb-gh-item');
    items.forEach(function (el, i) {
      var it = list[i];
      if (!it) return;
      el.addEventListener('mouseenter', function () { showGhTip(el, it); });
      el.addEventListener('mouseleave', hideGhTip);
      el.addEventListener('focus', function () { showGhTip(el, it); });
      el.addEventListener('blur', hideGhTip);
    });
  }

  /* ---------- GitHub 悬停浮窗 ----------
   * 挂在 body 上用 fixed 定位: .m-brief-body-inner 有 overflow:hidden(收起动画用),
   * 页面内绝对定位会被裁剪; fixed 相对视口并做边界钳制, 滚动时隐藏。 */
  var ghTip = null;
  function hideGhTip() {
    if (ghTip) ghTip.hidden = true;
  }
  function showGhTip(anchor, it) {
    if (!ghTip) {
      ghTip = document.createElement('div');
      ghTip.className = 'mb-gh-tip';
      ghTip.setAttribute('role', 'tooltip');
      document.body.appendChild(ghTip);
    }
    var meta = [it.language, it.stars ? '⭐ ' + it.stars : '', it.starsToday ? '今日 +' + it.starsToday : '']
      .filter(Boolean).join(' · ');
    ghTip.innerHTML = '<b class="mb-gh-tip-name">' + esc(it.repo) + '</b>'
      + (it.description ? '<span class="mb-gh-tip-zh">' + esc(it.description) + '</span>' : '')
      + (it.descriptionEn && it.descriptionEn !== it.description
        ? '<span class="mb-gh-tip-en">' + esc(it.descriptionEn) + '</span>' : '')
      + (meta ? '<span class="mb-gh-tip-meta">' + esc(meta) + '</span>' : '');
    ghTip.hidden = false;
    var r = anchor.getBoundingClientRect();
    var tw = ghTip.offsetWidth, th = ghTip.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - tw - 8);
    var top = r.bottom + 8;
    if (top + th > window.innerHeight - 8) top = Math.max(8, r.top - th - 8);
    ghTip.style.left = left + 'px';
    ghTip.style.top = top + 'px';
  }

  function loadTrending(force) {
    if (!force) {
      var c = readJSON(SS_GH, sessionStorage);
      if (c && c.data && Date.now() - c.ts < 30 * 60000) {
        renderTrending(c.data);
        return;
      }
    }
    var host = $('mb-github');
    if (host) host.innerHTML = loadingHtml('加载中…');
    fetchJSON(API_GITHUB + (force ? '?t=' + Date.now() : ''), 12000).then(function (d) {
      writeJSON(SS_GH, { ts: Date.now(), data: d }, sessionStorage);
      renderTrending(d);
    }).catch(function () {
      renderTrending(null);
    });
  }

  /* ---------- 收起态迷你摘要 + 折叠 ---------- */
  function miniChip(name, val, sub, pct) {
    return '<span class="mb-chip">' + esc(name)
      + (val != null ? ' <b>' + esc(val) + '</b>' : '')
      + (sub ? ' <span class="mb-mini-dim">' + esc(sub) + '</span>' : '')
      + (pct != null ? ' <b class="' + pctCls(pct) + '">' + pctStr(pct) + '</b>' : '')
      + '</span>';
  }

  function renderMini() {
    var wEl = $('mb-mini-weather'), mEl = $('mb-mini-market');
    if (!wEl || !mEl) return;
    var w = state.weather;
    if (w && w.cur) {
      var info = wmoInfo(w.cur.code);
      var t = isFinite(w.cur.t) ? Math.round(w.cur.t) + '°C' : '——';
      var range = (w.today && w.today.min != null && w.today.max != null)
        ? '<span class="mb-mini-dim">' + Math.round(w.today.min) + '~' + Math.round(w.today.max) + '°C</span>' : '';
      wEl.innerHTML = '<span class="mb-mini-emoji" aria-hidden="true">' + info.emoji + '</span>'
        + '<b>' + esc(w.city || '当前位置') + '</b>'
        + '<span>' + esc(info.text) + ' ' + t + '</span>' + range;
    } else {
      wEl.innerHTML = '<span class="mb-mini-dim">'
        + (state.wxFail ? '天气暂未获取，展开后可搜索城市' : '天气加载中…') + '</span>';
    }
    var d = state.daily, chips = [];
    if (d) {
      var g = d.gold;
      if (g && g.au) chips.push(miniChip('沪金99', g.au.price.toFixed(2), '元/克', g.au.pct));
      if (g && g.xau) chips.push(miniChip('伦敦金', g.xau.usd.toFixed(2), '$/盎司', null));
      var picks = ['s_sh000001', 's_sz399001', 'hkHSI', 'int_dji'];
      (d.stocks || []).forEach(function (s) {
        if (picks.indexOf(s.key) >= 0) chips.push(miniChip(s.name, s.price.toFixed(2), null, s.pct));
      });
    }
    mEl.innerHTML = chips.length
      ? chips.join('')
      : '<span class="mb-mini-dim">' + (state.dailyFail ? '行情暂不可用，可点展开后刷新' : '行情加载中…') + '</span>';
  }

  function setCollapsed(collapsed, save) {
    var el = $('moyu-brief');
    if (!el) return;
    el.classList.toggle('collapsed', !!collapsed);
    var t = $('mb-toggle');
    if (t) {
      t.setAttribute('aria-expanded', String(!collapsed));
      t.title = collapsed ? '展开每日资讯' : '收起每日资讯';
      t.setAttribute('aria-label', t.title);
    }
    if (save) writeJSON(LS_COLLAPSED, !!collapsed, localStorage);
    // 展开时若 AI 点评还没加载过, 再去请求
    if (!collapsed && state.aiPending) {
      state.aiPending = false;
      loadComment();
    }
  }

  /* ---------- 今日解读（规则建议 + AI 增强） ---------- */
  function weatherAdvice() {
    var w = state.weather;
    if (!w || !w.cur) return [];
    var t = w.cur.t, code = w.cur.code;
    var cloth;
    if (!isFinite(t)) cloth = null;
    else if (t <= 0) cloth = '冰点以下，防寒保暖是第一位';
    else if (t <= 10) cloth = '天气较冷，建议厚外套或羽绒服';
    else if (t <= 16) cloth = '偏凉，薄外套或夹层比较合适';
    else if (t <= 22) cloth = '体感舒适，长袖即可';
    else if (t <= 28) cloth = '温暖，短袖薄衫就行';
    else cloth = '天气炎热，注意防暑多喝水';
    var rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    var snowy = (code >= 71 && code <= 77) || code === 85 || code === 86;
    var tips = [];
    if (cloth) tips.push(cloth);
    if (rainy) tips.push('有雨，出门记得带伞');
    if (snowy) tips.push('有雪，路面湿滑注意脚下');
    var uv = w.today && w.today.uv;
    if (isFinite(uv) && uv >= 6) tips.push('紫外线较强，防晒别偷懒');
    if (isFinite(w.cur.wind) && w.cur.wind >= 30) tips.push('风比较大，骑车/高空坠物留个心眼');

    var head = [];
    if (w.city) head.push(w.city);
    var info = wmoInfo(w.cur.code);
    if (info.text !== '——') head.push(info.text);
    if (isFinite(t)) head.push(Math.round(t) + '°C');
    if (w.today && w.today.min != null && w.today.max != null) {
      head.push('今日 ' + Math.round(w.today.min) + '~' + Math.round(w.today.max) + '°C');
    }
    if (w.today && w.today.pp != null && w.today.pp >= 40) head.push('降水概率 ' + w.today.pp + '%');
    return tips.length
      ? ['<b>【天气】</b>' + esc(head.join(' · ')) + '——' + esc(tips.join('，')) + '。']
      : [];
  }

  function marketAdvice() {
    var d = state.daily;
    if (!d) return [];
    var list = [];
    var g = d.gold;
    if (g && (g.au || g.xau)) {
      var bits = [];
      var tip = '有购金打算的话，按计划分批更稳妥。';
      if (g.au) {
        bits.push('沪金99 ' + g.au.price.toFixed(2) + ' 元/克（' + pctStr(g.au.pct) + '）');
        if (Math.abs(g.au.pct) >= 1.5) tip = '单日波动不小，买金饰/积存可以再观望或分批。';
      }
      if (g.xau) bits.push('伦敦金现 ' + g.xau.usd.toFixed(2) + ' 美元/盎司' + (g.xau.cnyPerGram != null ? '（约 ' + g.xau.cnyPerGram + ' 元/克）' : ''));
      list.push('<b>【贵金属】</b>' + esc(bits.join('；')) + '。' + esc(tip));
    }
    var st = d.stocks || [];
    var cn = [], hk = null, us = [];
    st.forEach(function (s) {
      if (/^s_/.test(s.key)) cn.push(s);
      else if (s.key === 'hkHSI') hk = s;
      else if (/^int_/.test(s.key)) us.push(s);
    });
    var bits2 = [];
    if (cn.length) {
      var upN = cn.filter(function (s) { return s.pct > 0; }).length;
      var tone = upN === 0 ? '集体收跌' : upN === cn.length ? '集体上涨' : '涨跌互现';
      bits2.push('A股' + tone + '（' + cn.map(function (s) { return s.name + ' ' + pctStr(s.pct); }).join('、') + '）');
    }
    if (hk) bits2.push('恒生指数 ' + pctStr(hk.pct));
    if (us.length) bits2.push('美股隔夜 ' + us.map(function (s) { return s.name + ' ' + pctStr(s.pct); }).join('、'));
    if (bits2.length) {
      var bigMove = st.some(function (s) { return Math.abs(s.pct) >= 2; });
      list.push('<b>【股市】</b>' + esc(bits2.join('；')) + '。' + esc(bigMove
        ? '波动明显放大，控制仓位、别追涨杀跌，留足现金比预测涨跌更实际。'
        : '正常波动区间，按自己的节奏来，别被盘中情绪带节奏。'));
    }
    return list;
  }

  function renderAdvice() {
    var host = $('mb-advice');
    if (!host) return;
    var items = weatherAdvice().concat(marketAdvice());
    if (!items.length) {
      host.innerHTML = '<li class="mb-advice-empty">数据还在路上，稍等片刻或点右上角刷新。</li>';
      return;
    }
    host.innerHTML = items.map(function (x) { return '<li>' + x + '</li>'; }).join('');
  }

  function loadComment() {
    if (state.aiTried) return;
    // 收起状态下先不请求, 展开时再加载
    var brief = $('moyu-brief');
    if (brief && brief.classList.contains('collapsed')) {
      state.aiPending = true;
      return;
    }
    state.aiTried = true;
    var box = $('mb-ai');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<div class="mb-ai-tag"><i class="fas fa-wand-magic-sparkles"></i> AI 结合今日新闻解读</div>'
      + loadingHtml('正在阅读今天的行情与新闻…');
    fetchJSON(API_COMMENT, 30000).then(function (j) {
      if (j && j.comment) {
        box.innerHTML = '<div class="mb-ai-tag"><i class="fas fa-wand-magic-sparkles"></i> AI 结合今日新闻解读</div>'
          + j.comment.split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
      } else {
        box.hidden = true; // 无 AI 时静默退回规则建议
      }
    }).catch(function () { box.hidden = true; });
  }

  /* ---------- 刷新 ---------- */
  function refreshAll() {
    var btn = $('mb-refresh');
    if (btn) {
      btn.classList.add('spinning');
      setTimeout(function () { btn.classList.remove('spinning'); }, 1200);
    }
    try { sessionStorage.removeItem(SS_DAILY); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(SS_GH); } catch (e) { /* ignore */ }
    state.aiTried = false;
    loadDaily(true);
    loadWeather(true);
    loadTrending(true);
  }

  /* ---------- 入口 ---------- */
  function init() {
    if (!$('moyu-brief')) return;
    renderDate();
    var btn = $('mb-refresh');
    if (btn) btn.addEventListener('click', refreshAll);
    var toggle = $('mb-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      var el = $('moyu-brief');
      setCollapsed(!(el && el.classList.contains('collapsed')), true);
    });
    // 浮窗是 fixed 定位, 页面滚动时位置会失效, 直接隐藏
    window.addEventListener('scroll', hideGhTip, { passive: true });
    // 恢复上次收起偏好
    setCollapsed(readJSON(LS_COLLAPSED, localStorage) === true, false);
    loadDaily(false);
    loadWeather(false);
    loadTrending(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
