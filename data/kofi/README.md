# Ko-fi supporter wall

Public wall JSON (names + thumbs only): `data/published/kofi_supporter_wall.json`

## Refresh from CSV exports

1. Download **Supporters** and **Subscriber** CSVs from Ko-fi (desktop).
2. Rebuild:

```bash
python scripts/build_kofi_supporter_wall.py \
  --supporters "/path/to/Supporters_*.csv" \
  --subscribers "/path/to/Subscriber_*.csv"
```

Raw CSVs are copied to `data/kofi/raw/` (gitignored — they contain emails).

## Custom thumbs

Place files under `static/images/KofiSupporters/` and map display names in
`scripts/build_kofi_supporter_wall.py` → `THUMB_FILES`.
Everyone else uses `UI_Home_Menu_Icon_Shop`. Crown goes to **Phil** (top donor).
