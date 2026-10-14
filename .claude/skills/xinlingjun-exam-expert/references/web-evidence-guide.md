# 网络证据怎样使用

研究日期：2026-10-11。已围绕2021—2027新领军官方文件、考纲及题目资源，检索媒体访谈、参试复盘、教练经验、培训课程与论坛评价。检索同时使用两个搜索引擎，重要规则返回清华招生网或求真书院正文核验。

## 已存结构

| 文件 | 用途 |
| --- | --- |
| [historical-framework.md](historical-framework.md) | 按招生年度比较官方范围、流程、首年新纲及阶段名称 |
| [web-evidence.json](web-evidence.json) | 88个不同来源URL、55条判断/规则，保存身份、日期、读取状态、限制与依据链 |
| [third-party-analysis.md](third-party-analysis.md) | 比较外界观点、辨认偏差与冲突，推导有边界的训练建议 |
| [corpus-analysis.md](corpus-analysis.md)、[结构化分析](corpus-analysis.json) | 基于253完整题卡的统计、结构与六例数学核验 |
| [expert-workflows.md](expert-workflows.md) | 用事实与结构分析完成诊断、优先级、选题、迁移及原创命题 |
| [research-audit.json](research-audit.json) | 保存检索问题、搜索范围、排除项、冲突和30条研究缺口记录；部分缺口跨组重复 |

88是URL去重后的条目数，包括正文未取得的线索；不是88篇已读文章，更不是88项独立印证。多网站转载或同次官方答问保留`independence_family`，按同源使用。网络摘要和研究结果已经结构化，运行技能无需重新抽取PDF或重搜已整理资料。

每个来源用稳定`WEB`编号，`original_records`保留研究稿的`TP`、`EXP`、`OFF`等原编号。每条判断独立保存官方事实、有限的未找到结论、经验或AI推断身份；`source_ids`指向证据，`basis_claim_ids`指向已经说明的前提。

## 查询

在技能目录执行，默认不截断结果：

```bash
python3 scripts/query_evidence.py --year 2023 --kind official_primary
python3 scripts/query_evidence.py --topic 二试 --claims --full
python3 scripts/query_evidence.py --source EXP-04 --full
python3 scripts/query_evidence.py --source TP04 --claims --json
python3 scripts/query_evidence.py --gaps --topic 考纲
python3 scripts/query_evidence.py --list-kinds
```

`--year`按明确保存的招生年度查，不用文章年或试卷年猜补未知招生年；需要个人复盘时用主题或来源ID。不能执行脚本时读逐年框架或第三方来源表，再按编号查JSON。

`--claims --topic`同时检索判断本身与其来源摘要/限制，因此“20%”等细节可以定位到对应判断链；匹配不代表该数字已获证实，必须读取限制。

## 读取状态与判断门槛

| 状态 | 允许支持什么 |
| --- | --- |
| `body_or_relevant_sections_read` | 已读内容及其明确适用范围；仍检查作者身份和引用是否只是转述 |
| `mirror_body_read_original_unavailable` | 指明实际读到转载正文及原发布者，按同一来源族使用 |
| `official_index_read_linked_body_unavailable` | 官方目录确有标题/日期/链接；不证明链接全文 |
| `user_attachment_read_online_body_unavailable` | 已读用户副本的正文；可由官方目录佐证入口，不称已在线核验全文 |
| `index_only_body_unavailable` / `discovery_only_body_unavailable` | 仅发现线索；不能据标题或摘要添加真题、给全文评价 |

同URL若有多次观察，分别保留状态。日期动态显示、标题错年、镜像年份笔误、实际考试日未知时，在限制中保留；不静默猜改。

## 尚未取得的关键资料

- 2021—2026没有检出与2027同类的独立细目考纲；已有对应官方招生范围。这是限定检索范围内的结论，不能证明任何旧内部材料都不存在。
- 新版一试的实际题数、时长、分值与分科权重，以及二试综合六选二的各科细纲，未获可核验公布材料。2027尚未首考，不能制造经验。
- 微信首发原文、部分知乎回答全文和视频正文/字幕受读取限制；正文未取得的材料不冒充已分析。
- 旧正式英文面试细节、完整评分标准、可靠录取率/淘汰率统计，以及公历2026独立水平考试举行或取消的官方正文，仍缺证据。
- 网上试题片段、视频题解与回忆可以提供查找线索；未核验完整条件、全部小问、年月场次与重复情况前，不新增真题卡。现有23卷253题继续完整保留。

后续需要实时政策时继续核对最新官方。用户要求“网上都找清楚”时应系统扩展检索、保留失败与未找到项，不能宣称已经穷尽互联网。
