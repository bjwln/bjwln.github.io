import { handleOptions } from './_lib';

function adminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>浏览量/评论管理</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#e0e0e0;padding:20px}
h1{margin-bottom:16px;font-size:20px}.tabs{display:flex;gap:8px;margin-bottom:16px}
.tab{padding:8px 16px;background:#1a1a1a;border:1px solid #333;border-radius:6px;cursor:pointer;color:#999}
.tab.active{background:#2563eb;color:#fff;border-color:#2563eb}.hid{display:none}
table{width:100%;border-collapse:collapse;background:#111}th,td{padding:8px 12px;border:1px solid #222;text-align:left}
th{background:#1a1a1a;font-size:13px}td{font-size:13px}code{color:#60a5fa}
button{padding:4px 10px;border:none;border-radius:4px;cursor:pointer;font-size:12px}
.be{background:#2563eb;color:#fff}.bd{background:#dc2626;color:#fff}.bs{background:#16a34a;color:#fff}.bc{background:#525252;color:#fff}
input{padding:4px 8px;background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:4px;width:60px}
#ls{margin-bottom:20px}#pw{padding:8px;width:200px}#le{color:#f87171;margin-top:8px}
</style></head><body>
<h1>浏览量/评论管理</h1>
<div id="ls"><input id="pw" type="password" placeholder="管理密码"><button class="be" onclick="doLogin()">登录</button><div id="le" class="hid"></div></div>
<div id="ds" class="hid"><div class="tabs"><div class="tab active" id="tp" onclick="sw('p')">浏览量</div><div class="tab" id="tc" onclick="sw('c')">评论</div></div>
<div id="pp"><table><thead><tr><th>路径</th><th>PV</th><th>UV</th><th>操作</th></tr></thead><tbody id="pb"></tbody></table></div>
<div id="cp" class="hid"><table><thead><tr><th>ID</th><th>路径</th><th>昵称</th><th>内容</th><th>时间</th><th>操作</th></tr></thead><tbody id="cb"></tbody></table></div></div>
<script>
var tk=localStorage.getItem('at')||'';
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
async function api(u,o){o=o||{};o.headers=Object.assign({},o.headers,{'X-Admin-Token':tk});var r=await fetch(u,o);if(r.status===401){doLogout();throw new Error('unauthorized')}return r.json()}
async function doLogin(){tk=document.getElementById('pw').value;try{await api('/api/admin/pages');localStorage.setItem('at',tk);document.getElementById('ls').classList.add('hid');document.getElementById('ds').classList.remove('hid');loadP()}catch(e){tk='';var le=document.getElementById('le');le.textContent='密码错误';le.classList.remove('hid')}}
function doLogout(){localStorage.removeItem('at');tk='';location.reload()}
async function loadP(){var d=await api('/api/admin/pages');document.getElementById('pb').innerHTML=(d.data||[]).map(function(p){return '<tr data-p="'+esc(p.path)+'"><td><code>'+esc(p.path)+'</code></td><td><span class="pv">'+p.pv+'</span></td><td><span class="uv">'+p.uv+'</span></td><td><button class="be" onclick="editP(this)">编辑</button> <button class="bd" onclick="delP(this)">删除</button></td></tr>'}).join('')}
function editP(b){var tr=b.closest('tr');tr.querySelector('.pv').innerHTML='<input type="number" value="'+tr.querySelector('.pv').textContent+'">';tr.querySelector('.uv').innerHTML='<input type="number" value="'+tr.querySelector('.uv').textContent+'">';tr.querySelector('td:last-child').innerHTML='<button class="bs" onclick="saveP(this)">保存</button> <button class="bc" onclick="loadP()">取消</button>'}
async function saveP(b){var tr=b.closest('tr'),p=tr.dataset.p;var pv=tr.querySelector('.pv input').value,uv=tr.querySelector('.uv input').value;await api('/api/admin/pages/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,pv:Number(pv),uv:Number(uv)})});loadP()}
async function delP(b){if(!confirm('确定删除？'))return;var tr=b.closest('tr');await api('/api/admin/pages/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:tr.dataset.p})});tr.remove()}
async function loadC(){var d=await api('/api/admin/comments');document.getElementById('cb').innerHTML=(d.data||[]).map(function(c){var ct=esc(c.content.substring(0,60))+(c.content.length>60?'...':'');return '<tr><td>'+c.id+'</td><td><code>'+esc(c.path)+'</code></td><td>'+esc(c.nickname)+'</td><td>'+ct+'</td><td>'+new Date(c.created_at).toLocaleString()+'</td><td><button class="bd" onclick="delC('+c.id+')">删除</button></td></tr>'}).join('')}
async function delC(id){if(!confirm('确定删除？'))return;await api('/api/comment/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})});loadC()}
function sw(t){document.getElementById('pp').classList.toggle('hid',t!=='p');document.getElementById('cp').classList.toggle('hid',t!=='c');document.getElementById('tp').classList.toggle('active',t==='p');document.getElementById('tc').classList.toggle('active',t==='c');if(t==='p')loadP();if(t==='c')loadC()}
if(tk){document.getElementById('ls').classList.add('hid');document.getElementById('ds').classList.remove('hid');loadP()}
</script></body></html>`;
}

export async function onRequestGet() {
  return new Response(adminHTML(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function onRequestOptions() {
  return handleOptions();
}