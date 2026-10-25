import test from 'node:test';
import assert from 'node:assert/strict';
import { STORIES } from '../src/stories.js';
import { createSession, enterKey } from '../src/typing.js';
import { createStoryDraft } from '../src/storyDrafts.js';
import { STORY_SCHEDULE, formatStoryDate, getStoryFeature, localCalendarDate } from '../src/storySchedule.js';

const localDate = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute);
const bookmark = completedChapters => ({ completedChapters, bestAccuracy: 100, attempts: completedChapters });
const partialDraft = (storyId, chapterIndex = 0) => {
  const text = STORIES.find(story => story.id === storyId).chapters[chapterIndex].text;
  let session = { ...createSession(text), runId: `draft-${storyId}-${chapterIndex}` };
  for (const key of text.slice(0, 7)) session = enterKey(session, key, { mode: 'custom' }, 100);
  return createStoryDraft(storyId, chapterIndex, session, '2026-10-22T10:00:00.000Z');
};

test('every scheduled week names a real, distinct story and a Monday edition date', () => {
  assert.equal(STORY_SCHEDULE.length, 8);
  assert.equal(new Set(STORY_SCHEDULE.map(edition => edition.storyId)).size, STORY_SCHEDULE.length);
  let lastStart = null;
  for (const edition of STORY_SCHEDULE) {
    assert.ok(STORIES.some(story => story.id === edition.storyId));
    const starts = new Date(`${edition.startsOn}T00:00:00Z`);
    assert.equal(starts.getUTCDay(), 1);
    if (lastStart !== null) assert.equal(starts.getTime() - lastStart, 7 * 24 * 60 * 60 * 1000);
    lastStart = starts.getTime();
    const [year, month, day] = edition.startsOn.split('-').map(Number);
    const feature = getStoryFeature({}, localDate(year, month, day));
    assert.equal(feature.kind, 'scheduled');
    assert.equal(feature.story.id, edition.storyId);
    assert.equal(feature.weekStart, edition.startsOn);
  }
});

test('weekly feature changes at local Monday midnight, including the final edition', () => {
  const sunday = getStoryFeature({}, localDate(2026, 10, 25, 23, 59));
  assert.equal(sunday.story.id, 'plant-manager');
  assert.equal(sunday.weekEnd, '2026-10-25');
  const monday = getStoryFeature({}, localDate(2026, 10, 26, 0, 0));
  assert.equal(monday.story.id, 'duck-hotel');
  assert.equal(monday.weekStart, '2026-10-26');
  assert.equal(monday.weekEnd, '2026-11-01');
  assert.equal(getStoryFeature({}, localDate(2026, 11, 22, 23, 59)).story.id, 'small-dragon');
  assert.equal(getStoryFeature({}, localDate(2026, 11, 23, 0, 0)).story.id, 'harbor-signal');
  assert.equal(getStoryFeature({}, localDate(2026, 12, 13, 23, 59)).story.id, 'station-garden');
  assert.equal(getStoryFeature({}, localDate(2026, 12, 14, 0, 0)).kind, 'archive');
});

test('suggested daily dates never skip unread chapters or impose a waiting period', () => {
  for (let day = 19; day <= 25; day++) {
    const feature = getStoryFeature({}, localDate(2026, 10, day));
    assert.equal(feature.nextChapterIndex, 0, 'Even a late arrival begins at chapter one');
    assert.deepEqual(feature.chapterDates, ['2026-10-19', '2026-10-20', '2026-10-21']);
  }
  const ahead = getStoryFeature({ 'plant-manager': bookmark(2) }, localDate(2026, 10, 19));
  assert.equal(ahead.nextChapterIndex, 2, 'Finishing early immediately offers the next chapter');
  const behind = getStoryFeature({ 'plant-manager': bookmark(1) }, localDate(2026, 10, 25));
  assert.equal(behind.nextChapterIndex, 1, 'A saved bookmark takes priority over the suggested date');
});

test('finishing the weekly story suggests another unread bookmark without replaying it', () => {
  const feature = getStoryFeature({ 'plant-manager': bookmark(3), 'soup-mystery': bookmark(1) }, localDate(2026, 10, 21));
  assert.equal(feature.story.id, 'plant-manager');
  assert.equal(feature.complete, true);
  assert.equal(feature.nextChapterIndex, null);
  assert.equal(feature.nextStory.id, 'soup-mystery');
  assert.equal(feature.nextStoryChapterIndex, 1);
});

test('dates outside the finite calendar recommend the archive instead of recycled editions', () => {
  const progress = { 'duck-hotel': bookmark(2) };
  for (const date of [localDate(2026, 10, 18), localDate(2026, 12, 14), localDate(2034, 1, 1)]) {
    const feature = getStoryFeature(progress, date);
    assert.equal(feature.kind, 'archive');
    assert.equal(feature.story.id, 'duck-hotel', 'An in-progress story comes before an untouched one');
    assert.equal(feature.nextChapterIndex, 2);
    assert.deepEqual(feature.chapterDates, []);
  }
  const newYear = getStoryFeature({}, localDate(2027, 1, 1));
  assert.equal(newYear.weekStart, '2026-12-28');
  assert.equal(newYear.weekEnd, '2027-01-03');
});

