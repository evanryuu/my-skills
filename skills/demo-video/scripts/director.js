// 导演层：假鼠标 + 镜头（整页 transform 缩放平移）+ 点击涟漪 + 字幕。整段注入目标页执行，挂到 window.__dir。
// 镜头公式：屏幕坐标 = (tx, ty) + s * 页面坐标；叠加层挂在 <html> 下、不随镜头缩放。
delete window.__dir
;(() => {
  const W = () => innerWidth
  const H = () => innerHeight
  // 鼠标与镜头同一条 cubic in-out 同步插值；换成弹簧跟随会过冲回弹，看的人头晕
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const cam = { tx: 0, ty: 0, s: 1 }
  const cur = { x: W() * 0.5, y: H() * 0.62, visible: false }
  let layer, cursorEl, captionEl, crispTimer

  const mount = () => {
    if (layer && document.documentElement.contains(layer)) return
    layer = document.createElement('div')
    layer.id = '__dirLayer'
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;'
    cursorEl = document.createElement('div')
    cursorEl.style.cssText =
      'position:absolute;left:0;top:0;width:28px;height:28px;opacity:0;transition:opacity .3s;will-change:transform;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));'
    cursorEl.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.6 16.2 L20 16.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    captionEl = document.createElement('div')
    captionEl.style.cssText =
      'position:absolute;left:50%;bottom:36px;transform:translate(-50%,12px);max-width:80%;padding:12px 22px;border-radius:999px;background:rgba(17,17,17,.82);color:#fff;font:500 18px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:0;transition:opacity .4s ease,transform .4s ease;backdrop-filter:blur(8px);white-space:nowrap;'
    layer.append(cursorEl, captionEl)
    document.documentElement.appendChild(layer)
  }

  const render = () => {
    mount()
    const b = document.body
    b.style.transformOrigin = '0 0'
    b.style.transform =
      cam.s === 1 && cam.tx === 0 && cam.ty === 0 ? '' : `translate(${cam.tx}px,${cam.ty}px) scale(${cam.s})`
    cursorEl.style.transform = `translate(${cam.tx + cam.s * cur.x - 5}px,${cam.ty + cam.s * cur.y - 3}px)`
    cursorEl.style.opacity = cur.visible ? '1' : '0'
  }

  // 镜头对准页面坐标 f、放大 s，并夹在页面边界内，不露出页面外的空白
  const camFor = (s, f) => {
    if (s === 1 || !f) return { tx: 0, ty: 0, s: 1 }
    let tx = W() / 2 - s * f[0]
    let ty = H() / 2 - s * f[1]
    tx = Math.min(0, Math.max(W() - s * W(), tx))
    ty = Math.min(0, Math.max(H() - s * H(), ty))
    return { tx, ty, s }
  }

  const animate = (ms, step, camMoves) =>
    new Promise((resolve) => {
      // 镜头动时让显卡直接缩放已画好的页面，停下 200ms 后再清晰重画，避免每帧重绘整页掉帧
      if (camMoves) {
        clearTimeout(crispTimer)
        document.body.style.willChange = 'transform'
      }
      const t0 = performance.now()
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / ms)
        step(ease(k))
        render()
        if (k < 1) requestAnimationFrame(tick)
        else {
          if (camMoves) crispTimer = setTimeout(() => (document.body.style.willChange = ''), 200)
          resolve()
        }
      }
      requestAnimationFrame(tick)
    })

  window.__dir = {
    /** 同时移动鼠标和镜头：to 是页面坐标；不传 zoom 则镜头不动；不传 focus 则镜头对准 to */
    async go({ to, zoom, focus, ms = 900 }) {
      cur.visible = true
      const c0 = { ...cam }
      const p0 = { x: cur.x, y: cur.y }
      const p1 = to ? { x: to[0], y: to[1] } : p0
      const c1 = zoom === undefined ? c0 : camFor(zoom, focus ?? [p1.x, p1.y])
      const camMoves = c1.s !== c0.s || c1.tx !== c0.tx || c1.ty !== c0.ty
      await animate(
        ms,
        (k) => {
          cur.x = p0.x + (p1.x - p0.x) * k
          cur.y = p0.y + (p1.y - p0.y) * k
          cam.tx = c0.tx + (c1.tx - c0.tx) * k
          cam.ty = c0.ty + (c1.ty - c0.ty) * k
          cam.s = c0.s + (c1.s - c0.s) * k
        },
        camMoves,
      )
    },
    zoomNow: () => cam.s,
    /** getBoundingClientRect 给的是镜头变换后的屏幕坐标，换回页面坐标 */
    toPage(x, y) {
      return [(x - cam.tx) / cam.s, (y - cam.ty) / cam.s]
    },
    ripple() {
      mount()
      const sx = cam.tx + cam.s * cur.x
      const sy = cam.ty + cam.s * cur.y
      const r = document.createElement('div')
      r.style.cssText = `position:absolute;left:${sx - 20}px;top:${sy - 20}px;width:40px;height:40px;border-radius:50%;background:rgba(0,184,184,.35);border:2px solid rgba(0,184,184,.9);transform:scale(.3);transition:transform .5s cubic-bezier(.2,0,0,1),opacity .5s ease;`
      layer.appendChild(r)
      cursorEl.animate([{ scale: 1 }, { scale: 0.82 }, { scale: 1 }], { duration: 220, easing: 'ease-out' })
      requestAnimationFrame(() => {
        r.style.transform = 'scale(1.4)'
        r.style.opacity = '0'
      })
      setTimeout(() => r.remove(), 600)
    },
    caption(text) {
      mount()
      if (!text) {
        captionEl.style.opacity = '0'
        captionEl.style.transform = 'translate(-50%,12px)'
        return
      }
      captionEl.textContent = text
      captionEl.style.opacity = '1'
      captionEl.style.transform = 'translate(-50%,0)'
    },
    layer: () => {
      mount()
      return layer
    },
  }
  render()
})()
'director ok'
