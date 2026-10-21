---
galaxy: analysis
cluster: multiple-integral
title: 重积分
en: Multiple integrals
order: 10
level: core
---

## 二重积分 {#double-integral}
type: 定义 | en: Double integral | w: 4 | 考纲: 多元微积分
源于: riemann-integral
前置: euclidean-space
后续: fubini, triple-integral
alias: 重积分, 曲顶柱体体积

把区域 $D$ 分成小块 $\Delta\sigma_i$，作和 $\sum f(\xi_i,\eta_i)\Delta\sigma_i$，小块直径趋于零时的极限就是 $\iint_Df\,\dd\sigma$。$f\ge0$ 时它是以 $D$ 为底、曲面 $z=f$ 为顶的柱体体积；$f\equiv1$ 时是 $D$ 的面积。

### 注记
有界闭区域上的连续函数可积（区域边界需是零面积的，例如分段光滑曲线）。重积分的性质与定积分平行：线性、区域可加、保序、中值定理。

## 富比尼定理 {#fubini}
type: 定理 | en: Fubini's theorem | w: 4 | 考纲: 多元微积分
前置: double-integral
alias: 累次积分, 化重积分为累次积分, 交换积分次序

重积分可以化为累次积分。若 $D=\{(x,y):a\le x\le b,\ \varphi_1(x)\le y\le\varphi_2(x)\}$，$f$ 连续，则
$$\iint_Df\,\dd\sigma=\int_a^b\dd x\int_{\varphi_1(x)}^{\varphi_2(x)}f(x,y)\,\dd y.$$
在矩形上两种次序都可以，结果相同。

### 例题
$\displaystyle\int_0^1\dd x\int_x^1\ee^{-y^2}\dd y$：内层积不出来，交换次序：
$$=\int_0^1\dd y\int_0^y\ee^{-y^2}\dd x=\int_0^1y\ee^{-y^2}\dd y=\frac12\left(1-\ee^{-1}\right).$$

### 注记
对不绝对可积的函数，两个累次积分可以都存在但不相等。勒贝格积分框架中，$\iint\abs f<\infty$（富比尼）或 $f\ge0$（托内利）时可交换。

## 重积分的变量替换 {#change-of-variables}
type: 定理 | en: Change of variables | w: 4 | 考纲: 多元微积分
前置: fubini, jacobian
源于: multivar-chain-rule
后续: gaussian-integral
alias: 换元, 极坐标变换, 柱坐标, 球坐标

若 $T:(u,v)\mapsto(x,y)$ 是一一的连续可微映射，雅可比行列式 $J\ne0$，则
$$\iint_Df(x,y)\,\dd x\,\dd y=\iint_{T^{-1}(D)}f(T(u,v))\,\abs{J(u,v)}\,\dd u\,\dd v.$$
常用：极坐标 $\dd x\dd y=r\dd r\dd\theta$；柱坐标 $\dd V=r\dd r\dd\theta\dd z$；球坐标 $\dd V=\rho^2\sin\varphi\,\dd\rho\,\dd\varphi\,\dd\theta$。

### 直观
小矩形 $\dd u\dd v$ 被 $T$ 映成近似的平行四边形，面积是 $\abs J\dd u\dd v$——因为局部看 $T$ 是线性映射 $DT$，而线性映射把面积放大 $\abs{\det}$ 倍。

## 高斯积分 {#gaussian-integral}
type: 例子 | en: Gaussian integral | w: 4 | 考纲: 多元微积分
源于: change-of-variables
应用于: normal-distribution, gamma-function
alias: 概率积分, e^{-x^2} 的积分, 泊松积分

$$\int_{-\infty}^{+\infty}\ee^{-x^2}\dd x=\sqrt\pi.$$
被积函数没有初等原函数，却可以用“升维”算出精确值——这是二重积分最漂亮的应用之一。

### 证明
设 $I=\int_{-\infty}^\infty\ee^{-x^2}\dd x$，则
$$I^2=\iint_{\R^2}\ee^{-(x^2+y^2)}\dd x\,\dd y=\int_0^{2\pi}\dd\theta\int_0^\infty\ee^{-r^2}r\,\dd r=2\pi\cdot\frac12=\pi.$$
（反常二重积分的换元可用正方形与圆盘相互夹逼来严格化。）

### 应用
正态分布密度 $\frac1{\sqrt{2\pi}}\ee^{-x^2/2}$ 的归一化常数由它确定；$\Gamma\left(\frac12\right)=\sqrt\pi$；$n$ 维球体积公式也由 $I^n=\pi^{n/2}$ 推出。

## 三重积分 {#triple-integral}
type: 概念 | en: Triple integral | w: 3 | 考纲: 多元微积分
源于: double-integral
前置: change-of-variables
后续: gauss-divergence
alias: 体积分, 质量, 质心, 转动惯量

$\iiint_\Omega f\,\dd V$ 可理解为密度为 $f$ 的物体的质量。计算方法：“先一后二”（投影法）、“先二后一”（截面法）、柱坐标、球坐标。

### 例题
半径为 $R$ 的均匀实心球对直径的转动惯量：
$$I=\iiint(x^2+y^2)\rho\,\dd V=\rho\int_0^{2\pi}\dd\theta\int_0^\pi\dd\varphi\int_0^R r^2\sin^2\varphi\cdot r^2\sin\varphi\,\dd r=\rho\cdot2\pi\cdot\frac43\cdot\frac{R^5}5=\frac25MR^2.$$
其中 $M=\frac43\pi R^3\rho$。

## 卡瓦列里原理 {#cavalieri}
type: 原理 | en: Cavalieri's principle | w: 3 | 考纲: 立体几何, 多元微积分
前置: polyhedra-volume
推广为: fubini
alias: 祖暅原理, 幂势既同则积不容异

两个立体夹在两平行平面之间，若被任一平行平面所截的截面积都相等，则它们的体积相等。中国南北朝祖暅提出时比卡瓦列里早约一千一百年：“幂势既同，则积不容异”。

### 例题
**球体积**：半球与“圆柱挖去倒圆锥”在高度 $h$ 处的截面积都是 $\pi(R^2-h^2)$，所以半球体积 $=\pi R^3-\frac13\pi R^3=\frac23\pi R^3$。

### 注记
用积分语言，体积 $=\int A(h)\,\dd h$，截面积函数相同则积分相同——它是富比尼定理的特例。
