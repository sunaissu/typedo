import { testStorage, settleStorage } from './storage-helpers.js';
import test, { beforeEach, after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { emptyProgress, STORAGE_KEY } from '../src/storage.js';
import { LESSON_COURSE } from '../src/lessons.js';
import { LESSON_TARGET_KEYS } from '../src/lessonPractice.js';
import { applyLessonLearningResult } from '../src/lessonLearning.js';
import { STORIES } from '../src/stories.js';

let dom;
let server;
let React;
let createRoot;
let App;
let Lessons;
let WordProgress;
let root;
let storage;
beforeEach(() => { storage = testStorage(dom.window.localStorage); });
async function readSaved(key) {
  let raw;
  await React.act(async () => { raw = await storage.getItem(key); });
  return raw;
}

const originalGlobals = new Map();
const RealDate = Date;
let calendarNow = 0;
class CalendarDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [calendarNow])); }
}

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
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: App } = await server.ssrLoadModule('/src/App.jsx'));
  ({ default: Lessons } = await server.ssrLoadModule('/src/Lessons.jsx'));
  ({ WordProgress } = await server.ssrLoadModule('/src/TypingCoach.jsx'));
  const style = document.createElement('style');
  // Network fonts do not affect behavior or the background/theme regression.
  style.textContent = (await Promise.all(['styles.css', 'shell.css', 'lessons.css', 'coach.css', 'stories.css'].map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n').replace(/^@import[^\n]*(?:\n|$)/gm, '');
  document.head.append(style);
});

afterEach(async () => {
  if (root) await React.act(async () => root.unmount());
  root = null;
  await storage.close(); dom.window.localStorage.clear();
  globalThis.Date = RealDate;
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
  await React.act(async () => root.render(React.createElement(Component, { storage, ...props })));
  await settleStorage(React);
}

async function mountWorkspace(Component = App, props = {}) {
  await mount(Component, props);
  if (document.querySelector('.start-page')) {
    await click(button('Type', document.querySelector('[aria-label="Main navigation"]')));
  }
}

async function click(element) {
  assert.ok(element, 'Expected control is available');
  await React.act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  await nextFrame();
}

function button(text, scope = document) {
  return [...scope.querySelectorAll('button')].find(element => typeof text === 'string' ? element.textContent.trim() === text : text.test(element.textContent.trim()));
}

async function key(target, value, modifiers = {}) {
  assert.ok(target, 'Typing input is available');
  await React.act(async () => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers })));
}

async function nextFrame() {
  await React.act(async () => new Promise(resolve => requestAnimationFrame(resolve))); await settleStorage(React);
}

async function confirmRestartIfAsked() {
  const confirm = button('Restart attempt');
  if (!confirm) return;
  assert.ok(button('Keep practicing'), 'Replacing unfinished work offers a safe cancel action');
  await click(confirm);
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

function assertLessonRound(lesson, round, message) {
  const workspace = document.querySelector('.lesson-workspace');
  assert.ok(workspace, message);
  assert.equal(document.querySelector('#lesson-title').textContent, lesson.title, message);
  assert.equal(workspace.dataset.kind, 'lesson', message);
  assert.equal(workspace.dataset.round, String(round), message);
  assert.ok(lessonText().length > Math.max(...lesson.practiceRounds[round].passages.map(text => text.length)), 'A practice block contains more material than a single old passage');
}

function lessonRoundButton(number) {
  const control = document.querySelector(`[aria-label="Lesson blocks"] button[aria-label^="Block ${number}:"]`);
  assert.ok(control, `Block ${number} is available in the round navigation`);
  return control;
}

async function select(label, value) {
  const control = document.querySelector(`select[aria-label="${label}"]`);
  assert.ok(control, `The ${label} control is available`);
  await React.act(async () => {
    control.value = value;
    control.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}

function storyText() {
  const prompt = document.querySelector('#story-accessible-prompt');
  assert.ok(prompt, 'The current story chapter provides an accessible typing prompt');
  return prompt.textContent.replace(/^Text to type: /, '');
}

function storyBook(story) {
  const book = [...document.querySelectorAll('.story-book')].find(element => element.querySelector('h2')?.textContent === story.title);
  assert.ok(book, `The story library includes ${story.title}`);
  return book;
}

async function savedProgress() {
  return JSON.parse((await readSaved(STORAGE_KEY)));
}

async function seedSettings(settings) {
  const progress = emptyProgress();
  progress.settings = { ...progress.settings, ...settings };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

test('startup waits for legacy migration before mounting practice or saving default data, including StrictMode', async context => {
  const progress = emptyProgress();
  progress.settings.goal = 10;
  progress.settings.theme = 'light';
  const raw = JSON.stringify(progress);
  dom.window.localStorage.setItem(STORAGE_KEY, raw);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const getItem = storage.getItem.bind(storage);
  context.mock.method(storage, 'getItem', async key => { await pending; return getItem(key); });
  const writes = context.mock.method(storage, 'setItem');
  root = createRoot(document.querySelector('#root'));
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(App, { storage }))));
  assert.match(document.querySelector('[role="status"]').textContent, /Loading your progress/);
  assert.equal(document.querySelector('nav'), null);
  assert.equal(writes.mock.callCount(), 0);
  await React.act(async () => release());
  await settleStorage(React);
  assert.equal((await savedProgress()).settings.goal, 10);
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(dom.window.localStorage.getItem(STORAGE_KEY), raw);
});

test('pending saves never claim success and an older completion cannot hide a newer save failure', async context => {
  await mount();
  const saves = [];
  context.mock.method(storage, 'setItem', () => new Promise((resolve, reject) => saves.push({ resolve, reject })));
  await React.act(async () => document.querySelector('[aria-label="Use light theme"]').click());
  assert.match(document.querySelector('.sidebar-local').textContent, /Saving/);
  assert.doesNotMatch(document.querySelector('footer').textContent, /Saved locally/);
  await React.act(async () => document.querySelector('[aria-label="Use dark theme"]').click());
  assert.equal(saves.length, 2);
  await React.act(async () => saves[1].reject(new Error('Storage full')));
  assert.match(document.querySelector('footer').textContent, /Session only/);
  await React.act(async () => saves[0].resolve());
  assert.match(document.querySelector('footer').textContent, /Session only/);
  assert.match(document.querySelector('.warning').textContent, /storage is unavailable/);
});

test('new visitors get a clear starting choice before any typing input takes focus', async () => {
  await mount();
  assert.ok(document.querySelector('.start-page'));
  assert.match(document.querySelector('h1').textContent, /home on the keyboard/);
  assert.match(document.querySelector('.start-device').textContent, /physical keyboard/);
  assert.match(document.querySelector('.start-notes').textContent, /Progress stays in this browser/);
  assert.equal(document.querySelector('[aria-label="Typing input"]'), null);
  assert.equal(document.activeElement, document.querySelector('h1'));
  await click(button('Start your first lesson'));
  assert.match(document.querySelector('.lesson-workspace-heading').textContent, new RegExp(LESSON_COURSE[0].title));
  assert.ok(document.querySelector('#lesson-accessible-prompt'));
  assert.match(document.querySelector('.lesson-round-instruction').textContent, /Find the bumps on F and J/);
  assert.equal(document.activeElement, document.querySelector('.lesson-type-surface textarea'));
  assert.equal((await savedProgress()).history.length, 0, 'Choosing a lesson does not fabricate completed progress');
});

test('the quick start test resets its promised format and waits for the first key', async () => {
  (await seedSettings({ mode: 'words', wordCount: 100, duration: 120, punctuation: true, numbers: true }));
  await mount();
  await click(button('Start a 30-second test'));
  const settings = (await savedProgress()).settings;
  assert.equal(settings.mode, 'time');
  assert.equal(settings.duration, 30);
  assert.equal(settings.punctuation, false);
  assert.equal(settings.numbers, false);
  assert.equal(document.querySelector('.status-dot.running'), null);
  assert.equal(document.activeElement, document.querySelector('[aria-label="Typing input"]'));
  const firstKey = document.querySelector('#accessible-prompt').textContent.replace(/^Text to type: /, '')[0];
  await key(document.activeElement, firstKey);
  assert.ok(document.querySelector('.status-dot.running'));
  await click(button('Start', document.querySelector('[aria-label="Main navigation"]')));
  assert.ok(document.querySelector('.start-page'));
  await click(button('Stories', document.querySelector('.home-plan-list')));
  assert.ok(storyBook(STORIES[0]));
  assert.equal(document.activeElement, document.querySelector('.story-intro h1'));
  assert.match(document.querySelector('.story-intro p').textContent, /Choose a story and start typing/);
});

test('Start opens the backup picker directly and resumes the imported lesson round', async context => {
  let pickerOpens = 0;
  context.mock.method(dom.window.HTMLInputElement.prototype, 'click', function () {
    if (this.type === 'file') pickerOpens++;
  });
  await mount();
  await click(button('Restore progress from a backup'));
  assert.equal(pickerOpens, 1);
  assert.ok(document.querySelector('.start-page'), 'Opening or canceling the picker does not move to an unrelated page');
  assert.equal((await savedProgress()).history.length, 0);
  const backup = emptyProgress();
  backup.lessonProgress = { [LESSON_COURSE[0].id]: { practiceRounds: 1, attempts: 1 } };
  await restoreBackup(backup);
  assert.match(document.querySelector('.toast').textContent, /Backup restored/);
  await click(document.querySelector('.home-continue .primary-button'));
  assert.match(document.querySelector('.lesson-round-plan').textContent, /Block 2 of 3/);
});

test('Start distinguishes a first lesson from other practice and a finished course', async () => {
  const progress = emptyProgress();
  progress.storyProgress = { [STORIES[0].id]: { completedChapters: 1, attempts: 1 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mount();
  await click(document.querySelector('[aria-label="Typedo home"]'));
  assert.ok(button('Start your first lesson'));
  assert.equal(button('Continue lessons'), undefined);
  await React.act(async () => root.unmount());
  root = null;
  progress.lessonProgress = Object.fromEntries(LESSON_COURSE.map(lesson => [lesson.id, { practiceRounds: 3, attempts: 3 }]));
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mount();
  await click(document.querySelector('[aria-label="Typedo home"]'));
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.ok(document.querySelector('.course-complete'));
  assert.equal(document.activeElement, button('Try a story'));
});

test('returning practice starts at Home and Start respects unavailable storage', async context => {
  const progress = emptyProgress();
  progress.lessonProgress = { [LESSON_COURSE[0].id]: { practiceRounds: 1, attempts: 1 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  context.mock.method(storage, 'setItem', async () => { throw new Error('Storage denied'); });
  await mount();
  assert.ok(document.querySelector('.home-page'));
  assert.equal(document.querySelector('[aria-label="Typing input"]'), null);
  assert.match(document.querySelector('.start-notes').textContent, /saving is unavailable or paused/);
  assert.doesNotMatch(document.querySelector('.start-notes').textContent, /Progress stays in this browser/);
  await click(document.querySelector('.home-continue .primary-button'));
  assert.match(document.querySelector('.lesson-round-plan').textContent, /Block 2 of 3/);
});

async function reload() {
  await React.act(async () => root.unmount());
  root = null;
  await mountWorkspace();
}

async function restoreBackup(value, size = 1000) {
  const input = document.querySelector('input[type="file"]');
  assert.ok(input, 'Progress provides a backup restore input');
  Object.defineProperty(input, 'files', { configurable: true, value: [{ size, text: async () => typeof value === 'string' ? value : JSON.stringify(value) }] });
  await React.act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
}

function setCalendarDate(date) {
  // Keep Date.now live for React and Vite scheduling while controlling the
  // calendar date seen by the story feature.
  calendarNow = date.getTime();
  globalThis.Date = CalendarDate;
}

test('theme switches the page palette and survives an app reload', async () => {
  await mountWorkspace();
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
  await mountWorkspace();
  assert.equal(document.documentElement.dataset.theme, 'light', 'Explicit theme selection is saved');
  await click(document.querySelector('[aria-label="Use dark theme"]'));
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(dom.window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), darkBackground);
});

test('a completed typing test saves once and the keyboard restart is immediately usable', async () => {
  const progress = emptyProgress();
  progress.settings = { ...progress.settings, mode: 'custom', customText: 'fj' };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  const input = document.querySelector('[aria-label="Typing input"]');
  await key(input, 'f');
  await key(input, 'j');
  let saved = JSON.parse((await readSaved(STORAGE_KEY)));
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].accuracy, 100);
  assert.equal(saved.history[0].correct, 2);
  assert.ok(button('Go again'), 'Completion provides another run in one click');

  await key(button('Go again'), 'Enter', { ctrlKey: true });
  assert.ok(document.querySelector('[aria-label="Typing input"]'));
  saved = JSON.parse((await readSaved(STORAGE_KEY)));
  assert.equal(saved.history.length, 1, 'Restart does not duplicate a saved result');
});

test('Shift+Enter retries the current lesson round from typing and results without advancing it', async () => {
  const completed = [];
  await mountWorkspace(Lessons, { onComplete: result => completed.push(result), onBack: () => {} });
  let input = document.querySelector('textarea');
  await key(input, lessonText()[0]);
  await key(input, 'Enter', { shiftKey: true });
  assert.ok(button('Keep practicing'), 'An unfinished retry offers a safe default');
  await click(button('Restart attempt'));
  await nextFrame();
  assert.equal(document.querySelectorAll('.char.correct').length, 0);
  assert.match(document.querySelector('.lesson-round-plan').textContent, /Block 1 of 3/);
  assert.ok(document.activeElement === document.querySelector('textarea'));
  assert.equal(completed.length, 0);

  input = document.querySelector('textarea');
  await typeText(input, lessonText());
  assert.equal(completed.length, 1);
  await key(button('Next block'), 'Enter', { shiftKey: true });
  await nextFrame();
  assert.match(document.querySelector('.lesson-round-plan').textContent, /Block 1 of 3/);
  assert.equal(completed.length, 1, 'Retry does not duplicate the completed result');
  assert.ok(document.activeElement === document.querySelector('textarea'));
  await typeText(document.querySelector('textarea'), lessonText());
  await key(button('Next block'), 'Enter');
  assert.match(document.querySelector('.lesson-round-plan').textContent, /Block 2 of 3/, 'Plain Enter still continues');
  assert.equal(completed.length, 2);
});

test('the nearby retry shortcut keeps the optional test and ignores unrelated keys and controls', async () => {
  await mountWorkspace(Lessons, { onComplete: () => {}, onBack: () => {} });
  await click(button('Optional test'));
  let input = document.querySelector('textarea');
  await key(input, lessonText()[0]);
  for (const modifiers of [{ shiftKey: true, repeat: true }, { shiftKey: true, isComposing: true }, { shiftKey: true, altKey: true }]) {
    await key(input, 'Enter', modifiers);
    assert.equal(document.querySelectorAll('.char.correct').length, 1);
  }
  await key(button('Word practice'), 'Enter', { shiftKey: true });
  assert.equal(document.querySelectorAll('.char.correct').length, 1, 'Unrelated buttons are not retry targets');
  const repeated = new dom.window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, repeat: true, bubbles: true, cancelable: true });
  await React.act(async () => button('Restart').dispatchEvent(repeated));
  assert.equal(repeated.defaultPrevented, true, 'A held shortcut also suppresses native button activation');
  await key(button('Restart'), 'Enter', { shiftKey: true });
  await click(button('Restart attempt'));
  await nextFrame();
  assert.equal(document.querySelector('.lesson-stage-tabs button.selected').textContent, 'Optional test');
  assert.equal(document.querySelectorAll('.char.correct').length, 0);
  assert.ok(document.activeElement === document.querySelector('textarea'));
});

