# 统计的符号与术语

一支把统计里常见的符号和专有名词逐个讲清楚的中文讲解视频：每个记号交代三件事——怎么读、是什么意思、为什么这样写。从“参数用希腊字母、统计量用拉丁字母、帽子表示估计、大写是随机变量”这几条约定讲起，一路走过描述统计、概率、随机变量、常见分布、抽样分布、参数估计、假设检验和回归，最后把一字多义、容易混淆的记号和常见缩写放在一起。开场和结尾是同一段论文式的记号，看完以后能把它逐句读出来。

画面、字幕、铺底音乐全部由本目录的代码生成；配音用阿里云百炼的通义千问语音合成（模型 `qwen-audio-3.0-tts-plus`，音色龙安灵心），密钥读环境变量 `DASHSCOPE_API_KEY`。

成片：[`output/stats-notation.mp4`](output/stats-notation.mp4)（1080p30，H.264 + AAC，带章节，中文配音，字幕压在画面里），字幕另附 [`output/stats-notation.srt`](output/stats-notation.srt)。

## 章节

| 段落 | 场景类 | 讲到的符号与术语 |
| --- | --- | --- |
| 开场 | `Opening` | 一段论文式的记号：X₁,…,X₁₆ ~ i.i.d. N(μ, σ²)、H₀/H₁、μ̂ = x̄、t ~ t(15)、p、α、CI、d |
| 一 · 总体与样本 | `Population` | 总体、样本、样本量 n 与 N、参数、统计量；μ/x̄、σ/s、σ²/s²、ρ/r、p(π)/p̂、β/β̂、θ/θ̂；帽子；大写 Xᵢ 与小写 xᵢ、X̄ 与 x̄；估计量与估计值；统计推断；简单随机、分层、整群抽样，选择偏差 |
| 二 · 描述统计 | `Describe`、`Spread` | 定类、定序、离散、连续；Σ；x̄；顺序统计量 x₍ᵢ₎；中位数 x̃ / M / Q₂；众数；频数、频率、直方图；右偏（正偏）、偏度、峰度；Q₁ Q₃、分位数、IQR、极差、箱线图、离群值；离差、离差平方和、s²、s、为什么除以 n − 1、自由度 df / ν、无偏、总体方差 σ²；z 分数；变异系数 CV |
| 三 · 概率 | `Probability`、`Bayes` | Ω、事件、P / Pr、补事件 Aᶜ / Ā（与 x̄ 的横线不同）、∪、∩、AB、加法公式、互斥 ∅、条件概率 P(A ∣ B)；灵敏度、特异度、假阳性、P(A ∣ B) ≠ P(B ∣ A)、贝叶斯公式、先验与后验；独立、A ⫫ B、独立与互斥的区别 |
| 四 · 随机变量 | `RandomVar` | 随机变量 X 与取值 x；PMF（分布列）、PDF f(x)、积分与面积、密度可以大于 1、CDF F(x)；E(X)；Var(X) 与国内教材的 D(X)；σ、μ_X、σ_X；Cov(X, Y)、ρ；不相关不等于独立 |
| 五 · 常见分布 | `Normal`、`Discrete`、`SamplingDists` | ~ 读“服从”；N(μ, σ²) 第二个参数是方差（软件常要标准差）；Z、标准化、φ、Φ、Φ(1.96)、68-95-99.7；上 α 分位点 z_α、u_α、z₁₋α；B(n, p) / Bin、组合数 (n k) 与 Cₙᵏ、阶乘、np、np(1 − p)、伯努利；泊松 P(λ) / π(λ) / Pois(λ)；U(a, b)、Exp(λ)；χ²(k)、t(k)（戈塞特与“学生”）、F(m, n)；i.i.d. |
| 六 · 抽样分布 | `Sampling` | X̄ 的抽样分布、E(X̄) = μ、σ²/n、标准误 SE / SEM、SD 与 SE 的区别；大数定律 →ᴾ；中心极限定理、依分布收敛 →ᵈ / →ᴸ / ⇝；近似服从的几种写法 |
| 七 · 参数估计 | `Estimation`、`Interval` | 点估计与区间估计；偏差 bias、无偏、打靶图、MSE = 方差 + 偏差²、E(s) < σ；相合性（一致性）、有效性；最大似然 MLE：似然函数、连乘 Π、分号 f(x; θ)、argmax 与 max、对数似然 ℓ、似然不是概率；置信区间、置信水平 1 − α、误差范围、t 版本；“95%”的含义（100 个区间的模拟） |
| 八 · 假设检验 | `Testing`、`Errors` | H₀（原假设、零假设）、μ₀、H₁ / Hₐ；检验统计量、t(15)、p 值、显著性水平 α、拒绝域、临界值、p 值的常见误读、“不拒绝”不等于“接受”、单侧与双侧；第一类错误（弃真）α、第二类错误（取伪）β、功效 1 − β、功效分析；* / ** / *** / n.s.；t(15) = −2.40, p = .030 的报告格式；统计显著不等于差别重要、效应量 Cohen's d；多重比较与邦费罗尼校正；z、t、χ²、F 检验与 ANOVA |
| 九 · 回归 | `Regression`、`Models` | 因变量 / 响应变量、自变量 / 解释变量 / 预测变量；β₀、β₁、误差项 ε；拟合值 ŷ；残差 e 与误差 ε 的区别；OLS；SST、SSR、SSE 以及计量教材里正好相反的写法（ESS、RSS）；R² 与 r²；y = Xβ + ε、设计矩阵、β̂ = (XᵀX)⁻¹Xᵀy、X′；调整 R²；方差分析表 df / SS / MS / F；逻辑回归、logit、odds（优势、比值，不是日常的“几率”）、OR、RR；混杂变量、随机对照试验 |
| 十 · 容易混淆的记号 | `Confusables`、`Glossary` | p、β、π、α、r / ρ / R² / R 的多种意思；头顶的横线、帽子、波浪；~、≈、∝、:=、≜；竖线与分号；先验 π(θ)、似然、后验 p(θ ∣ x)、∝、可信区间；E / 𝔼、Var / D / V、P / Pr / ℙ；SD、SE、IQR、CV、PDF、CDF、i.i.d.、MLE、OLS、CI、H₀、df、ANOVA、OR、RR |
| 尾声 | `Finale` | 回到开场那一段，逐句读出来 |

