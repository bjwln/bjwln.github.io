(function () {
  'use strict';

  function formatNumber(n) {
    return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    var list = document.getElementById('hot-posts-list');
    if (!list) return;

    Promise.all([
      fetch('/hot-posts.json').then(function (r) { return r.json(); }),
      fetch('/api/all').then(function (r) { return r.json(); }).catch(function () { return { data: [] }; })
    ]).then(function (results) {
      var posts = results[0];
      var pvData = results[1];
      if (!Array.isArray(posts)) posts = [];

      var pvMap = {};
      (pvData.data || []).forEach(function (item) {
        // D1 stores URL-decoded paths (from window.location.pathname),
        // so decode them to match hot-posts.json which stores raw paths
        var decodedPath;
        try { decodedPath = decodeURIComponent(item.path); } catch (e) { decodedPath = item.path; }
        pvMap[decodedPath] = { pv: item.pv || 0, uv: item.uv || 0 };
      });

      var totalViews = 0;
      posts.forEach(function (post) {
        var v = pvMap[post.path] || { pv: 0, uv: 0 };
        post.pv = v.pv;
        post.uv = v.uv;
        totalViews += v.pv;
      });

      posts.sort(function (a, b) {
        if (b.pv !== a.pv) return b.pv - a.pv;
        return new Date(b.date) - new Date(a.date);
      });

      renderSummary(totalViews, posts.length);
      renderList(list, posts);
    }).catch(function () {
      list.innerHTML = '<div class="hot-error"><i class="fa-solid fa-circle-exclamation"></i> 数据加载失败，请刷新重试</div>';
    });
  }

  function renderSummary(totalViews, totalPosts) {
    var el = document.getElementById('hot-summary');
    if (!el) return;
    el.innerHTML =
      '<div class="hot-summary-item">' +
        '<div class="hot-summary-num">' + totalPosts + '</div>' +
        '<div class="hot-summary-label">篇文章</div>' +
      '</div>' +
      '<div class="hot-summary-divider"></div>' +
      '<div class="hot-summary-item">' +
        '<div class="hot-summary-num">' + formatNumber(totalViews) + '</div>' +
        '<div class="hot-summary-label">总浏览量</div>' +
      '</div>';
  }

  function renderList(list, posts) {
    if (!posts.length) {
      list.innerHTML = '<div class="hot-empty">暂无文章</div>';
      return;
    }

    var html = posts.map(function (post, index) {
      var rank = index + 1;
      var rankClass = rank <= 3 ? 'hot-rank hot-rank-' + rank : 'hot-rank';
      var coverHtml = post.cover
        ? '<div class="hot-cover"><img src="' + escapeHtml(post.cover) + '" alt="" loading="lazy" onerror="this.parentNode.style.display=\'none\'"></div>'
        : '';
      var catHtml = post.categories && post.categories.length
        ? '<span class="hot-cat">' + escapeHtml(post.categories[0]) + '</span>'
        : '';

      return (
        '<a class="hot-card" href="' + escapeHtml(post.path) + '/">' +
          '<div class="' + rankClass + '">' + rank + '</div>' +
          coverHtml +
          '<div class="hot-info">' +
            '<div class="hot-title">' + escapeHtml(post.title) + '</div>' +
            '<div class="hot-meta">' +
              '<span><i class="far fa-calendar-alt"></i>' + post.date + '</span>' +
              catHtml +
            '</div>' +
          '</div>' +
          '<div class="hot-pv">' +
            '<i class="far fa-eye"></i>' +
            '<span>' + formatNumber(post.pv) + '</span>' +
          '</div>' +
        '</a>'
      );
    }).join('');

    list.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();
