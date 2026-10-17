---
galaxy: algebra
cluster: representations
title: 群的表示与特征标
en: Representations and characters
order: 13
level: core
---

## 群的表示 {#group-representation}
type: 定义 | en: Group representation | w: 5 | 考纲: 群的表示
前置: linear-groups, homomorphism, group-action
后续: maschke-theorem, schur-lemma, character
alias: 线性表示, 表示, 不可约表示, 子表示, 平凡表示

群 $G$ 在向量空间 $V$ 上的表示是同态 $\rho:G\to\GL(V)$——让群元素以线性变换的方式作用。$V$ 的子空间若对所有 $\rho(g)$ 不变，称为子表示；没有非平凡子表示的表示称为不可约的。

### 例子
- 平凡表示：$\rho(g)=1$；
- 符号表示：$S_n\to\{\pm1\}$；
- 置换表示：$S_n$ 置换 $\C^n$ 的坐标；它分解为平凡表示（向量 $(1,\dots,1)$ 张成）与 $n-1$ 维的“标准表示”（坐标和为零的向量）；
- 循环群 $\Z/n\Z$ 的一维表示：$k\mapsto\ee^{2\pi\ii jk/n}$。

### 为什么研究表示
抽象群难以直接把握，线性代数却有完整的工具。表示把群“投影”到矩阵上：物理中，对称群的表示决定了量子态的分类（原子轨道、粒子的自旋）；化学中，分子对称群的表示决定了振动模式与光谱选择定则。

## 马施克定理 {#maschke-theorem}
type: 定理 | en: Maschke's theorem | w: 4 | 考纲: 群的表示
前置: group-representation, direct-sum
推出: irreducible-decomposition
alias: 完全可约性, Maschke 定理, 平均化技巧

有限群在复数域（或特征不整除 $\abs G$ 的域）上的表示都是完全可约的：每个子表示都有不变的补空间，因而每个表示都是不可约表示的直和。

### 证明
取任意内积，对群平均得到不变内积 $\inner{\vv u}{\vv v}_G=\frac1{\abs G}\sum_g\inner{\rho(g)\vv u}{\rho(g)\vv v}$。在不变内积下，子表示 $W$ 的正交补 $W^\perp$ 也是不变的。（或者：把任意投影 $\pi:V\to W$ 平均化为 $\frac1{\abs G}\sum_g\rho(g)\pi\rho(g)^{-1}$，它与群作用交换，其核就是不变补。）

### 注记
特征为 $p$ 的域上 $\Z/p\Z$ 的表示 $k\mapsto\begin{pmatrix}1&k\\0&1\end{pmatrix}$ 不完全可约；无限群 $(\R,+)$ 的表示 $t\mapsto\begin{pmatrix}1&t\\0&1\end{pmatrix}$ 也不完全可约。“平均化”需要有限（或紧）群。

## 舒尔引理 {#schur-lemma}
type: 引理 | en: Schur's lemma | w: 5 | 考纲: 舒尔引理
前置: group-representation, eigenvalue
推出: character-orthogonality
alias: Schur 引理, 交换算子, 同态是数乘

设 $V,W$ 是不可约表示，$T:V\to W$ 是与群作用交换的线性映射（$T\rho_V(g)=\rho_W(g)T$）。则：
1. $T=0$ 或 $T$ 是同构；
2. 若 $V=W$ 是复表示，则 $T=\lambda I$ 为数乘。

### 证明
(1) $\Ker T$ 与 $\im T$ 都是子表示，由不可约性只能是 $0$ 或全空间。
(2) $T$ 在 $\C$ 上有特征值 $\lambda$，$T-\lambda I$ 也与群作用交换且不是同构（有非零核），由 (1) 它为零。

### 推论
阿贝尔群的复不可约表示都是一维的：每个 $\rho(g)$ 都与全部 $\rho(h)$ 交换，由舒尔引理是数乘，于是每个子空间都不变。

## 特征标 {#character}
type: 定义 | en: Character | w: 5 | 考纲: 特征标
前置: group-representation, conjugacy-classes
后续: character-orthogonality, character-table
alias: 特征标, 迹函数, 类函数

表示 $\rho$ 的特征标 $\chi_\rho(g)=\tr\rho(g)$。它是类函数（在共轭类上取常值，因为 $\tr(ABA^{-1})=\tr B$），$\chi(e)=\dim V$，$\chi(g^{-1})=\overline{\chi(g)}$，$\chi_{V\oplus W}=\chi_V+\chi_W$，$\chi_{V\otimes W}=\chi_V\chi_W$。

