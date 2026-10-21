---
galaxy: algebra
cluster: inner-product
title: 内积空间与谱定理
en: Inner product spaces and the spectral theorem
order: 5
level: core
---

## 内积空间 {#inner-product-space}
type: 定义 | en: Inner product space | w: 5 | 考纲: 内积空间
源于: dot-product
前置: vector-space
后续: cauchy-schwarz, orthonormal-basis, adjoint-operator
推广为: hilbert-space
alias: 欧氏空间, 酉空间, 内积, 范数, 正交

实向量空间上的内积 $\inner{\vv u}{\vv v}$ 是对称、双线性、正定（$\inner{\vv v}{\vv v}>0$，$\vv v\ne\vv0$）的函数；复空间上要求共轭对称 $\inner{\vv u}{\vv v}=\overline{\inner{\vv v}{\vv u}}$。有了内积就有长度 $\norm{\vv v}=\sqrt{\inner{\vv v}{\vv v}}$、角度和正交。

### 例子
$\R^n$ 上的点积；$\C^n$ 上 $\inner{\vv u}{\vv v}=\sum u_i\bar v_i$；$C[a,b]$ 上 $\inner fg=\int_a^bf(x)g(x)\,\dd x$；矩阵空间上 $\inner AB=\tr(A\T B)$。

### 注记
范数满足平行四边形法则 $\norm{\vv u+\vv v}^2+\norm{\vv u-\vv v}^2=2\norm{\vv u}^2+2\norm{\vv v}^2$；反过来，满足它的范数一定来自某个内积（若尔当–冯·诺伊曼定理），内积可由极化恒等式恢复。

## 柯西-施瓦茨不等式 {#cauchy-schwarz}
type: 不等式 | en: Cauchy–Schwarz inequality | w: 5 | 考纲: 内积空间, 不等式问题
前置: inner-product-space
源于: cauchy-inequality-hs
应用于: covariance, uncertainty-principle, holder-inequality
alias: 柯西-施瓦茨不等式, Cauchy–Schwarz

$$\abs{\inner{\vv u}{\vv v}}\le\norm{\vv u}\,\norm{\vv v},$$
等号当且仅当 $\vv u,\vv v$ 线性相关。由此可以定义夹角 $\cos\theta=\frac{\inner{\vv u}{\vv v}}{\norm{\vv u}\norm{\vv v}}$，并得到三角不等式。

### 证明
$\vv v\ne\vv0$ 时，令 $\vv w=\vv u-\frac{\inner{\vv u}{\vv v}}{\norm{\vv v}^2}\vv v$（从 $\vv u$ 中减去它在 $\vv v$ 上的投影），则 $\vv w\perp\vv v$，由勾股定理 $\norm{\vv u}^2=\norm{\vv w}^2+\frac{\abs{\inner{\vv u}{\vv v}}^2}{\norm{\vv v}^2}\ge\frac{\abs{\inner{\vv u}{\vv v}}^2}{\norm{\vv v}^2}$。

### 例题
积分形式：$\left(\int_a^bfg\right)^2\le\int_a^bf^2\int_a^bg^2$。概率形式：$\abs{\Cov(X,Y)}\le\sqrt{\Var X\Var Y}$，即相关系数 $\abs\rho\le1$。

## 规范正交基 {#orthonormal-basis}
type: 定义 | en: Orthonormal basis | w: 4 | 考纲: 内积空间
前置: inner-product-space, basis
后续: gram-schmidt, orthogonal-matrix
alias: 标准正交基, 正交规范基, 帕塞瓦尔

两两正交的单位向量组成的基。在规范正交基 $\vv e_1,\dots,\vv e_n$ 下，坐标就是内积：
$$\vv v=\sum_{i}\inner{\vv v}{\vv e_i}\vv e_i,\qquad \norm{\vv v}^2=\sum_i\abs{\inner{\vv v}{\vv e_i}}^2.$$
求坐标不需要解方程组——这是规范正交基最大的方便之处，傅里叶系数的公式就是这样来的。

## 施密特正交化 {#gram-schmidt}
type: 算法 | en: Gram–Schmidt process | w: 4 | 考纲: 内积空间
前置: orthonormal-basis
推出: qr-decomposition
应用于: orthogonal-polynomials
alias: Gram–Schmidt, 格拉姆-施密特正交化, 正交化

把线性无关组 $\vv a_1,\dots,\vv a_n$ 逐个“去掉在前面方向上的投影”再单位化：
$$\vv b_k=\vv a_k-\sum_{i<k}\inner{\vv a_k}{\vv e_i}\vv e_i,\qquad \vv e_k=\frac{\vv b_k}{\norm{\vv b_k}}.$$
得到的 $\vv e_1,\dots,\vv e_n$ 是规范正交组，且 $\Span(\vv e_1,\dots,\vv e_k)=\Span(\vv a_1,\dots,\vv a_k)$ 对每个 $k$ 成立。

