// 头像/印章组件：图片加载失败一律回退为「首字印章」色块
import { useState } from 'react';
import { assetUrl, entryDef, TYPE_COLOR } from '../game/data';

export function Seal({ name, color, size, soft }: { name: string; color: string; size: number; soft?: boolean }) {
  return (
    <span
      className={soft ? 'seal soft' : 'seal'}
      style={
        soft
          ? { width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.48)) }
          : { width: size, height: size, background: color, fontSize: Math.max(12, Math.round(size * 0.48)) }
      }
    >
      {name.slice(0, 1)}
    </span>
  );
}

interface AvatarProps {
  entryId?: string; // 按词条取头像与配色
  src?: string; // 直接指定图片（如神秘剪影）
  name?: string; // 兜底印章用名
  color?: string; // 兜底印章底色
  size?: number;
  round?: boolean;
  fill?: boolean; // 方形铺满父容器（宽高由 CSS 控制，1:1 裁剪）
  /** 未知人物槽位染色类名（如 slot-tint-0），对剪影图做色相滤镜 */
  tintClass?: string;
}

export default function Avatar({
  entryId,
  src,
  name,
  color,
  size = 32,
  round = true,
  fill = false,
  tintClass,
}: AvatarProps) {
  const def = entryId ? entryDef(entryId) : undefined;
  // 无头像的词条（物品/地点等）回退用档案图，皆无则「首字印章」
  const img = src ?? def?.avatar ?? def?.image;
  const label = name ?? def?.name ?? '?';
  const c = color ?? (def ? TYPE_COLOR[def.type] : '#2c2a26');
  const [err, setErr] = useState(false);
  const tint = tintClass ? ` ${tintClass}` : '';
  if (!img || err) return <Seal name={label} color={c} size={size} />;
  if (fill) {
    return (
      <img className={`avatar-fill${tint}`} src={assetUrl(img)} alt={label} onError={() => setErr(true)} />
    );
  }
  return (
    <img
      className={`${round ? 'avatar' : 'avatar-sq'}${tint}`}
      src={assetUrl(img)}
      alt={label}
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  );
}
