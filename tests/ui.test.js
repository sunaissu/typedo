import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { emptyProgress, STORAGE_KEY } from '../src/storage.js';
import { LESSON_COURSE } from '../src/lessons.js';

let dom;
let server;
let React;
let createRoot;
let App;
let Lessons;
let root;
const originalGlobals = new Map();

before(async () => {
  dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  ({ default: App } = await server.ssrLoadModule('/src/App.jsx'));
  ({ default: Lessons } = await server.ssrLoadModule('/src/Lessons.jsx'));
  const style = document.createElement('style');
  // Network fonts do not affect behavior or the background/theme regression.
  style.textContent = (await Promise.all(['styles.css', 'shell.css', 'lessons.css'].map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n').replace(/^@import[^\n]*(?:\n|$)/gm, '');
  document.head.append(style);
});

afterEach(async () => {
  if (root) await React.act(async () => root.unmount());
  root = null;
  dom.window.localStorage.clear();
});

after(async () => {
  await server?.close();
  dom?.window.close();
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

async function mount(Component = App, props = {}) {
  root = createRoot(document.querySelector('#root'));
  await React.act(async () => root.render(React.createElement(Component, props)));
}

async function click(element) {
  assert.ok(element, 'Expected control is available');
  await React.act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
}

function button(text, scope = document) {
  return [...scope.querySelectorAll('button')].find(element => typeof text === 'string' ? element.textContent.trim() === text : text.test(element.textContent.trim()));
}

async function key(target, value, modifiers = {}) {
  assert.ok(target, 'Typing input is available');
  await React.act(async () => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers })));
}

async function typeText(input, text) {
  await React.act(async () => {
    for (const value of text) input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  });
}

test('theme switches the page palette and survives an app reload', async () => {
  await mount();
  assert.equal(document.documentElement.dataset.theme, 'dark');
  const darkBackground = dom.window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  assert.ok(darkBackground, 'Dark theme defines a page background');

  await click(document.querySelector('[aria-label="Use light theme"]'));
  assert.equal(document.documentElement.dataset.theme, 'light');
  const lightBackground = dom.window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  assert.ok(lightBackground);
  assert.notEqual(lightBackground, darkBackground, 'The theme must change the background, not only icons and text');

  // jsdom does not consistently resolve custom properties in background paint.
  // Check that both the document and body actually consume the page background.
  for (const element of [document.documentElement, document.body]) {
    const style = dom.window.getComputedStyle(element);
    assert.ok([style.background, style.backgroundColor].some(value => value.includes('var(--bg)') || (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent')), `${element.tagName} has a themed background`);
  }

  await React.act(async () => root.unmount());
  root = null;
  await mount();
  assert.equal(document.documentElement.dataset.theme, 'light', 'Explicit theme selection is saved');
  await click(document.querySelector('[aria-label="Use dark theme"]'));
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(dom.window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), darkBackground);
});

test('a completed typing test saves once and the keyboard restart is immediately usable', async () => {
  const progress = emptyProgress();
  progress.settings = { ...progress.settings, mode: 'custom', customText: 'fj' };
  dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mount();
  const input = document.querySelector('[aria-label="Typing input"]');
  await key(input, 'f');
  await key(input, 'j');
  let saved = JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].accuracy, 100);
  assert.equal(saved.history[0].correct, 2);
  assert.ok(button('Go again'), 'Completion provides another run in one click');

  await key(window, 'Enter', { ctrlKey: true });
  assert.ok(document.querySelector('[aria-label="Typing input"]'));
  saved = JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.history.length, 1, 'Restart does not duplicate a saved result');
});

test('a lesson guides corrections, tests without hints, and reports each completed stage once', async () => {
  const completed = [];
  const lesson = LESSON_COURSE[0];
  await mount(Lessons, { onComplete: result => completed.push(result), onBack: () => {} });
  let input = document.querySelector('textarea');
  assert.ok(document.querySelector('[aria-label="QWERTY keyboard finger guide"]'));
  await key(input, 'x');
  assert.equal(document.querySelector('.char.current').textContent, lesson.practice[0], 'Incorrect drill input waits for the expected character');
  await key(input, 'Escape');
  assert.equal(completed.length, 0, 'Resetting an unfinished drill does not record a completion');
  input = document.querySelector('textarea');
  await key(input, 'Tab');
  assert.equal(document.activeElement, button('Reset'), 'Tab reaches the quick reset control');
  await typeText(input, `${lesson.practice}x`);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].stage, 'practice');
  assert.equal(completed[0].passed, false);
  assert.equal(completed[0].correct, lesson.practice.length);
  await click(button('Take lesson test'));
  assert.equal(document.querySelector('[aria-label="QWERTY keyboard finger guide"]'), null, 'Assessment hides the finger guide');
  input = document.querySelector('textarea');
  await typeText(input, `x${lesson.test.slice(1)}x`);
  assert.equal(completed.length, 2, 'Each completed stage invokes its save callback exactly once');
  assert.equal(completed[1].stage, 'test');
  assert.equal(completed[1].passed, true);
  assert.equal(completed[1].errors, 1, 'Assessment accepts mistakes and counts them');
  assert.equal(completed[1].correct, lesson.test.length - 1);
  await click(button('Next lesson'));
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title);
  assert.ok(document.querySelector('textarea'));
});

test('lesson results persist through app reload and appear in the course and progress views', async () => {
  const lesson = LESSON_COURSE[0];
  await mount();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('2. Lesson test'));
  await typeText(document.querySelector('textarea'), lesson.test);
  const saved = JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].mode, 'lesson');
  assert.equal(saved.history[0].lessonId, lesson.id);
  assert.equal(saved.lessonProgress[lesson.id].passed, true);
  assert.equal(saved.lessonProgress[lesson.id].attempts, 1);

  await React.act(async () => root.unmount());
  root = null;
  await mount();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('[aria-label="Choose a typing lesson"]').textContent, /Test passed/);
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title, 'Next unpassed lesson is selected on return');
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('tbody').textContent, new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY)).history.length, 1);
});