### 注记
矩阵形式即 $A=QR$（$Q$ 列正交，$R$ 上三角），见 [[qr-decomposition]]。对 $1,x,x^2,\dots$ 在 $L^2[-1,1]$ 中正交化，得到勒让德多项式。数值上经典算法不稳定，实际使用修正的施密特方法或豪斯霍尔德变换。

## 正交投影与最佳逼近 {#orthogonal-projection}
type: 定理 | en: Orthogonal projection | w: 4 | 考纲: 内积空间
前置: orthonormal-basis
应用于: least-squares, least-squares-approx
alias: 投影定理, 正交补, 最佳逼近, 最小二乘的几何

设 $W$ 是有限维子空间，$V=W\oplus W^\perp$。每个 $\vv v$ 唯一分解为 $\vv v=\vv w+\vv w^\perp$，$\vv w=P_W\vv v$ 称为正交投影，它是 $W$ 中离 $\vv v$ 最近的点：
$$\norm{\vv v-P_W\vv v}\le\norm{\vv v-\vv u}\quad\forall\vv u\in W.$$

### 证明
$\vv v-\vv u=(\vv v-P_W\vv v)+(P_W\vv v-\vv u)$，两项分别属于 $W^\perp$ 与 $W$，由勾股定理 $\norm{\vv v-\vv u}^2=\norm{\vv v-P_W\vv v}^2+\norm{P_W\vv v-\vv u}^2$。

### 应用
最小二乘：$A\vv x=\vv b$ 无解时，求 $\vv x$ 使 $A\vv x$ 是 $\vv b$ 在列空间上的投影，得正规方程 $A\T A\vv x=A\T\vv b$，见 [[least-squares]]。

## 正交矩阵与酉矩阵 {#orthogonal-matrix}
type: 定义 | en: Orthogonal and unitary matrices | w: 4 | 考纲: 内积空间, 线性群
前置: orthonormal-basis
后续: linear-groups
alias: 正交矩阵, 酉矩阵, 正交变换, 等距变换, 旋转矩阵

$Q\T Q=I$ 的实方阵称为正交矩阵（复数情形 $U^*U=I$ 称为酉矩阵）。等价地，$Q$ 的列构成规范正交基；或 $Q$ 保持内积、保持长度。正交矩阵的行列式为 $\pm1$：$+1$ 为旋转，$-1$ 含一次反射。

