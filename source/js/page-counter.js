// Cloudflare Worker 浏览量计数器 (D1 版本)
(function () {
  'use strict';

  var WORKER_URL = 'https://numberofvisitors.121986004.workers.dev';
  var CACHE_KEY = 'blog_view_cache';
  var CACHE_TTL = 5 * 60 * 1000;

  function getPagePath() {
    return window.location.pathname.replace(/\/$/, '') || '/';
  }

  function getCache(path) {
    try {
      var data = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (data && data[path] && Date.now() - data[path].time < CACHE_TTL) {
        return data[path];
      }
    } catch (e) {}
    return null;
  }

  function setCache(path, pv, uv) {
    try {
      var data = JSON.parse(sessionStorage.getItem(CACHE_KEY)) || {};
      data[path] = { pv: pv, uv: uv, time: Date.now() };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function fetchViewCount(path) {
    var cached = getCache(path);
    if (cached !== null) {
      return Promise.resolve(cached.pv);
    }

    return fetch(WORKER_URL + '/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var pv = data.pv || 0;
        var uv = data.uv || 0;
        setCache(path, pv, uv);
        return pv;
      })
      .catch(function () {
        return (cached && cached.pv) || 0;
      });
  }

  function peekViewCount(path) {
    var cached = getCache(path);
    if (cached !== null) {
      return Promise.resolve(cached.pv);
    }

    return fetch(WORKER_URL + '/api/pv?path=' + encodeURIComponent(path))
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.pv || 0; })
      .catch(function () { return 0; });
  }

  function renderPostViewCount() {
    if (!document.getElementById('post')) return;
    if (document.getElementById('cf-view-counter')) return;

    var path = getPagePath();
    var meta = document.querySelector('.meta-secondline');
    if (!meta) return;

    var el = document.createElement('span');
    el.id = 'cf-view-counter';
    el.innerHTML =
      '<span class="post-meta-separator">|</span>' +
      '<span class="post-meta-viewcount">' +
      '  <i class="far fa-eye fa-fw post-meta-icon"></i>' +
      '  <span class="post-meta-label">阅读量:</span>' +
      '  <span id="cf-view-count-num"><i class="fa-solid fa-spinner fa-spin"></i></span>' +
      '</span>';

    meta.appendChild(el);

    fetchViewCount(path).then(function (pv) {
      var numEl = document.getElementById('cf-view-count-num');
      if (numEl) numEl.textContent = pv;
    });
  }

  function renderRecentPostViewCount() {
    var posts = document.querySelectorAll('#recent-posts .recent-post-item');
    if (!posts.length) return;

    posts.forEach(function (post) {
      var link = post.querySelector('.article-title a');
      if (!link) return;
      if (post.querySelector('.cf-list-view')) return;

      var path = link.getAttribute('href').replace(/\/$/, '') || '/';
      var meta = post.querySelector('.post-meta-date');
      if (!meta) return;

      var el = document.createElement('span');
      el.className = 'cf-list-view';
      el.innerHTML =
        '<span class="post-meta-separator">|</span>' +
        '<span><i class="far fa-eye fa-fw post-meta-icon"></i>' +
        '<span id="cf-list-' + path.replace(/\//g, '-') + '"><i class="fa-solid fa-spinner fa-spin"></i></span></span>';

      meta.parentNode.insertBefore(el, meta.nextSibling);

      peekViewCount(path).then(function (pv) {
        var numEl = document.getElementById('cf-list-' + path.replace(/\//g, '-'));
        if (numEl) numEl.textContent = pv;
      });
    });
  }

  function init() {
    renderPostViewCount();
    renderRecentPostViewCount();
  }

  // 脚本在 body 底部执行，DOM 已就绪，直接执行
  // 但如果用了 defer，DOMContentLoaded 可能还没触发，两种都处理
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOMContentLoaded 已经触发过了，直接执行
    init();
  }

  // pjax 切页重新绑定
  document.addEventListener('pjax:complete', init);
})();