(() => {
  const sections = [...document.querySelectorAll('.research-chart-section[data-plan-section]')]
  const tabs = [...document.querySelectorAll('.research-task-tab[data-plan]')]
  if (!sections.length) return

  // ==================== 任务切换(进度卡标题栏内的标题 Tab) ====================
  const chartStates = new Map()

  const activate = (key, updateHash) => {
    const target = sections.find(section => section.dataset.planSection === key)
    if (!target) return false

    sections.forEach(section => section.classList.toggle('is-active', section === target))
    tabs.forEach(tab => {
      const active = tab.dataset.plan === key
      tab.classList.toggle('is-active', active)
      tab.setAttribute('aria-selected', active ? 'true' : 'false')
    })

    if (updateHash && history.replaceState) history.replaceState(null, '', '#' + key)

    const state = chartStates.get(target)
    if (state) renderChart(state)

    // 让时间线脚本对刚显示出来的大框重新居中
    window.dispatchEvent(new Event('resize'))
    return true
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activate(tab.dataset.plan, true))
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      const index = tabs.indexOf(tab)
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
      next.focus()
      activate(next.dataset.plan, true)
      event.preventDefault()
    })
  })

  // ==================== 阅读曲线(折线图) ====================
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const DAY = 86400000

  // 主题色由 JS 内联注入,不依赖 CSS 加载顺序/缓存;亮暗色与 research.styl 保持一致
  const ACCENTS = {
    literature: { light: '#3573c9', dark: '#6cb6ff' },
    project: { light: '#2f9e6f', dark: '#4cc38a' },
    mciaa: { light: '#8a5fd3', dark: '#b79bff' }
  }
  const FALLBACK_ACCENT = { light: '#3573c9', dark: '#6cb6ff' }

  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'

  const accentFor = state => {
    const pair = ACCENTS[state.section.dataset.planSection] || FALLBACK_ACCENT
    return isDark() ? pair.dark : pair.light
  }

  const svgEl = (name, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, name)
    for (const key in attrs) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, attrs[key])
    }
    return node
  }

  const parseDate = value => {
    const parsed = new Date(String(value) + 'T00:00:00')
    return isNaN(parsed) ? null : parsed
  }

  // 取 1/2/5/10×10^n 的"整"刻度
  const niceStep = raw => {
    if (raw <= 1) return 1
    const pow = Math.pow(10, Math.floor(Math.log10(raw)))
    for (const m of [1, 2, 5, 10]) {
      if (raw <= m * pow) return m * pow
    }
    return 10 * pow
  }

  const buildLineChart = section => {
    const body = section.querySelector('.research-linechart-body')
    if (!body) return null

    let data = { unlimited: false, total: null, points: [] }
    const raw = body.querySelector('.research-linechart-data')
    if (raw) {
      try { data = JSON.parse(raw.textContent) || data } catch (e) { /* 数据损坏时按空数据处理 */ }
    }

    const tip = document.createElement('div')
    tip.className = 'rlc-tip'
    // 关键样式内联,保证即使 CSS 未更新 tooltip 也不会裸奔
    Object.assign(tip.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      zIndex: '6',
      maxWidth: '300px',
      padding: '10px 13px',
      borderRadius: '8px',
      background: 'var(--card-bg, #fff)',
      boxShadow: '0 10px 26px rgba(0, 0, 0, .22), 0 0 0 1px rgba(0, 0, 0, .06)',
      opacity: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      transition: 'opacity .16s ease, visibility .16s'
    })
    body.appendChild(tip)

    return { section, body, data, tip, svg: null, placeholder: null }
  }

  const showTip = (state, point, cx, cy, W) => {
    const tip = state.tip
    tip.textContent = ''

    const meta = document.createElement('div')
    meta.className = 'rlc-tip-meta'
    meta.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:var(--card-meta,#999);font-size:12px;font-variant-numeric:tabular-nums'
    const time = document.createElement('time')
    time.textContent = point.date
    meta.appendChild(time)
    if (point.trackLabel) {
      const track = document.createElement('span')
      track.className = 'research-timeline-track' + (point.track ? ` track-${point.track}` : '')
      track.textContent = point.trackLabel
      meta.appendChild(track)
    }
    tip.appendChild(meta)

    const title = document.createElement('strong')
    title.className = 'rlc-tip-title'
    title.style.cssText = 'display:block;margin-top:6px;color:var(--font-color,#333);font-size:13px;font-weight:600;line-height:1.5;word-break:break-word'
    title.textContent = point.title || point.date
    tip.appendChild(title)

    tip.style.visibility = 'visible'
    tip.style.opacity = '1'
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    let left = cx - tw / 2
    left = Math.max(4, Math.min(left, W - tw - 4))
    let top = cy - th - 14
    if (top < 2) top = cy + 16
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(top)}px`
  }

  const hideTip = state => {
    state.tip.style.opacity = '0'
    state.tip.style.visibility = 'hidden'
  }

  // 渲染是"非破坏式"的:先量宽、离线构建,全部成功后再替换旧内容;
  // 宽度为 0(大框隐藏或布局未就绪)时保留现状,等激活/尺寸变化时自愈
  function renderChart(state) {
      const { body, data } = state
      const W = body.clientWidth
      if (!W) return

      const points = (data.points || [])
        .filter(point => point && parseDate(point.date))
        .sort((a, b) => parseDate(a.date) - parseDate(b.date))

      let nextSvg = null
      let nextPlaceholder = null

      if (!points.length) {
        nextPlaceholder = document.createElement('div')
        nextPlaceholder.className = 'research-linechart-placeholder'
        nextPlaceholder.style.cssText = 'padding:38px 10px;color:var(--card-meta,#999);font-size:.84em;text-align:center'
        nextPlaceholder.textContent = data.unlimited
          ? '还没有记录，读完第一篇后曲线会从这里开始生长'
          : '暂无数据'
      } else {
        nextSvg = buildSvg(state, points, W)
        if (!nextSvg) return // 构建失败时保留旧图
      }

      hideTip(state)
      if (state.svg) { state.svg.remove(); state.svg = null }
      if (state.placeholder) { state.placeholder.remove(); state.placeholder = null }
      if (nextSvg) {
        body.appendChild(nextSvg)
        state.svg = nextSvg
      } else if (nextPlaceholder) {
        body.appendChild(nextPlaceholder)
        state.placeholder = nextPlaceholder
      }
  }

  function buildSvg(state, points, W) {
    const data = state.data
    const accent = accentFor(state)
    const H = W < 520 ? 190 : 240
    const M = { t: 22, r: 20, b: 30, l: 40 }
    const dates = points.map(point => parseDate(point.date).getTime())
    const first = dates[0]
    const last = dates[dates.length - 1]
    const span = last - first
    const pad = span > 0 ? Math.max(span * 0.05, DAY * 3) : DAY * 12
    const xMin = first - pad
    const xMax = last + pad

    const total = Number(data.total) > 0 ? Number(data.total) : null
    const cum = points.map((_, i) => i + 1)
    const yTop = Math.max(total || 0, cum.length)
    const step = niceStep(yTop / 6 || 1)
    const yMax = Math.max(step, Math.ceil(yTop / step) * step)

    const iw = W - M.l - M.r
    const ih = H - M.t - M.b
    const X = t => M.l + ((t - xMin) / (xMax - xMin)) * iw
    const Y = v => M.t + (1 - v / yMax) * ih

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', style: 'display:block;max-width:100%' })

    // 横向网格 + 纵轴刻度
    for (let v = 0; v <= yMax; v += step) {
      const y = Y(v)
      svg.appendChild(svgEl('line', {
        x1: M.l, x2: W - M.r, y1: y.toFixed(1), y2: y.toFixed(1),
        stroke: '#808080', 'stroke-opacity': v === 0 ? '.34' : '.16', 'stroke-width': '1'
      }))
      const label = svgEl('text', {
        x: M.l - 8, y: (y + 4).toFixed(1), 'text-anchor': 'end',
        style: 'fill:var(--card-meta,#888);font-size:11px;font-variant-numeric:tabular-nums'
      })
      label.textContent = v
      svg.appendChild(label)
    }

    // 横轴刻度:优先按月份,跨度不足一个月时按位置取 3 个日期
    const crossYear = xMax - xMin > 360 * DAY
    let ticks = []
    const cursor = new Date(xMin)
    cursor.setDate(1)
    if (cursor.getTime() < xMin) cursor.setMonth(cursor.getMonth() + 1)
    for (let t = cursor.getTime(); t <= xMax; t = cursor.getTime()) {
      const d = new Date(t)
      const label = (crossYear || d.getMonth() === 0) ? `${d.getFullYear()}年${d.getMonth() + 1}月` : `${d.getMonth() + 1}月`
      ticks.push({ t, label })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    if (!ticks.length) {
      ticks = [0.25, 0.5, 0.75].map(f => {
        const d = new Date(xMin + (xMax - xMin) * f)
        return { t: d.getTime(), label: `${d.getMonth() + 1}月${d.getDate()}日` }
      })
    }
    const tickEvery = Math.ceil(ticks.length / 6)
    ticks.forEach((tick, index) => {
      if (index % tickEvery) return
      const x = X(tick.t)
      svg.appendChild(svgEl('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: H - M.b, y2: H - M.b + 4, stroke: '#808080', 'stroke-opacity': '.16', 'stroke-width': '1' }))
      const label = svgEl('text', {
        x: x.toFixed(1), y: H - M.b + 17, 'text-anchor': 'middle',
        style: 'fill:var(--card-meta,#888);font-size:11px;font-variant-numeric:tabular-nums'
      })
      label.textContent = tick.label
      svg.appendChild(label)
    })

    // 目标线(限量任务才显示)
    if (total && total <= yMax) {
      const y = Y(total)
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y.toFixed(1), y2: y.toFixed(1), stroke: accent, 'stroke-opacity': '.55', 'stroke-width': '1.5', 'stroke-dasharray': '5 5' }))
      const label = svgEl('text', {
        x: W - M.r, y: (y - 6).toFixed(1), 'text-anchor': 'end',
        style: `fill:${accent};fill-opacity:.75;font-size:11px;font-variant-numeric:tabular-nums`
      })
      label.textContent = `目标 ${total}`
      svg.appendChild(label)
    }

    // 折线 + 面积
    if (points.length > 1) {
      const coords = dates.map((t, i) => `${X(t).toFixed(1)},${Y(cum[i]).toFixed(1)}`)
      svg.appendChild(svgEl('path', { d: `M ${coords[0]} L ${coords.slice(1).join(' L ')} L ${X(last).toFixed(1)} ${Y(0).toFixed(1)} L ${X(first).toFixed(1)} ${Y(0).toFixed(1)} Z`, fill: accent, 'fill-opacity': '.12' }))
      svg.appendChild(svgEl('path', { d: `M ${coords.join(' L ')}`, fill: 'none', stroke: accent, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    }

    // 数据点(有链接的文章包一层 <a>)
    points.forEach((point, i) => {
      const cx = X(dates[i])
      const cy = Y(cum[i])
      const holder = svgEl(point.href ? 'a' : 'g', { class: 'rlc-dot', tabindex: '0', style: 'cursor:pointer' })
      if (point.href) holder.setAttribute('href', point.href)

      const hit = svgEl('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 14, fill: 'transparent' })
      const core = svgEl('circle', {
        cx: cx.toFixed(1), cy: cy.toFixed(1), r: 4.5,
        style: `fill:var(--card-bg,#fff);stroke:${accent};stroke-width:2.5;transition:transform .18s ease;transform-box:fill-box;transform-origin:center`
      })
      holder.appendChild(hit)
      holder.appendChild(core)
      holder.addEventListener('mouseenter', () => { core.style.transform = 'scale(1.45)'; showTip(state, point, cx, cy, W) })
      holder.addEventListener('mouseleave', () => { core.style.transform = ''; hideTip(state) })
      holder.addEventListener('focus', () => showTip(state, point, cx, cy, W))
      holder.addEventListener('blur', () => hideTip(state))
      svg.appendChild(holder)
    })

    return svg
  }

  sections.forEach(section => {
    const state = buildLineChart(section)
    if (state) chartStates.set(section, state)
  })

  // 初始激活:支持 /research/#mciaa 直接打开对应任务大框
  const hash = decodeURIComponent((location.hash || '').slice(1))
  const initialKey = sections.some(section => section.dataset.planSection === hash) ? hash : sections[0].dataset.planSection
  activate(initialKey, false)

  // 容器尺寸变化 / 字体就绪 / 亮暗主题切换时,重画当前可见曲线
  const rerenderActive = () => {
    const active = sections.find(section => section.classList.contains('is-active'))
    const state = chartStates.get(active)
    if (state) renderChart(state)
  }

  let resizeTimer = null
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(rerenderActive, 150)
  })

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(rerenderActive).catch(() => {})
  }

  if (typeof MutationObserver === 'function') {
    new MutationObserver(rerenderActive).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(entries => {
      if (entries.some(entry => entry.contentRect.width > 0)) rerenderActive()
    })
    chartStates.forEach(state => ro.observe(state.body))
  }
})()
