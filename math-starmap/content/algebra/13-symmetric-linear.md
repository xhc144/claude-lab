---
galaxy: algebra
cluster: symmetric-linear
title: 对称群、线性群与自由群
en: Symmetric, linear and free groups
order: 12
level: core
---

## 对称群 {#symmetric-group}
type: 定义 | en: Symmetric group | w: 5 | 考纲: 对称群
前置: group, permutation
后续: permutation-cycles, cayley-theorem, alternating-group
alias: 置换群, S_n, 对称群

集合 $\{1,\dots,n\}$ 上全体置换（双射）在复合下构成 $n!$ 阶群 $S_n$。$n\ge3$ 时 $S_n$ 非交换。

### 注记
由凯莱定理，每个有限群都是某个 $S_n$ 的子群，所以对称群包含了有限群的全部复杂性。$S_n$ 由相邻对换 $(1\,2),(2\,3),\dots,(n-1\,n)$ 生成——这就是冒泡排序能排好任何序列的原因。

## 轮换分解 {#permutation-cycles}
type: 定理 | en: Cycle decomposition | w: 4 | 考纲: 对称群
前置: symmetric-group
后续: sign-of-permutation
alias: 轮换, 对换, 不相交轮换, 轮换型

每个置换都能唯一地（不计顺序）写成不相交轮换之积。例如
$$\begin{pmatrix}1&2&3&4&5&6\\3&5&1&6&2&4\end{pmatrix}=(1\,3)(2\,5)(4\,6).$$
不相交的轮换彼此可交换；置换的阶是各轮换长度的最小公倍数。

### 例题
洗牌问题：完美洗牌（把一副 $52$ 张牌对半分、交替插入，顶牌保持在顶部）重复 $8$ 次回到原顺序，因为这个置换的轮换长度的最小公倍数是 $8$。

## 置换的符号 {#sign-of-permutation}
type: 定义 | en: Sign of a permutation | w: 4 | 考纲: 对称群, 行列式
前置: permutation-cycles
后续: alternating-group
应用于: determinant
alias: 奇置换, 偶置换, 逆序数, 符号

每个置换都能写成对换之积，对换个数的奇偶性是确定的。偶置换符号 $+1$，奇置换 $-1$；$\sgn\sigma=(-1)^{\text{逆序数}}$，$k$-轮换的符号为 $(-1)^{k-1}$。

### 证明（良定义）
考虑 $\Delta=\prod_{i<j}(x_j-x_i)$。置换变量后 $\Delta\mapsto\pm\Delta$，任一对换使 $\Delta$ 变号。所以若 $\sigma$ 是 $k$ 个对换之积，则 $\sigma$ 把 $\Delta$ 变为 $(-1)^k\Delta$，奇偶性由 $\sigma$ 唯一确定。

### 应用
$\sgn:S_n\to\{\pm1\}$ 是同态。行列式的定义中用到它；15 数码推盘问题中，交换 14 与 15 的局面不可解，因为它对应奇置换（配合空格位置的奇偶性）。

## 交错群 {#alternating-group}
type: 定义 | en: Alternating group | w: 3 | 考纲: 对称群
前置: sign-of-permutation
后续: simple-groups
alias: A_n, 偶置换群

$S_n$ 中全体偶置换构成的子群 $A_n=\Ker\sgn$，阶为 $\frac{n!}2$，是正规子群。$A_4$ 同构于正四面体的旋转群，$A_5$ 同构于正二十面体的旋转群。

### 注记
$n\ge5$ 时 $A_n$ 是单群，$S_n$ 不可解。$A_4$ 不是单群：它有正规子群 $\{e,(12)(34),(13)(24),(14)(23)\}$（克莱因四元群）。

## 线性群 {#linear-groups}
type: 定义 | en: Linear groups | w: 4 | 考纲: 线性群
前置: inverse-matrix, orthogonal-matrix, group
后续: group-representation
alias: 一般线性群, 特殊线性群, 正交群, 酉群, GL, SL, SO, U(n), 李群

