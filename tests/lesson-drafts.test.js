import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonBlock, buildLessonTestBlock } from '../src/lessonPractice.js';
import { createLessonDraft, restoreLessonSession, sanitizeLessonDrafts } from '../src/lessonDrafts.js';
import { createSession, enterKey, pauseSession, resumeSession } from '../src/typing.js';

const lessonId = 'find-home';
const date = '2026-10-25T12:00:00.000Z';
function attempt(stage = 'practice') {
  const block = stage === 'practice' ? buildLessonBlock(lessonId, 0, { random: () => 0 }) : buildLessonTestBlock(lessonId, { random: () => 0 });
  const run = { stage, practiceKind: 'lesson', roundIndex: 0, guided: stage === 'practice', block };
  const config = stage === 'practice' ? { mode: 'practice', strict: true } : { mode: 'custom' };
  let session = { ...createSession(block.text), runId: 'stable-run' };
  session = enterKey(session, block.text[0], config, 1000);
  session = enterKey(session, 'x', config, 1500);
  if (stage === 'test') session = enterKey(session, 'Backspace', config, 1600);
  session = enterKey(session, block.text[1], config, 1700);
  session = enterKey(session, 'x', config, 1800);
  return { run, session, config };
}

test('lesson drafts preserve exact passage sequence, mistakes, guidance and active elapsed time', () => {
  const { run, session, config } = attempt();
  const paused = pauseSession(session, config, 2000);
  const saved = createLessonDraft(lessonId, run, paused, date);
  assert.ok(saved);
  assert.equal(saved.id, session.runId);
  assert.deepEqual(saved.block, run.block);
  assert.equal(saved.lastWrong, paused.lastWrong);
  assert.equal(saved.wrongStreak, paused.wrongStreak);
  const restored = restoreLessonSession(lessonId, JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.status, 'paused');
  assert.equal(restored.startedAt, null);
  assert.equal(restored.typed, session.typed);
  assert.equal(restored.attempts, session.attempts);
  assert.equal(restored.elapsed, 1000);
  assert.deepEqual(restored.keyStats, session.keyStats);
  assert.strictEqual(enterKey(restored, 'f', config, 90000), restored);
  const next = enterKey(resumeSession(restored), restored.text[restored.typed.length], config, 90000);
  assert.equal(next.elapsed, 1000, 'Paused time and the resume action do not count as active practice');
  assert.equal(next.attempts, session.attempts + 1);
});

test('reloading an unfinished assessment marks interruption and never hides previous errors', () => {
  const { run, session } = attempt('test');
  const saved = createLessonDraft(lessonId, run, session, date);
  assert.equal(saved.interrupted, false);
  const restored = restoreLessonSession(lessonId, saved);
  assert.equal(restored.interrupted, true);
  assert.deepEqual(restored.keyStats, session.keyStats);
  const savedAgain = createLessonDraft(lessonId, run, restored, date);
  assert.equal(savedAgain.interrupted, true);
  assert.deepEqual(sanitizeLessonDrafts({ [lessonId]: savedAgain }), { [lessonId]: savedAgain });
});

test('finished and completed run IDs cannot become unfinished lesson drafts again', () => {
  const { run, session } = attempt();
  const saved = createLessonDraft(lessonId, run, session, date);
  assert.equal(createLessonDraft(lessonId, run, { ...session, status: 'finished' }, date), null);
  assert.deepEqual(sanitizeLessonDrafts({ [lessonId]: saved }, {}, [{ id: saved.runId }]), {});
  assert.deepEqual(sanitizeLessonDrafts({ [lessonId]: saved }, { [lessonId]: { lastPracticed: '2026-10-26T12:00:00Z' } }), {});
  assert.deepEqual(sanitizeLessonDrafts({ [lessonId]: saved }, { [lessonId]: { practiceRounds: 3, lastPracticed: '2026-10-24T12:00:00Z' } }), { [lessonId]: saved }, 'New practice of an already completed lesson remains resumable');
});

test('invalid or incompatible lesson drafts cannot change text, fabricate counters, or claim guidance-free tests', () => {
  const { run, session } = attempt();
  const saved = createLessonDraft(lessonId, run, session, date);
  for (const patch of [
    { version: 2 }, { runId: '' }, { lessonId: 'unknown' }, { stage: 'test', guided: true },
    { practiceKind: 'check' }, { roundIndex: 10 }, { interrupted: 'false' }, { elapsed: Infinity },
    { attempts: saved.attempts + 1 }, { correctAttempts: 0 }, { typed: 'x' }, { updatedAt: 'tomorrow' },
    { block: { ...saved.block, passages: ['a replacement passage'] } },
  ]) assert.deepEqual(sanitizeLessonDrafts({ [lessonId]: { ...saved, ...patch } }), {}, JSON.stringify(patch));
  assert.deepEqual(sanitizeLessonDrafts({ unknown: saved }), {});
});
