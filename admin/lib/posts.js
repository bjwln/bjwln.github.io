'use strict';
const fsp = require('fs/promises');
const path = require('path');
const fm = require('./frontmatter');
const U = require('./util');

// kind: 'post' → source/_posts, 'draft' → source/_drafts
function baseDir(kind) {
  if (kind === 'draft') return U.DRAFTS;
  return U.POSTS;
}

function mdPath(kind, slug) {
  const name = U.sanitizeFilename(slug);
  if (!name) { const e = new Error('文件名为空'); e.status = 400; throw e; }
  return path.join(baseDir(kind), name + '.md');
}

// frontmatter 提取成列表展示用的摘要字段
function summarize(slug, data, raw, mtime) {
  const body = raw.split(/^---[\s\S]*?---\r?\n/)[1] || raw;
  const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
  const cats = Array.isArray(data.categories) ? data.categories : (data.categories ? [data.categories] : []);
  return {
    slug,
    title: data.title || slug,
    date: data.date || '',
    tags,
    categories: cats,
    cover: data.cover || '',
    research: data.research || '',
    research_order: data.research_order,
    sticky: data.sticky,
    mathjax: !!data.mathjax,
    words: U.wordCount(body),
    mtime,
    parseError: !!data.__parseError,
  };
}

async function listPosts(kind) {
  const dir = baseDir(kind);
  await U.ensureDir(dir);
  const files = (await fsp.readdir(dir)).filter(f => f.toLowerCase().endsWith('.md'));
  const list = [];
  for (const f of files) {
    const abs = path.join(dir, f);
    const st = await fsp.stat(abs);
    if (!st.isFile()) continue;
    const raw = await fsp.readFile(abs, 'utf8');
    const { data } = fm.trySplit(raw);
    list.push(summarize(f.slice(0, -3), data, raw, st.mtimeMs));
  }
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return list;
}

async function getPost(kind, slug) {
  const abs = mdPath(kind, slug);
  if (!(await U.pathExists(abs))) { const e = new Error('文章不存在'); e.status = 404; throw e; }
  const raw = await fsp.readFile(abs, 'utf8');
  const { data, body } = fm.trySplit(raw);
  const assetDir = path.join(baseDir(kind), slug);
  let assets = [];
  try {
    assets = (await fsp.readdir(assetDir)).filter(f => !f.startsWith('.'));
  } catch { /* 资源文件夹不存在 */ }
  return {
    slug, kind, file: slug + '.md',
    dir: path.relative(U.ROOT, baseDir(kind)).split(path.sep).join('/'),
    data, body, assets, parseError: !!data.__parseError,
  };
}

async function createPost({ title, tags, categories, isDraft }) {
  const kind = isDraft ? 'draft' : 'post';
  const dir = baseDir(kind);
  await U.ensureDir(dir);
  let slug = U.slugify(title);
  if (!(await U.pathExists(path.join(dir, slug + '.md')))) {
    // 顺便检查纯小写/大小写变体,Windows 文件系统大小写不敏感
    const lower = slug.toLowerCase();
    const clash = (await fsp.readdir(dir)).some(f => f.toLowerCase() === lower + '.md');
    if (clash) slug = slug + '-' + Date.now().toString(36);
  } else {
    slug = slug + '-' + Date.now().toString(36);
  }
  const data = { title: String(title || '无标题'), date: U.fmtDate() };
  if (Array.isArray(tags) && tags.length) data.tags = tags.map(t => String(t).trim()).filter(Boolean);
  if (categories) data.categories = categories;
  const raw = fm.join(data, '\n');
  await U.atomicWrite(path.join(dir, slug + '.md'), raw);
  await U.ensureDir(path.join(dir, slug)); // 同名资源文件夹
  return { slug, kind };
}

// 保存:data 为完整 frontmatter 对象(未知字段由前端原样带回),body 为正文
async function savePost(kind, slug, data, body) {
  if (!data || typeof data !== 'object') { const e = new Error('frontmatter 不能为空'); e.status = 400; throw e; }
  if (typeof body !== 'string') body = '';
  if (data.__parseError) delete data.__parseError;
  const raw = fm.join(data, body);
  await U.atomicWrite(mdPath(kind, slug), raw);
  await U.ensureDir(path.join(baseDir(kind), slug));
  return { ok: true };
}

// 草稿发布:_drafts → _posts(md + 资源文件夹一起移动)
async function publishDraft(slug) {
  const srcMd = mdPath('draft', slug);
  const dstMd = mdPath('post', slug);
  if (!(await U.pathExists(srcMd))) { const e = new Error('草稿不存在'); e.status = 404; throw e; }
  if (await U.pathExists(dstMd)) { const e = new Error('_posts 中已存在同名文章,无法发布'); e.status = 409; throw e; }
  await fsp.rename(srcMd, dstMd);
  const srcAsset = path.join(U.DRAFTS, slug);
  if (await U.pathExists(srcAsset)) {
    await fsp.rename(srcAsset, path.join(U.POSTS, slug)).catch(() => {});
  }
  return { ok: true, slug };
}

// 上传图片到文章资源文件夹;同名自动加时间戳前缀
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif', '.pdf']);

async function uploadAsset(kind, slug, files) {
  if (!files || !files.length) return { saved: [] };
  const dir = path.join(baseDir(kind), slug);
  await U.ensureDir(dir);
  const saved = [];
  for (const f of files) {
    const ext = path.extname(f.originalname || '').toLowerCase();
    if (!IMG_EXT.has(ext)) { const e = new Error('不支持的文件类型: ' + ext); e.status = 400; throw e; }
    let name = U.sanitizeFilename(path.basename(U.fixMojibake(f.originalname || 'image' + ext), ext)) + ext;
    if (await U.pathExists(path.join(dir, name))) name = Date.now().toString(36) + '-' + name;
    await fsp.writeFile(path.join(dir, name), f.buffer);
    saved.push(name);
  }
  return { saved };
}

async function deleteAsset(kind, slug, name) {
  const abs = U.safeJoin(path.join(baseDir(kind), slug), name);
  await fsp.unlink(abs);
  return { ok: true };
}

module.exports = { baseDir, mdPath, listPosts, getPost, createPost, savePost, publishDraft, uploadAsset, deleteAsset };
