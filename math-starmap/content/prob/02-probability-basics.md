---
galaxy: prob
cluster: probability-basics
title: 概率基础与计算
en: Foundations of probability
order: 2
level: hs
---

## 样本空间与事件 {#sample-space}
type: 定义 | en: Sample space and events | w: 5 | 考纲: 有限样本空间
前置: set-operations
后续: probability-axioms, classical-probability
alias: 样本空间, 样本点, 随机事件, 必然事件, 不可能事件, 有限样本空间
tags: 概率

随机试验所有可能结果组成的集合 $\Omega$ 叫样本空间，其中的元素叫样本点；事件是 $\Omega$ 的子集。事件的“或、且、非”就是集合的并、交、补。

### 例题
掷两枚骰子：$\Omega=\{(i,j):1\le i,j\le6\}$，$36$ 个样本点。“点数和为 $7$”是事件 $\{(1,6),(2,5),\dots,(6,1)\}$。

### 注记
选择样本空间是建模的第一步，同一个问题可以有不同的样本空间。要求样本点“等可能”时，样本空间的选取尤其要小心：掷两枚骰子的点数和 $2,\dots,12$ 不是等可能的。

## 概率的公理化定义 {#probability-axioms}
type: 公理 | en: Axioms of probability | w: 5 | 考纲: 有限样本空间, 典型概率模型
前置: sample-space
相关: lebesgue-measure
后续: conditional-probability, random-variable
alias: 概率公理, 柯尔莫哥洛夫公理, 概率的性质

柯尔莫哥洛夫（1933）：概率是定义在事件上的函数 $\PP$，满足：
1. $\PP(A)\ge0$；
2. $\PP(\Omega)=1$；
3. 可列可加性：两两互斥的事件 $A_1,A_2,\dots$ 满足 $\PP\left(\bigcup A_i\right)=\sum\PP(A_i)$。

### 推论
$\PP(\varnothing)=0$；$\PP(\bar A)=1-\PP(A)$；$A\subseteq B\Rightarrow\PP(A)\le\PP(B)$；$\PP(A\cup B)=\PP(A)+\PP(B)-\PP(A\cap B)$；次可加性 $\PP\left(\bigcup A_i\right)\le\sum\PP(A_i)$（联合界）。

### 注记
公理化把“概率是什么”（频率？信念？）的哲学争论与“概率怎样计算”分开：无论如何解释，计算规则都相同。

## 古典概型 {#classical-probability}
type: 模型 | en: Classical probability | w: 5 | 考纲: 古典概率计算, 典型概率模型
前置: sample-space, combination
后续: classic-probability-models, geometric-probability
alias: 古典概型, 等可能概型, 拉普拉斯概率

样本空间有限且每个样本点等可能时，
$$\PP(A)=\frac{\abs A}{\abs\Omega}=\frac{\text{事件包含的基本事件数}}{\text{基本事件总数}}.$$
概率计算化为计数问题。

### 例题
从一副 $52$ 张的扑克中任取 $5$ 张，得到“同花”（五张同花色，含同花顺）的概率：$\frac{4\binom{13}5}{\binom{52}5}=\frac{5148}{2598960}\approx0.198\%$。

### 易错
分子分母必须在同一个样本空间里计数：要么都考虑顺序，要么都不考虑。

## 典型概率模型 {#classic-probability-models}
type: 模型 | en: Standard probability models | w: 4 | 考纲: 典型概率模型, 古典概率计算
前置: classical-probability
例子: birthday-problem, monty-hall
alias: 摸球模型, 抽签, 分房问题, 配对问题, 有放回, 无放回

常见模型及其结论：
- **摸球**：袋中 $a$ 白 $b$ 黑，无放回依次摸出，第 $k$ 次摸到白球的概率都是 $\frac a{a+b}$（抽签公平，与次序无关）；
- **分房（球入盒）**：$n$ 个人随机分到 $N$ 个房间，每间至多一人的概率 $\frac{A_N^n}{N^n}$——生日问题即 $N=365$；
- **配对**：$n$ 人随机拿帽子，没人拿对的概率 $\to\frac1\ee$（[[derangement]]）；
- **有放回与无放回**：对应二项分布与超几何分布。

### 证明（抽签公平）
把 $a+b$ 个球全部排成一列，所有排列等可能；第 $k$ 个位置是白球的排列占 $\frac a{a+b}$，由对称性与 $k$ 无关。

## 几何概型 {#geometric-probability}
type: 模型 | en: Geometric probability | w: 3 | 考纲: 典型概率模型
前置: classical-probability
例子: buffon-needle
alias: 几何概型, 会面问题, 长度比, 面积比

