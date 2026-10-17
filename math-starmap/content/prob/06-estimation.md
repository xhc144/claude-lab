---
galaxy: prob
cluster: estimation
title: 参数估计
en: Parameter estimation
order: 6
level: core
---

## 点估计 {#point-estimation}
type: 概念 | en: Point estimation | w: 4 | 考纲: 矩估计, 极大似然估计
前置: population-sample, sample-mean
后续: method-of-moments, mle, unbiased-estimator
alias: 点估计, 估计量, 估计值, 参数

用一个统计量 $\hat\theta=\hat\theta(X_1,\dots,X_n)$ 估计未知参数 $\theta$。估计量是随机变量，代入观测数据得到的数是估计值。评价估计量的标准：无偏性、有效性（方差小）、相合性（样本量趋于无穷时收敛到真值）、均方误差小。

## 矩估计 {#method-of-moments}
type: 方法 | en: Method of moments | w: 4 | 考纲: 矩估计
前置: point-estimation
源于: lln
alias: 矩估计法, 样本矩, 总体矩

用样本矩代替总体矩：总体的 $k$ 阶矩 $\E X^k$ 是参数的函数，令它等于样本的 $k$ 阶矩 $\frac1n\sum X_i^k$，解出参数。依据是大数定律：样本矩收敛到总体矩。

### 例题
- 均匀分布 $U(0,\theta)$：$\E X=\frac\theta2$，令 $\frac{\hat\theta}2=\bar X$，得 $\hat\theta=2\bar X$。
- 正态 $N(\mu,\sigma^2)$：$\hat\mu=\bar X$，$\hat\sigma^2=\frac1n\sum(X_i-\bar X)^2$。

### 注记
矩估计简单直接，但不一定好：$U(0,\theta)$ 的 $2\bar X$ 可能小于样本最大值，显然不合理；极大似然估计 $\max X_i$ 更好（修正为 $\frac{n+1}n\max X_i$ 即无偏且方差更小）。

## 极大似然估计 {#mle}
type: 方法 | en: Maximum likelihood estimation | w: 5 | 考纲: 极大似然估计
前置: point-estimation, joint-distribution, extremum-derivative
用到: lagrange-multiplier
alias: 最大似然估计, 似然函数, 对数似然, MLE

把样本的联合概率（或密度）看作参数的函数，称为似然函数 $L(\theta)=\prod f(x_i;\theta)$。取使 $L$ 最大的 $\hat\theta$ 作为估计：“哪个参数最可能产生我们看到的数据？”通常对 $\ln L$ 求导令其为零。

### 例题
- 伯努利 $B(1,p)$：$\ln L=t\ln p+(n-t)\ln(1-p)$，$t=\sum x_i$，导数为零得 $\hat p=\frac tn$——频率。
- 正态：$\hat\mu=\bar x$，$\hat\sigma^2=\frac1n\sum(x_i-\bar x)^2$（有偏，但相合）。
- $U(0,\theta)$：$L=\theta^{-n}$（$\theta\ge\max x_i$），$\theta$ 越小越大，所以 $\hat\theta=\max x_i$——这里不能求导，要直接分析单调性。

### 性质
在正则条件下，极大似然估计相合、渐近正态，并且渐近方差达到克拉默–拉奥下界（渐近最有效）。它还有不变性：$g(\theta)$ 的 MLE 是 $g(\hat\theta)$。

## 无偏估计 {#unbiased-estimator}
type: 定义 | en: Unbiased estimator | w: 4 | 考纲: 无偏估计
前置: point-estimation, expectation
后续: mse-bias-variance
alias: 无偏性, 有偏估计, 偏差

若 $\E\hat\theta=\theta$ 对一切可能的 $\theta$ 成立，称 $\hat\theta$ 为无偏估计：平均而言不偏高也不偏低。

### 例子
$\bar X$ 是 $\mu$ 的无偏估计；$S^2=\frac1{n-1}\sum(X_i-\bar X)^2$ 是 $\sigma^2$ 的无偏估计，而 $\frac1n\sum(X_i-\bar X)^2$ 是有偏的。最小二乘回归系数是无偏的（[[ols-unbiased]]）。

### 注记
无偏的估计不一定好，有偏的也不一定坏：$S$ 不是 $\sigma$ 的无偏估计（由 [[jensen-inequality]]，$\E S\le\sigma$）。有时稍有偏差但方差小得多的估计反而更好，见 [[mse-bias-variance]]。

## 均方误差与偏差-方差分解 {#mse-bias-variance}
type: 定理 | en: Mean squared error and the bias–variance tradeoff | w: 3 | 考纲: 无偏估计
前置: unbiased-estimator, variance
alias: 均方误差, MSE, 偏差-方差权衡

$$\mathrm{MSE}(\hat\theta)=\E(\hat\theta-\theta)^2=\Var\hat\theta+\left(\E\hat\theta-\theta\right)^2.$$
均方误差 = 方差 + 偏差的平方。

### 证明
$\hat\theta-\theta=(\hat\theta-\E\hat\theta)+(\E\hat\theta-\theta)$，展开平方，交叉项期望为零。

### 例题
估计正态总体的方差：在形如 $c\sum(X_i-\bar X)^2$ 的估计中，均方误差最小的是 $c=\frac1{n+1}$，而不是无偏的 $\frac1{n-1}$。

### 应用
机器学习中的过拟合与欠拟合正是偏差–方差权衡：模型太简单，偏差大；太复杂，方差大。岭回归通过引入偏差来降低方差。

## 置信区间 {#confidence-interval}
type: 方法 | en: Confidence intervals | w: 4 | 考纲: 单样本检验
前置: clt, normal-distribution, point-estimation
后续: hypothesis-test
alias: 区间估计, 置信水平, 误差范围, 95% 置信区间

$\PP(\hat\theta_L\le\theta\le\hat\theta_U)=1-\alpha$ 的随机区间 $[\hat\theta_L,\hat\theta_U]$ 称为置信水平为 $1-\alpha$ 的置信区间。正态总体、$\sigma$ 已知时，$\mu$ 的 $95\%$ 置信区间为
$$\bar X\pm1.96\frac\sigma{\sqrt n}.$$
$\sigma$ 未知时把 $\sigma$ 换成 $S$、把 $1.96$ 换成 $t$ 分布的分位数。

### 正确理解
“$95\%$”说的是方法：反复抽样，每次构造一个区间，约 $95\%$ 的区间会覆盖真值。对于已经算出的某一个具体区间，真值要么在里面要么不在，不能说“真值有 $95\%$ 的概率在这个区间里”（频率学派的解释）。

### 例题
民意调查样本 $n=1000$，支持率 $\hat p=0.52$：误差范围 $1.96\sqrt{\frac{0.52\times0.48}{1000}}\approx3.1\%$，所以常报道“误差 $\pm3$ 个百分点”。
