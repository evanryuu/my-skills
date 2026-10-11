# My Skills

我自己维护的 AI Agent skills，收录 skill 说明、脚本和参考示例。

## Skills

| Skill | 用途 |
| --- | --- |
| [demo-video](skills/demo-video/SKILL.md) | 在已登录的 Chrome 标签页录制带鼠标、镜头缩放、点击涟漪和字幕的网页演示视频。 |
| [hand-drawn-illustration](skills/hand-drawn-illustration/SKILL.md) | 黑白手绘笔刷风格的页面插画，包含悬停动画、线条抖动和可复用的 SVG 绘制函数。 |

## 使用

每个 skill 放在 `skills/<skill-name>/`，以 `SKILL.md` 为入口。使用前请阅读对应说明，确认工具和依赖已经安装。

克隆仓库后，可以把需要的 skill 目录复制或链接到工具的 skills 目录，例如 `~/.claude/skills/`、`~/.agents/skills/` 或 `~/.codex/skills/`。工具支持的接口不同，具体要求以每个 skill 的说明为准。

## 维护

新增 skill 时，把 `SKILL.md` 和依赖的 `scripts/`、`references/`、`assets/` 一起放入对应目录，再更新上面的索引。请勿提交凭证、登录状态、私人数据或本次运行生成的文件。
