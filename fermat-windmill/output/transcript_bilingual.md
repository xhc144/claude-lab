# 风车里的素数 · Primes in a Windmill

**中英对照讲稿** · 费马平方和定理与扎吉尔的一句话证明 / Fermat's two-square theorem and Zagier's one-sentence proof

视频：中文版约 23 分钟，英文版约 26 分钟。

## 选题与使用说明

**选题：费马平方和定理（扎吉尔的“一句话证明”与风车图）。** 一个奇素数 p 能写成两个平方数之和，当且仅当 p 除以 4 余 1。

为什么选它：陈述一句话就能讲清，容易让考官进入话题；必要性一行可证，充分性却是纯存在性命题，正好展示
“怎样证明存在”的思想；扎吉尔的证明短到惊人，却能被一幅风车图完全解释；而且它连着奇偶论证、不动点、
算法、高斯整数、勾股数和 π，几乎每个方向都能接住考官的追问。它也和你已经讲过的布劳威尔不动点定理
（不动点）、斯潘纳引理（奇偶）自然相连，可以形成一条贯穿的“个人数学兴趣”主线。

**使用建议：** ① 先看中文版，弄懂每一步“为什么”；② 再看英文版（语速约每分钟 140 词），按字幕跟读，
注意黄色高亮的难词和音标；③ 熟读并背下“一分钟版本”和“三分钟版本”；④ 用“追问地图”自测：
遮住答案，看到问题能否用英文在 30–60 秒内答出要点。

## 面试速用：可以直接说的英文回答

### 一分钟版本：“你最喜欢的定理是什么？”

*One-minute answer: "What is your favorite theorem?"*

> My favorite theorem is Fermat's two-square theorem. It says that an odd prime p can be written as a sum of two squares if and only if p leaves remainder one when divided by four. One direction is easy, because every square is zero or one mod four. The other direction is a pure existence statement, and the proof I love is Don Zagier's one-sentence proof. It looks at all positive solutions of x squared plus four y z equals p. Swapping y and z pairs these solutions up, and the unpaired ones are exactly the ones we want. A second pairing, which you can see by re-cutting a windmill-shaped picture, leaves exactly one solution unpaired. So the number of solutions is odd, and the first pairing must leave something unpaired too. What I love is that it proves existence just by counting, modulo two.

我最喜欢的定理是费马平方和定理：一个奇素数 p 能写成两个平方数之和，当且仅当 p 除以 4 余 1。 其中一个方向很容易，因为任何平方数除以 4 只能余 0 或 1。另一个方向是纯粹的存在性命题， 我最喜欢的证明是扎吉尔的一句话证明。它考察 x² + 4yz = p 的所有正整数解。交换 y 和 z 把这些解两两配对， 没有配上对的，恰好就是我们想要的解。另一种配对——可以通过重新切割一个风车形状的图看出来——恰好只留下一个解没有配对。 所以解的个数是奇数，第一种配对也一定会留下没有配对的解。我喜欢它，是因为它只靠“数奇偶”就证明了存在性。

### 三分钟版本：完整陈述（含背景、证明思路、条件与推广）

*Three-minute version: the full story*

> My favorite theorem is Fermat's two-square theorem: an odd prime is a sum of two squares exactly when it is one more than a multiple of four. For example, thirteen is four plus nine, but seven can never be written that way. Fermat stated it in a letter on Christmas Day, 1640, but the first published proof came from Euler more than a century later. The easy half is a congruence argument: squares are zero or one mod four, so a sum of two squares is never three mod four. The hard half is an existence statement, and I like Zagier's proof from 1990, which is famous for being a single sentence. The idea is to prove existence by counting modulo two. You take the set S of positive triples with x squared plus four y z equal to p. Swapping y and z is an involution, a map that undoes itself, and its fixed points are exactly the solutions p equals x squared plus the square of two y. An involution pairs up everything except its fixed points, so it is enough to show that S has an odd number of elements. For that, Zagier uses a second involution. If you draw x squared plus four y z as a square with four rectangular blades, like a windmill, then the second involution simply re-cuts the same outline around a different central square. Its only fixed point is the symmetric cross, and this is exactly where we use that p is prime. So S is odd, and the swap has a fixed point. Two things make it even nicer. First, the proof hides an algorithm: alternating the two involutions from the cross walks you straight to a solution, just like the path-following proof of Sperner's lemma. Second, it opens many doors: Gaussian integers, the characterization of all sums of two squares, Pythagorean triples, and even a formula for pi. For me, the lesson is that a clever count and a good picture can replace a long computation.

我最喜欢的定理是费马平方和定理：一个奇素数是两个平方数之和，当且仅当它比 4 的倍数多 1。比如 13 = 4 + 9， 而 7 永远写不成这种形式。费马在 1640 年圣诞节的一封信里提出了它，但第一个公开发表的证明要等到一百多年后的欧拉。 容易的一半是同余论证：平方数除以 4 余 0 或 1，所以两个平方数之和除以 4 不可能余 3。困难的一半是存在性命题， 我喜欢扎吉尔 1990 年的证明，它以“只有一句话”而闻名。思路是用“数奇偶”来证明存在。取所有满足 x² + 4yz = p 的正整数三元组组成的集合 S。交换 y 和 z 是一个对合，也就是能抵消自身的映射，它的不动点恰好是 p = x² + (2y)² 的解。对合会把除不动点以外的元素两两配对，所以只要证明 S 的元素个数是奇数。为此，扎吉尔用了第二个对合。 如果把 x² + 4yz 画成一个正方形加上四片长方形风叶的“风车”，第二个对合就是围绕另一个中心正方形重新切割同一个轮廓。 它唯一的不动点是对称的十字，而这一步正好用到了 p 是素数。于是 S 的元素个数是奇数，交换也有不动点。 还有两点让它更漂亮。第一，证明里藏着一个算法：从十字出发交替使用两个对合，就能一路走到一个解， 这和斯潘纳引理的路径跟踪证明如出一辙。第二，它通向很多地方：高斯整数、一般整数的平方和判定、勾股数， 甚至 π 的公式。对我来说，它的启示是：巧妙的计数加上一幅好图，可以代替冗长的计算。

## 追问地图（12 层）

| # | 层次 | Examiner asks | 考官问 |
|---|---|---|---|
| Q1 | 开场 · Opening | So, what is your favorite theorem? | 那么，你最喜欢的定理是什么？ |
| Q2 | 必要性 · Necessity | Can you show me why primes of the form four k plus three can't work? | 你能说明一下，为什么形如 4k+3 的素数不行吗？ |
| Q3 | 条件边界 · Hypotheses | Is that condition enough for any number, not just for primes? | 这个条件对任意整数都够用吗，而不只是素数？ |
| Q4 | 证明 · Proof | Good. How would you prove the hard direction? | 很好。那困难的那个方向，你会怎么证明？ |
| Q5 | 条件用在哪 · Where is primality used | Where exactly do you use the fact that p is prime? | 你到底在哪里用到了 p 是素数？ |
| Q6 | 动机 · Motivation | Interesting. But how would anyone come up with that second involution? | 有意思。可是，人怎么会想到第二个对合呢？ |
| Q7 | 构造性 · Construction | Your proof only shows existence. Can you actually find x and y? | 你的证明只说明了存在性。你能真的找出 x 和 y 吗？ |
| Q8 | 另一种证明 · Another proof | Do you know any other proof? | 你还知道别的证明吗？ |
| Q9 | 细节追问 · Detail | Why is minus one a square modulo p? | 为什么 −1 是模 p 的平方？ |
| Q10 | 推广 · Generalization | What about sums of three squares? | 那三个平方数之和呢？ |
| Q11 | 应用 · Applications | Is there an application you find meaningful? | 有没有你觉得有意义的应用？ |
| Q12 | 反思 · Reflection | Last question. What did you learn from this theorem? | 最后一个问题。你从这个定理里学到了什么？ |

