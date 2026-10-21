---
galaxy: analysis
cluster: multivariable
title: 多元微分学
en: Multivariable differential calculus
order: 9
level: core
---

## 多元函数与 ℝⁿ {#euclidean-space}
type: 概念 | en: Functions of several variables | w: 4 | 考纲: 多元微积分
前置: function, vector-space
后续: multivariable-limit
alias: 欧氏空间, 多元函数, 等值线, 二元函数

$\R^n$ 中的点 $\vv x=(x_1,\dots,x_n)$，距离 $\norm{\vv x-\vv y}=\sqrt{\sum(x_i-y_i)^2}$。多元函数 $f:D\subseteq\R^n\to\R$ 的图像是 $\R^{n+1}$ 中的超曲面；二元函数可以用等值线（地形图的等高线）来看。

### 注记
$\R^n$ 上的开集、闭集、紧集、连通集的概念与 $\R$ 上平行：有界闭集即紧集（海涅–博雷尔），连续函数在紧集上有最大最小值。

## 多元函数的极限与连续 {#multivariable-limit}
type: 定义 | en: Limits and continuity in several variables | w: 3 | 考纲: 多元微积分
前置: euclidean-space, function-limit
后续: partial-derivative
alias: 二重极限, 累次极限

$\displaystyle\lim_{\vv x\to\vv a}f(\vv x)=A$：任意 $\eps>0$，存在 $\delta>0$，$0<\norm{\vv x-\vv a}<\delta$ 时 $\abs{f(\vv x)-A}<\eps$。$\vv x$ 可以沿**任何路径**趋于 $\vv a$。

### 例题
$f(x,y)=\dfrac{xy}{x^2+y^2}$ 在原点没有极限：沿 $y=kx$ 趋近，$f=\frac k{1+k^2}$ 随 $k$ 变化。
$f(x,y)=\dfrac{x^2y}{x^4+y^2}$ 沿每条直线趋于原点时极限都是 $0$，沿抛物线 $y=x^2$ 却是 $\frac12$：只检查直线方向不够。

### 注记
累次极限 $\lim_x\lim_yf$ 与二重极限是不同概念，可以一个存在另一个不存在，两个累次极限也可以不相等。

## 偏导数 {#partial-derivative}
type: 定义 | en: Partial derivative | w: 4 | 考纲: 多元微积分
前置: multivariable-limit, derivative
后续: total-differential, directional-derivative
alias: 偏导, 混合偏导, 克莱罗定理, 施瓦茨定理

固定其他变量，对一个变量求导：$\dfrac{\partial f}{\partial x}(a,b)=\lim_{h\to0}\dfrac{f(a+h,b)-f(a,b)}h$。几何上是曲面与平面 $y=b$ 的交线的切线斜率。

> [!定理] 混合偏导数相等（施瓦茨 / 克莱罗）
> 若 $f_{xy}$ 与 $f_{yx}$ 在点 $(a,b)$ 附近存在且在该点连续，则 $f_{xy}(a,b)=f_{yx}(a,b)$。

### 注记
偏导数存在不保证连续：$\frac{xy}{x^2+y^2}$（原点补 $0$）在原点两个偏导数都是 $0$，却不连续。偏导数只看两个方向，太弱，需要 [[total-differential]]。

## 全微分与可微 {#total-differential}
type: 定义 | en: Total differential | w: 4 | 考纲: 多元微积分
前置: partial-derivative
源于: differentiability
后续: multivar-chain-rule, jacobian
alias: 可微, 全微分, 线性近似, 切平面

$f$ 在 $\vv a$ 可微：存在线性映射 $L$ 使 $f(\vv a+\vv h)=f(\vv a)+L\vv h+o(\norm{\vv h})$。此时 $L\vv h=\sum\frac{\partial f}{\partial x_i}h_i$，全微分 $\dd f=\sum\frac{\partial f}{\partial x_i}\dd x_i$，曲面在该点有切平面。

> [!定理] 关系
> 偏导数在 $\vv a$ 附近连续 $\Rightarrow$ 可微 $\Rightarrow$ 连续且偏导数存在、各方向导数存在。各箭头都不可逆。

### 例题
$z=x^2+y^2$ 在 $(1,1)$ 处的切平面：$z-2=2(x-1)+2(y-1)$。

## 多元链式法则 {#multivar-chain-rule}
type: 定理 | en: Multivariable chain rule | w: 4 | 考纲: 多元微积分
源于: chain-rule
前置: total-differential
后续: jacobian, change-of-variables
alias: 复合函数求偏导, 雅可比矩阵乘积

