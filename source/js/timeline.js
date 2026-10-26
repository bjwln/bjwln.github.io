/**
 * 归档时间线：二维拖拽平移 + 浏览量填充
 */
;(function () {
  'use strict'

  const viewport = document.querySelector('.tl-viewport')
  const stage = viewport ? viewport.querySelector('.tl-stage') : null
  if (viewport && stage) initPan(viewport, stage)
  fillPv()

  function initPan(viewport, stage) {
    let tx = 0
    let ty = 0

    const apply = () => {
      stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px)'
    }

    const clamp = () => {
      // 舞台小于视口时居中固定，大于视口时限制在 [视口-舞台, 0]
      const slackX = viewport.clientWidth - stage.offsetWidth
      const slackY = viewport.clientHeight - stage.offsetHeight
      tx = slackX >= 0 ? slackX / 2 : Math.min(0, Math.max(slackX, tx))
      ty = slackY >= 0 ? slackY / 2 : Math.min(0, Math.max(slackY, ty))
    }

    const update = () => {
      clamp()
      apply()
    }
    update()
    window.addEventListener('resize', update)

    // 指针拖拽（鼠标 / 触摸 / 触控笔）
    let dragging = false
    let moved = false
    let startX = 0
    let startY = 0
    let baseX = 0
    let baseY = 0

    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      dragging = true
      moved = false
      startX = e.clientX
      startY = e.clientY
      baseX = tx
      baseY = ty
      viewport.classList.add('is-dragging')
      try {
        viewport.setPointerCapture(e.pointerId)
      } catch (err) {}
    })

    viewport.addEventListener('pointermove', e => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!moved && Math.abs(dx) + Math.abs(dy) > 5) moved = true
      tx = baseX + dx
      ty = baseY + dy
      update()
    })

    const stop = () => {
      dragging = false
      viewport.classList.remove('is-dragging')
    }
    viewport.addEventListener('pointerup', stop)
    viewport.addEventListener('pointercancel', stop)

    // 拖拽结束后拦截这次 click，避免误点卡片
    viewport.addEventListener(
      'click',
      e => {
        if (moved) {
          e.preventDefault()
          e.stopPropagation()
          moved = false
        }
      },
      true
    )

    // 滚轮：deltaY 上下、deltaX 或 Shift+滚轮 左右；到边界且无水平增量时放行页面滚动
    viewport.addEventListener(
      'wheel',
      e => {
        const canX = stage.offsetWidth > viewport.clientWidth + 1
        const canY = stage.offsetHeight > viewport.clientHeight + 1
        let dx = e.deltaX
        let dy = e.deltaY
        if (e.shiftKey && !dx && canX) {
          dx = dy
          dy = 0
        }
        const prevX = tx
        const prevY = ty
        if (canX) tx -= dx
        if (canY) ty -= dy
        update()
        if (tx === prevX && ty === prevY) return
        e.preventDefault()
      },
      { passive: false }
    )
  }

  function fillPv() {
    const els = document.querySelectorAll('.tl-card-pv[data-pv-path]')
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
          const num = el.querySelector('.tl-pv-num')
          if (num && typeof pv === 'number') num.textContent = pv
        })
      })
      .catch(() => {})
  }
})()
