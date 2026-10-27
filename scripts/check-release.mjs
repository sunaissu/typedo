import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const origin = process.env.SITE_ORIGIN || 'https://typedo.sunaissu.com';
const read = file => readFileSync(resolve(dist, file), 'utf8');
const walk = dir => readdirSync(dir).flatMap(name => {
  const file = resolve(dir, name);
  return statSync(file).isDirectory() ? walk(file) : [file];
});
for (const route of ['/', '/guide.html', '/privacy.html', '/support.html', '/about.html']) {
  const html = read(route === '/' ? 'index.html' : route.slice(1));
  assert.ok(html.includes(`href="${origin}${route}"`), `Wrong or missing canonical: ${route}`);
  assert.ok(html.includes('content="index,follow"'), `Page remains noindex: ${route}`);
  assert.ok(read('sitemap.xml').includes(`<loc>${origin}${route}</loc>`), `Missing sitemap route: ${route}`);
}
assert.ok(read('robots.txt').includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(read('index.html').includes('"name":"Sunaissu"'), 'Publisher must use Sunaissu.');
assert.ok(read('support.html').includes('https://github.com/sunaissu/typedo/issues'), 'Missing working support destination.');
assert.ok(existsSync(resolve(dist, '404.html')), 'Missing static 404 page.');
const headers = read('_headers');
assert.ok(headers.includes('Content-Security-Policy:'));
assert.match(headers, /\/sw\.js\r?\n\s+Cache-Control: no-cache/);
const worker = read('sw.js');
const assets = JSON.parse(worker.match(/const ASSETS = (\[[^\n]+\]);/)[1]);
assert.ok(assets.some(asset => asset.endsWith('.woff2')), 'Offline setup must include fonts.');
for (const asset of assets) assert.ok(existsSync(resolve(dist, asset.replace(/^\//, ''))), `Missing offline asset: ${asset}`);
for (const file of walk(dist)) {
  assert.ok(!/\.(map|env)$/.test(file) && !/(?:^|[\\/])\.env(?:\.|$)/.test(file), `Unexpected private artifact: ${file}`);
  if (/\.(html|css|js|txt|json)$/.test(file)) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/bg-labs\.com|Made with bg_|Typedo\/BG/.test(text), `Old branding in ${file}`);
    if (!file.endsWith('SOURCES.txt')) assert.ok(!/https:\/\/fonts\.(?:googleapis|gstatic)\.com/.test(text), `Remote font dependency in ${file}`);
  }
}
console.log(`Release files verified for ${origin}: metadata, support, privacy, headers, offline assets, and local fonts.`);
