#!/usr/bin/env python3
"""Read human difficulty references, fixed ratings, and within-year score bands."""
import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'references' / 'difficulty'
RATING_FIELDS = ('anchor_id', 'score', 'range', 'confidence', 'role', 'display_note')


def reference_ratings(card=None, *, conditional=False):
    """Expose public rating fields (and an explicit condition), never review notes."""
    if card is None:
        card = json.loads((ROOT / 'rating-scale.json').read_text())
    fields = RATING_FIELDS + ('condition',) if conditional else RATING_FIELDS
    collection = 'conditional_references' if conditional else 'rated_references'
    return {
        row['anchor_id'].lower(): {key: row[key] for key in fields if key in row}
        for row in card.get(collection, [])
    }


def bands(rows, value):
    """Higher performance = easier; ties use midrank. Not human calibration."""
    result = {}
    vals = [value(r) for r in rows]
    for row, v in zip(rows, vals):
        r = 1 + sum(x > v for x in vals) + (sum(x == v for x in vals) - 1) / 2
        result[row['id']] = {'rank_easy_first': r,
                             'band_easy_1_hard_5': 1 + min(4, math.floor(5 * (r - 1) / len(rows)))}
    return result


def load_stats():
    out = {}
    for year in json.loads((ROOT / 'imc_statistics_2023_2025.json').read_text())['years']:
        rows = year['problems']
        full = bands(rows, lambda x: x['full_rate'])
        mean = bands(rows, lambda x: x['mean_score'])
        for row in rows:
            out[row['id'].lower()] = {
                'population': 'official_listed_roster', 'n': row['n'],
                'full_count': row['n_full'], 'full_rate': row['full_rate'],
                'mean_score': row['mean_score'], 'max_score': 10,
                'blank_count': row['n_blank'], 'blank_policy': year['blank_policy'],
                'status': year['source_status'], 'url': year['source_url'],
                'full_score_position': full[row['id']], 'mean_score_position': mean[row['id']],
                'note': '作者从榜单计算；仅同年内部位置，非官方等级、非预测解出率。'}
    putnam = json.loads((ROOT / 'putnam_score_data.json').read_text())
    for year in sorted({p['year'] for p in putnam}):
        rows = [dict(p, id=f"Putnam-{year}-{p['problem_id']}") for p in putnam if p['year'] == year]
        mean_fn = lambda x: sum(int(k) * v for k, v in x['score_counts'].items()) / x['cohort_n']
        full = bands(rows, lambda x: x['full_score_rate_in_cohort'])
        mean = bands(rows, mean_fn)
        for row in rows:
            out[row['id'].lower()] = {
                'population': 'top_total_score_only', 'n': row['cohort_n'],
                'full_count': row['score_counts']['10'], 'full_rate': row['full_score_rate_in_cohort'],
                'mean_score': mean_fn(row), 'max_score': 10,
                'raw_absence_label': row['raw_absence_label'], 'raw_absence_count': row['raw_absence_count'],
                'mean_policy': 'NA/NS contribute no score; retained in denominator; no attendance interpretation.',
                'url': row['source_url'], 'source_pdf_page': row['source_pdf_page'],
                'full_score_position': full[row['id']], 'mean_score_position': mean[row['id']],
                'note': '仅总分前列样本，不能外推全体；档位仅同年内部位置。'}
    return out


def calibration_metadata(anchor):
    """Keep a public calibration caveat separate from content verification."""
    if not anchor:
        return {}
    metadata = {key: anchor[key] for key in ('calibration_status', 'calibration_note')
                if key in anchor}
    if anchor.get('calibration_status') == 'verified_content_but_rating_deferred':
        metadata['eligible_for_default_profile_calibration'] = False
    return metadata


def content_reference(anchor):
    """Whitelist statement metadata; never include solutions or checking notes."""
    evidence = anchor.get('evidence_type') if anchor else None
    accepted = {'verified_source_with_editorial_profile',
                'verified_university_archive_with_editorial_profile',
                'verified_statement_with_solution_caveat'}
    if not anchor or evidence not in accepted or not anchor.get('summary'):
        return {
            'content_reference_status': 'statistics_index_only',
            'display_label': anchor.get('display_label') if anchor else None,
            'original_marks': anchor.get('original_marks') if anchor else None,
            'summary': None,
            'eligible_for_independent_content_calibration': False,
            'content_reference_note': '仅统计索引；须另读并核验原题与解答，不能自动作为内容参照。',
            **calibration_metadata(anchor),
        }
    caveat = evidence == 'verified_statement_with_solution_caveat'
    reference = {
        'content_reference_status': evidence if caveat else 'verified_summary',
        'evidence_type': evidence,
        'display_label': anchor.get('display_label'),
        'original_marks': anchor.get('original_marks'),
        'title': anchor.get('title'),
        'summary': anchor['summary'],
        'problem_url': anchor.get('problem_url'),
        'eligible_for_independent_content_calibration': not caveat,
        **calibration_metadata(anchor),
    }
    if caveat:
        reference['content_reference_note'] = (
            '题面已核验，官方解答细节有保留且未独立验证完整；'
            '仅作题面与历史成绩背景，不可独立作为内容评分或标定依据。')
    return reference


