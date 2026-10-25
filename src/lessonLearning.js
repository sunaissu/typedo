import { LESSON_CONTENT } from './lessonContent.js';
import { LESSON_TARGET_KEYS } from './lessonPractice.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = 64;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isInteger(value) && value >= 0 && value <= 1000000;
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
const localDay = value => { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };
const plusDays = (value, days) => new Date(Date.parse(value) + days * DAY).toISOString();
const targetKeys = value => Array.isArray(value) ? [...new Set(value.filter(key => typeof key === 'string' && /^[\x20-\x7e]$/.test(key)))].sort() : [];

function cleanSample(value) {
  if (!object(value) || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 100 || !iso(value.date)) return null;
  if (!['lesson', 'review', 'check'].includes(value.practiceKind) || typeof value.guided !== 'boolean') return null;
  if (value.assessmentPassed !== undefined && typeof value.assessmentPassed !== 'boolean') return null;
  if (value.interrupted !== undefined && typeof value.interrupted !== 'boolean') return null;
  if (![value.attempts, value.correctAttempts, value.correct].every(count) || value.attempts < 1 || value.correctAttempts > value.attempts || value.correct > value.correctAttempts) return null;
  if (!Number.isFinite(value.elapsed) || value.elapsed <= 0 || value.elapsed > 7 * DAY || !object(value.keyStats)) return null;
  const textLength = value.textLength ?? (typeof value.passage === 'string' ? value.passage.length : undefined);
  if (textLength !== undefined && (!count(textLength) || textLength < 1 || value.correct > textLength)) return null;
  const keyStats = {};
  for (const [key, stats] of Object.entries(value.keyStats)) {
    if (!/^[\x20-\x7e]$/.test(key) || !object(stats) || !count(stats.attempts) || !count(stats.errors) || stats.errors > stats.attempts) return null;
    if (stats.attempts) keyStats[key] = { attempts: stats.attempts, errors: stats.errors };
  }
  const totals = Object.values(keyStats).reduce((sum, stats) => ({ attempts: sum.attempts + stats.attempts, errors: sum.errors + stats.errors }), { attempts: 0, errors: 0 });
  if (totals.attempts !== value.attempts || totals.errors !== value.attempts - value.correctAttempts) return null;
  const keys = targetKeys(value.targetKeys);
  if (!keys.length) return null;
  return { id: value.id, date: iso(value.date), previousId: typeof value.previousId === 'string' && value.previousId.length <= 100 ? value.previousId : '', practiceKind: value.practiceKind, guided: value.guided, ...(typeof value.assessmentPassed === 'boolean' ? { assessmentPassed: value.assessmentPassed } : {}), ...(typeof value.interrupted === 'boolean' ? { interrupted: value.interrupted } : {}), attempts: value.attempts, correctAttempts: value.correctAttempts, correct: value.correct, ...(textLength === undefined ? {} : { textLength }), elapsed: value.elapsed, targetKeys: keys, keyStats };
}

export function lessonResultEvidence(value) {
  const sample = cleanSample(value);
  if (!sample) return {};
  const { id, date, previousId, ...evidence } = sample;
  return { ...evidence, ...(Number.isInteger(value.practiceRound) && value.practiceRound >= 0 && value.practiceRound < 100 ? { practiceRound: value.practiceRound } : {}) };
}

function successfulCheck(sample, previous, lessonId) {
  // New assessments also verify distinct correct target positions; older samples keep their recorded evidence.
  if (sample.interrupted || sample.assessmentPassed === false) return false;
  if (!previous || sample.previousId !== previous.id || sample.practiceKind !== 'check' || sample.guided || sample.correct < 40 || !sample.textLength || sample.correct / sample.textLength < .95 || sample.correctAttempts / sample.attempts < .95) return false;
  // A later calendar day and 20 hours avoid awarding retention for a midnight replay.
  if (Date.parse(sample.date) - Date.parse(previous.date) < 20 * 60 * 60 * 1000 || localDay(sample.date) === localDay(previous.date)) return false;
  const keys = LESSON_TARGET_KEYS[lessonId] || [];
  return keys.length > 0 && keys.every(key => sample.targetKeys.includes(key) && (sample.keyStats[key]?.attempts || 0) - (sample.keyStats[key]?.errors || 0) >= 2);
}

function summarize(lessonId, samples) {
  let successfulChecks = 0;
  let retainedAt = '';
  let lastChecked = '';
  let nextReviewAt = '';
  let needsGuidedReview = false;
  const anchors = [];
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    if (!index) anchors.push(sample.id);
    if (sample.interrupted) {
      // A completed interrupted assessment is rehearsal, not a failed check.
      // It preserves earlier learning evidence and does not advance its interval.
      const rehearsalDue = plusDays(sample.date, 1);
      if (rehearsalDue > nextReviewAt) nextReviewAt = rehearsalDue;
    } else if (sample.practiceKind === 'check') {
      lastChecked = sample.date;
      if (successfulCheck(sample, samples[index - 1], lessonId)) {
        successfulChecks = Math.min(3, successfulChecks + 1);
        retainedAt = sample.date;
        needsGuidedReview = false;
        nextReviewAt = plusDays(sample.date, successfulChecks === 1 ? 3 : 7);
        if (successfulChecks <= 3 && !anchors.includes(sample.id) && anchors.length < 7) anchors.push(samples[index - 1].id, sample.id);
      } else {
        needsGuidedReview = true;
        nextReviewAt = sample.date;
      }
    } else {
      needsGuidedReview = false;
      nextReviewAt = plusDays(sample.date, 1);
    }
  }
  return {
    samples, firstPracticed: samples[0]?.date || '', lastPracticed: samples.at(-1)?.date || '',
    lastChecked, retainedAt, successfulChecks, nextReviewAt, needsGuidedReview, anchors,
  };
}

