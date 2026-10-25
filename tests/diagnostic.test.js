import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAGNOSTIC_GROUPS, DIAGNOSTIC_TEXT, getDiagnosticRecommendation } from '../src/diagnostic.js';
import { createSession, enterKey, pauseSession, resumeSession } from '../src/typing.js';

function completeWithMistakes(wrongKeys = '') {
  let session = createSession(DIAGNOSTIC_TEXT);
  let now = 1000;
  for (const character of DIAGNOSTIC_TEXT) {
    if (wrongKeys.includes(character)) {
      session = enterKey(session, '#', { mode: 'custom' }, now++);
      session = enterKey(session, 'Backspace', { mode: 'custom' }, now++);
    }
    session = enterKey(session, character, { mode: 'custom' }, now++);
  }
  return session;
}

test('diagnostic sample covers each group with enough distinct printable characters', () => {
  assert.match(DIAGNOSTIC_TEXT, /^[\x20-\x7e]+$/);
  const result = getDiagnosticRecommendation(completeWithMistakes());
  assert.equal(result.groups.length, DIAGNOSTIC_GROUPS.length);
  for (const group of result.groups) assert.equal(group.enough, true, group.label);
  assert.equal(result.lessonId, 'word-flow');
});

test('diagnostic suggests the earliest sampled skill that needs work and keeps corrected mistakes', () => {
  const capitals = getDiagnosticRecommendation(completeWithMistakes('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'));
  assert.equal(capitals.lessonId, 'capitals');
  const home = getDiagnosticRecommendation(completeWithMistakes('asdfjkl0123456789'));
  assert.equal(home.lessonId, 'find-home');
  const numbers = getDiagnosticRecommendation(completeWithMistakes('0123456789'));
  assert.equal(numbers.lessonId, 'numbers');
  assert.ok(numbers.groups.find(group => group.lessonId === 'numbers').errors > 0);
});

test('diagnostic never uses speed as a universal starting threshold', () => {
  const accurate = completeWithMistakes();
  assert.equal(getDiagnosticRecommendation({ ...accurate, elapsed: 1000 }).lessonId, 'word-flow');
  assert.equal(getDiagnosticRecommendation({ ...accurate, elapsed: 3600000 }).lessonId, 'word-flow');
  assert.equal(getDiagnosticRecommendation(accurate, { guided: true }).guided, true);
  assert.match(getDiagnosticRecommendation(accurate, { guided: true }).limitation, /not evidence of typing independently/);
});

test('incomplete or fabricated coverage cannot recommend skipping ahead', () => {
  assert.equal(getDiagnosticRecommendation(createSession(DIAGNOSTIC_TEXT)).lessonId, 'find-home');
  const missingEvidence = { ...completeWithMistakes(), keyStats: {} };
  assert.equal(getDiagnosticRecommendation(missingEvidence).lessonId, 'find-home');
  assert.equal(getDiagnosticRecommendation({ ...completeWithMistakes(), text: 'another text' }).complete, false);
});

test('pausing a diagnostic preserves the same recommendation without awarding any result fields', () => {
  let session = createSession(DIAGNOSTIC_TEXT);
  for (const character of DIAGNOSTIC_TEXT.slice(0, 40)) session = enterKey(session, character, { mode: 'custom' }, 1000 + session.attempts * 100);
  const paused = pauseSession(session, { mode: 'custom' }, 5000);
  session = resumeSession(paused);
  for (const character of DIAGNOSTIC_TEXT.slice(40)) session = enterKey(session, character, { mode: 'custom' }, 100000 + session.attempts * 100);
  const result = getDiagnosticRecommendation(session);
  assert.equal(result.lessonId, 'word-flow');
  assert.equal(result.passed, undefined);
  assert.equal(result.completed, undefined);
  assert.equal(result.wpm, undefined);
});
