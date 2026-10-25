import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { emptyProgress, STORAGE_KEY } from '../src/storage.js';

let dom, server, React, createRoot, App, root;
const original = new Map();
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  React = await import('react'); ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: App } = await server.ssrLoadModule('/src/App.jsx'));
});
afterEach(async () => { if (root) await React.act(async () => root.unmount()); root = null; dom.window.localStorage.clear(); });
after(async () => { await server?.close(); dom?.window.close(); for (const [key, value] of original) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
const button = (text, scope = document) => [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === text);
async function click(element) { assert.ok(element); await React.act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); }
async function key(element, value, modifiers = {}) { await React.act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers }))); }
async function frame() { await React.act(async () => new Promise(resolve => requestAnimationFrame(resolve))); }
async function mount() { root = createRoot(document.getElementById('root')); await React.act(async () => root.render(React.createElement(App))); }
const saved = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY));
function seed(mode = 'custom') { const progress = emptyProgress(); Object.assign(progress.settings, { mode, customText: 'a cat', guide: false }); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }

test('free practice pauses, survives Home and reload, and completes its stable run once', async () => {
  seed(); await mount();
  await click(button('Type', document.querySelector('nav')));
  let input = document.querySelector('[aria-label="Typing input"]');
  assert.equal(document.activeElement, input);
  await key(input, 'x'); await key(input, 'Backspace'); await key(input, 'a'); await key(input, 'Escape');
  assert.ok(document.querySelector('dialog[open]'));
  const draft = Object.values(saved().workspaceDrafts)[0];
  assert.equal(draft.typed, 'a'); assert.equal(draft.attempts, 2);
  await click(button('Finish for now', document.querySelector('dialog')));
  assert.ok(document.querySelector('.home-continue').textContent.includes('custom passage'));
  await React.act(async () => root.unmount()); root = null; await mount();
  await click(document.querySelector('.home-continue button'));
  await click(button('Resume typing', document.querySelector('dialog'))); await frame();
  input = document.querySelector('[aria-label="Typing input"]');
  assert.equal(document.activeElement, input);
  for (const value of ' cat') await key(input, value);
  assert.equal(saved().history.length, 1);
  assert.equal(saved().history[0].id, draft.id);
  assert.equal(saved().history[0].errors, 1);
  assert.deepEqual(saved().workspaceDrafts, {});
  await key(input, 'a'); assert.equal(saved().history.length, 1);
});

test('paused word tests finish as practice and never establish a personal best', async () => {
  seed('words'); await mount(); await click(button('Type', document.querySelector('nav')));
  let input = document.querySelector('[aria-label="Typing input"]');
  const text = document.querySelector('#accessible-prompt').textContent.replace('Text to type: ', '');
  await key(input, text[0]); await key(input, 'Escape');
  await click(button('Resume typing', document.querySelector('dialog'))); await frame();
  for (const value of text.slice(1)) await key(input, value);
  assert.equal(saved().history.length, 1); assert.equal(saved().history[0].interrupted, true);
  assert.match(document.querySelector('.results').textContent, /practice result/);
  assert.match(document.querySelector('.bottom-stats').textContent, /No personal best yet/);
});

test('native Tab is not consumed, retry asks before loss, and literal shortcut characters remain input', async () => {
  seed(); await mount(); await click(button('Type', document.querySelector('nav')));
  const input = document.querySelector('[aria-label="Typing input"]');
  const tab = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  await React.act(async () => input.dispatchEvent(tab)); assert.equal(tab.defaultPrevented, false);
  for (const value of 'P? ') await key(input, value);
  await key(input, 'Enter', { shiftKey: true });
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Restart this attempt?');
  await click(button('Keep practicing', document.querySelector('dialog'))); await frame();
  assert.equal(Object.values(saved().workspaceDrafts)[0].typed, 'P? ');
  assert.equal(document.activeElement, input);
});

test('settings pause practice and restore focus to the opener without losing the draft', async () => {
  seed(); await mount(); await click(button('Type', document.querySelector('nav')));
  const input = document.querySelector('[aria-label="Typing input"]'); await key(input, 'a');
  const settings = document.querySelector('[aria-label="Settings"]');
  await React.act(async () => settings.focus()); await click(settings); await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Practice settings');
  await click(button('Done', document.querySelector('dialog')));
  assert.equal(document.activeElement, settings);
  assert.equal(Object.values(saved().workspaceDrafts)[0].typed, 'a');
  await click(button('Resume typing', document.querySelector('.session-actions'))); await frame();
  assert.equal(document.activeElement, input);
});

test('parent storage preserves a lesson when switching to an assessment requires confirmation', async () => {
  seed(); await mount(); await click(document.querySelector('.home-continue button')); await frame();
  const input = document.querySelector('textarea');
  const text = document.querySelector('#lesson-accessible-prompt').textContent.replace('Text to type: ', '');
  await key(input, text[0]); await key(input, text[1]);
  await click(button('Optional test')); await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Restart this attempt?');
  assert.equal(Object.values(saved().lessonDrafts)[0].typed.length, 2);
  await click(button('Keep practicing', document.querySelector('dialog'))); await frame();
  assert.equal(document.activeElement, input);
});
