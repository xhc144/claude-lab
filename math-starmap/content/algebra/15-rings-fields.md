---
galaxy: algebra
cluster: rings-fields
title: 环、域与伽罗瓦理论
en: Rings, fields and Galois theory
order: 14
level: ext
---

## 域 {#field}
type: 定义 | en: Field | w: 4 | level: core | 考纲: 向量空间
前置: set
后续: vector-space, finite-fields, field-extension
alias: 域, 数域, 有理数域, 有限域

可以做加、减、乘、除（除数非零）的代数系统：加法构成阿贝尔群，非零元在乘法下构成阿贝尔群，乘法对加法分配。$\Q,\R,\C$ 是域；$\Z/p\Z$（$p$ 为素数）是 $p$ 元有限域 $\F_p$；$\Z$ 不是域（$2$ 没有乘法逆元）。

### 注记
线性代数的大部分结论在任意域上都成立。$\Z/n\Z$ 是域 $\iff n$ 为素数：若 $n=ab$，则 $\bar a\bar b=0$，$\bar a$ 不可能有逆。

## 环与理想 {#ring}
type: 定义 | en: Rings and ideals | w: 3 | level: ext
前置: group, field
源于: bezout
后续: polynomial-ring, ufd
alias: 环, 理想, 商环, 整环, 主理想, 交换环

环有加法（阿贝尔群）和满足结合律、分配律的乘法，例如 $\Z$、多项式环、矩阵环。理想是对“乘以任意环元素”封闭的加法子群，它是环的正规子群的类比：商环 $R/I$ 由理想构造。

### 例子
$\Z$ 的理想全是 $n\Z$；$\Z/n\Z=\Z/(n)$。$I$ 是极大理想 $\iff R/I$ 是域；$I$ 是素理想 $\iff R/I$ 是整环。裴蜀定理说明 $\Z$ 的理想 $(a,b)=(\gcd(a,b))$，即 $\Z$ 是主理想整环。

## 多项式环 {#polynomial-ring}
type: 定义 | en: Polynomial ring | w: 3 | level: ext
前置: ring
源于: polynomial-remainder
后续: symmetric-polynomials, field-extension
alias: 多项式环, 带余除法, 不可约多项式, 有理根定理, 艾森斯坦判别法

域 $F$ 上的多项式环 $F[x]$ 有带余除法，因此有辗转相除法、贝祖等式，是主理想整环，多项式可以唯一分解为不可约多项式之积。

> [!定理] 艾森斯坦判别法
> 整系数多项式 $a_nx^n+\cdots+a_0$，若存在素数 $p$ 使 $p\nmid a_n$，$p\mid a_i$（$i<n$），$p^2\nmid a_0$，则它在 $\Q$ 上不可约。

### 例题
$x^p-1=(x-1)\Phi_p(x)$，分圆多项式 $\Phi_p(x)=x^{p-1}+\cdots+1$ 不可约：代入 $x+1$ 后对 $p$ 用艾森斯坦判别法。

## 唯一分解整环 {#ufd}
type: 定义 | en: Unique factorization domain | w: 2 | level: ext
源于: primes
前置: ring
alias: UFD, 主理想整环, 欧几里得整环, 高斯整数

元素都能唯一分解为不可约元之积的整环。欧几里得整环 $\Rightarrow$ 主理想整环 $\Rightarrow$ 唯一分解整环。

### 例题
高斯整数 $\Z[\ii]$ 是欧几里得整环（范数 $a^2+b^2$），所以有唯一分解。在其中 $5=(2+\ii)(2-\ii)$ 不再是素元——由此可证费马平方和定理：奇素数 $p$ 是两个平方数之和 $\iff p\equiv1\pmod4$。而 $\Z[\sqrt{-5}]$ 不是唯一分解整环。

## 对称多项式 {#symmetric-polynomials}
type: 定理 | en: Symmetric polynomials | w: 3 | level: ext
源于: vieta-theorem
前置: polynomial-ring
后续: galois-theory
alias: 对称多项式基本定理, 初等对称多项式, 牛顿恒等式, 判别式

变量任意置换后不变的多项式称为对称多项式。基本定理：每个对称多项式都能唯一地写成初等对称多项式 $e_1=\sum x_i$，$e_2=\sum_{i<j}x_ix_j$，…，$e_n=x_1\cdots x_n$ 的多项式。

### 应用
多项式根的任何对称函数都能用系数表示（韦达定理的推广）；判别式 $\prod_{i<j}(x_i-x_j)^2$ 是对称的，所以是系数的多项式，二次时为 $b^2-4ac$。牛顿恒等式把幂和 $p_k=\sum x_i^k$ 与 $e_k$ 联系起来。

