# Banner vote persistence

## Keep sync ON without Vim merge hell

Railway can save votes to GitHub **without touching your `main` branch**.

| Where | What gets updated |
|-------|-------------------|
| **`main`** | Only **you** (normal `git push` from your PC) |
| **`banner-votes-data`** | Railway (one snapshot when the old container stops) |

That way `git push origin main` does not need to merge Railway’s `chore:` commits.

## Railway variables

| Variable | Value |
|----------|--------|
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | PAT with **Contents: read and write** |
| `GGEN_BANNER_VOTES_SYNC_MODE` | `shutdown` or `on` (default when token is set) |
| `GGEN_BANNER_VOTES_GITHUB_REPO` | `zh7tcm9fmv-cloud/ggen_db_app` (optional) |
| `GGEN_BANNER_VOTES_GITHUB_BRANCH` | `banner-votes-data` (optional — **default on Railway**) |

Do **not** set the branch to `main`.

After deploy, logs should show:

```
github_branch=banner-votes-data
sync_mode=shutdown
```

## Your PC — normal git (no merge from votes)

```powershell
git add .
git commit -m "your update"
git push origin main
```

You should **not** need `git pull` first just because users voted.

### One-time cleanup (old vote commits already on `main`)

If GitHub `main` still has old `chore: sync` commits, fix once:

```powershell
git pull origin main --no-edit
git push origin main
```

(`Esc` → `:wq` → `Enter` if Vim appears **one last time**.)

### Optional: never get a merge commit on pull

```powershell
git config --global pull.rebase true
```

Then `git pull` rebases instead of opening Vim for a merge message. Use this for any repo you work on alone on `main`.

## How votes survive deploy

1. Users vote → saved on the running container.
2. You push code → Railway redeploys.
3. Old container stops → **one** push to **`banner-votes-data`** on GitHub.
4. New container starts → loads votes from that branch (and the copy in git).

## Turn sync off

`GGEN_BANNER_VOTES_SYNC_MODE=off` — then commit `data/published/banner_pool_votes.json` yourself before deploy, or use `scripts/snapshot_banner_votes.ps1`.
