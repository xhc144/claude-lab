---
galaxy: physics
cluster: dynamics
title: 力与牛顿定律
en: Forces and Newton's laws
order: 1
level: hs
---

## 牛顿第一定律 {#newton-first}
type: 定律 | en: Newton's first law | w: 4 | 考纲: 牛顿定律
后续: newton-second, non-inertial-frames
alias: 惯性定律, 惯性, 惯性参考系

一切物体在不受外力（或合外力为零）时，保持静止或匀速直线运动状态。它定义了惯性参考系：第一定律在其中成立的参考系。

### 注记
亚里士多德认为维持运动需要力；伽利略的理想斜面实验指出，若没有摩擦，小球会一直运动下去。质量是惯性大小的量度。

## 牛顿第二定律 {#newton-second}
type: 定律 | en: Newton's second law | w: 5 | 考纲: 牛顿定律
前置: newton-first, kinematics-basics
后续: newton-third, work-power, momentum-theorem
推出: projectile-motion
alias: F=ma, 牛顿第二定律, 动力学基本方程
tags: 力学

$$\vv F=m\vv a,\qquad\text{更一般地 }\vv F=\frac{\dd\vv p}{\dd t}.$$
合外力决定加速度，而不是速度。它把力学变成了求解二阶微分方程 $m\ddot{\vv r}=\vv F(\vv r,\dot{\vv r},t)$：已知初始位置与速度，运动就被完全确定。

### 例题
倾角为 $\theta$ 的光滑斜面上物块的加速度 $a=g\sin\theta$；有摩擦（动摩擦因数 $\mu$）时下滑加速度 $a=g(\sin\theta-\mu\cos\theta)$。

### 注记
瞬时性：加速度随力同时变化——剪断弹簧与剪断细绳的瞬间，物体受力情况截然不同（弹簧弹力不能突变，绳的拉力可以）。

## 牛顿第三定律 {#newton-third}
type: 定律 | en: Newton's third law | w: 4 | 考纲: 牛顿定律, 受力分析
前置: newton-second
推出: momentum-conservation
alias: 作用力与反作用力, 牛顿第三定律

两个物体之间的作用力与反作用力大小相等、方向相反、作用在同一直线上，分别作用在两个物体上，性质相同、同时产生同时消失。

### 辨析
作用力与反作用力 vs 一对平衡力：前者作用在两个物体上，不能抵消；后者作用在同一物体上。“马拉车、车也拉马，为什么车能动？”——决定车运动的是车受到的合力（马的拉力与地面摩擦力），与马受的力无关。

## 受力分析 {#force-analysis}
type: 方法 | en: Free-body analysis | w: 5 | 考纲: 受力分析
前置: newton-third, plane-vector
后续: equilibrium, connected-bodies
alias: 隔离法, 整体法, 受力图, 正交分解

选定研究对象，按“重力—弹力—摩擦力—其他力”的顺序找出它受到的全部外力（只画受到的力，不画施出的力），画受力图，再沿坐标轴正交分解，列牛顿第二定律方程。

### 整体法与隔离法
求系统整体加速度用整体法（内力不出现）；求物体之间的作用力用隔离法。二者配合使用。

### 易错
“向心力”“下滑力”不是独立的力，而是某些力的合力或分力，受力图中不应另画。

## 摩擦力 {#friction}
type: 物理量 | en: Friction | w: 4 | 考纲: 受力分析
前置: force-analysis
alias: 静摩擦力, 滑动摩擦力, 动摩擦因数, 最大静摩擦力

滑动摩擦力 $f=\mu N$，方向与相对运动方向相反。静摩擦力大小可变，由平衡或牛顿第二定律确定，介于 $0$ 与最大静摩擦力 $f_m\approx\mu_sN$ 之间，方向与相对运动趋势相反。

### 例题
倾角 $\theta$ 的斜面上物块恰好匀速下滑，则 $\mu=\tan\theta$；此时只要 $\theta$ 不变，无论物块多重都恰好匀速。

### 注记
摩擦力可以是动力：人走路时脚受到地面向前的静摩擦力；传送带把物体加速也靠摩擦力。

