#!/usr/bin/env python3
"""Search the preclassified text corpus; no PDF or network dependency."""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / 'references' / name).read_text(encoding='utf-8'))


def main():
    parser = argparse.ArgumentParser(description='按年份、场次、考点、考纲代码和题号检索领军题库。')
    parser.add_argument('--year', type=int, action='append', help='可重复；多个年份取并集')
    parser.add_argument('--stage', choices=['一试', '零试', '女子', 'CACA'])
    parser.add_argument('--paper', help='完整卷ID')
    parser.add_argument('--id', action='append', help='完整题ID，可重复')
    parser.add_argument('--topic', action='append', help='分类标签关键词，可重复；多个关键词取并集')
    parser.add_argument('--text', help='题面和所有分类字段全文关键词')
    parser.add_argument('--code', action='append', help='考纲代码，如M2-P，可重复取并集')
    parser.add_argument('--full', action='store_true', help='输出完整题面、备注与候选方法')
    parser.add_argument('--json', action='store_true', help='输出JSON结构')
    parser.add_argument('--limit', type=int, help='仅用户确需缩短输出时使用；默认不截断')
    parser.add_argument('--list-papers', action='store_true')
    parser.add_argument('--list-topics', action='store_true')
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error('--limit必须是正整数')
    papers = read('papers.json')
    bank = read('questions.json')
    aliases = read('topic-aliases.json')
    by_paper = {p['id']: p for p in papers}
    filtered_papers = [p for p in papers if
                       (not args.year or p['year'] in args.year) and
                       (not args.stage or p['stage'] == args.stage) and
                       (not args.paper or p['id'].casefold() == args.paper.casefold())]
    if args.list_papers:
        if args.json:
            print(json.dumps(filtered_papers, ensure_ascii=False, indent=2))
        else:
            print(f'匹配试卷：{len(filtered_papers)}份')
            for p in filtered_papers:
                print(f"{p['id']} | {p['label']} | {p['question_count']}道大题 | {p['reference_path']}")
        return
    allowed = {p['id'] for p in filtered_papers}
    queries = []
    for term in args.topic or []:
        key = term.casefold()
        queries.extend(aliases.get(key, [term]))
    queries = [q.casefold() for q in queries]
    result = []
    for q in bank:
        if q['paper_id'] not in allowed:
            continue
        if args.id and q['id'].casefold() not in {s.casefold() for s in args.id}:
            continue
        if args.code and not set(args.code).intersection(q['syllabus_codes']):
            continue
        tags = json.dumps({k: q[k] for k in ['title', 'domains', 'topics', 'methods', 'prerequisites', 'structural_moves']}, ensure_ascii=False).casefold()
        if queries and not any(term in tags for term in queries):
            continue
        if args.text and args.text.casefold() not in json.dumps(q, ensure_ascii=False).casefold():
            continue
        result.append(q)
    result.sort(key=lambda q: (by_paper[q['paper_id']]['year'], by_paper[q['paper_id']]['month'], by_paper[q['paper_id']]['stage'], q['number']))
    if args.list_topics:
        counts = Counter(t for q in result for t in q['topics'])
        if args.json:
            print(json.dumps(dict(counts.most_common()), ensure_ascii=False, indent=2))
        else:
            for topic, count in counts.most_common():
                print(f'{topic}\t{count}')
        return
    total = len(result)
    if args.limit is not None:
        result = result[:args.limit]
    if args.json:
        print(json.dumps({'total': total, 'returned': len(result), 'truncated': len(result) < total, 'questions': result}, ensure_ascii=False, indent=2))
        return
    print(f'匹配：{total}道大题；展示：{len(result)}道。来源为本库历年整理卷；候选方法未经本查询验证。')
    if not result:
        print('本库未收录匹配题。')
    for q in result:
        p = by_paper[q['paper_id']]
        print(f"\n## {p['label']} 第{q['number']}题〔{q['id']}〕：{q['title']}")
        print('标签：' + '、'.join(q['topics']))
        print('考纲：' + '、'.join(q['syllabus_codes']) + '；' + q['syllabus_relation'])
        print(q['statement'] if args.full else q['summary'])
        if args.full:
            print('页码：' + '、'.join(map(str, q['source_pages'])) + '；核对状态：' + q['transcription_status'])
            print('迁移说明：' + q['transfer_note'])
            print('候选方法：' + '、'.join(q['methods']))
            for note in q['notes']:
                print('备注：' + note)
    if total > len(result):
        print(f'输出按--limit截断；还有{total-len(result)}道匹配题。删除--limit可完整输出。')


if __name__ == '__main__':
    main()
