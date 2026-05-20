# Banner vote persistence

## Railway keeps committing `chore: snapshot…` over and over?

That is usually a **deploy loop**:

1. Container stops → app pushes votes to GitHub  
2. GitHub commit triggers **another Railway deploy** (if your service watches that branch)  
3. New container stops → push again → repeat  

### Fix in Railway dashboard (important)

1. Open your service → **Settings** → **Source** (GitHub).  
2. Set **branch to deploy** = **`main` only** (not `banner-votes-data`, not “all branches”).  
3. Save and redeploy once.

Vote snapshots must use a **different branch** than the one that auto-deploys your site.

### Fix in Railway variables

| Variable | What to set |
|----------|-------------|
| `GGEN_BANNER_VOTES_SYNC_MODE` | `shutdown` (not `vote`) |
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | your PAT |
| `GGEN_BANNER_VOTES_GITHUB_BRANCH` | **`banner-votes-data`** (recommended — set explicitly) |
| `GGEN_BANNER_VOTES_GITHUB_BRANCH` empty | OK — on Railway it defaults to `banner-votes-data` |
| `GGEN_BANNER_VOTES_MIN_PUSH_INTERVAL_SEC` | `1800` (30 min, default) — blocks rapid repeat pushes |

**Never** set `GGEN_BANNER_VOTES_GITHUB_BRANCH` to `main`.

After deploy, logs must show:

```
github_branch=banner-votes-data
sync_mode=shutdown
```

### Stop the loop immediately

1. Set `GGEN_BANNER_VOTES_SYNC_MODE=off` → redeploy (stops all GitHub pushes).  
2. Fix deploy branch = `main` only (above).  
3. Set `GGEN_BANNER_VOTES_SYNC_MODE=shutdown` again → redeploy.  

Or leave sync `off` and use `scripts/snapshot_banner_votes.ps1` before you push code.

## Your PC — `main` without vote merge spam

Railway should only commit to **`banner-votes-data`**, not **`main`**.

```powershell
git push origin main
```

No `git pull` needed just because users voted.

One-time if old `chore` commits are still on `main`:

```powershell
git pull origin main --no-edit
git push origin main
```

## How votes survive deploy (sync on)

1. Users vote on the running container.  
2. You deploy new code from **`main`**.  
3. Old container stops → **one** snapshot to **`banner-votes-data`** (max once per 30 min by default).  
4. New container loads votes from that branch.  