## 逐段对照讲稿

### 01 引子 · Opening

Imagine you are in an interview, and the professor asks you, "What is your favorite theorem?"

设想你正在面试，老师突然问你：你最喜欢的数学定理是什么？

<sub>**theorem** /ˈθɪrəm/ 定理</sub>

Here is mine. Take the primes five, thirteen, seventeen and twenty-nine. Each of them is a sum of two squares. Five is one plus four. Thirteen is four plus nine. Seventeen is one plus sixteen. And twenty-nine is four plus twenty-five.

我的答案，要从几个素数说起。看 5、13、17、29。它们都能写成两个平方数之和。5 等于 1 加 4。13 等于 4 加 9。17 等于 1 加 16。29 等于 4 加 25。

<sub>**prime** /praɪm/ 素数</sub>

But three, seven, eleven and nineteen never are, no matter how hard you try.

可是 3、7、11、19，无论怎么拼，都拼不出来。

What separates the two groups? Divide by four. The first group leaves remainder one. The second group leaves remainder three.

这两组数的差别在哪里？除以 4 看余数。第一组都余 1，第二组都余 3。

<sub>**remainder** /rɪˈmeɪndɚ/ 余数</sub>

This is Fermat's two-square theorem. Today I want to show you a proof of it that fits in one sentence, and a picture of windmills that explains why that sentence works.

这就是费马平方和定理。今天我想讲它的一个只有一句话的证明，以及一幅解释这句话为什么成立的风车图。

<sub>**windmill** /ˈwɪndmɪl/ 风车</sub>

### 02 定理与历史 · Statement and history

First, the precise statement. Let p be an odd prime. Then p can be written as x² + y², with x and y integers, if and only if p is congruent to one, modulo four.

先把定理说准确。设 p 是奇素数。那么 p 能写成 x² + y²，其中 x、y 是整数，当且仅当 p 除以 4 余 1。

<sub>**if and only if** /ɪf ənd ˈoʊnli ɪf/ 当且仅当 · **congruent** /ˈkɑːŋɡruənt/ 同余的 · **modulo** /ˈmɑːdʒəloʊ/ 模（取余） · **integer** /ˈɪntɪdʒɚ/ 整数</sub>

Geometrically, the circle x² + y² = p passes through points of the integer lattice exactly when p is one more than a multiple of four.

换成几何的说法：圆 x² + y² = p 会穿过网格上的整点，恰好是在 p 除以 4 余 1 的时候。

<sub>**lattice** /ˈlætɪs/ 格点（网格）</sub>

The story begins with Fermat. In a letter to Mersenne, dated Christmas Day, 1640, he stated this theorem and claimed he had a proof. As usual, he never wrote it down. That is why it is sometimes called Fermat's Christmas theorem.

故事从费马开始。1640 年的圣诞节，他在写给梅森的信里宣布了这个结论，还说自己有证明。但和往常一样，他没有把证明写下来。所以这个定理也被叫作费马圣诞定理。

The first published proof came more than a century later, from Euler, using a method called infinite descent. Later came a deeper explanation, through what we now call the Gaussian integers, named after Gauss.

第一个公开的证明，要等到一百多年后的欧拉，他用的是无穷递降法。后来，人们又借助以高斯命名的高斯整数，给出了更深刻的解释。

<sub>**infinite descent** /ˈɪnfɪnət dɪˈsent/ 无穷递降法 · **Gaussian integers** /ˈɡaʊsiən ˈɪntɪdʒɚz/ 高斯整数</sub>

And in 1990, Don Zagier published a paper with a remarkable title. A one-sentence proof that every prime p congruent to one mod four is a sum of two squares. It builds on an earlier idea of Roger Heath-Brown. That one sentence is what we will unpack today.

到了 1990 年，扎吉尔发表了一篇标题很特别的论文：用一句话证明，每个除以 4 余 1 的素数都是两个平方数之和。它建立在希思布朗更早的一个想法之上。今天要拆开来看的，就是这一句话。

<sub>**remarkable** /rɪˈmɑːrkəbəl/ 非凡的 · **unpack** /ʌnˈpæk/ 拆解、剖析</sub>

### 03 容易的方向 · The easy direction

One direction is easy, and it is worth seeing first. Every square leaves remainder zero or one when divided by four. An even number squared is a multiple of four. An odd number squared is one more than a multiple of four.

其中一个方向很容易，值得先看。任何平方数除以 4，余数只能是 0 或 1。偶数的平方是 4 的倍数。奇数的平方，是 4 的倍数再加 1。

Look, the square of an odd number splits into one small square in the middle, plus four equal rectangles. Keep this little windmill in mind. We will meet it again.

你看，一个奇数的平方，正好可以拆成中间一个小方块，加上四个相同的长方形。这幅“风车”一样的图，我们待会儿还会见到。

<sub>**rectangle** /ˈrektæŋɡəl/ 长方形</sub>

So a sum of two squares can only be zero, one or two, modulo four. Never three. That rules out every prime of the form 4k + 3.

所以两个平方数相加，除以 4 只能余 0、1 或 2，永远不会余 3。这就排除了所有形如 4k + 3 的素数。

But notice something. Twenty-one is also one more than a multiple of four, and yet it is not a sum of two squares. So the condition is necessary, but on its own it is not sufficient. Primality must matter somewhere in the proof. Keep this in mind. We will find exactly where it is used.

不过要注意，21 除以 4 也余 1，可它并不是两个平方数之和。所以“除以 4 余 1”是必要条件，但单靠它并不充分。素数这个条件，一定在证明的某个地方起了作用。先记住这一点，后面我们会找到它到底用在哪里。

<sub>**necessary** /ˈnesəseri/ 必要的 · **sufficient** /səˈfɪʃənt/ 充分的 · **primality** /praɪˈmæləti/ 素性（是素数）</sub>

The real content of the theorem is the other direction. Every prime that leaves remainder one really is a sum of two squares. And that is hard, because it is a pure existence statement. There is no formula that simply hands you x and y.

定理真正的难点在另一个方向：每个除以 4 余 1 的素数，都确实能写成两个平方数之和。难就难在，这是一个纯粹的存在性命题。没有任何公式能直接告诉你 x 和 y 是多少。

<sub>**existence** /ɪɡˈzɪstəns/ 存在性</sub>

