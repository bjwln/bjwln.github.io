'use strict';
const fsp = require('fs/promises');
const path = require('path');

// 仓库根目录(admin/ 的上一级)
const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'source');
const POSTS = path.join(SOURCE, '_posts');
const DRAFTS = path.join(SOURCE, '_drafts');
const DATA = path.join(SOURCE, '_data');
const IMAGES = path.join(SOURCE, 'images');
const TRASH = path.join(ROOT, 'admin', 'data', 'trash');

// 校验 rel 拼接后仍位于 root 内,防止 ../ 路径穿越
function safeJoin(root, rel) {
  const abs = path.resolve(root, '.' + (rel ? '/' + rel : ''));
  const r = path.resolve(root);
  if (abs !== r && !abs.startsWith(r + path.sep)) {
    const err = new Error('非法路径: ' + rel);
    err.status = 400;
    throw err;
  }
  return abs;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

// 原子写:先写临时文件再 rename,避免写一半崩溃损坏文章
async function atomicWrite(file, content) {
  const tmp = file + '.tmp-' + Date.now();
  await fsp.writeFile(tmp, content, 'utf8');
  await fsp.rename(tmp, file);
}

async function pathExists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

// 去掉 frontmatter 与代码块后统计字数(中文按字,英文按词)
function wordCount(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.match(/[A-Za-z0-9][A-Za-z0-9'_-]*/g) || []).length;
  return cjk + latin;
}

function pad(n) { return String(n).padStart(2, '0'); }

// 本地时间 'YYYY-MM-DD HH:mm:ss'(与 Hexo 的 date 格式一致)
function fmtDate(d) {
  d = d || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 文件名清理:去掉 Windows 非法字符,保留中文
function sanitizeFilename(name) {
  return String(name || '').replace(/[\\/:*?"<>|\r\n]/g, '-').replace(/\s+/g, ' ').trim();
}

// 修复 multipart 上传文件名的 latin1 乱码(busboy 按 latin1 解码 UTF-8 文件名的问题)
// 特征:原串只含 latin1 扩展区字符,而按 latin1→utf8 重解码后出现中日韩文字
function fixMojibake(name) {
  const s = String(name || '');
  if (!/[\u0080-\u00ff]/.test(s) || /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(s)) return s;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  return /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(fixed) ? fixed : s;
}

// 标题 → 文章文件名(不含 .md)
function slugify(title) {
  let s = sanitizeFilename(title);
  if (!s) s = 'untitled';
  return s.slice(0, 80);
}

// 递归列出目录下所有文件,返回相对路径数组
async function walk(dir, base) {
  const out = [];
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(abs, base));
    else if (e.isFile()) out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}

// 统一的异步路由包装,把异常转成 JSON 错误响应
function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch(err => {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      res.status(status).json({ error: err.message || '服务器内部错误' });
    });
  };
}

module.exports = {
  ROOT, SOURCE, POSTS, DRAFTS, DATA, IMAGES, TRASH,
  safeJoin, ensureDir, atomicWrite, pathExists,
  wordCount, fmtDate, sanitizeFilename, fixMojibake, slugify, walk, wrap,
};
