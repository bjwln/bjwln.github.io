'use strict';
const fsp = require('fs/promises');
const path = require('path');
const U = require('./util');
const P = require('./posts');

// 媒体库:统一管理 source/images/ 与各文章的资源文件夹
// relPath 约定:'images/xxx.png' | 'images/bangumi/x.jpg' | 'post/<slug>/<文件>' | 'draft/<slug>/<文件>'
// slug 支持子文件夹(如 research/EvoMDT),md 与资源文件夹同目录同名,
// 因此 post/ 后面的段数不固定,按候选切分解析(最长 slug 优先,要求对应 md 存在)

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif', '.pdf']);

// 把 post/draft 之后的段切成 [slug, 文件相对路径]:从最长 slug 往回试,要求 <base>/<slug>.md 存在
async function splitPostRel(base, segs) {
  for (let k = segs.length - 1; k >= 1; k--) {
    const slug = segs.slice(0, k).join('/');
    const file = segs.slice(k).join('/');
    if (!slug || !file) continue;
    if (await U.pathExists(path.join(base, ...slug.split('/')) + '.md')) {
      return { slug, file };
    }
  }
  const e = new Error('文章不存在或非法媒体路径');
  e.status = 404;
  throw e;
}

async function resolveRel(rel) {
  const parts = String(rel || '').split('/');
  if (parts.some(seg => seg === '..' || seg === '.' || seg === '')) {
    const e = new Error('非法媒体路径'); e.status = 400; throw e;
  }
  const kind = parts[0];
  if (kind === 'images') {
    return { abs: U.safeJoin(U.IMAGES, parts.slice(1).join('/')), url: '/' + rel };
  }
  if (kind === 'post' || kind === 'draft') {
    const base = kind === 'draft' ? U.DRAFTS : U.POSTS;
    const { slug, file } = await splitPostRel(base, parts.slice(1));
    const { assetDirOf } = P;
    const abs = U.safeJoin(assetDirOf(kind, slug), file);
    return { abs, slug, url: `/asset/${kind}/${slug.split('/').map(encodeURIComponent).join('/')}/${file.split('/').map(encodeURIComponent).join('/')}` };
  }
  if (kind === 'page') {
    // 页面资源:/asset/page/<页面目录>/<文件>,限定 source/ 下非 _ 开头目录内的图片
    const rel = parts.slice(1).join('/');
    if (!rel) { const e = new Error('非法媒体路径'); e.status = 400; throw e; }
    if (rel.split('/').some(seg => seg.startsWith('_') || seg.startsWith('.'))) {
      const e = new Error('非法媒体路径'); e.status = 400; throw e;
    }
    const abs = U.safeJoin(U.SOURCE, rel);
    if (!IMG_EXT.has(path.extname(abs).toLowerCase())) { const e = new Error('仅支持图片/PDF'); e.status = 400; throw e; }
    return { abs, url: '/asset/' + rel.split('/').map(encodeURIComponent).join('/') };
  }
  const e = new Error('非法媒体路径'); e.status = 400; throw e;
}

async function listDir(title, kind, slug, abs) {
  const rel = kind === 'images' ? 'images' : kind + '/' + slug;
  const files = (await U.walk(abs, abs)).filter(f => IMG_EXT.has(path.extname(f).toLowerCase()));
  return {
    key: rel, title, kind, slug: slug || '',
    files: files.map(f => ({
      name: path.posix.basename(f),
      path: rel + '/' + f,
      size: 0, // 尺寸按需补
      url: kind === 'images' ? '/asset/images/' + f.split('/').map(encodeURIComponent).join('/') : `/asset/${kind}/${slug.split('/').map(encodeURIComponent).join('/')}/${f.split('/').map(encodeURIComponent).join('/')}`,
      ref: kind === 'images' ? '/images/' + f : f, // 复制用的引用:图片用站内路径,文章资源用相对文件名(fix-post-images.js 兼容)
    })),
  };
}

async function tree() {
  await U.ensureDir(U.IMAGES);
  const groups = [];
  groups.push(await listDir('站点图片 images', 'images', '', U.IMAGES));
  // 文章/草稿的资源文件夹(递归找 md,每个 md 一个分组)
  for (const [kind, base] of [['post', U.POSTS], ['draft', U.DRAFTS]]) {
    await U.ensureDir(base);
    const mds = (await U.walk(base, base)).filter(f => f.toLowerCase().endsWith('.md'));
    for (const rel of mds) {
      const slug = rel.slice(0, -3);
      const assetDir = P.assetDirOf(kind, slug);
      const label = kind === 'draft' ? '草稿:' : '';
      groups.push(await listDir(label + slug, kind, slug, assetDir));
    }
  }
  return { groups };
}

async function upload(target, files) {
  // target: 'images' | 'bangumi' | 'post:<slug>' | 'draft:<slug>'(slug 可含子文件夹)
  if (!files || !files.length) return { saved: [] };
  let dir, prefix;
  if (target === 'images' || target === 'bangumi') {
    dir = target === 'bangumi' ? path.join(U.IMAGES, 'bangumi') : U.IMAGES;
    prefix = target === 'bangumi' ? 'images/bangumi/' : 'images/';
  } else if (target.startsWith('post:') || target.startsWith('draft:')) {
    const kind = target.slice(0, target.indexOf(':'));
    const slug = P.sanitizeSlug(target.slice(target.indexOf(':') + 1));
    dir = P.assetDirOf(kind, slug);
    prefix = kind + '/' + slug + '/';
  } else { const e = new Error('非法上传目标'); e.status = 400; throw e; }
  await U.ensureDir(dir);
  const saved = [];
  for (const f of files) {
    const ext = path.extname(f.originalname || '').toLowerCase();
    if (!IMG_EXT.has(ext)) { const e = new Error('不支持的文件类型: ' + ext); e.status = 400; throw e; }
    let name = U.sanitizeFilename(path.basename(U.fixMojibake(f.originalname || 'image' + ext), ext)) + ext;
    if (await U.pathExists(path.join(dir, name))) name = Date.now().toString(36) + '-' + name;
    await fsp.writeFile(path.join(dir, name), f.buffer);
    saved.push({ name, path: prefix + name });
  }
  return { saved };
}

async function remove(rel) {
  const { abs } = await resolveRel(rel);
  await fsp.unlink(abs);
  return { ok: true };
}

// /asset/... 静态服务用:把 URL 段映射回磁盘文件
async function serveAsset(req, res) {
  try {
    const parts = req.path.split('/').filter(Boolean); // images/xxx | post/<slug...>/xxx | draft/<slug...>/xxx
    const { abs } = await resolveRel(decodeURIComponent(parts.join('/')));
    res.sendFile(abs);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { tree, upload, remove, serveAsset, resolveRel };
