// DEBUG-内容 · 关卡管理：总览每关的时间轴 / 卡数 / 档案页 / 闸门 / 过场 / 故事回顾是否齐备，
// 并提供增删关卡、新建情节卡、以及直达各分项编辑器的入口。
// 关卡数一律从数据推导（timelines 的键 + gates.after），这里只做结构性增删，细节改动去各自编辑器。
import { createCard, createGate, createLevel, deleteLevel } from '../../game/content';
import { openCopyedit, saveGameData } from '../../game/copyedit';
import {
  allLevels,
  archivePagesOfLevel,
  cardsOfLevel,
  data,
  gateAfterLevel,
  recapOf,
  recapPageCount,
  timelineOf,
} from '../../game/data';
import { useGame, type CopyeditConf } from '../../game/store';
import { CeShell } from './common';

export default function LevelEditor() {
  const s = useGame();
  const levels = allLevels();

  const open = (conf: CopyeditConf) => openCopyedit(conf, { push: true });

  // 本页所有改动都是立即写盘的结构操作；「保存」只是把当前数据原样回写一遍（评星规则已固定在引擎里，无需配置）
  const save = () => saveGameData(() => {});

  const errors: string[] = [];
  for (const lv of levels) {
    if (!gateAfterLevel(lv)) errors.push(`第${lv}关没有闸门：引擎按 gates.after 推导总关数，缺闸门会少一关`);
    if (!data.frame.levelIntro[String(lv)]) errors.push(`第${lv}关没有过场（frame.levelIntro）`);
  }
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] !== i + 1) {
      errors.push(`关卡编号必须从 1 连续（当前：${levels.join(', ')}）`);
      break;
    }
  }

  return (
    <CeShell
      title="DEBUG-内容 · 关卡管理"
      onSave={save}
      errors={errors}
    >
      <div className="ce-note" style={{ marginBottom: 12 }}>
        增删关卡与情节卡是**立即写盘**的（要同时动好几张表，不走草稿）。
        评星规则由引擎固定（简单满 3 星 / 困难满 5 星，每 3 次错误或休整扣一星），不在数据里配置。
      </div>

      <table className="ce-tl-grid ce-level-table">
        <thead>
          <tr>
            <th>关卡</th>
            <th>时间轴</th>
            <th>情节卡</th>
            <th>档案页</th>
            <th>闸门</th>
            <th>过场</th>
            <th>故事回顾</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((lv) => {
            const t = timelineOf(lv);
            const cards = cardsOfLevel(lv);
            const pages = archivePagesOfLevel(lv);
            const gate = gateAfterLevel(lv);
            const intro = data.frame.levelIntro[String(lv)] ?? [];
            const rec = recapOf(lv);
            const wantPages = t ? recapPageCount(t.rows.length) : 0;
            return (
              <tr key={lv} className={lv === s.level ? 'ce-level-cur' : undefined}>
                <th className="ce-tl-rowhead">
                  第{lv}关{lv === s.level ? '（当前）' : ''}
                </th>
                <td>
                  <button className="ce-mini-btn" onClick={() => open({ kind: 'timeline', level: lv })}>
                    {t ? `${t.rows.length} 行 × ${t.cols.length} 列` : '缺'}
                  </button>
                </td>
                <td>{cards.length} 张</td>
                <td>{pages.length} 页</td>
                <td>
                  <button
                    className={`ce-mini-btn${gate ? '' : ' danger'}`}
                    onClick={() => (gate ? open({ kind: 'gate', after: lv }) : void createGate(lv))}
                  >
                    {gate ? `${gate.blanks.length} 题` : '缺闸门 · 补建'}
                  </button>
                </td>
                <td>
                  <button className="ce-mini-btn" onClick={() => open({ kind: 'frame', target: 'intro', level: lv })}>
                    {intro.length} 段{intro.length < 5 ? '（规范 ≥5）' : ''}
                  </button>
                </td>
                <td>
                  <button className="ce-mini-btn" onClick={() => open({ kind: 'recap', level: lv })}>
                    {rec ? `${rec.pages.length} / ${wantPages} 页` : `未写（建议 ${wantPages} 页）`}
                  </button>
                </td>
                <td>
                  <button className="ce-mini-btn" onClick={() => void createCard(lv)}>
                    ＋新建情节卡
                  </button>
                  <button className="ce-mini-btn danger" onClick={() => void deleteLevel(lv)}>
                    删关
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ce-add-line">
        <button className="btn" onClick={() => void createLevel()}>
          ＋在末尾新建一关（时间轴 5 行 + 空闸门 + 空过场）
        </button>
      </div>

      <div className="ce-sec">
        <div className="ce-sec-title">全局</div>
        <div className="ce-row">
          <button className="btn" onClick={() => open({ kind: 'meta' })}>
            作品设置（体力 / 字数 / 完工状态 / 画风 / 特殊图）
          </button>
          <button className="btn" onClick={() => open({ kind: 'entries' })}>
            词条库（新建 / 删除 / 分类 / 图与 prompt）
          </button>
          <button className="btn" onClick={() => open({ kind: 'frame', target: 'ending' })}>
            结局文本
          </button>
        </div>
      </div>
    </CeShell>
  );
}
