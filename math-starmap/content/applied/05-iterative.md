---
galaxy: applied
cluster: iterative-methods
title: 迭代法与特征值计算
en: Iterative methods and eigenvalue algorithms
order: 5
level: core
---

## 雅可比迭代 {#jacobi-iteration}
type: 算法 | en: Jacobi iteration | w: 4 | 考纲: 线性方程组的迭代法
前置: fixed-point-iteration, linear-system
后续: gauss-seidel, iteration-convergence
alias: 雅可比迭代法, 简单迭代法, 分裂迭代

把 $A=D+L+U$（对角、严格下三角、严格上三角），由 $D\vv x=\vv b-(L+U)\vv x$ 得迭代
$$\vv x^{(k+1)}=D^{-1}\left(\vv b-(L+U)\vv x^{(k)}\right),\qquad x_i^{(k+1)}=\frac1{a_{ii}}\Big(b_i-\sum_{j\ne i}a_{ij}x_j^{(k)}\Big).$$
每个分量用上一轮的全部旧值更新，天然适合并行计算。

### 为什么用迭代法
大型稀疏矩阵（如离散化偏微分方程得到的百万阶方程组）用消元会产生大量填充、存储爆炸；迭代法只需要矩阵与向量的乘法。

## 高斯-赛德尔迭代 {#gauss-seidel}
type: 算法 | en: Gauss–Seidel iteration and SOR | w: 3 | 考纲: 线性方程组的迭代法
源于: jacobi-iteration
后续: iteration-convergence
alias: 高斯-赛德尔, SOR, 逐次超松弛, 松弛因子

计算 $x_i^{(k+1)}$ 时立刻使用本轮已经算出的新分量 $x_1^{(k+1)},\dots,x_{i-1}^{(k+1)}$：
$$x_i^{(k+1)}=\frac1{a_{ii}}\Big(b_i-\sum_{j<i}a_{ij}x_j^{(k+1)}-\sum_{j>i}a_{ij}x_j^{(k)}\Big).$$
通常比雅可比收敛快约一倍。逐次超松弛（SOR）再乘以松弛因子 $\omega\in(1,2)$ 外推：$x_i\leftarrow(1-\omega)x_i^{\text{旧}}+\omega x_i^{\text{GS}}$，选好 $\omega$ 可以加速一个数量级。

## 迭代法的收敛条件 {#iteration-convergence}
type: 定理 | en: Convergence of stationary iterations | w: 4 | 考纲: 线性方程组的迭代法
前置: jacobi-iteration, matrix-norms
alias: 谱半径判据, 对角占优, 迭代矩阵

定常迭代 $\vv x^{(k+1)}=B\vv x^{(k)}+\vv f$ 对任意初值收敛 $\iff$ 迭代矩阵的谱半径 $\rho(B)<1$。误差 $\vv e^{(k)}=B^k\vv e^{(0)}$，收敛速度约为每步乘以 $\rho(B)$。

### 充分条件
- 严格对角占优（$\abs{a_{ii}}>\sum_{j\ne i}\abs{a_{ij}}$）时雅可比与高斯–赛德尔都收敛：雅可比迭代矩阵的 $\infty$ 范数小于 $1$；
- 对称正定时高斯–赛德尔收敛，SOR 在 $0<\omega<2$ 时收敛。

### 例题
$\begin{pmatrix}4&1\\1&3\end{pmatrix}$ 严格对角占优；雅可比迭代矩阵 $\begin{pmatrix}0&-\frac14\\-\frac13&0\end{pmatrix}$ 的谱半径 $\frac1{\sqrt{12}}\approx0.29$，每步误差约缩小为 $0.29$ 倍。

## 共轭梯度法 {#conjugate-gradient}
type: 算法 | en: Conjugate gradient method | w: 3 | 考纲: 线性方程组的迭代法
前置: positive-definite, gradient-descent
alias: CG, 共轭方向, 克雷洛夫子空间

对称正定方程组 $A\vv x=\vv b$ 等价于最小化 $\phi(\vv x)=\frac12\vv x\T A\vv x-\vv b\T\vv x$。共轭梯度法沿相互 $A$-共轭的方向（$\vv p_i\T A\vv p_j=0$）逐次精确最小化，理论上至多 $n$ 步得到精确解；实际中迭代次数约为 $O(\sqrt{\kappa(A)})$ 即达到所需精度。

### 对比
最速下降法在狭长的等高线上来回“之字形”行进，收敛需 $O(\kappa)$ 步；共轭梯度法记住了之前的方向，避免重复劳动。它被评为 20 世纪最重要的十大算法之一（克雷洛夫子空间方法）。

