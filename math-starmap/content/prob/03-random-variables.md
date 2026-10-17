---
galaxy: prob
cluster: random-variables
title: 随机变量与分布
en: Random variables and distributions
order: 3
level: core
---

## 随机变量 {#random-variable}
type: 定义 | en: Random variable | w: 5 | 考纲: 离散随机变量
前置: probability-axioms, function
后续: discrete-distribution, expectation, continuous-rv
alias: 随机变量, 分布函数

随机变量是定义在样本空间上的实值函数 $X:\Omega\to\R$，把随机结果数值化。分布函数 $F(x)=\PP(X\le x)$ 单调不减、右连续，$F(-\infty)=0$，$F(+\infty)=1$。

### 注记
“随机变量”既不随机也不是变量：它是一个确定的函数，随机性来自自变量 $\omega$ 的选取。把事件写成 $\{X=k\}$、$\{X\le x\}$ 的形式，就能用函数的语言研究随机现象。

## 离散型分布列 {#discrete-distribution}
type: 定义 | en: Discrete distributions | w: 4 | 考纲: 离散随机变量
前置: random-variable
后续: bernoulli-binomial, hypergeometric, geometric-distribution, poisson-distribution
alias: 分布列, 概率质量函数, 两点分布

取值有限或可列的随机变量，由分布列 $p_k=\PP(X=x_k)$ 描述，$p_k\ge0$，$\sum p_k=1$。

### 例题
掷两枚骰子点数之和 $X$ 的分布：$\PP(X=k)=\frac{6-\abs{k-7}}{36}$，$k=2,\dots,12$，在 $7$ 处最大。

## 二项分布 {#bernoulli-binomial}
type: 模型 | en: Bernoulli and binomial distributions | w: 5 | 考纲: 离散随机变量, 典型概率模型
前置: discrete-distribution, independence, binomial-theorem
后续: poisson-distribution, de-moivre-laplace
anim: galton
alias: 二项分布, 伯努利试验, n 重伯努利试验, B(n,p), 两点分布

$n$ 次独立重复试验，每次成功概率 $p$，成功次数 $X\sim B(n,p)$：
$$\PP(X=k)=\binom nkp^k(1-p)^{n-k},\qquad\E X=np,\qquad\Var X=np(1-p).$$

### 推导
特定的 $k$ 次成功、$n-k$ 次失败的序列概率为 $p^k(1-p)^{n-k}$，这样的序列有 $\binom nk$ 个。期望与方差：$X$ 是 $n$ 个独立的两点分布之和，$\E X=\sum p$，$\Var X=\sum p(1-p)$。

### 注记
最可能的成功次数在 $(n+1)p$ 附近（取整）。$n$ 大时二项分布近似正态分布（[[de-moivre-laplace]]），$n$ 大、$p$ 小而 $np$ 适中时近似泊松分布。

## 超几何分布 {#hypergeometric}
type: 模型 | en: Hypergeometric distribution | w: 4 | 考纲: 离散随机变量, 典型概率模型
前置: discrete-distribution, combination
相关: bernoulli-binomial
alias: 超几何分布, 无放回抽样, 抽检

$N$ 件产品中有 $M$ 件次品，无放回抽取 $n$ 件，次品数 $X$：
$$\PP(X=k)=\frac{\binom Mk\binom{N-M}{n-k}}{\binom Nn},\qquad\E X=n\frac MN.$$

### 注记
期望与有放回（二项分布 $B(n,\frac MN)$）相同；方差多了有限总体修正因子：$\Var X=n\frac MN\left(1-\frac MN\right)\frac{N-n}{N-1}$。$N$ 远大于 $n$ 时二者几乎一样。

## 几何分布 {#geometric-distribution}
type: 模型 | en: Geometric distribution | w: 3 | 考纲: 离散随机变量
前置: discrete-distribution, geometric-series
alias: 几何分布, 首次成功, 无记忆性, 等待时间

独立重复试验中首次成功所需的次数 $X$：$\PP(X=k)=(1-p)^{k-1}p$，$\E X=\frac1p$，$\Var X=\frac{1-p}{p^2}$。

### 无记忆性
$\PP(X>m+n\mid X>m)=\PP(X>n)$：已经失败了 $m$ 次，并不使接下来更容易成功。它是唯一具有无记忆性的离散分布（连续情形是指数分布）。

### 例题
**优惠券收集**：集齐 $n$ 种卡片（每次随机得一种）平均要买 $n\left(1+\frac12+\cdots+\frac1n\right)\approx n\ln n$ 次。已集 $k$ 种时，得到新卡的等待次数服从参数 $\frac{n-k}n$ 的几何分布，期望 $\frac n{n-k}$，再由期望的线性性求和。