画面里的数都由 [`src/data.py`](src/data.py) 算出（`python src/data.py` 打印核对表）：七个阅读时长 6, 6, 6, 7, 7, 10, 14 的均值 8、中位数 7、众数 6、离差平方和 54、s² = 9、s = 3、IQR = 4、z(14) = 2；一千人检测例子的 P(阳性 ∣ 患病) = 90%、P(患病 ∣ 阳性) = 9/108 ≈ 8.3%；面包例子 n = 16、x̄ = 494、s = 10、t = −2.4、df = 15、p = 0.0298、临界值 ±2.131、95% CI = [488.67, 499.33]、d = 0.6。

## 配音

`src/tts.py` 逐句调用百炼的 SpeechSynthesizer 流式接口，句子文字、模型、音色、语速都没变时复用缓存；音频以 base64 分块放在流式事件里返回，同时取回逐字时间戳，合成时用它决定每段字幕何时出现。密钥只从环境变量或本目录的 `.env` 读取，`.env` 已被 `.gitignore` 排除，不要提交：

```bash
export DASHSCOPE_API_KEY=...      # 或 cp .env.example .env 后填入 QWEN_TTS_API_KEY
```

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `QWEN_TTS_API_KEY` | —— | 必填，也认 `DASHSCOPE_API_KEY` |
| `QWEN_TTS_MODEL` | `qwen-audio-3.0-tts-plus` | 每万字符 1.4 元（一个汉字算 2 个字符），全片约 1 万字，合成一遍约 3 元 |
| `QWEN_TTS_VOICE` | `longanlingxin` | 龙安灵心 |
| `QWEN_TTS_RATE` | `0.95` | 语速，0.5–2.0 |
| `QWEN_TTS_BASE_URL` | `https://dashscope.aliyuncs.com` | 国际站密钥用 `https://dashscope-intl.aliyuncs.com` |
| `QWEN_TTS_PROTOCOL` | `speech` | `speech`（SpeechSynthesizer 流式接口）、`dashscope`（多模态生成接口）或 `openai`（`/v1/audio/speech` 兼容接口） |

旁白稿在 [`src/narration.py`](src/narration.py)，每句分字幕文字和配音文字两份：字幕里写 μ、x̄、θ̂、H₀、χ²，配音文字写成“缪”“x 拔”“西塔帽”“H 零”“卡方”。这一步不能省：语音接口会丢掉上下标，直接写希腊字母会被读错（χ 会念成“器”）。两份文字的句读要一一对应，`python narration.py` 会检查。多音字和希腊字母的念法写在 `narration.PINYIN` 里（方差、残差、标准差的“差”，参数的“参”，似然的“似”，泊松的“泊”，缪、卡、斐……）。

合成之后用语音识别回听：

```bash
cd src && ../.venv/bin/python check.py      # 每句送进 qwen3-asr-flash，和配音文字对照，按字错误率列出可疑的句子
```

剩下的差异基本是同音字（并 / 病、似然 / 自然、竖线 / 数现）和识别器把“缪”“柔”写成 μ、ρ。回听时发现过一句开头被接口漏读（“z 阿尔法叫上阿尔法分位点”），改写后重新合成。

## 制作方式

- **动画**：[Manim Community](https://www.manim.community/) 0.22，公式用 xelatex + xeCJK。每个章节是 `src/` 下的一到两个场景类，共 20 段。
- **对时**：场景里每句旁白写成 `with self.say("键") as d:`，动画按配音时长安排，句子念完才进入下一步；渲染时记录每句在场景里的起点，合成时据此铺配音和字幕。还没合成配音的句子按字数估计时长，只能用来试渲染，`assemble.py` 遇到估计值或配音已经变过的场景会拒绝出成片。
- **字幕**：x̄、θ̂、p̂ 这类“字母 + 组合附加符号”在中文字体里会排歪，`assemble.py` 把它们单独换成 DejaVu Sans 再压进画面。
- **声音**：配音之外有一层很轻的铺底和弦，说话时自动压低；整片两遍 loudnorm 到 −16 LUFS。

## 生成

在 Ubuntu 24.04 上：

```bash
cd stats-notation-video
bash build.sh                  # 安装依赖、合成配音、渲染 1080p、合成成片 → output/stats-notation.mp4
JOBS=4 bash build.sh           # 4 个场景并行渲染
PREVIEW=1 bash build.sh        # 不调配音接口，按字数估计时长，出 540p 无人声预览（右上角标“未配音预览”）
```

只改了某一段时，可以单独渲染再合成：

```bash
cd src
PYTHON=../.venv/bin/python ./render.sh s08_testing.py Testing hd
../.venv/bin/python assemble.py hd
../.venv/bin/python sheet.py Testing hd    # 每句旁白结尾的画面拼成缩略图，检查构图
```
