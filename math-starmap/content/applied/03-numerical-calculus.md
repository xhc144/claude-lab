---
galaxy: applied
cluster: numerical-calculus
title: 数值积分与数值微分
en: Numerical integration and differentiation
order: 3
level: core
---

## 数值微分 {#finite-difference}
type: 方法 | en: Numerical differentiation | w: 4 | 考纲: 数值微分
前置: taylor-theorem, error-types
后续: richardson, euler-method-ode
alias: 差商, 前向差分, 中心差分, 有限差分, 步长选择

用差商近似导数：
- 前向差分 $f'(x)\approx\frac{f(x+h)-f(x)}h$，截断误差 $O(h)$；
- 中心差分 $f'(x)\approx\frac{f(x+h)-f(x-h)}{2h}$，截断误差 $O(h^2)$；
- 二阶导数 $f''(x)\approx\frac{f(x+h)-2f(x)+f(x-h)}{h^2}$，误差 $O(h^2)$。

### 推导
泰勒展开：$f(x\pm h)=f\pm hf'+\frac{h^2}2f''\pm\frac{h^3}6f'''+\cdots$，相减时偶次项抵消，所以中心差分精度高一阶。

### 步长的两难
截断误差随 $h$ 减小而减小，舍入误差 $\sim\frac{\eps_{\text{mach}}}h$ 却随之增大。中心差分的总误差约 $\frac{h^2}6M+\frac{\eps}h$，最优 $h\approx\eps^{1/3}\approx10^{-5}$，此时也只有约 $10$ 位有效数字——数值微分天生“不稳定”，数值积分则相反。

## 理查森外推 {#richardson}
type: 方法 | en: Richardson extrapolation | w: 3 | 考纲: 数值微分, 数值积分
前置: finite-difference
后续: romberg
alias: 外推法, 理查森外推

若近似值 $A(h)=A+ch^p+O(h^{q})$，则用两个步长的组合消去主误差项：
$$A\approx\frac{2^pA(h/2)-A(h)}{2^p-1}.$$

### 例题
中心差分 $D(h)$ 的误差为 $c_2h^2+c_4h^4+\cdots$，于是 $\frac{4D(h/2)-D(h)}3$ 的误差为 $O(h^4)$。“不用更小的步长，只靠组合就提高了精度”——这是阿基米德割圆术加速的思想（刘徽也用过类似的外推）。

## 梯形公式 {#trapezoid-rule}
type: 公式 | en: Trapezoidal rule | w: 4 | 考纲: 数值积分
前置: riemann-integral, approximate-computation
后续: simpson-rule, romberg
anim: riemann-sum
alias: 梯形法则, 复合梯形公式

$$\int_a^bf\,\dd x\approx h\left[\frac{f(x_0)}2+f(x_1)+\cdots+f(x_{n-1})+\frac{f(x_n)}2\right],\qquad h=\frac{b-a}n.$$
误差 $-\frac{(b-a)h^2}{12}f''(\xi)$，二阶精度。

### 注记
对光滑的周期函数在整个周期上积分，梯形公式的精度出奇地高（指数收敛），因为欧拉–麦克劳林公式中的修正项全部抵消——这也是快速傅里叶变换计算傅里叶系数时实际在做的事。

## 辛普森公式 {#simpson-rule}
type: 公式 | en: Simpson's rule | w: 4 | 考纲: 数值积分
源于: trapezoid-rule
前置: lagrange-interpolation
alias: 辛普森法则, 抛物线法, 复合辛普森公式

在每两个小区间上用过三点的抛物线代替函数：
$$\int_{x_0}^{x_2}f\,\dd x\approx\frac h3\left[f(x_0)+4f(x_1)+f(x_2)\right].$$
复合公式误差为 $-\frac{(b-a)h^4}{180}f^{(4)}(\xi)$，四阶精度，并且对三次多项式精确（代数精度为 $3$，比预期多一阶）。

### 例题
$\int_0^1\frac{4}{1+x^2}\dd x=\pi$：取 $h=\frac14$，梯形公式得 $3.13118$，辛普森公式得 $3.14157$，误差约 $2\times10^{-6}$。

### 注记
辛普森公式也是梯形公式的理查森外推：$S=\frac{4T(h/2)-T(h)}3$。

## 牛顿-科茨公式与代数精度 {#newton-cotes}
type: 定理 | en: Newton–Cotes formulas | w: 3 | 考纲: 数值积分
前置: lagrange-interpolation, trapezoid-rule
后续: gauss-quadrature
alias: 代数精度, 插值型求积公式, 牛顿-科茨

