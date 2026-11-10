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

  // 点旁常驻文章题目:截断+矩形碰撞检测(上/下 × 多级偏移)+边缘对齐,避开已放标签与所有数据点;
  // 限量曲线与轨道曲线共用,dots 为全部数据点的像素坐标(圆周避让)
  const addPointLabel = (labelsG, labelBoxes, dots, { text, cx, cy, W, H, M }) => {
    const t = String(text || '').trim()
    if (!t) return
    const label = t.length > 14 ? t.slice(0, 14) + '…' : t
    // 宽度估算:中日韩全宽字符 ≈ 1em,拉丁 ≈ 0.55em
    const tw = [...label].reduce((n, ch) => n + (/[\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF01-\uFF5E\u2014\u2018-\u201D]/.test(ch) ? 12 : 6.5), 0)
    let anchor = 'middle'
    let tx = cx
    if (cx - tw / 2 < M.l + 4) { anchor = 'start'; tx = cx + 8 }       // 左缘:右对齐展开
    else if (cx + tw / 2 > W - M.r - 4) { anchor = 'end'; tx = cx - 8 } // 右缘:左对齐展开
    const bx0 = anchor === 'middle' ? tx - tw / 2 : (anchor === 'start' ? tx : tx - tw)
    const bx1 = bx0 + tw
    const overlaps = box =>
      labelBoxes.some(b => b.x0 < box.x1 - 2 && b.x1 > box.x0 + 2 && b.y0 < box.y1 - 2 && b.y1 > box.y0 + 2) ||
      dots.some(([px, py]) => px + 10 > box.x0 && px - 10 < box.x1 && py + 10 > box.y0 && py - 10 < box.y1)
    let chosen = null
    for (const [side, extra] of [['above', 0], ['below', 0], ['above', -17], ['below', 17], ['above', -34], ['below', 34]]) {
      const ty = side === 'above' ? cy - 14 + extra : cy + 22 + extra
      const box = { x0: bx0, x1: bx1, y0: ty - 12, y1: ty + 4 }
      if (!overlaps(box)) { chosen = { ty, box }; break }
      if (!chosen) chosen = { ty, box } // 兜底:先记住第一个候选
    }
    labelBoxes.push(chosen.box)
    const ty = Math.max(12, Math.min(H - M.b - 6, chosen.ty))
    const el = svgEl('text', {
      x: tx.toFixed(1), y: ty.toFixed(1), 'text-anchor': anchor,
      style: 'fill:#98a6bb;font-size:12px;pointer-events:none'
    })
    el.textContent = label
    labelsG.appendChild(el)
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

  // 取 1/2/5/10×10^n 的"整"刻度
  const niceStep = raw => {
    if (raw <= 1) return 1
    const pow = Math.pow(10, Math.floor(Math.log10(raw)))
    for (const m of [1, 2, 5, 10]) {
      if (raw <= m * pow) return m * pow
    }
    return 10 * pow
  }

  // 限量计划:累计已读篇数曲线(纵轴为篇数)
  function buildCumulativeSvg(state, points, W) {
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

    // 数据点(有链接的文章包一层 <a>);点旁常驻文章题目(截断+避让+边缘对齐)
    const labelBoxes = []
    const labelsG = svgEl('g') // 标签统一画在最上层,避免被折线/圆点盖住
    const allDots = points.map((_, k) => [X(dates[k]), Y(cum[k])])
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

      // 点旁的文章题目:截断+避让+边缘对齐(与轨道曲线共用实现)
      addPointLabel(labelsG, labelBoxes, allDots, { text: point.title, cx, cy, W, H, M })

      holder.addEventListener('mouseenter', () => { core.style.transform = 'scale(1.45)'; showTip(state, point, cx, cy, W) })
      holder.addEventListener('mouseleave', () => { core.style.transform = ''; hideTip(state) })
      holder.addEventListener('focus', () => showTip(state, point, cx, cy, W))
      holder.addEventListener('blur', () => hideTip(state))
      svg.appendChild(holder)
    })
    svg.appendChild(labelsG)

    return svg
  }

  // 分发:不限量计划 → 进度轴轨道视图;限量计划 → 累计篇数曲线
  function buildSvg(state, points, W) {
    return state.data.unlimited
      ? buildTrackSvg(state, points, W)
      : buildCumulativeSvg(state, points, W)
  }

  function buildTrackSvg(state, points, W) {
    const data = state.data
    const accent = accentFor(state)
    const H = W < 520 ? 190 : 240

    // 纵轴 = 进度轴(轨道):每个轨道一条泳道,文章按所属轨道落点,按时间连线成阅读轨迹
    const tracks = (data.tracks || []).filter(t => t && t.key)
    const laneLabels = tracks.map(t => t.axis_label || t.key || '')
    const laneCount = Math.max(tracks.length, 1)

    const dated = points
      .map(point => ({ point, t: parseDate(point.date) }))
      .filter(p => p.t)
      .sort((a, b) => a.t - b.t)
    if (!dated.length) return null

    const laneIndexFor = point => tracks.findIndex(t => t.key === point.track)
    const plotted = dated.filter(p => laneIndexFor(p.point) >= 0)
    if (!plotted.length) return null

    const first = plotted[0].t.getTime()
    const last = plotted[plotted.length - 1].t.getTime()
    const span = last - first
    const pad = span > 0 ? Math.max(span * 0.05, DAY * 3) : DAY * 12
    const xMin = first - pad
    const xMax = last + pad

    const M = { t: 22, r: 20, b: 30, l: 40 }
    // 左侧留白按最长的轨道名扩展
    const maxLabelLen = laneLabels.reduce((n, l) => Math.max(n, String(l).length), 0)
    M.l = Math.max(M.l, maxLabelLen * 12 + 20)

    const iw = W - M.l - M.r
    const ih = H - M.t - M.b
    const X = t => M.l + ((t - xMin) / (xMax - xMin)) * iw
    const laneY = i => M.t + (ih * (i + 0.5)) / laneCount
    const laneYFor = point => laneY(laneIndexFor(point))

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', style: 'display:block;max-width:100%' })

    // 轨道泳道线 + 轨道名(纵轴标签)
    laneLabels.forEach((label, i) => {
      const y = laneY(i)
      svg.appendChild(svgEl('line', {
        x1: M.l, x2: W - M.r, y1: y.toFixed(1), y2: y.toFixed(1),
        stroke: '#808080', 'stroke-opacity': '.18', 'stroke-width': '1'
      }))
      const text = svgEl('text', {
        x: M.l - 8, y: (y + 4).toFixed(1), 'text-anchor': 'end',
        style: 'fill:var(--card-meta,#888);font-size:11px'
      })
      text.textContent = label
      svg.appendChild(text)
    })

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

    // 阅读轨迹:按时间顺序连接各篇(展示在轨道间的切换过程)
    if (plotted.length > 1) {
      const coords = plotted.map(p => `${X(p.t.getTime()).toFixed(1)},${laneYFor(p.point).toFixed(1)}`)
      svg.appendChild(svgEl('path', { d: `M ${coords.join(' L ')}`, fill: 'none', stroke: accent, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    }

    // 数据点(有链接的文章包一层 <a>);点旁常驻文章题目,与限量曲线一致
    const labelBoxes = []
    const labelsG = svgEl('g') // 标签统一画在最上层,避免被折线/圆点盖住
    const allDots = plotted.map(p => [X(p.t.getTime()), laneYFor(p.point)])
    plotted.forEach((p, i) => {
      const point = p.point
      const cx = X(p.t.getTime())
      const cy = laneYFor(point)
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

      // 点旁的文章题目:截断+避让+边缘对齐(与限量曲线共用实现)
      addPointLabel(labelsG, labelBoxes, allDots, { text: point.title, cx, cy, W, H, M })
    })
    svg.appendChild(labelsG)

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

  // ==================== 卡片墙浏览量填充(与 page-counter 共用 /api/all) ====================
  const fillCardPv = () => {
    const els = [...document.querySelectorAll('.research-card-pv[data-pv-path]')]
    if (!els.length) return
    fetch('/api/all')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data || !Array.isArray(data.data)) return
        const map = {}
        data.data.forEach(row => {
          if (row && row.path) map[row.path] = row.pv
        })
        els.forEach(el => {
          const pv = map[el.getAttribute('data-pv-path')]
          const text = el.querySelector('.research-card-pv-text')
          if (text && typeof pv === 'number') text.textContent = String(pv).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 次浏览'
        })
      })
      .catch(() => {})
  }
  fillCardPv()

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
