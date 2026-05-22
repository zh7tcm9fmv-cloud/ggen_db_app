# Banner votes — Railway setup (shutdown sync + IP lock)

## Railway variables

| Variable | Value |
|----------|--------|
| `GGEN_BANNER_VOTES_SYNC_MODE` | `shutdown` |
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | PAT with **Contents: read and write** |
| `GGEN_BANNER_VOTES_GITHUB_BRANCH` | `banner-votes-data` (not `main`) |
| `GGEN_BANNER_VOTES_GITHUB_REPO` | `zh7tcm9fmv-cloud/ggen_db_app` (optional) |
| `GGEN_VOTE_IP_SALT` | Fixed random string — **set once, never change** |

Optional: `GGEN_BANNER_VOTES_PUSH_DEBOUNCE_SEC=45` (GitHub save delay after each vote; default 45s).

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

1. Users vote on the live container (ballot keyed by hashed IP: `ip_…`).
2. **~45s after a vote**, ballots auto-save to GitHub branch `banner-votes-data` (debounced).
3. You push code to `main` → Railway redeploys.
4. Old container SIGTERM → final snapshot to `banner-votes-data` (backup).
5. New container deep-merges ballots from GitHub + bundled snapshot — your IP ballot should still be there.

If you can vote again after deploy, check Railway logs for:
- `banner_pool_votes: created GitHub branch banner-votes-data` (first boot only)
- `banner_pool_votes: GitHub snapshot (debounced, …)` after voting (~45s wait)
- `banner_pool_votes: GitHub snapshot (signal:15, …)` on deploy shutdown
- `banner_pool_votes: GitHub push failed` or `branch missing and could not be created`
- `GGEN_BANNER_VOTES_SYNC_MODE=off` (sync disabled)
- missing `GGEN_BANNER_VOTES_GITHUB_TOKEN`

Confirm the branch exists: `https://github.com/zh7tcm9fmv-cloud/ggen_db_app/tree/banner-votes-data`
The app now auto-creates that branch on first boot if the token has **Contents + Metadata (ref)** write access.

**Do not** set `GGEN_BANNER_VOTES_SYNC_MODE=off` unless you accept vote resets on deploy.
