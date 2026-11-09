import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'game/package.json'));
const {build}=require('esbuild');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'slr-tests-'));
await build({stdin:{contents:`export * from './engine'; export * from './storage';`,resolveDir:path.join(root,'game/src'),loader:'ts'},outfile:path.join(tmp,'engine.mjs'),bundle:true,format:'esm',platform:'node',target:'node20'});
const {newSave,transition,validateSave,chapterDone,resolved,SaveCoordinator,browserAdapter}=await import(pathToFileURL(path.join(tmp,'engine.mjs')));
const book=JSON.parse(await fs.readFile(path.join(root,'game/content/game.json'),'utf8'));
let passed=0;
const test=async(name,fn)=>{await fn();passed++;process.stdout.write(`✓ ${name}\n`);};
const act=(s,a)=>transition(book,s,a,200000).state;
const fresh=()=>{let s=newSave(book,1000,'test-run');while(s.phase==='intro')s=act(s,{type:'introNext'});return s;};
function play(seed=1){
 let s=fresh();let random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let lv=1;lv<=3;lv++){
  while(s.phase==='intro')s=act(s,{type:'introNext'});
  const cards=book.cards.filter(c=>c.chapter===lv);
  let guard=0;
  while(!chapterDone(book,s)){
   assert.ok(++guard<80,'search graph deadlock');
   const open=cards.filter(c=>s.cards[c.id]&&!resolved(c,s));
   if(open.length){
    const c=open[Math.floor(random()*open.length)];
    s=act(s,{type:'read',id:c.id});
    for(const b of c.blanks)s=act(s,{type:'answer',id:c.id,slot:b.id,value:b.answer});
    s=act(s,{type:'solve',id:c.id});
    if(c.kind!=='dream')s=act(s,{type:'place',id:c.id,period:c.period});
   }else{
    const choices=s.known.filter(id=>cards.some(c=>!s.cards[c.id]&&c.entries.includes(id)));
    assert.ok(choices.length,'no searchable card');s=act(s,{type:'search',id:choices[Math.floor(random()*choices.length)]});
   }
   assert.deepEqual(validateSave(book,s),s);
  }
  for(const b of book.chapters[lv-1].gate)s=act(s,{type:'gateAnswer',slot:b.id,value:b.answer});
  s=act(s,{type:'gate'});assert.ok(s.passed.includes(lv));validateSave(book,s);
 }
 assert.equal(s.phase,'ending');assert.equal(s.stats.finishedAt,null);
 for(let i=0;i<book.ending.length;i++)s=act(s,{type:'endingNext'});
 assert.equal(s.phase,'complete');assert.equal(s.stats.finishedAt,200000);assert.equal(Object.keys(s.cards).length,36);
 assert.equal(s.cards.A06.placed,false);assert.equal(s.cards.A06.solved,true);validateSave(book,s);return s;
}
await test('12 种搜寻顺序均完成 36 页、3 卷与 6 节尾声；每步存档可恢复',()=>{for(let i=1;i<=12;i++)play(i);});
const completed=play();
await test('归档前不能过卷；错误答卷不能跳关',()=>{
 let s=fresh();const old=structuredClone(s);s=act(s,{type:'gate'});assert.deepEqual(s,old);
 const passed1=structuredClone(completed);passed1.phase='reading';passed1.chapter=1;passed1.passed=[];passed1.gateAnswers={'1':{}};passed1.stats.finishedAt=null;
 assert.equal(act(passed1,{type:'gate'}).chapter,1);
});
await test('未读不能答完；未发现的人物与不存在的槽位不写入状态',()=>{
 let s=fresh();s=act(s,{type:'answer',id:'A01',slot:'who1',value:'e_maria'});assert.deepEqual(s.cards.A01.answers,{});
 s=act(s,{type:'solve',id:'A01'});assert.equal(s.cards.A01.solved,false);
 s=act(s,{type:'read',id:'A01'});const old=structuredClone(s);s=act(s,{type:'answer',id:'A01',slot:'__proto__',value:'e_maria'});assert.deepEqual(s,old);
});
await test('答错仍留在当前页；归错阶段不锁死，改对后可继续',()=>{
 let s=fresh();s=act(s,{type:'read',id:'A01'});s=act(s,{type:'answer',id:'A01',slot:'who1',value:'e_clara'});s=act(s,{type:'solve',id:'A01'});assert.equal(s.cards.A01.solved,false);
 s=act(s,{type:'answer',id:'A01',slot:'who1',value:'e_maria'});s=act(s,{type:'solve',id:'A01'});s=act(s,{type:'place',id:'A01',period:4});assert.equal(s.cards.A01.placed,false);
 s=act(s,{type:'place',id:'A01',period:0});assert.equal(s.cards.A01.placed,true);
});
await test('梦境没有真实时序位置；读完并辨认即可完成',()=>{assert.equal(book.cards.find(c=>c.id==='A06').period,null);assert.ok(resolved(book.cards.find(c=>c.id==='A06'),completed));});
await test('隐藏与未来残页不接受读、答、归档；不能伪造解锁',()=>{
 let s=fresh();const old=structuredClone(s);for(const a of [{type:'read',id:'C12'},{type:'collect',id:'e_jaime'},{type:'search',id:'e_jaime'},{type:'place',id:'C12',period:5}])s=act(s,a);assert.deepEqual(s,old);
});
await test('结束后重复过关、结束与读卡不重新计时或改变进度',()=>{let s=act(completed,{type:'endingNext'});s=act(s,{type:'gate'});s=act(s,{type:'tick',ms:10000});assert.deepEqual(s,completed);});
await test('阅读计时拒绝负数与长时间间隔；提示不减少体力或评分',()=>{
 let s=fresh();s=act(s,{type:'tick',ms:-1});s=act(s,{type:'tick',ms:9999999});assert.equal(s.stats.activeMs,0);s=act(s,{type:'tick',ms:10000});assert.equal(s.stats.activeMs,10000);
 s=act(s,{type:'hint',id:'A01'});assert.equal(s.stats.hints,1);assert.equal('stamina' in s,false);
});
await test('存档校验拒绝其他作品、错误版本、伪完成、坏人物与坏阶段',()=>{
 for(const modify of [s=>s.story='xdd',s=>s.version=999,s=>s.phase='complete',s=>s.chapter=9,s=>s.known=['not-an-entry'],s=>s.cards.A01.solved=true,s=>s.cards.A01.placed=true,s=>s.settings.volume=NaN,s=>s.introPage=-1,s=>s.selected='C12',s=>s.passed=[1]]){
  const s=fresh();modify(s);assert.throws(()=>validateSave(book,s));
 }
 assert.throws(()=>validateSave(book,{}));assert.throws(()=>validateSave(book,null));assert.throws(()=>validateSave(book,[]));
});
await test('导入与流转均不就地修改原状态',()=>{const s=fresh();const copy=structuredClone(s);const r=validateSave(book,s);r.known.push('e_maria');act(s,{type:'read',id:'A01'});assert.deepEqual(s,copy);});
await test('空档允许写入；连续写入串行，最后一份是最新状态',async()=>{
 let active=0,max=0;const writes=[];const storage={mode:'test',read:async()=>null,write:async s=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));writes.push(s);active--;}};
 const c=new SaveCoordinator(book,storage);assert.equal(await c.load(),null);const a=fresh();c.persist(a);const b=act(a,{type:'read',id:'A01'});c.persist(b);c.persist(completed);await c.settled();assert.equal(max,1);assert.equal(writes.at(-1).phase,'complete');
});
await test('读取失败或损坏存档后绝不写空档覆盖',async()=>{
 for(const read of [async()=>{throw new Error('FAILED')},async()=>({story:'wrong'})]){
  let writes=0;const c=new SaveCoordinator(book,{mode:'test',read,write:async()=>{writes++;}});await assert.rejects(c.load());c.persist(fresh());await c.settled();assert.equal(writes,0);
 }
});
await test('迟到的读取不会覆盖更新进度；并发读取共用一次请求',async()=>{
 let resolve,reads=0;const deferred=new Promise(r=>resolve=r);const c=new SaveCoordinator(book,{mode:'test',read:()=>{reads++;return deferred;},write:async()=>{}});
 const p=c.load(),p2=c.load();c.persist(completed);resolve(fresh());assert.equal(await p,null);assert.equal(await p2,null);assert.equal(reads,1);
});
await test('一次上传失败后可保存更新进度，不吞掉后续书签',async()=>{
 let n=0,last;const messages=[];const c=new SaveCoordinator(book,{mode:'test',read:async()=>null,write:async s=>{if(++n===1)throw new Error('offline');last=s;}},m=>messages.push(m));
 await c.load();c.persist(fresh());await c.settled();c.persist(completed);await c.settled();assert.equal(last.phase,'complete');assert.ok(messages.some(m=>m.includes('失败')));
});
await test('平台未就绪不会降级为本机存档',async()=>{await assert.rejects(browserAdapter({ready:async()=>({ready:false})}),/云存档/);});
await test('平台未登录只在读取返回该错误后触发登录并重新读取',async()=>{
 let reads=0,logins=0;const sdk={ready:async()=>({ready:true}),requireLogin:async()=>{logins++;},readSave:async()=>{if(++reads===1)throw{code:'NOT_LOGGED_IN'};return null;},writeSave:async()=>{}};
 const a=await browserAdapter(sdk);assert.equal(await a.read(),null);assert.equal(logins,1);assert.equal(reads,2);
});
await fs.rm(tmp,{recursive:true,force:true});
console.log(`${passed} groups passed. Engine simulation is not a human playtime measurement.`);
