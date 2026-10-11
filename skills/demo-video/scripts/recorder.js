// 录制层：动作原语 + 标签页录屏 + 补 webm 时长 + 「开始录制」按钮。须在 director.js 之后注入，挂到 window.__demo。
// 剧本调用：window.__demo.arm(async (h) => { ...用 h.move / h.drift / h.press 编排... }, 'xxx-demo.webm')
;(() => {
  const d = window.__dir
  if (!d) throw new Error('先注入 director.js')

  /** MediaRecorder 产出的 webm 不写 Duration：在 Segment/Info 末尾插入 Duration（float64 毫秒）并改写 Info 长度 */
  function fixWebmDuration(bytes, durationMs) {
    const u8 = new Uint8Array(bytes)
    let i = -1
    for (let k = 0; k < Math.min(u8.length - 4, 1 << 16); k++) {
      if (u8[k] === 0x15 && u8[k + 1] === 0x49 && u8[k + 2] === 0xa9 && u8[k + 3] === 0x66) {
        i = k
        break
      }
    }
    if (i < 0) throw new Error('Info not found')
    const sizePos = i + 4
    const first = u8[sizePos]
    let w = 1
    while (w <= 8 && !(first & (0x80 >> (w - 1)))) w++
    let size = first & (0xff >> w)
    for (let k = 1; k < w; k++) size = size * 256 + u8[sizePos + k]
    const cs = sizePos + w
    const ce = cs + size
    const dur = new Uint8Array(11)
    dur[0] = 0x44
    dur[1] = 0x89
    dur[2] = 0x88
    new DataView(dur.buffer).setFloat64(3, durationMs)
    const ns = size + 11
    if (ns >= Math.pow(2, 7 * w) - 1) throw new Error('Info size width too small')
    const sb = new Uint8Array(w)
    let v = ns
    for (let k = w - 1; k >= 0; k--) {
      sb[k] = v & 0xff
      v = Math.floor(v / 256)
    }
    sb[0] |= 0x80 >> (w - 1)
    const out = new Uint8Array(u8.length + 11)
    out.set(u8.subarray(0, sizePos), 0)
    out.set(sb, sizePos)
    out.set(u8.subarray(cs, ce), cs)
    out.set(dur, ce)
    out.set(u8.subarray(ce), ce + 11)
    return out
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const until = async (fn, ms = 15000) => {
    const t = Date.now()
    while (Date.now() - t < ms) {
      const v = fn()
      if (v) return v
      await sleep(100)
    }
    throw new Error('until timeout')
  }
  /** 找文字完全匹配 re 的叶子元素 */
  const leaf = (root, re) =>
    [...root.querySelectorAll('*')].find((e) => e.childElementCount === 0 && re.test(e.textContent.trim()))
  /** 找 innerText 匹配 re 的按钮 / 链接 */
  const button = (root, re) => [...root.querySelectorAll('button,a,[role="button"]')].find((b) => re.test(b.innerText.trim()))
  /** 元素框内 (ax, ay) 比例处的页面坐标 */
  const pt = (el, ax = 0.5, ay = 0.5) => {
    const b = el.getBoundingClientRect()
    return d.toPage(b.left + b.width * ax, b.top + b.height * ay)
  }
  /** 鼠标 + 镜头一起移到元素上；zoom 不传则镜头不动，focus 不传则对准鼠标落点 */
  const move = (el, o = {}) =>
    d.go({ to: pt(el, o.ax, o.ay), zoom: o.zoom, focus: o.focus ? pt(o.focus) : undefined, ms: o.ms ?? 1000 })
  /** 停留：鼠标沿内容慢慢滑过去，镜头同时再推近 push，替代完全静止（完全静止看着像卡住） */
  const drift = (el, focusEl, { ax = 0.5, ay = 0.5, push = 0.07, ms = 1100 } = {}) =>
    d.go({ to: pt(el, ax, ay), zoom: d.zoomNow() + push, focus: pt(focusEl), ms })
  /** 原地点击：鼠标已停在目标上，只出涟漪 + 真实 click，不再移动 */
  const press = async (el) => {
    await sleep(160)
    d.ripple()
    await sleep(110)
    el.click()
  }
  /** 镜头拉回原尺寸，鼠标留在页面上原处 */
  const zoomOut = (ms = 900) => d.go({ zoom: 1, ms })

  const h = { d, sleep, until, leaf, button, pt, move, drift, press, zoomOut, caption: (t) => d.caption(t) }

  let btn
  async function record(script, filename) {
    btn.remove()
    let stream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: { ideal: 60, max: 60 }, width: { ideal: 3024 }, height: { ideal: 1542 } },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      })
    } catch (e) {
      window.__demoState = 'share-cancelled: ' + e.message
      d.layer().appendChild(btn)
      return
    }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const stopped = new Promise((r) => (rec.onstop = r))
    rec.start(250)
    const tStart = performance.now()
    await sleep(600)
    window.__demoState = 'running'
    try {
      await script(h)
    } catch (e) {
      window.__demoState = 'demo-error: ' + e.message
    }
    rec.stop()
    stream.getTracks().forEach((t) => t.stop())
    await stopped
    const durationMs = performance.now() - tStart
    let blob = new Blob(chunks, { type: 'video/webm' })
    try {
      blob = new Blob([fixWebmDuration(await blob.arrayBuffer(), durationMs)], { type: 'video/webm' })
    } catch (e) {
      window.__fixErr = e.message
    }
    window.__demoBlobSize = blob.size
    window.__demoDuration = durationMs
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (!String(window.__demoState).startsWith('demo-error')) window.__demoState = 'done'
  }

  window.__demo = {
    h,
    /** 放出「开始录制」按钮：getDisplayMedia 必须由用户亲手点击触发，后台标签页也不跑动画，所以只能交给用户点 */
    arm(script, filename = 'demo.webm', label = '● 开始录制') {
      btn?.remove()
      btn = document.createElement('button')
      btn.textContent = label
      btn.style.cssText =
        'position:absolute;right:24px;top:20px;pointer-events:auto;padding:10px 18px;border-radius:999px;border:0;background:#e5484d;color:#fff;font:600 15px -apple-system,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);'
      btn.onclick = () => record(script, filename)
      d.layer().appendChild(btn)
      window.__demoState = 'armed'
      return 'armed'
    },
    /** 不录制、直接跑一遍剧本，用于先验证选择器（前台标签页才有动画） */
    dryRun: (script) => script(h),
  }
})()
'recorder ok'
