---
galaxy: physics
cluster: modern-physics
title: 近代物理初步
en: Modern physics
order: 11
level: hs
---

## 光子与能量量子化 {#photon}
type: 概念 | en: Photons and quantization | w: 5 | 考纲: 量子物理的基本概念
前置: electromagnetic-waves
后续: photoelectric-effect, bohr-model, wave-particle-duality
alias: 光子, 普朗克常量, 能量子, 黑体辐射, 量子

普朗克（1900）为解释黑体辐射，假设振子的能量只能是 $h\nu$ 的整数倍；爱因斯坦（1905）进一步提出光本身由光子组成，每个光子能量 $E=h\nu$、动量 $p=\frac h\lambda$，$h\approx6.63\times10^{-34}$ J·s。

### 注记
经典理论预言黑体在短波处辐射无穷大的能量（“紫外灾难”），能量量子化消除了这一发散：高频模式的能量子太大，难以被热运动激发。这是量子论的开端。

## 光电效应 {#photoelectric-effect}
type: 实验 | en: Photoelectric effect | w: 5 | 考纲: 光电效应
前置: photon, energy-conservation
alias: 光电效应方程, 逸出功, 截止频率, 遏止电压, 光电子

光照射金属表面打出电子。实验规律：存在截止频率，低于它无论多强的光都不能打出电子；光电子的最大初动能随频率线性增大、与光强无关；光电效应几乎瞬时发生。爱因斯坦光电效应方程：
$$E_{k\max}=h\nu-W_0,\qquad eU_c=E_{k\max}.$$

### 例题
测量不同频率光的遏止电压 $U_c$，作 $U_c$-$\nu$ 图：直线斜率为 $\frac he$，横截距为截止频率。密立根（1916）用这个实验精确测出了普朗克常量——尽管他本来想否定爱因斯坦的理论。

### 注记
经典波动理论无法解释截止频率（能量应随光强累积）。爱因斯坦因光电效应获得 1921 年诺贝尔奖。

## 原子的核式结构 {#rutherford}
type: 实验 | en: Rutherford's nuclear model | w: 4 | 考纲: 原子, 原子核
前置: coulomb-law
后续: bohr-model, radioactivity
alias: α 粒子散射实验, 卢瑟福, 原子核, 核式结构模型

卢瑟福的 α 粒子散射实验（1909–1911）：绝大多数 α 粒子直接穿过金箔，少数大角度偏转，极少数（约八千分之一）被反弹。由此提出：原子中心有一个极小（半径约 $10^{-15}$ m，原子约 $10^{-10}$ m）而集中了几乎全部质量和全部正电荷的原子核。

### 注记
“就像你用一枚 15 英寸的炮弹射向一张薄纸，它却被弹回来打中了你。”——卢瑟福。原子几乎是空的。但按经典电磁理论，绕核运动的电子会辐射能量而坠入核内，原子不可能稳定——这引出了玻尔模型。

## 玻尔模型与氢原子光谱 {#bohr-model}
type: 模型 | en: Bohr model | w: 4 | 考纲: 原子, 量子物理的基本概念
前置: rutherford, photon, centripetal-force
后续: schrodinger-equation
alias: 能级, 跃迁, 氢原子光谱, 定态, 巴耳末系, 基态, 激发态

玻尔（1913）三条假设：电子只能在某些分立的轨道上运动（定态），不辐射；角动量量子化 $mvr=n\frac h{2\pi}$；在两定态间跃迁时吸收或放出光子 $h\nu=E_m-E_n$。由此得氢原子能级
$$E_n=-\frac{13.6\ \text{eV}}{n^2},\qquad r_n=n^2r_1,\ r_1\approx0.053\ \text{nm}.$$

### 例题
从 $n=3$ 跃迁到 $n=2$ 放出光子能量 $13.6\left(\frac14-\frac19\right)\approx1.89$ eV，波长约 $656$ nm（红色，巴耳末系 $H_\alpha$ 线）。大量处于 $n=4$ 的氢原子跃迁，最多发出 $\binom42=6$ 种频率的光。

### 注记
玻尔模型对氢原子极为成功，但不能解释多电子原子。现代量子力学中电子没有确定的轨道，只有概率分布（电子云），能级则由薛定谔方程给出，结果与玻尔模型一致。

## 波粒二象性 {#wave-particle-duality}
type: 概念 | en: Wave–particle duality | w: 5 | 考纲: 量子物理的基本概念
前置: photon, double-slit
后续: uncertainty-principle, schrodinger-equation
alias: 德布罗意波, 物质波, 电子衍射, 概率波

光既有波动性（干涉、衍射）又有粒子性（光电效应、康普顿效应）。德布罗意（1924）提出一切实物粒子也具有波动性，波长
$$\lambda=\frac hp.$$
电子衍射实验（戴维孙–革末，1927）证实了这一点。

