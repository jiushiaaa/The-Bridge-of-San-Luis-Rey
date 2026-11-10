#!/usr/bin/env python3
"""Print source-bound jobs for the built-in image tool; never invokes a paid API."""
import json
import sys
from pathlib import Path

BOOK = Path(__file__).resolve().parents[1] / 'workspace/sanluisrey'
g = json.loads((BOOK / 'final_game.json').read_text())
accepted = json.loads((BOOK / 'authoring/generated-images.json').read_text())
done = {r['id'] for r in accepted}
roles = {
    'e_maria': 'Maria, the anxious noblewoman and mother of Clara',
    'e_clara': 'Clara, the composed daughter of Maria',
    'e_pepita': 'Pepita, the young orphan companion',
    'e_abbess': 'Mother Maria del Pilar, the stout older abbess',
    'e_camila': 'Camila, the actress known as La Perichole',
    'e_pio': 'Pio, the thin weathered theatre mentor',
    'e_esteban': 'Esteban, the young laborer twin; exactly the same face as Manuel',
    'e_manuel': 'Manuel, the young laborer twin; exactly the same face as Esteban',
    'e_captain': 'Captain Alvarado, the broad, older weathered seaman',
    'e_jaime': 'Jaime, Camila\'s delicate young son',
    'e_viceroy': 'Don Andres, the heavy aging Spanish viceroy',
    'e_archbishop': 'the heavy older Archbishop of Lima, in violet',
    'e_juniper': 'Brother Juniper, the earnest Franciscan in brown',
}
style = ('Use case: historical-scene. Asset type: distinct story CG for the literary game The Bridge of San Luis Rey. '
         'Create a wide landscape 16:9 finished gouache and delicate colored-pencil illustration on warm paper, '
         'painterly realism, eighteenth-century colonial Peru unless the scene explicitly says Spain. '
         'Muted sage, umber, ivory and terracotta, subtle atmospheric depth, readable value contrast, restrained natural emotions. '
         'This is a complete narrative moment, not a portrait montage or collage. No captions, legible writing, watermarks, '
         'modern objects, photorealistic plastic skin, fantasy costume or supernatural effects. '
         'Compose people in their environment, leave breathing room, preserve ordinary human proportions and distinct ages. ')
out = []
for c in g['cards']:
    if c['id'] in done:
        continue
    refs = []
    labels = []
    ready = True
    for eid in c.get('cgChars', []):
        entry = g['entries'][eid]
        variant = c.get('cgCharVariants', {}).get(eid)
        image = entry['variants'][variant]['avatar'] if variant else entry['avatar']
        path = str(BOOK / image)
        if not Path(path).exists():
            ready = False
        if path not in refs:
            refs.append(path)
        labels.append(f"Reference {refs.index(path)+1}: {roles[eid]}" + (f', {variant} life-stage' if variant else ''))
    if not ready:
        continue
    prompt = style + '\nScene: ' + c['cgPrompt'] + '\nIdentity references: ' + '; '.join(labels) + '. Preserve these facial identities and art medium, but draw the NEW scene and pose; references are not composition templates.'
    out.append({'id': c['id'], 'file': c['cg'], 'title': c['title'], 'prompt': prompt, 'refs': refs})
if len(sys.argv) > 1:
    ids = set(sys.argv[1:])
    out = [j for j in out if j['id'] in ids]
print(json.dumps(out, ensure_ascii=False))
