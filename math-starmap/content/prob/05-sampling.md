---
galaxy: prob
cluster: sampling
title: 抽样与描述统计
en: Sampling and descriptive statistics
order: 5
level: hs
---

## 总体与样本 {#population-sample}
type: 概念 | en: Population and sample | w: 4 | 考纲: 简单抽样
前置: random-variable
后续: simple-random-sampling, stratified-sampling, sample-mean, point-estimation
alias: 总体, 个体, 样本, 样本容量, 统计量

统计推断的基本框架：想了解的全体对象叫总体（其某个指标是随机变量 $X$），从中抽取的部分叫样本 $X_1,\dots,X_n$。不含未知参数的样本函数（如样本均值）叫统计量。

### 注记
统计学与概率论方向相反：概率论由已知的模型推出数据的规律，统计学由数据反推未知的模型。样本必须有代表性：1936 年《文学文摘》用电话簿和汽车登记簿抽样 240 万人，错误预测了美国总统选举，因为当时有电话和汽车的人偏富裕。

## 简单随机抽样 {#simple-random-sampling}
type: 方法 | en: Simple random sampling | w: 4 | 考纲: 简单抽样
前置: population-sample, classical-probability
后续: stratified-sampling
alias: 简单随机抽样, 抽签法, 随机数法, 有放回抽样, 无放回抽样

总体中每个大小为 $n$ 的子集被抽中的概率都相等（无放回），从而每个个体被抽中的概率都是 $\frac nN$。实现方式：抽签法、随机数表、计算机随机数。

### 注记
有放回抽样得到独立同分布的样本；无放回时样本略有相关，但 $N\gg n$ 时差别可忽略。系统抽样（每隔 $k$ 个取一个）实施方便，但若总体有周期性会产生偏差。

## 分层抽样 {#stratified-sampling}
type: 方法 | en: Stratified sampling | w: 4 | 考纲: 分层抽样
前置: simple-random-sampling
用到: variance
alias: 分层抽样, 按比例分配, 层

把总体按某个特征分成互不重叠的层，在各层内独立地简单随机抽样，再合并。按比例分配时第 $h$ 层抽 $n\frac{N_h}N$ 个。

### 为什么更好
总体均值的估计 $\bar y_{st}=\sum_h\frac{N_h}N\bar y_h$ 的方差只包含层内方差，不包含层间差异。由方差分解 $\text{总方差}=\text{层内方差}+\text{层间方差}$，当层间差异大、层内同质时，分层抽样比同样容量的简单随机抽样精确得多。

### 例题
某校男生、女生分别有 $600$、$400$ 名，按比例抽取 $50$ 人调查身高：男生抽 $30$ 人，女生抽 $20$ 人。身高的层间差异大，分层能明显减小估计误差。

## 样本均值 {#sample-mean}
type: 定义 | en: Sample mean | w: 4 | 考纲: 样本均值
前置: population-sample, expectation
后续: sample-variance, method-of-moments
alias: 样本均值, 平均数, 算术平均

$\bar X=\frac1n\sum X_i$。若样本独立同分布，$\E\bar X=\mu$（无偏），$\Var\bar X=\frac{\sigma^2}n$，并且由大数定律 $\bar X\to\mu$，由中心极限定理 $\bar X$ 近似服从 $N\left(\mu,\frac{\sigma^2}n\right)$。

### 注记
样本均值是使 $\sum(X_i-c)^2$ 最小的 $c$（最小二乘意义下的“中心”），但它对异常值敏感：一位亿万富翁走进酒吧，酒吧里的人均收入就暴涨。

## 中位数与分位数 {#median-quantiles}
type: 定义 | en: Median and quantiles | w: 4 | 考纲: 中位数
前置: population-sample
后续: boxplot, sign-test
alias: 中位数, 分位数, 四分位数, 百分位数, 众数, 稳健统计

把数据从小到大排列，位于中间的数（偶数个时取中间两数的平均）叫中位数；$p$ 分位数把数据分为 $p$ 与 $1-p$ 两部分。四分位数 $Q_1,Q_2,Q_3$ 把数据四等分。

