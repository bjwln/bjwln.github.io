'use strict';
const fsp = require('fs/promises');
const path = require('path');
const fm = require('./frontmatter');
const U = require('./util');

// 自定义页面管理:扫描 source/ 下的 index.md(排除 _posts/_drafts/_data)
// 这些页面依赖主题里的 type 模板(research/bangumi 等),所以只提供编辑,不提供创建/删除

const SKIP = new Set(['_posts', '_drafts', '_data']);

async function scanPages() {
  const out = [];
  async function scan(rel, depth) {
    if (depth > 3) return;
    const abs = path.join(U.SOURCE, rel);
    let entries;
    try { entries = await fsp.readdir(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      const childRel = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        await scan(childRel, depth + 1);
      } else if (e.name === 'index.md') {
        const raw = await fsp.readFile(path.join(abs, e.name), 'utf8');
        const { data, body } = fm.trySplit(raw);
        out.push({
          id: childRel,
          title: data.title || childRel,
          type: data.type || '',
          date: data.date || '',
          words: U.wordCount(body),
          parseError: !!data.__parseError,
        });
      }
    }
  }
  await scan('', 0);
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function pagePath(id) {
  if (!id.endsWith('/index.md') || id.includes('..')) { const e = new Error('非法页面路径'); e.status = 400; throw e; }
  return U.safeJoin(U.SOURCE, id);
}

async function getPage(id) {
  const abs = pagePath(id);
  if (!(await U.pathExists(abs))) { const e = new Error('页面不存在'); e.status = 404; throw e; }
  const raw = await fsp.readFile(abs, 'utf8');
  const { data, body } = fm.trySplit(raw);
  return { id, data, body, parseError: !!data.__parseError };
}

async function savePage(id, data, body) {
  if (!data || typeof data !== 'object') { const e = new Error('frontmatter 不能为空'); e.status = 400; throw e; }
  if (data.__parseError) delete data.__parseError;
  await U.atomicWrite(pagePath(id), fm.join(data, body || ''));
  return { ok: true };
}

module.exports = { scanPages, getPage, savePage };
