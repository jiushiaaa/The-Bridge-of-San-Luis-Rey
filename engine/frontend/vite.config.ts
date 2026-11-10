import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 美术资源目录：开发时通过中间件把 /{前缀}-assets/* 映射到各作品目录
const ASSETS_MAP: Record<string, string> = {
  '/slr-assets/': path.resolve(HERE, '../workspace/sanluisrey/slr-assets'),
  '/xdd-assets/': path.resolve(HERE, '../workspace/xidaduo/xdd-assets'),
  '/bad-assets/': path.resolve(HERE, '../workspace/badblood/bad-assets'),
  '/murder-assets/': path.resolve(HERE, '../workspace/murder/murder-assets'),
  '/wc-assets/': path.resolve(HERE, '../workspace/WeiCheng_QianZhongShu/wc-assets'),
};

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
};

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'app',
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: ['..'] },
    // DEBUG-文案 编辑 API 只在 backend/server.js(6872) 实现一份，dev 模式代理过去。
    // 后端未启动时不能回 500（浏览器控制台会记资源加载错误，污染「启动零报错」冒烟测试）：
    // 改回 200 + {ok:false}，前端 initCopyedit 按 meta 校验判定不可用并静默隐藏全部编辑按钮
    proxy: {
      '/api': {
        target: 'http://localhost:6872',
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            const r = res as import('node:http').ServerResponse;
            if (r && typeof r.writeHead === 'function' && !r.headersSent) {
              r.writeHead(200, { 'Content-Type': 'application/json' });
              r.end('{"ok":false,"error":"backend offline"}');
            }
          });
        },
      },
    },
    // 编辑器保存会写回 final_game.json：忽略其变更，避免每次保存触发整页刷新毁掉编辑弹窗
    // （数据新鲜度由启动时 GET /api/data 拉取保证，见 src/game/copyedit.ts；手工外部改文件后需自行刷新）
    // 编辑器保存会写回各作简体 final_game.json：忽略其变更，避免每次保存整页刷新。
    // 不要用 **/final_game.json，否则 i18n/{de,en,ja,zh-TW}/ 语言包改了也不会热更新。
    watch: { ignored: ['**/workspace/*/final_game.json'] },
  },
  plugins: [
    react(),
    {
      name: 'game-assets-dev',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = (req.url || '').split('?')[0];
          const prefix = Object.keys(ASSETS_MAP).find((p) => url.startsWith(p));
          if (!prefix) return next();
          const base = ASSETS_MAP[prefix];
          const rel = decodeURIComponent(url.slice(prefix.length));
          const file = path.resolve(base, rel);
          if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.statusCode = 404;
            res.end('not found');
            return;
          }
          res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
          fs.createReadStream(file).pipe(res);
        });
      },
    },
  ],
});
