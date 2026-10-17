---
galaxy: algebra
cluster: linear-maps
title: 线性映射
en: Linear maps
order: 3
level: core
---

## 线性映射 {#linear-map}
type: 定义 | en: Linear map | w: 5 | 考纲: 线性算子
前置: vector-space
后续: kernel-image, matrix-representation, linear-isomorphism
alias: 线性变换, 线性算子, 线性映射
anim: linear-map
tags: 线性代数

$T:V\to W$ 满足 $T(\vv u+\vv v)=T\vv u+T\vv v$，$T(c\vv v)=cT\vv v$。$V\to V$ 的线性映射叫线性算子（线性变换）。线性映射由它在一组基上的取值完全确定。

### 例子
平面上的旋转、反射、投影、伸缩、剪切；求导 $D:F[x]_n\to F[x]_{n-1}$；积分 $f\mapsto\int_0^xf$；矩阵乘法 $\vv x\mapsto A\vv x$。平移 $\vv x\mapsto\vv x+\vv b$（$\vv b\ne\vv0$）不是线性的，它是仿射的。

### 直观
线性映射把网格变成网格：直线变直线（或点）、平行线保持平行、原点不动、等距点仍等距。动画里拖动基向量的像，整个平面的网格随之变形。

## 核与像 {#kernel-image}
type: 定义 | en: Kernel and image | w: 4 | 考纲: 线性算子, 维数
前置: linear-map, subspace
后续: rank-nullity
alias: 核, 像, 零空间, 值域, 单射, 满射

$\Ker T=\{\vv v:T\vv v=\vv0\}$ 是 $V$ 的子空间，$\im T=\{T\vv v\}$ 是 $W$ 的子空间。$T$ 单射 $\iff\Ker T=\{\vv0\}$。

### 例题
求导算子 $D$ 在多项式空间上：核是常数多项式，像是全体多项式（满射）。所以 $D$ 不是单射——“积分常数 $C$”就是核里的自由度。

## 秩-零化度定理 {#rank-nullity}
type: 定理 | en: Rank–nullity theorem | w: 5 | 考纲: 维数, 线性算子
前置: kernel-image, dimension
推出: solution-structure
类比: first-isomorphism
alias: 维数定理, 秩零化度定理, 线性映射基本定理

$$\dim V=\dim\Ker T+\dim\im T.$$
矩阵形式：$n$ 列的矩阵 $A$ 满足 $n=\dim\{\vv x:A\vv x=\vv0\}+\rank A$。

### 证明
取 $\Ker T$ 的基 $\vv u_1,\dots,\vv u_k$，扩充为 $V$ 的基 $\vv u_1,\dots,\vv u_k,\vv v_1,\dots,\vv v_r$。则 $T\vv v_1,\dots,T\vv v_r$ 张成 $\im T$；若 $\sum c_iT\vv v_i=\vv0$，则 $\sum c_i\vv v_i\in\Ker T$，只能是零组合，故它们线性无关。

### 推论
$\dim V=\dim W$ 时，$T$ 单射 $\iff$ $T$ 满射 $\iff$ $T$ 可逆。对方阵而言，$A\vv x=\vv b$ 对一切 $\vv b$ 有解 $\iff$ 齐次方程只有零解（弗雷德霍姆择一性的有限维形式）。

## 线性映射的矩阵表示 {#matrix-representation}
type: 定理 | en: Matrix of a linear map | w: 5 | 考纲: 矩阵表示
前置: linear-map, basis, matrix-multiplication
后续: similarity, eigenvalue
alias: 矩阵表示, 表示矩阵, 坐标映射

取 $V$ 的基 $\vv e_1,\dots,\vv e_n$ 与 $W$ 的基 $\vv f_1,\dots,\vv f_m$，把 $T\vv e_j$ 的坐标作为第 $j$ 列，得到 $m\times n$ 矩阵 $A$，则 $[T\vv v]=A[\vv v]$。映射的复合对应矩阵的乘积，映射的和对应矩阵的和：
$$\Hom(V,W)\cong M_{m\times n}(F).$$

