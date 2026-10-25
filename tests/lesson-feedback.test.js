import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, enterKey } from '../src/typing.js';
import { getLessonFeedback, getRepeatedErrorFeedback, keyInstruction, keyLabel } from '../src/lessonFeedback.js';

test('block feedback waits for repeated errors and enough attempts', () => {
  assert.equal(getLessonFeedback({}), null);
  assert.equal(getLessonFeedback({ a: { attempts: 7, errors: 2 }, b: { attempts: 8, errors: 1 }, c: { attempts: 30, errors: 2 } }), null);
  const feedback = getLessonFeedback({ a: { attempts: 20, errors: 2 } });
  assert.equal(feedback.keys.length, 1, 'Exactly ten percent meets the feedback threshold');
  assert.equal(feedback.keys[0].key, 'a');
  assert.match(feedback.summary, /2 mistakes in 20 attempts/);
  assert.equal(feedback.actionLabel, 'Practise this block again');
});

test('block feedback keeps case separate and limits advice to two evidenced keys', () => {
  const feedback = getLessonFeedback({
    a: { attempts: 10, errors: 3 }, A: { attempts: 8, errors: 4 },
    f: { attempts: 10, errors: 2 }, j: { attempts: 100, errors: 0 },
  });
  assert.deepEqual(feedback.keys.map(item => item.key), ['A', 'a']);
  assert.match(feedback.summary, /capital A: 4 mistakes in 8 attempts/);
  assert.match(feedback.summary, /lowercase a: 3 mistakes in 10 attempts/);
  assert.match(feedback.keys[0].instruction, /Hold Right Shift with your right pinky/);
  assert.match(feedback.keys[0].instruction, /A key with your left pinky finger/);
  assert.doesNotMatch(feedback.keys[1].instruction, /Shift/);
});

test('Space and shifted punctuation have readable labels and physical key instructions', () => {
  const feedback = getLessonFeedback({ ' ': { attempts: 8, errors: 4 }, '?': { attempts: 8, errors: 2 } });
  assert.deepEqual(feedback.keys.map(item => item.key), [' ', '?']);
  assert.equal(feedback.keys[0].label, 'Space');
  assert.equal(feedback.keys[0].instruction, 'Press the Space bar with either thumb.');
  assert.equal(feedback.keys[1].label, 'question mark (?)');
  assert.match(feedback.keys[1].instruction, /Hold Left Shift with your left pinky/);
  assert.match(feedback.keys[1].instruction, /slash \(\/\) key with your right pinky finger/);
  assert.equal(keyLabel(';'), 'semicolon (;)');
  assert.match(keyInstruction(':'), /semicolon \(;\) key/);
});

test('live feedback appears after repeated attempts and clears on correction or backspace', () => {
  const config = { mode: 'practice', strict: true };
  let session = enterKey(createSession('A a'), 'a', config, 100);
  assert.equal(getRepeatedErrorFeedback(session), null);
  session = enterKey(session, 'a', config, 200);
  const feedback = getRepeatedErrorFeedback(session);
  assert.equal(feedback.expected, 'A');
  assert.equal(feedback.pressed, 'a');
  assert.equal(feedback.message, 'You pressed lowercase a; expected capital A.');
  assert.match(feedback.instruction, /Right Shift/);
  assert.equal(getRepeatedErrorFeedback(enterKey(session, 'A', config, 300)), null);
  assert.equal(getRepeatedErrorFeedback(enterKey(session, 'Backspace', config, 300)), null);
});

test('live feedback describes the last actual key, including a mistaken space', () => {
  const config = { mode: 'practice', strict: true };
  let session = enterKey(createSession('f'), 'g', config, 100);
  session = enterKey(session, ' ', config, 200);
  assert.equal(getRepeatedErrorFeedback(session).message, 'You pressed Space; expected lowercase f.');
});

test('legacy sessions and insufficient or malformed evidence produce no advice', () => {
  assert.equal(getRepeatedErrorFeedback({ text: 'a', typed: '', status: 'running', lastWrong: 'a' }), null);
  assert.equal(getRepeatedErrorFeedback({ ...createSession('a'), status: 'finished', wrongStreak: 2, lastWrong: 'a', lastWrongKey: 'x', lastWrongPosition: 0 }), null);
  assert.equal(getLessonFeedback({ a: { attempts: 8, errors: 9 }, b: { attempts: Infinity, errors: 2 }, c: { attempts: 8, errors: 2.5 }, Enter: { attempts: 8, errors: 2 }, d: null }), null);
  assert.equal(getLessonFeedback(null), null);
  assert.equal(keyLabel('Enter'), '');
  assert.equal(keyInstruction('Enter'), '');
});
