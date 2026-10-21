---
galaxy: analysis
cluster: mean-value
title: 中值定理与泰勒公式
en: Mean value theorems and Taylor's formula
order: 4
level: core
---

## 费马引理 {#fermat-lemma}
type: 引理 | en: Fermat's lemma | w: 4 | 考纲: 单变量微积分, 极值问题
前置: differentiability
推出: rolle-theorem, extremum-derivative
alias: 费马定理, 驻点, 极值的必要条件

若 $f$ 在 $x_0$ 处取得局部极值且在 $x_0$ 可导，则 $f'(x_0)=0$。

### 证明
设 $x_0$ 是极大值点。$h>0$ 很小时 $\frac{f(x_0+h)-f(x_0)}h\le0$，取极限得 $f'(x_0)\le0$；$h<0$ 时比值 $\ge0$，得 $f'(x_0)\ge0$。所以 $f'(x_0)=0$。

### 注记
必须是内点：区间端点处的最值不要求导数为零。多元版本：可微函数在内部极值点处梯度为零，见 [[multivar-extrema]]。

## 罗尔定理 {#rolle-theorem}
type: 定理 | en: Rolle's theorem | w: 4 | 考纲: 单变量微积分
源于: fermat-lemma
前置: extreme-value-theorem
推出: lagrange-mvt
alias: Rolle 中值定理

若 $f$ 在 $[a,b]$ 上连续、在 $(a,b)$ 内可导，且 $f(a)=f(b)$，则存在 $\xi\in(a,b)$ 使 $f'(\xi)=0$。

### 证明
由 [[extreme-value-theorem]]，$f$ 在 $[a,b]$ 上取到最大值 $M$ 和最小值 $m$。若 $M=m$，$f$ 是常数，任取 $\xi$。否则 $M,m$ 至少有一个不等于 $f(a)=f(b)$，它在内点 $\xi$ 处取到，由 [[fermat-lemma]] $f'(\xi)=0$。

### 例题
证明 $x^5+x-1=0$ 只有一个实根。存在性由介值定理（$f(0)<0<f(1)$）；若有两个根 $a<b$，由罗尔定理存在 $\xi$ 使 $f'(\xi)=5\xi^4+1=0$，不可能。

## 拉格朗日中值定理 {#lagrange-mvt}
type: 定理 | en: Mean value theorem | w: 5 | 考纲: 单变量微积分
源于: rolle-theorem
推广为: cauchy-mvt, taylor-theorem
后续: derivative-monotonicity
alias: 微分中值定理, 拉格朗日定理, 有限增量公式
anim: mvt

若 $f$ 在 $[a,b]$ 上连续、在 $(a,b)$ 内可导，则存在 $\xi\in(a,b)$ 使
$$f(b)-f(a)=f'(\xi)(b-a).$$
几何上，曲线上某点的切线平行于连接两端点的弦；物理上，某一时刻的瞬时速度等于全程平均速度。

### 证明
令 $g(x)=f(x)-\dfrac{f(b)-f(a)}{b-a}(x-a)$（减去弦），则 $g(a)=g(b)=f(a)$，对 $g$ 用罗尔定理。

### 应用
- 导数恒为零的函数是常数；导数相等的两个函数相差常数。
- 不等式：$\abs{\sin x-\sin y}\le\abs{x-y}$；$\frac{x}{1+x}<\ln(1+x)<x$（$x>0$）。
- 由导数符号判断单调性，见 [[derivative-monotonicity]]。

## 柯西中值定理 {#cauchy-mvt}
type: 定理 | en: Cauchy's mean value theorem | w: 3 | 考纲: 单变量微积分
推出: lhopital
alias: 柯西定理, 广义中值定理

若 $f,g$ 在 $[a,b]$ 上连续、$(a,b)$ 内可导，且 $g'(x)\ne0$，则存在 $\xi\in(a,b)$ 使
$$\frac{f(b)-f(a)}{g(b)-g(a)}=\frac{f'(\xi)}{g'(\xi)}.$$
取 $g(x)=x$ 即拉格朗日中值定理。

