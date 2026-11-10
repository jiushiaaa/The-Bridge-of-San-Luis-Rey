#!/usr/bin/env python3
"""Plan separately generated, source-bound archive and framing illustrations."""
import json
import sys
from pathlib import Path

BOOK = Path(__file__).resolve().parents[1] / 'workspace/sanluisrey'
g = json.loads((BOOK / 'final_game.json').read_text())
done = {r['id'] for r in json.loads((BOOK / 'authoring/generated-images.json').read_text())}
style = ('A finished literary gouache and delicate colored-pencil illustration on warm paper, '
         'painterly realism, eighteenth-century colonial Peru unless explicitly Spain. '
         'Muted sage, umber, ivory and terracotta, nuanced atmospheric depth, restrained emotions. '
         'Historical materials, ordinary proportions. No readable writing, lettering, watermark, '
         'signature, borders, collage, modern objects or supernatural effects. ')
jobs = []
for eid, entry in g['entries'].items():
    if entry['type'] == 'person':
        continue
    composition = ('Square environmental illustration, a complete inhabited place with clear spatial depth. '
                   if entry['type'] == 'place' else
                   'Square intimate still life, one clear focal subject, tactile materials, quiet negative space. ')
    jobs.append(dict(id=eid, file=entry['image'], title=entry['name'],
                     prompt=style + composition + '\nScene: ' + entry['imagePrompt'], refs=[]))

special = [
    ('intro-1', '第一卷序幕',
     'Wide 16:9 landscape. Brother Juniper, a small brown-robed Franciscan seen from behind, '
     'has stopped on an Andean footpath overlooking the newly empty span where a plant-fiber '
     'suspension bridge has just broken above a deep gorge. Broken ropes hang far below the stone '
     'approaches. The distant river catches the noon light. No bodies, falling people or injury. '
     'A still, bewildered witness, no heroic pose. Leave quiet shadowed space for overlay text.', ['e_juniper']),
    ('intro-2', '第二卷序幕',
     'Wide 16:9 landscape, modest rented room in colonial Lima at evening. One young dark-haired '
     'copyist sits quietly beside a wooden writing table, two simple cots in the room but the other '
     'one empty. A candle, basin and folded linen. The empty place is ordinary and tangible, no ghost, '
     'no apparition, no overt death scene. Leave quiet shadowed space for overlay text.', ['e_esteban']),
    ('intro-3', '第三卷序幕',
     'Wide 16:9 landscape. Adult actress Camila, dark curly hair and worn garnet theatre dress, '
     'stands alone just behind the curtain of a small colonial theatre after the performance. '
     'The dark empty auditorium beyond and the practical backstage are one coherent physical space. '
     'Her expression is tired and thoughtful, neither triumph nor defeat. Warm candlelight, '
     'no modern spotlight. Leave quiet shadowed space for overlay text.', ['e_camila']),
    ('ending', '尾声病房',
     'Wide 16:9 landscape. An elderly stout abbess in a plain dark habit and cream wimple carries '
     'a modest lantern along a convent sickroom at night. She quietly sets a water pitcher near '
     'a resting patient, simple beds, clean linen, soft adobe walls. The human action of care is '
     'the focus. No miracle, halo, triumphant rays or supernatural reconciliation. '
     'Leave darker quiet space for overlay text.', ['e_abbess']),
    ('mystery', '未辨认的身份',
     'Square anonymous upper-body silhouette in plain eighteenth-century clothing, gently out of '
     'focus and turned three-quarters away against warm cream paper. No visible recognizable face, '
     'no question mark, occult symbol, mask or threatening hood. A neutral placeholder for a person '
     'whose identity the reader has yet to discover. Soft umber and ivory.', []),
    ('scene-icon', '桥梁图标',
     'Square simple hand-painted emblem: a small curved braided plant-fiber footbridge with a few '
     'wooden boards, sage and umber on a warm cream ground. Centered and readable at small size, '
     'gentle pencil edges, no words, letters, mountains, steel cables or ornamental badge.', []),
]
for sid, title, scene, people in special:
    refs = [str(BOOK / g['entries'][eid]['avatar']) for eid in people]
    identity = (' Preserve the facial identity and art medium of the supplied reference, '
                'draw this new scene and pose, not its portrait composition.' if refs else '')
    jobs.append(dict(id=sid, file=f'slr-assets/{sid}.png', title=title,
                     prompt=style + scene + identity, refs=refs))
requested = set(sys.argv[1:])
print(json.dumps([j for j in jobs if j['id'] not in done and
                  (not requested or j['id'] in requested)], ensure_ascii=False))
