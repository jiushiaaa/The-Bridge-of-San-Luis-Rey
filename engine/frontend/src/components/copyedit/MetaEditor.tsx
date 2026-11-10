// DEBUG-文案 · 作品设置：标题/副标题/版本、体力经济、字数规格、完工状态、全局画风、标题与结局图、主题图标
// 完工状态（meta.status）决定「使用者与时机」（README_game §9）：
//   wip   使用者是 AI，全部设计规范强制执行；
//   final 使用者是内容总监，规范类只提示不阻断（校验器与编辑器两侧一致）。
import { rebuildFavicon, saveGameData } from '../../game/copyedit';
import { assetPrefix } from '../../game/copyedit';
import { data } from '../../game/data';
import type { ArtStyleConf, GameStatus } from '../../game/types';
import { CeShell, ImageField, useDraft } from './common';

const ART_LABEL: Record<keyof ArtStyleConf, string> = {
  portrait: '人物头像',
  scene: '地点 / 标题 / 结局',
  item: '物品静物',
  concept: '概念意象',
  cg: '情节卡 CG',
  icon: '主题图标',
};

const DEFAULT_ART: ArtStyleConf = {
  portrait: '',
  scene: '',
  item: '',
  concept: '',
  cg: '',
  icon: '',
};

interface MetaDraft {
  title: string;
  subtitle: string;
  tagline: string;
  adaptedFrom: string;
  version: number;
  status: GameStatus;
  cardAvg: number;
  stamina: { start: number; perLevel: number; searchCost: number; completeReward: number; restGain: number };
  art: ArtStyleConf;
  titleImagePrompt: string;
  endingImagePrompt: string;
  sceneIconPrompt: string;
}

