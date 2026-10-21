---
galaxy: applied
cluster: direct-methods
title: 直接法与矩阵分解
en: Direct methods and matrix factorizations
order: 4
level: core
---

## LU 分解 {#lu-decomposition}
type: 算法 | en: LU decomposition | w: 5 | 考纲: 矩阵分解, 线性方程组的直接法
源于: gaussian-elimination
后续: pivoting, cholesky
alias: LU 分解, 三角分解, 杜利特尔分解, 前代回代

高斯消元等价于把矩阵分解为下三角 $L$（单位对角，存放消元乘数）与上三角 $U$ 之积：$A=LU$。解 $A\vv x=\vv b$ 分两步：前代解 $L\vv y=\vv b$，回代解 $U\vv x=\vv y$。

### 为什么分解
分解代价约 $\frac23n^3$ 次运算，而每次前代回代只需 $2n^2$。对同一个 $A$、多个右端 $\vv b$（如时间步进、求逆），只需分解一次。

### 例题
$$\begin{pmatrix}2&1\\4&5\end{pmatrix}=\begin{pmatrix}1&0\\2&1\end{pmatrix}\begin{pmatrix}2&1\\0&3\end{pmatrix}.$$
乘数 $2=\frac42$ 正是消元时第二行减去第一行的倍数。

### 注记
顺序主子式全不为零时 LU 分解存在且唯一；一般情形需要行交换：$PA=LU$。$\det A=\det U=\prod u_{ii}$（乘以排列的符号）。

## 选主元 {#pivoting}
type: 方法 | en: Pivoting | w: 4 | 考纲: 线性方程组的直接法, 误差思想
前置: lu-decomposition, numerical-stability
alias: 列主元消去法, 部分选主元, 全主元

消元时选列中绝对值最大的元素作主元（必要时交换行），使所有乘数 $\abs{l_{ij}}\le1$，防止舍入误差被放大。

### 例题
$\begin{pmatrix}10^{-20}&1\\1&1\end{pmatrix}\vv x=\begin{pmatrix}1\\2\end{pmatrix}$ 的解约为 $(1,1)$。不选主元：乘数 $10^{20}$，第二行变为 $1-10^{20}\approx-10^{20}$，回代得 $x_2=1$、$x_1=0$——完全错误。交换两行后再消元，结果正确。

### 注记
列主元高斯消元在实践中几乎总是稳定的，尽管存在增长因子达 $2^{n-1}$ 的人造例子。对称正定矩阵不需要选主元。

## 楚列斯基分解 {#cholesky}
type: 算法 | en: Cholesky decomposition | w: 3 | 考纲: 矩阵分解
前置: lu-decomposition, positive-definite
alias: 平方根法, Cholesky 分解, LL^T 分解

对称正定矩阵可唯一分解为 $A=LL\T$，$L$ 为对角元为正的下三角矩阵。计算量约为 LU 的一半（$\frac13n^3$），不需要选主元，数值稳定；分解能否进行到底还可以用来判定正定性。

### 应用
最小二乘的正规方程、高斯过程、蒙特卡罗模拟中生成相关的正态随机向量（若 $\vv z\sim N(\vv0,I)$，则 $L\vv z$ 的协方差为 $LL\T=\Sigma$）。

## QR 分解 {#qr-decomposition}
type: 算法 | en: QR decomposition | w: 4 | 考纲: 矩阵分解
源于: gram-schmidt
前置: orthogonal-matrix
后续: least-squares-numerical, qr-algorithm
alias: QR 分解, 豪斯霍尔德变换, 吉文斯旋转, 正交三角分解

$A=QR$，$Q$ 的列规范正交，$R$ 上三角。计算方法：
- 施密特正交化（简单但数值上不稳定）；
- 豪斯霍尔德反射 $H=I-2\vv v\vv v\T$（$\norm{\vv v}=1$）逐列把下方元素变为零（稳定，标准方法）；
- 吉文斯旋转逐个消去元素（适合稀疏矩阵）。

### 注记
正交变换不改变二范数，因而不放大误差——这是 QR 分解比正规方程更稳定的根本原因。

## 最小二乘问题的数值解 {#least-squares-numerical}
type: 方法 | en: Solving least-squares problems | w: 4 | 考纲: 矩阵分解, 线性方程组的直接法
前置: qr-decomposition
源于: least-squares
alias: 正规方程, QR 解最小二乘, 超定方程组

