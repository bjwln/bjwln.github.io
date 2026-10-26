'use strict';
const fsp = require('fs/promises');
const path = require('path');
const fm = require('./frontmatter');
const U = require('./util');

// 回收站:admin/data/trash/<id>/ 下保存 post.md + asset/(原资源文件夹)+ manifest.json
// 删除是"移动"而非真删,可随时恢复

async function trashDir(id) {
  if (!/^[\w\u4e00-\u9fff-]+$/i.test(id)) { const e = new Error('非法 id'); e.status = 400; throw e; }
  return path.join(U.TRASH, id);
}

async function moveToTrash(kind, slug) {
  const { baseDir, mdPath } = require('./posts');
  const srcMd = mdPath(kind, slug);
  if (!(await U.pathExists(srcMd))) { const e = new Error('文章不存在'); e.status = 404; throw e; }
  await U.ensureDir(U.TRASH);
  let id = Date.now().toString(36) + '-' + slug.replace(/[^\w\u4e00-\u9fff-]+/g, '').slice(0, 40);
  while (await U.pathExists(path.join(U.TRASH, id))) id += 'x';
  const dst = path.join(U.TRASH, id);
  await fsp.mkdir(dst, { recursive: true });

  const raw = await fsp.readFile(srcMd, 'utf8');
  const { data } = fm.trySplit(raw);
  const srcAsset = path.join(baseDir(kind), slug);
  const hasAsset = await U.pathExists(srcAsset);
  if (hasAsset) await fsp.rename(srcAsset, path.join(dst, 'asset'));
  await fsp.rename(srcMd, path.join(dst, 'post.md'));
  await U.atomicWrite(path.join(dst, 'manifest.json'), JSON.stringify({
    id, kind, slug, title: data.title || slug, hasAsset, deletedAt: U.fmtDate(),
  }, null, 2));
  return { ok: true, id };
}

async function listTrash() {
  let entries;
  try { entries = await fsp.readdir(U.TRASH); } catch { return []; }
  const out = [];
  for (const id of entries) {
    try {
      const mf = JSON.parse(await fsp.readFile(path.join(U.TRASH, id, 'manifest.json'), 'utf8'));
      out.push(mf);
    } catch { /* 跳过损坏条目 */ }
  }
  out.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  return out;
}

async function restore(id) {
  const dir = await trashDir(id);
  const mf = JSON.parse(await fsp.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  const { baseDir } = require('./posts');
  const dstMd = path.join(baseDir(mf.kind), mf.slug + '.md');
  if (await U.pathExists(dstMd)) { const e = new Error('原位置已存在同名文件,无法恢复'); e.status = 409; throw e; }
  await fsp.rename(path.join(dir, 'post.md'), dstMd);
  if (mf.hasAsset) {
    await fsp.rename(path.join(dir, 'asset'), path.join(baseDir(mf.kind), mf.slug)).catch(() => {});
  }
  await fsp.rm(dir, { recursive: true, force: true });
  return { ok: true };
}

// 彻底删除
async function purge(id) {
  const dir = await trashDir(id);
  await fsp.rm(dir, { recursive: true, force: true });
  return { ok: true };
}

module.exports = { moveToTrash, listTrash, restore, purge };