### 性质
中位数是使 $\sum\abs{X_i-c}$ 最小的 $c$。它是稳健的：改变不到一半的数据（哪怕改成无穷大）都不能使中位数任意变化，而均值只要改一个数就会被带偏。收入、房价这类偏态数据常用中位数报告。

### 例题
数据 $1,2,2,3,4,7,9$：均值 $4$，中位数 $3$，众数 $2$。右偏分布（长尾在右）中通常 均值 $>$ 中位数。

## 箱线图 {#boxplot}
type: 方法 | en: Box plot | w: 3 | 考纲: 箱线图
前置: median-quantiles
alias: 箱线图, 盒须图, 四分位距, 异常值, 五数概括

用五数概括（最小值、$Q_1$、中位数、$Q_3$、最大值）画出数据的分布：箱子从 $Q_1$ 到 $Q_3$，中间一条线是中位数；四分位距 $\mathrm{IQR}=Q_3-Q_1$；超出 $[Q_1-1.5\,\mathrm{IQR},\ Q_3+1.5\,\mathrm{IQR}]$ 的点标为可能的异常值，须线延伸到范围内最远的数据点。

### 用途
一眼看出中心、离散程度、偏斜与异常值，特别适合并排比较几组数据（例如不同班级的成绩）。正态分布中 $1.5\,\mathrm{IQR}$ 的规则约标出 $0.7\%$ 的点。

## 频率分布直方图 {#histogram}
type: 方法 | en: Histogram | w: 3 | 考纲: 数据压缩, 样本均值
前置: population-sample
相关: continuous-rv
alias: 直方图, 频率分布, 组距, 茎叶图

把数据分组，每组画一个矩形，矩形面积等于该组的频率（纵轴为“频率/组距”）。所有矩形面积之和为 $1$，样本量增大、组距变小时直方图逼近总体的密度曲线。

### 注记
用直方图估计平均数：各组中点乘以频率再相加；估计中位数：找使左侧面积为 $0.5$ 的点。组距太宽会掩盖形状，太窄会产生锯齿噪声。

## 样本方差与标准差 {#sample-variance}
type: 定义 | en: Sample variance | w: 4 | 考纲: 无偏估计
前置: sample-mean, variance
后续: unbiased-estimator, t-distribution
alias: 样本方差, 样本标准差, n-1, 贝塞尔校正

$$S^2=\frac1{n-1}\sum_{i=1}^n(X_i-\bar X)^2.$$
除以 $n-1$ 而不是 $n$，是为了使 $\E S^2=\sigma^2$（无偏）。

### 证明
$\sum(X_i-\bar X)^2=\sum(X_i-\mu)^2-n(\bar X-\mu)^2$，取期望：$n\sigma^2-n\cdot\frac{\sigma^2}n=(n-1)\sigma^2$。

### 直观
用 $\bar X$ 代替未知的 $\mu$ 时，数据离 $\bar X$ 比离 $\mu$ 更近（$\bar X$ 正是使平方和最小的点），所以平方和偏小；$n$ 个偏差 $X_i-\bar X$ 满足一个线性约束（和为零），只有 $n-1$ 个自由度。

## 数据压缩 {#data-compression}
type: 思想 | en: Data reduction | w: 3 | 考纲: 数据压缩
前置: sample-mean, sample-variance
相关: svd-low-rank, pca
alias: 数据压缩, 数据约简, 充分统计量, 摘要统计量, 降维

用少数几个统计量概括大量数据而尽量少丢失信息。均值与方差把 $n$ 个数压缩为两个数；对于正态总体，$(\bar X,S^2)$ 是充分统计量——它们保留了样本中关于 $(\mu,\sigma^2)$ 的全部信息，知道它们后，原始数据不能再提供更多关于参数的信息。

### 例题
伯努利试验 $X_1,\dots,X_n$ 中，成功次数 $T=\sum X_i$ 是关于 $p$ 的充分统计量：给定 $T=t$ 时，样本的条件分布是“$t$ 个 $1$ 均匀地分布在 $n$ 个位置上”，与 $p$ 无关——成功出现的顺序不提供关于 $p$ 的信息。

### 更多方法
多维数据用主成分分析或奇异值分解保留方差最大的几个方向（见 [[pca]]、[[svd-low-rank]]）；分组频数表、五数概括、直方图也是数据压缩；信息论中的熵给出无损压缩的极限。
