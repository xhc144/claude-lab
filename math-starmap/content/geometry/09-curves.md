---
galaxy: geometry
cluster: curves
title: 曲线微分几何
en: Differential geometry of curves
order: 9
level: core
---

## 参数曲线 {#parametric-curve}
type: 定义 | en: Parametrized curves | w: 4 | 考纲: 参数曲线, 向量方法与几何直观的结合
前置: parametric-equations, derivative
后续: arc-length, curvature, line-integral
alias: 参数曲线, 正则曲线, 速度向量, 切向量, 重新参数化

映射 $\vv r:I\to\R^n$，$t\mapsto\vv r(t)$。$\vv r'(t)$ 是速度向量（切向量），处处 $\vv r'(t)\ne\vv0$ 的曲线称为正则曲线。同一条几何曲线可以有许多参数化，几何量（弧长、曲率）不应依赖于参数的选取。

### 例题
圆 $\vv r(t)=(\cos t,\sin t)$ 与 $\vv r(t)=(\cos2t,\sin2t)$ 是同一个圆的两种参数化，速度不同；$(t^2,t^3)$ 在 $t=0$ 处 $\vv r'=\vv0$，曲线有一个尖点——非正则点处曲线可以“拐死弯”。

### 注记
参数曲线把运动学和几何结合在一起：$\vv r(t)$ 是位置，$\vv r'$ 是速度，$\vv r''$ 是加速度。

## 弧长 {#arc-length}
type: 定义 | en: Arc length | w: 4 | 考纲: 弧长
前置: parametric-curve, integral-apps
后续: curvature, line-integral
alias: 弧长, 弧长参数, 自然参数, 曲线长度

