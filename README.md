# claude-lab · Claude 实验仓库

这是一个什么都可以放的实验仓库：用 Claude 做出来的东西，不论是网页小实验、游戏、产品原型、研究工具、数学影片、排版模板、讲义试卷、技能，还是桌面软件，都放在这里。项目之间互不依赖，每个项目一个目录，保留自己的依赖、构建脚本与 Git 历史；以后有新的点子，再加一个目录就行。

桌面软件只是其中一类。GitHub 侧栏的 Releases 只是那几个软件的安装包，不代表整个仓库。

**公开入口：[项目导航](https://xhc144.github.io/claude-lab/)**

站点已公开上线，GitHub Pages 从 `main` 分支的 `/docs` 发布。主页按「浏览器交互 / AI 与产品原型 / 桌面软件 / 影片 / 写作与工具」五类收录仓库中的 26 个项目，支持关键词搜索、分类筛选、深浅色主题与手机浏览；十部影片都有带版本切换、章节跳转和下载链接的在线播放器。

## 浏览器交互项目

| 项目 | 用途 | 在线入口 | 源码与本地运行 |
| --- | --- | --- | --- |
| 数境 MathScape | 矩阵、复映射、常微分方程与三体运动可视化 | [打开](https://xhc144.github.io/claude-lab/mathscape/) | [mathscape/](mathscape/)；`npm start`；`npm run build` 生成单文件 |
| 数学知识星图 Math Starmap | 以 2027 新领军考纲为纲的知识图谱：706 颗知识星、1452 条前置/推导/推广/等价/应用关系，可无限展开的星链、学习路径、精选航线、拼音搜索与 37 个交互动画 | [打开](https://xhc144.github.io/claude-lab/math-starmap/) | [math-starmap/](math-starmap/)；`npm start`；`npm test`；知识库在 `content/*.md` |
| 万象 Myriad | 地形、气候、生态和文明演化的创世沙盒 | [打开](https://xhc144.github.io/claude-lab/myriad/) | [myriad/](myriad/)；`npm start`；`npm run build` 生成单文件；桌面操作最佳 |
| 薪火纪 Emberstack | 卡牌堆叠文明策略游戏：采集、合成、科技、探索、战斗，7 章 28 关与远征/无尽/挑战模式，可完全托管给自主 AI 玩家 | [打开](https://xhc144.github.io/claude-lab/emberstack/) | [emberstack/](emberstack/)；`npm start`；`npm run build` 生成单文件；提供桌面与触屏操作 |
| 回响荒野 Echowild | 程序化体素世界、建造与生存冒险 | [打开](https://xhc144.github.io/claude-lab/echowild/) | [echowild/](echowild/)；`node scripts/serve.mjs`；需要桌面键鼠与 WebGL2，暂不支持触屏游玩 |
| 0 → ∞ 交互实验室 | 从复平面到纽结、双摆、量子波包与神经网络的 13 台仪器 | [打开](https://xhc144.github.io/claude-lab/personal-site/) | [personal-site/](personal-site/)；`npm ci && npm run build && npm start`；发布一般作品展示版本 |

MathScape、Myriad 与 Emberstack 的 `dist/*.html` 可下载后离线打开。Echowild 的 ES modules 与 Worker 需要 HTTP(S) 服务。Echowild 新增 [离线单文件版](https://xhc144.github.io/claude-lab/echowild/echowild.html)，可保存为 HTML 后打开。Tensora 与 Emberstack 的在线字体来自 Google Fonts，离线时使用系统字体回退。沙盒存档保存在访客自己的浏览器中；浏览器清理数据前请导出存档。

## 产品界面原型

[星枢 Tensora](tensora/) 是 API 中转网关、模型训练平台与 GPU 算力控制台一体化的 AI 基础设施管理平台前端，共 10 个页面：总览仪表盘、模型广场、API 密钥、调用统计、Token 消耗、模型训练、训练任务、GPU 集群、费用分析与设置。数据每秒实时模拟，模型、厂商与账单均为虚构，不连接后端。[在线打开](https://xhc144.github.io/claude-lab/tensora/)；源码目录内 `npm start` 本地运行，`npm run build` 生成可离线打开的 `dist/tensora.html`，桌面与手机均可使用。

## 多智能体研究实验室

[论衡 Lunheng](lunheng/) 是一个学术研究实验室。5–10 个来自不同厂商的 AI 模型组成研究团队，围绕数学、物理、计算机科学命题独立推导、交叉质询、寻找反例并独立核验。断言是否成立由证明、核验和反例按固定规则判定，不看多数票；报告分开列出已证明结论、猜想和未解决问题。

它接入 OpenAI、Claude、Gemini、DeepSeek、通义千问、Kimi、智谱、豆包、Grok、Ollama，以及 OpenAI / Anthropic / Gemini 兼容的中转。模型由 Node.js 服务端调用，API Key 加密保存在服务器上，所以论衡需要本地或自托管运行，不会发布到 Pages：在 `lunheng/` 目录运行 `npm ci && npm start`，然后打开 `http://127.0.0.1:8848`。详见[项目 README](lunheng/README.md)。

## Windows 桌面软件

| 软件 | 用途 | 发布标签 |
| --- | --- | --- |
| [律影 Motif](motif/) | 动态视觉创作：导入 PPT/Word/Excel/PDF 素材，做动画并导出视频、HTML 演示或 PDF，AI 可通过 Skill、CLI 或 MCP 参与；附录屏与剪辑 | `motif-v*` |
| [音乐粒子宇宙 Particle Universe](particle-universe/) | 导入本地音乐，分析节拍与段落，驱动百万级 GPU 粒子场景，可导出 MP4 / WebM | `particle-universe-v*` |
| [声准 Phonica](phonica/) | 英语口语训练与本机发音评测（音素级对齐与 GOP 评分） | `phonica-v*` |
| [墨誊 Moteng](moteng/) | 把保存的 AI 对话网页、Markdown 或导出记录转成 LaTeX、PDF 与 HTML，可选[墨经](mojing/)讲义版式 | `moteng-v*` |
| [鸿雁邮箱 Hongyan Mail](hongyan-mail/) | 本地多账户邮件客户端（IMAP / SMTP、SQLite） | `hongyan-mail-v*` |

仓库只保存源码；安装包不提交到仓库，也不发布到 Pages，而是由「Ship · 自动合并与发布」流水线在 Windows 上构建、测试、签名后发布到 Releases，已安装的软件会自动更新。流程与版本号规则见 [scripts/windows-release/](scripts/windows-release/README.md)，各软件的功能与本地构建见各自目录的 README。

鸿雁邮箱早先提交在分支里的历史安装包曾被 Defender 报告 `Trojan:Win32/Sabsik.FL.A!ml`（未签名 Electron 程序常见的机器学习误报类型，真伪未确认），它仍然隔离、不提供下载，详见[隔离记录](hongyan-mail/QUARANTINE.md)。

## 数学排版模板

[墨经 Mojing：PDF 预览与 ZIP 下载](https://xhc144.github.io/claude-lab/mojing/) 提供讲义、习题与解答、竞赛试卷、数学论文、数学书籍、翻译对照六套 LaTeX 模板。十份示例 PDF 包含学生版、答案版与双栏对照等变体；六个 ZIP 各自包含完整源码和 ASCII 文件名的 `README.txt`。

源码位于 [mojing/](mojing/)。网页提供预先编译的 PDF；下载后的编辑和编译在本地或 Overleaf 进行。需要完整的 TeX Live 2023+、XeLaTeX、ctex、latexmk 等依赖，详见项目 README。各套模板独立使用，其他项目的默认排版配置保持原样。

## 程序化影片

| 项目 | 内容 | 在线观看 | 制作源码 |
| --- | --- | --- | --- |
| 《对称的语言》 | 约 3 分 40 秒的抽象代数主题影片 | [播放器](https://xhc144.github.io/claude-lab/films/symmetry-film/) | [symmetry-film/](symmetry-film/)；Python、Skia、Numba、FFmpeg；`bash build.sh preview` |
| 《倒悬之海》The Sea Above | 约 71 秒的三维短片 | [播放器](https://xhc144.github.io/claude-lab/films/sea-above/) | [sea-above/](sea-above/)；Python、OpenGL/EGL、FFmpeg；`./make_film.sh` |
| 《费马平方和定理：一句话的证明，一架风车》 | 清华新领军英语面试用的数学讲解，中文版（约 20 分钟）与英文版（约 25 分钟，旁白 / 考官 / 考生三个声音），通义千问语音合成配音，含模拟面试、难词音标、中英对照讲稿 | [播放器](https://xhc144.github.io/claude-lab/films/windmill-theorem/) | [windmill-theorem/](windmill-theorem/)；Manim、TeX、Qwen TTS、FFmpeg；`TTS=qwen bash build.sh` |
| 《风车里的素数》Primes in a Windmill | 费马平方和定理与扎吉尔一句话证明的 MG 数学讲解，面向新领军英语面试；中文版、英文版各一部，附中英对照讲稿 | [播放器](https://xhc144.github.io/claude-lab/films/fermat-windmill/)（含中英对照讲稿） | [fermat-windmill/](fermat-windmill/)；Manim、sherpa-onnx（Kokoro 语音）、FFmpeg；`bash build/make.sh` |
| 《总有一点不动》The Point That Stays | 约 5 分钟的布劳威尔不动点定理讲解动画，中英双语配音与字幕，附英语面试问答稿 | [播放器](https://xhc144.github.io/claude-lab/films/fixed-point-film/) | [fixed-point-film/](fixed-point-film/)；Canvas、MathJax、Playwright、Kokoro TTS、FFmpeg；`bash build.sh` |
| 《最优化的本质》 | 约 19 分钟的中文数学讲解视频：不等式与极值、凸优化、梯度下降、线性规划，带配音与字幕 | [播放器](https://xhc144.github.io/claude-lab/films/optimization-film/) | [optimization-film/](optimization-film/)；Manim、离线中文语音合成、FFmpeg；`python tools/build.py` |
| 《差了 3.3 分，算不算数》 | 约 14 分钟的双样本检验教学视频，中文配音与字幕 | [播放器](https://xhc144.github.io/claude-lab/films/two-sample-test-video/) | [two-sample-test-video/](two-sample-test-video/)；Manim、sherpa-onnx、FFmpeg；`bash build.sh` |
| 《线性回归：从一条直线，到一次投影》 | 约 12 分钟的中文讲解视频：残差平方和、两个偏导条件、正交投影与正规方程、R²、“线性”与“回归”的含义；通义千问语音合成配音 | [播放器](https://xhc144.github.io/claude-lab/films/linear-regression-video/) | [linear-regression-video/](linear-regression-video/)；Manim、Qwen TTS、FFmpeg；`bash build.sh` |
| 《统计的符号与术语》 | 约 36 分钟的中文讲解视频：统计里的符号与专有名词怎么读、是什么意思、为什么这样写——总体与样本、描述统计、概率、随机变量、常见分布、抽样分布、估计、检验、回归，最后是一字多义的记号和常见缩写；通义千问语音合成配音 | [播放器](https://xhc144.github.io/claude-lab/films/stats-notation-video/) | [stats-notation-video/](stats-notation-video/)；Manim、Qwen TTS、FFmpeg；`bash build.sh` |
| 《贝叶斯统计：让证据改变判断》 | 约 12 分钟的中文讲解视频，深色霓虹画面：阳性化验单与一千个人、贝叶斯公式的来历、后验变先验、命中率一球一球地更新、先验随数据收拢、可信区间与置信区间、MCMC 抽样；通义千问语音合成配音，语音识别回听核对 | [播放器](https://xhc144.github.io/claude-lab/films/bayes-video/) | [bayes-video/](bayes-video/)；Manim、Qwen TTS、FFmpeg；`bash build.sh` |

站点播放器使用已经生成的 H.264/AAC 成片（与仓库内 `output/` 中的文件相同），不在浏览器执行 Python 渲染；影片制作脚本需要本地依赖与计算资源。双语影片可在播放器里切换中文版 / 英文版，带章节标记的影片可点击章节跳转，字幕 SRT 与讲稿可直接下载。《一架风车》（windmill-theorem）与《风车里的素数》（fermat-windmill）是同一主题的两个独立版本，均保留。

## 视频讲解稿

[video-scripts/](video-scripts/) 收录数学专题的视频讲解稿。目前有《最优化》一份：6 集，覆盖不等式与极值问题、凸优化、梯度下降法和线性规划，附带核对全部数值例子的 Python 脚本。稿件只在仓库中维护，不发布到 Pages。

## 考试预测训练卷

[xinlingjun-mock-2027/](xinlingjun-mock-2027/) 是 2027 清华新领军的预测训练卷（非官方），共 12 份：一试数学 1、数学 2、物理；二试语文、英语与综合六科（物理加强、化学、生物、计算机、经济、社科）；三试现学现考。每份都有题面 PDF 和带评分标准的答案 PDF，另附设计说明、独立审核记录，以及配合经济、社科两卷的速成讲义。源码用墨经试卷模板，`latex/build.sh` 一键编译。

## Claude 技能

[.claude/skills/](.claude/skills/) 收录六个数学教学相关的 Claude Code 技能：数学讲义写作（math-lecture-writing）、题目难度评估（assess-math-difficulty）、数学 LaTeX 排版（math-latex-typesetting）、墨经模板排版（mojing-latex）、概念讲解（explain-concepts-clearly）与新领军面试专家（xinlingjun-exam-expert）。在本仓库打开 Claude Code 时自动可用。

## 构建公开站点

```sh
# 在仓库根目录运行；先按各项目README准备构建依赖
node scripts/build-pages.mjs
python3 -m http.server 8080 --directory docs
```

`site/projects.mjs` 是站点上所有项目的唯一数据源（分类、简介、标签、搜索关键词、访问链接、影片版本）；`site/site.css`、`site/site.js` 是共享样式与交互，`site/covers/` 是项目封面，`site/film-meta.json` 缓存 ffprobe 读出的影片时长与章节。新增或修改项目时只改这些文件，然后运行：

```sh
node scripts/build-site.mjs   # 只重新生成主页、影片播放器、封面与墨经页面，不需要各项目的构建依赖
```

`build-pages.mjs` 先重新生成 MathScape、Myriad、交互实验室、薪火纪 Emberstack、星枢 Tensora 与数学知识星图的静态文件，再调用 `build-site.mjs`，最后运行检查；只把白名单产物写入 `docs/`。GitHub Pages 发布 `main` 分支的 `/docs`，由「Pages · 部署」工作流（`.github/workflows/pages.yml`）部署：`main` 上 `docs/` 有改动、Ship 合并分支后都会自动运行，也可以在 Actions 里手动运行；发布来源（Settings → Pages → Source）建议选 GitHub Actions。部署与验证证据详见整合记录。Echowild 复制 HTML/CSS/源码和重新构建的单文件版；墨经只复制展示页、十份 PDF、预览图与六个 ZIP；影片只复制成片、字幕、讲稿与播放器（成片与仓库内文件内容相同，Git 中不额外占用空间）。绝不把整个仓库作为发布目录。

`node scripts/check-pages.mjs` 检查静态链接、资源与发布边界；部署后还需浏览器验证主要交互和影片播放。测试与部署证据、分支原 tip 与恢复方式见 [整合记录](docs/INTEGRATION.md)。

## 目录约定

- 一个实验一个目录，依赖与命令在该项目目录内执行。
- 生成缓存、用户数据和凭据不提交；发布只复制明确列出的静态产物。
- 原项目分支通过合并提交保留；删除前必须确认原 tip 可从 `main` 到达。恢复 SHA 写入整合记录，不强推或清除历史对象。
