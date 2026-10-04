// Zips dist/ into dotdodge.zip for upload to itch.io as an HTML5 game (index.html at the zip root).
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'dotdodge.zip');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.');
  process.exit(1);
}
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`Wrote ${out}`);
