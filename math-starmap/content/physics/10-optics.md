---
galaxy: physics
cluster: optics
title: 光学
en: Optics
order: 10
level: hs
---

## 光的反射与折射 {#reflection-refraction}
type: 定律 | en: Reflection and refraction | w: 5 | 考纲: 几何光学
后续: total-internal-reflection, lens-imaging
源于: fermat-principle
anim: refraction
alias: 反射定律, 折射定律, 斯涅尔定律, 折射率
tags: 光学

反射角等于入射角；折射时 $n_1\sin\theta_1=n_2\sin\theta_2$（斯涅尔定律），折射率 $n=\frac cv$。光从光疏介质进入光密介质时偏向法线。

### 例题
池水看起来比实际浅：从正上方看，视深 $h'=\frac hn\approx\frac34h$。

### 注记
色散：不同颜色的光折射率不同（紫光最大），白光经三棱镜分成彩色光带，彩虹也由此形成。

## 全反射 {#total-internal-reflection}
type: 现象 | en: Total internal reflection | w: 4 | 考纲: 几何光学
前置: reflection-refraction
alias: 全反射, 临界角, 光纤

光从光密介质射向光疏介质，入射角大于临界角 $C$（$\sin C=\frac{n_2}{n_1}$）时，折射光消失，全部反射。玻璃（$n\approx1.5$）对空气的临界角约 $42^\circ$，水约 $49^\circ$。

### 应用
光纤通信（高锟，2009 年诺贝尔物理学奖）、钻石的璀璨（$n=2.42$，临界角仅 $24^\circ$）、潜望镜中的全反射棱镜、海市蜃楼。

## 透镜成像 {#lens-imaging}
type: 公式 | en: Thin lens imaging | w: 4 | 考纲: 几何光学
前置: reflection-refraction, similar-triangles
alias: 透镜成像公式, 凸透镜, 凹透镜, 焦距, 放大率

薄透镜成像公式与放大率：
$$\frac1u+\frac1v=\frac1f,\qquad m=\frac vu$$
（实物距 $u>0$、实像距 $v>0$，凸透镜 $f>0$，凹透镜 $f<0$）。凸透镜：$u>2f$ 成倒立缩小实像（照相机），$f<u<2f$ 成倒立放大实像（投影仪），$u<f$ 成正立放大虚像（放大镜）。

### 推导
用两条特殊光线（平行于主光轴的光线过焦点、过光心的光线不偏折）作图，由两对相似三角形即得。

## 费马原理 {#fermat-principle}
type: 原理 | en: Fermat's principle | w: 4 | 考纲: 几何光学, 物理建模
前置: extremum-derivative
推出: reflection-refraction
相关: least-action, brachistochrone
alias: 最短时间原理, 光程, 变分原理

光在两点间沿光程（$\int n\,\dd s$）取驻值（通常为最小）的路径传播。

### 推导折射定律
光从 $A$（介质 1，速度 $v_1$）到 $B$（介质 2，速度 $v_2$），经过界面上的点 $P(x,0)$，时间
$$t(x)=\frac{\sqrt{a^2+x^2}}{v_1}+\frac{\sqrt{b^2+(d-x)^2}}{v_2}.$$
令 $t'(x)=0$：$\frac{\sin\theta_1}{v_1}=\frac{\sin\theta_2}{v_2}$，即 $n_1\sin\theta_1=n_2\sin\theta_2$。

### 注记
“救生员问题”：救生员在沙滩上跑得快、在水中游得慢，最快的路线满足同样的折射定律。光“好像知道”哪条路最快——这类极值原理贯穿整个物理学（[[least-action]]）。

## 双缝干涉 {#double-slit}
type: 实验 | en: Young's double-slit experiment | w: 5 | 考纲: 干涉
前置: wave-superposition
源于: electromagnetic-waves
后续: thin-film, wave-particle-duality
anim: double-slit
alias: 杨氏双缝干涉, 干涉条纹, 条纹间距, 相干光

单色光通过间距 $d$ 的双缝，在距离 $L$ 的屏上形成明暗相间的等间距条纹，条纹间距
$$\Delta x=\frac Ld\lambda.$$
屏上某点到两缝的光程差 $\delta\approx d\sin\theta$ 为波长整数倍时为亮纹。

### 意义
托马斯·杨（1801）用它证明光是波，并第一次测出了光的波长（约 $10^{-7}$ m 量级）。单个光子（或电子）逐个通过双缝，长时间积累后仍形成干涉条纹——量子力学最核心的谜题（费曼称之为“唯一的奥秘”）。

## 薄膜干涉 {#thin-film}
type: 现象 | en: Thin-film interference | w: 3 | 考纲: 干涉
前置: double-slit
alias: 薄膜干涉, 肥皂泡, 增透膜, 劈尖, 牛顿环

薄膜上下表面的反射光相干叠加，光程差 $2nd\cos\theta$（再考虑反射时可能的半波损失）决定加强或减弱。

### 应用
肥皂泡与油膜的彩色条纹；照相机镜头的增透膜（厚度为光在膜中波长的 $\frac14$，使反射光相消）；劈尖与牛顿环检测表面平整度，精度达波长量级。

## 光的衍射 {#diffraction}
type: 现象 | en: Diffraction | w: 4 | 考纲: 衍射
前置: wave-superposition
后续: diffraction-limit
alias: 衍射, 单缝衍射, 衍射光栅, 泊松亮斑, 惠更斯原理

光绕过障碍物偏离直线传播的现象，当障碍物或孔的尺寸与波长相当或更小时明显。单缝衍射中央亮纹最宽，暗纹条件 $a\sin\theta=k\lambda$；光栅方程 $d\sin\theta=k\lambda$ 给出锐利的主极大，用于光谱分析。

### 注记
泊松亮斑：泊松根据菲涅耳的波动理论推算出圆盘阴影中心应有亮点，以此反驳波动说，阿拉戈却在实验中真的看到了它——波动说因此大获全胜。

## 衍射极限与分辨率 {#diffraction-limit}
type: 定理 | en: Diffraction limit | w: 2 | level: ext | 考纲: 衍射
前置: diffraction
alias: 瑞利判据, 分辨本领, 艾里斑

圆孔衍射使点光源成像为艾里斑，两个点能被分辨的最小角距离约为 $\theta\approx1.22\frac\lambda D$（瑞利判据），$D$ 为孔径。

### 应用
望远镜口径越大分辨率越高；显微镜的分辨率极限约为半个波长，电子显微镜用德布罗意波长短得多的电子突破了这一限制。

## 光的偏振 {#polarization}
type: 现象 | en: Polarization | w: 3 | 考纲: 干涉, 电磁波
前置: electromagnetic-waves
alias: 偏振光, 偏振片, 马吕斯定律, 布儒斯特角, 横波

光是横波，电场的振动方向可以被选择。自然光通过偏振片后成为线偏振光，强度减半；再通过与之成 $\theta$ 角的偏振片，强度为 $I=I_0\cos^2\theta$（马吕斯定律）。

### 应用
偏光太阳镜消除水面反射的眩光（反射光部分偏振，布儒斯特角时完全偏振 $\tan\theta_B=n$）；液晶显示器；立体电影；应力分析（光弹性）。
