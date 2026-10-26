import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLessonLearningResult, getDueLessonReviews, getLessonImprovement, getLessonLearningStatus, lessonResultEvidence, sanitizeLessonLearning } from '../src/lessonLearning.js';
import { emptyProgress, mergeProgress, readProgress, validateProgress, writeProgress } from '../src/storage.js';
import { buildCheckBlock } from '../src/lessonPractice.js';
import { applyLessonResult, lessonTestPassed } from '../src/lessons.js';
import { createSession, enterKey, metrics } from '../src/typing.js';

const lessonId = 'center-reach';
const day = (number, hours = 12) => new Date(2026, 8, number, hours).toISOString();
const run = (id, date, overrides = {}) => ({
  id, date, mode: 'lesson', lessonId, stage: 'practice', practiceKind: 'lesson', guided: true,
  attempts: 80, correctAttempts: 80, correct: 80, textLength: 80, elapsed: 60000, accuracy: 100,
  wpm: 16, raw: 16, errors: 0, label: 'G + H', category: 'lesson:center-reach', passed: false,
  targetKeys: ['g', 'h'], keyStats: { g: { attempts: 40, errors: 0 }, h: { attempts: 40, errors: 0 } }, ...overrides,
});
const check = (id, date, overrides = {}) => run(id, date, { stage: 'test', practiceKind: 'check', guided: false, ...overrides });
const record = value => value[lessonId];
const baseline = () => applyLessonLearningResult({}, run('intro', day(1)));
const completedCourse = { [lessonId]: { practiced: true, practiceRounds: 3 } };

test('review schedule distinguishes practice, later independent checks and due review', () => {
  let learning = baseline();
  assert.equal(record(learning).retainedAt, '');
  assert.deepEqual(getDueLessonReviews(learning, completedCourse, day(1)), []);
  assert.deepEqual(getDueLessonReviews(learning, completedCourse, day(2)), [{ lessonId, dueAt: day(2), retained: false }]);
  learning = applyLessonLearningResult(learning, check('check-1', day(2)));
  assert.equal(record(learning).retainedAt, day(2));
  assert.equal(record(learning).successfulChecks, 1);
  assert.equal(record(learning).nextReviewAt, day(5));
  assert.deepEqual(getLessonLearningStatus(record(learning), day(3)), { label: 'Retained on a later check', retained: true, due: false });
  learning = applyLessonLearningResult(learning, check('check-2', day(5)));
  assert.equal(record(learning).nextReviewAt, day(12));
  assert.equal(record(learning).successfulChecks, 2);
  assert.equal(getLessonLearningStatus(record(learning), day(12)).due, true);
});

test('same-day, midnight, guided and insufficient checks never award retained credit', () => {
  const cases = [
    check('same-day', day(1, 23)),
    check('short-gap', day(2, 7)),
    check('guided', day(2), { guided: true }),
    check('short', day(2), { correct: 39 }),
    check('missing-key', day(2), { targetKeys: ['g'] }),
    check('missing-coverage', day(2), { keyStats: { g: { attempts: 79, errors: 0 }, h: { attempts: 1, errors: 0 } } }),
  ];
  for (const result of cases) {
    for (const assessmentPassed of [undefined, true]) {
      const learning = applyLessonLearningResult(baseline(), { ...result, assessmentPassed });
      assert.equal(record(learning).retainedAt, '', result.id);
      assert.equal(record(learning).needsGuidedReview, true, result.id);
    }
  }
  const first = applyLessonLearningResult({}, check('no-introduction', day(2)));
  assert.equal(record(first).retainedAt, '');
  const late = applyLessonLearningResult({}, run('late', day(1, 23)));
  assert.equal(record(applyLessonLearningResult(late, check('midnight', day(2, 0)))).retainedAt, '');
  const boundary = applyLessonLearningResult({}, run('morning', day(1, 15)));
  assert.equal(record(applyLessonLearningResult(boundary, check('twenty-hours', day(2, 11)))).retainedAt, day(2, 11));
});

