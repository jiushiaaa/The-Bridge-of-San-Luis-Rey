// 右区：词条库（仅情节卡页显示；窄屏以抽屉形态打开）
import { t } from '../i18n';
import { data } from '../game/data';
import { searchRemaining } from '../game/logic';
import { playCue } from '../game/sfx';
import { ENTRY_VIEWS, setEntryView, setUi, useGame, useUi, type EntryView } from '../game/store';
import EntryPanel from './EntryPanel';
import Icon, { type IconName } from './Icon';

const VIEW_ICON: Record<EntryView, IconName> = { full: 'grid', compact: 'list' };

/** 词条库显示模式切换（完整 / 精简），偏好存 localStorage */
export function EntryViewSwitch() {
  const { entryView } = useUi();
  return (
    <div className="pane-view-switch" role="group" aria-label={t('game.viewMode')}>
      {ENTRY_VIEWS.map((v) => {
        const on = entryView === v;
        const label = t(`game.view.${v}`);
        return (
          <button
            key={v}
            type="button"
            className={`pane-view-btn${on ? ' is-on' : ''}`}
            aria-pressed={on}
            title={`${t('game.viewMode')} · ${label}`}
            aria-label={label}
            data-entry-view={v}
            onClick={() => {
              if (on) return;
              setEntryView(v);
              playCue('toggle-on');
            }}
          >
            <Icon name={VIEW_ICON[v]} size={14} />
          </button>
        );
      })}
    </div>
  );
}

/** 词条库红点 = 当前页面中「搜寻」按钮的数量（每个仍可搜寻的词条计 +1，不看剩余次数）；
 *  右栏标题与窄屏页签栏入口共用同一份计数 */
export function useSearchCount(): number {
  const s = useGame();
  return Object.keys(data.entries).filter((id) => s.entries[id]?.collected && searchRemaining(id, s) > 0).length;
}

export default function RightPanel({ drawer }: { drawer?: boolean }) {
  const searchCount = useSearchCount();
  return (
    <div className={`pane pane-right${drawer ? ' pane-right-drawer' : ''}`}>
      <div className="pane-head pane-tabs">
        <span className="pane-tab active" data-tab="entries">
          <Icon name="book" size={14} /> {t('game.entries')}
          {searchCount > 0 ? <span className="badge">{searchCount}</span> : null}
        </span>
        <EntryViewSwitch />
        {drawer ? (
          <button className="pane-drawer-close" title={t('game.closeEntries')} onClick={() => setUi({ entryDrawer: false })}>
            {t('common.close')} <Icon name="close" size={12} />
          </button>
        ) : null}
      </div>
      <div className="pane-body scroll-y">
        <EntryPanel />
      </div>
    </div>
  );
}
