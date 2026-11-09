#!/usr/bin/env python3
"""Compile the editable manuscript; source references are editorial metadata, never invented by the engine."""
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
CONTENT=ROOT/'game/content'
text=(CONTENT/'manuscript.md').read_text()
parts={m[0]:(m[1],m[2].strip()) for m in re.findall(r'^## ([A-Z]\d+) (.+)\n([\s\S]*?)(?=^## |\Z)',text,re.M)}
asset=lambda name:'slr-assets/'+name
BG={
 'bridge':asset('BG01_圣路易斯雷大桥.png'), 'letter':asset('BG02_山中客栈的信.png'),
 'room':asset('BG03_双生子的房间.png'), 'stage':asset('BG04_剧院落幕后.png'),
 'abbey':asset('BG05_修院黄昏.png'), 'harbor':asset('BG06_港口清晨.png'), 'garden':asset('BG07_山中花园.png'),
}
people=[
 ('maria','侯爵夫人','唐娜·玛丽亚 · 一位写信的母亲','住在利马，女儿克拉拉远居西班牙。她的文字后来被人传诵，写信时却只想得到一个人的回应。','CH02_蒙特马约尔侯爵夫人.png',None,1,'35–108'),
 ('pepita','佩皮塔','十四岁的陪伴者','在修院长大，被院长寄予期望，后来陪伴侯爵夫人生活。受托照顾别人时，她也仍然需要被照顾。','CH01_佩皮塔.png',None,1,'74–108'),
 ('clara','克拉拉','侯爵夫人的女儿','婚后去了西班牙，既慷慨地帮助许多人，也与母亲保持艰难的距离。','portraits-1.png','100% 0%',1,'38–43;405–416'),
 ('abbess','院长','玛丽亚·德尔·皮拉尔','管理修院、孤儿院与医院。富有行动力，珍惜自己的工作，也担心自己死后这些工作会中断。','portraits-1.png','0% 0%',1,'74–78;388–417'),
 ('manuel','曼努埃尔','双生子之一 · 抄写员','与埃斯特班在修院长大，会说两个人发明的语言。替剧院抄写时，遇见了女演员卡米拉。','portraits-2.png','0% 0%',2,'110–196'),
 ('esteban','埃斯特班','双生子之一 · 抄写员','与曼努埃尔相依为命，做过抄写、装卸与许多零工。对于他们，语言有时不及沉默亲密。','portraits-2.png','0% 0%',2,'110–265'),
 ('captain','阿尔瓦拉多','远航的船长','到过许多地方，惯于做事，拙于安慰。兄弟曾替他卸货，院长也认识他。','portraits-2.png','100% 0%',2,'210–265'),
 ('pio','皮奥叔叔','老师、跑腿人、剧院的常客','熟悉许多人的秘密，热爱西班牙戏剧。这个称呼不是血缘证明；他与卡米拉的关系包含教养、照料和干涉。','portraits-1.png','100% 100%',2,'267–374'),
 ('camila','卡米拉','佩里科莱 · 米卡埃拉·维列加斯','不同称呼对应她人生中的不同身份：咖啡馆女孩、著名女演员、希望被郑重称呼的贵妇。','portraits-1.png','0% 100%',1,'118–170;267–374;390–415'),
 ('jaime','海梅','卡米拉的儿子','聪明、安静、体弱。他想学习，也很在意发病时旁人的目光。','portraits-2.png','100% 100%',3,'311–316;356–374'),
 ('juniper','胡尼佩尔','方济各会修士','从意大利来到秘鲁。他目睹桥难，想通过调查向人们证明自己相信的天意。','portraits-2.png','0% 100%',1,'23–33;376–387'),
 ('viceroy','总督','唐·安德烈斯','秘鲁的总督，卡米拉的保护者，海梅的父亲。身份、教养、疲倦与自负同在。',None,None,2,'304–316'),
]
entries={}
for id,name,role,desc,img,pos,after,src in people:
 e={'name':name,'role':role,'desc':desc,'after':after,'sources':['EN_D-P'+src]}
 if img:e['image']=asset(img)
 if pos:e['portraitPosition']=pos
 entries['e_'+id]=e

