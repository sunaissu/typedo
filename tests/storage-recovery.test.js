import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyProgress, readProgress } from '../src/storage.js';

function storedValues(entries) {
  const values = new Map(entries);
  return { values, storage: { getItem: key => values.get(key) ?? null } };
}

test('corrupt saved JSON is retained for recovery and blocks automatic replacement', () => {
  const original = '{"version":1,"history":[{"id":"unfinished-json"}';
  const { values, storage } = storedValues([[STORAGE_KEY, original]]);
  const loaded = readProgress(storage);
  assert.deepEqual(loaded.progress, emptyProgress());
  assert.ok(loaded.warning);
  assert.equal(loaded.writeBlocked, true);
  assert.equal(loaded.recoveryRaw, original);
  assert.equal(values.get(STORAGE_KEY), original);
});

test('an unsupported saved version remains available as its exact original bytes', () => {
  const original = JSON.stringify({ ...emptyProgress(), version: 2, history: [{ id: 'recoverable-future-run' }] }, null, 2);
  const { values, storage } = storedValues([[STORAGE_KEY, original]]);
  const loaded = readProgress(storage);
  assert.deepEqual(loaded.progress, emptyProgress());
  assert.ok(loaded.warning);
  assert.equal(loaded.writeBlocked, true);
  assert.equal(loaded.recoveryRaw, original);
  assert.equal(values.get(STORAGE_KEY), original);
});

test('a failed storage read blocks writes without inventing recoverable data', () => {
  let calls = 0;
  const loaded = readProgress({ getItem() { calls++; throw new Error('Read denied'); } });
  assert.equal(calls, 1);
  assert.deepEqual(loaded.progress, emptyProgress());
  assert.ok(loaded.warning);
  assert.equal(loaded.writeBlocked, true);
  assert.equal(loaded.recoveryRaw, null);
});

test('a valid current or legacy save allows normal persistence without a recovery copy', () => {
  const progress = emptyProgress();
  progress.settings.goal = 10;
  for (const key of [STORAGE_KEY, 'keysteady:v1']) {
    const { storage } = storedValues([[key, JSON.stringify(progress)]]);
    const loaded = readProgress(storage);
    assert.deepEqual(loaded.progress, progress);
    assert.equal(loaded.warning, '');
    assert.equal(loaded.writeBlocked, false);
    assert.equal(loaded.recoveryRaw, null);
  }
});

test('a first visit starts normally when both storage keys are absent', () => {
  const loaded = readProgress(storedValues([]).storage);
  assert.deepEqual(loaded.progress, emptyProgress());
  assert.equal(loaded.warning, '');
  assert.equal(loaded.writeBlocked, false);
  assert.equal(loaded.recoveryRaw, null);
});
