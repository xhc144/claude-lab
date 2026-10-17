# claude-lab · Claude 实验仓库

这是多个独立实验的合集：交互数学、创世沙盒、卡牌策略游戏、三维游戏、AI 基础设施控制台原型、多智能体研究实验室、Windows 桌面软件、数学讲解影片与 Claude 数学技能。每个项目保留自己的目录、依赖、构建脚本与 Git 历史。

**公开入口：[项目导航](https://xhc144.github.io/claude-lab/)**

站点已公开上线，GitHub Pages 从 `main` 分支的 `/docs` 发布。主页按「浏览器交互 / AI 与产品原型 / 桌面软件 / 影片 / 写作与工具」五类收录仓库中的 25 个项目，支持关键词搜索、分类筛选、深浅色主题与手机浏览；九部影片都有带版本切换、章节跳转和下载链接的在线播放器。

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

仓库只保存源码；安装包不提交到仓库，也不发布到 Pages。五个 Windows 软件（Motif、音乐粒子宇宙、声准、墨誊、鸿雁邮箱）由「Ship · 自动合并与发布」流水线统一处理：AI 推送到 `claude/**` 分支后，在 Windows 上构建、测试并用仓库证书签名，通过后自动合并进 `main`，只发布有改动的软件（Releases 标签 `<软件>-v<版本>`），已安装的软件随后自动更新。流程、版本号规则、手动发布方式见 [scripts/windows-release/](scripts/windows-release/README.md)。

[律影 Motif](motif/) 是一个可安装的 Windows 动态视觉创作软件。人可以在可视化编辑器中导入 PPT/Word/Excel/PDF 等素材，编辑、选择风格、做动画、预览并导出视频、HTML 交互演示或 PDF；Claude、DeepSeek、Qwen、Codex 等模型可以通过 Skill、CLI 或 MCP 创建和修改同一批作品。软件内置 10 套设计系统、38 种内容组件和确定性渲染引擎，AI 只需提供内容与数据；还能录屏（自动运镜、平滑光标与点击特效、背景美化、摄像头画中画）并在录屏编辑器里剪辑导出。安装包由 GitHub Actions 的「Motif · Windows build」构建。

[音乐粒子宇宙 Particle Universe](particle-universe/) 是 Electron / WebGL2 的 Windows 音乐可视化程序：导入本地音乐后，离线分析频谱、鼓点、节拍网格、段落与高潮，驱动 13 万–419 万颗 GPU 粒子组成的 8 个场景（星云、黑洞、银河、能量风暴、流体丝绸、共振星球、超空间、奇异吸引子），带自动运镜、自适应画质与逐帧离线的 MP4 / WebM 视频导出。Windows 安装版与便携版 zip（约 129 MB，超过仓库单文件上限）由 `particle-universe · Windows build` 工作流构建并自检；本地可用 `npm run dist:win` 生成。

[声准 Phonica](phonica/) 是 Windows 英语口语训练与发音评测软件（Electron + onnxruntime）：本机完成音素级强制对齐与 GOP 评测，评分模型在 speechocean762 上校准；离线标准发音（英音 / 美音）、历史进步对比、薄弱音素专项练习；可选接入 OpenAI / Claude / DeepSeek 等 AI，或一键导出高压缩 MP3 + 完整评测 JSON + 提示词的 ZIP。安装包由 GitHub Actions 在 Windows 上构建并自检后发布在 Releases（`phonica-v*`）。

五个软件的安装版都会自动更新：每次发布都会刷新 `<软件>-latest` 发布里的更新信息，已安装的软件后台下载、核对校验码与签名后，在重启或关闭时安装（便携版 zip 不自动更新）。安装包与程序都用仓库 Secrets 里的证书签名；没有导入这张自签名证书的电脑也能自动更新，因为软件会确认新版本与自己出自同一张证书。

[墨誊 Moteng](moteng/) 是 Windows 上的 AI 对话转 LaTeX 软件（Electron）：把浏览器保存的 ChatGPT、Claude、Gemini、DeepSeek、Grok、Copilot、Kimi、豆包、通义千问、腾讯元宝等对话网页（.html / .mhtml / .zip，或直接从剪贴板粘贴），以及 Markdown 记录和 ChatGPT / Claude 导出的 conversations.json，转换成 `main.tex`、PDF 和可交互的 HTML。可以单选、多选文件或选整个文件夹；即时预览里点击公式可在行内与行间之间切换，标题、图片、分页都能单独调整，右侧面板设置纸张、页边距、字体、行距、标题与公式编号，PDF 标签页随改动自动重新编译。ChatGPT 回答里的图表、示意图和滑块组件按保存时的画面截取放进 PDF（示意图保留为矢量图）。公式取自网页里保存的 TeX 源码；表格、高亮代码、列表和图片一并转换。版式可选对话体或[墨经](mojing/)讲义体。编译出错时，按行号找到出错的那一处，只把它改为源码显示，其余内容照常排版。安装包内置 Tectonic 排版引擎和离线 TeX 缓存，也可以改用本机的 TeX Live / MiKTeX。安装包由「moteng · Windows build」工作流构建并自检，发布标签为 `moteng-v*`。

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
| 《统计的符号与术语》 | 约 RUNTIME 分钟的中文讲解视频：统计里的符号与专有名词怎么读、是什么意思、为什么这样写——总体与样本、描述统计、概率、随机变量、常见分布、抽样分布、估计、检验、回归，最后是一字多义的记号和常见缩写；通义千问语音合成配音 | [播放器](https://xhc144.github.io/claude-lab/films/stats-notation-video/) | [stats-notation-video/](stats-notation-video/)；Manim、Qwen TTS、FFmpeg；`bash build.sh` |

站点播放器使用已经生成的 H.264/AAC 成片（与仓库内 `output/` 中的文件相同），不在浏览器执行 Python 渲染；影片制作脚本需要本地依赖与计算资源。双语影片可在播放器里切换中文版 / 英文版，带章节标记的影片可点击章节跳转，字幕 SRT 与讲稿可直接下载。《一架风车》（windmill-theorem）与《风车里的素数》（fermat-windmill）是同一主题的两个独立版本，均保留。

## 视频讲解稿

[video-scripts/](video-scripts/) 收录数学专题的视频讲解稿。目前有《最优化》一份：6 集，覆盖不等式与极值问题、凸优化、梯度下降法和线性规划，附带核对全部数值例子的 Python 脚本。稿件只在仓库中维护，不发布到 Pages。

## Claude 技能

[.claude/skills/](.claude/skills/) 收录六个数学教学相关的 Claude Code 技能：数学讲义写作（math-lecture-writing）、题目难度评估（assess-math-difficulty）、数学 LaTeX 排版（math-latex-typesetting）、墨经模板排版（mojing-latex）、概念讲解（explain-concepts-clearly）与新领军面试专家（xinlingjun-exam-expert）。在本仓库打开 Claude Code 时自动可用。

## 鸿雁邮箱与隔离记录

[鸿雁邮箱 Hongyan Mail](hongyan-mail/) 是 Electron / Node.js 的本地多账户邮件客户端，需要本地程序、SQLite 与 IMAP / SMTP，无法在 Pages 上运行。

早先提交在分支里的历史安装包曾被 Defender 报告 `Trojan:Win32/Sabsik.FL.A!ml`（未签名 Electron 程序常见的机器学习误报类型，真伪未确认），它仍然隔离、不提供下载，详情见 [隔离记录](hongyan-mail/QUARANTINE.md)。现在的安装包改由「hongyan-mail · Windows build」从源码在 GitHub Actions 上重新构建、测试并签名，与其他软件一样通过流水线发布（`hongyan-mail-v*`）。源码审查发现的本地凭据/缓存存储限制仍然有效，详见项目 README。Pages 不包含邮件界面、测试截图、安装包或用户邮件数据。

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

`build-pages.mjs` 先重新生成 MathScape、Myriad、交互实验室、薪火纪 Emberstack、星枢 Tensora 与数学知识星图的静态文件，再调用 `build-site.mjs`，最后运行检查；只把白名单产物写入 `docs/`。GitHub Pages 使用 `main` 分支的 `/docs`；部署与验证证据详见整合记录。Echowild 复制 HTML/CSS/源码和重新构建的单文件版；墨经只复制展示页、十份 PDF、预览图与六个 ZIP；影片只复制成片、字幕、讲稿与播放器（成片与仓库内文件内容相同，Git 中不额外占用空间）。绝不把整个仓库作为发布目录。

`node scripts/check-pages.mjs` 检查静态链接、资源与发布边界；部署后还需浏览器验证主要交互和影片播放。测试与部署证据、分支原 tip 与恢复方式见 [整合记录](docs/INTEGRATION.md)。

## 目录约定

- 一个实验一个目录，依赖与命令在该项目目录内执行。
- 生成缓存、用户数据和凭据不提交；发布只复制明确列出的静态产物。
- 原项目分支通过合并提交保留；删除前必须确认原 tip 可从 `main` 到达。恢复 SHA 写入整合记录，不强推或清除历史对象。