# id, period (-1 = narrated dream), source paragraph span, ZH PDF pages, background, identity question(s)
rows=[
 ('A01',0,'35–37','14','letter',[('被迫结婚、后来把全部爱倾注给女儿的人','maria')]),
 ('A02',0,'38–40','14–15','letter',[('选择远嫁西班牙的人','clara')]),
 ('A03',1,'41–43','15–16','letter',[('这些信最想吸引的那一位读者','clara')]),
 ('A04',1,'44–57','17–20','stage',[('在台上临时唱出讽刺的人','camila'),('想带女主人离开包厢的人','pepita')]),
 ('A05',1,'58–70','20–21','letter',[('因这次拜访而体会到“宽恕”的来访者','camila')]),
 ('A06',-1,'71–73','21–22','letter',[('做这场和解之梦的人','maria')]),
 ('A07',0,'74–78','22–23','abbey',[('被培养为继承者的孩子','pepita'),('为她安排这些考验的大人','abbess')]),
 ('A08',2,'79–85','23–25','bridge',[('怀孕的消息促成这趟旅程，她是','clara')]),
 ('A09',3,'86–88','25–26','letter',[('这封求助信原本要寄给谁','abbess')]),
 ('A10',3,'89–98','26–27','letter',[('把女孩已吃过饭理解成拒绝的人','maria')]),
 ('A11',3,'99–106','27','letter',[('以“不够勇敢”为由撕掉信的人','pepita')]),
 ('A12',4,'107–108','28','letter',[('写下所谓“第一封信”的人','maria')]),
 ('B01',0,'110–117','30–31','room',[('在修院里给兄弟讲故事的人','abbess')]),
 ('B02',1,'118–150','31–34','stage',[('替演员秘密写信的抄写员','manuel'),('这次不希望被告知秘密的平常代笔人','pio')]),
 ('B03',1,'151–166','35–36','room',[('躺在阴影里误以为自己已被排除的人','esteban')]),
 ('B04',1,'167–170','36–37','room',[('拒绝了演员下一次代笔邀请的人','manuel')]),
 ('B05',2,'171–180','37','room',[('每个整点更换冷湿布的照料者','esteban')]),
 ('B06',2,'181–196','38–39','room',[('死于病榻、没有走上断桥的人','manuel')]),
 ('B07',3,'197–209','39–41','abbey',[('用“曼努埃尔”回答姓名的幸存者','esteban')]),
 ('B08',0,'210','41','harbor',[('失去女儿后走向远洋的人','captain')]),
 ('B09',4,'211–239','42–43','harbor',[('接受远航工作、说出自己本名的人','esteban')]),
 ('B10',4,'240–254','43–44','room',[('尚未买好的礼物准备送给谁','abbess')]),
 ('B11',4,'255–264','44–45','room',[('在危机中走进房间、留下陪伴的人','captain')]),
 ('B12',5,'265','45','bridge',[('下到河边照看货物的人','captain'),('走上桥面的人','esteban')]),
 ('C01',0,'267–279','47–50','stage',[('被比作忙碌的蚂蚁的人','pio')]),
 ('C02',1,'280–286','50–51','stage',[('十二岁在咖啡馆唱歌的女孩','camila')]),
 ('C03',1,'287–303','51–53','stage',[('以沉默和口哨表达不满的老师','pio')]),
 ('C04',2,'304–310','54–58','garden',[('希望别人称自己“唐娜·米卡埃拉”的人','camila')]),
 ('C05',2,'311–316','57–58','garden',[('在阳光下担心发病的孩子','jaime')]),
 ('C06',3,'317–342','58–60','garden',[('终于为自己吝惜赞美而道歉的人','pio')]),
 ('C07',4,'343–347','60–61','letter',[('拒绝别人探视、又被闯入房间的人','camila')]),
 ('C08',4,'348–355','62','garden',[('假借“埃斯特雷拉”名字的人','pio')]),
 ('C09',4,'356–369','63','garden',[('被请求去利马住一年的人','jaime')]),
 ('C10',4,'370–373','63','garden',[('母亲要求先征得谁的同意','jaime')]),
 ('C11',5,'374','64','bridge',[('得到金币与发光小石头的人','jaime')]),
 ('C12',5,'374;108;265','28;45;64','bridge',[('原先约定过桥后让孩子休息的大人','pio')]),
]
cards=[]
for id,period,en,zh,bg,blanks in rows:
 title,body=parts[id]
 segs=[]
 for para in body.split('\n\n'):
  quote=para.startswith('> ')
  seg={'kind':'quote' if quote else 'narration','text':para[2:] if quote else para}
  if quote:seg['attribution']='原著选读 · 中文译本 PDF '+zh+' 页'
  segs.append(seg)
 mentions=list(dict.fromkeys(re.findall(r'\{\{(e_[a-z0-9_]+)\|',body)))
 for _,answer in blanks:
  assert 'e_'+answer in mentions,(id,answer,'answer must be discoverable on the page')
 card={'id':id,'chapter':'ABC'.index(id[0])+1,'title':title,'segments':segs,'entries':mentions,
  'blanks':[{'id':'who'+str(n+1),'prompt':q,'answer':'e_'+a,'hint':f'回看本页提到{entries["e_"+a]["name"]}的句子。提示不扣分。'} for n,(q,a) in enumerate(blanks)],
  'period':None if period<0 else period,'kind':'dream' if period<0 else 'event','image':BG[bg],
  'sources':['EN_D-P'+en,'ZH_C-PDF'+zh],
  'sourceNote':'正文依据原著改写，引用另以“原著选读”标注。段落号对应本地原著知识库；PDF 页码按文件页序。',
  'start':id in ['A01','A07','B01','B08','C01','C05']}
 if id=='A06':card['sourceNote']='这是小说叙述的梦，不是母女实际会面或已寄出的回信。梦境不进入真实事件时间线。'
 if id=='B08':card['sourceNote']='船长背景来自侯爵夫人的书信转述。其女儿去世与双生子童年的精确相对顺序未交代，归入“更早的年月”，组内不排序。'
 if id=='C12':card['sourceNote']='以原著第四部末尾为主体，关联第二、三部的返程信息；人物未在桥前交换完整经历，不增写集体告白。'
 cards.append(card)

