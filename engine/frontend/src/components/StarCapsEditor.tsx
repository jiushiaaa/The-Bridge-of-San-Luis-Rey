// DEBUG：改本关错误 / 休整次数以便立刻看星级（评星规则固定：每 3 次错误 / 休整扣一星，见 logic.starBreakdown）
import { useEffect, useState } from 'react';
import { debugSetLevelErrors, debugSetRests } from '../game/logic';
import { useGame } from '../game/store';

function NumInput({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => {
    setRaw(String(value));
  }, [value]);
  const commit = (v: string) => {
    const n = Number(v);
    if (v.trim() !== '' && Number.isFinite(n)) onChange(n);
    else setRaw(String(value));
  };
  return (
    <input
      className="dbg-cap-input"
      type="number"
      min={min}
      max={max}
      aria-label={label}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (v.trim() !== '' && Number.isFinite(Number(v))) onChange(Number(v));
      }}
      onBlur={() => commit(raw)}
    />
  );
}

/** 改本关错误次数与本关休整次数（资源与关卡里改） */
export function StarNowEditor() {
  const s = useGame();
  const pl = s.stats.perLevel[String(s.level)];
  return (
    <div className="dbg-caps-now">
      <label>
        本关错误
        <NumInput label="本关错误次数" min={0} max={999} value={pl?.errors ?? 0} onChange={debugSetLevelErrors} />
      </label>
      <label>
        本关休整
        <NumInput label="本关休整次数" min={0} max={999} value={pl?.rests ?? 0} onChange={debugSetRests} />
      </label>
    </div>
  );
}
