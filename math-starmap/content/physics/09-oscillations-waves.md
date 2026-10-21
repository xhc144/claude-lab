---
galaxy: physics
cluster: oscillations-waves
title: 振动与波
en: Oscillations and waves
order: 9
level: hs
---

## 简谐振动 {#simple-harmonic-motion}
type: 模型 | en: Simple harmonic motion | w: 5 | 考纲: 简谐振动
前置: hooke-law, sinusoid
用到: linear-ode-constant
后续: pendulum, damped-forced-oscillation, mechanical-wave
anim: shm
alias: 简谐运动, 弹簧振子, 回复力, 振幅, 周期, 相位
tags: 振动

回复力与位移成正比、方向相反 $F=-kx$ 的振动：
$$m\ddot x=-kx\quad\Longrightarrow\quad x=A\cos(\omega t+\varphi),\qquad\omega=\sqrt{\frac km},\quad T=2\pi\sqrt{\frac mk}.$$
周期只由系统本身决定，与振幅无关（等时性）。

### 能量
$E=\frac12kA^2=\frac12mv^2+\frac12kx^2$ 守恒；动能与势能各以 $\frac T2$ 为周期相互转化。

### 直观
简谐振动是匀速圆周运动在直径上的投影——参考圆。在相平面 $(x,v/\omega)$ 中轨迹是圆。

### 注记
几乎一切稳定平衡附近的微小振动都是简谐振动，因为势能在极小点附近 $U(x)\approx U(x_0)+\frac12U''(x_0)(x-x_0)^2$。

## 单摆 {#pendulum}
type: 模型 | en: Simple pendulum | w: 4 | 考纲: 简谐振动, 实验设计
前置: simple-harmonic-motion
后续: measure-g
anim: shm
alias: 单摆, 摆长, 小角度近似, 等时性, 傅科摆

摆长 $L$ 的单摆，切向方程 $mL\ddot\theta=-mg\sin\theta$。小角度时 $\sin\theta\approx\theta$，简谐振动周期
$$T=2\pi\sqrt{\frac Lg}.$$

### 注记
- 伽利略观察教堂吊灯发现摆的等时性；惠更斯据此发明摆钟。
- 大角度时周期变长：$T\approx2\pi\sqrt{\frac Lg}\left(1+\frac{\theta_0^2}{16}\right)$；精确的等时曲线是摆线（[[evolute]]）。
- 单摆是测量重力加速度的经典实验，见 [[measure-g]]。

## 阻尼振动与受迫振动 {#damped-forced-oscillation}
type: 模型 | en: Damped and driven oscillations | w: 4 | 考纲: 简谐振动
前置: simple-harmonic-motion
用到: linear-ode-constant
alias: 阻尼振动, 受迫振动, 共振, 共振曲线, 品质因数

有阻尼与周期性驱动力时 $m\ddot x+b\dot x+kx=F_0\cos\omega t$。稳态时物体以驱动频率 $\omega$ 振动，振幅
$$A=\frac{F_0/m}{\sqrt{(\omega_0^2-\omega^2)^2+(b\omega/m)^2}},$$
驱动频率接近固有频率 $\omega_0$ 时振幅最大——共振。

### 应用与危害
乐器的共鸣箱、收音机调谐、核磁共振利用共振；1940 年塔科马海峡大桥因风致振动坍塌（实际机理是气动弹性颤振），部队过桥要便步走，机器底座要防止共振。

## 机械波 {#mechanical-wave}
type: 现象 | en: Mechanical waves | w: 5 | 考纲: 机械波
前置: simple-harmonic-motion
用到: wave-equation
后续: wave-superposition, standing-waves, doppler-effect
alias: 横波, 纵波, 波长, 波速, 频率, 波动图像, 简谐波

振动在介质中的传播形成机械波，传播的是振动形式和能量，介质质点只在平衡位置附近振动。波速 $v=\lambda f=\frac\lambda T$，由介质决定；频率由波源决定。简谐波
$$y=A\cos\left(\omega t-kx\right),\qquad k=\frac{2\pi}\lambda.$$

### 例题
波动图像与振动图像：波动图像是某一时刻所有质点的位移（照片），振动图像是某一质点在不同时刻的位移（录像）。由“同侧法”或“上下坡法”判断质点振动方向与波的传播方向。

### 注记
横波（质点振动方向垂直于传播方向，如绳波）与纵波（平行，如声波）。地震波中纵波比横波快，可由两者到达的时间差估算震源距离。

## 波的叠加与干涉 {#wave-superposition}
type: 原理 | en: Superposition and interference of waves | w: 4 | 考纲: 机械波, 干涉
前置: mechanical-wave
后续: standing-waves, double-slit
anim: waves
alias: 叠加原理, 干涉, 相干波, 加强点, 减弱点, 波程差

几列波相遇时各自保持原来的特性传播，相遇区域内质点的位移是各列波引起的位移的矢量和。两列频率相同、相位差恒定的相干波叠加，形成稳定的干涉图样：波程差 $\Delta r=k\lambda$ 处振动加强，$\Delta r=\left(k+\frac12\right)\lambda$ 处减弱（同相波源）。

### 注记
叠加原理来自波动方程的线性。降噪耳机播放与噪声反相的声波来抵消噪声。

## 驻波 {#standing-waves}
type: 现象 | en: Standing waves | w: 3 | 考纲: 机械波
前置: wave-superposition
源于: wave-equation
alias: 驻波, 波节, 波腹, 弦振动, 泛音, 共鸣管

两列振幅、频率相同，传播方向相反的波叠加形成驻波：$y=2A\cos kx\cos\omega t$。波节始终静止，波腹振幅最大，相邻波节间距 $\frac\lambda2$。

### 例题
两端固定、长 $L$ 的弦：$L=n\frac\lambda2$，频率 $f_n=\frac{nv}{2L}$，$n=1$ 为基音，其余为泛音。吉他按品就是改变 $L$；拧紧弦增大张力从而提高波速和音高。管乐器中，一端封闭的管只能产生奇数次谐波。

## 多普勒效应 {#doppler-effect}
type: 现象 | en: Doppler effect | w: 4 | 考纲: 机械波, 陌生情境中的综合推理
前置: mechanical-wave, relative-motion
alias: 多普勒效应, 红移, 蓝移, 测速雷达

波源与观察者相对运动时，观察者接收到的频率发生变化：
$$f'=\frac{v+v_o}{v-v_s}f,$$
$v$ 为波速，$v_o$ 为观察者向波源运动的速度，$v_s$ 为波源向观察者运动的速度。相互靠近频率升高，远离频率降低。

### 应用
救护车鸣笛经过时音调由高变低；测速雷达、超声多普勒测血流速度；天文学中星系光谱的红移表明宇宙在膨胀（哈勃定律）。光的多普勒效应需要用相对论公式。
