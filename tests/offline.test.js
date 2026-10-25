import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { OFFLINE_CACHE_PREFIX, createWorkerSource, offlineAssetList } from '../offlineBuild.js';
import { appWorker, removeOfflineDownload, workerMessage } from '../src/offline.js';

function workerFixture({ version = 'test-build', failInstall = false, windows = ['https://typedo.test/'] } = {}) {
  const assets = ['/index.html', '/assets/app-abc.js', '/assets/app-def.css', '/manifest.webmanifest', '/app-icon.svg'];
  const listeners = {};
  const cacheData = new Map();
  const requests = [];
  let activations = 0;
  let network = 0;
  const cacheStorage = {
    async open(name) {
      if (!cacheData.has(name)) cacheData.set(name, new Map());
      const data = cacheData.get(name);
      return {
        async addAll(items) {
          requests.push(...items);
          if (failInstall) throw new Error('Connection interrupted');
          for (const request of items) data.set(request.url, { cached: request.url });
        },
        async match(key) { return data.get(typeof key === 'string' ? key : key.url); },
      };
    },
    async keys() { return [...cacheData.keys()]; },
    async delete(key) { return cacheData.delete(key); },
  };
  const self = {
    location: { origin: 'https://typedo.test' },
    clients: { async matchAll() { return windows.map(url => ({ url })); } },
    async skipWaiting() { activations++; },
    addEventListener(name, listener) { listeners[name] = listener; },
  };
  vm.runInNewContext(createWorkerSource({ assets, version }), { self, caches: cacheStorage, Request, URL, Promise, Set, fetch: async request => { network++; return { network: request.url }; } });
  async function emit(name, extra = {}) {
    let task;
    let response;
    const replies = [];
    listeners[name]({ ...extra, waitUntil(value) { task = value; }, respondWith(value) { response = value; }, ports: [{ postMessage(value) { replies.push(value); } }] });
    await task;
    return { response: await response, replies };
  }
  return { assets, emit, cacheData, cacheStorage, requests, get activations() { return activations; }, get network() { return network; } };
}

test('precache lists only local built files, excludes source maps, and respects deployment base', () => {
  const files = offlineAssetList({ 'assets/app-123.js': {}, 'assets/app-456.css': {}, 'assets/app-123.js.map': {}, 'index.html': {} }, '/typing/');
  assert.deepEqual(files, ['/typing/app-icon.svg', '/typing/assets/app-123.js', '/typing/assets/app-456.css', '/typing/favicon.svg', '/typing/index.html', '/typing/manifest.webmanifest']);
  assert.equal(new Set(files).size, files.length);
  assert.ok(files.every(file => !file.includes('http') && !file.endsWith('.map')));
});

test('installation downloads public files without credentials and waits for deliberate update activation', async () => {
  const fixture = workerFixture();
  await fixture.emit('install');
  assert.equal(fixture.requests.length, fixture.assets.length);
  assert.ok(fixture.requests.every(request => request.credentials === 'omit' && request.cache === 'reload'));
  await fixture.emit('activate');
  assert.equal(fixture.activations, 0, 'Installation and activation never skip a waiting update automatically');
  const result = await fixture.emit('message', { data: { type: 'OFFLINE_STATUS' } });
  assert.equal(result.replies[0].ready, true);
  fixture.cacheData.get(`${OFFLINE_CACHE_PREFIX}test-build`).delete('https://typedo.test/assets/app-abc.js');
  const incomplete = await fixture.emit('message', { data: { type: 'OFFLINE_STATUS' } });
  assert.equal(incomplete.replies[0].ready, false, 'An evicted or incomplete cache is never advertised as ready');
});

test('a failed download rejects installation and removes its incomplete cache', async () => {
  const fixture = workerFixture({ failInstall: true });
  await assert.rejects(fixture.emit('install'), /Connection interrupted/);
  assert.equal(fixture.cacheData.size, 0);
});

test('updates refuse to replace another open tab and activate after an explicit request in a single tab', async () => {
  const several = workerFixture({ windows: ['https://typedo.test/', 'https://typedo.test/'] });
  const blocked = await several.emit('message', { data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(blocked.replies[0].reason, 'other-tabs');
  assert.equal(several.activations, 0);
  const one = workerFixture();
  const applied = await one.emit('message', { data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(applied.replies[0].activated, true);
  assert.equal(one.activations, 1);
});

test('offline navigation and hashed assets use cache; external fonts, backend paths and writes bypass it', async () => {
  const fixture = workerFixture();
  await fixture.emit('install');
  const navigate = { url: 'https://typedo.test/?from=home', method: 'GET', mode: 'navigate', headers: new Headers() };
  const result = await fixture.emit('fetch', { request: navigate });
  assert.equal(result.response.cached, 'https://typedo.test/index.html');
  assert.equal(fixture.network, 0);
  const old = await fixture.cacheStorage.open(`${OFFLINE_CACHE_PREFIX}previous`);
  await old.addAll([new Request('https://typedo.test/assets/old-chunk.js')]);
  const older = await fixture.emit('fetch', { request: new Request('https://typedo.test/assets/old-chunk.js') });
  assert.equal(older.response.cached, 'https://typedo.test/assets/old-chunk.js', 'An older open tab keeps its own chunks');
  for (const request of [new Request('https://fonts.example/font.woff2'), new Request('https://typedo.test/api/profile'), new Request('https://typedo.test/', { method: 'POST' }), new Request('https://typedo.test/assets/app-abc.js', { headers: { authorization: 'Bearer private' } })]) {
    assert.equal((await fixture.emit('fetch', { request })).response, undefined);
  }
});

test('offline removal unregisters only its registration and deletes only Typedo app-file caches', async () => {
  let unregistered = 0;
  const deleted = [];
  await removeOfflineDownload({ async unregister() { unregistered++; } }, {
    async keys() { return [`${OFFLINE_CACHE_PREFIX}old`, 'another-app', `${OFFLINE_CACHE_PREFIX}current`]; },
    async delete(key) { deleted.push(key); },
  });
  assert.equal(unregistered, 1);
  assert.deepEqual(deleted, [`${OFFLINE_CACHE_PREFIX}old`, `${OFFLINE_CACHE_PREFIX}current`]);
  assert.equal(appWorker({ active: { scriptURL: 'https://typedo.test/sw.js' } }, 'https://typedo.test/sw.js'), true);
  assert.equal(appWorker({ active: { scriptURL: 'https://typedo.test/other.js' } }, 'https://typedo.test/sw.js'), false);
});

test('worker requests resolve replies and time out instead of hanging forever', async () => {
  const result = await workerMessage({ postMessage(_message, ports) { ports[0].postMessage({ ready: true }); ports[0].close(); } }, { type: 'OFFLINE_STATUS' });
  assert.equal(result.ready, true);
  await assert.rejects(workerMessage({ postMessage(_message, ports) { ports[0].close(); } }, { type: 'OFFLINE_STATUS' }, 5), /did not respond/);
});

test('installation manifest uses relative app URLs and an available scalable icon', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.icons[0].sizes, 'any');
  const icon = await readFile(new URL(`../public/${manifest.icons[0].src}`, import.meta.url), 'utf8');
  assert.match(icon, /viewBox="0 0 512 512"/);
});
