---
galaxy: prob
cluster: regression
title: 一元线性回归
en: Simple linear regression
order: 8
level: core
---

## 一元线性回归模型 {#linear-regression}
type: 模型 | en: Simple linear regression | w: 5 | 考纲: 一元线性回归
前置: covariance, least-squares
后续: ols-unbiased, r-squared, residual-analysis
anim: regression
alias: 线性回归, 回归方程, 回归直线, y=a+bx
tags: 回归

假设 $Y=\beta_0+\beta_1x+\eps$，其中 $\eps$ 是均值为零、方差为 $\sigma^2$ 的随机误差，各次观测的误差相互独立。用最小二乘法从数据 $(x_i,y_i)$ 估计系数：
$$\hat\beta_1=\frac{\sum(x_i-\bar x)(y_i-\bar y)}{\sum(x_i-\bar x)^2}=r\frac{s_y}{s_x},\qquad\hat\beta_0=\bar y-\hat\beta_1\bar x.$$
回归直线一定经过样本中心 $(\bar x,\bar y)$。

### 注记
“线性”指对参数线性：$y=\beta_0+\beta_1x+\beta_2x^2$ 也是线性回归；$y=a\ee^{bx}$ 取对数后可化为线性回归。回归描述相关，不证明因果。

## 最小二乘法 {#least-squares}
type: 方法 | en: Least squares | w: 5 | 考纲: 最小二乘
前置: multivar-extrema
用到: orthogonal-projection
后续: linear-regression, least-squares-numerical, least-squares-approx
alias: 最小二乘, 残差平方和, 正规方程, 高斯, 勒让德

选择参数使残差平方和 $Q=\sum(y_i-\beta_0-\beta_1x_i)^2$ 最小。令偏导数为零得正规方程，矩阵形式 $X\T X\vv\beta=X\T\vv y$，$\hat{\vv\beta}=(X\T X)^{-1}X\T\vv y$。

### 推导
$\frac{\partial Q}{\partial\beta_0}=-2\sum(y_i-\beta_0-\beta_1x_i)=0$ 推出直线过 $(\bar x,\bar y)$；$\frac{\partial Q}{\partial\beta_1}=-2\sum x_i(y_i-\beta_0-\beta_1x_i)=0$，代入第一式即得 $\hat\beta_1$。$Q$ 是凸二次函数，驻点就是最小点。

### 几何意义
$\vv y\in\R^n$ 在 $X$ 的列空间上的正交投影就是拟合值 $\hat{\vv y}=X\hat{\vv\beta}$，残差向量与列空间正交——这正是正规方程 $X\T(\vv y-X\hat{\vv\beta})=\vv0$ 的含义（[[orthogonal-projection]]）。

### 注记
勒让德（1805）首先发表，高斯声称自 1795 年就在使用，并用它准确预测了谷神星的位置。若误差服从正态分布，最小二乘估计就是极大似然估计。

## 回归现象 {#regression-to-mean}
type: 现象 | en: Regression to the mean | w: 4 | 考纲: 回归现象
前置: correlation-coefficient
相关: linear-regression
alias: 均值回归, 回归效应, 高尔顿, 回归谬误

高尔顿研究父子身高时发现：特别高的父亲，儿子平均也偏高，但没有父亲那么高；特别矮的父亲，儿子平均也没那么矮——都“回归”到平均值附近。“回归”一词由此而来。

### 解释
标准化后，回归直线为 $\frac{\hat y-\bar y}{s_y}=r\frac{x-\bar x}{s_x}$。只要 $\abs r<1$，预测值离均值的标准化距离就比 $x$ 的更小。这不需要任何因果机制：只要两个量不完全相关，极端值的一部分就来自偶然，下次不会重现。

### 回归谬误
- 某次考试最差的学生接受辅导后成绩提高——即使辅导无效也会如此；
- 体育杂志封面诅咒：登上封面的运动员此前状态极佳，之后表现往往下滑；
- 飞行教官发现表扬后学员下次变差、批评后变好，于是错误地认为批评更有效（卡尼曼的例子）。

正确的做法是设置随机对照组。

## 相关系数 {#correlation-coefficient}
type: 定义 | en: Sample correlation coefficient | w: 4 | 考纲: 一元线性回归
前置: covariance, sample-variance
后续: regression-to-mean, r-squared
alias: 皮尔逊相关系数, 样本相关系数, r, 正相关, 负相关