## 域扩张 {#field-extension}
type: 定义 | en: Field extensions | w: 3 | level: ext
前置: field, polynomial-ring, dimension
后续: galois-theory, constructible-numbers
alias: 域扩张, 扩张次数, 代数数, 极小多项式, 超越数

$K\supseteq F$ 时 $K$ 是 $F$ 上的向量空间，其维数 $[K:F]$ 称为扩张次数。次数满足塔律 $[L:F]=[L:K][K:F]$。$\alpha$ 是 $F$ 上的代数元，若它是某个非零 $F$-系数多项式的根；首一的最低次者是极小多项式，且 $[F(\alpha):F]$ 等于它的次数。

### 例题
$[\Q(\sqrt2):\Q]=2$，基为 $1,\sqrt2$；$[\Q(\sqrt[3]2):\Q]=3$（极小多项式 $x^3-2$ 由艾森斯坦判别法不可约）。$\pi$ 与 $\ee$ 不是代数数（林德曼、埃尔米特）。

## 尺规作图 {#constructible-numbers}
type: 定理 | en: Ruler-and-compass constructions | w: 3 | level: ext
源于: field-extension
相关: euclidean-geometry
alias: 尺规作图三大难题, 倍立方, 三等分角, 化圆为方, 正十七边形

尺规能作出的长度构成的域，其中每个数所在的扩张次数都是 $2$ 的幂（每次作图只是解一次或二次方程）。因此：
- **倍立方**不可能：$[\Q(\sqrt[3]2):\Q]=3$；
- **三等分任意角**不可能：$60^\circ$ 的三等分需要 $\cos20^\circ$，它是不可约三次方程 $8x^3-6x-1=0$ 的根；
- **化圆为方**不可能：$\pi$ 是超越数，$\sqrt\pi$ 更不可能。

### 注记
高斯 19 岁时证明正十七边形可以尺规作图（$17$ 是费马素数 $2^{2^2}+1$），并给出正 $n$ 边形可作图的条件：$n=2^kp_1\cdots p_r$，$p_i$ 为互不相同的费马素数。

## 有限域 {#finite-fields}
type: 定理 | en: Finite fields | w: 2 | level: ext
前置: field, field-extension
应用于: rsa
alias: 伽罗瓦域, GF(q), F_q

有限域的元素个数必是素数幂 $q=p^n$；对每个素数幂恰有一个 $q$ 元域（在同构意义下），记 $\F_q$。其乘法群 $\F_q^\times$ 是 $q-1$ 阶循环群。

### 例题
$\F_4=\F_2[x]/(x^2+x+1)=\{0,1,\alpha,\alpha+1\}$，$\alpha^2=\alpha+1$。

### 应用
纠错码（里德–所罗门码、CD 与二维码）、密码学（椭圆曲线、AES 用到 $\F_{2^8}$）、组合设计。

## 伽罗瓦理论 {#galois-theory}
type: 定理 | en: Galois theory | w: 3 | level: ext
前置: field-extension, symmetric-polynomials, group-action
推出: quintic-insolvability
alias: 伽罗瓦对应, 伽罗瓦群, 伽罗瓦基本定理

多项式（或域扩张 $K/F$）的伽罗瓦群是固定 $F$ 的 $K$ 的自同构群，它置换多项式的根。对于伽罗瓦扩张，中间域与伽罗瓦群的子群一一对应（反序），且 $[K:F]=\abs{\mathrm{Gal}(K/F)}$。

### 例题
$x^3-2$ 的分裂域 $\Q(\sqrt[3]2,\omega)$ 次数为 $6$，伽罗瓦群为 $S_3$：它的 $6$ 个子群恰对应 $6$ 个中间域（包括两端）。

### 注记
伽罗瓦在 20 岁决斗前夜整理了这套理论：它把“方程能否用根式求解”这一域论问题，翻译成“伽罗瓦群是否可解”这一群论问题。

## 五次方程无根式解 {#quintic-insolvability}
type: 定理 | en: Abel–Ruffini theorem | w: 3 | level: ext
源于: galois-theory
前置: simple-groups
alias: 阿贝尔-鲁菲尼定理, 五次方程, 根式可解

一般的五次及以上多项式方程没有用系数的加减乘除和开方表示的求根公式。

### 证明思路
方程可用根式求解 $\iff$ 其伽罗瓦群是可解群（有一列子群，每一个在前一个中正规且商是阿贝尔群）。一般 $n$ 次方程的伽罗瓦群是 $S_n$，而 $n\ge5$ 时 $A_n$ 是非阿贝尔单群，$S_n$ 不可解。具体例子：$x^5-6x+3$ 在 $\Q$ 上不可约，恰有三个实根，伽罗瓦群为 $S_5$，所以它的根不能用根式表示。
