import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, enterKey, generateText, keyGuide, metrics, tick, weakKeys } from '../src/typing.js';
import { DEFAULT_SETTINGS, emptyProgress, readProgress, validateProgress, writeProgress } from '../src/storage.js';

test('Typedo loads legacy progress and saves under its new name', () => {
  const legacy = emptyProgress();
  legacy.settings.goal = 10;
  const data = new Map([['keysteady:v1', JSON.stringify(legacy)]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const loaded = readProgress(storage);
  assert.equal(loaded.warning, '');
  assert.equal(loaded.progress.settings.goal, 10);
  assert.equal(writeProgress(storage, loaded.progress), '');
  assert.equal(JSON.parse(data.get('typedo:v1')).settings.goal, 10);
  const current = emptyProgress();
  current.settings.goal = 3;
  writeProgress(storage, current);
  assert.equal(readProgress(storage).progress.settings.goal, 3);
  assert.ok(data.has('keysteady:v1'));
});

test('WPM uses correct characters and five-character words', () => {
  const session = { ...createSession('a'.repeat(150)), typed: 'a'.repeat(150), attempts: 160, correctAttempts: 150, elapsed: 30000 };
  assert.equal(metrics(session).wpm, 60);
  assert.equal(metrics(session).accuracy, 93.8);
  assert.equal(metrics(session).raw, 64);
});

test('backspace corrections do not erase accuracy mistakes', () => {
  const config = { ...DEFAULT_SETTINGS, mode: 'words' };
  let session = createSession('ab');
  session = enterKey(session, 'x', config, 100);
  session = enterKey(session, 'Backspace', config, 200);
  session = enterKey(session, 'a', config, 300);
  session = enterKey(session, 'b', config, 400);
  assert.equal(session.status, 'finished');
  assert.equal(metrics(session).accuracy, 66.7);
  assert.equal(metrics(session).errors, 1);
  assert.equal(session.keyStats.a.attempts, 2);
});

test('strict practice waits on the same character after a mistake', () => {
  const config = { ...DEFAULT_SETTINGS, mode: 'practice', strict: true };
  let session = enterKey(createSession('ab'), 'x', config, 1000);
  assert.equal(session.typed, '');
  assert.equal(session.lastWrong, 'a');
  session = enterKey(session, 'a', config, 1200);
  assert.equal(session.typed, 'a');
  assert.equal(metrics(session).accuracy, 50);
});

test('empty backspace and modifier keys do not start timing', () => {
  for (const key of ['Backspace', 'Shift', 'Enter', 'Tab', 'ArrowLeft']) {
    const session = enterKey(createSession('abc'), key, DEFAULT_SETTINGS, 100);
    assert.equal(session.status, 'ready');
    assert.equal(session.startedAt, null);
  }
});

test('deadline is checked before accepting input and clamps delayed ticks', () => {
  const config = { ...DEFAULT_SETTINGS, duration: 15 };
  let session = enterKey(createSession('abcdef'), 'a', config, 1000);
  session = enterKey(session, 'b', config, 16000);
  assert.equal(session.typed, 'a');
  assert.equal(session.status, 'finished');
  assert.equal(session.elapsed, 15000);
  assert.equal(tick(session, config, 99000), session);
});

test('fast typists get more text without ending a timed test early', () => {
  const config = { ...DEFAULT_SETTINGS, duration: 120 };
  let session = createSession('abc');
  session = enterKey(session, 'a', config, 1000);
  session = enterKey(session, 'b', config, 1100);
  session = enterKey(session, 'c', config, 1200);
  assert.equal(session.status, 'running');
  assert.ok(session.text.length > 100);
  assert.equal(session.text.slice(0, 4), 'abc ');
  assert.equal(tick(session, config, 121000).status, 'finished');
});

test('finished sessions reject extra input', () => {
  const config = { ...DEFAULT_SETTINGS, mode: 'custom' };
  const finished = enterKey(createSession('a'), 'a', config, 100);
  assert.equal(finished.status, 'finished');
  assert.equal(enterKey(finished, 'b', config, 200), finished);
});

test('word counts, custom text and empty weak-key lessons stay usable', () => {
  assert.equal(generateText({ ...DEFAULT_SETTINGS, mode: 'words', wordCount: 10 }).split(' ').length, 10);
  assert.equal(generateText({ ...DEFAULT_SETTINGS, mode: 'custom', customText: '  hello\n world  ' }), 'hello world');
  assert.match(generateText({ ...DEFAULT_SETTINGS, mode: 'custom', customText: 'caf\u00e9 \ud83d\udc4d' }), /^[\x20-\x7e]+$/);
  assert.ok(generateText({ ...DEFAULT_SETTINGS, mode: 'practice', lesson: 'weak' }, {}).length > 10);
});

test('finger mapping includes opposite-hand shift and punctuation', () => {
  assert.equal(keyGuide('f').finger.id, 'li');
  assert.equal(keyGuide('j').finger.id, 'ri');
  assert.equal(keyGuide('B').shift, 'Right Shift');
  assert.equal(keyGuide('P').shift, 'Left Shift');
  assert.equal(keyGuide('?').base, '/');
  assert.equal(keyGuide('?').finger.id, 'rp');
  assert.equal(keyGuide(' ').finger.id, 'thumb');
});

test('weak keys are ranked by error rate and exclude space', () => {
  const result = weakKeys({ a: { attempts: 10, errors: 2 }, f: { attempts: 4, errors: 3 }, ' ': { attempts: 10, errors: 10 } });
  assert.deepEqual(result.map(item => item.key), ['f', 'a']);
});

test('corrupt or denied storage does not prevent startup or typing', () => {
  assert.equal(readProgress({ getItem: () => '{bad' }).progress.version, 1);
  assert.ok(readProgress({ getItem: () => { throw new Error('Denied'); } }).warning);
  assert.ok(writeProgress({ setItem: () => { throw new Error('Full'); } }, emptyProgress()));
});

test('backup validation rejects unsupported versions and filters unsafe settings', () => {
  assert.throws(() => validateProgress({ version: 2, history: [] }));
  const value = validateProgress({ version: 1, settings: { duration: -1, mode: 'evil', theme: 'dark' }, history: [{ wpm: NaN }], keyStats: { a: { attempts: 4, errors: 2 }, b: { attempts: 2, errors: 9 }, '__proto__': {} } });
  assert.equal(value.settings.duration, 30);
  assert.equal(value.settings.mode, 'time');
  assert.equal(value.settings.theme, 'dark');
  assert.equal(value.history.length, 0);
  assert.deepEqual(value.keyStats, { a: { attempts: 4, errors: 2 } });
});
