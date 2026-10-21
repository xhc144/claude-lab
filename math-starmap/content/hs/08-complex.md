---
galaxy: hs
cluster: hs-complex
title: 复数
en: Complex numbers
order: 8
level: hs
---

## 复数 {#complex-number}
type: 概念 | en: Complex number | w: 5 | 考纲: 中学数学全部内容
前置: quadratic-equation
后续: complex-arithmetic, complex-plane
alias: 虚数单位, i, 实部, 虚部, 共轭复数
tags: 复数

引入满足 $\ii^2=-1$ 的虚数单位，形如 $z=a+b\ii$（$a,b\in\R$）的数叫复数，$a$ 是实部，$b$ 是虚部。$b=0$ 时是实数，$a=0,b\ne0$ 时是纯虚数。$\bar z=a-b\ii$ 是共轭复数。

### 为什么需要复数
历史上复数不是为解 $x^2+1=0$ 引入的，而是为了三次方程：卡尔达诺公式解 $x^3=15x+4$ 时，即使三个根全是实数（其中一个是 $4$），中间步骤也要经过 $\sqrt{-121}$。复数是让代数“封闭”的最小扩张：任何复系数多项式都在复数中有根（[[fundamental-theorem-algebra]]）。

### 注记
两个复数相等当且仅当实部、虚部分别相等；复数不能比较大小（无法定义与运算相容的全序）。

## 复数的四则运算 {#complex-arithmetic}
type: 公式 | en: Complex arithmetic | w: 3 | 考纲: 中学数学全部内容
前置: complex-number
alias: 复数除法, 分母实数化

$(a+b\ii)(c+d\ii)=(ac-bd)+(ad+bc)\ii$；除法分子分母同乘分母的共轭：
$$\frac{a+b\ii}{c+d\ii}=\frac{(a+b\ii)(c-d\ii)}{c^2+d^2}.$$
共轭的性质：$\overline{z_1z_2}=\bar z_1\bar z_2$，$z\bar z=\abs z^2$。

### 例题
计算 $\left(\frac{1+\ii}{1-\ii}\right)^{2027}$。

**解**：$\frac{1+\ii}{1-\ii}=\frac{(1+\ii)^2}{2}=\ii$，而 $\ii$ 的幂以 $4$ 为周期：$2027=4\times506+3$，所以结果为 $\ii^3=-\ii$。

## 复平面与模 {#complex-plane}
type: 概念 | en: Complex plane | w: 4 | 考纲: 中学数学全部内容
前置: complex-number, plane-vector
后续: complex-polar-form
alias: 复平面, 模, 辐角, 复数的几何意义

复数 $z=a+b\ii$ 对应平面上的点 $(a,b)$，也对应向量 $\vec{OZ}$。模 $\abs z=\sqrt{a^2+b^2}$ 是到原点的距离，$\abs{z_1-z_2}$ 是两点间距离。复数加法就是向量加法。

### 例题
满足 $\abs{z-\ii}+\abs{z+\ii}=4$ 的复数 $z$ 对应的点的轨迹是什么？

**解**：到 $(0,1)$ 与 $(0,-1)$ 距离之和为 $4$ 的点的轨迹是椭圆 $\frac{x^2}3+\frac{y^2}4=1$（$a=2$，$c=1$，$b^2=3$）。复数的模把几何轨迹写成了简洁的方程，见 [[ellipse]]。

## 复数的三角形式 {#complex-polar-form}
type: 公式 | en: Polar form and De Moivre's formula | w: 4 | 考纲: 中学数学全部内容
前置: complex-plane, trig-functions
推出: roots-of-unity
后续: euler-formula
alias: 棣莫弗公式, 三角形式, 辐角, 复数乘法的几何意义

$z=r(\cos\theta+\ii\sin\theta)$，$r=\abs z$，$\theta$ 是辐角。乘法时模相乘、辐角相加：
$$r_1(\cos\theta_1+\ii\sin\theta_1)\cdot r_2(\cos\theta_2+\ii\sin\theta_2)=r_1r_2\left[\cos(\theta_1+\theta_2)+\ii\sin(\theta_1+\theta_2)\right].$$
由此得棣莫弗公式 $(\cos\theta+\ii\sin\theta)^n=\cos n\theta+\ii\sin n\theta$。

### 直观
乘以一个复数 $=$ 旋转 $+$ 伸缩。乘以 $\ii$ 就是逆时针旋转 $90^\circ$；$\ii^2=-1$ 是两次旋转 $90^\circ$，即掉头。

### 应用
用棣莫弗公式展开 $(\cos\theta+\ii\sin\theta)^3$ 并比较实部虚部，得到三倍角公式 $\cos3\theta=4\cos^3\theta-3\cos\theta$，$\sin3\theta=3\sin\theta-4\sin^3\theta$。

## 单位根 {#roots-of-unity}
type: 概念 | en: Roots of unity | w: 3 | 考纲: 中学数学全部内容
源于: complex-polar-form
应用于: fft, cyclic-group
alias: n次单位根, ω, 本原单位根

方程 $z^n=1$ 的 $n$ 个复根 $\omega_k=\cos\frac{2k\pi}n+\ii\sin\frac{2k\pi}n$（$k=0,1,\dots,n-1$）把单位圆 $n$ 等分，构成正 $n$ 边形的顶点。

### 性质
设 $\omega=\ee^{2\pi\ii/n}$，则 $\omega_k=\omega^k$，且 $1+\omega+\omega^2+\cdots+\omega^{n-1}=0$（$n\ge2$）；$x^n-1=\prod_{k=0}^{n-1}(x-\omega^k)$。

### 例题
设 $\omega=\frac{-1+\sqrt3\ii}2$，求 $1+\omega+\omega^2$ 与 $(1-\omega+\omega^2)(1+\omega-\omega^2)$。

**解**：$\omega$ 是三次单位根，$\omega^3=1$，$1+\omega+\omega^2=0$。于是 $1-\omega+\omega^2=-2\omega$，$1+\omega-\omega^2=-2\omega^2$，乘积 $=4\omega^3=4$。

### 应用
单位根在乘法下构成 $n$ 阶循环群；离散傅里叶变换以单位根为“频率”，[[fft]] 正是利用 $\omega^{2}$ 是 $\frac n2$ 次单位根来递归减半计算量。
