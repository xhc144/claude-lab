---
galaxy: hs
cluster: hs-sets-logic
title: 集合与常用逻辑
en: Sets and logic
order: 1
level: hs
---

## 集合 {#set}
type: 概念 | en: Set | w: 5 | 考纲: 中学数学全部内容
alias: 元素, 属于, 空集, 子集
tags: 集合
后续: function, set-operations

集合是把确定的、互不相同的对象看作一个整体；对象称为元素，$a\in A$ 表示 $a$ 属于 $A$。几乎所有数学对象——数系、函数、空间、群——都用集合的语言描述。

> [!定义] 子集与相等
> 若 $A$ 的每个元素都属于 $B$，称 $A$ 是 $B$ 的子集，记 $A\subseteq B$；$A=B$ 当且仅当 $A\subseteq B$ 且 $B\subseteq A$。不含任何元素的集合称为空集 $\varnothing$，它是任何集合的子集。

### 注记
- 集合三性：确定性、互异性、无序性。$\{1,1,2\}$ 与 $\{2,1\}$ 是同一个集合。
- $n$ 元集合有 $2^n$ 个子集（每个元素选或不选），见 [[multiplication-principle]]。
- 常用数集：$\N$ 自然数（含 $0$）、$\N^*$ 正整数、$\Z$、$\Q$、$\R$、$\C$。
- “所有集合构成的集合”会导致罗素悖论 $\{x : x\notin x\}$，公理化集合论用分离公理等限制集合的构造方式来避免它。

## 集合的运算 {#set-operations}
type: 概念 | en: Set operations | w: 3 | 考纲: 中学数学全部内容
前置: set
应用于: inclusion-exclusion, sample-space
alias: 交集, 并集, 补集, 德摩根律, 韦恩图

交集 $A\cap B$、并集 $A\cup B$、补集 $\complement_U A$。它们满足交换律、结合律、分配律和德摩根律：
$$\complement_U(A\cup B)=\complement_UA\cap\complement_UB,\qquad \complement_U(A\cap B)=\complement_UA\cup\complement_UB.$$

### 例题
设 $A=\{x\mid x^2-3x+2=0\}$，$B=\{x\mid ax=1\}$，若 $A\cup B=A$，求实数 $a$。

**解**：$A=\{1,2\}$，$A\cup B=A$ 等价于 $B\subseteq A$。$a=0$ 时 $B=\varnothing$ 满足；$a\ne0$ 时 $B=\{\frac1a\}$，需 $\frac1a\in\{1,2\}$，$a=1$ 或 $\frac12$。所以 $a\in\{0,\frac12,1\}$。别漏掉空集的情形。

### 应用
集合运算与逻辑联结词一一对应：$\cap$ 对应“且”，$\cup$ 对应“或”，补集对应“非”。概率论中事件就是样本空间的子集，事件的运算就是集合的运算。

## 逻辑联结词与命题 {#logic-connectives}
type: 概念 | en: Propositions and connectives | w: 3 | 考纲: 中学数学全部内容
前置: set
后续: quantifiers, necessary-sufficient, proof-by-contradiction
alias: 命题, 且, 或, 非, 逆命题, 否命题, 逆否命题

能判断真假的陈述叫命题。用“且（$\land$）、或（$\lor$）、非（$\lnot$）”组合命题，真值由真值表确定。原命题“若 $p$ 则 $q$”与其逆否命题“若 $\lnot q$ 则 $\lnot p$”同真同假。

| $p$ | $q$ | $p\land q$ | $p\lor q$ | $p\Rightarrow q$ |
|:-:|:-:|:-:|:-:|:-:|
| 真 | 真 | 真 | 真 | 真 |
| 真 | 假 | 假 | 真 | 假 |
| 假 | 真 | 假 | 真 | 真 |
| 假 | 假 | 假 | 假 | 真 |

