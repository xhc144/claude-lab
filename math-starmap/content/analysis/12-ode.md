---
galaxy: analysis
cluster: ode
title: 常微分方程初步
en: Ordinary differential equations
order: 12
level: core
---

## 常微分方程 {#ode-basics}
type: 概念 | en: Ordinary differential equation | w: 4 | 考纲: 单变量微积分
前置: derivative, antiderivative
后续: separable-ode, linear-first-order-ode, linear-ode-constant, picard-theorem
alias: 微分方程, 初值问题, 通解, 特解, 方向场

含有未知函数及其导数的方程，如 $y'=f(x,y)$。满足方程的函数是解；含任意常数的解族是通解，由初始条件 $y(x_0)=y_0$ 确定的是特解。

### 直观
$y'=f(x,y)$ 在平面每一点规定了一个斜率，画出来是“方向场”；解曲线就是处处与方向场相切的曲线——像水流中的一根羽毛顺流而下。

### 应用
牛顿第二定律 $m\ddot x=F$ 是二阶微分方程；放射性衰变、人口增长、RC 电路、化学反应速率都由微分方程描述。物理定律大多以微分方程的形式写出。

## 可分离变量方程 {#separable-ode}
type: 方法 | en: Separable equations | w: 3 | 考纲: 单变量微积分
前置: ode-basics, integration-techniques
例子: logistic-equation
alias: 分离变量法, 指数增长, 指数衰减

$\dfrac{\dd y}{\dd x}=g(x)h(y)$ 可写成 $\dfrac{\dd y}{h(y)}=g(x)\,\dd x$，两边积分。

### 例题
$y'=ky$：$\frac{\dd y}y=k\,\dd x$，$\ln\abs y=kx+C$，$y=C\ee^{kx}$。放射性物质质量 $m(t)=m_0\ee^{-\lambda t}$，半衰期 $T=\frac{\ln2}\lambda$。

### 注记
分离时除以 $h(y)$ 可能丢掉 $h(y)=0$ 对应的常数解，需要补上。

## 一阶线性方程 {#linear-first-order-ode}
type: 方法 | en: First-order linear equations | w: 3 | 考纲: 单变量微积分
前置: ode-basics, integration-techniques
应用于: rc-circuit
alias: 常数变易法, 积分因子

$y'+p(x)y=q(x)$。乘积分因子 $\mu=\ee^{\int p\,\dd x}$，左边变成 $(\mu y)'$：
$$y=\ee^{-\int p\,\dd x}\left(\int q\,\ee^{\int p\,\dd x}\dd x+C\right).$$

### 例题
RC 电路充电：$RC\frac{\dd u}{\dd t}+u=E$，$u(0)=0$，解得 $u=E\left(1-\ee^{-t/RC}\right)$。时间常数 $\tau=RC$ 后电压达到 $63\%$。

### 注记
解的结构：通解 = 齐次方程通解 + 非齐次方程的一个特解。这与线性方程组的 [[solution-structure]] 是同一个道理：线性。

## 二阶常系数线性方程 {#linear-ode-constant}
type: 方法 | en: Linear ODEs with constant coefficients | w: 4 | 考纲: 单变量微积分
前置: ode-basics, quadratic-equation
用到: euler-formula
应用于: simple-harmonic-motion, damped-forced-oscillation, lc-oscillation
alias: 特征方程, 齐次线性方程, 欠阻尼, 过阻尼, 临界阻尼

$y''+py'+qy=0$：设 $y=\ee^{\lambda x}$ 得特征方程 $\lambda^2+p\lambda+q=0$。
- 两个不等实根：$y=C_1\ee^{\lambda_1x}+C_2\ee^{\lambda_2x}$；
- 重根：$y=(C_1+C_2x)\ee^{\lambda x}$；
- 共轭复根 $\alpha\pm\beta\ii$：$y=\ee^{\alpha x}(C_1\cos\beta x+C_2\sin\beta x)$（由 [[euler-formula]]）。

### 应用
阻尼振动 $\ddot x+2\gamma\dot x+\omega_0^2x=0$：$\gamma<\omega_0$ 欠阻尼（衰减振荡），$\gamma=\omega_0$ 临界阻尼（最快回到平衡而不振荡，汽车减震器的设计目标），$\gamma>\omega_0$ 过阻尼。

