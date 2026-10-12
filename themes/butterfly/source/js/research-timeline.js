(() => {
  const charts = [...document.querySelectorAll('.research-timeline-chart')]

  charts.forEach(chart => {
    const points = [...chart.querySelectorAll('.research-timeline-point')]
    const detail = chart.querySelector('.research-timeline-detail')
    const svg = chart.querySelector('svg')

    if (!points.length || !detail || !svg) return

    const viewport = chart.querySelector('.research-timeline-viewport')

    if (viewport) {
      const baseWidth = svg.getBoundingClientRect().width || svg.viewBox.baseVal.width || 1600
      const minZoom = 0.5
      const maxZoom = 3
      let zoom = 1
      let dragging = false
      let moved = false
      let pointerId = null
      let startX = 0
      let startScrollLeft = 0
      let suppressClick = false

      const updateCursor = () => {
        viewport.style.cursor = viewport.scrollWidth > viewport.clientWidth ? 'grab' : ''
      }

      viewport.style.touchAction = 'pan-y'

      const setZoom = (nextZoom, clientX) => {
        const clampedZoom = Math.min(maxZoom, Math.max(minZoom, nextZoom))
        const viewportBox = viewport.getBoundingClientRect()
        const pointerX = typeof clientX === 'number' ? clientX : viewportBox.left + viewport.clientWidth / 2
        const pointerOffset = pointerX - viewportBox.left
        const contentX = viewport.scrollLeft + pointerOffset
        const zoomRatio = clampedZoom / zoom

        zoom = clampedZoom
        svg.style.width = `${baseWidth * zoom}px`
        viewport.scrollLeft = contentX * zoomRatio - pointerOffset
        updateCursor()
      }

      viewport.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return

        suppressClick = false
        dragging = true
        moved = false
        pointerId = event.pointerId
        startX = event.clientX
        startScrollLeft = viewport.scrollLeft
        viewport.style.cursor = 'grabbing'
        viewport.style.userSelect = 'none'
      })

      window.addEventListener('pointermove', event => {
        if (!dragging || event.pointerId !== pointerId) return

        const deltaX = event.clientX - startX
        if (Math.abs(deltaX) > 4) moved = true
        if (!moved) return

        if (viewport.setPointerCapture && (!viewport.hasPointerCapture || !viewport.hasPointerCapture(pointerId))) {
          viewport.setPointerCapture(pointerId)
        }

        viewport.scrollLeft = startScrollLeft - deltaX
        event.preventDefault()
      })

      const stopDragging = event => {
        if (!dragging || (event && event.pointerId !== pointerId)) return

        suppressClick = moved
        dragging = false
        pointerId = null
        viewport.style.cursor = viewport.scrollWidth > viewport.clientWidth ? 'grab' : ''
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
      viewport.addEventListener('wheel', event => {
        event.preventDefault()
        const direction = event.deltaY < 0 ? 1 : -1
        setZoom(zoom * (1 + direction * 0.12), event.clientX)
      }, { passive: false })
      window.addEventListener('resize', updateCursor)

      updateCursor()
    }

    const layoutLabels = () => {
      const svgBox = svg.viewBox.baseVal
      const chartPadding = 8
      const labelGap = 8
      const circleGap = 8

      const items = points.map(point => {
        const label = point.querySelector('.research-timeline-label')
        const circle = point.querySelector('circle:not(.research-timeline-hit)')
        if (!label || !circle) return null

        label.removeAttribute('transform')
        const box = label.getBBox()
        return {
          label,
          box: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height
          }
        }
      }).filter(Boolean)

      if (!items.length) return

      const circleBoxes = points.map(point => {
        const circle = point.querySelector('circle:not(.research-timeline-hit)')
        if (!circle) return null

        const box = circle.getBBox()
        return {
          left: box.x - circleGap,
          top: box.y - circleGap,
          right: box.x + box.width + circleGap,
          bottom: box.y + box.height + circleGap
        }
      }).filter(Boolean)

      const rectFor = (item, dy) => ({
        left: item.box.x - 2,
        top: item.box.y + dy - 2,
        right: item.box.x + item.box.width + 2,
        bottom: item.box.y + item.box.height + dy + 2
      })

      const overlapArea = (a, b) => {
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        return width > 0 && height > 0 ? width * height : 0
      }

      const outsideArea = rect => {
        const width = Math.max(0, rect.right - rect.left)
        const height = Math.max(0, rect.bottom - rect.top)
        const horizontal = Math.max(0, chartPadding - rect.left) + Math.max(0, rect.right - (svgBox.width - chartPadding))
        const vertical = Math.max(0, chartPadding - rect.top) + Math.max(0, rect.bottom - (svgBox.height - chartPadding))
        return horizontal * height + vertical * width
      }

      const placements = items.map(item => ({
        item,
        dy: 0,
        rect: rectFor(item, 0)
      }))

      for (let pass = 0; pass < 3; pass += 1) {
        placements.forEach((placement, placementIndex) => {
          const step = Math.max(24, placement.item.box.height + labelGap)
          const offsets = [0]

          for (let level = 1; level <= 4; level += 1) {
            offsets.push(-step * level, step * level)
          }

          let best = null

          offsets.forEach(dy => {
            const rect = rectFor(placement.item, dy)
            let score = Math.abs(dy) + outsideArea(rect) * 1000

            placements.forEach((other, otherIndex) => {
              if (otherIndex === placementIndex) return
              const overlap = overlapArea(rect, other.rect)
              if (overlap) score += overlap * 1000 + 100000
            })

            circleBoxes.forEach(circle => {
              const overlap = overlapArea(rect, circle)
              if (overlap) score += overlap * 1200 + 120000
            })

            if (!best || score < best.score) {
              best = { dy, rect, score }
            }
          })

          placement.dy = best.dy
          placement.rect = best.rect
        })
      }

      placements.forEach(({ item, dy }) => {
        if (dy) {
          item.label.setAttribute('transform', `translate(0 ${dy.toFixed(1)})`)
        }
      })
    }

    const scheduleLayout = () => {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(layoutLabels)
      } else {
        layoutLabels()
      }
    }

    scheduleLayout()
    window.addEventListener('resize', scheduleLayout)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleLayout).catch(() => {})
    }

    const date = detail.querySelector('time')
    const track = detail.querySelector('.research-timeline-track')
    const status = detail.querySelector('.research-timeline-status')
    const title = detail.querySelector('h4')
    const summary = detail.querySelector('p')
    const link = detail.querySelector('.research-timeline-link')
    const linkText = link && link.querySelector('span')

    const setActivePoint = point => {
      points.forEach(item => item.classList.toggle('is-active', item === point))

      if (date) {
        date.textContent = point.dataset.date || ''
        date.setAttribute('datetime', point.dataset.date || '')
      }
      if (track) {
        track.textContent = point.dataset.track || ''
        track.className = `research-timeline-track track-${point.dataset.trackKey || ''}`
      }
      if (status) {
        status.hidden = point.dataset.status !== 'planned'
      }
      if (title) title.textContent = point.dataset.stepTitle || point.dataset.title || ''
      if (summary) summary.textContent = point.dataset.summary || ''
      if (link) {
        link.setAttribute('href', point.getAttribute('href'))
        link.setAttribute('title', point.dataset.title || '')
      }
      if (linkText) linkText.textContent = point.dataset.title || ''
    }

    points.forEach(point => {
      point.addEventListener('pointerenter', () => setActivePoint(point))
      point.addEventListener('focus', () => setActivePoint(point))
      point.addEventListener('touchstart', () => setActivePoint(point), { passive: true })
    })

    const activePoint = points.find(point => point.classList.contains('is-active')) || points[points.length - 1]
    setActivePoint(activePoint)
  })
})()
