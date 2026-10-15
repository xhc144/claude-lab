# 《最优化的本质》—— 程序化数学讲解视频

一支 18 分 56 秒、1080p / 60fps、带中文配音和字幕的讲解视频，主题是最优化的四块核心内容：不等式与极值、凸优化、梯度下降、线性规划。全部画面由 [Manim](https://www.manim.community/) 按代码生成，配音由离线中文语音模型合成，背景音乐由 numpy 合成，没有使用任何外部素材。

成片：`output/optimization_essence_1080p.mp4`（64 MB，H.264 + AAC 立体声，响度 -16 LUFS），字幕另附 `output/optimization_essence_1080p.srt`（已烧录进画面）。

## 这支视频想讲清楚什么

整片围绕一个问题展开：**我们只能看见脚下（局部），却想知道全局。**

| 章节 | 核心画面 | 想讲清楚的本质 |
| --- | --- | --- |
| 开场 | 雾中的山地，雾散后露出更深的山谷 | 优化的难度来自局部最优与全局最优的差别 |
| 一 · 极值与不等式 | 铁皮盒子与滑动的切线；马鞍面；上升的"地板"；均值不等式的半圆；沿小路与等高线相切；碗里的小球与墙 | 导数给局部的判断，不等式给全局的证明，乘子是约束的价格 |
| 二 · 凸优化 | 两个蒙眼下山的人；凸集的线段检验；半平面切出多边形；切线永远在碗下方；Lasso 的菱形尖角；上下夹逼的对偶 | 凸函数的切线就是全局下界，所以局部最优 = 全局最优 |
| 三 · 梯度下降 | 雾中下山；梯度场；旋转的方向与点积；三种学习率；狭长山谷里的之字形；动量的铁球；随机梯度与鞍点；牛顿法 | 只用局部信息一步步走；快慢由条件数（山谷的形状）决定 |
| 四 · 线性规划 | 木工坊的五边形可行域；平推的等利润线；单纯形法逐步记账；约束线平移得出影子价格；收购商的对偶；整数点 | 最优解在顶点；凸性让单纯形法敢停；对偶变量就是资源的价格 |
| 尾声 | 三条主线与三个问题 | 局部与全局、上界与下界、约束都有价格 |

画面里的数值都是真实计算的结果：铁皮盒子的最优剪法是 1、容积 16；条件数为 10 的山谷里，梯度下降要 35 步，动量法要 15 步（函数值缩小一百万倍）；木工坊最优是 20 张桌子、20 把椅子，利润 10000 元，木料与工时的影子价格都是 100 元，对偶问题的最优值同样是 10000 元。核对脚本见 [`../video-scripts/optimization_check.py`](../video-scripts/optimization_check.py)。

## 制作流程

```bash
cd optimization-film
bash tools/fetch_models.sh          # 下载离线语音模型（约 130 MB，来自 sherpa-onnx 的 GitHub Releases）
python tools/tts.py                 # 合成 88 段旁白 → build/audio/
python tools/asr_check.py           # 可选：用语音识别回听配音，按字错误率排出可疑段落
python tools/build.py --preview     # 480p 预览版，约 10 分钟
python tools/build.py               # 1080p60 正式版，4 核约 1 小时
```

| 文件 | 作用 |
| --- | --- |
| `narration.py` | 全片旁白，按场景分段；旁白里不出现拉丁字母和阿拉伯数字，公式只出现在画面上 |
| `scenes/common.py` | 配色、字体、`VScene` 基类：`with self.say("段落编号")` 内的动画与该段语音同时开始，并记录帧精确的时间 |
| `scenes/s0_intro.py` … `s5_outro.py` | 各章动画 |
| `tools/tts.py` | 用 Matcha（标贝中文女声）+ Vocos 声码器合成旁白；修正了词典里"步长、边长、切线、稳稳地"等多音字的读音 |
| `tools/asr_check.py` | 用 SenseVoice 语音识别回听，检查配音是否读错 |
| `tools/music.py` | 合成背景铺底音乐：慢速和弦 pad、钢片琴泛音、卷积混响 |
| `tools/build.py` | 并行渲染全部场景，按记录的时间铺设旁白轨，生成 ASS/SRT 字幕，混入随旁白自动压低的背景音乐，烧录字幕并编码成片 |
| `tools/preview.sh`、`tools/contact.py` | 低清预览单个场景，并把每段旁白结尾处的画面拼成缩略图，用来检查构图 |

## 环境

- Python 3.10+，`pip install manim sherpa-onnx soundfile scipy contourpy`
- 系统：ffmpeg（需要 libass 以烧录字幕）、Cairo / Pango 开发库、LaTeX（texlive-latex-extra、dvisvgm）、Noto Sans/Serif CJK SC 字体
- Ubuntu：`sudo apt-get install ffmpeg libcairo2-dev libpango1.0-dev texlive-latex-extra texlive-science dvisvgm fonts-noto-cjk`
