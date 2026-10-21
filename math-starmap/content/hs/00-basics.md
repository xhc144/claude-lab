---
galaxy: hs
cluster: hs-basics
title: 数与式
en: Numbers and expressions
order: 0
level: hs
---

## √2 是无理数 {#irrational-sqrt2}
type: 定理 | en: Irrationality of √2 | w: 3 | 考纲: 中学数学全部内容
前置: proof-by-contradiction
alias: 根号2是无理数, 无理数, 有理数
tags: 数系, 反证法

不存在整数 $p,q$ 使 $\left(\frac pq\right)^2=2$。这是历史上第一个被发现的“不可公度”现象：正方形的对角线与边长没有公共度量单位，有理数不够用。

### 证明
反设 $\sqrt2=\frac pq$，$p,q$ 为互素正整数。则 $p^2=2q^2$，$p^2$ 是偶数，所以 $p$ 是偶数（奇数的平方是奇数）。设 $p=2r$，得 $4r^2=2q^2$，即 $q^2=2r^2$，$q$ 也是偶数，与 $p,q$ 互素矛盾。

### 注记
同样的论证给出：若正整数 $n$ 不是完全平方数，则 $\sqrt n$ 是无理数（用算术基本定理比较素因子的指数）。更一般地，首一整系数多项式的有理根必为整数（有理根定理）。

## 绝对值 {#absolute-value}
type: 概念 | en: Absolute value | w: 3 | 考纲: 中学数学全部内容
后续: abs-inequality, sequence-limit
alias: 绝对值, 距离

$\abs a$ 表示数轴上点 $a$ 到原点的距离，$\abs{a-b}$ 是 $a$、$b$ 两点间的距离。去绝对值要按正负分类讨论。

> [!定义] 绝对值
> $$\abs a=\begin{cases}a, & a\ge0,\\-a, & a<0,\end{cases}\qquad \abs a=\sqrt{a^2}.$$

### 例题
解不等式 $\abs{x-1}+\abs{x+2}<5$。

**解**：几何上，$\abs{x-1}+\abs{x+2}$ 是点 $x$ 到 $1$ 与 $-2$ 的距离之和。两点间距离为 $3$，所以在 $[-2,1]$ 上和恒为 $3<5$；在区间外每向外移动 $t$，和增加 $2t$。由 $3+2t<5$ 得 $t<1$，解集为 $(-3,2)$。

### 应用
距离的观点贯穿分析：数列极限 $\abs{a_n-a}<\eps$、连续性 $\abs{f(x)-f(x_0)}<\eps$ 都是“距离足够小”。

## 乘法公式与因式分解 {#factoring-formulas}
type: 公式 | en: Factoring identities | w: 2 | 考纲: 中学数学全部内容
后续: quadratic-equation, sequence-summation
alias: 平方差, 立方和, 完全平方, 因式分解

常用恒等式：$a^2-b^2=(a-b)(a+b)$，$(a\pm b)^2=a^2\pm2ab+b^2$，$a^3\pm b^3=(a\pm b)(a^2\mp ab+b^2)$，以及一般的
$$a^n-b^n=(a-b)\left(a^{n-1}+a^{n-2}b+\cdots+b^{n-1}\right).$$

### 例题
证明 $a^3+b^3+c^3-3abc=(a+b+c)(a^2+b^2+c^2-ab-bc-ca)$，并由此说明 $a,b,c\ge0$ 时 $a^3+b^3+c^3\ge3abc$。

**证**：展开右边即得恒等式。又 $a^2+b^2+c^2-ab-bc-ca=\frac12\left[(a-b)^2+(b-c)^2+(c-a)^2\right]\ge0$，而 $a+b+c\ge0$，所以左边 $\ge0$。这正是三元 [[am-gm|均值不等式]]。

## 一元二次方程 {#quadratic-equation}
type: 方程 | en: Quadratic equation | w: 4 | 考纲: 中学数学全部内容
前置: factoring-formulas
推出: vieta-theorem
后续: quadratic-function, quadratic-inequality
相关: complex-number
alias: 求根公式, 判别式, 配方法

$ax^2+bx+c=0$（$a\ne0$）配方后得到求根公式；判别式 $\Delta=b^2-4ac$ 决定实根的个数。

> [!公式] 求根公式
> $$x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}.$$
> $\Delta>0$ 两个不等实根；$\Delta=0$ 一个二重实根；$\Delta<0$ 无实根（在复数范围内有一对共轭复根）。

### 推导
两边除以 $a$ 并配方：$\left(x+\frac b{2a}\right)^2=\frac{b^2-4ac}{4a^2}$，开平方即得。

### 注记
求根公式在复数域里总能用：当 $\Delta<0$ 时 $\sqrt\Delta=\ii\sqrt{-\Delta}$。三次、四次方程也有根式公式（卡尔达诺、费拉里），五次及以上一般方程没有（见 [[quintic-insolvability]]）。

## 韦达定理 {#vieta-theorem}
type: 定理 | en: Vieta's formulas | w: 4 | 考纲: 中学数学全部内容
应用于: conic-chord-problems
推广为: symmetric-polynomials
alias: 根与系数的关系, 韦达

若 $x_1,x_2$ 是 $ax^2+bx+c=0$ 的两根，则 $x_1+x_2=-\frac ba$，$x_1x_2=\frac ca$。一般地，$n$ 次多项式各根的初等对称多项式由系数给出。

### 证明
$a(x-x_1)(x-x_2)=ax^2-a(x_1+x_2)x+ax_1x_2$，与 $ax^2+bx+c$ 比较系数。

### 例题
已知 $x_1,x_2$ 是 $x^2-3x+1=0$ 的根，求 $x_1^3+x_2^3$。

**解**：$x_1+x_2=3$，$x_1x_2=1$，$x_1^3+x_2^3=(x_1+x_2)^3-3x_1x_2(x_1+x_2)=27-9=18$。不求根，只用两个对称量。

### 应用
解析几何中“设而不求”：直线与圆锥曲线联立后，弦长、中点、向量积都用 $x_1+x_2$、$x_1x_2$ 表示，见 [[conic-chord-problems]]。

## 余数定理与因式定理 {#polynomial-remainder}
type: 定理 | en: Remainder and factor theorems | w: 2 | 考纲: 中学数学全部内容
前置: factoring-formulas
推广为: polynomial-ring
alias: 余数定理, 因式定理, 多项式除法

多项式 $f(x)$ 除以 $x-a$ 的余数是 $f(a)$；因此 $x-a$ 整除 $f(x)$ 当且仅当 $f(a)=0$。$n$ 次多项式至多有 $n$ 个根。

### 证明
带余除法给出 $f(x)=(x-a)q(x)+r$，$r$ 是常数；代入 $x=a$ 得 $r=f(a)$。若 $f$ 有 $n+1$ 个不同根，逐个提出一次因式，$f$ 的次数至少为 $n+1$。

### 例题
$f(x)$ 除以 $x-1$ 余 $2$，除以 $x-2$ 余 $3$，求 $f(x)$ 除以 $(x-1)(x-2)$ 的余式。

**解**：设余式 $px+q$，则 $p+q=f(1)=2$，$2p+q=f(2)=3$，得 $p=1,q=1$，余式为 $x+1$。
