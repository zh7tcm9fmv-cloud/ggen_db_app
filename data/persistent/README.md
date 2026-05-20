# Banner vote persistence

Community totals are in `banner_pool_votes.json`. On **Railway free tier**, the app disk is wiped on each deploy.

## GitHub sync (default on Railway)

Votes are **not** pushed to GitHub on every user tap. That flooded the deploy queue with `chore: sync banner pool votes` commits.

**Default behaviour** (`GGEN_BANNER_VOTES_SYNC_MODE=shutdown`, automatic on Railway when a GitHub token is set):

| When | What happens |
|------|----------------|
| User votes | Fast local file only |
| Railway stops the old container (deploy/restart) | **One** snapshot commit to `data/published/banner_pool_votes.json` |
| New container starts | Loads that file from git + GitHub |

Railway variables:

| Variable | Value |
|----------|--------|
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | PAT with **Contents: read and write** |
| `GGEN_BANNER_VOTES_GITHUB_REPO` | `zh7tcm9fmv-cloud/ggen_db_app` (optional if `GITHUB_REPOSITORY` is set) |

Optional:

| Variable | Values |
|----------|--------|
| `GGEN_BANNER_VOTES_SYNC_MODE` | `shutdown` (default on Railway), `off`, `vote` (not recommended) |

Logs after deploy should show: `sync_mode=shutdown`

### Before you deploy code changes

1. Let the **current** Railway instance run until the deploy starts (so shutdown can snapshot votes), **or**
2. Manually commit `data/published/banner_pool_votes.json` if you have a recent copy.

If the process is killed without a graceful stop, the last window of votes may be lost.

### Turn off GitHub sync entirely

`GGEN_BANNER_VOTES_SYNC_MODE=off`

Then commit `data/published/banner_pool_votes.json` yourself before each deploy.

---

## Railway Pro volumes (optional)

Mount `/data` and set `GGEN_BANNER_VOTES_PATH=/data/banner_pool_votes.json`. GitHub snapshot on shutdown is still useful as backup.

---

## Manual reset only

Edit or delete `data/published/banner_pool_votes.json` in GitHub only when you intend to clear community totals.
