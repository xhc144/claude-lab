---
galaxy: hs
cluster: hs-trig
title: 三角函数与解三角形
en: Trigonometry
order: 4
level: hs
---

## 弧度制 {#radian}
type: 概念 | en: Radian | w: 3 | 考纲: 中学数学全部内容
后续: trig-functions
alias: 弧度, 角度制, 任意角

把角的大小定义为它在单位圆上截出的弧长：$1$ 弧度是弧长等于半径时的圆心角，$\pi\ \text{rad}=180^\circ$。弧长 $l=\abs\alpha r$，扇形面积 $S=\frac12\abs\alpha r^2=\frac12lr$。

### 为什么用弧度
只有用弧度，$\displaystyle\lim_{x\to0}\frac{\sin x}x=1$ 才成立，从而 $(\sin x)'=\cos x$ 没有多余的常数（用角度制会多出因子 $\frac\pi{180}$）。微积分、傅里叶分析、物理中的角频率都默认弧度。

## 任意角的三角函数 {#trig-functions}
type: 定义 | en: Trigonometric functions | w: 5 | 考纲: 中学数学全部内容
前置: radian, function
后续: trig-basic-identities, sinusoid, complex-polar-form
例子: periodicity
anim: unit-circle
alias: 正弦, 余弦, 正切, 单位圆, sin, cos, tan
tags: 三角函数

设角 $\alpha$ 的终边与单位圆交于 $P(x,y)$，定义 $\sin\alpha=y$，$\cos\alpha=x$，$\tan\alpha=\frac yx$（$x\ne0$）。这样三角函数对任意实数角都有定义，周期分别为 $2\pi,2\pi,\pi$。

### 直观
让点沿单位圆匀速转动：它的纵坐标随时间画出正弦曲线，横坐标画出余弦曲线。三角函数就是“圆周运动的投影”，因此它们描述一切周期现象。

### 注记
- 各象限符号：“一全正、二正弦、三正切、四余弦”。
- 特殊角：$\sin\frac\pi6=\frac12$，$\sin\frac\pi4=\frac{\sqrt2}2$，$\sin\frac\pi3=\frac{\sqrt3}2$。
- 在复平面上，$\cos\alpha+\ii\sin\alpha$ 就是单位圆上的点，见 [[euler-formula]]。

## 同角关系与诱导公式 {#trig-basic-identities}
type: 公式 | en: Basic trigonometric identities | w: 3 | 考纲: 中学数学全部内容
前置: trig-functions
后续: angle-sum-formulas
alias: 诱导公式, 平方关系, 商数关系, 奇变偶不变

同角关系：$\sin^2\alpha+\cos^2\alpha=1$，$\tan\alpha=\frac{\sin\alpha}{\cos\alpha}$。
诱导公式把任意角化为锐角：$\sin(\pi-\alpha)=\sin\alpha$，$\cos(\pi-\alpha)=-\cos\alpha$，$\sin\left(\frac\pi2-\alpha\right)=\cos\alpha$，$\sin(-\alpha)=-\sin\alpha$，……

### 记忆
“奇变偶不变，符号看象限”：对 $k\cdot\frac\pi2\pm\alpha$，$k$ 为奇数时正弦、余弦互换，$k$ 为偶数时函数名不变；符号按把 $\alpha$ 视为锐角时原函数在该象限的符号确定。所有诱导公式都是单位圆的对称性：关于 $x$ 轴、$y$ 轴、原点和直线 $y=x$ 的反射。

## 正弦型函数 {#sinusoid}
type: 概念 | en: Sinusoidal function | w: 4 | 考纲: 中学数学全部内容
前置: trig-functions, graph-transform
后续: simple-harmonic-motion, fourier-series
alias: y=Asin(ωx+φ), 振幅, 相位, 初相

$y=A\sin(\omega x+\varphi)$（$A>0,\omega>0$）：振幅 $A$，周期 $T=\frac{2\pi}\omega$，频率 $\frac1T$，相位 $\omega x+\varphi$，初相 $\varphi$。它由 $y=\sin x$ 经平移、伸缩得到，描述简谐振动、交流电和声波。

### 例题
函数 $y=2\sin\left(2x+\frac\pi3\right)$ 的单调递增区间是什么？

**解**：令 $-\frac\pi2+2k\pi\le2x+\frac\pi3\le\frac\pi2+2k\pi$，得 $-\frac{5\pi}{12}+k\pi\le x\le\frac\pi{12}+k\pi$，$k\in\Z$。把相位整体看作一个变量，是处理正弦型函数的基本方法。

### 应用
任何两个同频率正弦振动的叠加仍是同频率的正弦振动（[[auxiliary-angle]]）；不同频率的叠加则组成一般的周期信号，这是 [[fourier-series]] 的出发点。

## 两角和与差的公式 {#angle-sum-formulas}
type: 公式 | en: Angle addition formulas | w: 4 | 考纲: 中学数学全部内容
前置: trig-basic-identities, dot-product
推出: double-angle-formulas, auxiliary-angle
alias: 和角公式, 差角公式

$$\cos(\alpha-\beta)=\cos\alpha\cos\beta+\sin\alpha\sin\beta,\qquad \sin(\alpha\pm\beta)=\sin\alpha\cos\beta\pm\cos\alpha\sin\beta,$$
$$\tan(\alpha\pm\beta)=\frac{\tan\alpha\pm\tan\beta}{1\mp\tan\alpha\tan\beta}.$$

