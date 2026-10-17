---
galaxy: algebra
cluster: eigen
title: 特征值与标准形
en: Eigenvalues and canonical forms
order: 4
level: core
---

## 特征值与特征向量 {#eigenvalue}
type: 定义 | en: Eigenvalues and eigenvectors | w: 5 | 考纲: 特征值
前置: matrix-representation, invariant-subspace
后续: characteristic-polynomial, diagonalization
alias: 特征值, 特征向量, 特征子空间, 本征值
anim: linear-map
tags: 特征值

若 $T\vv v=\lambda\vv v$，$\vv v\ne\vv0$，称 $\lambda$ 为特征值，$\vv v$ 为属于 $\lambda$ 的特征向量。特征向量是被 $T$ 只伸缩、不转向的方向。

### 直观
在线性变换动画中，大多数向量都被扭转了方向，只有少数特殊方向上的向量仍留在原来的直线上，只是长度乘了 $\lambda$ 倍（$\lambda<0$ 时反向）。沿这些方向取基，变换就变成了各坐标轴上的独立伸缩。

### 注记
- 属于不同特征值的特征向量线性无关。
- 实矩阵可能没有实特征值（平面旋转 $90^\circ$ 不保持任何直线），但在复数域上一定有（[[fundamental-theorem-algebra]]）。
- 特征值是“不依赖坐标”的量：相似矩阵特征值相同。

## 特征多项式 {#characteristic-polynomial}
type: 定义 | en: Characteristic polynomial | w: 4 | 考纲: 特征值
前置: eigenvalue, determinant
后续: cayley-hamilton, minimal-polynomial
alias: 特征方程, 迹, 代数重数, 几何重数

$\lambda$ 是特征值 $\iff$ $A-\lambda I$ 不可逆 $\iff\det(\lambda I-A)=0$。$p_A(\lambda)=\det(\lambda I-A)$ 是首一 $n$ 次多项式，
$$p_A(\lambda)=\lambda^n-(\tr A)\lambda^{n-1}+\cdots+(-1)^n\det A,$$
所以特征值之和等于迹，之积等于行列式。

### 注记
特征值作为根的重数叫代数重数，特征子空间的维数叫几何重数，总有 $1\le$ 几何重数 $\le$ 代数重数。$AB$ 与 $BA$ 的特征多项式相同（即使它们不相似）。

## 对角化 {#diagonalization}
type: 定理 | en: Diagonalization | w: 5 | 考纲: 特征值, 矩阵表示
前置: eigenvalue, characteristic-polynomial, similarity
后续: jordan-form, matrix-powers
推广为: spectral-theorem
alias: 可对角化, 相似对角化, 特征分解

$A$ 可对角化（相似于对角矩阵）$\iff$ $A$ 有 $n$ 个线性无关的特征向量 $\iff$ 每个特征值的几何重数等于代数重数 $\iff$ 最小多项式无重根（在包含全部特征值的域上）。此时 $A=P\Lambda P^{-1}$，$P$ 的列是特征向量。

### 充分条件
$n$ 个不同特征值；实对称矩阵（[[spectral-theorem]]）。

### 例题
$A=\begin{pmatrix}2&1\\1&2\end{pmatrix}$：特征值 $3,1$，特征向量 $(1,1)\T,(1,-1)\T$，所以 $A^n=P\begin{pmatrix}3^n&0\\0&1\end{pmatrix}P^{-1}=\frac12\begin{pmatrix}3^n+1&3^n-1\\3^n-1&3^n+1\end{pmatrix}$。

### 反例
$\begin{pmatrix}1&1\\0&1\end{pmatrix}$（剪切）只有特征值 $1$，特征子空间只是一条直线，不可对角化——这正是需要 [[jordan-form]] 的地方。

## 凯莱-哈密顿定理 {#cayley-hamilton}
type: 定理 | en: Cayley–Hamilton theorem | w: 4 | 考纲: 特征值, 若尔当标准形
前置: characteristic-polynomial, adjugate
推出: minimal-polynomial
alias: Cayley–Hamilton, 矩阵满足自己的特征方程

