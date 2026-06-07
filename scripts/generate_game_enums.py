"""
Parse Il2CppDumper Eternal.Domain.Enums from dump*.cs → data/game_enums.json.

Run: python scripts/generate_game_enums.py [path/to/dump.cs]
Default dump path: ../dump/dump2.2.0.cs (sibling of repo) or DUMP_CS env.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "game_enums.json"

DEFAULT_DUMP_CANDIDATES = [
    Path(os.environ.get("DUMP_CS", "")),
    ROOT.parent / "dump" / "dump2.2.0.cs",
    Path(r"C:\Users\Mikew0911\Desktop\dump\dump2.2.0.cs"),
]

ORIGINAL_RE = re.compile(
    r'\[OriginalName\("([^"]+)"\)\]\s*\n\s*public const \w+ \w+ = (\d+);'
)


def humanize_enum_key(key: str, enum_name: str) -> str:
    """EN display label from OriginalName suffix (e.g. HitRateChangeRate → Hit Rate Change Rate)."""
    prefix = enum_name + "_"
    if key.startswith(prefix):
        key = key[len(prefix):]
    if key in ("None", ""):
        return "None"
    parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", key)
    parts = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", parts)
    return parts.replace("_", " ").strip()


def resolve_dump_path(argv: list[str]) -> Path:
    if len(argv) > 1 and argv[1].strip():
        return Path(argv[1]).resolve()
    for p in DEFAULT_DUMP_CANDIDATES:
        if p and p.is_file():
            return p.resolve()
    raise SystemExit(
        "Dump not found. Pass path: python scripts/generate_game_enums.py path/to/dump.cs"
    )


def parse_enums(text: str) -> dict:
    enums: dict = {}
    lines = text.splitlines()
    i = 0
    in_domain = False
    while i < len(lines):
        line = lines[i]
        if line.strip() == "// Namespace: Eternal.Domain.Enums":
            in_domain = True
            i += 1
            continue
        if in_domain and line.startswith("// Namespace:") and "Eternal.Domain.Enums" not in line:
            in_domain = False
        if not in_domain:
            i += 1
            continue
        m = re.match(r"public enum (\w+) // TypeDefIndex:", line)
        if not m:
            i += 1
            continue
        enum_name = m.group(1)
        i += 1
        block_lines = []
        depth = 0
        while i < len(lines):
            ln = lines[i]
            if "{" in ln:
                depth += ln.count("{")
            if "}" in ln:
                depth -= ln.count("}")
                if depth <= 0:
                    break
            if depth > 0:
                block_lines.append(ln)
            i += 1
        block = "\n".join(block_lines)
        entries = {}
        labels = {}
        for om in ORIGINAL_RE.finditer(block):
            orig, val_s = om.group(1), om.group(2)
            val = int(val_s)
            short = orig.split("_", 1)[-1] if "_" in orig else orig
            entries[str(val)] = short
            labels[str(val)] = humanize_enum_key(orig, enum_name)
        if entries:
            enums[enum_name] = {"entries": entries, "labels": labels}
        i += 1
    return enums


def main():
    dump_path = resolve_dump_path(sys.argv)
    print(f"Parsing {dump_path} ...")
    text = dump_path.read_text(encoding="utf-8", errors="replace")
    enums = parse_enums(text)
    version = "2.2.0"
    vm = re.search(r"dump(\d+\.\d+\.\d+)\.cs", dump_path.name, re.I)
    if vm:
        version = vm.group(1)
    payload = {
        "version": version,
        "source": str(dump_path),
        "namespace": "Eternal.Domain.Enums",
        "enum_count": len(enums),
        "enums": enums,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({len(enums)} enums)")


if __name__ == "__main__":
    main()
