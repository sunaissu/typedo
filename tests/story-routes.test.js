import test from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, applyStoryResult, getStoryChapter, sanitizeStoryProgress, storyRoute, storyWordCount } from '../src/stories.js';
import { createStoryDraft, restoreStorySession, sanitizeStoryDrafts } from '../src/storyDrafts.js';
import { createSession, enterKey, pauseSession, resumeSession } from '../src/typing.js';
import { emptyProgress, mergeProgress, validateProgress } from '../src/storage.js';

const story = STORIES.find(item => item.id === 'pip-cloud-route');
const config = { mode: 'custom' };
const date = '2026-10-25T12:00:00.000Z';
const progress = { [story.id]: { completedChapters: 2, attempts: 2, bestAccuracy: 100, lastPracticed: '2026-10-25T11:00:00.000Z' } };
function choiceSession(route) { return { ...createSession(getStoryChapter(story, 2, route).text), runId: `choice-${route}`, route }; }

test('both optional endings are complete authored passages and the existing text is the default route', () => {
  assert.equal(storyRoute(story), 'stars');
  assert.equal(storyRoute(story, 'invented'), undefined);
  assert.equal(getStoryChapter(story, 2, 'stars'), story.chapters[2]);
  assert.notEqual(getStoryChapter(story, 2, 'trail').text, story.chapters[2].text);
  for (const route of story.choice.routes) {
    const chapter = getStoryChapter(story, 2, route.id);
    assert.match(chapter.text, /^[\x20-\x7e]+$/);
    assert.match(chapter.text, /[.!?]"?$/);
    assert.ok(chapter.text.includes('"'));
    assert.ok(chapter.text.length < 1500);
    assert.ok(storyWordCount(story, route.id) >= 250 && storyWordCount(story, route.id) <= 450);
    assert.equal(getStoryChapter(story, 0, route.id), story.chapters[0]);
  }
});

test('a choice persists before typing without giving any completed chapter or session credit', () => {
  const draft = createStoryDraft(story.id, 2, choiceSession('trail'), date);
  assert.ok(draft);
  assert.equal(draft.route, 'trail');
  assert.equal(draft.attempts, 0);
  const before = structuredClone(progress);
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: draft }, progress), { [story.id]: draft });
  assert.deepEqual(progress, before);
  assert.deepEqual(sanitizeStoryDrafts({ [story.id]: draft }, {}), {}, 'A route choice cannot skip the first two chapters');
  const backup = validateProgress({ ...emptyProgress(), storyProgress: progress, storyDrafts: { [story.id]: draft } });
  assert.equal(backup.history.length, 0);
  assert.equal(backup.storyProgress[story.id].completedChapters, 2);
  assert.equal(backup.storyDrafts[story.id].route, 'trail');
});

test('route-specific drafts preserve mistakes and pause time and reject mismatched passage identities', () => {
  let session = choiceSession('trail');
  session = enterKey(session, 'x', config, 100);
  session = enterKey(session, 'Backspace', config, 200);
  session = enterKey(session, session.text[0], config, 300);
  session = pauseSession(session, config, 1000);
  const draft = createStoryDraft(story.id, 2, session, date);
  const restored = restoreStorySession(story.id, JSON.parse(JSON.stringify(draft)));
  assert.equal(restored.route, 'trail');
  assert.equal(restored.typed, session.typed);
  assert.equal(restored.attempts, 2);
  assert.equal(restored.correctAttempts, 1);
  assert.equal(restored.elapsed, 900);
  const continued = enterKey(resumeSession(restored), restored.text[1], config, 50000);
  assert.equal(continued.elapsed, 900);
  assert.equal(continued.route, 'trail');
  for (const invalid of [{ ...draft, route: 'stars' }, { ...draft, route: 'unknown' }, { ...draft, route: undefined }, { ...draft, chapterIndex: 1 }]) assert.equal(restoreStorySession(story.id, invalid), null);
  const empty = choiceSession('trail');
  assert.equal(createStoryDraft(story.id, 2, { ...empty, elapsed: 1 }, date), null);
  assert.equal(createStoryDraft(story.id, 2, { ...empty, correctAttempts: 1 }, date), null);
});

test('legacy final-chapter drafts use their original default ending and explicit unsupported choices are not accepted', () => {
  let session = { ...createSession(story.chapters[2].text), runId: 'legacy-story-run' };
  session = enterKey(session, session.text[0], config, 100);
  const saved = createStoryDraft(story.id, 2, session, date);
  assert.equal(saved.route, 'stars');
  assert.equal(restoreStorySession(story.id, { ...saved, route: undefined }).route, 'stars');
  const untouched = { ...createSession(story.chapters[2].text), runId: 'not-a-choice' };
  assert.equal(createStoryDraft(story.id, 2, untouched, date), null);
  assert.deepEqual(applyStoryResult(progress, { mode: 'story', storyId: story.id, chapterIndex: 2, route: 'bad', date, accuracy: 100 }), sanitizeStoryProgress(progress));
});

test('completed branch history, progress and draft identity survive backups without resurrecting the completed run', () => {
  const result = { id: 'choice-trail', mode: 'story', storyId: story.id, chapterIndex: 2, route: 'trail', date,
    label: 'Pip / chapter 3', category: `story:${story.id}`, wpm: 40, raw: 40, accuracy: 100, elapsed: 90000, errors: 0, correct: getStoryChapter(story, 2, 'trail').text.length };
  const completed = applyStoryResult(progress, result);
  assert.equal(completed[story.id].route, 'trail');
  assert.equal(completed[story.id].completedChapters, 3);
  const backup = validateProgress({ ...emptyProgress(), history: [result], storyProgress: completed, storyDrafts: { [story.id]: createStoryDraft(story.id, 2, choiceSession('trail'), date) } });
  assert.equal(backup.history[0].route, 'trail');
  assert.equal(backup.storyProgress[story.id].route, 'trail');
  assert.deepEqual(backup.storyDrafts, {});
  const replay = applyStoryResult(completed, { ...result, id: 'reread-start', chapterIndex: 0, route: undefined, date: '2026-10-26T12:00:00.000Z' });
  assert.equal(replay[story.id].route, undefined, 'An explicit reread offers a new choice after its common chapters');
  assert.equal(replay[story.id].completedChapters, 3);
  assert.equal(replay[story.id].replayChapter, 1);
});

test('backup merge uses the newest chosen ending while keeping completed credit', () => {
  const make = (route, lastPracticed) => ({ ...emptyProgress(), storyProgress: { [story.id]: { completedChapters: 3, bestAccuracy: 99, attempts: 3, lastPracticed, route } } });
  const current = make('trail', '2026-10-26T12:00:00.000Z');
  const incoming = make('stars', '2026-10-25T12:00:00.000Z');
  assert.equal(mergeProgress(current, incoming).storyProgress[story.id].route, 'trail');
  assert.equal(mergeProgress(incoming, current).storyProgress[story.id].route, 'trail');
  const replay = { ...current, storyProgress: { [story.id]: { ...current.storyProgress[story.id], route: undefined, replayChapter: 1, lastPracticed: '2026-10-27T12:00:00.000Z' } } };
  assert.equal(mergeProgress(current, replay).storyProgress[story.id].route, undefined);
  assert.equal(mergeProgress(current, replay).storyProgress[story.id].completedChapters, 3);
});
