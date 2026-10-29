'use strict';
/* 博客管理端前端 SPA(无构建,原生 JS) */

// ---------- 基础工具 ----------
const $ = s => document.querySelector(s);
const main = () => $('#main');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast-item ' + (type || '');
  t.textContent = msg;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), type === 'err' ? 6000 : 3000);
}
function fmtSize(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + 'B';
  if (n < 1048576) return (n / 1024).toFixed(1) + 'K';
  return (n / 1048576).toFixed(1) + 'M';
}
function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
// 'YYYY-MM-DD HH:mm:ss' ⇄ datetime-local
function dtToLocal(s) { return String(s || '').slice(0, 16).replace(' ', 'T'); }
function localToDt(s) { return String(s || '').replace('T', ' ') + (String(s || '').length === 16 ? ':00' : ''); }
function enc(s) { return encodeURIComponent(String(s)); }
function confirmBox(msg) { return window.confirm(msg); }

async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers);
  const pw = localStorage.getItem('adminPw');
  if (pw) headers['X-Admin-Token'] = pw;
  const init = { method: opts.method || 'GET', headers };
  if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.json); init.method = opts.method || 'POST'; }
  if (opts.formData) { init.body = opts.formData; init.method = opts.method || 'POST'; }
  const r = await fetch(path, init);
  if (r.status === 401) { showLogin(); throw new Error('需要登录'); }
  let d = {};
  try { d = await r.json(); } catch { /* ignore */ }
  if (!r.ok) { toast(d.error || ('请求失败 ' + r.status), 'err'); throw new Error(d.error || r.status); }
  return d;
}

