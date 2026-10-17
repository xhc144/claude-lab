---
galaxy: analysis
cluster: vector-calculus
title: 曲线曲面积分与场论
en: Vector calculus
order: 11
level: core
---

## 曲线积分 {#line-integral}
type: 定义 | en: Line integrals | w: 4 | 考纲: 多元微积分
前置: double-integral, parametric-curve, arc-length
后续: greens-theorem, path-independence
alias: 第一型曲线积分, 第二型曲线积分, 功, 环量

- 第一型（对弧长）：$\int_Lf\,\dd s=\int_\alpha^\beta f(\vv r(t))\norm{\vv r'(t)}\dd t$，如曲线形物体的质量；
- 第二型（对坐标）：$\int_LP\,\dd x+Q\,\dd y=\int_L\vv F\cdot\dd\vv r$，如变力沿路径做的功，与曲线方向有关。

### 例题
$\vv F=(-y,x)$ 沿单位圆逆时针一周：$\vv r=(\cos t,\sin t)$，$\vv F\cdot\vv r'=\sin^2t+\cos^2t=1$，环量 $=2\pi$。这个场在旋转，所以绕一圈做的功不为零。

## 格林公式 {#greens-theorem}
type: 定理 | en: Green's theorem | w: 4 | 考纲: 多元微积分
前置: line-integral, fubini
源于: ftc
推广为: stokes-theorem
alias: Green 公式, 平面区域的面积公式

$D$ 是由分段光滑闭曲线 $L$ 围成的平面区域（$L$ 取正向，即沿 $L$ 走时 $D$ 在左边），$P,Q$ 在 $\bar D$ 上连续可微，则
$$\oint_LP\,\dd x+Q\,\dd y=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)\dd x\,\dd y.$$

### 证明
对“$x$ 型”区域 $D=\{a\le x\le b,\ \varphi_1\le y\le\varphi_2\}$：
$$-\iint_D\frac{\partial P}{\partial y}=-\int_a^b\left[P(x,\varphi_2(x))-P(x,\varphi_1(x))\right]\dd x=\oint_LP\,\dd x,$$
（竖直边上 $\dd x=0$）。类似处理 $Q$ 项，一般区域切分为若干块，内部公共边上的积分方向相反而抵消。

### 应用
面积 $A=\frac12\oint_Lx\,\dd y-y\,\dd x$，这就是求积仪的原理；对多边形得到“鞋带公式” $A=\frac12\abs{\sum(x_iy_{i+1}-x_{i+1}y_i)}$。

## 积分与路径无关 {#path-independence}
type: 定理 | en: Path independence and conservative fields | w: 4 | 考纲: 多元微积分
前置: greens-theorem
应用于: potential-energy, electric-potential
alias: 保守场, 势函数, 原函数, 全微分方程

在单连通区域 $D$ 上，若 $P,Q$ 连续可微，以下四条等价：
1. $\oint_L P\dd x+Q\dd y=0$ 对 $D$ 内每条闭曲线成立；
2. 积分只依赖起点终点，与路径无关；
3. 存在势函数 $u$ 使 $\dd u=P\dd x+Q\dd y$（即 $\vv F=\nabla u$）；
4. $\dfrac{\partial Q}{\partial x}=\dfrac{\partial P}{\partial y}$ 在 $D$ 内处处成立。

### 例题
$\vv F=\left(\frac{-y}{x^2+y^2},\frac x{x^2+y^2}\right)$ 在去掉原点的平面上满足条件 4，但沿单位圆积分为 $2\pi\ne0$。原因：去心平面不是单连通的，原点是一个“洞”。这个积分计数曲线绕原点的圈数，是拓扑里 [[fundamental-group|基本群]] 的分析影子。

### 应用
重力、静电力是保守力，做功与路径无关，因而可以定义势能；摩擦力不是保守力。

## 曲面积分 {#surface-integral}
type: 定义 | en: Surface integrals | w: 3 | 考纲: 多元微积分
前置: double-integral, total-differential
后续: gauss-divergence, stokes-theorem
alias: 第一型曲面积分, 第二型曲面积分, 通量

- 第一型：$\iint_Sf\,\dd S$，参数化 $\vv r(u,v)$ 时 $\dd S=\norm{\vv r_u\times\vv r_v}\dd u\,\dd v$；
- 第二型（通量）：$\iint_S\vv F\cdot\vv n\,\dd S$，表示单位时间流过曲面的流量，与曲面的侧（法向选取）有关。

### 注记
有些曲面没有一致的两侧，例如默比乌斯带，在它上面无法定义第二型曲面积分（不可定向），见 [[mobius-strip]]。

