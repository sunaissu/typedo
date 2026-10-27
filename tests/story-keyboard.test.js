import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { STORIES, getStoryChapter } from '../src/stories.js';

let dom, server, React, createRoot, Stories, root;
const originals = new Map();

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: Stories } = await server.ssrLoadModule('/src/Stories.jsx'));
});

afterEach(async () => {
  if (root) await React.act(async () => root.unmount());
  root = null;
});

after(async () => {
  await server?.close();
  dom?.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

async function render(props = {}) {
  if (!root) root = createRoot(document.querySelector('#root'));
  await React.act(async () => root.render(React.createElement(Stories, props)));
  await frame();
}
async function frame() { await React.act(async () => new Promise(resolve => requestAnimationFrame(resolve))); }
async function key(target, key, modifiers = {}) {
  await React.act(async () => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers })));
}
async function click(target) {
  assert.ok(target, 'Expected action is present');
  await React.act(async () => target.click());
  await frame();
}
const button = (text, scope = document) => [...scope.querySelectorAll('button')].find(item => typeof text === 'string' ? item.textContent.trim() === text : text.test(item.textContent));
const typedCount = () => document.querySelectorAll('.story-type-surface .char.correct, .story-type-surface .char.incorrect').length;

test('Home can open a story at the exact saved caret, focused without a pointer', async () => {
  const story = STORIES[0];
  const draft = { runId: 'home-story', chapterIndex: 0, text: story.chapters[0].text, typed: 'On ',
    attempts: 3, correctAttempts: 3, keyStats: { O: { attempts: 1, errors: 0 }, n: { attempts: 1, errors: 0 }, ' ': { attempts: 1, errors: 0 } }, elapsed: 2300, updatedAt: '2026-10-25T09:00:00.000Z' };
  await render({ initialStoryId: story.id, storyDrafts: { [story.id]: draft }, guideEnabled: false });
  assert.equal(document.activeElement, document.querySelector('textarea'));
  assert.equal(typedCount(), 3);
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  await key(document.activeElement, story.chapters[0].text[3]);
  assert.equal(typedCount(), 4);
});

