import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, enterKey, pauseSession, resumeSession, tick } from '../src/typing.js';
import { createWorkspaceDraft, restoreWorkspaceSession, sanitizeWorkspaceDrafts, workspaceKey } from '../src/workspaceDrafts.js';
import { DEFAULT_SETTINGS } from '../src/storage.js';

test('pause preserves mistakes, excludes time away and waits for an explicit resume', () => {
  const config = { mode: 'custom' };
  let run = enterKey(createSession('a cat'), 'x', config, 1000);
  run = pauseSession(run, config, 1500);
  assert.equal(run.status, 'paused');
  assert.equal(run.elapsed, 500);
  assert.deepEqual(enterKey(run, 'a', config, 9000), run);
  assert.deepEqual(tick(run, config, 9000), run);
  run = resumeSession(run);
  run = enterKey(run, 'Backspace', config, 10000);
  run = enterKey(run, 'a', config, 11000);
  assert.equal(run.elapsed, 500);
  run = tick(run, config, 12000);
  assert.equal(run.elapsed, 1500);
  assert.equal(run.attempts, 2);
  assert.equal(run.correctAttempts, 1);
});

test('pause checks a timed deadline before classifying interruptions', () => {
  const config = { mode: 'time', duration: 15 };
  const running = enterKey(createSession('a long passage'), 'a', config, 1000);
  const paused = pauseSession(running, config, 2000, { interrupt: true });
  assert.equal(paused.interrupted, true);
  const expired = pauseSession(running, config, 16001, { interrupt: true });
  assert.equal(expired.status, 'finished');
  assert.equal(expired.elapsed, 15000);
  assert.ok(!expired.interrupted);
});

test('workspace drafts validate evidence, restore interrupted tests and reject completed identities', () => {
  const config = { ...DEFAULT_SETTINGS };
  let run = { ...createSession('a little story'), runId: 'test-run' };
  run = enterKey(run, 'x', config, 1000);
  run = enterKey(run, 'Backspace', config, 1050);
  run = enterKey(run, 'a', config, 1100);
  run = pauseSession(run, config, 1300);
  const draft = createWorkspaceDraft(run, config);
  assert.ok(draft);
  const restored = restoreWorkspaceSession(draft);
  assert.equal(restored.status, 'paused');
  assert.equal(restored.typed, 'a');
  assert.equal(restored.attempts, 2);
  assert.equal(restored.interrupted, true);
  assert.equal(restored.elapsed, 300);
  assert.deepEqual(sanitizeWorkspaceDrafts({ [workspaceKey(config)]: draft }, [{ id: 'test-run' }]), {});
  assert.equal(restoreWorkspaceSession({ ...draft, correctAttempts: 2 }), null);
});
