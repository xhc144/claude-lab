---
galaxy: algebra
cluster: homomorphisms
title: 同态、同构与商群
en: Homomorphisms and quotient groups
order: 9
level: core
---

## 群同态 {#homomorphism}
type: 定义 | en: Group homomorphism | w: 5 | 考纲: 同态
前置: group, subgroup
后续: isomorphism-group, normal-subgroup, first-isomorphism
类比: linear-map
alias: 同态, 核, 像, 保持运算的映射

映射 $\varphi:G\to H$ 满足 $\varphi(ab)=\varphi(a)\varphi(b)$。由此 $\varphi(e)=e$，$\varphi(a^{-1})=\varphi(a)^{-1}$。核 $\Ker\varphi=\{g:\varphi(g)=e\}$ 是 $G$ 的子群（而且是正规子群），像是 $H$ 的子群；$\varphi$ 单射 $\iff\Ker\varphi=\{e\}$。

### 例子
$\det:\GL_n\to\R^*$；$\exp:(\R,+)\to(\R_{>0},\times)$；$\Z\to\Z/n\Z$，$k\mapsto k\bmod n$；置换的符号 $\sgn:S_n\to\{\pm1\}$。

## 群同构 {#isomorphism-group}
type: 定义 | en: Group isomorphism | w: 4 | 考纲: 同构
前置: homomorphism
后续: cayley-theorem
alias: 同构, 自同构, 内自同构, 群的分类

双射的同态称为同构，$G\cong H$ 表示两个群“结构完全相同”，只是元素的名字不同。

### 例题
$(\R,+)\cong(\R_{>0},\times)$：$\exp$ 就是同构，对数表的原理正在于此。$\Z/6\Z\cong\Z/2\Z\times\Z/3\Z$（中国剩余定理），而 $\Z/4\Z\not\cong\Z/2\Z\times\Z/2\Z$（前者有 $4$ 阶元，后者没有）。

### 注记
判断不同构要找“同构不变量”：阶、交换性、各阶元素的个数、中心的大小、子群结构。$G$ 到自身的同构构成自同构群 $\Aut G$；$g\mapsto aga^{-1}$ 是内自同构。

## 正规子群 {#normal-subgroup}
type: 定义 | en: Normal subgroup | w: 4 | 考纲: 商群, 同态
前置: subgroup, coset
后续: quotient-group
alias: 正规子群, 不变子群, 共轭

若对一切 $g\in G$ 都有 $gNg^{-1}=N$（等价地，左陪集等于右陪集 $gN=Ng$），称 $N$ 是正规子群，记 $N\trianglelefteq G$。

### 例子
阿贝尔群的子群都正规；同态的核都正规；指数为 $2$ 的子群正规（左右陪集都是“$N$ 与其补集”）；$\SL_n\trianglelefteq\GL_n$；$A_n\trianglelefteq S_n$。$S_3$ 中 $\{e,(12)\}$ 不正规：$(13)(12)(13)=(23)$。

### 为什么需要
只有正规子群的陪集才能自然地相乘：$(aN)(bN)=abN$ 良定义 $\iff$ $N$ 正规。

## 商群 {#quotient-group}
type: 定义 | en: Quotient group | w: 5 | 考纲: 商群
前置: normal-subgroup
后续: first-isomorphism
类比: quotient-space
alias: 商群, 因子群, G/N

$N\trianglelefteq G$ 时，陪集集合 $G/N$ 在运算 $(aN)(bN)=(ab)N$ 下构成群，$\abs{G/N}=[G:N]$。自然映射 $G\to G/N$，$g\mapsto gN$ 是满同态，核为 $N$。

### 直观
商群是“把 $N$ 中的元素全都看作单位元”之后得到的群。$\Z/n\Z$ 就是把 $n$ 的倍数看成 $0$；钟表的时间是 $\Z/12\Z$。

### 例题
$D_4/\langle r^2\rangle$ 是 $4$ 阶群，其中每个元素平方都是单位元，所以同构于克莱因四元群 $\Z/2\Z\times\Z/2\Z$。

## 第一同构定理 {#first-isomorphism}
type: 定理 | en: First isomorphism theorem | w: 5 | 考纲: 同构定理
前置: quotient-group, homomorphism
推出: second-third-isomorphism
类比: rank-nullity
alias: 同态基本定理, 第一同构定理

