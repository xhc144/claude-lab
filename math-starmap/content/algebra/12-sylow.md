---
galaxy: algebra
cluster: sylow
title: 西罗定理与有限群
en: Sylow theorems and finite groups
order: 11
level: core
---

## 柯西定理（群论） {#cauchy-group-theorem}
type: 定理 | en: Cauchy's theorem for groups | w: 3 | 考纲: 西罗定理, 群作用
源于: lagrange-group-theorem
前置: group-action
推广为: sylow-theorems
alias: 柯西定理, 存在 p 阶元

若素数 $p$ 整除有限群 $G$ 的阶，则 $G$ 有 $p$ 阶元素。

### 证明
（麦凯）考虑集合 $X=\{(g_1,\dots,g_p)\in G^p:g_1g_2\cdots g_p=e\}$，$\abs X=\abs G^{p-1}$ 被 $p$ 整除。循环群 $\Z/p\Z$ 通过轮换坐标作用在 $X$ 上（$g_1\cdots g_p=e$ 蕴含 $g_2\cdots g_pg_1=e$），轨道大小为 $1$ 或 $p$。大小为 $1$ 的轨道是 $(g,\dots,g)$，$g^p=e$。$(e,\dots,e)$ 是一个，而这样的点的个数 $\equiv\abs X\equiv0\pmod p$，所以至少还有 $p-1$ 个，它们给出 $p$ 阶元。

## 西罗定理 {#sylow-theorems}
type: 定理 | en: Sylow theorems | w: 5 | 考纲: 西罗定理
前置: p-group-center, orbit-stabilizer
源于: cauchy-group-theorem
后续: groups-of-order-pq
alias: Sylow 定理, 西罗子群, Sylow p-子群

设 $\abs G=p^km$，$p\nmid m$。阶为 $p^k$ 的子群称为西罗 $p$-子群。
1. **存在**：西罗 $p$-子群存在；
2. **共轭**：任意两个西罗 $p$-子群共轭，任何 $p$-子群都包含在某个西罗 $p$-子群中；
3. **计数**：西罗 $p$-子群的个数 $n_p$ 满足 $n_p\equiv1\pmod p$ 且 $n_p\mid m$。

### 证明思路
(1)（维兰特）$G$ 左乘作用在所有 $p^k$ 元子集上，子集总数 $\binom{p^km}{p^k}$ 不被 $p$ 整除，所以存在大小不被 $p$ 整除的轨道；该轨道中某个子集的稳定子阶恰为 $p^k$。
(2)(3) 让西罗子群 $P$ 通过共轭作用在全体西罗 $p$-子群上，再用轨道-稳定子定理与“$p$ 群作用的不动点个数 $\equiv$ 总数 $\pmod p$”。

### 应用
推论：$n_p=1\iff$ 西罗 $p$-子群正规。这是判断“某阶的群不是单群”的主要工具。例如 $15$ 阶群：$n_3\mid5$ 且 $\equiv1\pmod3$，故 $n_3=1$；$n_5\mid3$ 且 $\equiv1\pmod5$，故 $n_5=1$。两个子群都正规且交为平凡，$G\cong\Z/3\Z\times\Z/5\Z\cong\Z/15\Z$。

## pq 阶群 {#groups-of-order-pq}
type: 例题 | en: Groups of order pq | w: 3 | 考纲: 西罗定理
前置: sylow-theorems, direct-product
alias: pq 阶群的分类, 2p 阶群

设 $p<q$ 是素数，$\abs G=pq$。由西罗定理 $n_q=1$，$q$ 阶子群 $Q$ 正规。
- 若 $p\nmid q-1$，则 $n_p=1$，$G\cong\Z/pq\Z$ 是循环群；
- 若 $p\mid q-1$，还有一个非阿贝尔群（半直积 $\Z/q\Z\rtimes\Z/p\Z$）。

### 例题
$p=2$：$2q$ 阶群是 $\Z/2q\Z$ 或二面体群 $D_q$。$6$ 阶群只有 $\Z/6\Z$ 与 $S_3\cong D_3$；$35$ 阶群只有循环群（$5\nmid6$）。

## 单群与 A₅ {#simple-groups}
type: 概念 | en: Simple groups | w: 3 | level: ext
前置: normal-subgroup, alternating-group, sylow-theorems
相关: quintic-insolvability
alias: 单群, A5 是单群, 有限单群分类, 可解群

没有非平凡正规子群的群叫单群。它们是有限群的“原子”：每个有限群都有合成列，其因子都是单群（若尔当–赫尔德定理）。

### 例题
$A_5$（$60$ 阶）是最小的非阿贝尔单群。证明：$A_5$ 的共轭类大小为 $1,12,12,15,20$；正规子群是若干共轭类的并且包含单位元，阶需整除 $60$，而 $1$ 加上其余类大小的任何非空子和都不能等于 $2,3,4,5,6,10,12,15,20,30$ 之一（只有 $1$ 与 $60$ 可行）。

### 注记
$A_5$ 不可解，这是一般五次方程不能用根式求解的群论原因。有限单群的分类（约 1983 年基本完成）是数学史上最庞大的证明之一，包括 18 个无穷族和 26 个散在单群，最大的是约 $8\times10^{53}$ 阶的“魔群”。
