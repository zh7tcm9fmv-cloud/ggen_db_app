# Banner votes — Railway setup (shutdown sync + IP lock)

## Railway variables

| Variable | Value |
|----------|--------|
| `GGEN_BANNER_VOTES_SYNC_MODE` | `shutdown` |
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | PAT with **Contents: read and write** |
| `GGEN_BANNER_VOTES_GITHUB_BRANCH` | `banner-votes-data` (not `main`) |
| `GGEN_BANNER_VOTES_GITHUB_REPO` | `zh7tcm9fmv-cloud/ggen_db_app` (optional) |

**Source settings:** deploy branch = **`main` only** (so vote snapshots do not retrigger deploy loops).

Logs after deploy:

```
sync_mode=shutdown
github_branch=banner-votes-data
```

## IP vote lock (active)

- One ballot per **public IP** per banner pool (not per browser / private window).
- Server reads `CF-Connecting-IP`, `X-Real-IP`, `X-Forwarded-For` (Railway).
- IP is stored as a hash (`ip_…`), not plain text.
- `client_id` / `localStorage` is **not** used for voting anymore.
- Same Wi‑Fi = same ballot (households share one IP).

## Your git workflow

```powershell
git add .
git commit -m "your update"
git push origin main
```

If push is rejected: `git pull origin main --no-edit` then push again.

## Votes on deploy

1. Users vote on the live container.
2. You push code to `main` → Railway redeploys.
3. Old container stops → one snapshot to branch `banner-votes-data`.
4. New container loads votes from GitHub + `data/published/banner_pool_votes.json`.
