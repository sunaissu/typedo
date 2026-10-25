import test from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, applyStoryResult } from '../src/stories.js';
import { createStoryDraft, restoreStorySession, sanitizeStoryDrafts } from '../src/storyDrafts.js';
import { createSession, enterKey, metrics, pauseSession, resumeSession, tick } from '../src/typing.js';

const story = STORIES[0];
const config = { mode: 'custom' };
const savedAt = '2026-10-22T09:00:00.000Z';
function partial(chapterIndex = 0) {
  const text = story.chapters[chapterIndex].text;
  let session = { ...createSession(text), runId: `partial-chapter-${chapterIndex}` };
  // An initial Shift mistake followed by a correction and more progress.
  for (const [index, key] of [text[0].toLowerCase(), 'Backspace', ...text.slice(0, 12)].entries()) {
    session = enterKey(session, key, config, 100 + index * 100);
  }
  return tick(session, config, 2000);
}

test('a partial story round trips its text, corrections, capitals, counters and time', () => {
  const session = partial();
  const before = structuredClone(session);
  const draft = createStoryDraft(story.id, 0, session, savedAt);
  assert.deepEqual(draft.keyStats.O, { attempts: 2, errors: 1 });
  const stored = sanitizeStoryDrafts(JSON.parse(JSON.stringify({ [story.id]: draft })));
  const restored = restoreStorySession(story.id, stored[story.id]);
  assert.equal(restored.status, 'ready');
  assert.equal(restored.startedAt, null);
  assert.equal(restored.runId, session.runId);
  assert.equal(restored.text, session.text);
  assert.equal(restored.typed, session.typed);
  assert.deepEqual(restored.keyStats, session.keyStats);
  assert.deepEqual(metrics(restored), metrics(session));
  assert.deepEqual(restored.samples, []);
  assert.deepEqual(session, before, 'Draft creation leaves the active session untouched');
  restored.keyStats.O.errors++;
  assert.equal(draft.keyStats.O.errors, 1, 'Resumed evidence is copied rather than shared');
});

test('restoring pauses the clock until typing and excludes time away', () => {
  const initial = partial();
  const restored = restoreStorySession(story.id, createStoryDraft(story.id, 0, initial, savedAt));
  assert.equal(tick(restored, config, 3600000), restored);
  const next = enterKey(restored, restored.text[restored.typed.length], config, 3600000);
  assert.equal(next.elapsed, initial.elapsed);
  assert.equal(next.startedAt, 3600000 - initial.elapsed);
  assert.equal(tick(next, config, 3600500).elapsed, initial.elapsed + 500);
});

test('backspacing everything still saves the mistakes and can resume', () => {
  let session = enterKey({ ...createSession(story.chapters[0].text), runId: 'backspaced-draft' }, 'x', config, 100);
  session = enterKey(session, 'Backspace', config, 500);
  const draft = createStoryDraft(story.id, 0, session, savedAt);
  assert.equal(draft.typed, '');
  assert.equal(draft.attempts, 1);
  assert.equal(draft.correctAttempts, 0);
  const restored = restoreStorySession(story.id, draft);
  assert.deepEqual(metrics(restored), metrics(session));
  assert.equal(restored.keyStats.O.errors, 1);
});

test('never-started and completed chapters never become partial drafts', () => {
  assert.equal(createStoryDraft(story.id, 0, createSession(story.chapters[0].text), savedAt), null);
  const session = partial();
  assert.equal(createStoryDraft(story.id, 0, { ...session, status: 'finished' }, savedAt), null);
  assert.equal(createStoryDraft(story.id, 0, { ...session, status: 'unknown' }, savedAt), null);
  assert.equal(createStoryDraft(story.id, 0, { ...session, typed: session.text }, savedAt), null);
  for (const index of [-1, 0.5, 3, NaN]) assert.equal(createStoryDraft(story.id, index, session, savedAt), null);
  assert.equal(createStoryDraft('missing-story', 0, session, savedAt), null);
  assert.equal(createStoryDraft(story.id, 0, session, 'bad-date'), null);
});

test('an explicit story pause keeps corrections and active time through backup and resume', () => {
  const current = partial();
  const paused = pauseSession(current, config, 2500);
  assert.equal(paused.status, 'paused');
  assert.equal(enterKey(paused, paused.text[paused.typed.length], config, 80000), paused);
  assert.equal(tick(paused, config, 80000), paused);
  const draft = createStoryDraft(story.id, 0, paused, savedAt);
  assert.ok(draft);
  const restored = restoreStorySession(story.id, JSON.parse(JSON.stringify(draft)));
  assert.equal(restored.typed, paused.typed);
  assert.equal(restored.runId, paused.runId);
  assert.deepEqual(metrics(restored), metrics(paused));
  const resumed = resumeSession(paused);
  assert.equal(resumed.status, 'ready');
  assert.equal(tick(resumed, config, 80000), resumed);
  const typed = enterKey(resumed, resumed.text[resumed.typed.length], config, 80000);
  assert.equal(typed.elapsed, paused.elapsed);
  assert.equal(typed.correctAttempts, paused.correctAttempts + 1);
  assert.equal(tick(typed, config, 80300).elapsed, paused.elapsed + 300);
});

