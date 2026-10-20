(() => {
  const container = document.querySelector('.research-plan-container')
  const table = container && container.querySelector('table')

  if (!container || !table) return

  const posts = window.RESEARCH_PLAN_POSTS || []
  const storageKey = 'researchPlanCompletions'
  const count = container.querySelector('#research-plan-count')
  const progress = container.querySelector('.research-plan-progress')
  const progressSpan = container.querySelector('#research-plan-progress-span')

  let manual = {}
  try {
    manual = JSON.parse(window.localStorage.getItem(storageKey)) || {}
  } catch (_) {
    manual = {}
  }

  const normalize = value => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim()
    .replace(/^20\d{2}\s+/, '')

  const keyFor = value => normalize(value).slice(0, 8)

  const postIndex = posts.map(post => ({
    post,
    normalizedTitle: normalize(post.title)
  }))

  const findPost = paperTitle => {
    const normalizedTitle = normalize(paperTitle)
    const key = keyFor(normalizedTitle)
    if (!key) return null

    const candidates = postIndex.filter(item => item.normalizedTitle.startsWith(key))
    if (!candidates.length) return null

    return candidates
      .map(item => {
        const exact = item.normalizedTitle === normalizedTitle
        const prefix = item.normalizedTitle.startsWith(normalizedTitle)
          || normalizedTitle.startsWith(item.normalizedTitle)
        const postTokens = new Set(item.normalizedTitle.split(' '))
        const sharedTokens = normalizedTitle.split(' ').filter(token => postTokens.has(token)).length
        const score = (exact ? 10000 : 0) + (prefix ? 5000 : 0) + sharedTokens * 10
        return { ...item, score }
      })
      .sort((a, b) => b.score - a.score || Math.abs(a.normalizedTitle.length - normalizedTitle.length) - Math.abs(b.normalizedTitle.length - normalizedTitle.length))[0]
      .post
  }

  const header = table.querySelector('thead tr') || table.querySelector('tr')
  if (header) {
    const statusHeader = document.createElement('th')
    statusHeader.textContent = '状态'
    statusHeader.setAttribute('scope', 'col')
    header.appendChild(statusHeader)
  }

  const columnLabels = header
    ? [...header.children].map((cell, index) => index === header.children.length - 1 ? '状态' : cell.textContent.trim())
    : []
  const rows = [...table.querySelectorAll('tbody tr')]
  const state = {}

  rows.forEach((row, rowIndex) => {
    const cells = [...row.children]
    cells.forEach((cell, index) => cell.setAttribute('data-label', columnLabels[index] || ''))
    const rowNumber = Number((cells[0] && cells[0].textContent.match(/\d+/) || [rowIndex + 1])[0])
    const paperTitle = cells[2] ? cells[2].textContent.trim() : ''
    const post = findPost(paperTitle)
    const auto = Boolean(post)
    const manualComplete = Boolean(manual[rowNumber])
    const complete = auto || manualComplete
    const statusCell = document.createElement('td')
    statusCell.className = 'research-plan-status'
    statusCell.setAttribute('data-label', '状态')

    if (auto) {
      const link = document.createElement('a')
      link.className = 'research-plan-toggle is-complete'
      link.href = post.path
      link.textContent = '已完成'
      link.title = '已上传对应文章'
      statusCell.appendChild(link)
    } else {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `research-plan-toggle${manualComplete ? ' is-complete' : ''}`
      button.textContent = manualComplete ? '已完成' : '完成'
      button.setAttribute('aria-pressed', String(manualComplete))

      button.addEventListener('click', () => {
        const next = !state[rowNumber].manual
        state[rowNumber].manual = next
        manual[rowNumber] = next

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(manual))
        } catch (_) {}

        button.classList.toggle('is-complete', next)
        button.textContent = next ? '已完成' : '完成'
        button.setAttribute('aria-pressed', String(next))
        row.classList.toggle('is-complete', state[rowNumber].auto || next)
        updateProgress()
      })

      statusCell.appendChild(button)
    }

    row.appendChild(statusCell)
    row.classList.toggle('is-complete', complete)
    state[rowNumber] = { auto, manual: manualComplete }
  })

  function updateProgress() {
    if (!count || !progress || !progressSpan) return

    const total = rows.length
    const completed = Object.values(state).filter(item => item.auto || item.manual).length
    const percent = total ? Math.round((completed / total) * 100) : 0

    count.textContent = `${completed}/${total} 篇`
    progressSpan.style.width = `${percent}%`
    progress.setAttribute('aria-valuenow', String(percent))
  }

  updateProgress()
})()