test('Shift+Enter restarts free typing without changing saved results or other views', async () => {
  (await seedSettings({ mode: 'custom', customText: 'fj' }));
  await mountWorkspace();
  let input = document.querySelector('[aria-label="Typing input"]');
  await key(input, 'f');
  await key(input, 'Enter', { shiftKey: true });
  await click(button('Restart attempt'));
  assert.equal(document.querySelectorAll('.char.correct').length, 0);
  assert.equal((await savedProgress()).history.length, 0);
  input = document.querySelector('[aria-label="Typing input"]');
  await typeText(input, 'fj');
  await key(button('Go again'), 'Enter', { shiftKey: true });
  await nextFrame();
  assert.equal((await savedProgress()).history.length, 1);
  assert.ok(document.activeElement === document.querySelector('[aria-label="Typing input"]'));
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await key(document.activeElement, 'Enter', { shiftKey: true });
  assert.ok(document.querySelector('.story-library'));
  assert.equal(document.querySelector('[aria-label="Typing input"]'), null);
});

test('a lesson guides corrections, tests without hints, and reports each completed stage once', async () => {
  const completed = [];
  await mountWorkspace(Lessons, { onComplete: result => completed.push(result), onBack: () => {} });
  let input = document.querySelector('textarea');
  const firstPractice = lessonText();
  const card = document.querySelector('.lesson-typing-card');
  assert.ok(card.querySelector('[aria-label="Live finger guide"]'), 'Practice shows the hands beside the passage before typing');
  assert.ok(card.querySelector('#lesson-accessible-prompt'));
  await key(input, firstPractice[0] === 'x' ? 'z' : 'x');
  assert.equal(document.querySelector('.char.current').textContent, firstPractice[0], 'Incorrect practice input waits for the expected character');
  assert.equal(document.querySelectorAll('.char.correct, .char.incorrect').length, 0);
  await key(input, 'Escape');
  await nextFrame();
  assert.equal(completed.length, 0, 'Pausing unfinished practice does not record a completion');
  assert.equal(lessonText(), firstPractice, 'Pause preserves the exact passage');
  await click(button('Resume typing', document.querySelector('dialog')));
  await click(button('Restart'));
  await confirmRestartIfAsked();
  const practice = lessonText();
  assert.notEqual(practice, firstPractice, 'Reset supplies a different authored passage');
  input = document.querySelector('textarea');
  const tab = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  await React.act(async () => input.dispatchEvent(tab));
  assert.equal(tab.defaultPrevented, false, 'Tab follows native document order');
  await typeText(input, `${practice}x`);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].stage, 'practice');
  assert.equal(completed[0].passed, false);
  assert.equal(completed[0].errors, 0, 'Reset also clears previous mistakes');
  assert.equal(completed[0].correct, practice.length);
  await click(button('Optional test'));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null, 'Assessment hides the inline hands');
  assert.equal(document.querySelector('[aria-label="QWERTY keyboard finger guide"]'), null, 'Assessment hides the finger guide');
  assert.equal(document.querySelector('[aria-label="Typing assistance"]'), null, 'Assessment cannot enable hints');
  assert.ok(!document.querySelector('.lesson-finger-tips'), 'The optional test also hides finger-placement hints in the help details');
  input = document.querySelector('textarea');
  const assessment = lessonText();
  const errorIndex = [...assessment].findIndex(char => assessment.split(char).length - 1 > 2);
  assert.ok(errorIndex >= 0, 'There is a key with enough correct occurrences after one mistake');
  const wrongKey = assessment[errorIndex] === 'x' ? 'z' : 'x';
  await typeText(input, `${assessment.slice(0, errorIndex)}${wrongKey}${assessment.slice(errorIndex + 1)}x`);
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
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Optional test'));
  await typeText(document.querySelector('textarea'), lessonText());
  const saved = JSON.parse((await readSaved(STORAGE_KEY)));
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].mode, 'lesson');
  assert.equal(saved.history[0].lessonId, lesson.id);
  assert.equal(saved.lessonProgress[lesson.id].passed, true);
  assert.equal(saved.lessonProgress[lesson.id].attempts, 1);
  assert.ok(saved.lessonProgress[lesson.id].seenTests.length > 1, 'Assessment rotation saves the individual passages');

  await React.act(async () => root.unmount());
  root = null;
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('[aria-label="Choose a typing lesson"]').textContent, /Test passed/);
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title, 'Next unpassed lesson is selected on return');
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('tbody').textContent, new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(JSON.parse((await readSaved(STORAGE_KEY))).history.length, 1);
});