插值型求积公式：用等距节点上的插值多项式代替被积函数再积分。若求积公式对所有次数 $\le m$ 的多项式精确、对某个 $m+1$ 次多项式不精确，称其代数精度为 $m$。梯形公式代数精度 $1$，辛普森 $3$，$n$ 点牛顿–科茨公式约 $n-1$ 或 $n$。

### 注记
高阶牛顿–科茨公式会出现负权重，数值不稳定（与龙格现象同源），所以实际中用低阶复合公式或高斯求积。

## 高斯求积 {#gauss-quadrature}
type: 定理 | en: Gaussian quadrature | w: 4 | 考纲: 数值积分
前置: newton-cotes, orthogonal-polynomials
alias: 高斯-勒让德求积, 最优节点, 代数精度 2n-1

$n$ 个节点的求积公式 $\sum w_if(x_i)$ 最高能达到代数精度 $2n-1$，当且仅当节点取为（关于该权函数的）$n$ 次正交多项式的零点。$[-1,1]$ 上权为 $1$ 时用勒让德多项式的零点：两点公式 $\int_{-1}^1f\approx f\left(-\frac1{\sqrt3}\right)+f\left(\frac1{\sqrt3}\right)$，对三次多项式精确。

### 证明思路
对次数 $\le2n-1$ 的 $p$，作带余除法 $p=qP_n+r$，$\deg q,\deg r\le n-1$。$\int qP_n=0$（正交性），而在 $P_n$ 的零点处 $p=r$，插值型公式对 $r$ 精确。

### 注记
节点和权重都可以自由选择（$2n$ 个参数），所以能精确积出 $2n$ 维的多项式空间。权重全为正，数值稳定。

## 龙贝格积分 {#romberg}
type: 算法 | en: Romberg integration | w: 2 | 考纲: 数值积分
前置: trapezoid-rule, richardson
alias: 龙贝格算法, 逐次分半, 外推表

从梯形公式出发，步长逐次减半，再对结果反复做理查森外推，构成三角形的外推表：第一列是梯形公式，第二列相当于辛普森公式，第三列相当于布尔公式……对光滑函数收敛极快，且可以复用前一步的函数值。

## 欧拉法 {#euler-method-ode}
type: 算法 | en: Euler's method | w: 3 | level: ext
前置: finite-difference, ode-basics
后续: runge-kutta
alias: 欧拉折线法, 显式欧拉法, 隐式欧拉法, 刚性方程

数值求解初值问题 $y'=f(t,y)$：$y_{k+1}=y_k+hf(t_k,y_k)$——沿当前斜率走一小步。全局误差 $O(h)$（一阶方法）。

### 稳定性
对 $y'=-\lambda y$（$\lambda>0$），显式欧拉法要求 $h<\frac2\lambda$，否则数值解振荡发散；隐式欧拉法 $y_{k+1}=y_k+hf(t_{k+1},y_{k+1})$ 对任何步长都稳定，适用于刚性方程（同时含有快慢变化的系统）。

## 龙格-库塔法 {#runge-kutta}
type: 算法 | en: Runge–Kutta methods | w: 3 | level: ext
源于: euler-method-ode
alias: 四阶龙格-库塔, RK4, 自适应步长

经典四阶方法（RK4）在每步内取四个斜率加权平均：
$$k_1=f(t_k,y_k),\ k_2=f\left(t_k+\tfrac h2,y_k+\tfrac h2k_1\right),\ k_3=f\left(t_k+\tfrac h2,y_k+\tfrac h2k_2\right),\ k_4=f(t_k+h,y_k+hk_3),$$
$$y_{k+1}=y_k+\frac h6(k_1+2k_2+2k_3+k_4).$$
全局误差 $O(h^4)$。当 $f$ 不依赖于 $y$ 时，它化为辛普森公式。

### 注记
实际软件（如 Dormand–Prince 方法）用一对嵌入的不同阶公式估计误差并自动调整步长。长时间模拟行星运动时，辛积分方法能保持能量不漂移。

## 蒙特卡罗积分 {#monte-carlo-integration}
type: 方法 | en: Monte Carlo integration | w: 3 | level: ext
源于: monte-carlo
前置: trapezoid-rule
alias: 随机积分, 拟蒙特卡罗, 维数灾难

$\int_{[0,1]^d}f\approx\frac1N\sum f(\vv x_i)$，$\vv x_i$ 独立均匀。误差 $O(N^{-1/2})$，与维数 $d$ 无关；而网格型求积公式在 $d$ 维中需要 $m^d$ 个点才能达到一维 $m$ 个点的精度（维数灾难）。

### 注记
低维时梯形、辛普森、高斯公式远远更好；维数超过十几维时，蒙特卡罗（或用低差异序列的拟蒙特卡罗）几乎是唯一的选择。
