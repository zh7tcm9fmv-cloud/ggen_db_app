# -*- coding: utf-8 -*-
"""Fast fixed-box Sorties OCR (1920×1080 lanes + mosaic RapidOCR).

Owner guide (design canvas 1920×1080):
  Row 1 Y = 115..200, then +85px per row
  Sortie X = 350..445   Role icon X = 355..385   Name X = 390..700

GGen Sorties UI is portrait with **Name left / Sorties right**. Absolute
350–445 on a letterboxed phone shot lands in the black pad. We:
  1) Fit the upload onto 1920×1080 (letterbox),
  2) Apply the guide’s **Y** fractions on the content rect,
  3) Map **X** to live columns (icon / name / sortie) as fractions of content,
  4) OCR with **2** RapidOCR calls (stacked name strip + stacked digit strip).

Stdout JSON: {ok, engine, rows, text, sec}

Usage:
  .venv-paddle\\Scripts\\python.exe scripts/profile_sorties_layout_ocr.py <image>
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from profile_insights import (  # noqa: E402
    _fix_glued_row_sorties,
    recover_glued_sorties_count,
)

# Design canvas from the owner guide
DES_W, DES_H = 1920, 1080
# Guide Row 1 + step (Y)
GUIDE_Y0, GUIDE_Y1 = 115, 200
GUIDE_ROW_STEP = 85  # Row2 = 200..285, …
N_ROWS = 10

# Guide X on 1920 (used only as relative widths when needed)
GUIDE_SORTIE = (350, 445)
GUIDE_ICON = (355, 385)
GUIDE_NAME = (390, 700)

# Live GGen Sorties columns as fractions of the **letterboxed content** width
# (Name left, cyan Sorties right — measured on Units 1–10 fixture.)
FX_ICON = (0.165, 0.215)
FX_NAME = (0.185, 0.700)
FX_SORTIE = (0.705, 0.920)


def _load_bgr(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"decode_fail:{path}")
    return img


def letterbox_1920x1080(bgr: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Resize onto 1920×1080 with black bars. Returns (canvas, content_xywh)."""
    h, w = bgr.shape[:2]
    scale = min(DES_W / float(w), DES_H / float(h))
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    resized = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((DES_H, DES_W, 3), dtype=np.uint8)
    x0 = (DES_W - nw) // 2
    y0 = (DES_H - nh) // 2
    canvas[y0 : y0 + nh, x0 : x0 + nw] = resized
    return canvas, (x0, y0, nw, nh)