### 注记
$n$ 阶方程同理；方程组 $\vv x'=A\vv x$ 的解是 $\vv x=\ee^{tA}\vv x_0$，特征根就是矩阵 $A$ 的特征值，见 [[matrix-exponential]]。

## 逻辑斯谛方程 {#logistic-equation}
type: 模型 | en: Logistic equation | w: 3 | 考纲: 单变量微积分
前置: separable-ode
相关: logistic-map
alias: Logistic 模型, 种群增长, S 型曲线, 环境容纳量

$$\frac{\dd P}{\dd t}=rP\left(1-\frac PK\right).$$
种群较小时近似指数增长，接近环境容纳量 $K$ 时增长放缓。解为 S 形曲线
$$P(t)=\frac K{1+\left(\frac K{P_0}-1\right)\ee^{-rt}}.$$

### 注记
$P=K/2$ 时增长最快（拐点）。离散化后的逻辑斯谛映射 $x_{n+1}=rx_n(1-x_n)$ 却会出现倍周期分岔与混沌，见 [[logistic-map]]——连续与离散模型的行为可以截然不同。

## 压缩映射原理 {#banach-fixed-point}
type: 定理 | en: Banach fixed-point theorem | w: 4 | 考纲: 单变量微积分, 实数轴的完备性
前置: cauchy-criterion, metric-space
推出: picard-theorem
应用于: fixed-point-iteration, inverse-function-theorem
alias: 巴拿赫不动点定理, 压缩映射, 不动点迭代

完备度量空间上的压缩映射 $T$（存在 $q<1$ 使 $d(Tx,Ty)\le q\,d(x,y)$）有唯一不动点，并且从任意初值出发的迭代 $x_{n+1}=Tx_n$ 都收敛到它，误差 $d(x_n,x^*)\le\frac{q^n}{1-q}d(x_1,x_0)$。

### 证明
$d(x_{n+1},x_n)\le q^nd(x_1,x_0)$，于是对 $m>n$，$d(x_m,x_n)\le\frac{q^n}{1-q}d(x_1,x_0)$，$\{x_n\}$ 是柯西列，由完备性收敛到某个 $x^*$；$T$ 连续，所以 $Tx^*=x^*$。若有两个不动点，$d(x^*,y^*)\le q\,d(x^*,y^*)$ 推出 $d=0$。

### 例题
在计算器上反复按 $\cos$ 键，从任何数出发都会收敛到 $0.739085\cdots$，即 $\cos x=x$ 的唯一解：$\cos$ 把 $[-1,1]$ 映入 $[\cos1,1]\subset[0,1]$，而在 $[0,1]$ 上 $\abs{\cos'x}=\abs{\sin x}\le\sin1<1$，是压缩映射。

## 存在唯一性定理 {#picard-theorem}
type: 定理 | en: Picard–Lindelöf theorem | w: 3 | 考纲: 单变量微积分
源于: banach-fixed-point
前置: ode-basics
alias: 皮卡定理, 皮卡迭代, 利普希茨条件, 解的存在唯一性

若 $f(x,y)$ 在 $(x_0,y_0)$ 附近连续，且关于 $y$ 满足利普希茨条件 $\abs{f(x,y_1)-f(x,y_2)}\le L\abs{y_1-y_2}$，则初值问题 $y'=f(x,y)$，$y(x_0)=y_0$ 在 $x_0$ 附近有唯一解。

### 证明思路
初值问题等价于积分方程 $y(x)=y_0+\int_{x_0}^xf(t,y(t))\,\dd t$。右边定义的算子在足够短的区间上是连续函数空间（一致距离，完备）上的压缩映射。皮卡迭代 $y_{n+1}=y_0+\int f(t,y_n)\,\dd t$ 收敛到解。

### 例题
$y'=y$，$y(0)=1$：皮卡迭代依次得到 $1$，$1+x$，$1+x+\frac{x^2}2$，……正是 $\ee^x$ 的泰勒多项式。

### 注记
没有利普希茨条件可能失去唯一性：$y'=\sqrt{\abs y}$，$y(0)=0$ 既有解 $y\equiv0$，也有解 $y=\frac{x^2}4$（$x\ge0$）。确定性物理定律的“可预测性”在数学上就是这个定理。
