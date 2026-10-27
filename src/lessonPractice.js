import { LESSON_CONTENT } from './lessonContent.js';
import { CHECK_EXTRAS, FLUENT_SCENES, ROUND_EXTRAS, THEMED_SCENES } from './lessonPracticeContent.js';

export const LESSON_THEMES = [
  { id: 'everyday', label: 'Everyday life', description: 'Warm kitchens, small errands, and messages to friends.' },
  { id: 'outdoors', label: 'Outdoors', description: 'Quiet paths, gardens, and time beside the water.' },
  { id: 'adventure', label: 'A little adventure', description: 'Follow a clue and see where it takes you.' },
];

export const PRACTICE_LENGTHS = [
  { id: 'quick', label: 'Quick', description: 'A shorter visit with a little of each skill.' },
  { id: 'standard', label: 'Standard', description: 'A fuller practice session, about 3 to 5 minutes at a steady pace.' },
  { id: 'extra', label: 'Extra practice', description: 'More varied passages when you want to keep going.' },
];

const HOME = 'asdfjklertion';
const CENTER = `${HOME}gh`;
const TOP = `${CENTER}wyuqp`;
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const LETTERS = `${LOWER}${LOWER.toUpperCase()}`;
const DIGITS = `${LETTERS}0123456789`;
const ALL = `${DIGITS},.?!"';:`;

const ROUND_KEYS = {
  'find-home': ['asdfjkl', 'ert', 'ion'],
  'home-row': ['asdfjkl', 'ert', 'ion'],
  'center-reach': ['g', 'h', 'gh'],
  'top-row': ['wyu', 'qp', 'wyuqp'],
  'bottom-row': ['cvb', 'mzx', 'cvbmzx'],
  capitals: ['MBA', 'TWO', 'AEP'],
  numbers: ['12345', '67890', '1234567890'],
  punctuation: [',.', '?!"\'', ';:'],
  'word-flow': ['th', 'er', 'ing'],
  contractions: ["'", "'", "'"],
  messages: ['?!', ':03', ".'"],
  'mixed-text': [',.2', '"?', ':;1'],
};

const ALLOWED = {
  'find-home': ['asdfjkl', 'asdfjklert', HOME],
  'home-row': [HOME, HOME, HOME],
  'center-reach': [`${HOME}g`, CENTER, CENTER],
  'top-row': [`${CENTER}wyu`, TOP, TOP],
  'bottom-row': [`${TOP}cvb`, LOWER, LOWER],
  capitals: [LETTERS, LETTERS, LETTERS],
  numbers: [`${LETTERS}12345`, DIGITS, DIGITS],
  punctuation: [`${DIGITS},.`, `${DIGITS},.?!"'`, ALL],
  'word-flow': [ALL, ALL, ALL],
  contractions: [ALL, ALL, ALL],
  messages: [ALL, ALL, ALL],
  'mixed-text': [ALL, ALL, ALL],
};

export const LESSON_TARGET_KEYS = Object.fromEntries(Object.entries(ROUND_KEYS).map(([id, rounds]) => [id, [...new Set(rounds.join(''))]]));