### 例题
$D:F[x]_3\to F[x]_3$ 在基 $1,x,x^2,x^3$ 下的矩阵
$$\begin{pmatrix}0&1&0&0\\0&0&2&0\\0&0&0&3\\0&0&0&0\end{pmatrix},$$
它是幂零矩阵：$D^4=0$，因为求四次导数后三次多项式变为零。

## 相似矩阵 {#similarity}
type: 定义 | en: Similar matrices | w: 4 | 考纲: 矩阵表示, 若尔当标准形
前置: matrix-representation, change-of-basis
后续: diagonalization, jordan-form
alias: 相似, 相似变换, 相似不变量

若 $B=P^{-1}AP$（$P$ 可逆），称 $A$ 与 $B$ 相似。相似矩阵是同一个线性算子在不同基下的矩阵。

### 相似不变量
行列式、迹、秩、特征多项式、特征值（及其代数、几何重数）、最小多项式、若尔当标准形。最后一个是完全不变量：复矩阵相似 $\iff$ 若尔当标准形相同（不计块的顺序）。

### 注记
特征多项式相同不足以相似：$\begin{pmatrix}0&1\\0&0\end{pmatrix}$ 与零矩阵的特征多项式都是 $\lambda^2$，但不相似。

## 线性同构 {#linear-isomorphism}
type: 定义 | en: Isomorphism of vector spaces | w: 3 | 考纲: 线性算子, 维数
前置: linear-map, kernel-image
类比: isomorphism-group
alias: 同构, 可逆线性映射

既单又满的线性映射叫同构。同构的空间在线性代数意义下“完全相同”。有限维空间 $V\cong W\iff\dim V=\dim W$；特别地，选定一组基就给出同构 $V\cong F^n$。

### 注记
同构的存在不代表有“自然”的同构：$V$ 与对偶空间 $V^*$ 维数相同因而同构，但同构依赖于基的选择；而 $V$ 与 $V^{**}$ 之间有不依赖基的自然同构，见 [[dual-space]]。

## 对偶空间 {#dual-space}
type: 定义 | en: Dual space | w: 3 | 考纲: 双（多）线性函数, 线性算子
前置: linear-map, basis
后续: bilinear-form, tensor-product
alias: 对偶空间, 线性函数, 对偶基, 线性泛函

$V$ 上全体线性函数 $f:V\to F$ 构成对偶空间 $V^*$。若 $\vv e_1,\dots,\vv e_n$ 是 $V$ 的基，则由 $e^i(\vv e_j)=\delta_{ij}$ 定义的 $e^1,\dots,e^n$ 是 $V^*$ 的基（对偶基），所以 $\dim V^*=\dim V$。

### 注记
- 行向量是列向量空间的对偶：$\vv a\T$ 作用在 $\vv x$ 上得到数 $\vv a\T\vv x$。
- 线性映射 $T:V\to W$ 诱导转置 $T^*:W^*\to V^*$，矩阵就是 $A\T$。
- 有限维时 $V\to V^{**}$，$\vv v\mapsto(f\mapsto f(\vv v))$ 是自然同构。物理中“协变与逆变”、梯度是余向量，都来自对偶空间。

## 不变子空间 {#invariant-subspace}
type: 定义 | en: Invariant subspace | w: 4 | 考纲: 线性算子, 特征值
前置: linear-map, direct-sum
后续: eigenvalue, generalized-eigenspace
alias: 不变子空间, 块对角化

若 $T(U)\subseteq U$，称 $U$ 是 $T$ 的不变子空间。若 $V=U_1\oplus\cdots\oplus U_k$ 且每个 $U_i$ 都不变，取各子空间基拼成的基，$T$ 的矩阵就是块对角矩阵——把大问题拆成互不干扰的小问题。

### 注记
一维不变子空间就是特征向量张成的直线。研究线性算子的主线就是：找尽可能小的不变子空间，把空间分解成它们的直和，见 [[eigenvalue]]、[[generalized-eigenspace]]、[[jordan-form]]。
