---
galaxy: analysis
cluster: measure
title: 测度与勒贝格积分
en: Measure and Lebesgue integration
order: 13
level: ext
---

## 勒贝格测度 {#lebesgue-measure}
type: 定义 | en: Lebesgue measure | w: 3 | level: ext
前置: countable-sets, open-set
后续: lebesgue-integral
相关: probability-axioms
alias: 测度, 零测集, 可测集, 外测度, σ-代数

把“长度”推广到尽可能多的集合：外测度 $m^*(E)=\inf\left\{\sum\abs{I_k}: E\subseteq\bigcup I_k\right\}$（用可数个开区间覆盖）。满足卡拉泰奥多里条件的集合称为可测集，它们构成 $\sigma$-代数，在其上 $m^*$ 是可数可加的。

### 例题
- 任何可数集是零测集：$\Q$ 的第 $k$ 个元素用长 $\frac\eps{2^k}$ 的区间盖住，总长 $\le\eps$。
- [[cantor-set]] 不可数，但测度为零。

### 注记
在选择公理下存在不可测集（维塔利集），所以测度不能定义在 $\R$ 的全部子集上。概率论正是建立在测度论上：概率是总测度为 $1$ 的测度（柯尔莫哥洛夫，1933）。

## 勒贝格积分 {#lebesgue-integral}
type: 定义 | en: Lebesgue integral | w: 3 | level: ext
前置: lebesgue-measure
源于: riemann-integral
后续: dominated-convergence, lp-spaces
alias: 勒贝格积分, 简单函数, 可测函数

黎曼积分分割定义域，勒贝格积分分割值域：对非负可测函数，用简单函数 $\sum c_k\mathbf 1_{E_k}$ 从下逼近，积分定义为 $\sup\sum c_km(E_k)$。

### 直观
勒贝格本人的比喻：要数一堆硬币的总钱数，黎曼的办法是按拿到的顺序逐个相加；勒贝格的办法是先按面值分堆（$f$ 取值相近的点归为一组），每堆数个数（测度）乘以面值，再相加。

### 例题
狄利克雷函数 $\mathbf 1_\Q$ 在 $[0,1]$ 上黎曼不可积，但勒贝格积分 $=1\cdot m(\Q\cap[0,1])+0\cdot m(\text{无理数})=0$。

### 注记
黎曼可积函数都勒贝格可积且积分相同。勒贝格积分的优势在于极限定理：积分与极限可以在很宽松的条件下交换。

## 控制收敛定理 {#dominated-convergence}
type: 定理 | en: Dominated convergence theorem | w: 3 | level: ext
前置: lebesgue-integral
源于: uniform-limit-theorems
alias: 勒贝格控制收敛定理, 单调收敛定理, 法图引理

若可测函数 $f_n\to f$ 几乎处处成立，且存在可积函数 $g$ 使 $\abs{f_n}\le g$，则
$$\lim_{n\to\infty}\int f_n=\int f.$$

### 注记
与黎曼积分要求的一致收敛相比，这里只需要逐点收敛加一个“控制函数”。反例 $f_n=n\mathbf 1_{(0,1/n)}$：逐点趋于 $0$，积分恒为 $1$——它没有可积的控制函数。

## Lᵖ 空间 {#lp-spaces}
type: 概念 | en: Lp spaces | w: 2 | level: ext
前置: lebesgue-integral, holder-inequality
推广为: hilbert-space
alias: Lp 空间, 范数, 赫尔德不等式, 闵可夫斯基不等式

$L^p$（$1\le p<\infty$）是满足 $\int\abs f^p<\infty$ 的可测函数（几乎处处相等者视为同一个）构成的空间，范数 $\norm f_p=\left(\int\abs f^p\right)^{1/p}$。它们是完备的赋范空间（里斯–费舍尔定理）。

### 注记
闵可夫斯基不等式就是 $L^p$ 范数的三角不等式；只有 $p=2$ 时范数来自内积，$L^2$ 是希尔伯特空间，傅里叶级数在 $L^2$ 中收敛。

## 希尔伯特空间 {#hilbert-space}
type: 概念 | en: Hilbert space | w: 3 | level: ext
源于: inner-product-space
前置: lp-spaces, cauchy-criterion
应用于: schrodinger-equation
alias: 完备内积空间, 无穷维, 正交展开

完备的内积空间。在希尔伯特空间中，几何直觉几乎完全保留：有正交投影、正交补、规范正交基，每个向量可以展开为 $x=\sum\inner x{e_n}e_n$，并满足帕塞瓦尔等式 $\norm x^2=\sum\abs{\inner x{e_n}}^2$。

### 例题
$L^2[-\pi,\pi]$ 中 $\left\{\frac{\ee^{\ii nx}}{\sqrt{2\pi}}\right\}_{n\in\Z}$ 是规范正交基，傅里叶级数就是在这组基下的展开。

### 应用
量子力学的态空间是希尔伯特空间，可观测量是自伴算子，测量结果是其谱——有限维的 [[spectral-theorem]] 在这里得到无穷维推广。
