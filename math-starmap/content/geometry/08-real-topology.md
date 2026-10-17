---
galaxy: geometry
cluster: real-topology
title: 实数轴的拓扑
en: Topology of the real line
order: 8
level: core
---

## 开集 {#open-set}
type: 定义 | en: Open sets | w: 4 | 考纲: 实数轴的开集
前置: real-number-system, absolute-value
后续: closed-set, continuity-topological, topological-space
alias: 开集, 邻域, 内点, 开区间

$U\subseteq\R$ 是开集：每个点 $x\in U$ 都有一个邻域 $(x-\eps,x+\eps)$ 完全落在 $U$ 中（每个点都是内点）。开区间、开区间的任意并、有限交都是开集。

> [!定理] 开集的结构
> $\R$ 中每个非空开集都是可数个互不相交的开区间之并。

### 证明
对 $x\in U$，取包含 $x$ 且含于 $U$ 的最大开区间（构成区间的并），这些“极大区间”两两不交；每个区间含一个有理数，所以至多可数个。

### 注记
无限个开集的交不一定是开集：$\bigcap_n\left(-\frac1n,\frac1n\right)=\{0\}$。

## 闭集 {#closed-set}
type: 定义 | en: Closed sets | w: 4 | 考纲: 实数轴的闭集
前置: open-set, sequence-limit
后续: compactness, cantor-set
alias: 闭集, 聚点, 闭包, 极限点, 孤立点

补集为开集的集合称为闭集。等价地：闭集包含它的全部聚点；或者，闭集中的收敛数列极限仍在其中。集合 $A$ 的闭包 $\bar A$ 是包含 $A$ 的最小闭集，等于 $A$ 加上它的聚点。

### 例子
闭区间、有限集、$\Z$、康托尔集是闭集；$\Q$ 既不开也不闭，$\bar\Q=\R$（$\Q$ 稠密）；$\R$ 与 $\varnothing$ 既开又闭。

### 注记
“开”和“闭”不是反义词。在 $\R$ 中，既开又闭的子集只有 $\varnothing$ 与 $\R$——这正是 $\R$ 连通的含义（[[connectedness]]）。

## 紧致性 {#compactness}
type: 定义 | en: Compactness | w: 5 | 考纲: 实数轴的紧致性
前置: closed-set
源于: extreme-value-theorem
后续: heine-borel
alias: 紧集, 紧致, 有限覆盖, 列紧

集合 $K$ 紧致：$K$ 的每个开覆盖都有有限子覆盖。在 $\R$（以及度量空间）中等价于列紧：$K$ 中每个数列都有收敛到 $K$ 中某点的子列。

### 直观
紧致是“有限”的拓扑替身：无穷多个点挤在紧集里必然在某处聚集；无穷多个开集覆盖紧集时，其实有限个就够了。正因如此，“局部成立 $\Rightarrow$ 整体一致成立”的论证（一致连续、一致有界）都在紧集上进行。

### 注记
紧集的连续像是紧集，所以紧集上的连续实函数有界且取到最值——这是 [[extreme-value-theorem]] 的抽象形式。

## 海涅-博雷尔定理 {#heine-borel}
type: 定理 | en: Heine–Borel theorem | w: 5 | 考纲: 实数轴的紧致性, 实数轴的完备性
前置: compactness, nested-intervals
等价: bolzano-weierstrass
alias: 有限覆盖定理, Heine–Borel, 有界闭集

$\R$（以及 $\R^n$）中，集合紧致 $\iff$ 有界闭集。特别地，闭区间 $[a,b]$ 的任何开覆盖都有有限子覆盖。

### 证明
（闭区间情形，区间套法）反设 $[a,b]$ 的某个开覆盖没有有限子覆盖。二分区间，至少一半也没有有限子覆盖；继续二分得到闭区间套，由 [[nested-intervals]] 有公共点 $\xi$。$\xi$ 属于覆盖中的某个开集 $U$，而区间长度趋于零，所以从某步起整个小区间含于 $U$——一个开集就覆盖了它，矛盾。

