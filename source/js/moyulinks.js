/* ============================================================
 * 摸鱼页 · 实用工具推荐弹框（数据: /data/moyulinks.json，后台可编辑）
 * 点击「实用工具 · 推荐」卡片弹出；遮罩/×/ESC 均可关闭
 * ============================================================ */
(function () {
  'use strict';
  var modal = document.getElementById('moyu-links-modal');
  var listEl = document.getElementById('moyu-links-list');
  var card = document.getElementById('moyu-links-card');
  if (!modal || !listEl || !card) return;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function renderItems(links) {
    listEl.innerHTML = links.map(function (l) {
      var name = esc(l.name || '未命名');
      var letter = (l.name || '?').trim().charAt(0).toUpperCase();
      var initial = /[\u4e00-\u9fa5a-zA-Z0-9]/.test(letter) ? letter : '★';
      return '<a class="mlm-item" href="' + esc(l.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="mlink-badge">' + esc(initial) + '</span>' +
        '<span class="mlm-body"><b class="mlm-name">' + name + '<i class="fas fa-arrow-up-right-from-square"></i></b>' +
        '<span class="mlm-desc">' + esc(l.desc || '') + '</span></span>' +
        '</a>';
    }).join('');
  }

  function open() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  card.addEventListener('click', open);
  document.getElementById('moyu-links-close').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
  // 弹框里的链接点击后顺势关闭弹框
  listEl.addEventListener('click', function (e) {
    if (e.target.closest('a')) close();
  });

  fetch('/data/moyulinks.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      var links = Array.isArray(data && data.links) ? data.links : [];
      var empty = document.getElementById('moyu-links-empty');
      var count = document.getElementById('moyu-links-count');
      if (count) count.textContent = links.length ? '已收录 ' + links.length + ' 个' : '';
      if (!links.length) {
        listEl.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
      }
      renderItems(links);
    })
    .catch(function () {
      listEl.innerHTML = '<div class="m-links-error">推荐数据加载失败，刷新重试</div>';
    });
})();
