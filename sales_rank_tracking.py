# -*- coding: utf-8 -*-
"""Live App Store sales-rank sampler for /tracking (HK / TW / JP / overseas).

Primary source: Apple public top-grossing RSS (overall + Games).
Secondary: Game-i world_analytics 「本日」 column (daily snapshot, same countries).

Keeps a rolling ~96h ring so a gacha release trail can show All / 24h / 36h.

Local ``data/persistent/sales_rank_tracking.json`` is an ephemeral working cache
(same class as SPI/votes). Durable source of truth = GitHub branch
``banner-votes-data`` via ``GGEN_BANNER_VOTES_GITHUB_TOKEN`` (no Railway volume).
Boot also merges bundled ``data/published/sales_rank_tracking.json`` when present.
"""
from __future__ import annotations

import base64
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo

    _HKT = ZoneInfo("Asia/Hong_Kong")
except Exception:  # pragma: no cover
    _HKT = timezone(timedelta(hours=8))

# JP storefront uses the JP app id; overseas storefronts use the global id.
APP_ID_JP = "6692611665"
APP_ID_GLOBAL = "6692615881"

# Countries that matter for 海外 gem races + JP reference.
COUNTRIES: Tuple[Dict[str, str], ...] = (
    {"code": "hk", "label_en": "Hong Kong", "label_ja": "香港", "app_id": APP_ID_GLOBAL},
    {"code": "mo", "label_en": "Macao", "label_ja": "マカオ", "app_id": APP_ID_GLOBAL},
    {"code": "tw", "label_en": "Taiwan", "label_ja": "台湾", "app_id": APP_ID_GLOBAL},
    {"code": "jp", "label_en": "Japan", "label_ja": "日本", "app_id": APP_ID_JP},
    {"code": "sg", "label_en": "Singapore", "label_ja": "シンガポール", "app_id": APP_ID_GLOBAL},
    {"code": "kr", "label_en": "Korea", "label_ja": "韓国", "app_id": APP_ID_GLOBAL},
)

# Game-i world_analytics JP country name → our code
_GAMEI_NAME_TO_CODE = {
    "香港": "hk",
    "マカオ": "mo",
    "澳門": "mo",
    "台湾": "tw",
    "日本": "jp",
    "シンガポール": "sg",
    "韓国": "kr",
    "アメリカ": "us",
    "カナダ": "ca",
    "オーストラリア": "au",
    "インドネシア": "id",
}

KEEP_MS = 96 * 60 * 60 * 1000  # 4-day ring (release day + ~2–3 days after)
# Cost: each tick ≈ N countries × (overall [+ games]) Apple RSS + 1 Game-i HTML.
# Bodies are tiny (RSS ~30–80KB each). Railway bills *egress* (outbound to clients);
# RSS/Game-i responses are inbound — keep an eye on Network egress in the Railway bill
# just in case, but this sampler should stay cheap vs image/CDN mistakes.
DEFAULT_INTERVAL_SEC = 600  # 10 min always-on baseline
ACTIVE_INTERVAL_SEC = 300  # 5 min during hot first day of a Unit Assembly window
# Optional slower off-window mode (off by default — owner chose always-on).
IDLE_INTERVAL_SEC = 6 * 3600
# Track release day + this many hours after start (default 3 days) for denser polls.
ACTIVE_AFTER_RELEASE_HOURS = 72.0
ACTIVE_BEFORE_RELEASE_HOURS = 6.0
# Apple RSS is primary for every tracked storefront; Game-i 「本日」 is backup reference.
APPLE_POLL_CODES = frozenset(c["code"] for c in COUNTRIES)
UA = "GGenEternalDB/1.0 (+https://ggendb.up.railway.app; sales-rank tracking)"

_lock = threading.RLock()
_samples: List[Dict[str, Any]] = []
_meta: Dict[str, Any] = {"last_ok_ms": 0, "last_err": "", "started_ms": 0}
_thread: Optional[threading.Thread] = None
_stop = threading.Event()
_store_path: Optional[str] = None
_active_until_ms = 0
_app_dir: Optional[str] = None
_github_sha: Optional[str] = None
_github_push_lock = threading.Lock()
_debounce_timer: Optional[threading.Timer] = None
_debounce_lock = threading.Lock()
_last_pushed_n = -1
_GITHUB_PUSH_DEBOUNCE_SEC = 45.0


