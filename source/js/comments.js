// Cloudflare Worker + D1 评论组件 (配合 count-worker)
(function () {
  'use strict';

  var WORKER_URL = 'https://counter.tysweb.site';
  var STORAGE_KEY = 'cf_comment_user';
  var MAX_CONTENT = 1000;

  function getPagePath() {
    return window.location.pathname.replace(/\/$/, '') || '/';
  }

  // 仅文章页渲染: 有 #article-container 且路径不是首页/归档/分类/标签
  function isPostPage() {
    if (!document.getElementById('article-container')) return false;
    var p = window.location.pathname;
    if (p === '/' || p.indexOf('/page/') === 0) return false;
    if (p.indexOf('/archives/') === 0 || p === '/archives') return false;
    if (p.indexOf('/categories/') === 0 || p === '/categories') return false;
    if (p.indexOf('/tags/') === 0 || p === '/tags') return false;
    return true;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 转义后保留换行, 内容安全渲染
  function formatContent(str) {
    return escapeHtml(str).replace(/\n/g, '<br>');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveUser(u) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch (e) {}
  }

  function formatTime(ts) {
    var now = Date.now();
    var diff = Math.floor((now - ts) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function nicknameLink(c) {
    if (c.website) {
      return '<a href="' + escapeHtml(c.website) +
        '" target="_blank" rel="nofollow noopener noreferrer" class="cf-cmt-author">' +
        escapeHtml(c.nickname) + '</a>';
    }
    return '<span class="cf-cmt-author">' + escapeHtml(c.nickname) + '</span>';
  }

  function buildCommentHTML(c) {
    return (
      '<div class="cf-cmt-item' + (c.parent_id ? ' cf-cmt-reply-item' : '') + '" data-id="' + c.id + '">' +
      '<img class="cf-cmt-avatar" src="' + escapeHtml(c.avatar) + '" alt="avatar" loading="lazy">' +
      '<div class="cf-cmt-body">' +
      '<div class="cf-cmt-head">' +
      nicknameLink(c) +
      '<span class="cf-cmt-time">' + formatTime(c.created_at) + '</span>' +
      '<span class="cf-cmt-reply-btn" data-id="' + c.id + '" role="button" tabindex="0">回复</span>' +
      '</div>' +
      '<div class="cf-cmt-text">' + formatContent(c.content) + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  // 扁平列表 -> 两层树 (顶层评论 + 其回复)
  function renderTree(comments) {
    var tops = [];
    var replies = {};
    comments.forEach(function (c) {
      if (c.parent_id) {
        if (!replies[c.parent_id]) replies[c.parent_id] = [];
        replies[c.parent_id].push(c);
      } else {
        tops.push(c);
      }
    });
    var html = '';
    tops.forEach(function (c) {
      html += buildCommentHTML(c);
      var rs = replies[c.id] || [];
      if (rs.length) {
        html += '<div class="cf-cmt-replies">';
        rs.forEach(function (r) { html += buildCommentHTML(r); });
        html += '</div>';
      }
    });
    return html;
  }

  function loadComments(container) {
    var path = getPagePath();
    var listEl = container.querySelector('.cf-cmt-list');
    listEl.innerHTML = '<div class="cf-cmt-loading">加载中…</div>';
    fetch(WORKER_URL + '/api/comments?path=' + encodeURIComponent(path))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var arr = (data && data.data) || [];
        var countEl = container.querySelector('.cf-cmt-count-num');
        if (countEl) countEl.textContent = arr.length;
        if (!arr.length) {
          listEl.innerHTML = '<div class="cf-cmt-empty">还没有评论，快来抢沙发吧～</div>';
          return;
        }
        listEl.innerHTML = renderTree(arr);
      })
      .catch(function () {
        listEl.innerHTML = '<div class="cf-cmt-empty">评论加载失败，稍后重试</div>';
      });
  }

  function getFormValues(form) {
    return {
      nickname: (form.querySelector('[name=nickname]') || {}).value,
      email: (form.querySelector('[name=email]') || {}).value,
      website: (form.querySelector('[name=website]') || {}).value,
      content: (form.querySelector('[name=content]') || {}).value,
    };
  }

  function submitComment(payload, form, container) {
    var btn = form.querySelector('.cf-cmt-submit');
    var msgEl = form.querySelector('.cf-cmt-msg');
    btn.disabled = true;
    btn.textContent = '提交中…';
    msgEl.textContent = '';

    fetch(WORKER_URL + '/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { status: r.status, data: d }; });
      })
      .then(function (res) {
        if (res.status === 200 && res.data.ok) {
          saveUser({
            nickname: payload.nickname,
            email: payload.email,
            website: payload.website || '',
          });
          var contentEl = form.querySelector('[name=content]');
          if (contentEl) contentEl.value = '';
          if (form.querySelector('.cf-cmt-counter')) {
            form.querySelector('.cf-cmt-counter').textContent = '0/' + MAX_CONTENT;
          }
          msgEl.textContent = '评论成功';
          msgEl.className = 'cf-cmt-msg cf-cmt-ok';
          loadComments(container);
          if (form.getAttribute('data-reply') === '1') {
            form.parentNode.removeChild(form);
          }
        } else if (res.status === 429) {
          msgEl.textContent = '提交太频繁，请 1 分钟后再试';
          msgEl.className = 'cf-cmt-msg cf-cmt-err';
        } else {
          msgEl.textContent = '提交失败：' + (res.data.error || '未知错误');
          msgEl.className = 'cf-cmt-msg cf-cmt-err';
        }
      })
      .catch(function () {
        msgEl.textContent = '网络错误，请稍后重试';
        msgEl.className = 'cf-cmt-msg cf-cmt-err';
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = form.getAttribute('data-reply') === '1' ? '回复' : '发表评论';
      });
  }

  function buildReplyForm() {
    var div = document.createElement('div');
    div.className = 'cf-cmt-reply-form';
    div.setAttribute('data-reply', '1');
    div.innerHTML =
      '<textarea name="content" class="cf-cmt-input cf-cmt-textarea" placeholder="写下你的回复…" maxlength="1000" rows="3"></textarea>' +
      '<div class="cf-cmt-reply-actions">' +
      '<button type="button" class="cf-cmt-submit">回复</button>' +
      '<button type="button" class="cf-cmt-cancel">取消</button>' +
      '<span class="cf-cmt-msg"></span>' +
      '</div>';
    return div;
  }

  function bindEvents(container) {
    var path = getPagePath();

    var form = container.querySelector('.cf-cmt-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = getFormValues(form);
      var msg = form.querySelector('.cf-cmt-msg');
      if (!v.nickname || !v.nickname.trim()) {
        msg.textContent = '请填写昵称'; msg.className = 'cf-cmt-msg cf-cmt-err'; return;
      }
      if (!v.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
        msg.textContent = '请填写有效邮箱'; msg.className = 'cf-cmt-msg cf-cmt-err'; return;
      }
      if (!v.content || !v.content.trim()) {
        msg.textContent = '请填写评论内容'; msg.className = 'cf-cmt-msg cf-cmt-err'; return;
      }
      submitComment({
        path: path,
        nickname: v.nickname.trim(),
        email: v.email.trim(),
        website: (v.website || '').trim(),
        content: v.content.trim(),
      }, form, container);
    });

    var textarea = form.querySelector('[name=content]');
    var counter = form.querySelector('.cf-cmt-counter');
    textarea.addEventListener('input', function () {
      counter.textContent = textarea.value.length + '/' + MAX_CONTENT;
    });

    // 回复/提交/取消: 事件委托, 兼容动态渲染
    container.addEventListener('click', function (e) {
      var replyBtn = e.target.closest('.cf-cmt-reply-btn');
      if (replyBtn) {
        var item = replyBtn.closest('.cf-cmt-item, .cf-cmt-reply-item');
        var parentId = replyBtn.getAttribute('data-id');
        var existing = container.querySelector('.cf-cmt-reply-form[data-for="' + parentId + '"]');
        if (existing) { existing.parentNode.removeChild(existing); return; }
        var all = container.querySelectorAll('.cf-cmt-reply-form');
        all.forEach(function (f) { f.parentNode.removeChild(f); });

        var replyForm = buildReplyForm();
        replyForm.setAttribute('data-for', parentId);
        var anchor = item.classList.contains('cf-cmt-reply-item') ? item.parentNode : item;
        anchor.parentNode.insertBefore(replyForm, anchor.nextSibling);
        var ta = replyForm.querySelector('[name=content]');
        setTimeout(function () { ta && ta.focus(); }, 0);
        return;
      }

      if (e.target.classList.contains('cf-cmt-cancel')) {
        var f = e.target.closest('.cf-cmt-reply-form');
        if (f) f.parentNode.removeChild(f);
        return;
      }
      if (e.target.classList.contains('cf-cmt-submit') &&
          e.target.closest('.cf-cmt-reply-form')) {
        var rform = e.target.closest('.cf-cmt-reply-form');
        var pid = rform.getAttribute('data-for');
        var rcontent = rform.querySelector('[name=content]').value.trim();
        var rmsg = rform.querySelector('.cf-cmt-msg');
        if (!rcontent) {
          rmsg.textContent = '请填写回复内容'; rmsg.className = 'cf-cmt-msg cf-cmt-err'; return;
        }
        var u = getUser();
        if (!u.nickname || !u.email) {
          rmsg.textContent = '请先在下方评论框填写昵称和邮箱'; rmsg.className = 'cf-cmt-msg cf-cmt-err'; return;
        }
        submitComment({
          path: path,
          parent_id: Number(pid),
          nickname: u.nickname,
          email: u.email,
          website: u.website || '',
          content: rcontent,
        }, rform, container);
      }
    });
  }

  function render() {
    if (!isPostPage()) return;
    var post = document.getElementById('post');
    if (!post) return;
    if (document.getElementById('cf-comments')) return;

    var user = getUser();
    var wrap = document.createElement('div');
    wrap.id = 'cf-comments';
    wrap.className = 'cf-cmt-container';
    wrap.innerHTML =
      '<div class="cf-cmt-title"><i class="far fa-comment-dots"></i> 评论 <span class="cf-cmt-count-num">0</span> 条</div>' +
      '<form class="cf-cmt-form">' +
      '  <div class="cf-cmt-row">' +
      '    <input name="nickname" class="cf-cmt-input" type="text" placeholder="昵称 *" maxlength="30" value="' + escapeHtml(user.nickname || '') + '">' +
      '    <input name="email" class="cf-cmt-input" type="email" placeholder="邮箱 * (不公开, 用于头像)" maxlength="100" value="' + escapeHtml(user.email || '') + '">' +
      '    <input name="website" class="cf-cmt-input" type="text" placeholder="网站 (可选)" maxlength="200" value="' + escapeHtml(user.website || '') + '">' +
      '  </div>' +
      '  <textarea name="content" class="cf-cmt-input cf-cmt-textarea" placeholder="说点什么吧… (支持 Markdown 换行)" maxlength="1000" rows="4"></textarea>' +
      '  <div class="cf-cmt-foot">' +
      '    <span class="cf-cmt-counter">0/' + MAX_CONTENT + '</span>' +
      '    <button type="submit" class="cf-cmt-submit">发表评论</button>' +
      '    <span class="cf-cmt-msg"></span>' +
      '  </div>' +
      '</form>' +
      '<div class="cf-cmt-list"></div>';

    post.appendChild(wrap);
    bindEvents(wrap);
    loadComments(wrap);
  }

  function init() {
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();
