---
title: 热门文章
date: 2026-08-10 00:00:00
top_img: false
comment: false
description: 按浏览量排序的文章列表
---

<style>
#hot-posts-page { max-width: 820px; margin: 0 auto; }

#hot-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 24px;
  margin-bottom: 24px;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--card-box-shadow);
}
.hot-summary-item { text-align: center; }
.hot-summary-num {
  font-size: 1.8em;
  font-weight: 700;
  color: var(--text-highlight-color);
  line-height: 1.2;
}
.hot-summary-label {
  font-size: .85em;
  color: var(--card-meta);
  margin-top: 4px;
}
.hot-summary-divider {
  width: 1px;
  height: 40px;
  background: var(--light-grey);
  flex-shrink: 0;
}

.hot-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  margin-bottom: 10px;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--card-box-shadow);
  text-decoration: none;
  color: var(--font-color);
  transition: box-shadow .3s ease, transform .3s ease;
}
.hot-card:hover {
  box-shadow: var(--card-hover-box-shadow);
  transform: translateY(-2px);
}

.hot-rank {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1em;
  font-weight: 700;
  background: var(--text-highlight-color);
  color: #fff;
}

.hot-cover {
  flex-shrink: 0;
  width: 72px;
  height: 54px;
  border-radius: 8px;
  overflow: hidden;
}
.hot-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hot-info { flex: 1; min-width: 0; }
.hot-title {
  font-size: 1.05em;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color .3s;
}
.hot-card:hover .hot-title { color: var(--btn-bg); }
.hot-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  font-size: .8em;
  color: var(--card-meta);
}
.hot-meta i { margin-right: 4px; }
.hot-cat {
  padding: 1px 8px;
  border-radius: 4px;
  background: rgba(128, 128, 128, .2);
  color: var(--text-highlight-color);
}

.hot-pv {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: .9em;
  color: var(--card-meta);
  white-space: nowrap;
}
.hot-pv i { color: var(--text-highlight-color); }

.hot-loading, .hot-error, .hot-empty {
  text-align: center;
  padding: 40px;
  color: var(--card-meta);
}
.hot-loading i, .hot-error i { margin-right: 8px; }

@media (max-width: 768px) {
  .hot-cover { display: none; }
  #hot-summary { gap: 20px; padding: 16px; }
  .hot-summary-num { font-size: 1.4em; }
  .hot-card { padding: 12px 14px; gap: 10px; }
  .hot-rank { width: 28px; height: 28px; font-size: .9em; }
}

[data-theme="dark"] .hot-summary-num,
[data-theme="dark"] .hot-card:hover .hot-title,
[data-theme="dark"] .hot-cat,
[data-theme="dark"] .hot-pv i {
  color: #6cb6ff;
}
[data-theme="dark"] .hot-rank {
  background: #6cb6ff;
}
[data-theme="dark"] .hot-cat {
  background: rgba(108, 182, 255, .15);
}
</style>

<div id="hot-posts-page">
  <div id="hot-summary"></div>
  <div id="hot-posts-list">
    <div class="hot-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载中...</div>
  </div>
</div>

<script src="/js/hot.js" defer></script>