样本空间是区域，概率与长度、面积、体积成正比：$\PP(A)=\frac{\mu(A)}{\mu(\Omega)}$。

### 例题
**会面问题**：两人约定 $0$ 到 $60$ 分钟内到达，先到者等 $20$ 分钟后离开。到达时间 $(x,y)$ 均匀分布在正方形内，会面 $\iff\abs{x-y}\le20$，概率 $1-\frac{40^2}{60^2}=\frac59$。

### 注记
“等可能”需要明确规定：贝特朗悖论问在圆中“随机”取一条弦，弦长超过内接正三角形边长的概率，按三种不同的“随机”方式会得到 $\frac13,\frac12,\frac14$ 三个答案。

## 蒲丰投针 {#buffon-needle}
type: 例题 | en: Buffon's needle | w: 3 | 考纲: 典型概率模型
前置: geometric-probability
相关: monte-carlo
alias: Buffon 投针, 用概率估计 π

地面上画着间距为 $d$ 的平行线，随机投一根长 $l\le d$ 的针，与直线相交的概率为 $\frac{2l}{\pi d}$。

### 推导
设针的中点到最近直线的距离 $x\in\left[0,\frac d2\right]$，针与直线的夹角 $\theta\in[0,\pi]$，二者均匀独立。相交 $\iff x\le\frac l2\sin\theta$，概率
$$\frac{\int_0^\pi\frac l2\sin\theta\,\dd\theta}{\frac d2\cdot\pi}=\frac{2l}{\pi d}.$$

### 注记
这是蒙特卡罗方法的早期例子：大量投针，用相交频率估计 $\pi$。

## 条件概率 {#conditional-probability}
type: 定义 | en: Conditional probability | w: 5 | 考纲: 条件概率
前置: probability-axioms
后续: multiplication-rule, independence, total-probability, bayes
alias: 条件概率, P(A|B)

在 $B$ 已经发生的条件下 $A$ 发生的概率：
$$\PP(A\mid B)=\frac{\PP(A\cap B)}{\PP(B)},\qquad\PP(B)>0.$$
相当于把样本空间缩小为 $B$，再按比例重新分配概率。

### 例题
一个家庭有两个孩子，已知至少有一个男孩，两个都是男孩的概率是多少？$\Omega=\{\text{男男},\text{男女},\text{女男},\text{女女}\}$，条件事件有 $3$ 个样本点，所求为 $\frac13$（不是 $\frac12$）。若已知“老大是男孩”，答案才是 $\frac12$——条件的细微差别改变答案。

## 乘法公式 {#multiplication-rule}
type: 公式 | en: Multiplication rule | w: 4 | 考纲: 概率乘法公式
源于: conditional-probability
后续: total-probability
alias: 概率乘法公式, 链式法则

$$\PP(AB)=\PP(A)\PP(B\mid A),\qquad\PP(A_1A_2\cdots A_n)=\PP(A_1)\PP(A_2\mid A_1)\cdots\PP(A_n\mid A_1\cdots A_{n-1}).$$

### 例题
袋中 $3$ 红 $2$ 白，无放回连取三次，依次为红、红、白的概率：$\frac35\cdot\frac24\cdot\frac23=\frac15$。逐次写出条件概率比直接计数更清楚。

## 独立事件 {#independence}
type: 定义 | en: Independent events | w: 5 | 考纲: 独立事件
前置: conditional-probability
后续: bernoulli-binomial, joint-distribution
相关: mutually-exclusive
alias: 相互独立, 两两独立, 独立重复试验

$A,B$ 独立：$\PP(AB)=\PP(A)\PP(B)$（等价于 $\PP(A\mid B)=\PP(A)$，若 $\PP(B)>0$）。多个事件相互独立要求任意子族的交的概率都等于概率之积。

### 例题
两两独立不等于相互独立：掷两枚硬币，$A$=第一枚正面，$B$=第二枚正面，$C$=两枚相同。$A,B,C$ 两两独立（各对交的概率都是 $\frac14$），但 $\PP(ABC)=\frac14\ne\frac18$。

### 注记
独立性通常是建模假设（如不同次抛硬币），而不是计算出来的结论。“正面已经连续出现 $10$ 次，下一次更可能是反面”是赌徒谬误。

## 互斥事件与对立事件 {#mutually-exclusive}
type: 定义 | en: Mutually exclusive events | w: 4 | 考纲: 互斥事件
前置: probability-axioms
alias: 互斥, 互不相容, 对立事件

