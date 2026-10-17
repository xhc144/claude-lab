---
galaxy: applied
cluster: errors
title: 近似计算与误差
en: Approximation and error
order: 0
level: core
---

## 误差与有效数字 {#error-types}
type: 概念 | en: Errors and significant digits | w: 5 | 考纲: 误差思想, 近似计算
后续: error-propagation, floating-point, condition-number
alias: 绝对误差, 相对误差, 有效数字, 截断误差, 舍入误差, 模型误差
tags: 数值分析

近似值 $x^*$ 的绝对误差 $e=x^*-x$，相对误差 $\frac e x$。若 $\abs e\le\frac12\times10^{-k}$，称 $x^*$ 精确到小数点后第 $k$ 位；有效数字是从第一个非零数字起到精确位为止的数字。

### 误差的来源
- **模型误差**：数学模型对现实的简化（忽略空气阻力）；
- **观测误差**：测量数据本身不精确；
- **截断误差**：用有限过程代替无限过程（泰勒级数截断、用差商代替导数）；
- **舍入误差**：计算机只能存储有限位数。

### 注记
数值分析的核心任务是：设计截断误差小的算法，并保证舍入误差不被放大。两种误差常常此消彼长：数值微分的步长 $h$ 越小截断误差越小，舍入误差却越大（[[finite-difference]]）。

## 近似计算 {#approximate-computation}
type: 思想 | en: Approximate computation | w: 4 | 考纲: 近似计算
前置: error-types, taylor-theorem
后续: newton-method, trapezoid-rule
alias: 近似计算, 线性化, 逐次逼近, 迭代思想

几乎所有实际计算都是近似的：用多项式近似函数、用有限和近似积分、用迭代逐步逼近方程的解。好的近似方法要回答三个问题：怎样构造近似？误差多大？代价多少？

### 例题
- 线性化：$\sqrt{1+x}\approx1+\frac x2$，$\sin x\approx x$（单摆小角近似），$\ln(1+x)\approx x$。
- 巴比伦人求 $\sqrt2$：$x_{k+1}=\frac12\left(x_k+\frac2{x_k}\right)$，从 $x_0=1$ 出发，$1.5,1.41\dot6,1.414215\dots$，每一步有效数字约翻倍——它正是牛顿法。
- 祖冲之用割圆术得 $3.1415926<\pi<3.1415927$，并给出密率 $\frac{355}{113}$。

## 浮点数与机器精度 {#floating-point}
type: 概念 | en: Floating-point arithmetic | w: 4 | 考纲: 误差思想
前置: error-types
后续: catastrophic-cancellation, numerical-stability
alias: 浮点数, 机器精度, IEEE 754, 双精度, 舍入, 上溢, 下溢

计算机用 $\pm m\times2^e$ 表示实数，双精度（IEEE 754）尾数 $53$ 位，机器精度 $\eps_{\text{mach}}=2^{-53}\approx1.1\times10^{-16}$：每次运算的结果是真值的 $(1+\delta)$ 倍，$\abs\delta\le\eps_{\text{mach}}$。

### 怪现象
- $0.1+0.2\ne0.3$：$0.1$ 在二进制中是无限循环小数，只能近似存储；
- 加法不满足结合律：$(10^{16}+1)-10^{16}=0$，而 $10^{16}+(1-10^{16})=1$；
- 范围有限：上溢得到无穷大，下溢得到零。

### 注记
1996 年阿丽亚娜 5 型火箭首飞爆炸，原因是把 64 位浮点数转换为 16 位整数时溢出。

## 误差传播 {#error-propagation}
type: 公式 | en: Propagation of errors | w: 4 | 考纲: 误差思想, 误差
前置: error-types, total-differential
后续: condition-number
alias: 误差传递, 函数的误差估计, 相对误差的传播

若 $y=f(x_1,\dots,x_n)$，各 $x_i$ 的误差为 $\Delta x_i$，则由全微分
$$\Delta y\approx\sum_i\frac{\partial f}{\partial x_i}\Delta x_i,\qquad\abs{\Delta y}\lesssim\sum_i\abs{\frac{\partial f}{\partial x_i}}\abs{\Delta x_i}.$$
若误差独立随机，标准差按平方和合成：$\sigma_y^2\approx\sum\left(\frac{\partial f}{\partial x_i}\right)^2\sigma_i^2$。

