(() => {
  const getRightside = () => document.getElementById('rightside')

  const setImportant = (element, property, value) => {
    element.style.setProperty(property, value, 'important')
  }

  const updateRightsidePosition = () => {
    const rightside = getRightside()
    if (!rightside) return

    const minTop = 90
    const maxTop = Math.max(minTop, window.innerHeight - rightside.offsetHeight - 90)
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const progress = maxScroll > 0 ? scrollTop / maxScroll : 0
    const top = minTop + (maxTop - minTop) * progress

    setImportant(rightside, 'position', 'fixed')
    setImportant(rightside, 'left', 'auto')
    setImportant(rightside, 'right', '0')
    setImportant(rightside, 'top', `${top}px`)
    setImportant(rightside, 'bottom', 'auto')
    setImportant(rightside, 'z-index', '99999')
    setImportant(rightside, 'transition', 'top 0.25s ease, transform 0.3s ease, opacity 0.3s ease')
  }

  const hideRightside = () => {
    const rightside = getRightside()
    if (!rightside) return

    setImportant(rightside, 'opacity', '0')
    setImportant(rightside, 'transform', 'translateX(45px)')
    setImportant(rightside, 'pointer-events', 'none')
  }

  const showRightside = () => {
    const rightside = getRightside()
    if (!rightside) return

    updateRightsidePosition()
    setImportant(rightside, 'opacity', '1')
    setImportant(rightside, 'transform', 'translateX(0)')
    setImportant(rightside, 'pointer-events', 'auto')

    clearTimeout(window.__rightsideHideTimer)
    window.__rightsideHideTimer = setTimeout(hideRightside, 1800)
  }


  const handlePointerMove = event => {
    const rightside = getRightside()
    if (!rightside) return

    updateRightsidePosition()

    const rect = rightside.getBoundingClientRect()
    const sensingWidth = 96
    const sensingPaddingY = 80
    const inRightZone = event.clientX >= window.innerWidth - sensingWidth
    const inVerticalZone = event.clientY >= rect.top - sensingPaddingY && event.clientY <= rect.bottom + sensingPaddingY

    if (inRightZone && inVerticalZone) {
      showRightside()
    } else if (!rightside.matches(':hover')) {
      hideRightside()
    }
  }

  document.addEventListener('mousemove', handlePointerMove, { passive: true })
  document.addEventListener('scroll', updateRightsidePosition, { passive: true })
  document.addEventListener('touchstart', showRightside, { passive: true })
  window.addEventListener('resize', updateRightsidePosition, { passive: true })
  document.addEventListener('DOMContentLoaded', () => {
    updateRightsidePosition()
    hideRightside()
  })
  document.addEventListener('pjax:complete', () => {
    updateRightsidePosition()
    hideRightside()
  })
})()
