import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText, getPracticeRecommendation, weakKeys } from '../src/typing.js';

const practice = { mode: 'practice', lesson: 'weak' };

test('recommendations wait for repeated mistakes and enough observations', () => {
  const stats = {
    a: { attempts: 3, errors: 3 },
    b: { attempts: 10, errors: 1 },
    c: { attempts: 100, errors: 2 },
    d: { attempts: 4, errors: 2 },
  };
  assert.deepEqual(getPracticeRecommendation(stats).keys, [{ key: 'd', attempts: 4, errors: 2 }]);
  assert.equal(getPracticeRecommendation({ a: stats.a, b: stats.b, c: stats.c }), null);
  assert.equal(getPracticeRecommendation({}), null);
  assert.equal(getPracticeRecommendation(null), null);
  assert.equal(getPracticeRecommendation(stats, 0), null);
});

test('recommendations reject spaces, unknown keys, and malformed evidence', () => {
  const invalid = { attempts: 8, errors: 4 };
  assert.equal(getPracticeRecommendation({
    ' ': invalid, Enter: invalid, '\u00e9': invalid,
    a: { attempts: 0, errors: 4 },
    b: { attempts: 4, errors: 5 },
    c: { attempts: Infinity, errors: 5 },
    d: { attempts: 4.5, errors: 3 },
    e: { attempts: 8, errors: NaN },
    f: null,
  }), null);
});

test('capitalization and punctuation get their own recommendations and exact text', () => {
  const stats = { a: { attempts: 100, errors: 0 }, A: { attempts: 8, errors: 4 }, '?': { attempts: 5, errors: 4 } };
  assert.deepEqual(weakKeys(stats).map(({ key }) => key), ['?', 'A']);
  const recommendation = getPracticeRecommendation(stats);
  assert.match(recommendation.description, /capital A/);
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const passage = generateText(practice, stats, random);
    assert.ok(passage.includes('A'));
    assert.ok(passage.includes('?'));
    assert.ok(passage.split(' ').length > 10);
  }
});

test('focused practice covers all printable keys with readable varied scenes', () => {
  for (let code = 33; code <= 126; code++) {
    const key = String.fromCharCode(code);
    const stats = { [key]: { attempts: 6, errors: 3 } };
    const first = generateText(practice, stats, () => 0);
    const another = generateText(practice, stats, () => 0.999);
    for (const passage of [first, another]) {
      assert.ok(passage.includes(key), `Practice must include the exact target ${key}`);
      assert.ok(passage.split(' ').length >= 10, `Practice for ${key} must contain readable words`);
      assert.match(passage, /^[\x20-\x7e]+$/);
    }
    assert.notEqual(first, another, `Practice for ${key} must have more than one scene`);
  }
});

test('one exercise covers the three leading recommendations without changing stats', () => {
  const stats = { X: { attempts: 6, errors: 6 }, '?': { attempts: 6, errors: 5 }, '_': { attempts: 6, errors: 4 }, z: { attempts: 20, errors: 3 } };
  const before = structuredClone(stats);
  assert.deepEqual(getPracticeRecommendation(stats).keys.map(({ key }) => key), ['X', '?', '_']);
  const passage = generateText(practice, stats, () => 0.5);
  for (const key of ['X', '?', '_']) assert.ok(passage.includes(key));
  assert.deepEqual(stats, before);
});

test('restarting focused practice avoids the previous scene even with the same random result', () => {
  for (const key of ['A', '?', ';', '`']) {
    const stats = { [key]: { attempts: 6, errors: 3 } };
    const first = generateText(practice, stats, () => 0);
    const next = generateText(practice, stats, () => 0, first);
    assert.notEqual(next, first, `Restart should use a fresh scene for ${key}`);
    assert.ok(!next.includes(first), `The previous scene for ${key} should not appear again`);
    assert.ok(next.includes(key), `The fresh scene must still cover ${key}`);
  }
});

test('avoiding previous scenes preserves all recommended capital and punctuation targets', () => {
  const stats = { X: { attempts: 6, errors: 5 }, '?': { attempts: 6, errors: 4 }, '_': { attempts: 6, errors: 3 } };
  const first = generateText(practice, stats, () => 0);
  const next = generateText(practice, stats, () => 0, first);
  assert.notEqual(next, first);
  for (const key of ['X', '?', '_']) assert.ok(next.includes(key));
  assert.doesNotMatch(next, /Xavier|Is this your hat|picnic_notes/);
});

test('focused practice handles empty evidence and boundary random values', () => {
  for (const sample of [0, 1, -1, NaN, Infinity]) {
    const passage = generateText(practice, { '!': { attempts: 4, errors: 3 } }, () => sample);
    assert.ok(passage.includes('!'));
    assert.doesNotMatch(passage, /undefined/);
  }
  const first = generateText(practice, {}, () => 0);
  const next = generateText(practice, {}, () => 0.9);
  assert.notEqual(first, next);
  assert.doesNotMatch(first, /a lad asks dad|a flask falls/);
});
