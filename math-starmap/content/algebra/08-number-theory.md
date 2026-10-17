---
galaxy: algebra
cluster: number-theory
title: 初等数论
en: Elementary number theory
order: 7.5
level: hs
---

## 整除与带余除法 {#divisibility}
type: 定义 | en: Divisibility and division with remainder | w: 4 | 考纲: 中学数学全部内容
后续: gcd-euclid, primes, congruence
alias: 整除, 带余除法, 因数, 倍数

$a\mid b$ 指存在整数 $q$ 使 $b=qa$。对整数 $a$ 和正整数 $b$，存在唯一的 $q,r$ 使 $a=qb+r$，$0\le r<b$（带余除法）。

### 注记
带余除法的存在性来自良序原理：$\{a-qb\ge0\}$ 的最小元就是余数。整除的基本性质：$a\mid b,\ a\mid c\Rightarrow a\mid(mb+nc)$。

## 最大公约数与辗转相除法 {#gcd-euclid}
type: 算法 | en: GCD and the Euclidean algorithm | w: 4 | 考纲: 中学数学全部内容
前置: divisibility
推出: bezout
alias: 欧几里得算法, 辗转相除, 最大公因数, gcd

由 $\gcd(a,b)=\gcd(b,a\bmod b)$ 反复取余，直到余数为零，最后一个非零余数就是最大公约数。

### 例题
$\gcd(252,198)$：$252=1\times198+54$，$198=3\times54+36$，$54=1\times36+18$，$36=2\times18$，所以 $\gcd=18$。

### 注记
步数至多约为较小数的位数的 $5$ 倍（拉梅定理），最坏情形是相邻的斐波那契数。这是已知最古老的非平凡算法之一，出现在欧几里得《几何原本》第七卷。中国古代称“更相减损术”。

## 裴蜀定理 {#bezout}
type: 定理 | en: Bézout's identity | w: 4 | 考纲: 中学数学全部内容
源于: gcd-euclid
推出: primes, crt
推广为: ideal
alias: 贝祖定理, 裴蜀等式, 扩展欧几里得算法

对整数 $a,b$（不全为零），存在整数 $x,y$ 使 $ax+by=\gcd(a,b)$；并且 $\{ax+by\}$ 恰好是 $\gcd(a,b)$ 的全体倍数。特别地，$a,b$ 互素 $\iff$ 存在 $x,y$ 使 $ax+by=1$。

### 证明
$S=\{ax+by>0\}$ 有最小元 $d$。对 $a$ 作带余除法 $a=qd+r$，$r=a-q(ax_0+by_0)$ 也是 $a,b$ 的整系数组合且 $0\le r<d$，由 $d$ 的最小性 $r=0$，即 $d\mid a$；同理 $d\mid b$。而 $a,b$ 的公因数都整除 $d$，所以 $d=\gcd(a,b)$。

### 应用
在模 $n$ 下求逆元：$\gcd(a,n)=1$ 时 $ax\equiv1\pmod n$ 的解由扩展欧几里得算法给出；RSA 解密指数就是这样算出的。

## 素数与算术基本定理 {#primes}
type: 定理 | en: Primes and the fundamental theorem of arithmetic | w: 5 | 考纲: 中学数学全部内容
前置: divisibility
源于: bezout
后续: infinitude-primes, fermat-little
推广为: ufd
alias: 素数, 质数, 唯一分解定理, 欧几里得引理
tags: 数论

大于 $1$ 的正整数都能分解为素数之积，且在不计顺序时分解唯一。

### 证明
存在性：对 $n$ 用强归纳。唯一性的关键是欧几里得引理：素数 $p\mid ab\Rightarrow p\mid a$ 或 $p\mid b$。若 $p\nmid a$，则 $\gcd(p,a)=1$，由裴蜀 $px+ay=1$，乘以 $b$：$pbx+aby=b$，左边被 $p$ 整除，故 $p\mid b$。

