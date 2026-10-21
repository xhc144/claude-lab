---
galaxy: algebra
cluster: vector-spaces
title: 向量空间
en: Vector spaces
order: 2
level: core
---

## 向量空间 {#vector-space}
type: 定义 | en: Vector space | w: 5 | 考纲: 向量空间
源于: plane-vector
前置: field
后续: subspace, linear-independence, linear-map
alias: 线性空间, 向量空间公理
tags: 线性代数

域 $F$ 上的向量空间是一个集合 $V$，配有加法和数乘，满足八条公理：加法交换、结合、有零向量、有负向量；数乘满足 $1\vv v=\vv v$、$(ab)\vv v=a(b\vv v)$，以及两条分配律。

### 例子
$F^n$；$m\times n$ 矩阵全体；次数 $\le n$ 的多项式 $F[x]_n$；区间上的连续函数 $C[a,b]$；数列全体；线性微分方程 $y''+y=0$ 的解集。

### 为什么要抽象
只要满足同样的公理，关于 $\R^n$ 的结论（维数、基、线性映射、特征值……）就能原封不动地用在多项式、函数、矩阵乃至量子态上。抽象就是“一次证明，到处使用”。

## 子空间 {#subspace}
type: 定义 | en: Subspace | w: 3 | 考纲: 向量空间
前置: vector-space
后续: direct-sum, dimension-formula, kernel-image
alias: 子空间, 生成子空间, 张成, 列空间

$V$ 的非空子集 $W$ 若对加法和数乘封闭，就是子空间。向量组 $\vv v_1,\dots,\vv v_k$ 的全部线性组合构成的子空间记为 $\Span(\vv v_1,\dots,\vv v_k)$。

### 注记
- $\R^3$ 的子空间只有：$\{\vv0\}$、过原点的直线、过原点的平面、$\R^3$ 本身。不过原点的平面不是子空间。
- 两个子空间的交仍是子空间，并一般不是；包含二者的最小子空间是和 $U+W$。

## 线性相关与线性无关 {#linear-independence}
type: 定义 | en: Linear independence | w: 5 | 考纲: 基, 向量空间
前置: vector-space
后续: basis, rank
alias: 线性相关, 线性无关, 极大无关组

向量组 $\vv v_1,\dots,\vv v_k$ 线性无关：$c_1\vv v_1+\cdots+c_k\vv v_k=\vv0$ 只有零解 $c_1=\cdots=c_k=0$。否则线性相关，即其中某个向量是其余向量的线性组合。

### 例题
函数 $1,\ee^x,\ee^{2x}$ 在 $\R$ 上线性无关：若 $c_0+c_1\ee^x+c_2\ee^{2x}\equiv0$，令 $x\to-\infty$ 得 $c_0=0$；除以 $\ee^x$ 再令 $x\to-\infty$ 得 $c_1=0$，从而 $c_2=0$。

> [!定理] 替换定理（斯坦尼茨）
> 若 $\vv u_1,\dots,\vv u_k$ 线性无关且都可由 $\vv w_1,\dots,\vv w_m$ 线性表示，则 $k\le m$。

这个引理保证了维数概念良定义。

## 基 {#basis}
type: 定义 | en: Basis | w: 5 | 考纲: 基
前置: linear-independence, subspace
源于: vector-decomposition
后续: dimension, change-of-basis, matrix-representation
alias: 基底, 坐标, 标准基

$V$ 的一组基是线性无关且能张成 $V$ 的向量组。等价地，$V$ 中每个向量都能**唯一地**写成基向量的线性组合，系数称为坐标。

### 注记
- 基是“坐标系”：选定基后，抽象向量空间就同构于 $F^n$。
- 任何线性无关组都可以扩充为基；任何张成组都包含一组基。
- 基不唯一，但所有基所含向量个数相同（由替换定理），这个数就是维数。

## 维数 {#dimension}
type: 定义 | en: Dimension | w: 5 | 考纲: 维数
前置: basis
后续: dimension-formula, rank-nullity
alias: 维数, 有限维, 无穷维

