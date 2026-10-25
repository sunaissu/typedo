import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPracticePassages, MAX_PASSAGE_LENGTH, MAX_SAVED_PASSAGES, normalizePassage, passageDetails, PRACTICE_TRACKS, sanitizeSavedPassages } from '../src/practiceLibrary.js';

test('plain-text import previews supported normalization without hiding truncation or unsupported characters', () => {
  const result = normalizePassage('  “Café”—a test…\nNext\tline 🙂  ');
  assert.equal(result.text, '"Cafe"-a test... Next line');
  assert.equal(result.unsupported, 1);
  assert.equal(result.changed, true);
  assert.equal(result.truncated, false);
  const long = normalizePassage('a'.repeat(MAX_PASSAGE_LENGTH + 1));
  assert.equal(long.text.length, MAX_PASSAGE_LENGTH);
  assert.equal(long.truncated, true);
  assert.equal(normalizePassage('🙂').text, '');
  assert.equal(normalizePassage(null).text, '');
});

test('passage backups reject malformed entries, bound data, and keep the newest duplicate', () => {
  const original = { id: 'personal-1', title: ' A note ', text: 'Hello there.', updatedAt: '2026-10-25T01:00:00Z' };
  const updated = { ...original, title: 'Updated note', updatedAt: '2026-10-25T02:00:00Z' };
  const clean = sanitizeSavedPassages([original, null, { ...original, id: '../file' }, { ...original, id: 'bad-date', updatedAt: 'yesterday' }, { ...original, id: 'blank', text: '🙂' }, updated]);
  assert.deepEqual(clean, [{ ...updated, updatedAt: '2026-10-25T02:00:00.000Z' }]);
  assert.equal(original.title, ' A note ', 'Sanitizing must not mutate data held by the editor');
  const many = Array.from({ length: 40 }, (_, index) => ({ ...original, id: `entry-${index}`, title: 'T'.repeat(100), text: 'a'.repeat(2000) }));
  const bounded = sanitizeSavedPassages(many);
  assert.equal(bounded.length, MAX_SAVED_PASSAGES);
  assert.equal(bounded[0].title.length, 80);
  assert.equal(bounded[0].text.length, MAX_PASSAGE_LENGTH);
  assert.deepEqual(sanitizeSavedPassages({}), []);
});

test('everyday tracks have printable authored passages and honest key filters', () => {
  assert.equal(new Set(PRACTICE_TRACKS.map(item => item.id)).size, PRACTICE_TRACKS.length);
  for (const passage of PRACTICE_TRACKS) {
    assert.match(passage.text, /^[\x20-\x7e]+$/);
    assert.ok(passage.text.length <= MAX_PASSAGE_LENGTH);
    assert.ok(passageDetails(passage.text).words >= 15);
  }
  assert.ok(filterPracticePassages(PRACTICE_TRACKS, { skill: 'Letters only' }).every(item => /^[a-z ]+$/.test(item.text)));
  const numbers = filterPracticePassages(PRACTICE_TRACKS, { skill: 'Numbers', track: 'Emails' });
  assert.ok(numbers.length > 0);
  assert.ok(numbers.every(item => item.track === 'Emails' && /[0-9]/.test(item.text)));
  assert.ok(filterPracticePassages(PRACTICE_TRACKS, { query: '  receipt  ' }).some(passage => passage.id === 'receipt'));
  assert.deepEqual(filterPracticePassages(PRACTICE_TRACKS, { query: 'does-not-exist' }), []);
});
