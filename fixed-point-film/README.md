# 总有一点不动 · The Point That Stays

一支约 5 分钟、1080p / 30fps 的布劳威尔不动点定理讲解动画，分英文版和中文版，两版都有配音和字幕。它是英语数学面试的配套材料：面试问答稿见 **[面试准备.md](面试准备.md)**。

| 版本 | 成片 | 字幕 |
| --- | --- | --- |
| English（英文配音，英文字幕加中文小字） | `output/fixed_point_en.mp4` | `output/fixed_point_en.srt` |
| 中文（中文配音，中文字幕） | `output/fixed_point_zh.mp4` | `output/fixed_point_zh.srt` |

## 分镜

| 段落 | 画面 |
| --- | --- |
| 搅咖啡 | 拉花爱心被五段“保持杯子不变”的旋涡映射搅乱（逐像素反向映射）；数值求出整体映射的不动点，标出“起点 = 终点” |
| 片名 | 旋转收缩的向量场，所有箭头都在一个金色点处消失 |
| 公园地图 | 航拍风格的公园和纸质地图；地图落地、旋转、缩小、揉皱（三角网格纹理映射）；地标箭头“真实位置 → 地图上的位置”；画中画螺旋 M^k(公园) 收敛到不动点 |
| 定理陈述 | 闭圆盘 D、任意维闭球；彩色点从 x 移到 f(x)；位移向量场；不动点 x* |
| 一维 | 圆盘压扁成 [0,1]；曲线与对角线之间按 g(x)=f(x)−x 的正负着色；交点随曲线变形移动（介值定理） |
| 条件缺一不可 | 有洞（圆环旋转）、无边界（(0,1) 上 x/2）、不连续（跳过对角线）三个反例 |
| 斯佩纳引理 | 8×8 剖分、按规则染色、三色三角形计数、“房间与门”、沿门行走、底边门两两配对（3 = 2 + 1）。染色用种子搜索，保证正好有 3 扇底门、3 个三色三角形 |
| 斯佩纳 ⟹ 布劳威尔 | 按重心坐标中“下降最多”的那个染色；举例顶点的坐标对比；网格 8→16→32→64 加细并推近，三色三角形收缩到数值求得的不动点 |
| 应用 | 石头剪刀布的混合策略三角形与均衡 (⅓,⅓,⅓)；9×9 Hex 棋盘下满后用 BFS 找到获胜链；分房租与小型斯佩纳三角形 |
| 结尾 | 存在性证明、布劳威尔与直觉主义、PPAD；回到咖啡杯 |

每个场景都是 `web/scenes/` 下的一个模块，`draw(ctx, t, S)` 只依赖场景内时间 `t`，以及该语言旁白每一句的开始时间 `S.cue(i)`。所以英文版和中文版用同一套动画，节奏分别对齐各自的配音。

## 技术

- **画面**：HTML Canvas 2D，在无头 Chromium 里逐帧渲染。`scripts/render.mjs` 开 4 个页面并行截图，JPEG 通过管道送进 ffmpeg 分段编码，最后无损拼接。
- **公式**：MathJax 3 输出 SVG，再转成图片画进 canvas。
- **字体**：Source Serif 4、Inter、思源黑体 / 宋体（Noto Sans SC / Noto Serif SC），全部通过 npm 的 `@fontsource` 包在本地加载。
- **配音**：[Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx)（ONNX，离线）。英文用 v1.0 模型、`af_heart` 声线，音素由 misaki 生成；中文用 v1.1-zh 模型、`zf_001` 声线。人名、年份另有朗读文本（`*_tts` 字段）。
- **配乐**：`music.py` 只用 numpy 合成 D 大调氛围铺底和钟声，在旁白处自动压低音量，最后响度归一到 −16 LUFS。
- **核查**：配音生成后，用 Whisper small.en 和 Paraformer（sherpa-onnx）转写回文本，与脚本逐句对照。

## 运行

```bash
cd fixed-point-film
npm install                                  # 字体、MathJax、Playwright（使用本机 Chromium）
# 配音环境：Python 3.12（misaki 0.9 不支持 3.13）
uv venv -p 3.12 .venv && VIRTUAL_ENV=.venv uv pip install kokoro-onnx "misaki[en,zh]>=0.9" soundfile \
  "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
# 模型（约 730 MB）放到 models/
mkdir -p models && cd models
for f in model-files-v1.0/kokoro-v1.0.onnx model-files-v1.0/voices-v1.0.bin \
         model-files-v1.1/kokoro-v1.1-zh.onnx model-files-v1.1/voices-v1.1-zh.bin; do
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/$f
done
cd ..
PYTHON=.venv/bin/python bash build.sh        # 两种语言；4 核约 45 分钟
```

单独步骤：

- `python tts.py en`：生成旁白、`build/en/timing.json`
- `python3 music.py en`：生成配乐和混音
- `node scripts/render.mjs en --still 12.5,40`：渲染静帧到 `build/stills/`，调画面时用
- `node scripts/render.mjs en`：渲染整片画面
- `node scripts/finish.mjs en`：输出 `.srt` 并合成 mp4
- `node scripts/serve.mjs`：本地预览，打开 `http://127.0.0.1:8123/web/index.html?lang=zh&t=150`，可直接看任意时刻

旁白和字幕文本都在 `script.json`。改完重新跑 `tts.py`，动画会自动跟随新的时间轴。
