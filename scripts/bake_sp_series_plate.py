"""Bake Sp_Bg@(2,2) + Sp_Frame into one plate (reference / CDN optional)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CDN_ITEM = Path(r"C:/Users/Mikew0911/Desktop/ggen_db_images/images/Item")
LOCAL_ITEM = ROOT / "static" / "images" / "Item"


def bake(bg_name: str, fr_name: str, out_name: str, offset: tuple[int, int]) -> None:
    src = CDN_ITEM if (CDN_ITEM / bg_name).is_file() else LOCAL_ITEM
    bg = Image.open(src / bg_name).convert("RGBA")
    fr = Image.open(src / fr_name).convert("RGBA")
    canvas = Image.new("RGBA", fr.size, (0, 0, 0, 0))
    canvas.paste(bg, offset, bg)
    canvas.alpha_composite(fr)
    for dest_dir in (LOCAL_ITEM, CDN_ITEM):
        dest_dir.mkdir(parents=True, exist_ok=True)
        out = dest_dir / out_name
        canvas.save(out, "WEBP", quality=95, method=6)
        print("wrote", out, canvas.size)


def main() -> None:
    bake("UI_Common_Sp_Bg.webp", "UI_Common_Sp_Frame.webp", "UI_Common_Sp_Plate.webp", (2, 2))
    bake("UI_Common_Sp_Chara_Bg.webp", "UI_Common_Sp_Chara_Frame.webp", "UI_Common_Sp_Chara_Plate.webp", (0, 0))


if __name__ == "__main__":
    main()