每个方阵都是它自己特征多项式的根：$p_A(A)=0$。

### 证明
设 $B(\lambda)=(\lambda I-A)^*$（伴随矩阵），其元素是 $\lambda$ 的至多 $n-1$ 次多项式，写成 $B(\lambda)=\sum_{k=0}^{n-1}B_k\lambda^k$。由 $(\lambda I-A)B(\lambda)=p_A(\lambda)I$ 比较 $\lambda$ 各次幂的系数（矩阵系数），再左乘 $A$ 的相应幂并相加，左边裂项相消为零，右边为 $p_A(A)$。

### 易错
“把 $\lambda=A$ 代入 $\det(\lambda I-A)$ 得 $\det(A-A)=0$”是错误证明：那样得到的是数 $0$，而定理断言的是矩阵等于零矩阵。

### 应用
$A^n$ 可用 $I,A,\dots,A^{n-1}$ 线性表示；可逆时 $A^{-1}$ 也是 $A$ 的多项式。二阶：$A^2-(\tr A)A+(\det A)I=0$。

## 最小多项式 {#minimal-polynomial}
type: 定义 | en: Minimal polynomial | w: 3 | 考纲: 若尔当标准形, 特征值
源于: cayley-hamilton
后续: jordan-form
alias: 极小多项式, 零化多项式

使 $m(A)=0$ 的次数最低的首一多项式。它整除每个零化多项式（包括特征多项式），并且与特征多项式有相同的根（不计重数）。

> [!定理] 可对角化判据
> $A$ 在 $F$ 上可对角化 $\iff$ 最小多项式在 $F$ 上分解为互不相同的一次因式之积。

### 例题
满足 $A^2=A$ 的矩阵（投影）可对角化，特征值只能是 $0,1$；满足 $A^k=I$ 的复矩阵可对角化，特征值都是 $k$ 次单位根；满足 $A^k=0$ 的矩阵（幂零）若不是零矩阵则不可对角化。

## 广义特征子空间 {#generalized-eigenspace}
type: 定理 | en: Generalized eigenspace decomposition | w: 3 | 考纲: 若尔当标准形, 直和
前置: minimal-polynomial, direct-sum, invariant-subspace
推出: jordan-form
alias: 根子空间, 准素分解, 广义特征向量

$\lambda$ 的广义特征子空间 $V_\lambda=\Ker(A-\lambda I)^{n}$。若特征多项式在 $F$ 上分解为一次因式，则
$$V=V_{\lambda_1}\oplus\cdots\oplus V_{\lambda_k},$$
每个 $V_{\lambda_i}$ 都是 $A$-不变的，维数等于 $\lambda_i$ 的代数重数，且 $A-\lambda_iI$ 在其上幂零。

### 证明思路
设 $p_A=\prod(\lambda-\lambda_i)^{m_i}$。多项式 $q_i=p_A/(\lambda-\lambda_i)^{m_i}$ 的最大公因式为 $1$，由贝祖等式存在 $u_i$ 使 $\sum u_iq_i=1$。于是 $I=\sum u_i(A)q_i(A)$，$E_i=u_i(A)q_i(A)$ 是到 $V_{\lambda_i}$ 的投影——中国剩余定理在矩阵上的版本。

## 若尔当标准形 {#jordan-form}
type: 定理 | en: Jordan normal form | w: 5 | 考纲: 若尔当标准形
源于: generalized-eigenspace
前置: similarity, diagonalization
用到: fundamental-theorem-algebra
应用于: matrix-exponential
alias: Jordan 标准形, 约当标准形, 若尔当块, 约当块

每个复方阵都相似于若尔当标准形——由若尔当块组成的块对角矩阵，且在不计块的顺序时唯一：
$$J_k(\lambda)=\begin{pmatrix}\lambda&1&&\\&\lambda&\ddots&\\&&\ddots&1\\&&&\lambda\end{pmatrix}_{k\times k}.$$

