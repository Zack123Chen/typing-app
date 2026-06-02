# The Typewriter · 复古打字机风格打字练习

一个用 React + TypeScript + Vite 写的英文打字练习工具，视觉是 1950 年代铸铁打字机：奶油色纸张、压纸滚筒、八指着色的圆形键帽、机械敲击与回车铃声。

线上地址 → **https://zack123chen.github.io/typing-app/**

## 功能

- **三种文本来源**：随机高频词 / 内置名人名言 / 自定义上传或粘贴（`.txt` / `.md`）
- **实时指标**：WPM、准确率、剩余秒数、字符级正确/错误统计
- **结束报告**：WPM 时序曲线（recharts）+ 收据样式成绩单
- **打字机机械音效**：白噪声 + 膜片合成（Tone.js），按行翻页触发回车铃，可关闭
- **下一键高亮**：圆形键盘上下一个待按键发亮，`f` / `j` 标定位条
- **八指配色**：键帽外圈按手指分色，提示触键手位
- **动态限时**：根据文本长度自动在 30–300 秒之间计算

## 快捷键

| 键 | 作用 |
| -- | ---- |
| 任意可见字符 | 输入并开始计时 |
| `Backspace` | 删除上一字符 |
| `Tab` | 重新开始 |
| `Enter`（结束页） | 再来一次 |

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物
```

要求 Node.js ≥ 22。

## 部署

推送到 `main` 分支会触发 `.github/workflows/deploy.yml`，由 GitHub Actions 构建并发布到 GitHub Pages。

如果 fork 到自己的仓库，记得：

1. 修改 `vite.config.ts` 的 `base` 为 `/<你的仓库名>/`
2. 在仓库 Settings → Pages 中将 Source 设为 **GitHub Actions**

## 技术栈

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4（`@tailwindcss/vite`）
- recharts（WPM 曲线）
- Tone.js（键击音效）

## License

MIT