### 证明
单位圆上取 $A(\cos\alpha,\sin\alpha)$、$B(\cos\beta,\sin\beta)$。向量 $\vec{OA}$、$\vec{OB}$ 的夹角是 $\alpha-\beta$（或其补角，余弦相同），用两种方式计算数量积：
$$\vec{OA}\cdot\vec{OB}=\cos(\alpha-\beta)=\cos\alpha\cos\beta+\sin\alpha\sin\beta.$$
把 $\beta$ 换成 $-\beta$ 得 $\cos(\alpha+\beta)$；再用 $\sin\theta=\cos\left(\frac\pi2-\theta\right)$ 得正弦公式。

### 注记
用复数看最简洁：$\ee^{\ii(\alpha+\beta)}=\ee^{\ii\alpha}\ee^{\ii\beta}$，展开比较实部虚部即得两条公式，见 [[euler-formula]]；用矩阵看则是“旋转的复合还是旋转”。

## 二倍角与半角公式 {#double-angle-formulas}
type: 公式 | en: Double-angle formulas | w: 3 | 考纲: 中学数学全部内容
源于: angle-sum-formulas
alias: 二倍角, 降幂公式, 半角公式

$$\sin2\alpha=2\sin\alpha\cos\alpha,\quad \cos2\alpha=\cos^2\alpha-\sin^2\alpha=2\cos^2\alpha-1=1-2\sin^2\alpha.$$
由此得降幂公式 $\cos^2\alpha=\frac{1+\cos2\alpha}2$，$\sin^2\alpha=\frac{1-\cos2\alpha}2$。

### 应用
降幂公式把平方变成一次的三角函数，求 $\int\sin^2x\,\dd x=\frac x2-\frac{\sin2x}4+C$ 就靠它；万能公式 $\sin\alpha=\frac{2t}{1+t^2}$、$\cos\alpha=\frac{1-t^2}{1+t^2}$（$t=\tan\frac\alpha2$）把三角式化为有理式。

## 辅助角公式 {#auxiliary-angle}
type: 公式 | en: Harmonic addition | w: 3 | 考纲: 中学数学全部内容
源于: angle-sum-formulas
应用于: function-max-min
alias: 合一变形, asinx+bcosx

$$a\sin x+b\cos x=\sqrt{a^2+b^2}\,\sin(x+\varphi),\qquad \cos\varphi=\frac a{\sqrt{a^2+b^2}},\ \sin\varphi=\frac b{\sqrt{a^2+b^2}}.$$
所以 $a\sin x+b\cos x$ 的最大值是 $\sqrt{a^2+b^2}$。

### 直观
$a\sin x+b\cos x$ 是向量 $(a,b)$ 与单位向量 $(\sin x,\cos x)$ 的数量积，最大值在两向量同向时取到，等于 $(a,b)$ 的长度。这也是 [[cauchy-inequality-hs]] 的一个特例。

## 正弦定理 {#law-of-sines}
type: 定理 | en: Law of sines | w: 4 | 考纲: 中学数学全部内容
前置: trig-functions, circle-theorems
相关: law-of-cosines
alias: 正弦定理, 外接圆半径

在 $\triangle ABC$ 中，
$$\frac a{\sin A}=\frac b{\sin B}=\frac c{\sin C}=2R,$$
其中 $R$ 是外接圆半径。

### 证明
作直径 $BD=2R$，由圆周角定理 $\angle D=\angle A$（或 $\pi-A$），$\triangle BCD$ 中 $\angle BCD=\frac\pi2$，所以 $a=BC=2R\sin A$。其余同理。

### 应用
已知两角一边或两边及一边对角时解三角形（后者可能有两解）；面积公式 $S=\frac12ab\sin C=\frac{abc}{4R}$。

## 余弦定理 {#law-of-cosines}
type: 定理 | en: Law of cosines | w: 4 | 考纲: 中学数学全部内容
前置: dot-product
推广为: inner-product-space
特例: pythagorean
alias: 余弦定理

$$c^2=a^2+b^2-2ab\cos C.$$
$C=\frac\pi2$ 时就是勾股定理；它由三边求角，或由两边及夹角求第三边。

### 证明
设 $\vec{CA}=\vv b$、$\vec{CB}=\vv a$，则 $\vec{AB}=\vv a-\vv b$，
$$c^2=\abs{\vv a-\vv b}^2=\abs{\vv a}^2+\abs{\vv b}^2-2\vv a\cdot\vv b=a^2+b^2-2ab\cos C.$$

### 注记
用余弦符号判断三角形形状：$a^2+b^2>c^2\iff C$ 为锐角。在任意内积空间中同样有 $\norm{u-v}^2=\norm u^2+\norm v^2-2\inner uv$，这是“余弦定理”的抽象版本。

## 反三角函数 {#inverse-trig}
type: 概念 | en: Inverse trigonometric functions | w: 2 | 考纲: 中学数学全部内容
前置: inverse-function, trig-functions
后续: antiderivative
alias: arcsin, arccos, arctan

三角函数不是一一对应，限制在单调区间上才有反函数：$\arcsin:[-1,1]\to\left[-\frac\pi2,\frac\pi2\right]$，$\arccos:[-1,1]\to[0,\pi]$，$\arctan:\R\to\left(-\frac\pi2,\frac\pi2\right)$。

### 注记
$\arcsin x+\arccos x=\frac\pi2$；$(\arctan x)'=\frac1{1+x^2}$，所以 $\int_0^1\frac{\dd x}{1+x^2}=\frac\pi4$。把 $\frac1{1+x^2}$ 展开为几何级数再逐项积分，得莱布尼茨级数 $\frac\pi4=1-\frac13+\frac15-\cdots$。
