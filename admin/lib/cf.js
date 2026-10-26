'use strict';
const settings = require('./settings');

// Cloudflare 线上接口代理(评论管理 + 浏览量统计)
// 复用 functions/ 里现成的 admin API,ADMIN_TOKEN 保存在本地设置里,前端不接触 token

async function call(path, { method = 'GET', body } = {}) {
  const s = await settings.load();
  if (!s.cfToken) { const e = new Error('尚未配置 Cloudflare Token(ADMIN_TOKEN),请到「设置」填写'); e.status = 400; throw e; }
  const base = String(s.cfBaseUrl || '').replace(/\/+$/, '');
  const resp = await fetch(base + path, {
    method,
    headers: { 'X-Admin-Token': s.cfToken, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (resp.status === 401) { const e = new Error('线上校验失败:Token 不正确(401)'); e.status = 401; throw e; }
  if (!resp.ok) { const e = new Error(data.error || ('线上接口返回 ' + resp.status)); e.status = resp.status; throw e; }
  return data;
}

const listComments = () => call('/api/admin/comments').then(d => d.data || []);
const deleteComment = id => call('/api/comment/delete', { method: 'POST', body: { id } });
const listPages = () => call('/api/admin/pages').then(d => d.data || []);
const updatePage = (path, pv, uv) => call('/api/admin/pages/update', { method: 'POST', body: { path, pv, uv } });
const deletePage = path => call('/api/admin/pages/delete', { method: 'POST', body: { path } });

// 仪表盘汇总
async function summary() {
  const [pages, comments] = await Promise.all([listPages(), listComments()]);
  const totalPv = pages.reduce((n, p) => n + (p.pv || 0), 0);
  const totalUv = pages.reduce((n, p) => n + (p.uv || 0), 0);
  return { totalPv, totalUv, pageCount: pages.length, commentCount: comments.length };
}

module.exports = { listComments, deleteComment, listPages, updatePage, deletePage, summary };
