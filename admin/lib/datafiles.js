'use strict';
const fsp = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');
const fm = require('./frontmatter');
const U = require('./util');

// source/_data 下的结构化数据文件编辑
// research.yml 的 timeline[].link 必须与文章 title 完全一致(research.pug 靠精确匹配),
// 因此这里内置断链校验,并把全部文章标题返回给前端做下拉选择

const RESEARCH = path.join(U.DATA, 'research.yml');
const BANGUMI = path.join(U.DATA, 'bangumi.yml');
const WIDGET = path.join(U.DATA, 'widget.yml');
// 摸鱼页「网址推荐」:JSON 文件放 source/data/(hexo 原样拷贝到 public,页面 JS 直接 fetch)
const MOYULINKS = path.join(U.ROOT, 'source', 'data', 'moyulinks.json');

async function loadYaml(file, fallback) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return yaml.load(raw, { schema: yaml.JSON_SCHEMA }) ?? fallback;
  } catch (e) {
    const err = new Error(path.basename(file) + ' 解析失败: ' + e.message);
    err.status = 422;
    throw err;
  }
}

async function saveYaml(file, parsed) {
  await U.ensureDir(U.DATA);
  await U.atomicWrite(file, yaml.dump(parsed, fm.DUMP_OPTS));
}

async function postTitles() {
  const posts = await require('./posts').listPosts('post');
  return posts.map(p => p.title);
}

function validateResearch(parsed, titles) {
  const warnings = [];
  const set = new Set(titles);
  const plans = Array.isArray(parsed?.plans) ? parsed.plans : [];
  plans.forEach((plan, pi) => {
    const tl = Array.isArray(plan.timeline) ? plan.timeline : [];
    tl.forEach((t, ti) => {
      if (t.link && !set.has(t.link)) {
        warnings.push(`plans[${pi}](${plan.title || plan.key || pi}) timeline[${ti}]「${t.title || t.date || ti}」的 link「${t.link}」没有匹配的文章标题`);
      }
    });
  });
  return warnings;
}

async function getResearch() {
  const parsed = await loadYaml(RESEARCH, { plans: [] });
  const titles = await postTitles();
  return { parsed, titles, warnings: validateResearch(parsed, titles) };
}

async function putResearch(parsed) {
  if (!parsed || !Array.isArray(parsed.plans)) { const e = new Error('数据格式错误:缺少 plans 数组'); e.status = 400; throw e; }
  const titles = await postTitles();
  const warnings = validateResearch(parsed, titles);
  await saveYaml(RESEARCH, parsed);
  return { ok: true, warnings };
}

async function getBangumi() {
  const parsed = await loadYaml(BANGUMI, { items: [] });
  if (!Array.isArray(parsed.items)) parsed.items = [];
  return { parsed, warnings: [] };
}

async function putBangumi(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) { const e = new Error('数据格式错误:缺少 items 数组'); e.status = 400; throw e; }
  for (const it of parsed.items) {
    if (!it.title) { const e = new Error('每个条目必须有 title'); e.status = 400; throw e; }
  }
  await saveYaml(BANGUMI, parsed);
  return { ok: true };
}

// widget.yml 内嵌 html/script,结构复杂,只提供源码编辑(写入前校验 YAML 合法)
async function getWidget() {
  try {
    return { raw: await fsp.readFile(WIDGET, 'utf8'), parseError: null };
  } catch { return { raw: '', parseError: null }; }
}

async function putWidget(raw) {
  if (typeof raw !== 'string') { const e = new Error('内容必须为字符串'); e.status = 400; throw e; }
  try { yaml.load(raw, { schema: yaml.JSON_SCHEMA }); }
  catch (e) { const err = new Error('YAML 解析失败,未保存: ' + e.message); err.status = 422; throw err; }
  await U.atomicWrite(WIDGET, raw);
  return { ok: true };
}

// 摸鱼页网址推荐(JSON):name/url/desc 三字段,前端 fetch 渲染
async function getMoyuLinks() {
  try {
    const parsed = JSON.parse(await fsp.readFile(MOYULINKS, 'utf8'));
    if (!Array.isArray(parsed.links)) parsed.links = [];
    return { parsed };
  } catch {
    return { parsed: { links: [] } };
  }
}

async function putMoyuLinks(parsed) {
  if (!parsed || !Array.isArray(parsed.links)) { const e = new Error('数据格式错误:缺少 links 数组'); e.status = 400; throw e; }
  for (const [i, it] of parsed.links.entries()) {
    if (!it.name || !it.url) { const e = new Error(`第 ${i + 1} 条的名称和网址不能为空`); e.status = 400; throw e; }
    if (!/^https?:\/\//i.test(it.url)) { const e = new Error(`第 ${i + 1} 条「${it.name}」的网址必须以 http(s):// 开头`); e.status = 400; throw e; }
  }
  await U.ensureDir(path.dirname(MOYULINKS));
  await U.atomicWrite(MOYULINKS, JSON.stringify(parsed, null, 2) + '\n');
  return { ok: true, count: parsed.links.length };
}

module.exports = { getResearch, putResearch, getBangumi, putBangumi, getWidget, putWidget, getMoyuLinks, putMoyuLinks };
