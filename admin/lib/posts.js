'use strict';
const fsp = require('fs/promises');
const path = require('path');
const fm = require('./frontmatter');
const U = require('./util');

// kind: 'post' → source/_posts, 'draft' → source/_drafts
// slug 现在支持子文件夹:相对 baseDir 的路径(不含 .md),如 'research/EvoMDT'、'pizza'
// 约定:资源文件夹与 md 同目录同名( Hexo post_asset_folder 规则),
//   即 md = <base>/<slug>.md 时资源目录 = <base>/<slug>/ (slug 含子文件夹)

function baseDir(kind) {
  if (kind === 'draft') return U.DRAFTS;
  return U.POSTS;
}

// 校验/规范化 slug:按 '/' 分段清理,拒绝路径穿越与隐藏目录
function sanitizeSlug(slug) {
  const raw = String(slug || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!raw) { const e = new Error('文件名为空'); e.status = 400; throw e; }
  const segs = raw.split('/').map(s => U.sanitizeFilename(s));
  for (const s of segs) {
    if (!s || s.startsWith('.') || s.startsWith('_')) {
      const e = new Error('非法文章路径: ' + slug); e.status = 400; throw e;
    }
  }
  return segs.join('/');
}

// 校验存放文件夹(可为空 = 根目录),返回 'a/b' 形式或 ''
function sanitizeFolder(folder) {
  const raw = String(folder || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!raw) return '';
  const segs = raw.split('/').map(s => U.sanitizeFilename(s));
  for (const s of segs) {
    if (!s || s.startsWith('.') || s.startsWith('_')) {
      const e = new Error('非法文件夹名: ' + folder); e.status = 400; throw e;
    }
  }
  return segs.join('/');
}

function mdPath(kind, slug) {
  const rel = sanitizeSlug(slug);
  return path.join(baseDir(kind), ...rel.split('/')) + '.md';
}

// 资源文件夹 = md 同目录下与文件名(不含扩展名)同名的文件夹
function assetDirOf(kind, slug) {
  const abs = mdPath(kind, slug);
  return path.join(path.dirname(abs), path.basename(abs, '.md'));
}

// frontmatter 提取成列表展示用的摘要字段
function summarize(slug, data, raw, mtime) {
  const body = raw.split(/^---[\s\S]*?---\r?\n/)[1] || raw;
  const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
  const cats = Array.isArray(data.categories) ? data.categories : (data.categories ? [data.categories] : []);
  const segs = String(slug).split('/');
  return {
    slug,
    folder: segs.length > 1 ? segs.slice(0, -1).join('/') : '',
    name: segs[segs.length - 1],
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

// 递归列出文章(md 可在任意子文件夹)
async function listPosts(kind) {
  const dir = baseDir(kind);
  await U.ensureDir(dir);
  const files = (await U.walk(dir, dir)).filter(f => f.toLowerCase().endsWith('.md'));
  const list = [];
  for (const rel of files) {
    const abs = path.join(dir, rel);
    const st = await fsp.stat(abs);
    if (!st.isFile()) continue;
    const raw = await fsp.readFile(abs, 'utf8');
    const { data } = fm.trySplit(raw);
    list.push(summarize(rel.slice(0, -3), data, raw, st.mtimeMs));
  }
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return list;
}

// 列出可用的存放文件夹(一级子目录,排除资源文件夹 = 与根目录某 md 同名的目录)
async function listFolders(kind) {
  const dir = baseDir(kind);
  await U.ensureDir(dir);
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const rootMds = new Set(
    entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map(e => e.name.slice(0, -3).toLowerCase()));
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('_')) continue;
    if (rootMds.has(e.name.toLowerCase())) continue; // 这是文章的资源文件夹,不是分类文件夹
    out.push(e.name);
  }
  return out.sort();
}

async function getPost(kind, slug) {
  const abs = mdPath(kind, slug);
  if (!(await U.pathExists(abs))) { const e = new Error('文章不存在'); e.status = 404; throw e; }
  const raw = await fsp.readFile(abs, 'utf8');
  const { data, body } = fm.trySplit(raw);
  const assetDir = assetDirOf(kind, slug);
  let assets = [];
  try {
    assets = (await U.walk(assetDir, assetDir)).filter(f => !f.split('/').pop().startsWith('.'));
  } catch { /* 资源文件夹不存在 */ }
  return {
    slug, kind, file: slug.split('/').pop() + '.md',
    dir: path.relative(U.ROOT, path.dirname(abs)).split(path.sep).join('/'),
    data, body, assets, parseError: !!data.__parseError,
  };
}

