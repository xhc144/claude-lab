#!/usr/bin/env python3
"""Validate coverage, references, identifiers and the no-PDF constraint."""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ['id', 'paper_id', 'number', 'source_pages', 'statement', 'title', 'summary', 'domains', 'topics', 'methods', 'structural_moves', 'prerequisites', 'syllabus_codes', 'syllabus_relation', 'transfer_note', 'transcription_status', 'notes']
CODES = {'M0', 'M1-A', 'M1-L', 'M1-G', 'M1-T', 'M2-P', 'M2-C', 'M2-S', 'M2-N', 'M2-L', 'M2-O', 'P'}


def main():
    errors = []
    def check(value, message):
        if not value:
            errors.append(message)
    def read(name):
        return json.loads((ROOT / 'references' / name).read_text(encoding='utf-8'))
    papers, bank, manifest = read('papers.json'), read('questions.json'), read('source-manifest.json')
    expected = manifest['corpus_expectations']
    check(len(papers) == expected['papers'], '试卷总数不匹配')
    check(len(bank) == expected['questions'], '题目总数不匹配')
    check(len({p['id'] for p in papers}) == len(papers), '重复卷ID')
    check(len({q['id'] for q in bank}) == len(bank), '重复题ID')
    check(Counter(p['stage'] for p in papers) == Counter(expected['stage_papers']), '场次卷数不匹配')
    stage_questions = Counter()
    for p in papers:
        stage_questions[p['stage']] += p['question_count']
    check(stage_questions == Counter(expected['stage_questions']), '场次大题数不匹配')
    by_paper = {p['id']: p for p in papers}
    check({p['source_sha256'] for p in papers} == {s['sha256'] for s in manifest['paper_sources']}, '来源卷覆盖不匹配')
    for p in papers:
        qs = [q for q in bank if q['paper_id'] == p['id']]
        check(len(qs) == p['question_count'], f"{p['id']}题数不匹配")
        check(sorted(q['number'] for q in qs) == list(range(1, p['question_count'] + 1)), f"{p['id']}题号不连续")
        check((ROOT / p['reference_path']).is_file(), f"{p['id']}单卷文本缺失")
        body = (ROOT / p['reference_path']).read_text(encoding='utf-8')
        for q in qs:
            check(q['id'] in body and q['statement'] in body, f"{q['id']}单卷题面不同步")
    for q in bank:
        check(all(k in q for k in FIELDS), f"{q.get('id')}字段缺失")
        if not all(k in q for k in FIELDS):
            continue
        check(q['paper_id'] in by_paper, f"{q['id']}无对应卷")
        check(q['id'] == f"{q['paper_id']}-Q{q['number']:02d}", f"{q['id']}题号与ID不同步")
        check(isinstance(q['statement'], str) and len(q['statement']) >= 10, f"{q['id']}完整题面不足")
        check('\ufffd' not in q['statement'] and '\x00' not in q['statement'], f"{q['id']}有乱码字符")
        check(q['topics'] and q['domains'] and q['syllabus_codes'], f"{q['id']}分类为空")
        check(set(q['syllabus_codes']).issubset(CODES), f"{q['id']}未知考纲代码")
        check(q['syllabus_relation'] in {'直接对应', '基础支撑', '拓展迁移', '需核对'}, f"{q['id']}未知映射关系")
        check(q['transcription_status'] in {'已目视核对', '抽取可读', '需核对符号'}, f"{q['id']}未知核对状态")
        if q['paper_id'] in by_paper:
            check(q['source_pages'] and all(isinstance(n, int) and 1 <= n <= by_paper[q['paper_id']]['source_pages_count'] for n in q['source_pages']), f"{q['id']}原页码越界")
        for field in ['domains', 'topics', 'methods', 'structural_moves', 'prerequisites', 'syllabus_codes', 'notes']:
            check(isinstance(q[field], list) and all(isinstance(s, str) for s in q[field]), f"{q['id']}.{field}格式不符")
        if q.get('figure_asset'):
            check((ROOT / q['figure_asset']).is_file(), f"{q['id']}题图资源缺失")
    textbooks = read('textbook-map.json')
    check(len(textbooks['books']) == 39, '输入39书目覆盖不完整')
    check(len(textbooks['topic_sections']) == 44, '输入44教材专题覆盖不完整')
    groups = [g for s in textbooks['topic_sections'] for g in s['groups']]
    check(len(groups) == 222, '输入222教材知识组覆盖不完整')
    book_ids = {b['id'] for b in textbooks['books']}
    check(len(book_ids) == 39, '重复书目ID')
    for group in groups:
        check(set(group['book_ids_section_level']).issubset(book_ids), f"{group['id']}含不存在的书目ID")
    syllabus = read('syllabus-2027.json')
    check(syllabus['first_year_of_new_syllabus'] is True and syllabus['exam_year'] == 2027, '考纲首次实施版本丢失')
    check(len(syllabus['groups']) == 27, '考纲语义组覆盖不完整')
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        check(path.suffix.lower() != '.pdf', f'禁止PDF：{path.relative_to(ROOT)}')
        with path.open('rb') as handle:
            check(handle.read(5) != b'%PDF-', f'伪装PDF：{path.relative_to(ROOT)}')
        if path.suffix == '.md':
            text = path.read_text(encoding='utf-8')
            for target in re.findall(r'\]\(([^)]+)\)', text):
                if re.match(r'^[a-zA-Z]+:', target) or target.startswith('#'):
                    continue
                check((path.parent / target.split('#')[0]).exists(), f'{path.relative_to(ROOT)}失效链接：{target}')
    web = read('web-evidence.json')
    sources = {s['id']: s for s in web['sources']}
    claims = {c['id']: c for c in web['claims']}
    check(len(sources) == len(web['sources']) == web['counts']['distinct_source_urls'], '网络来源ID/计数不一致')
    check(len(claims) == len(web['claims']) == web['counts']['claims_and_decision_rules'], '网络判断ID/计数不一致')
    official_years = set()
    for s in sources.values():
        check(s['url'].startswith('https://') and s['title'] and s['access_records'], f"{s['id']}网络出处不全")
        check(s['kind'] and s['independence_family'], f"{s['id']}证据身份/同源标识缺失")
        if s['kind'] == 'official_primary':
            official_years.update(s['admission_years'])
    check(set(range(2021, 2028)).issubset(official_years), '2021—2027官方范围来源不全')
    for c in claims.values():
        check(c['source_ids'] and set(c['source_ids']).issubset(sources), f"{c['id']}依据链失效")
        check(set(c.get('basis_claim_ids', [])).issubset(claims), f"{c['id']}前提判断失效")
    analysis = read('corpus-analysis.json')
    check(analysis['stats']['paper_count'] == len(papers) and analysis['stats']['question_count'] == len(bank), '专家分析与题库样本数不同步')
    question_ids = {q['id'] for q in bank}
    check(len(analysis['representative_cases']) == 6, '六例结构核验缺失')
    check(all(c['id'] in question_ids for c in analysis['representative_cases']), '专家代表案例题ID失效')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f"通过：{len(papers)}份试卷、{len(bank)}道完整题卡、{len(sources)}项网络出处、{len(claims)}条判断/规则；完整性、依据链、链接与无PDF约束一致。")
    return 0


if __name__ == '__main__':
    sys.exit(main())
