import { keyGuide } from './typing.js';

const printableKey = key => typeof key === 'string' && /^[\x20-\x7e]$/.test(key);
const punctuation = {
  '!': 'exclamation mark', '"': 'double quote', '#': 'hash', '$': 'dollar sign', '%': 'percent sign',
  '&': 'ampersand', "'": 'apostrophe', '(': 'opening parenthesis', ')': 'closing parenthesis',
  '*': 'asterisk', '+': 'plus sign', ',': 'comma', '-': 'hyphen', '.': 'period', '/': 'slash',
  ':': 'colon', ';': 'semicolon', '<': 'less-than sign', '=': 'equals sign', '>': 'greater-than sign',
  '?': 'question mark', '@': 'at sign', '[': 'opening bracket', '\\': 'backslash', ']': 'closing bracket',
  '^': 'caret', '_': 'underscore', '`': 'backtick', '{': 'opening brace', '|': 'vertical bar',
  '}': 'closing brace', '~': 'tilde',
};

export function keyLabel(key) {
  if (!printableKey(key)) return '';
  if (key === ' ') return 'Space';
  if (/^[a-z]$/.test(key)) return `lowercase ${key}`;
  if (/^[A-Z]$/.test(key)) return `capital ${key}`;
  return punctuation[key] ? `${punctuation[key]} (${key})` : key;
}

export function keyInstruction(key) {
  if (!printableKey(key)) return '';
  const { base, finger, shift } = keyGuide(key);
  if (base === ' ') return 'Press the Space bar with either thumb.';
  const physicalKey = /^[a-z]$/.test(base) ? base.toUpperCase() : keyLabel(base);
  const press = `press the ${physicalKey} key with your ${finger.label.toLowerCase()} finger`;
  if (shift) return `Hold ${shift} with your ${shift === 'Left Shift' ? 'left' : 'right'} pinky, then ${press}.`;
  return `Press the ${physicalKey} key with your ${finger.label.toLowerCase()} finger.`;
}

export function getRepeatedErrorFeedback(session) {
  if (!session || session.status !== 'running' || !Number.isSafeInteger(session.wrongStreak) || session.wrongStreak < 2
    || !printableKey(session.lastWrong) || !printableKey(session.lastWrongKey)
    || session.lastWrongPosition !== session.typed?.length || session.text?.[session.lastWrongPosition] !== session.lastWrong) return null;
  return {
    expected: session.lastWrong,
    pressed: session.lastWrongKey,
    message: `You pressed ${keyLabel(session.lastWrongKey)}; expected ${keyLabel(session.lastWrong)}.`,
    instruction: keyInstruction(session.lastWrong),
  };
}

export function getLessonFeedback(keyStats) {
  if (!keyStats || typeof keyStats !== 'object' || Array.isArray(keyStats)) return null;
  const keys = Object.entries(keyStats)
    .filter(([key, stats]) => printableKey(key) && stats && Number.isSafeInteger(stats.attempts) && Number.isSafeInteger(stats.errors)
      && stats.attempts >= 8 && stats.errors >= 2 && stats.errors <= stats.attempts && stats.errors / stats.attempts >= .1)
    .map(([key, stats]) => ({ key, label: keyLabel(key), attempts: stats.attempts, errors: stats.errors, errorRate: stats.errors / stats.attempts, instruction: keyInstruction(key) }))
    .sort((first, second) => second.errorRate - first.errorRate || second.errors - first.errors || first.key.charCodeAt(0) - second.key.charCodeAt(0))
    .slice(0, 2);
  if (!keys.length) return null;
  return {
    title: 'Keys to revisit',
    summary: keys.map(item => `${item.label}: ${item.errors} mistakes in ${item.attempts} attempts`).join('; ') + '.',
    keys,
    actionLabel: 'Practise this block again',
  };
}
