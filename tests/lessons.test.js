import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_COURSE, applyLessonResult, lessonTestPassed, sanitizeLessonProgress } from '../src/lessons.js';
import { createSession, metrics } from '../src/typing.js';
import { emptyProgress, readProgress, validateProgress, writeProgress } from '../src/storage.js';

const lessonId = LESSON_COURSE[0].id;
const result = (patch = {}) => ({
  id: 'lesson-run', date: '2026-10-21T10:00:00.000Z', mode: 'lesson', lessonId,
  stage: 'test', label: 'First lesson test', category: `lesson:${lessonId}:test`,
  elapsed: 60000, wpm: 20, raw: 20, accuracy: 100, errors: 0, correct: 100,
  passed: true, ...patch,
});

test('a lesson passes only when attempt accuracy and final text each reach 95%', () => {
  const boundary = { ...createSession('a'.repeat(20)), status: 'finished', typed: `${'a'.repeat(19)}x`, attempts: 20, correctAttempts: 19, elapsed: 600000 };
  assert.equal(lessonTestPassed(boundary), true, 'Exactly 95% passes without a speed requirement');
  assert.equal(lessonTestPassed({ ...boundary, correctAttempts: 18 }), false, 'Corrections do not forgive low attempt accuracy');
  assert.equal(lessonTestPassed({ ...boundary, typed: `${'a'.repeat(18)}xx` }), false, 'High attempt accuracy alone does not excuse incorrect final text');
  assert.equal(lessonTestPassed({ ...boundary, status: 'running' }), false);
  assert.equal(lessonTestPassed(createSession('')), false);
});

test('rounded display accuracy cannot incorrectly award a lesson pass', () => {
  const session = { ...createSession('a'.repeat(20)), status: 'finished', typed: 'a'.repeat(20), attempts: 10000, correctAttempts: 9496, elapsed: 60000 };
  assert.equal(metrics(session).accuracy, 95);
  assert.equal(lessonTestPassed(session), false, '94.96% rounds to 95% on screen but is below the passing threshold');
});

test('drills and tests accumulate progress without losing a previous pass or personal best', () => {
  const practiced = applyLessonResult({}, result({ stage: 'practice', passed: true, accuracy: 98, wpm: 15 }));
  assert.equal(practiced[lessonId].practiced, true);
  assert.equal(practiced[lessonId].passed, false, 'A guided drill cannot award a test pass');
  const passed = applyLessonResult(practiced, result());
  const retried = applyLessonResult(passed, result({ id: 'retry', date: '2026-10-20T10:00:00.000Z', passed: false, accuracy: 70, wpm: 12 }));
  assert.deepEqual(retried[lessonId], {
    practiced: true, passed: true, bestAccuracy: 100, bestWpm: 20,
    attempts: 3, lastPracticed: '2026-10-21T10:00:00.000Z',
  });
  assert.equal(practiced[lessonId].attempts, 1, 'Updates do not mutate the original saved record');
  assert.deepEqual(applyLessonResult(retried, result({ lessonId: 'missing-lesson' })), retried);
});

test('malformed lesson backups cannot introduce unknown lessons or invalid progress values', () => {
  const inherited = { [lessonId]: { passed: true } };
  assert.deepEqual(sanitizeLessonProgress(Object.create(inherited)), {});
  assert.deepEqual(sanitizeLessonProgress([]), {});
  const clean = sanitizeLessonProgress({
    [lessonId]: { practiced: 'true', passed: 1, bestAccuracy: 300, bestWpm: Infinity, attempts: -10, lastPracticed: 'not a date' },
    unknown: { passed: true },
  });
  assert.deepEqual(Object.keys(clean), [lessonId]);
  assert.deepEqual(clean[lessonId], { practiced: false, passed: false, bestAccuracy: 100, bestWpm: 0, attempts: 0, lastPracticed: '' });
});

test('lesson history and completion survive local storage and exported backup validation', () => {
  const run = result();
  const progress = { ...emptyProgress(), history: [run], lessonProgress: applyLessonResult({}, run) };
  let saved;
  const storage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  assert.equal(writeProgress(storage, progress), '');
  const reloaded = readProgress(storage);
  assert.equal(reloaded.warning, '');
  assert.deepEqual(reloaded.progress.lessonProgress, progress.lessonProgress);
  assert.deepEqual(reloaded.progress.history, [run]);
  const imported = validateProgress(JSON.parse(JSON.stringify(reloaded.progress)));
  assert.deepEqual(imported.lessonProgress, progress.lessonProgress);
  assert.deepEqual(imported.history, [run]);
});
