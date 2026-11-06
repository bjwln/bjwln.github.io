/* ============================================================
 * 月下问运 · 页面主逻辑
 * 依赖顺序: lunar.min.js → tarot-data.js → fortune-data.js →
 *           bazi.js → llm.js → app.js
 * 生辰数据存 localStorage('fortune-profile-v1')，不上传服务器。
 * ============================================================ */
(function () {
  'use strict';
  var T = window.FortuneTarot, D = window.FortuneData, B = window.FortuneBazi, L = window.FortuneLLM;
  var LS_PROFILE = 'fortune-profile-v1';
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var STORE = { profile: null, draw: null, aiState: { ok: false, enabled: false, model: '' } };

  /* ============ 牌面 SVG（线稿风） ============ */
  var SUIT_GLYPH = {
    wands: '<path d="M20 78 C24 52 22 34 30 18 C33 24 36 22 34 34 C42 26 44 30 38 40 C46 38 46 44 36 50 C40 62 34 74 30 82" fill="none"/><path d="M30 82 L30 86" fill="none"/>',
    cups: '<path d="M22 28 L58 28 C58 48 48 58 40 60 L40 72 L50 78 L30 78 L40 72 L40 60 C32 58 22 48 22 28 Z" fill="none"/>',
    swords: '<path d="M40 14 L40 74 M40 26 L28 40 M40 26 L52 40 M30 74 L50 74" fill="none"/>',
    pentacles: '<circle cx="40" cy="48" r="18" fill="none"/><path d="M40 36 L43.5 45.5 L53 45.5 L45 51.5 L48 61 L40 55 L32 61 L35 51.5 L27 45.5 L36.5 45.5 Z" fill="none"/>'
  };
  /* 大牌简笔意象（22 幅，极简线稿） */
  var MAJOR_GLYPH = {
    maj0: '<circle cx="40" cy="26" r="8" fill="none"/><path d="M28 70 L40 38 L52 70 M14 58 L24 62 M64 52 L70 46" fill="none"/>',
    maj1: '<path d="M40 20 L40 70 M24 34 L56 34 M28 74 L52 74" fill="none"/><circle cx="40" cy="16" r="4" fill="none"/>',
    maj2: '<path d="M26 24 C38 34 42 54 40 72 M54 24 C46 38 44 54 40 72" fill="none"/><circle cx="40" cy="16" r="3" fill="none"/><path d="M20 72 L60 72" fill="none"/>',
    maj3: '<circle cx="40" cy="30" r="10" fill="none"/><path d="M40 40 L40 64 M40 50 L28 42 M40 50 L52 42 M40 64 L32 78 M40 64 L48 78" fill="none"/>',
    maj4: '<path d="M24 30 L24 70 L56 70 L56 30 Z M18 30 L62 30 M34 70 L34 58 L46 58 L46 70" fill="none"/>',
    maj5: '<path d="M40 20 L40 34 M30 40 C30 30 50 30 50 40 M26 44 L54 44 M28 44 L28 70 M52 44 L52 70 M28 70 L52 70 M34 44 L34 70 M46 44 L46 70" fill="none"/>',
    maj6: '<circle cx="30" cy="34" r="8" fill="none"/><circle cx="52" cy="38" r="8" fill="none"/><path d="M40 78 L40 52 M28 66 C22 54 26 46 40 52 M52 66 C58 54 54 46 40 52" fill="none"/>',
    maj7: '<rect x="24" y="34" width="32" height="26" rx="4" fill="none"/><path d="M24 44 L56 44 M32 34 L32 26 M48 34 L48 26 M40 60 L40 70 M20 78 L60 78" fill="none"/>',
    maj8: '<path d="M30 24 C20 36 20 60 40 70 C60 60 60 36 50 24 C46 34 34 34 30 24 Z" fill="none"/><path d="M34 42 C38 46 42 46 46 42" fill="none"/>',
    maj9: '<circle cx="40" cy="24" r="7" fill="none"/><path d="M34 34 L34 60 L46 60 L46 34 M34 60 L30 74 M46 60 L50 74 M16 30 L20 34 M64 30 L60 34" fill="none"/>',
    maj10: '<circle cx="40" cy="46" r="22" fill="none"/><circle cx="40" cy="46" r="4" fill="none"/><path d="M40 24 L40 68 M18 46 L62 46 M26 30 L54 62 M54 30 L26 62" fill="none"/>',
    maj11: '<path d="M40 20 L40 62 M26 28 C26 40 34 46 40 46 C46 46 54 40 54 28 M26 28 L40 46 M54 28 L40 46 M28 74 L52 74" fill="none"/>',
    maj12: '<path d="M40 66 L40 78 M40 66 C26 60 26 40 40 34 C54 40 54 60 40 66 Z M22 30 L30 34 M58 30 L50 34 M14 44 L20 44 M66 44 L60 44" fill="none"/>',
    maj13: '<path d="M40 22 L40 40 M20 40 L60 40 M26 48 L54 48 M30 56 L50 56 M36 64 L44 64" fill="none"/><path d="M24 24 C28 18 32 18 36 22 M56 24 C52 18 48 18 44 22" fill="none"/>',
    maj14: '<path d="M24 30 L56 30 M30 30 L30 52 C30 62 50 62 50 52 L50 30 M40 66 L40 74 M28 78 L52 78" fill="none"/><path d="M34 40 L46 40" fill="none"/>',
    maj15: '<path d="M40 22 C28 22 22 34 26 44 C18 52 22 66 32 70 C28 78 52 78 48 70 C58 66 62 52 54 44 C58 34 52 22 40 22 Z" fill="none"/><path d="M32 38 L34 38 M46 38 L48 38 M34 50 C38 54 42 54 46 50" fill="none"/>',
    maj16: '<path d="M26 74 L38 20 L50 44 L54 74 Z" fill="none"/><path d="M12 34 L20 38 M68 30 L62 36 M24 16 L28 22 M58 12 L56 20 M40 8 L40 14" fill="none"/>',
    maj17: '<path d="M40 34 L43 46 L55 46 L45 54 L48 66 L40 58 L32 66 L35 54 L25 46 L37 46 Z" fill="none"/><circle cx="22" cy="26" r="2.5" fill="none"/><circle cx="58" cy="24" r="2.5" fill="none"/>',
    maj18: '<path d="M28 40 C28 26 52 26 52 40 C52 52 44 58 40 58 C36 58 28 52 28 40 Z" fill="none"/><path d="M20 70 L34 64 M60 70 L46 64 M18 44 L14 48 M66 40 L70 44" fill="none"/>',
    maj19: '<circle cx="40" cy="30" r="12" fill="none"/><path d="M40 12 L40 6 M58 30 L64 30 M40 48 L40 54 M22 30 L16 30 M53 17 L57 13 M53 43 L57 47 M27 17 L23 13 M27 43 L23 47 M30 78 L34 64 L46 64 L50 78" fill="none"/>',
    maj20: '<path d="M40 44 C22 44 16 58 18 70 L62 70 C64 58 58 44 40 44 Z" fill="none"/><circle cx="40" cy="32" r="9" fill="none"/><path d="M40 20 L46 8 M22 26 L30 20 M58 26 L50 20" fill="none"/>',
    maj21: '<ellipse cx="40" cy="44" rx="16" ry="26" fill="none"/><path d="M24 44 L56 44 M28 30 C34 40 46 40 52 30 M28 58 C34 48 46 48 52 58 M28 20 C36 28 44 28 52 20 M28 68 C36 60 44 60 52 68" fill="none"/>'
  };
  function cardFaceSvg(card, w, h) {
    var body;
    if (card.suit === 'major') body = '<g transform="translate(0,2)" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (MAJOR_GLYPH[card.id] || '') + '</g>';
    else {
      var n = parseInt(card.rank, 10);
      if (!isNaN(n)) { // 数字牌：pip 排布
        var pos = pipLayout(n), parts = [];
        for (var i = 0; i < n; i++) {
          var s = n >= 6 ? 0.5 : 0.62;
          parts.push('<g transform="translate(' + (pos[i][0] * 80 - 40 * s + (40 - 40 * s)) + ',' + (pos[i][1] * 92 - 46 * s + (46 - 46 * s)) + ') scale(' + s + ')">' + SUIT_GLYPH[card.suit] + '</g>');
        }
        body = '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">' + parts.join('') + '</g>';
      } else { // 宫廷牌：人形 + 花色
        var crown = card.rank === 'k' ? '<path d="M30 18 L34 12 L40 18 L46 12 L50 18" fill="none"/>' : card.rank === 'q' ? '<path d="M30 18 C34 14 46 14 50 18" fill="none"/>' : card.rank === 'n' ? '<path d="M32 18 L48 18 M40 12 L40 18" fill="none"/>' : '<circle cx="40" cy="15" r="3" fill="none"/>';
        body = '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
          crown + '<circle cx="40" cy="26" r="7"/><path d="M40 33 L40 62 M40 42 L28 52 M40 42 L52 52 M40 62 L32 78 M40 62 L48 78"/>' +
          '<g transform="translate(52,58) scale(0.55)">' + SUIT_GLYPH[card.suit] + '</g></g>';
      }
    }
    return '<svg class="card-art" viewBox="0 0 80 92" width="' + w + '" height="' + h + '" aria-hidden="true">' + body + '</svg>';
  }
  function pipLayout(n) {
    var L = { 1: [[.5, .5]], 2: [[.5, .22], [.5, .78]], 3: [[.5, .2], [.5, .5], [.5, .8]],
      4: [[.28, .22], [.72, .22], [.28, .78], [.72, .78]],
      5: [[.28, .2], [.72, .2], [.5, .5], [.28, .8], [.72, .8]],
      6: [[.28, .18], [.72, .18], [.28, .5], [.72, .5], [.28, .82], [.72, .82]],
      7: [[.28, .16], [.72, .16], [.5, .34], [.28, .55], [.72, .55], [.28, .84], [.72, .84]],
      8: [[.28, .16], [.72, .16], [.28, .4], [.72, .4], [.28, .62], [.72, .62], [.28, .86], [.72, .86]],
      9: [[.28, .14], [.72, .14], [.28, .38], [.72, .38], [.5, .5], [.28, .62], [.72, .62], [.28, .86], [.72, .86]],
      10: [[.28, .12], [.72, .12], [.5, .28], [.28, .4], [.72, .4], [.28, .64], [.72, .64], [.5, .78], [.28, .9], [.72, .9]] };
    return L[n] || L[1];
  }
  function cardBackSvg(w, h) {
    return '<svg class="card-back-art" viewBox="0 0 80 112" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<rect x="5" y="5" width="70" height="102" rx="6" fill="none" stroke="currentColor" stroke-width="1"/>' +
      '<path d="M40 22 C48 34 54 40 54 52 A14 14 0 0 1 26 52 C26 40 32 34 40 22 Z" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M40 30 C40 44 40 52 40 60 M18 78 L62 78 M26 86 L54 86" fill="none" stroke="currentColor" stroke-width="1"/>' +
      '<circle cx="40" cy="96" r="2.4" fill="currentColor"/></svg>';
  }

  /* ============ 数据存取 ============ */
  function loadProfile() { try { return JSON.parse(localStorage.getItem(LS_PROFILE)); } catch (e) { return null; } }
  function saveProfile(p) { try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch (e) { } }

  /* ============ 生辰表单 ============ */
  function renderBirthForm() {
    var cities = B.CITIES.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('');
    $('#birth-form').innerHTML =
      '<div class="f-grid">' +
      '<label class="f-field"><span>性别</span><select id="b-gender"><option value="1">男</option><option value="0">女</option></select></label>' +
      '<label class="f-field"><span>公历生日</span><input type="date" id="b-date" min="1901-01-01" max="2049-12-31"></label>' +
      '<label class="f-field"><span>出生时间</span><input type="time" id="b-time" value="12:00"></label>' +
      '<label class="f-field"><span>出生城市 <small>(可选，用于真太阳时)</small></span><input id="b-city" list="f-cities" placeholder="如 成都">' +
      '<datalist id="f-cities">' + cities + '</datalist></label>' +
      '<label class="f-check"><input type="checkbox" id="b-hour-unknown"> 不知道出生时辰（按正午暂代，时柱仅参考）</label>' +
      '<label class="f-check"><input type="checkbox" id="b-truesolar" checked> 真太阳时修正（据出生地经度与均时差）</label>' +
      '</div>' +
      '<div class="f-actions"><button class="f-btn" id="b-submit">生成命盘，开始问运</button><span class="f-err" id="b-err"></span></div>';
    var saved = loadProfile();
    if (saved) {
      $('#b-gender').value = saved.gender;
      $('#b-date').value = saved.y + '-' + pad(saved.m) + '-' + pad(saved.d);
      $('#b-time').value = pad(saved.h) + ':' + pad(saved.min || 0);
      $('#b-city').value = saved.city || '';
      $('#b-hour-unknown').checked = !!saved.hourUnknown;
      $('#b-truesolar').checked = !!saved.trueSolar;
    }
    $('#b-submit').addEventListener('click', submitBirth);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function submitBirth() {
    var err = $('#b-err');
    var dv = $('#b-date').value;
    var tv = $('#b-time').value || '12:00';
    if (!dv) { err.textContent = '请先选择公历生日'; return; }
    var parts = dv.split('-');
    var city = $('#b-city').value.trim();
    var lon = null;
    if (city) {
      var hit = B.CITIES.filter(function (c) { return c.name === city; })[0];
      if (hit) lon = hit.lon;
      else { err.textContent = '城市列表里没有「' + city + '」，可留空或换个写法'; return; }
    }
    var input = {
      gender: parseInt($('#b-gender').value, 10),
      y: parseInt(parts[0], 10), m: parseInt(parts[1], 10), d: parseInt(parts[2], 10),
      h: parseInt(tv.split(':')[0], 10), min: parseInt(tv.split(':')[1] || '0', 10),
      hourUnknown: $('#b-hour-unknown').checked,
      trueSolar: $('#b-truesolar').checked && lon != null,
      longitude: lon, city: city
    };
    try {
      var profile = B.buildProfile(input);
      STORE.profile = profile; saveProfile(input); // 存输入而非结果,刷新后可直接重算
      renderAll(true);
    } catch (e) {
      err.textContent = '排盘失败：' + e.message;
    }
  }

  /* ============ 命盘渲染 ============ */
  function wxBadge(wx) { return '<i class="wx wx-' + wx + '">' + wx + '</i>'; }
  function renderChart(profile) {
    var p = profile;
    $('#f-birth-summary').innerHTML = '公历 ' + p.birth.y + '-' + pad(p.birth.m) + '-' + pad(p.birth.d) +
      (p.birth.hourUnknown ? ' · 时辰未知' : ' · ' + pad(p.birth.h) + ':' + pad(p.birth.min || 0)) +
      (p.birth.city ? ' · ' + esc(p.birth.city) : '') + (p.birth.trueSolar ? ' · 真太阳时' : '') +
      ' <button class="f-link" id="f-edit-birth">修改</button>';
    $('#pillars').innerHTML = p.pillars.map(function (x, i) {
      var hide = x.hideGan.map(function (g, k) {
        var ss = (x.hideShiShen && x.hideShiShen[k]) ? x.hideShiShen[k] : '';
        return '<span class="hide-gan">' + g + '<em>' + (ss || D.GAN_WUXING[g].wx) + '</em></span>';
      }).join('');
      return '<div class="pillar' + (p.birth.hourUnknown && i === 3 ? ' pillar-mute' : '') + '">' +
        '<div class="pillar-label">' + x.label + (p.birth.hourUnknown && i === 3 ? '<small>参考</small>' : '') + '</div>' +
        '<div class="pillar-gz">' + x.gan + '<b class="pillar-zhi">' + x.zhi + '</b></div>' +
        '<div class="pillar-ss">' + x.shiShen + '</div>' +
        '<div class="pillar-wx">' + wxBadge(x.wxGan) + wxBadge(x.wxZhi) + '</div>' +
        '<div class="pillar-na">纳音 ' + esc(x.naYin) + '</div>' +
        '<div class="pillar-hide">' + hide + '</div>' +
        '</div>';
    }).join('');

    var order = ['木', '火', '土', '金', '水'];
    var maxPct = Math.max.apply(null, order.map(function (w) { return p.wuxing.percent[w]; }));
    $('#wuxing-bars').innerHTML = order.map(function (w) {
      var pct = p.wuxing.percent[w];
      return '<div class="wx-row"><span class="wx-name">' + w + '</span>' +
        '<div class="wx-bar"><i style="width:' + (maxPct ? Math.round(pct / maxPct * 100) : 0) + '%"></i></div>' +
        '<span class="wx-pct">' + pct + '%</span></div>';
    }).join('');

    var st = D.STRENGTH_INFO[p.strength.level];
    var xi = p.xiYong;
    $('#strength-badge').innerHTML =
      '<div class="badge-line">日主 <b>' + p.dayMaster + '（' + p.dayMasterWx + '）</b>' +
      '<span class="tag">' + st.desc + '</span></div>' +
      '<div class="badge-line muted">' + (p.strength.deLing ? '得令' : '失令') + ' · ' + (p.strength.deDi ? '得地' : '失地') +
      ' · 同党（' + esc(p.strength.party) + '）占比 ' + Math.round(p.strength.score * 100) + '%</div>' +
      '<div class="badge-line">喜用神：' + wxBadge(xi.primary) + wxBadge(xi.secondary) +
      (xi.avoid.length ? '<span class="muted">忌 ' + xi.avoid.map(wxBadge).join('') + '</span>' : '') +
      '<span class="muted small">简化扶抑法</span></div>' +
      '<div class="badge-line muted">' + esc(st.strategy) + '</div>';

    var cur = p.dayun.filter(function (d) { return d.current; })[0];
    $('#dayun-strip').innerHTML = '<div class="dayun-head"><b>大运</b><span class="muted small">每步十年 · ' + esc(p.startInfo) + '</span></div>' +
      '<div class="dayun-list">' + p.dayun.map(function (d) {
        if (!d.ganZhi) return '<div class="dayun-item dayun-before"><b>起运前</b><span>' + d.startYear + '</span></div>';
        return '<div class="dayun-item' + (d.current ? ' dayun-cur' : '') + '">' +
          '<b>' + d.ganZhi + '</b><span>' + d.startAge + '-' + d.endAge + ' 岁</span>' +
          '<span class="muted">' + d.startYear + '-' + d.endYear + '</span>' +
          (d.current ? '<em>当前</em>' : '') + '</div>';
      }).join('') + '</div>' +
      (cur ? '<div class="dayun-tone muted">' + esc(cur.tone) + '</div>' : '');
    $('#f-edit-birth').addEventListener('click', function () {
      $('#f-step-birth').classList.remove('hidden');
      $('#f-step-birth').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ============ 今日运渲染 ============ */
  function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="star' + (i <= n ? ' on' : '') + '"></i>'; return s; }
  function renderToday(profile) {
    var t = B.today(profile);
    STORE.today = t;
    var dimNames = { action: '行动力', wealth: '财缘', social: '人际', mood: '心绪' };
    $('#today-card').innerHTML =
      '<div class="today-gz"><div class="gz-item"><span>流年</span><b>' + t.yearGanZhi + '</b></div>' +
      '<div class="gz-item"><span>流月</span><b>' + t.monthGanZhi + '</b></div>' +
      '<div class="gz-item gz-main"><span>今日</span><b>' + t.dayGanZhi + '</b></div>' +
      '<div class="gz-item"><span>十神</span><b>' + t.dayShiShen + '</b></div></div>' +
      '<p class="today-headline">' + esc(t.headline) + '</p>' +
      '<div class="today-dims">' + Object.keys(dimNames).map(function (k) {
        return '<div class="dim"><span>' + dimNames[k] + '</span>' + stars(t.dims[k]) + '</div>';
      }).join('') + '</div>' +
      '<div class="today-lists"><div class="yi"><b>宜</b>' + t.yi.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div class="ji"><b>忌</b>' + t.avoid.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div></div>' +
      (t.relations.length ? '<div class="today-rel muted">' + t.relations.map(esc).join('；') + '</div>' : '') +
      '<div class="today-xi muted small">' + esc(t.xiAdvice.tip) + ' · ' + esc(t.xiAdvice.color) + ' · ' + esc(t.xiAdvice.dir) + '</div>';
  }

  /* ============ 塔罗 ============ */
  var SPREADS = {
    one: { name: '单张指引', positions: [{ key: 'now', name: '当下', en: 'THE PRESENT' }] },
    three: { name: '三张牌阵', positions: [
      { key: 'now', name: '当下', en: 'THE PRESENT' },
      { key: 'block', name: '阻碍', en: 'THE CHALLENGE' },
      { key: 'act', name: '行动', en: 'THE POSSIBILITY' }] }
  };
  function shuffledDeck() {
    var a = T.cards.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a;
  }
  function renderTarotControls() {
    $('#tarot-controls').innerHTML =
      '<div class="f-grid">' +
      '<label class="f-field f-wide"><span>此刻，你想问什么？<small>(可选)</small></span>' +
      '<input id="t-question" maxlength="60" placeholder="例如：最近的事业方向需要怎么调整？"></label>' +
      '<label class="f-field"><span>牌阵</span><select id="t-spread"><option value="three">三张牌阵（当下·阻碍·行动）</option><option value="one">单张指引</option></select></label>' +
      '<label class="f-check f-check-inline"><input type="checkbox" id="t-reversed" checked> 包含逆位</label>' +
      '</div><div class="f-actions"><button class="f-btn" id="t-shuffle">带着问题，开始抽牌</button></div>';
    $('#t-shuffle').addEventListener('click', startDraw);
  }
  function startDraw() {
    var n = SPREADS[$('#t-spread').value].positions.length;
    var allowRev = $('#t-reversed').checked;
    var deck = shuffledDeck().slice(0, Math.min(9, Math.max(5, n + 4)));
    STORE.draw = { spread: $('#t-spread').value, question: $('#t-question').value.trim(), picked: [], need: n, allowRev: allowRev, fan: deck };
    $('#tarot-reading').innerHTML = '';
    $('#tarot-stage').innerHTML =
      '<div class="fan-hint muted small">' + (n === 3 ? '牌阵三张，请凭直觉依次点选 ' : '请凭直觉点选 ') + ' <b id="fan-left">' + n + '</b> 张牌</div>' +
      '<div class="fan" id="fan">' + deck.map(function (c, i) {
        return '<button class="fan-card" data-i="' + i + '" title="第 ' + (i + 1) + ' 张">' + cardBackSvg(72, 100) + '</button>';
      }).join('') + '</div>' +
      '<div class="f-actions"><button class="f-link" id="t-auto">不想选？让我替你抽</button></div>';
    Array.prototype.forEach.call(document.querySelectorAll('#fan .fan-card'), function (btn) {
      btn.addEventListener('click', function () { pickCard(parseInt(btn.getAttribute('data-i'), 10), btn); });
    });
    $('#t-auto').addEventListener('click', function () {
      var idxs = deck.map(function (_, i) { return i; });
      for (var i = idxs.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = idxs[i]; idxs[i] = idxs[j]; idxs[j] = tmp; }
      idxs.slice(0, STORE.draw.need - STORE.draw.picked.length).forEach(function (k) { pickCard(k, document.querySelector('#fan .fan-card[data-i="' + k + '"]')); });
    });
    $('#tarot-stage').classList.remove('hidden');
    $('#tarot-stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function pickCard(i, btn) {
    var st = STORE.draw;
    if (!st || st.picked.length >= st.need || btn.classList.contains('picked')) return;
    btn.classList.add('picked');
    var card = st.fan[i];
    var reversed = st.allowRev && Math.random() < 0.38;
    st.picked.push({ card: card, reversed: reversed });
    var left = $('#fan-left');
    if (left) left.textContent = st.need - st.picked.length;
    if (st.picked.length >= st.need) setTimeout(renderReading, 450);
  }
  function renderReading() {
    var st = STORE.draw;
    var spread = SPREADS[st.spread];
    var profile = STORE.profile, xi = profile ? profile.xiYong : null;
    $('#tarot-stage').classList.add('hidden');
    $('#tarot-reading').innerHTML =
      '<h3 class="reading-title">' + esc(spread.name) + (st.question ? '<span class="muted small">「' + esc(st.question) + '」</span>' : '') + '</h3>' +
      '<div class="draw-row">' + st.picked.map(function (pk, idx) {
        var c = pk.card, pos = spread.positions[idx];
        return '<div class="draw-card' + (pk.reversed ? ' reversed' : '') + '" id="draw-card-' + idx + '">' +
          '<div class="draw-card-inner"><div class="draw-front">' + cardFaceSvg(c, 96, 110) +
          '<div class="draw-num">' + esc(c.num) + '</div><div class="draw-name">' + esc(c.name) + '</div>' +
          '<div class="draw-en muted small">' + esc(c.en) + '</div></div>' +
          '<div class="draw-back">' + cardBackSvg(96, 110) + '</div></div>' +
          '<div class="draw-pos">' + esc(pos.name) + ' <small>' + esc(pos.en) + '</small></div>' +
          '<div class="draw-rev">' + (pk.reversed ? '逆位' : '正位') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="reading-body">' + spread.positions.map(function (pos, idx) {
        var pk = st.picked[idx], c = pk.card;
        return '<div class="reading-item"><div class="reading-card">' +
          '<span class="reading-pos">' + esc(pos.name) + ' / ' + esc(pos.en) + '</span>' +
          '<b>' + esc(c.name) + '</b><span class="tag">' + (pk.reversed ? '逆位' : '正位') + '</span>' +
          '<span class="muted small">' + esc(c.en) + ' · 元素 ' + esc(c.element) + (c.astro ? ' · ' + esc(c.astro) : '') + '</span></div>' +
          '<div class="reading-text"><p>' + esc(pk.reversed ? c.rev : c.up) + '</p>' +
          '<p class="reading-kw">' + (pk.reversed ? c.keywordsRev : c.keywordsUp).map(function (k) { return '<i>' + esc(k) + '</i>'; }).join('') + '</p>' +
          (pos.key === 'act' ? '<p class="reading-advice">给行动位置的建议：' + esc(c.advice) + '</p>' : '') +
          '</div></div>';
      }).join('') +
      '<div class="reading-syn">' + compositeReading() + '</div></div>' +
      '<div class="f-actions"><button class="f-btn ghost" id="t-redraw">重新洗牌</button></div>';
    $('#t-redraw').addEventListener('click', startDraw);
    // 翻牌动画
    Array.prototype.forEach.call(document.querySelectorAll('.draw-card'), function (el, i) {
      setTimeout(function () { el.classList.add('flipped'); }, 150 + i * 260);
    });
  }
  function compositeReading() {
    var st = STORE.draw, profile = STORE.profile;
    var xi = profile ? profile.xiYong : null;
    var parts = [];
    var eles = st.picked.map(function (pk) { return pk.card.element; });
    var uniq = eles.filter(function (e, i) { return eles.indexOf(e) === i; });
    parts.push('本次抽牌以 <b>' + uniq.join('、') + '</b> 元素为主。');
    if (xi) {
      var hit = uniq.indexOf(xi.primary) >= 0;
      var bad = uniq.filter(function (e) { return xi.avoid.indexOf(e) >= 0; });
      if (hit) parts.push('其中的「' + xi.primary + '」恰是你的喜用神——牌面所指向的方向，与你命局此刻需要的能量是一致的，可以更放心地往前走。');
      if (bad.length) parts.push('而「' + bad.join('、') + '」属于你的忌神，相关领域的提示要更谨慎地对待：先立边界，再谈展开。');
      if (!hit && !bad.length) parts.push('它们与你的喜用（' + esc(xi.primary) + '、' + esc(xi.secondary) + '）并无直接呼应，更像中性的天气提示：按日常节奏应对即可。');
    } else {
      parts.push('先生成命盘后，解读还会自动结合你的五行喜用。');
    }
    if (st.question) parts.push('回到你的问题「' + esc(st.question) + '」：把三张牌连成一条线——先承认' + SPREADS[st.spread].positions.map(function (p) { return '「' + p.name + '」'; }).join('、') + '之间正在发生什么，再决定下一步的落点。');
    parts.push('<span class="muted small">牌义以 Waite《Pictorial Key to the Tarot》(1911) 为底本；解释仅供娱乐与自我探索。</span>');
    return '<b>综合解读</b><p>' + parts.join(' ') + '</p>';
  }

  /* ============ AI ============ */
  function renderAiPill() {
    var s = STORE.aiState;
    var el = $('#ai-pill');
    if (s.ok && s.enabled) { el.innerHTML = '<i class="dot on"></i> AI 已连接 · ' + esc(s.model || 'LLM'); el.classList.add('ai-on'); }
    else if (s.ok) { el.innerHTML = '<i class="dot"></i> 后台已连接，AI 未配置'; el.classList.add('ai-warn'); }
    else { el.innerHTML = '<i class="dot"></i> 本地解读模式'; el.title = '未检测到本机管理后台，AI 深度解读不可用（本地解读功能完整可用）'; }
  }
  function probeAi() {
    L.probe().then(function (s) { STORE.aiState = s; renderAiPill(); });
  }
  function bindAi() {
    $('#ai-pill').addEventListener('click', openAiDrawer);
    $('#ai-close').addEventListener('click', function () { $('#ai-drawer').classList.remove('open'); });
    $('#ai-endpoint-save').addEventListener('click', function () {
      L.setEndpoint($('#ai-endpoint').value.trim() || 'http://127.0.0.1:14001');
      $('#ai-drawer').classList.remove('open');
      probeAi();
    });
    $('#ai-btn').addEventListener('click', function () {
      var btn = $('#ai-btn'), out = $('#ai-output');
      if (!STORE.profile) { out.innerHTML = '<p class="muted">先生成命盘，AI 解读会自动结合八字与牌面。</p>'; return; }
      if (!STORE.aiState.enabled) {
        out.innerHTML = '<p class="muted">AI 深度解读未启用：' +
          (STORE.aiState.ok ? '后台已连接，但尚未在管理端「设置 → AI 深度解读」里配置模型。' :
            '未检测到本机管理后台（' + esc(L.getEndpoint()) + '）。请在本机运行 npm run admin 并在设置中配置 API；页面右上角可修改后台地址。') +
          '<br>当前可用的本地解读已包含：四柱十神、五行喜用、大运流年、今日干支与 78 张牌的完整牌义。</p>';
        return;
      }
      btn.disabled = true; btn.textContent = '正在凝神解读…';
      out.innerHTML = '<p class="muted small">AI 正在结合你的八字、大运与牌面撰写解读…（首次响应可能需要十余秒）</p>';
      var started = false;
      L.interpret({ profile: STORE.profile, today: STORE.today, draw: STORE.draw, question: STORE.draw ? STORE.draw.question : '' },
        function (chunk) {
          if (!started) { out.innerHTML = ''; started = true; }
          typewriter(out, chunk);
        },
        function () { btn.disabled = false; btn.textContent = '请 AI 深度解读'; },
        function (err) {
          btn.disabled = false; btn.textContent = '请 AI 深度解读';
          out.innerHTML = '<p class="f-err">AI 解读失败：' + esc(err) + '<br>本地解读不受影响，可稍后重试。</p>';
        });
    });
  }
  function typewriter(el, text) {
    var i = 0, step = 2;
    (function tick() {
      if (i >= text.length) return;
      i += step;
      el.textContent = text.slice(0, i);
      setTimeout(tick, 16);
    })();
  }
  function openAiDrawer() {
    $('#ai-endpoint').value = L.getEndpoint();
    $('#ai-drawer').classList.add('open');
  }

  /* ============ 编排 ============ */
  function renderAll(scroll) {
    $('#f-step-birth').classList.add('hidden');
    $('#f-main').classList.remove('hidden');
    renderChart(STORE.profile);
    renderToday(STORE.profile);
    if (scroll) $('#f-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function init() {
    renderBirthForm();
    renderTarotControls();
    bindAi();
    var saved = loadProfile();
    if (saved) {
      try { STORE.profile = B.buildProfile(saved); } catch (e) { STORE.profile = null; }
      if (STORE.profile) { renderAll(false); $('#f-step-birth').classList.add('hidden'); }
    }
    probeAi();
    setInterval(probeAi, 60000);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
