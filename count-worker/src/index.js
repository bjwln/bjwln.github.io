// numberofvisitors worker
// 功能 1: 页面浏览量 (PV/UV)  -- 原有
// 功能 2: 文章评论             -- 新增
// 存储: Cloudflare D1 (binding: DB, database: number_of_visitors)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

const MAX_NICKNAME = 30;
const MAX_CONTENT = 1000;
const RATE_LIMIT_MS = 60_000; // 同 IP 60 秒内最多 1 条评论

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

// SHA-256 -> hex (用于头像 hash 和 IP hash)
async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 头像 URL (cravatar 国内镜像, 兼容 gravatar; 默认 monsterid 头像)
async function avatarUrl(email) {
  const hash = await sha256hex((email || '').trim().toLowerCase());
  return `https://cravatar.cn/avatar/${hash}?d=monsterid&s=80`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function normalizeWebsite(website) {
  if (!website) return null;
  website = website.trim();
  if (!website) return null;
  if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
  if (!URL_RE.test(website)) return null;
  return website.slice(0, 200);
}

// 幂等建表
async function initTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS page_views (
      path TEXT PRIMARY KEY,
      pv INTEGER DEFAULT 0,
      uv INTEGER DEFAULT 0
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS uv_log (
      key TEXT PRIMARY KEY,
      expire INTEGER
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      nickname TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ip_hash TEXT,
      status TEXT DEFAULT 'approved'
    )`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_comments_path ON comments(path, created_at)`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)`
  ).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (path === '/' || path === '/ping') {
      return json({ ok: true, time: Date.now() });
    }

    try {
      await initTables(env);
    } catch (e) {
      return json({ error: 'init table failed: ' + e.message }, 500);
    }

    // ============ 浏览量: 读取 (只读, 不计数) ============
    // GET /api/pv?path=/2026/06/24/xxx/
    if (path === '/api/pv' && request.method === 'GET') {
      const pagePath = url.searchParams.get('path') || '/';
      const row = await env.DB.prepare('SELECT pv, uv FROM page_views WHERE path = ?')
        .bind(pagePath)
        .first();
      return json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 });
    }

    // ============ 浏览量: 记录访问 (PV+1, UV 去重) ============
    // POST /api/visit  body: { path: "/2026/06/24/xxx/" }
    if (path === '/api/visit' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      const pagePath = body.path || '/';

      const visitorKey = request.headers.get('cf-connecting-ip') || 'unknown';
      const uvFlag = 'uv_' + pagePath + '_' + visitorKey;

      const now = Date.now();
      const existing = await env.DB.prepare(
        'SELECT key FROM uv_log WHERE key = ? AND expire > ?'
      )
        .bind(uvFlag, now)
        .first();
      const isNewUV = !existing;

      await env.DB.prepare(
        `INSERT INTO page_views (path, pv, uv) VALUES (?, 1, 0)
         ON CONFLICT(path) DO UPDATE SET pv = pv + 1`
      )
        .bind(pagePath)
        .run();

      if (isNewUV) {
        await env.DB.prepare(
          `INSERT INTO uv_log (key, expire) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET expire = ?`
        )
          .bind(uvFlag, now + 86_400_000, now + 86_400_000)
          .run();
        await env.DB.prepare('UPDATE page_views SET uv = uv + 1 WHERE path = ?')
          .bind(pagePath)
          .run();
      }

      const row = await env.DB.prepare('SELECT pv, uv FROM page_views WHERE path = ?')
        .bind(pagePath)
        .first();
      return json({ path: pagePath, pv: row?.pv || 0, uv: row?.uv || 0 });
    }

    // ============ 浏览量: 管理接口, 查看所有文章浏览量 ============
    // GET /api/all
    if (path === '/api/all' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT path, pv, uv FROM page_views ORDER BY pv DESC LIMIT 500'
      ).all();
      return json({ total: results.length, data: results });
    }

    // ============ 评论: 获取某文章评论列表 (扁平, 含 parent_id) ============
    // GET /api/comments?path=/2026/06/24/xxx/
    if (path === '/api/comments' && request.method === 'GET') {
      const pagePath = url.searchParams.get('path') || '/';
      const { results } = await env.DB.prepare(
        `SELECT id, path, parent_id, nickname, website, content, created_at, email
         FROM comments
         WHERE path = ? AND status = 'approved'
         ORDER BY created_at ASC`
      )
        .bind(pagePath)
        .all();

      // 异步计算头像 (email -> sha256 -> avatar url)
      const data = await Promise.all(
        (results || []).map(async (r) => ({
          id: r.id,
          path: r.path,
          parent_id: r.parent_id,
          nickname: r.nickname,
          website: r.website,
          content: r.content,
          created_at: r.created_at,
          avatar: await avatarUrl(r.email),
        }))
      );
      return json({ path: pagePath, total: data.length, data });
    }

    // ============ 评论: 提交评论 ============
    // POST /api/comment  body: { path, parent_id?, nickname, email, website?, content }
    if (path === '/api/comment' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }

      const pagePath = (body.path || '').trim().slice(0, 500);
      if (!pagePath) return json({ error: 'path required' }, 400);

      const nickname = (body.nickname || '').trim().slice(0, MAX_NICKNAME);
      if (!nickname) return json({ error: 'nickname required' }, 400);

      const email = (body.email || '').trim();
      if (!EMAIL_RE.test(email)) return json({ error: 'invalid email' }, 400);

      const website = normalizeWebsite(body.website);

      const content = (body.content || '').trim();
      if (!content) return json({ error: 'content required' }, 400);
      if (content.length > MAX_CONTENT)
        return json({ error: 'content too long' }, 400);

      let parentId = null;
      if (body.parent_id != null && body.parent_id !== '') {
        parentId = Number(body.parent_id);
        if (!Number.isInteger(parentId) || parentId < 1)
          return json({ error: 'invalid parent_id' }, 400);
      }

      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const ipHash = await sha256hex(ip);
      const now = Date.now();

      // 频率限制: 同 IP 60 秒内最多 1 条
      const recent = await env.DB.prepare(
        'SELECT id FROM comments WHERE ip_hash = ? AND created_at > ? LIMIT 1'
      )
        .bind(ipHash, now - RATE_LIMIT_MS)
        .first();
      if (recent) return json({ error: 'rate_limited' }, 429);

      // 校验 parent_id 是否存在且属于同一文章
      if (parentId != null) {
        const parent = await env.DB.prepare(
          "SELECT id, path, parent_id FROM comments WHERE id = ? AND status = 'approved'"
        )
          .bind(parentId)
          .first();
        if (!parent) return json({ error: 'parent not found' }, 400);
        if (parent.path !== pagePath)
          return json({ error: 'parent path mismatch' }, 400);
        // 仅允许两层: 被回复的不能是回复
        if (parent.parent_id != null)
          return json({ error: 'reply depth exceeded' }, 400);
      }

      const result = await env.DB.prepare(
        `INSERT INTO comments (path, parent_id, nickname, email, website, content, created_at, ip_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`
      )
        .bind(pagePath, parentId, nickname, email, website, content, now, ipHash)
        .run();

      const id = result.meta?.last_row_id;
      const comment = {
        id,
        path: pagePath,
        parent_id: parentId,
        nickname,
        website,
        content,
        created_at: now,
        avatar: await avatarUrl(email),
      };
      return json({ ok: true, comment });
    }

    // ============ 评论: 管理员删除 ============
    // POST /api/comment/delete  header: X-Admin-Token  body: { id }
    if (path === '/api/comment/delete' && request.method === 'POST') {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1)
        return json({ error: 'invalid id' }, 400);

      // 删除评论及其所有回复
      await env.DB.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?')
        .bind(id, id)
        .run();
      return json({ ok: true });
    }


    // ============ 管理后台 HTML 页面 ============
    function adminHTML() {
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>管理后台</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;color:#333;padding:20px}
.c{max-width:1100px;margin:0 auto}
.lbox{max-width:400px;margin:100px auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.lbox h2{margin-bottom:20px}
.lbox input{width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;font-size:14px}
.lbox button{width:100%;padding:10px;background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px}
.lbox button:hover{background:#0056b3}
h1{margin-bottom:20px;font-size:22px}
.tabs{margin-bottom:15px;border-bottom:2px solid #ddd;display:flex;align-items:center}
.tabs button{padding:10px 20px;background:none;border:none;cursor:pointer;font-size:15px;border-bottom:2px solid transparent;margin-bottom:-2px}
.tabs button.active{border-bottom-color:#007bff;color:#007bff}
.tabs .right{margin-left:auto}
table{width:100%;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);border-collapse:collapse}
th,td{padding:10px;text-align:left;border-bottom:1px solid #eee;font-size:14px}
th{background:#f8f8f8;font-weight:600}
tr:hover{background:#fafafa}
code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px}
.actions button{padding:4px 10px;margin-right:4px;border:none;border-radius:3px;cursor:pointer;font-size:12px;color:#fff}
.be{background:#ffc107}.bd{background:#dc3545}.bs{background:#28a745}.bc{background:#6c757d}
.err{color:#dc3545;margin-top:10px;font-size:13px}
input[type=number]{width:80px;padding:4px;border:1px solid #ddd;border-radius:3px}
.hid{display:none}
</style>
</head>
<body>
<div class="c">
<div id="ls" class="lbox">
<h2>🔒 管理后台</h2>
<input type="password" id="pw" placeholder="管理员密码" onkeypress="if(event.key==='Enter')doLogin()">
<button onclick="doLogin()">登录</button>
<div id="le" class="err hid"></div>
</div>
<div id="ds" class="hid">
<h1>📊 管理后台</h1>
<div class="tabs">
<button id="tp" class="active" onclick="show('p')">浏览量</button>
<button id="tc" onclick="show('c')">评论</button>
<button class="right" onclick="doLogout()">退出</button>
</div>
<div id="pp"><table><thead><tr><th>路径</th><th>PV</th><th>UV</th><th>操作</th></tr></thead><tbody id="pb"></tbody></table></div>
<div id="cp" class="hid"><table><thead><tr><th>ID</th><th>路径</th><th>昵称</th><th>内容</th><th>时间</th><th>操作</th></tr></thead><tbody id="cb"></tbody></table></div>
</div>
</div>
<script>
var tk=localStorage.getItem('at')||'';
if(tk){document.getElementById('ls').classList.add('hid');document.getElementById('ds').classList.remove('hid');loadP()}
function show(t){
  document.getElementById('pp').classList.toggle('hid',t!=='p');
  document.getElementById('cp').classList.toggle('hid',t!=='c');
  document.getElementById('tp').classList.toggle('active',t==='p');
  document.getElementById('tc').classList.toggle('active',t==='c');
  if(t==='p')loadP();if(t==='c')loadC();
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
async function api(u,o){
  o=o||{};o.headers=Object.assign({},o.headers,{'X-Admin-Token':tk});
  var r=await fetch(u,o);
  if(r.status===401){doLogout();throw new Error('unauthorized')}
  return r.json();
}
async function doLogin(){
  tk=document.getElementById('pw').value;
  try{await api('/api/admin/pages');localStorage.setItem('at',tk);document.getElementById('ls').classList.add('hid');document.getElementById('ds').classList.remove('hid');loadP()}
  catch(e){tk='';var le=document.getElementById('le');le.textContent='密码错误';le.classList.remove('hid')}
}
function doLogout(){localStorage.removeItem('at');tk='';location.reload()}
async function loadP(){
  var d=await api('/api/admin/pages');
  document.getElementById('pb').innerHTML=(d.data||[]).map(function(p){
    return '<tr data-p="'+esc(p.path)+'"><td><code>'+esc(p.path)+'</code></td><td><span class="pv">'+p.pv+'</span></td><td><span class="uv">'+p.uv+'</span></td><td><button class="be" onclick="editP(this)">编辑</button> <button class="bd" onclick="delP(this)">删除</button></td></tr>';
  }).join('');
}
function editP(b){
  var tr=b.closest('tr');
  tr.querySelector('.pv').innerHTML='<input type="number" value="'+tr.querySelector('.pv').textContent+'">';
  tr.querySelector('.uv').innerHTML='<input type="number" value="'+tr.querySelector('.uv').textContent+'">';
  tr.querySelector('td:last-child').innerHTML='<button class="bs" onclick="saveP(this)">保存</button> <button class="bc" onclick="loadP()">取消</button>';
}
async function saveP(b){
  var tr=b.closest('tr'),p=tr.dataset.p;
  var pv=tr.querySelector('.pv input').value,uv=tr.querySelector('.uv input').value;
  await api('/api/admin/pages/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,pv:Number(pv),uv:Number(uv)})});
  loadP();
}
async function delP(b){
  if(!confirm('确定删除？'))return;
  var tr=b.closest('tr');
  await api('/api/admin/pages/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:tr.dataset.p})});
  tr.remove();
}
async function loadC(){
  var d=await api('/api/admin/comments');
  document.getElementById('cb').innerHTML=(d.data||[]).map(function(c){
    var ct=esc(c.content.substring(0,60))+(c.content.length>60?'...':'');
    return '<tr><td>'+c.id+'</td><td><code>'+esc(c.path)+'</code></td><td>'+esc(c.nickname)+'</td><td>'+ct+'</td><td>'+new Date(c.created_at).toLocaleString()+'</td><td><button class="bd" onclick="delC('+c.id+')">删除</button></td></tr>';
  }).join('');
}
async function delC(id){
  if(!confirm('确定删除？'))return;
  await api('/api/comment/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})});
  loadC();
}
</script>
</body>
</html>`;
    }

    // GET /admin
    if (path === '/admin' && request.method === 'GET') {
      return new Response(adminHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // GET /api/admin/pages
    if (path === '/api/admin/pages' && request.method === 'GET') {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);
      const { results } = await env.DB.prepare(
        'SELECT path, pv, uv FROM page_views ORDER BY pv DESC'
      ).all();
      return json({ data: results || [] });
    }

    // POST /api/admin/pages/update
    if (path === '/api/admin/pages/update' && request.method === 'POST') {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
      const p = String(body.path || '').trim();
      const pv = Number(body.pv);
      const uv = Number(body.uv);
      if (!p || !Number.isInteger(pv) || pv < 0 || !Number.isInteger(uv) || uv < 0)
        return json({ error: 'invalid params' }, 400);
      await env.DB.prepare('UPDATE page_views SET pv = ?, uv = ? WHERE path = ?')
        .bind(pv, uv, p).run();
      return json({ ok: true });
    }

    // POST /api/admin/pages/delete
    if (path === '/api/admin/pages/delete' && request.method === 'POST') {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
      const p = String(body.path || '').trim();
      if (!p) return json({ error: 'path required' }, 400);
      await env.DB.prepare('DELETE FROM page_views WHERE path = ?').bind(p).run();
      return json({ ok: true });
    }

    // GET /api/admin/comments
    if (path === '/api/admin/comments' && request.method === 'GET') {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT id, path, parent_id, nickname, website, content, created_at, status
         FROM comments ORDER BY created_at DESC LIMIT 500`
      ).all();
      return json({ data: results || [] });
    }
    return json({ error: 'not found' }, 404);
  },
};
