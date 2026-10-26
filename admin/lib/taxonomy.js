'use strict';
const fsp = require('fs/promises');
const path = require('path');
const fm = require('./frontmatter');
const U = require('./util');

// 标签/分类:聚合视图 + 跨文章批量重命名
// categories 在现有文章里有标量('Cooking')和数组两种写法,重命名时保持原格式

function toArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

async function summary() {
  const posts = await require('./posts').listPosts('post');
  const tags = new Map(), cats = new Map();
  const bump = (map, name) => map.set(name, (map.get(name) || 0) + 1);
  for (const p of posts) {
    p.tags.forEach(t => bump(tags, t));
    p.categories.forEach(c => bump(cats, c));
  }
  const fmt = m => [...m.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
  return { tags: fmt(tags), categories: fmt(cats) };
}

// kind: 'tags' | 'categories';重命名所有文章(含草稿)中的对应字段
async function rename(kind, from, to) {
  if (!from || !to) { const e = new Error('from/to 不能为空'); e.status = 400; throw e; }
  if (from === to) return { changed: 0 };
  const changedFiles = [];
  for (const base of [U.POSTS, U.DRAFTS]) {
    let files = [];
    try { files = (await fsp.readdir(base)).filter(f => f.toLowerCase().endsWith('.md')); } catch { continue; }
    for (const f of files) {
      const abs = path.join(base, f);
      const raw = await fsp.readFile(abs, 'utf8');
      const { data, body } = fm.trySplit(raw);
      if (data.__parseError || !data[kind]) continue;
      let changed = false;
      if (Array.isArray(data[kind])) {
        data[kind] = data[kind].map(v => {
          if (v === from) { changed = true; return to; }
          return v;
        });
      } else if (data[kind] === from) {
        data[kind] = to; // 保持标量格式
        changed = true;
      }
      if (changed) {
        await U.atomicWrite(abs, fm.join(data, body));
        changedFiles.push(f);
      }
    }
  }
  return { changed: changedFiles.length, files: changedFiles };
}

module.exports = { summary, rename };