async function createPost({ title, tags, categories, isDraft, folder }) {
  const kind = isDraft ? 'draft' : 'post';
  const dirName = sanitizeFolder(folder); // '' = 根目录
  const dir = path.join(baseDir(kind), ...(dirName ? dirName.split('/') : []));
  await U.ensureDir(dir);
  let slug = U.slugify(title);
  const exists = async name => {
    const files = await fsp.readdir(dir);
    const lower = name.toLowerCase();
    return files.some(f => f.toLowerCase() === lower + '.md');
  };
  if (await exists(slug)) slug = slug + '-' + Date.now().toString(36);
  const data = { title: String(title || '无标题'), date: U.fmtDate() };
  if (Array.isArray(tags) && tags.length) data.tags = tags.map(t => String(t).trim()).filter(Boolean);
  if (categories) data.categories = categories;
  const rel = (dirName ? dirName + '/' : '') + slug;
  const raw = fm.join(data, '\n');
  await U.atomicWrite(path.join(dir, slug + '.md'), raw);
  await U.ensureDir(path.join(dir, slug)); // 同名资源文件夹
  return { slug: rel, kind, folder: dirName };
}

// 保存:data 为完整 frontmatter 对象(未知字段由前端原样带回),body 为正文
async function savePost(kind, slug, data, body) {
  if (!data || typeof data !== 'object') { const e = new Error('frontmatter 不能为空'); e.status = 400; throw e; }
  if (typeof body !== 'string') body = '';
  if (data.__parseError) delete data.__parseError;
  const raw = fm.join(data, body);
  await U.atomicWrite(mdPath(kind, slug), raw);
  await U.ensureDir(assetDirOf(kind, slug));
  return { ok: true };
}

// 移动文章到另一个文件夹(md + 资源文件夹一起移动),slug 随之变为 folder/stem
async function movePost(kind, slug, folder) {
  const srcMd = mdPath(kind, slug);
  if (!(await U.pathExists(srcMd))) { const e = new Error('文章不存在'); e.status = 404; throw e; }
  const dstFolder = sanitizeFolder(folder);
  const stem = path.basename(srcMd, '.md');
  const dstDir = path.join(baseDir(kind), ...(dstFolder ? dstFolder.split('/') : []));
  const dstMd = path.join(dstDir, stem + '.md');
  if (path.resolve(dstMd) === path.resolve(srcMd)) return { ok: true, slug };
  if (await U.pathExists(dstMd)) { const e = new Error('目标位置已存在同名文章'); e.status = 409; throw e; }
  await U.ensureDir(dstDir);
  await fsp.rename(srcMd, dstMd);
  const srcAsset = assetDirOf(kind, slug);
  if (await U.pathExists(srcAsset)) {
    await fsp.rename(srcAsset, path.join(dstDir, stem)).catch(() => {});
  }
  return { ok: true, slug: (dstFolder ? dstFolder + '/' : '') + stem, folder: dstFolder };
}

// 草稿发布:_drafts → _posts(md + 资源文件夹一起移动,子文件夹原样保留)
async function publishDraft(slug) {
  const srcMd = mdPath('draft', slug);
  if (!(await U.pathExists(srcMd))) { const e = new Error('草稿不存在'); e.status = 404; throw e; }
  const stem = path.basename(srcMd, '.md');
  const relFolder = path.dirname(path.relative(baseDir('draft'), srcMd)).split(path.sep).join('/');
  const dstDir = path.join(baseDir('post'), ...(relFolder === '.' ? [] : relFolder.split('/')));
  const dstMd = path.join(dstDir, stem + '.md');
  if (await U.pathExists(dstMd)) { const e = new Error('_posts 中已存在同名文章,无法发布'); e.status = 409; throw e; }
  await U.ensureDir(dstDir);
  await fsp.rename(srcMd, dstMd);
  const srcAsset = assetDirOf('draft', slug);
  if (await U.pathExists(srcAsset)) {
    await fsp.rename(srcAsset, path.join(dstDir, stem)).catch(() => {});
  }
  return { ok: true, slug: (relFolder === '.' ? '' : relFolder + '/') + stem };
}

// 上传图片到文章资源文件夹;同名自动加时间戳前缀
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif', '.pdf']);

async function uploadAsset(kind, slug, files) {
  if (!files || !files.length) return { saved: [] };
  const dir = assetDirOf(kind, slug);
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
  const abs = U.safeJoin(assetDirOf(kind, slug), name);
  await fsp.unlink(abs);
  return { ok: true };
}

module.exports = {
  baseDir, mdPath, assetDirOf, sanitizeSlug, sanitizeFolder,
  listPosts, listFolders, getPost, createPost, savePost, movePost, publishDraft, uploadAsset, deleteAsset,
};
