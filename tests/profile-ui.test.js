import { testStorage, settleStorage } from './storage-helpers.js';
import test, { beforeEach, after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { STORIES } from '../src/stories.js';
import { PROFILE_METADATA_KEY, addProfile, defaultProfiles, profileStorageKey } from '../src/profiles.js';

let dom, server, React, createRoot, ProfilesApp, root;
let storage;
beforeEach(() => { storage = testStorage(dom.window.localStorage); });
async function readSaved(key) {
  await settleStorage(React);
  let raw;
  await React.act(async () => { raw = await storage.getItem(key); });
  return raw;
}

const originals = new Map();
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: ProfilesApp } = await server.ssrLoadModule('/src/ProfilesApp.jsx'));
});
afterEach(async () => { if (root) await React.act(async () => root.unmount()); root = null; await storage.close(); dom.window.localStorage.clear(); });
after(async () => {
  await server?.close(); dom?.window.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
});
async function frame() { await React.act(async () => new Promise(resolve => requestAnimationFrame(resolve))); await settleStorage(React); }
async function mount() { root = createRoot(document.querySelector('#root')); await React.act(async () => root.render(React.createElement(ProfilesApp, { storage }))); await settleStorage(React); await frame(); }
const button = (text, scope = document) => [...scope.querySelectorAll('button')].find(item => typeof text === 'string' ? item.textContent.trim() === text : text.test(item.textContent));
const manage = () => document.querySelector('[aria-label="Manage local profiles"]');
async function click(target) { assert.ok(target, 'Expected action is available'); await React.act(async () => target.click()); await frame(); }
async function type(input, text) { await React.act(async () => { for (const key of text) input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }); await settleStorage(React); }
async function value(input, next) {
  await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, next); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function submit(form) { await React.act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))); await frame(); }
async function openFirstStory() {
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Start story', document.querySelector('.story-book')));
}
const originalSave = async () => JSON.parse((await readSaved('typedo:v1')));

test('creating and switching profiles pauses the active story and keeps each saved caret separate', async () => {
  await mount();
  await openFirstStory();
  const text = STORIES[0].chapters[0].text;
  await type(document.querySelector('.story-type-surface textarea'), text.slice(0, 3));
  await click(manage());
  assert.equal(document.querySelectorAll('dialog').length, 1, 'The profiles dialog owns focus while practice is paused');
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Profiles in this browser');
  assert.equal(document.activeElement, document.querySelector('.profile-list button.current'));
  assert.match(document.querySelector('.story-session-state').textContent, /PAUSED/);
  assert.equal((await originalSave()).storyDrafts[STORIES[0].id].typed, text.slice(0, 3));
  await value(document.querySelector('#new-profile'), 'Alex');
  await submit(document.querySelector('.profile-create'));
  assert.equal(document.querySelector('dialog'), null);
  assert.match(manage().textContent, /Alex/);
  const metadata = JSON.parse((await readSaved(PROFILE_METADATA_KEY)));
  assert.notEqual(metadata.activeId, 'default');
  assert.equal(metadata.profiles.length, 2);
  await openFirstStory();
  assert.equal(document.querySelectorAll('.story-type-surface .char.correct').length, 0);
  await type(document.querySelector('.story-type-surface textarea'), text.slice(0, 1));
  await click(manage());
  await click(button(/^Original profile/, document.querySelector('.profile-list')));
  assert.match(manage().textContent, /Original profile/);
  assert.equal((await originalSave()).storyDrafts[STORIES[0].id].typed, text.slice(0, 3));
  const personal = JSON.parse((await readSaved(profileStorageKey(metadata.activeId))));
  assert.equal(personal.storyDrafts[STORIES[0].id].typed, text.slice(0, 1));
  assert.deepEqual(personal.history, []);
  assert.deepEqual((await originalSave()).history, []);
  await click(button(/^Stories/, document.querySelector('[aria-label="Main navigation"]')));
  await click(button('Resume chapter 1', document.querySelector('.story-book')));
  assert.equal(document.querySelectorAll('.story-type-surface .char.correct').length, 3);
});

test('profile rename preserves the current history and Escape returns to paused practice', async () => {
  await mount();
  await openFirstStory();
  await type(document.querySelector('.story-type-surface textarea'), 'On');
  const runId = (await originalSave()).storyDrafts[STORIES[0].id].runId;
  await click(manage());
  await value(document.querySelector('#rename-profile'), 'Family learner');
  await submit(document.querySelector('.profile-rename form'));
  assert.match(manage().textContent, /Family learner/);
  assert.equal((await originalSave()).storyDrafts[STORIES[0].id].runId, runId);
  await React.act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  await frame();
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Practice paused');
  await click(button('Resume typing', document.querySelector('dialog')));
  assert.equal(document.activeElement, document.querySelector('.story-type-surface textarea'));
  assert.equal(document.querySelectorAll('.story-type-surface .char.correct').length, 2);
});

test('invalid metadata stays untouched while the original browser profile remains usable', async () => {
  const raw = '{ original broken profile metadata';
  await storage.setItem(PROFILE_METADATA_KEY, raw);
  await mount();
  await click(manage());
  assert.match(document.querySelector('.form-error').textContent, /has not been replaced/);
  assert.equal(document.querySelector('.profile-create'), null);
  assert.equal((await readSaved(PROFILE_METADATA_KEY)), raw);
  await click(button(/^Return to Original profile/));
  await openFirstStory();
  await type(document.querySelector('.story-type-surface textarea'), 'O');
  assert.equal((await originalSave()).storyDrafts[STORIES[0].id].typed, 'O');
  assert.equal((await readSaved(PROFILE_METADATA_KEY)), raw);
});

test('another tab changing the profile list does not switch this tab or overwrite its metadata', async () => {
  await mount();
  await click(manage());
  const other = addProfile(defaultProfiles(), 'Other tab', () => 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  await storage.setItem(PROFILE_METADATA_KEY, JSON.stringify(other));
  await value(document.querySelector('#new-profile'), 'My new profile');
  await submit(document.querySelector('.profile-create'));
  assert.match(document.querySelector('.form-error').textContent, /changed in another tab/);
  assert.match(manage().textContent, /Original profile/);
  assert.deepEqual(JSON.parse((await readSaved(PROFILE_METADATA_KEY))), other);
  assert.equal(document.querySelectorAll('.profile-list li').length, 2);
});

test('a failed final checkpoint keeps the active profile and its unfinished work open', async context => {
  await mount();
  await openFirstStory();
  await type(document.querySelector('.story-type-surface textarea'), 'On');
  await click(manage());
  context.mock.method(storage, 'compareAndSet', async () => { throw new Error('Quota exceeded'); });
  await value(document.querySelector('#new-profile'), 'Alex');
  await submit(document.querySelector('.profile-create'));
  assert.match(document.querySelector('.form-error').textContent, /could not be saved/);
  assert.match(manage().textContent, /Original profile/);
  assert.equal(document.querySelectorAll('.story-type-surface .char.correct').length, 2);
  assert.equal(await readSaved(PROFILE_METADATA_KEY), null);
  await click(button(/^Return to Original profile/));
  assert.equal(document.querySelector('dialog').getAttribute('aria-label'), 'Practice paused');
});
