---
galaxy: algebra
cluster: bilinear
title: 双线性函数与二次型
en: Bilinear forms and quadratic forms
order: 6
level: core
---

## 双线性函数 {#bilinear-form}
type: 定义 | en: Bilinear form | w: 4 | 考纲: 双（多）线性函数
前置: dual-space, matrix-representation
后续: quadratic-form, multilinear-form, matrix-congruence
alias: 双线性型, 度量矩阵, 对称双线性函数, 反对称双线性函数

$f:V\times V\to F$ 对每个变量都是线性的。取基 $\vv e_1,\dots,\vv e_n$，$f(\vv x,\vv y)=\vv x\T A\vv y$，$A=(f(\vv e_i,\vv e_j))$ 是度量矩阵。换基 $P$ 后矩阵变为 $P\T AP$——注意是合同而不是相似。

### 注记
双线性函数分为对称（内积、二次型）与反对称（如平面上的有向面积 $x_1y_2-x_2y_1$、辛形式）。任何双线性函数都是二者之和。非退化的对称双线性函数在相对论中给出闵可夫斯基度量 $x^2+y^2+z^2-c^2t^2$。

## 多线性函数与交错形式 {#multilinear-form}
type: 定义 | en: Multilinear and alternating forms | w: 3 | 考纲: 双（多）线性函数
前置: bilinear-form
特例: determinant
后续: tensor-product, exterior-algebra
alias: 多重线性函数, 交错多线性函数, 斜对称

$f(\vv v_1,\dots,\vv v_k)$ 对每个变量线性。若任意两个变量相等时值为零，称为交错的（等价于交换两个变量变号，特征不为 $2$ 时）。

> [!定理] 行列式的刻画
> $n$ 维空间上的 $n$ 元交错多线性函数构成一维空间；满足 $f(\vv e_1,\dots,\vv e_n)=1$ 的那一个就是行列式。

### 注记
这个刻画是定义行列式最干净的方式，它直接推出 $\det(AB)=\det A\det B$。$k$ 元交错形式构成的空间维数是 $\binom nk$，它们是外代数与微分形式的代数基础。

## 二次型 {#quadratic-form}
type: 定义 | en: Quadratic form | w: 5 | 考纲: 二次型
前置: bilinear-form
后续: sylvester-inertia, positive-definite, principal-axes
alias: 二次型, 标准形, 配方法, 合同对角化

$n$ 元二次齐次多项式 $Q(\vv x)=\vv x\T A\vv x$，$A$ 是对称矩阵。通过可逆线性替换 $\vv x=P\vv y$ 可以化为标准形 $d_1y_1^2+\cdots+d_ny_n^2$，方法有配方法、合同初等变换、以及正交变换（[[principal-axes]]）。

### 例题
$Q=x_1^2+2x_1x_2+3x_2^2=(x_1+x_2)^2+2x_2^2$。令 $y_1=x_1+x_2$，$y_2=x_2$，得 $y_1^2+2y_2^2$，所以 $Q$ 正定。

## 惯性定理 {#sylvester-inertia}
type: 定理 | en: Sylvester's law of inertia | w: 4 | 考纲: 二次型
前置: quadratic-form
alias: 西尔维斯特惯性定理, 正惯性指数, 负惯性指数, 符号差

实二次型化成的规范形 $y_1^2+\cdots+y_p^2-y_{p+1}^2-\cdots-y_r^2$ 中，正项个数 $p$ 与负项个数 $r-p$ 由二次型唯一确定，与所用的可逆线性替换无关。

### 证明
若另有规范形，正项个数 $q<p$。考虑子空间 $U$（第一种坐标下后 $n-p$ 个坐标为零，维数 $p$）与 $W$（第二种坐标下前 $q$ 个坐标为零，维数 $n-q$）。$p+(n-q)>n$，所以 $U\cap W$ 含非零向量 $\vv v$；在 $U$ 中 $Q(\vv v)>0$，在 $W$ 中 $Q(\vv v)\le0$，矛盾。

### 注记
实对称矩阵合同 $\iff$ 秩与正惯性指数都相同。正惯性指数等于正特征值的个数。