export default function MetaEditor() {
  const [draft, upd] = useDraft<MetaDraft>(() => ({
    title: data.meta.title,
    subtitle: data.meta.subtitle,
    tagline: data.meta.tagline ?? '',
    adaptedFrom: data.meta.adaptedFrom ?? '',
    version: data.meta.version,
    status: data.meta.status ?? 'wip',
    cardAvg: data.meta.cardSpec?.avg ?? 0,
    stamina: { ...data.meta.stamina },
    art: { ...DEFAULT_ART, ...(data.meta.art ?? {}) },
    titleImagePrompt: data.assets.titleImagePrompt ?? '',
    endingImagePrompt: data.assets.endingImagePrompt ?? '',
    sceneIconPrompt: data.assets.sceneIconPrompt ?? '',
  }));

  const errors: string[] = [];
  const specErrors: string[] = [];
  const warnings: string[] = [];
  if (!draft.title.trim()) errors.push('作品标题不能为空');
  if (draft.stamina.start <= 0) errors.push('初始体力必须大于 0');
  if (draft.cardAvg < 0) errors.push('平均字数不能为负');
  for (const w of ['拾遗人', '档案修复员', '修复员', '整理残卷']) {
    if (draft.subtitle.includes(w)) specErrors.push(`副标题里有身份词「${w}」（README_game §4.7：subtitle 不挂身份）`);
    if (draft.tagline.includes(w)) specErrors.push(`题记里有身份词「${w}」（README_game §4.7）`);
  }
  const tg = draft.tagline.trim();
  if (tg) {
    if (!/[？?]$/.test(tg)) specErrors.push('题记（全作之问）要以「？」结尾');
    if (tg.length > 30) specErrors.push(`题记 ${tg.length} 字，规范 ≤30 字`);
    for (const w of ['你', '您', '玩家']) if (tg.includes(w)) specErrors.push(`题记不能对玩家说话（含「${w}」）`);
    for (const w of ['残页', '页序', '拼回', '拼齐', '归位', '词条', '时间轴', '完形填空', '活计', '关卡', '存档', '补回名字', '本关']) {
      if (tg.includes(w)) specErrors.push(`题记不能出现玩法词汇「${w}」`);
    }
  }
  if (draft.status === 'final') {
    warnings.push('作品已标记完工：字数、分层、留白分布等设计规范在编辑器与校验器里都只作建议，不再阻断保存。');
  }

  const save = () =>
    saveGameData((g) => {
      g.meta.title = draft.title.trim();
      g.meta.subtitle = draft.subtitle.trim();
      if (draft.tagline.trim()) g.meta.tagline = draft.tagline.trim();
      else delete g.meta.tagline;
      if (draft.adaptedFrom.trim()) g.meta.adaptedFrom = draft.adaptedFrom.trim();
      else delete g.meta.adaptedFrom;
      g.meta.version = draft.version;
      g.meta.status = draft.status;
      g.meta.stamina = { ...draft.stamina };
      if (draft.cardAvg > 0) g.meta.cardSpec = { avg: draft.cardAvg };
      else delete g.meta.cardSpec;
      g.meta.art = { ...draft.art };
      const set = (k: 'titleImagePrompt' | 'endingImagePrompt' | 'sceneIconPrompt', v: string) => {
        if (v.trim()) g.assets[k] = v.trim();
        else delete g.assets[k];
      };
      set('titleImagePrompt', draft.titleImagePrompt);
      set('endingImagePrompt', draft.endingImagePrompt);
      set('sceneIconPrompt', draft.sceneIconPrompt);
    });

  const num = (v: number, on: (n: number) => void, w = 70) => (
    <input
      className="ce-input"
      type="number"
      style={{ width: w }}
      value={v}
      onChange={(e) => on(Number(e.target.value))}
    />
  );

  return (
    <CeShell
      title={`DEBUG-内容 · 作品设置（${data.meta.id}）`}
      onSave={save}
      errors={errors}
      specErrors={specErrors}
      warnings={warnings}
    >
      <div className="ce-sec">
        <div className="ce-sec-title">基本信息</div>
        <div className="ce-row">
          <span className="ce-row-label">标题</span>
          <input
            className="ce-input"
            style={{ width: 240 }}
            value={draft.title}
            onChange={(e) => upd((d) => void (d.title = e.target.value))}
          />
          <span className="ce-row-label">版本</span>
          {num(draft.version, (n) => upd((d) => void (d.version = n)))}
        </div>
        <div className="ce-row">
          <span className="ce-row-label">副标题</span>
          <input
            className="ce-input"
            style={{ flex: 1 }}
            value={draft.subtitle}
            onChange={(e) => upd((d) => void (d.subtitle = e.target.value))}
          />
        </div>
        <div className="ce-row">
          <span className="ce-row-label">题记</span>
          <input
            className="ce-input"
            style={{ flex: 1 }}
            placeholder="全作之问，如：全镇都知道有人要杀他，为什么没有一个人拦住？"
            value={draft.tagline}
            onChange={(e) => upd((d) => void (d.tagline = e.target.value))}
          />
        </div>
        <div className="ce-note">题记显示在封面副标题下一行：一句问句说清整部作品的悬念（≤30 字、不用「你」、不含玩法词汇；可留空）</div>
        <div className="ce-row">
          <span className="ce-row-label">改编出处</span>
          <input
            className="ce-input"
            style={{ flex: 1 }}
            placeholder="封面副标题右侧的一行小字，如：改编自赫尔曼·黑塞《悉达多》（可留空）"
            value={draft.adaptedFrom}
            onChange={(e) => upd((d) => void (d.adaptedFrom = e.target.value))}
          />
        </div>
      </div>

      <div className="ce-sec">
        <div className="ce-sec-title">完工状态（使用者与时机）</div>
        <div className="ce-row">
          <label>
            <input
              type="radio"
              name="ce-status"
              checked={draft.status === 'wip'}
              onChange={() => upd((d) => void (d.status = 'wip'))}
            />{' '}
            制作中 wip —— 使用者是 AI，全部设计规范强制执行
          </label>
        </div>
        <div className="ce-row">
          <label>
            <input
              type="radio"
              name="ce-status"
              checked={draft.status === 'final'}
              onChange={() => {
                if (window.confirm('标记为已完工后，字数/分层/分布等设计规范在编辑器与校验器里都只作建议，不再阻断。确定？'))
                  upd((d) => void (d.status = 'final'));
              }}
            />{' '}
            已完工 final —— 使用者是内容总监，规范只提示不阻断
          </label>
        </div>
        <div className="ce-note">
          任何模式下「完整性错误」（引用不存在的词条、时间轴坐标冲突、通不了关……）都仍然拦截，
          否则数据会坏。命令行可用 <code>--author</code> / <code>--director</code> 强制某一档。
        </div>
      </div>

      <div className="ce-sec">
        <div className="ce-sec-title">体力经济与字数规格</div>
        <div className="ce-row">
          <span className="ce-row-label">初始</span>
          {num(draft.stamina.start, (n) => upd((d) => void (d.stamina.start = n)))}
          <span className="ce-row-label">每关 +</span>
          {num(draft.stamina.perLevel, (n) => upd((d) => void (d.stamina.perLevel = n)))}
          <span className="ce-row-label">搜寻 -</span>
          {num(draft.stamina.searchCost, (n) => upd((d) => void (d.stamina.searchCost = n)))}
          <span className="ce-row-label">补完 +</span>
          {num(draft.stamina.completeReward, (n) => upd((d) => void (d.stamina.completeReward = n)))}
          <span className="ce-row-label">休整 +</span>
          {num(draft.stamina.restGain, (n) => upd((d) => void (d.stamina.restGain = n)))}
        </div>
        <div className="ce-row">
          <span className="ce-row-label">全卡平均字数 X</span>
          {num(draft.cardAvg, (n) => upd((d) => void (d.cardAvg = n)), 90)}
          <span className="ce-note">
            0 = 不做字数分层检查。改了体力数值后务必重跑通关模拟（保存会自动跑质检）。
          </span>
        </div>
      </div>

      <div className="ce-sec">
        <div className="ce-sec-title">特殊图与主题图标</div>
        <ImageField
          label="标题图（3:2）"
          wide
          path={data.assets.titleImage}
          defaultPath={`${assetPrefix()}/images/title.jpg`}
          prompt={draft.titleImagePrompt}
          onPrompt={(v) => upd((d) => void (d.titleImagePrompt = v))}
          onPath={(p) => void saveGameData((g) => void (g.assets.titleImage = p))}
        />
        <ImageField
          label="结局图（3:2）"
          wide
          path={data.assets.endingImage}
          defaultPath={`${assetPrefix()}/images/ending.jpg`}
          prompt={draft.endingImagePrompt}
          onPrompt={(v) => upd((d) => void (d.endingImagePrompt = v))}
          onPath={(p) => void saveGameData((g) => void (g.assets.endingImage = p))}
        />
        <ImageField
          label="主题图标（1:1，情节列头 + favicon 源）"
          path={data.assets.sceneIcon}
          defaultPath={`${assetPrefix()}/images/scene_icon.jpg`}
          prompt={draft.sceneIconPrompt}
          promptHint="单一聚焦的核心意象，徽章式居中构图，画面内不得有文字"
          onPrompt={(v) => upd((d) => void (d.sceneIconPrompt = v))}
          onPath={(p) => void saveGameData((g) => void (g.assets.sceneIcon = p))}
        />
        <div className="ce-row">
          <button className="btn" onClick={() => void rebuildFavicon()}>
            由主题图标重切 favicon（中心 88% → 64×64）
          </button>
        </div>
      </div>

      <div className="ce-sec">
        <div className="ce-sec-title">全局画风后缀（生图时按用途自动拼在 prompt 尾部）</div>
        {(Object.keys(ART_LABEL) as (keyof ArtStyleConf)[]).map((k) => (
          <div className="ce-row" key={k}>
            <span className="ce-row-label">{ART_LABEL[k]}</span>
            <textarea
              className="ce-textarea"
              style={{ flex: 1 }}
              rows={2}
              value={draft.art[k]}
              onChange={(e) => upd((d) => void (d.art[k] = e.target.value))}
            />
          </div>
        ))}
        <div className="ce-note">
          留空则用引擎内置的明亮日式动画风（tools/art_spec.py 的 DEFAULT_ART）。这是自行出图时建议拼上的画风后缀，
          已生成的图不受影响。
        </div>
      </div>
    </CeShell>
  );
}