test('retention checks use raw accuracy and exact target evidence, not rounded accuracy', () => {
  const rounded = check('rounded', day(2), {
    attempts: 1001, correctAttempts: 950, correct: 950, textLength: 950, accuracy: 95,
    keyStats: { g: { attempts: 500, errors: 25 }, h: { attempts: 501, errors: 26 } },
  });
  assert.equal(record(applyLessonLearningResult(baseline(), rounded)).retainedAt, '');
  const exact = check('exact', day(2), {
    attempts: 100, correctAttempts: 95, correct: 95, textLength: 95, accuracy: 95,
    keyStats: { g: { attempts: 50, errors: 2 }, h: { attempts: 50, errors: 3 } },
  });
  assert.equal(record(applyLessonLearningResult(baseline(), exact)).retainedAt, day(2));
  const practiceBefore = applyLessonLearningResult(baseline(), run('review-before-check', day(2, 11), { practiceKind: 'review' }));
  assert.equal(record(applyLessonLearningResult(practiceBefore, check('freshly-rehearsed', day(2)))).retainedAt, '');
});

test('backspace attempts cannot substitute for accurate final text or missing length evidence', () => {
  const correctedRepeatedly = check('inflated-attempts', day(2), {
    attempts: 200, correctAttempts: 190, correct: 40, textLength: 80, accuracy: 95,
    keyStats: { g: { attempts: 100, errors: 5 }, h: { attempts: 100, errors: 5 } },
  });
  assert.equal(record(applyLessonLearningResult(baseline(), correctedRepeatedly)).retainedAt, '');
  assert.equal(record(applyLessonLearningResult(baseline(), check('unknown-length', day(2), { textLength: undefined }))).retainedAt, '');
  const fromPassage = check('known-passage', day(2), { textLength: undefined, passage: 'g'.repeat(40) + 'h'.repeat(40) });
  assert.equal(record(applyLessonLearningResult(baseline(), fromPassage)).retainedAt, day(2));
  assert.equal(record(applyLessonLearningResult(baseline(), check('exact-final', day(2), { correct: 76 }))).retainedAt, day(2));
  assert.equal(record(applyLessonLearningResult(baseline(), check('below-final', day(2), { correct: 75 }))).retainedAt, '');
});

test('an optional test counts as recent rehearsal before a retention check', () => {
  const rehearsed = applyLessonLearningResult(baseline(), run('optional-test', day(3), { stage: 'test', guided: false }));
  assert.equal(record(rehearsed).lastPracticed, day(3));
  assert.equal(record(rehearsed).nextReviewAt, day(4));
  const immediate = new Date(Date.parse(day(3)) + 60000).toISOString();
  assert.equal(record(applyLessonLearningResult(rehearsed, check('immediate-check', immediate))).retainedAt, '');
});

test('interrupted checks record rehearsal without failed advice or changing earlier successful intervals', () => {
  const learned = applyLessonLearningResult(baseline(), check('success', day(2)));
  const interrupted = check('paused-check', day(3), { interrupted: true, assessmentPassed: false });
  const practiced = applyLessonLearningResult(learned, interrupted);
  assert.equal(record(practiced).retainedAt, day(2));
  assert.equal(record(practiced).lastChecked, day(2));
  assert.equal(record(practiced).successfulChecks, 1);
  assert.equal(record(practiced).needsGuidedReview, false);
  assert.equal(record(practiced).lastPracticed, day(3));
  assert.equal(record(practiced).nextReviewAt, day(5), 'An interrupted check does not shorten an already earned review interval');
  const rehearsed = applyLessonLearningResult(baseline(), check('interrupted-later', day(5), { interrupted: true }));
  assert.equal(record(rehearsed).needsGuidedReview, false);
  assert.equal(record(rehearsed).nextReviewAt, day(6));
  assert.equal(record(rehearsed).retainedAt, '');
  const sameDay = applyLessonLearningResult(rehearsed, check('too-soon-after-pause', day(5, 23)));
  assert.equal(record(sameDay).retainedAt, '');
  const nextDay = applyLessonLearningResult(rehearsed, check('next-day-after-pause', day(6)));
  assert.equal(record(nextDay).retainedAt, day(6));
  assert.equal(lessonResultEvidence(interrupted).interrupted, true);
  assert.deepEqual(sanitizeLessonLearning(JSON.parse(JSON.stringify(practiced))), practiced);
  const imported = validateProgress({ ...emptyProgress(), history: [interrupted], lessonLearning: practiced });
  assert.equal(imported.history[0].interrupted, true);
  assert.deepEqual(imported.lessonLearning, practiced);
});

