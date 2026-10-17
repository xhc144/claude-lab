---
galaxy: hs
cluster: hs-vectors
title: 平面向量
en: Plane vectors
order: 7
level: hs
---

## 平面向量 {#plane-vector}
type: 概念 | en: Plane vector | w: 5 | 考纲: 中学数学全部内容
后续: vector-decomposition, dot-product
推广为: vector-space
alias: 向量, 有向线段, 线性运算, 共线向量
tags: 向量

既有大小又有方向的量叫向量，用有向线段表示，与起点位置无关。向量可以相加（平行四边形法则、三角形法则）、数乘；$\vv b$ 与非零向量 $\vv a$ 共线当且仅当存在唯一实数 $\lambda$ 使 $\vv b=\lambda\vv a$。

### 注记
向量把几何对象代数化：位移、速度、力都是向量。抽象出“加法与数乘满足的八条运算律”就得到线性代数里的 [[vector-space]]。

## 平面向量基本定理与坐标 {#vector-decomposition}
type: 定理 | en: Basis decomposition of plane vectors | w: 4 | 考纲: 中学数学全部内容
前置: plane-vector
推广为: basis
alias: 平面向量基本定理, 基底, 向量坐标, 三点共线

若 $\vv e_1,\vv e_2$ 是平面内两个不共线的向量，则平面内任一向量 $\vv a$ 都可以唯一地写成 $\vv a=\lambda_1\vv e_1+\lambda_2\vv e_2$。取互相垂直的单位向量为基底，系数就是坐标。

### 例题
$P$ 在直线 $AB$ 上的充要条件：$\vec{OP}=\lambda\vec{OA}+\mu\vec{OB}$ 且 $\lambda+\mu=1$。

**证**：$P$ 在 $AB$ 上 $\iff\vec{AP}=t\vec{AB}\iff\vec{OP}-\vec{OA}=t(\vec{OB}-\vec{OA})\iff\vec{OP}=(1-t)\vec{OA}+t\vec{OB}$。当 $0\le t\le1$ 时 $P$ 在线段 $AB$ 上——这是“凸组合”概念的雏形，见 [[convex-set]]。

### 注记
“两个不共线向量构成基底”推广到 $n$ 维就是 [[basis]] 与 [[dimension]]：维数就是基底中向量的个数。

## 向量的数量积 {#dot-product}
type: 定义 | en: Dot product | w: 5 | 考纲: 中学数学全部内容
前置: plane-vector, trig-functions
后续: law-of-cosines, angle-sum-formulas, space-vector-method
推广为: inner-product-space
alias: 点积, 内积, 投影, 夹角

$\vv a\cdot\vv b=\abs{\vv a}\abs{\vv b}\cos\theta$，坐标形式 $\vv a\cdot\vv b=x_1x_2+y_1y_2$。它把长度与角度变成可计算的代数式：$\abs{\vv a}^2=\vv a\cdot\vv a$，$\vv a\perp\vv b\iff\vv a\cdot\vv b=0$。

### 推导
两种定义的等价性来自余弦定理：$\abs{\vv a-\vv b}^2=\abs{\vv a}^2+\abs{\vv b}^2-2\abs{\vv a}\abs{\vv b}\cos\theta$，而左边用坐标展开为 $\abs{\vv a}^2+\abs{\vv b}^2-2(x_1x_2+y_1y_2)$，比较即得。

### 注记
- $\abs{\vv b}\cos\theta$ 是 $\vv b$ 在 $\vv a$ 方向上的投影（数量），$\frac{\vv a\cdot\vv b}{\abs{\vv a}^2}\vv a$ 是投影向量。投影是最小二乘与 [[orthogonal-projection]] 的核心。
- 物理中，力做的功 $W=\vv F\cdot\vv s$。
- 数量积不满足结合律：$(\vv a\cdot\vv b)\vv c$ 一般不等于 $\vv a(\vv b\cdot\vv c)$。

## 向量方法解几何问题 {#vector-geometry}
type: 方法 | en: Vector methods in geometry | w: 3 | 考纲: 中学数学全部内容, 向量方法与几何直观的结合
前置: dot-product, vector-decomposition
后续: space-vector-method
alias: 向量法, 极化恒等式

把几何关系翻译为向量运算：平行 $\iff$ 共线，垂直 $\iff$ 数量积为零，长度 $=\sqrt{\vv a\cdot\vv a}$，夹角由数量积求出。

### 例题
**极化恒等式**：$\vv a\cdot\vv b=\frac14\left(\abs{\vv a+\vv b}^2-\abs{\vv a-\vv b}^2\right)$。设 $M$ 是 $BC$ 中点，则 $\vec{AB}\cdot\vec{AC}=\abs{\vec{AM}}^2-\frac14\abs{\vec{BC}}^2$。

**应用**：边长为 $2$ 的正三角形 $ABC$ 中，$P$ 在 $BC$ 上运动，求 $\vec{PA}\cdot\vec{PB}+\vec{PA}\cdot\vec{PC}$ 的范围。
$\vec{PB}+\vec{PC}=2\vec{PM}$，原式 $=2\vec{PA}\cdot\vec{PM}$。以 $M$ 为原点、$BC$ 为 $x$ 轴，$P=(t,0)$，$A=(0,\sqrt3)$，$t\in[-1,1]$，原式 $=2(-t,\sqrt3)\cdot(-t,0)=2t^2\in[0,2]$。

### 注记
三角形“四心”的向量刻画：重心 $\vec{GA}+\vec{GB}+\vec{GC}=\vv0$；外心到三顶点距离相等；垂心 $\vec{HA}\cdot\vec{HB}=\vec{HB}\cdot\vec{HC}=\vec{HC}\cdot\vec{HA}$。
