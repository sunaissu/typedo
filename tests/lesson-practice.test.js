import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_CONTENT } from '../src/lessonContent.js';
import { CHECK_EXTRAS, FLUENT_SCENES, ROUND_EXTRAS, THEMED_SCENES } from '../src/lessonPracticeContent.js';
import { buildCheckBlock, buildLessonBlock, buildLessonTestBlock, buildReviewBlock, LESSON_TARGET_KEYS, LESSON_TEST_PASSAGES, LESSON_THEMES, PRACTICE_LENGTHS } from '../src/lessonPractice.js';

const ids = Object.keys(LESSON_CONTENT);
const home = 'asdfjklertion';
const center = `${home}gh`;
const top = `${center}wyuqp`;
const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const digits = `${letters}0123456789`;
const all = `${digits},.?!"';:`;
const allowed = {
  'find-home': ['asdfjkl', 'asdfjklert', home],
  'home-row': [home, home, home],
  'center-reach': [`${home}g`, center, center],
  'top-row': [`${center}wyu`, top, top],
  'bottom-row': [`${top}cvb`, 'abcdefghijklmnopqrstuvwxyz', 'abcdefghijklmnopqrstuvwxyz'],
  capitals: [letters, letters, letters],
  numbers: [`${letters}12345`, digits, digits],
  punctuation: [`${digits},.`, `${digits},.?!"'`, all],
  'word-flow': [all, all, all], contractions: [all, all, all], messages: [all, all, all], 'mixed-text': [all, all, all],
};
const occurrences = (text, key) => [...text].filter(character => character === key).length;
function assertAllowed(text, characters, label) {
  const unexpected = [...new Set([...text].filter(key => key !== ' ' && !characters.includes(key)))];
  assert.deepEqual(unexpected, [], `${label}: ${text}`);
  assert.doesNotMatch(text, /\s{2,}|^\s|\s$/);
  assert.doesNotMatch(text, /(\w)\1\1/, 'Use words, not repeated-key drills');
}

test('all authored additions respect the exact introduction order', () => {
  for (const id of ids) {
    ROUND_EXTRAS[id].forEach((passages, round) => passages.forEach(passage => assertAllowed(passage, allowed[id][round], `${id} round ${round + 1}`)));
    CHECK_EXTRAS[id].forEach(passage => assertAllowed(passage, allowed[id][2], `${id} check`));
    LESSON_TEST_PASSAGES[id].forEach(passage => assertAllowed(passage, allowed[id][2], `${id} optional test`));
    Object.values(THEMED_SCENES[id] || FLUENT_SCENES).flat(2).forEach(passage => assertAllowed(passage, allowed[id][2], `${id} scene`));
  }
});

test('every lesson block offers known keys and repeated target coverage at every theme and length', () => {
  for (const id of ids) {
    for (let round = 0; round < 3; round++) {
      for (const { id: theme } of LESSON_THEMES) {
        for (const { id: length } of PRACTICE_LENGTHS) {
          for (const sample of [0, 0.43, 0.999]) {
            const block = buildLessonBlock(id, round, { theme, length, random: () => sample });
            assert.equal(block.text, block.passages.join(' '));
            assert.equal(block.theme, theme);
            assert.ok(block.passages.length >= 2);
            assertAllowed(block.text, allowed[id][round], `${id} round ${round + 1} ${theme} ${length}`);
            for (const key of block.targetKeys) {
              assert.ok(occurrences(block.text, key) >= { quick: 2, standard: 3, extra: 4 }[length], `${id} round ${round + 1} ${theme} ${length} must repeat ${key}`);
            }
          }
        }
      }
    }
  }
});

