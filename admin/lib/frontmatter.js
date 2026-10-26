'use strict';
const yaml = require('js-yaml');

// 用 JSON_SCHEMA 解析:日期保持字符串('2026-10-12 17:14:00' 不会被转成 Date),
// 这样 dump 回去时格式与原文件一致,Hexo 端无感知。
const LOAD_OPTS = { schema: yaml.JSON_SCHEMA };
const DUMP_OPTS = { schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true, skipInvalid: true };

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?([\s\S]*)$/;

// 把 markdown 原文拆成 { data: frontmatter对象, body: 正文 }
function split(raw) {
  const m = FM_RE.exec(raw || '');
  if (!m) return { data: {}, body: raw || '' };
  let data;
  try {
    data = yaml.load(m[1], LOAD_OPTS);
  } catch (e) {
    const err = new Error('frontmatter YAML 解析失败: ' + e.message);
    err.status = 422;
    err.parseError = true;
    throw err;
  }
  return { data: (data && typeof data === 'object') ? data : {}, body: m[3] || '' };
}

// 把 frontmatter 对象 + 正文拼回 markdown 原文
function join(data, body) {
  const y = yaml.dump(data || {}, DUMP_OPTS);
  return '---\n' + y + '---\n' + (body || '');
}

// 仅解析 frontmatter(列表页用,正文原样返回不解析)
function trySplit(raw) {
  try { return split(raw); }
  catch (e) { return { data: { __parseError: e.message }, body: raw }; }
}

function dump(data) {
  return yaml.dump(data || {}, DUMP_OPTS);
}

module.exports = { split, join, trySplit, dump, DUMP_OPTS };
