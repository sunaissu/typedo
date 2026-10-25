import { LESSON_COURSE, sanitizeLessonProgress } from './lessons.js';
import { LESSON_THEMES } from './lessonPractice.js';
import { createSession } from './typing.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
const text = value => typeof value === 'string' && /^[\x20-\x7e]+$/.test(value);

function validateDraft(lessonId, draft) {
  if (!LESSON_COURSE.some(lesson => lesson.id === lessonId) || !object(draft) || draft.version !== 1
    || draft.lessonId !== lessonId || typeof draft.runId !== 'string' || !draft.runId.trim() || draft.runId.length > 100
    || !['practice', 'test'].includes(draft.stage) || !['lesson', 'review', 'check'].includes(draft.practiceKind)
    || draft.practiceKind === 'review' && draft.stage !== 'practice' || draft.practiceKind === 'check' && draft.stage !== 'test'
    || !Number.isInteger(draft.roundIndex) || draft.roundIndex < 0 || draft.roundIndex > 2
    || typeof draft.guided !== 'boolean' || draft.stage === 'test' && draft.guided
    || typeof draft.interrupted !== 'boolean' || !object(draft.block)) return null;
  const block = draft.block;
  if (!text(block.text) || block.text.length > 20000 || draft.text !== block.text
    || !Array.isArray(block.passages) || !block.passages.length || block.passages.length > 100
    || !block.passages.every(text) || block.passages.join(' ') !== block.text
    || !Array.isArray(block.targetKeys) || !block.targetKeys.length
    || !block.targetKeys.every(key => text(key) && key.length === 1 && block.text.includes(key))
    || !Array.isArray(block.adaptiveKeys) || !block.adaptiveKeys.every(key => text(key) && key.length === 1 && block.text.includes(key))
    || !LESSON_THEMES.some(theme => theme.id === block.theme)
    || typeof draft.typed !== 'string' || !/^[\x20-\x7e]*$/.test(draft.typed) || draft.typed.length >= block.text.length
    || !count(draft.attempts) || draft.attempts === 0 || draft.attempts < draft.typed.length
    || !count(draft.correctAttempts) || draft.correctAttempts > draft.attempts
    || !Number.isFinite(draft.elapsed) || draft.elapsed < 0 || draft.elapsed > 604800000
    || typeof draft.updatedAt !== 'string' || !Number.isFinite(Date.parse(draft.updatedAt)) || !object(draft.keyStats)) return null;
  const keyStats = {};
  let attempts = 0;
  let errors = 0;
  for (const [key, value] of Object.entries(draft.keyStats)) {
    if (!text(key) || key.length !== 1 || !block.text.includes(key) || !object(value)
      || !count(value.attempts) || value.attempts === 0 || !count(value.errors) || value.errors > value.attempts) return null;
    attempts += value.attempts;
    errors += value.errors;
    keyStats[key] = { attempts: value.attempts, errors: value.errors };
  }
  if (attempts !== draft.attempts || errors !== draft.attempts - draft.correctAttempts) return null;
  const retained = {};
  for (let index = 0; index < draft.typed.length; index++) {
    const key = block.text[index];
    const value = retained[key] || { correct: 0, errors: 0 };
    if (draft.typed[index] === key) value.correct++;
    else value.errors++;
    retained[key] = value;
  }
  for (const [key, value] of Object.entries(retained)) {
    if (!keyStats[key] || keyStats[key].errors < value.errors || keyStats[key].attempts - keyStats[key].errors < value.correct) return null;
  }
  if (draft.stage === 'practice' && draft.typed !== block.text.slice(0, draft.typed.length)) return null;
  const samples = Array.isArray(draft.samples) ? draft.samples.filter(sample => object(sample) && count(sample.second) && sample.second <= draft.elapsed / 1000 && count(sample.wpm)).slice(-7200).map(sample => ({ second: sample.second, wpm: sample.wpm })) : [];
  const lastWrong = text(draft.lastWrong) && draft.lastWrong.length === 1 && block.text.includes(draft.lastWrong) ? draft.lastWrong : null;
  const lastWrongKey = lastWrong && text(draft.lastWrongKey) && draft.lastWrongKey.length === 1 ? draft.lastWrongKey : null;
  const lastWrongPosition = lastWrong && count(draft.lastWrongPosition) && draft.lastWrongPosition < block.text.length ? draft.lastWrongPosition : null;
  return {
    version: 1, id: draft.runId, runId: draft.runId, lessonId, stage: draft.stage, practiceKind: draft.practiceKind,
    roundIndex: draft.roundIndex, guided: draft.guided, interrupted: draft.interrupted,
    block: { text: block.text, passages: [...block.passages], targetKeys: [...new Set(block.targetKeys)], adaptiveKeys: [...new Set(block.adaptiveKeys)], theme: block.theme },
    text: block.text, typed: draft.typed, attempts: draft.attempts, correctAttempts: draft.correctAttempts, keyStats,
    elapsed: draft.elapsed, updatedAt: new Date(draft.updatedAt).toISOString(), samples,
    lastWrong, lastWrongKey, lastWrongPosition, wrongStreak: lastWrong && count(draft.wrongStreak) ? draft.wrongStreak : 0,
  };
}

export function createLessonDraft(lessonId, run, session, updatedAt = new Date().toISOString()) {
  if (!object(session) || !['ready', 'running', 'paused'].includes(session.status)) return null;
  return validateDraft(lessonId, { ...session, version: 1, lessonId, stage: run.stage, practiceKind: run.practiceKind, roundIndex: run.roundIndex, guided: run.guided, block: run.block, interrupted: Boolean(session.interrupted), updatedAt });
}

export function restoreLessonSession(lessonId, draft) {
  const saved = validateDraft(lessonId, draft);
  if (!saved) return null;
  return {
    ...createSession(saved.text), runId: saved.runId, typed: saved.typed, status: 'paused', startedAt: null,
    attempts: saved.attempts, correctAttempts: saved.correctAttempts, keyStats: saved.keyStats,
    elapsed: saved.elapsed, interrupted: saved.interrupted || saved.stage === 'test', samples: saved.samples,
    lastWrong: saved.lastWrong, lastWrongKey: saved.lastWrongKey, lastWrongPosition: saved.lastWrongPosition, wrongStreak: saved.wrongStreak,
  };
}

export function sanitizeLessonDrafts(value, lessonProgress = {}, history = []) {
  if (!object(value)) return {};
  const progress = sanitizeLessonProgress(lessonProgress);
  const completed = new Set(Array.isArray(history) ? history.filter(object).map(run => run.id) : []);
  const drafts = {};
  for (const lesson of LESSON_COURSE) {
    if (!Object.hasOwn(value, lesson.id)) continue;
    const draft = validateDraft(lesson.id, value[lesson.id]);
    if (!draft || completed.has(draft.runId) || progress[lesson.id]?.lastPracticed && Date.parse(draft.updatedAt) < Date.parse(progress[lesson.id].lastPracticed)) continue;
    drafts[lesson.id] = draft;
  }
  return drafts;
}
