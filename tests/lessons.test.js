import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_COURSE, applyLessonResult, generateLessonText, lessonPracticeComplete, lessonTestPassed, sanitizeLessonProgress } from '../src/lessons.js';
import { buildLessonTestBlock, LESSON_TARGET_KEYS, LESSON_TEST_PASSAGES } from '../src/lessonPractice.js';
import { createSession, enterKey, metrics } from '../src/typing.js';
import { emptyProgress, readProgress, validateProgress, writeProgress } from '../src/storage.js';

const lessonId = LESSON_COURSE[0].id;
const result = (patch = {}) => ({
  id: 'lesson-run', date: '2026-10-21T10:00:00.000Z', mode: 'lesson', lessonId,
  stage: 'test', label: 'First lesson test', category: `lesson:${lessonId}:test`,
  elapsed: 60000, wpm: 20, raw: 20, accuracy: 100, errors: 0, correct: 100,
  passed: true, ...patch,
});

test('the first lesson starts at home and introduces useful reaches in later rounds', () => {
  const first = LESSON_COURSE[0];
  assert.equal(first.id, 'find-home', 'Saved lesson progress keeps its original identity');
  const allowed = [/^[asdfjkl ]+$/, /^[asdfjkletr ]+$/, /^[asdfjkletrnoi ]+$/];
  for (const [index, round] of first.practiceRounds.entries()) {
    for (const text of round.passages) {
      assert.match(text, allowed[index]);
      assert.doesNotMatch(text, /\b(fj|jf|fff|jjj)\b/);
    }
    assert.ok(round.instruction.length > 0, 'Each new reach has finger guidance');
    assert.ok(round.fingers.length > 0);
  }
  assert.match(first.practiceRounds[1].passages.join(' '), /[etr]/);
  assert.match(first.practiceRounds[2].passages.join(' '), /[noi]/);
  assert.ok(first.testVariants.every(text => !/\b(dad|lad|flask)\b/.test(text)), 'The test moves beyond the home row warmup vocabulary');
});

test('lesson passages introduce reaches and punctuation in the advertised order', () => {
  const allowed = [
    /^[asdfjkletrnoi ]+$/, /^[asdfjkletrnoi ]+$/, /^[asdfghjkletrnoi ]+$/,
    /^[qwertyuiopasdfghjkln ]+$/, /^[a-z ]+$/, /^[A-Za-z ]+$/,
    /^[A-Za-z0-9 ]+$/, /^[\x20-\x7e]+$/, /^[\x20-\x7e]+$/, /^[\x20-\x7e]+$/, /^[\x20-\x7e]+$/, /^[\x20-\x7e]+$/,
  ];
  assert.equal(LESSON_COURSE.length, allowed.length);
  for (const [index, lesson] of LESSON_COURSE.entries()) {
    for (const text of [...lesson.practiceVariants, ...lesson.testVariants]) {
      assert.match(text, allowed[index], `${lesson.id} should only require keys introduced so far`);
      assert.doesNotMatch(text, /(\w)\1\1/, `${lesson.id} should use words instead of repeated key drills`);
      assert.ok(text.split(' ').length >= 3, `${lesson.id} should offer a short phrase to type`);
    }
  }
});

test('each lesson offers fresh practice and test passages without changing the string API', () => {
  for (const lesson of LESSON_COURSE) {
    for (const stage of ['practice', 'test']) {
      const variants = lesson[`${stage}Variants`];
      assert.ok(new Set(variants).size >= (stage === 'test' ? 8 : 12));
      assert.equal(lesson[stage], variants[0]);
      assert.equal(generateLessonText(lesson.id, stage, () => 0), lesson[stage]);
      assert.notEqual(generateLessonText(lesson.id, stage, () => 0.99), lesson[stage]);
      assert.notEqual(generateLessonText(lesson.id, stage, () => 0, lesson[stage]), lesson[stage], 'A retry can exclude the passage just completed');
    }
    assert.notEqual(lesson.practice, lesson.test);
  }
  assert.equal(generateLessonText('missing', 'practice', () => 0), LESSON_COURSE[0].practice);
});

test('every lesson has three distinct rounds with fresh vocabulary and a key preview', () => {
  for (const lesson of LESSON_COURSE) {
    assert.equal(lesson.practiceRounds.length, 3);
    const previousWords = new Set();
    for (const [index, round] of lesson.practiceRounds.entries()) {
      assert.ok(round.title.length > 0);
      assert.ok(round.keys.length > 0);
      assert.ok(new Set(round.passages).size >= 4);
      const words = new Set(round.passages.join(' ').toLowerCase().match(/[a-z]+/g));
      const newWords = [...words].filter(word => !previousWords.has(word));
      assert.ok(newWords.length >= 4, `${lesson.id} round ${index + 1} should introduce new words`);
      for (const word of words) previousWords.add(word);
      assert.equal(generateLessonText(lesson.id, 'practice', () => 0, '', { round: index }), round.passages[0]);
    }
    assert.deepEqual(lesson.practiceVariants, lesson.practiceRounds.flatMap(round => round.passages));
  }
});