test('a standard lesson has enough practice while the first home-only warmup stays short', () => {
  for (const id of ids) {
    for (const { id: theme } of LESSON_THEMES) {
      const blocks = [0, 1, 2].map(round => buildLessonBlock(id, round, { theme, random: () => 0 }));
      const length = blocks.reduce((total, block) => total + block.text.length, 0);
      assert.ok(length >= 500 && length <= 850, `${id} ${theme} has ${length} characters`);
      if (id === 'find-home') assert.ok(blocks[0].text.length >= 100 && blocks[0].text.length <= 145);
      for (let round = 0; round < 3; round++) {
        const quick = buildLessonBlock(id, round, { theme, length: 'quick', random: () => 0 });
        const extra = buildLessonBlock(id, round, { theme, length: 'extra', random: () => 0 });
        assert.ok(quick.text.length < blocks[round].text.length, `${id} round ${round} quick is shorter`);
        assert.ok(extra.text.length > blocks[round].text.length, `${id} round ${round} extra is longer`);
      }
    }
  }
});

test('the final round opens with an ordered scene for the chosen theme', () => {
  for (const id of ids) {
    const texts = [];
    for (const { id: theme } of LESSON_THEMES) {
      const block = buildLessonBlock(id, 2, { theme, random: () => 0 });
      const scene = (THEMED_SCENES[id] || FLUENT_SCENES)[theme][0];
      assert.deepEqual(block.passages.slice(0, scene.length), scene);
      texts.push(block.text);
    }
    assert.equal(new Set(texts).size, 3, `${id} theme changes the scene`);
  }
});

test('word flow repeats useful letter combinations inside different words', () => {
  for (const { id: theme } of LESSON_THEMES) {
    for (const [round, combination] of ['th', 'er', 'ing'].entries()) {
      const block = buildLessonBlock('word-flow', round, { theme, random: () => 0.43 });
      const words = [...new Set(block.text.toLowerCase().split(/\W+/).filter(word => word.includes(combination)))];
      assert.ok(words.length >= 2, `${combination} appears in varied words`);
      assert.ok(block.text.split(combination).length - 1 >= 3);
    }
  }
});

test('retries vary the passage even with a deterministic random source', () => {
  for (const id of ids) {
    for (let round = 0; round < 3; round++) {
      const first = buildLessonBlock(id, round, { random: () => 0 });
      const retry = buildLessonBlock(id, round, { random: () => 0, previousText: first.text });
      assert.notEqual(retry.text, first.text, `${id} round ${round}`);
      assert.equal(buildLessonBlock(id, round, { random: () => 0 }).text, first.text);
    }
  }
});

test('reviews and independent checks cover the canonical lesson keys without introducing new ones', () => {
  for (const id of ids) {
    for (const builder of [buildReviewBlock, buildCheckBlock]) {
      const block = builder(id, { random: () => 0 });
      assert.deepEqual(block.targetKeys, LESSON_TARGET_KEYS[id]);
      assert.equal(block.text, block.passages.join(' '));
      assert.ok(block.text.length >= 40);
      assertAllowed(block.text, allowed[id][2], `${id} review/check`);
      for (const key of block.targetKeys) assert.ok(occurrences(block.text, key) >= 2, `${id} review/check repeats ${key}`);
      assert.notEqual(builder(id, { random: () => 0, previousText: block.text }).text, block.text);
    }
    const practice = new Set([...ROUND_EXTRAS[id].flat(), ...LESSON_CONTENT[id].practiceRounds.flatMap(round => round.passages)]);
    const check = buildCheckBlock(id, { random: () => 0 });
    assert.ok(check.passages.every(passage => !practice.has(passage)), `${id} check uses reserved material`);
  }
});

test('optional tests cover every target twice at every length and keep later checks reserved', () => {
  for (const id of ids) {
    const reserved = new Set([...CHECK_EXTRAS[id], ...LESSON_CONTENT[id].testVariants]);
    const practice = new Set([...ROUND_EXTRAS[id].flat(), ...LESSON_CONTENT[id].practiceRounds.flatMap(round => round.passages), ...Object.values(THEMED_SCENES[id] || FLUENT_SCENES).flat(2)]);
    for (const passage of LESSON_TEST_PASSAGES[id]) {
      assert.ok(!reserved.has(passage), `${id} optional tests must not rehearse later-check passages`);
      assert.ok(!practice.has(passage), `${id} optional tests have their own passages`);
    }
    for (const { id: length } of PRACTICE_LENGTHS) {
      for (const sample of [0, .43, .999]) {
        const block = buildLessonTestBlock(id, { length, random: () => sample });
        assert.equal(block.text, block.passages.join(' '));
        assert.deepEqual(block.targetKeys, LESSON_TARGET_KEYS[id]);
        assert.deepEqual(block.adaptiveKeys, []);
        assert.ok(block.text.length >= { quick: 110, standard: 160, extra: 230 }[length]);
        assertAllowed(block.text, allowed[id][2], `${id} optional test`);
        assert.ok(block.passages.every(passage => LESSON_TEST_PASSAGES[id].includes(passage)));
        for (const key of LESSON_TARGET_KEYS[id]) assert.ok(occurrences(block.text, key) >= 2, `${id} optional test repeats ${key}`);
        assert.notEqual(buildLessonTestBlock(id, { length, random: () => sample, previousText: block.text }).text, block.text);
      }
    }
  }
});

