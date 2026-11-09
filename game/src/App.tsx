import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import rawBook from '../content/game.json';
import { cardsOfChapter, chapterDone, newSave, plainText, resolved, transition, validateSave } from './engine';
import { browserAdapter, downloadSave, SaveCoordinator } from './storage';
import type { Action, Blank, Book, Card, Entry, Save } from './types';
const book = rawBook as Book;
const bridge = 'slr-assets/BG01_圣路易斯雷大桥.png';
type Tab = 'read' | 'timeline' | 'gate' | 'people';
type Modal = 'settings' | 'help' | 'credits' | 'restart' | null;

function Portrait({ entry, large = false }: { entry: Entry; large?: boolean }) {
  return <span className={`portrait ${large ? 'large' : ''}`} role="img" aria-label={entry.name}
    style={entry.image ? { backgroundImage: `url("${entry.image}")`, backgroundPosition: entry.portraitPosition || 'center', backgroundSize: entry.portraitPosition ? '200% 200%' : 'cover' } : {}}>
    {!entry.image && entry.name.slice(0,1)}
  </span>;
}
function Rich({ text, collect, disabled = false }: { text: string; collect?: (id: string) => void; disabled?: boolean }) {
  const parts: ReactNode[] = []; let last = 0;
  for (const m of text.matchAll(/\{\{(e_[a-z0-9_]+)\|([^}]*)\}\}/g)) {
    parts.push(text.slice(last, m.index));
    parts.push(collect && !disabled ? <button key={m.index} className="word" onClick={() => collect(m[1])} title={`记下${book.entries[m[1]].name}`}>{m[2]}</button> : m[2]);
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last)); return <>{parts}</>;
}
function Prose({ text }: { text: string }) {
  return <div className="prose">{text.split('\n\n').map((p,i) => p.startsWith('> ') ? <blockquote key={i}>{plainText(p.slice(2))}<cite>原著选读 · 中文译本</cite></blockquote> : <p key={i}>{plainText(p)}</p>)}</div>;
}
function Blanks({ blanks, answers, known, onAnswer, disabled = false }: { blanks: Blank[]; answers: Record<string,string>; known: string[]; onAnswer: (slot:string,value:string)=>void; disabled?: boolean }) {
  return <div className="blanks">{blanks.map(b => <label key={b.id}>
    <span>{b.prompt}</span><select aria-label={`人物：${b.prompt}`} value={answers[b.id] || ''} onChange={e => onAnswer(b.id,e.target.value)} disabled={disabled}>
      <option value="">请选择人物</option>{known.map(id => <option value={id} key={id}>{book.entries[id].name}</option>)}
    </select></label>)}</div>;
}

function Music({ save, title, report }: { save: Save | null; title: boolean; report: (s:string)=>void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const track = title || (save?.phase === 'intro' && save.chapter === 1 && save.introPage === 0) ? 'slr-assets/M01_大桥与疑问.m4a'
    : save?.phase === 'ending' || save?.phase === 'complete' ? 'slr-assets/M05_仍在人间.m4a' : book.chapters[(save?.chapter || 1)-1].music;
  useEffect(() => {
    const a=ref.current!; a.volume=0;
    if (save?.settings.music) void a.play().catch(() => report('音乐尚未播放。请在设置中重新开启配乐。'));
    else a.pause();
  }, [track, save?.settings.music, report]);
  return <audio ref={ref} src={track} loop preload="metadata" aria-label="背景音乐" onError={()=>report('配乐读取失败，阅读与存档仍可使用。')} onTimeUpdate={() => {
    const a=ref.current!; const fade=Math.min(1,a.currentTime/2,Number.isFinite(a.duration) ? (a.duration-a.currentTime)/2 : 1);
    a.volume=(save?.settings.volume ?? .24)*Math.max(0,fade);
  }} />;
}

function Dialog({ title, close, children }: { title: string; close:()=>void; children: ReactNode }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ const d=ref.current!; d.showModal(); return ()=>d.close(); },[]);
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current)close();}} aria-label={title}>
    <header><h2>{title}</h2><button onClick={close} className="quiet" aria-label="关闭对话框">关闭 ×</button></header><div className="dialog-body">{children}</div>
  </dialog>;
}

