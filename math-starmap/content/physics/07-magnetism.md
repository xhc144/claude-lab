---
galaxy: physics
cluster: magnetism
title: 磁场
en: Magnetic fields
order: 7
level: hs
---

## 磁场与磁感应强度 {#magnetic-field}
type: 物理量 | en: Magnetic field | w: 5 | 考纲: 磁场
前置: electric-field
后续: ampere-force, lorentz-force, magnetic-flux, biot-savart
alias: 磁场, 磁感应强度, 磁感线, 安培定则, 右手螺旋定则, 地磁场

磁场由运动电荷（电流）和磁体产生，用磁感应强度 $\vv B$ 描述（单位特斯拉 T），定义为 $B=\frac F{IL}$（电流垂直于磁场时）。磁感线是闭合曲线，没有起点终点——不存在磁单极子，$\oiint\vv B\cdot\dd\vv S=0$。

### 注记
直线电流的磁场方向由安培定则（右手螺旋定则）判断：右手握住导线，拇指指向电流方向，四指弯曲方向就是磁感线环绕方向。奥斯特（1820）发现电流使小磁针偏转，第一次揭示了电与磁的联系。地磁场约 $5\times10^{-5}$ T，医用核磁共振约 $1.5$–$3$ T。

## 安培力 {#ampere-force}
type: 定律 | en: Ampère force | w: 4 | 考纲: 磁场
前置: magnetic-field, cross-product
后续: motional-emf
alias: 安培力, 左手定则, 电动机, 磁力矩

通电导线在磁场中受力 $\vv F=I\vv L\times\vv B$，大小 $F=BIL\sin\theta$，方向由左手定则判断。

### 应用
电动机：通电线圈在磁场中受力矩 $M=NBIS\sin\theta$ 而转动；电流表（磁电式）；电磁炮。两条平行导线中电流同向相吸、反向相斥——曾用来定义“安培”这一单位。

## 洛伦兹力 {#lorentz-force}
type: 定律 | en: Lorentz force | w: 5 | 考纲: 磁场
前置: magnetic-field, cross-product
后续: charged-particle-magnetic, hall-effect
alias: 洛伦兹力, 运动电荷受力

运动电荷在磁场中受力 $\vv F=q\vv v\times\vv B$，总垂直于速度，所以只改变速度方向、不做功。安培力是导线中大量自由电荷所受洛伦兹力的宏观表现。

### 注记
完整的洛伦兹力公式 $\vv F=q(\vv E+\vv v\times\vv B)$。洛伦兹力是否“存在”依赖于参考系：在随电荷运动的参考系中它变成电场力——这一矛盾是爱因斯坦思考狭义相对论的起点之一。

## 带电粒子在磁场中的运动 {#charged-particle-magnetic}
type: 模型 | en: Charged particles in magnetic fields | w: 5 | 考纲: 磁场
前置: lorentz-force, centripetal-force
后续: cyclotron
alias: 回旋半径, 回旋周期, 匀速圆周运动, 螺旋运动, 磁偏转

垂直射入匀强磁场的粒子做匀速圆周运动：$qvB=m\frac{v^2}r$，
$$r=\frac{mv}{qB},\qquad T=\frac{2\pi m}{qB},$$
周期与速度无关。速度与磁场斜交时做螺旋运动。

### 解题要点
找圆心（速度的垂线交点、弦的中垂线）、求半径（几何关系）、定圆心角（时间 $t=\frac\theta{2\pi}T$）。

### 例题
极光：太阳风中的带电粒子沿地磁场的磁感线螺旋运动到两极上空，与大气分子碰撞发光。

## 质谱仪与回旋加速器 {#cyclotron}
type: 应用 | en: Mass spectrometer and cyclotron | w: 3 | 考纲: 磁场
前置: charged-particle-magnetic, charged-particle-electric
alias: 质谱仪, 回旋加速器, 速度选择器, 同位素

- **速度选择器**：正交的电场与磁场中，只有 $v=\frac EB$ 的粒子直线通过；
- **质谱仪**：经同一电压加速后进入磁场，$r=\frac1B\sqrt{\frac{2mU}q}$，按荷质比分离，发现了同位素；
- **回旋加速器**：利用回旋周期与速度无关，在 D 形盒缝隙处用同频交变电压反复加速，最大动能 $E_k=\frac{q^2B^2R^2}{2m}$，由 D 形盒半径决定、与加速电压无关。

### 注记
速度接近光速时质量效应使回旋频率改变，需要同步加速器。

## 毕奥-萨伐尔定律与安培环路定理 {#biot-savart}
type: 定律 | en: Biot–Savart law and Ampère's circuital law | w: 3 | level: ext
前置: magnetic-field, line-integral
后续: maxwell-equations
用到: stokes-theorem
alias: 毕奥-萨伐尔定律, 安培环路定理, 螺线管的磁场

电流元产生的磁场 $\dd\vv B=\frac{\mu_0}{4\pi}\frac{I\,\dd\vv l\times\hat{\vv r}}{r^2}$。安培环路定理：$\oint\vv B\cdot\dd\vv l=\mu_0I_{\text{内}}$，微分形式 $\nabla\times\vv B=\mu_0\vv J$。

### 例题
长直导线 $B=\frac{\mu_0I}{2\pi r}$；长螺线管内部为匀强磁场 $B=\mu_0nI$（$n$ 为单位长度匝数），外部近似为零。

## 霍尔效应 {#hall-effect}
type: 现象 | en: Hall effect | w: 3 | 考纲: 磁场, 陌生情境中的综合推理
前置: lorentz-force
alias: 霍尔元件, 霍尔电压, 载流子类型

通电导体（或半导体）放在垂直磁场中，载流子受洛伦兹力偏向一侧，在两侧形成电压，直到电场力与洛伦兹力平衡：
$$U_H=\frac{IB}{nqd},$$
$d$ 为沿磁场方向的厚度。霍尔电压的正负可以判断载流子是正是负（P 型或 N 型半导体）。

### 应用
霍尔传感器测磁场、手机里的电子罗盘、汽车转速传感器。量子霍尔效应中霍尔电阻精确地量子化为 $\frac h{e^2}$ 的分数，被用作电阻的计量基准。
