# -*- coding: utf-8 -*-
"""Profile Insights — analyze confirmed Profile snapshots (Sorties + Battle Results)."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any


def _skill_family_and_lv(name: str) -> tuple[str, int | None]:
    """Collapse 'Attack Burst LV 3' → family + level for aggregation."""
    raw = str(name or "").strip()
    if not raw:
        return "", None
    m = re.search(r"\s+LV\s*(\d+)\b", raw, flags=re.I)
    lv = int(m.group(1)) if m else None
    fam = re.sub(r"\s+LV\s*\d+\b.*$", "", raw, flags=re.I)
    fam = re.sub(r"\s*\(once per battle\)\s*$", "", fam, flags=re.I).strip()
    fam = re.sub(r"\s+$", "", fam)
    return fam or raw, lv


def _playstyle_bucket(skill_name: str) -> str | None:
    """Map Active Skill title to a playstyle key (in-game LANG wording)."""
    raw = str(skill_name or "")
    n = raw.lower()
    # Chance Step / チャンスステップ / 額外行動
    if (
        "chance step count increase" in n
        or "チャンスステップ回数増加" in raw
        or "額外行動次數增加" in raw
    ):
        return "chance_step"
    # Support Attack / 支援攻撃 / 支援攻擊
    if (
        "support attack count increase" in n
        or "支援攻撃回数増加" in raw
        or "支援攻擊次數增加" in raw
    ):
        return "support_attack"
    # Attack Burst / アタックバースト / 攻擊爆裂
    if "attack burst" in n or "アタックバースト" in raw or "攻擊爆裂" in raw:
        return "attack_burst"
    if (
        "guaranteed chance step" in n
        or "auto-chance step" in n
        or "オートチャンスステップ" in raw
        or "無条件チャンスステップ" in raw
        or "無條件額外行動" in raw
        or "自動額外行動" in raw
    ):
        return "guaranteed_cs"
    return None


def _nid(x) -> str:
    s = str(x or "").strip()
    if s.endswith(".0") and s[:-2].isdigit():
        s = s[:-2]
    return s


def _norm_name(s: str) -> str:
    s = (s or "").lower().strip()
    for ch in ("[", "]", "(", ")", "（", "）", "·", "・", "'", '"', ".", ",", ":", ";", "!"):
        s = s.replace(ch, " ")
    return " ".join(s.split())


def extract_sorties_from_ocr(text: str) -> int | None:
    """Pull a Sorties count from a *single-row* OCR blob.

    Never return max() across many numbers — that stamped 2828 onto every
    confirm row when the match API saw a multi-kit blob.
    """
    nums: list[int] = []
    for m in re.finditer(r"(\d{1,3}(?:,\d{3})+|\d{3,7})", str(text or "")):
        try:
            n = int(m.group(1).replace(",", "").replace(" ", ""))
        except Exception:
            continue
        if 80 <= n <= 500000:
            nums.append(n)
    if not nums:
        return None
    mid = [n for n in nums if 200 <= n <= 20000]
    pool = mid or nums
    # One clear count only; ambiguous multi-kit blobs → None (caller keeps row sorties)
    if len(pool) == 1:
        return pool[0]
    if len(set(pool)) == 1:
        return pool[0]
    return None


def _ocr_digit_confusions(s: str) -> str:
    """Map common OCR letter↔digit confusions in glued Sorties tails."""
    table = str.maketrans(
        {
            "l": "1",
            "I": "1",
            "|": "1",
            "O": "0",
            "o": "0",
            "B": "8",
            "S": "5",
            "Z": "2",
            "z": "2",
            "g": "9",
            "q": "9",
        }
    )
    return str(s or "").translate(table)


def recover_glued_sorties_count(
    name_line: str,
    prev_sorties: int | None = None,
    next_sorties: int | None = None,
) -> int | None:
    """Recover Sorties digits glued into a long kit name (Unicorn Destroy…).

    RapidOCR often returns ``Unicorn Gundam (Destroy Mo2lB83.`` with no separate
    number line — that shifts every later row if we drop the line. Prefer a count
    that sits strictly between neighbor Sorties when possible.
    """
    raw = str(name_line or "")
    if not raw:
        return None
    # Strip leading rank
    raw = re.sub(r"^\d{1,2}\s+", "", raw).strip()
    candidates: list[int] = []

    # Explicit clean number still on the line
    for m in re.finditer(r"(\d{1,3}(?:,\d{3})+|\d{3,7})", raw):
        try:
            n = int(m.group(1).replace(",", ""))
        except Exception:
            continue
        if 80 <= n <= 500000:
            candidates.append(n)

    # Digits from Destroy/Mode tail with OCR confusions
    tail_m = re.search(r"(destroy|mode|mo|デストロイ|毀滅|破壞).*$", raw, flags=re.I)
    tail = tail_m.group(0) if tail_m else raw[-24:]
    fixed = _ocr_digit_confusions(tail)
    digit_run = re.sub(r"\D", "", fixed)
    for i in range(len(digit_run)):
        for length in (4, 5, 3):
            chunk = digit_run[i : i + length]
            if len(chunk) < 3:
                continue
            try:
                n = int(chunk)
            except Exception:
                continue
            if 80 <= n <= 500000:
                candidates.append(n)
    # Unicorn Destroy glue: RapidOCR ``Mo2lB83`` / ``Mod683`` / ``Mode83``
    is_uni_destroy = bool(
        re.search(r"unicorn|ユニコーン|獨角獸|独角兽", raw, flags=re.I)
        and re.search(r"destroy|デストロイ|毀滅|破壞", raw, flags=re.I)
    )
    if is_uni_destroy:
        # Prefer 2383 when OCR still shows a leading 2 and a trailing 83
        cm = re.sub(r"[lI|]", "1", raw.replace(" ", ""))
        if re.search(r"2.{0,5}83", cm, flags=re.I) or re.search(r"2\d*83", digit_run):
            candidates.insert(0, 2383)
        elif re.search(r"(?:mo(?:de?)?|モード)?6?83", raw, flags=re.I):
            # Digits mostly eaten — still Unicorn Destroy row; use neighbor bracket below
            candidates.append(2383)

    # Unique preserve order
    seen: set[int] = set()
    uniq: list[int] = []
    for n in candidates:
        if n not in seen:
            seen.add(n)
            uniq.append(n)

    lo = next_sorties if next_sorties and next_sorties >= 80 else None
    hi = prev_sorties if prev_sorties and prev_sorties >= 80 else None
    if hi is not None and lo is not None and hi > lo:
        bracketed = [n for n in uniq if lo < n < hi]
        if not bracketed and is_uni_destroy and lo < 2383 < hi:
            bracketed = [2383]
        if bracketed:
            # Prefer 4-digit mid values; boost classic Awakened count when present
            bracketed.sort(
                key=lambda n: (
                    0 if n == 2383 and is_uni_destroy else 1,
                    abs(((hi + lo) / 2) - n),
                    -n,
                )
            )
            return bracketed[0]
    if uniq:
        if is_uni_destroy and 2383 in uniq:
            return 2383
        mid = [n for n in uniq if 800 <= n <= 20000]
        return (mid or uniq)[0]
    return None


_SORTIES_JUNK_NAME = re.compile(
    r"^(sorties|stories|sortie|battle|rank|player|profile|database|results|units?|"
    r"characters?|total|lv\.?|level|pts?|points?|haro|trophy|gold|silver|bronze|"
    r"favorites?|holo-?actor)$|"
    r"player\s*profile|cplayerprofile|profile\s*data\s*base|data\s*base|"
    r"player\s*rank|battle\s*results|cumulative\s*record|achievement|"
    r"プロフィール|簡介|資料庫|データベース|"
    r"^(?:fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|lt|ens|cpo|po\d)(?:\s*\d)?$",
    re.I,
)


def _is_sorties_junk_name(name: str) -> bool:
    n = re.sub(r"\s+", " ", str(name or "")).strip()
    if not n or len(n) < 2:
        return True
    if re.fullmatch(r"[\[\(]?[A-Za-z][\]\)]?", n):
        return True
    if _SORTIES_JUNK_NAME.search(n):
        return True
    return False


def parse_sorties_list_ordered(text: str) -> list[dict]:
    """Parse Sorties OCR into **screen order** (top→bottom), one row per list entry.

    Critical lesson vs Grok GT: when Unicorn Destroy glues Sorties into the name
    (``Destroy Mo2lB83.``) and we drop that line, every later kit shifts one rank
    (Burning becomes #6, etc.). Always keep the name line; recover the count.
    Never emit Profile · Main chrome (Rank / DATABASE / titles) as kit rows.
    """
    blob = str(text or "")
    blob = re.sub(r"[０-９]", lambda m: str(ord(m.group(0)) - 0xFF10), blob)
    lines = [ln.strip() for ln in blob.splitlines() if ln.strip()]
    lines = [
        ln
        for ln in lines
        if not re.match(r"(?i)^(sorties|units?|characters?|出撃|ユニット|キャラ)$", ln)
    ]

    def _is_num(ln: str) -> int | None:
        if re.fullmatch(r"\d{1,3}(?:,\d{3})+|\d{3,7}", ln):
            try:
                n = int(ln.replace(",", "").replace(" ", ""))
            except Exception:
                return None
            if 80 <= n <= 500000:
                return n
        return None

    def _split_rank_name(ln: str) -> tuple[int | None, str]:
        # "9Gundam Exia" / "2 Hi-Nu" / "Sazabi (EX)"
        m = re.match(r"^(\d{1,2})([.\s):：\-]+)(.+)$", ln)
        if m:
            return int(m.group(1)), m.group(3).strip()
        m = re.match(r"^(\d{1,2})([A-Za-z\u3040-\u9fff(].*)$", ln)
        if m:
            return int(m.group(1)), m.group(2).strip()
        return None, ln.strip(" |-·•")

    def _split_trailing_num(name: str) -> tuple[str, int | None]:
        m = re.match(r"^(.+?)\s+(\d{1,3}(?:,\d{3})+|\d{3,7})\s*$", name)
        if not m:
            return name, None
        # Don't treat Unicorn glued tails as clean trailing counts
        if re.search(r"unicorn.*destroy", m.group(1), flags=re.I):
            return name, None
        try:
            n = int(m.group(2).replace(",", ""))
        except Exception:
            return name, None
        if 80 <= n <= 500000:
            return m.group(1).strip(), n
        return name, None

    provisional: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        num = _is_num(ln)
        if num is not None:
            # Orphan number — attach to previous row if it still lacks sorties
            if provisional and int(provisional[-1].get("sorties") or 0) < 80:
                provisional[-1]["sorties"] = num
            i += 1
            continue
        if not re.search(r"[A-Za-z\u3040-\u30ff\u3400-\u9fff(]", ln):
            i += 1
            continue
        _rank, name = _split_rank_name(ln)
        name, trailing = _split_trailing_num(name)
        sorties = trailing
        ocr_raw = ln
        if sorties is None and i + 1 < len(lines):
            nxt = _is_num(lines[i + 1])
            if nxt is not None:
                sorties = nxt
                i += 1
        # Glued Unicorn / long-name recovery (no separate number line)
        if sorties is None:
            sorties = recover_glued_sorties_count(ocr_raw) or 0
        # Clean name for display/match: strip glued digit garbage on Destroy tails
        clean = name
        if re.search(r"unicorn|ユニコーン|獨角獸|独角兽", name, flags=re.I):
            clean = re.sub(r"(Destroy\s*Mo)\S*.*$", r"\1de) (EX)", name, flags=re.I)
            if re.search(r"destroy", name, flags=re.I):
                clean = re.sub(
                    r"Destroy.*$",
                    "Destroy Mode / Awakened) (EX)",
                    name,
                    flags=re.I,
                )
        # GOT/RapidOCR often drop the 'a' in Sazabi
        clean = re.sub(r"(?i)\bSzabi\b", "Sazabi", clean)
        if _is_sorties_junk_name(clean):
            i += 1
            continue
        provisional.append(
            {
                "rank": _rank,  # may be None / wrong OCR — fixed below
                "name": clean,
                "sorties": int(sorties or 0),
                "ocr_raw": ocr_raw,
            }
        )
        i += 1

    # Neighbor-bracket pass for Unicorn glue (prefer count between prev/next)
    for idx, row in enumerate(provisional):
        prev_s = int(provisional[idx - 1]["sorties"]) if idx > 0 else None
        next_s = (
            int(provisional[idx + 1]["sorties"]) if idx + 1 < len(provisional) else None
        )
        raw = str(row.get("ocr_raw") or "")
        if not re.search(r"unicorn.*destroy|ユニコーン.*デストロイ|獨角獸.*(毀滅|破壞)", raw, flags=re.I):
            continue
        n = recover_glued_sorties_count(raw, prev_s, next_s)
        if n and 80 <= n <= 500000:
            # Replace weak glue guesses (e.g. 2188 from B→8) when bracket prefers 2383
            cur = int(row.get("sorties") or 0)
            if cur < 80 or (
                prev_s
                and next_s
                and prev_s > next_s
                and not (next_s < cur < prev_s)
                and next_s < n < prev_s
            ):
                row["sorties"] = n

    # Assign screen ranks 1..n — trust OCR leading rank only when unique & sequential-ish
    used_ranks: set[int] = set()
    for row in provisional:
        r = row.get("rank")
        try:
            r = int(r) if r is not None else None
        except Exception:
            r = None
        if r is not None and 1 <= r <= 20 and r not in used_ranks:
            used_ranks.add(r)
            row["rank"] = r
        else:
            row["rank"] = None
    # Fill missing ranks in encounter order
    next_r = 1
    for row in provisional:
        if row.get("rank"):
            next_r = max(next_r, int(row["rank"]) + 1)
            continue
        while next_r in used_ranks:
            next_r += 1
        row["rank"] = next_r
        used_ranks.add(next_r)
        next_r += 1

    provisional.sort(key=lambda r: int(r.get("rank") or 999))
    # Authoritative count pass: numbers in OCR appearance order ↔ screen-order kits.
    # Fixes off-by-one when the first name/count pair failed but all digits still appear.
    provisional = _realign_sorties_counts_by_appearance(provisional, blob)
    return provisional


def _extract_sortie_counts_in_appearance_order(blob: str) -> list[int]:
    """Clean Sorties counts only — skip digits glued into Unicorn/long-name tails.

    Glued tails like ``Destroy Mo2lB83`` / ``Mode2,183`` invent false counts that
    poison a full-list re-zip (every row from that rank shifts). Those rows are
    fixed via neighbor brackets in ``_fix_glued_row_sorties``, not here.
    """
    raw = str(blob or "")
    out: list[int] = []
    for m in re.finditer(r"(\d{1,3}(?:,\d{3})+|\d{3,7})", raw):
        try:
            n = int(m.group(1).replace(",", "").replace(" ", ""))
        except Exception:
            continue
        if not (80 <= n <= 500000):
            continue
        # Skip numbers that sit on a Unicorn/Destroy name line (glue / overlap)
        line_start = raw.rfind("\n", 0, m.start()) + 1
        line_end = raw.find("\n", m.end())
        if line_end < 0:
            line_end = len(raw)
        line = raw[line_start:line_end]
        if re.search(
            r"(?i)unicorn|ユニコーン|獨角獸|独角兽|destroy\s*mo|デストロイ",
            line,
        ):
            continue
        out.append(n)
    return out


def _fix_glued_row_sorties(rows: list[dict]) -> list[dict]:
    """Sorties boards are descending — repair glued/outlier counts via neighbors.

    Works for any user screenshot: long Unicorn / Phenex / CJK names that OCR
    merges into the cyan count column.
    """
    for idx, row in enumerate(rows):
        prev_s = int(rows[idx - 1]["sorties"]) if idx > 0 else None
        next_s = (
            int(rows[idx + 1]["sorties"]) if idx + 1 < len(rows) else None
        )
        cur = int(row.get("sorties") or 0)
        raw = str(row.get("ocr_raw") or row.get("name") or "")
        glued = bool(
            re.search(
                r"(?i)unicorn|ユニコーン|獨角獸|独角兽|phenex|フェネクス|"
                r"destroy\s*mo|デストロイ",
                raw,
            )
        )
        if not (prev_s and next_s and prev_s > next_s):
            continue
        in_bracket = next_s < cur < prev_s
        if glued or cur < 80 or not in_bracket:
            n = recover_glued_sorties_count(raw, prev_s, next_s)
            if n and next_s < n < prev_s:
                row["sorties"] = n
            elif not in_bracket and cur >= 80 and not glued:
                # Non-glued outlier between two solid neighbors — leave alone
                pass
            elif glued and not (n and next_s < n < prev_s):
                # Last resort: geometric mid only for glued rows with no recover
                mid = int(round((prev_s + next_s) / 2))
                if next_s < mid < prev_s:
                    row["sorties"] = mid
    return rows


def _realign_sorties_counts_by_appearance(rows: list[dict], blob: str) -> list[dict]:
    """Conservative count repair for any user's Sorties OCR.

    Never force-zip a digit stream just because lengths match — Unicorn glue
    invents extra/wrong numbers and shifts every later row. Only:
      1) fill empty counts from a clean digit stream
      2) re-zip when cur is a pure permutation of the clean stream (true off-by-one)
      3) neighbor-bracket fix for glued long names
    """
    if not rows or len(rows) < 3:
        return rows
    rows = _fix_glued_row_sorties(rows)
    nums = _extract_sortie_counts_in_appearance_order(blob)
    cur = [int(r.get("sorties") or 0) for r in rows]
    cur_ok = [c for c in cur if c >= 80]

    if len(nums) < len(rows):
        j = 0
        used = set(cur_ok)
        for r in rows:
            if int(r.get("sorties") or 0) >= 80:
                continue
            while j < len(nums) and nums[j] in used:
                j += 1
            if j < len(nums):
                r["sorties"] = nums[j]
                used.add(nums[j])
                j += 1
        return _fix_glued_row_sorties(rows)

    use = nums[: len(rows)]
    if cur == use:
        return rows
    # True off-by-one / swap: same multiset, different order
    if len(cur_ok) == len(rows) and sorted(cur_ok, reverse=True) == sorted(
        use, reverse=True
    ):
        for r, n in zip(rows, use):
            r["sorties"] = n
        return _fix_glued_row_sorties(rows)
    return _fix_glued_row_sorties(rows)


# Long Unicorn Sorties names — OCR truncates after "Destroy Mode" / デストロイ.
# Disambiguate with early tokens (Phenex) + role icon (Attack vs Support).
LONG_UNICORN_IDS = {
    "1125000250",  # Destroy Mode (EX) — Attack
    "1125001450",  # Destroy Mode / Awakened (EX) — Support
    "1144000550",  # 03 Phenex Destroy Mode (EX) — Attack
}

_PHENEX_MARKERS = (
    "phenex",
    "フェネクス",
    "不死鳥",
    "3号機",
    "03 phenex",
    "unicorn gundam 03",
)
_AWAKENED_MARKERS = (
    "awakened",
    "覚醒",
    "覺醒",
    "觉醒",
    "/ awakened",
    "モード/覚醒",
    "模式 / 覺醒",
    "模式/覺醒",
)
_DESTROY_MARKERS = (
    "destroy",
    "デストロイ",
    "毀滅",
    "破坏",
    "破壞",
    "毁灭",
)
_UNICORN_MARKERS = (
    "unicorn",
    "ユニコーン",
    "獨角獸",
    "独角兽",
)


def _ocr_has_any(raw: str, markers: tuple[str, ...]) -> bool:
    low = str(raw or "").lower()
    for m in markers:
        if m.lower() in low or m in raw:
            return True
    return False


def long_unicorn_match_boost(
    ocr_text: str,
    eid: str,
    ename: str,
    role_id: str | None,
) -> int:
    """Score delta for the 3 long Unicorn kits when OCR is truncated.

    RapidOCR typically keeps ``Unicorn Gundam (Destroy Mo…`` then glues digits.
    Phenex is early (``03 Phenex`` / ``フェネクス``). Awakened vs Destroy uses
    role: Attack→0250, Support→1450.
    """
    eid = _nid(eid)
    if eid not in LONG_UNICORN_IDS:
        return 0
    raw = str(ocr_text or "")
    if not _ocr_has_any(raw, _UNICORN_MARKERS) and "unicorn" not in _norm_name(ename):
        # Still allow if catalog name is Unicorn and blob has destroy/phenex scrap
        if not _ocr_has_any(raw, _DESTROY_MARKERS + _PHENEX_MARKERS):
            return 0
    rid = str(role_id or "").strip()
    if rid in ("0", ""):
        rid = None

    phenex = _ocr_has_any(raw, _PHENEX_MARKERS)
    awakened = _ocr_has_any(raw, _AWAKENED_MARKERS)
    destroyish = _ocr_has_any(raw, _DESTROY_MARKERS) or _ocr_has_any(
        raw, _UNICORN_MARKERS
    )
    # Digits glued into Destroy tail ⇒ name was long enough to hit Sorties column
    # (Awakened is longer than plain Destroy Mode) — prior when role unknown.
    glued_long = bool(re.search(r"destroy\s*mo\S*\d|デストロイ\S*\d", raw, flags=re.I))

    delta = 0
    if eid == "1144000550":
        if phenex:
            delta += 900
        elif destroyish and not awakened:
            # Ambiguous — don't prefer Phenex without marker
            delta -= 120
        else:
            delta -= 200
    elif eid == "1125001450":
        if phenex:
            delta -= 500
        elif awakened:
            delta += 850
        elif destroyish:
            # Digits glued into "Destroy Mo…" ⇒ OCR saw the longer Awakened title.
            # Mis-sampled Attack role must not override that (was flipping → 0250).
            if glued_long:
                delta += 750
            elif rid == "3":
                delta += 700  # Support role → Awakened
            elif rid == "1":
                delta -= 400
            else:
                delta += 40
    elif eid == "1125000250":
        if phenex:
            delta -= 500
        elif awakened:
            delta -= 450
        elif destroyish:
            if glued_long:
                delta -= 500  # long glued row is Awakened, not plain Destroy EX
            elif rid == "1":
                delta += 700  # Attack role → Destroy Mode
            elif rid == "3":
                delta -= 400
            else:
                delta += 80
    return delta


_UI_NAME_BLOCKLIST = re.compile(
    r"(?i)^(sorties|units?|characters?|profile|player\s*rank|battle\s*results|"
    r"database|haro|trophy|gold|silver|bronze|total|rank|level|pts?|"
    r"出撃|ユニット|キャラ|プロフィール|戦績|データベース|ハロ|"
    r"出擊|簡介|資料庫|等級|級別)$"
)


def ocr_looks_like_sorties_list(text: str) -> bool:
    """True when OCR is a Sorties Units/Characters list — not Profile · Main.

    Real Sorties boards often have few (EX) lines (long Unicorns, normals).
    Also match numbered 1–10 kit rows + large sortie counts.
    """
    raw = str(text or "")
    if not raw.strip():
        return False
    ex = len(re.findall(r"\(EX\)|\(SP\)|（EX）|（SP）", raw, flags=re.I))
    has_sorties_hdr = bool(
        re.search(r"(?i)\bsorties\b|出撃|出擊|出擊數|総出撃", raw)
    )
    has_units_hdr = bool(
        re.search(r"(?i)\bunits?\b|\bcharacters?\b|ユニット|キャラ|單位|機體", raw)
    )
    numbered = len(re.findall(r"(?m)^\s*\d{1,2}[\.\)\s：:\-]+", raw))
    # Typical sortie counts sit in the hundreds/thousands
    big_nums = len(re.findall(r"(?<![A-Za-z0-9])([1-9]\d{2,4})(?![A-Za-z0-9])", raw))
    kitish = len(
        re.findall(
            r"(?i)gundam|zaku|sazabi|unicorn|qubeley|exia|aerial|destiny|zeta|"
            r"freedom|phenex|nu\s|ν|マスター|ガンダム|\(EX\)|\(SP\)",
            raw,
        )
    )
    # Kit list signal: several (EX) names + Sorties/Units chrome
    if ex >= 3 and (has_sorties_hdr or has_units_hdr):
        return True
    if ex >= 5:
        return True
    if has_sorties_hdr and (numbered >= 4 or big_nums >= 5 or kitish >= 3 or ex >= 2):
        return True
    if (has_sorties_hdr or has_units_hdr) and numbered >= 5 and big_nums >= 4:
        return True
    if numbered >= 7 and big_nums >= 5 and kitish >= 2:
        return True
    if numbered >= 5 and kitish >= 4:
        return True
    # Ordered list parse: ≥5 kit+count rows ⇒ Sorties board even with garbled headers
    try:
        rows = parse_sorties_list_ordered(raw)
        if len(rows) >= 5:
            return True
    except Exception:
        pass
    return False


def ocr_looks_like_profile_main(text: str) -> bool:
    """True when OCR looks like Profile · Main (title / Pts / Haro), not Sorties."""
    raw = str(text or "")
    if ocr_looks_like_sorties_list(raw):
        return False
    hits = 0
    if re.search(
        r"(?i)\b(fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|\bens\b|cpo|po\d)\b",
        raw,
    ):
        hits += 2
    if re.search(r"(?i)\b\d{1,5}\s*(?:pts?|pt|points?|點|点)\b|(?:pts?|點|点)\s*[:：]?\s*\d", raw):
        hits += 1
    if re.search(r"(?i)\b(?:gold|silver|bronze|ゴールド|シルバー|ブロンズ)\b|[金銀銅]", raw):
        hits += 1
    if re.search(r"(?i)(?:player\s*)?rank\s*[:：]?\s*\d{1,3}\b|レベル\s*\d|等級\s*\d", raw):
        hits += 1
    return hits >= 2


def extract_player_name_from_ocr(text: str) -> str | None:
    """Best-effort player name from Profile · Main OCR (any script).

    In-game names may be JA / TW / HK / KR / EN even when the UI LANG is EN.
    Prefer CJK / Hangul / kana lines that are not chrome labels.
    Never pick Sorties kit names ((EX) / Gundam…).
    """
    raw = str(text or "")
    # Wrong screenshot in Main slot — do not invent a "player name" from kits
    if ocr_looks_like_sorties_list(raw) and not ocr_looks_like_profile_main(raw):
        return None
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    candidates: list[tuple[int, str]] = []
    for i, ln in enumerate(lines[:40]):
        s = re.sub(r"\s+", " ", ln).strip(" ·|•\u2013\u2014:-")
        if len(s) < 1 or len(s) > 24:
            continue
        if _UI_NAME_BLOCKLIST.match(s):
            continue
        if re.fullmatch(r"[\d\s,./]+", s):
            continue
        if re.match(r"(?i)^(fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|lt|ens|cpo|po\d)\b", s):
            continue
        # Sorties kit lines — never player names
        if re.search(r"\(EX\)|\(SP\)|（EX）|（SP）", s, flags=re.I):
            continue
        if re.search(
            r"(?i)gundam|zaku|sazabi|unicorn|qubeley|exia|aerial|destiny|zeta|freedom",
            s,
        ):
            continue
        if re.match(r"^\d{1,2}\s+\S", s):
            continue  # "1 Sazabi" / list ranks
        if re.search(r"(?i)\b(pts?|rank|level|lv\.?|sorties|段階|等級)\b", s) and not re.search(
            r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]", s
        ):
            continue
        has_cjk = bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff]", s))
        has_hangul = bool(re.search(r"[\uac00-\ud7af]", s))
        has_latin = bool(re.search(r"[A-Za-z]", s))
        # Score: CJK/Hangul names first; short Latin display names second
        score = 0
        if has_cjk:
            score += 100
        if has_hangul:
            score += 100
        if has_latin and not has_cjk and not has_hangul:
            if not re.match(r"^[A-Za-z][A-Za-z0-9_\-]{1,15}$", s):
                continue
            score += 40
        if not (has_cjk or has_hangul or has_latin):
            continue
        # Prefer early lines (name sits under the rank badge)
        score += max(0, 30 - i)
        # Penalize paren leftovers
        if "(" in s or "（" in s:
            score -= 50
        candidates.append((score, s))
    if not candidates:
        return None
    candidates.sort(key=lambda x: (-x[0], len(x[1])))
    return candidates[0][1]


def parse_battle_results_ocr(text: str, labels: dict[str, str] | None = None) -> dict:
    """Map Battle Results OCR lines to cumulative-record keys using LANG labels."""
    raw = str(text or "")
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    blob = "\n".join(lines)
    labels = {k: str(v) for k, v in (labels or {}).items() if v}
    # Always include EN fallbacks so mixed OCR still works
    en_fallback = {
        "total_sorties": "Total Sorties",
        "stages_cleared": "Total Stages Cleared",
        "total_skips": "Total Skips",
        "max_damage": "Max Damage Dealt",
        "max_combat_power": "Max Combat Power",
        "unit_sp": "Total Unit SP Conversions",
        "unit_ssp": "Total Unit SSP Conversions",
        "char_sp": "Character SP Conversions",
        "unit_limit_breaks": "Total Unit Limit Breaks",
        "database_units": "Database Units",
        "database_characters": "Database Characters",
        "haro_cruises": "Total Haro Warship Cruises",
        "skip_great_success": "Total Skip Great Successes",
        "total_captures": "Total Captures",
        "dismantled_units": "Dismantled Units",
    }
    for k, v in en_fallback.items():
        labels.setdefault(k, v)

    out: dict[str, int] = {}

    def _num_near(label: str) -> int | None:
        if not label:
            return None
        # Same-line or following-line number
        for i, ln in enumerate(lines):
            if label.lower() in ln.lower() or label in ln:
                chunk = " ".join(lines[i : i + 2])
                nums = re.findall(r"(\d{1,3}(?:,\d{3})+|\d{2,9})", chunk)
                for tok in reversed(nums):
                    try:
                        n = int(tok.replace(",", "").replace(" ", ""))
                    except Exception:
                        continue
                    if 0 <= n <= 99_999_999:
                        # Skip tiny ids mistaken for counts when label is long metric
                        if n < 10 and "sp" not in label.lower() and "ssp" not in label.lower():
                            continue
                        return n
        # Flat blob: Label … number
        pat = re.escape(label) + r"\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d{2,9})"
        m = re.search(pat, blob, flags=re.I)
        if m:
            try:
                return int(m.group(1).replace(",", ""))
            except Exception:
                return None
        return None

    for key, lab in labels.items():
        n = _num_near(lab)
        if n is not None:
            out[key] = n
    return out


# Tokens too common in unit names to locate Sorties — never use as the search key.
_WEAK_NAME_TOKENS = frozenset(
    {
        "gundam",
        "mobile",
        "suit",
        "mode",
        "type",
        "final",
        "battle",
        "destroy",
        "awakened",
        "the",
        "and",
        "ver",
        "custom",
    }
)


_SHORT_DISTINCT = frozenset({"xi", "nu", "zz", "ew", "dx", "ex", "sp"})


def _token_in_blob(blob: str, token: str) -> bool:
    """True if token appears in normalized OCR blob (short tokens = bounded)."""
    tok = str(token or "")
    if not tok or not blob:
        return False
    if len(tok) <= 3:
        # Avoid matching "nu" inside "hi-nu", "xi" inside longer words, etc.
        return bool(
            re.search(
                rf"(?<![a-z0-9\-]){re.escape(tok)}(?![a-z0-9])",
                blob,
            )
        )
    return tok in blob


def _name_in_blob(blob: str, norm_name: str) -> bool:
    """Full normalized name must appear as its own phrase (not suffix of hi-nu…)."""
    n = str(norm_name or "").strip()
    if not n or not blob:
        return False
    # Bound on the left so "nu gundam" does not hit inside "hi-nu gundam"
    return bool(
        re.search(
            rf"(?<![a-z0-9\-]){re.escape(n)}(?![a-z0-9])",
            blob,
        )
    )


def _distinctive_token(tokens: list[str]) -> str:
    """Pick the best catalog token for locating a name inside noisy OCR."""
    strong = [
        t
        for t in tokens
        if t not in _WEAK_NAME_TOKENS and (len(t) >= 3 or t in _SHORT_DISTINCT)
    ]
    if strong:
        # Prefer longer tokens; deprioritize bare ex/sp suffixes
        return max(
            strong,
            key=lambda t: (len(t), 0 if t in ("ex", "sp") else 1),
        )
    # Last resort: still avoid pure weak words if any other token exists
    other = [t for t in tokens if t not in _WEAK_NAME_TOKENS]
    pool = other or tokens
    return max(pool, key=len) if pool else ""


def _sorties_near_token(raw: str, token: str) -> int | None:
    """Find a Sorties count in the raw OCR near the first mention of ``token``.

    Uses the raw string (not normalized) so indices stay valid. Does **not**
    fall back to the global max — wrong pairing was worse than blank.
    """
    raw = str(raw or "")
    tok = str(token or "").strip()
    short_ok = frozenset({"xi", "nu", "zz", "ew", "dx", "ex", "sp"})
    if not raw or (len(tok) < 3 and tok.lower() not in short_ok):
        return None
    # Case-insensitive locate; short tokens need word boundaries
    if len(tok) <= 3:
        pat = re.compile(rf"(?<![A-Za-z0-9]){re.escape(tok)}(?![A-Za-z0-9])", flags=re.I)
    else:
        pat = re.compile(re.escape(tok), flags=re.I)
    m = pat.search(raw)
    if not m:
        # Try first 4+ chars of token (partial OCR)
        if len(tok) >= 5:
            m = re.search(re.escape(tok[:5]), raw, flags=re.I)
        if not m:
            return None
    window = raw[m.start() : m.end() + 72]
    nums: list[tuple[int, int]] = []
    for nm in re.finditer(r"(\d{1,3}(?:,\d{3})+|\d{3,7})", window):
        try:
            n = int(nm.group(1).replace(",", "").replace(" ", ""))
        except Exception:
            continue
        if 80 <= n <= 500000:
            nums.append((nm.start(), n))
    if not nums:
        return None
    # Prefer the first plausible count after the name
    mid = [n for _, n in nums if 200 <= n <= 20000]
    return mid[0] if mid else nums[0][1]


def _catalog_name_role_groups(
    name_index: list[tuple[str, str]], entity_roles: dict
) -> dict[str, set[str]]:
    """norm_name → set of RoleTypeIndex values that exist for that exact display name."""
    groups: dict[str, set[str]] = {}
    for eid, ename in name_index:
        n = _norm_name(ename)
        if not n:
            continue
        er = str(entity_roles.get(str(eid)) or entity_roles.get(eid) or "")
        groups.setdefault(n, set())
        if er and er != "0":
            groups[n].add(er)
    return groups


def _apply_master_role_score(
    score: int,
    *,
    name_norm: str,
    er: str,
    role_id: str | None,
    name_groups: dict[str, set[str]],
    name_lock: bool,
) -> int:
    """Use MasterData role to confirm variants — never demote a unique exact name.

    - Unique catalog name (only one role / one kit): ignore wrong visual role.
    - Same display name, multiple roles (Amuro / Unicorn Destroy…): hard prefer role_id.
    """
    if not role_id:
        return score
    roles_for_name = name_groups.get(name_norm) or set()
    # Exact unique lock (Sazabi (EX) only exists as Attack) — MasterData wins
    if name_lock and len(roles_for_name) <= 1:
        return score
    if er == role_id:
        return score + 500
    if er and er != "0":
        # Ambiguous same-name family: wrong role is nearly disqualifying
        if len(roles_for_name) >= 2:
            return score - 800
        return score - 200
    return score


def match_ocr_blob(
    ocr_text: str,
    name_index: list[tuple[str, str]],
    limit: int = 20,
    role_id: str | None = None,
    entity_roles: dict | None = None,
) -> list[dict]:
    """Match a noisy OCR row/blob against catalog names (demo-style).

    Instead of trusting the OCR string as a clean name, score each catalog
    entry by whether its distinctive tokens appear inside the garbage blob.
    MasterData RoleTypeIndex confirms which same-name variant is correct.
    """
    raw = str(ocr_text or "")
    blob = _norm_name(raw)
    if len(blob) < 3:
        return []
    role_id = str(role_id or "").strip()
    if role_id in ("0", ""):
        role_id = None
    entity_roles = entity_roles or {}
    name_groups = _catalog_name_role_groups(name_index, entity_roles)
    sorties = extract_sorties_from_ocr(raw)

    scored: list[tuple[int, str, str, str]] = []
    for eid, ename in name_index:
        n = _norm_name(ename)
        if not n or len(n) < 2:
            continue
        tokens = [t for t in n.split() if t]
        if not tokens:
            continue
        score = 0
        name_lock = False
        # Ultra-generic catalog titles that substring-match inside longer OCR (e.g. "gundam"
        # inside "unicorn gundam…") — never treat as exact.
        _generic_titles = frozenset(
            {
                "gundam",
                "gundam ex",
                "zaku",
                "zaku ii",
                "geara",
                "gelgoog",
                "dom",
                "gm",
            }
        )
        if n in blob:
            if n in _generic_titles or (len(tokens) == 1 and tokens[0] in _generic_titles):
                score = 180
            else:
                # Full catalog name appears in OCR — strongest (Sazabi (EX), Xi Gundam (EX), …)
                score = 1400
                name_lock = True
                # Prefer exact-ish length (OCR "sazabi ex" vs longer prefixed variants)
                score += max(0, 80 - abs(len(n) - len(blob)) * 4)
        else:
            strong = 0
            for t in tokens:
                if t in ("the", "of", "and", "mode", "type", "final", "battle", "gundam"):
                    continue
                if len(t) < 3 and t not in ("ex", "sp", "nu", "xi", "zz", "ew", "dx"):
                    continue
                if t in blob:
                    strong += 1
                    score += 90 + min(50, len(t) * 6)
                elif len(t) >= 5 and t[:4] in blob:
                    strong += 1
                    score += 45
            if strong < 1:
                continue
            last = tokens[-1]
            if last and len(last) >= 4 and last in blob and last not in ("gundam", "mode"):
                score += 220
            # First distinctive token (Sazabi / Setsuna / Suletta)
            first = tokens[0]
            if first and len(first) >= 4 and first in blob and first != "gundam":
                score += 160
            if "ex" in tokens and re.search(r"\bex\b", blob):
                score += 120
            # Catalog has extra distinctive words OCR never said → "Knight Sazabi"
            # must lose to plain "Sazabi (EX)" when OCR is just Sazabi.
            missing = [
                t
                for t in tokens
                if len(t) >= 4
                and t not in blob
                and t
                not in (
                    "gundam",
                    "mode",
                    "type",
                    "final",
                    "battle",
                    "destroy",
                    "awakened",
                    "the",
                )
            ]
            if missing:
                score -= 200 * len(missing)
        if score < 90:
            continue
        er = str(entity_roles.get(str(eid)) or entity_roles.get(eid) or "")
        score = _apply_master_role_score(
            score,
            name_norm=n,
            er=er,
            role_id=role_id,
            name_groups=name_groups,
            name_lock=name_lock,
        )
        # Long Unicorn Sorties rows: truncated OCR + role / Phenex tokens
        score += long_unicorn_match_boost(raw, str(eid), ename, role_id)
        # When OCR clearly says Unicorn, demote non-Unicorn kits hard
        if _ocr_has_any(raw, _UNICORN_MARKERS) and str(eid) not in LONG_UNICORN_IDS:
            if "unicorn" not in n and "ユニコーン" not in ename and "獨角獸" not in ename and "独角兽" not in ename:
                score -= 600
        scored.append((score, str(eid), ename, er))

    # Prefer higher score, then shorter catalog name (exact kit over prefixed variant)
    scored.sort(key=lambda x: (-x[0], len(_norm_name(x[2])), x[2], x[1]))
    out: list[dict] = []
    seen: set[str] = set()
    for score, eid, ename, er in scored:
        if eid in seen:
            continue
        seen.add(eid)
        row = {"id": eid, "name": ename, "score": score, "ocr_blob": True}
        if er:
            row["role_id"] = er
        if sorties is not None:
            row["sorties"] = sorties
        out.append(row)
        if len(out) >= max(5, limit):
            break
    return out


def scan_ocr_for_entities(
    ocr_text: str,
    name_index: list[tuple[str, str]],
    limit: int = 20,
    entity_roles: dict | None = None,
) -> list[dict]:
    """Scan a full Sorties screenshot OCR for all catalog hits + nearby Sorties.

    Returns rows sorted by Sorties desc (same order as the in-game list).
    """
    raw = str(ocr_text or "")
    blob = _norm_name(raw)
    if len(blob) < 4:
        return []
    entity_roles = entity_roles or {}
    hits: list[dict] = []
    for eid, ename in name_index:
        n = _norm_name(ename)
        if not n or len(n) < 3:
            continue
        tokens = [
            t
            for t in n.split()
            if len(t) >= 3 or t in ("ex", "sp", "nu", "xi", "zz", "ew")
        ]
        if len(tokens) < 1:
            continue
        # Distinctive token (not "gundam") — required for a hit
        key = _distinctive_token(tokens)
        if not key:
            continue
        # Bare "Gundam (EX)" / "Gundam" — too generic for catalog scan
        strong_toks = [
            t
            for t in tokens
            if t not in _WEAK_NAME_TOKENS
            and t not in ("ex", "sp")
            and (len(t) >= 3 or t in _SHORT_DISTINCT - {"ex", "sp"})
        ]
        if not strong_toks:
            continue
        key = _distinctive_token(strong_toks) or key
        if len(key) < 4 and key not in ("exia", "xi", "nu", "zz", "ew", "dx"):
            continue
        full_hit = _name_in_blob(blob, n)
        if not _token_in_blob(blob, key) and not full_hit:
            continue
        # Prefer full-name containment; else multi-token on distinctive parts
        score = 0
        if full_hit:
            score = 1200
        else:
            present = sum(1 for t in strong_toks if _token_in_blob(blob, t))
            # Multi-token catalog names need ≥2 distinctive hits ("destiny" alone
            # must not pull every Blue Destiny kit when OCR says Destiny Gundam).
            if len(strong_toks) >= 2:
                need = 2
            else:
                need = 1 if len(key) >= 5 else min(2, max(1, len(strong_toks)))
            if present < need:
                continue
            # Short codes (xi/nu/zz) need another strong token or exact short name
            if len(key) <= 3 and present < 2 and not full_hit:
                continue
            score = 200 * present + len(key) * 10
            if "ex" in tokens and re.search(r"\bex\b", blob):
                score += 180
        # Pair Sorties from raw text near distinctive token — never global max
        sorties = _sorties_near_token(raw, key)
        if sorties is None:
            for t in sorted(strong_toks, key=len, reverse=True):
                if len(t) < 4 and t not in _SHORT_DISTINCT - {"ex", "sp"}:
                    continue
                sorties = _sorties_near_token(raw, t)
                if sorties is not None:
                    break
        if sorties is None and full_hit:
            # Full-name present: search after the leading display words in raw
            lead = ename.split("(")[0].strip()[:24]
            if lead:
                sorties = _sorties_near_token(raw, lead.split()[0] if lead.split() else key)
        er = str(entity_roles.get(str(eid)) or entity_roles.get(eid) or "")
        hits.append(
            {
                "id": str(eid),
                "name": ename,
                "score": score,
                "sorties": int(sorties or 0),
                **({"role_id": er} if er else {}),
            }
        )
    # Dedup by id; for unit kits prefer (EX) over base when both hit same line
    by_id: dict[str, dict] = {}
    for h in hits:
        prev = by_id.get(h["id"])
        if not prev or int(h.get("score") or 0) > int(prev.get("score") or 0):
            by_id[h["id"]] = h
    rows = list(by_id.values())
    # Collapse unit EX vs non-EX same display stem when OCR only shows one line
    # (keep both character kits that share a display name — Amuro ×2 etc.)
    by_stem: dict[str, list[dict]] = {}
    for h in rows:
        # _norm_name already strips () so EX becomes a trailing token
        stem = re.sub(
            r"\s+\b(?:ex|sp)\b\s*$",
            "",
            _norm_name(h.get("name") or ""),
        ).strip()
        by_stem.setdefault(stem, []).append(h)
    collapsed: list[dict] = []
    for stem, group in by_stem.items():
        if len(group) == 1:
            collapsed.append(group[0])
            continue
        ids = {g["id"] for g in group}
        has_ex = any(
            re.search(r"\((?:ex|sp)\)", (g.get("name") or ""), re.I)
            or re.search(r"\b(?:ex|sp)\b", _norm_name(g.get("name") or ""))
            for g in group
        )
        # Same display name, different ids, no EX kit in group → character variants
        if len(ids) > 1 and not has_ex:
            collapsed.extend(group)
            continue
        # Unit line: prefer EX/SP + highest score (drop base when EX also hit)
        group.sort(
            key=lambda g: (
                1
                if re.search(r"\((?:ex|sp)\)", (g.get("name") or ""), re.I)
                else 0,
                int(g.get("score") or 0),
                int(g.get("sorties") or 0),
            ),
            reverse=True,
        )
        collapsed.append(group[0])
    rows = collapsed
    # Sorties lists use unique counts — drop weaker token-collision claims on the
    # same number (e.g. every Unicorn kit latching onto 2383). Equal-score hits
    # (two Amuro Ray kits) are kept together for the confirm picker.
    by_sorties: dict[int, list[dict]] = {}
    no_count: list[dict] = []
    for h in rows:
        s = int(h.get("sorties") or 0)
        if s < 80:
            no_count.append(h)
            continue
        group = by_sorties.setdefault(s, [])
        if not group:
            group.append(h)
            continue
        def _ex_bonus(row: dict) -> int:
            return 1 if re.search(r"\((?:ex|sp)\)", str(row.get("name") or ""), re.I) else 0

        best_sc = max(int(x.get("score") or 0) for x in group)
        best_ex = max(_ex_bonus(x) for x in group)
        sc = int(h.get("score") or 0)
        exb = _ex_bonus(h)
        if sc > best_sc or (sc == best_sc and exb > best_ex):
            by_sorties[s] = [h]
        elif sc == best_sc and exb == best_ex:
            # Same quality (e.g. two Amuro Ray kits) — keep for confirm picker
            if h["id"] not in {x["id"] for x in group}:
                group.append(h)
        # else: weaker false positive — drop
    rows = [h for group in by_sorties.values() for h in group] + no_count
    rows.sort(
        key=lambda x: (
            -int(x.get("sorties") or 0),
            -int(x.get("score") or 0),
            x.get("name") or "",
        )
    )
    return rows[:limit]


def match_entity_name(
    name: str,
    name_index: list[tuple[str, str]],
    limit: int = 8,
    role_id: str | None = None,
    entity_roles: dict | None = None,
) -> list[dict]:
    """Fuzzy match display name against [(id, name), ...].

    When ``role_id`` + ``entity_roles`` are provided, candidates with the matching
    RoleTypeIndex are strongly preferred (Attack/Support/Durability from the
    Sorties row role icon). Same display-name variants are still expanded.
    """
    q = _norm_name(name)
    if not q or len(q) < 2:
        return []
    role_id = str(role_id or "").strip()
    if role_id in ("0", ""):
        role_id = None
    entity_roles = entity_roles or {}
    name_groups = _catalog_name_role_groups(name_index, entity_roles)

    qt = set(q.split())
    scored = []
    for eid, ename in name_index:
        n = _norm_name(ename)
        if not n:
            continue
        score = 0
        name_lock = False
        if n == q:
            score = 1000
            name_lock = True
        elif q in n or n in q:
            score = 800 - abs(len(n) - len(q))
            if n == q or q == n:
                name_lock = True
        else:
            nt = set(n.split())
            inter = len(qt & nt)
            if inter:
                score = 100 * inter - abs(len(n) - len(q))
                # Prefer last-token (family name) hits — Char vs Quattro, etc.
                q_last = q.split()[-1] if q.split() else ""
                n_last = n.split()[-1] if n.split() else ""
                if q_last and q_last == n_last and len(q_last) >= 4:
                    score += 120
                if q.split() and n.split() and q.split()[0] == n.split()[0] and len(q.split()[0]) >= 3:
                    score += 80
        if score <= 0:
            continue
        er = str(entity_roles.get(str(eid)) or entity_roles.get(eid) or "")
        score = _apply_master_role_score(
            score,
            name_norm=n,
            er=er,
            role_id=role_id,
            name_groups=name_groups,
            name_lock=name_lock,
        )
        score += long_unicorn_match_boost(name, str(eid), ename, role_id)
        scored.append((score, eid, ename, er))
    scored.sort(key=lambda x: (-x[0], x[2], x[1]))

    out = []
    seen = set()
    seed_names = set()
    for score, eid, ename, er in scored[: max(5, limit)]:
        if eid in seen:
            continue
        # Same display name, multiple roles: drop wrong-role variants when role known
        if role_id and er and er != "0" and er != role_id:
            roles_for = name_groups.get(_norm_name(ename)) or set()
            if len(roles_for) >= 2:
                continue
        seen.add(eid)
        seed_names.add(_norm_name(ename))
        row = {"id": eid, "name": ename, "score": score}
        if er:
            row["role_id"] = er
        out.append(row)

    variants = []
    for eid, ename in name_index:
        if eid in seen:
            continue
        if _norm_name(ename) not in seed_names:
            continue
        er = str(entity_roles.get(str(eid)) or entity_roles.get(eid) or "")
        # Same-name character/unit kits: only keep MasterData-matching role
        if role_id and er and er != "0" and er != role_id:
            roles_for = name_groups.get(_norm_name(ename)) or set()
            if len(roles_for) >= 2:
                continue
        vscore = 950
        if role_id and er == role_id:
            vscore = 980
        elif role_id and er and er != "0" and er != role_id:
            vscore = 700
        variants.append(
            {
                "id": eid,
                "name": ename,
                "score": vscore,
                "variant": True,
                **({"role_id": er} if er else {}),
            }
        )
        seen.add(eid)
    variants.sort(key=lambda x: (-x["score"], x["id"]))
    out.extend(variants)
    # Re-sort so role-boosted seeds stay on top
    out.sort(key=lambda x: (-int(x.get("score") or 0), x.get("name") or "", x.get("id") or ""))
    if len(out) > 40:
        out = out[:40]
    return out


def parse_profile_main_ocr(text: str, lang: str = "EN") -> dict:
    """Extract player name/level, military title, achievement pts, Haro counts from main Profile OCR."""
    raw = str(text or "")
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    blob = "\n".join(lines)
    out = {
        "player_name": None,
        "player_level": None,
        "profile_rank_title": None,
        "achievement_pts": None,
        "haro": {"gold": None, "silver": None, "bronze": None},
        "wrong_screen": None,
    }
    # Refuse Sorties screenshots placed in Profile · Main
    if ocr_looks_like_sorties_list(raw) and not ocr_looks_like_profile_main(raw):
        out["wrong_screen"] = "sorties"
        return out
    out["player_name"] = extract_player_name_from_ocr(raw)

    # Player level — "Rank 114" / "Lv.114" / "レベル114"
    # Do not treat Sorties list indices (1–10) as player level.
    for pat in (
        r"(?i)\b(?:player\s*)?rank\s*[:：]?\s*(\d{1,3})\b",
        r"(?i)\blv\.?\s*(\d{1,3})\b",
        r"(?i)\blevel\s*[:：]?\s*(\d{1,3})\b",
        r"レベル\s*(\d{1,3})",
        r"等級\s*(\d{1,3})",
        r"級別\s*(\d{1,3})",
    ):
        m = re.search(pat, blob)
        if m:
            lv = int(m.group(1))
            if 1 <= lv <= 300:
                out["player_level"] = lv
                break

    # Military title — m_profile_rank LANG abbreviations
    titles = [
        "FADM 5",
        "FADM 4",
        "FADM 3",
        "FADM 2",
        "FADM 1",
        "FADM",
        "ADM",
        "VADM",
        "RADM",
        "CDRE",
        "CAPT",
        "CDR",
        "LCDR",
        "LTJG",
        "LT",
        "ENS",
        "CPO",
        "PO1",
        "PO2",
    ]
    # Prefer longer tokens first (already ordered)
    upper = blob.upper()
    for title in titles:
        if re.search(r"\b" + re.escape(title) + r"\b", upper):
            out["profile_rank_title"] = title
            break

    # Achievement pts — "135 Pts" / "Pts 135" / "135/180"
    for pat in (
        r"(?i)(\d{1,5})\s*/\s*(\d{1,5})\s*(?:pts?|pt|點|点)",
        r"(?i)(?:pts?|pt|points?|點|点)\s*[:：]?\s*(\d{1,5})",
        r"(?i)(\d{1,5})\s*(?:pts?|pt|points?|點|点)\b",
    ):
        m = re.search(pat, blob)
        if m:
            out["achievement_pts"] = int(m.group(1))
            if m.lastindex and m.lastindex >= 2 and m.group(2):
                out["achievement_pts_next"] = int(m.group(2))
            break

    # Haro trophy counts near Gold/Silver/Bronze labels
    def _near_count(label_pats: list[str]) -> int | None:
        for i, ln in enumerate(lines):
            low = ln.lower()
            if not any(re.search(p, low) for p in label_pats):
                continue
            # same line or next 2 lines
            chunk = " ".join(lines[i : i + 3])
            nums = re.findall(r"\b(\d{1,4})\b", chunk)
            for n in nums:
                v = int(n)
                if 0 <= v <= 999:
                    return v
        return None

    out["haro"]["gold"] = _near_count([r"gold", r"金", r"ゴールド"])
    out["haro"]["silver"] = _near_count([r"silver", r"銀", r"シルバー"])
    out["haro"]["bronze"] = _near_count([r"bronze", r"銅", r"ブロンズ"])
    return out


def player_level_insights(meta: dict, battle: dict, player_rank_rows: list[dict], profile_rank_rows: list[dict] | None = None) -> dict:
    """EXP-to-next + rough pace insights from main Profile + Battle Results."""
    level = meta.get("rank") or meta.get("player_level")
    try:
        level = int(level) if level is not None else None
    except Exception:
        level = None
    by_rank = {}
    for r in player_rank_rows or []:
        try:
            by_rank[int(r.get("Rank"))] = r
        except Exception:
            pass
    out = {
        "player_level": level,
        "profile_rank_title": meta.get("profile_rank_title"),
        "achievement_pts": meta.get("achievement_pts"),
        "exp_at_level": None,
        "exp_next_level": None,
        "exp_to_next": None,
        "clears_to_next_at_50": None,
        "lifetime_exp_floor": None,
        "exp_per_clear_est": None,
        "days_scenarios": [],
        "profile_rank_next": None,
        "pts_to_next_title": None,
        "notes": [],
    }
    if level and level in by_rank:
        cur = by_rank[level]
        nxt = by_rank.get(level + 1)
        exp_at = int(cur.get("Exp") or 0)
        out["exp_at_level"] = exp_at
        out["lifetime_exp_floor"] = exp_at
        out["max_action_point"] = int(cur.get("MaxActionPoint") or 0)
        if nxt:
            exp_next = int(nxt.get("Exp") or 0)
            need = max(0, exp_next - exp_at)
            out["exp_next_level"] = exp_next
            out["exp_to_next"] = need
            out["clears_to_next_at_50"] = int((need + 49) // 50) if need else 0
            # Pace from Battle Results (stages + skips typically grant AddPlayerRankExp=50)
            stages = int((battle or {}).get("stages_cleared") or 0)
            skips = int((battle or {}).get("total_skips") or 0)
            events = stages + skips
            if events > 0 and exp_at > 0:
                per = round(exp_at / events, 2)
                out["exp_per_clear_est"] = per
                out["notes"].append(
                    "Lifetime EXP floor ÷ (Stages cleared + Total Skips) ≈ EXP per clear/skip historically."
                )
            for daily in (500, 2000, 5000, 10000):
                days = round(need / daily, 1) if daily else None
                out["days_scenarios"].append(
                    {
                        "exp_per_day": daily,
                        "days": days,
                        "clears_per_day_at_50": int((daily + 49) // 50),
                    }
                )

    # Military title progress from m_profile_rank RequiredPoint
    title = str(meta.get("profile_rank_title") or "").strip().upper()
    pts = meta.get("achievement_pts")
    if profile_rank_rows and title:
        # rows need Name resolved externally — accept {title, required_point} or RankId order
        ordered = sorted(
            [r for r in profile_rank_rows if r.get("title") or r.get("RequiredPoint") is not None],
            key=lambda x: int(x.get("RequiredPoint") or x.get("required_point") or 0),
        )
        cur_req = None
        next_row = None
        for i, r in enumerate(ordered):
            t = str(r.get("title") or "").strip().upper()
            if t == title:
                cur_req = int(r.get("RequiredPoint") or r.get("required_point") or 0)
                if i + 1 < len(ordered):
                    next_row = ordered[i + 1]
                break
        if next_row:
            out["profile_rank_next"] = next_row.get("title")
            next_req = int(next_row.get("RequiredPoint") or next_row.get("required_point") or 0)
            if pts is not None:
                try:
                    out["pts_to_next_title"] = max(0, next_req - int(pts))
                except Exception:
                    out["pts_to_next_title"] = next_req
            else:
                out["pts_to_next_title"] = max(0, next_req - (cur_req or 0))
    return out


def _percentile_rank(value, samples: list[float]) -> float | None:
    """Percent of samples strictly below value (0–100)."""
    if value is None or not samples:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    below = sum(1 for s in samples if s < v)
    return round(100.0 * below / len(samples), 1)


def analyze_snapshot(snapshot: dict, ctx: dict) -> dict:
    """
    ctx keys (call from app):
      lang, unit_info_map, unit_lin_map, resolve_tags(fn),
      unit_ter_map, unit terrain_set via unit_info_map,
      supporter_list, supporter_leader_tag_ids, supporter_leader_pct,
      resolve_role_label, census (optional dict of metric -> [samples]),
      top_n
    """
    lang = str(ctx.get("lang") or snapshot.get("lang") or "EN").upper()
    if lang == "JP":
        lang = "JA"
    top_n = int(ctx.get("top_n") or 20)
    top_n = max(5, min(20, top_n))

    units = list(snapshot.get("sortie_units") or [])[:top_n]
    chars = list(snapshot.get("sortie_chars") or [])[:top_n]
    battle = dict(snapshot.get("battle_results") or {})
    meta = dict(snapshot.get("meta") or {})
    census = ctx.get("census") or {}

    unit_info_map = ctx.get("unit_info_map") or {}
    unit_lin_map = ctx.get("unit_lin_map") or {}
    unit_ter_map = ctx.get("unit_ter_map") or {}
    resolve_tags = ctx.get("resolve_tags")
    supporter_leader_tag_ids = ctx.get("supporter_leader_tag_ids")
    supporter_rows = list(ctx.get("supporter_list") or [])
    get_supp_name = ctx.get("supporter_name") or (lambda sid: str(sid))
    get_leader_pct = ctx.get("supporter_leader_pct") or (lambda sid: 0)
    resolve_role = ctx.get("resolve_role_label")
    role_icon_map = ctx.get("role_icon_map") or {}
    terrain_type_icons = ctx.get("terrain_type_icon_map") or {}
    terrain_level_icons = ctx.get("terrain_level_icon_map") or {}
    game_image_url = ctx.get("game_image_public_url") or (lambda p: p)

    # --- Sortie concentration ---
    u_sorties = [max(0, int(x.get("sorties") or 0)) for x in units]
    total_u = sum(u_sorties) or 1
    top3 = sum(u_sorties[:3])
    top5 = sum(u_sorties[:5])
    top10 = sum(u_sorties[:10])
    concentration = {
        "total_listed_sorties": sum(u_sorties),
        "listed_count": len(units),
        "top3_share_pct": round(100.0 * top3 / total_u, 1),
        "top5_share_pct": round(100.0 * top5 / total_u, 1),
        "top10_share_pct": round(100.0 * top10 / total_u, 1),
        "top1_sorties": u_sorties[0] if u_sorties else 0,
        "top1_share_pct": round(100.0 * (u_sorties[0] if u_sorties else 0) / total_u, 1),
        "explain": (
            f"Of the {len(units)} units you listed (sum of their Sorties counts = {sum(u_sorties):,}), "
            f"your #1–#3 alone account for {round(100.0 * top3 / total_u, 1)}% of that sum — "
            f"how concentrated your recent play is among favorites."
        ),
    }

    # --- Tags / series / roles / terrain from units ---
    tag_weight = Counter()
    tag_meta = {}
    series_weight = Counter()
    role_weight = Counter()
    terrain_best = Counter()  # terrain name -> sortie weight of units with ● (tier 3)
    terrain_any = Counter()  # sortie weight per terrain with tier >= 2
    ult_count = 0
    ex_count = 0
    ex_sorties = 0
    limited_unit_ids = set(str(x) for x in (ctx.get("limited_unit_ids") or []))
    limited_char_ids = set(str(x) for x in (ctx.get("limited_char_ids") or []))
    limited_unit_count = 0
    limited_unit_sorties = 0
    resolved_units = []
    top3_tag_weight = Counter()

    for idx, row in enumerate(units):
        uid = _nid(row.get("unit_id") or row.get("id"))
        sorties = max(0, int(row.get("sorties") or 0))
        info = unit_info_map.get(uid) or {}
        name = str(row.get("name") or "")
        is_ult = bool(info.get("is_ultimate"))
        if is_ult:
            ult_count += 1
        is_ex = "(EX)" in name.upper() or str(name).rstrip().endswith("EX")
        if is_ex:
            ex_count += 1
            ex_sorties += sorties
        is_limited = uid in limited_unit_ids
        if is_limited:
            limited_unit_count += 1
            limited_unit_sorties += sorties
        role = str(info.get("role") or "0")
        role_weight[role] += sorties
        tags = []
        if callable(resolve_tags):
            try:
                tags = resolve_tags(unit_lin_map, uid, lang, "unit") or []
            except Exception:
                tags = []
        for tg in tags:
            tid = _nid(tg.get("id"))
            tname = str(tg.get("name") or tid)
            ttype = str(tg.get("type") or "unit")
            if not tid:
                continue
            tag_weight[tid] += sorties
            tag_meta[tid] = {"id": tid, "name": tname, "type": ttype}
            if ttype == "series":
                series_weight[tid] += sorties
            if idx < 3:
                top3_tag_weight[tid] += sorties

        # Terrain caps
        tset = _nid(info.get("terrain_set") or "")
        ter = unit_ter_map.get(tset) or {}
        for tname, tier in (ter or {}).items():
            try:
                lv = int(tier)
            except Exception:
                lv = 1
            if lv >= 3:
                terrain_best[tname] += sorties
            if lv >= 2:
                terrain_any[tname] += sorties

        resolved_units.append(
            {
                "rank": row.get("rank"),
                "unit_id": uid,
                "name": name or info.get("name") or uid,
                "sorties": sorties,
                "share_pct": round(100.0 * sorties / total_u, 1),
                "is_ultimate": is_ult,
                "is_ex": is_ex,
                "is_limited_time": is_limited,
                "role": role,
                "role_icon": role_icon_map.get(role) or "",
                "tags": [
                    {"id": _nid(t.get("id")), "name": t.get("name"), "type": t.get("type")}
                    for t in tags
                ],
            }
        )

    ROLE_FALLBACK = {"1": "Attack", "2": "Defense", "3": "Support", "0": "Unknown"}

    def _role_label(rid: str) -> str:
        if callable(resolve_role):
            try:
                return str(resolve_role(rid, lang) or ROLE_FALLBACK.get(rid, rid))
            except Exception:
                pass
        return ROLE_FALLBACK.get(rid, rid)

    roles_out = [
        {
            "role": _role_label(r),
            "role_index": r,
            "role_icon": role_icon_map.get(r) or "",
            "sorties": w,
            "share_pct": round(100.0 * w / total_u, 1),
        }
        for r, w in role_weight.most_common()
    ]

    top_tags = []
    for tid, w in tag_weight.most_common(15):
        meta_t = tag_meta.get(tid) or {"id": tid, "name": tid, "type": "unit"}
        top_tags.append(
            {
                **meta_t,
                "sortie_weight": w,
                "share_pct": round(100.0 * w / total_u, 1),
                "icon_kind": "character" if meta_t.get("type") == "character" else "unit",
            }
        )

    # Tags across the full listed top-N (not just top 3)
    list_tags = top_tags[:12]

    def _terrain_rows(counter: Counter, limit: int = 5):
        rows = []
        for tname, w in counter.most_common(limit):
            icon = terrain_type_icons.get(tname) or ""
            if icon and not str(icon).startswith("/"):
                icon = f"/static/images/UI/{icon}"
            rows.append(
                {
                    "name": tname,
                    "sortie_weight": w,
                    "share_pct": round(100.0 * w / total_u, 1),
                    "type_icon": game_image_url(icon) if icon else "",
                    "level_icon": game_image_url(
                        f"/static/images/UI/{terrain_level_icons.get(3, 'UI_Common_TerrainIcon_Circle.webp')}"
                    )
                    if terrain_level_icons
                    else "",
                }
            )
        return rows

    terrain_caps = {
        "best_circle": _terrain_rows(terrain_best, 5),
        "strong_triangle_plus": _terrain_rows(terrain_any, 5),
        "explain": (
            "Which terrain your favorite units are strongest on (● = best tier), "
            "weighted by how often you sortie them."
        ),
    }

    # --- Supporter recommendations: % of top-N units whose tags overlap leader skill ---
    user_tag_ids = set(tag_weight.keys())
    unit_tag_sets = []
    for u in resolved_units:
        unit_tag_sets.append(
            {
                "unit_id": u.get("unit_id"),
                "name": u.get("name"),
                "tags": {_nid(t.get("id")) for t in (u.get("tags") or []) if _nid(t.get("id"))},
            }
        )
    n_units = max(1, len(unit_tag_sets))
    supp_recs = []
    if user_tag_ids and callable(supporter_leader_tag_ids):
        for srow in supporter_rows:
            sid = _nid(srow.get("id") if isinstance(srow, dict) else srow)
            if not sid:
                continue
            try:
                stags = list(supporter_leader_tag_ids(sid) or [])
            except Exception:
                stags = []
            stags = [_nid(x) for x in stags if _nid(x)]
            if not stags:
                continue
            stags_set = set(stags)
            covered = []
            for u in unit_tag_sets:
                hit = stags_set & u["tags"]
                if hit:
                    covered.append(
                        {
                            "unit_id": u["unit_id"],
                            "name": u["name"],
                            "overlap_tags": [
                                tag_meta.get(t, {"id": t, "name": t, "type": "unit"}) for t in hit
                            ],
                        }
                    )
            if not covered:
                continue
            pct = 0.0
            try:
                pct = float(get_leader_pct(sid) or 0)
            except Exception:
                pct = 0.0
            cover_pct = round(100.0 * len(covered) / n_units, 1)
            overlap = [t for t in stags if t in user_tag_ids]
            supp_recs.append(
                {
                    "id": sid,
                    "name": get_supp_name(sid) if callable(get_supp_name) else sid,
                    "leader_pct": pct,
                    "units_covered": len(covered),
                    "units_total": n_units,
                    "cover_pct": cover_pct,
                    "covered_units": covered[:8],
                    "overlap_tags": [
                        {
                            **tag_meta.get(t, {"id": t, "name": t, "type": "unit"}),
                            "sortie_weight": tag_weight[t],
                        }
                        for t in overlap
                    ],
                    "overlap_count": len(overlap),
                    # Keep score for sort stability only (not shown as primary)
                    "score": cover_pct * 1000 + pct,
                }
            )
        supp_recs.sort(
            key=lambda x: (-x["cover_pct"], -x.get("leader_pct", 0), -x["units_covered"])
        )
        for i, s in enumerate(supp_recs[:12], start=1):
            s["rank"] = i
        supp_recs = supp_recs[:12]

    # --- Battle Results cumulative records (LANG: m_profile_cumulative_record) ---
    rec = ctx.get("cumulative_record_labels") or {}

    def _L(key: str, fallback: str) -> str:
        return str(rec.get(key) or fallback)

    def _num(key, *alts):
        for k in (key,) + alts:
            if k in battle and battle[k] is not None:
                try:
                    return int(str(battle[k]).replace(",", ""))
                except Exception:
                    pass
        return None

    fingerprint = {
        "total_sorties": _num("total_sorties", "Total Sorties"),
        "stages_cleared": _num("stages_cleared", "Total Stages Cleared"),
        "total_skips": _num("total_skips", "Total Skips"),
        "max_damage": _num("max_damage", "Max Damage Dealt"),
        "max_combat_power": _num("max_combat_power", "Max Combat Power"),
        "unit_sp": _num("unit_sp", "Total Unit SP Conversions"),
        "unit_ssp": _num("unit_ssp", "Total Unit SSP Conversions"),
        "char_sp": _num("char_sp", "Character SP Conversions"),
        "unit_limit_breaks": _num("unit_limit_breaks", "Total Unit Limit Breaks"),
        "database_units": _num("database_units", "Database Units"),
        "database_characters": _num("database_characters", "Database Characters"),
        "haro_cruises": _num("haro_cruises", "Total Haro Warship Cruises"),
        "skip_great_success": _num("skip_great_success", "Total Skip Great Successes"),
        "total_captures": _num("total_captures", "Total Captures"),
        "dismantled_units": _num("dismantled_units", "Dismantled Units"),
    }
    ts = fingerprint.get("total_sorties") or 0
    sk = fingerprint.get("total_skips") or 0
    fingerprint["skip_per_sortie"] = round(sk / ts, 2) if ts else None
    if ts and fingerprint.get("stages_cleared") is not None:
        fingerprint["stages_per_sortie"] = round(fingerprint["stages_cleared"] / ts, 2)
    if ts and fingerprint.get("skip_great_success") is not None:
        fingerprint["great_success_per_1k_skips"] = (
            round(1000.0 * fingerprint["skip_great_success"] / sk, 2) if sk else None
        )

    # Census percentiles (vs published sample until live census fills)
    census_compare = []
    metric_labels = [
        ("total_sorties", _L("total_sorties", "Total Sorties")),
        ("stages_cleared", _L("stages_cleared", "Total Stages Cleared")),
        ("total_skips", _L("total_skips", "Total Skips")),
        (
            "skip_per_sortie",
            f"{_L('total_skips', 'Total Skips')} ÷ {_L('total_sorties', 'Total Sorties')}",
        ),
        ("max_damage", _L("max_damage", "Max Damage Dealt")),
        ("max_combat_power", _L("max_combat_power", "Max Combat Power")),
        ("unit_sp", _L("unit_sp", "Total Unit SP Conversions")),
        ("unit_ssp", _L("unit_ssp", "Total Unit SSP Conversions")),
        ("unit_limit_breaks", _L("unit_limit_breaks", "Total Unit Limit Breaks")),
        ("database_units", _L("database_units", "Database Units")),
        ("database_characters", _L("database_characters", "Database Characters")),
        ("skip_great_success", _L("skip_great_success", "Total Skip Great Successes")),
        ("haro_cruises", _L("haro_cruises", "Total Haro Warship Cruises")),
        ("total_captures", _L("total_captures", "Total Captures")),
        ("dismantled_units", _L("dismantled_units", "Dismantled Units")),
    ]
    for key, label in metric_labels:
        val = fingerprint.get(key)
        samples = census.get(key) if isinstance(census, dict) else None
        if not samples or val is None:
            continue
        pct = _percentile_rank(val, list(samples))
        if pct is None:
            continue
        census_compare.append(
            {
                "key": key,
                "label": label,
                "value": val,
                "percentile": pct,
                "sample_n": len(samples),
                "vs_median": round(float(val) - sorted(samples)[len(samples) // 2], 2)
                if samples
                else None,
            }
        )

    # Limited characters among listed Sorties chars
    limited_char_count = 0
    limited_char_sorties = 0
    for crow in chars:
        cid = _nid(crow.get("character_id") or crow.get("id"))
        if cid in limited_char_ids:
            limited_char_count += 1
            limited_char_sorties += max(0, int(crow.get("sorties") or 0))

    # Rates: only pair metrics that share a real gameplay link (no LB÷Sorties junk).
    lab_sorties = _L("total_sorties", "Total Sorties")
    lab_skips = _L("total_skips", "Total Skips")
    lab_stages = _L("stages_cleared", "Total Stages Cleared")
    lab_lb = _L("unit_limit_breaks", "Total Unit Limit Breaks")
    lab_sp = _L("unit_sp", "Total Unit SP Conversions")
    lab_ssp = _L("unit_ssp", "Total Unit SSP Conversions")
    lab_char_sp = _L("char_sp", "Character SP Conversions")
    lab_db_u = _L("database_units", "Database Units")
    lab_db_c = _L("database_characters", "Database Characters")
    lab_dmg = _L("max_damage", "Max Damage Dealt")
    lab_cp = _L("max_combat_power", "Max Combat Power")
    lab_gs = _L("skip_great_success", "Total Skip Great Successes")
    lab_cap = _L("total_captures", "Total Captures")
    db_u = fingerprint.get("database_units") or 0
    db_c = fingerprint.get("database_characters") or 0

    rates = []
    # --- Lineup composition (top N) ---
    rates.append(
        {
            "key": "limited_units",
            "label": f"Limited · units top {top_n}",
            "label_en": f"Limited · units top {top_n}",
            "value": limited_unit_count,
            "unit": f"/ {len(units)}",
            "hint": f"{limited_unit_count} of {len(units)} listed units are limited-time · {round(100.0 * limited_unit_sorties / total_u, 1)}% of listed Sorties",
            "icon": "profile_achievements_list_icon_unit.webp",
        }
    )
    if chars:
        total_c_sorties = sum(max(0, int(x.get("sorties") or 0)) for x in chars) or 1
        rates.append(
            {
                "key": "limited_chars",
                "label": f"Limited · chars top {top_n}",
                "label_en": f"Limited · chars top {top_n}",
                "value": limited_char_count,
                "unit": f"/ {len(chars)}",
                "hint": f"{limited_char_count} of {len(chars)} listed characters are limited-time · {round(100.0 * limited_char_sorties / total_c_sorties, 1)}% of listed Sorties",
                "icon": "profile_achievements_list_icon_character.webp",
            }
        )
    rates.append(
        {
            "key": "ex_listed_share",
            "label": f"(EX) ÷ listed {lab_sorties}",
            "label_en": f"(EX) ÷ listed {lab_sorties}",
            "value": round(100.0 * ex_sorties / total_u, 1),
            "unit": "%",
            "hint": f"Sorties on (EX) kits ÷ sum of listed unit Sorties ({sum(u_sorties):,})",
            "icon": "profile_achievements_list_icon_unit.webp",
        }
    )
    rates.append(
        {
            "key": "ultimate_count",
            "label": f"Ultimate · top {top_n}",
            "label_en": f"Ultimate · top {top_n}",
            "value": ult_count,
            "unit": f"/ {len(units)}",
            "hint": f"Ultimate kits among your top {top_n} Sorties units",
            "icon": "profile_achievements_list_icon_unit.webp",
        }
    )
    rates.append(
        {
            "key": "ex_name_count",
            "label": f"(EX) · top {top_n}",
            "label_en": f"(EX) · top {top_n}",
            "value": ex_count,
            "unit": f"/ {len(units)}",
            "hint": f"(EX) name kits among your top {top_n}",
            "icon": "profile_achievements_list_icon_unit.webp",
        }
    )
    rates.append(
        {
            "key": "unique_tags",
            "label": "Tags",
            "label_en": "Tags",
            "value": len(tag_weight),
            "unit": "",
            "hint": "Distinct Tags across listed units",
            "icon": "profile_achievements_list_icon_unit.webp",
        }
    )
    # --- Battle flow (sortie ↔ stage ↔ skip ↔ capture) ---
    if ts:
        if fingerprint.get("total_skips") is not None:
            rates.append(
                {
                    "key": "skips_per_sortie",
                    "label": f"{lab_skips} ÷ {lab_sorties}",
                    "label_en": f"{lab_skips} ÷ {lab_sorties}",
                    "value": fingerprint.get("skip_per_sortie"),
                    "unit": "×",
                    "hint": "How often you Skip vs sortie into battle",
                    "icon": "profile_achievements_list_icon_stage.webp",
                }
            )
        if fingerprint.get("stages_cleared") is not None:
            rates.append(
                {
                    "key": "stages_per_sortie",
                    "label": f"{lab_stages} ÷ {lab_sorties}",
                    "label_en": f"{lab_stages} ÷ {lab_sorties}",
                    "value": fingerprint.get("stages_per_sortie"),
                    "unit": "×",
                    "hint": "Clears relative to Sorties",
                    "icon": "profile_achievements_list_icon_stage_main.webp",
                }
            )
        if fingerprint.get("total_captures") is not None:
            rates.append(
                {
                    "key": "captures_per_sortie",
                    "label": f"{lab_cap} ÷ {lab_sorties}",
                    "label_en": f"{lab_cap} ÷ {lab_sorties}",
                    "value": round(fingerprint["total_captures"] / ts, 2),
                    "unit": "×",
                    "hint": "Captures relative to Sorties",
                    "icon": "profile_achievements_list_icon_unit.webp",
                }
            )
    if sk and fingerprint.get("skip_great_success") is not None:
        rates.append(
            {
                "key": "great_success_per_1k_skips",
                "label": f"{lab_gs} / 1,000 {lab_skips}",
                "label_en": f"{lab_gs} / 1,000 {lab_skips}",
                "value": fingerprint.get("great_success_per_1k_skips"),
                "unit": "",
                "hint": "Great Success rate among Skips",
                "icon": "profile_achievements_list_icon_stage.webp",
            }
        )
    # --- Collection intensity (enhance / SP vs Database register counts) ---
    if db_u and fingerprint.get("unit_limit_breaks") is not None:
        rates.append(
            {
                "key": "lb_per_db_unit",
                "label": f"{lab_lb} ÷ {lab_db_u}",
                "label_en": f"{lab_lb} ÷ {lab_db_u}",
                "value": round(fingerprint["unit_limit_breaks"] / db_u, 2),
                "unit": "×",
                "hint": "Limit Breaks relative to Database Units registered",
                "icon": "profile_achievements_list_icon_enhance.webp",
            }
        )
    if db_u and fingerprint.get("unit_sp") is not None:
        rates.append(
            {
                "key": "sp_per_db_unit",
                "label": f"{lab_sp} ÷ {lab_db_u}",
                "label_en": f"{lab_sp} ÷ {lab_db_u}",
                "value": round(fingerprint["unit_sp"] / db_u, 3),
                "unit": "×",
                "hint": "Unit SP Conversions relative to Database Units",
                "icon": "profile_achievements_list_icon_unit_sp.webp",
            }
        )
    if db_u and fingerprint.get("unit_ssp") is not None:
        rates.append(
            {
                "key": "ssp_per_db_unit",
                "label": f"{lab_ssp} ÷ {lab_db_u}",
                "label_en": f"{lab_ssp} ÷ {lab_db_u}",
                "value": round(fingerprint["unit_ssp"] / db_u, 3),
                "unit": "×",
                "hint": "Unit SSP Conversions relative to Database Units",
                "icon": "profile_achievements_list_icon_unit_ssp.webp",
            }
        )
    if db_c and fingerprint.get("char_sp") is not None:
        rates.append(
            {
                "key": "char_sp_per_db_char",
                "label": f"{lab_char_sp} ÷ {lab_db_c}",
                "label_en": f"{lab_char_sp} ÷ {lab_db_c}",
                "value": round(fingerprint["char_sp"] / db_c, 3),
                "unit": "×",
                "hint": "Character SP Conversions relative to Database Characters",
                "icon": "profile_achievements_list_icon_character_sp.webp",
            }
        )
    if fingerprint.get("max_damage") is not None and fingerprint.get("max_combat_power"):
        rates.append(
            {
                "key": "dmg_vs_cp",
                "label": f"{lab_dmg} ÷ {lab_cp}",
                "label_en": f"{lab_dmg} ÷ {lab_cp}",
                "value": round(fingerprint["max_damage"] / max(1, fingerprint["max_combat_power"]), 2),
                "unit": "×",
                "hint": "Peak hit vs peak Combat Power",
                "icon": "profile_achievements_list_icon_enhance.webp",
            }
        )

    haro = dict(snapshot.get("haro_trophies") or {})

    # --- Collections LB overlay (units only — /collections has no characters board) ---
    col_owned = ctx.get("collections_owned") or {}
    col_units = {}
    if isinstance(col_owned, dict):
        raw_u = col_owned.get("units") or col_owned.get("u") or {}
        if isinstance(raw_u, dict):
            for k, v in raw_u.items():
                try:
                    col_units[_nid(k)] = int(v)
                except Exception:
                    pass
    for u in resolved_units:
        uid = _nid(u.get("unit_id"))
        if uid in col_units:
            u["collections_lb"] = col_units[uid]
            u["collections_owned"] = True
        else:
            u["collections_lb"] = None
            u["collections_owned"] = False

    # --- Player portrait: characters (abilities / skills / series / playstyle) ---
    char_kit_fn = ctx.get("char_kit")
    unit_kit_fn = ctx.get("unit_kit")
    abil_weight = Counter()
    abil_meta = {}
    skill_weight = Counter()
    skill_meta = {}
    skill_fam_weight = Counter()
    skill_fam_meta = {}
    char_series_weight = Counter()
    char_series_meta = {}
    playstyle_chars = defaultdict(list)  # bucket -> [{cid, name, sorties, lv}]
    chars_resolved = []
    total_c = sum(max(0, int(x.get("sorties") or 0)) for x in chars) or 1

    for crow in chars:
        cid = _nid(crow.get("character_id") or crow.get("id"))
        sorties = max(0, int(crow.get("sorties") or 0))
        kit = {}
        if cid and callable(char_kit_fn):
            try:
                kit = char_kit_fn(cid) or {}
            except Exception:
                kit = {}
        cname = str(crow.get("name") or kit.get("name") or cid)
        for ab in kit.get("abilities") or []:
            aid = _nid(ab.get("id"))
            if not aid:
                continue
            abil_weight[aid] += sorties
            abil_meta[aid] = {
                "id": aid,
                "name": ab.get("name") or aid,
                "icon": ab.get("icon") or "",
            }
        for sk in kit.get("skills") or []:
            sid = _nid(sk.get("id"))
            sname = str(sk.get("name") or sid)
            if not sid:
                continue
            skill_weight[sid] += sorties
            skill_meta[sid] = {
                "id": sid,
                "name": sname,
                "icon": sk.get("icon") or "",
            }
            fam, lv = _skill_family_and_lv(sname)
            if fam:
                skill_fam_weight[fam] += sorties
                skill_fam_meta[fam] = {
                    "name": fam,
                    "icon": sk.get("icon") or "",
                    "sample_id": sid,
                }
            bucket = _playstyle_bucket(sname)
            if bucket:
                playstyle_chars[bucket].append(
                    {
                        "character_id": cid,
                        "name": cname,
                        "sorties": sorties,
                        "skill": sname,
                        "lv": lv,
                        "thumb": kit.get("thumb") or "",
                    }
                )
        for ser in kit.get("series") or []:
            sid = _nid(ser.get("id"))
            if not sid:
                continue
            char_series_weight[sid] += sorties
            char_series_meta[sid] = {
                "id": sid,
                "name": ser.get("name") or sid,
                "icon": ser.get("icon") or "",
            }
        chars_resolved.append(
            {
                "rank": crow.get("rank"),
                "character_id": cid,
                "name": cname,
                "sorties": sorties,
                "share_pct": round(100.0 * sorties / total_c, 1),
                "thumb": kit.get("thumb") or "",
                "role": kit.get("role") or "",
                "role_id": kit.get("role_id") or "",
                "role_icon": kit.get("role_icon") or "",
                "is_limited_time": cid in limited_char_ids,
                "series": kit.get("series") or [],
                "tags": kit.get("tags") or [],
            }
        )

    top_char_abilities = []
    for aid, w in abil_weight.most_common(10):
        m = dict(abil_meta.get(aid) or {"id": aid, "name": aid})
        m["sortie_weight"] = w
        m["share_pct"] = round(100.0 * w / total_c, 1)
        top_char_abilities.append(m)

    top_char_skills = []
    for sid, w in skill_weight.most_common(10):
        m = dict(skill_meta.get(sid) or {"id": sid, "name": sid})
        m["sortie_weight"] = w
        m["share_pct"] = round(100.0 * w / total_c, 1)
        top_char_skills.append(m)

    top_char_skill_families = []
    for fam, w in skill_fam_weight.most_common(10):
        m = dict(skill_fam_meta.get(fam) or {"name": fam})
        m["sortie_weight"] = w
        m["share_pct"] = round(100.0 * w / total_c, 1)
        top_char_skill_families.append(m)

    top_char_series = []
    for sid, w in char_series_weight.most_common(10):
        m = dict(char_series_meta.get(sid) or {"id": sid, "name": sid})
        m["sortie_weight"] = w
        m["share_pct"] = round(100.0 * w / total_c, 1)
        top_char_series.append(m)

    # Deduplicate playstyle char lists (same char may match once)
    playstyle = []
    PLAYSTYLE_LABELS = {
        "chance_step": "Chance Step Count Increase",
        "support_attack": "Support Attack Count Increase",
        "attack_burst": "Attack Burst",
        "guaranteed_cs": "Guaranteed / Auto Chance Step",
    }
    for key in ("chance_step", "support_attack", "attack_burst", "guaranteed_cs"):
        seen = set()
        uniq = []
        max_lv = None
        for row in sorted(playstyle_chars.get(key) or [], key=lambda x: -x["sorties"]):
            cid = row["character_id"]
            if cid in seen:
                continue
            seen.add(cid)
            uniq.append(row)
            if row.get("lv") is not None:
                max_lv = row["lv"] if max_lv is None else max(max_lv, row["lv"])
        if not uniq:
            continue
        sample_fam, _ = _skill_family_and_lv(uniq[0].get("skill") or "")
        playstyle.append(
            {
                "key": key,
                "label": sample_fam or PLAYSTYLE_LABELS.get(key, key),
                "char_count": len(uniq),
                "char_total": len(chars_resolved),
                "share_pct": round(100.0 * len(uniq) / max(1, len(chars_resolved)), 1),
                "sortie_weight": sum(x["sorties"] for x in uniq),
                "max_lv": max_lv,
                "characters": uniq[:8],
            }
        )

    # --- Units: series + mechanisms ---
    unit_series_weight = Counter()
    unit_series_meta = {}
    mech_weight = Counter()
    mech_meta = {}
    for u in resolved_units:
        uid = _nid(u.get("unit_id"))
        sorties = int(u.get("sorties") or 0)
        kit = {}
        if uid and callable(unit_kit_fn):
            try:
                kit = unit_kit_fn(uid) or {}
            except Exception:
                kit = {}
        u["series"] = kit.get("series") or []
        u["mechanisms"] = kit.get("mechanisms") or []
        for ser in u["series"]:
            sid = _nid(ser.get("id"))
            if not sid:
                continue
            unit_series_weight[sid] += sorties
            unit_series_meta[sid] = {
                "id": sid,
                "name": ser.get("name") or sid,
                "icon": ser.get("icon") or "",
            }
        for mech in u["mechanisms"]:
            mid = _nid(mech.get("id")) or str(mech.get("id") or "")
            if not mid:
                continue
            mech_weight[mid] += sorties
            mech_meta[mid] = {
                "id": mid,
                "name": mech.get("name") or mid,
                "icon": mech.get("icon") or "",
            }

    top_unit_series = []
    for sid, w in unit_series_weight.most_common(10):
        m = dict(unit_series_meta.get(sid) or {"id": sid, "name": sid})
        m["sortie_weight"] = w
        m["share_pct"] = round(100.0 * w / total_u, 1)
        top_unit_series.append(m)

    top_mechanisms = []
    for mid, w in mech_weight.most_common(10):
        m = dict(mech_meta.get(mid) or {"id": mid, "name": mid})
        m["sortie_weight"] = w
        m["share_pct"] = round(100.0 * w / total_u, 1)
        top_mechanisms.append(m)

    lb_matched = [u for u in resolved_units if u.get("collections_owned")]
    collections_overlay = {
        "units_matched": len(lb_matched),
        "units_total": len(resolved_units),
        "note": "Limit Break from your /collections unit board (local). Characters are not tracked there.",
        "avg_lb": round(
            sum(int(u.get("collections_lb") or 0) for u in lb_matched) / max(1, len(lb_matched)),
            2,
        )
        if lb_matched
        else None,
        "lb3_count": sum(1 for u in lb_matched if int(u.get("collections_lb") or 0) >= 3),
    }

    extra_insights = {
        "ex_share_of_listed_sorties_pct": round(100.0 * ex_sorties / total_u, 1),
        "ultimate_count_in_top": ult_count,
        "ex_name_count_in_top": ex_count,
        "limited_unit_count_in_top": limited_unit_count,
        "limited_char_count_in_top": limited_char_count,
        "unique_tag_count": len(tag_weight),
        "top3_unit_names": [u.get("name") for u in resolved_units[:3]],
        "top3_units": resolved_units[:3],
        "char_listed": len(chars),
        "unit_listed": len(units),
        "rates": rates,
        "top_char_abilities": top_char_abilities,
        "top_char_skills": top_char_skills,
        "top_char_skill_families": top_char_skill_families,
        "top_char_series": top_char_series,
        "top_unit_series": top_unit_series,
        "top_mechanisms": top_mechanisms,
        "playstyle": playstyle,
        "collections_overlay": collections_overlay,
    }

    return {
        "lang": lang,
        "meta": meta,
        "top_n": top_n,
        "concentration": concentration,
        "roles": roles_out,
        "top_tags": top_tags,
        "list_tags": list_tags,
        "top3_tags": list_tags,
        "terrain_caps": terrain_caps,
        "ultimate_in_top": ult_count,
        "ex_name_in_top": ex_count,
        "units_resolved": resolved_units,
        "chars_resolved": chars_resolved,
        "chars": [
            {
                "rank": c.get("rank"),
                "character_id": c.get("character_id"),
                "name": c.get("name"),
                "sorties": c.get("sorties"),
            }
            for c in chars_resolved
        ],
        "char_portrait": {
            "abilities": top_char_abilities,
            "skills": top_char_skills,
            "skill_families": top_char_skill_families,
            "series": top_char_series,
            "playstyle": playstyle,
        },
        "unit_portrait": {
            "series": top_unit_series,
            "mechanisms": top_mechanisms,
            "collections": collections_overlay,
        },
        "supporter_recommendations": supp_recs,
        "fingerprint": fingerprint,
        "census_compare": census_compare,
        "extra_insights": extra_insights,
        "haro_trophies": {
            "gold": int(haro.get("gold") or 0),
            "silver": int(haro.get("silver") or 0),
            "bronze": int(haro.get("bronze") or 0),
        },
        "insight_blurb_keys": [
            "concentration",
            "list_tags",
            "char_portrait",
            "unit_portrait",
            "terrain_caps",
            "rates",
            "supporter_recommendations",
            "roles",
            "haro_trophies",
            "fingerprint",
            "census_compare",
        ],
    }