test('invalid backup drafts are rejected rather than reset into default progress', () => {
  const valid = createStoryDraft(story.id, 0, partial(), savedAt);
  const invalid = [
    null, [], {}, { ...valid, text: `${valid.text} altered` },
    { ...valid, runId: undefined }, { ...valid, runId: '' }, { ...valid, runId: '   ' },
    { ...valid, runId: 'x'.repeat(101) }, { ...valid, runId: 123 },
    { ...valid, typed: '\u00e9' }, { ...valid, typed: 'a\nb' },
    { ...valid, typed: valid.text }, { ...valid, attempts: valid.typed.length - 1 },
    { ...valid, attempts: 2.5 }, { ...valid, attempts: Infinity },
    { ...valid, correctAttempts: valid.attempts + 1 }, { ...valid, correctAttempts: -1 },
    { ...valid, correctAttempts: valid.correctAttempts - 1 },
    { ...valid, elapsed: -1 }, { ...valid, elapsed: NaN }, { ...valid, elapsed: Infinity },
    { ...valid, updatedAt: '' }, { ...valid, updatedAt: 1000 },
    { ...valid, keyStats: [] }, { ...valid, keyStats: {} },
    { ...valid, keyStats: { ...valid.keyStats, Escape: { attempts: 1, errors: 1 } } },
    { ...valid, keyStats: { ...valid.keyStats, O: { attempts: 2, errors: 3 } } },
    { ...valid, keyStats: { ...valid.keyStats, O: { attempts: 2, errors: 0 } } },
    { ...valid, keyStats: { ...valid.keyStats, O: { attempts: 2.1, errors: 1 } } },
    { ...valid, chapterIndex: 1 },
  ];
  for (const draft of invalid) {
    assert.equal(restoreStorySession(story.id, draft), null);
    assert.deepEqual(sanitizeStoryDrafts({ [story.id]: draft }), {});
  }
  for (const value of [null, [], 'text', 3]) assert.deepEqual(sanitizeStoryDrafts(value), {});
  assert.deepEqual(sanitizeStoryDrafts({ unknown: valid }), {});
  assert.deepEqual(sanitizeStoryDrafts(Object.create({ [story.id]: valid })), {});
});

test('matching overall totals cannot disguise impossible retained key evidence', () => {
  const valid = createStoryDraft(story.id, 0, partial(), savedAt);
  const wrong = structuredClone(valid);
  // The prefix begins with a correct capital O, so its two attempts cannot both be errors.
  wrong.keyStats.O.errors++;
  wrong.correctAttempts--;
  assert.equal(restoreStorySession(story.id, wrong), null);
  // A wrong retained character needs an actual erroneous attempt for that expected key.
  const noMistake = enterKey({ ...createSession(story.chapters[0].text), runId: 'no-mistake' }, 'O', config, 100);
  const fabricated = { ...createStoryDraft(story.id, 0, noMistake, savedAt), typed: 'x' };
  assert.equal(restoreStorySession(story.id, fabricated), null);
});

test('drafts respect completed chapters and do not resurrect work older than completion', () => {
  const first = createStoryDraft(story.id, 0, partial(), savedAt);
  const second = createStoryDraft(story.id, 1, partial(1), savedAt);
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: second }), {});
  const progress = applyStoryResult({}, { mode: 'story', storyId: story.id, chapterIndex: 0, accuracy: 100, date: savedAt });
  const before = structuredClone(progress);
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: second }, progress), { [story.id]: second });
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: { ...first, updatedAt: '2026-10-22T08:59:59.999Z' } }, progress), {});
  const replay = { ...first, updatedAt: '2026-10-22T09:01:00.000Z' };
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: replay }, progress), { [story.id]: replay });
  assert.deepEqual(progress, before, 'Saving partial work does not award completed chapters');
});

test('completed run ids discard stale drafts even when timestamps match', () => {
  const draft = createStoryDraft(story.id, 0, partial(), savedAt);
  const result = { id: draft.runId, mode: 'story', storyId: story.id, chapterIndex: 0, accuracy: 100, date: savedAt };
  const progress = applyStoryResult({}, result);
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: draft }, progress, [result]), {});
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: { ...draft, runId: 'a-new-replay' } }, progress, [result]), {
    [story.id]: { ...draft, runId: 'a-new-replay' },
  });
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: draft }, {}, null), { [story.id]: draft });
});