export const LESSON_TEST_PASSAGES = {
  'find-home': [
    'jada takes a flask of tea to a friend at a station',
    'jada sorts a little jar of salt and a set of forks',
    'a friend asks jada to fold a red dress after dinner',
    'jada finds a note inside a tin and reads it at a desk',
  ],
  'home-row': [
    'jada joins a friend for tea and toast near a lake',
    'a tailor asks jada to sort silk ties and fold a skirt',
    'jada sets a jar of oil and a flask of tea on a red stool',
    'after a train ride jada rests at a desk and reads a letter',
  ],
  'center-reach': [
    'the girl holds a green glass as the dog heads for the gate',
    'a heron stands in the shade and a frog hides near a log',
    'she hangs her hat on a high hook and gathers fresh greens',
    'three friends hear a song as the gardener lights a lantern',
  ],
  'top-row': [
    'your puppy quietly follows the path while we study the sky',
    'we put a yellow quilt near the pool and study the quiet water',
    'the squirrel stays under a tree as your puppy plays near us',
    'please write your reply while we wait for the early train',
  ],
  'bottom-row': [
    'six zebras move beyond the camp as a blue bicycle passes',
    'my cousin leaves a box of vegetables beside the kitchen door',
    'a lazy fox watches the breeze move a branch above the stream',
    'we pack a puzzle and some bread before visiting the museum',
  ],
  capitals: [
    'Mia and Ben meet Ana and Paul near Oak Street on Wednesday',
    'Ella asks Tom to bring a map while Oliver waits for Maya',
    'We visit Brighton with Ana before Paul takes the train',
    'After breakfast Ella and Ben walk to the park with Tom',
  ],
  numbers: [
    'Order 120 has 3 bowls and 4 cups for the 5 guests in room 67',
    'Bus 89 reaches gate 10 in 23 minutes with 45 people aboard',
    'Pack 6 boxes with 7 jars each and leave 8 bags by room 90',
    'We count 123 seeds in tray 45 and 678 seeds in tray 90',
  ],
  punctuation: [
    'Ana asks: "Is this yours?" "Yes, thanks!" I take my coat; it\'s still warm.',
    'Ben says: "Don\'t leave yet!" We wait by the door; the taxi is late.',
    '"What\'s in the bag?" Mia asks. Bread, apples, and cheese; lunch is ready!',
    'Here\'s the list: tea, milk, and rolls. "Anything else?" "That\'s all!"',
  ],
  'word-flow': [
    'The light grew softer while we were gathering flowers beside the river.',
    'After putting the dishes away, I sat by the window to finish my letter.',
    'We brought the other chair into the kitchen and waited for dinner.',
    'There was time for another walk before the evening train arrived.',
  ],
  contractions: [
    "I've found your scarf, but I haven't seen the gloves you left with it.",
    "We'd like to stay longer, though we'll need to catch the last bus home.",
    "She doesn't mind the rain; she's brought an umbrella for both of us.",
    "You're welcome to join us. There's enough soup, and I'll warm some bread.",
  ],
  messages: [
    "Can you meet at 3:00? I'll wait outside room 30. See you there!",
    "We're leaving at 10:30. Could you bring 3 cups? Thanks for your help!",
    "I've saved you a seat. The talk starts at 3:30; are you on your way?",
    "Don't rush! Our bus leaves at 13:00, so there's time for lunch.",
  ],
  'mixed-text': [
    'At 1:20, we packed 2 bags; the bus was waiting. "Ready?" Ana asked.',
    'The note read: "Bring 2 cups, 1 plate, and bread"; I added some fruit.',
    '"Is this room 12?" Ben asked. A sign pointed upstairs; we followed it.',
    'At 2:10, we stopped for tea. "Shall we sit here?" The table had 1 chair.',
  ],
};

const count = (text, key) => text.split(key).length - 1;
const validId = lessonId => Object.hasOwn(LESSON_CONTENT, lessonId) ? lessonId : 'find-home';
const validRound = round => Number.isInteger(round) ? Math.max(0, Math.min(2, round)) : 0;
const validTheme = theme => LESSON_THEMES.some(item => item.id === theme) ? theme : 'everyday';
const validLength = length => PRACTICE_LENGTHS.some(item => item.id === length) ? length : 'standard';
const allowedPassage = (text, allowed) => typeof text === 'string' && text.length > 0 && [...text].every(key => key === ' ' || allowed.includes(key));

function rotated(items, offset) {
  const index = items.length ? offset % items.length : 0;
  return [...items.slice(index), ...items.slice(0, index)];
}

function sampleIndex(random) {
  const sample = typeof random === 'function' ? random() : 0;
  return Number.isFinite(sample) ? Math.floor(Math.max(0, Math.min(0.999999, sample)) * 10000) : 0;
}

function coverageScore(text, targets, current, required) {
  return targets.reduce((score, key) => score + Math.min(Math.max(0, required - count(current, key)), count(text, key)), 0);
}

function fillBlock(initial, pool, targets, required, minimumLength, seen = new Set()) {
  const passages = [...initial];
  let text = passages.join(' ');
  const used = new Set(passages);
  for (let step = 0; step < 60; step++) {
    const missing = targets.some(key => count(text, key) < required);
    if (!missing && text.length >= minimumLength) break;
    const available = pool.filter(passage => !used.has(passage));
    const choices = available.length ? available : pool.filter(passage => passage !== passages.at(-1));
    if (!choices.length) break;
    const fresh = choices.filter(passage => !seen.has(passage));
    const candidates = fresh.length && (!missing || fresh.some(passage => coverageScore(passage, targets, text, required) > 0)) ? fresh : choices;
    const next = missing
      ? [...candidates].sort((a, b) => coverageScore(b, targets, text, required) - coverageScore(a, targets, text, required))[0]
      : candidates[0];
    passages.push(next);
    used.add(next);
    text = passages.join(' ');
  }
  return passages;
}

