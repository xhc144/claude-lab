# 题库结构与查询

## 完整收录范围

共23卷、253道大题。按每道大题保留所有小问，未把小问重复计数。

| 场次 | 卷数 | 大题数 |
| --- | --- | --- |
| 一试 | 6 | 48 |
| 零试 | 11 | 160 |
| 女子 | 5 | 30 |
| CACA | 1 | 15 |

## 已分类数据入口

- [全部卷目录](papers.md)：按年、月、场次定位完整单卷题面。
- [考纲对应索引](coverage.md)：按新考纲知识方向找到旧题。
- `topic-index.json`：具体知识点到稳定题ID的倒排索引。
- `questions.json`：完整题面与逐题分类的唯一结构化主数据；单卷Markdown由脚本生成。
- `papers.json`：年月、场次、页数、题数、原文件名与哈希。
- `../scripts/query_bank.py`：在已分类数据上筛选，默认不截断，不做OCR。

## 核对状态与原题疑点

转录状态：已目视核对253题。

原题疑点保存在每道题的notes和单卷题面注；展示相关题时必须一并读取。方法栏未作完整解答验证，不能作为标准答案。个别原卷图形已用坐标化文本精确描述并配可编辑SVG，题面保留其图形关系。

## 常用查询

```bash
python3 scripts/query_bank.py --year 2023 --stage 一试 --full
python3 scripts/query_bank.py --topic 泰勒 --full
python3 scripts/query_bank.py --code M2-P --full
python3 scripts/query_bank.py --id TACA-202310-YI-Q02 --full
python3 scripts/query_bank.py --list-papers
```

如果无法执行脚本，先读papers.md或coverage.md，再读对应references/papers/<卷ID>.md。不要重新抽取原PDF。

## 更新索引

更新questions.json和papers.json后，执行 `python3 scripts/build_indexes.py`，再执行 `python3 scripts/validate_corpus.py`。源清单的预期题数应来自独立的原卷完整性核对，不从待检查的题库自动推导。
