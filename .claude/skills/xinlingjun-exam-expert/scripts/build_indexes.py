#!/usr/bin/env python3
"""Generate per-paper text and static indexes from canonical classified data."""
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / 'references'
CODES = {'M0': '中学数学', 'M1-A': '分析', 'M1-L': '线性代数', 'M1-G': '群论', 'M1-T': '几何与拓扑', 'M2-P': '概率', 'M2-C': '组合', 'M2-S': '统计', 'M2-N': '数值分析', 'M2-L': '数值代数', 'M2-O': '最优化', 'P': '物理'}


def main():
    papers = json.loads((REF / 'papers.json').read_text(encoding='utf-8'))
    bank = json.loads((REF / 'questions.json').read_text(encoding='utf-8'))
    folder = REF / 'papers'
    folder.mkdir(exist_ok=True)
    topic_index = defaultdict(list)
    code_index = defaultdict(list)
    for q in bank:
        for topic in q['topics']:
            topic_index[topic].append(q['id'])
        for code in q['syllabus_codes']:
            code_index[code].append(q['id'])
    for paper in papers:
        qs = sorted((q for q in bank if q['paper_id'] == paper['id']), key=lambda q: q['number'])
        rows = [f"# {paper['label']}〔{paper['id']}〕", '', f"来源文件名：`{paper['filename']}`；原卷{paper['source_pages_count']}页，共{paper['question_count']}道大题。", '', '来源身份：用户提供的历年整理卷，未独立核验官方原卷。旧考纲素材，不是2027新考纲真题；方法与结构观察为候选分析。', '']
        if paper.get('preamble'):
            rows.extend(['## 原卷前置说明', '', paper['preamble'], ''])
        for note in paper.get('notes', []):
            rows.extend(['卷注：' + note, ''])
        for q in qs:
            rows.extend([f"## 第{q['number']}题〔{q['id']}〕：{q['title']}", '', q['statement'], '', '| 字段 | 内容 |', '| --- | --- |'])
            for label, field in [('领域', 'domains'), ('知识点', 'topics'), ('候选方法', 'methods'), ('结构性观察', 'structural_moves'), ('前置知识', 'prerequisites'), ('考纲代码', 'syllabus_codes')]:
                val = '；'.join(q[field]).replace('|', '\\|').replace('\n', ' ')
                rows.append(f'| {label} | {val} |')
            rows.extend([f"| 范围关系 | {q['syllabus_relation']} |", f"| 原卷页码 | {'、'.join(map(str, q['source_pages']))} |", f"| 转录状态 | {q['transcription_status']} |", '', '迁移说明：' + q['transfer_note'], ''])
            for note in q['notes']:
                rows.extend(['题面注：' + note, ''])
            if q.get('figure_asset'):
                rows.extend([f"[题图SVG（题面已含完整坐标定义）](../../{q['figure_asset']})", ''])
        (folder / f"{paper['id']}.md").write_text('\n'.join(rows), encoding='utf-8')
    rows = ['# 历年试卷目录', '', f'本库完整收录{len(papers)}份整理卷、{len(bank)}道大题及所有小问；年份、月份和场次分别保留。旧考纲素材，不作为2027首次新考纲的分值、题量或时长依据。', '', '| 年份 | 月份 | 场次 | 大题数 | 卷ID与完整题面 |', '| --- | --- | --- | --- | --- |']
    for p in papers:
        rows.append(f"| {p['year']} | {p['month']} | {p['stage']} | {p['question_count']} | [{p['id']}](papers/{p['id']}.md) |")
    rows.extend(['', '历史时间标签来自原文件夹名称，仅作来源标签。题目中的取整、填空倍率、选项、参数范围与图形条件都保存在单卷题面和questions.json。'])
    (REF / 'papers.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    rows = ['# 历年题库考纲对应索引', '', '标签允许重叠；以下计数只描述所给样本，不能解释为2027命题概率。代码映射由本库整理，属于对历史题训练价值的分析。', '', '| 代码 | 内容 | 匹配大题数 |', '| --- | --- | --- |']
    for code, label in CODES.items():
        rows.append(f'| {code} | {label} | {len(code_index[code])} |')
    for code, label in CODES.items():
        rows.extend(['', f'## {code}：{label}', ''])
        qs = [q for q in bank if code in q['syllabus_codes']]
        if not qs:
            rows.extend(['本库该代码暂无历史题卡匹配，不代表新考纲不考或历届未考。'])
        for q in qs:
            rows.append(f"- [{q['id']}](papers/{q['paper_id']}.md)：{q['title']}；{q['syllabus_relation']}")
    (REF / 'coverage.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    (REF / 'topic-index.json').write_text(json.dumps(dict(sorted(topic_index.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    stages = Counter(p['stage'] for p in papers)
    counts = Counter(q['transcription_status'] for q in bank)
    rows = ['# 题库结构与查询', '', '## 完整收录范围', '', f'共{len(papers)}卷、{len(bank)}道大题。按每道大题保留所有小问，未把小问重复计数。', '', '| 场次 | 卷数 | 大题数 |', '| --- | --- | --- |']
    for stage in ['一试', '零试', '女子', 'CACA']:
        count = sum(p['question_count'] for p in papers if p['stage'] == stage)
        rows.append(f'| {stage} | {stages[stage]} | {count} |')
    rows.extend(['', '## 已分类数据入口', '', '- [全部卷目录](papers.md)：按年、月、场次定位完整单卷题面。', '- [考纲对应索引](coverage.md)：按新考纲知识方向找到旧题。', '- `topic-index.json`：具体知识点到稳定题ID的倒排索引。', '- `questions.json`：完整题面与逐题分类的唯一结构化主数据；单卷Markdown由脚本生成。', '- `papers.json`：年月、场次、页数、题数、原文件名与哈希。', '- `../scripts/query_bank.py`：在已分类数据上筛选，默认不截断，不做OCR。', '', '## 核对状态与原题疑点', '', '转录状态：' + '；'.join(f'{k}{v}题' for k, v in counts.items()) + '。', '', '原题疑点保存在每道题的notes和单卷题面注；展示相关题时必须一并读取。方法栏未作完整解答验证，不能作为标准答案。个别原卷图形已用坐标化文本精确描述并配可编辑SVG，题面保留其图形关系。', '', '## 常用查询', '', '```bash', 'python3 scripts/query_bank.py --year 2023 --stage 一试 --full', 'python3 scripts/query_bank.py --topic 泰勒 --full', 'python3 scripts/query_bank.py --code M2-P --full', 'python3 scripts/query_bank.py --id TACA-202310-YI-Q02 --full', 'python3 scripts/query_bank.py --list-papers', '```', '', '如果无法执行脚本，先读papers.md或coverage.md，再读对应references/papers/<卷ID>.md。不要重新抽取原PDF。', '', '## 更新索引', '', '更新questions.json和papers.json后，执行 `python3 scripts/build_indexes.py`，再执行 `python3 scripts/validate_corpus.py`。源清单的预期题数应来自独立的原卷完整性核对，不从待检查的题库自动推导。'])
    (REF / 'question-bank.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print(f'生成{len(papers)}份单卷文本、试卷目录、标签倒排索引和考纲对应索引。')


if __name__ == '__main__':
    main()