test('beginner hands appear with the prompt and follow each key, opposite-hand Shift, and space in focus mode', async () => {
  (await seedSettings({ mode: 'custom', customText: 'fJA x' }));
  await mountWorkspace();
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
  (await seedSettings({ mode: 'custom', customText: 'fjkl' }));
  await mountWorkspace();
  await key(document.querySelector('[aria-label="Typing input"]'), 'f');
  await click(button('Without finger hints'));
  assert.equal(button('Without finger hints').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.equal(document.querySelector('.char.current').textContent, 'j');
  assert.equal(document.querySelectorAll('.char.correct').length, 1, 'Hiding hands does not restart an active session');
  assert.equal((await savedProgress()).settings.guide, false);

  await click(button('Beginner'));
  assert.equal(button('Beginner').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('.coach-cue > kbd').textContent, 'j');
  assert.equal(document.querySelectorAll('.char.correct').length, 1, 'Restoring hands preserves the current position');
  assert.equal((await savedProgress()).settings.guide, true);
  await click(button('Without finger hints'));
  await reload();
  await click(button('Resume typing', document.querySelector('dialog')));
  assert.equal(button('Without finger hints').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null, 'Independent choice survives reload');

  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(button('Without finger hints').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null, 'The course respects the saved guide preference');
  const practice = lessonText();
  await typeText(document.querySelector('textarea'), practice.slice(0, 2));
  await click(button('Beginner'));
  assert.equal(document.querySelector('.coach-cue > kbd').textContent, practice[2] === ' ' ? 'Space' : practice[2]);
  assert.equal(document.querySelectorAll('.char.correct').length, 2, 'Enabling lesson guidance does not reset practice');
  assert.equal((await savedProgress()).settings.guide, true, 'Course guidance updates the shared saved preference');
  await click(button('Optional test'));
  await click(button('Restart attempt'));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.equal(document.querySelector('[aria-label="QWERTY keyboard finger guide"]'), null);
  assert.equal(document.querySelector('[aria-label="Typing assistance"]'), null);
  assert.equal((await savedProgress()).settings.guide, true, 'A hint-free test does not overwrite the beginner preference');
  await click(button('Word practice'));
  assert.ok(document.querySelector('[aria-label="Live finger guide"]'), 'Returning to practice restores the preferred guide');
});

test('new skill instructions stay visible without hands across rounds, lessons and reload', async () => {
  (await seedSettings({ guide: false }));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.match(document.querySelector('.lesson-round-instruction').textContent, /semicolon/);
  await typeText(document.querySelector('textarea'), lessonText());
  await click(button('Next block'));
  assert.equal(document.querySelector('.lesson-round-instruction').textContent, LESSON_COURSE[0].practiceRounds[1].instruction);
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  await reload();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('.lesson-round-instruction').textContent, LESSON_COURSE[0].practiceRounds[1].instruction);
  const nextSkill = LESSON_COURSE.find(item => item.id === 'center-reach');
  await click([...document.querySelectorAll('.lesson-course-card')].find(card => card.querySelector('strong')?.textContent === nextSkill.title));
  assert.equal(document.querySelector('.lesson-round-instruction').textContent, nextSkill.practiceRounds[0].instruction || nextSkill.instruction);
  assert.equal((await savedProgress()).settings.guide, false);
  await click(button('Optional test'));
  assert.equal(document.querySelector('.lesson-round-instruction'), null, 'An active assessment still hides the instruction');
  await click(button('Word practice'));
  assert.ok(document.querySelector('.lesson-round-instruction'));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
});

test('repeated practice errors identify the pressed key and clear on correction or reset', async () => {
  await mountWorkspace(Lessons, { guideEnabled: false, onBack: () => {} });
  const input = document.querySelector('textarea');
  const expected = lessonText()[0];
  const feedback = document.querySelector('#lesson-key-feedback');
  await key(input, 'z');
  assert.equal(feedback.textContent, '', 'A single slip does not trigger extra instruction');
  await key(input, 'x');
  assert.match(feedback.textContent, /You pressed lowercase x; expected/);
  assert.ok(feedback.textContent.includes(expected));
  assert.equal(feedback.getAttribute('role'), 'status');
  assert.equal(feedback.getAttribute('aria-live'), 'polite');
  assert.equal(document.querySelectorAll('.char.correct, .char.incorrect').length, 0);
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  await key(input, expected);
  assert.equal(feedback.textContent, '');
  await key(input, 'z');
  await key(input, 'x');
  assert.ok(feedback.textContent);
  await click(button('Restart'));
  await confirmRestartIfAsked();
  assert.equal(document.querySelector('#lesson-key-feedback').textContent, '');
  await click(button('Optional test'));
  await key(document.querySelector('textarea'), 'z');
  await key(document.querySelector('textarea'), 'x');
  assert.equal(document.querySelector('#lesson-key-feedback'), null, 'Practice coaching never appears during an assessment');
});

test('a difficult practice block offers a short review while preserving credit and the choice to continue', async () => {
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const first = LESSON_COURSE[0];
  const text = lessonText();
  const input = document.querySelector('textarea');
  await typeText(input, [...text].map(char => `z${char}`).join(''));
  assert.equal((await savedProgress()).history.at(-1).accuracy, 50);
  assert.equal((await savedProgress()).lessonProgress[first.id].practiceRounds, 1);
  assert.match(document.querySelector('.lesson-practice-feedback').textContent, /mistakes in .* attempts/);
  assert.match(document.querySelector('.lesson-practice-feedback').textContent, /Press the/);
  assert.ok(button('Next block'), 'Struggling never locks the learner into a retry');
  await click(button('Review this block'));
  assertLessonRound(first, 0, 'Review stays on the completed round');
  assert.ok(lessonText().length < text.length, 'The suggested review is shorter than standard practice');
  assert.equal((await savedProgress()).settings.lessonLength, 'standard', 'One short review does not change the saved preference');
  assert.equal((await savedProgress()).history.length, 1, 'Starting review creates no extra completion');
  await typeText(document.querySelector('textarea'), lessonText());
  assert.equal(document.querySelector('.lesson-practice-feedback'), null, 'A clean result does not keep the old recommendation');
  assert.equal((await savedProgress()).lessonProgress[first.id].practiceRounds, 1, 'Repeating a round adds no new course credit');
  await click(button('Next block'));
  assertLessonRound(first, 1, 'The learner can continue after a short review');
});

test('optional tests span passages and cannot pass by missing every occurrence of a rare target key', async () => {
  const completed = [];
  await mountWorkspace(Lessons, { onComplete: result => completed.push(result), onBack: () => {} });
  await click(button('Optional test'));
  const text = lessonText();
  const targets = LESSON_TARGET_KEYS[LESSON_COURSE[0].id];
  for (const target of targets) assert.ok(text.split(target).length - 1 >= 2);
  const firstPassage = document.querySelector('.lesson-words-window .words-text').textContent;
  const input = document.querySelector('textarea');
  await typeText(input, firstPassage);
  assert.match(document.querySelector('.lesson-passage-progress').textContent, /Passage 2 of/);
  await key(input, 'Backspace');
  assert.match(document.querySelector('.lesson-passage-progress').textContent, /Passage 1 of/);
  await typeText(input, text.slice(firstPassage.length - 1));
  assert.equal(completed[0].passed, true);
  assert.equal(completed[0].correct, text.length);
  await click(button('Optional test'));
  const retry = lessonText();
  const rare = [...targets].sort((a, b) => retry.split(a).length - retry.split(b).length)[0];
  const misses = retry.split(rare).length - 1;
  assert.ok(misses / retry.length <= .05, 'The missing skill can be concealed by overall accuracy');
  await typeText(document.querySelector('textarea'), retry.replaceAll(rare, 'z'));
  assert.ok(completed[1].accuracy >= 95);
  assert.equal(completed[1].passed, false, 'Overall accuracy cannot hide a missing target skill');
  assert.match(document.querySelector('.lesson-result-copy').textContent, /two correct uses of every target key/);
});

test('word progress counts completed correct words and updates after corrections', async () => {
  await mountWorkspace(WordProgress, { text: 'cat dog fin', typed: '' });
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

test('three guided rounds advance with Enter and Ctrl+Enter without requiring a test', async () => {
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const lesson = LESSON_COURSE[0];
  const passages = [];
  for (let round = 0; round < 3; round += 1) {
    assert.equal(document.querySelector('#lesson-title').textContent, lesson.title);
    const passage = lessonText();
    passages.push(passage);
    assertLessonRound(lesson, round, `Round ${round + 1} uses its own practice block`);
    await typeText(document.querySelector('textarea'), passage);
    const primary = document.querySelector('.lesson-result-actions .primary-button');
    assert.equal(primary.textContent.trim(), round < 2 ? 'Next block' : 'Next lesson');
    assert.equal(document.activeElement, primary, 'Completion focuses the continuation action instead of Reset');
    assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, round + 1);
    assert.equal((await savedProgress()).lessonProgress[lesson.id].passed, false);
    await key(primary, 'Enter', round === 1 ? { ctrlKey: true } : {});
  }
  assert.equal(new Set(passages).size, 3, 'Moving through the lesson changes the typing material');
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title);
  assert.equal((await savedProgress()).history.length, 3, 'Each completed round records exactly one result');
  const seen = (await savedProgress()).lessonProgress[lesson.id].seenPractice;
  assert.deepEqual([...seen].sort(), lesson.practiceVariants.filter(text => passages.some(passage => passage.includes(text))).sort(), 'Seen material records recognized authored segments, not the concatenated blocks');
  assert.ok((await savedProgress()).history.every(item => item.stage === 'practice'));
});