## 散度与旋度 {#divergence-curl}
type: 概念 | en: Divergence and curl | w: 4 | 考纲: 多元微积分
前置: directional-derivative, cross-product
后续: gauss-divergence, stokes-theorem, maxwell-equations
alias: 散度, 旋度, 梯度, 哈密顿算子, 场论, 拉普拉斯算子

对向量场 $\vv F=(P,Q,R)$，用 $\nabla=\left(\frac\partial{\partial x},\frac\partial{\partial y},\frac\partial{\partial z}\right)$：
$$\divg\vv F=\nabla\cdot\vv F=P_x+Q_y+R_z,\qquad \curl\vv F=\nabla\times\vv F.$$
散度是单位体积的净流出率（源的强度），旋度描述局部旋转（方向为转轴，大小为环量密度的两倍角速度）。

### 恒等式
$\nabla\times(\nabla u)=\vv0$（梯度场无旋），$\nabla\cdot(\nabla\times\vv F)=0$（旋度场无源），$\nabla\cdot\nabla u=\Delta u$（拉普拉斯算子）。

### 例题
刚体以角速度 $\vv\omega$ 绕轴旋转，速度场 $\vv v=\vv\omega\times\vv r$，$\curl\vv v=2\vv\omega$，$\divg\vv v=0$。

## 高斯公式 {#gauss-divergence}
type: 定理 | en: Divergence theorem | w: 4 | 考纲: 多元微积分
前置: surface-integral, triple-integral, divergence-curl
源于: ftc
应用于: gauss-law
推广为: differential-forms
alias: 散度定理, 奥-高公式, Gauss 公式

$\Omega$ 是由闭曲面 $S$ 围成的空间区域，$S$ 取外侧，则
$$\oiint_S\vv F\cdot\vv n\,\dd S=\iiint_\Omega\nabla\cdot\vv F\,\dd V.$$
穿出边界的总通量 = 内部所有源的强度之和。

### 应用
静电学的高斯定律 $\oiint\vv E\cdot\dd\vv S=\frac Q{\eps_0}$ 与微分形式 $\nabla\cdot\vv E=\frac\rho{\eps_0}$ 通过它互相转化；流体力学的连续性方程 $\frac{\partial\rho}{\partial t}+\nabla\cdot(\rho\vv v)=0$ 由质量守恒加高斯公式得到。

## 斯托克斯公式 {#stokes-theorem}
type: 定理 | en: Stokes' theorem | w: 4 | 考纲: 多元微积分
前置: surface-integral, divergence-curl
源于: greens-theorem
推广为: differential-forms
应用于: faraday-law
alias: Stokes 公式, 环量与旋度

曲面 $S$ 的边界为闭曲线 $L$，方向符合右手法则，则
$$\oint_L\vv F\cdot\dd\vv r=\iint_S(\nabla\times\vv F)\cdot\vv n\,\dd S.$$
格林公式是 $S$ 位于平面内的特例。

### 直观
把曲面分成许多小网格，每个小网格边界的环量约等于旋度乘面积；相邻网格公共边上的环量方向相反而抵消，只剩外边界。

### 应用
法拉第电磁感应定律：$\oint\vv E\cdot\dd\vv l=-\frac{\dd}{\dd t}\iint\vv B\cdot\dd\vv S$ 与 $\nabla\times\vv E=-\frac{\partial\vv B}{\partial t}$ 等价。

## 微分形式与一般斯托克斯定理 {#differential-forms}
type: 定理 | en: Differential forms and the general Stokes theorem | w: 3 | level: ext
前置: stokes-theorem, gauss-divergence
相关: exterior-algebra
alias: 外微分, 微分形式, 广义斯托克斯定理, 流形上的积分

把被积表达式看作微分形式：$0$-形式是函数，$1$-形式 $P\dd x+Q\dd y+R\dd z$，$2$-形式 $P\,\dd y\wedge\dd z+\cdots$。外微分 $\dd$ 满足 $\dd\circ\dd=0$。所有经典积分公式统一为
$$\int_M\dd\omega=\int_{\partial M}\omega.$$

| $M$ 的维数 | $\omega$ | 经典公式 |
|:-:|:-:|:-:|
| 1 | 函数 $f$ | 牛顿–莱布尼茨 $\int_a^bf'=f(b)-f(a)$ |
| 2（平面） | 1-形式 | 格林公式 |
| 2（曲面） | 1-形式 | 斯托克斯公式 |
| 3 | 2-形式 | 高斯公式 |

### 注记
$\dd\circ\dd=0$ 统一了 $\nabla\times\nabla u=0$ 与 $\nabla\cdot\nabla\times\vv F=0$。“闭形式是否恰当”的障碍度量了区域的拓扑（德拉姆上同调），与 [[path-independence]] 中“洞”的例子一脉相承。