### 证明
$g'\ne0$ 与罗尔定理保证 $g(b)\ne g(a)$。令 $h(x)=f(x)-\dfrac{f(b)-f(a)}{g(b)-g(a)}g(x)$，验证 $h(a)=h(b)$，再用罗尔定理。

### 直观
参数曲线 $(g(t),f(t))$ 上某点的切线平行于两端点的弦。分别对 $f$、$g$ 用拉格朗日定理得到的两个 $\xi$ 一般不同，所以不能直接相除。

## 洛必达法则 {#lhopital}
type: 定理 | en: L'Hôpital's rule | w: 4 | 考纲: 单变量微积分
源于: cauchy-mvt
前置: function-limit
alias: L'Hospital, 洛必达, 0/0 型, ∞/∞ 型

若 $x\to a$ 时 $f,g$ 同时趋于 $0$（或同时趋于 $\infty$），且 $\displaystyle\lim\frac{f'(x)}{g'(x)}$ 存在（或为 $\infty$），则
$$\lim_{x\to a}\frac{f(x)}{g(x)}=\lim_{x\to a}\frac{f'(x)}{g'(x)}.$$

### 证明
（$\frac00$ 型、$x\to a^+$）补充定义 $f(a)=g(a)=0$。对 $[a,x]$ 用柯西中值定理：$\frac{f(x)}{g(x)}=\frac{f'(\xi)}{g'(\xi)}$，$\xi\in(a,x)$。$x\to a^+$ 时 $\xi\to a^+$，右边趋于所求极限。

### 例题
$\displaystyle\lim_{x\to0}\frac{x-\sin x}{x^3}=\lim\frac{1-\cos x}{3x^2}=\lim\frac{\sin x}{6x}=\frac16.$

### 易错
- 条件不满足不能用：$\displaystyle\lim_{x\to\infty}\frac{x+\sin x}x=1$，但导数之比 $1+\cos x$ 无极限——法则只是充分条件。
- 其他未定式 $0\cdot\infty$、$\infty-\infty$、$1^\infty$、$0^0$、$\infty^0$ 先化为 $\frac00$ 或 $\frac\infty\infty$。

## 泰勒公式 {#taylor-theorem}
type: 定理 | en: Taylor's theorem | w: 5 | 考纲: 单变量微积分
前置: higher-derivatives, infinitesimal
源于: lagrange-mvt
推出: maclaurin-expansions
推广为: taylor-series, multivar-taylor
alias: 泰勒展开, 佩亚诺余项, 拉格朗日余项, 麦克劳林公式
anim: taylor

用多项式逼近函数：在 $x_0$ 附近，
$$f(x)=\sum_{k=0}^n\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k+R_n(x).$$
- 佩亚诺余项：$R_n(x)=o\left((x-x_0)^n\right)$（只需 $f^{(n)}(x_0)$ 存在）；
- 拉格朗日余项：$R_n(x)=\dfrac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1}$，$\xi$ 在 $x_0$ 与 $x$ 之间（需 $f^{(n+1)}$ 存在）。

### 直观
一阶泰勒是切线；二阶加上曲率的修正，用抛物线贴合；阶数越高，多项式与函数在 $x_0$ 处“接触”得越紧——前 $n$ 阶导数全部相同。