test('interrupted optional assessments cannot award a pass or supply comparable improvement evidence', () => {
  const result = run('paused-test', day(2), { stage: 'test', guided: false, interrupted: true, passed: true });
  assert.equal(applyLessonResult({}, result)[lessonId].passed, false);
  assert.equal(applyLessonResult({ [lessonId]: { passed: true } }, result)[lessonId].passed, true);
  const block = buildCheckBlock(lessonId, { random: () => 0 });
  assert.equal(lessonTestPassed({ ...createSession(block.text), status: 'finished', interrupted: true, typed: block.text, attempts: block.text.length, correctAttempts: block.text.length }, lessonId), false);
  const mistakes = { correctAttempts: 64, correct: 64, keyStats: { g: { attempts: 40, errors: 8 }, h: { attempts: 40, errors: 8 } } };
  const learning = applyLessonLearningResult(applyLessonLearningResult({}, check('earlier', day(1), mistakes)), check('paused', day(2), { ...mistakes, interrupted: true }));
  assert.equal(getLessonImprovement(record(learning), check('accurate', day(3))), null);
  assert.equal(getLessonImprovement(record(learning), check('paused-current', day(3), { interrupted: true })), null);
});

test('retyping one rare target cannot earn retention when its other final position is wrong', () => {
  const homeId = 'find-home';
  const block = buildCheckBlock(homeId, { random: () => .2, length: 'quick' });
  const target = 'j';
  assert.equal([...block.text].filter(key => key === target).length, 2);
  let session = createSession(block.text);
  let time = 0;
  const press = key => { session = enterKey(session, key, { mode: 'custom' }, ++time * 100); };
  for (let index = 0; index < block.text.length; index++) {
    const key = block.text[index];
    if (key === target && index === block.text.indexOf(target)) { press(key); press('Backspace'); }
    press(key === target && index === block.text.lastIndexOf(target) ? 'x' : key);
  }
  const evidence = {
    lessonId: homeId, ...metrics(session), elapsed: session.elapsed,
    attempts: session.attempts, correctAttempts: session.correctAttempts, keyStats: session.keyStats,
    targetKeys: block.targetKeys, textLength: block.text.length,
  };
  const passed = lessonTestPassed(session, homeId);
  assert.equal(passed, false);
  assert.ok(evidence.accuracy >= 95);
  assert.equal(session.keyStats[target].attempts - session.keyStats[target].errors, 2, 'Attempt totals alone count the retyped position twice');
  const result = check('missing-final-target', day(3), { ...evidence, passed, assessmentPassed: passed });
  const initial = applyLessonLearningResult({}, run('earlier-home-practice', day(1), evidence));
  const learning = applyLessonLearningResult(initial, result);
  assert.equal(learning[homeId].retainedAt, '');
  assert.equal(learning[homeId].needsGuidedReview, true);
  assert.equal(lessonResultEvidence(result).assessmentPassed, false);

  const progress = { ...emptyProgress(), history: [result], lessonLearning: learning };
  const restored = validateProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(restored.history[0].assessmentPassed, false, 'History preserves the failed assessment evidence');
  assert.equal(restored.lessonLearning[homeId].samples.at(-1).assessmentPassed, false);
  assert.equal(restored.lessonLearning[homeId].retainedAt, '', 'Reload cannot turn the failed check into retention');
  assert.deepEqual(mergeProgress(restored, { ...emptyProgress(), lessonLearning: initial }).lessonLearning, learning);
});

