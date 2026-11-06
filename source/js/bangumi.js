(() => {
  'use strict'

  const CACHE_KEY = 'bangumi-cache-v1'
  const grid = document.getElementById('bangumi-grid')
  if (!grid) return
  const loading = document.getElementById('bangumi-loading')
  const fallback = document.getElementById('bangumi-fallback')

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const episodeText = ep => {
    const t = String(ep == null ? '' : ep).trim()
    if (!t) return ''
    return t === '看完' ? '看完' : `看到第 ${t} 集`
  }
  const STATUS_COLOR = { '在看': '#3b82f6', '想看': '#f59e0b', '看完': '#22c55e', '弃': '#71717a' }

  let lastJson = ''

  // 未看集数:有 total 且 > 已看时为落后集数,否则 null(看完/还没更新的/没填集数)
  const unwatchedOf = item => {
    const ep = parseFloat(item.episode)
    const total = parseFloat(item.total)
    if (!item.total || isNaN(total) || isNaN(ep) || total <= ep) return null
    return Math.round(total - ep)
  }

  const cardHTML = item => {
    const statusColor = STATUS_COLOR[item.status] || '#71717a'
    const epNum = parseFloat(item.episode)
    const totalNum = parseFloat(item.total)
    const hasNew = item.total && !isNaN(totalNum) && (isNaN(epNum) || totalNum > epNum)
    const unwatched = unwatchedOf(item)
    const epBadge = item.episode
      ? `<span class="bangumi-episode${hasNew ? ' is-new' : ''}">${esc(episodeText(item.episode))}</span>`
      : ''
    const totalBadge = item.total
      ? `<span class="bangumi-total${hasNew ? ' is-new' : ''}">更新至 ${esc(item.total)} 集</span>`
      : ''
    // 有「未看 N 集」角标时占掉分类角标的位置(同位不重叠)
    const unwatchBadge = unwatched != null && unwatched > 0
      ? `<span class="bangumi-unwatch">未看 ${unwatched} 集</span>`
      : ''
    // UP主条目用自动同步的最新视频封面(实时),其余用海报;都按 2:3 裁切,网格整齐
    const coverSrc = item.latest_cover || item.image
    const inner = `<div class="bangumi-cover">
        <img src="${esc(coverSrc)}" alt="${esc(item.title)}封面" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${esc(item.image)}'">
        ${item.category_name && !unwatchBadge ? `<span class="bangumi-category">${esc(item.category_name)}</span>` : ''}
        ${unwatchBadge}${epBadge}${totalBadge}
      </div>
      <div class="bangumi-info">
        <div class="bangumi-title">${esc(item.title)}</div>
        ${(item.author || item.status) ? `<div class="bangumi-meta-row">${item.author ? `<span class="bangumi-author">${esc(item.author)}</span>` : ''}${item.status ? `<span class="bangumi-status" style="--st:${statusColor}">${esc(item.status)}</span>` : ''}</div>` : ''}
        ${item.latest_title ? `<div class="bangumi-latest"><i class="fas fa-play" aria-hidden="true"></i><span>最新：${esc(item.latest_title)}</span></div>` : ''}
        ${item.intro ? `<div class="bangumi-intro">${esc(item.intro)}</div>` : ''}
      </div>`
    // UP主条目有最新视频地址时优先跳「接下来该看的」那支
    const href = item.latest_url || item.link
    return href
      ? `<a class="bangumi-card" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(item.title)}">${inner}</a>`
      : `<div class="bangumi-card">${inner}</div>`
  }

  const render = data => {
    const categories = data.categories || []
    const items = data.items || []
    let active = null

    const tabs = document.createElement('div')
    tabs.className = 'bangumi-tabs'

    // 排序:有集数没看的在前(按未看数从小到大),看完的/还没更新的/没填集数的垫底
    // (Array.prototype.sort 稳定,未看数相同的条目保持原有顺序)
    const sorted = items.slice().sort((a, b) => {
      const ua = unwatchedOf(a), ub = unwatchedOf(b)
      if (ua == null && ub == null) return 0
      if (ua == null) return 1
      if (ub == null) return -1
      return ua - ub
    })

    const renderGrid = () => {
      const shown = sorted.filter(i => active == null || i.category_id === active)
      grid.innerHTML = shown.length
        ? shown.map(cardHTML).join('')
        : '<div class="bangumi-empty">这个分类下还没有条目</div>'
    }

    const renderTabs = () => {
      const countFor = id => items.filter(i => id == null ? true : i.category_id === id).length
      tabs.innerHTML = [`<button class="bangumi-tab${active == null ? ' is-active' : ''}" data-id="">全部 <em>${items.length}</em></button>`]
        .concat(categories.map(c => `<button class="bangumi-tab${active === c.id ? ' is-active' : ''}" data-id="${c.id}">${esc(c.name)} <em>${countFor(c.id)}</em></button>`))
        .join('')
    }

    tabs.addEventListener('click', event => {
      const btn = event.target.closest('.bangumi-tab')
      if (!btn) return
      active = btn.dataset.id === '' ? null : Number(btn.dataset.id)
      renderTabs()
      renderGrid()
    })

    const oldTabs = grid.parentNode.querySelector('.bangumi-tabs')
    if (oldTabs) oldTabs.remove()
    grid.parentNode.insertBefore(tabs, grid)
    renderTabs()
    renderGrid()
  }

  const showGrid = data => {
    const j = JSON.stringify([data.categories, data.items])
    if (j !== lastJson) {
      render(data)
      lastJson = j
    }
    grid.hidden = false
    if (loading) loading.hidden = true
    if (fallback) fallback.hidden = true
  }

  const showFallback = () => {
    if (fallback) fallback.hidden = false
    if (loading) loading.hidden = true
    grid.hidden = true
  }

  const readCache = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY))
      return v && Array.isArray(v.items) ? v : null
    } catch { return null }
  }

  const writeCache = data => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* 隐私模式等场景忽略 */ }
  }

  const init = () => {
    // 缓存秒开:老访客直接渲染上次数据,随后后台刷新
    const cached = readCache()
    if (cached) showGrid(cached)

    fetch('/api/bangumi')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
      .then(data => {
        if (!data || !Array.isArray(data.items)) throw new Error('bad data')
        writeCache(data)
        showGrid(data)
      })
      .catch(() => {
        // 拉取失败:已有缓存渲染则保持;否则显示静态兜底
        if (!lastJson) showFallback()
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
  document.addEventListener('pjax:complete', init)
})()
