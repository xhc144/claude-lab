---
galaxy: applied
cluster: classic-inequalities
title: 经典不等式
en: Classical inequalities
order: 7
level: core
---

## 幂平均不等式 {#power-mean}
type: 不等式 | en: Power mean inequality | w: 4 | 考纲: 不等式问题
源于: am-gm
前置: jensen-inequality
alias: 幂平均, 调和平均, 几何平均, 算术平均, 平方平均, HM-GM-AM-QM

对正数 $a_1,\dots,a_n$，幂平均 $M_p=\left(\frac1n\sum a_i^p\right)^{1/p}$（$M_0$ 定义为几何平均）关于 $p$ 单调不减。特别地
$$\frac n{\frac1{a_1}+\cdots+\frac1{a_n}}\le\sqrt[n]{a_1\cdots a_n}\le\frac{a_1+\cdots+a_n}n\le\sqrt{\frac{a_1^2+\cdots+a_n^2}n},$$
调和平均 $\le$ 几何平均 $\le$ 算术平均 $\le$ 平方平均，等号都当且仅当所有 $a_i$ 相等。

### 证明
$p<q$ 时，对凸函数 $x\mapsto x^{q/p}$（$q/p>1$，设 $p>0$）用 [[jensen-inequality]]：$\left(\frac1n\sum a_i^p\right)^{q/p}\le\frac1n\sum a_i^q$。其余情形类似处理。

### 例题
往返两地，去时速度 $v_1$、回时速度 $v_2$，平均速度是调和平均 $\frac{2v_1v_2}{v_1+v_2}$，它不超过 $\frac{v_1+v_2}2$——“去程慢了，回程再快也补不回来”。

## 排序不等式 {#rearrangement}
type: 不等式 | en: Rearrangement inequality | w: 4 | 考纲: 不等式问题
前置: inequality-properties
alias: 排序不等式, 顺序和, 乱序和, 逆序和, 切比雪夫和不等式

设 $a_1\le\cdots\le a_n$，$b_1\le\cdots\le b_n$，$\sigma$ 是任意排列，则
$$\sum a_ib_{n+1-i}\le\sum a_ib_{\sigma(i)}\le\sum a_ib_i,$$
逆序和 $\le$ 乱序和 $\le$ 顺序和。

### 证明
若某个排列中有 $i<j$ 而 $b_{\sigma(i)}>b_{\sigma(j)}$，交换这两项后和的变化为 $(a_j-a_i)(b_{\sigma(i)}-b_{\sigma(j)})\ge0$。不断消除“逆序对”，和单调不减，最终变为顺序和。

### 例题
- 有若干张面值不同的钞票，抓取次数不同：多次的抓大额，收获最大。
- $a^3+b^3+c^3\ge a^2b+b^2c+c^2a$（$a,b,c>0$）：$(a^2,b^2,c^2)$ 与 $(a,b,c)$ 同序，顺序和 $\ge$ 乱序和。
- 切比雪夫和不等式：同序时 $\frac1n\sum a_ib_i\ge\left(\frac1n\sum a_i\right)\left(\frac1n\sum b_i\right)$，把 $n$ 个循环乱序和相加即得。

## 赫尔德不等式 {#holder-inequality}
type: 不等式 | en: Hölder's inequality | w: 3 | 考纲: 不等式问题
源于: cauchy-schwarz
前置: jensen-inequality
后续: minkowski-inequality, lp-spaces
alias: Hölder 不等式, 杨氏不等式, 共轭指数

$p,q>1$，$\frac1p+\frac1q=1$，则
$$\sum\abs{a_ib_i}\le\left(\sum\abs{a_i}^p\right)^{1/p}\left(\sum\abs{b_i}^q\right)^{1/q},$$
积分形式类似。$p=q=2$ 即柯西–施瓦茨不等式。

