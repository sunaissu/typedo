import { LESSON_COURSE, sanitizeLessonProgress } from './lessons.js';
import { STORIES, sanitizeStoryProgress, storyRoute } from './stories.js';
import { sanitizeStoryDrafts } from './storyDrafts.js';
import { lessonResultEvidence, mergeLessonLearning, sanitizeLessonLearning } from './lessonLearning.js';
import { sanitizeLessonDrafts } from './lessonDrafts.js';
import { sanitizeWorkspaceDrafts } from './workspaceDrafts.js';
import { sanitizeSavedPassages } from './practiceLibrary.js';
import { browserStorage } from './browserStorage.js';

export const STORAGE_KEY = 'typedo:v1';
export const DEFAULT_SETTINGS = { startView: 'start', mode: 'time', duration: 30, wordCount: 25, lesson: 'home', lessonTheme: 'everyday', lessonLength: 'standard', punctuation: false, capitalization: false, symbols: false, numbers: false, strict: true, guide: true, sound: false, theme: 'dark', themeRevision: 2, goal: 5, dailyMinutes: 5, weeklyDays: 3, passageSize: 28, lineHeight: 1.9, showLiveStats: true, customText: 'Keep your eyes on the screen. Place your fingers on the home row and type each word carefully.' };
export const emptyProgress = () => ({ version: 1, settings: { ...DEFAULT_SETTINGS }, history: [], keyStats: {}, lessonProgress: {}, lessonLearning: {}, storyProgress: {}, storyDrafts: {}, lessonDrafts: {}, workspaceDrafts: {}, savedPassages: [] });
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function discardedDraftsNotice(raw, cleaned) {
  const discarded = ['lessonDrafts', 'workspaceDrafts', 'storyDrafts'].some(key => raw?.[key] && typeof raw[key] === 'object' && Object.keys(raw[key]).some(id => !Object.hasOwn(cleaned[key] || {}, id)));
  return discarded ? 'Some unfinished practice could not be restored because its text or saved data no longer matches. Valid completed results were kept. Keep the original backup if you need its unfinished text.' : '';
}
export function validateProgress(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.history)) throw new Error('This is not a Typedo backup.');
  const settings = { ...DEFAULT_SETTINGS };
  const raw = value.settings || {};
  if (['start', 'type'].includes(raw.startView)) settings.startView = raw.startView;
  for (const key of ['punctuation', 'capitalization', 'symbols', 'numbers', 'strict', 'guide', 'sound', 'showLiveStats']) if (typeof raw[key] === 'boolean') settings[key] = raw[key];
  if (typeof raw.capitalization !== 'boolean') settings.capitalization = raw.punctuation === true;
  if (['time', 'words', 'practice', 'custom'].includes(raw.mode)) settings.mode = raw.mode;
  if (Number.isInteger(raw.duration) && raw.duration >= 15 && raw.duration <= 900) settings.duration = raw.duration;
  if (Number.isInteger(raw.wordCount) && raw.wordCount >= 10 && raw.wordCount <= 1000) settings.wordCount = raw.wordCount;
  if (['home', 'top', 'bottom', 'all', 'weak'].includes(raw.lesson)) settings.lesson = raw.lesson;
  if (['everyday', 'outdoors', 'adventure'].includes(raw.lessonTheme)) settings.lessonTheme = raw.lessonTheme;
  if (['quick', 'standard', 'extra'].includes(raw.lessonLength)) settings.lessonLength = raw.lessonLength;
  if (raw.themeRevision === 2 && ['light', 'dark'].includes(raw.theme)) settings.theme = raw.theme;
  if ([3, 5, 10].includes(raw.goal)) settings.goal = raw.goal;
  if ([3, 5, 10].includes(raw.dailyMinutes)) settings.dailyMinutes = raw.dailyMinutes;
  if (Number.isInteger(raw.weeklyDays) && raw.weeklyDays >= 1 && raw.weeklyDays <= 7) settings.weeklyDays = raw.weeklyDays;
  if ([24, 28, 32].includes(raw.passageSize)) settings.passageSize = raw.passageSize;
  if ([1.6, 1.9, 2.2].includes(raw.lineHeight)) settings.lineHeight = raw.lineHeight;
  if (['blue', 'forest', 'plum'].includes(raw.accent)) settings.accent = raw.accent;
  if (typeof raw.backupReminderDismissedAt === 'string' && Number.isFinite(Date.parse(raw.backupReminderDismissedAt))) settings.backupReminderDismissedAt = raw.backupReminderDismissedAt;
  if (typeof raw.customText === 'string') settings.customText = raw.customText.replace(/[^\x20-\x7e\n\r\t]/g, '').slice(0, 1500);
  const history = value.history.filter(run => run && typeof run.id === 'string' && typeof run.date === 'string' && !isNaN(Date.parse(run.date)) && ['time', 'words', 'practice', 'custom', 'lesson', 'story'].includes(run.mode) && [run.wpm, run.raw, run.accuracy, run.elapsed, run.errors, run.correct].every(finite) && run.accuracy <= 100 && (run.mode !== 'lesson' || LESSON_COURSE.some(lesson => lesson.id === run.lessonId) && ['practice', 'test'].includes(run.stage)) && (run.mode !== 'story' || STORIES.some(story => story.id === run.storyId && Number.isInteger(run.chapterIndex) && run.chapterIndex >= 0 && run.chapterIndex < story.chapters.length && (run.route === undefined || storyRoute(story, run.route) !== undefined))))
    .slice(0, 500).map(run => ({ id: run.id.slice(0, 100), date: run.date, mode: run.mode, label: String(run.label || run.mode).slice(0, 100), wpm: run.wpm, raw: run.raw, accuracy: run.accuracy, elapsed: run.elapsed, errors: run.errors, correct: run.correct, category: String(run.category || run.mode).slice(0, 100), ...(Object.hasOwn(run, 'interrupted') ? { interrupted: run.interrupted === true } : {}), ...(run.mode === 'lesson' ? { lessonId: run.lessonId, stage: run.stage, passed: run.stage === 'test' && run.passed === true && !run.interrupted, ...(['lesson', 'review', 'check'].includes(run.practiceKind) ? { practiceKind: run.practiceKind } : {}), ...lessonResultEvidence(run) } : {}), ...(run.mode === 'story' ? { storyId: run.storyId, chapterIndex: run.chapterIndex, ...(STORIES.find(story => story.id === run.storyId)?.choice && run.chapterIndex >= STORIES.find(story => story.id === run.storyId).choice.chapterIndex ? { route: storyRoute(STORIES.find(story => story.id === run.storyId), run.route) } : {}) } : {}) }));
  const keyStats = {};
  for (const [key, val] of Object.entries(value.keyStats || {})) {
    if (/^[\x20-\x7e]$/.test(key) && val && finite(val.attempts) && finite(val.errors) && val.errors <= val.attempts) keyStats[key] = { attempts: val.attempts, errors: val.errors };
  }
  const storyProgress = sanitizeStoryProgress(value.storyProgress);
  const lessonProgress = sanitizeLessonProgress(value.lessonProgress);
  return { version: 1, settings, history, keyStats, lessonProgress, lessonLearning: sanitizeLessonLearning(value.lessonLearning), storyProgress, storyDrafts: sanitizeStoryDrafts(value.storyDrafts, storyProgress, history), lessonDrafts: sanitizeLessonDrafts(value.lessonDrafts, lessonProgress, history), workspaceDrafts: sanitizeWorkspaceDrafts(value.workspaceDrafts, history), savedPassages: sanitizeSavedPassages(value.savedPassages), ...(typeof value.lastBackupAt === 'string' && Number.isFinite(Date.parse(value.lastBackupAt)) ? { lastBackupAt: value.lastBackupAt } : {}) };
}

