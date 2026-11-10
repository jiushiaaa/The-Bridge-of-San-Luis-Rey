// 临时脚本：角色列卡的列主改为 NPC1（与原 NPC1 槽位全卡对换），用后即删
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = { xdd: 'xidaduo' };

// 检测文件缩进（首个换行后的空白）
function detectIndent(text) {
  const m = text.match(/\n(\s+)"/);
  return m ? m[1] : '  ';
}

// 在字符串中对换两个 NPC 标记（[[NPCa]]/[[NPCb]] 与裸 NPCa/NPCb 文本）
function swapInText(text, a, b) {
  const TMP = '\u0000TMP\u0000';
  return text.split(a).join(TMP).split(b).join(a).split(TMP).join(b);
}

const slotOrder = (s) => (s.startsWith('NPC') ? Number(s.slice(3)) : 99);

for (const [gid, dir] of Object.entries(GAMES)) {
  const file = path.join(ROOT, 'workspace', dir, 'final_game.json');
  const raw = fs.readFileSync(file, 'utf8');
  const indent = detectIndent(raw);
  const data = JSON.parse(raw);
  const nameToEid = new Map(Object.entries(data.entries).map(([id, d]) => [d.name, id]));
  const fixed = [];

  for (const c of data.cards) {
    const cols = data.timelines[String(c.level)].cols;
    if (c.col === cols[0]) continue; // 情节列不适用
    const colEid = nameToEid.get(c.col);
    if (!colEid) { console.log(`[${gid}] ${c.id}: 列名「${c.col}」不是词条，跳过`); continue; }
    const hit = (b) => (Array.isArray(b.answer) ? b.answer.includes(colEid) : b.answer === colEid);
    const npc1 = c.blanks.find((b) => b.slot === 'NPC1');
    if (npc1 && hit(npc1)) continue; // 已合规
    const owner = c.blanks.find((b) => b.slot.startsWith('NPC') && hit(b));
    if (!owner) { console.log(`[${gid}] ${c.id}: 列主 ${c.col} 不在任何 NPC 空中，需人工处理`); continue; }
    const a = 'NPC1';
    const b = owner.slot;
    // 对换 blanks 槽位名并按 NPC 序号重排（地点保持在末尾）
    for (const bl of c.blanks) {
      if (bl.slot === a) bl.slot = b;
      else if (bl.slot === b) bl.slot = a;
    }
    c.blanks.sort((x, y) => slotOrder(x.slot) - slotOrder(y.slot));
    // 对换 segments 的发言 slot 与正文/提示中的占位与裸文本
    for (const seg of c.segments) {
      if (seg.slot === a) seg.slot = b;
      else if (seg.slot === b) seg.slot = a;
      seg.text = swapInText(seg.text, a, b);
    }
    c.hints = c.hints.map((h) => swapInText(h, a, b));
    fixed.push(`${c.id}: ${b} <-> NPC1（列主 ${c.col}）`);
  }

  if (fixed.length) {
    fs.writeFileSync(file, JSON.stringify(data, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
    console.log(`[${gid}] 修正 ${fixed.length} 张：`);
    for (const f of fixed) console.log('   - ' + f);
  } else {
    console.log(`[${gid}] 无需修正`);
  }
}

// 复查
for (const [gid, dir] of Object.entries(GAMES)) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'workspace', dir, 'final_game.json'), 'utf8'));
  const nameToEid = new Map(Object.entries(data.entries).map(([id, d]) => [d.name, id]));
  const bad = data.cards.filter((c) => {
    const cols = data.timelines[String(c.level)].cols;
    if (c.col === cols[0]) return false;
    const colEid = nameToEid.get(c.col);
    const npc1 = c.blanks.find((b) => b.slot === 'NPC1');
    if (!npc1) return true;
    const ans = Array.isArray(npc1.answer) ? npc1.answer : [npc1.answer];
    return !ans.includes(colEid);
  });
  console.log(`[复查 ${gid}] 违规 ${bad.length} 张${bad.length ? '：' + bad.map((c) => c.id).join(',') : ''}`);
}
