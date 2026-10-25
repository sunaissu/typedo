import { STORIES, sanitizeStoryProgress } from './stories.js';
import { sanitizeStoryDrafts } from './storyDrafts.js';

// Each edition has an actual date. When this calendar ends, recommend the
// existing library instead of presenting an old story as a new release.
export const STORY_SCHEDULE = [
  { startsOn: '2026-10-19', storyId: 'plant-manager' },
  { startsOn: '2026-10-26', storyId: 'duck-hotel' },
  { startsOn: '2026-11-02', storyId: 'soup-mystery' },
  { startsOn: '2026-11-09', storyId: 'printer-resignation' },
  { startsOn: '2026-11-16', storyId: 'small-dragon' },
  { startsOn: '2026-11-23', storyId: 'harbor-signal' },
  { startsOn: '2026-11-30', storyId: 'pip-cloud-route' },
  { startsOn: '2026-12-07', storyId: 'station-garden' },
];

const DAY = 24 * 60 * 60 * 1000;
const dateNumber = value => Date.parse(`${value}T00:00:00Z`);
const dateKey = value => new Date(value).toISOString().slice(0, 10);

export function localCalendarDate(date = new Date()) {
  const valid = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  return `${valid.getFullYear()}-${String(valid.getMonth() + 1).padStart(2, '0')}-${String(valid.getDate()).padStart(2, '0')}`;
}

export function formatStoryDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(dateNumber(value)));
}

export function getStoryFeature(progress, now = new Date(), storyDrafts = {}) {
  const bookmarks = sanitizeStoryProgress(progress);
  const drafts = sanitizeStoryDrafts(storyDrafts, bookmarks);
  const today = localCalendarDate(now);
  const day = dateNumber(today);
  const weekDay = new Date(day).getUTCDay();
  const weekStart = dateKey(day - ((weekDay + 6) % 7) * DAY);
  const weekEnd = dateKey(dateNumber(weekStart) + 6 * DAY);
  const edition = STORY_SCHEDULE.find(item => day >= dateNumber(item.startsOn) && day < dateNumber(item.startsOn) + 7 * DAY);
  const scheduledStory = edition && STORIES.find(story => story.id === edition.storyId);
  // Pick up a book already in progress before recommending an untouched one.
  const unfinished = STORIES.filter(story => (bookmarks[story.id]?.completedChapters || 0) < story.chapters.length);
  const resumable = STORIES.filter(story => drafts[story.id] || bookmarks[story.id]?.replayChapter !== undefined || unfinished.includes(story));
  const chooseNext = stories => stories.find(item => drafts[item.id]) || stories.find(item => bookmarks[item.id]?.replayChapter !== undefined) || stories.find(item => bookmarks[item.id]?.completedChapters > 0) || stories[0] || null;
  const story = scheduledStory || chooseNext(resumable);
  const nextStory = chooseNext(resumable.filter(item => item.id !== story?.id));
  const completedChapters = story ? bookmarks[story.id]?.completedChapters || 0 : 0;
  const complete = story ? completedChapters === story.chapters.length : false;
  return {
    kind: scheduledStory ? 'scheduled' : 'archive',
    today, weekStart, weekEnd, story, completedChapters, complete,
    hasDraft: Boolean(story && drafts[story.id]),
    route: story ? drafts[story.id]?.route ?? bookmarks[story.id]?.route : undefined,
    hasReplay: Boolean(story && bookmarks[story.id]?.replayChapter !== undefined),
    nextChapterIndex: story ? drafts[story.id]?.chapterIndex ?? bookmarks[story.id]?.replayChapter ?? (!complete ? completedChapters : null) : null,
    nextStory,
    nextStoryHasDraft: Boolean(nextStory && drafts[nextStory.id]),
    nextStoryChapterIndex: nextStory ? drafts[nextStory.id]?.chapterIndex ?? bookmarks[nextStory.id]?.replayChapter ?? bookmarks[nextStory.id]?.completedChapters ?? 0 : null,
    allComplete: unfinished.length === 0,
    chapterDates: scheduledStory ? story.chapters.map((_, index) => dateKey(dateNumber(edition.startsOn) + index * DAY)) : [],
  };
}