// ---------- 登录 ----------
function showLogin() {
  $('#login-mask').style.display = 'flex';
}
async function doLogin() {
  const pw = $('#login-pw').value;
  try {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (!r.ok) { $('#login-err').textContent = '密码错误'; return; }
    localStorage.setItem('adminPw', pw);
    $('#login-mask').style.display = 'none';
    route();
  } catch (e) { $('#login-err').textContent = '网络错误'; }
}
$('#login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ---------- 路由 ----------
let pollTimer = null;
function clearPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

const ROUTES = [
  [/^#\/dashboard$/, () => vDashboard()],
  [/^#\/posts$/, () => vPosts()],
  [/^#\/drafts$/, () => vPosts('draft')],
  [/^#\/post\/(.+)$/, m => vPostEdit('post', decodeURIComponent(m[1]))],
  [/^#\/draft\/(.+)$/, m => vPostEdit('draft', decodeURIComponent(m[1]))],
  [/^#\/trash$/, () => vTrash()],
  [/^#\/pages$/, () => vPages()],
  [/^#\/page\/(.+)$/, m => vPageEdit(decodeURIComponent(m[1]))],
  [/^#\/data(?:\/(\w+))?$/, m => vData(m[1] || 'research')],
  [/^#\/taxonomy$/, () => vTaxonomy()],
  [/^#\/media$/, () => vMedia()],
  [/^#\/comments$/, () => vComments()],
  [/^#\/stats$/, () => vStats()],
  [/^#\/bangumi$/, () => vBangumi()],
  [/^#\/build$/, () => vBuild()],
  [/^#\/settings$/, () => vSettings()],
];

async function route() {
  clearPoll();
  const hash = location.hash || '#/dashboard';
  for (const [re, fn] of ROUTES) {
    const m = re.exec(hash);
    if (m) {
      const seg = hash.split('/')[1];
      document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + hash.split('/').slice(0, 2).join('/')));
      try { await fn(m); } catch (e) { if (e.message !== '需要登录') console.error(e); }
      return;
    }
  }
  location.hash = '#/dashboard';
}
window.addEventListener('hashchange', route);

// ---------- 仪表盘 ----------
async function vDashboard() {
  const d = await api('/api/dashboard');
  const cfCards = d.cfError
    ? `<div class="card"><div class="num warn">未连接</div><div class="lbl"><a href="#/settings">${esc(d.cfError)}</a></div></div>`
    : `<div class="card"><div class="num">${d.totalPv ?? '-'}</div><div class="lbl">总浏览量 PV</div></div>
       <div class="card"><div class="num">${d.totalUv ?? '-'}</div><div class="lbl">访客数 UV</div></div>
       <div class="card"><div class="num">${d.commentCount ?? '-'}</div><div class="lbl">评论总数</div></div>`;
  main().innerHTML = `
    <div class="page-head"><h2>仪表盘</h2><div class="spacer"></div>
      <button onclick="newPostDialog()">＋ 新建文章</button>
      <button class="ghost" onclick="location.hash='#/build'">🚀 构建发布</button></div>
    <div class="cards">
      <div class="card"><div class="num">${d.posts}</div><div class="lbl">文章</div></div>
      <div class="card"><div class="num">${d.drafts}</div><div class="lbl">草稿</div></div>
      <div class="card"><div class="num">${(d.words / 10000).toFixed(1)} 万</div><div class="lbl">总字数</div></div>
      <div class="card"><div class="num">${d.tags}</div><div class="lbl">标签</div></div>
      <div class="card"><div class="num">${d.categories}</div><div class="lbl">分类</div></div>
      <div class="card"><div class="num">${d.trash}</div><div class="lbl">回收站</div></div>
      ${cfCards}
    </div>
    <div class="two-col">
      <div class="panel"><h3>最近文章</h3>
        <table><thead><tr><th>标题</th><th>日期</th><th>字数</th></tr></thead><tbody>
        ${d.recent.map(p => `<tr><td><a href="#/post/${enc(p.slug)}">${esc(p.title)}</a></td><td class="muted">${esc(p.date)}</td><td class="muted">${p.words}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="panel"><h3>浏览量 TOP8 <a class="muted" style="float:right;font-size:12px" href="#/stats">全部 →</a></h3>
        ${d.topPosts.length ? `<table><thead><tr><th>页面</th><th>PV</th><th>UV</th></tr></thead><tbody>
        ${d.topPosts.map(p => `<tr><td><code>${esc(p.path)}</code></td><td>${p.pv}</td><td>${p.uv}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">暂无数据(需在设置中配置 Cloudflare Token)</div>'}</div>
    </div>`;
}

// ---------- 新建文章 ----------
function newPostDialog() {
  const html = `<div class="panel" id="np-panel"><h3>新建文章</h3>
    <div class="toolbar">
      <input type="text" id="np-title" placeholder="标题(必填)" style="width:300px">
      <input type="text" id="np-tags" placeholder="标签,逗号分隔(可空)" style="width:200px">
      <input type="text" id="np-cats" placeholder="分类(可空)" style="width:140px">
      <label class="flex checkline"><input type="checkbox" id="np-draft"> 保存为草稿</label>
      <button onclick="createPost()">创建</button>
      <button class="ghost" onclick="$('#np-panel').remove()">取消</button>
    </div></div>`;
  const anchor = main().querySelector('.page-head');
  anchor.insertAdjacentHTML('afterend', html);
  $('#np-title').focus();
}
async function createPost() {
  const title = $('#np-title').value.trim();
  if (!title) { toast('请填写标题', 'err'); return; }
  const tags = $('#np-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const cats = $('#np-cats').value.trim();
  const r = await api('/api/posts', { json: { title, tags, categories: cats || undefined, isDraft: $('#np-draft').checked } });
  toast('已创建:' + r.slug, 'ok');
  location.hash = (r.kind === 'draft' ? '#/draft/' : '#/post/') + enc(r.slug);
}

// ---------- 文章/草稿列表 ----------
let postCache = [];
async function vPosts(kind) {
  kind = kind || 'post';
  postCache = await api(kind === 'draft' ? '/api/drafts' : '/api/posts');
  const tags = [...new Set(postCache.flatMap(p => p.tags))].sort();
  const cats = [...new Set(postCache.flatMap(p => p.categories))].sort();
  main().innerHTML = `
    <div class="page-head"><h2>${kind === 'draft' ? '草稿箱' : '文章管理'}</h2><div class="spacer"></div>
      <button onclick="newPostDialog()">＋ 新建</button></div>
    <div class="toolbar">
      <input type="search" placeholder="搜索标题…" oninput="filterPosts('${kind}')">
      <select onchange="filterPosts('${kind}')"><option value="">全部标签</option>${tags.map(t => `<option>${esc(t)}</option>`).join('')}</select>
      <select onchange="filterPosts('${kind}')"><option value="">全部分类</option>${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <span class="muted" id="post-count"></span></div>
    <div class="panel" style="padding:0"><table><thead>
      <tr><th>标题</th><th>日期</th><th>标签</th><th>分类</th><th>字数</th><th>标记</th><th style="width:170px">操作</th></tr>
    </thead><tbody id="post-rows"></tbody></table></div>`;
  renderPostRows(kind, postCache);
}
function renderPostRows(kind, list) {
  $('#post-rows').innerHTML = list.length ? list.map(p => `<tr>
    <td><a href="#/${kind === 'draft' ? 'draft' : 'post'}/${enc(p.slug)}">${esc(p.title)}</a>${p.parseError ? ' <span class="muted">⚠️</span>' : ''}</td>
    <td class="muted">${esc(p.date)}</td>
    <td>${p.tags.map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}</td>
    <td class="muted">${esc(p.categories.join(', '))}</td>
    <td class="muted">${p.words}</td>
    <td>${p.research ? `<span class="chip">research:${esc(p.research)}</span>` : ''}${p.sticky ? `<span class="chip">置顶${p.sticky}</span>` : ''}${p.mathjax ? '<span class="chip">公式</span>' : ''}</td>
    <td>${kind === 'draft' ? `<button class="small" onclick="publishDraft('${esc(p.slug)}')">发布</button>` : ''}
        <button class="small ghost" onclick="location.hash='#/${kind === 'draft' ? 'draft' : 'post'}/${enc(p.slug)}'">编辑</button>
        <button class="small danger" onclick="deletePost('${kind}','${esc(p.slug)}')">删除</button></td>
  </tr>`).join('') : '<tr><td colspan="7" class="empty">空空如也</td></tr>';
  const el = $('#post-count'); if (el) el.textContent = `共 ${list.length} 篇`;
}
function filterPosts(kind) {
  const q = $('input[type="search"]').value.trim().toLowerCase();
  const [tagSel, catSel] = document.querySelectorAll('.toolbar select');
  const list = postCache.filter(p =>
    (!q || p.title.toLowerCase().includes(q)) &&
    (!tagSel.value || p.tags.includes(tagSel.value)) &&
    (!catSel.value || p.categories.includes(catSel.value)));
  renderPostRows(kind, list);
}
async function publishDraft(slug) {
  if (!(await confirmBox(`发布草稿「${slug}」到 _posts?`))) return;
  await api(`/api/posts/${enc(slug)}/publish`, { method: 'POST' });
  toast('已发布到文章列表', 'ok');
  route();
}
async function deletePost(kind, slug) {
  if (!(await confirmBox(`把「${slug}」移入回收站?\n(md 文件和图片资源文件夹会一起移入,可在回收站恢复)`))) return;
  await api(`/api/posts/${enc(slug)}?type=${kind}`, { method: 'DELETE' });
  toast('已移入回收站', 'ok');
  if (location.hash.includes(enc(slug))) location.hash = kind === 'draft' ? '#/drafts' : '#/posts';
  else route();
}

// ---------- 文章编辑器 ----------
let ED = null; // 当前编辑器状态
async function vPostEdit(kind, slug) {
  const p = await api(`/api/posts/${enc(slug)}?type=${kind}`);
  ED = { kind, slug, orig: p.data, data: p.data, body: p.body, assets: p.assets, origTitle: p.data.title, origDate: p.data.date, dirty: false };
  const isPost = kind === 'post';
  const d = p.data;
  main().innerHTML = `
    <div class="page-head">
      <a href="${isPost ? '#/posts' : '#/drafts'}">← 返回</a>
      <span class="muted" style="font-size:12px">${esc(p.dir)}/${esc(slug)}.md</span>
      <div class="spacer"></div>
      <span class="muted" id="ed-words"></span>
      <button class="ghost" onclick="togglePreview()" id="btn-preview">👁 预览中</button>
      <button onclick="savePost(false)">💾 保存 (Ctrl+S)</button></div>
    <div id="ed-warn"></div>
    ${p.parseError ? `<div class="errbox">frontmatter 解析失败:${esc(d.__parseError)}<br>请先手动修复 YAML,否则保存可能丢失 frontmatter。</div>` : ''}
    <div class="panel">
      <div class="fm-grid">
        <label class="wide">标题 *<input id="f-title" value="${esc(d.title || '')}"></label>
        <label>日期<input type="datetime-local" id="f-date" value="${dtToLocal(d.date)}" step="1"></label>
        <label>标签(逗号分隔)<input id="f-tags" value="${esc((Array.isArray(d.tags) ? d.tags : d.tags ? [d.tags] : []).join(', '))}"></label>
        <label>分类(逗号分隔)<input id="f-cats" value="${esc((Array.isArray(d.categories) ? d.categories : d.categories ? [d.categories] : []).join(', '))}"></label>
        <label>封面 cover<input id="f-cover" value="${esc(d.cover || '')}" placeholder="cover.jpg / /images/x.png / URL"></label>
        <label>cover_fit<select id="f-coverfit">${['', 'contain', 'cover'].map(v => `<option value="${v}" ${d.cover_fit === v ? 'selected' : ''}>${v || '(默认)'}</option>`).join('')}</select></label>
        <label>置顶 sticky<input type="number" id="f-sticky" value="${d.sticky ?? ''}" style="width:100%"></label>
        <label>research<input id="f-research" value="${esc(d.research || '')}" placeholder="如 literature(科研文章)"></label>
        <label>research_order<input type="number" id="f-rorder" value="${d.research_order ?? ''}" style="width:100%"></label>
        <label class="checkline"><input type="checkbox" id="f-mathjax" ${d.mathjax ? 'checked' : ''}> mathjax 公式</label>
      </div>
      <div class="toolbar" style="margin-bottom:8px">
        <button class="small ghost" onclick="mdWrap('**','**')">B 粗体</button>
        <button class="small ghost" onclick="mdWrap('*','*')">I 斜体</button>
        <button class="small ghost" onclick="mdWrap('==','==')">高亮</button>
        <button class="small ghost" onclick="mdLine('### ')">H3</button>
        <button class="small ghost" onclick="mdWrap('\\n> ','')">引用</button>
        <button class="small ghost" onclick="mdWrap('\\n\`\`\`\\n','\\n\`\`\`\\n')">代码块</button>
        <button class="small ghost" onclick="mdWrap('[', '](https://)')">链接</button>
        <button class="small ghost" onclick="$('#ed-file').click()">🖼 上传图片</button>
        <input type="file" id="ed-file" multiple accept="image/*,application/pdf" style="display:none" onchange="uploadEditorFiles(this.files)">
        <span class="muted" style="font-size:12px">支持直接粘贴 / 拖拽图片到编辑器</span></div>
      <div class="editor-wrap" id="ed-wrap">
        <textarea id="ta-editor" spellcheck="false">${esc(p.body)}</textarea>
        <div id="preview-pane"></div>
      </div>
      <div class="asset-strip" id="asset-strip"></div>
    </div>`;
  const ta = $('#ta-editor');
  ta.addEventListener('input', () => { ED.body = ta.value; ED.dirty = true; schedulePreview(); updateWords(); });
  ta.addEventListener('paste', editorPaste);
  ta.addEventListener('drop', editorDrop);
  ta.addEventListener('dragover', e => e.preventDefault());
  ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); savePost(false); } });
  ['f-title', 'f-date', 'f-tags', 'f-cats', 'f-cover', 'f-coverfit', 'f-sticky', 'f-research', 'f-rorder', 'f-mathjax']
    .forEach(id => $('#' + id).addEventListener('change', () => { ED.dirty = true; checkPermalinkChange(); }));
  renderPreview();
  updateWords();
  checkPermalinkChange();
  renderAssets();
}

function collectForm() {
  const d = ED.data;
  const num = v => v === '' ? undefined : Number(v);
  d.title = $('#f-title').value.trim() || d.title || '无标题';
  const dt = $('#f-date').value;
  if (dt) d.date = localToDt(dt);
  const setList = (id, key) => {
    const arr = $(id).value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (arr.length) d[key] = arr.length === 1 ? arr[0] : arr; else delete d[key];
  };
  setList('#f-tags', 'tags');
  setList('#f-cats', 'categories');
  const str = (id, key) => { const v = $(id).value.trim(); if (v) d[key] = v; else delete d[key]; };
  str('#f-cover', 'cover'); str('#f-coverfit', 'cover_fit'); str('#f-research', 'research');
  const n = (id, key) => { const v = num($(id).value); if (v !== undefined && !isNaN(v)) d[key] = v; else delete d[key]; };
  n('#f-sticky', 'sticky'); n('#f-rorder', 'research_order');
  if ($('#f-mathjax').checked) d.mathjax = true; else delete d.mathjax;
}
async function savePost(silent) {
  collectForm();
  await api(`/api/posts/${enc(ED.slug)}?type=${ED.kind}`, { method: 'PUT', json: { data: ED.data, body: ED.body } });
  ED.dirty = false;
  if (!silent) toast('已保存', 'ok');
}
function permalinkOf(title, date) {
  const d = String(date || '');
  const [y, m, day] = [d.slice(0, 4), d.slice(5, 7), d.slice(8, 10)];
  return `/${y}/${m}/${day}/${title}/`;
}
function checkPermalinkChange() {
  const el = $('#ed-warn'); if (!el || !ED) return;
  const t1 = $('#f-title').value.trim(), t2 = $('#f-date').value;
  const changed = (t1 && t1 !== ED.origTitle) || (t2 && localToDt(t2) !== String(ED.origDate));
  el.innerHTML = changed
    ? `<div class="warnbox">⚠️ 标题/日期被修改:文章 URL 由 <code>${esc(permalinkOf(ED.origTitle, ED.origDate))}</code> 变为 <code>${esc(permalinkOf(t1, localToDt(t2)))}</code>,已积累的浏览量统计将无法自动延续,确认无外链依赖再保存。</div>`
    : '';
}
function updateWords() {
  const cjk = (ED.body.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (ED.body.match(/[A-Za-z0-9][A-Za-z0-9'_-]*/g) || []).length;
  const el = $('#ed-words'); if (el) el.textContent = `字数 ${cjk + latin}`;
}
function togglePreview() {
  const w = $('#ed-wrap');
  w.classList.toggle('no-preview');
  $('#btn-preview').textContent = w.classList.contains('no-preview') ? '👁 显示预览' : '👁 预览中';
}
let pvTimer = null;
function schedulePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 400); }
function renderPreview() {
  if (!ED || !window.marked) return;
  let html;
  try { html = marked.parse(ED.body || ''); }
  catch (e) { $('#preview-pane').textContent = '预览出错: ' + e.message; return; }
  // 图片路径改写:让预览面板能经 /asset/ 服务显示图片
  const base = ED.kind === 'page'
    ? '/asset/page/' + ED.id.replace(/\/?index\.md$/, '').split('/').map(enc).join('/') + '/'
    : (ED.kind === 'draft' ? '/asset/draft/' : '/asset/post/') + enc(ED.slug) + '/';
  $('#preview-pane').innerHTML = html.replace(/<img([^>]*?)src="([^"]*)"([^>]*?)>/g, (m, a, src, b) => {
    if (/^(https?:|data:|\/asset\/)/.test(src)) return m;
    if (src.startsWith('/images/')) return `<img${a}src="/asset/images/${src.slice(8)}"${b}>`;
    if (src.startsWith('/')) return m; // 站内绝对路径,预览不解析,保持原样
    return `<img${a}src="${base}${src}"${b}>`;
  });
}

// 编辑器 markdown 工具
function mdWrap(pre, post) {
  const ta = $('#ta-editor');
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
  ta.value = v.slice(0, s) + pre + v.slice(s, e) + post + v.slice(e);
  ta.selectionStart = s + pre.length; ta.selectionEnd = e + pre.length;
  ta.focus(); ta.dispatchEvent(new Event('input'));
}
function mdLine(pre) {
  const ta = $('#ta-editor');
  const s = ta.selectionStart, v = ta.value;
  const ls = v.lastIndexOf('\n', s - 1) + 1;
  ta.value = v.slice(0, ls) + pre + v.slice(ls);
  ta.selectionStart = ta.selectionEnd = s + pre.length;
  ta.focus(); ta.dispatchEvent(new Event('input'));
}
function insertAtCursor(text) {
  const ta = $('#ta-editor');
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
  ta.value = v.slice(0, s) + text + v.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.focus(); ta.dispatchEvent(new Event('input'));
}
async function editorPaste(e) {
  const items = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/'));
  if (!items.length) return;
  e.preventDefault();
  for (const it of items) {
    const blob = it.getAsFile();
    if (blob) await uploadEditorFiles([blob]);
  }
}
async function editorDrop(e) {
  e.preventDefault();
  await uploadEditorFiles(e.dataTransfer.files);
}
async function uploadEditorFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  if (!files.length || !ED) return;
  const fd = new FormData();
  files.forEach(f => {
    const ext = (f.name.match(/\.\w+$/) || ['.png'])[0];
    fd.append('files', f, f.name || `paste-${Date.now()}${ext}`);
  });
  const r = await api(`/api/posts/${enc(ED.slug)}/assets?type=${ED.kind}`, { formData: fd });
  for (const name of r.saved) {
    if (name.toLowerCase().endsWith('.pdf')) insertAtCursor(`[${name}](${name})`);
    else insertAtCursor(`![](${name})`);
  }
  toast('已上传 ' + r.saved.length + ' 个文件', 'ok');
  const p = await api(`/api/posts/${enc(ED.slug)}?type=${ED.kind}`);
  ED.assets = p.assets;
  renderAssets();
}
async function renderAssets() {
  const el = $('#asset-strip'); if (!el) return;
  const base = (ED.kind === 'draft' ? '/asset/draft/' : '/asset/post/') + enc(ED.slug) + '/';
  const isImg = a => /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(a);
  el.innerHTML = ED.assets.map(a => {
    const snippet = isImg(a) ? `![](${a})` : `[${a}](${a})`;
    return `<div class="asset" title="${esc(a)}(点击插入到正文)" onclick="insertAtCursor('${snippet}')">
    ${isImg(a) ? `<img src="${base}${enc(a)}" loading="lazy">` : esc(a)}
    <span class="del" onclick="delAsset(event,'${esc(a)}')">✕</span></div>`;
  }).join('');
}
async function delAsset(e, name) {
  e.stopPropagation();
  if (!(await confirmBox('删除资源文件 ' + name + '?(不影响正文)'))) return;
  await api(`/api/posts/${enc(ED.slug)}/assets/${enc(name)}?type=${ED.kind}`, { method: 'DELETE' });
  ED.assets = ED.assets.filter(a => a !== name);
  renderAssets();
}

// ---------- 回收站 ----------
async function vTrash() {
  const list = await api('/api/trash');
  main().innerHTML = `
    <div class="page-head"><h2>回收站</h2><span class="muted">删除的文章先存放在这里,确认不需要后再彻底删除</span></div>
    <div class="panel" style="padding:0"><table><thead><tr><th>标题</th><th>文件名</th><th>类型</th><th>删除时间</th><th>操作</th></tr></thead><tbody>
    ${list.length ? list.map(t => `<tr>
      <td>${esc(t.title)}</td><td><code>${esc(t.slug)}.md</code></td><td>${t.kind === 'draft' ? '草稿' : '文章'}</td>
      <td class="muted">${esc(t.deletedAt)}</td>
      <td><button class="small" onclick="restoreTrash('${t.id}')">恢复</button>
          <button class="small danger" onclick="purgeTrash('${t.id}')">彻底删除</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">回收站是空的</td></tr>'}
    </tbody></table></div>`;
}
async function restoreTrash(id) {
  await api(`/api/trash/${id}/restore`, { method: 'POST' });
  toast('已恢复', 'ok'); route();
}
async function purgeTrash(id) {
  if (!(await confirmBox('彻底删除?此操作不可恢复!'))) return;
  await api(`/api/trash/${id}`, { method: 'DELETE' });
  toast('已彻底删除', 'ok'); route();
}

// ---------- 页面 ----------
async function vPages() {
  const list = await api('/api/pages');
  main().innerHTML = `
    <div class="page-head"><h2>页面管理</h2><span class="muted">自定义页面(科研/追番/热门等)依赖主题模板,这里只做内容编辑</span></div>
    <div class="panel" style="padding:0"><table><thead><tr><th>路径</th><th>标题</th><th>type</th><th>字数</th><th>操作</th></tr></thead><tbody>
    ${list.map(p => `<tr>
      <td><code>${esc(p.id)}</code></td><td><a href="#/page/${enc(p.id)}">${esc(p.title)}</a></td>
      <td class="muted">${esc(p.type) || '-'}</td><td class="muted">${p.words}</td>
      <td><button class="small ghost" onclick="location.hash='#/page/${enc(p.id)}'">编辑</button></td></tr>`).join('')}
    </tbody></table></div>`;
}
async function vPageEdit(id) {
  const p = await api('/api/pages/detail?p=' + encodeURIComponent(id));
  ED = { kind: 'page', id, orig: p.data, data: p.data, body: p.body };
  const d = p.data;
  main().innerHTML = `
    <div class="page-head"><a href="#/pages">← 返回</a><code>${esc(id)}</code><div class="spacer"></div>
      <button class="ghost" onclick="togglePreview()" id="btn-preview">👁 预览中</button>
      <button onclick="savePage()">💾 保存 (Ctrl+S)</button></div>
    ${p.parseError ? `<div class="errbox">frontmatter 解析失败:${esc(d.__parseError)}</div>` : ''}
    <div class="panel">
      <div class="fm-grid">
        <label>标题<input id="f-title" value="${esc(d.title || '')}"></label>
        <label>type<input id="f-type" value="${esc(d.type || '')}" placeholder="research / bangumi / 空"></label>
        <label>description<input id="f-desc" value="${esc(d.description || '')}"></label>
        <label>日期<input type="datetime-local" id="f-date" value="${dtToLocal(d.date)}" step="1"></label>
      </div>
      <p class="muted mb8" style="font-size:12px">其余 frontmatter 字段(top_img/aside/comment 等)编辑时原样保留。</p>
      <div class="editor-wrap" id="ed-wrap">
        <textarea id="ta-editor" spellcheck="false">${esc(p.body)}</textarea>
        <div id="preview-pane"></div>
      </div>
    </div>`;
  const ta = $('#ta-editor');
  ta.addEventListener('input', () => { ED.body = ta.value; schedulePreview(); });
  ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); savePage(); } });
  renderPreview();
}
async function savePage() {
  const d = ED.data;
  d.title = $('#f-title').value.trim() || d.title;
  const t = $('#f-type').value.trim(); if (t) d.type = t; else delete d.type;
  const de = $('#f-desc').value.trim(); if (de) d.description = de; else delete d.description;
  const dt = $('#f-date').value; if (dt) d.date = localToDt(dt);
  await api('/api/pages/detail?p=' + encodeURIComponent(ED.id), { method: 'PUT', json: { data: d, body: ED.body } });
  toast('页面已保存', 'ok');
}

// ---------- 数据文件 ----------
let DF = null; // 数据编辑状态
async function vData(tab) {
  main().innerHTML = `
    <div class="page-head"><h2>数据文件</h2>
      <a href="#/data/research" class="${tab === 'research' ? '' : 'muted'}">科研 research.yml</a>
      <a href="#/data/widget" class="${tab === 'widget' ? '' : 'muted'}">侧栏 widget.yml</a></div>
    <div id="data-body"></div>`;
  if (tab === 'research') await vDataResearch();
  else if (tab === 'bangumi') await vBangumiMigrated();
  else await vDataWidget();
}

// —— research.yml ——
async function vDataResearch() {
  const r = await api('/api/data/research');
  DF = { parsed: r.parsed, titles: r.titles };
  const P = DF.parsed;
  const box = $('#data-body');
  box.innerHTML = `
    <div class="panel"><h3>项目信息</h3><div class="fm-grid">
      <label>project<input id="r-project" value="${esc(P.project || '')}"></label>
      <label>focus<input id="r-focus" value="${esc(P.focus || '')}"></label>
      <label class="wide">description<input id="r-desc" value="${esc(P.description || '')}"></label>
      <label>current_stage<input id="r-stage" value="${esc(P.current_stage || '')}"></label>
      <label>updated<input id="r-updated" value="${esc(P.updated || '')}" placeholder="YYYY-MM-DD"></label>
    </div></div>
    <div id="plans-box"></div>
    <div class="toolbar"><button onclick="addPlan()">＋ 新增计划</button>
      <button onclick="saveResearch()">💾 保存 research.yml</button>
      <span class="muted">timeline 的 link 用于跳转文章,必须与文章标题完全一致(可用下拉补全)</span></div>
    <div id="data-warn"></div>
    <datalist id="dl-titles">${DF.titles.map(t => `<option value="${esc(t)}">`).join('')}</datalist>`;
  renderPlans();
  bindProjectFields();
}
function bindProjectFields() {
  [['r-project', 'project'], ['r-focus', 'focus'], ['r-desc', 'description'], ['r-stage', 'current_stage'], ['r-updated', 'updated']]
    .forEach(([id, key]) => $('#' + id).addEventListener('input', e => { DF.parsed[key] = e.target.value; }));
}
function renderPlans() {
  $('#plans-box').innerHTML = DF.parsed.plans.map((plan, pi) => `
    <div class="plan-card">
      <div class="row">
        <strong>计划 ${pi + 1}</strong>
        <input value="${esc(plan.key || '')}" placeholder="key" style="width:100px" oninput="DF.parsed.plans[${pi}].key=this.value">
        <input value="${esc(plan.title || '')}" placeholder="标题" style="width:120px" oninput="DF.parsed.plans[${pi}].title=this.value">
        <input value="${esc(plan.goal || '')}" placeholder="目标" style="width:200px" oninput="DF.parsed.plans[${pi}].goal=this.value">
        <input type="number" value="${plan.completed ?? 0}" style="width:70px" title="已完成" oninput="DF.parsed.plans[${pi}].completed=Number(this.value)">
        <span class="muted">/</span>
        <input type="number" value="${plan.total ?? 0}" style="width:70px" title="总量" oninput="DF.parsed.plans[${pi}].total=Number(this.value)">
        <input value="${esc(plan.unit || '')}" placeholder="单位" style="width:60px" oninput="DF.parsed.plans[${pi}].unit=this.value">
        <input value="${esc(plan.plan_link || '')}" placeholder="plan_link" style="width:150px" oninput="DF.parsed.plans[${pi}].plan_link=this.value">
        <button class="small danger" onclick="delPlan(${pi})">删除计划</button></div>
      <span class="mini-label">进度轴 tracks:</span>
      <div class="tracks-row" id="tracks-${pi}">
        ${(plan.tracks || []).map((t, ti) => `<span class="chip">${esc(t.key)}:${esc(t.axis_label)}
          <button onclick="delTrack(${pi},${ti})">✕</button></span>`).join('')}
        <input id="new-track-${pi}" placeholder="key:label" style="width:130px">
        <button class="small ghost" onclick="addTrack(${pi})">＋轴</button></div>
      <span class="mini-label">时间线 timeline:</span>
      ${renderTimeline(plan, pi)}
      <div class="row mt8"><button class="small ghost" onclick="addTimeline(${pi})">＋ 新增时间线</button></div>
    </div>`).join('');
}
function renderTimeline(plan, pi) {
  return (plan.timeline || []).map((t, ti) => {
    const tracks = (plan.tracks || []).map(tr => `<option value="${esc(tr.key)}" ${t.track === tr.key ? 'selected' : ''}>${esc(tr.axis_label || tr.key)}</option>`).join('');
    return `<div class="tl-row">
      <input type="date" value="${esc(t.date || '')}" title="日期" onchange="DF.parsed.plans[${pi}].timeline[${ti}].date=this.value">
      <input value="${esc(t.title || '')}" placeholder="标题" oninput="DF.parsed.plans[${pi}].timeline[${ti}].title=this.value">
      <select onchange="DF.parsed.plans[${pi}].timeline[${ti}].track=this.value"><option value="">轴?</option>${tracks}</select>
      <textarea placeholder="摘要 summary" oninput="DF.parsed.plans[${pi}].timeline[${ti}].summary=this.value">${esc(t.summary || '')}</textarea>
      <input list="dl-titles" value="${esc(t.link || '')}" placeholder="link = 文章标题" oninput="DF.parsed.plans[${pi}].timeline[${ti}].link=this.value">
      <input value="${esc(t.label || '')}" placeholder="label" oninput="DF.parsed.plans[${pi}].timeline[${ti}].label=this.value">
      <input type="number" value="${t.order ?? ti}" title="排序" style="width:56px" oninput="DF.parsed.plans[${pi}].timeline[${ti}].order=Number(this.value)">
      <div class="flex" style="gap:2px">
        <button class="small ghost" onclick="moveTimeline(${pi},${ti},-1)">↑</button>
        <button class="small ghost" onclick="moveTimeline(${pi},${ti},1)">↓</button>
        <button class="small danger" onclick="delTimeline(${pi},${ti})">✕</button></div></div>`;
  }).join('') || '<div class="muted mb8" style="font-size:12px">(暂无条目)</div>';
}
function addPlan() {
  DF.parsed.plans.push({ key: 'new-plan', title: '新计划', goal: '', completed: 0, total: 0, unit: '篇', plan_link: '', tracks: [{ key: 'main', axis_label: '主线' }], timeline: [] });
  renderPlans();
}
function delPlan(pi) {
  if (!confirmBox('删除整个计划(含时间线)?')) return;
  DF.parsed.plans.splice(pi, 1); renderPlans();
}
function addTrack(pi) {
  const v = $('#new-track-' + pi).value.trim();
  if (!v.includes(':')) { toast('格式:key:显示名,如 survey:综述', 'err'); return; }
  const [key, label] = v.split(':');
  (DF.parsed.plans[pi].tracks = DF.parsed.plans[pi].tracks || []).push({ key: key.trim(), axis_label: label.trim() });
  renderPlans();
}
function delTrack(pi, ti) {
  DF.parsed.plans[pi].tracks.splice(ti, 1); renderPlans();
}
function addTimeline(pi) {
  const plan = DF.parsed.plans[pi];
  plan.timeline = plan.timeline || [];
  plan.timeline.push({ date: new Date().toISOString().slice(0, 10), title: '', track: (plan.tracks || [])[0]?.key || '', summary: '', link: '', order: plan.timeline.length });
  renderPlans();
}
function delTimeline(pi, ti) { DF.parsed.plans[pi].timeline.splice(ti, 1); renderPlans(); }
function moveTimeline(pi, ti, d) {
  const tl = DF.parsed.plans[pi].timeline;
  const j = ti + d;
  if (j < 0 || j >= tl.length) return;
  [tl[ti], tl[j]] = [tl[j], tl[ti]];
  renderPlans();
}
async function saveResearch() {
  const r = await api('/api/data/research', { method: 'PUT', json: { parsed: DF.parsed } });
  $('#data-warn').innerHTML = r.warnings.length
    ? `<div class="warnbox">⚠️ 存在断链(链接与文章标题不匹配):<br>${r.warnings.map(esc).join('<br>')}</div>`
    : `<div class="okbox">已保存,断链校验通过</div>`;
  toast('research.yml 已保存', 'ok');
}

// —— bangumi.yml(已迁移:追番内容由线上 D1 管理,此编辑器退役) ——
function vBangumiMigrated() {
  $('#data-body').innerHTML = `<div class="panel">
    <h3>追番内容已迁移</h3>
    <p class="muted mb8">追番的条目与分类现在由线上数据库(Cloudflare D1)管理,追番页直接读取线上数据,保存即生效——请使用左侧「📺 追番管理」编辑。</p>
    <p class="muted" style="font-size:12px">本文件(source/_data/bangumi.yml)仅作为追番页在接口故障时的静态兜底数据,不再随编辑更新。</p>
    <a href="#/bangumi"><button>→ 打开追番管理</button></a></div>`;
}
function tokenHeaders() {
  const h = {};
  const pw = localStorage.getItem('adminPw');
  if (pw) h['X-Admin-Token'] = pw;
  return h;
}

// —— widget.yml ——
async function vDataWidget() {
  const r = await api('/api/data/widget');
  $('#data-body').innerHTML = `
    <div class="panel"><h3>widget.yml(源码编辑,内嵌 html/script)</h3>
      <textarea class="console" style="max-height:none;height:400px;color:var(--text)" id="widget-ta" spellcheck="false">${esc(r.raw)}</textarea>
      <div class="toolbar mt8"><button onclick="saveWidget()">💾 保存</button>
        <span class="muted">保存前会做 YAML 合法性校验,不合法则拒绝写入</span></div></div>`;
}
async function saveWidget() {
  await api('/api/data/widget', { method: 'PUT', json: { raw: $('#widget-ta').value } });
  toast('widget.yml 已保存', 'ok');
}

// ---------- 标签/分类 ----------
async function vTaxonomy() {
  const t = await api('/api/taxonomy');
  const col = (title, kind, list) => `
    <div class="panel"><h3>${title}</h3>
      ${list.length ? list.map(x => `<div class="flex mb8" data-kind="${kind}" data-name="${esc(x.name)}">
        <span class="chip" style="min-width:80px;justify-content:center">${esc(x.name)}</span>
        <span class="muted">${x.count} 篇</span>
        <button class="small ghost" onclick="renameTaxonomy('${kind}','${esc(x.name)}')">重命名</button></div>`).join('')
      : '<div class="empty">暂无</div>'}</div>`;
  main().innerHTML = `
    <div class="page-head"><h2>标签 / 分类</h2><span class="muted">重命名会更新所有文章(含草稿)的 frontmatter</span></div>
    <div class="two-col">${col('标签', 'tags', t.tags)}${col('分类', 'categories', t.categories)}</div>`;
}
async function renameTaxonomy(kind, from) {
  const to = window.prompt(`把「${kind === 'tags' ? '标签' : '分类'}」${from} 重命名为:` , from);
  if (!to || to === from) return;
  const r = await api('/api/taxonomy/rename', { json: { kind, from, to } });
  toast(`已更新 ${r.changed} 篇文章`, 'ok');
  route();
}

// ---------- 媒体库 ----------
let MEDIA = null, curGroup = null;
async function vMedia() {
  MEDIA = await api('/api/media/tree');
  curGroup = MEDIA.groups[0]?.key || '';
  main().innerHTML = `
    <div class="page-head"><h2>媒体库</h2><div class="spacer"></div>
      <input type="file" id="media-file" multiple accept="image/*,application/pdf" style="display:none" onchange="mediaUpload(this.files)">
      <button onclick="$('#media-file').click()">⬆ 上传到当前目录</button></div>
    <div class="media-layout">
      <div class="media-groups panel" style="padding:8px" id="media-groups"></div>
      <div class="file-grid" id="file-grid"></div>
    </div>`;
  renderMediaGroups();
  renderMediaFiles();
}
function renderMediaGroups() {
  $('#media-groups').innerHTML = MEDIA.groups.map(g =>
    `<a href="javascript:void(0)" class="${g.key === curGroup ? 'active' : ''}" onclick="curGroup='${g.kind === 'images' ? 'images' : g.kind + ':' + esc(g.slug)}';renderMediaGroups();renderMediaFiles()">📁 ${esc(g.title)} <span class="muted">(${g.files.length})</span></a>`).join('');
}
function curGroupFiles() {
  const g = MEDIA.groups.find(g => g.key === curGroup || (g.kind + ':' + g.slug) === curGroup);
  return g ? g.files : [];
}
function renderMediaFiles() {
  const files = curGroupFiles();
  $('#file-grid').innerHTML = files.length ? files.map(f => `<div class="file-item">
    <div class="thumb" onclick="window.open('${f.url}','_blank')">${f.name.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i) ? `<img src="${f.url}" loading="lazy">` : '📄'}</div>
    <div class="info"><div class="name" title="${esc(f.name)}">${esc(f.name)}</div>
      <div class="ops"><button class="small ghost" onclick="copyRef('${esc(f.ref)}')">复制引用</button>
      <button class="small danger" onclick="delMedia('${esc(f.path)}')">删除</button></div></div></div>`).join('')
    : '<div class="empty">此目录暂无文件</div>';
}
function copyRef(ref) {
  navigator.clipboard.writeText(ref).then(() => toast('已复制:' + ref, 'ok'));
}
async function mediaUpload(files) {
  files = [...files];
  if (!files.length) return;
  let target = curGroup.startsWith('post:') || curGroup.startsWith('draft:') ? curGroup : 'images';
  const fd = new FormData();
  fd.append('target', target);
  files.forEach(f => fd.append('files', f));
  const r = await fetch('/api/media/upload', { method: 'POST', body: fd, headers: tokenHeaders() });
  const d = await r.json();
  if (!r.ok) { toast(d.error || '上传失败', 'err'); return; }
  toast('已上传 ' + d.saved.length + ' 个文件', 'ok');
  MEDIA = await api('/api/media/tree');
  renderMediaGroups(); renderMediaFiles();
}
async function delMedia(p) {
  if (!(await confirmBox('删除文件 ' + p + '?'))) return;
  await api('/api/media?p=' + encodeURIComponent(p), { method: 'DELETE' });
  toast('已删除', 'ok');
  MEDIA = await api('/api/media/tree');
  renderMediaGroups(); renderMediaFiles();
}

// ---------- 评论管理(线上) ----------
async function vComments() {
  main().innerHTML = `<div class="page-head"><h2>评论管理</h2><span class="muted">数据来自 Cloudflare D1(线上)</span></div><div id="cf-body"><div class="empty">加载中…</div></div>`;
  try {
    const list = await api('/api/cf/comments');
    $('#cf-body').innerHTML = `<div class="panel" style="padding:0"><table><thead>
      <tr><th>ID</th><th>页面</th><th>昵称</th><th>内容</th><th>时间</th><th>操作</th></tr></thead><tbody>
      ${list.length ? list.map(c => `<tr>
        <td>${c.id}</td><td><code>${esc(c.path)}</code></td><td>${esc(c.nickname)}</td>
        <td style="max-width:360px">${esc(c.content)}</td><td class="muted">${fmtTime(c.created_at)}</td>
        <td><button class="small danger" onclick="delComment(${c.id})">删除</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="empty">还没有评论</td></tr>'}
      </tbody></table></div>`;
  } catch (e) {
    $('#cf-body').innerHTML = `<div class="errbox">加载失败:${esc(e.message)}<br><a href="#/settings">→ 去设置页配置 Cloudflare Token</a></div>`;
  }
}
async function delComment(id) {
  if (!(await confirmBox('删除该评论?线上数据,不可恢复!'))) return;
  await api('/api/cf/comments/delete', { json: { id } });
  toast('已删除', 'ok'); route();
}

// ---------- 流量统计(线上) ----------
async function vStats() {
  main().innerHTML = `<div class="page-head"><h2>流量统计</h2><span class="muted">浏览量修正后立即在线上生效</span></div><div id="cf-body"><div class="empty">加载中…</div></div>`;
  try {
    const list = await api('/api/cf/pages');
    $('#cf-body').innerHTML = `<div class="panel" style="padding:0"><table><thead>
      <tr><th>页面路径</th><th>PV</th><th>UV</th><th>操作</th></tr></thead><tbody>
      ${list.length ? list.map((p, i) => `<tr>
        <td><code>${esc(p.path)}</code></td>
        <td><input type="number" class="inline-input" id="pv-${i}" value="${p.pv}"></td>
        <td><input type="number" class="inline-input" id="uv-${i}" value="${p.uv}"></td>
        <td><button class="small" onclick="savePv(${i},'${esc(p.path)}')">保存</button>
            <button class="small danger" onclick="delPv('${esc(p.path)}')">删除</button></td></tr>`).join('')
      : '<tr><td colspan="4" class="empty">暂无数据</td></tr>'}
      </tbody></table></div>`;
  } catch (e) {
    $('#cf-body').innerHTML = `<div class="errbox">加载失败:${esc(e.message)}<br><a href="#/settings">→ 去设置页配置 Cloudflare Token</a></div>`;
  }
}
async function savePv(i, path) {
  await api('/api/cf/pages/update', { json: { path, pv: Number($('#pv-' + i).value), uv: Number($('#uv-' + i).value) } });
  toast('已更新 ' + path, 'ok');
}
async function delPv(path) {
  if (!(await confirmBox('删除 ' + path + ' 的统计记录?'))) return;
  await api('/api/cf/pages/delete', { json: { path } });
  toast('已删除', 'ok'); route();
}

// ---------- 构建发布 ----------
async function vBuild() {
  main().innerHTML = `
    <div class="page-head"><h2>构建发布</h2></div>
    <div class="two-col">
      <div class="panel"><h3>本地预览(hexo server)</h3>
        <div class="flex mb8"><span id="pv-state" class="muted">查询中…</span></div>
        <div class="flex"><button onclick="previewStart()">▶ 启动预览</button>
          <button class="ghost" onclick="previewStop()">■ 停止</button>
          <a id="pv-link" href="#" target="_blank" style="display:none">打开预览 ↗</a></div>
        <div class="console mt8" id="pv-log" style="max-height:180px"></div></div>
      <div class="panel"><h3>发布到线上</h3>
        <p class="muted mb8" style="font-size:12px">发布 = git add + commit + push,push 后 GitHub Actions 会自动构建并部署到 GitHub Pages 和 Cloudflare Pages。</p>
        <div class="toolbar"><input type="text" id="commit-msg" placeholder="提交信息(默认 update)" style="width:240px">
          <button onclick="doPublish()">🚀 发布</button>
          <button class="ghost" onclick="doGenerate()">🔨 本地构建验证</button></div>
        <p class="muted" style="font-size:12px">本地构建用于 push 前验证;正式部署由 CI 完成,无需本地部署。</p></div>
    </div>
    <div class="panel"><h3>任务日志</h3><div class="console" id="task-log">暂无任务</div></div>`;
  refreshBuildStatus();
  pollTimer = setInterval(refreshBuildStatus, 2000);
}
async function refreshBuildStatus() {
  const s = await api('/api/build/status');
  const ps = $('#pv-state');
  if (ps) ps.innerHTML = s.previewRunning
    ? `✅ 预览运行中,端口 ${s.previewPort} <a href="http://localhost:${s.previewPort}/" target="_blank">打开 ↗</a>`
    : '未启动';
  const link = $('#pv-link');
  if (link) { link.href = 'http://localhost:' + (s.previewPort || 4000) + '/'; link.style.display = s.previewRunning ? 'inline' : 'none'; }
  const pl = $('#pv-log');
  if (pl) { pl.textContent = (s.previewLogs || []).join('\n') || '暂无输出'; pl.scrollTop = pl.scrollHeight; }
  const tl = $('#task-log');
  if (tl) {
    tl.textContent = s.logs.length ? s.logs.join('\n') : '暂无任务';
    tl.scrollTop = tl.scrollHeight;
  }
}
async function previewStart() {
  const s = await api('/api/settings');
  const r = await api('/api/build/preview/start', { json: { port: s.previewPort } });
  toast('预览已启动,端口 ' + r.port, 'ok');
  refreshBuildStatus();
}
async function previewStop() {
  await api('/api/build/preview/stop', { method: 'POST' });
  toast('预览已停止', 'ok');
  refreshBuildStatus();
}
async function doGenerate() {
  await api('/api/build/generate', { method: 'POST' });
  toast('构建任务已开始,日志见下方', 'ok');
}
async function doPublish() {
  const msg = $('#commit-msg').value.trim();
  if (!(await confirmBox(msg ? `提交信息:「${msg}」,确认发布?` : '使用默认提交信息「update」,确认发布?'))) return;
  await api('/api/build/publish', { json: { message: msg || undefined } });
  toast('发布任务已开始,日志见下方', 'ok');
}

// ---------- 设置 ----------
async function vSettings() {
  const s = await api('/api/settings');
  main().innerHTML = `
    <div class="page-head"><h2>设置</h2></div>
    <div class="panel"><h3>Cloudflare 线上数据(评论/浏览量)</h3>
      <div class="fm-grid">
        <label class="wide">站点地址(线上 API 所在)<input id="s-cfurl" value="${esc(s.cfBaseUrl)}"></label>
        <label class="wide">ADMIN_TOKEN(即线上管理密码)<input type="password" id="s-cftoken" value="${esc(s.cfToken)}" placeholder="Cloudflare Pages 环境变量 ADMIN_TOKEN"></label>
      </div>
      <p class="muted" style="font-size:12px">Token 保存在本机 admin/data/settings.json(已 gitignore),仅本机服务使用。</p></div>
    <div class="panel"><h3>数据备份(Cloudflare D1)</h3>
      <div class="flex"><button onclick="backupDB()">⬇ 导出备份到本机</button>
        <span class="muted" style="font-size:12px">备份浏览量/评论/追番数据,保存到 admin/data/backups/(已 gitignore,建议定期导出)</span></div>
      <div id="backup-result" class="muted" style="font-size:12px;margin-top:6px"></div></div>
    <div class="panel"><h3>服务</h3><div class="fm-grid">
      <label>监听地址<select id="s-host"><option value="127.0.0.1" ${s.host === '127.0.0.1' ? 'selected' : ''}>127.0.0.1 仅本机(推荐)</option><option value="0.0.0.0" ${s.host === '0.0.0.0' ? 'selected' : ''}>0.0.0.0 局域网(需设密码)</option></select></label>
      <label>管理端端口<input type="number" id="s-port" value="${s.port}"></label>
      <label>预览端口(hexo server)<input type="number" id="s-pvport" value="${s.previewPort}"></label>
      <label>编辑器字号<input type="number" id="s-font" value="${s.editorFontSize}"></label></div>
      <p class="muted" style="font-size:12px">监听地址/端口修改后需重启管理端(npm run admin)生效。</p></div>
    <div class="panel"><h3>访问密码</h3>
      <div class="flex"><input type="password" id="s-pw" placeholder="${s.password ? '已设置,输入新密码可修改' : '未设置,仅本机监听时可留空'}" style="width:220px">
        <button onclick="savePassword()">保存密码</button>
        ${s.password ? '<button class="ghost" onclick="clearPassword()">清除密码</button>' : ''}</div></div>
    <div class="toolbar"><button onclick="saveSettings()">💾 保存设置</button></div>`;
}
async function backupDB() {
  const r = await api('/api/cf/export');
  $('#backup-result').textContent = '最近备份: ' + r.file + '(' + Object.entries(r.counts).map(([k, n]) => k + ' ' + n + ' 条').join(', ') + ')';
  toast('备份完成: ' + r.file, 'ok');
}
async function saveSettings() {
  await api('/api/settings', { method: 'PUT', json: {
    cfBaseUrl: $('#s-cfurl').value.trim(),
    cfToken: $('#s-cftoken').value.trim(),
    host: $('#s-host').value,
    port: Number($('#s-port').value) || 4001,
    previewPort: Number($('#s-pvport').value) || 4000,
    editorFontSize: Number($('#s-font').value) || 14,
  } });
  toast('设置已保存', 'ok');
}
async function savePassword() {
  const pw = $('#s-pw').value;
  if (pw && pw.length < 4) { toast('密码至少 4 位', 'err'); return; }
  await api('/api/settings/password', { method: 'PUT', json: { password: pw } });
  if (pw) localStorage.setItem('adminPw', pw); else localStorage.removeItem('adminPw');
  toast(pw ? '密码已设置' : '密码已清除', 'ok'); route();
}
async function clearPassword() {
  if (!(await confirmBox('确认清除访问密码?'))) return;
  await savePasswordWith('');
}
async function savePasswordWith(pw) {
  await api('/api/settings/password', { method: 'PUT', json: { password: pw } });
  if (pw) localStorage.setItem('adminPw', pw); else localStorage.removeItem('adminPw');
  toast('已保存', 'ok'); route();
}

// ---------- 启动 ----------
(async function init() {
  try {
    const s = await fetch('/api/settings').then(r => r.json());
    document.documentElement.style.setProperty('--ed-font', (s.editorFontSize || 14) + 'px');
  } catch { /* ignore */ }
  route();
})();

// ---------- 追番管理(线上 D1) ----------
let bgData = { categories: [], items: [] };
let bgFormId = null;

async function vBangumi() {
  main().innerHTML = `<div class="page-head"><h2>追番管理</h2><span class="muted">数据来自 Cloudflare D1(线上),保存后立即生效</span>
    <div class="spacer"></div>
    <button class="ghost" onclick="bgSync()">🔄 同步集数</button>
    <button onclick="bgShowForm()">＋ 新增条目</button></div>
    <div id="bg-sync" style="display:none"></div>
    <div id="bg-body"><div class="empty">加载中…</div></div>`;
  await bgReload();
}

async function bgSync() {
  const box = $('#bg-sync');
  const btn = [...document.querySelectorAll('.page-head button')].find(b => b.textContent.includes('同步集数'));
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 同步中…'; }
  box.style.display = 'block';
  box.innerHTML = '<div class="panel"><div class="empty">正在逐条获取最新集数(每条间隔 0.4 秒,请稍候)…</div></div>';
  try {
    const d = await api('/api/bangumi/sync', { json: {} });
    const rows = d.results.map(r => {
      const line = r.error
        ? `<span class="muted">${esc(r.title)} — ${esc(r.error)}</span>`
        : r.changed
          ? `<strong>${esc(r.title)}</strong>:${esc(r.old || '无') || '无'} → <b style="color:var(--ok,#22c55e)">${esc(r.total)}</b> <span class="muted">(${esc(r.source)})</span>`
          : `<span class="muted">${esc(r.title)} — 已是最新${r.total ? '(' + esc(r.total) + ')' : ''}</span>`;
      return `<div style="padding:3px 0;font-size:13px">${line}</div>`;
    }).join('');
    box.innerHTML = `<div class="panel"><h3>同步结果(${d.results.filter(r => r.changed).length} 条有更新 / 共 ${d.results.length} 条)</h3>${rows || '<div class="empty">没有条目</div>'}</div>`;
    toast('同步完成', 'ok');
  } catch (e) {
    box.innerHTML = `<div class="errbox">同步失败:${esc(e.message)}</div>`;
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔄 同步集数'; }
  await bgReload();
}

async function bgReload() {
  try {
    bgData = await api('/api/cf/bangumi');
    bgData.categories = bgData.categories || [];
    bgData.items = bgData.items || [];
    $('#bg-body').innerHTML = bgRender();
  } catch (e) {
    $('#bg-body').innerHTML = `<div class="errbox">加载失败:${esc(e.message)}<br><a href="#/settings">→ 去设置页配置 Cloudflare Token</a></div>`;
  }
}

function bgRender() {
  const { categories, items } = bgData;
  const catName = id => (categories.find(c => c.id === id) || {}).name || '';
  const countFor = id => items.filter(i => i.category_id === id).length;
  return `<div class="panel"><h3>分类</h3>
      <div class="toolbar">
        ${categories.map(c => `<span class="chip">${esc(c.name)} <em class="muted">${countFor(c.id)}</em>
          <button class="small" onclick="bgRenameCat(${c.id})">改名</button>
          <button class="small danger" onclick="bgDelCat(${c.id})">删除</button></span>`).join('')}
        <input type="text" id="bg-new-cat" placeholder="新分类名" style="width:130px">
        <button class="small" onclick="bgAddCat()">添加分类</button></div></div>
    <div class="panel" id="bg-form-panel" style="display:none"><h3 id="bg-form-title">新增条目</h3>
      <div class="toolbar">
        <input type="text" id="bg-f-title" placeholder="标题(必填)" style="width:220px">
        <input type="text" id="bg-f-author" placeholder="作者" style="width:120px">
        <select id="bg-f-cat"><option value="">未分类</option>${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        <select id="bg-f-status"><option>在看</option><option>想看</option><option>看完</option><option>弃</option></select>
        <input type="text" id="bg-f-episode" placeholder="看到第几集" style="width:90px">
        <input type="text" id="bg-f-total" placeholder="更新至(自动同步)" style="width:110px">
        <input type="number" id="bg-f-sort" placeholder="排序" style="width:70px" value="0"></div>
      <div class="toolbar"><input type="text" id="bg-f-image" placeholder="封面图 URL" style="width:100%"></div>
      <div class="toolbar"><input type="text" id="bg-f-link" placeholder="播放/详情页链接" style="width:100%"></div>
      <textarea id="bg-f-intro" rows="3" placeholder="简介" style="width:100%"></textarea>
      <div class="toolbar mt8"><button onclick="bgSaveItem()">保存</button>
        <button class="ghost" onclick="$('#bg-form-panel').style.display='none'">取消</button></div></div>
    <div class="panel" style="padding:0"><table><thead>
      <tr><th style="width:56px">封面</th><th>标题</th><th style="width:100px">分类</th><th style="width:64px">状态</th><th style="width:60px">看到</th><th style="width:64px">更新至</th><th style="width:150px">操作</th></tr></thead><tbody>
      ${items.length ? items.map(i => {
        const epNum = parseFloat(i.episode), totalNum = parseFloat(i.total);
        const hasNew = i.total && !isNaN(totalNum) && (isNaN(epNum) || totalNum > epNum);
        return `<tr>
        <td>${i.image ? `<img class="bg-thumb" src="${esc(i.image)}" onerror="this.onerror=null;this.style.visibility='hidden'">` : ''}</td>
        <td>${esc(i.title)}${hasNew ? ' <span style="color:#f59e0b;font-weight:600;font-size:12px">有更新↑</span>' : ''}</td>
        <td>${esc(catName(i.category_id)) || '<span class="muted">未分类</span>'}</td>
        <td>${esc(i.status || '')}</td>
        <td>${esc(i.episode || '')}</td>
        <td>${esc(i.total || '')}</td>
        <td><button class="small" onclick="bgEditItem(${i.id})">编辑</button>
            <button class="small danger" onclick="bgDelItem(${i.id})">删除</button></td></tr>`;
      }).join('')
      : '<tr><td colspan="7" class="empty">还没有条目,点右上角「＋ 新增条目」</td></tr>'}
      </tbody></table></div>`;
}

function bgShowForm(id) {
  bgFormId = id || null;
  const it = bgFormId ? bgData.items.find(x => x.id === bgFormId) : null;
  $('#bg-form-title').textContent = bgFormId ? '编辑条目 #' + bgFormId : '新增条目';
  $('#bg-f-title').value = it ? it.title : '';
  $('#bg-f-author').value = it ? (it.author || '') : '';
  $('#bg-f-cat').value = it && it.category_id ? it.category_id : '';
  $('#bg-f-status').value = it ? (it.status || '在看') : '在看';
  $('#bg-f-episode').value = it ? (it.episode || '') : '';
  $('#bg-f-total').value = it ? (it.total || '') : '';
  $('#bg-f-sort').value = it ? (it.sort || 0) : 0;
  $('#bg-f-image').value = it ? (it.image || '') : '';
  $('#bg-f-link').value = it ? (it.link || '') : '';
  $('#bg-f-intro').value = it ? (it.intro || '') : '';
  const panel = $('#bg-form-panel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function bgEditItem(id) { bgShowForm(id); }

async function bgSaveItem() {
  const title = $('#bg-f-title').value.trim();
  if (!title) return toast('标题不能为空', 'err');
  await api('/api/cf/bangumi/action', { json: { action: 'item.save', id: bgFormId || undefined, title,
    author: $('#bg-f-author').value.trim(), image: $('#bg-f-image').value.trim(), link: $('#bg-f-link').value.trim(),
    intro: $('#bg-f-intro').value.trim(), episode: $('#bg-f-episode').value.trim(), total: $('#bg-f-total').value.trim(), status: $('#bg-f-status').value,
    category_id: $('#bg-f-cat').value ? Number($('#bg-f-cat').value) : null, sort: Number($('#bg-f-sort').value) || 0 } });
  toast('已保存,线上即时生效', 'ok');
  await bgReload();
  $('#bg-form-panel').style.display = 'none';
}
async function bgDelItem(id) {
  if (!(await confirmBox('删除该条目?线上数据,不可恢复!'))) return;
  await api('/api/cf/bangumi/action', { json: { action: 'item.delete', id } });
  toast('已删除', 'ok'); await bgReload();
}
async function bgAddCat() {
  const name = $('#bg-new-cat').value.trim();
  if (!name) return toast('请输入分类名', 'err');
  await api('/api/cf/bangumi/action', { json: { action: 'category.save', name } });
  toast('已添加', 'ok'); await bgReload();
}
async function bgRenameCat(id) {
  const c = bgData.categories.find(x => x.id === id);
  const name = prompt('修改分类名:', c ? c.name : '');
  if (name === null) return;
  if (!name.trim() || (c && name.trim() === c.name)) return;
  await api('/api/cf/bangumi/action', { json: { action: 'category.save', id, name: name.trim() } });
  toast('已改名', 'ok'); await bgReload();
}
async function bgDelCat(id) {
  const c = bgData.categories.find(x => x.id === id);
  if (!(await confirmBox(`删除分类「${c ? c.name : id}」?其下条目会变成未分类`))) return;
  await api('/api/cf/bangumi/action', { json: { action: 'category.delete', id } });
  toast('已删除', 'ok'); await bgReload();
}
