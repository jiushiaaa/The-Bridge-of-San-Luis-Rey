// 零依赖静态服务器 + DEBUG-文案 编辑 API：
//   /ping                    -> ok
//   /api/health              -> {ok:true}（前端据此判断编辑器可用）
//   /api/data?game=xdd       -> GET 读 / POST 写 workspace/{作品}/final_game.json（写前备份，缩进保持）
//   /api/upload?game&path=   -> POST 二进制体，替换作品素材图片（旧图先备份）
//   /api/favicon?game=       -> POST 由 assets.sceneIcon 裁切重生 favicon.png
//   /api/validate?game=xdd   -> POST 运行 python tools/validate_data.py 并回传输出
//   /xdd-assets/*            -> ROOT/workspace/xidaduo/xdd-assets
//   其余                     -> ROOT/frontend/dist（SPA 回退 index.html）
// 游戏选择：http://localhost:6872/（默认悉达多）| ?game=bad|murder|weicheng
// 端口固定 6872，被占用时直接报错退出（不换端口）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const ASSETS_MAP = {
  '/slr-assets/': path.join(ROOT, 'workspace', 'sanluisrey', 'slr-assets'),
  '/xdd-assets/': path.join(ROOT, 'workspace', 'xidaduo', 'xdd-assets'),
  '/bad-assets/': path.join(ROOT, 'workspace', 'badblood', 'bad-assets'),
  '/murder-assets/': path.join(ROOT, 'workspace', 'murder', 'murder-assets'),
  '/wc-assets/': path.join(ROOT, 'workspace', 'WeiCheng_QianZhongShu', 'wc-assets'),
};
// 作品 id → workspace 目录（与 tools/validate_data.py 等的 GAMES 一致）
const GAMES = { slr: 'sanluisrey', xdd: 'xidaduo', bad: 'badblood', murder: 'murder', weicheng: 'WeiCheng_QianZhongShu' };
const PORT = 6872;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function sendFile(res, file) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
}

/** 防目录穿越：解析后的路径必须仍位于 base 内 */
function safeJoin(base, rel) {
  const p = path.resolve(base, rel);
  return p.startsWith(base) ? p : null;
}

// ---------- DEBUG-文案 编辑 API ----------

