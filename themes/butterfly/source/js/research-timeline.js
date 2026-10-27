(() => {
  const charts = [...document.querySelectorAll('.research-timeline-chart')]

  let popover = null
  let popoverCard = null
  let hideTimer = null
  let scrollFromZoom = false
  let scrollFromZoomTimer = null

  const hidePopover = () => {
    clearTimeout(hideTimer)
    popoverCard = null
    if (popover) popover.classList.remove('is-visible')
  }

  const scheduleHidePopover = () => {
    clearTimeout(hideTimer)
    hideTimer = setTimeout(hidePopover, 160)
  }

  const ensurePopover = () => {
    if (popover) return popover
    popover = document.querySelector('.research-timeline-popover') || document.createElement('div')
    popover.className = 'research-timeline-popover'
    if (!popover.isConnected) document.body.appendChild(popover)
    popover.addEventListener('mouseenter', () => { clearTimeout(hideTimer) })
    popover.addEventListener('mouseleave', scheduleHidePopover)
    return popover
  }

  // 按缩放系数定位：width/maxHeight 以未缩放布局值写入，视觉尺寸 = 布局尺寸 × zoomFactor
  const placePopover = (card, zoomFactor) => {
    const pop = ensurePopover()
    pop.style.width = `${Math.round(Math.min(440, window.innerWidth - 24) / zoomFactor)}px`
    pop.style.maxHeight = `${Math.round((window.innerHeight * 0.66) / zoomFactor)}px`
    const cardBox = card.getBoundingClientRect()
    const popW = pop.offsetWidth * zoomFactor
    const popH = pop.offsetHeight * zoomFactor
    const spaceBelow = window.innerHeight - cardBox.bottom
    const spaceAbove = cardBox.top
    let left = cardBox.left + cardBox.width / 2 - popW / 2
    left = Math.max(10, Math.min(left, window.innerWidth - popW - 10))
    let top = spaceBelow >= Math.min(popH + 24, spaceAbove) || spaceBelow >= popH + 24 ? cardBox.bottom + 12 : cardBox.top - 12 - popH
    top = Math.max(12, Math.min(top, window.innerHeight - popH - 12))
    pop.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px) scale(${zoomFactor})`
  }

  const showPopover = (card, zoomFactor) => {
    const pop = ensurePopover()
    clearTimeout(hideTimer)
    pop.textContent = ''

    const meta = document.createElement('div')
    meta.className = 'research-timeline-popover-meta'
    const track = card.querySelector('.research-timeline-track')
    if (track) meta.appendChild(track.cloneNode(true))
    const status = card.querySelector('.research-timeline-status')
    if (status) meta.appendChild(status.cloneNode(true))
    const date = card.querySelector('.research-timeline-card-date')
    if (date) {
      const time = document.createElement('time')
      time.textContent = date.textContent.trim()
      meta.appendChild(time)
    }
    pop.appendChild(meta)

    const title = card.querySelector('.research-timeline-card-title')
    if (title) {
      const heading = document.createElement('strong')
      heading.className = 'research-timeline-popover-title'
      heading.textContent = title.textContent
      pop.appendChild(heading)
    }
    const summary = card.querySelector('.research-timeline-card-summary')
    if (summary) {
      const paragraph = document.createElement('p')
      paragraph.className = 'research-timeline-popover-summary'
      paragraph.textContent = summary.textContent
      pop.appendChild(paragraph)
    }

    popoverCard = card
    placePopover(card, zoomFactor)
    pop.classList.add('is-visible')
  }

  charts.forEach(chart => {
    const viewport = chart.querySelector('.research-timeline-viewport')
    if (!viewport) return

    const strip = viewport.querySelector('.research-timeline-strip')
    const minZoom = 0.5
    const maxZoom = 3
    let zoom = 1

    let dragging = false
    let moved = false
    let pointerId = null
    let startX = 0
    let startY = 0
    let startScrollLeft = 0
    let startScrollTop = 0
    let suppressClick = false
    let interacted = false

    const isScrollable = () => viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight

    const updateCursor = () => {
      viewport.style.cursor = isScrollable() ? 'grab' : ''
    }

    viewport.style.touchAction = 'pan-y'

    const setZoom = (nextZoom, clientX, clientY) => {
      if (!strip) return
      const clampedZoom = Math.min(maxZoom, Math.max(minZoom, nextZoom))
      const viewportBox = viewport.getBoundingClientRect()
      const offsetLeft = (typeof clientX === 'number' ? clientX : viewportBox.left + viewport.clientWidth / 2) - viewportBox.left
      const offsetTop = (typeof clientY === 'number' ? clientY : viewportBox.top + viewport.clientHeight / 2) - viewportBox.top
      const contentX = viewport.scrollLeft + offsetLeft
      const contentY = viewport.scrollTop + offsetTop
      const zoomRatio = clampedZoom / zoom

      zoom = clampedZoom
      strip.style.zoom = String(zoom)
      viewport.scrollLeft = contentX * zoomRatio - offsetLeft
      viewport.scrollTop = contentY * zoomRatio - offsetTop
      scrollFromZoom = true
      clearTimeout(scrollFromZoomTimer)
      scrollFromZoomTimer = setTimeout(() => { scrollFromZoom = false }, 90)
      updateCursor()
      if (popoverCard && popover && popover.classList.contains('is-visible') && chart.contains(popoverCard)) {
        placePopover(popoverCard, zoom)
      }
    }

    const centerTimeline = () => {
      if (interacted) return
      if (viewport.scrollHeight <= viewport.clientHeight) return

      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2
      updateCursor()
    }

    const scheduleCenter = () => {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(centerTimeline)
      } else {
        centerTimeline()
      }
    }

    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return

      interacted = true
      hidePopover()
      suppressClick = false
      dragging = true
      moved = false
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      startScrollLeft = viewport.scrollLeft
      startScrollTop = viewport.scrollTop
      viewport.style.cursor = 'grabbing'
      viewport.style.userSelect = 'none'
    })

    viewport.addEventListener('wheel', event => {
      event.preventDefault()
      interacted = true
      const direction = event.deltaY < 0 ? 1 : -1
      setZoom(zoom * (1 + direction * 0.12), event.clientX, event.clientY)
    }, { passive: false })
    viewport.addEventListener('scroll', () => { if (!scrollFromZoom) hidePopover() }, { passive: true })
    window.addEventListener('scroll', hidePopover, { passive: true })

    window.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== pointerId) return

      const deltaX = event.clientX - startX
      const deltaY = event.clientY - startY
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) moved = true
      if (!moved) return

      if (viewport.setPointerCapture && (!viewport.hasPointerCapture || !viewport.hasPointerCapture(pointerId))) {
        viewport.setPointerCapture(pointerId)
      }

      viewport.scrollLeft = startScrollLeft - deltaX
      viewport.scrollTop = startScrollTop - deltaY
      event.preventDefault()
    })

    const stopDragging = event => {
      if (!dragging || (event && event.pointerId !== pointerId)) return

      suppressClick = moved
      dragging = false
      pointerId = null
      viewport.style.cursor = isScrollable() ? 'grab' : ''
      viewport.style.userSelect = ''

      if (event && viewport.releasePointerCapture && viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId)
      }
    }

    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
    viewport.addEventListener('lostpointercapture', stopDragging)
    viewport.addEventListener('click', event => {
      if (!suppressClick) return

      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }, true)
    viewport.addEventListener('dragstart', event => event.preventDefault())
    window.addEventListener('resize', () => {
      updateCursor()
      scheduleCenter()
    })

    viewport.querySelectorAll('img').forEach(img => {
      img.addEventListener('load', scheduleCenter, { once: true })
    })

    viewport.querySelectorAll('.research-timeline-card').forEach(card => {
      card.addEventListener('mouseenter', () => { if (!dragging) showPopover(card, zoom) })
      card.addEventListener('mouseleave', scheduleHidePopover)
      card.addEventListener('focus', () => { if (!dragging) showPopover(card, zoom) })
      card.addEventListener('blur', scheduleHidePopover)
      card.addEventListener('click', hidePopover)
    })

    scheduleCenter()
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleCenter).catch(() => {})
    }

    updateCursor()
  })
})()
