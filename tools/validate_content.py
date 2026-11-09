#!/usr/bin/env python3
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
book=json.loads((ROOT/'game/content/game.json').read_text())
errors=[]
def check(ok,message):
 if not ok: errors.append(message)
check(book['title']=='圣路易斯雷大桥','正式标题改变')
check(book.get('sourceDigest')==hashlib.sha256((ROOT/'game/content/manuscript.md').read_bytes()+(ROOT/'tools/build_content.py').read_bytes()).hexdigest(),'生成数据与文稿/生成器不一致，请先运行 python3 tools/build_content.py')
check(len(book['cards'])==36,'主线必须有 36 张残页')
check(len(book['ending'])==6,'必须保留六节完整尾声')
check(len(set(c['id'] for c in book['cards']))==36,'残页 ID 重复')
plain=lambda s:re.sub(r'\{\{e_[a-z0-9_]+\|([^}]*)\}\}',r'\1',s)
counts={}
all_quotes=[]
for ch in book['chapters']:
 cards=[c for c in book['cards'] if c['chapter']==ch['id']]
 check(len(cards)==12,f'第 {ch["id"]} 卷卡数错误')
 known=set(); unlocked={c['id'] for c in cards if c.get('start')};previous=None
 while previous!=(len(known),len(unlocked)):
  previous=(len(known),len(unlocked))
  for c in cards:
   if c['id'] in unlocked: known.update(c['entries'])
   if known.intersection(c['entries']): unlocked.add(c['id'])
 check(len(unlocked)==12,f'第 {ch["id"]} 卷存在无法搜寻的残页')
 for g in ch['gate']:check(g['answer'] in known,'卷末答案不可发现')
 counts[str(ch['id'])]=sum(len(re.sub(r'\s','',plain(s['text']))) for c in cards for s in c['segments'])
for c in book['cards']:
 body='\n'.join(s['text'] for s in c['segments'])
 check(len(re.findall(r'[\u4e00-\u9fff]',plain(body)))>=300,c['id']+' 主文过短')
 check(bool(c['sources']),c['id']+' 缺来源')
 check(all(id in book['entries'] for id in c['entries']),c['id']+' 未定义人物')
 check(set(re.findall(r'\{\{(e_[a-z0-9_]+)\|',body))==set(c['entries']),c['id']+' 词条与正文不一致')
 check(all(b['answer'] in c['entries'] for b in c['blanks']),c['id']+' 人物填空不可发现')
 if c['kind']=='dream':check(c['id']=='A06' and c['period'] is None,'梦境混入真实时序')
 else:check(isinstance(c['period'],int) and 0<=c['period']<len(book['chapters'][c['chapter']-1]['periods']),c['id']+' 阶段无效')
 all_quotes.extend((c['id'],s['text']) for s in c['segments'] if s['kind']=='quote')
for i,e in enumerate(book['ending']):all_quotes.extend((f'E{i+1:02}',p[2:]) for p in e['text'].split('\n\n') if p.startswith('> '))
paths=set()
def collect(x):
 if isinstance(x,dict):
  for v in x.values():collect(v)
 elif isinstance(x,list):
  for v in x:collect(v)
 elif isinstance(x,str) and x.startswith('slr-assets/'):paths.add(x)
collect(book)
for p in paths:check((ROOT/'game/public'/p).is_file(),'素材缺失 '+p)
manifest=json.loads((ROOT/'game/content/assets.json').read_text())
asset_files={a['file'] for a in manifest['assets']}
check(paths.issubset(asset_files),'正文素材尚未全部登记到素材台账')
for asset in manifest['assets']:
 p=ROOT/'game/public'/asset['file']
 check(p.is_file(),'台账素材缺失 '+asset['file'])
 if p.is_file():
  check(hashlib.sha256(p.read_bytes()).hexdigest()==asset['sha256'],'台账 SHA-256 不一致 '+asset['file'])
quote_report='本地原书不存在；未执行购书逐字校对'
source=ROOT/'知识库/原著与译本/ZH_C_中文译本/pages.json'
if source.exists():
 pages=json.loads(source.read_text())
 raw=''.join(re.sub(r'^\s*\d+\s*\n','',p['text']) for p in pages)
 norm=lambda s:re.sub(r'\s','',s)
 for id,q in all_quotes:check(norm(q) in norm(raw),id+' 引文未与本地译文逐字对应')
 matched=sum(norm(q) in norm(raw) for _,q in all_quotes)
 quote_report=f'{matched}/{len(all_quotes)} 条原文选读与本地中文 PDF 提取文本逐字匹配（忽略排版空白）'
total=sum(counts.values())
check(total>=16000,'主线文本低于完整体量约定')
intro=sum(len(re.sub(r'\s','',plain(p))) for c in book['chapters'] for p in c['intro'])
ending=sum(len(re.sub(r'\s','',plain(e['text']))) for e in book['ending'])
report={'cards':36,'entries':len(book['entries']),'chapters':3,'ending_sections':6,'main_text_characters_without_whitespace':total,'intro_characters':intro,'ending_characters':ending,'mandatory_text_characters_without_whitespace':total+intro+ending,'chapter_characters':counts,'referenced_media':len(paths),'registered_assets':len(asset_files),'quotes':quote_report,'errors':errors,'timing_note':'字符体量与机关操作只提供时长估算；自动测试不证明真人首次游玩超过 40 分钟。'}
(ROOT/'docs/内容校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
