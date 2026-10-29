/**
 * 视口触发弹出：卡片滚动到即将进入视野时才播放 pop-spring 动画
 * 作用范围：首页文章索引 / 追番页 / 热门页（含筛选后动态重渲染的卡片）
 * 同一批进入视野的卡片按顺序错开 110ms，单批最多 550ms
 */
;(function () {
  'use strict'

  if (typeof IntersectionObserver === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  var SELECTOR =
    '#recent-posts .recent-post-item, .bangumi-grid .bangumi-card, .hot-grid .hot-card'

  var io = new IntersectionObserver(
    function (entries) {
      var batchIndex = 0
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        var el = entry.target
        io.unobserve(el)
        // 同一批进入的卡片依次错开，避免同时弹出
        el.style.animationDelay = Math.min(batchIndex * 110, 550) + 'ms'
        el.classList.remove('pop-wait')
        el.classList.add('pop-play')
        batchIndex++
      })
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
  )

  function observeEl(el) {
    if (el.__popSeen) return
    el.__popSeen = true
    el.classList.add('pop-wait')
    io.observe(el)
  }

  function observeRoot(root) {
    root.querySelectorAll(SELECTOR).forEach(observeEl)
  }

  observeRoot(document)

  // 兜底：快速滚动/锚点跳转会"跳过"视口，位于视口上方的等待卡片立即显示，
  // 避免出现滚过后仍隐形的空洞
  function sweep() {
    document.querySelectorAll('.pop-wait').forEach(function (el) {
      if (el.getBoundingClientRect().bottom <= 0) {
        el.classList.remove('pop-wait')
        el.classList.add('pop-play')
      }
    })
  }
  var lastSweep = 0
  function onScroll() {
    var now = Date.now()
    if (now - lastSweep < 120) return
    lastSweep = now
    sweep()
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)

  // 热门页加载 / 筛选 / 搜索时会动态重渲染卡片，监听新增节点
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return
        if (node.matches(SELECTOR)) observeEl(node)
        else observeRoot(node)
      })
    })
  }).observe(document.body, { childList: true, subtree: true })
})()
