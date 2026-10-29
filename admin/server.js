'use strict';
const path = require('path');
const express = require('express');
const multer = require('multer');
const U = require('./lib/util');
const fm = require('./lib/frontmatter');
const posts = require('./lib/posts');
const trash = require('./lib/trash');
const pages = require('./lib/pages');
const datafiles = require('./lib/datafiles');
const taxonomy = require('./lib/taxonomy');
const media = require('./lib/media');
const build = require('./lib/build');
const cf = require('./lib/cf');
const bangumisync = require('./lib/bangumisync');
const settings = require('./lib/settings');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 20 } });
const app = express();
app.use(express.json({ limit: '30mb' }));

// ---------- 登录(设置了密码才启用) ----------
app.post('/api/auth/login', U.wrap(async (req, res) => {
  const s = await settings.load();
  const pw = String(req.body?.password || '');
  if (!s.password) return res.json({ ok: true, noPassword: true });
  if (pw && pw === s.password) return res.json({ ok: true });
  res.status(401).json({ error: '密码错误' });
}));

app.use('/api', async (req, res, next) => {
  const s = await settings.load();
  if (!s.password) return next();
  if (req.headers['x-admin-token'] === s.password) return next();
  res.status(401).json({ error: 'unauthorized' });
});

// ---------- 仪表盘 ----------
app.get('/api/dashboard', U.wrap(async (req, res) => {
  const [postList, draftList, tax, tr] = await Promise.all([
    posts.listPosts('post'), posts.listPosts('draft').catch(() => []), taxonomy.summary(), trash.listTrash(),
  ]);
  const words = postList.reduce((n, p) => n + p.words, 0);
  const cfSummary = await cf.summary().catch(err => ({ error: err.message }));
  res.json({
    posts: postList.length, drafts: draftList.length, trash: tr.length,
    tags: tax.tags.length, categories: tax.categories.length, words,
    totalPv: cfSummary.totalPv, totalUv: cfSummary.totalUv, commentCount: cfSummary.commentCount,
    cfError: cfSummary.error || null,
    recent: postList.slice(0, 8),
    topPosts: (await cf.listPages().catch(() => [])).slice(0, 8),
  });
}));

// ---------- 文章 ----------
app.get('/api/posts', U.wrap(async (req, res) => res.json(await posts.listPosts('post'))));
app.get('/api/drafts', U.wrap(async (req, res) => res.json(await posts.listPosts('draft'))));
app.post('/api/posts', U.wrap(async (req, res) => res.json(await posts.createPost(req.body || {}))));
app.get('/api/posts/:slug', U.wrap(async (req, res) => {
  res.json(await posts.getPost(req.query.type === 'draft' ? 'draft' : 'post', req.params.slug));
}));
app.put('/api/posts/:slug', U.wrap(async (req, res) => {
  const { data, body } = req.body || {};
  res.json(await posts.savePost(req.query.type === 'draft' ? 'draft' : 'post', req.params.slug, data, body));
}));
app.delete('/api/posts/:slug', U.wrap(async (req, res) => {
  res.json(await trash.moveToTrash(req.query.type === 'draft' ? 'draft' : 'post', req.params.slug));
}));
app.post('/api/posts/:slug/publish', U.wrap(async (req, res) => res.json(await posts.publishDraft(req.params.slug))));
app.post('/api/posts/:slug/assets', upload.array('files', 20), U.wrap(async (req, res) => {
  res.json(await posts.uploadAsset(req.query.type === 'draft' ? 'draft' : 'post', req.params.slug, req.files));
}));
app.delete('/api/posts/:slug/assets/:name', U.wrap(async (req, res) => {
  res.json(await posts.deleteAsset(req.query.type === 'draft' ? 'draft' : 'post', req.params.slug, req.params.name));
}));

// ---------- 回收站 ----------
app.get('/api/trash', U.wrap(async (req, res) => res.json(await trash.listTrash())));
app.post('/api/trash/:id/restore', U.wrap(async (req, res) => res.json(await trash.restore(req.params.id))));
app.delete('/api/trash/:id', U.wrap(async (req, res) => res.json(await trash.purge(req.params.id))));

// ---------- 页面 ----------
app.get('/api/pages', U.wrap(async (req, res) => res.json(await pages.scanPages())));
app.get('/api/pages/detail', U.wrap(async (req, res) => res.json(await pages.getPage(String(req.query.p || '')))));
app.put('/api/pages/detail', U.wrap(async (req, res) => {
  const { data, body } = req.body || {};
  res.json(await pages.savePage(String(req.query.p || ''), data, body));
}));

// ---------- 数据文件 ----------
app.get('/api/data/research', U.wrap(async (req, res) => res.json(await datafiles.getResearch())));
app.put('/api/data/research', U.wrap(async (req, res) => res.json(await datafiles.putResearch(req.body?.parsed))));
app.get('/api/data/bangumi', U.wrap(async (req, res) => res.json(await datafiles.getBangumi())));
app.put('/api/data/bangumi', U.wrap(async (req, res) => res.json(await datafiles.putBangumi(req.body?.parsed))));
app.get('/api/data/widget', U.wrap(async (req, res) => res.json(await datafiles.getWidget())));
app.put('/api/data/widget', U.wrap(async (req, res) => res.json(await datafiles.putWidget(req.body?.raw))));

