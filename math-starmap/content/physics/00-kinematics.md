---
galaxy: physics
cluster: kinematics
title: 运动学
en: Kinematics
order: 0
level: hs
---

## 位移、速度与加速度 {#kinematics-basics}
type: 物理量 | en: Displacement, velocity, acceleration | w: 5 | 考纲: 运动学
前置: derivative, plane-vector
后续: uniform-acceleration, projectile-motion, circular-motion, newton-second
alias: 位移, 速度, 加速度, 质点, 参考系, 瞬时速度
tags: 力学

描述运动的三个基本矢量：位移 $\vv r$，速度 $\vv v=\frac{\dd\vv r}{\dd t}$，加速度 $\vv a=\frac{\dd\vv v}{\dd t}=\frac{\dd^2\vv r}{\dd t^2}$。研究对象理想化为质点；描述运动必须先选定参考系。

### 注记
- 位移与路程不同：绕操场跑一圈，路程 $400$ m，位移为零。
- 速度是矢量，速率是其大小；加速度方向不一定与速度方向相同（匀速圆周运动中二者垂直）。
- 反过来，已知加速度求运动是积分问题：$\vv v=\vv v_0+\int\vv a\,\dd t$——运动学正是牛顿发明微积分的动机。

## 匀变速直线运动 {#uniform-acceleration}
type: 公式 | en: Uniformly accelerated motion | w: 5 | 考纲: 运动学
前置: kinematics-basics
后续: projectile-motion, motion-graphs
alias: 匀加速, 自由落体, 速度公式, 位移公式, 速度位移关系

加速度恒定时：
$$v=v_0+at,\qquad x=v_0t+\frac12at^2,\qquad v^2-v_0^2=2ax,\qquad\bar v=\frac{v_0+v}2.$$
自由落体是 $v_0=0$、$a=g\approx9.8$ m/s² 的特例。

### 推导
对 $a$ 积分得 $v$，再积分得 $x$；第三式消去 $t$ 得到（也可由动能定理得到）。

### 例题
从静止开始的匀加速运动，相邻相等时间内的位移之比为 $1:3:5:\cdots$（伽利略发现的奇数规律）；任意两个连续相等时间 $T$ 内的位移差 $\Delta x=aT^2$——实验中用逐差法求加速度的依据。

## 运动图像 {#motion-graphs}
type: 方法 | en: Motion graphs | w: 3 | 考纲: 运动学, 数据处理
前置: uniform-acceleration
用到: integral-apps
alias: x-t 图像, v-t 图像, 面积表示位移, 斜率表示加速度

$x$-$t$ 图像的斜率是速度；$v$-$t$ 图像的斜率是加速度，与时间轴围成的面积是位移；$a$-$t$ 图像的面积是速度变化量。

### 例题
追及问题：甲以 $10$ m/s 匀速、乙从静止以 $2$ m/s² 同时同地同向出发。速度相等（$t=5$ s）时两者距离最大，为 $50-25=25$ m；$t=10$ s 时乙追上甲。画出 $v$-$t$ 图，两条线之间的面积就是距离差。

## 抛体运动 {#projectile-motion}
type: 模型 | en: Projectile motion | w: 4 | 考纲: 运动学
前置: uniform-acceleration, vector-decomposition
源于: newton-second
anim: projectile
alias: 平抛运动, 斜抛运动, 运动的合成与分解, 射程

忽略空气阻力时，抛体在水平方向匀速、竖直方向匀加速（$-g$），两个方向独立。以初速度 $v_0$、仰角 $\theta$ 抛出：
$$x=v_0\cos\theta\cdot t,\quad y=v_0\sin\theta\cdot t-\frac12gt^2,\qquad\text{射程 }R=\frac{v_0^2\sin2\theta}g.$$
轨迹是抛物线；同一高度落地时，$\theta=45^\circ$ 射程最远，互余的两个仰角射程相同。

### 例题
平抛运动中，任意时刻速度方向与水平方向夹角 $\alpha$、位移方向夹角 $\beta$ 满足 $\tan\alpha=2\tan\beta$：速度反向延长线通过水平位移的中点。

### 注记
加上空气阻力（与速度平方成正比）后，最佳仰角小于 $45^\circ$，轨迹不对称——需要数值求解微分方程。

## 圆周运动 {#circular-motion}
type: 模型 | en: Circular motion | w: 4 | 考纲: 运动学
前置: kinematics-basics, radian
后续: centripetal-force
alias: 匀速圆周运动, 角速度, 线速度, 向心加速度, 周期

线速度 $v=\omega r$，角速度 $\omega=\frac{2\pi}T$；匀速圆周运动的加速度指向圆心，大小
$$a_n=\frac{v^2}r=\omega^2r.$$

### 推导
$\vv r=r(\cos\omega t,\sin\omega t)$，求导两次得 $\vv a=-\omega^2\vv r$。几何法：$\Delta t$ 内速度矢量转过 $\omega\Delta t$，$\abs{\Delta\vv v}\approx v\omega\Delta t$。

### 注记
变速圆周运动还有切向加速度 $a_t=\frac{\dd v}{\dd t}$。一般曲线运动中，法向加速度 $a_n=\frac{v^2}\rho$，$\rho$ 是曲率半径（[[curvature]]）。

## 相对运动 {#relative-motion}
type: 原理 | en: Relative motion | w: 3 | 考纲: 运动学
前置: kinematics-basics
后续: relativity-postulates
alias: 速度合成, 相对速度, 伽利略变换, 小船渡河

伽利略变换下，速度相加：$\vv v_{A\text{对地}}=\vv v_{A\text{对}B}+\vv v_{B\text{对地}}$。

### 例题
小船渡河：河宽 $d$，水速 $v_1$，船在静水中速度 $v_2$。船头垂直河岸时渡河时间最短 $t=\frac d{v_2}$；若 $v_2>v_1$，船头偏向上游使合速度垂直河岸时航程最短为 $d$。

### 注记
高速时伽利略变换失效，速度合成变为 $u'=\frac{u-v}{1-uv/c^2}$，光速在任何参考系中都是 $c$（[[lorentz-transformation]]）。
