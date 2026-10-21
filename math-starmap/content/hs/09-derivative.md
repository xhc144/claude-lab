---
galaxy: hs
cluster: hs-derivative
title: 导数及其应用
en: Derivatives (school level)
order: 9
level: hs
---

## 导数 {#derivative}
type: 定义 | en: Derivative | w: 5 | 考纲: 中学数学全部内容, 单变量微积分
前置: function, function-limit
后续: derivative-rules, tangent-line, derivative-monotonicity, differentiability
alias: 导数, 瞬时变化率, 切线斜率, f'(x)
tags: 导数, 微积分
anim: derivative-tangent

函数在一点的导数是平均变化率在区间缩成一点时的极限：
$$f'(x_0)=\lim_{\Delta x\to0}\frac{f(x_0+\Delta x)-f(x_0)}{\Delta x}.$$
几何上它是曲线在该点切线的斜率，物理上它是瞬时速度。

### 直观
割线经过曲线上两点；让第二个点沿曲线滑向第一个点，割线就转到一个极限位置——切线。导数把“速度”这种瞬时概念第一次变得可以计算：位移 $s(t)=\frac12gt^2$ 的导数 $s'(t)=gt$ 就是速度。

### 例题
用定义求 $f(x)=x^2$ 在 $x_0$ 处的导数。

**解**：$\dfrac{(x_0+\Delta x)^2-x_0^2}{\Delta x}=2x_0+\Delta x\to2x_0$，所以 $f'(x_0)=2x_0$。

### 注记
可导必连续，连续不一定可导：$\abs x$ 在 $0$ 处连续但左右导数分别为 $-1$ 和 $1$。严格的处理见 [[differentiability]]。

## 求导法则 {#derivative-rules}
type: 公式 | en: Differentiation rules | w: 4 | 考纲: 中学数学全部内容, 单变量微积分
前置: derivative
后续: chain-rule
alias: 基本初等函数导数公式, 乘积法则, 商法则, 导数运算

基本导数：$(x^\alpha)'=\alpha x^{\alpha-1}$，$(\sin x)'=\cos x$，$(\cos x)'=-\sin x$，$(a^x)'=a^x\ln a$，$(\ee^x)'=\ee^x$，$(\ln x)'=\frac1x$，$(\log_ax)'=\frac1{x\ln a}$。
运算法则：
$$(u\pm v)'=u'\pm v',\quad (uv)'=u'v+uv',\quad \left(\frac uv\right)'=\frac{u'v-uv'}{v^2},\quad [f(g(x))]'=f'(g(x))\,g'(x).$$

### 证明
乘积法则：
$$\frac{u(x+h)v(x+h)-u(x)v(x)}h=\frac{u(x+h)-u(x)}h\,v(x+h)+u(x)\,\frac{v(x+h)-v(x)}h,$$
令 $h\to0$，并用 $v$ 在 $x$ 处连续（可导必连续）。

### 例题
求 $y=x\ee^{-x^2}$ 的导数：$y'=\ee^{-x^2}+x\cdot\ee^{-x^2}\cdot(-2x)=(1-2x^2)\ee^{-x^2}$。

## 切线方程 {#tangent-line}
type: 方法 | en: Tangent lines | w: 3 | 考纲: 中学数学全部内容
前置: derivative, line-equation
后续: newton-method
alias: 切线, 过点的切线, 在点的切线

曲线 $y=f(x)$ 在点 $(x_0,f(x_0))$ 处的切线方程为 $y-f(x_0)=f'(x_0)(x-x_0)$。

### 例题
过点 $(0,0)$ 作曲线 $y=\ee^x$ 的切线，求切线方程。

**解**：原点不在曲线上，要先设切点 $(t,\ee^t)$，切线 $y-\ee^t=\ee^t(x-t)$ 过原点，得 $-\ee^t=-t\ee^t$，$t=1$。切线为 $y=\ee x$。区分“在某点处的切线”与“过某点的切线”是常见考点。

