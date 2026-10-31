---
title: 热门文章
date: 2026-08-10 00:00:00
top_img: false
comment: false
description: 按浏览量排序的文章卡片墙
---

<link rel="stylesheet" href="/css/hot-wall.css?v=20261031b">

<div id="hot-posts-page">
  <div class="hot-toolbar">
    <div class="hot-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input id="hot-search-input" type="text" placeholder="搜索文章..." autocomplete="off" />
    </div>
    <div class="hot-cats" id="hot-cats"></div>
  </div>
  <div id="hot-posts-list" class="hot-grid">
    <div class="hot-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载中...</div>
  </div>
</div>

<script src="/js/hot.js?v=20261031b" defer></script>
