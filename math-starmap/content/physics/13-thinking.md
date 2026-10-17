---
galaxy: physics
cluster: physics-thinking
title: 物理思维与综合应用
en: Physical reasoning
order: 13
level: hs
---

## 物理建模 {#physical-modeling}
type: 思想 | en: Physical modeling | w: 5 | 考纲: 物理建模
后续: dimensional-analysis, limiting-cases, unfamiliar-reasoning
alias: 理想模型, 理想化, 质点, 点电荷, 理想气体, 模型化

抓住主要因素、忽略次要因素，把实际问题抽象为可以计算的理想模型：质点、刚体、轻绳、光滑平面、点电荷、理想气体、理想变压器、简谐振动……再用数学求解，最后回到实际检验。

### 例题
“球形奶牛”：研究奶牛散热时可以把它近似为球体——物理学家的自嘲，也是建模精神的写照。地球绕太阳公转时可视为质点，研究自转时则不能。

### 注记
模型的好坏取决于问题：同一个物体在不同问题中需要不同的模型。建模的关键是知道自己忽略了什么，以及何时这些忽略不再成立。

## 量纲分析 {#dimensional-analysis}
type: 方法 | en: Dimensional analysis | w: 5 | 考纲: 量纲分析
前置: physical-modeling
后续: scaling-laws
alias: 量纲, 单位, 白金汉 π 定理, 量纲齐次

物理方程两边的量纲必须相同。用基本量纲（质量 M、长度 L、时间 T、电流、温度……）表示物理量，可以检查公式、甚至推导公式的形式。

### 例题
**单摆周期**：设 $T\propto m^aL^bg^c$，量纲 $[T]=\text{M}^a\text{L}^b(\text{L}\,\text{T}^{-2})^c$，得 $a=0$，$b+c=0$，$-2c=1$，所以 $T\propto\sqrt{\frac Lg}$——与质量无关，仅差一个无量纲常数 $2\pi$。
**原子弹的威力**：泰勒（1950）由公开的爆炸火球照片，用 $R\propto\left(\frac{Et^2}\rho\right)^{1/5}$ 估算出首次核试验的能量约 $2\times10^4$ 吨 TNT 当量，当时这是机密数据。

### 注记
白金汉 π 定理：含 $n$ 个物理量、$k$ 个基本量纲的关系，可化为 $n-k$ 个无量纲组合之间的关系（如流体力学中的雷诺数）。

## 数量级估算 {#order-of-magnitude}
type: 方法 | en: Order-of-magnitude estimation | w: 4 | 考纲: 数量级估算
前置: physical-modeling
alias: 费米问题, 估算, 数量级, 合理近似

只追求结果的数量级（$10$ 的幂次），把复杂问题分解为若干个可以合理估计的因子相乘。

### 例题
**费米问题**：芝加哥有多少钢琴调音师？人口约 $3\times10^6$，每户约 $2$ 人，约 $\frac15$ 的家庭有钢琴，每台钢琴每年调一次，一位调音师每年约调 $1000$ 台（每天 $4$ 台），所以约 $\frac{3\times10^6}{2}\times\frac15\div1000\approx300$ 人。
**一次深呼吸中有多少个分子曾经被恺撒吸入？** 恺撒临终的一口气约 $1$ L（约 $2.5\times10^{22}$ 个分子），已均匀散布于全球大气（约 $10^{44}$ 个分子）；你吸入的 $10^{22}$ 个分子中，约有 $10^{22}\times\frac{2.5\times10^{22}}{10^{44}}\approx2.5$ 个——几乎每一口气里都有。

## 极限与特殊情况检验 {#limiting-cases}
type: 方法 | en: Limiting cases and sanity checks | w: 3 | 考纲: 物理建模, 陌生情境中的综合推理
前置: physical-modeling
相关: special-general
alias: 极限法, 特殊值检验, 对称性检验, 合理性检验

检查答案在极端情况（参数趋于零或无穷、两个参数相等）下是否给出已知的正确结果，以发现错误或缩小可能的答案。

### 例题
阿特伍德机 $a=\frac{(m_1-m_2)g}{m_1+m_2}$：$m_2=0$ 时 $a=g$（自由落体），$m_1=m_2$ 时 $a=0$（平衡），$m_1\gg m_2$ 时 $a\to g$——全部合理。若算出 $a=\frac{(m_1-m_2)g}{m_1}$，检查 $m_1=m_2$ 不出错，但 $m_2\gg m_1$ 时 $\abs a\gg g$，显然错误。

## 对称性与守恒定律 {#symmetry-conservation}
type: 定理 | en: Symmetries and conservation laws | w: 4 | level: ext | 考纲: 物理建模
源于: least-action
前置: energy-conservation, momentum-conservation
alias: 诺特定理, 对称性, 守恒量, 时间平移, 空间平移, 转动对称

诺特定理（1918）：作用量的每一种连续对称性对应一个守恒量。
| 对称性 | 守恒量 |
|:-:|:-:|
| 时间平移 | 能量 |
| 空间平移 | 动量 |
| 空间转动 | 角动量 |
| 电磁规范变换 | 电荷 |

### 注记
这把守恒定律从“经验规律”提升为“时空对称性的推论”，是现代物理（粒子物理的标准模型）的指导思想。在解题中，对称性分析可以迅速简化问题：均匀带电球的电场必沿径向、光滑碗中小球的运动关于对称轴对称……

## 标度律 {#scaling-laws}
type: 思想 | en: Scaling laws | w: 3 | level: ext | 考纲: 量纲分析, 数量级估算
前置: dimensional-analysis
alias: 标度, 相似律, 平方立方定律, 异速生长

物体线度放大 $k$ 倍，面积变为 $k^2$ 倍，体积（质量）变为 $k^3$ 倍（伽利略的平方–立方定律）。

### 例题
- 骨骼的承重能力与截面积（$\propto k^2$）成正比，体重 $\propto k^3$，所以大动物的骨头必须比例上更粗——巨人不可能按人的比例放大。
- 小动物单位体重的散热面积大，代谢率高；蚂蚁摔下不受伤，因为空气阻力（$\propto k^2$）相对重力（$\propto k^3$）更显著。
- 船模试验：只有在弗劳德数 $\frac v{\sqrt{gL}}$ 相同时，模型的波浪才与实船相似。

## 陌生情境中的综合推理 {#unfamiliar-reasoning}
type: 方法 | en: Reasoning in unfamiliar situations | w: 5 | 考纲: 陌生情境中的综合推理
前置: physical-modeling, dimensional-analysis, energy-conservation
相关: limiting-cases
alias: 信息迁移, 新情境问题, 综合应用, 题目提供信息

面对题目中给出的新概念、新公式或新模型（考纲说明：超出高中范围时题目原则上提供必要信息），步骤是：
1. 读懂新信息：它定义了什么量，满足什么关系，与已知规律有何异同；
2. 建立模型：找到熟悉的“原型”（简谐振动、圆周运动、守恒定律、类比电路……）；
3. 选用普遍原理：守恒律、牛顿定律、能量方法、对称性往往在新情境中依然成立；
4. 检验：量纲、极限情况、数量级是否合理。

### 例题
题目给出“电偶极子在匀强电场中受力矩 $\vv M=\vv p\times\vv E$”，问小角度摆动的周期。类比单摆：$I\ddot\theta=-pE\sin\theta\approx-pE\theta$，所以 $T=2\pi\sqrt{\frac I{pE}}$——新问题，老模型。

### 注记
类比是最强大的迁移工具：$LC$ 电路与弹簧振子、引力与静电力、热传导与扩散……数学形式相同的方程有相同的解。
