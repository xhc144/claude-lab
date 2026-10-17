# 精选航线

## 实数的完备性 {#completeness}
desc: 从“有理数有空隙”出发，看确界原理怎样一步步推出分析学的基本定理。
- real-number-system: 有理数满足四则运算和大小比较，却在 $\sqrt2$ 处留下空隙。实数系的第三条公理——完备性——把空隙填满。
- supremum: 完备性最直接的说法：有上界的非空集合一定有最小上界。
- monotone-convergence: 单调递增有上界的数列收敛到它的上确界。判断收敛不再需要先猜出极限。
- number-e: 第一个收获：$(1+\frac1n)^n$ 单调有界，它的极限就是自然常数 $\ee$。
- nested-intervals: 区间套定理：一列收缩的闭区间恰有一个公共点。
- uncountable-reals: 用区间套可以证明实数不能排成一列——无穷有大小。
- cauchy-criterion: 最后，柯西准则只看数列自身：项与项之间越来越近，数列就收敛。

## 通往 $e^{i\pi}+1=0$ {#euler-identity}
desc: 指数、三角、复数原本是三块互不相干的知识，幂级数把它们焊成了一个公式。
- exponential-function: 出发点是指数函数 $a^x$：它把加法变成乘法，$a^{x+y}=a^xa^y$。
- number-e: 在所有底数中，$e$ 最特别：$\frac{d}{dx}e^x=e^x$，它的切线斜率处处等于函数值。
- maclaurin-expansions: 把 $e^x$、$\sin x$、$\cos x$ 展开成幂级数，三列系数惊人地相似，只差符号。
- power-series: 幂级数在收敛圆内绝对收敛，可以放心地代入复数——这一步把实变量推广到复平面。
- complex-polar-form: 复数可以写成模与辐角：$z=r(\cos\theta+i\sin\theta)$，乘法就是模相乘、辐角相加。
- euler-formula: 把 $ix$ 代入 $e^x$ 的级数，实部恰是 $\cos x$、虚部恰是 $\sin x$：$e^{ix}=\cos x+i\sin x$。取 $x=\pi$ 就得到 $e^{i\pi}+1=0$。
- roots-of-unity: 回报立刻到来：$z^n=1$ 的 $n$ 个根是 $e^{2k\pi i/n}$，均匀分布在单位圆上。
- fourier-series: 更大的回报：任何周期信号都能写成 $e^{inx}$ 的叠加——这就是傅里叶级数。

## 微积分基本定理及其推广 {#ftc-journey}
desc: 导数与积分互为逆运算；同一个思想在高维变成格林、高斯、斯托克斯公式。
- derivative: 导数是变化率：割线斜率的极限。
- lagrange-mvt: 中值定理把“整体的平均变化率”与“某点的瞬时变化率”连了起来。
- riemann-integral: 积分是累积：分割、求和、取极限。
- integral-properties: 积分有线性、保序性和积分中值定理，连续函数在闭区间上可积。
- ftc: 微积分基本定理：$\frac{d}{dx}\int_a^x f=f(x)$，于是 $\int_a^bf=F(b)-F(a)$。计算积分变成了找原函数。
- greens-theorem: 二维版本：区域上旋度的积分等于边界上的环量。“内部的累积 = 边界上的值”这一结构保持不变。
- gauss-divergence: 三维版本：散度的体积分等于穿出闭曲面的通量。
- stokes-theorem: 曲面上的旋度通量等于边界曲线上的环量。
- differential-forms: 用微分形式统一写成 $\int_M d\omega=\int_{\partial M}\omega$——上面所有公式都是它的特例。

