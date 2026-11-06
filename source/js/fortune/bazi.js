/* ============================================================
 * 月下问运 · 八字排盘引擎
 * ------------------------------------------------------------
 * 历法/节气/四柱/大运计算基于 lunar-javascript (6tail, MIT，
 * 节气按寿星天文历天文算法)。本文件在其上实现：
 *  1. 真太阳时修正（经度差 + 均时差，NOAA 简化公式）
 *  2. 五行加权统计（天干 1.0；地支藏干按本/中/余气 0.6/0.3/0.1）
 *  3. 日主强弱评分（得令/得地/得势加权，简化规则）
 *  4. 喜用神（扶抑取用简化版，见页面「关于」声明）
 *  5. 大运/流年/今日干支的综合解读输出
 * ============================================================ */
(function (root) {
  'use strict';
  var D = root.FortuneData;
  var SolarLib = root.Solar; // lunar-javascript UMD 挂载的全局

  /* ---------- 常用城市经度（东经 120 为东八区标准子午线） ---------- */
  var CITIES = [
    { name: '北京', lon: 116.41 }, { name: '上海', lon: 121.47 }, { name: '广州', lon: 113.26 },
    { name: '深圳', lon: 114.06 }, { name: '杭州', lon: 120.15 }, { name: '南京', lon: 118.80 },
    { name: '成都', lon: 104.07 }, { name: '重庆', lon: 106.55 }, { name: '武汉', lon: 114.30 },
    { name: '西安', lon: 108.94 }, { name: '天津', lon: 117.20 }, { name: '苏州', lon: 120.58 },
    { name: '郑州', lon: 113.63 }, { name: '长沙', lon: 112.94 }, { name: '沈阳', lon: 123.43 },
    { name: '哈尔滨', lon: 126.53 }, { name: '青岛', lon: 120.38 }, { name: '大连', lon: 121.61 },
    { name: '济南', lon: 117.12 }, { name: '福州', lon: 119.30 }, { name: '厦门', lon: 118.09 },
    { name: '昆明', lon: 102.83 }, { name: '贵阳', lon: 106.63 }, { name: '南宁', lon: 108.37 },
    { name: '太原', lon: 112.55 }, { name: '石家庄', lon: 114.51 }, { name: '长春', lon: 125.32 },
    { name: '兰州', lon: 103.83 }, { name: '西宁', lon: 101.78 }, { name: '拉萨', lon: 91.11 },
    { name: '乌鲁木齐', lon: 87.62 }, { name: '银川', lon: 106.23 }, { name: '呼和浩特', lon: 111.75 },
    { name: '南昌', lon: 115.89 }, { name: '合肥', lon: 117.28 }, { name: '海口', lon: 110.32 },
    { name: '香港', lon: 114.17 }, { name: '澳门', lon: 113.55 }, { name: '台北', lon: 121.56 }
  ];

  /* ---------- 真太阳时修正 ----------
   * 真太阳时 = 标准时 + (当地经度-120°)×4分钟 + 均时差 EoT
   * EoT(分钟) ≈ 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B), B = 2π(N−81)/364
   * (N 为年积日；NOAA/Sonnenuhr 简化式，精度约 ±0.5 分钟，足够排盘用) */
  function trueSolarTime(y, m, d, h, mi, lon, enable) {
    if (!enable || lon == null) return { y: y, m: m, d: d, h: h, min: mi, offsetMin: 0 };
    var start = Date.UTC(y, m - 1, d);
    var N = Math.floor((start - Date.UTC(y, 0, 1)) / 86400000) + 1;
    var B = 2 * Math.PI * (N - 81) / 364;
    var eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    var lonMin = (lon - 120) * 4;
    var offset = lonMin + eot;
    var t = new Date(start + h * 3600000 + mi * 60000 + Math.round(offset) * 60000);
    return {
      y: y, m: m, d: d, // 日期回退/进位只影响时分（排盘以当日起始日计算），跨日按新时分归位
      h: t.getUTCHours(), min: t.getUTCMinutes(),
      offsetMin: Math.round(offset * 10) / 10,
      note: '经度修正 ' + Math.round(lonMin) + ' 分钟，均时差 ' + Math.round(eot * 10) / 10 + ' 分钟'
    };
  }

  /* ---------- 十神（干 vs 干）本地实现，供流年/大运干支复用 ---------- */
  var SHISHEN_TABLE = (function () {
    // 行=日主(10天干顺序甲0..癸9)，列=他干，值=十神
    var gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    var wxOf = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
    var names = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
    var t = {};
    for (var i = 0; i < 10; i++) {
      t[gan[i]] = {};
      for (var j = 0; j < 10; j++) {
        if (i === j) { t[gan[i]][gan[j]] = '比肩'; continue; }
        var sameYY = (i % 2) === (j % 2);
        var me = wxOf[i], other = wxOf[j];
        var idx;
        if (D.SHENG[me] === other) idx = sameYY ? 2 : 3;            // 我生：食神/伤官
        else if (D.SHENG[other] === me) idx = sameYY ? 8 : 9;       // 生我：偏印/正印
        else if (D.KE[me] === other) idx = sameYY ? 4 : 5;          // 我克：偏财/正财
        else if (D.KE[other] === me) idx = sameYY ? 6 : 7;          // 克我：七杀/正官
        else idx = sameYY ? 0 : 1;                                   // 同我：比肩/劫财
        t[gan[i]][gan[j]] = names[idx];
      }
    }
    return t;
  })();

  /* ---------- 五行加权统计 ----------
   * 天干各 1.0；地支藏干按次序 0.6/0.3/0.1（本气/中气/余气） */
  function wuxingScore(ganZhiList) {
    var score = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    var w = [1.0, 1.0, 1.0, 1.0]; // 年月日时四干
    ganZhiList.forEach(function (gz, i) {
      var g = gz.charAt(0), z = gz.charAt(1);
      score[D.GAN_WUXING[g].wx] += w[i];
      var hide = D.ZHI_INFO[z].hide;
      var weights = hide.length === 1 ? [1.0] : hide.length === 2 ? [0.7, 0.3] : [0.6, 0.3, 0.1];
      hide.forEach(function (hg, k) { score[D.GAN_WUXING[hg].wx] += weights[k]; });
    });
    return score;
  }

  /* ---------- 日主强弱评分（简化规则） ----------
   * 得势 = 同党(比劫+印)分数占比；得令 = 月支本气或主气属同党；
   * 得地 = 日支藏干含同党。综合分 r ∈ [0,1] → 五档 */
  function strengthOf(pillars, score, dayGan) {
    var me = D.GAN_WUXING[dayGan].wx;
    var shengMe = D.shengWo(me); // 印(生我)
    var party = score[me] + score[shengMe];
    var total = 0, k;
    for (k in score) total += score[k];
    var r = party / total; // 得势

    var monthZhi = pillars[1].zhi;
    var monthHide = D.ZHI_INFO[monthZhi].hide;
    var lingParty = monthHide.filter(function (g) {
      var wx = D.GAN_WUXING[g].wx; return wx === me || wx === shengMe;
    }).length;
    var deLing = lingParty >= 2 || (monthHide[0] && (D.GAN_WUXING[monthHide[0]].wx === me || D.GAN_WUXING[monthHide[0]].wx === shengMe));

    var dayHide = D.ZHI_INFO[pillars[2].zhi].hide;
    var deDi = dayHide.some(function (g) {
      var wx = D.GAN_WUXING[g].wx; return wx === me || wx === shengMe;
    });

    var adj = (deLing ? 0.12 : -0.08) + (deDi ? 0.06 : 0);
    r = Math.max(0, Math.min(1, r + adj));

    var level = r < 0.25 ? '太弱' : r < 0.42 ? '偏弱' : r < 0.58 ? '中和' : r < 0.75 ? '偏强' : '太强';
    return { score: Math.round(r * 100) / 100, level: level, deLing: deLing, deDi: deDi, party: me + '、' + shengMe };
  }

  /* ---------- 喜用神（扶抑取用简化版） ---------- */
  function xiYongOf(level, score, dayGan) {
    var me = D.GAN_WUXING[dayGan].wx;
    var yin = D.shengWo(me);      // 生我者（印）
    var bijiao = me;              // 同我者（比劫）
    var shang = D.SHENG[me];      // 我生者（食伤）
    var guan = D.keWo(me);        // 克我者（官杀）
    var cai = D.KE[me];           // 我克者（财）

    var primary, secondary, avoid;
    if (level === '偏弱' || level === '太弱') {
      primary = score[yin] <= score[bijiao] ? yin : bijiao;
      secondary = primary === yin ? bijiao : yin;
      avoid = level === '太弱' ? [shang, guan, cai] : [guan, cai];
    } else if (level === '偏强' || level === '太强') {
      primary = level === '太强' ? shang : (score[shang] <= score[guan] ? shang : guan);
      secondary = level === '太强' ? guan : cai;
      avoid = [yin, bijiao];
    } else {
      // 中和：补最弱一行，取其生我者为辅
      var min = null;
      ['木', '火', '土', '金', '水'].forEach(function (wx) { if (min === null || score[wx] < score[min]) min = wx; });
      primary = min; secondary = D.shengWo(min); avoid = [];
    }
    return { primary: primary, secondary: secondary, avoid: avoid };
  }

  /* ---------- 组装命盘 ---------- */
  function buildProfile(input) {
    // input: {gender:1|0, y,m,d, h(0-23), min, hourUnknown, longitude, trueSolar}
    var t = trueSolarTime(input.y, input.m, input.d, input.h, input.min || 0, input.longitude, input.trueSolar);
    var solar = SolarLib.fromYmdHms(input.y, input.m, input.d, t.h, t.min, 0);
    var lunar = solar.getLunar();
    var ec = lunar.getEightChar();

    var dayGan = ec.getDayGan();
    var pillars = [
      { label: '年柱', ganZhi: ec.getYear(), gan: ec.getYearGan(), zhi: ec.getYearZhi(), shiShen: ec.getYearShiShenGan(), hideShiShen: ec.getYearShiShenZhi(), naYin: ec.getYearNaYin(), animal: lunar.getYearShengXiao() },
      { label: '月柱', ganZhi: ec.getMonth(), gan: ec.getMonthGan(), zhi: ec.getMonthZhi(), shiShen: ec.getMonthShiShenGan(), hideShiShen: ec.getMonthShiShenZhi(), naYin: ec.getMonthNaYin() },
      { label: '日柱', ganZhi: ec.getDay(), gan: ec.getDayGan(), zhi: ec.getDayZhi(), shiShen: '日主', hideShiShen: ec.getDayShiShenZhi(), naYin: ec.getDayNaYin() },
      { label: '时柱', ganZhi: ec.getTime(), gan: ec.getTimeGan(), zhi: ec.getTimeZhi(), shiShen: ec.getTimeShiShenGan(), hideShiShen: ec.getTimeShiShenZhi(), naYin: ec.getTimeNaYin() }
    ];
    pillars.forEach(function (p) {
      p.wxGan = D.GAN_WUXING[p.gan].wx; p.wxZhi = D.ZHI_INFO[p.zhi].wx;
      p.hideGan = D.ZHI_INFO[p.zhi].hide;
    });

    var gzList = pillars.map(function (p) { return p.ganZhi; });
    // 时辰未知：时柱仅作参考展示，不计入五行与强弱评分
    var scoreSrc = input.hourUnknown ? gzList.slice(0, 3) : gzList;
    var score = wuxingScore(scoreSrc);
    var total = 0; for (var k in score) total += score[k];
    var percent = {}; for (var k2 in score) percent[k2] = Math.round(score[k2] / total * 100);

    var strength = strengthOf(pillars, score, dayGan);
    var xiYong = xiYongOf(strength.level, score, dayGan);

    // 大运
    var yun = ec.getYun(input.gender, 1); // 流派1：默认早晚子时按当日
    var startInfo = yun.getStartYear() + ' 年 ' + yun.getStartMonth() + ' 个月 ' + yun.getStartDay() + ' 天后起运';
    var nowY = new Date().getFullYear();
    var dayun = yun.getDaYun().map(function (dy, i) {
      var gz = dy.getGanZhi();
      var shiShen = gz ? SHISHEN_TABLE[dayGan][gz.charAt(0)] : null;
      var zhiWx = gz ? D.ZHI_INFO[gz.charAt(1)].wx : null;
      var item = {
        index: i, ganZhi: gz,
        startAge: dy.getStartAge(), endAge: dy.getEndAge(),
        startYear: dy.getStartYear(), endYear: dy.getEndYear(),
        shiShen: shiShen, zhiWx: zhiWx,
        tone: gz ? D.dayunTone(shiShen, zhiWx) : '出生当年至起运前，为「小运」阶段。',
        current: gz && nowY >= dy.getStartYear() && nowY <= dy.getEndYear()
      };
      return item;
    });

    return {
      birth: {
        gender: input.gender, y: input.y, m: input.m, d: input.d,
        h: input.h, min: input.min, hourUnknown: !!input.hourUnknown,
        city: input.city || '', longitude: input.longitude || null,
        trueSolar: !!input.trueSolar, savedAt: Date.now()
      },
      solarTime: t,
      pillars: pillars,
      dayMaster: dayGan,
      dayMasterWx: D.GAN_WUXING[dayGan].wx,
      shiShenTable: SHISHEN_TABLE,
      wuxing: { score: score, percent: percent },
      strength: strength,
      xiYong: xiYong,
      startInfo: startInfo,
      dayun: dayun
    };
  }

  /* ---------- 今日运（基于命盘 + 当日干支） ---------- */
  function today(profile, date) {
    date = date || new Date();
    var solar = SolarLib.fromDate(date);
    var lunar = solar.getLunar();
    var dayGanZhi = lunar.getDayInGanZhi();
    var monthGanZhi = lunar.getMonthInGanZhi();
    var yearGanZhi = lunar.getYearInGanZhi();
    var dayGan = dayGanZhi.charAt(0), dayZhi = dayGanZhi.charAt(1);

    var dm = profile.dayMaster;
    var dayShiShen = SHISHEN_TABLE[dm][dayGan];
    var dayWx = D.GAN_WUXING[dayGan].wx;

    // 与命局日支/年支的合冲
    var dayZhiSelf = profile.pillars[2].zhi;
    var yearZhiSelf = profile.pillars[0].zhi;
    var relations = [];
    if (D.ZHI_HE6[dayZhi] === dayZhiSelf) relations.push('今日' + dayZhi + '与你日支' + dayZhiSelf + '六合，人际缘分与协作运上扬');
    if (D.ZHI_CHONG6[dayZhi] === dayZhiSelf) relations.push('今日' + dayZhi + '冲你日支' + dayZhiSelf + '，奔波变动多，稳字当头');
    if (D.ZHI_HE6[dayZhi] === yearZhiSelf) relations.push('今日' + dayZhi + '合你年支' + yearZhiSelf + '，环境氛围对你友好');
    if (D.ZHI_CHONG6[dayZhi] === yearZhiSelf) relations.push('今日' + dayZhi + '冲你年支' + yearZhiSelf + '，留意与长辈上级的分歧');

    // 大运与流年
    var curY = date.getFullYear();
    var curDayun = profile.dayun.filter(function (x) { return x.ganZhi && curY >= x.startYear && curY <= x.endYear; })[0] || null;
    var liuNianGz = yearGanZhi;
    var liuNianShiShen = SHISHEN_TABLE[dm][liuNianGz.charAt(0)];

    // 喜用与维度
    var xi = profile.xiYong;
    var likes = dayWx === xi.primary;
    var dims = D.dimsFor(dayShiShen, dayWx, xi.primary, xi.avoid);

    var shenInfo = D.SHISHEN_INFO[dayShiShen];
    var wxInfo = D.WUXING_INFO[dayWx];
    var headline = (likes ? '今日五行「' + dayWx + '」恰是你的喜用神，顺风局。' : (xi.avoid.indexOf(dayWx) >= 0 ? '今日五行「' + dayWx + '」偏你的忌神，稳字当头。' : '今日五行「' + dayWx + '」对你是平局，按节奏来就好。')) + shenInfo.day;

    var advice = D.xiYongAdvice(xi.primary);
    var yi = ['留白与休整', '重要的事放在上午头脑清明时', '记录一个灵感'].concat(likes ? [wxInfo.activity] : []);
    var avoidList = ['重要决定压到深夜', '与人硬碰硬争对错'].concat(xi.avoid.indexOf(dayWx) >= 0 ? ['大额支出与冲动决定'] : []);

    return {
      dateStr: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate(),
      yearGanZhi: yearGanZhi, monthGanZhi: monthGanZhi, dayGanZhi: dayGanZhi,
      dayGan: dayGan, dayZhi: dayZhi, dayWx: dayWx,
      dayShiShen: dayShiShen, relations: relations,
      currentDayun: curDayun,
      liuNian: { ganZhi: liuNianGz, shiShen: liuNianShiShen, wx: D.GAN_WUXING[liuNianGz.charAt(0)].wx },
      headline: headline,
      dims: dims,
      yi: yi, avoid: avoidList,
      xiAdvice: advice
    };
  }

  root.FortuneBazi = {
    CITIES: CITIES,
    trueSolarTime: trueSolarTime,
    buildProfile: buildProfile,
    today: today,
    SHISHEN_TABLE: SHISHEN_TABLE
  };
})(window);
