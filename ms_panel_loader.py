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
    import json

    tok = _token()
    if not tok:
        return None
    repo = (os.environ.get("GGEN_MS_PANEL_GITHUB_REPO") or _DEFAULT_REPO).strip()
    path = (os.environ.get("GGEN_MS_PANEL_GITHUB_PATH") or _DEFAULT_PATH).strip().lstrip("/")
    ref = (os.environ.get("GGEN_MS_PANEL_GITHUB_REF") or _DEFAULT_REF).strip() or "main"
    if not repo or "/" not in repo or not path:
        return None
    api = f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"
    headers = {
        "Authorization": f"Bearer {tok}",
        "User-Agent": "ggen-db-panel-loader",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    src: Optional[bytes] = None
    # 1) Prefer JSON contents (works for private repos with Contents: Read).
    try:
        req = Request(api, headers={**headers, "Accept": "application/vnd.github+json"})
        with urlopen(req, timeout=45) as resp:
            meta = json.loads(resp.read().decode("utf-8", "replace"))
        if isinstance(meta, dict) and meta.get("encoding") == "base64" and meta.get("content"):
            src = base64.b64decode("".join(str(meta["content"]).split()))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as e:
        print(f"WARNING: ms_panel github json fetch failed: {type(e).__name__}", flush=True)
        src = None
    # 2) Fallback: raw Accept (some tokens only allow this).
    if not src:
        try:
            req = Request(api, headers={**headers, "Accept": "application/vnd.github.raw"})
            with urlopen(req, timeout=45) as resp:
                src = resp.read()
        except (HTTPError, URLError, TimeoutError, OSError) as e:
            print(f"WARNING: ms_panel github raw fetch failed: {type(e).__name__}", flush=True)
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


_LOAD_SOURCE = "stub"


def load_source() -> str:
    return _LOAD_SOURCE


def load_ms_panel() -> ModuleType:
    global _LOAD_SOURCE
    for name, loader in (("local", _from_local), ("env_z", _from_env_z), ("github", _from_github)):
        try:
            mod = loader()
        except Exception as e:
            print(f"WARNING: ms_panel {name} load failed: {type(e).__name__}", flush=True)
            mod = None
        if mod is not None:
            _LOAD_SOURCE = name
            print(f"ms_panel loaded via {name}", flush=True)
            return mod
    _LOAD_SOURCE = "stub"
    print(
        "WARNING: ms_panel unavailable — panel CP APIs will return 0 "
        "(need local ms_panel.py, GGEN_MS_PANEL_Z, or private GitHub token access to ggen_ms_panel)",
        flush=True,
    )
    return _stub()