### 04 奇偶与对合 · Parity and involutions

So how do you prove that something exists without finding it? One classic answer is to count. If you can show that the number of solutions is odd, then it cannot be zero.

那么，怎样在找不到它的情况下，证明它存在？一个经典的思路是：数一数。只要能证明解的个数是奇数，它就不可能是零。

And to show that a number is odd, you do not need to count exactly. You only need to pair things up.

而要证明一个数是奇数，并不需要把它精确地数出来，只需要两两配对。

This leads to the key tool, an involution. An involution is a map from a set to itself that undoes itself. Apply it twice, and you are back where you started.

这就引出了关键工具：对合。对合是一个集合到它自身的映射，它能抵消自己：连续做两次，就回到原地。

<sub>**involution** /ˌɪnvəˈluːʃən/ 对合</sub>

An involution splits the set into pairs, a together with f of a, plus some points that are sent to themselves. Those are the fixed points.

对合会把集合分成一对一对的元素，a 和 f(a) 配成一对。剩下的，是那些被映到自己的点，叫作不动点。

<sub>**fixed point** /ˌfɪkst ˈpɔɪnt/ 不动点</sub>

The pairs always contribute an even number. So the size of the set and the number of fixed points always have the same parity.

成对的元素加起来一定是偶数个。所以，集合的大小和不动点的个数，奇偶性永远相同。

<sub>**parity** /ˈperəti/ 奇偶性</sub>

Now suppose the same finite set carries two different involutions. Their numbers of fixed points have the same parity. In particular, if one of them has exactly one fixed point, the other has an odd number of fixed points, so it has at least one.

现在假设同一个有限集合上，有两个不同的对合。它们的不动点个数奇偶性相同。特别地，如果其中一个恰好只有一个不动点，那另一个的不动点个数就是奇数，因此至少有一个。

<sub>**finite** /ˈfaɪnaɪt/ 有限的</sub>

If this sounds familiar, it should. Sperner's lemma is proved with the same kind of parity argument, by counting doors in pairs.

如果你觉得这个思路眼熟，那就对了。斯潘纳引理的证明，用的也是这种只看奇偶的配对论证，在那里我们数的是“门”。

### 05 制造对称 · Creating a symmetry

So here is the plan. We want the solutions we are looking for to appear as the fixed points of an involution.

于是计划是：让我们要找的解，以某个对合的不动点的身份出现。

Since p is odd, one of the two squares must be even. So we are really looking for p equals x squared plus the square of two y, that is, x² + 4·y·y.

因为 p 是奇数，两个平方数中必有一个是偶数的平方。所以我们真正要找的是：p 等于 x 平方，加上 2y 的平方，也就是 x² + 4·y·y。

Now comes the creative step. Replace one of the two y's by a new letter, z. Consider every triple of positive integers with x² + 4yz = p, and call this set S.

关键的创造性一步来了：把两个 y 中的一个，换成新的字母 z。考虑所有满足 x² + 4yz = p 的正整数三元组，把它们组成的集合记作 S。

<sub>**triple** /ˈtrɪpəl/ 三元组</sub>

S is finite, because x squared and y z are both smaller than p. For p equal to thirteen, for example, S has exactly three elements.

S 是有限集，因为 x 平方和 yz 都比 p 小。比如 p 等于 13 时，S 恰好有三个元素。

This new set has an obvious symmetry. Swap y and z. That is an involution, and its fixed points are exactly the triples with y equal to z. Then p equals x squared plus the square of two y. Those are precisely the solutions we want.

这个新集合有一个显而易见的对称：交换 y 和 z。这是一个对合，它的不动点恰好是 y 等于 z 的三元组。这时 p 等于 x 平方加 2y 的平方，正是我们想要的解。

<sub>**symmetry** /ˈsɪmətri/ 对称</sub>

So the whole theorem reduces to one question. Is the number of elements of S odd? And by the parity principle, it is enough to find a second involution on S with exactly one fixed point.

于是整个定理归结成一个问题：S 的元素个数是不是奇数？根据刚才的奇偶原理，只要在 S 上再找到一个恰好只有一个不动点的对合，就够了。

Notice what just happened. We did not find a symmetry. We created one, by splitting y times y into y times z. Making the problem bigger gave us room to move.

注意刚才发生了什么。我们不是发现了一个对称，而是制造了一个对称：把 y 乘 y 拆成 y 乘 z。把问题放大，反而给了我们腾挪的空间。

### 06 风车 · Windmills

To find the second involution, let us draw the equation. x squared is a square of side x. Four y z is four rectangles, each y by z. Attach one rectangle to each side of the square, all turning the same way, and you get a windmill whose area is exactly p.

为了找到第二个对合，我们把方程画出来。x 平方是一个边长是 x 的正方形。4yz 是四个 y 乘 z 的长方形。把这四个长方形沿同一个旋转方向，分别贴在正方形的四条边上，就得到一个风车，它的面积恰好是 p。

<sub>**windmill** /ˈwɪndmɪl/ 风车 · **rectangle** /ˈrektæŋɡəl/ 长方形</sub>

Every element of S is a windmill. Here are all eleven windmills of area forty-one.

S 的每个元素都是一个风车。这是面积是 41 的全部 11 个风车。

In this picture, swapping y and z simply flips each blade over, so that its length and width trade places.

在这幅图里，交换 y 和 z，就是把每片风叶翻过来，让它的长度和宽度互换。

<sub>**blade** /bleɪd/ 风叶（叶片）</sub>

The fixed windmills are the ones with square blades. And look. Four squares of side y fit together into one square of side two y. So a fixed windmill is literally p, split into two squares.

不动的风车，就是风叶是正方形的风车。你看，四个边长是 y 的小正方形，恰好拼成一个边长是 2y 的大正方形。所以一个不动的风车，就是把 p 拆成了两个平方数。

### 07 扎吉尔的重新切割 · Zagier's re-cutting

Now comes the most beautiful observation. Erase the lines inside a windmill, and keep only its outline. The outline does not remember how it was cut.

接下来是最漂亮的观察。把风车内部的分割线擦掉，只留下外轮廓。轮廓本身，并不记得自己是怎么被切割的。

<sub>**outline** /ˈaʊtlaɪn/ 轮廓</sub>

The same outline can often be cut into a windmill in a different way, around a different central square.

同一个轮廓，往往还能用另一个中心正方形，重新切割成一个风车。

Here is the rule. Look at the four tips of the blades, and draw the square through them. If that square fits inside the outline, cut along it. If it does not fit, use the square through the outer edges of the blades instead.

规则是这样的。看四片风叶的尖端，画出经过这四个尖端的正方形。如果它能放进轮廓里，就沿着它重新切割。如果放不进去，就改用经过风叶外侧边的那个正方形。

Sometimes the new square is larger, sometimes it is smaller, and sometimes the new windmill turns the other way, like a mirror image. Written in coordinates, this rule becomes Zagier's famous formula, with three cases.

新的正方形有时变大，有时变小，有时新风车的旋转方向还会反过来。把这条规则写成坐标，就是扎吉尔那个著名的三段式公式。

