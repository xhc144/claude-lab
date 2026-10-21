---
galaxy: hs
cluster: hs-methods
title: 数学思想方法
en: Mathematical thinking
order: 10
level: hs
---

## 数形结合 {#number-shape}
type: 思想 | en: Combining algebra and geometry | w: 4 | 考纲: 中学数学全部内容
例子: complex-plane, vector-geometry
相关: line-equation
alias: 数形结合思想, 以形助数, 以数解形

“数缺形时少直观，形少数时难入微”（华罗庚）。把代数式解释为几何量（距离、斜率、面积），或把几何关系写成方程，借另一种语言解题。

### 例题
求 $f(x)=\sqrt{x^2+1}+\sqrt{(x-3)^2+4}$ 的最小值。

**解**：$f(x)$ 是 $x$ 轴上点 $P(x,0)$ 到 $A(0,1)$ 与 $B(3,2)$ 的距离之和。作 $A$ 关于 $x$ 轴的对称点 $A'(0,-1)$，则 $f(x)=\abs{PA'}+\abs{PB}\ge\abs{A'B}=\sqrt{9+9}=3\sqrt2$，在 $P$ 为 $A'B$ 与 $x$ 轴交点时取到。这正是光的反射路径最短（[[fermat-principle]]）。

### 注记
- $\frac{y-b}{x-a}$ 是斜率，$\sqrt{(x-a)^2+(y-b)^2}$ 是距离，$ax+by$ 是在方向 $(a,b)$ 上的投影（线性规划的等值线）。
- 解析几何、复数的几何意义、导数的切线意义、积分的面积意义，都是数形结合的体现。

## 分类讨论 {#case-analysis}
type: 思想 | en: Case analysis | w: 3 | 考纲: 中学数学全部内容, 分类计数
例子: function-max-min
相关: addition-principle
alias: 分类讨论思想, 不重不漏

当问题在不同条件下结论不同时，按一个标准把情形分开，逐一解决再汇总。分类要“不重不漏”：标准统一、各类互斥、合起来覆盖全部。

### 常见来源
- 概念本身分段：绝对值、分段函数、等比数列 $q=1$ 与 $q\ne1$；
- 参数影响结构：二次项系数是否为零、开口方向、对称轴与区间的位置；
- 图形位置不确定：点在线段内或外、角为锐角或钝角。

### 注记
分类讨论与计数中的 [[addition-principle]] 是同一种思想；好的解法常常先通过变形“避免”讨论，例如用 [[auxiliary-angle]] 合并三角式。

## 化归与转化 {#transformation-reduction}
type: 思想 | en: Reduction | w: 3 | 考纲: 中学数学全部内容
相关: function-equation-idea
alias: 转化与化归, 换元, 化未知为已知

把待解决的问题变成已经会解的问题：复杂化简单、未知化已知、一般化特殊、抽象化具体。换元、构造、等价变形、补集思想都是化归的手段。

### 例题
解方程 $4^x-3\cdot2^x+2=0$。

**解**：令 $t=2^x>0$，化为 $t^2-3t+2=0$，$t=1$ 或 $2$，所以 $x=0$ 或 $1$。换元把指数方程化归为二次方程，同时要记住新变量的范围 $t>0$。

### 注记
正难则反：求“至少一个”的概率时转而求“一个都没有”，见 [[classical-probability]]；证明“不存在”时用 [[proof-by-contradiction]]。

## 函数与方程思想 {#function-equation-idea}
type: 思想 | en: Functions and equations | w: 3 | 考纲: 中学数学全部内容
前置: function-zeros
相关: transformation-reduction
alias: 函数思想, 方程思想, 构造函数

用运动变化的观点看问题，把数量关系看作函数，借助单调性、最值、零点来解决；或把问题中的等量关系列成方程（组）求解。方程 $f(x)=g(x)$ 的解就是两个函数图像交点的横坐标。

### 例题
讨论方程 $\ln x=ax$ 的实根个数。

**解**：分离参数 $a=\frac{\ln x}x$。令 $h(x)=\frac{\ln x}x$，$h'(x)=\frac{1-\ln x}{x^2}$，$h$ 在 $(0,\ee)$ 递增、$(\ee,+\infty)$ 递减，最大值 $h(\ee)=\frac1\ee$；$x\to0^+$ 时 $h\to-\infty$，$x\to+\infty$ 时 $h\to0^+$。所以：$a>\frac1\ee$ 无根；$a=\frac1\ee$ 或 $a\le0$ 一个根；$0<a<\frac1\ee$ 两个根。

## 特殊与一般 {#special-general}
type: 思想 | en: Special cases and generalization | w: 2 | 考纲: 中学数学全部内容
相关: math-induction
alias: 特殊化, 一般化, 归纳猜想

从特殊情形中发现规律、提出猜想，再一般地证明；反过来，用特殊值检验一般结论、排除错误选项。数学的推广（勾股定理 $\to$ 余弦定理 $\to$ 内积空间）正是由特殊走向一般。

### 例题
计算 $\sum_{k=1}^n\frac k{(k+1)!}$。

**解**：先算特殊值：$n=1$ 得 $\frac12$，$n=2$ 得 $\frac56$，$n=3$ 得 $\frac{23}{24}$，猜想和为 $1-\frac1{(n+1)!}$。验证：$\frac k{(k+1)!}=\frac{(k+1)-1}{(k+1)!}=\frac1{k!}-\frac1{(k+1)!}$，裂项相消即得。

### 注记
星图中的“推广”连线（紫色虚线）记录的正是这种由特殊到一般的关系。
