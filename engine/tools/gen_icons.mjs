// 生成 favicon.ico（32×32 PNG-in-ICO）与 npc_unknown.png（96×96 透明剪影）
// 纯 node + zlib 手搓 PNG 编码，无外部依赖
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** RGBA 像素数组 -> PNG Buffer。pixels: Uint8Array(w*h*4) */
function encodePng(w, h, pixels) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = pixels[y * w * 4 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 画布 ----------
function canvas(w, h) {
  const px = new Uint8Array(w * h * 4); // 全透明
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const circle = (cx, cy, r, col) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, ...col);
  };
  const ellipse = (cx, cy, rx, ry, col) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if ((x - cx) ** 2 / (rx * rx) + (y - cy) ** 2 / (ry * ry) <= 1) set(x, y, ...col);
  };
  const rect = (x0, y0, x1, y1, col) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ...col);
  };
  /** 四点星（闪光）：中心 (cx,cy)，半径 r，厚度 t */
  const sparkle = (cx, cy, r, t, col) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
        if (dx + dy <= r && (dx <= t || dy <= t || dx + dy <= t * 2.2)) set(x, y, ...col);
      }
  };
  return { px, set, circle, ellipse, rect, sparkle };
}

// ---------- favicon：皮革底 + 金书卷 + 星光 ----------
{
  const S = 32;
  const c = canvas(S, S);
  const LEATHER = [44, 42, 38, 255];
  const GOLD = [184, 145, 47, 255];
  const PAPER = [246, 240, 228, 255];
  c.rect(0, 0, S - 1, S - 1, LEATHER);
  // 打开的书卷（纸色）
  c.rect(6, 17, 25, 25, PAPER);
  c.rect(15, 16, 16, 25, [230, 220, 200, 255]); // 书脊阴影
  c.set(15, 17, ...LEATHER); c.set(16, 17, ...LEATHER);
  // 金色四角星
  c.sparkle(16, 9, 8, 2, GOLD);
  c.sparkle(16, 9, 3, 1, [212, 175, 55, 255]);
  const png = encodePng(S, S, c.px);
  // ICO: 目录 + PNG 数据
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = S; entry[1] = S; entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  const ico = Buffer.concat([header, entry, png]);
  fs.writeFileSync(path.join(ROOT, 'frontend', 'favicon.ico'), ico);
  console.log('favicon.ico', ico.length, 'bytes');
}

// ---------- 未知 NPC：透明底系统剪影 ----------
{
  const S = 96;
  const c = canvas(S, S);
  const INK = [58, 56, 51, 255];
  const INK2 = [90, 86, 78, 255];
  // 头
  c.circle(48, 34, 18, INK);
  // 肩/身（下半椭圆，底部裁切）
  c.ellipse(48, 88, 30, 26, INK);
  // 脸部高光（系统感：左侧浅边）
  c.ellipse(42, 30, 6, 10, INK2);
  // 问号（纸色镂空）
  const Q = [
    '01110',
    '10001',
    '00001',
    '00010',
    '00100',
    '00100',
    '00000',
    '00100',
  ];
  const qx = 48 - 2, qy = 26;
  const PAPER = [246, 240, 228, 255];
  Q.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch === '1') c.rect(qx + dx * 2 - 1, qy + dy * 2 - 1, qx + dx * 2, qy + dy * 2, PAPER);
    });
  });
  const png = encodePng(S, S, c.px);
  // 用法: node tools/gen_icons.mjs [xdd|bad|murder|weicheng]（默认 xdd）——favicon 始终重写；剪影写入指定作品目录
  const GAMES = { xdd: ['xidaduo', 'xdd-assets'], bad: ['badblood', 'bad-assets'], murder: ['murder', 'murder-assets'], weicheng: ['WeiCheng_QianZhongShu', 'wc-assets'] };
  const GAME = GAMES[process.argv[2]] ? process.argv[2] : 'xdd';
  const [dir, assets] = GAMES[GAME];
  const out = path.join(ROOT, 'workspace', dir, assets, 'images', 'npc_unknown.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png);
  console.log('npc_unknown.png ->', GAME, png.length, 'bytes');
}