def _detect_row_bands(
    canvas: np.ndarray, content: tuple[int, int, int, int]
) -> list[tuple[int, int]]:
    """Find 10 list-row Y bands from bright text in the name column.

    Falls back to guide Y=115 + 85×i (scaled onto content) if detection is weak.
    """
    cx, cy, cw, ch = content
    # Name-column slice for projection
    nx0 = cx + int(round(FX_NAME[0] * cw))
    nx1 = cx + int(round(FX_NAME[1] * cw))
    gray = cv2.cvtColor(canvas[cy : cy + ch, nx0:nx1], cv2.COLOR_BGR2GRAY)
    bright = (gray > 160).astype(np.uint8)
    proj = bright.sum(axis=1).astype(np.float64)
    k = max(7, ch // 90)
    sm = np.convolve(proj, np.ones(k) / k, mode="same")
    # Prefer region below guide header zone
    y_min = int(round(GUIDE_Y0 / DES_H * ch))
    thr = float(sm[y_min:].max()) * 0.18 if sm[y_min:].max() > 0 else 1.0
    starts: list[int] = []
    in_gap = True
    for i, v in enumerate(sm):
        if i < y_min:
            continue
        if in_gap and v > thr:
            starts.append(cy + i)
            in_gap = False
        elif (not in_gap) and v < thr * 0.45:
            in_gap = True
    if len(starts) >= N_ROWS:
        starts = starts[:N_ROWS]
        bands: list[tuple[int, int]] = []
        for i, ya in enumerate(starts):
            if i + 1 < len(starts):
                yb = starts[i + 1]
            else:
                step = starts[-1] - starts[-2] if len(starts) >= 2 else int(ch / 12)
                yb = min(cy + ch, ya + step)
            bands.append((ya, yb))
        return bands
    # Fallback: equal guide lanes
    list_top = cy + int(round(GUIDE_Y0 / DES_H * ch))
    list_bot = cy + int(round((GUIDE_Y0 + N_ROWS * GUIDE_ROW_STEP) / DES_H * ch))
    list_bot = min(cy + ch, max(list_top + N_ROWS * 8, list_bot))
    span = list_bot - list_top
    return [
        (
            list_top + int(round(span * i / N_ROWS)),
            list_top + int(round(span * (i + 1) / N_ROWS)),
        )
        for i in range(N_ROWS)
    ]


def _x_frac(content: tuple[int, int, int, int], f0: float, f1: float) -> tuple[int, int]:
    cx, _cy, cw, _ch = content
    return cx + int(round(f0 * cw)), cx + int(round(f1 * cw))


def _crop(bgr: np.ndarray, x0: int, x1: int, y0: int, y1: int) -> np.ndarray:
    x0, x1 = max(0, x0), min(bgr.shape[1], max(x0 + 1, x1))
    y0, y1 = max(0, y0), min(bgr.shape[0], max(y0 + 1, y1))
    return bgr[y0:y1, x0:x1]


def _prep_name(bgr: np.ndarray) -> np.ndarray:
    """Near-white name glyphs → black on white; upscale lightly."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, m = cv2.threshold(gray, 195, 255, cv2.THRESH_BINARY)
    inv = cv2.bitwise_not(m)
    return cv2.cvtColor(
        cv2.resize(inv, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC),
        cv2.COLOR_GRAY2BGR,
    )


def _prep_sortie(bgr: np.ndarray) -> np.ndarray:
    """Cyan/white Sorties digits → black on white."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    white = cv2.inRange(hsv, (0, 0, 180), (180, 70, 255))
    cyan = cv2.inRange(hsv, (75, 20, 120), (115, 255, 255))
    m = cv2.bitwise_or(white, cyan)
    inv = cv2.bitwise_not(m)
    return cv2.cvtColor(
        cv2.resize(inv, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC),
        cv2.COLOR_GRAY2BGR,
    )


def _stack_rows(crops: list[np.ndarray], pad: int = 8) -> tuple[np.ndarray, list[tuple[int, int]]]:
    """Stack row crops into one tall strip. Returns (image, [(y0,y1), ...] per row)."""
    if not crops:
        blank = np.full((32, 32, 3), 255, dtype=np.uint8)
        return blank, [(0, 32)]
    tw = max(c.shape[1] for c in crops)
    parts: list[np.ndarray] = []
    bands: list[tuple[int, int]] = []
    y = 0
    for c in crops:
        if c.shape[1] < tw:
            c = cv2.copyMakeBorder(
                c, 0, 0, 0, tw - c.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255)
            )
        parts.append(c)
        bands.append((y, y + c.shape[0]))
        y += c.shape[0]
        parts.append(np.full((pad, tw, 3), 255, dtype=np.uint8))
        y += pad
    # drop trailing pad
    if parts:
        parts = parts[:-1]
        y -= pad
    return np.vstack(parts), bands


def _ocr(engine, bgr: np.ndarray) -> list[tuple[float, str]]:
    """Return [(cy, text), ...] from RapidOCR boxes."""
    try:
        result, _ = engine(bgr)
    except Exception:
        return []
    out: list[tuple[float, str]] = []
    for item in result or []:
        if len(item) < 2 or not item[1]:
            continue
        box, text = item[0], str(item[1]).strip()
        ys = [float(p[1]) for p in box]
        out.append(((min(ys) + max(ys)) * 0.5, text))
    out.sort(key=lambda x: x[0])
    return out


def _assign_by_bands(
    detections: list[tuple[float, str]], bands: list[tuple[int, int]]
) -> list[str]:
    """Map detections into exact mosaic row bands (no equal-split drift)."""
    slots = [""] * len(bands)
    for cy, text in detections:
        best_i = None
        best_d = 1e9
        for i, (y0, y1) in enumerate(bands):
            mid = (y0 + y1) * 0.5
            d = abs(cy - mid)
            if y0 - 4 <= cy <= y1 + 4 and d < best_d:
                best_d = d
                best_i = i
        if best_i is None:
            # nearest band center
            for i, (y0, y1) in enumerate(bands):
                mid = (y0 + y1) * 0.5
                d = abs(cy - mid)
                if d < best_d:
                    best_d = d
                    best_i = i
        if best_i is None:
            continue
        if not slots[best_i] or len(text) > len(slots[best_i]):
            slots[best_i] = text
    return slots


def _parse_num(s: str) -> int | None:
    best = None
    for m in re.finditer(r"\d{1,3}(?:,\d{3})+|\d{3,7}", s or ""):
        try:
            n = int(m.group(0).replace(",", ""))
        except Exception:
            continue
        if 80 <= n <= 500000:
            best = n if best is None else max(best, n)
    return best


def _clean_name(s: str) -> str:
    s = re.sub(r"^\d{1,2}[\.\)\s：:\-]*", "", s or "").strip()
    s = re.sub(r"\s+", " ", s)
    if re.search(r"unicorn|jnicorn|unicom|[uj]nicorn|ユニコーン|獨角獸|独角兽", s, flags=re.I):
        if re.search(r"destroy|デストロイ|毀滅|破壞|mo\d|mode", s, flags=re.I):
            return "Unicorn Gundam (Destroy Mode / Awakened) (EX)"
    return s