test('lesson theme and length choices preserve the current block and apply on retry', async () => {
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const initial = lessonText();
  await typeText(document.querySelector('textarea'), initial.slice(0, 3));
  for (const label of ['Lesson theme', 'Practice length']) {
    const control = document.querySelector(`select[aria-label="${label}"]`);
    await key(control, 'Escape');
    await key(control, 'Enter', { shiftKey: true });
    await key(control, 'Enter', { ctrlKey: true });
    assert.equal(lessonText(), initial, `${label} keyboard controls do not restart the current block`);
    assert.equal(document.querySelectorAll('.char.correct').length, 3, 'Dismissing a select or confirming its option preserves the typing position');
  }
  await select('Lesson theme', 'adventure');
  await select('Practice length', 'quick');
  assert.equal(lessonText(), initial, 'Changing a preference keeps the active passage intact');
  assert.equal(document.querySelectorAll('.char.correct').length, 3, 'Changing preferences preserves the typing position');
  assert.equal((await savedProgress()).history.length, 0, 'Choosing a format does not award a result');
  assert.equal((await savedProgress()).settings.lessonTheme, 'adventure');
  assert.equal((await savedProgress()).settings.lessonLength, 'quick');

  await key(document.querySelector('textarea'), 'Enter', { shiftKey: true });
  await confirmRestartIfAsked();
  const quick = lessonText();
  assert.equal(document.querySelectorAll('.char.correct').length, 0);
  assert.equal(document.querySelector('.lesson-workspace').dataset.round, '0', 'New preferences do not advance the course');
  await select('Practice length', 'standard');
  assert.equal(lessonText(), quick, 'A length change waits for a new block even before typing begins');
  await click(button('Restart'));
  await confirmRestartIfAsked();
  assert.ok(lessonText().length > quick.length, 'Standard practice contains more typing than a quick visit');
  assert.equal((await savedProgress()).history.length, 0);

  await reload();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('select[aria-label="Lesson theme"]').value, 'adventure');
  assert.equal(document.querySelector('select[aria-label="Practice length"]').value, 'standard');
  assert.equal(document.querySelector('.lesson-workspace').dataset.round, '0');
});

test('longer blocks show one passage at a time and keep typing continuous across boundaries', async () => {
  const completed = [];
  await mountWorkspace(Lessons, { onComplete: result => completed.push(result), onBack: () => {} });
  const full = lessonText();
  const first = document.querySelector('.lesson-words-window .words-text').textContent;
  assert.ok(full.startsWith(first));
  assert.ok(first.length < full.length, 'The visible passage stays manageable while the full block remains accessible');
  assert.equal(first.at(-1), ' ', 'A passage boundary shows the space needed to continue');
  const input = document.querySelector('textarea');
  await typeText(input, first);
  assert.match(document.querySelector('.lesson-passage-progress').textContent, /Passage 2 of/);
  assert.equal(document.querySelector('.char.current').textContent, full[first.length]);
  assert.equal(completed.length, 0, 'Moving between passages needs no result-screen interruption');
  assert.equal(lessonText(), full, 'The accessible prompt retains the entire block');
  await key(input, 'Backspace');
  assert.match(document.querySelector('.lesson-passage-progress').textContent, /Passage 1 of/);
  assert.equal(document.querySelector('.char.current').textContent, ' ');
  await typeText(input, full.slice(first.length - 1));
  assert.equal(completed.length, 1);
  assert.equal(completed[0].correct, full.length, 'Crossing a passage boundary does not skip or duplicate characters');
});

test('finishing for now gives a stopping point and resumes the next unfinished round', async () => {
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await typeText(document.querySelector('textarea'), lessonText());
  await click(button('Finish for now'));
  assert.ok(document.querySelector('.start-page'));
  assert.equal((await savedProgress()).history.length, 1);
  assert.equal((await savedProgress()).lessonProgress[LESSON_COURSE[0].id].practiceRounds, 1);
  await click(document.querySelector('.home-continue .primary-button'));
  assertLessonRound(LESSON_COURSE[0], 1, 'Returning after a break keeps the completed round');
  assert.equal((await savedProgress()).history.length, 1, 'Resuming does not create another result');
});

test('optional independent and extra practice preserve the final round and earned course progress', async () => {
  const lesson = LESSON_COURSE[0];
  const progress = emptyProgress();
  progress.lessonProgress = { [lesson.id]: { practiceRounds: 2, attempts: 2 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const standard = lessonText();
  await typeText(document.querySelector('textarea'), standard.slice(0, 3));
  await click(button('Practice without hints'));
  assert.equal(lessonText(), standard);
  assert.equal(document.querySelectorAll('.char.correct').length, 3, 'Fading hints keeps the current typing position');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  await typeText(document.querySelector('textarea'), standard.slice(3));
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 3);
  assert.equal((await savedProgress()).lessonLearning[lesson.id].samples.at(-1).guided, true, 'Turning off hints mid-round does not relabel guided work as independent');
  assert.equal(Boolean((await savedProgress()).lessonLearning[lesson.id].retainedAt), false, 'Completing a lesson does not claim later retention');

  await click(button('A little more practice'));
  const extra = lessonText();
  assert.ok(extra.length > standard.length, 'Optional extra practice offers a fuller block');
  assertLessonRound(lesson, 2, 'Extra practice stays on the completed final round');
  assert.equal((await savedProgress()).history.length, 1, 'Asking for more practice does not save an unfinished result');
  await typeText(document.querySelector('textarea'), extra);
  assert.equal((await savedProgress()).history.length, 2);
  assert.equal((await savedProgress()).lessonLearning[lesson.id].samples.at(-1).guided, false, 'A fresh block remembers the independent preference');
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 3, 'Extra practice cannot earn an additional course round');
  assert.equal(Boolean((await savedProgress()).lessonLearning[lesson.id].retainedAt), false);
  await click(button('Next lesson'));
  assertLessonRound(LESSON_COURSE[1], 0, 'Continuing after extra practice opens the next unfinished lesson');
});

test('a guide enabled through shared settings is counted even when hidden again before completion', async () => {
  const completed = [];
  const props = { guideEnabled: false, onComplete: result => completed.push(result), onBack: () => {} };
  await mountWorkspace(Lessons, props);
  const text = lessonText();
  await typeText(document.querySelector('textarea'), text.slice(0, 2));
  await React.act(async () => root.render(React.createElement(Lessons, { ...props, guideEnabled: true })));
  assert.ok(document.querySelector('[aria-label="Live finger guide"]'));
  assert.equal(lessonText(), text);
  assert.equal(document.querySelectorAll('.char.correct').length, 2);
  await React.act(async () => root.render(React.createElement(Lessons, props)));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  await typeText(document.querySelector('textarea'), text.slice(2));
  assert.equal(completed.length, 1);
  assert.equal(completed[0].guided, true, 'Any use of shared guidance prevents this run from claiming to be independent');
});

async function seedDueLessonReview() {
  const lesson = LESSON_COURSE.find(item => item.id === 'center-reach');
  const resumeLesson = LESSON_COURSE.find(item => item.id === 'top-row');
  const progress = emptyProgress();
  progress.lessonProgress = {
    ...Object.fromEntries(LESSON_COURSE.slice(0, 3).map(item => [item.id, { practiceRounds: 3, attempts: 3 }])),
    [resumeLesson.id]: { practiceRounds: 1, attempts: 1 },
  };
  progress.lessonLearning = applyLessonLearningResult({}, {
    id: 'earlier-guided-practice', mode: 'lesson', lessonId: lesson.id, stage: 'practice', practiceKind: 'lesson', guided: true,
    date: new RealDate(RealDate.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    attempts: 80, correctAttempts: 80, correct: 80, elapsed: 60000, accuracy: 100,
    keyStats: { g: { attempts: 40, errors: 0 }, h: { attempts: 40, errors: 0 } }, targetKeys: ['g', 'h'],
  });
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return { lesson, resumeLesson };
}

test('a due review leaves course credit intact and returns to the unfinished lesson', async () => {
  const { lesson, resumeLesson } = await seedDueLessonReview();
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assertLessonRound(resumeLesson, 1, 'Review suggestions do not automatically replace the current lesson');
  await click(button(`Review ${lesson.title}`));
  assert.equal(document.querySelector('.lesson-workspace').dataset.kind, 'review');
  assert.equal(document.querySelector('#lesson-title').textContent, lesson.title);
  assert.ok(document.querySelector('[aria-label="Live finger guide"]'));
  await key(document.querySelector('textarea'), lessonText()[0]);
  await key(document.querySelector('textarea'), 'Enter', { shiftKey: true });
  await confirmRestartIfAsked();
  assert.equal(document.querySelector('.lesson-workspace').dataset.kind, 'review', 'Retry keeps the selected review separate from the course');
  assert.equal((await savedProgress()).history.length, 0, 'Restarting a review does not save unfinished work');
  await typeText(document.querySelector('textarea'), lessonText());
  assert.equal((await savedProgress()).history[0].practiceKind, 'review');
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 3);
  assert.equal((await savedProgress()).lessonProgress[lesson.id].attempts, 3, 'A refresher does not alter course-attempt bookkeeping');
  assert.equal((await savedProgress()).lessonProgress[resumeLesson.id].practiceRounds, 1);
  assert.equal(Boolean((await savedProgress()).lessonLearning[lesson.id].retainedAt), false, 'A guided refresher is not a retention check');
  await key(button('Continue lessons'), 'Enter');
  assertLessonRound(resumeLesson, 1, 'Leaving a review resumes the exact unfinished course round');
});

test('a later hint-free check records retention separately from course completion', async () => {
  const { lesson, resumeLesson } = await seedDueLessonReview();
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button(`Check ${lesson.title} without hints`));
  assert.equal(document.querySelector('.lesson-workspace').dataset.kind, 'check');
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.equal(document.querySelector('[aria-label="Typing assistance"]'), null);
  assert.ok(!document.querySelector('.lesson-finger-tips'), 'A later check cannot reveal finger-placement hints through the help details');
  await typeText(document.querySelector('textarea'), lessonText());
  const saved = (await savedProgress());
  assert.equal(saved.history[0].practiceKind, 'check');
  assert.equal(saved.lessonLearning[lesson.id].samples.at(-1).guided, false);
  assert.ok(saved.lessonLearning[lesson.id].retainedAt, 'A sufficiently accurate later check earns a separate retention record');
  assert.equal(saved.lessonProgress[resumeLesson.id].practiceRounds, 1);
  assert.equal(saved.lessonProgress[lesson.id].practiceRounds, 3);
  assert.equal(saved.lessonProgress[lesson.id].passed, false, 'A later retention check does not silently award the separate optional test');
  await click(button('Continue lessons'));
  assertLessonRound(resumeLesson, 1, 'A retention check does not advance the unrelated course round');
});