若 $\varphi:G\to H$ 是同态，则
$$G/\Ker\varphi\cong\im\varphi,$$
同构由 $g\Ker\varphi\mapsto\varphi(g)$ 给出。

### 证明
映射 $\bar\varphi(gK)=\varphi(g)$ 良定义且单射：$\varphi(g)=\varphi(g')\iff g^{-1}g'\in K\iff gK=g'K$；保持运算，像为 $\im\varphi$。

### 例题
$\det:\GL_n(\R)\to\R^*$ 是满同态，核为 $\SL_n$，所以 $\GL_n/\SL_n\cong\R^*$。$\R\to S^1$，$t\mapsto\ee^{2\pi\ii t}$ 的核为 $\Z$，所以 $\R/\Z\cong S^1$（圆周）。

### 注记
有限群时得到 $\abs G=\abs{\Ker\varphi}\cdot\abs{\im\varphi}$，与线性代数的 [[rank-nullity]] 形式完全一致。

## 第二、第三同构定理 {#second-third-isomorphism}
type: 定理 | en: Second and third isomorphism theorems | w: 3 | 考纲: 同构定理
源于: first-isomorphism
alias: 第二同构定理, 第三同构定理, 对应定理, 菱形同构定理

- **第二（菱形）**：$H\le G$，$N\trianglelefteq G$，则 $HN\le G$，$H\cap N\trianglelefteq H$，且 $HN/N\cong H/(H\cap N)$。
- **第三**：$N\le M$ 都是 $G$ 的正规子群，则 $(G/N)/(M/N)\cong G/M$。
- **对应定理**：$G/N$ 的子群与包含 $N$ 的 $G$ 的子群一一对应，且保持正规性与指数。

### 证明
都由第一同构定理得到：第二定理考虑 $H\to HN/N$，$h\mapsto hN$，它是满同态，核为 $H\cap N$；第三定理考虑 $G/N\to G/M$，$gN\mapsto gM$，核为 $M/N$。

### 例题
$(\Z/12\Z)/(6\Z/12\Z)\cong\Z/6\Z$——“约分”在群里也成立。

## 凯莱定理 {#cayley-theorem}
type: 定理 | en: Cayley's theorem | w: 3 | 考纲: 对称群, 同构
前置: isomorphism-group, symmetric-group
alias: 凯莱定理, 每个群都是置换群, 左正则作用

每个群都同构于某个对称群的子群；$n$ 阶群可嵌入 $S_n$。

### 证明
$G$ 通过左乘作用在自身上：$g\mapsto\lambda_g$，$\lambda_g(x)=gx$。每个 $\lambda_g$ 是 $G$ 的一个置换，$g\mapsto\lambda_g$ 是单同态（$\lambda_g=\mathrm{id}\Rightarrow ge=e\Rightarrow g=e$）。

### 注记
历史上群首先是作为置换群出现的（拉格朗日、伽罗瓦研究方程根的置换）；凯莱定理说明抽象的群公理没有扩大研究对象的范围，只是去掉了与具体表示无关的东西。

## 直积与有限阿贝尔群 {#direct-product}
type: 定理 | en: Direct products and finite abelian groups | w: 3 | 考纲: 群, 同构
前置: isomorphism-group, cyclic-group
源于: crt
alias: 直积, 有限阿贝尔群结构定理, 克莱因四元群

$G\times H$ 按分量运算构成群。$\Z/m\Z\times\Z/n\Z\cong\Z/mn\Z\iff\gcd(m,n)=1$。

> [!定理] 有限阿贝尔群结构定理
> 每个有限阿贝尔群都同构于素数幂阶循环群的直积 $\Z/p_1^{k_1}\Z\times\cdots\times\Z/p_r^{k_r}\Z$，且这些因子（不计顺序）唯一。

### 例题
$8$ 阶阿贝尔群恰有三个（不计同构）：$\Z/8\Z$、$\Z/4\Z\times\Z/2\Z$、$(\Z/2\Z)^3$，对应 $8=8=4\cdot2=2\cdot2\cdot2$ 的三种分拆。$n$ 阶阿贝尔群的个数只依赖于 $n$ 的素因子指数的分拆数。