曲线从 $t=a$ 到 $t=b$ 的弧长
$$s=\int_a^b\norm{\vv r'(t)}\,\dd t.$$
它是内接折线长度的上确界，不依赖于参数化。以弧长 $s$ 为参数时 $\norm{\vv r'(s)}=1$——曲线以单位速率被描出，称为弧长参数化。

### 例题
摆线一拱 $\vv r=(t-\sin t,1-\cos t)$，$t\in[0,2\pi]$：$\norm{\vv r'}=\sqrt{2-2\cos t}=2\sin\frac t2$，弧长 $=\int_0^{2\pi}2\sin\frac t2\,\dd t=8$（是生成圆半径的 $8$ 倍，由雷恩在 1658 年发现）。

### 注记
椭圆的周长不能用初等函数表示，导致了椭圆积分与椭圆函数的研究。

## 曲率 {#curvature}
type: 定义 | en: Curvature | w: 5 | 考纲: 曲率
前置: arc-length, second-derivative-geometry
后续: osculating-circle, frenet-frame, gaussian-curvature
anim: curvature
alias: 曲率, 曲率半径, 弯曲程度, 平面曲线曲率公式

曲率衡量曲线偏离直线的快慢：单位切向量 $\vv T$ 关于弧长的转动速率 $\kappa=\norm{\dfrac{\dd\vv T}{\dd s}}$。平面曲线上，$\kappa=\abs{\dfrac{\dd\theta}{\dd s}}$，$\theta$ 是切线的倾角。
$$\kappa=\frac{\abs{x'y''-x''y'}}{(x'^2+y'^2)^{3/2}},\qquad y=f(x)\text{ 时 }\kappa=\frac{\abs{f''}}{(1+f'^2)^{3/2}}.$$
空间曲线 $\kappa=\dfrac{\norm{\vv r'\times\vv r''}}{\norm{\vv r'}^3}$。

### 例题
半径 $R$ 的圆曲率为 $\frac1R$：越小的圆越弯。抛物线 $y=x^2$ 在顶点处 $\kappa=2$，曲率半径 $\frac12$。直线曲率为 $0$。

### 推导
平面曲线 $\tan\theta=\frac{y'}{x'}$，对 $t$ 求导得 $\theta'=\frac{x'y''-x''y'}{x'^2+y'^2}$，再除以 $\frac{\dd s}{\dd t}=\sqrt{x'^2+y'^2}$。

### 应用
公路与铁路弯道设计（缓和曲线：曲率从零线性增大，即回旋线）；向心加速度 $a=\kappa v^2$——同样速度下，弯道越急（曲率越大）离心效应越强。

## 二阶导数的几何意义 {#second-derivative-geometry}
type: 性质 | en: Geometric meaning of the second derivative | w: 2 | 考纲: 曲率, 单变量微积分
前置: convex-function
后续: curvature
alias: 凹凸与弯曲, 二阶导数

二阶导数 $f''$ 描述切线斜率的变化快慢：$f''>0$ 时曲线向上弯（凸），$f''<0$ 时向下弯。但 $f''$ 本身不是“弯曲程度”的几何度量——它依赖于坐标轴的选取；把它按弧长归一化，得到真正的几何量曲率 $\kappa=\frac{\abs{f''}}{(1+f'^2)^{3/2}}$。

### 例题
$y=x^3$ 在 $x=10$ 处 $f''=60$ 很大，但曲线几乎竖直（$f'=300$），曲率只有约 $2.2\times10^{-6}$：在弧长尺度上它几乎是直的。

## 密切圆 {#osculating-circle}
type: 定义 | en: Osculating circle | w: 3 | 考纲: 曲率
前置: curvature
后续: evolute
anim: curvature
alias: 曲率圆, 曲率中心, 曲率半径

在曲线上一点，与曲线有相同切线、相同曲率且位于弯曲一侧的圆，半径 $\rho=\frac1\kappa$，圆心是曲率中心。它是该点附近对曲线最好的圆近似（与曲线有二阶接触）。

### 直观
开车经过弯道时，若方向盘保持此刻的转角不动，汽车将沿密切圆行驶。

## 渐屈线与渐伸线 {#evolute}
type: 例子 | en: Evolutes and involutes | w: 2 | 考纲: 曲率
前置: osculating-circle
相关: cycloid
alias: 渐屈线, 渐伸线, 惠更斯摆钟

曲率中心的轨迹叫渐屈线；把绷紧的线从曲线上展开时线端点的轨迹叫渐伸线，二者互逆。

### 例题
摆线的渐屈线是一条全等的摆线（平移半个周期）。惠更斯利用这一点设计了摆线摆钟：让摆线在两片摆线形夹板之间摆动，摆锤走出摆线，从而周期与振幅无关（等时性）。

## 摆线 {#cycloid}
type: 例子 | en: Cycloid | w: 3 | 考纲: 参数曲线, 弧长
前置: parametric-equations
是例子: parametric-curve
相关: brachistochrone
alias: 旋轮线, 摆线, 等时曲线, 最速降线

圆在直线上无滑动地滚动时，圆周上一点的轨迹：$x=r(t-\sin t)$，$y=r(1-\cos t)$。

### 性质
- 一拱的弧长为 $8r$，与直线围成的面积为 $3\pi r^2$（滚动圆面积的 $3$ 倍）；
- 倒置的摆线是最速降线（[[brachistochrone]]）与等时曲线（[[evolute]]）。

### 注记
摆线因性质优美、又引起过许多优先权之争，被称为“几何学中的海伦”。

## 弗雷内标架与挠率 {#frenet-frame}
type: 定理 | en: Frenet–Serret frame and torsion | w: 3 | 考纲: 曲率, 向量方法与几何直观的结合
前置: curvature, cross-product
alias: 弗雷内公式, 挠率, 切向量, 主法向量, 副法向量, 螺旋线

空间曲线上每点有正交标架：切向量 $\vv T$、主法向量 $\vv N=\frac{\vv T'}{\norm{\vv T'}}$、副法向量 $\vv B=\vv T\times\vv N$。它们沿弧长的变化由弗雷内公式给出：
$$\vv T'=\kappa\vv N,\qquad\vv N'=-\kappa\vv T+\tau\vv B,\qquad\vv B'=-\tau\vv N.$$
挠率 $\tau$ 衡量曲线离开密切平面（$\vv T,\vv N$ 张成）的速度。

### 例题
圆柱螺线 $(a\cos t,a\sin t,bt)$：曲率 $\kappa=\frac a{a^2+b^2}$、挠率 $\tau=\frac b{a^2+b^2}$ 都是常数。DNA 双螺旋、弹簧都近似于它。

### 定理（曲线论基本定理）
给定连续函数 $\kappa(s)>0$ 与 $\tau(s)$，存在以它们为曲率与挠率的曲线，且在刚体运动意义下唯一：曲率和挠率完全决定了曲线的形状。平面曲线 $\tau\equiv0$。
