import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, SITE_ORIGIN: process.env.SITE_ORIGIN || 'https://typedo.sunaissu.com' };
for (const args of [['node_modules/vite/bin/vite.js', 'build'], ['discovery/build.mjs'], ['scripts/check-release.mjs']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
