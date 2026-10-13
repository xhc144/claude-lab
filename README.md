# claude-lab · Claude 实验仓库

这个仓库收集让 Claude 独立完成的实验项目。每个实验是根目录下一个**自成一体**的子目录：自己的 README、依赖、脚本和产物，互不依赖，所有命令都在该子目录里运行。

| 实验 | 类型 | 内容 | 入口 |
| --- | --- | --- | --- |
| [《对称的语言》](symmetry-film/) | 程序化影片 | 约 3 分 40 秒的抽象代数宣传片，画面（skia + numba 着色器）与配乐全部由代码生成；成片已提交 | `cd symmetry-film && bash build.sh preview` |
| [《倒悬之海》The Sea Above](sea-above/) | 程序化影片 | 约 71 秒的三维短片：悬在天上的海洋。GLSL 着色器逐像素渲染，合成器配乐；成片未提交，需从源码生成 | `cd sea-above && ./make_film.sh` |
| [数境 MathScape](mathscape/) | 交互式网页应用 | 矩阵线性变换、复变函数映射、常微分方程轨线、三体运动四个可视化模块；零运行时依赖，带单元测试与端到端测试 | 下载 [`mathscape/dist/mathscape.html`](mathscape/dist/mathscape.html) 双击打开；或 `cd mathscape && npm start` |
| [回响荒野 Echowild](echowild/) | 三维开放世界游戏 | 原创体素沙盒：16 种群系、地下世界与浮空群岛，生存与合成、16 种生物、共鸣电路与自动化机械、五座神殿的碎片主线；WebGL2 + Web Worker，零运行时依赖，带单元测试与端到端测试 | 下载 [`echowild/dist/echowild.html`](echowild/dist/echowild.html) 双击打开；或 `cd echowild && npm start` |

## 约定

- **一个实验一个目录**：目录名用小写短横线（如 `sea-above`），根目录只放这个索引和通用的 `.gitignore`。
- **每个实验自带 README**：说明是什么、怎么运行、怎么验证；依赖文件（`requirements.txt`、`package.json`）放在实验目录内。
- **产物**：可以重新生成的中间文件（缓存、帧、预览）由各实验的 `.gitignore` 忽略；只有体积合理（GitHub 单文件上限 100 MB）的最终成片才提交。
- **新增实验**：新建子目录，在上表加一行。
