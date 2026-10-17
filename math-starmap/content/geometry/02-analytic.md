---
galaxy: geometry
cluster: analytic-geometry
title: 解析几何
en: Analytic geometry
order: 2
level: hs
---

## 直线的方程 {#line-equation}
type: 概念 | en: Equations of lines | w: 4 | 考纲: 解析几何
前置: function, plane-vector
后续: distance-formulas, circle-equation, tangent-line
alias: 斜率, 点斜式, 一般式, 截距式, 倾斜角

笛卡尔的发明：用坐标把几何对象变成方程。直线的点斜式 $y-y_0=k(x-x_0)$、斜截式 $y=kx+b$、一般式 $Ax+By+C=0$（法向量为 $(A,B)$）。斜率 $k=\tan\alpha$，$\alpha$ 是倾斜角。

### 注记
两直线平行 $\iff k_1=k_2$（且不重合）；垂直 $\iff k_1k_2=-1$。斜率不存在（竖直线）时需单独讨论——一般式 $Ax+By+C=0$ 没有这个问题，垂直条件统一为 $A_1A_2+B_1B_2=0$。

## 距离公式 {#distance-formulas}
type: 公式 | en: Distance formulas | w: 3 | 考纲: 解析几何
前置: line-equation, dot-product
alias: 两点间距离, 点到直线距离, 平行线间距离

点 $(x_0,y_0)$ 到直线 $Ax+By+C=0$ 的距离：
$$d=\frac{\abs{Ax_0+By_0+C}}{\sqrt{A^2+B^2}}.$$

### 证明
直线的单位法向量 $\vv n=\frac{(A,B)}{\sqrt{A^2+B^2}}$。取直线上一点 $Q$，所求距离是 $\vec{QP}$ 在 $\vv n$ 上投影的绝对值：$\abs{\vec{QP}\cdot\vv n}=\frac{\abs{A(x_0-x_Q)+B(y_0-y_Q)}}{\sqrt{A^2+B^2}}=\frac{\abs{Ax_0+By_0+C}}{\sqrt{A^2+B^2}}$。

### 注记
空间中点到平面 $Ax+By+Cz+D=0$ 的距离公式形式完全相同。

## 圆的方程 {#circle-equation}
type: 概念 | en: Equation of a circle | w: 4 | 考纲: 解析几何
前置: line-equation, distance-formulas
后续: ellipse, conic-unified
alias: 标准方程, 一般方程, 直线与圆的位置关系, 圆与圆

圆心 $(a,b)$、半径 $r$ 的圆：$(x-a)^2+(y-b)^2=r^2$。一般方程 $x^2+y^2+Dx+Ey+F=0$（$D^2+E^2-4F>0$）。直线与圆的位置关系由圆心到直线的距离 $d$ 与 $r$ 比较决定。

### 例题
求过点 $(2,1)$ 且与圆 $x^2+y^2=1$ 相切的直线。设 $y-1=k(x-2)$，由 $\frac{\abs{1-2k}}{\sqrt{1+k^2}}=1$ 得 $k=0$ 或 $k=\frac43$；再检查竖直线 $x=2$，它到原点距离为 $2$，不相切。切线为 $y=1$ 与 $4x-3y-5=0$。

## 椭圆 {#ellipse}
type: 定义 | en: Ellipse | w: 5 | 考纲: 解析几何
前置: circle-equation
后续: conic-unified, conic-tangent
例子: kepler-laws
anim: conics
alias: 椭圆, 焦点, 离心率, 长轴, 短轴
tags: 圆锥曲线

到两定点（焦点）$F_1,F_2$ 的距离之和为常数 $2a$（$2a>\abs{F_1F_2}=2c$）的点的轨迹。标准方程
$$\frac{x^2}{a^2}+\frac{y^2}{b^2}=1,\qquad b^2=a^2-c^2,\quad e=\frac ca\in(0,1).$$

