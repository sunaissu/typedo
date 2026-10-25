import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { DIAGNOSTIC_TEXT } from '../src/diagnostic.js';

let dom, server, React, createRoot, Diagnostic, root;
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
  ({ default: Diagnostic } = await server.ssrLoadModule('/src/Diagnostic.jsx'));
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
  await React.act(async () => root.render(React.createElement(Diagnostic, props)));
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

test('starting check requires an intentional Begin, keeps Tab native, and resumes exact position with Escape', async () => {
  await mount();
  assert.equal(document.activeElement, button('Begin the check'));
  assert.equal(input(), null);
  await click(button('Begin the check'));
  assert.equal(document.activeElement, input());
  assert.match(document.querySelector('#diagnostic-instructions').textContent, /^0 of/);
  await type(DIAGNOSTIC_TEXT.slice(0, 7));
  assert.equal((await key(input(), 'Tab')).defaultPrevented, false);
  await key(input(), 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Starting check paused');
  assert.equal(document.activeElement, button('Resume typing'));
  assert.match(document.querySelector('dialog').textContent, /not saved in your progress or backups/);
  await key(document.activeElement, 'Escape');
  await frame();
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.activeElement, input());
  assert.match(document.querySelector('#diagnostic-instructions').textContent, /^7 of/);
  await key(input(), DIAGNOSTIC_TEXT[7]);
  assert.match(document.querySelector('#diagnostic-instructions').textContent, /^8 of/);
});

test('starting check completes with a recommendation and leaves lesson selection to the user', async () => {
  const choices = [];
  await mount({ onChooseLesson: id => choices.push(id), guideEnabled: true });
  await click(button('Begin the check'));
  await type(DIAGNOSTIC_TEXT);
  assert.deepEqual(choices, []);
  assert.equal(document.activeElement, button('Open Word flow'));
  assert.match(document.querySelector('.diagnostic-results').textContent, /Finger hints were used/);
  assert.ok(button('Start with First words'));
  await key(document.activeElement, 'Escape');
  assert.ok(document.querySelector('.diagnostic-results'));
  await click(button('Open Word flow'));
  assert.deepEqual(choices, ['word-flow']);
});

test('diagnostic retries require confirmation and background suspension preserves text', async () => {
  await mount();
  await click(button('Begin the check'));
  await type(DIAGNOSTIC_TEXT.slice(0, 5));
  await key(input(), 'Enter', { shiftKey: true });
  await frame();
  assert.equal(document.activeElement, button('Keep practicing'));
  await click(button('Keep practicing'));
  assert.match(document.querySelector('#diagnostic-instructions').textContent, /^5 of/);
  await React.act(async () => root.render(React.createElement(Diagnostic, { suspended: true })));
  assert.equal(document.querySelector('dialog'), null, 'A global dialog owns focus while the check is suspended');
  await key(input(), DIAGNOSTIC_TEXT[5]);
  assert.match(document.querySelector('#diagnostic-instructions').textContent, /^5 of/);
  await React.act(async () => root.render(React.createElement(Diagnostic, { suspended: false })));
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Starting check paused');
  await click(button('Resume typing'));
  await key(input(), 'Enter', { shiftKey: true });
  await click(button('Restart attempt'));
  assert.match(document.querySelector('#diagnostic-instructions').textContent, /^0 of/);
  assert.equal(document.activeElement, input());
});
