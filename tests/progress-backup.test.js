import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BACKUP_BYTES, readProgressBackup, serializeProgressBackup } from '../src/progressBackup.js';
import { emptyProgress, validateProgress } from '../src/storage.js';
import { createSession, enterKey, pauseSession } from '../src/typing.js';
import { createWorkspaceDraft, workspaceKey } from '../src/workspaceDrafts.js';
import { createLessonDraft } from '../src/lessonDrafts.js';
import { LESSON_COURSE } from '../src/lessons.js';
import { buildLessonBlock } from '../src/lessonPractice.js';

function sampleHeavyProfile() {
  const progress = emptyProgress();
  const date = '2026-10-27T00:00:00.000Z';
  for (let index = 0; index < 100; index++) {
    const text = `Example ${index}: ` + 'a'.repeat(1400);
    const config = { ...progress.settings, mode: 'custom', customText: text };
    let session = { ...createSession(text), runId: `workspace-${index}` };
    session = enterKey(session, text[0], config, 1000);
    session = pauseSession(session, config, 1001000);
    session.samples = Array.from({ length: 1000 }, (_, second) => ({ second: second + 1, wpm: 1 }));
    const draft = createWorkspaceDraft(session, config, date);
    assert.ok(draft);
    progress.workspaceDrafts[workspaceKey(config)] = draft;
  }
  for (const lesson of LESSON_COURSE) {
    const block = buildLessonBlock(lesson.id, 0, { random: () => 0 });
    const run = { stage: 'practice', practiceKind: 'lesson', roundIndex: 0, guided: true, block };
    const config = { mode: 'practice', strict: true };
    let session = { ...createSession(block.text), runId: `lesson-${lesson.id}` };
    session = enterKey(session, block.text[0], config, 1000);
    session = pauseSession(session, config, 7201000);
    session.samples = Array.from({ length: 7200 }, (_, second) => ({ second: second + 1, wpm: 1 }));
    progress.lessonDrafts[lesson.id] = createLessonDraft(lesson.id, run, session, date);
    assert.ok(progress.lessonDrafts[lesson.id]);
  }
  return progress;
}

test('a valid profile with the maximum retained draft/sample counts exports and restores without losing progress', async () => {
  const profile = sampleHeavyProfile();
  assert.deepEqual(validateProgress(profile), profile, 'The fixture is already valid without filtering or truncation');
  assert.equal(Object.keys(profile.workspaceDrafts).length, 100);
  assert.equal(Object.keys(profile.lessonDrafts).length, LESSON_COURSE.length);
  const exported = new Blob([serializeProgressBackup(profile)], { type: 'application/json' });
  assert.ok(exported.size > 2_000_000, 'This valid backup exceeded the former import limit');
  assert.ok(exported.size < MAX_BACKUP_BYTES);
  assert.deepEqual(validateProgress(await readProgressBackup(exported)), profile);

  const legacyExport = new Blob([JSON.stringify(profile, null, 2)]);
  assert.ok(legacyExport.size > exported.size);
  assert.deepEqual(validateProgress(await readProgressBackup(legacyExport)), profile, 'Existing indented exports remain restorable');
});

test('oversized uploads are rejected before reading file contents', async () => {
  let reads = 0;
  await assert.rejects(readProgressBackup({ size: MAX_BACKUP_BYTES + 1, text() { reads++; return '{}'; } }), /64 MiB or smaller/);
  assert.equal(reads, 0);
});

test('both directions apply the shared limit to UTF-8 bytes rather than JavaScript character count', async () => {
  const profile = { note: '\u00e9'.repeat(MAX_BACKUP_BYTES / 2) };
  const text = JSON.stringify(profile);
  assert.ok(text.length < MAX_BACKUP_BYTES);
  assert.ok(new Blob([text]).size > MAX_BACKUP_BYTES);
  assert.throws(() => serializeProgressBackup(profile), /64 MiB or smaller/);
  await assert.rejects(readProgressBackup({ size: text.length, text: async () => text }), /64 MiB or smaller/);
});

test('small Unicode titles keep their exact text through export and restore', async () => {
  const profile = emptyProgress();
  profile.savedPassages = [{ id: 'saved-passage', title: 'Caf\u00e9 \u{1f44d}', text: 'Keep this passage.', createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:00.000Z' }];
  const validated = validateProgress(profile);
  assert.equal(validated.savedPassages[0].title, profile.savedPassages[0].title);
  assert.deepEqual(await readProgressBackup(new Blob([serializeProgressBackup(validated)])), validated);
});
