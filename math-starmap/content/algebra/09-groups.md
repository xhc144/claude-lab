---
galaxy: algebra
cluster: groups
title: 群与子群
en: Groups and subgroups
order: 8
level: core
---

## 群 {#group}
type: 定义 | en: Group | w: 5 | 考纲: 群
前置: set, composite-function
后续: subgroup, homomorphism, group-action
alias: 群, 群公理, 阿贝尔群, 交换群, 对称性
anim: dihedral
tags: 群论

集合 $G$ 配一个二元运算，满足：结合律；有单位元 $e$；每个元素有逆元。若运算还可交换，称为阿贝尔群。

### 为什么是这三条
群是“对称”的数学：一个图形的全部对称变换，复合仍是对称（封闭），复合满足结合律，“什么都不做”是单位元，每个对称都可以撤销（逆元）。三条公理恰好提炼了这些性质。

### 例子
$(\Z,+)$；$(\Q^*,\times)$；模 $n$ 加法群 $\Z/n\Z$；正 $n$ 边形的对称群 $D_n$；$n$ 个元素的置换群 $S_n$；可逆矩阵 $\GL_n(\R)$；魔方的全体状态变换。

### 注记
群中可以消去：$ab=ac\Rightarrow b=c$；方程 $ax=b$ 有唯一解 $x=a^{-1}b$。$(ab)^{-1}=b^{-1}a^{-1}$。

## 循环群 {#cyclic-group}
type: 例子 | en: Cyclic group | w: 4 | 考纲: 群, 子群
前置: order-of-element
是例子: group
alias: 循环群, 生成元, Z/nZ

由一个元素生成的群 $\langle g\rangle=\{g^k:k\in\Z\}$。无限循环群同构于 $\Z$，$n$ 阶循环群同构于 $\Z/n\Z$（也同构于 $n$ 次单位根的乘法群）。

### 性质
循环群的子群都是循环群；$n$ 阶循环群对 $n$ 的每个因子 $d$ 恰有一个 $d$ 阶子群；$\Z/n\Z$ 的生成元恰是与 $n$ 互素的剩余类，共 $\varphi(n)$ 个。素数阶的群一定是循环群（由拉格朗日定理）。

## 二面体群 {#dihedral-group}
type: 例子 | en: Dihedral group | w: 4 | 考纲: 群, 对称群
是例子: group
anim: dihedral
alias: D_n, 正多边形的对称群, 二面体群

正 $n$ 边形的全部对称（$n$ 个旋转与 $n$ 个反射）构成 $2n$ 阶群 $D_n$：
$$D_n=\langle r,s\mid r^n=s^2=e,\ srs^{-1}=r^{-1}\rangle.$$

### 例题
$D_3$ 是正三角形的对称群，同构于 $S_3$（对称作用在三个顶点上就是全部置换）。它是最小的非阿贝尔群：先转再翻 $\ne$ 先翻再转。

### 注记
雪花、蜂巢、花瓣的对称都是二面体群；化学中分子的点群包含 $D_n$。

## 子群 {#subgroup}
type: 定义 | en: Subgroup | w: 4 | 考纲: 子群
前置: group
后续: coset, normal-subgroup
alias: 子群, 子群判别法, 生成子群

$G$ 的非空子集 $H$ 在同一运算下构成群，称为子群，记 $H\le G$。判别：$a,b\in H\Rightarrow ab^{-1}\in H$。有限非空子集只需对乘法封闭。

### 例子
$n\Z\le\Z$；$\SL_n\le\GL_n$；$D_n$ 中的旋转构成 $n$ 阶循环子群；$A_n\le S_n$。$\Z$ 的子群全都是 $n\Z$ 的形式。

## 元素的阶 {#order-of-element}
type: 定义 | en: Order of an element | w: 3 | 考纲: 群, 子群
前置: group
后续: cyclic-group, lagrange-group-theorem
alias: 阶, 周期

使 $g^n=e$ 的最小正整数 $n$ 称为 $g$ 的阶；不存在时阶为无穷。$g$ 的阶等于循环子群 $\langle g\rangle$ 的元素个数；$g^m=e\iff\text{阶}\mid m$。

### 例题
$S_3$ 中：单位元阶 $1$，三个对换阶 $2$，两个 $3$-轮换阶 $3$。置换的阶等于其轮换分解中各轮换长度的最小公倍数。

## 陪集 {#coset}
type: 定义 | en: Coset | w: 4 | 考纲: 陪集
前置: subgroup
后续: lagrange-group-theorem, quotient-group
alias: 陪集, 左陪集, 右陪集, 指数, 陪集分解

子群 $H$ 的左陪集 $gH=\{gh:h\in H\}$。左陪集要么相同要么不相交，且每个都与 $H$ 一样大，所以它们把 $G$ 分割成等大的块。块数称为指数 $[G:H]$。

### 直观
$\Z$ 中 $3\Z$ 的陪集是三个剩余类 $3\Z$、$1+3\Z$、$2+3\Z$。在平面上，过原点的直线（子群）的陪集是所有平行于它的直线。

## 拉格朗日定理 {#lagrange-group-theorem}
type: 定理 | en: Lagrange's theorem | w: 5 | 考纲: 陪集, 子群
前置: coset, order-of-element
推出: cauchy-group-theorem
alias: 拉格朗日定理, 子群的阶整除群的阶

有限群 $G$ 的子群 $H$ 的阶整除 $G$ 的阶：$\abs G=[G:H]\cdot\abs H$。特别地，元素的阶整除群的阶，$g^{\abs G}=e$。

### 证明
左陪集把 $G$ 分割为 $[G:H]$ 个不相交的块，每块有 $\abs H$ 个元素（$h\mapsto gh$ 是双射）。

### 推论
- 素数阶群是循环群。
- 费马小定理：$(\Z/p\Z)^\times$ 的阶为 $p-1$，所以 $a^{p-1}\equiv1$；欧拉定理同理。

### 注记
逆命题不成立：$A_4$ 的阶是 $12$，却没有 $6$ 阶子群。部分逆命题是 [[cauchy-group-theorem]] 和 [[sylow-theorems]]。
