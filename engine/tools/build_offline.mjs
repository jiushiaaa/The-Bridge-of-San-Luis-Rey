// tools/build_offline.mjs — 导出离线单文件版：构建 → 内联 JS/CSS → workspace/{作品}/index.html
// 用法: node tools/build_offline.mjs [xdd|bad|murder|weicheng]（默认 xdd）
// 图片不内联，保持 assets 相对引用（离线 html 与素材目录同级，file:// 可直读）
// 注入 window.__GAME_ID，使离线文件无需 ?game= 参数即可选中对应作品
//
// ⚠️ 踩坑记录（务必留意，勿删本段）：
// 本脚本用 `VITE_ONLY_GAME=<作品>` 跑 `npm run build`，只把「当前作品」的数据内联进包，
// 其余作品被 Rollup 摇树移除（见 frontend/src/game/data.ts 的 REGISTRY）。
// 副作用：这会**覆盖 frontend/dist**，把它变成「只含单个作品」的产物。
// 而后端版（node backend/server.js :6872）与其 `?game=` 多作切换都依赖 dist 内联「全部作品」，
// 于是离线导出后直接访问 :6872/?game=xdd 会因 REGISTRY 里没有该作品而回退到那个单作，
// 表现为「选谁都进最后导出的那部作品」（历史事故：导完 bad 后，选 xdd 却进坏血）。
// 因此本脚本**结束时会自动跑一次不带 VITE_ONLY_GAME 的全量 build 恢复 dist**（见文件末尾），
// 保证后端/dev 版始终是全量。批量导出多作时也只在最后恢复一次即可（用 --no-restore 跳过）。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND = path.join(ROOT, 'frontend');
const DIST = path.join(FRONTEND, 'dist');

const GAMES = {
  xdd: path.join(ROOT, 'workspace', 'xidaduo', 'index.html'),
  bad: path.join(ROOT, 'workspace', 'badblood', 'index.html'),
  murder: path.join(ROOT, 'workspace', 'murder', 'index.html'),
  weicheng: path.join(ROOT, 'workspace', 'WeiCheng_QianZhongShu', 'index.html'),
};
const args = process.argv.slice(2);
const NO_RESTORE = args.includes('--no-restore'); // 批量导出时可跳过恢复，最后一次再恢复
const GAME = args.find((a) => !a.startsWith('--')) || 'xdd';
if (!GAMES[GAME]) {
  console.error(`未知游戏 "${GAME}"，可选：${Object.keys(GAMES).join(' | ')}`);
  process.exit(1);
}
const OUT = GAMES[GAME];

console.log('1/4 构建前端…（仅内联本作品数据 VITE_ONLY_GAME =', GAME, '）');
execSync('npm run build', {
  cwd: FRONTEND,
  stdio: 'inherit',
  env: { ...process.env, VITE_ONLY_GAME: GAME },
});

console.log('2/4 内联 JS/CSS…');
let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

// 内联 <script ... src="./app/xxx.js">
html = html.replace(/<script([^>]*?)src="(?:\.\/)?(app\/[^"]+\.js)"([^>]*)><\/script>/g,
  (m, pre, rel, post) => {
    const js = fs.readFileSync(path.join(DIST, rel), 'utf8');
    return `<script${pre}${post}>\n${js}\n</script>`;
  });

// 内联 <link rel="stylesheet" ... href="./app/xxx.css">
html = html.replace(/<link([^>]*?)rel="stylesheet"([^>]*?)href="(?:\.\/)?(app\/[^"]+\.css)"([^>]*?)>/g,
  (m, a, b, rel, c) => {
    const css = fs.readFileSync(path.join(DIST, rel), 'utf8');
    return `<style>\n${css}\n</style>`;
  });

// 内联 favicon 为 data URI，避免离线单文件遗留 ./app/*.ico 外链
html = html.replace(/<link([^>]*?)rel="icon"([^>]*?)href="(?:\.\/)?(app\/[^"]+)"([^>]*?)>/g,
  (m, a, b, rel, c) => {
    const buf = fs.readFileSync(path.join(DIST, rel));
    return `<link${a}rel="icon"${b}href="data:image/x-icon;base64,${buf.toString('base64')}"${c}>`;
  });

if (/src="(?:\.\/)?app\//.test(html) || /href="(?:\.\/)?app\//.test(html)) {
  console.error('警告：仍有未内联的 app/ 引用，请检查构建产物结构');
}

// 用作品正式名替换静态 <title>，避免 JS 执行前的标题闪烁
try {
  const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(OUT), 'final_game.json'), 'utf8')).meta;
  if (meta?.title) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${meta.title}</title>`);
} catch (e) {
  console.warn('读取 meta.title 失败，保留默认标题：', e.message);
}

console.log('3/4 注入游戏选择 __GAME_ID =', GAME);
if (/<head[^>]*>/i.test(html)) {
  html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<script>window.__GAME_ID=${JSON.stringify(GAME)};</script>`);
} else {
  html = `<script>window.__GAME_ID=${JSON.stringify(GAME)};</script>\n` + html;
}

console.log('4/4 写出', OUT);
fs.writeFileSync(OUT, html);

const appDir = path.join(DIST, 'app');
const destDir = path.dirname(OUT);
if (fs.existsSync(appDir)) {
  for (const f of fs.readdirSync(appDir)) {
    if (!f.endsWith('.woff2')) continue;
    fs.copyFileSync(path.join(appDir, f), path.join(destDir, f));
  }
}

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`离线版导出完成：${OUT}（${kb} KB）。双击即玩。`);

// 恢复 dist 为「全部作品」的全量产物：单作 VITE_ONLY_GAME 构建覆盖了 dist，
// 后端/dev 版依赖全量 dist 才能用 ?game= 多作切换（详见文件头「踩坑记录」）。
if (NO_RESTORE) {
  console.warn('⚠️ 已跳过 dist 恢复（--no-restore）：当前 dist 只含', GAME, '，后端/dev 多作切换会失效，请稍后手动全量 `npm run build`。');
} else {
  console.log('5/5 恢复 dist（全量 build，供后端/dev 多作切换）…');
  execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });
  console.log('dist 已恢复为全量（含全部作品）。');
}