### 注记
在无穷维空间中有界闭集不一定紧：$\ell^2$ 中单位向量 $\vv e_n$ 两两距离 $\sqrt2$，没有收敛子列。

## 致密性定理 {#bolzano-weierstrass}
type: 定理 | en: Bolzano–Weierstrass theorem | w: 5 | 考纲: 实数轴的紧致性, 实数轴的完备性
前置: subsequence
源于: nested-intervals
后续: cauchy-criterion, extreme-value-theorem
alias: 魏尔斯特拉斯定理, 波尔查诺-魏尔斯特拉斯, 有界数列必有收敛子列, 列紧

有界数列必有收敛子列。

### 证明
设 $a_n\in[a,b]$。二分区间，总有一半含有数列的无穷多项；不断二分得到闭区间套，每个区间都含无穷多项。在第 $k$ 个区间中选一项 $a_{n_k}$，使 $n_1<n_2<\cdots$。由区间套定理 $a_{n_k}\to\xi$。
另一证法：每个数列都有单调子列（“山峰引理”），有界单调子列收敛。

### 注记
它是 [[cauchy-criterion]]、[[extreme-value-theorem]]、[[cantor-uniform]] 证明中的核心工具。

## 实数完备性的等价表述 {#completeness-equivalences}
type: 定理 | en: Equivalent forms of completeness | w: 5 | 考纲: 实数轴的完备性
前置: supremum, monotone-convergence, nested-intervals, cauchy-criterion, bolzano-weierstrass, heine-borel
alias: 实数完备性, 六大定理, 实数基本定理

在有序域（满足域公理与序公理，并有阿基米德性质）中，以下六条两两等价，任何一条都可以作为完备性公理：
1. 确界原理；
2. 单调有界定理；
3. 闭区间套定理；
4. 柯西收敛准则；
5. 致密性定理（波尔查诺–魏尔斯特拉斯）；
6. 有限覆盖定理（海涅–博雷尔）。

### 证明路线
$1\Rightarrow2\Rightarrow3\Rightarrow5\Rightarrow4\Rightarrow3$，$3\Rightarrow6$，$6\Rightarrow5$（反证：若有界数列无收敛子列，每点有一个只含有限项的邻域，有限子覆盖导致只有有限项），$4\Rightarrow1$（二分法构造逼近上确界的柯西列）。柯西准则与区间套推出确界原理时需要阿基米德性质。

### 直观
六条定理从不同角度说同一件事：实数轴没有缝隙。这张等价关系图在星图里形成一个紧密的星座。

## 连续性的拓扑刻画 {#continuity-topological}
type: 定理 | en: Topological characterization of continuity | w: 4 | 考纲: 实数轴的连续性
前置: open-set
源于: continuity
后续: topological-space, knot
alias: 开集的原像是开集, 同胚, 拓扑等价

$f:\R\to\R$ 连续 $\iff$ 每个开集的原像是开集 $\iff$ 每个闭集的原像是闭集。这个刻画不再提 $\eps$ 和 $\delta$，可以推广到任何拓扑空间。

### 证明
设 $f$ 连续，$V$ 开，$x\in f^{-1}(V)$。$f(x)$ 有邻域 $(f(x)-\eps,f(x)+\eps)\subseteq V$，由连续性存在 $\delta$ 使 $(x-\delta,x+\delta)\subseteq f^{-1}(V)$。反之，对开集 $V=(f(x)-\eps,f(x)+\eps)$，原像是含 $x$ 的开集，含某个 $(x-\delta,x+\delta)$。

### 注记
连续双射且逆也连续的映射叫同胚，同胚的空间在拓扑上“相同”。拓扑学研究同胚下不变的性质：连通性、紧致性、欧拉示性数、基本群。

## 连通性 {#connectedness}
type: 定义 | en: Connectedness | w: 4 | 考纲: 实数轴的连续性, 实数轴的拓扑
前置: open-set, closed-set
源于: ivt
alias: 连通, 道路连通, 区间的连通性

