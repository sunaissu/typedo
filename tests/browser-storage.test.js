import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createBrowserStorage, DATABASE_NAME, RECORDS_STORE } from '../src/browserStorage.js';
import { emptyProgress, readProgress, writeProgress, STORAGE_KEY } from '../src/storage.js';
import { addProfile, defaultProfiles, profileStorageKey, PROFILE_METADATA_KEY, readProfiles, writeProfiles } from '../src/profiles.js';

const id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
function legacyStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { values, get length() { return values.size; }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null };
}
function setup(context, entries) {
  const legacy = legacyStorage(entries);
  const indexedDB = new IDBFactory();
  const options = { getIndexedDB: () => indexedDB, getLegacyStorage: () => legacy };
  const storage = createBrowserStorage(options);
  context.after(() => storage.close());
  return { storage, legacy, indexedDB, options };
}
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test('first use copies every profile and legacy record, preserving raw originals and unrelated local data', async context => {
  const progress = emptyProgress();
  progress.settings.goal = 10;
  const profiles = addProfile(defaultProfiles(), 'Alex', () => id);
  const entries = {
    [STORAGE_KEY]: JSON.stringify(progress),
    [profileStorageKey(id)]: JSON.stringify(emptyProgress()),
    [PROFILE_METADATA_KEY]: JSON.stringify(profiles),
    'keysteady:v1': '{ damaged legacy save',
    'another-app': 'leave this alone',
  };
  const { storage, legacy } = setup(context, entries);
  assert.deepEqual((await readProfiles(storage)).data, profiles);
  assert.equal((await readProgress(storage)).progress.settings.goal, 10);
  for (const [key, value] of Object.entries(entries)) {
    assert.equal(await storage.getItem(key), key === 'another-app' ? null : value);
    assert.equal(legacy.getItem(key), value);
  }
});

test('migration runs once and new sessions use IndexedDB even if localStorage later becomes inaccessible', async context => {
  const { storage, options, legacy } = setup(context, { [STORAGE_KEY]: JSON.stringify(emptyProgress()) });
  await storage.getItem(STORAGE_KEY);
  const progress = emptyProgress();
  progress.settings.goal = 3;
  await writeProgress(storage, progress);
  await storage.close();
  legacy.values.set(STORAGE_KEY, '{ stale broken copy');
  const next = createBrowserStorage({ ...options, getLegacyStorage() { throw new Error('Denied'); } });
  context.after(() => next.close());
  assert.equal((await readProgress(next)).progress.settings.goal, 3);
  assert.equal(await writeProgress(next, progress), '');
});

test('a legacy-only guest save is restored without leaking into a new profile', async context => {
  const progress = emptyProgress();
  progress.settings.goal = 10;
  const { storage } = setup(context, { 'keysteady:v1': JSON.stringify(progress) });
  assert.equal((await readProgress(storage)).progress.settings.goal, 10);
  assert.equal((await readProgress(storage, profileStorageKey(id))).progress.settings.goal, 5);
});

test('damaged and unsupported records migrate byte-for-byte and keep automatic saving blocked', async context => {
  for (const raw of ['', '{ broken', JSON.stringify({ ...emptyProgress(), version: 99 })]) {
    const { storage, legacy } = setup(context, { [STORAGE_KEY]: raw, [PROFILE_METADATA_KEY]: raw });
    const result = await readProgress(storage);
    assert.equal(result.writeBlocked, true);
    assert.equal(result.recoveryRaw, raw);
    assert.equal((await readProfiles(storage)).writable, false);
    assert.equal(await storage.getItem(STORAGE_KEY), raw);
    assert.equal(legacy.getItem(STORAGE_KEY), raw);
  }
});

