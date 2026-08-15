/**
 * Investment Guide (/ig) criteria localization (JA / TW / HK).
 * EN criteria payload is used as-is; this file supplies translated guide text.
 * Generated from scripts/output/_spi_criteria_en.json — do not hand-truncate.
 */
(function (global) {
  'use strict';

  const GUIDE = {
    "EN": {
      "overrides": [
        "Each score factor adds points; the total becomes a letter, then a bucket (BEYOND THE TIME / Recommended / Solid / Situational / Niche). Units: Attack 18+, Defense 22+, Support 19+ earn S+ and BEYOND THE TIME (score-ordered). Defense Type still rewards lasting ATK Down, survivability, and Preemptive Strike / Support Defense coverage in the point sum. Support Type still rewards lasting DEF Down / pierce in the point sum. Characters: kit points stay absolute; within each Character Type, S+ ≈ top 3% and S ≈ top 8% (absolute A+ floor); A+ and below use role-relative point cutoffs. Defense Type Characters also need a Defense or Reaction band for BEYOND THE TIME.",
        "Filter by Series, Tag, or Eternal Road Expert stage to compare Units and Characters that actually fit the same restriction.",
        "This is a general investment ranking that can also help on Expert — not a dedicated Expert-clears ladder."
      ],
      "gaps": []
    },
    "JA": {
      "overrides": [
        "各項目が加点され、合計がレターになり、さらに区分へ振り分けられます。ユニットは攻撃型 18点以上・耐久型 22点以上・支援型 19点以上で S+（BEYOND THE TIME）。点数が高いほど上位です。耐久型は持続攻撃力減少・生存・先制／支援防御を点数で評価し、支援型は持続防御力減少／貫通を点数で評価します。キャラクターは役割内の上位約3%が S+、約8%が S（絶対 A+ 以上が条件）。耐久型キャラクターの S+ は防御または反応が A+ 帯以上であることも条件です。A+ 以下は役割別の点数閾値です。",
        "シリーズ・タグ・エターナルロード Expert ステージで絞り、同じ制限に合うユニット／キャラクター同士を比較してください。",
        "一般運用向けの投資ランキングで、Expert でも使えることがある、という位置づけです（特定 Expert 攻略専用ではありません）。"
      ],
      "gaps": []
    },
    "TW": {
      "overrides": [
        "各項目加分後合計成字母，再對應分桶。單位攻擊型 18／耐久型 22／支援型 19 分以上為 S+（BEYOND THE TIME），分數越高越上位。耐久型仍以持續攻擊力減少、生存、先發／支援防禦計入分數；支援型仍以持續防禦力減少／貫穿計入分數。角色在各類型內約前 3% 為 S+、約前 8% 為 S（須達絕對 A+）；耐久型角色另需防禦或反應達 A+ 帶。A+ 以下用類型分數門檻。",
        "可用系列、標籤或永恆之路 Expert 關卡篩選，比較真正符合同一限制的單位與角色。",
        "這是偏一般投資用途的排名，也能偶爾用於 Expert — 不是專攻 Expert 通關的排行榜。"
      ],
      "gaps": []
    },
    "HK": {
      "overrides": [
        "各項目加分後合計成字母，再對應分桶。單位攻擊型 18／耐久型 22／支援型 19 分以上係 S+（BEYOND THE TIME），分數越高越上位。耐久型仍然用持續攻擊力減少、生存、先發／支援防禦計分；支援型仍然用持續防禦力減少／貫穿計分。角色喺各類型入面約前 3% 係 S+、約前 8% 係 S（要達絕對 A+）；耐久型角色另外要防禦或反應達 A+ 帶。A+ 以下用類型分數門檻。",
        "可用系列、標籤或永恆之路 Expert 關卡篩選，比較真正符合同一限制嘅單位同角色。",
        "呢個係偏一般投資用途嘅排名，都間中可以用喺 Expert — 唔係專攻 Expert 通關嘅排行榜。"
      ],
      "gaps": []
    }
  };

  const CRITERIA = {
    "JA": {
      "buckets": {
        "title": "レターからの区分",
        "summary": "点合計がレターになり、さらに区分へ振り分けられます。プレイヤーは主に区分を見ます。",
        "when": {
          "S+ Attack Type (score 18+)": "S+ 攻撃型（18点以上）",
          "S+ Defense Type (score 22+)": "S+ 耐久型（22点以上）",
          "S+ Support Type (score 19+)": "S+ 支援型（19点以上）",
          "S+ (score 17+)": "S+（17点以上）",
          "S+ Defense Type": "S+ 耐久型",
          "S+ Support Type": "S+ 支援型",
          "S+ Defense Type Characters": "S+ 耐久型キャラクター",
          "S+ (score 23+)": "S+（23点以上）",
          "S": "S",
          "A+ or A": "A+ または A",
          "B+ or B": "B+ または B",
          "C, D, or E": "C、D、または E"
        },
        "result": {
          "BEYOND THE TIME": "BEYOND THE TIME",
          "BEYOND THE TIME (Attack)": "BEYOND THE TIME（攻撃型）",
          "BEYOND THE TIME (Attack / Support)": "BEYOND THE TIME（攻撃型／支援型）",
          "BEYOND THE TIME only at 18+ if the kit tanks more than one hit (HP + Shield Defense / special DR / Unbreakable) and has Preemptive Strike or Support Defense coverage (unit SD kit or MOV 6)": "18点以上かつ、1撃以上耐える生存（HP＋シールド防御／特殊DR／脱出機能）と先制攻撃または支援防御カバー（機体キットまたは MOV 6）がある場合のみ BEYOND THE TIME",
          "BEYOND THE TIME only at 18+ if the kit tanks more than one hit (HP + Shield Defense / special DR / Unbreakable) and has lasting ATK Down at Lv5+ (30%+ — tank analog of Support DEF Down), and has Preemptive Strike or Support Defense coverage (unit SD kit or MOV 6)": "18点以上かつ持続攻撃力減少（Lv5／30%+）、1撃以上耐える生存（HP＋シールド防御／特殊DR／脱出機能）、先制攻撃または支援防御カバー（機体キットまたは MOV 6）がある場合のみ BEYOND THE TIME",
          "BEYOND THE TIME only at 17+ with lasting DEF Down / pierce at Lv5+ (30%+). MAP-only kits stay Recommended": "17点以上かつ持続防御力減少／貫通（Lv5／30%+）がある場合のみ BEYOND THE TIME。MAPのみのキットは推奨にとどまる",
          "BEYOND THE TIME only with Defense or Reaction band points (kit-only Durability Characters stay Recommended)": "防御または反応の帯点がある場合のみ BEYOND THE TIME（キット加点のみの耐久型キャラクターは推奨にとどまる）",
          "Recommended": "推奨",
          "Solid": "堅実",
          "Situational": "状況次第",
          "Niche": "ニッチ"
        }
      },
      "role_focus_attack": {
        "title": "攻撃型の優先事項",
        "summary": "まず火力上限（攻撃力＋武装威力）、次に移動力／MAP兵器。HP と SSP EN は上振れのみ — 高いと加点、低くても減点しません。機動力（回避）は弱い副次。",
        "when": {
          "Primary": "主軸",
          "Upside only": "上振れのみ",
          "Soft secondary": "弱い副次",
          "Great extras": "優秀な追加要素",
          "Not scored": "採点外"
        },
        "result": {
          "ATK · weapon power · MOV": "攻撃力 · 武装威力 · 移動力",
          "HP · SSP EN (no floor penalty)": "HP · SSP EN（床減点なし）",
          "Mobility / MOB (lower ceiling than ATK)": "機動力（上限は攻撃力より低い）",
          "MOB (lower ceiling than ATK)": "機動力（上限は攻撃力より低い）",
          "MAP presence / dash / coverage · special defense kits": "MAP存在／ダッシュ／範囲 · 特殊防御キット",
          "DEF · Debuff kinds · ATK Down / DEF Down · SP EN": "防御力 · 弱体種 · 攻撃力減少／防御力減少 · SP EN"
        }
      },
      "role_focus_defense": {
        "title": "耐久型の優先事項",
        "summary": "高 HP または DEF、シールド防御（約20%損傷無視）、支援防御カバー用の高 MOV、堅実な地形（宇宙＋地上または空中）、生存キット（損傷軽減／HP回復）、加えて攻撃力減少（支援型の防御力減少に相当する耐久手段）。ATK は上振れのみ（≥9000）。特殊防御（Iフィールド／バリア／DR）は追加の存在ボーナスです。BEYOND THE TIME には、1撃以上耐える生存と先制攻撃または支援防御カバーが追加で必要です。",
        "when": {
          "Primary": "主軸",
          "Secondary": "副次",
          "ATK upside": "ATK 上振れ",
          "Special defense": "特殊防御",
          "BEYOND THE TIME gate": "BEYOND THE TIME 条件"
        },
        "result": {
          "HP · DEF · shield · MOV · terrain · survivability abilities": "HP · DEF · シールド · MOV · 地形 · 生存アビリティ",
          "A few good pierce / DEF-down debuffs (R4+ kinds)": "良い貫通／DEFダウン弱体をいくつか（射程4+種）",
          "ATK Down strength (R4+ kinds) — tank analog of Support DEF Down": "攻撃力減少の強度（射程4+種）— 支援型の防御力減少に相当する耐久手段",
          "≥9000 mild bonus; below that, no penalty": "≥9000 で軽い加点；未満は減点なし",
          "Presence bonus for DR / barrier / negation kits": "DR／バリア／無効化キットの存在ボーナス",
          "18+ points, HP that survives more than one hit, and Preemptive Strike or Support Defense coverage": "18点以上、1撃以上耐える HP、先制攻撃または支援防御カバー",
          "18+ points, lasting ATK Down Lv5+, HP that survives more than one hit, and Preemptive Strike or Support Defense coverage": "18点以上、持続攻撃力減少 Lv5+、1撃以上耐える HP、先制攻撃または支援防御カバー"
        }
      },
      "role_focus_support": {
        "title": "支援型の優先事項",
        "summary": "弱体武装の射程は最低5（それ未満は弱い）、次に弱体の種類と強さ、次に高機動力／移動力。攻撃力と HP は軽い上振れのみ — 低い値への床減点はありません。",
        "when": {
          "Primary": "主軸",
          "Secondary": "副次"
        },
        "result": {
          "Weapon range ≥5 · R5+ debuff kinds · DEF Down · Mobility (MOB) · MOV": "武装射程≥5 · 射程5+弱体種 · 防御力減少 · 機動力 · 移動力",
          "ATK / weapon power / HP (mild upside, no floor penalty)": "攻撃力／武装威力／HP（軽い上振れ、床減点なし）"
        }
      },
      "er_access": {
        "title": "エターナルロード Expert 適性（ユニット）",
        "summary": "ユニットが出撃できるエターナルロード Expert ステージ数（タグ／シリーズ適性）。小さな適性差だけで帯が変わらないよう圧縮しています。",
        "when": {
          "0–1 Expert stages": "Expert ステージ 0–1",
          "2–6 Expert stages": "Expert ステージ 2–6",
          "7–999 Expert stages": "Expert ステージ 7–999"
        },
        "result": {}
      },
      "pilot_er_access": {
        "title": "エターナルロード Expert 適性（キャラクター）",
        "summary": "キャラクター制限のある Expert ステージのみを数えます。キャラ自由出撃ステージでは加点しません。",
        "when": {
          "0–0 character-restricted Expert stages": "キャラ制限 Expert 0",
          "1–1 character-restricted Expert stages": "キャラ制限 Expert 1",
          "2–999 character-restricted Expert stages": "キャラ制限 Expert 2+"
        },
        "result": {}
      },
      "pilot_combat_actions": {
        "title": "戦闘行動 — チャンスステップ／支援攻撃／支援防御 +1",
        "summary": "マスターデータ上の +1 行動経済（一覧×2フィルタと同系統）。ロール加重。クリア動画の採用頻度は使いません。",
        "when": {
          "Chance Step +1": "チャンスステップ +1",
          "Support Attack +1": "支援攻撃 +1",
          "Support Defense +1": "支援防御 +1"
        },
        "result": {}
      },
      "strategic_tags": {
        "title": "戦略タグ",
        "summary": "フレーバー以外のタグを、UR ユニットでの出現頻度で採点（限定 UR は常設 UR より重い）。すでに Expert 制限に出ているタグはここでは加点しない。上限 +2。",
        "when": {
          "weight 0–2": "重み 0–2",
          "weight 3–7": "重み 3–7",
          "weight 8–14": "重み 8–14",
          "weight 15–24": "重み 15–24",
          "weight ≥ 25": "重み ≥ 25"
        },
        "result": {}
      },
      "terrain": {
        "title": "地形適性（ユニット）",
        "summary": "出撃ティア ≥2 を使用可とみなします。追加／完璧は完全適性（Lv≥3・◯）。地形適性△（Lv2）の宇宙／空中は各−1。SSP 盤は SSP 強化後の地形。床は宇宙＋地上または空中（バイアラン式の宇宙＋空中も可）。",
        "when": {
          "Missing Space, or missing both Land and Atmospheric": "宇宙欠如、または地上と空中の両方欠如",
          "Space + Land (or Space + Atmospheric) at deploy Lv≥2": "宇宙＋地上（または宇宙＋空中）出撃 Lv≥2",
          "+ Atmospheric / Underwater / Sea at full affinity Lv≥3 (each)": "＋空中／水中／海（各・完全適性 Lv≥3）",
          "Triangle (Lv2) Space or Atmospheric (each)": "地形適性△（Lv2）の宇宙または空中（各）",
          "Perfect (4+ terrains at full affinity, no triangle)": "完璧（完全適性4つ以上・△なし）",
          "Perfect (4+ terrains at full affinity)": "完璧（完全適性の宇宙／地上／空中／水中／海のうち4つ以上）",
          "Atmospheric used as Land substitute (no Land)": "空中を地上の代替に使用（地上なし）"
        },
        "result": {
          "0 extra for Atmospheric": "空中への追加0",
          "+1 extra": "+1 追加"
        }
      },
      "movement_attack": {
        "title": "移動力 — 攻撃型",
        "summary": "移動力の主な加点。追撃（加算、上限 +2）：移動後 MAP および／または チャンスステップ／攻撃後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "movement_defense": {
        "title": "移動力 — 耐久型",
        "summary": "移動力の主な加点。追撃（加算、上限 +2）：移動後 MAP および／または チャンスステップ／攻撃後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "movement_support": {
        "title": "移動力 — 支援型",
        "summary": "移動力の主な加点。追撃（加算、上限 +2）：移動後 MAP および／または チャンスステップ／攻撃後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "weapon_power_sp_attack": {
        "title": "武装威力 — SP化 — 攻撃型",
        "summary": "盤面の非 MAP Lv5 最大威力。攻撃型はダメージ優先。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_sp_defense": {
        "title": "武装威力 — SP化 — 耐久型",
        "summary": "盤面の非 MAP Lv5 最大威力。耐久型は攻撃型より上限が柔らかい。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_sp_support": {
        "title": "武装威力 — SP化 — 支援型",
        "summary": "盤面の非 MAP Lv5 最大威力。支援型は軽め — ダメージは副次。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_ssp_attack": {
        "title": "武装威力 — SSP化 — 攻撃型",
        "summary": "盤面の非 MAP Lv5 最大威力。攻撃型はダメージ優先。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_power_ssp_defense": {
        "title": "武装威力 — SSP化 — 耐久型",
        "summary": "盤面の非 MAP Lv5 最大威力。耐久型は攻撃型より上限が柔らかい。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_power_ssp_support": {
        "title": "武装威力 — SSP化 — 支援型",
        "summary": "盤面の非 MAP Lv5 最大威力。支援型は軽め — ダメージは副次。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_bonus": {
        "title": "武装条件ボーナス（ユニット）",
        "summary": "最強力（表上威力が最高）の非 MAP 攻撃のみの条件ボーナス — 他武装は対象外。クリティカルダメージは軽め（+1）；クリティカル率は ≥20% で +1；クリティカル確定は +2。マス／マップ位置の文章ボーナスは廃止（0）。最大射程 ≤3 のとき長射程ボーナスは無視。",
        "when": {
          "Critical damage": "クリティカルダメージ",
          "Higher HP": "高HP時",
          "Lower HP": "低HP時",
          "Higher range": "長射程時",
          "Lower range": "短射程時",
          "Higher MP": "高MP時",
          "Reduce Def": "DEF減少",
          "Tile / map position (retired)": "マス／マップ位置（廃止）",
          "Critical rate (≥20%)": "クリティカル率（≥20%）",
          "Guaranteed critical": "クリティカル確定"
        },
        "result": {}
      },
      "dual_attack_attr": {
        "title": "複合適性攻撃（ユニット）",
        "summary": "最強攻撃が射撃／格闘／覚醒のうち2つ以上を使う（例：強化 ZZ ハイメガキャノン）。ビーム／物理／特殊の複合ダメージ属性とは別。",
        "when": {
          "≥2 combat specialties on strongest weapon": "最強武装に攻撃適性が2つ以上",
          "≥2 attack types on strongest weapon": "最強武装に攻撃適性が2つ以上"
        },
        "result": {}
      },
      "multi_weapon_attr": {
        "title": "複合ダメージ属性（ユニット）",
        "summary": "武装（MAP含む）がビーム／物理／特殊を2種以上持つ。カタログ全体 — バルバトスルプス／レクス限定ではない。",
        "when": {
          "≥2 damage types on any weapon (MAP counted)": "いずれかの武装がダメージ属性2種以上（MAP含む）",
          "≥2 damage types on any weapon": "いずれかの武装がダメージ属性2種以上"
        },
        "result": {}
      },
      "weapon_damage_attr": {
        "title": "特殊ダメージ属性（ユニット）",
        "summary": "最強の非MAP武装のダメージ属性。特殊（特殊を含む複合含む）は加点。ビームのみ／物理のみは0。複合ダメージ属性とは別枠。",
        "when": {
          "Strongest non-MAP includes Special": "最強の非MAPが特殊を含む",
          "Beam-only or Physical-only": "ビームのみ／物理のみ"
        },
        "result": {}
      },
      "source_bucket": {
        "title": "入手元（ユニット）— フィルタのみ",
        "summary": "レターには影響しません。ガシャ獲得ユニット／開発ユニット／その他は入手元フィルタで比較。各ルートの加点は 0。",
        "when": {
          "Units from Unit Assembly": "ユニット補給",
          "Development Unit": "開発ユニット",
          "Other": "その他",
          "Gacha / assembly": "ユニット補給",
          "Development": "開発ユニット",
          "Event / other": "その他"
        },
        "result": {}
      },
      "limited_supporter_tags": {
        "title": "期間限定サポーター対象タグ",
        "summary": "期間限定ガシャのサポーターのリーダースキル（第3段階）が対象とするタグ1つにつき +1（上限 +2）。一覧は採点ガイド下部。",
        "when": {
          "Any Tag covered by a limited-time Supporter leader skill": "期間限定サポーターのリーダースキル対象タグを1つでも持つ",
          "Each Tag covered by a limited-time Supporter leader skill": "対象タグ1つあたり",
          "Cap": "上限"
        },
        "result": {}
      },
      "weapon_range_attack": {
        "title": "武装射程 — 攻撃型",
        "summary": "盤面の非 MAP 武装の最大射程。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "weapon_range_defense": {
        "title": "武装射程 — 耐久型",
        "summary": "盤面の非 MAP 武装の最大射程。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "weapon_range_support": {
        "title": "武装射程 — 支援型",
        "summary": "支援型の基準は射程5。それ未満は弱い。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "combat_flags": {
        "title": "戦闘フラグ（ユニット）",
        "summary": "実用ツールを足す場合のみ戦闘ボーナス（変形チェックの無料加点ではない）。",
        "when": {
          "Transform alt unlocks deployable terrain, higher MOV, longer range, higher weapon power, and/or adds MAP vs base form": "変形先が、出撃可能地形・より高いMOV・より長い射程・より高い武装威力を解放、および／またはベースよりMAPを追加",
          "Transform with no strategic gain vs base": "ベースに対し戦略的利得のない変形",
          "Best weapon only usable at Max Vigor (stronger than unrestricted best) — MP/pilot-gated; weak for ML / one-turn kill": "最強武装が最大テンション限定（常時最強より強い）— MP／キャラクター条件；ML／ワンターンキルには弱い",
          "Preemptive Strike": "先制攻撃",
          "Rare physical/beam range-down on hit": "命中時の稀少な実弾／ビーム射程ダウン",
          "Unbreakable (survive lethal once)": "不屈（致命打を一度耐える）"
        },
        "result": {
          "+1 (cap +2 with ++1 per extra gain type)": "+1（追加利得種ごとに+1、上限+2）",
          "Atk +1 / Def +2 / Sup +1": "攻撃型 +1／耐久型 +2／支援型 +1"
        }
      },
      "shield_attack": {
        "title": "シールド — 攻撃型",
        "summary": "ユニットにシールドがあるか（ユニット機構から）。",
        "when": {
          "Has shield": "シールドあり",
          "Missing shield": "シールドなし"
        },
        "result": {}
      },
      "shield_defense": {
        "title": "シールド — 耐久型",
        "summary": "シールドは約20%の損傷を無視 — 耐久型は無しだと大きく減点。",
        "when": {
          "Has shield": "シールドあり",
          "Missing shield": "シールドなし"
        },
        "result": {}
      },
      "shield_support": {
        "title": "シールド — 支援型",
        "summary": "ユニットにシールドがあるか（ユニット機構から）。",
        "when": {
          "Has shield": "シールドあり",
          "Missing shield": "シールドなし"
        },
        "result": {}
      },
      "special_defense": {
        "title": "特殊防御キット（ユニット）",
        "summary": "シールド機構を超えるアビリティ系軽減の存在ボーナス（被ダメージ減、防御 DR、無効化、HP%バリア／Iフィールド系カット）。欠如減点なし — 攻撃／支援のガラスキャノンは減点しません。",
        "when": {
          "No special defense traits": "特殊防御特性なし",
          "1 distinct special-defense trait": "特殊防御特性が1種",
          "2+ distinct special-defense traits": "特殊防御特性が2種以上"
        },
        "result": {}
      },
      "ur_pilot_dependence": {
        "title": "UR 推奨キャラクター依存（ユニット）",
        "summary": "MS の推奨／リンクキャラクターが UR またはアルティメットのとき軽い税（ピークキットはそのキャラクター前提が多い）。SSR アフィニティでも投資可 — 開示であり排除ではありません。",
        "when": {
          "Recommend pilot is SSR or below": "推奨キャラクターがSSR以下",
          "Recommend pilot rarity index ≥5 or Ultimate": "推奨キャラクターのレア指数 ≥5 またはアルティメット"
        },
        "result": {}
      },
      "stat_outlier": {
        "title": "突出した副次ステ（ユニット）",
        "summary": "タイプ平均を明らかに上回る副次ステへのニッチ加点。上限 +2。",
        "when": {
          "Attack: HP ≥ 105000": "攻撃型: HP ≥ 105000",
          "Attack: EN ≥ 450 (SSP only)": "攻撃型: EN ≥ 450（SSPのみ）",
          "Defense: ATK ≥ 11000": "耐久型: ATK ≥ 11000",
          "Support: DEF ≥ 10000": "支援型: DEF ≥ 10000",
          "Support: HP ≥ 98000": "支援型: HP ≥ 98000"
        },
        "result": {}
      },
      "unit_stats_attack": {
        "title": "ユニット SP 成長ステータス — 攻撃型",
        "summary": "攻撃型は機動力より攻撃力上限を重視。HP は上振れのみ（床減点なし）。DEF は採点外。EN は SSP 盤のみ（上振れのみ）。機動力はソフトキャップ。",
        "when": {
          "HP < 95000": "HP < 95000",
          "HP 95000–99999": "HP 95000–99999",
          "HP ≥ 100000": "HP ≥ 100000",
          "EN < 400": "EN < 400",
          "EN 400–449": "EN 400–449",
          "EN ≥ 450": "EN ≥ 450",
          "ATK < 11200": "ATK < 11200",
          "ATK 11200–11599": "ATK 11200–11599",
          "ATK 11600–11999": "ATK 11600–11999",
          "ATK 12000–12399": "ATK 12000–12399",
          "ATK 12400–12799": "ATK 12400–12799",
          "ATK ≥ 12800": "ATK ≥ 12800",
          "any": "any",
          "Mobility (MOB) < 9000": "機動力 < 9000",
          "Mobility (MOB) 9000–9599": "機動力 9000–9599",
          "Mobility (MOB) 9600–9999": "機動力 9600–9999",
          "Mobility (MOB) ≥ 10000": "機動力 ≥ 10000"
        },
        "result": {}
      },
      "unit_stats_defense": {
        "title": "ユニット SP 成長ステータス — 耐久型",
        "summary": "耐久型は HP＋DEF 重視（床減点あり）。ATK は上振れのみ（≥9000 → +1、≥10000 → +2；床減点なし）。",
        "when": {
          "HP < 105000": "HP < 105000",
          "HP 105000–109999": "HP 105000–109999",
          "HP 110000–124999": "HP 110000–124999",
          "HP 125000–129999": "HP 125000–129999",
          "HP ≥ 130000": "HP ≥ 130000",
          "ATK < 9000": "ATK < 9000",
          "ATK 9000–9999": "ATK 9000–9999",
          "ATK ≥ 10000": "ATK ≥ 10000",
          "DEF < 9500": "DEF < 9500",
          "DEF 9500–10499": "DEF 9500–10499",
          "DEF 10500–11099": "DEF 10500–11099",
          "DEF 11100–11999": "DEF 11100–11999",
          "DEF ≥ 12000": "DEF ≥ 12000",
          "Mobility (MOB) < 7700": "機動力 < 7700",
          "Mobility (MOB) 7700–7799": "機動力 7700–7799",
          "Mobility (MOB) 7800–8099": "機動力 7800–8099",
          "Mobility (MOB) 8100–8399": "機動力 8100–8399",
          "Mobility (MOB) ≥ 8400": "機動力 ≥ 8400"
        },
        "result": {}
      },
      "unit_stats_support": {
        "title": "ユニット SP 成長ステータス — 支援型",
        "summary": "支援型は機動力上限を重視。ATK と HP は軽い上振れで床減点なし。",
        "when": {
          "HP < 91000": "HP < 91000",
          "HP 91000–93999": "HP 91000–93999",
          "HP ≥ 94000": "HP ≥ 94000",
          "ATK < 10500": "ATK < 10500",
          "ATK 10500–11499": "ATK 10500–11499",
          "ATK ≥ 11500": "ATK ≥ 11500",
          "DEF < 8300": "DEF < 8300",
          "DEF 8300–8599": "DEF 8300–8599",
          "DEF 8600–9099": "DEF 8600–9099",
          "DEF 9100–9399": "DEF 9100–9399",
          "DEF ≥ 9400": "DEF ≥ 9400",
          "Mobility (MOB) < 9000": "機動力 < 9000",
          "Mobility (MOB) 9000–9499": "機動力 9000–9499",
          "Mobility (MOB) 9500–9999": "機動力 9500–9999",
          "Mobility (MOB) 10000–10499": "機動力 10000–10499",
          "Mobility (MOB) ≥ 10500": "機動力 ≥ 10500"
        },
        "result": {}
      },
      "debuffs": {
        "title": "弱体（耐久型／支援型ユニット）",
        "summary": "攻撃型はこれらの項目をスキップ。支援型は持続の防御力減少％または即時貫通（≈10%→3 … 40%+→6）。耐久型は持続の攻撃力減少％（敵の攻撃力を下げ、耐えるヒット数を増やす）。耐久型は射程 ≥4 の異なる弱体種を数える（軽め；被ダメージ減は1種）。支援型は射程 ≥5 の種を数え、減少％をより重視。支援型の BEYOND THE TIME には防御力減少／貫通 Lv5+ も必要。",
        "when": {
          "Attack role": "攻撃型",
          "Defense: 0 / 1 / 2+ distinct R4+ debuff kinds": "耐久型：射程4+ の異なる弱体種 0／1／2+",
          "Support: 0 / 1 / 2+ distinct R5+ debuff kinds": "支援型：射程5+ の異なる弱体種 0／1／2+",
          "Defense pierce / DEF-down level": "耐久型の貫通／DEFダウン段階",
          "Defense ATK Down level": "耐久型の攻撃力減少段階",
          "Support DEF Down / pierce level": "支援型の防御力減少／貫通段階",
          "Support pierce / DEF-down level": "支援型の貫通／DEFダウン段階"
        },
        "result": {
          "Not scored": "採点外",
          "0 / 0 / +1": "0／0／+1",
          "-1 / 0 / +1": "−1／0／+1",
          "none -2 · Lv3 -1 · Lv4 0 · Lv5 +1 · Lv6 +2": "なし −2 · Lv3 −1 · Lv4 0 · Lv5 +1 · Lv6 +2",
          "none -2 · Lv3 -2 · Lv4 -1 · Lv5 +1 · Lv6 +2": "なし −2 · Lv3 −2 · Lv4 −1 · Lv5 +1 · Lv6 +2"
        }
      },
      "linked_pilot": {
        "title": "アフィニティキャラクター候補（ユニット）",
        "summary": "この MS に搭乗タグ／EX ペア親和がある同タイプ SSR+ キャラクター数。深い候補の方が単一リンク推奨より強い。",
        "when": {
          "0 matching SSR+ pilots": "一致するSSR+キャラクター 0",
          "1–2 matching SSR+ pilots": "一致するSSR+キャラクター 1–2",
          "3–5 matching SSR+ pilots": "一致するSSR+キャラクター 3–5",
          "≥ 6 matching SSR+ pilots": "一致するSSR+キャラクター ≥6"
        },
        "result": {}
      },
      "map": {
        "title": "MAP兵器（ユニット）",
        "summary": "ダメージMAP（攻撃カテゴリ・威力≥1）：存在、ダッシュ／移動攻撃、弾数2+、範囲（0–14マス=0、15–24=+1、25+=+2）。回復／味方支援MAP（回復カテゴリ、例：MP供給のサイコ・フィールド／Live Concert）は代わりに +1（ダメージMAPの範囲点は付けない）。攻撃型上限 +4、耐久／支援型上限 +2。",
        "when": {
          "Damage MAP weapon": "ダメージMAP兵器",
          "Recovery / ally-support MAP (MP supply, buff allies)": "回復／味方支援MAP（MP供給・味方強化）",
          "Dash / MovingAttack MAP": "ダッシュ／移動攻撃MAP",
          "Ammo 1": "弾数1",
          "Ammo ≥2": "弾数≥2",
          "0–14 cells": "0–14マス",
          "15–24 cells": "15–24マス",
          "≥ 25 cells": "≥25マス"
        },
        "result": {
          "0 (covered by presence)": "0（存在点に含まれる）"
        }
      },
      "abilities": {
        "title": "アビリティ／キット",
        "summary": "ゲームマスターのアビリティ・スキル効果データから採点。無条件の恒常 DEF／HP／MOV はここでは 0。攻撃型は無条件の攻撃力%に軽い加点。HP／反撃条件の攻撃力は上限あり。Advantage:シリーズはここでは加点なし。強い％効果はサイズ帯。ユニットアビリティ上限 +3、キャラクターキットは +14。",
        "when": {
          "Role-relevant combat effects": "タイプに効く戦闘効果",
          "Permanent flat/rate stats, no condition": "無条件の恒常フラット／割合ステ",
          "HP / Counter gated ATK%": "HP／反撃条件の攻撃力%",
          "Advantage: series ability": "Advantage:シリーズアビリティ",
          "MAP ammo effects": "MAP弾数効果",
          "Physical/beam weapon range-down on hit": "命中時の実弾／ビーム武装射程ダウン",
          "Unbreakable (mainly pilots)": "不屈（主にキャラクター）"
        },
        "result": {
          "Points by effect (+ size bands)": "効果ごとの点（＋サイズ帯）",
          "0 (Attack unconditional ATK% +1)": "0（攻撃型の無条件攻撃力%は +1）",
          "Soft-capped": "上限あり",
          "0 here (in-series / tag filter only)": "ここでは0（シリーズ内／タグ一致時のみ）",
          "0 here (counted under MAP)": "ここでは0（MAPで計上）",
          "Rare debuff +1": "稀少弱体 +1",
          "Extra-life role bonus (separate factor)": "追加命タイプボーナス（別項目）"
        }
      },
      "pilot_kit_flat": {
        "title": "キャラクターアビリティ／スキル定額加点",
        "summary": "タイプ別 TraitType 点に加え、無条件の支援防御／支援攻撃・支援反撃を優先加点し、条件付きは低め。初期MP加点もあり。アクティブスキルはスキルごとに 0／+1／+2 を合算。",
        "when": {
          "Unconditional Support Defense or Support Attack/Counter on an ability": "アビリティに無条件の支援防御または支援攻撃・支援反撃",
          "Conditional Support Defense or Support Attack/Counter on an ability": "アビリティに条件付きの支援防御または支援攻撃・支援反撃",
          "Other conditional ability (any ActiveCondition, no SA/SD)": "その他の条件アビリティ（発動条件あり・SA／SD以外）",
          "Initial MP ability (Cyber-Newtype / Enhanced Human, type 46)": "初期MPアビリティ（強化人間／サイコミュ系、type 46）",
          "Non-damage skill (MOV, range, EN/HP restore, DEF up, hit/eva, …)": "非ダメージスキル（移動力・射程・EN／HP回復・防御アップ・命中／回避など）",
          "Damage skill (attack burst, Critical up, melee/range/awaken)": "ダメージスキル（攻撃バースト・クリティカルアップ・格闘／射撃／覚醒）",
          "Utility skill (extra CS / SA / SD for 1 turn)": "ユーティリティスキル（1ターン追加CS／SA／SD）",
          "Sway or MP Up skill": "スウェイまたはMPアップスキル"
        },
        "result": {
          "+1 each skill": "スキルごと +1",
          "+2 each skill": "スキルごと +2"
        }
      },
      "ability_table_attack": {
        "title": "ユニットアビリティ効果 — 攻撃型",
        "summary": "サイズ帯がないときの基礎点。ある場合はサイズ表を適用。",
        "when": {
          "Damage dealt": "与ダメージ",
          "Critical Damage dealt": "クリティカル与ダメージ",
          "Sure Hit Attack": "絶対命中攻撃",
          "Guaranteed Chance Step": "確定チャンスステップ",
          "Guaranteed Chance Step Weapon Used Only": "確定チャンスステップ（使用武装のみ）",
          "Guaranteed critical": "クリティカル確定",
          "Attack Change Rate": "攻撃力変化率",
          "Damage Given Correction Value": "与ダメージ補正値",
          "Weapon Power Change Value": "武装威力変化値",
          "Critical Damage Given Correction Value": "クリティカル与ダメージ補正値",
          "Weapon power (closer range)": "武装威力（近距離）",
          "Weapon power (longer range)": "武装威力（遠距離）",
          "Critical rate": "クリティカル率",
          "Weapon Power Change Rate": "武装威力変化率",
          "Weapon power rises with remaining HP": "残HPに応じて武装威力上昇",
          "Attack Change Value": "攻撃力変化値",
          "Attack Target Defense Reduction Rate": "攻撃対象の防御力減少率",
          "Attack Target Mobility Reduction Rate": "攻撃対象の機動力減少率",
          "Weapon power rises when HP is low": "低HP時に武装威力上昇",
          "Regeneration": "再生",
          "Weapon Debuff Value Addition": "武装弱体値加算",
          "Weapon Debuff Duration Addition": "武装弱体時間加算",
          "Weapon power rises when MP is low": "低MP時に武装威力上昇",
          "Weapon power rises with MP": "MPに応じて武装威力上昇"
        },
        "result": {}
      },
      "ability_table_defense": {
        "title": "ユニットアビリティ効果 — 耐久型",
        "summary": "サイズ帯がないときの基礎点。ある場合はサイズ表を適用。",
        "when": {
          "Damage taken": "被ダメージ",
          "Defensive Damage Reduction Rate": "防御時損傷軽減率",
          "Absolute Evasion": "絶対回避",
          "Anti Damage Shield": "対ダメージシールド",
          "Damage Negation": "ダメージ無効",
          "Unbreakable": "不屈",
          "Damage Taken Upper Limit Value": "被ダメージ上限値",
          "Damage Barrier Max Hp Rate": "ダメージバリア（最大HP割合）",
          "Damage Cut": "ダメージカット",
          "Evasion Rate Change Rate": "回避率変化率",
          "Defense Change Rate": "防御力変化率",
          "Damage Taken Correction Value": "被ダメージ補正値",
          "Support Defense": "支援防御",
          "Regeneration": "再生",
          "Support Defense Adaptive": "支援防御（適応）",
          "Support Defense Extend To Counter": "支援防御を反撃へ延長",
          "Defense Change Value": "防御力変化値",
          "Support Attack And Counter": "支援攻撃・反撃",
          "Support Attack And Counter Adaptive": "支援攻撃・反撃（適応）"
        },
        "result": {}
      },
      "ability_table_support": {
        "title": "ユニットアビリティ効果 — 支援型",
        "summary": "サイズ帯がないときの基礎点。ある場合はサイズ表を適用。",
        "when": {
          "Attack Target Defense Reduction Rate": "攻撃対象の防御力減少率",
          "Support Attack And Counter Adaptive": "支援攻撃・反撃（適応）",
          "Support Defense Adaptive": "支援防御（適応）",
          "Weapon Debuff Value Addition": "武装弱体値加算",
          "Attack Change Rate": "攻撃力変化率",
          "Damage dealt": "与ダメージ",
          "Chance Step Max Count Change": "チャンスステップ最大回数変化",
          "Sp Change Value": "SP変化値",
          "Mp Change Rate": "MP変化率",
          "Mp Change Value": "MP変化値",
          "Support Attack And Counter": "支援攻撃・反撃",
          "Support Defense": "支援防御",
          "Movement Change Value": "移動力変化値",
          "Attack Target Mobility Reduction Rate": "攻撃対象の機動力減少率",
          "Guaranteed Chance Step": "確定チャンスステップ",
          "Regeneration": "再生",
          "Weapon Debuff Duration Addition": "武装弱体時間加算",
          "Support Defense Extend To Counter": "支援防御を反撃へ延長",
          "Post Attack Move": "攻撃後移動",
          "Hp Change Rate": "HP変化率"
        },
        "result": {}
      },
      "footprint": {
        "title": "2×2 占有（ユニット）",
        "summary": "OccupiedArea 2×2 のユニットは軽い上振れ — 広い MAP／バフ範囲が配置の不便さを上回ることが多い。",
        "when": {
          "Attack 2×2": "攻撃型 2×2",
          "Support 2×2": "支援型 2×2",
          "Defense 2×2": "耐久型 2×2",
          "Not 2×2": "2×2ではない"
        },
        "result": {}
      },
      "rarity": {
        "title": "レアリティ調整（ユニット）",
        "summary": "採点外 — キットと戦闘加点で順位が決まります。低レアは強いスキル／アビリティが少ない傾向です。",
        "when": {
          "N": "N",
          "R": "R",
          "SR": "SR",
          "SSR / UR": "SSR／UR",
          "All rarities": "全レアリティ"
        },
        "result": {}
      },
      "pilot_rarity": {
        "title": "レアリティ調整（キャラクター）",
        "summary": "採点外 — キャラクタースキル／アビリティの有用性と推奨ユニットで順位が決まります。",
        "when": {
          "N": "N",
          "R": "R",
          "SR": "SR",
          "SSR / UR": "SSR／UR",
          "All rarities": "全レアリティ"
        },
        "result": {}
      },
      "pilot_stats_attack": {
        "title": "キャラクター SP 成長ステータス — 攻撃型",
        "summary": "このキャラクタータイプの SP リスト成長ステータス。攻撃型は適性ステータス（射撃／格闘／覚醒）が重要。耐久型キャラクターは守備／反応がより重要。",
        "when": {
          "Ranged < 700": "射撃値 < 700",
          "Ranged 700–734": "射撃値 700–734",
          "Ranged 735–769": "射撃値 735–769",
          "Ranged 770–794": "射撃値 770–794",
          "Ranged ≥ 795": "射撃値 ≥ 795",
          "Melee < 700": "格闘値 < 700",
          "Melee 700–734": "格闘値 700–734",
          "Melee 735–769": "格闘値 735–769",
          "Melee 770–794": "格闘値 770–794",
          "Melee ≥ 795": "格闘値 ≥ 795",
          "Awaken < 600": "覚醒値 < 600",
          "Awaken 600–649": "覚醒値 600–649",
          "Awaken 650–699": "覚醒値 650–699",
          "Awaken 700–749": "覚醒値 700–749",
          "Awaken ≥ 750": "覚醒値 ≥ 750",
          "Defense < 460": "守備値 < 460",
          "Defense 460–499": "守備値 460–499",
          "Defense 500–524": "守備値 500–524",
          "Defense 525–549": "守備値 525–549",
          "Defense ≥ 550": "守備値 ≥ 550",
          "Reaction < 550": "反応値 < 550",
          "Reaction 550–574": "反応値 550–574",
          "Reaction 575–599": "反応値 575–599",
          "Reaction 600–649": "反応値 600–649",
          "Reaction ≥ 650": "反応値 ≥ 650"
        },
        "result": {}
      },
      "pilot_stats_defense": {
        "title": "キャラクター SP 成長ステータス — 耐久型",
        "summary": "このキャラクタータイプの SP リスト成長ステータス。攻撃型は適性ステータス（射撃／格闘／覚醒）が重要。耐久型キャラクターは守備／反応がより重要。",
        "when": {
          "Ranged < 500": "射撃値 < 500",
          "Ranged 500–539": "射撃値 500–539",
          "Ranged 540–569": "射撃値 540–569",
          "Ranged 570–599": "射撃値 570–599",
          "Ranged ≥ 600": "射撃値 ≥ 600",
          "Melee < 500": "格闘値 < 500",
          "Melee 500–539": "格闘値 500–539",
          "Melee 540–569": "格闘値 540–569",
          "Melee 570–599": "格闘値 570–599",
          "Melee ≥ 600": "格闘値 ≥ 600",
          "Awaken < 500": "覚醒値 < 500",
          "Awaken 500–549": "覚醒値 500–549",
          "Awaken 550–599": "覚醒値 550–599",
          "Awaken 600–699": "覚醒値 600–699",
          "Awaken ≥ 700": "覚醒値 ≥ 700",
          "Defense < 700": "守備値 < 700",
          "Defense 700–724": "守備値 700–724",
          "Defense 725–749": "守備値 725–749",
          "Defense 750–774": "守備値 750–774",
          "Defense ≥ 775": "守備値 ≥ 775",
          "Reaction < 700": "反応値 < 700",
          "Reaction 700–739": "反応値 700–739",
          "Reaction 740–769": "反応値 740–769",
          "Reaction 770–799": "反応値 770–799",
          "Reaction ≥ 800": "反応値 ≥ 800"
        },
        "result": {}
      },
      "pilot_stats_support": {
        "title": "キャラクター SP 成長ステータス — 支援型",
        "summary": "このキャラクタータイプの SP リスト成長ステータス。攻撃型は適性ステータス（射撃／格闘／覚醒）が重要。耐久型キャラクターは守備／反応がより重要。",
        "when": {
          "Ranged < 655": "射撃値 < 655",
          "Ranged 655–699": "射撃値 655–699",
          "Ranged 700–734": "射撃値 700–734",
          "Ranged 735–794": "射撃値 735–794",
          "Ranged ≥ 795": "射撃値 ≥ 795",
          "Melee < 655": "格闘値 < 655",
          "Melee 655–699": "格闘値 655–699",
          "Melee 700–734": "格闘値 700–734",
          "Melee 735–794": "格闘値 735–794",
          "Melee ≥ 795": "格闘値 ≥ 795",
          "Awaken < 600": "覚醒値 < 600",
          "Awaken 600–649": "覚醒値 600–649",
          "Awaken 650–699": "覚醒値 650–699",
          "Awaken 700–749": "覚醒値 700–749",
          "Awaken ≥ 750": "覚醒値 ≥ 750",
          "Defense < 500": "守備値 < 500",
          "Defense 500–524": "守備値 500–524",
          "Defense 525–549": "守備値 525–549",
          "Defense 550–649": "守備値 550–649",
          "Defense ≥ 650": "守備値 ≥ 650",
          "Reaction < 550": "反応値 < 550",
          "Reaction 550–599": "反応値 550–599",
          "Reaction 600–649": "反応値 600–649",
          "Reaction 650–699": "反応値 650–699",
          "Reaction ≥ 700": "反応値 ≥ 700"
        },
        "result": {}
      },
      "pilots_extra": {
        "title": "キャラクター専用項目",
        "summary": "キャラクターは SP 盤のみ。帯表はキャラクター SP 成長ステータス各ブロックを参照。",
        "when": {
          "SP grown stats (Ranged / Melee / Awaken / Defense / Reaction)": "SP成長ステータス（射撃値／格闘値／覚醒値／守備値／反応値）",
          "Series affinity abilities": "シリーズアフィニティアビリティ",
          "Best recommended MS letter (A and up)": "最良の推奨MSレター（A以上）",
          "Unbreakable on pilot abilities": "キャラクターアビリティの不屈"
        },
        "result": {
          "Band points by role (see tables above)": "タイプ別の帯点（上表参照）",
          "+3 each": "各 +3",
          "From this guide’s unit letters (B+ no longer scores)": "本ガイドのユニットレターから（B+以下は加点なし）",
          "Extra-life role bonus": "追加命タイプボーナス"
        }
      }
    },
    "TW": {
      "buckets": {
        "title": "由字母到分桶",
        "summary": "點數合計對應字母，再對應分桶。玩家主要看分桶。",
        "when": {
          "S+ Attack Type (score 18+)": "S+ 攻擊型（18 分以上）",
          "S+ Defense Type (score 22+)": "S+ 耐久型（22 分以上）",
          "S+ Support Type (score 19+)": "S+ 支援型（19 分以上）",
          "S+ (score 17+)": "S+（17 分以上）",
          "S+ Defense Type": "S+ 耐久型",
          "S+ Support Type": "S+ 支援型",
          "S+ Defense Type Characters": "S+ 耐久型角色",
          "S+ (score 23+)": "S+（23 分以上）",
          "S": "S",
          "A+ or A": "A+ 或 A",
          "B+ or B": "B+ 或 B",
          "C, D, or E": "C、D 或 E"
        },
        "result": {
          "BEYOND THE TIME": "BEYOND THE TIME",
          "BEYOND THE TIME (Attack)": "BEYOND THE TIME（攻擊型）",
          "BEYOND THE TIME (Attack / Support)": "BEYOND THE TIME（攻擊型／支援型）",
          "BEYOND THE TIME only at 18+ if the kit tanks more than one hit (HP + Shield Defense / special DR / Unbreakable) and has Preemptive Strike or Support Defense coverage (unit SD kit or MOV 6)": "需 18 分以上，且能承受超過一擊（HP＋盾牌防禦／特殊減傷／逃生機能），並具備先發攻擊或支援防禦覆蓋（機體套件或移動力 6）才進入 BEYOND THE TIME",
          "BEYOND THE TIME only at 18+ if the kit tanks more than one hit (HP + Shield Defense / special DR / Unbreakable) and has lasting ATK Down at Lv5+ (30%+ — tank analog of Support DEF Down), and has Preemptive Strike or Support Defense coverage (unit SD kit or MOV 6)": "需 18 分以上，且有持續攻擊力減少（Lv5／30%+）、能承受超過一擊（HP＋盾牌防禦／特殊減傷／逃生機能），並具備先發攻擊或支援防禦覆蓋（機體套件或移動力 6）才進入 BEYOND THE TIME",
          "BEYOND THE TIME only at 17+ with lasting DEF Down / pierce at Lv5+ (30%+). MAP-only kits stay Recommended": "需 17 分以上且有持續防禦力減少／貫穿（Lv5／30%+）才進入 BEYOND THE TIME。僅有 MAP 的套件維持推薦",
          "BEYOND THE TIME only with Defense or Reaction band points (kit-only Durability Characters stay Recommended)": "需有防禦或反應帶分數才進入 BEYOND THE TIME（僅靠套件加分的耐久型角色維持推薦）",
          "Recommended": "推薦",
          "Solid": "穩健",
          "Situational": "看場合",
          "Niche": "小眾"
        }
      },
      "role_focus_attack": {
        "title": "攻擊型優先事項",
        "summary": "先看火力上限（ATK＋武裝威力），再看移動力／MAP兵器。HP 與 SSP EN 僅計上振 — 高則加分，低不扣分。MOB 為較弱的次要項。",
        "when": {
          "Primary": "主軸",
          "Upside only": "僅上振",
          "Soft secondary": "較弱次要",
          "Great extras": "優秀附加",
          "Not scored": "不計分"
        },
        "result": {
          "ATK · weapon power · MOV": "ATK · 武裝威力 · MOV",
          "HP · SSP EN (no floor penalty)": "HP · SSP EN（無下限扣分）",
          "Mobility / MOB (lower ceiling than ATK)": "機動力（上限低於攻擊力）",
          "MAP presence / dash / coverage · special defense kits": "MAP 存在／衝刺／覆蓋 · 特殊防禦套件",
          "DEF · Debuff kinds · ATK Down / DEF Down · SP EN": "DEF · 弱化種類 · 攻擊力減少／防禦力減少 · SP EN"
        }
      },
      "role_focus_defense": {
        "title": "耐久型優先事項",
        "summary": "高 HP 或 DEF、盾牌防禦（約忽略 20% 損傷）、支援防禦覆蓋用的高移動力、穩健地形（宇宙＋地上或空中）、生存套件（損傷減輕／HP 回復），外加攻擊力減少（對應支援型防禦力減少的耐久手段）。ATK 僅計上振（≥9000）。特殊防禦（I力場／屏障／DR）為額外存在加分。BEYOND THE TIME 另需能承受超過一擊，以及先發攻擊或支援防禦覆蓋。",
        "when": {
          "Primary": "主軸",
          "Secondary": "次要",
          "ATK upside": "ATK 上振",
          "Special defense": "特殊防禦",
          "BEYOND THE TIME gate": "BEYOND THE TIME 條件"
        },
        "result": {
          "HP · DEF · shield · MOV · terrain · survivability abilities": "HP · DEF · 盾 · 移動力 · 地形 · 生存能力",
          "A few good pierce / DEF-down debuffs (R4+ kinds)": "幾個好用的貫穿／DEF 下降弱化（射程 4+ 種）",
          "ATK Down strength (R4+ kinds) — tank analog of Support DEF Down": "攻擊力減少強度（射程 4+ 種）— 對應支援型防禦力減少的耐久手段",
          "≥9000 mild bonus; below that, no penalty": "≥9000 輕微加分；低於則不扣分",
          "Presence bonus for DR / barrier / negation kits": "DR／屏障／無效化套件的存在加分",
          "18+ points, HP that survives more than one hit, and Preemptive Strike or Support Defense coverage": "18 分以上、能承受超過一擊的 HP、先發攻擊或支援防禦覆蓋",
          "18+ points, lasting ATK Down Lv5+, HP that survives more than one hit, and Preemptive Strike or Support Defense coverage": "18 分以上、持續攻擊力減少 Lv5+、能承受超過一擊的 HP、先發攻擊或支援防禦覆蓋"
        }
      },
      "role_focus_support": {
        "title": "支援型優先事項",
        "summary": "弱化武裝射程至少 5（更短則較弱），再看弱化種類與強度，再看高機動力／移動力。攻擊力與 HP 僅輕微上振 — 較低數值無下限扣分。",
        "when": {
          "Primary": "主軸",
          "Secondary": "次要"
        },
        "result": {
          "Weapon range ≥5 · R5+ debuff kinds · DEF Down · Mobility (MOB) · MOV": "武裝射程≥5 · 射程5+弱化種類 · 防禦力減少 · 機動力 · 移動力",
          "ATK / weapon power / HP (mild upside, no floor penalty)": "攻擊力／武裝威力／HP（輕微上振，無下限扣分）"
        }
      },
      "er_access": {
        "title": "永恆之路 Expert 適性（單位）",
        "summary": "單位可出擊的永恆之路 Expert 關卡數（標籤／系列適性）。壓縮分帶，避免微小適性差直接造成級差。",
        "when": {
          "0–1 Expert stages": "Expert 關卡 0–1",
          "2–6 Expert stages": "Expert 關卡 2–6",
          "7–999 Expert stages": "Expert 關卡 7–999"
        },
        "result": {}
      },
      "pilot_er_access": {
        "title": "永恆之路 Expert 適性（角色）",
        "summary": "只計算有角色限制的 Expert 關卡。角色自由出擊關卡不加分。",
        "when": {
          "0–0 character-restricted Expert stages": "角色限制 Expert 0",
          "1–1 character-restricted Expert stages": "角色限制 Expert 1",
          "2–999 character-restricted Expert stages": "角色限制 Expert 2+"
        },
        "result": {}
      },
      "pilot_combat_actions": {
        "title": "戰鬥行動 — 額外行動／支援攻擊／支援防禦 +1",
        "summary": "主資料中的 +1 行動經濟（與一覽 ×2 篩選同系統）。依類型加權。不以通關影片出場次數計分。",
        "when": {
          "Chance Step +1": "額外行動 +1",
          "Support Attack +1": "支援攻擊 +1",
          "Support Defense +1": "支援防禦 +1"
        },
        "result": {}
      },
      "strategic_tags": {
        "title": "戰略標籤",
        "summary": "非風味標籤依其在 UR 單位出現頻率計分（限定 UR 重於常駐 UR）。已出現在 Expert 限制中的標籤此處不加分。上限 +2。",
        "when": {
          "weight 0–2": "權重 0–2",
          "weight 3–7": "權重 3–7",
          "weight 8–14": "權重 8–14",
          "weight 15–24": "權重 15–24",
          "weight ≥ 25": "權重 ≥ 25"
        },
        "result": {}
      },
      "terrain": {
        "title": "地形適性（單位）",
        "summary": "出擊等級 ≥2 視為可用。額外／完美需完全適性（Lv≥3・圓）。地形適性「三角形」（Lv2）的宇宙／空中各 −1。SSP 盤使用 SSP 強化後地形。下限為宇宙＋地上或空中（拜亞蘭式宇宙＋空中亦可）。",
        "when": {
          "Missing Space, or missing both Land and Atmospheric": "缺少宇宙，或同時缺少地上與空中",
          "Space + Land (or Space + Atmospheric) at deploy Lv≥2": "宇宙＋地上（或宇宙＋空中）出擊 Lv≥2",
          "+ Atmospheric / Underwater / Sea at full affinity Lv≥3 (each)": "＋空中／水中／海（各・完全適性 Lv≥3）",
          "Triangle (Lv2) Space or Atmospheric (each)": "地形適性「三角形」（Lv2）的宇宙或空中（各）",
          "Perfect (4+ terrains at full affinity, no triangle)": "完美（完全適性 4 項以上、無三角形）",
          "Perfect (4+ terrains at full affinity)": "完美（完全適性的宇宙／地上／空中／水中／海 4 項以上）",
          "Atmospheric used as Land substitute (no Land)": "以空中代替地上（無地上）"
        },
        "result": {
          "0 extra for Atmospheric": "空中額外 0",
          "+1 extra": "+1 額外"
        }
      },
      "movement_attack": {
        "title": "移動力 — 攻擊型",
        "summary": "移動力的主要加分。追擊（可疊加，上限 +2）：移動後 MAP 及／或 額外行動／攻擊後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "movement_defense": {
        "title": "移動力 — 耐久型",
        "summary": "移動力的主要加分。追擊（可疊加，上限 +2）：移動後 MAP 及／或 額外行動／攻擊後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "movement_support": {
        "title": "移動力 — 支援型",
        "summary": "移動力的主要加分。追擊（可疊加，上限 +2）：移動後 MAP 及／或 額外行動／攻擊後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "weapon_power_sp_attack": {
        "title": "武裝威力 — SP化 — 攻擊型",
        "summary": "看板非 MAP Lv5 最大威力。攻擊型優先損傷。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_sp_defense": {
        "title": "武裝威力 — SP化 — 耐久型",
        "summary": "看板非 MAP Lv5 最大威力。耐久型上限較攻擊型寬鬆。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_sp_support": {
        "title": "武裝威力 — SP化 — 支援型",
        "summary": "看板非 MAP Lv5 最大威力。支援型較輕 — 損傷為次要。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_ssp_attack": {
        "title": "武裝威力 — SSP化 — 攻擊型",
        "summary": "看板非 MAP Lv5 最大威力。攻擊型優先損傷。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_power_ssp_defense": {
        "title": "武裝威力 — SSP化 — 耐久型",
        "summary": "看板非 MAP Lv5 最大威力。耐久型上限較攻擊型寬鬆。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_power_ssp_support": {
        "title": "武裝威力 — SSP化 — 支援型",
        "summary": "看板非 MAP Lv5 最大威力。支援型較輕 — 損傷為次要。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_bonus": {
        "title": "武裝條件加分（單位）",
        "summary": "僅限表上威力最高的非 MAP 攻擊之條件加分 — 不含其他武裝。爆擊損傷較輕（+1）；爆擊率需 ≥20% 才 +1；必定爆擊 +2。格子／地圖位置文字加分已廢除（0）。最大射程 ≤3 時忽略長射程加分。",
        "when": {
          "Critical damage": "爆擊損傷",
          "Higher HP": "高 HP 時",
          "Lower HP": "低 HP 時",
          "Higher range": "較長射程時",
          "Lower range": "較短射程時",
          "Higher MP": "高 MP 時",
          "Reduce Def": "降低 DEF",
          "Tile / map position (retired)": "格子／地圖位置（已廢除）",
          "Critical rate (≥20%)": "爆擊率（≥20%）",
          "Guaranteed critical": "必定爆擊"
        },
        "result": {}
      },
      "dual_attack_attr": {
        "title": "複合適性攻擊（單位）",
        "summary": "最強攻擊使用射擊／格鬥／覺醒中兩種以上（例：強化 ZZ 高メガ加農）。與光束／物理／特殊的複合損傷屬性不同。",
        "when": {
          "≥2 combat specialties on strongest weapon": "最強武裝具有 2 種以上攻擊適性",
          "≥2 attack types on strongest weapon": "最強武裝具有 2 種以上攻擊適性"
        },
        "result": {}
      },
      "multi_weapon_attr": {
        "title": "複合損傷屬性（單位）",
        "summary": "武裝（含 MAP）具備光束／物理／特殊中兩種以上。全圖鑑適用 — 非巴巴托斯狼王／狼王Rex 限定。",
        "when": {
          "≥2 damage types on any weapon (MAP counted)": "任一武裝具有 2 種以上損傷屬性（含 MAP）",
          "≥2 damage types on any weapon": "任一武裝具有 2 種以上損傷屬性"
        },
        "result": {}
      },
      "weapon_damage_attr": {
        "title": "特殊損傷屬性（單位）",
        "summary": "最強非 MAP 武裝的損傷屬性。特殊（含特殊的複合）加分；僅光束或僅物理為 0。與複合損傷屬性分開加分。",
        "when": {
          "Strongest non-MAP includes Special": "最強非 MAP 含特殊",
          "Beam-only or Physical-only": "僅光束或僅物理"
        },
        "result": {}
      },
      "source_bucket": {
        "title": "取得來源（單位）— 僅篩選",
        "summary": "不影響字母分數。用取得來源篩選比較單位補給獲得單位／開發單位／其他。各途徑加分為 0。",
        "when": {
          "Units from Unit Assembly": "單位補給獲得單位",
          "Development Unit": "開發單位",
          "Other": "其他"
        },
        "result": {}
      },
      "limited_supporter_tags": {
        "title": "限定期間支援人員標籤",
        "summary": "每個由限定期間機體補給支援人員隊長技能（第 3 階）涵蓋的標籤 +1，上限 +2。清單見計分指南。",
        "when": {
          "Any Tag covered by a limited-time Supporter leader skill": "持有任一限定期間支援人員隊長技能涵蓋的標籤",
          "Each Tag covered by a limited-time Supporter leader skill": "每個符合標籤",
          "Cap": "上限"
        },
        "result": {}
      },
      "weapon_range_attack": {
        "title": "武裝射程 — 攻擊型",
        "summary": "看板上非 MAP 武裝的最大射程。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "weapon_range_defense": {
        "title": "武裝射程 — 耐久型",
        "summary": "看板上非 MAP 武裝的最大射程。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "weapon_range_support": {
        "title": "武裝射程 — 支援型",
        "summary": "支援型基準為射程 5；更短則較弱。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "combat_flags": {
        "title": "戰鬥旗標（單位）",
        "summary": "僅在增加實用工具時給戰鬥加分（不是免費勾選變形）。",
        "when": {
          "Transform alt unlocks deployable terrain, higher MOV, longer range, higher weapon power, and/or adds MAP vs base form": "變形後解鎖可出擊地形、更高移動力、更長射程、更高武裝威力，及／或相對本體新增 MAP兵器",
          "Transform with no strategic gain vs base": "相對本體無戰略收益的變形",
          "Best weapon only usable at Max Vigor (stronger than unrestricted best) — MP/pilot-gated; weak for ML / one-turn kill": "最強武裝僅最大戰意可用（強於無限制最強）— MP／角色條件；對大師聯賽／一回合擊殺較弱",
          "Preemptive Strike": "先發攻擊",
          "Rare physical/beam range-down on hit": "命中時稀有的實彈／光束射程下降",
          "Unbreakable (survive lethal once)": "不屈（可承受一次致命）"
        },
        "result": {
          "+1 (cap +2 with ++1 per extra gain type)": "+1（每多一種收益 +1，上限 +2）",
          "Atk +1 / Def +2 / Sup +1": "攻擊型 +1／耐久型 +2／支援型 +1"
        }
      },
      "shield_attack": {
        "title": "盾 — 攻擊型",
        "summary": "單位是否有盾（來自單位裝置）。",
        "when": {
          "Has shield": "有盾",
          "Missing shield": "無盾"
        },
        "result": {}
      },
      "shield_defense": {
        "title": "盾 — 耐久型",
        "summary": "盾約忽略 20% 損傷 — 耐久型沒有盾會重罰。",
        "when": {
          "Has shield": "有盾",
          "Missing shield": "無盾"
        },
        "result": {}
      },
      "shield_support": {
        "title": "盾 — 支援型",
        "summary": "單位是否有盾（來自單位裝置）。",
        "when": {
          "Has shield": "有盾",
          "Missing shield": "無盾"
        },
        "result": {}
      },
      "special_defense": {
        "title": "特殊防禦套件（單位）",
        "summary": "盾裝置以外的能力系減傷存在加分（受傷降低、防禦 DR、無效化、HP% 屏障／I力場系削減）。無缺席扣分 — 攻擊／支援玻璃大砲不因此被罰。",
        "when": {
          "No special defense traits": "無特殊防禦特性",
          "1 distinct special-defense trait": "1 種不同的特殊防禦特性",
          "2+ distinct special-defense traits": "2 種以上不同的特殊防禦特性"
        },
        "result": {}
      },
      "ur_pilot_dependence": {
        "title": "UR 推薦角色依賴（單位）",
        "summary": "單位推薦／連結角色為 UR 或終極時輕微扣分（峰值套件常假設該角色）。仍可用 SSR 親和角色投資 — 這是揭露，不是封殺。",
        "when": {
          "Recommend pilot is SSR or below": "推薦角色為 SSR 或以下",
          "Recommend pilot rarity index ≥5 or Ultimate": "推薦角色稀有指數 ≥5 或終極"
        },
        "result": {}
      },
      "stat_outlier": {
        "title": "突出次要數值（單位）",
        "summary": "次要數值明顯高於該類型平均時的小眾加分。上限 +2。",
        "when": {
          "Attack: HP ≥ 105000": "攻擊型: HP ≥ 105000",
          "Attack: EN ≥ 450 (SSP only)": "攻擊型: EN ≥ 450（僅 SSP）",
          "Defense: ATK ≥ 11000": "耐久型: ATK ≥ 11000",
          "Support: DEF ≥ 10000": "支援型: DEF ≥ 10000",
          "Support: HP ≥ 98000": "支援型: HP ≥ 98000"
        },
        "result": {}
      },
      "unit_stats_attack": {
        "title": "單位 SP 養成數值 — 攻擊型",
        "summary": "攻擊型重視攻擊力上限多於機動力。HP 僅上振（無下限扣分）。DEF 不計分。EN 僅在 SSP 盤計分（僅上振）。機動力軟上限。",
        "when": {
          "HP < 95000": "HP < 95000",
          "HP 95000–99999": "HP 95000–99999",
          "HP ≥ 100000": "HP ≥ 100000",
          "EN < 400": "EN < 400",
          "EN 400–449": "EN 400–449",
          "EN ≥ 450": "EN ≥ 450",
          "ATK < 11200": "ATK < 11200",
          "ATK 11200–11599": "ATK 11200–11599",
          "ATK 11600–11999": "ATK 11600–11999",
          "ATK 12000–12399": "ATK 12000–12399",
          "ATK 12400–12799": "ATK 12400–12799",
          "ATK ≥ 12800": "ATK ≥ 12800",
          "any": "any",
          "Mobility (MOB) < 9000": "機動力 < 9000",
          "Mobility (MOB) 9000–9599": "機動力 9000–9599",
          "Mobility (MOB) 9600–9999": "機動力 9600–9999",
          "Mobility (MOB) ≥ 10000": "機動力 ≥ 10000"
        },
        "result": {}
      },
      "unit_stats_defense": {
        "title": "單位 SP 養成數值 — 耐久型",
        "summary": "耐久型聚焦 HP＋DEF（保留下限扣分）。ATK 僅上振（≥9000 → +1、≥10000 → +2；無下限扣分）。",
        "when": {
          "HP < 105000": "HP < 105000",
          "HP 105000–109999": "HP 105000–109999",
          "HP 110000–124999": "HP 110000–124999",
          "HP 125000–129999": "HP 125000–129999",
          "HP ≥ 130000": "HP ≥ 130000",
          "ATK < 9000": "ATK < 9000",
          "ATK 9000–9999": "ATK 9000–9999",
          "ATK ≥ 10000": "ATK ≥ 10000",
          "DEF < 9500": "DEF < 9500",
          "DEF 9500–10499": "DEF 9500–10499",
          "DEF 10500–11099": "DEF 10500–11099",
          "DEF 11100–11999": "DEF 11100–11999",
          "DEF ≥ 12000": "DEF ≥ 12000",
          "Mobility (MOB) < 7700": "機動力 < 7700",
          "Mobility (MOB) 7700–7799": "機動力 7700–7799",
          "Mobility (MOB) 7800–8099": "機動力 7800–8099",
          "Mobility (MOB) 8100–8399": "機動力 8100–8399",
          "Mobility (MOB) ≥ 8400": "機動力 ≥ 8400"
        },
        "result": {}
      },
      "unit_stats_support": {
        "title": "單位 SP 養成數值 — 支援型",
        "summary": "支援型重視機動力上限；ATK 與 HP 為輕微上振且無下限扣分。",
        "when": {
          "HP < 91000": "HP < 91000",
          "HP 91000–93999": "HP 91000–93999",
          "HP ≥ 94000": "HP ≥ 94000",
          "ATK < 10500": "ATK < 10500",
          "ATK 10500–11499": "ATK 10500–11499",
          "ATK ≥ 11500": "ATK ≥ 11500",
          "DEF < 8300": "DEF < 8300",
          "DEF 8300–8599": "DEF 8300–8599",
          "DEF 8600–9099": "DEF 8600–9099",
          "DEF 9100–9399": "DEF 9100–9399",
          "DEF ≥ 9400": "DEF ≥ 9400",
          "Mobility (MOB) < 9000": "機動力 < 9000",
          "Mobility (MOB) 9000–9499": "機動力 9000–9499",
          "Mobility (MOB) 9500–9999": "機動力 9500–9999",
          "Mobility (MOB) 10000–10499": "機動力 10000–10499",
          "Mobility (MOB) ≥ 10500": "機動力 ≥ 10500"
        },
        "result": {}
      },
      "debuffs": {
        "title": "弱化（耐久型／支援型單位）",
        "summary": "攻擊型略過這些項目。支援型用持續防禦力減少％或即時貫穿（≈10%→3 … 40%+→6）。耐久型用持續攻擊力減少％（降低敵攻擊力以多扛幾下）。耐久型計算射程 ≥4 的不同弱化種類（較輕；受傷降低算一種）。支援型計算射程 ≥5 的種類，更看重減少％。支援型 BEYOND THE TIME 另需防禦力減少／貫穿 Lv5+。",
        "when": {
          "Attack role": "攻擊型",
          "Defense: 0 / 1 / 2+ distinct R4+ debuff kinds": "耐久型：射程 4+ 不同弱化種類 0／1／2+",
          "Support: 0 / 1 / 2+ distinct R5+ debuff kinds": "支援型：射程 5+ 不同弱化種類 0／1／2+",
          "Defense pierce / DEF-down level": "耐久型貫穿／DEF 下降等級",
          "Defense ATK Down level": "耐久型攻擊力減少等級",
          "Support DEF Down / pierce level": "支援型防禦力減少／貫穿等級",
          "Support pierce / DEF-down level": "支援型貫穿／DEF 下降等級"
        },
        "result": {
          "Not scored": "不計分",
          "0 / 0 / +1": "0／0／+1",
          "-1 / 0 / +1": "−1／0／+1",
          "none -2 · Lv3 -1 · Lv4 0 · Lv5 +1 · Lv6 +2": "無 −2 · Lv3 −1 · Lv4 0 · Lv5 +1 · Lv6 +2",
          "none -2 · Lv3 -2 · Lv4 -1 · Lv5 +1 · Lv6 +2": "無 −2 · Lv3 −2 · Lv4 −1 · Lv5 +1 · Lv6 +2"
        }
      },
      "linked_pilot": {
        "title": "親和角色池（單位）",
        "summary": "對此單位具有駕駛標籤／EX 配對親和的同類型 SSR+ 角色數。較深的池優於單一連結推薦。",
        "when": {
          "0 matching SSR+ pilots": "符合的 SSR+ 角色 0",
          "1–2 matching SSR+ pilots": "符合的 SSR+ 角色 1–2",
          "3–5 matching SSR+ pilots": "符合的 SSR+ 角色 3–5",
          "≥ 6 matching SSR+ pilots": "符合的 SSR+ 角色 ≥6"
        },
        "result": {}
      },
      "map": {
        "title": "MAP兵器（單位）",
        "summary": "損傷 MAP（攻擊類別、威力 ≥1）：存在、衝刺／移動攻擊、彈數 2+、覆蓋（0–14 格=0、15–24=+1、25+=+2）。回復／友方支援 MAP（回復類別，例如 MP 供給的 Psycho-Field／Live Concert）改計 +1，不給損傷 MAP 的覆蓋分。攻擊型上限 +4；耐久／支援型上限 +2。",
        "when": {
          "Damage MAP weapon": "損傷 MAP兵器",
          "Recovery / ally-support MAP (MP supply, buff allies)": "回復／友方支援 MAP（MP 供給、強化友軍）",
          "Dash / MovingAttack MAP": "衝刺／移動攻擊 MAP",
          "Ammo 1": "彈數 1",
          "Ammo ≥2": "彈數 ≥2",
          "0–14 cells": "0–14 格",
          "15–24 cells": "15–24 格",
          "≥ 25 cells": "≥25 格"
        },
        "result": {
          "0 (covered by presence)": "0（已含於存在分）"
        }
      },
      "abilities": {
        "title": "能力／套件",
        "summary": "依遊戲主資料的能力與技能效果計分。無條件的固定 DEF／HP／移動力此處為 0；攻擊型對無條件攻擊力% 有輕微加分。HP／反擊條件的攻擊力有上限。Advantage: 系列能力此處不加分。強％效果用尺寸帶。單位能力上限 +3；角色套件上限 +14。",
        "when": {
          "Role-relevant combat effects": "對類型有用的戰鬥效果",
          "Permanent flat/rate stats, no condition": "無條件的固定／比例數值",
          "HP / Counter gated ATK%": "HP／反擊條件的攻擊力%",
          "Advantage: series ability": "Advantage: 系列能力",
          "MAP ammo effects": "MAP 彈數效果",
          "Physical/beam weapon range-down on hit": "命中時實彈／光束武裝射程下降",
          "Unbreakable (mainly pilots)": "不屈（主要為角色）"
        },
        "result": {
          "Points by effect (+ size bands)": "依效果給分（＋尺寸帶）",
          "0 (Attack unconditional ATK% +1)": "0（攻擊型無條件攻擊力% 為 +1）",
          "Soft-capped": "有上限",
          "0 here (in-series / tag filter only)": "此處 0（僅系列內／標籤相符時）",
          "0 here (counted under MAP)": "此處 0（計入 MAP）",
          "Rare debuff +1": "稀有弱化 +1",
          "Extra-life role bonus (separate factor)": "額外生命類型加分（另計）"
        }
      },
      "pilot_kit_flat": {
        "title": "角色能力／技能定額加分",
        "summary": "在類型 TraitType 點數之上，無條件的支援防禦／支援攻擊·支援反擊優先加分，有條件者較低，另有初始 MP。主動技能依每技能 0／+1／+2 合計。",
        "when": {
          "Unconditional Support Defense or Support Attack/Counter on an ability": "能力具有無條件的支援防禦或支援攻擊／支援反擊",
          "Conditional Support Defense or Support Attack/Counter on an ability": "能力具有條件性的支援防禦或支援攻擊／支援反擊",
          "Other conditional ability (any ActiveCondition, no SA/SD)": "其他條件能力（有發動條件、非 SA／SD）",
          "Initial MP ability (Cyber-Newtype / Enhanced Human, type 46)": "初始 MP 能力（強化人間／Cyber-Newtype，type 46）",
          "Non-damage skill (MOV, range, EN/HP restore, DEF up, hit/eva, …)": "非損傷技能（移動力、射程、EN／HP 回復、防禦上升、命中／閃避等）",
          "Damage skill (attack burst, Critical up, melee/range/awaken)": "損傷技能（攻擊爆發、爆擊上升、格鬥／射擊／覺醒）",
          "Utility skill (extra CS / SA / SD for 1 turn)": "輔助技能（1 回合額外 CS／SA／SD）",
          "Sway or MP Up skill": "Sway 或 MP 上升技能"
        },
        "result": {
          "+1 each skill": "每技能 +1",
          "+2 each skill": "每技能 +2"
        }
      },
      "ability_table_attack": {
        "title": "單位能力效果 — 攻擊型",
        "summary": "無尺寸帶時的基礎分；有則套用尺寸表。",
        "when": {
          "Damage dealt": "造成損傷",
          "Critical Damage dealt": "爆擊造成損傷",
          "Sure Hit Attack": "絕對命中攻擊",
          "Guaranteed Chance Step": "確定額外行動",
          "Guaranteed Chance Step Weapon Used Only": "確定額外行動（僅使用武裝時）",
          "Guaranteed critical": "必定爆擊",
          "Attack Change Rate": "攻擊力變化率",
          "Damage Given Correction Value": "造成損傷補正值",
          "Weapon Power Change Value": "武裝威力變化值",
          "Critical Damage Given Correction Value": "爆擊造成損傷補正值",
          "Weapon power (closer range)": "武裝威力（較近射程）",
          "Weapon power (longer range)": "武裝威力（較遠射程）",
          "Critical rate": "爆擊率",
          "Weapon Power Change Rate": "武裝威力變化率",
          "Weapon power rises with remaining HP": "依剩餘 HP 提升武裝威力",
          "Attack Change Value": "攻擊力變化值",
          "Attack Target Defense Reduction Rate": "攻擊目標防禦力減少率",
          "Attack Target Mobility Reduction Rate": "攻擊目標機動力減少率",
          "Weapon power rises when HP is low": "低 HP 時提升武裝威力",
          "Regeneration": "再生",
          "Weapon Debuff Value Addition": "武裝弱化值加算",
          "Weapon Debuff Duration Addition": "武裝弱化時間加算",
          "Weapon power rises when MP is low": "低 MP 時提升武裝威力",
          "Weapon power rises with MP": "依 MP 提升武裝威力"
        },
        "result": {}
      },
      "ability_table_defense": {
        "title": "單位能力效果 — 耐久型",
        "summary": "無尺寸帶時的基礎分；有則套用尺寸表。",
        "when": {
          "Damage taken": "受到損傷",
          "Defensive Damage Reduction Rate": "防禦時損傷減輕率",
          "Absolute Evasion": "絕對閃避",
          "Anti Damage Shield": "對損傷護盾",
          "Damage Negation": "損傷無效",
          "Unbreakable": "不屈",
          "Damage Taken Upper Limit Value": "受到損傷上限值",
          "Damage Barrier Max Hp Rate": "損傷屏障（最大 HP 比例）",
          "Damage Cut": "損傷削減",
          "Evasion Rate Change Rate": "閃避率變化率",
          "Defense Change Rate": "防禦力變化率",
          "Damage Taken Correction Value": "受到損傷補正值",
          "Support Defense": "支援防禦",
          "Regeneration": "再生",
          "Support Defense Adaptive": "支援防禦（適應）",
          "Support Defense Extend To Counter": "支援防禦延長至反擊",
          "Defense Change Value": "防禦力變化值",
          "Support Attack And Counter": "支援攻擊與反擊",
          "Support Attack And Counter Adaptive": "支援攻擊與反擊（適應）"
        },
        "result": {}
      },
      "ability_table_support": {
        "title": "單位能力效果 — 支援型",
        "summary": "無尺寸帶時的基礎分；有則套用尺寸表。",
        "when": {
          "Attack Target Defense Reduction Rate": "攻擊目標防禦力減少率",
          "Support Attack And Counter Adaptive": "支援攻擊與反擊（適應）",
          "Support Defense Adaptive": "支援防禦（適應）",
          "Weapon Debuff Value Addition": "武裝弱化值加算",
          "Attack Change Rate": "攻擊力變化率",
          "Damage dealt": "造成損傷",
          "Chance Step Max Count Change": "額外行動最大次數變化",
          "Sp Change Value": "SP 變化值",
          "Mp Change Rate": "MP 變化率",
          "Mp Change Value": "MP 變化值",
          "Support Attack And Counter": "支援攻擊與反擊",
          "Support Defense": "支援防禦",
          "Movement Change Value": "移動力變化值",
          "Attack Target Mobility Reduction Rate": "攻擊目標機動力減少率",
          "Guaranteed Chance Step": "確定額外行動",
          "Regeneration": "再生",
          "Weapon Debuff Duration Addition": "武裝弱化時間加算",
          "Support Defense Extend To Counter": "支援防禦延長至反擊",
          "Post Attack Move": "攻擊後移動",
          "Hp Change Rate": "HP 變化率"
        },
        "result": {}
      },
      "footprint": {
        "title": "2×2 佔位（單位）",
        "summary": "OccupiedArea 2×2 的單位有輕微上振 — 較寬的 MAP／增益覆蓋通常勝過配置不便。",
        "when": {
          "Attack 2×2": "攻擊型 2×2",
          "Support 2×2": "支援型 2×2",
          "Defense 2×2": "耐久型 2×2",
          "Not 2×2": "非 2×2"
        },
        "result": {}
      },
      "rarity": {
        "title": "稀有度調整（單位）",
        "summary": "不計分 — 由套件與戰鬥加分項目決定順位。低稀有度通常較少強技能／能力。",
        "when": {
          "N": "N",
          "R": "R",
          "SR": "SR",
          "SSR / UR": "SSR／UR",
          "All rarities": "全部稀有度"
        },
        "result": {}
      },
      "pilot_rarity": {
        "title": "稀有度調整（角色）",
        "summary": "不計分 — 由角色技能／能力實用性與推薦單位決定順位。",
        "when": {
          "N": "N",
          "R": "R",
          "SR": "SR",
          "SSR / UR": "SSR／UR",
          "All rarities": "全部稀有度"
        },
        "result": {}
      },
      "pilot_stats_attack": {
        "title": "角色 SP 養成數值 — 攻擊型",
        "summary": "此角色類型的 SP 清單養成數值。攻擊型最看重適性數值（射擊／格鬥／覺醒）；耐久型角色更看重守備／反應。",
        "when": {
          "Ranged < 700": "射擊值 < 700",
          "Ranged 700–734": "射擊值 700–734",
          "Ranged 735–769": "射擊值 735–769",
          "Ranged 770–794": "射擊值 770–794",
          "Ranged ≥ 795": "射擊值 ≥ 795",
          "Melee < 700": "格鬥值 < 700",
          "Melee 700–734": "格鬥值 700–734",
          "Melee 735–769": "格鬥值 735–769",
          "Melee 770–794": "格鬥值 770–794",
          "Melee ≥ 795": "格鬥值 ≥ 795",
          "Awaken < 600": "覺醒值 < 600",
          "Awaken 600–649": "覺醒值 600–649",
          "Awaken 650–699": "覺醒值 650–699",
          "Awaken 700–749": "覺醒值 700–749",
          "Awaken ≥ 750": "覺醒值 ≥ 750",
          "Defense < 460": "守備值 < 460",
          "Defense 460–499": "守備值 460–499",
          "Defense 500–524": "守備值 500–524",
          "Defense 525–549": "守備值 525–549",
          "Defense ≥ 550": "守備值 ≥ 550",
          "Reaction < 550": "反應值 < 550",
          "Reaction 550–574": "反應值 550–574",
          "Reaction 575–599": "反應值 575–599",
          "Reaction 600–649": "反應值 600–649",
          "Reaction ≥ 650": "反應值 ≥ 650"
        },
        "result": {}
      },
      "pilot_stats_defense": {
        "title": "角色 SP 養成數值 — 耐久型",
        "summary": "此角色類型的 SP 清單養成數值。攻擊型最看重適性數值（射擊／格鬥／覺醒）；耐久型角色更看重守備／反應。",
        "when": {
          "Ranged < 500": "射擊值 < 500",
          "Ranged 500–539": "射擊值 500–539",
          "Ranged 540–569": "射擊值 540–569",
          "Ranged 570–599": "射擊值 570–599",
          "Ranged ≥ 600": "射擊值 ≥ 600",
          "Melee < 500": "格鬥值 < 500",
          "Melee 500–539": "格鬥值 500–539",
          "Melee 540–569": "格鬥值 540–569",
          "Melee 570–599": "格鬥值 570–599",
          "Melee ≥ 600": "格鬥值 ≥ 600",
          "Awaken < 500": "覺醒值 < 500",
          "Awaken 500–549": "覺醒值 500–549",
          "Awaken 550–599": "覺醒值 550–599",
          "Awaken 600–699": "覺醒值 600–699",
          "Awaken ≥ 700": "覺醒值 ≥ 700",
          "Defense < 700": "守備值 < 700",
          "Defense 700–724": "守備值 700–724",
          "Defense 725–749": "守備值 725–749",
          "Defense 750–774": "守備值 750–774",
          "Defense ≥ 775": "守備值 ≥ 775",
          "Reaction < 700": "反應值 < 700",
          "Reaction 700–739": "反應值 700–739",
          "Reaction 740–769": "反應值 740–769",
          "Reaction 770–799": "反應值 770–799",
          "Reaction ≥ 800": "反應值 ≥ 800"
        },
        "result": {}
      },
      "pilot_stats_support": {
        "title": "角色 SP 養成數值 — 支援型",
        "summary": "此角色類型的 SP 清單養成數值。攻擊型最看重適性數值（射擊／格鬥／覺醒）；耐久型角色更看重守備／反應。",
        "when": {
          "Ranged < 655": "射擊值 < 655",
          "Ranged 655–699": "射擊值 655–699",
          "Ranged 700–734": "射擊值 700–734",
          "Ranged 735–794": "射擊值 735–794",
          "Ranged ≥ 795": "射擊值 ≥ 795",
          "Melee < 655": "格鬥值 < 655",
          "Melee 655–699": "格鬥值 655–699",
          "Melee 700–734": "格鬥值 700–734",
          "Melee 735–794": "格鬥值 735–794",
          "Melee ≥ 795": "格鬥值 ≥ 795",
          "Awaken < 600": "覺醒值 < 600",
          "Awaken 600–649": "覺醒值 600–649",
          "Awaken 650–699": "覺醒值 650–699",
          "Awaken 700–749": "覺醒值 700–749",
          "Awaken ≥ 750": "覺醒值 ≥ 750",
          "Defense < 500": "守備值 < 500",
          "Defense 500–524": "守備值 500–524",
          "Defense 525–549": "守備值 525–549",
          "Defense 550–649": "守備值 550–649",
          "Defense ≥ 650": "守備值 ≥ 650",
          "Reaction < 550": "反應值 < 550",
          "Reaction 550–599": "反應值 550–599",
          "Reaction 600–649": "反應值 600–649",
          "Reaction 650–699": "反應值 650–699",
          "Reaction ≥ 700": "反應值 ≥ 700"
        },
        "result": {}
      },
      "pilots_extra": {
        "title": "角色專用項目",
        "summary": "角色僅使用 SP 盤。帶狀表見上方角色 SP 養成數值各區塊。",
        "when": {
          "SP grown stats (Ranged / Melee / Awaken / Defense / Reaction)": "SP 養成數值（射擊值／格鬥值／覺醒值／守備值／反應值）",
          "Series affinity abilities": "系列親和能力",
          "Best recommended MS letter (A and up)": "最佳推薦單位字母（A 以上）",
          "Unbreakable on pilot abilities": "角色能力上的不屈"
        },
        "result": {
          "Band points by role (see tables above)": "依類型帶狀給分（見上表）",
          "+3 each": "各 +3",
          "From this guide’s unit letters (B+ no longer scores)": "取自本指南單位字母（B+ 以下不再計分）",
          "Extra-life role bonus": "額外生命類型加分"
        }
      }
    },
    "HK": {
      "buckets": {
        "title": "由字母到分桶",
        "summary": "點數合計對應字母，再對應分桶。玩家主要睇分桶。",
        "when": {
          "S+ Attack Type (score 18+)": "S+ 攻擊型（18 分以上）",
          "S+ Defense Type (score 22+)": "S+ 耐久型（22 分以上）",
          "S+ Support Type (score 19+)": "S+ 支援型（19 分以上）",
          "S+ (score 17+)": "S+（17 分以上）",
          "S+ Defense Type": "S+ 耐久型",
          "S+ Support Type": "S+ 支援型",
          "S+ Defense Type Characters": "S+ 耐久型角色",
          "S+ (score 23+)": "S+（23 分以上）",
          "S": "S",
          "A+ or A": "A+ 或 A",
          "B+ or B": "B+ 或 B",
          "C, D, or E": "C、D 或 E"
        },
        "result": {
          "BEYOND THE TIME": "BEYOND THE TIME",
          "BEYOND THE TIME (Attack)": "BEYOND THE TIME（攻擊型）",
          "BEYOND THE TIME (Attack / Support)": "BEYOND THE TIME（攻擊型／支援型）",
          "BEYOND THE TIME only at 18+ if the kit tanks more than one hit (HP + Shield Defense / special DR / Unbreakable) and has Preemptive Strike or Support Defense coverage (unit SD kit or MOV 6)": "要 18 分以上，而且要頂得過一擊（HP＋盾牌防禦／特殊減傷／逃生機能），再加先發攻擊或支援防禦覆蓋（機體套件或移動力 6）先入 BEYOND THE TIME",
          "BEYOND THE TIME only at 18+ if the kit tanks more than one hit (HP + Shield Defense / special DR / Unbreakable) and has lasting ATK Down at Lv5+ (30%+ — tank analog of Support DEF Down), and has Preemptive Strike or Support Defense coverage (unit SD kit or MOV 6)": "要 18 分以上，而且要有持續攻擊力減少（Lv5／30%+）、頂得過一擊（HP＋盾牌防禦／特殊減傷／逃生機能），再加先發攻擊或支援防禦覆蓋（機體套件或移動力 6）先入 BEYOND THE TIME",
          "BEYOND THE TIME only at 17+ with lasting DEF Down / pierce at Lv5+ (30%+). MAP-only kits stay Recommended": "要 17 分以上而且有持續防禦力減少／貫穿（Lv5／30%+）先入 BEYOND THE TIME。淨係 MAP 嘅套件維持推薦",
          "BEYOND THE TIME only with Defense or Reaction band points (kit-only Durability Characters stay Recommended)": "要有防禦或反應帶分數先入 BEYOND THE TIME（淨靠套件加分嘅耐久型角色維持推薦）",
          "Recommended": "推薦",
          "Solid": "穩健",
          "Situational": "睇場合",
          "Niche": "小眾"
        }
      },
      "role_focus_attack": {
        "title": "攻擊型優先事項",
        "summary": "先睇火力上限（ATK＋武裝威力），再睇移動力／MAP兵器。HP 同 SSP EN 淨計上振 — 高就加分，低唔扣分。MOB 係較弱嘅次要項。",
        "when": {
          "Primary": "主軸",
          "Upside only": "僅上振",
          "Soft secondary": "較弱次要",
          "Great extras": "優秀附加",
          "Not scored": "不計分"
        },
        "result": {
          "ATK · weapon power · MOV": "ATK · 武裝威力 · MOV",
          "HP · SSP EN (no floor penalty)": "HP · SSP EN（無下限扣分）",
          "Mobility / MOB (lower ceiling than ATK)": "機動力（上限低於攻擊力）",
          "MAP presence / dash / coverage · special defense kits": "MAP 存在／衝刺／覆蓋 · 特殊防禦套件",
          "DEF · Debuff kinds · ATK Down / DEF Down · SP EN": "DEF · 弱化種類 · 攻擊力減少／防禦力減少 · SP EN"
        }
      },
      "role_focus_defense": {
        "title": "耐久型優先事項",
        "summary": "高 HP 或 DEF、盾牌防禦（約忽略 20% 損傷）、支援防禦覆蓋用嘅高移動力、穩健地形（宇宙＋地上或空中）、生存套件（損傷減輕／HP 回復），外加攻擊力減少（對應支援型防禦力減少嘅耐久手段）。ATK 淨計上振（≥9000）。特殊防禦（I力場／屏障／DR）係額外存在加分。BEYOND THE TIME 另外要頂得過一擊，同埋先發攻擊或支援防禦覆蓋。",
        "when": {
          "Primary": "主軸",
          "Secondary": "次要",
          "ATK upside": "ATK 上振",
          "Special defense": "特殊防禦",
          "BEYOND THE TIME gate": "BEYOND THE TIME 條件"
        },
        "result": {
          "HP · DEF · shield · MOV · terrain · survivability abilities": "HP · DEF · 盾 · 移動力 · 地形 · 生存能力",
          "A few good pierce / DEF-down debuffs (R4+ kinds)": "幾個好用嘅貫穿／DEF 下降弱化（射程 4+ 種）",
          "ATK Down strength (R4+ kinds) — tank analog of Support DEF Down": "攻擊力減少強度（射程 4+ 種）— 對應支援型防禦力減少嘅耐久手段",
          "≥9000 mild bonus; below that, no penalty": "≥9000 輕微加分；低過就唔扣分",
          "Presence bonus for DR / barrier / negation kits": "DR／屏障／無效化套件的存在加分",
          "18+ points, HP that survives more than one hit, and Preemptive Strike or Support Defense coverage": "18 分以上、頂得過一擊嘅 HP、先發攻擊或支援防禦覆蓋",
          "18+ points, lasting ATK Down Lv5+, HP that survives more than one hit, and Preemptive Strike or Support Defense coverage": "18 分以上、持續攻擊力減少 Lv5+、頂得過一擊嘅 HP、先發攻擊或支援防禦覆蓋"
        }
      },
      "role_focus_support": {
        "title": "支援型優先事項",
        "summary": "弱化武裝射程至少 5（更短就較弱），再睇弱化種類同強度，再睇高機動力／移動力。攻擊力同 HP 淨係輕微上振 — 較低數值無下限扣分。",
        "when": {
          "Primary": "主軸",
          "Secondary": "次要"
        },
        "result": {
          "Weapon range ≥5 · R5+ debuff kinds · DEF Down · Mobility (MOB) · MOV": "武裝射程≥5 · 射程5+弱化種類 · 防禦力減少 · 機動力 · 移動力",
          "ATK / weapon power / HP (mild upside, no floor penalty)": "攻擊力／武裝威力／HP（輕微上振，無下限扣分）"
        }
      },
      "er_access": {
        "title": "永恆之路 Expert 適性（單位）",
        "summary": "單位可出擊嘅永恆之路 Expert 關卡數（標籤／系列適性）。壓縮分帶，避免細微適性差直接造成級差。",
        "when": {
          "0–1 Expert stages": "Expert 關卡 0–1",
          "2–6 Expert stages": "Expert 關卡 2–6",
          "7–999 Expert stages": "Expert 關卡 7–999"
        },
        "result": {}
      },
      "pilot_er_access": {
        "title": "永恆之路 Expert 適性（角色）",
        "summary": "只計有角色限制嘅 Expert 關卡。角色自由出擊關卡唔加分。",
        "when": {
          "0–0 character-restricted Expert stages": "角色限制 Expert 0",
          "1–1 character-restricted Expert stages": "角色限制 Expert 1",
          "2–999 character-restricted Expert stages": "角色限制 Expert 2+"
        },
        "result": {}
      },
      "pilot_combat_actions": {
        "title": "戰鬥行動 — 額外行動／支援攻擊／支援防禦 +1",
        "summary": "主資料入面嘅 +1 行動經濟（同列表 ×2 篩選同一套）。跟類型加權。唔會用通關影片出場次數計分。",
        "when": {
          "Chance Step +1": "額外行動 +1",
          "Support Attack +1": "支援攻擊 +1",
          "Support Defense +1": "支援防禦 +1"
        },
        "result": {}
      },
      "strategic_tags": {
        "title": "戰略標籤",
        "summary": "非風味標籤跟住佢喺 UR 單位出現頻率計分（限定 UR 重過常駐 UR）。已經出現喺 Expert 限制入面嘅標籤呢度唔加分。上限 +2。",
        "when": {
          "weight 0–2": "權重 0–2",
          "weight 3–7": "權重 3–7",
          "weight 8–14": "權重 8–14",
          "weight 15–24": "權重 15–24",
          "weight ≥ 25": "權重 ≥ 25"
        },
        "result": {}
      },
      "terrain": {
        "title": "地形適性（單位）",
        "summary": "出擊等級 ≥2 視為可用。額外／完美要完全適性（Lv≥3・圓）。地形適性「三角形」（Lv2）嘅宇宙／空中各 −1。SSP 盤用 SSP 強化後地形。下限係宇宙＋地上或空中（拜亞蘭式宇宙＋空中都得）。",
        "when": {
          "Missing Space, or missing both Land and Atmospheric": "缺少宇宙，或同時缺少地上與空中",
          "Space + Land (or Space + Atmospheric) at deploy Lv≥2": "宇宙＋地上（或宇宙＋空中）出擊 Lv≥2",
          "+ Atmospheric / Underwater / Sea at full affinity Lv≥3 (each)": "＋空中／水中／海（各・完全適性 Lv≥3）",
          "Triangle (Lv2) Space or Atmospheric (each)": "地形適性「三角形」（Lv2）嘅宇宙或空中（各）",
          "Perfect (4+ terrains at full affinity, no triangle)": "完美（完全適性 4 項以上、無三角形）",
          "Perfect (4+ terrains at full affinity)": "完美（完全適性嘅宇宙／地上／空中／水中／海 4 項以上）",
          "Atmospheric used as Land substitute (no Land)": "以空中代替地上（無地上）"
        },
        "result": {
          "0 extra for Atmospheric": "空中額外 0",
          "+1 extra": "+1 額外"
        }
      },
      "movement_attack": {
        "title": "移動力 — 攻擊型",
        "summary": "移動力的主要加分。追擊（可疊加，上限 +2）：移動後 MAP 及／或 額外行動／攻擊後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "movement_defense": {
        "title": "移動力 — 耐久型",
        "summary": "移動力的主要加分。追擊（可疊加，上限 +2）：移動後 MAP 及／或 額外行動／攻擊後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "movement_support": {
        "title": "移動力 — 支援型",
        "summary": "移動力的主要加分。追擊（可疊加，上限 +2）：移動後 MAP 及／或 額外行動／攻擊後移動。",
        "when": {
          "MOV ≤3": "MOV ≤3",
          "MOV 4": "MOV 4",
          "MOV 5": "MOV 5",
          "MOV ≥6": "MOV ≥6"
        },
        "result": {}
      },
      "weapon_power_sp_attack": {
        "title": "武裝威力 — SP化 — 攻擊型",
        "summary": "看板非 MAP Lv5 最大威力。攻擊型優先損傷。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_sp_defense": {
        "title": "武裝威力 — SP化 — 耐久型",
        "summary": "看板非 MAP Lv5 最大威力。耐久型上限較攻擊型寬鬆。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_sp_support": {
        "title": "武裝威力 — SP化 — 支援型",
        "summary": "看板非 MAP Lv5 最大威力。支援型較輕 — 損傷係次要。",
        "when": {
          "power < 5000": "威力 < 5000",
          "power 5000–5399": "威力 5000–5399",
          "power 5400–5699": "威力 5400–5699",
          "power 5700–5999": "威力 5700–5999",
          "power ≥ 6000": "威力 ≥ 6000"
        },
        "result": {}
      },
      "weapon_power_ssp_attack": {
        "title": "武裝威力 — SSP化 — 攻擊型",
        "summary": "看板非 MAP Lv5 最大威力。攻擊型優先損傷。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_power_ssp_defense": {
        "title": "武裝威力 — SSP化 — 耐久型",
        "summary": "看板非 MAP Lv5 最大威力。耐久型上限較攻擊型寬鬆。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_power_ssp_support": {
        "title": "武裝威力 — SSP化 — 支援型",
        "summary": "看板非 MAP Lv5 最大威力。支援型較輕 — 損傷係次要。",
        "when": {
          "power < 5600": "威力 < 5600",
          "power 5600–5999": "威力 5600–5999",
          "power 6000–6299": "威力 6000–6299",
          "power 6300–6699": "威力 6300–6699",
          "power ≥ 6700": "威力 ≥ 6700"
        },
        "result": {}
      },
      "weapon_bonus": {
        "title": "武裝條件加分（單位）",
        "summary": "淨限表上威力最高嘅非 MAP 攻擊之條件加分 — 唔計其他武裝。爆擊損傷較輕（+1）；爆擊率要 ≥20% 先 +1；必定爆擊 +2。格子／地圖位置文字加分已廢除（0）。最大射程 ≤3 時忽略長射程加分。",
        "when": {
          "Critical damage": "爆擊損傷",
          "Higher HP": "高 HP 時",
          "Lower HP": "低 HP 時",
          "Higher range": "較長射程時",
          "Lower range": "較短射程時",
          "Higher MP": "高 MP 時",
          "Reduce Def": "降低 DEF",
          "Tile / map position (retired)": "格子／地圖位置（已廢除）",
          "Critical rate (≥20%)": "爆擊率（≥20%）",
          "Guaranteed critical": "必定爆擊"
        },
        "result": {}
      },
      "dual_attack_attr": {
        "title": "複合適性攻擊（單位）",
        "summary": "最強攻擊用射擊／格鬥／覺醒入面兩種或以上（例：強化 ZZ 高メガ加農）。同鐳射／物理／特殊嘅複合損傷屬性唔同。",
        "when": {
          "≥2 combat specialties on strongest weapon": "最強武裝具有 2 種以上攻擊適性",
          "≥2 attack types on strongest weapon": "最強武裝具有 2 種以上攻擊適性"
        },
        "result": {}
      },
      "multi_weapon_attr": {
        "title": "複合損傷屬性（單位）",
        "summary": "武裝（含 MAP）具備鐳射／物理／特殊入面兩種或以上。全圖鑑適用 — 唔係巴巴托斯狼王／狼王Rex 限定。",
        "when": {
          "≥2 damage types on any weapon (MAP counted)": "任一武裝具有 2 種以上損傷屬性（含 MAP）",
          "≥2 damage types on any weapon": "任一武裝具有 2 種以上損傷屬性"
        },
        "result": {}
      },
      "weapon_damage_attr": {
        "title": "特殊損傷屬性（單位）",
        "summary": "最強非 MAP 武裝嘅損傷屬性。特殊（含特殊嘅複合）加分；淨係鐳射或淨係物理係 0。同複合損傷屬性分開加分。",
        "when": {
          "Strongest non-MAP includes Special": "最強非 MAP 含特殊",
          "Beam-only or Physical-only": "淨係鐳射或淨係物理"
        },
        "result": {}
      },
      "source_bucket": {
        "title": "取得來源（單位）— 淨係篩選",
        "summary": "唔影響字母分數。用取得來源篩選比較機體補給獲得單位／開發單位／其他。各途徑加分為 0。",
        "when": {
          "Units from Unit Assembly": "單位補給獲得單位",
          "Development Unit": "開發單位",
          "Other": "其他"
        },
        "result": {}
      },
      "limited_supporter_tags": {
        "title": "限定期間支援人員標籤",
        "summary": "每個由限定期間機體補給支援人員隊長技能（第 3 階）涵蓋嘅標籤 +1，上限 +2。清單見計分指南。",
        "when": {
          "Any Tag covered by a limited-time Supporter leader skill": "持有任一限定期間支援人員隊長技能涵蓋嘅標籤",
          "Each Tag covered by a limited-time Supporter leader skill": "每個符合標籤",
          "Cap": "上限"
        },
        "result": {}
      },
      "weapon_range_attack": {
        "title": "武裝射程 — 攻擊型",
        "summary": "看板上非 MAP 武裝嘅最大射程。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "weapon_range_defense": {
        "title": "武裝射程 — 耐久型",
        "summary": "看板上非 MAP 武裝嘅最大射程。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "weapon_range_support": {
        "title": "武裝射程 — 支援型",
        "summary": "支援型基準係射程 5；更短就較弱。",
        "when": {
          "Max range 1": "最大射程 1",
          "Max range 2": "最大射程 2",
          "Max range 3": "最大射程 3",
          "Max range 4": "最大射程 4",
          "Max range 5": "最大射程 5",
          "Max range 6": "最大射程 6"
        },
        "result": {}
      },
      "combat_flags": {
        "title": "戰鬥旗標（單位）",
        "summary": "淨係喺增加實用工具時先俾戰鬥加分（唔係免費剔變形）。",
        "when": {
          "Transform alt unlocks deployable terrain, higher MOV, longer range, higher weapon power, and/or adds MAP vs base form": "變形後解鎖可出擊地形、更高移動力、更長射程、更高武裝威力，及／或相對本體新增 MAP兵器",
          "Transform with no strategic gain vs base": "相對本體無戰略收益嘅變形",
          "Best weapon only usable at Max Vigor (stronger than unrestricted best) — MP/pilot-gated; weak for ML / one-turn kill": "最強武裝淨係最大戰意可用（強過無限制最強）— MP／角色條件；對大師聯賽／一回合擊殺較弱",
          "Preemptive Strike": "先發攻擊",
          "Rare physical/beam range-down on hit": "命中時稀有的實彈／鐳射射程下降",
          "Unbreakable (survive lethal once)": "不屈（可承受一次致命）"
        },
        "result": {
          "+1 (cap +2 with ++1 per extra gain type)": "+1（每多一種收益 +1，上限 +2）",
          "Atk +1 / Def +2 / Sup +1": "攻擊型 +1／耐久型 +2／支援型 +1"
        }
      },
      "shield_attack": {
        "title": "盾 — 攻擊型",
        "summary": "單位有冇盾（來自單位裝置）。",
        "when": {
          "Has shield": "有盾",
          "Missing shield": "冇盾"
        },
        "result": {}
      },
      "shield_defense": {
        "title": "盾 — 耐久型",
        "summary": "盾約忽略 20% 損傷 — 耐久型冇盾會重罰。",
        "when": {
          "Has shield": "有盾",
          "Missing shield": "冇盾"
        },
        "result": {}
      },
      "shield_support": {
        "title": "盾 — 支援型",
        "summary": "單位有冇盾（來自單位裝置）。",
        "when": {
          "Has shield": "有盾",
          "Missing shield": "冇盾"
        },
        "result": {}
      },
      "special_defense": {
        "title": "特殊防禦套件（單位）",
        "summary": "盾裝置以外嘅能力系減傷存在加分（受傷降低、防禦 DR、無效化、HP% 屏障／I力場系削減）。無缺席扣分 — 攻擊／支援玻璃大砲唔會因此被罰。",
        "when": {
          "No special defense traits": "無特殊防禦特性",
          "1 distinct special-defense trait": "1 種唔同嘅特殊防禦特性",
          "2+ distinct special-defense traits": "2 種或以上唔同嘅特殊防禦特性"
        },
        "result": {}
      },
      "ur_pilot_dependence": {
        "title": "UR 推薦角色依賴（單位）",
        "summary": "單位推薦／連結角色係 UR 或終極時輕微扣分（峰值套件多數假設嗰個角色）。仍然可以用 SSR 親和角色投資 — 呢個係揭露，唔係封殺。",
        "when": {
          "Recommend pilot is SSR or below": "推薦角色係 SSR 或以下",
          "Recommend pilot rarity index ≥5 or Ultimate": "推薦角色稀有指數 ≥5 或終極"
        },
        "result": {}
      },
      "stat_outlier": {
        "title": "突出次要數值（單位）",
        "summary": "次要數值明顯高過該類型平均時嘅小眾加分。上限 +2。",
        "when": {
          "Attack: HP ≥ 105000": "攻擊型: HP ≥ 105000",
          "Attack: EN ≥ 450 (SSP only)": "攻擊型: EN ≥ 450（淨係 SSP）",
          "Defense: ATK ≥ 11000": "耐久型: ATK ≥ 11000",
          "Support: DEF ≥ 10000": "支援型: DEF ≥ 10000",
          "Support: HP ≥ 98000": "支援型: HP ≥ 98000"
        },
        "result": {}
      },
      "unit_stats_attack": {
        "title": "單位 SP 養成數值 — 攻擊型",
        "summary": "攻擊型重視攻擊力上限多過機動力。HP 淨計上振（無下限扣分）。DEF 唔計分。EN 淨喺 SSP 盤計分（淨上振）。機動力軟上限。",
        "when": {
          "HP < 95000": "HP < 95000",
          "HP 95000–99999": "HP 95000–99999",
          "HP ≥ 100000": "HP ≥ 100000",
          "EN < 400": "EN < 400",
          "EN 400–449": "EN 400–449",
          "EN ≥ 450": "EN ≥ 450",
          "ATK < 11200": "ATK < 11200",
          "ATK 11200–11599": "ATK 11200–11599",
          "ATK 11600–11999": "ATK 11600–11999",
          "ATK 12000–12399": "ATK 12000–12399",
          "ATK 12400–12799": "ATK 12400–12799",
          "ATK ≥ 12800": "ATK ≥ 12800",
          "any": "any",
          "Mobility (MOB) < 9000": "機動力 < 9000",
          "Mobility (MOB) 9000–9599": "機動力 9000–9599",
          "Mobility (MOB) 9600–9999": "機動力 9600–9999",
          "Mobility (MOB) ≥ 10000": "機動力 ≥ 10000"
        },
        "result": {}
      },
      "unit_stats_defense": {
        "title": "單位 SP 養成數值 — 耐久型",
        "summary": "耐久型聚焦 HP＋DEF（保留下限扣分）。ATK 淨計上振（≥9000 → +1、≥10000 → +2；無下限扣分）。",
        "when": {
          "HP < 105000": "HP < 105000",
          "HP 105000–109999": "HP 105000–109999",
          "HP 110000–124999": "HP 110000–124999",
          "HP 125000–129999": "HP 125000–129999",
          "HP ≥ 130000": "HP ≥ 130000",
          "ATK < 9000": "ATK < 9000",
          "ATK 9000–9999": "ATK 9000–9999",
          "ATK ≥ 10000": "ATK ≥ 10000",
          "DEF < 9500": "DEF < 9500",
          "DEF 9500–10499": "DEF 9500–10499",
          "DEF 10500–11099": "DEF 10500–11099",
          "DEF 11100–11999": "DEF 11100–11999",
          "DEF ≥ 12000": "DEF ≥ 12000",
          "Mobility (MOB) < 7700": "機動力 < 7700",
          "Mobility (MOB) 7700–7799": "機動力 7700–7799",
          "Mobility (MOB) 7800–8099": "機動力 7800–8099",
          "Mobility (MOB) 8100–8399": "機動力 8100–8399",
          "Mobility (MOB) ≥ 8400": "機動力 ≥ 8400"
        },
        "result": {}
      },
      "unit_stats_support": {
        "title": "單位 SP 養成數值 — 支援型",
        "summary": "支援型重視機動力上限；ATK 同 HP 係輕微上振而且無下限扣分。",
        "when": {
          "HP < 91000": "HP < 91000",
          "HP 91000–93999": "HP 91000–93999",
          "HP ≥ 94000": "HP ≥ 94000",
          "ATK < 10500": "ATK < 10500",
          "ATK 10500–11499": "ATK 10500–11499",
          "ATK ≥ 11500": "ATK ≥ 11500",
          "DEF < 8300": "DEF < 8300",
          "DEF 8300–8599": "DEF 8300–8599",
          "DEF 8600–9099": "DEF 8600–9099",
          "DEF 9100–9399": "DEF 9100–9399",
          "DEF ≥ 9400": "DEF ≥ 9400",
          "Mobility (MOB) < 9000": "機動力 < 9000",
          "Mobility (MOB) 9000–9499": "機動力 9000–9499",
          "Mobility (MOB) 9500–9999": "機動力 9500–9999",
          "Mobility (MOB) 10000–10499": "機動力 10000–10499",
          "Mobility (MOB) ≥ 10500": "機動力 ≥ 10500"
        },
        "result": {}
      },
      "debuffs": {
        "title": "弱化（耐久型／支援型單位）",
        "summary": "攻擊型略過呢啲項目。支援型用持續防禦力減少％或即時貫穿（≈10%→3 … 40%+→6）。耐久型用持續攻擊力減少％（降低敵攻擊力嚟多頂幾下）。耐久型計算射程 ≥4 嘅唔同弱化種類（較輕；受傷降低算一種）。支援型計算射程 ≥5 嘅種類，更睇重減少％。支援型 BEYOND THE TIME 另外要防禦力減少／貫穿 Lv5+。",
        "when": {
          "Attack role": "攻擊型",
          "Defense: 0 / 1 / 2+ distinct R4+ debuff kinds": "耐久型：射程 4+ 不同弱化種類 0／1／2+",
          "Support: 0 / 1 / 2+ distinct R5+ debuff kinds": "支援型：射程 5+ 不同弱化種類 0／1／2+",
          "Defense pierce / DEF-down level": "耐久型貫穿／DEF 下降等級",
          "Defense ATK Down level": "耐久型攻擊力減少等級",
          "Support DEF Down / pierce level": "支援型防禦力減少／貫穿等級",
          "Support pierce / DEF-down level": "支援型貫穿／DEF 下降等級"
        },
        "result": {
          "Not scored": "唔計分",
          "0 / 0 / +1": "0／0／+1",
          "-1 / 0 / +1": "−1／0／+1",
          "none -2 · Lv3 -1 · Lv4 0 · Lv5 +1 · Lv6 +2": "無 −2 · Lv3 −1 · Lv4 0 · Lv5 +1 · Lv6 +2",
          "none -2 · Lv3 -2 · Lv4 -1 · Lv5 +1 · Lv6 +2": "無 −2 · Lv3 −2 · Lv4 −1 · Lv5 +1 · Lv6 +2"
        }
      },
      "linked_pilot": {
        "title": "親和角色池（單位）",
        "summary": "對呢個單位有駕駛標籤／EX 配對親和嘅同類型 SSR+ 角色數。較深嘅池優於單一連結推薦。",
        "when": {
          "0 matching SSR+ pilots": "符合嘅 SSR+ 角色 0",
          "1–2 matching SSR+ pilots": "符合嘅 SSR+ 角色 1–2",
          "3–5 matching SSR+ pilots": "符合嘅 SSR+ 角色 3–5",
          "≥ 6 matching SSR+ pilots": "符合嘅 SSR+ 角色 ≥6"
        },
        "result": {}
      },
      "map": {
        "title": "MAP兵器（單位）",
        "summary": "損傷 MAP（攻擊類別、威力 ≥1）：存在、衝刺／移動攻擊、彈數 2+、覆蓋（0–14 格=0、15–24=+1、25+=+2）。回復／友方支援 MAP（回復類別，例如 MP 供給嘅 Psycho-Field／Live Concert）改計 +1，唔畀損傷 MAP 嘅覆蓋分。攻擊型上限 +4；耐久／支援型上限 +2。",
        "when": {
          "Damage MAP weapon": "損傷 MAP兵器",
          "Recovery / ally-support MAP (MP supply, buff allies)": "回復／友方支援 MAP（MP 供給、強化友軍）",
          "Dash / MovingAttack MAP": "衝刺／移動攻擊 MAP",
          "Ammo 1": "彈數 1",
          "Ammo ≥2": "彈數 ≥2",
          "0–14 cells": "0–14 格",
          "15–24 cells": "15–24 格",
          "≥ 25 cells": "≥25 格"
        },
        "result": {
          "0 (covered by presence)": "0（已經包喺存在分）"
        }
      },
      "abilities": {
        "title": "能力／套件",
        "summary": "跟遊戲主資料嘅能力同技能效果計分。無條件嘅固定 DEF／HP／移動力呢度係 0；攻擊型對無條件攻擊力% 有輕微加分。HP／反擊條件嘅攻擊力有上限。Advantage: 系列能力呢度唔加分。強％效果用尺寸帶。單位能力上限 +3；角色套件上限 +14。",
        "when": {
          "Role-relevant combat effects": "對類型有用嘅戰鬥效果",
          "Permanent flat/rate stats, no condition": "無條件嘅固定／比例數值",
          "HP / Counter gated ATK%": "HP／反擊條件嘅攻擊力%",
          "Advantage: series ability": "Advantage: 系列能力",
          "MAP ammo effects": "MAP 彈數效果",
          "Physical/beam weapon range-down on hit": "命中時實彈／鐳射武裝射程下降",
          "Unbreakable (mainly pilots)": "不屈（主要係角色）"
        },
        "result": {
          "Points by effect (+ size bands)": "跟效果俾分（＋尺寸帶）",
          "0 (Attack unconditional ATK% +1)": "0（攻擊型無條件攻擊力% 係 +1）",
          "Soft-capped": "有上限",
          "0 here (in-series / tag filter only)": "呢度 0（淨係系列內／標籤相符時）",
          "0 here (counted under MAP)": "呢度 0（計入 MAP）",
          "Rare debuff +1": "稀有弱化 +1",
          "Extra-life role bonus (separate factor)": "額外生命類型加分（另計）"
        }
      },
      "pilot_kit_flat": {
        "title": "角色能力／技能定額加分",
        "summary": "喺類型 TraitType 分數之上，無條件嘅支援防禦／支援攻擊·支援反擊優先加分，有條件嘅較低，另有初始 MP。主動技能按每技能 0／+1／+2 合計。",
        "when": {
          "Unconditional Support Defense or Support Attack/Counter on an ability": "能力有無條件嘅支援防禦或支援攻擊／支援反擊",
          "Conditional Support Defense or Support Attack/Counter on an ability": "能力有條件性嘅支援防禦或支援攻擊／支援反擊",
          "Other conditional ability (any ActiveCondition, no SA/SD)": "其他條件能力（有發動條件、非 SA／SD）",
          "Initial MP ability (Cyber-Newtype / Enhanced Human, type 46)": "初始 MP 能力（強化人間／Cyber-Newtype，type 46）",
          "Non-damage skill (MOV, range, EN/HP restore, DEF up, hit/eva, …)": "非損傷技能（移動力、射程、EN／HP 回復、防禦上升、命中／閃避等）",
          "Damage skill (attack burst, Critical up, melee/range/awaken)": "損傷技能（攻擊爆發、爆擊上升、格鬥／射擊／覺醒）",
          "Utility skill (extra CS / SA / SD for 1 turn)": "輔助技能（1 回合額外 CS／SA／SD）",
          "Sway or MP Up skill": "Sway 或 MP 上升技能"
        },
        "result": {
          "+1 each skill": "每技能 +1",
          "+2 each skill": "每技能 +2"
        }
      },
      "ability_table_attack": {
        "title": "單位能力效果 — 攻擊型",
        "summary": "無尺寸帶時嘅基礎分；有就套用尺寸表。",
        "when": {
          "Damage dealt": "造成損傷",
          "Critical Damage dealt": "爆擊造成損傷",
          "Sure Hit Attack": "絕對命中攻擊",
          "Guaranteed Chance Step": "確定額外行動",
          "Guaranteed Chance Step Weapon Used Only": "確定額外行動（淨係使用武裝時）",
          "Guaranteed critical": "必定爆擊",
          "Attack Change Rate": "攻擊力變化率",
          "Damage Given Correction Value": "造成損傷補正值",
          "Weapon Power Change Value": "武裝威力變化值",
          "Critical Damage Given Correction Value": "爆擊造成損傷補正值",
          "Weapon power (closer range)": "武裝威力（較近射程）",
          "Weapon power (longer range)": "武裝威力（較遠射程）",
          "Critical rate": "爆擊率",
          "Weapon Power Change Rate": "武裝威力變化率",
          "Weapon power rises with remaining HP": "跟住剩餘 HP 提升武裝威力",
          "Attack Change Value": "攻擊力變化值",
          "Attack Target Defense Reduction Rate": "攻擊目標防禦力減少率",
          "Attack Target Mobility Reduction Rate": "攻擊目標機動力減少率",
          "Weapon power rises when HP is low": "低 HP 時提升武裝威力",
          "Regeneration": "再生",
          "Weapon Debuff Value Addition": "武裝弱化值加算",
          "Weapon Debuff Duration Addition": "武裝弱化時間加算",
          "Weapon power rises when MP is low": "低 MP 時提升武裝威力",
          "Weapon power rises with MP": "跟住 MP 提升武裝威力"
        },
        "result": {}
      },
      "ability_table_defense": {
        "title": "單位能力效果 — 耐久型",
        "summary": "無尺寸帶時嘅基礎分；有就套用尺寸表。",
        "when": {
          "Damage taken": "受到損傷",
          "Defensive Damage Reduction Rate": "防禦時損傷減輕率",
          "Absolute Evasion": "絕對閃避",
          "Anti Damage Shield": "對損傷護盾",
          "Damage Negation": "損傷無效",
          "Unbreakable": "不屈",
          "Damage Taken Upper Limit Value": "受到損傷上限值",
          "Damage Barrier Max Hp Rate": "損傷屏障（最大 HP 比例）",
          "Damage Cut": "損傷削減",
          "Evasion Rate Change Rate": "閃避率變化率",
          "Defense Change Rate": "防禦力變化率",
          "Damage Taken Correction Value": "受到損傷補正值",
          "Support Defense": "支援防禦",
          "Regeneration": "再生",
          "Support Defense Adaptive": "支援防禦（適應）",
          "Support Defense Extend To Counter": "支援防禦延長至反擊",
          "Defense Change Value": "防禦力變化值",
          "Support Attack And Counter": "支援攻擊與反擊",
          "Support Attack And Counter Adaptive": "支援攻擊與反擊（適應）"
        },
        "result": {}
      },
      "ability_table_support": {
        "title": "單位能力效果 — 支援型",
        "summary": "無尺寸帶時嘅基礎分；有就套用尺寸表。",
        "when": {
          "Attack Target Defense Reduction Rate": "攻擊目標防禦力減少率",
          "Support Attack And Counter Adaptive": "支援攻擊與反擊（適應）",
          "Support Defense Adaptive": "支援防禦（適應）",
          "Weapon Debuff Value Addition": "武裝弱化值加算",
          "Attack Change Rate": "攻擊力變化率",
          "Damage dealt": "造成損傷",
          "Chance Step Max Count Change": "額外行動最大次數變化",
          "Sp Change Value": "SP 變化值",
          "Mp Change Rate": "MP 變化率",
          "Mp Change Value": "MP 變化值",
          "Support Attack And Counter": "支援攻擊與反擊",
          "Support Defense": "支援防禦",
          "Movement Change Value": "移動力變化值",
          "Attack Target Mobility Reduction Rate": "攻擊目標機動力減少率",
          "Guaranteed Chance Step": "確定額外行動",
          "Regeneration": "再生",
          "Weapon Debuff Duration Addition": "武裝弱化時間加算",
          "Support Defense Extend To Counter": "支援防禦延長至反擊",
          "Post Attack Move": "攻擊後移動",
          "Hp Change Rate": "HP 變化率"
        },
        "result": {}
      },
      "footprint": {
        "title": "2×2 佔位（單位）",
        "summary": "OccupiedArea 2×2 嘅單位有輕微上振 — 較闊嘅 MAP／增益覆蓋通常贏過配置不便。",
        "when": {
          "Attack 2×2": "攻擊型 2×2",
          "Support 2×2": "支援型 2×2",
          "Defense 2×2": "耐久型 2×2",
          "Not 2×2": "唔係 2×2"
        },
        "result": {}
      },
      "rarity": {
        "title": "稀有度調整（單位）",
        "summary": "唔計分 — 由套件同戰鬥加分項目決定順位。低稀有度通常較少強技能／能力。",
        "when": {
          "N": "N",
          "R": "R",
          "SR": "SR",
          "SSR / UR": "SSR／UR",
          "All rarities": "全部稀有度"
        },
        "result": {}
      },
      "pilot_rarity": {
        "title": "稀有度調整（角色）",
        "summary": "唔計分 — 由角色技能／能力實用性同推薦單位決定順位。",
        "when": {
          "N": "N",
          "R": "R",
          "SR": "SR",
          "SSR / UR": "SSR／UR",
          "All rarities": "全部稀有度"
        },
        "result": {}
      },
      "pilot_stats_attack": {
        "title": "角色 SP 養成數值 — 攻擊型",
        "summary": "呢個角色類型嘅 SP 清單養成數值。攻擊型最睇重適性數值（射擊／格鬥／覺醒）；耐久型角色更睇重守備／反應。",
        "when": {
          "Ranged < 700": "射擊值 < 700",
          "Ranged 700–734": "射擊值 700–734",
          "Ranged 735–769": "射擊值 735–769",
          "Ranged 770–794": "射擊值 770–794",
          "Ranged ≥ 795": "射擊值 ≥ 795",
          "Melee < 700": "格鬥值 < 700",
          "Melee 700–734": "格鬥值 700–734",
          "Melee 735–769": "格鬥值 735–769",
          "Melee 770–794": "格鬥值 770–794",
          "Melee ≥ 795": "格鬥值 ≥ 795",
          "Awaken < 600": "覺醒值 < 600",
          "Awaken 600–649": "覺醒值 600–649",
          "Awaken 650–699": "覺醒值 650–699",
          "Awaken 700–749": "覺醒值 700–749",
          "Awaken ≥ 750": "覺醒值 ≥ 750",
          "Defense < 460": "守備值 < 460",
          "Defense 460–499": "守備值 460–499",
          "Defense 500–524": "守備值 500–524",
          "Defense 525–549": "守備值 525–549",
          "Defense ≥ 550": "守備值 ≥ 550",
          "Reaction < 550": "反應值 < 550",
          "Reaction 550–574": "反應值 550–574",
          "Reaction 575–599": "反應值 575–599",
          "Reaction 600–649": "反應值 600–649",
          "Reaction ≥ 650": "反應值 ≥ 650"
        },
        "result": {}
      },
      "pilot_stats_defense": {
        "title": "角色 SP 養成數值 — 耐久型",
        "summary": "呢個角色類型嘅 SP 清單養成數值。攻擊型最睇重適性數值（射擊／格鬥／覺醒）；耐久型角色更睇重守備／反應。",
        "when": {
          "Ranged < 500": "射擊值 < 500",
          "Ranged 500–539": "射擊值 500–539",
          "Ranged 540–569": "射擊值 540–569",
          "Ranged 570–599": "射擊值 570–599",
          "Ranged ≥ 600": "射擊值 ≥ 600",
          "Melee < 500": "格鬥值 < 500",
          "Melee 500–539": "格鬥值 500–539",
          "Melee 540–569": "格鬥值 540–569",
          "Melee 570–599": "格鬥值 570–599",
          "Melee ≥ 600": "格鬥值 ≥ 600",
          "Awaken < 500": "覺醒值 < 500",
          "Awaken 500–549": "覺醒值 500–549",
          "Awaken 550–599": "覺醒值 550–599",
          "Awaken 600–699": "覺醒值 600–699",
          "Awaken ≥ 700": "覺醒值 ≥ 700",
          "Defense < 700": "守備值 < 700",
          "Defense 700–724": "守備值 700–724",
          "Defense 725–749": "守備值 725–749",
          "Defense 750–774": "守備值 750–774",
          "Defense ≥ 775": "守備值 ≥ 775",
          "Reaction < 700": "反應值 < 700",
          "Reaction 700–739": "反應值 700–739",
          "Reaction 740–769": "反應值 740–769",
          "Reaction 770–799": "反應值 770–799",
          "Reaction ≥ 800": "反應值 ≥ 800"
        },
        "result": {}
      },
      "pilot_stats_support": {
        "title": "角色 SP 養成數值 — 支援型",
        "summary": "呢個角色類型嘅 SP 清單養成數值。攻擊型最睇重適性數值（射擊／格鬥／覺醒）；耐久型角色更睇重守備／反應。",
        "when": {
          "Ranged < 655": "射擊值 < 655",
          "Ranged 655–699": "射擊值 655–699",
          "Ranged 700–734": "射擊值 700–734",
          "Ranged 735–794": "射擊值 735–794",
          "Ranged ≥ 795": "射擊值 ≥ 795",
          "Melee < 655": "格鬥值 < 655",
          "Melee 655–699": "格鬥值 655–699",
          "Melee 700–734": "格鬥值 700–734",
          "Melee 735–794": "格鬥值 735–794",
          "Melee ≥ 795": "格鬥值 ≥ 795",
          "Awaken < 600": "覺醒值 < 600",
          "Awaken 600–649": "覺醒值 600–649",
          "Awaken 650–699": "覺醒值 650–699",
          "Awaken 700–749": "覺醒值 700–749",
          "Awaken ≥ 750": "覺醒值 ≥ 750",
          "Defense < 500": "守備值 < 500",
          "Defense 500–524": "守備值 500–524",
          "Defense 525–549": "守備值 525–549",
          "Defense 550–649": "守備值 550–649",
          "Defense ≥ 650": "守備值 ≥ 650",
          "Reaction < 550": "反應值 < 550",
          "Reaction 550–599": "反應值 550–599",
          "Reaction 600–649": "反應值 600–649",
          "Reaction 650–699": "反應值 650–699",
          "Reaction ≥ 700": "反應值 ≥ 700"
        },
        "result": {}
      },
      "pilots_extra": {
        "title": "角色專用項目",
        "summary": "角色淨用 SP 盤。帶狀表睇上方角色 SP 養成數值各區塊。",
        "when": {
          "SP grown stats (Ranged / Melee / Awaken / Defense / Reaction)": "SP 養成數值（射擊值／格鬥值／覺醒值／守備值／反應值）",
          "Series affinity abilities": "系列親和能力",
          "Best recommended MS letter (A and up)": "最佳推薦單位字母（A 以上）",
          "Unbreakable on pilot abilities": "角色能力上的不屈"
        },
        "result": {
          "Band points by role (see tables above)": "跟類型帶狀俾分（睇上表）",
          "+3 each": "各 +3",
          "From this guide’s unit letters (B+ no longer scores)": "取自本指南單位字母（B+ 或以下唔再計分）",
          "Extra-life role bonus": "額外生命類型加分"
        }
      }
    }
  };

  const BADGE = {
    "EN": {
      "objective": "Objective",
      "estimate": "Estimate"
    },
    "JA": {
      "objective": "客観",
      "estimate": "目安"
    },
    "TW": {
      "objective": "客觀",
      "estimate": "估計"
    },
    "HK": {
      "objective": "客觀",
      "estimate": "估計"
    }
  };


  const ROLE_FUZZY = {
    EN: { Attack: 'Attack', Defense: 'Defense', Support: 'Support' },
    JA: { Attack: '攻撃型', Defense: '耐久型', Support: '支援型' },
    TW: { Attack: '攻擊型', Defense: '耐久型', Support: '支援型' },
    HK: { Attack: '攻擊型', Defense: '耐久型', Support: '支援型' },
  };

  function normLang(lang) {
    const u = String(lang || 'EN').toUpperCase();
    if (u === 'JP' || u === 'JA') return 'JA';
    if (u === 'ZH-TW' || u === 'ZH_TW' || u === 'TW') return 'TW';
    if (u === 'ZH-HK' || u === 'ZH_HK' || u === 'HK') return 'HK';
    if (u === 'EN' || u === 'US') return 'EN';
    return 'EN';
  }

  function overrides(lang) {
    const L = normLang(lang);
    return (GUIDE[L] && GUIDE[L].overrides) || GUIDE.EN.overrides || [];
  }

  function gaps(lang) {
    const L = normLang(lang);
    return (GUIDE[L] && GUIDE[L].gaps) || GUIDE.EN.gaps || [];
  }

  function criteria(lang, id) {
    const L = normLang(lang);
    if (L === 'EN') return null;
    const pack = CRITERIA[L];
    if (!pack || !id) return null;
    let c = pack[id];
    if (!c && (id === 'buckets_units' || id === 'buckets_pilots') && pack.buckets) {
      c = pack.buckets;
    }
    if (!c) return null;
    return {
      title: c.title,
      summary: c.summary,
      whenMap: c.when || {},
      resultMap: c.result || {},
    };
  }

  function badgeObjective(lang) {
    const L = normLang(lang);
    return (BADGE[L] && BADGE[L].objective) || BADGE.EN.objective;
  }

  function badgeEstimate(lang) {
    const L = normLang(lang);
    return (BADGE[L] && BADGE[L].estimate) || BADGE.EN.estimate;
  }

  function fuzzyRoleWhen(lang, when) {
    let s = String(when || '');
    const roles = ROLE_FUZZY[normLang(lang)] || ROLE_FUZZY.EN;
    s = s.replace(/\bAttack\b/g, roles.Attack);
    s = s.replace(/\bDefense\b/g, roles.Defense);
    s = s.replace(/\bSupport\b/g, roles.Support);
    return s;
  }

  function isPointishResult(result) {
    const r = String(result || '').trim();
    if (!r) return true;
    // Pure point tokens / slash lists only — keep "+1", "−3", "0", "0 / 0 / +1".
    // Explanatory or leveled prose (e.g. "0 (covered…)", "none -2 · Lv3 …") must still localize via resultMap.
    if (/^[+\-−]?\d+(\s*[·./／]\s*[+\-−]?\d+)*$/.test(r)) return true;
    if (/\bpts?\b/i.test(r) && !/[A-Za-z]{3,}/.test(r.replace(/\bpts?\b/gi, ''))) return true;
    return false;
  }

  function localizeRow(lang, criteriaId, when, result) {
    const L = normLang(lang);
    const outWhen = String(when || '');
    const outResult = String(result || '');
    if (L === 'EN') return { when: outWhen, result: outResult };
    const c = criteria(L, criteriaId);
    let whenLoc = outWhen;
    if (c && c.whenMap && Object.prototype.hasOwnProperty.call(c.whenMap, outWhen)) {
      whenLoc = c.whenMap[outWhen];
    } else {
      whenLoc = fuzzyRoleWhen(L, outWhen);
    }
    let resultLoc = outResult;
    if (!isPointishResult(outResult) && c && c.resultMap && Object.prototype.hasOwnProperty.call(c.resultMap, outResult)) {
      resultLoc = c.resultMap[outResult];
    }
    return { when: whenLoc, result: resultLoc };
  }

  global.SpiI18nGuide = {
    normLang,
    overrides,
    gaps,
    criteria,
    badgeObjective,
    badgeEstimate,
    localizeRow,
  };
})(typeof window !== 'undefined' ? window : globalThis);