def _now_ms() -> int:
    return int(time.time() * 1000)


def _path_is_writable_dir(path: str) -> bool:
    try:
        os.makedirs(path, exist_ok=True)
        probe = os.path.join(path, ".ggen_write_probe")
        with open(probe, "w", encoding="utf-8") as f:
            f.write("1")
        os.remove(probe)
        return True
    except Exception:
        return False


def resolve_store_path(app_dir: Optional[str] = None) -> str:
    custom = (os.environ.get("GGEN_SALES_RANK_PATH") or "").strip()
    if custom:
        return os.path.abspath(custom)
    vol = (
        os.environ.get("GGEN_PERSISTENT_DIR")
        or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
        or ""
    ).strip()
    if vol and _path_is_writable_dir(vol):
        return os.path.join(vol, "sales_rank_tracking.json")
    base = app_dir or os.path.dirname(os.path.abspath(__file__))
    d = os.path.join(base, "data", "persistent")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "sales_rank_tracking.json")


def _trim_locked(now: Optional[int] = None) -> None:
    global _samples
    cutoff = (now or _now_ms()) - KEEP_MS
    _samples = [s for s in _samples if int(s.get("t") or 0) >= cutoff]


def _snapshot_dict() -> Dict[str, Any]:
    return {
        "v": 1,
        "saved_ms": _now_ms(),
        "meta": dict(_meta),
        "samples": list(_samples),
    }


def _save_locked() -> None:
    if not _store_path:
        return
    payload = _snapshot_dict()
    parent = os.path.dirname(_store_path) or "."
    os.makedirs(parent, exist_ok=True)
    tmp = f"{_store_path}.tmp.{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, _store_path)


def _apply_snapshot_locked(data: Optional[Dict[str, Any]], *, replace_meta: bool = False) -> int:
    """Merge snapshot samples into memory. Returns added/merged count hint."""
    global _samples, _meta
    if not isinstance(data, dict):
        return 0
    incoming = data.get("samples") or []
    if not isinstance(incoming, list):
        return 0
    before = len(_samples)
    _samples = _merge_sample_lists(_samples, incoming)
    _trim_locked()
    meta = data.get("meta")
    if isinstance(meta, dict):
        if replace_meta or not _meta.get("last_ok_ms"):
            for k in ("last_ok_ms", "last_err", "started_ms"):
                if k in meta and meta[k] not in (None, ""):
                    if k == "last_ok_ms":
                        try:
                            _meta[k] = max(int(_meta.get(k) or 0), int(meta[k] or 0))
                        except (TypeError, ValueError):
                            pass
                    elif k == "started_ms":
                        try:
                            cur = int(_meta.get(k) or 0)
                            inc = int(meta[k] or 0)
                            _meta[k] = min(cur, inc) if cur and inc else (cur or inc)
                        except (TypeError, ValueError):
                            pass
                    elif replace_meta or not _meta.get(k):
                        _meta[k] = meta[k]
    return max(0, len(_samples) - before)


