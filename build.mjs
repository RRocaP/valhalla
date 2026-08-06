// OATHWOOD build: scan locks -> gen registry -> gen treasure -> esbuild ->
// inline into index.src.html -> single index.html at repo root.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LOCK_RE = /^(\d{2})-[a-z0-9-]+\.js$/;

// 1. registry
const lockFiles = readdirSync(join(ROOT, 'src/locks'))
  .filter((f) => LOCK_RE.test(f))
  .sort();
const registry =
  lockFiles.map((f, i) => `import L${i} from '../locks/${f}';`).join('\n') +
  `\nexport const LOCKS = [${lockFiles.map((_, i) => `L${i}`).join(', ')}];\n`;
writeFileSync(join(ROOT, 'src/kernel/registry.gen.js'), registry);

// 2. treasure
const candidates = ['tebi.jpg', 'tebi.jpeg', 'tebi.png', 'tebi.webp'];
let treasure = '';
for (const c of candidates) {
  const p = join(ROOT, 'assets', c);
  if (existsSync(p)) {
    const mime = c.endsWith('.png') ? 'image/png' : c.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    treasure = `data:${mime};base64,${readFileSync(p).toString('base64')}`;
    console.log(`treasure: assets/${c} inlined (${statSync(p).size} bytes)`);
    break;
  }
}
if (!treasure) console.log('treasure: assets/tebi.* not found — placeholder finale');
writeFileSync(
  join(ROOT, 'src/kernel/treasure.gen.js'),
  `export default ${JSON.stringify(treasure)};\n`
);

// 3. bundle
const result = await build({
  entryPoints: [join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  legalComments: 'none',
  write: false,
  target: ['es2020', 'safari15'],
});
const js = result.outputFiles[0].text;

// 4. inline
const template = readFileSync(join(ROOT, 'index.src.html'), 'utf8');
if (!template.includes('<!--APP-->')) throw new Error('index.src.html missing <!--APP--> slot');
const html = template.replace('<!--APP-->', () => `<script>${js}</script>`);
writeFileSync(join(ROOT, 'index.html'), html);

// 5. report + guards
const bytes = Buffer.byteLength(html);
const mb = (bytes / 1048576).toFixed(2);
console.log(`index.html: ${bytes} bytes (${mb} MB), ${lockFiles.length} locks bundled`);
const external = js.replace(/data:[^"'` )]+/g, '').match(/https?:\/\//g);
if (external) {
  console.error(`FAIL: ${external.length} external URL(s) in bundle`);
  process.exit(1);
}
if (bytes > 2 * 1048576) {
  console.error('FAIL: bundle exceeds 2.0 MB budget');
  process.exit(1);
}
if (bytes > 1.5 * 1048576) console.warn('WARN: bundle over 1.5 MB — trim before ship');