### 应用
切线是函数的最佳线性近似：$f(x)\approx f(x_0)+f'(x_0)(x-x_0)$。牛顿迭代法求方程的根，就是不断用切线与 $x$ 轴的交点逼近零点，见 [[newton-method]]。

## 导数与单调性 {#derivative-monotonicity}
type: 定理 | en: Monotonicity via derivative | w: 4 | 考纲: 中学数学全部内容
前置: derivative, monotonicity
源于: lagrange-mvt
后续: extremum-derivative
alias: 导数判断单调性

在区间 $I$ 上，若 $f'(x)>0$，则 $f$ 递增；若 $f'(x)<0$，则递减。反过来，可导的递增函数满足 $f'(x)\ge0$。

### 证明
对 $x_1<x_2$，由 [[lagrange-mvt]]，存在 $\xi\in(x_1,x_2)$ 使 $f(x_2)-f(x_1)=f'(\xi)(x_2-x_1)>0$。

### 注记
$f'>0$ 是递增的充分不必要条件：$x^3$ 在 $\R$ 上递增，但 $f'(0)=0$。已知单调性求参数时，条件应写成 $f'(x)\ge0$（且 $f'$ 不在任何区间上恒为零）。

## 极值与最值 {#extremum-derivative}
type: 方法 | en: Extrema via derivative | w: 4 | 考纲: 中学数学全部内容, 极值问题
前置: derivative-monotonicity, function-max-min
源于: fermat-lemma
后续: multivar-extrema
alias: 极大值, 极小值, 驻点, 导数求最值

若 $f'$ 在 $x_0$ 两侧由正变负，$x_0$ 是极大值点；由负变正是极小值点。闭区间上的最值在极值点或端点处取得：比较所有驻点、不可导点和端点处的函数值。

### 例题
求 $f(x)=x^3-3x$ 在 $[-2,3]$ 上的最值。

**解**：$f'(x)=3(x-1)(x+1)$。$f(-1)=2$ 是极大值，$f(1)=-2$ 是极小值；端点 $f(-2)=-2$，$f(3)=18$。最大值 $18$，最小值 $-2$。

### 注记
导数为零是可导函数取极值的必要条件而非充分条件（$x^3$ 在 $0$ 处）；极值是局部概念，极大值可能小于极小值。

## 导数证明不等式 {#derivative-inequality}
type: 方法 | en: Proving inequalities with derivatives | w: 3 | 考纲: 中学数学全部内容, 不等式问题
前置: derivative-monotonicity, extremum-derivative
相关: convex-function
alias: 构造函数, 切线放缩, ln x ≤ x-1, e^x ≥ x+1

把不等式化为 $F(x)\ge0$，用导数研究 $F$ 的单调性与最小值。两个最常用的“母不等式”：
$$\ee^x\ge1+x,\qquad \ln x\le x-1\quad(x>0),$$
等号都只在一点取到。它们分别是 $\ee^x$ 在 $x=0$ 处、$\ln x$ 在 $x=1$ 处的切线不等式。

### 证明
令 $F(x)=\ee^x-1-x$，$F'(x)=\ee^x-1$ 在 $x<0$ 时为负、$x>0$ 时为正，所以 $F(x)\ge F(0)=0$。用 $\ln x$ 代 $x$ 即得另一个：$x\ge1+\ln x$。

### 例题
证明：对正整数 $n$，$\ln(n+1)<1+\frac12+\cdots+\frac1n$。

**证**：在 $\ln x\le x-1$ 中取 $x=\frac{k+1}k\ne1$，得 $\ln(k+1)-\ln k<\frac1k$。对 $k=1,\dots,n$ 求和，左边裂项相消为 $\ln(n+1)$。由于 $\ln(n+1)\to\infty$，调和级数发散，见 [[harmonic-series]]。