test('assessment evidence preserves legacy retention without replacing the existing check requirements', () => {
  const legacy = applyLessonLearningResult(baseline(), check('legacy-check', day(2)));
  assert.equal(record(legacy).retainedAt, day(2));
  assert.equal(Object.hasOwn(record(legacy).samples.at(-1), 'assessmentPassed'), false);
  assert.deepEqual(sanitizeLessonLearning(JSON.parse(JSON.stringify(legacy))), legacy);
  const current = applyLessonLearningResult(baseline(), check('current-check', day(2), { assessmentPassed: true }));
  assert.equal(record(current).retainedAt, day(2));
  assert.equal(record(current).samples.at(-1).assessmentPassed, true);
  const inaccurate = check('failed-accuracy', day(2), {
    assessmentPassed: true, correctAttempts: 70, correct: 70,
    keyStats: { g: { attempts: 40, errors: 5 }, h: { attempts: 40, errors: 5 } },
  });
  assert.equal(record(applyLessonLearningResult(baseline(), inaccurate)).retainedAt, '');
});

test('failed checks recommend guided review without erasing course credit or earlier evidence', () => {
  const learned = applyLessonLearningResult(baseline(), check('success', day(2)));
  const failed = applyLessonLearningResult(learned, check('later-failure', day(5), {
    correctAttempts: 70, correct: 70, keyStats: { g: { attempts: 40, errors: 5 }, h: { attempts: 40, errors: 5 } },
  }));
  assert.equal(record(failed).needsGuidedReview, true);
  assert.equal(record(failed).retainedAt, day(2), 'A dated successful check remains in the record');
  assert.equal(getLessonLearningStatus(record(failed), day(5)).label, 'Guided review recommended');
  const course = { [lessonId]: { practiced: true, passed: true, practiceRounds: 3 } };
  const before = JSON.stringify(course);
  getDueLessonReviews(failed, course, day(5));
  assert.equal(JSON.stringify(course), before);
  const reviewed = applyLessonLearningResult(failed, run('guided-review', day(5, 13), { practiceKind: 'review' }));
  assert.equal(record(reviewed).needsGuidedReview, false);
  assert.equal(record(reviewed).nextReviewAt, day(6, 13));
});

test('legacy completed lessons are offered a guided review without imported retention credit', () => {
  const progress = { [lessonId]: { practiced: true, lastPracticed: day(1), retained: true }, 'find-home': { practiced: false } };
  assert.deepEqual(getDueLessonReviews({}, progress, day(2)), [{ lessonId, dueAt: day(1), retained: false }]);
  assert.deepEqual(sanitizeLessonLearning({ [lessonId]: { retainedAt: day(1), successfulChecks: 99, nextReviewAt: day(2) } }), {});
  const learning = applyLessonLearningResult({}, run('review', day(2), { practiceKind: 'review' }));
  assert.deepEqual(getDueLessonReviews(learning, progress, day(2)), []);
  assert.equal(record(learning).retainedAt, '');
  assert.deepEqual(getDueLessonReviews(baseline(), { [lessonId]: { practiceRounds: 1 } }, day(20)), [], 'An unfinished lesson never reviews unreached keys');
});

test('duplicate results are idempotent and bounded samples retain verified check evidence', () => {
  let learning = baseline();
  learning = applyLessonLearningResult(learning, check('first-check', day(2)));
  assert.deepEqual(applyLessonLearningResult(learning, check('first-check', day(20))), learning);
  for (let index = 0; index < 100; index++) learning = applyLessonLearningResult(learning, run(`practice-${index}`, new Date(Date.parse(day(3)) + index * 60000).toISOString()));
  assert.ok(record(learning).samples.length <= 64);
  assert.equal(record(learning).retainedAt, day(2));
  assert.equal(record(learning).successfulChecks, 1);
  assert.deepEqual(sanitizeLessonLearning(JSON.parse(JSON.stringify(learning))), learning);
});

test('retention cannot appear when pruning removes the practice immediately before a failed check', () => {
  let learning = baseline();
  learning = applyLessonLearningResult(learning, run('fresh-review', day(3, 11), { practiceKind: 'review' }));
  learning = applyLessonLearningResult(learning, check('too-soon', day(3)));
  for (let index = 0; index < 62; index++) learning = applyLessonLearningResult(learning, run(`more-${index}`, new Date(Date.parse(day(4)) + index * 60000).toISOString()));
  assert.equal(record(learning).samples.some(sample => sample.id === 'fresh-review'), false);
  assert.equal(record(learning).samples.some(sample => sample.id === 'too-soon'), true);
  assert.equal(record(learning).retainedAt, '');
});

