# 风车里的素数 · Primes in a Windmill

面向清华数学新领军**英语面试**的数学讲解影片：中文版与英文版各一部，主题是**费马平方和定理**，
核心是扎吉尔（Don Zagier）的“一句话证明”和解释这句话的“风车图”。全部画面、配音、字幕和配乐都由本目录的代码生成。

> 一个奇素数 p 能写成两个平方数之和，当且仅当 p 除以 4 余 1。

## 成片与讲稿

| 文件 | 内容 |
| --- | --- |
| [`output/fermat_windmill_zh.mp4`](output/fermat_windmill_zh.mp4) | 中文版，22 分 35 秒，1080p30，53 MB，中文配音 + 中文字幕；面试章节的考官提问为英文原声，附中文翻译 |
| [`output/fermat_windmill_en.mp4`](output/fermat_windmill_en.mp4) | 英文版，26 分 16 秒，1080p30，59 MB，约 140 词/分钟的放慢语速；英文字幕中难词高亮，下方同步显示美式音标与中文释义；模拟面试为考官与考生两种声音的完整问答 |
| `output/fermat_windmill_{zh,en}.srt` / `.ass` | 外挂字幕（SRT 便于播放器加载，ASS 保留样式与音标行） |
| `output/fermat_windmill_{zh,en}_chapters.txt` | 13 个章节的起始时间；MP4 内也写入了章节标记，播放器可直接跳转 |
| [`output/transcript_bilingual.pdf`](output/transcript_bilingual.pdf) | **中英对照讲稿**：选题说明、一分钟/三分钟英文陈述、12 层追问地图、逐段对照、全部问答与答题要点、难词音标表、一页纸证明 |
| `output/transcript_bilingual.md` / `.html` | 同一讲稿的 Markdown 与网页版本 |

## 内容结构

| 章 | 中文 | English | 讲什么 |
| --- | --- | --- | --- |
| 01 | 引子 | Opening | 面试里的“你最喜欢的定理”；5、13、17、29 与 3、7、11、19 |
| 02 | 定理与历史 | Statement and history | 精确陈述、圆上的格点；费马 1640 年圣诞信、欧拉、高斯整数、希思-布朗、扎吉尔 1990 |
| 03 | 容易的方向 | The easy direction | 平方数模 4；奇数平方本身就是一个小风车；21 说明“必要 ≠ 充分” |
| 04 | 奇偶与对合 | Parity and involutions | 用“配对”证明存在；\|S\| ≡ #Fix(f) (mod 2)；与斯潘纳引理同一思想 |
| 05 | 制造对称 | Creating a symmetry | 把 y·y 拆成 y·z，集合 S 与交换对合 g |
| 06 | 风车 | Windmills | x² + 4yz 的风车图；面积 41 的 11 个风车；翻转风叶 = g；方形风叶拼出 p = x² + (2y)² |
| 07 | 扎吉尔的重新切割 | Zagier's re-cutting | 擦掉分割线重切轮廓；叶尖正方形规则；三段式公式；唯一不动点是十字；边界情形；p = 17 的完整配对 |
| 08 | 为什么会想到它 | Why this proof | 四个理由；用 21 检验素数条件用在哪里 |
| 09 | 从存在到算法 | From existence to an algorithm | 从十字出发交替两个对合，41 走 10 步到 5² + 4²；路径与圈；欧几里得算法 |
| 10 | 推广 | Generalizations | 乘法恒等式与复数；一般整数判定；高斯素数；唯一性；x² + 2y²、x² + 3y²、二次互反律、四平方和 |
| 11 | 应用 | Applications | 勾股数与素数斜边；圆内格点与莱布尼茨级数 |
| 12 | 模拟面试 | Mock interview | 12 层追问：开场 → 必要性 → 条件边界 → 证明 → 条件用在哪 → 动机 → 构造性 → 另一种证明 → 细节 → 推广 → 应用 → 反思 |
| 13 | 我的思考 | What I learned | 计数、制造对称、图形；布劳威尔（不动点）× 斯潘纳（奇偶）= 扎吉尔（不动点的奇偶） |

## 可编辑的动画工程

```
script/script.yaml     唯一文本来源：中英旁白（逐段对齐）、面试问答、难词音标表、一分钟/三分钟陈述
tts/synth.py           sherpa-onnx + Kokoro 逐句合成配音，输出 audio/<lang>/*.wav 与句级时间轴
anim/common.py         配色、字体、风车图形类（翻转与重切动画）、按配音时间同步的场景基类
anim/scenes_{a,b,c}.py 13 个 Manim 场景（每章一个类），同一份代码按 FW_LANG=zh|en 生成两种语言
build/render_all.py    并行渲染全部场景（1080p30）
build/assemble.py      拼接场景、放置配音、合成背景音乐、生成 ASS/SRT 字幕并压制成片
build/transcript.py    生成中英对照讲稿（md / html / pdf）
build/preview.py       低清预览单个场景并输出缩略图拼版
```

改文字：编辑 `script/script.yaml`。`[[显示|朗读]]` 标记可以让字幕显示一种写法、配音读另一种
（例如公式 `[[x² + 4yz = p|x 平方加 4 y z 等于 p]]`，或纠正多音字 `[[奇素数|鸡素数]]`）。
改画面：编辑 `anim/scenes_*.py` 里对应章节的类；每段旁白是一个 `with self.seg("段落id"):` 块，
`self.at(k)` 等到该段第 k 句开始。动画比配音长时，后面的配音和字幕会自动顺延，不会错位。

### 环境

- Python 3.11+；`pip install manim sherpa-onnx soundfile scipy numpy pyyaml shapely jieba`
- 系统：FFmpeg（含 libass）、TeX Live（`texlive-latex-extra texlive-science cm-super dvisvgm`）、
  字体 Noto Sans CJK SC、Inter、Charis SIL（音标）
- 语音模型（不入库，放在 `models/` 或用 `FW_MODEL_DIR` 指定）：从
  [sherpa-onnx tts-models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) 下载并解压
  `kokoro-multi-lang-v1_0`（英文：讲述/考生 af_heart，考官 bm_george）与 `kokoro-multi-lang-v1_1`（中文女声 sid 5）

### 生成

```bash
cd fermat-windmill
bash build/make.sh          # 配音 → 渲染 → 成片 → 讲稿（两种语言）
# 或分步：
python tts/synth.py zh en
python build/render_all.py zh --jobs 4 && python build/assemble.py zh
python build/render_all.py en --jobs 4 && python build/assemble.py en
python build/transcript.py
python build/preview.py scenes_b S07_Zagier en   # 单场景低清预览
```

4 核 CPU 上，单个语言版本的 1080p 渲染约 30–45 分钟。

## 质量检查

- 数学：`S(p)`、扎吉尔映射、不动点个数、轮廓重切（逐格栅格化比对，所有 p < 137）与 41 的路径都用脚本验证过。
- 配音：用 SenseVoice 语音识别回听全部句子（英文平均词误差约 7%，主要是数字写法差异）；中文旁白逐词对照分词词典，
  修正了“奇素数（jī）”“数一数（shǔ）”“切割（qiē）”“边长（cháng）”等多音字。
- 英文语速：说话部分约 140 词/分钟，含停顿约 130 词/分钟。
- 音频：响度归一化到约 −16 LUFS（峰值约 −1 dBFS），背景音乐在旁白下自动压低。
- 字幕：烧录字幕带半透明底框；同一时刻不会有两条字幕重叠；英文版难词在字幕中高亮，下方一行显示音标与中文。

语音：Kokoro-82M（Apache-2.0），经 sherpa-onnx（Apache-2.0）运行。