## 弹力与胡克定律 {#hooke-law}
type: 定律 | en: Elastic force and Hooke's law | w: 3 | 考纲: 受力分析
前置: force-analysis
后续: simple-harmonic-motion
alias: 弹力, 胡克定律, 劲度系数, 弹簧

在弹性限度内，弹簧弹力与形变量成正比：$F=-kx$。绳的拉力沿绳收缩方向，支持力垂直于接触面。

### 注记
任何物体在稳定平衡位置附近，恢复力都近似与偏离成正比（势能在极小点的二阶泰勒展开），这就是胡克定律与简谐振动无处不在的原因。弹簧串联 $\frac1k=\frac1{k_1}+\frac1{k_2}$，并联 $k=k_1+k_2$。

## 共点力平衡 {#equilibrium}
type: 定理 | en: Equilibrium of concurrent forces | w: 4 | 考纲: 受力分析
前置: force-analysis
alias: 平衡条件, 合力为零, 动态平衡, 力的三角形, 拉密定理

物体处于平衡（静止或匀速直线运动）$\iff$ 合外力为零：$\sum F_x=0$，$\sum F_y=0$。三力平衡时，三个力首尾相接构成封闭三角形（拉密定理：$\frac{F_1}{\sin\alpha_1}=\frac{F_2}{\sin\alpha_2}=\frac{F_3}{\sin\alpha_3}$，$\alpha_i$ 为另两力的夹角）。

### 例题
动态平衡：用细绳把小球挂在光滑墙面上，绳变长（与墙夹角减小）时，绳拉力 $T=\frac{mg}{\cos\theta}$ 与墙的支持力 $N=mg\tan\theta$ 都减小。用力的三角形图解法一目了然。

## 连接体问题 {#connected-bodies}
type: 例题 | en: Connected bodies | w: 3 | 考纲: 牛顿定律, 受力分析
前置: force-analysis, newton-second
alias: 连接体, 阿特伍德机, 叠加体, 板块模型

用轻绳、轻杆或接触连在一起的几个物体，加速度相同时先整体后隔离。

### 例题
**阿特伍德机**：质量 $m_1>m_2$ 的两物体跨过光滑定滑轮，
$$a=\frac{(m_1-m_2)g}{m_1+m_2},\qquad T=\frac{2m_1m_2g}{m_1+m_2}.$$
它放慢了自由落体，阿特伍德（1784）用它精确验证了牛顿第二定律。

## 向心力 {#centripetal-force}
type: 物理量 | en: Centripetal force | w: 4 | 考纲: 牛顿定律
前置: circular-motion, newton-second
后续: universal-gravitation, charged-particle-magnetic
alias: 向心力, 离心现象, 竖直面内的圆周运动

做圆周运动的物体所受合力沿半径方向的分量 $F_n=m\frac{v^2}r=m\omega^2r$。向心力是效果力，由重力、弹力、摩擦力、引力、洛伦兹力等提供。

### 例题
汽车过拱形桥顶时 $mg-N=m\frac{v^2}r$，$v=\sqrt{gr}$ 时对桥无压力。绳拉小球在竖直面内做圆周运动，最高点速度至少 $\sqrt{gr}$；若用杆，最高点速度可以为零。火车转弯的外轨略高于内轨，使重力与支持力的合力提供向心力。

## 非惯性系与惯性力 {#non-inertial-frames}
type: 概念 | en: Non-inertial frames | w: 3 | 考纲: 牛顿定律, 陌生情境中的综合推理
前置: newton-first, centripetal-force
后续: relativity-postulates
alias: 惯性力, 离心力, 科里奥利力, 失重, 超重

在加速度为 $\vv a_0$ 的参考系中，加上惯性力 $-m\vv a_0$ 后牛顿第二定律形式上仍成立。转动参考系中还有离心力 $m\omega^2r$ 与科里奥利力 $-2m\vv\omega\times\vv v$。

### 例题
电梯以加速度 $a$ 上升，人对台秤压力 $m(g+a)$（超重）；自由下落时压力为零（完全失重）。空间站里的航天员处于完全失重，并不是因为没有引力，而是在“自由下落”。

### 注记
傅科摆的摆动平面缓慢旋转、北半球气旋逆时针旋转，都是科里奥利力的效应。爱因斯坦把“引力与惯性力局部不可区分”上升为等效原理，作为广义相对论的出发点。
