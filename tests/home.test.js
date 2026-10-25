import test from 'node:test';
import assert from 'node:assert/strict';
import { getComparableSummary, getHomeDrafts, getHomeRecommendation, getPracticeSummary, localDateKey } from '../src/home.js';
import { LESSON_COURSE } from '../src/lessons.js';
import { STORIES } from '../src/stories.js';
import { applyLessonLearningResult } from '../src/lessonLearning.js';

test('Home chooses the most recent unfinished activity across modes and preserves its route', () => {
  const lessonId = LESSON_COURSE[0].id;
  const storyId = STORIES[0].id;
  const progress = { lessonDrafts: { [lessonId]: { lessonId, roundIndex: 1, typed: 'abc', text: 'abcdef', updatedAt: '2026-10-25T03:00:00Z' } }, storyDrafts: { [storyId]: { chapterIndex: 0, text: 'story text', typed: 'story', updatedAt: '2026-10-25T02:00:00Z' } }, workspaceDrafts: { 'time:30:false:false:false': { config: { mode: 'time', duration: 30 }, typed: 'a', text: 'a test', updatedAt: '2026-10-25T01:00:00Z' } } };
  const lesson = getHomeRecommendation(progress);
  assert.equal(lesson.id, lessonId);
  assert.equal(lesson.view, 'lessons');
  assert.match(lesson.detail, /Block 2 of 3.*3 of 6 characters/);
  progress.workspaceDrafts['time:30:false:false:false'].updatedAt = '2026-10-25T04:00:00Z';
  const workspace = getHomeRecommendation(progress);
  assert.equal(workspace.id, 'time:30:false:false:false');
  assert.equal(workspace.view, 'type');
  assert.match(workspace.reason, /fresh test/);
});

test('Home recommends the first unfinished lesson and does not require optional tests', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  assert.equal(getHomeRecommendation({}).id, LESSON_COURSE[0].id);
  const lessonProgress = { [LESSON_COURSE[0].id]: { practiceRounds: 3 } };
  const evidence = lessonId => ({ id: lessonId, date: now.toISOString(), lessonId, mode: 'lesson', stage: 'practice', practiceKind: 'lesson', guided: true, attempts: 50, correctAttempts: 50, correct: 50, elapsed: 60000, textLength: 50, targetKeys: ['f'], keyStats: { f: { attempts: 50, errors: 0 } } });
  let lessonLearning = applyLessonLearningResult({}, evidence(LESSON_COURSE[0].id));
  assert.equal(getHomeRecommendation({ lessonProgress, lessonLearning }, now).id, LESSON_COURSE[1].id);
  for (const lesson of LESSON_COURSE) {
    lessonProgress[lesson.id] = { practiceRounds: 3 };
    lessonLearning = applyLessonLearningResult(lessonLearning, evidence(lesson.id));
  }
  assert.equal(getHomeRecommendation({ lessonProgress, lessonLearning }, now).view, 'stories');
});

test('Home lists every retained draft newest first and keeps custom passages distinguishable', () => {
  const lessonId = LESSON_COURSE[0].id;
  const storyId = STORIES[0].id;
  const custom = (text, updatedAt) => ({ config: { mode: 'custom' }, text, typed: text.slice(0, 3), updatedAt });
  const progress = {
    lessonDrafts: { [lessonId]: { lessonId, text: 'lesson text', typed: 'les', roundIndex: 1, updatedAt: '2026-10-25T03:00:00Z' } },
    storyDrafts: { [storyId]: { text: 'story text', typed: 'sto', chapterIndex: 0, updatedAt: '2026-10-25T01:00:00Z' } },
    workspaceDrafts: { 'custom:first': custom('First saved passage.', '2026-10-25T04:00:00Z'), 'custom:second': custom('Another saved passage.', '2026-10-25T02:00:00Z'), invalid: custom('Bad date.', 'invalid') },
    savedPassages: [{ title: 'A useful email', text: 'First saved passage.' }],
  };
  const drafts = getHomeDrafts(progress);
  assert.deepEqual(drafts.map(draft => [draft.view, draft.id]), [['type', 'custom:first'], ['lessons', lessonId], ['type', 'custom:second'], ['stories', storyId]]);
  assert.equal(drafts[0].title, 'A useful email');
  assert.equal(drafts[0].preview, 'First saved passage.');
  assert.equal(drafts[2].preview, 'Another saved passage.');
  assert.match(drafts[2].detail, /^3 of 22 characters$/);
  const recommendation = getHomeRecommendation(progress);
  assert.deepEqual(recommendation, drafts[0]);
  const others = drafts.filter(draft => draft.view !== recommendation.view || draft.id !== recommendation.id);
  assert.equal(others.length, 3);
  assert.ok(others.every(draft => draft.id !== 'custom:first'));
});

