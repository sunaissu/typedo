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
let WordProgress;
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
  ({ WordProgress } = await server.ssrLoadModule('/src/TypingCoach.jsx'));
  const style = document.createElement('style');
  // Network fonts do not affect behavior or the background/theme regression.
  style.textContent = (await Promise.all(['styles.css', 'shell.css', 'lessons.css', 'coach.css'].map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n').replace(/^@import[^\n]*(?:\n|$)/gm, '');
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

function lessonText() {
  const prompt = document.querySelector('#lesson-accessible-prompt');
  assert.ok(prompt, 'The current lesson provides an accessible typing prompt');
  return prompt.textContent.replace(/^Text to type: /, '');
}

function savedProgress() {
  return JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY));
}

function seedSettings(settings) {
  const progress = emptyProgress();
  progress.settings = { ...progress.settings, ...settings };
  dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

async function reload() {
  await React.act(async () => root.unmount());
  root = null;
  await mount();
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
  await mount(Lessons, { onComplete: result => completed.push(result), onBack: () => {} });
  let input = document.querySelector('textarea');
  const firstPractice = lessonText();
  const card = document.querySelector('.lesson-typing-card');
  assert.ok(card.querySelector('[aria-label="Live finger guide"]'), 'Practice shows the hands beside the passage before typing');
  assert.ok(card.querySelector('#lesson-accessible-prompt'));
  await key(input, firstPractice[0] === 'x' ? 'z' : 'x');
  assert.equal(document.querySelector('.char.current').textContent, firstPractice[0], 'Incorrect practice input waits for the expected character');
  assert.equal(document.querySelectorAll('.char.correct, .char.incorrect').length, 0);
  await key(input, 'Escape');
  assert.equal(completed.length, 0, 'Resetting unfinished practice does not record a completion');
  const practice = lessonText();
  assert.notEqual(practice, firstPractice, 'Reset supplies a different authored passage');
  input = document.querySelector('textarea');
  await key(input, 'Tab');
  assert.equal(document.activeElement, button('Reset'), 'Tab reaches the quick reset control');
  await typeText(input, `${practice}x`);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].stage, 'practice');
  assert.equal(completed[0].passed, false);
  assert.equal(completed[0].errors, 0, 'Reset also clears previous mistakes');
  assert.equal(completed[0].correct, practice.length);
  await click(button('Take lesson test'));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null, 'Assessment hides the inline hands');
  assert.equal(document.querySelector('[aria-label="QWERTY keyboard finger guide"]'), null, 'Assessment hides the finger guide');
  assert.equal(document.querySelector('[aria-label="Typing assistance"]'), null, 'Assessment cannot enable hints');
  input = document.querySelector('textarea');
  const assessment = lessonText();
  const wrongKey = assessment[0] === 'x' ? 'z' : 'x';
  await typeText(input, `${wrongKey}${assessment.slice(1)}x`);
  assert.equal(completed.length, 2, 'Each completed stage invokes its save callback exactly once');
  assert.equal(completed[1].stage, 'test');
  assert.equal(completed[1].passed, true);
  assert.equal(completed[1].errors, 1, 'Assessment accepts mistakes and counts them');
  assert.equal(completed[1].correct, assessment.length - 1);
  await click(button('Next lesson'));
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title);
  assert.ok(document.querySelector('textarea'));
});

