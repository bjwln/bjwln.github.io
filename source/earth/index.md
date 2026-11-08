---
title: 地球 · The Earth
date: 2026-11-07 00:00:00
top_img: false
aside: false
comment: false
description: Three.js 渲染的 3D 地球——编号景点交互视角：灯塔、小船、沙滩、飞鸟、礁石，点击数字飞到该处放大查看全息景象
---

<link rel="stylesheet" href="/css/earth.css?v=20261109a">

<div class="earth-wrap">

<div class="earth-head">
<span class="earth-index">[4].</span>
<div class="earth-title-box">
<span class="earth-title">地球 ・ The Earth ・ 地球</span>
<span class="earth-sub">BLUE PLANET ROUTE · 蓝星航线 · THREE.JS</span>
</div>
<span class="earth-chips">
<span class="earth-chip" data-layer="planes">✈ 航班</span>
<span class="earth-chip" data-layer="quakes">🌍 地震</span>
<span class="earth-chip" data-layer="iss">🛰 ISS</span>
<span class="earth-chip" data-layer="dots">陆地点阵</span>
<span class="earth-chip" data-layer="border">国界线</span>
<span class="earth-chip" data-layer="flight">飞线</span>
<span class="earth-chip" data-layer="bars">柱状图</span>
<span class="earth-chip" data-layer="label">标签</span>
<span class="earth-chip" data-layer="ring">粒子光环</span>
<span class="earth-chip" data-layer="stars">星海</span>
</span>
</div>

<div id="earth-stage" class="earth-stage">
<a class="earth-back" href="/moyu/"><i class="fas fa-arrow-left"></i> 返回摸鱼</a>
<div class="earth-hint">拖动旋转 · 滚轮缩放 · 点击编号进入景点视角 · 双击返回</div>
<div class="earth-badge">THE EARTH · 蓝星航线</div>
<div class="earth-loading"><i class="fas fa-circle-notch fa-spin"></i>正在点亮地球…</div>
<div class="earth-error">你的浏览器暂时不支持 WebGL,换一个现代浏览器再来看看这颗星球吧。</div>
</div>

<p class="earth-live-hint">景点视角致敬 <a href="https://github.com/dragonir/3d" target="_blank" rel="noopener">dragonir/3d</a> 「[3]. 海岛 ・ IsLand ・ 小島」 · 实时数据源:OpenSky Network(航班) · USGS(地震) · WhereTheISS.at(空间站) — 公开数据,无需登录</p>

</div>

<script src="/js/lib/three.min.js"></script>
<script src="/js/earth-data.js?v=20261108a"></script>
<script src="/js/earth.js?v=20261109b" defer></script>
