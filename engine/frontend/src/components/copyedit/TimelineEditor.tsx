// DEBUG-文案 · 时间轴编辑器：时间行（即「提示」揭示的时间点名）/ 人物列 / 每格应放哪张卡
// 自动化：行增删改序自动重映射全部卡的行下标；列按人物选择器增删（卡按名字引用列，排序零成本）；
//         格子分配点选即交换，(行,列) 唯一自动保证；密度红线实时检查（行≥2、情节列每行恰1、人物列≥2且>40%）。
import { createCard } from '../../game/content';
import { openCopyedit, saveGameData } from '../../game/copyedit';
import { cardsOfLevel, data, entryName2id, FORM_META, timelineOf } from '../../game/data';
import { pushToast, useGame } from '../../game/store';
import Avatar from '../Avatar';
import { CeShell, entryName, openCardPicker, openEntryPicker, useDraft } from './common';

interface TlDraft {
  rows: string[];
  cols: string[];
  cell: Record<string, { row: number; colName: string }>;
}

export default function TimelineEditor({ level }: { level: number }) {
  const s = useGame();
  const cards = cardsOfLevel(level);
  const [draft, upd] = useDraft<TlDraft>(() => {
    const t = timelineOf(level);
    return {
      rows: [...t.rows],
      cols: [...t.cols],
      cell: Object.fromEntries(cards.map((c) => [c.id, { row: c.row, colName: c.col }])),
    };
  });

  const colLabel = (name: string): string => (name === draft.cols[0] ? '情节' : name);
  const cardAt = (ri: number, colName: string) =>
    cards.find((c) => draft.cell[c.id]?.row === ri && draft.cell[c.id]?.colName === colName);

  // ---------- 行操作（自动重映射卡的行下标） ----------

  const moveRow = (i: number, dir: -1 | 1) =>
    upd((d) => {
      const j = i + dir;
      [d.rows[i], d.rows[j]] = [d.rows[j], d.rows[i]];
      for (const c of Object.values(d.cell)) c.row = c.row === i ? j : c.row === j ? i : c.row;
    });

  const delRow = (i: number) => {
    if (cards.some((c) => draft.cell[c.id]?.row === i)) {
      pushToast('该时间行上还有卡片，请先把它们移到别的格');
      return;
    }
    upd((d) => {
      d.rows.splice(i, 1);
      for (const c of Object.values(d.cell)) if (c.row > i) c.row--;
    });
  };

  // ---------- 列操作（卡按名字引用列，排序零成本） ----------

  const addCol = () =>
    openEntryPicker(
      '添加人物列',
      ['person'],
      (id) => {
        const name = entryName(id);
        upd((d) => void (d.cols.includes(name) || d.cols.push(name)));
      },
      new Set(
        Object.entries(data.entries)
          .filter(([, e]) => draft.cols.includes(e.name))
          .map(([id]) => id),
      ),
    );

  const moveCol = (i: number, dir: -1 | 1) =>
    upd((d) => {
      const j = i + dir;
      [d.cols[i], d.cols[j]] = [d.cols[j], d.cols[i]];
    });

  const delCol = (i: number) => {
    const name = draft.cols[i];
    if (cards.some((c) => draft.cell[c.id]?.colName === name)) {
      pushToast('该列上还有卡片，请先移走');
      return;
    }
    upd((d) => void d.cols.splice(i, 1));
  };

  // ---------- 格子分配（点格选卡，占用自动交换） ----------

  const pickForCell = (ri: number, colName: string) => {
    openCardPicker(
      `选择放到「${draft.rows[ri]} × ${colLabel(colName)}」的卡`,
      level,
      (cardId) => {
        upd((d) => {
          const occ = cards.find(
            (c) => c.id !== cardId && d.cell[c.id]?.row === ri && d.cell[c.id]?.colName === colName,
          );
          const prev = { ...d.cell[cardId] };
          if (occ) d.cell[occ.id] = prev; // 交换：两卡对调，(行,列) 唯一自动保证
          d.cell[cardId] = { row: ri, colName };
        });
      },
      (c) => {
        const cur = draft.cell[c.id];
        return cur ? `当前：第${cur.row + 1}行 · ${colLabel(cur.colName)}` : undefined;
      },
    );
  };

  // ---------- 校验 ----------

  const errors: string[] = [];
  const specErrors: string[] = [];
  const warnings: string[] = [];
  draft.rows.forEach((rn, ri) => {
    if (!rn.trim()) errors.push(`第 ${ri + 1} 行的时间点名不能为空`);
  });
  if (!draft.cols[0]?.trim()) errors.push('情节列的列名不能为空');
  if (new Set(draft.cols).size !== draft.cols.length) errors.push('列名有重复（引擎按名字定位列，必须唯一）');
  draft.rows.forEach((rn, ri) => {
    const n = cards.filter((c) => draft.cell[c.id]?.row === ri).length;
    if (n < 2) specErrors.push(`第${ri + 1}行「${rn}」只有 ${n} 张卡（红线：每行 ≥2）`);
    const sc = cards.filter((c) => draft.cell[c.id]?.row === ri && draft.cell[c.id]?.colName === draft.cols[0]).length;
    if (sc !== 1) specErrors.push(`第${ri + 1}行「${rn}」情节列有 ${sc} 张卡（红线：每行恰 1 张）`);
  });
  // 红线只有两条与列有关：每个角色列 ≥2 张、**全部角色列合计**填充 >40%
  // （单列填充率不是红线——独白/对话卡本来就该集中在戏份多的角色身上，这里只作参考提示）
  draft.cols.slice(1).forEach((cn) => {
    const n = cards.filter((c) => draft.cell[c.id]?.colName === cn).length;
    if (n < 2) specErrors.push(`人物列「${cn}」只有 ${n} 张卡（红线：≥2）`);
    else if (n / draft.rows.length <= 0.4)
      warnings.push(`人物列「${cn}」只填了 ${n}/${draft.rows.length} 格（不是红线，仅供参考）`);
  });
  const roleCells = (draft.cols.length - 1) * draft.rows.length;
  const roleUsed = cards.filter((c) => draft.cell[c.id]?.colName !== draft.cols[0]).length;
  if (roleCells > 0 && roleUsed * 100 <= roleCells * 40) {
    specErrors.push(`角色列合计填充 ${roleUsed}/${roleCells} = ${Math.round((roleUsed / roleCells) * 100)}%（红线：>40%）`);
  }
  for (const c of cards) {
    const cell = draft.cell[c.id];
    if (!cell || cell.row >= draft.rows.length || !draft.cols.includes(cell.colName)) {
      errors.push(`卡《${c.title}》没有有效的格子（行或列被删）`);
    }
  }
  // 回顾长廊按行区间切页，行数变了必须同步改回顾
  const rec = data.recaps?.[String(level)];
  if (rec && draft.rows.length !== timelineOf(level).rows.length) {
    warnings.push(`行数变了（${timelineOf(level).rows.length} → ${draft.rows.length}），保存后要去「故事回顾」重新切页`);
  }

  const save = () =>
    saveGameData((g) => {
      g.timelines[String(level)] = { rows: draft.rows.map((r) => r.trim()), cols: [...draft.cols] };
      for (const c of g.cards) {
        if (c.level !== level) continue;
        const cell = draft.cell[c.id];
        if (cell) {
          c.row = cell.row;
          c.col = cell.colName;
        }
      }
    });

  return (
    <CeShell
      title={`DEBUG-文案 · 第${level}关时间轴总览`}
      onSave={save}
      errors={errors}
      specErrors={specErrors}
      warnings={warnings}
    >
      {/* 时间行 */}
      <div className="ce-sec">
        <div className="ce-sec-title">
          时间行（行头默认隐藏，玩家花体力点「提示」揭示的就是这些名字）
          <button className="btn" onClick={() => upd((d) => void d.rows.push(`新时间点 ${d.rows.length + 1}`))}>
            ＋添加时间行
          </button>
        </div>
        {draft.rows.map((rn, i) => (
          <div className="ce-list-row" key={i}>
            <span className="ce-list-idx">时间 {i + 1}</span>
            <input className="ce-input" value={rn} onChange={(e) => upd((d) => void (d.rows[i] = e.target.value))} />
            <button className="ce-mini-btn" disabled={i === 0} onClick={() => moveRow(i, -1)}>
              ↑
            </button>
            <button className="ce-mini-btn" disabled={i === draft.rows.length - 1} onClick={() => moveRow(i, 1)}>
              ↓
            </button>
            <button className="ce-mini-btn danger" onClick={() => delRow(i)}>
              删除
            </button>
          </div>
        ))}
        <div className="ce-note">行的增删与排序会自动重排所有卡的行位置，不需要手工对齐。</div>
      </div>

      {/* 列 */}
      <div className="ce-sec">
        <div className="ce-sec-title">
          列（第一列是情节列，界面上恒显示「情节」，这里的名字只用于卡片的 col 归属；
          人物列显示词条头像，改名请去词条库编辑器——会自动同步到这里）
          <button className="btn" onClick={addCol}>
            ＋添加人物列
          </button>
        </div>
        {draft.cols.map((cn, i) => (
          <div className="ce-list-row" key={i === 0 ? '__plot__' : cn}>
            <span className="ce-list-idx">列 {i + 1}</span>
            <span className="ce-col-name">
              {i === 0 ? (
                <>
                  🎬
                  <input
                    className="ce-input"
                    style={{ width: 160 }}
                    value={cn}
                    onChange={(e) => {
                      const nv = e.target.value;
                      upd((d) => {
                        const old = d.cols[0];
                        d.cols[0] = nv;
                        for (const cell of Object.values(d.cell)) if (cell.colName === old) cell.colName = nv;
                      });
                    }}
                  />
                </>
              ) : (
                <>
                  <Avatar entryId={entryName2id(cn)} name={cn} size={24} />
                  {cn}
                  {!entryName2id(cn) ? <span className="ce-tok-bad">找不到同名人物词条</span> : null}
                </>
              )}
            </span>
            {i > 0 ? (
              <>
                <button className="ce-mini-btn" disabled={i <= 1} onClick={() => moveCol(i, -1)}>
                  ←
                </button>
                <button className="ce-mini-btn" disabled={i === draft.cols.length - 1} onClick={() => moveCol(i, 1)}>
                  →
                </button>
                <button className="ce-mini-btn danger" onClick={() => delCol(i)}>
                  删除
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>

      {/* 格子分配 */}
      <div className="ce-sec">
        <div className="ce-sec-title">
          每格应放的故事卡（点击格子换卡；两卡对调自动完成，无需手工对齐）
        </div>
        <table className="ce-tl-grid">
          <thead>
            <tr>
              <th className="ce-tl-rowhead" />
              {draft.cols.map((cn, ci) => (
                <th key={cn}>{ci === 0 ? '情节' : cn}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((rn, ri) => (
              <tr key={ri}>
                <th className="ce-tl-rowhead">
                  {ri + 1}. {rn}
                </th>
                {draft.cols.map((cn) => {
                  const occ = cardAt(ri, cn);
                  return (
                    <td key={cn}>
                      <button
                        className={`ce-tl-cellbtn${occ ? '' : ' empty'}`}
                        title={occ ? `《${occ.title}》——点击换卡` : '点击选择放这里的卡'}
                        onClick={() => pickForCell(ri, cn)}
                      >
                        {occ ? (
                          <>
                            {occ.title}
                            <span className="ce-tl-cell-form">{FORM_META[occ.form].label}</span>
                          </>
                        ) : (
                          '＋'
                        )}
                      </button>
                      {occ ? (
                        <button
                          className="ce-mini-btn"
                          title="打开这张卡的编辑器"
                          onClick={() => openCopyedit({ kind: 'card', cardId: occ.id }, { push: true })}
                        >
                          编辑
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ce-add-line">
          <button className="btn" onClick={() => void createCard(level)}>
            ＋新建一张情节卡（立即写盘，随后打开卡编辑器）
          </button>
        </div>
        <div className="ce-note" style={{ marginTop: 6 }}>
          本关共 {cards.length} 张卡；当前玩家进度在第 {s.level} 关。行列变动保存后，玩家已放置但越界的残页会自动退回待归位区。
          新建卡是立即写盘的，会丢掉本页尚未保存的行列改动——请先保存再新建。
        </div>
      </div>
    </CeShell>
  );
}