有限维向量空间 $V$ 的维数 $\dim V$ 是任意一组基所含向量的个数。$\dim F^n=n$，$\dim F[x]_n=n+1$，$\dim M_{m\times n}=mn$；所有多项式构成的空间是无穷维的。

### 注记
维数是有限维向量空间在同构意义下唯一的不变量：两个 $F$ 上的有限维向量空间同构 $\iff$ 维数相同。在 $n$ 维空间中，$n$ 个向量线性无关 $\iff$ 它们张成整个空间 $\iff$ 它们是基——“个数对了，只需检查一半”。

## 坐标与基变换 {#change-of-basis}
type: 方法 | en: Change of basis | w: 4 | 考纲: 基, 矩阵表示
前置: basis, inverse-matrix
后续: similarity
alias: 过渡矩阵, 坐标变换, 基变换

若新基 $(\vv f_1,\dots,\vv f_n)=(\vv e_1,\dots,\vv e_n)P$，$P$ 称为过渡矩阵（可逆），则同一向量的新旧坐标满足 $\vv x_{\text{旧}}=P\vv x_{\text{新}}$，即 $\vv x_{\text{新}}=P^{-1}\vv x_{\text{旧}}$。

### 注记
坐标变换方向与基变换方向“相反”（逆变）：基拉长一倍，坐标就缩短一半。同一个线性变换在新基下的矩阵为 $P^{-1}AP$，见 [[similarity]]。选一组好的基让矩阵变简单，是线性代数的核心策略。

## 直和 {#direct-sum}
type: 定义 | en: Direct sum | w: 4 | 考纲: 直和
前置: subspace
后续: invariant-subspace, generalized-eigenspace
alias: 直和, 补空间, 直和分解

若 $U+W$ 中每个向量都能唯一地写成 $\vv u+\vv w$（$\vv u\in U$，$\vv w\in W$），称和为直和，记 $U\oplus W$。等价条件：$U\cap W=\{\vv0\}$；或 $\dim(U+W)=\dim U+\dim W$。

### 例题
方阵空间 $M_n=\{\text{对称矩阵}\}\oplus\{\text{反对称矩阵}\}$：$A=\frac{A+A\T}2+\frac{A-A\T}2$，交集只有零矩阵。

### 注记
多个子空间 $U_1+\cdots+U_k$ 是直和的条件不是“两两交为零”，而是每个 $U_i$ 与其余之和的交为零（$\R^2$ 中三条不同的直线两两交为零，但和不是直和）。线性代数的许多结构定理都是直和分解：[[generalized-eigenspace]]、[[spectral-theorem]]。

## 维数公式 {#dimension-formula}
type: 定理 | en: Dimension formula for subspaces | w: 3 | 考纲: 维数, 直和
前置: dimension, subspace
类比: inclusion-exclusion
alias: 子空间维数公式, Grassmann 公式

$$\dim(U+W)=\dim U+\dim W-\dim(U\cap W).$$

### 证明
取 $U\cap W$ 的基 $\vv a_1,\dots,\vv a_r$，分别扩充为 $U$ 的基（添 $\vv b_1,\dots,\vv b_s$）和 $W$ 的基（添 $\vv c_1,\dots,\vv c_t$）。验证 $\vv a,\vv b,\vv c$ 全体线性无关，它们张成 $U+W$，于是 $\dim(U+W)=r+s+t$。

### 例题
$\R^4$ 中两个三维子空间至少交于一个平面：$\dim(U\cap W)\ge3+3-4=2$。这与集合的容斥原理形式相同，但三个子空间时容斥公式不再成立。

## 商空间 {#quotient-space}
type: 定义 | en: Quotient space | w: 2 | 考纲: 向量空间
前置: subspace, direct-sum
类比: quotient-group
alias: 商空间, 陪集, 等价类

子空间 $W$ 把 $V$ 分成陪集 $\vv v+W$（平行于 $W$ 的“平移”），陪集全体在自然的加法与数乘下构成商空间 $V/W$，$\dim V/W=\dim V-\dim W$。

### 直观
$\R^3/\{z\text{ 轴}\}$：把每条竖直线压成一点，得到的就是一个平面。商空间是“忽略 $W$ 方向上的差别”之后剩下的空间。它与商群的构造完全平行，见 [[quotient-group]]。
