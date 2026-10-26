import test from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, applyStoryResult } from '../src/stories.js';
import { emptyProgress, mergeProgress, readProgress, validateProgress, writeProgress } from '../src/storage.js';

const story = STORIES[0];
const result = {
  id: 'story-chapter', date: '2026-10-21T12:00:00.000Z', mode: 'story',
  storyId: story.id, chapterIndex: 0, label: `${story.title} / chapter 1`, category: `story:${story.id}`,
  elapsed: 120000, wpm: 40, raw: 41, accuracy: 98, errors: 2, correct: story.chapters[0].text.length,
};
const draft = {
  runId: 'draft-example', chapterIndex: 0, text: story.chapters[0].text, typed: 'On ',
  attempts: 4, correctAttempts: 3, keyStats: { O: { attempts: 2, errors: 1 }, n: { attempts: 1, errors: 0 }, ' ': { attempts: 1, errors: 0 } },
  elapsed: 12345, updatedAt: '2026-10-22T10:00:00.000Z',
};

test('story history and bookmarks survive app storage and exported backup validation', async () => {
  const progress = { ...emptyProgress(), history: [result], storyProgress: applyStoryResult({}, result) };
  let saved;
  const storage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  assert.equal((await writeProgress(storage, progress)), '');
  const reloaded = (await readProgress(storage));
  assert.equal(reloaded.warning, '');
  assert.deepEqual(reloaded.progress.history, [result]);
  assert.deepEqual(reloaded.progress.storyProgress, progress.storyProgress);
  assert.deepEqual(validateProgress(JSON.parse(saved)), reloaded.progress);
});

test('backup history rejects unknown stories and invalid chapter indexes while older backups still load', () => {
  const backup = emptyProgress();
  backup.history = [
    result,
    { ...result, id: 'unknown', storyId: 'unknown-story' },
    { ...result, id: 'negative', chapterIndex: -1 },
    { ...result, id: 'outside', chapterIndex: story.chapters.length },
    { ...result, id: 'fraction', chapterIndex: 0.5 },
    { ...result, id: 'string', chapterIndex: '1' },
  ];
  assert.deepEqual(validateProgress(backup).history, [result]);
  delete backup.storyProgress;
  backup.history = [];
  assert.deepEqual(validateProgress(backup).storyProgress, {}, 'A backup made before Stories remains usable');
});

test('partial story drafts round trip without counting unfinished typing as completed progress', async () => {
  const progress = { ...emptyProgress(), storyDrafts: { [story.id]: draft } };
  let saved;
  const storage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  assert.equal((await writeProgress(storage, progress)), '');
  const reloaded = (await readProgress(storage));
  assert.equal(reloaded.warning, '');
  assert.deepEqual(reloaded.progress.storyDrafts, { [story.id]: draft });
  assert.deepEqual(reloaded.progress.history, []);
  assert.deepEqual(reloaded.progress.keyStats, {});
  assert.deepEqual(reloaded.progress.storyProgress, {});
  assert.deepEqual(validateProgress(JSON.parse(saved)).storyDrafts, { [story.id]: draft });
  const legacy = { ...emptyProgress() };
  delete legacy.storyDrafts;
  assert.deepEqual(validateProgress(legacy).storyDrafts, {}, 'Backups made before partial saving remain readable');
});

test('backup validation discards invalid partial stories instead of resuming corrupted counters or content', () => {
  const invalid = [
    { runId: '' }, { runId: 5 }, { chapterIndex: -1 }, { chapterIndex: 0.5 }, { chapterIndex: story.chapters.length },
    { text: 'Replaced chapter text.' }, { typed: story.chapters[0].text }, { typed: '\u00e9' },
    { attempts: -1 }, { attempts: 0.5 }, { correctAttempts: 5 }, { elapsed: -1 }, { elapsed: Infinity },
    { updatedAt: 'invalid date' }, { keyStats: {} },
    { keyStats: { O: { attempts: 4, errors: 1 } } },
    { keyStats: { ...draft.keyStats, n: { attempts: 1, errors: 2 } } },
  ];
  for (const patch of invalid) {
    const progress = { ...emptyProgress(), storyDrafts: { [story.id]: { ...draft, ...patch } } };
    assert.deepEqual(validateProgress(progress).storyDrafts, {}, `Invalid draft rejected: ${JSON.stringify(patch)}`);
  }
  const unknown = { ...emptyProgress(), storyDrafts: { unknown: draft } };
  assert.deepEqual(validateProgress(unknown).storyDrafts, {});
  const skipped = { ...emptyProgress(), storyDrafts: { [story.id]: {
    ...draft, chapterIndex: 1, text: story.chapters[1].text, typed: 'B', attempts: 1, correctAttempts: 1, keyStats: { B: { attempts: 1, errors: 0 } },
  } } };
  assert.deepEqual(validateProgress(skipped).storyDrafts, {}, 'A draft cannot bypass an unread chapter');
});

