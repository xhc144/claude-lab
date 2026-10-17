---
galaxy: physics
cluster: thermal
title: 热学
en: Thermal physics
order: 4
level: hs
---

## 分子动理论 {#molecular-kinetic}
type: 原理 | en: Kinetic molecular theory | w: 4 | 考纲: 分子动理论
后续: temperature-internal-energy, kinetic-theory-pressure
alias: 分子动理论, 阿伏伽德罗常数, 分子力, 扩散, 布朗运动

物质由大量分子组成（$1$ mol 含 $N_A\approx6.02\times10^{23}$ 个）；分子永不停息地做无规则热运动（扩散、布朗运动）；分子间同时存在引力和斥力，距离小于平衡距离 $r_0$（约 $10^{-10}$ m）时表现为斥力，大于时表现为引力。

### 例题
油膜法估测分子直径：一滴体积为 $V$ 的油酸在水面上展开成面积为 $S$ 的单分子层，分子直径 $d\approx\frac VS$，量级约 $10^{-10}$ m。

## 温度与内能 {#temperature-internal-energy}
type: 物理量 | en: Temperature and internal energy | w: 4 | 考纲: 分子动理论, 热力学过程
前置: molecular-kinetic
后续: first-law-thermo
alias: 温度, 内能, 热力学温标, 热平衡, 分子平均动能

温度是分子平均动能的标志：单原子理想气体 $\frac32kT=\overline{\frac12mv^2}$，$k$ 为玻尔兹曼常数。热力学温度 $T=t+273.15$ K。内能是所有分子动能与分子势能的总和，与温度、体积和物质的量有关；理想气体的内能只与温度有关，单原子气体 $U=\frac32nRT$。

### 注记
热力学第零定律：若 $A,B$ 都与 $C$ 处于热平衡，则 $A$ 与 $B$ 也处于热平衡——这是温度计能够工作的依据。

## 理想气体状态方程 {#ideal-gas-law}
type: 定律 | en: Ideal gas law | w: 5 | 考纲: 理想气体
前置: temperature-internal-energy
后续: thermo-processes, kinetic-theory-pressure
alias: 理想气体, 克拉珀龙方程, 玻意耳定律, 查理定律, 盖-吕萨克定律, pV=nRT

$$pV=nRT,\qquad R\approx8.31\ \text{J}/(\text{mol}\cdot\text{K}).$$
特例：等温 $pV=$ 常数（玻意耳定律）、等容 $\frac pT=$ 常数（查理定律）、等压 $\frac VT=$ 常数（盖–吕萨克定律）。

### 例题
气缸内气体温度从 $27^\circ$C 升到 $127^\circ$C、体积不变，压强变为原来的 $\frac{400}{300}=\frac43$ 倍——注意用热力学温度。

### 注记
真实气体在高压、低温下偏离理想气体，范德瓦耳斯方程 $\left(p+\frac{an^2}{V^2}\right)(V-nb)=nRT$ 修正了分子体积与分子引力。

## 气体压强的微观解释 {#kinetic-theory-pressure}
type: 定理 | en: Kinetic theory of pressure | w: 3 | 考纲: 分子动理论, 理想气体
前置: ideal-gas-law, momentum-theorem
alias: 气体压强, 分子碰撞, 方均根速率

气体压强是大量分子频繁碰撞器壁的平均效果：
$$p=\frac13nm\overline{v^2}=\frac23n\overline{E_k},$$
$n$ 为分子数密度。与 $p=nkT$ 比较即得 $\overline{E_k}=\frac32kT$——温度的微观意义。

### 推导
分子以速度 $v_x$ 撞击垂直于 $x$ 轴的器壁，动量变化 $2mv_x$；单位时间撞到单位面积上的分子数为 $\frac12nv_x$（只有一半向器壁运动）；乘起来并对速度取平均，再由各向同性 $\overline{v_x^2}=\frac13\overline{v^2}$。

### 例题
室温下氮气分子的方均根速率 $\sqrt{\frac{3RT}M}\approx\sqrt{\frac{3\times8.31\times300}{0.028}}\approx517$ m/s，比声速还快。

## 热力学第一定律 {#first-law-thermo}
type: 定律 | en: First law of thermodynamics | w: 5 | 考纲: 热力学过程, 能量转化
源于: energy-conservation
前置: temperature-internal-energy
后续: thermo-processes
alias: 热力学第一定律, 内能变化, 第一类永动机

$$\Delta U=Q+W,$$
内能的增加等于外界传给系统的热量与外界对系统做的功之和。它是包含热现象的能量守恒定律，否定了第一类永动机。

