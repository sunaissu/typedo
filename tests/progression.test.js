import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSON_COURSE, LESSON_PRACTICE_ROUNDS, applyLessonResult,
  lessonPracticeComplete, nextPracticeLesson, sanitizeLessonProgress,
} from '../src/lessons.js';
import { emptyProgress, readProgress, validateProgress, writeProgress } from '../src/storage.js';

const first = LESSON_COURSE[0];
const result = (patch = {}) => ({
  id: 'practice-run', date: '2026-10-21T10:00:00.000Z', mode: 'lesson',
  lessonId: first.id, stage: 'practice', practiceRound: 0,
  passage: first.practiceVariants[0], elapsed: 60000,
  wpm: 20, raw: 20, accuracy: 100, errors: 0, correct: first.practiceVariants[0].length,
  passed: false, ...patch,
});

test('three guided rounds complete a lesson without requiring an assessment', () => {
  assert.equal(LESSON_PRACTICE_ROUNDS, 3);
  assert.equal(lessonPracticeComplete(undefined), false);
  assert.equal(lessonPracticeComplete({ practiceRounds: 2, passed: false }), false);
  assert.equal(lessonPracticeComplete({ practiceRounds: 3, passed: false }), true);
  assert.equal(lessonPracticeComplete({ practiceRounds: 0, passed: true }), true, 'A previously passed test still completes the lesson');

  let progress = {};
  for (let round = 0; round < LESSON_PRACTICE_ROUNDS; round += 1) {
    progress = applyLessonResult(progress, result({ practiceRound: round, passage: first.practiceVariants[round] }));
    assert.equal(progress[first.id].practiceRounds, round + 1);
    assert.equal(progress[first.id].practiced, round === LESSON_PRACTICE_ROUNDS - 1);
    assert.equal(progress[first.id].passed, false, 'Guided rounds never award an assessment pass');
  }
  assert.equal(lessonPracticeComplete(progress[first.id]), true);
  assert.deepEqual(progress[first.id].seenPractice, first.practiceVariants.slice(0, 3));
});

test('returning learners resume the first unfinished lesson and a completed course stays complete', () => {
  assert.equal(nextPracticeLesson({}).id, first.id);
  const progress = Object.fromEntries(LESSON_COURSE.map(lesson => [lesson.id, { practiceRounds: 3 }]));
  assert.equal(nextPracticeLesson(progress), null, 'Completing the course must not silently restart lesson one');
  progress[LESSON_COURSE[2].id] = { practiceRounds: 2 };
  assert.equal(nextPracticeLesson(progress).id, LESSON_COURSE[2].id, 'Later completed lessons do not hide an unfinished lesson');
  progress[LESSON_COURSE[2].id].passed = true;
  assert.equal(nextPracticeLesson(progress), null);
});

test('repeating or resetting a round cannot count as additional progress', () => {
  const once = applyLessonResult({}, result());
  const repeated = applyLessonResult(once, result({ id: 'repeated', passage: first.practiceVariants[1] }));
  assert.equal(repeated[first.id].practiceRounds, 1);
  assert.equal(repeated[first.id].practiced, false);
  const finished = applyLessonResult(repeated, result({ practiceRound: 2 }));
  const reviewed = applyLessonResult(finished, result({ practiceRound: 0 }));
  assert.equal(reviewed[first.id].practiceRounds, 3, 'Reviewing an earlier round never removes completion');
  assert.equal(once[first.id].practiceRounds, 1, 'Applying results preserves the original progress object');
});

test('legacy practice completion is kept while explicit partial rounds remain unfinished', () => {
  const progress = sanitizeLessonProgress({
    [first.id]: { practiced: true },
    [LESSON_COURSE[1].id]: { practiced: true, practiceRounds: 1 },
    [LESSON_COURSE[2].id]: { practiceRounds: 999 },
    [LESSON_COURSE[3].id]: { practiceRounds: -4 },
    [LESSON_COURSE[4].id]: { practiceRounds: '3' },
  });
  assert.equal(progress[first.id].practiceRounds, 3, 'Existing completed warmups should not need repeating after the upgrade');
  assert.equal(progress[first.id].practiced, true);
  assert.equal(progress[LESSON_COURSE[1].id].practiceRounds, 1);
  assert.equal(progress[LESSON_COURSE[1].id].practiced, false);
  assert.equal(progress[LESSON_COURSE[2].id].practiceRounds, 3);
  assert.equal(progress[LESSON_COURSE[3].id].practiceRounds, 0);
  assert.equal(progress[LESSON_COURSE[4].id].practiceRounds, 0);
});

test('passage history rejects unknown content and separates guided practice from assessment', () => {
  const progress = sanitizeLessonProgress({
    [first.id]: {
      seenPractice: [first.practiceVariants[0], first.practiceVariants[0], 'unknown passage', null, 12],
      seenTests: [first.testVariants[0], first.testVariants[0], 'unknown test'],
    },
    [LESSON_COURSE[1].id]: { seenPractice: 'not an array', seenTests: {} },
  });
  assert.deepEqual(progress[first.id].seenPractice, [first.practiceVariants[0]]);
  assert.deepEqual(progress[first.id].seenTests, [first.testVariants[0]]);
  assert.deepEqual(progress[LESSON_COURSE[1].id].seenPractice, []);
  assert.deepEqual(progress[LESSON_COURSE[1].id].seenTests, []);
  const assessed = applyLessonResult(progress, result({ stage: 'test', passed: false, passage: first.testVariants[1] }));
  assert.equal(assessed[first.id].practiceRounds, 0, 'An optional assessment cannot increment guided rounds');
  assert.deepEqual(assessed[first.id].seenPractice, [first.practiceVariants[0]]);
  assert.deepEqual(assessed[first.id].seenTests, first.testVariants.slice(0, 2));
  assert.deepEqual(applyLessonResult(assessed, result({ passage: 'injected content' }))[first.id].seenPractice, [first.practiceVariants[0]]);
});

test('partial round progress and seen passages survive storage and backup validation', async () => {
  const run = result({ practiceRound: 1, passage: first.practiceVariants[1] });
  const progress = { ...emptyProgress(), history: [run], lessonProgress: applyLessonResult({}, run) };
  let saved;
  const storage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  assert.equal((await writeProgress(storage, progress)), '');
  const reloaded = (await readProgress(storage)).progress;
  assert.equal(reloaded.lessonProgress[first.id].practiceRounds, 2);
  assert.deepEqual(reloaded.lessonProgress[first.id].seenPractice, [first.practiceVariants[1]]);
  assert.deepEqual(validateProgress(JSON.parse(saved)).lessonProgress, reloaded.lessonProgress);
});
