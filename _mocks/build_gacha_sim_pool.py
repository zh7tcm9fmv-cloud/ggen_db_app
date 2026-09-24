"""Build gacha_sim_pool.json from real master + official drop rates.

Usage:
  python _mocks/build_gacha_sim_pool.py
  python _mocks/build_gacha_sim_pool.py --gasha 2609300302
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from gasha_official_rates import drop_rates_for_gasha, load_official_proportion, parse_gasha_proportion  # noqa: E402

MASTER = ROOT / "data" / "EN" / "master"
LANG = ROOT / "data" / "EN" / "lang"
OUT = Path(__file__).resolve().parent / "gacha_sim_pool.json"
PUBLISHED = ROOT / "data" / "published" / "gacha_sim_pool.json"
STATIC_POOL = ROOT / "static" / "gacha_sim" / "pool.json"

# Master RoleTypeIndex — same as app.py ROLE_MAP (Defense shown as Durability in sim UI)
ROLE = {"1": "Attack", "2": "Durability", "3": "Support"}
RARITY = {"1": "n", "2": "r", "3": "sr", "4": "ssr", "5": "ur"}

# m_unit.BromideHeightIndex → CSS object-position Y for gacha card crop.
# Low index = subject high in bromide → bias toward top (lower %).
# High index = subject lower / more headroom → bias toward bottom (higher %).
# H2 is the bulk of the catalog; keep face-first (34% clipped heads on short cards).
POR_Y_BY_HEIGHT = {
    "0": "8%",
    "1": "12%",
    "2": "14%",
    "3": "24%",
    "4": "34%",
    "5": "44%",
}


def _por_y_of(row: dict) -> str:
    return POR_Y_BY_HEIGHT.get(str(row.get("BromideHeightIndex") or "0"), "14%")


def _limited_unit_ids() -> set[str]:
    """Parse app.py LIMITED_TIME_UNIT_IDS (same source as live /u limited badge)."""
    import re

    text = (ROOT / "app.py").read_text(encoding="utf-8")
    m = re.search(r"LIMITED_TIME_UNIT_IDS\s*=\s*frozenset\(\{([^}]*)\}", text, re.S)
    if not m:
        return set()
    return set(re.findall(r"'(\d+)'", m.group(1)))


def _limited_supporter_ids() -> set[str]:
    """Limited pickup supporters — prefer live API is_limited_time; fallback snapshot."""
    import urllib.request

    fallback = {
        "1110000150",
        "1125000250",
        "1162000150",
        "1300000450",
        "1330000250",
        "1370000550",
    }
    try:
        with urllib.request.urlopen(
            "https://ggendb.up.railway.app/api/supporters?lang=EN&per_page=500",
            timeout=12,
        ) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        rows = data.get("rows") or []
        got = {str(x.get("id")) for x in rows if x.get("is_limited_time")}
        return got or fallback
    except Exception:
        return fallback


def _rarity_of(row: dict) -> str:
    ri = row.get("RarityTypeIndex")
    if ri is None:
        ri = row.get("RarityIndex")
    return RARITY.get(str(ri), "")


def _resource_of(row: dict) -> str:
    for k in ("BromideResourceId", "ResourceId", "ListResourceId"):
        v = str(row.get(k) or "").strip()
        if v and v != "0":
            return v
    return ""


def _load(name: str, folder: Path):
    p = folder / name
    return json.loads(p.read_text(encoding="utf-8"))


def _is_transform_alt(row: dict) -> bool:
    """Escape / MS↔MA form: MainUnitId points at the pullable main kit (Id != MainUnitId)."""
    uid = str(row.get("Id") or "")
    mid = str(row.get("MainUnitId") or uid or "0")
    if not uid or mid in ("", "0"):
        return False
    return mid != uid


def _is_unit_assembly(row: dict) -> bool:
    """UnitAcquisitionRouteTypeIndex 1 = Units from Unit Assembly (gacha-pullable)."""
    return str(row.get("UnitAcquisitionRouteTypeIndex") or "0") == "1"


def _is_supporter_assembly(row: dict) -> bool:
    """SupporterAcquisitionRouteTypeIndex 1 = assembly / gacha-pullable."""
    return str(row.get("SupporterAcquisitionRouteTypeIndex") or "0") == "1"


def _unit_name_to_id(units: list[dict], lang: dict[str, str]) -> dict[str, str]:
    """Map display name → unit id.

    Official gasha tables use short names that collide (e.g. several \"Gundam F90\",
    or event/development SSR vs Unit Assembly SR of the same name).
    Prefer Unit Assembly (route 1), then MainUnitId==Id (never escape/transform alts),
    then highest rarity.
    """
    by_name: dict[str, list[dict]] = {}
    for row in units:
        lid = str(row.get("NameLanguageId") or "")
        name = lang.get(lid) if lid else ""
        if not name:
            continue
        by_name.setdefault(name, []).append(row)

    out: dict[str, str] = {}
    for name, rows in by_name.items():
        assembly = [u for u in rows if _is_unit_assembly(u) and not _is_transform_alt(u)]
        if not assembly:
            assembly = [u for u in rows if _is_unit_assembly(u)]
        mains = [u for u in rows if not _is_transform_alt(u)]
        candidates = assembly or mains or rows
        best = max(
            candidates,
            key=lambda u: (
                1 if _is_unit_assembly(u) else 0,
                int(u.get("RarityTypeIndex") or 0),
                -int(u.get("Id") or 0),
            ),
        )
        out[name] = str(best["Id"])
    return out


def _lang_map(
    master_name: str,
    lang_name: str,
    id_key: str,
    lang_id_key: str,
    *,
    master_folder: Path | None = None,
    lang_folder: Path | None = None,
) -> dict[str, str]:
    master = _load(master_name, master_folder or MASTER)
    lang = {str(r["id"]): r["value"] for r in _load(lang_name, lang_folder or LANG)}
    out = {}
    for row in master:
        rid = str(row.get(id_key) or row.get("Id") or "")
        lid = str(row.get(lang_id_key) or "")
        if rid and lid and lid in lang:
            out[lang[lid]] = rid
    return out


def _bromide_to_art(resource_id: str, kind: str) -> str:
    rid = (resource_id or "").strip()
    if not rid:
        return ""
    if kind == "unit":
        # Full unit portrait (ub_*) — positioning is handled in CSS (contain), not thum
        return f"unit_portraits/ub_{rid}.webp"
    if kind == "supporter":
        return f"Supporters/sb_{rid}.webp"
    if kind == "character":
        return f"portraits/cb_{rid}.webp"
    return ""


def _char_art_from_recommend(cid: str, char_res: dict[str, str]) -> str:
    rid = char_res.get(cid) or ""
    if rid:
        return f"portraits/cb_{rid}.webp"
    # fallback id → cb path
    s = str(cid)
    if len(s) >= 10:
        # 1080000101 → g0800c00101
        series = s[1:5]
        rest = s[5:]
        return f"portraits/cb_g{series}c{rest}.webp"
    return ""


def build(gasha_id: str, lang: str = "EN") -> dict:
    lang = (lang or "EN").upper()
    if lang == "JP":
        lang = "JA"
    if lang not in ("EN", "JA", "TW", "HK"):
        lang = "EN"
    lang_dir = ROOT / "data" / lang / "lang"
    # Official proportion tables are EN names — match ids with EN, display with locale LANG.
    en_lang_dir = ROOT / "data" / "EN" / "lang"

    units = _load("m_unit.json", MASTER)
    chars = _load("m_character.json", MASTER)
    supps = _load("m_supporter.json", MASTER)

    unit_by_id = {str(u["Id"]): u for u in units}
    char_by_id = {str(c["Id"]): c for c in chars}
    supp_by_id = {str(s["Id"]): s for s in supps}

    unit_lang_en = {str(r["id"]): r["value"] for r in _load("m_unit.json", en_lang_dir)}
    unit_lang = {str(r["id"]): r["value"] for r in _load("m_unit.json", lang_dir)}
    unit_name_to_id = _unit_name_to_id(units, unit_lang_en)
    # Supporter matching against official EN names — prefer assembly route
    supp_lang_en = {str(r["id"]): r["value"] for r in _load("m_supporter.json", en_lang_dir)}
    supp_by_name: dict[str, list[dict]] = {}
    for s in supps:
        lid = str(s.get("NameLanguageId") or "")
        nm = supp_lang_en.get(lid) if lid else ""
        if nm:
            supp_by_name.setdefault(nm, []).append(s)
    supp_name_to_id: dict[str, str] = {}
    for nm, rows in supp_by_name.items():
        assembly = [x for x in rows if _is_supporter_assembly(x)]
        candidates = assembly or rows
        best = max(
            candidates,
            key=lambda x: (
                1 if _is_supporter_assembly(x) else 0,
                int(x.get("RarityTypeIndex") or 0),
                -int(x.get("Id") or 0),
            ),
        )
        supp_name_to_id[nm] = str(best["Id"])
    supp_lang = {str(r["id"]): r["value"] for r in _load("m_supporter.json", lang_dir)}
    limited_units = _limited_unit_ids()
    limited_supps = _limited_supporter_ids()

    char_res = {
        str(c["Id"]): str(c.get("BromideResourceId") or c.get("ResourceId") or "").strip()
        for c in chars
    }
    # characters often use ResourceId-like fields — prefer Bromide if present
    for c in chars:
        cid = str(c["Id"])
        for k in ("BromideResourceId", "ResourceId", "ListResourceId"):
            v = str(c.get(k) or "").strip()
            if v and v != "0":
                char_res[cid] = v
                break

    rates = drop_rates_for_gasha(gasha_id, "EN") or {}
    raw = load_official_proportion(gasha_id, 2) or load_official_proportion(gasha_id, 1)
    parsed = parse_gasha_proportion(raw) if raw else {"category": {}, "by_name": {}}

    category = (rates.get("category") if rates else None) or parsed.get("category") or {}
    by_name = parsed.get("by_name") or {}

    pool = {"URU": [], "URS": [], "SSRU": [], "SSRS": [], "SR": [], "R": []}
    pickup_ids = set()

    # Featured pickups from m_gasha_pickup
    pickup_rows = _load("m_gasha_pickup.json", MASTER)
    content = {str(c["Id"]): c for c in _load("m_gasha_content_detail.json", MASTER)}
    for pu in pickup_rows:
        if str(pu.get("GashaId")) != str(gasha_id):
            continue
        dcid = str(pu.get("GashaContentDetailId") or "")
        cd = content.get(dcid) or {}
        tid = str(cd.get("RewardTargetId") or "")
        if tid and tid != "0":
            pickup_ids.add(tid)

    def add_unit(uid: str, w: float, bucket: str):
        u = unit_by_id.get(uid)
        if not u:
            return
        # Gacha-sim results are Unit Assembly only — never development / other / event routes
        if not _is_unit_assembly(u):
            return
        # Escape / transform forms are not independently pullable
        if _is_transform_alt(u):
            return
        brom = _resource_of(u)
        rec = str(u.get("RecommendCharacterId") or "0")
        role = ROLE.get(str(u.get("RoleTypeIndex")), "Attack")
        name = next((n for n, i in unit_name_to_id.items() if i == uid), uid)
        # Prefer lang name for this id even when another kit shares the short name
        lid = str(u.get("NameLanguageId") or "")
        if lid and lid in unit_lang:
            name = unit_lang[lid]
        elif lid and lid in unit_lang_en:
            name = unit_lang_en[lid]
        item = {
            "id": uid,
            "name": name,
            "role": role,
            "art": _bromide_to_art(brom, "unit"),
            "charArt": _char_art_from_recommend(rec, char_res) if rec and rec != "0" else "",
            "recommend_character_id": rec if rec != "0" else "",
            "por_y": _por_y_of(u),
            "bromide_height": str(u.get("BromideHeightIndex") or "0"),
            "limited": uid in limited_units,
            "pickup": uid in pickup_ids,
            "w": max(w, 0.0001),
        }
        pool[bucket].append(item)

    def add_supp(sid: str, w: float, bucket: str):
        s = supp_by_id.get(sid)
        if not s:
            return
        if not _is_supporter_assembly(s):
            return
        brom = _resource_of(s)
        name = next((n for n, i in supp_name_to_id.items() if i == sid), sid)
        lid = str(s.get("NameLanguageId") or "")
        if lid and lid in supp_lang:
            name = supp_lang[lid]
        pool[bucket].append(
            {
                "id": sid,
                "name": name,
                "role": "",
                "art": _bromide_to_art(brom, "supporter"),
                "charArt": "",
                "limited": sid in limited_supps,
                "pickup": sid in pickup_ids,
                "w": max(w, 0.0001),
            }
        )

    # Map official by_name into rarity buckets via master rarity
    for name, slot in by_name.items():
        kind = slot.get("kind") or "unit"
        w = float(slot.get("single_or_1to9") or slot.get("multi_10th") or 0.01)
        if kind == "supporter":
            sid = supp_name_to_id.get(name)
            if not sid:
                continue
            s = supp_by_id.get(sid) or {}
            rar = _rarity_of(s)
            bucket = "URS" if rar == "ur" else "SSRS" if rar == "ssr" else ""
            if bucket:
                add_supp(sid, w, bucket)
        else:
            uid = unit_name_to_id.get(name)
            if not uid:
                continue
            u = unit_by_id.get(uid) or {}
            rar = _rarity_of(u)
            bucket = {"ur": "URU", "ssr": "SSRU", "sr": "SR", "r": "R"}.get(rar, "")
            if bucket:
                add_unit(uid, w, bucket)

    # Category table for roll weights (same shape as mock NORMAL/TENTH)
    def cat_row(section: str, rarity: str, which: str):
        block = (category.get(section) or {}).get(rarity) or {}
        key = "unit_pct" if which == "unit" else "supporter_pct"
        v = block.get(key)
        return float(v) if v is not None else 0.0

    normal = [
        ["URU", cat_row("single_or_1to9", "UR", "unit")],
        ["URS", cat_row("single_or_1to9", "UR", "supporter")],
        ["SSRU", cat_row("single_or_1to9", "SSR", "unit")],
        ["SSRS", cat_row("single_or_1to9", "SSR", "supporter")],
        ["SR", cat_row("single_or_1to9", "SR", "unit")],
        ["R", cat_row("single_or_1to9", "R", "unit")],
    ]
    tenth = [
        ["URU", cat_row("multi_10th", "UR", "unit")],
        ["URS", cat_row("multi_10th", "UR", "supporter")],
        ["SSRU", cat_row("multi_10th", "SSR", "unit")],
        ["SSRS", cat_row("multi_10th", "SSR", "supporter")],
    ]

    # Banner meta
    gasha_rows = _load("m_gasha.json", MASTER)
    g = next((x for x in gasha_rows if str(x.get("Id")) == str(gasha_id)), {})
    logo = str(g.get("LogoResourceId") or "").strip()
    if not logo:
        # Timeline / CDN convention when master LogoResourceId is blank
        logo = f"gasha_logo_{gasha_id}"
    appeal_id = str(g.get("AppealBannerId") or "").strip()
    movie_setting_id = str(g.get("GashaMovieSettingId") or "").strip()
    if movie_setting_id in ("", "0"):
        movie_setting_id = ""
    movie_setting = None
    if movie_setting_id:
        for ms in _load("m_gasha_movie_setting.json", MASTER):
            if str(ms.get("Id") or "") != movie_setting_id:
                continue
            movie_setting = {
                "id": movie_setting_id,
                "bgm_resource_id": str(ms.get("GashaBgmResourceId") or "").strip(),
                "bgm_delay_ms": int(ms.get("GashaBgmDelayMilliseconds") or 0),
                "sortie_movie_id": str(ms.get("SortieMovieResourceId") or "").strip(),
                "fall_movie_id": str(ms.get("FallContainerMovieResourceId") or "").strip(),
                "bonus_cutin_movie_id": str(ms.get("BonusCutInMovieResourceId") or "").strip(),
                "bonus_special_movie_id": str(ms.get("BonusSpecialMovieResourceId") or "").strip(),
                "should_use_special_assault_button": bool(ms.get("ShouldUseSpecialAssaultButton")),
                "bonus_destroy_anim_index": int(ms.get("BonusGashaContainerDestroyAnimationTypeIndex") or 0),
            }
            break

    # Primary ticket entry (slot 1): 47-ticket anniversary pools use OnceRollCount 47
    # (FakeOnceRollCount when set = UI card count, e.g. 1st Anniv 48/47).
    entry_rows = _load("m_gasha_entry.json", MASTER)
    detail_rows = {str(d.get("Id")): d for d in _load("m_gasha_entry_detail.json", MASTER)}
    primary_detail = None
    for er in entry_rows:
        if str(er.get("GashaId")) != str(gasha_id):
            continue
        if int(er.get("SlotNumber") or 0) != 1:
            continue
        primary_detail = detail_rows.get(str(er.get("GashaEntryDetailId") or ""))
        break
    once_roll = int((primary_detail or {}).get("OnceRollCount") or 0)
    fake_once = int((primary_detail or {}).get("FakeOnceRollCount") or 0)
    required_tickets = int((primary_detail or {}).get("RequiredCurrencyCount") or 0)
    display_pull_n = fake_once if fake_once > 0 else once_roll
    # Official 47-pull tables: pulls 1..(n-2) = single_or_1to9; last 2 = multi_10th (UR).
    guarantee_tail = 2 if display_pull_n >= 47 else (1 if display_pull_n == 10 else 0)
    bulk_mode = display_pull_n >= 20 and required_tickets >= display_pull_n

    return {
        "gasha_id": str(gasha_id),
        "lang": lang,
        "logo_resource_id": logo,
        "appeal_banner_id": appeal_id,
        "gasha_movie_setting_id": movie_setting_id,
        "gasha_movie_setting": movie_setting,
        "once_roll_count": once_roll,
        "fake_once_roll_count": fake_once,
        "display_pull_n": display_pull_n,
        "required_tickets": required_tickets,
        "guarantee_tail": guarantee_tail,
        "bulk_mode": bulk_mode,
        "normal": normal,
        "tenth": tenth,
        "pool": pool,
        "pickup_ids": sorted(pickup_ids),
        "counts": {k: len(v) for k, v in pool.items()},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gasha", default="2609300302", help="GashaId")
    ap.add_argument("--lang", default="EN", help="Locale EN|JA|TW|HK")
    ap.add_argument(
        "--as-default",
        action="store_true",
        help="Also overwrite published/static default gacha_sim_pool.json",
    )
    args = ap.parse_args()
    data = build(args.gasha, lang=args.lang)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT)
    if args.as_default or str(args.gasha) == "2609300302":
        try:
            PUBLISHED.parent.mkdir(parents=True, exist_ok=True)
            PUBLISHED.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print("wrote", PUBLISHED)
        except Exception as e:
            print("published copy skipped:", e)
        try:
            STATIC_POOL.parent.mkdir(parents=True, exist_ok=True)
            STATIC_POOL.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print("wrote", STATIC_POOL)
        except Exception as e:
            print("static pool copy skipped:", e)
    try:
        shard_dir = ROOT / "data" / "published" / "gacha_sim"
        shard_dir.mkdir(parents=True, exist_ok=True)
        shard = shard_dir / f"pool_{args.gasha}_{str(args.lang).upper()}.json"
        shard_legacy = shard_dir / f"pool_{args.gasha}.json"
        shard.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print("wrote", shard)
        if str(args.lang).upper() in ("EN", ""):
            shard_legacy.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print("wrote", shard_legacy)
    except Exception as e:
        print("gacha_sim shard skipped:", e)
    print("counts", data["counts"])
    print("normal", data["normal"])
    print("tenth", data["tenth"])
    print(
        "pull",
        data.get("display_pull_n"),
        "tickets",
        data.get("required_tickets"),
        "movie",
        data.get("gasha_movie_setting_id"),
        "bulk",
        data.get("bulk_mode"),
    )

if __name__ == "__main__":
    main()
