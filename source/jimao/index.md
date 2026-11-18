---
title: 几猫港区 · Jimao Port
date: 2026-11-17 00:00:00
top_img: false
aside: false
comment: false
description: 浏览器第一人称射击——雨没停,天没亮。五分钟内切断堆场、仓库、码头三处中继,登船撤离
---

<link rel="stylesheet" href="/css/jimao.css?v=20261118v">

<div class="jimao-wrap">

<div class="jimao-head">
<span class="jimao-index">[5].</span>
<div class="jimao-title-box">
<span class="jimao-title">几猫港区 ・ Jimao Port</span>
<span class="jimao-sub">FIRST-PERSON OPS · 浏览器 FPS · THREE.JS</span>
</div>
<span class="jimao-chips">
<span class="jimao-chip">键鼠 + 触屏</span>
<span class="jimao-chip">05:42 限时</span>
<span class="jimao-chip">本地单机</span>
</span>
</div>

<div id="jm-stage" class="jm-stage">
<a class="jm-back" href="/moyu/"><i class="fas fa-arrow-left"></i> 返回摸鱼</a>
<div class="jm-badge">几猫港区 · JIMAO PORT</div>
<div id="jm-damage" class="jm-damage" aria-hidden="true"></div>
<div class="jm-vignette" aria-hidden="true"></div>
<div class="jm-grain" aria-hidden="true"></div>

<div id="jm-hud" class="jm-hud" hidden>
<div class="jm-compass"><div class="jm-compass-tape" id="jm-compass-tape"></div><i class="jm-compass-needle"></i></div>
<div class="jm-objectives">
<div class="jm-obj-head">任务目标<span class="jm-timer" id="jm-timer">05:42</span></div>
<div class="jm-obj" id="jm-obj-0"><i class="jm-obj-dot"></i><span>切断 · 堆场中继</span><b class="jm-obj-dist" id="jm-obj-dist-0"></b></div>
<div class="jm-obj" id="jm-obj-1"><i class="jm-obj-dot"></i><span>切断 · 仓库中继</span><b class="jm-obj-dist" id="jm-obj-dist-1"></b></div>
<div class="jm-obj" id="jm-obj-2"><i class="jm-obj-dot"></i><span>切断 · 码头中继</span><b class="jm-obj-dist" id="jm-obj-dist-2"></b></div>
<div class="jm-obj jm-obj-ext" id="jm-obj-ext" hidden><i class="jm-obj-dot"></i><span>前往四号泊位 · 登船撤离</span></div>
</div>
<div class="jm-health" id="jm-health"><div class="jm-health-bar"><div class="jm-health-fill" id="jm-health-fill"></div></div><span class="jm-health-num" id="jm-health-num">100</span></div>
<div class="jm-ammo"><div class="jm-ammo-num"><b id="jm-ammo-mag">30</b><span>/ <i id="jm-ammo-res">150</i></span></div><div class="jm-ammo-warn" id="jm-ammo-warn" hidden>弹药不足</div><div class="jm-ammo-name" id="jm-ammo-name">几猫九式·改</div></div>
<div class="jm-cross" id="jm-cross"><i></i><i></i><i></i><i></i><u></u></div>
<div class="jm-reticle" id="jm-reticle"><i></i></div>
<div class="jm-hitmark" id="jm-hitmark"><i></i><i></i><i></i><i></i></div>
<div class="jm-prompt" id="jm-prompt" hidden><span class="jm-prompt-key">E</span><span class="jm-prompt-text" id="jm-prompt-text">切断中继</span><div class="jm-prompt-bar"><div class="jm-prompt-fill" id="jm-prompt-fill"></div></div></div>
<div class="jm-sub" id="jm-sub"><b id="jm-sub-who">指挥中心</b><span id="jm-sub-text"></span></div>
<div class="jm-tip" id="jm-tip" hidden></div>
</div>

<div id="jm-touch" class="jm-touch" hidden>
<button class="jm-tbtn jm-tbtn-pause" data-act="pause" type="button">II</button>
<div class="jm-stick-zone" id="jm-stick-zone"><div class="jm-stick" id="jm-stick"><i class="jm-stick-knob" id="jm-stick-knob"></i></div></div>
<div class="jm-tbtns">
<button class="jm-tbtn jm-tbtn-fire" data-act="fire" type="button">开火</button>
<button class="jm-tbtn" data-act="ads" type="button">瞄准</button>
<button class="jm-tbtn" data-act="reload" type="button">换弹</button>
<button class="jm-tbtn" data-act="swap" type="button">切换</button>
<button class="jm-tbtn" data-act="jump" type="button">跳</button>
<button class="jm-tbtn" data-act="crouch" type="button">蹲</button>
<button class="jm-tbtn jm-tbtn-use" data-act="use" type="button" hidden>互动</button>
</div>
</div>