test('seen passages stay out of retries until the chosen round or test pool is exhausted', () => {
  for (const lesson of LESSON_COURSE) {
    const pools = lesson.practiceRounds.map((round, index) => ({ stage: 'practice', round: index, variants: round.passages }));
    pools.push({ stage: 'test', variants: lesson.testVariants });
    for (const { stage, round, variants } of pools) {
      const seenTexts = [];
      let previousText = '';
      for (let index = 0; index < variants.length; index += 1) {
        const text = generateLessonText(lesson.id, stage, () => 0, previousText, { round, seenTexts });
        assert.ok(variants.includes(text));
        assert.ok(!seenTexts.includes(text), `${lesson.id} should use every available ${stage} passage before repeating`);
        seenTexts.push(text);
        previousText = text;
      }
      const refilled = generateLessonText(lesson.id, stage, () => 0.99, previousText, { round, seenTexts });
      assert.ok(variants.includes(refilled));
      assert.notEqual(refilled, previousText, 'Refilling a pool still avoids an immediate repeat');
    }
  }
});

test('a lesson passes only when attempt accuracy and final text each reach 95%', () => {
  const text = `g h g h ${'a'.repeat(92)}`;
  const boundary = { ...createSession(text), status: 'finished', typed: `${text.slice(0, 95)}xxxxx`, attempts: 100, correctAttempts: 95, elapsed: 6000000 };
  assert.equal(lessonTestPassed(boundary, 'center-reach'), true, 'Exactly 95% with covered keys passes without a speed requirement');
  assert.equal(lessonTestPassed({ ...boundary, correctAttempts: 94 }, 'center-reach'), false, 'Corrections do not forgive low attempt accuracy');
  assert.equal(lessonTestPassed({ ...boundary, typed: `${text.slice(0, 94)}xxxxxx` }, 'center-reach'), false, 'High attempt accuracy alone does not excuse incorrect final text');
  assert.equal(lessonTestPassed({ ...boundary, status: 'running' }, 'center-reach'), false);
  assert.equal(lessonTestPassed(createSession(''), 'center-reach'), false);
  assert.equal(lessonTestPassed(boundary), false, 'A lesson identity is required to verify its targets');
  assert.equal(lessonTestPassed(boundary, 'unknown'), false);
});

test('rounded display accuracy cannot incorrectly award a lesson pass', () => {
  const text = `g h g h ${'a'.repeat(92)}`;
  const session = { ...createSession(text), status: 'finished', typed: text, attempts: 10000, correctAttempts: 9496, elapsed: 60000 };
  assert.equal(metrics(session).accuracy, 95);
  assert.equal(lessonTestPassed(session, 'center-reach'), false, '94.96% rounds to 95% on screen but is below the passing threshold');
});

test('covered optional test blocks can complete every lesson without practice credit', () => {
  for (const lesson of LESSON_COURSE) {
    const block = buildLessonTestBlock(lesson.id, { random: () => 0 });
    let session = createSession(block.text);
    [...block.text].forEach((key, index) => { session = enterKey(session, key, { mode: 'custom' }, index * 500); });
    const passed = lessonTestPassed(session, lesson.id);
    assert.equal(passed, true, lesson.id);
    const progress = applyLessonResult({}, result({ lessonId: lesson.id, passage: block.text, passages: block.passages, passed, ...metrics(session) }));
    assert.equal(progress[lesson.id].practiceRounds, 0);
    assert.equal(lessonPracticeComplete(progress[lesson.id]), true);
    assert.deepEqual(progress[lesson.id].seenTests, [...new Set(block.passages)]);
  }
});

test('a short legacy sentence cannot complete a new lesson or erase historical credit', () => {
  const text = 'read a note and take a seat';
  let session = createSession(text);
  [...text].forEach((key, index) => { session = enterKey(session, key, { mode: 'custom' }, index * 500); });
  assert.equal(metrics(session).accuracy, 100);
  const passed = lessonTestPassed(session, 'find-home');
  assert.equal(passed, false);
  const fresh = applyLessonResult({}, result({ passage: text, passed, ...metrics(session) }));
  assert.equal(lessonPracticeComplete(fresh['find-home']), false);
  const historical = { 'find-home': { passed: true, practiceRounds: 0 } };
  assert.equal(lessonPracticeComplete(sanitizeLessonProgress(historical)['find-home']), true);
  assert.equal(lessonPracticeComplete(applyLessonResult(historical, result({ passed: false }))['find-home']), true);
});

