---
galaxy: algebra
cluster: determinants
title: 行列式
en: Determinants
order: 1
level: core
---

## 行列式 {#determinant}
type: 定义 | en: Determinant | w: 5 | 考纲: 行列式
前置: matrix, sign-of-permutation
后续: det-properties, laplace-expansion, characteristic-polynomial
alias: 行列式, det, 莱布尼茨公式, 交错多线性函数
tags: 行列式

$n$ 阶方阵的行列式
$$\det A=\sum_{\sigma\in S_n}\sgn(\sigma)\,a_{1\sigma(1)}a_{2\sigma(2)}\cdots a_{n\sigma(n)}.$$
它是唯一满足以下三条的函数：对每一列线性（多线性）；两列相同时为零（交错）；$\det I=1$（规范）。

### 直观
$\abs{\det A}$ 是 $A$ 的列向量张成的平行多面体的体积，符号表示定向（是否“翻转”了空间）。线性映射 $\vv x\mapsto A\vv x$ 把任何区域的体积放大 $\abs{\det A}$ 倍，见 [[det-volume]]。

### 注记
二阶 $\begin{vmatrix}a&b\\c&d\end{vmatrix}=ad-bc$；三阶有沙路法。$n$ 阶展开式有 $n!$ 项，不能直接用来计算大行列式——实际用消元化为三角形，计算量 $O(n^3)$。

## 行列式的性质 {#det-properties}
type: 性质 | en: Properties of determinants | w: 4 | 考纲: 行列式
前置: determinant
后续: det-multiplicative
alias: 行列式性质, 转置不变, 初等变换对行列式的影响

1. $\det A\T=\det A$（行与列地位相同）；
2. 交换两行变号；某行乘 $k$，行列式乘 $k$；某行加上另一行的倍数，行列式不变；
3. 有一行全为零或两行成比例，行列式为零；
4. 三角形矩阵的行列式等于对角元之积。

### 例题
$$\begin{vmatrix}a&b&b&b\\b&a&b&b\\b&b&a&b\\b&b&b&a\end{vmatrix}=(a+3b)(a-b)^3.$$
各列加到第一列，提出 $a+3b$，再各行减去第一行化为三角形。

## 按行展开与代数余子式 {#laplace-expansion}
type: 定理 | en: Laplace (cofactor) expansion | w: 4 | 考纲: 行列式
前置: determinant
后续: adjugate, vandermonde
alias: 拉普拉斯展开, 余子式, 代数余子式

$$\det A=\sum_{j=1}^na_{ij}A_{ij},\qquad A_{ij}=(-1)^{i+j}M_{ij},$$
其中 $M_{ij}$ 是删去第 $i$ 行第 $j$ 列后的余子式。而且 $\sum_ja_{kj}A_{ij}=0$（$k\ne i$）：一行元素乘另一行的代数余子式，和为零（相当于两行相同的行列式）。

### 注记
按含零最多的行展开最省力；递推地展开会得到许多特殊行列式的公式（三对角行列式满足二阶线性递推）。

## 范德蒙德行列式 {#vandermonde}
type: 例子 | en: Vandermonde determinant | w: 3 | 考纲: 行列式
前置: laplace-expansion, polynomial-remainder
应用于: lagrange-interpolation
alias: 范德蒙行列式, Vandermonde

$$\begin{vmatrix}1&1&\cdots&1\\x_1&x_2&\cdots&x_n\\\vdots&&&\vdots\\x_1^{n-1}&x_2^{n-1}&\cdots&x_n^{n-1}\end{vmatrix}=\prod_{1\le i<j\le n}(x_j-x_i).$$

### 证明
把 $x_n$ 换成变量 $x$，行列式是 $x$ 的 $n-1$ 次多项式，在 $x=x_1,\dots,x_{n-1}$ 处为零（两列相同），所以等于 $c\prod_{i<n}(x-x_i)$，首项系数 $c$ 是 $n-1$ 阶范德蒙德行列式，归纳即得。

