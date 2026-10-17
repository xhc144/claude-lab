---
galaxy: analysis
cluster: fourier
title: 傅里叶级数
en: Fourier series
order: 8
level: core
---

## 三角函数系的正交性 {#trig-orthogonality}
type: 性质 | en: Orthogonality of the trigonometric system | w: 3 | 考纲: 傅立叶级数
前置: integration-techniques, double-angle-formulas
后续: fourier-series
类比: orthonormal-basis
alias: 正交函数系, 三角函数系

在 $[-\pi,\pi]$ 上，$1,\cos x,\sin x,\cos2x,\sin2x,\dots$ 两两正交：
$$\int_{-\pi}^\pi\cos mx\cos nx\,\dd x=\int_{-\pi}^\pi\sin mx\sin nx\,\dd x=\pi\delta_{mn}\ (m,n\ge1),\qquad \int_{-\pi}^\pi\cos mx\sin nx\,\dd x=0.$$

### 证明
积化和差：$\cos mx\cos nx=\frac12[\cos(m-n)x+\cos(m+n)x]$，而 $\int_{-\pi}^\pi\cos kx\,\dd x=0$（$k\ne0$）。

### 直观
把函数看作无穷维空间中的向量，内积 $\inner fg=\int_{-\pi}^\pi fg$。三角函数系就是这个空间的一组正交“坐标轴”，傅里叶系数就是投影坐标。

## 傅里叶级数 {#fourier-series}
type: 定义 | en: Fourier series | w: 5 | 考纲: 傅立叶级数
前置: trig-orthogonality, series, parity
源于: sinusoid
后续: dirichlet-convergence, parseval-identity, gibbs-phenomenon
推广为: fourier-transform
alias: 傅立叶级数, Fourier 级数, 傅里叶系数, 频谱
anim: fourier-series
tags: 傅里叶

以 $2\pi$ 为周期的函数 $f$ 展开为
$$f(x)\sim\frac{a_0}2+\sum_{n=1}^\infty(a_n\cos nx+b_n\sin nx),\quad a_n=\frac1\pi\int_{-\pi}^\pi f(x)\cos nx\,\dd x,\ b_n=\frac1\pi\int_{-\pi}^\pi f(x)\sin nx\,\dd x.$$
复数形式：$f\sim\sum_{n\in\Z}c_n\ee^{\ii nx}$，$c_n=\frac1{2\pi}\int_{-\pi}^\pi f(x)\ee^{-\ii nx}\dd x$。

### 直观
任何周期信号都是一系列频率为整数倍的纯音的叠加。$a_n,b_n$ 告诉我们每个频率的“音量”：小提琴与长笛奏同一个音，基频相同，泛音系数不同，所以音色不同。

### 例题
方波 $f(x)=\sgn x$（$-\pi<x<\pi$）是奇函数，$a_n=0$，
$$b_n=\frac2\pi\int_0^\pi\sin nx\,\dd x=\frac{2(1-(-1)^n)}{n\pi},\qquad f(x)\sim\frac4\pi\left(\sin x+\frac{\sin3x}3+\frac{\sin5x}5+\cdots\right).$$
取 $x=\frac\pi2$ 得莱布尼茨级数 $1-\frac13+\frac15-\cdots=\frac\pi4$。

### 注记
“$\sim$”而不是“$=$”：系数总能算出来，但级数是否收敛、收敛到什么，是需要单独回答的问题（[[dirichlet-convergence]]）。周期为 $2l$ 时把 $x$ 换成 $\frac{\pi x}l$。

## 狄利克雷收敛定理 {#dirichlet-convergence}
type: 定理 | en: Dirichlet's convergence theorem | w: 4 | 考纲: 傅立叶级数
前置: fourier-series
alias: 收敛定理, 狄利克雷核, 分段光滑

若 $f$ 以 $2\pi$ 为周期、在一个周期内分段光滑（有限个第一类间断点，各段上导数分段连续），则傅里叶级数在每一点收敛于
$$\frac{f(x^+)+f(x^-)}2,$$
在连续点即收敛于 $f(x)$。

