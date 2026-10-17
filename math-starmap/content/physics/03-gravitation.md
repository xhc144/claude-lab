---
galaxy: physics
cluster: gravitation
title: 万有引力
en: Gravitation
order: 3
level: hs
---

## 万有引力定律 {#universal-gravitation}
type: 定律 | en: Newton's law of universal gravitation | w: 5 | 考纲: 万有引力
前置: centripetal-force
源于: kepler-laws
后续: satellite-orbits, gravitational-potential-energy, shell-theorem
类比: coulomb-law
alias: 万有引力, 引力常量, 平方反比定律
tags: 引力

任意两个质点相互吸引，引力大小与质量乘积成正比、与距离平方成反比：
$$F=G\frac{Mm}{r^2},\qquad G\approx6.67\times10^{-11}\ \text{N}\cdot\text{m}^2/\text{kg}^2.$$

### 推导思路
牛顿把月球的向心加速度与地面重力加速度比较：月地距离约为地球半径的 $60$ 倍，月球的向心加速度 $\frac{4\pi^2r}{T^2}\approx2.7\times10^{-3}$ m/s² 约为 $\frac g{3600}$——正好是平方反比。由开普勒第三定律 $\frac{r^3}{T^2}=$ 常数，圆轨道的向心力 $\frac{4\pi^2mr}{T^2}\propto\frac m{r^2}$，同样得出平方反比。

### 应用
地面附近 $mg=\frac{GMm}{R^2}$，所以 $GM=gR^2$（黄金代换）；“称量地球”：$M=\frac{gR^2}G\approx6\times10^{24}$ kg。

## 开普勒定律 {#kepler-laws}
type: 定律 | en: Kepler's laws | w: 4 | 考纲: 万有引力
前置: ellipse, angular-momentum
推出: universal-gravitation
alias: 开普勒三定律, 椭圆轨道, 面积定律, 周期定律

1. 行星沿椭圆轨道运动，太阳在一个焦点上；
2. 行星与太阳的连线在相等时间内扫过相等的面积；
3. 轨道半长轴的立方与周期的平方之比对所有行星相同：$\frac{a^3}{T^2}=\frac{GM}{4\pi^2}$。

### 注记
开普勒从第谷二十年的观测数据中归纳出这些规律（1609、1619），牛顿则从万有引力定律把它们推导出来（《原理》，1687）：第二定律是角动量守恒，第一定律来自平方反比力下轨道方程的解是圆锥曲线 $r=\frac p{1+e\cos\theta}$，第三定律由面积速度与椭圆面积 $\pi ab$ 得出。

## 卫星与宇宙速度 {#satellite-orbits}
type: 模型 | en: Satellites and cosmic velocities | w: 4 | 考纲: 万有引力
前置: universal-gravitation, gravitational-potential-energy
alias: 第一宇宙速度, 第二宇宙速度, 第三宇宙速度, 同步卫星, 变轨

圆轨道卫星 $\frac{GMm}{r^2}=m\frac{v^2}r$：$v=\sqrt{\frac{GM}r}$，轨道越高速度越小、周期越长。
- 第一宇宙速度（近地环绕）$v_1=\sqrt{gR}\approx7.9$ km/s；
- 第二宇宙速度（逃离地球）$v_2=\sqrt2v_1\approx11.2$ km/s；
- 第三宇宙速度（逃离太阳系）约 $16.7$ km/s。

### 例题
地球同步卫星：周期 $24$ h，轨道半径 $r=\sqrt[3]{\frac{GMT^2}{4\pi^2}}\approx4.2\times10^4$ km（约 $6.6$ 个地球半径），只能位于赤道上空。
变轨：在近地点加速进入椭圆轨道，到远地点再加速进入高圆轨道（霍曼转移）。

## 引力势能 {#gravitational-potential-energy}
type: 公式 | en: Gravitational potential energy | w: 3 | 考纲: 万有引力, 能量
前置: universal-gravitation, potential-energy
后续: satellite-orbits
alias: 引力势能, 逃逸速度, 黑洞

取无穷远处为零，$E_p=-\frac{GMm}r$（由 $\int_r^\infty\frac{GMm}{r^2}\dd r$ 得到）。圆轨道上的总机械能 $E=-\frac{GMm}{2r}$，动能 $=-\frac12$ 势能（位力定理）。

### 例题
逃逸速度：$\frac12mv^2-\frac{GMm}R\ge0$，$v\ge\sqrt{\frac{2GM}R}=\sqrt2v_1$。若天体的逃逸速度超过光速，即 $R<\frac{2GM}{c^2}$（施瓦西半径；地球约 $9$ mm），光也无法逃出——黑洞的朴素图像（米歇尔，1783）。

### 注记
卫星受到稀薄大气阻力后，机械能减小，轨道降低，速度反而变大——“阻力使卫星加速”的悖论由 $E=-\frac{GMm}{2r}$ 解释。

## 双星系统 {#binary-star}
type: 模型 | en: Binary stars | w: 2 | 考纲: 万有引力
前置: universal-gravitation, center-of-mass
alias: 双星, 约化质量, 三体问题

两颗星绕共同质心做圆周运动，角速度相同，轨道半径与质量成反比：$m_1r_1=m_2r_2$。周期满足 $T^2=\frac{4\pi^2L^3}{G(m_1+m_2)}$，$L$ 为两星距离。

### 注记
由周期和距离可以测出双星的总质量——这是测量恒星质量的主要方法。三个天体的一般运动没有封闭解（三体问题），可能是混沌的。

## 球壳定理 {#shell-theorem}
type: 定理 | en: Shell theorem | w: 3 | 考纲: 万有引力, 陌生情境中的综合推理
前置: universal-gravitation
用到: gauss-divergence
alias: 牛顿球壳定理, 均匀球体的引力

均匀球壳对壳外质点的引力，等于把全部质量集中在球心时的引力；对壳内任一点，引力为零。因此均匀球体内部距球心 $r$ 处的引力与 $r$ 成正比：$g(r)=g\frac rR$。

### 推导
用引力的高斯定理：以球心为中心作半径 $r$ 的球面，$\oiint\vv g\cdot\dd\vv S=-4\pi GM_{\text{内}}$，由对称性 $g\cdot4\pi r^2=4\pi GM_{\text{内}}$。牛顿当年用几何方法证明，花了很长时间。

### 例题
沿穿过地心的隧道下落的物体做简谐振动，周期 $2\pi\sqrt{\frac Rg}\approx84$ 分钟，恰好等于近地卫星的周期；即使隧道不过地心（任一弦），周期也相同。
