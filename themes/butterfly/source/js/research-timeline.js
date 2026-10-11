(() => {
  const points = [...document.querySelectorAll('.research-timeline-point')]
  const detail = document.querySelector('.research-timeline-detail')

  if (!points.length || !detail) return

  const date = detail.querySelector('time')
  const track = detail.querySelector('.research-timeline-track')
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
})()