test('an aborted migration commits neither copied data nor its marker, and retries without losing originals', async context => {
  const raw = JSON.stringify(emptyProgress());
  const { storage, indexedDB, legacy } = setup(context, { [STORAGE_KEY]: raw, [PROFILE_METADATA_KEY]: JSON.stringify(defaultProfiles()) });
  const originalPut = IDBObjectStore.prototype.put;
  const mock = context.mock.method(IDBObjectStore.prototype, 'put', function (value, key) {
    const request = originalPut.call(this, value, key);
    if (key === STORAGE_KEY) request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
  assert.equal((await readProgress(storage)).writeBlocked, true);
  const db = await requestResult(indexedDB.open(DATABASE_NAME));
  assert.equal(await requestResult(db.transaction(RECORDS_STORE).objectStore(RECORDS_STORE).get(STORAGE_KEY)), undefined);
  assert.equal(await requestResult(db.transaction('migrations').objectStore('migrations').get('localStorage:v1')), undefined);
  db.close();
  assert.equal(legacy.getItem(STORAGE_KEY), raw);
  mock.mock.restore();
  assert.equal((await readProgress(storage)).writeBlocked, false);
  assert.equal(await storage.getItem(STORAGE_KEY), raw);
});

test('failed legacy reads protect existing data and remain retryable', async context => {
  const { options, legacy } = setup(context, { [STORAGE_KEY]: JSON.stringify(emptyProgress()) });
  let denied = true;
  const storage = createBrowserStorage({ ...options, getLegacyStorage() {
    if (denied) throw new Error('Denied');
    return legacy;
  } });
  context.after(() => storage.close());
  assert.equal((await readProgress(storage)).writeBlocked, true);
  assert.ok(await writeProgress(storage, emptyProgress()));
  denied = false;
  assert.equal((await readProgress(storage)).writeBlocked, false);
});

test('unavailable IndexedDB returns recovery state rather than saving back to localStorage', async context => {
  const { options, legacy } = setup(context, { [STORAGE_KEY]: 'original' });
  const storage = createBrowserStorage({ ...options, getIndexedDB: () => undefined });
  assert.equal((await readProgress(storage)).writeBlocked, true);
  assert.equal((await readProfiles(storage)).writable, false);
  assert.ok(await writeProgress(storage, emptyProgress()));
  assert.equal(legacy.getItem(STORAGE_KEY), 'original');
});

test('save reports failure when its request succeeds but the transaction later aborts', async context => {
  const { storage } = setup(context);
  await storage.setItem(STORAGE_KEY, 'original');
  const originalPut = IDBObjectStore.prototype.put;
  context.mock.method(IDBObjectStore.prototype, 'put', function (value, key) {
    const request = originalPut.call(this, value, key);
    request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
  assert.ok(await writeProgress(storage, emptyProgress()));
  assert.equal(await storage.getItem(STORAGE_KEY), 'original');
});

test('rapid checkpoints retain the latest write after closing and reopening', async context => {
  const { storage } = setup(context);
  await Promise.all(Array.from({ length: 30 }, (_, index) => storage.setItem(STORAGE_KEY, String(index))));
  await storage.close();
  assert.equal(await storage.getItem(STORAGE_KEY), '29');
});

test('concurrent clients migrate once and profile updates compare and write in one transaction', async context => {
  const { storage, options } = setup(context, { [STORAGE_KEY]: 'original' });
  const other = createBrowserStorage(options);
  context.after(() => other.close());
  await Promise.all([storage.getItem(STORAGE_KEY), other.getItem(STORAGE_KEY)]);
  const results = await Promise.all([
    writeProfiles(addProfile(defaultProfiles(), 'Alex', () => id), null, storage),
    writeProfiles(defaultProfiles(), null, other),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.conflict).length, 1);
  assert.equal(await storage.getItem(STORAGE_KEY), 'original');
});

test('profile creation refuses an orphaned history without replacing the profile list', async context => {
  const { storage } = setup(context, { [profileStorageKey(id)]: 'orphaned progress' });
  const result = await writeProfiles(addProfile(defaultProfiles(), 'Alex', () => id), null, storage, { absentKey: profileStorageKey(id) });
  assert.equal(result.ok, false);
  assert.equal(result.conflict, false);
  assert.equal(await storage.getItem(PROFILE_METADATA_KEY), null);
  assert.equal(await storage.getItem(profileStorageKey(id)), 'orphaned progress');
});

test('an upgrade closes the old connection and unsupported newer schemas fail safely', async context => {
  const { storage, indexedDB } = setup(context);
  await storage.setItem(STORAGE_KEY, 'original');
  const upgraded = await requestResult(indexedDB.open(DATABASE_NAME, 2));
  upgraded.close();
  assert.equal((await readProgress(storage)).writeBlocked, true);
  assert.ok(await writeProgress(storage, emptyProgress()));
  const current = await requestResult(indexedDB.open(DATABASE_NAME, 2));
  assert.equal(await requestResult(current.transaction(RECORDS_STORE).objectStore(RECORDS_STORE).get(STORAGE_KEY)), 'original');
  current.close();
});
