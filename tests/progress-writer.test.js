import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressWriter } from '../src/progressWriter.js';
import { createBrowserStorage } from '../src/browserStorage.js';
import { IDBFactory } from 'fake-indexeddb';
import { emptyProgress, readProgress, STORAGE_KEY } from '../src/storage.js';

function setup(context) {
  const indexedDB = new IDBFactory();
  const storage = createBrowserStorage({ getIndexedDB: () => indexedDB, getLegacyStorage: () => ({ length: 0 }) });
  context.after(() => storage.close());
  return storage;
}

test('two tabs cannot overwrite completed results, changed settings, or removed passages', async context => {
  const storage = setup(context);
  const initial = emptyProgress();
  initial.savedPassages = [{ id: 'passage', title: 'Example', text: 'One sentence.', updatedAt: '2026-10-20T00:00:00.000Z' }];
  const raw = JSON.stringify(initial);
  await storage.setItem(STORAGE_KEY, raw);
  const first = createProgressWriter(storage, STORAGE_KEY, raw);
  const second = createProgressWriter(storage, STORAGE_KEY, raw);
  const updated = { ...initial, settings: { ...initial.settings, theme: 'light' }, savedPassages: [], history: [{ id: 'new-completion' }] };
  assert.equal((await first.save(updated)).status, 'saved');
  assert.equal((await second.save({ ...initial, keyStats: { a: { attempts: 1, errors: 0 } } })).status, 'conflict');
  assert.deepEqual(JSON.parse(await storage.getItem(STORAGE_KEY)), updated);
  assert.equal((await second.save(initial)).status, 'conflict', 'A later autosave cannot erase the conflict');
  assert.deepEqual(JSON.parse(await storage.getItem(STORAGE_KEY)), updated);
});

test('concurrent first visits and separate profiles are handled independently', async context => {
  const storage = setup(context);
  const first = createProgressWriter(storage, STORAGE_KEY, null);
  const second = createProgressWriter(storage, STORAGE_KEY, null);
  const otherProfile = createProgressWriter(storage, 'another-profile', null);
  const results = await Promise.all([first.save({ value: 1 }), second.save({ value: 2 }), otherProfile.save({ value: 3 })]);
  assert.deepEqual(results.slice(0, 2).map(value => value.status).sort(), ['conflict', 'saved']);
  assert.equal(results[2].status, 'saved');
});

test('a burst of checkpoints writes the first and latest snapshot, resolving callers only after commit', async context => {
  const storage = setup(context);
  const compareAndSet = storage.compareAndSet.bind(storage);
  const releases = [];
  context.mock.method(storage, 'compareAndSet', (...args) => new Promise(resolve => {
    releases.push(async () => resolve(await compareAndSet(...args)));
  }));
  const writer = createProgressWriter(storage, STORAGE_KEY, null);
  let completed = 0;
  const saves = Array.from({ length: 30 }, (_, value) => writer.save({ value }).then(result => { completed++; return result; }));
  assert.equal(releases.length, 1);
  assert.equal(completed, 0);
  await releases[0]();
  await saves[0];
  assert.equal(completed, 1);
  assert.equal(releases.length, 2);
  await releases[1]();
  assert.ok((await Promise.all(saves)).every(result => result.status === 'saved'));
  assert.deepEqual(JSON.parse(await storage.getItem(STORAGE_KEY)), { value: 29 });
  assert.equal(releases.length, 2);
});

test('failed writes retain their expected version and retry the latest snapshot', async context => {
  const storage = setup(context);
  const compareAndSet = storage.compareAndSet.bind(storage);
  let fail = true;
  context.mock.method(storage, 'compareAndSet', (...args) => {
    if (fail) return Promise.reject(new Error('Quota exceeded'));
    return compareAndSet(...args);
  });
  const writer = createProgressWriter(storage, STORAGE_KEY, null);
  assert.equal((await writer.save({ value: 1 })).status, 'unavailable');
  assert.equal(await storage.getItem(STORAGE_KEY), null);
  fail = false;
  assert.equal((await writer.save({ value: 2 })).status, 'saved');
  assert.deepEqual(JSON.parse(await storage.getItem(STORAGE_KEY)), { value: 2 });
});

test('retrying after another tab saves becomes a conflict instead of overwriting newer work', async context => {
  const storage = setup(context);
  const writer = createProgressWriter(storage, STORAGE_KEY, null);
  const mock = context.mock.method(storage, 'compareAndSet', async () => { throw new Error('Denied'); });
  assert.equal((await writer.save({ mine: true })).status, 'unavailable');
  mock.mock.restore();
  await storage.setItem(STORAGE_KEY, JSON.stringify({ theirs: true }));
  assert.equal((await writer.save({ mine: true })).status, 'conflict');
  assert.deepEqual(JSON.parse(await storage.getItem(STORAGE_KEY)), { theirs: true });
});

test('legacy fallback and explicitly restored corrupt data use the active key as their baseline', async context => {
  const storage = setup(context);
  const progress = emptyProgress();
  await storage.setItem('keysteady:v1', JSON.stringify(progress));
  const legacy = await readProgress(storage);
  assert.equal(legacy.storedRaw, null);
  const writer = createProgressWriter(storage, STORAGE_KEY, legacy.storedRaw);
  assert.equal((await writer.save(legacy.progress)).status, 'saved');
  await storage.setItem(STORAGE_KEY, '{ corrupt');
  const corrupt = await readProgress(storage);
  assert.equal(corrupt.writeBlocked, true);
  assert.equal(corrupt.storedRaw, '{ corrupt');
  const recovered = createProgressWriter(storage, STORAGE_KEY, corrupt.storedRaw);
  assert.equal((await recovered.save(progress)).status, 'saved');
});