$$r=\frac{\sum(x_i-\bar x)(y_i-\bar y)}{\sqrt{\sum(x_i-\bar x)^2\sum(y_i-\bar y)^2}}\in[-1,1].$$
它是中心化后的数据向量 $(x_i-\bar x)$ 与 $(y_i-\bar y)$ 夹角的余弦。$\abs r$ 越接近 $1$，散点越接近一条直线。

### 注记
- $r=0$ 只说明没有线性关系：$y=x^2$ 在对称区间上 $r=0$。
- 安斯库姆四重奏：四组数据的均值、方差、相关系数、回归直线完全相同，散点图却截然不同——一定要画图。
- 相关不等于因果：冰淇淋销量与溺水人数正相关，因为都随气温上升。

## 最小二乘估计的无偏性 {#ols-unbiased}
type: 定理 | en: Unbiasedness of least-squares estimators | w: 4 | 考纲: 无偏估计, 最小二乘
前置: linear-regression, unbiased-estimator
alias: OLS 无偏, 高斯-马尔可夫定理, BLUE, 回归系数的方差

在模型 $Y_i=\beta_0+\beta_1x_i+\eps_i$（$\E\eps_i=0$）下，$\E\hat\beta_1=\beta_1$，$\E\hat\beta_0=\beta_0$；若误差不相关且同方差 $\sigma^2$，则
$$\Var\hat\beta_1=\frac{\sigma^2}{\sum(x_i-\bar x)^2}.$$

### 证明
$\hat\beta_1=\sum c_iY_i$，$c_i=\frac{x_i-\bar x}{\sum(x_j-\bar x)^2}$，且 $\sum c_i=0$，$\sum c_ix_i=1$。于是 $\E\hat\beta_1=\sum c_i(\beta_0+\beta_1x_i)=\beta_1$，$\Var\hat\beta_1=\sigma^2\sum c_i^2=\frac{\sigma^2}{\sum(x_i-\bar x)^2}$。

### 注记
高斯–马尔可夫定理：在所有线性无偏估计中，最小二乘估计的方差最小（BLUE）。方差公式说明：$x$ 取值越分散，斜率估计越精确——设计实验时应让自变量覆盖较宽的范围。$\sigma^2$ 的无偏估计是 $\frac{1}{n-2}\sum e_i^2$（两个参数，减 $2$ 个自由度）。

## 决定系数 {#r-squared}
type: 定义 | en: Coefficient of determination | w: 3 | 考纲: 一元线性回归
前置: linear-regression, correlation-coefficient
alias: R², 拟合优度, 平方和分解, 方差分解

总平方和分解为回归平方和与残差平方和：
$$\sum(y_i-\bar y)^2=\sum(\hat y_i-\bar y)^2+\sum(y_i-\hat y_i)^2,$$
$R^2=\frac{\text{回归平方和}}{\text{总平方和}}$ 表示 $y$ 的变异中被回归直线解释的比例。一元线性回归中 $R^2=r^2$。

### 证明（分解）
交叉项 $\sum(\hat y_i-\bar y)(y_i-\hat y_i)=0$，因为残差与常数向量、与 $x$ 都正交——勾股定理。

### 注记
$R^2$ 高不代表模型正确（可能是非线性关系或有异常点），$R^2$ 低也不代表 $x$ 没有作用（$y$ 可能受许多其他因素影响）。

## 残差分析 {#residual-analysis}
type: 方法 | en: Residual analysis | w: 3 | 考纲: 一元线性回归
前置: linear-regression
alias: 残差, 残差图, 异常点, 模型诊断, 异方差

残差 $e_i=y_i-\hat y_i$ 是模型没能解释的部分。画出残差对 $x$（或 $\hat y$）的散点图：若模型合适，残差应无规律地散布在 $0$ 附近、宽度大致不变。

### 诊断
- 残差呈弯曲形状：关系非线性，考虑加二次项或变换；
- 残差随 $x$ 增大而发散（喇叭形）：异方差，考虑取对数或加权最小二乘；
- 个别残差特别大：异常点，检查数据录入或是否属于不同总体；
- 杠杆点：$x$ 远离 $\bar x$ 的点对回归直线影响特别大。
