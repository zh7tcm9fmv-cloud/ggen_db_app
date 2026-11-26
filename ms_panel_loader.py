# -*- coding: utf-8 -*-
"""Load proprietary panel module without shipping it on the public git remote.

Resolution order:
1. Local ``ms_panel.py`` next to this file (dev checkout; gitignored).
2. Env ``GGEN_MS_PANEL_Z`` — zlib+base64 of the module source (Railway secret).
3. Private GitHub raw file via ``GGEN_BANNER_VOTES_GITHUB_TOKEN`` (or
   ``GGEN_MS_PANEL_GITHUB_TOKEN``) from
   ``GGEN_MS_PANEL_GITHUB_REPO`` / ``GGEN_MS_PANEL_GITHUB_PATH``.

Never log module source. Never serve this file over /static.
"""
from __future__ import annotations

import base64
import importlib.util
import os
import sys
import zlib
from types import ModuleType
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_MOD_NAME = "ms_panel"
_DEFAULT_REPO = "zh7tcm9fmv-cloud/ggen_ms_panel"
_DEFAULT_PATH = "ms_panel.py"
_DEFAULT_REF = "main"


def _app_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))


def _local_path() -> str:
    return os.path.join(_app_dir(), "ms_panel.py")


def _token() -> str:
    for key in ("GGEN_MS_PANEL_GITHUB_TOKEN", "GGEN_BANNER_VOTES_GITHUB_TOKEN", "GITHUB_TOKEN"):
        v = (os.environ.get(key) or "").strip()
        if v:
            return v
    return ""


def _exec_source(src: bytes, origin: str) -> ModuleType:
    if _MOD_NAME in sys.modules:
        return sys.modules[_MOD_NAME]
    mod = ModuleType(_MOD_NAME)
    mod.__file__ = origin
    mod.__loader__ = None
    mod.__package__ = None
    code = compile(src, origin, "exec", dont_inherit=True)
    exec(code, mod.__dict__)
    sys.modules[_MOD_NAME] = mod
    return mod


def _from_local() -> Optional[ModuleType]:
    path = _local_path()
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as f:
        src = f.read()
    if not src.strip():
        return None
    return _exec_source(src, path)


def _from_env_z() -> Optional[ModuleType]:
    blob = (os.environ.get("GGEN_MS_PANEL_Z") or "").strip()
    if not blob:
        return None
    try:
        raw = base64.b64decode(blob, validate=True)
        src = zlib.decompress(raw)
    except Exception:
        return None
    if not src.strip():
        return None
    return _exec_source(src, "<GGEN_MS_PANEL_Z>")


def _from_github() -> Optional[ModuleType]:
    tok = _token()
    if not tok:
        return None
    repo = (os.environ.get("GGEN_MS_PANEL_GITHUB_REPO") or _DEFAULT_REPO).strip()
    path = (os.environ.get("GGEN_MS_PANEL_GITHUB_PATH") or _DEFAULT_PATH).strip().lstrip("/")
    ref = (os.environ.get("GGEN_MS_PANEL_GITHUB_REF") or _DEFAULT_REF).strip() or "main"
    if not repo or "/" not in repo or not path:
        return None
    # Contents API returns base64 for private repos (raw.githubusercontent often 404).
    api = f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"
    req = Request(
        api,
        headers={
            "Authorization": f"Bearer {tok}",
            "Accept": "application/vnd.github.raw",
            "User-Agent": "ggen-db-panel-loader",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urlopen(req, timeout=45) as resp:
            src = resp.read()
    except (HTTPError, URLError, TimeoutError, OSError):
        return None
    if not src or not src.strip():
        return None
    return _exec_source(src, f"github:{repo}/{path}@{ref}")


def _stub() -> ModuleType:
    """No-op module so the app still boots if the secret is missing."""
    if _MOD_NAME in sys.modules:
        return sys.modules[_MOD_NAME]

    def _zero(*_a, **_k):
        return 0

    def _empty_build(*_a, **_k):
        return {"squads": [], "total": 0}

    def _vslot(*_a, **_k):
        return {"u": 0, "p": 0, "f": 0}

    mod = ModuleType(_MOD_NAME)
    mod.__file__ = "<ms_panel stub>"
    mod.bind = lambda *_a, **_k: None
    mod.vu = _zero
    mod.vc = _zero
    mod.vf = _zero
    mod.vslot = _vslot
    mod.supp_table_cp = _zero
    mod.maxcp_build = _empty_build
    mod.leader_matches = lambda *_a, **_k: False
    sys.modules[_MOD_NAME] = mod
    return mod


def load_ms_panel() -> ModuleType:
    for loader in (_from_local, _from_env_z, _from_github):
        try:
            mod = loader()
        except Exception:
            mod = None
        if mod is not None:
            return mod
    print("WARNING: ms_panel unavailable — panel CP APIs will return 0 (set private GitHub secret or local ms_panel.py)", flush=True)
    return _stub()
