# 差了 3.3 分，算不算数——双样本检验

一支讲双样本检验的教学视频：Z、合并方差 t、F、Welch、配对 t、两比例 Z，每个检验从哪来、为什么这么算。全部画面、配音、铺底音乐和字幕都由本目录的代码生成。

| 文件 | 内容 |
| --- | --- |
| [`output/two-sample-test.mp4`](output/two-sample-test.mp4) | 成片，14 分 07 秒，1920×1080，30 fps，中文配音，字幕压在画面里，带 8 个章节，约 34 MB |
| [`output/two-sample-test.srt`](output/two-sample-test.srt) | 单独的字幕文件 |
| [`script.md`](script.md) | 分镜脚本：问题链、考纲对照、视觉约定、逐镜头画面与旁白、数字核对 |

## 章节

| 段落 | 内容 |
| --- | --- |
| 开场 | 两个班差 3.3 分；把分数混在一起随手分组，差照样会冒出来；所有检验都是“看到的差 ÷ 平常抖多大” |
| 相减，抖得更厉害 | 两个独立平均分的差抖得更凶；Var(X̄−Ȳ) = σ₁²/n₁ + σ₂²/n₂；Z = 1.48，p ≈ 0.14 |
| σ 不知道的时候 | 合并方差按自由度加权；自由度为什么是 n₁+n₂−2；分母也在抖，所以尾巴更厚；σ 在分子分母里约掉，所以能查 t 表 |
| 方差能不能合并 | 比较方差要用比值，F = S₁²/S₂² = 0.79 |
| 两个方差不一样 | Behrens–Fisher 问题与 Welch 近似（拓展） |
| 同一个人，考两次 | 协方差项回来了：配对把噪声从 5.15 压到 0.64，T = 4.53 |
| 数人头 | 两比例检验：原假设下合并估计 p̂ = 52.5%，Z = 2.24（拓展） |
| 一棵树 | 六个检验放进一棵决策树 |

## 制作方式

- **动画**：[Manim Community](https://www.manim.community/) 0.22，LaTeX 公式用 xelatex + xeCJK 排中文。每个段落是 `src/` 下的一个场景类。
- **配音**：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 运行 Kokoro v1.1 中文模型（第 20 号音色），离线合成。`src/narration.py` 是逐句配音稿；多音字（方差的“差”、“晃”“得”“数”“量”等）在 `src/tts.py` 和配音稿里做了修正，并用 SenseVoice 识别回文字逐句核对。
- **对时**：场景里每句旁白写成 `with self.say("键") as d:`，动画时长按配音时长安排，句子念完才进入下一步；渲染时记录每句在场景里的起点，合成时据此放置配音和字幕。
- **声音**：配音之外有一层很轻的铺底和弦，说话时自动压低，停顿提问时完全静音；整片两遍 loudnorm 到 −16 LUFS。
- **数据**：`src/data.py` 用固定种子生成两班各 40 个整数分数，均值恰好是 78.4 和 75.1，标准差四舍五入后是 9.6 和 10.8；开场洗牌的四次差值恰好是 0.8、2.1、1.3、3.6。

## 重新生成

在 Ubuntu 24.04 上：

```bash
cd two-sample-test-video
bash build.sh                 # 安装依赖、下载语音模型（约 370 MB）、合成配音、渲染、合成成片
JOBS=4 bash build.sh          # 4 个场景并行渲染
CHECK_VOICE=1 bash build.sh   # 额外下载识别模型，逐句核对配音
```

4 核机器上并行渲染约 1 小时。只改了某一段时，可以单独渲染再合成：

```bash
cd src
PYTHON=../.venv/bin/python ./render.sh s07_paired.py Paired hd
../.venv/bin/python assemble.py hd
```

改了旁白文字后先跑 `python tts.py`，只有文字变了的句子会重新合成。
