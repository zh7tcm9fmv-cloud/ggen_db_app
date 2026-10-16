# -*- coding: utf-8 -*-
"""Sorties OCR from RapidOCR bounding boxes (not equal-split Y guess).

Anchors the list to real kit detections:
  - Prefer text containing (EX)/(SP)
  - Or rank-prefixed kit lines (``2 Hi-Nu…``)
  - Digits on the right half are Sorties
  - Ignore everything above the Units/Characters header (player name, chrome)

Stdout JSON: {ok, engine, rows, text}

Usage:
  .venv-paddle\\Scripts\\python.exe scripts/profile_sorties_box_ocr.py <image>
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from profile_insights import (  # noqa: E402
    _fix_glued_row_sorties,
    recover_glued_sorties_count,
)


_HEADER_RE = re.compile(
    r"(?i)^(sorties|units?|characters?|出撃|出擊|ユニット|キャラ|機體|單位)$"
)
_JUNK_RE = re.compile(
    r"(?i)^(profile|player|rank|database|achievements?|favorites?|share|"
    r"haro|trophy|battle|results|en|jp|tw|hk|簡介|成就)$"
)
_KIT_RE = re.compile(r"\(EX\)|\(SP\)|（EX）|（SP）", re.I)
_NUM_RE = re.compile(r"^(\d{1,3}(?:,\d{3})+|\d{3,7})$")
_RANK_NAME_RE = re.compile(
    r"^(\d{1,2})(?:[\.\)\s：:\-]+|\s*)([A-Za-z\u3040-\u9fff(].+)$"
)


def _box_meta(box, text: str, score) -> dict:
    xs = [float(p[0]) for p in box]
    ys = [float(p[1]) for p in box]
    return {
        "text": str(text or "").strip(),
        "score": float(score) if score is not None else 0.0,
        "x0": min(xs),
        "x1": max(xs),
        "y0": min(ys),
        "y1": max(ys),
        "cx": (min(xs) + max(xs)) / 2.0,
        "cy": (min(ys) + max(ys)) / 2.0,
    }


def _parse_num(s: str) -> int | None:
    s = (s or "").strip()
    if not _NUM_RE.match(s):
        # glued tails may include junk: "2,828." / "Mo2lB83"
        m = re.search(r"(\d{1,3}(?:,\d{3})+|\d{3,7})", s)
        if not m:
            return None
        s = m.group(1)
    try:
        n = int(s.replace(",", ""))
    except Exception:
        return None
    if 80 <= n <= 500000:
        return n
    return None


def _clean_kit_name(s: str) -> str:
    s = re.sub(r"^\d{1,2}[\.\)\s：:\-]*", "", s or "").strip()
    s = re.sub(r"\s+", " ", s)
    if re.search(r"unicorn|jnicorn|unicom|ユニコーン|獨角獸|独角兽", s, flags=re.I):
        if re.search(r"destroy|デストロイ|毀滅|破壞", s, flags=re.I):
            return "Unicorn Gundam (Destroy Mode / Awakened) (EX)"
    return s


def _is_kit_text(t: str) -> bool:
    t = (t or "").strip()
    if not t or len(t) < 3:
        return False
    if _HEADER_RE.match(t) or _JUNK_RE.match(t):
        return False
    if _KIT_RE.search(t):
        return True
    if _RANK_NAME_RE.match(t) and re.search(r"[A-Za-z\u3040-\u9fff]{3,}", t):
        return True
    # Character lists: no (EX) — need letters + not a pure number
    if _NUM_RE.match(t):
        return False
    if re.search(r"[A-Za-z\u3040-\u9fff]{4,}", t) and not re.search(
        r"(?i)stage|league|trophy|profile|database|completion|rank", t
    ):
        # Prefer when it looks like a person/unit name line
        return bool(re.search(r"[A-Za-z]", t)) and len(t) >= 5
    return False


def rows_from_rapidocr_items(items: list[dict], img_w: float) -> list[dict]:
    """Build screen-order Sorties rows from RapidOCR box items."""
    if not items:
        return []
    # Anchor: below Units/Characters/Sorties header when present
    header_y = None
    for it in items:
        if _HEADER_RE.match(it["text"]):
            header_y = max(header_y or 0.0, it["y1"])
    # First kit box — definitive list start (beats username above)
    kit_cands = [it for it in items if _KIT_RE.search(it["text"]) or _RANK_NAME_RE.match(it["text"])]
    if kit_cands:
        first_kit_y = min(it["y0"] for it in kit_cands)
        list_top = first_kit_y - 8.0
        if header_y is not None:
            list_top = max(list_top, header_y)
    elif header_y is not None:
        list_top = header_y
    else:
        list_top = 0.0

    mid_x = img_w * 0.55
    names: list[dict] = []
    nums: list[dict] = []
    for it in items:
        if it["y1"] < list_top:
            continue  # username / chrome above list
        t = it["text"]
        if _HEADER_RE.match(t) or _JUNK_RE.match(t):
            continue
        n = _parse_num(t)
        # Pure Sorties digit on the right
        if n is not None and it["cx"] >= mid_x and not _KIT_RE.search(t):
            nums.append({**it, "sorties": n})
            continue
        if _is_kit_text(t):
            names.append(it)

    names.sort(key=lambda x: x["cy"])
    nums.sort(key=lambda x: x["cy"])

    used_num: set[int] = set()
    rows: list[dict] = []
    for i, nm in enumerate(names[:12]):
        raw = nm["text"]
        name = _clean_kit_name(raw)
        sorties = None
        # Glued long name may include digits in the same box
        if re.search(r"unicorn.*destroy|destroy\s*mo\S*\d", raw, flags=re.I):
            sorties = recover_glued_sorties_count(raw)
        if sorties is None:
            sorties = _parse_num(raw) if not _KIT_RE.search(raw) else None
        # Nearest right-column digit by Y
        if sorties is None or sorties < 80:
            best_j = None
            best_d = 1e9
            for j, nu in enumerate(nums):
                if j in used_num:
                    continue
                d = abs(nu["cy"] - nm["cy"])
                if d < best_d and d < max(40.0, (nm["y1"] - nm["y0"]) * 1.2):
                    best_d = d
                    best_j = j
            if best_j is not None:
                used_num.add(best_j)
                sorties = nums[best_j]["sorties"]
        rows.append(
            {
                "rank": i + 1,
                "name": name,
                "sorties": int(sorties or 0),
                "ocr_raw": raw,
                "role_id": None,
            }
        )

    # Neighbor Unicorn repair
    for idx, row in enumerate(rows):
        raw = str(row.get("ocr_raw") or "")
        if not re.search(r"unicorn|jnicorn|unicom|ユニコーン|獨角獸", raw, flags=re.I):
            continue
        prev_s = int(rows[idx - 1]["sorties"]) if idx > 0 else None
        next_s = int(rows[idx + 1]["sorties"]) if idx + 1 < len(rows) else None
        n = recover_glued_sorties_count(raw, prev_s, next_s)
        if n and 80 <= n <= 500000:
            row["sorties"] = n
        row["name"] = "Unicorn Gundam (Destroy Mode / Awakened) (EX)"

    rows = _fix_glued_row_sorties(rows)
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows[:10]


def run(path: Path) -> dict:
    from rapidocr_onnxruntime import RapidOCR
    import cv2
    import numpy as np

    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError("decode_fail")
    h, w = img.shape[:2]
    if w > 900:
        scale = 720 / float(w)
        img = cv2.resize(img, (720, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
        # write temp for OCR at scaled size
        ok, buf = cv2.imencode(".png", img)
        if not ok:
            raise RuntimeError("encode_fail")
        import tempfile

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        tmp.write(buf.tobytes())
        tmp.close()
        ocr_path = tmp.name
    else:
        ocr_path = str(path)

    engine = RapidOCR()
    result, _ = engine(ocr_path)
    if ocr_path != str(path):
        try:
            Path(ocr_path).unlink()
        except Exception:
            pass

    items = []
    for item in result or []:
        if len(item) < 2:
            continue
        box, text = item[0], item[1]
        score = item[2] if len(item) > 2 else 0.0
        if not text:
            continue
        items.append(_box_meta(box, text, score))

    rows = rows_from_rapidocr_items(items, float(w))
    text = "\n".join(
        f"{r['rank']} {r['name']} {r['sorties']}".strip() for r in rows
    )
    return {
        "ok": True,
        "engine": "rapidocr_boxes",
        "n": len(rows),
        "rows": rows,
        "text": text,
        "detections": len(items),
        "first_kit": next(
            (it["text"] for it in items if _KIT_RE.search(it["text"])),
            None,
        ),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: profile_sorties_box_ocr.py <image>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print(json.dumps({"ok": False, "error": "missing"}))
        return 2
    try:
        out = run(path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:300]}))
        return 1
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("n", 0) >= 5 else 1


if __name__ == "__main__":
    raise SystemExit(main())
