// 找录好的视频里「画面完全不动」的段落：无头 Chrome 2 倍速播放，逐帧和上一帧比像素差。
// 用法：在 webm 所在目录起 `python3 -m http.server 8765 --bind 127.0.0.1`，再 `node analyze.mjs /xxx.webm`
// MediaRecorder 的 webm 没有 Cues，seek 永远拿到第一帧，所以只能播放取帧；后台标签页不解码，所以用无头浏览器。
import { chromium } from 'playwright'

const file = process.argv[2]
const MIN_STILL_SEC = Number(process.argv[3] ?? 0.5)
const b = await chromium.launch({ channel: 'chrome', headless: true })
const p = await b.newPage()
await p.goto('http://127.0.0.1:8765/')
const r = await p.evaluate(async (file) => {
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.src = file
  document.body.appendChild(v)
  await new Promise((res, rej) => {
    v.onloadedmetadata = res
    v.onerror = () => rej(new Error('load'))
  })
  const c = document.createElement('canvas')
  c.width = 160
  c.height = 82
  const g = c.getContext('2d', { willReadFrequently: true })
  let prev = null
  const diffs = []
  v.playbackRate = 2
  await new Promise((resolve) => {
    const onFrame = (_, meta) => {
      g.drawImage(v, 0, 0, 160, 82)
      const d = g.getImageData(0, 0, 160, 82).data
      if (prev) {
        let s = 0
        for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2])
        diffs.push([+meta.mediaTime.toFixed(2), s])
      }
      prev = d
      if (!v.ended) v.requestVideoFrameCallback(onFrame)
    }
    v.requestVideoFrameCallback(onFrame)
    v.onended = resolve
    v.play()
  })
  return { dur: v.duration, diffs }
}, file)
await b.close()

const still = []
let start = null
for (const [t, s] of r.diffs) {
  if (s < 300) start ??= t
  else {
    if (start !== null && t - start >= MIN_STILL_SEC) still.push([start, +(t - start).toFixed(1)])
    start = null
  }
}
if (start !== null) still.push([start, +(r.dur - start).toFixed(1)])
console.log('时长（秒）', Number.isFinite(r.dur) ? r.dur.toFixed(2) : `${r.dur}（文件头没写时长）`)
console.log('完全静止段 [开始秒, 持续秒]:', JSON.stringify(still))
