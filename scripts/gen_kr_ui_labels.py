# -*- coding: utf-8 -*-
"""Generate KR UI chrome labels (parity with JA overlays) and patch app.js."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "static" / "js" / "app.js"
EN_JSON = ROOT / "scripts" / "_tmp_en_all.json"
JA_JSON = ROOT / "scripts" / "_tmp_ja_all.json"
OUT_JSON = ROOT / "scripts" / "_tmp_kr_all.json"

# Exact key overrides (HR LANG glossary). Wins over phrase transform.
KEY_KR: dict[str, str] = {
    "tab_char": "캐릭터",
    "tab_ranking": "랭킹",
    "tab_unit": "유닛",
    "tab_supporter": "서포터",
    "tab_stage": "스테이지",
    "tab_mod": "옵션 파츠",
    "tab_latest": "최신 등장",
    "tab_game_news": "게임 뉴스",
    "tab_investment": "투자 우선도",
    "tab_collections": "컬렉션",
    "tab_tag_matrix": "태그 매트릭스",
    "tab_debuff_matrix": "디버프 매트릭스",
    "tab_banner_timeline": "배너 타임라인",
    "tab_team_builder": "팀 빌더",
    "tab_gacha_sim": "가챠 시뮬",
    "tab_master_league": "마스터 리그",
    "tab_meta_synergy": "메타 시너지 랭킹",
    "tag_tab_affinity": "어피니티",
    "tag_results_affinity": "어피니티（태그）:",
    "search_char": "이름 또는 ID로 검색",
    "search_unit": "이름 또는 ID로 검색",
    "search_supporter": "이름 / 시리즈 / 태그로 검색",
    "search_stage": "스테이지 ID 또는 이름으로 검색…",
    "search_mod": "검색: 이름 / 효과 / 태그",
    "search_series_click": "이 시리즈의 캐릭터와 유닛 보기",
    "search_recall": "빠른 검색",
    "filter_series_all": "전체 시리즈",
    "filter_tags_all": "전체 태그",
    "list_filter_series": "시리즈",
    "list_filter_lineage": "태그 / 계보",
    "list_filter_skill": "스킬",
    "list_filter_ability": "어빌리티",
    "list_filter_ability_char": "어빌리티",
    "list_filter_all_skills": "전체 스킬",
    "list_filter_all_abilities": "전체 어빌리티",
    "list_filter_all_abilities_char": "전체 어빌리티",
    "list_filter_series_multi": "시리즈 {n}",
    "list_filter_lineage_multi": "태그 {n}",
    "list_filter_search_placeholder": "검색…",
    "series_filter_all_brand": "기동전사 건담",
    "stage_source_eternal": "이터널 로드",
    "stage_source_btn_eternal": "이터널 로드",
    "stage_source_score": "대규모 공략전 스코어 어택",
    "stage_source_btn_score": "스코어 어택",
    "stage_source_special": "특별 스테이지",
    "stage_source_collab": "콜라보 스테이지",
    "stage_source_tower": "제네레이션 타워",
    "stage_source_btn_tower": "제네레이션 타워",
    "stage_source_challenge": "메인 스테이지 CHALLENGE",
    "stage_source_btn_challenge": "Challenge",
    "stage_source_esim": "E 시뮬레이터",
    "stage_source_group_aria": "스테이지 종류",
    "stage_challenge_series_all": "전체 시리즈",
    "filter_source_all": "전체 입수",
    "filter_source": "입수",
    "filter_diff_all": "전체 난이도",
    "filter_diff_normal": "노멀",
    "filter_diff_hard": "하드",
    "filter_diff_expert": "엑스퍼트",
    "role_filter_attack": "공격형",
    "role_filter_defense": "내구형",
    "role_filter_support": "지원형",
    "count_char": "명",
    "count_unit": "기",
    "count_supporter": "명",
    "count_stage": "스테이지",
    "count_mod": "개",
    "empty_char": "캐릭터를 찾을 수 없습니다",
    "empty_unit": "유닛을 찾을 수 없습니다",
    "empty_supporter": "서포터를 찾을 수 없습니다",
    "empty_stage": "스테이지를 찾을 수 없습니다",
    "empty_mod": "옵션 파츠를 찾을 수 없습니다",
    "col_name": "이름",
    "col_rarity": "레어도",
    "col_role": "타입",
    "col_series_tag": "시리즈 / 태그",
    "col_boost": "보정",
    "col_ranged": "사격치",
    "col_melee": "격투치",
    "col_awaken": "각성치",
    "col_defense": "수비치",
    "col_reaction": "반응치",
    "col_atk": "공격력",
    "col_def": "방어력",
    "col_mob": "기동력",
    "col_mov": "이동력",
    "col_stage_diff": "난이도",
    "col_stage_no": "No.",
    "col_stage_cp": "추천 전력",
    "col_stage_terrain": "지형",
    "col_details": "상세",
    "sec_stats": "스테이터스",
    "sec_terrain": "지형 적성",
    "sec_abilities": "어빌리티",
    "sec_skills": "스킬",
    "sec_active_skills": "액티브 스킬",
    "sec_leader_skill": "리더 스킬",
    "view_grid": "그리드 표시",
    "view_table": "테이블 표시",
    "per_page": "/페이지",
    "whats_new_title": "최신 정보",
    "whats_new_btn": "최신 정보",
    "whats_new_empty": "아직 업데이트 내용이 없습니다.",
    "whats_new_date": "날짜:",
    "whats_new_changes": "변경:",
    "whats_new_added": "추가:",
    "whats_new_close": "닫기",
    "search_spotlight_title": "검색",
    "search_spotlight_close": "닫기",
    "search_spotlight_empty": "일치하는 항목이 없습니다",
    "browse_filters_clear": "필터 초기화",
    "browse_filter_combine_and": "AND",
    "browse_filter_combine_or": "OR",
    "bt_drop_pct_prefix": "배출률",
    "item_sp_conversion": "SP화",
    "stage_map_unit_roster": "주목 유닛",
    "nav_tabs_hidden_notice_hint": "알림이 있는 탭 표시",
    "nav_tabs_hidden_notice_hint_left": "왼쪽의 알림 탭 표시",
    "dc_stage_search_ph": "이터널 로드 / 대규모 공략전 스코어 어택 스테이지 검색…",
    "dc_stage_list_aria": "이터널 로드와 대규모 공략전 스코어 어택 스테이지",
    "dc_def_preset_mode": "프리셋（이터널 로드·대규모 공략전 스코어 어택）",
    "dc_def_preset_target_label": "프리셋 대상（이터널 로드·대규모 공략전 스코어 어택）",
    "dc_score_attack_preset": "스코어 #{n}",
    "tb_option_part": "옵션 파츠",
    "tb_op_swap": "옵션 파츠 변경",
    "tb_picker_sort": "정렬",
    "tb_picker_weapon_attr": "무장",
    "msy_metric_crit": "크리티컬",
    "msy_metric_super_crit": "슈퍼 크리티컬",
    "msy_metric_normal": "통상",
    "msy_status_vigor": "텐션: {v}",
    "msy_open_unit": "유닛",
    "msy_open_char": "파일럿",
    "unit_filter_mechanism": "기구",
    "unit_filter_mechanism_all": "전체 기구",
    "unit_filter_mechanism_multi": "기구 {n}",
    "unit_filter_weapon_debuff": "무장 효과",
    "unit_filter_weapon_debuff_all": "전체 무장 효과",
    "sortie_group": "소대 {}",
    "stage_sortie_unit_restrictions": "유닛 출격 제한",
    "stage_sortie_char_restrictions": "캐릭터 출격 제한",
    "stage_sortie_no_limit": "제한 없음",
    "stage_rewards": "보상",
    "stage_missions": "미션",
    "stage_duration_permanent": "무기한",
    "stage_release_date": "기간（JST）",
    "supp_combat_power": "전력",
    "supp_gacha_quote": "획득 대사",
    "roadmap_calendar_title": "1.5주년 캘린더",
    "kofi_wall_rank1": "1위",
    "kofi_wall_rank2": "2위",
    "kofi_wall_rank3": "3위",
    "kofi_wall_join": "월에 참여",
    "kofi_wall_aria": "서포터",
    "kofi_wall_title": "이 데이터베이스를 지켜 주는 {n}명의 뉴타입에게 감사합니다.",
    "kofi_promo_kw_sneak": "한정 선행 공개",
    "kofi_promo_kw_bonus": "보너스 콘텐츠",
    "kofi_post_notice_aria": "Ko-fi에 새 게시물",
    "kofi_promo_notice_line": "새로운 한정 선행 공개가 올라와 있습니다. 다른 사람보다 먼저 앞으로의 내용을 확인해 보세요. 놓치지 마세요!",
    # Body must include perk phrases above so kofi_donate_promo.js can highlight them.
    "kofi_donate_promo_text": (
        "방문해 주셔서 감사합니다! \U0001f499\n"
        "사이트가 마음에 드셨다면 Ko-fi로 후원해 주세요. 무료 운영을 이어가는 데 큰 도움이 됩니다. "
        "답례로 한정 선행 공개와 보너스 콘텐츠를 드립니다."
    ),
    # Source / combine / DC / TB / MSY polish (avoid half-translated EN)
    "filter_source_assembly": "유닛 보급",
    "filter_source_development": "개발 유닛",
    "filter_source_other": "기타",
    "filter_source_assembly_char": "유닛 보급 캐릭터",
    "filter_source_development_char": "스카우트 / 스토리",
    "browse_filter_combine_tt_and": "AND — 선택한 태그 모두 일치. 클릭하면 결합 모드 전환.",
    "browse_filter_combine_tt_or": "OR — 선택한 태그 중 하나라도 일치. 클릭하면 결합 모드 전환.",
    "browse_filter_combine_tt_and_or": "A ∧ (B ∨ C) — 첫 태그는 필수, 나머지는 하나라도 일치. 클릭하면 결합 모드 전환.",
    "browse_filter_combine_aria_and": "결합 모드 AND — 선택 모두 일치 필요. 조작으로 모드 전환.",
    "browse_filter_combine_aria_or": "결합 모드 OR — 하나라도 일치하면 됨. 조작으로 모드 전환.",
    "browse_filter_combine_aria_and_or": "결합 모드 A ∧ (B ∨ C) — 첫 선택 필수, 나머지는 하나라도 일치. 조작으로 모드 전환.",
    "browse_filter_combine_toggle_title": "결합 모드 전환 — AND, A∧(B∨C), OR",
    "browse_filter_combine_btn": "And / Or",
    "browse_filter_esc": "ESC",
    "list_filter_lineage_multi": "태그 {n}개",
    "dc_pick_unit": "유닛 선택",
    "dc_pick_char": "캐릭터 선택",
    "dc_select_both": "공격 측과 방어 측을 선택하세요",
    "dc_vigor_prefix": "텐션",
    "dc_vigor_medium": "보통",
    "dc_vigor_high": "강기",
    "dc_vigor_max": "초강기",
    "dc_vigor_super": "초일격",
    "dc_vigor_dmg_bonus_sub": "+{pct}%（{label}·위 줄과 대미지에 포함）",
    "dc_title": "대미지 시뮬레이터",
    "dc_normal_dmg": "통상 대미지",
    "dc_crit_dmg": "크리티컬 대미지",
    "dc_super_crit_dmg": "슈퍼 크리티컬 대미지",
    "dc_hit_rate": "명중률",
    "dc_critical": "크리티컬",
    "dc_accuracy": "명중",
    "role_attack": "공격형",
    "role_defense": "내구형",
    "role_support": "지원형",
    "role_all": "전체 타입",
    "rarity_all": "전체 레어도",
    "role_filter_attack": "공격형만",
    "role_filter_defense": "내구형만",
    "role_filter_support": "지원형만",
    "conditional_passive": "조건 패시브",
    "pilot_exclusive_passive": "파일럿 전용 패시브",
    "lr_empty": "예정된 가챠가 없습니다.",
    "lr_empty_recent": "최근 3개월 등장 예정이 없습니다.",
    "lr_load_more": "모두 표시",
    "lr_lock_title": "최신 등장",
    "lr_lock_hint": "시작 전 미리보기는 비밀번호를 입력하세요.",
    "lr_unlock_btn": "해제",
    "lr_section_locked": "이 가챠는 아직 시작 전입니다. 비밀번호를 입력해 라인업을 표시합니다.",
    "lr_pw_wrong": "비밀번호가 틀렸습니다.",
    "lr_type_unit": "유닛",
    "lr_type_char": "캐릭터",
    "lr_type_supp": "서포터",
    "tb_empty_stats": "유닛이 있는 슬롯을 선택하세요.",
    "tb_stats_hint": "MS 스테이터스는 「통상」텐션 기준（고정）. 방어 측·텐션 UI 없음. 옵션 파츠·서포터·마스터 리그·탑승 페어 보정은 반영.",
    "tb_stats_hint_squad": " 태그가 맞는 소대 패시브（공격력 스택 또는 공격력+방어력）는 편성에서 자동 반영됩니다.",
    "tb_supp_level_slider": "서포터 레벨 1–100（게임에 맞게 드래그）",
    "tb_screenshot_fail": "스크린샷을 저장하지 못했습니다",
    "tb_front_deploy": "전위 배치",
    "tb_rear_deploy": "후위 배치",
    "tb_squad1": "소대 1",
    "tb_squad2": "소대 2",
    "tb_copy_link": "링크 복사",
    "tb_link_copied": "복사됨!",
    "tb_screenshot": "스크린샷 저장",
    "tb_formation_modal_title": "편성",
    "tb_option_parts_used": "사용 중인 옵션 파츠",
    "tb_clear_supporter": "서포터 해제",
    "tb_clear_squad": "소대 비우기（유닛·파일럿）",
    "tb_master_league": "마스터 리그 보정 +50%",
    "tb_grand_offensive": "대규모 공략전 보정 +100%",
    "msy_squad_hint": "사용한 유닛과 파일럿은 아래 랭킹에서 일시적으로 제외됩니다.",
    "msy_squad_empty": "빈 슬롯 — 페어 행에서 추가",
    "msy_status_showing": "{n}건 표시",
    "msy_same_role": "동일 타입 캐릭터만",
    "msy_same_role_on": "유닛과 동일 타입 파일럿만 표시",
    "msy_support_role": "지원형만",
    "msy_support_role_on": "지원형 파일럿만 표시",
    "msy_role_all": "전체 타입",
    "msy_search_ph": "유닛 이름 또는 ID…",
    "msy_squad_title": "편성 시뮬레이션",
    "msy_squad_reset": "편성 리셋",
    "msy_open_sim": "시뮬레이터",
    "msy_add_squad": "+ 편성",
    "msy_empty": "필터에 맞는 페어가 없습니다",
    "msy_warming": "랭킹 계산 중…",
    "ml_season_select_aria": "마스터 리그 시즌 선택",
    "ml_empty": "마스터 리그 데이터가 없습니다.",
    "bt_empty": "일정이 없습니다.",
    "bt_sort_start_hint": "클릭하면 시작일로 정렬（▼ 최신순 · ▲ 오래된순）.",
    "bt_vote_err": "투표에 실패했습니다. 다시 시도하세요.",
    "whats_new_tab_empty": "이 항목에 변경이 없습니다.",
    "dc_squad_cond_manual_tip": "자동 판정 불가 조합: 소대 보너스를 수동 입력（공격력만, 최대 100%）.",
    "dc_wpn_trait_effects": "무장 위력（효과 가산）",
    "dc_support_counter_tip": "지원형 공격기 + 이 파일럿: 지원 공격/반격 시 선택적 MS 공격력 %. 파일럿 어빌리티 문구에서 해석.",
    "dc_support_counter_title": "지원 공격/반격 — MS 공격력 %",
    "video_err_fetch": "CDN에서 영상을 불러오지 못했습니다（404 또는 네트워크）.",
    "video_err_codec": "이 영상 형식은 브라우저에서 재생할 수 없습니다 — MP4 (H.264)로 변환하세요.",
    "gs_no_pulls": "아직 가챠 결과가 없습니다.",
    "unit_filter_weapon_debuff_all": "전체 무장 효과",
    "unit_filter_weapon_debuff_multi": "무장 효과 {n}종",
    "unit_filter_wb_acc_dn": "명중률 다운",
    "unit_filter_wb_eva_dn": "회피율 다운",
    "sec_mechanism": "기구",
    "wp_acc": "명중",
    "wp_crit": "크리티컬",
    "char_grid_stat_ranged": "사",
    "char_grid_stat_melee": "격",
    "char_grid_stat_awaken": "각",
    "char_grid_stat_defense": "수",
    "char_grid_stat_reaction": "반",
    "stat_ranged": "사격치",
    "stat_melee": "격투치",
    "stat_awaken": "각성치",
    "stat_defense": "수비치",
    "stat_reaction": "반응치",
    "support_kofi_btn": "Ko-fi로 후원",
    "support_alipayhk_btn": "AlipayHK로 후원",
    "support_feedback_btn": "피드백",
    "cmp_search_char": "캐릭터 검색...",
    "cmp_search_unit": "유닛 검색...",
    "cmp_add_char": "+ 캐릭터 추가",
    "cmp_add_unit": "+ 유닛 추가",
    "cmp_compare": "비교",
    "cmp_unit_compare": "유닛 비교",
    "cmp_char_compare": "캐릭터 비교",
    # Ranking / unit weapon filters + banner timeline (/tl)
    "unit_filter_wb_map_weapon": "MAP 무장",
    "unit_filter_map_weapon_range": "MAP 무장 타입",
    "unit_filter_map_weapon_range_all": "전체 MAP 타입",
    "unit_filter_map_weapon_range_multi": "MAP 타입 {n}종",
    "unit_filter_weapon_range_nm_ssp_ex_only": "SSP/EX만",
    "unit_filter_weapon_range_nm_ssp_ex_all": "SSP/EX만 · 전체 사정거리",
    "unit_filter_mwrt_none": "전체",
    "unit_filter_mwrt_around_myself": "전방위",
    "unit_filter_mwrt_impact_range": "지정 구역",
    "unit_filter_mwrt_specify_direction": "방향 지정",
    "unit_filter_mwrt_moving_attack": "이동 공격",
    "unit_filter_mwrt_whole_map": "맵 전체",
    "unit_filter_mwrt_fixed_position": "고정 위치",
    "unit_filter_mwrt_after_move": "MAP 무기 이동 후",
    "unit_filter_mwrt_snipe": "저격",
    "unit_filter_wb_absolute_hit": "절대 명중",
    "unit_filter_wb_crit": "크리티컬",
    "unit_filter_wb_multi_dmg": "복합 속성（빔／물리／특수）",
    "unit_map_preview_ammo": "탄수",
    "bt_col_start": "시작（JST）",
    "bt_col_end": "종료（JST）",
    "bt_col_duration": "기간",
    "bt_col_featured": "픽업",
    "bt_col_units": "픽업 유닛",
    "bt_col_chars": "픽업 캐릭터",
    "bt_col_supporters": "픽업 서포터",
    "bt_col_banner": "유닛 보급",
    "bt_pity": "천장",
    "bt_pity_after": "{n}회에 UR 확정",
    "bt_drop_supp": "서포",
    "bt_drop_pity_guaranteed": "UR 확정 {pct}",
    "bt_drop_pity_featured": "픽업 {pct}",
    "bt_drop_pity_other": "기타 UR {pct} — {n}기 × 각 {each}",
    "bt_drop_pity_other_share": "기타 UR {pct} — 남은 UR에 균등 배분",
    "bt_drop_10th": "10회째",
    "bt_drop_1to9": "배출률（1〜9회째）",
    "bt_drop_10th_pull": "배출률（10회째）",
    "bt_drop_pity100": "배출률（100회째）",
    "bt_drop_pity_nth": "배출률（{n}회째）",
    "bt_view_table": "표",
    "bt_view_timeline": "타임라인",
    "bt_scroll_top": "페이지 맨 위로",
    "bt_col_featured": "픽업",
    "bt_col_units": "픽업 유닛",
    "bt_col_chars": "픽업 캐릭터",
    "bt_col_supporters": "픽업 서포터",
    "bt_exchange": "교환",
    "bt_exchangeable_pts": "교환 - {n} pt",
    "bt_exchangeable_tab": "교환 - {n} pt",
    "bt_drop_rate": "배출률",
    "bt_empty": "일정이 없습니다.",
    "bt_vote_mode_on": "투표 모드",
    "bt_vote_mode_off": "투표 모드 해제",
    "bt_vote_all": "전부 갖고 싶다!!",
    "bt_vote_skip": "이 가챠는 스킵",
    "bt_vote_total": "총 투표 수：",
    "bt_vote_pick_hint": "탭해서 투표（각 1표）. 다시 탭하면 취소.",
    "bt_vote_done": "투표를 갱신했습니다.",
    "bt_vote_count": "표",
    "bt_vote_mode_caption": "탭해서 투표 — 여러 개 가능, 각 1표까지",
    # Rotate-to-landscape (shared chrome: /tm /dm /gs /roadmap)
    "gs_rotate_hint": "가로 모드로 회전하면 더 보기 편합니다",
    "gs_rotate_hint_aria": "화면을 가로로 회전하면 더 보기 편합니다",
    # Remaining KR_CORE EN leftovers (chrome / DC / stage / TB)
    "applies_to": "적용 대상",
    "branch_victory_conditions": "분기 승리 조건",
    "char_list_stat_base_hint": "기본 성장: {n}",
    "char_list_stat_tooltip": "상시 패시브 포함 합계（EX / 조건 제외）. 시안 = 기본 성장보다 높음.",
    "cmp_radar": "레이더 차트",
    "cmp_reset": "비교 초기화",
    "cmp_stats": "스탯 비교",
    "cmp_type_to_search": "검색어 입력…",
    "dc_def_char_stats_note": "합계에 패시브 보너스가 포함됩니다（스테이지 상세와 동일）. 초록 (+n)은 보너스 분.",
    "dc_def_label": "NPC 목표（디펜더）",
    "dc_def_params_section": "디펜더 파라미터",
    "dc_def_stats_map_note": "합계에 맵 보너스가 포함됩니다（스테이지 상세와 동일）. 초록 (+n)은 보너스 분.",
    "dc_defend": "방어 행동",
    "dc_defender_status": "디펜더 상태",
    "dc_hp_remaining": "남은 HP",
    "dc_hp_remaining_crit": "남은 HP（크리티컬）",
    "dc_hp_remaining_super_crit": "남은 HP（슈퍼 크리티컬）",
    "dc_in_range": "사정거리 안",
    "dc_lb_tier": "한계돌파 단계",
    "dc_mp_level": "MP 레벨",
    "dc_out_range": "사정거리 밖",
    "dc_panel_defender_heading": "디펜더（목표）",
    "dc_range_check": "사정거리 확인",
    "dc_select_npc": "-- NPC 선택 --",
    "dc_terrain": "지형 %",
    "defeat_conditions": "패배 조건",
    "er_stage_lock_hint": "비밀번호를 입력하면 스테이지 상세（맵·NPC·제한）를 볼 수 있습니다.",
    "er_stage_lock_wait": "이 스테이지는 해금 시각이 되면 자동으로 열립니다.",
    "er_stage_pw_wrong": "비밀번호가 올바르지 않습니다.",
    "er_stage_redacted_title": "비공개 스테이지",
    "hp_support": "HP 지원",
    "latest_gasha_title": "최신 정보:",
    "map_effect_theme_dark": "다크 / 대비 맵: 외곽선 + 빈 타일 반전",
    "map_effect_theme_light": "라이트 맵 — 원본 타일（기본）",
    "map_legend_effect": "효과 범위",
    "map_legend_sel": "선택 지점",
    "map_legend_use": "사용 지점",
    "mod_filter_effect_other": "기타（명중·회피·크리티컬…）",
    "rarity_exclude_limited": "기간 한정 제외",
    "rarity_none_selected": "선택 없음",
    "recommended_cp": "권장 CP",
    "search_spotlight_foot": "Esc · 바깥 탭 · ✕로 닫기",
    "sec_npc_details": "NPC 상세",
    "stage_map_buff_toggle": "버프 / 디버프",
    "stage_map_reinf_layer_tt": "증원 출현 레이어（겹치면 시작 적과 같은 좌표）.",
    "stage_map_reinf_toggle": "증원",
    "stage_map_stack_tt": "시작 적과 증원이 이 타일을 공유합니다.",
    "stage_npc_enemy_tab": "적군",
    "stage_npc_friendly_forces_tab": "아군",
    "stage_npc_guest_tab": "게스트",
    "supp_lb_tier": "한계돌파 단계",
    "supply_type": "보급 타입:",
    "tb_batch": "일괄 편성",
    "tb_batch_title": "일괄 편성",
    "tb_linked_move": "유닛과 파일럿을 함께 이동",
    "tb_pick_supp": "탭해서 서포터 선택",
    "tb_rearrange_banner": "슬롯 두 개를 탭해 교체",
    "tb_saved_formations": "저장한 편성",
    "tb_squad_fill": "유닛 {n} / 10",
    "unit_filter_mechanism_tt": "복수 기구: 모두 일치（AND）. 2×2는 마스터 OccupiedAreaId 2（대형 점유）와 동일, 유닛 상세와 같음.",
    "unit_filter_wb_enemy_def_atk": "이 공격으로 적 방어력 감소",
    "unit_filter_wb_mp_1": "MP −1 부여",
    "unit_filter_wb_mp_2": "MP −2 부여",
    "unit_filter_wb_mp_3": "MP −3 부여",
    "unit_filter_wb_preemptive": "선제 공격",
    "unit_filter_wb_range_6": "최대 사정거리 ≥ 6",
    "unit_transform_title": "다른 형태 열기",
    "victory_conditions": "승리 조건",
    "view_effect_range": "효과 범위 보기",
    "whats_new_label_new_char": "신규 캐릭터:",
    "whats_new_label_new_mod": "신규 옵션 파츠:",
    "whats_new_label_new_supporter": "신규 서포터:",
    "whats_new_label_new_unit": "신규 유닛:",
    "whats_new_tab_pending": "직전 기준 이후",
}

# Long / HTML strings that must not go through naive replace
KEY_KR_LONG: dict[str, str] = {
    "search_hint_html": (
        '<div class="search-hint-inner"><strong>캐릭터 / 유닛（기본）</strong> — 키워드는 '
        "<strong>표시 이름</strong>과 <strong>ID</strong>만 매칭합니다（시리즈·태그·어빌리티 문구 제외）. "
        "서포터는 이름 / 시리즈 / 태그로 검색할 수 있습니다.<br>"
        "<strong>모두 일치</strong> — 쉼표 또는 세미콜론으로 구분한 각 단어가 모두 일치해야 합니다.<br>"
        "<strong>제외</strong> — 단어 앞에 <code>-</code>를 붙이면 해당 단어가 포함된 결과를 숨깁니다.<br>"
        "<strong>시리즈</strong> — <code>series:키워드</code>로 작품 시리즈를 좁힐 수 있습니다.<br>"
        "<strong>확장（API）</strong> — <code>q_scope=primary</code>는 태그·시리즈명·별명, "
        "<code>q_scope=full</code>은 어빌리티 / 스킬 / 무장 텍스트까지 포함합니다.<br>"
        "<strong>단축키</strong> — <code>sf</code> = Strike Freedom · <code>ij</code> = Infinite Justice · "
        "<code>god</code> = Burning Gundam · <code>fatb</code> = Full Armor Gundam Thunderbolt · "
        "<code>devil gundam</code> = Dark Gundam。<br>"
        "<strong>힌트</strong> — <code>series:msg</code>는 초대 『기동전사 건담』만입니다.</div>"
    ),
}

# Ordered longest-first phrase replacements applied to EN when no KEY_KR.
PHRASES: list[tuple[str, str]] = [
    ("Grand Offensive Score Attack Stages", "대규모 공략전 스코어 어택 스테이지"),
    ("Grand Offensive Score Attack", "대규모 공략전 스코어 어택"),
    ("Grand Offensive Buff", "대규모 공략전 보정"),
    ("Pilot Exclusive Passive", "파일럿 전용 패시브"),
    ("Conditional Passive", "조건 패시브"),
    ("Damage Simulator", "대미지 시뮬레이터"),
    ("Meta Synergistic Rankings", "메타 시너지 랭킹"),
    ("Eternal Expert", "이터널 엑스퍼트"),
    ("Eternal Road", "이터널 로드"),
    ("Master League Buff", "마스터 리그 보정"),
    ("Master League", "마스터 리그"),
    ("Option Parts", "옵션 파츠"),
    ("Option Part", "옵션 파츠"),
    ("Limit Break", "한계 돌파"),
    ("Support Attack/Counter", "지원 공격/반격"),
    ("Support Defense", "지원 방어"),
    ("Tags / Lineage", "태그 / 계보"),
    ("All Series", "전체 시리즈"),
    ("All series", "전체 시리즈"),
    ("All Tags", "전체 태그"),
    ("All Skills", "전체 스킬"),
    ("All Abilities", "전체 어빌리티"),
    ("All roles", "전체 타입"),
    ("All MAP Types", "전체 MAP 타입"),
    ("Search name or ID — …", "이름 또는 ID로 검색"),
    ("Search name or ID", "이름 또는 ID로 검색"),
    ("Search name, series, tags — …", "이름 / 시리즈 / 태그로 검색"),
    ("Search units by name or ID…", "유닛 이름 또는 ID로 검색…"),
    ("Collaboration Stage", "콜라보 스테이지"),
    ("Special Stages", "특별 스테이지"),
    ("Challenge Main Stages", "메인 스테이지 CHALLENGE"),
    ("Challenge Stages", "Challenge"),
    ("Score Attack", "스코어 어택"),
    ("Generation Tower", "제네레이션 타워"),
    ("E Simulator", "E 시뮬레이터"),
    ("Unit Assembly", "유닛 보급"),
    ("Team Builder", "팀 빌더"),
    ("Units from", "출처:"),
    ("Select unit", "유닛 선택"),
    ("Select character", "캐릭터 선택"),
    ("Select a unit slot.", "유닛이 있는 슬롯을 선택하세요."),
    ("No scheduled gacha releases found.", "예정된 가챠가 없습니다."),
    ("No changes in this section.", "이 항목에 변경이 없습니다."),
    ("No schedule data.", "일정이 없습니다."),
    ("No pulls yet.", "아직 가챠 결과가 없습니다."),
    ("Could not save screenshot", "스크린샷을 저장하지 못했습니다"),
    ("Could not update vote. Try again.", "투표에 실패했습니다. 다시 시도하세요."),
    ("Could not load video from CDN (404 or network error).", "CDN에서 영상을 불러오지 못했습니다（404 또는 네트워크）."),
    ("Showing {n}", "{n}건 표시"),
    ("Same Role Characters Only", "동일 타입 캐릭터만"),
    ("Showing same-role pilots only", "유닛과 동일 타입 파일럿만 표시"),
    ("Showing Support-role pilots only", "지원형 파일럿만 표시"),
    ("Supporters only", "지원형만"),
    ("Super Critical", "슈퍼 크리티컬"),
    ("Super vigor", "초강기"),
    ("Supercharged", "초일격"),
    ("Critical Damage", "크리티컬 대미지"),
    ("Normal Damage", "통상 대미지"),
    ("Damage Dealt", "대미지 상승"),
    ("damage dealt", "대미지 상승"),
    ("Active skills", "액티브 스킬"),
    ("active skills", "액티브 스킬"),
    ("Mechanisms", "기구"),
    ("Modifications", "옵션 파츠"),
    ("Characters", "캐릭터"),
    ("Character", "캐릭터"),
    ("Supporters", "서포터"),
    ("Supporter", "서포터"),
    ("Units", "유닛"),
    ("Unit", "유닛"),
    ("Stages", "스테이지"),
    ("Stage", "스테이지"),
    ("Abilities", "어빌리티"),
    ("Ability", "어빌리티"),
    ("Skills", "스킬"),
    ("Skill", "스킬"),
    ("Series", "시리즈"),
    ("Tags", "태그"),
    ("Tag", "태그"),
    ("Pilots", "파일럿"),
    ("Pilot", "파일럿"),
    ("Ranking", "랭킹"),
    ("rankings", "랭킹"),
    ("Rankings", "랭킹"),
    ("Critical", "크리티컬"),
    ("Accuracy", "명중"),
    ("Evasion", "회피"),
    ("Vigor", "텐션"),
    ("Damage", "대미지"),
    ("damage", "대미지"),
    ("Defense", "방어력"),
    ("Attack", "공격력"),
    ("Mobility", "기동력"),
    ("Ranged", "사격"),
    ("Melee", "격투"),
    ("Awaken", "각성"),
    ("Reaction", "반응"),
    ("Search", "검색"),
    ("Filter", "필터"),
    ("Clear", "해제"),
    ("Close", "닫기"),
    ("Loading", "로딩"),
    ("Empty", "비어 있음"),
    ("Rewards", "보상"),
    ("Missions", "미션"),
    ("Permanent", "무기한"),
    ("Release Date", "기간"),
    ("Previous", "이전"),
    ("Next", "다음"),
    ("Back to", "돌아가기:"),
    ("No Limit", "제한 없음"),
    ("Sortie Restrictions", "출격 제한"),
    ("Sort", "정렬"),
    ("Weapon", "무장"),
    ("Normal", "통상"),
    ("Expected", "기대값"),
    ("Grouped", "그룹"),
    ("Table view", "테이블"),
    ("Bar chart view", "막대 차트"),
    ("Simulator", "시뮬레이터"),
    ("Squad", "소대"),
    ("Formation", "편성"),
    ("Copy link", "링크 복사"),
    ("Copied!", "복사됨!"),
    ("Save screenshot", "스크린샷 저장"),
    ("Front Deployment", "전위 배치"),
    ("Rear Deployment", "후위 배치"),
    ("Same Role", "동일 타입"),
    ("same-role", "동일 타입"),
    ("Exclude UR", "UR 제외"),
    ("Guaranteed Critical", "확정 크리티컬"),
    ("Affinity match", "어피니티 일치"),
    ("Combat Power", "전력"),
    ("Obtained Quote", "획득 대사"),
    ("First-Clear Rewards", "첫 클리어 보상"),
    ("Secret Battles", "시크릿 배틀"),
    ("Progress Rewards", "진행 보상"),
    ("Completion Rewards", "컴플리트 보상"),
    ("Capturable Units", "노획 가능 유닛"),
    ("Spawn order", "출현 순서"),
    ("Escape", "탈출"),
    ("Fullscreen", "전체 화면"),
    ("Volume", "볼륨"),
    ("Skip", "스킵"),
    ("Done", "완료"),
    ("Preview", "미리보기"),
    ("Drop %", "배출률"),
    ("All", "전체"),
]


def js_escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def translate_en(s: str) -> str:
    if not s:
        return s
    out = s
    for a, b in PHRASES:
        if a in out:
            out = out.replace(a, b)
    return out


def build_kr(en: dict[str, str], ja_keys: dict[str, str]) -> dict[str, str]:
    kr: dict[str, str] = {}
    for key in ja_keys:
        if key in KEY_KR_LONG:
            kr[key] = KEY_KR_LONG[key]
        elif key in KEY_KR:
            kr[key] = KEY_KR[key]
        else:
            src = en.get(key) or ja_keys.get(key) or key
            # Prefer EN meaning; if missing, leave JA (rare)
            if key in en:
                kr[key] = translate_en(en[key])
            else:
                kr[key] = src
    # Also cover important EN-only chrome often shown
    for key, val in KEY_KR.items():
        kr.setdefault(key, val)
    for key, val in KEY_KR_LONG.items():
        kr.setdefault(key, val)
    return kr


def emit_js_object(kr: dict[str, str]) -> str:
    parts = [f"{k}:'{js_escape(v)}'" for k, v in sorted(kr.items())]
    # Keep reasonably sized lines
    lines = []
    buf = []
    size = 0
    for p in parts:
        if size + len(p) > 160 and buf:
            lines.append(",".join(buf))
            buf = [p]
            size = len(p)
        else:
            buf.append(p)
            size += len(p) + 1
    if buf:
        lines.append(",".join(buf))
    return "{\n" + ",\n".join(lines) + "\n}"


def _replace_kr_core_block(text: str, kr_obj_js: str) -> str:
    """Replace or insert `const KR_CORE_LABELS={...};` via brace matching."""
    marker = "const KR_CORE_LABELS="
    block = (
        marker
        + kr_obj_js
        + ";\n/* KR UI chrome — full pack (HR LANG glossary). */\n"
        "T.KR=Object.assign({},T.EN,KR_CORE_LABELS);T.HR=T.KR;"
    )
    stub = (
        "/* KR UI chrome: EN shell for now; game dossier text comes from HR LANG pack. */\n"
        "T.KR=Object.assign({},T.EN);T.HR=T.KR;"
    )
    if marker in text:
        start = text.index(marker)
        i = start + len(marker)
        if text[i] != "{":
            raise RuntimeError("KR_CORE_LABELS not followed by {")
        depth = 0
        in_str = False
        esc = False
        j = i
        while j < len(text):
            ch = text[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == "'":
                    in_str = False
            else:
                if ch == "'":
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
            j += 1
        # consume optional `;` and following early T.KR seal / comment
        end = j
        if end < len(text) and text[end] == ";":
            end += 1
        # eat whitespace + optional comment + optional T.KR=... seal
        m = re.match(
            r"\s*(?:/\* KR[\s\S]*?\*/\s*)?(?:T\.KR=Object\.assign\(\{\},T\.EN,KR_CORE_LABELS\);T\.HR=T\.KR;)?",
            text[end:],
        )
        if m:
            end += m.end()
        return text[:start] + block + text[end:]
    if stub in text:
        return text.replace(stub, block, 1)
    # insert before function t
    return text.replace("function t(key){", block + "\nfunction t(key){", 1)


def patch_app_js(kr_obj_js: str) -> None:
    text = APP_JS.read_text(encoding="utf-8")
    text = _replace_kr_core_block(text, kr_obj_js)

    # Final seal immediately before function t so late Object.assign(T.EN,…) cannot wipe KR.
    seal = "T.KR=Object.assign({},T.EN,KR_CORE_LABELS);T.HR=T.KR;"
    if "function t(key){" in text:
        pre, post = text.split("function t(key){", 1)
        pre = re.sub(
            r"(?:T\.KR=Object\.assign\(\{\},T\.EN,KR_CORE_LABELS\);T\.HR=T\.KR;\s*)+$",
            "",
            pre,
        )
        text = pre + seal + "\nfunction t(key){" + post

    # t() / label helpers: treat KR/HR like JA for grid abbreviations
    text = text.replace(
        "function t(key){const lang=S.lang||'EN';return(T[lang]&&T[lang][key])||T.EN[key]||key}",
        "function t(key){let lang=S.lang||'EN';if(lang==='JP')lang='JA';if(lang==='HR')lang='KR';return(T[lang]&&T[lang][key])||T.EN[key]||key}",
    )
    text = text.replace(
        "if((lang==='TW'||lang==='HK'||lang==='JA'||lang==='JP')&&ctx==='character')",
        "if((lang==='TW'||lang==='HK'||lang==='JA'||lang==='JP'||lang==='KR'||lang==='HR')&&ctx==='character')",
    )
    text = text.replace(
        "if(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP'){const ck=colMap[k];return ck?t(ck):tStat(k,'character')}",
        "if(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP'||S.lang==='KR'||S.lang==='HR'){const ck=colMap[k];return ck?t(ck):tStat(k,'character')}",
    )
    # tableStatMobLabel KR short forms
    if "S.lang==='KR'||S.lang==='HR'" not in text[text.find("function tableStatMobLabel") : text.find("function tableStatMobLabel") + 400]:
        text = text.replace(
            "if(S.lang==='JA'||S.lang==='JP'){const m={Ranged:'射',Melee:'格',Awaken:'覚',Defense:'守',Reaction:'反'};if(m[k])return m[k]}",
            "if(S.lang==='JA'||S.lang==='JP'){const m={Ranged:'射',Melee:'格',Awaken:'覚',Defense:'守',Reaction:'反'};if(m[k])return m[k]}"
            "if(S.lang==='KR'||S.lang==='HR'){const m={Ranged:'사',Melee:'격',Awaken:'각',Defense:'수',Reaction:'반'};if(m[k])return m[k]}",
        )
    text = text.replace(
        "if(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP'){const m={HP:'HP',EN:'EN',ATK:'攻',DEF:'守',MOB:'機',MOV:'移'};return m[key]||key}",
        "if(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP'){const m={HP:'HP',EN:'EN',ATK:'攻',DEF:'守',MOB:'機',MOV:'移'};return m[key]||key}"
        "if(S.lang==='KR'||S.lang==='HR'){const m={HP:'HP',EN:'EN',ATK:'공',DEF:'수',MOB:'기',MOV:'이'};return m[key]||key}",
    )

    # STAT_NAME_MAP_CHAR for KR if JA has one — ensure character column map
    if "STAT_NAME_MAP_CHAR" in text and "STAT_NAME_MAP_CHAR.KR" not in text:
        # after STAT_NAME_MAP.KR line is fine; add CHAR map if exists for JA
        m = re.search(r"STAT_NAME_MAP_CHAR\.JA\s*=\s*(\{.*?\});", text)
        if m:
            # character-specific: 사격치 etc already in col_*; map Defense→수비치 style via STAT
            insert = (
                "STAT_NAME_MAP_CHAR.HR={'Ranged':'사격치','Melee':'격투치','Awaken':'각성치',"
                "'Defense':'수비치','Reaction':'반응치','HP':'HP','EN':'EN','Attack':'공격력',"
                "'ATK':'공격력','DEF':'수비치','MOB':'기동력','Mobility':'기동력','Move':'이동력'};"
                "STAT_NAME_MAP_CHAR.KR=STAT_NAME_MAP_CHAR.HR;"
            )
            # place after STAT_NAME_MAP.KR assignment
            anchor = "STAT_NAME_MAP.KR=STAT_NAME_MAP.HR;"
            if anchor in text and insert not in text:
                text = text.replace(anchor, anchor + "\n" + insert, 1)

    APP_JS.write_text(text, encoding="utf-8")


def main() -> None:
    if not EN_JSON.exists() or not JA_JSON.exists():
        raise SystemExit("Run scripts/_tmp_export_en_i18n.py and _tmp_i18n_audit.py first")
    en = json.loads(EN_JSON.read_text(encoding="utf-8"))
    ja = json.loads(JA_JSON.read_text(encoding="utf-8"))
    kr = build_kr(en, ja)
    OUT_JSON.write_text(json.dumps(kr, ensure_ascii=False, indent=2), encoding="utf-8")
    print("KR keys", len(kr))
    for k in (
        "filter_series_all",
        "filter_tags_all",
        "list_filter_all_skills",
        "list_filter_all_abilities_char",
        "search_char",
        "tab_char",
    ):
        print(k, "=>", kr.get(k))
    patch_app_js(emit_js_object(kr))
    # sanity
    t = APP_JS.read_text(encoding="utf-8")
    assert "KR_CORE_LABELS" in t
    assert "filter_series_all:'전체 시리즈'" in t or "filter_series_all:'전체 시리즈'" in t.replace("\\", "")
    assert t.count("function t(key){") == 1
    print("patched", APP_JS)


if __name__ == "__main__":
    main()