function adaptivePassage(pool, keyStats, allowed, baseText) {
  const candidates = Object.entries(keyStats && typeof keyStats === 'object' ? keyStats : {})
    .filter(([key, record]) => key.length === 1 && allowed.includes(key) && record
      && Number.isFinite(record.attempts) && record.attempts >= 8
      && Number.isFinite(record.errors) && record.errors >= 2 && record.errors <= record.attempts)
    .sort((a, b) => b[1].errors / b[1].attempts - a[1].errors / a[1].attempts)
    .slice(0, 2).map(([key]) => key);
  if (!candidates.length) return { passage: '', keys: [] };
  const choices = pool.filter(passage => passage.length + 1 <= baseText.length / 3 && !baseText.endsWith(passage) && candidates.some(key => passage.includes(key)));
  choices.sort((a, b) => Number(baseText.includes(a)) - Number(baseText.includes(b)) || candidates.reduce((score, key) => score + count(b, key) - count(a, key), 0));
  const passage = choices[0] || '';
  return { passage, keys: candidates.filter(key => passage.includes(key)) };
}

function makeBlock(lessonId, roundIndex, options, kind) {
  const id = validId(lessonId);
  const round = validRound(roundIndex);
  const theme = validTheme(options?.theme);
  const length = validLength(options?.length);
  const allowed = ALLOWED[id][kind === 'lesson' ? round : 2];
  const targets = kind === 'lesson' ? [...ROUND_KEYS[id][round]] : [...LESSON_TARGET_KEYS[id]];
  const offset = sampleIndex(options?.random ?? Math.random);
  const regularPool = kind === 'lesson'
    ? [...ROUND_EXTRAS[id][round], ...LESSON_CONTENT[id].practiceRounds[round].passages]
    : kind === 'test' ? LESSON_TEST_PASSAGES[id]
    : kind === 'check'
      ? [...CHECK_EXTRAS[id], ...LESSON_CONTENT[id].testVariants]
      : [...ROUND_EXTRAS[id].flat(), ...LESSON_CONTENT[id].practiceRounds.flatMap(item => item.passages)];
  const pool = [...new Set(regularPool.filter(passage => allowedPassage(passage, allowed)))];
  const isHomeWarmup = id === 'find-home' && round === 0 && kind === 'lesson';
  const minimumLength = kind === 'lesson'
    ? (isHomeWarmup ? { quick: 65, standard: 110, extra: 175 } : { quick: 95, standard: 195, extra: 350 })[length]
    : ({ quick: 110, standard: 160, extra: 230 })[length];
  const required = kind === 'lesson' ? { quick: 2, standard: 3, extra: 4 }[length] : 2;
  const scenes = kind === 'lesson' && round === 2 ? (THEMED_SCENES[id] || FLUENT_SCENES)[theme] : [];
  const seenTexts = [...(Array.isArray(options?.seenTexts) ? options.seenTexts : []), options?.previousText];
  const seen = new Set(kind === 'test' ? pool.filter(passage => seenTexts.some(text => typeof text === 'string' && text.includes(passage))) : []);

  for (let retry = 0; retry < 3; retry++) {
    const orderedPool = rotated(pool, offset + retry).sort((a, b) => Number(seen.has(a)) - Number(seen.has(b)));
    const scene = scenes.length ? scenes[(offset + retry) % scenes.length].filter(passage => allowedPassage(passage, allowed)) : [];
    const initial = scene.length ? (length === 'quick' ? scene.slice(0, 2) : scene) : orderedPool.slice(0, 1);
    const coverageTargets = id === 'word-flow' && kind === 'lesson' ? [...targets, ['th', 'er', 'ing'][round]] : targets;
    let passages = fillBlock(initial, orderedPool, coverageTargets, required, minimumLength, seen);
    const adaptive = kind === 'lesson' ? adaptivePassage(orderedPool, options?.keyStats, allowed, passages.join(' ')) : { passage: '', keys: [] };
    if (adaptive.passage) passages = [...passages, adaptive.passage];
    const text = passages.join(' ');
    if (text !== options?.previousText || retry === 2) return { text, passages, targetKeys: targets, adaptiveKeys: adaptive.keys, theme };
  }
}

export function buildLessonBlock(lessonId, roundIndex, options = {}) {
  return makeBlock(lessonId, roundIndex, options, 'lesson');
}

export function buildReviewBlock(lessonId, options = {}) {
  return makeBlock(lessonId, 2, options, 'review');
}

export function buildCheckBlock(lessonId, options = {}) {
  return makeBlock(lessonId, 2, options, 'check');
}

export function buildLessonTestBlock(lessonId, options = {}) {
  return makeBlock(lessonId, 2, options, 'test');
}