## 正定矩阵 {#positive-definite}
type: 定义 | en: Positive definite matrix | w: 5 | 考纲: 二次型
前置: quadratic-form, self-adjoint
后续: cholesky, multivar-extrema, convex-optimization
alias: 正定, 半正定, 顺序主子式, 西尔维斯特判据

实对称矩阵 $A$ 正定：$\vv x\T A\vv x>0$ 对一切 $\vv x\ne\vv0$。以下等价：
1. $A$ 的特征值全为正；
2. 各阶顺序主子式全为正（西尔维斯特判据）；
3. $A=B\T B$，$B$ 可逆（如楚列斯基分解 $A=LL\T$）；
4. $A$ 合同于单位矩阵。

### 例题
$\begin{pmatrix}2&-1&0\\-1&2&-1\\0&-1&2\end{pmatrix}$ 的顺序主子式为 $2,3,4$，正定。它是离散化的 $-\frac{\dd^2}{\dd x^2}$，在数值求解微分方程时反复出现。

### 应用
正定矩阵定义内积；黑塞矩阵正定判别极小值；协方差矩阵半正定；凸二次函数 $\frac12\vv x\T A\vv x-\vv b\T\vv x$ 的唯一极小点是 $A\vv x=\vv b$ 的解（共轭梯度法的出发点）。

## 主轴定理 {#principal-axes}
type: 定理 | en: Principal axis theorem | w: 4 | 考纲: 二次型, 谱定理
源于: spectral-theorem
前置: quadratic-form
应用于: conic-general-equation
alias: 正交变换化二次型为标准形, 二次曲线分类, 二次曲面

实二次型可以经正交变换 $\vv x=Q\vv y$ 化为 $\lambda_1y_1^2+\cdots+\lambda_ny_n^2$，$\lambda_i$ 是 $A$ 的特征值，$Q$ 的列（主轴方向）是规范正交特征向量。

### 例题
$5x^2-4xy+8y^2=36$：矩阵 $\begin{pmatrix}5&-2\\-2&8\end{pmatrix}$，特征值 $4,9$，旋转坐标后为 $4x'^2+9y'^2=36$，即 $\frac{x'^2}9+\frac{y'^2}4=1$，是半轴为 $3,2$ 的椭圆，主轴沿特征向量 $(2,1)$ 与 $(-1,2)$ 方向。

### 注记
正交变换保持长度和角度，所以它不仅给出代数上的标准形，还保留了几何形状——这正是二次曲线、二次曲面分类的依据。

## 合同 {#matrix-congruence}
type: 定义 | en: Congruence of matrices | w: 2 | 考纲: 二次型, 双（多）线性函数
前置: bilinear-form
alias: 合同矩阵, 合同变换, P^TAP

若 $B=P\T AP$，$P$ 可逆，称 $A$ 与 $B$ 合同。同一个双线性函数在不同基下的矩阵彼此合同。

### 对比
- 相似 $P^{-1}AP$：同一线性算子换基，保持特征值；
- 合同 $P\T AP$：同一双线性函数换基，保持秩与惯性指数，不保持特征值；
- 正交相似 $Q\T AQ=Q^{-1}AQ$：两者兼得，所以实对称矩阵用正交变换化简时既是相似又是合同。

## 瑞利商 {#rayleigh-quotient}
type: 定理 | en: Rayleigh quotient | w: 3 | 考纲: 二次型, 谱定理, 特征值计算
前置: spectral-theorem
源于: lagrange-multiplier
应用于: power-method, pca
alias: 瑞利商, 极小极大原理, Courant–Fischer

实对称矩阵 $A$ 的瑞利商 $R(\vv x)=\dfrac{\vv x\T A\vv x}{\vv x\T\vv x}$ 的最大值是最大特征值 $\lambda_{\max}$，最小值是 $\lambda_{\min}$，在对应特征向量处取到。

### 证明
在 $A$ 的规范正交特征基下，$R(\vv x)=\dfrac{\sum\lambda_iy_i^2}{\sum y_i^2}$，是特征值的加权平均。也可用拉格朗日乘数法：在 $\norm{\vv x}=1$ 上求 $\vv x\T A\vv x$ 的极值，得 $A\vv x=\lambda\vv x$。

### 应用
主成分分析的第一主成分就是使投影方差 $\vv w\T\Sigma\vv w$（$\norm{\vv w}=1$）最大的方向；振动系统的基频；图的谱划分。
