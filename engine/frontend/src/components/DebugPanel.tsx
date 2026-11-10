// ?debug=1 调试面板：直达各关键状态，供开发与自动化测试使用
// 面板固定在右下角，会盖住右栏底部（闸门填空最后几行就在那儿），所以标题可点，收起后只剩一条
import { useState } from 'react';
import { maxLevel } from '../game/data';
import { useLayout } from '../game/layout';
import {
  debugClear,
  debugFillLevel,
  debugJumpLevel,
  debugPreEnding,
  debugStamina,
  debugUnlockLevel,
} from '../game/logic';
import { useGame } from '../game/store';

export default function DebugPanel() {
  const s = useGame();
  const phone = useLayout() === 'phone';
  const [open, setOpen] = useState(!phone);
  return (
    <div className={`debug-panel${open ? '' : ' is-folded'}`}>
      <button
        className="debug-title"
        type="button"
        aria-expanded={open}
        title={open ? '收起调试面板' : '展开调试面板'}
        onClick={() => setOpen(!open)}
      >
        调试 · 第{s.level}关
      </button>
      {open ? (
        <>
          <button className="btn" onClick={debugUnlockLevel}>
            解锁本关全卡
          </button>
          <button className="btn" onClick={debugFillLevel}>
            补全本关填写与档案
          </button>
          <button className="btn" onClick={debugStamina}>
            体力调 99
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lv) => (
              <button key={lv} className="btn" style={{ flex: 1 }} onClick={() => debugJumpLevel(lv)}>
                跳关{lv}
              </button>
            ))}
          </div>
          <button className="btn" onClick={debugPreEnding}>
            直达结局前态
          </button>
          <button className="btn" onClick={debugClear}>
            清空存档重开
          </button>
        </>
      ) : null}
    </div>
  );
}
