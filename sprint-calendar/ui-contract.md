# UI Contract · 冲刺日历

设计方向：**案头（Desk）** —— 备考工具 = 高密度仪表盘。
Dials: VARIANCE 2 / MOTION 2 / DENSITY 7。
所有组件必须引用本文件的 token，禁止新增裸色值 / 裸 px（组件内部微调除外）。

## 1. 色彩 tokens

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#f7f6f2` | 页面底色（暖纸白，禁纯白） |
| `--surface` | `#ffffff` | 卡片 / 面板 |
| `--surface-2` | `#f1efe9` | 次级填充（提示块、分段控件底） |
| `--ink` | `#211d18` | 主文字（暖黑） |
| `--ink-2` | `#57534b` | 次级文字 |
| `--muted` | `#6f6a60` | 辅助文字（白底对比度 ≥ 4.5:1） |
| `--line` | `#e6e2d9` | 常规描边 |
| `--line-strong` | `#d5d0c5` | 强调描边 |
| `--primary` | `#2c5d87` | 唯一主行动色（学术蓝，白字对比度 ≈ 7:1） |
| `--primary-strong` | `#234a6c` | primary hover |
| `--primary-soft` | `#e9eff5` | primary 浅底 |
| `--danger` | `#b04a3c` | 删除等破坏操作 |
| `--gold` | `#8a6d1a` | 固定锚点语义色 |
| `--gold-soft` | `#f6efdb` | 固定锚点浅底 |
| `--hero-bg` | `#21374d` | 顶部状态横幅（深墨蓝，页面唯一深色块） |

### 学科色（color-as-data，饱和度/明度统一调和，白底文字对比度 ≥ 4.5:1）

| 分类 | color | soft |
|---|---|---|
| 数学 | `#31659c` | `#eaf0f7` |
| 物理 | `#b2593f` | `#f8ece7` |
| 语言 | `#8a6d1a` | `#f5efdb` |
| 二试 | `#4d7a54` | `#ebf1ec` |
| 面试 | `#7a5b8c` | `#f1ecf4` |
| 恢复 | `#64707a` | `#edf0f2` |

规则：学科色仅用于「分类标识、链轨道、进度条、chip」；界面行动色只有 `--primary` 一个（accent lock）。

## 2. 字体 & 字阶

- `--font-sans`: `"PingFang SC","Microsoft YaHei UI","Noto Sans SC",system-ui,sans-serif` —— 全局唯一字体族
- `--font-kai`: `STKaiti,KaiTi,serif` —— **仅**用于品牌「冲」字标与 hero 大标题（brief 指定的中文书房气质，单点使用）
- 数字：统一 `font-variant-numeric: tabular-nums`

| Token | 尺寸 | 用途 |
|---|---|---|
| `--t-xs` | 12px | 最小字号（meta / 徽章 / chip）—— 不得低于此 |
| `--t-sm` | 13px | 次要正文 |
| `--t-md` | 15px | 正文基准 |
| `--t-lg` | 17px | 卡片标题 |
| `--t-xl` | 20px | 面板标题 |
| `--t-2xl` | 24px | 弹窗标题 |
| `--t-3xl` | 30px | hero / 大数字 |

## 3. 间距（4px 网格）

`--s-1:4  --s-2:8  --s-3:12  --s-4:16  --s-5:20  --s-6:24  --s-8:32  --s-10:40`
组内间距 ≤ `--s-3`，组间 ≥ `--s-4`（Gestalt 邻近性）。

## 4. 圆角（单一家族，禁不对称角标）

`--r-sm:6px（chip/小按钮）  --r-md:10px（按钮/输入）  --r-lg:14px（卡片）  --r-xl:20px（hero/弹窗）  --r-pill:999px`

## 5. 阴影

| Token | 值 |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(33,29,24,.05), 0 1px 6px rgba(33,29,24,.04)` |
| `--shadow-md` | `0 4px 16px rgba(33,29,24,.08)` |
| `--shadow-lg` | `0 20px 56px rgba(25,20,12,.22)` |

## 6. 组件不变量

- 按钮高度：默认 38px；主 CTA ≥ 44px（Fitts）；小按钮 ≥ 30px
- 交互目标 ≥ 24×24px（WCAG 2.2 AA）；`:focus-visible` = 2px `--primary` 外环 + 3px soft 晕
- 卡片 = `--surface` + 1px `--line` + `--r-lg` + `--shadow-sm`，hover 仅 `translateY(-1px)` + `--shadow-md`
- 完成态 = 透明度降低 + 删除线（色彩之外的第二通道，WCAG 1.4.1）
- 时间区间分隔符用 `-`（不用 `—`/`–`）
- 动效 ≤ 200ms ease；`prefers-reduced-motion` 全局关闭
- 每屏一个视觉主行动（Von Restorff）：顶栏「＋ 添加任务」为唯一实心按钮