## 正交：从勾股定理到傅里叶 {#orthogonality}
desc: 勾股定理的抽象形式是“正交分解”；函数也可以像向量一样正交分解。
- pythagorean: 直角三角形 $a^2+b^2=c^2$——两个垂直方向的长度平方相加。
- dot-product: 数量积给出长度与夹角；垂直就是数量积为零。
- inner-product-space: 把数量积公理化：任何满足对称、线性、正定的运算都是内积，函数空间也不例外。
- orthogonal-projection: 向子空间作正交投影得到最佳逼近，误差与子空间垂直。
- gram-schmidt: 任何一组基都能逐个“减去投影”，化成规范正交基。
- trig-orthogonality: 在 $[-\pi,\pi]$ 上，$1,\cos nx,\sin nx$ 两两正交——一组无穷维的“坐标轴”。
- fourier-series: 傅里叶系数就是函数在这些坐标轴上的投影。
- parseval-identity: 无穷维的勾股定理：函数的平方积分等于各系数的平方和。
- basel-problem: 对 $f(x)=x$ 用帕塞瓦尔恒等式，就得到 $\sum\frac1{n^2}=\frac{\pi^2}6$。

## 对称性的数学：群 {#symmetry-groups}
desc: 从正多边形的旋转与翻折出发，认识群、子群、群作用，最后用对称性来计数。
- dihedral-group: 正 $n$ 边形有 $n$ 个旋转、$n$ 个翻折，复合起来仍是对称——它们组成二面体群 $D_n$。
- group: 抽象出来：一个集合配上满足结合律、有单位元、有逆元的运算，就是群。
- subgroup: 群里自成一群的部分，例如 $D_n$ 中的旋转。
- lagrange-group-theorem: 子群的阶整除群的阶。由此马上得到：元素的阶整除群的阶。
- group-action: 群通过“移动”作用在集合上：$D_n$ 作用在顶点上，旋转群作用在立方体的面上。
- orbit-stabilizer: 轨道长度 × 稳定子阶数 = 群的阶。
- burnside-lemma: 本质不同的方案数 = 各群元不动点个数的平均值。
- necklace-counting: 用 $n$ 种颜色的珠子串项链，转一转、翻一翻算同一条——伯恩赛德引理一步算出答案。
- platonic-solids: 正多面体的旋转群只有三种：四面体群、八面体群、二十面体群。

## 为什么五次方程没有求根公式 {#galois}
desc: 从韦达定理到伽罗瓦理论：根之间的对称性决定了方程能否用根式求解。
- quadratic-equation: 二次方程有求根公式，判别式决定根的情况。三次、四次方程在 16 世纪也找到了公式。
- vieta-theorem: 根与系数的关系：系数是根的对称多项式。
- symmetric-polynomials: 任何对称多项式都能用初等对称多项式表示——系数只“看得见”根的对称组合。
- field-extension: 把根添加进有理数域得到扩域，次数衡量扩张有多大。
- constructible-numbers: 先看一个小例子：尺规只能作出 $2^k$ 次扩张中的数，所以倍立方、三等分角不可能。
- symmetric-group: $n$ 个根的置换构成对称群 $S_n$。
- galois-theory: 伽罗瓦的洞见：方程可用根式求解，当且仅当它的伽罗瓦群是可解群。
- quintic-insolvability: $S_5$ 含有单群 $A_5$，不可解——一般的五次方程没有根式解。

## 从抛硬币到正态分布 {#bell-curve}
desc: 大量独立的小随机因素叠加，总会出现同一条钟形曲线。
- bernoulli-binomial: 抛 $n$ 次硬币，正面次数服从二项分布 $B(n,p)$。
- galton-board: 高尔顿板把二项分布做成了实物：小球左右碰撞，落成一座“小山”。
- expectation: 期望是长期平均值：$E[X]=np$。
- variance: 方差刻画波动：$D(X)=np(1-p)$，标准差只按 $\sqrt n$ 增长。
- chebyshev-inequality: 切比雪夫不等式：偏离期望 $k$ 个标准差的概率不超过 $\frac1{k^2}$。
- lln: 大数定律：频率稳定于概率，样本均值收敛于期望。
- clt: 中心极限定理：独立同分布的和，标准化后趋于标准正态分布——不管单个是什么分布。
- normal-distribution: 正态分布 $N(\mu,\sigma^2)$：“$3\sigma$ 原则”告诉我们 $99.7\%$ 的取值落在 $\mu\pm3\sigma$ 内。

