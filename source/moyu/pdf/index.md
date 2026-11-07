---
title: PDF 工具箱
date: 2026-11-08 00:00:00
top_img: false
aside: false
comment: false
description: 纯浏览器本地的 PDF 小工具——合并、拆分、旋转、图片互转，文件不出浏览器
---

<link rel="stylesheet" href="/css/pdftool.css?v=20261108a">

<header class="starlite-hero">
<span class="sh-icon"><svg viewBox="0 0 48 56" width="33" height="39"><path d="M8 4 L30 4 L40 14 L40 52 L8 52 Z"/><path d="M30 4 L30 14 L40 14"/><path d="M15 24 L33 24 M15 31 L33 31 M15 38 L27 38"/></svg></span>
<h1 class="sh-title">PDF 工具箱</h1>
<span class="sh-sub">PDF TOOLKIT · LOCAL</span>
<p class="sh-motto">文件不出浏览器，处理完即走。</p>
</header>

<div id="pdf-app">

<div class="pt-tabs" role="tablist">
<button class="pt-tab is-active" data-tool="merge" type="button">合并</button>
<button class="pt-tab" data-tool="extract" type="button">提取页面</button>
<button class="pt-tab" data-tool="remove" type="button">删除页面</button>
<button class="pt-tab" data-tool="rotate" type="button">旋转</button>
<button class="pt-tab" data-tool="img2pdf" type="button">图片转 PDF</button>
<button class="pt-tab" data-tool="pdf2img" type="button">PDF 转图片</button>
</div>

<section class="pt-panel is-active" data-panel="merge">
<h2 class="pt-h">合并 PDF <small>多个文件按顺序合成一个</small></h2>
<label class="pt-file"><input type="file" id="merge-files" accept="application/pdf,.pdf" multiple><span><i class="fas fa-file-pdf"></i> 选择或拖入多个 PDF</span></label>
<ul class="pt-list" id="merge-list"></ul>
<div class="pt-actions"><button class="pt-btn" id="merge-run" type="button" disabled>合并并下载</button><span class="pt-err" id="merge-err"></span></div>
</section>

<section class="pt-panel" data-panel="extract">
<h2 class="pt-h">提取页面 <small>把选中的页导出为新 PDF</small></h2>
<label class="pt-file"><input type="file" id="extract-file" accept="application/pdf,.pdf"><span><i class="fas fa-file-pdf"></i> 选择一个 PDF</span></label>
<label class="pt-field">页码范围 <input id="extract-range" placeholder="如 1-3,5,8-（留空 = 全部）"></label>
<div class="pt-actions"><button class="pt-btn" id="extract-run" type="button" disabled>提取并下载</button><span class="pt-err" id="extract-err"></span></div>
</section>

<section class="pt-panel" data-panel="remove">
<h2 class="pt-h">删除页面 <small>删掉指定页后另存</small></h2>
<label class="pt-file"><input type="file" id="remove-file" accept="application/pdf,.pdf"><span><i class="fas fa-file-pdf"></i> 选择一个 PDF</span></label>
<label class="pt-field">要删除的页码 <input id="remove-range" placeholder="如 2,5-7（留空 = 不删）"></label>
<div class="pt-actions"><button class="pt-btn" id="remove-run" type="button" disabled>删除并下载</button><span class="pt-err" id="remove-err"></span></div>
</section>

<section class="pt-panel" data-panel="rotate">
<h2 class="pt-h">旋转页面 <small>整份或指定页旋转</small></h2>
<label class="pt-file"><input type="file" id="rotate-file" accept="application/pdf,.pdf"><span><i class="fas fa-file-pdf"></i> 选择一个 PDF</span></label>
<div class="pt-row">
<label class="pt-field">角度 <select id="rotate-angle"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>
<label class="pt-field">方向 <select id="rotate-dir"><option value="cw">顺时针</option><option value="ccw">逆时针</option></select></label>
<label class="pt-field pt-grow">页码范围 <input id="rotate-range" placeholder="留空 = 全部页面"></label>
</div>
<div class="pt-actions"><button class="pt-btn" id="rotate-run" type="button" disabled>旋转并下载</button><span class="pt-err" id="rotate-err"></span></div>
</section>

<section class="pt-panel" data-panel="img2pdf">
<h2 class="pt-h">图片转 PDF <small>JPG / PNG，每张一页</small></h2>
<label class="pt-file"><input type="file" id="img2pdf-files" accept="image/jpeg,image/png" multiple><span><i class="fas fa-images"></i> 选择多张图片（按选择顺序成页）</span></label>
<ul class="pt-list" id="img2pdf-list"></ul>
<div class="pt-actions"><button class="pt-btn" id="img2pdf-run" type="button" disabled>合成 PDF 并下载</button><span class="pt-err" id="img2pdf-err"></span></div>
</section>

<section class="pt-panel" data-panel="pdf2img">
<h2 class="pt-h">PDF 转图片 <small>逐页渲染为 PNG</small></h2>
<label class="pt-file"><input type="file" id="pdf2img-file" accept="application/pdf,.pdf"><span><i class="fas fa-file-pdf"></i> 选择一个 PDF</span></label>
<div class="pt-row">
<label class="pt-field pt-grow">页码范围 <input id="pdf2img-range" placeholder="留空 = 全部页面"></label>
<label class="pt-field">清晰度 <select id="pdf2img-scale"><option value="1.5">标准 1.5×</option><option value="2" selected>高清 2×</option><option value="3">超清 3×</option></select></label>
</div>
<div class="pt-actions"><button class="pt-btn" id="pdf2img-run" type="button" disabled>渲染图片</button><span class="pt-err" id="pdf2img-err"></span></div>
<div class="pt-results" id="pdf2img-results"></div>
</section>

<footer class="pt-foot">
<p>灵感来自开源项目 <a href="https://github.com/PDFCraftTool/PDFCraft" target="_blank" rel="noopener">PDFCraft</a>（AGPL-3.0，纯浏览器本地处理）。需要 90+ 完整工具（OCR、Office 转换、加密等）？试试<a href="https://pdfcraft.devtoolcafe.com" target="_blank" rel="noopener">官方在线完整版 ↗</a>。本页工具基于 pdf-lib（MIT）与 PDF.js（Apache-2.0）实现。</p>
</footer>

</div>

<script src="/js/pdfjs/pdf-lib.min.js?v=20261108a" defer></script>
<script src="/js/pdfjs/pdf.min.js?v=20261108a" defer></script>
<script src="/js/pdftool.js?v=20261108c" defer></script>
