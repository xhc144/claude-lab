---
galaxy: physics
cluster: energy-momentum
title: 动量与能量
en: Momentum and energy
order: 2
level: hs
---

## 功与功率 {#work-power}
type: 物理量 | en: Work and power | w: 4 | 考纲: 能量
前置: newton-second, dot-product
后续: kinetic-energy-theorem
用到: line-integral
alias: 功, 功率, 变力做功, 额定功率, 机车启动

恒力做功 $W=\vv F\cdot\vv s=Fs\cos\theta$；变力沿路径做功 $W=\int\vv F\cdot\dd\vv r$。功率 $P=\frac{\dd W}{\dd t}=\vv F\cdot\vv v$。

### 例题
汽车以额定功率 $P$ 启动：$F=\frac Pv$，随速度增大牵引力减小、加速度减小，最终 $F=f$ 时达到最大速度 $v_m=\frac Pf$。若先以恒定加速度启动，功率逐渐增大，达到额定功率后再进入上述过程。

## 动能定理 {#kinetic-energy-theorem}
type: 定理 | en: Work–energy theorem | w: 5 | 考纲: 能量
前置: work-power
推出: energy-conservation
后续: least-action
alias: 动能定理, 动能

合外力做的总功等于物体动能的变化：
$$W_{\text{合}}=\frac12mv_2^2-\frac12mv_1^2.$$

### 推导
$W=\int\vv F\cdot\dd\vv r=\int m\frac{\dd\vv v}{\dd t}\cdot\vv v\,\dd t=\int\frac{\dd}{\dd t}\left(\frac12mv^2\right)\dd t$。它是牛顿第二定律对位移的积分。

### 应用
只关心始末状态、不关心过程细节时，动能定理比牛顿定律更方便，尤其是变力或曲线运动：例如求物体沿任意形状的光滑轨道滑下的末速度。

## 势能与保守力 {#potential-energy}
type: 概念 | en: Potential energy | w: 4 | 考纲: 能量
前置: work-power
源于: path-independence
后续: energy-conservation, gravitational-potential-energy, electric-potential
alias: 重力势能, 弹性势能, 保守力, 势能

做功与路径无关的力叫保守力（重力、弹力、万有引力、静电力），可以定义势能：保守力做的功等于势能的减少，$W=-\Delta E_p$，$\vv F=-\nabla E_p$。
- 重力势能 $E_p=mgh$；
- 弹性势能 $E_p=\frac12kx^2$；
- 引力势能 $E_p=-\frac{GMm}r$（取无穷远为零）。

### 注记
势能属于系统而非单个物体，其零点可以任意选取，只有差值有物理意义。摩擦力做功与路径有关，不能定义势能。

## 机械能守恒与能量守恒 {#energy-conservation}
type: 定律 | en: Conservation of energy | w: 5 | 考纲: 能量, 能量转化
源于: kinetic-energy-theorem
前置: potential-energy
后续: first-law-thermo, collisions
alias: 机械能守恒定律, 能量守恒定律, 功能关系
tags: 守恒律

只有保守力做功时，机械能 $E_k+E_p$ 守恒。一般地，能量既不会凭空产生，也不会凭空消失，只会从一种形式转化为另一种形式：摩擦把机械能转化为内能，$\Delta E_{\text{机}}=-fs_{\text{相对}}$。

### 例题
单摆从偏角 $\theta$ 释放，最低点速度 $v=\sqrt{2gL(1-\cos\theta)}$；物块从高 $h$ 的光滑曲面滑下，末速度 $\sqrt{2gh}$，与曲面形状无关。

### 注记
能量守恒对应时间平移对称性（诺特定理，见 [[symmetry-conservation]]）。热力学第一定律是包含热量的能量守恒。

## 动量与动量定理 {#momentum-theorem}
type: 定理 | en: Momentum and impulse | w: 5 | 考纲: 动量
前置: newton-second
推出: momentum-conservation
alias: 动量, 冲量, 动量定理, 缓冲

动量 $\vv p=m\vv v$，冲量 $\vv I=\int\vv F\,\dd t$。动量定理：合外力的冲量等于动量的变化 $\vv I=\Delta\vv p$。

### 应用
同样的动量变化，作用时间越长，平均冲力越小：安全气囊、跳远落沙坑、接球时手往回收。连续流体的冲击力：水流以速度 $v$、截面积 $S$ 垂直冲击墙面并停下，冲击力 $F=\rho Sv^2$。

## 动量守恒定律 {#momentum-conservation}
type: 定律 | en: Conservation of momentum | w: 5 | 考纲: 动量
源于: momentum-theorem, newton-third
后续: collisions, center-of-mass, rocket-equation
alias: 动量守恒, 反冲, 人船模型

系统不受外力或所受合外力为零时，总动量守恒。内力（如爆炸、碰撞）只在系统内部转移动量。某一方向合外力为零时，该方向动量守恒。

### 例题
**人船模型**：静止在水面上质量为 $M$、长 $L$ 的船，质量为 $m$ 的人从船头走到船尾，船后退 $\frac{mL}{M+m}$。由动量守恒，系统质心不动：$mx_{\text{人}}=Mx_{\text{船}}$，$x_{\text{人}}+x_{\text{船}}=L$。

