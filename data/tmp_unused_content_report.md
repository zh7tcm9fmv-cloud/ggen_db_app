# Game trajectory / unused content (deep scan)
- Master: `MasterData_2026-08-24`
- LANG: EN/JA/TW/HK Lang_MasterData_2026-08-24
- Dump: `dump2.5.3.cs`
- Now: 2026-08-27 13:43 JST

## A) Orphan schedules (only in `m_schedule.json`)
- Total orphans: **188** | future orphans: **4**
- `2608501503` **2026-09-07 12:00 JST** → 2026-09-15 00:59 JST
- `2609301501` **2026-09-17 12:00 JST** → 2026-09-30 10:59 JST
- `2609301502` **2026-09-23 12:00 JST** → 2026-09-30 10:59 JST
- `2609301503` **2026-09-23 12:00 JST** → 2026-10-01 00:59 JST

Note: `2609301501/1502/1503` match the old Season 16 schedule *shape*, but live master has **no EventId 300019** and ML ends at **300018**. Strong leftover / pre-stage signal.

## B) Real upcoming schedule windows
- `2608402103` **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST
- `2608402104` **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST
- `2608409902` **2026-08-31 12:00 JST** → 2099-01-01 01:00 JST
- `2608409901` **2026-09-01 12:00 JST** → 2099-01-01 01:00 JST
- `2608501501` **2026-09-01 12:00 JST** → 2026-09-14 11:59 JST
- `2608501502` **2026-09-07 12:00 JST** → 2026-09-14 11:59 JST
- `2608501503` **2026-09-07 12:00 JST** → 2026-09-15 00:59 JST
- `2609301501` **2026-09-17 12:00 JST** → 2026-09-30 10:59 JST
- `2609301502` **2026-09-23 12:00 JST** → 2026-09-30 10:59 JST
- `2609301503` **2026-09-23 12:00 JST** → 2026-10-01 00:59 JST
- `2510102601` **2099-10-06 17:00 JST** → 2099-10-14 11:59 JST

### References
#### `2608402103` (2026-08-28 01:00 JST)
- `m_campaign.json` `ScheduleId` id=`126084020`
- `m_campaign.json` `ScheduleId` id=`126084021`
- `m_campaign.json` `ScheduleId` id=`126084022`
- `m_campaign.json` `ScheduleId` id=`126084023`
- `m_campaign.json` `ScheduleId` id=`126084024`
- `m_campaign.json` `ScheduleId` id=`126084025`
- `m_campaign.json` `ScheduleId` id=`126084026`
- `m_campaign.json` `ScheduleId` id=`126084027`

#### `2608402104` (2026-08-30 01:00 JST)
- `m_campaign.json` `ScheduleId` id=`126084028`
- `m_campaign.json` `ScheduleId` id=`126084029`
- `m_campaign.json` `ScheduleId` id=`126084030`
- `m_campaign.json` `ScheduleId` id=`126084031`
- `m_campaign.json` `ScheduleId` id=`126084032`
- `m_campaign.json` `ScheduleId` id=`126084033`
- `m_campaign.json` `ScheduleId` id=`126084034`
- `m_campaign.json` `ScheduleId` id=`126084035`
- `m_campaign.json` `ScheduleId` id=`126084036`
- `m_campaign.json` `ScheduleId` id=`126084037`
- `m_campaign.json` `ScheduleId` id=`126084038`

#### `2608409902` (2026-08-31 12:00 JST)
- `m_game_function_release.json` `ReleaseScheduleId` id=`0`

#### `2608409901` (2026-09-01 12:00 JST)
- `m_item.json` `ScheduleId` id=`300000021055`

#### `2608501501` (2026-09-01 12:00 JST)
- `m_event.json` `ScheduleId` id=`300018`

#### `2608501502` (2026-09-07 12:00 JST)
- `m_event.json` `ChallengeScheduleId` id=`300018`

#### `2608501503` (2026-09-07 12:00 JST)
- **No master row references** (orphan)

#### `2609301501` (2026-09-17 12:00 JST)
- **No master row references** (orphan)

