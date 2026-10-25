import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PROFILES, PROFILE_METADATA_KEY, addProfile, defaultProfiles, profileName, profileStorageKey, readProfiles, renameProfile, validateProfiles, writeProfiles } from '../src/profiles.js';
import { emptyProgress, readProgress, writeProgress } from '../src/storage.js';

const id = 'a7a7a7a7-1234-4234-8234-a7a7a7a7a7a7';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); } };
}

test('the original profile retains the existing browser key and each named profile has its own namespace', () => {
  assert.equal(profileStorageKey('default'), 'typedo:v1');
  assert.equal(profileStorageKey(id), `typedo:profile:${id}:v1`);
  for (const invalid of ['__proto__', 'default:v2', '../default', '', 3, null]) assert.throws(() => profileStorageKey(invalid));
  const fresh = readProfiles(memoryStorage());
  assert.deepEqual(fresh.data, defaultProfiles());
  assert.equal(fresh.raw, null);
  assert.equal(fresh.writable, true);
});

test('profile names are understandable, bounded and distinct while Unicode names are supported', () => {
  assert.equal(profileName('  Alex   Santos  '), 'Alex Santos');
  assert.equal(profileName('María'), 'María');
  for (const name of ['', '   ', 'x'.repeat(33), 'bad\nname', 3]) assert.throws(() => profileName(name));
  const created = addProfile(defaultProfiles(), 'Alex', () => id);
  assert.equal(created.activeId, id);
  assert.equal(created.profiles.length, 2);
  assert.equal(renameProfile(created, id, 'Sam').profiles[1].name, 'Sam');
  assert.throws(() => renameProfile(created, id, 'ORIGINAL PROFILE'), /distinct/);
  assert.throws(() => addProfile(created, 'Alex', () => 'bbbbbbbb-1234-4234-8234-bbbbbbbbbbbb'), /distinct/);
});

test('profile list validation rejects invalid identities, unsupported formats and excess profiles', () => {
  const valid = addProfile(defaultProfiles(), 'Alex', () => id);
  assert.deepEqual(validateProfiles(JSON.parse(JSON.stringify(valid))), valid);
  for (const invalid of [null, [], {}, { ...valid, version: 2 }, { ...valid, activeId: 'missing' }, { ...valid, profiles: [{ id, name: 'No original profile' }] }, { ...valid, profiles: [...valid.profiles, valid.profiles[0]] }]) assert.throws(() => validateProfiles(invalid));
  let full = defaultProfiles();
  for (let index = 1; index < MAX_PROFILES; index++) full = addProfile(full, `Learner ${index}`, () => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  assert.equal(full.profiles.length, 8);
  assert.throws(() => addProfile(full, 'One too many'), /up to 8/);
});

test('corrupt or unsupported metadata is preserved and cannot silently replace profile history', () => {
  for (const raw of ['{ broken', JSON.stringify({ version: 2, profiles: [] }), JSON.stringify({ version: 1, activeId: '__proto__', profiles: [] })]) {
    const storage = memoryStorage({ [PROFILE_METADATA_KEY]: raw, 'typedo:v1': 'original practice' });
    const result = readProfiles(storage);
    assert.equal(result.writable, false);
    assert.equal(result.raw, raw);
    assert.match(result.error, /has not been replaced/);
    assert.equal(storage.getItem(PROFILE_METADATA_KEY), raw);
    assert.equal(storage.getItem('typedo:v1'), 'original practice');
  }
  assert.equal(readProfiles({ getItem() { throw new Error('Blocked'); } }).writable, false);
});

test('saving profile metadata detects concurrent tabs and reports blocked writes without switching', () => {
  const storage = memoryStorage();
  const first = readProfiles(storage);
  const created = addProfile(first.data, 'Alex', () => id);
  const saved = writeProfiles(created, first.raw, storage);
  assert.equal(saved.ok, true);
  const staleWrite = writeProfiles(renameProfile(first.data, 'default', 'Another name'), first.raw, storage);
  assert.equal(staleWrite.ok, false);
  assert.equal(staleWrite.conflict, true);
  assert.equal(readProfiles(storage).data.profiles[1].name, 'Alex');
  const denied = writeProfiles(created, null, { getItem() { return null; }, setItem() { throw new Error('Full'); } });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /current profile is still open/);
});

test('profile progress is isolated and a new profile cannot inherit legacy guest history', () => {
  const original = emptyProgress();
  original.settings.customText = 'Original passage';
  const oldLegacy = emptyProgress();
  oldLegacy.settings.customText = 'Legacy passage';
  const storage = memoryStorage({ 'typedo:v1': JSON.stringify(original), 'keysteady:v1': JSON.stringify(oldLegacy) });
  const originalRead = readProgress(storage, profileStorageKey('default'));
  const newRead = readProgress(storage, profileStorageKey(id));
  assert.equal(originalRead.progress.settings.customText, 'Original passage');
  assert.notEqual(newRead.progress.settings.customText, 'Legacy passage');
  assert.notEqual(newRead.progress.settings.customText, 'Original passage');
  const personal = emptyProgress();
  personal.settings.customText = 'Alex passage';
  assert.equal(writeProgress(storage, personal, profileStorageKey(id)), '');
  assert.equal(readProgress(storage, profileStorageKey(id)).progress.settings.customText, 'Alex passage');
  assert.equal(readProgress(storage, profileStorageKey('default')).progress.settings.customText, 'Original passage');
});