test('tests need enough correct text as well as complete target coverage', () => {
  const sessionFor = text => ({ ...createSession(text), status: 'finished', typed: text, attempts: text.length, correctAttempts: text.length });
  assert.equal(lessonTestPassed(sessionFor(`g h g h ${'a'.repeat(31)}`), 'center-reach'), false, '39 correct characters are too short');
  assert.equal(lessonTestPassed(sessionFor(`g h g h ${'a'.repeat(32)}`), 'center-reach'), true, '40 correct characters meet the minimum');
});

test('overall accuracy cannot hide missing correct occurrences of a rare target key', () => {
  const highAccuracyLessons = [];
  for (const lesson of LESSON_COURSE) {
    const block = buildLessonTestBlock(lesson.id, { random: () => 0 });
    const targets = LESSON_TARGET_KEYS[lesson.id];
    const target = [...targets].sort((a, b) => block.text.split(a).length - block.text.split(b).length)[0];
    let occurrences = 0;
    let errors = 0;
    const typed = [...block.text].map(key => {
      if (key !== target || ++occurrences === 1) return key;
      errors++;
      return target === 'x' ? 'y' : 'x';
    }).join('');
    const session = { ...createSession(block.text), status: 'finished', typed, attempts: block.text.length, correctAttempts: block.text.length - errors, targetKeys: targets.filter(key => key !== target) };
    if (session.correctAttempts / session.attempts >= .95) highAccuracyLessons.push(lesson.id);
    assert.equal(lessonTestPassed(session, lesson.id), false, `${lesson.id} must demonstrate ${target} in two final positions`);
  }
  for (const id of ['find-home', 'top-row', 'bottom-row', 'capitals', 'numbers', 'punctuation']) {
    assert.ok(highAccuracyLessons.includes(id), `${id} must reject missing target coverage even above 95% overall accuracy`);
  }
});

test('retyping one target position cannot substitute for two correct final occurrences', () => {
  const text = `g h g ${'a'.repeat(74)}`;
  let session = createSession(text);
  let time = 0;
  for (const [index, key] of [...text].entries()) {
    if (index === 2) {
      for (let retry = 0; retry < 3; retry++) {
        session = enterKey(session, key, { mode: 'custom' }, time += 500);
        session = enterKey(session, 'Backspace', { mode: 'custom' }, time += 500);
      }
    }
    session = enterKey(session, key, { mode: 'custom' }, time += 500);
  }
  assert.equal(metrics(session).accuracy, 100);
  assert.ok(session.keyStats.h.attempts >= 2);
  assert.equal(lessonTestPassed(session, 'center-reach'), false, 'Only one h remains in the final text');
});

test('optional test segment history survives backup validation alongside legacy passages', () => {
  const block = buildLessonTestBlock(lessonId, { random: () => 0 });
  const oldText = LESSON_COURSE[0].testVariants[0];
  const initial = { [lessonId]: { passed: true, seenTests: [oldText] } };
  const lessonProgress = applyLessonResult(initial, result({ passage: block.text, passages: [...block.passages, 'unknown passage'] }));
  const restored = validateProgress({ ...emptyProgress(), lessonProgress });
  assert.deepEqual(restored.lessonProgress[lessonId].seenTests, [oldText, ...new Set(block.passages)]);
  assert.ok(restored.lessonProgress[lessonId].seenTests.slice(1).every(passage => LESSON_TEST_PASSAGES[lessonId].includes(passage)));
});

test('drills and tests accumulate progress without losing a previous pass or personal best', () => {
  const practiced = applyLessonResult({}, result({ stage: 'practice', passed: true, accuracy: 98, wpm: 15 }));
  assert.equal(practiced[lessonId].practiced, false, 'A single guided round is progress, not a completed practice lesson');
  assert.equal(practiced[lessonId].practiceRounds, 1);
  assert.equal(practiced[lessonId].passed, false, 'A guided drill cannot award a test pass');
  const passed = applyLessonResult(practiced, result());
  const retried = applyLessonResult(passed, result({ id: 'retry', date: '2026-10-20T10:00:00.000Z', passed: false, accuracy: 70, wpm: 12 }));
  assert.deepEqual(retried[lessonId], {
    practiced: false, practiceRounds: 1, passed: true, bestAccuracy: 100, bestWpm: 20,
    attempts: 3, lastPracticed: '2026-10-21T10:00:00.000Z',
    seenPractice: [], seenTests: [],
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
  assert.deepEqual(clean[lessonId], { practiced: false, practiceRounds: 0, passed: false, bestAccuracy: 100, bestWpm: 0, attempts: 0, lastPracticed: '', seenPractice: [], seenTests: [] });
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
