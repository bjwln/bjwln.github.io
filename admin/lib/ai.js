'use strict';
// ---------- AI(LLM) 代理：key 只存本机 settings.json，对外只暴露转发 ----------
// 兼容 OpenAI Chat Completions 协议（baseUrl 形如 https://api.xxx.com/v1）
const settings = require('./settings');

const DEFAULTS_AI = { baseUrl: '', apiKey: '', model: '', temperature: 0.8, dailyLimit: 60 };

function getAi() {
  return settings.load().then(s => ({ ...DEFAULTS_AI, ...(s.ai || {}) }));
}

// 每日调用计数（内存计数，重启清零，够本机自用）
const counter = { date: new Date().toDateString(), count: 0 };
function countToday() {
  const today = new Date().toDateString();
  if (counter.date !== today) { counter.date = today; counter.count = 0; }
  return counter.count;
}

async function callLLM({ messages, temperature, maxTokens, timeoutMs }) {
  const ai = await getAi();
  if (!ai.baseUrl || !ai.apiKey || !ai.model) {
    const err = new Error('AI 未配置完整（需要 baseUrl / apiKey / model），请到管理端「设置 → AI 深度解读」填写');
    err.status = 400;
    throw err;
  }
  if (countToday() >= ai.dailyLimit) {
    const err = new Error('已达今日调用上限（' + ai.dailyLimit + ' 次），明日自动恢复，可在设置中调整');
    err.status = 429;
    throw err;
  }
  const base = ai.baseUrl.replace(/\/+$/, '');
  const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 120000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.apiKey },
      body: JSON.stringify({
        model: ai.model,
        messages,
        temperature: typeof temperature === 'number' ? temperature : ai.temperature,
        max_tokens: maxTokens || 1200,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (data.error && (data.error.message || data.error.code)) || 'HTTP ' + resp.status;
      throw Object.assign(new Error('上游接口返回错误: ' + msg), { status: resp.status === 401 ? 401 : 502 });
    }
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw Object.assign(new Error('上游返回内容为空'), { status: 502 });
    counter.count += 1;
    return { content, usage: data.usage || null };
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('上游请求超时'), { status: 504 });
    if (e && (e.cause || e.message === 'fetch failed')) {
      throw Object.assign(new Error('无法连接上游地址(' + url + ')，请检查 Base URL 是否正确、网络是否可达'), { status: 502 });
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 测试连接：发一条最小消息
async function test() {
  const r = await callLLM({ messages: [{ role: 'user', content: '请只回复两个字：连通' }], maxTokens: 8, timeoutMs: 30000 });
  return { reply: r.content };
}

async function status() {
  const ai = await getAi();
  return {
    enabled: !!(ai.baseUrl && ai.apiKey && ai.model),
    model: ai.model,
    baseUrl: ai.baseUrl,
    usedToday: countToday(),
    dailyLimit: ai.dailyLimit,
    // 绝不返回 apiKey 本体
  };
}

module.exports = {
  getAi,
  status,
  chat(messages, opts) {
    return callLLM({ messages, ...opts });
  },
  test,
};