def role_from_icon(bgr: np.ndarray) -> str | None:
    """Red=Attack(1), Yellow=Support(3), Blue=Durability(2). No OCR."""
    if bgr is None or bgr.size == 0:
        return None
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)
    mask = (S > 110) & (V > 90)
    if int(mask.sum()) < 8:
        return None
    hue = float(np.median(H[mask])) * 2.0  # 0–360
    sat = float(np.median(S[mask])) / 255.0
    if sat < 0.40:
        return None
    if hue < 28 or hue >= 340:
        return "1"  # Red → Attack
    if 28 <= hue < 75:
        return "3"  # Yellow → Support
    if 175 <= hue < 265:
        return "2"  # Blue → Durability
    return None


def run_layout_ocr(path: Path) -> dict:
    from rapidocr_onnxruntime import RapidOCR

    t0 = time.time()
    raw = _load_bgr(path)
    canvas, content = letterbox_1920x1080(raw)

    name_crops: list[np.ndarray] = []
    dig_crops: list[np.ndarray] = []
    icons: list[np.ndarray] = []
    bands = _detect_row_bands(canvas, content)

    for y0, y1 in bands:
        ix0, ix1 = _x_frac(content, *FX_ICON)
        nx0, nx1 = _x_frac(content, *FX_NAME)
        sx0, sx1 = _x_frac(content, *FX_SORTIE)
        icons.append(_crop(canvas, ix0, ix1, y0, y1))
        name_crops.append(_prep_name(_crop(canvas, nx0, nx1, y0, y1)))
        dig_crops.append(_prep_sortie(_crop(canvas, sx0, sx1, y0, y1)))

    name_strip, name_bands = _stack_rows(name_crops)
    dig_strip, dig_bands = _stack_rows(dig_crops)

    engine = RapidOCR()
    name_det = _ocr(engine, name_strip)
    dig_det = _ocr(engine, dig_strip)
    names = _assign_by_bands(name_det, name_bands)
    digs = _assign_by_bands(dig_det, dig_bands)
    n = len(bands)

    provisional: list[dict] = []
    for i in range(n):
        raw_name = names[i] if i < len(names) else ""
        dig_txt = digs[i] if i < len(digs) else ""
        name = _clean_name(raw_name)
        sorties = _parse_num(dig_txt)
        if sorties is None:
            sorties = _parse_num(raw_name)
            name = _clean_name(re.sub(r"\d{1,3}(?:,\d{3})+|\d{3,7}", " ", name))
        role_id = role_from_icon(icons[i]) if i < len(icons) else None
        provisional.append(
            {
                "rank": i + 1,
                "name": name,
                "sorties": int(sorties or 0),
                "ocr_raw": f"{raw_name} | {dig_txt}".strip(" |"),
                "role_id": role_id,
            }
        )

    for idx, row in enumerate(provisional):
        raw_s = str(row.get("ocr_raw") or "")
        if not re.search(r"unicorn|jnicorn|unicom|ユニコーン|獨角獸", raw_s, flags=re.I):
            continue
        prev_s = int(provisional[idx - 1]["sorties"]) if idx > 0 else None
        next_s = (
            int(provisional[idx + 1]["sorties"]) if idx + 1 < len(provisional) else None
        )
        n = recover_glued_sorties_count(raw_s, prev_s, next_s)
        if n and 80 <= n <= 500000:
            row["sorties"] = n
        row["name"] = "Unicorn Gundam (Destroy Mode / Awakened) (EX)"

    rows = _fix_glued_row_sorties(
        [
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
    )
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    sec = round(time.time() - t0, 2)
    return {
        "ok": True,
        "engine": "rapidocr_layout_fast",
        "n": len(rows),
        "rows": rows,
        "text": "\n".join(f"{r['rank']} {r['name']} {r['sorties']}" for r in rows),
        "sec": sec,
        "ocr_calls": 2,
        "canvas": {"w": DES_W, "h": DES_H, "content": content},
        "guide": {
            "y0": GUIDE_Y0,
            "row_step": GUIDE_ROW_STEP,
            "sortie_x": GUIDE_SORTIE,
            "icon_x": GUIDE_ICON,
            "name_x": GUIDE_NAME,
            "note": "Y from guide; X = GGen Name-left/Sorties-right on content",
        },
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: profile_sorties_layout_ocr.py <image>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print(json.dumps({"ok": False, "error": "missing"}))
        return 2
    try:
        out = run_layout_ocr(path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:400]}))
        return 1
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("n", 0) >= 5 else 1


if __name__ == "__main__":
    raise SystemExit(main())