### 注记
唯一分解并非理所当然：在 $\Z[\sqrt{-5}]$ 中 $6=2\times3=(1+\sqrt{-5})(1-\sqrt{-5})$ 有两种本质不同的分解。这个现象推动了库默尔、戴德金发明理想理论。

## 素数有无穷多个 {#infinitude-primes}
type: 定理 | en: Infinitude of primes | w: 3 | 考纲: 中学数学全部内容
前置: primes, proof-by-contradiction
alias: 欧几里得定理, 素数无穷

素数有无穷多个。

### 证明
（欧几里得）任给有限个素数 $p_1,\dots,p_k$，数 $N=p_1p_2\cdots p_k+1$ 被每个 $p_i$ 除都余 $1$，而 $N>1$ 有素因子，它不在给出的列表里。所以任何有限的素数表都不完整。

### 注记
欧拉的分析证明：$\sum_p\frac1p$ 发散（比“素数无穷”强得多）。素数定理说明不超过 $x$ 的素数约有 $\frac x{\ln x}$ 个；狄利克雷定理说明 $a+nd$（$\gcd(a,d)=1$）中有无穷多个素数。

## 同余 {#congruence}
type: 定义 | en: Congruence | w: 5 | 考纲: 中学数学全部内容
前置: divisibility
后续: fermat-little, crt, modular-group
alias: 同余, 模运算, 剩余类, mod

$a\equiv b\pmod m$ 指 $m\mid(a-b)$。同余是等价关系，并且与加、减、乘相容，可以像等式一样运算：$a\equiv b,\ c\equiv d\Rightarrow a+c\equiv b+d,\ ac\equiv bd$。

### 例题
$2^{100}$ 除以 $7$ 的余数：$2^3=8\equiv1\pmod7$，$2^{100}=(2^3)^{33}\cdot2\equiv2\pmod7$。
一个数被 $9$ 整除 $\iff$ 各位数字之和被 $9$ 整除：$10\equiv1\pmod9$。

### 注记
除法要小心：$ac\equiv bc\pmod m$ 只能推出 $a\equiv b\pmod{\frac m{\gcd(c,m)}}$。模 $m$ 的剩余类 $\Z/m\Z$ 构成环；$m$ 为素数时是域。

## 费马小定理 {#fermat-little}
type: 定理 | en: Fermat's little theorem | w: 5 | 考纲: 中学数学全部内容
前置: congruence, primes
推广为: euler-theorem, lagrange-group-theorem
应用于: rsa
alias: 费马小定理, a^p ≡ a

若 $p$ 是素数，则对任意整数 $a$，$a^p\equiv a\pmod p$；当 $p\nmid a$ 时 $a^{p-1}\equiv1\pmod p$。

### 证明
$p\nmid a$ 时，$a,2a,\dots,(p-1)a$ 模 $p$ 两两不同余且都不为零，所以它们恰好是 $1,2,\dots,p-1$ 的一个排列。相乘：$a^{p-1}(p-1)!\equiv(p-1)!$，而 $(p-1)!$ 与 $p$ 互素，可约去。
群论证明：$a$ 属于乘法群 $(\Z/p\Z)^\times$，该群阶为 $p-1$，由 [[lagrange-group-theorem]] 元素的阶整除群的阶。

### 应用
素性测试（逆否命题：若 $a^{n-1}\not\equiv1$，则 $n$ 是合数）、快速求大数幂的余数、RSA 加密。

## 欧拉定理与欧拉函数 {#euler-theorem}
type: 定理 | en: Euler's theorem | w: 4 | 考纲: 中学数学全部内容
源于: fermat-little
前置: bezout
应用于: rsa
alias: 欧拉函数, φ(n), 欧拉定理

$\varphi(n)$ 是 $1,\dots,n$ 中与 $n$ 互素的数的个数。若 $\gcd(a,n)=1$，则 $a^{\varphi(n)}\equiv1\pmod n$。

