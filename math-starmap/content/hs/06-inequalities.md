---
galaxy: hs
cluster: hs-inequalities
title: 不等式
en: Inequalities
order: 6
level: hs
---

## 不等式的性质 {#inequality-properties}
type: 性质 | en: Properties of inequalities | w: 3 | 考纲: 中学数学全部内容
后续: quadratic-inequality, am-gm
alias: 不等式基本性质, 作差法

不等式的基本性质：传递性；两边加同一个数不变号；两边乘正数不变号、乘负数变号；同向正数不等式可以相乘；$a>b>0\Rightarrow a^n>b^n$（$n\in\N^*$）。

### 方法
比较大小最基本的方法是作差（判断 $a-b$ 的符号）和作商（正数时判断 $\frac ab$ 与 $1$ 的大小）。

### 易错
- $a>b$ 不能推出 $\frac1a<\frac1b$，除非 $ab>0$。
- $a>b,\ c>d$ 不能推出 $a-c>b-d$ 或 $ac>bd$。

## 一元二次不等式 {#quadratic-inequality}
type: 方法 | en: Quadratic inequalities | w: 3 | 考纲: 中学数学全部内容
前置: quadratic-function, inequality-properties
alias: 三个二次, 恒成立问题

解 $ax^2+bx+c>0$：看二次函数图像在 $x$ 轴上方的部分。$a>0$ 且 $\Delta>0$ 时，解集为“两根之外”$(-\infty,x_1)\cup(x_2,+\infty)$，$ax^2+bx+c<0$ 的解集为“两根之间”$(x_1,x_2)$。

### 例题
若 $ax^2+2x+1>0$ 对一切实数 $x$ 成立，求 $a$。

**解**：$a=0$ 时 $2x+1>0$ 不恒成立。$a\ne0$ 时需 $a>0$ 且 $\Delta=4-4a<0$，得 $a>1$。“三个二次”（方程、函数、不等式）的联系：方程的根就是函数零点，也是不等式解集的端点。

## 基本不等式 {#am-gm}
type: 不等式 | en: AM–GM inequality | w: 5 | 考纲: 中学数学全部内容, 不等式问题
前置: inequality-properties
推广为: power-mean, jensen-inequality
应用于: inequality-extremum
alias: 均值不等式, 算术-几何平均不等式, AM-GM, 一正二定三相等
tags: 不等式

对正数 $a,b$，$\dfrac{a+b}2\ge\sqrt{ab}$，等号当且仅当 $a=b$。一般地，$n$ 个正数的算术平均不小于几何平均：
$$\frac{a_1+a_2+\cdots+a_n}n\ge\sqrt[n]{a_1a_2\cdots a_n}.$$

### 证明
两元：$a+b-2\sqrt{ab}=\left(\sqrt a-\sqrt b\right)^2\ge0$。
$n$ 元（柯西的“前进—后退”归纳）：由两元情形归纳出 $n=2^m$ 的情形；对一般 $n$，补上 $2^m-n$ 个等于 $A=\frac{a_1+\cdots+a_n}n$ 的数，得 $A\ge\left(a_1\cdots a_nA^{2^m-n}\right)^{1/2^m}$，整理即 $A^n\ge a_1\cdots a_n$。另一种证法：$\ln$ 是凹函数，由 [[jensen-inequality]] 立得。

### 例题
已知 $x>0$，求 $x+\frac4{x+1}$ 的最小值。

**解**：$x+\frac4{x+1}=(x+1)+\frac4{x+1}-1\ge2\sqrt4-1=3$，当 $x+1=2$ 即 $x=1$ 时取等号。用基本不等式求最值要检验“一正、二定、三相等”：各项为正、积（或和）为定值、等号能取到。

### 几何意义
以 $a+b$ 为直径作圆，在分点处作垂线，垂线段长为 $\sqrt{ab}$（射影定理），它不超过半径 $\frac{a+b}2$。

## 柯西不等式（中学形式） {#cauchy-inequality-hs}
type: 不等式 | en: Cauchy–Schwarz inequality (school form) | w: 4 | 考纲: 中学数学全部内容, 不等式问题
前置: inequality-properties, dot-product
推广为: cauchy-schwarz
alias: 柯西不等式, 柯西-施瓦茨, 权方和

$$(a_1^2+\cdots+a_n^2)(b_1^2+\cdots+b_n^2)\ge(a_1b_1+\cdots+a_nb_n)^2,$$
等号当且仅当两组数成比例。几何上，它就是 $\abs{\vv a\cdot\vv b}\le\abs{\vv a}\abs{\vv b}$。

### 证明
考虑关于 $t$ 的二次函数 $\sum(a_it-b_i)^2\ge0$，展开为 $\left(\sum a_i^2\right)t^2-2\left(\sum a_ib_i\right)t+\sum b_i^2\ge0$ 对一切 $t$ 成立，故判别式 $\le0$。

### 例题
已知 $x+2y+3z=6$，求 $x^2+y^2+z^2$ 的最小值。

**解**：$(x^2+y^2+z^2)(1+4+9)\ge(x+2y+3z)^2=36$，最小值 $\frac{18}7$，在 $(x,y,z)=\frac37(1,2,3)$ 时取到。几何意义：原点到平面 $x+2y+3z=6$ 的距离平方。

### 注记
权方和（Engel 形式）：$\dfrac{a_1^2}{b_1}+\cdots+\dfrac{a_n^2}{b_n}\ge\dfrac{(a_1+\cdots+a_n)^2}{b_1+\cdots+b_n}$（$b_i>0$），是分式不等式的利器。

## 绝对值三角不等式 {#abs-inequality}
type: 不等式 | en: Triangle inequality | w: 3 | 考纲: 中学数学全部内容
前置: absolute-value
推广为: metric-space
alias: 三角不等式, |a|-|b|≤|a+b|≤|a|+|b|

$$\big|\abs a-\abs b\big|\le\abs{a\pm b}\le\abs a+\abs b.$$
对向量、复数同样成立：$\abs{z_1+z_2}\le\abs{z_1}+\abs{z_2}$，即三角形两边之和大于第三边。

### 证明
$-\abs a\le a\le\abs a$，$-\abs b\le b\le\abs b$，相加得 $-(\abs a+\abs b)\le a+b\le\abs a+\abs b$。左半由 $\abs a=\abs{(a+b)-b}\le\abs{a+b}+\abs b$ 得到。

### 应用
它是一切“距离”概念的公理之一（[[metric-space]]），也是极限证明中“插项”的依据：$\abs{a_n-a}\le\abs{a_n-b_n}+\abs{b_n-a}$。
