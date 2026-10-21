---
galaxy: algebra
cluster: group-actions
title: 群作用与计数
en: Group actions and counting
order: 10
level: core
---

## 群作用 {#group-action}
type: 定义 | en: Group action | w: 5 | 考纲: 群作用
前置: group, homomorphism
后续: orbit-stabilizer, conjugacy-classes, burnside-lemma
alias: 群作用, 轨道, 稳定子, 作用在集合上

群 $G$ 作用在集合 $X$ 上：每个 $g$ 给出 $X$ 的一个变换 $x\mapsto g\cdot x$，满足 $e\cdot x=x$，$(gh)\cdot x=g\cdot(h\cdot x)$。等价地，作用是同态 $G\to\mathrm{Sym}(X)$。

- 轨道 $G\cdot x=\{g\cdot x\}$：$x$ 能被移到的所有位置；轨道把 $X$ 分割开。
- 稳定子 $G_x=\{g:g\cdot x=x\}$：保持 $x$ 不动的元素，是子群。

### 例子
旋转群作用在球面上（轨道是纬线圈或两极）；$\GL_n$ 通过 $P^{-1}AP$ 作用在矩阵上（轨道就是相似类）；$G$ 通过共轭作用在自身上（轨道是共轭类）；$S_n$ 作用在 $\{1,\dots,n\}$ 上。

### 注记
“群是通过作用被认识的”：对称群作用在图形上、伽罗瓦群作用在方程的根上、李群作用在微分方程的解上。

## 轨道-稳定子定理 {#orbit-stabilizer}
type: 定理 | en: Orbit–stabilizer theorem | w: 5 | 考纲: 群作用, 计数公式
前置: group-action, lagrange-group-theorem
推出: class-equation, burnside-lemma
alias: 轨道公式, 计数公式, |G·x|·|G_x|=|G|

$$\abs{G\cdot x}=[G:G_x]=\frac{\abs G}{\abs{G_x}}.$$

### 证明
映射 $gG_x\mapsto g\cdot x$ 是从左陪集集合到轨道的双射：$g\cdot x=h\cdot x\iff h^{-1}g\in G_x\iff gG_x=hG_x$。

### 例题
**正方体的旋转群有多少个元素？** 它在 $6$ 个面上传递作用（轨道大小 $6$），保持某个面的旋转只有绕该面中心轴的 $4$ 个，所以 $\abs G=6\times4=24$。同理正十二面体的旋转群阶为 $12\times5=60$。

## 共轭类 {#conjugacy-classes}
type: 定义 | en: Conjugacy classes | w: 3 | 考纲: 群作用
前置: group-action
后续: class-equation, character
alias: 共轭, 共轭类, 中心, 中心化子

$g$ 与 $hgh^{-1}$ 称为共轭。共轭类是共轭作用的轨道，类的大小为 $[G:C_G(g)]$，$C_G(g)$ 是中心化子。中心 $Z(G)$ 由只与自己共轭的元素组成。

### 例题
在 $S_n$ 中，两个置换共轭 $\iff$ 轮换型相同（各长度的轮换个数一样）。$S_4$ 的共轭类对应 $4$ 的分拆：$1+1+1+1$（$1$ 个）、$2+1+1$（$6$）、$2+2$（$3$）、$3+1$（$8$）、$4$（$6$），共 $24$。
在 $\GL_n(\C)$ 中，共轭类就是相似类，由若尔当标准形分类。

## 类方程 {#class-equation}
type: 定理 | en: Class equation | w: 4 | 考纲: 群作用, 计数公式
源于: orbit-stabilizer
前置: conjugacy-classes
推出: p-group-center
alias: 类方程, 类等式

$$\abs G=\abs{Z(G)}+\sum_i[G:C_G(g_i)],$$
求和取遍元素个数大于 $1$ 的共轭类的代表元。

### 推论
**$p$ 群的中心非平凡**：若 $\abs G=p^n$（$n\ge1$），右边求和的每一项都是 $p$ 的正幂（整除 $p^n$ 且大于 $1$），所以 $p\mid\abs{Z(G)}$，$Z(G)\ne\{e\}$。由此 $p^2$ 阶群都是阿贝尔群。

## p 群的结构 {#p-group-center}
type: 定理 | en: Structure of p-groups | w: 3 | 考纲: 计数公式, 西罗定理
源于: class-equation
后续: sylow-theorems
alias: p 群, p^2 阶群是阿贝尔群

阶为素数幂 $p^n$ 的群称为 $p$ 群。$p$ 群的中心非平凡；$p^2$ 阶群同构于 $\Z/p^2\Z$ 或 $\Z/p\Z\times\Z/p\Z$；$p^n$ 阶群对每个 $k\le n$ 都有 $p^k$ 阶（正规）子群。

### 证明（$p^2$ 阶群交换）
若 $Z(G)\ne G$，则 $\abs{Z(G)}=p$，$G/Z(G)$ 为 $p$ 阶群，是循环群。但 $G/Z(G)$ 循环 $\Rightarrow G$ 交换（设 $G/Z=\langle aZ\rangle$，则任意元素为 $a^iz$，两两可交换），矛盾。

## 伯恩赛德引理 {#burnside-lemma}
type: 定理 | en: Burnside's lemma | w: 5 | 考纲: 计数公式, 群作用
源于: orbit-stabilizer
前置: group-action
应用于: necklace-counting
alias: 伯恩赛德引理, 轨道计数公式, Cauchy–Frobenius, 不动点平均, 波利亚计数

轨道的个数等于每个群元素不动点个数的平均值：
$$\abs{X/G}=\frac1{\abs G}\sum_{g\in G}\abs{X^g},\qquad X^g=\{x:g\cdot x=x\}.$$

### 证明
双计数 $\{(g,x):g\cdot x=x\}$：按 $g$ 数得 $\sum_g\abs{X^g}$；按 $x$ 数得 $\sum_x\abs{G_x}=\sum_x\frac{\abs G}{\abs{G\cdot x}}$，同一轨道内各点贡献之和为 $\abs G$，所以总和为 $\abs G\cdot(\text{轨道数})$。

### 应用
“在对称意义下本质不同的”染色方案计数，见 [[necklace-counting]]。波利亚计数定理进一步给出按颜色分布的生成函数。

## 项链计数 {#necklace-counting}
type: 例题 | en: Counting necklaces | w: 3 | 考纲: 计数公式, 分类计数
前置: burnside-lemma, cyclic-group
alias: 项链问题, 手镯问题, 染色计数, 正方体染色

用 $k$ 种颜色给 $n$ 颗珠子的项链（只允许旋转）染色，本质不同的方案数为
$$\frac1n\sum_{d\mid n}\varphi(d)\,k^{n/d}.$$

### 推导
旋转 $r^j$ 把珠子分成 $\gcd(j,n)$ 个轮换，固定的染色数为 $k^{\gcd(j,n)}$。$\gcd(j,n)=\frac nd$ 的 $j$ 恰有 $\varphi(d)$ 个，代入伯恩赛德引理。

### 例题
用红蓝两色给正方体的六个面染色（旋转视为相同）：旋转群 $24$ 个元素按类型统计不动点——恒等 $2^6$；绕面轴转 $\pm90^\circ$（$6$ 个）各 $2^3$；绕面轴转 $180^\circ$（$3$ 个）各 $2^4$；绕顶点轴转 $\pm120^\circ$（$8$ 个）各 $2^2$；绕棱中点轴转 $180^\circ$（$6$ 个）各 $2^3$。
$$\frac{64+48+48+32+48}{24}=10.$$
