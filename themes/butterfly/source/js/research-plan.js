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

  const postByKey = new Map()
  posts.forEach(post => {
    const key = keyFor(post.title)
    if (key) postByKey.set(key, post)
  })

  const header = table.querySelector('thead tr') || table.querySelector('tr')
  if (header) {
    const statusHeader = document.createElement('th')
    statusHeader.textContent = '状态'
    statusHeader.setAttribute('scope', 'col')
    header.appendChild(statusHeader)
  }

  const rows = [...table.querySelectorAll('tbody tr')]
  const state = {}

  rows.forEach((row, rowIndex) => {
    const cells = [...row.children]
    const rowNumber = Number((cells[0] && cells[0].textContent.match(/\d+/) || [rowIndex + 1])[0])
    const paperTitle = cells[2] ? cells[2].textContent.trim() : ''
    const post = postByKey.get(keyFor(paperTitle))
    const auto = Boolean(post)
    const manualComplete = Boolean(manual[rowNumber])
    const complete = auto || manualComplete
    const statusCell = document.createElement('td')
    statusCell.className = 'research-plan-status'

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