### 性质
- 参数方程 $x=a\cos\theta$，$y=b\sin\theta$；面积 $\pi ab$；
- 焦半径 $\abs{PF_1}=a+ex_0$，$\abs{PF_2}=a-ex_0$；
- 椭圆是圆在某个方向上的均匀压缩：把 $y$ 坐标乘以 $\frac ba$ 就把圆 $x^2+y^2=a^2$ 变为椭圆。

### 应用
行星沿以太阳为一个焦点的椭圆轨道运动（开普勒第一定律）；椭圆形回音廊中，从一个焦点发出的声音经墙壁反射后汇聚到另一个焦点（光学性质，见 [[conic-tangent]]）。

## 双曲线 {#hyperbola}
type: 定义 | en: Hyperbola | w: 4 | 考纲: 解析几何
前置: circle-equation
后续: conic-unified, conic-tangent
anim: conics
alias: 双曲线, 渐近线, 等轴双曲线

到两焦点距离之差的绝对值为常数 $2a$（$0<2a<2c$）的点的轨迹：
$$\frac{x^2}{a^2}-\frac{y^2}{b^2}=1,\qquad b^2=c^2-a^2,\quad e=\frac ca>1,$$
渐近线 $y=\pm\frac bax$。$a=b$ 时为等轴双曲线，$xy=k$ 是它旋转 $45^\circ$ 后的形式。

### 注记
双曲线有两支，远处无限接近渐近线。共渐近线的双曲线系：$\frac{x^2}{a^2}-\frac{y^2}{b^2}=\lambda$。GPS 出现以前的罗兰导航系统利用到两个电台的时间差（距离差）定位：船位于一条双曲线上。

## 抛物线 {#parabola}
type: 定义 | en: Parabola | w: 4 | 考纲: 解析几何
前置: circle-equation
源于: quadratic-function
后续: conic-unified, conic-tangent
anim: conics
alias: 抛物线, 焦点, 准线, 焦半径

到定点（焦点）与定直线（准线）距离相等的点的轨迹。焦点 $\left(\frac p2,0\right)$、准线 $x=-\frac p2$ 的抛物线为 $y^2=2px$。

### 性质
- 焦半径 $\abs{PF}=x_0+\frac p2$（到准线的距离）；
- 过焦点的弦 $AB$：$x_1x_2=\frac{p^2}4$，$y_1y_2=-p^2$，$\frac1{\abs{AF}}+\frac1{\abs{BF}}=\frac2p$。

### 应用
平行于对称轴的光线经抛物面反射后汇聚于焦点：卫星天线、太阳灶、探照灯（反过来用）。不计空气阻力的抛体轨迹是抛物线。

## 圆锥曲线的统一定义 {#conic-unified}
type: 定理 | en: Unified definition of conics | w: 4 | 考纲: 解析几何
前置: ellipse, hyperbola, parabola
后续: dandelin-spheres, conic-general-equation
anim: conics
alias: 离心率, 焦点准线定义, 第二定义, 圆锥截线

到定点 $F$ 的距离与到定直线 $l$ 的距离之比为常数 $e$ 的点的轨迹：$0<e<1$ 为椭圆，$e=1$ 为抛物线，$e>1$ 为双曲线。极坐标方程（以焦点为极点）统一为
$$\rho=\frac{ep}{1-e\cos\theta}.$$

### 直观
三种曲线都是平面截圆锥得到的截线：截面与母线平行得抛物线，比母线“平”得椭圆，比母线“陡”得双曲线（截到两叶）。离心率 $e$ 连续变化时，曲线从圆（$e=0$）逐渐拉长成椭圆，在 $e=1$ 时“断开”成抛物线，再张开成双曲线。

### 应用
天体在平方反比引力下的轨道都是圆锥曲线，离心率由能量决定：负能量为椭圆（行星），零能量为抛物线，正能量为双曲线（掠过太阳的彗星）。

