import test from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, applyStoryResult, filterStories, sanitizeStoryProgress } from '../src/stories.js';

test('each story is a complete three-chapter ASCII passage with capitals and punctuation', () => {
  assert.equal(STORIES.length, 15);
  assert.equal(new Set(STORIES.map(story => story.id)).size, STORIES.length);
  const passages = new Set();
  for (const story of STORIES) {
    assert.equal(story.chapters.length, 3);
    assert.ok(story.wordCount >= 250 && story.wordCount <= 450, `${story.title}: ${story.wordCount} words`);
    for (const chapter of story.chapters) {
      assert.match(chapter.text, /^[\x20-\x7e]+$/);
      assert.match(chapter.text, /^[A-Z]/);
      assert.match(chapter.text, /[.!?]"?$/);
      assert.ok(chapter.text.includes('"'), 'Dialogue practices quoted speech');
      assert.ok(chapter.text.length < 1500, 'Each chapter fits the custom text engine');
      assert.ok(!passages.has(chapter.text));
      passages.add(chapter.text);
    }
  }
});

test('story discovery combines search, genre, length and practice level', () => {
  assert.deepEqual(filterStories({ query: '  MILO  ', genre: 'Mystery' }).map(story => story.id), ['harbor-signal']);
  assert.deepEqual(filterStories({ query: 'Pip stories' }).map(story => story.id), ['small-dragon', 'pip-cloud-route']);
  assert.ok(filterStories({ length: 'short' }).every(story => story.wordCount <= 300));
  assert.ok(filterStories({ length: 'long' }).every(story => story.wordCount > 300));
  assert.ok(filterStories({ length: 'short' }).length > 0);
  assert.ok(filterStories({ length: 'long' }).length > 0);
  assert.equal(filterStories({ length: 'short' }).length + filterStories({ length: 'long' }).length, STORIES.length);
  assert.deepEqual(filterStories({ difficulty: 'Longer sentences', genre: 'Science fiction' }).map(story => story.id), ['station-garden']);
  assert.equal(filterStories({ query: 'no matching title' }).length, 0);
});

test('discovery treats partial chapters and rereads as in progress without removing completion', () => {
  const progress = {
    'plant-manager': { completedChapters: 3, replayChapter: 1 },
    'duck-hotel': { completedChapters: 1 },
    'small-dragon': { completedChapters: 3 },
  };
  const drafts = { 'soup-mystery': { chapterIndex: 0 } };
  const ids = completion => filterStories({ completion }, progress, drafts).map(story => story.id);
  assert.deepEqual(ids('in-progress'), ['plant-manager', 'duck-hotel', 'soup-mystery']);
  assert.deepEqual(ids('finished'), ['plant-manager', 'small-dragon']);
  assert.ok(!ids('unstarted').includes('soup-mystery'));
  assert.ok(!ids('unfinished').includes('plant-manager'));
  assert.ok(ids('unfinished').includes('duck-hotel'));
});

test('the expanded collection contains complete adventures and related stories', () => {
  assert.ok(STORIES.length >= 8);
  assert.ok(STORIES.some(story => story.genre === 'Adventure'));
  assert.ok(STORIES.some(story => story.genre === 'Science fiction'));
  assert.equal(STORIES.filter(story => story.collection === 'Harbor stories').length, 2);
  assert.equal(STORIES.filter(story => story.collection === 'Pip stories').length, 2);
});

test('story bookmarks advance consecutively and preserve progress on replay', () => {
  const storyId = STORIES[0].id;
  const result = { mode: 'story', storyId, chapterIndex: 0, accuracy: 91.2, date: '2026-10-21T12:00:00.000Z' };
  let progress = applyStoryResult({}, result);
  assert.deepEqual(progress[storyId], { completedChapters: 1, bestAccuracy: 91.2, attempts: 1, lastPracticed: result.date });
  progress = applyStoryResult(progress, { ...result, chapterIndex: 1, accuracy: 98 });
  progress = applyStoryResult(progress, { ...result, chapterIndex: 2, accuracy: 95 });
  assert.equal(progress[storyId].completedChapters, 3);
  assert.equal(progress[storyId].bestAccuracy, 98);
  progress = applyStoryResult(progress, { ...result, accuracy: 92 });
  assert.equal(progress[storyId].completedChapters, 3);
  assert.equal(progress[storyId].attempts, 4);
  assert.equal(progress[storyId].bestAccuracy, 98);
  assert.equal(progress[storyId].replayChapter, 1, 'A completed first reread chapter keeps the next chapter bookmark');
});

test('invalid, unknown, or out-of-order story results do not advance the bookmark', () => {
  const base = { mode: 'story', storyId: STORIES[0].id, chapterIndex: 0, accuracy: 100 };
  for (const result of [null, {}, { ...base, mode: 'custom' }, { ...base, storyId: '__proto__' }, { ...base, chapterIndex: -1 }, { ...base, chapterIndex: 3 }, { ...base, chapterIndex: 0.5 }, { ...base, chapterIndex: 1 }]) {
    assert.deepEqual(applyStoryResult({}, result), {});
  }
});

test('import sanitization verifies ids, finite counters, dates, and bounds', () => {
  const first = STORIES[0].id;
  const second = STORIES[1].id;
  const third = STORIES[2].id;
  const value = {
    [first]: { completedChapters: 999, bestAccuracy: 120, attempts: 10000001, lastPracticed: '2026-10-21T12:00:00Z', extra: true },
    [second]: { completedChapters: -2, bestAccuracy: NaN, attempts: Infinity, lastPracticed: 'bad-date' },
    [third]: { completedChapters: 1.9, bestAccuracy: '99', attempts: 2.7 },
    invented: { completedChapters: 3 },
  };
  assert.deepEqual(sanitizeStoryProgress(value), {
    [first]: { completedChapters: 3, bestAccuracy: 100, attempts: 1000000, lastPracticed: '2026-10-21T12:00:00.000Z' },
    [second]: { completedChapters: 0, bestAccuracy: 0, attempts: 0, lastPracticed: '' },
    [third]: { completedChapters: 1, bestAccuracy: 0, attempts: 2, lastPracticed: '' },
  });
  for (const invalid of [null, [], 'text', 42]) assert.deepEqual(sanitizeStoryProgress(invalid), {});
  assert.deepEqual(sanitizeStoryProgress(Object.create({ [first]: value[first] })), {});
});

test('bookmarks round trip and result counters remain capped', () => {
  const storyId = STORIES[0].id;
  const progress = { [storyId]: { completedChapters: 3, bestAccuracy: 100, attempts: 1000000, lastPracticed: '2026-10-21T12:00:00.000Z' } };
  assert.deepEqual(sanitizeStoryProgress(JSON.parse(JSON.stringify(progress))), progress);
  assert.deepEqual(applyStoryResult(progress, { mode: 'story', storyId, chapterIndex: 0, accuracy: -20, date: 'bad' }), {
    [storyId]: { ...progress[storyId], replayChapter: 1 },
  });
});

test('chapter-boundary reread bookmarks survive validation and clear when the reread ends', () => {
  const storyId = STORIES[0].id;
  const result = { mode: 'story', storyId, accuracy: 96, date: '2026-10-22T12:00:00.000Z' };
  let progress = {};
  for (let chapterIndex = 0; chapterIndex < 3; chapterIndex++) {
    progress = applyStoryResult(progress, { ...result, chapterIndex });
    assert.equal(progress[storyId].replayChapter, undefined, 'The original reading uses ordinary completion progress');
  }
  const original = structuredClone(progress);
  for (let chapterIndex = 0; chapterIndex < 2; chapterIndex++) {
    progress = applyStoryResult(progress, { ...result, chapterIndex, date: `2026-10-23T12:0${chapterIndex}:00.000Z` });
    assert.equal(progress[storyId].completedChapters, 3, 'Rereading retains lifetime completion');
    assert.equal(progress[storyId].replayChapter, chapterIndex + 1);
    assert.deepEqual(sanitizeStoryProgress(JSON.parse(JSON.stringify(progress))), progress);
  }
  progress = applyStoryResult(progress, { ...result, chapterIndex: 2, date: '2026-10-23T12:02:00.000Z' });
  assert.equal(Object.hasOwn(progress[storyId], 'replayChapter'), false, 'A finished reread returns to deliberate replay');
  assert.equal(progress[storyId].completedChapters, 3);
  assert.equal(progress[storyId].attempts, 6);
  assert.equal(original[storyId].attempts, 3, 'Later reread progress leaves the earlier snapshot untouched');
});

test('reread bookmarks accept only an in-range chapter on an already completed story', () => {
  const storyId = STORIES[0].id;
  const completed = { completedChapters: 3, bestAccuracy: 100, attempts: 3, lastPracticed: '2026-10-22T12:00:00.000Z' };
  for (const replayChapter of [1, 2]) {
    assert.equal(sanitizeStoryProgress({ [storyId]: { ...completed, replayChapter } })[storyId].replayChapter, replayChapter);
  }
  for (const replayChapter of [undefined, null, 0, -1, 3, 1.5, '1', NaN, Infinity]) {
    assert.equal(Object.hasOwn(sanitizeStoryProgress({ [storyId]: { ...completed, replayChapter } })[storyId], 'replayChapter'), false);
  }
  for (const completedChapters of [0, 1, 2]) {
    assert.equal(Object.hasOwn(sanitizeStoryProgress({ [storyId]: { ...completed, completedChapters, replayChapter: 1 } })[storyId], 'replayChapter'), false);
  }
});
