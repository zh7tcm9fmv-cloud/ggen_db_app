from pathlib import Path
root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
files = list(root.glob('_tmp*.py')) + list((root / 'scripts').glob('_tmp*.py'))
total = sum(f.stat().st_size for f in files)
lines = [f'count={len(files)}', f'bytes={total}', f'KB={total/1024:.1f}', f'MB={total/1024/1024:.3f}']
for f in sorted(files, key=lambda p: p.stat().st_size, reverse=True)[:8]:
    lines.append(f'{f.name}\t{f.stat().st_size/1024:.1f}KB')
(root / '_size_out.txt').write_text('\n'.join(lines), encoding='utf-8')
