---
galaxy: physics
cluster: induction
title: 电磁感应与电磁波
en: Electromagnetic induction and waves
order: 8
level: hs
---

## 磁通量 {#magnetic-flux}
type: 物理量 | en: Magnetic flux | w: 4 | 考纲: 电磁感应
前置: magnetic-field
后续: faraday-law
用到: surface-integral
alias: 磁通量, 韦伯, 磁通变化

$\Phi=\iint\vv B\cdot\dd\vv S$；匀强磁场中平面 $\Phi=BS\cos\theta$，$\theta$ 为磁场与平面法线的夹角。单位韦伯（Wb）。

## 法拉第电磁感应定律 {#faraday-law}
type: 定律 | en: Faraday's law of induction | w: 5 | 考纲: 电磁感应
前置: magnetic-flux, emf
源于: stokes-theorem
后续: lenz-law, motional-emf, self-induction, alternating-current, maxwell-equations
alias: 电磁感应, 感应电动势, 法拉第定律, 涡旋电场
tags: 电磁学

闭合回路中的感应电动势等于穿过回路的磁通量的变化率：
$$\mathcal E=-N\frac{\dd\Phi}{\dd t}.$$
变化的磁场在周围空间激发涡旋电场：$\oint\vv E\cdot\dd\vv l=-\frac{\dd}{\dd t}\iint\vv B\cdot\dd\vv S$，微分形式 $\nabla\times\vv E=-\frac{\partial\vv B}{\partial t}$。

### 注记
法拉第（1831）经过近十年的寻找才发现：恒定磁场不产生电流，只有变化的磁场才行。这一发现是发电机、变压器乃至整个电力工业的基础。

## 楞次定律 {#lenz-law}
type: 定律 | en: Lenz's law | w: 4 | 考纲: 电磁感应
前置: faraday-law
后续: self-induction
alias: 楞次定律, 来拒去留, 增反减同, 电磁阻尼

感应电流的磁场总是阻碍引起感应电流的磁通量的变化（法拉第定律中的负号）。推论：“增反减同、来拒去留、增缩减扩”。

### 本质
它是能量守恒的要求：如果感应电流加强原磁通的变化，就会自我放大、凭空产生能量。

### 例题
磁铁从铜管中下落比在塑料管中慢得多：铜管中的涡流产生阻碍相对运动的磁场。电磁炉、电磁阻尼、高铁的涡流制动都利用这一原理。

## 动生电动势 {#motional-emf}
type: 公式 | en: Motional EMF | w: 4 | 考纲: 电磁感应
前置: faraday-law, ampere-force, lorentz-force
alias: 动生电动势, 导体切割磁感线, E=BLv, 电磁感应中的力学问题

导体棒在磁场中切割磁感线运动：$\mathcal E=BLv$（$B,L,v$ 两两垂直）。微观上是导体内自由电荷随棒运动时受到的洛伦兹力提供非静电力。

### 例题
光滑导轨上质量 $m$、长 $L$ 的导体棒以初速度 $v_0$ 运动，回路总电阻 $R$：安培力 $F=\frac{B^2L^2v}R$ 阻碍运动，$m\frac{\dd v}{\dd t}=-\frac{B^2L^2v}R$，速度指数衰减 $v=v_0\ee^{-\frac{B^2L^2}{mR}t}$，滑行总距离 $\frac{mv_0R}{B^2L^2}$，动能全部转化为焦耳热。

## 自感与互感 {#self-induction}
type: 现象 | en: Self-induction and mutual induction | w: 3 | 考纲: 电磁感应
前置: faraday-law, lenz-law
后续: lc-oscillation, transformer
alias: 自感, 互感, 自感系数, 电感, 断电自感, 磁场能

线圈中电流变化时，自身磁通变化产生的感应电动势 $\mathcal E=-L\frac{\dd I}{\dd t}$，$L$ 为自感系数（单位亨利）。电感储存的磁场能 $\frac12LI^2$。

### 例题
断电自感：与线圈并联的灯泡在开关断开的瞬间会闪亮一下再熄灭（若线圈的直流电阻小于灯泡电阻）——线圈中的电流不能突变，断开后它经过灯泡继续流动。

## 交变电流 {#alternating-current}
type: 概念 | en: Alternating current | w: 4 | 考纲: 电磁感应
前置: faraday-law, sinusoid
用到: euler-formula
后续: transformer
alias: 交流电, 正弦交流电, 有效值, 峰值, 发电机, 感抗, 容抗