## 从数据到结论：统计推断 {#inference}
desc: 只看到样本，怎样对总体作出有把握的判断？
- population-sample: 总体太大看不全，只能抽样；随机性让样本有代表性。
- sample-mean: 样本均值是总体均值最自然的估计，它的方差是 $\frac{\sigma^2}n$。
- point-estimation: 点估计：用一个统计量给未知参数一个猜测值。
- mle: 极大似然：选让观测数据出现概率最大的参数。
- unbiased-estimator: 好的估计应当“平均来说猜得准”——样本方差除以 $n-1$ 正是为此。
- confidence-interval: 区间估计：给出一个区间，并说明它以多大概率覆盖真值。
- hypothesis-test: 假设检验像反证法：假设 $H_0$ 成立，若观测结果极不可能出现，就拒绝它。
- type-errors: 两类错误此消彼长：减小 $\alpha$ 会增大 $\beta$，增大样本量才能两全。
- p-value: $p$ 值是 $H_0$ 成立时出现至少如此极端结果的概率。
- linear-regression: 推断不只关于均值：回归分析研究变量之间的关系。

## 线性代数的主干 {#linear-algebra-spine}
desc: 从解方程出发，沿着“秩—行列式—特征值—奇异值”这条主线走一遍。
- linear-system: 一切从线性方程组开始。
- gaussian-elimination: 消元法把方程组化成阶梯形，解的结构一目了然。
- rank: 阶梯形中非零行的个数就是秩——有效方程的个数。
- linear-map: 换个角度：矩阵就是线性映射，方程组 $A\boldsymbol x=\boldsymbol b$ 问的是 $\boldsymbol b$ 是否在像里。
- rank-nullity: 秩-零化度定理：$\dim\ker+\operatorname{rank}=n$。
- determinant: 行列式是体积的伸缩倍数，不为零当且仅当可逆。
- eigenvalue: 特征向量是只被拉伸、不被转向的方向。
- diagonalization: 有足够多的特征向量时，换到特征基下，矩阵就成了对角阵。
- spectral-theorem: 实对称矩阵总能被正交对角化——特征向量两两垂直。
- svd: 任何矩阵都能分解为“旋转—拉伸—旋转”：$A=U\Sigma V^{\mathrm T}$。
- pca: 奇异值分解的应用：找出数据方差最大的方向，实现降维。

## 欧拉示性数：数出来的拓扑 {#euler-characteristic}
desc: $V-E+F$ 这样一个简单的计数，竟然是曲面的拓扑不变量。
- euler-formula-polyhedra: 任何凸多面体都满足 $V-E+F=2$。
- platonic-solids: 由欧拉公式可以推出：正多面体只有五种。
- planar-graph: 同样的公式适用于连通平面图，由此 $K_5$、$K_{3,3}$ 不是平面图。
- euler-characteristic: 把多面体换成任意三角剖分的曲面，$\chi=V-E+F$ 与剖分方式无关。
- genus: 有 $g$ 个“洞”的闭曲面 $\chi=2-2g$：球面 $2$，环面 $0$。
- mobius-strip: 不可定向的曲面也有欧拉示性数：默比乌斯带 $\chi=0$。
- surface-classification: 闭曲面由可定向性与欧拉示性数完全分类。
- gauss-bonnet: 高斯-博内定理：曲面的总曲率等于 $2\pi\chi$——几何量由拓扑决定。
- hairy-ball: 球面上的连续切向量场必有零点，因为 $\chi(S^2)=2\ne0$。

## 数论与公钥密码 {#number-theory-rsa}
desc: 两千年前的整除理论，今天守护着每一次网上支付。
- divisibility: 整除与带余除法是一切的起点。
- gcd-euclid: 辗转相除法飞快地求出最大公约数。
- bezout: 裴蜀定理：$\gcd(a,b)$ 能写成 $ax+by$，系数由辗转相除法倒推得到。
- primes: 算术基本定理：每个整数都唯一分解为素数之积。
- congruence: 同余把整数“折叠”成有限的剩余类，可以加减乘。
- fermat-little: 费马小定理：$p$ 是素数、$p\nmid a$ 时 $a^{p-1}\equiv1\pmod p$。
- euler-theorem: 推广到任意模数：$a^{\varphi(n)}\equiv1\pmod n$。
- crt: 中国剩余定理：模两两互素的同余方程组有唯一解。
- rsa: 把这些拼起来：公开 $n=pq$ 与 $e$，只有知道 $p,q$ 的人才能求出解密指数 $d$。

