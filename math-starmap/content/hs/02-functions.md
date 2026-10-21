---
galaxy: hs
cluster: hs-functions
title: 函数的概念与性质
en: Functions
order: 2
level: hs
---

## 函数 {#function}
type: 概念 | en: Function | w: 5 | 考纲: 中学数学全部内容
前置: set
后续: monotonicity, parity, periodicity, inverse-function, composite-function, sequence
alias: 映射, 定义域, 值域, 对应法则
tags: 函数

函数是从一个数集到另一个数集的对应：定义域 $D$ 中每个 $x$ 都对应唯一的 $f(x)$。更一般地，集合之间满足这一条件的对应叫映射。定义域、对应法则、值域是函数的三要素，前两者确定了函数。

> [!定义] 函数
> 设 $A,B$ 是非空数集，如果按照对应关系 $f$，对 $A$ 中任意一个数 $x$，在 $B$ 中都有唯一确定的数 $f(x)$ 与之对应，就称 $f:A\to B$ 为从 $A$ 到 $B$ 的函数。$\{f(x)\mid x\in A\}$ 称为值域。

### 注记
- “唯一”是关键：圆 $x^2+y^2=1$ 不是 $y$ 关于 $x$ 的函数图像，因为竖直线可能交它两次。
- 映射的单射、满射、双射概念在大学里反复出现：可逆函数恰是双射，见 [[inverse-function]]。
- 求定义域时注意：分母不为零、偶次根号下非负、对数真数为正、$\tan x$ 中 $x\ne k\pi+\frac\pi2$。

## 函数的单调性 {#monotonicity}
type: 性质 | en: Monotonicity | w: 4 | 考纲: 中学数学全部内容
前置: function
后续: derivative-monotonicity, function-max-min, monotone-convergence
alias: 增函数, 减函数, 单调区间

若对区间 $I$ 中任意 $x_1<x_2$ 都有 $f(x_1)<f(x_2)$，称 $f$ 在 $I$ 上单调递增；反之 $f(x_1)>f(x_2)$ 称单调递减。

### 例题
证明 $f(x)=x+\frac1x$ 在 $(0,1]$ 上递减、在 $[1,+\infty)$ 上递增。

**证**：$f(x_1)-f(x_2)=(x_1-x_2)\left(1-\frac1{x_1x_2}\right)$。当 $0<x_1<x_2\le1$ 时 $x_1x_2<1$，括号为负，乘积为正，故 $f(x_1)>f(x_2)$；当 $1\le x_1<x_2$ 时 $x_1x_2>1$，乘积为负。这个“对勾函数”在 $x=1$ 取最小值 $2$，与 [[am-gm]] 一致。

### 注记
单调性是区间上的性质：$\frac1x$ 在 $(-\infty,0)$ 与 $(0,+\infty)$ 上分别递减，但在两者的并集上不递减。判断单调性最常用的工具是导数，见 [[derivative-monotonicity]]。

## 函数的奇偶性 {#parity}
type: 性质 | en: Even and odd functions | w: 3 | 考纲: 中学数学全部内容
前置: function
后续: function-symmetry, fourier-series
alias: 奇函数, 偶函数

定义域关于原点对称时：若 $f(-x)=f(x)$ 称为偶函数（图像关于 $y$ 轴对称）；若 $f(-x)=-f(x)$ 称为奇函数（图像关于原点对称）。

### 注记
- 定义域关于原点对称是前提。奇函数若在 $0$ 处有定义，则 $f(0)=0$。
- 任何定义在对称区间上的函数都能唯一分解为偶部与奇部：$f(x)=\frac{f(x)+f(-x)}2+\frac{f(x)-f(-x)}2$。
- 积分中：$\int_{-a}^a f=0$（$f$ 奇），$\int_{-a}^af=2\int_0^af$（$f$ 偶）；傅里叶级数中，偶函数只含余弦项，奇函数只含正弦项。

