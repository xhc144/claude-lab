# 线性回归：从一条直线，到一次投影

一支讲线性回归的中文教学视频：最小二乘为什么取平方、两个偏导条件从哪来、为什么它其实是一次正交投影、R² 的几何意义、“线性”指什么、“回归”这个名字从哪来。画面、字幕、铺底音乐全部由本目录的代码生成；配音用阿里云百炼的通义千问语音合成（模型 `qwen-audio-3.0-tts-plus`，音色龙安灵心）。

成片：[`output/linear-regression.mp4`](output/linear-regression.mp4)（11 分 49 秒，1080p30，H.264 + AAC，约 27 MB，带章节，中文配音，字幕压在画面里），字幕另附 [`output/linear-regression.srt`](output/linear-regression.srt)。

讲法沿用仓库里 [`explain-concepts-clearly`](../.claude/skills/explain-concepts-clearly/SKILL.md) 和 [`math-lecture-writing`](../.claude/skills/math-lecture-writing/SKILL.md) 两个技能的要求：先说清对象（残差、残差平方和、拟合值向量），再从定义推出关键公式（两个偏导条件 → 斜率公式 → 正规方程），分清对象与表示（拟合值 ŷ 是平面上的点，a、b 只是它在一组基下的坐标），历史只保留能解释定义的转折，并标出关联不等于因果、平方对离群点敏感这两条边界。

## 章节

| 段落 | 场景类 | 内容 |
| --- | --- | --- |
| 开场 | `Opening` | 十个同学的学习时长和分数；几条线都像样，“最好”得先定义 |
| 一 · 什么叫最好 | `Residual` | 残差为什么量竖直方向；残差和会正负抵消（水平线 y = ȳ 的残差和也是 0）；以残差为边画正方形，总面积就是 S；勒让德 1805、高斯 1809 |
| 二 · 让 S 最小 | `Calculus` | S(a,b) 的等高线是一只碗；只动 a 得抛物线 → Σeᵢ = 0 → 直线过平均点；绕平均点转 → Σxᵢeᵢ = 0 → 残差与 x 不相关；b = 330/82.5 = 4，a = 51 |
| 三 · 换个角度 | `Vectors`、`Space`、`Pythagoras` | 两个条件是两个点积；十个分数是 ℝ¹⁰ 里的一个向量；缩到三个点在三维里看：预测向量铺成 span{1, x}，最近点是垂足，垂直条件就是两个偏导条件，XᵀXβ = Xᵀy；换基坐标变、投影点不变；勾股定理 1636 = 1320 + 316，R² ≈ 0.81 = cos²θ |
| 四 · 同一个投影 | `Beyond` | 多一列还是同一个方程；列线性相关时投影唯一、坐标不唯一；二次拟合仍是线性回归——线性指对参数线性 |
| 五 · 为什么叫回归 | `Galton` | 高尔顿的身高研究；标准化后斜率是 r，|r| < 1，预测值向平均收；y 对 x 与 x 对 y 是两条不同的线 |
| 尾声 | `Finale` | 三句话总结；一个离群点把斜率从 4 拽到 1.8 |

画面里的数都由 [`src/data.py`](src/data.py) 算出（`python src/data.py` 打印核对表）：x̄ = 6.5，ȳ = 77，Sxx = 82.5，Sxy = 330，b = 4，a = 51，残差为 3, −6, 10, −4, −3, −9, 4, 6, 2, −3；SST = 1636，SSR = 1320，SSE = 316，R² = 0.807，r = 0.898。三点例子 (0, 0)、(1, 4)、(2, 2)：a = 1，b = 1，拟合值 (1, 2, 3)，残差 (−1, 2, −1)。

## 配音

`src/tts.py` 逐句调用百炼的 SpeechSynthesizer 流式接口，句子文字、模型、音色、语速都没变时复用缓存。音频以 base64 分块直接放在流式事件里返回，不需要再去 OSS 下载；同时取回逐字时间戳，合成时用它决定每段字幕何时出现。密钥只从环境变量或本目录的 `.env` 读取，`.env` 已被 `.gitignore` 排除，不要提交：