test('finishing the collection has a stable completed state before and after the schedule', () => {
  const progress = Object.fromEntries(STORIES.map(story => [story.id, bookmark(story.chapters.length)]));
  const scheduled = getStoryFeature(progress, localDate(2026, 11, 11));
  assert.equal(scheduled.allComplete, true);
  assert.equal(scheduled.complete, true);
  assert.equal(scheduled.nextChapterIndex, null);
  assert.equal(scheduled.nextStory, null);
  const archived = getStoryFeature(progress, localDate(2027, 1, 5));
  assert.equal(archived.allComplete, true);
  assert.equal(archived.story, null);
  assert.equal(archived.nextChapterIndex, null);
  assert.equal(archived.nextStory, null);
});

test('calendar labels preserve the local date and authored dates display without timezone shifts', () => {
  assert.equal(localCalendarDate(localDate(2026, 10, 19, 0, 1)), '2026-10-19');
  assert.equal(localCalendarDate(localDate(2026, 10, 19, 23, 59)), '2026-10-19');
  assert.equal(formatStoryDate('2026-10-19'), 'Oct 19');
  assert.equal(formatStoryDate('2026-10-19', { weekday: 'long' }), 'Monday');
  assert.equal(getStoryFeature({ 'plant-manager': bookmark(500) }, localDate(2026, 10, 19)).nextChapterIndex, null);
});

test('weekly recommendations resume a partial first chapter instead of skipping to the suggested day', () => {
  const draft = partialDraft('plant-manager');
  const feature = getStoryFeature({}, localDate(2026, 10, 25), { 'plant-manager': draft });
  assert.equal(feature.hasDraft, true);
  assert.equal(feature.nextChapterIndex, 0);
  assert.equal(feature.completedChapters, 0);
  assert.equal(feature.complete, false);
});

test('replay drafts remain resumable without removing completed story credit', () => {
  const progress = { 'plant-manager': bookmark(3) };
  const drafts = { 'plant-manager': partialDraft('plant-manager', 1) };
  const feature = getStoryFeature(progress, localDate(2026, 10, 25), drafts);
  assert.equal(feature.complete, true);
  assert.equal(feature.hasDraft, true);
  assert.equal(feature.nextChapterIndex, 1);
  assert.equal(feature.completedChapters, 3);
});

test('archive and follow-on recommendations prioritize a partial chapter', () => {
  const progress = { 'plant-manager': bookmark(3), 'duck-hotel': bookmark(1) };
  const drafts = { 'soup-mystery': partialDraft('soup-mystery') };
  const featured = getStoryFeature(progress, localDate(2026, 10, 25), drafts);
  assert.equal(featured.nextStory.id, 'soup-mystery');
  assert.equal(featured.nextStoryHasDraft, true);
  assert.equal(featured.nextStoryChapterIndex, 0);
  const archive = getStoryFeature(progress, localDate(2027, 1, 2), drafts);
  assert.equal(archive.story.id, 'soup-mystery');
  assert.equal(archive.hasDraft, true);
  assert.equal(archive.nextChapterIndex, 0);
});

test('a future-chapter draft cannot skip unread chapters', () => {
  const feature = getStoryFeature({}, localDate(2026, 10, 25), { 'plant-manager': partialDraft('plant-manager', 2) });
  assert.equal(feature.hasDraft, false);
  assert.equal(feature.nextChapterIndex, 0);
});

test('a completed collection can resume an explicitly started reread in the archive', () => {
  const progress = Object.fromEntries(STORIES.map(story => [story.id, bookmark(story.chapters.length)]));
  const feature = getStoryFeature(progress, localDate(2027, 1, 2), { 'duck-hotel': partialDraft('duck-hotel') });
  assert.equal(feature.allComplete, true);
  assert.equal(feature.story.id, 'duck-hotel');
  assert.equal(feature.hasDraft, true);
  assert.equal(feature.nextChapterIndex, 0);
});

test('weekly and archive features resume chapter-boundary rereads without replaying chapter one', () => {
  const progress = { 'plant-manager': { ...bookmark(3), replayChapter: 1 } };
  for (const date of [localDate(2026, 10, 25), localDate(2027, 1, 2)]) {
    const feature = getStoryFeature(progress, date);
    assert.equal(feature.story.id, 'plant-manager');
    assert.equal(feature.complete, true);
    assert.equal(feature.hasDraft, false);
    assert.equal(feature.hasReplay, true);
    assert.equal(feature.nextChapterIndex, 1);
  }
  const draft = partialDraft('plant-manager', 2);
  const feature = getStoryFeature(progress, localDate(2026, 10, 25), { 'plant-manager': draft });
  assert.equal(feature.nextChapterIndex, 2, 'An unfinished chapter takes priority over a chapter-boundary bookmark');
});

test('follow-on features and completed archives can resume a reread at its chapter boundary', () => {
  const progress = Object.fromEntries(STORIES.map(story => [story.id, bookmark(story.chapters.length)]));
  progress['duck-hotel'].replayChapter = 2;
  const featured = getStoryFeature(progress, localDate(2026, 10, 25));
  assert.equal(featured.nextStory.id, 'duck-hotel');
  assert.equal(featured.nextStoryChapterIndex, 2);
  const archive = getStoryFeature(progress, localDate(2027, 1, 2));
  assert.equal(archive.allComplete, true);
  assert.equal(archive.story.id, 'duck-hotel');
  assert.equal(archive.hasReplay, true);
  assert.equal(archive.nextChapterIndex, 2);
  delete progress['duck-hotel'].replayChapter;
  assert.equal(getStoryFeature(progress, localDate(2027, 1, 2)).story, null, 'A completed reread no longer appears as unfinished');
});
