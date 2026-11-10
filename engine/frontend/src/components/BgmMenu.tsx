// 背景音乐菜单内容：播放模式（循环 / 随机 / 单曲循环）+ 歌单，分「本卷曲目 / 往期曲目 / 未解锁」三组。
// 每行 = 封面（黑胶，播放中旋转）| 曲名 / 来源（第 N 卷 · 情节卡名）| 复选框
//（本卷曲：取消勾选即出单；往期曲：勾选 = 临时加入本关歌单，换关即清）。
// 页签栏迷你播放器的弹出菜单与「菜单」弹层里的 BGM 行共用。
import { t } from '../i18n';
import {
  BGM_MODES,
  bgmPlaylistIds,
  bgmTracks,
  playBgmTrack,
  setBgmMode,
  setBgmTrackSelected,
  toggleBgm,
  unlockedBgmIds,
  useBgm,
  type BgmMode,
  type BgmSnap,
} from '../game/bgm';
import { assetUrl, cardDef, data } from '../game/data';
import { playCue } from '../game/sfx';
import { useGame } from '../game/store';
import type { BgmTrackDef, GameState } from '../game/types';
import Icon, { type IconName } from './Icon';

export const BGM_MODE_ICON: Record<BgmMode, IconName> = {
  loop: 'repeat',
  shuffle: 'shuffle',
  one: 'repeatOne',
};

export function bgmModeLabel(mode: BgmMode): string {
  return t(`bgm.${mode}`);
}

/** 曲目封面 = 获得它那一刻的画面：情节卡解锁 → 该卡 CG；到卷解锁 → 该卷开场图；封面曲 / 结局曲 → 标题图 / 结局图 */
export function bgmCover(track: BgmTrackDef): string | undefined {
  if (track.unlockCard) {
    const cg = cardDef(track.unlockCard)?.cg;
    if (cg) return cg;
  }
  if (track.stage === 'title') return data.assets.titleImage;
  if (track.stage === 'ending') return data.assets.endingImage || data.assets.titleImage;
  return data.assets.levelIntroImages?.[String(track.stage)] || data.assets.titleImage;
}

/** 来源文案：「第 N 卷 · 情节卡名」；未补完的卡名不外泄 */
export function bgmSource(track: BgmTrackDef, s: GameState): string {
  if (track.stage === 'title') return t('bgm.srcCover');
  if (track.stage === 'ending') return t('notes.ending');
  const vol = t('common.vol', { n: track.stage });
  if (track.unlockCard) {
    const c = cardDef(track.unlockCard);
    const done = !!s.cards[track.unlockCard]?.done;
    return `${vol} · ${done && c ? c.title : t('common.unknown')}`;
  }
  return `${vol} · ${t('notes.intro')}`;
}

