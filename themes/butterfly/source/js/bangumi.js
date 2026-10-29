(() => {
  const grid = document.querySelector('.bangumi-grid')
  if (!grid) return

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const episodeText = ep => {
    const t = String(ep == null ? '' : ep).trim()
    if (!t) return ''
    return t === '看完' ? '看完' : `看到第 ${t} 集`
  }
  const STATUS_COLOR = { '在看': '#3b82f6', '想看': '#f59e0b', '看完': '#22c55e', '弃': '#71717a' }

  const cardHTML = item => {
    const statusColor = STATUS_COLOR[item.status] || '#71717a'
    const epNum = parseFloat(item.episode)
    const totalNum = parseFloat(item.total)
    const hasNew = item.total && !isNaN(totalNum) && (isNaN(epNum) || totalNum > epNum)
    const epBadge = item.episode
      ? `<span class="bangumi-episode${hasNew ? ' is-new' : ''}">${esc(episodeText(item.episode))}</span>`
      : ''
    const totalBadge = item.total
      ? `<span class="bangumi-total${hasNew ? ' is-new' : ''}">更新至 ${esc(item.total)} 集</span>`
      : ''
    const inner = `<div class="bangumi-cover">
        <img src="${esc(item.image)}" alt="${esc(item.title)}封面" loading="lazy" decoding="async">
        ${item.category_name ? `<span class="bangumi-category">${esc(item.category_name)}</span>` : ''}
        ${epBadge}${totalBadge}
      </div>
      <div class="bangumi-info">
        <div class="bangumi-title">${esc(item.title)}</div>
        ${(item.author || item.status) ? `<div class="bangumi-meta-row">${item.author ? `<span class="bangumi-author">${esc(item.author)}</span>` : ''}${item.status ? `<span class="bangumi-status" style="--st:${statusColor}">${esc(item.status)}</span>` : ''}</div>` : ''}
        ${item.intro ? `<div class="bangumi-intro">${esc(item.intro)}</div>` : ''}
      </div>`
    return item.link
      ? `<a class="bangumi-card" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer" title="${esc(item.title)}">${inner}</a>`
      : `<div class="bangumi-card">${inner}</div>`
  }

  const render = data => {
    const categories = data.categories || []
    const items = data.items || []
    let active = null

    const tabs = document.createElement('div')
    tabs.className = 'bangumi-tabs'

    const renderGrid = () => {
      const shown = items.filter(i => active == null || i.category_id === active)
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

    grid.parentNode.insertBefore(tabs, grid)
    renderTabs()
    renderGrid()
  }

  fetch('/api/bangumi')
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
    .then(data => {
      if (data && Array.isArray(data.items)) render(data)
    })
    .catch(() => { /* 拉取失败时保留服务端渲染的静态内容 */ })
})()
