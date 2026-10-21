---
galaxy: analysis
cluster: differential
title: 导数与微分
en: Differentiation
order: 3
level: core
---

## 可导与可微 {#differentiability}
type: 定义 | en: Differentiability | w: 4 | 考纲: 单变量微积分
前置: derivative, continuity
后续: differential, fermat-lemma
推广为: total-differential
alias: 可微, 可导, 线性近似, 单侧导数

$f$ 在 $x_0$ 可微，指存在常数 $A$ 使 $f(x_0+h)-f(x_0)=Ah+o(h)$：函数的增量可以被一个线性函数逼近到高阶无穷小。一元函数可微 $\iff$ 可导，且 $A=f'(x_0)$。

### 证明
若可导，$\frac{f(x_0+h)-f(x_0)}h-f'(x_0)\to0$，即余项是 $o(h)$。反之，若 $f(x_0+h)-f(x_0)=Ah+o(h)$，两边除以 $h$ 取极限得 $f'(x_0)=A$。可导蕴含连续：$f(x_0+h)-f(x_0)=Ah+o(h)\to0$。

### 注记
多元函数中，“可微”（存在线性逼近）严格强于“偏导数存在”，见 [[total-differential]]。“可微 = 局部像线性映射”这一观点在高维里才显出威力。

## 微分 {#differential}
type: 概念 | en: Differential | w: 3 | 考纲: 单变量微积分
前置: differentiability
后续: antiderivative
alias: dy, 微分形式不变性, 线性主部

$\dd y=f'(x)\,\dd x$ 是增量 $\Delta y$ 的线性主部。一阶微分形式不变：无论 $x$ 是自变量还是中间变量，$\dd y=f'(u)\,\dd u$ 都成立——这就是链式法则，也是换元积分法能“机械地”进行的原因。

### 例题
用微分估算 $\sqrt{4.02}$：$f(x)=\sqrt x$，$f'(4)=\frac14$，$\sqrt{4.02}\approx2+\frac14\times0.02=2.005$（真值 $2.004994\cdots$）。