<div id="jm-loading" class="jm-loading">
<div class="jm-loading-title">几 猫</div>
<div class="jm-loading-sub" id="jm-loading-sub">正在准备脊峰画面</div>
<div class="jm-loading-bar"><div class="jm-loading-fill" id="jm-loading-fill"></div></div>
</div>

<div id="jm-menu" class="jm-menu" hidden>
<div class="jm-menu-inner">
<div class="jm-menu-left">
<div class="jm-menu-meta"><b>B4</b><span>几猫突击小队 · 几猫港区 · 四号泊位</span><b class="jm-menu-clock">05:42</b></div>
<h1 class="jm-menu-title">几 猫</h1>
<div class="jm-menu-tag">3A大作</div>
<p class="jm-menu-brief">港区主控 AI「绫」凌晨倒戈,泊区防御网反转。切断堆场、仓库、码头三处中继,赶在 05:42 封港前登上撤离艇。</p>
<div class="jm-menu-best" id="jm-menu-best" hidden></div>
<div class="jm-menu-btns">
<button class="jm-btn jm-btn-primary" id="jm-btn-start" type="button">开始行动</button>
<button class="jm-btn" id="jm-btn-help" type="button">操作说明</button>
<button class="jm-btn" id="jm-btn-about" type="button">项目介绍</button>
<button class="jm-btn" id="jm-btn-settings" type="button">设置</button>
</div>
<div class="jm-menu-ver">v1.1.0 · 本地单机 · 贴图与音效全部由代码实时生成,无需下载 · 开发体验版</div>
</div>
<div class="jm-menu-keys">
<div class="jm-keys-title">操作说明 · CONTROLS</div>
<div class="jm-keys-grid">
<span><b>W A S D</b>移动</span><span><b>鼠标</b>视角</span><span><b>左键</b>开火</span><span><b>右键</b>瞄准</span>
<span><b>R</b>换弹</span><span><b>E</b>互动 · 切断</span><span><b>SPACE</b>跳跃</span><span><b>SHIFT</b>冲刺</span>
<span><b>C</b>蹲伏</span><span><b>ESC</b>暂停</span>
</div>
<span class="jm-keys-touch">触屏:左手拇指移动 · 右手拇指转动视角 · 屏幕按钮开火</span>
</div>
</div>
</div>

<div id="jm-pause" class="jm-overlay" hidden>
<div class="jm-panel">
<h2>行动暂停</h2>
<p class="jm-panel-sub">港区不会等你太久。</p>
<div class="jm-panel-btns">
<button class="jm-btn jm-btn-primary" id="jm-btn-resume" type="button">继续行动</button>
<button class="jm-btn" id="jm-btn-restart" type="button">重新开始</button>
<button class="jm-btn" id="jm-btn-psettings" type="button">设置</button>
<a class="jm-btn jm-btn-ghost" href="/moyu/">返回摸鱼</a>
</div>
</div>
</div>

<div id="jm-result" class="jm-overlay" hidden>
<div class="jm-panel">
<h2 id="jm-result-title">任务完成</h2>
<p class="jm-panel-sub" id="jm-result-desc"></p>
<div class="jm-result-stats" id="jm-result-stats"></div>
<div class="jm-panel-btns">
<button class="jm-btn jm-btn-primary" id="jm-btn-again" type="button">再来一局</button>
<a class="jm-btn jm-btn-ghost" href="/moyu/">返回摸鱼</a>
</div>
</div>
</div>

<div id="jm-modal" class="jm-overlay" hidden>
<div class="jm-panel jm-panel-wide">
<h2 id="jm-modal-title"></h2>
<div class="jm-modal-body" id="jm-modal-body"></div>
<div class="jm-panel-btns"><button class="jm-btn" id="jm-modal-close" type="button">关闭</button></div>
</div>
</div>

<div class="jm-webgl-err" id="jm-webgl-err" hidden>你的浏览器暂时不支持 WebGL,换一个现代浏览器再来执行这次行动吧。</div>
</div>

<p class="jimao-foot">灵感致敬小红书 @7Hui「几猫」网页 FPS 概念演示 · Three.js r152 · 贴图与音效全部由代码实时生成,无外部资源、无联网 · 键盘鼠标体验最佳,手机可用触屏操作</p>

</div>

<script type="module" src="/js/jimao.js?v=20261118v"></script>
