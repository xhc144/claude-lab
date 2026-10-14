# 人机解题差异：证据、用途与外推边界

核验日期：2026-09-27。这里区分三种材料：真正的人机比较、真人认知研究、只有模型的评测。后两类不能被改写成直接的人机实验。下面的检查规则是根据证据制定的工作程序，**不是论文已经验证的大学竞赛难度公式**。具体模型版本、学生背景、提示和评分标准都会改变结论。

## 一、人机比较或与人类研究的比较

| 一手来源与资源 | 实际证据与限制 | 本技能采用的约束 |
|---|---|---|
| Opedal等，ICML 2024，*Do Language Models Exhibit the Same Cognitive Biases in Problem Solving as Human Learners?* [论文](https://proceedings.mlr.press/v235/opedal24a.html)；[作者代码](https://github.com/eth-lre/solving-biases) | 对照已有儿童算术研究，拆分文字理解、解法规划、算术执行。测试模型在前两个阶段出现部分类似人类的偏差，在执行阶段不同。不是新招募大学生同场竞赛实验。 | 分阶段评价，不能把模型算错、模型规划成功分别直接投射到人类；也不能笼统宣称两者完全相同或完全不同。 |
| Nikolaiev等，2024预印本，*Can Language Models Rival Mathematics Students?* [全文](https://arxiv.org/html/2412.11908v1)；[作者数据](https://huggingface.co/datasets/andynik/combi-puzzles) | 25道基础至中等组合题、各5种表述；35名13–18岁有竞赛经历的学生，比较时每组取前5人。模型对部分表述变化敏感，学生差异未达显著；具体题有双向强弱反转。模型英文、学生乌克兰语，评分为答案／公式，非完整证明。 | 模型熟悉数学包装不等于学生容易；模型对改数、叙事的敏感度不等于人类难度变化。未显著不等于人类完全不受表述影响；“训练文本相似”是作者解释假说。 |
| Zhang、Jiang等，ECCV 2024，*MathVerse* [正式全文](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/01270.pdf)；[作者稿附录B：人类实验协议](https://arxiv.org/html/2403.14624v2)；[作者代码](https://github.com/ZrrSkywalker/MathVerse) | 视觉数学题含不同文字／图形版本，10名大学生提供人类基线。正式论文表2中，人类Text-lite 70.9%高于Text-only 41.7%，GPT-4V则41.4%低于48.7%。人类不重复做同题所有版本，且只评答案，没有人类证明过程评分。版本信息呈现不同，不是纯粹增删无关图片。 | 先检验图像读取，再评价人类图形表征与推理；模型看不清图不能提高题目难度。亦不能据此宣称人类对所有图形都更强。 |
| Yax、Anlló、Palminteri，Communications Psychology 2024，*Studying and improving reasoning in humans and machines* [正式论文](https://www.nature.com/articles/s44271-024-00091-8)；[作者稿](https://arxiv.org/abs/2309.12485) | 784名成人参与认知反思及概率判断实验；测试若干GPT版本。相似表面错误背后仍有差别，人和模型对示例／逐步提示的响应不同。题型短小，非竞赛长证明。 | 不把相似错误或“像学生”的文本视为同一认知机制；不把提示对模型的帮助直接换算成人类提示收益。 |

## 二、真人解题、证明与记忆研究

这些研究解释为什么需要检查人类的发现、策略和完成负担；它们本身没有测试AI。

| 一手来源 | 实际证据与限制 | 本技能采用的约束 |
|---|---|---|
| Schoenfeld，1981，*Episodes and Executive Decisions in Mathematical Problem Solving* [原文及过程记录](https://files.eric.ed.gov/fulltext/ED201505.pdf) | 小样本大学生合作出声解题，前测为6对学生各2题，并有教学后及专家案例。局部会算仍可能长时间偏离目标；规划和停止无效路线影响完成。合作／访谈不等于单人考场；未说出来不代表没有规划。 | 评价路线选择、停滞与转向的门槛，不能由最终证明短倒推发现简单。不机械要求每步反思，不编造真人逐步失败记录。 |
| Weber，2001，*Student difficulty in constructing proofs: The need for strategic knowledge* [出版社摘要](https://link.springer.com/article/10.1023/A:1015535614355) | 比较本科生与博士生抽象代数证明；知道并能应用事实，仍可能不知道何时选它。此次只核验出版社摘要，不引用未见正文的样本数／比例。 | 区分事实知识与选择策略、触发工具的知识；“只用初等知识”不能单独证明题易。 |
| Weber，2004，*A Framework for Describing the Processes that Undergraduates Use to Construct Proofs* [全文](https://files.eric.ed.gov/fulltext/ED489676.pdf) | 14名本科生的176次证明观察，区分程序性、句法式与语义式证明构造。语义式构造借表征形成直觉理由，再转写正式证明；有效的程序性证明也不保证理解。176不是人数，分类不表示固定高低难度。 | 把找表征、找到关键理由、写成严谨证明分开。独立发现、提示后补全、阅读理解和验证的区分是本技能的任务规则，不是该文对四种任务的实验比较；不规定发现一定比验证难若干档。 |
| Meier等，Scientific Reports 2023，*Mathematical expertise: the role of domain-specific knowledge for memory and creativity* [论文](https://www.nature.com/articles/s41598-023-39309-w)；[全文镜像](https://pmc.ncbi.nlm.nih.gov/articles/PMC10397219/) | 115名数学专家与109名匹配参与者，在线结构化／打乱信息回忆及创造性任务；领域知识与有意义数学材料的记忆优势相关。记忆材料包含定理与证明，但不是独立证明构造任务、竞赛或AI实验。主站／镜像可能出现验证码。 | 记忆负担取决于能否识别熟悉结构；核查子目标协调和纸笔外化是本技能的工作规则，非该文直接测定。不能机械按符号数或步骤数评分，也不设“人类最多几步”的伪阈值。 |

## 三、模型可靠性及人机互动材料

| 一手来源与资源 | 实际证据与限制 | 本技能采用的约束 |
|---|---|---|
| Gao等，ICML 2023，*PAL: Program-aided Language Models* [正式论文](https://proceedings.mlr.press/v202/gao23f.html)；[作者代码](https://github.com/reasoning-machines/pal) | 让模型把问题转成程序，由Python执行，数学／符号推理测试优于相应纯文本解法；没有纸笔竞赛真人对照，也不表示所有计算任务都可行。 | 严格区分模型本体、带工具系统与无工具人类。实际计算规模须计入人类负担；评估者的程序结果只是核验，不能替代考生需完成的手算或证明。 |
| Mirzadeh等，ICLR 2025，*GSM-Symbolic* [全文](https://arxiv.org/html/2410.05229v1)；[作者代码](https://github.com/apple-aiml-research/ml-gsm-symbolic) | 算术应用题的参数、名称及无关信息变式使测试模型表现变化；没有同步人类样本。不能据它证明所有模型没有推理，或所有变式下降都源于训练污染。 | 等价变式可用于审查模型评级稳定性，不能直接用于给人类加难度。先确认没有改变真正数学结构或提示。 |
| Rudman等，ACL Findings 2025，*Forgotten Polygons* [正式论文](https://aclanthology.org/2025.findings-acl.620/)；[作者代码](https://github.com/rsinghlab/Shape-Blind) | 13种多模态模型在合成图形计数／识别上测试，文本形式与视觉形式表现不同。没有该合成任务新采集的匹配真人基线。 | 将模型感知失败单列为输入可靠性问题；简单看图失误不是数学高难证据。 |
| Collins、Jiang等，PNAS 2024，*Evaluating language models for mathematics through interactions*（CheckMate）[正式论文](https://doi.org/10.1073/pnas.2318124121)；[作者稿](https://arxiv.org/pdf/2306.01694)；[代码](https://github.com/collinskatie/checkmate) | 本科数学真实互动与专家个案，分别评正确性、帮助性；54题、261次交互，25条参与记录不应擅称25个独立人。不是人机独立解题比赛或提示因果实验。 | 正确建议不等于学生能自行发现；读懂、信任和检查答案的负担需单列。不得把互动成功率当独立解题率。 |
| Holmes、Schmitt，2026预印本，Project Euler人机时间比较 [全文](https://arxiv.org/html/2606.21972v1) | 50道编程数学题、26种配置、3840次尝试；人类指标为发布后最快5个公开正确提交时间的几何平均，非受控个人起始用时。提交可能混有人机协作，双方反馈和工具预算亦不对称。作者拟合token与该基线的关系，不能成为通用换算。 | 不用token、生成耗时、重试次数估计人的分钟数；编程工具、整卷分配和纸笔证明条件必须匹配。 |

## 将证据落实到一次评估

1. 固定对象：目标人群、知识与熟练度、是否见过、提示、允许工具、完成标准，以及**独立解题／提示后补全／读懂／验证**哪一种任务。评估者用过的工具、网络查得的提示与选手允许的资源分别记录。
2. 按human-perspective.md检查九个环节，只留下该题最重要的两三个人类瓶颈。知识／检索参考Weber及MOHS；表征参考Opedal、MathVerse；策略控制参考Schoenfeld；子目标与记忆参考Meier；执行参考Opedal；证明闭合参考Weber；检查与信心参考Schoenfeld及CheckMate。时间规则是防止无依据换算的约束，不是实测时间模型。
3. 每个瓶颈给题目结构或真实锚题支持。不能凭“人有情绪／AI能并行”等概括任意加分；没有实证时不量化疲劳、焦虑或误判率。
4. 人机研究说明为何不能拿模型表现作替代指标；实际定位仍依赖**固定人群下的内容比较和有明确分母的真人竞赛成绩**。研究没有建立Putnam、IMC、CMC共同的绝对难度尺度。
5. 保留“文献观察／本技能规则推论／本题估计”三层区别。若希望评价个人难度，优先收集真实作答、提示、时间和评分，不能用AI扮演学生生成的反应替代。

工具与网络搜索的具体执行规则见human-perspective.md：区分算力、发现和验证；把搜索得到的捷径标为外部提示；遇到计算瓶颈检查纸笔规模及替代路线。以上不是PAL实测了人的搜索难度，而是为保持所评条件一致而设置的规则。
