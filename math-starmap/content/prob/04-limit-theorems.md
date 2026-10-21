---
galaxy: prob
cluster: limit-theorems
title: 随机过程与极限定理
en: Random processes and limit theorems
order: 4
level: core
---

## 随机游走 {#random-walk}
type: 模型 | en: Random walk | w: 5 | 考纲: 随机游走, 简单随机过程
前置: bernoulli-binomial
后续: gambler-ruin, reflection-principle, walk-recurrence
anim: random-walk
alias: 简单随机游走, 醉汉问题, 一维随机游走
tags: 随机过程

每一步独立地以概率 $p$ 向右、$1-p$ 向左走一步：$S_n=X_1+\cdots+X_n$，$X_i=\pm1$。对称情形 $p=\frac12$ 时 $\E S_n=0$，$\Var S_n=n$，典型位移约为 $\sqrt n$。

### 直观
醉汉在街上随机走 $n$ 步，平均位置仍在原点，但离原点的典型距离随 $\sqrt n$ 增长——走一百步大约离开十步远。这是扩散现象的数学本质，布朗运动是它的连续极限。

### 例题
$S_{2n}=0$ 的概率 $\binom{2n}n2^{-2n}\approx\frac1{\sqrt{\pi n}}$（斯特林公式），回到原点的概率随时间缓慢衰减。

## 赌徒破产问题 {#gambler-ruin}
type: 例题 | en: Gambler's ruin | w: 4 | 考纲: 随机游走, 全概率公式, 递推关系
前置: random-walk, total-probability, recurrence-relation
alias: 赌徒输光问题, 吸收壁, 首达概率

赌徒有 $k$ 元，每局以概率 $p$ 赢 $1$ 元、$q=1-p$ 输 $1$ 元，赢到 $N$ 元或输光为止。输光的概率 $r_k$ 满足（对第一局用全概率公式）
$$r_k=pr_{k+1}+qr_{k-1},\qquad r_0=1,\ r_N=0.$$

### 解
$p=\frac12$ 时 $r_k$ 是线性的：$r_k=1-\frac kN$。$p\ne\frac12$ 时，特征根为 $1$ 与 $\frac qp$：
$$r_k=\frac{(q/p)^k-(q/p)^N}{1-(q/p)^N}.$$

### 注记
即使是公平的赌局，面对资金无限的庄家（$N\to\infty$），赌徒终将输光（$r_k\to1$）。在轮盘赌中 $p=\frac{18}{38}$，带着 $100$ 元想赢到 $200$ 元的概率不到万分之一（$\left(\frac{20}{18}\right)^{100}\approx3.8\times10^4$）。

## 反射原理 {#reflection-principle}
type: 方法 | en: Reflection principle | w: 3 | 考纲: 随机游走
前置: random-walk, combination
推出: catalan
alias: 反射原理, 选票问题, 格路计数

从 $A$ 到 $B$（都在 $x$ 轴上方）且碰到 $x$ 轴的格路数，等于从 $A$ 关于 $x$ 轴的对称点 $A'$ 到 $B$ 的格路数：把第一次碰到 $x$ 轴之前的部分反射，就得到一一对应。

### 例题（选票问题）
候选人甲得 $a$ 票、乙得 $b$ 票（$a>b$），随机唱票时甲始终领先的概率为 $\frac{a-b}{a+b}$。

### 注记
反射原理同样适用于布朗运动：$\PP\left(\max_{s\le t}B_s\ge a\right)=2\PP(B_t\ge a)$。

## 随机游走的常返性 {#walk-recurrence}
type: 定理 | en: Recurrence of random walks | w: 3 | 考纲: 随机游走
前置: random-walk, series
alias: 波利亚定理, 常返, 暂留, 醉汉能回家醉鸟不能

对称简单随机游走在一维、二维中以概率 $1$ 回到原点（常返），在三维及以上以正概率永不回来（暂留）。波利亚（1921）：“醉汉总能找到回家的路，醉鸟却可能永远迷失。”

### 证明思路
回到原点的期望次数 $\sum_n\PP(S_{2n}=0)$：一维约 $\sum\frac1{\sqrt n}=\infty$，二维约 $\sum\frac1n=\infty$，三维约 $\sum\frac1{n^{3/2}}<\infty$。期望回访次数无穷 $\iff$ 常返（回访次数服从几何分布）。三维中回到原点的概率约为 $0.34$。

## 马尔可夫链 {#markov-chain}
type: 模型 | en: Markov chains | w: 4 | 考纲: 简单随机过程
前置: conditional-probability, matrix-multiplication
用到: matrix-powers
后续: pagerank
alias: 马尔可夫链, 转移矩阵, 平稳分布, 无记忆过程

