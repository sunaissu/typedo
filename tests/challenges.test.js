import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_CHALLENGES, challengeCategory, getChallengeComparison, makeChallengeLink, readSharedChallenge, validateChallenge } from '../src/challenges.js';

test('share links round trip exact text without including a score, identity, or existing hash', () => {
  const challenge = { title: 'My & your challenge', text: 'Keep  two spaces. Symbols: # & % ? / " = + < >.' };
  const url = new URL(makeChallengeLink(challenge, 'https://typedo.example/app/?theme=dark#old'));
  assert.deepEqual(readSharedChallenge(url.hash), challenge);
  assert.equal(url.pathname, '/app/');
  assert.equal(url.search, '?theme=dark');
  assert.equal(readSharedChallenge('#no-challenge'), null);
});

test('challenge imports reject malformed payloads and unsupported or excessive text', () => {
  for (const value of [null, [], {}, { title: '', text: 'Hi' }, { title: 'X'.repeat(81), text: 'Hi' }, { title: 'A', text: '🙂' }, { title: 'A', text: 'two\nlines' }, { title: 'A', text: 'a'.repeat(1501) }, { title: 'A', text: '   ' }]) assert.equal(validateChallenge(value), null);
  assert.equal(readSharedChallenge('#challenge=%broken'), null);
  assert.equal(readSharedChallenge('#challenge=' + encodeURIComponent(JSON.stringify({ version: 2, ...BUILTIN_CHALLENGES[0] }))), null);
  assert.equal(readSharedChallenge('#challenge=' + 'x'.repeat(12001)), null);
  assert.throws(() => makeChallengeLink(BUILTIN_CHALLENGES[0], 'javascript:alert(1)'));
});

test('challenge comparison keys preserve every case, punctuation, and spacing difference', () => {
  const variants = ['One note.', 'one note.', 'One note!', 'One  note.', 'One note. '];
  assert.equal(new Set(variants.map(challengeCategory)).size, variants.length);
  assert.equal(challengeCategory('One note.'), challengeCategory('One note.'));
});

test('personal challenge comparisons exclude interruptions and other passages while deduplicating history', () => {
  const challenge = BUILTIN_CHALLENGES[0];
  const run = (id, wpm, patch = {}) => ({ id, wpm, accuracy: 98, mode: 'custom', category: challengeCategory(challenge.text), ...patch });
  const first = run('a', 30);
  const summary = getChallengeComparison([first, first, run('b', 40), run('c', 35, { accuracy: 100 }), run('d', 90, { interrupted: true }), run('other', 120, { category: challengeCategory('other text') })], challenge);
  assert.deepEqual(summary, { count: 3, bestWpm: 40, bestAccuracy: 100, medianWpm: 35 });
  assert.equal(getChallengeComparison([first], challenge).medianWpm, null);
});