$AB=\varnothing$ 时称 $A,B$ 互斥，此时 $\PP(A\cup B)=\PP(A)+\PP(B)$；若还有 $A\cup B=\Omega$，称为对立事件，$\PP(\bar A)=1-\PP(A)$。

### 辨析
互斥与独立是完全不同的概念：若 $\PP(A),\PP(B)>0$ 且互斥，则 $\PP(AB)=0\ne\PP(A)\PP(B)$，所以一定不独立——一个发生就意味着另一个不发生，这正是强烈的依赖。

## 全概率公式 {#total-probability}
type: 公式 | en: Law of total probability | w: 5 | 考纲: 全概率公式
前置: multiplication-rule, mutually-exclusive
推出: bayes
alias: 全概率公式, 分情况讨论, 完备事件组

若 $B_1,\dots,B_n$ 两两互斥且并为 $\Omega$（完备事件组），则
$$\PP(A)=\sum_{i=1}^n\PP(B_i)\PP(A\mid B_i).$$
“由因求果”：按导致 $A$ 的不同原因分类，再加权平均。

### 例题
三台机器生产同一种零件，产量占 $50\%,30\%,20\%$，次品率分别为 $1\%,2\%,3\%$。任取一件是次品的概率：$0.5\times0.01+0.3\times0.02+0.2\times0.03=0.017$。

### 注记
它是 [[addition-principle|加法原理]] 在概率中的形式，也是递推求概率（如 [[gambler-ruin]]）的基本工具：对第一步分类。

## 贝叶斯公式 {#bayes}
type: 公式 | en: Bayes' theorem | w: 5 | 考纲: 全概率公式, 条件概率
源于: total-probability
应用于: monty-hall
alias: 贝叶斯定理, 逆概率, 先验, 后验, 似然

$$\PP(B_i\mid A)=\frac{\PP(B_i)\PP(A\mid B_i)}{\sum_j\PP(B_j)\PP(A\mid B_j)}.$$
“由果溯因”：观察到 $A$ 后，把先验概率 $\PP(B_i)$ 更新为后验概率 $\PP(B_i\mid A)$。

### 例题
某病发病率 $0.1\%$，检测灵敏度 $99\%$，假阳性率 $1\%$。某人检测阳性，真正患病的概率：
$$\frac{0.001\times0.99}{0.001\times0.99+0.999\times0.01}\approx9\%.$$
因为健康人太多，假阳性的绝对数量远多于真阳性——忽视基础比率是常见的认知错误。

### 应用
垃圾邮件过滤、医学诊断、机器学习中的朴素贝叶斯分类、贝叶斯统计推断。

## 生日问题 {#birthday-problem}
type: 例题 | en: Birthday problem | w: 3 | 考纲: 古典概率计算, 典型概率模型
是例子: classic-probability-models
alias: 生日悖论, 碰撞概率

$23$ 个人中至少两人同一天生日的概率超过 $50\%$（不计闰年、假设生日均匀）。

### 计算
所有人生日都不同的概率 $\frac{365\cdot364\cdots(365-n+1)}{365^n}=\prod_{k=1}^{n-1}\left(1-\frac k{365}\right)\approx\ee^{-\frac{n(n-1)}{730}}$。$n=23$ 时约为 $0.493$，所以至少一对相同的概率约 $0.507$；$n=57$ 时超过 $99\%$。

### 注记
直觉偏差在于：我们想的是“与我同生日”，而问题问的是“任意一对”，$23$ 人有 $253$ 对。密码学中的生日攻击：$N$ 种哈希值大约只需 $\sqrt N$ 次尝试就会出现碰撞。

## 三门问题 {#monty-hall}
type: 例题 | en: Monty Hall problem | w: 3 | 考纲: 条件概率, 全概率公式
是例子: classic-probability-models
用到: bayes
alias: 蒙提霍尔问题, 换门问题

三扇门后一辆车两只羊。你选一扇门后，知道答案的主持人打开另一扇有羊的门，问你是否换门。换门赢车的概率是 $\frac23$，不换是 $\frac13$。

### 解释
最初选中车的概率是 $\frac13$；这时换门必输。最初选中羊（概率 $\frac23$）时，主持人被迫打开另一只羊，剩下的门一定是车，换门必赢。主持人的行为不是随机的——他“知道”并“必须”开羊门，这携带了信息。

### 注记
如果主持人是随机开门、碰巧开到羊，那么换不换都是 $\frac12$。条件概率依赖于信息是如何产生的。