状态随时间随机变化，且下一步只依赖当前状态（马尔可夫性）。转移矩阵 $P=(p_{ij})$，$p_{ij}=\PP(X_{n+1}=j\mid X_n=i)$，各行和为 $1$；$n$ 步转移矩阵为 $P^n$。分布 $\pi$ 满足 $\pi P=\pi$ 时称为平稳分布。

### 定理
有限状态、不可约（任意两状态可互达）且非周期的马尔可夫链有唯一平稳分布，且从任何初始分布出发，$n$ 步后的分布都收敛到它。

### 例题
天气：晴后晴的概率 $0.9$、晴后雨 $0.1$；雨后晴 $0.5$、雨后雨 $0.5$。由 $\pi P=\pi$ 得长期晴天比例 $\pi_{\text{晴}}=\frac56$。

### 应用
网页排名 PageRank、语言模型、排队论、马尔可夫链蒙特卡罗（MCMC）采样。

## 切比雪夫不等式 {#chebyshev-inequality}
type: 不等式 | en: Markov and Chebyshev inequalities | w: 4 | 考纲: 简单版本的大数定律, 方差
前置: variance
推出: lln
alias: 切比雪夫不等式, 马尔可夫不等式, 尾概率估计

马尔可夫不等式：$X\ge0$ 时 $\PP(X\ge a)\le\frac{\E X}a$。
切比雪夫不等式：$\PP(\abs{X-\E X}\ge\eps)\le\frac{\Var X}{\eps^2}$。

### 证明
$a\mathbf 1_{\{X\ge a\}}\le X$，取期望即得马尔可夫不等式。对 $(X-\E X)^2$ 用马尔可夫不等式即得切比雪夫不等式。

### 注记
它对任何分布都成立，因而往往很粗：对正态分布，$\PP(\abs{X-\mu}\ge2\sigma)$ 实际约 $4.6\%$，切比雪夫只给出 $\le25\%$。它的价值在于普遍性——这正是证明大数定律所需要的。

## 大数定律 {#lln}
type: 定理 | en: Law of large numbers | w: 5 | 考纲: 简单版本的大数定律
源于: chebyshev-inequality
前置: variance, independence
后续: clt, monte-carlo
anim: lln
alias: 弱大数定律, 伯努利大数定律, 频率稳定性, 平均值收敛

（弱大数定律）$X_1,X_2,\dots$ 独立同分布，$\E X_i=\mu$，$\Var X_i=\sigma^2<\infty$，则样本均值 $\bar X_n$ 依概率收敛于 $\mu$：对任意 $\eps>0$，
$$\PP\left(\abs{\bar X_n-\mu}\ge\eps\right)\to0.$$
伯努利特例：事件发生的频率依概率收敛于其概率。

### 证明
$\E\bar X_n=\mu$，$\Var\bar X_n=\frac{\sigma^2}n$，由切比雪夫不等式 $\PP(\abs{\bar X_n-\mu}\ge\eps)\le\frac{\sigma^2}{n\eps^2}\to0$。

### 注记
它是“概率 = 长期频率”的数学依据，也是统计估计与蒙特卡罗方法的基础。强大数定律断言 $\bar X_n\to\mu$ 几乎必然成立（只需期望存在）。大数定律不意味着“偏差会被补回来”：前面多出的正面不会被后面的反面抵消，只是被越来越多的试验稀释。

## 中心极限定理 {#clt}
type: 定理 | en: Central limit theorem | w: 5 | 考纲: 简单版本的中心极限定理
源于: lln
前置: normal-distribution
特例: de-moivre-laplace
后续: one-sample-test, confidence-interval
anim: clt
alias: 中心极限定理, CLT, 林德伯格-莱维定理, 正态近似

$X_1,X_2,\dots$ 独立同分布，均值 $\mu$，方差 $\sigma^2\in(0,\infty)$，则标准化的和依分布收敛到标准正态：
$$\frac{X_1+\cdots+X_n-n\mu}{\sigma\sqrt n}\xrightarrow{d}N(0,1),$$
即 $\PP\left(\frac{S_n-n\mu}{\sigma\sqrt n}\le x\right)\to\Phi(x)$ 对每个 $x$ 成立。

### 直观
不管单个变量是什么分布（骰子、硬币、指数等待时间……），许多个加在一起，形状都会变成钟形。大数定律说平均值会集中到 $\mu$；中心极限定理进一步说偏差的尺度是 $\frac\sigma{\sqrt n}$，并且偏差的形状是正态的。

