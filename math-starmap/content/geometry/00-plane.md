---
galaxy: geometry
cluster: plane-geometry
title: 平面几何
en: Plane geometry
order: 0
level: hs
---

## 欧几里得几何与公理化方法 {#euclidean-geometry}
type: 思想 | en: Euclidean geometry and the axiomatic method | w: 4 | 考纲: 平面几何
后续: pythagorean, similar-triangles, non-euclidean
alias: 几何原本, 五条公设, 平行公设, 公理化

欧几里得《几何原本》（约公元前 300 年）从 23 个定义、5 条公设、5 条公理出发，推出 465 条命题。这种“从少数不证自明的前提出发、用逻辑推出一切”的公理化方法，成为后来整个数学的范式。

### 第五公设
“过直线外一点有且只有一条直线与已知直线平行”（等价表述）。两千年间人们试图由前四条公设证明它，最终发现它独立于其他公设：替换它可以得到同样自洽的 [[non-euclidean|非欧几何]]。

### 注记
希尔伯特《几何基础》（1899）补全了欧几里得遗漏的公理（如介于关系、连续性），使平面几何成为严格的公理系统。中学的几何证明、向量方法、解析方法与变换方法，是处理同一个欧氏平面的四种语言。

## 勾股定理 {#pythagorean}
type: 定理 | en: Pythagorean theorem | w: 5 | 考纲: 平面几何
前置: euclidean-geometry
推广为: law-of-cosines
类比: parseval-identity
alias: 毕达哥拉斯定理, 商高定理, 勾股数
tags: 平面几何

直角三角形两直角边的平方和等于斜边的平方：$a^2+b^2=c^2$。反之，满足此式的三角形是直角三角形。

### 证明
（赵爽弦图）以斜边为边长作正方形，内部放四个全等的直角三角形，中间剩下边长 $b-a$ 的小正方形：
$$c^2=4\cdot\frac12ab+(b-a)^2=a^2+b^2.$$
相似证法：作斜边上的高，分出的两个小三角形都与原三角形相似，$a^2=c\cdot p$，$b^2=c\cdot q$，$p+q=c$。

### 注记
- 本原勾股数：$(m^2-n^2,2mn,m^2+n^2)$，$m>n$ 互素且一奇一偶，如 $(3,4,5)$、$(5,12,13)$。
- 推广：余弦定理；$n$ 维中 $\norm{\vv x}^2=\sum x_i^2$；无穷维的帕塞瓦尔恒等式；而 $a^n+b^n=c^n$（$n\ge3$）没有正整数解（费马大定理，怀尔斯 1995 年证明）。

## 相似三角形 {#similar-triangles}
type: 定理 | en: Similar triangles | w: 4 | 考纲: 平面几何
前置: euclidean-geometry
后续: triangle-centers, power-of-point, ceva-menelaus
alias: 相似, 射影定理, 平行线分线段成比例

两个三角形对应角相等（AA 判定）、或三边成比例（SSS）、或两边成比例且夹角相等（SAS），则相似，对应边成比例，面积比等于相似比的平方。

### 例题
**射影定理**：$\triangle ABC$ 中 $\angle C=90^\circ$，$CD$ 是斜边上的高，则 $CD^2=AD\cdot DB$，$AC^2=AD\cdot AB$。由 $\triangle ACD\sim\triangle CBD\sim\triangle ABC$ 立得。

### 注记
相似是“保持形状、改变大小”的变换，对应几何中的位似与相似变换群。三角函数之所以只依赖角度而不依赖三角形的大小，正是因为同角的直角三角形都相似。

## 三角形的五心 {#triangle-centers}
type: 概念 | en: Triangle centers | w: 4 | 考纲: 平面几何
前置: similar-triangles
后续: euler-line
alias: 重心, 外心, 内心, 垂心, 旁心, 五心

- **重心** $G$：三条中线的交点，分中线为 $2:1$；
- **外心** $O$：三边中垂线的交点，外接圆圆心；
- **内心** $I$：三条内角平分线的交点，内切圆圆心；
- **垂心** $H$：三条高的交点；
- **旁心**：一个内角与另两个外角平分线的交点（共三个）。

### 证明（中线共点）
设中线 $BE$、$CF$ 交于 $G$。$EF$ 是中位线，$EF\parallel BC$ 且 $EF=\frac12BC$，所以 $\triangle GEF\sim\triangle GBC$，$BG:GE=2:1$。同理 $AD$ 与 $BE$ 的交点也分 $BE$ 为 $2:1$，两交点重合。也可以用 [[ceva-menelaus|塞瓦定理]] 一步得到。

