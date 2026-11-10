#!/usr/bin/env python3
"""Safe incremental English revision against an explicit Chinese source snapshot.

status: report changed/new text without writing to either manuscript.
prepare: export only those paragraphs, retaining the previous English as reference.
merge: validate reviewed revisions, then update the pack and its source snapshot.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ['LUMI_GAME'] = 'slr'
from i18n_project import BOOK
from i18n_sync import Builder, verify, parse_ptr, set_at
from i18n_apply_glossary import localize
from i18n_check import check

FOLDER = BOOK / 'i18n/en'
SOURCE = BOOK / 'final_game.json'
PACK = FOLDER / 'final_game.json'
BASE = FOLDER / 'source-baseline.json'
PENDING = FOLDER / 'revision-pending.json'
TRANSLATIONS = FOLDER / 'revision-translations.json'
GLOSSARY = BOOK / 'i18n/glossary.json'


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def write(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def plan(source, baseline, pack):
    builder = Builder('en', source, baseline, pack, precise=True)
    draft = builder.build()
    return builder, draft


def glossary_errors(source, glossary):
    errors = []
    for eid, entry in source['entries'].items():
        row = glossary.get('entries', {}).get(eid, {})
        if row.get('zh-CN') != entry['name']:
            errors.append(f'{eid}: update the Chinese name in glossary.json to match the manuscript.')
        if not isinstance(row.get('en'), str) or not row['en'].strip():
            errors.append(f'{eid}: a reviewed English glossary name is required.')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['status', 'prepare', 'merge'])
    args = parser.parse_args()
    source, baseline, pack = load(SOURCE), load(BASE), load(PACK)
    glossary = load(GLOSSARY)
    errors = glossary_errors(source, glossary)
    if errors:
        raise SystemExit('\n'.join(errors))
    if args.action == 'merge':
        pending = load(PENDING)
        if pending['source_hash'] != digest(source):
            raise SystemExit('Chinese changed after preparation. Preserve the reviewed file and prepare a new revision; no files changed.')
        if pending['pack_hash'] != digest(pack):
            raise SystemExit('English changed after preparation. Reconcile those edits first; no files changed.')
        if pending.get('baseline_hash') != digest(baseline) or pending.get('glossary_hash') != digest(glossary):
            raise SystemExit('Source baseline or glossary changed after preparation. Preserve the reviewed revisions and prepare again; no files changed.')
        translations = load(TRANSLATIONS) if TRANSLATIONS.exists() else {}
        errors = verify('en', pending['todo'], translations)
        extra = set(translations) - {r['path'] for r in pending['todo']}
        if extra:
            errors.append(f'Unexpected translation paths: {sorted(extra)[:5]}')
        if errors:
            raise SystemExit('\n'.join(errors))
        _, draft = plan(source, baseline, pack)
        for row in pending['todo']:
            set_at(draft, parse_ptr(row['path']), translations[row['path']])
        localize(draft, source, glossary, 'en')
        errors = check('en', pack=draft)
        if errors:
            raise SystemExit('\n'.join(errors))
        # Keep a review record before replacing the language pack. Old editorial
        # drafts remain untouched; the current pack is authoritative thereafter.
        archive = FOLDER / 'revisions' / f"{pending['source_hash'][:12]}-{pending['pack_hash'][:12]}.json"
        archive.parent.mkdir(parents=True, exist_ok=True)
        write(archive, {**pending, 'translations': translations})
        write(PACK, draft)
        write(BASE, source)
        PENDING.unlink()
        if TRANSLATIONS.exists():
            TRANSLATIONS.unlink()
        print(f"English synchronized: {len(pending['todo'])} revised strings; existing translations preserved.")
        return
    builder, draft = plan(source, baseline, pack)
    print(f'English: {builder.reused} unchanged strings reused; {len(builder.todo)} strings need review.')
    for row in builder.todo[:12]:
        print(row['path'], row['ctx'], row['zh'][:65])
    if args.action == 'status':
        raise SystemExit(1 if builder.todo else 0)
    if PENDING.exists() or TRANSLATIONS.exists():
        raise SystemExit('A revision is already pending; existing review files were preserved.')
    write(PENDING, {'source_hash': digest(source), 'pack_hash': digest(pack),
                    'baseline_hash': digest(baseline), 'glossary_hash': digest(glossary), 'todo': builder.todo})
    write(TRANSLATIONS, {})
    print(f'Prepared {PENDING.name}. Put reviewed path → English text in {TRANSLATIONS.name}, then merge.')


if __name__ == '__main__':
    main()
