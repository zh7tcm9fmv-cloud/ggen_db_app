const IMAGE_CDN = String(window.__GGEN_IMAGE_CDN__ || '').replace(/\/+$/, '');
const GAME_IMAGES_USE_CDN = !!window.__GGEN_GAME_IMAGES_USE_CDN__;
const _imgUrlCache = new Map();
const _imgUrlCacheMax = 8192;
function imgUrl(path) {
    if (!path) return '';
    const hit = _imgUrlCache.get(path);
    if (hit !== undefined) return hit;
    let out;
    if (path.startsWith('http://') || path.startsWith('https://')) out = path;
    else if (!path.startsWith('/static/images/')) out = path;
    else {
        const gamePath = path.replace(/\.(png|jpg|jpeg)(\?|#|$)/i, '.webp$2');
        if (!GAME_IMAGES_USE_CDN) out = gamePath;
        else if (IMAGE_CDN) out = IMAGE_CDN + '/images/' + gamePath.substring('/static/images/'.length);
        else out = gamePath;
    }
    if (_imgUrlCache.size >= _imgUrlCacheMax) {
        const k = _imgUrlCache.keys().next().value;
        _imgUrlCache.delete(k);
    }
    _imgUrlCache.set(path, out);
    return out;
}
/** Like imgUrl, but if IMAGE_CDN is set, always use it for /static/images/* (ignores GAME_IMAGES_USE_CDN). */
function imgUrlPreferCdn(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (IMAGE_CDN && path.startsWith('/static/images/')) {
        return IMAGE_CDN + '/images/' + path.substring('/static/images/'.length);
    }
    return imgUrl(path);
}
function imgUrlWebp(path) {
    if (!path) return '';
    const base = String(path).split(/[?#]/)[0];
    if (/\.webp$/i.test(base)) return imgUrl(path);
    const u = imgUrl(path);
    return u.replace(/\.(png|jpg|jpeg)(\?|$)/i, '.webp$2');
}
function isRasterWebpCandidate(path) {
    if (!path) return false;
    const p = String(path).split(/[?#]/)[0].toLowerCase();
    return /\.(png|jpe?g)$/.test(p) && !p.endsWith('.webp');
}
function pictureRasterHtml(path, opts) {
    const o = opts || {};
    if (!path) return '';
    const pngSrc = imgUrl(path);
    const cls = o.cls || '';
    const alt = o.alt != null ? String(o.alt) : '';
    const extra = o.extra ? ' ' + o.extra.trim() : '';
    let loadAttr = '';
    if (o.loading !== undefined && o.loading !== null && o.loading !== '') {
        loadAttr = ` loading="${escAttr(String(o.loading))}"`;
    } else if (o.lazy !== false) {
        loadAttr = ' loading="lazy"';
    }
    const decAttr = o.decoding === false || o.decoding === '' ? '' : ` decoding="${escAttr(o.decoding || 'async')}"`;
    const fpAttr = (loadAttr.indexOf('lazy') !== -1) ? ' fetchpriority="low"' : '';
    if (!isRasterWebpCandidate(path)) {
        const onerrAttr = o.onerror ? ` onerror="${o.onerror}"` : '';
        return `<img class="${cls}" src="${escAttr(pngSrc)}" alt="${escAttr(alt)}"${loadAttr}${decAttr}${fpAttr}${onerrAttr}${extra}>`.trim();
    }
    const webpSrc = imgUrlWebp(path);
    let onerrJs = `this.onerror=null;this.src=${JSON.stringify(pngSrc)}`;
    if (o.onerror) {
        onerrJs += `;this.onerror=function(){${o.onerror}}`;
    }
    const onerrAttr = ` onerror="${escAttr(onerrJs)}"`;
    return `<img class="${cls}" src="${escAttr(webpSrc)}" alt="${escAttr(alt)}"${loadAttr}${decAttr}${fpAttr}${onerrAttr}${extra}>`.trim();
}
function imgTag(path, opts) {
    if (!path) return '';
    const o = opts || {};
    const lazy = o.lazy !== false;
    const webp = o.webp === true;
    const alt = o.alt || '';
    const cls = o.cls || '';
    const extra = o.extra || '';
    const onerr = o.onerror || '';
    if (webp) {
        return pictureRasterHtml(path, { cls, alt, loading: lazy ? 'lazy' : undefined, onerror: onerr || undefined, extra, lazy });
    }
    const src = imgUrl(path);
    const loadAttr = lazy ? ' loading="lazy"' : '';
    const decAttr = lazy ? ' decoding="async"' : '';
    const fpAttr = lazy ? ' fetchpriority="low"' : '';
    const onerrAttr = onerr ? ` onerror="${onerr}"` : '';
    return `<img class="${cls}" src="${src}" alt="${alt}"${loadAttr}${decAttr}${fpAttr}${onerrAttr} ${extra}>`.trim();
}
function _dcEternalStageDiffIconHtml(code){
const c=code==='hard'?'hard':code==='expert'?'expert':code==='normal'?'normal':'unknown';
const base='/static/images/UI/MissionPanel_Level_Cell #4374.webp';
const src=imgUrl(base);
return `<img class="dc-er-diff-icon dc-er-diff-icon--${c}" src="${escAttr(src)}" alt="" width="18" height="18" loading="lazy" decoding="async" onerror="this.outerHTML='<span class=\\'dc-er-diff-fallback dc-er-diff-fallback--${c}\\'></span>'">`;
}
function _dcDcStageDifficultyRank(code){
const c=String(code||'').toLowerCase();
if(c==='expert')return 0;
if(c==='hard')return 1;
if(c==='normal')return 2;
return 99;
}
function _dcScoreAttackPresetIndex(r){
if(!r||r.stage_category!=='score_attack'||r.score_attack_index==null)return 0;
const n=parseInt(String(r.score_attack_index),10);
return(!isNaN(n)&&n>=1)?n:0;
}
function _dcStageDisplayPrimary(s){
if(!s)return'';
if(s.content_locked)return t('er_stage_redacted_row');
const n=_dcScoreAttackPresetIndex(s);
if(n)return String(t('dc_score_attack_preset')).replace('{n}',String(n));
return s.name||'';
}
function _dcFilterDcStages(stages,q){
const s=(q||'').trim().toLowerCase();
const arr=!s?stages.slice():stages.filter(r=>{
const id=String(r.id||'').toLowerCase();
const nm=String(r.name||'').toLowerCase();
const df=String(r.difficulty||'').toLowerCase();
const dc=String(r.difficulty_code||'').toLowerCase();
const sn=_dcScoreAttackPresetIndex(r);
const pl=(sn?String(t('dc_score_attack_preset')).replace('{n}',String(sn)):'').toLowerCase();
return id.includes(s)||nm.includes(s)||df.includes(s)||dc.includes(s)||pl.includes(s);
});
arr.sort((a,b)=>{
const ra=_dcDcStageDifficultyRank(a.difficulty_code);
const rb=_dcDcStageDifficultyRank(b.difficulty_code);
if(ra!==rb)return ra-rb;
const ia=_dcScoreAttackPresetIndex(a)||999;
const ib=_dcScoreAttackPresetIndex(b)||999;
if(ia!==ib)return ia-ib;
return (parseInt(String(a.id),10)||0)-(parseInt(String(b.id),10)||0);
});
return arr;
}
function _dcStageOptionLabel(s){
if(s&&s.content_locked)return `${esc(t('er_stage_redacted_row'))} (—)`;
return `${esc(_dcStageDisplayPrimary(s))} (${esc(s.difficulty||'')})`;
}
function _dcFillDcStageSelectOptions(stages){
const sel=document.getElementById('dcStageSelect');
if(!sel)return;
const prev=sel.value;
sel.innerHTML='<option value="">-- Select Stage --</option>'+stages.map(s=>`<option value="${escAttr(String(s.id))}">${_dcStageOptionLabel(s)}</option>`).join('');
if(prev&&[...sel.options].some(o=>String(o.value)===String(prev)))sel.value=prev;
_dcUpdateDcStageDdLabel();
}
function _dcOnDcStageSearchInput(){void _dcRebuildDcStageUi()}
function _dcUpdateDcStageDdLabel(){
const sel=document.getElementById('dcStageSelect');
const btn=document.getElementById('dcStageDdBtn');
if(!btn)return;
const v=sel&&sel.value;
if(!v){btn.textContent='-- Select Stage --';return}
const stages=_dcStagesCache||[];
const hit=stages.find(s=>String(s.id)===String(v));
if(hit)btn.textContent=hit.content_locked?t('er_stage_redacted_row'):`${_dcStageDisplayPrimary(hit)} (${hit.difficulty||''})`;
else btn.textContent=`Stage ${v}`;
}
function _dcToggleDcStageDd(ev){
if(ev)ev.stopPropagation();
const p=document.getElementById('dcStageDdPanel');
if(!p)return;
const opening=!!p.hidden;
if(opening){
const b=document.getElementById('dcStageDdBtn');
if(b)b.setAttribute('aria-expanded','true');
p.hidden=false;
const s=document.getElementById('dcStageSearch');
if(s)s.value='';
void _dcRebuildDcStageUi();
if(s)requestAnimationFrame(()=>{try{s.focus()}catch(_){}});
}else{_dcCloseDcStageDd();}
}
function _dcCloseDcStageDd(){
const p=document.getElementById('dcStageDdPanel');
const b=document.getElementById('dcStageDdBtn');
const list=document.getElementById('dcStageList');
if(p)p.hidden=true;
if(b)b.setAttribute('aria-expanded','false');
if(list)list.innerHTML='';
}
function _dcPickDcStage(sid){
const sel=document.getElementById('dcStageSelect');
if(!sel)return;
sel.value=String(sid);
onDcStageChange();
_dcUpdateDcStageDdLabel();
_dcCloseDcStageDd();
}
async function _dcRebuildDcStageUi(){
const p=document.getElementById('dcStageDdPanel');
if(p&&p.hidden)return;
if(_dcStagesCache===null)await loadDcStages();
const stages=_dcStagesCache||[];
const q=document.getElementById('dcStageSearch')?document.getElementById('dcStageSearch').value:'';
const filtered=_dcFilterDcStages(stages,q);
const sel=document.getElementById('dcStageSelect');
const list=document.getElementById('dcStageList');
if(!list||!sel)return;
const cur=sel.value;
if(!filtered.length){list.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:12px">No matching stages.</div>';return}
list.innerHTML=filtered.map(s=>{
const active=String(cur)===String(s.id);
const dc=s.content_locked?'unknown':(s.difficulty_code||'normal');
const lk=s.content_locked?' dc-stage-hit--locked':'';
const nm=s.content_locked?t('er_stage_redacted_row'):_dcStageDisplayPrimary(s);const meta=s.content_locked?'—':(s.difficulty||'');
return`<button type="button" class="dc-stage-hit${active?' is-active':''}${lk}" role="option" ${active?'aria-selected="true"':'aria-selected="false"'} onclick='_dcPickDcStage(${JSON.stringify(String(s.id))})'>${_dcEternalStageDiffIconHtml(dc)}<span class="dc-stage-hit-name">${esc(nm)}</span><span class="dc-stage-hit-meta">${esc(meta)}</span></button>`;
}).join('');
}

const T={EN:{tab_char:'Characters',tab_ranking:'Ranking',tab_unit:'Units',tab_supporter:'Supporters',tab_stage:'Stages',stage_source_group_aria:'Stage categories',stage_source_eternal:'Eternal Road',stage_source_score:'Map Event Score Attack Stages',stage_source_special:'Special Stages',dc_def_preset_mode:'Preset (ER Stages, Score Attack Stages)',dc_def_preset_target_label:'Preset Target (ER Stages, Score Attack Stages)',dc_stage_search_ph:'Search ER & Score Attack stages…',dc_stage_list_aria:'ER and Score Attack stages',dc_score_attack_preset:'Score #{n}',search_char:'Search name or ID — …',search_unit:'Search name or ID — …',search_supporter:'Search name, series, tags — …',search_stage:'Stage ID or name — , or ; = ALL terms',search_series_click:'View characters & units in this series',search_hint_html:'<div class="search-hint-inner"><strong>Characters &amp; units (default)</strong> — Free text matches <strong>display name</strong> and <strong>entity ID</strong> only (not series, tags, or abilities). Supporters still use name / series / tags.<br><strong>Match all terms</strong> — Separate with commas or semicolons; every segment must match.<br><strong>Exclude</strong> — Put <code>-</code> in front of a term to hide any result that still contains that text.<br><strong>Series</strong> — <code>series:name</code> still filters by series title.<br><strong>Wider search (API)</strong> — Use query param <code>q_scope=primary</code> (adds tags, series names, alias tokens) or <code>q_scope=full</code> (adds ability/skill/weapon text too).<br><strong>Tip</strong> — <code>series:msg</code> matches only the original <em>Mobile Suit Gundam</em> (1979).</div>',search_recall:'Quick search',whats_new_title:"What's new",whats_new_btn:"What's new",whats_new_empty:'No data update notes yet. Changes since the last baseline appear automatically after a master import; run python scripts/refresh_whats_new_snapshot.py when you publish to reset the baseline. Optional notes go in data/whats_new.json.',whats_new_date:'Date:',whats_new_changes:'Changes:',whats_new_added:'Added:',whats_new_close:'Close',whats_new_kind_unit_abilities:'Unit abilities',whats_new_kind_unit_weapons:'Weapons',whats_new_kind_char_abilities:'Character abilities',whats_new_slot:'Slot',whats_new_before:'Before',whats_new_after:'After',whats_new_tab_pending:'Since last baseline',whats_new_tab_manual:'Notes',whats_new_tab_empty:'No changes in this section.',whats_new_select_period:'Period:',whats_new_manual_note:'Note',whats_new_label_new_unit:'New unit:',whats_new_label_new_char:'New character:',whats_new_label_new_mod:'New option part:',whats_new_label_new_supporter:'New supporter:',search_spotlight_title:'Search',search_spotlight_close:'Close',search_spotlight_foot:'Esc · tap outside · ✕ to close',search_spotlight_empty:'No quick matches',per_page:'/page',view_grid:'Grid view',view_table:'Table view',count_char:'characters',count_unit:'units',count_supporter:'supporters',count_stage:'stages',tab_mod:'Modifications',tab_latest:'Latest Release',tab_game_news:'Game News',latest_gasha_title:'Latest Information:',lr_type_unit:'Unit',lr_type_char:'Character',lr_type_supp:'Supporter',lr_empty:'No scheduled gacha releases found.',lr_empty_recent:'No releases in the last 3 months (JST).',lr_load_more:'Load all releases',lr_lock_title:'Latest Release',lr_lock_hint:'Enter the password to preview lineup before the start time.',lr_unlock_btn:'Unlock',lr_section_locked:'This release has not started yet. Enter the password to preview the lineup.',lr_pw_wrong:'Incorrect password.',er_stage_lock_hint:'Enter the password to view full stage details (map, NPCs, restrictions).',er_stage_unlock_btn:'Unlock',er_stage_pw_wrong:'Incorrect password.',er_stage_locked_badge:'Locked',er_stage_lock_wait:'This stage unlocks automatically when its release time is reached.',er_stage_redacted_row:'Undisclosed',er_stage_redacted_title:'Undisclosed stage',search_mod:'Name, details, tags — , or ; = ALL terms',count_mod:'modifications',mod_filter_effect:'Effect',mod_filter_effect_hp:'Max HP ↑',mod_filter_effect_en:'Max EN ↑',mod_filter_effect_atk:'ATK ↑',mod_filter_effect_def:'DEF ↑',mod_filter_effect_mob:'Mobility ↑',mod_filter_effect_other:'Other (ACC, EVA, Crit, …)',empty_mod:'No modifications found',col_details:'Details',empty_char:'No characters found',empty_unit:'No units found',empty_supporter:'No supporters found',empty_stage:'No stages found',col_name:'Name',col_rarity:'Rarity',col_role:'Role',col_series_tag:'Series/Tag',col_boost:'Boost',col_ranged:'Ranged',col_melee:'Melee',col_awaken:'Awaken',col_defense:'Defense',col_reaction:'Reaction',char_list_stat_tooltip:'Total with always-on passives (no EX / conditional). Cyan = higher than base growth.',char_list_stat_base_hint:'Base growth: {n}',char_grid_stat_ranged:'RNG',char_grid_stat_melee:'MEL',char_grid_stat_awaken:'AWK',char_grid_stat_defense:'DEF',char_grid_stat_reaction:'REA',col_hp:'HP',col_en:'EN',col_atk:'ATK',col_def:'DEF',col_mob:'MOB',col_mov:'MOV',col_stage_diff:'Difficulty',col_stage_no:'No.',col_stage_cp:'Recommended CP',col_stage_terrain:'Terrain',sec_stats:'Stats',sec_terrain:'Terrain',sec_abilities:'Abilities',sec_skills:'Skills',sec_leader_skill:'Leader Skill',sec_active_skills:'Support Skills',sec_weapons:'Weapons',sec_weapon_list:'Weapon List',sec_mechanism:'Mechanisms',sec_sortie_restrictions:'Sortie Restrictions',sec_stage_map:'Stage Map',sec_npc_details:'NPC Details',stage_npc_friendly_tab:'Friendly NPCs',stage_npc_enemy_tab:'Enemy units',wp_weapon:'Weapon',wp_type:'Type',wp_range:'Range',wp_power:'Power',wp_en:'EN',wp_acc:'Acc',wp_crit:'Crit',wp_ammo:'Ammo',stat_ranged:'Ranged',stat_melee:'Melee',stat_awaken:'Awaken',stat_defense:'Defense',stat_reaction:'Reaction',stat_hp:'HP',stat_en:'EN',stat_attack:'Attack',stat_mobility:'Mobility',stat_move:'Move',terrain_space:'Space',terrain_atmo:'Atmospheric',terrain_ground:'Ground',terrain_sea:'Sea',terrain_underwater:'Underwater',unit_filter_weapon_debuff:'All Weapon Effects',unit_filter_weapon_debuff_all:'All Weapon Effects',unit_filter_weapon_debuff_multi:'{n} weapon effects',unit_filter_mechanism:'Mechanism',unit_filter_mechanism_all:'All Mechanisms',unit_filter_mechanism_multi:'{n} mechanisms',unit_filter_mechanism_tt:'Multiple mechanisms: match all (AND). 2×2 matches units with OccupiedAreaId 2 in master data (large footprint), same as unit detail.',unit_filter_wb_atk_dn:'Inflict Attack Down',unit_filter_wb_def_dn:'Inflict Defense Down',unit_filter_wb_enemy_def_atk:'Reduce enemy DEF (this attack)',unit_filter_wb_mob_dn:'Inflict Mobility Down',unit_filter_wb_acc_dn:'Inflict Accuracy Down',unit_filter_wb_eva_dn:'Inflict Evasion Down',unit_filter_wb_dmg_phys:'Inflict Physical Damage Up',unit_filter_wb_dmg_beam:'Inflict Beam Damage Up',unit_filter_wb_dmg_spec:'Inflict Special Damage Up',unit_filter_wb_wp_phys:'Inflict Physical Weapon Power Down',unit_filter_wb_wp_beam:'Inflict Beam Weapon Power Down',unit_filter_wb_wp_spec:'Inflict Special Weapon Power Down',unit_filter_wb_range_beam:'Inflict Beam Weapon Range Down',unit_filter_wb_range_phys:'Inflict Physical Weapon Range Down',unit_filter_wb_range_all:'Inflict All Weapon Range Down',unit_filter_wb_range_6:'Max range ≥ 6',unit_filter_wb_mp_1:'Inflict MP −1',unit_filter_wb_mp_2:'Inflict MP −2',unit_filter_wb_mp_3:'Inflict MP −3',unit_filter_wb_preemptive:'Preemptive Strike',unit_filter_wb_map_weapon:'MAP weapon',role_attack:'Attack',role_defense:'Defense',role_support:'Support',role_all:'All Roles',rarity_all:'All Rarities',rarity_none_selected:'None selected',role_filter_attack:'Attack Only',role_filter_defense:'Defense Only',role_filter_support:'Support Only',conditional_passive:'Conditional Passive',conditional_passive_abbr:'CP',char_data:'Character Data',unit_data:'Unit Data',unit_transform_title:'Open alternate form',rec_char_shortcut:'Character',rec_unit_shortcut:'Unit',limited_label:'Limited',rarity_exclude_limited:'Exclude limited',supp_data:'Supporter Data',stage_data:'Stage Data',view_effect_range:'View Effect Range',map_legend_use:'Point of Use',map_legend_sel:'Point of Selection',map_legend_range:'Range',map_legend_effect:'Effect Range',map_effect_theme_dark:'Dark / contrast map: outlines + inverted empty tiles',map_effect_theme_light:'Light map — original tiles (default)',view_stage_map:'View Stage Map',hide_stage_map:'Hide Stage Map',supply_type:'Supply Type:',hp_support:'HP Support',atk_support:'Attack Support',tag_or:' or ',tag_results_unit:'Units with Tag:',tag_results_char:'Characters with Tag:',tag_tab_affinity:'Affinity',tag_results_affinity:'Affinity with Tag:',series_results_unit:'Units in series:',series_results_char:'Characters in series:',char_with_skill:'Character with skill:',char_with_ability:'Character with ability:',unit_with_ability:'Unit with ability:',sortie_group:'Sortie Group',applies_to:'Applies To',recommended_cp:'Recommended CP',terrain:'Terrain',victory_conditions:'Victory Conditions',defeat_conditions:'Defeat Conditions',none:'None',npc_unit:'NPC Unit',npc_character:'NPC Character',npc_unit_abilities:'Unit Abilities',npc_unit_weapons:'Unit Weapons',npc_character_abilities:'Character Abilities',npc_character_skills:'Character Skills',difficulty_normal:'Normal',difficulty_hard:'Hard',difficulty_expert:'Expert',filter_diff_all:'All Difficulties',filter_diff_normal:'Normal',filter_diff_hard:'Hard',filter_diff_expert:'Expert',filter_source:'Source',filter_source_all:'All',browse_filters_clear:'Clear',browse_filter_esc:'ESC',browse_filter_combine_btn:'And / Or',browse_filter_combine_tt_and:'AND — selected tags must all match. Click to use OR.',browse_filter_combine_tt_or:'OR — any selected tag matches. Click to use AND.',browse_filter_combine_aria_and:'Combine mode is AND — all selections must match. Activate to switch to OR.',browse_filter_combine_aria_or:'Combine mode is OR — matching any selection is enough. Activate to switch to AND.',browse_filter_combine_and:'AND',browse_filter_combine_or:'OR',browse_filter_combine_toggle_title:'Toggles combine mode — AND vs OR.',filter_source_assembly:'Units from Unit Assembly',filter_source_development:'Development Unit',filter_source_other:'Other',filter_source_assembly_char:'Unit Assembly Characters',filter_source_development_char:'Scout/Story Character',list_filter_lineage:'Tags / Lineage',list_filter_lineage_multi:'{n} tags',list_filter_series:'Series',list_filter_series_multi:'{n} series',list_filter_skill:'Skills',list_filter_ability:'Abilities',list_filter_all_skills:'All Skills',list_filter_all_abilities:'All Abilities',list_filter_ability_char:'Ability',list_filter_all_abilities_char:'All Abilities',list_filter_search_placeholder:'Search filter…',series_filter_all_brand:'Mobile Suit Gundam',ally:'Ally',enemy:'Enemy',cmp_compare:'Compare',cmp_unit_compare:'Unit Comparison',cmp_char_compare:'Character Comparison',cmp_stats:'Stats Comparison',cmp_radar:'Radar Chart',cmp_terrain:'Terrain',cmp_weapons:'Weapons',cmp_reset:'Reset Comparison',cmp_remove:'Remove',cmp_add_unit:'+ Add Unit',cmp_add_char:'+ Add Character',cmp_search_unit:'Search units...',cmp_search_char:'Search characters...',cmp_type_to_search:'Type to search...',cmp_clear:'Clear',cmp_selected:'selected',cmp_abilities:'Abilities',cmp_skills:'Skills',cmp_lb:'Limit Break',dc_title:'Damage Simulator',dc_atk_label:'YOUR UNIT (Attacker)',dc_def_label:'NPC TARGET (Defender)',dc_atk_params_section:'Attacker Parameters',dc_def_params_section:'Defender Parameters',dc_panel_attacker_heading:'ATTACKER',dc_panel_defender_heading:'DEFENDER (Target)',dc_pick_unit:'Select Unit',dc_defender_status:'Defender status',dc_def_stats_map_note:'Totals include map bonuses (same as stage detail). Green (+n) is the bonus portion.',dc_def_char_stats_note:'Totals include passive ability bonuses (same as stage detail). Green (+n) is the bonus portion.',dc_pick_char:'Select Character',dc_change:'Change',dc_select_npc:'-- Select NPC --',dc_distance:'Distance',dc_range_check:'Range Check',dc_terrain:'Terrain %',dc_mp_level:'MP Level',dc_vigor_prefix:'Vigor',dc_vigor_medium:'Normal',dc_vigor_high:'High',dc_vigor_max:'Max',dc_vigor_super:'Supercharged',dc_vigor_dmg_bonus_sub:'+{pct}% from {label} vigor (included in line above and in damage)',dc_defend:'Defend Action',dc_shield:'Shield',dc_on:'On',dc_off:'Off',dc_normal_dmg:'Normal Damage',dc_crit_dmg:'Critical Damage',dc_super_crit_dmg:'Super Critical Damage',dc_hp_remaining_super_crit:'HP Remaining (Super Crit)',dc_final_dmg:'Final Damage',dc_crit_final_dmg:'Critical Final Damage',dc_hp_remaining:'HP Remaining',dc_hit_rate:'Hit Rate',dc_hp_remaining_normal:'HP Remaining (Normal)',dc_hp_remaining_crit:'HP Remaining (Crit)',dc_in_range:'In Range',dc_out_range:'Out of Range',dc_select_both:'Select attacker and defender to calculate damage',dc_unit_stats:'Unit Stats',dc_char_stats:'Character Stats',dc_weapon:'Weapon',dc_wpn_level:'Weapon Lv',dc_lb_tier:'LB Tier',dc_power:'PWR',dc_range:'Range',dc_accuracy:'ACC',dc_critical:'CRIT',dc_en_cost:'EN',supp_level:'Level',supp_lb_tier:'LB Tier',supp_formula:'Formula',tab_team_builder:'Team Builder',tb_front:'Front',tb_rear:'Rear',tb_squad1:'Squad 1',tb_squad2:'Squad 2',tb_formation:'Formation',tb_rearrange:'Rearrange',tb_batch:'Batch Form',tb_stats_hint:'Modified MS stats use Normal vigor baseline (fixed). No defender or vigor UI. Option parts, supporter, Master League, and pilot pair bonus apply.',tb_pick_supp:'Tap to select supporter',tb_empty_stats:'Select a unit slot.',tb_squad_fill:'{n} / 10 units',tb_saved_formations:'Saved formations',tb_save:'Save',tb_load:'Load',tb_rearrange_banner:'Tap two slots to swap',tb_linked_move:'Move unit and pilot together',tb_cancel:'Cancel',tb_confirm:'Confirm',tb_batch_title:'Batch Form',tb_apply:'Apply',tb_master_league:'Master League Buff',tb_op_count:'OP ×{n}'},
TW:{tab_char:'角色',tab_ranking:'排行',tab_unit:'機體',tab_supporter:'支援人員',tab_stage:'關卡',stage_source_group_aria:'關卡類別',stage_source_eternal:'永恆之路',stage_source_score:'Map Event Score Attack Stages',stage_source_special:'Special Stages',dc_def_preset_mode:'預設（永恆之路、Score Attack）',dc_def_preset_target_label:'預設目標（永恆之路、Score Attack）',dc_stage_search_ph:'搜尋永恆之路與 Score Attack 關卡…',dc_stage_list_aria:'永恆之路與 Score Attack 關卡',dc_score_attack_preset:'Score #{n}',search_char:'搜尋：名稱或 ID',search_unit:'搜尋：名稱或 ID',search_supporter:'搜尋：名稱／系列／標籤',search_stage:'用關卡ID或名稱搜尋...',search_series_click:'檢視此系列的角色與機體',search_hint_html:'<div class="search-hint-inner"><strong>角色／機體（預設）</strong> — 關鍵字僅比對<strong>顯示名稱</strong>與<strong>ID</strong>（不含系列、標籤、能力）。支援人員仍可用名稱／系列／標籤。<br><strong>全部符合</strong> — 以逗號或分號分隔，每一段都要符合。<br><strong>排除</strong> — 在關鍵字前加 <code>-</code> 可隱藏仍含該字的結果。<br><strong>系列</strong> — <code>series:關鍵字</code> 仍可依作品系列篩選。<br><strong>擴大搜尋（API）</strong> — <code>q_scope=primary</code> 可納入標籤、系列名、別名；<code>q_scope=full</code> 另含能力／技能／武裝文字。<br><strong>提示</strong> — <code>series:msg</code> 只對應初代《機動戰士鋼彈》。</div>',search_recall:'快速搜尋',whats_new_title:'更新資訊',whats_new_btn:'更新資訊',whats_new_empty:'尚無更新說明。匯入新主資料後會自動與基準檔比對；發布後可執行 python scripts/refresh_whats_new_snapshot.py 重設基準。可選內容放在 data/whats_new.json。',whats_new_date:'日期：',whats_new_changes:'變更：',whats_new_added:'新增：',whats_new_close:'關閉',whats_new_kind_unit_abilities:'機體能力',whats_new_kind_unit_weapons:'武裝',whats_new_kind_char_abilities:'角色能力',whats_new_slot:'欄位',whats_new_before:'變更前',whats_new_after:'變更後',whats_new_tab_pending:'自上次基準',whats_new_tab_manual:'備註',whats_new_tab_empty:'此區段無變更。',whats_new_select_period:'期間：',whats_new_manual_note:'備註',whats_new_label_new_unit:'新機體：',whats_new_label_new_char:'新角色：',whats_new_label_new_mod:'新改造零件：',whats_new_label_new_supporter:'新支援人員：',search_spotlight_title:'搜尋',search_spotlight_close:'關閉',search_spotlight_foot:'Esc · 點背景或 ✕ 關閉',search_spotlight_empty:'沒有符合的項目',per_page:'/頁',view_grid:'格狀檢視',view_table:'表格檢視',count_char:'位角色',count_unit:'台機體',count_supporter:'名支援人員',count_stage:'個關卡',tab_mod:'改造零件',tab_latest:'最新登場',tab_game_news:'遊戲公告',latest_gasha_title:'最新資訊：',lr_type_unit:'機體',lr_type_char:'角色',lr_type_supp:'支援人員',lr_empty:'沒有轉蛋排程資料。',lr_empty_recent:'最近三個月（日本時間）內沒有轉蛋排程。',lr_load_more:'載入全部轉蛋',lr_lock_title:'最新登場',lr_lock_hint:'請輸入密碼以在開始前預覽此轉蛋陣容。',lr_unlock_btn:'解鎖',lr_section_locked:'此轉蛋尚未開始。請輸入密碼以預覽角色／機體列表。',lr_pw_wrong:'密碼錯誤。',er_stage_lock_hint:'請輸入密碼以檢視完整關卡內容（地圖、NPC、出擊限制等）。',er_stage_unlock_btn:'解鎖',er_stage_pw_wrong:'密碼錯誤。',er_stage_locked_badge:'鎖定',er_stage_lock_wait:'此關卡將在正式開放時間到達後自動解鎖。',er_stage_redacted_row:'未公開',er_stage_redacted_title:'未公開關卡',search_mod:'搜尋：名稱/效果/標籤（逗號或；＝需全部符合）',count_mod:'改造零件',mod_filter_effect:'效果類型',mod_filter_effect_hp:'Max HP ↑',mod_filter_effect_en:'Max EN ↑',mod_filter_effect_atk:'攻擊 ↑',mod_filter_effect_def:'防禦 ↑',mod_filter_effect_mob:'機動 ↑',mod_filter_effect_other:'其他（命中／迴避等）',empty_mod:'未找到改造零件',col_details:'效果',empty_char:'未找到角色',empty_unit:'未找到機體',empty_supporter:'未找到支援人員',empty_stage:'未找到關卡',col_name:'名稱',col_rarity:'稀有度',col_role:'類型',col_series_tag:'系列/標籤',col_boost:'加成',col_ranged:'射擊',col_melee:'格鬥',col_awaken:'覺醒',col_defense:'守備值',col_reaction:'反應',char_list_stat_tooltip:'含常駐被動加成（不含EX／條件式）。亮色表示高於成長值。',char_list_stat_base_hint:'成長值: {n}',col_hp:'HP',col_en:'EN',col_atk:'攻擊力',col_def:'守備力',col_mob:'機動力',col_mov:'移動力',col_stage_diff:'難度',col_stage_no:'編號',col_stage_cp:'推薦戰力',col_stage_terrain:'地形',sec_stats:'能力值',sec_terrain:'地形適性',sec_abilities:'能力',sec_skills:'技能',sec_leader_skill:'隊長技能',sec_active_skills:'支援人員技能',sec_weapons:'武裝',sec_weapon_list:'武裝列表',sec_mechanism:'機制',sec_sortie_restrictions:'出擊限制',sec_stage_map:'關卡地圖',sec_npc_details:'NPC資料',stage_npc_friendly_tab:'友方 NPC',stage_npc_enemy_tab:'敵方單位',wp_weapon:'武裝',wp_type:'類型',wp_range:'射程',wp_power:'威力',wp_en:'EN',wp_acc:'命中',wp_crit:'暴擊',wp_ammo:'彈數',stat_ranged:'射擊',stat_melee:'格鬥',stat_awaken:'覺醒',stat_defense:'守備值',stat_reaction:'反應',stat_hp:'HP',stat_en:'EN',stat_attack:'攻擊值',stat_mobility:'機動值',stat_move:'移動值',terrain_space:'宇宙',terrain_atmo:'空中',terrain_ground:'地上',terrain_sea:'水上',terrain_underwater:'水中',unit_filter_weapon_debuff:'全部武裝效果',unit_filter_weapon_debuff_all:'全部武裝效果',unit_filter_weapon_debuff_multi:'{n} 項武裝效果',unit_filter_mechanism:'機制',unit_filter_mechanism_all:'全部機制',unit_filter_mechanism_multi:'{n} 項機制',unit_filter_mechanism_tt:'多選機制：須同時符合（AND）。2×2 對應主資料 OccupiedAreaId=2（大型佔格），與機體詳情相同。',unit_filter_wb_atk_dn:'攻擊力減少',unit_filter_wb_def_dn:'防禦力減少',unit_filter_wb_mob_dn:'機動力減少',unit_filter_wb_acc_dn:'命中率減少',unit_filter_wb_eva_dn:'閃避率減少',unit_filter_wb_dmg_phys:'物理損傷提升',unit_filter_wb_dmg_beam:'光束損傷提升',unit_filter_wb_dmg_spec:'特殊損傷提升',unit_filter_wb_wp_phys:'物理武裝威力減少',unit_filter_wb_wp_beam:'光束武裝威力減少',unit_filter_wb_wp_spec:'特殊武裝威力減少',unit_filter_wb_range_beam:'光束武裝鐳射程減少',unit_filter_wb_range_phys:'物理武裝射程減少',unit_filter_wb_range_all:'全武裝射程減少',unit_filter_wb_range_6:'最大射程≥6',unit_filter_wb_mp_1:'MP減少1',unit_filter_wb_mp_2:'MP減少2',unit_filter_wb_mp_3:'MP減少3',unit_filter_wb_preemptive:'先發攻擊',unit_filter_wb_map_weapon:'MAP武裝',role_attack:'攻擊型',role_defense:'耐久型',role_support:'支援型',role_all:'全部類型',rarity_all:'全部稀有度',rarity_none_selected:'未選擇',role_filter_attack:'僅攻擊型',role_filter_defense:'僅耐久型',role_filter_support:'僅支援型',conditional_passive:'條件式被動',conditional_passive_abbr:'CP',char_data:'角色資料',unit_data:'機體資料',unit_transform_title:'切換形態',rec_char_shortcut:'角色',rec_unit_shortcut:'機體',limited_label:'限定',rarity_exclude_limited:'不含限定',supp_data:'支援人員資料',stage_data:'關卡資料',view_effect_range:'視圖效果範圍',map_legend_use:'使用位置',map_legend_sel:'選擇位置',map_legend_range:'射程',map_legend_effect:'效果範圍',map_effect_theme_dark:'深色／高對比：框線＋空格圖塊反相',map_effect_theme_light:'淺色地圖：原始圖塊（預設）',view_stage_map:'查看地圖',hide_stage_map:'隱藏地圖',supply_type:'補給類型:',hp_support:'HP輔助',atk_support:'攻擊輔助',tag_or:' 或 ',tag_results_unit:'含標籤的機體：',tag_results_char:'含標籤的角色：',tag_tab_affinity:'契合度',tag_results_affinity:'契合度（標籤）：',series_results_unit:'此系列的機體：',series_results_char:'此系列的角色：',char_with_skill:'擁有此技能的角色：',char_with_ability:'擁有此能力的角色：',unit_with_ability:'擁有此能力的機體：',sortie_group:'出擊群組',applies_to:'適用對象',recommended_cp:'推薦戰力',terrain:'地形',victory_conditions:'勝利條件',defeat_conditions:'敗北條件',none:'無',npc_unit:'NPC機體',npc_character:'NPC角色',npc_unit_abilities:'機體能力',npc_unit_weapons:'機體武裝',npc_character_abilities:'角色能力',npc_character_skills:'角色技能',difficulty_normal:'普通',difficulty_hard:'困難',difficulty_expert:'專家',filter_diff_all:'全部難度',filter_diff_normal:'普通',filter_diff_hard:'困難',filter_diff_expert:'專家',filter_source:'取得來源',filter_source_all:'全部',browse_filters_clear:'重置',browse_filter_esc:'ESC',browse_filter_combine_btn:'And / Or',browse_filter_combine_tt_and:'且 — 需全部標籤符合。按一下改為「或」。',browse_filter_combine_tt_or:'或 — 符合任一標籤即可。按一下改為「且」。',browse_filter_combine_aria_and:'組合為「且」（全部符合）。啟用以切換為「或」。',browse_filter_combine_aria_or:'組合為「或」（任一符合）。啟用以切換為「且」。',browse_filter_combine_and:'且',browse_filter_combine_or:'或',browse_filter_combine_toggle_title:'切換組合模式：「且」／「或」。',filter_source_assembly:'機體補給獲得單位',filter_source_development:'開發機體',filter_source_other:'其他',filter_source_assembly_char:'機體補給獲得角色',filter_source_development_char:'招募／劇情角色',list_filter_lineage:'標籤／系譜',list_filter_lineage_multi:'{n} 個標籤',list_filter_series:'作品系列',list_filter_series_multi:'{n} 個系列',list_filter_skill:'技能',list_filter_ability:'能力',list_filter_all_skills:'全部技能',list_filter_all_abilities:'全部能力',list_filter_ability_char:'能力',list_filter_all_abilities_char:'全部能力',list_filter_search_placeholder:'搜尋…',series_filter_all_brand:'機動戰士鋼彈',ally:'我方',enemy:'敵方',cmp_compare:'比較',cmp_unit_compare:'機體比較',cmp_char_compare:'角色比較',cmp_stats:'能力值比較',cmp_radar:'雷達圖',cmp_terrain:'地形適性',cmp_weapons:'武裝比較',cmp_reset:'重置比較',cmp_remove:'移除',cmp_add_unit:'+ 新增機體',cmp_add_char:'+ 新增角色',cmp_search_unit:'搜尋機體...',cmp_search_char:'搜尋角色...',cmp_type_to_search:'輸入以搜尋...',cmp_clear:'清除',cmp_selected:'已選擇',cmp_abilities:'能力',cmp_skills:'技能',cmp_lb:'極限突破',dc_title:'傷害模擬器',dc_atk_label:'我方機體（攻擊方）',dc_def_label:'NPC目標（防禦方）',dc_atk_params_section:'攻擊方參數',dc_def_params_section:'防禦方參數',dc_panel_attacker_heading:'攻擊方',dc_panel_defender_heading:'防禦方（目標）',dc_pick_unit:'選擇機體',dc_defender_status:'防禦方狀態',dc_def_stats_map_note:'數值含地圖／隊伍加成（與關卡詳情相同）。綠色 (+n) 為加成量。',dc_def_char_stats_note:'數值含被動能力加成（與關卡詳情相同）。綠色 (+n) 為加成量。',dc_pick_char:'選擇角色',dc_change:'更換',dc_select_npc:'-- 選擇NPC --',dc_distance:'距離',dc_range_check:'射程確認',dc_terrain:'地形 %',dc_mp_level:'MP等級',dc_vigor_prefix:'戰意',dc_vigor_medium:'一般',dc_vigor_high:'強勢',dc_vigor_max:'超強勢',dc_vigor_super:'超一擊',dc_vigor_dmg_bonus_sub:'+{pct}% 來自「{label}」戰意（已併入上方與傷害）',dc_defend:'防禦動作',dc_shield:'盾牌',dc_on:'開',dc_off:'關',dc_normal_dmg:'普通傷害',dc_crit_dmg:'暴擊傷害',dc_super_crit_dmg:'超級暴擊傷害',dc_hp_remaining_super_crit:'剩餘 HP（超暴擊）',dc_final_dmg:'最終傷害',dc_crit_final_dmg:'暴擊最終傷害',dc_hp_remaining:'剩餘HP',dc_hit_rate:'命中率',dc_hp_remaining_normal:'剩餘 HP（一般）',dc_hp_remaining_crit:'剩餘 HP（暴擊）',dc_in_range:'射程內',dc_out_range:'射程外',dc_select_both:'請選擇攻擊方和防禦方以計算傷害',dc_unit_stats:'機體能力值',dc_char_stats:'角色能力值',dc_weapon:'武器',dc_wpn_level:'武器等級',dc_lb_tier:'LB階級',dc_power:'威力',dc_range:'射程',dc_accuracy:'命中',dc_critical:'暴擊',dc_en_cost:'EN',supp_level:'等級',supp_lb_tier:'LB階級',supp_formula:'公式',tab_team_builder:'隊伍編成',tb_front:'前衛',tb_rear:'後衛',tb_squad1:'小隊 1',tb_squad2:'小隊 2',tb_formation:'編隊',tb_rearrange:'調整站位',tb_batch:'批次編成',tb_stats_hint:'機體能力為固定「普通」鬥氣基準，不含防禦方與鬥氣介面。改造零件、支援、大師聯盟加成與駕駛員搭檔加成仍會套用。',tb_pick_supp:'點選以選擇支援',tb_empty_stats:'請選擇有機體的欄位。',tb_squad_fill:'{n} / 10 機',tb_saved_formations:'已存編隊',tb_save:'儲存',tb_load:'讀取',tb_rearrange_banner:'點兩個欄位交換',tb_linked_move:'機體與駕駛員一起移動',tb_cancel:'取消',tb_confirm:'確定',tb_batch_title:'批次編成',tb_apply:'套用',tb_master_league:'大師聯盟加成',tb_op_count:'OP ×{n}'}};T.HK=Object.assign({},T.TW,{search_char:'搜尋：名稱或 ID',search_unit:'搜尋：名稱或 ID',search_series_click:'查看此系列的角色與機體',search_stage:'以關卡 ID 或名稱搜尋...',search_hint_html:'<div class="search-hint-inner"><strong>角色／機體（預設）</strong> — 關鍵字僅比對<strong>顯示名稱</strong>與<strong>ID</strong>。支援人員仍可用名稱／系列／標籤。<br><strong>全部符合</strong> — 以逗號或分號分隔，每一段都要符合。<br><strong>排除</strong> — 關鍵字前加 <code>-</code> 可隱藏仍含該字的結果。<br><strong>系列</strong> — <code>series:關鍵字</code> 仍可依系列篩選。<br><strong>提示</strong> — <code>series:msg</code> 只對應初代《機動戰士高達》。</div>',series_filter_all_brand:'機動戰士高達',latest_gasha_title:'最新資訊：',lr_empty:'沒有扭蛋排程資料。',lr_empty_recent:'最近三個月（日本時間）內沒有扭蛋排程。',lr_load_more:'載入全部扭蛋',lr_lock_hint:'請輸入密碼以在開始前預覽此扭蛋陣容。',lr_section_locked:'此扭蛋尚未開始。請輸入密碼以預覽角色／機體列表。'});
Object.assign(T.EN,{tab_banner_timeline:'Unit Assembly',bt_view_table:'Table',bt_view_timeline:'Timeline',bt_scroll_top:'Back to top',bt_col_banner:'Unit Assembly',bt_col_featured:'Featured',bt_col_units:'Featured units',bt_col_chars:'Featured characters',bt_col_supporters:'Featured supporters',bt_col_start:'Start (JST)',bt_col_end:'End (JST)',bt_col_duration:'Duration',bt_empty:'No schedule data.',bt_sort_start_hint:'Click to sort by start date (▼ newest first · ▲ oldest first).',sort_desc:'Sort descending',sort_asc:'Sort ascending'});Object.assign(T.TW,{tab_banner_timeline:'機體補給',bt_view_table:'表格',bt_view_timeline:'時間線',bt_scroll_top:'回頂端',bt_col_banner:'機體補給',bt_col_featured:'精選',bt_col_units:'精選機體',bt_col_chars:'精選角色',bt_col_supporters:'精選支援',bt_col_start:'開始（JST）',bt_col_end:'結束（JST）',bt_col_duration:'期間',bt_empty:'尚無轉蛋資料。',bt_sort_start_hint:'按開始日期排序（▼ 由新至舊 · ▲ 由舊至新）。',sort_desc:'由大到小排序',sort_asc:'由小到大排序'});Object.assign(T.HK,{tab_banner_timeline:'機體補給',bt_view_table:'表格',bt_view_timeline:'時間線',bt_scroll_top:'回頂端',bt_col_banner:'機體補給',bt_col_featured:'精選',bt_col_units:'精選機體',bt_col_chars:'精選角色',bt_col_supporters:'精選支援',bt_col_start:'開始（JST）',bt_col_end:'結束（JST）',bt_col_duration:'期間',bt_empty:'尚無扭蛋資料。',bt_sort_start_hint:'按開始日期排序（▼ 由新至舊 · ▲ 由舊至新）。',sort_desc:'由大到小排序',sort_asc:'由小到大排序'});const STAT_NAME_MAP={EN:{},TW:{'Ranged':'射擊','Melee':'格鬥','Awaken':'覺醒','Defense':'守備力','Reaction':'反應','HP':'HP','EN':'EN','Attack':'攻擊力','ATK':'攻擊力','DEF':'守備力','MOB':'機動力','Mobility':'機動力','Move':'移動力'}};
STAT_NAME_MAP.HK=Object.assign({},STAT_NAME_MAP.TW);
const STAT_NAME_MAP_CHAR={TW:{Ranged:'射擊值',Melee:'格鬥值',Awaken:'覺醒值',Reaction:'反應值',Attack:'攻擊值',Defense:'守備值',Mobility:'機動值',Move:'移動值'}};
STAT_NAME_MAP_CHAR.HK=Object.assign({},STAT_NAME_MAP_CHAR.TW);
STAT_NAME_MAP_CHAR.JA={Ranged:'射撃値',Melee:'格闘値',Awaken:'覚醒値',Reaction:'反応値',Attack:'攻撃値',Defense:'守備値',Mobility:'機動値',Move:'移動値'};
STAT_NAME_MAP_CHAR.JP=Object.assign({},STAT_NAME_MAP_CHAR.JA);
const TERRAIN_NAME_MAP={EN:{},TW:{'Space':'宇宙','Atmospheric':'空中','Ground':'地上','Sea':'水上','Underwater':'水中'}};
TERRAIN_NAME_MAP.HK=Object.assign({},TERRAIN_NAME_MAP.TW);
const ROLE_NAME_MAP={EN:{'Attack':'Attack','Defense':'Defense','Support':'Support'},TW:{'Attack':'攻擊型','Defense':'耐久型','Support':'支援型'}};
ROLE_NAME_MAP.HK=Object.assign({},ROLE_NAME_MAP.TW);
const ROLE_LABELS={EN:{'':'All Roles','1':'Attack Only','2':'Defense Only','3':'Support Only'},TW:{'':'全部類型','1':'僅攻擊型','2':'僅耐久型','3':'僅支援型'}};
ROLE_LABELS.HK=Object.assign({},ROLE_LABELS.TW);
const JP_CORE_LABELS={tab_char:'キャラクター',tab_ranking:'ランキング',tab_unit:'ユニット',tag_tab_affinity:'アフィニティ',tag_results_affinity:'アフィニティ（タグ）:',tab_supporter:'サポーター',tab_stage:'ステージ',stage_source_group_aria:'ステージの種類',stage_source_eternal:'エターナルロード',stage_source_score:'マップイベントスコアアタックステージ',stage_source_special:'スペシャルステージ',dc_def_preset_mode:'プリセット（ER・スコアアタック）',dc_def_preset_target_label:'プリセット対象（ER・スコアアタック）',dc_stage_search_ph:'ER／スコアアタックのステージを検索…',dc_stage_list_aria:'ERとスコアアタックのステージ',dc_score_attack_preset:'スコア #{n}',tab_mod:'改造パーツ',tab_latest:'最新登場',tab_game_news:'ゲームニュース',search_char:'名前またはIDで検索',search_unit:'名前またはIDで検索',search_supporter:'名前 / シリーズ / タグで検索',search_stage:'ステージIDまたは名前で検索…',search_mod:'検索: 名前 / 効果 / タグ',search_series_click:'このシリーズのキャラクターとユニットを見る',search_recall:'クイック検索',search_hint_html:'<div class="search-hint-inner"><strong>キャラ／ユニット（既定）</strong> — キーワードは<strong>表示名</strong>と<strong>ID</strong>のみにマッチ（シリーズ・タグ・アビリティの文言は含みません）。サポーターは従来どおり名前／シリーズ／タグ。<br><strong>すべて一致</strong> — カンマまたはセミコロン区切りで各語句が一致。<br><strong>除外</strong> — 語句の前に <code>-</code> でその語を含む行を除外。<br><strong>シリーズ</strong> — <code>series:キーワード</code> はシリーズ名での絞り込みとして有効。<br><strong>拡張（API）</strong> — <code>q_scope=primary</code> でタグ・シリーズ名・別名、<code>q_scope=full</code> でアビリティ／スキル／武装テキストも対象。<br><strong>ヒント</strong> — <code>series:msg</code> は初代『機動戦士ガンダム』のみ。</div>',whats_new_title:'最新情報',whats_new_btn:'最新情報',whats_new_empty:'更新内容はまだありません。',whats_new_date:'日付:',whats_new_changes:'変更:',whats_new_added:'追加:',whats_new_close:'閉じる',search_spotlight_title:'検索',search_spotlight_close:'閉じる',search_spotlight_empty:'一致する項目がありません',per_page:'/ページ',view_grid:'グリッド表示',view_table:'テーブル表示',count_char:'人',count_unit:'機',count_supporter:'人',count_stage:'ステージ',count_mod:'件',lr_type_unit:'ユニット',lr_type_char:'キャラクター',lr_type_supp:'サポーター',lr_empty:'ガシャ予定はありません。',lr_empty_recent:'直近3か月の登場予定はありません。',lr_load_more:'すべて表示',lr_lock_title:'最新登場',lr_lock_hint:'開始前プレビューにはパスワードを入力してください。',lr_unlock_btn:'解除',lr_section_locked:'このガシャはまだ開始前です。パスワードを入力してラインナップを表示します。',lr_pw_wrong:'パスワードが違います。',er_stage_lock_hint:'パスワードを入力するとステージの詳細（マップ・NPC・出撃制限など）を表示します。',er_stage_unlock_btn:'解除',er_stage_pw_wrong:'パスワードが違います。',er_stage_locked_badge:'ロック',er_stage_lock_wait:'開催開始時刻になると自動で解放されます。',er_stage_redacted_row:'非公開',er_stage_redacted_title:'非公開ステージ',mod_filter_effect:'効果',mod_filter_effect_atk:'攻撃 ↑',mod_filter_effect_def:'防御 ↑',mod_filter_effect_mob:'機動 ↑',mod_filter_effect_other:'その他 (命中 / 回避 / 会心 ...)',empty_mod:'改造パーツが見つかりません',empty_char:'キャラクターが見つかりません',empty_unit:'ユニットが見つかりません',empty_supporter:'サポーターが見つかりません',empty_stage:'ステージが見つかりません',col_name:'名前',col_rarity:'レアリティ',col_role:'タイプ',col_series_tag:'シリーズ / タグ',col_boost:'補正',col_ranged:'射撃値',col_melee:'格闘値',col_awaken:'覚醒値',col_defense:'守備値',col_reaction:'反応値',col_atk:'攻撃力',col_def:'防御力',col_mob:'機動力',col_mov:'移動力',col_stage_diff:'難易度',col_stage_no:'No.',col_stage_cp:'推奨戦力',col_stage_terrain:'地形',col_details:'詳細',sec_stats:'ステータス',sec_terrain:'地形適性',sec_abilities:'アビリティ',sec_skills:'スキル',sec_leader_skill:'リーダースキル',sec_active_skills:'サポートスキル',sec_weapons:'武装',sec_weapon_list:'武装一覧',sec_mechanism:'ギミック',sec_sortie_restrictions:'出撃制限',sec_stage_map:'ステージマップ',sec_npc_details:'NPC情報',stage_npc_friendly_tab:'味方NPC',stage_npc_enemy_tab:'敵ユニット',wp_weapon:'武装',wp_type:'タイプ',wp_range:'射程',wp_power:'威力',wp_acc:'命中',wp_crit:'会心',wp_ammo:'弾数',role_attack:'攻撃型',role_defense:'耐久型',role_support:'支援型',role_all:'全タイプ',rarity_all:'全レアリティ',rarity_none_selected:'未選択',role_filter_attack:'攻撃型のみ',role_filter_defense:'耐久型のみ',role_filter_support:'支援型のみ',conditional_passive:'条件付きパッシブ',conditional_passive_abbr:'CP',char_data:'キャラクターデータ',unit_data:'ユニットデータ',unit_transform_title:'形態を切り替え',rec_char_shortcut:'キャラ',rec_unit_shortcut:'ユニット',limited_label:'限定',rarity_exclude_limited:'限定を除く',supp_data:'サポーターデータ',stage_data:'ステージデータ',view_effect_range:'効果範囲を表示',map_legend_use:'使用位置',map_legend_sel:'選択位置',map_legend_range:'射程',map_legend_effect:'効果範囲',map_effect_theme_dark:'ダーク／高コントラスト：枠線＋空マスを反転',map_effect_theme_light:'ライト：元のマップタイル（既定）',view_stage_map:'マップ表示',hide_stage_map:'マップ非表示',supply_type:'補給タイプ:',hp_support:'HP支援',atk_support:'攻撃支援',tag_or:' または ',tag_results_unit:'タグ一致ユニット:',tag_results_char:'タグ一致キャラクター:',series_results_unit:'シリーズ内ユニット:',series_results_char:'シリーズ内キャラクター:',char_with_skill:'このスキルを持つキャラクター:',char_with_ability:'このアビリティを持つキャラクター:',unit_with_ability:'このアビリティを持つユニット:',sortie_group:'出撃グループ',applies_to:'適用対象',recommended_cp:'推奨戦力',terrain:'地形',victory_conditions:'勝利条件',defeat_conditions:'敗北条件',none:'なし',npc_unit:'NPCユニット',npc_character:'NPCキャラクター',npc_unit_abilities:'ユニットアビリティ',npc_unit_weapons:'ユニット武装',npc_character_abilities:'キャラクターアビリティ',npc_character_skills:'キャラクタースキル',difficulty_normal:'通常',difficulty_hard:'ハード',difficulty_expert:'エキスパート',filter_diff_all:'全難易度',filter_diff_normal:'通常',filter_diff_hard:'ハード',filter_diff_expert:'エキスパート',filter_source:'入手元',filter_source_all:'すべて',browse_filters_clear:'クリア',browse_filter_esc:'ESC',browse_filter_combine_btn:'And / Or',browse_filter_combine_tt_and:'AND — すべて一致が必要です。クリックで OR。',browse_filter_combine_tt_or:'OR — いずれかが一致します。クリックで AND。',browse_filter_combine_aria_and:'結合モードは AND（すべて必須）です。変更で OR に切り替えます。',browse_filter_combine_aria_or:'結合モードは OR（いずれか）です。変更で AND に切り替えます。',browse_filter_combine_and:'AND',browse_filter_combine_or:'OR',browse_filter_combine_toggle_title:'AND / OR の結合モードを切り替えます',filter_source_assembly:'ユニット補給',filter_source_development:'開発ユニット',filter_source_other:'その他',filter_source_assembly_char:'ユニット補給キャラ',filter_source_development_char:'スカウト / ストーリー',list_filter_lineage:'タグ / 系譜',list_filter_lineage_multi:'{n}件のタグ',list_filter_series:'シリーズ',list_filter_series_multi:'シリーズ {n}件',list_filter_skill:'スキル',list_filter_ability:'アビリティ',list_filter_all_skills:'すべてのスキル',list_filter_all_abilities:'すべてのアビリティ',list_filter_ability_char:'アビリティ',list_filter_all_abilities_char:'すべてのアビリティ',list_filter_search_placeholder:'フィルター検索…',series_filter_all_brand:'機動戦士ガンダム',ally:'味方',enemy:'敵',cmp_compare:'比較',cmp_unit_compare:'ユニット比較',cmp_char_compare:'キャラクター比較',cmp_stats:'ステータス比較',cmp_radar:'レーダーチャート',cmp_terrain:'地形適性',cmp_weapons:'武装比較',cmp_reset:'比較をリセット',cmp_remove:'削除',cmp_add_unit:'+ ユニット追加',cmp_add_char:'+ キャラ追加',cmp_search_unit:'ユニット検索...',cmp_search_char:'キャラ検索...',cmp_type_to_search:'入力して検索...',cmp_clear:'クリア',cmp_selected:'選択中',cmp_abilities:'アビリティ',cmp_skills:'スキル',cmp_lb:'限界突破',dc_title:'ダメージシミュレーター',dc_atk_label:'自ユニット (攻撃側)',dc_def_label:'NPC目標 (防御側)',dc_atk_params_section:'攻撃側パラメータ',dc_def_params_section:'防御側パラメータ',dc_panel_attacker_heading:'攻撃側',dc_panel_defender_heading:'防御側（ターゲット）',dc_pick_unit:'ユニット選択',dc_defender_status:'防御側ステータス',dc_def_stats_map_note:'数値はマップ／チームボーナス込み（ステージ詳細と同じ）。緑の (+n) が加算分です。',dc_def_char_stats_note:'数値はパッシブ能力のボーナス込み（ステージ詳細と同じ）。緑の (+n) が加算分です。',dc_pick_char:'キャラ選択',dc_change:'変更',dc_select_npc:'-- NPCを選択 --',dc_distance:'距離',dc_range_check:'射程判定',dc_terrain:'地形 %',dc_mp_level:'MPレベル',dc_vigor_prefix:'テンション',dc_vigor_medium:'通常',dc_vigor_high:'強勢',dc_vigor_max:'超強勢',dc_vigor_super:'超一撃',dc_vigor_dmg_bonus_sub:'+{pct}%（{label}・上記およびダメージに含む）',dc_defend:'防御行動',dc_shield:'シールド',dc_on:'ON',dc_off:'OFF',dc_normal_dmg:'通常ダメージ',dc_crit_dmg:'会心ダメージ',dc_super_crit_dmg:'超会心ダメージ',dc_hp_remaining_super_crit:'残りHP（超会心）',dc_final_dmg:'最終ダメージ',dc_crit_final_dmg:'会心時最終ダメージ',dc_hp_remaining:'残りHP',dc_hit_rate:'命中率',dc_hp_remaining_normal:'残りHP（通常）',dc_hp_remaining_crit:'残りHP（会心）',dc_in_range:'射程内',dc_out_range:'射程外',dc_select_both:'攻撃側と防御側を選択してください',dc_unit_stats:'ユニットステータス',dc_char_stats:'キャラステータス',dc_weapon:'武器',dc_wpn_level:'武器Lv',dc_lb_tier:'LB段階',dc_power:'威力',dc_range:'射程',dc_accuracy:'命中',dc_critical:'会心',dc_en_cost:'EN',supp_level:'レベル',supp_lb_tier:'LB段階',supp_formula:'式',tab_team_builder:'チーム編成',tb_front:'前衛',tb_rear:'後衛',tb_squad1:'小隊1',tb_squad2:'小隊2',tb_formation:'編成',tb_rearrange:'配置変更',tb_batch:'一括編成',tb_stats_hint:'MSステータスは「通常」MP基準（固定）。防御側・MP UIなし。改造パーツ・サポーター・マスターリーグ・搭乗ペア補正は反映。',tb_pick_supp:'タップでサポーター選択',tb_empty_stats:'ユニットがいるスロットを選んでください。',tb_squad_fill:'{n} / 10 機',tb_saved_formations:'保存した編成',tb_save:'保存',tb_load:'読込',tb_rearrange_banner:'2つのスロットをタップして入替',tb_linked_move:'機体とパイロットを一緒に移動',tb_cancel:'キャンセル',tb_confirm:'確定',tb_batch_title:'一括編成',tb_apply:'適用',tb_master_league:'マスターリーグ補正',tb_op_count:'OP×{n}'};
T.JA=Object.assign({},T.EN,JP_CORE_LABELS);Object.assign(T.JA,{tab_banner_timeline:'ボディサプライ',bt_view_table:'表',bt_view_timeline:'タイムライン',bt_scroll_top:'ページ上部へ',bt_col_banner:'ボディサプライ',bt_col_featured:'ピックアップ',bt_col_units:'ピックアップ機体',bt_col_chars:'ピックアップキャラ',bt_col_supporters:'ピックアップサポーター',bt_col_start:'開始（JST）',bt_col_end:'終了（JST）',bt_col_duration:'期間',bt_empty:'データがありません。',bt_sort_start_hint:'クリックで開始日で並べ替え（▼ 新しい順 · ▲ 古い順）。',sort_desc:'降順で並べ替え',sort_asc:'昇順で並べ替え'});Object.assign(T.JA,{whats_new_kind_unit_abilities:'ユニットアビリティ',whats_new_kind_unit_weapons:'武装',whats_new_kind_char_abilities:'キャラクターアビリティ',whats_new_slot:'枠',whats_new_before:'変更前',whats_new_after:'変更後',whats_new_tab_pending:'前回基準以降',whats_new_tab_manual:'メモ',whats_new_tab_empty:'この項目に変更はありません。',whats_new_select_period:'期間:',whats_new_manual_note:'メモ',whats_new_label_new_unit:'新規ユニット:',whats_new_label_new_char:'新規キャラクター:',whats_new_label_new_mod:'新規改造パーツ:',whats_new_label_new_supporter:'新規サポーター:',search_spotlight_foot:'Esc・外側クリック・✕ で閉じる',latest_gasha_title:'最新情報:',mod_filter_effect_hp:'最大HP ↑',mod_filter_effect_en:'最大EN ↑',char_list_stat_tooltip:'常時パッシブ込みの合計値 (EX / 条件付きは除く)。シアンは基礎成長値より高い値です。',char_list_stat_base_hint:'基礎成長: {n}',char_grid_stat_ranged:'射',char_grid_stat_melee:'格',char_grid_stat_awaken:'覚',char_grid_stat_defense:'守',char_grid_stat_reaction:'反',col_hp:'HP',col_en:'EN',wp_en:'EN',stat_ranged:'射撃値',stat_melee:'格闘値',stat_awaken:'覚醒値',stat_defense:'守備値',stat_reaction:'反応値',stat_hp:'HP',stat_en:'EN',stat_attack:'攻撃値',stat_mobility:'機動値',stat_move:'移動値',terrain_space:'宇宙',terrain_atmo:'空中',terrain_ground:'地上',terrain_sea:'水上',terrain_underwater:'水中',unit_filter_weapon_debuff:'武装効果（一覧）',unit_filter_weapon_debuff_all:'すべての武装効果',unit_filter_weapon_debuff_multi:'武装効果 {n}種',unit_filter_mechanism:'ギミック',unit_filter_mechanism_all:'すべてのギミック',unit_filter_mechanism_multi:'ギミック {n}種',unit_filter_mechanism_tt:'複数ギミック: すべて一致（AND）。2×2はマスタのOccupiedAreaId=2（大型占有）のユニットに一致。詳細ページと同じ。',unit_filter_wb_atk_dn:'攻撃力ダウン',unit_filter_wb_def_dn:'防御力ダウン',unit_filter_wb_enemy_def_atk:'攻撃時の敵防御力低下',unit_filter_wb_mob_dn:'機動力ダウン',unit_filter_wb_acc_dn:'命中率ダウン',unit_filter_wb_eva_dn:'回避率ダウン',unit_filter_wb_dmg_phys:'物理ダメージ上昇',unit_filter_wb_dmg_beam:'ビームダメージ上昇',unit_filter_wb_dmg_spec:'特殊ダメージ上昇',unit_filter_wb_wp_phys:'物理武装威力ダウン',unit_filter_wb_wp_beam:'ビーム武装威力ダウン',unit_filter_wb_wp_spec:'特殊武装威力ダウン',unit_filter_wb_range_beam:'ビーム武装射程ダウン',unit_filter_wb_range_phys:'物理武装射程ダウン',unit_filter_wb_range_all:'全武装射程ダウン',unit_filter_wb_range_6:'最大射程≥6',unit_filter_wb_mp_1:'MP減少1',unit_filter_wb_mp_2:'MP減少2',unit_filter_wb_mp_3:'MP減少3',unit_filter_wb_preemptive:'先発攻撃',unit_filter_wb_map_weapon:'MAP武装',});T.JP=T.JA;T.EN.support_feedback_btn='Feedback';T.TW.support_feedback_btn='回饋';T.JA.support_feedback_btn='フィードバック';T.JP.support_feedback_btn='フィードバック';T.EN.npc_unlock_prompt='Enter NPC view password';T.EN.npc_unlock_wrong='Incorrect password.';T.TW.npc_unlock_prompt='請輸入 NPC 檢視密碼';T.TW.npc_unlock_wrong='密碼錯誤。';T.JA.npc_unlock_prompt='NPC閲覧パスワードを入力してください';T.JA.npc_unlock_wrong='パスワードが違います。';T.JP.npc_unlock_prompt='NPC閲覧パスワードを入力してください';T.JP.npc_unlock_wrong='パスワードが違います。';T.EN.jp_mode_unlock_prompt='Enter JP mode password';T.EN.jp_mode_unlock_wrong='Incorrect password.';T.TW.jp_mode_unlock_prompt='請輸入 JP 模式密碼';T.TW.jp_mode_unlock_wrong='密碼錯誤。';T.JA.jp_mode_unlock_prompt='JPモードのパスワードを入力してください';T.JA.jp_mode_unlock_wrong='パスワードが違います。';T.JP.jp_mode_unlock_prompt='JPモードのパスワードを入力してください';T.JP.jp_mode_unlock_wrong='パスワードが違います。';T.TW.unit_filter_wb_enemy_def_atk='攻擊時敵方防禦力減少（當次）';T.HK.unit_filter_wb_enemy_def_atk='攻擊時敵方防禦力減少（當次）';T.HK.unit_filter_wb_range_beam='鐳射武裝射程減少';T.HK.support_feedback_btn='意見回饋';T.HK.npc_unlock_prompt='請輸入 NPC 檢視密碼';T.HK.npc_unlock_wrong='密碼錯誤。';T.HK.jp_mode_unlock_prompt='請輸入 JP 模式密碼';T.HK.jp_mode_unlock_wrong='密碼錯誤。';T.EN.support_kofi_btn='Support on Ko-fi';T.TW.support_kofi_btn='在 Ko-fi 支持';T.HK.support_kofi_btn='在 Ko-fi 支持';T.JA.support_kofi_btn='Ko-fiで支援';T.JP.support_kofi_btn='Ko-fiで支援';T.EN.support_alipayhk_btn='Support on AlipayHK';T.TW.support_alipayhk_btn='以 AlipayHK 支持';T.HK.support_alipayhk_btn='以 AlipayHK 支持';T.JA.support_alipayhk_btn='AlipayHKで支援';T.JP.support_alipayhk_btn='AlipayHKで支援';T.EN.support_alipayhk_modal_title='AlipayHK';T.TW.support_alipayhk_modal_title='AlipayHK';T.HK.support_alipayhk_modal_title='AlipayHK';T.JA.support_alipayhk_modal_title='AlipayHK';T.JP.support_alipayhk_modal_title='AlipayHK';T.EN.support_alipayhk_modal_hint='Scan the QR code with AlipayHK to pay HK$50.00.';T.TW.support_alipayhk_modal_hint='請使用 AlipayHK 掃描二維碼付款（港幣 50.00 元）。';T.HK.support_alipayhk_modal_hint='請使用 AlipayHK 掃描二維碼付款（港幣 50.00 元）。';T.JA.support_alipayhk_modal_hint='AlipayHKアプリでQRコードを読み取り、HK$50.00をお支払いください。';T.JP.support_alipayhk_modal_hint='AlipayHKアプリでQRコードを読み取り、HK$50.00をお支払いください。';
Object.assign(T.EN,{tb_front_deploy:'Front Deployment',tb_rear_deploy:'Rear Deployment',tb_squad1:'Squad 1',tb_squad2:'Squad 2',tb_op_label:'OP',tb_option_part:'Option Part',tb_op_swap:'Change option part',tb_op_clear:'Clear',tb_pick_pilot_unit:'Choose pilot for this unit',tb_stat_normal:'Normal',tb_stat_sp:'SP',tb_stat_ssp:'SSP',tb_change_unit:'Change unit',tb_supp_level_adjust:'Adjust',tb_supp_level_slider:'Supporter level from 1 to 100 (drag to match your game)',tb_copy_link:'Copy link',tb_link_copied:'Copied!',tb_screenshot:'Save screenshot',tb_screenshot_fail:'Could not save screenshot',tb_formation_modal_title:'Formation',tb_option_parts_used:'Option parts in use',tb_squad_name_ph:'Squad name (optional)',tb_clear_supporter:'Clear supporter',tb_clear_squad:'Clear squad (units & pilots)',tb_clear_formation_slot:'Clear',tb_formation_name_placeholder:'Formation name',tb_master_league:'Master League Buff +50%',tb_grand_offensive:'Grand Offensive Buff +100%',dc_toggle_master_league:'Master League Buff +50%',dc_toggle_grand_offensive:'Grand Offensive Buff +100%',dc_sheet_buff_hint:'+50% / +100% apply to unit sheet stats (HP, ATK, DEF, Mobility) in the same order as options and leader skills; not EN or Move.',dc_squad_buff_section:'Squad buff',dc_squad_cond_label:'Squad conditions',dc_squad_cond_tip:'Manual % for EX / unit passives that scale with allies in the same squad (including yourself). Team Builder applies this automatically from tags. Default on pick is the maximum the ability allows.',dc_squad_cond_manual_tip:'No auto binding for this pilot+unit pair: enter a % to model squad bonuses (ATK-only, max 100%).',dc_squad_cond_flat_ad_chk:'Apply +%n%% MS ATK & DEF',dc_squad_cond_flat_ad_tip:'Flat MS ATK/DEF % in the same bucket as Squad conditions — on when this unit meets the passive receiver tags (e.g. NT-D).',dc_def_npc_squad_buff:'NPC squad buff',dc_def_npc_squad_buff_tip:'When off, strips MS bonuses from other map NPCs’ squad-wide / all-units passives only. This unit’s own abilities stay (including “squad” lines on this MS or pilot). Applies to HP, EN, ATK, DEF, Mobility, and Move in the panel and in damage / hit rate. Pilot stat cards use this pilot’s passives only.',
dc_def_npc_map_bonuses:'NPC squad buff',dc_def_npc_map_bonuses_tip:'When off, strips MS bonuses from other map NPCs’ squad-wide / all-units passives only. This unit’s own abilities stay (including “squad” lines on this MS or pilot). Applies to HP, EN, ATK, DEF, Mobility, and Move in the panel and in damage / hit rate. Pilot stat cards use this pilot’s passives only.',tb_stats_hint_squad:' Squad tag passives (ATK stack or ATK+DEF) are applied from your formation when tags match.',dc_wpn_trait_effects:'Weapon power from effects',dc_wpn_trait_dist:'Distance scaling',dc_wpn_trait_custom_core:'Custom Core (SSP)',dc_wpn_trait_hp:'HP scaling',dc_wpn_trait_mp:'MP / battle-start scaling',dc_wpn_trait_max_applied:'max, applied automatically in damage',dc_wpn_trait_ssp_hint:'Turn on SSP (unit mode) to apply Custom Core weapon effect lines.',dc_wpn_trait_lines:'Trait:',dc_wpn_trait_override_note:'Final weapon power override is on; breakdown below is the auto trait math (not used for damage).'});
Object.assign(T.TW,{tb_front_deploy:'前衛配置',tb_rear_deploy:'後衛配置',tb_squad1:'小隊 1',tb_squad2:'小隊 2',tb_op_label:'OP',tb_option_part:'改造零件',tb_op_swap:'更換改造零件',tb_op_clear:'移除',tb_pick_pilot_unit:'選擇此機體的駕駛員',tb_stat_normal:'一般',tb_stat_sp:'SP',tb_stat_ssp:'SSP',tb_change_unit:'更換機體',tb_supp_level_adjust:'調整',tb_supp_level_slider:'支援人員等級 1–100（拖曳以配合遊戲內等級）',tb_copy_link:'複製連結',tb_link_copied:'已複製！',tb_screenshot:'儲存截圖',tb_screenshot_fail:'無法儲存截圖',tb_formation_modal_title:'編成',tb_option_parts_used:'使用的改造零件',tb_squad_name_ph:'小隊名稱（選填）',tb_clear_supporter:'清除支援人員',tb_clear_squad:'清除小隊（機體與駕駛員）',tb_clear_formation_slot:'清除',tb_formation_name_placeholder:'編成名稱',tb_master_league:'大師聯盟補正 +50%',tb_grand_offensive:'大規模攻略戰補正 +100%',dc_toggle_master_league:'大師聯盟補正 +50%',dc_toggle_grand_offensive:'大規模攻略戰補正 +100%',dc_sheet_buff_hint:'+50%／+100% 套用於機體面板數值（HP、攻擊力、守備力、機動力），計算順序與改造與隊長技能相同；不含 EN 與移動力。',dc_squad_buff_section:'小隊加成',dc_squad_cond_label:'小隊條件',dc_squad_cond_tip:'因應「同小隊」條件而變動的 EX／機體被動加成（含自身）。編隊頁會依標籤自動計算。選擇單位後預設為該能力允許的最大值。',dc_squad_cond_manual_tip:'此駕駛員＋機體無法自動套用：請手動輸入 %（僅攻擊，最高 100%）。',dc_squad_cond_flat_ad_chk:'套用 +%n%% 機體攻防',dc_squad_cond_flat_ad_tip:'與「小隊條件」％相同計算；依被動接收標籤（例 NT‑D）套用。',dc_def_npc_squad_buff:'NPC 小隊加成',dc_def_npc_squad_buff_tip:'關閉時只移除「其他地圖敵方」的小隊／己方全體類被動帶來的 MS 加成；此機體與其駕駛員自己的被動保留（含此機體上的「小隊」敘述）。影響 HP、EN、攻擊力、守備力、機動力、移動力的顯示與傷害／命中。駕駛員面板仍僅依該駕駛員被動。',
dc_def_npc_map_bonuses:'NPC 小隊加成',dc_def_npc_map_bonuses_tip:'關閉時只移除「其他地圖敵方」的小隊／己方全體類被動帶來的 MS 加成；此機體與其駕駛員自己的被動保留（含此機體上的「小隊」敘述）。影響 HP、EN、攻擊力、守備力、機動力、移動力的顯示與傷害／命中。駕駛員面板仍僅依該駕駛員被動。',tb_stats_hint_squad:' 符合標籤的小隊被動（攻擊力堆疊或攻擊力+守備力）會依編隊自動套用。',dc_wpn_trait_effects:'武裝威力（效果加成）',dc_wpn_trait_dist:'距離加成',dc_wpn_trait_custom_core:'自訂核心（SSP）',dc_wpn_trait_hp:'依剩餘 HP',dc_wpn_trait_mp:'依 MP／戰鬥開始',dc_wpn_trait_max_applied:'已套用上限（傷害計算）',dc_wpn_trait_ssp_hint:'請在上方將機體模式切換為 SSP，以套用自訂核心武裝效果。',dc_wpn_trait_lines:'特性：',dc_wpn_trait_override_note:'已設定最終武裝威力；下列為自動解析的效果加總（傷害計算未使用）。'});
Object.assign(T.HK,{tb_front_deploy:'前衛配置',tb_rear_deploy:'後衛配置',tb_squad1:'小隊 1',tb_squad2:'小隊 2',tb_op_label:'OP',tb_option_part:'改造零件',tb_op_swap:'更換改造零件',tb_op_clear:'移除',tb_pick_pilot_unit:'選擇此機體的駕駛員',tb_stat_normal:'一般',tb_stat_sp:'SP',tb_stat_ssp:'SSP',tb_change_unit:'更換機體',tb_supp_level_adjust:'調整',tb_supp_level_slider:'支援人員等級 1–100（拖曳以配合遊戲內等級）',tb_copy_link:'複製連結',tb_link_copied:'已複製！',tb_screenshot:'儲存截圖',tb_screenshot_fail:'無法儲存截圖',tb_formation_modal_title:'編成',tb_option_parts_used:'使用的改造零件',tb_squad_name_ph:'小隊名稱（選填）',tb_clear_supporter:'清除支援人員',tb_clear_squad:'清除小隊（機體與駕駛員）',tb_clear_formation_slot:'清除',tb_formation_name_placeholder:'編成名稱',tb_master_league:'大師聯盟補正 +50%',tb_grand_offensive:'大規模攻略戰補正 +100%',dc_toggle_master_league:'大師聯盟補正 +50%',dc_toggle_grand_offensive:'大規模攻略戰補正 +100%',dc_sheet_buff_hint:'+50%／+100% 套用於機體面板數值（HP、攻擊力、守備力、機動力），計算順序與改造與隊長技能相同；不含 EN 與移動力。',dc_squad_buff_section:'小隊加成',dc_squad_cond_label:'小隊條件',dc_squad_cond_tip:'因應「同小隊」條件而變動的 EX／機體被動加成（含自身）。編隊頁會依標籤自動計算。選擇單位後預設為該能力允許的最大值。',dc_squad_cond_manual_tip:'此駕駛員＋機體無法自動套用：請手動輸入 %（僅攻擊，最高 100%）。',dc_squad_cond_flat_ad_chk:'套用 +%n%% 機體攻防',dc_squad_cond_flat_ad_tip:'與「小隊條件」％相同計算；依被動接收標籤（例 NT‑D）套用。',dc_def_npc_squad_buff:'NPC 小隊加成',dc_def_npc_squad_buff_tip:'關閉時只移除「其他地圖敵方」的小隊／己方全體類被動帶來的 MS 加成；此機體與其駕駛員自己的被動保留（含此機體上的「小隊」敘述）。影響 HP、EN、攻擊力、守備力、機動力、移動力的顯示與傷害／命中。駕駛員面板仍僅依該駕駛員被動。',
dc_def_npc_map_bonuses:'NPC 小隊加成',dc_def_npc_map_bonuses_tip:'關閉時只移除「其他地圖敵方」的小隊／己方全體類被動帶來的 MS 加成；此機體與其駕駛員自己的被動保留（含此機體上的「小隊」敘述）。影響 HP、EN、攻擊力、守備力、機動力、移動力的顯示與傷害／命中。駕駛員面板仍僅依該駕駛員被動。',tb_stats_hint_squad:' 符合標籤的小隊被動（攻擊力堆疊或攻擊力+守備力）會依編隊自動套用。',dc_wpn_trait_effects:'武裝威力（效果加成）',dc_wpn_trait_dist:'距離加成',dc_wpn_trait_custom_core:'自訂核心（SSP）',dc_wpn_trait_hp:'依剩餘 HP',dc_wpn_trait_mp:'依 MP／戰鬥開始',dc_wpn_trait_max_applied:'已套用上限（傷害計算）',dc_wpn_trait_ssp_hint:'請在上方將機體模式切換為 SSP，以套用自訂核心武裝效果。',dc_wpn_trait_lines:'特性：',dc_wpn_trait_override_note:'已設定最終武裝威力；下列為自動解析的效果加總（傷害計算未使用）。'});
Object.assign(T.JA,{tb_front_deploy:'前衛配置',tb_rear_deploy:'後衛配置',tb_squad1:'分隊1',tb_squad2:'分隊2',tb_op_label:'OP',tb_option_part:'オプションパーツ',tb_op_swap:'オプションパーツを変更',tb_op_clear:'解除',tb_pick_pilot_unit:'このユニットのパイロットを選択',tb_stat_normal:'通常',tb_stat_sp:'SP',tb_stat_ssp:'SSP',tb_change_unit:'ユニット変更',tb_supp_level_adjust:'変更',tb_supp_level_slider:'サポーターのレベルを 1～100 で変更（ゲームに合わせて調整）',tb_copy_link:'リンクをコピー',tb_link_copied:'コピーしました',tb_screenshot:'画像を保存',tb_screenshot_fail:'スクリーンショットに失敗しました',tb_formation_modal_title:'編成',tb_option_parts_used:'使用中のオプションパーツ',tb_squad_name_ph:'分隊名（任意）',tb_clear_supporter:'サポーターを解除',tb_clear_squad:'分隊を空にする（ユニット・パイロット）',tb_clear_formation_slot:'クリア',tb_formation_name_placeholder:'編成名',tb_master_league:'マスターリーグ補正 +50%',tb_grand_offensive:'グランド攻勢補正 +100%',dc_toggle_master_league:'マスターリーグ補正 +50%',dc_toggle_grand_offensive:'グランド攻勢補正 +100%',dc_sheet_buff_hint:'+50%／+100%はユニットの基礎ステータス（HP・攻撃力・防御力・機動力）に適用されます（OP・リーダー等と同じ計算順）。EN・移動力には適用されません。',dc_squad_buff_section:'分隊補正',dc_squad_cond_label:'分隊条件',dc_squad_cond_tip:'同部隊の味方（自身を含む）のタグで変動するEX／ユニット被動の%を手動入力します。チーム編成ではタグ一致で自動計算。選択直後は能力の上限が既定値です。',dc_squad_cond_manual_tip:'自動判定できない組み合わせ：分隊補正を手動で入力（攻撃力のみ、最大100%）。',dc_squad_cond_flat_ad_chk:'ユニット攻撃力・防御力 +%n%%',dc_squad_cond_flat_ad_tip:'「分隊条件」と同じ枠での扁平補正。受動の付与標準（NT-D など）を満たす機体のみ。',dc_def_npc_squad_buff:'NPC分隊バフ',dc_def_npc_squad_buff_tip:'オフにすると、マップ上の「他の敵NPC」が付与する分隊／味方全体系のMS%加算だけを外します。この機体・搭乗パイロット自身のパッシブ（この機体側の「分隊」表現を含む）は残ります。HP・EN・攻撃力・防御力・機動力・移動力の表示とダメージ／命中に反映。パイロット欄は従来どおり当該パイロットのパッシブのみ。',
dc_def_npc_map_bonuses:'NPC分隊バフ',dc_def_npc_map_bonuses_tip:'オフにすると、マップ上の「他の敵NPC」が付与する分隊／味方全体系のMS%加算だけを外します。この機体・搭乗パイロット自身のパッシブ（この機体側の「分隊」表現を含む）は残ります。HP・EN・攻撃力・防御力・機動力・移動力の表示とダメージ／命中に反映。パイロット欄は従来どおり当該パイロットのパッシブのみ。',tb_stats_hint_squad:' タグが一致する分隊被動（攻撃力の積み上げまたは攻撃力＋防御力）は編成から自動反映されます。',dc_wpn_trait_effects:'武装威力（効果による加算）',dc_wpn_trait_dist:'距離による加算',dc_wpn_trait_custom_core:'カスタムコア（SSP）',dc_wpn_trait_hp:'残りHPによる加算',dc_wpn_trait_mp:'MP／戦闘開始時による加算',dc_wpn_trait_max_applied:'上限まで自動反映（ダメージ計算）',dc_wpn_trait_ssp_hint:'カスタムコアの武装効果を反映するには、上の機体モードをSSPにしてください。',dc_wpn_trait_lines:'特性：',dc_wpn_trait_override_note:'最終武装威力を上書き中です。以下は自動計算の特効内訳（ダメージには反映されません）。'});
STAT_NAME_MAP.JA={'Ranged':'射撃','Melee':'格闘','Awaken':'覚醒','Defense':'防御力','Reaction':'反応','HP':'HP','EN':'EN','Attack':'攻撃力','ATK':'攻撃力','DEF':'防御力','MOB':'機動力','Mobility':'機動力','Move':'移動力'};STAT_NAME_MAP.JP=STAT_NAME_MAP.JA;
TERRAIN_NAME_MAP.JA={'Space':'宇宙','Atmospheric':'空中','Ground':'地上','Sea':'水上','Underwater':'水中'};TERRAIN_NAME_MAP.JP=TERRAIN_NAME_MAP.JA;
ROLE_NAME_MAP.JA={'Attack':'攻撃型','Defense':'耐久型','Support':'支援型'};ROLE_NAME_MAP.JP=ROLE_NAME_MAP.JA;
ROLE_LABELS.JA={'':'全タイプ','1':'攻撃型のみ','2':'耐久型のみ','3':'支援型のみ'};ROLE_LABELS.JP=ROLE_LABELS.JA;
const RARITY_BASE_MAP={'UR':'/static/images/UI/UI_Common_Tmb_Square_UR_Base.webp','SSR':'/static/images/UI/UI_Common_Tmb_Square_SSR_Base.webp','SR':'/static/images/UI/UI_Common_Tmb_Square_SR_Base.webp','R':'/static/images/UI/UI_Common_Tmb_Square_R_Base.webp','N':'/static/images/UI/UI_Common_Tmb_Square_None_Base.webp'};
const RARITY_FRAME_MAP={'UR':'/static/images/UI/UI_Common_Tmb_Square_UR_Frame.webp','SSR':'/static/images/UI/UI_Common_Tmb_Square_SSR_Frame.webp','SR':'/static/images/UI/UI_Common_Tmb_Square_SR_Frame.webp','R':'/static/images/UI/UI_Common_Tmb_Square_R_Frame.webp','N':'/static/images/UI/UI_Common_Tmb_Square_None_Frame%20%236338.webp'};
const TB_LONG_BASE_MAP={'UR':'/static/images/UI/UI_Common_Tmb_Long_UR_Base.webp','SSR':'/static/images/UI/UI_Common_Tmb_Long_SSR_Base.webp','SR':'/static/images/UI/UI_Common_Tmb_Long_SR_Base.webp','R':'/static/images/UI/UI_Common_Tmb_Long_R_Base.webp','N':'/static/images/UI/UI_Common_Tmb_Long_N_Base.webp'};
const SUPPORTER_BASE_MAP={'UR':'/static/images/UI/UI_Common_Tmb_Square_Supporter_Base_UR.webp','SSR':'/static/images/UI/UI_Common_Tmb_Square_Supporter_Base_SSR.webp','SR':'/static/images/UI/UI_Common_Tmb_Square_Supporter_Base_SR.webp','R':'/static/images/UI/UI_Common_Tmb_Square_Supporter_Base_R.webp','N':'/static/images/UI/UI_Common_Tmb_Square_Supporter_Base_N.webp'};
const TB_SUPPORTER_TB_BASE='/static/images/UI/UI_Common_Tmb_Supporter_Base.webp';
const TB_SUPPORTER_TB_FRAME_LR='/static/images/UI/UI_Common_Tmb_Supporter_UR_Frame_01.webp';
const TB_SUPPORTER_TB_FRAME_BT='/static/images/UI/UI_Common_Tmb_Supporter_UR_Frame_02.webp';
const LB_ICONS={'None':'/static/images/UI/UI_Common_Icon_Grade_M_None.webp','Neutral':'/static/images/UI/UI_Common_Icon_Grade_M_Neutral.webp','Max':'/static/images/UI/UI_Common_Icon_Grade_M_Max.webp'};
const CMP_LB_TIER_PIPS=[[LB_ICONS.None,LB_ICONS.None,LB_ICONS.None],[LB_ICONS.Neutral,LB_ICONS.None,LB_ICONS.None],[LB_ICONS.Neutral,LB_ICONS.Neutral,LB_ICONS.None],[LB_ICONS.Max,LB_ICONS.Max,LB_ICONS.Max]];
function cmpLbPipsRow(a0,a1,a2){return [a0,a1,a2].map(src=>`<img src="${imgUrl(src)}" alt="" loading="lazy" decoding="async" fetchpriority="low">`).join('')}
function cmpLbPipsAtTier(tt){const i=Math.min(Math.max(0,tt|0),CMP_LB_TIER_PIPS.length-1);return CMP_LB_TIER_PIPS[i]}
function t(key){const lang=S.lang||'EN';return(T[lang]&&T[lang][key])||T.EN[key]||key}
function tStat(name,ctx){const lang=S.lang;if((lang==='TW'||lang==='HK'||lang==='JA'||lang==='JP')&&ctx==='character'){const c=STAT_NAME_MAP_CHAR[lang];if(c&&c[name])return c[name]}const m=STAT_NAME_MAP[lang];return(m&&m[name])||name}
function charGridStatLabel(k){const colMap={Ranged:'col_ranged',Melee:'col_melee',Awaken:'col_awaken',Defense:'col_defense',Reaction:'col_reaction'};if(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP'){const ck=colMap[k];return ck?t(ck):tStat(k,'character')}const m={Ranged:'char_grid_stat_ranged',Melee:'char_grid_stat_melee',Awaken:'char_grid_stat_awaken',Defense:'char_grid_stat_defense',Reaction:'char_grid_stat_reaction'};const key=m[k];return key?t(key):tStat(k,'character')}
function tTerrain(name){const m=TERRAIN_NAME_MAP[S.lang];return(m&&m[name])||name}
function tRole(name){const m=ROLE_NAME_MAP[S.lang];return(m&&m[name])||name}
function tRoleFilter(roleId){const m=ROLE_LABELS[S.lang]||ROLE_LABELS.EN;return m[roleId]||m['']}
const S={lang:'EN',languages:[],currentTab:'characters',listView:{characters:'grid',units:'grid',supporters:'grid',stages:'grid',modifications:'grid'},characters:{page:1,sort:'rarity',dir:'desc',q:''},units:{page:1,sort:'rarity',dir:'desc',q:''},supporters:{page:1,sort:'rarity',dir:'desc',q:''},stages:{page:1,q:'',difficultyFilter:'ALL',sort:'stage_number',dir:'asc',source:'eternal'},modifications:{page:1,sort:'name',dir:'asc',q:'',effectFilter:'ALL'},_modEffectFilterIcons:null,ft:null,currentDetailData:null,currentDetailType:null,conditionalPassiveActive:false,charSuperchargedExTier:0,spActive:false,sspActive:false,_tagRarityFilter:'ALL',_tagAcqFilter:'ALL',_tagTargetType:'unit',_tagModalMode:'tags',_seriesModalSid:'',_seriesModalName:'',_currentTagStr:'',_currentTagOp:'and',currentLbTier:3,currentWeaponLevels:{},stageMapExpanded:false,stageMapZoom:1,stageMapAutoFit:true,compareList:[],compareData:[],compareType:'unit',_cmpPickerCache:[],cmpSpActive:false,cmpSspActive:false,cmpLbByUnit:{},cmpMobilePickMode:false,listCharSp:false,listUnitSp:false,listUnitSsp:false,listCharCond:false,listUnitCond:false,listSelectedUnitId:null,listCharSource:'ALL',listUnitSource:'ALL',listCharLineage:[],listCharSeries:[],listCharSkills:[],listCharAbilities:[],listUnitLineage:[],listUnitSeries:[],listUnitAbilities:[],listUnitTerrain:[],listUnitWeaponDebuff:[],listUnitMechanism:[],listSuppLineage:[],browseCombCharLineage:'and',browseCombUnitLineage:'and',browseCombSuppLineage:'and',browseCombCharSeries:'or',browseCombUnitSeries:'or',browseCombCharSkill:'and',browseCombUnitAbil:'and',browseCombCharTrait:'and',browseCombTerrain:'and',browseCombWb:'and',browseCombMech:'and',listGridVariant:{characters:2,units:2},weaponDebuffPresentKeys:null,mechanismPresentRows:null,lrCacheKey:null,lrCacheData:null,btCacheKey:null,btCacheData:null,btBannerSortDir:'desc',_browsePrimed:{},dc:{atkUnit:null,atkChar:null,atkUnitData:null,atkCharData:null,defNpc:null,defUnitData:null,defCharData:null,defLbTier:3,npcList:[],wpnIdx:0,wpnLv:0,lbTier:3,distance:1,terrain:0,mpLevel:'medium',defending:false,shield:false,optionParts:[],supporters:[],debuffs:[],unitStatMode:'normal',charStatMode:'normal',unitCondPassive:false,charCondPassive:false,dcSuperchargedExTier:0,masterLeagueBuff:false,grandOffensiveBuff:false,squadCondPct:0,squadCondAtkPct:0,squadCondDefPct:0,_applicableOptionRows:null,_applicableSupporterRows:null},tb:null,_dcPickerType:null,_dcPickerCache:[],_searchRecallObs:null,_suspendRarityItemChange:false,ranking:{mode:'units',viewMode:'list',sortChar:'Ranged',sortUnit:'HP',dirChar:'desc',dirUnit:'desc',pageChar:1,pageUnit:1},listRankCharSource:'ALL',listRankUnitSource:'ALL',listRankCharLineage:[],listRankCharSeries:[],listRankCharSkills:[],listRankCharAbilities:[],listRankUnitLineage:[],listRankUnitSeries:[],listRankUnitAbilities:[],listRankUnitTerrain:[],listRankUnitWeaponDebuff:[],listRankUnitMechanism:[],listRankCharSp:false,listRankCharCond:false,listRankUnitSp:false,listRankUnitSsp:false,listRankUnitCond:false,browseCombRankCharLineage:'and',browseCombRankUnitLineage:'and',browseCombRankCharSeries:'or',browseCombRankUnitSeries:'or',browseCombRankCharSkill:'and',browseCombRankUnitAbil:'and',browseCombRankCharTrait:'and',browseCombRankTerrain:'and',browseCombRankWb:'and',browseCombRankMech:'and'};
function primeBrowseTabIfNeeded(tab){const browseTabs={characters:1,units:1,supporters:1,stages:1,modifications:1};if(!browseTabs[tab]||S._browsePrimed[tab])return;S._browsePrimed[tab]=1;if(tab==='characters')loadCharacters(1);else if(tab==='units')loadUnits(1);else if(tab==='supporters')loadSupporters(1);else if(tab==='stages')loadStages(1);else if(tab==='modifications')loadModifications(1)}
const RANK_SORT_KEYS_CHAR=['Ranged','Melee','Awaken','Defense','Reaction'];
const RANK_SORT_KEYS_UNIT=['HP','EN','ATK','DEF','MOB'];
function rankingSortKeys(){return S.ranking.mode==='characters'?RANK_SORT_KEYS_CHAR:RANK_SORT_KEYS_UNIT}
function syncRankingFiltersFromBrowse(){S.listRankCharSource=S.listCharSource;S.listRankCharLineage=(S.listCharLineage||[]).slice();S.listRankCharSeries=(S.listCharSeries||[]).slice();S.listRankCharSkills=(S.listCharSkills||[]).slice();S.listRankCharAbilities=(S.listCharAbilities||[]).slice();S.listRankCharSp=!!S.listCharSp;S.listRankCharCond=!!S.listCharCond;S.browseCombRankCharLineage=S.browseCombCharLineage;S.browseCombRankCharSeries=S.browseCombCharSeries;S.browseCombRankCharSkill=S.browseCombCharSkill;S.browseCombRankCharTrait=S.browseCombCharTrait;const cf=document.getElementById('charFilter'),rf=document.getElementById('rankCharFilter');if(cf&&rf){rf.value=cf.value;syncBrowseSearchWidth('rankCharFilter')}S.listRankUnitSource=S.listUnitSource;S.listRankUnitLineage=(S.listUnitLineage||[]).slice();S.listRankUnitSeries=(S.listUnitSeries||[]).slice();S.listRankUnitAbilities=(S.listUnitAbilities||[]).slice();S.listRankUnitTerrain=(S.listUnitTerrain||[]).slice();S.listRankUnitWeaponDebuff=(S.listUnitWeaponDebuff||[]).slice();S.listRankUnitWeaponRange=(S.listUnitWeaponRange||[]).slice();S.listRankUnitMechanism=(S.listUnitMechanism||[]).slice();S.listRankUnitSp=!!S.listUnitSp;S.listRankUnitSsp=!!S.listUnitSsp;S.listRankUnitCond=!!S.listUnitCond;S.browseCombRankUnitLineage=S.browseCombUnitLineage;S.browseCombRankUnitSeries=S.browseCombUnitSeries;S.browseCombRankUnitAbil=S.browseCombUnitAbil;S.browseCombRankTerrain=S.browseCombTerrain;S.browseCombRankWb=S.browseCombWb;S.browseCombRankWr=S.browseCombWr;S.browseCombRankMech=S.browseCombMech;const uf=document.getElementById('unitFilter'),ruf=document.getElementById('rankUnitFilter');if(uf&&ruf){ruf.value=uf.value;syncBrowseSearchWidth('rankUnitFilter')}}
function isRankingEntity(which){return which==='rankChar'||which==='rankUnit'}
function listLineageKey(which){if(which==='rankChar')return 'listRankCharLineage';if(which==='rankUnit')return 'listRankUnitLineage';if(which==='char')return 'listCharLineage';if(which==='supp')return 'listSuppLineage';return 'listUnitLineage'}
function listSeriesKey(which){if(which==='rankChar')return 'listRankCharSeries';if(which==='rankUnit')return 'listRankUnitSeries';return which==='char'?'listCharSeries':'listUnitSeries'}
function listSourceKey(which){if(which==='rankChar')return 'listRankCharSource';if(which==='rankUnit')return 'listRankUnitSource';return which==='char'?'listCharSource':'listUnitSource'}
function browseFiltersEntityForRanking(which){if(which==='rankChar')return 'char';if(which==='rankUnit')return 'unit';return which}
function lineageCombineKey(which){if(which==='rankChar')return 'browseCombRankCharLineage';if(which==='rankUnit')return 'browseCombRankUnitLineage';if(which==='char')return 'browseCombCharLineage';if(which==='supp')return 'browseCombSuppLineage';return 'browseCombUnitLineage'}
function seriesCombineKey(which){if(which==='rankChar')return 'browseCombRankCharSeries';if(which==='rankUnit')return 'browseCombRankUnitSeries';return which==='char'?'browseCombCharSeries':'browseCombUnitSeries'}
function skillCombineKey(which){if(which==='rankChar')return 'browseCombRankCharSkill';if(which==='rankUnit')return 'browseCombRankUnitAbil';return which==='char'?'browseCombCharSkill':'browseCombUnitAbil'}
function traitCombineKey(which){return which==='rankChar'?'browseCombRankCharTrait':'browseCombCharTrait'}
function filterLineageRowsForLabel(which){if(which==='rankChar'||which==='rankUnit'){const b=S._rankBrowseFilters&&S._rankBrowseFilters[which];return b&&Array.isArray(b.lineages)?b.lineages:null}const ent=S._browseFiltersByEntity;const p=which==='char'?'char':(which==='supp'?'supp':'unit');return ent&&ent._lang===S.lang&&ent[p]&&Array.isArray(ent[p].lineages)?ent[p].lineages:null}
function filterSeriesRowsForLabel(which){if(which==='rankChar'||which==='rankUnit'){const b=S._rankBrowseFilters&&S._rankBrowseFilters[which];return b&&Array.isArray(b.series)?b.series:null}const pack=getBrowsePack(which==='char'?'char':'unit');return pack&&Array.isArray(pack.series)?pack.series:[]}
function buildRankingBrowsePoolQuery(which){if(which==='rankChar'){const qEl=document.getElementById('rankCharFilter');const q=(qEl&&qEl.value.trim())||'';const roleQ=getRoleQuerySuffix('rankChar');const rq=getRarityQuerySuffix('rankChar');const stQ=listStatQChar(!!S.listRankCharSp,!!S.listRankCharCond);const srcQ=(cur=>{if(!cur||cur==='ALL')return '';return '&source='+encodeURIComponent(cur)})(S.listRankCharSource||'ALL');const linQ=(()=>{let sel=S.listRankCharLineage;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&lineage_id='+encodeURIComponent(sel.join(','))})();const linOp=(()=>{let sel=S.listRankCharLineage;if(!Array.isArray(sel)||sel.length<2)return '';return '&lineage_op='+encodeURIComponent(S.browseCombRankCharLineage==='or'?'or':'and')})();const serQ=(()=>{let sel=S.listRankCharSeries;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}if(!sel.length)return '';return '&series_id='+encodeURIComponent(sel.join(','))})();const serOp=(()=>{let sel=S.listRankCharSeries;if(!Array.isArray(sel)||sel.length<2)return '';return '&series_op='+encodeURIComponent(S.browseCombRankCharSeries==='and'?'and':'or')})();const skillQ=(()=>{let sel=S.listRankCharSkills;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&skill_id='+encodeURIComponent(sel.join(','))})();const skOp=(()=>{let sel=S.listRankCharSkills;if(!Array.isArray(sel)||sel.length<2)return '';return '&skill_op='+encodeURIComponent(S.browseCombRankCharSkill==='or'?'or':'and')})();const abilQ=(()=>{let sel=S.listRankCharAbilities;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&ability_id='+encodeURIComponent(sel.join(','))})();const traitOp=(()=>{let sel=S.listRankCharAbilities;if(!Array.isArray(sel)||sel.length<2)return '';return '&ability_op='+encodeURIComponent(S.browseCombRankCharTrait==='or'?'or':'and')})();return `q=${encodeURIComponent(q)}${roleQ}${rq}${stQ}${srcQ}${linQ}${linOp}${serQ}${serOp}${skillQ}${skOp}${abilQ}${traitOp}`}const qEl=document.getElementById('rankUnitFilter');const qRaw=(qEl&&qEl.value.trim())||'';const qApi=expandUnitSearchQuery(qRaw);const roleQ=getRoleQuerySuffix('rankUnit');const rq=getRarityQuerySuffix('rankUnit');const stQ=listStatQUnit(!!S.listRankUnitSp,!!S.listRankUnitSsp,!!S.listRankUnitCond);const srcQ=(cur=>{if(!cur||cur==='ALL')return '';return '&source='+encodeURIComponent(cur)})(S.listRankUnitSource||'ALL');const terrQ=(()=>{let sel=S.listRankUnitTerrain;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&terrain='+encodeURIComponent(sel.join(','))})();const terrOp=(()=>{let sel=S.listRankUnitTerrain;if(!Array.isArray(sel)||sel.length<2)return '';return '&terrain_op='+encodeURIComponent(S.browseCombRankTerrain==='or'?'or':'and')})();const debQ=(()=>{let sel=S.listRankUnitWeaponDebuff;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&weapon_debuff='+encodeURIComponent(sel.join(','))})();const debOp=(()=>{let sel=S.listRankUnitWeaponDebuff;if(!Array.isArray(sel)||sel.length<2)return '';return '&weapon_debuff_op='+encodeURIComponent(S.browseCombRankWb==='or'?'or':'and')})();const wrQ=(()=>{let sel=S.listRankUnitWeaponRange;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&weapon_range='+encodeURIComponent(sel.join(','))})();const mechQ=(()=>{let sel=S.listRankUnitMechanism;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&mechanism='+encodeURIComponent(sel.join(','))})();const mechOp=(()=>{let sel=S.listRankUnitMechanism;if(!Array.isArray(sel)||sel.length<2)return '';return '&mechanism_op='+encodeURIComponent(S.browseCombRankMech==='or'?'or':'and')})();const linQ=(()=>{let sel=S.listRankUnitLineage;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&lineage_id='+encodeURIComponent(sel.join(','))})();const linOp=(()=>{let sel=S.listRankUnitLineage;if(!Array.isArray(sel)||sel.length<2)return '';return '&lineage_op='+encodeURIComponent(S.browseCombRankUnitLineage==='or'?'or':'and')})();const serQ=(()=>{let sel=S.listRankUnitSeries;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}if(!sel.length)return '';return '&series_id='+encodeURIComponent(sel.join(','))})();const serOp=(()=>{let sel=S.listRankUnitSeries;if(!Array.isArray(sel)||sel.length<2)return '';return '&series_op='+encodeURIComponent(S.browseCombRankUnitSeries==='and'?'and':'or')})();const abQ=(()=>{let sel=S.listRankUnitAbilities;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&ability_id='+encodeURIComponent(sel.join(','))})();const abOp=(()=>{let sel=S.listRankUnitAbilities;if(!Array.isArray(sel)||sel.length<2)return '';return '&ability_op='+encodeURIComponent(S.browseCombRankUnitAbil==='or'?'or':'and')})();return `q=${encodeURIComponent(qApi)}${roleQ}${rq}${stQ}${srcQ}${terrQ}${terrOp}${debQ}${debOp}${wrQ}${mechQ}${mechOp}${linQ}${linOp}${serQ}${serOp}${abQ}${abOp}`}
function buildRankingBrowsePoolSig(which){return buildRankingBrowsePoolQuery(which)+'|'+[S.browseCombRankCharLineage,S.browseCombRankCharSeries,S.browseCombRankCharSkill,S.browseCombRankCharTrait,S.browseCombRankUnitLineage,S.browseCombRankUnitSeries,S.browseCombRankUnitAbil,S.browseCombRankTerrain,S.browseCombRankWb,S.browseCombRankWr,S.browseCombRankMech].join(',')}
async function ensureRankingBrowseFiltersEntity(which){if(which!=='rankChar'&&which!=='rankUnit')return;S._rankBrowseFilters=S._rankBrowseFilters||{};const sigField=which==='rankChar'?'_poolSigRankChar':'_poolSigRankUnit';const sig=buildRankingBrowsePoolSig(which);const cur=S._rankBrowseFilters;if(cur[sigField]===sig&&cur._lang===S.lang)return;const infl='_rankBfInfl'+which;if(S[infl])return S[infl];S[infl]=(async()=>{const q=buildRankingBrowsePoolQuery(which);const apiEnt=which==='rankChar'?'characters':'units';const langAtStart=S.lang;try{const r=await fetch(`/api/browse_filters?lang=${S.lang}&entity=${apiEnt}&filter_mode=current&${q}`);const data=await r.json();if(S.lang!==langAtStart)return;S._rankBrowseFilters._lang=S.lang;if(which==='rankChar'){S._rankBrowseFilters.rankChar={lineages:data.lineages||[],series:data.series||[],skills:data.skills||[],abilities:data.abilities||[]};S._rankBrowseFilters._poolSigRankChar=sig}else{S._rankBrowseFilters.rankUnit={lineages:data.lineages||[],series:data.series||[],abilities:data.abilities||[]};S._rankBrowseFilters._poolSigRankUnit=sig}}catch(e){if(S.lang!==langAtStart)return;S._rankBrowseFilters._lang=S.lang;if(which==='rankChar'){S._rankBrowseFilters.rankChar={lineages:[],series:[],skills:[],abilities:[]};S._rankBrowseFilters._poolSigRankChar=sig}else{S._rankBrowseFilters.rankUnit={lineages:[],series:[],abilities:[]};S._rankBrowseFilters._poolSigRankUnit=sig}}finally{S[infl]=null}})();return S[infl]}
function getRankBrowsePack(p){const R=S._rankBrowseFilters;return R&&R._lang===S.lang?R[p]:null}
function browseFilterPanelNeedsRebuildRanking(el,entity){if(!el)return true;return el.dataset.bfPoolSig!==buildRankingBrowsePoolSig(entity)}
function markBrowseFilterPanelBuiltRanking(el,entity){if(!el)return;el.dataset.bfPoolSig=buildRankingBrowsePoolSig(entity);el.dataset.populated='1'}
function invalidateRankingBrowseFilterPanels(){S._rankBrowseFilters=null;document.querySelectorAll('#rankCharLineageFilterBody,#rankCharSeriesFilterBody,#rankCharSkillGrid,#rankCharAbilGrid,#rankUnitLineageFilterBody,#rankUnitSeriesFilterBody,#rankUnitSkillGrid').forEach(el=>{if(el)delete el.dataset.populated})}
function unitTerrainStateKey(){return S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units'?'listRankUnitTerrain':'listUnitTerrain'}
function unitTerrainDomPrefix(){return S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units'?'rankUnit':'unit'}
function unitWeaponDebuffDomPrefix(){return unitTerrainDomPrefix()}
function unitMechanismDomPrefix(){return unitTerrainDomPrefix()}
function unitWeaponDebuffStateKey(){return S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units'?'listRankUnitWeaponDebuff':'listUnitWeaponDebuff'}
function unitMechanismStateKey(){return S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units'?'listRankUnitMechanism':'listUnitMechanism'}
function unitWeaponRangeDomPrefix(){return unitTerrainDomPrefix()}
function unitWeaponRangeStateKey(){return S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units'?'listRankUnitWeaponRange':'listUnitWeaponRange'}
const UNIT_WEAPON_RANGE_VALUES=['1','2','3','4','5','6'];
function scheduleRankingListReload(){clearTimeout(S._rankListFt);S._rankListFt=setTimeout(()=>{S._rankListFt=null;loadRankingList(1)},BROWSE_LIST_RELOAD_MS)}
const _rankingLastPayloadByMode={characters:null,units:null};
const _rankingPodiumCache=new Map();
function syncRankingViewModeUi(){ensureRankingTopControlEnhancements();const vm=(S.ranking&&S.ranking.viewMode)||'list';document.querySelectorAll('.ranking-view-btn').forEach(b=>b.classList.toggle('active',b.dataset.rankingView===vm));document.querySelectorAll('.ranking-exp-switch').forEach(b=>{if(b.dataset.expKey==='pct')b.classList.toggle('active',!!(S.ranking&&S.ranking.showPercentDiff));if(b.dataset.expKey==='cmp')b.classList.toggle('active',!!(S.ranking&&S.ranking.compareMode));const t=b.querySelector('.ranking-exp-switch-track');if(t)t.classList.toggle('active',b.classList.contains('active'))});const pg=document.querySelector('#panel-ranking .pagination-bar-wrap');if(pg)pg.style.display=vm==='podium'?'none':''}
function setRankingViewMode(mode){if(mode!=='list'&&mode!=='podium')return;if(S.ranking.viewMode===mode)return;S.ranking.viewMode=mode;syncRankingViewModeUi();const cur=S.ranking.mode==='characters'?'characters':'units';const payload=_rankingLastPayloadByMode[cur];if(payload)renderRankingList(payload);else void loadRankingList(mode==='podium'?1:(cur==='characters'?S.ranking.pageChar:S.ranking.pageUnit))}
function ensureRankingExperimentalState(){if(!S.ranking)return;S.ranking.showPercentDiff=!!S.ranking.showPercentDiff;S.ranking.compareMode=!!S.ranking.compareMode;if(S.ranking.compareBaseId==null)S.ranking.compareBaseId='';if(!Array.isArray(S.ranking.compareTargetIds))S.ranking.compareTargetIds=[]}
function toggleRankingPercentDiffMode(){ensureRankingExperimentalState();S.ranking.showPercentDiff=!S.ranking.showPercentDiff;syncRankingViewModeUi();const cur=S.ranking.mode==='characters'?'characters':'units';const payload=_rankingLastPayloadByMode[cur];if(payload)renderRankingList(payload)}
function toggleRankingCompareMode(){ensureRankingExperimentalState();S.ranking.compareMode=!S.ranking.compareMode;if(!S.ranking.compareMode)clearRankingCompareSelections();syncRankingViewModeUi();const cur=S.ranking.mode==='characters'?'characters':'units';const payload=_rankingLastPayloadByMode[cur];if(payload)renderRankingList(payload)}
function rankingTailMobileRelocationActive(){try{return typeof window.matchMedia==='function'&&window.matchMedia('(max-width:768px)').matches}catch(_){return(typeof window.innerWidth==='number'&&window.innerWidth<=768)}}
function syncRankingTailControlsPlacement(){const panel=document.getElementById('panel-ranking');if(!panel)return;if(S.currentTab!=='ranking')return;const row=document.querySelector('#panel-ranking .ranking-sort-row');if(!row)return;const tails=[...panel.querySelectorAll('.ranking-tail-controls')];let tail=tails.find(el=>el.querySelector('.ranking-exp-controls'))||tails[0];tails.forEach(el=>{if(el!==tail)el.remove()});if(!tail)return;const mode=S.ranking&&S.ranking.mode;const mobile=rankingTailMobileRelocationActive();const unitsHost=document.getElementById('rankUnitListStatToggles');const charsHost=document.getElementById('rankCharListStatToggles');const browseUnits=document.querySelector('#rankingUnitToolbarHost .list-toolbar-left--browse');const browseChars=document.querySelector('#rankingCharToolbarHost .list-toolbar-left--browse');let target=null;if(mode==='units')target=mobile?unitsHost:browseUnits;else if(mode==='characters')target=mobile?charsHost:browseChars;if(target)target.appendChild(tail);else row.appendChild(tail)}
function rankingListUrlFor(mode,sortKey,page,perPage,dir,detailStatPerspective,rankingBulk){const p=Math.max(1,Number(page)||1),pp=Math.max(1,Number(perPage)||5),dv=(dir==='asc'?'asc':'desc');const o=detailStatPerspective?{detailStatPerspective:true}:undefined;const base=mode==='characters'?buildRankingCharactersListUrl(p,pp,o):buildRankingUnitsListUrl(p,pp,o);const u=new URL(base,location.origin);u.searchParams.set('sort',String(sortKey||''));u.searchParams.set('dir',dv);u.searchParams.set('page',String(p));if(rankingBulk){u.searchParams.set('ranking_bulk','1');u.searchParams.set('per_page',String(Math.min(50000,Math.max(pp,5000))))}else{u.searchParams.set('per_page',String(pp))}return u.pathname+u.search}
function rankingPodiumCacheKey(){return`${S.lang}:${S.ranking.mode}:${detailRankingPerspectiveKey(S.ranking.mode==='characters'?'character':'unit')}:${(document.getElementById('rankCharFilter')||{}).value||''}:${(document.getElementById('rankUnitFilter')||{}).value||''}:${JSON.stringify([S.listRankCharLineage,S.listRankCharSeries,S.listRankCharSkills,S.listRankCharAbilities,S.listRankUnitLineage,S.listRankUnitSeries,S.listRankUnitAbilities,S.listRankUnitTerrain,S.listRankUnitWeaponDebuff,S.listRankUnitWeaponRange,S.listRankUnitMechanism,S.listRankCharSource,S.listRankUnitSource,S.listRankCharSp,S.listRankCharCond,S.listRankUnitSp,S.listRankUnitSsp,S.listRankUnitCond])}`}
async function fetchRankingPodiumData(mode){const key=rankingPodiumCacheKey();if(_rankingPodiumCache.has(key))return _rankingPodiumCache.get(key);const stats=(mode==='characters'?RANK_SORT_KEYS_CHAR:RANK_SORT_KEYS_UNIT).slice();const out={};await Promise.all(stats.map(async sk=>{try{const r=await fetch(rankingListUrlFor(mode,sk,1,5,'desc'));if(!r.ok){out[sk]={rows:[],total:0,sort:sk,page:1,per_page:5,stat_bounds:null};return}const d=await r.json();out[sk]={rows:Array.isArray(d&&d.rows)?d.rows.slice(0,5):[],total:Number(d&&d.total||0),sort:sk,page:1,per_page:5,stat_bounds:d&&d.stat_bounds||null}}catch(_){out[sk]={rows:[],total:0,sort:sk,page:1,per_page:5,stat_bounds:null}}}));const hasAny=Object.values(out).some(v=>v&&Array.isArray(v.rows)&&v.rows.length>0);if(hasAny){_rankingPodiumCache.set(key,out);while(_rankingPodiumCache.size>24){const k=_rankingPodiumCache.keys().next().value;_rankingPodiumCache.delete(k)}}return out}
function setRankingMode(mode){if(mode!=='characters'&&mode!=='units')return;if(S.ranking.mode===mode)return;S.ranking.mode=mode;document.querySelectorAll('.ranking-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.rankingMode===mode));const ch=document.getElementById('rankingCharToolbarHost'),un=document.getElementById('rankingUnitToolbarHost');if(ch)ch.style.display=mode==='characters'?'block':'none';if(un)un.style.display=mode==='units'?'block':'none';renderRankingStatPills();syncRankListStatToggleUi();if(document.getElementById('searchSpotlightOverlay')&&document.getElementById('searchSpotlightOverlay').classList.contains('active')){const inp=document.getElementById('searchSpotlightInput');if(inp)inp.placeholder=t(getTabSearchPlaceholderKey());debounceSpotlightResults()}void loadRankingList(1)}
function renderRankingStatPills(){const host=document.getElementById('rankingStatPills');if(!host)return;const mode=S.ranking.mode;const sort=mode==='characters'?S.ranking.sortChar:S.ranking.sortUnit;const keys=rankingSortKeys();host.innerHTML=keys.map(k=>`<button type="button" class="ranking-stat-pill${k===sort?' active':''}" data-rank-stat="${escAttr(k)}" onclick="setRankingSortKey('${escJs(k)}')">${esc(tStat(k,mode==='characters'?'character':'unit'))}</button>`).join('');const db=document.getElementById('rankingDirBtn');if(db){const d=mode==='characters'?S.ranking.dirChar:S.ranking.dirUnit;const isDesc=d==='desc';const ic=isDesc?'/static/images/UI/UI_Common_BtnIcon_Order_Down.webp':'/static/images/UI/UI_Common_BtnIcon_Order_UP.webp';db.innerHTML=`<img class="ranking-dir-icon" src="${imgUrl(ic)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`;db.title=isDesc?t('sort_desc'):t('sort_asc');db.setAttribute('aria-label',isDesc?t('sort_desc'):t('sort_asc'))}syncRankingViewModeUi()}
function setRankingSortKey(k){const keys=rankingSortKeys();if(!keys.includes(k))return;const mode=S.ranking.mode;if(mode==='characters')S.ranking.sortChar=k;else S.ranking.sortUnit=k;renderRankingStatPills();scheduleRankingListReload()}
function toggleRankingSortDir(){const mode=S.ranking.mode;if(mode==='characters')S.ranking.dirChar=S.ranking.dirChar==='desc'?'asc':'desc';else S.ranking.dirUnit=S.ranking.dirUnit==='desc'?'asc':'desc';renderRankingStatPills();scheduleRankingListReload()}
function syncRankListStatToggleUi(){const cs=document.getElementById('rankCharListSpBtn'),cc=document.getElementById('rankCharListCondBtn'),us=document.getElementById('rankUnitListSpBtn'),ux=document.getElementById('rankUnitListSspBtn'),uc=document.getElementById('rankUnitListCondBtn');if(cs)cs.classList.toggle('active',!!S.listRankCharSp);if(cc){cc.classList.toggle('active',!!S.listRankCharCond);cc.title=t('conditional_passive')}if(us)us.classList.toggle('active',!!S.listRankUnitSp);if(ux)ux.classList.toggle('active',!!S.listRankUnitSsp);if(uc){uc.classList.toggle('active',!!S.listRankUnitCond);uc.title=t('conditional_passive')}}
function toggleRankListCharSp(){S.listRankCharSp=!S.listRankCharSp;syncRankListStatToggleUi();scheduleRankingListReload()}
function toggleRankListCharCond(){S.listRankCharCond=!S.listRankCharCond;syncRankListStatToggleUi();scheduleRankingListReload()}
function toggleRankListUnitSp(){if(S.listRankUnitSp){S.listRankUnitSp=false}else{S.listRankUnitSp=true;S.listRankUnitSsp=false}syncRankListStatToggleUi();scheduleRankingListReload()}
function toggleRankListUnitSsp(){if(S.listRankUnitSsp){S.listRankUnitSsp=false}else{S.listRankUnitSsp=true;S.listRankUnitSp=false}syncRankListStatToggleUi();scheduleRankingListReload()}
function toggleRankListUnitCond(){S.listRankUnitCond=!S.listRankUnitCond;syncRankListStatToggleUi();scheduleRankingListReload()}
function rankingDetailOptsFromContext(type){const o={viewRanking:true,detailVariant:'rk'};if(type==='character'){o.listCharSpPerspective=!!S.listRankCharSp;o.listCharCondPerspective=!!S.listRankCharCond;return o}o.listUnitSpPerspective=!!S.listRankUnitSp;o.listUnitSspPerspective=!!S.listRankUnitSsp;o.listUnitCondPerspective=!!S.listRankUnitCond;return o}
const _detailRankingStatsCache=new Map();
const _detailRankingStatsInflight=new Map();
function detailRankingPerspectiveKey(type){if(type==='character')return `${S.spActive?'sp':'normal'}:${S.conditionalPassiveActive?'cond':'nocond'}`;const sm=S.sspActive?'ssp':(S.spActive?'sp':'normal');return `${sm}:${S.conditionalPassiveActive?'cond':'nocond'}`}
function detailRankingSortKeyForStat(type,statName){const n=String(statName||'');if(type==='character'){const m={Ranged:'Ranged',Melee:'Melee',Awaken:'Awaken',Defense:'Defense',DEFENSE:'Defense',Reaction:'Reaction'};return m[n]||''}const m={HP:'HP',EN:'EN',Attack:'ATK',ATK:'ATK',Defense:'DEF',DEFENSE:'DEF',DEF:'DEF',Mobility:'MOB',MOBILITY:'MOB',MOB:'MOB'};return m[n]||''}
function detailRankingCacheKey(type,id){return`${type}:${String(id)}:${S.lang}:${detailRankingPerspectiveKey(type)}`}
function seedDetailRankingFromLastPayload(type,id,ck){try{const mode=type==='character'?'characters':'units';const p=_rankingLastPayloadByMode&&_rankingLastPayloadByMode[mode];if(!p||!Array.isArray(p.rows)||!p.rows.length)return;const sk=String(p.sort||'');if(!sk)return;const iid=String(id);const idx=p.rows.findIndex(x=>String(x&&x.id||'')===iid);if(idx<0)return;const cur=_detailRankingStatsCache.get(ck)||{};if(cur[sk])return;cur[sk]={rank:((Number(p.page)||1)-1)*(Number(p.per_page)||50)+idx+1,total:Number(p.total||0),value:Number(p.rows[idx]&&p.rows[idx][sk]||0),bounds:p.stat_bounds||null};_detailRankingStatsCache.set(ck,cur)}catch(_){}}
function refreshDetailRankingIfActive(type,id){try{if(S.currentDetailType===type&&S.currentDetailData&&String(S.currentDetailData.id)===String(id))updateDetailDynamicSections(type)}catch(_){}}
function invalidateDetailRankingCachesForPerspectiveChange(){const t=S.currentDetailType,d=S.currentDetailData;if((t!=='character'&&t!=='unit')||!d||!d.id)return;const pfx=`${t}:${String(d.id)}:`;for(const k of [..._detailRankingStatsCache.keys()]){if(String(k).startsWith(pfx))_detailRankingStatsCache.delete(k)}try{_detailRankingIndexCache.clear()}catch(_){}}
function detailRankingMetaFor(type,id,statName){const sk=detailRankingSortKeyForStat(type,statName);if(!sk)return null;const byStat=_detailRankingStatsCache.get(detailRankingCacheKey(type,id));return(byStat&&byStat[sk])||null}
function detailRankingBarWidth(meta){if(!meta||!meta.total||!meta.rank)return 0;return Math.max(2,Math.min(100,((meta.total-meta.rank+1)/meta.total)*100))}
function ordinalSuffixEn(n){const v=Math.abs(Number(n)||0);const mod100=v%100;if(mod100>=11&&mod100<=13)return'th';switch(v%10){case 1:return'st';case 2:return'nd';case 3:return'rd';default:return'th'}}
function detailRankingPosText(meta){if(!meta||!meta.rank||!meta.total)return'-';const rk=Number(meta.rank)||0,tt=Number(meta.total)||0;if(S.lang==='EN')return`${rk}${ordinalSuffixEn(rk)}/${tt}`;return`${fmtN(rk)}位/${fmtN(tt)}`}
function detailRecommendOptsForType(type){const o={viewRanking:true,detailVariant:'rk'};if(type==='character'){o.listCharSpPerspective=!!S.spActive;o.listCharCondPerspective=!!S.conditionalPassiveActive;return o}o.listUnitSpPerspective=!!S.spActive;o.listUnitSspPerspective=!!S.sspActive;o.listUnitCondPerspective=!!S.conditionalPassiveActive;return o}
function openDetailFromRecommend(type,id,viewRanking){if(viewRanking){const o=detailRecommendOptsForType(type);void ensureDetailRankingStats(type,String(id)).catch(()=>{});openDetail(type,String(id),o);return}openDetail(type,String(id))}
function buildRankingCharactersListUrl(p,pp,opts){const sort=S.ranking.sortChar,dir=S.ranking.dirChar;const q=document.getElementById('rankCharFilter').value.trim();const roleQ=getRoleQuerySuffix('rankChar');const rq=getRarityQuerySuffix('rankChar');const useDp=opts&&opts.detailStatPerspective;const stQ=listStatQChar(useDp?!!S.spActive:!!S.listRankCharSp,useDp?!!S.conditionalPassiveActive:!!S.listRankCharCond);const srcQ=(cur=>{if(!cur||cur==='ALL')return '';return '&source='+encodeURIComponent(cur)})(S.listRankCharSource||'ALL');const linQ=(()=>{let sel=S.listRankCharLineage;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&lineage_id='+encodeURIComponent(sel.join(','))})();const linOp=(()=>{let sel=S.listRankCharLineage;if(!Array.isArray(sel)||sel.length<2)return '';return '&lineage_op='+encodeURIComponent(S.browseCombRankCharLineage==='or'?'or':'and')})();const serQ=(()=>{let sel=S.listRankCharSeries;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}if(!sel.length)return '';return '&series_id='+encodeURIComponent(sel.join(','))})();const serOp=(()=>{let sel=S.listRankCharSeries;if(!Array.isArray(sel)||sel.length<2)return '';return '&series_op='+encodeURIComponent(S.browseCombRankCharSeries==='and'?'and':'or')})();const skillQ=(()=>{let sel=S.listRankCharSkills;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&skill_id='+encodeURIComponent(sel.join(','))})();const skOp=(()=>{let sel=S.listRankCharSkills;if(!Array.isArray(sel)||sel.length<2)return '';return '&skill_op='+encodeURIComponent(S.browseCombRankCharSkill==='or'?'or':'and')})();const abilQ=(()=>{let sel=S.listRankCharAbilities;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&ability_id='+encodeURIComponent(sel.join(','))})();const traitOp=(()=>{let sel=S.listRankCharAbilities;if(!Array.isArray(sel)||sel.length<2)return '';return '&ability_op='+encodeURIComponent(S.browseCombRankCharTrait==='or'?'or':'and')})();return`/api/characters?lang=${S.lang}&page=${p}&per_page=${pp}&sort=${encodeURIComponent(sort)}&dir=${dir}&stat_bounds=1&q=${encodeURIComponent(q)}${roleQ}${rq}${stQ}${srcQ}${linQ}${linOp}${serQ}${serOp}${skillQ}${skOp}${abilQ}${traitOp}`}
function buildRankingUnitsListUrl(p,pp,opts){const sort=S.ranking.sortUnit,dir=S.ranking.dirUnit;const qRaw=document.getElementById('rankUnitFilter').value.trim();const qApi=expandUnitSearchQuery(qRaw);const roleQ=getRoleQuerySuffix('rankUnit');const rq=getRarityQuerySuffix('rankUnit');const useDp=opts&&opts.detailStatPerspective;const stQ=listStatQUnit(useDp?!!S.spActive:!!S.listRankUnitSp,useDp?!!S.sspActive:!!S.listRankUnitSsp,useDp?!!S.conditionalPassiveActive:!!S.listRankUnitCond);const srcQ=(cur=>{if(!cur||cur==='ALL')return '';return '&source='+encodeURIComponent(cur)})(S.listRankUnitSource||'ALL');const terrQ=(()=>{let sel=S.listRankUnitTerrain;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&terrain='+encodeURIComponent(sel.join(','))})();const terrOp=(()=>{let sel=S.listRankUnitTerrain;if(!Array.isArray(sel)||sel.length<2)return '';return '&terrain_op='+encodeURIComponent(S.browseCombRankTerrain==='or'?'or':'and')})();const debQ=(()=>{let sel=S.listRankUnitWeaponDebuff;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&weapon_debuff='+encodeURIComponent(sel.join(','))})();const debOp=(()=>{let sel=S.listRankUnitWeaponDebuff;if(!Array.isArray(sel)||sel.length<2)return '';return '&weapon_debuff_op='+encodeURIComponent(S.browseCombRankWb==='or'?'or':'and')})();const wrQ=(()=>{let sel=S.listRankUnitWeaponRange;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&weapon_range='+encodeURIComponent(sel.join(','))})();const mechQ=(()=>{let sel=S.listRankUnitMechanism;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&mechanism='+encodeURIComponent(sel.join(','))})();const mechOp=(()=>{let sel=S.listRankUnitMechanism;if(!Array.isArray(sel)||sel.length<2)return '';return '&mechanism_op='+encodeURIComponent(S.browseCombRankMech==='or'?'or':'and')})();const linQ=(()=>{let sel=S.listRankUnitLineage;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&lineage_id='+encodeURIComponent(sel.join(','))})();const linOp=(()=>{let sel=S.listRankUnitLineage;if(!Array.isArray(sel)||sel.length<2)return '';return '&lineage_op='+encodeURIComponent(S.browseCombRankUnitLineage==='or'?'or':'and')})();const serQ=(()=>{let sel=S.listRankUnitSeries;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}if(!sel.length)return '';return '&series_id='+encodeURIComponent(sel.join(','))})();const serOp=(()=>{let sel=S.listRankUnitSeries;if(!Array.isArray(sel)||sel.length<2)return '';return '&series_op='+encodeURIComponent(S.browseCombRankUnitSeries==='and'?'and':'or')})();const abQ=(()=>{let sel=S.listRankUnitAbilities;if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&ability_id='+encodeURIComponent(sel.join(','))})();const abOp=(()=>{let sel=S.listRankUnitAbilities;if(!Array.isArray(sel)||sel.length<2)return '';return '&ability_op='+encodeURIComponent(S.browseCombRankUnitAbil==='or'?'or':'and')})();return`/api/units?lang=${S.lang}&page=${p}&per_page=${pp}&sort=${encodeURIComponent(sort)}&dir=${dir}&stat_bounds=1&q=${encodeURIComponent(qApi)}${roleQ}${rq}${stQ}${srcQ}${terrQ}${terrOp}${debQ}${debOp}${wrQ}${mechQ}${mechOp}${linQ}${linOp}${serQ}${serOp}${abQ}${abOp}`}
function renderRankingRowBar(val,bounds){if(!bounds||bounds.min==null||bounds.max==null||bounds.max===bounds.min)return'<span class="ranking-bar-track"><span class="ranking-bar-fill" style="width:50%"></span></span>';const v=Math.max(bounds.min,Math.min(bounds.max,Number(val)||0));const w=100*(v-bounds.min)/(bounds.max-bounds.min);return`<span class="ranking-bar-track"><span class="ranking-bar-fill" style="width:${w.toFixed(2)}%"></span></span>`}
function renderRankingList(d){const rows=d.rows||[];const bounds=d.stat_bounds;const sortKey=(d.sort||'');const host=document.getElementById('rankListInner');const empty=document.getElementById('rankEmpty');const load=document.getElementById('rankLoading');if(load)load.style.display='none';if(!host)return;if(!rows.length){host.innerHTML='';if(empty){empty.style.display='block';empty.querySelector('.empty-state-text').textContent=S.ranking.mode==='characters'?t('empty_char'):t('empty_unit')}return}if(empty)empty.style.display='none';const isChar=S.ranking.mode==='characters';const vm=(S.ranking&&S.ranking.viewMode)||'list';const typ=isChar?'character':'unit';if(vm==='bar'){const lim=rankingBarLimit();const topRows=rows.slice(0,lim);const vals=topRows.map(r=>Number(r&&r[sortKey]||0));const mx=Math.max(1,...vals);host.classList.add('ranking-list-inner--bar');host.innerHTML=`<div class="ranking-bar-board">${topRows.map((row,idx)=>{const rank=(d.page-1)*(d.per_page||50)+idx+1;const val=Number(row&&row[sortKey]||0);const h=Math.max(2,Math.min(100,(val/mx)*100));const ro=rankingDetailOptsFromContext(typ);const oj=encodeURIComponent(JSON.stringify(ro));const thumb=renderListThumb(row,isChar?'char':'unit',56);return`<button type="button" class="ranking-bar-col" data-detail-type="${typ}" data-detail-id="${escAttr(String(row.id))}" data-detail-opts="${oj}" onclick="openDetailFromRanking(this)"><div class="ranking-bar-val">${fmtN(val)}</div><div class="ranking-bar-rail"><span class="ranking-bar-col-fill" style="height:${h.toFixed(2)}%"></span></div><div class="ranking-bar-thumb">${thumb}</div><div class="ranking-bar-rank">#${rank}</div></button>`}).join('')}</div>`}else{host.classList.remove('ranking-list-inner--bar');let h='';rows.forEach((row,idx)=>{const rank=(d.page-1)*(d.per_page||50)+idx+1;const val=row[sortKey];const valStr=fmtN(val);const thumb=renderListThumb(row,isChar?'char':'unit',56);const name=esc(row.name||'');const ro=rankingDetailOptsFromContext(typ);const oj=encodeURIComponent(JSON.stringify(ro));h+=`<button type="button" class="ranking-row" data-detail-type="${typ}" data-detail-id="${escAttr(String(row.id))}" data-detail-opts="${oj}" onclick="openDetailFromRanking(this)"><span class="ranking-rank-num">#${rank}</span><span class="ranking-row-thumb">${thumb}</span><span class="ranking-row-name">${name}</span><span class="ranking-row-stat"><span class="ranking-stat-val">${valStr}</span>${renderRankingRowBar(val,bounds)}</span></button>`});host.innerHTML=h}renderPag('rank',d);const pp=document.getElementById('rankPerPage');if(pp){const v=String(d.per_page||50);if([...pp.options].some(o=>o.value===v))pp.value=v}const tc=document.getElementById('rankCharToolbarCount'),tu=document.getElementById('rankUnitToolbarCount');const cnt=`<span class="result-count-num">${d.total}</span> ${isChar?t('count_char'):t('count_unit')}`;if(tc)tc.innerHTML=isChar?cnt:'';if(tu)tu.innerHTML=isChar?'':cnt;syncRankingViewModeUi()}
function openDetailFromRanking(btn){const typ=btn&&btn.getAttribute('data-detail-type');const id=btn&&btn.getAttribute('data-detail-id');const raw=btn&&btn.getAttribute('data-detail-opts');let o={viewRanking:true,detailVariant:'rk'};try{if(raw)o=JSON.parse(decodeURIComponent(raw))}catch(_){}void ensureDetailRankingStats(typ,String(id)).catch(()=>{});openDetail(typ,id,o)}
async function loadRankingList(p=1){if(S.currentTab!=='ranking')return;p=Number(p)||1;const mode=S.ranking.mode;if(mode==='units'){syncUnitListSspForWeaponEffectFilters();syncUnitListSspForWeaponRangeFilters()}if(S.ranking&&S.ranking.viewMode==='bar')p=1;const ppEl=document.getElementById('rankPerPage');const pp=ppEl?parseInt(ppEl.value,10)||50:50;if(mode==='characters')S.ranking.pageChar=p;else S.ranking.pageUnit=p;const url=mode==='characters'?buildRankingCharactersListUrl(p,pp):buildRankingUnitsListUrl(p,pp);const load=document.getElementById('rankLoading');const host=document.getElementById('rankListInner');if(load)load.style.display='flex';if(host)host.innerHTML='';try{const r=await fetch(url);const d=await r.json();_rankingLastPayloadByMode[mode==='characters'?'characters':'units']=d;if(mode==='units'){applyWeaponDebuffPresentFromApi(d);applyMechanismPresentFromApi(d)}renderRankingList(d)}catch(e){if(load)load.style.display='none';if(host)host.innerHTML=`<div class="empty-state"><div class="empty-state-text">${esc(String(e))}</div></div>`}}
function clearRankingBrowseFilters(which){if(which==='rankChar'){S.listRankCharSource='ALL';S.listRankCharLineage=[];S.listRankCharSeries=[];S.listRankCharSkills=[];S.listRankCharAbilities=[];S.listRankCharSp=false;S.listRankCharCond=false;S.browseCombRankCharLineage='and';S.browseCombRankCharSeries='or';S.browseCombRankCharSkill='and';S.browseCombRankCharTrait='and';const qEl=document.getElementById('rankCharFilter');if(qEl){qEl.value='';updateSearchHintVisibility('rankCharFilter');syncBrowseSearchWidth('rankCharFilter')}const rp=rarityPrefix('rankChar');const ltEl=document.getElementById(rp+'RarityLT');rarityKeysFor('rankChar').forEach(k=>{const el=document.getElementById(rp+'Rarity'+k);if(el)el.checked=true});if(ltEl)ltEl.checked=true;ROLE_LIST_IDS.forEach(id=>{const el=document.getElementById('rankCharRole'+id);if(el)el.checked=true});fillSourcePanel('rankChar');syncLineageCheckboxes('rankChar');syncSeriesCheckboxes('rankChar');syncSkillBrowseCheckboxes('rankChar');syncAbilBrowseCheckboxes('rankChar');updateRarityFilterButtonLabel('rankChar');updateRoleFilterButtonLabel('rankChar');updateSourceFilterButtonLabel('rankChar');updateLineageFilterButtonLabel('rankChar');updateSeriesFilterButtonLabel('rankChar');updateSkillBrowseFilterLabel('rankChar');updateAbilBrowseFilterLabel('rankChar');syncRankListStatToggleUi();closeAllFilterPanels();invalidateRankingBrowseFilterPanels()}else{S.listRankUnitSource='ALL';S.listRankUnitLineage=[];S.listRankUnitSeries=[];S.listRankUnitAbilities=[];S.listRankUnitTerrain=[];S.listRankUnitWeaponDebuff=[];S.listRankUnitWeaponRange=[];S.listRankUnitMechanism=[];S.listRankUnitSp=false;S.listRankUnitSsp=false;S.listRankUnitCond=false;S._rankUnitWeaponRangeSspAutoArmed=false;S.browseCombRankUnitLineage='and';S.browseCombRankUnitSeries='or';S.browseCombRankUnitAbil='and';S.browseCombRankTerrain='and';S.browseCombRankWb='and';S.browseCombRankWr='and';S.browseCombRankMech='and';const qEl=document.getElementById('rankUnitFilter');if(qEl){qEl.value='';updateSearchHintVisibility('rankUnitFilter');syncBrowseSearchWidth('rankUnitFilter')}const rp=rarityPrefix('rankUnit');const ltEl=document.getElementById(rp+'RarityLT');rarityKeysFor('rankUnit').forEach(k=>{const el=document.getElementById(rp+'Rarity'+k);if(el)el.checked=true});if(ltEl)ltEl.checked=true;ROLE_LIST_IDS.forEach(id=>{const el=document.getElementById('rankUnitRole'+id);if(el)el.checked=true});fillSourcePanel('rankUnit');syncLineageCheckboxes('rankUnit');syncSeriesCheckboxes('rankUnit');syncSkillBrowseCheckboxes('rankUnit');const b=document.getElementById('rankUnitTerrainFilterBody');if(b)b.innerHTML=buildUnitTerrainFilterHtml();syncUnitWeaponDebuffCheckboxes();syncUnitWeaponRangeCheckboxes();syncUnitMechanismCheckboxes();updateRarityFilterButtonLabel('rankUnit');updateRoleFilterButtonLabel('rankUnit');updateSourceFilterButtonLabel('rankUnit');updateLineageFilterButtonLabel('rankUnit');updateSeriesFilterButtonLabel('rankUnit');updateSkillBrowseFilterLabel('rankUnit');updateUnitTerrainFilterLabel();updateUnitWeaponDebuffFilterLabel();updateUnitWeaponRangeFilterLabel();updateUnitMechanismFilterLabel();updateLineageFilterButtonLabel('rankUnit');syncRankListStatToggleUi();closeAllFilterPanels();invalidateRankingBrowseFilterPanels()}void loadRankingList(1)}
function refreshRankingFilterLabels(){updateRarityFilterButtonLabel('rankChar');updateRoleFilterButtonLabel('rankChar');updateSourceFilterButtonLabel('rankChar');updateLineageFilterButtonLabel('rankChar');updateSeriesFilterButtonLabel('rankChar');updateSkillBrowseFilterLabel('rankChar');updateAbilBrowseFilterLabel('rankChar');updateRarityFilterButtonLabel('rankUnit');updateRoleFilterButtonLabel('rankUnit');updateSourceFilterButtonLabel('rankUnit');updateLineageFilterButtonLabel('rankUnit');updateSeriesFilterButtonLabel('rankUnit');updateSkillBrowseFilterLabel('rankUnit');updateUnitTerrainFilterLabel();updateUnitWeaponDebuffFilterLabel();updateUnitWeaponRangeFilterLabel();updateUnitMechanismFilterLabel();fillSourcePanel('rankChar');fillSourcePanel('rankUnit');syncRankListStatToggleUi()}
function ensureRankUnitWeaponRangeFilterDom(){const host=document.getElementById('rankingUnitToolbarHost');if(!host)return;const debWrap=document.getElementById('rankUnitWeaponDebuffWrap');if(!debWrap)return;if(document.getElementById('rankUnitWeaponRangeWrap'))return;const clone=debWrap.cloneNode(true);clone.id='rankUnitWeaponRangeWrap';const btn=clone.querySelector('#rankUnitWeaponDebuffFilterBtn');if(btn){btn.id='rankUnitWeaponRangeFilterBtn';btn.setAttribute('onclick','toggleUnitWeaponRangePanel(event)');btn.setAttribute('title',weaponRangeFilterName());btn.setAttribute('aria-expanded','false')}const lbl=clone.querySelector('#rankUnitWeaponDebuffFilterLabel');if(lbl){lbl.id='rankUnitWeaponRangeFilterLabel';lbl.innerHTML=`<span class="source-filter-btn-plain">${esc(weaponRangeAllText())}</span>`}const panel=clone.querySelector('#rankUnitWeaponDebuffFilterPanel');if(panel){panel.id='rankUnitWeaponRangeFilterPanel';panel.hidden=true}const body=clone.querySelector('#rankUnitWeaponDebuffFilterBody');if(body){body.id='rankUnitWeaponRangeFilterBody';body.innerHTML=''}debWrap.insertAdjacentElement('afterend',clone);updateUnitWeaponRangeFilterLabel('rankUnit')}
function ensureUnitWeaponRangeFilterDom(){const host=document.getElementById('panel-units');if(!host)return;const debWrap=document.getElementById('unitWeaponDebuffWrap');if(!debWrap)return;if(document.getElementById('unitWeaponRangeWrap'))return;const clone=debWrap.cloneNode(true);clone.id='unitWeaponRangeWrap';const btn=clone.querySelector('#unitWeaponDebuffFilterBtn');if(btn){btn.id='unitWeaponRangeFilterBtn';btn.setAttribute('onclick','toggleUnitWeaponRangePanel(event)');btn.setAttribute('title',weaponRangeFilterName());btn.setAttribute('aria-expanded','false')}const lbl=clone.querySelector('#unitWeaponDebuffFilterLabel');if(lbl){lbl.id='unitWeaponRangeFilterLabel';lbl.innerHTML=`<span class="source-filter-btn-plain">${esc(weaponRangeAllText())}</span>`}const panel=clone.querySelector('#unitWeaponDebuffFilterPanel');if(panel){panel.id='unitWeaponRangeFilterPanel';panel.hidden=true}const body=clone.querySelector('#unitWeaponDebuffFilterBody');if(body){body.id='unitWeaponRangeFilterBody';body.innerHTML=''}debWrap.insertAdjacentElement('afterend',clone);updateUnitWeaponRangeFilterLabel('unit')}
function onRankingTabShown(){document.querySelectorAll('.ranking-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.rankingMode===S.ranking.mode));const ch=document.getElementById('rankingCharToolbarHost'),un=document.getElementById('rankingUnitToolbarHost');if(ch)ch.style.display=S.ranking.mode==='characters'?'block':'none';if(un)un.style.display=S.ranking.mode==='units'?'block':'none';if(S.ranking.mode==='units')ensureRankUnitWeaponRangeFilterDom();syncRankingFiltersFromBrowse();invalidateRankingBrowseFilterPanels();refreshRankingFilterLabels();renderRankingStatPills();syncRankListStatToggleUi();syncRankingViewModeUi();void loadRankingList(S.ranking.mode==='characters'?S.ranking.pageChar:S.ranking.pageUnit)}
function resetEphemeralBrowseFilterDomState(){['char','unit','rankChar','rankUnit'].forEach(which=>{const rp=rarityPrefix(which);rarityKeysFor(which).forEach(k=>{const el=document.getElementById(rp+'Rarity'+k);if(el)el.checked=true});const ltEl=document.getElementById(rp+'RarityLT');if(ltEl)ltEl.checked=true;const rpf=rolePrefix(which);ROLE_LIST_IDS.forEach(id=>{const el=document.getElementById(rpf+'Role'+id);if(el)el.checked=true})})}
document.addEventListener('DOMContentLoaded',async()=>{try{const _bsd=sessionStorage.getItem('ggen_bt_sort');if(_bsd==='asc'||_bsd==='desc')S.btBannerSortDir=_bsd}catch(_){}loadPersistedListView();loadPersistedListGridVariant();applyModEffectDropdownIcons();await loadLangs();loadPersistedListStatToggles();resetEphemeralBrowseFilterDomState();applyLang();['characters','units','supporters','stages','modifications'].forEach(t=>{syncListViewToggleUI(t);applyListViewVisibility(t)});syncGridVariantBadge('char');syncGridVariantBadge('unit');buildTableHeaders();initSearchHints();syncBrowseSearchWidths();let _bwResize;window.addEventListener('resize',()=>{clearTimeout(_bwResize);_bwResize=setTimeout(()=>{syncBrowseSearchWidths();syncRankingTailControlsPlacement()},120)});initSeriesIconNav();bindSearchRecallObserver();syncListCharToggle();syncListUnitStatToggles();syncListCondToggles();primeBrowseTabIfNeeded('characters');setupKeys();initBannerTimelineExtras();initCmpSafeArea();syncCmpMobilePickChrome();initDetailPrefetchIntentHandlers();wireTbPickerBodyClicks();wireStageMapNpcClicks();const _qs=new URLSearchParams(location.search);if(!urlTabParamBlocksBrowseShortPath(_qs.get('tab'))&&applyBrowseShortPathOnLoad()){}else{_dcCheckUrlParams();_tbCheckUrlParams();stagesOrModsTabFromQueryOnLoad()}});
const LANG_STORAGE_KEY='ggen_lang';
function readPersistedLang(){try{const s=localStorage.getItem(LANG_STORAGE_KEY);return s&&String(s).trim()||''}catch(e){return''}}
function persistLang(l){try{if(l)localStorage.setItem(LANG_STORAGE_KEY,String(l))}catch(e){}}
function syncUiLangDocumentAttr(){try{document.documentElement.setAttribute('data-ui-lang',(S.lang&&String(S.lang).trim())||'EN')}catch(_){}}
async function loadLangs(){try{const r=await fetch('/api/languages');const d=await r.json();S.languages=d.languages||['EN'];const def=d.default||'EN';const saved=readPersistedLang();S.lang=(saved&&S.languages.includes(saved))?saved:def}catch(e){S.languages=['EN'];const saved=readPersistedLang();S.lang=(saved&&S.languages.includes(saved))?saved:'EN'}finally{syncUiLangDocumentAttr();try{document.getElementById('langLabel').textContent=S.lang;renderLangDD()}catch(_){}}}
function renderLangDD(){document.getElementById('langDropdown').innerHTML=S.languages.map(l=>`<div class="lang-option ${l===S.lang?'selected':''}" onclick="selLang('${l}')">${l}</div>`).join('')}
function toggleLangDropdown(){document.getElementById('langDropdown').classList.toggle('active')}
async function ensureJpModeUnlockedForSwitch(l){const lc=(l||'').toUpperCase();if(lc!=='JP'&&lc!=='JA')return true;const msg="We apologize for the inconvenience.\nDue to unforeseen conflicts, the Japan version is currently locked.\nThank you for your understanding.";try{const st=await fetch('/api/jp_mode/status',{credentials:'same-origin'}).then(r=>r.json());if(!st||!st.password_required||st.unlocked)return true;alert(st.message||msg);const pw=window.prompt(t('jp_mode_unlock_prompt'));if(!pw)return false;const rr=await fetch('/api/jp_mode/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(!rr.ok){alert(t('jp_mode_unlock_wrong'));return false}return true}catch(_){alert(msg);return false}}
async function selLang(l){if(!(await ensureJpModeUnlockedForSwitch(l)))return;S.lang=l;persistLang(l);syncUiLangDocumentAttr();S.lrCacheKey=null;S.lrCacheData=null;S.btCacheKey=null;S.btCacheData=null;S._browseFilters=null;_dcStagesCache=null;_dcStagesFetchLang=null;S._browsePrimed={};invalidateBrowseFilterPanels();document.getElementById('langLabel').textContent=l;document.getElementById('langDropdown').classList.remove('active');renderLangDD();applyLang();buildTableHeaders();updateRoleFilterButtons();loadCharacters(1);loadUnits(1);loadSupporters(1);loadStages(1);loadModifications(1);S._browsePrimed={characters:1,units:1,supporters:1,stages:1,modifications:1};if(S.currentTab==='latest_release')tryLoadLatestRelease();if(S.currentTab==='banner_timeline')loadBannerTimeline();if(S.currentTab==='team_builder'){S._tbPickerRowCache=null;initTeamBuilder();void tbRefreshSlottedUnitData().then(async()=>{await tbAutoFillEmptyOptionParts({skipRender:true});renderTeamBuilder();setTimeout(tbPrimePickerCaches,0)})}if(document.getElementById('tagModal').classList.contains('active')){if(S._tagModalMode==='series')fetchAndRenderSeriesModal();else if(S._currentTagStr)fetchAndRenderTagModal()}if(S.currentTab==='calculator')await renderDcStageDropdown();if(S.currentTab==='ranking')onRankingTabShown()}
document.addEventListener('click',e=>{if(!e.target.closest('.dc-stage-dd-wrap'))_dcCloseDcStageDd();if(!e.target.closest('.lang-selector'))document.getElementById('langDropdown').classList.remove('active');if(!e.target.closest('.rarity-filter-wrap')&&!e.target.closest('.role-filter-wrap')&&!e.target.closest('.source-filter-wrap')&&!e.target.closest('.terrain-filter-wrap')&&!e.target.closest('.debuff-filter-wrap')&&!e.target.closest('.mechanism-filter-wrap')&&!e.target.closest('.lineage-filter-wrap')&&!e.target.closest('.series-filter-wrap')&&!e.target.closest('.skill-filter-wrap')&&!e.target.closest('.ability-filter-wrap')&&!e.target.closest('#stageDiffWrap'))closeAllFilterPanels()});
function fillLrLockTexts(){const t1=document.getElementById('lrLockTitleEl'),t2=document.getElementById('lrLockHintEl'),b=document.getElementById('lrUnlockBtn');if(t1)t1.textContent=t('lr_lock_title');if(t2)t2.textContent=t('lr_lock_hint');if(b)b.textContent=t('lr_unlock_btn')}
function setNavTabText(id,txt){const el=document.getElementById(id);if(!el)return;const sp=el.querySelector('.nav-tab-label');if(sp)sp.textContent=txt;else el.textContent=txt}
function applyLang(){updateListViewToggleLabels();setNavTabText('navCharTab',t('tab_char'));setNavTabText('navUnitTab',t('tab_unit'));setNavTabText('navSuppTab',t('tab_supporter'));setNavTabText('navStageTab',t('tab_stage'));setNavTabText('navModTab',t('tab_mod'));setNavTabText('navCalcTab',t('dc_title'));setNavTabText('navTbTab',t('tab_team_builder'));tbApplyLangStatic();const _dcPt=document.getElementById('dcPageTitle');if(_dcPt)_dcPt.textContent=t('dc_title');setNavTabText('navLatestTab',t('tab_latest'));setNavTabText('navBannerTimelineTab',t('tab_banner_timeline'));setNavTabText('navGameNewsTab',t('tab_game_news'));const _nrl=document.getElementById('navRankingTabLabel');if(_nrl)_nrl.textContent=t('tab_ranking');const _rmc=document.getElementById('rankModeCharLbl');if(_rmc)_rmc.textContent=t('tab_char');const _rmu=document.getElementById('rankModeUnitLbl');if(_rmu)_rmu.textContent=t('tab_unit');const _rke=document.getElementById('rankEmptyText');if(_rke)_rke.textContent=S.ranking&&S.ranking.mode==='characters'?t('empty_char'):t('empty_unit');document.querySelectorAll('.whats-new-btn-label').forEach(el=>{el.textContent=t('whats_new_btn')});document.querySelectorAll('.btn-whats-new').forEach(el=>{el.title=t('whats_new_btn')});document.querySelectorAll('.support-feedback-btn-label').forEach(el=>{el.textContent=t('support_feedback_btn')});document.querySelectorAll('.btn-support-feedback').forEach(el=>{el.title=t('support_feedback_btn')});const _apL=document.getElementById('alipayhkHeaderLabel');if(_apL)_apL.textContent=t('support_alipayhk_btn');const _apB=document.getElementById('alipayhkHeaderBtn');if(_apB){_apB.title=t('support_alipayhk_btn');_apB.setAttribute('aria-label',t('support_alipayhk_btn'))}const _kL=document.getElementById('kofiHeaderLabel');if(_kL)_kL.textContent=t('support_kofi_btn');const _kA=document.getElementById('kofiHeaderLink');if(_kA){_kA.setAttribute('aria-label',t('support_kofi_btn'));_kA.title=t('support_kofi_btn')}const _aho=document.getElementById('alipayhkOverlay');if(_aho&&_aho.classList.contains('active')){const _mt=document.getElementById('alipayhkModalTitle');if(_mt)_mt.textContent=t('support_alipayhk_modal_title');const _mh=document.getElementById('alipayhkModalHint');if(_mh)_mh.textContent=t('support_alipayhk_modal_hint');const _mq=document.getElementById('alipayhkModalQr');if(_mq)_mq.setAttribute('alt',t('support_alipayhk_modal_hint'));const _mcb=document.getElementById('alipayhkModalCloseBtn');if(_mcb)_mcb.setAttribute('aria-label',t('whats_new_close'))}const wnc=document.getElementById('whatsNewCloseBtn');if(wnc)wnc.setAttribute('aria-label',t('whats_new_close'));fillLrLockTexts();document.getElementById('tagTabChar').textContent=t('tab_char');document.getElementById('tagTabUnit').textContent=t('tab_unit');const _tagAff=document.getElementById('tagTabAffinity');if(_tagAff)_tagAff.textContent=t('tag_tab_affinity');document.getElementById('charFilter').placeholder=t('search_char');document.getElementById('unitFilter').placeholder=t('search_unit');document.getElementById('suppFilter').placeholder=t('search_supporter');document.getElementById('stageFilter').placeholder=t('search_stage');document.getElementById('modFilter').placeholder=t('search_mod');const _rkcf=document.getElementById('rankCharFilter');if(_rkcf)_rkcf.placeholder=t('search_char');const _rkuf=document.getElementById('rankUnitFilter');if(_rkuf)_rkuf.placeholder=t('search_unit');const stgWrap=document.getElementById('stageSourceToggleWrap');if(stgWrap)stgWrap.setAttribute('aria-label',t('stage_source_group_aria'));const se=document.getElementById('stageSourceEternalBtn');if(se)se.textContent=t('stage_source_eternal');const ssb=document.getElementById('stageSourceScoreBtn');if(ssb)ssb.textContent=t('stage_source_score');const ssp=document.getElementById('stageSourceSpecialBtn');if(ssp){const _ssl=t('stage_source_special');ssp.textContent=_ssl;ssp.title=_ssl;ssp.setAttribute('aria-label',_ssl)}const dpl=document.getElementById('dcDefPresetRadioLbl');if(dpl)dpl.textContent=t('dc_def_preset_mode');const dpt=document.getElementById('dcDefPresetTargetLbl');if(dpt)dpt.textContent=t('dc_def_preset_target_label');const _dcAph=document.getElementById('dcAtkPanelHeading');if(_dcAph)_dcAph.textContent=t('dc_panel_attacker_heading');const _dcDph=document.getElementById('dcDefPanelHeading');if(_dcDph)_dcDph.textContent=t('dc_panel_defender_heading');const _dcAps=document.getElementById('dcAtkParamsSectionLbl');if(_dcAps)_dcAps.textContent=t('dc_atk_params_section');const _dcDps=document.getElementById('dcDefParamsSectionLbl');if(_dcDps)_dcDps.textContent=t('dc_def_params_section');_dcApplyDcVigorButtonLabels();const dss=document.getElementById('dcStageSearch');if(dss){dss.placeholder=t('dc_stage_search_ph');dss.setAttribute('aria-label',t('dc_stage_search_ph'))}const dsl=document.getElementById('dcStageList');if(dsl)dsl.setAttribute('aria-label',t('dc_stage_list_aria'));const csfs=document.getElementById('charSkillFilterSearch'),usfs=document.getElementById('unitSkillFilterSearch'),cafs=document.getElementById('charAbilFilterSearch');const skPh=t('list_filter_search_placeholder');if(csfs)csfs.placeholder=skPh;if(usfs)usfs.placeholder=skPh;if(cafs)cafs.placeholder=skPh;const rcsfs=document.getElementById('rankCharSkillFilterSearch'),rusfs=document.getElementById('rankUnitSkillFilterSearch'),rcafs=document.getElementById('rankCharAbilFilterSearch');if(rcsfs)rcsfs.placeholder=skPh;if(rusfs)rusfs.placeholder=skPh;if(rcafs)rcafs.placeholder=skPh;document.querySelectorAll('.search-hint-popover').forEach(el=>{el.innerHTML=t('search_hint_html')});const srf=document.getElementById('searchRecallFab');if(srf){srf.title=t('search_recall');srf.setAttribute('aria-label',t('search_recall'))}const _btsf=document.getElementById('bannerTimelineScrollTopFab');if(_btsf){_btsf.title=t('bt_scroll_top');_btsf.setAttribute('aria-label',t('bt_scroll_top'))}const spi=document.getElementById('searchSpotlightInput');if(spi)spi.placeholder=t(getTabSearchPlaceholderKey());const stl=document.getElementById('searchSpotlightTitle');if(stl)stl.textContent=t('search_spotlight_title');const stb=document.getElementById('searchSpotlightTabLine');if(stb)stb.textContent=getTabNameForSpotlight();const shn=document.getElementById('searchSpotlightHint');if(shn)shn.innerHTML=t('search_hint_html');const sft=document.getElementById('searchSpotlightFoot');if(sft)sft.textContent=t('search_spotlight_foot');const scls=document.getElementById('searchSpotlightClose');if(scls)scls.setAttribute('aria-label',t('search_spotlight_close'));document.getElementById('charEmptyText').textContent=t('empty_char');document.getElementById('unitEmptyText').textContent=t('empty_unit');document.getElementById('suppEmptyText').textContent=t('empty_supporter');document.getElementById('stageEmptyText').textContent=t('empty_stage');document.getElementById('modEmptyText').textContent=t('empty_mod');const pp=t('per_page');['charPerPage','unitPerPage','suppPerPage','stagePerPage','modPerPage','rankPerPage'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=`<option value="25">25${pp}</option><option value="50" selected>50${pp}</option><option value="100">100${pp}</option>`});initToolbarFilterIcons();const _bfc=t('browse_filters_clear');['charBrowseFiltersClearBtn','unitBrowseFiltersClearBtn','rankCharBrowseFiltersClearBtn','rankUnitBrowseFiltersClearBtn'].forEach(id=>{const b=document.getElementById(id);if(b){b.textContent=_bfc;b.title=_bfc;b.setAttribute('aria-label',_bfc)}});syncListCharToggle();syncListUnitStatToggles();syncListCondToggles();const _wbPruneHk=pruneUnitWeaponDebuffSelectionForLocale();updateUnitTerrainFilterLabel();updateUnitWeaponDebuffFilterLabel();if(_wbPruneHk&&S.currentTab==='units')loadUnits(S.units.page||1);updateUnitMechanismFilterLabel();updateModEffectFilterLabel();fillModEffectPanel();ensureBrowseFiltersMeta().then(()=>{['char','unit','supp','rankChar','rankUnit'].forEach(p=>updateLineageFilterButtonLabel(p));['char','unit','rankChar','rankUnit'].forEach(p=>{updateSeriesFilterButtonLabel(p);updateSkillBrowseFilterLabel(p)});['char','rankChar'].forEach(p=>updateAbilBrowseFilterLabel(p))}).catch(()=>{});;if(document.getElementById('tagModal').classList.contains('active')){if(S._tagModalMode==='series')updateSeriesModalTitle();else if(S._currentTagStr)updateTagModalTitle()};syncBrowseSearchWidths();scheduleSyncListTheadStickyTop();refreshFilterFooterI18n();const _pdc=document.getElementById('panel-calculator');if(_pdc&&_pdc.classList.contains('active')){_dcUpdateExSquadAtkGroupVisibility();_dcUpdateSquadConditionGroupVisibility();_dcRefreshCalcDependentUi()}}
function updateRoleFilterButtons(){updateRoleFilterButtonLabel('char');updateRoleFilterButtonLabel('unit')}
const RARITY_LIST_KEYS=['UR','SSR','SR','R','N'];
const RARITY_FILTER_ICONS={ULT:'/static/images/UI/UI_Common_Icon_ULT.webp',UR:'/static/images/Rarity/UI_Common_RarityIcon_UR.webp',SSR:'/static/images/Rarity/UI_Common_RarityIcon_SSR.webp',SR:'/static/images/Rarity/UI_Common_RarityIcon_SR.webp',R:'/static/images/Rarity/UI_Common_RarityIcon_R.webp',N:'/static/images/Rarity/UI_Common_RarityIcon_N.webp'};
const ROLE_FILTER_ICONS={'1':'/static/images/UI/UI_Common_TypeIcon_Attack_M.webp','2':'/static/images/UI/UI_Common_TypeIcon_Defense_M.webp','3':'/static/images/UI/UI_Common_TypeIcon_Support_M.webp'};
const UNIT_SKILL_BROWSE_TOOLBAR_IC='/static/images/UI/UI_Common_TypeIcon_Melee_S.webp';
const SOURCE_FILTER_UI_ICONS={assembly:'/static/images/UI/UI_Common_Icon_Source_Gasha.webp',development:'/static/images/UI/UI_Common_BtnIcon_Map.webp',other:'/static/images/UI/UI_Common_Icon_Source_Event.webp'};
const UNIT_TERRAIN_FILTER_ITEMS=[['Space',2],['Space',3],['Atmospheric',2],['Atmospheric',3],['Ground',2],['Ground',3],['Sea',2],['Sea',3],['Underwater',2],['Underwater',3]];
const UNIT_TERRAIN_TYPE_ICONS={Space:'/static/images/Terrain/UI_Common_TerrainIcon_Space.webp',Atmospheric:'/static/images/Terrain/UI_Common_TerrainIcon_Sky.webp',Ground:'/static/images/Terrain/UI_Common_TerrainIcon_Ground.webp',Sea:'/static/images/Terrain/UI_Common_TerrainIcon_Aquatic.webp',Underwater:'/static/images/Terrain/UI_Common_TerrainIcon_Underwater.webp'};
const UNIT_TERRAIN_LEVEL_ICONS={1:'/static/images/Terrain/UI_Common_TerrainIcon_Hyphen.webp',2:'/static/images/Terrain/UI_Common_TerrainIcon_Triangle.webp',3:'/static/images/Terrain/UI_Common_TerrainIcon_Circle.webp'};
const UNIT_WEAPON_DEBUFF_DEFS=[{key:'atk_dn',labelKey:'unit_filter_wb_atk_dn'},{key:'def_dn',labelKey:'unit_filter_wb_def_dn'},{key:'enemy_def_atk',labelKey:'unit_filter_wb_enemy_def_atk'},{key:'mob_dn',labelKey:'unit_filter_wb_mob_dn'},{key:'acc_dn',labelKey:'unit_filter_wb_acc_dn'},{key:'dmg_phys',labelKey:'unit_filter_wb_dmg_phys'},{key:'dmg_beam',labelKey:'unit_filter_wb_dmg_beam'},{key:'dmg_spec',labelKey:'unit_filter_wb_dmg_spec'},{key:'wp_phys',labelKey:'unit_filter_wb_wp_phys'},{key:'wp_beam',labelKey:'unit_filter_wb_wp_beam'},{key:'wp_spec',labelKey:'unit_filter_wb_wp_spec'},{key:'range_beam',labelKey:'unit_filter_wb_range_beam'},{key:'range_phys',labelKey:'unit_filter_wb_range_phys'},{key:'range_6',labelKey:'unit_filter_wb_range_6'},{key:'mp_1',labelKey:'unit_filter_wb_mp_1'},{key:'preemptive',labelKey:'unit_filter_wb_preemptive'},{key:'map_weapon',labelKey:'unit_filter_wb_map_weapon'}];
function getUnitWeaponDebuffDefsForUi(){const defs=UNIT_WEAPON_DEBUFF_DEFS;const ok=S.weaponDebuffPresentKeys;if(ok===undefined||ok===null)return defs.slice();if(!Array.isArray(ok))return defs.slice();if(ok.length===0)return[];const allow=new Set(ok.map(String));return defs.filter(d=>allow.has(d.key))}
function pruneUnitWeaponDebuffSelectionForLocale(){const drop=new Set(['range_all','mp_2','mp_3','eva_dn']);function pr(k){const arr=Array.isArray(S[k])?S[k]:[];const next=arr.filter(x=>!drop.has(String(x)));if(next.length===arr.length)return false;S[k]=next;return true}const a=pr('listUnitWeaponDebuff'),b=pr('listRankUnitWeaponDebuff');if(!a&&!b)return false;['unit','rankUnit'].forEach(pfx=>{const body=document.getElementById(pfx+'WeaponDebuffFilterBody');if(body)body.innerHTML=buildUnitWeaponDebuffFilterHtml(pfx==='rankUnit'?'listRankUnitWeaponDebuff':'listUnitWeaponDebuff')});updateUnitWeaponDebuffFilterLabel('unit');updateUnitWeaponDebuffFilterLabel('rankUnit');return true}
function applyWeaponDebuffPresentFromApi(d){if(!d||!Object.prototype.hasOwnProperty.call(d,'weapon_debuff_present_keys'))return false;const keys=d.weapon_debuff_present_keys;if(!Array.isArray(keys))return false;S.weaponDebuffPresentKeys=keys;const allow=new Set(keys.map(String));const drop=new Set(['range_all','mp_2','mp_3','eva_dn']);function pruneKey(stateKey){let sel=Array.isArray(S[stateKey])?S[stateKey]:[];let pruned=sel.filter(k=>allow.has(String(k))).filter(k=>!drop.has(String(k)));const changed=pruned.length!==sel.length;if(changed)S[stateKey]=pruned;return changed}let changed=pruneKey('listUnitWeaponDebuff')||pruneKey('listRankUnitWeaponDebuff');['unit','rankUnit'].forEach(pfx=>{const body=document.getElementById(pfx+'WeaponDebuffFilterBody');if(body)body.innerHTML=buildUnitWeaponDebuffFilterHtml(pfx==='rankUnit'?'listRankUnitWeaponDebuff':'listUnitWeaponDebuff')});updateUnitWeaponDebuffFilterLabel('unit');updateUnitWeaponDebuffFilterLabel('rankUnit');syncUnitListSspForWeaponEffectFilters();return changed}
function applyMechanismPresentFromApi(d){if(!d||!Object.prototype.hasOwnProperty.call(d,'mechanism_present'))return false;const rows=d.mechanism_present;if(!Array.isArray(rows))return false;S.mechanismPresentRows=rows;const allow=new Set(rows.map(r=>String(r&&r.id||'')));function pruneKey(stateKey){let sel=Array.isArray(S[stateKey])?S[stateKey]:[];const pruned=sel.filter(k=>allow.has(String(k)));const changed=pruned.length!==sel.length;if(changed)S[stateKey]=pruned;return changed}const changed=pruneKey('listUnitMechanism')||pruneKey('listRankUnitMechanism');['unit','rankUnit'].forEach(pfx=>{const body=document.getElementById(pfx+'MechanismFilterBody');if(body)body.innerHTML=buildUnitMechanismFilterHtml(pfx==='rankUnit'?'listRankUnitMechanism':'listUnitMechanism')});updateUnitMechanismFilterLabel('unit');updateUnitMechanismFilterLabel('rankUnit');return changed}
const MOD_EFFECT_FILTER_ICONS={ALL:'',HP:'/static/images/UI/Sprite/UI_Common_Icon_MapWeapon_Hp.webp',EN:'/static/images/UI/Sprite/UI_Common_Icon_MapWeapon_En.webp',ATK:'/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',DEF:'/static/images/UI/UI_Common_TypeIcon_Defense_M.webp',MOB:'/static/images/UI/UI_Common_Icon_Arrow_S.webp',OTHER:'/static/images/UI/UI_Common_Icon_Diamond_M.webp'};
function modEffectFilterIconPath(ef){const m=S._modEffectFilterIcons;if(m&&m[ef])return String(m[ef]).trim();return MOD_EFFECT_FILTER_ICONS[ef]||''}
const LINEAGE_TAG_ICON_CHAR='/static/images/UI/UI_Common_Icon_Category_Chara_Main.webp';
const LINEAGE_TAG_ICON_UNIT='/static/images/UI/UI_Common_Icon_Category_MS_Main.webp';
/** Series filter "All" — m_series id 10 / logo_l_series_0010 (original Mobile Suit Gundam) */
const SERIES_FILTER_ALL_LOGO='/static/images/Logo-Series/logo_l_series_0010.webp';
const SKILL_BROWSE_ALL_ICON_LOCK='/static/images/Trait/trait_10150101.webp';
const CHAR_ABILITY_BROWSE_ALL_ICON='/static/images/Trait/trait_10190102.webp';
const ROLE_LIST_IDS=['1','2','3'];
function rarityFilterIconsHtml(keys){return keys.map(k=>`<img class="filter-inline-icon rarity-filter-chip" src="${imgUrl(RARITY_FILTER_ICONS[k])}" alt="" role="presentation">`).join('')}
function rarityLtFilterRowHtml(p){const cls=p==='unit'?'rarity-lt-banner--unit':'rarity-lt-banner--char';const lbl=t('limited_label');return`<span class="rarity-filter-lt-row"><span class="rarity-lt-banner-chip ${cls}" role="img" aria-label="${escAttr(lbl)}"><span class="rarity-lt-banner-chip-inner">${esc(lbl)}</span></span></span>`}
function rarityLtToolbarChipHtml(which){const cls=which==='unit'?'rarity-lt-banner--unit':'rarity-lt-banner--char';const lbl=t('limited_label');return`<span class="rarity-lt-banner-chip rarity-lt-toolbar-chip ${cls}" role="img" aria-label="${escAttr(lbl)}" title="${escAttr(lbl)}"><span class="rarity-lt-banner-chip-inner">${esc(lbl)}</span></span>`}
function rarityNltToolbarChipHtml(){const lbl=t('rarity_exclude_limited');return`<span class="rarity-nlt-banner-chip rarity-nlt-toolbar-chip" role="img" aria-label="${escAttr(lbl)}" title="${escAttr(lbl)}"><span class="rarity-nlt-banner-chip-inner">${esc(lbl)}</span></span>`}
/** Limited pool is UR-only; exclude-limited (NLT) only applies when UR is in scope. */
function rarityUsesExcludeLimited(ltOn,allStars,sel){return !ltOn&&(allStars||sel.includes('UR'))}
function rarityKeysFor(which){return which==='unit'||which==='rankUnit'?['ULT',...RARITY_LIST_KEYS]:RARITY_LIST_KEYS}
function ensureUnitUltRarityRow(which='unit'){const p=which==='rankUnit'?'rankUnit':'unit';if(document.getElementById(p+'RarityULT'))return;const ltRow=document.getElementById(p+'RarityLT');if(!ltRow)return;const wrap=ltRow.closest('.rarity-filter-row');if(!wrap)return;const row=document.createElement('div');row.className='rarity-filter-row';row.innerHTML=`<input type="checkbox" id="${p}RarityULT" checked onchange="onRarityStarCheckboxChange('${p}','ULT',event)"><span class="rarity-row-hit" role="button" tabindex="0" onclick="onRarityRowClick('${p}','ULT',event)" onkeydown="onRarityRowKey(event,'${p}','ULT')"><span class="rarity-row-one-icon" id="${p}RarityRowULT"></span></span>`;wrap.parentNode.insertBefore(row,wrap)}
function roleFilterIconsHtml(ids){return ids.map(id=>`<img class="filter-inline-icon role-filter-chip" src="${imgUrl(ROLE_FILTER_ICONS[id])}" alt="" role="presentation">`).join('')}
function fillRolePanelIcons(p){ROLE_LIST_IDS.forEach(id=>{const rw=document.getElementById(p+'RoleRow'+id);if(rw)rw.innerHTML=roleFilterIconsHtml([id])});['1','2','3'].forEach((rid,i)=>{const lb=document.getElementById(p+'RoleLbl'+(i+1));if(lb)lb.textContent=t(['role_attack','role_defense','role_support'][i])})}
function initToolbarFilterIcons(){ensureUnitUltRarityRow('unit');ensureUnitUltRarityRow('rankUnit');ensureUnitWeaponRangeFilterDom();ensureRankUnitWeaponRangeFilterDom();['char','unit','supp','rankChar','rankUnit'].forEach(p=>fillRarityPanelIcons(p));['char','unit','rankChar','rankUnit'].forEach(p=>fillRolePanelIcons(p));['char','unit','supp','rankChar','rankUnit'].forEach(p=>updateRarityFilterButtonLabel(p));['char','unit','rankChar','rankUnit'].forEach(p=>updateRoleFilterButtonLabel(p));['char','unit','rankChar','rankUnit'].forEach(p=>fillSourcePanel(p));['char','unit','rankChar','rankUnit'].forEach(p=>updateSourceFilterButtonLabel(p));['char','unit','supp','rankChar','rankUnit'].forEach(p=>updateLineageFilterButtonLabel(p));['char','unit','rankChar','rankUnit'].forEach(p=>updateSeriesFilterButtonLabel(p));['char','unit','rankChar','rankUnit'].forEach(p=>updateSkillBrowseFilterLabel(p));fillStageDiffPanel();updateStageDifficultyFilterButtons();syncStageSourceToolbar();['char','rankChar'].forEach(p=>updateAbilBrowseFilterLabel(p));updateUnitWeaponRangeFilterLabel('unit');updateUnitWeaponRangeFilterLabel('rankUnit')}
function rarityPrefix(which){return which==='char'?'char':which==='unit'?'unit':which==='rankChar'?'rankChar':which==='rankUnit'?'rankUnit':'supp'}
function rolePrefix(which){if(which==='rankChar')return 'rankChar';if(which==='rankUnit')return 'rankUnit';return which==='char'?'char':'unit'}
function closeAllRarityPanels(){['char','unit','supp','rankChar','rankUnit'].forEach(p=>{const panel=document.getElementById(p+'RarityFilterPanel');const btn=document.getElementById(p+'RarityFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllRolePanels(){['char','unit','rankChar','rankUnit'].forEach(p=>{const panel=document.getElementById(p+'RoleFilterPanel');const btn=document.getElementById(p+'RoleFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeStageDiffPanel(){const panel=document.getElementById('stageDiffFilterPanel');const btn=document.getElementById('stageDiffFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')}
function closeAllSourcePanels(){['char','unit','rankChar','rankUnit'].forEach(p=>{const panel=document.getElementById(p+'SourceFilterPanel');const btn=document.getElementById(p+'SourceFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllTerrainPanels(){['unit','rankUnit'].forEach(pfx=>{const panel=document.getElementById(pfx+'TerrainFilterPanel');const btn=document.getElementById(pfx+'TerrainFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllUnitWeaponDebuffPanels(){['unit','rankUnit'].forEach(pfx=>{const panel=document.getElementById(pfx+'WeaponDebuffFilterPanel');const btn=document.getElementById(pfx+'WeaponDebuffFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllUnitWeaponRangePanels(){['unit','rankUnit'].forEach(pfx=>{const panel=document.getElementById(pfx+'WeaponRangeFilterPanel');const btn=document.getElementById(pfx+'WeaponRangeFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllUnitMechanismPanels(){['unit','rankUnit'].forEach(pfx=>{const panel=document.getElementById(pfx+'MechanismFilterPanel');const btn=document.getElementById(pfx+'MechanismFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllLineagePanels(){['char','unit','supp','rankChar','rankUnit'].forEach(p=>{const panel=document.getElementById(p+'LineageFilterPanel');const btn=document.getElementById(p+'LineageFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllSeriesPanels(){['char','unit','rankChar','rankUnit'].forEach(p=>{const panel=document.getElementById(p+'SeriesFilterPanel');const btn=document.getElementById(p+'SeriesFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllSkillPanels(){['char','unit','rankChar','rankUnit'].forEach(p=>{const panel=document.getElementById(p+'SkillFilterPanel');const btn=document.getElementById(p+'SkillFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllAbilPanels(){['char','rankChar'].forEach(pfx=>{const panel=document.getElementById(pfx+'AbilFilterPanel');const btn=document.getElementById(pfx+'AbilFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')})}
function closeAllFilterPanels(){closeAllRarityPanels();closeAllRolePanels();closeStageDiffPanel();closeAllSourcePanels();closeAllTerrainPanels();closeAllUnitWeaponDebuffPanels();closeAllUnitWeaponRangePanels();closeAllUnitMechanismPanels();closeAllLineagePanels();closeAllSeriesPanels();closeAllSkillPanels();closeAllAbilPanels();closeModEffectPanel()}
function afterBrowseCombineOpChange(ent){if(ent==='char')scheduleBrowseListReload('characters');else if(ent==='unit')scheduleBrowseListReload('units');else if(ent==='supp')scheduleBrowseListReload('supporters');else if(ent==='rankChar'||ent==='rankUnit')scheduleRankingListReload()}
function browseCombineVennClipId(){browseCombineVennClipId._n=(browseCombineVennClipId._n||0)+1;return'bvcp'+browseCombineVennClipId._n}
function browseCombineVenAndSvg(bvcid){return'<svg xmlns="http://www.w3.org/2000/svg" class="browse-combine-venn browse-combine-venn--and" viewBox="0 0 41 26" aria-hidden="true"><defs><clipPath id="'+bvcid+'"><circle cx="15.5" cy="13" r="9.5"/></clipPath></defs><circle cx="25.5" cy="13" r="9.5" clip-path="url(#'+bvcid+')" fill="currentColor"/><circle cx="15.5" cy="13" r="9.5" fill="none" stroke="currentColor" stroke-width="1.25"/><circle cx="25.5" cy="13" r="9.5" fill="none" stroke="currentColor" stroke-width="1.25"/></svg>'}
function browseCombineVenOrSvg(){return'<svg xmlns="http://www.w3.org/2000/svg" class="browse-combine-venn browse-combine-venn--or" viewBox="0 0 41 26" aria-hidden="true"><path fill="currentColor" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round" d="M 6 13 A 9.5 9.5 0 0 1 15.5 3.5 L 25.5 3.5 A 9.5 9.5 0 0 1 35 13 A 9.5 9.5 0 0 1 25.5 22.5 L 15.5 22.5 A 9.5 9.5 0 0 1 6 13 Z"/></svg>'}
function browseCombineSegToggleMarkup(){const cid=browseCombineVennClipId();return'<span class="browse-combine-seg-thumb"></span><span class="browse-combine-seg browse-combine-seg--and">'+browseCombineVenAndSvg(cid)+'</span><span class="browse-combine-seg browse-combine-seg--or">'+browseCombineVenOrSvg()+'</span>'}
function syncBrowseCombineToggleUi(wrap,combKey){if(!wrap||!combKey)return;const isOr=S[combKey]==='or';const btn=wrap.querySelector('.browse-filter-combine-toggle');if(!btn)return;btn.classList.toggle('browse-filter-combine-toggle--or',isOr);btn.setAttribute('role','switch');btn.setAttribute('aria-checked',isOr?'true':'false');btn.title=isOr?t('browse_filter_combine_tt_or'):t('browse_filter_combine_tt_and');btn.setAttribute('aria-label',isOr?t('browse_filter_combine_aria_or'):t('browse_filter_combine_aria_and'))}
function attachFilterPanelFooterHandlers(wrap,opts){const onClear=opts.onClear;const combKey=opts.combineKey||null;const ent=opts.combineEntity||null;const escBtn=wrap.querySelector('[data-filter-esc]');const clrBtn=wrap.querySelector('[data-filter-clear]');const combBtn=wrap.querySelector('.browse-filter-combine-toggle');if(escBtn){escBtn.textContent=t('browse_filter_esc');escBtn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();closeAllFilterPanels()}}if(clrBtn){clrBtn.textContent=t('browse_filters_clear');clrBtn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();try{onClear&&onClear()}catch(_){}}}if(combBtn&&combKey){combBtn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();let next;if(ev.detail>0){const rect=combBtn.getBoundingClientRect();next=(ev.clientX-rect.left)/Math.max(rect.width,1)>=.5?'or':'and'}else{next=S[combKey]==='or'?'and':'or'}if(S[combKey]===next)return;S[combKey]=next;syncBrowseCombineToggleUi(wrap,combKey);if(ent)afterBrowseCombineOpChange(ent)}}syncBrowseCombineToggleUi(wrap,combKey)}
function ensureFilterPanelFooter(panelId,opts){const o=opts||{};const combKey=o.combineKey||null;const panel=document.getElementById(panelId);if(!panel)return;let wrap=panel.querySelector('.filter-panel-clear-wrap');if(!wrap){wrap=document.createElement('div');wrap.className='filter-panel-clear-wrap';panel.appendChild(wrap)}if(!wrap.dataset.footerReady){wrap.dataset.footerReady='1';wrap.innerHTML='';const left=document.createElement('div');left.className='filter-panel-footer-left';const right=document.createElement('div');right.className='filter-panel-footer-right';const eb=document.createElement('button');eb.type='button';eb.className='filter-panel-esc-btn';eb.setAttribute('data-filter-esc','1');const cb=document.createElement('button');cb.type='button';cb.className='filter-panel-clear-btn';cb.setAttribute('data-filter-clear','1');right.appendChild(eb);right.appendChild(cb);wrap.appendChild(left);wrap.appendChild(right)}wrap.dataset.browseCombKey=combKey||'';const leftSlot=wrap.querySelector('.filter-panel-footer-left');if(combKey){const tb=leftSlot&&leftSlot.querySelector('.browse-filter-combine-toggle');if(!tb||tb.querySelector('.browse-combine-bar')||tb.querySelector('.browse-combine-sq')||!tb.querySelector('.browse-combine-seg-toggle')||!tb.querySelector('.browse-combine-venn--and')){if(leftSlot)leftSlot.innerHTML='<button type="button" class="browse-filter-combine-toggle" role="switch" aria-checked="false"><span class="browse-combine-seg-toggle" aria-hidden="true">'+browseCombineSegToggleMarkup()+'</span></button>'}}else if(leftSlot){leftSlot.innerHTML=''}attachFilterPanelFooterHandlers(wrap,o)}
function refreshFilterFooterI18n(){document.querySelectorAll('.filter-panel-clear-wrap[data-footer-ready="1"]').forEach(wrap=>{const escBtn=wrap.querySelector('[data-filter-esc]');const clrBtn=wrap.querySelector('[data-filter-clear]');if(escBtn)escBtn.textContent=t('browse_filter_esc');if(clrBtn)clrBtn.textContent=t('browse_filters_clear');const ck=wrap.dataset.browseCombKey||'';if(ck){syncBrowseCombineToggleUi(wrap,ck)}})}
function ensurePanelClearButton(panelId,onClear){ensureFilterPanelFooter(panelId,{onClear})}
function clearRarityOnly(which){const p=rarityPrefix(which);const ltEl=document.getElementById(p+'RarityLT');rarityKeysFor(which).forEach(k=>{const el=document.getElementById(p+'Rarity'+k);if(el)el.checked=true});if(ltEl)ltEl.checked=true;onRarityFilterChange(which)}
function clearRoleOnly(which){const p=rolePrefix(which);ROLE_LIST_IDS.forEach(id=>{const el=document.getElementById(p+'Role'+id);if(el)el.checked=true});onRoleFilterChange(which)}
function clearSourceOnly(which){const p=which==='rankChar'||which==='rankUnit'?which:(which==='char'?'char':'unit');const keys=['assembly','development','other'];keys.forEach(k=>{const el=document.getElementById(p+'SourceChk'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=true});S[listSourceKey(which)]='ALL';updateSourceFilterButtonLabel(which);if(which==='char'){cancelBrowseListReloadTimer('characters');loadCharacters(1)}else if(which==='unit'){cancelBrowseListReloadTimer('units');loadUnits(1)}else void loadRankingList(1)}
function clearLineageOnly(p){if(p==='char')S.listCharLineage=[];else if(p==='unit')S.listUnitLineage=[];else if(p==='rankChar')S.listRankCharLineage=[];else if(p==='rankUnit')S.listRankUnitLineage=[];else S.listSuppLineage=[];delete S['_linLblRf'+p];if(S._browseLineageNameHints)S._browseLineageNameHints[p]={};syncLineageCheckboxes(p);updateLineageFilterButtonLabel(p);if(p==='char'){cancelBrowseListReloadTimer('characters');loadCharacters(1)}else if(p==='unit'){cancelBrowseListReloadTimer('units');loadUnits(1)}else if(p==='rankChar'||p==='rankUnit')void loadRankingList(1);else{cancelBrowseListReloadTimer('supporters');loadSupporters(1)}}
function clearSeriesOnly(p){if(p==='char')S.listCharSeries=[];else if(p==='unit')S.listUnitSeries=[];else if(p==='rankChar')S.listRankCharSeries=[];else if(p==='rankUnit')S.listRankUnitSeries=[];syncSeriesCheckboxes(p);updateSeriesFilterButtonLabel(p);if(p==='char'){cancelBrowseListReloadTimer('characters');loadCharacters(1)}else if(p==='unit'){cancelBrowseListReloadTimer('units');loadUnits(1)}else if(p==='rankChar'||p==='rankUnit')void loadRankingList(1)}
function clearSkillOnly(p){const rk=p==='rankChar'||p==='rankUnit';if(!rk){if(p==='char')cancelBrowseListReloadTimer('characters');else cancelBrowseListReloadTimer('units')}if(p==='char')S.listCharSkills=[];else if(p==='unit')S.listUnitAbilities=[];else if(p==='rankChar')S.listRankCharSkills=[];else S.listRankUnitAbilities=[];syncSkillBrowseCheckboxes(p);updateSkillBrowseFilterLabel(p);if(p==='char')loadCharacters(1);else if(p==='unit')loadUnits(1);else void loadRankingList(1)}
function clearAbilOnly(){cancelBrowseListReloadTimer('characters');S.listCharAbilities=[];syncAbilBrowseCheckboxes('char');updateAbilBrowseFilterLabel('char');loadCharacters(1)}
function clearStageDiffOnly(){cancelBrowseListReloadTimer('stages');S.stages.difficultyFilter='ALL';fillStageDiffPanel();updateStageDifficultyFilterButtons();loadStages(1)}
function clearModEffectOnly(){cancelBrowseListReloadTimer('modifications');S.modifications.effectFilter='ALL';fillModEffectPanel();updateModEffectFilterLabel();loadModifications(1)}
function clearUnitTerrainOnly(){const sk=unitTerrainStateKey();const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';if(!rk)cancelBrowseListReloadTimer('units');S[sk]=[];const pfx=unitTerrainDomPrefix();const body=document.getElementById(pfx+'TerrainFilterBody');if(body)body.innerHTML=buildUnitTerrainFilterHtml();updateUnitTerrainFilterLabel();if(rk)void loadRankingList(1);else loadUnits(1)}
function closeModEffectPanel(){const panel=document.getElementById('modEffectFilterPanel');const btn=document.getElementById('modEffectFilterBtn');if(panel)panel.hidden=true;if(btn)btn.setAttribute('aria-expanded','false')}
function toggleModEffectPanel(ev){if(ev)ev.stopPropagation();const panel=document.getElementById('modEffectFilterPanel');const btn=document.getElementById('modEffectFilterBtn');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');fillModEffectPanel();ensurePanelClearButton('modEffectFilterPanel',clearModEffectOnly)}}
function applyModEffectAllRowIcons(){const wrap=document.getElementById('modEffectDdIconAllWrap');if(!wrap)return;wrap.querySelectorAll('img[data-mod-effect-key]').forEach(img=>{const k=img.getAttribute('data-mod-effect-key');const path=modEffectFilterIconPath(k);if(path)img.src=imgUrl(path)})}
function applyModEffectDropdownIcons(){const panel=document.getElementById('modEffectFilterPanel');if(!panel)return;applyModEffectAllRowIcons();panel.querySelectorAll('label.mod-effect-filter-row').forEach(lab=>{const inp=lab.querySelector('input[name="modEffectSel"]');if(!inp||inp.value==='ALL')return;const img=lab.querySelector('.mod-effect-opt-inner>img');if(!img)return;const path=modEffectFilterIconPath(inp.value);if(path)img.src=imgUrl(path)})}
function fillModEffectPanel(){const ef=S.modifications.effectFilter||'ALL';document.querySelectorAll('input[name="modEffectSel"]').forEach(inp=>{inp.checked=inp.value===ef});const a=document.getElementById('modEffectLblAll'),h=document.getElementById('modEffectLblHP'),en=document.getElementById('modEffectLblEN'),atk=document.getElementById('modEffectLblATK'),df=document.getElementById('modEffectLblDEF'),mb=document.getElementById('modEffectLblMOB'),ot=document.getElementById('modEffectLblOTHER');if(a)a.textContent=t('filter_source_all');if(h)h.textContent=t('mod_filter_effect_hp');if(en)en.textContent=t('mod_filter_effect_en');if(atk)atk.textContent=t('mod_filter_effect_atk');if(df)df.textContent=t('mod_filter_effect_def');if(mb)mb.textContent=t('mod_filter_effect_mob');if(ot)ot.textContent=t('mod_filter_effect_other');applyModEffectDropdownIcons()}
function modEffectAllToolbarIconsHtml(){const keys=['HP','EN','ATK','DEF','MOB','OTHER'];return keys.map(k=>{const p=modEffectFilterIconPath(k);return p?`<img class="mod-effect-btn-all-chip" src="${imgUrl(p)}" alt="" role="presentation" loading="lazy">`:''}).join('')}
function updateModEffectFilterLabel(){const ef=S.modifications.effectFilter||'ALL';const label=document.getElementById('modEffectFilterLabel');const btn=document.getElementById('modEffectFilterBtn');if(!label||!btn)return;btn.title=t('mod_filter_effect');const icon=modEffectFilterIconPath(ef)||'';const txtMap={ALL:t('filter_source_all'),HP:t('mod_filter_effect_hp'),EN:t('mod_filter_effect_en'),ATK:t('mod_filter_effect_atk'),DEF:t('mod_filter_effect_def'),MOB:t('mod_filter_effect_mob'),OTHER:t('mod_filter_effect_other')};const txt=txtMap[ef]||ef;if(ef==='ALL'){label.innerHTML=`<span class="mod-effect-btn-all-icons">${modEffectAllToolbarIconsHtml()}</span><span class="mod-effect-btn-plain">${esc(txt)}</span>`;btn.classList.remove('active')}else{label.innerHTML=icon?`<img class="mod-effect-btn-icon" src="${imgUrl(icon)}" alt="" role="presentation" loading="lazy"><span class="mod-effect-btn-text">${esc(txt)}</span>`:`<span class="mod-effect-btn-text">${esc(txt)}</span>`;btn.classList.add('active')}}
function onModEffectRadioChange(){const inp=document.querySelector('input[name="modEffectSel"]:checked');if(!inp)return;S.modifications.effectFilter=inp.value;updateModEffectFilterLabel();closeModEffectPanel();scheduleBrowseListReload('modifications')}
function invalidateBrowseFilterPanels(){S._browseFiltersByEntity=null;S._browseLineageNameHints=null;function zap(el){if(!el)return;el.innerHTML='';delete el.dataset.populated;delete el.dataset.bfPoolSig}['char','unit','supp','rankChar','rankUnit'].forEach(p=>{delete S['_linLblRf'+p];zap(document.getElementById(p+'LineageFilterBody'))});['char','unit','rankChar','rankUnit'].forEach(p=>{zap(document.getElementById(p+'SeriesFilterBody'));zap(document.getElementById(p+'SkillGrid'));const pan=document.getElementById(p+'SkillFilterPanel');if(pan){delete pan.dataset.populated;delete pan.dataset.bfPoolSig}});{['char','rankChar'].forEach(pfx=>{zap(document.getElementById(pfx+'AbilGrid'));const ap=document.getElementById(pfx+'AbilFilterPanel');if(ap){delete ap.dataset.populated;delete ap.dataset.bfPoolSig}})}invalidateRankingBrowseFilterPanels()}
function fillRarityPanelIcons(p){rarityKeysFor(p==='unit'||p==='rankUnit'?'unit':(p==='char'||p==='rankChar'?'char':'supp')).forEach(k=>{const row=document.getElementById(p+'RarityRow'+k);if(row)row.innerHTML=rarityFilterIconsHtml([k])});const rowLt=document.getElementById(p+'RarityRowLT');if(rowLt)rowLt.innerHTML=rarityLtFilterRowHtml(p)}
function fillStageDiffPanel(){const df=S.stages.difficultyFilter;document.querySelectorAll('input[name="stageDiffSel"]').forEach(inp=>{inp.checked=(inp.value==='ALL'&&df==='ALL')||inp.value===df});const al=document.getElementById('stageDiffAllLbl');if(al)al.textContent=t('filter_diff_all');const ln=document.getElementById('stageDiffLblNormal');if(ln)ln.textContent=t('filter_diff_normal');const lh=document.getElementById('stageDiffLblHard');if(lh)lh.textContent=t('filter_diff_hard');const le=document.getElementById('stageDiffLblExpert');if(le)le.textContent=t('filter_diff_expert')}
function toggleStageDiffPanel(ev){if(ev)ev.stopPropagation();const panel=document.getElementById('stageDiffFilterPanel');const btn=document.getElementById('stageDiffFilterBtn');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');fillStageDiffPanel();ensurePanelClearButton('stageDiffFilterPanel',clearStageDiffOnly)}}
function onStageDiffChange(){const inp=document.querySelector('input[name="stageDiffSel"]:checked');if(!inp)return;const v=inp.value;S.stages.difficultyFilter=v==='ALL'?'ALL':v;updateStageDifficultyFilterButtons();scheduleBrowseListReload('stages')}
function toggleRarityPanel(which,ev){if(ev)ev.stopPropagation();const p=rarityPrefix(which);const panel=document.getElementById(p+'RarityFilterPanel');const btn=document.getElementById(p+'RarityFilterBtn');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');fillRarityPanelIcons(p);ensurePanelClearButton(p+'RarityFilterPanel',()=>clearRarityOnly(which))}}
function toggleRolePanel(which,ev){if(ev)ev.stopPropagation();const p=rolePrefix(which);const panel=document.getElementById(p+'RoleFilterPanel');const btn=document.getElementById(p+'RoleFilterBtn');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');fillRolePanelIcons(p);ensurePanelClearButton(p+'RoleFilterPanel',()=>clearRoleOnly(which))}}
function getRarityQuerySuffix(which){const p=rarityPrefix(which);const keys=rarityKeysFor(which);const boxes=keys.map(k=>document.getElementById(p+'Rarity'+k));const ltEl=document.getElementById(p+'RarityLT');if(boxes.some(x=>!x))return '';const sel=keys.filter((k,i)=>boxes[i].checked);const ltOn=ltEl&&ltEl.checked;const allStars=sel.length===keys.length;if(sel.length===0&&!ltOn)return '&rarity=__NONE__';if(ltOn){if(allStars)return '';if(sel.length===0)return '&rarity='+encodeURIComponent('LT');return '&rarity='+encodeURIComponent(['LT',...sel].join(','))}const parts=allStars?[...keys]:[...sel];if(rarityUsesExcludeLimited(ltOn,allStars,sel))parts.push('NLT');return '&rarity='+encodeURIComponent(parts.join(','))}
function updateRarityFilterButtonLabel(which){const p=rarityPrefix(which);const keys=rarityKeysFor(which);const label=document.getElementById(p+'RarityFilterLabel');const btn=document.getElementById(p+'RarityFilterBtn');const boxes=keys.map(k=>document.getElementById(p+'Rarity'+k));const ltEl=document.getElementById(p+'RarityLT');if(!label||!btn)return;const sel=keys.filter((k,i)=>boxes[i]&&boxes[i].checked);const ltOn=ltEl&&ltEl.checked;const max=keys.length+(ltEl?1:0);const base=sel.length+(ltOn?1:0);const allStars=sel.length===keys.length;if(base===max&&ltOn){label.innerHTML=rarityFilterIconsHtml(keys);btn.classList.remove('active');return}if(base===0){label.textContent='—';btn.classList.add('active');return}btn.classList.add('active');let h=rarityFilterIconsHtml(sel);if(rarityUsesExcludeLimited(ltOn,allStars,sel))h+=rarityNltToolbarChipHtml();if(!h&&ltOn)label.innerHTML=rarityLtToolbarChipHtml(which);else label.innerHTML=h}
function updateRoleFilterButtonLabel(which){const p=rolePrefix(which);const label=document.getElementById(p+'RoleFilterLabel');const btn=document.getElementById(p+'RoleFilterBtn');const boxes=ROLE_LIST_IDS.map(id=>document.getElementById(p+'Role'+id));if(!label||!btn)return;const sel=ROLE_LIST_IDS.filter((id,i)=>boxes[i]&&boxes[i].checked);const n=sel.length;if(n===ROLE_LIST_IDS.length){label.innerHTML=roleFilterIconsHtml(ROLE_LIST_IDS);btn.classList.remove('active')}else if(n===0){label.textContent='—';btn.classList.add('active')}else{label.innerHTML=roleFilterIconsHtml(sel);btn.classList.add('active')}}
function getRoleQuerySuffix(which){const p=rolePrefix(which);const boxes=ROLE_LIST_IDS.map(id=>document.getElementById(p+'Role'+id));if(boxes.some(x=>!x))return '';const sel=ROLE_LIST_IDS.filter((id,i)=>boxes[i].checked);if(sel.length===0)return '&role=__NONE__';if(sel.length===ROLE_LIST_IDS.length)return '';return '&role='+encodeURIComponent(sel.join(','))}
function fillSourcePanel(which){const p=which==='rankChar'||which==='rankUnit'?which:(which==='char'?'char':'unit');const cur=S[listSourceKey(which)]||'ALL';const keys=['assembly','development','other'];const set=new Set(cur==='ALL'?keys:cur.split(',').map(x=>x.trim()).filter(Boolean));if(cur!=='ALL'&&set.size===0)keys.forEach(k=>set.add(k));keys.forEach(k=>{const el=document.getElementById(p+'SourceChk'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=cur==='ALL'||set.has(k)});const isCharLbl=which==='char'||which==='rankChar';const la=document.getElementById(p+'SourceLblAssembly');if(la)la.textContent=t(isCharLbl?'filter_source_assembly_char':'filter_source_assembly');const ld=document.getElementById(p+'SourceLblDevelopment');if(ld)ld.textContent=t(isCharLbl?'filter_source_development_char':'filter_source_development');const lo=document.getElementById(p+'SourceLblOther');if(lo)lo.textContent=t('filter_source_other')}
function updateSourceFilterButtonLabel(which){const p=which==='rankChar'||which==='rankUnit'?which:(which==='char'?'char':'unit');const cur=S[listSourceKey(which)]||'ALL';const label=document.getElementById(p+'SourceFilterLabel');const btn=document.getElementById(p+'SourceFilterBtn');if(!label||!btn)return;btn.title=t('filter_source');const ic=SOURCE_FILTER_UI_ICONS;const isCharLbl=which==='char'||which==='rankChar';const lbl=(k)=>k==='assembly'?t(isCharLbl?'filter_source_assembly_char':'filter_source_assembly'):k==='development'?t(isCharLbl?'filter_source_development_char':'filter_source_development'):t('filter_source_other');if(cur==='ALL'){label.innerHTML=`<span class="source-filter-btn-all-icons"><img class="filter-inline-icon role-filter-chip" src="${imgUrl(ic.assembly)}" alt="" role="presentation"><img class="filter-inline-icon role-filter-chip" src="${imgUrl(ic.development)}" alt="" role="presentation"><img class="filter-inline-icon role-filter-chip" src="${imgUrl(ic.other)}" alt="" role="presentation"><span class="source-filter-btn-plain">${esc(' - ' + t('filter_source_all'))}</span></span>`;btn.classList.remove('active')}else{const parts=cur.split(',').map(x=>x.trim()).filter(Boolean).sort();const imgs=parts.map(pk=>`<img class="filter-inline-icon role-filter-chip" src="${imgUrl(ic[pk])}" alt="" role="presentation">`).join('');const tx=parts.map(lbl).join(', ');label.innerHTML=imgs+`<span class="source-filter-btn-plain" style="margin-left:4px;font-size:13px;font-weight:600">${esc(tx)}</span>`;btn.classList.add('active')}}
function toggleSourcePanel(which,ev){if(ev)ev.stopPropagation();const p=which==='rankChar'||which==='rankUnit'?which:(which==='char'?'char':'unit');const panel=document.getElementById(p+'SourceFilterPanel');const btn=document.getElementById(p+'SourceFilterBtn');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');fillSourcePanel(which);ensurePanelClearButton(p+'SourceFilterPanel',()=>clearSourceOnly(which))}}
function clearBrowseFilters(which){const p=which==='char'?'char':'unit';if(which==='char')cancelBrowseListReloadTimer('characters');else cancelBrowseListReloadTimer('units');const qEl=document.getElementById(which==='char'?'charFilter':'unitFilter');if(qEl){qEl.value='';updateSearchHintVisibility(which==='char'?'charFilter':'unitFilter');if(qEl.classList.contains('filter-input--organic'))syncBrowseSearchWidth(qEl.id)}if(which==='char'){S.listCharSource='ALL';S.listCharLineage=[];S.listCharSeries=[];S.listCharSkills=[];S.listCharAbilities=[];S.listCharSp=false;S.listCharCond=false;S.browseCombCharLineage='and';S.browseCombCharSeries='or';S.browseCombCharSkill='and';S.browseCombCharTrait='and'}else{S.listUnitSource='ALL';S.listUnitLineage=[];S.listUnitSeries=[];S.listUnitAbilities=[];S.listUnitTerrain=[];S.listUnitWeaponDebuff=[];S.listUnitWeaponRange=[];S.listUnitMechanism=[];S.listUnitSp=false;S.listUnitSsp=false;S.listUnitCond=false;S._unitWeaponRangeSspAutoArmed=false;S.browseCombUnitLineage='and';S.browseCombUnitSeries='or';S.browseCombUnitAbil='and';S.browseCombTerrain='and';S.browseCombWb='and';S.browseCombWr='and';S.browseCombMech='and'}const rp=rarityPrefix(which);const ltEl=document.getElementById(p+'RarityLT');rarityKeysFor(which).forEach(k=>{const el=document.getElementById(rp+'Rarity'+k);if(el)el.checked=true});if(ltEl)ltEl.checked=true;ROLE_LIST_IDS.forEach(id=>{const el=document.getElementById(p+'Role'+id);if(el)el.checked=true});fillSourcePanel(which);syncLineageCheckboxes(p);syncSeriesCheckboxes(p);syncSkillBrowseCheckboxes(p);syncAbilBrowseCheckboxes(p);if(which==='unit')syncUnitTerrainCheckboxes();if(which==='unit')syncUnitWeaponDebuffCheckboxes();if(which==='unit')syncUnitWeaponRangeCheckboxes();if(which==='unit')syncUnitMechanismCheckboxes();updateRarityFilterButtonLabel(which);updateRoleFilterButtonLabel(which);updateSourceFilterButtonLabel(which);if(which==='unit')updateUnitTerrainFilterLabel();if(which==='unit')updateUnitWeaponDebuffFilterLabel();if(which==='unit')updateUnitWeaponRangeFilterLabel();if(which==='unit')updateUnitMechanismFilterLabel();updateLineageFilterButtonLabel(which==='supp'?'supp':p);updateSeriesFilterButtonLabel(p);if(which==='char'||which==='unit')updateSkillBrowseFilterLabel(p);if(which==='char')updateAbilBrowseFilterLabel(p);syncListCharToggle();syncListUnitStatToggles();syncListCondToggles();persistListStatToggles();closeAllFilterPanels();invalidateBrowseFilterPanels();if(which==='char')loadCharacters(1);else loadUnits(1)}
function applySourceFromDom(which){const p=which==='rankChar'||which==='rankUnit'?which:(which==='char'?'char':'unit');const keys=['assembly','development','other'];const picked=keys.filter(k=>{const el=document.getElementById(p+'SourceChk'+k.charAt(0).toUpperCase()+k.slice(1));return el&&el.checked});if(picked.length===0){keys.forEach(k=>{const el=document.getElementById(p+'SourceChk'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=true});S[listSourceKey(which)]='ALL'}else if(picked.length===3){S[listSourceKey(which)]='ALL'}else{S[listSourceKey(which)]=picked.slice().sort().join(',')}updateSourceFilterButtonLabel(which);if(which==='char')scheduleBrowseListReload('characters');else if(which==='unit')scheduleBrowseListReload('units');else scheduleRankingListReload()}
function onSourceCheckboxChange(which){applySourceFromDom(which)}
function onSourceRowClick(which,key,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const p=which==='rankChar'||which==='rankUnit'?which:(which==='char'?'char':'unit');const keys=['assembly','development','other'];if(!keys.includes(key))return;keys.forEach(k=>{const el=document.getElementById(p+'SourceChk'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=(k===key)});applySourceFromDom(which)}
function onSourceRowKey(ev,which,key){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onSourceRowClick(which,key,ev)}
function getSourceQuerySuffix(which){const cur=S[listSourceKey(which)]||'ALL';if(!cur||cur==='ALL')return '';return '&source='+encodeURIComponent(cur)}
function unitTerrainLabel(name){if(name==='Space')return t('terrain_space');if(name==='Atmospheric')return t('terrain_atmo');if(name==='Ground')return t('terrain_ground');if(name==='Sea')return t('terrain_sea');if(name==='Underwater')return t('terrain_underwater');return name}
function buildUnitTerrainFilterHtml(){const sk=unitTerrainStateKey();const selArr=Array.isArray(S[sk])?S[sk]:[];const selSet=new Set(selArr.map(v=>String(v)));const names=['Space','Atmospheric','Ground','Sea','Underwater'];let h='<div class="unit-terrain-grid">';names.forEach(name=>{const mk=(lv)=>{const token=`${name}:${lv}`;const active=selSet.has(token)?' is-active':'';const typeIc=UNIT_TERRAIN_TYPE_ICONS[name]||'';const lvIc=UNIT_TERRAIN_LEVEL_ICONS[String(lv)]||'';const lvWrap=lv===1?'unit-terrain-lv-wrap unit-terrain-lv-wrap--hyphen':'unit-terrain-lv-wrap';const lvHtml=lvIc?`<span class="${lvWrap}"><img class="source-filter-opt-icon" src="${imgUrl(lvIc)}" alt=""></span>`:'';return`<button type="button" class="unit-terrain-item${active}" onclick="onUnitTerrainRowClick('${token}',event)" onkeydown="onUnitTerrainRowKey(event,'${token}')">${typeIc?`<img class="source-filter-opt-icon" src="${imgUrl(typeIc)}" alt="">`:''}<span>${esc(unitTerrainLabel(name))}</span>${lvHtml}</button>`};h+=`<div class="unit-terrain-grid-row">${mk(1)}${mk(2)}${mk(3)}</div>`});h+='</div>';return h}
function syncUnitTerrainCheckboxes(){const pfx=unitTerrainDomPrefix();const body=document.getElementById(pfx+'TerrainFilterBody');if(body)body.innerHTML=buildUnitTerrainFilterHtml()}
function toggleUnitTerrainPanel(ev){if(ev)ev.stopPropagation();const pfx=unitTerrainDomPrefix();const panel=document.getElementById(pfx+'TerrainFilterPanel');const btn=document.getElementById(pfx+'TerrainFilterBtn');const body=document.getElementById(pfx+'TerrainFilterBody');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){if(body)body.innerHTML=buildUnitTerrainFilterHtml();panel.hidden=false;btn.setAttribute('aria-expanded','true');const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';ensureFilterPanelFooter(pfx+'TerrainFilterPanel',{onClear:clearUnitTerrainOnly,combineKey:rk?'browseCombRankTerrain':'browseCombTerrain',combineEntity:rk?'rankUnit':'unit'})}}
function onUnitTerrainChange(){updateUnitTerrainFilterLabel();if(S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units')scheduleRankingListReload();else scheduleBrowseListReload('units')}
function onUnitTerrainRowClick(token,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const sk=unitTerrainStateKey();let sel=Array.isArray(S[sk])?S[sk].slice():[];if(sel.includes(token))sel=sel.filter(x=>x!==token);else sel.push(token);S[sk]=sel;syncUnitTerrainCheckboxes();onUnitTerrainChange()}
function onUnitTerrainRowKey(ev,token){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onUnitTerrainRowClick(token,ev)}
function unitTerrainCountText(n){const lc=(S.lang||'EN').toUpperCase();const k=Number(n)||0;if(lc==='TW'||lc==='HK')return `${k} 地形`;if(lc==='JA'||lc==='JP')return `${k} 地形`;return `${k} Terrains`}
function unitTerrainAllText(){const lc=(S.lang||'EN').toUpperCase();if(lc==='TW'||lc==='HK')return '全部地形';if(lc==='EN')return 'All Terrains';return t('filter_source_all')}
function updateUnitTerrainFilterLabel(){const pfx=unitTerrainDomPrefix();const sk=unitTerrainStateKey();const label=document.getElementById(pfx+'TerrainFilterLabel');const btn=document.getElementById(pfx+'TerrainFilterBtn');if(!label||!btn)return;btn.title=t('terrain');let sel=S[sk];if(!Array.isArray(sel))sel=[];if(!sel.length){label.innerHTML=`<span class="source-filter-btn-plain">${esc(unitTerrainAllText())}</span>`;btn.classList.remove('active');return}btn.classList.add('active');if(sel.length===1){const [name,lv]=String(sel[0]).split(':');const typeIc=UNIT_TERRAIN_TYPE_ICONS[name]||'';const lvIc=UNIT_TERRAIN_LEVEL_ICONS[String(lv)]||'';label.innerHTML=`${typeIc?`<img class="filter-inline-icon role-filter-chip" src="${imgUrl(typeIc)}" alt="" role="presentation">`:''}<span class="source-filter-btn-plain" style="margin:0 4px;font-size:13px;font-weight:600">${esc(unitTerrainLabel(name))}</span>${lvIc?`<img class="filter-inline-icon role-filter-chip" src="${imgUrl(lvIc)}" alt="" role="presentation">`:''}`;return}label.innerHTML=`<span class="source-filter-btn-plain">${esc(unitTerrainCountText(sel.length))}</span>`}
function getUnitTerrainQuerySuffix(){let sel=S.listUnitTerrain;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&terrain='+encodeURIComponent(sel.join(','))}
function getUnitWeaponDebuffQuerySuffix(){let sel=S.listUnitWeaponDebuff;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&weapon_debuff='+encodeURIComponent(sel.join(','))}
function getUnitWeaponRangeQuerySuffix(){let sel=S.listUnitWeaponRange;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&weapon_range='+encodeURIComponent(sel.join(','))}
function getUnitMechanismQuerySuffix(){let sel=S.listUnitMechanism;if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&mechanism='+encodeURIComponent(sel.join(','))}
function buildUnitWeaponDebuffFilterHtml(skOpt){const sk=skOpt||unitWeaponDebuffStateKey();const selArr=Array.isArray(S[sk])?S[sk]:[];const selSet=new Set(selArr.map(v=>String(v)));const defs=getUnitWeaponDebuffDefsForUi();let h='<div class="unit-debuff-grid">';for(let i=0;i<defs.length;i+=2){const a=defs[i],b=defs[i+1];const mk=(d)=>{if(!d)return'<span class="unit-debuff-fill" aria-hidden="true"></span>';const active=selSet.has(d.key)?' is-active':'';return`<button type="button" class="unit-debuff-item${active}" onclick="onUnitWeaponDebuffRowClick('${d.key}',event)" onkeydown="onUnitWeaponDebuffRowKey(event,'${d.key}')"><span>${esc(t(d.labelKey))}</span></button>`};h+=`<div class="unit-debuff-grid-row">${mk(a)}${mk(b)}</div>`}h+='</div>';return h}
function syncUnitWeaponDebuffCheckboxes(){const pfx=unitWeaponDebuffDomPrefix();const body=document.getElementById(pfx+'WeaponDebuffFilterBody');if(body)body.innerHTML=buildUnitWeaponDebuffFilterHtml()}
function toggleUnitWeaponDebuffPanel(ev){if(ev)ev.stopPropagation();const pfx=unitWeaponDebuffDomPrefix();const panel=document.getElementById(pfx+'WeaponDebuffFilterPanel');const btn=document.getElementById(pfx+'WeaponDebuffFilterBtn');const body=document.getElementById(pfx+'WeaponDebuffFilterBody');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){if(body)body.innerHTML=buildUnitWeaponDebuffFilterHtml();panel.hidden=false;btn.setAttribute('aria-expanded','true');const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';ensureFilterPanelFooter(pfx+'WeaponDebuffFilterPanel',{onClear:clearUnitWeaponDebuffOnly,combineKey:rk?'browseCombRankWb':'browseCombWb',combineEntity:rk?'rankUnit':'unit'})}}
function syncUnitListSspForWeaponEffectFilters(){const sk=unitWeaponDebuffStateKey();const sel=Array.isArray(S[sk])?S[sk]:[];const needsSsp=sel.includes('preemptive')||sel.includes('range_6');const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';const armedKey=rk?'_rankUnitWeaponSspAutoArmed':'_unitWeaponSspAutoArmed';if(!needsSsp){S[armedKey]=false;return}if(S[armedKey])return;const sspKey=rk?'listRankUnitSsp':'listUnitSsp';const spKey=rk?'listRankUnitSp':'listUnitSp';S[sspKey]=true;S[spKey]=false;S[armedKey]=true;if(sspKey==='listUnitSsp'){syncListUnitStatToggles();persistListStatToggles()}else syncRankListStatToggleUi()}
function syncUnitListSspForWeaponRangeFilters(){const sk=unitWeaponRangeStateKey();const sel=Array.isArray(S[sk])?S[sk]:[];const needsSsp=sel.includes('5')||sel.includes('6');const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';const armedKey=rk?'_rankUnitWeaponRangeSspAutoArmed':'_unitWeaponRangeSspAutoArmed';if(!needsSsp){S[armedKey]=false;return}if(S[armedKey])return;const sspKey=rk?'listRankUnitSsp':'listUnitSsp';const spKey=rk?'listRankUnitSp':'listUnitSp';S[sspKey]=true;S[spKey]=false;S[armedKey]=true;if(sspKey==='listUnitSsp'){syncListUnitStatToggles();persistListStatToggles()}else syncRankListStatToggleUi()}
function onUnitWeaponDebuffChange(){syncUnitListSspForWeaponEffectFilters();updateUnitWeaponDebuffFilterLabel();if(S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units')scheduleRankingListReload();else scheduleBrowseListReload('units')}
function onUnitWeaponDebuffRowClick(key,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const sk=unitWeaponDebuffStateKey();let sel=Array.isArray(S[sk])?S[sk].slice():[];if(sel.includes(key))sel=sel.filter(x=>x!==key);else sel.push(key);S[sk]=sel;syncUnitWeaponDebuffCheckboxes();onUnitWeaponDebuffChange()}
function onUnitWeaponDebuffRowKey(ev,key){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onUnitWeaponDebuffRowClick(key,ev)}
function updateUnitWeaponDebuffFilterLabel(forcePfx){const pfx=forcePfx||unitWeaponDebuffDomPrefix();const sk=pfx==='rankUnit'?'listRankUnitWeaponDebuff':'listUnitWeaponDebuff';const label=document.getElementById(pfx+'WeaponDebuffFilterLabel');const btn=document.getElementById(pfx+'WeaponDebuffFilterBtn');if(!label||!btn)return;btn.title=t('unit_filter_weapon_debuff');let sel=S[sk];if(!Array.isArray(sel))sel=[];if(!sel.length){label.innerHTML=`<span class="source-filter-btn-plain">${esc(t('unit_filter_weapon_debuff_all'))}</span>`;btn.classList.remove('active');return}btn.classList.add('active');if(sel.length===1){const def=UNIT_WEAPON_DEBUFF_DEFS.find(d=>d.key===sel[0]);const txt=def?t(def.labelKey):String(sel[0]);label.innerHTML=`<span class="source-filter-btn-plain" style="font-size:13px;font-weight:600">${esc(txt)}</span>`;return}label.innerHTML=`<span class="source-filter-btn-plain">${esc(t('unit_filter_weapon_debuff_multi').replace('{n}',String(sel.length)))}</span>`}
function clearUnitWeaponDebuffOnly(){const sk=unitWeaponDebuffStateKey();const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';if(!rk)cancelBrowseListReloadTimer('units');S[sk]=[];const pfx=unitWeaponDebuffDomPrefix();const body=document.getElementById(pfx+'WeaponDebuffFilterBody');if(body)body.innerHTML=buildUnitWeaponDebuffFilterHtml();updateUnitWeaponDebuffFilterLabel();if(rk)void loadRankingList(1);else loadUnits(1)}
function weaponRangeLabelPrefix(){return(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP')?'射程':'Range'}
function weaponRangeFilterName(){if(S.lang==='TW'||S.lang==='HK')return'最高傷害範圍';if(S.lang==='JA'||S.lang==='JP')return'最大ダメージ範囲';return'Max Damage Ranges'}
function weaponRangeAllText(){return weaponRangeFilterName()}
function buildUnitWeaponRangeFilterHtml(skOpt){const sk=skOpt||unitWeaponRangeStateKey();const selArr=Array.isArray(S[sk])?S[sk]:[];const sel=selArr.length?String(selArr[0]):'';const pfx=weaponRangeLabelPrefix();let h='<div class="unit-debuff-grid"><div class="unit-debuff-grid-row">';UNIT_WEAPON_RANGE_VALUES.forEach((v,idx)=>{const active=sel===v?' is-active':'';h+=`<button type="button" class="unit-debuff-item${active}" onclick="onUnitWeaponRangeRowClick('${v}',event)" onkeydown="onUnitWeaponRangeRowKey(event,'${v}')"><span>${esc(pfx+' '+v)}</span></button>`;if(idx%2===1&&idx<UNIT_WEAPON_RANGE_VALUES.length-1)h+='</div><div class="unit-debuff-grid-row">' });if(UNIT_WEAPON_RANGE_VALUES.length%2===1)h+='<span class="unit-debuff-fill" aria-hidden="true"></span>';h+='</div></div>';return h}
function syncUnitWeaponRangeCheckboxes(){const pfx=unitWeaponRangeDomPrefix();const body=document.getElementById(pfx+'WeaponRangeFilterBody');if(body)body.innerHTML=buildUnitWeaponRangeFilterHtml()}
function toggleUnitWeaponRangePanel(ev){if(ev)ev.stopPropagation();const pfx=unitWeaponRangeDomPrefix();const panel=document.getElementById(pfx+'WeaponRangeFilterPanel');const btn=document.getElementById(pfx+'WeaponRangeFilterBtn');const body=document.getElementById(pfx+'WeaponRangeFilterBody');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){if(body)body.innerHTML=buildUnitWeaponRangeFilterHtml();panel.hidden=false;btn.setAttribute('aria-expanded','true');const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';ensureFilterPanelFooter(pfx+'WeaponRangeFilterPanel',{onClear:clearUnitWeaponRangeOnly,combineKey:rk?'browseCombRankWr':'browseCombWr',combineEntity:rk?'rankUnit':'unit'})}}
function onUnitWeaponRangeChange(){syncUnitListSspForWeaponRangeFilters();updateUnitWeaponRangeFilterLabel();if(S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units')scheduleRankingListReload();else scheduleBrowseListReload('units')}
function onUnitWeaponRangeRowClick(v,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const sk=unitWeaponRangeStateKey();const cur=Array.isArray(S[sk])&&S[sk].length?String(S[sk][0]):'';S[sk]=(cur===String(v)?[]:[String(v)]);syncUnitWeaponRangeCheckboxes();onUnitWeaponRangeChange()}
function onUnitWeaponRangeRowKey(ev,v){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onUnitWeaponRangeRowClick(v,ev)}
function updateUnitWeaponRangeFilterLabel(forcePfx){const pfx=forcePfx||unitWeaponRangeDomPrefix();const sk=pfx==='rankUnit'?'listRankUnitWeaponRange':'listUnitWeaponRange';const label=document.getElementById(pfx+'WeaponRangeFilterLabel');const btn=document.getElementById(pfx+'WeaponRangeFilterBtn');if(!label||!btn)return;const p=weaponRangeLabelPrefix();btn.title=weaponRangeFilterName();let sel=S[sk];if(!Array.isArray(sel))sel=[];if(!sel.length){label.innerHTML=`<span class="source-filter-btn-plain">${esc(weaponRangeAllText())}</span>`;btn.classList.remove('active');return}btn.classList.add('active');label.innerHTML=`<span class="source-filter-btn-plain" style="font-size:13px;font-weight:600">${esc(p+' '+String(sel[0]))}</span>`}
function clearUnitWeaponRangeOnly(){const sk=unitWeaponRangeStateKey();const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';if(!rk)cancelBrowseListReloadTimer('units');S[sk]=[];S[rk?'_rankUnitWeaponRangeSspAutoArmed':'_unitWeaponRangeSspAutoArmed']=false;const pfx=unitWeaponRangeDomPrefix();const body=document.getElementById(pfx+'WeaponRangeFilterBody');if(body)body.innerHTML=buildUnitWeaponRangeFilterHtml();updateUnitWeaponRangeFilterLabel();if(rk)void loadRankingList(1);else loadUnits(1)}
function buildUnitMechanismFilterHtml(skOpt){const rows=Array.isArray(S.mechanismPresentRows)?S.mechanismPresentRows:[];const sk=skOpt||unitMechanismStateKey();const selArr=Array.isArray(S[sk])?S[sk]:[];const selSet=new Set(selArr.map(v=>String(v)));let h='<div class="unit-debuff-grid">';for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1];const mk=(row)=>{if(!row)return'<span class="unit-debuff-fill" aria-hidden="true"></span>';const id=String(row.id||'');const active=selSet.has(id)?' is-active':'';const ic=row.icon?`<img class="source-filter-opt-icon" src="${imgUrl(row.icon)}" alt="">`:'';return`<button type="button" class="unit-debuff-item${active}" onclick='onUnitMechanismRowClick(${JSON.stringify(id)},event)' onkeydown='onUnitMechanismRowKey(event,${JSON.stringify(id)})'>${ic}<span>${esc(row.name||id)}</span></button>`};h+=`<div class="unit-debuff-grid-row">${mk(a)}${mk(b)}</div>`}h+='</div>';return h}
function syncUnitMechanismCheckboxes(){const pfx=unitMechanismDomPrefix();const body=document.getElementById(pfx+'MechanismFilterBody');if(body)body.innerHTML=buildUnitMechanismFilterHtml()}
function toggleUnitMechanismPanel(ev){if(ev)ev.stopPropagation();const pfx=unitMechanismDomPrefix();const panel=document.getElementById(pfx+'MechanismFilterPanel');const btn=document.getElementById(pfx+'MechanismFilterBtn');const body=document.getElementById(pfx+'MechanismFilterBody');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){if(body)body.innerHTML=buildUnitMechanismFilterHtml();panel.hidden=false;btn.setAttribute('aria-expanded','true');const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';ensureFilterPanelFooter(pfx+'MechanismFilterPanel',{onClear:clearUnitMechanismOnly,combineKey:rk?'browseCombRankMech':'browseCombMech',combineEntity:rk?'rankUnit':'unit'})}}
function onUnitMechanismChange(){updateUnitMechanismFilterLabel();if(S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units')scheduleRankingListReload();else scheduleBrowseListReload('units')}
function onUnitMechanismRowClick(id,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const sid=String(id||'');const sk=unitMechanismStateKey();let sel=Array.isArray(S[sk])?S[sk].slice():[];if(sel.includes(sid))sel=sel.filter(x=>x!==sid);else sel.push(sid);S[sk]=sel;syncUnitMechanismCheckboxes();onUnitMechanismChange()}
function onUnitMechanismRowKey(ev,id){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onUnitMechanismRowClick(id,ev)}
function updateUnitMechanismFilterLabel(forcePfx){const pfx=forcePfx||unitMechanismDomPrefix();const sk=pfx==='rankUnit'?'listRankUnitMechanism':'listUnitMechanism';const label=document.getElementById(pfx+'MechanismFilterLabel');const btn=document.getElementById(pfx+'MechanismFilterBtn');if(!label||!btn)return;btn.title=t('unit_filter_mechanism_tt');let sel=S[sk];if(!Array.isArray(sel))sel=[];if(!sel.length){label.innerHTML=`<span class="source-filter-btn-plain">${esc(t('unit_filter_mechanism_all'))}</span>`;btn.classList.remove('active');return}btn.classList.add('active');if(sel.length===1){const rows=Array.isArray(S.mechanismPresentRows)?S.mechanismPresentRows:[];const found=rows.find(r=>String(r&&r.id||'')===String(sel[0]));const txt=found?(found.name||sel[0]):String(sel[0]);const ic=found&&found.icon?`<img class="filter-inline-icon role-filter-chip" src="${imgUrl(found.icon)}" alt="" role="presentation">`:'';label.innerHTML=`${ic}<span class="source-filter-btn-plain" style="margin-left:4px;font-size:13px;font-weight:600">${esc(txt)}</span>`;return}label.innerHTML=`<span class="source-filter-btn-plain">${esc(t('unit_filter_mechanism_multi').replace('{n}',String(sel.length)))}</span>`}
function clearUnitMechanismOnly(){const sk=unitMechanismStateKey();const rk=S.currentTab==='ranking'&&S.ranking&&S.ranking.mode==='units';if(!rk)cancelBrowseListReloadTimer('units');S[sk]=[];const pfx=unitMechanismDomPrefix();const body=document.getElementById(pfx+'MechanismFilterBody');if(body)body.innerHTML=buildUnitMechanismFilterHtml();updateUnitMechanismFilterLabel();if(rk)void loadRankingList(1);else loadUnits(1)}
function getLineageQuerySuffix(which){const key=listLineageKey(which);let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&lineage_id='+encodeURIComponent(sel.join(','))}
function getSeriesQuerySuffix(which){let sel=S[listSeriesKey(which)];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}if(!sel.length)return '';return '&series_id='+encodeURIComponent(sel.join(','))}
function getSkillOrAbilityQuerySuffix(which){const isCharSide=which==='char'||which==='rankChar';const key=isCharSide?(which==='rankChar'?'listRankCharSkills':'listCharSkills'):(which==='rankUnit'?'listRankUnitAbilities':'listUnitAbilities');let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';const param=isCharSide?'skill_id':'ability_id';return '&'+param+'='+encodeURIComponent(sel.join(','))}
function expandUnitSearchQuery(q){let s=String(q||'').trim();if(!s)return'';s=s.replace(/\bdevil\s+gundam\b/gi,'dark gundam');s=s.replace(/\bfatb\b/gi,'full armor gundam thunderbolt');s=s.replace(/\bsf\b/gi,'strike freedom');s=s.replace(/\bgod\b/gi,'burning gundam');return s.trim()}
function expandTbPickerSearchQuery(q,type){if(type==='unit')return expandUnitSearchQuery(q);if(type==='character'){let s=String(q||'').trim();s=s.replace(/\bdevil\s+gundam\b/gi,'dark gundam');s=s.replace(/\bfatb\b/gi,'full armor gundam thunderbolt');s=s.replace(/\bsf\b/gi,'strike freedom');s=s.replace(/\bgod\b/gi,'burning gundam');return s.trim()}return String(q||'').trim()}
function buildBrowsePoolQuery(which){if(which==='supp'){const qEl=document.getElementById('suppFilter');const q=(qEl&&qEl.value.trim())||'';const rq=getRarityQuerySuffix('supp');const linQ=getLineageQuerySuffix('supp');const linOp=getLineageOpSuffix('supp');return `q=${encodeURIComponent(q)}${rq}${linQ}${linOp}`}const qEl=document.getElementById(which==='char'?'charFilter':'unitFilter');const qRaw=(qEl&&qEl.value.trim())||'';const q=which==='unit'?expandUnitSearchQuery(qRaw):qRaw;const roleQ=getRoleQuerySuffix(which);const rq=getRarityQuerySuffix(which);const stQ=which==='unit'?getListStatQuery('unit'):'';const srcQ=getSourceQuerySuffix(which);const terrQ=which==='unit'?getUnitTerrainQuerySuffix():'';const terrOp=which==='unit'?getTerrainOpSuffix():'';const debQ=which==='unit'?getUnitWeaponDebuffQuerySuffix():'';const debOp=which==='unit'?getWeaponDebuffOpSuffix():'';const wrQ=which==='unit'?getUnitWeaponRangeQuerySuffix():'';const wrOp=which==='unit'?getWeaponRangeOpSuffix():'';const mechQ=which==='unit'?getUnitMechanismQuerySuffix():'';const mechOp=which==='unit'?getMechanismOpSuffix():'';const linQ=getLineageQuerySuffix(which);const linOp=getLineageOpSuffix(which);const serQ=getSeriesQuerySuffix(which);const serOp=getSeriesOpSuffix(which);const skAb=getSkillOrAbilityQuerySuffix(which);const skOp=which==='char'?getCharSkillOpSuffix():getUnitBrowseAbilityOpSuffix();const abQ=which==='char'?getAbilityQuerySuffix(which):'';const traitOp=which==='char'?getCharTraitAbilityOpSuffix():'';return `q=${encodeURIComponent(q)}${roleQ}${rq}${stQ}${srcQ}${terrQ}${terrOp}${debQ}${debOp}${wrQ}${wrOp}${mechQ}${mechOp}${linQ}${linOp}${serQ}${serOp}${skAb}${skOp}${abQ}${traitOp}`}
function buildBrowsePoolSig(which){if(which==='supp'){const qEl=document.getElementById('suppFilter');const q=(qEl&&qEl.value.trim().toLowerCase())||'';const rq=getRarityQuerySuffix('supp');const linQ=getLineageQuerySuffix('supp');const linOp=getLineageOpSuffix('supp');return [q,rq,linQ,linOp,S.browseCombSuppLineage].join('|')}const qEl=document.getElementById(which==='char'?'charFilter':'unitFilter');const q=(qEl&&qEl.value.trim().toLowerCase())||'';const roleQ=getRoleQuerySuffix(which);const rq=getRarityQuerySuffix(which);const stQ=which==='unit'?getListStatQuery('unit'):'';const srcQ=getSourceQuerySuffix(which);const terrQ=which==='unit'?getUnitTerrainQuerySuffix():'';const terrOp=which==='unit'?getTerrainOpSuffix():'';const debQ=which==='unit'?getUnitWeaponDebuffQuerySuffix():'';const debOp=which==='unit'?getWeaponDebuffOpSuffix():'';const wrQ=which==='unit'?getUnitWeaponRangeQuerySuffix():'';const wrOp=which==='unit'?getWeaponRangeOpSuffix():'';const mechQ=which==='unit'?getUnitMechanismQuerySuffix():'';const mechOp=which==='unit'?getMechanismOpSuffix():'';const linQ=getLineageQuerySuffix(which);const linOp=getLineageOpSuffix(which);const serQ=getSeriesQuerySuffix(which);const serOp=getSeriesOpSuffix(which);const skAb=getSkillOrAbilityQuerySuffix(which);const skOp=which==='char'?getCharSkillOpSuffix():getUnitBrowseAbilityOpSuffix();const abQ=which==='char'?getAbilityQuerySuffix(which):'';const traitOp=which==='char'?getCharTraitAbilityOpSuffix():'';const opState=which==='char'?[S.browseCombCharLineage,S.browseCombCharSeries,S.browseCombCharSkill,S.browseCombCharTrait].join(','):[S.browseCombUnitLineage,S.browseCombUnitSeries,S.browseCombUnitAbil,S.browseCombTerrain,S.browseCombWb,S.browseCombWr,S.browseCombMech].join(',');return [q,roleQ,rq,stQ,srcQ,terrQ,terrOp,debQ,debOp,wrQ,wrOp,mechQ,mechOp,linQ,linOp,serQ,serOp,skAb,skOp,abQ,traitOp,opState].join('|')}
function skillBrowsePackFor(p){if(p==='rankChar'||p==='rankUnit')return getRankBrowsePack(p)||{};return getBrowsePack(p==='char'?'char':'unit')||{}}
function skillBrowseListKey(p){if(p==='rankChar')return 'listRankCharSkills';if(p==='rankUnit')return 'listRankUnitAbilities';return p==='char'?'listCharSkills':'listUnitAbilities'}
function skillBrowseInputName(p){if(p==='rankChar')return 'rankCharSkillSel';if(p==='rankUnit')return 'rankUnitSkillSel';return p==='char'?'charSkillSel':'unitSkillSel'}
function buildSkillBrowseHtml(p){const pack=skillBrowsePackFor(p)||{};const isChar=p==='char'||p==='rankChar';const rows=groupBrowseRowsNoLevel(isChar?(pack.skills||[]):(pack.abilities||[]));const nameAttr=skillBrowseInputName(p);let h='';rows.forEach((row,idx)=>{const ft=String(row.name||'').toLowerCase();const showIcon=(p==='char'||p==='unit'||p==='rankChar'||p==='rankUnit')&&row.icon;if(showIcon){h+=`<label class="list-filter-tag-item skill-browse-row" data-skill-order="${idx}" data-filter-text="${escAttr(ft)}"><input type="checkbox" name="${nameAttr}" class="list-filter-sr skill-browse-item" value="${escAttr(String(row.id))}" onchange="onSkillBrowseItemChange('${p}')"><span class="tag-composite list-filter-tag-composite skill-browse-row-inner"><span class="tag-part-icon"><img class="skill-browse-ic" src="${imgUrl(row.icon)}" alt="" loading="lazy"></span><span class="tag-part-value">${esc(row.name)}</span></span></label>`}else{h+=`<label class="list-filter-tag-item skill-browse-row" data-skill-order="${idx}" data-filter-text="${escAttr(ft)}"><input type="checkbox" name="${nameAttr}" class="list-filter-sr skill-browse-item" value="${escAttr(String(row.id))}" onchange="onSkillBrowseItemChange('${p}')"><span class="tag-part-value">${esc(row.name)}</span></label>`}});return h}
function skillBrowseStemAndLv(name){const s=String(name||'').trim();const re=/\s*(?:Lv\.?|LV\.?|lv\.?)\s*(\d+)\s*$/i;const m=s.match(re);const lv=m?parseInt(m[1],10):0;const display=(lv&&m?s.slice(0,m.index):s).trim();const stem=display.toLowerCase();return{stem,lv,display}}
function groupBrowseRowsNoLevel(rows){const byStem=new Map();(rows||[]).forEach((row,idx)=>{const id=String(row&&row.id||'').trim();const nm=String(row&&row.name||'').trim();if(!id||!nm)return;const meta=skillBrowseStemAndLv(nm);const key=meta.stem||nm.toLowerCase();const cur=byStem.get(key)||{name:meta.display||nm,bestLv:-1,bestIdx:idx,icon:row.icon||'',ids:[]};if(!cur.ids.includes(id))cur.ids.push(id);if(meta.lv>cur.bestLv||(meta.lv===cur.bestLv&&idx<cur.bestIdx)){cur.bestLv=meta.lv;cur.bestIdx=idx;cur.icon=row.icon||cur.icon;cur.name=meta.display||nm}byStem.set(key,cur)});return Array.from(byStem.values()).sort((a,b)=>a.bestIdx-b.bestIdx).map(g=>({id:g.ids.join('|'),name:g.name,icon:g.icon||''}))}
const SUPPORT_DEF_X2_FILTER_ID='support_def_x2';
const SUPPORT_ATK_X2_FILTER_ID='support_atk_x2';
function normalizeCharAbilityBrowseRows(rows){const out=[];(rows||[]).forEach(row=>{const id=String(row&&row.id||'').trim();const nm=String(row&&row.name||'').trim();if(!id||!nm)return;const nml=nm.toLowerCase();if(id===SUPPORT_DEF_X2_FILTER_ID||id===SUPPORT_ATK_X2_FILTER_ID){out.push(row);return}const isPlainSupportDef=nml==='support defense'||nml==='支援防禦'||nml==='支援防御';const hintsSaCntConditional=/^\s*[(\uff08〔]/.test(nm)||/\bwhen\s+piloting\b/i.test(nm)||/\bspecified\s+(types|tags|series)\b/i.test(nml)||/\bvigor\s+is\s+supercharged\b/i.test(nml)||/\bwhen\s+executing\s+support\b/i.test(nml)||nml.includes('指定');const couldBeBareSaCnt=(nml.includes('support attack')&&nml.includes('counter'))||nml==='支援攻擊／反擊'||nml==='支援攻擊/反擊'||nml==='支援攻撃／反撃'||nml==='支援攻撃/反撃';const isPlainSupportAtk=!hintsSaCntConditional&&couldBeBareSaCnt;if(isPlainSupportDef||isPlainSupportAtk)return;out.push(row)});return out}
function filterSkillDropdown(p,q){const grid=document.getElementById(p+'SkillGrid');if(!grid)return;const qn=(q||'').trim().toLowerCase();const allRow=grid.querySelector('.skill-browse-all-row');const labels=Array.from(grid.querySelectorAll('.list-filter-tag-item'));if(!qn){labels.forEach(el=>{el.style.display=''});const rest=labels.filter(l=>l!==allRow).sort((a,b)=>parseInt(a.getAttribute('data-skill-order')||'999999',10)-parseInt(b.getAttribute('data-skill-order')||'999999',10));rest.forEach(el=>grid.appendChild(el));if(allRow)grid.insertBefore(allRow,grid.firstChild);return}labels.forEach(el=>{const t=el.getAttribute('data-filter-text')||'';el.style.display=!qn||t.includes(qn)?'':'none'});if(p!=='char'&&p!=='unit'&&p!=='rankChar'&&p!=='rankUnit')return;const rp=p==='char'||p==='rankChar'?'char':'unit';const rpfx=p==='rankChar'?'rankChar':p==='rankUnit'?'rankUnit':p==='char'?'char':'unit';const rarityKeys=rarityKeysFor(rp==='unit'||p==='rankUnit'?'unit':'char');const skillRows=labels.filter(l=>l.classList.contains('skill-browse-row')&&l.style.display!=='none');const byStem=new Map();skillRows.forEach(el=>{const lab=el.querySelector('.tag-part-value');const nm=lab?lab.textContent:'';const {stem,lv}=skillBrowseStemAndLv(nm);const stemKey=stem||String(nm).toLowerCase();const prev=byStem.get(stemKey);if(!prev||lv>prev.lv)byStem.set(stemKey,{el,lv})});labels.filter(l=>l.classList.contains('skill-browse-row')).forEach(el=>{el.style.display='none'});byStem.forEach(({el})=>{el.style.display=''});const rq=getRarityQuerySuffix(p==='rankChar'?'rankChar':p==='rankUnit'?'rankUnit':rp);const boxes=rarityKeys.map(k=>document.getElementById(rpfx+'Rarity'+k));const sel=rarityKeys.filter((k,i)=>boxes[i]&&boxes[i].checked);const ltEl=document.getElementById(rpfx+'RarityLT');const ltOn=ltEl&&ltEl.checked;const urOnly=sel.length===1&&sel[0]==='UR'&&!ltOn;const hideLowLv=rq!==''&&rq!=='&rarity=__NONE__'&&urOnly;if(hideLowLv){[...byStem.entries()].forEach(([k,v])=>{if(v.lv>0&&v.lv<=3){v.el.style.display='none';byStem.delete(k)}})}const ordered=[...byStem.entries()].filter(([,x])=>x.el.style.display!=='none').sort((a,b)=>b[1].lv-a[1].lv||a[0].localeCompare(b[0]));ordered.forEach(([,{el}])=>grid.appendChild(el));const rest=labels.filter(l=>!l.classList.contains('skill-browse-row')&&!l.classList.contains('skill-browse-all-row')&&l.style.display!=='none');rest.sort((a,b)=>parseInt(a.getAttribute('data-skill-order')||'0',10)-parseInt(b.getAttribute('data-skill-order')||'0',10));rest.forEach(el=>grid.appendChild(el));if(allRow)grid.insertBefore(allRow,grid.firstChild)}
function debounceFilterSkillDropdown(p){const k='_skSchFt'+p;clearTimeout(S[k]);S[k]=setTimeout(()=>{S[k]=null;const el=document.getElementById(p+'SkillFilterSearch');filterSkillDropdown(p,el&&el.value||'')},BROWSE_DROPDOWN_FILTER_MS)}
function debounceFilterBrowseDropdown(p,kind){const k='_brDd_'+kind+p;clearTimeout(S[k]);S[k]=setTimeout(()=>{S[k]=null;const body=document.getElementById(p+(kind==='lineage'?'LineageFilterBody':'SeriesFilterBody'));const inp=body&&body.querySelector('.filter-dd-search');filterBrowseDropdown(p,kind,inp&&inp.value||'')},BROWSE_DROPDOWN_FILTER_MS)}
function debounceFilterAbilDropdown(p){const k='_abilSchFt'+p;clearTimeout(S[k]);S[k]=setTimeout(()=>{S[k]=null;const el=document.getElementById(p+'AbilFilterSearch');filterAbilDropdown(p,el&&el.value||'')},BROWSE_DROPDOWN_FILTER_MS)}
function focusFilterSearchInput(panelId,preferredId){setTimeout(()=>{const panel=document.getElementById(panelId);if(!panel||panel.hidden)return;let el=preferredId?document.getElementById(preferredId):null;if(!el||!panel.contains(el))el=panel.querySelector('input[type="search"], .filter-dd-search');if(!el)return;try{el.focus({preventScroll:true})}catch(_){try{el.focus()}catch(__){}}try{if(typeof el.select==='function')el.select()}catch(_){}},0)}
function onSkillBrowseItemChange(p){const key=skillBrowseListKey(p);const nm=skillBrowseInputName(p);const checked=Array.from(document.querySelectorAll(`input[name="${nm}"].skill-browse-item:checked`)).map(i=>i.value);S[key]=checked.length?checked:[];updateSkillBrowseFilterLabel(p);if(p==='char')scheduleBrowseListReload('characters');else if(p==='unit')scheduleBrowseListReload('units');else scheduleRankingListReload()}
function syncSkillBrowseCheckboxes(p){const key=skillBrowseListKey(p);const nm=skillBrowseInputName(p);let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];const items=document.querySelectorAll(`input[name="${nm}"].skill-browse-item`);if(!sel.length){items.forEach(i=>i.checked=false)}else{items.forEach(i=>{i.checked=sel.some(s=>String(s)===String(i.value))})}}
function updateSkillBrowseFilterLabel(p){const key=skillBrowseListKey(p);let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];const label=document.getElementById(p+'SkillFilterLabel');const btn=document.getElementById(p+'SkillFilterBtn');if(!label||!btn)return;const isChar=p==='char'||p==='rankChar';btn.title=isChar?t('list_filter_skill'):t('list_filter_ability');const pack=skillBrowsePackFor(p);const rows=groupBrowseRowsNoLevel(isChar?(pack&&pack.skills||[]):(pack&&pack.abilities||[]));const allLbl=isChar?t('list_filter_all_skills'):t('list_filter_all_abilities');const toolbarLead=isChar?`<img class="skill-filter-toolbar-ic" src="${imgUrl(SKILL_BROWSE_ALL_ICON_LOCK)}" alt="" role="presentation">`:`<img class="skill-filter-toolbar-ic" src="${imgUrlPreferCdn(UNIT_SKILL_BROWSE_TOOLBAR_IC)}" alt="" role="presentation">`;if(sel.length===0){label.innerHTML=`<span class="skill-filter-toolbar-label">${toolbarLead}<span class="source-filter-btn-plain">${esc(allLbl)}</span></span>`;btn.classList.remove('active');return}btn.classList.add('active');if(sel.length===1){let name=sel[0];const found=rows.find(x=>String(x.id)===String(sel[0]));if(found)name=found.name;const ic=found&&found.icon?`<img class="skill-filter-toolbar-ic" src="${imgUrl(found.icon)}" alt="" role="presentation">`:'';label.innerHTML=`<span class="skill-filter-toolbar-label">${ic}<span class="source-filter-btn-plain">${esc(name)}</span></span>`;return}label.innerHTML=`<span class="skill-filter-toolbar-label"><span class="source-filter-btn-plain">${esc(t('list_filter_lineage_multi').replace('{n}',String(sel.length)))}</span></span>`}
async function toggleSkillPanel(p,ev){if(ev)ev.stopPropagation();const panel=document.getElementById(p+'SkillFilterPanel');const btn=document.getElementById(p+'SkillFilterBtn');const grid=document.getElementById(p+'SkillGrid');const search=document.getElementById(p+'SkillFilterSearch');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');if(p==='rankChar'||p==='rankUnit'){await ensureRankingBrowseFiltersEntity(p);if(grid&&browseFilterPanelNeedsRebuildRanking(grid,p)){grid.innerHTML=buildSkillBrowseHtml(p);markBrowseFilterPanelBuiltRanking(grid,p)}}else{await ensureBrowseFiltersEntity(p);if(grid&&browseFilterPanelNeedsRebuild(grid,p)){grid.innerHTML=buildSkillBrowseHtml(p);markBrowseFilterPanelBuilt(grid,p)}}if(search)search.placeholder=t('list_filter_search_placeholder');syncSkillBrowseCheckboxes(p);const combEnt=p==='rankChar'||p==='rankUnit'?p:p;const combKey=p==='char'?'browseCombCharSkill':p==='rankChar'?'browseCombRankCharSkill':p==='rankUnit'?'browseCombRankUnitAbil':'browseCombUnitAbil';ensureFilterPanelFooter(p+'SkillFilterPanel',{onClear:()=>clearSkillOnly(p),combineKey:combKey,combineEntity:combEnt});focusFilterSearchInput(p+'SkillFilterPanel',p+'SkillFilterSearch')}}
function buildAbilBrowseHtml(p){const pack=(p==='rankChar'?getRankBrowsePack('rankChar'):getBrowsePack(p))||{};let rows=groupBrowseRowsNoLevel(pack.abilities||[]);rows=normalizeCharAbilityBrowseRows(rows);const nameAttr=p+'AbilSel';let h='';rows.forEach((row,idx)=>{const ft=String(row.name||'').toLowerCase();if(row.icon){h+=`<label class="list-filter-tag-item skill-browse-row" data-skill-order="${idx}" data-filter-text="${escAttr(ft)}"><input type="checkbox" name="${nameAttr}" class="list-filter-sr skill-browse-item" value="${escAttr(String(row.id))}" onchange="onAbilBrowseItemChange('${p}')"><span class="tag-composite list-filter-tag-composite skill-browse-row-inner"><span class="tag-part-icon"><img class="skill-browse-ic" src="${imgUrl(row.icon)}" alt="" loading="lazy"></span><span class="tag-part-value">${esc(row.name)}</span></span></label>`}else{h+=`<label class="list-filter-tag-item skill-browse-row" data-skill-order="${idx}" data-filter-text="${escAttr(ft)}"><input type="checkbox" name="${nameAttr}" class="list-filter-sr skill-browse-item" value="${escAttr(String(row.id))}" onchange="onAbilBrowseItemChange('${p}')"><span class="tag-part-value">${esc(row.name)}</span></label>`}});return h}
function syncAbilBrowseCheckboxes(p){const key=p==='rankChar'?'listRankCharAbilities':'listCharAbilities';let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];const items=document.querySelectorAll(`input[name="${p}AbilSel"].skill-browse-item`);if(!sel.length){items.forEach(i=>i.checked=false)}else{items.forEach(i=>{i.checked=sel.some(s=>String(s)===String(i.value))})}}
function onAbilBrowseItemChange(p){const key=p==='rankChar'?'listRankCharAbilities':'listCharAbilities';const checked=Array.from(document.querySelectorAll(`input[name="${p}AbilSel"].skill-browse-item:checked`)).map(i=>i.value);S[key]=checked.length?checked:[];updateAbilBrowseFilterLabel(p);if(p==='rankChar')scheduleRankingListReload();else scheduleBrowseListReload('characters')}
function updateAbilBrowseFilterLabel(p){const key=p==='rankChar'?'listRankCharAbilities':'listCharAbilities';let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];const label=document.getElementById(p+'AbilFilterLabel');const btn=document.getElementById(p+'AbilFilterBtn');if(!label||!btn)return;btn.title=t('list_filter_ability_char');const pack=p==='rankChar'?getRankBrowsePack('rankChar'):getBrowsePack(p);let rows=groupBrowseRowsNoLevel((pack&&pack.abilities)||[]);rows=normalizeCharAbilityBrowseRows(rows);const allLbl=t('list_filter_all_abilities_char');const toolbarLead=`<img class="skill-filter-toolbar-ic" src="${imgUrl(CHAR_ABILITY_BROWSE_ALL_ICON)}" alt="" role="presentation">`;if(sel.length===0){label.innerHTML=`<span class="skill-filter-toolbar-label">${toolbarLead}<span class="source-filter-btn-plain">${esc(allLbl)}</span></span>`;btn.classList.remove('active');return}btn.classList.add('active');if(sel.length===1){let name=sel[0];const found=rows.find(x=>String(x.id)===String(sel[0]));if(found)name=found.name;const ic=found&&found.icon?`<img class="skill-filter-toolbar-ic" src="${imgUrl(found.icon)}" alt="" role="presentation">`:'';label.innerHTML=`<span class="skill-filter-toolbar-label">${ic}<span class="source-filter-btn-plain">${esc(name)}</span></span>`;return}label.innerHTML=`<span class="skill-filter-toolbar-label"><span class="source-filter-btn-plain">${esc(t('list_filter_lineage_multi').replace('{n}',String(sel.length)))}</span></span>`}
function filterAbilDropdown(p,q){const grid=document.getElementById(p+'AbilGrid');if(!grid)return;const qn=(q||'').trim().toLowerCase();const allRow=grid.querySelector('.skill-browse-all-row');const labels=Array.from(grid.querySelectorAll('.list-filter-tag-item'));if(!qn){labels.forEach(el=>{el.style.display=''});const rest=labels.filter(l=>l!==allRow).sort((a,b)=>parseInt(a.getAttribute('data-skill-order')||'999999',10)-parseInt(b.getAttribute('data-skill-order')||'999999',10));rest.forEach(el=>grid.appendChild(el));if(allRow)grid.insertBefore(allRow,grid.firstChild);return}labels.forEach(el=>{const t=el.getAttribute('data-filter-text')||'';el.style.display=!qn||t.includes(qn)?'':'none'})}
async function toggleAbilPanel(p,ev){if(ev)ev.stopPropagation();const panel=document.getElementById(p+'AbilFilterPanel');const btn=document.getElementById(p+'AbilFilterBtn');const grid=document.getElementById(p+'AbilGrid');const search=document.getElementById(p+'AbilFilterSearch');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');const isRank=p==='rankChar';if(isRank){await ensureRankingBrowseFiltersEntity('rankChar');if(grid&&browseFilterPanelNeedsRebuildRanking(grid,'rankChar')){grid.innerHTML=buildAbilBrowseHtml(p);markBrowseFilterPanelBuiltRanking(grid,'rankChar')}}else{await ensureBrowseFiltersEntity('char');if(grid&&browseFilterPanelNeedsRebuild(grid,'char')){grid.innerHTML=buildAbilBrowseHtml(p);markBrowseFilterPanelBuilt(grid,'char')}}if(search)search.placeholder=t('list_filter_search_placeholder');syncAbilBrowseCheckboxes(p);ensureFilterPanelFooter(p+'AbilFilterPanel',{onClear:isRank?()=>{S.listRankCharAbilities=[];syncAbilBrowseCheckboxes('rankChar');updateAbilBrowseFilterLabel('rankChar');void loadRankingList(1)}:clearAbilOnly,combineKey:isRank?'browseCombRankCharTrait':'browseCombCharTrait',combineEntity:isRank?'rankChar':'char'});focusFilterSearchInput(p+'AbilFilterPanel',p+'AbilFilterSearch')}}
function getAbilityQuerySuffix(which){let sel=S[which==='rankChar'?'listRankCharAbilities':'listCharAbilities'];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];if(!sel.length)return '';return '&ability_id='+encodeURIComponent(sel.join(','))}
function getLineageOpSuffix(which){const key=listLineageKey(which);let sel=S[key];if(!Array.isArray(sel)||sel.length<2)return '';const ck=lineageCombineKey(which);return '&lineage_op='+encodeURIComponent(S[ck]==='or'?'or':'and')}
function getSeriesOpSuffix(which){let sel=S[listSeriesKey(which)];if(!Array.isArray(sel)||sel.length<2)return '';const ck=seriesCombineKey(which);return '&series_op='+encodeURIComponent(S[ck]==='and'?'and':'or')}
function getCharSkillOpSuffix(){let sel=S.listCharSkills;if(!Array.isArray(sel)||sel.length<2)return '';return '&skill_op='+encodeURIComponent(S.browseCombCharSkill==='or'?'or':'and')}
function getCharTraitAbilityOpSuffix(){let sel=S.listCharAbilities;if(!Array.isArray(sel)||sel.length<2)return '';return '&ability_op='+encodeURIComponent(S.browseCombCharTrait==='or'?'or':'and')}
function getUnitBrowseAbilityOpSuffix(){let sel=S.listUnitAbilities;if(!Array.isArray(sel)||sel.length<2)return '';return '&ability_op='+encodeURIComponent(S.browseCombUnitAbil==='or'?'or':'and')}
function getTerrainOpSuffix(){let sel=S.listUnitTerrain;if(!Array.isArray(sel)||sel.length<2)return '';return '&terrain_op='+encodeURIComponent(S.browseCombTerrain==='or'?'or':'and')}
function getWeaponDebuffOpSuffix(){let sel=S.listUnitWeaponDebuff;if(!Array.isArray(sel)||sel.length<2)return '';return '&weapon_debuff_op='+encodeURIComponent(S.browseCombWb==='or'?'or':'and')}
function getWeaponRangeOpSuffix(){let sel=S.listUnitWeaponRange;if(!Array.isArray(sel)||sel.length<2)return '';return '&weapon_range_op='+encodeURIComponent(S.browseCombWr==='or'?'or':'and')}
function getMechanismOpSuffix(){let sel=S.listUnitMechanism;if(!Array.isArray(sel)||sel.length<2)return '';return '&mechanism_op='+encodeURIComponent(S.browseCombMech==='or'?'or':'and')}
const LIST_GRID_VARIANT_KEY='ggen_list_grid_variant';
function loadPersistedListGridVariant(){try{const s=localStorage.getItem(LIST_GRID_VARIANT_KEY);if(s){const o=JSON.parse(s);if(o&&typeof o==='object'){if(o.characters===1||o.characters===2)S.listGridVariant.characters=o.characters;if(o.units===1||o.units===2)S.listGridVariant.units=o.units}}}catch(e){}}
function persistListGridVariant(){try{localStorage.setItem(LIST_GRID_VARIANT_KEY,JSON.stringify(S.listGridVariant))}catch(e){}}
function getListGridVariant(tab){const v=S.listGridVariant&&S.listGridVariant[tab];return v===2?2:1}
function cycleListGridVariant(tab,ev){if(ev){ev.preventDefault();ev.stopPropagation()}if(!S.listGridVariant)S.listGridVariant={characters:2,units:2};const key=tab==='characters'?'characters':'units';S.listGridVariant[key]=getListGridVariant(key)===1?2:1;persistListGridVariant();syncGridVariantBadge(key==='characters'?'char':'unit');if(getListViewMode(key)==='grid'){if(key==='characters')loadCharacters(S.characters.page||1);else loadUnits(S.units.page||1)}}
function onGridViewBtnClick(tab,ev){if(ev&&ev.stopPropagation)ev.stopPropagation();const t=tab==='units'?'units':'characters';if(getListViewMode(t)!=='grid'){setListViewMode(t,'grid')}else{cycleListGridVariant(t,ev)}}
function syncGridVariantBadge(which){const tab=which==='char'?'characters':'units';const id=which==='char'?'charGridVarBadge':'unitGridVarBadge';const el=document.getElementById(id);if(!el)return;el.textContent=String(getListGridVariant(tab));el.style.display=getListViewMode(tab)==='grid'?'inline-flex':'none'}
function renderGridSkillRailItems(items){if(!items||!items.length)return'';return items.map(it=>{const tip=escAttr((it.detail||'').replace(/\r?\n/g,' '));const ic=it.icon?pictureRasterHtml(it.icon,{cls:'list-grid-skill-ic',loading:'lazy',alt:'',lazy:false}):'';return`<div class="list-grid-skill-chip" title="${tip}">${ic}<span class="list-grid-skill-name">${esc(it.name)}</span></div>`}).join('')}
function renderCharGridSkillStrip(items,max){const raw=Array.isArray(items)?items:[];const list=max>0?raw.slice(0,max):raw;if(!list.length)return'';return list.map(it=>{const nm=String(it.name||'').trim();const det=String(it.detail||'').replace(/\r?\n/g,' ').trim();const tip=escAttr(nm+(det?'\n\n'+det:''));const ic=it.icon?pictureRasterHtml(it.icon,{cls:'list-grid-skill-ic-only',loading:'lazy',alt:'',lazy:false}):`<span class="list-grid-skill-ic-fallback" aria-hidden="true"></span>`;return`<span class="list-grid-skill-icon-cell" title="${tip}">${ic}</span>`}).join('')}
function escAttr(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function applyBackgroundScrollLock(){if(typeof S._pageScrollLock!=='number')S._pageScrollLock=0;if(S._pageScrollLock===0)document.documentElement.classList.add('page-scroll-lock');S._pageScrollLock++}
function releaseBackgroundScrollLock(){if(typeof S._pageScrollLock!=='number'||S._pageScrollLock<=0){S._pageScrollLock=0;document.documentElement.classList.remove('page-scroll-lock');return}S._pageScrollLock--;if(S._pageScrollLock===0)document.documentElement.classList.remove('page-scroll-lock')}
function browseFilterPanelNeedsRebuild(el,entity){if(!el)return true;return el.dataset.bfPoolSig!==buildBrowsePoolSig(entity)}
function markBrowseFilterPanelBuilt(el,entity){if(!el)return;el.dataset.bfPoolSig=buildBrowsePoolSig(entity);el.dataset.populated='1'}
async function ensureBrowseFiltersEntity(entity){if(entity!=='char'&&entity!=='unit'&&entity!=='supp')return;const sigField=entity==='char'?'_poolSigChar':entity==='unit'?'_poolSigUnit':'_poolSigSupp';const sig=buildBrowsePoolSig(entity);const cur=S._browseFiltersByEntity;if(cur&&cur._lang===S.lang&&cur[sigField]===sig)return;const infl='_bfInfl'+entity;if(S[infl])return S[infl];S[infl]=(async()=>{const q=buildBrowsePoolQuery(entity);const apiEnt=entity==='char'?'characters':entity==='unit'?'units':'supporters';const langAtStart=S.lang;try{const r=await fetch(`/api/browse_filters?lang=${S.lang}&entity=${apiEnt}&filter_mode=current&${q}`);const data=await r.json();if(S.lang!==langAtStart)return;if(!S._browseFiltersByEntity||S._browseFiltersByEntity._lang!==S.lang){S._browseFiltersByEntity={_lang:S.lang,_poolSigChar:null,_poolSigUnit:null,_poolSigSupp:null,char:{lineages:[],series:[],skills:[],abilities:[]},unit:{lineages:[],series:[],abilities:[]},supp:{lineages:[]}}}const b=S._browseFiltersByEntity;b[sigField]=sig;if(entity==='char'){b.char={lineages:data.lineages||[],series:data.series||[],skills:data.skills||[],abilities:data.abilities||[]}}else if(entity==='unit'){b.unit={lineages:data.lineages||[],series:data.series||[],abilities:data.abilities||[]}}else{b.supp={lineages:data.lineages||[]}}}catch(e){if(S.lang!==langAtStart)return;if(!S._browseFiltersByEntity||S._browseFiltersByEntity._lang!==S.lang){S._browseFiltersByEntity={_lang:S.lang,_poolSigChar:null,_poolSigUnit:null,_poolSigSupp:null,char:{lineages:[],series:[],skills:[],abilities:[]},unit:{lineages:[],series:[],abilities:[]},supp:{lineages:[]}}}const b=S._browseFiltersByEntity;b[sigField]=sig;if(entity==='char'){b.char={lineages:[],series:[],skills:[],abilities:[]}}else if(entity==='unit'){b.unit={lineages:[],series:[],abilities:[]}}else{b.supp={lineages:[]}}}finally{S[infl]=null}})();return S[infl]}
async function ensureBrowseFiltersMeta(){await Promise.all([ensureBrowseFiltersEntity('char'),ensureBrowseFiltersEntity('unit'),ensureBrowseFiltersEntity('supp')])}
function getBrowsePack(p){return S._browseFiltersByEntity&&S._browseFiltersByEntity[p]&&S._browseFiltersByEntity._lang===S.lang?S._browseFiltersByEntity[p]:null}
function browseLineageRowMatchName(rows,wId){const w=String(wId||'').trim();if(!w||!rows||!rows.length)return'';for(let i=0;i<rows.length;i++){const row=rows[i],rid=String(row.id!=null?row.id:'');if(!rid)continue;if(rid===w)return String(row.name||'');if(w.length>=4&&rid.length>=4&&(rid.endsWith(w)||w.endsWith(rid)))return String(row.name||'')}return''}
function syncBrowseLineageNameHints(p){const g=document.getElementById(p+'LineageGrid');if(!g)return;const H=S._browseLineageNameHints=S._browseLineageNameHints||{},slot=H[p]=H[p]||{};g.querySelectorAll(`input[name="${p}LineageSel"].lineage-filter-item`).forEach(inp=>{const vid=String(inp.value||'');if(!vid)return;const part=inp.closest('.list-filter-tag-item');const tv=part&&part.querySelector('.tag-part-value');const nm=tv&&tv.textContent?String(tv.textContent).trim():'';if(nm)slot[vid]=nm})}
function buildLineageFilterHtml(p){const pack=(p==='rankChar'||p==='rankUnit'?getRankBrowsePack(p):getBrowsePack(p))||{lineages:[]};const rows=pack.lineages||[];const tagIcon=p==='char'||p==='rankChar'?LINEAGE_TAG_ICON_CHAR:LINEAGE_TAG_ICON_UNIT;let h=`<input type="search" class="filter-dd-search" placeholder="${esc(t('list_filter_search_placeholder'))}" autocomplete="off" oninput="debounceFilterBrowseDropdown('${p}','lineage')"><div class="filter-panel-scroll-inner"><div class="filter-panel-grid browse-lineage-grid" id="${p}LineageGrid">`;rows.forEach(row=>{const ft=String(row.name||'').toLowerCase();h+=`<label class="list-filter-tag-item" data-filter-text="${escAttr(ft)}"><input type="checkbox" name="${p}LineageSel" class="list-filter-sr lineage-filter-item" value="${escAttr(row.id)}" onchange="onLineageItemChange('${p}')"><span class="tag-composite list-filter-tag-composite"><span class="tag-part-icon"><img class="tag-icon-fg" src="${imgUrl(tagIcon)}" alt="" loading="lazy"></span><span class="tag-part-value">${esc(row.name)}</span></span></label>`});h+='</div></div>';return h}
function buildSeriesFilterHtml(p){const pack=(p==='rankChar'||p==='rankUnit'?getRankBrowsePack(p):getBrowsePack(p))||{series:[]};const rows=(pack.series||[]).slice().sort((a,b)=>{const ia=parseInt(String(a&&a.id),10),ib=parseInt(String(b&&b.id),10);const na=Number.isFinite(ia)?ia:0,nb=Number.isFinite(ib)?ib:0;if(na!==nb)return na-nb;return String(a&&a.name||'').localeCompare(String(b&&b.name||''))});let h=`<input type="search" class="filter-dd-search" placeholder="${esc(t('list_filter_search_placeholder'))}" autocomplete="off" oninput="debounceFilterBrowseDropdown('${p}','series')"><div class="filter-panel-scroll-inner"><div class="filter-panel-grid browse-series-grid" id="${p}SeriesGrid">`;rows.forEach(row=>{const ft=String(row.name||'').toLowerCase();const ic=row.icon?`<img class="tag-icon-fg" src="${imgUrl(row.icon)}" alt="" loading="lazy">`:`<span class="series-icon-fallback"></span>`;h+=`<label class="list-filter-tag-item" data-filter-text="${escAttr(ft)}"><input type="checkbox" name="${p}SeriesSel" class="list-filter-sr series-filter-item" value="${escAttr(row.id)}" onchange="onSeriesItemChange('${p}')"><span class="tag-composite list-filter-tag-composite list-filter-series-row"><span class="tag-part-icon">${ic}</span><span class="tag-part-value">${esc(row.name)}</span></span></label>`});h+='</div></div>';return h}
function filterBrowseDropdown(p,kind,q){const grid=document.getElementById(p+(kind==='lineage'?'LineageGrid':'SeriesGrid'));if(!grid)return;const qn=(q||'').trim().toLowerCase();grid.querySelectorAll('.list-filter-tag-item').forEach(el=>{const t=el.getAttribute('data-filter-text')||'';el.style.display=!qn||t.includes(qn)?'':'none'})}
function syncLineageCheckboxes(p){const key=listLineageKey(p);let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];const items=document.querySelectorAll(`input[name="${p}LineageSel"].lineage-filter-item`);if(!sel.length){items.forEach(i=>i.checked=false)}else{items.forEach(i=>{i.checked=sel.some(s=>String(s)===String(i.value))})}}
function syncSeriesCheckboxes(p){let sel=S[listSeriesKey(p)];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}const items=document.querySelectorAll(`input[name="${p}SeriesSel"].series-filter-item`);if(!sel.length){items.forEach(i=>i.checked=false)}else{items.forEach(i=>{i.checked=sel.some(s=>String(s)===String(i.value))})}}
function updateLineageFilterButtonLabel(which){const domP=which==='char'?'char':(which==='rankChar'?'rankChar':(which==='supp'?'supp':(which==='rankUnit'?'rankUnit':'unit')));const key=listLineageKey(which);let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel))sel=[];const label=document.getElementById(domP+'LineageFilterLabel');const btn=document.getElementById(domP+'LineageFilterBtn');if(!label||!btn)return;btn.title=t('list_filter_lineage');const ic=which==='char'||which==='rankChar'?LINEAGE_TAG_ICON_CHAR:LINEAGE_TAG_ICON_UNIT;if(sel.length===0){delete S['_linLblRf'+domP];label.innerHTML=`<span class="list-filter-btn-mini"><img class="filter-inline-icon role-filter-chip" src="${imgUrl(ic)}" alt="" role="presentation"><span class="source-filter-btn-plain">${esc(t('filter_source_all'))}</span></span>`;btn.classList.remove('active');return}btn.classList.add('active');const rows=filterLineageRowsForLabel(which);const hints=(S._browseLineageNameHints&&S._browseLineageNameHints[domP])||{};const parts=sel.map(id=>{const w=String(id).trim();if(!w)return '';const nm=rows&&rows.length?browseLineageRowMatchName(rows,w):'';return nm||(hints[w]||'')});if(parts.every(x=>x))delete S['_linLblRf'+domP];const miss=parts.some(x=>!x);if(miss&&!S['_linLblRf'+domP]){S['_linLblRf'+domP]=1;const infl=(which==='rankChar'||which==='rankUnit')?ensureRankingBrowseFiltersEntity(which).finally(()=>{syncBrowseLineageNameHints(domP);updateLineageFilterButtonLabel(which)}):ensureBrowseFiltersEntity(domP).finally(()=>{syncBrowseLineageNameHints(domP);updateLineageFilterButtonLabel(which)});void infl}const ellipsis='\u2026';const txt=parts.map(nm=>nm||ellipsis).join(', ');label.innerHTML=`<span class="list-filter-btn-mini"><img class="filter-inline-icon role-filter-chip" src="${imgUrl(ic)}" alt="" role="presentation"><span class="source-filter-btn-plain">${esc(txt)}</span></span>`}
function updateSeriesFilterButtonLabel(which){const domP=which==='char'?'char':(which==='rankChar'?'rankChar':(which==='rankUnit'?'rankUnit':'unit'));const key=listSeriesKey(which);let sel=S[key];if(sel==='ALL'||!sel)sel=[];if(!Array.isArray(sel)){if(String(sel).trim())sel=[String(sel)];else sel=[]}const label=document.getElementById(domP+'SeriesFilterLabel');const btn=document.getElementById(domP+'SeriesFilterBtn');if(!label||!btn)return;const seriesRows=filterSeriesRowsForLabel(which);const rowForSid=sid=>seriesRows.find(x=>String(x.id)===String(sid));if(sel.length===0){label.innerHTML=`<span class="list-filter-btn-mini series-filter-btn-all" title="${escAttr(t('series_filter_all_brand'))}"><img class="filter-inline-icon role-filter-chip" src="${imgUrl(SERIES_FILTER_ALL_LOGO)}" alt="" role="presentation"><span class="source-filter-btn-plain">${esc(t('filter_source_all'))}</span></span>`;btn.classList.remove('active');btn.title=t('list_filter_series');return}btn.classList.add('active');const names=sel.map(id=>{const f=rowForSid(id);return f&&f.name?String(f.name):String(id)});btn.title=names.join(', ');const iconsHtml=sel.map(id=>{const f=rowForSid(id);const nm=f&&f.name?String(f.name):String(id);const ic=f&&f.icon;if(ic)return`<img class="series-filter-toolbar-ic" src="${imgUrl(ic)}" alt="" role="presentation" title="${escAttr(nm)}">`;return`<span class="series-filter-toolbar-fallback" title="${escAttr(nm)}"></span>`}).join('');label.innerHTML=`<span class="series-filter-toolbar-icons">${iconsHtml}</span>`}
async function toggleLineagePanel(which,ev){if(ev)ev.stopPropagation();const domP=which==='char'?'char':(which==='rankChar'?'rankChar':(which==='supp'?'supp':(which==='rankUnit'?'rankUnit':'unit')));const panel=document.getElementById(domP+'LineageFilterPanel');const btn=document.getElementById(domP+'LineageFilterBtn');const body=document.getElementById(domP+'LineageFilterBody');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');if(which==='rankChar'||which==='rankUnit'){await ensureRankingBrowseFiltersEntity(which);if(body&&browseFilterPanelNeedsRebuildRanking(body,which)){body.innerHTML=buildLineageFilterHtml(domP);markBrowseFilterPanelBuiltRanking(body,which)}}else{await ensureBrowseFiltersEntity(domP);if(body&&browseFilterPanelNeedsRebuild(body,domP)){body.innerHTML=buildLineageFilterHtml(domP);markBrowseFilterPanelBuilt(body,domP)}}syncLineageCheckboxes(domP);syncBrowseLineageNameHints(domP);const combEnt=which==='rankChar'||which==='rankUnit'?which:(domP==='char'?'char':domP==='unit'?'unit':'supp');ensureFilterPanelFooter(domP+'LineageFilterPanel',{onClear:()=>clearLineageOnly(domP),combineKey:which==='char'?'browseCombCharLineage':which==='rankChar'?'browseCombRankCharLineage':which==='rankUnit'?'browseCombRankUnitLineage':which==='unit'?'browseCombUnitLineage':'browseCombSuppLineage',combineEntity:combEnt});focusFilterSearchInput(domP+'LineageFilterPanel','')}}
async function toggleSeriesPanel(which,ev){if(ev)ev.stopPropagation();const domP=which==='char'?'char':(which==='rankChar'?'rankChar':(which==='rankUnit'?'rankUnit':'unit'));const panel=document.getElementById(domP+'SeriesFilterPanel');const btn=document.getElementById(domP+'SeriesFilterBtn');const body=document.getElementById(domP+'SeriesFilterBody');if(!panel||!btn)return;const willOpen=panel.hidden;closeAllFilterPanels();if(willOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');if(which==='rankChar'||which==='rankUnit'){await ensureRankingBrowseFiltersEntity(which);if(body&&browseFilterPanelNeedsRebuildRanking(body,which)){body.innerHTML=buildSeriesFilterHtml(domP);markBrowseFilterPanelBuiltRanking(body,which)}}else{await ensureBrowseFiltersEntity(domP);if(body&&browseFilterPanelNeedsRebuild(body,domP)){body.innerHTML=buildSeriesFilterHtml(domP);markBrowseFilterPanelBuilt(body,domP)}}syncSeriesCheckboxes(domP);const combEnt=which==='rankChar'||which==='rankUnit'?which:domP;ensureFilterPanelFooter(domP+'SeriesFilterPanel',{onClear:()=>clearSeriesOnly(domP),combineKey:which==='char'?'browseCombCharSeries':which==='rankChar'?'browseCombRankCharSeries':which==='rankUnit'?'browseCombRankUnitSeries':'browseCombUnitSeries',combineEntity:combEnt});focusFilterSearchInput(domP+'SeriesFilterPanel','')}}
function onSeriesItemChange(p){const key=listSeriesKey(p);const checked=Array.from(document.querySelectorAll(`input[name="${p}SeriesSel"].series-filter-item:checked`)).map(i=>i.value);S[key]=checked.length?checked:[];updateSeriesFilterButtonLabel(p);if(p==='char')scheduleBrowseListReload('characters');else if(p==='unit')scheduleBrowseListReload('units');else if(p==='rankChar'||p==='rankUnit')scheduleRankingListReload()}
function onLineageItemChange(p){const domP=p==='char'?'char':(p==='rankChar'?'rankChar':(p==='supp'?'supp':(p==='rankUnit'?'rankUnit':'unit')));delete S['_linLblRf'+domP];const key=listLineageKey(p);const checked=Array.from(document.querySelectorAll(`input[name="${p}LineageSel"].lineage-filter-item:checked`)).map(i=>i.value);S[key]=checked.length?checked:[];syncBrowseLineageNameHints(p);updateLineageFilterButtonLabel(p);if(p==='char')scheduleBrowseListReload('characters');else if(p==='supp')scheduleBrowseListReload('supporters');else if(p==='unit')scheduleBrowseListReload('units');else if(p==='rankChar'||p==='rankUnit')scheduleRankingListReload()}
function listStatQChar(sp,cond){let q='';if(sp)q+='&sp=1';if(cond)q+='&cond=1';return q}
function listStatQUnit(sp,ssp,cond){let q='';if(ssp)q+='&stat_mode=ssp';else if(sp)q+='&stat_mode=sp';if(cond)q+='&cond=1';return q}
function getListStatQuery(which){if(which==='char')return listStatQChar(!!S.listCharSp,!!S.listCharCond);if(which==='unit')return listStatQUnit(!!S.listUnitSp,!!S.listUnitSsp,!!S.listUnitCond);return ''}
const BROWSE_LIST_JSON_CACHE_MAX=128;
const _browseListJsonCache=new Map();
function browseListJsonCacheGet(url){return _browseListJsonCache.get(url)}
function browseListJsonCacheSet(url,d){if(!d||typeof d.total!=='number')return;_browseListJsonCache.set(url,d);while(_browseListJsonCache.size>BROWSE_LIST_JSON_CACHE_MAX){const k=_browseListJsonCache.keys().next().value;_browseListJsonCache.delete(k)}}
function buildCharactersListUrl(p,pp,sp,cond){const s=S.characters;const q=document.getElementById('charFilter').value.trim();const roleQ=getRoleQuerySuffix('char');const rq=getRarityQuerySuffix('char');const stQ=listStatQChar(!!sp,!!cond);const srcQ=getSourceQuerySuffix('char');const linQ=getLineageQuerySuffix('char');const linOp=getLineageOpSuffix('char');const serQ=getSeriesQuerySuffix('char');const serOp=getSeriesOpSuffix('char');const skillQ=getSkillOrAbilityQuerySuffix('char');const skOp=getCharSkillOpSuffix();const abilQ=getAbilityQuerySuffix('char');const traitOp=getCharTraitAbilityOpSuffix();const gsQ=getListViewMode('characters')==='grid'&&getListGridVariant('characters')===2?'&grid_skills=1':'';return`/api/characters?lang=${S.lang}&page=${p}&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(q)}${roleQ}${rq}${stQ}${srcQ}${linQ}${linOp}${serQ}${serOp}${skillQ}${skOp}${abilQ}${traitOp}${gsQ}`}
function buildUnitsListApiUrl(p,pp,sp,ssp,cond){const s=S.units;const qRaw=document.getElementById('unitFilter').value.trim();const qApi=expandUnitSearchQuery(qRaw);const roleQ=getRoleQuerySuffix('unit');const rq=getRarityQuerySuffix('unit');const stQ=listStatQUnit(!!sp,!!ssp,!!cond);const srcQ=getSourceQuerySuffix('unit');const terrQ=getUnitTerrainQuerySuffix();const terrOp=getTerrainOpSuffix();const debQ=getUnitWeaponDebuffQuerySuffix();const debOp=getWeaponDebuffOpSuffix();const wrQ=getUnitWeaponRangeQuerySuffix();const wrOp=getWeaponRangeOpSuffix();const mechQ=getUnitMechanismQuerySuffix();const mechOp=getMechanismOpSuffix();const linQ=getLineageQuerySuffix('unit');const linOp=getLineageOpSuffix('unit');const serQ=getSeriesQuerySuffix('unit');const serOp=getSeriesOpSuffix('unit');const abQ=getSkillOrAbilityQuerySuffix('unit');const abOp=getUnitBrowseAbilityOpSuffix();const gsU=getListViewMode('units')==='grid'?'&grid_skills=1':'';return`/api/units?lang=${S.lang}&page=${p}&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(qApi)}${roleQ}${rq}${stQ}${srcQ}${terrQ}${terrOp}${debQ}${debOp}${wrQ}${wrOp}${mechQ}${mechOp}${linQ}${linOp}${serQ}${serOp}${abQ}${abOp}${gsU}`}
function loadPersistedListView(){const def={characters:'grid',units:'grid',supporters:'grid',stages:'grid',modifications:'grid'};try{const s=localStorage.getItem('ggen_list_view');if(s){const o=JSON.parse(s);Object.keys(def).forEach(k=>{if(o[k]==='grid'||o[k]==='table')def[k]=o[k]})}}catch(e){}S.listView=def}
function persistListView(){try{localStorage.setItem('ggen_list_view',JSON.stringify(S.listView))}catch(e){}}
function getListViewMode(tab){return(S.listView&&S.listView[tab])||'grid'}
function syncListViewToggleUI(tab){const mode=getListViewMode(tab);const map={characters:['charViewGrid','charViewTable'],units:['unitViewGrid','unitViewTable'],supporters:['suppViewGrid','suppViewTable'],stages:['stageViewGrid','stageViewTable'],modifications:['modViewGrid','modViewTable']};const m=map[tab];if(!m)return;const g=document.getElementById(m[0]),tb=document.getElementById(m[1]);if(g)g.classList.toggle('active',mode==='grid');if(tb)tb.classList.toggle('active',mode==='table');if(tab==='characters')syncGridVariantBadge('char');else if(tab==='units')syncGridVariantBadge('unit')}
function applyListViewVisibility(tab){const map={characters:{tw:'charTableWrap',gw:'charGridWrap'},units:{tw:'unitTableWrap',gw:'unitGridWrap'},supporters:{tw:'suppTableWrap',gw:'suppGridWrap'},stages:{tw:'stageTableWrap',gw:'stageGridWrap'},modifications:{tw:'modTableWrap',gw:'modGridWrap'}};const m=map[tab];if(!m)return;const mode=getListViewMode(tab);const tw=document.getElementById(m.tw),gw=document.getElementById(m.gw);if(!tw||!gw)return;const isGrid=mode==='grid';tw.hidden=isGrid;gw.hidden=!isGrid;if(tab==='characters')syncGridVariantBadge('char');else if(tab==='units')syncGridVariantBadge('unit')}
function setListViewMode(tab,mode){if(!S.listView||S.listView[tab]===undefined)return;if(S.listView[tab]===mode)return;S.listView[tab]=mode;persistListView();syncListViewToggleUI(tab);applyListViewVisibility(tab);if(tab==='characters')loadCharacters(S.characters.page||1);else if(tab==='units')loadUnits(S.units.page||1);else if(tab==='supporters')loadSupporters(S.supporters.page||1);else if(tab==='stages')loadStages(S.stages.page||1);else if(tab==='modifications')loadModifications(S.modifications.page||1)}
function updateListViewToggleLabels(){const pairs=[['charViewGrid','charViewTable'],['unitViewGrid','unitViewTable'],['suppViewGrid','suppViewTable'],['stageViewGrid','stageViewTable'],['modViewGrid','modViewTable']];pairs.forEach(([gid,tid])=>{const ge=document.getElementById(gid),te=document.getElementById(tid);if(ge){ge.title=t('view_grid');ge.setAttribute('aria-label',t('view_grid'))}if(te){te.title=t('view_table');te.setAttribute('aria-label',t('view_table'))}});document.querySelectorAll('.list-view-toggle').forEach(el=>{el.setAttribute('aria-label',t('view_grid')+' / '+t('view_table'))})}
function loadPersistedListStatToggles(){try{const gc=localStorage.getItem('ggen_list_char_cond'),gs=localStorage.getItem('ggen_list_char_sp'),uc=localStorage.getItem('ggen_list_unit_cond'),us=localStorage.getItem('ggen_list_unit_sp'),ux=localStorage.getItem('ggen_list_unit_ssp');if(gc==='1')S.listCharCond=true;else if(gc==='0')S.listCharCond=false;if(gs==='1')S.listCharSp=true;else if(gs==='0')S.listCharSp=false;if(uc==='1')S.listUnitCond=true;else if(uc==='0')S.listUnitCond=false;if(us==='1')S.listUnitSp=true;else if(us==='0')S.listUnitSp=false;if(ux==='1')S.listUnitSsp=true;else if(ux==='0')S.listUnitSsp=false}catch(e){}}
function persistListStatToggles(){try{localStorage.setItem('ggen_list_char_cond',S.listCharCond?'1':'0');localStorage.setItem('ggen_list_char_sp',S.listCharSp?'1':'0');localStorage.setItem('ggen_list_unit_cond',S.listUnitCond?'1':'0');localStorage.setItem('ggen_list_unit_sp',S.listUnitSp?'1':'0');localStorage.setItem('ggen_list_unit_ssp',S.listUnitSsp?'1':'0')}catch(e){}}
function syncListCharToggle(){const b=document.getElementById('charListSpBtn');if(b)b.classList.toggle('active',!!S.listCharSp)}
function syncListUnitStatToggles(){const sp=document.getElementById('unitListSpBtn'),ssp=document.getElementById('unitListSspBtn');if(sp)sp.classList.toggle('active',!!S.listUnitSp);if(ssp)ssp.classList.toggle('active',!!S.listUnitSsp)}
function syncListCondToggles(){const c=document.getElementById('charListCondBtn'),u=document.getElementById('unitListCondBtn');if(c){c.classList.toggle('active',!!S.listCharCond);c.title=t('conditional_passive')}if(u){u.classList.toggle('active',!!S.listUnitCond);u.title=t('conditional_passive')}}
function toggleListCharSp(){S.listCharSp=!S.listCharSp;syncListCharToggle();persistListStatToggles();scheduleBrowseListReload('characters',S.characters.page||1)}
function toggleListCharCond(){S.listCharCond=!S.listCharCond;syncListCondToggles();persistListStatToggles();scheduleBrowseListReload('characters',S.characters.page||1)}
function toggleListUnitSp(){if(S.listUnitSp){S.listUnitSp=false}else{S.listUnitSp=true;S.listUnitSsp=false}syncListUnitStatToggles();persistListStatToggles();scheduleBrowseListReload('units',S.units.page||1)}
function toggleListUnitSsp(){if(S.listUnitSsp){S.listUnitSsp=false}else{S.listUnitSsp=true;S.listUnitSp=false}syncListUnitStatToggles();persistListStatToggles();scheduleBrowseListReload('units',S.units.page||1)}
function toggleListUnitCond(){S.listUnitCond=!S.listUnitCond;syncListCondToggles();persistListStatToggles();scheduleBrowseListReload('units',S.units.page||1)}
function onRoleRowClick(which,id,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const p=rolePrefix(which);if(!ROLE_LIST_IDS.includes(id))return;const boxes=ROLE_LIST_IDS.map(rid=>document.getElementById(p+'Role'+rid));ROLE_LIST_IDS.forEach((rid,i)=>{if(boxes[i])boxes[i].checked=(rid===id)});onRoleFilterChange(which)}
function onRoleRowKey(ev,which,id){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onRoleRowClick(which,id,ev)}
function onRoleCheckboxChange(which,id,ev){onRoleFilterChange(which)}
function onRoleFilterChange(which){updateRoleFilterButtonLabel(which);if(which==='char')scheduleBrowseListReload('characters');else if(which==='unit')scheduleBrowseListReload('units');else if(which==='rankChar'||which==='rankUnit')scheduleRankingListReload()}
function onRarityRowClick(which,key,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const p=rarityPrefix(which);const keys=rarityKeysFor(which);if(!keys.includes(key))return;const boxes=keys.map(k=>document.getElementById(p+'Rarity'+k));const ltEl=document.getElementById(p+'RarityLT');keys.forEach((k,i)=>{if(boxes[i])boxes[i].checked=(k===key)});if(ltEl)ltEl.checked=false;onRarityFilterChange(which)}
function onRarityRowKey(ev,which,key){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onRarityRowClick(which,key,ev)}
function onRarityStarCheckboxChange(which,key,ev){onRarityFilterChange(which)}
function onRarityLtCheckboxChange(which,ev){onRarityFilterChange(which)}
function onRarityLtRowClick(which,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const p=rarityPrefix(which);const keys=rarityKeysFor(which);const boxes=keys.map(k=>document.getElementById(p+'Rarity'+k));const ltEl=document.getElementById(p+'RarityLT');keys.forEach((k,i)=>{if(boxes[i])boxes[i].checked=false});if(ltEl)ltEl.checked=true;onRarityFilterChange(which)}
function onRarityLtRowKey(ev,which){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();onRarityLtRowClick(which,ev)}
function onRarityFilterChange(which){updateRarityFilterButtonLabel(which);if(which==='char'){const se=document.getElementById('charSkillFilterSearch'),grid=document.getElementById('charSkillGrid');if(se&&grid&&grid.dataset.populated)filterSkillDropdown('char',se.value||'');scheduleBrowseListReload('characters')}else if(which==='rankChar'){const se=document.getElementById('rankCharSkillFilterSearch'),grid=document.getElementById('rankCharSkillGrid');if(se&&grid&&grid.dataset.populated)filterSkillDropdown('rankChar',se.value||'');scheduleRankingListReload()}else if(which==='unit'){const se=document.getElementById('unitSkillFilterSearch'),grid=document.getElementById('unitSkillGrid');if(se&&grid&&grid.dataset.populated)filterSkillDropdown('unit',se.value||'');scheduleBrowseListReload('units')}else if(which==='rankUnit'){const se=document.getElementById('rankUnitSkillFilterSearch'),grid=document.getElementById('rankUnitSkillGrid');if(se&&grid&&grid.dataset.populated)filterSkillDropdown('rankUnit',se.value||'');scheduleRankingListReload()}else scheduleBrowseListReload('supporters')}
function switchTab(tab){S.currentTab=tab;document.querySelectorAll('.nav-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('active',x.id===`panel-${tab}`));bindSearchRecallObserver();if(document.getElementById('searchSpotlightOverlay')&&document.getElementById('searchSpotlightOverlay').classList.contains('active')){const inp=document.getElementById('searchSpotlightInput'),real=getActiveSearchInput();if(inp&&real){inp.value=real.value;if(real.classList.contains('filter-input--organic'))syncBrowseSearchWidth(real.id)}const tl=document.getElementById('searchSpotlightTabLine');if(tl)tl.textContent=getTabNameForSpotlight();debounceSpotlightResults()}if(tab==='latest_release'){syncHistoryToBrowsePath('/new');tryLoadLatestRelease()}else if(tab==='banner_timeline'){delete S._btFabLastScrollSt;S._btFabShown=false;S._btFabDownAccum=0;syncHistoryToBrowsePath('/tl');loadBannerTimeline()}else if(tab==='calculator'){if(/^\/op\/[^/]+\/?$/.test(location.pathname))syncHistoryToBrowsePath('/');renderDcStageDropdown();_dcEnsureAttackerSlots();renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();renderDcDefStats();onDcParamChange()}else if(tab==='team_builder'){if(/^\/op\/[^/]+\/?$/.test(location.pathname))syncHistoryToBrowsePath('/');initTeamBuilder();void tbRefreshSlottedUnitData().then(async()=>{await tbAutoFillEmptyOptionParts({skipRender:true});renderTeamBuilder();setTimeout(tbPrimePickerCaches,0)})}else if(tab==='ranking'){if(/^\/(?:u|c|s|es|op)\/[^/]+\/?$/.test(location.pathname))syncHistoryToBrowsePath('/rk');onRankingTabShown()}else{if(tab!=='latest_release'&&/^\/new\/?$/.test(location.pathname))syncHistoryToBrowsePath('/');if(tab!=='banner_timeline'&&/^\/banners\/?$/.test(location.pathname))syncHistoryToBrowsePath('/');if(tab!=='modifications'&&/^\/op\/[^/]+\/?$/.test(location.pathname))syncHistoryToBrowsePath('/');if(tab!=='ranking'&&/^\/rk\/?$/.test(location.pathname))syncHistoryToBrowsePath('/');applyListViewVisibility(tab);primeBrowseTabIfNeeded(tab);if(tab==='stages')syncStageSourceToolbar()}syncMainTabShortPath(tab);updateBannerTimelineScrollFabVisibility()}
function updateSearchHintVisibility(inputId){const inp=document.getElementById(inputId);if(!inp)return;const wrap=inp.closest('.filter-input-wrap');if(!wrap)return;if(inp.value.trim()){wrap.classList.add('hint-suppressed');wrap.classList.remove('show-hint')}else{wrap.classList.remove('hint-suppressed')}}
function initSearchHints(){document.querySelectorAll('.filter-input-wrap').forEach(wrap=>{const inp=wrap.querySelector('.filter-input');if(!inp)return;function refresh(){updateSearchHintVisibility(inp.id);if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inp.id)}inp.addEventListener('input',refresh);inp.addEventListener('mouseenter',()=>{if(!inp.value.trim())wrap.classList.add('show-hint')});inp.addEventListener('mouseleave',()=>{wrap.classList.remove('show-hint')});refresh()})}
function getActiveSearchInput(){if(S.currentTab==='ranking'){const id=S.ranking.mode==='characters'?'rankCharFilter':'rankUnitFilter';return document.getElementById(id)}const m={characters:'charFilter',units:'unitFilter',supporters:'suppFilter',stages:'stageFilter',modifications:'modFilter'};const id=m[S.currentTab];return id?document.getElementById(id):null}
function getTabSearchPlaceholderKey(){if(S.currentTab==='ranking')return S.ranking.mode==='characters'?'search_char':'search_unit';const m={characters:'search_char',units:'search_unit',supporters:'search_supporter',stages:'search_stage',modifications:'search_mod'};return m[S.currentTab]||'search_char'}
function getTabNameForSpotlight(){if(S.currentTab==='ranking')return t('tab_ranking');const m={characters:'tab_char',units:'tab_unit',supporters:'tab_supporter',stages:'tab_stage',modifications:'tab_mod'};return t(m[S.currentTab]||'tab_char')}
function onSearchSpotlightInput(){const real=getActiveSearchInput();const inp=document.getElementById('searchSpotlightInput');if(!real||!inp)return;real.value=inp.value;updateSearchHintVisibility(real.id);if(real.classList.contains('filter-input--organic'))syncBrowseSearchWidth(real.id);const tabById={charFilter:'characters',unitFilter:'units',suppFilter:'supporters',stageFilter:'stages',modFilter:'modifications'};const tab=tabById[real.id];if(real.id==='rankCharFilter'||real.id==='rankUnitFilter')scheduleRankingListReload();else if(tab)debounceLoad(tab);debounceSpotlightResults()}
function clearSpotlightResults(){const box=document.getElementById('searchSpotlightResults');if(box){box.innerHTML='';box.hidden=true}}
function debounceSpotlightResults(){clearTimeout(S._spotlightFt);S._spotlightFt=setTimeout(refreshSpotlightResults,220)}
async function refreshSpotlightResults(){const ov=document.getElementById('searchSpotlightOverlay');const box=document.getElementById('searchSpotlightResults');if(!ov||!ov.classList.contains('active')||!box)return;const qEl=getActiveSearchInput();const q=qEl?qEl.value.trim():'';if(!q){clearSpotlightResults();return}box.hidden=false;box.innerHTML='<div class="search-spotlight-results-loading">…</div>';const tab=S.currentTab;const pp=8;try{let url='';if(tab==='characters'){const s=S.characters;const roleQ=getRoleQuerySuffix('char');const rq=getRarityQuerySuffix('char');const stQ=getListStatQuery('char');const srcQ=getSourceQuerySuffix('char');const linQ=getLineageQuerySuffix('char');const linOp=getLineageOpSuffix('char');const serQ=getSeriesQuerySuffix('char');const serOp=getSeriesOpSuffix('char');const skillQ=getSkillOrAbilityQuerySuffix('char');const skOp=getCharSkillOpSuffix();const abilQ=getAbilityQuerySuffix('char');const traitOp=getCharTraitAbilityOpSuffix();const gsQ=getListViewMode('characters')==='grid'&&getListGridVariant('characters')===2?'&grid_skills=1':'';url=`/api/characters?lang=${S.lang}&page=1&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(q)}${roleQ}${rq}${stQ}${srcQ}${linQ}${linOp}${serQ}${serOp}${skillQ}${skOp}${abilQ}${traitOp}${gsQ}`}else if(tab==='units'){const s=S.units;const qU=expandUnitSearchQuery(q);const roleQ=getRoleQuerySuffix('unit');const rq=getRarityQuerySuffix('unit');const stQ=getListStatQuery('unit');const srcQ=getSourceQuerySuffix('unit');const terrQ=getUnitTerrainQuerySuffix();const terrOp=getTerrainOpSuffix();const debQ=getUnitWeaponDebuffQuerySuffix();const debOp=getWeaponDebuffOpSuffix();const mechQ=getUnitMechanismQuerySuffix();const mechOp=getMechanismOpSuffix();const linQ=getLineageQuerySuffix('unit');const linOp=getLineageOpSuffix('unit');const serQ=getSeriesQuerySuffix('unit');const serOp=getSeriesOpSuffix('unit');const abQ=getSkillOrAbilityQuerySuffix('unit');const abOp=getUnitBrowseAbilityOpSuffix();const gsU=getListViewMode('units')==='grid'?'&grid_skills=1':'';url=`/api/units?lang=${S.lang}&page=1&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(qU)}${roleQ}${rq}${stQ}${srcQ}${terrQ}${terrOp}${debQ}${debOp}${mechQ}${mechOp}${linQ}${linOp}${serQ}${serOp}${abQ}${abOp}${gsU}`}else if(tab==='supporters'){const s=S.supporters;const rq=getRarityQuerySuffix('supp');const linQ=getLineageQuerySuffix('supp');const linOp=getLineageOpSuffix('supp');url=`/api/supporters?lang=${S.lang}&page=1&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(q)}${rq}${linQ}${linOp}`}else if(tab==='stages'){const s=S.stages;const df=s.difficultyFilter==='ALL'?'':s.difficultyFilter;const cat=(s.source||'eternal')==='score_attack'?'score_attack':'eternal';url=`/api/stages?lang=${S.lang}&page=1&per_page=${pp}&q=${encodeURIComponent(q)}&difficulty=${encodeURIComponent(df)}&sort=${s.sort}&dir=${s.dir}&category=${encodeURIComponent(cat)}`}else if(tab==='modifications'){const s=S.modifications;const ef=encodeURIComponent(s.effectFilter||'ALL');url=`/api/option_parts?lang=${S.lang}&page=1&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(q)}&rarity=ALL&effect=${ef}`}else if(tab==='ranking'){url=S.ranking.mode==='characters'?buildRankingCharactersListUrl(1,pp):buildRankingUnitsListUrl(1,pp)}else{clearSpotlightResults();return}const r=await fetch(url);const d=await r.json();const rows=d.rows||[];if(!rows.length){box.innerHTML=`<div class="search-spotlight-results-empty">${esc(t('search_spotlight_empty'))}</div>`;return}let h='';if(tab==='characters'){rows.forEach(row=>{h+=`<button type="button" class="search-spotlight-row" data-detail-type="character" data-detail-id="${escAttr(String(row.id))}" onclick="openDetail('character','${escJs(row.id)}')">${renderListThumb(row,'char',44)}<div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${esc(row.name)}</div><div class="search-spotlight-row-meta">${esc(row.rarity||'')}</div></div></button>`})}else if(tab==='units'){rows.forEach(row=>{h+=`<button type="button" class="search-spotlight-row" data-detail-type="unit" data-detail-id="${escAttr(String(row.id))}" onclick="openDetail('unit','${escJs(row.id)}')">${renderListThumb(row,'unit',44)}<div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${esc(row.name)}</div><div class="search-spotlight-row-meta">${esc(row.rarity||'')}</div></div></button>`})}else if(tab==='supporters'){rows.forEach(row=>{h+=`<button type="button" class="search-spotlight-row" data-detail-type="supporter" data-detail-id="${escAttr(String(row.id))}" onclick="openDetail('supporter','${escJs(row.id)}')">${renderListThumb(row,'supp',44)}<div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${esc(row.name)}</div><div class="search-spotlight-row-meta">${esc(row.rarity||'')}</div></div></button>`})}else if(tab==='stages'){rows.forEach(row=>{const locked=!!row.content_locked;const ph=locked?'🔒':(row.portrait?imgTag(row.portrait,{cls:'search-spotlight-stage-img',webp:true,onerror:"this.parentElement.innerHTML='🗺️'"}) :'🗺️');const rowName=locked?esc(t('er_stage_redacted_row')):esc(row.name);const metaLn=locked?'—':row.stage_category==='score_attack'?`#${fmtN(row.stage_number)}`:`${esc(row.difficulty_name||'')} · #${fmtN(row.stage_number)}`;h+=`<button type="button" class="search-spotlight-row" data-detail-type="stage" data-detail-id="${escAttr(String(row.id))}" onclick="openDetail('stage','${escJs(row.id)}')"><div class="search-spotlight-stage-thumb">${ph}</div><div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${rowName}</div><div class="search-spotlight-row-meta">${metaLn}</div></div></button>`})}else if(tab==='modifications'){rows.forEach(row=>{const ic=row.thum?imgTag(row.thum,{cls:'row-thum mod-icon',webp:true,onerror:"this.style.display='none'"}) :'<span class="search-spotlight-stage-thumb">⚙</span>';h+=`<button type="button" class="search-spotlight-row" data-detail-type="option_part" data-detail-id="${escAttr(String(row.id))}" onclick="closeSearchSpotlight();openDetail('option_part','${escJs(String(row.id))}')">${ic}<div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${esc(row.name)}</div><div class="search-spotlight-row-meta">${esc(t('tab_mod'))}</div></div></button>`})}else if(tab==='ranking'){if(S.ranking.mode==='characters'){rows.forEach(row=>{const ro=rankingDetailOptsFromContext('character');h+=`<button type="button" class="search-spotlight-row" data-detail-type="character" data-detail-id="${escAttr(String(row.id))}" onclick='openDetail("character","${escJs(row.id)}",${JSON.stringify(ro)})'>${renderListThumb(row,'char',44)}<div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${esc(row.name)}</div><div class="search-spotlight-row-meta">${esc(row.rarity||'')}</div></div></button>`})}else{rows.forEach(row=>{const ro=rankingDetailOptsFromContext('unit');h+=`<button type="button" class="search-spotlight-row" data-detail-type="unit" data-detail-id="${escAttr(String(row.id))}" onclick='openDetail("unit","${escJs(row.id)}",${JSON.stringify(ro)})'>${renderListThumb(row,'unit',44)}<div class="search-spotlight-row-text"><div class="search-spotlight-row-name">${esc(row.name)}</div><div class="search-spotlight-row-meta">${esc(row.rarity||'')}</div></div></button>`})}}box.innerHTML=h}catch(e){box.innerHTML=`<div class="search-spotlight-results-empty">${esc(String(e))}</div>`}}
function closeSearchSpotlight(){const ov=document.getElementById('searchSpotlightOverlay');if(!ov||!ov.classList.contains('active'))return;clearSpotlightResults();const real=getActiveSearchInput();const inp=document.getElementById('searchSpotlightInput');if(real&&inp){real.value=inp.value;updateSearchHintVisibility(real.id);if(real.classList.contains('filter-input--organic'))syncBrowseSearchWidth(real.id)}ov.classList.remove('active');ov.setAttribute('aria-hidden','true');document.body.classList.remove('search-spotlight-open');releaseBackgroundScrollLock()}
function scrollActiveListToolbarIntoView(){try{const pan=document.getElementById('panel-'+S.currentTab);const el=pan&&pan.querySelector('.list-toolbar');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}catch(_){}}
function afterListLoadIfSpotlightOpen(){const ov=document.getElementById('searchSpotlightOverlay');if(!ov||!ov.classList.contains('active'))return;requestAnimationFrame(()=>scrollActiveListToolbarIntoView())}
function openSearchSpotlight(){if(S.currentTab==='latest_release'||S.currentTab==='banner_timeline'||S.currentTab==='calculator'||S.currentTab==='team_builder')return;const real=getActiveSearchInput();if(!real)return;const ov=document.getElementById('searchSpotlightOverlay');const inp=document.getElementById('searchSpotlightInput');const hint=document.getElementById('searchSpotlightHint');const tabLine=document.getElementById('searchSpotlightTabLine');const title=document.getElementById('searchSpotlightTitle');const foot=document.getElementById('searchSpotlightFoot');if(!ov||!inp)return;const spotWasActive=ov.classList.contains('active');inp.value=real.value;inp.placeholder=t(getTabSearchPlaceholderKey());if(title)title.textContent=t('search_spotlight_title');if(tabLine)tabLine.textContent=getTabNameForSpotlight();if(hint)hint.innerHTML=t('search_hint_html');if(foot)foot.textContent=t('search_spotlight_foot');const sc=document.getElementById('searchSpotlightClose');if(sc)sc.setAttribute('aria-label',t('search_spotlight_close'));ov.classList.add('active');ov.setAttribute('aria-hidden','false');document.body.classList.add('search-spotlight-open');if(!spotWasActive)applyBackgroundScrollLock();requestAnimationFrame(()=>{try{inp.focus({preventScroll:true});inp.select()}catch(_){inp.focus()}});debounceSpotlightResults()}
function recallSearchBar(){openSearchSpotlight()}
function bindSearchRecallObserver(){const fab=document.getElementById('searchRecallFab');if(S._searchRecallObs){S._searchRecallObs.disconnect();S._searchRecallObs=null}if(!fab)return;if(S.currentTab==='latest_release'||S.currentTab==='banner_timeline'||S.currentTab==='calculator'||S.currentTab==='team_builder'){fab.classList.remove('visible');return}const panel=document.getElementById('panel-'+S.currentTab);if(!panel){fab.classList.remove('visible');return}let anchor=null;if(S.currentTab==='ranking'){anchor=document.getElementById(S.ranking&&S.ranking.mode==='characters'?'rankCharFilter':'rankUnitFilter')}if(!anchor)anchor=panel.querySelector('.browse-toolbar-top-row');if(!anchor)anchor=panel.querySelector('.list-toolbar-left>.browse-toolbar-leading');if(!anchor)anchor=panel.querySelector('.list-toolbar');if(!anchor){fab.classList.remove('visible');return}function applyRecallFabFromIO(ents){const e=ents&&ents[0];fab.classList.toggle('visible',!!e&&!e.isIntersecting)}S._searchRecallObs=new IntersectionObserver(applyRecallFabFromIO,{root:null,threshold:0,rootMargin:'-72px 0px 0px 0px'});S._searchRecallObs.observe(anchor);requestAnimationFrame(()=>{try{applyRecallFabFromIO(S._searchRecallObs.takeRecords())}catch(_){}})}
function tryLoadLatestRelease(){loadLatestRelease()}
function showLrLockModal(){const o=document.getElementById('lrLockOverlay');if(!o)return;o.style.display='flex';const err=document.getElementById('lrLockErr');if(err)err.textContent='';const inp=document.getElementById('lrLockInput');if(inp)inp.value='';fillLrLockTexts();setTimeout(()=>{if(inp)inp.focus()},80)}
function hideLrLockModal(){const o=document.getElementById('lrLockOverlay');if(o)o.style.display='none'}
async function submitLrUnlock(){const inp=document.getElementById('lrLockInput');const pw=inp?String(inp.value||''):'';const err=document.getElementById('lrLockErr');if(err)err.textContent='';try{const r=await fetch('/api/latest_release/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});const d=await r.json().catch(()=>({}));if(!r.ok){if(err)err.textContent=t('lr_pw_wrong');return}hideLrLockModal();S.lrCacheKey=null;S.lrCacheData=null;S.btCacheKey=null;S.btCacheData=null;_dcStagesCache=null;_dcStagesFetchLang=null;if(S.currentTab==='stages')loadStages(S.stages.page||1);if(S.currentTab==='calculator'){await renderDcStageDropdown();const _st=document.getElementById('dcStageSelect');if(_st&&_st.value)void onDcStageChange()}if(S.currentTab==='characters')loadCharacters(S.characters.page||1);else if(S.currentTab==='units')loadUnits(S.units.page||1);else if(S.currentTab==='supporters')loadSupporters(S.supporters.page||1);loadLatestRelease()}catch(e){if(err)err.textContent=String(e)}}
async function loadLatestRelease(loadAll){const root=document.getElementById('latestReleaseRoot');const load=document.getElementById('latestReleaseLoading');if(!root)return;hideLrLockModal();const fullQ=loadAll===true?'&full=1':'';const cacheKey=S.lang+'|'+(loadAll===true?'full':'recent');if(S.lrCacheKey===cacheKey&&S.lrCacheData){renderLatestRelease(S.lrCacheData);return}if(load)load.style.display='flex';try{const r=await fetch('/api/latest_release?lang='+encodeURIComponent(S.lang)+fullQ,{credentials:'same-origin'});if(r.status===401){const d=await r.json().catch(()=>({}));if(d.locked){showLrLockModal();root.innerHTML='';if(load)load.style.display='none';return}}if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();S.lrCacheKey=cacheKey;S.lrCacheData=d;renderLatestRelease(d)}catch(e){S.lrCacheKey=null;S.lrCacheData=null;root.innerHTML='<div class="empty-state"><div class="empty-state-text">'+esc(String(e))+'</div></div>'}finally{if(load)load.style.display='none'}}
function loadMoreLatestRelease(){loadLatestRelease(true)}
function renderLatestRelease(d){const root=document.getElementById('latestReleaseRoot');const groups=d.groups||[];const hasMore=!!d.has_more;const scope=d.scope||'recent';function cardsForGroup(g){let s='';(g.items||[]).forEach(it=>{const typeLabel=it.type==='unit'?t('lr_type_unit'):(it.type==='character'?t('lr_type_char'):t('lr_type_supp'));const row={thum:it.thum,rarity:it.rarity||'N',role_icon:it.role_icon||'',acquisition_icon:it.acquisition_icon||'',special_icons:it.special_icons||[],is_ultimate:it.is_ultimate};const thumb=renderListThumb(row,it.type==='supporter'?'supp':it.type,72);s+='<div class="lr-card" data-detail-type="'+escAttr(String(it.type))+'" data-detail-id="'+escAttr(String(it.id))+'" onclick="openDetail(\''+it.type+'\',\''+escJs(it.id)+'\')"><div class="lr-card-type">'+esc(typeLabel)+'</div><div class="lr-card-thumb">'+thumb+'</div><div class="lr-card-name">'+esc(it.name)+'</div></div>'});return s}if(!groups.length){if(hasMore){root.innerHTML='<div class="lr-page-title">'+esc(t('latest_gasha_title'))+'</div><div class="empty-state"><div class="empty-state-text">'+esc(t('lr_empty_recent'))+'</div></div><div class="lr-load-more-wrap"><button type="button" class="lr-load-more-btn" onclick="loadMoreLatestRelease()">'+esc(t('lr_load_more'))+'</button></div>';return}root.innerHTML='<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">'+t('lr_empty')+'</div></div>';return}let h='<div class="lr-page-title">'+esc(t('latest_gasha_title'))+'</div>';groups.forEach(g=>{const inner=g.locked?'<div class="lr-locked-banner"><span class="lr-locked-icon">🔒</span><span class="lr-locked-text">'+esc(t('lr_section_locked'))+'</span><button type="button" class="lr-unlock-inline-btn" onclick="showLrLockModal()">'+esc(t('lr_unlock_btn'))+'</button></div>':'<div class="lr-row">'+cardsForGroup(g)+'</div>';h+='<section class="lr-section"><h2 class="lr-date">'+esc(g.start_datetime_jst||'')+'</h2>'+inner+'</section>'});if(hasMore&&scope!=='full'){h+='<div class="lr-load-more-wrap"><button type="button" class="lr-load-more-btn" onclick="loadMoreLatestRelease()">'+esc(t('lr_load_more'))+'</button></div>'}root.innerHTML=h}
function btFeaturedCell(items,tpx){let px=tpx!=null&&tpx!==undefined?Number(tpx):52;if(Number.isNaN(px)||px<32)px=52;if(!items||!items.length)return'<span class="bt-strip-empty">—</span>';let h='';items.forEach(it=>{const row={thum:it.thum,rarity:it.rarity||'N',role_icon:it.role_icon||'',acquisition_icon:it.acquisition_icon||'',special_icons:Array.isArray(it.special_icons)?it.special_icons:[],is_ultimate:!!it.is_ultimate};const typ=it.type==='character'?'character':it.type==='supporter'?'supporter':'unit';const thumbKind=typ==='character'?'char':typ==='supporter'?'supp':'unit';const lim=!!it.is_limited_time;const limCls=lim?(' bt-lr-tile--limited bt-lr-tile--lt-'+typ):'';const lbl=t('limited_label');const nm=String(it.name||'');const aria=lim?escAttr(nm+' — '+lbl):escAttr(nm);const bar=lim?'<div class="bt-limited-topbar" aria-hidden="true"><span class="bt-limited-topbar-inner">'+esc(lbl)+'</span></div>':'';const fx=lim?'<span class="bt-limited-shimmer" aria-hidden="true"></span>':'';h+='<div class="lr-card bt-lr-tile'+limCls+'" role="button" tabindex="0" data-detail-type="'+escAttr(typ)+'" data-detail-id="'+escAttr(it.id)+'" aria-label="'+aria+'" onclick="openDetail(\''+typ+'\',\''+escJs(it.id)+'\')">'+fx+bar+'<div class="lr-card-thumb">'+renderListThumb(row,thumbKind,Math.round(px))+'</div><div class="lr-card-name">'+esc(nm)+'</div></div>'});return'<div class="bt-strip">'+h+'</div>'}
const BT_SPECIAL_SCHEDULE_ID='9999990001';function btIsSpecialScheduleBanner(b){const sid=String(b&&(b.schedule_id!=null)?b.schedule_id:'').trim();return sid===BT_SPECIAL_SCHEDULE_ID}
function btBannerEndYearJstMs(ms){if(!(ms>0))return null;try{const yr=new Intl.DateTimeFormat('en',{timeZone:'Asia/Tokyo',year:'numeric'}).formatToParts(new Date(ms)).find(p=>p.type==='year');return yr?parseInt(yr.value,10):null}catch(_){return null}}
function btFmtDuration(b){if(btIsSpecialScheduleBanner(b))return'-';if(b&&btBannerEndYearJstMs(b.end_ms)===2099)return'-';return b&&b.duration_label!=null?String(b.duration_label):'—'}
function btFmtScheduleSlot(raw,b){if(btIsSpecialScheduleBanner(b))return'-';return raw!=null&&String(raw).trim()!==''?String(raw):'—'}
function btBannerScheduleBlock(b){return'<div class="bt-banner-sched">'+'<div class="bt-banner-sched-row"><span class="bt-banner-sched-k">'+esc(t('bt_col_start'))+'</span><span class="bt-banner-sched-v">'+esc(btFmtScheduleSlot(b.start_label,b))+'</span></div>'+'<div class="bt-banner-sched-row"><span class="bt-banner-sched-k">'+esc(t('bt_col_end'))+'</span><span class="bt-banner-sched-v">'+esc(btFmtScheduleSlot(b.end_label,b))+'</span></div>'+'<div class="bt-banner-sched-row"><span class="bt-banner-sched-k">'+esc(t('bt_col_duration'))+'</span><span class="bt-banner-sched-v">'+esc(btFmtDuration(b))+'</span></div>'+'</div>'}
function btFeaturedMergedCell(units,chars,supporters){const sups=supporters&&supporters.length?supporters:null;let inner='<div class="bt-feat-block"><div class="bt-feat-sub">'+esc(t('bt_col_units'))+'</div>'+btFeaturedCell(units,62)+'</div>'+'<div class="bt-feat-block"><div class="bt-feat-sub">'+esc(t('bt_col_chars'))+'</div>'+btFeaturedCell(chars,62)+'</div>';if(sups)inner+='<div class="bt-feat-block"><div class="bt-feat-sub">'+esc(t('bt_col_supporters'))+'</div>'+btFeaturedCell(sups,62)+'</div>';return'<td class="bt-feat-stack-cell">'+'<div class="bt-feat-stack">'+inner+'</div>'+'</td>'}
function renderBannerTimelineTable(rows){const sorted=btSortBannerRows(rows||[]);const dir=S.btBannerSortDir||'desc';const arrow=dir==='desc'?'▼':'▲';const thead='<thead><tr><th class="bt-th-banner bt-th-sortable" scope="col" role="button" tabindex="0" onclick="toggleBtBannerTimelineSort()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleBtBannerTimelineSort()}" title="'+escAttr(t('bt_sort_start_hint'))+'" aria-label="'+escAttr(t('bt_sort_start_hint'))+'">'+esc(t('bt_col_banner'))+' <span class="bt-sort-ind" aria-hidden="true">'+arrow+'</span></th><th class="bt-th-combo" scope="col">'+esc(t('bt_col_featured'))+'</th></tr></thead>';let body='<tbody>';sorted.forEach(b=>{const img=b.banner_url?'<div class="bt-banner-thumb"><img src="'+escAttr(imgUrl(b.banner_url))+'" alt="" loading="lazy" decoding="async"></div>':'';body+='<tr><td class="bt-banner-cell">'+img+'<div class="bt-banner-title">'+esc(b.name||'')+'</div>'+btBannerScheduleBlock(b)+'</td>'+btFeaturedMergedCell(b.featured_units,b.featured_chars,b.featured_supporters)+'</tr>'});body+='</tbody>';return'<div class="bt-table-wrap"><table class="data-table bt-table">'+thead+body+'</table></div>'}
function btSortBannerRows(rows){const dir=S.btBannerSortDir||'desc';const xs=(rows||[]).slice().sort((a,b)=>{const sa=a&&a.start_ms?+a.start_ms:0,sb=b&&b.start_ms?+b.start_ms:0;if(sa!==sb)return dir==='desc'?sb-sa:sa-sb;return String(a.gasha_id||'').localeCompare(String(b.gasha_id||''))});return xs}
function toggleBtBannerTimelineSort(){S.btBannerSortDir=(S.btBannerSortDir||'desc')==='desc'?'asc':'desc';try{sessionStorage.setItem('ggen_bt_sort',S.btBannerSortDir)}catch(_){}if(S.btCacheData&&S.currentTab==='banner_timeline')renderBannerTimeline(S.btCacheData)}
function renderBannerTimeline(d){const root=document.getElementById('bannerTimelineRoot');if(!root)return;const rows=d.banners||[];const rf=()=>requestAnimationFrame(()=>{armBannerTimelineScrollFabBaseline();updateBannerTimelineScrollFabVisibility()});if(!rows.length){root.innerHTML='<div class="bt-empty"><div class="empty-state-icon">📭</div><div class="empty-state-text">'+esc(t('bt_empty'))+'</div></div>';rf();return}root.innerHTML=renderBannerTimelineTable(rows);rf()}
async function loadBannerTimeline(){const root=document.getElementById('bannerTimelineRoot');const load=document.getElementById('bannerTimelineLoading');if(!root)return;if(S.currentTab==='banner_timeline')armBannerTimelineScrollFabBaseline();const cacheKey=S.lang;if(S.btCacheKey===cacheKey&&S.btCacheData){renderBannerTimeline(S.btCacheData);return}if(load)load.style.display='flex';try{const r=await fetch('/api/banner_timeline?lang='+encodeURIComponent(S.lang),{credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();S.btCacheKey=cacheKey;S.btCacheData=data;renderBannerTimeline(data)}catch(e){S.btCacheKey=null;S.btCacheData=null;root.innerHTML='<div class="empty-state"><div class="empty-state-text">'+esc(String(e))+'</div></div>';requestAnimationFrame(()=>{armBannerTimelineScrollFabBaseline();updateBannerTimelineScrollFabVisibility()})}finally{if(load)load.style.display='none'}}
function scrollBannerTimelineToTop(){try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){window.scrollTo(0,0)}}
function armBannerTimelineScrollFabBaseline(){if(S.currentTab!=='banner_timeline')return;const st=Math.max(window.scrollY||0,document.documentElement.scrollTop||0,document.body.scrollTop||0);S._btFabLastScrollSt=st;S._btFabShown=false;S._btFabDownAccum=0;const b=document.getElementById('bannerTimelineScrollTopFab');if(b)b.hidden=true}
function updateBannerTimelineScrollFabVisibility(){const b=document.getElementById('bannerTimelineScrollTopFab');if(!b)return;if(S.currentTab!=='banner_timeline'){b.hidden=true;return}const st=Math.max(window.scrollY||0,document.documentElement.scrollTop||0,document.body.scrollTop||0);const topTol=56,jitUp=14,downNeed=36;if(typeof S._btFabLastScrollSt!=='number'){S._btFabLastScrollSt=st;b.hidden=true;return}const d=st-S._btFabLastScrollSt;S._btFabLastScrollSt=st;if(st<=topTol){S._btFabShown=false;S._btFabDownAccum=0}else{if(d>0)S._btFabDownAccum=(S._btFabDownAccum||0)+d;if(d<-jitUp){S._btFabShown=false;S._btFabDownAccum=0}else if((S._btFabDownAccum||0)>=downNeed)S._btFabShown=true}b.hidden=S._btFabShown!==true}
function initBannerTimelineExtras(){if(S._bannerTimelineExtras)return;S._bannerTimelineExtras=1;window.addEventListener('scroll',updateBannerTimelineScrollFabVisibility,{passive:true})}
function goHome(){closeAlipayhkModal();closeWhatsNew();closeModal();switchTab('characters')}
function setupKeys(){document.addEventListener('keydown',e=>{if(e.key==='Escape'){const sdp=document.getElementById('dcStageDdPanel');if(sdp&&!sdp.hidden){e.preventDefault();_dcCloseDcStageDd();return}if(document.getElementById('searchSpotlightOverlay')&&document.getElementById('searchSpotlightOverlay').classList.contains('active')){e.preventDefault();closeSearchSpotlight();return}const tbPickOv=document.getElementById('tbPickerOverlay');if(tbPickOv&&tbPickOv.classList.contains('active')){e.preventDefault();closeTbPicker();return}const aho=document.getElementById('alipayhkOverlay');if(aho&&aho.classList.contains('active')){e.preventDefault();closeAlipayhkModal();return}const wno=document.getElementById('whatsNewOverlay');if(wno&&wno.classList.contains('active')){e.preventDefault();closeWhatsNew();return}const tbf=document.getElementById('tbFormationOverlay');if(tbf&&tbf.classList.contains('active')){e.preventDefault();closeTbFormationModal();return}const tbr=document.getElementById('tbRearrangeOverlay');if(tbr&&tbr.classList.contains('active')){e.preventDefault();tbRearrangeCancel();return}if(document.querySelector('.list-toolbar [id$="FilterPanel"]:not([hidden])')){e.preventDefault();closeAllFilterPanels();return}if(document.getElementById('skillModal').classList.contains('active'))closeSkillModalForce();else if(document.getElementById('tagModal').classList.contains('active'))closeTagModalForce();else closeModal()}})}
function openWhatsNew(){const ov=document.getElementById('whatsNewOverlay'),body=document.getElementById('whatsNewBody'),title=document.getElementById('whatsNewTitleEl');if(!ov||!body)return;document.getElementById('langDropdown').classList.remove('active');if(title)title.innerHTML='<img class="whats-new-ic" src="'+imgUrl('/static/images/UI/UI_Common_BtnIcon_News.webp')+'" alt=""> <span>'+esc(t('whats_new_title'))+'</span>';body.innerHTML='<div class="loading-overlay" style="min-height:200px"><div class="spinner"></div></div>';ov.classList.add('active');ov.setAttribute('aria-hidden','false');applyBackgroundScrollLock();const u='/api/whats_new?lang='+encodeURIComponent(S.lang||'EN')+'&t='+Date.now();fetch(u,{cache:'no-store',credentials:'same-origin'}).then(r=>r.json()).then(d=>{const tabs=(d&&d.tabs)||[];if(tabs.length){body.innerHTML=renderWhatsNewTabsHTML(tabs);return}const entries=(d&&d.entries)||[];if(!entries.length){body.innerHTML='<p style="color:var(--text-muted);margin:0">'+esc(t('whats_new_empty'))+'</p>';return}body.innerHTML=entries.map(renderWhatsNewBlock).join('')}).catch(err=>{body.innerHTML='<p style="color:var(--text-muted);margin:0">'+esc(String(err))+'</p>'})}
function whatsNewTabLabel(tab){if(!tab||typeof tab!=='object')return'';const k=tab.kind;function endLabel(){const x=tab.label!=null&&String(tab.label).trim()!==''?String(tab.label):(tab.date!=null&&String(tab.date).trim()!==''?String(tab.date):'');return x}if(k==='pending'){const d=endLabel();return d||t('whats_new_tab_pending')}if(k==='manual'){const d=tab.date!=null&&String(tab.date).trim()!==''?String(tab.date):'';return d?d+' · '+t('whats_new_tab_manual'):t('whats_new_tab_manual')}if(k==='history'){const d=endLabel();return d||'—'}return String(tab.id||'')}
function whatsNewTabIsEmpty(tab){const ch=tab.changes||[],ad=tab.added||[];return !ch.length&&!ad.length}
function renderWhatsNewTabPanelInner(tab){if(whatsNewTabIsEmpty(tab))return'<p class="whats-new-tab-empty">'+esc(t('whats_new_tab_empty'))+'</p>';return renderWhatsNewBlock({date:tab.date,changes:tab.changes||[],added:tab.added||[]})}
function sortWhatsNewTabsLatestFirst(tabs){return tabs.slice().sort(function(a,b){const da=String((a&&a.date)||(a&&a.label)||'').trim();const db=String((b&&b.date)||(b&&b.label)||'').trim();const cmp=db.localeCompare(da);if(cmp!==0)return cmp;return String((b&&b.id)||'').localeCompare(String((a&&a.id)||''))})}
function renderWhatsNewTabsHTML(tabs){const sorted=sortWhatsNewTabsLatestFirst(tabs);const activeIdx=0;let h='<div class="whats-new-date-wrap">';h+='<label class="whats-new-date-label" for="whatsNewDateSelect">'+esc(t('whats_new_select_period'))+'</label>';h+='<select id="whatsNewDateSelect" class="whats-new-date-select" aria-label="'+esc(t('whats_new_select_period'))+'" onchange="whatsNewSelectTab(parseInt(this.value,10))">';sorted.forEach(function(tab,i){const lab=whatsNewTabLabel(tab);h+='<option value="'+i+'"'+(i===activeIdx?' selected':'')+'>'+esc(lab)+'</option>'});h+='</select></div>';sorted.forEach(function(tab,i){const sel=i===activeIdx?' active':'';h+='<div class="whats-new-tab-panel'+sel+'" role="tabpanel" id="whatsNewTabPanel'+i+'">'+renderWhatsNewTabPanelInner(tab)+'</div>'});return h}
function whatsNewSelectTab(idx){const sel=document.getElementById('whatsNewDateSelect');if(sel)sel.value=String(idx);document.querySelectorAll('#whatsNewBody .whats-new-tab-panel').forEach(function(p,i){p.classList.toggle('active',i===idx)})}
const SUPPORT_FEEDBACK_BASE_URL='https://docs.google.com/forms/d/e/1FAIpQLScGcQn662SpeZzGXJ4-TFTSlTaItvQv1A_EJruZgH1uid5nJw/viewform?usp=send_form';
function supportFeedbackFormLocale(){const lc=(S.lang||'EN').toUpperCase();if(lc==='TW')return'zh-TW';if(lc==='HK')return'zh-HK';if(lc==='JP'||lc==='JA')return'ja';return'en'}
function supportFeedbackUrl(){const tl=supportFeedbackFormLocale();if(tl==='en')return SUPPORT_FEEDBACK_BASE_URL;const tu=new URL('https://translate.google.com/translate');tu.searchParams.set('sl','auto');tu.searchParams.set('tl',tl);tu.searchParams.set('u',SUPPORT_FEEDBACK_BASE_URL);return tu.toString()}
function openSupportFeedback(){document.getElementById('langDropdown').classList.remove('active');const a=document.createElement('a');a.href=supportFeedbackUrl();a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove()}
function renderWhatsNewSlotRows(rows,isAbility){
  if(!rows||!rows.length)return '';
  function cellText(r,which){
    const ft=r.from_text,tt=r.to_text;
    if(which==='from'){
      if(ft!=null&&ft!=='')return String(ft);
      const a=r.from!=null?String(r.from):'';const d=isAbility&&r.from_detail?String(r.from_detail):'';
      return d?a+'\n\n'+d:a;
    }
    if(tt!=null&&tt!=='')return String(tt);
    const b=r.to!=null?String(r.to):'';const d=isAbility&&r.to_detail?String(r.to_detail):'';
    return d?b+'\n\n'+d:b;
  }
  let h='<div class="wn-diff-grid">';
  h+='<div class="wn-diff-header-row"><div class="wn-diff-h-slot">'+esc(t('whats_new_slot'))+'</div><div class="wn-diff-h-before">'+esc(t('whats_new_before'))+'</div><div class="wn-diff-h-after">'+esc(t('whats_new_after'))+'</div></div>';
  rows.forEach(function(r){
    h+='<div class="wn-diff-body-row"><div class="wn-diff-slot">'+esc(String(r.slot))+'</div>';
    h+='<div class="wn-diff-pre-col wn-diff-pre--before"><div class="wn-diff-pre">'+esc(cellText(r,'from'))+'</div></div>';
    h+='<div class="wn-diff-pre-col wn-diff-pre--after"><div class="wn-diff-pre">'+esc(cellText(r,'to'))+'</div></div></div>';
  });
  h+='</div>';
  return h;
}
function whatsNewShortcut(linkType,linkId){
  closeWhatsNew();
  const id=String(linkId||'').trim();
  if(!id)return;
  const lt=String(linkType||'').trim();
  if(lt==='unit'||lt==='character'){
    openDetail(lt,id);
    return;
  }
  if(lt==='supporter'){
    openDetail('supporter',id);
    return;
  }
  if(lt==='modification'){
    switchTab('modifications');
    openDetail('option_part',id);
    try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){window.scrollTo(0,0)}
  }
}
function wnCardAttrs(c){
  if(!c||typeof c!=='object')return' class="wn-change-card"';
  const lt=c.link_type,lid=c.link_id;
  if(lt&&lid!=null&&String(lid).trim()!==''){
    return ' class="wn-change-card wn-change-card--link" onclick="whatsNewShortcut(\''+escJs(lt)+'\',\''+escJs(String(lid))+'\')"';
  }
  return' class="wn-change-card"';
}
function renderWhatsNewChangeItem(c){
  if(!c||typeof c!=='object')return'<article class="wn-change-card"><p class="wn-change-head">'+esc(String(c))+'</p></article>';
  if((c.kind==='unit_abilities'||c.kind==='char_abilities')&&Array.isArray(c.rows)){
    const kb=c.kind==='unit_abilities'?t('whats_new_kind_unit_abilities'):t('whats_new_kind_char_abilities');
    return'<article'+wnCardAttrs(c)+'><div class="wn-change-head"><span class="wn-kbadge">'+esc(kb)+'</span> '+esc(c.title||'')+'</div>'+renderWhatsNewSlotRows(c.rows,true)+'</article>';
  }
  if(c.kind==='unit_weapons'&&Array.isArray(c.rows)){
    return'<article'+wnCardAttrs(c)+'><div class="wn-change-head"><span class="wn-kbadge">'+esc(t('whats_new_kind_unit_weapons'))+'</span> '+esc(c.title||'')+'</div>'+renderWhatsNewSlotRows(c.rows,false)+'</article>';
  }
  if(c.from!==undefined||c.to!==undefined){
    const fr=esc(String(c.from!=null?c.from:'')),t2=esc(String(c.to!=null?c.to:''));
    return'<article class="wn-change-card"><div class="wn-change-head">'+esc(t('whats_new_manual_note'))+'</div><div class="wn-fromto-block"><span class="whats-new-fromto"><span class="w-from">'+fr+'</span> <span class="w-arrow">→</span> <span class="w-to">'+t2+'</span></span></div></article>';
  }
  return'<article class="wn-change-card"><p class="wn-change-head">'+esc(String(c))+'</p></article>';
}
function renderWhatsNewAddedItem(x){
  if(typeof x==='string')return'<li class="wn-added-li wn-added-li--plain">'+esc(x)+'</li>';
  const o=x||{};
  if(o.link_type&&o.link_id!=null&&String(o.link_id).trim()!==''&&o.kind){
    let lbl='';
    if(o.kind==='new_unit')lbl=t('whats_new_label_new_unit');
    else if(o.kind==='new_character')lbl=t('whats_new_label_new_char');
    else if(o.kind==='new_option_part')lbl=t('whats_new_label_new_mod');
    else if(o.kind==='new_supporter')lbl=t('whats_new_label_new_supporter');
    const lblHtml=lbl?esc(lbl)+' ':'';
    return'<li class="wn-added-li"><button type="button" class="wn-added-btn" onclick="whatsNewShortcut(\''+escJs(o.link_type)+'\',\''+escJs(String(o.link_id))+'\')">'+lblHtml+'<span class="wn-added-name">'+esc(o.name||'')+'</span></button></li>';
  }
  return'<li class="wn-added-li wn-added-li--plain">'+esc(typeof x==='object'?JSON.stringify(x):String(x))+'</li>';
}
function renderWhatsNewBlock(ent){
  const date=ent.date!=null?String(ent.date):'';
  let ch=ent.changes;if(!Array.isArray(ch))ch=[];
  const changesHtml=ch.length?'<ol class="whats-new-change-ol">'+ch.map(function(x){return'<li>'+renderWhatsNewChangeItem(x)+'</li>';}).join('')+'</ol>':'';
  let ad=ent.added;if(!Array.isArray(ad))ad=[];
  const addedHtml=ad.length?'<ul class="wn-added-list">'+ad.map(renderWhatsNewAddedItem).join('')+'</ul>':'';
  return'<section class="whats-new-block">'+(date?'<div class="wn-date-row"><span class="wn-label">'+esc(t('whats_new_date'))+'</span> '+esc(date)+'</div>':'')+(changesHtml?'<div style="margin-top:14px"><span class="wn-label">'+esc(t('whats_new_changes'))+'</span>'+changesHtml+'</div>':'')+(addedHtml?'<div style="margin-top:18px"><span class="wn-label">'+esc(t('whats_new_added'))+'</span>'+addedHtml+'</div>':'')+'</section>';
}
function openAlipayhkModal(){const ov=document.getElementById('alipayhkOverlay');if(!ov)return;document.getElementById('langDropdown').classList.remove('active');const title=document.getElementById('alipayhkModalTitle');if(title)title.textContent=t('support_alipayhk_modal_title');const hint=document.getElementById('alipayhkModalHint');if(hint)hint.textContent=t('support_alipayhk_modal_hint');const qr=document.getElementById('alipayhkModalQr');if(qr)qr.setAttribute('alt',t('support_alipayhk_modal_hint'));const closeBtn=document.getElementById('alipayhkModalCloseBtn');if(closeBtn)closeBtn.setAttribute('aria-label',t('whats_new_close'));const hb=document.getElementById('alipayhkHeaderBtn');if(hb){hb.title=t('support_alipayhk_btn');hb.setAttribute('aria-label',t('support_alipayhk_btn'))}ov.classList.add('active');ov.setAttribute('aria-hidden','false');applyBackgroundScrollLock()}
function closeAlipayhkModal(){const ov=document.getElementById('alipayhkOverlay');if(!ov||!ov.classList.contains('active'))return;ov.classList.remove('active');ov.setAttribute('aria-hidden','true');releaseBackgroundScrollLock()}
function closeWhatsNew(){const ov=document.getElementById('whatsNewOverlay');if(!ov||!ov.classList.contains('active'))return;ov.classList.remove('active');ov.setAttribute('aria-hidden','true');releaseBackgroundScrollLock()}
const BROWSE_LIST_RELOAD_MS=300;
const BROWSE_DROPDOWN_FILTER_MS=100;
const _browseReloadTid={characters:'_brRLCharacters',units:'_brRLUnits',supporters:'_brRLSupporters',stages:'_brRLStages',modifications:'_brRLModifications'};
function cancelBrowseListReloadTimer(tab){const tid=_browseReloadTid[tab];if(tid&&S[tid]){clearTimeout(S[tid]);S[tid]=null}}
function scheduleBrowseListReload(tab,page){const pg=page!=null&&Number.isFinite(Number(page))?Number(page):1;if(S._ftTab===tab)clearTimeout(S.ft);const tid=_browseReloadTid[tab];if(!tid)return;clearTimeout(S[tid]);S[tid]=setTimeout(()=>{S[tid]=null;if(tab==='characters')loadCharacters(pg);else if(tab==='units')loadUnits(pg);else if(tab==='supporters')loadSupporters(pg);else if(tab==='stages')loadStages(pg);else if(tab==='modifications')loadModifications(pg)},BROWSE_LIST_RELOAD_MS)}
function debounceLoad(tab){clearTimeout(S.ft);S._ftTab=tab;S.ft=setTimeout(()=>{S.ft=null;const tb=S._ftTab;S._ftTab=null;if(tb==='characters'){cancelBrowseListReloadTimer('characters');loadCharacters(1)}else if(tb==='units'){cancelBrowseListReloadTimer('units');loadUnits(1)}else if(tb==='supporters'){cancelBrowseListReloadTimer('supporters');loadSupporters(1)}else if(tb==='stages'){cancelBrowseListReloadTimer('stages');loadStages(1)}else if(tb==='modifications'){cancelBrowseListReloadTimer('modifications');loadModifications(1)}},300)}
function isLikelyIdQuery(q){return/^\d{4,}$/.test(String(q||'').trim())}
async function maybeUnlockNpcView(q,data){if(!isLikelyIdQuery(q))return false;const total=(data&&typeof data.total==='number')?data.total:0;if(total>0)return false;try{const st=await fetch('/api/npc_view/status',{credentials:'same-origin'}).then(r=>r.json());if(!st||!st.password_required||st.unlocked)return false;const pw=window.prompt(t('npc_unlock_prompt'));if(!pw)return false;const res=await fetch('/api/npc_view/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(!res.ok){alert(t('npc_unlock_wrong'));return false}return true}catch(_){return false}}
function renderListThumb(row,type,size,opts){const o=opts||{};const r=row.rarity||'N';const ld=size?'eager':'lazy';const base=type==='supp'?(SUPPORTER_BASE_MAP[r]||SUPPORTER_BASE_MAP['N']):(RARITY_BASE_MAP[r]||RARITY_BASE_MAP['N']);const frame=type==='supp'?null:(RARITY_FRAME_MAP[r]||RARITY_FRAME_MAP['N']);const ph=type==='char'?'👤':type==='unit'?'🤖':'🎧';const thumErr="var w=this.closest('.list-thumb-portrait-wrap');var ph=w&&w.querySelector('.list-thumb-placeholder');if(ph){ph.style.display='flex'}this.style.display='none'";let portrait='';if(row.thum){portrait=pictureRasterHtml(row.thum,{cls:'list-thumb-portrait',loading:ld,decoding:'async',onerror:thumErr,lazy:false})}portrait+=`<div class="list-thumb-placeholder" style="display:${row.thum?'none':'flex'}">${ph}</div>`;let icons='';if(!o.pickerThumb&&type!=='supp'){if(row.role_icon){icons+=`<span class="list-thumb-icon-wrap">${pictureRasterHtml(row.role_icon,{cls:'list-thumb-role-icon',loading:ld,decoding:'async',alt:'',lazy:false})}</span>`}if(type==='unit'&&(row.is_ultimate===true||row.is_ultimate===1)){icons+=`<span class="list-thumb-icon-wrap">${pictureRasterHtml('/static/images/UI/UI_Common_Icon_ULT.webp',{cls:'list-thumb-acq-icon',loading:ld,decoding:'async',alt:'ULT',lazy:false})}</span>`}if(row.acquisition_icon){icons+=`<span class="list-thumb-icon-wrap">${pictureRasterHtml(row.acquisition_icon,{cls:'list-thumb-acq-icon',loading:ld,decoding:'async',alt:'',lazy:false})}</span>`}}const hz=frame?' list-thumb-has-frame':'';const pk=o.pickerThumb?' list-thumb-composite--picker':'';const sz=size?` style="width:${size}px;height:${size}px"`:'';const baseEl=pictureRasterHtml(base,{cls:'list-thumb-base',loading:ld,decoding:'async',alt:'',lazy:false});const frameEl=frame?pictureRasterHtml(frame,{cls:'list-thumb-frame',loading:ld,decoding:'async',alt:'',lazy:false}):'';const iconsWrap=icons?`<div class="list-thumb-icons">${icons}</div>`:'';return`<div class="list-thumb-composite${pk}${hz}"${sz}>${frame?`<div class="list-thumb-back">${baseEl}</div><div class="list-thumb-portrait-wrap">${portrait}</div>${frameEl}`:`${baseEl}<div class="list-thumb-portrait-wrap">${portrait}</div>`}${iconsWrap}</div>`}
function renderTbSupporterPortraitOnly(s,size){
const sz=size||96;
const src=(s&&s.portrait)||(s&&s.thum)||'';
if(!src)return`<div class="tb-supp-portrait-only tb-supp-portrait-only--empty" style="width:${sz}px;height:${sz}px" aria-hidden="true"><span>🎧</span></div>`;
return`<div class="tb-supp-portrait-only" style="width:${sz}px;height:${sz}px">${imgTag(src,{cls:'tb-supp-portrait-only-img',webp:true,alt:'',loading:'eager',onerror:"this.style.display='none'"})}</div>`;
}
function renderTbSupporterCardThumb(row,size){
const sz=size||96;
const ld='eager';
const thumErr="var w=this.closest('.list-thumb-portrait-wrap');var ph=w&&w.querySelector('.list-thumb-placeholder');if(ph){ph.style.display='flex'}this.style.display='none'";
let portrait='';
const suppImg=(row&&row.portrait)||(row&&row.thum)||'';
if(suppImg){portrait=pictureRasterHtml(suppImg,{cls:'list-thumb-portrait',loading:ld,decoding:'async',onerror:thumErr,lazy:false})}
portrait+=`<div class="list-thumb-placeholder" style="display:${suppImg?'none':'flex'}">🎧</div>`;
const baseInner=pictureRasterHtml(TB_SUPPORTER_TB_BASE,{cls:'list-thumb-base',loading:ld,decoding:'async',alt:'',lazy:false});
const frL=pictureRasterHtml(TB_SUPPORTER_TB_FRAME_LR,{cls:'tb-supp-tb-side tb-supp-tb-side--left',loading:ld,decoding:'async',alt:'',lazy:false});
const frR=pictureRasterHtml(TB_SUPPORTER_TB_FRAME_LR,{cls:'tb-supp-tb-side tb-supp-tb-side--right',loading:ld,decoding:'async',alt:'',lazy:false});
const frB=pictureRasterHtml(TB_SUPPORTER_TB_FRAME_BT,{cls:'tb-supp-tb-bottom',loading:ld,decoding:'async',alt:'',lazy:false});
return`<div class="tb-supp-tb-composite" style="width:${sz}px;height:${sz}px"><div class="tb-supp-tb-back">${baseInner}</div><div class="list-thumb-portrait-wrap tb-supp-tb-portrait-wrap">${portrait}</div>${frL}${frR}${frB}</div>`;
}
function buildTableHeaders(){const cs=S.characters,us=S.units,ss=S.supporters;const _csl=k=>`<span class="th-full">${t('col_'+k.toLowerCase())}</span><span class="th-mob">${charGridStatLabel(k)}</span>`;document.getElementById('charThead').innerHTML=`<tr><th class="col-thum" style="cursor:default"></th><th class="col-name ${cs.sort==='name'?'sort-active':''}" onclick="sortCol('characters','name')">${t('col_name')} <span class="sort-arrow">${cs.sort==='name'?(cs.dir==='desc'?'▼':'▲'):'▲'}</span></th><th class="col-stat ${cs.sort==='Ranged'?'sort-active':''}" title="${esc(t('col_ranged'))}" onclick="sortCol('characters','Ranged')">${_csl('Ranged')} <span class="sort-arrow">${cs.sort==='Ranged'?(cs.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${cs.sort==='Melee'?'sort-active':''}" title="${esc(t('col_melee'))}" onclick="sortCol('characters','Melee')">${_csl('Melee')} <span class="sort-arrow">${cs.sort==='Melee'?(cs.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${cs.sort==='Awaken'?'sort-active':''}" title="${esc(t('col_awaken'))}" onclick="sortCol('characters','Awaken')">${_csl('Awaken')} <span class="sort-arrow">${cs.sort==='Awaken'?(cs.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${cs.sort==='Defense'?'sort-active':''}" title="${esc(t('col_defense'))}" onclick="sortCol('characters','Defense')">${_csl('Defense')} <span class="sort-arrow">${cs.sort==='Defense'?(cs.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${cs.sort==='Reaction'?'sort-active':''}" title="${esc(t('col_reaction'))}" onclick="sortCol('characters','Reaction')">${_csl('Reaction')} <span class="sort-arrow">${cs.sort==='Reaction'?(cs.dir==='desc'?'▼':'▲'):'▼'}</span></th></tr>`;document.getElementById('unitThead').innerHTML=`<tr><th class="col-thum" style="cursor:default"></th><th class="col-name ${us.sort==='name'?'sort-active':''}" onclick="sortCol('units','name')">${t('col_name')} <span class="sort-arrow">${us.sort==='name'?(us.dir==='desc'?'▼':'▲'):'▲'}</span></th><th class="col-stat ${us.sort==='HP'?'sort-active':''}" onclick="sortCol('units','HP')">${t('col_hp')} <span class="sort-arrow">${us.sort==='HP'?(us.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${us.sort==='EN'?'sort-active':''}" onclick="sortCol('units','EN')">${t('col_en')} <span class="sort-arrow">${us.sort==='EN'?(us.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${us.sort==='ATK'?'sort-active':''}" onclick="sortCol('units','ATK')">${t('col_atk')} <span class="sort-arrow">${us.sort==='ATK'?(us.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${us.sort==='DEF'?'sort-active':''}" onclick="sortCol('units','DEF')">${t('col_def')} <span class="sort-arrow">${us.sort==='DEF'?(us.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${us.sort==='MOB'?'sort-active':''}" onclick="sortCol('units','MOB')">${t('col_mob')} <span class="sort-arrow">${us.sort==='MOB'?(us.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-stat ${us.sort==='MOV'?'sort-active':''}" onclick="sortCol('units','MOV')">${t('col_mov')} <span class="sort-arrow">${us.sort==='MOV'?(us.dir==='desc'?'▼':'▲'):'▼'}</span></th></tr>`;document.getElementById('suppThead').innerHTML=`<tr><th class="col-thum" style="cursor:default"></th><th class="col-name ${ss.sort==='name'?'sort-active':''}" onclick="sortCol('supporters','name')">${t('col_name')} <span class="sort-arrow">${ss.sort==='name'?(ss.dir==='desc'?'▼':'▲'):'▲'}</span></th><th class="col-tag ${ss.sort==='series_tag'?'sort-active':''}" onclick="sortCol('supporters','series_tag')">${t('col_series_tag')} <span class="sort-arrow">${ss.sort==='series_tag'?(ss.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-boost ${ss.sort==='boost'?'sort-active':''}" onclick="sortCol('supporters','boost')">${t('col_boost')} <span class="sort-arrow">${ss.sort==='boost'?(ss.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-skill" style="cursor:default">${t('sec_active_skills')}</th></tr>`;const st=S.stages;const ms=S.modifications;document.getElementById('modThead').innerHTML=`<tr><th class="col-thum" style="cursor:default;width:48px"></th><th class="col-name ${ms.sort==='name'?'sort-active':''}" onclick="sortColMod('name')">${t('col_name')} <span class="sort-arrow">${ms.sort==='name'?(ms.dir==='desc'?'▼':'▲'):'▲'}</span></th><th class="col-tag ${ms.sort==='tags'?'sort-active':''}" onclick="sortColMod('tags')">${t('col_series_tag')} <span class="sort-arrow">${ms.sort==='tags'?(ms.dir==='desc'?'▼':'▲'):'▼'}</span></th><th class="col-details ${ms.sort==='details'?'sort-active':''}" onclick="sortColMod('details')">${t('col_details')} <span class="sort-arrow">${ms.sort==='details'?(ms.dir==='desc'?'▼':'▲'):'▲'}</span></th></tr>`;document.getElementById('stageThead').innerHTML=`<tr><th class="col-thum" style="cursor:default"></th><th class="col-diff" style="cursor:default">${t('col_stage_diff')}</th><th class="col-number ${st.sort==='stage_number'?'sort-active':''}" onclick="sortColStage('stage_number')">${t('col_stage_no')} <span class="sort-arrow">${st.sort==='stage_number'?(st.dir==='desc'?'▼':'▲'):'▲'}</span></th><th class="col-name" style="cursor:default">${t('col_name')}</th><th class="col-cp" style="cursor:default">${t('col_stage_cp')}</th><th class="col-terrain" style="cursor:default">${t('col_stage_terrain')}</th></tr>`}
const DEFAULT_BROWSE_LIST_PER_PAGE=50;
function getBrowseListPerPage(which){const id=which==='char'?'charPerPage':'unitPerPage';const el=document.getElementById(id);if(!el)return DEFAULT_BROWSE_LIST_PER_PAGE;const v=parseInt(String(el.value||'').trim(),10);return Number.isFinite(v)&&v>0?v:DEFAULT_BROWSE_LIST_PER_PAGE}
function setBrowseToolbarCount(which,html){const ids={char:'charToolbarCount',unit:'unitToolbarCount',supp:'suppToolbarCount',stage:'stageToolbarCount',mod:'modToolbarCount'};const el=document.getElementById(ids[which]||'');if(el)el.innerHTML=html||''}
function syncBrowseSearchWidth(id){const inp=document.getElementById(id);if(!inp||!inp.classList.contains('filter-input--organic'))return;if(inp.closest('.browse-toolbar-leading')){inp.style.width='';return}if(typeof CSS!=='undefined'&&CSS.supports&&CSS.supports('field-sizing','content')){inp.style.width='';return}const wrap=inp.closest('.filter-input-wrap--organic');if(!wrap)return;const sizer=wrap.querySelector('.filter-input-sizer');if(!sizer)return;const ph=inp.getAttribute('placeholder')||'';const val=inp.value.length?inp.value:ph;sizer.textContent=val.length?val:'\u00a0';const w=Math.max(sizer.scrollWidth||0,Math.ceil(sizer.getBoundingClientRect().width));const cs=getComputedStyle(inp);const maxStr=cs.maxWidth;const maxPx=maxStr&&maxStr!=='none'?parseFloat(maxStr):Math.min(window.innerWidth*0.96,96*16);const minPx=parseFloat(cs.minWidth)||0;const next=Math.min(Math.max(Math.ceil(w+2),minPx),maxPx);inp.style.width=next+'px'}
function syncBrowseSearchWidths(){syncBrowseSearchWidth('charFilter');syncBrowseSearchWidth('unitFilter');syncBrowseSearchWidth('rankCharFilter');syncBrowseSearchWidth('rankUnitFilter')}
async function loadCharacters(p=1,opts={}){const s=S.characters;s.page=p;s.q=document.getElementById('charFilter').value.trim();const pp=opts.perPage!=null?opts.perPage:getBrowseListPerPage('char');const url=buildCharactersListUrl(p,pp,S.listCharSp,S.listCharCond);const cached=browseListJsonCacheGet(url);if(cached){try{if(await maybeUnlockNpcView(s.q,cached)){loadCharacters(p,opts);return}renderCharT(cached);renderPag('char',cached);setBrowseToolbarCount('char',`<span class="result-count-num">${cached.total}</span> ${t('count_char')}`)}catch(e){document.getElementById('charBody').innerHTML='';const _cg=document.getElementById('charGrid');if(_cg)_cg.innerHTML='';document.getElementById('charEmpty').style.display='block';setBrowseToolbarCount('char','')}requestAnimationFrame(()=>syncBrowseSearchWidths());afterListLoadIfSpotlightOpen();return}showLoad('char',true);setBrowseToolbarCount('char','<span style="color:var(--text-muted)">\u2026</span>');try{const r=await fetch(url);const d=await r.json();if(await maybeUnlockNpcView(s.q,d)){loadCharacters(p,opts);return}browseListJsonCacheSet(url,d);renderCharT(d);renderPag('char',d);setBrowseToolbarCount('char',`<span class="result-count-num">${d.total}</span> ${t('count_char')}`)}catch(e){document.getElementById('charBody').innerHTML='';const _cg=document.getElementById('charGrid');if(_cg)_cg.innerHTML='';document.getElementById('charEmpty').style.display='block';setBrowseToolbarCount('char','')}finally{showLoad('char',false);requestAnimationFrame(()=>syncBrowseSearchWidths());afterListLoadIfSpotlightOpen()}}
async function loadUnits(p=1,opts={}){syncUnitListSspForWeaponEffectFilters();syncUnitListSspForWeaponRangeFilters();const s=S.units;s.page=p;s.q=document.getElementById('unitFilter').value.trim();const pp=opts.perPage!=null?opts.perPage:getBrowseListPerPage('unit');const url=buildUnitsListApiUrl(p,pp,S.listUnitSp,S.listUnitSsp,S.listUnitCond);const cached=browseListJsonCacheGet(url);if(cached){try{if(await maybeUnlockNpcView(s.q,cached)){loadUnits(p,opts);return}const wdCh=applyWeaponDebuffPresentFromApi(cached);const meCh=applyMechanismPresentFromApi(cached);if(wdCh||meCh){await loadUnits(p,opts);return}renderUnitT(cached);renderPag('unit',cached);setBrowseToolbarCount('unit',`<span class="result-count-num">${cached.total}</span> ${t('count_unit')}`)}catch(e){document.getElementById('unitBody').innerHTML='';const _ug=document.getElementById('unitGrid');if(_ug)_ug.innerHTML='';document.getElementById('unitEmpty').style.display='block';setBrowseToolbarCount('unit','')}requestAnimationFrame(()=>syncBrowseSearchWidths());afterListLoadIfSpotlightOpen();return}showLoad('unit',true);setBrowseToolbarCount('unit','<span style="color:var(--text-muted)">\u2026</span>');try{const r=await fetch(url);const d=await r.json();if(await maybeUnlockNpcView(s.q,d)){loadUnits(p,opts);return}const wdCh=applyWeaponDebuffPresentFromApi(d);const meCh=applyMechanismPresentFromApi(d);if(wdCh||meCh){await loadUnits(p,opts);return}browseListJsonCacheSet(url,d);renderUnitT(d);renderPag('unit',d);setBrowseToolbarCount('unit',`<span class="result-count-num">${d.total}</span> ${t('count_unit')}`)}catch(e){document.getElementById('unitBody').innerHTML='';const _ug=document.getElementById('unitGrid');if(_ug)_ug.innerHTML='';document.getElementById('unitEmpty').style.display='block';setBrowseToolbarCount('unit','')}finally{showLoad('unit',false);requestAnimationFrame(()=>syncBrowseSearchWidths());afterListLoadIfSpotlightOpen()}}
async function loadSupporters(p=1){const s=S.supporters;s.page=p;s.q=document.getElementById('suppFilter').value.trim();const pp=document.getElementById('suppPerPage').value;const rq=getRarityQuerySuffix('supp');const linQ=getLineageQuerySuffix('supp');const linOp=getLineageOpSuffix('supp');showLoad('supp',true);setBrowseToolbarCount('supp','<span style="color:var(--text-muted)">\u2026</span>');try{const r=await fetch(`/api/supporters?lang=${S.lang}&page=${p}&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(s.q)}${rq}${linQ}${linOp}`);const d=await r.json();renderSuppT(d);renderPag('supp',d);setBrowseToolbarCount('supp',`<span class="result-count-num">${d.total}</span> ${t('count_supporter')}`)}catch(e){document.getElementById('suppBody').innerHTML='';const _sg=document.getElementById('suppGrid');if(_sg)_sg.innerHTML='';document.getElementById('suppEmpty').style.display='block';setBrowseToolbarCount('supp','')}finally{showLoad('supp',false);afterListLoadIfSpotlightOpen()}}
async function loadStages(p=1){const s=S.stages;s.page=p;s.q=document.getElementById('stageFilter').value.trim();const pp=document.getElementById('stagePerPage').value;const df=s.difficultyFilter==='ALL'?'':s.difficultyFilter;const src=s.source||'eternal';const cat=src==='score_attack'?'score_attack':src==='special_stage'?'special_stage':'eternal';showLoad('stage',true);setBrowseToolbarCount('stage','<span style="color:var(--text-muted)">\u2026</span>');try{const r=await fetch(`/api/stages?lang=${S.lang}&page=${p}&per_page=${pp}&q=${encodeURIComponent(s.q)}&difficulty=${encodeURIComponent(df)}&sort=${s.sort}&dir=${s.dir}&category=${encodeURIComponent(cat)}`);const d=await r.json();renderStageT(d);renderPag('stage',d);setBrowseToolbarCount('stage',`<span class="result-count-num">${d.total}</span> ${t('count_stage')}`)}catch(e){document.getElementById('stageBody').innerHTML='';const _stg=document.getElementById('stageGrid');if(_stg)_stg.innerHTML='';document.getElementById('stageEmpty').style.display='block';setBrowseToolbarCount('stage','')}finally{showLoad('stage',false);afterListLoadIfSpotlightOpen()}}
async function loadModifications(p=1){const s=S.modifications;s.page=p;s.q=document.getElementById('modFilter').value.trim();const pp=document.getElementById('modPerPage').value;const ef=encodeURIComponent(s.effectFilter||'ALL');showLoad('mod',true);setBrowseToolbarCount('mod','<span style="color:var(--text-muted)">\u2026</span>');try{const r=await fetch(`/api/option_parts?lang=${S.lang}&page=${p}&per_page=${pp}&sort=${s.sort}&dir=${s.dir}&q=${encodeURIComponent(s.q)}&rarity=ALL&effect=${ef}`);const d=await r.json();if(d.effect_filter_icons)S._modEffectFilterIcons=d.effect_filter_icons;else S._modEffectFilterIcons=null;renderModT(d);renderPag('mod',d);setBrowseToolbarCount('mod',`<span class="result-count-num">${d.total}</span> ${t('count_mod')}`);updateModEffectFilterLabel();applyModEffectDropdownIcons()}catch(e){document.getElementById('modBody').innerHTML='';const _mg=document.getElementById('modGrid');if(_mg)_mg.innerHTML='';document.getElementById('modEmpty').style.display='block';setBrowseToolbarCount('mod','')}finally{showLoad('mod',false);afterListLoadIfSpotlightOpen()}}
function showLoad(pfx,s){document.getElementById(`${pfx}Loading`).style.display=s?'flex':'none';document.getElementById(`${pfx}Empty`).style.display='none';if(s){document.getElementById(`${pfx}Body`).innerHTML='';const gid=pfx==='char'?'charGrid':pfx==='unit'?'unitGrid':pfx==='supp'?'suppGrid':pfx==='stage'?'stageGrid':pfx==='mod'?'modGrid':'';if(gid){const g=document.getElementById(gid);if(g)g.innerHTML=''}}}
function charListStatCell(r,k){const tot=Number(r[k]||0);const b=r[k+'_base'];const base=b===undefined||b===null?NaN:Number(b);const boosted=!isNaN(base)&&tot>base;const cls=boosted?' stat-boosted':'';const tip=boosted?` title="${esc(t('char_list_stat_base_hint').replace('{n}',String(fmtN(base))))}"`:'';return`<span class="stat-value${cls}"${tip}>${fmtN(tot)}</span>`}
function renderSkillTags(std){if(!std||!std.length)return'';return std.map(sk=>{let tags=sk.tags||[];if(!tags.length)return'';let sep='';if(sk.separator==='and')sep=`<span style="display:flex;align-items:center;color:#a855f7;font-weight:900;font-size:16px;margin:0 2px;">+</span>`;else if(sk.separator==='or')sep=`<span style="display:flex;align-items:center;color:#a855f7;font-weight:900;font-size:13px;margin:0 4px;">${t('tag_or')}</span>`;else sep='<span style="margin:0 2px;"> </span>';return tags.map(tag=>{let cn=tag.name||'',ct=tag.type||'',cTags,cOp;if(sk.separator==='and'){cTags=tags.map(tg=>tg.name).join(',');cOp='and'}else{cTags=cn;cOp='or'}let li='';if(ct==='unit')li='/static/images/UI/UI_Common_Icon_Category_MS_Main.webp';else if(ct==='character')li='/static/images/UI/UI_Common_Icon_Category_Chara_Main.webp';else li='/static/images/UI/UI_Common_Icon_Category_MS_Main.webp';return`<div class="tag-composite" onclick="event.stopPropagation();openTagModal('${esc(cTags)}','${cOp}')" title="Click to view"><div class="tag-part-icon">${li?`<img class="tag-icon-fg" src="${imgUrl(li)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}</div><div class="tag-part-value">${esc(cn)}</div></div>`}).join(sep)}).join('<div style="width:100%;height:6px;"></div>')}
function openSeriesModal(seriesSid,listTab,seriesName){const sid=String(seriesSid||'').trim();if(!sid||sid==='0')return;S._tagModalMode='series';S._seriesModalSid=sid;S._seriesModalName=seriesName!=null?String(seriesName):'';S._tagTargetType=listTab==='units'?'unit':'character';const tm=document.getElementById('tagModal');const ta=document.getElementById('tagTabAffinity');if(ta)ta.style.display='none';document.getElementById('tagTabUnit').classList.toggle('active',S._tagTargetType==='unit');document.getElementById('tagTabChar').classList.toggle('active',S._tagTargetType==='character');if(ta)ta.classList.remove('active');tm.classList.add('active');applyBackgroundScrollLock();S._tagRarityFilter='ALL';S._tagAcqFilter='ALL';updateSeriesModalTitle();fetchAndRenderSeriesModal()}
function initSeriesIconNav(){document.addEventListener('click',function(e){const hit=e.target.closest('.series-icon-hitbox');if(!hit)return;const sid=(hit.getAttribute('data-series-id')||'').trim();const tab=hit.getAttribute('data-list-tab')||'';if(!sid||sid==='0')return;if(tab!=='characters'&&tab!=='units')return;e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();const name=hit.getAttribute('data-series-name')||'';openSeriesModal(sid,tab,name)},true)}
function applySeriesSearchFromList(seriesName,tab,seriesSid){closeModal();switchTab(tab);const sid=seriesSid!=null&&String(seriesSid).trim()!==''?String(seriesSid).trim():'';const q=(sid&&sid!=='0')?`series_id:${sid}`:`series: ${seriesName}`;const ppOpt={perPage:100};const ppSel=document.getElementById(tab==='characters'?'charPerPage':'unitPerPage');if(ppSel)ppSel.value='100';if(tab==='characters'){document.getElementById('charFilter').value=q;syncBrowseSearchWidth('charFilter');loadCharacters(1,ppOpt)}else{document.getElementById('unitFilter').value=q;syncBrowseSearchWidth('unitFilter');loadUnits(1,ppOpt)}try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){window.scrollTo(0,0)}}
function renderCharTable(data){document.getElementById('charBody').innerHTML=data.rows.map(r=>`<tr data-detail-type="character" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('character','${r.id}')"><td class="col-thum">${renderListThumb(r,'char')}</td><td class="col-name"><div class="name-cell"><span class="name-text">${esc(r.name)}</span></div></td><td class="col-stat">${charListStatCell(r,'Ranged')}</td><td class="col-stat">${charListStatCell(r,'Melee')}</td><td class="col-stat">${charListStatCell(r,'Awaken')}</td><td class="col-stat">${charListStatCell(r,'Defense')}</td><td class="col-stat">${charListStatCell(r,'Reaction')}</td></tr>`).join('')}
function renderCharGrid(data){if(getListGridVariant('characters')===2)return renderCharGridSkills(data);return renderCharGridStats(data)}
function renderCharGridStats(data){const grid=document.getElementById('charGrid'),th=108,keys=['Ranged','Melee','Awaken','Defense','Reaction'],tipK={Ranged:'col_ranged',Melee:'col_melee',Awaken:'col_awaken',Defense:'col_defense',Reaction:'col_reaction'},cmpLbl=escAttr(t('cmp_compare'));grid.innerHTML=data.rows.map(r=>{const stats=keys.map(k=>{const fullTip=escAttr(t(tipK[k]||''));const tipAttr=(S.lang==='TW'||S.lang==='HK'||S.lang==='JA'||S.lang==='JP')?'':` title="${fullTip}"`;return`<span class="list-grid-stat"><span class="list-grid-stat-l"${tipAttr}>${charGridStatLabel(k)}</span> ${charListStatCell(r,k)}</span>`}).join(' ');return`<div class="list-grid-card list-grid-card--cmp" data-detail-type="character" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('character','${r.id}')"><div class="list-grid-card-thumb">${renderListThumb(r,'char',th)}</div><div class="list-grid-card-body"><div class="list-grid-card-name">${esc(r.name)}</div><div class="list-grid-card-stats list-grid-card-stats--char">${stats}</div></div><div class="list-grid-cmp-wrap" onclick="event.stopPropagation()" title="${cmpLbl}"><span class="list-grid-cmp-inner"><input type="checkbox" class="cmp-cb cmp-cb-grid" data-cmp-id="${escAttr(String(r.id))}" aria-label="${cmpLbl}"></span></div></div>`}).join('');wireGridCompareCheckboxes('charGrid','character')}
function renderCharGridSkills(data){const grid=document.getElementById('charGrid'),th=108,cmpLbl=escAttr(t('cmp_compare'));grid.innerHTML=data.rows.map(r=>{const strip=renderCharGridSkillStrip(r.grid_skills||[],3);return`<div class="list-grid-card list-grid-card--cmp list-grid-card--skills list-grid-card--char-skills-v2" data-detail-type="character" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('character','${r.id}')"><div class="list-grid-card-main-row"><div class="list-grid-card-char-col"><div class="list-grid-card-thumb">${renderListThumb(r,'char',th)}</div><div class="list-grid-card-body"><div class="list-grid-card-name">${esc(r.name)}</div></div><div class="list-grid-card-skills-hr">${strip}</div></div></div><div class="list-grid-cmp-wrap" onclick="event.stopPropagation()" title="${cmpLbl}"><span class="list-grid-cmp-inner"><input type="checkbox" class="cmp-cb cmp-cb-grid" data-cmp-id="${escAttr(String(r.id))}" aria-label="${cmpLbl}"></span></div></div>`}).join('');wireGridCompareCheckboxes('charGrid','character')}
function renderCharT(data){const tb=document.getElementById('charBody'),em=document.getElementById('charEmpty');if(!data.rows||!data.rows.length){tb.innerHTML='';const g=document.getElementById('charGrid');if(g)g.innerHTML='';em.style.display='block';return}em.style.display='none';if(getListViewMode('characters')==='grid'){tb.innerHTML='';renderCharGrid(data)}else{const g=document.getElementById('charGrid');if(g)g.innerHTML='';renderCharTable(data)}}
function renderUnitTable(data){document.getElementById('unitBody').innerHTML=data.rows.map(r=>`<tr data-detail-type="unit" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('unit','${r.id}')"><td class="col-thum">${renderListThumb(r,'unit')}</td><td class="col-name"><div class="name-cell"><span class="name-text">${esc(r.name)}</span><span class="name-special-icons">${(r.special_icons||[]).filter(ic=>ic&&!String(ic).includes('Source')).map(ic=>pictureRasterHtml(ic,{cls:'name-special-icon',loading:'lazy',alt:'',onerror:"this.style.display='none'",lazy:false})).join('')}</span></div></td><td class="col-stat"><span class="stat-value">${fmtN(r.HP)}</span></td><td class="col-stat"><span class="stat-value">${fmtN(r.EN)}</span></td><td class="col-stat"><span class="stat-value">${fmtN(r.ATK)}</span></td><td class="col-stat"><span class="stat-value">${fmtN(r.DEF)}</span></td><td class="col-stat"><span class="stat-value">${fmtN(r.MOB)}</span></td><td class="col-stat"><span class="stat-value">${fmtN(r.MOV)}</span></td></tr>`).join('')}
function renderUnitGrid(data){if(getListGridVariant('units')===2)return renderUnitGridSkills(data);return renderUnitGridStats(data)}
function renderUnitGridStats(data){const grid=document.getElementById('unitGrid'),th=108,cmpLbl=escAttr(t('cmp_compare'));grid.innerHTML=data.rows.map(r=>`<div class="list-grid-card list-grid-card--cmp" data-detail-type="unit" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('unit','${r.id}')"><div class="list-grid-card-thumb">${renderListThumb(r,'unit',th)}</div><div class="list-grid-card-body"><div class="list-grid-card-name">${esc(r.name)}</div><div class="list-grid-card-meta">${(r.special_icons||[]).filter(ic=>ic&&!String(ic).includes('Source')).map(ic=>pictureRasterHtml(ic,{cls:'name-special-icon',loading:'lazy',alt:'',onerror:"this.style.display='none'",lazy:false})).join('')}</div><div class="list-grid-card-stats">${t('col_hp')} ${fmtN(r.HP)} · ${t('col_en')} ${fmtN(r.EN)} · ${t('col_atk')} ${fmtN(r.ATK)} · ${t('col_def')} ${fmtN(r.DEF)} · ${t('col_mob')} ${fmtN(r.MOB)} · ${t('col_mov')} ${fmtN(r.MOV)}</div></div><div class="list-grid-cmp-wrap" onclick="event.stopPropagation()" title="${cmpLbl}"><span class="list-grid-cmp-inner"><input type="checkbox" class="cmp-cb cmp-cb-grid" data-cmp-id="${escAttr(String(r.id))}" aria-label="${cmpLbl}"></span></div></div>`).join('');wireGridCompareCheckboxes('unitGrid','unit')}
function renderUnitGridSkills(data){const grid=document.getElementById('unitGrid'),th=108,cmpLbl=escAttr(t('cmp_compare'));grid.innerHTML=data.rows.map(r=>{const strip=renderCharGridSkillStrip(r.grid_abilities||[]);return`<div class="list-grid-card list-grid-card--cmp list-grid-card--skills list-grid-card--unit-skills-v2" data-detail-type="unit" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('unit','${r.id}')"><div class="list-grid-card-main-row"><div class="list-grid-card-char-col"><div class="list-grid-card-thumb">${renderListThumb(r,'unit',th)}</div><div class="list-grid-card-body"><div class="list-grid-card-name">${esc(r.name)}</div></div><div class="list-grid-card-skills-hr">${strip}</div></div></div><div class="list-grid-cmp-wrap" onclick="event.stopPropagation()" title="${cmpLbl}"><span class="list-grid-cmp-inner"><input type="checkbox" class="cmp-cb cmp-cb-grid" data-cmp-id="${escAttr(String(r.id))}" aria-label="${cmpLbl}"></span></div></div>`}).join('');wireGridCompareCheckboxes('unitGrid','unit')}
function renderUnitT(data){const tb=document.getElementById('unitBody'),em=document.getElementById('unitEmpty');if(!data.rows||!data.rows.length){tb.innerHTML='';const g=document.getElementById('unitGrid');if(g)g.innerHTML='';em.style.display='block';syncUnitListDetailHighlight();return}em.style.display='none';if(getListViewMode('units')==='grid'){tb.innerHTML='';renderUnitGrid(data)}else{const g=document.getElementById('unitGrid');if(g)g.innerHTML='';renderUnitTable(data)}syncUnitListDetailHighlight()}
function renderSuppTable(data){document.getElementById('suppBody').innerHTML=data.rows.map(r=>`<tr data-detail-type="supporter" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('supporter','${r.id}')"><td class="col-thum">${renderListThumb(r,'supp')}</td><td class="col-name"><div class="name-cell"><span class="name-text">${esc(r.name)}</span></div></td><td class="col-tag"><div class="detail-tags-row" style="margin-top:0;align-items:center;">${renderSkillTags(r.skill_tag_data)}</div></td><td class="col-boost"><div class="skill-summary" style="-webkit-line-clamp:3;white-space:pre-wrap;">${esc(r.boost)}</div></td><td class="col-skill">${r.active_icon?pictureRasterHtml(r.active_icon,{loading:'lazy',alt:'',extra:'style="width:44px;height:44px;border:none;background:transparent;object-fit:contain;margin:0 auto;display:block;"',onerror:"this.style.display='none'",lazy:false}):'<div style="text-align:center;color:var(--text-muted)">-</div>'}</td></tr>`).join('')}
function renderSuppGrid(data){const grid=document.getElementById('suppGrid'),th=108;grid.innerHTML=data.rows.map(r=>`<div class="list-grid-card" data-detail-type="supporter" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('supporter','${r.id}')"><div class="list-grid-card-thumb">${renderListThumb(r,'supp',th)}</div><div class="list-grid-card-body"><div class="list-grid-card-name">${esc(r.name)}</div><div class="detail-tags-row" style="margin-top:0;align-items:center;justify-content:center;">${renderSkillTags(r.skill_tag_data)}</div><div class="list-grid-card-stats" style="font-size:12px;margin-top:4px;">${esc(r.boost||'')}</div>${r.active_icon?`<div style="margin-top:6px;">${pictureRasterHtml(r.active_icon,{loading:'lazy',alt:'',extra:'style="width:44px;height:44px;object-fit:contain;margin:0 auto;display:block;"',onerror:"this.style.display='none'",lazy:false})}</div>`:''}</div></div>`).join('')}
function renderSuppT(data){const tb=document.getElementById('suppBody'),em=document.getElementById('suppEmpty');if(!data.rows||!data.rows.length){tb.innerHTML='';const g=document.getElementById('suppGrid');if(g)g.innerHTML='';em.style.display='block';return}em.style.display='none';if(getListViewMode('supporters')==='grid'){tb.innerHTML='';renderSuppGrid(data)}else{const g=document.getElementById('suppGrid');if(g)g.innerHTML='';renderSuppTable(data)}}
function renderModLineageTagCell(tags){if(!tags||!tags.length)return'<span style="color:var(--text-muted)">-</span>';return`<div class="detail-tags-row" style="margin-top:0;align-items:center;flex-wrap:wrap;">${tags.map(tg=>createTagHtml(tg,{defaultTarget:'unit'})).join('')}</div>`}
function openOptionPartDetail(id,variantTag){const opts={};if(variantTag)opts.variantTag=String(variantTag);openDetail('option_part',String(id),opts)}
function renderModTable(data){document.getElementById('modBody').innerHTML=data.rows.map(r=>{const icon=r.thum?imgTag(r.thum,{cls:'row-thum mod-icon',webp:true,onerror:"this.outerHTML='<div class=\\'row-thum-placeholder\\'>⚙</div>'"}) :'<div class="row-thum-placeholder">⚙</div>';const vt=escJs(String(r.variant_tag_id||''));return`<tr class="mod-browse-row" data-detail-type="option_part" data-detail-id="${escAttr(String(r.id))}" onclick="openOptionPartDetail('${escJs(String(r.id))}','${vt}')"><td class="col-thum">${icon}</td><td class="col-name"><div class="name-cell"><span class="name-text mod-name">${esc(r.name)}</span></div></td><td class="col-tag">${renderModLineageTagCell(r.tags)}</td><td class="col-details"><div class="mod-details-cell">${esc(r.details||'')}</div></td></tr>`}).join('')}
function renderModGrid(data){const grid=document.getElementById('modGrid');grid.innerHTML=data.rows.map(r=>{const icon=r.thum?imgTag(r.thum,{cls:'row-thum mod-icon',webp:true,onerror:"this.outerHTML='<div class=\\'row-thum-placeholder\\'>⚙</div>'"}) :'<div class="row-thum-placeholder">⚙</div>';const tagRow=r.tags&&r.tags.length?`<div class="detail-tags-row" style="margin-top:4px;align-items:center;flex-wrap:wrap;justify-content:flex-start;">${r.tags.map(tg=>createTagHtml(tg,{defaultTarget:'unit'})).join('')}</div>`:`<div style="margin-top:4px;font-size:11px;color:var(--text-muted)">-</div>`;const vt=escJs(String(r.variant_tag_id||''));return`<div class="list-grid-card list-grid-card--mod mod-browse-row" data-detail-type="option_part" data-detail-id="${escAttr(String(r.id))}" onclick="openOptionPartDetail('${escJs(String(r.id))}','${vt}')"><div class="list-grid-card-thumb">${icon}</div><div class="list-grid-card-body"><div class="list-grid-card-name mod-name">${esc(r.name)}</div>${tagRow}<div class="mod-details-cell">${esc(r.details||'')}</div></div></div>`}).join('')}
function renderModT(data){const tb=document.getElementById('modBody'),em=document.getElementById('modEmpty');if(!data.rows||!data.rows.length){tb.innerHTML='';const g=document.getElementById('modGrid');if(g)g.innerHTML='';em.style.display='block';return}em.style.display='none';if(getListViewMode('modifications')==='grid'){tb.innerHTML='';renderModGrid(data)}else{const g=document.getElementById('modGrid');if(g)g.innerHTML='';renderModTable(data)}}
function renderStageTable(data){document.getElementById('stageBody').innerHTML=data.rows.map(r=>{const locked=!!r.content_locked;const isSa=r.stage_category==='score_attack';const isSs=r.stage_category==='special_stage';const ph=locked?'<div class="row-thum-placeholder stage-thum-locked">🔒</div>':(r.portrait?imgTag(r.portrait,{cls:'row-thum',webp:true,onerror:"this.parentElement.innerHTML='<div class=\\'row-thum-placeholder\\'>🗺️</div>'"}) :'<div class="row-thum-placeholder">🗺️</div>');const diffCell=locked?`<span class="stat-value er-stage-redacted-cell">—</span>`:(isSa||isSs)?'<span class="stat-value"></span>':`<span class="stage-diff-badge stage-diff-${esc(r.difficulty_code||'unknown')}">${esc(r.difficulty_name||'-')}</span>`;const numCell=locked?`<span class="stat-value er-stage-redacted-cell">—</span>`:isSs?'<span class="stat-value"></span>':`<span class="stat-value">${fmtN(r.stage_number)}</span>`;const nameCell=locked?`<span class="name-text er-stage-redacted-cell">${esc(t('er_stage_redacted_row'))}</span>`:`<span class="name-text">${esc(r.name)}</span>`;const cpDisp=locked?'—':fmtN(r.recommended_cp);const terDisp=locked?'—':esc(r.terrain);return`<tr data-detail-type="stage" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('stage','${r.id}')"><td class="col-thum"><div class="stage-thum-wrap">${ph}</div></td><td class="col-diff">${diffCell}</td><td class="col-number">${numCell}</td><td class="col-name"><div class="name-cell">${nameCell}</div></td><td class="col-cp"><span class="stat-value">${cpDisp}</span></td><td class="col-terrain"><span class="stat-value">${terDisp}</span></td></tr>`}).join('')}
function renderStageGrid(data){const grid=document.getElementById('stageGrid');grid.innerHTML=data.rows.map(r=>{const locked=!!r.content_locked;const isSa=r.stage_category==='score_attack';const isSs=r.stage_category==='special_stage';const ph=locked?'<div class="row-thum-placeholder stage-thum-locked">🔒</div>':(r.portrait?imgTag(r.portrait,{cls:'row-thum',webp:true,onerror:"this.parentElement.innerHTML='<div class=\\'row-thum-placeholder\\'>🗺️</div>'"}) :'<div class="row-thum-placeholder">🗺️</div>');const metaLine=locked?`<span class="stat-value er-stage-redacted-cell">—</span>`:isSs?'':isSa?`<span class="stat-value">#${fmtN(r.stage_number)}</span>`:`<span class="stage-diff-badge stage-diff-${esc(r.difficulty_code||'unknown')}">${esc(r.difficulty_name||'-')}</span> <span class="stat-value">#${fmtN(r.stage_number)}</span>`;const metaRow=!locked&&isSs?'':`<div class="list-grid-card-meta">${metaLine}</div>`;const nameLine=locked?`<div class="list-grid-card-name er-stage-redacted-cell">${esc(t('er_stage_redacted_row'))}</div>`:`<div class="list-grid-card-name">${esc(r.name)}</div>`;const cpPart=locked?'—':fmtN(r.recommended_cp);const terPart=locked?'—':esc(r.terrain);return`<div class="list-grid-card list-grid-card--stage${locked?' list-grid-card--locked':''}" data-detail-type="stage" data-detail-id="${escAttr(String(r.id))}" onclick="openDetail('stage','${r.id}')"><div class="list-grid-card-thumb"><div class="stage-thum-wrap">${ph}</div></div><div class="list-grid-card-body">${metaRow}${nameLine}<div class="list-grid-card-stats">${t('col_stage_cp')} ${cpPart} · ${t('terrain')} ${terPart}</div></div></div>`}).join('')}
function renderStageT(data){const tb=document.getElementById('stageBody'),em=document.getElementById('stageEmpty');if(!data.rows||!data.rows.length){tb.innerHTML='';const g=document.getElementById('stageGrid');if(g)g.innerHTML='';em.style.display='block';return}em.style.display='none';if(getListViewMode('stages')==='grid'){tb.innerHTML='';renderStageGrid(data)}else{const g=document.getElementById('stageGrid');if(g)g.innerHTML='';renderStageTable(data)}}
function sortCol(type,key){let s;if(type==='characters')s=S.characters;else if(type==='units')s=S.units;else s=S.supporters;if(s.sort===key){s.dir=s.dir==='desc'?'asc':'desc'}else{s.sort=key;s.dir=key==='name'?'asc':'desc'}buildTableHeaders();if(type==='characters')loadCharacters(1);else if(type==='units')loadUnits(1);else loadSupporters(1)}
function sortColStage(key){const s=S.stages;if(s.sort===key){s.dir=s.dir==='desc'?'asc':'desc'}else{s.sort=key;s.dir='asc'}buildTableHeaders();loadStages(1)}
function sortColMod(key){const s=S.modifications;if(s.sort===key){s.dir=s.dir==='desc'?'asc':'desc'}else{s.sort=key;s.dir='asc'}buildTableHeaders();loadModifications(1)}
function updateStageDifficultyFilterButtons(){const df=S.stages.difficultyFilter;const label=document.getElementById('stageDiffFilterLabel');const btn=document.getElementById('stageDiffFilterBtn');if(!label||!btn)return;if(df==='ALL'){label.innerHTML=`<span class="stage-diff-btn-plain">${esc(t('filter_diff_all'))}</span>`;btn.classList.remove('active')}else{const cls=df==='normal'?'diff-pill-normal':df==='hard'?'diff-pill-hard':'diff-pill-expert';const txt=df==='normal'?t('filter_diff_normal'):df==='hard'?t('filter_diff_hard'):t('filter_diff_expert');label.innerHTML=`<span class="diff-pill ${cls}">${esc(txt)}</span>`;btn.classList.add('active')}}
function syncStageSourceToolbar(){const src=S.stages.source||'eternal';const diff=document.getElementById('stageDiffWrap');if(diff)diff.style.display=src==='eternal'?'':'none';const bE=document.getElementById('stageSourceEternalBtn');const bS=document.getElementById('stageSourceScoreBtn');const bP=document.getElementById('stageSourceSpecialBtn');if(bE){bE.classList.toggle('active',src==='eternal');bE.setAttribute('aria-pressed',src==='eternal'?'true':'false')}if(bS){bS.classList.toggle('active',src==='score_attack');bS.setAttribute('aria-pressed',src==='score_attack'?'true':'false')}if(bP){bP.classList.toggle('active',src==='special_stage');bP.setAttribute('aria-pressed',src==='special_stage'?'true':'false')}}
function setStageBrowseSource(mode){if(mode!=='eternal'&&mode!=='score_attack'&&mode!=='special_stage')return;if((S.stages.source||'eternal')===mode)return;S.stages.source=mode;syncStageSourceToolbar();scheduleBrowseListReload('stages')}
function renderPag(pfx,data){const el=document.getElementById(`${pfx}Pagination`);if(!el)return;const{page,total_pages}=data;if(total_pages<=1){el.innerHTML='';return}let fn;if(pfx==='char')fn='loadCharacters';else if(pfx==='unit')fn='loadUnits';else if(pfx==='supp')fn='loadSupporters';else if(pfx==='mod')fn='loadModifications';else if(pfx==='rank')fn='loadRankingList';else fn='loadStages';let h='';h+=`<button class="page-btn ${page<=1?'disabled':''}" ${page>1?`onclick="${fn}(${page-1})"`:''}>◀</button>`;const mx=7;let sp=Math.max(1,page-Math.floor(mx/2));let ep=Math.min(total_pages,sp+mx-1);if(ep-sp<mx-1)sp=Math.max(1,ep-mx+1);if(sp>1){h+=`<button class="page-btn" onclick="${fn}(1)">1</button>`;if(sp>2)h+=`<span class="page-info">…</span>`}for(let i=sp;i<=ep;i++)h+=`<button class="page-btn ${i===page?'active':''}" onclick="${fn}(${i})">${i}</button>`;if(ep<total_pages){if(ep<total_pages-1)h+=`<span class="page-info">…</span>`;h+=`<button class="page-btn" onclick="${fn}(${total_pages})">${total_pages}</button>`}h+=`<button class="page-btn ${page>=total_pages?'disabled':''}" ${page<total_pages?`onclick="${fn}(${page+1})"`:''}>▶</button>`;el.innerHTML=h}
function toggleStatState(type){if(type==='sp'){if(S.spActive){S.spActive=false}else{S.spActive=true;S.sspActive=false}}else if(type==='ssp'){if(S.sspActive){S.sspActive=false}else{S.sspActive=true;S.spActive=false}}const spBtn=document.getElementById('spToggleBtn');const spBtnChar=document.getElementById('spToggleBtnChar');const sspBtn=document.getElementById('sspToggleBtn');if(spBtn)spBtn.classList.toggle('active',S.spActive);if(spBtnChar)spBtnChar.classList.toggle('active',S.spActive);if(sspBtn)sspBtn.classList.toggle('active',S.sspActive);invalidateDetailRankingCachesForPerspectiveChange();updateDetailDynamicSections(S.currentDetailType)}
function updateLbTier(val){S.currentLbTier=parseInt(val,10);document.querySelectorAll('.lb-icon-btn').forEach(b=>b.classList.remove('active'));const ab=document.querySelector(`.lb-icon-btn[data-val="${val}"]`);if(ab)ab.classList.add('active');updateDetailDynamicSections(S.currentDetailType)}
function updateSupporterLevel(lv){S.currentSupporterLevel=Math.min(100,Math.max(1,lv));const sv=document.getElementById('suppLevelVal');if(sv)sv.textContent=S.currentSupporterLevel;clearTimeout(S._supporterLevelDebounce);S._supporterLevelDebounce=setTimeout(()=>refreshSupporterDetail(),200)}
async function updateSupporterLbTier(tier){const t=Math.min(3,Math.max(0,parseInt(tier,10)||0));S.currentSupporterLbTier=t;document.querySelectorAll('.supporter-lb-group .lb-icon-btn').forEach(b=>{b.classList.toggle('active',parseInt(b.dataset.val,10)===t)});await refreshSupporterDetail()}
async function refreshSupporterDetail(){const d=S.currentDetailData;if(!d||S.currentDetailType!=='supporter')return;const lv=S.currentSupporterLevel||100;const lb=S.currentSupporterLbTier??3;try{const r=await fetch(`/api/supporter/${d.id}?lang=${S.lang}&level=${lv}&lb_tier=${lb}`);const nd=await r.json();if(nd.error)return;S.currentDetailData={...nd,lb_tier:lb};document.getElementById('detailInner').innerHTML=renderSupporterShell(S.currentDetailData);updateDetailDynamicSections('supporter')}catch(e){console.error(e)}}
function switchWeaponLevel(wid,level){S.currentWeaponLevels[wid]=parseInt(level,10);const d=S.currentDetailData;document.getElementById('detailWeaponsContainer').innerHTML=renderWeaponsDynamic(d.weapons,S.sspActive,d)}
function updateTagModalTitle(){const ts=S._currentTagStr;if(ts===undefined||ts===null)return;const op=S._currentTagOp||'or';const ds=String(ts).split(',').join(op==='and'?' + ':t('tag_or'));let prefix;if(S._tagTargetType==='affinity')prefix=t('tag_results_affinity');else prefix=S._tagTargetType==='unit'?t('tag_results_unit'):t('tag_results_char');const el=document.getElementById('tagModalTitle');if(el)el.innerHTML=`${prefix} <span style="color:#fff;padding:2px 10px;background:rgba(0,212,255,0.2);border:1px solid rgba(0,212,255,0.4);border-radius:12px;font-size:16px;">${esc(ds)}</span>`}
function updateSeriesModalTitle(){const el=document.getElementById('tagModalTitle');const label=S._tagTargetType==='unit'?t('series_results_unit'):t('series_results_char');const pill=esc(S._seriesModalName||('#'+S._seriesModalSid));if(el)el.innerHTML=`${label} <span style="color:#fff;padding:2px 10px;background:rgba(0,212,255,0.2);border:1px solid rgba(0,212,255,0.4);border-radius:12px;font-size:16px;">${pill}</span>`}
function openTagModal(ts,op,preferredTarget){const tm=document.getElementById('tagModal');S._tagModalMode='tags';S._currentTagStr=ts;S._currentTagOp=op;const pt=(preferredTarget==='unit'||preferredTarget==='character')?preferredTarget:'';S._tagTargetType=pt||(S.currentDetailType==='character'?'character':'unit');S._tagModalSource=(S.currentDetailType==='unit'||S.currentDetailType==='character')?S.currentDetailType:'character';const ta=document.getElementById('tagTabAffinity');if(ta)ta.style.display='';document.getElementById('tagTabUnit').classList.toggle('active',S._tagTargetType==='unit');document.getElementById('tagTabChar').classList.toggle('active',S._tagTargetType==='character');if(ta)ta.classList.toggle('active',S._tagTargetType==='affinity');tm.classList.add('active');applyBackgroundScrollLock();S._tagRarityFilter='ALL';S._tagAcqFilter='ALL';updateTagModalTitle();fetchAndRenderTagModal()}
function switchTagTarget(type){S._tagTargetType=type;document.getElementById('tagTabUnit').classList.toggle('active',type==='unit');document.getElementById('tagTabChar').classList.toggle('active',type==='character');const ta=document.getElementById('tagTabAffinity');if(ta)ta.classList.toggle('active',type==='affinity');S._tagRarityFilter='ALL';S._tagAcqFilter='ALL';if(S._tagModalMode==='series'){updateSeriesModalTitle();fetchAndRenderSeriesModal()}else{updateTagModalTitle();fetchAndRenderTagModal()}}
async function fetchAndRenderTagModal(){const tb=document.getElementById('tagModalBody');tb.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';try{const ep=S._tagTargetType==='affinity'?'/api/tag_affinity':(S._tagTargetType==='character'?'/api/tag_characters':'/api/tag_units');const qs=S._tagTargetType==='affinity'?`?lang=${S.lang}&tags=${encodeURIComponent(S._currentTagStr)}&op=${S._currentTagOp}&source=${encodeURIComponent(S._tagModalSource||'character')}`:`?lang=${S.lang}&tags=${encodeURIComponent(S._currentTagStr)}&op=${S._currentTagOp}`;const r=await fetch(`${ep}${qs}`);const d=await r.json();let h=`<div class="tag-rarity-filter"><button class="tag-rarity-btn active" data-filter-type="rarity" onclick="filterTagRarity('ALL',this)">All</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('UR',this)">UR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('SSR',this)">SSR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('SR',this)">SR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('R',this)">R</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('N',this)">N</button><span style="width:1px;height:20px;background:var(--border-color);margin:0 6px;flex-shrink:0;"></span><button class="tag-rarity-btn active" data-filter-type="acq" onclick="filterTagAcq('ALL',this)">All</button><button class="tag-rarity-btn" data-filter-type="acq" onclick="filterTagAcq('GACHA',this)">Gacha</button><button class="tag-rarity-btn" data-filter-type="acq" onclick="filterTagAcq('NON_GACHA',this)">Non-Gacha</button></div>`;let any=false;let ih='<div id="tagUnitsWrapper">';['1','2','3'].forEach(rId=>{const items=d[rId];if(items&&items.length>0){any=true;const rim={'1':'/static/images/UI/UI_Common_TypeIcon_Attack_M.webp','2':'/static/images/UI/UI_Common_TypeIcon_Defense_M.webp','3':'/static/images/UI/UI_Common_TypeIcon_Support_M.webp'};const rnm={'1':tRole('Attack'),'2':tRole('Defense'),'3':tRole('Support')};const dt=S._tagTargetType==='affinity'?(S._tagModalSource==='unit'?'character':'unit'):S._tagTargetType;const ph=dt==='character'?'👤':'🤖';ih+=`<div class="tag-role-group"><div class="tag-role-title"><img src="${imgUrl(rim[rId])}" alt="" loading="lazy"> ${esc(rnm[rId])}</div><div class="tag-unit-grid">${items.map(u=>`<div class="tag-unit-item" data-detail-type="${dt}" data-detail-id="${escAttr(String(u.id))}" data-rarity="${u.rarity}" data-acq="${u.acquisition_route||'0'}" onclick="openDetail('${dt}','${u.id}');closeTagModalForce();"><div class="tag-unit-icon-wrapper">${u.thum?`<img class="tmb-inner" src="${imgUrl(u.thum)}" loading="lazy">`:`<div class="tmb-inner" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:20px;">${ph}</div>`}<img class="tmb-frame" src="${imgUrl(RARITY_FRAME_MAP[u.rarity]||RARITY_FRAME_MAP['N'])}" loading="lazy"></div><div class="tag-unit-name">${esc(u.name)}</div></div>`).join('')}</div></div>`}});ih+='</div>';if(!any)h+=`<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:16px;">No results found.</div>`;else h+=ih;tb.innerHTML=h;applyTagFilters()}catch(e){tb.innerHTML=`<div style="text-align:center;padding:40px;color:var(--accent-red);">Error loading data.</div>`}}
async function fetchAndRenderSeriesModal(){const tb=document.getElementById('tagModalBody');tb.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';try{const ep=S._tagTargetType==='character'?'/api/series_characters':'/api/series_units';const r=await fetch(`${ep}?lang=${S.lang}&series_id=${encodeURIComponent(S._seriesModalSid)}`);const d=await r.json();let h=`<div class="tag-rarity-filter"><button class="tag-rarity-btn active" data-filter-type="rarity" onclick="filterTagRarity('ALL',this)">All</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('UR',this)">UR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('SSR',this)">SSR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('SR',this)">SR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('R',this)">R</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterTagRarity('N',this)">N</button><span style="width:1px;height:20px;background:var(--border-color);margin:0 6px;flex-shrink:0;"></span><button class="tag-rarity-btn active" data-filter-type="acq" onclick="filterTagAcq('ALL',this)">All</button><button class="tag-rarity-btn" data-filter-type="acq" onclick="filterTagAcq('GACHA',this)">Gacha</button><button class="tag-rarity-btn" data-filter-type="acq" onclick="filterTagAcq('NON_GACHA',this)">Non-Gacha</button></div>`;let any=false;let ih='<div id="tagUnitsWrapper">';['1','2','3'].forEach(rId=>{const items=d[rId];if(items&&items.length>0){any=true;const rim={'1':'/static/images/UI/UI_Common_TypeIcon_Attack_M.webp','2':'/static/images/UI/UI_Common_TypeIcon_Defense_M.webp','3':'/static/images/UI/UI_Common_TypeIcon_Support_M.webp'};const rnm={'1':tRole('Attack'),'2':tRole('Defense'),'3':tRole('Support')};const ph=S._tagTargetType==='character'?'👤':'🤖';ih+=`<div class="tag-role-group"><div class="tag-role-title"><img src="${imgUrl(rim[rId])}" alt="" loading="lazy"> ${esc(rnm[rId])}</div><div class="tag-unit-grid">${items.map(u=>`<div class="tag-unit-item" data-detail-type="${S._tagTargetType}" data-detail-id="${escAttr(String(u.id))}" data-rarity="${u.rarity}" data-acq="${u.acquisition_route||'0'}" onclick="openDetail('${S._tagTargetType}','${u.id}');closeTagModalForce();"><div class="tag-unit-icon-wrapper">${u.thum?`<img class="tmb-inner" src="${imgUrl(u.thum)}" loading="lazy">`:`<div class="tmb-inner" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:20px;">${ph}</div>`}<img class="tmb-frame" src="${imgUrl(RARITY_FRAME_MAP[u.rarity]||RARITY_FRAME_MAP['N'])}" loading="lazy"></div><div class="tag-unit-name">${esc(u.name)}</div></div>`).join('')}</div></div>`}});ih+='</div>';if(!any)h+=`<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:16px;">No results found.</div>`;else h+=ih;tb.innerHTML=h;applyTagFilters()}catch(e){tb.innerHTML=`<div style="text-align:center;padding:40px;color:var(--accent-red);">Error loading data.</div>`}}
function filterTagRarity(r,btn){document.querySelectorAll('.tag-rarity-btn[data-filter-type="rarity"]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');S._tagRarityFilter=r;applyTagFilters()}
function filterTagAcq(a,btn){document.querySelectorAll('.tag-rarity-btn[data-filter-type="acq"]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');S._tagAcqFilter=a;applyTagFilters()}
function applyTagFilters(){const r=S._tagRarityFilter||'ALL';const a=S._tagAcqFilter||'ALL';document.querySelectorAll('.tag-unit-item').forEach(item=>{let rm=(r==='ALL'||item.dataset.rarity===r);let am=true;if(a==='GACHA')am=(item.dataset.acq==='1');if(a==='NON_GACHA')am=(item.dataset.acq!=='1');item.style.display=(rm&&am)?'flex':'none'});document.querySelectorAll('.tag-role-group').forEach(g=>{g.style.display=Array.from(g.querySelectorAll('.tag-unit-item')).some(i=>i.style.display!=='none')?'block':'none'})}
function closeTagModal(e){if(e.target===e.currentTarget)closeTagModalForce()}
function closeTagModalForce(){document.getElementById('tagModal').classList.remove('active');S._tagModalMode='tags';releaseBackgroundScrollLock()}
function openSkillModal(skillName){S._skillModalName=skillName;S._skillModalType='skill';const sm=document.getElementById('skillModal');document.getElementById('skillModalTitle').innerHTML=`${t('char_with_skill')} <span style="color:#fff;padding:2px 10px;background:rgba(0,212,255,0.2);border:1px solid rgba(0,212,255,0.4);border-radius:12px;font-size:16px;">${esc(skillName)}</span>`;sm.classList.add('active');applyBackgroundScrollLock();fetchAndRenderSkillModal()}
function openAbilityModal(abilityName,target,displayName){S._skillModalName=abilityName;S._skillModalDisplayName=(displayName!=null&&String(displayName).trim())?String(displayName).trim():abilityName;S._skillModalType='ability';S._skillModalTarget=target||(S.currentDetailType==='character'?'character':'unit');const sm=document.getElementById('skillModal');const lbl=S._skillModalTarget==='character'?t('char_with_ability'):t('unit_with_ability');const show=S._skillModalDisplayName;document.getElementById('skillModalTitle').innerHTML=`${lbl} <span style="color:#fff;padding:2px 10px;background:rgba(0,212,255,0.2);border:1px solid rgba(0,212,255,0.4);border-radius:12px;font-size:16px;">${esc(show)}</span>`;sm.classList.add('active');applyBackgroundScrollLock();fetchAndRenderSkillModal()}
async function fetchAndRenderSkillModal(){const tb=document.getElementById('skillModalBody');tb.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';try{let ep,ph;if(S._skillModalType==='skill'){ep='/api/skill_characters';ph='👤'}else{ep=S._skillModalTarget==='character'?'/api/ability_characters':'/api/ability_units';ph=S._skillModalTarget==='character'?'👤':'🤖'}const r=await fetch(`${ep}?lang=${S.lang}&${S._skillModalType==='skill'?'skill_name':'ability_name'}=${encodeURIComponent(S._skillModalName)}`);const d=await r.json();let any=false;let ih='<div id="skillModalWrapper">';['1','2','3'].forEach(rId=>{const items=d[rId];if(items&&items.length>0){any=true;const rim={'1':'/static/images/UI/UI_Common_TypeIcon_Attack_M.webp','2':'/static/images/UI/UI_Common_TypeIcon_Defense_M.webp','3':'/static/images/UI/UI_Common_TypeIcon_Support_M.webp'};const rnm={'1':tRole('Attack'),'2':tRole('Defense'),'3':tRole('Support')};ih+=`<div class="tag-role-group"><div class="tag-role-title"><img src="${imgUrl(rim[rId])}" alt="" loading="lazy"> ${esc(rnm[rId])}</div><div class="tag-unit-grid">${items.map(u=>`<div class="tag-unit-item" data-detail-type="${S._skillModalTarget||(S._skillModalType==='skill'?'character':'unit')}" data-detail-id="${escAttr(String(u.id))}" data-rarity="${u.rarity}" data-acq="${u.acquisition_route||'0'}" onclick="openDetail('${S._skillModalTarget||(S._skillModalType==='skill'?'character':'unit')}','${u.id}');closeSkillModalForce();"><div class="tag-unit-icon-wrapper">${u.thum?`<img class="tmb-inner" src="${imgUrl(u.thum)}" loading="lazy">`:`<div class="tmb-inner" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:20px;">${ph}</div>`}<img class="tmb-frame" src="${imgUrl(RARITY_FRAME_MAP[u.rarity]||RARITY_FRAME_MAP['N'])}" loading="lazy"></div><div class="tag-unit-name">${esc(u.name)}</div></div>`).join('')}</div></div>`}});ih+='</div>';if(!any)tb.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:16px;">No results found.</div>`;else{tb.innerHTML=`<div class="tag-rarity-filter"><button class="tag-rarity-btn active" data-filter-type="rarity" onclick="filterSkillRarity('ALL',this)">All</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterSkillRarity('UR',this)">UR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterSkillRarity('SSR',this)">SSR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterSkillRarity('SR',this)">SR</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterSkillRarity('R',this)">R</button><button class="tag-rarity-btn" data-filter-type="rarity" onclick="filterSkillRarity('N',this)">N</button></div>`+ih;applySkillFilters()}}catch(e){tb.innerHTML=`<div style="text-align:center;padding:40px;color:var(--accent-red);">Error loading data.</div>`}}
function filterSkillRarity(r,btn){document.querySelectorAll('#skillModalBody .tag-rarity-btn[data-filter-type="rarity"]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');S._skillRarityFilter=r;applySkillFilters()}
function applySkillFilters(){const r=S._skillRarityFilter||'ALL';document.querySelectorAll('#skillModalBody .tag-unit-item').forEach(item=>{const rm=(r==='ALL'||item.dataset.rarity===r);item.style.display=rm?'flex':'none'});document.querySelectorAll('#skillModalBody .tag-role-group').forEach(g=>{g.style.display=Array.from(g.querySelectorAll('.tag-unit-item')).some(i=>i.style.display!=='none')?'block':'none'})}
function closeSkillModal(e){if(e.target===e.currentTarget)closeSkillModalForce()}
function closeSkillModalForce(){document.getElementById('skillModal').classList.remove('active');releaseBackgroundScrollLock()}
const DETAIL_PREFETCH_CACHE_MAX=48;
const _detailJsonPrefetchCache=new Map();
const _detailJsonPrefetchInflight=new Map();
const _warmedDetailImgUrls=new Set();
const WARMED_DETAIL_IMG_MAX=800;
let _detailPrefetchHoverTimer=null;
let _detailPrefetchIntentWired=false;
function syncHistoryToBrowsePath(path){try{const tail=(location.search||'')+(location.hash||'');history.replaceState(history.state||{},'',path+tail)}catch(_){}}
const MAIN_TAB_URL_SHORT={stages:'ER',calculator:'DS',team_builder:'TB',modifications:'op'};
const MAIN_TAB_PATH_SHORT={characters:'/c',units:'/u',supporters:'/s',latest_release:'/new',stages:'/st',calculator:'/cal',team_builder:'/tb',modifications:'/op',banner_timeline:'/tl',ranking:'/rk'};
function syncMainTabQueryParam(tab){
try{
const u=new URL(location.href);
const code=MAIN_TAB_URL_SHORT[tab];
if(code)u.searchParams.set('tab',code);else u.searchParams.delete('tab');
history.replaceState(history.state||{},'',u.pathname+u.search+u.hash);
}catch(_){}
}
function syncMainTabShortPath(tab){
const p=MAIN_TAB_PATH_SHORT[tab]||'/';
syncHistoryToBrowsePath(p);
}
function urlTabParamBlocksBrowseShortPath(te){
if(te==null||te==='')return false;
const e=String(te).trim();
return e==='calculator'||e==='DS'||e==='team_builder'||e==='TB'||e==='ER'||e==='stages'||e==='op'||e==='modifications'||e==='OP';
}
function stagesOrModsTabFromQueryOnLoad(){
const p=new URLSearchParams(location.search);
const raw=String(p.get('tab')||'').trim();
const path=(location.pathname||'').replace(/\/$/,'');
/* When tab=ER blocks applyBrowseShortPathOnLoad, still honor /es/:id like /op/:id for modifications. */
const stageFromPath=parseBrowseShortPath(location.pathname);
if(stageFromPath&&stageFromPath.kind==='detail'&&stageFromPath.type==='stage'&&(raw==='ER'||raw==='stages')){
switchTab('stages');
openDetail('stage',stageFromPath.id,{skipHistoryReplace:true});
try{window.scrollTo(0,0)}catch(_){}
return
}
if(raw==='ER'||raw==='stages'){switchTab('stages');return}
if(raw==='DS'||raw==='calculator'){switchTab('calculator');return}
if(raw==='TB'||raw==='team_builder'){switchTab('team_builder');return}
if(raw==='op'||raw==='OP'||raw==='modifications'){
if(/^\/op\/[^/]+$/.test(path)){
const parsed=parseBrowseShortPath(location.pathname);
if(parsed&&parsed.kind==='option_part'){
switchTab('modifications');
openDetail('option_part',parsed.id,{skipHistoryReplace:true});try{window.scrollTo(0,0)}catch(_){}
}
return;
}
switchTab('modifications');
}
}
function browseShortPathForDetailType(type,id){
const enc=encodeURIComponent(String(id||'').trim());
if(type==='unit')return'/u/'+enc;
if(type==='character')return'/c/'+enc;
if(type==='supporter')return'/s/'+enc;
if(type==='stage')return'/es/'+enc;
if(type==='option_part')return'/op/'+enc;
return null;
}
function parseBrowseShortPath(pathname){
const raw=(pathname||'').replace(/\/$/,'');
if(!raw||raw==='/')return null;
const seg=raw.split('/').filter(Boolean);
if(seg.length===1&&seg[0]==='new')return{kind:'latest_release'};
if(seg.length===1&&seg[0]==='c')return{kind:'main_tab',tab:'characters'};
if(seg.length===1&&seg[0]==='u')return{kind:'main_tab',tab:'units'};
if(seg.length===1&&seg[0]==='s')return{kind:'main_tab',tab:'supporters'};
if(seg.length===1&&seg[0]==='tl')return{kind:'main_tab',tab:'banner_timeline'};
if(seg.length===1&&seg[0]==='banners')return{kind:'main_tab',tab:'banner_timeline'};
if(seg.length===1&&seg[0]==='st')return{kind:'main_tab',tab:'stages'};
if(seg.length===1&&seg[0]==='cal')return{kind:'main_tab',tab:'calculator'};
if(seg.length===1&&seg[0]==='tb')return{kind:'main_tab',tab:'team_builder'};
if(seg.length===1&&seg[0]==='op')return{kind:'main_tab',tab:'modifications'};
if(seg.length===1&&seg[0]==='rk')return{kind:'main_tab',tab:'ranking'};
if(seg.length!==2)return null;
const a=seg[0],b=seg[1];
let id;
try{id=decodeURIComponent(b)}catch(_){id=b}
if(!id)return null;
if(a==='u')return{kind:'detail',type:'unit',id};
if(a==='c')return{kind:'detail',type:'character',id};
if(a==='s')return{kind:'detail',type:'supporter',id};
if(a==='op')return{kind:'option_part',id};
if(a==='es')return{kind:'detail',type:'stage',id};
return null;
}
function applyBrowseShortPathOnLoad(){
const parsed=parseBrowseShortPath(location.pathname);
if(!parsed)return false;
if(parsed.kind==='latest_release'){switchTab('latest_release');tryLoadLatestRelease();return true}
if(parsed.kind==='main_tab'){switchTab(parsed.tab);return true}
if(parsed.kind==='option_part'){switchTab('modifications');openDetail('option_part',parsed.id,{skipHistoryReplace:true});try{window.scrollTo(0,0)}catch(_){}return true}
if(parsed.kind==='detail'){const t=parsed.type,id=parsed.id;if(t==='unit')switchTab('units');else if(t==='character')switchTab('characters');else if(t==='supporter')switchTab('supporters');else if(t==='stage')switchTab('stages');openDetail(t,id,{skipHistoryReplace:true});return true}
return false;
}
function detailPrefetchKey(type,id,opts){
opts=opts||{};
const v=opts.variantTag?String(opts.variantTag):'';
let rk='';
if(opts.viewRanking&&opts.useRankingDetailApi===true){
if(type==='character')rk=':rk';
else if(type==='unit'){
let sm='n';
if(opts.listUnitSspPerspective)sm='s';
else if(opts.listUnitSpPerspective)sm='p';
rk=`:rk:${sm}:${opts.listUnitCondPerspective?'1':'0'}`;
}
}
return String(S.lang||'EN')+':'+String(type)+':'+String(id)+':'+v+rk
}
function detailApiUrl(type,id,opts){
opts=opts||{};
const eid=encodeURIComponent(id),lang=encodeURIComponent(S.lang);
let rankSuf='';
if(opts.viewRanking&&opts.useRankingDetailApi===true){
if(type==='character')rankSuf='&view=ranking';
else if(type==='unit'){
let sm='normal';
if(opts.listUnitSspPerspective)sm='ssp';
else if(opts.listUnitSpPerspective)sm='sp';
const cond=opts.listUnitCondPerspective?'1':'0';
rankSuf=`&view=ranking&stat_mode=${encodeURIComponent(sm)}&cond=${cond}`;
}
}
if(type==='character')return`/api/character/${eid}?lang=${lang}${rankSuf}`;
if(type==='unit')return`/api/unit/${eid}?lang=${lang}${rankSuf}`;
if(type==='supporter')return`/api/supporter/${eid}?lang=${lang}&level=100&lb_tier=3`;
if(type==='option_part'){
const vt=opts.variantTag?`&variant_tag=${encodeURIComponent(String(opts.variantTag))}`:'';
return`/api/option_part/${eid}?lang=${lang}${vt}`
}
return`/api/stage/${eid}?lang=${lang}`;
}
function warmResolvedDetailImg(u){
if(!u||_warmedDetailImgUrls.has(u))return;
if(_warmedDetailImgUrls.size>=WARMED_DETAIL_IMG_MAX)_warmedDetailImgUrls.clear();
_warmedDetailImgUrls.add(u);
const im=new Image();
im.decoding='async';
im.src=u;
}
function warmPathDetailImg(path){
if(!path)return;
const u=isRasterWebpCandidate(path)?imgUrlWebp(path):imgUrl(path);
warmResolvedDetailImg(u);
}
function warmDetailImagesFromPayload(type,d){
if(!d||d.error)return;
let n=0;
const maxU=40;
const add=(p)=>{if(n>=maxU||!p)return;warmPathDetailImg(p);n++};
add(d.portrait);
add(d.rarity_icon);add(d.role_icon);add(d.acquisition_icon);
(d.special_icons||[]).forEach(add);
if(d.recommend_unit){add(d.recommend_unit.thum)}
if(d.recommend_character){add(d.recommend_character.thum)}
for(const sk of (d.skills||[])){if(n>=maxU)break;add(sk.icon);if(sk.frame_overlay)add(sk.frame_overlay)}
for(const ab of (d.abilities||[])){if(n>=maxU)break;add(ab.icon);if(ab.frame_overlay)add(ab.frame_overlay)}
if(type==='unit'){
for(const w of (d.weapons||[])){if(n>=maxU)break;add(w.icon)}
for(const m of (d.mechanisms||[])){if(n>=maxU)break;add(m.icon)}
}
if(type==='stage'&&d.map_data&&Array.isArray(d.map_data.units)){
for(const u of d.map_data.units.slice(0,18)){if(n>=maxU)break;add(u.portrait)}
}
if(type==='supporter'&&(d.active_skills||[]).length){
for(const sk of d.active_skills.slice(0,8)){if(n>=maxU)break;add(sk.icon)}
}
if(type==='option_part')add(d.thum);
}
async function fetchDetailPayload(type,id,opts){
const ck=detailPrefetchKey(type,id,opts||{});
if(_detailJsonPrefetchCache.has(ck))return _detailJsonPrefetchCache.get(ck);
const pending=_detailJsonPrefetchInflight.get(ck);
if(pending)return await pending;
const url=detailApiUrl(type,id,opts||{});
const p=(async()=>{
try{
const r=await fetch(url);
if(!r.ok)throw new Error(`HTTP ${r.status}`);
const d=await r.json();
if(d.error)throw new Error(d.error);
_detailJsonPrefetchCache.set(ck,d);
while(_detailJsonPrefetchCache.size>DETAIL_PREFETCH_CACHE_MAX){
const k=_detailJsonPrefetchCache.keys().next().value;
_detailJsonPrefetchCache.delete(k);
}
warmDetailImagesFromPayload(type,d);
return d;
}finally{
_detailJsonPrefetchInflight.delete(ck);
}
})();
_detailJsonPrefetchInflight.set(ck,p);
return await p;
}
function scheduleDetailPrefetchFromIntent(type,id){
if(type!=='character'&&type!=='unit'&&type!=='supporter'&&type!=='stage'&&type!=='option_part')return;
clearTimeout(_detailPrefetchHoverTimer);
_detailPrefetchHoverTimer=setTimeout(()=>{fetchDetailPayload(type,id,{}).catch(()=>{})},95);
}
function onDetailPrefetchIntentEvent(ev){
const el=ev.target&&ev.target.closest&&ev.target.closest('[data-detail-type][data-detail-id]');
if(!el)return;
const typ=el.getAttribute('data-detail-type');
const iid=el.getAttribute('data-detail-id');
if(!typ||!iid)return;
scheduleDetailPrefetchFromIntent(typ,iid);
}
function initDetailPrefetchIntentHandlers(){
if(_detailPrefetchIntentWired)return;
_detailPrefetchIntentWired=true;
document.body.addEventListener('mouseover',onDetailPrefetchIntentEvent,true);
document.body.addEventListener('touchstart',onDetailPrefetchIntentEvent,{passive:true,capture:true});
document.body.addEventListener('focusin',onDetailPrefetchIntentEvent,true);
}
function syncUnitListDetailHighlight(){const id=S.listSelectedUnitId;const sid=id==null||id===''?'':String(id);document.querySelectorAll('[data-detail-type="unit"][data-detail-id]').forEach(el=>{el.classList.toggle('list-detail-active',!!sid&&String(el.getAttribute('data-detail-id'))===sid)})}
function openUnitDetailFromTransform(uid){openDetail('unit',String(uid),{preserveUnitSpSsp:true})}
async function openDetail(type,id,opts){opts=opts||{};if(document.getElementById('searchSpotlightOverlay')&&document.getElementById('searchSpotlightOverlay').classList.contains('active'))closeSearchSpotlight();const m=document.getElementById('detailModal'),mc=document.getElementById('modalContent'),inn=document.getElementById('detailInner');const detailWasActive=m.classList.contains('active');mc.className='modal-content';mc.classList.add(type==='character'?'char-detail':(type==='unit'?'unit-detail':(type==='supporter'?'supporter-detail':(type==='option_part'?'option-part-detail':'stage-detail'))));m.classList.add('active');document.body.classList.add('detail-modal-open');if(!detailWasActive)applyBackgroundScrollLock();inn.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';try{if(type==='supporter'){S.currentSupporterLevel=100;S.currentSupporterLbTier=3}const d=await fetchDetailPayload(type,id,opts);if(type==='option_part'){S.conditionalPassiveActive=false;S.spActive=false;S.sspActive=false;S.charSuperchargedExTier=0;S.currentLbTier=3;S.currentWeaponLevels={};S.stageMapExpanded=false;S.currentDetailData=d;S.currentDetailType=type;inn.innerHTML=renderOptionPartShell(d);if(!opts.skipHistoryReplace){const _bp=browseShortPathForDetailType(type,id);if(_bp)syncHistoryToBrowsePath(_bp)}return}const _pu=type==='unit'&&!!opts.preserveUnitSpSsp;const _vr=!!opts.viewRanking;d.ranking_context=!!_vr;if(_vr){d.view_ranking=false}if(type==='character'||type==='unit')d.ranking_available=true;if(!_pu){S.conditionalPassiveActive=false;S.spActive=false;S.sspActive=false}S.charSuperchargedExTier=0;S.currentLbTier=3;S.currentWeaponLevels={};S.stageMapExpanded=false;S.detailRankingOverlay=false;if(type==='stage'){S.stageMapAutoFit=true;S.stageMapZoom=1}if(!_pu){if(type==='character'){S.spActive=!!S.listCharSp;S.conditionalPassiveActive=!!S.listCharCond}else if(type==='unit'){if(S.listUnitSsp){S.sspActive=true;S.spActive=false}else if(S.listUnitSp){S.spActive=true;S.sspActive=false}else{S.spActive=false;S.sspActive=false}S.conditionalPassiveActive=!!S.listUnitCond}}S.currentDetailData=d;S.currentDetailType=type;if(type==='unit'){S.listSelectedUnitId=String(opts.listUnitFocusId!=null?opts.listUnitFocusId:id);syncUnitListDetailHighlight()}if(type==='character')inn.innerHTML=renderCharShell(d);else if(type==='unit'){if(d.weapons)d.weapons.forEach(w=>S.currentWeaponLevels[w.id]=5);inn.innerHTML=renderUnitShell(d)}else if(type==='supporter')inn.innerHTML=renderSupporterShell(d);else inn.innerHTML=(d.content_locked?renderEternalStageLockedPanel(d):renderStageShell(d));if(d&&d.ranking_available&&(type==='character'||type==='unit'))ensureDetailRankingToggleDom(type);if(!(type==='stage'&&d.content_locked)){updateDetailDynamicSections(type);if(d&&d.ranking_available&&(type==='character'||type==='unit')){void ensureDetailRankingStats(type,id).then(()=>{if(S.currentDetailType===type&&S.currentDetailData&&String(S.currentDetailData.id)===String(id))updateDetailDynamicSections(type)}).catch(()=>{})}}if(!opts.skipHistoryReplace){const _bp=browseShortPathForDetailType(type,id);if(_bp)syncHistoryToBrowsePath(_bp)}}catch(e){console.error(e);inn.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Failed: ${esc(e.message)}</div></div>`}}
function closeModal(){if(/^\/(?:u|c|s|es|op)\/[^/]+\/?$/.test(location.pathname)){if(S.currentTab==='ranking')syncHistoryToBrowsePath('/rk');else syncHistoryToBrowsePath('/')}document.getElementById('detailModal').classList.remove('active');document.body.classList.remove('detail-modal-open');releaseBackgroundScrollLock();document.getElementById('modalContent').className='modal-content';S.currentDetailData=null;S.currentDetailType=null;S.conditionalPassiveActive=false;S.charSuperchargedExTier=0;S.spActive=false;S.sspActive=false;S.stageMapExpanded=false}
function closeModalOverlay(e){if(e.target===e.currentTarget)closeModal()}
function renderRecommendUnitCard(d){const ru=d.recommend_unit;if(!ru||!ru.id)return'';const row={rarity:ru.rarity,thum:ru.thum,role_icon:ru.role_icon,acquisition_icon:ru.acquisition_icon||''};const thumb=renderListThumb(row,'unit',96);const rk=d&&d.ranking_context?'1':'0';return`<div class="detail-rec-link-card" role="link" tabindex="0" data-detail-type="unit" data-detail-id="${escAttr(String(ru.id))}" onclick="openDetailFromRecommend('unit','${ru.id}',${rk})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailFromRecommend('unit','${ru.id}',${rk})}"><div class="detail-rec-link-label">${t('rec_unit_shortcut')}</div><div class="detail-rec-link-thumb-wrap">${thumb}</div><div class="detail-rec-link-name">${esc(ru.name)}</div></div>`}
function renderLimitedTimeBanner(d,kind){if(!d||!d.is_limited_time)return'';const cls=kind==='unit'?'detail-limited-banner--unit':'detail-limited-banner--character';const label=t('limited_label');return`<div class="detail-limited-banner-wrap"><div class="detail-limited-banner ${cls}" role="img" aria-label="${esc(label)}"><span class="detail-limited-banner-inner">${esc(label)}</span></div></div>`}
function renderDetailRankingToggle(d,type){if(!(d&&d.ranking_available&&(type==='character'||type==='unit')))return'';const on=!!S.detailRankingOverlay;const ttl=on?'Hide ranking':'Show ranking';return`<button type="button" class="detail-rank-toggle-btn${on?' active':''}" title="${escAttr(ttl)}" aria-label="${escAttr(ttl)}" onclick="toggleDetailRankingOverlay()"><img class="detail-rank-toggle-icon" src="${imgUrl('/static/images/UI/UI_Home_Campaign_Image_01.webp')}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'"></button>`}
function toggleDetailRankingOverlay(){if(!S.currentDetailData||!(S.currentDetailType==='character'||S.currentDetailType==='unit')||!S.currentDetailData.ranking_available)return;S.detailRankingOverlay=!S.detailRankingOverlay;const b=document.querySelector('.detail-rank-toggle-btn');if(b)b.classList.toggle('active',!!S.detailRankingOverlay);updateDetailDynamicSections(S.currentDetailType)}
function charRoleIsDefense(role){const r=String(role||'').toLowerCase();return r==='defense'||r.includes('defense')}
function charRoleIsSupport(role){const r=String(role||'').toLowerCase();return r==='support'||r.includes('support')}
function _countCharActionPlusOne(txt,kind){const s=String(txt||'');const pick=(arr)=>arr.reduce((n,re)=>{const m=s.match(re);return n+(m?m.length:0)},0);if(kind==='chance')return pick([/chance\s*step[\s\S]{0,24}[+＋]\s*1(?!\d)/ig,/チャンスステップ[\s\S]{0,24}[+＋]\s*1(?!\d)/g,/額外行動[\s\S]{0,24}[+＋]\s*1(?!\d)/g]);if(kind==='def')return pick([/support\s*defen[cs]e[\s\S]{0,24}[+＋]\s*1(?!\d)/ig,/支援防[禦御][\s\S]{0,24}[+＋]\s*1(?!\d)/g]);return pick([/support\s*attack\s*\/\s*counter[\s\S]{0,24}[+＋]\s*1(?!\d)/ig,/支援攻擊\s*[／/]\s*反擊[\s\S]{0,24}[+＋]\s*1(?!\d)/g,/支援攻撃\s*[／/]\s*反撃[\s\S]{0,24}[+＋]\s*1(?!\d)/g])}
function _charAbilityRowsForCurrentState(d){let rows=(d&&Array.isArray(d.abilities)?d.abilities:[]).slice();if(!S.spActive)rows=rows.filter(ba=>!(ba&&ba.sp_replacement&&isUnknownAbilityName(ba.name)));return rows}
function _charAbilityTextBlocks(d){const rows=_charAbilityRowsForCurrentState(d);const out=[];const push=(txt,isCond)=>{const t=String(txt||'').trim();if(!t)return;out.push({text:t,conditional:!!isCond})};rows.forEach(ba=>{let ab=ba;if(S.spActive&&ba&&ba.sp_replacement)ab=ba.sp_replacement;const ds=Array.isArray(ab&&ab.details)?ab.details:[];ds.forEach(detail=>{if(typeof detail==='string'){push(detail,false);return}if(!detail||typeof detail!=='object'){push(String(detail||''),false);return}const raw0=String(detail.text||'').trim();const raw=normalizeAbilityDetailTextForSplit(raw0);if(!raw)return;let groups=splitAbilityTextIntoBlocks(raw);const validCg=abilityValidConditionGroupsSorted(detail);const hasCond=validCg.length>0||((Array.isArray(detail.conditions)&&detail.conditions.length>0));if(validCg.length>=2&&groups.length===1){const g0=groups[0]||'';const sub=g0.split(/\.\s+(?=When\s+Vigor\b|\b(?:Increase|Increases)\b)/i).map(x=>x.trim()).filter(x=>x.length);if(sub.length>=2&&sub.length===validCg.length)groups=sub}const useParallel=validCg.length>=2&&validCg.length===groups.length;if(useParallel){groups.forEach(g=>push(g,true));return}const condIdx=blockIndexForConditions(groups,hasCond);groups.forEach((g,i)=>push(g,hasCond&&i===condIdx))})});return out}
function getCharacterChanceSupportState(d){const blocks=_charAbilityTextBlocks(d);let chanceUn=0,chanceCond=0,defUn=0,defCond=0,atkUn=0,atkCond=0;blocks.forEach(b=>{const tx=String(b&&b.text||'');const c=_countCharActionPlusOne(tx,'chance'),df=_countCharActionPlusOne(tx,'def'),ak=_countCharActionPlusOne(tx,'atk');if(b.conditional){chanceCond+=c;defCond+=df;atkCond+=ak}else{chanceUn+=c;defUn+=df;atkUn+=ak}});const condOn=!!S.conditionalPassiveActive;const chanceBonus=chanceUn+(condOn?chanceCond:0);const defBonus=defUn+(condOn?defCond:0);const atkBonus=atkUn+(condOn?atkCond:0);const hasBaseDef=charRoleIsDefense(d&&d.role);const hasBaseAtk=charRoleIsSupport(d&&d.role);const chanceCount=Math.max(1,Math.min(2,1+(chanceBonus>0?1:0)));const supportDefCount=Math.max(0,Math.min(2,Math.max(hasBaseDef?1:0,defBonus)));const supportAtkCount=Math.max(0,Math.min(2,Math.max(hasBaseAtk?1:0,atkBonus)));return{chanceCount,supportDefCount,supportAtkCount}}
function characterHasConditionalChanceOrSupportAbility(d){const blocks=_charAbilityTextBlocks(d);return blocks.some(b=>b&&b.conditional&&(_countCharActionPlusOne(b.text,'chance')>0||_countCharActionPlusOne(b.text,'def')>0||_countCharActionPlusOne(b.text,'atk')>0))}
function renderDetailIconCountRow(label,iconPath,count){const c=Math.max(0,Number(count)||0);const src=imgUrlPreferCdn('/static/images/UI/'+iconPath+'.webp');const icons=Array.from({length:c}).map(()=>`<img class="char-extra-info-icon" src="${src}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`).join('');return`<div class="char-extra-info-row"><div class="char-extra-info-label">${esc(label)}</div><div class="char-extra-info-icons">${icons||'<span class="char-extra-info-none">-</span>'}</div></div>`}
function charExtraInfoLabel(k){const l=String(S.lang||'EN');if(l==='TW'||l==='HK'){if(k==='chance')return'額外行動';if(k==='def')return'支援防禦';if(k==='atk')return'支援攻擊'}if(l==='JA'||l==='JP'){if(k==='chance')return'チャンスステップ';if(k==='def')return'支援防禦';if(k==='atk')return'支援攻擊'}if(k==='chance')return'Chance Step';if(k==='def')return'Support Defense';return'Support Attack'}
function renderCharacterExtraInfo(d){if(!d)return'';const s=getCharacterChanceSupportState(d);return`<div class="char-extra-info-wrap">${renderDetailIconCountRow(charExtraInfoLabel('chance'),'UI_Common_Icon_ChanceStep',s.chanceCount)}${renderDetailIconCountRow(charExtraInfoLabel('def'),'UI_Common_BattleIcon_AssistDeffence_S',s.supportDefCount)}${renderDetailIconCountRow(charExtraInfoLabel('atk'),'UI_Common_BattleIcon_AssistAtack_S',s.supportAtkCount)}</div>`}
function renderCharShell(d){return`<div class="modal-top-label">${t('char_data')}</div><div class="modal-entity-id">ID: ${d.id}</div><div class="detail-header char-detail-header"><div class="detail-portrait-stack"><div class="detail-portrait-wrap">${d.portrait?imgTag(d.portrait,{cls:'detail-portrait',alt:esc(d.name),webp:true,onerror:"this.outerHTML='<div class=\\'detail-portrait-placeholder\\'>👤</div>'"}) :'<div class="detail-portrait-placeholder">👤</div>'}</div><div class="detail-rec-shortcut-wrap detail-rec-shortcut--mobile">${renderRecommendUnitCard(d)}</div></div><div class="detail-title-area char-detail-title-area"><div class="char-detail-head-row"><div class="char-detail-head-main"><div class="detail-name">${esc(d.name)}</div><div class="detail-meta">${d.rarity_icon?`<img class="detail-rarity-icon" src="${imgUrl(d.rarity_icon)}" alt="${d.rarity}" loading="lazy">`:`<span class="rarity-badge rarity-${d.rarity}">${d.rarity}</span>`}<span class="detail-role-label">${d.role_icon?`<img src="${imgUrl(d.role_icon)}" alt="${d.role}" loading="lazy">`:''}${esc(tRole(d.role))}${d.acquisition_icon?`<img class="detail-meta-icon" src="${imgUrl(d.acquisition_icon)}" alt="" loading="lazy">`:''}</span>${d.has_sp?`<div style="display:flex;gap:6px;align-items:center;margin-left:8px;"><button id="spToggleBtnChar" class="sp-toggle-btn${S.spActive?' active':''}" onclick="toggleStatState('sp')"><img src="${imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp')}" alt="SP" loading="lazy"></button></div>`:''}</div><div id="charExtraInfo"></div>${renderLimitedTimeBanner(d,'character')}</div><div class="detail-rec-shortcut-wrap detail-rec-shortcut--desktop">${renderRecommendUnitCard(d)}</div></div>${renderSeries(d.series,'characters')}${renderTags(d.tags)}<div class="header-stats-wrapper"><div id="detailStatsWrapper"></div></div></div></div><div class="detail-body"><div id="detailAbilitiesContainer"></div><div id="detailSkillsContainer"></div></div>`}
function renderRecommendCharCard(d){const rc=d.recommend_character;if(!rc||!rc.id)return'';const row={rarity:rc.rarity,thum:rc.thum,role_icon:rc.role_icon,acquisition_icon:''};const thumb=renderListThumb(row,'char',96);const lim=rc.is_limited_time?`<div class="detail-rec-limited-wrap">${renderLimitedTimeBanner(rc,'character')}</div>`:'';const rk=d&&d.ranking_context?'1':'0';return`<div class="detail-rec-link-card" role="link" tabindex="0" data-detail-type="character" data-detail-id="${escAttr(String(rc.id))}" onclick="openDetailFromRecommend('character','${rc.id}',${rk})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailFromRecommend('character','${rc.id}',${rk})}"><div class="detail-rec-link-label">${t('rec_char_shortcut')}</div><div class="detail-rec-link-thumb-wrap">${thumb}</div>${lim}<div class="detail-rec-link-name">${esc(rc.name)}</div></div>`}
function renderUnitShell(d){let lb='';if(!d.is_ultimate){lb=`<div class="lb-control-row"><div class="lb-btn-group"><button class="lb-icon-btn" data-val="0" onclick="updateLbTier('0')"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"></button><button class="lb-icon-btn" data-val="1" onclick="updateLbTier('1')"><img src="${imgUrl(LB_ICONS['Neutral'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"></button><button class="lb-icon-btn" data-val="2" onclick="updateLbTier('2')"><img src="${imgUrl(LB_ICONS['Neutral'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['Neutral'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"></button><button class="lb-icon-btn active" data-val="3" onclick="updateLbTier('3')"><img src="${imgUrl(LB_ICONS['Max'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['Max'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['Max'])}" loading="lazy"></button></div></div>`}const ter=S.sspActive&&(d.terrain_ssp&&d.terrain_ssp.length)?d.terrain_ssp:d.terrain;const hasTerrainEnh=!!(S.sspActive&&(d.has_terrain_enhancement===true||(d.terrain_ssp&&d.terrain&&d.terrain_ssp.some((ts,i)=>ts.level!==(d.terrain[i]?.level??-1)))));return`<div class="modal-top-label">${t('unit_data')}</div><div class="modal-entity-id">ID: ${d.id}</div><div class="detail-header unit-detail-header"><div class="detail-portrait-stack"><div class="detail-portrait-wrap">${d.portrait?imgTag(d.portrait,{cls:'detail-portrait',alt:esc(d.name),webp:true,onerror:"this.parentElement.outerHTML='<div class=\\'detail-portrait-placeholder\\'>🤖</div>'"}) :'<div class="detail-portrait-placeholder">🤖</div>'}</div><div class="detail-rec-shortcut-wrap detail-rec-shortcut--mobile">${renderRecommendCharCard(d)}</div></div><div class="detail-title-area unit-detail-title-area"><div class="unit-detail-head-row"><div class="unit-detail-head-main"><div class="detail-name">${esc(d.name)}</div><div class="detail-meta">${d.rarity_icon?`<img class="detail-rarity-icon" src="${imgUrl(d.rarity_icon)}" alt="${d.rarity}" loading="lazy">`:`<span class="rarity-badge rarity-${d.rarity}">${d.rarity}</span>`}<span class="detail-role-label">${d.role_icon?`<img src="${imgUrl(d.role_icon)}" alt="${d.role}" loading="lazy">`:''}${esc(tRole(d.role))}${d.acquisition_icon?`<img class="detail-meta-icon" src="${imgUrl(d.acquisition_icon)}" alt="" loading="lazy">`:''}</span>${(d.has_sp||d.transform_partner_id)?`<div style="display:flex;gap:6px;align-items:center;">${d.has_sp?`<button id="spToggleBtn" class="sp-toggle-btn${S.spActive&&!S.sspActive?' active':''}" onclick="toggleStatState('sp')"><img src="${imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp')}" alt="SP" loading="lazy"></button><button id="sspToggleBtn" class="sp-toggle-btn${S.sspActive?' active':''}" onclick="toggleStatState('ssp')"><img src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP" loading="lazy"></button>`:''}${d.transform_partner_id?`<button type="button" id="unitTransformToggleBtn" class="sp-toggle-btn${d.is_transform_alternate?' active':''}" title="${esc(t('unit_transform_title'))}" onclick="openUnitDetailFromTransform('${d.transform_partner_id}')"><img src="${imgUrl('/static/images/UI/UI_Common_BattleIcon_Transform.webp')}" alt="" loading="lazy" onerror="this.style.display='none'"></button>`:''}</div>`:''}${(d.special_icons||[]).filter(ic=>ic!==d.acquisition_icon).map(ic=>`<img class="detail-special-icon" src="${imgUrl(ic)}" alt="" loading="lazy" onerror="this.style.display='none'">`).join('')}</div>${renderLimitedTimeBanner(d,'unit')}</div><div class="detail-rec-shortcut-wrap detail-rec-shortcut--desktop">${renderRecommendCharCard(d)}</div></div>${d.model?`<div class="detail-model">${esc(d.model)}</div>`:''}${renderSeries(d.series,'units')}<div id="detailUnitTerrainRow">${renderHeaderTerrain(ter,S.sspActive,hasTerrainEnh)}</div>${renderTags(d.tags)}<div class="header-stats-wrapper">${lb}<div id="detailStatsWrapper"></div></div></div></div><div class="detail-body"><div id="detailAbilitiesContainer"></div><div id="detailUnitSkillsContainer"></div><div id="detailWeaponsContainer"></div><div id="detailMechanismsContainer"></div></div>`}
function renderSupporterShell(d){const lv=d.level||100;const lb=Number(d.lb_tier)===d.lb_tier?d.lb_tier:parseInt(d.lb_tier,10);const lbVal=Math.min(3,Math.max(0,isNaN(lb)?3:lb));const lbBtns=`<div class="lb-btn-group supporter-lb-group"><button class="lb-icon-btn${lbVal===0?' active':''}" data-val="0" onclick="updateSupporterLbTier(0)"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"></button><button class="lb-icon-btn${lbVal===1?' active':''}" data-val="1" onclick="updateSupporterLbTier(1)"><img src="${imgUrl(LB_ICONS['Neutral'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"></button><button class="lb-icon-btn${lbVal===2?' active':''}" data-val="2" onclick="updateSupporterLbTier(2)"><img src="${imgUrl(LB_ICONS['Neutral'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['Neutral'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['None'])}" loading="lazy"></button><button class="lb-icon-btn${lbVal===3?' active':''}" data-val="3" onclick="updateSupporterLbTier(3)"><img src="${imgUrl(LB_ICONS['Max'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['Max'])}" loading="lazy"><img src="${imgUrl(LB_ICONS['Max'])}" loading="lazy"></button></div>`;const lvCtrl=`<div class="supporter-control-row"><div class="supporter-control-group"><label class="supporter-control-label">${t('supp_level')}</label><div class="supporter-level-control"><input type="range" id="suppLevelSlider" min="1" max="100" value="${lv}" oninput="updateSupporterLevel(parseInt(this.value,10))" onchange="clearTimeout(S._supporterLevelDebounce);refreshSupporterDetail()"><span id="suppLevelVal">${lv}</span></div></div></div>`;return`<div class="modal-top-label">${t('supp_data')}</div><div class="modal-entity-id">ID: ${d.id}</div><div class="detail-header supporter-detail-header"><div class="supporter-portrait-wrap">${d.portrait?imgTag(d.portrait,{cls:'supporter-portrait',alt:esc(d.name),webp:true,onerror:"this.parentElement.outerHTML='<div class=\\'detail-portrait-placeholder supporter-portrait-placeholder\\'>🎧</div>'"}) :`<div class="detail-portrait-placeholder supporter-portrait-placeholder">🎧</div>`}</div><div class="detail-title-area supporter-title-area"><div class="detail-name">${esc(d.name)}</div><div class="detail-meta supporter-meta-row" style="align-items:center;margin-bottom:0;gap:12px;">${d.rarity_icon?`<img class="detail-rarity-icon" style="height:40px;" src="${imgUrl(d.rarity_icon)}" alt="${d.rarity}" loading="lazy">`:`<span class="rarity-badge rarity-${d.rarity}">${d.rarity}</span>`}${lbBtns}</div>${renderLimitedTimeBanner(d,'character')}${lvCtrl}<div style="display:flex;gap:8px;flex-wrap:wrap;"><span class="support-stat-badge support-hp">${t('hp_support')} +${fmtN(d.hp_support)}</span><span class="support-stat-badge support-atk">${t('atk_support')} +${fmtN(d.atk_support)}</span></div></div></div><div class="detail-body"><div id="detailLeaderSkillContainer"></div><div id="detailAbilitiesContainer"></div></div>`}
function invalidateEternalStageDetailCaches(stageId){const suf=':stage:'+String(stageId);for(const k of[..._detailJsonPrefetchCache.keys()]){if(k.endsWith(suf))_detailJsonPrefetchCache.delete(k)}}
function renderEternalStageLockedPanel(d){const needPw=d.password_required===true;const hint=needPw?t('er_stage_lock_hint'):t('er_stage_lock_wait');const form=needPw?`<div class="er-stage-lock-box" style="margin-top:0;border:none;background:transparent;padding:0"><p class="er-stage-lock-hint">${esc(hint)}</p><input type="password" id="erStageLockInput" autocomplete="current-password" maxlength="200" onkeydown="if(event.key==='Enter')submitEternalStageUnlock()" style="width:100%;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);font-size:16px;box-sizing:border-box"><div style="margin-top:12px"><button type="button" class="lr-unlock-btn" onclick="submitEternalStageUnlock()">${esc(t('er_stage_unlock_btn'))}</button></div><div class="lr-lock-err" id="erStageLockErr"></div></div>`:`<div class="er-stage-lock-box" style="margin-top:0;border:none;background:transparent;padding:0"><p class="er-stage-lock-hint">${esc(hint)}</p></div>`;return`<div class="modal-top-label">${esc(t('er_stage_redacted_title'))}</div><div class="detail-body" style="margin-top:8px"><div class="er-stage-blackout"><div class="er-stage-blackout-inner"><div class="er-stage-blackout-icon" aria-hidden="true">🔒</div><div class="er-stage-blackout-title">${esc(t('er_stage_redacted_title'))}</div>${form}</div></div></div>`}
async function submitEternalStageUnlock(){const id=S.currentDetailData&&S.currentDetailData.id;const err=document.getElementById('erStageLockErr');if(id==null||id==='')return;const inp=document.getElementById('erStageLockInput');const pw=inp?String(inp.value||''):'';if(err)err.textContent='';try{const r=await fetch('/api/eternal_stages/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(!r.ok){if(err)err.textContent=t('er_stage_pw_wrong');return}invalidateEternalStageDetailCaches(id);_dcStagesCache=null;_dcStagesFetchLang=null;const inn=document.getElementById('detailInner');const d=await fetchDetailPayload('stage',String(id));if(d.content_locked){if(err)err.textContent=d.password_required?t('er_stage_pw_wrong'):t('er_stage_lock_wait');if(inn)inn.innerHTML=renderEternalStageLockedPanel(d);return}S.currentDetailData=d;if(inn)inn.innerHTML=renderStageShell(d);updateDetailDynamicSections('stage');if(S.currentTab==='stages')loadStages(S.stages.page||1);const stgSel=document.getElementById('dcStageSelect');if(stgSel&&String(stgSel.value)===String(id))await onDcStageChange()}catch(e){if(err)err.textContent=String(e)}}
function renderStageShell(d){const isSs=d.stage_category==='special_stage';const nameLine=isSs?`<div class="detail-name">${esc(d.name)}</div>`:`<div class="detail-name"><b>${esc(t('col_stage_no'))} ${fmtN(d.stage_number)}</b> ${esc(d.name)}</div>`;return`<div class="modal-top-label">${t('stage_data')}</div><div class="modal-entity-id">ID: ${d.id}</div><div class="detail-header"><div class="detail-portrait-wrap" style="width:240px">${d.portrait?imgTag(d.portrait,{cls:'stage-portrait',alt:esc(d.name),webp:true,onerror:"this.outerHTML='<div class=\\'detail-portrait-placeholder\\' style=\\'width:240px;height:240px;font-size:70px\\'>🗺️</div>'"}) :`<div class="detail-portrait-placeholder" style="width:240px;height:240px;font-size:70px">🗺️</div>`}</div><div class="detail-title-area">${nameLine}<div class="detail-meta"><span class="stage-diff-badge stage-diff-${esc(d.difficulty_code||'unknown')}">${esc(d.difficulty_name||'-')}</span><span class="stage-meta-badge">${t('recommended_cp')}: ${fmtN(d.recommended_cp)}</span><span class="stage-meta-badge">${t('terrain')}: ${esc(d.terrain)}</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px"><div class="stage-condition-box"><div class="stage-condition-title victory">${t('victory_conditions')}</div>${(d.victory_conditions&&d.victory_conditions.length)?d.victory_conditions.map(x=>`<div class="stage-condition-item">${esc(x)}</div>`).join(''):`<div class="stage-condition-item">${t('none')}</div>`}</div><div class="stage-condition-box"><div class="stage-condition-title defeat">${t('defeat_conditions')}</div>${(d.defeat_conditions&&d.defeat_conditions.length)?d.defeat_conditions.map(x=>`<div class="stage-condition-item">${esc(x)}</div>`).join(''):`<div class="stage-condition-item">${t('none')}</div>`}</div></div></div></div><div class="detail-body"><div id="detailStageRestrictionsContainer"></div><div id="detailStageMapContainer"></div><div id="detailNpcContainer"></div></div>`}
function renderOptionPartShell(d){
const thumb=d.thum?imgTag(d.thum,{cls:'detail-portrait mod-detail-portrait',webp:true,alt:esc(d.name||''),onerror:"this.outerHTML='<div class=\\'detail-portrait-placeholder\\'>⚙</div>'"}) :'<div class="detail-portrait-placeholder">⚙</div>';
const tagBlock=renderModLineageTagCell(d.tags);
const rar=d.rarity||'N';
const rarIcon=d.rarity_icon?`<img class="detail-rarity-icon" src="${imgUrl(d.rarity_icon)}" alt="${esc(rar)}" loading="lazy">`:`<span class="rarity-badge rarity-${esc(rar)}">${esc(rar)}</span>`;
const condTagBlock=(d.condition_tags&&d.condition_tags.length)?`<div style="margin-top:10px">${renderModLineageTagCell(d.condition_tags)}</div>`:'';
const acqLabel=esc(d.acquisition_method_label||'Acquisition method');
const acqRows=(Array.isArray(d.acquisition_methods)?d.acquisition_methods:[]).filter(x=>String(x||'').trim().length>0);
const acqHtml=acqRows.length?acqRows.map(x=>`<div class="ability-detail mod-details-cell mod-details-cell--detail" style="margin:0">${esc(String(x))}</div>`).join('<div style="height:8px"></div>'):`<div class="ability-detail mod-details-cell mod-details-cell--detail" style="margin:0">-</div>`;
return`<div class="modal-top-label">${esc(t('tab_mod'))}</div><div class="modal-entity-id">ID: ${esc(String(d.id))}</div><div class="detail-header option-part-detail-header"><div class="detail-portrait-wrap">${thumb}</div><div class="detail-title-area"><div class="detail-name">${esc(d.name||'')}</div><div class="detail-meta">${rarIcon}</div><div style="margin-top:10px">${tagBlock}</div></div></div><div class="detail-body"><div class="detail-section"><div class="section-title">${esc(t('col_details'))}</div><div class="ability-item"><div class="ability-info"><div class="ability-detail mod-details-cell mod-details-cell--detail" style="margin:0">${esc(d.details||'')}</div>${condTagBlock}</div></div></div><div class="detail-section"><div class="section-title">${acqLabel}</div><div class="ability-item"><div class="ability-info">${acqHtml}</div></div></div></div>`;
}
function ensureDetailRankingToggleDom(type){
const d=S.currentDetailData;
const wrap=document.getElementById('detailStatsWrapper');
if(!wrap)return;
const host=wrap.parentElement;
if(!host)return;
const exists=host.querySelector('.detail-rank-toggle-btn');
if(!(d&&d.ranking_available&&(type==='character'||type==='unit'))){
if(exists)exists.remove();
return
}
const html=renderDetailRankingToggle(d,type);
if(exists){exists.outerHTML=html;return}
host.insertAdjacentHTML('afterbegin',html);
}
function detailStatRowsForCurrentState(d,type){let hcf=type==='character'?(d.has_conditional_passive!=null?d.has_conditional_passive:d.has_ex_stats):d.has_cond_stats;const cp=hcf&&S.conditionalPassiveActive;let sr;if(type==='unit'){const td=(d.lb_data&&d.lb_data[S.currentLbTier])||(d.stats&&{stats_no_cond:d.stats,stats_with_cond:d.stats,sp_stats_no_cond:d.stats,sp_stats_with_cond:d.stats,ssp_stats_no_cond:d.stats,ssp_stats_with_cond:d.stats});if(!td)return[];if(d.has_sp){if(S.sspActive)sr=cp?td.ssp_stats_with_cond:td.ssp_stats_no_cond;else if(S.spActive)sr=cp?td.sp_stats_with_cond:td.sp_stats_no_cond;else sr=cp?td.stats_with_cond:td.stats_no_cond}else sr=cp?td.stats_with_cond:td.stats_no_cond}else{const exTiers=d.ex_supercharged_tiers;if(cp&&exTiers&&exTiers.length>1){const ti=Math.min(Math.max(0,S.charSuperchargedExTier|0),exTiers.length-1);sr=exTiers[ti].stats}else if(d.has_sp){if(S.spActive)sr=cp?d.sp_stats_with_ex:d.sp_stats;else sr=cp?d.stats_with_ex:d.stats}else sr=cp?d.stats_with_ex:d.stats}return Array.isArray(sr)?sr:[]}
function renderDetailInlineRankRadial(meta){
if(!meta||!meta.rank||!meta.total)return`<div class="stat-inline-rank is-loading"><div class="radial-loading">...</div></div>`;
const rk=Math.max(1,Number(meta.rank)||1);
const tt=Math.max(1,Number(meta.total)||1);
const pct=Math.max(1,Math.min(100,Math.round((rk/tt)*100)));
const progressPercent=Math.max(5,95-((rk-1)/tt)*90);
const fillRatio=Math.max(.05,Math.min(.95,progressPercent/100));
const r=25;
const c=(Math.PI*2*r);
const off=(c*(1-fillRatio));
let rankText='',totalLine='';
if(S.lang==='EN')rankText=`${rk}`;
else rankText=`${fmtN(rk)}`;
totalLine=`/ ${fmtN(tt)}`;
let tone='#94a3b8';
let pctText=`TOP ${pct}%`;
let pulseFillCls='',pulseTextCls='';
let leakCls='';
if(rk===1){tone='#fbbf24';pctText='Top 1';leakCls='leak-shadow-strong'}
else if(rk<=3){tone='#22d3ee';pctText=`Top ${rk}`;leakCls='leak-shadow'}
else if(rk<=10){tone='#22d3ee';pctText=`Top ${rk}`;leakCls='leak-shadow-soft'}
else if(rk<=20){tone='#22d3ee';pctText=`Top ${rk}`}
else if(rk<=tt*0.05){tone='#34d399'}
else if(rk<=tt*0.25){tone='#60a5fa'}
else if(rk>tt*0.90){tone='#f87171';pctText=`BOTTOM ${Math.max(0,100-pct)}%`}
else{tone='#a5b4fc'}
return`<div class="stat-inline-rank ${leakCls}" style="--sir-c:${c.toFixed(2)};--sir-o:${off.toFixed(2)};--rank-tone:${tone}">
<svg class="radial-svg" viewBox="0 0 74 74" aria-hidden="true">
<circle class="progress-circle" cx="37" cy="37" r="${r}"></circle>
<circle class="progress-fill ${pulseFillCls}" cx="37" cy="37" r="${r}"></circle>
</svg>
<div class="inner-circle">
<div class="rank-wrap">
<div class="rank-label">RANK</div>
<div class="rank-text ${pulseTextCls}">${rankText}</div>
<div class="total">${totalLine}</div>
<div class="percentile ${pulseTextCls}">${pctText}</div>
</div>
</div>
</div>`;
}
function kickDetailRankRadialAnimation(root){
if(!root||!root.classList||root.classList.contains('is-loading'))return;
const f=root.querySelector('.progress-fill');
if(!f)return;
f.style.strokeDashoffset='var(--sir-c)';
setTimeout(()=>{if(root.isConnected)f.style.strokeDashoffset='var(--sir-o)'},100);
}
function applyDetailRankingInline(type){
const d=S.currentDetailData;
if(!d||!d.ranking_available||!S.detailRankingOverlay||(type!=='character'&&type!=='unit'))return;
const rows=detailStatRowsForCurrentState(d,type);
const cards=Array.from(document.querySelectorAll('#detailStatsWrapper .stat-card'));
if(!cards.length)return;
const ck=detailRankingCacheKey(type,d.id);
if(!_detailRankingStatsCache.has(ck)&&!_detailRankingStatsInflight.has(ck))void ensureDetailRankingStats(type,d.id).then(()=>{if(S.currentDetailType===type&&S.currentDetailData&&String(S.currentDetailData.id)===String(d.id))updateDetailDynamicSections(type)}).catch(()=>{});
cards.forEach((c,i)=>{
const s=rows[i];
if(!s)return;
const old=c.querySelector('.stat-inline-rank');
if(old)old.remove();
if(type==='unit'&&s.name==='Move')return;
const meta=detailRankingMetaFor(type,d.id,s.name);
c.insertAdjacentHTML('beforeend',renderDetailInlineRankRadial(meta));
kickDetailRankRadialAnimation(c.querySelector('.stat-inline-rank'));
});
}
function updateDetailDynamicSections(type){const d=S.currentDetailData;if(type!=='supporter'&&type!=='stage'){document.getElementById('detailStatsWrapper').innerHTML=renderStatsWrapper(d,type);ensureDetailRankingToggleDom(type);applyDetailRankingInline(type)}if(type==='character'){const extra=document.getElementById('charExtraInfo');if(extra)extra.innerHTML=renderCharacterExtraInfo(d);document.getElementById('detailAbilitiesContainer').innerHTML=renderAbilsDynamic(d.abilities,t('sec_abilities'),false,S.spActive);document.getElementById('detailSkillsContainer').innerHTML=renderSkills(d.skills,S.spActive)}else if(type==='unit'){document.getElementById('detailAbilitiesContainer').innerHTML=renderAbilsDynamic(d.abilities,t('sec_abilities'),S.sspActive,false);document.getElementById('detailUnitSkillsContainer').innerHTML=renderSkills(d.skills||[],false);document.getElementById('detailWeaponsContainer').innerHTML=renderWeaponsDynamic(d.weapons,S.sspActive,d);document.getElementById('detailMechanismsContainer').innerHTML=renderMechanisms(d.mechanisms);const tr=document.getElementById('detailUnitTerrainRow');if(tr){const base=d.terrain||[];const ter=S.sspActive&&(d.terrain_ssp&&d.terrain_ssp.length)?d.terrain_ssp:base;const hasTerrainEnh=!!(S.sspActive&&(d.has_terrain_enhancement===true||(d.terrain_ssp&&d.terrain&&d.terrain_ssp.some((ts,i)=>ts.level!==(d.terrain[i]?.level??-1)))));tr.innerHTML=renderHeaderTerrain(ter,S.sspActive,hasTerrainEnh)}}else if(type==='supporter'){let lh='';if(d.leader_skills&&d.leader_skills.length){lh=`<div class="detail-section"><div class="section-title">${t('sec_leader_skill')}</div><div class="ability-list">${d.leader_skills.map(ls=>{let ts2=ls.tags.map(t=>t.name).join(',');return`<div class="ability-item" style="flex-direction:column;gap:10px;cursor:pointer;" onclick="openTagModal('${esc(ts2)}','${ls.separator}')"><div class="ability-detail" style="margin:0;">${esc(ls.desc)}</div>${ls.tags&&ls.tags.length?`<div class="detail-tags-row" style="margin-top:0;align-items:center;">${renderSkillTags([{tags:ls.tags,separator:ls.separator}])}</div>`:''}</div>`}).join('')}</div></div>`}document.getElementById('detailLeaderSkillContainer').innerHTML=lh;let ah='';if(d.active_skills&&d.active_skills.length){ah=`<div class="detail-section"><div class="section-title">${t('sec_active_skills')}</div><div class="ability-list">${d.active_skills.map(sk=>`<div class="ability-item"><div class="ability-icon-wrap">${renderAbilIcon({icon:sk.icon})}</div><div class="ability-info"><div class="ability-name">${esc(sk.name)}</div><div class="ability-detail" style="margin:0;white-space:pre-wrap;">${esc(sk.desc)}</div></div></div>`).join('')}</div></div>`}document.getElementById('detailAbilitiesContainer').innerHTML=ah}else if(type==='stage'){document.getElementById('detailStageRestrictionsContainer').innerHTML=renderStageRestrictions(d);document.getElementById('detailStageMapContainer').innerHTML=renderStageMapSection(d);document.getElementById('detailNpcContainer').innerHTML=renderNpcDetails(d.npc_details||[],d.id)}}
function renderStatsWrapper(d,type){
let hcf=type==='character'?(d.has_conditional_passive!=null?d.has_conditional_passive:d.has_ex_stats):d.has_cond_stats;
if(type==='character'&&characterHasConditionalChanceOrSupportAbility(d))hcf=true;
const cp=hcf&&S.conditionalPassiveActive;
let sr,bs;
if(type==='unit'){
const td=(d.lb_data&&d.lb_data[S.currentLbTier])||(d.stats&&{stats_no_cond:d.stats,stats_with_cond:d.stats,sp_stats_no_cond:d.stats,sp_stats_with_cond:d.stats,ssp_stats_no_cond:d.stats,ssp_stats_with_cond:d.stats});
if(!td)return'';
if(d.has_sp){
if(S.sspActive){sr=cp?td.ssp_stats_with_cond:td.ssp_stats_no_cond;bs=td.ssp_stats_no_cond}
else if(S.spActive){sr=cp?td.sp_stats_with_cond:td.sp_stats_no_cond;bs=td.sp_stats_no_cond}
else{sr=cp?td.stats_with_cond:td.stats_no_cond;bs=td.stats_no_cond}
}else{sr=cp?td.stats_with_cond:td.stats_no_cond;bs=td.stats_no_cond}
}else{
const exTiers=d.ex_supercharged_tiers;
if(cp&&exTiers&&exTiers.length>1){const ti=Math.min(Math.max(0,S.charSuperchargedExTier|0),exTiers.length-1);sr=exTiers[ti].stats;bs=d.stats}
else if(d.has_sp){
if(S.spActive){sr=(cp&&d.sp_stats_with_ex)?d.sp_stats_with_ex:d.sp_stats;bs=d.sp_stats}
else{sr=(cp&&d.stats_with_ex)?d.stats_with_ex:d.stats;bs=d.stats}
}else{sr=(cp&&d.stats_with_ex)?d.stats_with_ex:d.stats;bs=d.stats}
}
let th='';
if(hcf){const cplab=t('conditional_passive');th=`<div class="conditional-toggle" style="justify-content:flex-end;margin-bottom:8px;"><div class="toggle-clickable ${S.conditionalPassiveActive?'active':''}" role="button" tabindex="0" onclick="toggleConditionalPassive(!S.conditionalPassiveActive)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleConditionalPassive(!S.conditionalPassiveActive)}"><span class="toggle-switch"></span><span class="toggle-label">${esc(cplab)}</span></div></div>`}
let exRow='';
if(type==='character'&&cp&&d.ex_supercharged_tiers&&d.ex_supercharged_tiers.length>1){const ti=Math.min(Math.max(0,S.charSuperchargedExTier|0),d.ex_supercharged_tiers.length-1);exRow=`<div class="detail-ex-tier-row" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin:0 0 8px 0">`+d.ex_supercharged_tiers.map((t,idx)=>`<button type="button" class="dc-lb-btn${idx===ti?' active':''}" style="font-size:11px;line-height:1.25;max-width:100%;white-space:normal;text-align:center;padding:6px 8px" onclick="setCharSuperchargedExTier(${idx})">${esc(t.label||('EX '+t.tier))}</button>`).join('')+`</div>`}
const isRankingView=!!(d&&d.view_ranking&&(type==='character'||type==='unit'));
if(isRankingView){const ck=detailRankingCacheKey(type,d.id);if(!_detailRankingStatsCache.has(ck)&&!_detailRankingStatsInflight.has(ck))void ensureDetailRankingStats(type,d.id).then(()=>{if(S.currentDetailData&&String(S.currentDetailData.id)===String(d.id)&&S.currentDetailType===type)updateDetailDynamicSections(type)}).catch(()=>{});}
const gridCls=isRankingView?'stats-grid stats-grid--ranking-list':'stats-grid';
const body=sr.map((s,i)=>{
const b=bs[i];const hcb=cp&&s.total>b.total;const hcp=cp&&s.total<b.total;let eb='';
if(hcp){const cpDelta=s.total-b.total;eb=`<div class="stat-card-bonus stat-card-penalty">(${fmtN(cpDelta)})</div>`}
else if(s.bonus>0){const showSsp=(type==='unit'&&S.sspActive&&s.name==='Move');eb=`<div class="stat-card-bonus">${showSsp?`<img src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP" style="height:14px;vertical-align:-2px;margin-right:4px;" onerror="this.style.display='none'">`:''}+${fmtN(s.bonus)}</div>`}
const cardHi=hcb?'has-cond-bonus':hcp?'has-cond-penalty':'';
const valHi=hcb?'has-bonus-val':hcp?'has-penalty-val':'';
if(!isRankingView||(type==='unit'&&s.name==='Move'))return`<div class="stat-card ${cardHi}"><div class="stat-card-label">${esc(tStat(s.name,type))}</div><div class="stat-card-value ${valHi}">${fmtN(s.total)}</div>${eb}</div>`;
const meta=detailRankingMetaFor(type,d.id,s.name);const loading=!meta||!meta.rank||!meta.total;const w=loading?62:detailRankingBarWidth(meta);const splitPos=!loading;let posHtml='...';if(!loading){const rk=Number(meta.rank)||0,tt=Number(meta.total)||0;if(S.lang==='EN')posHtml=`<span class="stat-rank-pos-main">${rk}${ordinalSuffixEn(rk)}/</span><span class="stat-rank-pos-total">${tt}</span>`;else posHtml=`<span class="stat-rank-pos-main">${fmtN(rk)}位 /</span><span class="stat-rank-pos-total">${fmtN(tt)}</span>`}
return`<div class="stat-card stat-card--ranking ${cardHi} ${loading?'is-loading':''}"><div class="stat-rank-head"><div class="stat-card-label stat-rank-label">${esc(tStat(s.name,type))}</div><div class="stat-rank-bar"><span class="stat-rank-fill ${loading?'is-loading':''}" style="width:${w.toFixed(2)}%"></span></div><div class="stat-rank-pos ${loading?'is-loading':''} ${splitPos?'is-split':''}">${posHtml}</div></div><div class="stat-card-value stat-rank-value ${valHi}">${fmtN(s.total)}</div>${eb}</div>`
}).join('');
return`${th}${exRow}<div class="${gridCls}">${body}</div>`
}
function toggleConditionalPassive(c){S.conditionalPassiveActive=c;if(!c)S.charSuperchargedExTier=0;invalidateDetailRankingCachesForPerspectiveChange();updateDetailDynamicSections(S.currentDetailType)}
function setCharSuperchargedExTier(i){const d=S.currentDetailData,arr=d&&d.ex_supercharged_tiers;if(!arr||!arr.length)return;const n=arr.length;S.charSuperchargedExTier=Math.max(0,Math.min(Number(i)||0,n-1));updateDetailDynamicSections('character')}
function renderStageRestrictions(d){if(!d.sortie_groups||!d.sortie_groups.length)return`<div class="detail-section"><div class="section-title">${t('sec_sortie_restrictions')}</div><div class="ability-item"><div class="ability-info"><div class="ability-detail">${t('none')}</div></div></div></div>`;return`<div class="detail-section"><div class="section-title">${t('sec_sortie_restrictions')}</div>${d.sortie_groups.map(g=>`<div class="stage-restriction-block"><div class="stage-restriction-group-title">${t('sortie_group')} ${g.group_no}</div>${(g.restrictions||[]).map(r=>`<div class="stage-restriction-row"><div class="stage-restriction-applies">${esc(r.applies_to||'-')}</div><div class="stage-tags-wrap">${(r.restriction_names||[]).length?(r.restriction_names||[]).map(n=>createTagHtml({id:'',name:n,type:'group'})).join(''):`<span style="color:var(--text-muted)">${t('none')}</span>`}</div></div>`).join('')}</div>`).join('')}</div>`}
function renderStageMapSection(d){
  const md=d.map_data||{};
  if(md.width<=0||md.height<=0)return`<div class="detail-section"><div class="section-title">${t('sec_stage_map')}</div><div class="ability-item"><div class="ability-info"><div class="ability-detail">${t('none')}</div></div></div></div>`;
  const zp=Math.round((S.stageMapZoom||1)*100);
  const af=!!S.stageMapAutoFit;
  const controls=S.stageMapExpanded?`<div class="stage-map-controls" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;">
    <button class="toggle-map-btn" onclick="fitStageMapToUnits(true)"><span>Fit</span></button>
    <button class="toggle-map-btn" onclick="centerStageMapToUnits()"><span>Center</span></button>
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);border-radius:12px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" ${af?'checked':''} onchange="setStageMapAutoFit(this.checked)" style="width:16px;height:16px;accent-color:var(--accent-cyan);">
        <span style="font-size:12px;color:var(--text-secondary);font-weight:800;">Auto-fit</span>
      </label>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);border-radius:12px;">
      <div style="font-size:12px;color:var(--text-muted);font-weight:700;letter-spacing:.3px;">Zoom</div>
      <input type="range" min="40" max="140" value="${zp}" oninput="setStageMapZoom(this.value/100,true)" ${af?'disabled':''} style="width:180px;${af?'opacity:.55;cursor:not-allowed;':''}">
      <div style="min-width:46px;text-align:right;font-size:12px;color:var(--text-secondary);font-weight:800;">${zp}%</div>
    </div>
  </div>`:'';
return`<div class="detail-section"><div class="section-title">${t('sec_stage_map')}</div><button class="toggle-map-btn" onclick="toggleStageMap()"><span>${S.stageMapExpanded?t('hide_stage_map'):t('view_stage_map')}</span></button>${controls}<div id="stageMapGridWrap" class="map-grid-container ${S.stageMapExpanded?'active':''}">${renderStageMapGrid(md)}</div></div>`
}

function _stageMapViewWindow(md){
  const w=md.width||0,h=md.height||0,units=md.units||[];
  if(!w||!h||!units.length)return {minX:1,maxX:w||1,minY:1,maxY:h||1};
  let mnX=999,mxX=-1,mnY=999,mxY=-1;
  units.forEach(un=>{
    const cls=un.cells||[{x:un.x,y:un.y}];
    cls.forEach(cl=>{
      const cx=Number(cl.x)+1,cy=Number(cl.y)+1;
      if(cx<mnX)mnX=cx;if(cx>mxX)mxX=cx;if(cy<mnY)mnY=cy;if(cy>mxY)mxY=cy
    })
  });
  if(mnX===999)return {minX:1,maxX:w||1,minY:1,maxY:h||1};
  const pad=2;
  return {
    minX:Math.max(1,mnX-pad),
    maxX:Math.min(w,mxX+pad),
    minY:Math.max(1,mnY-pad),
    maxY:Math.min(h,mxY+pad),
  }
}
function renderStageMapGrid(md){
  const w=md.width||24,h=md.height||28,units=md.units||[],occ={};
  units.forEach(u=>{
    if(u.cells&&u.cells.length){
      let oc=null;
      u.cells.forEach(c=>{
        const cx=Number(c.x)+1,cy=Number(c.y)+1;
        if(cx<1||cy<1||cx>w||cy>h)return;
        if(!oc)oc={x:cx,y:cy};
        else{if(cy>oc.y||(cy===oc.y&&cx<oc.x))oc={x:cx,y:cy}}
      });
      u.cells.forEach(c=>{
        const cx=Number(c.x)+1,cy=Number(c.y)+1;
        if(cx>=1&&cy>=1&&cx<=w&&cy<=h)occ[`${cx}_${cy}`]={unit:u,origin:!!(oc&&cx===oc.x&&cy===oc.y)}
      })
    }else{
      const x=Number(u.x||0)+1,y=Number(u.y||0)+1;
      if(x>=1&&y>=1&&x<=w&&y<=h)occ[`${x}_${y}`]={unit:u,origin:true}
    }
  });
  const win=_stageMapViewWindow(md);
  const vw=(win.maxX-win.minX+1),vh=(win.maxY-win.minY+1);
  const z=Math.max(.4,Math.min(1.4,Number(S.stageMapZoom||1)));
  const cellPx=Math.round(50*z);
  let html=`<div class="map-grid" style="--cell:${cellPx}px;grid-template-columns:repeat(${vw},var(--cell));">`;
  for(let y=win.maxY;y>=win.minY;y--){
    for(let x=win.minX;x<=win.maxX;x++){
      const o=occ[`${x}_${y}`],u=o?o.unit:null;
      let cls=u?`${u.side||''} ${u.is_guest_ally?'ally-guest':''} ${u.is_large?'large-fill':''}`:'';
      const originCls=(o&&o.origin)?' map-cell--unit-origin':'';
      const di=u?.npc_detail_index;
      const hasDetail=di!=null&&di!==''&&!Number.isNaN(Number(di));
      const canMapClick=!!(o&&u&&(hasDetail||u.unit_id||u.npc_id));
      const mapDataAttrs=canMapClick?`${hasDetail?` data-npc-map-detail="${Number(di)}"`:''}${(u.npc_id!=null&&String(u.npc_id)!=='')?` data-npc-map-npc-id="${escAttr(String(u.npc_id))}"`:''}${u.unit_id?` data-npc-map-unit-id="${escAttr(String(u.unit_id))}"`:''}`:'';
      const clickCls=(o&&u&&(u.unit_id||u.npc_id))?' npc-clickable':'';
      html+=`<div class="map-cell ${cls}${clickCls}${originCls}" title="${u?esc(`${u.name} (${u.side}) @ ${x},${y}`):`${x},${y}`}"${mapDataAttrs}>`;
      if(o&&o.origin){
        const sl=u.side==='ally'?t('ally'):t('enemy');
        // Keep ally group location icon (UI_GTower_Minimap_Icon_OwnArmy.webp) and guest ally (GuestArmy.webp) flat—no background hue.
        const isAllyLoc=(u.side==='ally')&&((!u.is_guest_ally&&(String(u.portrait||'').includes('UI_GTower_Minimap_Icon_OwnArmy.webp')||String(u.npc_id||'').startsWith('ally_g')))||(u.is_guest_ally&&String(u.portrait||'').includes('UI_GTower_Minimap_Icon_GuestArmy.webp')));
        const guestCls=u.is_guest_ally?'ally-guest':'';
        const dir=String(u.direction||'0');
        const rot=(dir==='3')?90:(dir==='2')?180:(dir==='1')?270:0; // swapped 2/4 mapping (4 is default)
        const rotStyle=isAllyLoc?` style="transform:rotate(${rot}deg);"`:'';
        html+=`<div class="map-unit-dot ${u.side||''} ${u.is_large?'large':''} ${isAllyLoc?'ally-loc':''} ${guestCls}">${u.portrait?`<img class="map-unit-thumb" src="${imgUrl(u.portrait)}" alt="" loading="lazy"${rotStyle} onerror="this.parentElement.innerHTML='${esc(sl)}'">`:`${esc(sl)}`}</div>`
      }
      html+=`</div>`
    }
  }
  html+=`</div>`;
  return html
}
function toggleStageMap(){
  S.stageMapExpanded=!S.stageMapExpanded;
  document.getElementById('detailStageMapContainer').innerHTML=renderStageMapSection(S.currentDetailData);
  if(S.stageMapExpanded)setTimeout(()=>fitStageMapToUnits(true),100)
}

function _stageMapBounds(){
  const md=S.currentDetailData?.map_data||{};
  const units=md.units||[];
  if(!units.length)return null;
  let mnX=999,mxX=-1,mnY=999,mxY=-1;
  units.forEach(un=>{
    const cls=un.cells||[{x:un.x,y:un.y}];
    cls.forEach(cl=>{
      const cx=Number(cl.x)+1,cy=Number(cl.y)+1;
      if(cx<mnX)mnX=cx;if(cx>mxX)mxX=cx;if(cy<mnY)mnY=cy;if(cy>mxY)mxY=cy
    })
  });
  if(mnX===999)return null;
  return {mnX,mxX,mnY,mxY}
}

function setStageMapZoom(z,fromSlider){
  S.stageMapZoom=Math.max(.4,Math.min(1.4,Number(z||1)));
  if(fromSlider)S.stageMapAutoFit=false;
  if(S.currentDetailType==='stage'){
    document.getElementById('detailStageMapContainer').innerHTML=renderStageMapSection(S.currentDetailData);
  }
}

function centerStageMapToUnits(){focusStageMap()}

function setStageMapAutoFit(on){
  S.stageMapAutoFit=!!on;
  if(S.currentDetailType==='stage'){
    document.getElementById('detailStageMapContainer').innerHTML=renderStageMapSection(S.currentDetailData);
    if(S.stageMapExpanded&&S.stageMapAutoFit)setTimeout(()=>fitStageMapToUnits(true),60)
  }
}

function fitStageMapToUnits(centerAfter){
  const c=document.getElementById('stageMapGridWrap');
  if(!c){if(centerAfter)focusStageMap();return}
  const md=S.currentDetailData?.map_data||{};
  const win=_stageMapViewWindow(md);
  if(!win){c.scrollLeft=0;c.scrollTop=0;return}

  // Compute fit using real layout: cell(50*z) + gap(2) + paddings.
  const baseCell=50;
  const gap=2;
  const contPad=20*2; // map-grid-container padding
  const gridPad=15*2; // map-grid padding
  const extraPad=8;  // breathing room
  const bw=(win.maxX-win.minX+1),bh=(win.maxY-win.minY+1);
  const availW=Math.max(80,c.clientWidth-(contPad+gridPad+extraPad));
  const availH=Math.max(80,c.clientHeight-(contPad+gridPad+extraPad));
  const cellPxW=Math.floor((availW-((bw-1)*gap))/bw);
  const cellPxH=Math.floor((availH-((bh-1)*gap))/bh);
  const cellPx=Math.max(10,Math.min(cellPxW,cellPxH));
  const z=cellPx/baseCell;

  // Slightly zoom out so edges aren't tight.
  S.stageMapZoom=Math.max(.4,Math.min(1.4,z*.98));
  if(S.currentDetailType==='stage'){
    document.getElementById('detailStageMapContainer').innerHTML=renderStageMapSection(S.currentDetailData);
  }
  if(centerAfter)setTimeout(()=>{const cc=document.getElementById('stageMapGridWrap');if(cc){cc.scrollLeft=0;cc.scrollTop=0}},60)
}

// List table headers: sticky below the site header (viewport scroll) — offset synced from measured header height.
function syncListTheadStickyTop(){
const el=document.querySelector('.app-header');
if(!el)return;
const h=el.getBoundingClientRect().height;
document.documentElement.style.setProperty('--list-thead-sticky-top',Math.max(0,Math.round(h))+'px')
}
let _listTheadStickyRaf=0;
function scheduleSyncListTheadStickyTop(){
if(_listTheadStickyRaf)return;
_listTheadStickyRaf=requestAnimationFrame(()=>{_listTheadStickyRaf=0;syncListTheadStickyTop()})
}

// iOS Safari: bottom toolbar / address bar overlaps fixed UI; shift compare bar & overlay using visual viewport.
function updateCmpBrowserInset(){
const vv=window.visualViewport;
let inset=0;
if(vv){
inset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
}
document.documentElement.style.setProperty('--cmp-browser-inset-bottom',inset+'px')
}
function initCmpSafeArea(){
updateCmpBrowserInset();
syncListTheadStickyTop();
const onVV=()=>{updateCmpBrowserInset();scheduleSyncListTheadStickyTop();syncCmpMobilePickChrome();updateCompareUI()};
const onResize=()=>{updateCmpBrowserInset();scheduleSyncListTheadStickyTop();syncCmpMobilePickChrome();updateCompareUI()};
const onScroll=()=>scheduleSyncListTheadStickyTop();
if(window.visualViewport){
window.visualViewport.addEventListener('resize',onVV);
window.visualViewport.addEventListener('scroll',onVV)
}
window.addEventListener('resize',onResize);
window.addEventListener('orientationchange',onResize);
window.addEventListener('scroll',onScroll,{passive:true})
}

// Keep stage map "full picture" without manual zooming.
window.addEventListener('resize',()=>{
if(S.currentDetailType==='stage'&&S.stageMapExpanded&&S.stageMapAutoFit){
fitStageMapToUnits(false)
}
});
function focusStageMap(){const c=document.getElementById('stageMapGridWrap');if(!c)return;const md=S.currentDetailData?.map_data||{};const units=md.units||[];const mh=md.height||28;if(!units.length){c.scrollLeft=0;c.scrollTop=0;return}let mnX=999,mxX=-1,mnY=999,mxY=-1;units.forEach(un=>{const cls=un.cells||[{x:un.x,y:un.y}];cls.forEach(cl=>{const cx=Number(cl.x)+1,cy=Number(cl.y)+1;if(cx<mnX)mnX=cx;if(cx>mxX)mxX=cx;if(cy<mnY)mnY=cy;if(cy>mxY)mxY=cy})});if(mnX===999){c.scrollLeft=0;c.scrollTop=0;return}const z=Math.max(.4,Math.min(1.4,Number(S.stageMapZoom||1)));const cell=Math.round(50*z)+2;const gridPad=15;const contPad=20;const centerX=(mnX+mxX)/2;const centerY=(mnY+mxY)/2;const xPx=contPad+gridPad+(centerX-1)*cell+cell/2;const yPx=contPad+gridPad+((mh-centerY))*cell+cell/2;let targetLeft=xPx-c.clientWidth/2;let targetTop=yPx-c.clientHeight/2;const maxLeft=Math.max(0,c.scrollWidth-c.clientWidth);const maxTop=Math.max(0,c.scrollHeight-c.clientHeight);c.scrollLeft=Math.max(0,Math.min(maxLeft,targetLeft));c.scrollTop=Math.max(0,Math.min(maxTop,targetTop))}
function switchStageNpcTab(btn){if(!btn)return;const idx=parseInt(btn.getAttribute('data-tab-idx'),10)||0;const root=btn.closest('[data-stage-npc-group]');if(!root)return;const tabs=root.querySelectorAll('.stage-npc-tab-btn');const panels=root.querySelectorAll('.stage-npc-tab-panel');tabs.forEach((b,i)=>{b.classList.toggle('active',i===idx);b.setAttribute('aria-selected',String(i===idx))});panels.forEach((p,i)=>{p.classList.toggle('hidden',i!==idx)})}
function renderNpcDetails(list,stageId){if(!list||!list.length)return`<div class="detail-section"><div class="section-title">${t('sec_npc_details')}</div><div class="ability-item"><div class="ability-info"><div class="ability-detail">${t('none')}</div></div></div></div>`;const sid=String(stageId!=null?stageId:'').replace(/[^a-zA-Z0-9_-]/g,'_')||'stage';const indexed=(list||[]).map((n,i)=>({n,idx:i}));const allies=indexed.filter(o=>o.n.side==='ally');const enemies=indexed.filter(o=>o.n.side!=='ally');function npcLabel(n){const u=n.unit,ch=n.character;return(u&&u.name)||(ch&&ch.name)||`NPC ${n.npc_id}`}function tabbedGroup(groupKey,indexedRows,open){if(!indexedRows||!indexedRows.length)return'';const gk=sid+'_'+groupKey;const title=groupKey==='ally'?t('stage_npc_friendly_tab'):t('stage_npc_enemy_tab');let tb='',pn='';indexedRows.forEach((item,i)=>{const n=item.n,idx=item.idx;const lab=esc(npcLabel(n));tb+=`<button type="button" class="stage-npc-tab-btn ${i===0?'active':''}" role="tab" aria-selected="${i===0}" data-tab-idx="${i}" id="sn-tab-${escAttr(gk)}-${i}" aria-controls="sn-panel-${escAttr(gk)}-${i}" onclick="switchStageNpcTab(this)">${lab}</button>`;pn+=`<div class="stage-npc-tab-panel ${i===0?'':'hidden'}" role="tabpanel" id="sn-panel-${escAttr(gk)}-${i}" aria-labelledby="sn-tab-${escAttr(gk)}-${i}">${renderNpcCard(n,idx)}</div>`});return`<details class="stage-npc-group" ${open?'open':''}><summary class="stage-npc-group-summary"><span class="stage-npc-summary-title">${esc(title)}</span><span class="stage-npc-count">(${indexedRows.length})</span></summary><div class="stage-npc-tab-wrap" data-stage-npc-group="${escAttr(gk)}"><div class="stage-npc-tablist" role="tablist">${tb}</div>${pn}</div></details>`}const body=tabbedGroup('ally',allies,true)+tabbedGroup('enemy',enemies,!allies.length);return`<div class="detail-section"><div class="section-title">${t('sec_npc_details')}</div>${body}</div>`}
function renderNpcCard(n,detailIdx){const u=n.unit,ch=n.character,us=u?.stats_raw||{},ub=u?.bonus_amounts||{},cs=ch?.stats_raw||{},cb=ch?.bonus_amounts||{};let unitHtml='';if(u){unitHtml=`<div class="detail-header" style="padding:20px;background:rgba(0,0,0,0.3);border-radius:var(--radius-md);border:1px solid var(--border-color);margin-bottom:12px;"><div style="display:flex;gap:20px;flex-wrap:wrap;"><div class="detail-portrait-wrap" style="width:180px;">${u.portrait?`<img class="detail-portrait" src="${imgUrl(u.portrait)}" style="width:180px;height:240px;object-fit:contain;" alt="" loading="lazy">`:`<div class="detail-portrait-placeholder" style="width:180px;height:240px;font-size:40px;">🤖</div>`}</div><div class="detail-title-area" style="justify-content:center;flex:1;min-width:250px;"><div class="detail-name" style="font-size:24px;margin-bottom:8px;">${esc(u.name||`NPC ${n.npc_id}`)}</div><div class="detail-meta" style="margin-bottom:8px;">${u.rarity_icon?`<img class="detail-rarity-icon" style="height:35px;" src="${imgUrl(u.rarity_icon)}" alt="">`:''}<span class="detail-role-label">${u.role_icon?`<img src="${imgUrl(u.role_icon)}" style="height:25px;" alt="">`:''}${esc(tRole(u.role))}</span><span class="stage-meta-badge" style="background:rgba(26,34,54,0.6);margin-left:10px;">MAP: X:${fmtN(n.x)} Y:${fmtN(n.y)} ${n.is_large?' (2x2)':''}</span></div>${renderSeries(u.series,'units')}${renderTags(u.tags)}<div class="stats-grid" style="margin-top:12px;">${['HP','EN','Attack','Defense','Mobility','Move'].map(s=>{let b=ub[s]||0;let v=us[s]||0;let hl=b>0?'has-bonus-val':'';let bt=b>0?`<div class="stat-card-bonus" style="font-size:12px;color:var(--accent-green);margin-top:2px;">(+${fmtN(b)})</div>`:'';return`<div class="stat-card ${b>0?'has-cond-bonus':''}"><div class="stat-card-label">${esc(tStat(s,'unit'))}</div><div class="stat-card-value ${hl}">${fmtN(v)}</div>${bt}</div>`}).join('')}</div></div></div></div>${u.abilities&&u.abilities.length?renderAbilsDynamic(u.abilities,t('npc_unit_abilities'),false,false,'unit'):''}${u.weapons&&u.weapons.length?renderWeaponsDynamic(u.weapons,false,n):''}`}let charHtml='';if(ch){charHtml=`<div class="detail-header" style="padding:20px;background:rgba(0,0,0,0.3);border-radius:var(--radius-md);border:1px solid var(--border-color);margin-bottom:12px;margin-top:24px;"><div style="display:flex;gap:20px;flex-wrap:wrap;"><div class="detail-portrait-wrap" style="width:180px;">${ch.portrait?`<img class="detail-portrait" src="${imgUrl(ch.portrait)}" style="width:180px;height:240px;object-fit:contain;" alt="" loading="lazy">`:`<div class="detail-portrait-placeholder" style="width:180px;height:240px;font-size:40px;">👤</div>`}</div><div class="detail-title-area" style="justify-content:center;flex:1;min-width:250px;"><div class="detail-name" style="font-size:24px;margin-bottom:8px;">${esc(ch.name)}</div><div class="detail-meta" style="margin-bottom:8px;">${ch.rarity_icon?`<img class="detail-rarity-icon" style="height:35px;" src="${imgUrl(ch.rarity_icon)}" alt="">`:``}</div>${renderSeries(ch.series,'characters')}${renderTags(ch.tags)}<div class="stats-grid" style="margin-top:12px;">${['Ranged','Melee','Defense','Reaction','Awaken'].map(s=>{let b=cb[s]||0;let v=cs[s]||0;let hl=b>0?'has-bonus-val':'';let bt=b>0?`<div class="stat-card-bonus" style="font-size:12px;color:var(--accent-green);margin-top:2px;">(+${fmtN(b)})</div>`:'';return`<div class="stat-card ${b>0?'has-cond-bonus':''}"><div class="stat-card-label">${esc(tStat(s,'character'))}</div><div class="stat-card-value ${hl}">${fmtN(v)}</div>${bt}</div>`}).join('')}</div></div></div></div>${ch.abilities&&ch.abilities.length&&typeof ch.abilities[0]!=='string'?renderAbilsDynamic(ch.abilities,t('npc_character_abilities'),false,false,'character'):''}${ch.skills&&ch.skills.length&&typeof ch.skills[0]!=='string'?renderSkills(ch.skills,false):''}`}return`<div id="npc-detail-${detailIdx}" class="detail-section npc-card" data-npc-id="${escAttr(String(n.npc_id!=null?n.npc_id:''))}" style="border:2px solid var(--border-accent);border-radius:var(--radius-lg);padding:16px;background:rgba(0,0,0,0.2);margin-bottom:24px;"><div style="font-size:20px;font-weight:900;color:var(--accent-cyan);margin-bottom:16px;border-bottom:1px solid var(--border-accent);padding-bottom:8px;">${esc(u?.name||ch?.name||`NPC ${n.npc_id}`)}</div>${unitHtml}${charHtml}</div>`}
function renderSeries(s,listTab){if(!s||!s.length)return'';const clk=listTab==='characters'||listTab==='units';const tip=esc(t('search_series_click'));return`<div class="detail-series-row">${s.map(x=>{const rawId=x.id!=null?String(x.id).trim():'';if(!clk){if(x.icon)return`<img class="series-icon-img" src="${imgUrl(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}" loading="lazy" onerror="this.outerHTML='<span class=\\'series-text-fallback\\'>${esc(x.name)}</span>'">`;return`<span class="series-text-fallback" title="${esc(x.name)}">${esc(x.name)}</span>`}if(!rawId){if(x.icon)return`<img class="series-icon-img" src="${imgUrl(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}" loading="lazy" onerror="this.outerHTML='<span class=\\'series-text-fallback\\'>${esc(x.name)}</span>'">`;return`<span class="series-text-fallback">${esc(x.name)}</span>`}const inner=x.icon?`<img class="series-icon-img series-icon-clickable" src="${imgUrl(x.icon)}" alt="${esc(x.name)}" loading="lazy" onerror="this.style.display='none';var fb=this.nextElementSibling;if(fb)fb.style.display='inline-flex'"><span class="series-text-fallback series-icon-clickable" style="display:none">${esc(x.name)}</span>`:`<span class="series-text-fallback series-icon-clickable">${esc(x.name)}</span>`;return`<button type="button" class="series-icon-hitbox" data-series-id="${escAttr(rawId)}" data-list-tab="${escAttr(listTab)}" data-series-name="${escAttr(x.name||'')}" title="${tip}" aria-label="${tip}">${inner}</button>`}).join('')}</div>`}
function createTagHtml(tag,opts){const o=opts||{};const tn=typeof tag==='string'?tag:(tag.name||'');const tt=typeof tag==='string'?'':(tag.type||'');const tid=typeof tag==='string'?'':(tag.id||'');const preferred=(o.defaultTarget==='unit'||o.defaultTarget==='character')?o.defaultTarget:'';const forceTagModal=!!o.force_tag_modal;let li='';if(tt==='character')li='/static/images/UI/UI_Common_Icon_Category_Chara_Main.webp';else li='/static/images/UI/UI_Common_Icon_Category_MS_Main.webp';let onClick=`openTagModal('${escJs(tn)}','or'${preferred?`,'${preferred}'`:''})`;if(tt==='series'&&tid&&!forceTagModal){const tab=(preferred==='character')?'characters':'units';onClick=`openSeriesModal('${escJs(tid)}','${tab}','${escJs(tn)}')`}return`<div class="tag-composite" onclick="event.stopPropagation();${onClick}" title="Click to view"><div class="tag-part-icon">${li?`<img class="tag-icon-fg" src="${imgUrl(li)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}</div><div class="tag-part-value">${esc(tn)}</div></div>`}
function renderTags(tags){if(!tags||!tags.length)return'';return`<div class="detail-tags-row" style="margin-top:12px;">${tags.map(createTagHtml).join('')}</div>`}
function renderHeaderTerrain(ter,showSsp,hasTerrainEnhancements){if(!ter||!ter.length)return'';const rowCls='header-terrain-row';const showSspIcon=showSsp&&hasTerrainEnhancements;return`<div class="${rowCls}">${showSspIcon?`<img src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP" style="height:18px;object-fit:contain;opacity:.95;filter:drop-shadow(0 1px 2px rgba(0,0,0,.9));margin-right:4px;" onerror="this.style.display='none'">`:''}${ter.map(x=>{let dim=x.level<2;const enh=x.ssp_enhanced?' ssp-enhanced':'';return`<div class="header-terrain-item ${dim?'dimmer-terrain':''}${enh}">${x.type_icon?`<img class="header-terrain-type-icon" src="${imgUrl(x.type_icon)}" alt="${x.name}">`:''}${x.level_icon?`<img class="header-terrain-level-icon" src="${imgUrl(x.level_icon)}" alt="${x.symbol}">`:`<span>${x.symbol}</span>`}</div>`}).join('')}</div>`}
function renderAbilIcon(ab){if(!ab.icon)return'<div class="ability-icon-placeholder">★</div>';let h=`<img class="ability-icon" src="${imgUrl(ab.icon)}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'ability-icon-placeholder\\'>★</div>'">`;if(ab.frame_overlay&&ab.is_ex)h+=`<img class="ability-frame-overlay" src="${imgUrl(ab.frame_overlay)}" alt="" onerror="this.style.display='none'">`;return h}
function isUnknownAbilityName(n){const s=String(n||'').trim();return s==='Unknown'||/^Unknown\s*\(/i.test(s)}
function abilityConditionLabel(label){const lc=(S.lang||'EN').toUpperCase();const k=String(label||'').trim();if(k==='Condition 1')return(lc==='TW'||lc==='HK')?'[條件 1]':(lc==='JA'||lc==='JP')?'[条件 1]':'[Condition 1]';if(k==='Condition 2')return(lc==='TW'||lc==='HK')?'[條件 2]':(lc==='JA'||lc==='JP')?'[条件 2]':'[Condition 2]';if(k==='Boost Target')return(lc==='TW'||lc==='HK')?'[加成目標]':(lc==='JA'||lc==='JP')?'[強化対象]':'[Boost Target]';return k?`[${k}]`:''}
function _conditionLabelSortKey(label){const s=String(label||'').trim();const m=s.match(/^Condition\s+(\d+)$/i);if(m)return parseInt(m[1],10)||999;return s==='Boost Target'?998:999}
function conditionJoiner(prevTag,curTag,allTags){const a=String(prevTag&&prevTag.source||'').trim();const b=String(curTag&&curTag.source||'').trim();const andMode=!!(a&&b&&a!==b);const txt=andMode?'&':t('tag_or');const names=(Array.isArray(allTags)?allTags:[]).map(x=>String(x&&x.name||'').trim()).filter(Boolean);const op=andMode?'and':'or';const joined=names.join(',');return `<button type="button" class="ability-cond-joiner" onclick="event.stopPropagation();openTagModal('${escJs(joined)}','${op}','unit')" style="display:flex;align-items:center;color:#a855f7;font-weight:900;font-size:13px;margin:0 4px;background:none;border:none;padding:0;cursor:pointer;">${esc(txt)}</button>`}
function renderConditionTagsWithJoiners(tags){const arr=Array.isArray(tags)?tags:[];let h='';for(let i=0;i<arr.length;i++){if(i>0)h+=conditionJoiner(arr[i-1],arr[i],arr);h+=createTagHtml(arr[i],{defaultTarget:'unit'})}return h}
function normalizeAbilityDetailTextForSplit(raw){let s=String(raw||'').trim();if(!s)return s;s=s.replace(/([.%])\s+(?=When\s+Vigor\b)/gi,'$1\n');s=s.replace(/([;；])\s*(?=When\s+Vigor\b)/gi,'$1\n');s=s.replace(/,\s+and\s+(?=when\s+vigor\b)/gi,',\n');s=s.replace(/,\s+(?=when\s+vigor\b)/gi,',\n');s=s.replace(/\.\s+(?=\b(?:Increase|Increases)\b)/gi,'.\n');s=s.replace(/;\s+(?=\b(?:Increase|Increases)\b)/gi,';\n');s=s.replace(/([^\s\n%])\s+(?=When\s+Vigor\b)/gi,'$1\n');return s}
function abilityValidConditionGroupsSorted(detail){const groups=Array.isArray(detail&&detail.condition_groups)?detail.condition_groups.slice():[];if(!groups.length)return[];groups.sort((a,b)=>_conditionLabelSortKey(a&&a.label)-_conditionLabelSortKey(b&&b.label));return groups.filter(g=>Array.isArray(g&&g.conditions)&&g.conditions.length)}
function _detailProseContainsAllConditionNames(prose,tags){const hay=String(prose||'').toLowerCase().replace(/\s+/g,' ').trim();if(!hay)return false;for(let i=0;i<(tags||[]).length;i++){const n=String(tags[i]&&tags[i].name||'').trim().toLowerCase().replace(/\s+/g,' ');if(!n)return false;if(!hay.includes(n))return false}return true}
function _abilityConditionGroupPilotUnitRedundant(prose,g){const conds=Array.isArray(g&&g.conditions)?g.conditions:[];if(!conds.length)return false;if(!conds.every(c=>String(c&&c.source||'')==='unit_ids'))return false;const low=String(prose||'').toLowerCase();if(!/\b(?:when\s+)?piloting\b/i.test(low))return false;return _detailProseContainsAllConditionNames(prose,conds)}
/** Detail modal only: hides pilot-only unit_id pills duplicated by “when piloting …” prose. Keeps JSON intact for simulator / TB. */
function abilityUiConditionGroupsSorted(detail){const prose=String(detail&&detail.text||'');return abilityValidConditionGroupsSorted(detail).filter(g=>!_abilityConditionGroupPilotUnitRedundant(prose,g))}
function abilityUiFallbackConditionsSorted(detail){const raw=Array.isArray(detail&&detail.conditions)?detail.conditions.slice():[];const prose=String(detail&&detail.text||'');const low=prose.toLowerCase();if(!/\b(?:when\s+)?piloting\b/i.test(low))return raw;return raw.filter(c=>!(String(c&&c.source||'')==='unit_ids'&&_detailProseContainsAllConditionNames(prose,[c])))}
function renderAbilityConditionGroups(detail){const valid=abilityUiConditionGroupsSorted(detail);if(valid.length){const showLabels=valid.length>=2;const seqLabels=valid.map((_,i)=>`Condition ${i+1}`);return`<div class="ability-conditions">${valid.map((g,gi)=>{const tags=Array.isArray(g&&g.conditions)?g.conditions:[];const tagsHtml=renderConditionTagsWithJoiners(tags);return`<div class="ability-condition-group">${showLabels?`<div class="ability-condition-label">${esc(abilityConditionLabel(seqLabels[gi]))}</div>`:''}<div class="ability-condition-tags">${tagsHtml}</div></div>`}).join('')}</div>`}const conds=abilityUiFallbackConditionsSorted(detail);if(!conds.length)return'';const tagsHtml=renderConditionTagsWithJoiners(conds);return`<div class="ability-conditions ability-conditions--after-text"><div class="ability-condition-group"><div class="ability-condition-tags">${tagsHtml}</div></div></div>`}
function renderAbilityConditionGroupAt(detail,gi){const valid=abilityUiConditionGroupsSorted(detail);if(gi<0||gi>=valid.length)return'';const showLabels=valid.length>=2;const seqLabels=valid.map((_,i)=>`Condition ${i+1}`);const g=valid[gi];const tags=Array.isArray(g&&g.conditions)?g.conditions:[];const tagsHtml=renderConditionTagsWithJoiners(tags);return`<div class="ability-conditions"><div class="ability-condition-group">${showLabels?`<div class="ability-condition-label">${esc(abilityConditionLabel(seqLabels[gi]))}</div>`:''}<div class="ability-condition-tags">${tagsHtml}</div></div></div>`}
function splitAbilityTextIntoBlocks(raw){const lines=String(raw||'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);if(lines.length<=1)return lines.length?[lines[0]]:[];const out=[];let cur=[];function startsNewBlock(ln){if(!ln.length)return false;if(/^when\s/.test(ln))return false;if(/^When\s+effect\s+ends?:/i.test(ln))return false;if(/^When\s+Vigor\b/i.test(ln))return true;return /^When\s/.test(ln)}for(let i=0;i<lines.length;i++){const ln=lines[i];if(cur.length&&startsNewBlock(ln)){out.push(cur.join('\n'));cur=[ln]}else{cur.push(ln)}}if(cur.length)out.push(cur.join('\n'));return out}
function blockIndexForConditions(groups,hasCond){if(!hasCond)return -1;if(!groups||!groups.length)return -1;if(groups.length===1)return 0;const i=groups.findIndex(g=>/specified\s+tags|above\s+tags/i.test(g));if(i>=0)return i;if(groups.length>=2)return 1;return groups.length-1}
function renderAbilityDetailChunks(d){let obj;if(typeof d==='string')obj={text:d};else if(d&&typeof d==='object')obj=d;else return'';const raw0=String(obj.text||'').trim();const raw=normalizeAbilityDetailTextForSplit(raw0);const cond=renderAbilityConditionGroups(obj);const hasCond=!!cond;const validCgRaw=abilityValidConditionGroupsSorted(obj);const validCgUi=abilityUiConditionGroupsSorted(obj);function wrapBlock(inner){return`<div class="ability-detail-chunk"><div class="ability-detail-block"><div class="ability-detail-block-inner">${inner}</div></div></div>`}if(!raw)return hasCond?wrapBlock(cond):'';let groups=splitAbilityTextIntoBlocks(raw);if(validCgRaw.length>=2&&groups.length===1){const g0=groups[0]||'';const sub=g0.split(/\.\s+(?=When\s+Vigor\b|\b(?:Increase|Increases)\b)/i).map(x=>x.trim()).filter(x=>x.length);if(sub.length>=2&&sub.length===validCgRaw.length)groups=sub}const useParallel=validCgUi.length>=2&&validCgUi.length===groups.length;if(useParallel)return groups.map((g,i)=>{const textHtml=g?`<div class="ability-detail-text">${esc(g)}</div>`:'';const condHtml=renderAbilityConditionGroupAt(obj,i);return wrapBlock(textHtml+condHtml)}).join('');const condIdx=blockIndexForConditions(groups,hasCond);return groups.map((g,i)=>{const textHtml=g?`<div class="ability-detail-text">${esc(g)}</div>`:'';const condHtml=i===condIdx?cond:'';return wrapBlock(textHtml+condHtml)}).join('')}
function renderAbilsDynamic(a,title,isSsp,isSp,entityType){if(!a||!a.length)return'';const et=entityType||S.currentDetailType;const canClick=(et==='character'||et==='unit');let rows=(a||[]).filter(ba=>!(ba.ssp_only&&!isSsp));if(et==='character'&&!isSp)rows=rows.filter(ba=>!(ba.sp_replacement&&isUnknownAbilityName(ba.name)));if(et==='unit'&&!isSsp)rows=rows.filter(ba=>!(ba.ssp_replacement&&isUnknownAbilityName(ba.name)));if(!rows.length)return'';return`<div class="detail-section"><div class="section-title">${title||t('sec_abilities')}</div><div class="ability-list">${rows.map(ba=>{let ab=ba,ssp=false,sp=false;if(isSsp&&ba.ssp_only){ab=ba;ssp=true}else if(isSsp&&ba.ssp_replacement){ab=ba.ssp_replacement;ssp=true}else if(isSp&&ba.sp_replacement){ab=ba.sp_replacement;sp=true}const dn=ab.display_name||ab.name;const clickAttr=canClick?` onclick="event.stopPropagation();if(event.target&&event.target.closest&&event.target.closest('.ability-conditions'))return;openAbilityModal('${escJs(ab.name)}','${et}','${escJs(dn)}')" title="${t('view_owners')||'View who has this'}"`:'';const clickCls=canClick?' ability-item-clickable':'';const ds=Array.isArray(ab.details)?ab.details:[];return`<div class="ability-item${clickCls}"${clickAttr}><div class="ability-icon-wrap">${renderAbilIcon(ab)}</div><div class="ability-info"><div class="ability-name" style="display:flex;align-items:center;gap:6px;">${sp?'<img src="'+imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp')+'" style="height:20px;object-fit:contain;" alt="SP">':''}${ssp?'<img src="'+imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')+'" style="height:20px;object-fit:contain;" alt="SSP">':''}${esc(dn)}</div>${ds.map(d=>renderAbilityDetailChunks(d)).join('')}</div></div>`}).join('')}</div></div>`}
function renderSkills(s,isSp){if(!s||!s.length)return'';let vs=s.filter(sk=>isSp?sk.is_sp||!sk.replaced_by_sp:!sk.is_sp);if(!vs.length)return'';return`<div class="detail-section"><div class="section-title">${t('sec_skills')}</div><div class="ability-list">${vs.map(sk=>{const clickable=!sk.skip_skill_modal;const clickCls=clickable?' ability-item-clickable':'';const oc=clickable?` onclick="event.stopPropagation();openSkillModal('${escJs(sk.name)}')"`:'';const tt=clickable?` title="${t('view_owners')||'View who has this'}"`:'';return`<div class="ability-item${clickCls}"${oc}${tt}><div class="ability-icon-wrap">${renderAbilIcon(sk)}</div><div class="ability-info"><div class="ability-name" style="display:flex;align-items:center;gap:6px;">${sk.is_sp?'<img src="'+imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp')+'" style="height:20px;object-fit:contain;" alt="SP">':''}${esc(sk.name)}</div>${(sk.details||[]).map(d=>renderAbilityDetailChunks(d)).join('')}</div></div>`}).join('')}</div></div>`}
function renderMechanisms(m){if(!m||!m.length)return'';return`<div class="detail-section"><div class="section-title">${t('sec_mechanism')}</div><div class="ability-list">${m.map(x=>`<div class="ability-item"><div class="ability-icon-wrap">${x.icon?`<img class="mech-icon" src="${imgUrl(x.icon)}" alt="" onerror="this.outerHTML='<div class=\\'ability-icon-placeholder\\'>⚙️</div>'">`:'<div class="ability-icon-placeholder">⚙️</div>'}</div><div class="ability-info"><div class="ability-name">${esc(x.name)}</div><div class="ability-detail">${esc(x.description)}</div></div></div>`).join('')}</div></div>`}
function toggleMapGrid(id){document.getElementById('map-'+id).classList.toggle('active')}
function toggleWeaponMapGridTheme(btn){
if(!btn)return;
const w=btn.closest('.weapon-map-grid-wrap');
if(!w)return;
const on=!w.classList.contains('weapon-map-high-vis');
w.classList.toggle('weapon-map-high-vis',on);
btn.setAttribute('aria-pressed',on?'true':'false');
btn.title=on?t('map_effect_theme_light'):t('map_effect_theme_dark');
try{localStorage.setItem('weaponMapHighVis',on?'1':'0');localStorage.removeItem('weaponMapEffectDark')}catch(_){}
const moon=btn.querySelector('.weapon-map-theme-ic--moon');
const sun=btn.querySelector('.weapon-map-theme-ic--sun');
if(moon)moon.style.display=on?'none':'block';
if(sun)sun.style.display=on?'block':'none'}
function weaponMapGridHighVisPreferred(){try{const v=localStorage.getItem('weaponMapHighVis');if(v==='1')return true;if(v==='0')return false;return localStorage.getItem('weaponMapEffectDark')==='1'}catch(_){return false}}
function renderWeaponTraitItemHtml(tr){const raw=String(tr??'');const lines=raw.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);if(!lines.length)return'';return`<div class="weapon-trait-item">${lines.map(l=>`<div class="weapon-trait-line">${esc(l)}</div>`).join('')}</div>`}
function renderWeaponsDynamic(w,isSsp,unitData){if(!w||!w.length)return'';let h=`<div class="detail-section"><div class="section-title">${t('sec_weapons')}</div><div class="weapon-list">`;w.forEach(x=>{if(x.is_ssp_weapon&&!isSsp)return;const wpPct=unitData&&unitData.weapon_passive_pct;const baseM=isSsp&&wpPct&&wpPct.ssp?wpPct.ssp:(wpPct&&wpPct.sp)||{};const condM=isSsp&&wpPct&&wpPct.ssp_cond?wpPct.ssp_cond:(wpPct&&wpPct.sp_cond)||{};const accPct=(baseM.Accuracy||0)+(S.conditionalPassiveActive?(condM.Accuracy||0):0);const critPct=(baseM.Critical||0)+(S.conditionalPassiveActive?(condM.Critical||0):0);const powPct=(baseM.Power||0)+(S.conditionalPassiveActive?(condM.Power||0):0);let lv=S.currentWeaponLevels[x.id]||5;let ld;if(x.levels&&x.levels.length){ld=x.levels.find(l=>l.level===lv)||x.levels[4]||x.levels[0];}else{ld={power:x.power||0,en:x.en_cost||x.en||0,accuracy:x.accuracy||0,critical:x.critical||0,ammo:x.ammo||0,traits:x.traits||[]};}const accB=ld.accuracy||0,critB=ld.critical||0,powB=ld.power||0;const accD=Math.max(0,Math.round(accB+accPct)),critD=Math.max(0,Math.round(critB+critPct));const isWpnMap=x.weapon_type==='3'||x.is_map;let pp=Math.floor(powB*(1+powPct/100))+(isSsp?(x.ssp_power_bonus||0):0),pa=isWpnMap?(ld.ammo+(isSsp?(x.ssp_ammo_bonus||0):0)):0,pr=x.max_range+(isSsp?(x.ssp_range_bonus||0):0);let pt=[...(ld.traits||[])];if(isSsp&&x.ssp_traits&&x.ssp_traits.length>0)pt=[...pt,...x.ssp_traits];let rc=isSsp?x.ssp_icon_color:x.icon_color;let he=isSsp&&!x.is_ssp_weapon&&((x.ssp_power_bonus>0)||(isWpnMap&&(x.ssp_ammo_bonus>0))||(x.ssp_range_bonus>0)||(isSsp&&x.ssp_traits&&x.ssp_traits.length>0));const powPsv=Math.floor(powB*(1+powPct/100))>powB;let pc=(isSsp&&x.ssp_power_bonus>0)?'ssp-highlight-val':(powPsv?'weapon-acc-boost':'highlight'),rac=!isWpnMap&&(isSsp&&x.ssp_range_bonus>0)?'ssp-highlight-val':'',ac2=(isWpnMap&&isSsp&&x.ssp_ammo_bonus>0)?'ssp-highlight-val':'';const accCls=accD>accB?'weapon-acc-boost':'',critCls=critD>critB?'weapon-acc-boost':'';let sp2=x.is_ssp_weapon&&x.weapon_type!=='3';let lb=`<div class="weapon-level-selector">${[1,2,3,4,5].map(l=>`<button class="w-lv-btn ${lv===l?'active':''}" onclick="switchWeaponLevel('${x.id}',${l})">Lv ${l}</button>`).join('')}</div>`;h+=`<div class="weapon-card"><div class="weapon-card-header"><div class="weapon-header-left"><div class="weapon-icon-wrap${(x.is_ssp_weapon||rc==='map'||rc==='ex')?' weapon-icon-wrap-no-vivid':''}">${sp2?`<img class="ssp-weapon-portrait" src="${imgUrl(x.ssp_icon)}" alt="" onerror="this.style.display='none'">`:`${(rc==='ex'||rc==='map'||!rc)?`<img class="weapon-icon-img" src="${imgUrl(x.icon)}" alt="" onerror="this.outerHTML='<div class=\\'weapon-icon-fallback\\'>MAP</div>'">`:`<div class="weapon-icon-mask color-${rc}" style="-webkit-mask-image:url('${imgUrl(x.icon)}');mask-image:url('${imgUrl(x.icon)}');"></div>`}${x.overlay?`<img class="weapon-overlay" src="${imgUrl(x.overlay)}" alt="" onerror="this.style.display='none'">`:''}`}${x.is_ssp_weapon?`<img class="ssp-weapon-badge" src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP" onerror="this.style.display='none'">`:(he?`<img class="ssp-enhance-badge" src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP" onerror="this.style.display='none'">`:'')}${x.is_preemptive?`<img class="preemptive-badge" src="${imgUrl('/static/images/UI/UI_Common_Icon_PreemptiveAttack.webp')}" alt="" onerror="this.style.display='none'">`:''}</div><div class="weapon-name-area"><div class="weapon-name-text">${esc(x.name)}</div><div class="weapon-attack-types">${(x.attack_types||[]).map(at=>at.is_supply?`<span style="font-size:12px;color:var(--accent-cyan);font-weight:600;display:flex;align-items:center;gap:4px;">${t('supply_type')} <img class="weapon-attack-type-icon" src="${imgUrlPreferCdn(at.icon)}" alt="${at.label}"> MP</span>`:`<img class="weapon-attack-type-icon" src="${imgUrlPreferCdn(at.icon)}" alt="${at.label}" title="${at.label}">`).join('')}</div></div></div><div class="weapon-header-trail">${x.attribute?`<div class="weapon-attribute-set">${esc('<'+x.attribute+'>')}</div>`:'<div class="weapon-attribute-set" aria-hidden="true"></div>'}${lb}</div></div><div class="weapon-card-stats"><div class="weapon-stat-item"><div class="weapon-stat-label">${t('wp_range')}</div><div class="weapon-stat-value ${rac}">${isWpnMap?'MAP':x.min_range+'-'+pr}</div></div><div class="weapon-stat-item"><div class="weapon-stat-label">${t('wp_power')}</div><div class="weapon-stat-value ${pc}">${fmtN(pp)}</div></div><div class="weapon-stat-item"><div class="weapon-stat-label">${t('wp_en')}</div><div class="weapon-stat-value">${ld.en}</div></div><div class="weapon-stat-item"><div class="weapon-stat-label">${t('wp_acc')}</div><div class="weapon-stat-value ${accCls}">${accD}%</div></div><div class="weapon-stat-item"><div class="weapon-stat-label">${t('wp_crit')}</div><div class="weapon-stat-value ${critCls}">${critD}%</div></div>${pa>0?`<div class="weapon-stat-item"><div class="weapon-stat-label">${t('wp_ammo')}</div><div class="weapon-stat-value ${ac2}">${pa}</div></div>`:''}</div>${(pt.length)||(x.usage_restrictions&&x.usage_restrictions.length)||x.is_map?`<div class="weapon-card-body">${pt.length?`<div>${renderWeaponTraitItemHtml(pt.filter(tr=>String(tr??'').trim()).join('\n'))}</div>`:''}${x.usage_restrictions&&x.usage_restrictions.length?`<div class="weapon-restrictions-list">${x.usage_restrictions.map(r=>`<div class="weapon-restriction-item">${esc(r)}</div>`).join('')}</div>`:''}${x.is_map?`<button class="toggle-map-btn" onclick="event.stopPropagation();toggleMapGrid('${x.id}')"><span>${t('view_effect_range')}</span></button><div id="map-${x.id}" class="map-grid-container">${renderMapGrid(x,unitData)}</div>`:''}</div>`:''}</div>`});h+=`</div></div>`;return h}
function renderMapGrid(weapon,unitData){
  // map_coords / shooting_coords from API. is_large → 2×2 nega tiles; map_single_pou → one Posi icon spanning 2×2 at (0,0) (Big Zam). Non-directional 2×2 uses UnitMarker_Moving per tile.
  let ec=weapon.map_coords||[],sc=weapon.shooting_coords||[],hs=sc.length>0;
  if(!ec.length)return'<div style="color:var(--text-muted);font-size:12px;text-align:center;margin-top:8px;">No data.</div>';

  const isLarge=!!(unitData&&unitData.is_large);
  const mapSinglePou=!!(weapon.map_single_pou);
  const fpOcc=isLarge?[{x:0,y:0},{x:1,y:0},{x:0,y:-1},{x:1,y:-1}]:[{x:0,y:0}];
  const fpMrk=(isLarge&&mapSinglePou)?[{x:0,y:0}]:fpOcc;
  const mapDashDualWide=!!(weapon.map_dash_dual_wide);
  const dashEndCells=(weapon.map_dash_dual_end_coords&&weapon.map_dash_dual_end_coords.length)?weapon.map_dash_dual_end_coords:null;

  let t1=false,t2=false,t3=false;
  if(!hs)t1=true;
  else if(weapon.is_dash)t3=true;
  else{
    let md=Math.min(...sc.map(c=>Math.abs(c.x)+Math.abs(c.y)));
    let eto=ec.some(c=>c.x===0&&c.y===0);
    if(md<=1&&!eto&&sc.length>1)t3=true;
    else t2=true
  }

  const dashEndCols=(t3&&mapDashDualWide)?[0,1]:[0];

  let sx=0,sy=0,ux=0,uy=0,ey=0,dashEndYDual=null;
  if(t3){
    let ac=ec.concat(sc);
    let my=Math.max(...ac.map(c=>c.y));
    if(dashEndCells){
      ey=my
    }else if(mapDashDualWide&&sc.length){
      dashEndYDual=Math.max(...sc.map(c=>c.y));
      ey=dashEndYDual
    }else{
      ey=my+1
    }
  }else if(t2){
    ux=0;uy=0;
    const topY=Math.max(...sc.map(c=>c.y));
    const topCells=sc.filter(c=>c.y===topY);
    topCells.sort((a,b)=>Math.abs(a.x)-Math.abs(b.x)||a.x-b.x);
    sx=topCells[0].x;sy=topCells[0].y
  }

  let mnx=Infinity,mxx=-Infinity,mny=Infinity,mxy=-Infinity;
  const uf=fpOcc;
  uf.forEach(c=>{if(c.x<mnx)mnx=c.x;if(c.x>mxx)mxx=c.x;if(c.y<mny)mny=c.y;if(c.y>mxy)mxy=c.y});
  ec.forEach(c=>{let x=t2?c.x+sx:c.x,y=t2?c.y+sy:c.y;if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y});
  if(t2||t3){
    sc.forEach(c=>{if(c.x<mnx)mnx=c.x;if(c.x>mxx)mxx=c.x;if(c.y<mny)mny=c.y;if(c.y>mxy)mxy=c.y})
  }
  if(t3&&!mapDashDualWide){
    dashEndCols.forEach(dx=>{let c={x:dx,y:ey};if(c.x<mnx)mnx=c.x;if(c.x>mxx)mxx=c.x;if(c.y<mny)mny=c.y;if(c.y>mxy)mxy=c.y});
  }

  let aw=mxx-mnx+1,fc=0;
  if(aw<3){fc=9}
  else if(aw>=8){fc=aw+4}
  else{fc=aw*3}
  let hpad=fc-aw;
  let padL=Math.ceil(hpad/2),padR=Math.floor(hpad/2);
  let fmnx=mnx-padL,fmxx=mxx+padR;
  let ah2=mxy-mny+1,py=Math.max(Math.floor(ah2/2),2);
  let fmny=mny-py,fmxy=mxy+py,fr=fmxy-fmny+1;

  let uxMin=mnx,uxMax=mxx,uyMin=mny,uyMax=mxy;
  if(fc>19){
    if(aw<=19){
      fc=19;
      hpad=fc-aw;
      padL=Math.ceil(hpad/2);padR=Math.floor(hpad/2);
      fmnx=mnx-padL;fmxx=mxx+padR;
    }else{
      fc=aw;
      fmnx=mnx;
      fmxx=mxx;
    }
  }
  if(fr>19){let df=fr-19;let cb=Math.ceil(df/2),ct=Math.floor(df/2);cb=Math.min(cb,Math.max(0,uyMin-fmny));ct=Math.min(ct,Math.max(0,fmxy-uyMax));fmny+=cb;fmxy-=ct;fr=19}

  let mapSpan=Math.max(fc,fr);
  if(mapSpan<=12)py=Math.max(Math.floor(ah2/2),2);
  else if(mapSpan<=16)py=Math.max(Math.floor(ah2*0.42),2);
  else py=Math.max(Math.floor(ah2/3),1);
  fmny=mny-py;fmxy=mxy+py;fr=fmxy-fmny+1;
  if(fr>19){let df=fr-19;let cb=Math.ceil(df/2),ct=Math.floor(df/2);cb=Math.min(cb,Math.max(0,uyMin-fmny));ct=Math.min(ct,Math.max(0,fmxy-uyMax));fmny+=cb;fmxy-=ct;fr=19}
  mapSpan=Math.max(fc,fr);
  const mapUid=unitData?String(unitData.main_unit_id||unitData.id||'').trim():'';
  const MAP_TRIM_LEFT_ONE_COL={1370004800:1,1009000300:1,1009000310:1};
  if(MAP_TRIM_LEFT_ONE_COL[mapUid]&&fc>aw&&fc-1>=aw){fmnx+=1;fc-=1}
  mapSpan=Math.max(fc,fr)

  const mapHighVisInit=weaponMapGridHighVisPreferred();
  let mapCell;
  if(mapSpan<=9)mapCell=30;
  else if(mapSpan<=12)mapCell=26;
  else if(mapSpan<=15)mapCell=22;
  else mapCell=20
  const pouCard=[[-1,0],[1,0],[0,-1],[0,1]];
  const pouWraps=t1?pouCard.every(([wx,wy])=>ec.some(e=>e.x===wx&&e.y===wy)):(t2&&pouCard.every(([wx,wy])=>ec.some(e=>e.x+sx===wx&&e.y+sy===wy)));
  const mapUsePosi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_UnitMarker_Posi.webp');
  const mapUseNega=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_UnitMarker_Nega.webp');
  const mapUseMovingWebp=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_UnitMarker_Moving.webp');
  const mapSelMarker=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_SelectMarker_Nega.webp');
  const mapSelHtml=`<span class="map-sel-crosshair" aria-hidden="true"><img class="map-sel-marker-img" src="${mapSelMarker}" alt=""></span>`;
  const step=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_StepMarker.webp');
  const themeTip=mapHighVisInit?t('map_effect_theme_light'):t('map_effect_theme_dark');
  const mapTileCls=(src)=>{const s=String(src);if(s.includes('Block_Posi'))return'map-cell--posi';if(s.includes('Block_Nega'))return'map-cell--nega';if(s.includes('Block_Moving'))return'map-cell--moving';return'map-cell--normal'};
  const mapSpanCat=mapSpan<=11?'s':(mapSpan>=17?'l':'m');
  let html=`<div class="weapon-map-grid-wrap${mapHighVisInit?' weapon-map-high-vis':''}" data-map-span="${mapSpanCat}"><div class="weapon-map-toolbar"><button type="button" class="weapon-map-theme-toggle" onclick="event.stopPropagation();toggleWeaponMapGridTheme(this)" title="${escAttr(themeTip)}" aria-label="${escAttr(themeTip)}" aria-pressed="${mapHighVisInit?'true':'false'}"><svg class="weapon-map-theme-ic weapon-map-theme-ic--moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="display:${mapHighVisInit?'none':'block'}"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><svg class="weapon-map-theme-ic weapon-map-theme-ic--sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="display:${mapHighVisInit?'block':'none'}"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></button></div><div class="weapon-map-grid" style="--map-cell:${mapCell}px;grid-template-columns:repeat(${fc},var(--map-cell));grid-template-rows:repeat(${fr},var(--map-cell));">`;

  for(let r=0;r<fr;r++){
    let cy=fmxy-r;
    for(let c=0;c<fc;c++){
      let cx=fmnx+c;
      let its=false,ieb=false,iem=false,ie=false,isp=false;
      let pouAnchorCls='';
      const iocc=fpOcc.some(p=>cx===p.x&&cy===p.y);
      const imrk=fpMrk.some(p=>cx===p.x&&cy===p.y);

      if(t2){
        its=(cx===sx&&cy===sy);
        ie=ec.some(e=>(e.x+sx===cx)&&(e.y+sy===cy));
        isp=sc.some(s=>s.x===cx&&s.y===cy)
      }else if(t3){
        ieb=dashEndCells?dashEndCells.some(p=>p.x===cx&&p.y===cy):(mapDashDualWide?(dashEndYDual!=null&&dashEndCols.some(dc=>cx===dc&&cy===dashEndYDual)):dashEndCols.some(dc=>cx===dc&&cy===ey));iem=ieb;
        ie=ec.some(e=>e.x===cx&&e.y===cy);
        isp=sc.some(s=>s.x===cx&&s.y===cy)
      }else{
        ie=ec.some(e=>e.x===cx&&e.y===cy)
      }

      let bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Nomal.webp'),mh='',oh='';

      if(t3){
        if(iocc){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Nega.webp');
          if(mapSinglePou&&imrk){
            pouAnchorCls=' map-cell--pou-2x2-anchor';
            mh=`<span class=\"map-pou-2x2-marker\" aria-hidden=\"true\"><img src=\"${mapUsePosi}\" alt=\"\"></span>`
          }else if(imrk){
            mh=`<span class=\"map-cell-marker-shell\" aria-hidden=\"true\"><img src=\"${mapUseMovingWebp}\" alt=\"\"></span>`
          }
        }else if(ieb){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Moving.webp');
          if(iem)mh=`<span class=\"map-cell-marker-shell\" aria-hidden=\"true\"><img src=\"${mapUseMovingWebp}\" alt=\"\"></span>`
        }else if(ie||isp){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Posi.webp')
        }

        // Dash path step markers: center column, or both columns for 2×2 dual-line MAP.
        if(isp&&!iocc&&!ieb&&(mapDashDualWide?(cx===0||cx===1):cx===0)){
          oh=`<span class=\"map-cell-marker-shell map-cell-marker-shell--step\" aria-hidden=\"true\"><img class=\"map-cell-step-marker\" src=\"${step}\" alt=\"\"></span>`
        }
      }else if(t2){
        if(its){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Posi.webp');
          mh=iocc?`<span class=\"map-cell-marker-shell\" aria-hidden=\"true\"><img src=\"${mapUseNega}\" alt=\"\"></span>`+mapSelHtml:mapSelHtml
        }else if(iocc){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Nega.webp');
          if(mapSinglePou&&imrk){
            pouAnchorCls=' map-cell--pou-2x2-anchor';
            mh=`<span class=\"map-pou-2x2-marker\" aria-hidden=\"true\"><img src=\"${mapUsePosi}\" alt=\"\"></span>`
          }else if(imrk){
            mh=`<span class=\"map-cell-marker-shell\" aria-hidden=\"true\"><img src=\"${mapUseNega}\" alt=\"\"></span>`
          }
        }else if(ie){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Posi.webp')
        }else if(isp){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Nega.webp')
        }
      }else{
        if(iocc){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Nega.webp');
          if(mapSinglePou&&imrk){
            pouAnchorCls=' map-cell--pou-2x2-anchor';
            mh=`<span class=\"map-pou-2x2-marker\" aria-hidden=\"true\"><img src=\"${mapUsePosi}\" alt=\"\"></span>`
          }else if(imrk){
            mh=`<span class=\"map-cell-marker-shell\" aria-hidden=\"true\"><img src=\"${isLarge?mapUseMovingWebp:(pouWraps?mapUsePosi:mapUseMovingWebp)}\" alt=\"\"></span>`
          }
        }else if(ie){
          bi=imgUrl('/static/images/UI/Sprite/UI_Common_Dialog_Block_Posi.webp')
        }
      }

      const cellRaise=(t2&&its)?'isolation:isolate;z-index:8;':'';
      html+=`<div class=\"map-cell ${mapTileCls(bi)}${pouAnchorCls}\" style=\"width:${mapCell}px;height:${mapCell}px;position:relative;--map-cell:${mapCell}px;${cellRaise}\"><img class=\"weapon-map-cell-tile\" src=\"${bi}\" alt=\"\" onerror=\"this.style.display='none'\">${oh}${mh}</div>`
    }
  }

  html+='</div>';
  const legendPouSrc=t2?mapUseNega:(mapSinglePou?mapUsePosi:(isLarge?mapUseMovingWebp:(pouWraps?mapUsePosi:mapUseMovingWebp)));
  const legUse='<span class="weapon-map-legend-item" role="listitem"><img class="map-legend-use-img" src="'+legendPouSrc+'" width="14" height="14" alt="" style="vertical-align:middle;object-fit:contain"> '+t('map_legend_use')+'</span>';
  const legEffect='<span class="weapon-map-legend-item" role="listitem"><span style="display:inline-block;width:10px;height:10px;background:#59a8f0;border-radius:2px" aria-hidden="true"></span> '+t('map_legend_effect')+'</span>';
  if(t2){
    html+='<div class="weapon-map-legend" role="list">'+legUse+
    '<span class="weapon-map-legend-item" role="listitem"><img class="map-legend-sel-img" src="'+mapSelMarker+'" width="14" height="14" alt="" style="vertical-align:middle;object-fit:contain"> '+t('map_legend_sel')+'</span>'+
    '<span class="weapon-map-legend-item" role="listitem"><span style="display:inline-block;width:10px;height:10px;background:#203a6e;border:1px solid #152a52;border-radius:2px" aria-hidden="true"></span> '+t('map_legend_range')+'</span>'+
    legEffect+
    '</div>'
  }else if(t1){
    html+='<div class="weapon-map-legend" role="list">'+legUse+legEffect+'</div>'
  }
  html+='</div>';
  return html
}
function esc(s){if(s===null||s===undefined)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}
function escAttr(s){if(s===null||s===undefined)return'';return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function escJs(s){return String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n')}
function _ensureNpcCardVisible(el){
if(!el)return;
const outer=el.closest('details.stage-npc-group');
if(outer&&!outer.open)outer.open=true;
const panel=el.closest('.stage-npc-tab-panel');
if(panel&&panel.classList.contains('hidden')){
const wrap=panel.closest('[data-stage-npc-group]');
if(wrap){
const gid=wrap.getAttribute('data-stage-npc-group')||'';
const panels=Array.from(wrap.querySelectorAll('.stage-npc-tab-panel'));
const tabIdx=panels.indexOf(panel);
if(tabIdx>=0&&gid){
const btn=document.getElementById('sn-tab-'+gid+'-'+tabIdx);
if(btn)switchStageNpcTab(btn)
}
}
}
}
function _flashNpcCard(el){
if(!el)return;
el.classList.add('npc-card-highlight');
setTimeout(()=>el.classList.remove('npc-card-highlight'),1200);
}
function findNpcDetailCardByNpcId(nid){
const raw=String(nid!=null?nid:'').trim();
if(!raw)return null;
const root=document.getElementById('detailNpcContainer');
if(!root)return null;
const nodes=root.querySelectorAll('.npc-card[data-npc-id]');
for(let i=0;i<nodes.length;i++){
const n=nodes[i];
if(String(n.getAttribute('data-npc-id')||'').trim()===raw)return n;
}
return null;
}
function scrollToNpcDetailByNpcId(nid){
const el=findNpcDetailCardByNpcId(nid);
if(!el)return false;
_ensureNpcCardVisible(el);
setTimeout(()=>{try{el.scrollIntoView({behavior:'smooth',block:'start'})}catch(_){}_flashNpcCard(el)},0);
return true;
}
function scrollToNpc(id){scrollToNpcDetailByNpcId(id)}
function scrollToNpcDetail(idx){
try{
const el=document.getElementById('npc-detail-'+String(idx));
if(!el)return false;
_ensureNpcCardVisible(el);
setTimeout(()=>{try{el.scrollIntoView({behavior:'smooth',block:'start'})}catch(_){}_flashNpcCard(el)},0);
return true;
}catch(e){return false}
}
function onStageMapUnitClick(detailIdx,ev,unitId,npcId){
if(ev)ev.stopPropagation();
const nid=npcId!=null&&String(npcId).trim()!==''?String(npcId).trim():'';
if(detailIdx!=null&&detailIdx!=='null'&&String(detailIdx).trim()!==''){
const i=parseInt(detailIdx,10);
if(!Number.isNaN(i)){
if(scrollToNpcDetail(i))return;
if(scrollToNpcDetail(i-1))return;
if(scrollToNpcDetail(i+1))return;
if(scrollToNpcDetail(i+2))return;
if(scrollToNpcDetail(i-2))return;
}
}
if(nid&&scrollToNpcDetailByNpcId(nid))return;
}
function wireStageMapNpcClicks(){
const dm=document.getElementById('detailModal');
if(!dm||dm.dataset.stageMapNpcWired==='1')return;
dm.dataset.stageMapNpcWired='1';
dm.addEventListener('click',function(e){
const cell=e.target&&e.target.closest&&e.target.closest('#stageMapGridWrap .map-cell.npc-clickable');
if(!cell)return;
e.stopPropagation();
let detailIdx=null;
const rawD=cell.getAttribute('data-npc-map-detail');
if(rawD!=null&&String(rawD).trim()!==''){
const n=parseInt(rawD,10);
if(!Number.isNaN(n))detailIdx=n;
}
const npcId=String(cell.getAttribute('data-npc-map-npc-id')||'').trim();
const unitId=String(cell.getAttribute('data-npc-map-unit-id')||'').trim();
onStageMapUnitClick(detailIdx,e,unitId,npcId);
});
}
function fmtN(n){return n!=null?Number(n).toLocaleString():'0'}

const CMP_COLORS=['#e67e22','#2ecc71','#e74c3c'];
const CMP_COLORS_ALPHA=['rgba(230,126,34,.25)','rgba(46,204,113,.25)','rgba(231,76,60,.25)'];

function toggleCompare(type,id,name,thum,ev){
if(ev){ev.stopPropagation();ev.preventDefault()}
const idx=S.compareList.findIndex(c=>String(c.id)===String(id));
if(idx>=0){S.compareList.splice(idx,1);delete S.cmpLbByUnit[id];delete S.cmpLbByUnit[String(id)]}
else{
if(S.compareList.length&&S.compareList[0].type!==type){S.compareList=[];S.cmpLbByUnit={};S.compareType=type}
if(S.compareList.length>=3)return;
S.compareType=type;
S.compareList.push({id,type,name,thum});
if(type==='unit'&&S.cmpLbByUnit[id]===undefined)S.cmpLbByUnit[id]=3
}
updateCompareUI()
}

function clearCompareList(){S.compareList=[];S.compareData=[];S.cmpLbByUnit={};updateCompareUI()}

function _cmpCompareFloatShouldShow(cnt){
if(cnt<=0)return false;
try{if(window.matchMedia('(max-width:768px)').matches)return document.documentElement.classList.contains('cmp-mobile-pick')}catch(_){}
return true;
}
function syncCmpMobilePickChrome(){
const on=!!S.cmpMobilePickMode;
document.documentElement.classList.toggle('cmp-mobile-pick',on);
['charCmpPickToggle','unitCmpPickToggle'].forEach(id=>{
const el=document.getElementById(id);
if(el){el.classList.toggle('is-on',on);el.setAttribute('aria-pressed',on?'true':'false')}
});
}
function toggleCmpMobilePickMode(){
S.cmpMobilePickMode=!S.cmpMobilePickMode;
syncCmpMobilePickChrome();
updateCompareUI();
}
function updateCompareUI(){
updateCmpBrowserInset();
const bar=document.getElementById('cmpFloat');
const cnt=S.compareList.length;
if(bar)bar.classList.toggle('visible',_cmpCompareFloatShouldShow(cnt));
document.getElementById('cmpFloatCount').textContent=`⚔ ${t('cmp_compare')} ${cnt}/3`;
const btn=document.getElementById('cmpFloatBtn');
btn.disabled=cnt<2;
btn.textContent=`${t('cmp_compare')} (${cnt})`;
const selectedIds=new Set(S.compareList.map(c=>String(c.id)));
document.querySelectorAll('.cmp-cb').forEach(cb=>{
const isSelected=selectedIds.has(String(cb.dataset.cmpId));
cb.checked=isSelected;
cb.disabled=!isSelected&&cnt>=3
})
}

function injectCompareCheckboxes(tbodyId,type){
const tbody=document.getElementById(tbodyId);
if(!tbody)return;
const rows=tbody.querySelectorAll('tr');
rows.forEach(tr=>{
if(tr.querySelector('.cmp-cb-cell'))return;
const onclick=tr.getAttribute('onclick')||'';
const idMatch=onclick.match(/openDetail\(\s*'(?:unit|character)'\s*,\s*'([^']+)'/);
if(!idMatch)return;
const id=idMatch[1];
const nameEl=tr.querySelector('.name-text');
const name=nameEl?nameEl.textContent:'';
const thumEl=tr.querySelector('.list-thumb-portrait')||tr.querySelector('.row-thum');
const thum=thumEl?thumEl.getAttribute('src'):'';
const td=document.createElement('td');
td.className='cmp-cb-cell';
const tdInner=document.createElement('div');
tdInner.className='cmp-cb-inner';
const cb=document.createElement('input');
cb.type='checkbox';
cb.className='cmp-cb';
cb.dataset.cmpId=id;
cb.checked=S.compareList.some(c=>String(c.id)===String(id));
cb.addEventListener('click',e=>{e.stopPropagation();toggleCompare(type,id,name,thum)});
cb.addEventListener('change',e=>e.stopPropagation());
tdInner.appendChild(cb);
td.appendChild(tdInner);
tr.insertBefore(td,tr.firstChild)
})
}

function wireGridCompareCheckboxes(gridId,cmpType){
const grid=document.getElementById(gridId);
if(!grid)return;
grid.querySelectorAll('.cmp-cb-grid').forEach(cb=>{
const card=cb.closest('.list-grid-card--cmp');
if(!card)return;
const id=cb.dataset.cmpId;
const nameEl=card.querySelector('.list-grid-card-name');
const name=nameEl?nameEl.textContent:'';
const thumEl=card.querySelector('.list-thumb-portrait');
const thum=thumEl?thumEl.getAttribute('src'):'';
const cnt=S.compareList.length;
const selected=S.compareList.some(c=>String(c.id)===String(id));
cb.checked=selected;
cb.disabled=!selected&&cnt>=3;
cb.onclick=function(e){e.stopPropagation();toggleCompare(cmpType,id,name,thum)};
})
}

const _origRenderUnitT=renderUnitT;
renderUnitT=function(data){_origRenderUnitT(data);if(getListViewMode('units')==='table')setTimeout(()=>injectCompareCheckboxes('unitBody','unit'),0)};
const _origRenderCharT=renderCharT;
renderCharT=function(data){_origRenderCharT(data);if(getListViewMode('characters')==='table')setTimeout(()=>injectCompareCheckboxes('charBody','character'),0)};

const _origBuildTableHeaders=buildTableHeaders;
buildTableHeaders=function(){_origBuildTableHeaders();
['charThead','unitThead'].forEach(id=>{
const thead=document.getElementById(id);
if(!thead)return;
const tr=thead.querySelector('tr');
if(!tr||tr.querySelector('.cmp-cb-cell'))return;
const th=document.createElement('th');
th.className='cmp-cb-cell';
th.style.cssText='cursor:default;font-size:14px;';
const thInner=document.createElement('div');
thInner.className='cmp-cb-inner';
thInner.textContent='⚔';
th.appendChild(thInner);
tr.insertBefore(th,tr.firstChild)
})
};

async function openCompareModal(){
if(S.compareList.length<2)return;
updateCmpBrowserInset();
S.cmpSpActive=false;S.cmpSspActive=false;
S.compareList.forEach(c=>{if(S.cmpLbByUnit[c.id]===undefined)S.cmpLbByUnit[c.id]=3});
const overlay=document.getElementById('cmpOverlay');
overlay.classList.add('active');
applyBackgroundScrollLock();
document.getElementById('cmpBody').innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';
document.getElementById('cmpTitle').textContent=S.compareType==='character'?t('cmp_char_compare'):t('cmp_unit_compare');
try{
const fetches=S.compareList.map(c=>{
const url=c.type==='character'?`/api/character/${c.id}?lang=${S.lang}`:`/api/unit/${c.id}?lang=${S.lang}`;
return fetch(url).then(r=>r.json())
});
S.compareData=await Promise.all(fetches);
renderCompareContent()
}catch(e){
document.getElementById('cmpBody').innerHTML='<div class="empty-state"><div class="empty-state-text">Failed to load data</div></div>'
}
}

function closeCompareModal(){
document.getElementById('cmpOverlay').classList.remove('active');
updateCmpBrowserInset();
releaseBackgroundScrollLock()
}

function renderCompareContent(){
renderCompareLegend();
renderCompareHeader();
renderCompareToggles();
const isUnit=S.compareType==='unit';
const bodyHtml=`
<div class="cmp-section"><div class="cmp-section-title">${t('cmp_stats')}</div><div id="cmpStats"></div></div>
<div class="cmp-section"><div class="cmp-section-title">${t('cmp_radar')}</div><div class="cmp-radar-wrap"><canvas id="cmpRadarCanvas" width="420" height="380"></canvas></div></div>
${isUnit?`<div class="cmp-section"><div class="cmp-section-title">${t('cmp_terrain')}</div><div id="cmpTerrain"></div></div>`:''}
<div class="cmp-section"><div class="cmp-section-title">${t('cmp_abilities')}</div><div id="cmpAbilities"></div></div>
${isUnit?`<div class="cmp-section"><div class="cmp-section-title">${t('cmp_weapons')}</div><div id="cmpWeapons"></div></div>`:''}
${!isUnit?`<div class="cmp-section"><div class="cmp-section-title">${t('cmp_skills')}</div><div id="cmpSkills"></div></div>`:''}
`;
document.getElementById('cmpBody').innerHTML=bodyHtml;
renderCompareDynamic()
}

function renderCompareDynamic(){
renderCompareStats();
setTimeout(()=>drawRadarChart(),50);
if(S.compareType==='unit'){renderCompareTerrain();renderCompareWeapons()}
renderCompareAbilities();
if(S.compareType==='character')renderCompareSkills()
}

function renderCompareToggles(){
const hasSp=S.compareData.some(d=>d.has_sp);
if(!hasSp){document.getElementById('cmpToggles')&&(document.getElementById('cmpToggles').innerHTML='');return}
const isUnit=S.compareType==='unit';
const spIcon=imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp');
const sspIcon=imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp');
let html='<div class="cmp-toggles" id="cmpToggles">';
html+=`<span class="cmp-toggle-label">Mode:</span>`;
html+=`<button class="cmp-toggle-btn${S.cmpSpActive?' active':''}" onclick="toggleCmpSp()"><img src="${spIcon}" alt="SP"></button>`;
if(isUnit) html+=`<button class="cmp-toggle-btn${S.cmpSspActive?' active':''}" onclick="toggleCmpSsp()"><img src="${sspIcon}" alt="SSP"></button>`;
html+='</div>';
const existing=document.getElementById('cmpToggles');
if(existing){existing.outerHTML=html}
else{
const header=document.getElementById('cmpHeader');
if(header)header.insertAdjacentHTML('afterend',html)
}
}

function toggleCmpSp(){
if(S.cmpSpActive){S.cmpSpActive=false}else{S.cmpSpActive=true;S.cmpSspActive=false}
renderCompareToggles();renderCompareDynamic()
}
function toggleCmpSsp(){
if(S.cmpSspActive){S.cmpSspActive=false}else{S.cmpSspActive=true;S.cmpSpActive=false}
renderCompareToggles();renderCompareDynamic()
}

function renderCompareLegend(){
document.getElementById('cmpLegend').innerHTML=S.compareData.map((d,i)=>
`<div class="cmp-legend-item"><div class="cmp-legend-dot" style="background:${CMP_COLORS[i]}"></div>${esc(d.name)}</div>`
).join('')
}

function getCmpLbTierForUnit(uid){const v=S.cmpLbByUnit[uid];return v===undefined?3:Math.min(3,Math.max(0,parseInt(v,10)||0))}
function updateCmpLbForUnit(uid,val){S.cmpLbByUnit[uid]=Math.min(3,Math.max(0,parseInt(val,10)||0));renderCompareHeader();renderCompareDynamic()}
function pickCmpLbTier(uid,tier){updateCmpLbForUnit(uid,tier)}
function renderCompareHeader(){
const ct=S.compareType;
let html=S.compareData.map((d,i)=>{
const row={thum:d.thum||d.portrait||S.compareList[i].thum||'',rarity:d.rarity||'N',role_icon:d.role_icon,acquisition_icon:d.acquisition_icon||''};
const thumHtml=renderListThumb(row,ct==='character'?'char':'unit',72);
const tid=getCmpLbTierForUnit(d.id);
const cur=cmpLbPipsAtTier(tid);
const lbMenu=[0,1,2,3].map(t=>{const p=cmpLbPipsAtTier(t);return`<button type="button" class="cmp-lb-opt${tid===t?' is-active':''}" onclick="pickCmpLbTier('${escJs(d.id)}',${t})" role="option" aria-selected="${tid===t}">${cmpLbPipsRow(p[0],p[1],p[2])}<span class="cmp-lb-opt-num">${t}</span></button>`}).join('');
const lbDrop=ct==='unit'&&!d.is_ultimate?`<div class="cmp-card-lb"><span class="cmp-card-lb-label">${t('cmp_lb')}</span><details class="cmp-lb-details"><summary class="cmp-lb-summary" title="${esc(t('cmp_lb'))}">${cmpLbPipsRow(cur[0],cur[1],cur[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${esc(t('cmp_lb'))}">${lbMenu}</div></details></div>`:'';
return`<div class="cmp-card" style="border-top:3px solid ${CMP_COLORS[i]}">
<div class="cmp-card-thum-wrap">${thumHtml}</div><div class="cmp-card-name">${esc(d.name)}</div>${lbDrop}
<button class="cmp-card-remove" onclick="removeFromCompare('${d.id}')">${t('cmp_remove')}</button></div>`
}).join('');
if(S.compareData.length<3){
const addLabel=S.compareType==='character'?t('cmp_add_char'):t('cmp_add_unit');
html+=`<div class="cmp-add-slot" onclick="openCompPicker()"><div class="cmp-add-slot-icon">+</div><div class="cmp-add-slot-text">${addLabel}</div></div>`
}
document.getElementById('cmpHeader').innerHTML=html
}

function removeFromCompare(id){
delete S.cmpLbByUnit[id];
S.compareList=S.compareList.filter(c=>c.id!==id);
S.compareData=S.compareData.filter(d=>d.id!==id);
updateCompareUI();
if(S.compareData.length<2){closeCompareModal();return}
renderCompareContent()
}

function getCompareStats(){
if(S.compareType==='character'){
return S.compareData.map(d=>{
let stats;
if(S.cmpSpActive&&d.has_sp&&d.sp_stats){stats=d.sp_stats}
else{stats=d.stats||[]}
return stats.map(s=>({name:s.name,value:s.total}))
})
}
return S.compareData.map(d=>{
const lb=d.lb_data;
const maxIdx=lb&&lb.length?lb.length-1:0;
const tier=Math.min(Math.max(0,getCmpLbTierForUnit(d.id)),maxIdx);
const td=(lb&&lb[tier])||(d.stats&&{stats_no_cond:d.stats,sp_stats_no_cond:d.stats,ssp_stats_no_cond:d.stats});
if(!td)return[];
let stats;
if(S.cmpSspActive&&d.has_sp){stats=td.ssp_stats_no_cond||td.stats_no_cond}
else if(S.cmpSpActive&&d.has_sp){stats=td.sp_stats_no_cond||td.stats_no_cond}
else{stats=td.stats_no_cond}
return(stats||[]).map(s=>({name:s.name,value:s.total}))
})
}

function renderCompareStats(){
const allStats=getCompareStats();
if(!allStats.length||!allStats[0].length)return;
const statNames=allStats[0].map(s=>s.name);
let html='<table class="cmp-stat-table"><thead><tr><th></th>';
S.compareData.forEach((d,i)=>html+=`<th><div class="cmp-stat-cell"><div class="cmp-stat-bar" style="background:${CMP_COLORS[i]}"></div><span style="font-size:13px;font-weight:600;color:var(--text-secondary)">${esc(d.name)}</span></div></th>`);
html+='</tr></thead><tbody>';
statNames.forEach((name,si)=>{
const values=allStats.map(s=>(s[si]?s[si].value:0));
const bestIdx=values.reduce((bi,v,i)=>v>values[bi]?i:bi,0);
const allSame=values.every(v=>v===values[0]);
html+=`<tr><td>${tStat(name,S.compareType)}</td>`;
values.forEach((v,i)=>{
const isBest=!allSame&&i===bestIdx;
html+=`<td><div class="cmp-stat-cell${isBest?' best':''}"><div class="cmp-stat-bar" style="background:${CMP_COLORS[i]}"></div><span class="cmp-stat-val">${fmtN(v)}</span></div></td>`
});
html+='</tr>'
});
html+='</tbody></table>';
document.getElementById('cmpStats').innerHTML=html
}

function drawRadarChart(){
const canvas=document.getElementById('cmpRadarCanvas');
if(!canvas)return;
const ctx=canvas.getContext('2d');
const dpr=window.devicePixelRatio||1;
const W=420,H=380;
canvas.width=W*dpr;canvas.height=H*dpr;
canvas.style.width=W+'px';canvas.style.height=H+'px';
ctx.scale(dpr,dpr);
ctx.clearRect(0,0,W,H);
const allStats=getCompareStats();
if(!allStats.length||!allStats[0].length)return;
const labels=allStats[0].map(s=>tStat(s.name,S.compareType));
const n=labels.length;
const cx=W/2,cy=H/2-10,R=130;
const angleOff=-Math.PI/2;
const angles=labels.map((_,i)=>angleOff+(2*Math.PI*i)/n);
for(let ring=1;ring<=5;ring++){
const r=R*ring/5;
ctx.beginPath();
for(let i=0;i<n;i++){
const x=cx+r*Math.cos(angles[i]),y=cy+r*Math.sin(angles[i]);
i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
}
ctx.closePath();
ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.stroke()
}
for(let i=0;i<n;i++){
ctx.beginPath();ctx.moveTo(cx,cy);
ctx.lineTo(cx+R*Math.cos(angles[i]),cy+R*Math.sin(angles[i]));
ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.stroke()
}
const maxVals=labels.map((_,si)=>Math.max(...allStats.map(s=>s[si]?s[si].value:0))||1);
allStats.forEach((stats,di)=>{
ctx.beginPath();
stats.forEach((s,si)=>{
const norm=Math.min(s.value/maxVals[si],1);
const r2=R*Math.max(norm,0.03);
const x=cx+r2*Math.cos(angles[si]),y=cy+r2*Math.sin(angles[si]);
si===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
});
ctx.closePath();
ctx.fillStyle=CMP_COLORS_ALPHA[di];ctx.fill();
ctx.strokeStyle=CMP_COLORS[di];ctx.lineWidth=2;ctx.stroke()
});
allStats.forEach((stats,di)=>{
stats.forEach((s,si)=>{
const norm=Math.min(s.value/maxVals[si],1);
const r2=R*Math.max(norm,0.03);
const x=cx+r2*Math.cos(angles[si]),y=cy+r2*Math.sin(angles[si]);
ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);
ctx.fillStyle=CMP_COLORS[di];ctx.fill()
})
});
ctx.textAlign='center';ctx.textBaseline='middle';
ctx.font='bold 13px ShinGoPr6DeBold,sans-serif';ctx.fillStyle='#c8cdd8';
labels.forEach((lbl,i)=>{
const lr=R+22;
const x=cx+lr*Math.cos(angles[i]),y=cy+lr*Math.sin(angles[i]);
ctx.fillText(lbl,x,y)
})
}

function renderCompareTerrain(){
const el=document.getElementById('cmpTerrain');
if(!el)return;
const terrainNames=['Space','Atmospheric','Ground','Sea','Underwater'];
let html='<table class="cmp-terrain-table"><thead><tr><th></th>';
S.compareData.forEach(d=>{html+=`<th>${esc(d.name)}</th>`});
html+='</tr></thead><tbody>';
terrainNames.forEach(tn=>{
html+=`<tr><td>${tTerrain(tn)}</td>`;
S.compareData.forEach(d=>{
const useSsp=S.cmpSspActive&&d.terrain_ssp&&d.terrain_ssp.length;
const terArr=useSsp?d.terrain_ssp:(d.terrain||[]);
const ter=terArr.find(t2=>t2.name===tn);
if(ter){
const enhCls=ter.ssp_enhanced?' style="text-shadow:0 0 6px rgba(255,215,0,.5)"':'';
html+=`<td><span class="cmp-terrain-symbol level-${ter.level}"${enhCls}>${ter.symbol||'-'}</span></td>`
}else{html+=`<td>-</td>`}
});
html+='</tr>'
});
html+='</tbody></table>';
el.innerHTML=html
}

function renderCompareWeapons(){
const el=document.getElementById('cmpWeapons');
if(!el)return;
const colCls=S.compareData.length===2?'cols-2':'cols-3';
const isSsp=S.cmpSspActive;
let html=`<div class="cmp-wpn-grid ${colCls}">`;
S.compareData.forEach((d,i)=>{
html+=`<div><div class="cmp-wpn-col-title" style="color:${CMP_COLORS[i]}">${esc(d.name)}</div>`;
let weapons=(d.weapons||[]).filter(w=>isSsp||!w.is_ssp_weapon);
if(!weapons.length){html+=`<div class="cmp-wpn-item" style="color:var(--text-muted)">-</div>`}
else{
weapons.forEach(w=>{
const attr=w.attribute?esc('<'+w.attribute+'>'):'';
const pwr=w.power?w.power:0;
const sspPwrBonus=isSsp&&w.ssp_power_bonus?w.ssp_power_bonus:0;
const totalPwr=pwr+sspPwrBonus;
const isMapW=w.weapon_type==='3'||w.is_map;
const range=w.min_range!==undefined?`${t('wp_range')}:${isMapW?'MAP':w.min_range+'-'+(w.max_range+(isSsp&&w.ssp_range_bonus?w.ssp_range_bonus:0))}`:'';
const pwrStr=totalPwr?`${t('wp_power')}:${fmtN(totalPwr)}`:'';
const en=w.en_cost?`EN:${w.en_cost}`:'';
const parts=[attr,range,pwrStr,en].filter(Boolean).join(' / ');
const nameStyle=w.is_ex?'color:#ff6b6b;':(w.is_ssp_weapon?'color:#a855f7;':'');
html+=`<div class="cmp-wpn-item"><span class="cmp-wpn-name" style="${nameStyle}">${esc(w.name)}</span> <span class="cmp-wpn-attr">${parts}</span></div>`
})
}
html+='</div>'
});
html+='</div>';
el.innerHTML=html
}

function renderCompareAbilities(){
const el=document.getElementById('cmpAbilities');
if(!el)return;
const colCls=S.compareData.length===2?'cols-2':'cols-3';
const isUnit=S.compareType==='unit';
const isSsp=S.cmpSspActive;
const isSp=S.cmpSpActive;
let html=`<div class="cmp-abil-grid ${colCls}">`;
S.compareData.forEach((d,i)=>{
html+=`<div><div class="cmp-abil-col-title" style="color:${CMP_COLORS[i]}">${esc(d.name)}</div>`;
const abils=d.abilities||[];
if(!abils.length){html+=`<div class="cmp-abil-item" style="color:var(--text-muted)">-</div>`}
else{
abils.forEach(ba=>{
if(isUnit&&ba.ssp_only&&!isSsp)return;
if(isUnit&&!isSsp&&ba.ssp_replacement&&isUnknownAbilityName(ba.name))return;
if(!isUnit&&!isSp&&ba.sp_replacement&&isUnknownAbilityName(ba.name))return;
let ab=ba;
let badge='';
if(isUnit&&isSsp&&ba.ssp_only){ab=ba;badge=`<img src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP">`}
else if(isUnit&&isSsp&&ba.ssp_replacement){ab=ba.ssp_replacement;badge=`<img src="${imgUrl('/static/images/UI/UI_Common_Icon_Ssp.webp')}" alt="SSP">`}
else if(isSp&&ba.sp_replacement){ab=ba.sp_replacement;badge=`<img src="${imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp')}" alt="SP">`}
html+=`<div class="cmp-abil-item"><div class="cmp-abil-name">${badge}${esc(ab.name)}</div>`;
(ab.details||[]).forEach(det=>{
const txt=typeof det==='string'?det:(det.text||'');
if(txt)html+=`<div class="cmp-abil-detail">${esc(txt)}</div>`
});
html+=`</div>`
})
}
html+='</div>'
});
html+='</div>';
el.innerHTML=html
}

function renderCompareSkills(){
const el=document.getElementById('cmpSkills');
if(!el)return;
const colCls=S.compareData.length===2?'cols-2':'cols-3';
const isSp=S.cmpSpActive;
let html=`<div class="cmp-abil-grid ${colCls}">`;
S.compareData.forEach((d,i)=>{
html+=`<div><div class="cmp-abil-col-title" style="color:${CMP_COLORS[i]}">${esc(d.name)}</div>`;
const skills=d.skills||[];
const vs=skills.filter(sk=>isSp?sk.is_sp||!sk.replaced_by_sp:!sk.is_sp);
if(!vs.length){html+=`<div class="cmp-abil-item" style="color:var(--text-muted)">-</div>`}
else{
vs.forEach(sk=>{
const badge=sk.is_sp?`<img src="${imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp')}" alt="SP">`:'';
html+=`<div class="cmp-abil-item"><div class="cmp-abil-name">${badge}${esc(sk.name)}</div>`;
(sk.details||[]).forEach(det=>{
const txt=typeof det==='string'?det:(det.text||'');
if(txt)html+=`<div class="cmp-abil-detail">${esc(txt)}</div>`
});
html+=`</div>`
})
}
html+='</div>'
});
html+='</div>';
el.innerHTML=html
}

function resetCompare(){
S.compareList=[];S.compareData=[];S.cmpLbByUnit={};
updateCompareUI();closeCompareModal()
}

function openCompPicker(){
const pickerOverlay=document.getElementById('cmpPickerOverlay');
pickerOverlay.classList.add('active');
document.getElementById('cmpPickerSearch').value='';
document.getElementById('cmpPickerSearch').placeholder=S.compareType==='character'?t('cmp_search_char'):t('cmp_search_unit');
document.getElementById('cmpPickerBody').innerHTML=`<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:15px;">${t('cmp_type_to_search')}</div>`;
document.getElementById('cmpPickerSearch').focus();
}

function closeCompPicker(){document.getElementById('cmpPickerOverlay').classList.remove('active')}

function filterCompPicker(){clearTimeout(S._cmpPickerDebounce);S._cmpPickerDebounce=setTimeout(()=>searchCompPicker(),280)}

async function searchCompPicker(){
const q=document.getElementById('cmpPickerSearch').value.trim();
const body=document.getElementById('cmpPickerBody');
if(!q){body.innerHTML=`<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:15px;">${t('cmp_type_to_search')}</div>`;return}
body.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';
try{
const base=S.compareType==='character'?'/api/characters':'/api/units';
const r=await fetch(`${base}?lang=${S.lang}&page=1&per_page=100&sort=rarity&dir=desc&q=${encodeURIComponent(q)}`);
const d=await r.json();
const items=d.rows||[];
if(!items.length){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">No results</div>';return}
const existing=new Set(S.compareList.map(c=>c.id));
body.innerHTML=items.slice(0,100).map(r=>{
const already=existing.has(r.id);
const badges=`<span class="cmp-picker-badge-text">${esc(r.rarity||'')}</span><span class="cmp-picker-badge-text">${esc(r.role||'')}</span>`;
return`<div class="cmp-picker-item${already?' already':''}" onclick="pickCompItem('${r.id}','${escJs(r.name)}','')">
<div><div class="cmp-picker-item-name">${esc(r.name)}</div><div class="cmp-picker-item-badges">${badges}</div></div></div>`
}).join('')
}catch(e){body.innerHTML='<div class="empty-state"><div class="empty-state-text">Failed to load</div></div>'}
}

async function pickCompItem(id,name,thum){
if(S.compareList.length>=3)return;
if(S.compareList.some(c=>c.id===id))return;
S.compareList.push({id,type:S.compareType,name,thum});
if(S.compareType==='unit'&&S.cmpLbByUnit[id]===undefined)S.cmpLbByUnit[id]=3;
updateCompareUI();
closeCompPicker();
const url=S.compareType==='character'?`/api/character/${id}?lang=${S.lang}`:`/api/unit/${id}?lang=${S.lang}`;
try{
const r=await fetch(url);const d=await r.json();
S.compareData.push(d);
renderCompareContent()
}catch(e){}
}

const DC_ATK_TYPE_LABEL_MAP={'Ranged':'Ranged','Melee':'Melee','Awaken':'Awaken','Attack':'Melee'};
/** Same keys as app.py ATTACK_ATTR_TYPES — used when attack_types is empty (manual weapons / edge API). */
const DC_ATTACK_ATTR_TO_KEYS={'1':['Ranged'],'2':['Melee'],'3':['Awaken'],'4':['Ranged','Melee'],'5':['Ranged','Awaken'],'6':['Melee','Awaken'],'7':['Ranged','Melee','Awaken']};
function _dcWeaponAtkStatKeys(wpn){
let atkTypes=(wpn.attack_types||[]).map(at=>{const lbl=at.label||'';return DC_ATK_TYPE_LABEL_MAP[lbl]||null}).filter(Boolean);
if(!atkTypes.length){
const aa=String(wpn.attack_attribute||wpn.attackAttribute||'').trim();
const keys=DC_ATTACK_ATTR_TO_KEYS[aa];
if(keys&&keys.length)atkTypes=keys.slice();
}
if(!atkTypes.length)atkTypes.push('Ranged');
return atkTypes;
}
const DC_MP={medium:{dmgBonus:0,critMult:0.10},high:{dmgBonus:0.10,critMult:0.20},max:{dmgBonus:0.20,critMult:0.20},super:{dmgBonus:0.30,critMult:0.30}};
function _dcNormMpLevel(lv){
const x=String(lv!=null?lv:'').trim();
if(x==='supercharged')return'super';
if(x==='normal')return'medium';
if(DC_MP[x])return x;
return'medium';
}
function _dcMpProfile(lv){return DC_MP[_dcNormMpLevel(lv)]||DC_MP.medium;}
function _dcVigorLabel(lv){
const k=_dcNormMpLevel(lv);
if(k==='high')return t('dc_vigor_high');
if(k==='max')return t('dc_vigor_max');
if(k==='super')return t('dc_vigor_super');
return t('dc_vigor_medium');
}
function _dcApplyDcVigorButtonLabels(){
['Medium','High','Max','Super'].forEach((suf,i)=>{
const el=document.getElementById('dcMpBtn'+suf);
if(el){const key=i===0?'dc_vigor_medium':i===1?'dc_vigor_high':i===2?'dc_vigor_max':'dc_vigor_super';el.textContent=t(key)}
});
}
const DC_ATK_SLOT_COUNT=3;
const DC_SHINN_ASUKA_CHAR_IDS=new Set(['1330000101','1330000102','1330000103','1330000104','1330000105']);
function _dcIsZhCalcLang(){const lc=(S.lang||'EN').toUpperCase();return lc==='TW'||lc==='HK';}
function _dcIsJaCalcLang(){return (S.lang||'EN').toUpperCase()==='JA';}
function _dcTwZhWeaponTypesToEn(zhBlob){const map={物理:'physical',光束:'beam',特殊:'special'};return String(zhBlob||'').split(/、/).map(s=>map[s.trim()]||'').filter(Boolean).join(' or ');}
function _dcTwBattleSpiritToVigorKey(spirit){const t=String(spirit||'').trim();if(t==='超一擊')return'super';if(t==='超強勢')return'max';if(t==='強勢')return'high';return'medium';}
function _dcIsShinnAsukaCharacter(cd){if(!cd)return false;const id=String(cd.id!=null?cd.id:'').trim();if(DC_SHINN_ASUKA_CHAR_IDS.has(id))return true;const mid=cd.main_character_id!=null?String(cd.main_character_id).trim():'';if(mid&&DC_SHINN_ASUKA_CHAR_IDS.has(mid))return true;const n=(cd.name||'').toLowerCase();return n.includes('shinn')&&n.includes('asuka')}
function _dcCharAbilitiesTextBlob(cd){
if(!cd||!cd.abilities)return'';
const parts=[];
cd.abilities.forEach(ab=>{
parts.push(ab.name||'',ab.display_name||'');
(ab.details||[]).forEach(d=>{parts.push(typeof d==='string'?d:(d&&d.text)||'')});
});
return parts.join('\n').toLowerCase();
}
function _dcShouldAutoSuperchargedVigorOnCharCp(cd){
if(!cd)return false;
if(_dcIsShinnAsukaCharacter(cd))return true;
const blob=_dcCharAbilitiesTextBlob(cd);
let abRaw='';
(cd.abilities||[]).forEach(ab=>{(ab.details||[]).forEach(d=>{abRaw+=(typeof d==='string'?d:(d&&d.text)||'')+'\n'})});
if(blob.includes('supercharged')&&blob.includes('shinn'))return true;
if(abRaw.includes('超一擊')&&abRaw.includes('飛鳥'))return true;
return false;
}
const DC_WPN_ELEM={'1':'beam','2':'physical','3':'special','4':'beam','5':'beam','6':'physical','7':'beam'};
const DC_WPN_ELEM_LABEL={beam:'Beam',physical:'Physical',special:'Special'};
const DC_WPN_ATTR_ID_KEYS={'1':['physical'],'2':['beam'],'3':['special'],'4':['beam','physical'],'5':['physical','special'],'6':['beam','special'],'7':['beam','physical','special'],'8':['beam','physical']};
function _dcNormalizeManualWeaponAttrId(aid){
const s=String(aid!=null&&aid!==undefined?aid:'').trim();
if(s==='7')return'2';
if(s==='8')return'4';
return s||'2';
}
function _dcCharHasSpStats(cd){return cd&&Array.isArray(cd.sp_stats)&&cd.sp_stats.length>0}
function _dcWeaponElementFromWeaponType(wpn){const t=String(wpn.weapon_type||'');return DC_WPN_ELEM[t]||'special'}
function _dcWeaponAttributeKeys(wpn){
const aid=String(wpn.attribute_id!=null&&wpn.attribute_id!==undefined?wpn.attribute_id:'').trim();
if(aid&&DC_WPN_ATTR_ID_KEYS[aid])return DC_WPN_ATTR_ID_KEYS[aid];
const labRaw=String(wpn.attribute||'');
const lab=labRaw.toLowerCase();
if(lab||labRaw){
const pk=[];
if(lab.includes('beam')||labRaw.includes('光束'))pk.push('beam');
if(lab.includes('physical')||labRaw.includes('物理'))pk.push('physical');
if(lab.includes('special')||labRaw.includes('特殊'))pk.push('special');
if(pk.length)return[...new Set(pk)];
}
return [_dcWeaponElementFromWeaponType(wpn)];
}
function _dcWeaponAttributeDisplayHtml(wpn){
const raw=(wpn.attribute||'').trim();
if(raw)return `<span class="dc-wpn-attr-pill">${esc('<'+raw+'>')}</span>`;
const aid=String(wpn.attribute_id!=null&&wpn.attribute_id!==undefined?wpn.attribute_id:'').trim();
const L={'1':'Physical','2':'Beam','3':'Special','4':'Beam/Physical','5':'Physical/Special','6':'Beam/Special','7':'Beam/Physical/Special','8':'Beam/Physical'};
if(aid&&L[aid])return `<span class="dc-wpn-attr-pill">${esc('<'+L[aid]+'>')}</span>`;
const k=_dcWeaponAttributeKeys(wpn)[0]||'special';
return `<span class="dc-wpn-attr-pill">${esc('<'+(DC_WPN_ELEM_LABEL[k]||'Special')+'>')}</span>`;
}
const DC_WPN_ATK_TYPE_ICON_FALLBACK={Ranged:'/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp',Melee:'/static/images/UI/UI_Common_TypeIcon_Melee_S.webp',Awaken:'/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp',Attack:'/static/images/WeaponIcon/UI_Common_TypeIcon_Attack_S.webp'};
function _dcWeaponAttackTypeIconsHtml(wpn){
const ats=wpn.attack_types||[];
if(!ats.length)return '';
return ats.map(at=>{
const raw=(at.label||'').trim();
const mapped=DC_ATK_TYPE_LABEL_MAP[raw]||raw;
const src=(at.icon&&String(at.icon).trim())||DC_WPN_ATK_TYPE_ICON_FALLBACK[mapped]||DC_WPN_ATK_TYPE_ICON_FALLBACK[raw]||'';
if(!src)return '';
const tip=esc(mapped||raw);
return`<img class="dc-wpn-atk-type-icon" src="${imgUrlPreferCdn(src)}" alt="" loading="lazy" title="${tip}" onerror="this.style.display='none'">`;
}).join('');
}
function _dcWeaponDtuSumPct(wpn){
const keys=_dcWeaponAttributeKeys(wpn);
let sum=0;
keys.forEach(k=>{
if(k==='beam')sum+=S.dc.dtuBeam||0;
else if(k==='physical')sum+=S.dc.dtuPhysical||0;
else sum+=S.dc.dtuSpecial||0;
});
return sum;
}
function _dcWeaponElement(wpn){return _dcWeaponAttributeKeys(wpn)[0]||'special'}
function _dcDefaultWeaponDistance(wpn){const eff=_dcGetEffectiveRange(wpn);const mn=eff.min_range||1,mx=eff.max_range||mn;let d=Math.max(1,mn);if(d>mx)d=mx;return d}
function _dcNonMapWeapons(ud){
if(!ud||!ud.weapons)return[];
const um=S.dc.unitStatMode||'normal';
return ud.weapons.filter(w=>w.weapon_type!=='3'&&(!w.is_ssp_weapon||um==='ssp'));
}
/** From API: per-level enemy DEF % down on this attack (base + optional Supercharged-only line). */
function _dcWeaponEnemyDefDebuffEffective(wpn,wpnLvIdx){
if(!wpn)return 0;
const lv=_dcWeaponLevelRow(wpn,wpnLvIdx);
let b=parseInt(lv.enemy_def_debuff_base_pct,10);
let sp=parseInt(lv.enemy_def_debuff_supercharged_pct,10);
if(Number.isNaN(b))b=0;
if(Number.isNaN(sp))sp=0;
if(!b&&!sp){
const leg=parseInt(lv.enemy_def_debuff_pct,10);
if(!Number.isNaN(leg)&&leg>0)b=leg;
}
const sup=_dcNormMpLevel(S.dc.mpLevel)==='super';
return Math.min(100,Math.max(b,sup?Math.max(b,sp):b));
}
function _dcManualPlusWeaponDefDebuffPct(wpn,wpnLvIdx){
const manual=parseInt(document.getElementById('dcDefDebuffPct')?.value,10)||0;
const wp=_dcWeaponEnemyDefDebuffEffective(wpn,wpnLvIdx);
return Math.min(100,manual+wp);
}
function _dcGetAutoWeaponPowerDisplay(){
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons)return null;
const wpns=_dcNonMapWeapons(ud);const wpn=wpns[S.dc.wpnIdx];if(!wpn)return null;
return _dcComputedWeaponPowerForLevel(wpn,S.dc.wpnLv);
}
function _dcRefreshFinalWpnPowPlaceholder(){
const el=document.getElementById('dcFinalWpnPow');if(!el)return;
const v=_dcGetAutoWeaponPowerDisplay();
el.placeholder=v!=null?`Auto (${fmtN(v)})`:'Auto (—)';
}
function _dcRefreshDtuInputHighlights(){
['dcDtuRowBeam','dcDtuRowPhysical','dcDtuRowSpecial'].forEach(id=>{const row=document.getElementById(id);if(row)row.classList.remove('dc-dtu-row--on','dc-dtu--beam','dc-dtu--physical','dc-dtu--special')});
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons)return;
const wpns=_dcNonMapWeapons(ud);const w=wpns[S.dc.wpnIdx];if(!w)return;
const keys=_dcWeaponAttributeKeys(w);
const map={beam:['dcDtuRowBeam','dc-dtu--beam'],physical:['dcDtuRowPhysical','dc-dtu--physical'],special:['dcDtuRowSpecial','dc-dtu--special']};
keys.forEach(k=>{const m=map[k];if(!m)return;const row=document.getElementById(m[0]);if(row){row.classList.add('dc-dtu-row--on',m[1])}});
}
function _dcRefreshDefDebuffInputStyle(){
const el=document.getElementById('dcDefDebuffPct');if(!el)return;
el.classList.toggle('dc-input--def-debuff',(parseInt(el.value)||0)>0);
}
function _dcRefreshCalcDependentUi(){
_dcRefreshFinalWpnPowPlaceholder();
_dcRefreshDtuInputHighlights();
_dcRefreshDefDebuffInputStyle();
_dcRefreshDmgIncreaseVigorSub();
}
function _dcRefreshDmgIncreaseVigorSub(){
const el=document.getElementById('dcDmgIncreaseVigorSub');
const effEl=document.getElementById('dcDmgIncreaseEffectiveLine');
const user=parseInt(document.getElementById('dcDmgIncrease')?.value,10)||0;
const mp=_dcMpProfile(S.dc.mpLevel);
const vigPct=Math.round((mp.dmgBonus||0)*100);
const total=user+vigPct;
if(effEl){
if(vigPct>0||user>0){
effEl.style.display='';
effEl.removeAttribute('aria-hidden');
effEl.textContent=`Effective ⑨ total: ${total}% (${user}% passive${vigPct>0?` + ${vigPct}% vigor`:''}) — same value used in damage.`;
effEl.title='Damage Dealt Up % passive plus vigor bonus share one pool; they are not applied twice.';
}else{
effEl.style.display='none';effEl.textContent='';effEl.setAttribute('aria-hidden','true');
}
}
if(!el)return;
if(vigPct<=0){el.style.display='none';el.textContent='';el.setAttribute('aria-hidden','true');return}
const lk=_dcNormMpLevel(S.dc.mpLevel);
el.style.display='';
el.removeAttribute('aria-hidden');
el.className='dc-stat-mini-bonus';
el.title='Vigor adds this % into the same ⑨ damage increase pool as Damage Dealt Up % (not double-counted).';
el.textContent=String(t('dc_vigor_dmg_bonus_sub')).replace('{pct}',String(vigPct)).replace('{label}',_dcVigorLabel(lk));
}
function _dcRefreshTotalDebuffsDisplay(){
const el=document.getElementById('dcTotalDebuffsDisplay');if(!el)return;
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons){el.textContent='—';return}
const wpns=_dcNonMapWeapons(ud);const w=wpns[S.dc.wpnIdx];if(!w){el.textContent='—';return}
el.textContent=String(_dcWeaponDtuSumPct(w)||0);
}
function _dcCreateEmptyAttackerSlot(){
return JSON.parse(JSON.stringify({
atkUnit:null,atkChar:null,atkUnitData:null,atkCharData:null,
lbTier:3,wpnIdx:0,wpnLv:0,
unitStatMode:'normal',charStatMode:'normal',unitCondPassive:false,charCondPassive:false,dcSuperchargedExTier:0,
optionParts:[],supporters:[],
_unitIsSD:false,
_wpnTraitDistPow:0,_wpnTraitHpPow:0,_wpnTraits:{},
_vigorCondThreshold:null,
_activeSkills:{},
mpLevel:'medium',
terrainMode:'normal',terrain:0,
finalWpnPow:0,dmgIncrease:0,critDmgUp:0,exSquadAtkPct:0,exSquadAtkPctExplicitZero:false,squadCondPct:0,atkCounterOwnAtk:false,supportCounterAtk:false,_supportCounterAtkPct:0,supportCntPairSnap:null,applyAdvantageEnemyTag:true,
unitTurnBuffAtk:false,unitTurnBuffDef:false,masterLeagueBuff:false,grandOffensiveBuff:false
}));
}
function _dcReadAttackerFromDc(){
return JSON.parse(JSON.stringify({
atkUnit:S.dc.atkUnit,atkChar:S.dc.atkChar,
atkUnitData:S.dc.atkUnitData,atkCharData:S.dc.atkCharData,
lbTier:S.dc.lbTier,wpnIdx:S.dc.wpnIdx,wpnLv:S.dc.wpnLv,
unitStatMode:S.dc.unitStatMode||'normal',charStatMode:S.dc.charStatMode||'normal',
unitCondPassive:!!S.dc.unitCondPassive,charCondPassive:!!S.dc.charCondPassive,dcSuperchargedExTier:Math.max(0,S.dc.dcSuperchargedExTier|0),
optionParts:S.dc.optionParts||[],supporters:S.dc.supporters||[],
_unitIsSD:!!S.dc._unitIsSD,
_wpnTraitDistPow:S.dc._wpnTraitDistPow||0,_wpnTraitHpPow:S.dc._wpnTraitHpPow||0,
_wpnTraits:S.dc._wpnTraits||{},
_vigorCondThreshold:S.dc._vigorCondThreshold||null,
_activeSkills:S.dc._activeSkills||{},
mpLevel:S.dc.mpLevel||'medium',
terrainMode:S.dc.terrainMode||'normal',terrain:S.dc.terrain||0,
finalWpnPow:S.dc.finalWpnPow||0,dmgIncrease:S.dc.dmgIncrease||0,critDmgUp:S.dc.critDmgUp||0,exSquadAtkPct:S.dc.exSquadAtkPct||0,exSquadAtkPctExplicitZero:!!S.dc.exSquadAtkPctExplicitZero,squadCondPct:S.dc.squadCondPct||0,atkCounterOwnAtk:!!S.dc.atkCounterOwnAtk,supportCounterAtk:!!S.dc.supportCounterAtk,_supportCounterAtkPct:S.dc._supportCounterAtkPct|0,supportCntPairSnap:(function(){const m=S.dc._supportCntAtkPairSnapBySlot;if(!m)return null;const i=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);const v=m[i];return v?String(v):null})(),applyAdvantageEnemyTag:S.dc.applyAdvantageEnemyTag!==false,
unitTurnBuffAtk:!!S.dc.unitTurnBuffAtk,unitTurnBuffDef:!!S.dc.unitTurnBuffDef,
masterLeagueBuff:!!S.dc.masterLeagueBuff,
grandOffensiveBuff:!!S.dc.grandOffensiveBuff
}));
}
function _dcWriteAttackerToDc(slot){
if(!slot)return;
if(slot._dcSquadCondShareMissing&&slot.atkCharData&&slot.atkUnitData){
slot._dcSquadCondShareMissing=0;
if(_dcCharShouldShowSquadCondUi(slot.atkCharData,slot.atkUnitData))slot.squadCondPct=_dcDefaultSquadCondPctForCdUd(slot.atkCharData,slot.atkUnitData);
}
S.dc.atkUnit=slot.atkUnit;S.dc.atkChar=slot.atkChar;
S.dc.atkUnitData=slot.atkUnitData;S.dc.atkCharData=slot.atkCharData;
S.dc.lbTier=slot.lbTier;S.dc.wpnIdx=slot.wpnIdx;S.dc.wpnLv=slot.wpnLv;
S.dc.unitStatMode=slot.unitStatMode||'normal';S.dc.charStatMode=slot.charStatMode||'normal';
S.dc.unitCondPassive=!!slot.unitCondPassive;S.dc.charCondPassive=!!slot.charCondPassive;S.dc.dcSuperchargedExTier=Math.max(0,slot.dcSuperchargedExTier|0);
S.dc.optionParts=Array.isArray(slot.optionParts)?slot.optionParts:[];S.dc.supporters=Array.isArray(slot.supporters)?slot.supporters:[];
S.dc._unitIsSD=!!slot._unitIsSD;
S.dc._wpnTraitDistPow=slot._wpnTraitDistPow||0;S.dc._wpnTraitHpPow=slot._wpnTraitHpPow||0;
S.dc._wpnTraits=slot._wpnTraits&&typeof slot._wpnTraits==='object'?{...slot._wpnTraits}:{};
S.dc._vigorCondThreshold=slot._vigorCondThreshold;
S.dc._activeSkills=slot._activeSkills&&typeof slot._activeSkills==='object'?{...slot._activeSkills}:{};
S.dc.mpLevel=_dcNormMpLevel(slot.mpLevel);
S.dc.terrainMode=slot.terrainMode||'normal';S.dc.terrain=slot.terrain||0;
S.dc.finalWpnPow=slot.finalWpnPow||0;S.dc.dmgIncrease=slot.dmgIncrease||0;S.dc.critDmgUp=slot.critDmgUp||0;S.dc.exSquadAtkPct=slot.exSquadAtkPct||0;S.dc.exSquadAtkPctExplicitZero=!!slot.exSquadAtkPctExplicitZero;S.dc.squadCondPct=slot.squadCondPct|0;S.dc.atkCounterOwnAtk=!!slot.atkCounterOwnAtk;S.dc.supportCounterAtk=!!slot.supportCounterAtk;S.dc._supportCounterAtkPct=slot._supportCounterAtkPct|0;{const wi=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);if(!S.dc._supportCntAtkPairSnapBySlot)S.dc._supportCntAtkPairSnapBySlot={};const skProvided=slot&&Object.prototype.hasOwnProperty.call(slot,'supportCntPairSnap')&&slot.supportCntPairSnap!=null&&String(slot.supportCntPairSnap).trim()!=='';S.dc._supportCntAtkPairSnapBySlot[wi]=skProvided?String(slot.supportCntPairSnap):(_dcSupportCntEligiblePairSnap(slot.atkCharData,slot.atkUnitData)||null)}S.dc.applyAdvantageEnemyTag=slot.applyAdvantageEnemyTag!==false;
S.dc.unitTurnBuffAtk=!!slot.unitTurnBuffAtk;S.dc.unitTurnBuffDef=!!slot.unitTurnBuffDef;
S.dc.masterLeagueBuff=!!slot.masterLeagueBuff;
S.dc.grandOffensiveBuff=!!slot.grandOffensiveBuff;
_dcSyncSquadCondEffectiveFromState();
if(S.dc.atkCharData)S.dc._pilotSkills=_dcPilotSkillsVisibleForDc(S.dc.atkCharData)||[];
}
function _dcSnapActiveAttackerToSlot(){
if(!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots))S.dc.atkSlots=Array.from({length:DC_ATK_SLOT_COUNT},()=>_dcCreateEmptyAttackerSlot());
while(S.dc.atkSlots.length<DC_ATK_SLOT_COUNT)S.dc.atkSlots.push(_dcCreateEmptyAttackerSlot());
onDcParamChange();
S.dc.atkSlots[Math.min(S.dc.atkSlotIndex|0,DC_ATK_SLOT_COUNT-1)]=_dcReadAttackerFromDc();
}
function _dcSyncAttackerDomFromDc(){
const fwp=document.getElementById('dcFinalWpnPow');if(fwp)fwp.value=S.dc.finalWpnPow?String(S.dc.finalWpnPow):'';
const di=document.getElementById('dcDmgIncrease');if(di)di.value=String(S.dc.dmgIncrease||0);
const cu=document.getElementById('dcCritDmgUp');if(cu)cu.value=String(S.dc.critDmgUp||0);
const exa=document.getElementById('dcExSquadAtkPct');if(exa){const x=S.dc.exSquadAtkPct|0;if(x>0)exa.value=String(Math.min(20,x));else if(S.dc.exSquadAtkPctExplicitZero&&_scIsQubeleyExCombo(S.dc.atkCharData,S.dc.atkUnitData))exa.value='0';else exa.value=''}
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
const acoa=document.getElementById('dcAtkCounterOwnAtk');if(acoa)acoa.checked=!!S.dc.atkCounterOwnAtk;
const aet=document.getElementById('dcAtkAdvantageEnemyTag');if(aet)aet.checked=S.dc.applyAdvantageEnemyTag!==false;
document.querySelectorAll('#dcMpBtns .dc-ctrl-btn').forEach(b=>b.classList.toggle('active',b.dataset.mp===S.dc.mpLevel));
const nb=document.getElementById('dcTerrainNormal'),hb=document.getElementById('dcTerrainHalved');
if(nb)nb.classList.toggle('active',S.dc.terrainMode==='normal');
if(hb)hb.classList.toggle('active',S.dc.terrainMode==='halved');
}
function _dcAnimateAttackerPanelShuffle(){
const el=document.getElementById('dcAtkPanelShuffle');if(!el)return;
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
el.classList.remove('dc-atk-panel-shuffle');
void el.offsetWidth;
el.classList.add('dc-atk-panel-shuffle');
const fin=()=>{el.classList.remove('dc-atk-panel-shuffle');el.removeEventListener('animationend',fin)};
el.addEventListener('animationend',fin,{once:true});
}
function _dcRefreshAtkSlotUi(){
const idx=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
S.dc.atkSlotIndex=idx;
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const p=document.getElementById('dcAtkSlotPill'+i);if(!p)continue;
p.classList.toggle('is-active',i===idx);
p.setAttribute('aria-selected',i===idx?'true':'false');
}
}
function _dcEnsureAttackerSlots(){
if(!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots)||S.dc.atkSlots.length<DC_ATK_SLOT_COUNT){
S.dc.atkSlotIndex=Math.min(S.dc.atkSlotIndex|0,DC_ATK_SLOT_COUNT-1);
const cur=_dcReadAttackerFromDc();
const slots=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++)slots.push(i===S.dc.atkSlotIndex?cur:_dcCreateEmptyAttackerSlot());
S.dc.atkSlots=slots;
}
_dcRefreshAtkSlotUi();
}
function _dcCalculateDamageWithSlot(slotIdx){
const slots=S.dc.atkSlots;if(!slots||!slots[slotIdx])return null;
const slot=slots[slotIdx];if(!slot.atkUnitData||!slot.atkCharData)return null;
const backup=_dcReadAttackerFromDc();
_dcWriteAttackerToDc(slot);
let r=null;
try{r=calculateDamage()}catch(e){console.error('calculateDamage slot',slotIdx,e)}
_dcWriteAttackerToDc(backup);
return r;
}
function setDcAttackerSlot(idx){
const t=parseInt(idx,10);if(Number.isNaN(t)||t<0||t>=DC_ATK_SLOT_COUNT)return;
if(t===(S.dc.atkSlotIndex|0))return;
_dcSnapActiveAttackerToSlot();
S.dc.atkSlotIndex=t;
_dcWriteAttackerToDc(S.dc.atkSlots[S.dc.atkSlotIndex]);
_dcSyncAttackerDomFromDc();
_dcRefreshAtkSlotUi();
_dcAnimateAttackerPanelShuffle();
renderDcAtkUnit();
S.dc._integratedWpnCritDmgUp=S.dc._wpnCritDmgUp|0;
renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
if(S.dc.atkUnitData&&S.dc.atkUnitData._manual)_dcFillManualAtkDomFromPack(_dcAtkManualPackFromSlot(_dcReadAttackerFromDc()));
_dcSyncAtkModeUiFromState();
onDcParamChange();
}
function toggleDcAttackerSlot(){
_dcSnapActiveAttackerToSlot();
S.dc.atkSlotIndex=((S.dc.atkSlotIndex|0)+1)%DC_ATK_SLOT_COUNT;
_dcWriteAttackerToDc(S.dc.atkSlots[S.dc.atkSlotIndex]);
_dcSyncAttackerDomFromDc();
_dcRefreshAtkSlotUi();
_dcAnimateAttackerPanelShuffle();
renderDcAtkUnit();
S.dc._integratedWpnCritDmgUp=S.dc._wpnCritDmgUp|0;
renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
if(S.dc.atkUnitData&&S.dc.atkUnitData._manual)_dcFillManualAtkDomFromPack(_dcAtkManualPackFromSlot(_dcReadAttackerFromDc()));
_dcSyncAtkModeUiFromState();
onDcParamChange();
}

function initDmgCalc(){
S._dcAtkPresetBackup=null;S._dcAtkManualPackBackup=null;S._dcDefPresetNpcBackup=null;S._dcDefDbBackup=null;S._dcDefCustomPackBackup=null;
S.dc.atkUnit=null;S.dc.atkChar=null;S.dc.atkUnitData=null;S.dc.atkCharData=null;S.dc.lbTier=3;
S.dc.defNpc=null;S.dc.defTargetMode='preset';S.dc.defUnitData=null;S.dc.defCharData=null;S.dc.defLbTier=3;S.dc.npcList=[];S.dc.wpnIdx=0;S.dc.wpnLv=0;S.dc.terrain=0;S.dc.mpLevel='medium';S.dc.defending=false;S.dc.shield=false;S.dc.finalWpnPow=0;S.dc.dmgIncrease=0;S.dc.critDmgUp=0;S.dc.exSquadAtkPct=0;S.dc.exSquadAtkPctExplicitZero=false;S.dc.squadCondPct=0;S.dc.squadCondAtkPct=0;S.dc.squadCondDefPct=0;S.dc.defNpcMapBonusesOn=true;S.dc.atkCounterOwnAtk=false;S.dc.supportCounterAtk=false;S.dc._supportCounterAtkPct=0;S.dc.applyAdvantageEnemyTag=true;S.dc.dmgTakenDownPilot=0;S.dc.dmgTakenDownUnit=0;S.dc.unitStatMode='normal';S.dc.charStatMode='normal';S.dc.unitCondPassive=false;S.dc.charCondPassive=false;S.dc.dcSuperchargedExTier=0;S.dc.optionParts=[];S.dc.supporters=[];S.dc._wpnTraitDistPow=0;S.dc._wpnTraitHpPow=0;S.dc._wpnTraits={};S.dc._wpnCritDmgUp=0;S.dc._integratedWpnCritDmgUp=0;S.dc._vigorCondThreshold=null;S.dc._activeSkills={};S.dc.unitTurnBuffAtk=false;S.dc.unitTurnBuffDef=false;S.dc.masterLeagueBuff=false;S.dc.grandOffensiveBuff=false;S.dc.multiPctCompare=false;S.dc._dcAutoFitGen=0;S.dc._supportCntAtkPairSnapBySlot={};
renderDcDefDbPicks();
const _drp=document.getElementById('dcDefModePreset'),_drc=document.getElementById('dcDefModeCustom'),_ddb=document.getElementById('dcDefModeDatabase'),_dpw=document.getElementById('dcDefPresetWrap'),_dcw=document.getElementById('dcDefCustomWrap'),_ddbw=document.getElementById('dcDefDatabaseWrap');
if(_drp)_drp.checked=true;if(_drc)_drc.checked=false;if(_ddb)_ddb.checked=false;if(_dpw)_dpw.style.display='';if(_dcw)_dcw.style.display='none';if(_ddbw)_ddbw.style.display='none';
const fwp=document.getElementById('dcFinalWpnPow');if(fwp)fwp.value='';
const di=document.getElementById('dcDmgIncrease');if(di)di.value=0;
const cu=document.getElementById('dcCritDmgUp');if(cu)cu.value=0;
const exa=document.getElementById('dcExSquadAtkPct');if(exa)exa.value='';
const sqc=document.getElementById('dcSquadCondPct');if(sqc)sqc.value='';
const dmb=document.getElementById('dcDefNpcMapBonusesOn');if(dmb)dmb.checked=true;
const acoa=document.getElementById('dcAtkCounterOwnAtk');if(acoa){acoa.checked=false}
{const off=document.getElementById('dcAtkSupportCounterOff');const on=document.getElementById('dcAtkSupportCounterOn');if(off&&on){off.classList.add('active');on.classList.remove('active')}}
const aet=document.getElementById('dcAtkAdvantageEnemyTag');if(aet)aet.checked=true;
const dtp=document.getElementById('dcDmgTakenDownPilot');if(dtp)dtp.value=0;
const dtu=document.getElementById('dcDmgTakenDownUnit');if(dtu)dtu.value=0;
const dss=document.getElementById('dcStageSearch');if(dss)dss.value='';
_dcCloseDcStageDd();_dcUpdateDcStageDdLabel();
['dcDefDebuffPct','dcDtuBeam','dcDtuPhysical','dcDtuSpecial'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0});
setDcMp('medium');setDcDefend(false);setDcShield(false);setDcTerrain('normal');
renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();renderDcDefStats();onDcParamChange();
S.dc.atkSlotIndex=0;
S.dc.atkSlots=[_dcReadAttackerFromDc(),_dcCreateEmptyAttackerSlot(),_dcCreateEmptyAttackerSlot()];
_dcRefreshAtkSlotUi();
_dcSyncAtkModeUiFromState();
}
async function openDmgCalc(){
const d=S.currentDetailData;
switchTab('calculator');
if(d&&d.npc_details){
await loadDcStages();
_dcFillDcStageSelectOptions(_dcStagesCache||[]);
const stgSel=document.getElementById('dcStageSelect');
if(stgSel&&d.id){stgSel.value=d.id;_dcUpdateDcStageDdLabel();await onDcStageChange()}
}
}
function setDcTerrain(mode){
S.dc.terrainMode=mode;
S.dc.terrain=mode==='halved'?50:0;
const nb=document.getElementById('dcTerrainNormal'),hb=document.getElementById('dcTerrainHalved');
if(nb)nb.classList.toggle('active',mode==='normal');
if(hb)hb.classList.toggle('active',mode==='halved');
onDcParamChange();
}
let _dcStagesCache=null;
let _dcStagesFetchLang=null;
async function loadDcStages(){
if(_dcStagesCache!==null&&_dcStagesFetchLang===S.lang)return _dcStagesCache;
try{const r=await fetch(`/api/dc_targets?lang=${encodeURIComponent(S.lang)}`);const d=await r.json();_dcStagesCache=Array.isArray(d)?d:[];_dcStagesFetchLang=S.lang;return _dcStagesCache}catch(e){return[]}}
async function renderDcStageDropdown(){
const stages=await loadDcStages();
_dcFillDcStageSelectOptions(stages);
}
async function onDcStageChange(){
const keepDb=((S.dc.defTargetMode||'preset')==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData._manual&&!S.dc.defCharData._manual&&!S.dc.defUnitData.error&&!S.dc.defCharData.error);
if(!keepDb){
S.dc.defTargetMode='preset';
S.dc.defUnitData=null;S.dc.defCharData=null;
const _drp=document.getElementById('dcDefModePreset'),_drc=document.getElementById('dcDefModeCustom'),_ddb=document.getElementById('dcDefModeDatabase'),_dpw=document.getElementById('dcDefPresetWrap'),_dcw=document.getElementById('dcDefCustomWrap'),_ddbw=document.getElementById('dcDefDatabaseWrap');
if(_drp)_drp.checked=true;if(_drc)_drc.checked=false;if(_ddb)_ddb.checked=false;if(_dpw)_dpw.style.display='';if(_dcw)_dcw.style.display='none';if(_ddbw)_ddbw.style.display='none';
}
const sel=document.getElementById('dcStageSelect');
const stageId=sel.value;
const lockMsg=document.getElementById('dcStageContentLockMsg');
if(lockMsg){lockMsg.style.display='none';lockMsg.textContent=''}
_dcUpdateDcStageDdLabel();
if(!stageId){S.dc.npcList=[];S.dc.defNpc=null;renderDcNpcDropdown();renderDcDefStats();onDcParamChange();return}
try{
const r=await fetch(`/api/stage/${stageId}?lang=${S.lang}`);const d=await r.json();
if(d.content_locked){
S.dc.npcList=[];S.dc.defNpc=null;S.dc._stageData=d;
if(lockMsg){lockMsg.style.display='block';lockMsg.textContent=d.password_required?t('er_stage_lock_hint'):t('er_stage_lock_wait')}
renderDcNpcDropdown();renderDcDefStats();onDcParamChange();return
}
S.dc.npcList=(d.npc_details&&Array.isArray(d.npc_details))?d.npc_details.filter(n=>n.side==='enemy'):[];
S.dc.defNpc=null;S.dc._stageData=d;
renderDcNpcDropdown();renderDcDefStats();onDcParamChange();
}catch(e){S.dc.npcList=[];renderDcNpcDropdown()}
}
function closeDmgCalc(){}
/** Parse minimum vigor tier from ability name + detail lines (EN/JA/TW/HK). Trait titles use e.g. （テンション条件） / （戰意條件） / (Vigor conditions). */
function _dcVigorTierFromAbilityText(blob){
const raw=String(blob||'');
const t=raw.toLowerCase();
if(/\bvigor\s+is\s+supercharged\b/.test(t)||/\bsupercharged(?:\s+ex)?(?:\s+\d+)?\s+or\s+higher\b/.test(t))return'super';
if(/\bvigor\s+is\s+max\b/.test(t)||/\bmax\s+or\s+higher\b/.test(t))return'max';
if(/\bvigor\s+is\s+high\b/.test(t)||/\bhigh\s+or\s+higher\b/.test(t))return'high';
if(/テンションが「超一撃」以上/.test(raw)||/テンションが「超一擊」以上/.test(raw))return'super';
if(/テンションが「超強気」以上/.test(raw)||/テンションが「最大」以上/.test(raw))return'max';
if(/テンションが「強気」以上/.test(raw))return'high';
if(/戰意(?:為|是)「超一擊」以上/.test(raw)||/战意(?:为|是)「超一击」以上/.test(raw))return'super';
if(/戰意(?:為|是)「超強勢」以上/.test(raw)||/战意(?:为|是)「超强」以上/.test(raw))return'max';
if(/戰意(?:為|是)「強勢」以上/.test(raw)||/战意(?:为|是)「强势」以上/.test(raw))return'high';
return null;
}
/** Concatenate translatable strings for vigor detection (base + SP/SSP replacement payloads). */
function _dcVigorAbilityTextBlob(ab){
if(!ab)return'';
const chunks=[];
function pushOne(a){
if(!a)return;
chunks.push(a.name||'');
(a.details||[]).forEach(d=>{if(d&&d.text)chunks.push(d.text)});
}
pushOne(ab);
pushOne(ab.ssp_replacement);
pushOne(ab.sp_replacement);
return chunks.join('\n');
}
function _dcVigorThresholdFromUnit(ud){
if(!ud||!ud.abilities)return null;
const V=['medium','high','max','super'];
const rk=(x)=>V.indexOf(x);
let thr=null;
(ud.abilities||[]).forEach(ab=>{
const full=_dcVigorAbilityTextBlob(ab);
let x=_dcVigorTierFromAbilityText(full);
if(!x&&/\(vigor conditions\)|\bvigor conditions\b|テンション条件|戰意條件|战意条件/i.test(full)){
const tl=full.toLowerCase();
if(tl.includes('supercharged')||/超一撃|超一擊/.test(full))x='super';
else if(/\bvigor\s+is\s+max\b/.test(tl)||/\bmax\s+or\s+higher\b/.test(tl)||/超強気|超強勢/.test(full))x='max';
else if(/\bvigor\s+is\s+high\b/.test(tl)||/\bhigh\s+or\s+higher\b/.test(tl)||/「強勢」以上|「强势」以上/.test(full))x='high';
else x='max';
}
if(x!==null&&(thr===null||rk(x)>rk(thr)))thr=x;
});
return thr;
}
function _dcB64UrlEncode(str){
const bytes=new TextEncoder().encode(str);
let bin='';
for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _dcB64UrlDecode(s){
if(!s)return'';
let pad=String(s).replace(/-/g,'+').replace(/_/g,'/');
while(pad.length%4)pad+='=';
const bin=atob(pad);
const bytes=new Uint8Array(bin.length);
for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
return new TextDecoder().decode(bytes);
}
function _dcManualDefNpcFromDefC(c){
const num=(k,def)=>{const x=parseInt(c[k],10);return Number.isFinite(x)?x:def};
return{npc_id:'__manual__',_manual:true,unit:{name:String(c.un||'Custom unit'),portrait:'',thum:'',stats_raw:{HP:num('uHP',0),Attack:num('uATK',0),Defense:num('uDEF',0),Mobility:num('uMOB',0)},bonus_amounts:{}},character:{name:String(c.cn||'Custom pilot'),portrait:'',thum:'',stats_raw:{Ranged:num('cRNG',0),Melee:num('cMEL',0),Awaken:num('cAWK',0),Defense:num('cDEF',0),Reaction:num('cREA',0)},bonus_amounts:{}}};
}
function _dcBuildManualDefNpcFromDom(){return _dcManualDefNpcFromDefC(_dcDefManualStatsToPack())}
function _dcDefManualStatsToPack(){
return{un:document.getElementById('dcDefManual_uName')?.value||'Custom unit',cn:document.getElementById('dcDefManual_cName')?.value||'Custom pilot',uHP:parseInt(document.getElementById('dcDefManual_uHP')?.value,10)||0,uATK:parseInt(document.getElementById('dcDefManual_uATK')?.value,10)||0,uDEF:parseInt(document.getElementById('dcDefManual_uDEF')?.value,10)||0,uMOB:parseInt(document.getElementById('dcDefManual_uMOB')?.value,10)||0,cRNG:parseInt(document.getElementById('dcDefManual_cRNG')?.value,10)||0,cMEL:parseInt(document.getElementById('dcDefManual_cMEL')?.value,10)||0,cAWK:parseInt(document.getElementById('dcDefManual_cAWK')?.value,10)||0,cDEF:parseInt(document.getElementById('dcDefManual_cDEF')?.value,10)||0,cREA:parseInt(document.getElementById('dcDefManual_cREA')?.value,10)||0};
}
function _dcFillManualDefDomFromPack(c){
const setv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null&&v!==''?String(v):''};
setv('dcDefManual_uName',c.un);setv('dcDefManual_cName',c.cn);setv('dcDefManual_uHP',c.uHP);setv('dcDefManual_uATK',c.uATK);setv('dcDefManual_uDEF',c.uDEF);setv('dcDefManual_uMOB',c.uMOB);setv('dcDefManual_cRNG',c.cRNG);setv('dcDefManual_cMEL',c.cMEL);setv('dcDefManual_cAWK',c.cAWK);setv('dcDefManual_cDEF',c.cDEF);setv('dcDefManual_cREA',c.cREA);
}
function _dcStatPairFromApiList(statArr){
const stats_raw={},bonus_amounts={};
(statArr||[]).forEach(e=>{
if(!e||e.name==null)return;
const nm=String(e.name);
const tot=Math.round(Number(e.total));
if(Number.isFinite(tot))stats_raw[nm]=tot;
const bon=Math.round(Number(e.bonus));
if(Number.isFinite(bon)&&bon>0)bonus_amounts[nm]=bon;
});
return{stats_raw,bonus_amounts};
}
function _dcSyncDefNpcFromDatabase(){
const ud=S.dc.defUnitData,cd=S.dc.defCharData;
if(!ud||ud.error||ud._manual||!cd||cd.error||cd._manual){S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();onDcParamChange();return}
const lb=ud.lb_data;
const maxT=lb&&lb.length?lb.length-1:0;
const tier=Math.min(Math.max(0,S.dc.defLbTier|0),maxT);
S.dc.defLbTier=tier;
const row=lb&&lb[tier]?lb[tier]:null;
const ustats=row?row.stats_no_cond:(Array.isArray(ud.stats)?ud.stats:null);
const {stats_raw:ur,bonus_amounts:ub}=_dcStatPairFromApiList(ustats);
const {stats_raw:cr,bonus_amounts:cb}=_dcStatPairFromApiList(cd.stats);
S.dc.defNpc={
npc_id:'__db__',
_fromDatabase:true,
unit:{
name:ud.name,
portrait:ud.portrait||'',
thum:ud.thum||'',
rarity_icon:ud.rarity_icon||'',
role_icon:ud.role_icon||'',
stats_raw:{
HP:ur.HP||0,
EN:ur.EN||0,
Attack:ur.Attack||0,
Defense:ur.Defense||0,
Mobility:ur.Mobility||0,
Move:ur.Move||0
},
bonus_amounts:{
HP:ub.HP||0,
Attack:ub.Attack||0,
Defense:ub.Defense||0,
Mobility:ub.Mobility||0,
Move:ub.Move||0
},
tags:ud.tags||[]
},
character:{
name:cd.name,
portrait:cd.portrait||'',
thum:cd.thum||'',
stats_raw:{
Ranged:cr.Ranged||0,
Melee:cr.Melee||0,
Awaken:cr.Awaken||0,
Defense:cr.Defense||0,
Reaction:cr.Reaction||0
},
bonus_amounts:{
Ranged:cb.Ranged||0,
Melee:cb.Melee||0,
Awaken:cb.Awaken||0,
Defense:cb.Defense||0,
Reaction:cb.Reaction||0
},
tags:cd.tags||[]
}
};
renderDcDefDbPicks();
renderDcDefStats();
onDcParamChange();
}
function renderDcDefDbPicks(){
const uEl=document.getElementById('dcDefDbUnitSlot'),cEl=document.getElementById('dcDefDbCharSlot');
if(!uEl||!cEl)return;
const ud=S.dc.defUnitData,cd=S.dc.defCharData;
const isSD=ud&&!ud.error&&String(ud.body_type||'')==='3';
if(ud&&!ud.error){
const lb=ud.lb_data;
const maxTier=lb&&lb.length?lb.length-1:0;
let lbBlock='';
if(lb&&lb.length>1&&!ud.is_ultimate){
const tier=Math.min(Math.max(0,S.dc.defLbTier|0),maxTier);
const cur=cmpLbPipsAtTier(tier);
let lbMenu='';
for(let tt=0;tt<=maxTier;tt++){
const p=cmpLbPipsAtTier(tt);
lbMenu+=`<button type="button" class="cmp-lb-opt${tt===tier?' is-active':''}" onclick="setDcDefLbTier(${tt});var _ddb=document.getElementById('dcDefLbTierDetails');if(_ddb)_ddb.open=false" role="option" aria-selected="${tt===tier}">${cmpLbPipsRow(p[0],p[1],p[2])}</button>`;
}
lbBlock=`<div class="dc-lb-inline-wrap"><details id="dcDefLbTierDetails" class="cmp-lb-details dc-lb-tier-details"><summary class="cmp-lb-summary" title="${esc(t('cmp_lb'))}">${cmpLbPipsRow(cur[0],cur[1],cur[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${esc(t('cmp_lb'))}">${lbMenu}</div></details></div>`;
}
const lbStatCluster=lbBlock?`<div class="dc-unit-lb-stat-cluster">${lbBlock}</div>`:'';
uEl.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(ud.thum||ud.portrait||'')}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ud.name)}</div><div class="dc-picked-badges">${ud.rarity_icon?`<img src="${imgUrl(ud.rarity_icon)}">`:''}${ud.role_icon?`<img src="${imgUrl(ud.role_icon)}">`:''}</div></div>${lbStatCluster}<button type="button" class="dc-picked-change" onclick="openDcPicker('def_unit')">${t('dc_change')}</button></div>`;
}else{
uEl.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('def_unit')">${t('dc_pick_unit')}</button>`;
}
if(cd&&!cd.error){
const chBtn=isSD?'':`<button type="button" class="dc-picked-change" onclick="openDcPicker('def_character')">${t('dc_change')}</button>`;
const sdNote=isSD?`<div style="font-size:10px;color:var(--text-muted);margin-top:4px">SD — paired pilot from unit</div>`:'';
cEl.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(cd.thum||cd.portrait||'')}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(cd.name)}</div></div>${sdNote}${chBtn}</div>`;
}else if(isSD){
cEl.innerHTML='<div style="font-size:11px;color:var(--text-muted)">Select an SD unit to load its pilot.</div>';
}else{
cEl.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('def_character')">${t('dc_pick_char')}</button>`;
}
}
function setDcDefLbTier(t){
let tt=Math.min(3,Math.max(0,t|0));
const ud=S.dc.defUnitData;
if(ud&&ud.lb_data&&ud.lb_data.length)tt=Math.min(tt,ud.lb_data.length-1);
S.dc.defLbTier=tt;
const defDbReady=(S.dc.defTargetMode||'preset')==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData.error&&!S.dc.defCharData.error;
if(defDbReady)_dcSyncDefNpcFromDatabase();
else renderDcDefDbPicks();
}
function setDcDefTargetMode(mode){
const prev=S.dc.defTargetMode||'preset';
if(prev==='preset'&&S.dc.defNpc)
try{S._dcDefPresetNpcBackup=JSON.parse(JSON.stringify(S.dc.defNpc))}catch(_){S._dcDefPresetNpcBackup=S.dc.defNpc}
if(prev==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData.error&&!S.dc.defCharData.error&&!S.dc.defUnitData._manual){
try{
S._dcDefDbBackup={defLbTier:S.dc.defLbTier|0,unitData:JSON.parse(JSON.stringify(S.dc.defUnitData)),charData:JSON.parse(JSON.stringify(S.dc.defCharData))}
}catch(_){S._dcDefDbBackup=null}
}
if(prev==='custom')
try{S._dcDefCustomPackBackup=_dcDefManualStatsToPack()}catch(_){}
S.dc.defTargetMode=mode;
const pw=document.getElementById('dcDefPresetWrap');
const cw=document.getElementById('dcDefCustomWrap');
const dbw=document.getElementById('dcDefDatabaseWrap');
const rp=document.getElementById('dcDefModePreset');
const rc=document.getElementById('dcDefModeCustom');
const rd=document.getElementById('dcDefModeDatabase');
if(rp)rp.checked=mode==='preset';
if(rc)rc.checked=mode==='custom';
if(rd)rd.checked=mode==='database';
if(pw)pw.style.display=mode==='preset'?'':'none';
if(cw)cw.style.display=mode==='custom'?'':'none';
if(dbw)dbw.style.display=mode==='database'?'':'none';
if(mode==='custom'){
S.dc.defUnitData=null;S.dc.defCharData=null;
if(S._dcDefCustomPackBackup)_dcFillManualDefDomFromPack(S._dcDefCustomPackBackup);
S.dc.defNpc=_dcBuildManualDefNpcFromDom();
renderDcDefStats();
onDcParamChange();
}else if(mode==='database'){
if(S._dcDefDbBackup&&S._dcDefDbBackup.unitData&&S._dcDefDbBackup.charData){
S.dc.defUnitData=S._dcDefDbBackup.unitData;
S.dc.defCharData=S._dcDefDbBackup.charData;
S.dc.defLbTier=S._dcDefDbBackup.defLbTier|0;
_dcSyncDefNpcFromDatabase();
}else if(S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData.error&&!S.dc.defCharData.error)_dcSyncDefNpcFromDatabase();
else{S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();onDcParamChange();return}
renderDcDefStats();
onDcParamChange();
}else{
S.dc.defUnitData=null;S.dc.defCharData=null;
if(S._dcDefPresetNpcBackup){
try{S.dc.defNpc=JSON.parse(JSON.stringify(S._dcDefPresetNpcBackup))}catch(_){S.dc.defNpc=S._dcDefPresetNpcBackup}
const sel=document.getElementById('dcNpcSelect');
if(sel&&S.dc.defNpc&&S.dc.defNpc.npc_id!=null&&String(S.dc.defNpc.npc_id)!==''){
const want=String(S.dc.defNpc.npc_id);
for(let j=0;j<sel.options.length;j++){if(sel.options[j].value===want){sel.selectedIndex=j;break}}
}
}else{S.dc.defNpc=null}
const sel=document.getElementById('dcNpcSelect');
if(!S.dc.defNpc&&sel&&sel.value)selectDcNpc();
else{renderDcDefStats();onDcParamChange()}
}
}
function syncDcManualDefFromInputs(){
if((S.dc.defTargetMode||'preset')!=='custom')return;
S.dc.defNpc=_dcBuildManualDefNpcFromDom();
renderDcDefStats();
onDcParamChange();
}
function _dcSyncAtkModeUiFromState(){
const custom=!!(S.dc.atkUnitData&&S.dc.atkUnitData._manual);
const pw=document.getElementById('dcAtkPresetWrap'),cw=document.getElementById('dcAtkCustomWrap');
const rp=document.getElementById('dcAtkModePreset'),rc=document.getElementById('dcAtkModeCustom');
if(rp)rp.checked=!custom;if(rc)rc.checked=custom;
if(pw)pw.style.display=custom?'none':'';
if(cw)cw.style.display=custom?'':'none';
document.querySelectorAll('.dc-atk-preset-only').forEach(el=>{el.style.display=custom?'none':''});
}
function _dcStatArrUnit(hp,atk,def,mob){
return[{name:'HP',total:hp},{name:'Attack',total:atk},{name:'Defense',total:def},{name:'Mobility',total:mob},{name:'Move',total:0}];
}
function _dcBuildManualAtkUnitFromDom(){
const g=(id)=>parseInt(document.getElementById(id)?.value,10)||0;
const gs=(id)=>String(document.getElementById(id)?.value||'').trim();
const stats=_dcStatArrUnit(g('dcAtkManual_uHP'),g('dcAtkManual_uATK'),g('dcAtkManual_uDEF'),g('dcAtkManual_uMOB'));
const lb0={stats_no_cond:stats,stats:stats,sp_stats:stats,ssp_stats:stats};
const aid=_dcNormalizeManualWeaponAttrId(document.getElementById('dcAtkManual_wAttr')?.value);
const atkLbl=String(document.getElementById('dcAtkManual_wAtkType')?.value||'Ranged');
const wPow=g('dcAtkManual_wPow'),wAcc=g('dcAtkManual_wAcc'),wCrit=g('dcAtkManual_wCrit');
const wMin=Math.max(1,g('dcAtkManual_wMin')),wMax=Math.max(wMin,g('dcAtkManual_wMax'));
const isEx=!!document.getElementById('dcAtkManual_wEx')?.checked;
const w={weapon_type:'1',attribute_id:aid,attribute:'',min_range:wMin,max_range:wMax,is_ex:isEx,levels:[{level:1,power:wPow,accuracy:wAcc,critical:wCrit,en:0,traits:[]}],attack_types:[{label:atkLbl}]};
return{_manual:true,name:gs('dcAtkManual_uName')||'Custom unit',id:'__manual__',lb_data:[lb0],stats:{stats_no_cond:stats},has_sp:false,is_ultimate:true,has_cond_stats:false,tags:[],weapons:[w],body_type:'0',rarity_id:'5'};
}
function _dcBuildManualAtkCharFromDom(){
const g=(id)=>parseInt(document.getElementById(id)?.value,10)||0;
const gs=(id)=>String(document.getElementById(id)?.value||'').trim();
const stats=[{name:'Ranged',total:g('dcAtkManual_cRNG')},{name:'Melee',total:g('dcAtkManual_cMEL')},{name:'Awaken',total:g('dcAtkManual_cAWK')},{name:'Defense',total:g('dcAtkManual_cDEF')},{name:'Reaction',total:g('dcAtkManual_cREA')}];
return{_manual:true,name:gs('dcAtkManual_cName')||'Custom pilot',id:'__manual__',stats:stats,has_sp:false,sp_stats:[],has_conditional_passive:false,has_ex_stats:false,abilities:[],skills:[],rarity_id:'5'};
}
function _dcAtkManualStatsToPack(){
const g=(id)=>parseInt(document.getElementById(id)?.value,10)||0;
const gs=(id)=>String(document.getElementById(id)?.value||'').trim();
return{un:gs('dcAtkManual_uName'),cn:gs('dcAtkManual_cName'),uHP:g('dcAtkManual_uHP'),uATK:g('dcAtkManual_uATK'),uDEF:g('dcAtkManual_uDEF'),uMOB:g('dcAtkManual_uMOB'),cRNG:g('dcAtkManual_cRNG'),cMEL:g('dcAtkManual_cMEL'),cAWK:g('dcAtkManual_cAWK'),cDEF:g('dcAtkManual_cDEF'),cREA:g('dcAtkManual_cREA'),wPow:g('dcAtkManual_wPow'),wAcc:g('dcAtkManual_wAcc'),wCrit:g('dcAtkManual_wCrit'),wMin:g('dcAtkManual_wMin'),wMax:g('dcAtkManual_wMax'),wAttr:_dcNormalizeManualWeaponAttrId(document.getElementById('dcAtkManual_wAttr')?.value),wAtk:gs('dcAtkManual_wAtkType')||'Ranged',wEx:!!document.getElementById('dcAtkManual_wEx')?.checked};
}
function _dcFillManualAtkDomFromPack(p){
const setv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null&&v!==''?String(v):''};
const setc=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=!!v};
setv('dcAtkManual_uName',p.un);setv('dcAtkManual_cName',p.cn);setv('dcAtkManual_uHP',p.uHP);setv('dcAtkManual_uATK',p.uATK);setv('dcAtkManual_uDEF',p.uDEF);setv('dcAtkManual_uMOB',p.uMOB);setv('dcAtkManual_cRNG',p.cRNG);setv('dcAtkManual_cMEL',p.cMEL);setv('dcAtkManual_cAWK',p.cAWK);setv('dcAtkManual_cDEF',p.cDEF);setv('dcAtkManual_cREA',p.cREA);setv('dcAtkManual_wPow',p.wPow);setv('dcAtkManual_wAcc',p.wAcc);setv('dcAtkManual_wCrit',p.wCrit);setv('dcAtkManual_wMin',p.wMin);setv('dcAtkManual_wMax',p.wMax);setv('dcAtkManual_wAttr',_dcNormalizeManualWeaponAttrId(p.wAttr));setv('dcAtkManual_wAtkType',p.wAtk);setc('dcAtkManual_wEx',p.wEx);
}
function _dcManualAtkUnitFromPack(p){
const setv=(k,def)=>{const x=parseInt(p[k],10);return Number.isFinite(x)?x:def};
const stats=_dcStatArrUnit(setv('uHP',0),setv('uATK',0),setv('uDEF',0),setv('uMOB',0));
const lb0={stats_no_cond:stats,stats:stats,sp_stats:stats,ssp_stats:stats};
const aid=_dcNormalizeManualWeaponAttrId(p.wAttr);
const atkLbl=String(p.wAtk||'Ranged');
const wPow=setv('wPow',0),wAcc=setv('wAcc',0),wCrit=setv('wCrit',0);
const wMin=Math.max(1,setv('wMin',1)),wMax=Math.max(wMin,setv('wMax',10));
const isEx=!!p.wEx;
const w={weapon_type:'1',attribute_id:aid,attribute:'',min_range:wMin,max_range:wMax,is_ex:isEx,levels:[{level:1,power:wPow,accuracy:wAcc,critical:wCrit,en:0,traits:[]}],attack_types:[{label:atkLbl}]};
return{_manual:true,name:String(p.un||'Custom unit'),id:'__manual__',lb_data:[lb0],stats:{stats_no_cond:stats},has_sp:false,is_ultimate:true,has_cond_stats:false,tags:[],weapons:[w],body_type:'0',rarity_id:'5'};
}
function _dcManualAtkCharFromPack(p){
const setv=(k,def)=>{const x=parseInt(p[k],10);return Number.isFinite(x)?x:def};
const stats=[{name:'Ranged',total:setv('cRNG',0)},{name:'Melee',total:setv('cMEL',0)},{name:'Awaken',total:setv('cAWK',0)},{name:'Defense',total:setv('cDEF',0)},{name:'Reaction',total:setv('cREA',0)}];
return{_manual:true,name:String(p.cn||'Custom pilot'),id:'__manual__',stats:stats,has_sp:false,sp_stats:[],has_conditional_passive:false,has_ex_stats:false,abilities:[],skills:[],rarity_id:'5'};
}
function setDcAtkTargetMode(mode){
if(mode==='custom'){
if(S.dc.atkUnitData&&!S.dc.atkUnitData._manual&&(S.dc.atkUnit||S.dc.atkChar))
try{S._dcAtkPresetBackup=_dcReadAttackerFromDc()}catch(_){S._dcAtkPresetBackup=null}
if(S._dcAtkManualPackBackup)_dcFillManualAtkDomFromPack(S._dcAtkManualPackBackup);
S.dc.atkUnit='__manual__';S.dc.atkChar='__manual__';
S.dc.atkUnitData=_dcBuildManualAtkUnitFromDom();
S.dc.atkCharData=_dcBuildManualAtkCharFromDom();
S.dc.atkUnitData._manual=true;
S.dc._unitIsSD=false;
S.dc.lbTier=0;
S.dc.wpnIdx=0;S.dc.wpnLv=0;
S.dc._wpnTraitDistPow=0;S.dc._wpnTraitHpPow=0;S.dc._wpnTraits={};S.dc._wpnCritDmgUp=0;
S.dc._vigorCondThreshold=null;
_dcSyncAtkModeUiFromState();
renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
onDcParamChange();
}else{
if(S.dc.atkUnitData&&S.dc.atkUnitData._manual)
try{S._dcAtkManualPackBackup=_dcAtkManualPackFromSlot(_dcReadAttackerFromDc())}catch(_){}
if(S._dcAtkPresetBackup){
try{_dcWriteAttackerToDc(S._dcAtkPresetBackup)}catch(_){S._dcAtkPresetBackup=null;S.dc.atkUnit=null;S.dc.atkChar=null;S.dc.atkUnitData=null;S.dc.atkCharData=null;S.dc._unitIsSD=false}
}
if(!S._dcAtkPresetBackup||!S.dc.atkUnitData||S.dc.atkUnitData._manual){
if(!S.dc.atkUnitData||S.dc.atkUnitData._manual){
S.dc.atkUnit=null;S.dc.atkChar=null;S.dc.atkUnitData=null;S.dc.atkCharData=null;
S.dc._unitIsSD=false;
const uA=document.getElementById('dcAtkUnitArea'),cA=document.getElementById('dcAtkCharArea'),sA=document.getElementById('dcAtkStatsArea');
if(uA)uA.innerHTML=`<button class="dc-pick-btn" onclick="openDcPicker('unit')" id="dcPickUnitBtn">${t('dc_pick_unit')}</button>`;
if(cA)cA.innerHTML=`<button class="dc-pick-btn" onclick="openDcPicker('character')" id="dcPickCharBtn">${t('dc_pick_char')}</button>`;
if(sA)sA.innerHTML='';
}
}
_dcSyncAtkModeUiFromState();
renderDcWeaponArea();renderDcOptionParts();renderDcSupporters();renderDcAtkUnit();renderDcAtkChar();
onDcParamChange();
}
}
function syncDcManualAtkFromInputs(){
if(!S.dc.atkUnitData||!S.dc.atkUnitData._manual)return;
S.dc.atkUnitData=_dcBuildManualAtkUnitFromDom();
S.dc.atkCharData=_dcBuildManualAtkCharFromDom();
renderDcAtkUnit();renderDcAtkChar();
onDcParamChange();
}
function _dcAtkManualPackFromSlot(sl){
const u=sl.atkUnitData,c=sl.atkCharData,w=u&&u.weapons&&u.weapons[0];
const st=u&&u.lb_data&&u.lb_data[0]?u.lb_data[0].stats_no_cond:null;
const fg=(name)=>{if(!st)return 0;const x=st.find(s=>s.name===name);return x?Math.round(x.total||0):0};
const fc=(name)=>{if(!c||!c.stats)return 0;const x=c.stats.find(s=>s.name===name);return x?Math.round(x.total||0):0};
const lv=w&&w.levels&&w.levels[0]?w.levels[0]:{};
const atkLbl=(w&&w.attack_types&&w.attack_types[0]&&w.attack_types[0].label)||'Ranged';
return{un:u?u.name:'',cn:c?c.name:'',uHP:fg('HP'),uATK:fg('Attack'),uDEF:fg('Defense'),uMOB:fg('Mobility'),cRNG:fc('Ranged'),cMEL:fc('Melee'),cAWK:fc('Awaken'),cDEF:fc('Defense'),cREA:fc('Reaction'),wPow:lv.power||0,wAcc:lv.accuracy||0,wCrit:lv.critical||0,wMin:w?w.min_range||1:1,wMax:w?w.max_range||10:10,wAttr:_dcNormalizeManualWeaponAttrId(w&&w.attribute_id),wAtk:atkLbl,wEx:!!(w&&w.is_ex)};
}
function _dcPackShareState(){
onDcParamChange();
_dcSnapActiveAttackerToSlot();
const slots=S.dc.atkSlots||[];
const slotArr=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=slots[i];
if(!sl||!sl.atkUnit||!sl.atkChar){slotArr.push(null);continue}
const o={};
if(sl.atkUnitData&&sl.atkUnitData._manual){
o.atkM=1;
o.atkP=_dcAtkManualPackFromSlot(sl);
}else{
o.u=sl.atkUnit;
o.c=sl.atkChar;
if(sl.atkUnitData&&!sl.atkUnitData._manual){
const _pbPack=_dcPickBestWeaponIndices(sl.atkUnitData);
if(sl.wpnIdx!==_pbPack.wpnIdx||sl.wpnLv!==_pbPack.wpnLv){o.wi=sl.wpnIdx;o.wl=sl.wpnLv}
}
}
if(sl.lbTier!==3)o.lb=sl.lbTier;
if((sl.unitStatMode||'normal')!=='normal')o.um=sl.unitStatMode;
if((sl.charStatMode||'normal')!=='normal')o.cm=sl.charStatMode;
if((sl.mpLevel||'medium')!=='medium')o.v=sl.mpLevel;
if((sl.terrainMode||'normal')!=='normal')o.t=sl.terrainMode;
if(sl.finalWpnPow)o.fwp=sl.finalWpnPow;
if(sl.dmgIncrease)o.di=sl.dmgIncrease;
if(sl.critDmgUp)o.cu=sl.critDmgUp;
if((sl.exSquadAtkPct|0)>0)o.exa=sl.exSquadAtkPct;else if(sl.exSquadAtkPctExplicitZero)o.exa=0;
if(_dcSlotShouldPackSquadCond(sl))o.sqc=sl.squadCondPct|0;
if(sl._wpnTraitDistPow)o.td=sl._wpnTraitDistPow;
if(sl._wpnTraitHpPow)o.th=sl._wpnTraitHpPow;
if(sl.unitCondPassive)o.ucp=1;
if(sl.charCondPassive)o.ccp=1;
if((sl.dcSuperchargedExTier|0)>0)o.cex=sl.dcSuperchargedExTier|0;
if(sl.atkCounterOwnAtk)o.acoa=1;
if(sl.supportCounterAtk)o.sac=1;
if(sl.unitTurnBuffAtk)o.uta=1;
if(sl.unitTurnBuffDef)o.utd=1;
if(sl.masterLeagueBuff)o.mlb=1;
if(sl.grandOffensiveBuff)o.ogb=1;
if(sl.applyAdvantageEnemyTag===false)o.ae=0;
const op=sl.optionParts&&sl.optionParts[0];
if(op&&op.id!=null)o.op=op.id;
const sp=sl.supporters&&sl.supporters[0];
if(sp&&sp.id!=null){
o.sp=sp.id;
if((sp._dcLevel||100)!==100)o.spl=sp._dcLevel;
if((sp._dcLbTier!==undefined?sp._dcLbTier:3)!==3)o.spb=sp._dcLbTier;
}
slotArr.push(o);
}
const stgSel=document.getElementById('dcStageSelect');
const npcSel=document.getElementById('dcNpcSelect');
const defNpc=S.dc.defNpc;
const D={};
const _dtm=S.dc.defTargetMode||'preset';
if(_dtm==='preset'){
if(defNpc&&defNpc.npc_id!=null&&String(defNpc.npc_id)!==''){
D.n=String(defNpc.npc_id);
if(stgSel&&stgSel.value)D.s=stgSel.value;
}else if(npcSel&&npcSel.value){
D.n=npcSel.value;
if(stgSel&&stgSel.value)D.s=stgSel.value;
}else if(stgSel&&stgSel.value)D.s=stgSel.value;
}
if(S.dc.dmgTakenDownPilot)D.dtp=S.dc.dmgTakenDownPilot;
if(S.dc.dmgTakenDownUnit)D.dttu=S.dc.dmgTakenDownUnit;
if(S.dc.defDebuffPct)D.defp=S.dc.defDebuffPct;
if(S.dc.dtuBeam)D.dtb=S.dc.dtuBeam;
if(S.dc.dtuPhysical)D.dtph=S.dc.dtuPhysical;
if(S.dc.dtuSpecial)D.dts=S.dc.dtuSpecial;
if(S.dc.defending)D.def=1;
if(S.dc.shield)D.sh=1;
if(S.dc.defNpcMapBonusesOn===false)D.nmb=0;
const out={v:1,a:S.dc.atkSlotIndex|0,S:slotArr};
if(Object.keys(D).length)out.D=D;
if(_dtm==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData._manual&&!S.dc.defCharData._manual&&!S.dc.defUnitData.error&&!S.dc.defCharData.error){
out.defDb=1;
out.defU=String(S.dc.defUnitData.id);
out.defC=String(S.dc.defCharData.id);
if((S.dc.defLbTier|0)!==3)out.defLT=S.dc.defLbTier|0;
}
if(_dtm==='custom'){out.defM=1;out.defC=_dcDefManualStatsToPack()}
return out;
}
async function _dcLoadSlotFromPackedObj(o){
if(!o)return null;
const slot=_dcCreateEmptyAttackerSlot();
if(o.atkM&&o.atkP){
slot.atkUnit='__manual__';
slot.atkChar='__manual__';
slot.atkUnitData=_dcManualAtkUnitFromPack(o.atkP);
slot.atkCharData=_dcManualAtkCharFromPack(o.atkP);
slot.atkUnitData._manual=true;
slot._unitIsSD=false;
slot._vigorCondThreshold=null;
slot.wpnIdx=0;slot.wpnLv=0;slot.lbTier=0;
}else{
if(!o.u||!o.c)return null;
const uid=String(o.u),cid=String(o.c);
let ur,cr;
try{
[ur,cr]=await Promise.all([
fetch(`/api/unit/${uid}?lang=${S.lang}`).then(r=>r.json()),
fetch(`/api/character/${cid}?lang=${S.lang}`).then(r=>r.json())
]);
}catch(_){return null}
slot.atkUnit=uid;slot.atkChar=cid;
slot.atkUnitData=ur;slot.atkCharData=cr;
slot._unitIsSD=String(ur.body_type||'')==='3';
slot._vigorCondThreshold=_dcVigorThresholdFromUnit(ur);
if(o.wi!==undefined){const n=parseInt(o.wi,10);if(!Number.isNaN(n)&&n>=0)slot.wpnIdx=n}else slot.wpnIdx=0;
if(o.wl!==undefined){const n=parseInt(o.wl,10);if(!Number.isNaN(n)&&n>=0)slot.wpnLv=n}
else if(o.wi!==undefined){
const _wpUn=_dcNonMapWeapons(ur);
const _wUn=_wpUn[slot.wpnIdx];
slot.wpnLv=_wUn?_dcDefaultWpnLvIndex(_wUn):0;
}else slot.wpnLv=0;
if(o.wi===undefined&&o.wl===undefined){const _pb=_dcPickBestWeaponIndices(ur);slot.wpnIdx=_pb.wpnIdx;slot.wpnLv=_pb.wpnLv}
const _wpFix=_dcNonMapWeapons(ur);
if(_wpFix.length&&((slot.wpnIdx|0)<0||(slot.wpnIdx|0)>=_wpFix.length)){const _pb2=_dcPickBestWeaponIndices(ur);slot.wpnIdx=_pb2.wpnIdx;slot.wpnLv=_pb2.wpnLv}
else{const _cwFix=_wpFix[slot.wpnIdx|0];if(_cwFix&&_cwFix.levels&&_cwFix.levels.length&&(slot.wpnLv|0)>=_cwFix.levels.length)slot.wpnLv=_cwFix.levels.length-1}
if(o.lb!==undefined){const n=parseInt(o.lb,10);if(!Number.isNaN(n)&&n>=0)slot.lbTier=n}
}
const um=o.um;if(um==='normal'||um==='sp'||um==='ssp')slot.unitStatMode=um;
const cm=o.cm;if(cm==='normal'||cm==='sp')slot.charStatMode=cm;
if(o.v)slot.mpLevel=o.v;
else slot._dcNeedAutoMp=true;
if(o.t==='halved'){slot.terrainMode='halved';slot.terrain=50}
else if(o.t){slot.terrainMode=o.t;slot.terrain=0}
else{slot.terrainMode='normal';slot.terrain=0}
if(o.fwp!==undefined){const n=parseInt(o.fwp,10);if(Number.isFinite(n))slot.finalWpnPow=n}
if(o.di!==undefined){const n=parseInt(o.di,10);if(Number.isFinite(n)){slot.dmgIncrease=n;slot._dmgIncreasePacked=n}}
if(o.cu!==undefined){const n=parseInt(o.cu,10);if(Number.isFinite(n)){slot.critDmgUp=n;slot._critDmgUpPacked=n}}
if(o.exa!==undefined){const n=parseInt(o.exa,10);if(Number.isFinite(n)){slot.exSquadAtkPct=Math.min(20,Math.max(0,n));slot.exSquadAtkPctExplicitZero=(n===0)}}else slot.exSquadAtkPctExplicitZero=false;
if(o.sqc!==undefined){const n=parseInt(o.sqc,10);if(Number.isFinite(n))slot.squadCondPct=Math.max(0,n);else slot.squadCondPct=0}
else if(!o.atkM)slot._dcSquadCondShareMissing=1;
if(o.td!==undefined){const n=parseInt(o.td,10);if(!Number.isNaN(n)&&n>=0)slot._wpnTraitDistPow=n}
if(o.th!==undefined){const n=parseInt(o.th,10);if(!Number.isNaN(n)&&n>=0)slot._wpnTraitHpPow=n}
if(o.ucp)slot.unitCondPassive=true;
if(o.ccp)slot.charCondPassive=true;
if(o.cex!==undefined){const n=parseInt(o.cex,10);if(!Number.isNaN(n)&&n>=0)slot.dcSuperchargedExTier=n}
if(slot.atkCharData&&!slot.atkCharData._manual){const _xt=slot.atkCharData.ex_supercharged_tiers;if(_xt&&_xt.length>1)slot.dcSuperchargedExTier=Math.min(Math.max(0,slot.dcSuperchargedExTier|0),_xt.length-1);else slot.dcSuperchargedExTier=0}
if(o.acoa)slot.atkCounterOwnAtk=true;
if(o.sac)slot.supportCounterAtk=true;
slot.supportCntPairSnap=_dcSupportCntEligiblePairSnap(slot.atkCharData,slot.atkUnitData)||null;
if(o.uta)slot.unitTurnBuffAtk=true;
if(o.utd)slot.unitTurnBuffDef=true;
if(o.mlb)slot.masterLeagueBuff=true;
if(o.ogb)slot.grandOffensiveBuff=true;
if(o.ae===0)slot.applyAdvantageEnemyTag=false;
const opId=o.op;
if(opId&&!o.atkM){
const uidForOp=String(slot.atkUnit||'');
try{
const r=await fetch(`/api/option_parts?lang=${S.lang}&page=1&per_page=100&q=${encodeURIComponent(String(opId))}&unit_id=${encodeURIComponent(uidForOp)}`);
const d=await r.json();
const hit=(d.rows||[]).find(x=>String(x.id)===String(opId));
if(hit)slot.optionParts=[{id:hit.id,name:hit.name,details:hit.details||'',thum:hit.thum||'',tags:hit.tags||[]}];
}catch(_){}
}
const spId=o.sp;
if(spId){
const lv=Math.min(100,Math.max(1,parseInt(o.spl!==undefined?o.spl:100,10)));
const lb=Math.min(3,Math.max(0,parseInt(o.spb!==undefined?o.spb:3,10)));
try{
let cq='';
if(slot.atkUnit&&slot.atkUnit!=='__manual__')cq+='&for_unit_id='+encodeURIComponent(String(slot.atkUnit));
if(slot.atkChar&&slot.atkChar!=='__manual__')cq+='&for_char_id='+encodeURIComponent(String(slot.atkChar));
const rd=await fetch(`/api/supporter/${spId}?lang=${S.lang}&level=${lv}&lb_tier=${lb}${cq}`).then(r=>r.json());
if(rd&&!rd.error){rd._dcLevel=lv;rd._dcLbTier=lb;slot.supporters=[rd]}
}catch(_){}
}
return slot;
}
async function _dcApplyPackedShareState(obj){
const D=obj.D||{};
const preset=document.getElementById('dcDefModePreset');
const custom=document.getElementById('dcDefModeCustom');
const database=document.getElementById('dcDefModeDatabase');
const pw=document.getElementById('dcDefPresetWrap');
const cw=document.getElementById('dcDefCustomWrap');
const dbw=document.getElementById('dcDefDatabaseWrap');
if(obj.defDb&&obj.defU&&obj.defC){
S.dc.defTargetMode='database';
{const n=parseInt(obj.defLT,10);S.dc.defLbTier=obj.defLT!=null&&!Number.isNaN(n)?Math.min(3,Math.max(0,n)):3;}
renderDcDefDbPicks();
if(preset)preset.checked=false;
if(custom)custom.checked=false;
if(database)database.checked=true;
if(pw)pw.style.display='none';
if(cw)cw.style.display='none';
if(dbw)dbw.style.display='block';
const uid=String(obj.defU),cid=String(obj.defC);
try{
const[ur,cr]=await Promise.all([
fetch(`/api/unit/${encodeURIComponent(uid)}?lang=${S.lang}`).then(r=>r.json()),
fetch(`/api/character/${encodeURIComponent(cid)}?lang=${S.lang}`).then(r=>r.json())
]);
if(!ur.error&&!cr.error){S.dc.defUnitData=ur;S.dc.defCharData=cr;_dcSyncDefNpcFromDatabase();}
else{S.dc.defUnitData=null;S.dc.defCharData=null;S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();}
}catch(_){S.dc.defUnitData=null;S.dc.defCharData=null;S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();}
}else if(obj.defM===1&&obj.defC){
S.dc.defTargetMode='custom';
S.dc.defUnitData=null;S.dc.defCharData=null;
_dcFillManualDefDomFromPack(obj.defC);
if(preset)preset.checked=false;
if(custom)custom.checked=true;
if(database)database.checked=false;
if(pw)pw.style.display='none';
if(cw)cw.style.display='block';
if(dbw)dbw.style.display='none';
S.dc.defNpc=_dcManualDefNpcFromDefC(obj.defC);
}else{
S.dc.defTargetMode='preset';
S.dc.defUnitData=null;S.dc.defCharData=null;
if(preset)preset.checked=true;
if(custom)custom.checked=false;
if(database)database.checked=false;
if(pw)pw.style.display='';
if(cw)cw.style.display='none';
if(dbw)dbw.style.display='none';
if(D.s){
const sel=document.getElementById('dcStageSelect');
if(sel){sel.value=D.s;if(sel.value===D.s)await onDcStageChange()}
}
}
const arr=Array.isArray(obj.S)?obj.S:[null,null,null];
const loaded=await Promise.all([0,1,2].map(i=>{
const o=arr[i];
return o?_dcLoadSlotFromPackedObj(o):Promise.resolve(null);
}));
const slots=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++)slots.push(loaded[i]||_dcCreateEmptyAttackerSlot());
S.dc.atkSlots=slots;
_dcDedupeSsrOptionPartsAcrossDcSlots();
for(let si=0;si<DC_ATK_SLOT_COUNT;si++){
const sl=S.dc.atkSlots[si];
if(!sl||!sl.atkUnitData||!sl._dcNeedAutoMp)continue;
_dcWriteAttackerToDc(sl);
_dcAutoSetVigor();
sl.mpLevel=S.dc.mpLevel;
delete sl._dcNeedAutoMp;
}
const asRaw=parseInt(obj.a||'0',10);
const ai=Number.isNaN(asRaw)?0:Math.min(Math.max(asRaw,0),DC_ATK_SLOT_COUNT-1);
S.dc.atkSlotIndex=ai;
_dcWriteAttackerToDc(S.dc.atkSlots[S.dc.atkSlotIndex]);
_dcDetectVigorCondAbilities(S.dc.atkUnitData);
_dcSyncUnitCondPassiveFromVigor();
_dcSyncAttackerDomFromDc();
S.dc.atkSlots[S.dc.atkSlotIndex]=_dcReadAttackerFromDc();
if((S.dc.defTargetMode||'preset')==='preset'&&D.n){const nSel=document.getElementById('dcNpcSelect');if(nSel){nSel.value=D.n;selectDcNpc()}}
if(D.dtp!==undefined){const el=document.getElementById('dcDmgTakenDownPilot');if(el)el.value=String(D.dtp)}
if(D.dttu!==undefined){const el=document.getElementById('dcDmgTakenDownUnit');if(el)el.value=String(D.dttu)}
if(D.defp!==undefined){const el=document.getElementById('dcDefDebuffPct');if(el)el.value=String(D.defp)}
if(D.dtb!==undefined){const el=document.getElementById('dcDtuBeam');if(el)el.value=String(D.dtb)}
if(D.dtph!==undefined){const el=document.getElementById('dcDtuPhysical');if(el)el.value=String(D.dtph)}
if(D.dts!==undefined){const el=document.getElementById('dcDtuSpecial');if(el)el.value=String(D.dts)}
if(D.def===1)setDcDefend(true);
if(D.sh===1)setDcShield(true);
if(D.nmb===0)S.dc.defNpcMapBonusesOn=false;else S.dc.defNpcMapBonusesOn=true;
const _dmbEl=document.getElementById('dcDefNpcMapBonusesOn');if(_dmbEl)_dmbEl.checked=S.dc.defNpcMapBonusesOn!==false;
_dcUpdateDefNpcMapBonusesToggleUi();
const _asl=S.dc.atkSlots[S.dc.atkSlotIndex|0];
if(_asl&&_asl.atkUnitData&&_asl.atkUnitData._manual)_dcFillManualAtkDomFromPack(_dcAtkManualPackFromSlot(_asl));
_dcSyncAtkModeUiFromState();
}
async function _dcCheckUrlParams(){
const p=new URLSearchParams(location.search);
const _t=p.get('tab');
if(_t!=='calculator'&&_t!=='DS')return;
initDmgCalc();switchTab('calculator');
await renderDcStageDropdown();
let isMultiSlotUrl=false;
const dcRaw=p.get('dc');
if(dcRaw){
try{
const obj=JSON.parse(_dcB64UrlDecode(dcRaw));
if(obj&&obj.v===1){
await _dcApplyPackedShareState(obj);
isMultiSlotUrl=true;
}
}catch(e){console.warn('dc share payload',e)}
}
renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
if(isMultiSlotUrl){
_dcSyncAttackerDomFromDc();
const thp=S.dc._wpnTraitHpPow|0;const tel2=document.getElementById('dcWpnTraitHpPow');if(tel2)tel2.value=String(thp);
const si=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
const sl=S.dc.atkSlots&&S.dc.atkSlots[si];
if(sl){
if(sl._dmgIncreasePacked!=null){const el=document.getElementById('dcDmgIncrease');if(el)el.value=String(sl._dmgIncreasePacked);S.dc.dmgIncrease=sl._dmgIncreasePacked;delete sl._dmgIncreasePacked}
if(sl._critDmgUpPacked!=null){const el=document.getElementById('dcCritDmgUp');if(el)el.value=String(sl._critDmgUpPacked);S.dc.critDmgUp=sl._critDmgUpPacked;delete sl._critDmgUpPacked}
}
S.dc._integratedWpnCritDmgUp=S.dc._wpnCritDmgUp|0;
}
onDcParamChange();
if(!isMultiSlotUrl){
S.dc.atkSlotIndex=0;
S.dc.atkSlots=[_dcReadAttackerFromDc(),_dcCreateEmptyAttackerSlot(),_dcCreateEmptyAttackerSlot()];
}
_dcRefreshAtkSlotUi();
}

const TB_FORMS_KEY='ggen_tb_forms';
const TB_TRASH_ICON='/static/images/UI/UI_Common_BtnIcon_Trash.webp';
const TB_LEADER_ICON='/static/images/UI/UI_Organization_Icon_SupporterLeader_Posi.webp';
const TB_LONG_PORTRAIT_FACE_IDS=new Set(['1370000150']);
function _tbEmptySlot(){return{unitId:null,unitData:null,charId:null,charData:null,optionParts:[],lbTier:3,unitStatMode:'normal',unitCondPassive:false,charCondPassive:false,unitTurnBuffAtk:false,unitTurnBuffDef:false,exSquadAtkPct:0}}
function _tbTerrainItems(){return['Space','Atmospheric','Ground','Sea','Underwater']}
function tbClearSupporter(side){
initTeamBuilder();
const s=side|0;
if(s!==1&&s!==2)return;
S.tb.supBySide[s]={id:null,data:null,lbTier:3,level:100};
S.tb._leaderApplyCache={};
tbInvalidateTbPickerUnitCache();
renderTeamBuilder();
}
function tbClearSquad(side){
initTeamBuilder();
const s=side|0;
if(s!==1&&s!==2)return;
const squ=S.tb.squads[s];
if(!squ||!Array.isArray(squ.slots))return;
for(let i=0;i<5;i++)squ.slots[i]=_tbEmptySlot();
S.tb._leaderApplyCache={};
tbInvalidateTbPickerUnitCache();
renderTeamBuilder();
}
function initTeamBuilder(){
if(!S.tb){
S.tb={squads:{1:{name:'',slots:Array.from({length:5},()=>_tbEmptySlot())},2:{name:'',slots:Array.from({length:5},()=>_tbEmptySlot())}},terrainType:'Space',supBySide:{1:{id:null,data:null,lbTier:3,level:100},2:{id:null,data:null,lbTier:3,level:100}},selectedKey:null,rearrange:null,picker:{type:null,slotKey:null,abort:null,gen:0,rows:[],opReplaceIdx:null},masterLeague:false,grandOffensive:false,_leaderApplyCache:{}};
return;
}
if(!S.tb.supBySide){
const legId=S.tb.supporterId!=null?S.tb.supporterId:null;
const legData=S.tb.supporterData||null;
S.tb.supBySide={1:{id:legId,data:legData,lbTier:3,level:100},2:{id:null,data:null,lbTier:3,level:100}};
delete S.tb.supporterId;delete S.tb.supporterData;
}else{
for(const ss of[1,2]){const e=S.tb.supBySide[ss];if(e){if(e.lbTier==null)e.lbTier=3;if(e.level==null)e.level=100}}
}
for(const side of[1,2]){
const w=S.tb.squads&&S.tb.squads[side];
if(!w||!Array.isArray(w.slots))continue;
if(w.name==null)w.name='';
if(w.slots.length===5)continue;
const next=w.slots.slice(0,5);
while(next.length<5)next.push(_tbEmptySlot());
w.slots=next;
}
delete S.tb.activeSquad;
}
function _tbReadFormations(){try{const s=localStorage.getItem(TB_FORMS_KEY);const a=JSON.parse(s);if(!Array.isArray(a)||a.length<5)throw 0;return a.map((x,i)=>({name:String((x&&x.name)||'').trim()||('Formation '+(i+1)),data:x&&x.data||null}))}catch(_){return Array.from({length:5},(_,i)=>({name:'Formation '+(i+1),data:null}))}}
function _tbWriteFormations(arr){try{localStorage.setItem(TB_FORMS_KEY,JSON.stringify(arr))}catch(_){}}
function _tbSlotToSave(sl){const o={unitId:sl.unitId,charId:sl.charId,optionPartIds:(sl.optionParts||[]).slice(0,1).map(p=>String(p&&p.id||'')).filter(Boolean),lbTier:sl.lbTier|0,unitCondPassive:!!sl.unitCondPassive,charCondPassive:!!sl.charCondPassive,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,exSquadAtkPct:sl.exSquadAtkPct|0};if((sl.unitStatMode||'normal')!=='normal')o.um=sl.unitStatMode;if(sl.unitTurnBuffDef)o.utd=1;return o}
function tbSnapshot(){initTeamBuilder();return{v:1,terrainType:S.tb.terrainType,masterLeague:!!S.tb.masterLeague,grandOffensive:!!S.tb.grandOffensive,supporter1:S.tb.supBySide[1].id,supporter2:S.tb.supBySide[2].id,supLb1:S.tb.supBySide[1].lbTier!=null?S.tb.supBySide[1].lbTier|0:3,supLb2:S.tb.supBySide[2].lbTier!=null?S.tb.supBySide[2].lbTier|0:3,supLv1:S.tb.supBySide[1].level!=null?Math.min(100,Math.max(1,S.tb.supBySide[1].level|0)):100,supLv2:S.tb.supBySide[2].level!=null?Math.min(100,Math.max(1,S.tb.supBySide[2].level|0)):100,squads:{1:{name:String(S.tb.squads[1].name||'').trim().slice(0,40),slots:S.tb.squads[1].slots.map(_tbSlotToSave)},2:{name:String(S.tb.squads[2].name||'').trim().slice(0,40),slots:S.tb.squads[2].slots.map(_tbSlotToSave)}}}}
const _TB_TERRAIN_IDX=['Space','Atmospheric','Ground','Sea','Underwater'];
function _tbU8ToB64Url(u8){
let bin='';
for(let i=0;i<u8.length;i++)bin+=String.fromCharCode(u8[i]);
return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _tbB64UrlToU8(s){
if(!s)return new Uint8Array(0);
let pad=String(s).replace(/-/g,'+').replace(/_/g,'/');
while(pad.length%4)pad+='=';
const bin=atob(pad);
const u8=new Uint8Array(bin.length);
for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
return u8;
}
function _tbEncShareSlot(sl){
if(!sl||!sl.unitId)return null;
const o=_tbSlotToSave(sl);
const u=String(o.unitId),c=o.charId?String(o.charId):'',op=(o.optionPartIds&&o.optionPartIds[0])?String(o.optionPartIds[0]):'';
const l=o.lbTier|0,f=(o.unitCondPassive?1:0)|(o.charCondPassive?2:0)|(o.unitTurnBuffAtk?4:0)|(o.utd?8:0),x=o.exSquadAtkPct|0;
const um=o.um==='sp'?1:o.um==='ssp'?2:0;
const a=[u,c,op,l,f,x,um];
while(a.length>6&&a[6]===0)a.pop();
while(a.length>5&&a[5]===0)a.pop();
while(a.length>4&&a[4]===0)a.pop();
while(a.length>3&&a[3]===3)a.pop();
while(a.length>2&&a[2]==='')a.pop();
while(a.length>1&&a[1]==='')a.pop();
return a;
}
function _tbDecShareSlot(a){
if(a==null)return null;
if(typeof a==='string')a=[a];
if(!Array.isArray(a)||!a.length)return null;
const u=a[0];if(!u)return null;
const c=a.length>1?String(a[1]||''):'';
const op=a.length>2?String(a[2]||''):'';
const l=a.length>3?a[3]|0:3;
const f=a.length>4?a[4]|0:0;
const x=a.length>5?a[5]|0:0;
const um=a.length>6?a[6]|0:0;
const umStr=um===1?'sp':um===2?'ssp':'normal';
const out={unitId:String(u),charId:c||null,optionPartIds:op?[op]:[],lbTier:l,unitCondPassive:!!(f&1),charCondPassive:!!(f&2),unitTurnBuffAtk:!!(f&4),exSquadAtkPct:x};
if(f&8)out.utd=1;
if(umStr!=='normal')out.um=umStr;
return out;
}
function _tbPackShareSup(ss){
const e=S.tb.supBySide[ss];
if(!e||!e.id)return null;
const id=String(e.id),lb=e.lbTier|0,lv=Math.min(100,Math.max(1,e.level|0));
if(lb===3&&lv===100)return id;
if(lv===100)return[id,lb];
return[id,lb,lv];
}
function _tbUnpackShareSup(x){
if(x==null)return{id:null,lbTier:3,level:100};
if(typeof x==='string')return{id:x,lbTier:3,level:100};
if(!Array.isArray(x)||!x.length)return{id:null,lbTier:3,level:100};
const id=x[0]!=null?String(x[0]):null;
const lb=x.length>1?x[1]|0:3;
const lv=x.length>2?x[2]|0:100;
return{id,lbTier:lb,level:Math.min(100,Math.max(1,lv))};
}
function _tbSnapshotCompactV2(){
initTeamBuilder();
const te=Math.max(0,_TB_TERRAIN_IDX.indexOf(S.tb.terrainType||'Space'));
const s1=_tbPackShareSup(1),s2=_tbPackShareSup(2);
const slotsTrim=(slots)=>{
const enc=slots.map(_tbEncShareSlot);
while(enc.length&&enc[enc.length-1]==null)enc.pop();
return enc;
};
const q=[
[String(S.tb.squads[1].name||'').trim().slice(0,40),slotsTrim(S.tb.squads[1].slots)],
[String(S.tb.squads[2].name||'').trim().slice(0,40),slotsTrim(S.tb.squads[2].slots)]
];
const o={v:2,q:q};
if(S.tb.masterLeague)o.m=1;
if(S.tb.grandOffensive)o.g=1;
if(te!==0)o.e=te;
if(s1!=null||s2!=null)o.s=[s1,s2];
return o;
}
function _tbExpandSnapshotV2(z){
if(!z||z.v!==2)return null;
const terrainType=_TB_TERRAIN_IDX[z.e!=null?z.e|0:0]||'Space';
const s=z.s;
const p1=_tbUnpackShareSup(s&&s[0]),p2=_tbUnpackShareSup(s&&s[1]);
const q=z.q||[[],[]];
const n1=q[0]&&q[0][0]!=null?String(q[0][0]).slice(0,40):'';
const n2=q[1]&&q[1][0]!=null?String(q[1][0]).slice(0,40):'';
const raw1=(q[0]&&q[0][1])||[];
const raw2=(q[1]&&q[1][1])||[];
const pad5=(arr)=>{
const out=[];
for(let i=0;i<5;i++)out.push(_tbDecShareSlot(arr&&arr[i]!=null?arr[i]:null));
return out;
};
return{v:1,terrainType,masterLeague:!!z.m,grandOffensive:!!z.g,supporter1:p1.id,supporter2:p2.id,supLb1:p1.lbTier,supLb2:p2.lbTier,supLv1:p1.level,supLv2:p2.level,squads:{1:{name:n1,slots:pad5(raw1)},2:{name:n2,slots:pad5(raw2)}}};
}
async function _tbDecodeTeamShare(b64){
const u8=_tbB64UrlToU8(b64);
if(!u8.length)return null;
if(u8[0]===0x7b){
try{return JSON.parse(new TextDecoder().decode(u8))}catch(_){return null}
}
const kind=u8[0],body=u8.slice(1);
if(kind===1){
try{
if(typeof DecompressionStream==='undefined')return null;
const ds=new DecompressionStream('deflate');
const stream=new Blob([body]).stream().pipeThrough(ds);
const out=await new Response(stream).arrayBuffer();
return JSON.parse(new TextDecoder().decode(out));
}catch(_){return null}
}
if(kind===2){
try{return JSON.parse(new TextDecoder().decode(body))}catch(_){return null}
}
return null;
}
async function _tbBuildShareUrl(){
initTeamBuilder();
let finalU8;
try{
const compact=_tbSnapshotCompactV2();
const json=JSON.stringify(compact);
const bytes=new TextEncoder().encode(json);
if(typeof CompressionStream!=='undefined'){
try{
const cs=new CompressionStream('deflate');
const blob=new Blob([bytes]).stream().pipeThrough(cs);
const comp=new Uint8Array(await new Response(blob).arrayBuffer());
if(comp.length+1<bytes.length){
finalU8=new Uint8Array(1+comp.length);
finalU8[0]=1;
finalU8.set(comp,1);
}else{
finalU8=new Uint8Array(1+bytes.length);
finalU8[0]=2;
finalU8.set(bytes,1);
}
}catch(_){
finalU8=new Uint8Array(1+bytes.length);
finalU8[0]=2;
finalU8.set(bytes,1);
}
}else{
finalU8=new Uint8Array(1+bytes.length);
finalU8[0]=2;
finalU8.set(bytes,1);
}
}catch(_){return''}
const enc=_tbU8ToB64Url(finalU8);
if(!enc)return'';
const u=new URL(location.origin+location.pathname);
u.searchParams.set('tab','TB');
u.searchParams.set('team',enc);
return u.toString()
}
function tbSyncSquadNameFromFormation(side,inp){
if(!inp)return;
initTeamBuilder();
S.tb.squads[side|0].name=String(inp.value||'').trim().slice(0,40);
inp.value=S.tb.squads[side|0].name;
tbSyncSquadLabels();
}
function _tbFormationOptionPartsHtmlForSquad(si){
initTeamBuilder();
const seen=new Map();
const squ=S.tb.squads[si];
for(let i=0;i<5;i++){
const sl=squ.slots[i];
(sl.optionParts||[]).forEach(p=>{if(!p||p.id==null)return;const id=String(p.id);if(seen.has(id))return;seen.set(id,p)});
}
if(!seen.size)return'';
const rows=[...seen.values()].map(p=>{
const th=p.thum?`<img class="tb-fpv-op-thum" src="${imgUrl(p.thum)}" alt="" loading="lazy">`:'';
return`<li class="tb-fpv-op-li">${th}<span class="tb-fpv-op-name">${esc(p.name||p.id||'')}</span></li>`;
}).join('');
const squadLabel=si===1?t('tb_squad1'):t('tb_squad2');
return`<div class="tb-fpv-opsec tb-fpv-opsec--squad"><div class="tb-fpv-op-title">${esc(squadLabel)} — ${esc(t('tb_option_parts_used'))}</div><ul class="tb-fpv-op-list">${rows}</ul></div>`;
}
function tbRenderFormationPreview(){
initTeamBuilder();
const root=document.getElementById('tbFormationPreview');
if(!root)return;
function pairHtml(sl){
const ud=sl&&sl.unitData;
const cd=sl&&sl.charData;
const uSrc=ud&&(ud.thum||ud.portrait);
const cSrc=cd&&(cd.portrait||cd.thum);
const uInner=uSrc?imgTag(uSrc,{cls:'tb-fpv-unit',webp:true,alt:'',loading:'lazy'}):'<div class="tb-fpv-empty">+</div>';
const cInner=cSrc?imgTag(cSrc,{cls:'tb-fpv-pilot',webp:true,alt:'',loading:'lazy'}):'<div class="tb-fpv-empty tb-fpv-empty--sm">+</div>';
return`<div class="tb-fpv-pair"><div class="tb-fpv-cell">${uInner}</div><div class="tb-fpv-cell">${cInner}</div></div>`;
}
function squadBlock(side){
const squ=S.tb.squads[side];
const ent=S.tb.supBySide[side];
let pairs='';
for(let i=0;i<5;i++)pairs+=pairHtml(squ.slots[i]);
const supCard=ent&&ent.data?renderTbSupporterPortraitOnly(ent.data,72):`<div class="tb-fpv-supp-empty">—</div>`;
const nm=String(squ.name||'').slice(0,40);
const ph=t('tb_squad_name_ph');
return`<div class="tb-fpv-squad"><div class="tb-fpv-squad-head"><input type="text" class="tb-fpv-name-input" maxlength="40" value="${escAttr(nm)}" placeholder="${escAttr(ph)}" aria-label="${escAttr(ph)}" onblur="tbSyncSquadNameFromFormation(${side},this)"></div><div class="tb-fpv-squad-row"><div class="tb-fpv-pairs">${pairs}</div><div class="tb-fpv-supp"><div class="tb-fpv-supp-lbl">${esc(t('tab_supporter'))}</div>${supCard}</div></div></div>`;
}
root.innerHTML=`<div id="tbFormationPreviewRoot" class="tb-fpv-root">${squadBlock(1)+_tbFormationOptionPartsHtmlForSquad(1)+squadBlock(2)+_tbFormationOptionPartsHtmlForSquad(2)}</div>`;
}
async function tbFormationCopyLink(){
const url=await _tbBuildShareUrl();
if(!url)return;
try{
await navigator.clipboard.writeText(url);
const b=document.getElementById('tbFormCopyLinkBtn');
if(b){b.textContent=t('tb_link_copied');setTimeout(()=>{b.textContent=t('tb_copy_link')},1700)}
}catch(_){
try{window.prompt(t('tb_copy_link'),url)}catch(__){}
}
}
function _tbEnsureHtml2Canvas(){
return new Promise((resolve,reject)=>{
if(typeof window.html2canvas==='function')return resolve(window.html2canvas);
const ex=document.getElementById('tbHtml2CanvasScript');
if(ex){
const t0=Date.now();
const iv=setInterval(()=>{
if(typeof window.html2canvas==='function'){clearInterval(iv);resolve(window.html2canvas)}
else if(Date.now()-t0>20000){clearInterval(iv);reject(new Error('timeout'))}
},40);
return;
}
const s=document.createElement('script');
s.id='tbHtml2CanvasScript';
s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
s.onload=()=>resolve(window.html2canvas);
s.onerror=()=>reject(new Error('load'));
document.head.appendChild(s);
});
}
async function tbFormationScreenshot(){
const host=document.getElementById('tbFormationPreviewRoot');
if(!host)return;
try{
const html2canvas=await _tbEnsureHtml2Canvas();
if(typeof html2canvas!=='function')throw new Error('html2canvas');
const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
const c=await html2canvas(host,{backgroundColor:'#0f172a',scale,useCORS:true,allowTaint:false,logging:false});
const a=document.createElement('a');
a.download='team-formation.png';
a.href=c.toDataURL('image/png');
a.click();
}catch(e){alert(t('tb_screenshot_fail')+(e&&e.message?': '+e.message:''))}
}
async function tbApplySnapshot(snap){
if(!snap||snap.v!==1)return;
initTeamBuilder();
S.tb.terrainType=snap.terrainType||'Space';
S.tb.masterLeague=!!snap.masterLeague;
S.tb.grandOffensive=!!snap.grandOffensive;
S.tb.supBySide={1:{id:null,data:null,lbTier:3,level:100},2:{id:null,data:null,lbTier:3,level:100}};
const sid1=snap.supporter1!=null?snap.supporter1:snap.supporterId;
const sid2=snap.supporter2;
if(sid1)S.tb.supBySide[1].id=String(sid1);
if(sid2)S.tb.supBySide[2].id=String(sid2);
if(snap.supLb1!=null)S.tb.supBySide[1].lbTier=Math.min(3,Math.max(0,snap.supLb1|0));
if(snap.supLb2!=null)S.tb.supBySide[2].lbTier=Math.min(3,Math.max(0,snap.supLb2|0));
if(snap.supLv1!=null)S.tb.supBySide[1].level=Math.min(100,Math.max(1,snap.supLv1|0));
if(snap.supLv2!=null)S.tb.supBySide[2].level=Math.min(100,Math.max(1,snap.supLv2|0));
S.tb._leaderApplyCache={};
function blank(){return Array.from({length:5},()=>_tbEmptySlot())}
const s1=(snap.squads&&snap.squads[1]&&snap.squads[1].slots)||[];
const s2=(snap.squads&&snap.squads[2]&&snap.squads[2].slots)||[];
S.tb.squads[1].slots=blank();
S.tb.squads[2].slots=blank();
const n1=snap.squads&&snap.squads[1]&&snap.squads[1].name!=null?String(snap.squads[1].name).trim().slice(0,40):'';
const n2=snap.squads&&snap.squads[2]&&snap.squads[2].name!=null?String(snap.squads[2].name).trim().slice(0,40):'';
S.tb.squads[1].name=n1;S.tb.squads[2].name=n2;
async function hydrateSlot(sideIdx,i,o){
if(!o)return;
const sl=S.tb.squads[sideIdx].slots[i];
sl.lbTier=o.lbTier!=null?o.lbTier:3;const um=o.um;if(um==='normal'||um==='sp'||um==='ssp')sl.unitStatMode=um;else sl.unitStatMode='normal';sl.unitCondPassive=!!o.unitCondPassive;sl.charCondPassive=!!o.charCondPassive;sl.unitTurnBuffAtk=!!o.unitTurnBuffAtk;sl.unitTurnBuffDef=!!o.utd||!!o.unitTurnBuffDef;sl.exSquadAtkPct=o.exSquadAtkPct|0;
const uid=o.unitId?String(o.unitId):'';
const cid=o.charId?String(o.charId):'';
const unitP=uid?fetch(`/api/unit/${encodeURIComponent(uid)}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json()).catch(()=>({error:1})):Promise.resolve({error:1});
const charP=cid?fetch(`/api/character/${encodeURIComponent(cid)}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json()).catch(()=>({error:1})):Promise.resolve({error:1});
const [ud,cd]=await Promise.all([unitP,charP]);
if(ud&&!ud.error){sl.unitId=uid;sl.unitData=ud}
if(cd&&!cd.error){sl.charId=cid;sl.charData=cd}
const ids=Array.isArray(o.optionPartIds)?o.optionPartIds.slice(0,1):[];
await Promise.all(ids.map(async(pid)=>{
if(!pid)return;
try{
const d=await fetch(`/api/option_part/${encodeURIComponent(String(pid))}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json());
if(d&&!d.error)sl.optionParts.push(d);
}catch(_){}
}));
}
async function hydrateSide(sideIdx,src){
const tasks=[];
for(let i=0;i<5&&i<src.length;i++){const o=src[i];if(o)tasks.push(hydrateSlot(sideIdx,i,o))}
await Promise.all(tasks);
}
await Promise.all([hydrateSide(1,s1),hydrateSide(2,s2)]);
await Promise.all([1,2].map(async(ss)=>{
const ent=S.tb.supBySide[ss];
if(!ent||!ent.id)return;
const lb=Math.min(3,Math.max(0,ent.lbTier|0));const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const rd=await fetch(`/api/supporter/${encodeURIComponent(ent.id)}?lang=${encodeURIComponent(S.lang)}&level=${slv}&lb_tier=${lb}${_tbSupporterFetchQs(ss)}`).then(r=>r.json());
if(!rd.error){ent.data=rd;if(rd.lb_tier!=null)ent.lbTier=rd.lb_tier|0;if(rd.level!=null)ent.level=Math.min(100,Math.max(1,rd.level|0))}
}catch(_){}
}));
_tbSyncBuffTogglesFromState();
await tbAutoFillEmptyOptionParts({skipRender:true});
tbFillTerrainSelects();renderTeamBuilder();
}
async function tbRefreshSlottedUnitData(){
initTeamBuilder();
const jobs=[];
for(let si=1;si<=2;si++){
for(let col=0;col<5;col++){
const sl=S.tb.squads[si].slots[col];
if(!sl||!sl.unitId)continue;
if(sl.unitData&&sl.unitData._manual)continue;
jobs.push({si,col,uid:String(sl.unitId)});
}
}
if(!jobs.length)return;
await Promise.all(jobs.map(async ({si,col,uid})=>{
try{
const d=await fetch(`/api/unit/${encodeURIComponent(uid)}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json());
if(!d||d.error)return;
const sl=S.tb.squads[si].slots[col];
if(sl&&String(sl.unitId)===uid)sl.unitData=d;
}catch(_){}
}));
}
function _tbGetUnitStatKey(ud,slot){
if(!ud)return'stats_no_cond';
const hasSp=ud.has_sp!==undefined?ud.has_sp:(parseInt(ud.rarity_id||'5')<=4);
const mode=slot.unitStatMode||'normal';
const hasCond=!!ud.has_cond_stats;
const passiveOn=!!(hasCond&&slot.unitCondPassive);
const sfx=passiveOn?'_with_cond':'_no_cond';
if(mode==='ssp'&&hasSp)return'ssp_stats'+sfx;
if(mode==='sp'&&hasSp)return'sp_stats'+sfx;
return'stats'+sfx;
}
function _tbPilotPairUnitAtkDef(cd,ud,charCondPassive,unitAtk,unitDefVal){
const F=Math.floor;
const pm=cd&&cd.pair_unit_stat_mod;
if(!pm||!ud||ud._manual||!charCondPassive)return{unitAtk,unitDefVal};
const row=pm[String(ud.id||'')];
if(!row)return{unitAtk,unitDefVal};
let a=unitAtk,d=unitDefVal;
if(row.atk_pct)a=F(a*(100+row.atk_pct)/100);
if(row.def_pct)d=F(d*(100+row.def_pct)/100);
return{unitAtk:a,unitDefVal:d};
}
function _tbFmtStatDelta(n){
const d=Math.round(Number(n)||0);
if(d>0)return` <span class="tb-stat-plus">(+${fmtN(d)})</span>`;
if(d<0)return` <span class="tb-stat-minus">(-${fmtN(Math.abs(d))})</span>`;
return'';
}
function _tbSlotTerrainState(sl){
initTeamBuilder();
if(!sl||!sl.unitData)return{known:false,blocked:false,movePenalty:false,symbol:'',level:0};
const ud=sl.unitData;
const useSsp=(sl.unitStatMode==='ssp')&&Array.isArray(ud.terrain_ssp)&&ud.terrain_ssp.length;
const terrArr=useSsp?ud.terrain_ssp:ud.terrain;
if(!Array.isArray(terrArr)||!terrArr.length)return{known:false,blocked:false,movePenalty:false,symbol:'',level:0};
const terrName=S.tb.terrainType||'Space';
const row=terrArr.find(x=>x&&String(x.name||'')===terrName);
if(!row)return{known:true,blocked:true,movePenalty:false,symbol:'-',level:0};
const sym=String(row.symbol||'').trim();
const lvl=parseInt(row.level,10);
const lv=Number.isFinite(lvl)?lvl:0;
const blocked=(sym==='-'||sym==='×'||lv<=0);
const movePenalty=!blocked&&(/[△▲▵▴]/.test(sym)||/\btri/i.test(sym)||lv===1);
return{known:true,blocked,movePenalty,symbol:sym||'-',level:lv};
}
function _tbApplyTerrainMovePenalty(v){
const n=Math.max(0,Math.round(Number(v)||0));
return Math.max(0,Math.floor(n*0.5));
}
function _tbApplyUnitTurnBuffDefToMsDef(unitDef,ud,turnBuffOn){
const F=Math.floor;
if(!ud||ud._manual||!turnBuffOn)return unitDef;
const p=_dcGetDetectedUnitTurnBuffPercents(ud).defPct|0;
if(p<=0)return unitDef;
const d=F(Math.max(0,Number(unitDef)||0));
return d+F(d*p/100);
}
function _tbSupporterForStatsNoLeader(d){
const ls=(d.leader_skills||[]).map(ls=>Object.assign({},ls,{applies:false}));
return Object.assign({},d,{leader_skills:ls});
}
const TB_PLUS_EX_SQUAD_UNIT_ID='1095002550';
const TB_QUBELEY_ZZ_PILOT_ID='1095001801';
/** Phenex (unit 1144000550): unique squad passive — each deployed copy whose pilot satisfies condition 1 grants +5% ATK & +5% DEF (sheet) to units with this passive’s receiver tag (condition 2, e.g. NT-D); stacks once per Phenex MS in the squad (max five slots ⇒ 25% each). Pilot IDs that currently satisfy condition 1 in roster data: 1144000100, 1144000102, 1144000101, 1144000500 — so typical max stacks today are four (20%); game updates may raise this toward the five-slot cap. */
const PHENEX_STACK_UNIT_ID='1144000550';
const PHENEX_SQUAD_FLAT_AD_PER_STACK_PCT=5;
const PHENEX_SQUAD_FLAT_AD_MAX_STACKS=5;
const PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT=PHENEX_SQUAD_FLAT_AD_PER_STACK_PCT*PHENEX_SQUAD_FLAT_AD_MAX_STACKS;
/** All five slots; each MS with Neo Zeon counts once (4% each, cap 20%), including the piloted Qubeley when it bears that tag. */
function _tbNeoZeonUnitCountInSquad(side){
const squ=S.tb.squads[side|0];
if(!squ)return 0;
let n=0;
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(sl&&sl.unitData&&_tbUnitHasNeoZeonTag(sl.unitData))n++;
}
return n;
}
function _tbSquadHasUnitId(side,uidNeed){
if(!uidNeed)return false;
const squ=S.tb.squads[side|0];if(!squ)return false;
const need=String(uidNeed);
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(sl&&sl.unitData&&String(sl.unitData.id)===need)return true;
}
return false;
}
function _tbNameLooksNeoZeon(n){
const s=String(n||'');
const sl=s.toLowerCase();
if(sl.includes('neo zeon')||/\bneo[\s-]?zeon\b/.test(sl))return true;
return /ネオ[_・\s]*ジオン|新ジオン|新吉翁/i.test(s);
}
function _tbUnitHasNeoZeonTag(ud){
if(!ud)return false;
const tagNeo=(tg)=>{if(!tg)return false;const id=String(tg.id||'').trim();if(id==='1019')return true;return _tbNameLooksNeoZeon(tg.name)};
const tags=ud.tags||[];
for(let i=0;i<tags.length;i++){if(tagNeo(tags[i]))return true}
const blocks=ud.skill_tag_data||[];
for(let b=0;b<blocks.length;b++){
const tgs=(blocks[b]&&blocks[b].tags)||[];
for(let j=0;j<tgs.length;j++){if(tagNeo(tgs[j]))return true}
}
return false;
}
function _tbEffectiveExSquadAtkPctForTb(sl,side){
const ud=sl.unitData;
const cd=sl.charData||null;
const raw=Math.min(20,Math.max(0,sl.exSquadAtkPct|0));
if(ud&&String(ud.id)===TB_PLUS_EX_SQUAD_UNIT_ID&&cd&&String(cd.id)===TB_QUBELEY_ZZ_PILOT_ID){
const c=_tbNeoZeonUnitCountInSquad(side);
return Math.min(20,4*c);
}
if(raw<=0)return 0;
if(_dcCharHasExSquadSynergyAbility(cd,ud))return raw;
if(_tbSquadHasUnitId(side,TB_PLUS_EX_SQUAD_UNIT_ID)&&_tbUnitHasNeoZeonTag(ud))return raw;
return 0;
}
/** Squad tag / count EX passives (ATK stack or ATK+DEF flat). Qubeley ZZ + EX unit uses EX squad % only. */
function _scIsQubeleyExCombo(cd,ud){
return!!(cd&&ud&&String(cd.id)===TB_QUBELEY_ZZ_PILOT_ID&&String(ud.id)===TB_PLUS_EX_SQUAD_UNIT_ID);
}
function _scTextImpliesSquadBuff(txt){
if(!txt)return false;
if(/支援攻擊|支援攻撃|support attack/i.test(txt))return false;
return/同部隊|部隊內|same squad|in the same squad|in your squad|for each (?:unit |)bearing.*squad|squad unit bearing|each squad unit/i.test(txt);
}
/** True when ATK+DEF bonus stacks per qualifying squad unit (input 0–5 = count), not a single flat N% row. */
function _scTraitLineImpliesPerSquadUnitFlatStack(raw){
const s=String(raw||'');
if(!/same squad|in the same squad|同部隊|部隊內/i.test(s))return false;
if(/for units bearing|units bearing the above tags|上述標籤|上述のタグ|いずれかのタグを持つ機体/i.test(s))return true;
if(/each (?:squad )?unit|各機体|各部隊/i.test(s))return true;
return false;
}
function _scParseSquadLineStats(txt){
if(!txt)return null;
const raw=String(txt).replace(/\r/g,'');
const t=raw.replace(/\s+/g,' ');
let m=t.match(/increase own ATK by (\d+)%[\s\S]*?\(up to (\d+)%\)/i);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
if(/(?:\[condition\s*1\]|【條件1】|【条件1】)/i.test(raw)){
m=t.match(/自身の攻撃力が(\d+)%上昇（最大(\d+)%）/);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
m=t.match(/自身攻擊力提升(\d+)%（最高(\d+)%）/);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
}
m=t.match(/Increase ATK by (\d+)% \(up to (\d+)%\)/i);
if(m)return{kind:'stack_atk',per:+m[1],max:+m[2]};
m=t.match(/攻撃力が(\d+)%上昇（最大(\d+)%）/);
if(m)return{kind:'stack_atk',per:+m[1],max:+m[2]};
m=t.match(/自身攻擊力提升(\d+)%（最高(\d+)%）/);
if(m)return{kind:'stack_atk',per:+m[1],max:+m[2]};
m=t.match(/increases ATK and DEF by (\d+)%/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/(?:also\s+)?(?:grant|grants)\s+\+(\d+)%\s+ATK\s+and\s+DEF/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/\+(\d+)%\s+ATK\s+and\s+DEF/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/gain increased ATK and DEF (\d+)%/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/攻撃力と防御力(\d+)%アップ/);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/攻擊力與防禦力提升(\d+)/);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/攻擊力、防禦力提升(\d+)%/);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=raw.match(/「攻擊力提升(\d+)%」、「防禦力提升(\d+)%」/);
if(m&&m[1]===m[2])return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
return null;
}
function _scBuildBindingFromParsed(parsed,groups,txt){
const G=Array.isArray(groups)?groups:[];
if(!parsed)return null;
if(parsed.kind==='dual_stack_atk'){
const g1=G.find(x=>/condition\s*1/i.test(String(x.label||'')))||G[0];
const g2=G.find(x=>/condition\s*2/i.test(String(x.label||'')))||G[1];
if(!g1||!g2||!((g1.conditions||[]).length)||!((g2.conditions||[]).length))return null;
return{kind:'dual_stack_atk',perUnit:parsed.per,max:parsed.max,pilotGroups:[g1],countGroup:g2,affectsDef:false,inputCap:parsed.max};
}
if(parsed.kind==='stack_atk'){
if(G.length>=2){
const gPilot=G.find(x=>/condition\s*1/i.test(String(x.label||'')))||G[0];
const gCount=G.find(x=>/condition\s*2|target tags/i.test(String(x.label||'')))||G[1];
if(!((gCount.conditions||[]).length))return null;
return{kind:'stack_atk',perUnit:parsed.per,max:parsed.max,pilotGroups:[gPilot],countGroup:gCount,affectsDef:false,inputCap:parsed.max};
}
if(G.length===1&&!((G[0].conditions||[]).length))return null;
if(G.length===1)return{kind:'stack_atk',perUnit:parsed.per,max:parsed.max,pilotGroups:null,countGroup:G[0],affectsDef:false,inputCap:parsed.max};
return null;
}
if(parsed.kind==='flat_ad'){
const perU=!!parsed.perSquadUnit;
const maxSlots=5;
const cap=perU?maxSlots:parsed.flat;
if(G.length>=2){
const gPilot=G[0];
const gRecv=G.find(x=>/target tags/i.test(String(x.label||'')))||G[1];
return{kind:'flat_ad',flatPct:parsed.flat,pilotGroups:[gPilot],recvGroup:gRecv,affectsDef:true,inputCap:cap,flatPerUnit:perU};
}
if(G.length===1)return{kind:'flat_ad',flatPct:parsed.flat,pilotGroups:[G[0]],recvGroup:G[0],affectsDef:true,inputCap:cap,flatPerUnit:perU};
return{kind:'flat_ad',flatPct:parsed.flat,pilotGroups:null,recvGroup:null,affectsDef:true,inputCap:cap,flatPerUnit:perU};
}
return null;
}
function _scWalkAbilityDetailsForSquad(cd,ud,visitor){
function walkResolved(resolved){
if(!resolved)return;
const det=resolved.details||[];
for(let i=0;i<det.length;i++){
const ln=det[i];
const tx=String((ln&&ln.text)||'');
if(!_scTextImpliesSquadBuff(tx))continue;
const parsed=_scParseSquadLineStats(tx);
if(!parsed)continue;
const b=_scBuildBindingFromParsed(parsed,ln.condition_groups||[],tx);
if(b)visitor(b,ln);
}
}
if(cd&&!cd._manual&&Array.isArray(cd.abilities)){
for(let a=0;a<cd.abilities.length;a++)walkResolved(_dcResolveCharAbilityForMode(cd.abilities[a]));
}
if(ud&&!ud._manual&&Array.isArray(ud.abilities)){
for(let a=0;a<ud.abilities.length;a++)walkResolved(_dcResolveUnitAbilityForMode(ud.abilities[a]));
}
}
function _scFindSquadConditionBinding(cd,ud){
let found=null;
_scWalkAbilityDetailsForSquad(cd,ud,(b)=>{if(!found)found=b});
return found;
}
function _tbWithSlotDcStatModes(sl,fn){
const um=S.dc.unitStatMode,cm=S.dc.charStatMode;
try{
S.dc.unitStatMode=(sl&&sl.unitStatMode)||'normal';
S.dc.charStatMode=(sl&&sl.charStatMode)||'normal';
return fn();
}finally{
S.dc.unitStatMode=um;
S.dc.charStatMode=cm;
}
}
function _tbCountSquadUnitsMatchingGroup(side,group){
if(!group||!((group.conditions||[]).length))return 0;
const squ=S.tb.squads[side|0];
if(!squ)return 0;
let n=0;
for(let i=0;i<5;i++){
const sl=squ.slots[i];
const u2=sl&&sl.unitData;
if(u2&&!u2._manual&&_dcUnitMeetsAbilityConditionGroups(u2,[group]))n++;
}
return n;
}
/** Phenex unique ability: cross-slot aura from 1144000550; stacking capped PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT in team builder. */
function _tbPhenexUniqueEligibleCarrierCountForReceiver(slRecv,side){
const squ=S.tb.squads[side|0];
if(!squ)return 0;
const udR=slRecv&&slRecv.unitData;
const cdR=slRecv&&slRecv.charData;
if(!udR||udR._manual)return 0;
let n=0;
for(let i=0;i<5;i++){
const car=squ.slots[i];
const udC=car&&car.unitData;
const cdC=car&&car.charData;
if(!udC||udC._manual||String(udC.id)!==PHENEX_STACK_UNIT_ID)continue;
const ok=_tbWithSlotDcStatModes(car,()=>{
const b=_scFindSquadConditionBinding(cdC,udC);
if(!b||b.kind!=='flat_ad'||b.flatPerUnit)return false;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(udC,cdC,b.pilotGroups))return false;
return _dcSquadRecvGroupMet(udR,cdR,b.recvGroup);
});
if(ok)n++;
}
return n;
}
function _tbCarrierFlatAdAuraSheetPct(slCarrier,slReceiver,side){
const cdC=slCarrier.charData;
const udC=slCarrier.unitData;
const udR=slReceiver.unitData;
const z={atk:0,def:0};
if(!udC||udC._manual||!udR||udR._manual)return z;
if(_scIsQubeleyExCombo(cdC,udC))return z;
return _tbWithSlotDcStatModes(slCarrier,()=>{
const b=_scFindSquadConditionBinding(cdC,udC);
if(!b||b.kind!=='flat_ad'||b.flatPerUnit)return z;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(udC,cdC,b.pilotGroups))return z;
const cdR=slReceiver.charData;
if(!_dcSquadRecvGroupMet(udR,cdR,b.recvGroup))return z;
const p=b.flatPct|0;
return{atk:p,def:p};
});
}
function _tbComputeExternalFlatAdSquadPctForSlot(sl,side){
const ud=sl&&sl.unitData;
if(!ud||ud._manual)return{atk:0,def:0};
const squ=S.tb.squads[side|0];
if(!squ)return{atk:0,def:0};
let atk=0,def=0;
for(let i=0;i<5;i++){
const car=squ.slots[i];
if(!car||car===sl)continue;
const patch=_tbCarrierFlatAdAuraSheetPct(car,sl,side);
atk+=patch.atk|0;def+=patch.def|0;
}
return{atk,def};
}
function _tbLocalSquadConditionSheetPcts(sl,side){
const cd=sl.charData,ud=sl.unitData;
const z={atk:0,def:0};
if(!ud||ud._manual||_scIsQubeleyExCombo(cd,ud))return z;
return _tbWithSlotDcStatModes(sl,()=>{
const b=_scFindSquadConditionBinding(cd,ud);
if(!b)return z;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(ud,cd,b.pilotGroups))return z;
if(b.kind==='flat_ad'){
const rg=b.recvGroup;
if(rg&&!_dcSquadRecvGroupMet(ud,cd,rg))return z;
if(b.flatPerUnit){
if(!rg||!((rg.conditions||[]).length))return z;
const n=_tbCountSquadUnitsMatchingGroup(side,rg);
const per=b.flatPct|0;
const eff=per*Math.min(5,Math.max(0,n));
return{atk:eff,def:eff};
}
return{atk:b.flatPct|0,def:b.flatPct|0};
}
if(b.kind==='stack_atk'||b.kind==='dual_stack_atk'){
const n=_tbCountSquadUnitsMatchingGroup(side,b.countGroup);
return{atk:Math.min(b.max|0,(b.perUnit|0)*n),def:0};
}
return z;
});
}
function _tbComputeSquadConditionSheetPcts(sl,side){
const loc=_tbLocalSquadConditionSheetPcts(sl,side);
const ext=_tbComputeExternalFlatAdSquadPctForSlot(sl,side);
let atk=(loc.atk|0)+(ext.atk|0),def=(loc.def|0)+(ext.def|0);
const phenN=_tbPhenexUniqueEligibleCarrierCountForReceiver(sl,side);
if(phenN>0&&atk===def){
atk=Math.min(PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT,atk);
def=Math.min(PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT,def);
}
return{atk,def};
}
function _tbUnitAllowsSpSsp(ud){
if(!ud||ud._manual)return false;
if(ud.has_sp!==undefined)return!!ud.has_sp;
return parseInt(ud.rarity_id||'5',10)<=4;
}
function _tbStatTotalsWithFullCtx(sl,side,optionParts,supForSlot){
if(!sl||!sl.unitData)return null;
const ud=sl.unitData;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(sl.lbTier|0,maxTier);
const statKey=_tbGetUnitStatKey(ud,sl);
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const supEnt=S.tb.supBySide[side];
let supporters=[];
if(supForSlot&&!supForSlot.error)supporters=[supForSlot];
else if(supEnt&&supEnt.data){
if(supForSlot===null)supporters=[_tbSupporterForStatsNoLeader(supEnt.data)];
else supporters=[supEnt.data];
}
const sqP=_tbComputeSquadConditionSheetPcts(sl,side);
const fullCtx={masterLeagueBuff:!!S.tb.masterLeague,grandOffensiveBuff:!!S.tb.grandOffensive,masterLeagueBuffMove:false,optionParts:optionParts||[],supporters,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:_tbEffectiveExSquadAtkPctForTb(sl,side),squadCondAtkPct:sqP.atk|0,squadCondDefPct:sqP.def|0};
const f=_dcGetModifiedAttackerUnitStatsFromCtx(fullCtx,stats);
let fatk=f.unitAtk,fdef=f.unitDefVal;
const prf=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,fatk,fdef);
fatk=prf.unitAtk;fdef=prf.unitDefVal;
fdef=_tbApplyUnitTurnBuffDefToMsDef(fdef,ud,!!sl.unitTurnBuffDef);
return{hp:f.unitHp,atk:fatk,def:fdef,mob:f.unitMob,mov:f.unitMove};
}
function _tbRarityRankOption(row){return{UR:4,SSR:3,SR:2,R:1}[row&&row.rarity]||0}
function _tbRankOptionForAutoFill(sl,side,row,supForSlot){
const rk=_tbUnitRoleKind(sl.unitData);
const b=_dcParseOptionPartBonuses(row.details||'');
const part={id:row.id,name:row.name||'',details:row.details||'',thum:row.thum||'',tags:row.tags||[]};
const z=_tbStatTotalsWithFullCtx(sl,side,[],supForSlot);
const w=_tbStatTotalsWithFullCtx(sl,side,[part],supForSlot);
const dAtk=z&&w?w.atk-z.atk:0;
const dHp=z&&w?w.hp-z.hp:0;
const dDef=z&&w?w.def-z.def:0;
const atk12=b.Attack.pct===12;
const hp12=b.HP.pct===12;
const def12=b.Defense.pct===12;
const rid=parseInt(String(row.id),10)||0;
const rb=_tbRarityRankOption(row);
if(rk==='def'){
if(hp12)return[4,dHp,dDef,dAtk,rb,rid];
if(def12)return[3,dDef,dHp,dAtk,rb,rid];
return[2,dHp+dDef,dDef,dHp,rb,rid];
}
if(rk==='sup'){
if(atk12)return[4,dAtk,0,0,rb,rid];
return[2,dAtk,0,0,rb,rid];
}
if(atk12)return[4,dAtk,dHp,dDef,rb,rid];
return[2,dAtk,dHp+dDef,dDef,rb,rid];
}
function _tbCompareRankAuto(a,b){
for(let i=0;i<Math.max(a.length,b.length);i++){
const x=a[i]??0,y=b[i]??0;
if(x>y)return 1;
if(x<y)return -1;
}
return 0;
}
function _dcOptionPartRowIsSsr(row){return row&&String(row.rarity||'').toUpperCase()==='SSR'}
function _dcCollectUsedSsrDcOptionPartIds(exceptSlotIdx){
const u=new Set();
if(!S.dc||!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots))return u;
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
if(exceptSlotIdx!=null&&i===exceptSlotIdx)continue;
const sl=S.dc.atkSlots[i];
(sl&&sl.optionParts||[]).forEach(p=>{if(p&&p.id&&_tbOptionPartIsSsr(p))u.add(String(p.id))});
}
return u;
}
function _dcDcOptionPartSsrDeniedForSlot(optionId,slotIdx){
return _dcCollectUsedSsrDcOptionPartIds(slotIdx).has(String(optionId));
}
function _dcStatTotalsForAutoRank(sl,optionParts,supporterObj){
const ud=sl&&sl.unitData;
if(!ud)return null;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(sl.lbTier|0,maxTier);
const statKey=_tbGetUnitStatKey(ud,sl);
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
let supporters=[];
if(supporterObj&&!supporterObj.error)supporters=[supporterObj];
const fullCtx={masterLeagueBuff:!!S.dc.masterLeagueBuff,grandOffensiveBuff:!!S.dc.grandOffensiveBuff,masterLeagueBuffMove:false,optionParts:optionParts||[],supporters,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:_dcEffectiveExSquadAtkPct(),squadCondAtkPct:S.dc.squadCondAtkPct|0,squadCondDefPct:S.dc.squadCondDefPct|0};
const f=_dcGetModifiedAttackerUnitStatsFromCtx(fullCtx,stats);
let fatk=f.unitAtk,fdef=f.unitDefVal;
const prf=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,fatk,fdef);
fatk=prf.unitAtk;fdef=prf.unitDefVal;
fdef=_tbApplyUnitTurnBuffDefToMsDef(fdef,ud,!!sl.unitTurnBuffDef);
return{hp:f.unitHp,atk:fatk,def:fdef,mob:f.unitMob,mov:f.unitMove};
}
function _dcRankOptionForAutoFill(sl,row,supForSlot){
const rk=_tbUnitRoleKind(sl.unitData);
const b=_dcParseOptionPartBonuses(row.details||'');
const part={id:row.id,name:row.name||'',details:row.details||'',thum:row.thum||'',tags:row.tags||[]};
const z=_dcStatTotalsForAutoRank(sl,[],supForSlot);
const w=_dcStatTotalsForAutoRank(sl,[part],supForSlot);
const dAtk=z&&w?w.atk-z.atk:0;
const dHp=z&&w?w.hp-z.hp:0;
const dDef=z&&w?w.def-z.def:0;
const atk12=b.Attack.pct===12;
const hp12=b.HP.pct===12;
const def12=b.Defense.pct===12;
const rid=parseInt(String(row.id),10)||0;
const rb=_tbRarityRankOption(row);
if(rk==='def'){
if(hp12)return[4,dHp,dDef,dAtk,rb,rid];
if(def12)return[3,dDef,dHp,dAtk,rb,rid];
return[2,dHp+dDef,dDef,dHp,rb,rid];
}
if(rk==='sup'){
if(atk12)return[4,dAtk,0,0,rb,rid];
return[2,dAtk,0,0,rb,rid];
}
if(atk12)return[4,dAtk,dHp,dDef,rb,rid];
return[2,dAtk,dHp+dDef,dDef,rb,rid];
}
function _dcDedupeSsrOptionPartsAcrossDcSlots(){
if(!S.dc||!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots))return;
const seen=new Set();
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=S.dc.atkSlots[i];
if(!sl||!sl.optionParts||!sl.optionParts.length)continue;
const p=sl.optionParts[0];
if(!p||!p.id)continue;
if(!_tbOptionPartIsSsr(p))continue;
const k=String(p.id);
if(seen.has(k))sl.optionParts=[];
else seen.add(k);
}
}
async function dcAutoFitOptionPartAndSupporter(fitGen){
if(typeof S==='undefined'||!S.dc)return;
if(S.dc._dcAutoFitBusy)return;
const ud=S.dc.atkUnitData;
if(!ud||ud._manual||!S.dc.atkUnit||!S.dc.atkChar||!S.dc.atkCharData||S.dc.atkCharData._manual)return;
S.dc._dcAutoFitBusy=true;
try{
const slotIdx=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
const sl={unitData:ud,charData:S.dc.atkCharData,unitId:S.dc.atkUnit,charId:S.dc.atkChar,lbTier:S.dc.lbTier,charCondPassive:!!S.dc.charCondPassive,unitCondPassive:!!S.dc.unitCondPassive,unitStatMode:S.dc.unitStatMode||'normal',unitTurnBuffAtk:!!S.dc.unitTurnBuffAtk,unitTurnBuffDef:!!S.dc.unitTurnBuffDef,optionParts:[]};
const cq=_dcForSupporterContextQuery();
const supRows=await _dcFetchAllListRows('/api/supporters','rarity=ALL'+_dcSupporterUnitCharQuery());
let bestSup=null,bestAtk=-1;
const chunk=14;
for(let i=0;i<supRows.length;i+=chunk){
if(fitGen!=null&&fitGen!==(S.dc._dcAutoFitGen|0))return;
const batch=supRows.slice(i,i+chunk);
const resolved=await Promise.all(batch.map(async row=>{
try{const d=await fetch(`/api/supporter/${encodeURIComponent(row.id)}?lang=${S.lang}&level=100&lb_tier=3${cq}`).then(r=>r.json());
return(!d||d.error)?null:d;
}catch(_){return null}
}));
for(let j=0;j<resolved.length;j++){
const d=resolved[j];
if(!d)continue;
const atk=(_dcStatTotalsForAutoRank(sl,[],d)||{}).atk|0;
if(atk>bestAtk){bestAtk=atk;bestSup=d}
}
}
if(bestSup){bestSup._dcLevel=100;bestSup._dcLbTier=3;S.dc.supporters=[bestSup]}
else S.dc.supporters=[];
const supFor=S.dc.supporters[0]||null;
const uid=String(S.dc.atkUnit);
const opRows=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL&unit_id='+encodeURIComponent(uid));
const used=_dcCollectUsedSsrDcOptionPartIds(slotIdx);
let bestOp=null,bestR=null;
for(let k=0;k<opRows.length;k++){
if(fitGen!=null&&fitGen!==(S.dc._dcAutoFitGen|0))return;
const row=opRows[k];
const id=String(row.id);
if(used.has(id))continue;
const ra=_dcRankOptionForAutoFill(sl,row,supFor);
if(!bestR||_tbCompareRankAuto(ra,bestR)>0){bestR=ra;bestOp=row}
}
if(bestOp)S.dc.optionParts=[{id:bestOp.id,name:bestOp.name,details:bestOp.details||'',thum:bestOp.thum||'',tags:bestOp.tags||[]}];
else S.dc.optionParts=[];
}catch(_){}
finally{S.dc._dcAutoFitBusy=false}
}
function _tbBuildSlotStatEff(sl,side,supForSlot){
if(!sl||!sl.unitData)return null;
const ud=sl.unitData;
const terrState=_tbSlotTerrainState(sl);
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(sl.lbTier|0,maxTier);
const statKey=_tbGetUnitStatKey(ud,sl);
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const supEnt=S.tb.supBySide[side];
let supporters=[];
if(supForSlot&&!supForSlot.error)supporters=[supForSlot];
else if(supEnt&&supEnt.data){
if(supForSlot===null)supporters=[_tbSupporterForStatsNoLeader(supEnt.data)];
else supporters=[supEnt.data];
}
const sqP=_tbComputeSquadConditionSheetPcts(sl,side);
const fullCtx={masterLeagueBuff:!!S.tb.masterLeague,grandOffensiveBuff:!!S.tb.grandOffensive,masterLeagueBuffMove:false,optionParts:sl.optionParts||[],supporters,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:_tbEffectiveExSquadAtkPctForTb(sl,side),squadCondAtkPct:sqP.atk|0,squadCondDefPct:sqP.def|0};
const baseCtx={masterLeagueBuff:false,grandOffensiveBuff:false,masterLeagueBuffMove:false,optionParts:[],supporters:[],unitTurnBuffAtk:false,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:0,squadCondAtkPct:0,squadCondDefPct:0};
const b=_dcGetModifiedAttackerUnitStatsFromCtx(baseCtx,stats);
const f=_dcGetModifiedAttackerUnitStatsFromCtx(fullCtx,stats);
let batk=b.unitAtk,bdef=b.unitDefVal;
const prb=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,batk,bdef);
batk=prb.unitAtk;bdef=prb.unitDefVal;
bdef=_tbApplyUnitTurnBuffDefToMsDef(bdef,ud,!!sl.unitTurnBuffDef);
let fatk=f.unitAtk,fdef=f.unitDefVal;
const prf=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,fatk,fdef);
fatk=prf.unitAtk;fdef=prf.unitDefVal;
fdef=_tbApplyUnitTurnBuffDefToMsDef(fdef,ud,!!sl.unitTurnBuffDef);
const fullMovRaw=Math.max(0,Math.round(Number(f.unitMove)||0));
let movShown=fullMovRaw;
if(terrState.movePenalty)movShown=_tbApplyTerrainMovePenalty(fullMovRaw);
return{ud,hp:f.unitHp,atk:fatk,def:fdef,mob:f.unitMob,mov:movShown,dHp:f.unitHp-b.unitHp,dAtk:fatk-batk,dDef:fdef-bdef,dMob:f.unitMob-b.unitMob,dMov:movShown-Math.max(0,Math.round(Number(b.unitMove)||0)),blocked:!!terrState.blocked,terrainSymbol:terrState.symbol||'-'};
}
function _tbTerrainQuery(){initTeamBuilder();const tt=S.tb.terrainType||'Space';return'&terrain='+encodeURIComponent(tt+':2+')}
function tbFillTerrainSelects(){
initTeamBuilder();
const ts=document.getElementById('tbTerrainSelect');
if(!ts)return;
const cur=S.tb.terrainType,items=_tbTerrainItems();
ts.innerHTML=items.map(x=>`<option value="${escAttr(x)}"${x===cur?' selected':''}>${esc(tTerrain(x))}</option>`).join('');
}
function onTbTerrainChange(){
initTeamBuilder();
const ts=document.getElementById('tbTerrainSelect');
if(ts)S.tb.terrainType=ts.value||'Space';
tbInvalidateTbPickerUnitCache();
renderTeamBuilder();
}
function _tbSyncBuffTogglesFromState(){
const ml=document.getElementById('tbMasterLeagueToggle'),go=document.getElementById('tbGrandOffensiveToggle');
if(ml)ml.classList.toggle('active',!!S.tb.masterLeague);
if(go)go.classList.toggle('active',!!S.tb.grandOffensive);
}
function toggleTbMasterLeague(){
initTeamBuilder();
S.tb.masterLeague=!S.tb.masterLeague;
_tbSyncBuffTogglesFromState();
renderTbStats();
}
function toggleTbGrandOffensive(){
initTeamBuilder();
S.tb.grandOffensive=!S.tb.grandOffensive;
_tbSyncBuffTogglesFromState();
renderTbStats();
}
function _tbSideFromKey(key){const s=(key>>8)&255;return s===2?2:1}
function _tbIdxFromKey(key){return key&255}
function _tbSquFromKey(key){initTeamBuilder();return S.tb.squads[_tbSideFromKey(key)]}
function _tbKey(side,col){return((side===2?2:1)<<8)+(col|0)}
function tbSlotClick(key){
initTeamBuilder();
if(S.tb.rearrange){tbRearrangeTap(key);return}
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
renderTbSlots();renderTbStats();
openTbPicker('unit',key);
}
function tbPilotAddClick(key,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
if(!sl.unitData){openTbPicker('unit',key);return}
renderTbSlots();renderTbStats();
openTbPicker('char',key);
}
async function tbPilotPickRecommended(key,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
const rc=sl.unitData&&sl.unitData.recommend_character;
if(!rc||!rc.id)return;
try{const d=await fetch(`/api/character/${encodeURIComponent(rc.id)}?lang=${S.lang}`).then(r=>r.json());if(!d.error){sl.charId=String(rc.id);sl.charData=d}}catch(_){}
renderTeamBuilder();
}
function tbSetSlotLbTier(key,tier,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
const ud=sl.unitData;
const lb=ud&&ud.lb_data;
if(!lb||lb.length<=1||ud.is_ultimate)return;
const max=lb.length-1;
sl.lbTier=Math.min(Math.max(0,tier|0),max);
renderTeamBuilder();
}
function tbSetSlotUnitStatMode(key,mode,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
const ud=sl.unitData;
if(!ud||!_tbUnitAllowsSpSsp(ud))return;
if(mode!=='normal'&&mode!=='sp'&&mode!=='ssp')return;
sl.unitStatMode=mode;
S.tb._leaderApplyCache={};
renderTeamBuilder();
}
function tbSlotContextMenu(key,ev){
if(ev)ev.preventDefault();
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
if(sl.unitData)openTbPicker(sl.charData?'option':'char',key);
else openTbPicker('unit',key);
}
function _tbFormatOptionBonusesShort(details){
try{
const b=_dcParseOptionPartBonuses(details);
const out=[];
const P=(label,v)=>{if(!v)return;if(v.pct)out.push(label+(v.pct>0?' +':(v.pct<0?' ':''))+v.pct+'%');if(v.flat)out.push(label+(v.flat>0?' +':(v.flat<0?' ':''))+fmtN(v.flat))};
P('ATK',b.Attack);P('HP',b.HP);P('DEF',b.Defense);P('MOB',b.Mobility);P('MOV',b.Move);P('EN',b.EN);
return out.slice(0,3).join(' ')||(details?String(details).trim().slice(0,48):'');
}catch(_){return details?String(details).trim().slice(0,48):''}
}
function _tbOptionPartIsSsr(p){
return p&&String(p.rarity||'').toUpperCase()==='SSR';
}
function _tbCollectUsedSsrOptionPartIds(exceptKey){
initTeamBuilder();
const u=new Set();
for(let si=1;si<=2;si++){
const squ=S.tb.squads[si];
for(let col=0;col<5;col++){
const k=_tbKey(si,col);
if(exceptKey!=null&&k===exceptKey)continue;
const sl=squ.slots[col];
(sl.optionParts||[]).forEach(p=>{if(p&&p.id&&_tbOptionPartIsSsr(p))u.add(String(p.id))});
}}
return u;
}
function _tbDedupeOptionPartsAcrossTeam(){
initTeamBuilder();
const ssrSeen=new Set();
let clearedDupSsr=false;
for(let si=1;si<=2;si++){
const squ=S.tb.squads[si];
for(let col=0;col<5;col++){
const sl=squ.slots[col];
if(!sl||!sl.optionParts||!sl.optionParts.length)continue;
const next=[];
for(let i=0;i<sl.optionParts.length;i++){
const p=sl.optionParts[i];
const id=p&&p.id;if(!id)continue;
if(_tbOptionPartIsSsr(p)){
const ks=String(id);
if(ssrSeen.has(ks)){clearedDupSsr=true;continue}
ssrSeen.add(ks);
}
next.push(p);
}
sl.optionParts=next.slice(0,1);
}}
}
function _tbUnitRoleKind(ud){
if(!ud)return'atk';
const id=String(ud.role_id!=null?ud.role_id:'').trim();
if(id==='2')return'def';
if(id==='3')return'sup';
const r=String(ud.role||'').toLowerCase();
if(r.includes('defens')||r.includes('耐久'))return'def';
if(r.includes('support')||r.includes('支援'))return'sup';
return'atk';
}
async function tbAutoFillEmptyOptionParts(opts){
if(typeof S==='undefined'||!S.tb)return;
if(S.tb._tbAutoOpBusy)return;
const skipRender=!!(opts&&opts.skipRender);
initTeamBuilder();
const order=[];
for(let si=1;si<=2;si++)for(let col=0;col<5;col++)order.push({si,col,key:_tbKey(si,col)});
const tasks=[];
for(let o of order){
const sl=S.tb.squads[o.si].slots[o.col];
if(sl&&sl.unitData&&sl.unitId&&!sl.unitData._manual&&(!sl.optionParts||!sl.optionParts.length))tasks.push(o);
}
if(!tasks.length)return;
S.tb._tbAutoOpBusy=true;
try{
const cache=S.tb._tbOpAllRowsByUnit||(S.tb._tbOpAllRowsByUnit={});
const used=_tbCollectUsedSsrOptionPartIds(null);
const supByKey={};
await Promise.all(tasks.map(async o=>{
const k=_tbKey(o.si,o.col);
const sl=S.tb.squads[o.si].slots[o.col];
if(!sl||!sl.unitData||!S.tb.supBySide[o.si]||!S.tb.supBySide[o.si].id){supByKey[k]=null;return}
const ent=S.tb.supBySide[o.si];
const lb=Math.min(3,Math.max(0,ent.lbTier|0));
const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const q=`/api/supporter/${encodeURIComponent(ent.id)}?lang=${S.lang}&level=${slv}&lb_tier=${lb}&for_unit_id=${encodeURIComponent(sl.unitId)}&for_char_id=${encodeURIComponent(sl.charId||'')}`;
const d=await fetch(q).then(r=>r.json());
supByKey[k]=(!d||d.error)?null:d;
}catch(_){supByKey[k]=null}
}));
let changed=false;
for(const o of tasks){
const sl=S.tb.squads[o.si].slots[o.col];
const ud=sl.unitData;
const uid=String(sl.unitId);
const slotK=_tbKey(o.si,o.col);
let rows=cache[uid];
if(!rows){
rows=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL&unit_id='+encodeURIComponent(uid));
cache[uid]=rows;
}
const supForSlot=supByKey[slotK];
let best=null,bestR=null;
for(let i=0;i<rows.length;i++){
const row=rows[i];
const id=String(row.id);
if(used.has(id))continue;
const ra=_tbRankOptionForAutoFill(sl,o.si,row,supForSlot);
if(!bestR||_tbCompareRankAuto(ra,bestR)>0){bestR=ra;best=row}
}
if(best!=null){sl.optionParts=[best];if(_tbOptionPartIsSsr(best))used.add(String(best.id));changed=true}
}
if(changed&&!skipRender){renderTbSlots();renderTbStats()}
}catch(_){}
finally{S.tb._tbAutoOpBusy=false}
}
function _tbSlotLbOutsideHtml(sl,slotKey){
const ud=sl.unitData;
if(!ud)return'';
const lb=ud.lb_data;
if(!lb||lb.length<=1||ud.is_ultimate)return'';
const maxT=lb.length-1;
const cur=Math.min(sl.lbTier|0,maxT);
const lbOpt=String(t('supp_lb_tier')||'LB');
const detId=`tbSlotLbDet${slotKey}`;
const curP=cmpLbPipsAtTier(cur);
let lbMenu='';
for(let ti=0;ti<=maxT;ti++){
const pip=cmpLbPipsAtTier(ti);
lbMenu+=`<button type="button" class="cmp-lb-opt${ti===cur?' is-active':''}" onclick="event.stopPropagation();tbSetSlotLbTier(${slotKey},${ti},event);var _tbd=document.getElementById('${detId}');if(_tbd)_tbd.open=false" role="option" aria-selected="${ti===cur}" aria-label="${escAttr(lbOpt+' '+ti)}">${cmpLbPipsRow(pip[0],pip[1],pip[2])}</button>`;
}
return`<div class="tb-slot-lb-outside" onclick="event.stopPropagation()"><details id="${detId}" class="cmp-lb-details tb-slot-lb-details"><summary class="cmp-lb-summary tb-slot-lb-summary" title="${escAttr(lbOpt)}" aria-label="${escAttr(lbOpt)}">${cmpLbPipsRow(curP[0],curP[1],curP[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${escAttr(lbOpt)}">${lbMenu}</div></details></div>`;
}
function _tbSlotStatModeHtml(key,sl){
const ud=sl.unitData;
if(!ud||ud._manual||!_tbUnitAllowsSpSsp(ud))return'';
const m=sl.unitStatMode||'normal';
const labN=escAttr(t('tb_stat_normal')||'Normal');
const labSp=escAttr(t('tb_stat_sp')||'SP');
const labSsp=escAttr(t('tb_stat_ssp')||'SSP');
return`<div class="tb-slot-stat-mode" onclick="event.stopPropagation()"><button type="button" class="tb-slot-stat-mode-btn${m==='normal'?' is-active':''}" title="${labN}" aria-label="${labN}" onclick="tbSetSlotUnitStatMode(${key},'normal',event)">${esc(t('tb_stat_normal')||'Normal')}</button><button type="button" class="tb-slot-stat-mode-btn${m==='sp'?' is-active':''}" title="${labSp}" aria-label="${labSp}" onclick="tbSetSlotUnitStatMode(${key},'sp',event)">${esc(t('tb_stat_sp')||'SP')}</button><button type="button" class="tb-slot-stat-mode-btn${m==='ssp'?' is-active':''}" title="${labSsp}" aria-label="${labSsp}" onclick="tbSetSlotUnitStatMode(${key},'ssp',event)">${esc(t('tb_stat_ssp')||'SSP')}</button></div>`;
}
function _tbSlotOpOutsideHtml(key,sl){
if(!sl.unitData)return'';
const opN=(sl.optionParts||[]).length;
const swapLbl=t('tb_op_swap')||'Change option part';
const clrLbl=escAttr(t('tb_op_clear')||'Clear');
const opClrIc=imgUrlWebp(TB_TRASH_ICON);
const opRows=(sl.optionParts||[]).map((p,i)=>{
const th=p.thum?`<img class="tb-op-thum" src="${imgUrl(p.thum)}" alt="" loading="lazy" onerror="this.style.display='none'">`:'';
const sum=esc(_tbFormatOptionBonusesShort(p.details));
const nm=String(p.name||'').trim();
const lineage=(p.tags||[]).map(tg=>String(tg.name||'').trim()).filter(Boolean).join(' · ');
const hoverRaw=[nm,lineage].filter(Boolean).join(' — ')||swapLbl;
const hoverTip=escAttr(hoverRaw);
const ariaSwap=escAttr(swapLbl+(nm||lineage?(': '+[nm,lineage].filter(Boolean).join(' — ')):''));
return`<div class="tb-op-row tb-op-row--rich tb-op-row--pick-row"><div class="tb-op-row-hit tb-op-row--pick" role="button" tabindex="0" title="${hoverTip}" aria-label="${ariaSwap}" onclick="event.stopPropagation();tbOpenOptionReplacePicker(${key},${i},event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbOpenOptionReplacePicker(${key},${i},event)}">${th}<span class="tb-op-sum">${sum}</span></div><button type="button" class="tb-op-clear" title="${clrLbl}" aria-label="${clrLbl}" onclick="event.stopPropagation();tbClearOptionPart(${key},${i},event)"><img src="${opClrIc}" alt="" loading="lazy" decoding="async"></button></div>`;
}).join('');
const addBtn=opN>=1?'':`<button type="button" class="tb-op-add" onclick="event.stopPropagation();tbOpenOptionPartsPicker(${key})">+</button>`;
return`<div class="tb-slot-op-outside" onclick="event.stopPropagation()"><div class="tb-op-box tb-op-box--under-slot"><div class="tb-op-head"><span class="tb-op-title">${esc(t('tb_option_part')||'Option Part')}</span>${addBtn}</div>${opRows?opRows:`<div class="tb-op-empty">${esc(t('none'))}</div>`}</div></div>`;
}
function _tbLongCardHtml(sl,slotKey){
const ud=sl.unitData;
if(!ud){
return`<div class="tb-long-card tb-long-card--empty"><div class="tb-slot-add-ms" onclick="event.stopPropagation();tbSlotClick(${slotKey})"><span style="font-size:28px;color:var(--accent-cyan);opacity:.85">+</span></div></div>`;
}
const side=_tbSideFromKey(slotKey);
const r=ud.rarity||'N';
const base=TB_LONG_BASE_MAP[r]||TB_LONG_BASE_MAP.N;
const portraitSrc=ud.portrait||ud.thum;
const lk=`${side}:`+String(ud.id)+':'+String(sl.charData&&sl.charData.id||'');
const oneBuff=imgTag(TB_LEADER_ICON,{cls:'tb-long-supporter-buff-img',webp:true,alt:''});
const leaderIc=(S.tb._leaderApplyCache&&S.tb._leaderApplyCache[lk])?`<div class="tb-long-supporter-buff">${oneBuff}</div>`:'';
let pilotInner='';
if(sl.charData&&(sl.charData.portrait||sl.charData.thum)){
const psrc=sl.charData.portrait||sl.charData.thum;
const pilotTitle=escAttr(t('tb_pick_pilot_unit')||t('tab_char'));
pilotInner=`<div class="tb-long-pilot-corner"><div class="tb-long-pilot tb-long-pilot--click" role="button" tabindex="0" title="${pilotTitle}" aria-label="${pilotTitle}" onclick="event.stopPropagation();tbPilotAddClick(${slotKey},event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbPilotAddClick(${slotKey},event)}">${imgTag(psrc,{webp:true,alt:''})}</div></div>`;
}else{
const addTitle=escAttr(t('tb_pick_pilot_unit')||t('tab_char'));
const plus=`<div class="tb-slot-add-pilot tb-slot-add-pilot--corner" role="button" tabindex="0" title="${addTitle}" aria-label="${addTitle}" onclick="event.stopPropagation();tbPilotAddClick(${slotKey},event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbPilotAddClick(${slotKey},event)}">+</div>`;
pilotInner=`<div class="tb-long-pilot-corner">${plus}</div>`;
}
let pCls='tb-long-portrait';
if(String(ud.body_type||'')==='3')pCls+=' tb-long-portrait--sd';
else if(TB_LONG_PORTRAIT_FACE_IDS.has(String(ud.id)))pCls+=' tb-long-portrait--face-balance';
const portraitInner=(portraitSrc?imgTag(portraitSrc,{cls:pCls,webp:true,alt:''}):'')+leaderIc+pilotInner;
const portrait=`<div class="tb-long-portrait-wrap">${portraitInner}</div>`;
const role=ud.role_icon?`<div class="tb-long-role"><img src="${imgUrl(ud.role_icon)}" alt=""></div>`:'';
return`<div class="tb-long-card"><img class="tb-long-base" src="${imgUrl(base)}" alt="" loading="lazy">${portrait}${role}</div>`;
}
function _tbLongCardHtmlRearrangeUnlinked(sl,slotKey){
const ud=sl.unitData;
const pk=S.tb.rearrange&&S.tb.rearrange.pendingKey===slotKey;
const pp=S.tb.rearrange&&S.tb.rearrange.pendingPart;
const msPend=pk&&pp==='unit';
const pilPend=pk&&pp==='pilot';
if(!ud){
const ep=pk&&pp==='unit';
return`<div class="tb-long-card tb-long-card--empty tb-long-card--rearrange-empty${ep?' is-rearrange-pending':''}" role="button" tabindex="0" onclick="tbRearrangeTapPart(${slotKey},'unit',event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbRearrangeTapPart(${slotKey},'unit',event)}"><div class="tb-slot-add-ms"><span style="font-size:28px;color:var(--accent-cyan);opacity:.85">+</span></div></div>`;
}
const side=_tbSideFromKey(slotKey);
const r=ud.rarity||'N';
const base=TB_LONG_BASE_MAP[r]||TB_LONG_BASE_MAP.N;
const portraitSrc=ud.portrait||ud.thum;
const lk=`${side}:`+String(ud.id)+':'+String(sl.charData&&sl.charData.id||'');
const oneBuff=imgTag(TB_LEADER_ICON,{cls:'tb-long-supporter-buff-img',webp:true,alt:''});
const leaderIc=(S.tb._leaderApplyCache&&S.tb._leaderApplyCache[lk])?`<div class="tb-long-supporter-buff">${oneBuff}</div>`:'';
let pilotBlock='';
if(sl.charData&&(sl.charData.portrait||sl.charData.thum)){
const psrc=sl.charData.portrait||sl.charData.thum;
pilotBlock=`<div class="tb-long-pilot-corner${pilPend?' is-rearrange-pending-zone':''}" onclick="tbRearrangeTapPart(${slotKey},'pilot',event)"><div class="tb-long-pilot">${imgTag(psrc,{webp:true,alt:''})}</div></div>`;
}else{
pilotBlock=`<div class="tb-long-pilot-corner${pilPend?' is-rearrange-pending-zone':''}" onclick="tbRearrangeTapPart(${slotKey},'pilot',event)"><div class="tb-slot-add-pilot tb-slot-add-pilot--corner">+</div></div>`;
}
let pCls='tb-long-portrait';
if(String(ud.body_type||'')==='3')pCls+=' tb-long-portrait--sd';
else if(TB_LONG_PORTRAIT_FACE_IDS.has(String(ud.id)))pCls+=' tb-long-portrait--face-balance';
const portraitImg=portraitSrc?imgTag(portraitSrc,{cls:pCls,webp:true,alt:''}):'';
const role=ud.role_icon?`<div class="tb-long-role"><img src="${imgUrl(ud.role_icon)}" alt=""></div>`:'';
const msZone=`<div class="tb-rearrange-ms-zone${msPend?' is-rearrange-pending-zone':''}" onclick="tbRearrangeTapPart(${slotKey},'unit',event)">${portraitImg}${leaderIc}${role}</div>`;
const portrait=`<div class="tb-long-portrait-wrap tb-long-portrait-wrap--rearrange-unlinked">${msZone}${pilotBlock}</div>`;
return`<div class="tb-long-card"><img class="tb-long-base" src="${imgUrl(base)}" alt="" loading="lazy">${portrait}</div>`;
}
function renderTbSlots(){
initTeamBuilder();
_tbDedupeOptionPartsAcrossTeam();
const r1f=document.getElementById('tbSlotsSquad1Front'),r1r=document.getElementById('tbSlotsSquad1Rear'),r2f=document.getElementById('tbSlotsSquad2Front'),r2r=document.getElementById('tbSlotsSquad2Rear');
if(!r1f||!r1r||!r2f||!r2r)return;
function rowHtml(side,col0,col1){
const squ=S.tb.squads[side];
let h='';
for(let col=col0;col<col1;col++){
const key=_tbKey(side,col);
const sl=squ.slots[col];
const sel=S.tb.selectedKey===key;
let cls='tb-slot'+(sel?' is-sel':'');
const terrState=(sl&&sl.unitData)?_tbSlotTerrainState(sl):null;
if(terrState&&terrState.blocked)cls+=' tb-slot--terrain-blocked';
else if(terrState&&terrState.movePenalty)cls+=' tb-slot--terrain-penalty';
if(S.tb.rearrange&&S.tb.rearrange.pendingKey===key)cls+=' is-rearrange-pending';
let terrTip='';
if(terrState&&terrState.blocked)terrTip=` title="${escAttr('Cannot deploy on '+tTerrain(S.tb.terrainType||'Space'))}"`;
else if(terrState&&terrState.movePenalty)terrTip=` title="${escAttr('Move -50% on '+tTerrain(S.tb.terrainType||'Space'))}"`;
h+=`<div class="tb-slot-col" data-tb-key="${key}"><div class="${cls}" data-tb-key="${key}"${terrTip} onclick="tbSlotClick(${key})" oncontextmenu="tbSlotContextMenu(${key},event);return false;">${_tbLongCardHtml(sl,key)}</div>${_tbSlotLbOutsideHtml(sl,key)}${_tbSlotStatModeHtml(key,sl)}${_tbSlotOpOutsideHtml(key,sl)}</div>`;
}
return h;
}
r1f.innerHTML=rowHtml(1,0,3);r1r.innerHTML=rowHtml(1,3,5);
r2f.innerHTML=rowHtml(2,0,3);r2r.innerHTML=rowHtml(2,3,5);
scheduleTbLeaderRefresh();
}
let _tbLeaderFt=null;
function scheduleTbLeaderRefresh(){clearTimeout(_tbLeaderFt);_tbLeaderFt=setTimeout(tbRefreshLeaderApplies,100)}
async function tbRefreshLeaderApplies(){
initTeamBuilder();
S.tb._leaderApplyCache=S.tb._leaderApplyCache||{};
const tasks=[];
for(const side of[1,2]){
const sup=S.tb.supBySide[side].data;
if(!sup||!sup.id)continue;
const squ=S.tb.squads[side];
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(!sl||!sl.unitData||sl.unitData._manual)continue;
const uid=String(sl.unitData.id);
const cid=sl.charData&&sl.charData.id?String(sl.charData.id):'';
const k=`${side}:`+uid+':'+cid;
if(S.tb._leaderApplyCache[k]!==undefined)continue;
tasks.push((async()=>{
try{
const lbQ=Math.min(3,Math.max(0,(S.tb.supBySide[side].lbTier|0)));
const lvQ=Math.min(100,Math.max(1,(S.tb.supBySide[side].level!=null?S.tb.supBySide[side].level|0:100)));
let q=`/api/supporter/${encodeURIComponent(sup.id)}?lang=${S.lang}&level=${lvQ}&lb_tier=${lbQ}&for_unit_id=${encodeURIComponent(uid)}`;
if(cid)q+='&for_char_id='+encodeURIComponent(cid);
const d=await fetch(q).then(r=>r.json());
const ls=d&&d.leader_skills||[];
S.tb._leaderApplyCache[k]=ls.some(x=>x&&x.applies);
}catch(_){S.tb._leaderApplyCache[k]=false}
})());
}}
if(tasks.length){await Promise.all(tasks);renderTbSlots()}
}
function _tbSupporterFetchQs(side){
initTeamBuilder();
const squ=S.tb.squads[side];
let uId=null,cId=null;
for(let i=0;i<5;i++){const sl=squ.slots[i];if(sl&&sl.unitData){uId=sl.unitId;cId=sl.charId;break}}
let x='';
if(uId)x+='&for_unit_id='+encodeURIComponent(uId);
if(cId)x+='&for_char_id='+encodeURIComponent(cId);
return x;
}
function _tbSupporterLbIconsHtml(side,s){
const ent=S.tb.supBySide[side];
const cur=Math.min(3,Math.max(0,(ent&&ent.lbTier!=null?ent.lbTier|0:(s.lb_tier!=null?s.lb_tier|0:0))));
const lbOpt=String(t('supp_lb_tier')||'LB');
let btns='';
for(let i=0;i<=3;i++){
const pip=cmpLbPipsAtTier(i);
const sel=i===cur?' tb-supp-lb-ic--sel':'';
btns+=`<button type="button" class="tb-supp-lb-ic${sel}" aria-pressed="${i===cur?'true':'false'}" title="${escAttr(lbOpt+' '+i)}" aria-label="${escAttr(lbOpt+' '+i)}" onclick="event.stopPropagation();tbSetSupporterLbFromIcon(${side},${i},event)">${cmpLbPipsRow(pip[0],pip[1],pip[2])}</button>`;
}
return`<div class="tb-supp-lb-icons">${btns}</div>`;
}
function tbSetSupporterLbFromIcon(side,tier,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
const ent=S.tb.supBySide[side];
if(!ent||!ent.id)return;
ent.lbTier=Math.min(3,Math.max(0,tier|0));
_tbRefetchSupporterForSide(side).then(()=>renderTeamBuilder());
}
function _tbSupporterDetailHtml(s,side){
const boost=`<div class="tb-supp-boost"><span class="support-stat-badge support-hp">${esc(t('hp_support'))} +${fmtN(s.hp_support||0)}</span><span class="support-stat-badge support-atk">${esc(t('atk_support'))} +${fmtN(s.atk_support||0)}</span></div>`;
let leaders='';
if(s.leader_skills&&s.leader_skills.length){
leaders=`<div class="tb-supp-sec"><div class="tb-supp-sec-title">${esc(t('sec_leader_skill'))}</div>`+s.leader_skills.map(ls=>{
const na=ls.applies===false?`<span class="tb-supp-na">(—)</span>`:'';
const tagRow=ls.tags&&ls.tags.length?`<div class="detail-tags-row" style="margin-top:6px">${renderSkillTags([{tags:ls.tags,separator:ls.separator}])}</div>`:'';
return`<div class="tb-supp-leader-item"><div class="tb-supp-leader-desc">${esc(ls.desc)}${na}</div>${tagRow}</div>`;
}).join('')+'</div>';
}
let act='';
if(s.active_skills&&s.active_skills.length){
act=`<div class="tb-supp-sec"><div class="tb-supp-sec-title">${esc(t('sec_active_skills'))}</div>`+s.active_skills.map(sk=>`<div class="tb-supp-act-item">${sk.icon?`<img class="tb-supp-act-ic" src="${imgUrl(sk.icon)}" alt="" loading="lazy">`:''}<div><div class="tb-supp-act-name">${esc(sk.name)}</div>${sk.desc?`<div class="tb-supp-act-desc">${esc(sk.desc)}</div>`:''}</div></div>`).join('')+'</div>';
}
return`${boost}${leaders}${act}`;
}
async function _tbRefetchSupporterForSide(side){
initTeamBuilder();
const ent=S.tb.supBySide[side];
if(!ent||!ent.id)return;
const lb=Math.min(3,Math.max(0,ent.lbTier|0));
const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const d=await fetch(`/api/supporter/${encodeURIComponent(ent.id)}?lang=${S.lang}&level=${slv}&lb_tier=${lb}${_tbSupporterFetchQs(side)}`).then(r=>r.json());
if(!d.error){ent.data=d;ent.lbTier=d.lb_tier!=null?d.lb_tier|0:lb;if(d.level!=null)ent.level=Math.min(100,Math.max(1,d.level|0));S.tb._leaderApplyCache={}}
}catch(_){}
}
let _tbSupporterLevelTimers={};
function tbOnSupporterLevelInput(side,raw){
initTeamBuilder();
const ent=S.tb.supBySide[side];
if(!ent||!ent.id)return;
const lv=Math.min(100,Math.max(1,parseInt(String(raw),10)||100));
ent.level=lv;
const el=document.getElementById('tbSuppCardLvlTxt'+side);
if(el)el.textContent=fmtN(lv);
const rid='s'+String(side);
clearTimeout(_tbSupporterLevelTimers[rid]);
_tbSupporterLevelTimers[rid]=setTimeout(()=>{
_tbRefetchSupporterForSide(side).then(()=>{renderTbSupporter();renderTbStats();scheduleTbLeaderRefresh()});
},140);
}
function _tbRenderOneSupporterCol(cardId,detId,side){
const card=document.getElementById(cardId),det=document.getElementById(detId);
if(!card||!det)return;
const ent=S.tb.supBySide[side];
if(!ent||!ent.id){card.innerHTML=`<div class="tb-supp-placeholder">${esc(t('tb_pick_supp'))}</div>`;det.innerHTML='';return}
const s=ent.data;
if(!s){card.innerHTML=`<div class="tb-supp-placeholder">${esc(t('tb_pick_supp'))}</div>`;det.innerHTML='';return}
const lv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:(s.level||100)));
const slideLbl=escAttr(t('tb_supp_level_slider')||'Supporter level from 1 to 100');
const adjLbl=esc(t('tb_supp_level_adjust')||'Adjust');
card.innerHTML=`<div class="tb-supp-card-stack tb-supp-card-stack--full"><div class="tb-supp-frames tb-supp-frames--left">${renderTbSupporterPortraitOnly(s,96)}</div><div class="tb-supp-card-meta-in"><strong class="tb-supp-card-name">${esc(s.name||'')}</strong><div class="tb-supp-meta-line tb-supp-meta-line--lvl tb-supp-meta-line--in-card"><span class="tb-supp-lvl-txt"><strong>${esc(t('supp_level'))}</strong>: <span id="tbSuppCardLvlTxt${side}">${fmtN(lv)}</span></span>${_tbSupporterLbIconsHtml(side,s)}</div><div class="tb-supp-lvl-slider-row" role="group" aria-label="${slideLbl}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" ontouchstart="event.stopPropagation()"><span class="tb-supp-lvl-slider-lbl" id="tbSuppLvLbl${side}">${adjLbl}</span><input type="range" min="1" max="100" step="1" value="${lv}" aria-labelledby="tbSuppLvLbl${side}" title="${slideLbl}" oninput="tbOnSupporterLevelInput(${side},this.value)"></div></div></div>`;
det.innerHTML=_tbSupporterDetailHtml(s,side);
}
function renderTbSupporter(){
initTeamBuilder();
_tbRenderOneSupporterCol('tbSuppCard1','tbSuppDetail1',1);
_tbRenderOneSupporterCol('tbSuppCard2','tbSuppDetail2',2);
}
function tbOpenOptionPartsPicker(key){
initTeamBuilder();
S.tb.selectedKey=key;
renderTbSlots();
openTbPicker('option',key,{opReplaceIdx:null});
}
function tbOpenOptionReplacePicker(key,idx,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
renderTbSlots();
openTbPicker('option',key,{opReplaceIdx:idx|0});
}
function tbClearOptionPart(key,idx,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
const i=idx|0;
const side=_tbSideFromKey(key);
const col=_tbIdxFromKey(key);
let sl;
if(S.tb.rearrange){sl=S.tb.rearrange.draft[side].slots[col]}
else{sl=_tbSquFromKey(key).slots[col]}
if(!sl||!Array.isArray(sl.optionParts))return;
if(i<0||i>=sl.optionParts.length)return;
sl.optionParts.splice(i,1);
S.tb.selectedKey=key;
S.tb._leaderApplyCache={};
if(S.tb.rearrange)tbRenderRearrangeBody();
else renderTeamBuilder();
}
async function renderTbStats(){
initTeamBuilder();
const pan=document.getElementById('tbStatsPanel');if(!pan)return;
const jobs=[];
for(let si=1;si<=2;si++){
const squ=S.tb.squads[si];
for(let col=0;col<5;col++){
const key=_tbKey(si,col);
const sl=squ.slots[col];
jobs.push({si,col,key,sl});
}}
const supByKey={};
const needFetch=jobs.filter(j=>j.sl&&j.sl.unitData&&S.tb.supBySide[j.si]&&S.tb.supBySide[j.si].id);
if(needFetch.length){
await Promise.all(needFetch.map(async j=>{
const ent=S.tb.supBySide[j.si];
const lb=Math.min(3,Math.max(0,ent.lbTier|0));
const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const q=`/api/supporter/${encodeURIComponent(ent.id)}?lang=${S.lang}&level=${slv}&lb_tier=${lb}&for_unit_id=${encodeURIComponent(j.sl.unitId)}&for_char_id=${encodeURIComponent(j.sl.charId||'')}`;
const d=await fetch(q).then(r=>r.json());
supByKey[j.key]=(!d||d.error)?null:d;
}catch(_){supByKey[j.key]=null}
}));
}
const mkRow=(lbl,v,d)=>{const dn=d!=null&&Math.round(Number(d)||0)<0;return`<div class="tb-stats-unit-row${dn?' tb-stats-unit-row--neg':''}"><span class="tb-sul">${lbl}</span><span class="tb-suv-wrap"><span class="tb-suv">${fmtN(v)}</span>${_tbFmtStatDelta(d)}</span></div>`};
function colHtml(j){
const{si,col,key,sl}=j;
const sel=S.tb.selectedKey===key;
const cls='tb-stats-unit-col'+(sel?' is-sel':'');
if(!sl||!sl.unitData){
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name tb-stats-unit-name--empty">—</div><div class="tb-stats-unit-rows"></div></div>`;
}
const st=_tbBuildSlotStatEff(sl,si,supByKey[key]);
if(!st){
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name tb-stats-unit-name--empty">—</div></div>`;
}
if(st.blocked){
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name">${esc(st.ud.name||'')}</div><div class="tb-stats-unit-warn">Cannot deploy on ${esc(tTerrain(S.tb.terrainType||'Space'))} (${esc(st.terrainSymbol||'-')})</div></div>`;
}
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name">${esc(st.ud.name||'')}</div><div class="tb-stats-unit-rows">${mkRow(t('col_hp'),st.hp,st.dHp)}${mkRow(t('col_atk'),st.atk,st.dAtk)}${mkRow(t('col_def'),st.def,st.dDef)}${mkRow(t('col_mob'),st.mob,st.dMob)}${mkRow(t('col_mov'),st.mov,st.dMov)}</div></div>`;
}
const sections=[];
for(let si=1;si<=2;si++){
const lab=si===1?t('tb_squad1'):t('tb_squad2');
const cols=jobs.filter(j=>j.si===si).map(colHtml);
sections.push(`<div class="tb-stats-squad"><div class="tb-stats-squad-h">${esc(lab)}</div><div class="tb-stats-squad-cols">${cols.join('')}</div></div>`);
}
pan.innerHTML=`<div class="tb-stats-hint" style="font-size:11px;color:var(--text-muted);margin-bottom:10px;line-height:1.45">${esc(t('tb_stats_hint'))}${esc(t('tb_stats_hint_squad'))}</div><div class="tb-stats-all tb-stats-all--squads">${sections.join('')}</div>`;
}
function tbApplyLangStatic(){
const el=id=>document.getElementById(id);
if(el('tbPageTitle'))el('tbPageTitle').textContent=t('tab_team_builder');
if(el('tbTerrainLbl'))el('tbTerrainLbl').textContent=t('terrain');
if(el('tbDeployFront1Lbl'))el('tbDeployFront1Lbl').textContent=t('tb_front_deploy');
if(el('tbDeployRear1Lbl'))el('tbDeployRear1Lbl').textContent=t('tb_rear_deploy');
if(el('tbDeployFront2Lbl'))el('tbDeployFront2Lbl').textContent=t('tb_front_deploy');
if(el('tbDeployRear2Lbl'))el('tbDeployRear2Lbl').textContent=t('tb_rear_deploy');
if(el('tbSquad1Lbl'))el('tbSquad1Lbl').textContent=t('tb_squad1');
if(el('tbSquad2Lbl'))el('tbSquad2Lbl').textContent=t('tb_squad2');
if(el('tbBtnFormation'))el('tbBtnFormation').textContent=t('tb_formation');
if(el('tbBtnRearrange'))el('tbBtnRearrange').textContent=t('tb_rearrange');
if(el('tbRearrangeBanner'))el('tbRearrangeBanner').textContent=t('tb_rearrange_banner');
if(el('tbRearrangeLinkedLbl'))el('tbRearrangeLinkedLbl').textContent=t('tb_linked_move');
if(el('tbRearrangeCancelBtn'))el('tbRearrangeCancelBtn').textContent=t('tb_cancel');
if(el('tbRearrangeOkBtn'))el('tbRearrangeOkBtn').textContent=t('tb_confirm');
if(el('tbFormModalTitle'))el('tbFormModalTitle').textContent=t('tb_formation_modal_title');
if(el('tbFormCopyLinkBtn'))el('tbFormCopyLinkBtn').textContent=t('tb_copy_link');
if(el('tbFormScreenshotBtn'))el('tbFormScreenshotBtn').textContent=t('tb_screenshot');
if(el('tbFormSavedTitle'))el('tbFormSavedTitle').textContent=t('tb_saved_formations');
if(el('tbFormationCloseBtn'))el('tbFormationCloseBtn').textContent=t('whats_new_close');
if(el('tbMlLbl'))el('tbMlLbl').textContent=t('tb_master_league');
if(el('tbGoLbl'))el('tbGoLbl').textContent=t('tb_grand_offensive');
if(el('tbSuppLbl1'))el('tbSuppLbl1').textContent=t('tb_squad1')+' · '+t('tab_supporter');
if(el('tbSuppLbl2'))el('tbSuppLbl2').textContent=t('tb_squad2')+' · '+t('tab_supporter');
const _tbs=t('tb_clear_supporter'),_tbq=t('tb_clear_squad'),_tbi=imgUrlWebp(TB_TRASH_ICON);
document.querySelectorAll('#panel-team_builder img[data-tb-trash-ic]').forEach(im=>{im.src=_tbi});
['tbClearSupp1','tbClearSupp2'].forEach(id=>{const b=document.getElementById(id);if(b){b.title=_tbs;b.setAttribute('aria-label',_tbs)}});
['tbClearSquad1','tbClearSquad2'].forEach(id=>{const b=document.getElementById(id);if(b){b.title=_tbq;b.setAttribute('aria-label',_tbq)}});
}
function tbSyncSquadLabels(){
initTeamBuilder();
const d1=t('tb_squad1'),d2=t('tb_squad2');
const n1=String(S.tb.squads[1].name||'').trim();
const n2=String(S.tb.squads[2].name||'').trim();
const el1=document.getElementById('tbSquad1Lbl'),el2=document.getElementById('tbSquad2Lbl');
if(el1)el1.textContent=n1||d1;
if(el2)el2.textContent=n2||d2;
}
function renderTeamBuilder(){initTeamBuilder();tbFillTerrainSelects();tbApplyLangStatic();tbSyncSquadLabels();_tbSyncBuffTogglesFromState();renderTbSlots();renderTbSupporter();void renderTbStats()}
let _tbPickerDebounce=null,_tbPickerAbort=null,_tbPickerGen=0;
function closeTbPicker(){if(_tbPickerAbort){try{_tbPickerAbort.abort()}catch(_){}_tbPickerAbort=null}const po=document.getElementById('tbPickerOverlay');if(po){po.classList.remove('active');po.setAttribute('aria-hidden','true')}}
async function openTbPicker(type,slotKey,opts){
if(type==='char')type='character';
initTeamBuilder();closeTbPicker();clearTimeout(_tbPickerDebounce);
let opRep=null;
if(opts&&('opReplaceIdx' in opts)&&opts.opReplaceIdx!=null)opRep=opts.opReplaceIdx|0;
S.tb.picker={type,slotKey,abort:null,gen:0,rows:[],opReplaceIdx:opRep};
_tbPickerGen++;
const ov=document.getElementById('tbPickerOverlay'),inp=document.getElementById('tbPickerSearch'),body=document.getElementById('tbPickerBody');
if(!ov||!inp||!body)return;
inp.value='';
ov.classList.add('active');ov.setAttribute('aria-hidden','false');
if(type==='option'){
const squ=_tbSquFromKey(slotKey);const sl=squ.slots[_tbIdxFromKey(slotKey)];
if(!sl||!sl.unitId){body.innerHTML=`<div style="padding:16px;color:var(--text-muted)">${esc(t('dc_pick_unit'))}</div>`;return}
body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
const uq='&unit_id='+encodeURIComponent(sl.unitId);
S.tb.picker.rows=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL'+uq);
filterTbPickerList();
}catch(_){body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
setTimeout(()=>inp.focus(),50);
return;
}
if(type==='supporter'){
body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
let extra='&rarity=ALL';
const ss=S._tbSupPickerSide===2?2:1;
const squ=S.tb.squads[ss];
const uIds=[],cIds=[];
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(sl&&sl.unitData){uIds.push(sl.unitId);cIds.push(sl.charId||'')}
}
if(uIds.length){
extra+='&unit_ids='+encodeURIComponent(uIds.join(','))+'&char_ids='+encodeURIComponent(cIds.join(','));
}
const d=await fetch(`/api/supporters?lang=${S.lang}&page=1&per_page=200&sort=rarity&dir=desc&q=${encodeURIComponent('')}${extra}`).then(r=>r.json());
S.tb.picker.rows=d.rows||[];
filterTbPickerList();
}catch(_){S.tb.picker.rows=[];body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
setTimeout(()=>inp.focus(),50);
return;
}
inp.placeholder=type==='character'?t('search_char'):t('search_unit');
const cached=(type==='unit'||type==='character')?_tbPickerCacheGet(type,slotKey):null;
if(cached&&cached.length)S.tb.picker.rows=cached.slice();
if(S.tb.picker.rows&&S.tb.picker.rows.length)filterTbPickerList();
else body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
setTimeout(()=>inp.focus(),50);
await _tbDoPickerSearch();
}
function filterTbPicker(){clearTimeout(_tbPickerDebounce);_tbPickerDebounce=setTimeout(()=>{if(S.tb.picker.type==='unit'||S.tb.picker.type==='character')_tbDoPickerSearch();else filterTbPickerList()},55)}
function wireTbPickerBodyClicks(){
const body=document.getElementById('tbPickerBody');
if(!body||body.dataset.tbPickWired)return;
body.dataset.tbPickWired='1';
body.addEventListener('click',function(ev){
const item=ev.target.closest('.tb-picker-item');
if(!item)return;
const id=item.getAttribute('data-tb-pick-id');
if(id==null||id==='')return;
pickTbItem(id);
});
body.addEventListener('keydown',function(ev){
if(ev.key!=='Enter'&&ev.key!==' ')return;
const item=ev.target.closest('.tb-picker-item');
if(!item||document.activeElement!==item)return;
ev.preventDefault();
const id=item.getAttribute('data-tb-pick-id');
if(id!=null&&id!=='')pickTbItem(id);
});
}
function tbRenderPickerItemCell(r,t,th){
const id=escAttr(String(r.id));
const thumb=renderListThumb(r,t,th,{pickerThumb:true});
let role='';
if((t==='unit'||t==='character')&&r.role_icon){
role=`<span class="tb-picker-role-inline" aria-hidden="true">${pictureRasterHtml(r.role_icon,{cls:'tb-picker-role-ic',loading:'eager',decoding:'async',alt:'',lazy:false})}</span>`;
}
return`<div class="tb-picker-item" role="button" tabindex="0" data-tb-pick-id="${id}">${thumb}${role}<span class="tb-picker-item-name">${esc(r.name||'')}</span></div>`;
}
function _tbSortPickerEntityRows(rows){
return(rows||[]).slice().sort((a,b)=>{
const ra=Number(a.rarity_sort);const rb=Number(b.rarity_sort);
const na=Number.isFinite(ra)?ra:4;const nb=Number.isFinite(rb)?rb:4;
if(na!==nb)return na-nb;
const sa=String(a.id??'');const sb=String(b.id??'');
const ia=parseInt(sa,10);const ib=parseInt(sb,10);
if(Number.isFinite(ia)&&Number.isFinite(ib)&&ia!==ib)return ia-ib;
return sa.localeCompare(sb,'en',{numeric:true,sensitivity:'base'});
});
}
function tbInvalidateTbPickerUnitCache(){if(S._tbPickerRowCache&&S._tbPickerRowCache.unitBySide)delete S._tbPickerRowCache.unitBySide}
function _tbPickerCharCacheKey(){return'C|'+S.lang}
function _tbPickerUnitCacheKey(side){
initTeamBuilder();
const terr=S.tb.terrainType||'Space';
const sup=S.tb.supBySide[side];
const b=sup&&sup.id?String(sup.id):'';
return'U|'+S.lang+'|'+terr+'|'+side+'|'+b;
}
function _tbPickerCacheGet(type,slotKey){
if(type!=='unit'&&type!=='character')return null;
const c=S._tbPickerRowCache;if(!c)return null;
if(type==='character'){const e=c.character;if(e&&e.key===_tbPickerCharCacheKey())return e.rows;return null}
const side=slotKey!=null?_tbSideFromKey(slotKey):1;
const want=_tbPickerUnitCacheKey(side);
const e=c.unitBySide&&c.unitBySide[String(side)];
if(e&&e.key===want)return e.rows;
return null;
}
function _tbPickerCachePut(type,slotKey,qU,rows){
if(qU)return;
const sorted=_tbSortPickerEntityRows(rows||[]);
S._tbPickerRowCache=S._tbPickerRowCache||{};
if(type==='character'){S._tbPickerRowCache.character={key:_tbPickerCharCacheKey(),rows:sorted};return}
if(type==='unit'){
const side=slotKey!=null?_tbSideFromKey(slotKey):1;
if(!S._tbPickerRowCache.unitBySide)S._tbPickerRowCache.unitBySide={};
S._tbPickerRowCache.unitBySide[String(side)]={key:_tbPickerUnitCacheKey(side),rows:sorted};
}
}
async function tbPrimePickerCaches(){
if(typeof S==='undefined'||!S.tb)return;
initTeamBuilder();
if(S._tbPickerPrimeBusy)return;
S._tbPickerPrimeBusy=true;
const terr=_tbTerrainQuery();
const lang=S.lang;
try{
const charP=fetch(`/api/characters?lang=${lang}&page=1&per_page=100&sort=rarity&dir=desc&q=`).then(r=>r.json()).then(d=>{
const rows=_tbSortPickerEntityRows(d.rows||[]);
S._tbPickerRowCache=S._tbPickerRowCache||{};
S._tbPickerRowCache.character={key:_tbPickerCharCacheKey(),rows};
}).catch(()=>{});
function primeSide(side){
const sup=S.tb.supBySide[side];
const bq=sup&&sup.id?String(sup.id):'';
const boostQ=bq?'&tb_boost_supporter='+encodeURIComponent(bq):'';
const pp=bq?'600':'100';
const url=`/api/units?lang=${lang}&page=1&per_page=${pp}&sort=rarity&dir=desc&q=${encodeURIComponent('')}&rarity=ALL${terr}${boostQ}`;
return fetch(url).then(r=>r.json()).then(d=>{
const rows=_tbSortPickerEntityRows(d.rows||[]);
S._tbPickerRowCache=S._tbPickerRowCache||{};
if(!S._tbPickerRowCache.unitBySide)S._tbPickerRowCache.unitBySide={};
S._tbPickerRowCache.unitBySide[String(side)]={key:_tbPickerUnitCacheKey(side),rows};
}).catch(()=>{});
}
await Promise.all([charP,primeSide(1),primeSide(2)]);
}catch(_){}
finally{S._tbPickerPrimeBusy=false}
}
function filterTbPickerList(){
const body=document.getElementById('tbPickerBody');if(!body)return;
const pType=S.tb.picker.type;
const q=String(document.getElementById('tbPickerSearch').value||'').trim().toLowerCase();
let rows=S.tb.picker.rows||[];
if(q&&pType!=='unit'&&pType!=='character'){
rows=rows.filter(r=>{
const tagHay=(r.tags||[]).map(tg=>String(tg.name||'')).join(' ').toLowerCase();
const hay=(String(r.name||'')+' '+String(r.details||r.boost||'')+' '+tagHay).toLowerCase();
return hay.includes(q);
});
}
if(pType==='option'&&S.tb.picker.slotKey!=null){
const usedSsr=_tbCollectUsedSsrOptionPartIds(S.tb.picker.slotKey);
rows=rows.filter(r=>r&&r.id!=null&&!(_tbOptionPartIsSsr(r)&&usedSsr.has(String(r.id))));
}
if(pType==='unit'||pType==='character'||pType==='option'||pType==='supporter')rows=_tbSortPickerEntityRows(rows);
if(!rows.length){body.innerHTML=`<div style="padding:16px;color:var(--text-muted)">${esc(t('search_spotlight_empty'))}</div>`;return}
const th=52;
let cells;
if(pType==='option'){
const RARITY_COLORS={'UR':'#fbbf24','SSR':'#f97316','SR':'#a78bfa','R':'#60a5fa','N':'#94a3b8'};
cells=rows.map(r=>{
const rc=RARITY_COLORS[r.rarity]||'#94a3b8';
const meta=((r.details||'').trim()+(r.tags&&r.tags.length?(' · '+r.tags.map(tg=>tg.name).filter(Boolean).join(' · ')):''));
return`<div class="tb-picker-item cmp-picker-item" role="button" tabindex="0" data-tb-pick-id="${escAttr(String(r.id))}" style="padding:8px 12px;cursor:pointer;width:100%;box-sizing:border-box;border-radius:8px;border:1px solid var(--border-color);background:var(--card-bg)"><div><div style="display:flex;align-items:center;gap:6px"><span style="color:${rc};font-weight:700;font-size:11px">${esc(r.rarity||'')}</span><span class="cmp-picker-item-name" style="font-size:13px">${esc(r.name)}</span></div>${meta?`<div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.35">${esc(meta)}</div>`:''}</div></div>`;
}).join('');
body.innerHTML=`<div class="tb-picker-option-list">${cells}</div>`;
return;
}else if(pType==='supporter'){
cells=rows.map(r=>tbRenderPickerItemCell(r,'supp',th));
}else{
cells=rows.map(r=>tbRenderPickerItemCell(r,pType==='character'?'char':'unit',th));
}
body.innerHTML=`<div class="tb-picker-grid">${cells.join('')}</div>`;
}
async function _tbDoPickerSearch(){
const type=S.tb.picker.type,q=document.getElementById('tbPickerSearch').value.trim(),body=document.getElementById('tbPickerBody');
if(!body)return;
if(_tbPickerAbort){try{_tbPickerAbort.abort()}catch(_){}}
const ac=new AbortController();_tbPickerAbort=ac;const myGen=++_tbPickerGen;
const base=type==='character'?'/api/characters':'/api/units';
const qU=expandTbPickerSearchQuery(q,type);
const terr=type==='unit'?_tbTerrainQuery():'';
let boostQ='';
if(type==='unit'){
const sk=S.tb.picker.slotKey;
const side=sk!=null?_tbSideFromKey(sk):1;
const sup=S.tb.supBySide[side];
if(sup&&sup.id)boostQ='&tb_boost_supporter='+encodeURIComponent(sup.id);
}
const ppTb=boostQ?'600':'100';
const haveInstantList=!qU&&S.tb.picker.rows&&S.tb.picker.rows.length;
if(!haveInstantList||qU)body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
const url=`${base}?lang=${S.lang}&page=1&per_page=${ppTb}&sort=rarity&dir=desc&q=${encodeURIComponent(qU)}&rarity=ALL${terr}${boostQ}`;
const r=await fetch(url,{signal:ac.signal});
const d=await r.json();
if(myGen!==_tbPickerGen)return;
S.tb.picker.rows=_tbSortPickerEntityRows(d.rows||[]);
_tbPickerCachePut(type,S.tb.picker.slotKey,qU,S.tb.picker.rows);
filterTbPickerList();
}catch(e){if(e&&e.name==='AbortError')return;if(myGen!==_tbPickerGen)return;if(!haveInstantList||qU)body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
}
async function _tbAssignUnitDataToSlot(sl,d,sidStr){
if(!sl||!d||d.error)return;
sl.unitId=String(sidStr!=null?sidStr:d.id);sl.unitData=d;sl.optionParts=[];
if(!_tbUnitAllowsSpSsp(d))sl.unitStatMode='normal';
sl.charId=null;sl.charData=null;
const rc=d.recommend_character;
if(rc&&rc.id){
try{
const cd=await fetch(`/api/character/${encodeURIComponent(rc.id)}?lang=${S.lang}`).then(r=>r.json());
if(!cd.error){sl.charId=String(rc.id);sl.charData=cd}
}catch(_){}
}
}
async function pickTbItem(id){
const sid=String(id==null?'':id).trim();
const pik=S.tb.picker||{};
const type=pik.type,slotKey=pik.slotKey;
const repIdx=('opReplaceIdx' in pik&&pik.opReplaceIdx!=null)?(pik.opReplaceIdx|0):null;
const rowsSnap=pik.rows||[];
closeTbPicker();
initTeamBuilder();
if(type==='supporter'){
if(!sid)return;
const ss=S._tbSupPickerSide===2?2:1;
try{
const prevLb=S.tb.supBySide[ss]&&S.tb.supBySide[ss].lbTier!=null?S.tb.supBySide[ss].lbTier|0:3;
const prevLv=S.tb.supBySide[ss]&&S.tb.supBySide[ss].level!=null?S.tb.supBySide[ss].level|0:100;
const d=await fetch(`/api/supporter/${encodeURIComponent(sid)}?lang=${S.lang}&level=${prevLv}&lb_tier=${prevLb}${_tbSupporterFetchQs(ss)}`).then(r=>r.json());
if(!d.error){S.tb.supBySide[ss]={id:sid,data:d,lbTier:d.lb_tier!=null?d.lb_tier|0:prevLb,level:Math.min(100,Math.max(1,d.level!=null?d.level|0:prevLv))};S.tb._leaderApplyCache={};tbInvalidateTbPickerUnitCache()}
}catch(_){}
renderTeamBuilder();return;
}
if(slotKey==null)return;
if(!sid)return;
const squ=_tbSquFromKey(slotKey);const sl=squ.slots[_tbIdxFromKey(slotKey)];
if(type==='unit'){
try{
const d=await fetch(`/api/unit/${encodeURIComponent(sid)}?lang=${S.lang}`).then(r=>r.json());
await _tbAssignUnitDataToSlot(sl,d,sid);
await tbAutoFillEmptyOptionParts({skipRender:true});
}catch(_){}
}else if(type==='character'){
try{const d=await fetch(`/api/character/${encodeURIComponent(sid)}?lang=${S.lang}`).then(r=>r.json());if(!d.error){sl.charId=sid;sl.charData=d}}catch(_){}
}else if(type==='option'){
const hit=rowsSnap.find(x=>String(x.id)===String(sid));
if(hit){
if(!sl.optionParts)sl.optionParts=[];
if(repIdx!=null&&repIdx>=0&&repIdx<sl.optionParts.length){
const usedSsr=_tbCollectUsedSsrOptionPartIds(slotKey);
(sl.optionParts||[]).forEach((pp,i)=>{if(i!==repIdx&&pp&&pp.id&&_tbOptionPartIsSsr(pp))usedSsr.add(String(pp.id))});
if(_tbOptionPartIsSsr(hit)&&usedSsr.has(String(hit.id)))return;
sl.optionParts[repIdx]=hit;
}else{
if(sl.optionParts.length>=5)return;
if(sl.optionParts.some(p=>p&&String(p.id)===String(hit.id)))return;
const usedSsr=_tbCollectUsedSsrOptionPartIds(slotKey);
if(_tbOptionPartIsSsr(hit)&&usedSsr.has(String(hit.id)))return;
sl.optionParts=[hit];
}
}
}
renderTeamBuilder();
}
function openTbSupporterPicker(side){initTeamBuilder();S._tbSupPickerSide=side===2?2:1;S.tb.picker.slotKey=null;openTbPicker('supporter',null)}
function tbStartRearrange(){
initTeamBuilder();
S.tb.rearrange={draft:JSON.parse(JSON.stringify(S.tb.squads)),pendingKey:null,pendingPart:null};
document.getElementById('tbRearrangeOverlay').classList.add('active');
document.getElementById('tbRearrangeOverlay').setAttribute('aria-hidden','false');
tbRenderRearrangeBody();
}
function tbRenderRearrangeBody(){
const body=document.getElementById('tbRearrangeBody');if(!body)return;
const linked=!!document.getElementById('tbRearrangeLinked').checked;
function rowSeg(side,col0,col1,rowCls){
const squ=S.tb.rearrange.draft[side];
let h='';
for(let col=col0;col<col1;col++){
const key=_tbKey(side,col);
const sl=squ.slots[col];
const pk=S.tb.rearrange.pendingKey===key&&linked;
let slotInner='';
if(linked){
slotInner=`<div class="tb-slot${pk?' is-rearrange-pending':''}" style="width:100%;max-width:100px" onclick="tbRearrangeTap(${key})">${_tbLongCardHtml(sl,key)}</div>`;
}else{
slotInner=`<div class="tb-slot" style="width:100%;max-width:100px">${_tbLongCardHtmlRearrangeUnlinked(sl,key)}</div>`;
}
h+=`<div class="tb-slot-col tb-slot-col--rearrange" style="width:100px">${slotInner}${_tbSlotLbOutsideHtml(sl,key)}${_tbSlotOpOutsideHtml(key,sl)}</div>`;
}
return`<div class="tb-slot-row ${rowCls}">${h}</div>`;
}
function squadBlock(side,squadTitle){
const nm=S.tb.rearrange.draft[side]&&S.tb.rearrange.draft[side].name?String(S.tb.rearrange.draft[side].name).trim():'';
const head=nm?esc(nm):esc(squadTitle);
return`<div class="tb-rearrange-squad"><div class="tb-slots-label">${head}</div><div class="tb-deploy-lbl" style="margin-top:6px">${esc(t('tb_front_deploy'))}</div>${rowSeg(side,0,3,'')}<div class="tb-deploy-lbl" style="margin-top:10px">${esc(t('tb_rear_deploy'))}</div>${rowSeg(side,3,5,'tb-slot-row--rear')}</div>`;
}
body.innerHTML=`<div class="tb-rearrange-dual">${squadBlock(1,t('tb_squad1'))}${squadBlock(2,t('tb_squad2'))}</div>`;
}
function tbRearrangeLinkedToggle(){
if(!S.tb.rearrange)return;
S.tb.rearrange.pendingKey=null;
S.tb.rearrange.pendingPart=null;
tbRenderRearrangeBody();
}
function tbRearrangeTapPart(key,part,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
if(!S.tb.rearrange)return;
if(!!document.getElementById('tbRearrangeLinked').checked)return;
const p=part==='pilot'?'pilot':'unit';
const pend=S.tb.rearrange;
if(pend.pendingKey==null){pend.pendingKey=key;pend.pendingPart=p;tbRenderRearrangeBody();return}
const a=pend.pendingKey,b=key;
if(a===b&&pend.pendingPart===p){pend.pendingKey=null;pend.pendingPart=null;tbRenderRearrangeBody();return}
const sa=_tbSideFromKey(a),sb=_tbSideFromKey(b);
if(sa!==sb){pend.pendingKey=b;pend.pendingPart=p;tbRenderRearrangeBody();return}
if(pend.pendingPart!==p){pend.pendingKey=b;pend.pendingPart=p;tbRenderRearrangeBody();return}
const squ=S.tb.rearrange.draft[sa];
const ia=_tbIdxFromKey(a),ib=_tbIdxFromKey(b);
const slotA=squ.slots[ia],slotB=squ.slots[ib];
if(p==='unit'){
const ua={unitId:slotA.unitId,unitData:slotA.unitData,optionParts:slotA.optionParts||[],lbTier:slotA.lbTier|0,unitStatMode:slotA.unitStatMode||'normal',unitCondPassive:!!slotA.unitCondPassive,unitTurnBuffAtk:!!slotA.unitTurnBuffAtk,unitTurnBuffDef:!!slotA.unitTurnBuffDef,exSquadAtkPct:slotA.exSquadAtkPct|0};
const ub={unitId:slotB.unitId,unitData:slotB.unitData,optionParts:slotB.optionParts||[],lbTier:slotB.lbTier|0,unitStatMode:slotB.unitStatMode||'normal',unitCondPassive:!!slotB.unitCondPassive,unitTurnBuffAtk:!!slotB.unitTurnBuffAtk,unitTurnBuffDef:!!slotB.unitTurnBuffDef,exSquadAtkPct:slotB.exSquadAtkPct|0};
slotA.unitId=ub.unitId;slotA.unitData=ub.unitData;slotA.optionParts=ub.optionParts;slotA.lbTier=ub.lbTier;slotA.unitStatMode=ub.unitStatMode;slotA.unitCondPassive=ub.unitCondPassive;slotA.unitTurnBuffAtk=ub.unitTurnBuffAtk;slotA.unitTurnBuffDef=ub.unitTurnBuffDef;slotA.exSquadAtkPct=ub.exSquadAtkPct;
slotB.unitId=ua.unitId;slotB.unitData=ua.unitData;slotB.optionParts=ua.optionParts;slotB.lbTier=ua.lbTier;slotB.unitStatMode=ua.unitStatMode;slotB.unitCondPassive=ua.unitCondPassive;slotB.unitTurnBuffAtk=ua.unitTurnBuffAtk;slotB.unitTurnBuffDef=ua.unitTurnBuffDef;slotB.exSquadAtkPct=ua.exSquadAtkPct;
}else{
const ca={charId:slotA.charId,charData:slotA.charData,charCondPassive:!!slotA.charCondPassive};
const cb={charId:slotB.charId,charData:slotB.charData,charCondPassive:!!slotB.charCondPassive};
slotA.charId=cb.charId;slotA.charData=cb.charData;slotA.charCondPassive=cb.charCondPassive;
slotB.charId=ca.charId;slotB.charData=ca.charData;slotB.charCondPassive=ca.charCondPassive;
}
pend.pendingKey=null;pend.pendingPart=null;tbRenderRearrangeBody();
}
function tbRearrangeTap(key){
if(!S.tb.rearrange)return;
if(!document.getElementById('tbRearrangeLinked').checked)return;
if(S.tb.rearrange.pendingKey==null){S.tb.rearrange.pendingKey=key;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();return}
const a=S.tb.rearrange.pendingKey,b=key;
if(a===b){S.tb.rearrange.pendingKey=null;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();return}
const sa=_tbSideFromKey(a),sb=_tbSideFromKey(b);
if(sa!==sb){S.tb.rearrange.pendingKey=key;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();return}
const squ=S.tb.rearrange.draft[sa];
const ia=_tbIdxFromKey(a),ib=_tbIdxFromKey(b);
const slotA=squ.slots[ia],slotB=squ.slots[ib];
const ta=JSON.parse(JSON.stringify(slotA));const tbj=JSON.parse(JSON.stringify(slotB));Object.keys(slotA).forEach(k=>delete slotA[k]);Object.assign(slotA,tbj);Object.keys(slotB).forEach(k=>delete slotB[k]);Object.assign(slotB,ta);
S.tb.rearrange.pendingKey=null;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();
}
function tbRearrangeCancel(){
S.tb.rearrange=null;
const o=document.getElementById('tbRearrangeOverlay');if(o){o.classList.remove('active');o.setAttribute('aria-hidden','true')}
renderTeamBuilder();
}
function tbRearrangeConfirm(){
if(!S.tb.rearrange)return;
S.tb.squads=JSON.parse(JSON.stringify(S.tb.rearrange.draft));
S.tb.rearrange=null;
const o=document.getElementById('tbRearrangeOverlay');if(o){o.classList.remove('active');o.setAttribute('aria-hidden','true')}
S.tb._leaderApplyCache={};
renderTeamBuilder();
}
function openTbFormationModal(){
tbApplyLangStatic();
tbSyncSquadLabels();
tbRenderFormationPreview();
const list=document.getElementById('tbFormationList');if(!list)return;
const arr=_tbReadFormations();
const fph=escAttr(t('tb_formation_name_placeholder'));
list.innerHTML=arr.map((x,i)=>`<div class="tb-form-row tb-form-row--saved"><span class="tb-form-slot-idx">${i+1}.</span><input type="text" id="tbFormName${i}" maxlength="80" value="${escAttr(x.name)}" placeholder="${fph}" aria-label="${fph}" onblur="_tbPersistFormationSlotName(${i})"><button type="button" class="tb-form-row-action" onclick="tbClearFormationSlot(${i})">${esc(t('tb_clear_formation_slot'))}</button><button type="button" class="tb-form-row-action" onclick="tbSaveFormationSlot(${i})">${esc(t('tb_save'))}</button><button type="button" class="tb-form-row-action" onclick="tbLoadFormationSlot(${i})">${esc(t('tb_load'))}</button></div>`).join('');
const o=document.getElementById('tbFormationOverlay');
if(o){o.classList.add('active');o.setAttribute('aria-hidden','false')}
}
function closeTbFormationModal(){
if(!S._tbSkipFormationCloseSync){
const prev=document.getElementById('tbFormationPreview');
if(prev){
const inps=prev.querySelectorAll('.tb-fpv-name-input');
if(inps[0])tbSyncSquadNameFromFormation(1,inps[0]);
if(inps[1])tbSyncSquadNameFromFormation(2,inps[1]);
}
}
const o=document.getElementById('tbFormationOverlay');if(o){o.classList.remove('active');o.setAttribute('aria-hidden','true')}
}
function _tbPersistFormationSlotName(i){
const arr=_tbReadFormations();
const ni=document.getElementById('tbFormName'+i);
if(!ni||!arr[i])return;
let nm=String(ni.value||'').trim().slice(0,80);
if(!nm)nm=String(arr[i].name||'').trim()||('Formation '+(i+1));
arr[i]=Object.assign({},arr[i],{name:nm});
ni.value=nm;
_tbWriteFormations(arr);
}
function tbClearFormationSlot(i){
const arr=_tbReadFormations();
if(!arr[i])return;
arr[i]=Object.assign({},arr[i],{data:null});
_tbWriteFormations(arr);
openTbFormationModal();
}
function tbSaveFormationSlot(i){
const arr=_tbReadFormations();
const ni=document.getElementById('tbFormName'+i);
arr[i]={name:ni?ni.value.trim().slice(0,80)||arr[i].name:arr[i].name,data:tbSnapshot()};
_tbWriteFormations(arr);openTbFormationModal();
}
async function tbLoadFormationSlot(i){const arr=_tbReadFormations();const x=arr[i];if(x&&x.data){S._tbSkipFormationCloseSync=1;try{await tbApplySnapshot(x.data)}finally{S._tbSkipFormationCloseSync=0}}closeTbFormationModal()}
function _tbCheckUrlParams(){
const p=new URLSearchParams(location.search);
const _t=p.get('tab');
if(_t!=='team_builder'&&_t!=='TB')return;
initTeamBuilder();
const teamRaw=p.get('team');
switchTab('team_builder');
if(teamRaw){
void (async()=>{
try{
const obj=await _tbDecodeTeamShare(teamRaw);
if(!obj)return;
const snap=obj.v===2?_tbExpandSnapshotV2(obj):(obj.v===1?obj:null);
if(snap)await tbApplySnapshot(snap);
}catch(e){console.warn('team share payload',e)}
})();
}
}

const DC_VIGOR_ORDER=['medium','high','max','super'];
function _dcVigorAtLeast(cur,thr){const a=_dcNormMpLevel(cur),b=_dcNormMpLevel(thr);return DC_VIGOR_ORDER.indexOf(a)>=DC_VIGOR_ORDER.indexOf(b)}
/** For vigor-gated unit conditional passives, require at least Max (so Max and Supercharged qualify). If ability text requires Supercharged only, keep that stricter tier. */
function _dcVigorTierMax(a,b){
const na=_dcNormMpLevel(a||'medium'),nb=_dcNormMpLevel(b||'medium');
const ia=DC_VIGOR_ORDER.indexOf(na),ib=DC_VIGOR_ORDER.indexOf(nb);
return ia>=ib?na:nb;
}
function _dcUnitCpVigorRequirement(){
if(!S.dc._vigorCondThreshold)return null;
return _dcVigorTierMax(S.dc._vigorCondThreshold,'max');
}
/** When unit conditional stats are vigor-gated, sync passive from vigor (Max+). Call from setDcMp / unit pick only — not every render — so the toggle can override until vigor changes. */
function _dcSyncUnitCondPassiveFromVigor(){
const ud=S.dc.atkUnitData;
if(!ud||ud._manual||!ud.has_cond_stats||!S.dc._vigorCondThreshold)return;
const req=_dcUnitCpVigorRequirement();
if(!req)return;
S.dc.unitCondPassive=_dcVigorAtLeast(S.dc.mpLevel,req);
}
function _dcDetectVigorCondAbilities(ud){
S.dc._vigorCondThreshold=_dcVigorThresholdFromUnit(ud);
}
function _dcIsVigorCondActive(){
if(!S.dc._vigorCondThreshold)return false;
const req=_dcUnitCpVigorRequirement();
return req?_dcVigorAtLeast(S.dc.mpLevel,req):false;
}
function _dcGetUnitStatKeyForCp(useCondPassive){
const ud=S.dc.atkUnitData;if(!ud)return 'stats_no_cond';
const hasSp=ud.has_sp!==undefined?ud.has_sp:(parseInt(ud.rarity_id||'5')<=4);
const mode=S.dc.unitStatMode||'normal';
const hasCond=!!ud.has_cond_stats;
const passiveOn=!!(hasCond&&useCondPassive);
const sfx=passiveOn?'_with_cond':'_no_cond';
if(mode==='ssp'&&hasSp)return 'ssp_stats'+sfx;
if(mode==='sp'&&hasSp)return 'sp_stats'+sfx;
return 'stats'+sfx;
}
function _dcGetUnitStatKey(){
return _dcGetUnitStatKeyForCp(!!S.dc.unitCondPassive);
}
function _dcCpChipSpanHtml(active){
const ac=active?' active':'';
return`<span class="list-cond-toggle dc-dc-cp-chip${ac}"><span class="cp-word-pad"><span class="cp-wide"><span class="cp-wide-c" aria-hidden="true">C</span><span aria-hidden="true">P</span></span></span></span>`;
}
function _dcCharHasConditional(cd){if(!cd)return false;return cd.has_conditional_passive!=null?cd.has_conditional_passive:!!cd.has_ex_stats}
function _dcGetCharStatsForCp(charCpOn){
const cd=S.dc.atkCharData;if(!cd)return[];
const mode=S.dc.charStatMode||'normal';
const cp=!!(_dcCharHasConditional(cd)&&charCpOn);
const exTiers=cd.ex_supercharged_tiers;
if(cp&&exTiers&&exTiers.length>1){
const ti=Math.min(Math.max(0,S.dc.dcSuperchargedExTier|0),exTiers.length-1);
const row=exTiers[ti]&&exTiers[ti].stats;
if(row&&row.length)return row;
}
if(mode==='sp'&&_dcCharHasSpStats(cd))return cp?cd.sp_stats_with_ex:cd.sp_stats;
return cp?cd.stats_with_ex:cd.stats;
}
function _dcGetCharStats(){
return _dcGetCharStatsForCp(!!S.dc.charCondPassive);
}
function _dcCharExSquadSynergyAbilityBlob(cd){
if(!cd||cd._manual||!Array.isArray(cd.abilities))return'';
let out='';
for(const ab of cd.abilities){
const r=_dcResolveCharAbilityForMode(ab);
if(!r)continue;
out+=String(r.name||'')+'\n';
const det=r.details||[];
for(let i=0;i<det.length;i++)out+=String((det[i]&&det[i].text)||'')+'\n';
if(r.desc)out+=String(r.desc)+'\n';
}
return out;
}
function _dcCharHasExSquadSynergyAbility(cd,udOpt){
const blob=_dcCharExSquadSynergyAbilityBlob(cd);
if(!blob)return false;
if(!/\bsquad\b/i.test(blob)&&!/同部隊/i.test(blob))return false;
const ud=udOpt!==undefined?udOpt:S.dc.atkUnitData;
if(ud&&!ud._manual){
const b=_scFindSquadConditionBinding(cd,ud);
if(b&&!_scIsQubeleyExCombo(cd,ud))return false;
}
return/\bIncrease ATK by \d+%/i.test(blob)||/攻撃力が\d+%上昇/.test(blob)||/自身攻擊力提升\d+%/.test(blob);
}
function _dcCharShouldShowSquadCondUi(cd,ud){
if(!cd||cd._manual||!ud||ud._manual)return false;
if(_scIsQubeleyExCombo(cd,ud))return false;
const b=_scFindSquadConditionBinding(cd,ud);
if(!b)return false;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(ud,cd,b.pilotGroups))return false;
return true;
}
function _dcSquadRecvGroupMet(ud,cd,rg){
if(!rg)return true;
const conds=rg.conditions||[];
if(!conds.length)return true;
return _dcAbilityCondContextMeetsGroups(ud,cd,[rg]);
}
/** Phenex unique squad flat ATK+DEF (see PHENEX_* constants); null if this pair is not that binding. */
function _dcPhenexUniqueSquadFlatAdBinding(cd,ud){
const b=_scFindSquadConditionBinding(cd,ud);
if(!b||b.kind!=='flat_ad'||b.flatPerUnit)return null;
if(!ud||ud._manual||String(ud.id)!==PHENEX_STACK_UNIT_ID)return null;
return b;
}
function _dcSquadFlatAdSingleBinding(cd,ud){
const b=_scFindSquadConditionBinding(cd,ud);
return b&&b.kind==='flat_ad'&&!b.flatPerUnit?b:null;
}
function _dcSlotShouldPackSquadCond(sl){
if(!sl||!sl.atkUnit||!sl.atkChar||sl.atkUnit==='__manual__'||sl.atkChar==='__manual__')return false;
return!!(sl.atkCharData&&!sl.atkCharData._manual&&sl.atkUnitData&&!sl.atkUnitData._manual);
}
function _dcSquadCondInputCap(cd,ud){
const b=_scFindSquadConditionBinding(cd,ud);
if(!b)return 0;
if(_dcPhenexUniqueSquadFlatAdBinding(cd,ud))return PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT;
return(b.inputCap!=null?b.inputCap:(b.kind==='flat_ad'?b.flatPct:b.max))|0;
}
function _dcDcCountUnitsMatchingCountGroup(cg){
if(!cg||!((cg.conditions||[]).length))return 0;
if(typeof S==='undefined'||!S.dc||!S.dc.atkSlots)return 0;
let n=0;
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=S.dc.atkSlots[i];
const u2=sl&&sl.unitData;
if(!u2||u2._manual)continue;
if(_dcConditionGroupMatches(u2,null,cg))n++;
}
return n;
}
function _dcDefaultSquadCondPctForCdUd(cd,ud){
if(!_dcCharShouldShowSquadCondUi(cd,ud))return 0;
const b=_scFindSquadConditionBinding(cd,ud);
if(b&&b.kind==='stack_atk'&&b.countGroup){
return Math.min(b.max|0,(b.perUnit|0)*_dcDcCountUnitsMatchingCountGroup(b.countGroup));
}
if(b&&b.kind==='flat_ad'){
const rg=b.recvGroup;
if(rg&&!_dcSquadRecvGroupMet(ud,cd,rg))return 0;
}
const phen=_dcPhenexUniqueSquadFlatAdBinding(cd,ud);
if(phen)return phen.flatPct|0;
return _dcSquadCondInputCap(cd,ud);
}
function _dcSyncSquadCondEffectiveFromState(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
S.dc.squadCondAtkPct=0;
S.dc.squadCondDefPct=0;
if(!ud||ud._manual||!cd||cd._manual||_scIsQubeleyExCombo(cd,ud))return;
const raw=Math.max(0,S.dc.squadCondPct|0);
const b=_scFindSquadConditionBinding(cd,ud);
if(b){
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(ud,cd,b.pilotGroups))return;
if(b.kind==='flat_ad'){
const rg=b.recvGroup;
if(rg&&!_dcSquadRecvGroupMet(ud,cd,rg))return;
}
if(b.kind==='stack_atk'&&b.countGroup){
const n=_dcDcCountUnitsMatchingCountGroup(b.countGroup);
const auto=Math.min(b.max|0,(b.perUnit|0)*n);
S.dc.squadCondAtkPct=auto;
S.dc.squadCondDefPct=0;
return;
}
const cap=_dcSquadCondInputCap(cd,ud);
const v=Math.min(Math.max(0,cap),raw);
if(b.kind==='flat_ad'){
if(b.flatPerUnit){const per=b.flatPct|0;const eff=per*v;S.dc.squadCondAtkPct=eff;S.dc.squadCondDefPct=eff}
else{S.dc.squadCondAtkPct=v;S.dc.squadCondDefPct=v}
}else{S.dc.squadCondAtkPct=v;S.dc.squadCondDefPct=0}
return;
}
const v=Math.min(100,raw);
S.dc.squadCondAtkPct=v;
S.dc.squadCondDefPct=0;
}
function _dcDefNpcMapBonusesEnabled(){return S.dc.defNpcMapBonusesOn!==false;}
/** Map NPC unit: full MS stats for damage panel — on = stage totals; off = exclude other NPCs' squad-wide % only (server snapshots). */
function _dcDefNpcUnitMapStatsPair(u){
const onS=u&&u.stats_raw||{},onB=u&&u.bonus_amounts||{};
const offS=u&&u.stats_raw_npc_squad_allies_off,offB=u&&u.bonus_amounts_npc_squad_allies_off;
const hasOff=offS&&offB&&typeof offS==='object'&&typeof offB==='object';
if(_dcDefNpcMapBonusesEnabled()||!hasOff)return{stats:onS,bonuses:onB};
return{stats:offS,bonuses:offB};
}
function _dcUpdateAtkSquadBuffSectionVisibility(){
const sec=document.getElementById('dcAtkSquadBuffSection');
const lbl=document.getElementById('dcAtkSquadBuffSectionLbl');
if(!sec)return;
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData;
const show=!!(ud&&cd&&!ud._manual&&!cd._manual);
sec.style.display=show?'':'none';
if(lbl)lbl.textContent=t('dc_squad_buff_section');
}
function _dcUpdateDefNpcMapBonusesToggleUi(){
const tw=document.getElementById('dcDefNpcMapBonusesWrap');
const cb=document.getElementById('dcDefNpcMapBonusesOn');
const n=S.dc.defNpc;
const u=n&&n.unit,c=n&&n.character;
const show=!!(u&&!n._manual&&!u._manual&&(!c||!c._manual));
if(tw)tw.style.display=show?'':'none';
if(cb)cb.checked=S.dc.defNpcMapBonusesOn!==false;
const lb=document.getElementById('dcDefNpcMapBonusesLbl');
if(lb){lb.textContent=t('dc_def_npc_squad_buff');lb.title=t('dc_def_npc_squad_buff_tip')}
}
function _dcUpdateSquadConditionGroupVisibility(){
_dcUpdateAtkSquadBuffSectionVisibility();
const wrap=document.getElementById('dcSquadCondWrap');
const inp=document.getElementById('dcSquadCondPct');
const tip=document.getElementById('dcSquadCondTip');
const rg=document.getElementById('dcSquadCondRange');
const flatW=document.getElementById('dcSquadCondFlatAdWrap');
const flatLb=document.getElementById('dcSquadCondFlatAdLbl');
const flatCb=document.getElementById('dcSquadCondFlatAdApply');
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
if(!wrap||!inp){return}
const showPair=!!(ud&&cd&&!ud._manual&&!cd._manual);
if(!showPair){
wrap.style.display='none';
if(flatW)flatW.style.display='none';
if(tip)tip.textContent=t('dc_squad_cond_label');
return;
}
wrap.style.removeProperty('display');
const qual=_dcCharShouldShowSquadCondUi(cd,ud);
if(qual){
const cap=_dcSquadCondInputCap(cd,ud);
if(tip){tip.textContent=t('dc_squad_cond_label');tip.title=t('dc_squad_cond_tip')}
if(rg)rg.textContent='(0–'+cap+')';
inp.min='0';
inp.max=String(Math.max(0,cap));
const cur=Math.min(Math.max(0,cap),Math.max(0,S.dc.squadCondPct|0));
if(String(inp.value)!==String(cur))inp.value=String(cur);
}else{
if(tip){tip.textContent=t('dc_squad_cond_label');tip.title=t('dc_squad_cond_manual_tip')}
if(rg)rg.textContent='(0–100)';
inp.min='0';
inp.max='100';
const v=S.dc.squadCondPct|0;
const disp=v>0?String(v):'';
if(String(inp.value)!==disp)inp.value=disp;
}
if(flatW&&flatLb&&flatCb){
const bf=qual?_dcSquadFlatAdSingleBinding(cd,ud):null;
flatW.style.display=bf?'':'none';
if(bf){flatLb.textContent=t('dc_squad_cond_flat_ad_chk').replace('%n',String(bf.flatPct|0));flatLb.title=t('dc_squad_cond_flat_ad_tip');flatCb.checked=(S.dc.squadCondPct|0)>0}
}else if(flatW)flatW.style.display='none';
_dcUpdateDefNpcMapBonusesToggleUi();
}
function _dcEffectiveExSquadAtkPct(){return _dcEffectiveExSquadAtkPctFromCtx(S.dc);}
function _dcEffectiveExSquadAtkPctFromCtx(ctx){
const c=ctx||{};
if(!_dcCharHasExSquadSynergyAbility(c.atkCharData,c.atkUnitData))return 0;
const el=typeof document!=='undefined'?document.getElementById('dcExSquadAtkPct'):null;
if(!el){
if(c.exSquadAtkPctExplicitZero)return 0;
return _scIsQubeleyExCombo(c.atkCharData,c.atkUnitData)?20:Math.min(20,Math.max(0,c.exSquadAtkPct|0));
}
const rawStr=String(el.value).trim();
if(rawStr==='0')return 0;
if(rawStr!==''){
const raw=parseInt(rawStr,10);
return Number.isFinite(raw)?Math.min(20,Math.max(0,raw)):0;
}
return _scIsQubeleyExCombo(c.atkCharData,c.atkUnitData)?20:Math.min(20,Math.max(0,c.exSquadAtkPct|0));
}
function _dcUpdateExSquadAtkGroupVisibility(){
const wrap=document.getElementById('dcExSquadAtkWrap');
if(!wrap)return;
const inp=document.getElementById('dcExSquadAtkPct');
const cd=S.dc.atkCharData;
const ud=S.dc.atkUnitData;
const show=!!(cd&&!cd._manual&&_dcCharHasExSquadSynergyAbility(cd,ud));
if(show){
wrap.style.removeProperty('display');
if(inp){
const t=String(inp.value).trim();
if(t===''&&_scIsQubeleyExCombo(cd,ud)){inp.value='20';S.dc.exSquadAtkPct=20;S.dc.exSquadAtkPctExplicitZero=false}
}
}else{
wrap.style.display='none';
S.dc.exSquadAtkPct=0;
S.dc.exSquadAtkPctExplicitZero=false;
if(inp)inp.value='';
}
}
async function dcSwapAtkTransformUnit(){
const u=S.dc.atkUnitData;
if(!u||u._manual||!u.transform_partner_id)return;
const pid=String(u.transform_partner_id);
try{
const r=await fetch(`/api/unit/${encodeURIComponent(pid)}?lang=${S.lang}`);
const d=await r.json();
if(d.error)return;
S.dc.atkUnit=pid;
S.dc.atkUnitData=d;
const _bw=_dcPickBestWeaponIndices(d);
S.dc.wpnIdx=_bw.wpnIdx;
S.dc.wpnLv=_bw.wpnLv;
_dcDetectVigorCondAbilities(d);
if(_dcCharShouldShowSquadCondUi(S.dc.atkCharData,S.dc.atkUnitData))S.dc.squadCondPct=_dcDefaultSquadCondPctForCdUd(S.dc.atkCharData,S.dc.atkUnitData);
else S.dc.squadCondPct=0;
S.dc.optionParts=[];S.dc.supporters=[];
renderDcAtkUnit();
renderDcAtkChar();
renderDcWeaponArea();
renderDcOptionParts();
renderDcSupporters();
_dcUpdateAdvantageEnemyTagUi();
onDcParamChange();
S.dc._dcAutoFitGen=(S.dc._dcAutoFitGen|0)+1;
const _dcAfGenTf=S.dc._dcAutoFitGen;
void dcAutoFitOptionPartAndSupporter(_dcAfGenTf).then(()=>{
if(_dcAfGenTf!==(S.dc._dcAutoFitGen|0))return;
renderDcAtkUnit();
if(S.dc.atkCharData)renderDcAtkChar();
renderDcOptionParts();
renderDcSupporters();
_dcSnapActiveAttackerToSlot();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
else onDcParamChange();
});
}catch(_){}
}
function renderDcAtkUnit(){
const area=document.getElementById('dcAtkUnitArea');
const ud=S.dc.atkUnitData;
if(!ud){area.innerHTML=`<button class="dc-pick-btn" onclick="openDcPicker('unit')">${t('dc_pick_unit')}</button>`;document.getElementById('dcAtkStatsArea').innerHTML='';document.getElementById('dcAtkWpnArea').innerHTML='';S.dc._wpnCritDmgUp=0;S.dc._wpnTraits={};S.dc._vigorCondThreshold=null;_dcUpdateAdvantageEnemyTagUi();_dcUpdateExSquadAtkGroupVisibility();_dcUpdateSquadConditionGroupVisibility();_dcUpdateSupportCounterAtkUi();return}
if(ud._manual){
area.innerHTML=`<div class="dc-picked dc-picked--manual"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ud.name)}</div><div style="font-size:10px;color:var(--text-muted)">Custom unit</div></div></div>`;
document.getElementById('dcAtkStatsArea').innerHTML='';
renderDcWeaponArea();
_dcUpdateAdvantageEnemyTagUi();
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcUpdateSupportCounterAtkUi();
return;
}
_dcDetectVigorCondAbilities(ud);
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(S.dc.lbTier,maxTier);
const statKey=_dcGetUnitStatKey();
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const thum=ud.thum||ud.portrait||'';
let lbBlock='';
if(lb&&lb.length>1&&!ud.is_ultimate){
const cur=cmpLbPipsAtTier(tier);
let lbMenu='';
for(let tt=0;tt<=maxTier;tt++){
const p=cmpLbPipsAtTier(tt);
lbMenu+=`<button type="button" class="cmp-lb-opt${tt===tier?' is-active':''}" onclick="setDcLbTier(${tt});var _dlb=document.getElementById('dcLbTierDetails');if(_dlb)_dlb.open=false" role="option" aria-selected="${tt===tier}">${cmpLbPipsRow(p[0],p[1],p[2])}</button>`;
}
lbBlock=`<div class="dc-lb-inline-wrap"><details id="dcLbTierDetails" class="cmp-lb-details dc-lb-tier-details"><summary class="cmp-lb-summary" title="${esc(t('cmp_lb'))}">${cmpLbPipsRow(cur[0],cur[1],cur[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${esc(t('cmp_lb'))}">${lbMenu}</div></details></div>`;
}
let unitCpToggle='';
if(ud.has_cond_stats){
const vGated=!!S.dc._vigorCondThreshold;
const vHint=vGated?` title="${escAttr('Default: on when Vigor is Max or Supercharged (or higher than text if ability requires Supercharged only). Changing vigor updates the default; you can still toggle for comparisons.')}"`:'';
{const _cpL=t('conditional_passive');unitCpToggle=`<div class="dc-picked-controls"${vHint}><div class="conditional-toggle dc-dc-cond-toggle"><div class="toggle-clickable${S.dc.unitCondPassive?' active':''}" role="button" tabindex="0" title="${escAttr(_cpL)}" aria-label="${escAttr(_cpL)}" onclick="toggleDcUnitCondPassive()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDcUnitCondPassive()}"><span class="toggle-label toggle-label--cp-chip">${_dcCpChipSpanHtml(!!S.dc.unitCondPassive)}</span></div></div></div>`;}
}
const hasSp=ud.has_sp!==undefined?ud.has_sp:(parseInt(ud.rarity_id||'5')<=4);
let unitStatModeHtml='';
const uModeRow=S.dc.unitStatMode||'normal';
const spModeBtns=hasSp?`<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center"><button type="button" class="dc-lb-btn${uModeRow==='normal'?' active':''}" onclick="setDcUnitStatMode('normal')">Normal</button><button type="button" class="dc-lb-btn${uModeRow==='sp'?' active':''}" onclick="setDcUnitStatMode('sp')">SP</button><button type="button" class="dc-lb-btn${uModeRow==='ssp'?' active':''}" onclick="setDcUnitStatMode('ssp')">SSP</button></div>`:'';
const tfBtn=ud.transform_partner_id?`<button type="button" class="sp-toggle-btn${ud.is_transform_alternate?' active':''}" title="${escAttr(t('unit_transform_title'))}" aria-label="${escAttr(t('unit_transform_title'))}" onclick="dcSwapAtkTransformUnit()"><img src="${imgUrl('/static/images/UI/UI_Common_BattleIcon_Transform.webp')}" alt="" loading="lazy" onerror="this.style.display='none'"></button>`:'';
if(spModeBtns||tfBtn){
unitStatModeHtml=`<div class="dc-lb-row dc-unit-stat-mode-row" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">${spModeBtns||''}${tfBtn||''}</div>`;
}
const lbStatCluster=(lbBlock||unitStatModeHtml)?`<div class="dc-unit-lb-stat-cluster">${lbBlock}${unitStatModeHtml}</div>`:'';
const atkBelowPortrait=(unitCpToggle||lbStatCluster)?`<div class="dc-atk-unit-below-portrait">${unitCpToggle}${lbStatCluster}</div>`:'';
area.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(thum)}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ud.name)}</div><div class="dc-picked-badges">${ud.rarity_icon?`<img src="${imgUrl(ud.rarity_icon)}">`:''}${ud.role_icon?`<img src="${imgUrl(ud.role_icon)}">`:''}</div></div>${atkBelowPortrait}<button type="button" class="dc-picked-change" onclick="openDcPicker('unit')">${t('dc_change')}</button></div>`;
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcSyncSquadCondEffectiveFromState();
const sa=document.getElementById('dcAtkStatsArea');
const uEff=_dcGetModifiedAttackerUnitStats(stats);
const msEnh=_dcMsStatEnhancementLinesHtml(S.dc,stats);
const atkS=uEff.unitAtk,defS=uEff.unitDefVal,mobS=uEff.unitMob,hpS=uEff.unitHp;
const uMode=S.dc.unitStatMode||'normal';
const uCp=!!(ud.has_cond_stats&&S.dc.unitCondPassive);
let statsNoCp=stats;
if(ud.has_cond_stats&&td){
const kn=_dcGetUnitStatKeyForCp(false);
statsNoCp=td[kn]||stats;
}
function _uCpCell(nm){if(!uCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?' dc-stat-mini--cp':' dc-stat-mini--cp-penalty'}
function _uCpValBuff(nm){if(!uCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?'dc-stat-val--buffed':'dc-stat-val--penalized'}
function _uCpBonusHtml(nm){if(!uCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);const d=b-a;if(d===0)return'';const tipUp='Conditional passive — extra growth stat vs off (LB row; main number may include modifiers).';const tipDn='Conditional passive — stat change vs off (LB row; main number may include modifiers).';if(d>0)return`<div class="stat-card-bonus" style="margin-top:2px" title="${escAttr(tipUp)}">(+${fmtN(d)})</div>`;return`<div class="stat-card-bonus stat-card-penalty" style="margin-top:2px" title="${escAttr(tipDn)}">(${fmtN(d)})</div>`}
const hHp=_uCpValBuff('HP'),hAtk=_uCpValBuff('Attack'),hDef=_uCpValBuff('Defense'),hMob=_uCpValBuff('Mobility');
const sheetBuffOn=!!S.dc.masterLeagueBuff||!!S.dc.grandOffensiveBuff;
function _dcUnitMiniStatCls(cp){const pen=cp==='dc-stat-val--penalized';if(cp&&sheetBuffOn&&!pen)return` class="${cp} dc-stat-val--buffed"`;if(cp)return` class="${cp}"`;if(sheetBuffOn)return` class="dc-stat-val--buffed"`;return''}
const spHp=_dcUnitMiniStatCls(hHp),spAtk=hAtk?` class="${hAtk}"`:'',spMob=_dcUnitMiniStatCls(hMob);
const exSq=_dcEffectiveExSquadAtkPct();
const utb=_dcGetDetectedUnitTurnBuffPercents(ud);
let defShow=defS;
const pr=_dcPilotPairUnitAtkDefPct(atkS,defShow);
const atkAfterPair=pr.unitAtk;
defShow=pr.unitDefVal;
const advAtkPct=_dcAdvantageTagAtkPctFromAbilities(ud,S.dc.defNpc);
const atkAfterCounter=_dcApplyCounterOwnAtkToUnitAtk(atkAfterPair);
const atkAfterSupCnt=_dcApplySupportCounterAtkToUnitAtk(atkAfterCounter);
const advGrAtk=uEff.advantageFlatGrowthAtk|0;
const advGrDef=uEff.advantageFlatGrowthDef|0;
const atkShowPreTurn=_dcApplyAdvantageTagAtkToUnitAtk(atkAfterSupCnt,advAtkPct,advGrAtk);
const atkShow=atkShowPreTurn;
const advAtkFlat=(advAtkPct|0)>0?Math.floor(Math.max(0,advGrAtk)*(advAtkPct|0)/100):0;
const advDefFlat=(advAtkPct|0)>0?Math.floor(Math.max(0,advGrDef)*(advAtkPct|0)/100):0;
const defShowAdv=_dcApplyUnitTurnBuffDefToMsDef(defShow+advDefFlat,ud);
const unitTurnAtkOn=S.dc.unitTurnBuffAtk&&(utb.atkPct|0)>0;
const unitTurnDefOn=S.dc.unitTurnBuffDef&&(utb.defPct|0)>0;
const pairActive=(atkAfterPair!==atkS||defShow!==defS);
const counterActive=(atkAfterCounter!==atkAfterPair);
const supCntActive=(atkAfterSupCnt!==atkAfterCounter);
const advantageTagActive=(advAtkPct|0)>0&&S.dc.applyAdvantageEnemyTag!==false;
const leaderAtkActive=(uEff.leaderPct|0)>0;
const dEx=uEff.deltaExAtk|0;
const atkExSub=exSq>0?`<div id="dcAtkUnitAtkExSub" class="stat-card-bonus" title="EX squad % delta within the same % bucket as the panel (panel uses floor; damage ⑧ may use ceil on MS ATK).">+${fmtN(dEx)} · EX squad +${exSq}%</div>`:`<div id="dcAtkUnitAtkExSub" style="display:none" aria-hidden="true"></div>`;
const atkSpanClass=hAtk==='dc-stat-val--penalized'?'dc-stat-val--penalized':((exSq>0||hAtk||leaderAtkActive||pairActive||counterActive||supCntActive||advantageTagActive||unitTurnAtkOn||sheetBuffOn)?'dc-stat-val--buffed':'');
let atkMainTitle=exSq>0?(counterActive?'Includes EX squad ATK % and own ATK when countering (unit)':'Includes EX squad ATK %'):(counterActive?'Includes own ATK when countering (unit)':'');
if(supCntActive){atkMainTitle=(atkMainTitle?atkMainTitle+'; ':'')+'Support Attack/Counter +% MS ATK (pilot)'}
const atkAdvTitle=advantageTagActive?` (+${advAtkFlat} MS Attack: ${advAtkPct}% of raw LB Attack base; flat add, not +${advAtkPct}% on total MS ATK)`:'';
const atkBonusInline=Math.max(0,atkShow-(uEff.atkDbCorePassive|0));
const atkInlineBonusHtml=`<span id="dcAtkUnitAtkInlineBonus" class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">${atkBonusInline>0?`(+${fmtN(atkBonusInline)})`:''}</span>`;
const atkMainSpan=`<span id="dcAtkUnitAtkMain"${atkSpanClass?` class="${atkSpanClass}"`:''}${!atkSpanClass&&spAtk?spAtk:''}${(atkMainTitle||atkAdvTitle)?` title="${escAttr((atkMainTitle||'')+atkAdvTitle)}"`:''}>${fmtN(atkShow)}</span>${atkInlineBonusHtml}`;
const hpBonusIn=Math.max(0,hpS-(uEff.hpDbCorePassive|0));
const hpInlineBonus=hpBonusIn>0?`<span class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">(+${fmtN(hpBonusIn)})</span>`:'';
const defBonusIn=Math.max(0,defShowAdv-(uEff.defDbCorePassive|0));
const defInlineBonus=defBonusIn>0?`<span class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">(+${fmtN(defBonusIn)})</span>`:'';
const mobBonusIn=Math.max(0,mobS-(uEff.mobDbCorePassive|0));
const mobInlineBonus=mobBonusIn>0?`<span class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">(+${fmtN(mobBonusIn)})</span>`:'';
const defPairBuff=defShow!==defS;
const spDefCls=hDef==='dc-stat-val--penalized'?'dc-stat-val--penalized':((hDef||defPairBuff||advDefFlat>0||unitTurnDefOn||sheetBuffOn)?'dc-stat-val--buffed':'');
const spDefFinal=spDefCls?` class="${spDefCls}"`:'';
const pairNote=(S.dc.atkCharData&&S.dc.atkCharData.pair_unit_stat_mod&&S.dc.atkCharData.pair_unit_stat_mod[String(ud.id)]&&S.dc.charCondPassive)?'<div style="font-size:10px;color:var(--accent-cyan);margin-top:4px;line-height:1.35">EX ability: ATK/DEF bonus to this unit when the EX ability toggle is on.</div>':'';
const cPct=_dcGetCounterOwnAtkPct();
const counterNote=(cPct>0)?'<div style="font-size:10px;color:var(--accent-cyan);margin-top:4px;line-height:1.35">EX ability: +'+cPct+'% MS Attack when countering (see Own ATK when countering below).</div>':'';
const unitModNote=pairNote+counterNote;
const vigorCondNote=_dcIsVigorCondActive()?'<div style="margin-top:4px;padding:4px 8px;background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.28);border-radius:4px;font-size:11px;color:#eab308">Vigor condition met — see unit abilities for in-battle effects.</div>':'';
let unitTurnBuffHtml='';
if((utb.atkPct|0)>0||(utb.defPct|0)>0){
unitTurnBuffHtml=`<div class="dc-section-label" style="margin-top:10px;color:var(--accent-cyan)">Unit skill (1 turn)</div><div style="font-size:12px;line-height:1.6">`;
if((utb.atkPct|0)>0)unitTurnBuffHtml+=`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px"><input type="checkbox" ${S.dc.unitTurnBuffAtk?'checked':''} onchange="setDcUnitTurnBuffAtk(this.checked)"><span>MS ATK +${utb.atkPct}% (1 turn)</span></label>`;
if((utb.defPct|0)>0)unitTurnBuffHtml+=`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px"><input type="checkbox" ${S.dc.unitTurnBuffDef?'checked':''} onchange="setDcUnitTurnBuffDef(this.checked)"><span>MS DEF +${utb.defPct}% (1 turn)</span></label>`;
unitTurnBuffHtml+=`<div style="font-size:10px;color:var(--text-muted);margin-top:4px;line-height:1.35">Detected from this unit’s skill descriptions. MS ATK +% (1 turn) stacks in the same % bucket as other MS Attack lines; the panel uses <strong>floor</strong> on that bucket to match the database, while damage ⑧ may use <strong>ceil</strong> on MS ATK. MS DEF toggle updates the panel only (damage uses the <strong>defender</strong>’s MS DEF).</div></div>`;
}
const uGridBase=`stats-grid dc-atk-ers dc-stat-visual--${uMode} dc-stat-grid-4`;
const uGridCls=sheetBuffOn?`${uGridBase} dc-stats-mini--ml-buff`:uGridBase;
sa.innerHTML=`<div class="dc-section-label">${t('dc_unit_stats')}</div><div class="${uGridCls}"><div class="stat-card${_uCpCell('HP')}"><div class="stat-card-label">HP</div><div class="stat-card-value"><span${spHp}>${fmtN(hpS)}</span>${hpInlineBonus}${_uCpBonusHtml('HP')}${msEnh.hpHtml}</div></div><div class="stat-card${_uCpCell('Attack')}"><div class="stat-card-label">${t('col_atk')}</div><div class="stat-card-value">${atkMainSpan}${_uCpBonusHtml('Attack')}${msEnh.atkHtml}${atkExSub}</div></div><div class="stat-card${_uCpCell('Defense')}"><div class="stat-card-label">${t('col_def')}</div><div class="stat-card-value"><span${spDefFinal}>${fmtN(defShowAdv)}</span>${defInlineBonus}${_uCpBonusHtml('Defense')}${msEnh.defHtml}</div></div><div class="stat-card${_uCpCell('Mobility')}"><div class="stat-card-label">${t('col_mob')}</div><div class="stat-card-value"><span${spMob}>${fmtN(mobS)}</span>${mobInlineBonus}${_uCpBonusHtml('Mobility')}${msEnh.mobHtml}</div></div></div>${unitModNote}${vigorCondNote}${unitTurnBuffHtml}`;
renderDcWeaponArea();
_dcUpdateAdvantageEnemyTagUi();
_dcUpdateSupportCounterAtkUi();
}
function _dcRefreshDcUnitAtkExOnly(){
const main=document.getElementById('dcAtkUnitAtkMain');
const sub=document.getElementById('dcAtkUnitAtkExSub');
if(!main||!sub)return;
const ud=S.dc.atkUnitData;if(!ud||ud._manual)return;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(S.dc.lbTier,maxTier);
const statKey=_dcGetUnitStatKey();
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const uEff=_dcGetModifiedAttackerUnitStats(stats);
const atkS=uEff.unitAtk;
const exSq=_dcEffectiveExSquadAtkPct();
const atkAfterPair=_dcPilotPairUnitAtkDefPct(atkS,uEff.unitDefVal).unitAtk;
const advAtkPct=_dcAdvantageTagAtkPctFromAbilities(ud,S.dc.defNpc);
const advGrAtk=uEff.advantageFlatGrowthAtk|0;
const atkMid=_dcApplyAdvantageTagAtkToUnitAtk(_dcApplySupportCounterAtkToUnitAtk(_dcApplyCounterOwnAtkToUnitAtk(atkAfterPair)),advAtkPct,advGrAtk);
const atkDisp=atkMid;
const atkBonusRe=Math.max(0,atkDisp-(uEff.atkDbCorePassive|0));
const bonusEl=document.getElementById('dcAtkUnitAtkInlineBonus');
if(bonusEl)bonusEl.textContent=atkBonusRe>0?`(+${fmtN(atkBonusRe)})`:'';
const uCp=!!(ud.has_cond_stats&&S.dc.unitCondPassive);
let statsNoCp=stats;
if(ud.has_cond_stats&&td){
const kn=_dcGetUnitStatKeyForCp(false);
statsNoCp=td[kn]||stats;
}
const a=Math.round(_dcFindStat(statsNoCp,'Attack')||0),b=Math.round(_dcFindStat(stats,'Attack')||0);
const cpAtkNeg=uCp&&b<a;
main.textContent=fmtN(atkDisp);
const cPct=_dcGetCounterOwnAtkPct();
if(exSq>0){
sub.style.display='';
sub.removeAttribute('aria-hidden');
sub.className='stat-card-bonus';
sub.title='floor(base×(100+passive%+OP%+turn%+leader%+EX%+ML)/100): delta from EX% in that sum.';
sub.textContent=`+${fmtN(uEff.deltaExAtk|0)} · EX squad +${exSq}%`;
main.classList.remove('dc-stat-val--penalized');
main.classList.add('dc-stat-val--buffed');
main.title=cPct>0?'Includes EX squad ATK % and own ATK when countering (unit)':'Includes EX squad ATK %';
}else if(cPct>0){
sub.style.display='';
sub.removeAttribute('aria-hidden');
sub.className='stat-card-bonus';
sub.title='EX ability: MS Attack when countering';
sub.textContent=`+${fmtN(atkMid-atkAfterPair)} · counter +${cPct}%`;
main.classList.remove('dc-stat-val--penalized');
main.classList.add('dc-stat-val--buffed');
main.title='Includes own ATK when countering (unit)';
}else{
sub.style.display='none';
sub.setAttribute('aria-hidden','true');
sub.textContent='';
main.removeAttribute('title');
const atkAfterCounter=_dcApplyCounterOwnAtkToUnitAtk(atkAfterPair);
const atkAfterSup=_dcApplySupportCounterAtkToUnitAtk(atkAfterCounter);
const utb=_dcGetDetectedUnitTurnBuffPercents(ud);
const unitTurnAtkOn=!!(S.dc.unitTurnBuffAtk&&(utb.atkPct|0)>0);
const leaderOn=(uEff.leaderPct|0)>0;
const pairOn=atkAfterPair!==atkS;
const counterOn=atkAfterCounter!==atkAfterPair;
const supOn=atkAfterSup!==atkAfterCounter;
const advOn=(advAtkPct|0)>0&&S.dc.applyAdvantageEnemyTag!==false&&atkMid!==atkAfterSup;
const sheetBuffMlGo=!!S.dc.masterLeagueBuff||!!S.dc.grandOffensiveBuff;
const otherBuff=sheetBuffMlGo||leaderOn||pairOn||counterOn||supOn||advOn||unitTurnAtkOn;
const cpAtkPos=uCp&&b>a;
const keepBuff=otherBuff||cpAtkPos;
if(cpAtkNeg){
main.classList.add('dc-stat-val--penalized');
main.classList.remove('dc-stat-val--buffed');
}else if(keepBuff){
main.classList.add('dc-stat-val--buffed');
main.classList.remove('dc-stat-val--penalized');
}else{
main.classList.remove('dc-stat-val--buffed');
main.classList.remove('dc-stat-val--penalized');
}
}
}
function setDcUnitStatMode(mode){S.dc.unitStatMode=mode;if(S.dc.atkUnitData&&!S.dc.atkUnitData._manual){const b=_dcPickBestWeaponIndices(S.dc.atkUnitData);S.dc.wpnIdx=b.wpnIdx;S.dc.wpnLv=b.wpnLv}renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcCharStatMode(mode){
S.dc.charStatMode=mode;
if(S.dc.atkCharData&&S.dc.atkCharData.skills&&!S.dc.atkCharData._manual){
const vis=_dcPilotSkillsVisibleForDc(S.dc.atkCharData)||[];
const visIds=new Set(vis.map(s=>String(s.id)));
if(S.dc._activeSkills)Object.keys(S.dc._activeSkills).forEach(k=>{if(!visIds.has(k))delete S.dc._activeSkills[k]});
}
renderDcAtkUnit();renderDcAtkChar();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);else onDcParamChange();
}
function setDcUnitCondPassive(on){S.dc.unitCondPassive=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcUnitTurnBuffAtk(on){S.dc.unitTurnBuffAtk=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcUnitTurnBuffDef(on){S.dc.unitTurnBuffDef=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function _dcHtmlSheetBuffToggles(){
const ml=!!S.dc.masterLeagueBuff,go=!!S.dc.grandOffensiveBuff;
const kdMl='if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleDcMasterLeagueBuff();}';
const kdGo='if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleDcGrandOffensiveBuff();}';
return`<div class="dc-sheet-buff-wrap" style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
<div class="conditional-toggle dc-dc-cond-toggle" style="font-size:12px;font-weight:500"><div class="toggle-clickable${ml?' active':''}" role="button" tabindex="0" onclick="toggleDcMasterLeagueBuff()" onkeydown="${kdMl}"><span class="toggle-switch"></span><span class="toggle-label">${esc(t('dc_toggle_master_league'))}</span></div></div>
<div class="conditional-toggle dc-dc-cond-toggle" style="font-size:12px;font-weight:500"><div class="toggle-clickable${go?' active':''}" role="button" tabindex="0" onclick="toggleDcGrandOffensiveBuff()" onkeydown="${kdGo}"><span class="toggle-switch"></span><span class="toggle-label">${esc(t('dc_toggle_grand_offensive'))}</span></div></div>
<div style="font-size:10px;color:var(--text-muted);line-height:1.35">${esc(t('dc_sheet_buff_hint'))}</div>
</div>`;
}
function setDcMasterLeagueBuff(on){S.dc.masterLeagueBuff=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcGrandOffensiveBuff(on){S.dc.grandOffensiveBuff=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function toggleDcMasterLeagueBuff(){setDcMasterLeagueBuff(!S.dc.masterLeagueBuff)}
function toggleDcGrandOffensiveBuff(){setDcGrandOffensiveBuff(!S.dc.grandOffensiveBuff)}
function setDcCharCondPassive(on){S.dc.charCondPassive=!!on;if(!on)S.dc.dcSuperchargedExTier=0;renderDcAtkUnit();renderDcAtkChar();if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);const autoV=S.dc.atkCharData&&_dcShouldAutoSuperchargedVigorOnCharCp(S.dc.atkCharData);if(on&&autoV)setDcMp('super');else if(!on&&autoV)_dcAutoSetVigor();else onDcParamChange()}
function setDcSuperchargedExTier(i){const cd=S.dc.atkCharData,arr=cd&&cd.ex_supercharged_tiers;if(!arr||arr.length<2)return;const n=arr.length;S.dc.dcSuperchargedExTier=Math.max(0,Math.min(Number(i)||0,n-1));renderDcAtkUnit();renderDcAtkChar();if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);else onDcParamChange()}
function toggleDcUnitCondPassive(){setDcUnitCondPassive(!S.dc.unitCondPassive)}
function toggleDcCharCondPassive(){setDcCharCondPassive(!S.dc.charCondPassive)}

function renderDcAtkChar(){
const area=document.getElementById('dcAtkCharArea');
const cd=S.dc.atkCharData;
const isSD=!!S.dc._unitIsSD;
if(!cd){area.innerHTML=isSD?`<div style="color:var(--text-muted);font-size:12px">SD unit — character locked</div>`:`<button class="dc-pick-btn" onclick="openDcPicker('character')">${t('dc_pick_char')}</button>`;_dcUpdateExSquadAtkGroupVisibility();_dcUpdateSquadConditionGroupVisibility();_dcUpdateSupportCounterAtkUi();return}
if(cd._manual){
S.dc._pilotSkills=[];
area.innerHTML=`<div class="dc-picked dc-picked--manual"><div class="dc-picked-info"><div class="dc-picked-name">${esc(cd.name)}</div><div style="font-size:10px;color:var(--text-muted)">Custom pilot</div></div></div>`;
area.innerHTML+=_dcHtmlSheetBuffToggles();
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcUpdateSupportCounterAtkUi();
return;
}
S.dc._pilotSkills=_dcPilotSkillsVisibleForDc(cd)||[];
const stats=_dcGetCharStats();
const thum=cd.thum||cd.portrait||'';
const changeBtn=isSD?`<span class="dc-picked-change dc-picked-change--static" style="font-size:11px;color:var(--text-muted);padding:4px 8px">Locked</span>`:`<button type="button" class="dc-picked-change" onclick="openDcPicker('character')">${t('dc_change')}</button>`;
let charCpToggle='';
if(_dcCharHasConditional(cd)){
const _cpl=t('conditional_passive');
charCpToggle=`<div class="dc-picked-controls"><div class="conditional-toggle dc-dc-cond-toggle"><div class="toggle-clickable${S.dc.charCondPassive?' active':''}" role="button" tabindex="0" title="${escAttr(_cpl)}" aria-label="${escAttr(_cpl)}" onclick="toggleDcCharCondPassive()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDcCharCondPassive()}"><span class="toggle-label toggle-label--cp-chip">${_dcCpChipSpanHtml(!!S.dc.charCondPassive)}</span></div></div></div>`;
}
let charExTierRow='';
if(_dcCharHasConditional(cd)&&S.dc.charCondPassive&&cd.ex_supercharged_tiers&&cd.ex_supercharged_tiers.length>1){
const tiers=cd.ex_supercharged_tiers;
const ti=Math.min(Math.max(0,S.dc.dcSuperchargedExTier|0),tiers.length-1);
charExTierRow=`<div class="dc-atk-char-ex-tier dc-lb-row" role="group" aria-label="Supercharged EX tier">`+tiers.map((et,idx)=>`<button type="button" class="dc-lb-btn${idx===ti?' active':''}" style="font-size:11px;line-height:1.25;flex:1 1 auto;min-width:min(100%,8rem);white-space:normal;text-align:center;padding:6px 8px" onclick="setDcSuperchargedExTier(${idx})">${esc(et.label||('EX '+et.tier))}</button>`).join('')+`</div>`;
}
const hasSpChar=cd.has_sp!==undefined?cd.has_sp:(parseInt(cd.rarity_id||'5')<=4);
let charStatModeHtml='';
if(hasSpChar){
const cModeRow=S.dc.charStatMode||'normal';
charStatModeHtml=`<div class="dc-lb-row dc-char-stat-mode-row"><button type="button" class="dc-lb-btn${cModeRow==='normal'?' active':''}" onclick="setDcCharStatMode('normal')">Normal</button><button type="button" class="dc-lb-btn${cModeRow==='sp'?' active':''}" onclick="setDcCharStatMode('sp')">SP</button></div>`;
}
const charBelowPortrait=(charCpToggle||charStatModeHtml)?`<div class="dc-atk-char-below-portrait">${charCpToggle}${charStatModeHtml}</div>`:'';
area.innerHTML=`<div class="dc-atk-char-wrap"><div class="dc-picked"><img class="dc-thum" src="${imgUrl(thum)}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(cd.name)}</div><div class="dc-picked-badges">${cd.rarity_icon?`<img src="${imgUrl(cd.rarity_icon)}">`:''}${cd.role_icon?`<img src="${imgUrl(cd.role_icon)}">`:''}</div></div>${charBelowPortrait}${changeBtn}</div>${charExTierRow}</div>`;
const statsNoCp=_dcGetCharStatsForCp(false);
const skPct=_dcGetActiveSkillStatPct();
const skB=_dcGetActiveSkillBonuses();
const r0=_dcPilotSkillAdjustedStat(stats,'Ranged',skPct.Ranged||0),m0=_dcPilotSkillAdjustedStat(stats,'Melee',skPct.Melee||0),a0=_dcPilotAwakenAdjustedForDc(stats,skPct.Awaken||0);
const defPctSk=skB.defPct||0;
const d0=defPctSk?_dcPilotSkillAdjustedStat(stats,'Defense',defPctSk):_dcFindStat(stats,'Defense'),re0=_dcFindStat(stats,'Reaction');
const r=r0,m=m0,a=a0,d=d0,re=re0;
const sa=document.getElementById('dcAtkStatsArea');
const cMode=S.dc.charStatMode||'normal';
const cCp=!!(_dcCharHasConditional(cd)&&S.dc.charCondPassive);
function _cCpCell(nm){if(!cCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?' dc-stat-mini--cp':' dc-stat-mini--cp-penalty'}
function _skillCell(nm){if(nm==='Defense'&&defPctSk>0)return' dc-stat-mini--skill';if(['Ranged','Melee','Awaken'].includes(nm)&&(skPct[nm]||0)>0)return' dc-stat-mini--skill';return''}
function _cCpValBuff(nm){if(!cCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?'dc-stat-val--buffed':'dc-stat-val--penalized'}
function _cCpBonusHtml(nm){if(!cCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);const d=b-a;if(d===0)return'';const tipUp='Conditional passive — extra growth stat vs off (pilot row; main number may include skills).';const tipDn='Conditional passive — stat change vs off (pilot row; main number may include skills).';if(d>0)return`<div class="stat-card-bonus" style="margin-top:2px" title="${escAttr(tipUp)}">(+${fmtN(d)})</div>`;return`<div class="stat-card-bonus stat-card-penalty" style="margin-top:2px" title="${escAttr(tipDn)}">(${fmtN(d)})</div>`}
function _skillValBuff(nm){if(nm==='Defense'&&defPctSk>0)return'dc-stat-val--buffed';if(['Ranged','Melee','Awaken'].includes(nm)&&(skPct[nm]||0)>0)return'dc-stat-val--buffed';return''}
function _charStatValCls(nm){const a=_cCpValBuff(nm),b=_skillValBuff(nm);return a&&b?a+' '+b:(a||b||'')}
function _charStatValSpan(nm,val){const cls=_charStatValCls(nm);return`<span${cls?` class="${cls}"`:''}>${fmtN(val)}</span>`}
function _dcCharPassiveBonusLine(nm,displayedTotal){
const ent=_dcFindStatEntry(stats,nm);
if(!ent)return'';
const base=Math.max(0,Number(ent.base)||0);
const disp=Math.round(Number(displayedTotal)||0);
const bonusFromBase=Math.max(0,disp-base);
if(bonusFromBase<=0)return'';
const pAtk=['Ranged','Melee','Awaken'].includes(nm)?(skPct[nm]||0):0;
const pDef=nm==='Defense'?(defPctSk||0):0;
const hasSkill=(['Ranged','Melee','Awaken'].includes(nm)&&pAtk>0)||(nm==='Defense'&&pDef>0);
const tip=hasSkill?'Bonus over growth base: passive trait % plus active skill % (included in total above)':'Passive ability bonus (included in the total above)';
return`<div class="stat-card-bonus" title="${escAttr(tip)}">+${fmtN(bonusFromBase)}</div>`;
}
const cVis=`stats-grid dc-atk-ers dc-stat-visual--${cMode} dc-stat-grid-5`;
const bonLn=(nm,v)=>_dcCharPassiveBonusLine(nm,v);
sa.innerHTML=(sa.innerHTML||'')+`<div class="dc-section-label" style="margin-top:8px">${t('dc_char_stats')}</div><div class="${cVis}"><div class="stat-card${_cCpCell('Ranged')}${_skillCell('Ranged')}"><div class="stat-card-label">${t('col_ranged')}</div><div class="stat-card-value">${_charStatValSpan('Ranged',r)}${bonLn('Ranged',r)}${_cCpBonusHtml('Ranged')}</div></div><div class="stat-card${_cCpCell('Melee')}${_skillCell('Melee')}"><div class="stat-card-label">${t('col_melee')}</div><div class="stat-card-value">${_charStatValSpan('Melee',m)}${bonLn('Melee',m)}${_cCpBonusHtml('Melee')}</div></div><div class="stat-card${_cCpCell('Awaken')}${_skillCell('Awaken')}"><div class="stat-card-label">${t('col_awaken')}</div><div class="stat-card-value">${_charStatValSpan('Awaken',a)}${bonLn('Awaken',a)}${_cCpBonusHtml('Awaken')}</div></div><div class="stat-card${_cCpCell('Defense')}${_skillCell('Defense')}"><div class="stat-card-label">${t('col_defense')}</div><div class="stat-card-value">${_charStatValSpan('Defense',d)}${bonLn('Defense',d)}${_cCpBonusHtml('Defense')}</div></div><div class="stat-card${_cCpCell('Reaction')}"><div class="stat-card-label">${t('col_reaction')}</div><div class="stat-card-value">${_charStatValSpan('Reaction',re)}${bonLn('Reaction',re)}${_cCpBonusHtml('Reaction')}</div></div></div>`;
area.innerHTML+=_dcHtmlSheetBuffToggles();
_dcRenderPilotBonuses(area,cd);
_dcRenderPilotSkills(area,cd);
const supCntPilotPct=!cd._manual?_dcParseMaxSupportCounterAtkPctFromChar(cd):0;
if(supCntPilotPct>0){area.insertAdjacentHTML('beforeend',`<div style="font-size:10px;color:var(--accent-cyan);margin-top:10px;line-height:1.35">Support-role pilot: +${supCntPilotPct}% MS ATK when executing Support Attack/Counter on a <strong>Support-type (role)</strong> attacker MS. With other unit roles the pilot can still use Support Attack mechanics, but this ATK&nbsp;% does not apply—Attacker Parameters shows the toggle dimmed until the attacker MS is Support-class.</div>`)}
_dcRecalcPilotBonuses(false);
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcUpdateSupportCounterAtkUi();
}

/** True when ability text (line + neighbors + name) indicates the bonus applies only with pilot SP stats (Normal/SP toggle). */
function _dcSpGateHint(block){
const s=String(block||'');
if(!s.trim())return false;
if(/SP\s*enhancement|SP[- ]?enhanced|SP\s+stats?\s*(?:\(|is|are|[:.;])|SP\s+pilot|pilot\s+SP|SP\s+is\s+enhanced|SP\s+stat\s+(?:enhance|boost|buff)/i.test(s))return true;
if(/(?:after|upon|with)\s+SP\s+(?:enhancement|stats?)/i.test(s))return true;
if(/SP\s*強化|ＳＰ/.test(s))return true;
if(/\(\s*SP\s*\)/i.test(s))return true;
return false;
}
function _dcPilotAbilitySpCharGateContext(ab,lineIndex,lineText){
const t=String(lineText||'');
const lines=ab.details||[];
const prev=lineIndex>0?String(lines[lineIndex-1].text||'').replace(/\n/g,' '):'';
const next=lineIndex<lines.length-1?String(lines[lineIndex+1].text||'').replace(/\n/g,' '):'';
const name=String(ab.name||'');
return _dcSpGateHint([t,prev,next,name].join('\n'));
}

/** Match get_character / unit detail: SP pilot stats use SpAbilityId replacement when toggled. */
function _dcResolveCharAbilityForMode(ab){
if(!ab)return null;
if((S.dc.charStatMode||'normal')==='sp'&&ab.sp_replacement)return ab.sp_replacement;
return ab;
}
/** Match get_unit ep() + detail UI: SSP uses ssp_replacement; ssp_only rows apply only in SSP mode. */
function _dcResolveUnitAbilityForMode(ab){
if(!ab)return null;
const um=S.dc.unitStatMode||'normal';
if(ab.ssp_only)return um==='ssp'?ab:null;
if(um==='ssp'&&ab.ssp_replacement)return ab.ssp_replacement;
return ab;
}

/** MS ability: pilot Awaken below 900 is raised to 900; active Awaken% skills still use growth base (see _dcPilotAwakenAdjustedForDc). */
function _dcUnitAbilityTextIsAwakenFloor900(txt){
const s=String(txt||'').replace(/\r\n/g,'\n').replace(/\n/g,' ');
if(/Awaken\s+of\s+less\s+than\s+900/i.test(s)&&/Awaken\s+to\s+900/i.test(s))return true;
if(/覺醒值未滿\s*900/.test(s)&&/提升至\s*900/.test(s))return true;
if(/覚醒値が\s*900\s*未満/.test(s)&&/900/.test(s)&&/上昇|向上|する/.test(s))return true;
return false;
}
function _dcResolvedUnitAbilityGrantsAwakenFloor900(resolved){
if(!resolved)return false;
const aid=String(resolved.id||'');
if(aid==='1015102')return true;
for(let i=0;i<(resolved.details||[]).length;i++){
const ln=resolved.details[i];
const t=(ln&&ln.text)||'';
if(_dcUnitAbilityTextIsAwakenFloor900(t))return true;
}
return false;
}
function _dcUnitGrantsPilotAwakenFloor900(ud){
if(!ud||ud._manual||!Array.isArray(ud.abilities))return false;
for(let i=0;i<ud.abilities.length;i++){
const r=_dcResolveUnitAbilityForMode(ud.abilities[i]);
if(_dcResolvedUnitAbilityGrantsAwakenFloor900(r))return true;
}
return false;
}

/** Single condition from API (unit_tags OR across a group; AND across groups). */
function _dcMatchOneCondition(c,ud,cd){
const id=String(c&&c.id);
const src=String(c.source||'');
const typ=String(c.type||'');
const ut=new Set((ud&&ud.tags||[]).map(t=>String(t&&t.id)));
const usr=new Set((ud&&ud.series||[]).map(s=>String(s&&s.id)));
const ct=new Set((cd&&cd.tags||[]).map(t=>String(t&&t.id)));
const csr=new Set((cd&&cd.series||[]).map(s=>String(s&&s.id)));
if(src==='unit_ids')return !!(ud&&String(ud.id)===id);
if(src==='character_ids')return !!(cd&&String(cd.id)===id);
if(src==='character_series')return !!(cd&&csr.has(id));
if(src==='char_tags'||typ==='character')return !!(cd&&ct.has(id));
if(src==='unit_tags'||src==='group_tags')return !!(ud&&ut.has(id));
if(typ==='unit')return !!(ud&&ut.has(id));
if(typ==='series'&&src)return src==='character_series'?!!(cd&&csr.has(id)):!!(ud&&usr.has(id));
if(src==='series'||typ==='series')return !!(ud&&usr.has(id));
return false;
}
/** One group: multiple unit_tags / group_tags = OR (in-game); other sources AND together. */
function _dcConditionGroupMatches(ud,cd,grp){
const conds=grp.conditions||[];
if(!conds.length)return true;
const tagConds=conds.filter(c=>{
const src=String(c&&c.source||'');
return src==='unit_tags'||src==='group_tags';
});
const other=conds.filter(c=>!tagConds.includes(c));
const tagPart=!tagConds.length||tagConds.some(c=>_dcMatchOneCondition(c,ud,cd));
const otherPart=!other.length||other.every(c=>_dcMatchOneCondition(c,ud,cd));
return tagPart&&otherPart;
}
function _dcAbilityCondContextMeetsGroups(ud,cd,condGroups){
if(!condGroups||!condGroups.length)return true;
return condGroups.every(grp=>_dcConditionGroupMatches(ud,cd,grp));
}
function _dcUnitMeetsAbilityConditionGroups(ud,condGroups){
return _dcAbilityCondContextMeetsGroups(ud,null,condGroups);
}
function _dcCharIsAttackRole(cd){return String(cd&&cd.role_id||'')==='1'}
function _dcCharIsSupportRole(cd){return String(cd&&cd.role_id||'')==='3'}
/** Trait / ability blob mentions Support Attack or Support Counter context (EN/JA/TW). */
function _dcAbilityBlobMentionsSupportCounter(s){
const t=String(s||'');
if(!t.trim())return false;
const low=t.toLowerCase();
if(low.includes('support attack/counter'))return true;
if(/when executing a counter or support counter/i.test(low))return true;
if(/support counter/i.test(low)&&/support attack/i.test(low))return true;
if(/支援攻撃|支援反撃/.test(t))return true;
if(/支援攻擊|支援反擊/.test(t))return true;
if(/「支援攻[擊撃][／/]反[擊撃]」/.test(t))return true;
return false;
}
/** Max ATK % from lines in blob that belong to Support Attack/Counter passives (parsed from localized trait text). */
function _dcExtractSupportCounterAtkPctFromBlob(blob){
const s=String(blob||'');
let max=0;
const tryN=(m)=>{if(m){const v=parseInt(m[1],10);if(Number.isFinite(v)&&v>max)max=v}};
let m;
m=s.match(/(?:increase|Increases)\s+own\s+ATK\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/(?:increase|Increases)\s+ATK\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/increase\s+own\s+atk\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/increase\s+atk\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/攻撃力が(\d+)%上昇/);tryN(m);
m=s.match(/攻擊力提升(\d+)%/);tryN(m);
m=s.match(/攻擊力提昇(\d+)%/);tryN(m);
return max;
}
function _dcParseMaxSupportCounterAtkPctFromChar(cd){
if(!cd||cd._manual||!_dcCharIsSupportRole(cd))return 0;
let max=0;
(cd.abilities||[]).forEach(ab=>{
const r=_dcResolveCharAbilityForMode(ab);
if(!r)return;
const parts=[];
(r.details||[]).forEach(d=>{
const tx=typeof d==='string'?d:(d&&d.text)||'';
if(tx)parts.push(tx);
});
const blob=parts.join('\n');
if(!_dcAbilityBlobMentionsSupportCounter(blob))return;
const p=_dcExtractSupportCounterAtkPctFromBlob(blob);
if(p>max)max=p;
});
return max;
}
function _dcSupportCntEligiblePairSnap(cd,ud){
const pilotOk=!!(cd&&!cd._manual&&_dcCharIsSupportRole(cd));
const rawPct=pilotOk?_dcParseMaxSupportCounterAtkPctFromChar(cd):0;
const unitOk=!!(ud&&!ud._manual&&String(ud.role_id)==='3');
if(!pilotOk||rawPct<=0||!unitOk)return '';
return `${String(cd.id||'')}|${String(ud.id||'')}|${rawPct}`;
}
function _dcEffectiveSupportCounterAtkPct(){
if(!S.dc.supportCounterAtk)return 0;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
if(!cd||cd._manual||!_dcCharIsSupportRole(cd))return 0;
if(!ud||ud._manual||String(ud.role_id)!=='3')return 0;
return Math.max(0,S.dc._supportCounterAtkPct|0);
}
function _dcApplySupportCounterAtkToUnitAtk(unitAtk){
const F=Math.floor;
const p=_dcEffectiveSupportCounterAtkPct();
if(p<=0)return unitAtk;
return F(Math.max(0,Number(unitAtk)||0)*(100+p)/100);
}

function _dcParsePilotAbilBonuses(cd){
const b={dmgDealt:0,critDmg:0,dmgTaken:0,atkPct:0,items:[]};
const ud=S.dc.atkUnitData;
function parseFromResolved(resolved,src){
if(!resolved)return;
const dispName=resolved.display_name||resolved.name||'';
const lines=(resolved.details||[]);
let awakenFloorAdded=false;
lines.forEach((ln,li)=>{
const txt=(ln.text||'').replace(/\n/g,' ');
const condGroups=ln.condition_groups||[];
const hasCond=condGroups.length>0;
let condMet=false;
if(hasCond)condMet=_dcAbilityCondContextMeetsGroups(ud,cd,condGroups);
const isUnmet=hasCond&&!condMet;
const spCharGate=src==='char'&&_dcPilotAbilitySpCharGateContext(resolved,li,txt);
let m;
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?damage\s+dealt(?:\s+to\s+(?:the\s+)?enem(?:y|ies))?\s+(?:with\s+.+?\s+)?by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身(?:物理武裝|光束武裝|特殊武裝)?造成的損傷提升(\d+)%/);
if(!m&&_dcIsZhCalcLang())m=txt.match(/對敵方造成的損傷提升(\d+)%/);
if(m){
const v=parseInt(m[1],10);
const attackRoleBlock=src==='char'&&!_dcCharIsAttackRole(cd)&&!hasCond;
const effectiveUnmet=isUnmet||attackRoleBlock;
b.dmgDealt+=effectiveUnmet?0:v;
b.items.push({label:`Damage Dealt +${v}%`,val:v,key:'dmgDealt',cond:effectiveUnmet,autoMet:hasCond&&condMet&&!attackRoleBlock,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!effectiveUnmet&&!spCharGate,locked:attackRoleBlock,attackRoleOnly:attackRoleBlock})
}
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?(?:MS\s+)?(?:ATK|Attack)\s+and\s+[Cc]ritical\s+[Dd]amage\s+by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身攻擊力及爆擊損傷提升(\d+)%/);
if(!m&&_dcIsJaCalcLang())m=txt.match(/自身の攻撃力とクリティカルダメージが(\d+)%上昇/);
if(m){const v=parseInt(m[1],10);b.critDmg+=isUnmet?0:v;b.items.push({label:`Critical Damage +${v}% (MS ATK +${v}% on growth line)`,val:v,key:'critDmg',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate})}
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?[Cc]ritical\s+(?:damage\s+)?(?:dealt\s+)?by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身爆擊損傷提升(\d+)%/);
if(m){const v=parseInt(m[1],10);b.critDmg+=isUnmet?0:v;b.items.push({label:`Critical Damage +${v}%`,val:v,key:'critDmg',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate})}
m=txt.match(/[Rr]educe\s+(?:own\s+)?damage\s+taken\s+by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身受到的損傷減輕(\d+)%/);
if(m){const v=parseInt(m[1],10);b.dmgTaken+=isUnmet?0:v;b.items.push({label:`Damage Taken -${v}%`,val:v,key:'dmgTaken',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate})}
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?(?:Ranged|Melee|Awaken)\s+(?:and\s+(?:Ranged|Melee|Awaken)\s+)?by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%/);
if(m){const v=parseInt(m[m.length-1],10);b.atkPct+=isUnmet?0:v;b.items.push({label:`Attack Stat +${v}%`,val:v,key:'atkPct',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,locked:true,src})}
if(src==='unit'&&!awakenFloorAdded&&_dcUnitAbilityTextIsAwakenFloor900(txt)){
awakenFloorAdded=true;
const st=_dcGetCharStats();
const entAw=_dcFindStatEntry(st,'Awaken');
const pt=entAw?Math.round(Number(entAw.total)||0):9999;
const applies=!isUnmet&&pt<900;
b.items.push({label:'Pilot Awaken minimum 900 (MS ability)',key:'awakenFloor900',cond:!applies,autoMet:applies,name:dispName,src:'unit',locked:true,abilityHasCond:hasCond,alwaysActive:applies});
}
});
}
if(cd&&cd.abilities){
cd.abilities.forEach(ab=>parseFromResolved(_dcResolveCharAbilityForMode(ab),'char'));
}
if(ud&&ud.abilities&&!ud._manual){
ud.abilities.forEach(ab=>parseFromResolved(_dcResolveUnitAbilityForMode(ab),'unit'));
}
return b;
}
/** Skills shown in DC: normal rows always; SP-only rows only when pilot SP mode is on and the id is not already used as replaced_by_sp_id (avoid duplicate checkbox). */
function _dcPilotSkillsVisibleForDc(cd){
if(!cd||!Array.isArray(cd.skills)||!cd.skills.length)return[];
const spOn=(S.dc.charStatMode||'normal')==='sp';
const hasSp=cd.has_sp!==undefined?!!cd.has_sp:(parseInt(String(cd.rarity_id||'5'),10)<=4);
const replaced=new Set();
cd.skills.forEach(sk=>{
const rid=sk&&sk.replaced_by_sp_id;
if(rid!=null&&String(rid)!==''&&String(rid)!=='0')replaced.add(String(rid));
});
return cd.skills.filter(sk=>{
if(!sk)return false;
if(sk.is_sp){
if(!hasSp||!spOn)return false;
if(replaced.has(String(sk.id)))return false;
return true;
}
return true;
});
}
function _dcRenderPilotBonuses(area,cd){
const b=_dcParsePilotAbilBonuses(cd);
S.dc._pilotBonuses=b;
if(!b.items.length)return;
let h=`<div class="dc-section-label" style="margin-top:10px;color:var(--accent-cyan)">Passive Bonuses</div><div class="dc-pilot-bonus-list">`;
b.items.forEach((it,i)=>{
const condTag=it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">${it.attackRoleOnly?'(Attack-role pilots only)':'(Conditional)'}</span>`:it.autoMet?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--match">(Tag Matched)</span>`:'';
let inclTag=it.key==='atkPct'&&!it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Included in pilot stats)</span>`:(it.key==='atkPct'&&it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">(Not in stats — tags unmet)</span>`:'');
if(it.key==='awakenFloor900')inclTag=!it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Included in pilot stats)</span>`:` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">(Pilot Awaken ≥ 900)</span>`;
const alwaysTag=it.alwaysActive?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Always active)</span>`:'';
const spTag=` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--match">(SP pilot stats)</span>`;
if(it.key==='atkPct'||it.locked){
h+=`<div class="dc-pilot-bonus-row dc-pilot-bonus--locked${it.cond?' dc-pilot-bonus--off':''}"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${condTag}${inclTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></div>`;
return;
}
if(it.spCharGate){
const spOn=(S.dc.charStatMode||'normal')==='sp';
const off=!spOn||it.cond;
h+=`<div class="dc-pilot-bonus-row dc-pilot-bonus--locked${off?' dc-pilot-bonus--off':''}"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${condTag}${spTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></div>`;
return;
}
if(it.alwaysActive){
h+=`<div class="dc-pilot-bonus-row dc-pilot-bonus--locked"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${alwaysTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></div>`;
return;
}
const togId=`dcPilotBonusChk_${i}`;
const checked=!it.cond;
const rowOff=!!it.cond;
h+=`<label class="dc-pilot-bonus-row${rowOff?' dc-pilot-bonus--off':''}"><input type="checkbox" id="${togId}" ${checked?'checked':''} onchange="_dcRecalcPilotBonuses(true)"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${condTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></label>`;
});
h+=`</div>`;
area.innerHTML+=h;
}
/** fullRefresh: recompute Damage Dealt Up / Crit Dmg Up from pilot toggles, skills, and current weapon crit trait. Otherwise only swap the weapon crit trait portion of Crit Dmg Up so manual fields persist when changing weapon/form on the same unit. */
function _dcRecalcPilotBonuses(fullRefresh){
const wCrit=S.dc._wpnCritDmgUp|0;
if(!fullRefresh){
const ci=document.getElementById('dcCritDmgUp');
const prevN=S.dc._integratedWpnCritDmgUp|0;
const cur=parseInt(ci?.value,10)||0;
const newV=Math.max(0,cur-prevN+wCrit);
if(ci)ci.value=String(newV);
S.dc._integratedWpnCritDmgUp=wCrit;
onDcParamChange();
return;
}
const b=S.dc._pilotBonuses||{items:[]};
let dmgDealt=0,critDmg=0;
b.items.forEach((it,i)=>{
if(it.key==='atkPct')return;
if(it.spCharGate){
if(it.cond)return;
if((S.dc.charStatMode||'normal')!=='sp')return;
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
return;
}
if(it.alwaysActive){
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
return;
}
const chk=document.getElementById(`dcPilotBonusChk_${i}`);
if(chk&&chk.checked){
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
}
});
const skB=_dcGetActiveSkillBonuses();
dmgDealt+=skB.dmgDealt;
/** Vigor dmg % is only in calculateDamage (vigorDmgBonusPct); adding DC_MP here double-counts. */
const di=document.getElementById('dcDmgIncrease');
const ci=document.getElementById('dcCritDmgUp');
if(di)di.value=dmgDealt;
if(ci)ci.value=critDmg+wCrit;
S.dc._integratedWpnCritDmgUp=wCrit;
onDcParamChange();
}
function _dcRenderPilotSkills(area,cd){
if(!cd||!cd.skills||!cd.skills.length)return;
const skillsList=_dcPilotSkillsVisibleForDc(cd)||[];
S.dc._pilotSkills=skillsList;
if(!skillsList.length)return;
S.dc._activeSkills=S.dc._activeSkills||{};
let h=`<div class="dc-section-label" style="margin-top:10px;color:var(--accent-cyan)">Skills</div><div style="font-size:12px;line-height:1.6">`;
skillsList.forEach((sk,i)=>{
const dsk=_dcResolveSkillForDcMode(sk);
const desc=((dsk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join(' ')||dsk.desc||'').replace(/\n/g,' ');
const togId=`dcSkillChk_${i}`;
const isOn=!!S.dc._activeSkills[sk.id];
h+=`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px">`;
h+=`<input type="checkbox" id="${togId}" ${isOn?'checked':''} onchange="_dcToggleSkill('${sk.id}',${i})">`;
if(dsk.icon)h+=`<img src="${imgUrl(dsk.icon)}" style="width:20px;height:20px;border-radius:3px" onerror="this.style.display='none'">`;
h+=`<span style="font-weight:600">${esc(dsk.name||sk.name)}</span>`;
if(desc)h+=`<span class="dc-pilot-skill-desc" style="margin-left:4px">${esc(desc.substring(0,60))}${desc.length>60?'...':''}</span>`;
h+=`</label>`;
});
h+=`</div>`;
area.innerHTML+=h;
}
function _dcToggleSkill(skillId,idx){
const chk=document.getElementById(`dcSkillChk_${idx}`);
if(!S.dc._activeSkills)S.dc._activeSkills={};
if(chk&&chk.checked){S.dc._activeSkills[skillId]=true}else{delete S.dc._activeSkills[skillId]}
renderDcAtkUnit();
renderDcAtkChar();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
}
/** When pilot SP stat mode is on, active skills use SpCharacterSkillId text (e.g. Melee Boost Lv3 +15%) instead of the normal row. */
function _dcResolveSkillForDcMode(sk){
const cd=S.dc.atkCharData;
if(!sk)return sk;
if((S.dc.charStatMode||'normal')==='sp'&&sk.replaced_by_sp_id&&cd&&Array.isArray(cd.skills)){
const sp=cd.skills.find(x=>String(x.id)===String(sk.replaced_by_sp_id));
if(sp)return sp;
}
return sk;
}
function _dcGetActiveSkillBonuses(){
const b={defPct:0,mobPct:0,dmgDealt:0};
if(!S.dc._pilotSkills||!S.dc._activeSkills)return b;
S.dc._pilotSkills.forEach(sk=>{
if(!S.dc._activeSkills[sk.id])return;
const rsk=_dcResolveSkillForDcMode(sk);
const detailLines=(rsk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join(' ');
const desc=[detailLines,rsk.desc||'',rsk.sp_desc||''].filter(Boolean).join(' ');
let m;
m=desc.match(/[Ii]ncreases?\s+(?:own\s+)?damage\s+dealt\s+(?:to\s+(?:the\s+)?enem(?:y|ies)\s+)?(?:with\s+.+?\s+)?by\s*(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=desc.match(/對敵方造成的損傷提升(\d+)%/);
if(m)b.dmgDealt+=parseInt(m[1],10);
m=desc.match(/[Ii]ncreases?\s+(?:own\s+)?DEF(?:ense)?\s+by\s*(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=desc.match(/自身防禦力提升(\d+)%/);
if(m)b.defPct+=parseInt(m[1],10);
});
return b;
}

function _dcFindStat(stats,name){
if(!stats)return 0;
if(Array.isArray(stats)){const s=stats.find(s=>s.name===name);return s?s.total:0}
return stats[name]||0;
}
function _dcFindStatEntry(stats,name){
if(!stats||!Array.isArray(stats))return null;
const s=stats.find(x=>x.name===name);
if(!s)return null;
const total=Number(s.total);
const bonus=s.bonus!=null?Number(s.bonus):0;
const base=s.base!=null?Number(s.base):NaN;
const tp=s.trait_pct;
const traitPct=(tp!=null&&Number.isFinite(Number(tp)))?Number(tp):null;
const pp=s.passive_pct;
const passivePct=(pp!=null&&pp!==''&&Number.isFinite(Number(pp)))?Number(pp):null;
const baseOk=Number.isFinite(base);
const totOk=Number.isFinite(total);
const bonOk=Number.isFinite(bonus)&&bonus>0;
let b0=baseOk?base:(totOk&&bonOk?total-bonus:total);
if(!Number.isFinite(b0))b0=totOk?total:0;
return{name,total:totOk?total:0,bonus:bonOk?bonus:0,base:Number.isFinite(b0)?b0:0,trait_pct:traitPct,passive_pct:passivePct};
}
/** Passive % for unit sheet stats (API passive_pct or infer from floor(base×p/100)===bonus). */
function _dcStatPassivePctFromEntry(ent){
const F=Math.floor;
if(!ent)return 0;
if(ent.name==='Move'||ent.name==='MOV'||ent.name==='Movement'){
if(ent.passive_pct!=null&&Number.isFinite(ent.passive_pct))return Math.max(0,ent.passive_pct);
return 0;
}
if(ent.passive_pct!=null&&Number.isFinite(ent.passive_pct))return Math.max(0,ent.passive_pct);
const b0=F(Math.max(0,ent.base||0)),bon=F(Math.max(0,ent.bonus||0));
if(b0>0&&bon>0){for(let p=0;p<=500;p++){if(F(b0*p/100)===bon)return p}}
return 0;
}
/** Pilot skills: passive total (API — trait% on growth base) + floor(base×skill%/100) for active skills. In-game does not use a single floor on (trait+skill) together; that can be +1 vs passive + separate skill floor (e.g. Awaken Boost). */
function _dcPilotSkillAdjustedStat(stats,statName,pct){
const F=Math.floor;
const p=Math.max(0,Number(pct)||0);
const ent=_dcFindStatEntry(stats,statName);
if(!ent)return F(_dcFindStat(stats,statName)*(1+p/100));
if(p<=0)return Math.round(Number(ent.total)||0);
const base=Math.max(0,Number(ent.base)||0);
const passiveTotal=Math.round(Number(ent.total)||0);
return passiveTotal+F(base*p/100);
}
/** When an MS sets pilot Awaken to 900 if below 900, use 900 + floor(base×skill%) instead of passiveTotal + floor(base×skill%). */
function _dcPilotAwakenAdjustedForDc(stats,skPctAwaken){
const F=Math.floor;
const ud=S.dc.atkUnitData;
const p=Math.max(0,Number(skPctAwaken)||0);
const ent=_dcFindStatEntry(stats,'Awaken');
if(!ent)return _dcPilotSkillAdjustedStat(stats,'Awaken',p);
if(!_dcUnitGrantsPilotAwakenFloor900(ud))return _dcPilotSkillAdjustedStat(stats,'Awaken',p);
const base=Math.max(0,Number(ent.base)||0);
const passiveTotal=Math.round(Number(ent.total)||0);
if(passiveTotal>=900)return _dcPilotSkillAdjustedStat(stats,'Awaken',p);
return 900+(p>0?F(base*p/100):0);
}

const VIGOR_LEVEL_ORDER={normal:0,medium:0,high:1,max:2,super:3,supercharged:3};
const DC_MP_THRESHOLDS=[{min:0,level:'medium'},{min:5,level:'high'},{min:12,level:'max'},{min:18,level:'super'}];
function _dcCalcStartingVigor(){
const cd=S.dc.atkCharData;const ud=S.dc.atkUnitData;
if(!cd||!cd.abilities)return 'medium';
let totalMp=0;
cd.abilities.forEach(ab=>{
const rab=_dcResolveCharAbilityForMode(ab);
if(!rab)return;
(rab.details||[]).forEach(ln=>{
const txt=(ln.text||'').replace(/\n/g,' ');
let m=txt.match(/[Ii]ncrease\s+(?:own\s+)?MP\s+by\s+(\d+)/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身MP增加(\d+)/);
if(!m)return;
const v=parseInt(m[1],10);
const condGroups=ln.condition_groups||[];
const hasCond=condGroups.length>0;
const condMet=!hasCond||_dcAbilityCondContextMeetsGroups(ud,cd,condGroups);
if(condMet)totalMp+=v;
});
});
let level='medium';
for(const t of DC_MP_THRESHOLDS){if(totalMp>=t.min)level=t.level}
return level;
}
function _dcAutoSetVigor(){
const lv=_dcCalcStartingVigor();
S.dc._autoVigor=lv;
setDcMp(lv);
const hint=document.getElementById('dcVigorAutoHint');
if(hint){
const MP_LABEL={medium:'Normal',high:'High',max:'Max',super:'Supercharged'};
if(lv!=='medium')hint.textContent=`(Auto: ${MP_LABEL[lv]||lv} from character MP bonus)`;
else hint.textContent='';
}
}
function _dcParseRangeModifiers(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
if(!cd||!ud)return[];
const unitName=(ud.name||'').toLowerCase();
const unitBare=(ud.name||'').replace(/\s*\(EX\)\s*/gi,'').trim().toLowerCase();
const mods=[];
const sources=[];
(cd.skills||[]).forEach(sk=>{
if(sk.is_sp)return;
const rsk=_dcResolveSkillForDcMode(sk);
if(rsk.desc)sources.push(rsk.desc);
if(rsk.sp_desc)sources.push(rsk.sp_desc);
});
(cd.abilities||[]).forEach(ab=>{
const r=_dcResolveCharAbilityForMode(ab);
if(!r)return;
(r.details||[]).forEach(d=>{if(typeof d==='object'&&d.text)sources.push(d.text);else if(typeof d==='string')sources.push(d)})});
function enPushIfUnit(reqUnitRaw,reqVigorKey,wpnTypesStr,rangeInc){
const ru=(reqUnitRaw||'').trim().toLowerCase();
if(ru&&!unitName.includes(ru)&&!ru.includes(unitBare))return;
mods.push({reqVigor:reqVigorKey,wpnTypes:wpnTypesStr,rangeInc});
}
if(_dcIsZhCalcLang()){
sources.forEach(txt=>{
let m;
const twFull=/搭乘(?:單位為)?「([^」]+)」[^]*?自身戰意為「([^」]+)」以上[^]*?((?:物理|光束|特殊)(?:、(?:物理|光束|特殊))*)武裝的最大射程提升(\d+)/g;
while((m=twFull.exec(txt))!==null){
enPushIfUnit(m[1],_dcTwBattleSpiritToVigorKey(m[2]),_dcTwZhWeaponTypesToEn(m[3]),parseInt(m[4],10)||0);
}
if(!/搭乘/.test(txt)){
const twVigor=/自身戰意為「([^」]+)」以上[^]*?((?:物理|光束|特殊)(?:、(?:物理|光束|特殊))*)武裝的最大射程提升(\d+)/g;
while((m=twVigor.exec(txt))!==null){
enPushIfUnit('',_dcTwBattleSpiritToVigorKey(m[1]),_dcTwZhWeaponTypesToEn(m[2]),parseInt(m[3],10)||0);
}
}
const twPilot=/搭乘「([^」]+)」時[^]*?((?:物理|光束|特殊)(?:、(?:物理|光束|特殊))*)武裝的最大射程提升(\d+)/g;
while((m=twPilot.exec(txt))!==null){
if(/自身戰意為/.test(m[0]))continue;
enPushIfUnit(m[1],'medium',_dcTwZhWeaponTypesToEn(m[2]),parseInt(m[3],10)||0);
}
});
return mods;
}
const re=/when\s+piloting\s+(.+?),\s*if\s+vigor\s+is\s+(\w+)\s+or\s+higher,?\s*(?:the\s+)?max\s+range\s+of\s+(.+?)\s+(?:weapon\s+)?is\s+increased\s+by\s+(\d+)/gi;
sources.forEach(txt=>{
let m;const re2=new RegExp(re.source,'gi');
while((m=re2.exec(txt))!==null){
const reqUnit=m[1].trim().toLowerCase();
const reqVigor=m[2].trim().toLowerCase();
const wpnTypes=m[3].trim().toLowerCase();
const rangeInc=parseInt(m[4],10)||0;
if(unitName.includes(reqUnit)||reqUnit.includes(unitBare)){
mods.push({reqVigor,wpnTypes,rangeInc});
}
}
});
return mods;
}
function _dcGetEffectiveRange(wpn){
const mods=_dcParseRangeModifiers();
let maxR=wpn.max_range||0;
const curVigor=VIGOR_LEVEL_ORDER[_dcNormMpLevel(S.dc.mpLevel)]||0;
const WPN_ATTR_TYPES={'1':'beam','2':'physical','3':'special','4':'beam','5':'beam','6':'physical','7':'beam'};
const wpnKeySet=new Set(_dcWeaponAttributeKeys(wpn));
mods.forEach(mod=>{
const reqLv=VIGOR_LEVEL_ORDER[mod.reqVigor]!==undefined?VIGOR_LEVEL_ORDER[mod.reqVigor]:99;
if(curVigor>=reqLv){
const types=mod.wpnTypes.split(/\s+or\s+|,\s*/);
const wpnAttrLabel=(wpn.attribute||'').toLowerCase();
const wpnTypeLabel=WPN_ATTR_TYPES[wpn.weapon_type]||'';
const matches=types.some(t=>{const tl=t.trim().toLowerCase();return wpnKeySet.has(tl)||wpnAttrLabel.includes(tl)||wpnTypeLabel.includes(tl)});
if(matches)maxR+=mod.rangeInc;
}
});
return{min_range:wpn.min_range,max_range:maxR};
}

function _dcBaseWeaponIdForSsp(wid){
const s=String(wid||'');
if(s.length<8||!/^\d+$/.test(s))return null;
if(s.endsWith('90')||s.endsWith('80'))return s.slice(0,-2)+'01';
return null;
}
function _dcIsSspVariantWeapon(wpn){
if(!wpn)return false;
if(wpn.is_ssp_weapon)return true;
const bid=_dcBaseWeaponIdForSsp(wpn.id);
return bid&&String(wpn.id)!==bid;
}
function _dcMergeBaseWeaponTraitsForSsp(wpn,idx,allTraits){
// SSP weapons (...90 / ...80): scaling must come only from this row's traits + ssp_traits — not the base weapon's HP/MP/distance lines.
if(_dcIsSspVariantWeapon(wpn))return;
const bid=_dcBaseWeaponIdForSsp(wpn&&wpn.id);
if(!bid||String(wpn.id)===bid)return;
const ud=S.dc&&S.dc.atkUnitData;
if(!ud||!ud.weapons)return;
const base=ud.weapons.find(x=>String(x.id)===bid);
if(!base||!base.levels)return;
if(idx>=0&&base.levels[idx]&&(base.levels[idx].traits||[]).length){
(base.levels[idx].traits||[]).forEach(t=>allTraits.push(t));
}else{
base.levels.forEach(lv=>(lv.traits||[]).forEach(t=>allTraits.push(t)));
}
}

function _dcWeaponPowLvToMaxPct(lv){
const i=(parseInt(lv,10)||0)-1;
const arr=[5,7,10,12,15,17,20,22,25];
return(i>=0&&i<arr.length)?arr[i]:0;
}
function _dcDcIncludeSspWeaponEffects(){
return(S.dc&&S.dc.unitStatMode||'normal')==='ssp';
}
function _dcIsCustomCoreTraitLine(txt){
return /\[Custom\s*Core/i.test(txt)||/\bCustom\s+Core\s+Effect\b/i.test(txt);
}
function _dcExtractCustomCoreMaxUpPct(txt){
if(!txt)return 0;
const s=String(txt);
let m=s.match(/Maximum\s+Up\s+(\d+)%/i);
if(m)return parseInt(m[1],10)||0;
m=s.match(/\(\s*&\s*Maximum\s+Up\s+(\d+)%\s*\)/i);
if(m)return parseInt(m[1],10)||0;
m=s.match(/さらに最大値(\d+)%上昇/);
if(m)return parseInt(m[1],10)||0;
m=s.match(/且最大值提升(\d+)%/);
if(m)return parseInt(m[1],10)||0;
return 0;
}
function _dcApplySspCorePowBonus(traits,bonus,wpn){
const x=bonus|0;if(!x)return;
// On SSP-only weapons, Custom Core "Maximum Up" stacks with that weapon's own effect (e.g. distance power), never with inherited HP/MP buckets.
if(wpn&&_dcIsSspVariantWeapon(wpn)){
traits.distCoreMax=(traits.distCoreMax|0)+x;
return;
}
if((traits.mpPowerMax|0)>0)traits.mpPowerMax=(traits.mpPowerMax|0)+x;
else if((traits.hpPowerMax|0)>0)traits.hpPowerMax=(traits.hpPowerMax|0)+x;
else traits.distCoreMax=(traits.distCoreMax|0)+x;
}
function _dcParseWeaponTraits(wpn,lvIdx){
const traits={distPowerMax:0,hpPowerMax:0,mpPowerMax:0,distCoreMax:0,critDmgUp:0,absoluteHit:false,dmgReductionNull:false,powTraitHitSet:null};
if(!wpn)return traits;
const hit=new Set();
const noteHit=(raw)=>{if(raw!=null&&raw!=='')hit.add(String(raw).trim())};
const includeSsp=_dcDcIncludeSspWeaponEffects();
const zh=_dcIsZhCalcLang();
const isJa=(S.lang||'EN').toUpperCase()==='JA';
const allTraits=[];
const idx=lvIdx!==undefined&&lvIdx>=0?lvIdx:-1;
if(wpn.levels&&wpn.levels.length){
if(idx>=0&&wpn.levels[idx]&&(wpn.levels[idx].traits||[]).length){
(wpn.levels[idx].traits||[]).forEach(t=>allTraits.push(t));
}else{
wpn.levels.forEach(lv=>(lv.traits||[]).forEach(t=>allTraits.push(t)));
}
}else{(wpn.traits||[]).forEach(t=>allTraits.push(t));}
if(includeSsp)(wpn.ssp_traits||[]).forEach(t=>allTraits.push(t));
_dcMergeBaseWeaponTraitsForSsp(wpn,idx,allTraits);
let sspCoreBonus=0;
if(includeSsp){
(wpn.ssp_traits||[]).forEach(raw=>{
const c=_dcExtractCustomCoreMaxUpPct(String(raw||''));
if(c>sspCoreBonus)sspCoreBonus=c;
if(c>0)noteHit(raw);
});
}
allTraits.forEach(raw=>{
const txt=String(raw).replace(/\n/g,' ');
if(/absolute\s+hit/i.test(txt)||txt.includes('絕對命中'))traits.absoluteHit=true;
if(/weapon\s+attribute\s+damage\s+reduction\s+null/i.test(txt)||txt.includes('武裝屬性損傷減輕無效'))traits.dmgReductionNull=true;
let m=txt.match(/Increase\s+Critical\s+Damage\s+by\s+(\d+)%/i);
if(!m)m=txt.match(/[Ii]ncrease\s+(?:own\s+)?[Cc]ritical\s+(?:damage\s+)?(?:dealt\s+)?by\s+(\d+)%/i);
if(!m&&zh)m=txt.match(/自身爆擊損傷提升(\d+)%/);
if(m){traits.critDmgUp=Math.max(traits.critDmgUp,parseInt(m[1],10));return}
m=txt.match(/(?:closer\s+you\s+are|(?:farther|further)\s+you\s+are).*?weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)/i);
if(!m&&zh)m=txt.match(/距離敵方越(?:近|遠)，武裝POWER越為提升（最高提升(\d+)%）/);
if(!m&&isJa){m=txt.match(/敵から(?:近い|遠い)ほど武装POWERが上昇[（(]最大(\d+)%上昇[）)]/);}
if(m){const p=parseInt(m[1],10)||0;traits.distPowerMax=Math.max(traits.distPowerMax,p);noteHit(raw);}
m=txt.match(/(?:lower|higher)\s+(?:your\s+)?remaining\s+HP.*?weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)/i);
if(!m&&zh)m=txt.match(/自身剩餘HP越(?:高|低)，武裝POWER越為提升（最高提升(\d+)%）/);
if(!m&&isJa)m=txt.match(/自身の残HPが(?:多い|少ない)ほど武装POWERが上昇（最大(\d+)%上昇）/);
if(m){const p=parseInt(m[1],10)||0;traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}
m=txt.match(/(?:With\s+More|With\s+Less)\s+Remaining\s+HP,?\s*Higher\s+Weapon\s+Power\s*LV\s*(\d+)/i);
if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}
if(zh){m=txt.match(/剩餘HP越(?:高|低)武裝POWER提升\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}}
if(isJa){m=txt.match(/残HP(?:多い|少ない)ほど武装POWER上昇\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}}
m=txt.match(/the\s+higher\s+your\s+MP\s+is,?\s*the\s+greater\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)/i);
if(m){const p=parseInt(m[1],10)||0;traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}
if(zh){m=txt.match(/(?:戰鬥開始時，)?自身MP越高，武裝POWER越為提升（最高提升(\d+)%）/);if(m){const p=parseInt(m[1],10)||0;traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}
if(isJa){m=txt.match(/戦闘開始時、自身のMPが多いほど武装POWERが上昇（最大(\d+)%上昇）/);if(m){const p=parseInt(m[1],10)||0;traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}
m=txt.match(/Scaling\s+Weapon\s+Power\s+\(High\s+(?:Max\s+)?MP\)(?:\s*LV\s*(\d+))?/i);
if(m){const p=m[1]?_dcWeaponPowLvToMaxPct(m[1]):0;if(p){traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}
if(zh){m=txt.match(/MP越高武裝POWER提升\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}}
if(isJa){m=txt.match(/MP高いほど武装POWER上昇\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}}
});
_dcApplySspCorePowBonus(traits,sspCoreBonus,wpn);
traits.powTraitHitSet=hit;
return traits;
}
/** Level row for DC (clamped index), or top-level weapon stats when API has no per-level array. */
function _dcWeaponLevelRow(wpn,lvIdx){
if(!wpn)return{power:0,accuracy:0,critical:0,en:0,traits:[]};
if(wpn.levels&&wpn.levels.length){
const j=Math.min(Math.max(0,lvIdx|0),wpn.levels.length-1);
return wpn.levels[j]||{power:0,accuracy:0,critical:0,en:0,traits:[]};
}
return{power:wpn.power|0,en:(wpn.en_cost|wpn.en)|0,accuracy:wpn.accuracy|0,critical:wpn.critical|0,ammo:wpn.ammo|0,traits:wpn.traits||[]};
}
/** Matches calculateDamage() and unit detail SSP row: ceil(baseLv * (1 + trait% / 100)) + SSP flat power bonus when DC unit mode is SSP (same order as renderWeaponsDynamic: scale then add ssp_power_bonus). */
function _dcComputedWeaponPowerForLevel(wpn,lvIdx){
const C=Math.ceil;
const lvData=_dcWeaponLevelRow(wpn,lvIdx);
const baseLv=lvData.power||0;
const traitLv=(wpn&&wpn.levels&&wpn.levels.length)?Math.min(Math.max(0,lvIdx|0),wpn.levels.length-1):0;
const wt=_dcParseWeaponTraits(wpn,traitLv);
const traitDistPow=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0));
const traitScaling=(wt.hpPowerMax||0)+(wt.mpPowerMax||0);
const scaled=C(baseLv*(1+(traitDistPow+traitScaling)/100));
const sspFlat=_dcDcIncludeSspWeaponEffects()?(wpn.ssp_power_bonus|0):0;
return scaled+sspFlat;
}
/** DC weapon header PWR: raw level table power + SSP flat in SSP mode only — excludes trait % scaling (that affects damage via _dcComputedWeaponPowerForLevel). */
function _dcWpnSheetFlatPower(wpn,lvIdx){
const lv=_dcWeaponLevelRow(wpn,lvIdx);
const base=lv.power|0;
return base+(_dcDcIncludeSspWeaponEffects()?(wpn.ssp_power_bonus|0):0);
}
function _dcBestLevelIndexForWeapon(wpn){
if(!wpn||!wpn.levels||!wpn.levels.length)return 0;
let bestPow=-1,bestJ=0,bestRaw=-1;
wpn.levels.forEach((lv,j)=>{
const p=_dcComputedWeaponPowerForLevel(wpn,j);
const raw=lv.power||0;
if(p>bestPow||(p===bestPow&&(raw>bestRaw||(raw===bestRaw&&j>bestJ)))){
bestPow=p;bestJ=j;bestRaw=raw;
}
});
return bestJ;
}
function _dcPickBestWeaponIndices(ud){
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length)return{wpnIdx:0,wpnLv:0};
let bestPow=-1,bestI=0,bestJ=0,bestRaw=-1;
wpns.forEach((w,i)=>{
if(w.levels&&w.levels.length){
w.levels.forEach((lv,j)=>{
const p=_dcComputedWeaponPowerForLevel(w,j);
const raw=lv.power||0;
if(p>bestPow||(p===bestPow&&(raw>bestRaw||(raw===bestRaw&&j>bestJ)))){
bestPow=p;bestI=i;bestJ=j;bestRaw=raw;
}
});
}else{
const p=_dcComputedWeaponPowerForLevel(w,0);
const raw=w.power|0;
if(p>bestPow||(p===bestPow&&(raw>bestRaw||(raw===bestRaw&&i>bestI)))){
bestPow=p;bestI=i;bestJ=0;bestRaw=raw;
}
}
});
return{wpnIdx:bestI,wpnLv:bestJ};
}
function _dcDefaultWpnLvIndex(wpn){
return _dcBestLevelIndexForWeapon(wpn);
}
function renderDcWeaponArea(){
const wa=document.getElementById('dcAtkWpnArea');
const ud=S.dc.atkUnitData;
if(ud&&ud._manual){wa.innerHTML='';S.dc._wpnCritDmgUp=0;S.dc._wpnTraits={};_dcRefreshFinalWpnPowPlaceholder();return}
if(!ud||!ud.weapons||!ud.weapons.length){wa.innerHTML='';S.dc._wpnCritDmgUp=0;S.dc._wpnTraits={};_dcRefreshFinalWpnPowPlaceholder();return}
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length){wa.innerHTML='';_dcRefreshFinalWpnPowPlaceholder();return}
if(S.dc.wpnIdx<0||S.dc.wpnIdx>=wpns.length){
const b=_dcPickBestWeaponIndices(ud);
S.dc.wpnIdx=b.wpnIdx;S.dc.wpnLv=b.wpnLv;
}
let h=`<div class="dc-section-label">${t('dc_weapon')}</div><select class="dc-wpn-select" onchange="setDcWeapon(this.selectedIndex)">`;
wpns.forEach((w,i)=>h+=`<option value="${i}"${i===S.dc.wpnIdx?' selected':''}>${esc(w.name)}</option>`);
h+=`</select>`;
const cw=wpns[S.dc.wpnIdx];
if(cw&&cw.levels&&cw.levels.length){
const maxLv=cw.levels.length-1;
if(S.dc.wpnLv>maxLv)S.dc.wpnLv=maxLv;
h+=`<div class="dc-wlv-row" style="margin-top:6px">`;
cw.levels.forEach((lv,i)=>h+=`<button class="dc-wlv-btn${i===S.dc.wpnLv?' active':''}" onclick="setDcWpnLv(${i})">Lv${lv.level}</button>`);
h+=`</div>`;
const ld=cw.levels[S.dc.wpnLv];
const effR=_dcGetEffectiveRange(cw);
const rangeChanged=effR.max_range!==cw.max_range;
const rangeStr=rangeChanged?`${effR.min_range}-<span style="color:#4ade80">${effR.max_range}</span>`:`${effR.min_range}-${effR.max_range}`;
const atkTypeIconsHtml=_dcWeaponAttackTypeIconsHtml(cw);
const attrHtml=_dcWeaponAttributeDisplayHtml(cw);
const exBadge=cw.is_ex?`<span style="margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(34,211,238,.15);color:var(--accent-cyan);font-size:10px;font-weight:700">EX</span>`:'';
const sheetPow=_dcWpnSheetFlatPower(cw,S.dc.wpnLv);
h+=`<div class="dc-wpn-info"><span>${t('dc_power')}: <span class="val" id="dcWpnSheetPow">${fmtN(sheetPow)}</span></span><span>${t('dc_range')}: <span class="val">${rangeStr}</span></span><span>${t('dc_accuracy')}: <span class="val">${ld.accuracy}%</span></span><span>${t('dc_critical')}: <span class="val">${ld.critical}%</span></span><span>${t('dc_en_cost')}: <span class="val">${ld.en}</span></span><span>${t('wp_type')}: <span class="val" style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px"><span class="dc-wpn-atk-icons">${atkTypeIconsHtml}</span>${attrHtml}</span>${exBadge}</span></div>`;
const wt=_dcParseWeaponTraits(cw,S.dc.wpnLv);
S.dc._wpnTraits=wt;
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const distBase=wt.distPowerMax|0;
const effDistMax=Math.min(100,distBase+(wt.distCoreMax|0));
const coreExtra=Math.max(0,effDistMax-distBase);
S.dc._wpnTraitDistPow=effDistMax;
const powHit=wt.powTraitHitSet;
const hasPowScaling=effDistMax>0||(wt.hpPowerMax|0)>0||(wt.mpPowerMax|0)>0;
if(hasPowScaling||wt.absoluteHit||wt.dmgReductionNull||(ld.traits&&ld.traits.length)||((cw.ssp_traits||[]).length)){
h+=`<div style="margin-top:8px;font-size:11px;line-height:1.55">`;
if(wt.absoluteHit)h+=`<div style="color:#4ade80">✓ Absolute Hit</div>`;
if(wt.dmgReductionNull)h+=`<div style="color:#4ade80">✓ Attribute Damage Reduction Null</div>`;
if(hasPowScaling){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:4px 0 2px">${esc(t('dc_wpn_trait_effects'))}</div>`;
if(distBase)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_dist'))}: +${distBase}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(coreExtra)h+=`<div style="color:#c084fc">${esc(t('dc_wpn_trait_custom_core'))}: +${coreExtra}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.hpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_hp'))}: +${wt.hpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.mpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_mp'))}: +${wt.mpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if((cw.ssp_traits||[]).length&&!_dcDcIncludeSspWeaponEffects())h+=`<div style="color:#eab308;margin-top:4px">${esc(t('dc_wpn_trait_ssp_hint'))}</div>`;
}
const trLines=(arr,prefix)=>{(arr||[]).forEach(tr=>{const s=String(tr||'').trim();if(!s)return;const hi=powHit&&powHit.has(s);const cls=hi?'dc-wpn-trait-line dc-wpn-trait-line--pow':'dc-wpn-trait-line';const pre=prefix?`<span style="display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:rgba(192,132,252,.25);font-size:9px;font-weight:800;color:#e9d5ff">SSP</span>`:'';h+=`<div class="${cls}">${pre}${esc(s)}</div>`;});};
if((ld.traits&&ld.traits.length)||(_dcDcIncludeSspWeaponEffects()&&(cw.ssp_traits||[]).length)){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:8px 0 2px">${esc(t('dc_wpn_trait_lines'))}</div>`;
trLines(ld.traits,false);
if(_dcDcIncludeSspWeaponEffects())trLines(cw.ssp_traits,true);
}
h+=`</div>`;
}
}else if(cw){
S.dc.wpnLv=0;
const ld=_dcWeaponLevelRow(cw,0);
const effR=_dcGetEffectiveRange(cw);
const rangeChanged=effR.max_range!==cw.max_range;
const rangeStr=rangeChanged?`${effR.min_range}-<span style="color:#4ade80">${effR.max_range}</span>`:`${effR.min_range}-${effR.max_range}`;
const atkTypeIconsHtml=_dcWeaponAttackTypeIconsHtml(cw);
const attrHtml=_dcWeaponAttributeDisplayHtml(cw);
const exBadge=cw.is_ex?`<span style="margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(34,211,238,.15);color:var(--accent-cyan);font-size:10px;font-weight:700">EX</span>`:'';
const sheetPow=_dcWpnSheetFlatPower(cw,0);
h+=`<div class="dc-wpn-info"><span>${t('dc_power')}: <span class="val" id="dcWpnSheetPow">${fmtN(sheetPow)}</span></span><span>${t('dc_range')}: <span class="val">${rangeStr}</span></span><span>${t('dc_accuracy')}: <span class="val">${ld.accuracy}%</span></span><span>${t('dc_critical')}: <span class="val">${ld.critical}%</span></span><span>${t('dc_en_cost')}: <span class="val">${ld.en}</span></span><span>${t('wp_type')}: <span class="val" style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px"><span class="dc-wpn-atk-icons">${atkTypeIconsHtml}</span>${attrHtml}</span>${exBadge}</span></div>`;
const wt=_dcParseWeaponTraits(cw,0);
S.dc._wpnTraits=wt;
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const distBase=wt.distPowerMax|0;
const effDistMax=Math.min(100,distBase+(wt.distCoreMax|0));
S.dc._wpnTraitDistPow=effDistMax;
const powHit=wt.powTraitHitSet;
const hasPowScaling=effDistMax>0||(wt.hpPowerMax|0)>0||(wt.mpPowerMax|0)>0;
if(hasPowScaling||wt.absoluteHit||wt.dmgReductionNull||(ld.traits&&ld.traits.length)||((cw.ssp_traits||[]).length)){
h+=`<div style="margin-top:8px;font-size:11px;line-height:1.55">`;
if(wt.absoluteHit)h+=`<div style="color:#4ade80">✓ Absolute Hit</div>`;
if(wt.dmgReductionNull)h+=`<div style="color:#4ade80">✓ Attribute Damage Reduction Null</div>`;
if(hasPowScaling){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:4px 0 2px">${esc(t('dc_wpn_trait_effects'))}</div>`;
if(distBase)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_dist'))}: +${distBase}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
const coreExtra2=Math.max(0,effDistMax-distBase);
if(coreExtra2)h+=`<div style="color:#c084fc">${esc(t('dc_wpn_trait_custom_core'))}: +${coreExtra2}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.hpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_hp'))}: +${wt.hpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.mpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_mp'))}: +${wt.mpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if((cw.ssp_traits||[]).length&&!_dcDcIncludeSspWeaponEffects())h+=`<div style="color:#eab308;margin-top:4px">${esc(t('dc_wpn_trait_ssp_hint'))}</div>`;
}
const trLines2=(arr,prefix)=>{(arr||[]).forEach(tr=>{const s=String(tr||'').trim();if(!s)return;const hi=powHit&&powHit.has(s);const cls=hi?'dc-wpn-trait-line dc-wpn-trait-line--pow':'dc-wpn-trait-line';const pre=prefix?`<span style="display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:rgba(192,132,252,.25);font-size:9px;font-weight:800;color:#e9d5ff">SSP</span>`:'';h+=`<div class="${cls}">${pre}${esc(s)}</div>`;});};
if((ld.traits&&ld.traits.length)||(_dcDcIncludeSspWeaponEffects()&&(cw.ssp_traits||[]).length)){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:8px 0 2px">${esc(t('dc_wpn_trait_lines'))}</div>`;
trLines2(ld.traits,false);
if(_dcDcIncludeSspWeaponEffects())trLines2(cw.ssp_traits,true);
}
h+=`</div>`;
}
}
wa.innerHTML=h;
_dcRefreshTotalDebuffsDisplay();
_dcRefreshFinalWpnPowPlaceholder();
if(!S.dc.atkCharData||S.dc.atkCharData._manual){
const ci=document.getElementById('dcCritDmgUp');
if(ci){ci.value=String(S.dc._wpnCritDmgUp|0);onDcParamChange();}
}
}
function _dcApplyWpnTraitPow(){
const ud=S.dc.atkUnitData;const wpns=ud?_dcNonMapWeapons(ud):[];const w=wpns[S.dc.wpnIdx];
if(w){const wt=_dcParseWeaponTraits(w,S.dc.wpnLv);S.dc._wpnTraitDistPow=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0))}
onDcParamChange();
}

function renderDcNpcDropdown(){
const sel=document.getElementById('dcNpcSelect');
const list=S.dc.npcList||[];
if(!list.length){sel.innerHTML=`<option value="">${t('dc_select_npc')}</option>`;return}
sel.innerHTML=`<option value="">${t('dc_select_npc')}</option>`+list.map((n,i)=>{
const name=n.unit?.name||n.character?.name||`NPC ${n.npc_id}`;
const vid=n.npc_id!=null&&String(n.npc_id)!==''?String(n.npc_id):String(i);
return`<option value="${esc(vid)}">${esc(name)}</option>`
}).join('');
}

function selectDcNpc(){
if((S.dc.defTargetMode||'preset')!=='preset')return;
const sel=document.getElementById('dcNpcSelect');
const raw=String(sel.value||'');
const list=S.dc.npcList||[];
if(raw===''){S.dc.defNpc=null}
else{
let def=list.find(n=>String(n.npc_id)===raw);
if(!def){const i=parseInt(raw,10);if(!Number.isNaN(i)&&i>=0&&i<list.length)def=list[i]}
S.dc.defNpc=def||null;
if(S.dc.defNpc&&S.dc.defNpc.npc_id!=null&&String(S.dc.defNpc.npc_id)!==''){
const want=String(S.dc.defNpc.npc_id);
for(let j=0;j<sel.options.length;j++){if(sel.options[j].value===want){sel.selectedIndex=j;break}}
}
}
renderDcDefStats();onDcParamChange();
}

/** Weapon / manual “enemy DEF % down on this attack”: subtract floor(baseDef×p/100) from the defender’s **total** MS DEF, where baseDef is pre–map/team bonus (NPC) or pre–trait-bonus slice (database: stats total − bonus_amounts). In-game does not apply p% to buffed total — doing so inflated damage. */
function _dcApplyEnemyDefDebuffToDefenderUnitDef(defUnit,pct,effectiveTotalOpt){
const F=Math.floor,MX=Math.max,MN=Math.min;
const tRaw=MX(0,Number(defUnit&&defUnit.stats_raw&&defUnit.stats_raw.Defense)||0);
const bon=MX(0,Number(defUnit&&defUnit.bonus_amounts&&defUnit.bonus_amounts.Defense)||0);
const base=MX(0,tRaw-bon);
const p=MX(0,MN(100,parseInt(pct,10)||0));
const tot=MX(0,effectiveTotalOpt!=null?Number(effectiveTotalOpt):tRaw);
if(p<=0)return tot;
if(tot<=0)return 0;
const reduc=base>0?F((base*p)/100):0;
return MX(0,tot-reduc);
}
/** qub +1: when enabled, DEF debuff > 35% uses nominal weapon power + 1 (unless final power override). Disabled pending re-audit; set `DC_QUB_PLUS_ONE` true to restore. */
const DC_QUB_PLUS_ONE=false;
/** Firered sheet: unitStatRatio = RoundUp((UnAtk/10)−(UnDef/10))/5000. Set false to use legacy floor−floor tenths (older Qubeley gold). */
const DC_SHEET_UNIT_STAT_RATIO=true;
/** In-game super for some totalCritMult=125% hits (e.g. Exia vs Throne) matches ceil((combined−trim)×1.3) with trim=floor(max(0,B−W)/1181), only when ⑧ is high enough; avoids changing older BD rows that still use trim=0. */
const DC_CRIT125_TRIM_MIN_BATTLE_DAMAGE=356500;
const DC_CRIT125_TRIM_DIV=1181;
function _dcCombatWeaponPowerNominal(nominalPow,defDebuffPct,hasFinalOverride){
const n=Number(nominalPow)||0;
const p=parseInt(defDebuffPct,10)||0;
if(hasFinalOverride||p<=35||!DC_QUB_PLUS_ONE)return n;
return n+1;
}
function _dcDefEternalStatCard(statKey,val,bonus,ctx){
const b=bonus>0?Number(bonus):0;
const hl=b>0?'has-bonus-val':'';
const cardCls='stat-card'+(b>0?' has-cond-bonus':'');
const bon=b>0?`<div class="stat-card-bonus" style="font-size:12px;color:var(--accent-green);margin-top:2px;">(+${fmtN(b)})</div>`:'';
return`<div class="${cardCls}"><div class="stat-card-label">${esc(tStat(statKey,ctx))}</div><div class="stat-card-value ${hl}">${fmtN(val)}</div>${bon}</div>`;
}
function _dcDefStatMiniHtml(label,val,bonus){
const b=bonus>0?Number(bonus):0;
const bonLn=b>0?`<div style="font-size:10px;color:#4ade80;font-weight:600;margin-top:2px;line-height:1.2">(+${fmtN(b)})</div>`:'';
const vCls=b>0?' dc-stat-val--buffed':'';
const boxCls=b>0?' dc-def-mini--map-bonus':'';
return`<div class="dc-stat-mini${boxCls}"><div class="dc-stat-mini-label">${label}</div><div class="dc-stat-mini-val"><span class="dc-def-stat-num${vCls}">${fmtN(val)}</span>${bonLn}</div></div>`;
}
function renderDcDefStats(){
const uArea=document.getElementById('dcDefUnitArea');
const cArea=document.getElementById('dcDefCharArea');
const sArea=document.getElementById('dcDefStatsArea');
const dbMode=(S.dc.defTargetMode||'preset')==='database';
if(uArea)uArea.style.display=dbMode?'none':'';
if(cArea)cArea.style.display=dbMode?'none':'';
const n=S.dc.defNpc;
if(!n){
if(uArea)uArea.innerHTML='';
if(cArea)cArea.innerHTML='';
sArea.innerHTML='';
return;
}
const u=n.unit,ch=n.character;
if(uArea){
if(dbMode)uArea.innerHTML='';
else if(u){
uArea.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(u.portrait||u.thum||'')}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(u.name||'NPC')}</div><div class="dc-picked-badges">${u.rarity_icon?`<img src="${imgUrl(u.rarity_icon)}">`:''}${u.role_icon?`<img src="${imgUrl(u.role_icon)}">`:''}</div></div></div>`;
}else uArea.innerHTML='';
}
if(cArea){
if(dbMode)cArea.innerHTML='';
else if(ch){
const cThum=ch.portrait||ch.thum||'';
cArea.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(cThum)}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ch.name||'NPC')}</div></div></div>`;
}else cArea.innerHTML='';
}
let h='';
if(u){
const {stats:us,bonuses:ub}=_dcDefNpcUnitMapStatsPair(u);
const defTotal=us.Defense||0;
const defBon=ub.Defense||0;
const defPair={val:defTotal,bonusLine:Math.max(0,Number(defBon)||0)};
const manualDeb=parseInt(document.getElementById('dcDefDebuffPct')?.value,10)||0;
const atkUd=S.dc.atkUnitData;
const atkWpns=atkUd?_dcNonMapWeapons(atkUd):[];
const atkW=atkWpns[S.dc.wpnIdx];
const wDeb=atkW?_dcWeaponEnemyDefDebuffEffective(atkW,S.dc.wpnLv):0;
const defDeb=Math.min(100,manualDeb+wDeb);
let defCardEternal='';
if(defDeb>0){
const defBefore=defPair.val;
const defAfter=_dcApplyEnemyDefDebuffToDefenderUnitDef(u,defDeb,defBefore);
const defBonHtml=defPair.bonusLine>0?`<div class="stat-card-bonus" style="font-size:12px;color:var(--accent-green);margin-top:2px;">(+${fmtN(defPair.bonusLine)})</div>`:'';
const debSub=(manualDeb>0&&wDeb>0)?`<span style="font-size:9px;color:var(--text-muted);display:block;margin-top:4px;line-height:1.25">${manualDeb}% field + ${wDeb}% weapon</span>`:'';
defCardEternal=`<div class="stat-card has-cond-bonus"><div class="stat-card-label">${esc(tStat('Defense','unit'))}</div><div class="stat-card-value has-bonus-val" style="display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;max-width:100%"><span>${fmtN(defBefore)}</span>${defBonHtml}<span style="color:#f87171;font-weight:800;font-size:15px">→ ${fmtN(defAfter)}</span><span style="font-size:10px;color:#f87171;font-weight:600">(${defDeb}% DEF debuff)</span>${debSub}</div></div>`;
}
const unitOrder=['HP','EN','Attack','Defense','Mobility','Move'];
let unitGrid='';
for(const s of unitOrder){
if(s==='Defense'&&defDeb>0){unitGrid+=defCardEternal;continue}
const pr={val:us[s]||0,bonusLine:Math.max(0,Number(ub[s])||0)};
unitGrid+=_dcDefEternalStatCard(s,pr.val,pr.bonusLine,'unit');
}
h+=`<div class="dc-section-label" style="color:#f87171;font-size:12px;font-weight:600">${t('dc_defender_status')}</div><div style="font-size:10px;color:var(--text-muted);margin:-2px 0 6px;line-height:1.35">${t('dc_def_stats_map_note')}</div><div class="stats-grid dc-def-ers">${unitGrid}</div>`;
}
if(ch){
const cs=ch.stats_raw||{},cb=ch.bonus_amounts||{};
const charOrder=['Ranged','Melee','Defense','Reaction','Awaken'];
let charGrid='';
for(const s of charOrder){
const pr={val:cs[s]||0,bonusLine:Math.max(0,Number(cb[s])||0)};
charGrid+=_dcDefEternalStatCard(s,pr.val,pr.bonusLine,'character');
}
h+=`<div class="dc-section-label" style="margin-top:8px">${t('dc_char_stats')}</div><div style="font-size:10px;color:var(--text-muted);margin:-2px 0 6px;line-height:1.35">${t('dc_def_char_stats_note')}</div><div class="stats-grid dc-def-ers">${charGrid}</div>`;
}
sArea.innerHTML=h;
}

function renderDcOptionParts(){
const area=document.getElementById('dcAtkOptionArea');
if(!S.dc.atkUnit){area.innerHTML='<div style="font-size:11px;color:var(--text-muted)">Select an attacker unit first.</div>';return}
if(!S.dc.optionParts.length){
area.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('option_parts')">Select option part</button>`;
return;
}
const o=S.dc.optionParts[0];
const thumHtml=o.thum?`<img class="dc-thum dc-dc-mod-thumb" src="${imgUrl(o.thum)}" alt="" onerror="this.style.display='none'">`:'';
const optTagLine=o.tags&&o.tags.length?`<div class="detail-tags-row" style="margin-top:4px;flex-wrap:wrap;">${o.tags.map(tg=>createTagHtml(tg,{defaultTarget:'unit'})).join('')}</div>`:'';
const rmTitle=escAttr(t('tb_op_clear'));
const trashSrc=imgUrlWebp(TB_TRASH_ICON);
area.innerHTML=`<div class="dc-option-item dc-option-item--layout"><div class="dc-option-item-main">${thumHtml}<div class="dc-option-item-text" style="font-size:12px"><strong>${esc(o.name)}</strong>${optTagLine}${o.details?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(o.details)}</div>`:''}</div><div class="dc-option-item-actions"><button type="button" class="dc-picked-change" onclick="openDcPicker('option_parts')">${esc(t('dc_change'))}</button><button type="button" class="remove dc-op-remove-btn" onclick="removeDcOptionPart(0)" title="${rmTitle}" aria-label="${rmTitle}"><img src="${trashSrc}" alt="" loading="lazy" decoding="async"></button></div></div></div>`;
}
function renderDcSupporters(){
const area=document.getElementById('dcAtkSupporterArea');
if(!S.dc.atkUnit){area.innerHTML='<div style="font-size:11px;color:var(--text-muted)">Select an attacker unit first.</div>';return}
if(!S.dc.supporters.length){
area.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('supporter')">Select supporter</button>`;
return;
}
const s=S.dc.supporters[0];const i=0;
const lvl=s._dcLevel||100;const lbt=s._dcLbTier!==undefined?s._dcLbTier:3;
const thumHtml=(s.portrait||s.thum)?`<img class="dc-thum dc-dc-mod-thumb" src="${imgUrl(s.portrait||s.thum)}" alt="" onerror="this.style.display='none'">`:'';
const lsHtml=(s.leader_skills||[]).map(ls=>{
const desc=ls.desc||'';
const tags=(ls.tags||[]).map(tg=>tg.name||'').filter(Boolean);
const sep=ls.separator==='and'?' & ':' / ';
const tagStr=tags.length?tags.join(sep):'';
return`<div style="font-size:11px;margin-top:2px">
${tagStr?`<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:rgba(251,191,36,.15);color:#fbbf24;font-size:10px;margin-bottom:2px">${esc(tagStr)}</span><br>`:''}
<span style="color:var(--text-muted)">${esc(desc)}</span></div>`;
}).join('');
const rmTitle=escAttr(t('tb_clear_supporter')||t('tb_op_clear')||'Clear');
const trashSrc=imgUrlWebp(TB_TRASH_ICON);
area.innerHTML=`<div class="dc-supporter-item dc-supporter-item--layout">
<div class="dc-supporter-item-main">${thumHtml}<div class="dc-supporter-item-text" style="font-size:12px"><strong>${esc(s.name)}</strong> <span style="color:var(--text-muted);font-size:11px">(${esc(s.rarity||'')})</span></div><div class="dc-supporter-item-actions"><button type="button" class="dc-picked-change" onclick="openDcPicker('supporter')">${esc(t('dc_change'))}</button><button type="button" class="dc-supp-remove-btn" onclick="removeDcSupporter(0)" title="${rmTitle}" aria-label="${rmTitle}"><img src="${trashSrc}" alt="" loading="lazy" decoding="async"></button></div></div>
${lsHtml}
<div class="dc-supporter-ctrl-row">
<span style="font-size:11px;color:var(--text-muted)">Lv</span><input type="number" class="dc-input-sm dc-supporter-lv-input" value="${lvl}" min="1" max="100" onchange="updateDcSupporterLv(0,this.value)">
<div class="lb-btn-group dc-supporter-lb-group">${[0,1,2,3].map(t=>{const p=cmpLbPipsAtTier(t);return`<button type="button" class="lb-icon-btn${t===lbt?' active':''}" onclick="updateDcSupporterLb(0,${t})" title="${t}">${cmpLbPipsRow(p[0],p[1],p[2])}</button>`;}).join('')}</div>
</div>
<div style="font-size:11px;color:var(--accent-cyan);margin-top:2px">HP+${fmtN(s.hp_support||0)} ATK+${fmtN(s.atk_support||0)}</div>
</div>`;
}
async function _dcFetchAllListRows(base,extra,listQ){
const qv=listQ!==undefined&&listQ!==null?String(listQ):'';
const rows=[];let page=1;let totalPages=1;
do{
const r=await fetch(`${base}?lang=${S.lang}&page=${page}&per_page=100&sort=rarity&dir=desc&q=${encodeURIComponent(qv)}&${extra}`);
const d=await r.json();
rows.push(...(d.rows||[]));
totalPages=d.total_pages||1;
page++;
}while(page<=totalPages);
return rows;
}
function _dcOptionPartUnitQuery(){
if(!S.dc.atkUnit)return'';
return'&unit_id='+encodeURIComponent(S.dc.atkUnit);
}
function _dcSupporterUnitCharQuery(){
let q=_dcOptionPartUnitQuery();
if(S.dc.atkChar)q+='&character_id='+encodeURIComponent(S.dc.atkChar);
return q;
}
/** Context for supporter leader trait checks (SameGroup / lineage) — pass current DC attacker unit & pilot. */
function _dcForSupporterContextQuery(){
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData;
let q='';
if(ud&&!ud._manual&&ud.id)q+='&for_unit_id='+encodeURIComponent(String(ud.id));
if(cd&&!cd._manual&&cd.id)q+='&for_char_id='+encodeURIComponent(String(cd.id));
return q;
}
async function selectDcOptionPart(id){
let row=(S._dcPickerFullCache||[]).find(x=>String(x.id)===String(id));
if(row&&(!row.details||!String(row.details).trim())){
try{
const uq=_dcOptionPartUnitQuery();
const r=await fetch(`/api/option_parts?lang=${S.lang}&page=1&per_page=100&q=${encodeURIComponent(id)}${uq}`);
const d=await r.json();
const hit=(d.rows||[]).find(x=>String(x.id)===String(id));
if(hit)row=hit;
}catch(e){}
}
if(row){
const _opSlot=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
if(_dcOptionPartRowIsSsr(row)&&_dcDcOptionPartSsrDeniedForSlot(row.id,_opSlot))return;
S.dc.optionParts=[{id:row.id,name:row.name,details:row.details||'',thum:row.thum||'',tags:row.tags||[]}];renderDcOptionParts();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()
}
}
async function selectDcSupporter(id){
try{
const cq=_dcForSupporterContextQuery();
const rd=await fetch(`/api/supporter/${id}?lang=${S.lang}&level=100&lb_tier=3${cq}`).then(r=>r.json());
if(rd&&!rd.error){rd._dcLevel=100;rd._dcLbTier=3;S.dc.supporters=[rd];renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}
}catch(e){}
}
async function updateDcSupporterLv(idx,val){
const s=S.dc.supporters[idx];if(!s)return;
const lv=Math.min(100,Math.max(1,parseInt(val)||100));
const lb=s._dcLbTier!==undefined?s._dcLbTier:3;
try{const r=await fetch(`/api/supporter/${s.id}?lang=${S.lang}&level=${lv}&lb_tier=${lb}${_dcForSupporterContextQuery()}`);const d=await r.json();if(d&&!d.error){Object.assign(s,d);s._dcLevel=lv;s._dcLbTier=lb;renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}}catch(e){}
}
async function updateDcSupporterLb(idx,tier){
const s=S.dc.supporters[idx];if(!s)return;
const lv=s._dcLevel||100;
try{const r=await fetch(`/api/supporter/${s.id}?lang=${S.lang}&level=${lv}&lb_tier=${tier}${_dcForSupporterContextQuery()}`);const d=await r.json();if(d&&!d.error){Object.assign(s,d);s._dcLevel=lv;s._dcLbTier=tier;renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}}catch(e){}
}
function removeDcOptionPart(i){S.dc.optionParts.splice(i,1);renderDcOptionParts();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}
function removeDcSupporter(i){S.dc.supporters.splice(i,1);renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}
function setDcLbTier(tier){S.dc.lbTier=tier;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcWeapon(idx){
const ud=S.dc.atkUnitData;const wpns=ud?_dcNonMapWeapons(ud):[];
const w=wpns[idx];
S.dc.wpnIdx=idx;S.dc.wpnLv=w?_dcDefaultWpnLvIndex(w):0;
const wt=w?_dcParseWeaponTraits(w,S.dc.wpnLv):{};
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const effD=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0));
S.dc._wpnTraitDistPow=effD>0?effD:0;
S.dc._wpnTraitHpPow=0;
renderDcWeaponArea();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(false);
else onDcParamChange();
}
function setDcWpnLv(lv){
S.dc.wpnLv=lv;
const ud=S.dc.atkUnitData;const wpns=ud?_dcNonMapWeapons(ud):[];const w=wpns[S.dc.wpnIdx];
if(w){
const wt=_dcParseWeaponTraits(w,lv);
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const effD=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0));
S.dc._wpnTraitDistPow=effD>0?effD:0;
S.dc._wpnTraitHpPow=0;
}
renderDcWeaponArea();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(false);
else onDcParamChange();
}
function setDcMp(lv){
const prevKey=_dcGetUnitStatKey();
const prevUcp=!!S.dc.unitCondPassive;
S.dc.mpLevel=_dcNormMpLevel(lv);
_dcSyncUnitCondPassiveFromVigor();
const nk=S.dc.mpLevel;
document.querySelectorAll('#dcMpBtns .dc-ctrl-btn').forEach(b=>b.classList.toggle('active',b.dataset.mp===nk));
const newKey=_dcGetUnitStatKey();
if(S.dc.atkUnitData&&(newKey!==prevKey||!!S.dc.unitCondPassive!==prevUcp))renderDcAtkUnit();
if(S.dc.atkUnitData)renderDcWeaponArea();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(false);
else onDcParamChange();
}
function setDcDefend(v){
S.dc.defending=v;
document.getElementById('dcDefOff').classList.toggle('active',!v);
document.getElementById('dcDefOn').classList.toggle('active',v);
onDcParamChange();
}
function setDcShield(v){
S.dc.shield=v;
document.getElementById('dcShieldOff').classList.toggle('active',!v);
document.getElementById('dcShieldOn').classList.toggle('active',v);
onDcParamChange();
}
function toggleDcSquadCondFlatAdApply(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const bf=_dcCharShouldShowSquadCondUi(cd,ud)&&_dcSquadFlatAdSingleBinding(cd,ud);
const cb=document.getElementById('dcSquadCondFlatAdApply');
const inp=document.getElementById('dcSquadCondPct');
if(!bf||!cb||!inp)return;
const cap=_dcSquadCondInputCap(cd,ud);


if(cb.checked){
const phen=_dcPhenexUniqueSquadFlatAdBinding(cd,ud);
const v=phen?(phen.flatPct|0):Math.max(0,cap|0);
inp.value=String(v);S.dc.squadCondPct=v;}else{S.dc.squadCondPct=0;inp.value='0'}
onDcParamChange();
}
function setDcSupportCounterAtk(v){
S.dc.supportCounterAtk=!!v;
const off=document.getElementById('dcAtkSupportCounterOff');
const on=document.getElementById('dcAtkSupportCounterOn');
if(off)off.classList.toggle('active',!v);
if(on)on.classList.toggle('active',!!v);
onDcParamChange();
}
function onDcParamChange(){
const fwpEl=document.getElementById('dcFinalWpnPow');
const fwpRaw=fwpEl&&String(fwpEl.value).trim()!==''?parseInt(fwpEl.value,10):NaN;
S.dc.finalWpnPow=Number.isFinite(fwpRaw)&&fwpRaw>0?fwpRaw:0;
S.dc.dmgIncrease=parseInt(document.getElementById('dcDmgIncrease')?.value)||0;
S.dc.critDmgUp=parseInt(document.getElementById('dcCritDmgUp')?.value)||0;
{let v=0;let exZ=false;if(_dcCharHasExSquadSynergyAbility(S.dc.atkCharData,S.dc.atkUnitData)){const el=document.getElementById('dcExSquadAtkPct');const rawStr=el?String(el.value).trim():'';if(rawStr==='0'){v=0;exZ=true}else if(rawStr!==''){const raw=parseInt(rawStr,10);v=Number.isFinite(raw)?Math.min(20,Math.max(0,raw)):0}else if(_scIsQubeleyExCombo(S.dc.atkCharData,S.dc.atkUnitData))v=20;else v=0}S.dc.exSquadAtkPct=v;S.dc.exSquadAtkPctExplicitZero=exZ;const el=document.getElementById('dcExSquadAtkPct');if(el&&String(el.value).trim()===''&&v>0)el.value=String(v)}
const _prevScEffAtk=S.dc.squadCondAtkPct|0,_prevScEffDef=S.dc.squadCondDefPct|0;
{const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;const el=document.getElementById('dcSquadCondPct');
const bfBind=_dcCharShouldShowSquadCondUi(cd,ud)&&_dcSquadFlatAdSingleBinding(cd,ud);
const flatCb=document.getElementById('dcSquadCondFlatAdApply');


if(ud&&!ud._manual&&cd&&!cd._manual&&el){
let rawPct=0;const rawStr=String(el.value).trim();


if(rawStr!==''){const rx=parseInt(rawStr,10);if(Number.isFinite(rx))rawPct=Math.max(0,rx)}
if(bfBind&&flatCb&&!flatCb.checked)rawPct=0;
S.dc.squadCondPct=rawPct;
}else S.dc.squadCondPct=0}
_dcSyncSquadCondEffectiveFromState();
{const c=document.getElementById('dcDefNpcMapBonusesOn');if(c)S.dc.defNpcMapBonusesOn=!!c.checked}
const _sqPanelChg=_prevScEffAtk!==(S.dc.squadCondAtkPct|0)||_prevScEffDef!==(S.dc.squadCondDefPct|0);
{const c=document.getElementById('dcAtkCounterOwnAtk');if(c)S.dc.atkCounterOwnAtk=!!c.checked}
{const wSc=document.getElementById('dcAtkSupportCounterWrap');const off=document.getElementById('dcAtkSupportCounterOff');if(!wSc||wSc.style.display==='none'){S.dc.supportCounterAtk=false}else if(off)S.dc.supportCounterAtk=!off.classList.contains('active')}
{const wAdv=document.getElementById('dcAtkAdvantageEnemyTagWrap');const a=document.getElementById('dcAtkAdvantageEnemyTag');if(a&&wAdv&&wAdv.style.display!=='none')S.dc.applyAdvantageEnemyTag=!!a.checked}
_dcUpdateCounterOwnAtkUi();
_dcUpdateSupportCounterAtkUi();
_dcUpdateAdvantageEnemyTagUi();
S.dc.dmgTakenDownPilot=parseInt(document.getElementById('dcDmgTakenDownPilot')?.value)||0;
S.dc.dmgTakenDownUnit=parseInt(document.getElementById('dcDmgTakenDownUnit')?.value)||0;
S.dc.defDebuffPct=parseInt(document.getElementById('dcDefDebuffPct')?.value)||0;
S.dc.dtuBeam=parseInt(document.getElementById('dcDtuBeam')?.value)||0;
S.dc.dtuPhysical=parseInt(document.getElementById('dcDtuPhysical')?.value)||0;
S.dc.dtuSpecial=parseInt(document.getElementById('dcDtuSpecial')?.value)||0;
_dcRefreshTotalDebuffsDisplay();
if(S.dc.defNpc)renderDcDefStats();
_dcUpdateDefNpcMapBonusesToggleUi();
_dcRefreshCalcDependentUi();
if(S.dc.atkSlots&&Array.isArray(S.dc.atkSlots)&&S.dc.atkSlots.length){
const si=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
if(si<S.dc.atkSlots.length)S.dc.atkSlots[si]=_dcReadAttackerFromDc();
}
if(_sqPanelChg&&S.dc.atkUnitData&&!S.dc.atkUnitData._manual)renderDcAtkUnit();
else _dcRefreshDcUnitAtkExOnly();
renderDcResult();
}
function _dcRefreshAtkPanelsAfterMods(){
if(!S.dc.atkUnitData){onDcParamChange();return}
renderDcAtkUnit();
if(S.dc.atkCharData)renderDcAtkChar();
onDcParamChange();
}

let _dcPickerDebounce=null;
let _dcPickerSearchAbort=null;
let _dcPickerSearchGen=0;
async function openDcPicker(type){
clearTimeout(_dcPickerDebounce);_dcPickerDebounce=null;
if(_dcPickerSearchAbort){try{_dcPickerSearchAbort.abort()}catch(_){}_dcPickerSearchAbort=null}
_dcPickerSearchGen++;
S._dcPickerType=type;S._dcPickerCache=[];S._dcPickerFullCache=null;
const overlay=document.getElementById('dcPickerOverlay');
overlay.classList.add('active');
const inp=document.getElementById('dcPickerSearch');
const body=document.getElementById('dcPickerBody');
inp.value='';
if(type==='option_parts'||type==='supporter'){
inp.placeholder='Search by name or keyword…';
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Loading applicable items…</div>';
if(type==='option_parts'&&!S.dc.atkUnit){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Select an attacker unit first.</div>';setTimeout(()=>inp.focus(),50);return}
if(type==='supporter'&&!S.dc.atkUnit){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Select an attacker unit first.</div>';setTimeout(()=>inp.focus(),50);return}
try{
if(type==='option_parts'){
const _opAll=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL'+_dcOptionPartUnitQuery());
const _opSi=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
S._dcPickerFullCache=_opAll.filter(r=>!_dcOptionPartRowIsSsr(r)||!_dcDcOptionPartSsrDeniedForSlot(r.id,_opSi));
}else{
S._dcPickerFullCache=await _dcFetchAllListRows('/api/supporters','rarity=ALL'+_dcSupporterUnitCharQuery());
}
S._dcPickerCache=S._dcPickerFullCache||[];
}catch(e){S._dcPickerFullCache=[];S._dcPickerCache=[]}
if(!S._dcPickerCache.length){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">No applicable items.</div>'}else{renderDcPickerList()}
setTimeout(()=>inp.focus(),50);
return;
}
inp.placeholder=(type==='character'||type==='def_character')?'Type to search characters...':'Type to search units...';
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Type at least 2 characters to search</div>';
setTimeout(()=>inp.focus(),50);
}
function closeDcPicker(){
clearTimeout(_dcPickerDebounce);_dcPickerDebounce=null;
if(_dcPickerSearchAbort){try{_dcPickerSearchAbort.abort()}catch(_){}_dcPickerSearchAbort=null}
document.getElementById('dcPickerOverlay').classList.remove('active')}
function filterDcPicker(){
clearTimeout(_dcPickerDebounce);
_dcPickerDebounce=setTimeout(()=>{
_dcPickerDebounce=null;
const t=S._dcPickerType;
if(t==='option_parts'||t==='supporter')_dcFilterDcPickerClientSide();
else _dcDoPickerSearch();
},100);
}
function _dcFilterDcPickerClientSide(){
const qRaw=String(document.getElementById('dcPickerSearch').value||'').trim();
const pool=S._dcPickerFullCache||[];
const t=S._dcPickerType;
if(t==='supporter'&&qRaw){
void _dcSupporterPickerSearch(qRaw);
return;
}
_dcPickerSearchGen++;
const q=qRaw.toLowerCase();
let rows=!q?pool:pool.filter(r=>{
const hay=[r.name,r.details,r.boost,(r.tags||[]).map(tg=>tg.name||'').join(' ')].filter(Boolean).join(' ').toLowerCase();
return hay.includes(q);
});
S._dcPickerCache=rows;
renderDcPickerList();
}
async function _dcSupporterPickerSearch(qRaw){
const myGen=++_dcPickerSearchGen;
const body=document.getElementById('dcPickerBody');
if(body)body.innerHTML='<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:12px">Searching...</div>';
try{
const rows=await _dcFetchAllListRows('/api/supporters','rarity=ALL'+_dcSupporterUnitCharQuery(),qRaw);
if(myGen!==_dcPickerSearchGen)return;
S._dcPickerCache=rows;
renderDcPickerList();
}catch(e){
if(myGen!==_dcPickerSearchGen)return;
if(body)body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">Search failed</div>';
}
}
async function _dcDoPickerSearch(){
const q=document.getElementById('dcPickerSearch').value.trim();
const body=document.getElementById('dcPickerBody');
const type=S._dcPickerType;
if(type==='option_parts'||type==='supporter'){_dcFilterDcPickerClientSide();return}
if(_dcPickerSearchAbort){try{_dcPickerSearchAbort.abort()}catch(_){}_dcPickerSearchAbort=null}
if(q.length<2){
_dcPickerSearchGen++;
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Type at least 2 characters to search</div>';
return
}
const ac=new AbortController();
_dcPickerSearchAbort=ac;
const myGen=++_dcPickerSearchGen;
const base=(type==='character'||type==='def_character')?'/api/characters':'/api/units';
body.innerHTML='<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:12px">Searching...</div>';
try{
const r=await fetch(`${base}?lang=${S.lang}&page=1&per_page=50&sort=rarity&dir=desc&q=${encodeURIComponent(q)}`,{signal:ac.signal});
const d=await r.json();
if(myGen!==_dcPickerSearchGen)return;
S._dcPickerCache=d.rows||[];
renderDcPickerList();
}catch(e){
if(e&&e.name==='AbortError')return;
if(myGen!==_dcPickerSearchGen)return;
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">Search failed</div>'}
}
function renderDcPickerList(){
const items=S._dcPickerCache;
const body=document.getElementById('dcPickerBody');
const type=S._dcPickerType;
if(!items.length){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">No results</div>';return}
const RARITY_COLORS={'UR':'#fbbf24','SSR':'#f97316','SR':'#a78bfa','R':'#60a5fa','N':'#94a3b8'};
if(type==='option_parts'||type==='supporter'){
body.innerHTML=items.map(r=>{
const rc=RARITY_COLORS[r.rarity]||'#94a3b8';
const meta=type==='option_parts'?((r.details||'').trim()+(r.tags&&r.tags.length?(' · '+r.tags.map(tg=>tg.name).filter(Boolean).join(' · ')):'')):((r.boost||'').split('\n')[0]||'');
return`<div class="cmp-picker-item" onclick='pickDcItem(${JSON.stringify(String(r.id))})' style="padding:8px 12px;cursor:pointer">
<div><div style="display:flex;align-items:center;gap:6px"><span style="color:${rc};font-weight:700;font-size:11px">${esc(r.rarity||'')}</span><span class="cmp-picker-item-name" style="font-size:13px">${esc(r.name)}</span></div>${meta?`<div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.35">${esc(meta)}</div>`:''}</div></div>`;
}).join('');
return;
}
body.innerHTML=items.map(r=>{
const rc=RARITY_COLORS[r.rarity]||'#94a3b8';
const rarBadge=`<span style="color:${rc};font-weight:600;font-size:11px;margin-right:4px">${esc(r.rarity||'')}</span>`;
const roleBadge=r.role?`<span style="color:var(--text-muted);font-size:11px">${esc(r.role)}</span>`:'';
return`<div class="cmp-picker-item" onclick='pickDcItem(${JSON.stringify(String(r.id))})' style="padding:8px 12px;cursor:pointer">
<div><div style="display:flex;align-items:center;gap:6px">${rarBadge}<span class="cmp-picker-item-name" style="font-size:13px">${esc(r.name)}</span>${roleBadge}</div></div></div>`
}).join('');
}

async function pickDcItem(id){
const type=S._dcPickerType;
closeDcPicker();
try{
if(type==='def_unit'){
const r=await fetch(`/api/unit/${encodeURIComponent(id)}?lang=${S.lang}`);const d=await r.json();
if(d.error)return;
S.dc.defUnitData=d;
const rec=d.recommend_character;const isSD=String(d.body_type||'')==='3';
if(rec&&rec.id){
if(isSD){
try{const cr=await fetch(`/api/character/${encodeURIComponent(rec.id)}?lang=${S.lang}`);const cd=await cr.json();if(!cd.error)S.dc.defCharData=cd}catch(_){}
}else if(!S.dc.defCharData){
try{const cr=await fetch(`/api/character/${encodeURIComponent(rec.id)}?lang=${S.lang}`);const cd=await cr.json();if(!cd.error)S.dc.defCharData=cd}catch(_){}
}
}
_dcSyncDefNpcFromDatabase();
return;
}
if(type==='def_character'){
const ud=S.dc.defUnitData;
if(ud&&String(ud.body_type||'')==='3')return;
const r=await fetch(`/api/character/${encodeURIComponent(id)}?lang=${S.lang}`);const d=await r.json();
if(d.error)return;
S.dc.defCharData=d;
_dcSyncDefNpcFromDatabase();
return;
}
if(type==='option_parts'){await selectDcOptionPart(id);return}
if(type==='supporter'){await selectDcSupporter(id);return}
const url=type==='character'?`/api/character/${encodeURIComponent(id)}?lang=${S.lang}`:`/api/unit/${encodeURIComponent(id)}?lang=${S.lang}`;
const r=await fetch(url);const d=await r.json();
if(type==='unit'){
S.dc.atkUnit=id;S.dc.atkUnitData=d;
const _bw=_dcPickBestWeaponIndices(d);
S.dc.wpnIdx=_bw.wpnIdx;S.dc.wpnLv=_bw.wpnLv;
S.dc.unitStatMode='normal';S.dc.unitCondPassive=false;S.dc.unitTurnBuffAtk=false;S.dc.unitTurnBuffDef=false;
S.dc.optionParts=[];S.dc.supporters=[];
_dcDetectVigorCondAbilities(d);
const rec=d.recommend_character;const isSD=d.body_type==='3';
S.dc._unitIsSD=isSD;
if(rec&&rec.id&&(!S.dc.atkCharData||S.dc.atkCharData.id!==rec.id)){
try{const cr=await fetch(`/api/character/${rec.id}?lang=${S.lang}`);const cd=await cr.json();
S.dc.atkChar=rec.id;S.dc.atkCharData=cd;S.dc.charStatMode='normal';S.dc.charCondPassive=false;S.dc.dcSuperchargedExTier=0;}catch(_){}
}
}else{
S.dc.atkChar=id;S.dc.atkCharData=d;S.dc.charStatMode='normal';S.dc.charCondPassive=false;S.dc.dcSuperchargedExTier=0;
S.dc.supporters=[];
}
_dcAutoSetVigor();
if(_dcCharShouldShowSquadCondUi(S.dc.atkCharData,S.dc.atkUnitData))S.dc.squadCondPct=_dcDefaultSquadCondPctForCdUd(S.dc.atkCharData,S.dc.atkUnitData);
else S.dc.squadCondPct=0;
renderDcAtkUnit();renderDcAtkChar();
renderDcOptionParts();renderDcSupporters();
_dcSyncAtkModeUiFromState();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
else onDcParamChange();
S.dc._dcAutoFitGen=(S.dc._dcAutoFitGen|0)+1;
const _dcAfGen=S.dc._dcAutoFitGen;
void dcAutoFitOptionPartAndSupporter(_dcAfGen).then(()=>{
if(_dcAfGen!==(S.dc._dcAutoFitGen|0))return;
renderDcAtkUnit();
if(S.dc.atkCharData)renderDcAtkChar();
renderDcOptionParts();
renderDcSupporters();
_dcSnapActiveAttackerToSlot();
_dcSyncAtkModeUiFromState();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
else onDcParamChange();
});
}catch(e){}
}

function _dcGetCharAtkStat(charStats,wpn){
const atkTypes=_dcWeaponAtkStatKeys(wpn);
const unique=[...new Set(atkTypes)];
if(unique.length===1)return _dcFindStat(charStats,unique[0]);
return Math.max(...unique.map(s=>_dcFindStat(charStats,s)));
}
/** Parse one skill description for Ranged/Melee/Awaken % (and ATK% to all three). Pair/triple lines do not short-circuit ATK% or extra single-stat sentences in the same text.
 * EN data often uses "by25%" (no space); JA/HK/TW use 自身射擊值提升25%（1回合） etc.
 * optMeta: optional { id, name } for Awaken Boost fallback (LV in name / trait id 200170[1-5]01) when description text is missing in some locales. */
function _dcParseSkillDescAtkPct(desc,optMeta){
const out={Ranged:0,Melee:0,Awaken:0};
const raw=[desc,optMeta&&optMeta.name||'',optMeta&&optMeta.id!=null?String(optMeta.id):''].filter(Boolean).join('\n');
if(!raw.trim())return out;
const s=String(raw);
const pairRe=/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s+and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%/gi;
let mp;
while((mp=pairRe.exec(s))!==null){const p=parseInt(mp[3],10)||0;out[mp[1]]+=p;out[mp[2]]+=p;}
const mTri=s.match(/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s*,\s*(Ranged|Melee|Awaken)\s+and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%/i);
if(mTri){const p=parseInt(mTri[4],10)||0;out[mTri[1]]+=p;out[mTri[2]]+=p;out[mTri[3]]+=p;}
const mTriOx=s.match(/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s*,\s*(Ranged|Melee|Awaken)\s*,\s*and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%/i);
if(mTriOx){const p=parseInt(mTriOx[4],10)||0;out[mTriOx[1]]+=p;out[mTriOx[2]]+=p;out[mTriOx[3]]+=p;}
const singleRe=/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s+by\s*(\d+)%/gi;
let mm;
while((mm=singleRe.exec(s))!==null){out[mm[1]]+=parseInt(mm[2],10)||0;}
const mAtk=s.match(/Increases?\s+(?:own\s+)?(?:ATK|Attack)\s+by\s*(\d+)%/i);
if(mAtk){const p=parseInt(mAtk[1],10)||0;out.Ranged+=p;out.Melee+=p;out.Awaken+=p;}
const zhMap={射擊值:'Ranged',格鬥值:'Melee',覺醒值:'Awaken'};
const zhComb=s.match(/自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%/);
if(zhComb){
const p=parseInt(zhComb[3],10)||0;
const k0=zhMap[zhComb[1]];if(k0)out[k0]+=p;
const rest=zhComb[2]||'';let zm;const zre=/及(射擊值|格鬥值|覺醒值)/g;
while((zm=zre.exec(rest))!==null){const kk=zhMap[zm[1]];if(kk)out[kk]+=p;}
}else{
const mR=s.match(/自身射擊值提升(\d+)%/);if(mR)out.Ranged+=parseInt(mR[1],10)||0;
const mM=s.match(/自身格鬥值提升(\d+)%/);if(mM)out.Melee+=parseInt(mM[1],10)||0;
const mA=s.match(/自身[覚覺]醒值提升(\d+)%/);if(mA)out.Awaken+=parseInt(mA[1],10)||0;
}
const jaMap={射撃値:'Ranged',格闘値:'Melee',覚醒値:'Awaken'};
const jaPilot=/自身の(射撃値|格闘値|覚醒値)が(\d+)(?:%|％)上昇/g;
let jm;
while((jm=jaPilot.exec(s))!==null){const kk=jaMap[jm[1]];if(kk)out[kk]+=parseInt(jm[2],10)||0;}
if(out.Awaken===0){
const lvFrom=(txt)=>{
let m=txt.match(/覚醒ブースト\s*LV\.?\s*(\d+)/i);if(m)return parseInt(m[1],10)||0;
m=txt.match(/Awaken\s+Boost\s*LV\.?\s*(\d+)/i);if(m)return parseInt(m[1],10)||0;
m=txt.match(/覺醒值增幅\s*LV\.?\s*(\d+)/i);if(m)return parseInt(m[1],10)||0;
return 0;
};
let lv=lvFrom(s);
if(lv>=1&&lv<=5)out.Awaken=lv*5;
}
if(out.Awaken===0&&optMeta&&optMeta.id!=null){
const sid=String(optMeta.id);
const idM=sid.match(/^200170([1-5])01$/);
if(idM){const lv=parseInt(idM[1],10);if(lv>=1&&lv<=5)out.Awaken=lv*5;}
}
return out;
}
function _dcGetActiveSkillStatPct(){
const out={Ranged:0,Melee:0,Awaken:0};
if(!S.dc._pilotSkills||!S.dc._activeSkills)return out;
S.dc._pilotSkills.forEach(sk=>{
if(!S.dc._activeSkills[sk.id])return;
const rsk=_dcResolveSkillForDcMode(sk);
const detailLines=(rsk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join(' ');
const desc=[detailLines,rsk.desc||'',rsk.sp_desc||''].filter(Boolean).join(' ');
const add=_dcParseSkillDescAtkPct(desc,{id:sk.id,name:rsk.name||sk.name||''});
out.Ranged+=add.Ranged;out.Melee+=add.Melee;out.Awaken+=add.Awaken;
});
return out;
}
function _dcGetCharAtkStatWithSkills(charStats,wpn){
const sk=_dcGetActiveSkillStatPct();
const atkTypes=_dcWeaponAtkStatKeys(wpn);
const unique=[...new Set(atkTypes)];
const val=(k)=>k==='Awaken'?_dcPilotAwakenAdjustedForDc(charStats,sk[k]||0):_dcPilotSkillAdjustedStat(charStats,k,sk[k]||0);
if(unique.length===1)return val(unique[0]);
return Math.max(...unique.map(val));
}
function _dcParseOptionPartBonuses(details){
const bonuses={HP:{flat:0,pct:0},EN:{flat:0,pct:0},Attack:{flat:0,pct:0},Defense:{flat:0,pct:0},Mobility:{flat:0,pct:0},Move:{flat:0,pct:0}};
if(!details)return bonuses;
const norm=String(details).replace(/\r\n/g,'\n').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
const statMap={ATK:'Attack',DEF:'Defense',MOB:'Mobility',MOV:'Move'};
const add=(k,v,isPct)=>{const key=k in statMap?statMap[k]:k;if(bonuses[key]){if(isPct)bonuses[key].pct+=v;else bonuses[key].flat+=v}};
const p=/(?:Increase|Increases?)\s+(?:squad\s+)?(?:own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)(?:\s*,\s*(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))*(?:\s+and\s+(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))?\s+by\s*(\d+)(%?)/gi;
let m;while((m=p.exec(norm))!==null){const val=parseInt(m[4],10)||0;const isPct=m[5]==='%';const keys=[m[1],m[2],m[3]].filter(Boolean);keys.forEach(k=>add(k,val,isPct))}
const incAnd=/\s+and\s+(?:increase|increases)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=incAnd.exec(norm))!==null){const val=parseInt(m[2],10)||0;const isPct=m[3]==='%';add(m[1],val,isPct)}
const dec=/(?:Decrease|Decreases|Reduce|Reduces|Lower|Lowers)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=dec.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%';add(m[1],val,isPct)}
const decPass=/\b(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+(?:is\s+)?(?:decreased|reduced|lowered)\s+by\s*(\d+)(%?)/gi;
while((m=decPass.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%';add(m[1],val,isPct)}
const decTail=/[;，、]\s*(?:but\s+)?(?:decrease|decreases|reduce|reduces|lower|lowers)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=decTail.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%';add(m[1],val,isPct)}
const statNegPct=/(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s*[:：]?\s*[-−](\d+)(%|％)/gi;
while((m=statNegPct.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%'||m[3]==='％';add(m[1],val,isPct)}
const incTail=/[;，、]\s*(?:and\s+)?(?:increase|increases)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=incTail.exec(norm))!==null){const val=parseInt(m[2],10)||0;const isPct=m[3]==='%';add(m[1],val,isPct)}
const jaStat='(最大HP|最大EN|攻撃力|防御力|機動力|移動力)';
const jaMap={最大HP:'HP',最大EN:'EN',攻撃力:'Attack',防御力:'Defense',機動力:'Mobility',移動力:'Move'};
const jaDual=new RegExp('(?:自部隊の|自身の)'+jaStat+'と'+jaStat+'が(\\d+)(%?)(上昇|減少)','g');
while((m=jaDual.exec(norm))!==null){const v=parseInt(m[3],10)||0;const isPct=m[4]==='%';const sign=m[5]==='減少'?-1:1;[m[1],m[2]].forEach(st=>{const k=jaMap[st];if(k)add(k,sign*v,isPct)})}
const jaSing=new RegExp('(?:自部隊の|自身の)'+jaStat+'が(\\d+)(%?)(上昇|減少)','g');
while((m=jaSing.exec(norm))!==null){const v=parseInt(m[2],10)||0;const isPct=m[3]==='%';const sign=m[4]==='減少'?-1:1;const k=jaMap[m[1]];if(k)add(k,sign*v,isPct)}
const twStat='(最大HP|最大EN|攻擊力|防禦力|機動力|移動力)';
const twMap={最大HP:'HP',最大EN:'EN',攻擊力:'Attack',防禦力:'Defense',機動力:'Mobility',移動力:'Move'};
const twDual=new RegExp('自身'+twStat+'及'+twStat+'(提升|減少)(\\d+)(%?)','g');
while((m=twDual.exec(norm))!==null){const sign=m[3]==='減少'?-1:1;const v=parseInt(m[4],10)||0;const isPct=m[5]==='%';[m[1],m[2]].forEach(st=>{const k=twMap[st];if(k)add(k,sign*v,isPct)})}
const twSing=new RegExp('(?:自身所屬部隊|自身)'+twStat+'(提升|減少)(\\d+)(%?)','g');
while((m=twSing.exec(norm))!==null){const sign=m[2]==='減少'?-1:1;const v=parseInt(m[3],10)||0;const isPct=m[4]==='%';const k=twMap[m[1]];if(k)add(k,sign*v,isPct)}
return bonuses;
}
function _dcLeaderPctFromLeaderSkillDesc(d){
const s=String(d||'').normalize('NFKC');
let m=s.match(/by\s+(\d+)\s*[%％]/i);
if(m)return parseInt(m[1],10)||0;
m=s.match(/(\d+)\s*[%％]\s*上昇/);
if(m)return parseInt(m[1],10)||0;
m=s.match(/全能力值(\d+)\s*[%％]/);
if(m)return parseInt(m[1],10)||0;
m=s.match(/能力值(\d+)\s*[%％]/);
if(m)return parseInt(m[1],10)||0;
return 0;
}
function _dcLeaderSkillPctAndFlags(supporters){
let pct=0;
(supporters||[]).forEach(s=>{
(s.leader_skills||[]).forEach(ls=>{
if(ls.applies===false)return;
const d=ls.desc||'';
const v=_dcLeaderPctFromLeaderSkillDesc(d);
if(v>0)pct+=v;
});
});
return{pct};
}
/** EX squad ATK % applies to the MS growth Attack line after option-part Attack % (if any), not raw LB alone — not MS ability Attack bonuses. Supporter leader % on Attack applies after EX on that growth line. */
function _dcApplyExSquadToUnitAtk(unitAtkFull,unitAtkExBase,exPct){
const F=Math.floor;
const p=Math.min(20,Math.max(0,exPct|0));
if(p<=0)return unitAtkFull;
const b=F(Math.max(0,Number(unitAtkExBase)||0));
const full=F(Math.max(0,Number(unitAtkFull)||0));
return F(b*(100+p)/100)+(full-b);
}
/** Supporter leader % on Attack applies after EX squad, to the EX-boosted growth line only. bGrowthForEx = growth after option-part Attack % (same value passed to EX). */
function _dcApplyLeaderPctToAttackAfterEx(unitAtkAfterEx,bGrowthForEx,exSq,leaderPct){
const F=Math.floor;
const lp=leaderPct|0;
if(lp<=0)return unitAtkAfterEx;
const ex=Math.min(20,Math.max(0,exSq|0));
const b=F(Math.max(0,Number(bGrowthForEx)||0));
const gEx=F(b*(100+ex)/100);
const aAtk=F(unitAtkAfterEx)-gEx;
return F(gEx*(100+lp)/100)+aAtk;
}
/** EX abilities that buff the paired MS (see pair_unit_stat_mod from API) — after EX squad and supporter leader on Attack, same as in-game. */
function _dcPilotPairUnitAtkDefPct(unitAtk,unitDefVal){
const F=Math.floor;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const pm=cd&&cd.pair_unit_stat_mod;
if(!pm||!ud||ud._manual)return{unitAtk,unitDefVal};
const uid=String(ud.id||'');
const row=pm[uid];
if(!row||!S.dc.charCondPassive)return{unitAtk,unitDefVal};
let a=unitAtk,d=unitDefVal;
if(row.atk_pct)a=F(a*(100+row.atk_pct)/100);
if(row.def_pct)d=F(d*(100+row.def_pct)/100);
return{unitAtk:a,unitDefVal:d};
}
function _dcGetCounterOwnAtkPct(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const pm=cd&&cd.pair_unit_counter_atk_mod;
if(!pm||!ud||ud._manual||!S.dc.charCondPassive||!S.dc.atkCounterOwnAtk)return 0;
const v=pm[String(ud.id)];
return Number.isFinite(v)?(v|0):0;
}
function _dcApplyCounterOwnAtkToUnitAtk(unitAtk){
const F=Math.floor;
const p=_dcGetCounterOwnAtkPct();
if(p<=0)return unitAtk;
return F(Math.max(0,Number(unitAtk)||0)*(100+p)/100);
}
function _dcNormalizeTagToken(s){
if(!s)return'';
return String(s).replace(/^\s*TAG:\s*/i,'').trim().toLowerCase();
}
function _dcNpcTagTokenSet(npc){
const out=new Set();
if(!npc)return out;
const addArr=(arr)=>{(arr||[]).forEach(t=>{if(t&&t.name){const n=_dcNormalizeTagToken(t.name);if(n)out.add(n)}})};
if(npc.unit)addArr(npc.unit.tags);
if(npc.character)addArr(npc.character.tags);
return out;
}
/** Defender has Psycommu tag — used to auto-enable Advantage (enemy tag) when the attacker has the ability. */
function _dcNpcDefHasPsycommuTag(npc){
if(!npc)return false;
for(const t of _dcNpcTagTokenSet(npc)){if(t.includes('psycommu'))return true}
return false;
}
function _dcCollectTargetTagRequirementNames(detail){
const names=[];
const pushC=(arr)=>{(arr||[]).forEach(c=>{if(c&&c.name)names.push(c.name)})};
let fromTarget=false;
if(detail.condition_groups){
for(const g of detail.condition_groups){
const lab=String(g.label||'');
if(/target\s*tags?/i.test(lab)){
fromTarget=true;
pushC(g.conditions);
}
}
}
if(!fromTarget||!names.length)pushC(detail.conditions);
return names;
}
function _dcTagRequirementMatches(requiredNames,defTokens){
if(!requiredNames||!requiredNames.length||!defTokens||!defTokens.size)return false;
for(const req of requiredNames){
const r=_dcNormalizeTagToken(req);
if(!r)continue;
for(const dt of defTokens){
if(dt===r||dt.includes(r)||r.includes(dt))return true;
}
}
return false;
}
function _dcUnitHasEnemyTagAdvantageAbility(ud){
if(!ud||ud._manual||!(ud.abilities||[]).length)return false;
for(const ab of ud.abilities){
for(const d of ab.details||[]){
const det=typeof d==='string'?{text:d,conditions:[],condition_groups:[]}:d;
if(!det||!det.text)continue;
if(!_dcIsEnemyTagAdvantageAtkDefLine(det.text))continue;
if((_dcExtractAdvantageAtkDefPct(det.text)|0)<=0)continue;
return true;
}
}
return false;
}
function _dcIsEnemyTagAdvantageAtkDefLine(txt){
const low=String(txt||'').toLowerCase();
if(low.includes('piloting'))return false;
if(!low.includes('specified tag'))return false;
if(!low.includes('enem')&&!low.includes('opponent'))return false;
return /increase own atk and def by \d+%/i.test(txt);
}
function _dcExtractAdvantageAtkDefPct(detailText){
const m=String(detailText||'').match(/Increase own ATK and DEF by (\d+)%/i);
if(m)return parseInt(m[1],10)||0;
const m2=String(detailText||'').match(/increase own ATK and DEF by (\d+)%/i);
if(m2)return parseInt(m2[1],10)||0;
return 0;
}
function _dcAbilityNameFallbackAdvantageTag(ab){
const m=String(ab.name||'').match(/Advantage:\s*(.+?)\s+LV\s*\d/i);
if(!m)return'';
return m[1].trim();
}
function _dcAdvantageTagAtkPctCore(ud,npc){
if(!ud||ud._manual||!npc)return 0;
const defTags=_dcNpcTagTokenSet(npc);
if(!defTags.size)return 0;
let total=0;
for(const ab of ud.abilities||[]){
for(const d of ab.details||[]){
const det=typeof d==='string'?{text:d,conditions:[],condition_groups:[]}:d;
if(!det||!det.text)continue;
const txt=det.text;
if(!_dcIsEnemyTagAdvantageAtkDefLine(txt))continue;
const pct=_dcExtractAdvantageAtkDefPct(txt);
if(pct<=0)continue;
let req=_dcCollectTargetTagRequirementNames(det);
if(!req.length){
const fb=_dcAbilityNameFallbackAdvantageTag(ab);
if(fb)req=[fb];
}
if(_dcTagRequirementMatches(req,defTags))total+=pct;
}
}
return Math.min(100,total);
}
function _dcAdvantageTagAtkPctFromAbilities(ud,npc){
if(S.dc.applyAdvantageEnemyTag===false)return 0;
return _dcAdvantageTagAtkPctCore(ud,npc);
}
function _dcApplyAutoAdvantageForPsycommuDefender(){
const ud=S.dc.atkUnitData,npc=S.dc.defNpc;
if(!ud||ud._manual||!npc||!_dcUnitHasEnemyTagAdvantageAbility(ud))return;
if(!_dcNpcDefHasPsycommuTag(npc))return;
if(_dcAdvantageTagAtkPctCore(ud,npc)<=0)return;
S.dc.applyAdvantageEnemyTag=true;
}
/** In-game Advantage: +floor(X% × reference), not +X% on total MS ATK. Reference = raw LB Attack base (column base before MS passive % / option / EX / leader / supporter — matches in-game vs inflated unitAtkExSquadBase). */
function _dcApplyAdvantageTagAtkToUnitAtk(unitAtk,advPct,rawGrowthAtk){
const F=Math.floor,p=advPct|0;
if(p<=0)return unitAtk;
const ua=F(Math.max(0,Number(unitAtk)||0));
const rg=F(Math.max(0,Number(rawGrowthAtk)||0));
return ua+F(rg*p/100);
}
function _dcJoinUnitSkillTextBlob(sk){
const lines=(sk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join('\n');
return[sk.name,lines].filter(Boolean).join('\n');
}
/** Scan unit skill text for short self-buffs like "Increase ATK by 25% [1 turn]" (EN/JP/TW-style). Max per stat across skills. */
function _dcParseUnitTurnStatBuffPercents(blob){
const s=String(blob||'');
const hasTurn=/\[\s*1\s*turns?\s*\]|(?:^|[\s\n])for\s+1\s+turn\b|1ターン|１ターン|1\s*回合/i.test(s);
if(!hasTurn)return{atk:0,def:0};
let atk=0,def=0;
const mAtk=s.match(/\b(?:Increase|Increases)\s+(?:MS\s+)?ATK\s+by\s+(\d+)%/i);
if(mAtk)atk=Math.max(atk,parseInt(mAtk[1],10)||0);
const mAtk2=s.match(/\b(?:Increase|Increases)\s+(?:MS\s+)?Attack\s+by\s+(\d+)%/i);
if(mAtk2)atk=Math.max(atk,parseInt(mAtk2[1],10)||0);
const mDef=s.match(/\b(?:Increase|Increases)\s+(?:MS\s+)?DEF(?:ense)?\s+by\s+(\d+)%/i);
if(mDef)def=Math.max(def,parseInt(mDef[1],10)||0);
const mj=s.match(/攻(?:擊|撃|击)力[^%]*?(\d+)\s*%/);
if(mj)atk=Math.max(atk,parseInt(mj[1],10)||0);
const dj=s.match(/防(?:禦|御|卫)力[^%]*?(\d+)\s*%/);
if(dj)def=Math.max(def,parseInt(dj[1],10)||0);
return{atk,def};
}
function _dcGetDetectedUnitTurnBuffPercents(ud){
const skills=(ud&&!ud._manual&&ud.skills)||[];
let atkPct=0,defPct=0;
skills.forEach(sk=>{
const x=_dcParseUnitTurnStatBuffPercents(_dcJoinUnitSkillTextBlob(sk));
atkPct=Math.max(atkPct,x.atk);
defPct=Math.max(defPct,x.def);
});
return{atkPct,defPct};
}
function _dcApplyUnitTurnBuffDefToMsDef(unitDef,ud){
const F=Math.floor;
if(!ud||ud._manual||!S.dc.unitTurnBuffDef)return unitDef;
const p=_dcGetDetectedUnitTurnBuffPercents(ud).defPct|0;
if(p<=0)return unitDef;
const d=F(Math.max(0,Number(unitDef)||0));
return d+F(d*p/100);
}
function _dcUpdateCounterOwnAtkUi(){
const w=document.getElementById('dcAtkCounterOwnAtkWrap');
const cb=document.getElementById('dcAtkCounterOwnAtk');
if(!w||!cb)return;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const pm=cd&&cd.pair_unit_counter_atk_mod;
const uid=ud&&!ud._manual?String(ud.id||''):'';
const pct=pm&&uid?pm[uid]:0;
const show=!!pct;
w.style.display=show?'':'none';
if(!show||!S.dc.charCondPassive){
cb.checked=false;
S.dc.atkCounterOwnAtk=false;
cb.disabled=true;
return;
}
cb.disabled=false;
}
function _dcUpdateSupportCounterAtkUi(){
const w=document.getElementById('dcAtkSupportCounterWrap');
const off=document.getElementById('dcAtkSupportCounterOff');
const on=document.getElementById('dcAtkSupportCounterOn');
const lbl=document.getElementById('dcAtkSupportCounterLbl');
if(!w||!off||!on)return;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const si=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
const snapMap=S.dc._supportCntAtkPairSnapBySlot=S.dc._supportCntAtkPairSnapBySlot||{};
const pilotOk=!!(cd&&!cd._manual&&_dcCharIsSupportRole(cd));
const rawPct=pilotOk?_dcParseMaxSupportCounterAtkPctFromChar(cd):0;
S.dc._supportCounterAtkPct=rawPct>0?rawPct:0;
const unitOk=!!(ud&&!ud._manual&&String(ud.role_id)==='3');
const cid=cd&&!cd._manual?String(cd.id||''):'';
if(!pilotOk||rawPct<=0){
w.style.display='none';
w.style.opacity='';
snapMap[si]=null;
S.dc.supportCounterAtk=false;
S.dc._supportCounterAtkPct=0;
off.classList.add('active');on.classList.remove('active');
off.disabled=true;on.disabled=true;
return;
}
w.style.display='';
if(!unitOk){
S.dc.supportCounterAtk=false;
snapMap[si]=null;
off.classList.add('active');on.classList.remove('active');
off.disabled=true;on.disabled=true;
w.style.opacity='0.55';
if(lbl){
lbl.textContent=`When executing Support Attack/Counter — +${rawPct}% MS ATK`;
lbl.title='This pilot\'s ATK boost applies only when piloting a Support-type (role) mobile suit. Pick a Support-class attacker unit to enable the bonus in damage math (turns On automatically when the pairing becomes eligible).';
}
return;
}
w.style.opacity='';
const kNow=`${cid}|${String(ud.id||'')}|${rawPct}`;
const prev=snapMap[si]!=null?String(snapMap[si]):null;
if(prev!==kNow)S.dc.supportCounterAtk=true;
snapMap[si]=kNow;
off.disabled=false;on.disabled=false;
if(lbl){
lbl.textContent=`When executing Support Attack/Counter — +${rawPct}% MS ATK`;
lbl.title='Support-type MS + this pilot: MS ATK % while executing Support Attack/Counter. Auto-On when you pair with a Support-role unit; turn Off to compare without the bonus.';
}
const onv=!!S.dc.supportCounterAtk;
off.classList.toggle('active',!onv);
on.classList.toggle('active',onv);
}
function _dcUpdateAdvantageEnemyTagUi(){
const w=document.getElementById('dcAtkAdvantageEnemyTagWrap');
const cb=document.getElementById('dcAtkAdvantageEnemyTag');
if(!w||!cb)return;
const ud=S.dc.atkUnitData;
const has=_dcUnitHasEnemyTagAdvantageAbility(ud);
if(!has){
w.style.display='none';
cb.checked=false;
S.dc.applyAdvantageEnemyTag=false;
cb.disabled=true;
return;
}
w.style.display='';
cb.disabled=false;
_dcApplyAutoAdvantageForPsycommuDefender();
cb.checked=S.dc.applyAdvantageEnemyTag!==false;
}
/** Green +lines under MS HP/ATK/DEF/MOB: % bucket uses floor to match database stat display; damage calc uses ceil separately via forDamage. */
function _dcMsStatEnhancementLinesHtml(ctx,atkUnitStats){
const F=Math.floor;
const c=ctx||{};
const mlPct=c.masterLeagueBuff?50:0;
const goPct=c.grandOffensiveBuff?100:0;
const sheetBuffPct=mlPct+goPct;
const opFlat={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
const opPct={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
(c.optionParts||[]).forEach(op=>{const b=_dcParseOptionPartBonuses(op.details);['Attack','HP','Defense','Mobility','Move'].forEach(k=>{opFlat[k]+=b[k].flat;opPct[k]+=b[k].pct})});
let hpSupport=0,atkSupport=0,leaderPct=0;
(c.supporters||[]).forEach(s=>{hpSupport+=Number(s.hp_support)||0;atkSupport+=Number(s.atk_support)||0});
leaderPct=_dcLeaderSkillPctAndFlags(c.supporters).pct;
const lp=leaderPct|0;
const atkEnt=_dcFindStatEntry(atkUnitStats,'Attack');
const defEnt=_dcFindStatEntry(atkUnitStats,'Defense');
const hpEnt=_dcFindStatEntry(atkUnitStats,'HP');
const mobEnt=_dcFindStatEntry(atkUnitStats,'Mobility');
const atkBase=F(Math.max(0,atkEnt?atkEnt.base:0));
const defBase=F(Math.max(0,defEnt?defEnt.base:0));
const hpBase=F(Math.max(0,hpEnt?hpEnt.base:0));
const mobBase=F(Math.max(0,mobEnt?mobEnt.base:0));
const pAtk=_dcStatPassivePctFromEntry(atkEnt);
const pDef=_dcStatPassivePctFromEntry(defEnt);
const pHp=_dcStatPassivePctFromEntry(hpEnt);
const pMob=_dcStatPassivePctFromEntry(mobEnt);
const opAt=opPct.Attack||0;
let turnAtkPct=0;
if(c.unitTurnBuffAtk&&c.atkUnitData&&!c.atkUnitData._manual)turnAtkPct=Math.max(0,_dcGetDetectedUnitTurnBuffPercents(c.atkUnitData).atkPct|0);
const tAtk=turnAtkPct|0;
function L(n,longT){const v=Math.max(0,Math.floor(Number(n)||0));if(!v)return'';return`<div class="stat-card-bonus" title="${escAttr(longT)}">+${fmtN(v)}</div>`}
const coreHp=F(hpBase*(100+pHp)/100);
const pctHp=F(hpBase*(100+pHp+(opPct.HP|0)+lp+sheetBuffPct)/100)-coreHp;
const hpHtml=L(pctHp,'Option part %, leader skill %, Master League / Grand Offensive (HP)')+L(opFlat.HP|0,'Option part flat HP')+L(hpSupport|0,'Supporter HP support');
const scAtk=c.squadCondAtkPct|0;
const scDef=c.squadCondDefPct|0;
const coreDef=F(defBase*(100+pDef)/100);
const pctDef=F(defBase*(100+pDef+(opPct.Defense|0)+lp+sheetBuffPct+(scDef|0))/100)-coreDef;
const defHtml=L(pctDef,'Option part %, leader skill %, Master League / Grand Offensive (DEF)'+(scDef?' · Squad conditions':''))+L(opFlat.Defense|0,'Option part flat Defense');
const coreMob=F(mobBase*(100+pMob)/100);
const pctMob=F(mobBase*(100+pMob+(opPct.Mobility|0)+lp+sheetBuffPct)/100)-coreMob;
const mobHtml=L(pctMob,'Option part %, leader skill %, Master League / Grand Offensive (MOB)')+L(opFlat.Mobility|0,'Option part flat Mobility');
const coreAtk=F(atkBase*(100+pAtk)/100);
const pctAtkNoEx=F(atkBase*(100+pAtk+opAt+tAtk+sheetBuffPct+lp+(scAtk|0))/100)-coreAtk;
const atkHtml=L(pctAtkNoEx,'Option part %, 1-turn MS ATK %, leader %, ML/GO, squad conditions (EX squad % is on the EX line below)')+L(opFlat.Attack|0,'Option part flat Attack')+L(atkSupport|0,'Supporter ATK support');
return{hpHtml,atkHtml,defHtml,mobHtml};
}
/** opts.forDamage: true → ceil % buckets (Firered damage ⑧); false/omit → floor (database / unit panel). */
function _dcGetModifiedAttackerUnitStatsFromCtx(ctx,atkUnitStats,opts){
const F=Math.floor,C=Math.ceil;
const forDamage=!!(opts&&opts.forDamage);
const R=forDamage?C:F;
const c=ctx||{};
const scAtk=c.squadCondAtkPct|0;
const scDef=c.squadCondDefPct|0;
const mlPct=c.masterLeagueBuff?50:0;
const goPct=c.grandOffensiveBuff?100:0;
const sheetBuffPct=mlPct+goPct;
const opFlat={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
const opPct={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
(c.optionParts||[]).forEach(op=>{const b=_dcParseOptionPartBonuses(op.details);['Attack','HP','Defense','Mobility','Move'].forEach(k=>{opFlat[k]+=b[k].flat;opPct[k]+=b[k].pct})});
let hpSupport=0,atkSupport=0,leaderPct=0;
(c.supporters||[]).forEach(s=>{hpSupport+=Number(s.hp_support)||0;atkSupport+=Number(s.atk_support)||0});
leaderPct=_dcLeaderSkillPctAndFlags(c.supporters).pct;
const lp=leaderPct|0;
const atkEnt=_dcFindStatEntry(atkUnitStats,'Attack');
const defEnt=_dcFindStatEntry(atkUnitStats,'Defense');
const hpEnt=_dcFindStatEntry(atkUnitStats,'HP');
const mobEnt=_dcFindStatEntry(atkUnitStats,'Mobility');
const moveEnt=_dcFindStatEntry(atkUnitStats,'Move')||_dcFindStatEntry(atkUnitStats,'MOV')||_dcFindStatEntry(atkUnitStats,'Movement');
const atkBase=F(Math.max(0,atkEnt?atkEnt.base:0));
const defBase=F(Math.max(0,defEnt?defEnt.base:0));
const hpBase=F(Math.max(0,hpEnt?hpEnt.base:0));
const mobBase=F(Math.max(0,mobEnt?mobEnt.base:0));
const moveBase=F(Math.max(0,moveEnt?moveEnt.base:0));
const pAtk=_dcStatPassivePctFromEntry(atkEnt);
const pDef=_dcStatPassivePctFromEntry(defEnt);
const pHp=_dcStatPassivePctFromEntry(hpEnt);
const pMob=_dcStatPassivePctFromEntry(mobEnt);
const pMove=_dcStatPassivePctFromEntry(moveEnt);
let unitHp=R(hpBase*(100+pHp+(opPct.HP|0)+lp+sheetBuffPct)/100)+(opFlat.HP|0)+hpSupport;
let unitDefVal=R(defBase*(100+pDef+(opPct.Defense|0)+lp+sheetBuffPct+(scDef|0))/100)+(opFlat.Defense|0);
let unitMob=R(mobBase*(100+pMob+(opPct.Mobility|0)+lp+sheetBuffPct)/100)+(opFlat.Mobility|0);
const mlMovePct=(c.masterLeagueBuff&&c.masterLeagueBuffMove!==false)?mlPct:0;
let unitMove=R(moveBase*(100+pMove+(opPct.Move|0)+mlMovePct)/100)+(opFlat.Move|0);
const opAt=opPct.Attack||0;
const exSq=_dcEffectiveExSquadAtkPctFromCtx(c);
let turnAtkPct=0;
if(c.unitTurnBuffAtk&&c.atkUnitData&&!c.atkUnitData._manual)turnAtkPct=Math.max(0,_dcGetDetectedUnitTurnBuffPercents(c.atkUnitData).atkPct|0);
const tAtk=turnAtkPct|0;
const unitAtkExSquadBase=R(atkBase*(100+pAtk+sheetBuffPct)/100);
const unitDefExSquadBase=R(defBase*(100+pDef+sheetBuffPct)/100);
const unitAtkGrowthAfterOptions=R(atkBase*(100+pAtk+opAt+tAtk+sheetBuffPct)/100);
const sumAtkPctNoEx=(pAtk+opAt+tAtk+sheetBuffPct+lp)|0;
const sumAtkPctFull=sumAtkPctNoEx+(exSq|0)+(scAtk|0);
let unitAtk=R(atkBase*(100+sumAtkPctFull)/100)+(opFlat.Attack|0)+(atkSupport|0);
let deltaExAtk=0;
if((exSq|0)>0)deltaExAtk=R(atkBase*(100+sumAtkPctNoEx+exSq)/100)-R(atkBase*(100+sumAtkPctNoEx)/100);
const hpDbCorePassive=F(hpBase*(100+pHp)/100);
const defDbCorePassive=F(defBase*(100+pDef)/100);
const mobDbCorePassive=F(mobBase*(100+pMob)/100);
const atkDbCorePassive=F(atkBase*(100+pAtk)/100);
return{unitAtk,unitHp,unitDefVal,unitMob,unitMove,atkSupport,leaderPct,unitAtkExSquadBase,unitAtkGrowthAfterOptions,unitDefExSquadBase,deltaExAtk,advantageFlatGrowthAtk:atkBase,advantageFlatGrowthDef:defBase,hpDbCorePassive,defDbCorePassive,mobDbCorePassive,atkDbCorePassive};
}
function _dcGetModifiedAttackerUnitStats(atkUnitStats){return _dcGetModifiedAttackerUnitStatsFromCtx(S.dc,atkUnitStats);}
function _dcPilotAtkStatLabelForWeapon(wpn){
const k=_dcWeaponAtkStatKeys(wpn||{});
const u=[...new Set(k)];
if(!u.length)return'Pilot ATK stat';
if(u.length===1)return u[0];
return u.join(' / ');
}
function calculateDamage(){
const F=Math.floor,C=Math.ceil,MX=Math.max,EXP=Math.exp;
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData,npc=S.dc.defNpc;
if(!ud||!cd||!npc)return null;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(S.dc.lbTier,maxTier);
const statKey=_dcGetUnitStatKey();
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const atkUnitStats=td?(td[statKey]||td.stats_no_cond):[];
const atkCharStats=_dcGetCharStats();
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length)return null;
const wpn=wpns[S.dc.wpnIdx];if(!wpn)return null;
const lvData=_dcWeaponLevelRow(wpn,S.dc.wpnLv);

const uMod=_dcGetModifiedAttackerUnitStatsFromCtx(S.dc,atkUnitStats,{forDamage:true});
let unitAtk=uMod.unitAtk,unitHp=uMod.unitHp,unitDefVal=uMod.unitDefVal,unitMob=uMod.unitMob,unitMove=uMod.unitMove;
const pairUd=_dcPilotPairUnitAtkDefPct(unitAtk,unitDefVal);
unitAtk=pairUd.unitAtk;unitDefVal=pairUd.unitDefVal;
const counterOwnAtkPct=_dcGetCounterOwnAtkPct();
unitAtk=_dcApplyCounterOwnAtkToUnitAtk(unitAtk);
const supportCounterAtkPctApplied=_dcEffectiveSupportCounterAtkPct();
unitAtk=_dcApplySupportCounterAtkToUnitAtk(unitAtk);
const advantageTagAtkPct=_dcAdvantageTagAtkPctFromAbilities(ud,npc);
unitAtk=_dcApplyAdvantageTagAtkToUnitAtk(unitAtk,advantageTagAtkPct,uMod.advantageFlatGrowthAtk|0);
let charAtk=_dcGetCharAtkStatWithSkills(atkCharStats,wpn);

const defUnit=npc.unit;const defChar=npc.character;
const us=_dcDefNpcUnitMapStatsPair(defUnit).stats;
const cs=defChar&&defChar.stats_raw||{};
const defMsDefensePair=Math.max(0,Number(us.Defense)||0);
const defMsStatsRawDefense=Math.max(0,Number(defUnit&&defUnit.stats_raw&&defUnit.stats_raw.Defense)||0);
const defMsBonusDefense=Math.max(0,Number(defUnit&&defUnit.bonus_amounts&&defUnit.bonus_amounts.Defense)||0);
let unitDef=defMsDefensePair;
let charDef=Math.max(0,Number(cs.Defense)||0);
let defDebuffPct=_dcManualPlusWeaponDefDebuffPct(wpn,S.dc.wpnLv);
if(defDebuffPct>0){
unitDef=_dcApplyEnemyDefDebuffToDefenderUnitDef(defUnit,defDebuffPct,unitDef);
}
const defDebuffFlatSubtract=defMsDefensePair-unitDef;

const rawWpnPower=lvData.power;
const computedWpnPow=_dcComputedWeaponPowerForLevel(wpn,S.dc.wpnLv);
const traitLvCalc=(wpn.levels&&wpn.levels.length)?Math.min(Math.max(0,S.dc.wpnLv|0),wpn.levels.length-1):0;
const wtTraits=_dcParseWeaponTraits(wpn,traitLvCalc);
const traitDistPow=Math.min(100,(wtTraits.distPowerMax||0)+(wtTraits.distCoreMax||0));
const traitHpPow=wtTraits.hpPowerMax|0;
const traitMpPow=wtTraits.mpPowerMax|0;
const finalOverride=S.dc.finalWpnPow||0;
const finalWpnPowOverride=finalOverride>0;
const weaponPower=finalOverride>0?finalOverride:computedWpnPow;
const qubPlusOneApplied=DC_QUB_PLUS_ONE&&defDebuffPct>35&&!finalWpnPowOverride;
const combatWeaponPower=_dcCombatWeaponPowerNominal(weaponPower,defDebuffPct,finalOverride>0);

const dist=_dcDefaultWeaponDistance(wpn);
const terrainPct=S.dc.terrain;
const terrainCorrection=1-(terrainPct/100);
const mp=_dcMpProfile(S.dc.mpLevel);
const vigorDmgBonusPct=Math.round((mp.dmgBonus||0)*100);
const vigorCritPct=Math.round((mp.critMult||0)*100);
let defendMult=1.0;
if(S.dc.defending)defendMult=S.dc.shield?0.6:0.8;

const characterStatRatio=MX(0,charAtk-charDef)/5000;
/** Unit slice: Firered RoundUp((UnAtk/10)−(UnDef/10))/5000 when DC_SHEET_UNIT_STAT_RATIO; else floor each tenth (legacy). */
let unitStatRatio;
if(DC_SHEET_UNIT_STAT_RATIO||(defDebuffPct|0)===20){
unitStatRatio=MX(0,C((unitAtk/10)-(unitDef/10)))/5000;
}else{
const unitDiffRaw=F(unitAtk/10)-F(unitDef/10);
unitStatRatio=MX(0,F(unitDiffRaw))/5000;
}
const charSigmoid=1/(EXP(250*(charDef-charAtk)/100000)+1);
const unitSigmoid=1/(EXP(25*(unitDef-unitAtk)/100000)+1);
const baseDamage=C((characterStatRatio+unitStatRatio+charSigmoid+unitSigmoid)*combatWeaponPower);

/** ⑥⑦ wiki: 攻撃総合数値=(UnAtk+2*PlAtk)/10, 防御総合数値=(UnDef+2*PlDef)/10. Page also says 切り上げ at key steps — match game + Firered by ceil on these combined values (float here undershoots ⑧ by ~0.02% vs preview). */
const atkCombined=C((unitAtk+2*charAtk)/10);
const defCombined=C((unitDef+2*charDef)/10);
const offExp=((5000-atkCombined)*30)/100000;
const defExp=((5000-defCombined)*3)/100000;
const offenseComponent=(10000/100)/(EXP(offExp)+1);
const defenseComponent=(-4000/100)/(EXP(defExp)+1);
const damageCorrection=(offenseComponent+defenseComponent)*baseDamage;
const battleDamage=C((baseDamage+damageCorrection)*terrainCorrection);

const userDmgIncreasePct=S.dc.dmgIncrease||0;
const userCritDmgUpPct=S.dc.critDmgUp||0;
const dmgTakenUpPct=_dcWeaponDtuSumPct(wpn);
const dmgTakenUpTyped=dmgTakenUpPct||0;
const dmgTakenUpGeneric=0;
const dmgTakenDownPilotPct=S.dc.dmgTakenDownPilot||0;
const dmgTakenDownUnitPct=S.dc.dmgTakenDownUnit||0;
const isExWeapon=!!wpn.is_ex;
const takenDown=dmgTakenDownPilotPct+(isExWeapon?0:dmgTakenDownUnitPct);

const totalNormalMultPct=userDmgIncreasePct+vigorDmgBonusPct+dmgTakenUpPct-takenDown;
const scaledNormal=C(totalNormalMultPct*battleDamage/100);
const combinedNormal=(battleDamage+scaledNormal)*defendMult;
let normalDmg=MX(0,C(combinedNormal));

const totalCritMultPct=userDmgIncreasePct+vigorDmgBonusPct+userCritDmgUpPct+dmgTakenUpPct-takenDown;
const critCorrectionPct=vigorCritPct;
const scaledCrit=C(totalCritMultPct*battleDamage/100);
let crit125Trim=0;
if((totalCritMultPct|0)===125&&defendMult===1&&(battleDamage|0)>=DC_CRIT125_TRIM_MIN_BATTLE_DAMAGE&&(combatWeaponPower|0)>0){
crit125Trim=F(MX(0,battleDamage-combatWeaponPower)/DC_CRIT125_TRIM_DIV);
}
const combinedCrit=MX(0,(battleDamage+scaledCrit)*defendMult-crit125Trim);
const critPreVigor=MX(0,combinedCrit);
let critDmg=MX(0,C(critPreVigor*(critCorrectionPct+100)/100-1e-9));

const effRange=_dcGetEffectiveRange(wpn);
const inRange=dist>=effRange.min_range&&dist<=effRange.max_range;
const npcHp=defUnit?Math.max(0,Number(us.HP)||0):0;
const accuracy=lvData.accuracy;
const critical=lvData.critical;

const atkCharReaction=_dcFindStat(atkCharStats,'Reaction');
const defUnitMob=defUnit?Math.max(0,Number(us.Mobility)||0):0;
const defCharReaction=defChar?Math.max(0,Number(cs.Reaction)||0):0;
const accDownPct=0,mobDownPct=0;
const accResult=wtTraits.absoluteHit?{finalHitRate:100,mobDiff:0,reaDiff:0,mobCorrection:0,baseHit:10000,rawHit:100,absoluteHit:true}:calculateAccuracy(unitMob,charAtk,atkCharReaction,defUnitMob,defCharReaction,accuracy,{mobDownPct,accDownPct});
const exSquadAtkPct=_dcEffectiveExSquadAtkPct();
const squadCondAtkPct=S.dc.squadCondAtkPct|0,squadCondDefPct=S.dc.squadCondDefPct|0;
return{normalDmg,critDmg,inRange,npcHp,accuracy,critical,baseDamage,battleDamage,weaponPower,combatWeaponPower,rawWpnPower,charAtk,charDef,unitAtk,unitDef,unitMob,
characterStatRatio,unitStatRatio,charSigmoid,unitSigmoid,
atkCombined,defCombined,offenseComponent,defenseComponent,
damageCorrection:C(damageCorrection),terrainCorrection,totalNormalMultPct,totalCritMultPct,critCorrectionPct,critPreVigor,crit125Trim,scaledNormal,scaledCrit,defendMult,isExWeapon,
defMsDefensePair,defMsStatsRawDefense,defMsBonusDefense,defDebuffFlatSubtract,qubPlusOneApplied,
traitDistPow,traitHpPow,traitMpPow,traitWpnDistBasePct:wtTraits.distPowerMax|0,traitWpnCoreBonusPct:wtTraits.distCoreMax|0,finalWpnPowOverride,vigorDmgBonusPct,userDmgIncreasePct,exSquadAtkPct,squadCondAtkPct,squadCondDefPct,counterOwnAtkPct,supportCounterAtkPctApplied,advantageTagAtkPct,advantageGrowthFlatOmitted:false,userCritDmgUpPct,dmgTakenUpPct,dmgTakenUpGeneric,dmgTakenUpTyped,takenDown,defDebuffPct,
pilotBoostPct:0,pilotAtkDownPct:0,unitAtkDownPct:0,accDownPct,mobDownPct,wpnElem:_dcWeaponAttributeKeys(wpn).join('/'),
hitRate:accResult.finalHitRate,hitRateDetails:accResult,isSuperVigor:_dcNormMpLevel(S.dc.mpLevel)==='super'};
}
function calculateAccuracy(atkUnitMob,atkCharAtk,atkCharReaction,defUnitMob,defCharReaction,baseWeaponAcc,pen){
pen=pen||{};
const F=Math.floor,RU=Math.ceil,EXP=Math.exp,MX=Math.max,MN=Math.min;
let uMob=atkUnitMob;
const mdp=Math.min(100,pen.mobDownPct||0);
if(mdp>0)uMob=F(uMob*(1-mdp/100));
const mobDiff=RU((uMob/10)-(defUnitMob/10));
const reaDiff=atkCharAtk-defCharReaction;
const expMob=(1*(120-atkUnitMob))/10000;
const denMob=EXP(expMob)+1;
const expRea=(1*(10-atkCharReaction))/10000;
const denRea=EXP(expRea)+1;
const mobTerm=(denMob*mobDiff)/2500;
const reaTerm=(denRea*reaDiff)/5000;
const mobCorrection=F((mobTerm+reaTerm)*100);
const evaPct=0;
const accUpDown=0;
const sum=mobCorrection+(-evaPct*100)+(accUpDown*100);
const adp=Math.min(100,pen.accDownPct||0);
const baseHit=baseWeaponAcc*100*(1-adp/100);
const counterMult=S.dc.defending?0.8:1;
const rawHit=F(counterMult*(baseHit+sum));
const finalHitRate=MN(100,MX(10,rawHit));
return{finalHitRate,mobDiff,reaDiff,mobCorrection,baseHit,rawHit};
}

function _dcHtmlDcResultDamageBlock(r){
const npcHp=Math.max(0,r.npcHp|0);
const hpRemN=Math.max(0,npcHp-r.normalDmg);
const hpRemC=Math.max(0,npcHp-r.critDmg);
const pctN=npcHp>0?Math.min(100,(hpRemN/npcHp)*100):0;
const pctC=npcHp>0?Math.min(100,(hpRemC/npcHp)*100):0;
const sup=!!r.isSuperVigor;
const critLbl=sup?t('dc_super_crit_dmg'):t('dc_crit_dmg');
const hpCritLbl=sup?t('dc_hp_remaining_super_crit'):t('dc_hp_remaining_crit');
return`<div class="dc-result-row"><div class="dc-result-item"><div class="dc-result-label dc-dmg-anch-n-lbl">${t('dc_normal_dmg')}</div><div class="dc-result-val normal dc-dmg-anch-n">${fmtN(r.normalDmg)}</div></div><div class="dc-result-item"><div class="dc-result-label">${critLbl}</div><div class="dc-result-val crit dc-dmg-anch-c">${fmtN(r.critDmg)}</div></div><div class="dc-result-item"><div class="dc-result-label">${t('dc_hit_rate')}</div><div class="dc-result-val hit">${r.hitRate}%</div></div></div>
<div class="dc-result-hp dc-result-hp--compact">
<div class="dc-hp-mini dc-hp-mini--normal">
<div class="dc-hp-mini-top"><span class="dc-hp-mini-tag">${t('dc_hp_remaining_normal')}</span><span class="dc-hp-mini-val"><span class="dc-hp-mini-fraction">${fmtN(hpRemN)}<span class="dc-hp-mini-sep">/</span>${fmtN(npcHp)}</span>${npcHp>0?`<span class="dc-hp-mini-pct">${pctN.toFixed(1)}%</span>`:''}</span></div>
<div class="dc-hp-bar-track dc-hp-mini-track"><div class="dc-hp-bar-fill dc-hp-bar-fill--normal" style="width:${pctN}%"></div></div>
</div>
<div class="dc-hp-mini dc-hp-mini--crit">
<div class="dc-hp-mini-top"><span class="dc-hp-mini-tag">${hpCritLbl}</span><span class="dc-hp-mini-val"><span class="dc-hp-mini-fraction">${fmtN(hpRemC)}<span class="dc-hp-mini-sep">/</span>${fmtN(npcHp)}</span>${npcHp>0?`<span class="dc-hp-mini-pct">${pctC.toFixed(1)}%</span>`:''}</span></div>
<div class="dc-hp-bar-track dc-hp-mini-track"><div class="dc-hp-bar-fill dc-hp-bar-fill--crit" style="width:${pctC}%"></div></div>
</div>
</div>`;
}

function _dcPctDelta(cur,base){
const c=Number(cur),b=Number(base);
if(!Number.isFinite(c)||!Number.isFinite(b)||b===0)return null;
return((c-b)/Math.abs(b))*100;
}
function _dcFmtPctDelta(v){
if(v==null||!Number.isFinite(v))return'--';
const a=Math.abs(v);
const d=a>=100?0:(a>=10?1:2);
return`${v>=0?'+':''}${v.toFixed(d)}%`;
}
function _dcSyncMultiPctCompareUi(canCompare){
const btn=document.getElementById('dcMultiPctCompareBtn');
if(!btn)return;
if(!canCompare)S.dc.multiPctCompare=false;
const on=!!S.dc.multiPctCompare&&!!canCompare;
btn.disabled=!canCompare;
btn.classList.toggle('active',on);
const tr=btn.querySelector('.ranking-exp-switch-track');
if(tr)tr.classList.toggle('active',on);
btn.title=canCompare?'% compare between attackers':'Add at least 2 attackers to compare';
}
function toggleDcMultiPctCompareMode(){
if(!S.dc._lastMultiResults||S.dc._lastMultiResults.length<2)return;
S.dc.multiPctCompare=!S.dc.multiPctCompare;
renderDcResult();
const ov=document.getElementById('dcBattleStatsOverlay');
if(ov&&window.getComputedStyle(ov).display!=='none')_dcRenderBattleStatsPanel();
}
function _dcBuildDamageCompareMeta(res,baseRes,idx,baseIdx,enabled){
if(!enabled||!res||!baseRes||idx===baseIdx)return null;
const n=_dcPctDelta(res.normalDmg,baseRes.normalDmg);
const c=_dcPctDelta(res.critDmg,baseRes.critDmg);
return{baseIdx,idx,normalPct:n,critPct:c};
}
function _dcCompareArcLabelText(pct){
if(pct==null||!Number.isFinite(pct))return'--';
return rankingPctText(pct);
}
function _dcCompareArcPctClass(pct){
if(pct==null||!Number.isFinite(pct))return'is-neutral';
return pct>=0?'is-pos':'is-neg';
}
function _dcDetachDcMultiCompareObserver(){
const area=document.getElementById('dcResultArea');
if(!area||!area._dcMultiCompareDetach)return;
try{area._dcMultiCompareDetach()}catch(_){}
area._dcMultiCompareDetach=null;
}
function _dcScheduleDcMultiCompareArcs(){
requestAnimationFrame(()=>{requestAnimationFrame(()=>{_dcDrawDcMultiCompareArcs()})});
}
function _dcDrawDcMultiCompareArcs(){
const canvas=document.querySelector('#dcResultArea .dc-result-multi-compare-canvas');
const layer=canvas&&canvas.querySelector('.ranking-compare-layer');
if(!canvas||!layer)return;
const multi=S.dc._lastMultiResults||[];
const compareOn=!!S.dc.multiPctCompare&&multi.length>1;
if(!compareOn||multi.length<2){
layer.classList.remove('active');
const svg=layer.querySelector('.ranking-compare-svg');
const lw=layer.querySelector('.ranking-compare-labels');
if(svg)svg.innerHTML='';
if(lw)lw.innerHTML='';
return
}
const grid=canvas.querySelector('.dc-result-multi-grid');
const cols=grid?Array.from(grid.querySelectorAll('.dc-result-multi-col')):[];
if(cols.length<2){
layer.classList.remove('active');
return
}
const baseCol=cols.find(c=>c.classList.contains('is-compare-base'))||cols[0];
const nb=baseCol.querySelector('.dc-dmg-anch-n-lbl');
const cb=baseCol.querySelector('.dc-dmg-anch-c');
if(!nb||!cb){
layer.classList.remove('active');
return
}
const targets=cols.filter(c=>c!==baseCol);
if(!targets.length){
layer.classList.remove('active');
return
}
const activeI=S.dc.atkSlotIndex|0;
const primary=multi.find(m=>m.idx===activeI)||multi[0];
const baseSlot=Number(baseCol.getAttribute('data-dc-slot'));
const baseEnt=multi.find(m=>m.idx===baseSlot)||primary;
const br=canvas.getBoundingClientRect();
const bnr=nb.getBoundingClientRect();
const bcr=cb.getBoundingClientRect();
const x1n=bnr.left-br.left+bnr.width*0.5;
const y1n=bnr.top-br.top+bnr.height*0.5;
const x1c=bcr.left-br.left+bcr.width*0.5;
const y1c=bcr.top-br.top+bcr.height*0.88;
const baseCx=bnr.left+bnr.width*0.5;
const sortedTargets=targets.map(c=>{
const nx=c.querySelector('.dc-dmg-anch-n-lbl');
return nx?{c,cx:nx.getBoundingClientRect()}:null;
}).filter(Boolean).sort((a,b)=>a.cx.left+a.cx.width*0.5-baseCx-(b.cx.left+b.cx.width*0.5-baseCx));
const nTar=sortedTargets.length;
const slotStep=nTar<=3?10:(nTar<=5?8:6);
const slots=sortedTargets.map((_,i)=>i-(nTar-1)/2);
let paths='',labels='',pathId=0;
const used=[];
const pushAvoid=(lx,ly,w,h,dy)=>{
for(let guard=0;guard<14;guard++){
let bumped=false;
for(let k=0;k<used.length;k++){const u=used[k];if(Math.abs(lx-u.x)<(w+u.w)*0.5&&Math.abs(ly-u.y)<(h+u.h)*0.52){ly+=(dy>=0?1:-1)*(h+10);bumped=true;break}}
if(!bumped)break;
}
used.push({x:lx,y:ly,w,h});
return ly};
sortedTargets.forEach(({c},ti)=>{
const slot=slots[ti];
const fan=slot*slotStep;
const otherSlot=Number(c.getAttribute('data-dc-slot'));
const ent=multi.find(m=>m.idx===otherSlot);
if(!ent)return;
const meta=_dcBuildDamageCompareMeta(ent.result,baseEnt.result,ent.idx,baseEnt.idx,true);
const n2=c.querySelector('.dc-dmg-anch-n-lbl');
const c2=c.querySelector('.dc-dmg-anch-c');
if(!n2||!c2||!meta)return;
const rn2=n2.getBoundingClientRect(),rc2=c2.getBoundingClientRect();
const x2n=rn2.left-br.left+rn2.width*0.5,y2n=rn2.top-br.top+rn2.height*0.5;
const x2c=rc2.left-br.left+rc2.width*0.5,y2c=rc2.top-br.top+rc2.height*0.88;
const dx=x2n-x1n;
const bendUp=Math.min(118,Math.max(56,Math.abs(dx)*0.44))+Math.abs(fan)*0.72;
let c1x=x1n+dx*0.38+fan*0.62,c1y=y1n-bendUp;
let c2x=x1n+dx*0.62+fan*0.42,c2y=y2n-bendUp-Math.abs(fan)*0.28;
let pid=`dcdArcN${pathId++}`;
const clN=_dcCompareArcPctClass(meta.normalPct);
paths+=`<path id="${pid}" class="ranking-compare-path ${clN}" d="M ${x1n.toFixed(1)} ${y1n.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2n.toFixed(1)} ${y2n.toFixed(1)}"></path>`;
let lxn=x1n+dx*0.52+fan*8;
let lyn=Math.min(y1n,y2n)-bendUp*0.5+Math.abs(dx)*0.02+fan*2.8;
lyn=pushAvoid(lxn,lyn,64,22,fan||1);
labels+=`<div class="ranking-compare-label ${clN}" style="left:${lxn.toFixed(1)}px;top:${lyn.toFixed(1)}px">${esc(_dcCompareArcLabelText(meta.normalPct))}</div>`;
const dxC=x2c-x1c;
const bendDn=Math.min(108,Math.max(52,Math.abs(dxC)*0.42))+Math.abs(fan)*0.68;
let cc1x=x1c+dxC*0.4+fan*0.55,cc1y=y1c+bendDn;
let cc2x=x1c+dxC*0.62+fan*0.35,cc2y=y2c+bendDn+Math.abs(fan)*0.24;
pid=`dcdArcC${pathId++}`;
const clC=_dcCompareArcPctClass(meta.critPct);
paths+=`<path id="${pid}" class="ranking-compare-path ${clC}" d="M ${x1c.toFixed(1)} ${y1c.toFixed(1)} C ${cc1x.toFixed(1)} ${cc1y.toFixed(1)}, ${cc2x.toFixed(1)} ${cc2y.toFixed(1)}, ${x2c.toFixed(1)} ${y2c.toFixed(1)}"></path>`;
let lxc=x1c+dxC*0.5+fan*4;
let lyc=Math.max(y1c,y2c)+bendDn*0.58+fan*(-2);
lyc=pushAvoid(lxc,lyc,64,22,-(fan||1));
labels+=`<div class="ranking-compare-label ${clC}" style="left:${lxc.toFixed(1)}px;top:${lyc.toFixed(1)}px">${esc(_dcCompareArcLabelText(meta.critPct))}</div>`});
const svg=layer.querySelector('.ranking-compare-svg');
const labelsWrap=layer.querySelector('.ranking-compare-labels');
if(!svg||!labelsWrap)return;
svg.setAttribute('viewBox',`0 0 ${Math.max(1,canvas.clientWidth)} ${Math.max(1,canvas.clientHeight)}`);
svg.setAttribute('width',String(Math.max(1,canvas.clientWidth)));
svg.setAttribute('height',String(Math.max(1,canvas.clientHeight)));
svg.innerHTML=paths;
labelsWrap.innerHTML=labels;
svg.querySelectorAll('.ranking-compare-path').forEach(p=>{try{const len=p.getTotalLength();p.style.strokeDasharray=`${len}`;p.style.strokeDashoffset=`${len}`;p.getBoundingClientRect();p.style.strokeDashoffset='0'}catch(_){}});
layer.classList.add('active');
}
function _dcBattleStatsDeltaBadge(cur,base){
const pct=_dcPctDelta(cur,base);
if(pct==null||!Number.isFinite(pct)||Math.abs(pct)<0.01)return'';
const cls=pct>=0?'dc-bs-delta--pos':'dc-bs-delta--neg';
return`<span class="dc-bs-delta ${cls}">${_dcFmtPctDelta(pct)}</span>`;
}
function _dcBattleStatsDeltaRowClass(cur,base){
const pct=_dcPctDelta(cur,base);
if(pct==null||!Number.isFinite(pct)||Math.abs(pct)<0.01)return'';
return pct>=0?'dc-battle-stats-row--diff-pos':'dc-battle-stats-row--diff-neg';
}

function renderDcResult(){
const area=document.getElementById('dcResultArea');
if(!S.dc.defNpc){
_dcDetachDcMultiCompareObserver();
_dcSyncMultiPctCompareUi(false);
area.innerHTML=`<div class="dc-result-box"><div style="color:var(--text-muted);font-size:13px">Select: NPC Target</div></div>`;return}
const multi=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=(S.dc.atkSlots||[])[i];
if(!sl||!sl.atkUnitData||!sl.atkCharData)continue;
let rr=null;
try{rr=_dcCalculateDamageWithSlot(i)}catch(e){console.error('calculateDamage error slot',i,e)}
if(rr)multi.push({idx:i,slot:sl,result:rr});
}
if(!multi.length){
_dcDetachDcMultiCompareObserver();
_dcSyncMultiPctCompareUi(false);
const missing=[];
if(!S.dc.atkUnitData)missing.push('Attacker Unit');
if(!S.dc.atkCharData)missing.push('Attacker Character');
const ud=S.dc.atkUnitData;
if(ud&&ud.weapons&&!_dcNonMapWeapons(ud).length)missing.push('Unit has no non-map weapons');
const msg=missing.length?'Select: '+missing.join(', '):'Set up at least one attacker loadout (unit + character)';
area.innerHTML=`<div class="dc-result-box"><div style="color:var(--text-muted);font-size:13px">${msg}</div></div>`;return}
const activeI=S.dc.atkSlotIndex|0;
const primary=multi.find(m=>m.idx===activeI)||multi[0];
const compareEnabled=!!S.dc.multiPctCompare&&multi.length>1;
_dcSyncMultiPctCompareUi(multi.length>1);
S.dc._lastResult=primary.result;
S.dc._lastMultiResults=multi;
let inner='';
if(multi.length===1){
inner=_dcHtmlDcResultDamageBlock(multi[0].result);
}else{
const layerHtml=compareEnabled?'<div class="ranking-compare-layer" aria-hidden="true"><svg class="ranking-compare-svg"></svg><div class="ranking-compare-labels"></div></div>':'';
inner='<div class="dc-result-multi-compare-canvas"><div class="dc-result-multi-grid'+(compareEnabled?' dc-result-multi-grid--pct-compare':'')+'">'+multi.map(m=>{
const ud=m.slot.atkUnitData,cd=m.slot.atkCharData;
const cmp=_dcBuildDamageCompareMeta(m.result,primary.result,m.idx,primary.idx,compareEnabled);
const isBase=m.idx===primary.idx;
const head=`#${m.idx+1} · ${esc(ud.name||'Unit')} + ${esc(cd.name||'Pilot')}${isBase?`<span class="dc-result-compare-badge">Base</span>`:''}`;
const cls=`dc-result-multi-col${isBase?' is-compare-base':''}${cmp?' is-compare-target':''}`;
return`<div class="${cls}" data-dc-slot="${m.idx}"><div class="dc-result-multi-head">${head}</div>${_dcHtmlDcResultDamageBlock(m.result)}</div>`;
}).join('')+'</div>'+layerHtml+'</div>';
}
_dcDetachDcMultiCompareObserver();
area.innerHTML=`<div class="dc-result-box">${inner}
<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
<button type="button" class="dc-ctrl-btn" onclick="toggleDcBattleStats(true)" style="font-size:12px;padding:6px 14px">Battle Stats</button>
<button type="button" class="dc-ctrl-btn" onclick="shareDcLink()" style="font-size:12px;padding:6px 14px">🔗 Share Link</button>
</div>
<div id="dcShareMsg" style="text-align:center;font-size:11px;color:#22c55e;margin-top:6px"></div>
</div>`;
if(multi.length>1&&compareEnabled){
const canv=area.querySelector('.dc-result-multi-compare-canvas');
if(canv){
const ro=new ResizeObserver(()=>_dcScheduleDcMultiCompareArcs());
ro.observe(canv);
area._dcMultiCompareDetach=()=>{try{ro.disconnect()}catch(_){}};
_dcScheduleDcMultiCompareArcs();
}
}
}
function toggleDcBattleStats(show){
const ov=document.getElementById('dcBattleStatsOverlay');
if(!ov)return;
const on=show===undefined?ov.style.display==='none'||ov.style.display==='':!!show;
ov.style.display=on?'flex':'none';
if(on)_dcRenderBattleStatsPanel();
}
function _dcBattleStatsRow(lab,val){
let rowClass='';
if(arguments.length>=3&&arguments[2])rowClass=` ${arguments[2]}`;
return`<div class="dc-battle-stats-row${rowClass}"><span>${esc(lab)}</span><span>${val}</span></div>`;
}
function _dcHasWeaponTraitBonus(r){
if(!r)return false;
return((r.traitWpnDistBasePct|0)>0||(r.traitWpnCoreBonusPct|0)>0||(r.traitHpPow|0)>0||(r.traitMpPow|0)>0);
}
function _dcAppendWeaponTraitBattleStats(h,r){
if(!_dcHasWeaponTraitBonus(r))return h;
const tot=(r.traitDistPow|0)+(r.traitHpPow|0)+(r.traitMpPow|0);
h+=_dcBattleStatsRow(t('dc_wpn_trait_effects'),`+${tot}% (${esc(t('dc_wpn_trait_max_applied'))})`);
if(r.finalWpnPowOverride)h+=`<div class="dc-battle-stats-row" style="grid-column:1/-1;font-size:11px;color:var(--text-muted)">${esc(t('dc_wpn_trait_override_note'))}</div>`;
if(r.traitWpnDistBasePct)h+=_dcBattleStatsRow(t('dc_wpn_trait_dist'),`+${r.traitWpnDistBasePct|0}%`);
if(r.traitWpnCoreBonusPct)h+=_dcBattleStatsRow(t('dc_wpn_trait_custom_core'),`+${r.traitWpnCoreBonusPct|0}%`);
if(r.traitHpPow)h+=_dcBattleStatsRow(t('dc_wpn_trait_hp'),`+${r.traitHpPow|0}%`);
if(r.traitMpPow)h+=_dcBattleStatsRow(t('dc_wpn_trait_mp'),`+${r.traitMpPow|0}%`);
return h;
}
function _dcCopyLinesWeaponTraitBonus(rr){
if(!_dcHasWeaponTraitBonus(rr))return[];
const tot=(rr.traitDistPow|0)+(rr.traitHpPow|0)+(rr.traitMpPow|0);
const o=[];
o.push(`${t('dc_wpn_trait_effects')}: +${tot}% (${t('dc_wpn_trait_max_applied')})`);
if(rr.finalWpnPowOverride)o.push(t('dc_wpn_trait_override_note'));
if(rr.traitWpnDistBasePct)o.push(`  ${t('dc_wpn_trait_dist')}: +${rr.traitWpnDistBasePct|0}%`);
if(rr.traitWpnCoreBonusPct)o.push(`  ${t('dc_wpn_trait_custom_core')}: +${rr.traitWpnCoreBonusPct|0}%`);
if(rr.traitHpPow)o.push(`  ${t('dc_wpn_trait_hp')}: +${rr.traitHpPow|0}%`);
if(rr.traitMpPow)o.push(`  ${t('dc_wpn_trait_mp')}: +${rr.traitMpPow|0}%`);
return o;
}
function _dcBattleStatsBlock(lab,innerHtml){
return`<div class="dc-battle-stats-block"><div class="dc-battle-stats-block-label">${esc(lab)}</div><div class="dc-battle-stats-block-body">${innerHtml}</div></div>`;
}
function _dcFormatBattleStatsOptionParts(parts){
if(!parts||!parts.length)return _dcBattleStatsRow('Option parts','—');
return _dcBattleStatsBlock('Option parts',parts.map(o=>{
const det=String(o.details||'').trim();
return`<div class="dc-bs-item"><strong>${esc(o.name||'—')}</strong>${det?`<div class="dc-bs-item-detail">${esc(det)}</div>`:''}</div>`;
}).join(''));
}
function _dcFormatBattleStatsSupporters(sups){
if(!sups||!sups.length)return _dcBattleStatsRow('Supporter','—');
return _dcBattleStatsBlock('Supporter',sups.map(s=>{
const atkFlat=Number(s.atk_support)||0;
const hpFlat=Number(s.hp_support)||0;
const flatBits=[];
if(hpFlat)flatBits.push('HP +'+fmtN(hpFlat));
if(atkFlat)flatBits.push('ATK +'+fmtN(atkFlat));
const flatLine=flatBits.length?`<div class="dc-bs-item-flat">${esc(flatBits.join(' · '))}</div>`:'';
let skillHtml='';
(s.leader_skills||[]).forEach(ls=>{
const desc=String(ls.desc||'').trim();
const tags=(ls.tags||[]).map(tg=>tg.name||'').filter(Boolean);
const tagStr=tags.length?tags.join(ls.separator==='and'?' & ':' / '):'';
if(!tagStr&&!desc)return;
skillHtml+=`<div class="dc-bs-item-detail">${tagStr?`<span class="dc-bs-tag">${esc(tagStr)}</span> ` : ''}${esc(desc)}</div>`;
});
const boost=String(s.boost||'').trim();
if(!skillHtml&&boost)skillHtml=`<div class="dc-bs-item-detail">${esc(boost.split('\n').slice(0,8).join('\n'))}</div>`;
return`<div class="dc-bs-item"><strong>${esc(s.name||'—')}</strong>${flatLine}${skillHtml}</div>`;
}).join(''));
}
function _dcRenderBattleStatsDefender(npc,r){
if(!npc)return'';
const u=npc.unit,ch=npc.character;
const us=u?_dcDefNpcUnitMapStatsPair(u).stats:{};
const uDefRaw=u?(us.Defense||0):0;
const deb=r.defDebuffPct|0;
const uDefEff=deb>0?_dcApplyEnemyDefDebuffToDefenderUnitDef(u,deb,uDefRaw):uDefRaw;
const cDef=ch?(ch.stats_raw?.Defense||0):0;
const hp=u?(us.HP||0):0;
let h='<div class="dc-battle-stats-section"><h3>Defender</h3>';
h+=_dcBattleStatsRow('Unit DEF',fmtN(uDefEff)+(deb>0?` (${deb}% debuff)`:''));
h+=_dcBattleStatsRow('Pilot DEF',fmtN(cDef));
h+=_dcBattleStatsRow('Damage Taken Up',String(r.dmgTakenUpTyped|0)+'%');
h+=_dcBattleStatsRow('Damage Taken Down',String(r.takenDown|0)+'%');
h+=_dcBattleStatsRow('Hit rate',String(r.hitRate)+'%');
h+=_dcBattleStatsRow('Max HP',fmtN(hp));
h+='</div>';
return h;
}
function _dcRenderBattleStatsPanel(){
const body=document.getElementById('dcBattleStatsBody');
if(!body)return;
const multi=S.dc._lastMultiResults;
if(!multi||!multi.length){body.innerHTML='<div style="color:var(--text-muted)">Calculate damage first (attacker + defender).</div>';return}
const activeIdx=S.dc.atkSlotIndex|0;
const r0=(multi.find(m=>m.idx===activeIdx)||multi[0]).result;
const compareEnabled=!!S.dc.multiPctCompare&&multi.length>1;
let h='';
multi.forEach(m=>{
const r=m.result,sl=m.slot,ud=sl.atkUnitData,cd=sl.atkCharData;
const wpns=ud?_dcNonMapWeapons(ud):[];
const wpn=wpns[sl.wpnIdx|0]||null;
const wName=wpn?esc(wpn.name):'—';
const atkLab=_dcPilotAtkStatLabelForWeapon(wpn);
const mpL=_dcNormMpLevel(sl.mpLevel||'medium');
const vigLbl=_dcVigorLabel(mpL);
const dmgPool=(r.userDmgIncreasePct|0)+(r.vigorDmgBonusPct|0);
const baseDmgPool=(r0.userDmgIncreasePct|0)+(r0.vigorDmgBonusPct|0);
const isAct=m.idx===activeIdx;
h+=`<div class="dc-battle-stats-section"${isAct?' style="padding:10px;border-radius:8px;border:1px solid rgba(56,189,248,.35)"':''}><h3>Attacker ${m.idx+1}${isAct?' · active':''}</h3>`;
if(compareEnabled&&!isAct){
const nd=_dcPctDelta(r.normalDmg,r0.normalDmg),cdp=_dcPctDelta(r.critDmg,r0.critDmg);
h+=_dcBattleStatsRow('Damage delta vs active',`Normal ${_dcFmtPctDelta(nd)} · ${r.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg')} ${_dcFmtPctDelta(cdp)}`);
}
h+=_dcBattleStatsRow('Unit',esc(ud?.name||'—'));
h+=_dcBattleStatsRow('Pilot',esc(cd?.name||'—'));
h+=_dcBattleStatsRow('MS ATK',fmtN(r.unitAtk)+_dcBattleStatsDeltaBadge(r.unitAtk,r0.unitAtk),_dcBattleStatsDeltaRowClass(r.unitAtk,r0.unitAtk));
if((r.supportCounterAtkPctApplied|0)>0)h+=_dcBattleStatsRow('Support Attack/Counter MS ATK',`+${r.supportCounterAtkPctApplied|0}% applied`);
h+=_dcBattleStatsRow('Pilot stat ('+esc(atkLab)+')',fmtN(r.charAtk)+_dcBattleStatsDeltaBadge(r.charAtk,r0.charAtk),_dcBattleStatsDeltaRowClass(r.charAtk,r0.charAtk));
h+=_dcBattleStatsRow('Weapon',wName);
h+=_dcBattleStatsRow('Weapon Power',fmtN(r.weaponPower)+_dcBattleStatsDeltaBadge(r.weaponPower,r0.weaponPower),_dcBattleStatsDeltaRowClass(r.weaponPower,r0.weaponPower));
h=_dcAppendWeaponTraitBattleStats(h,r);
h+=_dcBattleStatsRow('Damage Dealt % Total',`${dmgPool}% (${r.userDmgIncreasePct|0}% passive + ${r.vigorDmgBonusPct|0}% vigor)`+_dcBattleStatsDeltaBadge(dmgPool,baseDmgPool),_dcBattleStatsDeltaRowClass(dmgPool,baseDmgPool));
h+=_dcBattleStatsRow('Crit rate (weapon %)',String(r.critical)+'%');
h+=_dcBattleStatsRow('Vigor state',esc(vigLbl));
h+=_dcBattleStatsRow('Master League (attacker)',sl.masterLeagueBuff?'On (+50% unit sheet; not EN/Move; pilot unchanged)':'Off');
h+=_dcBattleStatsRow('Grand Offensive (attacker)',sl.grandOffensiveBuff?'On (+100% unit sheet; not EN/Move; pilot unchanged)':'Off');
h+=_dcFormatBattleStatsOptionParts(sl.optionParts||[]);
h+=_dcFormatBattleStatsSupporters(sl.supporters||[]);
h+='</div>';
});
h+=_dcRenderBattleStatsDefender(S.dc.defNpc,r0);
body.innerHTML=h+`<div class="dc-battle-stats-footer"><button type="button" class="dc-ctrl-btn dc-battle-stats-copy-btn" onclick="copyDcResultText()">📋 Copy Results</button><div id="dcBattleStatsCopyMsg" class="dc-battle-stats-copy-msg" aria-live="polite"></div></div>`;
}
function _dcBuildShareUrl(){
onDcParamChange();
_dcSnapActiveAttackerToSlot();
const packed=_dcPackShareState();
const json=JSON.stringify(packed);
const b64=_dcB64UrlEncode(json);
return`${location.origin}${location.pathname}?tab=DS&dc=${encodeURIComponent(b64)}`;
}
function _dcWeaponDisplayNameForSlot(ud,wpnIdx){
const wpns=ud?_dcNonMapWeapons(ud):[];
const w=wpns[wpnIdx|0];
return w?(w.name||'—'):'—';
}
function _dcCopyLinesDamageFormulas(rr){
if(!rr)return[];
const supLbl=rr.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg');
return['',
'Damage formulas (Firered sheet order):',
'  scaledNormal = ceil(totalNormalMultPct × battleDamage / 100)',
'  combinedNormal = (battleDamage + scaledNormal) × defendMult',
'  Normal damage = max(0, ceil(combinedNormal))',
'  totalNormalMultPct = (passive Damage Dealt Up%) + (vigor damage bonus%) + (weapon Damage Taken Up%) − (Damage Taken Down%)',
`  Plugged in: battleDamage=${fmtN(rr.battleDamage)}, scaledNormal=${fmtN(rr.scaledNormal)}, totalNormalMultPct=${rr.totalNormalMultPct|0}% (passive ${rr.userDmgIncreasePct|0}% + vigor ${rr.vigorDmgBonusPct|0}% + taken up ${rr.dmgTakenUpPct|0}% − taken down ${rr.takenDown|0}%), defendMult=${rr.defendMult}`,
`  → Normal damage = ${fmtN(rr.normalDmg)}`,
'  scaledCrit = ceil(totalCritMultPct × battleDamage / 100); crit125Trim = (totalCritMult=125% ∧ defendMult=1 ∧ ⑧≥threshold ∧ W>0) ? floor(max(0,⑧−combatWeaponPower)/1181) : 0',
'  combinedCrit = max(0, (battleDamage + scaledCrit) × defendMult − crit125Trim)',
`  ${supLbl} = max(0, ceil(combinedCrit × (vigorCritMultPct+100) / 100))`,
'  totalCritMultPct = same pool as normal plus (Critical Damage Up % from Attacker Parameters)',
`  Plugged in: totalCritMultPct=${rr.totalCritMultPct|0}% (includes crit dmg up input ${rr.userCritDmgUpPct|0}%), vigorCritMultPct=${rr.critCorrectionPct|0}%, scaledCrit=${fmtN(rr.scaledCrit)}, crit125Trim=${fmtN(rr.crit125Trim|0)}, combinedCrit=${fmtN(rr.critPreVigor)}`,
`  → ${supLbl} = ${fmtN(rr.critDmg)}`];
}
function _dcCopyLinesBattleDamageDiagnostics(rr){
if(!rr)return[];
return['',
`Battle damage inputs (defender + weapon nominal; unitStatRatio: ${DC_SHEET_UNIT_STAT_RATIO?'Firered RoundUp((UnAtk/10)−(UnDef/10))':'legacy floor tenths'}):`,
`  MS DEF from map-stats pair (pre-debuff): ${fmtN(rr.defMsDefensePair|0)}`,
`  stats_raw Defense (sheet total) / bonus slice: ${fmtN(rr.defMsStatsRawDefense|0)} / ${fmtN(rr.defMsBonusDefense|0)}`,
`  DEF debuff % (field+weapon): ${rr.defDebuffPct|0}%; flat subtract from pair DEF: ${fmtN(rr.defDebuffFlatSubtract|0)} → MS DEF used: ${fmtN(rr.unitDef|0)}`,
`  Pilot DEF (stats_raw): ${fmtN(rr.charDef|0)}`,
`  Attacker MS ATK (final): ${fmtN(rr.unitAtk|0)}; Advantage tag %: ${rr.advantageTagAtkPct|0}${(rr.supportCounterAtkPctApplied|0)>0?`; Support Attack/Counter MS ATK: +${rr.supportCounterAtkPctApplied}%`:''}`,
`  combatWeaponPower: ${fmtN(rr.combatWeaponPower|0)} (display ${fmtN(rr.weaponPower|0)}; qub +1: ${rr.qubPlusOneApplied?'applied':'off — set DC_QUB_PLUS_ONE in app.js'})`,
`  baseDamage: ${fmtN(rr.baseDamage)}, damageCorrection: ${fmtN(rr.damageCorrection)}, terrainCorr: ${rr.terrainCorrection}, battleDamage: ${fmtN(rr.battleDamage)}`];
}
function copyDcResultText(){
const r=S.dc._lastResult;if(!r)return;
const npc=S.dc.defNpc;
const nName=npc?(npc.unit?.name||'NPC'):'?';
const vigor=`${t('dc_vigor_prefix')}: ${_dcVigorLabel(S.dc.mpLevel)}, Terrain: ${S.dc.terrainMode||'normal'}`;
const multi=S.dc._lastMultiResults;
const lines=[`⚔ GGen Damage Simulator Result`,`Target: ${nName}`];
if(multi&&multi.length>1){
multi.forEach(m=>{
const rr=m.result,ud=m.slot.atkUnitData,cd=m.slot.atkCharData,sl=m.slot;
const uName=ud?ud.name:'?';const cName=cd?cd.name:'?';
const wNm=_dcWeaponDisplayNameForSlot(ud,sl.wpnIdx);
const npcHp=Math.max(0,rr.npcHp|0);
const hpRemN=Math.max(0,npcHp-rr.normalDmg);
const hpRemC=Math.max(0,npcHp-rr.critDmg);
const pctN=npcHp>0?Math.min(100,(hpRemN/npcHp)*100):0;
const pctC=npcHp>0?Math.min(100,(hpRemC/npcHp)*100):0;
lines.push(`--- Attacker ${m.idx+1}: ${uName} + ${cName}`);
lines.push(`Weapon: ${wNm} (power ${fmtN(rr.weaponPower)})`);
lines.push(`Normal Damage: ${fmtN(rr.normalDmg)}`);
lines.push(`${rr.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg')}: ${fmtN(rr.critDmg)}`);
lines.push(`Hit Rate: ${rr.hitRate}%`);
_dcCopyLinesWeaponTraitBonus(rr).forEach(x=>lines.push(x));
if((rr.exSquadAtkPct|0)>0)lines.push(`EX squad ATK: +${rr.exSquadAtkPct}% (on growth after option-part ATK %; then supporter leader % on Attack)`);
if((rr.squadCondAtkPct|0)>0||(rr.squadCondDefPct|0)>0)lines.push(`Squad conditions: +${rr.squadCondAtkPct|0}% MS ATK`+((rr.squadCondDefPct|0)>0?`, +${rr.squadCondDefPct|0}% MS DEF`:``)+` (same % bucket as other sheet ATK/DEF %)`);
if((rr.counterOwnAtkPct|0)>0)lines.push(`Own ATK when countering: +${rr.counterOwnAtkPct}% (MS Attack; pilot EX ability toggle + checkbox)`);
if((rr.supportCounterAtkPctApplied|0)>0)lines.push(`Support Attack/Counter: +${rr.supportCounterAtkPctApplied}% MS ATK (Support-role pilot passive; toggle in Attacker Parameters)`);
if((rr.advantageTagAtkPct|0)>0)lines.push(`Advantage (enemy tag): +floor(${rr.advantageTagAtkPct}% × raw LB MS Attack base) when defender matches (flat add, not +% on total)`);
lines.push(`HP Remaining (Normal): ${fmtN(hpRemN)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctN.toFixed(1)+'%)':''}`);
lines.push(`${rr.isSuperVigor?t('dc_hp_remaining_super_crit'):t('dc_hp_remaining_crit')}: ${fmtN(hpRemC)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctC.toFixed(1)+'%)':''}`);
lines.push(`${t('dc_vigor_prefix')}: ${_dcVigorLabel(m.slot.mpLevel||'medium')}, Terrain: ${m.slot.terrainMode||'normal'}`);
_dcCopyLinesBattleDamageDiagnostics(rr).forEach(x=>lines.push(x));
_dcCopyLinesDamageFormulas(rr).forEach(x=>lines.push(x));
});
}else{
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData;
const uName=ud?ud.name:'?';const cName=cd?cd.name:'?';
const wNm=_dcWeaponDisplayNameForSlot(ud,S.dc.wpnIdx);
const npcHp=Math.max(0,r.npcHp|0);
const hpRemN=Math.max(0,npcHp-r.normalDmg);
const hpRemC=Math.max(0,npcHp-r.critDmg);
const pctN=npcHp>0?Math.min(100,(hpRemN/npcHp)*100):0;
const pctC=npcHp>0?Math.min(100,(hpRemC/npcHp)*100):0;
lines.push(`Attacker: ${uName} + ${cName}`);
lines.push(`Weapon: ${wNm} (power ${fmtN(r.weaponPower)})`);
lines.push(`Normal Damage: ${fmtN(r.normalDmg)}`);
lines.push(`${r.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg')}: ${fmtN(r.critDmg)}`);
lines.push(`Hit Rate: ${r.hitRate}%`);
_dcCopyLinesWeaponTraitBonus(r).forEach(x=>lines.push(x));
if((r.exSquadAtkPct|0)>0)lines.push(`EX squad ATK: +${r.exSquadAtkPct}% (on growth after option-part ATK %; then supporter leader % on Attack)`);
if((r.squadCondAtkPct|0)>0||(r.squadCondDefPct|0)>0)lines.push(`Squad conditions: +${r.squadCondAtkPct|0}% MS ATK`+((r.squadCondDefPct|0)>0?`, +${r.squadCondDefPct|0}% MS DEF`:``)+` (same % bucket as other sheet ATK/DEF %)`);
if((r.counterOwnAtkPct|0)>0)lines.push(`Own ATK when countering: +${r.counterOwnAtkPct}% (MS Attack; pilot EX ability toggle + checkbox)`);
if((r.supportCounterAtkPctApplied|0)>0)lines.push(`Support Attack/Counter: +${r.supportCounterAtkPctApplied}% MS ATK (Support-role pilot passive; toggle in Attacker Parameters)`);
if((r.advantageTagAtkPct|0)>0)lines.push(`Advantage (enemy tag): +floor(${r.advantageTagAtkPct}% × raw LB MS Attack base) when defender matches (flat add, not +% on total)`);
lines.push(`HP Remaining (Normal): ${fmtN(hpRemN)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctN.toFixed(1)+'%)':''}`);
lines.push(`${r.isSuperVigor?t('dc_hp_remaining_super_crit'):t('dc_hp_remaining_crit')}: ${fmtN(hpRemC)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctC.toFixed(1)+'%)':''}`);
lines.push(vigor);
_dcCopyLinesBattleDamageDiagnostics(r).forEach(x=>lines.push(x));
_dcCopyLinesDamageFormulas(r).forEach(x=>lines.push(x));
}
navigator.clipboard.writeText(lines.join('\n')).then(()=>{
const ov=document.getElementById('dcBattleStatsOverlay');
let m=null;
try{if(ov&&window.getComputedStyle(ov).display!=='none')m=document.getElementById('dcBattleStatsCopyMsg')}catch(_){}
if(!m)m=document.getElementById('dcShareMsg');
if(m){m.textContent='Copied to clipboard!';setTimeout(()=>{if(m.textContent==='Copied to clipboard!')m.textContent=''},2000)}
});
}
function shareDcLink(){
const url=_dcBuildShareUrl();
navigator.clipboard.writeText(url).then(()=>{
const m=document.getElementById('dcShareMsg');if(m){m.textContent='Link copied to clipboard!';setTimeout(()=>m.textContent='',2000)}
});
}

const _origSetupKeys=setupKeys;
setupKeys=function(){_origSetupKeys();
document.addEventListener('keydown',e=>{
if(e.key==='Escape'){
if(document.getElementById('dcPickerOverlay').classList.contains('active')){closeDcPicker();e.stopPropagation();return}
if(document.getElementById('cmpPickerOverlay').classList.contains('active')){closeCompPicker();e.stopPropagation()}
else if(document.getElementById('cmpOverlay').classList.contains('active')){closeCompareModal();e.stopPropagation()}
}
})
};
function renderRankingList(d){const rows=d.rows||[];const bounds=d.stat_bounds;const sortKey=(d.sort||'');const host=document.getElementById('rankListInner');const empty=document.getElementById('rankEmpty');const load=document.getElementById('rankLoading');if(load)load.style.display='none';if(!host)return;const isChar=S.ranking.mode==='characters';const typ=isChar?'character':'unit';const thumbKind=isChar?'char':'unit';const vm=(S.ranking&&S.ranking.viewMode)||'list';if(vm==='podium'){const topRows=rows.slice(0,15);const mk=(row,rank)=>{const val=Number(row&&row[sortKey]||0);const id=escAttr(String(row&&row.id||''));const n=esc(row&&row.name||'-');const img=renderListThumb(row,thumbKind,44);const o=encodeURIComponent(JSON.stringify(detailRecommendOptsForType(typ)));const ped=rank===1?100:(rank===2?78:(rank===3?66:50));const cls=rank<=3?`is-r${rank}`:'is-rest';return`<button type="button" class="ranking-podium-col ${cls}" data-detail-type="${typ}" data-detail-id="${id}" data-detail-opts="${o}" onclick="openDetailFromRanking(this)" title="${n}"><span class="ranking-podium-rank">#${rank}</span><span class="ranking-podium-rail"><span class="ranking-podium-fill" style="height:${ped}%"></span></span><span class="ranking-podium-thumb">${img}</span><span class="ranking-podium-val">${fmtN(val)}</span></button>`};const top=`<div class="ranking-pyramid-top">${topRows[1]?mk(topRows[1],2):''}${topRows[0]?mk(topRows[0],1):''}${topRows[2]?mk(topRows[2],3):''}</div>`;const rest=`<div class="ranking-pyramid-rest">${topRows.slice(3).map((r,i)=>mk(r,i+4)).join('')}</div>`;host.classList.add('ranking-list-inner--podium');host.innerHTML=topRows.length?`<div class="ranking-podium-board ranking-podium-board--pyramid">${top}${rest}</div>`:`<div class="empty-state"><div class="empty-state-text">${esc(t('empty'))}</div></div>`;if(empty)empty.style.display='none';syncRankingViewModeUi();return}host.classList.remove('ranking-list-inner--podium');if(!rows.length){host.innerHTML='';if(empty){empty.style.display='block';empty.querySelector('.empty-state-text').textContent=S.ranking.mode==='characters'?t('empty_char'):t('empty_unit')}return}if(empty)empty.style.display='none';host.innerHTML=rows.map((row,idx)=>{const rank=(d.page-1)*(d.per_page||50)+idx+1;const statVal=row[sortKey];const name=esc(row.name||'-');const id=escAttr(String(row.id||''));const img=renderListThumb(row,thumbKind,52);const bar=renderRankingRowBar(statVal,bounds);const o=encodeURIComponent(JSON.stringify(detailRecommendOptsForType(typ)));return`<button type="button" class="ranking-row" data-detail-type="${typ}" data-detail-id="${id}" data-detail-opts="${o}" onclick="openDetailFromRanking(this)"><span class="ranking-rank-num">#${rank}</span><span class="ranking-row-thumb">${img}</span><span class="ranking-row-name">${name}</span><span class="ranking-row-stat"><span class="ranking-stat-val">${fmtN(statVal)}</span>${bar}</span></button>`}).join('');syncRankingViewModeUi();renderPag('rank',d)}
async function loadRankingList(p=1){if(S.currentTab!=='ranking')return;p=Number(p)||1;const mode=S.ranking.mode;const vm=(S.ranking&&S.ranking.viewMode)||'list';if(vm==='podium')p=1;const ppEl=document.getElementById('rankPerPage');const pp=ppEl?parseInt(ppEl.value,10)||50:50;if(mode==='characters')S.ranking.pageChar=p;else S.ranking.pageUnit=p;const url=mode==='characters'?buildRankingCharactersListUrl(p,pp):buildRankingUnitsListUrl(p,pp);const load=document.getElementById('rankLoading');const host=document.getElementById('rankListInner');if(load)load.style.display='flex';if(host)host.innerHTML='';try{const r=await fetch(url);const d=await r.json();_rankingLastPayloadByMode[mode==='characters'?'characters':'units']=d;if(mode==='units'){applyWeaponDebuffPresentFromApi(d);applyMechanismPresentFromApi(d)}renderRankingList(d)}catch(e){if(load)load.style.display='none';if(host)host.innerHTML=`<div class="empty-state"><div class="empty-state-text">${esc(String(e))}</div></div>`}}
function ensureRankingTopControlEnhancements(){const panel=document.getElementById('panel-ranking');if(!panel)return;const row=document.querySelector('#panel-ranking .ranking-sort-row');const trailing=document.querySelector('#panel-ranking .ranking-head-trailing');if(!row)return;ensureRankingExperimentalState();const dirBtn=document.getElementById('rankingDirBtn');const listSvg=`<svg class="ranking-view-svg" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="3.5" width="14" height="2.5" rx="1"/><rect x="2" y="8" width="14" height="2.5" rx="1"/><rect x="2" y="12.5" width="14" height="2.5" rx="1"/></svg>`;const html=`<button type="button" class="ranking-view-btn" data-ranking-view="list" onclick="setRankingViewMode('list')" title="List">${listSvg}<span class="ranking-view-txt">List</span></button><button type="button" class="ranking-view-btn" data-ranking-view="podium" onclick="setRankingViewMode('podium')" title="Dashboard"><img class="ranking-view-icon" src="${imgUrl('/static/images/UI/UI_Home_Campaign_Image_01.webp')}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'"><span class="ranking-view-txt">Dashboard</span></button>`;const exp=`<div class="ranking-exp-switches"><button type="button" class="ranking-exp-switch${S.ranking.showPercentDiff?' active':''}" data-exp-key="pct" onclick="toggleRankingPercentDiffMode()" title="% diff between ranks"><span class="ranking-exp-switch-text">%</span><span class="ranking-exp-switch-track${S.ranking.showPercentDiff?' active':''}"><span class="ranking-exp-switch-thumb"></span></span></button><button type="button" class="ranking-exp-switch${S.ranking.compareMode?' active':''}" data-exp-key="cmp" onclick="toggleRankingCompareMode()" title="% compare mode"><span class="ranking-exp-switch-text">Vs</span><span class="ranking-exp-switch-track${S.ranking.compareMode?' active':''}"><span class="ranking-exp-switch-thumb"></span></span></button></div>`;let toggle=panel.querySelector('.ranking-view-toggle');if(!toggle){toggle=document.createElement('div');toggle.className='ranking-view-toggle';toggle.setAttribute('role','group');toggle.setAttribute('aria-label','Ranking view mode')}toggle.innerHTML=html;if(trailing){let wrap=trailing.querySelector('.ranking-head-view-wrap');if(!wrap){wrap=document.createElement('div');wrap.className='ranking-head-view-wrap';while(trailing.firstChild)wrap.appendChild(trailing.firstChild);trailing.appendChild(wrap)}if(dirBtn&&!wrap.contains(dirBtn))wrap.appendChild(dirBtn);if(toggle.parentElement!==wrap)wrap.insertBefore(toggle,dirBtn||null)}else{if(dirBtn){if(toggle.parentElement!==row)row.insertBefore(toggle,dirBtn)}else if(toggle.parentElement!==row)row.appendChild(toggle)}const tails=[...panel.querySelectorAll('.ranking-tail-controls')];let tail=tails.find(el=>el.querySelector('.ranking-exp-controls'))||tails[0];tails.forEach(el=>{if(el!==tail)el.remove()});if(!tail){tail=document.createElement('div');tail.className='ranking-tail-controls';row.appendChild(tail)}tail.querySelectorAll('.ranking-view-toggle').forEach(el=>el.remove());const strayDir=tail.querySelector('#rankingDirBtn');if(strayDir){const rkWrap=trailing&&trailing.querySelector('.ranking-head-view-wrap');if(rkWrap)rkWrap.appendChild(strayDir);else(trailing||row).appendChild(strayDir)}if(trailing&&dirBtn){const rkWrap=trailing.querySelector('.ranking-head-view-wrap');if(rkWrap&&toggle.parentElement===rkWrap&&toggle.nextElementSibling!==dirBtn)rkWrap.insertBefore(toggle,dirBtn)}let ex=panel.querySelector('.ranking-exp-controls');if(!ex){ex=document.createElement('div');ex.className='ranking-exp-controls'}ex.innerHTML=exp;if(ex.parentElement!==tail)tail.appendChild(ex);syncRankingTailControlsPlacement()}

const _detailRankingIndexCache=new Map();
const _detailRankingIndexInflight=new Map();
function detailRankingIndexKey(type){const mode=type==='character'?'characters':'units';const qEl=document.getElementById(mode==='characters'?'rankCharFilter':'rankUnitFilter');const q=qEl?String(qEl.value||'').trim():'';return`${S.lang}:${mode}:${detailRankingPerspectiveKey(type)}:${q}:${JSON.stringify([S.listRankCharLineage,S.listRankCharSeries,S.listRankCharSkills,S.listRankCharAbilities,S.listRankUnitLineage,S.listRankUnitSeries,S.listRankUnitAbilities,S.listRankUnitTerrain,S.listRankUnitWeaponDebuff,S.listRankUnitMechanism,S.listRankCharSource,S.listRankUnitSource,S.listRankCharSp,S.listRankCharCond,S.listRankUnitSp,S.listRankUnitSsp,S.listRankUnitCond])}`}
function primeDetailRankingMetaFromIndex(type,id,byStat){const idx=_detailRankingIndexCache.get(detailRankingIndexKey(type));if(!idx)return byStat;const out=byStat||{};const iid=String(id);Object.keys(idx).forEach(sk=>{if(out[sk])return;const ent=idx[sk]&&idx[sk].byId&&idx[sk].byId.get(iid);if(ent)out[sk]={rank:ent.rank,total:idx[sk].total||0,value:ent.value||0,bounds:idx[sk].bounds||null}});return out}
function detailRankingStatValueFromRow(row,sk){if(!row)return 0;const v=row[sk];if(v!=null&&v!=='')return Number(v)||0;if(sk==='ATK')return Number(row.Attack!=null?row.Attack:row.ATK)||0;if(sk==='DEF')return Number(row.Defense!=null?row.Defense:row.DEF)||0;if(sk==='MOB')return Number(row.Mobility!=null?row.Mobility:row.MOB)||0;return 0}
function unitRankingCountRowsAheadSorted(rows,sk,myVal,myName,myId){let ahead=0;const nm=String(myName||''),tid=String(myId||'');if(!rows||!rows.length)return ahead;for(let i=0;i<rows.length;i++){const x=rows[i];const xv=detailRankingStatValueFromRow(x,sk);if(xv>myVal){ahead++;continue}if(xv<myVal)continue;const xn=String(x&&x.name||''),xid=String(x&&x.id||'');if(xn<nm){ahead++;continue}if(xn>nm)continue;if(xid.localeCompare(tid)<0)ahead++}return ahead}
function augmentTransformAlternateUnitRankingMeta(d,detailUnitId,byStat){if(!d||String(d.id)!==String(detailUnitId)||!d.is_transform_alternate)return byStat;const idx=_detailRankingIndexCache.get(detailRankingIndexKey('unit'));if(!idx)return byStat;const nm=String(d.name||'');const unitRows=detailStatRowsForCurrentState(d,'unit');if(!unitRows.length)return byStat;const out={...byStat};const sortKeys=['HP','EN','ATK','DEF','MOB'];unitRows.forEach(s=>{const sk=detailRankingSortKeyForStat('unit',s&&s.name);if(!sk||sortKeys.indexOf(sk)<0)return;const block=idx[sk];const ord=block&&block.orderedRows;if(!ord||!ord.length)return;const myVal=Number(s&&s.total)||0;const rank=unitRankingCountRowsAheadSorted(ord,sk,myVal,nm,String(detailUnitId))+1;out[sk]={rank,total:block.total||ord.length,value:myVal,bounds:block.bounds||null}});return out}
async function warmDetailRankingIndex(type){const key=detailRankingIndexKey(type);if(_detailRankingIndexCache.has(key))return _detailRankingIndexCache.get(key);if(_detailRankingIndexInflight.has(key))return _detailRankingIndexInflight.get(key);const mode=type==='character'?'characters':'units';const sortKeys=type==='character'?['Ranged','Melee','Awaken','Defense','Reaction']:['HP','EN','ATK','DEF','MOB'];const p=(async()=>{const r=await fetch(rankingListUrlFor(mode,sortKeys[0],1,50000,'desc',true,true));if(!r.ok)return{};const d=await r.json();const all=Array.isArray(d&&d.rows)?d.rows:[];const total=Number(d&&d.total||0)||all.length;const out={};if(all.length){sortKeys.forEach(sk=>{const arr=all.slice().sort((a,b)=>{const av=detailRankingStatValueFromRow(a,sk),bv=detailRankingStatValueFromRow(b,sk);if(bv!==av)return bv-av;const an=String(a&&a.name||''),bn=String(b&&b.name||'');if(an!==bn)return an.localeCompare(bn);return String(a&&a.id||'').localeCompare(String(b&&b.id||''))});const byId=new Map();let mn=Infinity,mx=-Infinity;arr.forEach((x,i)=>{const val=detailRankingStatValueFromRow(x,sk);byId.set(String(x&&x.id||''),{rank:i+1,value:val});if(val<mn)mn=val;if(val>mx)mx=val});if(byId.size)out[sk]={total:total||arr.length,bounds:Number.isFinite(mn)&&Number.isFinite(mx)?{min:mn,max:mx}:null,byId,orderedRows:arr}})}if(Object.keys(out).length)_detailRankingIndexCache.set(key,out);while(_detailRankingIndexCache.size>20){const k=_detailRankingIndexCache.keys().next().value;_detailRankingIndexCache.delete(k)}return out})().finally(()=>_detailRankingIndexInflight.delete(key));_detailRankingIndexInflight.set(key,p);return p}
async function ensureDetailRankingStats(type,id){if((type!=='character'&&type!=='unit')||!id)return null;const ck=detailRankingCacheKey(type,id);const iid=String(id);if(_detailRankingStatsCache.has(ck))return _detailRankingStatsCache.get(ck);if(_detailRankingStatsInflight.has(ck))return await _detailRankingStatsInflight.get(ck);seedDetailRankingFromLastPayload(type,iid,ck);let byStat=primeDetailRankingMetaFromIndex(type,iid,_detailRankingStatsCache.get(ck)||{});if(type==='unit'&&S.currentDetailData&&String(S.currentDetailData.id)===iid)byStat=augmentTransformAlternateUnitRankingMeta(S.currentDetailData,iid,byStat);if(Object.keys(byStat).length){_detailRankingStatsCache.set(ck,byStat);refreshDetailRankingIfActive(type,iid)}const sortKeys=type==='character'?['Ranged','Melee','Awaken','Defense','Reaction']:['HP','EN','ATK','DEF','MOB'];if(sortKeys.every(sk=>byStat[sk]))return byStat;const p=(async()=>{try{await warmDetailRankingIndex(type)}catch(_){}let merged=primeDetailRankingMetaFromIndex(type,iid,_detailRankingStatsCache.get(ck)||{});if(type==='unit'&&S.currentDetailData&&String(S.currentDetailData.id)===iid)merged=augmentTransformAlternateUnitRankingMeta(S.currentDetailData,iid,merged);_detailRankingStatsCache.set(ck,merged);refreshDetailRankingIfActive(type,iid);return merged})().finally(()=>_detailRankingStatsInflight.delete(ck));_detailRankingStatsInflight.set(ck,p);return await p}

async function loadRankingList(p=1){if(S.currentTab!=='ranking')return;p=1;const mode=S.ranking.mode;const vm=(S.ranking&&S.ranking.viewMode)||'list';const pp=(vm==='list'||vm==='podium')?20:((el=>el?parseInt(el.value,10)||50:50)(document.getElementById('rankPerPage')));if(mode==='characters')S.ranking.pageChar=p;else S.ranking.pageUnit=p;void warmDetailRankingIndex('character');void warmDetailRankingIndex('unit');const url=mode==='characters'?buildRankingCharactersListUrl(p,pp):buildRankingUnitsListUrl(p,pp);const load=document.getElementById('rankLoading');const host=document.getElementById('rankListInner');const pg=document.querySelector('#panel-ranking .pagination-bar-wrap');if(pg)pg.style.display='none';if(load)load.style.display='flex';try{const r=await fetch(url);const d=await r.json();_rankingLastPayloadByMode[mode==='characters'?'characters':'units']=d;if(mode==='units'){applyWeaponDebuffPresentFromApi(d);applyMechanismPresentFromApi(d)}renderRankingList(d)}catch(e){if(load)load.style.display='none';if(host)host.innerHTML=`<div class="empty-state"><div class="empty-state-text">${esc(String(e))}</div></div>`}finally{void warmDetailRankingIndex('character');void warmDetailRankingIndex('unit')}}
function rankingOrdinalLabel(n){n=Number(n)||0;const mod100=n%100;if(mod100>=11&&mod100<=13)return`${n}th`;switch(n%10){case 1:return`${n}st`;case 2:return`${n}nd`;case 3:return`${n}rd`;default:return`${n}th`}}
function rankingPctText(v){const n=Number(v)||0;const abs=Math.abs(n);const dec=abs>=100?0:(abs>=10?1:2);return`${n>=0?'+':''}${n.toFixed(dec)}%`}
function clearRankingCompareSelections(){
ensureRankingExperimentalState();
S.ranking.compareBaseId='';
S.ranking.compareTargetIds=[];
const host=document.getElementById('rankListInner');
if(!host)return;
host.classList.remove('ranking-matrix-compare-active');
const board=host.querySelector('.ranking-podium-board--dashboard');
if(board)board.classList.remove('ranking-matrix-compare-active');
host.querySelectorAll('.ranking-matrix-row.is-compare-base,.ranking-matrix-row.is-compare-target,.ranking-dash-card.is-compare-base,.ranking-dash-card.is-compare-target').forEach(el=>el.classList.remove('is-compare-base','is-compare-target'));
const layer=(board&&board.querySelector('.ranking-compare-layer'))||host.querySelector('.ranking-compare-layer');
if(layer)layer.classList.remove('active');
}
function applyRankingCompareVisuals(){
const host=document.getElementById('rankListInner');
if(!host)return;
ensureRankingExperimentalState();
const vm=(S.ranking&&S.ranking.viewMode)||'list';
const itemSel=vm==='podium'?'.ranking-dash-card':'.ranking-matrix-row';
const rows=Array.from(host.querySelectorAll(itemSel));
rows.forEach(r=>r.classList.remove('is-compare-base','is-compare-target'));
const baseId=String(S.ranking.compareBaseId||'');
const canvas=(vm==='podium'?(host.querySelector('.ranking-podium-board--dashboard')||host):host);
if(!S.ranking.compareMode||!baseId){
canvas.classList.remove('ranking-matrix-compare-active');
const l=canvas.querySelector('.ranking-compare-layer');
if(l)l.classList.remove('active');
return
}
const baseRow=rows.find(r=>String(r.getAttribute('data-detail-id'))===baseId);
if(!baseRow){
clearRankingCompareSelections();
return
}
baseRow.classList.add('is-compare-base');
const targetRows=(Array.isArray(S.ranking.compareTargetIds)?S.ranking.compareTargetIds:[]).map(String).filter(id=>id&&id!==baseId).map(id=>rows.find(r=>String(r.getAttribute('data-detail-id'))===id)).filter(Boolean);
targetRows.forEach(r=>r.classList.add('is-compare-target'));
canvas.classList.toggle('ranking-matrix-compare-active',true);
let layer=canvas.querySelector('.ranking-compare-layer');
if(!layer){
layer=document.createElement('div');
layer.className='ranking-compare-layer';
layer.innerHTML='<svg class="ranking-compare-svg"></svg><div class="ranking-compare-labels"></div>';
canvas.appendChild(layer)
}
const svg=layer.querySelector('.ranking-compare-svg');
const labelsWrap=layer.querySelector('.ranking-compare-labels');
svg.setAttribute('viewBox',`0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
svg.setAttribute('width',String(canvas.clientWidth));
svg.setAttribute('height',String(canvas.clientHeight));
if(!targetRows.length){
svg.innerHTML='';
if(labelsWrap)labelsWrap.innerHTML='';
layer.classList.remove('active');
return
}
const hr=canvas.getBoundingClientRect();
const br=baseRow.getBoundingClientRect();
const x1=Math.max(12,(br.left-hr.left)+br.width*0.68);
const y1=(br.top-hr.top)+br.height*0.5;
const vBase=Number(baseRow.getAttribute('data-rank-value')||0);
let paths='';
let labels='';
const sortedTargets=targetRows.slice().sort((a,b)=>{
const ay=a.getBoundingClientRect().top,by=b.getBoundingClientRect().top;
return ay-by
});
const n=sortedTargets.length;
const slotStep=n<=3?12:(n<=5?10:8);
const slots=sortedTargets.map((_,i)=>i-(n-1)/2);
const usedLabelBoxes=[];
sortedTargets.forEach((tr,i)=>{
const rr=tr.getBoundingClientRect();
const x2=Math.max(12,(rr.left-hr.left)+rr.width*0.68);
const y2=(rr.top-hr.top)+rr.height*0.5;
const slot=slots[i];
const absSlot=Math.abs(slot);
const dy=y2-y1;
const fan=slot*slotStep;
const bendBase=Math.min(48,Math.max(14,Math.abs(dy)*0.2));
const c1x=x1+42+absSlot*9;
const c1y=y1+fan*0.75;
const c2x=Math.max(x1+28,x2-42-absSlot*8);
const c2y=y2-fan*0.58;
const v2=Number(tr.getAttribute('data-rank-value')||0);
const pct=vBase?((v2-vBase)/Math.abs(vBase))*100:0;
const cls=pct>=0?'is-pos':'is-neg';
const pid=`cmpPath${i}`;
paths+=`<path id="${pid}" class="ranking-compare-path ${cls}" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"></path>`;
let lx=x1+(x2-x1)*0.56+fan*0.32;
let ly=y1+dy*0.56+fan*0.52;
const lw=62,lh=22;
for(let k=0;k<usedLabelBoxes.length;k++){const b=usedLabelBoxes[k];const overlap=Math.abs(lx-b.x)<(lw+b.w)*0.5&&Math.abs(ly-b.y)<(lh+b.h)*0.5;if(overlap)ly+=(slot>=0?1:-1)*(lh+6)}
usedLabelBoxes.push({x:lx,y:ly,w:lw,h:lh});
labels+=`<div class="ranking-compare-label ${cls}" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px">${rankingPctText(pct)}</div>`
});
svg.innerHTML=paths;
if(labelsWrap)labelsWrap.innerHTML=labels;
svg.querySelectorAll('.ranking-compare-path').forEach(p=>{const len=p.getTotalLength();p.style.strokeDasharray=`${len}`;p.style.strokeDashoffset=`${len}`;p.getBoundingClientRect();p.style.strokeDashoffset='0'});
layer.classList.add('active')
}
function onRankingVisualItemClick(btn,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
ensureRankingExperimentalState();
if(!S.ranking.compareMode){openDetailFromRanking(btn);return}
const id=String(btn.getAttribute('data-detail-id')||'');
if(!id)return;
let base=String(S.ranking.compareBaseId||'');
let tgts=Array.isArray(S.ranking.compareTargetIds)?S.ranking.compareTargetIds.map(String):[];
if(!base){
S.ranking.compareBaseId=id;
S.ranking.compareTargetIds=[];
applyRankingCompareVisuals();
return
}
if(id===base){
S.ranking.compareMode=false;
clearRankingCompareSelections();
syncRankingViewModeUi();
const cur=S.ranking.mode==='characters'?'characters':'units';
const payload=_rankingLastPayloadByMode[cur];
if(payload)renderRankingList(payload);
return
}
if(tgts.includes(id))tgts=tgts.filter(x=>x!==id);else tgts.push(id);
S.ranking.compareTargetIds=tgts.slice(0,8);
applyRankingCompareVisuals()
}

function renderRankingList(d){
const rows=d.rows||[];
const sortKey=(d.sort||'');
const dir=String(d&&d.dir||(((S.ranking&&S.ranking.mode)==='characters')?S.ranking.dirChar:S.ranking.dirUnit)||'desc').toLowerCase()==='asc'?'asc':'desc';
const page=Math.max(1,Number(d&&d.page)||1);
const perPage=Math.max(1,Number(d&&d.per_page)||rows.length||20);
const total=Math.max(rows.length,Number(d&&d.total)||0);
const rankAt=(idx)=>{const abs=(page-1)*perPage+idx;const rk=dir==='desc'?(abs+1):(total-abs);return Math.max(1,rk)};
const host=document.getElementById('rankListInner');
const empty=document.getElementById('rankEmpty');
const load=document.getElementById('rankLoading');
if(load)load.style.display='none';
if(!host)return;
ensureRankingExperimentalState();
const isChar=S.ranking.mode==='characters';
const typ=isChar?'character':'unit';
const thumbKind=isChar?'char':'unit';
const vm=(S.ranking&&S.ranking.viewMode)||'list';
const disp=rows.slice(0,20);
if(vm==='podium'){
host.classList.add('ranking-list-inner--podium');
host.classList.remove('ranking-list-inner--matrix');
host.innerHTML=disp.length?`<div class="ranking-podium-board ranking-podium-board--dashboard">${disp.map((row,idx)=>{const rank=rankAt(idx);const badge=rankingOrdinalLabel(rank);const val=Number(row&&row[sortKey]||0);const id=escAttr(String(row&&row.id||''));const nm=esc(row&&row.name||'-');const o=encodeURIComponent(JSON.stringify(detailRecommendOptsForType(typ)));const img=renderListThumb(row,thumbKind,81);const tier=rank===1?'tier-1':rank===2?'tier-2':rank===3?'tier-3':rank<=10?'tier-4':'tier-5';const prevVal=idx>0?Number(disp[idx-1]&&disp[idx-1][sortKey]||0):0;const pctVsPrev=idx>0&&prevVal?((val-prevVal)/Math.abs(prevVal))*100:null;const pctHtml=S.ranking.showPercentDiff&&pctVsPrev!=null?`<span class="ranking-dash-diff ${pctVsPrev>=0?'is-pos':'is-neg'}">${rankingPctText(pctVsPrev)}</span>`:'';return`<button type="button" class="ranking-dash-card ${tier}" data-detail-type="${typ}" data-detail-id="${id}" data-rank-value="${val}" data-detail-opts="${o}" onclick="onRankingVisualItemClick(this,event)"><span class="ranking-dash-badge">${badge}</span><span class="ranking-dash-thumb">${img}</span><span class="ranking-dash-name">${nm}</span>${pctHtml}<span class="ranking-dash-val">${fmtN(val)}</span></button>`}).join('')}</div>`:`<div class="empty-state"><div class="empty-state-text">${esc(t('empty'))}</div></div>`;
if(empty)empty.style.display='none';
syncRankingViewModeUi();
applyRankingCompareVisuals();
return
}
host.classList.remove('ranking-list-inner--podium');
host.classList.add('ranking-list-inner--matrix');
if(!rows.length){
clearRankingCompareSelections();
host.innerHTML='';
if(empty){
empty.style.display='block';
empty.querySelector('.empty-state-text').textContent=S.ranking.mode==='characters'?t('empty_char'):t('empty_unit')
}
return
}
if(empty)empty.style.display='none';
const showPct=!!S.ranking.showPercentDiff;
const vals=disp.map(r=>Number(r&&r[sortKey]||0));
const mx=Math.max(1,...vals);
host.innerHTML=disp.map((row,idx)=>{
const rank=rankAt(idx);
const rankLabel=rankingOrdinalLabel(rank);
const statVal=Number(row&&row[sortKey]||0);
const prevVal=idx>0?Number(disp[idx-1]&&disp[idx-1][sortKey]||0):0;
const pctVsPrev=idx>0&&prevVal?((statVal-prevVal)/Math.abs(prevVal))*100:null;
const norm=Math.max(0,Math.min(1,statVal/mx));
const w=Math.max(22,norm*100);
const name=esc(row&&row.name||'-');
const id=escAttr(String(row&&row.id||''));
const img=renderListThumb(row,thumbKind,42);
const o=encodeURIComponent(JSON.stringify(detailRecommendOptsForType(typ)));
const pctHtml=showPct&&pctVsPrev!=null?`<span class="ranking-matrix-diff ${pctVsPrev>=0?'is-pos':'is-neg'}">${rankingPctText(pctVsPrev)}</span>`:'';
return`<button type="button" class="ranking-matrix-row" data-detail-type="${typ}" data-detail-id="${id}" data-rank-value="${statVal}" data-detail-opts="${o}" onclick="onRankingVisualItemClick(this,event)"><span class="ranking-matrix-start"><span class="ranking-matrix-thumb">${img}</span><span class="ranking-matrix-name">${name}</span></span><span class="ranking-matrix-track"><span class="ranking-matrix-fill" style="width:${w.toFixed(2)}%"></span></span><span class="ranking-matrix-end"><span class="ranking-matrix-dot">${rankLabel}</span>${pctHtml}<span class="ranking-matrix-val">${fmtN(statVal)}</span></span></button>`
}).join('');
syncRankingViewModeUi();
const pg=document.querySelector('#panel-ranking .pagination-bar-wrap');
if(pg)pg.style.display='none';
applyRankingCompareVisuals()
}