### 例题
平面旋转 $\begin{pmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{pmatrix}$ 与反射 $\begin{pmatrix}\cos2\alpha&\sin2\alpha\\\sin2\alpha&-\cos2\alpha\end{pmatrix}$（关于倾角 $\alpha$ 的直线）。三维中每个行列式为 $1$ 的正交矩阵都是绕某轴的旋转（欧拉旋转定理）：它有特征值 $1$。

## 伴随算子 {#adjoint-operator}
type: 定义 | en: Adjoint operator | w: 3 | 考纲: 自伴算子, 内积空间
前置: inner-product-space, dual-space
后续: self-adjoint, normal-operator
alias: 伴随, 共轭转置, 厄米共轭

内积空间上线性算子 $T$ 的伴随 $T^*$ 由 $\inner{T\vv u}{\vv v}=\inner{\vv u}{T^*\vv v}$ 唯一确定。在规范正交基下，$T^*$ 的矩阵是 $T$ 的矩阵的共轭转置 $A^*=\bar A\T$。

### 注记
$(ST)^*=T^*S^*$，$(T^*)^*=T$，$\Ker T^*=(\im T)^\perp$——这推出“$A\vv x=\vv b$ 有解 $\iff\vv b$ 与 $A^*\vv y=\vv0$ 的每个解正交”。

## 自伴算子 {#self-adjoint}
type: 定义 | en: Self-adjoint operator | w: 4 | 考纲: 自伴算子
前置: adjoint-operator
后续: spectral-theorem
alias: 自伴, 埃尔米特矩阵, 实对称矩阵, 厄米算子

$T^*=T$ 的算子称为自伴的；矩阵形式为实对称矩阵 $A\T=A$ 或埃尔米特矩阵 $A^*=A$。

> [!定理] 基本性质
> 自伴算子的特征值都是实数；属于不同特征值的特征向量互相正交。

### 证明
若 $T\vv v=\lambda\vv v$，则 $\lambda\norm{\vv v}^2=\inner{T\vv v}{\vv v}=\inner{\vv v}{T\vv v}=\bar\lambda\norm{\vv v}^2$，故 $\lambda\in\R$。若 $T\vv v=\lambda\vv v$，$T\vv w=\mu\vv w$，$\lambda\ne\mu$，则 $\lambda\inner{\vv v}{\vv w}=\inner{T\vv v}{\vv w}=\inner{\vv v}{T\vv w}=\mu\inner{\vv v}{\vv w}$，所以 $\inner{\vv v}{\vv w}=0$。

### 应用
量子力学中可观测量对应自伴算子，测量值为其特征值——特征值为实数保证了测量结果是实数。

## 正规算子 {#normal-operator}
type: 定义 | en: Normal operator | w: 3 | 考纲: 正规算子
前置: adjoint-operator
后续: spectral-theorem
alias: 正规矩阵, AA*=A*A

$TT^*=T^*T$ 的算子称为正规算子。自伴、反自伴、酉算子都是正规的。正规性等价于 $\norm{T\vv v}=\norm{T^*\vv v}$ 对一切 $\vv v$ 成立。

### 注记
正规恰好是“能用规范正交基对角化”的条件（在复内积空间上），见 [[spectral-theorem]]。$\begin{pmatrix}1&1\\0&1\end{pmatrix}$ 不正规，所以不能酉对角化（实际上它根本不可对角化）。

## 谱定理 {#spectral-theorem}
type: 定理 | en: Spectral theorem | w: 5 | 考纲: 谱定理
前置: self-adjoint, normal-operator, schur-decomposition
源于: diagonalization
应用于: principal-axes, svd, pca
alias: 谱定理, 实对称矩阵正交对角化, 谱分解

- **复情形**：$T$ 正规 $\iff$ 存在由 $T$ 的特征向量组成的规范正交基，即 $A=U\Lambda U^*$，$U$ 酉。
- **实情形**：$T$ 自伴（实对称）$\iff$ 存在由特征向量组成的规范正交基，即 $A=Q\Lambda Q\T$，$Q$ 正交，$\Lambda$ 实对角。

谱分解：$A=\sum_i\lambda_iP_i$，$P_i$ 是到各特征子空间的正交投影。

### 证明
由 [[schur-decomposition]]，$A=UTU^*$，$T$ 上三角。若 $A$ 正规，则 $T$ 也正规：$TT^*=T^*T$。比较两边 $(1,1)$ 元得 $\abs{t_{11}}^2+\abs{t_{12}}^2+\cdots=\abs{t_{11}}^2$，于是第一行非对角元为零；依次类推，$T$ 是对角的。

### 直观
实对称矩阵代表的线性变换就是“沿几条互相垂直的轴分别伸缩”，没有任何扭转。椭圆的主轴、惯性张量的主轴、协方差矩阵的主成分，都是这个定理的化身。

## 舒尔分解 {#schur-decomposition}
type: 定理 | en: Schur decomposition | w: 3 | 考纲: 谱定理, 内积空间
前置: orthonormal-basis, eigenvalue
后续: spectral-theorem
alias: 舒尔三角化, 酉三角化, 上三角化

每个复方阵都酉相似于上三角矩阵：$A=UTU^*$，$T$ 的对角元是 $A$ 的特征值。

### 证明
对阶数归纳。取 $A$ 的一个单位特征向量 $\vv u_1$（复数域上一定存在），扩充为规范正交基得酉矩阵 $U_1$，则 $U_1^*AU_1=\begin{pmatrix}\lambda_1&*\\0&A_1\end{pmatrix}$，对 $A_1$ 用归纳假设。

### 注记
与若尔当标准形相比，舒尔分解用的是酉变换（数值稳定），代价是只得到三角形而非块对角形。它是 [[qr-algorithm]] 计算特征值的理论目标。

## 奇异值分解 {#svd}
type: 定理 | en: Singular value decomposition | w: 5 | 考纲: 谱定理, 矩阵分解
源于: spectral-theorem
后续: svd-low-rank
alias: SVD, 奇异值, 奇异向量

任意 $m\times n$ 实矩阵都可分解为
$$A=U\Sigma V\T,$$
$U$（$m\times m$）、$V$（$n\times n$）为正交矩阵，$\Sigma$ 为对角元 $\sigma_1\ge\sigma_2\ge\cdots\ge0$ 的“对角”矩阵。$\sigma_i$ 是 $A\T A$ 的特征值的平方根，称为奇异值。

### 证明
$A\T A$ 是半正定实对称矩阵，由谱定理 $A\T A=V\Lambda V\T$，$\Lambda=\diag(\sigma_i^2)$。对 $\sigma_i>0$ 令 $\vv u_i=\frac{A\vv v_i}{\sigma_i}$，验证它们规范正交，再扩充为 $\R^m$ 的规范正交基。

### 直观
任何线性映射 = 旋转（$V\T$）+ 沿坐标轴伸缩（$\Sigma$）+ 旋转（$U$）。单位球被 $A$ 映成一个椭球，奇异值就是椭球的半轴长。

### 应用
最佳低秩逼近、主成分分析、伪逆与最小二乘、图像压缩、推荐系统，见 [[svd-low-rank]] 与 [[pca]]。
