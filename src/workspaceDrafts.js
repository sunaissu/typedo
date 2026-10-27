import { createSession } from './typing.js';

function passageKey(text = '') {
  let hash = 14695981039346656037n;
  for (const char of text.trim().replace(/\s+/g, ' ')) hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 1099511628211n);
  return hash.toString(16);
}
export const workspaceKey = config => `${config.mode}:${config.mode === 'time' ? config.duration : config.mode === 'words' ? config.wordCount : config.mode === 'practice' ? config.lesson : passageKey(config.customText)}:${config.punctuation}:${config.numbers}:${config.mode === 'practice' && config.strict}${(config.capitalization ?? config.punctuation) !== config.punctuation || config.symbols ? `:case=${config.capitalization ?? config.punctuation}:symbols=${!!config.symbols}` : ''}`;
const counter = value => Number.isSafeInteger(value) && value >= 0;
const record = value => value && typeof value === 'object' && !Array.isArray(value);

export function cleanWorkspaceConfig(value) {
  if (!record(value) || !['time', 'words', 'practice', 'custom'].includes(value.mode)) return null;
  if (!Number.isInteger(value.duration) || value.duration < 15 || value.duration > 900 || !Number.isInteger(value.wordCount) || value.wordCount < 10 || value.wordCount > 1000) return null;
  if (!['home', 'top', 'bottom', 'all', 'weak'].includes(value.lesson)) return null;
  return { mode: value.mode, duration: value.duration, wordCount: value.wordCount, lesson: value.lesson,
    capitalization: typeof value.capitalization === 'boolean' ? value.capitalization : value.punctuation === true, symbols: value.symbols === true, punctuation: value.punctuation === true, numbers: value.numbers === true, strict: value.strict !== false,
    customText: typeof value.customText === 'string' ? value.customText.replace(/[^\x20-\x7e\n\r\t]/g, '').slice(0, 1500) : '' };
}

function cleanDraft(value) {
  if (!record(value)) return null;
  const config = cleanWorkspaceConfig(value.config);
  if (!config || typeof value.id !== 'string' || !value.id || value.id.length > 100 || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || typeof value.text !== 'string' || !value.text.length || value.text.length > 100000 || !/^[\x20-\x7e]+$/.test(value.text)
    || typeof value.typed !== 'string' || !/^[\x20-\x7e]*$/.test(value.typed) || value.typed.length >= value.text.length
    || !counter(value.attempts) || value.attempts === 0 || value.attempts < value.typed.length || !counter(value.correctAttempts) || value.correctAttempts > value.attempts
    || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed > 604800000 || !record(value.keyStats)) return null;
  if (config.mode === 'time' && value.elapsed >= config.duration * 1000) return null;
  const keyStats = {};
  let attempts = 0, errors = 0;
  for (const [key, item] of Object.entries(value.keyStats)) {
    if (!/^[\x20-\x7e]$/.test(key) || !value.text.includes(key) || !record(item) || !counter(item.attempts) || !counter(item.errors) || item.errors > item.attempts) return null;
    keyStats[key] = { attempts: item.attempts, errors: item.errors };
    attempts += item.attempts; errors += item.errors;
  }
  if (attempts !== value.attempts || errors !== value.attempts - value.correctAttempts) return null;
  const retained = {};
  [...value.typed].forEach((char, index) => {
    const key = value.text[index];
    const stat = retained[key] ||= { correct: 0, errors: 0 };
    if (char === key) stat.correct++; else stat.errors++;
  });
  for (const [key, item] of Object.entries(retained)) if (!keyStats[key] || keyStats[key].errors < item.errors || keyStats[key].attempts - keyStats[key].errors < item.correct) return null;
  return { id: value.id, updatedAt: new Date(value.updatedAt).toISOString(), config, text: value.text, typed: value.typed, attempts, correctAttempts: value.correctAttempts, elapsed: value.elapsed, keyStats,
    interrupted: value.interrupted === true || ['time', 'words'].includes(config.mode),
    samples: Array.isArray(value.samples) ? value.samples.filter(item => record(item) && counter(item.second) && Number.isFinite(item.wpm) && item.wpm >= 0 && item.second <= Math.ceil(value.elapsed / 1000)).slice(-1000) : [] };
}

export function createWorkspaceDraft(session, config, updatedAt = new Date().toISOString()) {
  return session.status === 'finished' ? null : cleanDraft({ ...session, id: session.runId, config, updatedAt });
}
export function restoreWorkspaceSession(draft) {
  const saved = cleanDraft(draft);
  return saved ? { ...createSession(saved.text), ...saved, runId: saved.id, status: 'paused', startedAt: null } : null;
}
export function sanitizeWorkspaceDrafts(value, history = []) {
  if (!record(value)) return {};
  const complete = new Set(history.map(run => run.id));
  return Object.fromEntries(Object.entries(value).map(([key, value], index) => [key, cleanDraft(value), index])
    .filter(([key, draft]) => draft && workspaceKey(draft.config) === key && !complete.has(draft.id))
    .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt) || b[2] - a[2])
    .slice(0, 100).map(([key, draft]) => [key, draft]));
}
