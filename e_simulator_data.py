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

# In-game shop for E Simulator event currency (TargetCurrencyItemId 291000250001).
ESIM_SHOP_ID = '17250001'


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


# Frame behind Size-L stage thumbs (map + detail).
CHRONICLE_DETAIL_REPORT_BG = _ce_img('Bg_Chronicle_bg_detail_report_complete')


def _pick_node_thumb(resource_id, size_type, content_type, *, detail=False):
    """E Simulator thumbs: always *_02, except Size-L battles which use *_l (no 01/02)."""
    rid = str(resource_id or '').strip()
    if not rid:
        return ''
    # detail kept for call-site compat; E Simulator always prefers color (_02) art.
    _ = detail
    if content_type == CONTENT_FLAVOR_START:
        return _ce_img(f'chronicle_thumb_start_flavor_{rid}')
    if content_type == CONTENT_DOCUMENT:
        return _ce_img(f'chronicle_thumb_document_{rid}_l_02')
    if content_type == CONTENT_STORY:
        return _ce_img(f'chronicle_thumb_story_{rid}_02')
    # Size-L battles use dedicated *_l art (not 01/02) + report-complete BG.
    if content_type == CONTENT_BATTLE and int(size_type or 0) == SIZE_L:
        return _ce_img(f'chronicle_thumb_node_{rid}_l')
    return _ce_img(f'chronicle_thumb_node_{rid}_02')


def _uses_large_node_art(size_type, content_type):
    return content_type == CONTENT_BATTLE and int(size_type or 0) == SIZE_L


def _content_type_key(idx):
    return {
        CONTENT_BATTLE: 'battle',
        CONTENT_STORY: 'story',
        CONTENT_DOCUMENT: 'document',
        CONTENT_FLAVOR_START: 'flavor_start',
        CONTENT_FLAVOR_MIDDLE: 'flavor_middle',
        CONTENT_FLAVOR_END: 'flavor_end',
    }.get(int(idx or 0), 'unknown')


def collect_chronicle_scenario_stage_ids(app_mod, lang_code='EN'):
    """ScenarioStageIds used by chronicle battle/story contents."""
    load_json = app_mod.load_json
    base = app_mod.LANG_PATHS.get(lang_code, {}).get('base') or app_mod.BASE_DIR
    normalize_id = app_mod.normalize_id
    out = set()
    for fn in (
        'm_chronicle_event_node_content_battle.json',
        'm_chronicle_event_node_content_story.json',
    ):
        for r in _load_json(load_json, os.path.join(base, fn)):
            sid = normalize_id(r.get('ScenarioStageId'))
            if sid and sid != '0':
                out.add(sid)
    return out


def _chronicle_stage_content_rows(app_mod, lang_code='EN'):
    """Yield (scenario_stage_id, content_type, resource_id, node, content) for battle/story."""
    load_json = app_mod.load_json
    base = app_mod.LANG_PATHS.get(lang_code, {}).get('base') or app_mod.BASE_DIR
    normalize_id = app_mod.normalize_id
    nodes = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node.json'))
    contents = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content.json'))
    battles = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content_battle.json'))
    stories = _load_json(load_json, os.path.join(base, 'm_chronicle_event_node_content_story.json'))
    node_by_id = {normalize_id(n.get('Id')): n for n in nodes}
    battle_by_id = {normalize_id(r.get('Id')): r for r in battles}
    story_by_id = {normalize_id(r.get('Id')): r for r in stories}
    for c in contents:
        ctype = int(c.get('ContentTypeIndex') or 0)
        if ctype not in (CONTENT_BATTLE, CONTENT_STORY):
            continue
        cid = normalize_id(c.get('Id'))
        target = normalize_id(c.get('TargetId') or cid)
        row = (battle_by_id if ctype == CONTENT_BATTLE else story_by_id).get(cid) or (
            battle_by_id if ctype == CONTENT_BATTLE else story_by_id
        ).get(target) or {}
        sid = normalize_id(row.get('ScenarioStageId'))
        if not sid or sid == '0':
            continue
        res = str(c.get('ResourceId') or target or '').strip()
        n = node_by_id.get(normalize_id(c.get('ChronicleEventNodeId'))) or {}
        yield sid, ctype, res, n, c