线圈在匀强磁场中匀速转动产生正弦交流电 $e=E_m\sin\omega t$，$E_m=NBS\omega$。有效值（与等效直流的热效应相同）$E=\frac{E_m}{\sqrt2}$。我国电网 $220$ V、$50$ Hz，峰值约 $311$ V。

### 注记
电感与电容对交流电的阻碍：感抗 $X_L=\omega L$，容抗 $X_C=\frac1{\omega C}$。用复数（相量）表示，$Z_L=\ii\omega L$，$Z_C=\frac1{\ii\omega C}$，交流电路就能像直流电路一样用欧姆定律计算——这是 [[euler-formula]] 在工程中的经典应用。

## 变压器 {#transformer}
type: 应用 | en: Transformer | w: 4 | 考纲: 电磁感应
前置: alternating-current, self-induction
alias: 理想变压器, 变压比, 远距离输电

理想变压器利用互感：$\frac{U_1}{U_2}=\frac{n_1}{n_2}$，$\frac{I_1}{I_2}=\frac{n_2}{n_1}$（只有一个副线圈时），输入功率等于输出功率。

### 注记
变压器只能改变交流电压，不能改变直流——这是交流电在“电流之战”（特斯拉、威斯汀豪斯对爱迪生）中胜出的关键原因：高压输电大大减少损耗（[[electric-power]]）。

## LC 振荡 {#lc-oscillation}
type: 模型 | en: LC oscillation | w: 3 | 考纲: 电磁波, 简谐振动
前置: capacitor, self-induction
用到: linear-ode-constant
后续: electromagnetic-waves
alias: 电磁振荡, LC 电路, 振荡频率

电容器通过电感放电，电场能与磁场能周期性相互转化：$L\frac{\dd^2q}{\dd t^2}+\frac qC=0$，周期
$$T=2\pi\sqrt{LC}.$$

### 类比
与弹簧振子 $m\ddot x+kx=0$ 完全对应：$L\leftrightarrow m$（惯性），$\frac1C\leftrightarrow k$（恢复），$q\leftrightarrow x$，电流 $\leftrightarrow$ 速度。收音机调谐就是改变 $C$ 使电路的固有频率与电台频率相同（电谐振）。

## 麦克斯韦方程组 {#maxwell-equations}
type: 定律 | en: Maxwell's equations | w: 5 | level: ext | 考纲: 电磁波
前置: gauss-law, faraday-law, biot-savart, divergence-curl
推出: electromagnetic-waves
alias: 麦克斯韦方程组, 位移电流, 电磁场理论

$$\nabla\cdot\vv E=\frac\rho{\eps_0},\quad\nabla\cdot\vv B=0,\quad\nabla\times\vv E=-\frac{\partial\vv B}{\partial t},\quad\nabla\times\vv B=\mu_0\vv J+\mu_0\eps_0\frac{\partial\vv E}{\partial t}.$$
四个方程概括了全部经典电磁现象。

### 位移电流
麦克斯韦发现安培定律 $\nabla\times\vv B=\mu_0\vv J$ 与电荷守恒矛盾（对两边取散度，左边恒为零，右边在电容器充电时不为零），于是补上“位移电流” $\eps_0\frac{\partial\vv E}{\partial t}$：变化的电场也激发磁场。

### 注记
费曼说：从人类历史的长远观点看，19 世纪最重要的事件无疑是麦克斯韦发现了电动力学定律。

## 电磁波 {#electromagnetic-waves}
type: 现象 | en: Electromagnetic waves | w: 5 | 考纲: 电磁波
源于: maxwell-equations
前置: lc-oscillation, wave-equation
后续: double-slit, photon
alias: 电磁波, 光速, 电磁波谱, 赫兹实验

由麦克斯韦方程组可推出 $\vv E$、$\vv B$ 都满足波动方程，波速
$$c=\frac1{\sqrt{\mu_0\eps_0}}\approx3.0\times10^8\ \text{m/s},$$
恰好等于光速——光是电磁波。电磁波是横波，$\vv E\perp\vv B\perp$ 传播方向，在真空中传播不需要介质。赫兹（1887）用实验证实了电磁波的存在。

### 电磁波谱
按波长从长到短：无线电波、微波、红外线、可见光（约 $400$–$760$ nm）、紫外线、X 射线、γ 射线，本质相同，只是频率不同；$c=\lambda f$。

### 应用
广播、雷达、手机通信、微波炉、遥感、医学成像。
