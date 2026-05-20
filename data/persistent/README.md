# Banner vote persistence

Live totals are stored in `banner_pool_votes.json` (and `banner_pool_votes.json.bak`).

**Deploys:** This folder is gitignored. Do not delete it on deploy, or votes reset to zero.
Mount a persistent volume here, or set:

`GGEN_BANNER_VOTES_PATH=/absolute/path/outside/deploy/banner_pool_votes.json`

**Reset votes:** Only clear the JSON files manually when you intentionally want to reset community totals.
The app refuses to save an empty vote file over one that already has votes (no reset API in the app).