def chronicle_stage_title_map(app_mod, lang_code='EN'):
    """Map ScenarioStageId -> display title from chronicle node language."""
    load_json = app_mod.load_json
    lang_dir = app_mod.LANG_PATHS.get(lang_code, {}).get('lang') or ''
    normalize_id = app_mod.normalize_id
    node_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_node.json')))
    out = {}
    for sid, _ctype, _res, n, _c in _chronicle_stage_content_rows(app_mod, lang_code):
        if sid in out:
            continue
        title = node_lang.get(normalize_id(n.get('TitleLanguageId')), '')
        number = node_lang.get(normalize_id(n.get('DiagramNumberLanguageId')), '')
        label = ' '.join(x for x in (number, title) if x).strip()
        if label:
            out[sid] = label
    return out


def chronicle_stage_portrait_map(app_mod, lang_code='EN'):
    """Map ScenarioStageId -> {portrait, portrait_bg, portrait_large} for detail UI."""
    out = {}
    for sid, ctype, res, n, _c in _chronicle_stage_content_rows(app_mod, lang_code):
        if sid in out or not res:
            continue
        size_type = int(n.get('SizeTypeIndex') or 1)
        large = _uses_large_node_art(size_type, ctype)
        out[sid] = {
            'portrait': _pick_node_thumb(res, size_type, ctype, detail=True),
            'portrait_bg': CHRONICLE_DETAIL_REPORT_BG if large else '',
            'portrait_large': large,
        }
    return out