求 $\min\norm{A\vv x-\vv b}_2$（$A$ 为 $m\times n$，$m>n$）：
- 正规方程 $A\T A\vv x=A\T\vv b$：简单，但 $\kappa(A\T A)=\kappa(A)^2$，病态时精度损失加倍；
- QR 方法：$A=QR$，解 $R\vv x=Q\T\vv b$，条件数不平方；
- SVD 方法：最稳健，还能处理秩亏情形（伪逆 $\vv x=A^+\vv b$）。

### 例题
拟合直线 $y=c_0+c_1t$ 到数据 $(0,1),(1,2),(2,2)$：$A=\begin{pmatrix}1&0\\1&1\\1&2\end{pmatrix}$，正规方程 $\begin{pmatrix}3&3\\3&5\end{pmatrix}\vv c=\begin{pmatrix}5\\6\end{pmatrix}$，$c_0=\frac76$，$c_1=\frac12$。

## 奇异值分解与低秩逼近 {#svd-low-rank}
type: 定理 | en: Low-rank approximation via SVD | w: 4 | 考纲: 矩阵分解
源于: svd
后续: pca
alias: 埃卡特-杨定理, 低秩逼近, 截断 SVD, 图像压缩

把 $A=\sum_i\sigma_i\vv u_i\vv v_i\T$ 截断为前 $k$ 项 $A_k$，则 $A_k$ 是所有秩不超过 $k$ 的矩阵中离 $A$ 最近的（埃卡特–杨定理）：
$$\norm{A-A_k}_2=\sigma_{k+1},\qquad\norm{A-A_k}_F=\sqrt{\sigma_{k+1}^2+\cdots}.$$

### 应用
图像压缩：$m\times n$ 的灰度图只存前 $k$ 个奇异三元组，需要 $k(m+n+1)$ 个数；奇异值常常迅速衰减，$k=50$ 就能保留大部分视觉信息。推荐系统（用户–物品评分矩阵的低秩补全）、潜在语义分析、去噪，都利用“数据近似低秩”。

## 主成分分析 {#pca}
type: 方法 | en: Principal component analysis | w: 4 | 考纲: 数据压缩, 特征向量计算
源于: svd-low-rank
前置: covariance, spectral-theorem
用到: rayleigh-quotient
alias: PCA, 主成分, 降维, 协方差矩阵的特征向量

把中心化的数据矩阵 $X$（每行一个样本）的协方差矩阵 $\Sigma=\frac1{n-1}X\T X$ 正交对角化，特征值从大到小对应的特征向量称为主成分方向。数据在第一主成分上投影的方差最大，等于最大特征值；保留前 $k$ 个主成分即为最佳的 $k$ 维线性降维。

### 直观
二维散点云像一个椭圆：第一主成分是椭圆的长轴方向，第二是短轴。主成分分析就是找到数据云的主轴（[[principal-axes]]）。

### 例题
身高与体重高度相关，二维数据几乎落在一条直线附近：第一主成分（“体型大小”）解释了大部分方差，只用一个数就能概括两个数。

## 矩阵范数 {#matrix-norms}
type: 定义 | en: Matrix norms | w: 3 | 考纲: 线性方程组的迭代法, 误差思想
前置: inner-product-space, svd
后续: condition-number, iteration-convergence
alias: 算子范数, 谱范数, F 范数, 谱半径, 相容范数

由向量范数诱导的算子范数 $\norm A=\max_{\vv x\ne\vv0}\frac{\norm{A\vv x}}{\norm{\vv x}}$：$\norm A_1$ 为最大列绝对值和，$\norm A_\infty$ 为最大行绝对值和，$\norm A_2=\sigma_{\max}$（谱范数）。弗罗贝尼乌斯范数 $\norm A_F=\sqrt{\sum a_{ij}^2}$。

### 性质
相容性 $\norm{AB}\le\norm A\norm B$；谱半径 $\rho(A)=\max\abs{\lambda_i}\le\norm A$（对任何算子范数），且 $\rho(A)=\lim\norm{A^k}^{1/k}$。$A^k\to0\iff\rho(A)<1$，这是迭代法收敛的判据。
