"""Read-only audit after sync, mount repack and app build (no native fixture run active)."""
from pathlib import Path
import hashlib
import json
import tarfile

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'octave-playground'
HARNESS = ROOT / 'engr183-harness'
projects = {
    'u09-gp09-cooling': 'U09_GP09_Cooling.m',
    'u09-apa09-pump': 'U09_APA09_Pump.m',
}

for project, filename in projects.items():
    starter = (HARNESS / 'assignments' / project / filename).read_bytes()
    assert starter == (HARNESS / '_verify/unsolved' / project / filename).read_bytes()
    assert b'TODO' in starter and b'Alex Rivera' not in starter
    for base in [APP / 'public/starters', APP / 'dist/starters']:
        assert sorted(p.name for p in (base / project).iterdir()) == [filename]
        assert (base / project / filename).read_bytes() == starter
    metadata = json.loads((APP / 'src/units' / f'{project}.json').read_text(encoding='utf-8'))
    assert metadata['id'] == project and metadata['files'] == [filename]
    assert metadata['unitNumber'] == 9 and not metadata.get('dataFiles')
    print(f'PASS exact canonical / untouched / public / dist starter: {project}')

checks = sorted((HARNESS / 'tests').glob('u09_*.m'))
assert len(checks) == 5
for archive in [APP / 'public/xeus/xeus-kernel/kernel_packages/mount_0.tar.gz',
                APP / 'dist/xeus/xeus-kernel/kernel_packages/mount_0.tar.gz']:
    with tarfile.open(archive) as mounted:
        assert not any('/_verify/' in n or '/solved/' in n or 'instructor' in n.lower() for n in mounted.getnames())
        for source in checks + [HARNESS / '+engr183/report.m']:
            relative = source.relative_to(HARNESS)
            assert (APP / 'vfs/engr183' / relative).read_bytes() == source.read_bytes()
            assert mounted.extractfile('engr183/' + relative.as_posix()).read() == source.read_bytes()
    print(f'PASS current checkers/report, no instructor fixtures: {archive.relative_to(ROOT)}')
for base in [APP / 'public', APP / 'dist']:
    assert not any(p.name in ('_verify', 'solved', 'instructor-solutions') for p in base.rglob('*') if p.is_dir())
print('CHECKER_SHA=' + hashlib.sha256((HARNESS / 'tests/u09_numeric_check.m').read_bytes()).hexdigest())
