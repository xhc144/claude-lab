---
galaxy: physics
cluster: electrostatics
title: 静电场
en: Electrostatics
order: 5
level: hs
---

## 库仑定律 {#coulomb-law}
type: 定律 | en: Coulomb's law | w: 5 | 考纲: 静电场
后续: electric-field
类比: universal-gravitation
alias: 库仑定律, 点电荷, 静电力常量, 电荷守恒
tags: 电磁学

真空中两个静止点电荷之间的作用力
$$F=k\frac{q_1q_2}{r^2},\qquad k=\frac1{4\pi\eps_0}\approx9.0\times10^9\ \text{N}\cdot\text{m}^2/\text{C}^2,$$
同种电荷相斥、异种相吸。电荷是量子化的（元电荷 $e\approx1.6\times10^{-19}$ C）且守恒。

### 注记
与万有引力形式相同，但强得多：两个质子之间的静电斥力约是引力的 $10^{36}$ 倍。宏观物体几乎都是电中性的，所以天体尺度上引力占主导。

## 电场强度 {#electric-field}
type: 物理量 | en: Electric field | w: 5 | 考纲: 静电场
前置: coulomb-law, plane-vector
后续: electric-potential, gauss-law, charged-particle-electric
anim: electric-field
alias: 电场, 场强, 电场线, 叠加原理, 匀强电场

电场是电荷周围的物质存在形式，场强 $\vv E=\frac{\vv F}q$ 与试探电荷无关。点电荷的场 $E=\frac{kQ}{r^2}$，多个电荷的场按矢量叠加。电场线从正电荷出发、终止于负电荷，疏密表示强弱，切线方向表示场强方向，不相交、不闭合。

### 例题
等量异种电荷（电偶极子）连线中垂线上，从中点向外场强逐渐减小，方向都平行于连线；等量同种电荷中点处场强为零。

## 电势与电势差 {#electric-potential}
type: 物理量 | en: Electric potential | w: 5 | 考纲: 静电场
前置: electric-field, potential-energy
源于: path-independence
后续: capacitor
alias: 电势, 电势差, 电压, 等势面, 电势能, 电场力做功

静电力是保守力，可以定义电势能与电势：$\varphi=\frac{E_p}q$；电势差 $U_{AB}=\varphi_A-\varphi_B=\frac{W_{AB}}q$。场强与电势的关系 $\vv E=-\nabla\varphi$，匀强电场中 $U=Ed$。点电荷的电势 $\varphi=\frac{kQ}r$。

### 性质
沿电场线方向电势降低；等势面与电场线垂直；在等势面上移动电荷，电场力不做功。电场强度为零的地方电势不一定为零（反之亦然）——二者是导数与函数的关系。

## 高斯定理 {#gauss-law}
type: 定律 | en: Gauss's law | w: 3 | 考纲: 静电场
前置: electric-field
源于: gauss-divergence
后续: maxwell-equations
alias: 电通量, 高斯定律, 高斯面

通过任意闭合曲面的电通量等于面内总电荷除以 $\eps_0$：
$$\oiint_S\vv E\cdot\dd\vv S=\frac{Q_{\text{内}}}{\eps_0}.$$
微分形式 $\nabla\cdot\vv E=\frac\rho{\eps_0}$。

### 例题
- 无限大均匀带电平面：$E=\frac\sigma{2\eps_0}$，与距离无关；
- 均匀带电球壳：外部如点电荷，内部场强为零；
- 无限长均匀带电直线：$E=\frac\lambda{2\pi\eps_0r}$。

### 注记
高斯定理与库仑定律的平方反比等价——它们都来自“电场线在空间中不中断、通量守恒”。对称性足够高时，用高斯定理求场强远比积分简单。

## 电容器 {#capacitor}
type: 物理量 | en: Capacitors | w: 4 | 考纲: 静电场
前置: electric-potential
后续: rc-circuit, lc-oscillation
alias: 电容, 平行板电容器, 电介质, 电场能量

电容 $C=\frac QU$。平行板电容器 $C=\frac{\eps_r\eps_0S}d$。储存的能量 $W=\frac12CU^2=\frac{Q^2}{2C}$，能量储存在电场中，能量密度 $\frac12\eps_0E^2$。

### 例题
电容器与电源断开后（$Q$ 不变）拉开极板：$C$ 减小，$U=\frac QC$ 增大，$E=\frac U d=\frac Q{\eps_0S}$ 不变，储能增大——增加的能量来自拉板做的功。若保持与电源相连（$U$ 不变），拉开后 $Q$ 减小、$E$ 减小。

## 带电粒子在电场中的运动 {#charged-particle-electric}
type: 模型 | en: Charged particles in electric fields | w: 4 | 考纲: 静电场, 受力分析
前置: electric-field, projectile-motion
alias: 加速电场, 偏转电场, 类平抛运动, 示波管

在匀强电场中，带电粒子受恒力 $qE$：沿场方向加速 $qU=\frac12mv^2-\frac12mv_0^2$；垂直射入时做类平抛运动，偏转距离
$$y=\frac{qUL^2}{2mdv_0^2}.$$

### 例题
先经电压 $U_1$ 加速、再进入电压 $U_2$、板长 $L$、板距 $d$ 的偏转电场：$y=\frac{U_2L^2}{4U_1d}$，与粒子的电荷量和质量无关——质子与 α 粒子的偏转轨迹相同。示波管就利用偏转距离与电压成正比来显示波形。

## 静电平衡与导体 {#electrostatic-equilibrium}
type: 性质 | en: Conductors in electrostatic equilibrium | w: 3 | 考纲: 静电场
前置: electric-potential, gauss-law
alias: 静电平衡, 静电屏蔽, 尖端放电, 法拉第笼

导体处于静电平衡时：内部场强为零；导体是等势体，表面是等势面；净电荷只分布在外表面，曲率大（尖端）处电荷密度大。

### 应用
静电屏蔽：空腔导体内部不受外部电场影响（法拉第笼，汽车与飞机被雷击时乘客安全）。尖端放电：避雷针。
