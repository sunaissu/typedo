import { emptyProgress } from './storage.js';

export const keyLabel = key => key === ' ' ? 'Space' : /^[A-Z]$/.test(key) ? `Capital ${key}` : key;
export function keyEvidence(stats = {}) {
  return Object.entries(stats).filter(([key, value]) => /^[\x20-\x7e]$/.test(key) && value && Number.isInteger(value.attempts) && value.attempts > 0 && Number.isInteger(value.errors) && value.errors >= 0 && value.errors <= value.attempts)
    .map(([key, value]) => ({ key, attempts: value.attempts, errors: value.errors, accuracy: Math.round(1000 * (1 - value.errors / value.attempts)) / 10 }));
}
export function attemptMistakes(stats) {
  return keyEvidence(stats).filter(item => item.errors > 0).sort((a, b) => b.errors - a.errors || a.accuracy - b.accuracy || a.key.localeCompare(b.key)).slice(0, 3);
}
export function mistakePassage(stats) {
  const targets = attemptMistakes(stats).map(item => item.key);
  // These are exact-case drills, not a claim that one attempt establishes a weakness.
  return targets.map(key => key === ' ' ? 'one small step at a time' : `Try ${key} once. Then ${key} again. Keep ${key} steady.`).join(' ');
}
export function resetLearningProgress(progress) {
  return { ...emptyProgress(), settings: { ...progress.settings }, savedPassages: [...(progress.savedPassages || [])] };
}

export function resultCardLines(stats, settings, interrupted) {
  const mode = settings.mode === 'time' ? `${settings.duration}-second test` : settings.mode === 'words' ? `${settings.wordCount}-word test` : settings.mode === 'custom' ? 'Custom passage practice' : 'Guided key practice';
  return [
    'Typedo', `${stats.wpm} WPM`, `${stats.accuracy}% accuracy`,
    `${stats.errors} ${stats.errors === 1 ? 'mistake' : 'mistakes'} | ${stats.raw} raw WPM`, mode,
    ['time', 'words'].includes(settings.mode) ? `Punctuation: ${settings.punctuation ? 'on' : 'off'} | Numbers: ${settings.numbers ? 'on' : 'off'}` : 'Personal practice result',
    interrupted ? 'Paused attempt - practice only' : 'Self-reported local result',
    'Made by sunaissu',
  ];
}