矩阵群：$\GL_n(F)$（可逆矩阵）、$\SL_n(F)$（行列式为 $1$）、$\Or(n)$（正交矩阵）、$\SO(n)$（行列式为 $1$ 的正交矩阵，即旋转）、$U(n)$、$SU(n)$。有限域上的 $\GL_n(\F_q)$ 是有限群，阶为 $(q^n-1)(q^n-q)\cdots(q^n-q^{n-1})$。

### 例题
$\abs{\GL_2(\F_2)}=(4-1)(4-2)=6$，它作用在 $\F_2^2$ 的三个非零向量上，同构于 $S_3$。

### 注记
$\SO(2)\cong S^1$（单位复数）；$SU(2)$ 是三维球面，它二对一地覆盖 $\SO(3)$（自旋 $\frac12$ 的来源）。线性群既是群又是光滑流形（李群），是物理对称性的语言。

## 三维旋转群与正多面体 {#rotation-groups}
type: 例子 | en: Finite rotation groups | w: 3 | 考纲: 线性群, 群作用
前置: linear-groups, orbit-stabilizer
是例子: group-action
相关: platonic-solids
alias: SO(3) 的有限子群, 正多面体群, 点群

$\SO(3)$ 的有限子群只有：循环群 $C_n$、二面体群 $D_n$、正四面体群（$\cong A_4$，$12$ 阶）、正八面体群（$\cong S_4$，$24$ 阶）、正二十面体群（$\cong A_5$，$60$ 阶）。

### 证明思路
有限旋转群 $G$ 的每个非单位元有两个“极点”（转轴与单位球面的交点）。对极点集合计数：$2(\abs G-1)=\sum_{\text{极点轨道}}\abs{\text{轨道}}(\abs{\text{稳定子}}-1)$，即 $2-\frac2{\abs G}=\sum_i\left(1-\frac1{n_i}\right)$，其正整数解只有上面几类。这是轨道-稳定子定理的漂亮应用。

## 自由群 {#free-group}
type: 定义 | en: Free group | w: 3 | 考纲: 自由群
前置: group, homomorphism
后续: group-presentation
相关: fundamental-group
alias: 自由群, 既约字, 泛性质

由集合 $S$ 生成的自由群 $F(S)$ 的元素是由 $S$ 中字母及其逆组成的既约字（没有相邻的 $aa^{-1}$），运算是拼接后约化。泛性质：任意映射 $S\to G$ 唯一延拓为同态 $F(S)\to G$。

### 例题
$F_2=F(a,b)$ 中 $ab\ne ba$，$abab^{-1}a^{-1}$ 是一个长度为 $5$ 的元素。“8 字形”（两个圆在一点粘合）的基本群就是 $F_2$。

### 注记
自由群的子群仍是自由群（尼尔森–施赖尔定理），$F_2$ 竟然包含 $F_3$、$F_\infty$ 作为子群。$F_2$ 在 $\SO(3)$ 中的实现是巴拿赫–塔斯基悖论的核心。

## 生成元与关系 {#group-presentation}
type: 定义 | en: Group presentations | w: 3 | 考纲: 生成元关系, 自由群
前置: free-group, quotient-group
alias: 群的表现, 生成元与关系, 字问题

每个群都是自由群的商：$G=\langle S\mid R\rangle=F(S)/N(R)$，$N(R)$ 是关系 $R$ 生成的正规子群。

### 例子
$\Z/n\Z=\langle a\mid a^n\rangle$；$\Z^2=\langle a,b\mid aba^{-1}b^{-1}\rangle$（环面的基本群）；$D_n=\langle r,s\mid r^n,s^2,srsr\rangle$；$S_3=\langle a,b\mid a^2,b^2,(ab)^3\rangle$。

### 注记
用有限表现描述群很方便，但判断两个字是否表示同一元素（字问题）一般是不可判定的（诺维科夫–布恩，1955）。