/** 黑胶唱片：圆形封面 + 中心孔；spinning 时缓慢旋转。locked 不露图（防剧透） */
export function BgmDisc({
  src,
  spinning,
  size,
  locked = false,
  className,
}: {
  src?: string;
  spinning: boolean;
  size: number;
  locked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`bgm-disc${spinning ? ' is-spin' : ''}${locked ? ' is-locked' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src && !locked ? (
        <img
          className="bgm-disc-img"
          src={assetUrl(src)}
          alt=""
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <span className="bgm-disc-hole" />
    </span>
  );
}

export default function BgmMenu() {
  const snap = useBgm();
  const s = useGame();
  const unlocked = unlockedBgmIds(s);
  const playlist = bgmPlaylistIds(s);
  const inList = new Set(playlist);
  // 三组：本阶段曲（歌单基底）/ 往期已解锁（勾选 = 临时入单）/ 未解锁
  const all = bgmTracks();
  const groups: { key: string; label: string; tracks: BgmTrackDef[] }[] = [
    { key: 'now', label: t('bgm.groupNow'), tracks: all.filter((tr) => tr.stage === snap.stage) },
    { key: 'other', label: t('bgm.groupOther'), tracks: all.filter((tr) => tr.stage !== snap.stage && unlocked.has(tr.id)) },
    { key: 'locked', label: t('bgm.groupLocked'), tracks: all.filter((tr) => tr.stage !== snap.stage && !unlocked.has(tr.id)) },
  ].filter((g) => g.tracks.length > 0);

  return (
    <div className="bgm-menu">
      <div className="bgm-modes" role="group" aria-label={t('bgm.mode')}>
        {BGM_MODES.map((m) => {
          const on = snap.mode === m;
          return (
            <button
              key={m}
              type="button"
              className={`bgm-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              data-bgm-mode={m}
              onClick={() => {
                if (on) return;
                setBgmMode(m);
                playCue('toggle-on');
              }}
            >
              <Icon name={BGM_MODE_ICON[m]} size={13} />
              {bgmModeLabel(m)}
            </button>
          );
        })}
      </div>
      <div className="bgm-list-kicker">
        <span>{t('bgm.tracks')}</span>
        <span className="bgm-list-count">{t('bgm.listCount', { n: playlist.length, total: unlocked.size })}</span>
      </div>
      <ul className="bgm-track-list">
        {groups.map((g) => [
          <li key={`g-${g.key}`} className="bgm-track-group" aria-hidden="true">
            {g.label}
          </li>,
          ...g.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              s={s}
              snap={snap}
              unlockedOk={unlocked.has(track.id)}
              checked={inList.has(track.id)}
              lastOne={inList.has(track.id) && playlist.length <= 1}
            />
          )),
        ])}
      </ul>
    </div>
  );
}

function TrackRow({
  track,
  s,
  snap,
  unlockedOk,
  checked,
  lastOne,
}: {
  track: BgmTrackDef;
  s: GameState;
  snap: BgmSnap;
  unlockedOk: boolean;
  checked: boolean;
  lastOne: boolean;
}) {
  const active = snap.trackId === track.id;
  const isNew = snap.newTrackId === track.id;
  return (
    <li
      className={`bgm-track${active ? ' is-on' : ''}${unlockedOk ? '' : ' is-locked'}${isNew ? ' is-new' : ''}${checked ? '' : ' is-off'}`}
      data-bgm-track={track.id}
    >
      <button
        type="button"
        className="bgm-track-main"
        disabled={!unlockedOk}
        aria-current={active ? 'true' : undefined}
        title={unlockedOk ? (active ? (snap.playing ? t('bgm.pause') : t('bgm.play')) : t('bgm.play')) : t('bgm.locked')}
        onClick={() => {
          if (!unlockedOk) return;
          if (active) toggleBgm();
          else playBgmTrack(track.id);
        }}
      >
        <BgmDisc src={bgmCover(track)} spinning={active && snap.playing} size={36} locked={!unlockedOk} />
        <span className="bgm-track-text">
          <span className="bgm-track-title">
            {track.title}
            {isNew ? <span className="bgm-new-tag">{t('bgm.new')}</span> : null}
          </span>
          <span className="bgm-track-src">{bgmSource(track, s)}</span>
        </span>
        {active ? <Icon name={snap.playing ? 'pause' : 'play'} size={12} className="bgm-track-state" /> : null}
      </button>
      {unlockedOk ? (
        <label className={`bgm-track-check${lastOne ? ' is-last' : ''}`} title={lastOne ? t('bgm.keepOne') : t('bgm.inList')}>
          <input
            type="checkbox"
            checked={checked}
            disabled={lastOne}
            aria-label={t('bgm.inList')}
            onChange={(e) => {
              setBgmTrackSelected(track.id, e.currentTarget.checked);
              playCue(e.currentTarget.checked ? 'toggle-on' : 'toggle-off');
            }}
          />
        </label>
      ) : (
        <Icon name="lock" size={12} className="bgm-track-lock" />
      )}
    </li>
  );
}
