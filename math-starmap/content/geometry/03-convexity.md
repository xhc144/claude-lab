---
galaxy: geometry
cluster: convexity
title: 凸性与凸包
en: Convexity and convex hulls
order: 3
level: core
---

## 凸集 {#convex-set}
type: 定义 | en: Convex set | w: 5 | 考纲: 凸性
前置: vector-decomposition
后续: convex-hull, helly-theorem, separating-hyperplane
相关: convex-function
alias: 凸集, 凸组合, 凸多边形
tags: 凸性

集合 $C$ 中任意两点的连线段都在 $C$ 内：$\vv x,\vv y\in C$，$t\in[0,1]\Rightarrow t\vv x+(1-t)\vv y\in C$。

### 例子
圆盘、三角形、凸多边形、半平面、球、线性规划的可行域（有限个半空间之交）。圆环、月牙形不是凸集。凸集的交仍是凸集；凸函数的上方图（epigraph）是凸集，下水平集 $\{f\le c\}$ 是凸集。

### 注记
凸性是优化与几何的共同语言：凸集上的凸函数，局部最小就是全局最小（[[convex-optimization]]）；凸集可以用超平面分离（[[separating-hyperplane]]）。

## 凸包 {#convex-hull}
type: 定义 | en: Convex hull | w: 5 | 考纲: 凸包
前置: convex-set
后续: caratheodory, convex-hull-algorithm
anim: convex-hull
alias: 凸包, 凸闭包, 凸多边形, 支撑线

包含集合 $S$ 的最小凸集，等于 $S$ 中有限个点的全部凸组合 $\sum\lambda_i\vv x_i$（$\lambda_i\ge0$，$\sum\lambda_i=1$）。平面有限点集的凸包是凸多边形，顶点都取自点集。

### 直观
在木板上钉一些钉子，套上一根橡皮筋放手，橡皮筋收紧后围成的形状就是凸包。

### 例题
平面上有限个点，若其中任意四点都构成凸四边形（没有一点落在另三点的三角形内），则全部点都是凸包的顶点（处于“凸位置”）。

**证**：否则某点 $P$ 在凸包内部或边上而不是顶点。把凸包从一个顶点出发作扇形三角剖分，$P$ 落在某个以凸包顶点为顶点的三角形内（或边上），这三个顶点与 $P$ 构成的四点不在凸位置，矛盾。

## 卡拉泰奥多里定理 {#caratheodory}
type: 定理 | en: Carathéodory's theorem | w: 3 | 考纲: 凸包, 凸性
前置: convex-hull, linear-independence
alias: Carathéodory 定理

$\R^d$ 中，$S$ 的凸包里的每个点都是 $S$ 中至多 $d+1$ 个点的凸组合。平面上：凸包中的每一点都落在以 $S$ 中三个点为顶点的某个三角形内（或其边上）。

### 证明
设 $\vv x=\sum_{i=1}^m\lambda_i\vv x_i$，$m>d+1$，$\lambda_i>0$。则 $\vv x_2-\vv x_1,\dots,\vv x_m-\vv x_1$ 共 $m-1>d$ 个向量线性相关，于是存在不全为零的 $\mu_i$ 使 $\sum\mu_i\vv x_i=\vv0$ 且 $\sum\mu_i=0$。取 $t=\min\{\lambda_i/\mu_i:\mu_i>0\}$，用 $\lambda_i-t\mu_i$ 代替 $\lambda_i$，仍是凸组合，但至少一个系数变为零。重复直到 $m\le d+1$。

## 赫利定理 {#helly-theorem}
type: 定理 | en: Helly's theorem | w: 4 | 考纲: 凸性
前置: convex-set
源于: radon-theorem
alias: Helly 定理

$\R^d$ 中有限个凸集，若其中任意 $d+1$ 个都有公共点，则全部有公共点。平面上：任意三个凸集有公共点 $\Rightarrow$ 全部有公共点。

### 证明
对凸集个数 $n$ 归纳（$n\ge d+2$）。由归纳假设，对每个 $i$，去掉 $C_i$ 后其余凸集有公共点 $\vv p_i$，即 $\vv p_i\in C_j$ 对一切 $j\ne i$。对 $\vv p_1,\dots,\vv p_n$ 用 [[radon-theorem]]：下标分成 $I\cup J$，两组的凸包有公共点 $\vv q$。任取 $k$：若 $k\notin I$，则 $\vv p_i\in C_k$ 对一切 $i\in I$ 成立，由凸性 $\vv q\in\operatorname{conv}\{\vv p_i\}_{i\in I}\subseteq C_k$；若 $k\in I$，则 $k\notin J$，同理用 $J$ 一组得 $\vv q\in C_k$。所以 $\vv q$ 属于每个凸集。

