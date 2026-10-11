---
name: demo-video
description: 在用户已登录的 Chrome 标签页里，用脚本编排录制带假鼠标、跟随放大镜头、点击涟漪和字幕的功能演示视频（Screen Studio 风格），输出带时长的 60fps webm。Use when 用户说「录个演示视频」「录一段功能介绍视频」「做个带放大效果的录屏」「鼠标跟随放大」「产品演示视频」「给 release 页录个视频」「screen studio 那种效果」，或要给更新日志 / 文档配一段某个网页功能的操作视频。不用于：剪辑已有视频、录桌面应用、生成 GIF 动图。
---

# 网页功能演示视频

在**用户自己的、已登录的 Chrome 标签页**里注入三段脚本：导演层（假鼠标 + 镜头 + 涟漪 + 字幕）、录制层（动作原语 + 标签页录屏 + 补时长）、剧本（这次要演示的流程）。用户点一下「开始录制」并在 Chrome 弹窗里选「共享此标签页」，剧本自动跑完并下载 webm。

## 为什么是这套做法（别改回去）

| 做法 | 原因 |
|---|---|
| 在用户已登录的 Chrome 里录，不用 Playwright 独立浏览器 | 独立浏览器没有登录态，账号密码 Claude 不能代填 |
| 录屏由用户点按钮触发 | `getDisplayMedia` 必须由用户手势触发；后台标签页也不跑 `requestAnimationFrame`，必须切到前台 |
| 镜头 = `body` 的 `transform: translate + scale`，叠加层挂在 `<html>` 下 | 鼠标、字幕、涟漪不随镜头缩放；镜头公式 `屏幕 = t + s × 页面` |
| 鼠标和镜头同一条 cubic in-out **同步**插值 | 试过弹簧跟随 + 弧线轨迹，用户反馈「晃得头晕」 |
| 停留用 `drift`（鼠标沿内容慢滑 + 镜头再推近 3%–7%），不用纯 `sleep` | 完全静止看起来像卡住了 |
| 点击用 `press` **原地**点 | 点击前先缩回 1 倍会让鼠标在屏幕上「飞」一段，用户明确不要 |
| 镜头动时 `will-change: transform`，停 200ms 后撤掉 | 否则每帧重绘整页（Retina 下约 300 万像素）掉帧；撤掉是为了停稳后重新清晰绘制 |
| 60fps、16Mbps、VP9 | 30fps 观感不顺 |
| 下载前往 webm 文件头补 Duration | MediaRecorder 不写时长：播放器进度条不动、不能拖动 |

## 流程

1. **定剧本（只读）**：用 `mcp__claude-in-chrome__*` 打开目标页，截图看结构，`javascript_tool` 查清要操作的元素怎么找（按文字找比按 class 稳）。**只浏览和打开弹窗，不提交任何表单**。把分镜（每一步：字幕、镜头对准谁、放大倍数、停多久）写给用户确认。会产生数据的操作（创建、提交、删除）默认不点，停在按钮上收尾。
2. **问下载许可**：录完要往用户「下载」文件夹存文件，开录前用 AskUserQuestion 确认一次，说清文件名。
3. **预热**：剧本里要跳转的页面先完整打开一遍再回起点，让路由代码进缓存，录制时点进去不会卡在加载上。
4. **注入**：在同一个标签页依次用 `javascript_tool` 执行三段代码（读文件内容原样传入）：
   - `scripts/director.js`
   - `scripts/recorder.js`
   - 本次剧本：`window.__demo.arm(async (h) => { ... }, '<feature>-demo.webm')`，写法照 `references/example-scheduled.js`
5. **交给用户**：告诉用户切到那个标签页（说清它在哪个标签组、标题是什么）→ 点右上角红色「● 开始录制」→ 弹窗选「此标签页」→ 共享 → 别动鼠标别切标签。注入前先确认 `document.visibilityState`：`hidden` 说明在后台，只能靠用户切过去。
6. **验收**：`window.__demoState` 为 `done`、`window.__demoBlobSize` 有值；看下载文件大小。要量停顿时用 `scripts/analyze.mjs`（见下）。
7. **迭代**：每次重录先 `navigate` 刷新页面清掉上次注入（录完弹窗还开着），再重新注入三段，文件名递增 `-v2`、`-v3`。只改用户点名的那一处，其余参数不动。