## 函数的周期性 {#periodicity}
type: 性质 | en: Periodic functions | w: 3 | 考纲: 中学数学全部内容
前置: function
例子: trig-functions
alias: 周期, 最小正周期

若存在非零常数 $T$，使定义域内每个 $x$ 都有 $f(x+T)=f(x)$，称 $f$ 为周期函数；最小的正周期称为最小正周期。

### 例题
若 $f(x+2)=-f(x)$ 对一切实数 $x$ 成立，证明 $f$ 是以 $4$ 为周期的函数。

**证**：$f(x+4)=-f(x+2)=f(x)$。类似地，若 $f$ 的图像同时关于直线 $x=a$ 与 $x=b$（$a\ne b$）对称，则 $2\abs{b-a}$ 是周期，见 [[function-symmetry]]。

### 注记
常数函数以任何非零数为周期，没有最小正周期；狄利克雷函数（有理点取 $1$、无理点取 $0$）以每个非零有理数为周期，也没有最小正周期。

## 函数图像的对称性 {#function-symmetry}
type: 性质 | en: Symmetry of graphs | w: 2 | 考纲: 中学数学全部内容
前置: parity
相关: periodicity

$f(a+x)=f(a-x)$ 对一切 $x$ 成立 $\iff$ 图像关于直线 $x=a$ 对称；$f(a+x)+f(a-x)=2b$ $\iff$ 图像关于点 $(a,b)$ 中心对称。奇偶性是 $a=b=0$ 的特例。

### 例题
三次函数 $f(x)=x^3-3x^2+1$ 的图像关于哪个点对称？

**解**：三次函数图像关于拐点中心对称。$f''(x)=6x-6=0$ 得 $x=1$，$f(1)=-1$，对称中心为 $(1,-1)$。验证：$f(1+t)+f(1-t)=(t^3-3t-1)+(-t^3+3t-1)=-2$。

### 应用
两条对称轴 $\Rightarrow$ 周期：若关于 $x=a$ 与 $x=b$ 对称，则 $f(x+2(b-a))=f(x)$。正弦曲线就有无穷多条对称轴和对称中心。

## 反函数 {#inverse-function}
type: 概念 | en: Inverse function | w: 3 | 考纲: 中学数学全部内容
前置: function, monotonicity
后续: logarithmic-function, inverse-trig, inverse-derivative
alias: 反函数, 双射, 可逆

若 $y=f(x)$ 是从定义域到值域的一一对应，就能反过来由 $y$ 唯一确定 $x$，得到反函数 $x=f^{-1}(y)$。在同一坐标系中，$y=f(x)$ 与 $y=f^{-1}(x)$ 的图像关于直线 $y=x$ 对称。

### 注记
- 区间上严格单调的函数一定有反函数，且反函数与原函数单调性相同。
- $f^{-1}(f(x))=x$，$f(f^{-1}(y))=y$；反函数的定义域是原函数的值域。
- 若 $y=f(x)$ 与反函数图像相交，交点不一定都在 $y=x$ 上：$f(x)=-x^3$ 与其反函数 $f^{-1}(x)=-\sqrt[3]x$ 交于 $(1,-1)$、$(-1,1)$ 等点。但若 $f$ 递增，交点必在 $y=x$ 上。

## 复合函数 {#composite-function}
type: 概念 | en: Composite function | w: 3 | 考纲: 中学数学全部内容
前置: function
后续: chain-rule
alias: 复合, 同增异减

$y=f(g(x))$ 是先作 $u=g(x)$ 再作 $y=f(u)$ 的复合函数，记 $f\circ g$。复合函数的单调性遵循“同增异减”：内外层单调性相同时递增，相反时递减。

### 例题
求 $y=\log_{\frac12}(x^2-2x-3)$ 的单调递增区间。

**解**：定义域 $x^2-2x-3>0$，即 $x<-1$ 或 $x>3$。外层 $\log_{\frac12}u$ 递减，所以要找内层 $u=x^2-2x-3$ 的递减区间：$(-\infty,-1)$。答案是 $(-\infty,-1)$——别忘了先求定义域。