test('an optional test refreshes the practice date before a later retention check is offered', async () => {
  const { lesson } = await seedDueLessonReview();
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.ok(button(`Check ${lesson.title} without hints`));
  await click([...document.querySelectorAll('.lesson-course-card')].find(card => card.querySelector('strong')?.textContent === lesson.title));
  await click(button('Optional test'));
  assert.ok(!document.querySelector('.lesson-finger-tips'));
  await typeText(document.querySelector('textarea'), lessonText());
  const record = (await savedProgress()).lessonLearning[lesson.id];
  assert.equal(record.samples.length, 2, 'Optional tests also count as recent exposure to these keys');
  assert.equal(record.samples.at(-1).practiceKind, 'lesson');
  assert.equal(record.samples.at(-1).guided, false);
  assert.deepEqual(record.samples.at(-1).targetKeys, ['g', 'h']);
  assert.equal(Boolean(record.retainedAt), false);
  assert.ok(Date.parse(record.nextReviewAt) > RealDate.now(), 'The next review is scheduled after the fresh optional test');
  assert.equal(button(`Check ${lesson.title} without hints`), undefined, 'A fresh optional test cannot be followed immediately by a purported later check');
});

test('reload resumes unfinished rounds and completed practice advances to the next lesson', async () => {
  const lesson = LESSON_COURSE[0];
  const progress = emptyProgress();
  progress.lessonProgress = { [lesson.id]: { practiceRounds: 1, passed: false, seenPractice: [lesson.practiceRounds[0].passages[0]] } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assertLessonRound(lesson, 1, 'A returning learner resumes round two');
  await typeText(document.querySelector('textarea'), lessonText());
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 2);

  await reload();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('#lesson-title').textContent, lesson.title);
  assertLessonRound(lesson, 2, 'Reload resumes round three without retaking the previous rounds');
  await typeText(document.querySelector('textarea'), lessonText());
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 3);

  await reload();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title, 'Finishing practice is enough to resume the next lesson');
  assert.equal((await savedProgress()).lessonProgress[lesson.id].passed, false, 'No assessment was needed or silently awarded');
});

test('learners with an old completed warmup continue beyond the first lesson', async () => {
  const progress = emptyProgress();
  progress.lessonProgress = { [LESSON_COURSE[0].id]: { practiced: true, passed: false, attempts: 12 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('#lesson-title').textContent, LESSON_COURSE[1].title, 'Existing practice counts even when the learner never took the test');
  assert.equal((await savedProgress()).lessonProgress[LESSON_COURSE[0].id].practiceRounds, 3);
});

test('previous-round navigation replays earned rounds and preserves progress until a block finishes', async () => {
  const lesson = LESSON_COURSE[0];
  const progress = emptyProgress();
  progress.lessonProgress = { [lesson.id]: { practiceRounds: 2, attempts: 2 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const originalProgress = (await savedProgress()).lessonProgress[lesson.id];
  assertLessonRound(lesson, 2, 'The next unfinished round remains the entry point');
  assert.equal(lessonRoundButton(3).getAttribute('aria-current'), 'step');
  await typeText(document.querySelector('textarea'), lessonText().slice(0, 3));
  await click(button('Previous block'));
  await confirmRestartIfAsked();
  await nextFrame();
  assertLessonRound(lesson, 1, 'Previous block opens round two');
  assert.ok(document.activeElement === document.querySelector('textarea'));
  assert.equal(document.querySelectorAll('.char.correct').length, 0, 'An earlier round starts a fresh practice block');
  await click(lessonRoundButton(1));
  await nextFrame();
  assertLessonRound(lesson, 0, 'A completed round can be selected directly');
  assert.ok(button('Previous block').disabled);
  assert.equal(lessonRoundButton(1).getAttribute('aria-current'), 'step');
  assert.ok(lessonRoundButton(2).classList.contains('complete'), 'Later earned credit stays visible while revisiting round one');
  assert.equal(lessonRoundButton(3).disabled, false, 'The first unfinished round remains available');
  assert.equal((await savedProgress()).history.length, 0, 'Changing rounds does not save abandoned work');
  assert.deepEqual((await savedProgress()).lessonProgress[lesson.id], originalProgress);

  await typeText(document.querySelector('textarea'), lessonText());
  assert.equal((await savedProgress()).history.length, 1);
  assert.equal((await savedProgress()).history[0].lessonId, lesson.id);
  assert.equal((await savedProgress()).history[0].stage, 'practice');
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 2, 'Completing a replay does not award the same round twice');
  assert.equal((await savedProgress()).lessonProgress[lesson.id].attempts, originalProgress.attempts + 1);
  await click(lessonRoundButton(3));
  await nextFrame();
  assertLessonRound(lesson, 2, 'The learner can return directly to the unfinished round');
  assert.ok(document.activeElement === document.querySelector('textarea'));
  assert.equal((await savedProgress()).history.length, 1, 'Leaving the replay result does not record it twice');
});

test('round navigation keeps the current passage and unlocks future rounds only after completion', async () => {
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const lesson = LESSON_COURSE[0];
  const text = lessonText();
  assert.ok(button('Previous block').disabled);
  assert.ok(lessonRoundButton(2).disabled);
  assert.ok(lessonRoundButton(3).disabled);
  assert.match(lessonRoundButton(1).getAttribute('aria-label'), new RegExp(`^Block 1: ${lesson.practiceRounds[0].title}`));
  await typeText(document.querySelector('textarea'), text.slice(0, 3));
  await click(lessonRoundButton(1));
  assert.equal(lessonText(), text);
  assert.equal(document.querySelectorAll('.char.correct').length, 3, 'Selecting the current round does not restart it');
  await click(lessonRoundButton(2));
  assertLessonRound(lesson, 0, 'A disabled future round cannot skip unfinished practice');
  assert.equal(document.querySelectorAll('.char.correct').length, 3);
  assert.equal((await savedProgress()).history.length, 0);
  await typeText(document.querySelector('textarea'), text.slice(3));
  assert.equal(lessonRoundButton(2).disabled, false, 'Finishing the first round unlocks the second immediately');
  assert.ok(lessonRoundButton(3).disabled, 'The third round still needs the second round');
  await click(lessonRoundButton(2));
  assertLessonRound(lesson, 1, 'The newly unlocked round can be selected');
  assert.equal((await savedProgress()).history.length, 1);
});

for (const [completion, record] of [['all practice rounds', { practiceRounds: 3, attempts: 3 }], ['a passed optional test', { practiceRounds: 1, passed: true, attempts: 2 }]]) {
  test(`round navigation keeps every round available after ${completion}, including after reload`, async () => {
    const lesson = LESSON_COURSE[0];
    const progress = emptyProgress();
    progress.lessonProgress = { [lesson.id]: record };
    await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    await mountWorkspace();
    for (let visit = 0; visit < 2; visit++) {
      if (visit) await reload();
      await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
      await click([...document.querySelectorAll('.lesson-course-card')].find(card => card.querySelector('strong')?.textContent === lesson.title));
      for (const round of [0, 2, 1]) {
        assert.equal(lessonRoundButton(round + 1).disabled, false);
        await click(lessonRoundButton(round + 1));
        assertLessonRound(lesson, round, 'A completed lesson allows any practice round to be revisited');
        assert.equal(lessonRoundButton(round + 1).getAttribute('aria-current'), 'step');
      }
      assert.equal((await savedProgress()).history.length, 0);
      assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, record.practiceRounds);
      assert.equal((await savedProgress()).lessonProgress[lesson.id].passed, Boolean(record.passed));
    }
  });
}

test('Reset changes the passage within the current round without skipping a round', async () => {
  const lesson = LESSON_COURSE[0];
  const progress = emptyProgress();
  progress.lessonProgress = { [lesson.id]: { practiceRounds: 1 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  const initial = lessonText();
  await typeText(document.querySelector('textarea'), initial.slice(0, 2));
  await click(button('Restart'));
  await confirmRestartIfAsked();
  const reset = lessonText();
  assert.notEqual(reset, initial);
  assertLessonRound(lesson, 1, 'Reset stays on the second round');
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 1, 'Discarding an unfinished passage earns no round');
  await typeText(document.querySelector('textarea'), reset);
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 2);
  await click(button('Restart'));
  await confirmRestartIfAsked();
  const review = lessonText();
  assert.notEqual(review, reset);
  assertLessonRound(lesson, 1, 'Explicit reset repeats the completed round, not the next round');
  await typeText(document.querySelector('textarea'), review);
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 2, 'Repeating the same round cannot count twice');
  await key(document.activeElement, 'Enter');
  assertLessonRound(lesson, 2, 'Continue remains available after reviewing a round');
});

test('finishing the last practice round shows course completion and does not restart lesson one on reload', async () => {
  const lesson = LESSON_COURSE.at(-1);
  const progress = emptyProgress();
  progress.lessonProgress = Object.fromEntries(LESSON_COURSE.map(item => [item.id, { practiceRounds: item.id === lesson.id ? 2 : 3 }]));
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('#lesson-title').textContent, lesson.title);
  await typeText(document.querySelector('textarea'), lessonText());
  await key(document.activeElement, 'Enter');
  assert.match(document.querySelector('.lessons-page').textContent, /course complete/i);
  assert.equal(document.querySelector('#lesson-accessible-prompt'), null, 'A complete course does not immediately issue another drill');

  await reload();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('.lessons-page').textContent, /course complete/i);
  assert.equal(document.querySelector('#lesson-accessible-prompt'), null);
  const completedProgress = await savedProgress();
  assert.ok(LESSON_COURSE.every(item => completedProgress.lessonProgress[item.id].practiceRounds === 3));
});

test('story selection, finger-guide choices, and Ctrl+Enter preserve the active chapter', async () => {
  const story = STORIES[1];
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Start story', storyBook(story)));
  assert.equal(storyText(), story.chapters[0].text, 'The chosen story supplies the passage');
  assert.ok(document.querySelector('.story-typing-card [aria-label="Live finger guide"]'));
  const input = document.querySelector('textarea');
  await typeText(input, storyText().slice(0, 4));
  await click(button('Without finger hints'));
  assert.equal(document.querySelector('[aria-label="Live finger guide"]'), null);
  assert.equal(document.querySelectorAll('.char.correct').length, 4, 'Hiding hands keeps the typed text');
  assert.equal((await savedProgress()).settings.guide, false);
  await key(input, 'Enter', { ctrlKey: true });
  assert.ok(document.querySelector('.story-reader'), 'The global typing restart shortcut must not leave Stories');
  assert.equal(document.querySelectorAll('.char.correct').length, 4);
  assert.equal(storyText(), story.chapters[0].text);
  await click(button('Beginner'));
  assert.ok(document.querySelector('[aria-label="Live finger guide"]'));
  assert.equal(document.querySelectorAll('.char.correct').length, 4, 'Restoring hands keeps the chapter position');
  assert.equal((await savedProgress()).settings.guide, true);

  await click(button('Story library'));
  assert.equal((await savedProgress()).history.length, 0, 'An unfinished chapter is not recorded as completed');
  assert.equal((await savedProgress()).storyProgress[story.id], undefined);
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(storyText(), story.chapters[0].text);
  assert.equal(document.querySelectorAll('.char.correct').length, 4, 'Leaving the reader keeps the unfinished chapter position');
});