### 怎样确定
特征值 $\lambda$ 对应的若尔当块个数 $=\dim\Ker(A-\lambda I)$（几何重数）；阶数 $\ge k$ 的块的个数 $=\dim\Ker(A-\lambda I)^k-\dim\Ker(A-\lambda I)^{k-1}$；最大块的阶数等于 $\lambda$ 在最小多项式中的重数。

### 证明思路
由 [[generalized-eigenspace]] 只需处理幂零算子 $N=A-\lambda I$。对幂零算子，取 $\Ker N^k$ 的逐层补空间的基，沿 $N$ 作用串成“链” $\vv v,N\vv v,\dots,N^{m-1}\vv v$，每条链张成一个若尔当块。

### 例题
$A=\begin{pmatrix}3&1&0\\0&3&0\\0&0&3\end{pmatrix}$：特征值 $3$（三重），$\dim\Ker(A-3I)=2$，所以有两个块：$J_2(3)\oplus J_1(3)$，它已经是标准形。

### 应用
计算矩阵函数：$J_k(\lambda)^n$ 与 $\ee^{tJ_k(\lambda)}$ 有显式公式，从而解出线性常微分方程组与线性递推；判断矩阵相似。

## 矩阵的幂与线性递推 {#matrix-powers}
type: 应用 | en: Matrix powers and linear recurrences | w: 3 | 考纲: 特征值, 递推关系
前置: diagonalization
例子: fibonacci
应用于: markov-chain
alias: 矩阵快速幂, 斐波那契矩阵

线性递推可以写成矩阵的幂：斐波那契数列满足
$$\begin{pmatrix}F_{n+1}\\F_n\end{pmatrix}=\begin{pmatrix}1&1\\1&0\end{pmatrix}^n\begin{pmatrix}1\\0\end{pmatrix}.$$
对角化后 $A^n=P\Lambda^nP^{-1}$，长期行为由绝对值最大的特征值决定。

### 例题
斐波那契矩阵特征值 $\varphi=\frac{1+\sqrt5}2$ 与 $\psi=\frac{1-\sqrt5}2$，得比内公式 $F_n=\frac{\varphi^n-\psi^n}{\sqrt5}$，并且 $\frac{F_{n+1}}{F_n}\to\varphi$（黄金比）。

### 应用
用“反复平方”计算 $A^n$ 只需 $O(\log n)$ 次矩阵乘法；马尔可夫链的 $n$ 步转移矩阵 $P^n$ 在 $n\to\infty$ 时趋于由平稳分布组成的矩阵，见 [[markov-chain]]。

## 矩阵指数 {#matrix-exponential}
type: 定义 | en: Matrix exponential | w: 3 | 考纲: 特征值, 若尔当标准形
前置: jordan-form, power-series
应用于: linear-ode-constant, linear-groups
alias: e^A, 矩阵指数函数, 线性微分方程组

$$\ee^A=\sum_{k=0}^\infty\frac{A^k}{k!}.$$
级数对任何方阵绝对收敛。线性方程组 $\vv x'=A\vv x$，$\vv x(0)=\vv x_0$ 的解是 $\vv x(t)=\ee^{tA}\vv x_0$。

### 性质
$AB=BA$ 时 $\ee^{A+B}=\ee^A\ee^B$（不可交换时一般不成立）；$\det\ee^A=\ee^{\tr A}$；$A=P\Lambda P^{-1}$ 时 $\ee^A=P\ee^\Lambda P^{-1}$。

### 例题
$A=\begin{pmatrix}0&-1\\1&0\end{pmatrix}$（$A^2=-I$）：$\ee^{tA}=I\cos t+A\sin t=\begin{pmatrix}\cos t&-\sin t\\\sin t&\cos t\end{pmatrix}$——旋转矩阵。这是欧拉公式 $\ee^{\ii t}=\cos t+\ii\sin t$ 的矩阵版本，也是李群 $\SO(2)$ 与其李代数的联系。
