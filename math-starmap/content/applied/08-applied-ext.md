---
galaxy: applied
cluster: applied-ext
title: 计算与数据科学拓展
en: Computing and data science
order: 8
level: ext
---

## 快速傅里叶变换 {#fft}
type: 算法 | en: Fast Fourier transform | w: 4 | level: ext
前置: roots-of-unity, fourier-transform
相关: regular-representation
alias: FFT, 离散傅里叶变换, DFT, 库利-图基算法

离散傅里叶变换 $\hat x_k=\sum_{j=0}^{n-1}x_j\omega^{-jk}$（$\omega=\ee^{2\pi\ii/n}$）直接计算需要 $O(n^2)$ 次乘法。当 $n=2^m$ 时，把下标按奇偶分开：
$$\hat x_k=E_k+\omega^{-k}O_k,\qquad\hat x_{k+n/2}=E_k-\omega^{-k}O_k,$$
$E,O$ 分别是偶数项、奇数项的 $\frac n2$ 点变换（因为 $\omega^2$ 是 $\frac n2$ 次单位根）。递归下去，总代价 $O(n\log n)$。

### 意义
$n=10^6$ 时从约 $10^{12}$ 次运算降到约 $2\times10^7$ 次。库利与图基 1965 年的论文开启了数字信号处理的时代（高斯在 1805 年已有类似想法）。

### 应用
音频与图像压缩（JPEG 用余弦变换）、通信（OFDM）、多项式与大整数乘法（卷积定理：先变换、逐点相乘、再逆变换）、求解周期边界的偏微分方程。

## 神经网络与反向传播 {#neural-network}
type: 模型 | en: Neural networks and backpropagation | w: 3 | level: ext
前置: multivar-chain-rule, matrix-multiplication
用到: stochastic-gradient
alias: 神经网络, 反向传播, 深度学习, 激活函数, 万能逼近定理

前馈神经网络是线性映射与非线性激活函数的交替复合：$\vv h_{l+1}=\sigma(W_l\vv h_l+\vv b_l)$。训练就是用（随机）梯度下降最小化损失函数，梯度由反向传播计算——它就是多元链式法则按“从输出到输入”的顺序系统地应用，复用中间结果，使得计算全部梯度的代价与一次前向计算同阶。

### 万能逼近定理
只要隐藏层足够宽，单隐层网络（非多项式的激活函数）可以在紧集上一致逼近任何连续函数——这是 [[weierstrass-approximation]] 的神经网络版本。

### 注记
深度学习的成功依赖三件事：大量数据、可以高效求梯度的模型（反向传播）、大规模并行计算（矩阵乘法）。为什么过参数化的网络还能泛化良好，至今仍是活跃的理论问题。

## 纳什均衡 {#nash-equilibrium}
type: 定理 | en: Nash equilibrium | w: 3 | level: ext
源于: brouwer-fixed-point
前置: expectation
相关: lp-duality
alias: 博弈论, 纳什均衡, 混合策略, 囚徒困境, 极小极大定理

在多人博弈中，若每个参与者的策略都是对其他人策略的最优反应，就构成纳什均衡：没有人能单方面改变策略而获益。纳什（1950）证明：任何有限博弈都存在（混合策略的）纳什均衡。

### 证明思路
把“每个人改向更优的策略”定义为混合策略组合空间（凸紧集：单纯形的乘积）到自身的连续映射，其不动点就是均衡，存在性由 [[brouwer-fixed-point]] 保证。

### 例题
**囚徒困境**：两人都坦白是唯一的纳什均衡，但两人都沉默对双方更好——个体理性导致集体非理性。**石头剪刀布**：唯一均衡是各以 $\frac13$ 的概率出三种手势。

## 动态规划 {#dynamic-programming}
type: 方法 | en: Dynamic programming | w: 3 | level: ext
前置: recurrence-relation
相关: optimization-problem
alias: 动态规划, 贝尔曼方程, 最优子结构, 记忆化

把问题分解为相互重叠的子问题，利用“最优解的子结构也是最优的”（贝尔曼最优性原理）写出递推，并把子问题的答案存起来避免重复计算。

### 例题
- **最短路径**：$d(v)=\min_{u\to v}\{d(u)+w(u,v)\}$；
- **背包问题**：$F(i,c)=\max\{F(i-1,c),\ F(i-1,c-w_i)+v_i\}$，$O(nC)$ 时间；
- **编辑距离**：两个字符串之间最少的插入、删除、替换次数，$O(mn)$ 表格。

### 注记
斐波那契数的朴素递归是指数时间，记忆化后是线性时间——这是动态规划最简单的演示。强化学习中的价值迭代、序列比对、语音识别中的维特比算法都是动态规划。