<sub>**mirror** /ˈmɪrɚ/ 镜像 · **coordinates** /koʊˈɔːrdənəts/ 坐标</sub>

Cutting again brings back the original windmill, so re-cutting is an involution. A larger square becomes smaller again, a smaller one becomes larger, and the mirrored case mirrors back.

再切割一次，又回到原来的风车。所以这个重新切割是一个对合：变大的会变回小，变小的会变回大，镜像的那一类会再镜像回来。

When is a windmill unchanged by re-cutting? Exactly when the square through the tips is the central square itself, that is, when x equals y.

什么样的风车在重新切割下保持不变？恰好是经过尖端的正方形就是中心正方形本身的时候，也就是 x 等于 y。

And this is where primality enters. If x equals y, then p equals x squared plus four x z, which is x times (x + 4z). Since p is prime, x must be one. So the only fixed windmill is the one with x and y both equal to one, a perfectly symmetric cross.

素数条件正是在这里登场。如果 x 等于 y，那么 p 等于 x 平方加 4xz，也就是 x 乘以 (x + 4z)。p 是素数，所以 x 只能是 1。于是唯一不动的风车，是 x 和 y 都等于 1 的那一个：一个完美对称的十字。

<sub>**primality** /praɪˈmæləti/ 素性（是素数）</sub>

One more detail. The rule never gets stuck on a boundary case. Those cases would need p to be a perfect square, or an even number, and an odd prime is neither.

还有一个细节：这条规则不会卡在边界情形上。边界情形要求 p 是完全平方数，或者是偶数，而奇素数两样都不是。

<sub>**boundary** /ˈbaʊndri/ 边界 · **perfect square** /ˈpɝːfɪkt skwer/ 完全平方数</sub>

Now put everything together. The re-cutting involution has exactly one fixed point, so S has an odd number of elements. Therefore the flipping involution also has a fixed point, a windmill with square blades. And that is p, written as a sum of two squares.

现在把一切拼起来。重新切割这个对合恰好只有一个不动点，所以 S 的元素个数是奇数。因此，翻转风叶的那个对合也一定有不动点，也就是一个风叶是正方形的风车。而它正好把 p 写成了两个平方数之和。证明完毕。

This is Zagier's entire proof, and it really is one sentence.

这就是扎吉尔的完整证明。它真的只有一句话。

### 08 为什么会想到它 · Why this proof

When I first saw the formula, it looked like magic. But every step has a reason, and the reasons are the most valuable part.

第一次看到这个公式时，它像一个魔术。但每一步其实都有理由，而这些理由，才是最值得学的东西。

First, we needed existence, not a formula. Existence follows from an odd count, and an odd count follows from pairing.

第一，我们要的是存在，不是公式。存在可以由“个数是奇数”推出，而奇偶性可以由配对得到。

Second, to use pairing, the solutions we want must be fixed points. So we built a set with a built-in symmetry, by splitting y squared into y times z.

第二，要用配对，我们想要的解就必须是不动点。所以我们把 y 平方拆成 y 乘 z，造出了一个自带对称的集合。

Third, we needed a second involution, and the algebra alone gives no hint. The picture does. An area that can be cut in two ways is a natural source of pairs.

第三，我们还需要第二个对合。只看代数式，完全看不出线索。是图形给出了提示：一块面积能用两种方式切割，天然就构成了配对。

Fourth, primality is used at exactly one sharp point, to make the fixed point unique. Test this with twenty-one. Its set S has two fixed windmills, the cross with x equal to one, and another one with x equal to three. Two is even, so the argument proves nothing. And indeed, twenty-one is not a sum of two squares.

第四，素数条件只在一个关键点上使用：保证不动点唯一。用 21 检验一下。它的集合 S 里有两个不动的风车：一个是 x 等于 1 的十字，另一个是 x 等于 3 的风车。两个是偶数，论证就推不出任何东西。而 21 也确实不是两个平方数之和。

This is a good habit in general. For any proof, ask where exactly each hypothesis is used, and what breaks without it.

这其实是一个很好的习惯。读任何证明，都问一问：每个条件到底用在哪里？去掉它，哪里会断？

<sub>**hypothesis** /haɪˈpɑːθəsɪs/ 假设、条件</sub>

### 09 从存在到算法 · From existence to an algorithm

There is one more surprise. The proof seems to say only that a solution exists, but it secretly contains an algorithm.

还有一个惊喜。这个证明看起来只说明了解存在，但它其实暗藏了一个算法。

<sub>**algorithm** /ˈælɡərɪðəm/ 算法</sub>

Start from the cross, the unique fixed point of re-cutting. Flip the blades. Re-cut. Flip again. Re-cut again. Every step is forced, and we can never return to a windmill we have already visited.

从十字出发，它是重新切割的唯一不动点。翻转风叶。重新切割。再翻转，再切割。每一步都是确定的，而且永远不会回到已经走过的风车。

Since S is finite, the walk must stop, and it can only stop at a windmill that flipping leaves unchanged. For forty-one, after ten steps we reach blades of size two by two, and we read off that forty-one is five squared plus four squared.

因为 S 是有限的，这条路一定会停下来，而且只能停在一个翻转后不变的风车上。对 41 来说，走十步之后，我们到达风叶是 2 乘 2 的风车，读出 41 等于 5 的平方加 4 的平方。

Why does this always work? Think of each windmill as a dot, and join partners with lines. Every dot has at most two lines, one of each kind, so the picture breaks into paths and loops. The cross is the end of a path, and the other end must be a solution.

为什么一定可行？把每个风车看成一个点，把互相配对的风车连起来。每个点最多连两条线，两种对合各一条，所以整张图会分解成若干条路径和圈。十字是某条路径的一个端点，那么另一个端点，必然就是我们要的解。

If you know the proof of Sperner's lemma, this is the same idea as walking through rooms and doors. It is not the fastest method, though. For large primes, there are much faster algorithms, based on the Euclidean algorithm.

如果你熟悉斯潘纳引理的证明，会发现这和“穿过房间和门”的走法是同一个思想。不过它不是最快的方法。对很大的素数，有基于欧几里得算法的、快得多的办法。

<sub>**Euclidean algorithm** /juːˈklɪdiən ˈælɡərɪðəm/ 欧几里得算法（辗转相除）</sub>

### 10 推广 · Generalizations

Now let us zoom out. Which whole numbers, not just primes, are sums of two squares?

接下来把视野放大。不只是素数，哪些正整数能写成两个平方数之和？

The key is a multiplication rule. The product of two sums of two squares is again a sum of two squares. In the language of complex numbers, this just says that the length of a product is the product of the lengths.

关键是一个乘法规则：两个“平方和”相乘，结果仍然是平方和。用复数的语言，这不过是说，乘积的长度等于长度的乘积。

<sub>**multiplication** /ˌmʌltəplɪˈkeɪʃən/ 乘法</sub>

Combine this with Fermat's theorem, and you get the full answer. A positive integer is a sum of two squares exactly when every prime factor of the form 4k + 3 appears an even number of times.

把它和费马定理结合，就得到完整的答案：一个正整数能写成两个平方数之和，当且仅当它的每个形如 4k + 3 的素因子，都出现偶数次。

