# Banner vote persistence

Community totals live in `banner_pool_votes.json`. On **Railway free tier** (no volumes), the container disk is wiped on every deploy — you must use **GitHub sync** below.

The app never exposes a “reset votes” API. Totals only disappear when storage is not configured.

---

## Railway free tier (recommended): GitHub sync

Votes are stored in your GitHub repo at:

`data/published/banner_pool_votes.json`

That file is **committed to git** (baseline on deploy) and **updated automatically** when someone votes, if you add a token.

### Step 1 — Create a GitHub token

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. **Fine-grained token** (recommended) or **Classic**
3. Repository access: **only your app repo** (e.g. `ggen_db_app`)
4. Permissions: **Contents** → **Read and write**
5. Generate and copy the token (you will not see it again)

### Step 2 — Add Railway variables

Railway → your **Flask/API service** → **Variables**:

| Variable | Value |
|----------|--------|
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | paste the token |
| `GGEN_BANNER_VOTES_GITHUB_REPO` | `your-github-username/your-repo-name` (optional if deploy already sets `GITHUB_REPOSITORY`) |
| `GGEN_BANNER_VOTES_GITHUB_PATH` | `data/published/banner_pool_votes.json` (optional; this is the default) |

Redeploy the service.

### Step 3 — Confirm in logs

Open the latest deploy log and look for:

```
banner_pool_votes: ... github_sync=on railway=yes
```

After a test vote, check your repo on GitHub — `data/published/banner_pool_votes.json` should update within a few seconds.

### Step 4 — Commit the published file once

Push this repo including `data/published/banner_pool_votes.json` so the first deploy has the file in git. After that, the token keeps it updated when users vote.

---

## What happens on each deploy (free tier)

1. New container starts (empty local disk).
2. App loads `data/published/banner_pool_votes.json` from the git checkout.
3. App fetches the latest copy from GitHub (API + raw URL).
4. New votes are written locally and **synced to GitHub** before the API responds (on Railway).

Redeploys no longer zero out totals **as long as `GGEN_BANNER_VOTES_GITHUB_TOKEN` is set**.

---

## Railway Pro (volumes) — optional

If you later get Pro, you can mount a volume at `/data` instead. The app will prefer `/data/banner_pool_votes.json` when writable. GitHub sync still works as a backup.

`GGEN_BANNER_VOTES_PATH=/data/banner_pool_votes.json`

---

## Read-only fallback (no token)

Without a token, the app only keeps votes until the next deploy, then restores whatever was last **committed** to `data/published/banner_pool_votes.json` in git. That is not live sync — use the token for production.

Optional manual seed URL:

`GGEN_BANNER_VOTES_IMPORT_URL=https://raw.githubusercontent.com/owner/repo/main/data/published/banner_pool_votes.json`

---

## Manual reset only

Delete or edit `data/published/banner_pool_votes.json` in GitHub (or the volume file) only when you intentionally want to clear community totals.