### 应用
误差估计：测得 $x$ 有误差 $\Delta x$，则 $y=f(x)$ 的误差约为 $\abs{f'(x)}\Delta x$，见 [[error-propagation]]。

## 链式法则 {#chain-rule}
type: 定理 | en: Chain rule | w: 5 | 考纲: 单变量微积分
前置: derivative-rules, composite-function
推广为: multivar-chain-rule
后续: inverse-derivative, integration-techniques
alias: 复合函数求导

若 $u=g(x)$ 在 $x$ 可导，$y=f(u)$ 在 $u=g(x)$ 可导，则 $(f\circ g)'(x)=f'(g(x))\,g'(x)$，即 $\dfrac{\dd y}{\dd x}=\dfrac{\dd y}{\dd u}\cdot\dfrac{\dd u}{\dd x}$。

### 证明
用可微形式避免除以零：$f(u+k)-f(u)=\left(f'(u)+\alpha(k)\right)k$，其中 $\alpha(k)\to0$（$k\to0$），并补充定义 $\alpha(0)=0$。取 $k=g(x+h)-g(x)$，则
$$\frac{f(g(x+h))-f(g(x))}h=\left(f'(g(x))+\alpha(k)\right)\frac{g(x+h)-g(x)}h\to f'(g(x))g'(x).$$
直接写成 $\frac{\Delta y}{\Delta u}\cdot\frac{\Delta u}{\Delta x}$ 的证法在 $\Delta u=0$ 时有漏洞。

### 例题
$(\ee^{\sin x^2})'=\ee^{\sin x^2}\cdot\cos x^2\cdot2x$：由外到内逐层求导再相乘。

## 反函数与隐函数求导 {#inverse-derivative}
type: 公式 | en: Derivatives of inverse and implicit functions | w: 3 | 考纲: 单变量微积分
前置: chain-rule, inverse-function
推广为: implicit-function-theorem
alias: 反函数求导, 隐函数求导, 参数方程求导, 对数求导法

- 反函数：$(f^{-1})'(y)=\dfrac1{f'(x)}$，$y=f(x)$，$f'(x)\ne0$。例如 $(\arcsin y)'=\frac1{\cos x}=\frac1{\sqrt{1-y^2}}$。
- 隐函数：对 $F(x,y)=0$ 两边关于 $x$ 求导，把 $y$ 看成 $x$ 的函数，解出 $y'$。
- 参数方程 $x=\varphi(t),\ y=\psi(t)$：$\dfrac{\dd y}{\dd x}=\dfrac{\psi'(t)}{\varphi'(t)}$。

### 例题
求圆 $x^2+y^2=25$ 在 $(3,4)$ 处的切线斜率：$2x+2yy'=0$，$y'=-\frac xy=-\frac34$。
对数求导：$y=x^x$，$\ln y=x\ln x$，$\frac{y'}y=\ln x+1$，$y'=x^x(\ln x+1)$。

## 高阶导数与莱布尼茨公式 {#higher-derivatives}
type: 公式 | en: Higher derivatives and Leibniz rule | w: 3 | 考纲: 单变量微积分
前置: derivative-rules
后续: taylor-theorem
相关: binomial-theorem
alias: n阶导数, 莱布尼茨公式

$$(uv)^{(n)}=\sum_{k=0}^n\binom nk u^{(k)}v^{(n-k)},$$
形式与二项式定理完全相同。常用：$(\sin x)^{(n)}=\sin\left(x+\frac{n\pi}2\right)$，$\left(\frac1{1+x}\right)^{(n)}=\frac{(-1)^nn!}{(1+x)^{n+1}}$。

### 例题
求 $(x^2\ee^x)^{(20)}$：只有 $k=0,1,2$ 的项非零（$x^2$ 三阶导数为零），
$$=x^2\ee^x+20\cdot2x\ee^x+\binom{20}2\cdot2\ee^x=(x^2+40x+380)\ee^x.$$

### 注记
二阶导数的物理意义是加速度，几何意义是凹凸性；高阶导数在 $0$ 处的值决定泰勒展开的系数。

## 导函数的介值性 {#darboux-theorem}
type: 定理 | en: Darboux's theorem | w: 2 | 考纲: 单变量微积分
前置: fermat-lemma, extreme-value-theorem
alias: 达布定理

若 $f$ 在 $[a,b]$ 上可导，则 $f'$ 取遍 $f'(a)$ 与 $f'(b)$ 之间的一切值——即使 $f'$ 不连续。因此导函数不可能有跳跃间断点。

### 证明
设 $f'(a)<c<f'(b)$，令 $g(x)=f(x)-cx$，则 $g'(a)<0<g'(b)$。$g$ 在 $[a,b]$ 上连续，有最小值点 $\xi$；由 $g'(a)<0$，$a$ 附近右侧有更小的值，所以 $\xi\ne a$；同理 $\xi\ne b$。由 [[fermat-lemma]]，$g'(\xi)=0$，即 $f'(\xi)=c$。

### 例题
$f(x)=x^2\sin\frac1x$（$x\ne0$），$f(0)=0$ 处处可导，$f'(0)=0$，但 $f'(x)=2x\sin\frac1x-\cos\frac1x$ 在 $0$ 处振荡间断——导函数可以不连续，但不会跳跃。

## 处处连续处处不可导的函数 {#weierstrass-function}
type: 反例 | en: Weierstrass function | w: 2 | level: ext
前置: uniform-convergence, differentiability
相关: fourier-series
alias: 魏尔斯特拉斯函数, 病态函数, 分形曲线

1872 年魏尔斯特拉斯给出 $W(x)=\sum_{n=0}^\infty a^n\cos(b^n\pi x)$（$0<a<1$，$b$ 为正奇数，$ab>1+\frac32\pi$），它处处连续却处处不可导。这推翻了“连续函数除个别点外都可导”的流行直觉。

### 为什么连续
$\abs{a^n\cos(b^n\pi x)}\le a^n$，由 [[weierstrass-m-test]] 级数一致收敛，连续函数的一致极限仍连续。

### 为什么不可导（直观）
第 $n$ 项振幅 $a^n$、波长约 $b^{-n}$，斜率量级 $(ab)^n\to\infty$。高频项越来越陡，叠加出无穷精细的锯齿：放大任何一小段，看到的仍是锯齿——这是分形的雏形。

### 注记
从贝尔纲定理可知，在连续函数空间中“处处不可导”的函数反而是“典型”的；布朗运动的路径也几乎必然处处不可导。