### 注记
动量守恒对应空间平移对称性；它在微观领域也严格成立（β 衰变中“丢失”的动量促使泡利预言了中微子）。

## 碰撞 {#collisions}
type: 模型 | en: Collisions | w: 4 | 考纲: 动量, 能量
前置: momentum-conservation, energy-conservation
alias: 弹性碰撞, 完全非弹性碰撞, 恢复系数, 速度交换

碰撞时间极短、内力极大，动量守恒。
- 完全弹性碰撞：动能也守恒。一维时（$m_2$ 原来静止）
$$v_1'=\frac{m_1-m_2}{m_1+m_2}v_1,\qquad v_2'=\frac{2m_1}{m_1+m_2}v_1;$$
质量相等时交换速度。
- 完全非弹性碰撞：碰后粘在一起，动能损失最大。

### 例题
牛顿摆：一端一个球撞上去，另一端恰好弹出一个球——同时满足动量守恒与能量守恒的结果。若两球质量相等、弹性碰撞，速度交换。

### 注记
弹性碰撞中相对速度大小不变（$v_2'-v_1'=v_1-v_2$），这比直接解方程组更快。航天器的引力弹弓是与行星的“弹性碰撞”。

## 质心 {#center-of-mass}
type: 概念 | en: Center of mass | w: 3 | 考纲: 动量
前置: momentum-conservation
用到: triple-integral
alias: 质心, 重心, 质心运动定理

$\vv r_c=\frac{\sum m_i\vv r_i}{\sum m_i}$（连续体用积分）。质心运动定理：$M\vv a_c=\vv F_{\text{外}}$——系统的质心像一个质量为 $M$、受全部外力的质点一样运动，内力无关。

### 例题
烟花在空中爆炸后，碎片的质心继续沿原来的抛物线运动（直到有碎片落地）。跳高运动员用背越式过杆时，身体可以绕过横杆而质心从杆下通过。

## 力矩 {#torque}
type: 物理量 | en: Torque | w: 3 | 考纲: 受力分析
源于: cross-product
后续: angular-momentum
alias: 力矩, 杠杆原理, 力矩平衡, 力臂

$\vv M=\vv r\times\vv F$，大小为力乘以力臂。刚体平衡需要合力为零且对任一点的合力矩为零。

### 例题
杠杆原理 $F_1l_1=F_2l_2$（阿基米德：“给我一个支点，我就能撬动地球”）。梯子靠在光滑墙上不滑倒的条件：$\tan\theta\le2\mu$（$\theta$ 为梯子与竖直墙面的夹角，$\mu$ 为地面摩擦因数），由竖直方向、水平方向受力平衡与对底端的力矩平衡联立得到。

## 角动量 {#angular-momentum}
type: 物理量 | en: Angular momentum | w: 3 | 考纲: 动量, 万有引力
前置: torque, momentum-theorem
后续: kepler-laws, rigid-body-rotation
alias: 角动量守恒, 动量矩, 开普勒第二定律

$\vv L=\vv r\times\vv p$，$\frac{\dd\vv L}{\dd t}=\vv M$。合外力矩为零时角动量守恒。

### 例题
花样滑冰运动员收拢手臂，转动惯量减小，转速加快。行星受指向太阳的有心力，对太阳的力矩为零，角动量守恒：$\abs{\vv r\times\vv v}$ 恒定，即单位时间扫过的面积相等——开普勒第二定律。

## 刚体转动 {#rigid-body-rotation}
type: 定律 | en: Rotation of rigid bodies | w: 2 | level: ext
前置: angular-momentum
用到: triple-integral
alias: 转动惯量, 转动定律, 平行轴定理, 转动动能

刚体绕定轴转动：$M=I\beta$（转动定律，$\beta$ 为角加速度），转动惯量 $I=\int r^2\dd m$，转动动能 $\frac12I\omega^2$，角动量 $L=I\omega$。平行轴定理 $I=I_c+Md^2$。

### 例题
从同一斜面顶端同时由静止滚下（纯滚动）的实心球、实心圆柱、圆环：$a=\frac{g\sin\theta}{1+I/(mr^2)}$，$I/(mr^2)$ 分别为 $\frac25,\frac12,1$，所以实心球最先到达，圆环最后——与质量、半径无关。

## 火箭方程 {#rocket-equation}
type: 方程 | en: Tsiolkovsky rocket equation | w: 2 | level: ext
源于: momentum-conservation
前置: separable-ode
alias: 齐奥尔科夫斯基公式, 变质量, 比冲

火箭以相对速度 $u$ 向后喷气，由动量守恒得 $m\,\dd v=-u\,\dd m$，积分得
$$\Delta v=u\ln\frac{m_0}{m_1}.$$

### 注记
速度增量只对数地依赖于质量比：要达到第一宇宙速度约 $7.9$ km/s（实际还要克服重力与空气阻力，约需 $9.5$ km/s），以 $u\approx3$ km/s 计算，质量比要 $\ee^{3.2}\approx24$ 以上——这就是为什么要用多级火箭。
