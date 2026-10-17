---
galaxy: geometry
cluster: solid-geometry
title: 立体几何
en: Solid geometry
order: 1
level: hs
---

## 空间点、线、面的位置关系 {#spatial-relations}
type: 概念 | en: Points, lines and planes in space | w: 4 | 考纲: 立体几何
前置: euclidean-geometry
后续: parallel-perpendicular, space-vector-method
alias: 异面直线, 平面的基本性质, 公理

空间两条直线的位置关系：相交、平行、异面（不同在任何一个平面内）；直线与平面：在平面内、相交、平行；两平面：平行、相交。基本事实：不共线的三点确定一个平面；两平面若有公共点，则交于过该点的一条直线。

### 注记
异面直线所成的角定义为平移后两直线所成的锐角或直角，范围 $\left(0,\frac\pi2\right]$；异面直线的距离是公垂线段的长。

## 平行与垂直的判定 {#parallel-perpendicular}
type: 定理 | en: Parallelism and perpendicularity | w: 4 | 考纲: 立体几何
前置: spatial-relations
后续: three-perpendiculars, dihedral-angle
alias: 线面平行, 面面平行, 线面垂直, 面面垂直, 判定定理, 性质定理

- 线面平行：平面外一条直线与平面内一条直线平行，则它与平面平行；
- 面面平行：一个平面内两条相交直线都与另一平面平行；
- 线面垂直：直线与平面内两条**相交**直线都垂直；
- 面面垂直：一个平面经过另一平面的一条垂线。

### 注记
各判定定理的结构相同：“降维”——把空间关系化为平面内的线线关系。用向量语言，线面垂直就是方向向量与法向量平行，见 [[space-vector-method]]。

## 三垂线定理 {#three-perpendiculars}
type: 定理 | en: Theorem of three perpendiculars | w: 3 | 考纲: 立体几何
前置: parallel-perpendicular
alias: 三垂线定理, 逆定理

平面内的一条直线，如果与平面的一条斜线在该平面内的射影垂直，那么它也与这条斜线垂直；反之亦然。

### 证明
设斜线 $PA$，$PO\perp$ 平面，$OA$ 是射影，直线 $l$ 在平面内。$l\perp PO$（$PO$ 垂直平面），若 $l\perp OA$，则 $l$ 垂直平面 $POA$，从而 $l\perp PA$。向量证法：$\vec{PA}=\vec{PO}+\vec{OA}$，与 $l$ 的方向向量作数量积，第一项恒为零。

### 应用
作二面角的平面角、求点到直线的距离时常用。

## 向量积 {#cross-product}
type: 定义 | en: Cross product | w: 4 | 考纲: 立体几何, 向量方法与几何直观的结合
前置: dot-product
后续: space-vector-method, divergence-curl, torque
alias: 叉积, 外积, 向量积, 混合积, 右手定则

$\vv a\times\vv b$ 是垂直于 $\vv a,\vv b$ 的向量，方向按右手定则，长度为 $\abs{\vv a}\abs{\vv b}\sin\theta$（平行四边形面积）。坐标形式
$$\vv a\times\vv b=\begin{vmatrix}\vv i&\vv j&\vv k\\a_1&a_2&a_3\\b_1&b_2&b_3\end{vmatrix}.$$

### 性质
反交换 $\vv a\times\vv b=-\vv b\times\vv a$，$\vv a\times\vv a=\vv0$；不满足结合律；混合积 $(\vv a\times\vv b)\cdot\vv c$ 是平行六面体的有向体积；$\vv a\times(\vv b\times\vv c)=\vv b(\vv a\cdot\vv c)-\vv c(\vv a\cdot\vv b)$。

### 应用
求平面法向量、三角形面积、力矩 $\vv M=\vv r\times\vv F$、洛伦兹力 $q\vv v\times\vv B$、角动量 $\vv L=\vv r\times\vv p$。

## 空间向量方法 {#space-vector-method}
type: 方法 | en: Vector methods in space | w: 5 | 考纲: 立体几何, 向量方法与几何直观的结合
前置: dot-product, cross-product, spatial-relations
后续: dihedral-angle, distance-in-space
alias: 空间向量, 法向量, 坐标法, 建系