### 证明思路
部分和可写成与狄利克雷核的卷积 $S_n(x)=\frac1{2\pi}\int_{-\pi}^\pi f(x+t)D_n(t)\,\dd t$，$D_n(t)=\dfrac{\sin\left(n+\frac12\right)t}{\sin\frac t2}$。在 $t=0$ 附近把 $f(x+t)$ 换成单侧极限后，余下部分由黎曼–勒贝格引理（$\int g(t)\sin\lambda t\,\dd t\to0$，$\lambda\to\infty$）趋于零。

### 注记
仅连续不够：存在连续函数，其傅里叶级数在某点发散（杜布瓦–雷蒙，1876）。但卡尔松定理（1966）说明平方可积函数的傅里叶级数几乎处处收敛。

## 吉布斯现象 {#gibbs-phenomenon}
type: 现象 | en: Gibbs phenomenon | w: 3 | 考纲: 傅立叶级数
前置: dirichlet-convergence
anim: fourier-series
alias: 过冲, 振铃

在跳跃间断点附近，傅里叶部分和总会“冲过头”约跳跃高度的 $9\%$，并且无论取多少项，这个过冲都不会消失，只是越来越窄地挤向间断点。

### 例题
方波（从 $-1$ 跳到 $1$，跳跃高度 $2$）的部分和最大值趋于 $\frac2\pi\int_0^\pi\frac{\sin t}t\dd t\approx1.179$，比 $1$ 多出 $0.179$，约为跳跃的 $8.95\%$。

### 注记
这说明部分和在间断点附近不一致收敛（极限函数不连续时也不可能一致收敛）。图像压缩中的“振铃伪影”正是吉布斯现象。用 [[fejer-theorem|费耶尔平均]] 可以消除过冲。

## 帕塞瓦尔恒等式 {#parseval-identity}
type: 定理 | en: Parseval's identity | w: 4 | 考纲: 傅立叶级数
前置: fourier-series
类比: pythagorean
推出: basel-problem
alias: Parseval 等式, 贝塞尔不等式, 能量守恒, 勾股定理的无穷维版本

若 $f$ 在 $[-\pi,\pi]$ 上平方可积，则
$$\frac1\pi\int_{-\pi}^\pi f(x)^2\,\dd x=\frac{a_0^2}2+\sum_{n=1}^\infty\left(a_n^2+b_n^2\right).$$

### 直观
无穷维空间里的勾股定理：向量长度的平方等于各坐标平方和。物理上，信号的总能量等于各频率分量能量之和。

### 证明思路
先由正交性得贝塞尔不等式 $\frac{a_0^2}2+\sum_{n\le N}(a_n^2+b_n^2)\le\frac1\pi\int f^2$（部分和是到前 $N$ 个频率张成子空间的正交投影）。再用三角多项式在平方平均意义下逼近 $f$ 的稠密性（[[fejer-theorem]] 或魏尔斯特拉斯定理），推出等号。

### 应用
$f(x)=x$ 给出 $\sum\frac1{n^2}=\frac{\pi^2}6$（[[basel-problem]]）；$f(x)=x^2$ 给出 $\sum\frac1{n^4}=\frac{\pi^4}{90}$。

## 费耶尔定理 {#fejer-theorem}
type: 定理 | en: Fejér's theorem | w: 2 | 考纲: 傅立叶级数
前置: dirichlet-convergence, stolz-theorem
alias: 切萨罗求和, 费耶尔核, Cesàro 平均

连续周期函数的傅里叶部分和的算术平均 $\sigma_N=\frac{S_0+\cdots+S_{N-1}}N$ 一致收敛到 $f$。部分和本身可能不收敛，平均之后一定收敛。

### 证明思路
$\sigma_N=f*F_N$，费耶尔核 $F_N(t)=\frac1N\left(\frac{\sin(Nt/2)}{\sin(t/2)}\right)^2\ge0$，积分平均为 $1$，并且质量向 $0$ 集中——它是一个“好核”（逼近恒等）。正性是关键：狄利克雷核会取负值，费耶尔核不会。