def gate(q,a,n):return {'id':'g'+str(n),'prompt':q,'answer':'e_'+a,'hint':'回顾已归档的残页。'}
chapters=[
 {'id':1,'title':'第一卷 · 信','subtitle':'侯爵夫人与佩皮塔','question':'一封信，能否不再索取回信？','image':BG['letter'],'music':asset('M02_未寄出的信.m4a'),
 'intro':[parts['F01'][1],parts['F02'][1],'第一卷 · 信\n\n一位母亲把信寄往西班牙，一个女孩把信留在客栈桌上。沿着她们在文字里叫出的名字，寻找这一夜之前的生活。'],
 'periods':[{'title':'较早的年月','hint':'童年、婚姻、离别；佩皮塔受培养的往事。组内不强排先后。'},{'title':'信件与剧院','hint':'女儿远去之后的写作、剧院冒犯及登门道歉。'},{'title':'动身朝圣','hint':'怀孕消息传来，走向山中的圣地。'},{'title':'客栈的傍晚','hint':'写信、读信、吃饭、撕信，都在同一晚。'},{'title':'黎明与返程','hint':'写下第五十六封信，隔了两天踏上归途。'}],
 'gate':[gate('没有收到那封被撕掉的求助信的人','abbess',1),gate('把第五十六封信称作“第一封”的人','maria',2),gate('与侯爵夫人一起返回利马、走上桥的人','pepita',3)],
 'reflection':{'question':'佩皮塔所说的“不够勇敢”，在你看来是什么？','options':['她仍在用大人的期待要求自己。','她想收回一次让自己暴露的求助。','我还不能替她解释这句话。']},
 'recap':['母女关系的困难从未被一场真实的和解消除。梦中的亲近留在梦里。','求助信未寄出；侯爵夫人在客栈里读过，随后写下自己的第五十六封信。','两天后，侯爵夫人与佩皮塔返程。她们的死不证明那一夜的变化毫无意义，也不证明灾难是一种奖赏。']},
 {'id':2,'title':'第二卷 · 名字','subtitle':'双生子与船长','question':'另一个人不在了，自己的名字要怎样继续？','image':BG['room'],'music':asset('M03_两个人的语言.m4a'),
 'intro':['第二卷 · 名字\n\n有两个人从小发明了一种只属于他们的语言。周围的人分不清他们；他们却几乎不必解释自己。','一位演员走进抄写员的房间。她只需要有人替她写信，有个人却以为，她把整个世界一同带走了。\n\n这一卷里，两个相同的面孔会走向不同的结局。请留意每一次名字被叫出的时刻。'],
 'periods':[{'title':'更早的年月','hint':'兄弟共同生活的背景、船长失去女儿的往事；彼此的精确先后未知。'},{'title':'秘密与退让','hint':'演员的信、午夜来访、拒绝继续代笔。'},{'title':'病中的几夜','hint':'膝伤、照料、清醒与失控的话，直到曼努埃尔去世。'},{'title':'独自游荡','hint':'幸存者借用兄弟的名字，院长尝试接近他。'},{'title':'远行的邀请','hint':'库斯科相见、礼物的打算、出发前的危机与陪伴。'},{'title':'去利马的路','hint':'到达大桥，行人与货物分走两条路。'}],
 'gate':[gate('先死于病榻的人','manuel',1),gate('仍活着，却曾用死者名字回答的人','esteban',2),gate('下河谷照看货物、因而没有走上断桥的人','captain',3)],
 'reflection':{'question':'桥难之后，你怎样看船长那一次伸手？','options':['后来发生的事没有取消那一次陪伴。','它没有承诺治愈，只让一段路可以一起走。','我想先记住他的动作，不替它总结。']},
 'recap':['曼努埃尔爱上演员并替她写信，埃斯特班害怕自己被排除；两人的痛苦并不是同一份爱情。','曼努埃尔先死于膝伤后的疾病。埃斯特班一度借用他的名字，后来接受船长的远航邀请。','船长在危机中留下陪伴，到桥边却因货物走下河谷。埃斯特班随桥坠落，不能因此把前一次危机改写成故意投桥。']},
 {'id':3,'title':'第三卷 · 台下','subtitle':'皮奥、卡米拉与海梅','question':'照料一个人，是否也要允许他离开自己的安排？','image':BG['stage'],'music':asset('M04_落幕后的房间.m4a'),
 'intro':['第三卷 · 台下\n\n有个人用半生把一位女孩教成出色的演员。灯熄以后，他仍想替她安排更好的未来。','她离开舞台，要求换一个称呼。后来，她把门关上；他想尽办法再进去。\n\n最后要出门的人，却是一个提着小包袱的孩子。'],
 'periods':[{'title':'相遇以前','hint':'皮奥的来历、本领与爱好。'},{'title':'剧场岁月','hint':'咖啡馆女孩的学艺、掌声与幕后的训练。'},{'title':'离开舞台','hint':'贵妇身份的追求、母子在山中生活的剪影。'},{'title':'花园相会','hint':'病前那一次黄昏谈话，旧称呼与迟来的道歉。'},{'title':'病后探访','hint':'天花后的关门、假声、债务与带走海梅的条件。'},{'title':'最后的清晨','hint':'孩子来到客栈，出发，旅人在桥边相逢。'}],
 'gate':[gate('“埃斯特雷拉”哭声背后的真实人物','pio',1),gate('要求先征得孩子意愿的母亲','camila',2),gate('带着金币与发光小石头出发的孩子','jaime',3)],
 'reflection':{'question':'回看皮奥的照料，你想留下哪一种复杂之处？','options':['帮助与控制可以同时出现在一段关系里。','善意不能替对方答应一切。','我愿意保留矛盾，不把他归成单一的人。']},
 'recap':['皮奥“叔叔”并非血缘父亲。培养与照料真实存在，权力、苛刻与债务压力也真实存在。','卡米拉同意的条件是海梅愿意。小说没有逐字记下母子次日的谈话。','海梅与皮奥上路，另外三名旅人也到达桥边。五人的生活在此交汇，幸存者的故事却尚未结束。']},
]
ending=[]
for i in range(1,7):
 id=f'E{i:02d}';title,body=parts[id]
 ending.append({'title':title,'text':body,'image':BG['bridge' if i<=2 else 'abbey'],'sources':['EN_D-P'+['376–379','380–387','388–390','391–404','405–414','415–417'][i-1],'ZH_C-PDF'+['66–67','68–69','69–70','70–71','71–72','72–73'][i-1]]})