## 幂法 {#power-method}
type: 算法 | en: Power method | w: 4 | 考纲: 特征值计算, 特征向量计算
前置: eigenvalue, diagonalization
用到: rayleigh-quotient
后续: inverse-iteration, pagerank
anim: power-method
alias: 幂迭代, 主特征值, 主特征向量

反复用矩阵乘向量并归一化：$\vv q_{k+1}=\frac{A\vv q_k}{\norm{A\vv q_k}}$。若 $\abs{\lambda_1}>\abs{\lambda_2}\ge\cdots$，则 $\vv q_k$ 收敛到主特征向量，收敛速度为 $\left|\frac{\lambda_2}{\lambda_1}\right|^k$；瑞利商 $\vv q_k\T A\vv q_k$ 给出 $\lambda_1$ 的估计。

### 证明
把初始向量展开 $\vv q_0=\sum c_i\vv v_i$，则 $A^k\vv q_0=\lambda_1^k\left(c_1\vv v_1+\sum_{i\ge2}c_i\left(\frac{\lambda_i}{\lambda_1}\right)^k\vv v_i\right)$，后面各项按比例衰减（要求 $c_1\ne0$）。

### 应用
谷歌的 PageRank 就是用幂法求网页链接矩阵的主特征向量（[[pagerank]]）。

## 反幂法与位移 {#inverse-iteration}
type: 算法 | en: Inverse iteration with shifts | w: 3 | 考纲: 特征值计算, 特征向量计算
源于: power-method
后续: qr-algorithm
alias: 反幂法, 原点位移, 瑞利商迭代

对 $(A-\mu I)^{-1}$ 用幂法，它的主特征值对应 $A$ 中最接近位移 $\mu$ 的特征值。每步解一个线性方程组（预先 LU 分解）。已知特征值的近似值时，反幂法一两步就能得到对应的特征向量。

### 注记
每步用当前的瑞利商更新位移（瑞利商迭代），对称矩阵时收敛是三次的。

## QR 算法 {#qr-algorithm}
type: 算法 | en: QR algorithm | w: 4 | 考纲: 特征值计算
前置: qr-decomposition, schur-decomposition
源于: inverse-iteration
alias: QR 迭代, 弗朗西斯算法, 黑森伯格约化, 隐式位移

计算全部特征值的标准算法：$A_0=A$，分解 $A_k=Q_kR_k$，再令 $A_{k+1}=R_kQ_k=Q_k\T A_kQ_k$。所有 $A_k$ 都与 $A$ 正交相似，在一般条件下 $A_k$ 收敛到上三角（舒尔形式），对角元就是特征值。

### 实用版本
先用正交变换把 $A$ 化为上黑森伯格形（对称时为三对角），每步 QR 只需 $O(n^2)$；再加上位移与收缩（弗朗西斯隐式双位移），总代价约 $O(n^3)$。它同样被列为 20 世纪十大算法之一。

### 注记
不能用“求特征多项式的根”来计算特征值：特征多项式的系数对扰动极其敏感（威尔金森多项式），而且五次以上没有求根公式——特征值只能迭代求得。

## 盖尔圆定理 {#gershgorin}
type: 定理 | en: Gershgorin circle theorem | w: 3 | 考纲: 特征值计算
前置: eigenvalue
alias: 圆盘定理, 特征值估计, Gershgorin

方阵 $A$ 的每个特征值都落在某个圆盘 $D_i=\left\{z:\abs{z-a_{ii}}\le\sum_{j\ne i}\abs{a_{ij}}\right\}$ 中。

### 证明
设 $A\vv x=\lambda\vv x$，取 $\abs{x_i}$ 最大的分量 $i$，则 $(\lambda-a_{ii})x_i=\sum_{j\ne i}a_{ij}x_j$，两边取绝对值并除以 $\abs{x_i}$。

### 推论
严格对角占优矩阵可逆（$0$ 不在任何圆盘中）。不用任何计算就能估计特征值的位置。

## PageRank {#pagerank}
type: 应用 | en: PageRank | w: 3 | 考纲: 特征向量计算
前置: power-method, markov-chain
alias: 网页排名, 谷歌矩阵, 随机冲浪者

把网页排名定义为“随机冲浪者”长期停留在各网页的概率：以概率 $\alpha\approx0.85$ 随机点击当前页面的一个链接，以 $1-\alpha$ 随机跳到任意网页。排名向量是谷歌矩阵 $G=\alpha P+\frac{1-\alpha}n\mathbf 1\mathbf 1\T$ 的平稳分布（特征值 $1$ 的特征向量）。

### 为什么能算
随机跳转保证 $G$ 正、不可约、非周期，平稳分布唯一；第二大特征值不超过 $\alpha$，幂法以 $0.85^k$ 的速度收敛，几十次迭代即可——即使网页有数十亿个，每次迭代也只是稀疏矩阵乘向量。