def rating_card(stats, anchors):
    """Join the fixed rating configuration to spoiler-free source references."""
    card = json.loads((ROOT / 'rating-scale.json').read_text())
    by_id = {a['id'].lower(): a for a in anchors}
    ratings = reference_ratings(card)
    conditional_ratings = reference_ratings(card, conditional=True)
    # Do not pass through future internal fields added to configuration rows.
    if 'rated_references' in card:
        card['rated_references'] = list(ratings.values())
    if 'conditional_references' in card:
        card['conditional_references'] = list(conditional_ratings.values())
    if 'deferred_references' in card:
        card['deferred_references'] = [
            {key: row[key] for key in ('anchor_id', 'reason',
                                      'eligible_for_default_profile_calibration') if key in row}
            for row in card['deferred_references']
        ]

    def entry(problem_id, context_only=False, configured_role='fixed_content_anchor',
              conditional=False):
        item = {'id': problem_id, **content_reference(by_id.get(problem_id.lower())),
                'configured_role': 'context_only' if context_only else configured_role,
                'observed': stats.get(problem_id.lower())}
        if conditional:
            item['conditional_reference_rating'] = conditional_ratings[problem_id.lower()]
            item['eligible_for_default_profile_calibration'] = False
        elif problem_id.lower() in ratings and not context_only:
            item['reference_rating'] = ratings[problem_id.lower()]
        if context_only:
            item['eligible_for_independent_content_calibration'] = False
        if item['observed'] is None:
            item['statistics_note'] = '未收录逐题成绩；仅内容参照，不虚构满分率。'
        return item

    for point in card['fixed_points']:
        point['anchors'] = [entry(problem_id) for problem_id in point['anchor_ids']]
        point['context_only_anchors'] = [entry(problem_id, context_only=True)
                                        for problem_id in point.get('context_only_anchor_ids', [])]
    card['scored_reference_groups'] = [
        {
            'score': score,
            'items': [entry(row['anchor_id'], configured_role=row['role'])
                      for row in ratings.values() if row['score'] == score],
        }
        for score in range(card['minimum'], card['maximum'] + 1)
    ]
    card['conditional_reference_items'] = [
        entry(row['anchor_id'], configured_role=row['role'], conditional=True)
        for row in conditional_ratings.values()
    ]
    card['deferred_reference_items'] = []
    for row in card.get('deferred_references', []):
        item = entry(row['anchor_id'], configured_role='rating_deferred')
        item.pop('reference_rating', None)
        item['eligible_for_default_profile_calibration'] = False
        item['deferred_reference_reason'] = row.get('reason')
        card['deferred_reference_items'].append(item)
    card['main_score_rule'] = (
        f"每次给{card['minimum']}–{card['maximum']}整数主分、对应等级、合理范围和证据把握，"
        '最后明确列出评分；范围不是统计置信区间，不使用小数或机械加权合成。'
        '题面完整但参照不足仍给低置信暂定分；仅题面严重缺失、错误或开放性未明等可暂缓。')
    card['rule_reference'] = 'references/difficulty/rating-scale.md'
    card['historical_statistics_note'] = (
        'observed为原题历史成绩，不是新题成功率。固定参考分不会随新年份或检索结果重排；'
        '跨年份、跨赛事reference_rating为题目内容比较判断，不是按满分率或名次换算；'
        'Putnam样本与IMC人群不可混同。范围是判断余量，不是统计置信区间。'
        '--limit不作用于固定尺度卡。')
    return card


