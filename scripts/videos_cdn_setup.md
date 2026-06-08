# ggen_db_videos — GitHub CDN setup

Host game videos separately from `ggen_db_images` (images) and `ggen_db_app` (app code).

## 1. Create the repository on GitHub

1. Sign in at [github.com](https://github.com).
2. Click **+** (top right) → **New repository**.
3. Set:
   - **Repository name:** `ggen_db_videos` (or `videos_cdn` — name is up to you)
   - **Public**
   - **Add a README:** optional
   - Do **not** add `.gitignore` / license unless you want them
4. Click **Create repository**.

## 2. Enable GitHub Pages

1. Open the new repo → **Settings** → **Pages**.
2. **Build and deployment** → Source: **Deploy from a branch**.
3. Branch: `main` (or `master`) / folder: **/ (root)**.
4. Save. Note the URL, e.g. `https://YOUR_USER.github.io/ggen_db_videos`.

**Alternative (works without Pages):** serve from the `main` branch via raw GitHub:

`https://raw.githubusercontent.com/YOUR_USER/ggen_db_videos/main`

This is what `zh7tcm9fmv-cloud` uses today because Pages is optional for video hosting.

## 3. Folder layout (upload to repo root)

```
ggen_db_videos/
  gacha/
    c01_d.mp4
    c03_1.mp4
    c02_2_cutin_newtype_lastshooting_voice_only.mp4
    c04_1_lastshooting.mp4
  unit/
    eub/
      eub_g4000u00150.mp4
      ...
```

- Strip Unity hash suffixes from filenames (`_40534656`).
- Prefer **H.264 `.mp4`** (re-encode from `.mpeg` if needed).
- Start with the **minimal gacha set** from `m_gasha_movie_setting.json` (~8 MB), not every variant.

## 4. Push files (first time)

On your PC (PowerShell), clone and add videos:

```powershell
cd C:\Users\Mikew0911\Desktop
git clone https://github.com/YOUR_USER/ggen_db_videos.git
cd ggen_db_videos
mkdir gacha, unit\eub
# copy your .mp4 files into gacha\ and unit\eub\
git add .
git commit -m "Add initial gacha and unit LB videos"
git push
```

Wait 1–2 minutes for GitHub Pages to publish.

## 5. Wire the app

Set env var (local `.env`, Railway, etc.):

```
VIDEO_CDN=https://raw.githubusercontent.com/YOUR_USER/ggen_db_videos/main
```

Defaults (no extra env needed after MP4 upload):

- `VIDEO_FILE_EXT=mp4`
- `VIDEO_HASH_SUFFIX=_40534656` (same as ripped filenames, e.g. `c01_d_40534656.mp4`)

If your MP4 files **omit** the hash suffix (e.g. `c01_d.mp4` only):

```
VIDEO_HASH_SUFFIX=
```

The player tries `{id}{hash}.mp4`, then `{id}.mp4`, then legacy `.m2v` as fallback.

If you already use `IMAGE_CDN` for images, keep that unchanged. Videos use `VIDEO_CDN` only.

Restart the app. When `VIDEO_CDN` is set:

- **Unit detail:** ▶ on max LB (tier 4 pips) for UR units with an `eub_*` clip.
- **Unit Assembly tab:** **Preview pull cinematic** on banners that have `GashaMovieSettingId` in master data.

If buttons do not appear, `VIDEO_CDN` is empty or files are missing/wrong path on Pages.

## 6. URL mapping (app → CDN)

| Feature | CDN path |
|---------|----------|
| Gacha clip `c01_d` (MP4) | `{VIDEO_CDN}/gacha/c01_d_40534656.mp4` |
| Max-LB movie `eub_g4000u00150` (MP4) | `{VIDEO_CDN}/unit/eub_g4000u00150_40534656.mp4` |
| Without hash suffix | `{VIDEO_CDN}/gacha/c01_d.mp4` (set `VIDEO_HASH_SUFFIX=`) |

## 7. Optional: same org as images

If images use `https://zh7tcm9fmv-cloud.github.io/ggen_db_images`, you can create `ggen_db_videos` under the same account/org for consistency:

```
VIDEO_CDN=https://raw.githubusercontent.com/zh7tcm9fmv-cloud/ggen_db_videos/main
```