若 $\vv g:\R^m\to\R^n$ 在 $\vv a$ 可微，$\vv f:\R^n\to\R^p$ 在 $\vv g(\vv a)$ 可微，则
$$D(\vv f\circ\vv g)(\vv a)=D\vv f(\vv g(\vv a))\,D\vv g(\vv a),$$
复合的导数是导数（雅可比矩阵）的乘积。分量形式：$\dfrac{\partial z}{\partial t}=\sum_i\dfrac{\partial z}{\partial x_i}\dfrac{\partial x_i}{\partial t}$。

### 例题
$z=f(x,y)$，$x=r\cos\theta$，$y=r\sin\theta$：$z_r=f_x\cos\theta+f_y\sin\theta$，$z_\theta=-f_xr\sin\theta+f_yr\cos\theta$。由此可把拉普拉斯算子写成极坐标形式 $\Delta f=f_{rr}+\frac1rf_r+\frac1{r^2}f_{\theta\theta}$。

## 方向导数与梯度 {#directional-derivative}
type: 定义 | en: Directional derivative and gradient | w: 5 | 考纲: 多元微积分
前置: total-differential, dot-product
后续: gradient-descent, divergence-curl
alias: 梯度, 方向导数, grad, ∇f, 最速上升方向

单位方向 $\vv u$ 上的方向导数 $D_{\vv u}f=\lim_{t\to0}\frac{f(\vv a+t\vv u)-f(\vv a)}t$。可微时 $D_{\vv u}f=\nabla f\cdot\vv u$，其中梯度
$$\nabla f=\left(\frac{\partial f}{\partial x_1},\dots,\frac{\partial f}{\partial x_n}\right).$$

### 直观
$\nabla f\cdot\vv u=\norm{\nabla f}\cos\theta$：沿梯度方向函数增长最快，增长率为 $\norm{\nabla f}$；垂直于梯度的方向增长率为零——所以梯度垂直于等值线（等值面）。登山时梯度指向最陡的上坡方向。

### 应用
[[gradient-descent]] 沿负梯度方向迭代求最小值；物理中电场是电势的负梯度 $\vv E=-\nabla\varphi$；曲面 $F(x,y,z)=0$ 的法向量是 $\nabla F$。

## 多元泰勒公式与黑塞矩阵 {#multivar-taylor}
type: 公式 | en: Multivariable Taylor formula and Hessian | w: 3 | 考纲: 多元微积分
源于: taylor-theorem
前置: directional-derivative, quadratic-form
后续: multivar-extrema
alias: 黑塞矩阵, Hessian, 二阶泰勒展开

$$f(\vv a+\vv h)=f(\vv a)+\nabla f(\vv a)\cdot\vv h+\frac12\vv h\T H(\vv a)\vv h+o(\norm{\vv h}^2),$$
其中 $H=\left(\frac{\partial^2f}{\partial x_i\partial x_j}\right)$ 是黑塞矩阵（二阶偏导连续时对称）。

### 直观
一阶项是切平面，二阶项是一个二次型，描述曲面在该点“向哪些方向弯、弯多少”。二次型的分类（正定、负定、不定）决定了驻点的类型。

## 多元函数的极值 {#multivar-extrema}
type: 定理 | en: Extrema of functions of several variables | w: 4 | 考纲: 多元微积分, 极值问题
前置: multivar-taylor, positive-definite
源于: extremum-derivative
后续: lagrange-multiplier, optimization-problem
alias: 驻点, 鞍点, 二阶判别法

可微函数在内部极值点处 $\nabla f=\vv0$。在驻点处看黑塞矩阵：正定 $\Rightarrow$ 极小值，负定 $\Rightarrow$ 极大值，不定 $\Rightarrow$ 鞍点（非极值），半定时需进一步判断。二元情形：设 $A=f_{xx},B=f_{xy},C=f_{yy}$，$AC-B^2>0$ 且 $A>0$ 为极小，$A<0$ 为极大；$AC-B^2<0$ 为鞍点。

### 例题
$f(x,y)=x^3+y^3-3xy$：驻点 $(0,0)$ 与 $(1,1)$。在 $(1,1)$，$A=6,B=-3,C=6$，$AC-B^2=27>0$，极小值 $f(1,1)=-1$；在 $(0,0)$，$AC-B^2=-9<0$，鞍点。

## 拉格朗日乘数法 {#lagrange-multiplier}
type: 方法 | en: Lagrange multipliers | w: 5 | 考纲: 多元微积分, 极值问题
前置: multivar-extrema, implicit-function-theorem
推广为: kkt
应用于: rayleigh-quotient, mle
alias: 条件极值, 拉格朗日乘子, 约束优化

求 $f(\vv x)$ 在约束 $g(\vv x)=0$ 下的极值：在极值点处（若 $\nabla g\ne\vv 0$）存在 $\lambda$ 使
$$\nabla f=\lambda\nabla g.$$
即解方程组 $\nabla_{\vv x}L=\vv0$，$g=0$，其中 $L=f-\lambda g$。