def _load_locked() -> None:
    global _samples, _meta
    if not _store_path or not os.path.isfile(_store_path):
        return
    try:
        with open(_store_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return
        samples = data.get("samples") or []
        if isinstance(samples, list):
            _samples = [s for s in samples if isinstance(s, dict) and s.get("t")]
        meta = data.get("meta")
        if isinstance(meta, dict):
            _meta.update(meta)
        _trim_locked()
    except Exception as e:
        _meta["last_err"] = f"load:{e}"


def _country_fill_score(sample: Dict[str, Any]) -> int:
    countries = sample.get("countries") or {}
    if not isinstance(countries, dict):
        return 0
    n = 0
    for row in countries.values():
        if not isinstance(row, dict):
            continue
        if row.get("overall") is not None:
            n += 2
        if row.get("games") is not None:
            n += 1
        if row.get("gamei_today") is not None:
            n += 1
    return n


def _merge_sample_lists(
    a: List[Dict[str, Any]], b: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    by_t: Dict[int, Dict[str, Any]] = {}
    for src in (a or []) + (b or []):
        if not isinstance(src, dict):
            continue
        try:
            t = int(src.get("t") or 0)
        except (TypeError, ValueError):
            continue
        if t <= 0:
            continue
        prev = by_t.get(t)
        if prev is None or _country_fill_score(src) >= _country_fill_score(prev):
            by_t[t] = src
    return [by_t[k] for k in sorted(by_t.keys())]


def _bundled_seed_path(app_dir: Optional[str] = None) -> str:
    base = app_dir or _app_dir or os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "data", "published", "sales_rank_tracking.json")


def _load_bundled_seed(app_dir: Optional[str] = None) -> Optional[Dict[str, Any]]:
    path = _bundled_seed_path(app_dir)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _on_railway() -> bool:
    return bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_PROJECT_ID"))


def _github_sync_mode() -> str:
    raw = (os.environ.get("GGEN_SALES_RANK_SYNC_MODE") or "").strip().lower()
    if raw in ("off", "none", "false", "0", "never"):
        return "off"
    if raw in ("sample", "vote", "each", "always", "every"):
        return "sample"
    if raw in ("shutdown", "deploy", "exit", "stop", "on", "true", "1"):
        return "shutdown"
    # Default: when votes token exists, keep trail across deploys (same as SPI).
    if (os.environ.get("GGEN_BANNER_VOTES_GITHUB_TOKEN") or "").strip():
        return "shutdown"
    return "off"


def _github_path() -> str:
    return (
        os.environ.get("GGEN_SALES_RANK_GITHUB_PATH")
        or "data/published/sales_rank_tracking.json"
    ).strip().lstrip("/")


def _github_repo() -> str:
    return (
        os.environ.get("GGEN_BANNER_VOTES_GITHUB_REPO")
        or os.environ.get("GITHUB_REPOSITORY")
        or "zh7tcm9fmv-cloud/ggen_db_app"
    ).strip()


def _github_branch() -> str:
    explicit = (os.environ.get("GGEN_BANNER_VOTES_GITHUB_BRANCH") or "").strip()
    if explicit:
        return explicit
    if _on_railway() and (os.environ.get("GGEN_BANNER_VOTES_GITHUB_TOKEN") or "").strip():
        return "banner-votes-data"
    return "banner-votes-data"


def _github_config() -> Optional[Tuple[str, str, str, str]]:
    token = (os.environ.get("GGEN_BANNER_VOTES_GITHUB_TOKEN") or "").strip()
    repo = _github_repo()
    path = _github_path()
    if not token or not repo or "/" not in repo:
        return None
    return token, repo, path, _github_branch()


def _github_api_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": UA,
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _http_json(
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    method: str = "GET",
    data: Optional[bytes] = None,
    timeout: float = 25.0,
) -> Any:
    req = urllib.request.Request(
        url, data=data, headers=headers or {"User-Agent": UA}, method=method
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def fetch_github_snapshot() -> Optional[Dict[str, Any]]:
    """Fetch durable ring from banner-votes-data (token API, else raw.githubusercontent)."""
    global _github_sha
    cfg = _github_config()
    repo = _github_repo()
    path = _github_path()
    branch = _github_branch()
    if cfg:
        token, repo, path, branch = cfg
        api = (
            f"https://api.github.com/repos/{repo}/contents/"
            f"{urllib.parse.quote(path)}?ref={urllib.parse.quote(branch)}"
        )
        try:
            meta = _http_json(api, headers=_github_api_headers(token))
            if isinstance(meta, dict):
                if meta.get("sha"):
                    _github_sha = str(meta["sha"])
                content = meta.get("content")
                if isinstance(content, str) and content:
                    raw = base64.b64decode(content.replace("\n", ""))
                    data = json.loads(raw.decode("utf-8"))
                    return data if isinstance(data, dict) else None
                download = meta.get("download_url")
                if download:
                    raw = _http_get(str(download))
                    data = json.loads(raw.decode("utf-8"))
                    return data if isinstance(data, dict) else None
        except Exception as e:
            _meta["last_err"] = f"github_fetch:{e}"[:500]
    # Public raw fallback (works if file exists on the votes branch).
    if repo and "/" in repo and path:
        raw_url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
        try:
            raw = _http_get(raw_url)
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else None
        except Exception:
            return None
    return None


def push_github_snapshot(*, reason: str = "debounced", force: bool = False) -> bool:
    """Push current ring to GitHub. Tiny JSON — Contents API is enough."""
    global _github_sha, _last_pushed_n
    if _github_sync_mode() == "off":
        return False
    cfg = _github_config()
    if not cfg:
        return False
    with _lock:
        n = len(_samples)
        payload_obj = _snapshot_dict()
    if not force and n == _last_pushed_n and n > 0:
        return False
    if n < 1 and not force:
        return False
    token, repo, path, branch = cfg
    payload = json.dumps(payload_obj, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
    url = f"https://api.github.com/repos/{repo}/contents/{urllib.parse.quote(path)}"
    with _github_push_lock:
        for attempt in range(3):
            body: Dict[str, Any] = {
                "message": f"chore: snapshot sales-rank tracking ({reason}, n={n})",
                "content": base64.b64encode(payload).decode("ascii"),
                "branch": branch,
            }
            if _github_sha:
                body["sha"] = _github_sha
            try:
                meta = _http_json(
                    url,
                    headers={**_github_api_headers(token), "Content-Type": "application/json"},
                    method="PUT",
                    data=json.dumps(body).encode("utf-8"),
                )
                content = meta.get("content") if isinstance(meta, dict) else None
                if isinstance(content, dict) and content.get("sha"):
                    _github_sha = str(content["sha"])
                _last_pushed_n = n
                print(f"sales_rank_tracking: GitHub snapshot ({reason}, n={n})")
                return True
            except urllib.error.HTTPError as e:
                if e.code in (404, 409, 422) and attempt < 2:
                    _github_sha = None
                    try:
                        fetch_github_snapshot()
                    except Exception:
                        pass
                    time.sleep(0.25 * (attempt + 1))
                    continue
                print(f"sales_rank_tracking: GitHub push failed: {e}")
                return False
            except Exception as e:
                print(f"sales_rank_tracking: GitHub push failed: {e}")
                if attempt < 2:
                    time.sleep(0.25 * (attempt + 1))
                    continue
                return False
    return False


def _cancel_debounced_push() -> None:
    global _debounce_timer
    with _debounce_lock:
        if _debounce_timer:
            _debounce_timer.cancel()
            _debounce_timer = None


def schedule_debounced_github_push() -> None:
    """After each sample save — debounce so we don't thrash the Contents API."""
    global _debounce_timer
    mode = _github_sync_mode()
    if mode == "off" or not _github_config():
        return
    if mode == "sample":
        threading.Thread(
            target=lambda: push_github_snapshot(reason="sample", force=True),
            daemon=True,
            name="sales-rank-gh-push",
        ).start()
        return

    def _run() -> None:
        try:
            push_github_snapshot(reason="debounced", force=True)
        except Exception as e:
            print(f"sales_rank_tracking: debounced push failed: {e}")

    with _debounce_lock:
        if _debounce_timer:
            _debounce_timer.cancel()
        _debounce_timer = threading.Timer(_GITHUB_PUSH_DEBOUNCE_SEC, _run)
        _debounce_timer.daemon = True
        _debounce_timer.start()


def flush_github_sync(reason: str = "shutdown") -> bool:
    """SIGTERM / deploy flush — same habit as banner/SPI votes."""
    if _github_sync_mode() == "off" or not _github_config():
        return False
    _cancel_debounced_push()
    try:
        return push_github_snapshot(reason=reason, force=True)
    except Exception as e:
        print(f"sales_rank_tracking: flush failed ({reason}): {e}")
        return False


def hydrate_durable(app_dir: Optional[str] = None) -> None:
    """Merge bundled seed + GitHub snapshot into memory, then rewrite local cache."""
    with _lock:
        seed = _load_bundled_seed(app_dir)
        added_seed = _apply_snapshot_locked(seed) if seed else 0
    remote = None
    if _github_sync_mode() != "off":
        try:
            remote = fetch_github_snapshot()
        except Exception as e:
            print(f"sales_rank_tracking: hydrate fetch failed: {e}")
    with _lock:
        added_remote = _apply_snapshot_locked(remote) if remote else 0
        try:
            _save_locked()
        except Exception as e:
            _meta["last_err"] = f"hydrate_save:{e}"[:500]
        n = len(_samples)
    if added_seed or added_remote or (remote and n):
        print(
            f"sales_rank_tracking: hydrated n={n} "
            f"(seed+{added_seed}, github+{added_remote})"
        )


def _http_get(url: str, timeout: float = 18.0) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_apple_rank(country: str, app_id: str, games: bool = False) -> Optional[int]:
    """Return 1-based rank in Apple top-grossing RSS, or None if not in top 200."""
    cc = (country or "").strip().lower()
    aid = str(app_id or "").strip()
    if not cc or not aid:
        return None
    if games:
        url = (
            f"https://itunes.apple.com/{cc}/rss/topgrossingapplications/"
            f"limit=200/genre=6014/json"
        )
    else:
        url = f"https://itunes.apple.com/{cc}/rss/topgrossingapplications/limit=200/json"
    raw = _http_get(url)
    data = json.loads(raw.decode("utf-8"))
    entries = (data.get("feed") or {}).get("entry") or []
    if isinstance(entries, dict):
        entries = [entries]
    for i, entry in enumerate(entries, 1):
        try:
            eid = str(
                ((entry.get("id") or {}).get("attributes") or {}).get("im:id") or ""
            )
        except Exception:
            eid = ""
        if eid == aid:
            return i
    return None


def fetch_gamei_today_ranks(apid: str = APP_ID_JP) -> Dict[str, Optional[int]]:
    """Parse Game-i world_analytics 「本日」 ranks keyed by our country codes."""
    url = f"https://game-i.daa.jp/?cmd=world_analytics&apid={apid}"
    html = _http_get(url, timeout=22).decode("utf-8", errors="replace")
    out: Dict[str, Optional[int]] = {}
    # Rows look like: 1.<a …>香港</a> … <strong>3</strong> …
    for m in re.finditer(
        r"<tr>\s*<td[^>]*>\s*\d+\.\s*<a[^>]*>([^<]+)</a>\s*</td>\s*"
        r"<td[^>]*>\s*(?:<strong[^>]*>)?(?:<span[^>]*>)?([^<]*?)(?:</span>)?(?:</strong>)?\s*</td>",
        html,
        re.I | re.S,
    ):
        name = (m.group(1) or "").strip()
        code = _GAMEI_NAME_TO_CODE.get(name)
        if not code:
            continue
        raw = (m.group(2) or "").strip().replace(",", "")
        if raw in ("", "-", "—", "–"):
            out[code] = None
        else:
            try:
                out[code] = int(raw)
            except ValueError:
                out[code] = None
    return out


def take_sample() -> Dict[str, Any]:
    """Fetch one multi-country snapshot. Safe to call from API or worker."""
    t = _now_ms()
    countries: Dict[str, Any] = {}
    err_bits: List[str] = []
    gamei: Dict[str, Optional[int]] = {}
    try:
        gamei = fetch_gamei_today_ranks()
    except Exception as e:
        err_bits.append(f"gamei:{e}")

    poll_games = (os.environ.get("GGEN_SALES_RANK_POLL_GAMES") or "1").strip().lower() not in (
        "0",
        "false",
        "off",
        "no",
    )
    for c in COUNTRIES:
        code = c["code"]
        app_id = c["app_id"]
        row: Dict[str, Any] = {
            "overall": None,
            "games": None,
            "gamei_today": gamei.get(code),
        }
        try:
            row["overall"] = fetch_apple_rank(code, app_id, games=False)
        except Exception as e:
            err_bits.append(f"{code}.overall:{e}")
        if poll_games:
            try:
                row["games"] = fetch_apple_rank(code, app_id, games=True)
            except Exception as e:
                err_bits.append(f"{code}.games:{e}")
        time.sleep(0.12)  # be polite to Apple RSS
        countries[code] = row

    sample = {"t": t, "countries": countries}
    with _lock:
        _samples.append(sample)
        _trim_locked(t)
        _meta["last_ok_ms"] = t
        if err_bits:
            _meta["last_err"] = "; ".join(err_bits)[:500]
        else:
            _meta["last_err"] = ""
        try:
            _save_locked()
        except Exception as e:
            _meta["last_err"] = (str(_meta.get("last_err") or "") + f"|save:{e}")[:500]
    try:
        schedule_debounced_github_push()
    except Exception:
        pass
    return sample


def set_active_window(until_ms: int) -> None:
    """Mark a hot window (e.g. new gacha first 24h) for denser sampling."""
    global _active_until_ms
    with _lock:
        _active_until_ms = max(int(_active_until_ms or 0), int(until_ms or 0))


def mark_gacha_release_window(
    start_ms: int, hours: Optional[float] = None
) -> None:
    """Arm dense sampling from (start − 6h) through (start + hours, default 72h)."""
    if not start_ms:
        return
    after_h = (
        float(ACTIVE_AFTER_RELEASE_HOURS)
        if hours is None
        else float(hours)
    )
    until = int(start_ms) + int(after_h * 3600 * 1000)
    now = _now_ms()
    before = int(ACTIVE_BEFORE_RELEASE_HOURS * 3600 * 1000)
    if int(start_ms) - before <= now <= until:
        set_active_window(until)


def _load_gasha_start_ms_list(app_dir: Optional[str] = None) -> List[int]:
    """Read Unit Assembly schedule starts from local EN master (no network)."""
    base = app_dir or os.path.dirname(os.path.abspath(__file__))
    master = os.path.join(base, "data", "EN", "master")
    gasha_path = os.path.join(master, "m_gasha.json")
    sched_path = os.path.join(master, "m_schedule.json")
    if not (os.path.isfile(gasha_path) and os.path.isfile(sched_path)):
        return []

    def _rows(path: str) -> List[Dict[str, Any]]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception:
            return []
        if isinstance(raw, list):
            return [r for r in raw if isinstance(r, dict)]
        if isinstance(raw, dict):
            for k in ("data", "Data", "rows"):
                v = raw.get(k)
                if isinstance(v, list):
                    return [r for r in v if isinstance(r, dict)]
        return []

    starts: Dict[str, int] = {}
    for row in _rows(sched_path):
        sid = str(row.get("Id") or row.get("id") or "").strip()
        if not sid or sid == "0":
            continue
        try:
            starts[sid] = int(row.get("StartDatetime") or 0)
        except (TypeError, ValueError):
            continue
    out: List[int] = []
    for row in _rows(gasha_path):
        try:
            shown = row.get("IsShown")
            if shown is False or shown == 0:
                continue
        except Exception:
            pass
        sid = str(row.get("ScheduleId") or row.get("scheduleId") or "0").strip()
        if not sid or sid == "0":
            continue
        st = starts.get(sid) or 0
        if st > 0:
            out.append(int(st))
    return out


def refresh_active_from_gacha_schedules(app_dir: Optional[str] = None) -> int:
    """Arm / extend active window from nearby Unit Assembly starts. Returns until_ms."""
    now = _now_ms()
    best_until = 0
    before = int(ACTIVE_BEFORE_RELEASE_HOURS * 3600 * 1000)
    after = int(ACTIVE_AFTER_RELEASE_HOURS * 3600 * 1000)
    for start_ms in _load_gasha_start_ms_list(app_dir):
        until = int(start_ms) + after
        if int(start_ms) - before <= now <= until:
            if until > best_until:
                best_until = until
    if best_until:
        set_active_window(best_until)
    return best_until


def _hkt_day_bounds_ms(now_ms: Optional[int] = None) -> Tuple[int, int, int]:
    """Return (yesterday_start, today_start, tomorrow_start) ms in Asia/Hong_Kong."""
    now = int(now_ms or _now_ms())
    dt = datetime.fromtimestamp(now / 1000.0, tz=_HKT)
    today0 = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    yest0 = today0 - timedelta(days=1)
    tom0 = today0 + timedelta(days=1)
    return (
        int(yest0.timestamp() * 1000),
        int(today0.timestamp() * 1000),
        int(tom0.timestamp() * 1000),
    )


def _peak_row(samples: List[Dict[str, Any]], code: str, chart: str, t0: int, t1: int) -> Dict[str, Any]:
    best: Optional[int] = None
    best_t: Optional[int] = None
    hit_1 = False
    for s in samples:
        tt = int(s.get("t") or 0)
        if tt < t0 or tt >= t1:
            continue
        crow = (s.get("countries") or {}).get(code) or {}
        rank = crow.get(chart)
        if rank is None:
            continue
        try:
            ri = int(rank)
        except (TypeError, ValueError):
            continue
        if best is None or ri < best:
            best = ri
            best_t = tt
        if ri == 1:
            hit_1 = True
    return {
        "best": best,
        "best_t": best_t,
        "hit_1": hit_1,
        "samples": 0 if best is None else 1,
    }


def get_payload(
    hours: Optional[float] = None, chart: str = "overall", *, all_ring: bool = False
) -> Dict[str, Any]:
    """Return chart series.

    ``all_ring`` / ``hours is None`` → every sample still in the rolling ring
    (KEEP_MS, currently ~96h). Window chips only filter stored points; they do
    **not** change Apple / Game-i poll rate.
    """
    chart = "games" if str(chart).lower() == "games" else "overall"
    now = _now_ms()
    keep_h = KEEP_MS / 3600_000
    if all_ring or hours is None:
        hours_out: Any = "all"
        cutoff = now - KEEP_MS
    else:
        h = float(hours)
        h = max(1.0, min(keep_h, h))
        hours_out = h
        cutoff = now - int(h * 3600 * 1000)
    with _lock:
        ring = list(_samples)
        if all_ring or hours is None:
            samples = list(ring)
        else:
            samples = [s for s in ring if int(s.get("t") or 0) >= cutoff]
        meta = dict(_meta)
        active_until = int(_active_until_ms or 0)

    y0, d0, d1 = _hkt_day_bounds_ms(now)
    series: Dict[str, List[Dict[str, Any]]] = {}
    latest: Dict[str, Any] = {}
    peaks: Dict[str, Any] = {}
    for c in COUNTRIES:
        code = c["code"]
        pts: List[Dict[str, Any]] = []
        for s in samples:
            crow = (s.get("countries") or {}).get(code) or {}
            rank = crow.get(chart)
            pts.append(
                {
                    "t": s.get("t"),
                    "rank": rank,
                    "gamei_today": crow.get("gamei_today"),
                }
            )
        series[code] = pts
        if pts:
            latest[code] = {
                "rank": pts[-1].get("rank"),
                "gamei_today": pts[-1].get("gamei_today"),
                "t": pts[-1].get("t"),
                "label_en": c["label_en"],
                "label_ja": c["label_ja"],
            }
        else:
            latest[code] = {
                "rank": None,
                "gamei_today": None,
                "t": None,
                "label_en": c["label_en"],
                "label_ja": c["label_ja"],
            }
        win = _peak_row(samples, code, chart, cutoff, now + 1)
        today = _peak_row(ring, code, chart, d0, d1)
        yest = _peak_row(ring, code, chart, y0, d0)
        peaks[code] = {
            "window_best": win.get("best"),
            "window_hit_1": bool(win.get("hit_1")),
            "today_best": today.get("best"),
            "today_hit_1": bool(today.get("hit_1")),
            "yesterday_best": yest.get("best"),
            "yesterday_hit_1": bool(yest.get("hit_1")),
            "label_en": c["label_en"],
            "label_ja": c["label_ja"],
        }

    any_y1 = any(bool(p.get("yesterday_hit_1")) for p in peaks.values())
    any_t1 = any(bool(p.get("today_hit_1")) for p in peaks.values())

    return {
        "ok": True,
        "chart": chart,
        "hours": hours_out,
        "keep_hours": keep_h,
        "sample_count": len(samples),
        "countries": [
            {"code": c["code"], "label_en": c["label_en"], "label_ja": c["label_ja"]}
            for c in COUNTRIES
        ],
        "latest": latest,
        "series": series,
        "peaks": peaks,
        "peak_summary": {
            "tz": "Asia/Hong_Kong",
            "yesterday_start_ms": y0,
            "today_start_ms": d0,
            "any_yesterday_hit_1": any_y1,
            "any_today_hit_1": any_t1,
            "ring_hours": KEEP_MS / 3600_000,
        },
        "meta": meta,
        "active_until_ms": active_until,
        "sampling": {
            "mode": (
                "active"
                if now < active_until
                else ("idle" if _idle_off_window() else "always")
            ),
            "active_after_release_hours": ACTIVE_AFTER_RELEASE_HOURS,
            "idle_interval_sec": IDLE_INTERVAL_SEC,
            "active_interval_sec": ACTIVE_INTERVAL_SEC,
            "calm_interval_sec": DEFAULT_INTERVAL_SEC,
        },
        "source": {
            "primary": "apple_rss_topgrossing",
            "secondary": "gamei_world_analytics_today",
            "app_id_jp": APP_ID_JP,
            "app_id_global": APP_ID_GLOBAL,
        },
    }


def _idle_off_window() -> bool:
    """Opt-in only: GGEN_SALES_RANK_IDLE=1 uses 6h polls outside gacha windows."""
    return (os.environ.get("GGEN_SALES_RANK_IDLE") or "").strip().lower() in (
        "1",
        "true",
        "on",
        "yes",
    )


def _interval_sec(app_dir: Optional[str] = None) -> float:
    env = (os.environ.get("GGEN_SALES_RANK_INTERVAL_SEC") or "").strip()
    if env:
        try:
            return max(60.0, float(env))
        except ValueError:
            pass
    # Re-check master schedules so a new banner mid-uptime arms dense mode.
    try:
        refresh_active_from_gacha_schedules(app_dir)
    except Exception:
        pass
    with _lock:
        until = int(_active_until_ms or 0)
    now = _now_ms()
    if now < until:
        # First ~24h denser; remainder of window stays at baseline 10 min.
        hot_tail = until - int((ACTIVE_AFTER_RELEASE_HOURS - 24.0) * 3600 * 1000)
        if now < hot_tail:
            return float(ACTIVE_INTERVAL_SEC)
        return float(DEFAULT_INTERVAL_SEC)
    if _idle_off_window():
        return float(IDLE_INTERVAL_SEC)
    return float(DEFAULT_INTERVAL_SEC)


def _worker(app_dir: Optional[str] = None) -> None:
    # Stagger after boot so browse prewarm wins the first seconds.
    _stop.wait(25)
    while not _stop.is_set():
        try:
            # Idle off-window: still take rare samples so /tracking isn't empty forever,
            # but skip dense Apple×games thrash between banners.
            take_sample()
        except Exception as e:
            with _lock:
                _meta["last_err"] = f"worker:{e}"[:500]
        _stop.wait(_interval_sec(app_dir))


def start_background(app_dir: Optional[str] = None) -> None:
    """Idempotent: hydrate store + start sampler daemon."""
    global _thread, _store_path, _meta, _app_dir
    with _lock:
        if _thread and _thread.is_alive():
            return
        _app_dir = app_dir or os.path.dirname(os.path.abspath(__file__))
        _store_path = resolve_store_path(app_dir)
        _load_locked()
        if not _meta.get("started_ms"):
            _meta["started_ms"] = _now_ms()
    # Outside lock: network hydrate (bundled seed + GitHub votes branch).
    try:
        hydrate_durable(app_dir)
    except Exception as e:
        print(f"sales_rank_tracking: hydrate failed: {e}")
    with _lock:
        if _thread and _thread.is_alive():
            return
        try:
            refresh_active_from_gacha_schedules(app_dir)
        except Exception:
            pass
        _stop.clear()
        _thread = threading.Thread(
            target=_worker,
            name="sales-rank-tracking",
            args=(app_dir,),
            daemon=True,
        )
        _thread.start()
    if _on_railway() and _github_sync_mode() != "off" and not _github_config():
        print(
            "sales_rank_tracking: set GGEN_BANNER_VOTES_GITHUB_TOKEN "
            "(reuses banner-votes-data) so /tracking trail survives deploys."
        )


def force_sample_now() -> Dict[str, Any]:
    """On-demand sample (e.g. /tracking first open with empty series)."""
    return take_sample()