### 注记
- “$p\Rightarrow q$”只在 $p$ 真 $q$ 假时为假；前提为假时整个蕴含为真（“空真”）。
- 逆命题与否命题互为逆否，也同真同假；但原命题与逆命题的真假无关。
- 德摩根律：$\lnot(p\land q)\equiv\lnot p\lor\lnot q$，与集合的德摩根律是同一回事。

## 全称量词与存在量词 {#quantifiers}
type: 概念 | en: Quantifiers | w: 3 | 考纲: 中学数学全部内容
前置: logic-connectives
后续: sequence-limit
alias: 任意, 存在, 量词的否定

“对任意 $x\in M$，$p(x)$”记 $\forall x\in M,\ p(x)$；“存在 $x\in M$ 使 $p(x)$”记 $\exists x\in M,\ p(x)$。否定时量词互换、结论取否：
$$\lnot\left(\forall x,\ p(x)\right)\equiv\exists x,\ \lnot p(x),\qquad \lnot\left(\exists x,\ p(x)\right)\equiv\forall x,\ \lnot p(x).$$

### 例题
写出“数列 $a_n$ 收敛于 $a$”的否定。

原命题：$\forall\eps>0,\ \exists N,\ \forall n>N,\ \abs{a_n-a}<\eps$。
否定：$\exists\eps>0,\ \forall N,\ \exists n>N,\ \abs{a_n-a}\ge\eps$。逐个翻转量词，最后否定不等式。

### 注记
量词的顺序不能随便交换：“$\forall x\ \exists y,\ y>x$”为真（实数没有最大者），“$\exists y\ \forall x,\ y>x$”为假。分析中“连续”与“一致连续”的区别正是 $\delta$ 能否先于点 $x$ 选取，见 [[uniform-continuity]]。

## 充分条件与必要条件 {#necessary-sufficient}
type: 概念 | en: Sufficient and necessary conditions | w: 4 | 考纲: 中学数学全部内容
前置: logic-connectives
alias: 充分不必要, 必要不充分, 充要条件, 当且仅当

若 $p\Rightarrow q$，称 $p$ 是 $q$ 的充分条件，$q$ 是 $p$ 的必要条件；若 $p\Leftrightarrow q$，称二者互为充要条件。用集合看：设 $P=\{x\mid p(x)\}$、$Q=\{x\mid q(x)\}$，则 $p\Rightarrow q$ 等价于 $P\subseteq Q$。

### 例题
“$x>1$”是“$x^2>1$”的什么条件？

**解**：$\{x\mid x>1\}\subsetneq\{x\mid x^2>1\}=(-\infty,-1)\cup(1,+\infty)$，所以是充分不必要条件。

### 注记
“小范围推出大范围”：充分条件对应的集合较小。数学定理里的“当且仅当”往往由两个方向的证明组成，例如 [[cauchy-criterion]] 的必要性与充分性。

## 反证法 {#proof-by-contradiction}
type: 方法 | en: Proof by contradiction | w: 4 | 考纲: 中学数学全部内容
前置: logic-connectives
例子: irrational-sqrt2, infinitude-primes
alias: 归谬法, 反设

要证 $p$，先假设 $\lnot p$，推出矛盾（与已知、公理或假设本身冲突），从而 $p$ 成立。适合结论是“否定式”“唯一性”“无穷性”“至多/至少”的命题。

### 例题
证明：若 $a,b,c$ 都是奇数，则 $ax^2+bx+c=0$ 没有有理根。

**证**：反设有有理根 $\frac pq$（$p,q$ 互素），则 $ap^2+bpq+cq^2=0$。若 $p,q$ 都是奇数，三项均为奇数，和为奇数；若一奇一偶，三项中恰有两项为偶数、一项为奇数，和为奇数。$p,q$ 不能都是偶数。所以和不可能为 $0$，矛盾。

### 注记
反证法依赖排中律。与之相关的是逆否证法（证明 $\lnot q\Rightarrow\lnot p$）。经典例子：[[irrational-sqrt2]]、[[infinitude-primes]]、[[uncountable-reals]]。