建立空间直角坐标系，用方向向量表示直线、用法向量表示平面，把平行、垂直、角度、距离都化为向量运算：
- 线面平行 $\iff\vv u\perp\vv n$；线面垂直 $\iff\vv u\parallel\vv n$；
- 线面角 $\sin\theta=\abs{\cos\inner{\vv u}{\vv n}}$；二面角由两法向量的夹角确定（注意判断锐钝）；
- 点 $P$ 到平面距离 $d=\dfrac{\abs{\vec{AP}\cdot\vv n}}{\abs{\vv n}}$（$A$ 在平面内）。

### 例题
正方体 $ABCD$-$A_1B_1C_1D_1$ 棱长为 $1$，求 $A_1$ 到平面 $AB_1D_1$ 的距离。
以 $A$ 为原点：$B_1(1,0,1)$，$D_1(0,1,1)$，$A_1(0,0,1)$。法向量 $\vv n=\vec{AB_1}\times\vec{AD_1}=(-1,-1,1)$。$d=\frac{\abs{\vec{AA_1}\cdot\vv n}}{\abs{\vv n}}=\frac1{\sqrt3}$。

## 二面角与线面角 {#dihedral-angle}
type: 概念 | en: Dihedral angle and line-plane angle | w: 4 | 考纲: 立体几何
前置: parallel-perpendicular, space-vector-method
alias: 二面角, 平面角, 线面角, 射影面积法

二面角的大小用平面角度量：在棱上取一点，在两个面内分别作垂直于棱的射线，它们所成的角。线面角是直线与它在平面内射影所成的角。

### 方法
定义法（作平面角）、三垂线法、射影面积法 $\cos\theta=\frac{S_{\text{射影}}}{S}$、向量法（法向量夹角）。

### 例题
正四面体相邻两个面所成的二面角 $\theta$ 满足 $\cos\theta=\frac13$，$\theta\approx70.53^\circ$。所以正四面体不能铺满空间：$360^\circ/70.53^\circ$ 不是整数。

## 空间距离 {#distance-in-space}
type: 方法 | en: Distances in space | w: 3 | 考纲: 立体几何
前置: space-vector-method
alias: 点面距离, 异面直线距离, 等体积法

点到平面、直线到平面、平行平面间、异面直线间的距离都可以化归为点到平面的距离。异面直线 $l_1,l_2$（方向 $\vv u_1,\vv u_2$，分别过 $A,B$）的距离：
$$d=\frac{\abs{\vec{AB}\cdot(\vv u_1\times\vv u_2)}}{\abs{\vv u_1\times\vv u_2}}.$$

### 方法
等体积法：点 $P$ 到平面 $ABC$ 的距离 $h$ 满足 $V_{P\text{-}ABC}=\frac13S_{\triangle ABC}\,h$，换一个底面计算同一个体积即可求出 $h$。

## 柱、锥、台、球 {#polyhedra-volume}
type: 公式 | en: Areas and volumes of solids | w: 4 | 考纲: 立体几何
前置: spatial-relations
后续: cavalieri, euler-formula-polyhedra
alias: 体积公式, 表面积, 球的体积, 棱锥, 棱台, 外接球

$V_{\text{柱}}=Sh$，$V_{\text{锥}}=\frac13Sh$，$V_{\text{台}}=\frac13h(S+\sqrt{SS'}+S')$，$V_{\text{球}}=\frac43\pi R^3$，$S_{\text{球}}=4\pi R^2$。

### 为什么锥体有 $\frac13$
一个三棱柱可以切成三个等体积的三棱锥（等底等高）；或者用积分：截面积 $S\left(\frac th\right)^2$ 在 $[0,h]$ 上积分得 $\frac13Sh$。

### 例题
**外接球**：长宽高为 $a,b,c$ 的长方体，外接球直径是体对角线，$R=\frac12\sqrt{a^2+b^2+c^2}$。棱长为 $a$ 的正四面体可以放进棱长 $\frac{a}{\sqrt2}$ 的正方体（取不相邻的四个顶点），外接球半径 $R=\frac{\sqrt6}4a$。

### 注记
阿基米德最得意的发现：球的体积是外切圆柱的 $\frac23$，表面积也是圆柱全面积的 $\frac23$，他要求把这个图形刻在自己的墓碑上。