## 圆锥曲线的切线与光学性质 {#conic-tangent}
type: 定理 | en: Tangents and reflection properties of conics | w: 3 | 考纲: 解析几何
前置: ellipse, parabola, tangent-line
alias: 切线方程, 光学性质, 反射性质, 极点极线

椭圆 $\frac{x^2}{a^2}+\frac{y^2}{b^2}=1$ 在 $(x_0,y_0)$ 处的切线为 $\frac{x_0x}{a^2}+\frac{y_0y}{b^2}=1$（“替换法则”：$x^2\to x_0x$，$y^2\to y_0y$），双曲线、抛物线类似（$y^2=2px$ 的切线 $y_0y=p(x+x_0)$）。

> [!定理] 光学性质
> 椭圆上一点的切线与两条焦半径成等角：从一个焦点发出的光反射后经过另一个焦点。双曲线的切线平分两焦半径的夹角；抛物线的切线与焦半径、对称轴方向成等角。

### 证明（椭圆）
设切线为 $l$，$P$ 为切点。$l$ 上除 $P$ 外的点都在椭圆外，到两焦点距离和 $>2a$，而 $P$ 处等于 $2a$，所以 $P$ 是 $l$ 上使 $\abs{XF_1}+\abs{XF_2}$ 最小的点。由反射的最短路径原理（作 $F_1$ 关于 $l$ 的对称点），入射角等于反射角。

## 直线与圆锥曲线：设而不求 {#conic-chord-problems}
type: 方法 | en: Lines meeting conics | w: 4 | 考纲: 解析几何
前置: ellipse, vieta-theorem
alias: 弦长公式, 中点弦, 点差法, 设而不求, 韦达定理的应用

直线与圆锥曲线联立得到一元二次方程，不解出交点，而用韦达定理表示 $x_1+x_2$、$x_1x_2$：
- 弦长 $\abs{AB}=\sqrt{1+k^2}\,\abs{x_1-x_2}=\sqrt{1+k^2}\sqrt{(x_1+x_2)^2-4x_1x_2}$；
- 中点弦用点差法：两交点坐标代入方程相减，得斜率与中点坐标的关系 $k=-\frac{b^2x_0}{a^2y_0}$（椭圆）。

### 例题
过椭圆 $\frac{x^2}4+y^2=1$ 的右焦点 $(\sqrt3,0)$ 作斜率为 $1$ 的直线，求弦长。
联立 $\frac{x^2}4+(x-\sqrt3)^2=1$，即 $5x^2-8\sqrt3x+8=0$，$x_1+x_2=\frac{8\sqrt3}5$，$x_1x_2=\frac85$。$\abs{AB}=\sqrt2\sqrt{\frac{192}{25}-\frac{32}5}=\sqrt2\cdot\frac{\sqrt{32}}5=\frac85$。

### 注记
别忘了联立后检查判别式 $\Delta>0$（保证有两个交点），并讨论斜率不存在的情形。

## 极坐标 {#polar-coordinates}
type: 概念 | en: Polar coordinates | w: 3 | 考纲: 解析几何
前置: trig-functions
后续: polar-coordinates-integral
alias: 极坐标系, 极径, 极角, 玫瑰线, 心形线, 阿基米德螺线

用到原点的距离 $\rho$ 与极角 $\theta$ 表示点：$x=\rho\cos\theta$，$y=\rho\sin\theta$。有心曲线、螺线在极坐标下方程最简单：阿基米德螺线 $\rho=a\theta$，心形线 $\rho=a(1+\cos\theta)$，玫瑰线 $\rho=a\sin n\theta$。

### 注记
极坐标下的面积 $S=\frac12\int\rho^2\,\dd\theta$，二重积分 $\dd x\,\dd y=\rho\,\dd\rho\,\dd\theta$，复数的三角形式就是极坐标。

## 极坐标下的积分 {#polar-coordinates-integral}
type: 方法 | en: Integration in polar coordinates | w: 2 | 考纲: 多元微积分, 解析几何
前置: polar-coordinates, change-of-variables
alias: 极坐标面积公式, 扇形微元

