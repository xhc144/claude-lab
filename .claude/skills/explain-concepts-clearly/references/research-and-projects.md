# 研究与项目：证据和可用规则

核对日期：2026-10-12。只保存原创摘要、设计推论和来源链接，不打包论文、课程正文或第三方代码。论文评价的对象与本技能不同；以下规则是设计依据，不能称为本技能学习效果的实验验证。

## AI 解释研究

| 研究 | 已核实的研究范围 | 本技能采用的设计推论 | 证据边界 |
|---|---|---|---|
| Brihi Joshi 等，**ELI-Why: Evaluating the Pedagogical Utility of Language Model Explanations**，ACL Findings 2025，[论文](https://aclanthology.org/2025.findings-acl.1306/)，[原文](https://aclanthology.org/2025.findings-acl.1306.pdf) | 13.4K“为什么”问题与两项人类解释评价；考察新信息、与读者已有知识的连接、教育背景适配 | 从具体已知知识接入，明确新解释补上哪一条关系；不用年级标签替代学情 | 零样本、单轮、基准子集；未测试本技能或抽象数学迁移，也不能用旧模型结果评价当前模型 |
| Aliki Anagnostopoulou 等，**Human and LLM-based Assessment of Teaching Acts in Expert-led Explanatory Dialogues**，CODI 2025，[论文](https://aclanthology.org/2025.codi-1.15/)，[原文](https://aclanthology.org/2025.codi-1.15.pdf) | ReWIRED：26个主题、130段不同知识水平的专家解释对话；IXQuisite评估教学行为及其功能质量 | 检查例子和概念如何对应、定义与相邻语句是否连贯；不要按提问/类比/例子数量打分 | 视频转录和解释评价研究；不是按某组规则生成后测学习增益的试验；LLM评委不是数学正确性的证明 |
| Tal August、Kyle Lo、Noah A. Smith、Katharina Reinecke，**Know Your Audience: The benefits and pitfalls of generating plain language summaries beyond the “general” audience**，CHI 2024，[原文](https://arxiv.org/html/2403.04979v1)，[DOI](https://doi.org/10.1145/3613904.3642289) | 三项被试内研究分别有199、191、203人；讨论领域熟悉度、语言复杂度和信息保留 | 简化句法、顺序和无关负担，保留定义、必要条件和关键等式；不把有数学基础的读者一律当初学者 | 主要测科学摘要的阅读感受和行为，不是张量等数学概念的掌握程度 |
| LearnLM Team，**LearnLM: Improving Gemini for Learning**，2024-12，[原文](https://arxiv.org/html/2412.16429v1) | 将教学行为转成可指定的指令；专家对多轮场景进行教学评价 | 用“先辨明对象、推导关键关系、修复具体断点”等可检查行为替代“你是好老师”；允许不同情境采用不同讲法 | 后训练及专家偏好研究，不证明单个提示词会获得同样效果；不采用模型排名作为本技能依据 |
| Zekai Shao、Siyu Yuan 等，**Unlocking Scientific Concepts: How Effective Are LLM-Generated Analogies for Student Understanding and Classroom Practice?**，CHI 2025，[原文](https://arxiv.org/html/2502.16895v1)，[DOI](https://doi.org/10.1145/3706598.3714313) | 49名高中生参与第一项测试，44份有效试卷；另有一周课堂研究。所测生物和物理概念的结果有差异 | 不强制类比；类比必须回到定义，交代对应与失效处。优先数学结构自身的解释 | 一所高中、有限概念，不能外推到抽象数学；读起来懂和理解正确要分开 |
| Max Ku 等，**TheoremExplainAgent: Towards Video-based Multimodal Explanations for LLM Theorem Understanding**，ACL 2025，[论文](https://aclanthology.org/2025.acl-long.332/)，[原文](https://arxiv.org/html/2502.19400v1) | 规划并生成Manim定理解释视频；基准包含240个STEM定理，用户研究较小 | 先指定一张图需要说明的关系，再实现；利用多种表示互相核对对象与推理 | 视频生成成功率不等于理解提升率；本技能不默认制作视频，不依赖其API或代码 |

上述论文主要帮助约束**解释的选择、连接和评价**。对象本身的定义及“为什么这个数学构造能解决原问题”仍须按具体学科推导。不能把论文一般建议包装成张量本质的现成答案。

## GitHub：研究候选，不作成熟软件推荐

两轮检索覆盖概念解释、教学指令与读者适配、定理多模态解释、评价语料；另核对了数学交互教材与原作者教材。未找到完全覆盖本技能目标、通过活跃维护与许可证门槛的现成通用技能。小型研究仓库的论文相关性可以很高，但不等于软件成熟。

| 项目 | Stars / 状态 | 活动及许可证 | 实际用途与取舍 |
|---|---|---|---|
| [TIGER-AI-Lab/TheoremExplainAgent](https://github.com/TIGER-AI-Lab/TheoremExplainAgent) | GitHub API：1511，未归档 | pushed_at：2025-07-27；MIT；README另定位为研究用途 | 定理解释规划、视频生成和评价；最近推送超过一年，且目标是长视频，不直接实现本技能的短概念解释 |
| [nfelnlp/InstruX](https://github.com/nfelnlp/InstruX) | 网页：2，公开研究仓库 | 根目录/README未见明确许可证；具体最近代码提交日期需另查 | ReWIRED标注及IXQuisite解释评价；适合研究评分机制，不应作为成熟教学产品或直接复制语料 |
| [INK-USC/ELI-Why](https://github.com/INK-USC/ELI-Why) | GitHub API：2，未归档 | pushed_at：2025-06-17；API未识别许可证 | “为什么”解释评价代码与基准；适合查评价设计，不是已部署的教学Agent |

Stars及pushed_at为核对时快照。pushed_at不等于最近代码提交的日期；被收藏导致的updated_at不能当作代码维护证据。没有明确许可证的仓库仅保存链接与原创机制摘要。

## 数学内容校准

- [Sheldon Axler，Linear Algebra Done Right](https://linear.axler.net/)：用线性映射、对偶、特征空间校准数学对象的定义与条件。完整教材是严谨性后援，不是本技能的快速解释模板。
- [3Blue1Brown：换基](https://www.3blue1brown.com/lessons/change-of-basis/)：参照同一对象与不同坐标记录的区分。网站的[仓库许可证](https://github.com/3b1b/3Blue1Brown.com/blob/main/License.md)保留权利；只引用链接，原创重写，不复制课程。
- 历史材料与来源用法见主文件链接的 history-bridges.md。讲解时只在当前疑问需要时读取，不每次加载整份研究清单。
