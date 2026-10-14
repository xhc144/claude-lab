#!/usr/bin/env python3
"""Search the saved evidence ledger without reprocessing web material."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text_of(record):
    return json.dumps(record, ensure_ascii=False).lower()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year', type=int, action='append', help='招生年度，可重复；不猜测未知年度')
    parser.add_argument('--kind', action='append', help='来源种类，可重复；用--list-kinds查看')
    parser.add_argument('--topic', action='append', help='正文摘要/规则关键词，可重复；各词均需匹配')
    parser.add_argument('--source', action='append', help='WEB编号或原研究编号，如EXP-04、TP01')
    parser.add_argument('--claims', action='store_true', help='返回判断/规则及其证据链')
    parser.add_argument('--gaps', action='store_true', help='返回研究缺口；年份不筛缺口')
    parser.add_argument('--full', action='store_true', help='展开全部结构化字段')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--list-kinds', action='store_true')
    args = parser.parse_args()
    data = json.loads((ROOT / 'references/web-evidence.json').read_text(encoding='utf-8'))
    by_id = {s['id']: s for s in data['sources']}
    if args.list_kinds:
        print('\n'.join(sorted({s['kind'] for s in data['sources']})))
        return

    def matches_source(s):
        if args.year and not set(args.year).intersection(s['admission_years']):
            return False
        if args.kind and s['kind'] not in args.kind:
            return False
        ids = {s['id']} | {r['original_id'] for r in s['original_records']}
        if args.source and not ids.intersection(args.source):
            return False
        return True

    allowed = {s['id'] for s in data['sources'] if matches_source(s)}
    source_filters = bool(args.year or args.kind or args.source)
    if args.gaps:
        rows = data['gaps']
        record_kind = 'research_gaps'
    elif args.claims:
        rows = [c for c in data['claims'] if not source_filters or allowed.intersection(c['source_ids'])]
        record_kind = 'claims_and_rules'
    else:
        rows = [s for s in data['sources'] if s['id'] in allowed]
        record_kind = 'sources'
    if args.topic:
        def topic_match(record):
            searchable = text_of(record)
            if args.claims and not args.gaps:
                searchable += ' ' + ' '.join(text_of(by_id[sid]) for sid in record['source_ids'])
            return all(t.lower() in searchable for t in args.topic)
        rows = [r for r in rows if topic_match(r)]
    evidence_ids = {sid for r in rows for sid in r.get('source_ids', [])}
    evidence = [s for s in data['sources'] if s['id'] in evidence_ids]
    if args.json or args.full:
        print(json.dumps({'record_kind': record_kind, 'count': len(rows), 'records': rows,
                          'supporting_sources': evidence if args.claims else [],
                          'researched_on': data['researched_on']}, ensure_ascii=False, indent=2))
        return
    print(f'截至{data["researched_on"]}；{record_kind}匹配{len(rows)}条，不截断。')
    for row in rows:
        if record_kind == 'sources':
            print(f"\n{row['id']}｜{row['title']}｜{row['kind']}")
            print('日期：' + '；'.join(row['publication_dates']) + '；招生年：' + str(row['admission_years'] or '未知/不适用'))
            print('读取状态：' + '；'.join(sorted({a['status'] for a in row['access_records']})))
            print(row['url'])
        else:
            print('\n' + json.dumps(row, ensure_ascii=False))
    for sid in sorted(evidence_ids):
        s = by_id[sid]
        print(f"依据 {sid}：{s['title']} {s['url']}")
    if not rows:
        print('仅表示保存资料无匹配；不能推出此事不存在或历年从未考过。')


if __name__ == '__main__':
    main()
