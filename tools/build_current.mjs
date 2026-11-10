// Root commands always build the inherited full Siddhartha engine.
// The former independent game/ is retained for history, never used here.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.join(root, 'engine');
for (const script of ['build_offline.mjs', 'build_dist.mjs']) {
  const result = spawnSync(process.execPath, [path.join(engine, 'tools', script), 'slr'], {
    cwd: engine,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const candidate = path.join(root, '.build-current');
fs.rmSync(candidate, { recursive: true, force: true });
fs.cpSync(path.join(engine, 'dist'), candidate, { recursive: true });
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.renameSync(candidate, path.join(root, 'dist'));
console.log('[current] Full Siddhartha engine → root dist/');
