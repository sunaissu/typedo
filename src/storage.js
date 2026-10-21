export const STORAGE_KEY = 'keysteady:v1';
export const DEFAULT_SETTINGS = { mode: 'time', duration: 30, wordCount: 25, lesson: 'home', punctuation: false, numbers: false, strict: true, guide: true, sound: false, theme: 'light', goal: 5, customText: 'Small steps make steady progress. Find your rhythm and let the words flow.' };
export const emptyProgress = () => ({ version: 1, settings: { ...DEFAULT_SETTINGS }, history: [], keyStats: {} });
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function validateProgress(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.history)) throw new Error('This is not a Keysteady backup.');
  const settings = { ...DEFAULT_SETTINGS };
  const raw = value.settings || {};
  for (const key of ['punctuation', 'numbers', 'strict', 'guide', 'sound']) if (typeof raw[key] === 'boolean') settings[key] = raw[key];
  if (['time', 'words', 'practice', 'custom'].includes(raw.mode)) settings.mode = raw.mode;
  if ([15, 30, 60, 120].includes(raw.duration)) settings.duration = raw.duration;
  if ([10, 25, 50, 100].includes(raw.wordCount)) settings.wordCount = raw.wordCount;
  if (['home', 'top', 'bottom', 'all', 'weak'].includes(raw.lesson)) settings.lesson = raw.lesson;
  if (['light', 'dark'].includes(raw.theme)) settings.theme = raw.theme;
  if ([3, 5, 10].includes(raw.goal)) settings.goal = raw.goal;
  if (typeof raw.customText === 'string') settings.customText = raw.customText.replace(/[^\x20-\x7e\n\r\t]/g, '').slice(0, 1500);
  const history = value.history.filter(run => run && typeof run.id === 'string' && typeof run.date === 'string' && !isNaN(Date.parse(run.date)) && ['time', 'words', 'practice', 'custom'].includes(run.mode) && [run.wpm, run.raw, run.accuracy, run.elapsed, run.errors, run.correct].every(finite) && run.accuracy <= 100)
    .slice(0, 500).map(run => ({ id: run.id.slice(0, 100), date: run.date, mode: run.mode, label: String(run.label || run.mode).slice(0, 100), wpm: run.wpm, raw: run.raw, accuracy: run.accuracy, elapsed: run.elapsed, errors: run.errors, correct: run.correct, category: String(run.category || run.mode).slice(0, 100) }));
  const keyStats = {};
  for (const [key, val] of Object.entries(value.keyStats || {})) {
    if (/^[\x20-\x7e]$/.test(key) && val && finite(val.attempts) && finite(val.errors) && val.errors <= val.attempts) keyStats[key] = { attempts: val.attempts, errors: val.errors };
  }
  return { version: 1, settings, history, keyStats };
}

export function readProgress(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return { progress: saved ? validateProgress(JSON.parse(saved)) : emptyProgress(), warning: '' };
  } catch {
    return { progress: emptyProgress(), warning: 'Saved progress could not be read. You can still type and export this session.' };
  }
}

export function writeProgress(storage, progress) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(progress)); return ''; }
  catch { return 'Browser storage is unavailable. Export your progress before leaving.'; }
}
