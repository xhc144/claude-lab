# 研究与开源依据

核验日期2026-09-27。系统性的人机差异研究及每项落地规则另见[人机差异证据表](human-ai-evidence.md)，其中明确区分直接人机比较、真人认知研究和仅模型评测。采用方法和限制，不把论文结果当技能实测成绩。脚本原创，没有复制第三方代码。

| 来源 | 采用 | 限制 |
|---|---|---|
| Ballon et al., *Estimating problem difficulty without ground truth using Large Language Model comparisons*, arXiv:2512.14220；[论文](https://arxiv.org/html/2512.14220v1)、[作者代码](https://github.com/MartheBallon/estimating-problem-difficulty-without-ground-truth) | 成对比较后排序；已核看src/bt.py和src/prompts.py，原代码调用choix的ILSR（`ilsr_pairwise`）。 | 相对判断不是人类成功率。Omni子集排除了证明、估计和图片题，不能直接外推。本技能加入锚题、解答核验与不可比判断，不是直接复现。 |
| Helzerman et al., *How Hard is Math?*, ACL SRW 2026；[全文](https://aclanthology.org/2026.acl-srw.85.pdf) | 关注Putnam真人表现，读取题干和可靠解答，参考跨数据集验证。按年份／题目家族留出是本技能额外的防泄漏设计。 | 模型指标在人类高难题上对齐弱；不用模型正确率、长度、logprob作学生难度，也不继承其准确率。 |
| Li et al., *Can LLMs Estimate Student Struggles?*, ACL Findings 2026；[论文](https://arxiv.org/abs/2512.18880)、[代码](https://github.com/MingLiiii/Difficulty_Alignment) | 区分模型共识与人类证据。 | 本文测试的零样本熟练度提示、增加模型规模或多模型一致不能保证与真人对齐；不外推为使用真人日志或错误示例的所有学生模拟方法均无效。 |
| Kolesnikova et al., *Estimating Item Difficulty with Large Language Models as Experts*, 2026预印本；[全文](https://research-portal.uu.nl/ws/files/290483722/2605.18562v1.pdf) | 参考比较判断；已知锚题连接绝对尺度是作者提出的未来方向，本技能借鉴为工作设计。 | 对象为基础数学，未验证大学竞赛，也未验证锚题能得到绝对人类难度。 |
| Gao et al., *Omni-MATH*, ICLR 2025；[论文](https://arxiv.org/html/2410.07985v1)、[代码](https://github.com/KbsdJames/Omni-MATH) | 按领域组织题库，分开题面、解答和标签。 | 难度混合AoPS评级与模型补标，不是逐题真人实测金标准。 |
| Tsoukalas et al., *PutnamBench*, NeurIPS 2024；[论文](https://arxiv.org/abs/2407.11214)、[代码](https://github.com/trishullab/PutnamBench) | 原题条件和形式化陈述的补充核验资源。 | 证明器表现不等于人类难度；要核对形式化目标与纸笔全解。 |
| Evan Chen, *Math Olympiad Hardness Scale*；[作者文档](https://web.evanchen.cc/upload/MOHS-hardness.pdf) | 明确知识背景，计入完整证明细节，警惕后见之明、顺序和时间分配。 | 属作者经验尺度且侧重中学奥赛，不套用其数值给大学竞赛。 |

本技能处于冷启动：历史成绩提供事实参照，新题定位是内容比较估计。暂无三赛共同学生样本，也无真人留出实验支持绝对统一尺度。官方数据及采样限制见contests.md。用户题目默认只在当前会话分析，不上传至论文服务或外部模型API。
