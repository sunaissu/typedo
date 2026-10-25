import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { challengeCategory, readSharedChallenge } from '../src/challenges.js';

let dom, server, React, createRoot, Challenges, root;
const globals = new Map();
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://typedo.example/', pretendToBeVisual: true });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: Challenges } = await server.ssrLoadModule('/src/Challenges.jsx'));
});
afterEach(async () => { if (root) await React.act(async () => root.unmount()); root = null; });
after(async () => {
  await server?.close(); dom?.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});
const button = label => [...(document.querySelector('dialog') || document).querySelectorAll('button')].find(item => item.textContent.trim() === label);
const input = () => document.querySelector('.diagnostic-input');
async function mount(props = {}) {
  root = createRoot(document.querySelector('#root'));
  await React.act(async () => root.render(React.createElement(Challenges, props)));
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

test('a shared challenge starts intentionally, accepts literal text, and records a stable result once', async () => {
  const results = [];
  const challenge = { title: 'Small challenge', text: 'ab p?' };
  await mount({ initialChallenge: challenge, onComplete: result => results.push(result) });
  assert.equal(document.activeElement.tagName, 'H1');
  assert.equal(input(), null);
  await click(button('Start shared challenge'));
  assert.equal(document.activeElement, input());
  assert.match(document.querySelector('#challenge-instructions').textContent, /^0 of/);
  assert.equal((await key(input(), 'Tab')).defaultPrevented, false);
  await type(challenge.text);
  assert.equal(results.length, 1);
  assert.equal(results[0].category, challengeCategory(challenge.text));
  assert.equal(results[0].interrupted, false);
  assert.equal(results[0].accuracy, 100);
  assert.equal(results[0].correct, challenge.text.length);
  assert.equal(document.activeElement, button('Try the same passage'));
  await key(document.activeElement, 'Escape');
  await click(button('Create link'));
  assert.equal(results.length, 1, 'Sharing and Escape must not record completion again');
  assert.deepEqual(readSharedChallenge(new URL(document.querySelector('.challenge-share input').value).hash), challenge);
});

test('challenge pause preserves position and marks the eventual result as interrupted practice', async () => {
  const results = [];
  const challenge = { title: 'Pause check', text: 'abc def' };
  await mount({ initialChallenge: challenge, onComplete: result => results.push(result) });
  await click(button('Start shared challenge'));
  await type('abc');
  await key(input(), 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Challenge paused');
  assert.equal(document.activeElement, button('Resume typing'));
  await click(button('Resume typing'));
  assert.equal(document.activeElement, input());
  assert.match(document.querySelector('#challenge-instructions').textContent, /^3 of/);
  await type(' def');
  assert.equal(results.length, 1);
  assert.equal(results[0].interrupted, true);
  assert.match(document.querySelector('.diagnostic-results').textContent, /excluded from challenge personal bests/);
});

test('share link creation requires a separate copy action and offers an honest clipboard fallback', async () => {
  await mount();
  await click(button('Create link'));
  const linkInput = document.querySelector('.challenge-share input');
  assert.ok(linkInput.value.includes('#challenge='));
  assert.match(document.querySelector('.challenge-share').textContent, /includes the full passage text/);
  await click(button('Copy challenge link'));
  assert.equal(document.activeElement, linkInput);
  assert.equal(linkInput.selectionStart, 0);
  assert.equal(linkInput.selectionEnd, linkInput.value.length);
  assert.match(document.querySelector('p[role="status"]').textContent, /Automatic copying is unavailable/);
});

test('choosing a new challenge protects the unfinished visit and defaults to keeping it', async () => {
  await mount({ initialChallenge: { title: 'Keep my place', text: 'abc def' } });
  await click(button('Start shared challenge'));
  await type('abc');
  await key(input(), 'Escape');
  await frame();
  await click(button('Finish for now'));
  assert.ok(button('Continue unfinished challenge'));
  await click(button('Start challenge'));
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Replace the unfinished challenge?');
  assert.equal(document.activeElement, button('Keep current challenge'));
  await click(button('Keep current challenge'));
  assert.match(document.querySelector('#challenge-instructions').textContent, /^3 of/);
  assert.equal(document.activeElement, input());
});
