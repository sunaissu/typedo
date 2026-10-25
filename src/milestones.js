import { LESSON_COURSE, lessonPracticeComplete } from './lessons.js';
import { STORIES } from './stories.js';

export function getMilestones(progress = {}) {
  const lessons = LESSON_COURSE.filter(item => lessonPracticeComplete(progress.lessonProgress?.[item.id])).length;
  const stories = STORIES.filter(item => progress.storyProgress?.[item.id]?.completedChapters === item.chapters.length).length;
  const retained = Object.values(progress.lessonLearning || {}).some(item => Boolean(item.retainedAt));
  return [
    { id: 'first-block', title: 'First block complete', detail: 'Finish one guided practice block.', earned: Object.values(progress.lessonProgress || {}).some(item => item.practiceRounds > 0 || item.practiced) },
    { id: 'three-lessons', title: 'Building a habit', detail: 'Complete three lessons. Unlock the forest accent.', earned: lessons >= 3, accent: 'forest' },
    { id: 'first-story', title: 'An ending reached', detail: 'Finish a whole story. Unlock the plum accent.', earned: stories >= 1, accent: 'plum' },
    { id: 'later-check', title: 'Remembered later', detail: 'Complete a successful later check without hints.', earned: retained },
  ];
}

export function backupReminderDue(progress = {}, now = new Date()) {
  if ((progress.history || []).length < 5) return false;
  const last = Math.max(Date.parse(progress.lastBackupAt || '') || 0, Date.parse(progress.settings?.backupReminderDismissedAt || '') || 0);
  return new Date(now).getTime() - last >= 7 * 86400000;
}
