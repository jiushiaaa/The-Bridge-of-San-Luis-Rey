#!/usr/bin/env python3
"""Read image dimensions and mean luminance. Does not edit or resample images.

The inherited CG rule is Rec.601 mean <150 => cgDark. Measurements and hashes
are persisted so the authoring compiler can retain this rule across rebuilds.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageStat

BOOK = Path(__file__).resolve().parents[1] / 'workspace/sanluisrey'
path = BOOK / 'authoring/generated-images.json'
records = json.loads(path.read_text())
for r in records:
    file = BOOK / r['file']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == r['sha256']
    with Image.open(file) as img:
        channels = ImageStat.Stat(img).mean
        if len(channels) < 3:
            luminance = channels[0]
        else:
            luminance = .299 * channels[0] + .587 * channels[1] + .114 * channels[2]
        r['width'], r['height'] = img.size
        r['luminance_rec601'] = round(luminance, 2)
    if r['id'].startswith(('c1_', 'c2_', 'c3_')):
        r['cgDark'] = luminance < 150
        assert 1.65 <= r['width'] / r['height'] <= 1.9, r['id']
        print(r['id'], r['width'], r['height'], r['luminance_rec601'], r['cgDark'])
path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print('Measured', len(records), 'accepted images; no pixels modified.')
