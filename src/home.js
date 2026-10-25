import { LESSON_COURSE, lessonPracticeComplete } from './lessons.js';
import { STORIES } from './stories.js';
import { getDueLessonReviews } from './lessonLearning.js';

export const localDateKey = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function draftPosition(draft) {
  const text = draft.text || draft.session?.text || '';
  const typed = draft.typed ?? draft.session?.typed ?? '';
  return text.length ? `${Math.min(typed.length, text.length)} of ${text.length} characters` : 'Your place is kept';
}

export function getHomeDrafts(progress = {}) {
  const candidates = [];
  for (const [id, draft] of Object.entries(progress.lessonDrafts || {})) {
    const lessonId = draft.lessonId || id;
    const lesson = LESSON_COURSE.find(item => item.id === lessonId);
    if (!lesson) continue;
    const block = Math.min(3, Math.max(1, (draft.roundIndex ?? draft.practiceRound ?? 0) + 1));
    candidates.push({ view: 'lessons', id: lessonId, draft: true, updatedAt: draft.updatedAt, title: lesson.title, detail: `${draft.stage === 'test' ? 'Optional check' : `Block ${block} of 3`} · ${draftPosition(draft)}`, reason: 'Continue your most recent unfinished activity.', action: 'Continue lesson' });
  }
  for (const [id, draft] of Object.entries(progress.storyDrafts || {})) {
    const story = STORIES.find(item => item.id === id);
    if (!story) continue;
    candidates.push({ view: 'stories', id, draft: true, updatedAt: draft.updatedAt, title: story.title, detail: `Chapter ${(draft.chapterIndex || 0) + 1} of ${story.chapters.length} · ${draftPosition(draft)}`, reason: 'Continue your most recent unfinished activity.', action: 'Continue story' });
  }
  for (const [id, draft] of Object.entries(progress.workspaceDrafts || (progress.workspaceDraft ? { workspace: progress.workspaceDraft } : {}))) {
    const config = draft.config || draft.settings || {};
    const title = config.mode === 'custom' ? 'Your custom passage' : config.mode === 'practice' ? 'Focused practice' : config.mode === 'words' ? `${config.wordCount || 25}-word practice` : `${config.duration || 30}-second test practice`;
    const passage = config.mode === 'custom' ? (progress.savedPassages || []).find(passage => passage.text === draft.text) : null;
    const preview = config.mode === 'custom' && typeof draft.text === 'string' ? draft.text.slice(0, 90) + (draft.text.length > 90 ? '…' : '') : '';
    candidates.push({ view: 'type', id, draft: true, updatedAt: draft.updatedAt, title: passage?.title || title, detail: draftPosition(draft), preview, reason: ['time', 'words'].includes(config.mode) ? 'Resume as practice. A fresh test is needed for a personal best.' : 'Continue your most recent unfinished activity.', action: 'Resume typing' });
  }
  return candidates.filter(item => Number.isFinite(Date.parse(item.updatedAt))).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || `${a.view}:${a.id}`.localeCompare(`${b.view}:${b.id}`));
}

export function getHomeRecommendation(progress = {}, now = new Date()) {
  const latest = getHomeDrafts(progress)[0];
  if (latest) return latest;
  const due = getDueLessonReviews(progress.lessonLearning || {}, progress.lessonProgress || {}, now)[0];
  if (due) return { view: 'lessons', id: due.lessonId, review: true, title: LESSON_COURSE.find(item => item.id === due.lessonId)?.title || 'Lesson review', detail: 'A short review is ready', reason: 'Revisit a lesson you have already practised. Your completed credit stays yours.', action: 'Review lesson' };
  const next = LESSON_COURSE.find(lesson => !lessonPracticeComplete(progress.lessonProgress?.[lesson.id]));
  if (next) return { view: 'lessons', id: next.id, title: next.title, detail: `Block ${Math.min(3, (progress.lessonProgress?.[next.id]?.practiceRounds || 0) + 1)} of 3 · No time limit`, reason: Object.keys(progress.lessonProgress || {}).length ? 'Your next step in the course. Finger hints are available whenever you need them.' : 'Start with familiar words and a guide to the right fingers.', action: Object.keys(progress.lessonProgress || {}).length ? 'Continue learning' : 'Start your first lesson' };
  return { view: 'stories', title: 'Choose your next story', detail: 'The guided course is complete', reason: 'Keep practising with a chapter, or revisit any lesson.', action: 'Explore stories' };
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function getComparableSummary(history = []) {
  const groups = new Map();
  const unique = [...new Map(history.filter(run => run && typeof run.id === 'string').map(run => [run.id, run])).values()];
  for (const run of unique) {
    if (!['time', 'words'].includes(run.mode) || run.interrupted || !Number.isFinite(Date.parse(run.date)) || typeof run.category !== 'string' || !run.category.startsWith(`${run.mode}:`) || !Number.isFinite(run.wpm) || !Number.isFinite(run.accuracy)) continue;
    if (!groups.has(run.category)) groups.set(run.category, []);
    groups.get(run.category).push(run);
  }
  const group = [...groups.values()].filter(runs => runs.length >= 3).map(runs => runs.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))).sort((a, b) => Date.parse(b[0].date) - Date.parse(a[0].date))[0];
  if (!group) return null;
  const recent = group.slice(0, 3);
  const previous = group.slice(3, 6);
  return { label: group[0].label || 'matching tests', category: group[0].category, count: group.length, recentCount: recent.length, wpm: median(recent.map(run => run.wpm)), accuracy: median(recent.map(run => run.accuracy)), accuracyChange: previous.length === 3 ? median(recent.map(run => run.accuracy)) - median(previous.map(run => run.accuracy)) : null };
}

export function getPracticeSummary(progress = {}, now = new Date()) {
  const today = localDateKey(now);
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { key: localDateKey(date), label: date.toLocaleDateString(undefined, { weekday: 'short' }), practiced: false, today: localDateKey(date) === today };
  });
  let todayMs = 0;
  let weekMs = 0;
  let chapters = 0;
  let sessions = 0;
  const unique = new Map((progress.history || []).filter(run => run && typeof run.id === 'string').map(run => [run.id, run]));
  for (const run of unique.values()) {
    if (!Number.isFinite(Date.parse(run.date)) || Date.parse(run.date) > new Date(now).getTime() || !Number.isFinite(run.elapsed) || run.elapsed < 0) continue;
    const key = localDateKey(run.date);
    if (key === today) todayMs += run.elapsed;
    const day = days.find(item => item.key === key);
    if (day) {
      day.practiced = true;
      weekMs += run.elapsed;
      sessions += 1;
      if (run.mode === 'story') chapters += 1;
    }
  }
  return { days, practicedDays: days.filter(day => day.practiced).length, todayMinutes: todayMs / 60000, weekMinutes: weekMs / 60000, chapters, sessions, comparable: getComparableSummary([...unique.values()].filter(run => Date.parse(run.date) <= new Date(now).getTime())) };
}
