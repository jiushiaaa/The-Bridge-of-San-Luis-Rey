#!/usr/bin/env python3
"""Decode every SLR track and report technical measurements, never listening claims."""
import array
import hashlib
import json
import math
import shutil
import subprocess
import sys
import tempfile
import wave
from datetime import datetime, timezone
from pathlib import Path

BOOK = Path(__file__).resolve().parents[1] / 'workspace/sanluisrey'


def db(value):
    return round(20 * math.log10(max(value, 1e-6)), 2)


def inspect(path, dest):
    if shutil.which('afconvert'):
        command = ['afconvert', '-f', 'WAVE', '-d', 'LEI16', str(path), str(dest)]
    elif shutil.which('ffmpeg'):
        command = ['ffmpeg', '-v', 'error', '-i', str(path), '-c:a', 'pcm_s16le', str(dest)]
    else:
        raise RuntimeError('Install a decoder: macOS afconvert or ffmpeg')
    subprocess.run(command, check=True, capture_output=True)
    peak = clipped = total = summed = squares = 0
    windows = []
    with wave.open(str(dest), 'rb') as wav:
        channels, rate, frames = wav.getnchannels(), wav.getframerate(), wav.getnframes()
        assert wav.getsampwidth() == 2
        while raw := wav.readframes(rate):
            values = array.array('h', raw)
            if sys.byteorder != 'little':
                values.byteswap()
            n = len(values)
            power = sum(v * v for v in values)
            p = max(abs(min(values)), abs(max(values)))
            peak = max(peak, p)
            clipped += sum(abs(v) >= 32760 for v in values)
            total += n
            summed += sum(values)
            squares += power
            windows.append(db(math.sqrt(power / n) / 32768))
    return {
        'duration_s': round(frames / rate, 3), 'channels': channels, 'sample_rate': rate,
        'sample_peak_dbfs': db(peak / 32768), 'rms_dbfs': db(math.sqrt(squares / total) / 32768),
        'clipped_samples': clipped, 'dc_offset': round(summed / total / 32768, 6),
        'first_second_rms_dbfs': windows[0], 'last_second_rms_dbfs': windows[-1],
        'quiet_seconds_below_minus60_dbfs': sum(x < -60 for x in windows),
        'loudest_second_rms_dbfs': max(windows),
    }


def main():
    tracks = json.loads((BOOK / 'authoring/generated-music.json').read_text())
    out = []
    with tempfile.TemporaryDirectory(prefix='slr-audio-audit-') as folder:
        for track in tracks:
            path = BOOK / track['file']
            measurements = inspect(path, Path(folder) / (track['id'] + '.wav'))
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            findings = []
            if measurements['clipped_samples']:
                findings.append('decoded samples approach digital full scale; review clipping')
            if measurements['last_second_rms_dbfs'] > -40:
                findings.append('tail is audible; review ending and playback fade')
            if measurements['first_second_rms_dbfs'] > -24:
                findings.append('opening is relatively loud; review playback fade')
            if not 90 <= measurements['duration_s'] <= 130:
                findings.append('duration outside planned range')
            if measurements['rms_dbfs'] < -40:
                findings.append('unusually quiet track')
            item = {'id': track['id'], 'file': track['file'], 'sha256': digest,
                    'source_hash_matches': digest == track['sha256'], **measurements, 'findings': findings}
            out.append(item)
            print(track['id'], measurements['duration_s'], 'RMS', measurements['rms_dbfs'], 'peak', measurements['sample_peak_dbfs'], flush=True)
    report = {'checked_at': datetime.now(timezone.utc).isoformat(),
              'scope': 'Full-file PCM decode, sample peak and RMS. Not LUFS, true peak, listening review or seamless-loop certification.',
              'count': len(out), 'unique_sha256': len({x['sha256'] for x in out}), 'tracks': out}
    dest = BOOK / 'authoring/audio-audit.json'
    dest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    assert len(out) == 32 and report['unique_sha256'] == 32
    assert all(x['source_hash_matches'] and x['channels'] == 2 and x['sample_rate'] == 44100 for x in out)
    print('Recorded', dest)


if __name__ == '__main__':
    main()
