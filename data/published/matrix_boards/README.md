# Matrix boards (`/tm` `/dm`)

Precomputed API payloads for Tag Matrix and Debuff Matrix.

- Build: `python scripts/build_matrix_boards.py` (local Flask must be running)
- Served by `/api/tag_matrix` and `/api/debuff_matrix` on cache miss
- Same JSON + CDN image URLs as a live rebuild — look/features unchanged
- No Railway volume; files commit with the app. Browser download size unchanged (gzip JSON)
- **Parity gate:** the build script compares entity ID sets across EN/JA/TW/HK and
  retries / refuses to write if one locale is short (prevents shipping a stale EN board)

Rebuild after MasterData / classifier changes that affect these boards.
