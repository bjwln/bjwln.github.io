'use strict';
const fsp = require('fs/promises');
const path = require('path');
const U = require('./util');

// 设置存 admin/data/settings.json(gitignore,不会进仓库)
const FILE = path.join(U.ROOT, 'admin', 'data', 'settings.json');

const DEFAULTS = {
  cfBaseUrl: 'https://tysweb.pages.dev',  // Cloudflare Pages 站点(评论/统计 API 所在)
  cfToken: '',                            // 即线上 ADMIN_TOKEN
  previewPort: 4000,                      // hexo server 预览端口
  password: '',                           // 管理端访问密码;为空则不启用(仅监听本机)
  host: '127.0.0.1',                      // 改为 0.0.0.0 可局域网访问(建议同时设密码)
  port: 4001,                             // 管理端端口
  editorFontSize: 14,
  biliCookie: '',                        // B站登录 Cookie(同步动态漫集数用,可选)
};

let cache = null;

async function load() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(await fsp.readFile(FILE, 'utf8')); } catch { /* 首次使用 */ }
  cache = { ...DEFAULTS, ...saved };
  return cache;
}

async function save(patch) {
  const cur = await load();
  const next = { ...cur, ...patch };
  // host/port/password 变更需要重启进程才生效,但先持久化
  await U.ensureDir(path.dirname(FILE));
  await U.atomicWrite(FILE, JSON.stringify(next, null, 2));
  cache = next;
  return next;
}

module.exports = { load, save };
