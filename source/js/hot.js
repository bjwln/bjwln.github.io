(function () {
  'use strict';

  var allPosts = [];
  var state = { cat: '全部', q: '' };
  var mode = 'pv';

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

  // 封面相对路径转绝对路径并编码空格
  function coverSrc(cover) {
    if (!cover) return '';
    var v = String(cover);
    if (v.indexOf('http') === 0 || v.charAt(0) === '/') return encodeURI(v);
    return encodeURI('/' + v.replace(/^\.?\//, ''));
  }

  function init() {
    var list = document.getElementById('hot-posts-list');
    if (!list) return;
    var page = document.getElementById('hot-posts-page');
    mode = page ? (page.getAttribute('data-sort') || 'pv') : 'pv';

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

      posts.forEach(function (post) {
        var v = pvMap[post.path] || { pv: 0, uv: 0 };
        post.pv = v.pv;
        post.uv = v.uv;
      });

      if (mode === 'date') {
        // 分类页:按发布时间倒序,便于定位最新笔记
        posts.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      } else {
        posts.sort(function (a, b) {
          if (b.pv !== a.pv) return b.pv - a.pv;
          return new Date(b.date) - new Date(a.date);
        });
        // 全局排名（按浏览量），只有整体前 3 名显示角标
        posts.forEach(function (post, i) { post.rank = i + 1; });
      }

      allPosts = posts;
      buildCats();
      render();
      bindToolbar();
    }).catch(function () {
      list.innerHTML = '<div class="hot-error"><i class="fa-solid fa-circle-exclamation"></i> 数据加载失败，请刷新重试</div>';
    });
  }

  function buildCats() {
    var box = document.getElementById('hot-cats');
    if (!box) return;
    var seen = {};
    var cats = [];
    allPosts.forEach(function (p) {
      (p.categories || []).forEach(function (c) {
        if (!seen[c]) {
          seen[c] = true;
          cats.push(c);
        }
      });
    });
    var html = '<button class="hot-chip is-active" data-cat="全部">全部</button>';
    cats.forEach(function (c) {
      html += '<button class="hot-chip" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    });
    box.innerHTML = html;
    box.addEventListener('click', function (e) {
      var chip = e.target.closest('.hot-chip');
      if (!chip) return;
      box.querySelectorAll('.hot-chip').forEach(function (el) {
        el.classList.toggle('is-active', el === chip);
      });
      state.cat = chip.getAttribute('data-cat');
      render();
    });
  }

  function bindToolbar() {
    var input = document.getElementById('hot-search-input');
    if (!input) return;
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = input.value.trim().toLowerCase();
        render();
      }, 180);
    });
  }

  function filtered() {
    return allPosts.filter(function (p) {
      if (state.cat !== '全部' && (p.categories || []).indexOf(state.cat) === -1) return false;
      if (state.q) {
        var hay = (p.title + ' ' + (p.excerpt || '') + ' ' + (p.categories || []).join(' ')).toLowerCase();
        if (hay.indexOf(state.q) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var list = document.getElementById('hot-posts-list');
    if (!list) return;
    var posts = filtered();

    if (!posts.length) {
      list.innerHTML = '<div class="hot-empty"><i class="fa-regular fa-face-smile"></i> 没有匹配的文章</div>';
      return;
    }

    var html = posts.map(function (post, index) {
      var rankChip = (mode !== 'date' && post.rank <= 3)
        ? '<span class="hot-rank-chip">热门 No.' + post.rank + '</span>'
        : '';
      var coverHtml = post.cover
        ? '<div class="hot-card-cover">' + rankChip +
            '<img src="' + coverSrc(post.cover) + '" alt="" loading="lazy" ' +
            'onerror="this.style.display=\'none\'"></div>'
        : '';
      var catHtml = (post.categories || []).map(function (c) {
        return '<span class="hot-cat">' + escapeHtml(c) + '</span>';
      }).join('');
      var desc = post.excerpt
        ? '<p class="hot-card-desc">' + escapeHtml(post.excerpt) + '</p>'
        : '';
      var delay = Math.min(index * 90, 1100);

      return (
        '<a class="hot-card" href="' + escapeHtml(post.path) + '/" style="animation-delay:' + delay + 'ms">' +
          coverHtml +
          '<div class="hot-card-body">' +
            '<div class="hot-card-title">' + escapeHtml(post.title) + '</div>' +
            '<div class="hot-card-tags">' +
              '<span class="hot-card-date"><i class="far fa-calendar-alt"></i> ' + post.date + '</span>' +
              catHtml +
            '</div>' +
            desc +
            '<div class="hot-card-foot">' +
              '<span class="hot-pv"><i class="far fa-eye"></i>' + formatNumber(post.pv) + ' 次浏览</span>' +
              '<span><i class="fas fa-arrow-right" style="transform:rotate(-45deg)"></i></span>' +
            '</div>' +
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
