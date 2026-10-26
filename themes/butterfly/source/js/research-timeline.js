(() => {
  const charts = [...document.querySelectorAll('.research-timeline-chart')]

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
      updateCursor()
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

    scheduleCenter()
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleCenter).catch(() => {})
    }

    updateCursor()
  })
})()