export function App() {
  const [save,setSave]=useState<Save|null>(null); const current=useRef<Save|null>(null);
  const [boot,setBoot]=useState<'loading'|'ready'|'error'>('loading'); const [bootError,setBootError]=useState('');
  const [storageStatus,setStorageStatus]=useState('正在读取存档…'); const coordinator=useRef<SaveCoordinator|null>(null);
  const [title,setTitle]=useState(true); const [tab,setTab]=useState<Tab>('read');
  const [notice,setNotice]=useState(''); const [modal,setModal]=useState<Modal>(null);
  const [entry,setEntry]=useState<string|null>(null); const [listOpen,setListOpen]=useState(false);
  const [reviewChapter,setReviewChapter]=useState<number|null>(null); const [endReview,setEndReview]=useState<number|null>(null);
  const [period,setPeriod]=useState(''); const importRef=useRef<HTMLInputElement>(null); const reader=useRef<HTMLDivElement>(null);
  const report=useCallback((s:string)=>setNotice(s),[]);
  const adopt=useCallback((s:Save,persist=true)=>{current.current=s;setSave(s);if(persist)coordinator.current?.persist(s);},[]);
  const load=useCallback(async()=>{
    setBoot('loading');
    try {
      const adapter=await browserAdapter(window.LumiMakerSdk);
      const c=new SaveCoordinator(book,adapter,setStorageStatus);coordinator.current=c;
      const s=await c.load(); current.current=s;setSave(s);setStorageStatus(adapter.mode+(s?' · 已读取':' · 尚无进度'));setBoot('ready');
    } catch(err){setBootError(err instanceof Error?err.message:'存档暂时读取失败，请重试。');setBoot('error');}
  },[]);
  useEffect(()=>{void load();},[load]);
  const dispatch=useCallback((a:Action)=>{
    if(!current.current)return;
    const r=transition(book,current.current,a);adopt(r.state);if(r.message)setNotice(r.message);
    if(a.type==='search'){setTab('read');setListOpen(false);setReviewChapter(null);}
    if(a.type==='gate' && r.state.phase!=='reading'){setReviewChapter(null);setTab('read');setListOpen(false);}
  },[adopt]);
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(id);},[notice]);
  useEffect(()=>{setPeriod('');reader.current?.scrollTo({top:0});},[save?.selected,save?.phase,save?.introPage,save?.endingPage,endReview,tab]);
  useEffect(()=>{
    if(title||boot!=='ready')return;
    let active=Date.now(),last=Date.now();
    const touch=()=>{active=Date.now();}; const visibility=()=>{last=Date.now();if(!document.hidden)active=last;};
    ['pointerdown','keydown','scroll','touchstart'].forEach(e=>window.addEventListener(e,touch,{passive:true,capture:true}));
    document.addEventListener('visibilitychange',visibility);
    const timer=setInterval(()=>{const now=Date.now();if(!document.hidden&&now-active<120000)dispatch({type:'tick',ms:Math.min(20000,now-last)});last=now;},10000);
    return()=>{clearInterval(timer);['pointerdown','keydown','scroll','touchstart'].forEach(e=>window.removeEventListener(e,touch,true));document.removeEventListener('visibilitychange',visibility);};
  },[title,boot,dispatch]);
  const start=()=>{adopt(newSave(book));setTitle(false);setModal(null);setTab('read');setReviewChapter(null);setEndReview(null);setListOpen(false);};
  const pickCard=(id:string)=>{dispatch({type:'select',id});setTab('read');setListOpen(current.current?.phase==='complete');};
  const importFile=async(file?:File)=>{
    if(!file)return;
    try {if(file.size>1_000_000)throw new Error('文件过大，不是本作的进度文件。');const s=validateSave(book,JSON.parse(await file.text()));adopt(s);setTitle(true);setTab('read');setReviewChapter(null);setEndReview(null);setModal(null);setNotice('进度文件已导入。');}
    catch(err){setNotice(err instanceof Error?err.message:'进度文件无法读取，原进度未改变。');}
    if(importRef.current)importRef.current.value='';
  };
  const chapter=book.chapters[(save?.chapter||1)-1];
  const viewChapter=reviewChapter||save?.chapter||1;
  const viewCards=cardsOfChapter(book,viewChapter);
  const selected=book.cards.find(c=>c.id===save?.selected);
  const cs=selected&&save?.cards[selected.id];
  const editable=Boolean(save&&selected&&selected.chapter===save.chapter&&save.phase==='reading');
  const done=save?cardsOfChapter(book,save.chapter).filter(c=>resolved(c,save)).length:0;
  const total=cardsOfChapter(book,save?.chapter||1).length;
  const found=save?cardsOfChapter(book,save.chapter).filter(c=>save.cards[c.id]).length:0;
  const chooseChapter=(lv:number)=>{setReviewChapter(lv);const first=cardsOfChapter(book,lv).find(c=>save?.cards[c.id]);if(first)pickCard(first.id);};

  const header=<header className="topbar">
    <button className="brand" onClick={()=>setTitle(true)} aria-label="返回封面"><img src="slr-assets/bridge.svg" alt=""/><span>圣路易斯雷大桥</span></button>
    <span className="top-chapter">{chapter.title}<small>{done}/{total} 已归档</small></span>
    <div className="top-actions"><button className="quiet" onClick={()=>setModal('help')}>玩法</button><button className="quiet" onClick={()=>setModal('settings')}>设置与存档</button></div>
  </header>;
  const nav=<nav className="tabs" aria-label="书页导航">{([['read','残页'],['timeline','时间线'],['gate','卷末'],['people','人物']] as [Tab,string][]).map(([id,label])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setListOpen(false);}}>{label}{id==='gate'&&done===total&&<span className="dot"/>}</button>)}</nav>;
  const cardList=<aside className={`card-list ${listOpen?'open':''}`} aria-label="残页目录">
    <div className="list-top"><span className="eyebrow">散落的故事</span><button className="mobile-only quiet" onClick={()=>setListOpen(false)}>收起 ×</button></div>
    <label className="chapter-select">翻阅<select aria-label="翻阅卷次" value={viewChapter} onChange={e=>chooseChapter(Number(e.target.value))}>{book.chapters.filter(c=>c.id<=(save?.chapter||1)).map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
    <div className="list-count">找到 {viewCards.filter(c=>save?.cards[c.id]).length} / {viewCards.length} 页</div>
    {viewCards.filter(c=>save?.cards[c.id]).map(c=><button key={c.id} className={`card-link ${selected?.id===c.id?'selected':''}`} onClick={()=>pickCard(c.id)} data-card={c.id}>
      <span className="folio">{c.id}</span><span><strong>{c.title}</strong><small>{save&&resolved(c,save)?c.kind==='dream'?'梦境旁注':'已归档':save?.cards[c.id].solved?'待归档':save?.cards[c.id].read?'待辨认':'未读'}</small></span><span className="status-mark">{save&&resolved(c,save)?'✓':'·'}</span>
    </button>)}
    <p className="list-foot">未找到的页，藏在人物的关联里。读完残页后，到人物页或右侧索引继续寻找。</p>
  </aside>;
  const index=<aside className="entry-index" aria-label="人物与搜寻"><div className="index-head"><span className="eyebrow">循着名字</span><h2>人物索引</h2><p>他们在彼此的故事里出现。</p></div>
    {save?.known.map(id=>{const e=book.entries[id];const left=cardsOfChapter(book,save.chapter).filter(c=>!save.cards[c.id]&&c.entries.includes(id)).length;return <div className="entry-row" key={id}>
      <button className="entry-person" onClick={()=>setEntry(id)}><Portrait entry={e}/><span><strong>{e.name}</strong><small>{e.role.split(' · ')[0]}</small></span></button>
      <button className="search" disabled={!left||save.phase!=='reading'} onClick={()=>dispatch({type:'search',id})} aria-label={`寻找${e.name}的残页（${left}）`}>{left?`寻页 ${left} ↗`:'已寻尽'}</button>
    </div>;})}
    {!save?.known.length&&<p className="empty">点正文中带下划线的名字，或在页末选择“我已读完”，收入第一条线索。</p>}
    <p className="index-foot">搜寻不消耗体力。<br/>你可以按自己的顺序读下去。</p>
  </aside>;

  const reading=save&&selected&&cs&&<article className="reading-page" data-current-card={selected.id}>
    <div className="page-kicker"><span>{selected.id} / {selected.kind==='dream'?'梦境插页':'人生残页'}</span><span>{editable?'正在阅读':'回看'}</span></div>
    <h1>{selected.title}</h1><div className="ornament" aria-hidden="true">— ◇ —</div>
    <img className="scene" src={selected.image} alt={selected.title+'的场景意象'} loading="lazy"/>
    {selected.kind==='dream'&&<p className="dream-note">这一页是梦，不进入真实事件的时间线。</p>}
    <div className="prose">{selected.segments.map((seg,i)=>seg.kind==='quote'?<blockquote key={i}>{seg.text}<cite>{seg.attribution}</cite></blockquote>:<p key={i}><Rich text={seg.text} disabled={!editable} collect={id=>dispatch({type:'collect',id})}/></p>)}</div>
    <details className="source"><summary>原著依据与叙述边界</summary><p>{selected.sourceNote}</p><p>{selected.sources.join(' · ')}</p></details>
    <section className="workbench" aria-label="辨认与归档"><div className="bench-heading"><span className="eyebrow">读完这一页之后</span><span className="folio">{cs.read?'已读':'尚未标记已读'}</span></div>
      {!cs.read&&editable&&<button className="primary" onClick={()=>dispatch({type:'read',id:selected.id})}>我已读完，记下线索</button>}
      <Blanks blanks={selected.blanks} answers={cs.answers} known={save.known} disabled={!editable||!cs.read||cs.solved} onAnswer={(slot,value)=>dispatch({type:'answer',id:selected.id,slot,value})}/>
      {editable&&!cs.solved&&<div className="actions"><button className="primary" disabled={!cs.read} onClick={()=>dispatch({type:'solve',id:selected.id})}>确认人物</button><button className="quiet" onClick={()=>dispatch({type:'hint',id:selected.id})}>读不准时，看提示</button></div>}
      {cs.solved&&<p className="success">✓ 人物已辨明{selected.kind==='dream'?' · 已收入梦境旁注':''}</p>}
      {cs.solved&&selected.kind!=='dream'&&!cs.placed&&editable&&<div className="placement"><label>把它放回故事的哪个阶段？<select aria-label="事件阶段" value={period} onChange={e=>setPeriod(e.target.value)}><option value="">请选择阶段</option>{chapter.periods.map((p,i)=><option value={i} key={p.title}>{p.title}</option>)}</select></label>
        {period!==''&&<p className="muted">{chapter.periods[Number(period)].hint}</p>}<button className="primary" disabled={period===''} onClick={()=>dispatch({type:'place',id:selected.id,period:Number(period)})}>归入这一阶段</button></div>}
      {cs.placed&&<p className="success">已归档 · {book.chapters[selected.chapter-1].periods[selected.period!].title}</p>}
      {resolved(selected,save)&&editable&&<div className="next-actions"><button onClick={()=>{const next=cardsOfChapter(book,save.chapter).find(c=>save.cards[c.id]&&!resolved(c,save));if(next)pickCard(next.id);else if(found<total){setTab('people');setNotice('选择仍有残页的人物，继续搜寻。');}else setTab('gate');}} className="outline">{done===total?'去卷末回顾 →':'继续整理 →'}</button></div>}
    </section>
  </article>;

  const timeline=save&&<section className="wide-page"><span className="eyebrow">让事件回到它的位置</span><h1>时间线</h1><p className="lead">按故事阶段归档。同组内不强排原著没有交代的先后。</p>
    <div className="chapter-pills">{book.chapters.filter(c=>c.id<=save.chapter).map(c=><button className={viewChapter===c.id?'chosen':''} key={c.id} onClick={()=>setReviewChapter(c.id)}>{c.title}</button>)}</div>
    {book.chapters[viewChapter-1].periods.map((p,i)=><section className="timeline-group" key={p.title}><span className="timeline-number">{String(i+1).padStart(2,'0')}</span><div><h2>{p.title}</h2><p>{p.hint}</p><div className="timeline-cards">{viewCards.filter(c=>c.period===i&&save.cards[c.id]?.placed).map(c=><button key={c.id} onClick={()=>pickCard(c.id)}><small>{c.id}</small>{c.title}<span>↗</span></button>)}</div>{!viewCards.some(c=>c.period===i&&save.cards[c.id]?.placed)&&<p className="empty-line">尚未收入这一阶段的残页</p>}</div></section>)}
    {viewCards.some(c=>c.kind==='dream'&&resolved(c,save))&&<section className="dream-folder"><h2>梦境旁注</h2>{viewCards.filter(c=>c.kind==='dream'&&resolved(c,save)).map(c=><button className="outline" key={c.id} onClick={()=>pickCard(c.id)}>{c.title} ↗</button>)}<p>愿望被记下，事实的时间线仍保持空白。</p></section>}
    <h2>等待归档</h2><div className="timeline-cards">{viewCards.filter(c=>save.cards[c.id]&&!resolved(c,save)).map(c=><button key={c.id} onClick={()=>pickCard(c.id)}>{c.title}<span>去阅读 →</span></button>)}</div>
  </section>;
  const gate=save&&<section className="wide-page gate-page"><span className="eyebrow">{chapter.title} · 卷末</span><h1>{chapter.question}</h1><p className="lead">这一问没有标准答案。先确认我们一起读过的事实。</p><div className="progress"><span style={{width:`${done/total*100}%`}}/></div><p className="muted">已归档 {done} / {total} 页{done<total?' · 读完并归档本卷全部残页后继续。':''}</p>
    {chapterDone(book,save)?<div className="recap">{chapter.recap.map((p,i)=><p key={i}>{p}</p>)}</div>:<p className="empty-line">全部残页归档后，展开本卷回顾。</p>}
    <Blanks blanks={chapter.gate} answers={save.gateAnswers[String(save.chapter)]||{}} known={save.known} onAnswer={(slot,value)=>dispatch({type:'gateAnswer',slot,value})} disabled={!chapterDone(book,save)||save.phase!=='reading'}/>
    <section className="reflection"><span className="eyebrow">留在页边 · 可选</span><h2>{chapter.reflection.question}</h2><p>不计分，也不会改变谁得以幸存。你可以留下一句自己的话。</p><div className="reflection-options">{chapter.reflection.options.map(o=><button className={save.reflections[String(save.chapter)]===o?'chosen':''} key={o} onClick={()=>dispatch({type:'reflect',value:o})}>{o}</button>)}</div><textarea aria-label="我的页边记" maxLength={1000} placeholder="此刻的想法……" value={save.reflections[String(save.chapter)]||''} onChange={e=>dispatch({type:'reflect',value:e.target.value})}/></section>
    <button className="primary large-button" disabled={!chapterDone(book,save)||save.phase!=='reading'} onClick={()=>dispatch({type:'gate'})}>{save.chapter<3?'确认回顾，翻入下一卷 →':'确认回顾，走向留下的人 →'}</button>
  </section>;

  return <div className="app" style={{'--reading-size':`${save?.settings.fontSize||19}px`} as CSSProperties}>
    <input hidden ref={importRef} type="file" accept=".json,application/json" onChange={e=>void importFile(e.target.files?.[0])}/>
    <Music save={save} title={title} report={report}/>
    {boot==='loading'?<main className="boot"><img src="slr-assets/bridge.svg" alt=""/><h1>圣路易斯雷大桥</h1><p>正在取回书签……</p></main>:boot==='error'?<main className="boot"><h1>书签暂未取回</h1><p>{bootError}</p><button className="primary" onClick={()=>void load()}>重试读取存档</button><button className="quiet" onClick={()=>{coordinator.current=null;setBoot('ready');setStorageStatus('本次仅临时阅读 · 请下载进度文件');}}>先临时阅读</button><p className="muted">临时阅读不会写入或覆盖未读到的存档。</p></main>:title?<main className="cover">
      <div className="cover-copy"><span className="eyebrow">THORNTON WILDER · 1927</span><div className="cover-rule"/><p className="cover-small">普利策获奖小说 · 互动文学改编</p><h1>圣路易斯雷<span>大桥</span></h1><p className="cover-sub">一座桥，五个生命，<br/>留下的人。</p><div className="cover-buttons">{save?<><button className="primary" onClick={()=>setTitle(false)}>继续阅读 <span>卷 {save.chapter} · {save.phase==='complete'?'已读完':'书签仍在'}</span> →</button><button className="quiet" onClick={()=>setModal('restart')}>重新从第一页开始</button></>:<button className="primary" onClick={start}>翻开这本书 <span>→</span></button>}</div><p className="cover-detail">三卷人生残页 · 一个未被回答的问题</p><div className="cover-links"><button onClick={()=>setModal('help')}>如何阅读</button><button onClick={()=>setModal('credits')}>关于本作</button><button onClick={()=>importRef.current?.click()}>导入书签</button></div><small className="save-note">{storageStatus}</small></div>
      <div className="cover-art"><img src={bridge} alt="横跨秘鲁山谷的柳条吊桥，尚未断裂"/><span className="cover-number">I / III</span><div className="cover-caption">THE BRIDGE OF SAN LUIS REY<br/><span>有些话，来不及得到回音。</span></div></div>
    </main>:save?.phase==='intro'?<>{header}<main className="frame" ref={reader}><div className="frame-art"><img src={save.chapter===1&&save.introPage===0?bridge:chapter.image} alt="本卷场景意象"/></div><article className="frame-text"><span className="eyebrow">{save.chapter===1&&save.introPage<2?'序页':chapter.title} · {save.introPage+1}/{chapter.intro.length}</span><Prose text={chapter.intro[save.introPage]}/><button className="primary" onClick={()=>dispatch({type:'introNext'})}>{save.introPage<chapter.intro.length-1?'继续翻页 →':'开始寻找残页 →'}</button></article></main></>:save?.phase==='ending'||endReview!==null?<>{header}<main className="frame ending" ref={reader}><div className="frame-art"><img src={book.ending[endReview??save!.endingPage].image} alt="尾声场景意象"/></div><article className="frame-text"><span className="eyebrow">尾声 · 留下的人 · {(endReview??save!.endingPage)+1}/{book.ending.length}</span><h1>{book.ending[endReview??save!.endingPage].title}</h1><Prose text={book.ending[endReview??save!.endingPage].text}/><details className="source"><summary>原著依据</summary>{book.ending[endReview??save!.endingPage].sources.join(' · ')}</details>{endReview!==null?<div className="actions"><button disabled={endReview===0} onClick={()=>setEndReview(endReview-1)}>上一页</button><button onClick={()=>endReview<book.ending.length-1?setEndReview(endReview+1):setEndReview(null)}>{endReview<book.ending.length-1?'下一页':'返回读后页'}</button></div>:<button className="primary" onClick={()=>dispatch({type:'endingNext'})}>{save!.endingPage<book.ending.length-1?'继续翻页 →':'读完了，合上这一页 →'}</button>}</article></main></>:save?.phase==='complete'?<>{header}<main className="completion"><img className="completion-art" src="slr-assets/BG05_修院黄昏.png" alt="暮色中仍亮着灯的修院"/><article><span className="eyebrow">全书已读完</span><h1>灯还亮着。</h1><p className="lead">三十六张残页已经归档。那个问题，可以继续留在页边。</p><p className="muted">前台阅读与操作约 {Math.floor(save.stats.activeMs/60000)} 分钟 · 使用提示 {save.stats.hints} 次<br/>计时排除隐藏窗口和长时间无操作，不等同于阅读速度测评。</p><div className="kept-notes">{book.chapters.map(c=><section key={c.id}><small>{c.title}</small><h2>{c.reflection.question}</h2><p>{save.reflections[String(c.id)]||'这一页暂时留白。'}</p></section>)}</div><div className="actions"><button className="primary" onClick={()=>setEndReview(0)}>重读尾声</button><button onClick={()=>{setReviewChapter(1);dispatch({type:'select',id:book.cards[0].id});setTab('read');setEndReview(null);setTitle(false);setNotice('已展开全书回看。');setListOpen(true);}} className="outline">翻阅三卷残页</button><button className="outline" onClick={()=>downloadSave(save)}>下载我的书签</button></div><details className="credits"><summary>原著、制作与致谢</summary>{book.credits.map(t=><p key={t}>{t}</p>)}</details>
      {listOpen&&<div className="complete-review"><button className="quiet" onClick={()=>setListOpen(false)}>收起回看</button><div className="chapter-pills">{book.chapters.map(c=><button key={c.id} onClick={()=>chooseChapter(c.id)}>{c.title}</button>)}</div><div className="timeline-cards">{viewCards.map(c=><button key={c.id} onClick={()=>{dispatch({type:'select',id:c.id});setListOpen(true);}}>{c.title}</button>)}</div>{reading}</div>}
    </article></main></>:<>{header}{nav}<div className={`workspace tab-${tab}`}>
      {cardList}<main className="reader" ref={reader}><div className="mobile-toolbar"><button onClick={()=>setListOpen(!listOpen)}>☰ 残页目录</button><span>{found}/{total} 页已找到</span></div>{tab==='read'?reading:tab==='timeline'?timeline:tab==='gate'?gate:<section className="wide-page people-page"><span className="eyebrow">他们不只出现在一页里</span><h1>人物与线索</h1>{index}<div className="people-grid">{save?.known.map(id=><button key={id} onClick={()=>setEntry(id)}><Portrait entry={book.entries[id]} large/><strong>{book.entries[id].name}</strong><small>{book.entries[id].role}</small></button>)}</div></section>}</main>{index}
    </div><footer className="status-bar"><span>{storageStatus}</span><span>THORNTON WILDER / 圣路易斯雷大桥</span></footer></>}
    {notice&&!modal&&!entry&&<div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="关闭提示">×</button></div>}
    {entry&&<Dialog title={book.entries[entry].name} close={()=>setEntry(null)}>{notice&&<p className="dialog-notice" role="status">{notice}</p>}<div className="person-card"><Portrait entry={book.entries[entry]} large/><span className="eyebrow">{book.entries[entry].role}</span><p>{book.entries[entry].desc}</p></div><h3>已找到的相关残页</h3><div className="related">{book.cards.filter(c=>save?.cards[c.id]&&c.entries.includes(entry)).map(c=><button key={c.id} onClick={()=>{pickCard(c.id);setEntry(null);if(save?.phase==='complete')setListOpen(true);}}>{c.id} · {c.title} ↗</button>)}</div></Dialog>}
    {modal&&<Dialog title={{settings:'阅读设置与书签',help:'把散落的生活读回来',credits:'关于《圣路易斯雷大桥》',restart:'重新开始阅读'}[modal]} close={()=>setModal(null)}>
      {notice&&<p className="dialog-notice" role="status">{notice}</p>}
      {modal==='help'&&<><ol className="instructions"><li><strong>读一张残页。</strong>点击带下划线的名字，或在页末标记已读，人物会收入索引。</li><li><strong>沿人物寻找。</strong>选择“寻页”，找出这一卷与他有关的新片段。搜寻不消耗体力。</li><li><strong>辨认与归档。</strong>依据文字选出人物，将事件放回合适的阶段。梦境单独放入旁注。</li><li><strong>完成一卷，再向前走。</strong>每卷十二张残页。全部整理后完成事实回顾，进入下一卷；第三卷后还有完整尾声。</li></ol><p>页边记没有标准答案。提示不扣分，没有好感度，也没有评定谁应该获救的分数。</p><p className="muted">包含丧亲、疾病与自伤危机的非细节叙述。可随时停下，本机或云端会保存书签，也可下载进度文件。</p><button className="primary" onClick={()=>setModal(null)}>明白了</button></>}
      {modal==='credits'&&<>{book.credits.map(t=><p key={t}>{t}</p>)}<a href="https://lumi.66rpg.com/templates/4v6x5qs1569s" target="_blank" rel="noreferrer">柳柳《悉达多》原模板 ↗</a></>}
      {modal==='restart'&&<><p>重新开始会替换当前自动书签。可以先下载，之后随时导入继续。</p>{save&&<button className="outline" onClick={()=>downloadSave(save)}>先下载当前书签</button>}<div className="actions"><button className="primary" onClick={start}>确认从第一页开始</button><button onClick={()=>setModal(null)}>保留当前进度</button></div></>}
      {modal==='settings'&&<>{save&&<><label className="setting-row">背景音乐<input type="checkbox" checked={save.settings.music} onChange={e=>dispatch({type:'settings',value:{music:e.target.checked}})}/></label><label className="setting-row">配乐音量<input aria-label="配乐音量" type="range" min="0" max="0.6" step="0.02" value={save.settings.volume} onChange={e=>dispatch({type:'settings',value:{volume:Number(e.target.value)}})}/></label><label className="setting-row">文字大小<select aria-label="文字大小" value={save.settings.fontSize} onChange={e=>dispatch({type:'settings',value:{fontSize:Number(e.target.value)}})}>{[17,19,21,23,25].map(n=><option key={n} value={n}>{n} px</option>)}</select></label><div className="actions"><button className="primary" onClick={()=>downloadSave(save)}>下载书签</button><button className="outline" onClick={()=>importRef.current?.click()}>导入书签</button><button onClick={()=>{coordinator.current?.persist(save);setNotice('已请求重新保存当前进度。');}}>重试保存</button></div></>}<p className="save-note">{storageStatus}</p><p className="muted">本机书签随浏览器保存。更换设备或清理网站数据前，请下载一份。幻光播放页接入后使用平台云存档。</p><button className="quiet" onClick={()=>{setModal(null);setTitle(true);}}>回到封面</button></>}
    </Dialog>}
  </div>;
}