### 直观
只用每个共轭类上的一个复数，就完全刻画了一个（复）表示：两个表示同构 $\iff$ 特征标相同。把整个矩阵族压缩成一张函数表，而信息一点不丢——这是特征标理论的奇妙之处。

## 特征标的正交关系 {#character-orthogonality}
type: 定理 | en: Orthogonality relations | w: 4 | 考纲: 特征标, 舒尔引理
源于: schur-lemma
前置: character
推出: irreducible-decomposition
alias: 第一正交关系, 特征标内积

在类函数空间上定义 $\inner{\chi}{\psi}=\frac1{\abs G}\sum_{g\in G}\chi(g)\overline{\psi(g)}$。不可约特征标构成规范正交组：
$$\inner{\chi_i}{\chi_j}=\delta_{ij}.$$

### 证明思路
对任意线性映射 $A:V_i\to V_j$，平均 $\tilde A=\frac1{\abs G}\sum_g\rho_j(g)A\rho_i(g)^{-1}$ 与群作用交换。由舒尔引理，$i\ne j$ 时 $\tilde A=0$，$i=j$ 时 $\tilde A=\frac{\tr A}{\dim V_i}I$。对 $A$ 取矩阵单位并求迹即得。

### 推论
表示 $V$ 中不可约表示 $V_i$ 出现的重数为 $\inner{\chi_V}{\chi_i}$；$V$ 不可约 $\iff\inner{\chi_V}{\chi_V}=1$。

## 不可约表示的分类 {#irreducible-decomposition}
type: 定理 | en: Counting irreducible representations | w: 4 | 考纲: 群的表示, 特征标
源于: character-orthogonality, maschke-theorem
前置: regular-representation
alias: 不可约表示个数, 维数平方和, Σd²=|G|

有限群 $G$ 的复不可约表示（在同构意义下）的个数等于共轭类的个数，并且它们的维数满足
$$\sum_id_i^2=\abs G,\qquad d_i\mid\abs G.$$

### 证明思路
正则表示 $\C[G]$ 的特征标在 $e$ 处为 $\abs G$、其余为 $0$，所以每个不可约表示 $V_i$ 在其中出现 $d_i$ 次，比较维数得 $\sum d_i^2=\abs G$。个数的结论来自不可约特征标构成类函数空间的一组基（第二正交关系）。

### 例题
$S_3$ 有 $3$ 个共轭类，所以有 $3$ 个不可约表示，$d_1^2+d_2^2+d_3^2=6$，只能是 $1,1,2$：平凡表示、符号表示、二维标准表示（正三角形的对称作用）。

## 特征标表 {#character-table}
type: 例子 | en: Character table | w: 3 | 考纲: 特征标
前置: irreducible-decomposition
alias: S3 的特征标表, 特征标表

特征标表的行是不可约特征标，列是共轭类。$S_3$（类：$e$、对换 $(12)$ 类 $3$ 个、$3$-轮换 $(123)$ 类 $2$ 个）：

| | $e$ | $(12)$ | $(123)$ |
|:-:|:-:|:-:|:-:|
| 平凡 $\chi_1$ | $1$ | $1$ | $1$ |
| 符号 $\chi_2$ | $1$ | $-1$ | $1$ |
| 标准 $\chi_3$ | $2$ | $0$ | $-1$ |

### 验证
$\inner{\chi_3}{\chi_3}=\frac16(4+3\cdot0+2\cdot1)=1$，不可约；$\inner{\chi_2}{\chi_3}=\frac16(2+0-2)=0$。置换表示 $\C^3$ 的特征标是 $(3,1,0)=\chi_1+\chi_3$。

### 应用
化学中用分子点群的特征标表确定哪些振动模式在红外光谱中可见；特征标表也给出了群的许多结构信息（正规子群可从表中读出）。

## 正则表示 {#regular-representation}
type: 例子 | en: Regular representation | w: 3 | 考纲: 群的表示
前置: group-representation, cayley-theorem
后续: irreducible-decomposition
alias: 正则表示, 群代数, C[G]

$G$ 通过左乘作用在以 $G$ 的元素为基的向量空间 $\C[G]$ 上，得到 $\abs G$ 维的正则表示。它的特征标为 $\chi_{\text{reg}}(e)=\abs G$，$\chi_{\text{reg}}(g)=0$（$g\ne e$），因为 $g\ne e$ 时左乘没有不动的基向量。

### 注记
正则表示包含每个不可约表示，重数等于该表示的维数——它是“所有表示的仓库”。对循环群 $\Z/n\Z$，把正则表示分解为一维表示之和，就是离散傅里叶变换；一般有限群上的傅里叶分析正是以此为基础。