test('Escape pauses, rejects typing, and resumes without counting the break or the resume key', async context => {
  let clock = 100;
  context.mock.method(performance, 'now', () => clock);
  const saves = [];
  const completed = [];
  await render({ initialStoryId: STORIES[0].id, onDraftChange: (...args) => saves.push(args), onComplete: value => completed.push(value) });
  let input = document.querySelector('textarea');
  await key(input, 'x');
  clock = 400;
  await key(input, 'Backspace');
  await key(input, 'O');
  clock = 1000;
  await key(input, 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog')?.getAttribute('aria-label'), 'Practice paused');
  assert.equal(document.activeElement, button('Resume typing', document.querySelector('dialog')));
  const paused = saves.at(-1)[1];
  assert.equal(paused.attempts, 2);
  assert.equal(paused.correctAttempts, 1);
  assert.equal(paused.elapsed, 900);
  clock = 60000;
  await key(input, 'n');
  assert.equal(typedCount(), 1);
  await key(document.activeElement, 'Escape', { repeat: true });
  assert.ok(document.querySelector('dialog'), 'A held Escape cannot repeatedly toggle pause');
  await key(document.activeElement, 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.activeElement, input);
  assert.equal(typedCount(), 1);
  await key(input, 'n');
  assert.equal(saves.at(-1)[1].elapsed, paused.elapsed);
  assert.equal(saves.at(-1)[1].attempts, 3);
  assert.equal(saves.at(-1)[1].correctAttempts, 2);
  assert.deepEqual(completed, []);
});

test('Shift+Enter confirms a partial retry and cancellation restores typing', async () => {
  const saves = [];
  await render({ initialStoryId: STORIES[0].id, onDraftChange: (...args) => saves.push(args) });
  const input = document.querySelector('textarea');
  await key(input, 'O');
  await key(input, 'Enter', { shiftKey: true, repeat: true });
  assert.equal(document.querySelector('dialog'), null);
  await key(input, 'Enter', { shiftKey: true });
  await frame();
  assert.equal(document.querySelector('dialog')?.getAttribute('aria-label'), 'Restart this attempt?');
  assert.equal(document.activeElement, button('Keep practicing'));
  assert.equal(typedCount(), 1);
  await click(button('Keep practicing'));
  assert.equal(document.activeElement, input);
  assert.equal(typedCount(), 1);
  await key(input, 'Enter', { shiftKey: true });
  await click(button('Restart attempt'));
  assert.equal(typedCount(), 0);
  assert.equal(saves.at(-1)[1], null);
});

test('settings suspension pauses and saves, leaving only one pause dialog after settings closes', async () => {
  const saves = [];
  const props = { initialStoryId: STORIES[1].id, onDraftChange: (...args) => saves.push(args) };
  await render(props);
  await key(document.querySelector('textarea'), 'A');
  await render({ ...props, suspended: true });
  assert.equal(document.querySelector('dialog'), null, 'Root settings owns the modal while suspended');
  assert.match(document.querySelector('.story-session-state').textContent, /PAUSED/);
  assert.equal(saves.at(-1)[1].typed, 'A');
  await key(document.querySelector('textarea'), 't');
  assert.equal(typedCount(), 1);
  await render(props);
  assert.equal(document.querySelectorAll('dialog').length, 1);
  await click(button('Finish for now'));
  assert.ok(document.querySelector('.story-library'));
  assert.equal(document.activeElement, button('Resume chapter 1'));
  await click(button('Resume chapter 1'));
  assert.equal(typedCount(), 1);
  assert.equal(document.activeElement, document.querySelector('textarea'));
});

test('story discovery has native labeled filters and a clear empty state', async () => {
  await render();
  const genre = [...document.querySelectorAll('.story-filters label')].find(item => item.textContent.startsWith('Genre')).querySelector('select');
  await React.act(async () => { genre.value = 'Science fiction'; genre.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(document.querySelectorAll('.story-book').length, 2);
  assert.match(document.querySelector('.story-book h2').textContent, /garden/);
  assert.ok([...document.querySelectorAll('.story-book h2')].some(item => item.textContent === 'Postcards from the night shift'));
  const completion = [...document.querySelectorAll('.story-filters label')].find(item => item.textContent.startsWith('Your progress')).querySelector('select');
  await React.act(async () => { completion.value = 'finished'; completion.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(document.querySelectorAll('.story-book').length, 0);
  assert.match(document.querySelector('.story-empty').textContent, /No stories match/);
  await click(button('Clear filters'));
  assert.equal(document.querySelectorAll('.story-book').length, STORIES.length);
});

test('an ending choice is keyboard reachable and resumes the selected passage even before the first key', async () => {
  const story = STORIES.find(item => item.id === 'pip-cloud-route');
  const saved = { [story.id]: { completedChapters: 2, attempts: 2, bestAccuracy: 100, lastPracticed: '2026-10-24T12:00:00.000Z' } };
  const drafts = [];
  const completed = [];
  const props = { initialStoryId: story.id, storyProgress: saved, onDraftChange: (_id, draft) => drafts.push(draft), onComplete: result => completed.push(result) };
  await render(props);
  assert.ok(document.querySelector('.story-choice'));
  assert.equal(document.querySelector('textarea'), null);
  assert.equal(document.activeElement, button(/^Visit the telescope room/));
  const alternate = button(/^Help repair the trail sign/);
  await React.act(async () => alternate.focus());
  await key(alternate, 'Enter');
  await frame();
  assert.equal(document.activeElement, document.querySelector('textarea'));
  assert.equal(drafts.at(-1).route, 'trail');
  assert.equal(drafts.at(-1).attempts, 0);
  assert.deepEqual(completed, []);
  const chosen = structuredClone(drafts.at(-1));
  await React.act(async () => root.unmount()); root = null;
  await render({ ...props, storyDrafts: { [story.id]: chosen } });
  assert.equal(document.querySelector('.story-choice'), null);
  assert.match(document.querySelector('.story-chapter-heading').textContent, /A light along the path/);
  assert.equal(document.querySelector('#story-accessible-prompt').textContent, `Text to type: ${getStoryChapter(story, 2, 'trail').text}`);
  await key(document.querySelector('textarea'), 'T');
  await key(document.querySelector('textarea'), 'Escape');
  await frame();
  assert.equal(drafts.at(-1).route, 'trail');
  await click(button('Resume typing', document.querySelector('dialog')));
  const input = document.querySelector('textarea');
  await React.act(async () => {
    for (const key of getStoryChapter(story, 2, 'trail').text.slice(1)) input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
  assert.equal(completed.length, 1);
  assert.equal(completed[0].route, 'trail');
  assert.equal(completed[0].id, chosen.runId);
  assert.match(document.querySelector('.story-result').textContent, /Your ending: A light along the path/);
});

test('an explicit reread keeps completed credit and offers a different ending after the common chapters', async () => {
  const story = STORIES.find(item => item.id === 'pip-cloud-route');
  const records = [];
  await render({ initialStoryId: story.id, storyProgress: { [story.id]: { completedChapters: 3, attempts: 3, bestAccuracy: 100, route: 'trail', lastPracticed: '2026-10-24T12:00:00.000Z' } }, onComplete: result => records.push(result) });
  for (let index = 0; index < 2; index++) {
    const input = document.querySelector('textarea');
    await React.act(async () => {
      for (const key of story.chapters[index].text) input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
    await click(button('Next chapter'));
  }
  assert.ok(document.querySelector('.story-choice'));
  assert.equal(records.length, 2);
  assert.ok(records.every(result => result.route === undefined));
  await key(document.activeElement, 'Enter');
  await frame();
  assert.equal(document.querySelector('#story-accessible-prompt').textContent, `Text to type: ${story.chapters[2].text}`);
  await click(button('Story library'));
  const book = [...document.querySelectorAll('.story-book')].find(item => item.querySelector('h2').textContent === story.title);
  assert.ok(book.classList.contains('complete'));
  assert.match(book.textContent, /Chosen ending: A different kind of light/);
  await click(button('Resume chapter 3', book));
  assert.equal(document.querySelector('#story-accessible-prompt').textContent, `Text to type: ${story.chapters[2].text}`);
});