空间不能分成两个不交的非空开集，称为连通的。$\R$ 的连通子集恰好是区间。连续映射保持连通性：连通集的连续像连通。

### 证明（区间连通）
反设 $[a,b]=U\cup V$，$U,V$ 是不交的非空相对开集，$a\in U$。令 $s=\sup\{x:[a,x]\subseteq U\}$，则 $s$ 既不能在 $U$ 中（$U$ 开，可以再往右）也不能在 $V$ 中（$V$ 开，$s$ 左边附近有 $U$ 的点），矛盾。

### 推论
介值定理就是“$[a,b]$ 连通，连续像 $f([a,b])$ 连通，因而是区间”。道路连通（任意两点可用连续曲线相连）蕴含连通；拓扑学家的正弦曲线连通但不道路连通。

## 康托尔集 {#cantor-set}
type: 例子 | en: Cantor set | w: 4 | 考纲: 实数轴的闭集, 实数轴的紧致性
前置: closed-set, geometric-series
是例子: compactness
alias: 康托尔三分集, 分形, 自相似, 魔鬼阶梯

从 $[0,1]$ 去掉中间三分之一开区间 $\left(\frac13,\frac23\right)$，再从剩下两段各去掉中间三分之一，无限进行下去，剩下的点集。

### 性质
- 去掉的总长度 $\frac13+\frac29+\frac4{27}+\cdots=1$，所以康托尔集的测度（长度）为 $0$；
- 却不可数：它恰好是三进制展开中只用数字 $0,2$ 的数，与二进制序列（$0\to0$，$2\to1$）一一对应，与 $[0,1]$ 等势；
- 紧致、完全（每点都是聚点）、无处稠密、自相似，豪斯多夫维数 $\frac{\ln2}{\ln3}\approx0.631$。

### 注记
它是“长度为零但点数与实数一样多”的反直觉例子，也是最早的分形。康托尔函数（魔鬼阶梯）在康托尔集外导数为零，却从 $0$ 连续增长到 $1$。

## 度量空间 {#metric-space}
type: 定义 | en: Metric space | w: 4 | 考纲: 实数轴的拓扑, 实数轴的完备性
前置: abs-inequality
源于: cauchy-criterion
后续: topological-space, banach-fixed-point
alias: 度量, 距离空间, 完备度量空间

集合 $X$ 上的度量 $d$ 满足：$d(x,y)\ge0$ 且等号当且仅当 $x=y$；$d(x,y)=d(y,x)$；三角不等式 $d(x,z)\le d(x,y)+d(y,z)$。有了距离，就能定义收敛、柯西列、开集、连续、紧致。

### 例子
$\R^n$ 的欧氏距离；曼哈顿距离 $\sum\abs{x_i-y_i}$；$C[a,b]$ 上的一致距离 $\max\abs{f-g}$；字符串的编辑距离；离散度量（不同点距离为 $1$）。

### 注记
完备的度量空间（柯西列都收敛）是分析的舞台：$\R$、$\R^n$、$C[a,b]$ 完备，$\Q$ 不完备。[[banach-fixed-point]] 只在完备空间中成立。

## 拓扑空间 {#topological-space}
type: 定义 | en: Topological space | w: 3 | level: ext
前置: metric-space, continuity-topological
后续: fundamental-group, surface-classification
alias: 拓扑, 开集公理, 豪斯多夫空间

只保留“开集”这一概念：集合 $X$ 上的拓扑是一族子集（开集），包含 $\varnothing$ 与 $X$，对任意并与有限交封闭。连续映射定义为开集的原像是开集。

### 注记
度量诱导拓扑，但许多拓扑不来自度量（例如有限补拓扑）。拓扑空间是“橡皮几何”的舞台：咖啡杯与甜甜圈同胚，因为可以连续形变互变，而距离与角度在拓扑中都被忘掉了。
