---
galaxy: physics
cluster: circuits
title: 恒定电流
en: Direct current
order: 6
level: hs
---

## 电流与欧姆定律 {#ohm-law}
type: 定律 | en: Current and Ohm's law | w: 5 | 考纲: 恒定电流
前置: electric-potential
后续: series-parallel, emf, electric-power
alias: 电流, 电阻, 欧姆定律, 电阻率, 伏安特性

电流 $I=\frac{\dd q}{\dd t}$，微观表达 $I=nqvS$（$v$ 为自由电子的定向漂移速度，约 $10^{-4}$ m/s 量级）。欧姆定律 $I=\frac UR$，电阻 $R=\rho\frac LS$，$\rho$ 为电阻率，金属的电阻率随温度升高而增大。

### 注记
漂移速度极慢，开灯却瞬间亮起：电场以接近光速在导线中建立，全导线中的电子几乎同时开始移动。欧姆定律适用于金属和电解液，不适用于气体导电与半导体元件（伏安特性非线性）。

## 串联与并联 {#series-parallel}
type: 公式 | en: Series and parallel circuits | w: 4 | 考纲: 恒定电流
前置: ohm-law
后续: kirchhoff
alias: 串联, 并联, 等效电阻, 分压, 分流, 电表改装

串联：电流相同，$R=R_1+R_2+\cdots$，电压按电阻分配；并联：电压相同，$\frac1R=\frac1{R_1}+\frac1{R_2}+\cdots$，电流按电阻反比分配。

### 例题
电表改装：内阻 $R_g$、满偏电流 $I_g$ 的表头，串联大电阻 $R=\frac U{I_g}-R_g$ 改装成量程 $U$ 的电压表；并联小电阻 $R=\frac{I_gR_g}{I-I_g}$ 改装成量程 $I$ 的电流表。

## 电动势与闭合电路欧姆定律 {#emf}
type: 定律 | en: EMF and closed-circuit Ohm's law | w: 5 | 考纲: 恒定电流
前置: ohm-law, energy-conservation
后续: kirchhoff, motional-emf
alias: 电动势, 内阻, 路端电压, 闭合电路欧姆定律, 电源

电动势 $\mathcal E$ 是电源把其他形式的能转化为电能的本领（非静电力移送单位电荷做的功）。闭合电路中
$$I=\frac{\mathcal E}{R+r},\qquad U_{\text{路端}}=\mathcal E-Ir.$$

### 例题
外电阻为何值时电源输出功率最大？$P=I^2R=\frac{\mathcal E^2R}{(R+r)^2}$，由 $\frac{R}{(R+r)^2}=\frac1{R+2r+\frac{r^2}R}$ 与均值不等式，$R=r$ 时最大，$P_{\max}=\frac{\mathcal E^2}{4r}$，此时效率只有 $50\%$（阻抗匹配）。

## 电功率与焦耳定律 {#electric-power}
type: 定律 | en: Electric power and Joule heating | w: 4 | 考纲: 恒定电流, 能量转化
前置: ohm-law
alias: 电功, 电功率, 焦耳定律, 电热, 纯电阻, 非纯电阻

电功 $W=UIt$，电功率 $P=UI$；电热 $Q=I^2Rt$。纯电阻电路中二者相等；含电动机等非纯电阻时 $UI>I^2R$，多出的部分转化为机械能。

### 应用
远距离输电：输送功率 $P$ 一定时，线路损耗 $I^2R_{\text{线}}=\frac{P^2R_{\text{线}}}{U^2}$，电压提高 $10$ 倍损耗降为 $\frac1{100}$——所以要用变压器升压输电（[[transformer]]）。

## 基尔霍夫定律 {#kirchhoff}
type: 定律 | en: Kirchhoff's laws | w: 3 | 考纲: 恒定电流
前置: series-parallel, emf
用到: linear-system
alias: 节点电流定律, 回路电压定律, 惠斯通电桥, 复杂电路

- 节点电流定律：流入任一节点的电流之和等于流出的电流之和（电荷守恒）；
- 回路电压定律：沿任一闭合回路，电势降落的代数和为零（静电场是保守场）。

由此可以列出线性方程组求解任意复杂的电路。

### 例题
惠斯通电桥平衡条件 $\frac{R_1}{R_2}=\frac{R_3}{R_4}$：此时桥上检流计无电流，可以精确测量未知电阻。

## RC 电路 {#rc-circuit}
type: 模型 | en: RC circuits | w: 3 | 考纲: 恒定电流, 物理建模
前置: capacitor, emf
源于: linear-first-order-ode
alias: 电容充放电, 时间常数, RC 电路

电容器通过电阻放电：$RC\frac{\dd q}{\dd t}+q=0$，$q=Q_0\ee^{-t/RC}$；充电时 $q=C\mathcal E\left(1-\ee^{-t/RC}\right)$。时间常数 $\tau=RC$：经过 $\tau$ 后放电剩余 $\frac1\ee\approx37\%$，经过 $5\tau$ 基本完成。

### 应用
照相机闪光灯、心脏起搏器的定时、滤波电路（低通、高通）。它是一阶线性微分方程在物理中最典型的例子。