<sub>**factor** /ˈfæktɚ/ 因子</sub>

In the Gaussian integers, numbers of the form a plus b i, this becomes a statement about factoring. A prime that is one mod four splits into two conjugate factors, like five equals (2 + i)(2 − i). A prime that is three mod four cannot be split. It stays prime.

在高斯整数，也就是形如 a 加 b i 的数中，这变成了一个关于因数分解的命题。除以 4 余 1 的素数会分裂成一对共轭因子，比如 5 等于 (2 + i)(2 − i)。而除以 4 余 3 的素数无法分解，仍然是素数。

<sub>**Gaussian integers** /ˈɡaʊsiən ˈɪntɪdʒɚz/ 高斯整数 · **conjugate** /ˈkɑːndʒəɡət/ 共轭的</sub>

Unique factorization in the Gaussian integers also tells us something Zagier's proof does not. The way of writing p as a sum of two squares is unique, up to order and signs.

高斯整数的唯一分解，还告诉我们一件扎吉尔的证明没有说的事：p 的表示方法是唯一的，不计顺序和正负号。

<sub>**unique factorization** /juˈniːk ˌfæktərəˈzeɪʃən/ 唯一分解</sub>

And the story continues. Which primes are x squared plus two y squared? Two, and the primes that are one or three mod eight. Which are x squared plus three y squared? Three, and the primes that are one mod three. Questions like these lead to quadratic reciprocity, and eventually to class field theory. And if you allow four squares instead of two, Lagrange proved that every positive integer is a sum of four squares.

故事还在继续。哪些素数能写成 x 平方加 2y 平方？恰好是 2，以及除以 8 余 1 或余 3 的素数。哪些能写成 x 平方加 3y 平方？是 3，以及除以 3 余 1 的素数。这类问题通向二次互反律，最终通向类域论。而如果允许用四个平方数，拉格朗日证明了：每个正整数都是四个平方数之和。

<sub>**quadratic reciprocity** /kwɑːˈdrætɪk ˌresəˈprɑːsəti/ 二次互反律 · **class field theory** /klæs fiːld ˈθiːəri/ 类域论</sub>

### 11 应用 · Applications

What is it good for? Here are two applications I like.

它有什么用？这里有两个我很喜欢的应用。

The first is about right triangles. If p equals a squared plus b squared, then squaring a plus b i gives a squared minus b squared, plus two a b i. So a squared minus b squared, two a b, and p form a right triangle with integer sides. Five gives three, four, five. Thirteen gives five, twelve, thirteen. In fact, the odd primes that can be the hypotenuse of an integer right triangle are exactly the primes that are one mod four.

第一个是直角三角形。如果 p 等于 a 平方加 b 平方，把 a 加 b i 平方，就得到 a 平方减 b 平方，再加上 2ab 乘 i。于是 a 平方减 b 平方、2ab 和 p，构成一个三边都是整数的直角三角形。5 给出 3、4、5。13 给出 5、12、13。事实上，能作为整数直角三角形斜边的奇素数，恰好就是除以 4 余 1 的素数。

<sub>**hypotenuse** /haɪˈpɑːtənuːs/ 斜边</sub>

The second is a surprise involving pi. Count the integer points inside a large circle of radius R. There are about pi R squared of them. There is a second way to count the same points, using divisors, and it rests on the theory of sums of two squares. Comparing the two counts gives Leibniz's formula. Pi over four equals one, minus one third, plus one fifth, minus one seventh, and so on.

第二个是一个和 π 有关的惊喜。数一数半径是 R 的大圆里有多少个整点，大约是 π 乘 R 平方个。同一批整点还有第二种数法：借助因数来数，而这种数法的根基，正是平方和的理论。比较这两种数法，就得到莱布尼茨公式：π 除以 4，等于 1 减三分之一，加五分之一，减七分之一，一直下去。

So a question about which primes are sums of two squares ends up connected to geometry, to complex numbers, and even to pi. That web of connections is a big part of why I love this theorem.

就这样，一个关于“哪些素数是平方和”的问题，最终和几何、复数、甚至 π 连在了一起。这张联系之网，正是我喜爱这个定理的重要原因。

### 12 模拟面试 · Mock interview

Now let us practice. Here is how an interview about this theorem might go. Notice that each answer is short and precise, and leaves something the examiner can follow up on.

下面进入模拟面试。面试用英文进行。我们先听考官的问题，再分析它在考什么、怎么回答。好的回答通常简短、准确，并且留下一个可以继续追问的线索。

**Q1 · 开场 / Opening**

- **Examiner:** So, what is your favorite theorem?
- **考官：** 那么，你最喜欢的定理是什么？

- **You:** My favorite theorem is Fermat's two-square theorem. It says that an odd prime is a sum of two squares if and only if it leaves remainder one when divided by four. I like it because the statement is so simple, but the proof I like best is a clever counting argument that fits in one sentence.
- **你：** 我最喜欢的定理是费马平方和定理。它说：一个奇素数能写成两个平方数之和，当且仅当它除以 4 余 1。我喜欢它，是因为它的陈述非常简单，而我最喜欢的证明，是一个只有一句话的巧妙计数论证。
- **Answer structure:** Name the theorem → State it precisely → Say why you like it → Leave a hook: a one-sentence proof
- **答题要点：** 开场回答要做三件事：说出定理的名字，给出准确的陈述，再用一句话说明你为什么喜欢它。最后那半句“一句话证明”，是在给考官留一个追问的钩子。

<sub>**if and only if** /ɪf ənd ˈoʊnli ɪf/ 当且仅当</sub>

**Q2 · 必要性 / Necessity**

- **Examiner:** Can you show me why primes of the form four k plus three can't work?
- **考官：** 你能说明一下，为什么形如 4k+3 的素数不行吗？

- **You:** Sure. Any square is zero or one, mod four. An even number squared is divisible by four, and an odd number squared is one more than a multiple of four. So a sum of two squares is zero, one or two, mod four, but never three.
- **你：** 当然。任何平方数除以 4 余 0 或 1：偶数的平方能被 4 整除，奇数的平方是 4 的倍数加 1。所以两个平方数之和除以 4 余 0、1 或 2，但永远不会余 3。
- **Answer structure:** Squares are 0 or 1 mod 4 → Even² and odd² separately → So a sum is never 3 mod 4
- **答题要点：** 这是送分题。考官在看你能不能把一个简单论证讲得干净利落。关键词是 mod four、even squared、odd squared，不要绕远路。

<sub>**modulo** /ˈmɑːdʒəloʊ/ 模（取余）</sub>

**Q3 · 条件边界 / Hypotheses**

- **Examiner:** Is that condition enough for any number, not just for primes?
- **考官：** 这个条件对任意整数都够用吗，而不只是素数？