test('optional tests prefer unseen passages and still cover targets after their pool is exhausted', () => {
  for (const id of ids) {
    const passages = LESSON_TEST_PASSAGES[id];
    const seenTexts = passages.slice(0, -1);
    const unseen = passages.at(-1);
    const block = buildLessonTestBlock(id, { length: 'quick', random: () => 0, seenTexts });
    assert.equal(block.passages[0], unseen, `${id} starts with an unseen passage`);
    const exhausted = buildLessonTestBlock(id, { length: 'quick', random: () => 0, seenTexts: passages });
    for (const key of LESSON_TARGET_KEYS[id]) assert.ok(occurrences(exhausted.text, key) >= 2);
    const combined = buildLessonTestBlock(id, { random: () => 0, seenTexts: [seenTexts.join(' ')] });
    assert.equal(combined.passages[0], unseen, `${id} also recognizes previous combined blocks`);
  }
  const first = buildLessonTestBlock('contractions', { length: 'quick', random: () => 0 });
  const next = buildLessonTestBlock('contractions', { length: 'quick', random: () => 0, seenTexts: first.passages });
  assert.ok(next.passages.every(passage => !first.passages.includes(passage)), 'Use unseen passages when they provide enough length and coverage');
  assert.deepEqual(buildLessonTestBlock('center-reach', { random: () => 0, keyStats: { h: { attempts: 20, errors: 10 } } }), buildLessonTestBlock('center-reach', { random: () => 0 }), 'Test content does not adapt to recent mistakes');
});

test('adaptive passages need repeated evidence and remain a minority of the block', () => {
  const base = buildLessonBlock('center-reach', 1, { random: () => 0 });
  const sparse = buildLessonBlock('center-reach', 1, { random: () => 0, keyStats: { h: { attempts: 7, errors: 3 }, g: { attempts: 8, errors: 1 } } });
  assert.equal(sparse.text, base.text);
  assert.deepEqual(sparse.adaptiveKeys, []);
  const adaptive = buildLessonBlock('center-reach', 1, { random: () => 0, keyStats: { h: { attempts: 8, errors: 3 }, g: { attempts: 20, errors: 5 }, x: { attempts: 10, errors: 5 } } });
  assert.ok(adaptive.adaptiveKeys.includes('h'));
  assert.ok(!adaptive.adaptiveKeys.includes('x'));
  assert.ok(adaptive.text.startsWith(base.text));
  const added = adaptive.text.length - base.text.length;
  assert.ok(added > 0 && added / adaptive.text.length <= 0.25);
  const check = buildCheckBlock('center-reach', { random: () => 0, keyStats: { h: { attempts: 8, errors: 3 } } });
  assert.deepEqual(check.adaptiveKeys, [], 'Independent checks do not change to match recent mistakes');
});

test('invalid preferences and random outputs fall back to a playable block', () => {
  const expected = buildLessonBlock('find-home', 0, { random: () => 0 });
  for (const sample of [NaN, Infinity, -1]) {
    assert.deepEqual(buildLessonBlock('missing', NaN, { theme: 'missing', length: 'missing', keyStats: null, random: () => sample }), expected);
  }
  assert.ok(buildLessonBlock('find-home', 99, { random: () => 9 }).text.length > 0);
});