test('stories save chapters once, resume after reload, finish, and replay only when requested', async () => {
  const story = STORIES[0];
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Start story', storyBook(story)));
  const firstChapter = storyText();
  await typeText(document.querySelector('textarea'), `${firstChapter}x`);
  let saved = (await savedProgress());
  assert.equal(saved.history.length, 1, 'Extra keystrokes after completion do not save another result');
  assert.equal(saved.history[0].mode, 'story');
  assert.equal(saved.history[0].storyId, story.id);
  assert.equal(saved.history[0].chapterIndex, 0);
  assert.equal(saved.history[0].correct, firstChapter.length);
  assert.equal(saved.storyProgress[story.id].completedChapters, 1);
  assert.equal(saved.storyProgress[story.id].attempts, 1);
  assert.equal(document.activeElement, button('Next chapter'), 'The result focuses the continuation button');
  await key(document.activeElement, 'Enter');
  assert.equal(storyText(), story.chapters[1].text);
  assert.equal((await savedProgress()).history.length, 1, 'Advancing a chapter does not duplicate the result');

  await reload();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 2', storyBook(story)));
  assert.equal(storyText(), story.chapters[1].text, 'A saved bookmark survives reload');
  await typeText(document.querySelector('textarea'), storyText());
  await key(document.activeElement, 'Enter', { ctrlKey: true });
  assert.equal(storyText(), story.chapters[2].text, 'Ctrl+Enter continues within Stories instead of switching to Type');
  await typeText(document.querySelector('textarea'), storyText());
  saved = (await savedProgress());
  assert.equal(saved.history.length, 3);
  assert.deepEqual(saved.history.map(run => run.chapterIndex), [2, 1, 0]);
  assert.ok(saved.history.every(run => run.mode === 'story' && run.storyId === story.id));
  assert.equal(saved.storyProgress[story.id].completedChapters, 3);
  assert.equal(saved.storyProgress[story.id].attempts, 3);
  assert.match(document.querySelector('.story-result').textContent, /You reached the end/);
  assert.equal(document.querySelector('#story-accessible-prompt'), null, 'Finishing a story does not silently start it again');
  assert.equal(document.activeElement, button('Choose another story'));
  await key(document.activeElement, 'Enter');
  assert.ok(storyBook(story).classList.contains('complete'));
  assert.ok(button('Read again', storyBook(story)), 'Replay is an explicit choice in the library');
  assert.equal(document.querySelector('#story-accessible-prompt'), null);

  await reload();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  assert.ok(storyBook(story).classList.contains('complete'), 'The finished state survives reload');
  assert.equal((await savedProgress()).history.length, 3, 'Reload does not duplicate completed chapters');
  await click(button('Read again', storyBook(story)));
  assert.equal(storyText(), story.chapters[0].text, 'Explicit replay returns to the first chapter');
  assert.equal((await savedProgress()).storyProgress[story.id].completedChapters, 3, 'Replay preserves previous completion credit');
  await click(button('Story library'));
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('tbody').textContent, /The plant manager \/ chapter 3/);
});

test('restoring a backup merges bookmarks and passage history without losing newer local progress', async () => {
  const lesson = LESSON_COURSE[0];
  const story = STORIES[0];
  const run = (id, date) => ({ id, date, mode: 'words', label: '10 words', category: 'words:10:false:false:false', elapsed: 60000, wpm: 25, raw: 25, accuracy: 100, errors: 0, correct: 125 });
  const local = emptyProgress();
  local.history = [run('newer', '2026-10-21T10:00:00.000Z')];
  local.keyStats = { z: { attempts: 9, errors: 3 } };
  local.lessonProgress = { [lesson.id]: { practiceRounds: 2, seenPractice: [lesson.practiceVariants[0]], attempts: 4, bestAccuracy: 100, bestWpm: 30, lastPracticed: '2026-10-21T10:00:00.000Z' } };
  local.storyProgress = { [story.id]: { completedChapters: 2, bestAccuracy: 99, attempts: 2, lastPracticed: '2026-10-21T10:00:00.000Z' } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(local));
  const incoming = emptyProgress();
  incoming.settings.guide = false;
  incoming.history = [local.history[0], run('older', '2026-10-20T10:00:00.000Z')];
  incoming.keyStats = { z: { attempts: 12, errors: 2 }, q: { attempts: 8, errors: 4 } };
  incoming.lessonProgress = { [lesson.id]: { practiceRounds: 1, seenPractice: [lesson.practiceVariants[1]], attempts: 2, bestAccuracy: 98, bestWpm: 35, lastPracticed: '2026-10-20T10:00:00.000Z' } };
  incoming.storyProgress = { [story.id]: { completedChapters: 1, bestAccuracy: 100, attempts: 1, lastPracticed: '2026-10-20T10:00:00.000Z' } };
  await mountWorkspace();
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  await restoreBackup(incoming);
  const saved = (await savedProgress());
  assert.deepEqual(saved.history.map(item => item.id), ['newer', 'older']);
  assert.deepEqual(saved.keyStats, { z: { attempts: 12, errors: 3 }, q: { attempts: 8, errors: 4 } });
  assert.equal(saved.settings.guide, false);
  assert.equal(saved.lessonProgress[lesson.id].practiceRounds, 2);
  assert.deepEqual(saved.lessonProgress[lesson.id].seenPractice, lesson.practiceVariants.slice(0, 2));
  assert.equal(saved.lessonProgress[lesson.id].bestWpm, 35);
  assert.equal(saved.lessonProgress[lesson.id].bestAccuracy, 100);
  assert.equal(saved.lessonProgress[lesson.id].lastPracticed, local.lessonProgress[lesson.id].lastPracticed);
  assert.equal(saved.storyProgress[story.id].completedChapters, 2);
  assert.equal(saved.storyProgress[story.id].bestAccuracy, 100);
  assert.equal(saved.storyProgress[story.id].lastPracticed, local.storyProgress[story.id].lastPracticed);
  await restoreBackup(incoming);
  assert.deepEqual((await savedProgress()), saved, 'Restoring the same backup again is idempotent');
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  assertLessonRound(lesson, 2, 'The merged course resumes the next unfinished round');
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 3', storyBook(story)));
  assert.equal(storyText(), story.chapters[2].text, 'The merged story resumes the furthest completed bookmark');
});

test('invalid and oversized backup restores preserve existing progress and explain the failure', async () => {
  (await seedSettings({ guide: false, customText: 'Keep this saved passage.' }));
  await mountWorkspace();
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  const original = (await savedProgress());
  await restoreBackup('{broken');
  assert.deepEqual((await savedProgress()), original);
  assert.match(document.querySelector('.toast').textContent, /not a valid JSON backup/);
  await restoreBackup({ version: 99, history: [] });
  assert.deepEqual((await savedProgress()), original);
  assert.match(document.querySelector('.toast').textContent, /not a Typedo backup/);
  await restoreBackup(emptyProgress(), 2_000_001);
  assert.deepEqual((await savedProgress()), original);
  assert.match(document.querySelector('.toast').textContent, /smaller than 2 MB/);
});

test('a restored weak-key workspace immediately uses the restored key statistics', async () => {
  await mountWorkspace();
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  const incoming = emptyProgress();
  incoming.settings = { ...incoming.settings, mode: 'practice', lesson: 'weak' };
  incoming.keyStats = { z: { attempts: 10, errors: 9 } };
  await restoreBackup(incoming);
  await click(button('Back to typing'));
  const prompt = document.querySelector('#accessible-prompt').textContent;
  assert.match(prompt, /z/i, 'The first restored passage should practice z instead of using pre-restore home-row statistics');
});

test('personal-best celebrations are limited to tests, not custom practice', async () => {
  const progress = emptyProgress();
  progress.settings = { ...progress.settings, mode: 'custom', customText: 'ab' };
  progress.history = [{ id: 'previous-custom', date: '2026-10-20T10:00:00.000Z', mode: 'custom', label: 'Custom text', category: 'custom:custom:false:false:false', elapsed: 60000, wpm: 0, raw: 1, accuracy: 100, errors: 0, correct: 2 }];
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await typeText(document.querySelector('[aria-label="Typing input"]'), 'ab');
  assert.doesNotMatch(document.querySelector('.result-title').textContent, /personal best/i);
  assert.match(document.querySelector('.bottom-stats').textContent, /No personal best yet/);
});