## 泊松分布 {#poisson-distribution}
type: 模型 | en: Poisson distribution | w: 4 | 考纲: 离散随机变量
前置: discrete-distribution, number-e
源于: bernoulli-binomial
alias: 泊松分布, 稀有事件, 泊松逼近, 泊松过程

$$\PP(X=k)=\frac{\lambda^k\ee^{-\lambda}}{k!},\qquad\E X=\Var X=\lambda.$$
描述大量独立的稀有事件的发生次数：一小时内的来电数、一页书的错字数、放射源一秒内的衰变数。

### 推导（泊松逼近）
$B(n,p)$ 中令 $n\to\infty$，$np=\lambda$ 固定：
$$\binom nk\left(\frac\lambda n\right)^k\left(1-\frac\lambda n\right)^{n-k}=\frac{\lambda^k}{k!}\cdot\frac{n(n-1)\cdots(n-k+1)}{n^k}\left(1-\frac\lambda n\right)^{n-k}\to\frac{\lambda^k}{k!}\ee^{-\lambda}.$$

### 注记
普鲁士骑兵每年被马踢死的人数（博特凯维奇，1898）是经典的泊松数据。

## 数学期望 {#expectation}
type: 定义 | en: Expectation | w: 5 | 考纲: 数学期望
前置: discrete-distribution
后续: linearity-of-expectation, variance
alias: 期望, 均值, 数学期望, 加权平均

$\E X=\sum_kx_k\PP(X=x_k)$（级数绝对收敛时），是按概率加权的平均值，大量重复时样本平均趋于它（[[lln]]）。函数的期望 $\E g(X)=\sum g(x_k)p_k$，不必先求 $g(X)$ 的分布。

### 例题
赌一个公平骰子，掷出 $k$ 点得 $k$ 元，期望收益 $3.5$ 元。圣彼得堡悖论：连续抛硬币直到正面，若第 $n$ 次出现正面得 $2^n$ 元，期望 $\sum\frac1{2^n}2^n=\infty$，但没有人愿意付很多钱玩这个游戏——这引出了期望效用理论。

### 注记
期望不一定存在：柯西分布没有期望。期望不一定是可能取到的值（骰子的 $3.5$）。

## 期望的线性性与指示变量 {#linearity-of-expectation}
type: 定理 | en: Linearity of expectation | w: 5 | 考纲: 数学期望
前置: expectation
后续: variance
应用于: probabilistic-method
alias: 期望的线性性, 指示随机变量, 示性函数法

$\E(aX+bY)=a\E X+b\E Y$，**无论 $X,Y$ 是否独立**。把复杂的计数随机变量拆成指示变量之和 $X=\sum\mathbf 1_{A_i}$，则 $\E X=\sum\PP(A_i)$。

### 例题
- $n$ 人随机拿帽子，拿对自己帽子的平均人数：$X=\sum\mathbf 1_{\{i\text{ 拿对}\}}$，$\E X=n\cdot\frac1n=1$，与 $n$ 无关。尽管各事件不独立，线性性照样成立。
- 随机排列中“比左右邻居都大的位置”的期望个数：内部位置各 $\frac13$，两端各 $\frac12$，共 $\frac{n-2}3+1=\frac{n+1}3$。

## 方差 {#variance}
type: 定义 | en: Variance | w: 5 | 考纲: 方差
前置: expectation
后续: covariance, chebyshev-inequality
alias: 方差, 标准差, Var, 离散程度

$\Var X=\E(X-\E X)^2=\E X^2-(\E X)^2$，标准差 $\sigma=\sqrt{\Var X}$。它衡量随机变量偏离均值的程度。

### 性质
$\Var(aX+b)=a^2\Var X$；$X,Y$ 独立（或不相关）时 $\Var(X+Y)=\Var X+\Var Y$；一般地 $\Var(X+Y)=\Var X+\Var Y+2\Cov(X,Y)$。

### 例题
$n$ 次独立测量的平均值 $\bar X$ 的方差是单次的 $\frac1n$：$\Var\bar X=\frac{\sigma^2}n$，标准差缩小为 $\frac\sigma{\sqrt n}$——要把误差减半，测量次数要变成四倍。

## 协方差与相关系数 {#covariance}
type: 定义 | en: Covariance and correlation | w: 4 | 考纲: 方差, 一元线性回归
前置: variance
用到: cauchy-schwarz
后续: correlation-coefficient
alias: 协方差, 相关系数, 不相关, 协方差矩阵

