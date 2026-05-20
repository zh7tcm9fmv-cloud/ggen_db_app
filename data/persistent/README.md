# Banner vote persistence (Railway / GitHub deploys)

Community vote totals are stored in `banner_pool_votes.json`. **A normal Railway redeploy wipes the app container disk**, so votes in `data/persistent/` inside the repo tree are lost unless you use one of the options below.

The app **never** clears votes through the API. Resets happen when the vote file is not on persistent storage.

## Option A — Railway volume (recommended)

1. In [Railway](https://railway.app) → your service → **Volumes** → **Add volume**.
2. Mount path: `/data` (size ≥ 1 MB is enough).
3. Redeploy. On boot you should see a log line like:  
   `banner_pool_votes: using persistent path /data/banner_pool_votes.json`

Votes then survive every GitHub push / Railway redeploy.

Optional override:

`GGEN_BANNER_VOTES_PATH=/data/banner_pool_votes.json`

## Option B — GitHub sync (good if you already deploy from GitHub)

Keeps a copy of the vote file in your repo via the GitHub API so a fresh container can **re-download** totals after deploy.

1. Create a GitHub **fine-grained** or **classic** PAT with `contents: read and write` on the app repo.
2. In Railway → **Variables** add:
   - `GGEN_BANNER_VOTES_GITHUB_TOKEN` = your PAT
   - `GGEN_BANNER_VOTES_GITHUB_REPO` = `owner/repo` (optional if `GITHUB_REPOSITORY` is already set)
   - `GGEN_BANNER_VOTES_GITHUB_PATH` = `data/persistent/banner_pool_votes.json` (optional)
3. Redeploy. Logs should show `github_sync=on`.
4. After votes exist, commit is automatic on each vote (async). You can also copy `data/persistent/banner_pool_votes.json` into the repo once manually as a seed.

Read-only bootstrap (no PAT write), e.g. raw file in repo:

`GGEN_BANNER_VOTES_IMPORT_URL=https://raw.githubusercontent.com/owner/repo/main/data/persistent/banner_pool_votes.json`

## Option C — Custom path on VPS

`GGEN_BANNER_VOTES_PATH=/absolute/path/outside/deploy/banner_pool_votes.json`

## Manual reset only

Delete `banner_pool_votes.json` and `.bak` on the volume (or GitHub file) **only** when you intentionally want to reset community totals.