// ---------- 标签/分类 ----------
app.get('/api/taxonomy', U.wrap(async (req, res) => res.json(await taxonomy.summary())));
app.post('/api/taxonomy/rename', U.wrap(async (req, res) => {
  const { kind, from, to } = req.body || {};
  res.json(await taxonomy.rename(kind, from, to));
}));

// ---------- 媒体库 ----------
app.get('/api/media/tree', U.wrap(async (req, res) => res.json(await media.tree())));
app.post('/api/media/upload', upload.array('files', 20), U.wrap(async (req, res) => {
  res.json(await media.upload(String(req.body.target || 'images'), req.files));
}));
app.delete('/api/media', U.wrap(async (req, res) => res.json(await media.remove(String(req.query.p || '')))));

// 文章图片预览服务(/asset/images/...、/asset/post/<slug>/...、/asset/draft/<slug>/...)
app.use('/asset', (req, res) => media.serveAsset(req, res));

// ---------- 构建与发布 ----------
app.post('/api/build/generate', U.wrap(async (req, res) => res.json(await build.generate())));
app.post('/api/build/publish', U.wrap(async (req, res) => res.json(await build.publish(req.body?.message))));
app.post('/api/build/preview/start', U.wrap(async (req, res) => res.json(await build.previewStart(req.body?.port))));
app.post('/api/build/preview/stop', U.wrap(async (req, res) => res.json(await build.previewStop())));
app.get('/api/build/status', U.wrap(async (req, res) => res.json(await build.previewStatus())));

// ---------- Cloudflare(评论/统计/追番) ----------
app.get('/api/cf/comments', U.wrap(async (req, res) => res.json(await cf.listComments())));
app.post('/api/cf/comments/delete', U.wrap(async (req, res) => res.json(await cf.deleteComment(req.body?.id))));
app.get('/api/cf/pages', U.wrap(async (req, res) => res.json(await cf.listPages())));
app.post('/api/cf/pages/update', U.wrap(async (req, res) => res.json(await cf.updatePage(req.body?.path, req.body?.pv, req.body?.uv))));
app.post('/api/cf/pages/delete', U.wrap(async (req, res) => res.json(await cf.deletePage(req.body?.path))));
app.get('/api/cf/bangumi', U.wrap(async (req, res) => res.json(await cf.listBangumi())));
app.post('/api/cf/bangumi/action', U.wrap(async (req, res) => res.json(await cf.bangumiAction(req.body || {}))));
// 自动同步「更新至」集数:遍历条目,按链接类型抓取最新集数并写回线上
app.post('/api/bangumi/sync', U.wrap(async (req, res) => {
  const list = await cf.listBangumi();
  const results = [];
  for (const item of (list.items || [])) {
    const row = { id: item.id, title: item.title, old: item.total || '', total: item.total || '', changed: false, source: '', error: '' };
    try {
      const r = await bangumisync.fetchTotal(item.link || '', item.title || '', item.sync_url || '');
      if (r && r.total != null) {
        row.total = String(r.total);
        row.source = r.source;
        row.changed = String(r.total) !== String(item.total || '');
        if (row.changed) {
          await cf.bangumiAction({ action: 'item.setTotal', id: item.id, total: row.total });
        }
      } else {
        row.error = '无法从链接识别集数';
      }
    } catch (e) {
      row.error = e.message;
    }
    results.push(row);
    await new Promise(r2 => setTimeout(r2, 400)); // 温和限速,避免触发B站风控
  }
  res.json({ results });
}));
app.get('/api/cf/export', U.wrap(async (req, res) => {
  const data = await cf.exportAll();
  const file = 'd1-backup-' + U.fmtDate(new Date()).replace(/[: ]/g, '-') + '.json';
  const dir = path.join(U.ROOT, 'admin', 'data', 'backups');
  await U.ensureDir(dir);
  await U.atomicWrite(path.join(dir, file), JSON.stringify(data, null, 2));
  const counts = Object.fromEntries(Object.entries(data.tables).map(([k, v]) => [k, v.length]));
  res.json({ ok: true, file, counts });
}));

// ---------- 设置 ----------
app.get('/api/settings', U.wrap(async (req, res) => res.json(await settings.load())));
app.put('/api/settings', U.wrap(async (req, res) => {
  const patch = req.body || {};
  delete patch.password; // 密码走专用接口,避免被顺带清空
  res.json(await settings.save(patch));
}));
app.put('/api/settings/password', U.wrap(async (req, res) => {
  res.json(await settings.save({ password: String(req.body?.password || '') }));
}));

app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在: ' + req.path }));

// ---------- 前端静态资源 ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 统一错误处理 ----------
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
});

(async () => {
  const s = await settings.load();
  app.listen(s.port, s.host, () => {
    console.log('博客管理端已启动: http://' + (s.host === '0.0.0.0' ? 'localhost' : s.host) + ':' + s.port);
    console.log('博客根目录: ' + U.ROOT);
  });
})();
