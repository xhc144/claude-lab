---
galaxy: algebra
cluster: tensors
title: 张量积
en: Tensor products
order: 7
level: core
---

## 张量积 {#tensor-product}
type: 定义 | en: Tensor product | w: 4 | 考纲: 张量积
前置: multilinear-form, dual-space, basis
后续: kronecker-product, exterior-algebra
alias: 张量, 张量积, 泛性质, 双线性映射的线性化

$V\otimes W$ 是让“双线性映射变成线性映射”的空间：存在双线性映射 $\otimes:V\times W\to V\otimes W$，使得任何双线性映射 $\beta:V\times W\to U$ 都唯一地分解为 $\beta=L\circ\otimes$，$L$ 线性（泛性质）。若 $\{\vv e_i\}$、$\{\vv f_j\}$ 是基，则 $\{\vv e_i\otimes\vv f_j\}$ 是 $V\otimes W$ 的基，$\dim(V\otimes W)=\dim V\cdot\dim W$。

### 直观
$V\otimes W$ 的元素是 $\sum c_{ij}\vv e_i\otimes\vv f_j$，可以看成 $m\times n$ 的系数矩阵。形如 $\vv v\otimes\vv w$ 的元素（纯张量）对应秩 $1$ 的矩阵 $\vv v\vv w\T$；一般元素是若干个纯张量之和，最少需要的个数就是矩阵的秩。

### 注记
- 自然同构：$V^*\otimes W\cong\Hom(V,W)$，$V^*\otimes V^*\cong\{V$ 上的双线性函数$\}$。
- 维数相乘而不是相加：直和 $V\oplus W$ 维数为 $m+n$，张量积为 $mn$。量子力学中两个系统的复合态空间是张量积，非纯张量的态就是“纠缠态”。

## 克罗内克积 {#kronecker-product}
type: 例子 | en: Kronecker product | w: 2 | 考纲: 张量积, 矩阵运算
前置: tensor-product
alias: Kronecker 积, 矩阵的张量积

线性映射 $A:V\to V$ 与 $B:W\to W$ 的张量积 $A\otimes B$ 在基 $\vv e_i\otimes\vv f_j$ 下的矩阵是
$$A\otimes B=\begin{pmatrix}a_{11}B&\cdots&a_{1n}B\\\vdots&&\vdots\\a_{n1}B&\cdots&a_{nn}B\end{pmatrix}.$$

### 性质
$(A\otimes B)(C\otimes D)=AC\otimes BD$；$A\otimes B$ 的特征值是 $\lambda_i\mu_j$；$\det(A\otimes B)=(\det A)^m(\det B)^n$（$A$ 为 $n$ 阶、$B$ 为 $m$ 阶）；$\tr(A\otimes B)=\tr A\cdot\tr B$。

### 应用
二维网格上的拉普拉斯离散化 $=I\otimes T+T\otimes I$；量子计算中多个量子比特上的门。

## 外代数 {#exterior-algebra}
type: 定义 | en: Exterior algebra | w: 2 | level: ext
前置: tensor-product, multilinear-form
相关: differential-forms
alias: 外积, 楔积, 格拉斯曼代数, wedge product

$\Lambda^kV$ 是 $V^{\otimes k}$ 模去所有含重复因子的张量后得到的空间，元素写作 $\vv v_1\wedge\cdots\wedge\vv v_k$，满足 $\vv v\wedge\vv w=-\vv w\wedge\vv v$。$\dim\Lambda^kV=\binom nk$。

### 直观
$\vv v_1\wedge\cdots\wedge\vv v_k$ 表示由这些向量张成的“有向 $k$ 维体积元”。在 $\R^3$ 中 $\vv a\wedge\vv b$ 对应叉积 $\vv a\times\vv b$（有向面积），$\vv a\wedge\vv b\wedge\vv c$ 对应混合积（有向体积）；$\Lambda^nV$ 是一维的，线性映射在其上的作用就是乘以行列式。