### 注记
复合运算满足结合律但一般不满足交换律：$\sin(x^2)\ne(\sin x)^2$。函数在复合下构成的结构是群论的原型：一个集合到自身的全部双射在复合下构成 [[symmetric-group|对称群]]。

## 函数图像变换 {#graph-transform}
type: 方法 | en: Graph transformations | w: 3 | 考纲: 中学数学全部内容
前置: function
后续: sinusoid
alias: 平移, 伸缩, 对称变换, 左加右减

由 $y=f(x)$ 的图像得到新图像：
- $y=f(x-a)$：向右平移 $a$；$y=f(x)+b$：向上平移 $b$；
- $y=f(\omega x)$（$\omega>0$）：横坐标变为原来的 $\frac1\omega$；$y=Af(x)$：纵坐标变为原来的 $A$ 倍；
- $y=f(-x)$ 关于 $y$ 轴对称，$y=-f(x)$ 关于 $x$ 轴对称，$y=f(\abs x)$ 保留右半再对称到左边，$y=\abs{f(x)}$ 把 $x$ 轴下方翻上去。

### 注记
对 $x$ 的变换“反着来”：$f(x-a)$ 是右移，因为新图像在 $x=a$ 处取到原来 $x=0$ 处的值。先伸缩后平移时要特别小心：$y=\sin(2x+\frac\pi3)=\sin 2\left(x+\frac\pi6\right)$，从 $y=\sin2x$ 左移的是 $\frac\pi6$ 而不是 $\frac\pi3$。

## 函数的零点 {#function-zeros}
type: 定理 | en: Zeros of functions | w: 4 | 考纲: 中学数学全部内容
前置: function
推广为: ivt
后续: bisection-method
alias: 零点存在性定理, 方程的根

使 $f(x)=0$ 的 $x$ 叫函数的零点，它就是方程 $f(x)=0$ 的实根，也是图像与 $x$ 轴交点的横坐标。

> [!定理] 零点存在性定理
> 若 $f$ 在 $[a,b]$ 上连续且 $f(a)f(b)<0$，则 $f$ 在 $(a,b)$ 内至少有一个零点。

### 例题
判断 $f(x)=\ln x+2x-6$ 的零点个数和所在区间。

**解**：$f$ 在 $(0,+\infty)$ 上递增（两项都递增），至多一个零点。$f(2)=\ln2-2<0$，$f(3)=\ln3>0$，所以恰有一个零点，在 $(2,3)$ 内。再用 [[bisection-method]] 可以逐步缩小区间。

### 注记
条件 $f(a)f(b)<0$ 是充分而不必要的：$f(x)=x^2$ 在 $[-1,1]$ 上有零点但两端同号。严格证明需要实数完备性，见 [[ivt]]。

## 函数的最值 {#function-max-min}
type: 概念 | en: Maximum and minimum | w: 3 | 考纲: 中学数学全部内容
前置: monotonicity
后续: extremum-derivative, extreme-value-theorem
alias: 最大值, 最小值, 值域

$f$ 在 $D$ 上的最大值 $M$ 要求两件事：对一切 $x\in D$，$f(x)\le M$；并且存在 $x_0\in D$ 使 $f(x_0)=M$。缺少第二条只能说 $M$ 是上界。

### 例题
求 $f(x)=x^2-2ax+1$ 在 $[0,2]$ 上的最小值。

**解**：对称轴 $x=a$。按对称轴的位置分类：$a\le0$ 时最小值 $f(0)=1$；$0<a<2$ 时最小值 $f(a)=1-a^2$；$a\ge2$ 时最小值 $f(2)=5-4a$。“轴动区间定”的分类讨论，见 [[case-analysis]]。

### 注记
闭区间上的连续函数一定有最大最小值（[[extreme-value-theorem]]）；开区间上未必：$\frac1x$ 在 $(0,1)$ 上没有最大值。
