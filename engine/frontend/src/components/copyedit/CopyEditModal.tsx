// DEBUG-文案 编辑器分发：按 ui.copyedit.kind 渲染对应编辑器（key 保证切换目标时重建草稿）
import { useUi } from '../../game/store';
import ArchiveEditor from './ArchiveEditor';
import BgmEditor from './BgmEditor';
import CardEditor from './CardEditor';
import EntriesEditor from './EntriesEditor';
import FrameEditor from './FrameEditor';
import GateEditor from './GateEditor';
import LevelEditor from './LevelEditor';
import MetaEditor from './MetaEditor';
import RecapEditor from './RecapEditor';
import TimelineEditor from './TimelineEditor';

export default function CopyEditModal() {
  const ui = useUi();
  const conf = ui.copyedit;
  if (!conf) return null;
  const key = JSON.stringify(conf);
  switch (conf.kind) {
    case 'entries':
      return <EntriesEditor key={key} />;
    case 'card':
      return <CardEditor key={key} cardId={conf.cardId} />;
    case 'timeline':
      return <TimelineEditor key={key} level={conf.level} />;
    case 'gate':
      return <GateEditor key={key} after={conf.after} />;
    case 'archive':
      return <ArchiveEditor key={key} entryId={conf.entryId} />;
    case 'frame':
      return <FrameEditor key={key} conf={conf} />;
    case 'meta':
      return <MetaEditor key={key} />;
    case 'levels':
      return <LevelEditor key={key} />;
    case 'recap':
      return <RecapEditor key={key} level={conf.level} />;
    case 'bgm':
      return <BgmEditor key={key} />;
  }
}