$\Cov(X,Y)=\E[(X-\E X)(Y-\E Y)]=\E XY-\E X\E Y$，相关系数 $\rho=\frac{\Cov(X,Y)}{\sigma_X\sigma_Y}\in[-1,1]$；$\abs\rho=1\iff Y$ 是 $X$ 的线性函数（几乎必然）。

### 注记
独立 $\Rightarrow$ 不相关，反之不然：$X$ 在 $\{-1,0,1\}$ 上均匀，$Y=X^2$，则 $\Cov(X,Y)=\E X^3=0$，但 $Y$ 完全由 $X$ 决定。相关系数只度量线性关系。随机向量的协方差矩阵对称半正定。

## 连续型随机变量 {#continuous-rv}
type: 定义 | en: Continuous random variables | w: 4 | 考纲: 正态分布
前置: random-variable, improper-integral
后续: normal-distribution, exponential-distribution
alias: 概率密度, 密度函数, 均匀分布, 连续分布

若存在 $f\ge0$ 使 $\PP(a<X\le b)=\int_a^bf(x)\,\dd x$，称 $X$ 为连续型，$f$ 为概率密度。$\E X=\int xf(x)\,\dd x$。单点的概率为零：$\PP(X=a)=0$，所以“概率为零的事件也可能发生”。

### 例子
$[a,b]$ 上的均匀分布 $f=\frac1{b-a}$；指数分布 $f=\lambda\ee^{-\lambda x}$（$x\ge0$）；正态分布。

## 指数分布 {#exponential-distribution}
type: 模型 | en: Exponential distribution | w: 3 | 考纲: 简单随机过程
前置: continuous-rv
相关: geometric-distribution, radioactivity
alias: 指数分布, 寿命分布, 等待时间, 无记忆

密度 $f(x)=\lambda\ee^{-\lambda x}$（$x\ge0$），$\E X=\frac1\lambda$，$\Var X=\frac1{\lambda^2}$。它是连续情形唯一的无记忆分布：$\PP(X>s+t\mid X>s)=\PP(X>t)$。

### 应用
原子的衰变时间（半衰期 $=\frac{\ln2}\lambda$）、泊松过程中相邻事件的间隔、无老化元件的寿命。指数分布是几何分布的连续极限。

## 正态分布 {#normal-distribution}
type: 模型 | en: Normal distribution | w: 5 | 考纲: 正态分布
前置: continuous-rv, gaussian-integral
后续: clt, one-sample-test
anim: clt
alias: 高斯分布, 钟形曲线, N(μ,σ²), 3σ 原则, 标准正态分布
tags: 正态

密度
$$f(x)=\frac1{\sqrt{2\pi}\sigma}\ee^{-\frac{(x-\mu)^2}{2\sigma^2}},$$
记 $X\sim N(\mu,\sigma^2)$；$\E X=\mu$，$\Var X=\sigma^2$。标准化 $Z=\frac{X-\mu}\sigma\sim N(0,1)$。

### 性质
- 关于 $x=\mu$ 对称，拐点在 $\mu\pm\sigma$；
- $3\sigma$ 原则：$\PP(\abs{X-\mu}<\sigma)\approx68.3\%$，$<2\sigma$ 约 $95.4\%$，$<3\sigma$ 约 $99.7\%$；
- 独立正态变量的线性组合仍是正态的。

### 为什么到处都是正态
由 [[clt]]，大量独立小因素之和近似正态：测量误差、身高、考试成绩的分布都近似钟形。归一化常数来自高斯积分 $\int\ee^{-x^2/2}\dd x=\sqrt{2\pi}$。

## 联合分布与独立随机变量 {#joint-distribution}
type: 定义 | en: Joint distributions | w: 3 | 考纲: 离散随机变量
前置: discrete-distribution, independence
后续: covariance
alias: 联合分布, 边缘分布, 随机变量的独立性, 卷积公式

$(X,Y)$ 的联合分布 $\PP(X=x_i,Y=y_j)=p_{ij}$；边缘分布 $p_{i\cdot}=\sum_jp_{ij}$。$X,Y$ 独立 $\iff p_{ij}=p_{i\cdot}p_{\cdot j}$ 对一切 $i,j$ 成立。独立时 $\E XY=\E X\E Y$。

### 例题
和的分布是卷积：$\PP(X+Y=n)=\sum_k\PP(X=k)\PP(Y=n-k)$。两个独立泊松变量之和仍是泊松变量：$P(\lambda_1)+P(\lambda_2)=P(\lambda_1+\lambda_2)$；两个独立的 $B(n,p)$、$B(m,p)$ 之和是 $B(n+m,p)$（由范德蒙恒等式）。