- **You:** No. Twenty-one leaves remainder one, but it is not a sum of two squares. That's because twenty-one is three times seven, and both of those primes are three mod four. In general, a positive integer is a sum of two squares exactly when every prime factor of the form four k plus three appears an even number of times.
- **你：** 不够。21 除以 4 余 1，但它不是两个平方数之和，因为 21 等于 3 乘 7，而这两个素数都是除以 4 余 3 的。一般来说，一个正整数是两个平方数之和，当且仅当它的每个形如 4k+3 的素因子都出现偶数次。
- **Answer structure:** Give a counterexample: 21 = 3 × 7 → Necessary is not sufficient → State the general criterion
- **答题要点：** 这题考必要条件和充分条件的区别。马上举出反例 21，再给出一般整数的正确判定，说明你清楚定理的边界在哪里。

<sub>**counterexample** /ˈkaʊntɚɪɡˌzæmpəl/ 反例</sub>

**Q4 · 证明 / Proof**

- **Examiner:** Good. How would you prove the hard direction?
- **考官：** 很好。那困难的那个方向，你会怎么证明？

- **You:** I'd use Zagier's proof. Take the set S of positive triples with x squared plus four y z equal to p. Swapping y and z is an involution, and its fixed points give p as x squared plus the square of two y. So it's enough to show that S has an odd number of elements. For that, there's a second involution, which you can picture as re-cutting a windmill, and it has exactly one fixed point. By parity, S is odd, so the swap has a fixed point too.
- **你：** 我会用扎吉尔的证明。取满足 x² + 4yz = p 的正整数三元组构成的集合 S。交换 y 和 z 是一个对合，它的不动点给出 p = x² + (2y)²。所以只要证明 S 的元素个数是奇数。为此有第二个对合，可以把它想象成重新切割一个风车，它恰好只有一个不动点。由奇偶性，S 的元素个数为奇数，所以交换也有不动点。
- **Answer structure:** The set S: x² + 4yz = p → Swap y, z: fixed points are solutions → Need |S| odd → Re-cutting has one fixed point → Parity finishes it
- **答题要点：** 这是核心题。一分钟版本的证明要有清晰的骨架：集合 S，第一个对合和它的不动点，归结成 S 的大小是奇数，第二个对合恰有一个不动点，最后用[[奇偶性|鸡偶性]]收尾。不必背公式，讲清结构比背细节更重要。

<sub>**involution** /ˌɪnvəˈluːʃən/ 对合 · **triple** /ˈtrɪpəl/ 三元组 · **parity** /ˈperəti/ 奇偶性</sub>

**Q5 · 条件用在哪 / Where is primality used**

- **Examiner:** Where exactly do you use the fact that p is prime?
- **考官：** 你到底在哪里用到了 p 是素数？

- **You:** Mainly in one place, the uniqueness of the fixed point. A fixed windmill has x equal to y, so p equals x times x plus four z, and primality forces x to be one. It also rules out the boundary cases, which would need p to be a square or even. For twenty-one, for example, there are two fixed windmills, and the argument fails, as it should.
- **你：** 主要在一个地方：不动点的唯一性。不动的风车满足 x = y，于是 p = x(x + 4z)，素数条件迫使 x = 1。它也排除了边界情形，那些情形要求 p 是平方数或偶数。比如对 21，有两个不动的风车，论证就失效了，这也理所应当。
- **Answer structure:** Be precise: which step? → x = y ⇒ p = x(x + 4z) ⇒ x = 1 → Also excludes boundary cases → Check with 21: two fixed points
- **答题要点：** 考官很爱问“条件用在哪里”。回答要精确到具体步骤，再用 21 做一次反面检验，说明你是真正理解，而不是在背诵。

<sub>**primality** /praɪˈmæləti/ 素性（是素数） · **boundary** /ˈbaʊndri/ 边界</sub>

**Q6 · 动机 / Motivation**

- **Examiner:** Interesting. But how would anyone come up with that second involution?
- **考官：** 有意思。可是，人怎么会想到第二个对合呢？

- **You:** Honestly, from the algebra alone, I don't think I would. But if you draw x squared plus four y z as a windmill, you see that the same outline can be cut in two different ways. Whenever an object can be described in two ways, you get a natural pairing. So the geometry suggests the involution, and the formula just records it.
- **你：** 说实话，只看代数，我想我是想不到的。但如果把 x² + 4yz 画成一个风车，就会看到同一个轮廓能用两种不同方式切开。只要一个对象能用两种方式描述，就自然得到一种配对。所以是几何提示了这个对合，公式只是把它记录下来。
- **Answer structure:** Be honest about the algebra → The windmill picture → Two descriptions ⇒ a pairing
- **答题要点：** 这是区分度最高的问题，考的是数学直觉，而不是知识。诚实地承认“只看代数想不到”，再讲出图形带来的启发，比假装一切都很显然要好得多。

<sub>**outline** /ˈaʊtlaɪn/ 轮廓 · **intuition** /ˌɪntuˈɪʃən/ 直觉</sub>

**Q7 · 构造性 / Construction**

- **Examiner:** Your proof only shows existence. Can you actually find x and y?
- **考官：** 你的证明只说明了存在性。你能真的找出 x 和 y 吗？

- **You:** Yes, the proof actually contains an algorithm. Start at the fixed point of re-cutting and alternate the two involutions. Each windmill has at most two neighbours, so the walk can't repeat, and it has to end at a fixed point of the swap, which is a solution. It's like the path-following proof of Sperner's lemma. It's slow for large primes, though, and there are faster methods using the Euclidean algorithm.
- **你：** 可以，这个证明其实包含一个算法。从重新切割的不动点出发，交替使用两个对合。每个风车最多有两个相邻者，所以这条路不会重复，最后一定停在交换的不动点上，那就是一个解。这和斯潘纳引理的路径跟踪证明很像。不过对大素数它很慢，用欧几里得算法有更快的方法。
- **Answer structure:** Yes: follow the path → At most two neighbours ⇒ no repeats → Link to Sperner's lemma → Mention faster methods
- **答题要点：** 从存在到构造，是考官常用的追问方向。能把路径跟踪讲出来，并联系到斯潘纳引理，会让人眼前一亮。同时承认它效率不高、知道有更快的方法，显得更成熟。

<sub>**algorithm** /ˈælɡərɪðəm/ 算法 · **neighbour** /ˈneɪbɚ/ 相邻者 · **Euclidean algorithm** /juːˈklɪdiən ˈælɡərɪðəm/ 欧几里得算法（辗转相除）</sub>

**Q8 · 另一种证明 / Another proof**

- **Examiner:** Do you know any other proof?
- **考官：** 你还知道别的证明吗？

- **You:** Yes, there's one using the Gaussian integers. Since minus one is a square mod p, p divides n squared plus one for some n, and that factors as n plus i, times n minus i. If p stayed prime in the Gaussian integers, it would have to divide one of those factors, which is impossible. So p splits as a plus b i, times a minus b i, and taking norms gives p equals a squared plus b squared. There's also Euler's proof by infinite descent, and a pigeonhole argument due to Thue.
- **你：** 知道，有一个用高斯整数的证明。因为 −1 是模 p 的平方，存在 n 使 p 整除 n² + 1，而它可以分解成 (n + i)(n − i)。如果 p 在高斯整数中仍是素数，它就必须整除其中一个因子，这是不可能的。所以 p 分解为 (a + bi)(a − bi)，取范数就得到 p = a² + b²。另外还有欧拉的无穷递降证明，以及图厄的抽屉原理证明。
- **Answer structure:** Gaussian integers: p | n² + 1 → p cannot stay prime → Take norms: p = a² + b² → Also: Euler's descent, Thue
- **答题要点：** 能说出第二种证明，说明你的理解不是孤立的。高斯整数的证明要讲清两个事实：负一是模 p 的平方；高斯整数有唯一分解。