### 例题
经 $100$ V 加速的电子，$p=\sqrt{2meU}$，$\lambda=\frac h{\sqrt{2meU}}\approx0.12$ nm，与晶体原子间距相当，所以能观察到衍射。宏观物体（如飞行的网球）的德布罗意波长约 $10^{-34}$ m，完全不可观测。

### 注记
波是“概率波”：波函数振幅的平方给出在某处发现粒子的概率（玻恩）。单个粒子落在哪里是随机的，大量粒子的分布服从波的干涉图样。

## 不确定关系 {#uncertainty-principle}
type: 原理 | en: Uncertainty principle | w: 4 | 考纲: 量子物理的基本概念
前置: wave-particle-duality
源于: fourier-transform
用到: cauchy-schwarz
alias: 海森伯不确定关系, 测不准原理, 零点能

粒子的位置与动量不能同时具有确定的值：
$$\Delta x\,\Delta p\ge\frac\hbar2,\qquad\hbar=\frac h{2\pi}.$$
这不是测量技术的局限，而是波动性的必然：局域在 $\Delta x$ 内的波包，必须由波数范围 $\Delta k\gtrsim\frac1{\Delta x}$ 的平面波叠加而成（傅里叶分析），而 $p=\hbar k$。

### 应用
估算氢原子大小：电子被限制在半径 $r$ 内，$p\sim\frac\hbar r$，能量 $E\sim\frac{\hbar^2}{2mr^2}-\frac{ke^2}r$，求极小值得 $r\sim\frac{\hbar^2}{mke^2}\approx0.053$ nm——正是玻尔半径。不确定关系解释了原子为什么不会坍缩。

## 薛定谔方程 {#schrodinger-equation}
type: 方程 | en: Schrödinger equation | w: 3 | level: ext | 考纲: 量子物理的基本概念
前置: wave-particle-duality, partial-derivative
用到: hilbert-space, eigenvalue
alias: 波函数, 定态, 量子力学, 能量本征值, 无限深势阱

$$\ii\hbar\frac{\partial\psi}{\partial t}=-\frac{\hbar^2}{2m}\nabla^2\psi+V\psi.$$
定态 $\psi=\phi(x)\ee^{-\ii Et/\hbar}$ 满足本征值方程 $\hat H\phi=E\phi$：能量量子化就是哈密顿算子的本征值问题。

### 例题
一维无限深势阱（宽 $a$）：$\phi_n=\sqrt{\frac2a}\sin\frac{n\pi x}a$，$E_n=\frac{n^2\pi^2\hbar^2}{2ma^2}$。与两端固定的弦的驻波完全类似——能级分立来自边界条件。

### 注记
量子力学中可观测量是希尔伯特空间上的自伴算子，测量值是其本征值，测量后态坍缩到本征态。线性代数的谱定理正是量子力学的数学骨架。

## 放射性衰变 {#radioactivity}
type: 现象 | en: Radioactive decay | w: 4 | 考纲: 原子核
前置: rutherford
用到: separable-ode
后续: nuclear-reactions
alias: 半衰期, α 衰变, β 衰变, γ 射线, 衰变规律, 碳十四测年

原子核自发放出 α 粒子（氦核）、β 粒子（电子）或 γ 光子而转变。每个原子核衰变是随机的，大量原子核满足指数衰减：
$$N=N_0\ee^{-\lambda t}=N_0\left(\frac12\right)^{t/T_{1/2}},\qquad T_{1/2}=\frac{\ln2}\lambda.$$
半衰期由原子核本身决定，与温度、压强、化学状态无关。

### 例题
碳十四测年：活体中 $^{14}$C 含量与大气平衡，死亡后按半衰期约 $5730$ 年衰减。测得某古木中 $^{14}$C 含量为现代的 $\frac14$，则约有 $2\times5730=11460$ 年。

### 注记
衰变方程遵循电荷数守恒与质量数守恒：$^{238}_{92}\text{U}\to{}^{234}_{90}\text{Th}+{}^4_2\text{He}$。

## 核反应与核能 {#nuclear-reactions}
type: 现象 | en: Nuclear reactions and nuclear energy | w: 4 | 考纲: 原子核
前置: radioactivity, mass-energy
alias: 核裂变, 核聚变, 链式反应, 结合能, 比结合能

核反应中电荷数、质量数守恒。比结合能（每个核子的平均结合能）在铁附近最大，所以重核裂变与轻核聚变都能放出能量：
$$^{235}_{92}\text{U}+{}^1_0\text{n}\to{}^{141}_{56}\text{Ba}+{}^{92}_{36}\text{Kr}+3\,{}^1_0\text{n}\quad(\text{约 }200\text{ MeV}),$$
$$^2_1\text{H}+{}^3_1\text{H}\to{}^4_2\text{He}+{}^1_0\text{n}\quad(\text{约 }17.6\text{ MeV}).$$

