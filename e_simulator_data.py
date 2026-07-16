"""E Simulator (Chronicle Event) API payload builder."""
from __future__ import annotations

import os
from collections import defaultdict

CONTENT_BATTLE = 1
CONTENT_STORY = 2
CONTENT_DOCUMENT = 3
CONTENT_FLAVOR_START = 4
CONTENT_FLAVOR_MIDDLE = 5
CONTENT_FLAVOR_END = 6

SIZE_S, SIZE_M, SIZE_L = 1, 2, 3


def _nid(v):
    if v is None:
        return '0'
    return str(v).strip()


def _load_json(load_json, path):
    if not path or not os.path.isfile(path):
        return []
    data = load_json(path)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ('data', 'Data', 'rows', 'items'):
            if isinstance(data.get(k), list):
                return data[k]
    return []


def _lang_map(rows):
    out = {}
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        lid = _nid(r.get('id') or r.get('Id'))
        val = r.get('value') or r.get('Value') or r.get('text') or r.get('Text') or ''
        if lid != '0':
            out[lid] = str(val).replace('\\n', '\n')
    return out


def _ce_img(name):
    return f'/static/images/Chronicle/{name}.webp'


def _pick_node_thumb(resource_id, size_type, content_type):
    rid = str(resource_id or '').strip()
    if not rid:
        return ''
    if content_type == CONTENT_FLAVOR_START:
        return _ce_img(f'chronicle_thumb_start_flavor_{rid}')
    if content_type == CONTENT_DOCUMENT:
        return _ce_img(f'chronicle_thumb_document_{rid}_l_01')
    if content_type == CONTENT_STORY:
        return _ce_img(f'chronicle_thumb_story_{rid}_01')
    if size_type == SIZE_L:
        # Prefer dedicated large art when present; client falls back via onerror if needed.
        return _ce_img(f'chronicle_thumb_node_{rid}_l')
    return _ce_img(f'chronicle_thumb_node_{rid}_01')


def _content_type_key(idx):
    return {
        CONTENT_BATTLE: 'battle',
        CONTENT_STORY: 'story',
        CONTENT_DOCUMENT: 'document',
        CONTENT_FLAVOR_START: 'flavor_start',
        CONTENT_FLAVOR_MIDDLE: 'flavor_middle',
        CONTENT_FLAVOR_END: 'flavor_end',
    }.get(int(idx or 0), 'unknown')