test('an empty typed position retains previous errors after backspacing', () => {
  const backedUp = { ...draft, typed: '', attempts: 1, correctAttempts: 0, keyStats: { O: { attempts: 1, errors: 1 } } };
  const progress = { ...emptyProgress(), storyDrafts: { [story.id]: backedUp } };
  assert.deepEqual(validateProgress(progress).storyDrafts, { [story.id]: backedUp });
});

test('restoring drafts keeps the newest checkpoint and never resurrects an already completed run', () => {
  const earlier = { ...draft, runId: 'old-draft', updatedAt: '2026-10-21T10:00:00.000Z' };
  const current = { ...emptyProgress(), storyDrafts: { [story.id]: draft } };
  const backup = { ...emptyProgress(), storyDrafts: { [story.id]: earlier } };
  assert.deepEqual(mergeProgress(current, backup).storyDrafts, current.storyDrafts, 'Older backup cannot replace a newer local checkpoint');
  assert.deepEqual(mergeProgress(backup, current).storyDrafts, current.storyDrafts, 'A newer imported checkpoint is restored');
  assert.deepEqual(mergeProgress(current, current).storyDrafts, current.storyDrafts, 'Repeated restore is idempotent');

  const completed = { ...emptyProgress(), history: [{ ...result, id: draft.runId, date: draft.updatedAt }], storyProgress: { [story.id]: { completedChapters: 1, attempts: 1, lastPracticed: draft.updatedAt } } };
  assert.deepEqual(mergeProgress(current, completed).storyDrafts, {}, 'Same-millisecond completion wins over its partial draft');
  assert.deepEqual(mergeProgress(completed, current).storyDrafts, {}, 'An old exported draft cannot reopen the completed run');
  const laterDatedDuplicate = { ...current, storyDrafts: { [story.id]: { ...draft, updatedAt: '2026-10-23T10:00:00.000Z' } } };
  assert.deepEqual(mergeProgress(completed, laterDatedDuplicate).storyDrafts, {}, 'Completion identity wins even if the draft timestamp is later');
  const replay = { ...current, storyDrafts: { [story.id]: { ...draft, runId: 'new-replay', updatedAt: '2026-10-23T10:00:00.000Z' } } };
  assert.equal(mergeProgress(completed, replay).storyDrafts[story.id].runId, 'new-replay', 'A deliberate newer replay is still resumable');
});

test('restoring reread bookmarks uses the latest chapter boundary or completed reread', () => {
  const completedRecord = { completedChapters: story.chapters.length, attempts: 3, bestAccuracy: 100, lastPracticed: '2026-10-20T10:00:00.000Z' };
  const completed = { ...emptyProgress(), storyProgress: { [story.id]: completedRecord } };
  const rereading = { ...emptyProgress(), storyProgress: { [story.id]: { ...completedRecord, attempts: 4, replayChapter: 1, lastPracticed: '2026-10-21T10:00:00.000Z' } } };
  const finishedAgain = { ...emptyProgress(), storyProgress: { [story.id]: { ...completedRecord, attempts: 6, lastPracticed: '2026-10-22T10:00:00.000Z' } } };
  for (const [current, backup] of [[completed, rereading], [rereading, completed]]) {
    const merged = mergeProgress(current, backup);
    assert.equal(merged.storyProgress[story.id].replayChapter, 1, 'A newer reread resumes at its next chapter');
    assert.equal(merged.storyProgress[story.id].completedChapters, story.chapters.length, 'Lifetime completion credit stays intact');
    assert.equal(validateProgress(JSON.parse(JSON.stringify(merged))).storyProgress[story.id].replayChapter, 1, 'The reread bookmark survives export and validation');
  }
  for (const [current, backup] of [[rereading, finishedAgain], [finishedAgain, rereading]]) {
    assert.equal(mergeProgress(current, backup).storyProgress[story.id].replayChapter, undefined, 'A newer final completion clears an older reread bookmark');
  }
  assert.deepEqual(mergeProgress(rereading, rereading).storyProgress, rereading.storyProgress, 'Repeated restore is idempotent');
});
