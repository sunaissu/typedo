import { STORIES, getStoryChapter, sanitizeStoryProgress, storyRoute } from './stories.js';
import { createSession } from './typing.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const counter = value => Number.isSafeInteger(value) && value >= 0;

function validateDraft(storyId, draft) {
  const story = STORIES.find(item => item.id === storyId);
  if (!story || !record(draft) || !Number.isInteger(draft.chapterIndex)
    || draft.chapterIndex < 0 || draft.chapterIndex >= story.chapters.length) return null;
  const branched = story.choice && draft.chapterIndex >= story.choice.chapterIndex;
  if (draft.route !== undefined && (!branched || !storyRoute(story, draft.route))) return null;
  const route = branched ? storyRoute(story, draft.route) : undefined;
  const text = getStoryChapter(story, draft.chapterIndex, route).text;
  const choiceOnly = branched && draft.route !== undefined && draft.attempts === 0
    && draft.typed === '' && draft.correctAttempts === 0 && draft.elapsed === 0
    && record(draft.keyStats) && Object.keys(draft.keyStats).length === 0;
  if (typeof draft.runId !== 'string' || !draft.runId.trim() || draft.runId.length > 100
    || draft.text !== text || typeof draft.typed !== 'string' || !/^[\x20-\x7e]*$/.test(draft.typed)
    || draft.typed.length >= text.length || !counter(draft.attempts) || (draft.attempts === 0 && !choiceOnly)
    || draft.attempts < draft.typed.length || !counter(draft.correctAttempts)
    || draft.correctAttempts > draft.attempts || !Number.isFinite(draft.elapsed) || draft.elapsed < 0
    || typeof draft.updatedAt !== 'string' || !Number.isFinite(Date.parse(draft.updatedAt))
    || !record(draft.keyStats)) return null;

  const keyStats = {};
  let attempts = 0;
  let errors = 0;
  for (const [key, value] of Object.entries(draft.keyStats)) {
    if (!/^[\x20-\x7e]$/.test(key) || !text.includes(key) || !record(value)
      || !counter(value.attempts) || value.attempts === 0 || !counter(value.errors)
      || value.errors > value.attempts) return null;
    attempts += value.attempts;
    errors += value.errors;
    keyStats[key] = { attempts: value.attempts, errors: value.errors };
  }
  if (!Number.isSafeInteger(attempts) || !Number.isSafeInteger(errors)
    || attempts !== draft.attempts || errors !== draft.attempts - draft.correctAttempts) return null;

  // Corrections can add attempts, but every retained character must have evidence.
  const retained = {};
  for (let index = 0; index < draft.typed.length; index++) {
    const key = text[index];
    const value = retained[key] || { correct: 0, errors: 0 };
    if (draft.typed[index] === key) value.correct++;
    else value.errors++;
    retained[key] = value;
  }
  for (const [key, value] of Object.entries(retained)) {
    const saved = keyStats[key];
    if (!saved || saved.errors < value.errors || saved.attempts - saved.errors < value.correct) return null;
  }
  return {
    runId: draft.runId, chapterIndex: draft.chapterIndex, text, typed: draft.typed,
    attempts: draft.attempts, correctAttempts: draft.correctAttempts, keyStats,
    elapsed: draft.elapsed, updatedAt: new Date(draft.updatedAt).toISOString(),
    ...(route ? { route } : {}),
  };
}

export function createStoryDraft(storyId, chapterIndex, session, updatedAt = new Date().toISOString()) {
  if (!record(session) || !['ready', 'running', 'paused'].includes(session.status)) return null;
  return validateDraft(storyId, { ...session, chapterIndex, updatedAt });
}

export function restoreStorySession(storyId, draft) {
  const saved = validateDraft(storyId, draft);
  if (!saved) return null;
  return {
    ...createSession(saved.text), runId: saved.runId, typed: saved.typed, attempts: saved.attempts,
    correctAttempts: saved.correctAttempts, keyStats: saved.keyStats, elapsed: saved.elapsed,
    ...(saved.route ? { route: saved.route } : {}),
  };
}

export function sanitizeStoryDrafts(value, storyProgress = {}, history = []) {
  if (!record(value)) return {};
  const progress = sanitizeStoryProgress(storyProgress);
  const completedRuns = new Set(Array.isArray(history) ? history.filter(record).map(run => run.id) : []);
  const drafts = {};
  for (const story of STORIES) {
    if (!Object.hasOwn(value, story.id)) continue;
    const draft = validateDraft(story.id, value[story.id]);
    const completed = progress[story.id];
    if (!draft || completedRuns.has(draft.runId) || draft.chapterIndex > (completed?.completedChapters || 0)
      || (completed?.lastPracticed && Date.parse(draft.updatedAt) < Date.parse(completed.lastPracticed))) continue;
    drafts[story.id] = draft;
  }
  return drafts;
}