def ranked_card(contest, stats, anchors):
    """Group processed references by rated difficulty, not source numbering or marks."""
    card = rating_card(stats, anchors)
    selected_ids = {a['id'].lower() for a in anchors if a['contest'] == contest}

    def selected(items):
        return [item for item in items if item['id'].lower() in selected_ids]

    groups = []
    for group in card['scored_reference_groups']:
        items = selected(group['items'])
        if items:
            groups.append({'score': group['score'], 'items': items,
                           'within_group_order': '同分同组；组内展示顺序不表示难度先后。'})
    context = {item['id']: item for point in card['fixed_points']
               for item in selected(point['context_only_anchors'])}
    return {
        'contest': contest,
        'scale_version': card.get('version'),
        'default_population': card.get('default_population'),
        'rated_item_count': sum(len(group['items']) for group in groups),
        'scope_note': (
            '仅对当前已处理且已给默认画像参考分的题目分组，不是整卷排序或赛事官方排序。'
            '采用同一默认画像，按reference_rating.score从低到高；同分同组，'
            '合理范围重叠时不支持严格先后。--limit不作用于本卡。'),
        'original_marks_note': (
            'original_marks是原卷满分及评分单位，不是难度分；'
            '题号、原卷分值、组内展示顺序均不作为难度排序依据。'),
        'historical_statistics_note': card['historical_statistics_note'],
        'scored_reference_groups': groups,
        'conditional_reference_items': selected(card['conditional_reference_items']),
        'deferred_reference_items': selected(card['deferred_reference_items']),
        'context_only_reference_items': list(context.values()),
        'separate_items_note': '额外知识条件题、评级分歧题、解答核验保留项单列，不与默认画像主分混排。',
    }