export function mergeProgress(currentValue, incomingValue) {
  const current = validateProgress(currentValue);
  const incoming = validateProgress(incomingValue);
  const history = [...new Map([...incoming.history, ...current.history].map(run => [run.id, run])).values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 500);
  const keyStats = { ...current.keyStats };
  for (const [key, value] of Object.entries(incoming.keyStats)) {
    keyStats[key] = {
      attempts: Math.max(value.attempts, keyStats[key]?.attempts || 0),
      errors: Math.max(value.errors, keyStats[key]?.errors || 0),
    };
  }
  const lessonProgress = { ...current.lessonProgress };
  for (const [id, value] of Object.entries(incoming.lessonProgress)) {
    const existing = lessonProgress[id];
    lessonProgress[id] = existing ? {
      practiced: existing.practiced || value.practiced,
      passed: existing.passed || value.passed,
      practiceRounds: Math.max(existing.practiceRounds, value.practiceRounds),
      seenPractice: [...existing.seenPractice, ...value.seenPractice],
      seenTests: [...existing.seenTests, ...value.seenTests],
      bestAccuracy: Math.max(existing.bestAccuracy, value.bestAccuracy),
      bestWpm: Math.max(existing.bestWpm, value.bestWpm),
      attempts: Math.max(existing.attempts, value.attempts),
      lastPracticed: existing.lastPracticed > value.lastPracticed ? existing.lastPracticed : value.lastPracticed,
    } : value;
  }
  const storyProgress = { ...current.storyProgress };
  for (const [id, value] of Object.entries(incoming.storyProgress)) {
    const existing = storyProgress[id];
    storyProgress[id] = existing ? {
      completedChapters: Math.max(existing.completedChapters, value.completedChapters),
      bestAccuracy: Math.max(existing.bestAccuracy, value.bestAccuracy),
      attempts: Math.max(existing.attempts, value.attempts),
      lastPracticed: existing.lastPracticed > value.lastPracticed ? existing.lastPracticed : value.lastPracticed,
      ...((existing.lastPracticed >= value.lastPracticed ? existing : value).replayChapter !== undefined
        ? { replayChapter: (existing.lastPracticed >= value.lastPracticed ? existing : value).replayChapter } : {}),
      ...((existing.lastPracticed >= value.lastPracticed ? existing : value).route !== undefined
        ? { route: (existing.lastPracticed >= value.lastPracticed ? existing : value).route } : {}),
    } : value;
  }
  const storyDrafts = { ...current.storyDrafts };
  for (const [id, draft] of Object.entries(incoming.storyDrafts)) {
    if (!storyDrafts[id] || draft.updatedAt > storyDrafts[id].updatedAt) storyDrafts[id] = draft;
  }
  const mergeDrafts = (first, second) => {
    const merged = { ...first };
    for (const [key, value] of Object.entries(second)) if (!merged[key] || value.updatedAt > merged[key].updatedAt) merged[key] = value;
    return merged;
  };
  const savedPassages = new Map(current.savedPassages.map(item => [item.id, item]));
  for (const item of incoming.savedPassages) if (!savedPassages.has(item.id) || item.updatedAt > savedPassages.get(item.id).updatedAt) savedPassages.set(item.id, item);
  return {
    ...current, settings: incoming.settings, history, keyStats,
    lessonProgress: sanitizeLessonProgress(lessonProgress),
    lessonLearning: mergeLessonLearning(current.lessonLearning, incoming.lessonLearning),
    storyProgress: sanitizeStoryProgress(storyProgress),
    storyDrafts: sanitizeStoryDrafts(storyDrafts, storyProgress, history),
    lessonDrafts: sanitizeLessonDrafts(mergeDrafts(current.lessonDrafts, incoming.lessonDrafts), lessonProgress, history),
    workspaceDrafts: sanitizeWorkspaceDrafts(mergeDrafts(current.workspaceDrafts, incoming.workspaceDrafts), history),
    savedPassages: sanitizeSavedPassages([...savedPassages.values()]),
    lastBackupAt: [current.lastBackupAt, incoming.lastBackupAt].filter(Boolean).sort().at(-1),
  };
}

export async function readProgress(storage = browserStorage, storageKey = STORAGE_KEY) {
  let saved = null;
  let storedRaw = null;
  try {
    storedRaw = await storage.getItem(storageKey);
    saved = storedRaw ?? (storageKey === STORAGE_KEY ? await storage.getItem('keysteady:v1') : null);
    const raw = saved !== null ? JSON.parse(saved) : null;
    const progress = saved !== null ? validateProgress(raw) : emptyProgress();
    const warning = discardedDraftsNotice(raw, progress);
    return { progress, storedRaw, warning, writeBlocked: false, recoveryRaw: warning ? saved : null };
  } catch {
    return {
      progress: emptyProgress(), storedRaw, writeBlocked: true, recoveryRaw: typeof saved === 'string' ? saved : null,
      warning: 'Saved progress could not be read. Automatic saving is paused to protect the original. You can type, export this session, or restore a valid backup.',
    };
  }
}

export async function writeProgress(storage, progress, storageKey = STORAGE_KEY) {
  try { await storage.setItem(storageKey, JSON.stringify(progress)); return ''; }
  catch { return 'Browser storage is unavailable. Export your progress before leaving.'; }
}