```bash
cp .env.example .env      # 填入 QWEN_TTS_API_KEY
```

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `QWEN_TTS_API_KEY` | —— | 必填，也认 `DASHSCOPE_API_KEY` |
| `QWEN_TTS_MODEL` | `qwen-audio-3.0-tts-plus` | 每万字符 1.4 元（一个汉字算 2 个字符），全片约 5800 字符，合成一遍不到 1 元 |
| `QWEN_TTS_VOICE` | `longanlingxin` | 龙安灵心，plus 模型的系统音色；音色必须属于所选模型 |
| `QWEN_TTS_RATE` | `0.95` | 语速，0.5–2.0 |
| `QWEN_TTS_BASE_URL` | `https://dashscope.aliyuncs.com` | 中国内地的密钥；国际站密钥用 `https://dashscope-intl.aliyuncs.com` |
| `QWEN_TTS_PROTOCOL` | `speech` | `speech` 为 SpeechSynthesizer 流式接口（Qwen-Audio-TTS、CosyVoice）；`dashscope` 为多模态生成接口（`qwen3-tts-flash` 等，返回 OSS 下载链接，运行环境还要能访问 OSS 域名）；`openai` 为 `/v1/audio/speech` 兼容接口 |

运行环境需要能访问 `dashscope.aliyuncs.com`。

旁白稿在 [`src/narration.py`](src/narration.py)，每句分字幕文字和配音文字两份：字幕里可以写 ŷ、Xᵀ、1805、x²，配音文字写成“y 帽”“X 转置”“一八零五”“x 平方”。这一步不能省：语音接口会把上下标直接丢掉（e₁² 念成“e”、R² 念成“R”），β 前后会多出停顿。两份文字的标点要一一对应（数字、记号的写法可以不同），字幕按标点断开，每段的出现时间按配音文字里对应标点之后第一个字的时间戳定。

多音字写在 `narration.PINYIN` 里，按拼音固定读音（残差、离差、标准差的“差”，得先的“得”，时长的“长”，转动的“转”……）。只写带声调的音节，轻声音节（如 `le5`）会被读成别的字。

合成之后用语音识别回听：

```bash
cd src && ../.venv/bin/python check.py      # 每句送进 qwen3-asr-flash，和配音文字对照，按字错误率列出可疑的句子
```

当前 96 句平均字错误率约 0.4%，剩下的差异都是同音字（全一 / 权一、他 / 它）。多音字读错时识别结果仍是同一个字，查不出来，所以由 PINYIN 固定。

## 制作方式

- **动画**：[Manim Community](https://www.manim.community/) 0.22，公式用 xelatex + xeCJK。三维投影一段用 `ThreeDScene`。
- **对时**：场景里每句旁白写成 `with self.say("键") as d:`，动画按配音时长安排，句子念完才进入下一步；渲染时记录每句在场景里的起点，合成时据此铺配音和字幕。
- **声音**：配音之外有一层很轻的铺底和弦，说话时自动压低；整片两遍 loudnorm 到 −16 LUFS。

## 生成

在 Ubuntu 24.04 上：

```bash
cd linear-regression-video
bash build.sh                  # 安装依赖、合成配音、渲染 1080p、合成成片 → output/linear-regression.mp4
JOBS=4 bash build.sh           # 4 个场景并行渲染
PREVIEW=1 bash build.sh        # 不调配音接口，按字数估计时长，出 540p 无人声预览（右上角标“未配音预览”）
```

只改了某一段时，可以单独渲染再合成：

```bash
cd src
PYTHON=../.venv/bin/python ./render.sh s3_calculus.py Calculus hd
../.venv/bin/python assemble.py hd
../.venv/bin/python sheet.py Calculus hd    # 每句旁白结尾的画面拼成缩略图，检查构图
```