book={'id':'san-luis-rey','version':1,'title':'圣路易斯雷大桥','subtitle':'一座桥，五个生命，留下的人。','entries':entries,'cards':cards,'chapters':chapters,'ending':ending,'credits':[
 '原著：Thornton Wilder, The Bridge of San Luis Rey（1927）；1928 年普利策小说奖。',
 '核心玩法改编自柳柳《悉达多》开源模板：收集词条、搜寻残页、辨认人物、整理事件、卷末回顾。',
 '本作将时间轴改为有来源依据的阶段归档；梦境单独收录。取消体力、爱与善恶评分，结尾保留幸存者的日常。',
 '正文为依据原著的中文改写。“原著选读”使用作者提供的已购中文译本；本地知识库保存原著及逐页定位，公开工程不包含整本电子书。',
 '画面由 OpenAI image_gen 生成；音乐由 SeedAudio 1.0 生成，音量经技术处理。人物是基于小说的创作形象，不是历史人物肖像考证。',
 '字体：Noto Serif SC、Noto Sans SC 与 Inter；第三方说明及素材记录随工程保留。',
 '本作中的圣路易斯雷桥难属于小说世界。秘鲁历史、殖民背景与真实编桥技艺不等于为这场虚构事故提供史实证明。',
]}
book['sourceDigest']=hashlib.sha256(text.encode()+Path(__file__).read_bytes()).hexdigest()
(CONTENT/'game.json').write_text(json.dumps(book,ensure_ascii=False,indent=2)+'\n')
provenance={'edition':'1.0.0','method':'三卷正文逐卡改写；引文为用户提供中文译本的短选段。段落编号来自本地 EN_D 稳定索引。',
 'sources':{'EN_D':'Thornton Wilder, The Bridge of San Luis Rey, Project Gutenberg eBook 69768; 本地 paragraph index EN_D-P0001…P0419','ZH_C':'用户提供已购中文 PDF，73 文件页；公开仓库不含整本电子书'},
 'cards':[{k:c[k] for k in ['id','title','kind','sources','sourceNote']} for c in cards],
 'frames':[{'id':f'F{i:02d}','sources':['EN_D-P'+span,'ZH_C-PDF10–12']} for i,span in [(1,'23–25'),(2,'26–33')]],
 'ending':[{'title':e['title'],'sources':e['sources']} for e in ending],
 'quotes':[{'card':c['id'],'text':s['text'],'attribution':s['attribution']} for c in cards for s in c['segments'] if s['kind']=='quote'] + [{'card':f'E{i:02d}','text':p[2:],'attribution':'原著选读 · 中文译本 '+e['sources'][1]} for i,e in enumerate(ending,1) for p in e['text'].split('\n\n') if p.startswith('> ')],
 'boundaries':['A06 是梦境，不作为真实时序节点。','B08 来自书信转述；船长女儿去世与兄弟童年未强排先后。','曼努埃尔不在五名坠桥者中。','海梅早先七岁肖像不等于事故当日年龄。','尾声从六年后修士被处刑回跳到事故后葬礼，再推进一年后的卡米拉来访。','结尾思想属于院长，没有给修士的假说盖章。']}
(CONTENT/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print(f'Built {len(cards)} cards, {len(entries)} entries, {len(ending)} ending sections.')
