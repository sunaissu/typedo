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

test('repeated strict-practice mistakes retain the actual key and reset after correction', () => {
  const config = { mode: 'practice', strict: true };
  let session = enterKey(createSession('Aa'), 'a', config, 100);
  assert.equal(session.lastWrong, 'A', 'Existing expected-key feedback remains unchanged');
  assert.equal(session.lastWrongKey, 'a');
  assert.equal(session.lastWrongPosition, 0);
  assert.equal(session.wrongStreak, 1);
  session = enterKey(session, 's', config, 200);
  assert.equal(session.lastWrongKey, 's', 'The most recent incorrect key is available to the lesson');
  assert.equal(session.wrongStreak, 2);
  assert.equal(session.typed, '');
  session = enterKey(session, 'A', config, 300);
  assert.equal(session.lastWrong, null);
  assert.equal(session.lastWrongKey, null);
  assert.equal(session.lastWrongPosition, null);
  assert.equal(session.wrongStreak, 0);
  session = enterKey(session, 'A', config, 400);
  assert.equal(session.wrongStreak, 1, 'A later position starts a new sequence');
  assert.equal(session.lastWrongPosition, 1);
  assert.deepEqual(session.keyStats, { A: { attempts: 3, errors: 2 }, a: { attempts: 1, errors: 1 } });
});

test('backspacing clears repeated-error feedback without erasing mistakes', () => {
  const config = { mode: 'practice', strict: true };
  let session = createSession('ab');
  for (const [index, key] of ['a', 'x', 'y', 'Backspace'].entries()) session = enterKey(session, key, config, 100 + index * 100);
  assert.equal(session.typed, '');
  assert.equal(session.lastWrong, null);
  assert.equal(session.lastWrongKey, null);
  assert.equal(session.lastWrongPosition, null);
  assert.equal(session.wrongStreak, 0);
  assert.equal(metrics(session).errors, 2);
  assert.equal(enterKey(session, 'x', config, 600).wrongStreak, 1);
});

test('mistakes at consecutive positions do not count as repeated attempts at one key', () => {
  const config = { mode: 'custom' };
  let session = enterKey(createSession('aaa'), 'x', config, 100);
  session = enterKey(session, 'x', config, 200);
  assert.equal(session.wrongStreak, 1);
  assert.equal(session.lastWrongPosition, 1);
  assert.equal(session.typed, 'xx');
});

test('sessions missing new feedback fields can resume without altering accuracy', () => {
  const config = { mode: 'practice', strict: true };
  const legacy = createSession('ab');
  delete legacy.lastWrongKey;
  delete legacy.lastWrongPosition;
  delete legacy.wrongStreak;
  let session = enterKey(legacy, 'x', config, 100);
  session = enterKey(session, 'y', config, 200);
  assert.equal(session.wrongStreak, 2);
  assert.equal(session.lastWrongKey, 'y');
  session = enterKey(session, 'a', config, 300);
  assert.equal(metrics(session).accuracy, 33.3);
});

test('typing records capital and punctuation mistakes separately from lowercase letters', () => {
  const config = { ...DEFAULT_SETTINGS, mode: 'practice', strict: true };
  let session = createSession('Aa?');
  for (const [index, key] of ['a', 'A', 'a', '/', '?'].entries()) {
    session = enterKey(session, key, config, 100 + index * 100);
  }
  assert.equal(session.status, 'finished');
  assert.equal(session.typed, 'Aa?');
  assert.deepEqual(session.keyStats, {
    A: { attempts: 2, errors: 1 },
    a: { attempts: 1, errors: 0 },
    '?': { attempts: 2, errors: 1 },
  });
  const progress = { ...emptyProgress(), keyStats: session.keyStats };
  assert.deepEqual(validateProgress(progress).keyStats, session.keyStats, 'Saved backups preserve exact-case evidence');
});

test('empty backspace and modifier keys do not start timing', () => {
  for (const key of ['Backspace', 'Shift', 'Enter', 'Tab', 'ArrowLeft']) {
    const session = enterKey(createSession('abc'), key, DEFAULT_SETTINGS, 100);
    assert.equal(session.status, 'ready');
    assert.equal(session.startedAt, null);
  }
});

test('resuming a ready session carries active elapsed time into its next tick', () => {
  const config = { mode: 'custom' };
  const saved = { ...createSession('abc'), typed: 'a', attempts: 1, correctAttempts: 1, elapsed: 5000, keyStats: { a: { attempts: 1, errors: 0 } } };
  assert.equal(enterKey(saved, 'Shift', config, 90000), saved);
  const resumed = enterKey(saved, 'b', config, 90000);
  assert.equal(resumed.startedAt, 85000);
  assert.equal(resumed.elapsed, 5000);
  assert.equal(tick(resumed, config, 90500).elapsed, 5500);
  const fresh = enterKey(createSession('abc'), 'a', config, 90000);
  assert.equal(fresh.startedAt, 90000);
  assert.equal(fresh.elapsed, 0);
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

test('row practice uses varied phrases while keeping the intended keys', () => {
  const rows = { home: /^[asdfghjkl; ]+$/, top: /^[qwertyuiopasdfghjkl; ]+$/, bottom: /^[a-z ]+$/, all: /^[a-z ]+$/ };
  for (const [lesson, allowed] of Object.entries(rows)) {
    const config = { ...DEFAULT_SETTINGS, mode: 'practice', lesson };
    const first = generateText(config, {}, () => 0);
    const next = generateText(config, {}, () => 0.8);
    assert.match(first, allowed);
    assert.match(next, allowed);
    assert.notEqual(first, next, 'A fresh practice round should draw from different phrases');
    assert.doesNotMatch(first, /(\w)\1\1/);
    assert.ok(first.split(' ').length >= 10);
  }
});

test('weak-key practice uses readable phrases for every letter and supported punctuation', () => {
  for (const key of 'abcdefghijklmnopqrstuvwxyz;,.') {
    const text = generateText({ ...DEFAULT_SETTINGS, mode: 'practice', lesson: 'weak' }, { [key]: { attempts: 4, errors: 3 } }, () => 0);
    assert.ok(text.toLowerCase().includes(key), `Practice should include the weak key ${key}`);
    assert.match(text, /^[\x20-\x7e]+$/);
    assert.ok(text.split(' ').length >= 10, 'Weak keys should appear in phrases with real words');
    assert.doesNotMatch(text, /(\w)\1\1/, 'Weak keys should not turn into repeated-letter drills');
  }
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
