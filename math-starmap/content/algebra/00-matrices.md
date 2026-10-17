---
galaxy: algebra
cluster: matrices
title: 矩阵与线性方程组
en: Matrices and linear systems
order: 0
level: core
---

## 矩阵 {#matrix}
type: 概念 | en: Matrix | w: 5 | 考纲: 矩阵运算
后续: matrix-multiplication, linear-system, determinant
alias: 矩阵, 转置, 方阵, 单位矩阵, 对称矩阵
tags: 线性代数

$m\times n$ 个数排成的矩形阵列 $A=(a_{ij})$。矩阵可以相加、数乘、转置 $(A\T)_{ij}=a_{ji}$；方阵中有单位矩阵 $I$、对角矩阵、上三角矩阵、对称矩阵 $A\T=A$ 等特殊类型。

### 三种视角
同一个矩阵可以看作：(1) 一张数表；(2) 线性方程组的系数；(3) 一个线性映射 $\vv x\mapsto A\vv x$ 的“坐标表示”。第三种视角最深刻：矩阵的乘法、逆、秩、行列式、特征值都是线性映射性质的翻译，见 [[matrix-representation]]。

## 矩阵乘法 {#matrix-multiplication}
type: 定义 | en: Matrix multiplication | w: 5 | 考纲: 矩阵运算
前置: matrix
后续: inverse-matrix, block-matrix, matrix-representation
alias: 矩阵乘积, 行乘列, 不可交换

$A$ 为 $m\times n$，$B$ 为 $n\times p$，则 $(AB)_{ij}=\sum_{k=1}^na_{ik}b_{kj}$。

### 为什么这样定义
矩阵乘法就是线性映射的复合：$\vv x\mapsto B\vv x\mapsto A(B\vv x)$。复合映射的矩阵恰好是 $AB$，这个看似古怪的“行乘列”规则就是由此唯一确定的。所以乘法满足结合律（映射复合满足结合律），却一般不满足交换律（先旋转再投影 $\ne$ 先投影再旋转）。

### 注记
- $AB=0$ 推不出 $A=0$ 或 $B=0$：$\begin{pmatrix}0&1\\0&0\end{pmatrix}^2=0$。
- $(AB)\T=B\T A\T$，$(AB)^{-1}=B^{-1}A^{-1}$：穿脱原则——先穿袜子后穿鞋，脱时先脱鞋。
- $AB$ 的第 $j$ 列是 $A$ 的各列以 $B$ 的第 $j$ 列为系数的线性组合。

## 线性方程组 {#linear-system}
type: 概念 | en: System of linear equations | w: 5 | 考纲: 高斯消元法
前置: matrix
后续: gaussian-elimination, solution-structure, cramers-rule
alias: 线性方程组, 增广矩阵, 齐次方程组, Ax=b

$A\vv x=\vv b$，$A$ 为 $m\times n$ 系数矩阵，$(A\mid\vv b)$ 为增广矩阵。

### 两种几何图像
- **行图像**：每个方程是一个超平面，解是这些超平面的交集。
- **列图像**：$A\vv x=x_1\vv a_1+\cdots+x_n\vv a_n$，问 $\vv b$ 能否写成 $A$ 各列的线性组合——解存在 $\iff\vv b$ 属于 $A$ 的列空间。

### 注记
解只有三种可能：无解、唯一解、无穷多解。判据见 [[rank]]：有解 $\iff\rank A=\rank(A\mid\vv b)$；有唯一解还需秩等于未知数个数。

## 高斯消元法 {#gaussian-elimination}
type: 算法 | en: Gaussian elimination | w: 5 | 考纲: 高斯消元法
前置: linear-system
推出: rank, lu-decomposition
后续: elementary-matrices
alias: 消元法, 行阶梯形, 行最简形, 初等行变换, 主元

用三种初等行变换（交换两行、某行乘非零数、某行加上另一行的倍数）把增广矩阵化为行阶梯形，再回代求解。初等行变换不改变方程组的解。

### 例题
$$\left(\begin{array}{ccc|c}1&2&1&2\\3&8&1&12\\0&4&1&2\end{array}\right)\to\left(\begin{array}{ccc|c}1&2&1&2\\0&2&-2&6\\0&4&1&2\end{array}\right)\to\left(\begin{array}{ccc|c}1&2&1&2\\0&2&-2&6\\0&0&5&-10\end{array}\right),$$
回代得 $z=-2$，$y=1$，$x=2$。

### 注记
- 计算量约 $\frac23n^3$ 次乘法，是求解稠密线性方程组的标准方法；数值计算中需要 [[pivoting|选主元]] 来控制舍入误差。
- 中国《九章算术》的“方程术”（约公元前一世纪）就是消元法，比高斯早约两千年。
- 消元过程等价于矩阵分解 $PA=LU$，见 [[lu-decomposition]]。

