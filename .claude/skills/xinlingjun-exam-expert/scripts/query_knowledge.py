#!/usr/bin/env python3
"""Retrieve official wording and separately attributed textbook knowledge."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description='检索官方知识项与教材专题，保持证据身份。')
    parser.add_argument('--topic', help='知识关键词')
    parser.add_argument('--book', help='书目ID或书名/作者关键词')
    parser.add_argument('--code', help='考纲代码')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    syllabus = json.loads((ROOT / 'references/syllabus-2027.json').read_text(encoding='utf-8'))
    data = json.loads((ROOT / 'references/textbook-map.json').read_text(encoding='utf-8'))
    book_map = {b['id']: b for b in data['books']}
    books = [b for b in data['books'] if (not args.book or args.book.casefold() in json.dumps(b, ensure_ascii=False).casefold()) and (not args.code or args.code in b['syllabus_codes'])]
    book_ids = {b['id'] for b in books}
    official = []
    if not args.book:
        for group in syllabus['groups']:
            for item in group['items']:
                if args.code and item['syllabus_code'] != args.code:
                    continue
                if args.topic and args.topic.casefold() not in json.dumps(item, ensure_ascii=False).casefold():
                    continue
                official.append(item)
    groups = []
    for section in data['topic_sections']:
        for group in section['groups']:
            if args.code and args.code not in group['syllabus_codes']:
                continue
            if args.book and not book_ids.intersection(group['book_ids_section_level']):
                continue
            if args.topic and args.topic.casefold() not in json.dumps(group, ensure_ascii=False).casefold():
                continue
            groups.append(group)
    if args.topic or args.code:
        matched_ids = {bid for g in groups for bid in g['book_ids_section_level']}
        books = [b for b in books if b['id'] in matched_ids]
    result = {'official_items': official, 'textbook_groups': groups, 'books': books, 'boundary': '教材对应发生在专题层，不等于该书逐项覆盖每个词，更不等于全部必考；无官方匹配也不能只凭关键词断定不在范围。'}
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print(f'官方明确列项：{len(official)}；教材解释性知识组：{len(groups)}；关联书目：{len(books)}。')
    for item in official:
        print(f"\n[官方] {item['id']} {item['name']} | {item['syllabus_code']} | 来源页{item['source_pages']}")
    for group in groups:
        print(f"\n[教材整理] {group['id']} {group['name']} | {group['scope_status']}")
        print(group['description'])
        print('专题对应书目：' + '；'.join(f"{bid} {book_map[bid]['title']}" for bid in group['book_ids_section_level']))
    if args.book:
        for book in books:
            print(f"\n[书目] {book['id']} {book['title']}：{book['metadata']}")
    print('\n' + result['boundary'])


if __name__ == '__main__':
    main()
