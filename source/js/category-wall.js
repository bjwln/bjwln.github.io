;(() => {
  'use strict'

  // 分类归档页:浏览量填充(数据来自 Cloudflare D1)
  const fill = () => {
    fetch('/api/all')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
      .then(d => {
        const map = {}
        ;(d.data || []).forEach(item => {
          try { map[decodeURIComponent(item.path)] = item.pv || 0 } catch (e) { map[item.path] = item.pv || 0 }
        })
        document.querySelectorAll('[data-pv-path]').forEach(el => {
          const n = map[el.getAttribute('data-pv-path')]
          if (n == null) return
          const num = el.querySelector('.hot-pv-num')
          if (num) num.textContent = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 次浏览'
        })
      })
      .catch(() => { /* 拉取失败保持 0 */ })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fill)
  } else {
    fill()
  }
  document.addEventListener('pjax:complete', fill)
})()