test('Home recommends an eligible due review ahead of a new lesson', () => {
  const lessonId = LESSON_COURSE[0].id;
  const recommendation = getHomeRecommendation({ lessonProgress: { [lessonId]: { practiceRounds: 3, lastPracticed: '2026-10-20T01:00:00Z' } } }, new Date('2026-10-25T12:00:00Z'));
  assert.equal(recommendation.review, true);
  assert.equal(recommendation.id, lessonId);
});

test('Home ignores unrecognized draft content instead of recommending a nonexistent activity', () => {
  const recommendation = getHomeRecommendation({ lessonDrafts: { missing: { updatedAt: '2026-10-26T00:00:00Z' } }, storyDrafts: { missing: { updatedAt: '2026-10-26T00:00:00Z' } } });
  assert.equal(recommendation.draft, undefined);
  assert.equal(recommendation.id, LESSON_COURSE[0].id);
});

test('daily and weekly practice summaries use local days, exclude future results, and deduplicate sessions', () => {
  const now = new Date(2026, 9, 25, 12);
  const run = (id, day, elapsed = 60000) => ({ id, date: new Date(2026, 9, day, 10).toISOString(), elapsed, mode: 'custom' });
  const today = run('today', 25, 90000);
  const summary = getPracticeSummary({ history: [today, today, run('monday', 19), run('last-week', 18), run('future', 26), { ...run('chapter', 24), mode: 'story' }] }, now);
  assert.equal(summary.todayMinutes, 1.5);
  assert.equal(summary.weekMinutes, 3.5);
  assert.equal(summary.practicedDays, 3);
  assert.equal(summary.sessions, 3);
  assert.equal(summary.chapters, 1);
  assert.equal(summary.days[0].key, localDateKey(new Date(2026, 9, 19)));
  assert.equal(summary.days.at(-1).today, true);
});

test('comparable summary separates test settings, excludes interrupted tests, and needs evidence for a trend', () => {
  const run = (index, patch = {}) => ({ id: `run-${index}`, date: new Date(2026, 9, 19 + index, 10).toISOString(), mode: 'time', category: 'time:30:false:false:false', label: '30s test', wpm: 30 + index, accuracy: 90 + index, ...patch });
  const history = Array.from({ length: 6 }, (_, index) => run(index));
  history.push(run(7, { interrupted: true, accuracy: 100 }), run(8, { category: 'time:60:false:false:false', accuracy: 100 }), run(9, { mode: 'lesson', accuracy: 100 }));
  const summary = getComparableSummary(history);
  assert.equal(summary.count, 6);
  assert.equal(summary.accuracy, 94);
  assert.equal(summary.wpm, 34);
  assert.equal(summary.accuracyChange, 3);
  assert.equal(getComparableSummary(history.slice(0, 3)).accuracyChange, null);
  assert.equal(getComparableSummary(history.slice(0, 2)), null);
  assert.equal(getComparableSummary([run(1), run(1), run(1)]), null);
});
