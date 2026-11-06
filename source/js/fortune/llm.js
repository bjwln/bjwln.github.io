/* ============================================================
 * 月下问运 · LLM 深度解读模块
 * ------------------------------------------------------------
 * 架构（安全边界）：apikey 只存本机管理后台
 * admin/data/settings.json（gitignore），页面通过本机 admin
 * 的 /api/ai/chat 代理调用，页面侧永远接触不到 key。
 * admin 未运行时自动回退为纯本地解读。
 * ============================================================ */
(function (root) {
  'use strict';

  var LS_KEY = 'fortune-ai-endpoint';
  var DEFAULT_ENDPOINT = 'http://127.0.0.1:14001';

  function getEndpoint() {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_ENDPOINT; } catch (e) { return DEFAULT_ENDPOINT; }
  }
  function setEndpoint(url) {
    try { localStorage.setItem(LS_KEY, String(url || '').replace(/\/+$/, '')); } catch (e) { /* 私密模式忽略 */ }
  }

  /* 探测本机后台：返回 {ok, enabled, model, baseUrl} 或 {ok:false, reason} */
  function probe() {
    var ep = getEndpoint();
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 2500);
    return fetch(ep + '/api/ai/status', { signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { clearTimeout(timer); return { ok: true, enabled: !!d.enabled, model: d.model || '', baseUrl: d.baseUrl || '' }; })
      .catch(function (e) {
        clearTimeout(timer);
        return { ok: false, reason: e.name === 'AbortError' ? '超时' : '未连接' };
      });
  }

  /* 组装解读 prompt：把排盘结构化数据交给模型 */
  function buildPrompt(profile, todayInfo, drawResult, question) {
    var p = profile, t = todayInfo;
    var lines = [];
    lines.push('【用户信息】');
    lines.push('出生（公历）: ' + p.birth.y + ' 年 ' + p.birth.m + ' 月 ' + p.birth.d + ' 日 ' +
      (p.birth.hourUnknown ? '时辰未知（按正午暂代，时柱仅参考）' : p.birth.h + ' 时 ' + (p.birth.min || 0) + ' 分') +
      (p.birth.city ? '，出生地 ' + p.birth.city : '') +
      (p.solarTime && p.solarTime.offsetMin ? '（已做真太阳时修正 ' + p.solarTime.offsetMin + ' 分钟）' : '（按北京时间平太阳时）'));
    lines.push('四柱八字: ' + p.pillars.map(function (x) { return x.ganZhi; }).join(' ') +
      '（' + p.pillars.map(function (x) { return x.label.replace('柱', '') + ':' + x.shiShen; }).join('，') + '）');
    lines.push('日主: ' + p.dayMaster + '（' + p.dayMasterWx + '），强弱判断: ' + p.strength.level +
      '（' + (p.strength.deLing ? '得令' : '失令') + (p.strength.deDi ? '、得地' : '') + '），日主强弱分: ' + p.strength.score);
    lines.push('五行占比: ' + ['木', '火', '土', '金', '水'].map(function (w) { return w + ' ' + p.wuxing.percent[w] + '%'; }).join('，'));
    lines.push('喜用神（简化扶抑法）: 喜 ' + p.xiYong.primary + '、' + p.xiYong.secondary + (p.xiYong.avoid.length ? '；忌 ' + p.xiYong.avoid.join('、') : '') + '；此为简化规则结果，仅供参考');
    var cur = t.currentDayun;
    if (cur) lines.push('当前大运: ' + cur.ganZhi + '（' + cur.startYear + '-' + cur.endYear + ' 年，' + cur.startAge + '-' + cur.endAge + ' 岁，运干十神: ' + cur.shiShen + '）');
    else lines.push('当前处于起运前的小运阶段（' + p.startInfo + '）');
    lines.push('今年流年: ' + t.liuNian.ganZhi + '（对日主为 ' + t.liuNian.shiShen + '）');
    lines.push('今日: ' + t.dayGanZhi + '（对日主为 ' + t.dayShiShen + '，五行属 ' + t.dayWx + '）' + (t.relations.length ? '；' + t.relations.join('；') : ''));
    if (drawResult) {
      lines.push('【本次抽牌】' + (question ? '问题: ' + question : '未填写具体问题'));
      drawResult.cards.forEach(function (c, i) {
        var pos = drawResult.positions[i];
        lines.push((i + 1) + '. 位置「' + pos.name + '」: ' + c.name + (c.reversed ? '（逆位）' : '（正位）') +
          '。本页本地解读: ' + (c.reversed ? c.rev : c.up) + ' 给用户的建议: ' + c.advice);
      });
    } else {
      lines.push('【本次抽牌】用户今日尚未抽牌，请聚焦八字与当日运势。');
    }
    return lines.join('\n');
  }

  var SYSTEM_PROMPT = [
    '你是一位温和、克制、有文学气息的东方命理顾问，服务场景是个人博客的娱乐向「算运」页面。',
    '你会同时收到：用户的四柱八字与五行分析（由精确历法库计算）、当日干支、当前大运流年，以及可选的塔罗抽牌结果与本地牌义。',
    '写作要求：',
    '1. 用第二人称「你」，语气温柔、具体、不打官腔，像一位懂易经也懂塔罗的朋友在聊天。',
    '2. 把八字信息（日主强弱、喜用神、大运流年、今日十神）与塔罗牌面自然融合，指出牌面元素与五行喜用的呼应，但不要堆砌术语。',
    '3. 立场克制：多给视角与可执行的小建议，少下定论，绝不恐吓（不说凶灾疾病），不鼓励迷信依赖（强调这些是自我探索的镜子）。',
    '4. 输出为 3-5 个自然段，总长 300-500 字。第一段点出今天的整体基调（结合大运/流年/今日干支），若用户抽了牌，中间段落围绕牌阵位置展开，最后一段给一个「今晚可以做的具体小事」收尾。',
    '5. 禁止输出markdown标题符号，用纯文本段落，段落之间用空行分隔。'
  ].join('\n');

  /* 调用本机 admin 代理。onToken(chunk) 可选（用于打字机效果，代理暂为整段返回则一次回调） */
  function interpret(payload, onToken, onDone, onFail) {
    var ep = getEndpoint();
    fetch(ep + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(payload.profile, payload.today, payload.draw, payload.question) }
        ],
        temperature: 0.8,
        maxTokens: 1200
      })
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, data: d }; });
    }).then(function (res) {
      if (res.status === 200 && res.data.ok) {
        if (onToken) onToken(res.data.content);
        if (onDone) onDone(res.data.content);
      } else {
        var msg = (res.data && res.data.error) || ('HTTP ' + res.status);
        if (onFail) onFail(msg);
      }
    }).catch(function (e) {
      if (onFail) onFail(e.name === 'AbortError' ? '请求超时' : '无法连接本机后台（' + getEndpoint() + '）');
    });
  }

  root.FortuneLLM = {
    getEndpoint: getEndpoint,
    setEndpoint: setEndpoint,
    probe: probe,
    interpret: interpret,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    buildPrompt: buildPrompt
  };
})(window);