### 证明
（拉格朗日余项）令 $P_n$ 为泰勒多项式，$R=f-P_n$，则 $R(x_0)=R'(x_0)=\cdots=R^{(n)}(x_0)=0$。对 $R(x)$ 与 $(x-x_0)^{n+1}$ 反复用 [[cauchy-mvt]] 共 $n+1$ 次：
$$\frac{R(x)}{(x-x_0)^{n+1}}=\frac{R'(\xi_1)}{(n+1)(\xi_1-x_0)^n}=\cdots=\frac{R^{(n+1)}(\xi)}{(n+1)!}=\frac{f^{(n+1)}(\xi)}{(n+1)!}.$$

### 应用
- 求极限：把和差展开到足够阶，见 [[infinitesimal]]。
- 近似计算与误差估计：$\ee=\sum_{k=0}^{n}\frac1{k!}+\frac{\ee^\xi}{(n+1)!}$，取 $n=10$ 误差小于 $10^{-7}$。
- 证明不等式、判断极值（二阶导数判别法）、数值微分的误差分析。

## 常用麦克劳林展开 {#maclaurin-expansions}
type: 公式 | en: Common Maclaurin expansions | w: 4 | 考纲: 单变量微积分
源于: taylor-theorem
后续: taylor-series
alias: 麦克劳林展开式, 常用展开

$x\to0$ 时：
$$\ee^x=1+x+\frac{x^2}{2!}+\cdots+\frac{x^n}{n!}+o(x^n),$$
$$\sin x=x-\frac{x^3}{3!}+\frac{x^5}{5!}-\cdots+(-1)^{n}\frac{x^{2n+1}}{(2n+1)!}+o(x^{2n+2}),$$
$$\cos x=1-\frac{x^2}{2!}+\frac{x^4}{4!}-\cdots+(-1)^n\frac{x^{2n}}{(2n)!}+o(x^{2n+1}),$$
$$\ln(1+x)=x-\frac{x^2}2+\frac{x^3}3-\cdots+(-1)^{n-1}\frac{x^n}n+o(x^n),$$
$$(1+x)^\alpha=1+\alpha x+\frac{\alpha(\alpha-1)}{2!}x^2+\cdots+\binom\alpha nx^n+o(x^n).$$

### 例题
$\displaystyle\lim_{x\to0}\frac{\cos x-\ee^{-x^2/2}}{x^4}$：$\cos x=1-\frac{x^2}2+\frac{x^4}{24}+o(x^4)$，$\ee^{-x^2/2}=1-\frac{x^2}2+\frac{x^4}8+o(x^4)$，差为 $-\frac{x^4}{12}+o(x^4)$，极限 $-\frac1{12}$。

## 凸函数 {#convex-function}
type: 定义 | en: Convex function | w: 4 | 考纲: 单变量微积分, 凸优化理论
前置: lagrange-mvt
推出: jensen-inequality
后续: convex-optimization
alias: 凹凸性, 下凸函数, 拐点, 二阶导数判别

$f$ 在区间 $I$ 上凸（下凸）：对任意 $x,y\in I$ 和 $t\in[0,1]$，
$$f(tx+(1-t)y)\le tf(x)+(1-t)f(y),$$
即弦在图像上方。若 $f$ 二阶可导，$f$ 凸 $\iff f''\ge0$；凸性改变的点叫拐点。

### 等价刻画
可导函数 $f$ 凸 $\iff$ $f'$ 单调不减 $\iff$ 图像总在每条切线上方：$f(y)\ge f(x)+f'(x)(y-x)$。最后一条说明凸函数的驻点就是全局最小值点，这是 [[convex-optimization]] 的基石。

### 例题
$\ee^x$、$x^2$、$-\ln x$、$x\ln x$ 都是凸函数；$\sin x$ 在 $[0,\pi]$ 上是凹函数。

## 延森不等式 {#jensen-inequality}
type: 不等式 | en: Jensen's inequality | w: 4 | 考纲: 单变量微积分, 不等式问题, 凸优化理论
源于: convex-function
特例: am-gm
应用于: expectation
alias: Jensen 不等式, 琴生不等式

若 $f$ 凸，$\lambda_i\ge0$，$\sum\lambda_i=1$，则
$$f\left(\sum_{i=1}^n\lambda_ix_i\right)\le\sum_{i=1}^n\lambda_if(x_i).$$
概率形式：$f(\E X)\le\E f(X)$。

### 证明
对 $n$ 归纳。$n=2$ 是定义。设对 $n-1$ 成立，令 $\mu=1-\lambda_n$，则
$$\sum_{i=1}^n\lambda_ix_i=\mu\sum_{i<n}\frac{\lambda_i}\mu x_i+\lambda_nx_n,$$
先用两点情形，再对括号内用归纳假设。

### 例题
取 $f=-\ln x$（凸）、$\lambda_i=\frac1n$：$-\ln\frac{\sum x_i}n\le-\frac1n\sum\ln x_i$，即 $\frac{\sum x_i}n\ge\sqrt[n]{\prod x_i}$——[[am-gm]] 一行得证。取 $f=x^2$ 得 $\left(\E X\right)^2\le\E X^2$，即方差非负。