test('specific improvement feedback needs multiple comparable samples and adequate key evidence', () => {
  const mistakes = { correctAttempts: 64, correct: 64, keyStats: { g: { attempts: 40, errors: 8 }, h: { attempts: 40, errors: 8 } } };
  let learning = applyLessonLearningResult({}, run('one', day(1), mistakes));
  assert.equal(getLessonImprovement(record(learning), run('better', day(3))), null);
  learning = applyLessonLearningResult(learning, run('two', day(2), mistakes));
  assert.match(getLessonImprovement(record(learning), run('better', day(3))), /G and H/);
  assert.equal(getLessonImprovement(record(learning), run('different-support', day(3), { guided: false })), null);
  assert.equal(getLessonImprovement(record(learning), check('different-kind', day(3))), null);
  assert.equal(getLessonImprovement(record(learning), run('different-targets', day(3), { targetKeys: ['g'] })), null);
  const perfect = applyLessonLearningResult(applyLessonLearningResult({}, run('a', day(1))), run('b', day(2)));
  assert.equal(getLessonImprovement(record(perfect), run('still-perfect', day(3))), null);
});

test('version 1 storage preserves learning evidence and settings through save, import and nonregressing merge', async () => {
  const older = { ...emptyProgress(), lessonLearning: baseline() };
  const result = check('check-1', day(2));
  const newer = { ...emptyProgress(), settings: { ...emptyProgress().settings, lessonTheme: 'adventure', lessonLength: 'extra' }, history: [result], lessonLearning: applyLessonLearningResult(older.lessonLearning, result) };
  let saved;
  const storage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  assert.equal((await writeProgress(storage, newer)), '');
  const loaded = (await readProgress(storage)).progress;
  assert.deepEqual(loaded.lessonLearning, newer.lessonLearning);
  assert.equal(loaded.history[0].guided, false);
  assert.equal(loaded.history[0].attempts, 80);
  assert.equal(loaded.settings.lessonTheme, 'adventure');
  assert.equal(loaded.settings.lessonLength, 'extra');
  assert.deepEqual(validateProgress(JSON.parse(saved)).lessonLearning, newer.lessonLearning);
  assert.deepEqual(mergeProgress(newer, older).lessonLearning, newer.lessonLearning);
  assert.deepEqual(mergeProgress(older, newer).lessonLearning, newer.lessonLearning);
  assert.deepEqual(mergeProgress(newer, newer).lessonLearning, newer.lessonLearning);
  const legacy = { version: 1, history: [], settings: {} };
  assert.deepEqual(validateProgress(legacy).lessonLearning, {});
  assert.equal(validateProgress(legacy).settings.lessonLength, 'standard');
  assert.equal(validateProgress(legacy).settings.lessonTheme, 'everyday');
});

test('malformed backup evidence cannot fabricate retained skills or unsafe settings', () => {
  const initial = record(baseline()).samples[0];
  for (const patch of [{ attempts: -1 }, { correctAttempts: 81 }, { correct: 81 }, { textLength: 0 }, { textLength: 79 }, { elapsed: Infinity }, { targetKeys: [] }, { date: 'tomorrow' }, { guided: 'false' }, { assessmentPassed: 'false' }, { assessmentPassed: null }, { keyStats: { g: { attempts: 80, errors: 1 } } }, { id: 'x'.repeat(101) }]) {
    const invalid = { [lessonId]: { samples: [{ ...initial, ...patch }], retainedAt: day(2), successfulChecks: 99 } };
    assert.deepEqual(sanitizeLessonLearning(invalid), {});
  }
  assert.deepEqual(sanitizeLessonLearning({ unknown: { samples: [initial] } }), {});
  const value = validateProgress({ version: 1, history: [], settings: { lessonLength: 'infinite', lessonTheme: '__proto__' }, lessonLearning: { [lessonId]: { samples: [initial], retainedAt: day(2), successfulChecks: 99 } } });
  assert.equal(value.settings.lessonLength, 'standard');
  assert.equal(value.settings.lessonTheme, 'everyday');
  assert.equal(record(value.lessonLearning).retainedAt, '');
  assert.equal(record(value.lessonLearning).successfulChecks, 0);
});