<sub>**Gaussian integers** /ˈɡaʊsiən ˈɪntɪdʒɚz/ 高斯整数 · **norm** /nɔːrm/ 范数 · **pigeonhole** /ˈpɪdʒənhoʊl/ 抽屉（原理）</sub>

**Q9 · 细节追问 / Detail**

- **Examiner:** Why is minus one a square modulo p?
- **考官：** 为什么 −1 是模 p 的平方？

- **You:** By Wilson's theorem, p minus one, factorial, is minus one mod p. Pair each number k with minus k. When p is one mod four, the minus signs come in an even number, so the factorial of p minus one over two, squared, is minus one. Again, it's a pairing argument.
- **你：** 由威尔逊定理，(p − 1)! 模 p 等于 −1。把每个 k 和 −k 配对。当 p 除以 4 余 1 时，负号的个数是偶数，所以 ((p − 1)/2)! 的平方模 p 等于 −1。这又是一个配对论证。
- **Answer structure:** Wilson: (p − 1)! ≡ −1 → Pair k with −k → Even number of minus signs → Another pairing argument
- **答题要点：** 被追问细节时，能当场推一推最好。威尔逊定理，加上 k 和负 k 的配对，又是一次“配对”的思想。把它点出来，会让整场面试有一条清楚的主线。

<sub>**Wilson's theorem** /ˈwɪlsənz ˈθɪrəm/ 威尔逊定理 · **factorial** /fækˈtɔːriəl/ 阶乘</sub>

**Q10 · 推广 / Generalization**

- **Examiner:** What about sums of three squares?
- **考官：** 那三个平方数之和呢？

- **You:** That's harder, and I know the statement better than the proof. Legendre's three-square theorem says that a positive integer is a sum of three squares unless it has the form four to the a, times eight b plus seven. The easy half is again a congruence argument, this time mod eight. And with four squares, Lagrange proved that every positive integer works.
- **你：** 那更难，我对结论比对证明熟悉。勒让德三平方定理说：一个正整数是三个平方数之和，除非它形如 4ᵃ(8b + 7)。容易的那一半同样是同余论证，这次是模 8。而如果用四个平方数，拉格朗日证明了每个正整数都可以。
- **Answer structure:** Admit what you know → Legendre: not 4ᵃ(8b + 7) → Easy half: mod 8 → Four squares: Lagrange
- **答题要点：** 遇到超出自己掌握范围的问题，诚实地说“我知道结论，但不熟悉证明”，再讲出你能讲的部分，比如模 8 的论证。这比硬编要好得多。

<sub>**congruence** /ˈkɑːŋɡruəns/ 同余</sub>

**Q11 · 应用 / Applications**

- **Examiner:** Is there an application you find meaningful?
- **考官：** 有没有你觉得有意义的应用？

- **You:** I like the connection to Pythagorean triples. Squaring a plus b i shows that the primes that can be the hypotenuse of an integer right triangle are exactly the primes that are one mod four. And counting lattice points in a circle even leads to Leibniz's series for pi.
- **你：** 我喜欢它和勾股数的联系。把 a + bi 平方可以说明：能作为整数直角三角形斜边的素数，恰好是除以 4 余 1 的素数。而数圆内的格点，甚至能推出 π 的莱布尼茨级数。
- **Answer structure:** Pick one or two examples → Prime hypotenuses → Lattice points ⇒ π/4
- **答题要点：** 应用题不需要展开证明。挑一两个你真正理解的例子讲清楚就够了。

<sub>**meaningful** /ˈmiːnɪŋfəl/ 有意义的 · **Pythagorean** /pɪˌθæɡəˈriːən/ 毕达哥拉斯的 · **hypotenuse** /haɪˈpɑːtənuːs/ 斜边 · **lattice** /ˈlætɪs/ 格点（网格）</sub>

**Q12 · 反思 / Reflection**

- **Examiner:** Last question. What did you learn from this theorem?
- **考官：** 最后一个问题。你从这个定理里学到了什么？

- **You:** Three things. First, you can prove existence by counting, sometimes just modulo two. Second, sometimes you have to create a symmetry, not just find one. And third, a good picture can turn a mysterious formula into something natural. I first met the parity idea in Sperner's lemma, and seeing it again here made me realize it's a general strategy, not just a trick.
- **你：** 三点。第一，可以通过计数来证明存在性，有时只需看奇偶。第二，有时必须自己创造对称，而不只是寻找对称。第三，一幅好的图能把一个神秘的公式变得自然。我第一次见到奇偶思想是在斯潘纳引理里，在这里再次遇到它，让我意识到这是一种普遍的策略，而不只是一个技巧。
- **Answer structure:** Existence by counting (mod 2) → Create a symmetry → A picture explains a formula → Connect to what you learned before
- **答题要点：** 收尾题考的是反思能力。把具体的数学经验提炼成可以迁移的方法，并且和你之前学过的东西联系起来，能让考官看到你的数学成长轨迹。

<sub>**strategy** /ˈstrætədʒi/ 策略</sub>

### 13 我的思考 · What I learned

Let me end with what this theorem taught me.

最后，说说这个定理教会我的东西。

To prove that something exists, you can count it, and sometimes counting modulo two is enough. Symmetry is not always given. Sometimes you have to create it. And a good picture can turn a formula that looks like magic into something you could have discovered yourself.

要证明某样东西存在，可以去数它，有时只数奇偶就够了。对称不一定是现成的，有时要自己创造。一幅好的图，能把一个像魔术一样的公式，变成你自己也可能发现的东西。

Brouwer's theorem is about fixed points. Sperner's lemma is about parity. And Zagier's proof is about the parity of fixed points. Ideas in mathematics keep meeting each other, and following those connections is, for me, the real joy of the subject.

布劳威尔定理讲的是不动点。斯潘纳引理讲的是奇偶。而扎吉尔的证明，讲的恰恰是不动点的奇偶。数学里的思想总会彼此相遇。顺着这些联系走下去，对我来说，就是数学真正的乐趣。

Thank you for watching.

感谢观看。

## 难词表（美式音标）