#### `2609301502` (2026-09-23 12:00 JST)
- **No master row references** (orphan)

#### `2609301503` (2026-09-23 12:00 JST)
- **No master row references** (orphan)

#### `2510102601` (2099-10-06 17:00 JST)
- `m_event.json` `ScheduleId` id=`220002`
- `m_event.json` `ChallengeScheduleId` id=`220002`
- `m_sales_appeal.json` `ScheduleId` id=`2510100601`
- `m_stage.json` `ScheduleId` id=`99000102`

## C) Upcoming campaigns
- `126084020` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000125107001
- `126084021` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000125107002
- `126084022` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000125107003
- `126084023` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000125107004
- `126084024` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000125113005
- `126084025` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000126054001
- `126084026` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000126014001
- `126084027` type=None **2026-08-28 01:00 JST** → 2026-08-30 00:59 JST — 250200000126074001
- `126084028` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107006
- `126084029` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107007
- `126084030` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107008
- `126084031` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107009
- `126084032` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107010
- `126084033` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107011
- `126084034` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000126044002
- `126084035` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107012
- `126084036` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107013
- `126084037` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000125107014
- `126084038` type=None **2026-08-30 01:00 JST** → 2026-08-31 10:59 JST — 250200000126044001

## D) Sept 1 unlocks
- item `300000021055` —  (type=33)
- function release `ReleaseScheduleId`=`2608409902` **2026-08-31 12:00 JST** FunctionType=5
- function release `ReleaseScheduleId`=`9999990001` **2099-01-01 01:00 JST** FunctionType=41

## E) Notable events
- `220002` **[FUTURE]** type=8 2099-10-06 17:00 JST → 2099-10-14 11:59 JST — 
- `300018` **[FUTURE]** type=6 2026-09-01 12:00 JST → 2026-09-14 11:59 JST — 

## F) Master League
- Live `m_league_event` max EventId = **300018** (Season 15.5)
- **No 300019** row → Season 16 not in this master (site TEMP restore still applies)
- EventId=`300001` rewardGroup=`1` rankGroup=`1`
- EventId=`300002` rewardGroup=`2` rankGroup=`1`
- EventId=`300003` rewardGroup=`3` rankGroup=`1`
- EventId=`300004` rewardGroup=`4` rankGroup=`2`
- EventId=`300005` rewardGroup=`5` rankGroup=`1`
- EventId=`300006` rewardGroup=`6` rankGroup=`1`
- EventId=`300007` rewardGroup=`7` rankGroup=`1`
- EventId=`300008` rewardGroup=`8` rankGroup=`1`
- EventId=`300009` rewardGroup=`9` rankGroup=`1`
- EventId=`300010` rewardGroup=`10` rankGroup=`1`
- EventId=`300011` rewardGroup=`11` rankGroup=`1`
- EventId=`300012` rewardGroup=`12` rankGroup=`1`
- EventId=`300013` rewardGroup=`13` rankGroup=`3`
- EventId=`300014` rewardGroup=`14` rankGroup=`1`
- EventId=`300015` rewardGroup=`15` rankGroup=`1`
- EventId=`300016` rewardGroup=`16` rankGroup=`1`
- EventId=`300017` rewardGroup=`17` rankGroup=`1`
- EventId=`300018` rewardGroup=`18` rankGroup=`4`

## G) Placeholder `9999990001` shells (NPC / unobtainable)
- `m_unit.json`: **345**
- `m_character.json`: **471**
- `m_stage.json`: **0**
- These are **not** upcoming banner kits.