### 注记
重心坐标 $G=\frac{A+B+C}3$；内心 $I=\frac{aA+bB+cC}{a+b+c}$。三线共点类问题的通用工具是塞瓦定理。

## 欧拉线与九点圆 {#euler-line}
type: 定理 | en: Euler line and nine-point circle | w: 3 | 考纲: 平面几何
前置: triangle-centers
alias: 欧拉线, 九点圆, 费尔巴哈定理

任意三角形的外心 $O$、重心 $G$、垂心 $H$ 共线，且 $OG:GH=1:2$（欧拉线）。三边中点、三条高的垂足、三个顶点到垂心连线的中点，这九点共圆（九点圆），圆心是 $OH$ 的中点，半径是外接圆半径的一半。

### 证明（欧拉线，向量法）
以外心为原点，令 $\vec{OH}=\vec{OA}+\vec{OB}+\vec{OC}$。则 $\vec{AH}=\vec{OB}+\vec{OC}$，$(\vec{OB}+\vec{OC})\cdot(\vec{OC}-\vec{OB})=\abs{\vec{OC}}^2-\abs{\vec{OB}}^2=0$，所以 $AH\perp BC$；同理其余两条，故此点就是垂心。而 $\vec{OG}=\frac13(\vec{OA}+\vec{OB}+\vec{OC})=\frac13\vec{OH}$。

### 注记
费尔巴哈定理：九点圆与内切圆、三个旁切圆都相切。

## 圆周角定理 {#circle-theorems}
type: 定理 | en: Inscribed angle theorem | w: 4 | 考纲: 平面几何
前置: euclidean-geometry
后续: power-of-point, law-of-sines, ptolemy
alias: 圆周角, 圆心角, 四点共圆, 圆内接四边形, 弦切角

同弧所对的圆周角等于圆心角的一半；同弧上的圆周角相等；直径所对的圆周角是直角。四边形内接于圆 $\iff$ 对角互补。

### 证明
圆心在圆周角内部时，连接顶点与圆心并延长，分成两个等腰三角形，各自的外角等于底角的两倍，相加即得；其他情形类似（相减）。

### 应用
判定四点共圆（同侧张角相等或对角互补），这是平面几何中最常用的“桥梁”：一旦共圆，许多角就能互相转移。

## 圆幂定理 {#power-of-point}
type: 定理 | en: Power of a point | w: 3 | 考纲: 平面几何
前置: circle-theorems, similar-triangles
alias: 相交弦定理, 切割线定理, 割线定理, 圆幂, 根轴

过点 $P$ 作直线交圆于 $A,B$，则 $PA\cdot PB$ 是与直线无关的常数（$P$ 在圆外时取正，在圆内时取负，等于 $d^2-r^2$，$d=\abs{PO}$）。它统一了相交弦定理、切割线定理和割线定理。

### 证明
相交弦：$\triangle PAC\sim\triangle PDB$（同弧所对圆周角相等），所以 $PA\cdot PB=PC\cdot PD$。坐标证法：直线 $P+t\vv u$ 代入圆方程得关于 $t$ 的二次方程，由韦达定理 $t_1t_2=\abs{P-O}^2-r^2$。

### 注记
对两圆圆幂相等的点构成一条直线，称为根轴；三圆两两的根轴共点（根心）。

## 塞瓦定理与梅涅劳斯定理 {#ceva-menelaus}
type: 定理 | en: Ceva's and Menelaus' theorems | w: 3 | 考纲: 平面几何
前置: similar-triangles
alias: 塞瓦定理, 梅涅劳斯定理, 三线共点, 三点共线

在 $\triangle ABC$ 中，$D,E,F$ 分别在直线 $BC,CA,AB$ 上：
- **塞瓦**：$AD,BE,CF$ 共点（或平行）$\iff\dfrac{BD}{DC}\cdot\dfrac{CE}{EA}\cdot\dfrac{AF}{FB}=1$（有向线段）；
- **梅涅劳斯**：$D,E,F$ 共线 $\iff\dfrac{BD}{DC}\cdot\dfrac{CE}{EA}\cdot\dfrac{AF}{FB}=-1$。

### 证明（塞瓦，面积法）
设三线交于 $P$，则 $\frac{BD}{DC}=\frac{S_{\triangle ABP}}{S_{\triangle ACP}}$，同理写出另两个比，三式相乘恰好消去。

