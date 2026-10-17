---
galaxy: analysis
cluster: variational
title: 变分法与偏微分方程入门
en: Calculus of variations and PDE
order: 15
level: ext
---

## 变分法 {#calculus-of-variations}
type: 方法 | en: Calculus of variations | w: 3 | level: ext
前置: lagrange-multiplier, integration-techniques
例子: brachistochrone
应用于: least-action
alias: 欧拉-拉格朗日方程, 泛函极值, 变分

求函数 $y(x)$ 使泛函 $J[y]=\int_a^bL(x,y,y')\,\dd x$ 取极值（端点固定）。极值函数满足欧拉–拉格朗日方程
$$\frac{\partial L}{\partial y}-\frac{\dd}{\dd x}\frac{\partial L}{\partial y'}=0.$$

### 推导
令 $y_\eps=y+\eps\eta$，$\eta(a)=\eta(b)=0$。$\frac{\dd}{\dd\eps}J[y_\eps]\Big|_{\eps=0}=\int\left(L_y\eta+L_{y'}\eta'\right)\dd x=\int\left(L_y-\frac{\dd}{\dd x}L_{y'}\right)\eta\,\dd x=0$（分部积分）对一切 $\eta$ 成立，由变分法基本引理被积式为零。

### 例题
两点间最短的曲线：$L=\sqrt{1+y'^2}$，方程给出 $\frac{y'}{\sqrt{1+y'^2}}=$ 常数，即 $y'$ 为常数——直线。

## 最速降线 {#brachistochrone}
type: 问题 | en: Brachistochrone problem | w: 3 | level: ext
前置: calculus-of-variations, energy-conservation
相关: cycloid
alias: 最速降线问题, 摆线, 约翰·伯努利

质点在重力作用下无摩擦地从 $A$ 滑到较低的 $B$，沿什么曲线用时最短？答案不是直线，而是摆线。

### 解
由能量守恒 $v=\sqrt{2gy}$（$y$ 向下为正），时间 $T=\int\frac{\sqrt{1+y'^2}}{\sqrt{2gy}}\dd x$。$L$ 不显含 $x$，有首次积分 $L-y'L_{y'}=$ 常数，化简为 $y(1+y'^2)=C$，其参数解为摆线 $x=r(\theta-\sin\theta)$，$y=r(1-\cos\theta)$。

### 注记
1696 年约翰·伯努利公开征解，牛顿、莱布尼茨、雅各布·伯努利、洛必达都给出了答案，变分法由此诞生。约翰·伯努利的解法很巧妙：把它类比为光在折射率连续变化的介质中按 [[fermat-principle]] 传播。摆线还是等时曲线：从摆线上任何位置释放，到达底部的时间相同。

## 波动方程 {#wave-equation}
type: 方程 | en: Wave equation | w: 3 | level: ext
前置: partial-derivative, fourier-series
应用于: mechanical-wave, electromagnetic-waves, standing-waves
alias: 弦振动方程, 达朗贝尔公式, 一维波动方程

$$\frac{\partial^2u}{\partial t^2}=c^2\frac{\partial^2u}{\partial x^2}.$$
达朗贝尔通解 $u=F(x-ct)+G(x+ct)$：任意形状的波以速度 $c$ 分别向右、向左传播而不变形。

### 推导
张紧的弦，张力 $T$、线密度 $\rho$，小振动时一小段弦受到的竖直合力约为 $T\frac{\partial^2u}{\partial x^2}\dd x$，由牛顿第二定律得 $c=\sqrt{T/\rho}$。

### 应用
两端固定的弦（长 $l$）用分离变量得驻波 $\sin\frac{n\pi x}l\cos\frac{n\pi ct}l$，频率是基频的整数倍——这就是乐器泛音列的来源；麦克斯韦方程组推出电磁场满足波动方程，波速正是光速。

## 最小作用量原理 {#least-action}
type: 原理 | en: Principle of least action | w: 3 | level: ext
前置: calculus-of-variations, kinetic-energy-theorem
推出: symmetry-conservation
相关: fermat-principle
alias: 哈密顿原理, 拉格朗日力学, 作用量

真实运动使作用量 $S=\int_{t_1}^{t_2}(T-V)\,\dd t$ 取驻值。拉格朗日量 $L=T-V$ 的欧拉–拉格朗日方程就是运动方程。

### 例题
质点在势场中：$L=\frac12m\dot x^2-V(x)$，方程 $\frac{\dd}{\dd t}(m\dot x)=-V'(x)$，即牛顿第二定律。

### 注记
拉格朗日表述的优势在于可以使用任意广义坐标（如单摆的角度），约束力自动消失。光学中的 [[fermat-principle]]、力学中的最小作用量原理、量子力学中的路径积分，是同一思想在不同领域的体现。
