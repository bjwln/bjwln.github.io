import { handleOptions } from './_lib';

function adminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>站点管理</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#e0e0e0;padding:20px}
h1{margin-bottom:16px;font-size:20px}.tabs{display:flex;gap:8px;margin-bottom:16px}
.tab{padding:8px 16px;background:#1a1a1a;border:1px solid #333;border-radius:6px;cursor:pointer;color:#999}
.tab.active{background:#2563eb;color:#fff;border-color:#2563eb}.hid{display:none}
table{width:100%;border-collapse:collapse;background:#111}th,td{padding:8px 12px;border:1px solid #222;text-align:left}
th{background:#1a1a1a;font-size:13px}td{font-size:13px}code{color:#60a5fa}
button{padding:4px 10px;border:none;border-radius:4px;cursor:pointer;font-size:12px}
.be{background:#2563eb;color:#fff}.bd{background:#dc2626;color:#fff}.bs{background:#16a34a;color:#fff}.bc{background:#525252;color:#fff}
input{padding:4px 8px;background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:4px;width:60px}
select,textarea{padding:4px 8px;background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:4px;font-family:inherit;font-size:13px}
#ls{margin-bottom:20px}#pw{padding:8px;width:200px}#le{color:#f87171;margin-top:8px}
.bsec{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;font-size:13px}
.bsec b{color:#999;font-size:12px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#1a1a1a;border:1px solid #333;border-radius:999px;font-size:12px}
.chip button{padding:0 2px;background:none;font-size:11px;color:#999}
.chip button:hover{color:#fff}
#bcn{width:120px}
#bf{border:1px solid #333;border-radius:8px;padding:14px;margin-bottom:16px;background:#111}
#bf h3{font-size:14px;margin-bottom:10px;color:#93c5fd}
.frow{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.frow label{font-size:12px;color:#999;min-width:56px;text-align:right;flex:none}
.w1{width:90px}.w2{width:180px}.w3{width:100%;max-width:560px}
textarea.w3{resize:vertical}
.bthumb{width:34px;height:48px;object-fit:cover;border-radius:4px;display:block;background:#1a1a1a}
#berr{color:#f87171;font-size:12px}
</style></head><body>
<h1>站点管理</h1>
<div id="ls"><input id="pw" type="password" placeholder="管理密码"><button class="be" onclick="doLogin()">登录</button><div id="le" class="hid"></div></div>
<div id="ds" class="hid"><div class="tabs"><div class="tab active" id="tp" onclick="sw('p')">浏览量</div><div class="tab" id="tc" onclick="sw('c')">评论</div><div class="tab" id="tb" onclick="sw('b')">追番</div></div>
<div id="pp"><table><thead><tr><th>路径</th><th>PV</th><th>UV</th><th>操作</th></tr></thead><tbody id="pb"></tbody></table></div>
<div id="cp" class="hid"><table><thead><tr><th>ID</th><th>路径</th><th>昵称</th><th>内容</th><th>时间</th><th>操作</th></tr></thead><tbody id="cb"></tbody></table></div>
<div id="bp" class="hid">
  <div class="bsec"><b>分类</b><span id="bcs"></span><input id="bcn" placeholder="新分类名"><button class="be" onclick="addBC()">添加分类</button></div>
  <div id="bf" class="hid"><h3 id="bft">新增条目</h3>
    <div class="frow"><label>标题*</label><input id="ft" class="w2"><label>作者</label><input id="fa" class="w2"><label>分类</label><select id="fc"></select><label>状态</label><select id="fs"><option>在看</option><option>想看</option><option>看完</option><option>弃</option></select></div>
    <div class="frow"><label>看到</label><input id="fe" class="w1" placeholder="如 114"><label>更新至</label><input id="ftotal" class="w1" placeholder="同步填写"><label>同步源</label><input id="fsync" class="w2" placeholder="UP主空间链接(可选)"><label>排序</label><input id="fo" type="number" class="w1" value="0"><span style="font-size:11px;color:#666">数字越小越靠前</span></div>
    <div class="frow"><label>封面URL</label><input id="fi" class="w3" placeholder="封面图片地址"></div>
    <div class="frow"><label>链接</label><input id="fl" class="w3" placeholder="播放/详情页地址"></div>
    <div class="frow"><label>简介</label><textarea id="fb" rows="3" class="w3"></textarea></div>
    <div class="frow"><button class="bs" onclick="saveB()">保存</button> <button class="bc" onclick="hideBF()">取消</button><span id="berr"></span></div>
  </div>
  <div class="bsec"><b>条目</b><button class="be" onclick="showBF()">+ 新增条目</button></div>
  <table><thead><tr><th>封面</th><th>标题</th><th>分类</th><th>状态</th><th>看到</th><th>更新至</th><th>操作</th></tr></thead><tbody id="bit"></tbody></table>
</div></div>
<script>
var tk=localStorage.getItem('at')||'';
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
async function api(u,o){o=o||{};o.headers=Object.assign({},o.headers,{'X-Admin-Token':tk});var r=await fetch(u,o);if(r.status===401){doLogout();throw new Error('unauthorized')}return r.json()}
async function doLogin(){tk=document.getElementById('pw').value;try{await api('/api/admin/pages');localStorage.setItem('at',tk);document.getElementById('ls').classList.add('hid');document.getElementById('ds').classList.remove('hid');loadP()}catch(e){tk='';var le=document.getElementById('le');le.textContent='密码错误';le.classList.remove('hid')}}
function doLogout(){localStorage.removeItem('at');tk='';location.reload()}
async function loadP(){var d=await api('/api/admin/pages');document.getElementById('pb').innerHTML=(d.data||[]).map(function(p){return '<tr data-p="'+esc(p.path)+'"><td><code>'+esc(p.path)+'</code></td><td><span class="pv">'+p.pv+'</span></td><td><span class="uv">'+p.uv+'</span></td><td><button class="be" onclick="editP(this)">编辑</button> <button class="bd" onclick="delP(this)">删除</button></td></tr>'}).join('')}
function editP(b){var tr=b.closest('tr');tr.querySelector('.pv').innerHTML='<input type="number" value="'+tr.querySelector('.pv').textContent+'">';tr.querySelector('.uv').innerHTML='<input type="number" value="'+tr.querySelector('.uv').textContent+'">';tr.querySelector('td:last-child').innerHTML='<button class="bs" onclick="saveP(this)">保存</button> <button class="bc" onclick="loadP()">取消</button>'}
async function saveP(b){var tr=b.closest('tr'),p=tr.dataset.p;var pv=tr.querySelector('.pv input').value,uv=tr.querySelector('.uv input').value;await api('/api/admin/pages/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,pv:Number(pv),uv:Number(uv)})});loadP()}
async function delP(b){if(!confirm('确定删除？'))return;var tr=b.closest('tr');await api('/api/admin/pages/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:tr.dataset.p})});tr.remove()}
async function loadC(){var d=await api('/api/admin/comments');document.getElementById('cb').innerHTML=(d.data||[]).map(function(c){var ct=esc(c.content.substring(0,60))+(c.content.length>60?'...':'');return '<tr><td>'+c.id+'</td><td><code>'+esc(c.path)+'</code></td><td>'+esc(c.nickname)+'</td><td>'+ct+'</td><td>'+new Date(c.created_at).toLocaleString()+'</td><td><button class="bd" onclick="delC('+c.id+')">删除</button></td></tr>'}).join('')}
async function delC(id){if(!confirm('确定删除？'))return;await api('/api/comment/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})});loadC()}
function sw(t){document.getElementById('pp').classList.toggle('hid',t!=='p');document.getElementById('cp').classList.toggle('hid',t!=='c');document.getElementById('bp').classList.toggle('hid',t!=='b');document.getElementById('tp').classList.toggle('active',t==='p');document.getElementById('tc').classList.toggle('active',t==='c');document.getElementById('tb').classList.toggle('active',t==='b');if(t==='p')loadP();if(t==='c')loadC();if(t==='b')loadB()}
if(tk){document.getElementById('ls').classList.add('hid');document.getElementById('ds').classList.remove('hid');loadP()}

// ---------- 追番 ----------
var bdata={cats:[],items:[]},bformId=null;
function v(id){return document.getElementById(id).value}
function berr(s){document.getElementById('berr').textContent=s||''}
function catName(id){var c=bdata.cats.find(function(x){return x.id===id});return c?c.name:''}
async function loadB(){var d=await api('/api/admin/bangumi');bdata.cats=d.categories||[];bdata.items=d.items||[];renderBC();renderBI();if(bformId)fillFC()}
function renderBC(){var unc=bdata.items.filter(function(i){return !i.category_id}).length;document.getElementById('bcs').innerHTML=bdata.cats.map(function(c){return '<span class="chip">'+esc(c.name)+' ('+bdata.items.filter(function(i){return i.category_id===c.id}).length+') <button title="重命名" onclick="renameBC('+c.id+')">✎</button><button title="删除" onclick="delBC('+c.id+')">✕</button></span>'}).join('')+'<span class="chip" style="border-style:dashed;color:#777">未分类 '+unc+'</span>'}
async function addBC(){var n=document.getElementById('bcn').value.trim();if(!n){berr('请输入分类名');return}berr();await api('/api/admin/bangumi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'category.save',name:n})});document.getElementById('bcn').value='';loadB()}
async function renameBC(id){var c=bdata.cats.find(function(x){return x.id===id});var n=prompt('修改分类名：',c?c.name:'');if(n===null)return;n=n.trim();if(!n||n===(c&&c.name))return;await api('/api/admin/bangumi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'category.save',id:id,name:n})});loadB()}
async function delBC(id){var c=bdata.cats.find(function(x){return x.id===id});if(!confirm('删除分类「'+(c?c.name:id)+'」？其下条目会变成未分类'))return;await api('/api/admin/bangumi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'category.delete',id:id})});loadB()}
function fillFC(){var s=document.getElementById('fc'),cur=s.value;s.innerHTML='<option value="">未分类</option>'+bdata.cats.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join('');s.value=cur}
function renderBI(){document.getElementById('bit').innerHTML=bdata.items.length?bdata.items.map(function(i){var isNew=i.total&&i.episode&&!isNaN(Number(i.episode))&&Number(i.total)>Number(i.episode);return '<tr><td>'+(i.image?'<img class="bthumb" src="'+esc(i.image)+'" onerror="this.onerror=null;this.src=\\'data:image/gif;base64,R0lGODlhAQABAAAAACw=\\'">':'')+'</td><td>'+esc(i.title)+(isNew?' <span style="color:#f59e0b;font-size:11px">有更新</span>':'')+'</td><td>'+(i.category_id?esc(catName(i.category_id)):'<span style="color:#777">未分类</span>')+'</td><td>'+esc(i.status||'')+'</td><td>'+esc(i.episode||'')+'</td><td>'+esc(i.total||'')+'</td><td><button class="be" onclick="editB('+i.id+')">编辑</button> <button class="bd" onclick="delB('+i.id+')">删除</button></td></tr>'}).join(''):'<tr><td colspan="7" style="color:#777">还没有条目，点上方「+ 新增条目」添加</td></tr>'}
function showBF(id){bformId=id||null;var f=document.getElementById('bf');f.classList.remove('hid');fillFC();berr();document.getElementById('bft').textContent=bformId?'编辑条目 #'+bformId:'新增条目';var it=bformId?bdata.items.find(function(x){return x.id===bformId}):null;document.getElementById('ft').value=it?it.title:'';document.getElementById('fa').value=it?(it.author||''):'';document.getElementById('fi').value=it?(it.image||''):'';document.getElementById('fl').value=it?(it.link||''):'';document.getElementById('fb').value=it?(it.intro||''):'';document.getElementById('fe').value=it?(it.episode||''):'';document.getElementById('ftotal').value=it?(it.total||''):'';document.getElementById('fsync').value=it?(it.sync_url||''):'';document.getElementById('fo').value=it?(it.sort||0):0;document.getElementById('fs').value=it?(it.status||'在看'):'在看';document.getElementById('fc').value=it&&it.category_id?it.category_id:'';f.scrollIntoView({behavior:'smooth',block:'nearest'})}
function hideBF(){document.getElementById('bf').classList.add('hid');bformId=null}
async function saveB(){var title=v('ft').trim();if(!title){berr('标题不能为空');return}berr();var body={action:'item.save',id:bformId||undefined,title:title,author:v('fa').trim(),image:v('fi').trim(),link:v('fl').trim(),intro:v('fb').trim(),episode:v('fe').trim(),total:v('ftotal').trim(),sync_url:v('fsync').trim(),status:v('fs'),category_id:v('fc')?Number(v('fc')):null,sort:Number(v('fo'))||0};try{await api('/api/admin/bangumi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}catch(e){return}hideBF();loadB()}
async function delB(id){if(!confirm('确定删除该条目？'))return;await api('/api/admin/bangumi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'item.delete',id:id})});loadB()}
</script></body></html>`;
}

export async function onRequestGet() {
  return new Response(adminHTML(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function onRequestOptions() {
  return handleOptions();
}
