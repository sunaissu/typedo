import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptMistakes, keyEvidence, mistakePassage, resetLearningProgress, resultCardLines } from '../src/resultInsights.js';
import { emptyProgress } from '../src/storage.js';
import { PRACTICE_TRACKS, normalizePassage } from '../src/practiceLibrary.js';

test('attempt feedback counts corrected misses, exact case and space without inventing evidence', () => {
  const stats = { a: { attempts: 8, errors: 2 }, A: { attempts: 1, errors: 1 }, ' ': { attempts: 5, errors: 3 }, z: { attempts: 0, errors: 0 }, b: { attempts: 2, errors: 9 } };
  assert.deepEqual(attemptMistakes(stats).map(item => item.key), [' ', 'a', 'A']);
  assert.equal(keyEvidence(stats).length, 3);
  const drill = mistakePassage(stats);
  assert.ok(drill.includes('one small step'));
  assert.ok(drill.includes('Try a once.'));
  assert.ok(drill.includes('Try A once.'));
  assert.equal(mistakePassage({}), '');
});

test('reset clears every learning record while retaining settings and authored passages', () => {
  const progress = emptyProgress();
  for (const field of ['keyStats', 'lessonProgress', 'lessonLearning', 'storyProgress', 'storyDrafts', 'lessonDrafts', 'workspaceDrafts']) progress[field] = { old: {} };
  progress.history = [{ id: 'prior' }];
  progress.savedPassages = [{ id: 'keep' }];
  progress.lastBackupAt = new Date().toISOString();
  progress.settings.theme = 'light';
  const reset = resetLearningProgress(progress);
  for (const field of ['keyStats', 'lessonProgress', 'lessonLearning', 'storyProgress', 'storyDrafts', 'lessonDrafts', 'workspaceDrafts']) assert.deepEqual(reset[field], {});
  assert.deepEqual(reset.history, []);
  assert.equal(reset.settings.theme, 'light');
  assert.deepEqual(reset.savedPassages, [{ id: 'keep' }]);
  assert.equal(reset.lastBackupAt, undefined);
  assert.equal(progress.history.length, 1);
});

test('result cards label interrupted attempts and omit profile and passage contents', () => {
  const settings = { mode: 'time', duration: 30, punctuation: true, numbers: false, customText: 'private text', profileName: 'private name' };
  const lines = resultCardLines({ wpm: 44, accuracy: 97, raw: 46, errors: 3 }, settings, true);
  assert.ok(lines.includes('Paused attempt - practice only'));
  assert.ok(lines.includes('30-second test'));
  assert.ok(lines.includes('Punctuation: on | Numbers: off'));
  assert.ok(!lines.join(' ').includes('private'));
});

test('English library passages have unique identifiers and need no input normalization', () => {
  assert.equal(new Set(PRACTICE_TRACKS.map(item => item.id)).size, PRACTICE_TRACKS.length);
  for (const item of PRACTICE_TRACKS) assert.equal(normalizePassage(item.text).text, item.text, item.id);
});
