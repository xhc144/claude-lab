# claude-lab · Claude 实验仓库

这个仓库收集让 Claude 独立完成的实验项目。每个实验是根目录下一个**自成一体**的子目录：自己的 README、依赖、脚本和产物，互不依赖，所有命令都在该子目录里运行。

| 实验 | 类型 | 内容 | 入口 |
| --- | --- | --- | --- |
| [《对称的语言》](symmetry-film/) | 程序化影片 | 约 3 分 40 秒的抽象代数宣传片，画面（skia + numba 着色器）与配乐全部由代码生成；成片已提交 | `cd symmetry-film && bash build.sh preview` |
| [《倒悬之海》The Sea Above](sea-above/) | 程序化影片 | 约 71 秒的三维短片：悬在天上的海洋。GLSL 着色器逐像素渲染，合成器配乐；成片未提交，需从源码生成 | `cd sea-above && ./make_film.sh` |
| [数境 MathScape](mathscape/) | 交互式网页应用 | 矩阵线性变换、复变函数映射、常微分方程轨线、三体运动四个可视化模块；零运行时依赖，带单元测试与端到端测试 | 下载 [`mathscape/dist/mathscape.html`](mathscape/dist/mathscape.html) 双击打开；或 `cd mathscape && npm start` |
| [《0 → ∞》个人网站](personal-site/) | 交互式网站 | xhc144 的个人网站：从 0 维到 ∞ 维的数学 / 物理 / AI 数字空间。三叶结 Milnor 纤维化的 GPU 粒子曲面、相位肖像、薛定谔方程、实时训练的神经网络等 13 台仪器，12 个彩蛋；数据来自公开仓库 | 双击 [`personal-site/dist/index.html`](personal-site/dist/index.html)；或 `cd personal-site && npm start`；整包见 [`release/xhc144-site.zip`](personal-site/release/xhc144-site.zip) |

## 约定

- **一个实验一个目录**：目录名用小写短横线（如 `sea-above`），根目录只放这个索引和通用的 `.gitignore`。
- **每个实验自带 README**：说明是什么、怎么运行、怎么验证；依赖文件（`requirements.txt`、`package.json`）放在实验目录内。
- **产物**：可以重新生成的中间文件（缓存、帧、预览）由各实验的 `.gitignore` 忽略；只有体积合理（GitHub 单文件上限 100 MB）的最终成片才提交。
- **新增实验**：新建子目录，在上表加一行。