### 公式
$\varphi(n)=n\prod_{p\mid n}\left(1-\frac1p\right)$；$\varphi$ 是积性函数：$\gcd(m,n)=1$ 时 $\varphi(mn)=\varphi(m)\varphi(n)$；$\sum_{d\mid n}\varphi(d)=n$。公式本身可由 [[inclusion-exclusion]] 得到。

### 例题
$\varphi(12)=12\left(1-\frac12\right)\left(1-\frac13\right)=4$（$1,5,7,11$）。求 $7^{222}$ 的末两位：欧拉定理保证 $7^{40}\equiv1\pmod{100}$（$\varphi(100)=40$），而实际上 $7^4=2401\equiv1$ 更快：$222=4\times55+2$，所以 $7^{222}\equiv7^2=49$，末两位是 $49$。元素的阶总是整除 $\varphi(n)$，但可能更小。

## 中国剩余定理 {#crt}
type: 定理 | en: Chinese remainder theorem | w: 4 | 考纲: 中学数学全部内容
源于: bezout
前置: congruence
类比: generalized-eigenspace
alias: 孙子定理, 中国剩余定理, 物不知数, 同余方程组

若 $m_1,\dots,m_k$ 两两互素，则同余方程组 $x\equiv a_i\pmod{m_i}$ 在模 $M=m_1\cdots m_k$ 下有唯一解：
$$x\equiv\sum_ia_iM_iy_i\pmod M,\qquad M_i=\frac M{m_i},\ M_iy_i\equiv1\pmod{m_i}.$$

### 例题
《孙子算经》：“今有物不知其数，三三数之剩二，五五数之剩三，七七数之剩二，问物几何？”$M=105$，$M_1=35,y_1=2$；$M_2=21,y_2=1$；$M_3=15,y_3=1$。$x\equiv2\cdot70+3\cdot21+2\cdot15=233\equiv23\pmod{105}$。

### 注记
结构上，$\Z/M\Z\cong\Z/m_1\Z\times\cdots\times\Z/m_k\Z$（环同构）。同一思想出现在多项式上（拉格朗日插值、矩阵的准素分解）与计算机大数运算中。

## 威尔逊定理 {#wilson-theorem}
type: 定理 | en: Wilson's theorem | w: 2 | 考纲: 中学数学全部内容
前置: fermat-little
alias: (p-1)! ≡ -1

$p$ 是素数 $\iff(p-1)!\equiv-1\pmod p$。

### 证明
$p$ 为素数时，$1,\dots,p-1$ 中每个数在模 $p$ 下有唯一的逆元；只有 $1$ 与 $p-1$ 的逆元是自己（$x^2\equiv1\iff x\equiv\pm1$）。其余的数两两配对乘积为 $1$，所以 $(p-1)!\equiv1\cdot(p-1)\equiv-1$。若 $n$ 是合数，$n$ 的某个真因子 $d$ 整除 $(n-1)!$ 却不整除 $(n-1)!+1$。

## RSA 公钥密码 {#rsa}
type: 应用 | en: RSA cryptosystem | w: 3 | 考纲: 中学数学全部内容
前置: euler-theorem, bezout
alias: RSA, 公钥加密, 大数分解

选两个大素数 $p,q$，$n=pq$，取与 $\varphi(n)=(p-1)(q-1)$ 互素的 $e$，求 $d$ 使 $ed\equiv1\pmod{\varphi(n)}$。公开 $(n,e)$，保密 $d$。加密 $c=m^e\bmod n$，解密 $m=c^d\bmod n$。

### 为什么正确
$ed=1+k\varphi(n)$，当 $\gcd(m,n)=1$ 时由欧拉定理 $c^d=m^{ed}=m\cdot(m^{\varphi(n)})^k\equiv m\pmod n$；$\gcd(m,n)\ne1$ 时用中国剩余定理分别在模 $p$、模 $q$ 下验证也成立。

### 为什么安全
由 $(n,e)$ 求 $d$ 等价于分解 $n$，而分解几百位的整数目前没有已知的高效经典算法（量子计算机上的 Shor 算法可以）。