### 注记
裂变放出的中子可以引起更多裂变（链式反应）：受控用于核电站，失控即原子弹。太阳的能量来自氢聚变为氦；受控核聚变（托卡马克、惯性约束）仍在研究中。

## 质能方程 {#mass-energy}
type: 定律 | en: Mass–energy equivalence | w: 5 | 考纲: 相对论的基本概念, 原子核
前置: relativity-postulates
后续: nuclear-reactions
alias: E=mc², 质量亏损, 质能关系

$$E=mc^2,\qquad\Delta E=\Delta m\,c^2.$$
质量与能量是等价的，核反应中的质量亏损对应释放的能量。$1$ u 的质量对应约 $931.5$ MeV。

### 例题
氘核由一个质子和一个中子组成，质量亏损约 $0.0024$ u，结合能约 $2.2$ MeV。$1$ kg 物质完全转化为能量约 $9\times10^{16}$ J，相当于约两千万吨 TNT。

## 狭义相对论的基本假设 {#relativity-postulates}
type: 原理 | en: Postulates of special relativity | w: 5 | 考纲: 相对论的基本概念
前置: relative-motion, electromagnetic-waves
后续: time-dilation, lorentz-transformation, mass-energy
alias: 相对性原理, 光速不变原理, 狭义相对论, 同时的相对性

爱因斯坦（1905）：
1. **相对性原理**：物理定律在一切惯性参考系中形式相同；
2. **光速不变原理**：真空中的光速在一切惯性参考系中都是 $c$，与光源的运动无关。

### 推论
同时是相对的：在一个参考系中同时发生的两个异地事件，在另一个参考系中不同时。迈克耳孙–莫雷实验（1887）没有发现以太风，与光速不变一致。

### 注记
牛顿力学是相对论在 $v\ll c$ 时的近似。GPS 卫星必须同时修正狭义相对论（运动使钟变慢约 $7\ \mu$s/天）与广义相对论（引力较弱使钟变快约 $45\ \mu$s/天）的效应，否则每天的定位误差可达约 $10$ km。

## 时间膨胀与长度收缩 {#time-dilation}
type: 公式 | en: Time dilation and length contraction | w: 4 | 考纲: 相对论的基本概念
源于: relativity-postulates
前置: pythagorean
anim: light-clock
alias: 钟慢效应, 尺缩效应, 洛伦兹因子, 固有时, μ 子寿命, 双生子佯谬

运动的钟变慢、运动的尺变短：
$$\Delta t=\gamma\Delta\tau,\qquad L=\frac{L_0}\gamma,\qquad\gamma=\frac1{\sqrt{1-v^2/c^2}}.$$

### 推导（光钟）
光在相距 $d$ 的两镜之间往返，静止时半周期 $\Delta\tau=\frac dc$。光钟以 $v$ 运动时，地面观察者看到光走斜线，由勾股定理 $(c\Delta t)^2=d^2+(v\Delta t)^2$，所以 $\Delta t=\frac{d/c}{\sqrt{1-v^2/c^2}}=\gamma\Delta\tau$。

### 例题
宇宙射线在高空产生的 μ 子，固有寿命约 $2.2\ \mu$s，以 $0.998c$ 运动，$\gamma\approx16$，在地面参考系中寿命延长到约 $35\ \mu$s，足以飞行约 $10$ km 到达地面——实验已证实。

## 洛伦兹变换 {#lorentz-transformation}
type: 公式 | en: Lorentz transformation | w: 3 | level: ext | 考纲: 相对论的基本概念
源于: relativity-postulates
前置: time-dilation, linear-map
alias: 洛伦兹变换, 时空间隔, 相对论速度叠加, 闵可夫斯基时空

惯性系 $S'$ 相对 $S$ 沿 $x$ 方向以速度 $v$ 运动：
$$x'=\gamma(x-vt),\qquad t'=\gamma\left(t-\frac{vx}{c^2}\right).$$
时空间隔 $s^2=c^2t^2-x^2-y^2-z^2$ 不变；速度叠加 $u'=\frac{u-v}{1-uv/c^2}$，$u=c$ 时 $u'=c$。

### 注记
洛伦兹变换是保持闵可夫斯基度量 $c^2t^2-x^2$ 的线性变换，就像旋转保持欧氏距离——相对论是四维时空的几何（闵可夫斯基，1908）。用快度 $\phi$（$\tanh\phi=\frac vc$）表示，它就是“双曲旋转”：$\begin{pmatrix}\cosh\phi&-\sinh\phi\\-\sinh\phi&\cosh\phi\end{pmatrix}$。
