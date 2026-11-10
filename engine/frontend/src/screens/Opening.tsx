// 框架故事单段的通用排版（「故事」页与回顾长廊复用）
// 关卡过场不再走这里，改由 LevelIntro.tsx 单句呈现
import type { FrameSeg } from '../game/types';
import { Seal } from '../components/Avatar';

/** 框架故事单段展示（过场阅读台 / 故事页复用） */
export function FrameSegView({ seg }: { seg: FrameSeg }) {
  if (seg.kind === 'narration') {
    return <div className="read-seg narration">{seg.text}</div>;
  }
  return (
    <div className="read-seg dialogue">
      <span className="read-speaker">
        <Seal name={seg.speaker} color="#8a6a3f" size={52} />
        <span>{seg.speaker}</span>
      </span>
      <span className="bubble" style={{ flex: 1 }}>
        {seg.text}
      </span>
    </div>
  );
}