def scale_card(contest, year, stats, anchors):
    """Explain one contest-year scale, without solutions or cross-year claims."""
    prefix = f'{contest}-{year}-'.lower()
    selected = {key: row for key, row in stats.items() if key.startswith(prefix)}
    if not selected:
        return None
    by_id = {a['id'].lower(): a for a in anchors}
    groups = []
    for band in range(1, 6):
        items = []
        for key, row in selected.items():
            if row['full_score_position']['band_easy_1_hard_5'] != band:
                continue
            anchor = by_id.get(key)
            # Preserve canonical source IDs, including rows with statistics only.
            problem_id = anchor['id'] if anchor else (
                f'{contest}-{year}-{key.rsplit("-", 1)[1].upper()}')
            item = {
                'id': problem_id,
                'full_count': row['full_count'], 'n': row['n'],
                'full_rate': row['full_rate'],
                'full_score_position': row['full_score_position'],
                'mean_score': row['mean_score'],
                'mean_score_position': row['mean_score_position'],
                'mean_band_differs': (
                    row['mean_score_position']['band_easy_1_hard_5'] != band),
                'population': row['population'],
                'source_url': row['url'],
                'source_status': row.get('status', 'not_recorded_in_bundled_source_metadata'),
                **content_reference(anchor),
            }
            if 'source_pdf_page' in row:
                item['source_pdf_page'] = row['source_pdf_page']
            items.append(item)
        items.sort(key=lambda x: (x['full_score_position']['rank_easy_first'], x['id']))
        rates = [item['full_rate'] for item in items]
        groups.append({
            'band_easy_1_hard_5': band,
            'observed_full_rate_min': min(rates) if rates else None,
            'observed_full_rate_max': max(rates) if rates else None,
            'items': items,
        })
    return {
        'contest': contest, 'year': year, 'item_count': len(selected),
        'scale_definition': (
            '按该赛事该年满分率由高到低排序，平局用中间名次r；'
            '档位=1+min(4,floor(5*(r-1)/m))，m为该年题数。1较易，5较难。'
            '均分另行同法排序，分歧保留；并列可造成档位人数不等或空档。'),
        'scope_note': (
            '作者计算的同年内部相对位置，非官方评级。各档率范围只是本批题的观测范围，'
            '不是新题的固定判定阈值或预测解出率；不能直接跨年或跨赛事等同。'
            '所有该年题目均列出，--limit不作用于尺度卡。'),
        'population_note': (
            'IMC分母为官方榜单全部列名选手，空白格保留在分母并以0计均分。'
            if contest == 'IMC' else
            'Putnam分母仅为该年总分前列样本，绝非全体参赛者；'
            'NA/NS保留在分母但不贡献分数，不作出勤解释。'),
        'bands': groups,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--id')
    p.add_argument('--topic', help='Search summary, tags and knowledge; no relevance guarantee.')
    p.add_argument('--contest', choices=['IMC', 'Putnam', 'CMC'])
    p.add_argument('--hide-stats', action='store_true',
                   help='Content comparison pass: suppress observed scores, reference ratings, '
                        'rating reviews, original marks, and derived positions.')
    p.add_argument('--scale-year', type=int,
                   help='Explain all five within-year bands; requires --contest IMC or Putnam. '
                        'Incompatible with --id, --topic, and --hide-stats; ignores --limit.')
    p.add_argument('--rating-scale', action='store_true',
                   help='Show the fixed 1–10 rating scale with spoiler-free source references. '
                        'Incompatible with other selectors; ignores --limit.')
    p.add_argument('--ranked', action='store_true',
                   help='Group processed references by rated difficulty; requires --contest. '
                        'Incompatible with --id, --topic, --hide-stats, --scale-year, '
                        'and --rating-scale; ignores --limit.')
    p.add_argument('--limit', type=int, default=8)
    args = p.parse_args()
    if args.limit < 1:
        p.error('--limit must be positive')
    if args.ranked:
        if args.contest is None:
            p.error('--ranked requires --contest')
        if (args.id is not None or args.topic is not None or args.hide_stats
                or args.scale_year is not None or args.rating_scale):
            p.error('--ranked cannot be combined with --id, --topic, --hide-stats, '
                    '--scale-year, or --rating-scale')
    if args.rating_scale and (args.scale_year is not None or args.id is not None
                              or args.topic is not None or args.contest is not None
                              or args.hide_stats):
        p.error('--rating-scale cannot be combined with --scale-year, --id, --topic, '
                '--contest, or --hide-stats')
    if args.scale_year is not None:
        if args.id is not None or args.topic is not None or args.hide_stats:
            p.error('--scale-year cannot be combined with --id, --topic, or --hide-stats')
        if args.contest not in {'IMC', 'Putnam'}:
            p.error('--scale-year requires --contest IMC or Putnam; no CMC item statistics are bundled')
    data = json.loads((ROOT / 'anchors.json').read_text())
    anchors = data['anchors'] if isinstance(data, dict) else data
    stats = load_stats()
    if args.ranked:
        print(json.dumps(ranked_card(args.contest, stats, anchors), ensure_ascii=False, indent=2))
        return
    if args.rating_scale:
        print(json.dumps(rating_card(stats, anchors), ensure_ascii=False, indent=2))
        return
    if args.scale_year is not None:
        card = scale_card(args.contest, args.scale_year, stats, anchors)
        if card is None:
            available = sorted({key.split('-')[1] for key in stats
                                if key.startswith(args.contest.lower() + '-')})
            p.error(f'No bundled {args.contest} statistics for {args.scale_year}; '
                    f'available years: {", ".join(available)}')
        print(json.dumps(card, ensure_ascii=False, indent=2))
        return
    ratings = reference_ratings()
    conditional_ratings = reference_ratings(conditional=True)
    rows = []
    for anchor in anchors:
        if args.id and anchor['id'].lower() != args.id.lower():
            continue
        if args.contest and anchor['contest'] != args.contest:
            continue
        if args.topic and args.topic.casefold() not in json.dumps(
                {k: anchor.get(k) for k in ['summary', 'tags', 'knowledge']}, ensure_ascii=False).casefold():
            continue
        if args.hide_stats:
            row = {k: v for k, v in anchor.items()
                   if k not in {'stats', 'observed', 'observed_item_solve_rate',
                                'reference_rating', 'conditional_reference_rating',
                                'rating_review', 'original_marks', 'points'}}
            row.update(calibration_metadata(anchor))
            rows.append(row)
        else:
            row = dict(anchor, observed=stats.get(anchor['id'].lower()),
                       **calibration_metadata(anchor))
            if anchor['id'].lower() in ratings:
                row['reference_rating'] = ratings[anchor['id'].lower()]
            if anchor['id'].lower() in conditional_ratings:
                row['conditional_reference_rating'] = conditional_ratings[anchor['id'].lower()]
                row['eligible_for_default_profile_calibration'] = False
            rows.append(row)
    # A statistics-only ID has no topic content to match. Keep every selector
    # conjunctive: the fallback must not bypass a contest or topic filter.
    if (args.id and not rows and args.id.lower() in stats
            and not args.topic
            and (not args.contest
                 or args.id.lower().startswith(args.contest.lower() + '-'))):
        row = {'id': args.id, 'note': '仅统计索引；使用前须另读原题与解答，不能凭统计猜题。'}
        if not args.hide_stats:
            row['observed'] = stats[args.id.lower()]
            if args.id.lower() in ratings:
                row['reference_rating'] = ratings[args.id.lower()]
            if args.id.lower() in conditional_ratings:
                row['conditional_reference_rating'] = conditional_ratings[args.id.lower()]
                row['eligible_for_default_profile_calibration'] = False
        rows = [row]
    print(json.dumps({'matched': len(rows), 'returned': min(len(rows), args.limit),
                      'anchors': rows[:args.limit]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