def build_e_simulator_payload(app_mod, lang_code='EN'):
    """Build full E Simulator JSON for the Stages tab."""
    load_json = app_mod.load_json
    base = app_mod.LANG_PATHS.get(lang_code, {}).get('base') or app_mod.BASE_DIR
    lang_dir = app_mod.LANG_PATHS.get(lang_code, {}).get('lang') or ''
    game_image_public_url = app_mod.game_image_public_url
    normalize_id = app_mod.normalize_id
    resolve_scenario_stage_name = getattr(app_mod, 'resolve_scenario_stage_name', None)
    decorate_rewards = getattr(app_mod, '_decorate_reward_rows', None)
    resolve_reward_rows = getattr(app_mod, '_resolve_reward_rows_from_set_id', None)
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
    mission_tabs = _load_json(load_json, os.path.join(base, 'm_chronicle_event_mission_tab.json'))
    missions = _load_json(load_json, os.path.join(base, 'm_chronicle_event_mission.json'))
    mission_complete_rewards = _load_json(
        load_json, os.path.join(base, 'm_chronicle_event_mission_complete_reward.json')
    )
    mission_master = {
        normalize_id(r.get('Id')): r
        for r in _load_json(load_json, os.path.join(base, 'm_mission.json'))
    }
    shops = _load_json(load_json, os.path.join(base, 'm_shop.json'))
    shop_items = _load_json(load_json, os.path.join(base, 'm_shop_item.json'))

    node_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_node.json')))
    diagram_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_diagram.json')))
    event_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event.json')))
    doc_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_document.json')))
    mission_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_mission.json')))
    mission_tab_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_chronicle_event_mission_tab.json')))
    shop_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_shop.json')))
    item_lang = _lang_map(_load_json(load_json, os.path.join(lang_dir, 'm_item.json')))

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
    mission_unlock_hint = event_lang.get(normalize_id(event.get('MissionReleaseConditionLanguageId')), '')

    lang_logo_suffix = {
        'EN': 'en', 'JA': 'ja', 'TW': 'tw', 'HK': 'hk', 'JP': 'ja',
    }.get((lang_code or 'EN').upper(), 'en')

    def pub(path):
        return game_image_public_url(path) if path else ''

    def rewards_for(set_id):
        sid = normalize_id(set_id)
        if not sid or sid == '0' or not resolve_reward_rows or not decorate_rewards:
            return []
        try:
            return decorate_rewards(resolve_reward_rows(sid), lang_code) or []
        except Exception:
            return []

    # Documents list — use _02 art (obtained / color versions).
    document_rows = []
    for d in sorted(docs, key=lambda x: int(x.get('Number') or 0)):
        did = normalize_id(d.get('Id'))
        rid = str(d.get('ResourceId') or did)
        document_rows.append({
            'id': did,
            'number': int(d.get('Number') or 0),
            'hint': doc_lang.get(normalize_id(d.get('AcquisitionHintLanguageId')), ''),
            'history_type': int(d.get('HistoryTypeIndex') or 0),
            'thumb': pub(_ce_img(f'chronicle_thumb_document_{rid}_l_02')),
            'thumb_small': pub(_ce_img(f'chronicle_thumb_document_{rid}_s_02')),
        })

    # Mission tabs + missions (full DB view — not gated by report unlock).
    diagram_name_by_id = {
        normalize_id(dg.get('Id')): diagram_lang.get(normalize_id(dg.get('NameLanguageId')), normalize_id(dg.get('Id')))
        for dg in diagrams
    }
    mission_tab_rows = []
    missions_by_tab = defaultdict(list)
    for m in missions:
        mid = normalize_id(m.get('MissionId') or m.get('Id'))
        tab_id = normalize_id(m.get('ChronicleEventMissionTabId'))
        mm = mission_master.get(mid) or {}
        title_lid = normalize_id(mm.get('OverrideTitleLanguageId') or mm.get('TitleLanguageId'))
        title = mission_lang.get(title_lid, '') or mission_lang.get(normalize_id(mm.get('TitleLanguageId')), '')
        if not title:
            title = f'Mission {mid}'
        desc_lid = normalize_id(mm.get('DescriptionLanguageId') or mm.get('OverrideDescriptionLanguageId'))
        desc = mission_lang.get(desc_lid, '') if desc_lid and desc_lid != '0' else ''
        rsid = normalize_id(mm.get('RewardSetId'))
        missions_by_tab[tab_id].append({
            'id': mid,
            'sort': int(m.get('SortOrder') or 0),
            'title': title,
            'description': desc,
            'target_progress': int(mm.get('TargetProgressCount') or 1),
            'node_content_id': normalize_id(m.get('ChronicleEventNodeContentId')),
            'rewards': rewards_for(rsid),
        })
    for tab in sorted(mission_tabs, key=lambda x: int(x.get('SortOrder') or 0)):
        tid = normalize_id(tab.get('Id'))
        rows = sorted(missions_by_tab.get(tid, []), key=lambda x: x['sort'])
        tab_name = (
            mission_tab_lang.get(normalize_id(tab.get('TabNameLanguageId')), '')
            or diagram_name_by_id.get(tid)
            or diagram_lang.get(normalize_id(tab.get('TabNameLanguageId')), '')
            or tid
        )
        mission_tab_rows.append({
            'id': tid,
            'name': tab_name,
            'missions': rows,
        })

    mission_complete_reward_rows = []
    for rw in sorted(mission_complete_rewards, key=lambda x: float(x.get('CompleteRate') or 0)):
        rsid = normalize_id(rw.get('RewardSetId'))
        mission_complete_reward_rows.append({
            'id': normalize_id(rw.get('Id')),
            'complete_rate': float(rw.get('CompleteRate') or 0),
            'reward_set_id': rsid,
            'rewards': rewards_for(rsid),
        })

    # Shop (event exchange)
    shop_row = next((s for s in shops if normalize_id(s.get('Id')) == ESIM_SHOP_ID), None) or {}
    currency_id = normalize_id(shop_row.get('TargetCurrencyItemId'))
    currency_name = ''
    currency_icon = ''
    if currency_id and currency_id != '0':
        item_info = (getattr(app_mod, 'item_info_map', None) or {}).get(currency_id, {}) or {}
        nlid = normalize_id(item_info.get('name_lang_id'))
        currency_name = str((ld.get('item_text_map') or {}).get(nlid) or item_lang.get(nlid) or '').strip()
        if not currency_name:
            currency_name = f'Item {currency_id}'
        try:
            rid_item = app_mod._resolve_item_icon_resource_id(currency_id, item_info)
            if rid_item:
                currency_icon = app_mod._game_item_icon_url(rid_item) or ''
        except Exception:
            currency_icon = ''

    shop_item_rows = []
    for it in sorted(
        [x for x in shop_items if normalize_id(x.get('ShopId')) == ESIM_SHOP_ID],
        key=lambda x: (-int(x.get('Priority') or 0), normalize_id(x.get('Id'))),
    ):
        rsid = normalize_id(it.get('RewardSetId'))
        rewards = rewards_for(rsid)
        name = shop_lang.get(normalize_id(it.get('NameLanguageId')), '')
        if not name and rewards:
            name = rewards[0].get('name') or rewards[0].get('label') or ''
        shop_item_rows.append({
            'id': normalize_id(it.get('Id')),
            'name': name,
            'cost': int(it.get('RequiredCurrencyCount') or 0),
            'purchase_limit': int(it.get('PurchaseCountLimit') or 0),
            'rewards': rewards,
            'icon': (rewards[0].get('icon') or rewards[0].get('image') or '') if rewards else '',
        })

    node_diagram = {normalize_id(n.get('Id')): normalize_id(n.get('ChronicleEventDiagramId')) for n in nodes}
    stage_titles = chronicle_stage_title_map(app_mod, lang_code)

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
                # All E Simulator node thumbs use _02 (Size-L battles: *_l + report-complete BG).
                large_art = _uses_large_node_art(size_type, ctype)
                entry = {
                    'id': cid,
                    'type': _content_type_key(ctype),
                    'type_index': ctype,
                    'resource_id': res,
                    'challenge_point': int(c.get('ConsumeChallengePointCount') or 0),
                    'thumb': pub(_pick_node_thumb(res, size_type, ctype, detail=True)),
                    'thumb_detail': pub(_pick_node_thumb(res, size_type, ctype, detail=True)),
                    'thumb_large': large_art,
                    'thumb_bg': pub(CHRONICLE_DETAIL_REPORT_BG) if large_art else '',
                }
                if ctype == CONTENT_BATTLE:
                    b = battle_by_id.get(cid) or battle_by_id.get(target) or {}
                    sid = normalize_id(b.get('ScenarioStageId'))
                    sname = stage_titles.get(sid, '')
                    if not sname and sid and sid != '0' and resolve_scenario_stage_name:
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
                    sname = stage_titles.get(sid, '')
                    if not sname and sid and sid != '0' and resolve_scenario_stage_name:
                        ssc = (getattr(app_mod, 'scenario_stage_map', {}) or {}).get(sid, {})
                        sname = resolve_scenario_stage_name(ld, ssc.get('title_name_lang_id', '0'), sid)
                    entry.update({
                        'scenario_stage_id': sid if sid != '0' else '',
                        'scenario_stage_name': sname,
                    })
                elif ctype == CONTENT_DOCUMENT:
                    dc = document_c_by_id.get(cid) or document_c_by_id.get(target) or {}
                    doc_id = normalize_id(dc.get('ChronicleEventDocumentId') or target)
                    doc = docs_by_id.get(doc_id) or {}
                    entry.update({
                        'document_id': doc_id,
                        'document_number': int(doc.get('Number') or 0),
                    })
                    drid = str(doc.get('ResourceId') or doc_id)
                    entry['thumb'] = pub(_ce_img(f'chronicle_thumb_document_{drid}_l_02'))
                    entry['thumb_detail'] = entry['thumb']
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
            thumb_detail = (primary or {}).get('thumb_detail') or thumb
            thumb_large = bool((primary or {}).get('thumb_large'))
            thumb_bg = (primary or {}).get('thumb_bg') or ''
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
                'thumb_detail': thumb_detail,
                'thumb_large': thumb_large,
                'thumb_bg': thumb_bg,
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
        'mission_unlock_hint': mission_unlock_hint,
        'mission_tabs': mission_tab_rows,
        'mission_total': sum(len(t.get('missions') or []) for t in mission_tab_rows),
        'mission_complete_rewards': mission_complete_reward_rows,
        'payload_version': 6,
        'shop': {
            'id': ESIM_SHOP_ID,
            'name': shop_lang.get(normalize_id(shop_row.get('NameLanguageId')), 'E Simulator Shop'),
            'currency_id': currency_id,
            'currency_name': currency_name or 'Event Currency',
            'currency_icon': currency_icon,
            'items': shop_item_rows,
        },
        'stage_titles': stage_titles,
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
