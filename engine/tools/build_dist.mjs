// tools/build_dist.mjs — 发布构建：把某部作品的离线单文件版整理到工程根目录 dist/（lumimaker publish 的上传目录）
// 用法: node tools/build_dist.mjs [xdd]（默认 xdd）
// 前置: node tools/build_offline.mjs <作品>（生成 workspace/{作品}/index.html + *.woff2）
// dist/ 只含 index.html、字体与该作素材目录；final_game.json / i18n / DEBUG 不进包（数据已内联进 html）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = {
  slr: { dir: 'sanluisrey', assets: 'slr-assets' },
  xdd: { dir: 'xidaduo', assets: 'xdd-assets' },
  bad: { dir: 'badblood', assets: 'bad-assets' },
  murder: { dir: 'murder', assets: 'murder-assets' },
};
const GAME = process.argv[2] || 'xdd';
const cfg = GAMES[GAME];
if (!cfg) {
  console.error(`未知作品 "${GAME}"，可选：${Object.keys(GAMES).join(' | ')}`);
  process.exit(1);
}
const SRC = path.join(ROOT, 'workspace', cfg.dir);
const DIST = path.join(ROOT, 'dist');
const html = path.join(SRC, 'index.html');
if (!fs.existsSync(html)) {
  console.error(`[dist] 缺少 ${path.relative(ROOT, html)}，请先运行 node tools/build_offline.mjs ${GAME}`);
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(html, path.join(DIST, 'index.html'));
for (const f of fs.readdirSync(SRC)) {
  if (f.endsWith('.woff2')) fs.copyFileSync(path.join(SRC, f), path.join(DIST, f));
}
fs.cpSync(path.join(SRC, cfg.assets), path.join(DIST, cfg.assets), { recursive: true });

// 平台红线：产物里不得引用任何在线资源
const page = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const remote = [...page.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)|url\(\s*["']?(https?:\/\/[^)"']+)/g)]
  .map((m) => m[1] || m[2]);
if (remote.length) {
  console.error('[dist] 发现外链资源，平台不允许：', [...new Set(remote)].slice(0, 10));
  process.exit(1);
}

let files = 0;
let bytes = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else { files += 1; bytes += fs.statSync(p).size; }
  }
};
walk(DIST);
console.log(`[dist] ${GAME} → dist/：${files} 个文件，${(bytes / 1024 / 1024).toFixed(1)} MB（无外链）`);