| 词语 Word | 音标 IPA | 中文 |
|---|---|---|
| algorithm | /ˈælɡərɪðəm/ | 算法 |
| blade | /bleɪd/ | 风叶（叶片） |
| boundary | /ˈbaʊndri/ | 边界 |
| class field theory | /klæs fiːld ˈθiːəri/ | 类域论 |
| congruence | /ˈkɑːŋɡruəns/ | 同余 |
| congruent | /ˈkɑːŋɡruənt/ | 同余的 |
| conjugate | /ˈkɑːndʒəɡət/ | 共轭的 |
| coordinates | /koʊˈɔːrdənəts/ | 坐标 |
| counterexample | /ˈkaʊntɚɪɡˌzæmpəl/ | 反例 |
| Euclidean algorithm | /juːˈklɪdiən ˈælɡərɪðəm/ | 欧几里得算法（辗转相除） |
| existence | /ɪɡˈzɪstəns/ | 存在性 |
| explicit | /ɪkˈsplɪsɪt/ | 明确的 |
| factor | /ˈfæktɚ/ | 因子 |
| factorial | /fækˈtɔːriəl/ | 阶乘 |
| finite | /ˈfaɪnaɪt/ | 有限的 |
| fixed point | /ˌfɪkst ˈpɔɪnt/ | 不动点 |
| Gaussian integers | /ˈɡaʊsiən ˈɪntɪdʒɚz/ | 高斯整数 |
| hypotenuse | /haɪˈpɑːtənuːs/ | 斜边 |
| hypothesis | /haɪˈpɑːθəsɪs/ | 假设、条件 |
| if and only if | /ɪf ənd ˈoʊnli ɪf/ | 当且仅当 |
| infinite descent | /ˈɪnfɪnət dɪˈsent/ | 无穷递降法 |
| integer | /ˈɪntɪdʒɚ/ | 整数 |
| intuition | /ˌɪntuˈɪʃən/ | 直觉 |
| involution | /ˌɪnvəˈluːʃən/ | 对合 |
| irreducible | /ˌɪrɪˈduːsəbəl/ | 不可约的 |
| lattice | /ˈlætɪs/ | 格点（网格） |
| meaningful | /ˈmiːnɪŋfəl/ | 有意义的 |
| mirror | /ˈmɪrɚ/ | 镜像 |
| modulo | /ˈmɑːdʒəloʊ/ | 模（取余） |
| multiplication | /ˌmʌltəplɪˈkeɪʃən/ | 乘法 |
| necessary | /ˈnesəseri/ | 必要的 |
| neighbour | /ˈneɪbɚ/ | 相邻者 |
| norm | /nɔːrm/ | 范数 |
| outline | /ˈaʊtlaɪn/ | 轮廓 |
| parity | /ˈperəti/ | 奇偶性 |
| perfect square | /ˈpɝːfɪkt skwer/ | 完全平方数 |
| pigeonhole | /ˈpɪdʒənhoʊl/ | 抽屉（原理） |
| primality | /praɪˈmæləti/ | 素性（是素数） |
| prime | /praɪm/ | 素数 |
| Pythagorean | /pɪˌθæɡəˈriːən/ | 毕达哥拉斯的 |
| quadratic reciprocity | /kwɑːˈdrætɪk ˌresəˈprɑːsəti/ | 二次互反律 |
| rectangle | /ˈrektæŋɡəl/ | 长方形 |
| remainder | /rɪˈmeɪndɚ/ | 余数 |
| remarkable | /rɪˈmɑːrkəbəl/ | 非凡的 |
| strategy | /ˈstrætədʒi/ | 策略 |
| sufficient | /səˈfɪʃənt/ | 充分的 |
| symmetry | /ˈsɪmətri/ | 对称 |
| theorem | /ˈθɪrəm/ | 定理 |
| triple | /ˈtrɪpəl/ | 三元组 |
| unique factorization | /juˈniːk ˌfæktərəˈzeɪʃən/ | 唯一分解 |
| unpack | /ʌnˈpæk/ | 拆解、剖析 |
| Wilson's theorem | /ˈwɪlsənz ˈθɪrəm/ | 威尔逊定理 |
| windmill | /ˈwɪndmɪl/ | 风车 |

## 一页纸证明（复习用）


**定理.** 奇素数 $p$ 满足 $p=x^2+y^2$（$x,y\in\mathbb Z$）当且仅当 $p\equiv1\pmod 4$。

**必要性.** $n^2\equiv0$ 或 $1\pmod4$，所以 $x^2+y^2\not\equiv3\pmod4$。

**充分性（扎吉尔, 1990）.** 设 $S=\{(x,y,z)\in\mathbb Z_{>0}^3: x^2+4yz=p\}$，有限。

1. $g(x,y,z)=(x,z,y)$ 是对合；$g$ 的不动点 $\Leftrightarrow y=z \Leftrightarrow p=x^2+(2y)^2$。
2. 对合把非不动点两两配对，所以 $|S|\equiv\#\mathrm{Fix}(g)\pmod2$。只需证 $|S|$ 为奇数。
3. 扎吉尔对合
   $f(x,y,z)=(x+2z,\,z,\,y-x-z)$ 若 $x<y-z$；$(2y-x,\,y,\,x-y+z)$ 若 $y-z<x<2y$；$(x-2y,\,x-y+z,\,y)$ 若 $x>2y$。
   边界 $x=y-z$ 推出 $p=(y+z)^2$，$x=2y$ 推出 $p=4y(y+z)$，对奇素数都不可能，所以 $f$ 处处有定义，且 $f\circ f=\mathrm{id}$。
4. $f$ 的不动点满足 $x=y$，于是 $p=x(x+4z)$，素数性给出 $x=1$：唯一不动点 $(1,1,\tfrac{p-1}{4})$。
5. 所以 $|S|$ 为奇数，$g$ 至少有一个不动点。$\blacksquare$

**几何图像.** $x^2+4yz$ 是“风车”的面积：边长 $x$ 的正方形 + 四片 $y\times z$ 风叶。$g$ = 翻转每片风叶；
$f$ = 擦去内部分割线，用另一个中心正方形重新切割同一个轮廓（过四个叶尖的正方形能放进轮廓就用它，否则用过风叶外侧边的正方形）。

**条件检验.** $n=21$：$S$ 有 4 个元素，$f$ 有两个不动点 $(1,1,5)$ 与 $(3,3,1)$，论证失效；$21$ 确实不是平方和。

**算法.** 从十字 $(1,1,k)$ 出发交替作用 $g, f, g, \dots$，每个元素至多两个“邻居”，路径不会重复，终点是 $g$ 的不动点。
$p=41$：$(1,1,10)\to(1,10,1)\to(3,1,8)\to(3,8,1)\to(5,1,4)\to(5,4,1)\to(3,4,2)\to(3,2,4)\to(1,2,5)\to(1,5,2)\to(5,2,2)$，得 $41=5^2+4^2$。

**推广.** $n=a^2+b^2 \iff n$ 的每个 $4k+3$ 型素因子都出现偶数次；在 $\mathbb Z[i]$ 中 $p\equiv1\ (4)$ 分裂为 $(a+bi)(a-bi)$，表示唯一；
$x^2+2y^2$：$p=2$ 或 $p\equiv1,3\pmod8$；$x^2+3y^2$：$p=3$ 或 $p\equiv1\pmod3$；四平方和定理（拉格朗日）；三平方和定理（勒让德）。

**应用.** $(a+bi)^2=(a^2-b^2)+2abi$ 给出斜边为 $p$ 的勾股三角形；圆内格点计数 $\Rightarrow \frac{\pi}{4}=1-\frac13+\frac15-\cdots$。