### 直观
沿约束曲线（面）移动时，若 $\nabla f$ 在切方向上有分量，就能继续增大 $f$。所以在极值点，$\nabla f$ 必须垂直于约束面，也就是与约束面的法向量 $\nabla g$ 平行：等值线与约束曲线相切。

### 例题
周长为 $2p$ 的矩形中面积最大的是什么？$f=xy$，$g=x+y-p$：$y=\lambda$，$x=\lambda$，所以 $x=y=\frac p2$，是正方形。
求 $x^2+y^2+z^2$ 在 $x+2y+3z=6$ 上的最小值：$2x=\lambda,2y=2\lambda,2z=3\lambda$，代入约束 $\lambda=\frac67$，最小值 $\frac{18}7$——与 [[cauchy-inequality-hs]] 的结果一致。

### 注记
乘子 $\lambda$ 有意义：它是最优值对约束常数的变化率（经济学中的“影子价格”）。多个约束时 $\nabla f=\sum\lambda_k\nabla g_k$。

## 隐函数定理 {#implicit-function-theorem}
type: 定理 | en: Implicit function theorem | w: 4 | 考纲: 多元微积分
前置: total-differential, inverse-function-theorem
源于: inverse-derivative
后续: lagrange-multiplier
alias: 隐函数存在定理

若 $F(x_0,y_0)=0$，$F$ 连续可微且 $F_y(x_0,y_0)\ne0$，则在 $(x_0,y_0)$ 附近方程 $F(x,y)=0$ 唯一确定一个连续可微函数 $y=\varphi(x)$，并且
$$\varphi'(x)=-\frac{F_x}{F_y}.$$
一般地，$\vv F(\vv x,\vv y)=\vv0$ 中关于 $\vv y$ 的雅可比矩阵可逆时，可局部解出 $\vv y=\vv\varphi(\vv x)$。

### 例题
$x^2+y^2=1$ 在 $(0,1)$ 附近确定 $y=\sqrt{1-x^2}$（$F_y=2\ne0$），在 $(1,0)$ 附近不能把 $y$ 解成 $x$ 的函数（$F_y=0$，竖直切线）。

### 注记
它说明“方程个数 = 待解变量个数且雅可比可逆”时，约束集局部像一张光滑的图像——这是光滑曲面、流形概念的基础。

## 反函数定理 {#inverse-function-theorem}
type: 定理 | en: Inverse function theorem | w: 3 | 考纲: 多元微积分
前置: jacobian, banach-fixed-point
推出: implicit-function-theorem
alias: 局部可逆

若 $\vv f:\R^n\to\R^n$ 连续可微且雅可比行列式 $\det D\vv f(\vv a)\ne0$，则 $\vv f$ 在 $\vv a$ 附近是一一的，局部逆映射也连续可微，且 $D(\vv f^{-1})=(D\vv f)^{-1}$。

### 证明思路
不妨设 $D\vv f(\vv a)=I$。解 $\vv f(\vv x)=\vv y$ 等价于求映射 $\vv x\mapsto\vv x-\vv f(\vv x)+\vv y$ 的不动点；在 $\vv a$ 的小邻域内它是压缩映射，由 [[banach-fixed-point]] 有唯一不动点。

### 注记
只是局部的：$(x,y)\mapsto(\ee^x\cos y,\ee^x\sin y)$ 的雅可比行列式 $\ee^{2x}$ 处处非零，但它以 $2\pi$ 为周期，整体上不是一一的。

## 雅可比矩阵与行列式 {#jacobian}
type: 概念 | en: Jacobian | w: 4 | 考纲: 多元微积分
前置: total-differential, determinant
后续: change-of-variables, inverse-function-theorem
alias: 雅可比矩阵, 雅可比行列式, 导数矩阵

$\vv f:\R^n\to\R^m$ 的导数是 $m\times n$ 矩阵 $D\vv f=\left(\frac{\partial f_i}{\partial x_j}\right)$。$m=n$ 时其行列式 $J=\det D\vv f$ 称为雅可比行列式，$\abs J$ 是映射在该点附近对体积的放大倍数。

### 例题
极坐标 $(r,\theta)\mapsto(r\cos\theta,r\sin\theta)$：
$$J=\begin{vmatrix}\cos\theta&-r\sin\theta\\\sin\theta&r\cos\theta\end{vmatrix}=r,$$
所以 $\dd x\,\dd y=r\,\dd r\,\dd\theta$。

### 注记
雅可比矩阵是“局部线性化”：在一点附近，非线性映射像一个线性映射，而线性映射对体积的伸缩率就是 [[det-volume|行列式]]。