## 怎样解方程 $f(x)=0$ {#root-finding}
desc: 从“零点一定存在”到“怎样又快又准地找到它”。
- function-zeros: 方程的根就是函数图像与 $x$ 轴的交点。
- ivt: 介值定理：连续函数在区间端点异号，中间必有零点。
- bisection-method: 二分法把介值定理变成算法：每步区间减半，稳但慢。
- fixed-point-iteration: 把方程改写成 $x=g(x)$ 反复迭代；$|g'|<1$ 时收敛。
- banach-fixed-point: 压缩映射原理保证不动点存在唯一，迭代必收敛。
- newton-method: 牛顿法用切线代替曲线，在单根附近二次收敛——每步有效数字翻倍。
- convergence-order: 收敛阶刻画快慢：二分法 $1$ 阶，割线法约 $1.618$ 阶，牛顿法 $2$ 阶。
- logistic-map: 迭代并不总是收敛：逻辑斯谛映射展示了从稳定到周期倍增再到混沌。

## 从苹果落地到行星轨道 {#newton-kepler}
desc: 牛顿定律加上万有引力，推出了开普勒三定律。
- newton-second: 力决定加速度：$\boldsymbol F=m\boldsymbol a$。
- circular-motion: 匀速圆周运动的加速度指向圆心，大小 $\frac{v^2}r$。
- centripetal-force: 提供这个加速度的合力就是向心力。
- universal-gravitation: 万有引力 $F=\frac{GMm}{r^2}$：让苹果下落的力也维持着月亮的轨道。
- angular-momentum: 中心力不产生力矩，角动量守恒——这就是开普勒第二定律（面积定律）。
- kepler-laws: 由平方反比律可以推出：行星轨道是以太阳为焦点的椭圆，且 $T^2\propto a^3$。
- ellipse: 椭圆正是到两焦点距离之和为常数的点的轨迹。
- satellite-orbits: 第一、第二宇宙速度分别对应贴地圆轨道和逃逸。

## 光是什么 {#light}
desc: 光的直线传播与折射可以用“最短时间”解释；干涉、衍射说明它是波；光电效应又说明它是粒子。
- reflection-refraction: 光在界面上反射与折射：$n_1\sin\theta_1=n_2\sin\theta_2$。
- fermat-principle: 费马原理：光走用时最短（更准确地说，取驻值）的路径，折射定律由此推出。
- total-internal-reflection: 从光密射向光疏介质、入射角超过临界角时发生全反射——光纤的原理。
- wave-superposition: 波相遇时位移相加，程差决定加强或减弱。
- double-slit: 杨氏双缝实验中出现明暗条纹：光是波。
- diffraction: 光绕过障碍物传播，单缝衍射的中央亮纹宽度与缝宽成反比。
- photoelectric-effect: 光电效应却显示光以 $h\nu$ 为单位交换能量：光又是粒子。
- wave-particle-duality: 单个光子落点随机，大量光子的分布却是干涉图样——波粒二象性。

## 最优化：寻找最好的那一个 {#optimization}
desc: 从求二次函数最值，到训练神经网络，都是同一个问题：在约束下让目标最小。
- function-max-min: 中学的起点：二次函数配方、单调性分析。
- extremum-derivative: 可导函数的极值点处导数为零（费马引理）。
- am-gm: 不用导数也能求最值：均值不等式取等条件给出最优解。
- convex-function: 凸函数的局部最小就是全局最小——优化问题里最好的性质。
- lagrange-multiplier: 有等式约束时，最优点处目标的梯度与约束的梯度平行。
- kkt: 不等式约束下的推广：KKT 条件。
- gradient-descent: 数值方法：沿负梯度方向一步步下山。
- linear-programming: 目标和约束都是线性的：最优解在可行多边形的顶点。
- neural-network: 训练神经网络就是对海量参数做随机梯度下降。