### 证明
先证杨氏不等式 $xy\le\frac{x^p}p+\frac{y^q}q$（由 $\ln$ 的凹性：$\ln\left(\frac{x^p}p+\frac{y^q}q\right)\ge\frac1p\ln x^p+\frac1q\ln y^q$）。把 $a,b$ 归一化使两个范数都为 $1$，逐项用杨氏不等式再求和，右边为 $\frac1p+\frac1q=1$。

## 闵可夫斯基不等式 {#minkowski-inequality}
type: 不等式 | en: Minkowski inequality | w: 3 | 考纲: 不等式问题
源于: holder-inequality
alias: 闵可夫斯基不等式, p 范数的三角不等式

$p\ge1$ 时
$$\left(\sum\abs{a_i+b_i}^p\right)^{1/p}\le\left(\sum\abs{a_i}^p\right)^{1/p}+\left(\sum\abs{b_i}^p\right)^{1/p},$$
即 $p$ 范数满足三角不等式。几何意义：$\R^n$ 中“折线不短于直线”对一切 $\ell^p$ 距离都成立。

### 证明
$\sum\abs{a_i+b_i}^p\le\sum\abs{a_i}\abs{a_i+b_i}^{p-1}+\sum\abs{b_i}\abs{a_i+b_i}^{p-1}$，对右边两项分别用赫尔德不等式（指数 $p$ 与 $\frac p{p-1}$），再约去公因子。

## 切线法 {#tangent-line-trick}
type: 方法 | en: Tangent line trick | w: 3 | 考纲: 不等式问题, 极值问题
前置: derivative-inequality, convex-function
alias: 切线放缩, SOS, 局部调整, 切线技巧

证明 $\sum f(x_i)\ge nf\left(\frac{\sum x_i}n\right)$ 型不等式（但 $f$ 不是凸函数）时，在等号成立点 $x_0$ 处作切线 $\ell(x)=f(x_0)+f'(x_0)(x-x_0)$，若能证明 $f(x)\ge\ell(x)$ 在所需范围内成立，求和即得结论。

### 例题
$a,b,c>0$，$a+b+c=1$，证明 $\dfrac1{1+a^2}+\dfrac1{1+b^2}+\dfrac1{1+c^2}\le\dfrac{27}{10}$。

**证**：等号在 $a=b=c=\frac13$ 处。$f(x)=\frac1{1+x^2}$ 在 $x=\frac13$ 处的切线为 $\ell(x)=\frac{54-27x}{50}$。而
$$\ell(x)-f(x)=\frac{(3x-1)^2(4-3x)}{50(1+x^2)}\ge0\quad(0<x<1),$$
所以 $\sum f(a)\le\sum\ell(a)=\frac{3\cdot54-27}{50}=\frac{27}{10}$。注意 $f$ 在 $(0,1)$ 上并不是凹函数，不能直接用延森不等式，但它始终在这条切线下方。

## 调整法 {#smoothing-method}
type: 方法 | en: Smoothing and mixing variables | w: 2 | 考纲: 不等式问题, 极值问题
前置: am-gm
相关: extremal-principle
alias: 磨光变换, 局部调整, 逐步调整, 混合变量法

保持约束不变地调整变量（例如把两个不相等的变量换成它们的平均值），证明目标函数朝一个方向单调变化，最终所有变量相等时取得极值。

### 例题
用调整法证明 $n$ 元均值不等式：设正数 $a_1,\dots,a_n$ 之和为 $nA$ 而不全相等，则必有 $a_i<A<a_j$。把 $(a_i,a_j)$ 换成 $(A,\ a_i+a_j-A)$：和不变，而
$$A(a_i+a_j-A)-a_ia_j=(A-a_i)(a_j-A)>0,$$
乘积严格增大，并且多了一个等于 $A$ 的数。至多 $n-1$ 次调整后所有数都等于 $A$，乘积变为 $A^n$，所以原来的乘积 $<A^n$。

### 注记
调整法需要先保证极值存在（紧性），否则可能“调整”无穷多次而不到达。施泰纳曾用对称化给出等周定理的几何证明，但遗漏了存在性，后由魏尔斯特拉斯补全。
