import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let dom, server, React, createRoot, Lessons, root;
const globals = new Map();
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: Lessons } = await server.ssrLoadModule('/src/Lessons.jsx'));
});
afterEach(async () => { if (root) await React.act(async () => root.unmount()); root = null; });
after(async () => {
  await server?.close(); dom?.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});
const button = (label, scope = document) => [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === label);
const input = () => document.querySelector('.lesson-typing-card textarea');
const prompt = () => document.querySelector('#lesson-accessible-prompt').textContent.replace('Text to type: ', '');
async function mount(props = {}) {
  root = createRoot(document.querySelector('#root'));
  await React.act(async () => root.render(React.createElement(Lessons, props)));
}
async function frame() { await React.act(async () => new Promise(resolve => requestAnimationFrame(resolve))); }
async function click(element) {
  assert.ok(element, 'Expected action is present');
  await React.act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  await frame();
}
async function key(element, key, modifiers = {}) {
  const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
  await React.act(async () => element.dispatchEvent(event));
  return event;
}
async function type(text) {
  await React.act(async () => {
    const target = input();
    for (const key of text) target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

test('lessons start focused, preserve native Tab, and Escape pauses without clearing work', async () => {
  const drafts = {};
  await mount({ onDraftChange: (id, draft) => { if (draft) drafts[id] = draft; else delete drafts[id]; } });
  assert.equal(document.activeElement, input());
  assert.equal(document.querySelector('.lesson-outline').open, false);
  const passage = prompt();
  await type(passage.slice(0, 5));
  const tab = await key(input(), 'Tab');
  assert.equal(tab.defaultPrevented, false, 'Tab follows document order instead of jumping to restart');
  await key(input(), 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Practice paused');
  assert.equal(document.activeElement, button('Resume typing', document.querySelector('dialog')));
  const before = drafts['find-home'];
  assert.equal(before.typed, passage.slice(0, 5));
  await key(document.activeElement, 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.activeElement, input());
  assert.equal(drafts['find-home'].elapsed, before.elapsed);
  await key(input(), passage[5]);
  assert.equal(drafts['find-home'].typed, passage.slice(0, 6));
});

test('retry requests confirmation and cancelling preserves the current run and mistake history', async () => {
  let draft;
  await mount({ onDraftChange: (_, next) => { draft = next; } });
  const passage = prompt();
  await key(input(), 'x');
  await type(passage.slice(0, 3));
  const before = draft;
  await key(input(), 'Enter', { shiftKey: true });
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Restart this attempt?');
  assert.equal(document.activeElement, button('Keep practicing'));
  await click(button('Keep practicing'));
  assert.equal(draft.runId, before.runId);
  assert.equal(draft.attempts, before.attempts);
  assert.deepEqual(draft.keyStats, before.keyStats);
  await key(input(), 'Enter', { shiftKey: true });
  await click(button('Restart attempt'));
  assert.equal(draft, null);
  assert.equal(document.activeElement, input());
});

test('Escape on native lesson preferences leaves their keyboard behavior alone', async () => {
  await mount();
  await type(prompt().slice(0, 3));
  const select = document.querySelector('select[aria-label="Lesson theme"]');
  await React.act(async () => select.focus());
  const event = await key(select, 'Escape');
  assert.equal(event.defaultPrevented, false);
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.querySelectorAll('.char.correct').length, 3);
});

test('lesson switching and remounting restore the exact block before recording its stable run once', async () => {
  let drafts = {};
  const results = [];
  const props = { onComplete: result => results.push(result), onDraftChange: (id, next) => { if (next) drafts[id] = next; else delete drafts[id]; } };
  await mount(props);
  const passage = prompt();
  await type(passage.slice(0, 8));
  const runId = drafts['find-home'].runId;
  await click([...document.querySelectorAll('.lesson-course-card')][1]);
  assert.equal(document.activeElement, input(), 'Selecting another lesson moves to its typing input');
  await type(prompt().slice(0, 3));
  assert.ok(drafts['find-home']);
  assert.ok(drafts['home-row']);
  await React.act(async () => root.unmount()); root = null;
  await mount({ ...props, lessonDrafts: drafts, initialLessonId: 'find-home' });
  assert.equal(prompt(), passage);
  await click(button('Resume typing', document.querySelector('dialog')));
  await type(passage.slice(8));
  assert.equal(results.length, 1);
  assert.equal(results[0].id, runId);
  assert.equal(drafts['find-home'], undefined);
  assert.equal(document.activeElement, button('Next block'));
  await key(document.activeElement, 'Escape');
  assert.equal(results.length, 1);
  assert.equal(document.querySelector('dialog'), null, 'Escape leaves completed results intact');
  await key(document.activeElement, 'Enter');
  await frame();
  assert.equal(document.querySelector('.lesson-workspace').dataset.round, '1');
  assert.equal(document.activeElement, input());
});

test('an assessment interrupted by leaving input completes as practice without pass credit', async () => {
  const results = [];
  await mount({ onComplete: result => results.push(result) });
  await click(button('Optional test'));
  const passage = prompt();
  await type(passage.slice(0, 3));
  await React.act(async () => button('Shortcuts').focus());
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Practice paused');
  assert.match(document.querySelector('dialog').textContent, /count as practice/);
  await click(button('Resume typing', document.querySelector('dialog')));
  await type(passage.slice(3));
  assert.equal(results.length, 1);
  assert.equal(results[0].interrupted, true);
  assert.equal(results[0].passed, false);
  assert.equal(results[0].assessmentPassed, false);
  assert.equal(document.querySelector('.lesson-result h3').textContent, 'Practice complete after a break');
  assert.doesNotMatch(document.querySelector('.lesson-result-copy').textContent, /Try a guided review/);
});