### 应用
三条中线（各比为 $1$）、三条角平分线（由角平分线定理 $\frac{BD}{DC}=\frac{AB}{AC}$）、三条高（$\frac{BD}{DC}=\frac{\tan C}{\tan B}$）的共点性都是塞瓦定理的推论。

## 托勒密定理 {#ptolemy}
type: 定理 | en: Ptolemy's theorem | w: 3 | 考纲: 平面几何
前置: circle-theorems, similar-triangles
alias: 托勒密不等式, 圆内接四边形

圆内接四边形 $ABCD$ 中，$AC\cdot BD=AB\cdot CD+AD\cdot BC$。一般四边形有托勒密不等式 $AC\cdot BD\le AB\cdot CD+AD\cdot BC$，等号当且仅当四点共圆（且顺序正确）。

### 证明
在 $BD$ 上取 $E$ 使 $\angle BAE=\angle CAD$，则 $\triangle ABE\sim\triangle ACD$，$AB\cdot CD=AC\cdot BE$；又 $\triangle ADE\sim\triangle ACB$，$AD\cdot BC=AC\cdot DE$。相加得 $AB\cdot CD+AD\cdot BC=AC\cdot BD$。

### 注记
取矩形即得勾股定理；托勒密用它编制了弦表（相当于三角函数表），其中蕴含了两角和的正弦公式。

## 海伦公式 {#heron-formula}
type: 公式 | en: Heron's formula | w: 3 | 考纲: 平面几何
前置: law-of-cosines
alias: 海伦-秦九韶公式, 三斜求积, 三角形面积

三边为 $a,b,c$ 的三角形面积为
$$S=\sqrt{p(p-a)(p-b)(p-c)},\qquad p=\frac{a+b+c}2.$$
秦九韶的“三斜求积术”是它的等价形式。

### 证明
$S=\frac12ab\sin C$，$\sin^2C=1-\cos^2C$，$\cos C=\frac{a^2+b^2-c^2}{2ab}$。于是
$$16S^2=4a^2b^2-(a^2+b^2-c^2)^2=(2ab+a^2+b^2-c^2)(2ab-a^2-b^2+c^2),$$
再分别因式分解为 $(a+b+c)(a+b-c)(c+a-b)(c-a+b)$。

### 注记
周长一定时 $p$ 固定，由均值不等式 $(p-a)(p-b)(p-c)$ 在 $a=b=c$ 时最大：等周长的三角形中正三角形面积最大。

## 几何变换 {#geometric-transformations}
type: 概念 | en: Geometric transformations | w: 4 | 考纲: 平面几何
前置: euclidean-geometry
后续: inversion
推广为: linear-map
相关: group
alias: 平移, 旋转, 反射, 位似, 等距变换, 合同变换, 相似变换

保持距离的平面变换（等距变换）只有平移、旋转、反射与滑移反射四类，它们构成群；保持形状的变换（相似变换）再加上位似。克莱因的埃尔朗根纲领（1872）提出：几何学研究的是在某个变换群下不变的性质。

### 例题
**费马点**：在各角都小于 $120^\circ$ 的三角形内求一点 $P$ 使 $PA+PB+PC$ 最小。把 $\triangle APB$ 绕 $B$ 旋转 $60^\circ$ 到 $\triangle A'P'B$，则 $PA+PB+PC=A'P'+P'P+PC\ge A'C$，当 $A',P',P,C$ 共线时取等号，此时 $\angle APB=\angle BPC=\angle CPA=120^\circ$。

### 注记
欧氏几何（等距群）$\subset$ 相似几何 $\subset$ 仿射几何（仿射群，保持平行与比例）$\subset$ 射影几何（射影群，保持共线与交比）。

## 反演 {#inversion}
type: 方法 | en: Inversion | w: 2 | level: ext
前置: geometric-transformations, power-of-point
alias: 反演变换, 圆反演

以 $O$ 为中心、$r$ 为半径的反演把点 $P$ 变为射线 $OP$ 上的 $P'$，$OP\cdot OP'=r^2$。反演把过 $O$ 的圆变成直线、不过 $O$ 的圆变成圆，并且保持角度（共形）。

### 应用
把涉及相切圆的问题化为直线问题：例如笛卡尔圆定理、阿波罗尼奥斯问题、帕普斯链。反演是莫比乌斯变换（复平面上的分式线性变换）的几何化身，也是双曲几何的庞加莱模型中的“反射”。