/** 读取请求体（默认上限 30MB） */
function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function stamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${p(d.getMilliseconds(), 3)}`;
}

/** 覆盖前备份到 workspace/{作品}/DEBUG/copyedit_backups/，同名文件只保留最近 KEEP 份 */
function backupFile(gameRoot, file) {
  if (!fs.existsSync(file)) return;
  const KEEP = 20;
  const bdir = path.join(gameRoot, 'DEBUG', 'copyedit_backups');
  fs.mkdirSync(bdir, { recursive: true });
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  fs.copyFileSync(file, path.join(bdir, `${base}_${stamp()}${ext}`));
  const olds = fs
    .readdirSync(bdir)
    .filter((f) => f.startsWith(base + '_') && f.endsWith(ext))
    .sort()
    .reverse();
  for (const f of olds.slice(KEEP)) fs.unlinkSync(path.join(bdir, f));
}

/** 跑一个仓库内的 python 脚本，回传退出码与合并输出（质检 / 重绘 / favicon 共用） */
function runPython(res, args, timeout) {
  return new Promise((resolve) => {
    execFile(
      'python',
      args,
      {
        cwd: ROOT,
        timeout,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      },
      (err, stdout, stderr) => {
        if (err && err.code === 'ENOENT') {
          sendJson(res, 200, { ok: false, code: -1, output: 'python 不可用（未找到 python 命令）' });
        } else {
          const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
          sendJson(res, 200, { ok: code === 0, code, output: String(stdout || '') + String(stderr || '') });
        }
        resolve();
      },
    );
  });
}

async function handleApi(req, res, url, query) {
  if (url === '/api/health') return sendJson(res, 200, { ok: true });

  const gameId = query.get('game') || '';
  if (!GAMES[gameId]) return sendJson(res, 400, { ok: false, error: `未知作品 "${gameId}"，可选：${Object.keys(GAMES).join(' | ')}` });
  const gameRoot = path.join(ROOT, 'workspace', GAMES[gameId]);
  const dataFile = path.join(gameRoot, 'final_game.json');

  // 读数据：非离线版启动时拉取，覆盖构建期内联数据（改文案不用重新 build）
  if (url === '/api/data' && req.method === 'GET') {
    if (!fs.existsSync(dataFile)) return sendJson(res, 404, { ok: false, error: 'final_game.json 不存在' });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(dataFile).pipe(res);
    return;
  }

  // 写数据：整包 JSON 回写（写前备份 + 缩进按原文件探测）
  if (url === '/api/data' && req.method === 'POST') {
    const buf = await readBody(req);
    let next;
    try {
      next = JSON.parse(buf.toString('utf8'));
    } catch {
      return sendJson(res, 400, { ok: false, error: 'JSON 解析失败' });
    }
    if (!next || !next.meta || next.meta.id !== gameId) {
      return sendJson(res, 400, { ok: false, error: `数据 meta.id 与 ?game=${gameId} 不匹配` });
    }
    const old = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8') : '';
    const indent = (old.match(/\n(\s+)"/) || [null, ' '])[1];
    backupFile(gameRoot, dataFile);
    fs.writeFileSync(dataFile, JSON.stringify(next, null, indent) + (old.endsWith('\n') ? '\n' : ''));
    return sendJson(res, 200, { ok: true });
  }

  // 换素材：POST 二进制体写入 path 指定的素材文件（限素材目录内的图片 / mp3 音频，旧文件先备份）
  if (url === '/api/upload' && req.method === 'POST') {
    const rel = (query.get('path') || '').replace(/^\/+/, '');
    const ext = path.extname(rel).toLowerCase();
    if (!rel || !['.jpg', '.jpeg', '.png', '.webp', '.mp3'].includes(ext)) {
      return sendJson(res, 400, { ok: false, error: '仅支持 jpg/png/webp 图片或 mp3 音频路径' });
    }
    if (!rel.includes('-assets/')) return sendJson(res, 400, { ok: false, error: '路径必须位于作品素材目录（*-assets/）内' });
    const file = safeJoin(gameRoot, rel);
    if (!file) return sendJson(res, 400, { ok: false, error: '非法路径' });
    const buf = await readBody(req);
    if (buf.length === 0) return sendJson(res, 400, { ok: false, error: '空文件' });
    backupFile(gameRoot, file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    return sendJson(res, 200, { ok: true, path: rel, size: buf.length });
  }

  // 生图 API 已关闭：DEBUG 改为复制 prompt，不再调用 Lumi
  if (url === '/api/regen-image') {
    return sendJson(res, 410, { ok: false, error: 'AI 重绘已关闭，请复制 prompt 后自行出图' });
  }

  // favicon：由 assets.sceneIcon 中心裁切 88% 缩 64×64（换过主题图标后点一下即可）
  if (url === '/api/favicon' && req.method === 'POST') {
    return runPython(res, ['tools/gen_scene_icons.py', gameId, '--favicon-only'], 60000);
  }

  // 质检：跑 tools/validate_data.py，回传退出码与输出（编辑器保存后自动调用）
  if (url === '/api/validate' && req.method === 'POST') {
    return runPython(res, ['tools/validate_data.py', gameId], 120000);
  }

  return sendJson(res, 404, { ok: false, error: '未知 API' });
}

// ---------- 静态服务 ----------

const server = http.createServer((req, res) => {
  const [rawPath, rawQuery] = (req.url || '/').split('?');
  const url = decodeURIComponent(rawPath);

  if (url === '/ping') return send(res, 200, 'ok');

  if (url.startsWith('/api/')) {
    handleApi(req, res, url, new URLSearchParams(rawQuery || '')).catch((e) => {
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
    });
    return;
  }

  const prefix = Object.keys(ASSETS_MAP).find((p) => url.startsWith(p));
  if (prefix) {
    const file = safeJoin(ASSETS_MAP[prefix], url.slice(prefix.length));
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file);
    return send(res, 404, 'not found');
  }

  // 前端静态资源
  let rel = url.replace(/^\/+/, '');
  let file = rel ? safeJoin(DIST, rel) : null;
  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file);

  // SPA 回退
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) return sendFile(res, index);
  return send(res, 503, 'frontend/dist 不存在，请先执行 npm run build');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 被占用，请先释放该端口后再启动。`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`情节卡解谜 已启动：http://localhost:${PORT}`);
  console.log(`  悉达多: http://localhost:${PORT}/?game=xdd`);
  console.log(`  坏血: http://localhost:${PORT}/?game=bad`);
  console.log(`  一桩事先张扬的凶杀案: http://localhost:${PORT}/?game=murder`);
  console.log(`  围城: http://localhost:${PORT}/?game=weicheng`);
});