test('suggested practice uses the learners exact troublesome capital and punctuation', async () => {
  const progress = emptyProgress();
  progress.keyStats = { A: { attempts: 10, errors: 8 }, '?': { attempts: 8, errors: 5 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  const suggestion = document.querySelector('[aria-label="Suggested practice"]');
  assert.ok(suggestion, 'Enough recorded mistakes create an actionable practice recommendation');
  assert.match(suggestion.textContent, /A/);
  assert.match(suggestion.textContent, /\?/);
  await click(button('Practice these keys', suggestion));
  assert.equal((await savedProgress()).settings.mode, 'practice');
  assert.equal((await savedProgress()).settings.lesson, 'weak');
  const prompt = document.querySelector('#accessible-prompt').textContent.replace(/^Text to type: /, '');
  assert.ok(prompt.includes('A'), 'Uppercase mistakes produce uppercase practice');
  assert.ok(prompt.includes('?'), 'The recommended punctuation appears in the passage');
});

test('the weekly story resumes the saved chapter instead of skipping ahead to todays suggested date', async () => {
  setCalendarDate(new RealDate(2026, 9, 21, 12));
  const story = STORIES[0];
  const progress = emptyProgress();
  progress.storyProgress = { [story.id]: { completedChapters: 1, bestAccuracy: 98, attempts: 1, lastPracticed: '2026-10-20T10:00:00.000Z' } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  const feature = document.querySelector('.story-feature');
  assert.match(feature.textContent, /This week's story/);
  assert.match(feature.textContent, /Oct 19 - Oct 25, 2026/);
  assert.equal(feature.querySelector('h2').textContent, story.title);
  assert.equal(feature.querySelectorAll('.story-daily-chapters li.complete').length, 1);
  assert.match(feature.querySelector('.story-feature-chapter').textContent, /Your next chapter: 2\./);
  await click(button('Continue this story', feature));
  assert.equal(storyText(), story.chapters[1].text, 'Wednesday does not skip an unread Tuesday chapter');
  await typeText(document.querySelector('textarea'), storyText());
  await key(document.activeElement, 'Enter');
  assert.equal(storyText(), story.chapters[2].text, 'All chapters remain available without date locks');
  await typeText(document.querySelector('textarea'), storyText());
  await key(document.activeElement, 'Enter');
  const completedFeature = document.querySelector('.story-feature');
  assert.match(completedFeature.textContent, /This week's story is finished/);
  assert.ok(button('Start another story', completedFeature), 'The feature offers an unread story after finishing this week');
  assert.equal(button('Begin this story', completedFeature), undefined, 'The feature does not send a finished learner back to chapter one');
  assert.ok(button('Read again', storyBook(story)), 'Deliberate replay is still available in the library');
});

test('the story feature uses the archive honestly after its dated release calendar ends', async () => {
  setCalendarDate(new RealDate(2027, 0, 5, 12));
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  const feature = document.querySelector('.story-feature');
  assert.match(feature.textContent, /From the story library/);
  assert.match(feature.textContent, /No new edition is scheduled this week/);
  assert.equal(feature.querySelector('.story-daily-chapters'), null);
  await click(button('Begin this story', feature));
  assert.equal(storyText(), STORIES[0].chapters[0].text, 'The archive remains usable when new releases run out');
});

test('the weekly feature refreshes after returning to the tab without replacing an active chapter', async () => {
  setCalendarDate(new RealDate(2026, 9, 25, 12));
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  assert.equal(document.querySelector('#story-feature-title').textContent, STORIES[0].title);
  setCalendarDate(new RealDate(2026, 9, 26, 12));
  await React.act(async () => window.dispatchEvent(new dom.window.Event('focus')));
  assert.equal(document.querySelector('#story-feature-title').textContent, STORIES[1].title, 'A new week is recognized without reloading the app');
  await click(button('Begin this story', document.querySelector('.story-feature')));
  const chapter = storyText();
  await typeText(document.querySelector('textarea'), chapter.slice(0, 4));
  setCalendarDate(new RealDate(2026, 10, 2, 12));
  await React.act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
  assert.equal(storyText(), chapter);
  assert.equal(document.querySelectorAll('.char.correct').length, 4, 'Calendar updates keep the current chapter and typing position');
  await click(button('Story library'));
  assert.equal(document.querySelector('#story-feature-title').textContent, STORIES[2].title, 'The updated recommendation appears when the reader returns to the library');
});

test('export downloads a complete backup including lesson rounds, story bookmarks and exact-key statistics', async context => {
  const progress = emptyProgress();
  progress.lessonProgress = { [LESSON_COURSE[0].id]: { practiceRounds: 2, seenPractice: [LESSON_COURSE[0].practiceVariants[0]], attempts: 2 } };
  progress.storyProgress = { [STORIES[0].id]: { completedChapters: 1, attempts: 1 } };
  progress.storyDrafts = { [STORIES[0].id]: { runId: 'export-partial-story', chapterIndex: 1, text: STORIES[0].chapters[1].text, typed: 'B', attempts: 2, correctAttempts: 1, keyStats: { B: { attempts: 2, errors: 1 } }, elapsed: 5000, updatedAt: '2026-10-22T10:00:00.000Z' } };
  progress.keyStats = { A: { attempts: 10, errors: 3 }, '?': { attempts: 8, errors: 2 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  let exported;
  let download;
  context.mock.method(URL, 'createObjectURL', blob => { exported = blob; return 'blob:typedo-backup-test'; });
  context.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', function () { download = { href: this.href, filename: this.download }; });
  await mountWorkspace();
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Export'));
  assert.equal(exported.type, 'application/json');
  assert.deepEqual(JSON.parse(await exported.text()), (await savedProgress()));
  assert.equal(download.href, 'blob:typedo-backup-test');
  assert.match(download.filename, /^typedo-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(document.querySelector('.toast').textContent, /Progress exported/);
});

test('an unfinished story preserves typed errors and corrections on reload, then credits completion only once', async () => {
  const story = STORIES[0];
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Start story', storyBook(story)));
  const text = storyText();
  let input = document.querySelector('textarea');
  await key(input, 'x');
  await key(input, 'Backspace');
  assert.equal((await savedProgress()).storyDrafts[story.id].typed, '', 'An empty cursor position can still contain a meaningful error history');
  assert.equal((await savedProgress()).storyDrafts[story.id].attempts, 1);
  await typeText(input, text.slice(0, 8));
  await key(input, '@');
  const draft = (await savedProgress()).storyDrafts[story.id];
  assert.equal(draft.typed, `${text.slice(0, 8)}@`);
  assert.equal(draft.attempts, 10);
  assert.equal(draft.correctAttempts, 8);
  assert.deepEqual((await savedProgress()).history, [], 'A partial chapter is not a completed daily session');
  assert.deepEqual((await savedProgress()).keyStats, {}, 'Partial key statistics must not be counted globally yet');
  assert.equal((await savedProgress()).storyProgress[story.id], undefined);

  await reload();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(storyText(), text);
  assert.equal(document.querySelectorAll('.char.correct').length, 8);
  assert.equal(document.querySelectorAll('.char.incorrect').length, 1, 'An uncorrected mistake is restored at the same character');
  assert.equal((await savedProgress()).storyDrafts[story.id].runId, draft.runId, 'Resuming keeps the original completion identity');
  input = document.querySelector('textarea');
  await key(input, 'Backspace');
  await typeText(input, `${text.slice(8)}x`);
  const saved = (await savedProgress());
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].id, draft.runId);
  assert.equal(saved.history[0].errors, 2, 'Correcting before and after reload does not erase either mistake');
  assert.equal(saved.history[0].correct, text.length);
  assert.equal(saved.history[0].accuracy, Math.round(text.length / (text.length + 2) * 1000) / 10);
  assert.ok(saved.history[0].elapsed >= draft.elapsed, 'Resuming retains the time spent before reload');
  assert.equal(saved.storyProgress[story.id].completedChapters, 1);
  assert.equal(saved.storyProgress[story.id].attempts, 1);
  assert.equal(saved.storyDrafts[story.id], undefined, 'A finished chapter has no leftover partial draft');
  assert.equal(saved.keyStats[text[0]].errors, 1);
  assert.equal(saved.keyStats[text[8]].errors, 1);
  await reload();
  assert.equal((await savedProgress()).history.length, 1, 'Reload cannot complete the same draft again');
});

test('story navigation retains a draft while explicit restart clears it', async () => {
  const story = STORIES[1];
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Start story', storyBook(story)));
  const text = storyText();
  await typeText(document.querySelector('textarea'), text.slice(0, 5));
  await click(button('Story library'));
  assert.equal((await savedProgress()).storyDrafts[story.id].typed, text.slice(0, 5));
  assert.equal(document.activeElement, button('Resume chapter 1', storyBook(story)), 'Leaving a partial chapter returns focus to its resume button');
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(document.querySelectorAll('.char.correct').length, 5);
  await click(button(/^Type/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(document.querySelectorAll('.char.correct').length, 5, 'Main navigation keeps the chapter position too');
  await click(button(/^Restart chapter/));
  await confirmRestartIfAsked();
  assert.equal((await savedProgress()).storyDrafts[story.id], undefined, 'Explicit restart removes the saved partial run');
  assert.equal(document.querySelectorAll('.char.correct, .char.incorrect').length, 0);
  await click(button('Story library'));
  assert.ok(button('Start story', storyBook(story)), 'Restarting an untouched chapter does not leave a misleading resume button');
  assert.equal(document.activeElement, button('Start story', storyBook(story)));
  await reload();
  assert.equal((await savedProgress()).storyDrafts[story.id], undefined);
  assert.equal((await savedProgress()).history.length, 0);
});

test('restoring a partial story backup resumes its exact position and elapsed typing time', async () => {
  const story = STORIES[0];
  const incoming = emptyProgress();
  incoming.storyDrafts = { [story.id]: {
    runId: 'restored-story-draft', chapterIndex: 0, text: story.chapters[0].text, typed: 'On ',
    attempts: 4, correctAttempts: 3, keyStats: { O: { attempts: 2, errors: 1 }, n: { attempts: 1, errors: 0 }, ' ': { attempts: 1, errors: 0 } },
    elapsed: 12345, updatedAt: '2026-10-22T10:00:00.000Z',
  } };
  await mountWorkspace();
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  await restoreBackup(incoming);
  assert.equal((await savedProgress()).history.length, 0);
  assert.deepEqual((await savedProgress()).keyStats, {});
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(document.querySelectorAll('.char.correct').length, 3);
  await typeText(document.querySelector('textarea'), story.chapters[0].text.slice(3));
  const run = (await savedProgress()).history[0];
  assert.equal(run.id, 'restored-story-draft');
  assert.equal(run.errors, 1);
  assert.ok(run.elapsed >= 12345, 'Typing time from the backup contributes to the completed result');
  assert.ok(run.elapsed < 60000, 'Time spent away from the saved draft is excluded');
  assert.equal((await savedProgress()).storyDrafts[story.id], undefined);
});

test('an unfinished reread resumes without removing the original story completion', async () => {
  const story = STORIES[0];
  const progress = emptyProgress();
  progress.storyProgress = { [story.id]: { completedChapters: story.chapters.length, attempts: 3, bestAccuracy: 100, lastPracticed: '2026-10-20T10:00:00.000Z' } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Read again', storyBook(story)));
  await typeText(document.querySelector('textarea'), storyText().slice(0, 6));
  await click(button('Story library'));
  assert.ok(button('Resume chapter 1', storyBook(story)), 'A replay draft gets a resume action even when the story was finished before');
  assert.equal((await savedProgress()).storyProgress[story.id].completedChapters, story.chapters.length);
  await reload();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(document.querySelectorAll('.char.correct').length, 6);
  assert.equal((await savedProgress()).history.length, 0, 'A partial reread does not create an extra completed session');
  assert.equal((await savedProgress()).storyProgress[story.id].attempts, 3);
});

test('pagehide immediately saves the latest story time and excludes time away before typing resumes', async context => {
  const story = STORIES[0];
  let clock = 1000;
  context.mock.method(performance, 'now', () => clock);
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Start story', storyBook(story)));
  const text = storyText();
  const input = document.querySelector('textarea');
  await typeText(input, text.slice(0, 2));
  const elapsedAtLastKey = (await savedProgress()).storyDrafts[story.id].elapsed;
  clock += 2500;
  let flushed;
  await React.act(async () => {
    window.dispatchEvent(new dom.window.Event('pagehide'));
    flushed = (await savedProgress()).storyDrafts[story.id];
  });
  assert.equal(flushed.typed, text.slice(0, 2));
  assert.ok(flushed.elapsed >= elapsedAtLastKey + 2500, 'Leaving the page flushes the time since the last key synchronously');
  assert.match(document.querySelector('.story-session-state').textContent, /PAUSED/);

  clock += 3600000;
  await key(input, 'Backspace');
  assert.equal((await savedProgress()).storyDrafts[story.id].elapsed, flushed.elapsed, 'Backspace corrections while paused do not restart the clock');
  assert.equal((await savedProgress()).storyDrafts[story.id].typed, flushed.typed, 'Paused input cannot alter the saved position');
  await click(button('Resume typing', document.querySelector('dialog')));
  await key(input, 'Backspace');
  await key(input, text[1]);
  const resumed = (await savedProgress()).storyDrafts[story.id];
  assert.equal(resumed.elapsed, flushed.elapsed, 'The first new printable key resumes at the preserved elapsed time');
  clock += 500;
  await key(input, text[2]);
  const afterTyping = (await savedProgress()).storyDrafts[story.id];
  assert.ok(afterTyping.elapsed >= flushed.elapsed + 500);
  assert.ok(afterTyping.elapsed < flushed.elapsed + 1000, 'The hidden hour never contributes to story speed');
  clock += 250;
  await React.act(async () => window.dispatchEvent(new dom.window.Event('blur')));
  assert.ok((await savedProgress()).storyDrafts[story.id].elapsed >= afterTyping.elapsed + 250, 'Switching away from the window also flushes and pauses');
  assert.match(document.querySelector('.story-session-state').textContent, /PAUSED/);
  assert.deepEqual((await savedProgress()).history, []);
});

test('when device storage fails, partial stories stay usable and exportable without claiming to be saved', async context => {
  const story = STORIES[0];
  let exported;
  context.mock.method(storage, 'setItem', async () => { throw new Error('Storage denied'); });
  context.mock.method(URL, 'createObjectURL', blob => { exported = blob; return 'blob:unsaved-story-backup-test'; });
  context.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', () => {});
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  assert.match(document.querySelector('.story-storage-note').textContent, /storage is unavailable/);
  await click(button('Start story', storyBook(story)));
  const text = storyText();
  await typeText(document.querySelector('textarea'), text.slice(0, 4));
  const status = document.querySelector('.story-save-status').textContent;
  assert.match(status, /Device storage unavailable/);
  assert.doesNotMatch(status, /is saved/);
  await click(button('Story library'));
  assert.match(storyBook(story).textContent, /Kept for this visit/);
  await click(button('Resume chapter 1', storyBook(story)));
  assert.equal(document.querySelectorAll('.char.correct').length, 4, 'A failed save does not prevent resuming in the current visit');
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Export'));
  const backup = JSON.parse(await exported.text());
  assert.equal(backup.storyDrafts[story.id].typed, text.slice(0, 4));
  assert.equal(backup.history.length, 0);
  assert.equal(await readSaved(STORAGE_KEY), null, 'The test really exercised unavailable persistence');
});

test('failed optional tests can continue learning without repeating completed practice', async () => {
  const progress = emptyProgress();
  const lesson = LESSON_COURSE[0];
  progress.lessonProgress = { [lesson.id]: { practiceRounds: 3, attempts: 3 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await click([...document.querySelectorAll('.lesson-course-card')].find(card => card.textContent.includes(lesson.title)));
  await click(button('Optional test'));
  await typeText(document.querySelector('textarea'), 'x'.repeat(lessonText().length));
  assert.ok(button('Retry test'));
  assert.equal(document.activeElement, button('Next lesson'));
  await key(document.activeElement, 'Enter');
  assert.match(document.querySelector('.lesson-workspace-heading').textContent, new RegExp(LESSON_COURSE[1].title));
  assert.equal((await savedProgress()).lessonProgress[lesson.id].practiceRounds, 3);
  assert.equal((await savedProgress()).history.length, 1, 'Continuing does not create a repeated practice completion');
});

test('a failed optional test resumes unfinished practice and course completion keeps keyboard focus', async () => {
  const progress = emptyProgress();
  const lesson = LESSON_COURSE[0];
  progress.lessonProgress = { [lesson.id]: { practiceRounds: 1, attempts: 1 } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Optional test'));
  await typeText(document.querySelector('textarea'), 'x'.repeat(lessonText().length));
  assert.equal(document.activeElement, button('Return to word practice'));
  await key(document.activeElement, 'Enter', { ctrlKey: true });
  assert.match(document.querySelector('.lesson-round-plan').textContent, /Block 2 of 3/);

  await React.act(async () => root.unmount());
  root = null;
  const almostDone = emptyProgress();
  almostDone.lessonProgress = Object.fromEntries(LESSON_COURSE.map((item, index) => [item.id, { practiceRounds: index === LESSON_COURSE.length - 1 ? 2 : 3, attempts: 3 }]));
  await storage.setItem(STORAGE_KEY, JSON.stringify(almostDone));
  await mountWorkspace();
  await click(button(/^Lessons/, document.querySelector('[aria-label="Main navigation"]')));
  await typeText(document.querySelector('textarea'), lessonText());
  await key(document.activeElement, 'Enter');
  assert.equal(document.activeElement, button('Try a story'));
  await key(document.activeElement, 'Escape');
  assert.ok(document.querySelector('.course-complete'), 'Completion shortcuts cannot restart a hidden lesson');
  assert.equal(document.querySelector('#lesson-accessible-prompt'), null);
});

test('a reread resumes at chapter boundaries after leaving and reloading', async () => {
  const story = STORIES[0];
  const progress = emptyProgress();
  progress.storyProgress = { [story.id]: { completedChapters: 3, attempts: 3, bestAccuracy: 100, lastPracticed: '2026-10-20T00:00:00.000Z' } };
  await storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await mountWorkspace();
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Read again', storyBook(story)));
  for (let chapterIndex = 0; chapterIndex < story.chapters.length; chapterIndex++) {
    assert.equal(storyText(), story.chapters[chapterIndex].text);
    await typeText(document.querySelector('textarea'), storyText());
    assert.equal((await savedProgress()).storyProgress[story.id].completedChapters, 3);
    assert.equal((await savedProgress()).storyDrafts[story.id], undefined);
    if (chapterIndex < story.chapters.length - 1) {
      assert.equal((await savedProgress()).storyProgress[story.id].replayChapter, chapterIndex + 1);
      await click(button('Finish for now'));
      assert.ok(button(`Resume chapter ${chapterIndex + 2}`, storyBook(story)));
      assert.equal(document.activeElement, button(`Resume chapter ${chapterIndex + 2}`, storyBook(story)), 'Chapter-boundary navigation preserves a useful keyboard position');
      await reload();
      await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
      await click(button(`Resume chapter ${chapterIndex + 2}`, storyBook(story)));
    }
  }
  assert.equal((await savedProgress()).storyProgress[story.id].replayChapter, undefined);
  assert.equal((await savedProgress()).history.length, 3);
  assert.equal(document.activeElement, button('Choose another story'));
  await key(document.activeElement, 'Enter');
  assert.ok(button('Read again', storyBook(story)));
  assert.equal(document.activeElement, button('Read again', storyBook(story)), 'Finishing a story returns focus to its library action');
});

test('unreadable saves survive startup and typing until a valid backup is explicitly restored', async context => {
  const raw = JSON.stringify({ version: 2, history: [{ note: 'Preserve this newer save.' }] }, null, 2) + '\n';
  await storage.setItem(STORAGE_KEY, raw);
  const downloads = [];
  context.mock.method(URL, 'createObjectURL', blob => { downloads.push(blob); return 'blob:typedo-recovery-test'; });
  context.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', () => {});
  await mountWorkspace(() => React.createElement(React.StrictMode, null, React.createElement(App, { storage })));
  assert.equal((await readSaved(STORAGE_KEY)), raw);
  assert.match(document.querySelector('.warning').textContent, /Automatic saving is paused/);
  await click(button('Download original save'));
  assert.equal(await downloads[0].text(), raw, 'The original can be recovered byte for byte');
  await click(document.querySelector('[aria-label="Use light theme"]'));
  await click(button('Word practice'));
  const text = document.querySelector('#accessible-prompt').textContent.replace(/^Text to type: /, '');
  await typeText(document.querySelector('[aria-label="Typing input"]'), text);
  assert.equal((await readSaved(STORAGE_KEY)), raw, 'New work cannot overwrite the unreadable original automatically');
  await click(button('Progress', document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Export'));
  const current = JSON.parse(await downloads[1].text());
  assert.equal(current.history.length, 1, 'The current session can still be exported');
  await restoreBackup('{still invalid');
  assert.equal((await readSaved(STORAGE_KEY)), raw, 'A failed restore cannot lift recovery protection');
  await restoreBackup(emptyProgress());
  assert.equal((await savedProgress()).version, 1);
  assert.equal((await savedProgress()).history.length, 1, 'Valid recovery keeps the work completed during this visit');
  assert.equal(document.querySelector('.warning'), null);
  assert.match(document.querySelector('footer').textContent, /Saved locally/);
});

