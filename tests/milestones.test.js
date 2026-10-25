import test from 'node:test';
import assert from 'node:assert/strict';
import { backupReminderDue, getMilestones } from '../src/milestones.js';
import { LESSON_COURSE } from '../src/lessons.js';
import { STORIES } from '../src/stories.js';

test('milestones use retained course and story credit even when old history is gone', () => {
  const progress = { history: [], lessonProgress: Object.fromEntries(LESSON_COURSE.slice(0,3).map(item => [item.id, { practiceRounds: 3, practiced: true }])), storyProgress: { [STORIES[0].id]: { completedChapters: 3 } } };
  assert.equal(getMilestones(progress).find(item => item.accent === 'forest').earned, true);
  assert.equal(getMilestones(progress).find(item => item.accent === 'plum').earned, true);
  assert.equal(getMilestones(progress).find(item => item.id === 'later-check').earned, false);
});
test('backup reminders respect a recent export or a dismissed reminder', () => {
  const progress = { history: Array.from({ length: 5 }, (_, i) => ({ id: String(i) })), settings: {} };
  const now = new Date('2026-10-25T12:00:00Z');
  assert.equal(backupReminderDue(progress, now), true);
  assert.equal(backupReminderDue({ ...progress, lastBackupAt: now.toISOString() }, now), false);
  assert.equal(backupReminderDue({ ...progress, settings: { backupReminderDismissedAt: '2026-10-24T12:00:00Z' } }, now), false);
});