## 剧本动作（`h` 上的方法）

| 方法 | 作用 |
|---|---|
| `move(el, { zoom, focus, ms, ax, ay })` | 鼠标移到 el 内 (ax, ay) 比例处；传 `zoom` 则镜头同时缩放并对准 `focus`（默认对准鼠标落点） |
| `drift(el, focusEl, { ax, ay, push, ms })` | 停留：鼠标慢滑到 el 的 (ax, ay)，镜头在当前倍数上再推近 `push` |
| `press(el)` | 原地点击：涟漪 + 真实 `el.click()` |
| `zoomOut(ms)` | 镜头拉回 1 倍，鼠标留在页面原处 |
| `caption(text)` / `caption('')` | 换字幕 / 收起字幕 |
| `leaf(root, /正则/)`、`button(root, /正则/)`、`until(fn)`、`sleep(ms)` | 按文字找元素、等元素出现、等待 |

`window.__demo.dryRun(script)` 不录制直接跑一遍，用来先验证选择器（标签页要在前台）。

## 参考参数

- 放大倍数：导航和按钮 1.8，卡片 1.75，表单字段 1.6–1.7
- 移动时长：1000–1400ms；拉远 800–1000ms
- 停留（drift）：短的 850ms、长的 1600–1700ms，`push` 0.03–0.07；这比第一版的纯静止停顿短约三成，再短用户会觉得来不及看
- 开头：鼠标出现后 300ms 出字幕，再 600ms 开始第一个动作；结尾拉远后留 700ms
- 字幕：英文短句、一屏一句，底部居中黑色半透明胶囊；切换场景时先出新字幕再动镜头

## 坑

- **下拉框 / Popover 在放大状态下位置算错**（它们按变换后的坐标定位，又渲染进被变换的 body）：先 `zoomOut` 再点开。居中的 Dialog 没这个问题，可以放大时点开、出来后再拉远。
- **点击会触发路由跳转**：`press` 后用 `until` 等新页面的标志性文字出现，再多等 300–400ms。
- **`getBoundingClientRect` 是变换后的屏幕坐标**：一律经 `pt()` / `toPage()` 换算，不要直接拿来当鼠标落点。
- **Chrome 扩展 `javascript_tool` 单次执行 45 秒超时**：剧本由按钮触发、在页面里异步跑，不要在 `javascript_tool` 里 await 整个剧本。
- **页面刷新会丢掉注入**：录制中途不能整页刷新（SPA 内跳转没问题）。
- **输出只有 webm**：要 mp4 需要完整的 ffmpeg；Playwright 自带的 `ffmpeg-mac` 只有 VP8，读不了 VP9，`-c copy` 重封装也会因缺 `vp9_superframe` 失败。

## 量停顿：`scripts/analyze.mjs`

MediaRecorder 的 webm 没有跳转索引，seek 永远拿到第一帧；后台标签页也不解码。所以用无头 Chrome 2 倍速播放、逐帧比较：

```bash
# 依赖 playwright：在 scratchpad 建目录 `bun add playwright`，再把 analyze.mjs 复制进去跑（skill 目录里解析不到依赖）；用本机 Chrome（channel: 'chrome'），不下载浏览器
cd ~/Downloads && python3 -m http.server 8765 --bind 127.0.0.1 &
cp <skill>/scripts/analyze.mjs <scratchpad>/rec/ && cd <scratchpad>/rec && node analyze.mjs /feature-demo.webm 0.5
```

输出「完全静止段 [开始秒，持续秒]」。对照剧本里各段的 `ms` 累加，就能定位是哪一步的停留。用完关掉 http.server。

## 放进 release 页面

上传到 CDN 后，在更新日志正文写 `![说明](https://…/xxx.webm#宽x高)`（宽高取录制的视口 CSS 尺寸，比如 `#1512x771`），页面会渲染成带播放按钮和进度条的视频。