### 符号约定
$Q>0$ 吸热，$W>0$ 外界对系统做功（气体被压缩）。气体膨胀时对外做功 $\int p\,\dd V$，此时 $W<0$。

## 热力学过程 {#thermo-processes}
type: 模型 | en: Thermodynamic processes | w: 4 | 考纲: 热力学过程
前置: first-law-thermo, ideal-gas-law
后续: carnot-engine
用到: integral-apps
alias: 等温过程, 等压过程, 等容过程, 绝热过程, p-V 图

理想气体的四种基本过程（$n$ mol，单原子 $C_V=\frac32R$）：
| 过程 | 特点 | 做功 | 吸热 |
|:-:|:-:|:-:|:-:|
| 等容 | $W=0$ | $0$ | $Q=nC_V\Delta T$ |
| 等压 | $p$ 不变 | 对外 $p\Delta V$ | $Q=nC_p\Delta T$ |
| 等温 | $\Delta U=0$ | 对外 $nRT\ln\frac{V_2}{V_1}$ | $Q=$ 对外做的功 |
| 绝热 | $Q=0$ | $pV^\gamma=$ 常数 | $0$ |

$C_p-C_V=R$（迈耶公式），$\gamma=\frac{C_p}{C_V}$。

### 注记
在 $p$-$V$ 图上，过程曲线下的面积就是气体对外做的功；绝热线比等温线更陡。快速压缩空气（打气筒、柴油机）近似绝热，温度明显升高。

## 热力学第二定律 {#second-law-thermo}
type: 定律 | en: Second law of thermodynamics | w: 5 | 考纲: 热力学过程, 能量转化
前置: first-law-thermo
后续: carnot-engine
alias: 熵, 熵增原理, 克劳修斯表述, 开尔文表述, 第二类永动机, 不可逆过程

- 克劳修斯表述：热量不能自发地从低温物体传到高温物体；
- 开尔文表述：不可能从单一热源吸热并全部转化为功而不产生其他影响（第二类永动机不可能）；
- 熵表述：孤立系统的熵永不减少，$\Delta S\ge0$，可逆过程取等号。

### 微观意义
玻尔兹曼：$S=k\ln\Omega$，$\Omega$ 是宏观状态对应的微观状态数。熵增就是系统从“少数可能”走向“多数可能”的统计规律：气体自由膨胀后几乎不可能自发地全部回到一半容器中。

### 注记
第二定律规定了时间的方向（热力学时间箭头）。能量守恒，但能量的“品质”会退化：高温热量可以做功，低温热量难以利用。

## 热机与卡诺循环 {#carnot-engine}
type: 定理 | en: Heat engines and the Carnot cycle | w: 4 | 考纲: 能量转化, 热力学过程
前置: thermo-processes, second-law-thermo
alias: 卡诺循环, 卡诺定理, 热机效率, 制冷机

热机从高温热源吸热 $Q_1$、向低温热源放热 $Q_2$，对外做功 $W=Q_1-Q_2$，效率 $\eta=\frac W{Q_1}$。卡诺定理：工作在温度 $T_1$、$T_2$ 之间的一切热机，效率不超过可逆的卡诺循环：
$$\eta\le1-\frac{T_2}{T_1}.$$

### 推导
卡诺循环由两个等温、两个绝热过程组成。等温吸热 $Q_1=nRT_1\ln\frac{V_2}{V_1}$，放热 $Q_2=nRT_2\ln\frac{V_3}{V_4}$；两个绝热过程给出 $\frac{V_2}{V_1}=\frac{V_3}{V_4}$，所以 $\frac{Q_2}{Q_1}=\frac{T_2}{T_1}$。

### 例题
火电厂蒸汽温度约 $800$ K，冷却水约 $300$ K，效率上限 $1-\frac{300}{800}=62.5\%$，实际约 $40\%$。冰箱与热泵是反向运行的热机。

## 布朗运动 {#brownian-motion}
type: 现象 | en: Brownian motion | w: 3 | 考纲: 分子动理论, 简单随机过程
前置: molecular-kinetic, random-walk
alias: 布朗运动, 扩散, 爱因斯坦关系, 佩兰实验

悬浮在液体中的微粒在液体分子的无规则撞击下做无规则运动。爱因斯坦（1905）指出微粒的均方位移与时间成正比：$\overline{x^2}=2Dt$，扩散系数 $D=\frac{kT}{6\pi\eta a}$。佩兰据此测出阿伏伽德罗常数，从而证实了原子的存在。

### 注记
布朗运动是随机游走的连续极限（维纳过程），其路径处处连续、处处不可导。它在金融数学中用于描述股价波动（布莱克–斯科尔斯模型）。
