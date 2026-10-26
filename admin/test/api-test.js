'use strict';
// 管理端 API 自测脚本(node admin/test/api-test.js),测试完自动清理
const BASE = 'http://127.0.0.1:4001';
let failed = 0;
async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: { ...(opts.headers || {}) } };
  if (opts.json !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.json); init.method = opts.method || 'POST'; }
  if (opts.formData) { init.body = opts.formData; init.method = 'POST'; }
  const r = await fetch(BASE + path, init);
  let d = null;
  try { d = await r.json(); } catch { d = { raw: 'non-json' }; }
  return { status: r.status, data: d };
}
function check(name, cond, extra) {
  if (cond) console.log('  ✔', name);
  else { failed++; console.log('  ✘', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}

async function main() {
  console.log('== 文章 CRUD ==');
  // 清理可能存在的脏数据
  await api('/api/posts/__test_post?type=post', { method: 'DELETE' });
  const tr0 = await api('/api/trash');
  for (const t of tr0.data.filter(t => t.slug.includes('__test') || t.slug.includes('测试'))) await api('/api/trash/' + t.id, { method: 'DELETE' });

  let r = await api('/api/posts', { json: { title: '测试文章甲', tags: ['测试', '临时'], categories: '测试分类', isDraft: false } });
  check('创建文章(中文标题)', r.status === 200 && r.data.slug === '测试文章甲', r.data);
  const slug = '测试文章甲';

  r = await api('/api/posts/' + encodeURIComponent(slug));
  check('读取文章详情', r.status === 200 && r.data.data.title === '测试文章甲' && r.data.data.tags.length === 2, r.data.data);
  check('资源文件夹已创建', Array.isArray(r.data.assets));

  // 保存:改正文 + 新增未知字段,验证未知字段保留
  r = await api('/api/posts/' + encodeURIComponent(slug), { method: 'PUT', json: { data: { ...r.data.data, custom_field: 'keep-me', title: '测试文章甲' }, body: '\n# Hello\n\n正文内容 test\n' } });
  check('保存文章', r.status === 200, r.data);
  r = await api('/api/posts/' + encodeURIComponent(slug));
  check('未知 frontmatter 字段保留', r.data.data.custom_field === 'keep-me', r.data.data);
  check('正文保存正确', r.data.body.includes('# Hello'), r.data.body);

  // 图片上传
  const fd = new FormData();
  fd.append('files', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), '测试图.png');
  r = await api(`/api/posts/${encodeURIComponent(slug)}/assets`, { formData: fd });
  check('上传图片到资源文件夹', r.status === 200 && r.data.saved.length === 1 && r.data.saved[0] === '测试图.png', r.data);
  const assetName = r.data.saved?.[0];

  // 静态资源服务
  const img = await fetch(BASE + `/asset/post/${encodeURIComponent(slug)}/${encodeURIComponent(assetName)}`);
  check('图片可经 /asset 访问', img.status === 200 && (await img.arrayBuffer()).byteLength === 8);
  const img2 = await fetch(BASE + '/asset/images/cc.jpg');
  check('站点图片可访问', img2.status === 200);

  console.log('== 草稿 ==');
  r = await api('/api/posts', { json: { title: '测试草稿乙', isDraft: true } });
  check('创建草稿', r.status === 200 && r.data.kind === 'draft', r.data);
  const dslug = r.data.slug;
  r = await api('/api/drafts');
  check('草稿列表包含新草稿', r.data.some(p => p.slug === dslug));
  r = await api(`/api/posts/${encodeURIComponent(dslug)}/publish`, { method: 'POST' });
  check('草稿发布到 _posts', r.status === 200, r.data);
  r = await api('/api/posts');
  check('文章列表包含已发布草稿', r.data.some(p => p.slug === dslug));
  r = await api('/api/drafts');
  check('草稿列表不再包含', !r.data.some(p => p.slug === dslug));

  console.log('== 回收站 ==');
  r = await api('/api/posts/' + encodeURIComponent(slug), { method: 'DELETE' });
  check('删除文章进回收站', r.status === 200 && r.data.id, r.data);
  const tid = r.data.id;
  r = await api('/api/trash');
  check('回收站列表', r.data.some(t => t.id === tid && t.hasAsset === true), r.data);
  r = await api(`/api/trash/${tid}/restore`, { method: 'POST' });
  check('恢复文章', r.status === 200, r.data);
  r = await api('/api/posts/' + encodeURIComponent(slug));
  check('恢复后资源文件夹还在', r.status === 200 && r.data.assets.includes(assetName), r.data.assets);
  r = await api('/api/posts/' + encodeURIComponent(slug), { method: 'DELETE' });
  const tid2 = r.data.id;
  r = await api('/api/trash/' + tid2, { method: 'DELETE' });
  check('彻底删除', r.status === 200);
  r = await api('/api/posts/' + encodeURIComponent(slug));
  check('确认已删干净', r.status === 404);

  // 清理测试草稿发布出来的文章
  r = await api('/api/posts/' + encodeURIComponent(dslug), { method: 'DELETE' });
  if (r.data.id) await api('/api/trash/' + r.data.id, { method: 'DELETE' });

  console.log('== 数据文件 ==');
  r = await api('/api/data/research');
  const planCount = r.data.parsed.plans?.length || 0;
  check('读取 research.yml(含断链校验)', r.status === 200 && planCount > 0, { plans: planCount, warnings: r.data.warnings });
  check('文章标题下拉数据返回', Array.isArray(r.data.titles) && r.data.titles.length > 0);
  // 改一个字段再存回,验证格式不破坏
  const parsed = r.data.parsed;
  const oldDesc = parsed.description;
  parsed.description = oldDesc; // 原样存回
  r = await api('/api/data/research', { method: 'PUT', json: { parsed } });
  check('写回 research.yml', r.status === 200 && Array.isArray(r.data.warnings), r.data);
  r = await api('/api/data/bangumi');
  check('读取 bangumi.yml', r.status === 200 && Array.isArray(r.data.parsed.items), r.data.parsed?.items?.length);
  const items = r.data.parsed.items;
  r = await api('/api/data/bangumi', { method: 'PUT', json: { parsed: r.data.parsed } });
  check('写回 bangumi.yml', r.status === 200);
  r = await api('/api/data/widget');
  check('读取 widget.yml 源码', r.status === 200 && typeof r.data.raw === 'string');
  r = await api('/api/data/widget', { method: 'PUT', json: { raw: r.data.raw } });
  check('写回 widget.yml(校验通过)', r.status === 200);
  r = await api('/api/data/widget', { method: 'PUT', json: { raw: 'a: [unclosed' } });
  check('非法 YAML 被拒绝', r.status === 422, r.status);

  console.log('== 标签/分类 ==');
  r = await api('/api/taxonomy');
  check('聚合标签分类', r.status === 200 && r.data.tags.length > 0);
  // 重命名测试:临时改一个再改回来
  const firstTag = r.data.tags[0].name;
  r = await api('/api/taxonomy/rename', { json: { kind: 'tags', from: firstTag, to: firstTag + '__tmp' } });
  const changed = r.data.changed;
  check(`重命名标签(${changed} 篇受影响)`, r.status === 200 && changed > 0);
  r = await api('/api/taxonomy/rename', { json: { kind: 'tags', from: firstTag + '__tmp', to: firstTag } });
  check('改回原标签', r.data.changed === changed);

  console.log('== 页面 ==');
  r = await api('/api/pages');
  check('扫描自定义页面', r.status === 200 && r.data.length >= 4, r.data.map(p => p.id));
  const pageId = r.data[0].id;
  r = await api('/api/pages/detail?p=' + encodeURIComponent(pageId));
  check('读取页面', r.status === 200 && r.data.data.title);
  r = await api('/api/pages/detail?p=' + encodeURIComponent(pageId), { method: 'PUT', json: { data: r.data.data, body: r.data.body } });
  check('原样写回页面', r.status === 200);

  console.log('== 媒体库 ==');
  r = await api('/api/media/tree');
  check('媒体树', r.status === 200 && r.data.groups.length > 0 && r.data.groups[0].files.length > 0);
  // 路径穿越防护
  r = await api('/api/media?p=' + encodeURIComponent('post/../server.js'), { method: 'DELETE' });
  check('路径穿越被拦截', r.status === 400, r.data);
  r = await api('/api/media?p=' + encodeURIComponent('images/../../package.json'), { method: 'DELETE' });
  check('images 穿越被拦截', r.status === 400, r.data);

  console.log('== 构建/设置 ==');
  r = await api('/api/build/status');
  check('构建状态', r.status === 200 && 'previewRunning' in r.data && 'previewLogs' in r.data, r.data);
  r = await api('/api/settings');
  check('读取设置', r.status === 200 && 'cfBaseUrl' in r.data);
  r = await api('/api/settings', { method: 'PUT', json: { editorFontSize: 15 } });
  check('保存设置', r.status === 200 && r.data.editorFontSize === 15);
  await api('/api/settings', { method: 'PUT', json: { editorFontSize: 14 } });
  r = await api('/api/cf/comments');
  check('未配置 token 时友好报错', r.status === 400 && /Token/.test(r.data.error), r.data);

  console.log('== 前端 ==');
  const idx = await fetch(BASE + '/');
  check('首页 HTML', idx.status === 200 && (await idx.text()).includes('博客管理端'));
  const js = await fetch(BASE + '/app.js');
  check('app.js', js.status === 200);
  const mk = await fetch(BASE + '/vendor/marked.min.js');
  check('marked vendored', mk.status === 200);

  console.log(failed === 0 ? '\n全部通过 ✔' : `\n${failed} 项失败 ✘`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(e => { console.error('测试脚本异常:', e); process.exit(1); });
