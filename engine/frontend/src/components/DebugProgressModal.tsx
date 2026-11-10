// DEBUG 弹层（仅非离线版顶栏入口）：上半是进度直达，下半是内容编辑总入口
// 进度部分与 ?debug=1 面板共用 logic.ts 的调试动作，全部走真实状态模型 + 自动存档；
// 内容编辑部分挂那些界面上没有天然入口的编辑器（作品设置 / 关卡管理 / 新建卡与词条），
// 见 doc/06-copyedit-editor.md。
import { StarNowEditor } from './StarCapsEditor';
import type { ReactNode } from 'react';
import { createCard } from '../game/content';
import { copyeditAvailable, initCopyedit, openCopyedit } from '../game/copyedit';
import { data } from '../game/data';
import {
  debugClear,
  debugCollectEntries,
  debugFillLevel,
  debugJumpLevel,
  debugPlaceDone,
  debugPreEnding,
  debugSolveUnlocked,
  debugStamina,
  debugUnlockArchives,
  debugUnlockLevel,
  gateChecklist,
} from '../game/logic';
import { pushToast, setUi, useGame, useUi, type CopyeditConf } from '../game/store';

export default function DebugProgressModal() {
  const { debugOpen } = useUi();
  const s = useGame();
  if (!debugOpen) return null;
  const close = () => setUi({ debugOpen: false });
  const openCe = (conf: CopyeditConf) => openCopyedit(conf, { fromDebug: true });

  const cards = data.cards.filter((c) => c.level === s.level);
  const unlocked = cards.filter((c) => s.cards[c.id]?.unlocked).length;
  const done = cards.filter((c) => s.cards[c.id]?.done).length;
  const placed = cards.filter((c) => s.cards[c.id]?.pos?.locked).length;
  const gc = gateChecklist(s.level, s);
  const levels = Object.keys(data.timelines).map(Number).sort((a, b) => a - b);

  return (
    <div className="overlay" onClick={close}>
      <div className="modal dbg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">DEBUG · 进度直达与内容编辑</span>
        </div>
        <div className="modal-body scroll-y">
          <div className="dbg-overview">
            <span>第{s.level}关</span>
            <span>残页 解锁 {unlocked}/{cards.length}</span>
            <span>补完 {done}/{cards.length}</span>
            <span>归位 {placed}/{cards.length}</span>
            <span>档案页 {gc.pagesDone}/{gc.pagesTotal}</span>
            <span>闸门进度 {Math.round(gc.progress * 100)}%</span>
          </div>

          <DbgSection title="残页进度">
            <DbgAction label="解锁本关全部残页" desc="所有残页进入「待归位残页」，可测试阅读与填空" onClick={debugUnlockLevel} />
            <DbgAction label="已解锁残页一键填对" desc="正确填写全部空位并补完，不动时间轴位置" onClick={debugSolveUnlocked} />
            <DbgAction label="已补完残页一键归位" desc="放到时间轴正确格并锁定，可测试闸门开启" onClick={debugPlaceDone} />
            <DbgAction label="一键补全本关" desc="解锁+填对+归位+档案全部完成，直达开闸 100%" onClick={debugFillLevel} />
          </DbgSection>

          <DbgSection title="词条与档案">
            <DbgAction label="词条全收集·熟悉度读满" desc="所有词条立即可分析，可测试档案解锁读条" onClick={debugCollectEntries} />
            <DbgAction label="解锁本关全部档案页" desc="跳过分析读条直接翻开，留白仍需手动补全" onClick={debugUnlockArchives} />
          </DbgSection>

          <DbgSection title="资源与关卡">
            <div className="dbg-caps-wrap">
              <div className="dbg-caps-note">改本关错误次数、本局休整次数，顶栏星级立刻变。各卷扣星阈值在「关卡管理」，改完点保存并生效。</div>
              <StarNowEditor />
            </div>
            <DbgAction label="体力调 99" desc="放开搜寻次数限制" onClick={debugStamina} />
            {levels.map((lv) => (
              <DbgAction
                key={lv}
                label={`跳至第${lv}关`}
                desc={lv === s.level ? '重置本关进度（熟悉度清零）' : '直接进入该关开局状态'}
                onClick={() => {
                  debugJumpLevel(lv);
                  close();
                }}
              />
            ))}
            <DbgAction
              label="直达结局前态"
              desc="全卡归位、全档案完成，只差末关闸门答题"
              onClick={() => {
                debugPreEnding();
                close();
              }}
            />
          </DbgSection>

          {copyeditAvailable() ? (
            <DbgSection title="内容编辑（写回 final_game.json）">
              <DbgAction
                label="作品设置"
                desc="标题/副标题/体力经济/平均字数/完工状态/全局画风/标题图·结局图·主题图标与 prompt"
                onClick={() => openCe({ kind: 'meta' })}
              />
              <DbgAction
                label="关卡管理"
                desc="总览每关的时间轴·卡数·档案·闸门·过场·故事回顾；各卷评星阈值；增删关卡，直达各分项编辑器"
                onClick={() => openCe({ kind: 'levels' })}
              />
              <DbgAction
                label="词条库"
                desc="新建/删除词条，改分类与重要度，改图与生图 prompt，配开局赠送词条"
                onClick={() => openCe({ kind: 'entries' })}
              />
              <DbgAction
                label={`新建第${s.level}关的情节卡`}
                desc="建一张空白卡放进本关第一个空格，随即打开卡编辑器"
                onClick={() => void createCard(s.level, { fromDebug: true })}
              />
              <DbgAction
                label={`第${s.level}关时间轴`}
                desc="时间行、人物列、每格放哪张卡；实时显示四条密度红线"
                onClick={() => openCe({ kind: 'timeline', level: s.level })}
              />
              <DbgAction
                label={`第${s.level}关故事回顾`}
                desc="【回顾本关故事】的分页、行区间、预览图与逐页文章"
                onClick={() => openCe({ kind: 'recap', level: s.level })}
              />
              <DbgAction
                label={`第${s.level}关过场`}
                desc="frame.levelIntro：只讲故事，不对玩家说话"
                onClick={() => openCe({ kind: 'frame', target: 'intro', level: s.level })}
              />
              <DbgAction
                label="结局文本"
                desc="frame.ending：事实 / 代价 / 主题 / 余响四件事"
                onClick={() => openCe({ kind: 'frame', target: 'ending' })}
              />
              <DbgAction
                label="背景音乐"
                desc="assets.bgm：每关开篇曲与卡曲的绑定、曲名、Suno prompt（可复制）、试听与更换 mp3；曲数公式自检"
                onClick={() => openCe({ kind: 'bgm' })}
              />
            </DbgSection>
          ) : (
            <DbgSection title="内容编辑">
              <DbgAction
                label="需要后端在线"
                desc="写回 final_game.json 要后端：另开终端 node backend/server.js（:6872），再点此重试或刷新页面。仅 npm run dev 不够"
                onClick={() => {
                  void (async () => {
                    await initCopyedit();
                    if (copyeditAvailable()) {
                      pushToast('后端已连接，内容编辑可用');
                      setUi({ debugOpen: true }); // 触发重渲染，切出编辑入口
                    } else {
                      pushToast('仍连不上：请先 node backend/server.js');
                    }
                  })();
                }}
              />
            </DbgSection>
          )}

          <DbgSection title="危险操作">
            <DbgAction
              label="清空存档重开"
              desc="删除本作存档并回到标题页"
              danger
              onClick={() => {
                debugClear();
                close();
              }}
            />
          </DbgSection>
        </div>
        <div className="modal-foot">
          <span className="ce-spacer" />
          <button className="btn" type="button" onClick={close}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function DbgSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dbg-sec">
      <div className="dbg-sec-title">{title}</div>
      <div className="dbg-grid">{children}</div>
    </div>
  );
}

function DbgAction({
  label,
  desc,
  danger,
  onClick,
}: {
  label: string;
  desc: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`dbg-action${danger ? ' danger' : ''}`} onClick={onClick}>
      <span className="dbg-action-label">{label}</span>
      <span className="dbg-action-desc">{desc}</span>
    </button>
  );
}