### 证明思路
用特征函数 $\varphi(t)=\E\ee^{\ii tX}$：标准化后单个变量的特征函数为 $1-\frac{t^2}{2n}+o\left(\frac1n\right)$，$n$ 个独立变量之和的特征函数是它的 $n$ 次幂，趋于 $\ee^{-t^2/2}$——正好是 $N(0,1)$ 的特征函数；再由列维连续性定理得到分布收敛。

### 应用
抽样调查的误差范围、置信区间、假设检验中的 $z$ 统计量；用正态分布近似二项分布与泊松分布。

## 棣莫弗-拉普拉斯定理 {#de-moivre-laplace}
type: 定理 | en: De Moivre–Laplace theorem | w: 4 | 考纲: 简单版本的中心极限定理, 正态分布
源于: stirling-formula
前置: bernoulli-binomial, normal-distribution
例子: galton-board
alias: 二项分布的正态近似, 局部极限定理

$X\sim B(n,p)$，$n$ 很大时
$$\PP(a\le X\le b)\approx\Phi\left(\frac{b+\frac12-np}{\sqrt{np(1-p)}}\right)-\Phi\left(\frac{a-\frac12-np}{\sqrt{np(1-p)}}\right).$$
这是中心极限定理最早的版本（棣莫弗 1733 年对 $p=\frac12$，拉普拉斯 1812 年推广）。

### 推导思路
用斯特林公式直接估计 $\binom nkp^k(1-p)^{n-k}$，在 $k=np+x\sqrt{np(1-p)}$ 处取对数并作二阶泰勒展开，得到 $\frac1{\sqrt{2\pi np(1-p)}}\ee^{-x^2/2}$。

### 例题
掷硬币 $10000$ 次，正面数在 $4900$ 到 $5100$ 之间的概率：$\sigma=50$，区间为 $\pm2\sigma$，约 $95.4\%$。

## 高尔顿板 {#galton-board}
type: 实验 | en: Galton board | w: 3 | 考纲: 简单版本的中心极限定理
是例子: bernoulli-binomial
anim: galton
alias: 高尔顿钉板, 梅花桩, 二项分布的演示

小球从顶部落下，每碰到一颗钉子等可能地向左或向右，经过 $n$ 排钉子后落入底部的槽中。落入第 $k$ 个槽的概率为 $\binom nk2^{-n}$，大量小球堆出钟形曲线。

### 注记
高尔顿（1873）用它演示“大量独立小偏差的累积产生正态分布”。动画中可以改变排数与偏向概率 $p$，观察二项分布怎样逼近正态曲线。

## 蒙特卡罗方法 {#monte-carlo}
type: 方法 | en: Monte Carlo method | w: 4 | level: ext
前置: lln, clt
应用于: monte-carlo-integration
alias: 蒙特卡罗, 随机模拟, 随机采样

用随机采样估计确定的量：$\int_Df\approx\frac{\abs D}N\sum f(\vv x_i)$，$\vv x_i$ 在 $D$ 中均匀随机。由大数定律估计收敛，由中心极限定理误差约为 $\frac\sigma{\sqrt N}$——与维数无关。

### 例题
在单位正方形中随机撒 $N$ 个点，落在四分之一圆内的比例乘以 $4$ 估计 $\pi$。要多得一位有效数字，点数要增加到 $100$ 倍。

### 注记
误差 $O(N^{-1/2})$ 收敛慢，但不受维数诅咒：高维积分（统计物理、金融衍生品定价）几乎只能用蒙特卡罗。名字来自摩纳哥的赌场，由乌拉姆与冯·诺伊曼在曼哈顿计划中命名。

## 概率方法 {#probabilistic-method}
type: 方法 | en: The probabilistic method | w: 3 | level: ext
前置: linearity-of-expectation, probability-axioms
相关: ramsey-theory
alias: 概率方法, 随机构造, 埃尔德什

要证明某种组合对象存在，只需证明随机构造的对象以正概率具有所需性质。

### 例题
（埃尔德什，1947）$R(k,k)>2^{k/2}$（$k\ge3$）：把 $K_n$ 的每条边随机涂红或蓝。某个 $k$ 元顶点集单色的概率是 $2^{1-\binom k2}$，有 $\binom nk$ 个这样的集合。若 $\binom nk2^{1-\binom k2}<1$，则以正概率没有单色 $K_k$，所以存在这样的着色。$n=\lfloor2^{k/2}\rfloor$ 时条件成立。

### 期望论证
任何随机变量都以正概率不小于它的期望：例如每个图都有一个二部子图，至少包含一半的边（随机把顶点分成两组，每条边跨组的概率为 $\frac12$）。