## H) Gacha
- Hidden / Sched=0: **15**
- `2504100201` IsShown=False Sched=`0` — 
- `2504100501` IsShown=True Sched=`0` — 
- `2504100502` IsShown=True Sched=`0` — 
- `2504100503` IsShown=True Sched=`0` — 
- `2504100504` IsShown=False Sched=`0` — 
- `2509600501` IsShown=False Sched=`2509601707` — 
- `2512400501` IsShown=False Sched=`2512401702` — 
- `2512400502` IsShown=False Sched=`2512401702` — 
- `2602200502` IsShown=False Sched=`2602201703` — 
- `2602200503` IsShown=False Sched=`2602201703` — 
- `2603500201` IsShown=False Sched=`2603501702` — 
- `2603600501` IsShown=False Sched=`2603601701` — 
- `2603600502` IsShown=False Sched=`2603601701` — 
- `2606500501` IsShown=False Sched=`2606501702` — 
- `2606500502` IsShown=False Sched=`2606501702` — 
### Newest by start
- `2608400403` **2026-08-24 12:00 JST** IsShown=True — 
- `2608200301` **2026-08-13 12:00 JST** IsShown=True — 
- `2608200501` **2026-08-13 12:00 JST** IsShown=True — 
- `2607500301` **2026-07-31 12:00 JST** IsShown=True — 
- `2607300302` **2026-07-16 12:00 JST** IsShown=True — 
- `2607300403` **2026-07-16 12:00 JST** IsShown=True — 
- `2607300501` **2026-07-16 12:00 JST** IsShown=True — 
- `2606500301` **2026-06-30 12:00 JST** IsShown=True — 

## I) Dump MemoryTables with no Master JSON
- `m_anime_streaming_episode`
- `m_anime_streaming_episode_free_schedule`
- `m_anime_streaming_series`
- `m_anime_streaming_series_group`
- `m_app_store_gift_card_item`
- `m_binder_complete_reward`
- `m_character_collection_book_voice`
- `m_special_event_stage_pickup_reward_override`
- `m_unit_collection_book_mypage`
- `m_unit_ssp_custom_core_general_material_set`
- `m_unit_skill_trait_condition`
- `m_adv_message`
- `m_dialog_help`
- `m_screen_help`
- `m_screen_help_set`
- `m_related_help`
- `m_search_word_group`
- `m_function_tutorial_content`
- `m_ai_attack_rule_set_content`
- `m_ai_counter_rule_set_content`
- `m_ai_use_skill_set_content`
- `m_map_chip_trait`
- `m_map_npc_unit_weapon_parameter_extension`
- `m_map_stage_exclude_area`
- `m_map_stage_trait_area`
- `m_stage_battle_side_type_priority_bgm`
- `m_stage_result_priority_bgm`
- `m_tag_set_content`
- `m_trait_visual_on_battle_end`
- `m_weapon_map_fixed_position_adv_message`
- `m_campaign_effect_target_reward_content_set_content`

Highest-signal: **Anime Streaming**, **Binder complete rewards**, **App Store gift cards**, collection-book voice/mypage, SSP general material set.

## J) Dump enum trajectory (`dump2.5.3.cs`)
- **LanguageType**: Ja=1, En=2, Tw=3, Hk=4, **Sc=5**, **Hr=6** (client locales beyond live EN/JA/TW/HK — CN/KR trajectory)
- **GashaType**: None=0, Normal=1, StepUp=2, ReLottery=3, Keep=4, **GiveBack=5**
- **EventType**: None, SideStory, StoryEvent, InvasionEvent, MapEvent, TowerEvent, MasterLeagueEvent, SdStoryEvent, SpecialEvent, LiteScenarioEvent, ChronicleEvent
- **ShopType**: includes Invisible=7; hole at value 1; typo Frirend=5
- No Season 16 strings in dump — season identity is master EventId only

## K) JA LANG files missing from EN
- `m_anime_streaming_episode.json`
- `m_anime_streaming_series.json`
- `m_anime_streaming_series_group.json`

## Summary (2026-08-27 JST)
1. **Aug 28–31** — campaign batch (`2608402103/2104`).
2. **Sep 1** — ML Season **15.5** (`EventId 300018`), item unlock, function release.
3. **Sep 7** — 15.5 challenge window (`2608501502`).
4. **Sep 17–30 schedules orphaned** (`260930*`) — Season-16-shaped leftovers; **no 300019**.
5. **No future gacha** beyond current Aug 24 banner in this pack.
6. **Client > data**: anime streaming / binder / gift-card tables in dump only.
7. **345 units / 471 chars** on `9999990001` = NPC shells, not banner trajectory.