function makeRecord(lessonId, values) {
  const samples = [...new Map(values.map(cleanSample).filter(Boolean).map(sample => [sample.id, sample])).values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const complete = summarize(lessonId, samples);
  const anchors = [...new Set(complete.anchors)];
  const keep = new Set([...anchors, ...samples.slice(-(MAX_SAMPLES - anchors.length)).map(sample => sample.id)]);
  const result = summarize(lessonId, samples.filter(sample => keep.has(sample.id)));
  delete result.anchors;
  return result;
}

export function sanitizeLessonLearning(value) {
  if (!object(value)) return {};
  const result = {};
  for (const id of Object.keys(LESSON_CONTENT)) {
    const record = Object.hasOwn(value, id) && value[id];
    if (!object(record) || !Array.isArray(record.samples)) continue;
    const cleaned = makeRecord(id, record.samples.slice(-256));
    if (cleaned.samples.length) result[id] = cleaned;
  }
  return result;
}

export function applyLessonLearningResult(value, result) {
  const next = sanitizeLessonLearning(value);
  if (result?.mode !== 'lesson' || !Object.hasOwn(LESSON_CONTENT, result.lessonId) || !['practice', 'test'].includes(result.stage)) return next;
  const sample = cleanSample(result);
  if (!sample || next[result.lessonId]?.samples.some(previous => previous.id === sample.id)) return next;
  sample.previousId = next[result.lessonId]?.samples.filter(previous => previous.date <= sample.date).at(-1)?.id || '';
  next[result.lessonId] = makeRecord(result.lessonId, [...(next[result.lessonId]?.samples || []), sample]);
  return next;
}

export function mergeLessonLearning(current, incoming) {
  const first = sanitizeLessonLearning(current);
  const second = sanitizeLessonLearning(incoming);
  const result = { ...first };
  for (const [id, record] of Object.entries(second)) result[id] = makeRecord(id, [...record.samples, ...(first[id]?.samples || [])]);
  return result;
}

export function getLessonLearningStatus(record, now = new Date()) {
  const time = new Date(now).getTime();
  const retained = Boolean(iso(record?.retainedAt) && Date.parse(record.retainedAt) <= time);
  const due = Boolean(iso(record?.nextReviewAt) && Date.parse(record.nextReviewAt) <= time);
  const label = record?.needsGuidedReview && due ? 'Guided review recommended' : due ? 'Review ready' : retained ? 'Retained on a later check' : record?.lastPracticed ? 'Practised · check on a later day' : 'Not yet practised';
  return { label, retained, due };
}

export function getDueLessonReviews(lessonLearning, lessonProgress, now = new Date()) {
  const records = sanitizeLessonLearning(lessonLearning);
  const due = [];
  for (const id of Object.keys(LESSON_CONTENT)) {
    const progress = object(lessonProgress?.[id]) && lessonProgress[id];
    if (!progress || !(progress.practiced === true || progress.passed === true || Number.isInteger(progress.practiceRounds) && progress.practiceRounds >= 3)) continue;
    const record = records[id];
    if (record && getLessonLearningStatus(record, now).due) due.push({ lessonId: id, dueAt: record.nextReviewAt, retained: getLessonLearningStatus(record, now).retained });
    else if (!record) {
      due.push({ lessonId: id, dueAt: iso(lessonProgress[id].lastPracticed) || new Date(0).toISOString(), retained: false });
    }
  }
  return due.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function getLessonImprovement(record, currentResult) {
  const current = cleanSample(currentResult);
  if (!current || current.interrupted || !Array.isArray(record?.samples)) return null;
  const previous = record.samples.map(cleanSample).filter(sample => sample && !sample.interrupted && sample.id !== current.id && sample.date < current.date && sample.guided === current.guided && sample.practiceKind === current.practiceKind && sample.targetKeys.join('') === current.targetKeys.join('')).slice(-5);
  if (previous.length < 2) return null;
  const improved = current.targetKeys.filter(key => {
    const now = current.keyStats[key];
    const before = previous.reduce((sum, sample) => ({ attempts: sum.attempts + (sample.keyStats[key]?.attempts || 0), errors: sum.errors + (sample.keyStats[key]?.errors || 0) }), { attempts: 0, errors: 0 });
    return now?.attempts >= 8 && before.attempts >= 20 && before.errors >= 2 && before.errors / before.attempts - now.errors / now.attempts >= .05;
  }).slice(0, 2);
  if (!improved.length) return null;
  const names = improved.map(key => key === ' ' ? 'Space' : key.toUpperCase()).join(' and ');
  return `Fewer mistakes per attempt on ${names} than in your recent comparable practice.`;
}
