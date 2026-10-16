# -*- coding: utf-8 -*-
"""Column-aware Sorties OCR (fixed UI layout → RapidOCR).

Assumes Profile → Sorties list screenshots share the same relative layout:
  [thumb] [role icon] [rank] [white name…] [cyan Sorties]

Does NOT OCR the whole frame as one blob. Per row:
  1) Detect row Y from bright-text projection (falls back to equal split)
  2) Crop name band + digit band separately
  3) Optional white/cyan mask for digits
  4) Role from hue in the role-icon column (not OCR)
  5) Special rules for long Unicorn rows (name overlaps Sorties)

Stdout: JSON
  {"ok": true, "engine": "rapidocr_columns", "rows": [...], "text": "..."}

Usage:
  .venv-paddle\\Scripts\\python.exe scripts/profile_sorties_column_ocr.py <image> [n_rows]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from profile_insights import (  # noqa: E402
    _fix_glued_row_sorties,
    recover_glued_sorties_count,
)


def _load_bgr(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"decode_fail:{path}")
    return img


def _detect_row_starts(img: np.ndarray, n: int = 10) -> list[int]:
    """Y positions where list-row text begins (bright glyphs in name column)."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Name column (skip thumbs / left chrome)
    x0, x1 = int(w * 0.22), int(w * 0.72)
    bright = (gray[:, x0:x1] > 160).astype(np.uint8)
    proj = bright.sum(axis=1).astype(np.float64)
    k = max(9, h // 80)
    sm = np.convolve(proj, np.ones(k) / k, mode="same")
    y0, y1 = int(h * 0.08), int(h * 0.96)
    seg = sm[y0:y1]
    thr = float(seg.max()) * 0.15 if seg.max() > 0 else 1.0
    starts: list[int] = []
    in_gap = True
    for i, v in enumerate(seg):
        y = y0 + i
        if in_gap and v > thr:
            starts.append(y)
            in_gap = False
        elif (not in_gap) and v < thr * 0.45:
            in_gap = True
    # Keep first n; if too few, equal-split fallback
    if len(starts) >= n:
        return starts[:n]
    top = int(h * 0.12)
    bot = int(h * 0.94)
    span = max(1, bot - top)
    return [top + int(span * i / n) for i in range(n)]


def _row_bounds(starts: list[int], h: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for i, ya in enumerate(starts):
        if i + 1 < len(starts):
            yb = starts[i + 1]
        else:
            step = starts[-1] - starts[-2] if len(starts) >= 2 else h // 12
            yb = min(h, ya + step)
        out.append((max(0, ya - 3), min(h, yb - 1)))
    return out


def _white_cyan_mask(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    white = cv2.inRange(hsv, (0, 0, 165), (180, 70, 255))
    cyan = cv2.inRange(hsv, (75, 15, 130), (115, 255, 255))
    m = cv2.bitwise_or(white, cyan)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, k, iterations=1)


def _ocr_canvas(mask: np.ndarray, scale: float) -> np.ndarray:
    inv = cv2.bitwise_not(mask)
    inv = cv2.resize(
        inv,
        (max(1, int(inv.shape[1] * scale)), max(1, int(inv.shape[0] * scale))),
        interpolation=cv2.INTER_CUBIC,
    )
    return cv2.cvtColor(inv, cv2.COLOR_GRAY2BGR)


def _ocr_text(engine, bgr: np.ndarray) -> str:
    try:
        result, _ = engine(bgr)
    except Exception:
        return ""
    if not result:
        return ""
    return " ".join(str(item[1]) for item in result if len(item) >= 2 and item[1]).strip()


def _parse_sortie_num(s: str) -> int | None:
    best = None
    for m in re.finditer(r"\d{1,3}(?:,\d{3})+|\d{3,7}", s or ""):
        try:
            n = int(m.group(0).replace(",", ""))
        except Exception:
            continue
        if 80 <= n <= 500000:
            if best is None or (n >= 1000 and n > (best or 0)):
                best = n
            elif best is None or best < 100:
                best = n
    return best


def _clean_name(s: str) -> str:
    s = re.sub(r"^\d{1,2}[\.\)\s：:\-]+", "", s or "").strip()
    s = re.sub(r"\s+", " ", s)
    # Strip trailing weak digits that belong to Sorties column
    s = re.sub(r"\s+\d{1,3}(?:,\d{3})?\s*$", "", s).strip()
    return s


def _role_id_from_roi(row_bgr: np.ndarray) -> str | None:
    """Sample role-icon column hue → RoleTypeIndex (1 Attack / 2 Durability / 3 Support).

    Strict saturation — navy list chrome is blue and must NOT become Durability.
    """
    h, w = row_bgr.shape[:2]
    # Role diamond sits just left of the name, after the thumb (~18–28% on phone UI)
    x0 = int(w * 0.18)
    x1 = max(x0 + 4, int(w * 0.28))
    y0 = int(h * 0.15)
    y1 = max(y0 + 2, int(h * 0.85))
    roi = row_bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return None
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)
    # Bright saturated icon pixels only (not navy panels)
    mask = (S > 140) & (V > 110)
    if int(mask.sum()) < 12:
        return None
    hue = float(np.median(H[mask].astype(np.float64))) * 2.0
    sat = float(np.median(S[mask].astype(np.float64))) / 255.0
    val = float(np.median(V[mask].astype(np.float64))) / 255.0
    if sat < 0.45 or val < 0.35:
        return None
    if hue < 28 or hue >= 340:
        return "1"  # red → Attack
    if 28 <= hue < 78:
        return "3"  # yellow → Support
    if 175 <= hue < 265:
        return "2"  # blue → Durability
    return None


def _unicorn_special(name: str, dig_txt: str, sorties: int | None, prev_s: int | None, next_s: int | None) -> tuple[str, int]:
    """Long Unicorn row: force Awakened title + recover count via glue/neighbors."""
    raw = f"{name} {dig_txt}"
    # OCR often reads Unicorn as Jnicorn / Unicom on this UI font
    is_uni = bool(
        re.search(
            r"unicorn|jnicorn|unicom|[uj]nicorn|ユニコーン|獨角獸|独角兽",
            raw,
            flags=re.I,
        )
    )
    is_destroy = bool(re.search(r"destroy|デストロイ|毀滅|破壞", raw, flags=re.I))
    glued = bool(
        re.search(r"destroy\s*mo\S*\d|mo\d|mode\d|モ\d", raw, flags=re.I)
        or re.search(r"2\D{0,3}383|2383", dig_txt or "", flags=re.I)
    )
    if not (is_uni and (is_destroy or glued)):
        return name, int(sorties or 0)
    # Name column truncated into Sorties → treat as Awakened (longer title)
    clean = "Unicorn Gundam (Destroy Mode / Awakened) (EX)"
    n = recover_glued_sorties_count(raw, prev_s, next_s)
    if not n or n < 80:
        n = int(sorties or 0)
    if (not n or n < 80) and prev_s and next_s and prev_s > next_s:
        if next_s < 2383 < prev_s:
            n = 2383
        else:
            n = (prev_s + next_s) // 2
    return clean, int(n or 0)


def run_column_ocr(path: Path, n_rows: int = 10) -> dict:
    from rapidocr_onnxruntime import RapidOCR

    img = _load_bgr(path)
    h, w = img.shape[:2]
    # Phone screenshots are often 2–3× wider than the fixture — downscale first or
    # RapidOCR does ~40 passes and the UI looks "stuck" for minutes.
    max_w = 720
    if w > max_w:
        scale = max_w / float(w)
        img = cv2.resize(
            img,
            (max_w, max(1, int(h * scale))),
            interpolation=cv2.INTER_AREA,
        )
        h, w = img.shape[:2]
    starts = _detect_row_starts(img, n_rows)
    bounds = _row_bounds(starts, h)
    engine = RapidOCR()

    provisional: list[dict] = []
    text_lines: list[str] = []

    for i, (ya, yb) in enumerate(bounds):
        row = img[ya:yb, :]
        # Full-width row for role sample; name/digit use content columns
        name_bgr = img[ya:yb, int(w * 0.22) : int(w * 0.70)]
        dig_bgr = img[ya:yb, int(w * 0.68) : int(w * 0.98)]

        # Fast path: 2 OCR calls/row. Mask only when digits fail (Unicorn glue).
        raw_name = _ocr_text(engine, name_bgr)
        raw_dig = _ocr_text(engine, dig_bgr)
        name = _clean_name(raw_name)
        dig_txt = raw_dig
        sorties = _parse_sortie_num(dig_txt)
        if sorties is None or sorties < 80:
            clean_dig = _ocr_text(engine, _ocr_canvas(_white_cyan_mask(dig_bgr), 3.0))
            if clean_dig:
                dig_txt = clean_dig
                sorties = _parse_sortie_num(dig_txt) or sorties
        if not name or len(name) < 3:
            clean_name = _ocr_text(engine, _ocr_canvas(_white_cyan_mask(name_bgr), 2.2))
            if clean_name:
                name = _clean_name(clean_name)
        # Digits sometimes leak into name OCR only
        if sorties is None:
            sorties = _parse_sortie_num(name)
            name = _clean_name(re.sub(r"\d{1,3}(?:,\d{3})+|\d{3,7}", " ", name))

        role_id = _role_id_from_roi(row)
        ocr_raw = f"{raw_name} | {raw_dig}".strip(" |")
        provisional.append(
            {
                "rank": i + 1,
                "name": name,
                "sorties": int(sorties or 0),
                "ocr_raw": ocr_raw,
                "role_id": role_id,
                "_dig_txt": dig_txt,
            }
        )
        text_lines.append(f"{i+1} {name} {sorties or ''}".strip())

    # Pass 2: Unicorn special using neighbor sorties
    for idx, row in enumerate(provisional):
        prev_s = int(provisional[idx - 1]["sorties"]) if idx > 0 else None
        next_s = (
            int(provisional[idx + 1]["sorties"]) if idx + 1 < len(provisional) else None
        )
        name, sorties = _unicorn_special(
            row["name"],
            str(row.get("_dig_txt") or ""),
            row.get("sorties"),
            prev_s,
            next_s,
        )
        row["name"] = name
        row["sorties"] = sorties
        row.pop("_dig_txt", None)

    rows = [
        {
            "rank": r["rank"],
            "name": r["name"],
            "sorties": int(r["sorties"] or 0),
            "ocr_raw": r.get("ocr_raw") or r["name"],
            "role_id": r.get("role_id"),
        }
        for r in provisional
        if (r.get("name") or "").strip() or int(r.get("sorties") or 0) >= 80
    ]
    rows = _fix_glued_row_sorties(rows)
    # Re-stamp screen order ranks after realign
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    return {
        "ok": True,
        "engine": "rapidocr_columns",
        "n": len(rows),
        "rows": rows,
        "text": "\n".join(text_lines),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: profile_sorties_column_ocr.py <image> [n_rows]", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    if not path.is_file():
        print(json.dumps({"ok": False, "error": f"missing:{path}"}))
        return 2
    try:
        out = run_column_ocr(path, n)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:300]}))
        return 1
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
