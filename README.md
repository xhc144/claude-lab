# claude-lab · Claude 实验仓库

这是多个独立实验的合集：交互数学、创世沙盒、三维游戏与程序化影片。每个项目保留自己的目录、依赖、构建脚本与 Git 历史。

**公开入口：[项目导航](https://xhc144.github.io/claude-lab/)**

## 浏览器交互项目

| 项目 | 用途 | 在线入口 | 源码与本地运行 |
| --- | --- | --- | --- |
| 数境 MathScape | 矩阵、复映射、常微分方程与三体运动可视化 | [打开](https://xhc144.github.io/claude-lab/mathscape/) | [mathscape/](mathscape/)；`npm start`；`npm run build` 生成单文件 |
| 万象 Myriad | 地形、气候、生态和文明演化的创世沙盒 | [打开](https://xhc144.github.io/claude-lab/myriad/) | [myriad/](myriad/)；`npm start`；`npm run build` 生成单文件；桌面操作最佳 |
| 回响荒野 Echowild | 程序化体素世界、建造与生存冒险 | [打开](https://xhc144.github.io/claude-lab/echowild/) | [echowild/](echowild/)；`node scripts/serve.mjs`；需要桌面键鼠与 WebGL2，暂不支持触屏游玩 |
| 0 → ∞ 交互实验室 | 从复平面到纽结、双摆、量子波包与神经网络的 13 台仪器 | [打开](https://xhc144.github.io/claude-lab/personal-site/) | [personal-site/](personal-site/)；`npm ci && npm run build && npm start`；发布一般作品展示版本 |

MathScape 与 Myriad 的 `dist/*.html` 可下载后离线打开。Echowild 的 ES modules 与 Worker 需要 HTTP(S) 服务。沙盒存档保存在访客自己的浏览器中；浏览器清理数据前请导出存档。

## 程序化影片

| 项目 | 内容 | 在线观看 | 制作源码 |
| --- | --- | --- | --- |
| 《对称的语言》 | 约 3 分 40 秒的抽象代数主题影片 | [播放器](https://xhc144.github.io/claude-lab/films/symmetry-film/) | [symmetry-film/](symmetry-film/)；Python、Skia、Numba、FFmpeg；`bash build.sh preview` |
| 《倒悬之海》The Sea Above | 约 71 秒的三维短片 | [播放器](https://xhc144.github.io/claude-lab/films/sea-above/) | [sea-above/](sea-above/)；Python、OpenGL/EGL、FFmpeg；`./make_film.sh` |

Pages 播放已经生成的 H.264/AAC 成片；影片制作脚本需要本地依赖与计算资源。两个播放器都使用原生成片，不在浏览器执行 Python 渲染。

## 桌面项目与隔离内容

[鸿雁邮箱 Hongyan Mail](hongyan-mail/) 是 Electron / Node.js 的本地多账户邮件客户端，需要本地程序、SQLite 与 IMAP / SMTP，无法在 Pages 上运行。

用户报告历史安装包被 Defender 检出 `Trojan:Win32/Sabsik.FL.A!ml`，真伪未确认。当前主树移除安装包、保留源码与合并历史；没有运行安装包或关闭防护。详情见 [隔离记录](hongyan-mail/QUARANTINE.md)。源码审查也发现本地凭据/缓存存储限制，详见项目 README。Pages 不包含邮件界面、测试截图、安装包或用户邮件数据。

## 构建公开站点

```sh
# 在仓库根目录运行；先按各项目README准备构建依赖
node scripts/build-pages.mjs
python3 -m http.server 8080 --directory docs
```

`site/` 保存导航模板；构建脚本重新生成 MathScape、Myriad、交互实验室的静态文件，并将白名单产物写入 `docs/`。GitHub Pages 使用 `main` 分支的 `/docs`。Echowild 只复制 HTML/CSS/源码；两个影片只复制成片与播放器。绝不把整个仓库作为发布目录。

`node scripts/check-pages.mjs` 检查静态链接、资源与发布边界；部署后还需浏览器验证主要交互和影片播放。测试与部署证据、分支原 tip 与恢复方式见 [整合记录](docs/INTEGRATION.md)。

## 目录约定

- 一个实验一个目录，依赖与命令在该项目目录内执行。
- 生成缓存、用户数据和凭据不提交；发布只复制明确列出的静态产物。
- 原项目分支通过合并提交保留；删除前必须确认原 tip 可从 `main` 到达。恢复 SHA 写入整合记录，不强推或清除历史对象。
