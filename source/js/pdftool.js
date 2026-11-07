/* ============================================================
 * PDF 工具箱 · pdftool.js（/moyu/pdf/ 专用，全部浏览器本地处理）
 * 依赖: pdf-lib (MIT) 全局 PDFLib；pdf.js (Apache-2.0) 全局 pdfjsLib
 * 工具: 合并 / 提取页面 / 删除页面 / 旋转 / 图片转 PDF / PDF 转图片
 * 调试钩子: window.PDFTool 暴露各核心函数（接受 File/Uint8Array）
 * ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 通用 ---------- */
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }
  /* '1-3,5,8-' → 0 基页码数组（1-based 含端点；8- 表示到末尾） */
  function parseRanges(str, max) {
    str = String(str || '').trim();
    if (!str) { var all = []; for (var i = 0; i < max; i++) all.push(i); return all; }
    var out = [], seen = {};
    str.split(/[,，]/).forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = part.match(/^(\d+)(?:\s*-\s*(\d+)?)?$/);
      if (!m) throw new Error('页码格式不对：「' + part + '」');
      var from = parseInt(m[1], 10), to = m[2] ? parseInt(m[2], 10) : from;
      if (m[2] === undefined && /-$/.test(part)) to = max;
      if (from < 1 || from > max || to < from || to > max) throw new Error('页码超出范围（1-' + max + '）：' + part);
      for (var p = from; p <= to; p++) { var idx = p - 1; if (!seen[idx]) { seen[idx] = 1; out.push(idx); } }
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }
  function loadPdf(bytes) {
    return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  }
  /* 渲染单页：display 路径超时（个别嵌入式 WebView 会挂起）自动退回 print 渲染 */
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('TIMEOUT')); }, ms); })]);
  }
  function renderWithFallback(page, viewport, ctx) {
    var task = page.render({ canvasContext: ctx, viewport: viewport });
    return withTimeout(task.promise, 15000).catch(function (e) {
      if (!/TIMEOUT/.test(e.message)) throw e;
      try { task.cancel(); } catch (ignore) { /* 已挂起则忽略 */ }
      task = page.render({ canvasContext: ctx, viewport: viewport, intent: 'print', annotationMode: 0 });
      return task.promise;
    });
  }
  function ensurePdfFile(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      throw new Error('「' + file.name + '」不是 PDF 文件');
    }
  }

  /* ---------- 核心工具（同时暴露给调试钩子） ---------- */
  async function merge(files) {
    if (!files || files.length < 2) throw new Error('请至少选择两个 PDF');
    var dest = await PDFLib.PDFDocument.create();
    for (var i = 0; i < files.length; i++) {
      var f = files[i]; ensurePdfFile(f);
      try {
        var src = await loadPdf(await f.arrayBuffer());
        var pages = await dest.copyPages(src, src.getPageIndices());
        pages.forEach(function (p) { dest.addPage(p); });
      } catch (e) {
        if (/encrypt/i.test(e.message)) throw new Error('「' + f.name + '」是加密 PDF，暂不支持');
        throw new Error('处理「' + f.name + '」失败：' + e.message);
      }
    }
    return { blob: new Blob([await dest.save()], { type: 'application/pdf' }), pages: dest.getPageCount() };
  }

  async function extractPages(file, rangeStr) {
    ensurePdfFile(file);
    var src = await loadPdf(await file.arrayBuffer());
    var max = src.getPageCount();
    var idx = parseRanges(rangeStr, max);
    if (!idx.length) throw new Error('没有可提取的页面');
    var dest = await PDFLib.PDFDocument.create();
    (await dest.copyPages(src, idx)).forEach(function (p) { dest.addPage(p); });
    return { blob: new Blob([await dest.save()], { type: 'application/pdf' }), pages: dest.getPageCount() };
  }

  async function deletePages(file, rangeStr) {
    ensurePdfFile(file);
    var doc = await loadPdf(await file.arrayBuffer());
    var max = doc.getPageCount();
    var idx = parseRanges(rangeStr, max);
    if (!idx.length) throw new Error('请填写要删除的页码');
    idx.sort(function (a, b) { return b - a; }).forEach(function (i) { doc.removePage(i); });
    return { blob: new Blob([await doc.save()], { type: 'application/pdf' }), pages: doc.getPageCount() };
  }

  async function rotatePages(file, angle, dir, rangeStr) {
    ensurePdfFile(file);
    var doc = await loadPdf(await file.arrayBuffer());
    var max = doc.getPageCount();
    var idx = parseRanges(rangeStr, max);
    var delta = (parseInt(angle, 10) || 90) % 360;
    if (dir === 'ccw') delta = (360 - delta) % 360;
    idx.forEach(function (i) {
      var page = doc.getPage(i);
      var cur = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((cur + delta) % 360));
    });
    return { blob: new Blob([await doc.save()], { type: 'application/pdf' }), pages: idx.length };
  }

  async function imagesToPdf(files) {
    if (!files || !files.length) throw new Error('请选择图片');
    var doc = await PDFLib.PDFDocument.create();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var bytes = new Uint8Array(await f.arrayBuffer());
      var img;
      try {
        if (f.type === 'image/png' || /\.png$/i.test(f.name)) img = await doc.embedPng(bytes);
        else if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) img = await doc.embedJpg(bytes);
        else throw new Error('只支持 JPG / PNG（「' + f.name + '」不是）');
      } catch (e) {
        if (/只支持/.test(e.message)) throw e;
        throw new Error('解析「' + f.name + '」失败：' + e.message);
      }
      var page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    return { blob: new Blob([await doc.save()], { type: 'application/pdf' }), pages: doc.getPageCount() };
  }

  async function pdfToImages(file, rangeStr, scale, onProgress) {
    ensurePdfFile(file);
    var data = new Uint8Array(await file.arrayBuffer());
    var doc = await pdfjsLib.getDocument({ data: data }).promise;
    var idx = parseRanges(rangeStr, doc.numPages);
    var results = [];
    for (var k = 0; k < idx.length; k++) {
      var pageNo = idx[k] + 1;
      if (onProgress) onProgress(pageNo, idx.length);
      var page = await doc.getPage(pageNo);
      var viewport = page.getViewport({ scale: parseFloat(scale) || 2 });
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      var ctx = canvas.getContext('2d');
      await renderWithFallback(page, viewport, ctx);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
      results.push({ page: pageNo, blob: blob });
    }
    return { images: results, total: doc.numPages };
  }

  /* ---------- UI 绑定 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.pt-tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('is-active'); });
        document.querySelectorAll('.pt-panel').forEach(function (p) { p.classList.remove('is-active'); });
        t.classList.add('is-active');
        var panel = document.querySelector('.pt-panel[data-panel="' + t.dataset.tool + '"]');
        if (panel) panel.classList.add('is-active');
      });
    });
  }

  function fileList(el, onChange) {
    var files = [];
    function render() {
      el.innerHTML = '';
      files.forEach(function (f, i) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="pt-name">' + f.name.replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        }) + '</span><span class="pt-size">' + fmtSize(f.size) + '</span>';
        var up = document.createElement('button'); up.type = 'button'; up.textContent = '↑';
        up.disabled = i === 0;
        up.onclick = function () { var t = files[i - 1]; files[i - 1] = files[i]; files[i] = t; render(); onChange(files); };
        var down = document.createElement('button'); down.type = 'button'; down.textContent = '↓';
        down.disabled = i === files.length - 1;
        down.onclick = function () { var t = files[i + 1]; files[i + 1] = files[i]; files[i] = t; render(); onChange(files); };
        var rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '移除';
        rm.onclick = function () { files.splice(i, 1); render(); onChange(files); };
        li.appendChild(up); li.appendChild(down); li.appendChild(rm);
        el.appendChild(li);
      });
    }
    return {
      get: function () { return files; },
      set: function (list) { files = Array.prototype.slice.call(list); render(); onChange(files); },
      clear: function () { files = []; render(); onChange(files); },
      render: render
    };
  }

  function wire() {
    if (!window.PDFLib) return false;

    /* 合并 */
    var mergeList = fileList($('merge-list'), function (files) { $('merge-run').disabled = files.length < 2; });
    $('merge-files').addEventListener('change', function () {
      try {
        Array.prototype.forEach.call(this.files, ensurePdfFile);
        mergeList.set(mergeList.get().concat(Array.prototype.slice.call(this.files)));
      } catch (e) { $('merge-err').textContent = e.message; }
      this.value = '';
    });
    $('merge-run').addEventListener('click', function () {
      var btn = this; btn.disabled = true; $('merge-err').textContent = '';
      merge(mergeList.get()).then(function (r) {
        download(r.blob, 'merged.pdf');
        $('merge-err').textContent = ''; $('merge-err').className = 'pt-status';
        $('merge-err').textContent = '完成：共 ' + r.pages + ' 页，已开始下载';
      }).catch(function (e) { $('merge-err').className = 'pt-err'; $('merge-err').textContent = e.message; })
        .finally(function () { btn.disabled = false; });
    });

    /* 提取 */
    var extractFile = null;
    $('extract-file').addEventListener('change', function () {
      extractFile = this.files[0] || null;
      $('extract-run').disabled = !extractFile;
      $('extract-err').textContent = extractFile ? '已选择：' + extractFile.name : '';
    });
    $('extract-run').addEventListener('click', function () {
      var btn = this; btn.disabled = true; $('extract-err').textContent = '';
      extractPages(extractFile, $('extract-range').value).then(function (r) {
        download(r.blob, 'extracted.pdf');
        $('extract-err').className = 'pt-status';
        $('extract-err').textContent = '完成：' + r.pages + ' 页，已开始下载';
      }).catch(function (e) { $('extract-err').className = 'pt-err'; $('extract-err').textContent = e.message; })
        .finally(function () { btn.disabled = false; });
    });

    /* 删除 */
    var removeFile = null;
    $('remove-file').addEventListener('change', function () {
      removeFile = this.files[0] || null;
      $('remove-run').disabled = !removeFile;
      $('remove-err').textContent = removeFile ? '已选择：' + removeFile.name : '';
    });
    $('remove-run').addEventListener('click', function () {
      var btn = this; btn.disabled = true; $('remove-err').textContent = '';
      deletePages(removeFile, $('remove-range').value).then(function (r) {
        download(r.blob, 'removed.pdf');
        $('remove-err').className = 'pt-status';
        $('remove-err').textContent = '完成：剩 ' + r.pages + ' 页，已开始下载';
      }).catch(function (e) { $('remove-err').className = 'pt-err'; $('remove-err').textContent = e.message; })
        .finally(function () { btn.disabled = false; });
    });

    /* 旋转 */
    var rotateFile = null;
    $('rotate-file').addEventListener('change', function () {
      rotateFile = this.files[0] || null;
      $('rotate-run').disabled = !rotateFile;
      $('rotate-err').textContent = rotateFile ? '已选择：' + rotateFile.name : '';
    });
    $('rotate-run').addEventListener('click', function () {
      var btn = this; btn.disabled = true; $('rotate-err').textContent = '';
      rotatePages(rotateFile, $('rotate-angle').value, $('rotate-dir').value, $('rotate-range').value).then(function (r) {
        download(r.blob, 'rotated.pdf');
        $('rotate-err').className = 'pt-status';
        $('rotate-err').textContent = '完成：旋转 ' + r.pages + ' 页，已开始下载';
      }).catch(function (e) { $('rotate-err').className = 'pt-err'; $('rotate-err').textContent = e.message; })
        .finally(function () { btn.disabled = false; });
    });

    /* 图片转 PDF */
    var imgList = fileList($('img2pdf-list'), function (files) { $('img2pdf-run').disabled = !files.length; });
    $('img2pdf-files').addEventListener('change', function () {
      imgList.set(imgList.get().concat(Array.prototype.slice.call(this.files)));
      this.value = '';
    });
    $('img2pdf-run').addEventListener('click', function () {
      var btn = this; btn.disabled = true; $('img2pdf-err').textContent = '';
      imagesToPdf(imgList.get()).then(function (r) {
        download(r.blob, 'images.pdf');
        $('img2pdf-err').textContent = '完成：' + r.pages + ' 页，已开始下载';
      }).catch(function (e) { $('img2pdf-err').textContent = e.message; })
        .finally(function () { btn.disabled = false; });
    });

    /* PDF 转图片 */
    var p2iFile = null;
    $('pdf2img-file').addEventListener('change', function () {
      p2iFile = this.files[0] || null;
      $('pdf2img-run').disabled = !p2iFile;
      $('pdf2img-err').textContent = p2iFile ? '已选择：' + p2iFile.name : '';
    });
    $('pdf2img-run').addEventListener('click', function () {
      var btn = this; btn.disabled = true; $('pdf2img-err').textContent = '';
      $('pdf2img-results').innerHTML = '';
      pdfToImages(p2iFile, $('pdf2img-range').value, $('pdf2img-scale').value, function (no, total) {
        $('pdf2img-err').textContent = '渲染中… 第 ' + no + ' 页 / 共 ' + total + ' 页';
      }).then(function (r) {
        $('pdf2img-err').textContent = '完成：' + r.images.length + ' 张图片，点击下方保存';
        var box = $('pdf2img-results');
        r.images.forEach(function (im) {
          var url = URL.createObjectURL(im.blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'page-' + im.page + '.png';
          a.textContent = '⬇ 第 ' + im.page + ' 页（PNG，' + fmtSize(im.blob.size) + '）';
          box.appendChild(a);
        });
      }).catch(function (e) { $('pdf2img-err').textContent = e.message; })
        .finally(function () { btn.disabled = false; });
    });

    return true;
  }

  function init() {
    bindTabs();
    if (!wire()) {
      // 依赖库未就绪（极端情况）时稍后重试
      var tries = 0;
      var timer = setInterval(function () {
        if (wire() || ++tries > 20) clearInterval(timer);
      }, 500);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* 调试/自动化钩子（正常用户不使用） */
  window.PDFTool = {
    merge: merge, extractPages: extractPages, deletePages: deletePages,
    rotatePages: rotatePages, imagesToPdf: imagesToPdf,
    pdfToImages: pdfToImages, parseRanges: parseRanges, download: download
  };
})();