扇形微元面积 $\dd S=\frac12\rho^2\,\dd\theta$，所以极坐标曲线 $\rho=\rho(\theta)$ 与两条射线围成的面积为 $\frac12\int_\alpha^\beta\rho(\theta)^2\,\dd\theta$。

### 例题
心形线 $\rho=a(1+\cos\theta)$ 围成的面积：$\frac12\int_0^{2\pi}a^2(1+\cos\theta)^2\dd\theta=\frac{a^2}2\left(2\pi+0+\pi\right)=\frac32\pi a^2$。

## 参数方程 {#parametric-equations}
type: 概念 | en: Parametric equations | w: 3 | 考纲: 解析几何, 参数曲线
前置: trig-functions, line-equation
后续: parametric-curve
alias: 参数方程, 直线的参数方程, 椭圆的参数方程, 消参

用参数 $t$ 同时表示 $x,y$：直线 $x=x_0+t\cos\alpha$，$y=y_0+t\sin\alpha$（$\abs t$ 是到 $(x_0,y_0)$ 的距离）；椭圆 $x=a\cos\theta$，$y=b\sin\theta$；摆线 $x=r(t-\sin t)$，$y=r(1-\cos t)$。

### 例题
求椭圆 $\frac{x^2}4+\frac{y^2}3=1$ 上的点到直线 $x+2y-8=0$ 距离的最小值。设点 $(2\cos\theta,\sqrt3\sin\theta)$，
$$d=\frac{\abs{2\cos\theta+2\sqrt3\sin\theta-8}}{\sqrt5}=\frac{\abs{4\sin(\theta+\frac\pi6)-8}}{\sqrt5}\ge\frac4{\sqrt5}.$$
参数化把二元最值化为一元三角函数最值。

## 丹德林双球 {#dandelin-spheres}
type: 定理 | en: Dandelin spheres | w: 3 | 考纲: 解析几何, 立体几何
前置: conic-unified, polyhedra-volume
alias: 丹德林球, 圆锥截线的焦点

平面截圆锥得到椭圆时，在圆锥内放两个球，分别与圆锥相切（切于一个圆）并与截面相切，切点 $F_1,F_2$ 就是椭圆的焦点。

### 证明
椭圆上任一点 $P$，过 $P$ 的母线与两个切圆分别交于 $Q_1,Q_2$。从球外一点到球的切线长相等：$\abs{PF_1}=\abs{PQ_1}$，$\abs{PF_2}=\abs{PQ_2}$。于是 $\abs{PF_1}+\abs{PF_2}=\abs{Q_1Q_2}$，是两切圆之间的母线长，与 $P$ 无关。

### 注记
这个 1822 年的证明把“截圆锥”与“到两焦点距离和为定值”两种定义联系起来，还能看出准线：它是截面与切圆所在平面的交线。

## 二次曲线的一般方程 {#conic-general-equation}
type: 定理 | en: General second-degree curves | w: 3 | 考纲: 解析几何, 二次型
前置: conic-unified
用到: principal-axes
alias: 二次曲线分类, 判别式 B^2-4AC, 旋转消去交叉项

$Ax^2+Bxy+Cy^2+Dx+Ey+F=0$ 经旋转（消去 $xy$ 项）与平移化为标准形。非退化时由 $\Delta=B^2-4AC$ 判型：$\Delta<0$ 椭圆，$\Delta=0$ 抛物线，$\Delta>0$ 双曲线。

### 注记
二次部分 $\begin{pmatrix}x&y\end{pmatrix}\begin{pmatrix}A&B/2\\B/2&C\end{pmatrix}\begin{pmatrix}x\\y\end{pmatrix}$ 的矩阵是对称的，旋转角由其特征向量给出（[[principal-axes]]）；$-\frac\Delta4=AC-\frac{B^2}4$ 是该矩阵的行列式，在旋转下不变。三维中二次曲面（椭球面、单叶/双叶双曲面、抛物面）的分类完全类似。