def build_e_simulator_payload(app_mod, lang_code='EN'):
    """Build full E Simulator JSON for the Stages tab."""
    load_json = app_mod.load_json
    base = app_mod.LANG_PATHS.get(lang_code, {}).get('base') or app_mod.BASE_DIR
    lang_dir = app_mod.LANG_PATHS.get(lang_code, {}).get('lang') or ''
    game_image_public_url = app_mod.game_image_public_url
    normalize_id = app_mod.normalize_id
    resolve_scenario_stage_name = getattr(app_mod, 'resolve_scenario_stage_name', None)
    ld = app_mod.get_lang_data(lang_code)

    events = _load_json(load_json, os.path.join(base, 'm_chronicle_event.json'))
    diagrams = _load_json(load_json, os.path.join(base, 'm_chronicle_event_diagram.json'))
    nodes = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node.json'))
    routes = _load_json(load_json, os.path.join(base, 'm_chronicle_event_route.json'))
    contents = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content.json'))
    battles = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content_battle.json'))
    stories = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content_story.json'))
    documents_c = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content_document.json'))
    flavors = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content_flavor.json'))
    docs = _load_json(load_json, os.path.join(base, 'm_chronicle_event_document.json'))
    story_rewards = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_progress_complete_reward.json'))
    doc_rewards = _load_json(load_json, os.path.join(base, 'm_chronicle_event_document_progress_complete_reward.json'))
    total_rewards = _load_json(load_json, os.path.join(base, 'm_chronicle_event_total_progress_complete_reward.json'))
    cp_cfg = _load_json(load_json, os.path.join(base, 'm_chronicle_event_challenge_point_config.json'))

    node_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_node.json')))
    diagram_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_diagram.json')))
    event_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event.json')))
    doc_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_document.json')))

    battle_by_id = {normalize_id(r.get('Id')): r for r in battles}
    story_by_id = {normalize_id(r.get('Id')): r for r in stories}
    document_c_by_id = {normalize_id(r.get('Id')): r for r in documents_c}
    flavor_by_id = {normalize_id(r.get('Id')): r for r in flavors}
    docs_by_id = {normalize_id(r.get('Id')): r for r in docs}

    contents_by_node = defaultdict(list)
    for c in contents:
        contents_by_node[normalize_id(c.get('ChronicleEventNodeId'))].append(c)

    event = events[0] if events else {}
    event_id = normalize_id(event.get('Id') or event.get('EventId') or '250001')
    recommend_node_id = normalize_id(event.get('RecommendEventPointNodeId'))
    promo = event_lang.get(normalize_id(event.get('PromotionTextLanguageId')), '')

    lang_logo_suffix = {
        'EN': 'en', 'JA': 'ja', 'TW': 'tw', 'HK': 'hk', 'JP': 'ja',
    }.get((lang_code or 'EN').upper(), 'en')

    def pub(path):
        return game_image_public_url(path) if path else ''

    # Documents list
    document_rows = []
    for d in sorted(docs, key=lambda x: int(x.get('Number') or 0)):
        did = normalize_id(d.get('Id'))
        rid = str(d.get('ResourceId') or did)
        document_rows.append({
            'id': did,
            'number': int(d.get('Number') or 0),
            'hint': doc_lang.get(normalize_id(d.get('AcquisitionHintLanguageId')), ''),
            'history_type': int(d.get('HistoryTypeIndex') or 0),
            'thumb': pub(_ce_img(f'chronicle_thumb_document_{rid}_l_01')),
            'thumb_small': pub(_ce_img(f'chronicle_thumb_document_{rid}_s_01')),
        })

    # Routes indexed by endpoints for edges within a diagram
    node_diagram = {normalize_id(n.get('Id')): normalize_id(n.get('ChronicleEventDiagramId')) for n in nodes}

    diagram_payloads = []
    for dg in sorted(diagrams, key=lambda x: normalize_id(x.get('Id'))):
        did = normalize_id(dg.get('Id'))
        bg_rid = str(dg.get('BackgroundResourceId') or dg.get('ResourceId') or '')
        tab_rid = str(dg.get('ResourceId') or did)
        d_nodes = [n for n in nodes if normalize_id(n.get('ChronicleEventDiagramId')) == did]
        xs = [int(n.get('CoordinateX') or 0) for n in d_nodes] or [0]
        ys = [int(n.get('CoordinateY') or 0) for n in d_nodes] or [0]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        node_rows = []
        for n in d_nodes:
            nid = normalize_id(n.get('Id'))
            size_type = int(n.get('SizeTypeIndex') or 1)
            title = node_lang.get(normalize_id(n.get('TitleLanguageId')), '')
            number = node_lang.get(normalize_id(n.get('DiagramNumberLanguageId')), '')
            desc = node_lang.get(normalize_id(n.get('DescriptionLanguageId')), '')
            n_contents = sorted(
                contents_by_node.get(nid, []),
                key=lambda c: (-int(c.get('Priority') or 0), normalize_id(c.get('Id'))),
            )
            content_rows = []
            primary = None
            for c in n_contents:
                cid = normalize_id(c.get('Id'))
                ctype = int(c.get('ContentTypeIndex') or 0)
                target = normalize_id(c.get('TargetId') or cid)
                res = str(c.get('ResourceId') or target)
                entry = {
                    'id': cid,
                    'type': _content_type_key(ctype),
                    'type_index': ctype,
                    'resource_id': res,
                    'challenge_point': int(c.get('ConsumeChallengePointCount') or 0),
                    'thumb': pub(_pick_node_thumb(res, size_type, ctype)),
                }
                if ctype == CONTENT_BATTLE:
                    b = battle_by_id.get(cid) or battle_by_id.get(target) or {}
                    sid = normalize_id(b.get('ScenarioStageId'))
                    sname = ''
                    if sid and sid != '0' and resolve_scenario_stage_name:
                        ssc = (getattr(app_mod, 'scenario_stage_map', {}) or {}).get(sid, {})
                        sname = resolve_scenario_stage_name(ld, ssc.get('title_name_lang_id', '0'), sid)
                    entry.update({
                        'scenario_stage_id': sid if sid != '0' else '',
                        'scenario_stage_name': sname,
                        'divergence': int(b.get('StageDivergenceTypeIndex') or 0),
                        'bromide_unit_id': normalize_id(b.get('BromideUnitId')) if b.get('BromideUnitId') else '',
                    })
                elif ctype == CONTENT_STORY:
                    s = story_by_id.get(cid) or story_by_id.get(target) or {}
                    sid = normalize_id(s.get('ScenarioStageId'))
                    sname = ''
                    if sid and sid != '0' and resolve_scenario_stage_name:
                        ssc = (getattr(app_mod, 'scenario_stage_map', {}) or {}).get(sid, {})
                        sname = resolve_scenario_stage_name(ld, ssc.get('title_name_lang_id', '0'), sid)
                    entry.update({
                        'scenario_stage_id': sid if sid != '0' else '',
                        'scenario_stage_name': sname,
                    })
                    if not entry['thumb']:
                        entry['thumb'] = pub(_ce_img(f'chronicle_thumb_story_{res}_01'))
                elif ctype == CONTENT_DOCUMENT:
                    dc = document_c_by_id.get(cid) or document_c_by_id.get(target) or {}
                    doc_id = normalize_id(dc.get('ChronicleEventDocumentId') or target)
                    doc = docs_by_id.get(doc_id) or {}
                    entry.update({
                        'document_id': doc_id,
                        'document_number': int(doc.get('Number') or 0),
                    })
                    drid = str(doc.get('ResourceId') or doc_id)
                    entry['thumb'] = pub(_ce_img(f'chronicle_thumb_document_{drid}_l_01'))
                elif ctype in (CONTENT_FLAVOR_START, CONTENT_FLAVOR_MIDDLE, CONTENT_FLAVOR_END):
                    fl = flavor_by_id.get(cid) or flavor_by_id.get(target) or {}
                    entry['line_direction'] = int(fl.get('LineDirectionTypeIndex') or 0)
                    entry['line_visible'] = bool(fl.get('IsLineVisible'))
                content_rows.append(entry)
                if primary is None and ctype in (CONTENT_BATTLE, CONTENT_STORY, CONTENT_DOCUMENT, CONTENT_FLAVOR_START):
                    primary = entry
            if primary is None and content_rows:
                primary = content_rows[0]

            view_type = (primary or {}).get('type') or 'unknown'
            thumb = (primary or {}).get('thumb') or ''
            is_flavor_text = view_type in ('flavor_middle', 'flavor_end')
            node_rows.append({
                'id': nid,
                'x': int(n.get('CoordinateX') or 0),
                'y': int(n.get('CoordinateY') or 0),
                'size': {SIZE_S: 's', SIZE_M: 'm', SIZE_L: 'l'}.get(size_type, 's'),
                'size_index': size_type,
                'title': title,
                'number': number,
                'description': desc,
                'history_type': int(n.get('HistoryTypeIndex') or 0),
                'recommend_order': int(n.get('RecommendOrder') or 0),
                'is_recommend': nid == recommend_node_id,
                'view_type': view_type,
                'is_flavor_text': is_flavor_text,
                'thumb': thumb,
                'contents': content_rows,
                'primary': primary,
            })

        edge_rows = []
        for r in routes:
            a = normalize_id(r.get('StartChronicleEventNodeId'))
            b = normalize_id(r.get('EndChronicleEventNodeId'))
            if node_diagram.get(a) != did or node_diagram.get(b) != did:
                continue
            edge_rows.append({
                'id': normalize_id(r.get('Id')),
                'from': a,
                'to': b,
                'release_condition_id': normalize_id(r.get('ReleaseConditionId')),
            })

        diagram_payloads.append({
            'id': did,
            'name': diagram_lang.get(normalize_id(dg.get('NameLanguageId')), did),
            'resource_id': tab_rid,
            'background': pub(_ce_img(f'chronicle_bg_diagram_{bg_rid}')),
            'tab_thumb': pub(_ce_img(f'chronicle_thumb_diagram_{tab_rid}')),
            'bounds': {
                'min_x': min_x, 'max_x': max_x, 'min_y': min_y, 'max_y': max_y,
                'width': max(1, max_x - min_x), 'height': max(1, max_y - min_y),
            },
            'nodes': node_rows,
            'edges': edge_rows,
        })

    cp = cp_cfg[0] if cp_cfg else {}
    next_story = None
    for rw in sorted(story_rewards, key=lambda x: float(x.get('CompleteRate') or 0)):
        next_story = {
            'complete_rate': float(rw.get('CompleteRate') or 0),
            'reward_set_id': normalize_id(rw.get('RewardSetId')),
        }
        break

    return {
        'event_id': event_id,
        'title': 'E Simulator',
        'promotion_text': promo,
        'logo': pub(_ce_img(f'chronicle_event_logo_{event_id}_{lang_logo_suffix}')),
        'banner': pub(_ce_img(f'ce_banner_{event_id}_{lang_logo_suffix}')),
        'recommend_node_id': recommend_node_id,
        'challenge_point': {
            'base_max': int(cp.get('BaseMaxCount') or 30),
            'display_max': int(cp.get('DisplayMaxCount') or 30),
            'recover_interval_hour': int(cp.get('AutoRecoverIntervalHour') or 0),
        },
        'documents': document_rows,
        'document_total': len(document_rows),
        'story_rewards': [
            {'complete_rate': float(r.get('CompleteRate') or 0), 'reward_set_id': normalize_id(r.get('RewardSetId'))}
            for r in sorted(story_rewards, key=lambda x: float(x.get('CompleteRate') or 0))
        ],
        'document_rewards': [
            {'complete_rate': float(r.get('CompleteRate') or 0), 'reward_set_id': normalize_id(r.get('RewardSetId'))}
            for r in sorted(doc_rewards, key=lambda x: float(x.get('CompleteRate') or 0))
        ],
        'total_rewards': [
            {'complete_rate': float(r.get('CompleteRate') or 0), 'reward_set_id': normalize_id(r.get('RewardSetId'))}
            for r in sorted(total_rewards, key=lambda x: float(x.get('CompleteRate') or 0))
        ],
        'next_story_reward': next_story,
        'diagrams': diagram_payloads,
    }