test('lesson results persist through app reload and appear in the course and progress views', async () => {
  const lesson = LESSON_COURSE[0];
  await mount();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('2. Lesson test'));
  await typeText(document.querySelector('textarea'), lessonText());
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

test('beginner hands appear with the prompt and follow each key, opposite-hand Shift, and space in focus mode', async () => {
  seedSettings({ mode: 'custom', customText: 'fJA x' });
  await mount();
  const card = document.querySelector('[aria-label="Typing workspace"]');
  const coach = card.querySelector('[aria-label="Live finger guide"]');
  assert.ok(coach, 'The default beginner workspace shows hands before the first keystroke');
  assert.ok(card.querySelector('#accessible-prompt'), 'The hands and the passage share the typing card');
  assert.equal(coach.closest('details'), null, 'The hands do not require opening a keyboard reference');
  assert.equal(document.querySelectorAll('.char.correct').length, 0);
  assert.equal(coach.querySelector('.coach-cue > kbd').textContent, 'f');
  assert.equal(coach.querySelector('.coach-digit.active').dataset.finger, 'li');
  assert.equal(coach.querySelector('.shift-active'), null);

  const input = document.querySelector('[aria-label="Typing input"]');
  await key(input, 'f');
  assert.equal(coach.querySelector('.coach-cue > kbd').textContent, 'J');
  assert.equal(coach.querySelector('.coach-digit.active').dataset.finger, 'ri');
  assert.equal(coach.querySelector('.shift-active').dataset.finger, 'lp');
  assert.match(coach.textContent, /Hold Left Shift with your pinky/);

  await click(document.querySelector('[aria-label="Enter focus mode"]'));
  assert.ok(document.querySelector('.app-shell.focus-mode'));
  assert.equal(card.querySelector('[aria-label="Live finger guide"]'), coach, 'Focus mode retains the live hands');
  assert.notEqual(dom.window.getComputedStyle(coach).display, 'none');
  assert.equal(document.querySelectorAll('.char.correct').length, 1, 'Focus mode preserves the typed passage');

  await key(input, 'J', { shiftKey: true });
  assert.equal(coach.querySelector('.coach-cue > kbd').textContent, 'A');
  assert.equal(coach.querySelector('.coach-digit.active').dataset.finger, 'lp');
  assert.equal(coach.querySelector('.shift-active').dataset.finger, 'rp');
  assert.match(coach.textContent, /Hold Right Shift with your pinky/);

  await key(input, 'A', { shiftKey: true });
  assert.equal(coach.querySelector('.coach-cue > kbd').textContent, 'Space');
  assert.equal(coach.querySelectorAll('.coach-thumb.active').length, 2, 'Either thumb can type space');
  assert.equal(coach.querySelector('.shift-active'), null);
  await key(input, ' ');
  assert.equal(coach.querySelector('.coach-cue > kbd').textContent, 'x');
  assert.equal(coach.querySelector('.coach-digit.active').dataset.finger, 'lr');
});

test('guidance choices preserve typing progress, persist on reload, and apply to lesson practice only', async () => {
  seedSettings({ mode: 'custom', customText: 'fjkl' });
  await mount();
  await key(document.querySelector('[aria-label="Typing input"]'), 'f');
  await click(button('Independent'));
  assert.equal(button('Independent').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.equal(document.querySelector('.char.current').textContent, 'j');
  assert.equal(document.querySelectorAll('.char.correct').length, 1, 'Hiding hands does not restart an active session');
  assert.equal(savedProgress().settings.guide, false);

  await click(button('Beginner'));
  assert.equal(button('Beginner').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('.coach-cue > kbd').textContent, 'j');
  assert.equal(document.querySelectorAll('.char.correct').length, 1, 'Restoring hands preserves the current position');
  assert.equal(savedProgress().settings.guide, true);
  await click(button('Independent'));
  await reload();
  assert.equal(button('Independent').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null, 'Independent choice survives reload');

  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(button('Independent').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null, 'The course respects the saved guide preference');
  const practice = lessonText();
  await typeText(document.querySelector('textarea'), practice.slice(0, 2));
  await click(button('Beginner'));
  assert.equal(document.querySelector('.coach-cue > kbd').textContent, practice[2] === ' ' ? 'Space' : practice[2]);
  assert.equal(document.querySelectorAll('.char.correct').length, 2, 'Enabling lesson guidance does not reset practice');
  assert.equal(savedProgress().settings.guide, true, 'Course guidance updates the shared saved preference');
  await click(button('2. Lesson test'));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.equal(document.querySelector('[aria-label="QWERTY keyboard finger guide"]'), null);
  assert.equal(document.querySelector('[aria-label="Typing assistance"]'), null);
  assert.equal(savedProgress().settings.guide, true, 'A hint-free test does not overwrite the beginner preference');
  await click(button('1. Word practice'));
  assert.ok(document.querySelector('[aria-label="Live finger guide"]'), 'Returning to practice restores the preferred guide');
});

test('word progress counts completed correct words and updates after corrections', async () => {
  await mount(WordProgress, { text: 'cat dog fin', typed: '' });
  async function check(typed, count, reason) {
    await React.act(async () => root.render(React.createElement(WordProgress, { text: 'cat dog fin', typed })));
    assert.equal(document.querySelector('.word-progress').getAttribute('aria-label'), `${count} of 3 words complete`, reason);
  }
  await check('ca', 0, 'A partial word is not complete');
  await check('cat', 0, 'A word boundary completes a nonfinal word');
  await check('cat ', 1, 'Completing a correct word advances progress');
  await check('cat dox ', 1, 'An incorrect completed word does not advance progress');
  await check('catxdogxfin', 0, 'Words joined by mistyped separators are not complete');
  await check('cat dogxfin', 1, 'Only words with correct surrounding boundaries count');
  await check('cat do', 1, 'Backspacing to correct a word does not count it early');
  await check('cat dog ', 2, 'Correcting and completing the word advances progress');
  await check('cat dog fi', 2, 'The last word must also be complete');
  await check('cat dog fin', 3, 'A correct final word needs no trailing space');
  assert.match(document.querySelector('.word-progress').textContent, /You made it/);
  await check('cat dog fi', 2, 'Removing a completed character decreases progress');
});

