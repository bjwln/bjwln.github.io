---
title: 热门文章
date: 2026-08-10 00:00:00
top_img: false
comment: false
description: 按浏览量排序的文章卡片墙
---

<link rel="stylesheet" href="/css/hot-wall.css?v=20261108b">

<header class="starlite-hero">
<span class="sh-icon"><svg viewBox="0 0 48 56" width="33" height="39"><path d="M24 4 C30 14 40 18 40 32 A16 16 0 0 1 8 32 C8 24 13 20 16 14 C18 20 22 21 24 16 C26 12 25 8 24 4 Z"/><path d="M24 44 C20 44 17 41 17 37 C17 33 21 31 24 27 C27 31 31 33 31 37 C31 41 28 44 24 44 Z"/></svg></span>
<h1 class="sh-title">热门文章</h1>
<span class="sh-sub">TRENDING · BY VIEWS</span>
<p class="sh-motto">按浏览量排座次，数据不说谎。</p>
</header>

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
