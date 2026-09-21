# Ko-fi supporter wall

Public wall JSON (names + thumbs only): `data/published/kofi_supporter_wall.json`

## Refresh from CSV exports

**Preferred:** download **Payments → Transaction_All.csv** from Ko-fi (unique people by email).
Duplicate placeholder names like “Ko-fi Supporter” become **Unknown A**, **Unknown B**, … by first gift date.

```bash
python scripts/build_kofi_supporter_wall.py \
  --transactions "/path/to/Transaction_All.csv"
```

**Legacy:** Supporters + Subscriber CSVs:

```bash
python scripts/build_kofi_supporter_wall.py \
  --supporters "/path/to/Supporters_*.csv" \
  --subscribers "/path/to/Subscriber_*.csv"
```

Raw CSVs are copied to `data/kofi/raw/` (gitignored — they contain emails). Published JSON never includes emails or amounts.

## Custom thumbs

Place files under `static/images/KofiSupporters/` and map display names in
`scripts/build_kofi_supporter_wall.py` → `THUMB_FILES`.
Everyone else uses `UI_Home_Menu_Icon_Shop`. Crown goes to the **top total** donor.
If an export lags payments, bump totals in `TOTAL_OVERRIDES` / add names in `EXTRA_SUPPORTERS`.