### 规律
加减法时绝对误差相加，乘除法时相对误差相加，乘方时相对误差乘以指数：$y=x^n$ 时 $\frac{\Delta y}y\approx n\frac{\Delta x}x$。

### 例题
测得圆的半径 $r=10.0\pm0.1$ cm，面积 $S=\pi r^2$ 的相对误差约 $2\times1\%=2\%$，$S\approx314\pm6$ cm²。

## 相消误差 {#catastrophic-cancellation}
type: 现象 | en: Catastrophic cancellation | w: 3 | 考纲: 误差思想, 近似计算
前置: floating-point
alias: 相近数相减, 大数吃小数, 有效数字损失

两个相近的数相减，有效数字大量丢失：$1.234567-1.234561=0.000006$，只剩一位有效数字。

### 例题
求 $x^2-10^8x+1=0$ 的小根：公式 $\frac{10^8-\sqrt{10^{16}-4}}2$ 中两个几乎相等的数相减，双精度下误差很大。改用韦达定理 $x_2=\frac{1}{x_1}$，或改写为 $\frac{2}{10^8+\sqrt{10^{16}-4}}\approx10^{-8}$。
类似地，$\sqrt{x+1}-\sqrt x=\frac1{\sqrt{x+1}+\sqrt x}$，$1-\cos x=2\sin^2\frac x2$，都是用代数变形避免相消。

## 条件数 {#condition-number}
type: 概念 | en: Condition number | w: 4 | 考纲: 误差思想, 线性方程组的直接法
前置: error-propagation, matrix-norms
后续: numerical-stability
alias: 条件数, 病态问题, 良态问题, 希尔伯特矩阵

条件数衡量问题本身对输入扰动的敏感度：输出的相对误差 $\approx$ 条件数 $\times$ 输入的相对误差。函数求值的条件数 $\kappa=\abs{\frac{xf'(x)}{f(x)}}$；线性方程组 $A\vv x=\vv b$ 的条件数
$$\kappa(A)=\norm A\norm{A^{-1}},\qquad\frac{\norm{\Delta\vv x}}{\norm{\vv x}}\le\kappa(A)\frac{\norm{\Delta\vv b}}{\norm{\vv b}}.$$
用二范数时 $\kappa(A)=\frac{\sigma_{\max}}{\sigma_{\min}}$。

### 例题
希尔伯特矩阵 $H_{ij}=\frac1{i+j-1}$ 极度病态：$n=10$ 时 $\kappa\approx1.6\times10^{13}$，用双精度求解只能保证约 $3$ 位有效数字。

### 注记
条件数是问题的性质，与算法无关；病态问题用任何算法都难以精确求解。经验法则：结果大约损失 $\log_{10}\kappa$ 位有效数字。

## 数值稳定性 {#numerical-stability}
type: 概念 | en: Numerical stability | w: 4 | 考纲: 误差思想
前置: condition-number, floating-point
后续: pivoting
alias: 算法稳定性, 后向稳定, 误差放大, 不稳定递推

算法稳定：舍入误差在计算过程中不被放大。后向稳定：计算结果是某个与原问题非常接近的问题的精确解。“良态问题 + 稳定算法 = 精确结果”。

### 例题
计算 $I_n=\int_0^1\frac{x^n}{x+5}\dd x$。递推 $I_n=\frac1n-5I_{n-1}$ 向前算时，$I_0$ 的舍入误差每步乘以 $-5$，算到 $n=20$ 误差放大约 $5^{20}\approx10^{14}$ 倍，结果毫无意义；改为向后递推 $I_{n-1}=\frac15\left(\frac1n-I_n\right)$，误差每步缩小为 $\frac15$，从粗略的初值出发也能得到精确结果。

### 注记
高斯消元不选主元可能不稳定（[[pivoting]]）；经典施密特正交化不稳定，豪斯霍尔德变换稳定。
