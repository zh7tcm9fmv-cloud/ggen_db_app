#!/usr/bin/env python3
"""Scan ggen_db_videos/unit for gasha_*.mp4; write data/gasha_pull_video_ids.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'gasha_pull_video_ids.json'
DEFAULT_VIDEOS = ROOT.parent / 'ggen_db_videos' / 'unit'


def main():
    videos_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_VIDEOS
    if not videos_dir.is_dir():
        print(f'Videos dir not found: {videos_dir}', file=sys.stderr)
        sys.exit(1)
    ids = []
    for p in videos_dir.glob('*.mp4'):
        stem = p.stem.replace('_40534656', '')
        if stem.startswith('gasha_'):
            ids.append(stem)
    ids = sorted(set(ids))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ids, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(ids)} gasha pull movie ids to {OUT}')


if __name__ == '__main__':
    main()