### 应用
$x_i$ 互不相同时行列式非零，所以过 $n$ 个横坐标不同的点恰有一个次数 $<n$ 的插值多项式（[[lagrange-interpolation]]）。

## 克拉默法则 {#cramers-rule}
type: 定理 | en: Cramer's rule | w: 3 | 考纲: 行列式
前置: laplace-expansion, inverse-matrix, linear-system
alias: Cramer 法则

若 $\det A\ne0$，则 $A\vv x=\vv b$ 有唯一解
$$x_j=\frac{\det A_j}{\det A},$$
$A_j$ 是把 $A$ 的第 $j$ 列换成 $\vv b$ 得到的矩阵。

### 证明
$\vv b=\sum_kx_k\vv a_k$，代入 $\det A_j$ 的第 $j$ 列，由多线性与交错性，只剩 $x_j\det A$。

### 注记
它是理论工具（例如说明解连续依赖于系数），不是计算方法：需要计算 $n+1$ 个 $n$ 阶行列式，远不如消元法高效。

## 伴随矩阵 {#adjugate}
type: 概念 | en: Adjugate matrix | w: 3 | 考纲: 行列式, 矩阵运算
前置: laplace-expansion, inverse-matrix
alias: 伴随矩阵, 求逆公式, A*

由代数余子式组成的矩阵的转置 $A^*=(A_{ji})$ 满足 $AA^*=A^*A=(\det A)I$，所以 $\det A\ne0$ 时
$$A^{-1}=\frac1{\det A}A^*.$$

### 例题
$\begin{pmatrix}a&b\\c&d\end{pmatrix}^{-1}=\dfrac1{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}$。
关于伴随矩阵的秩：$\rank A^*=n$（$\rank A=n$），$1$（$\rank A=n-1$），$0$（$\rank A<n-1$）。

## 行列式乘法定理 {#det-multiplicative}
type: 定理 | en: Multiplicativity of the determinant | w: 4 | 考纲: 行列式
前置: det-properties, elementary-matrices
alias: det(AB)=det(A)det(B), 行列式的乘法

$$\det(AB)=\det A\cdot\det B.$$

### 证明
固定 $A$ 可逆，函数 $B\mapsto\frac{\det(AB)}{\det A}$ 对 $B$ 的列多线性、交错、在 $B=I$ 时为 $1$，由唯一性它就是 $\det B$。$A$ 不可逆时两边都为零。几何上：先放大 $\det B$ 倍再放大 $\det A$ 倍。

### 推论
$\det A^{-1}=\frac1{\det A}$；相似矩阵行列式相同，所以行列式是线性变换本身的属性，与基的选取无关。$\det:\GL_n\to\R^*$ 是群同态，其核是 $\SL_n$。

## 行列式的几何意义 {#det-volume}
type: 性质 | en: Determinant as signed volume | w: 4 | 考纲: 行列式
前置: determinant
应用于: jacobian, cross-product
anim: linear-map
alias: 体积, 有向面积, 定向

$\R^n$ 中 $n$ 个向量张成的平行多面体的体积等于以它们为列的矩阵行列式的绝对值；符号表示这组向量是否与标准基同向（右手系还是左手系）。

### 例题
三角形 $(x_1,y_1),(x_2,y_2),(x_3,y_3)$ 的面积为
$$\frac12\abs{\det\begin{pmatrix}x_2-x_1&x_3-x_1\\y_2-y_1&y_3-y_1\end{pmatrix}}.$$
三向量 $\vv a,\vv b,\vv c$ 的混合积 $(\vv a\times\vv b)\cdot\vv c=\det(\vv a,\vv b,\vv c)$ 是平行六面体的有向体积。

### 应用
多元积分的换元公式中 $\abs{\det J}$ 正是局部体积的伸缩率，见 [[jacobian]]。