## 初等矩阵 {#elementary-matrices}
type: 概念 | en: Elementary matrices | w: 3 | 考纲: 高斯消元法, 矩阵运算
前置: gaussian-elimination, matrix-multiplication
后续: inverse-matrix
alias: 初等变换, 初等矩阵, 等价标准形

对单位矩阵作一次初等变换得到的矩阵。左乘初等矩阵 $=$ 对行作相应变换，右乘 $=$ 对列作变换。

### 推论
- 可逆矩阵都是初等矩阵的乘积。
- 任何矩阵都可以通过初等行、列变换化为等价标准形 $\begin{pmatrix}I_r&0\\0&0\end{pmatrix}$，$r$ 就是秩：秩是矩阵在“等价”下唯一的不变量。
- 求逆：$(A\mid I)\xrightarrow{\text{初等行变换}}(I\mid A^{-1})$。

## 逆矩阵 {#inverse-matrix}
type: 定义 | en: Inverse matrix | w: 4 | 考纲: 矩阵运算
前置: matrix-multiplication, elementary-matrices
后续: adjugate, cramers-rule
alias: 可逆矩阵, 非奇异矩阵, 求逆

方阵 $A$ 可逆：存在 $B$ 使 $AB=BA=I$，记 $B=A^{-1}$。

> [!定理] 可逆的等价条件
> 对 $n$ 阶方阵 $A$，以下等价：$A$ 可逆；$\det A\ne0$；$\rank A=n$；$A\vv x=\vv0$ 只有零解；$A$ 的列（行）线性无关；$0$ 不是 $A$ 的特征值；对应的线性映射是双射。

### 注记
对方阵而言，$AB=I$ 就能推出 $BA=I$（有限维的“单射 $\iff$ 满射”）；无穷维时不成立：右移算子有左逆但没有右逆。

## 矩阵的秩 {#rank}
type: 定义 | en: Rank | w: 5 | 考纲: 高斯消元法, 维数
源于: gaussian-elimination
前置: linear-independence
后续: rank-nullity, solution-structure
alias: 秩, 行秩, 列秩, 满秩

矩阵的秩是其列向量组的极大无关组所含向量的个数（列秩），也等于行秩、等于非零子式的最高阶数、等于行阶梯形中非零行的个数。

> [!定理] 行秩 = 列秩
> 任何矩阵的行秩等于列秩。

### 证明
初等行变换不改变列向量之间的线性关系，因此不改变列秩；也不改变行空间，因此不改变行秩。化为行阶梯形后，非零行数同时等于行秩和列秩（主元列构成列空间的基）。

### 注记
$\rank(AB)\le\min(\rank A,\rank B)$；$\rank A+\rank B-n\le\rank(AB)$（西尔维斯特不等式）；$\rank(A\T A)=\rank A$。

## 分块矩阵 {#block-matrix}
type: 方法 | en: Block matrices | w: 3 | 考纲: 矩阵运算
前置: matrix-multiplication
alias: 分块, 分块乘法, 舒尔补

把矩阵按行列分成子块，只要分块方式相容，乘法可以“把块当作数”来做（注意块之间不可交换）。

### 例题
**舒尔补**：若 $A$ 可逆，
$$\begin{pmatrix}A&B\\C&D\end{pmatrix}=\begin{pmatrix}I&0\\CA^{-1}&I\end{pmatrix}\begin{pmatrix}A&B\\0&D-CA^{-1}B\end{pmatrix},$$
所以 $\det\begin{pmatrix}A&B\\C&D\end{pmatrix}=\det A\cdot\det(D-CA^{-1}B)$。由此可证 $\det(I_m+AB)=\det(I_n+BA)$。

## 线性方程组解的结构 {#solution-structure}
type: 定理 | en: Structure of solutions | w: 4 | 考纲: 高斯消元法, 维数
前置: rank, linear-system
源于: rank-nullity
alias: 基础解系, 通解, 特解, 齐次方程组的解空间

- 齐次方程组 $A\vv x=\vv0$（$A$ 为 $m\times n$）的解集是 $\R^n$ 的子空间，维数为 $n-\rank A$，其一组基称为基础解系。
- 非齐次方程组的通解 = 一个特解 + 对应齐次方程组的通解：$\vv x=\vv x_0+c_1\vv\xi_1+\cdots+c_{n-r}\vv\xi_{n-r}$。

### 直观
非齐次方程组的解集是过 $\vv x_0$、平行于解空间的“平移子空间”（仿射子空间）。这一结构在线性微分方程中完全照搬，见 [[linear-first-order-ode]]。