### 例题
数轴上（$d=1$）一族闭区间若两两相交，则全部有公共点：取所有左端点的最大者 $a^*$，它不超过任何右端点（因为每两个区间相交），所以 $a^*$ 属于每个区间。
平面上：若干个半平面中任意三个都有公共点，则它们全部有公共点。

## 拉东定理 {#radon-theorem}
type: 定理 | en: Radon's theorem | w: 3 | 考纲: 凸性, 凸包
前置: convex-hull, linear-independence
推出: helly-theorem
alias: Radon 定理, 拉东划分

$\R^d$ 中任意 $d+2$ 个点可以分成两组，使两组的凸包相交。平面上：任意 $4$ 个点，要么一个点在另三点的三角形内，要么可以分成两对，使两条线段相交。

### 证明
$d+2$ 个点 $\vv x_i$ 满足：存在不全为零的 $\mu_i$ 使 $\sum\mu_i\vv x_i=\vv0$，$\sum\mu_i=0$（$d+1$ 个差向量在 $\R^d$ 中线性相关）。令 $I=\{\mu_i>0\}$，$J=\{\mu_i\le0\}$，$M=\sum_{I}\mu_i$。则点 $\sum_{i\in I}\frac{\mu_i}M\vv x_i=\sum_{j\in J}\frac{-\mu_j}M\vv x_j$ 同时属于两组的凸包。

## 凸包算法 {#convex-hull-algorithm}
type: 算法 | en: Convex hull algorithms | w: 3 | 考纲: 凸包
前置: convex-hull, cross-product
anim: convex-hull
alias: Graham 扫描, Andrew 单调链, 礼品包装算法, Jarvis

求平面 $n$ 个点的凸包：
- **Graham 扫描**：按极角排序后用栈依次加入点，若新点使最后两条边构成“右转”（叉积 $<0$），弹出栈顶。$O(n\log n)$。
- **礼品包装（Jarvis）**：从最左点出发，每次选使其余点都在左侧的下一点。$O(nh)$，$h$ 为凸包顶点数。

### 注记
判断“左转/右转”只用叉积的符号 $(\vv b-\vv a)\times(\vv c-\vv a)$，不需要任何角度或开方。基于比较的凸包算法下界是 $\Omega(n\log n)$，因为排序可以归约为凸包问题（把 $x_i$ 映到抛物线上的点 $(x_i,x_i^2)$）。

## 分离超平面定理 {#separating-hyperplane}
type: 定理 | en: Separating hyperplane theorem | w: 4 | 考纲: 凸性, 凸优化理论
前置: convex-set, orthogonal-projection
应用于: lp-duality, kkt
alias: 超平面分离定理, 支撑超平面, 法卡斯引理

两个不相交的凸集可以被一个超平面分开：存在 $\vv a\ne\vv0$ 与 $b$ 使 $\vv a\cdot\vv x\le b\le\vv a\cdot\vv y$ 对 $\vv x\in C_1$、$\vv y\in C_2$ 成立。若一个闭凸、另一个紧凸，可以严格分离。

### 证明（点与闭凸集）
设 $\vv p\notin C$，$C$ 闭凸。取 $C$ 中离 $\vv p$ 最近的点 $\vv q$（存在且唯一），则 $\vv a=\vv p-\vv q$ 满足 $\vv a\cdot(\vv x-\vv q)\le0$ 对一切 $\vv x\in C$ 成立（否则沿线段向 $\vv x$ 移动能更接近 $\vv p$）。垂直平分 $\vv p\vv q$ 的超平面即严格分离。

### 应用
线性规划对偶定理、KKT 条件、博弈论中的极小极大定理、支持向量机（找“间隔最大”的分离超平面）。

## 皮克定理 {#pick-theorem}
type: 定理 | en: Pick's theorem | w: 3 | 考纲: 凸性, 三角剖分
前置: triangulation, euler-formula-polyhedra
alias: Pick 定理, 格点多边形面积

顶点都在格点上的简单多边形，面积为
$$S=I+\frac B2-1,$$
$I$ 是内部格点数，$B$ 是边界上的格点数。

### 证明思路
公式对“粘合”是可加的：两个多边形沿公共边粘起来，右边的量也相加。因此只需验证三角形；任何格点多边形可三角剖分为只含三个格点（顶点）的“本原三角形”，用欧拉公式可以算出本原三角形个数为 $2I+B-2$，而每个本原三角形面积为 $\frac12$。

### 注记
三维中没有类似公式：里夫四面体顶点 $(0,0,0),(1,0,0),(0,1,0),(1,1,r)$ 只有 $4$ 个格点（都是顶点），体积 $\frac r6$ 却可以任意大。