### 推论
三角多项式在连续周期函数中一致稠密，这推出了帕塞瓦尔恒等式和傅里叶系数的唯一性：两个连续函数傅里叶系数全部相同，则它们相等。

## 傅里叶变换 {#fourier-transform}
type: 定义 | en: Fourier transform | w: 4 | level: ext
前置: improper-integral, fourier-series
后续: fft, uncertainty-principle
alias: 傅立叶变换, 频域, 卷积定理, 傅里叶反演

周期 $\to\infty$ 时，离散频率变成连续频率，级数变成积分：
$$\hat f(\xi)=\int_{-\infty}^{+\infty}f(x)\ee^{-2\pi\ii x\xi}\dd x,\qquad f(x)=\int_{-\infty}^{+\infty}\hat f(\xi)\ee^{2\pi\ii x\xi}\dd\xi.$$

### 性质
- 卷积定理：$\widehat{f*g}=\hat f\,\hat g$，卷积在频域变成乘法；
- 微分变乘法：$\widehat{f'}(\xi)=2\pi\ii\xi\hat f(\xi)$，所以常系数线性微分方程在频域变成代数方程；
- 高斯函数 $\ee^{-\pi x^2}$ 的傅里叶变换是它自己；
- 不确定性：$f$ 越集中，$\hat f$ 越分散（$\Delta x\,\Delta\xi\ge\frac1{4\pi}$），这正是量子力学的 [[uncertainty-principle]]。

## 热传导方程 {#heat-equation}
type: 应用 | en: Heat equation | w: 3 | level: ext
前置: fourier-series, partial-derivative
相关: wave-equation
alias: 热方程, 分离变量法, 傅里叶的热分析

傅里叶研究热传导时发明了傅里叶级数。细杆 $[0,\pi]$ 两端温度保持 $0$，温度 $u(x,t)$ 满足
$$\frac{\partial u}{\partial t}=k\frac{\partial^2u}{\partial x^2},\quad u(0,t)=u(\pi,t)=0,\quad u(x,0)=f(x).$$

### 解法（分离变量）
设 $u=X(x)T(t)$，得 $\frac{T'}{kT}=\frac{X''}X=-\lambda$。边界条件给出 $X_n=\sin nx$，$\lambda=n^2$，$T_n=\ee^{-kn^2t}$。叠加：
$$u(x,t)=\sum_{n=1}^\infty b_n\ee^{-kn^2t}\sin nx,\qquad b_n=\frac2\pi\int_0^\pi f(x)\sin nx\,\dd x.$$

### 直观
每个频率分量独立地指数衰减，频率越高衰减越快（$\ee^{-kn^2t}$）：尖锐的温度起伏最先被抹平，温度分布迅速变得光滑。

## 等周不等式 {#isoperimetric-inequality}
type: 不等式 | en: Isoperimetric inequality | w: 3 | level: ext
前置: parseval-identity, arc-length
应用于: inequality-extremum
alias: 等周问题, 狄多问题, 周长一定面积最大

平面上周长为 $L$ 的简单闭曲线围成的面积 $A$ 满足 $4\pi A\le L^2$，等号当且仅当曲线是圆。

### 证明（赫尔维茨，傅里叶级数）
设 $L=2\pi$，以弧长为参数，曲线 $(x(s),y(s))$ 满足 $x'^2+y'^2=1$。由帕塞瓦尔，
$$2\pi=\int_0^{2\pi}(x'^2+y'^2)\dd s=\pi\sum n^2(a_n^2+b_n^2+c_n^2+d_n^2),\quad A=\int_0^{2\pi}xy'\,\dd s=\pi\sum n(a_nd_n-b_nc_n).$$
于是 $2\pi-2A=\pi\sum\left[(na_n-d_n)^2+(nb_n+c_n)^2+(n^2-1)(c_n^2+d_n^2)\right]\ge0$，即 $A\le\pi$；等号要求 $n\ge2$ 的系数都为零，曲线是圆。

### 注记
这里 $x\sim\sum(a_n\cos ns+b_n\sin ns)$、$y\sim\sum(c_n\cos ns+d_n\sin ns)$。
