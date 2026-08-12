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

---

## SP Investment community votes (same GitHub backup)

Investment Priority (`/ig`) community up/down votes use the **same Railway token + `banner-votes-data` branch** as banner votes. They write a separate file:

| Variable | Notes |
|----------|--------|
| `GGEN_BANNER_VOTES_GITHUB_TOKEN` | Same PAT — SPI reuses it (no extra token needed) |
| `GGEN_SPI_VOTES_SYNC_MODE` | Optional; defaults to banner sync mode (`shutdown`) |
| `GGEN_SPI_VOTES_GITHUB_PATH` | Optional; default `data/published/sp_investment_votes.json` |
| `GGEN_SPI_VOTES_WIPE` | Set to `1` only for a deliberate full reset — **never bump schema version to wipe** |

Bundled seed (committed on `main`): `data/published/sp_investment_votes.json`  
Live runtime file: volume / `data/persistent/sp_investment_votes.json` (gitignored)

On boot, Railway merges: local disk + GitHub snapshot + bundled seed. After votes, SPI snapshots to `banner-votes-data` (~45s debounce) and again on SIGTERM — same pattern as banner votes.

Confirm file on the votes branch: `https://github.com/zh7tcm9fmv-cloud/ggen_db_app/blob/banner-votes-data/data/published/sp_investment_votes.json`

---

## Site feedback (no Railway volume)

The in-site feedback form posts to `/api/feedback`. Without a Railway volume, local file storage is ephemeral (lost on redeploy). Forward submissions to Google Sheets instead:

| Variable | Value |
|----------|--------|
| `GGEN_FEEDBACK_SHEETS_URL` | Web app URL from Apps Script deployment |
| `GGEN_FEEDBACK_SHEETS_SECRET` | Same random string as Script property `SECRET` |

Setup script: `scripts/feedback_google_sheets_webapp.gs`

1. New Google Sheet → Extensions → Apps Script → paste script → Save.
2. Script properties → `SECRET` = long random string.
3. Deploy → Web app → Execute as **Me**, access **Anyone** → copy URL.
4. Add both Railway variables above.

**Column layout (2025 form):** Q8 “Tool usage” is two ratings — `Q8 Damage Simulator usage` and `Q8 Team Builder usage` (1–5 each). Older sheets with a single “Tool usage” column should be reset before testing (see below).

**Redeploy after script edits:** Apps Script → Deploy → Manage deployments → Edit → **New version** → Deploy (URL unchanged).

**Wipe the sheet while testing**

| Method | Steps |
|--------|--------|
| **Apps Script (recommended)** | Extensions → Apps Script → choose `wipeFeedbackSheetForTesting` → Run → allow access once → sheet cleared with fresh headers. |
| **Manual in Sheets** | Select all data rows (not only cells) → Delete rows. Delete row 1 too so the tab is **completely empty** — the next submission writes the new header row automatically. |
| **New tab** | Insert a new sheet tab, delete the old tab, rename the new one — point Apps Script at it if needed (script uses the active sheet). |

Logs after deploy should show `site_feedback: sheets=on`. Submissions appear as new rows in the sheet (same idea as Google Form responses, but the on-site form stays unchanged).

Local dev still writes to `data/persistent/site_feedback.jsonl` when Sheets is not configured.

---

## Ko-fi header notice (admin toggle)

Visitors see a red flare on **Support on Ko-fi** only when you turn it on from the admin page.

| Variable | Value |
|----------|--------|
| `GGEN_KOFI_NOTICE_SECRET` | Long random string (admin password) |

1. Add the variable on Railway and redeploy.
2. Open **`/admin/kofi-notice`** (bookmark it).
3. Enter the secret → **Show notice** when you want the flare live → **Hide notice** when done.

State is stored in `data/persistent/kofi_notice.json` (or your Railway volume). Without a volume it resets on redeploy.

Optional API (same secret as Bearer token):

```bash
curl -X POST https://ggendb.up.railway.app/api/kofi/notice/set \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"enabled\":true}"
```
