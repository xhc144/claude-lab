---
galaxy: geometry
cluster: topology-ext
title: 拓扑与几何拓展
en: Further topology and geometry
order: 10
level: ext
---

## 基本群 {#fundamental-group}
type: 定义 | en: Fundamental group | w: 3 | level: ext
前置: topological-space, group
相关: free-group
alias: 基本群, 同伦, 单连通, 圈的同伦类

空间 $X$ 中以 $x_0$ 为端点的闭路径，按“连续形变（同伦）”分类，类在路径的拼接下构成群 $\pi_1(X,x_0)$。它度量空间中有多少种“绕洞”的方式。

### 例子
$\pi_1(\R^n)=0$（单连通）；$\pi_1(S^1)=\Z$（整数是绕圈的圈数）；$\pi_1(\text{环面})=\Z^2$；$\pi_1(S^2)=0$；8 字形的基本群是自由群 $F_2$；三叶结补空间的基本群是 $\langle x,y\mid x^2=y^3\rangle$，与平凡结补空间的 $\Z$ 不同构——又一次证明三叶结不能解开。

### 应用
$\pi_1(S^1)=\Z$ 推出二维 [[brouwer-fixed-point]] 与代数基本定理的拓扑证明。庞加莱猜想（单连通闭三维流形同胚于 $S^3$）由佩雷尔曼于 2003 年证明。

## 布劳威尔不动点定理 {#brouwer-fixed-point}
type: 定理 | en: Brouwer fixed-point theorem | w: 4 | level: ext
源于: sperner-lemma
前置: ivt, compactness
应用于: nash-equilibrium
alias: 不动点定理, Brouwer, 搅咖啡

闭圆盘（一般地，$n$ 维闭球）到自身的连续映射一定有不动点。

### 直观
- 一维：区间到自身的连续函数图像必与对角线 $y=x$ 相交（[[ivt]]）。
- 搅一杯咖啡（连续搅动、表面不破），静止后总有一点回到原来的位置。
- 把一张城市地图放在这座城市里，地图上总有一点恰好在它所表示的实际位置的正上方。

### 证明思路
（二维，由斯佩纳引理）若 $f$ 无不动点，按“$f(\vv x)-\vv x$ 的方向”把三角形剖分的顶点涂三色，可满足斯佩纳引理的边界条件；全彩小三角形越来越小，其极限点处三种方向同时出现，与连续性矛盾。另一个证明用基本群：若无不动点，可以构造圆盘到边界圆周的收缩，而 $\pi_1(S^1)=\Z$ 不可能是 $\pi_1(D^2)=0$ 的“收缩像”。

### 应用
纳什均衡的存在性；经济学一般均衡；微分方程周期解的存在性。

## 毛球定理 {#hairy-ball}
type: 定理 | en: Hairy ball theorem | w: 3 | level: ext
前置: euler-characteristic, fundamental-group
alias: 梳毛定理, 球面上的向量场, 庞加莱-霍普夫

二维球面上的连续切向量场必有零点：“毛茸茸的球无法梳平，总有一个旋”。环面上则可以梳平。

### 注记
庞加莱–霍普夫定理：曲面上光滑向量场各零点的指数之和等于欧拉示性数。球面 $\chi=2\ne0$，所以必有零点；环面 $\chi=0$。气象推论：地球表面任何时刻都至少有一点风速为零（水平分量）。

## 高斯曲率 {#gaussian-curvature}
type: 定义 | en: Gaussian curvature | w: 3 | level: ext
前置: curvature, multivar-taylor
后续: gauss-bonnet
alias: 主曲率, 高斯曲率, 绝妙定理, 曲面的弯曲

曲面上一点处，过法线的各平面截曲面得到的法截线曲率中，最大与最小值 $\kappa_1,\kappa_2$ 称为主曲率，乘积 $K=\kappa_1\kappa_2$ 称为高斯曲率。球面 $K=\frac1{R^2}$，平面与圆柱面 $K=0$，马鞍面 $K<0$。

### 绝妙定理
高斯证明：$K$ 只依赖于曲面的内蕴度量（在曲面上测量的长度），与曲面如何放在空间中无关。所以球面不能无伸缩地展成平面——任何平面世界地图都必有变形；而圆柱面（$K=0$）可以展平。吃比萨时把一块弯成“U”形就不会垂下去，也是这个定理：一个方向弯了，另一个方向就不能弯。

## 高斯-博内定理 {#gauss-bonnet}
type: 定理 | en: Gauss–Bonnet theorem | w: 3 | level: ext
前置: gaussian-curvature, euler-characteristic
alias: Gauss–Bonnet, 曲率积分, 三角形内角和

紧致无边可定向曲面上，
$$\iint_SK\,\dd A=2\pi\chi(S).$$
局部的几何量（曲率）的积分等于整体的拓扑量（欧拉示性数）。

### 例题
单位球面：$K=1$，面积 $4\pi$，$\iint K\,\dd A=4\pi=2\pi\cdot2$。测地三角形版本：$\alpha+\beta+\gamma=\pi+\iint_\Delta K\,\dd A$——球面三角形内角和大于 $\pi$，双曲平面上小于 $\pi$，平面上等于 $\pi$。

## 非欧几何 {#non-euclidean}
type: 概念 | en: Non-Euclidean geometry | w: 4 | level: ext
前置: euclidean-geometry, gaussian-curvature
相关: relativity-postulates
alias: 双曲几何, 罗巴切夫斯基几何, 椭圆几何, 黎曼几何, 球面几何, 庞加莱圆盘

替换欧几里得的平行公设：
- **双曲几何**（罗巴切夫斯基、鲍耶，约 1830）：过直线外一点有无穷多条直线与之不交；三角形内角和小于 $\pi$。模型：庞加莱圆盘（“直线”是与边界圆正交的圆弧）。
- **椭圆（球面）几何**（黎曼）：没有平行线；三角形内角和大于 $\pi$。模型：球面，“直线”是大圆。

### 意义
非欧几何的相容性（可以在欧氏空间中建立模型）证明了平行公设独立于其他公设，打破了“欧氏几何是唯一真实的几何”的观念。爱因斯坦的广义相对论用弯曲时空的黎曼几何描述引力。

## 射影几何 {#projective-geometry}
type: 概念 | en: Projective geometry | w: 3 | level: ext
前置: geometric-transformations
相关: conic-unified
alias: 射影平面, 无穷远点, 交比, 对偶原理, 德萨格定理, 帕斯卡定理

透视画法的数学：给平面添加“无穷远点”（每族平行线交于一个无穷远点），得到射影平面，任意两条直线恰交于一点。射影变换保持共线性与交比，不保持距离、角度和平行。

### 定理
- 对偶原理：把“点”和“线”互换，定理仍成立；
- 帕斯卡定理：圆锥曲线内接六边形三组对边的交点共线；对偶是布列安桑定理。
- 在射影几何中椭圆、抛物线、双曲线是同一种曲线（非退化二次曲线），区别只在与无穷远直线交点的个数（$0,1,2$）。
