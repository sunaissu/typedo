import { LESSON_CONTENT } from './lessonContent.js';
import { LESSON_TARGET_KEYS, LESSON_TEST_PASSAGES } from './lessonPractice.js';

export const LESSON_COURSE = [
  {
    id: 'find-home', title: 'First words', subtitle: 'Home, then useful reaches', keys: 'Home row + E R T I O N',
    focus: 'Find home and start reaching',
    instruction: 'Start with one short home row warmup. Then add E, R and T with your left hand, followed by I, O and N with your right. Follow the highlighted finger and return to F and J between reaches.',
    fingers: ['E · left middle', 'R T · left index', 'I · right middle', 'O · right ring', 'N · right index'],
    ...LESSON_CONTENT['find-home'],
  },
  {
    id: 'home-row', title: 'Build a rhythm', subtitle: 'Everyday words from home', keys: 'Home row + E R T I O N',
    focus: 'Return home between words',
    instruction: 'Rest on A S D F and J K L ;. Use the E, R, T, I, O and N reaches from First words as you type about food, the outdoors and everyday tasks. Aim for comfortable, even keystrokes.',
    fingers: ['Left · A S D F', 'Right · J K L ;', 'Space · either thumb'],
    ...LESSON_CONTENT['home-row'],
  },
  {
    id: 'center-reach', title: 'G + H', subtitle: 'Index finger reaches', keys: 'G H + familiar keys',
    focus: 'Small index-finger reaches',
    instruction: 'Your left index reaches from F to G. Your right index reaches from J to H. Move only as far as you need, and return to F and J after each reach.',
    fingers: ['F → G · left index', 'J → H · right index', 'Keep other fingers at home'],
    ...LESSON_CONTENT['center-reach'],
  },
  {
    id: 'top-row', title: 'Top row', subtitle: 'Upper alphabet keys', keys: 'Q W E R T Y U I O P',
    focus: 'The top row',
    instruction: 'Reach up from home: left pinky Q, ring W, middle E, index R and T. On the right, use index Y and U, middle I, ring O, pinky P. Return to the home row between reaches.',
    fingers: ['Left · Q / W / E / R T', 'Right · Y U / I / O / P', 'Reach up, return home'],
    ...LESSON_CONTENT['top-row'],
  },
  {
    id: 'bottom-row', title: 'Bottom row', subtitle: 'Complete the alphabet', keys: 'Z X C V B N M',
    focus: 'The bottom row',
    instruction: 'Reach down: left pinky Z, ring X, middle C, index V and B. Your right index handles N and M. Keep your wrists relaxed and return your fingers to home after each reach.',
    fingers: ['Left · Z / X / C / V B', 'Right index · N M', 'Keep your wrists relaxed'],
    ...LESSON_CONTENT['bottom-row'],
  },
  {
    id: 'capitals', title: 'Capitals + Shift', subtitle: 'Use the opposite hand', keys: 'Shift + A–Z',
    focus: 'Opposite-hand Shift',
    instruction: 'Hold Shift with the pinky on the opposite hand to the letter. For A, hold right Shift; for J, hold left Shift. Release Shift after the capital, and keep both hands close to home.',
    fingers: ['Left-hand letter · right Shift', 'Right-hand letter · left Shift', 'Release Shift after each capital'],
    ...LESSON_CONTENT.capitals,
  },
  {
    id: 'numbers', title: 'Number row', subtitle: 'Digits without looking', keys: '1 2 3 4 5 6 7 8 9 0',
    focus: 'The number row',
    instruction: 'Use left pinky for 1, ring for 2, middle for 3, and index for 4 and 5. Use right index for 6 and 7, middle for 8, ring for 9, and pinky for 0. Reach up gently and return home.',
    fingers: ['Left · 1 / 2 / 3 / 4 5', 'Right · 6 7 / 8 / 9 / 0', 'Slow down for a longer reach'],
    ...LESSON_CONTENT.numbers,
  },
  {
    id: 'punctuation', title: 'Punctuation', subtitle: 'Write complete sentences', keys: ', . ; : ? ! " \'',
    focus: 'Everyday punctuation',
    instruction: 'Use right middle for comma, right ring for period, and right pinky for semicolon, apostrophe and slash. Add left Shift for : and ?. Use right Shift with left pinky on 1 for !.',
    fingers: [', · right middle', '. · right ring', '; \' / · right pinky', 'Shift · opposite hand'],
    ...LESSON_CONTENT.punctuation,
  },
  {
    id: 'word-flow', title: 'Word flow', subtitle: 'Connect familiar words', keys: 'Letters + spaces + punctuation',
    focus: 'Read a few words ahead',
    instruction: 'Practice common word pairs, then connect them into sentences. Keep your spaces steady. Read the next few words as you type, and slow down whenever your hands need time to catch up.',
    fingers: ['Space · either thumb', 'Keep both hands near home', 'Read a few words ahead'],
    ...LESSON_CONTENT['word-flow'],
  },
  {
    id: 'contractions', title: 'Contractions', subtitle: 'Type the way people talk', keys: "' + familiar letters",
    focus: 'Make apostrophes feel ordinary',
    instruction: 'Use your right pinky for the apostrophe in words such as don\'t, I\'ll and we\'ve. Keep the word together as you type, then relax your hand before the next one.',
    fingers: ["' · right pinky", 'Shift · opposite hand', 'Return to home after punctuation'],
    ...LESSON_CONTENT.contractions,
  },
  {
    id: 'messages', title: 'Everyday messages', subtitle: 'Useful words, times and details', keys: 'Letters + numbers + punctuation',
    focus: 'Write a clear message',
    instruction: 'Type short replies, meeting times and everyday updates. Check digits and punctuation as carefully as words. Use left Shift with your right pinky for the colon in a time such as 6:30.',
    fingers: [': · left Shift + right pinky', 'Numbers · reach up, return home', 'Keep spaces between words'],
    ...LESSON_CONTENT.messages,
  },
  {
    id: 'mixed-text', title: 'Everyday writing', subtitle: 'Bring the whole keyboard together', keys: 'All familiar keys',
    focus: 'Stay accurate through changing text',
    instruction: 'Combine letters, capitals, numbers and punctuation in notes and short conversations. Keep a pace you can control. These passages are longer, so let accuracy set your speed.',
    fingers: ['Shift · opposite hand', 'Numbers · return home after each reach', 'Relax between sentences'],
    ...LESSON_CONTENT['mixed-text'],
  },
].map(lesson => {
  const practiceVariants = lesson.practiceRounds.flatMap(round => round.passages);
  return { ...lesson, practiceVariants, practice: practiceVariants[0], test: lesson.testVariants[0] };
});

export function generateLessonText(lessonId, stage = 'practice', random = Math.random, previousText = '', options = {}) {
  const lesson = LESSON_COURSE.find(item => item.id === lessonId) || LESSON_COURSE[0];
  const round = Number.isInteger(options.round) ? lesson.practiceRounds[options.round] : null;
  const variants = stage === 'test' ? lesson.testVariants : round?.passages || lesson.practiceVariants;
  const seen = new Set(Array.isArray(options.seenTexts) ? options.seenTexts : []);
  const unseen = variants.filter(text => text !== previousText && !seen.has(text));
  const other = variants.filter(text => text !== previousText);
  const available = unseen.length ? unseen : other.length ? other : variants;
  const sample = random();
  const index = Number.isFinite(sample) ? Math.min(available.length - 1, Math.max(0, Math.floor(sample * available.length))) : 0;
  return available[index];
}

const bounded = (value, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(value, max)) : 0;
export const LESSON_PRACTICE_ROUNDS = 3;
export const lessonPracticeComplete = record => record?.passed === true || record?.practiceRounds >= LESSON_PRACTICE_ROUNDS;

export function nextPracticeLesson(progress) {
  const records = sanitizeLessonProgress(progress);
  return LESSON_COURSE.find(lesson => !lessonPracticeComplete(records[lesson.id])) || null;
}

function seenPassages(value, allowed) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(text => typeof text === 'string' && allowed.includes(text)))].slice(-50);
}

export function sanitizeLessonProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const progress = {};
  for (const { id, practiceVariants, testVariants } of LESSON_COURSE) {
    const record = Object.hasOwn(value, id) ? value[id] : null;
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    // Older versions recorded completed warmups as a boolean. Keep that credit.
    const practiceRounds = record.practiceRounds === undefined && record.practiced === true
      ? LESSON_PRACTICE_ROUNDS : Math.floor(bounded(record.practiceRounds, LESSON_PRACTICE_ROUNDS));
    progress[id] = {
      practiced: practiceRounds >= LESSON_PRACTICE_ROUNDS,
      practiceRounds,
      seenPractice: seenPassages(record.seenPractice, practiceVariants),
      seenTests: seenPassages(record.seenTests, [...testVariants, ...LESSON_TEST_PASSAGES[id]]),
      passed: record.passed === true,
      bestAccuracy: bounded(record.bestAccuracy, 100),
      bestWpm: bounded(record.bestWpm, 10000),
      attempts: Math.floor(bounded(record.attempts, 1000000)),
      lastPracticed: typeof record.lastPracticed === 'string' && Number.isFinite(Date.parse(record.lastPracticed)) ? new Date(record.lastPracticed).toISOString() : '',
    };
  }
  return progress;
}

export function applyLessonResult(progress, result) {
  const next = sanitizeLessonProgress(progress);
  if (result?.practiceKind && result.practiceKind !== 'lesson') return next;
  if (result?.mode !== 'lesson' || !LESSON_COURSE.some(lesson => lesson.id === result.lessonId) || !['practice', 'test'].includes(result.stage)) return next;
  const previous = next[result.lessonId] || {};
  const lesson = LESSON_COURSE.find(item => item.id === result.lessonId);
  const round = Number.isInteger(result.practiceRound) && result.practiceRound >= 0 && result.practiceRound < LESSON_PRACTICE_ROUNDS
    ? result.practiceRound : Math.min(previous.practiceRounds || 0, LESSON_PRACTICE_ROUNDS - 1);
  const practiceRounds = result.stage === 'practice' ? Math.max(previous.practiceRounds || 0, round + 1) : previous.practiceRounds || 0;
  const date = typeof result.date === 'string' && Number.isFinite(Date.parse(result.date)) ? new Date(result.date).toISOString() : previous.lastPracticed || '';
  next[result.lessonId] = {
    practiced: practiceRounds >= LESSON_PRACTICE_ROUNDS,
    practiceRounds,
    seenPractice: seenPassages([...(previous.seenPractice || []), ...(result.stage === 'practice' ? [result.passage, ...(Array.isArray(result.passages) ? result.passages : [])] : [])], lesson.practiceVariants),
    seenTests: seenPassages([...(previous.seenTests || []), ...(result.stage === 'test' ? [result.passage, ...(Array.isArray(result.passages) ? result.passages : [])] : [])], [...lesson.testVariants, ...LESSON_TEST_PASSAGES[lesson.id]]),
    passed: Boolean(previous.passed || result.stage === 'test' && !result.interrupted && result.passed === true),
    bestAccuracy: Math.max(previous.bestAccuracy || 0, bounded(result.accuracy, 100)),
    bestWpm: Math.max(previous.bestWpm || 0, bounded(result.wpm, 10000)),
    attempts: Math.min(1000000, (previous.attempts || 0) + 1),
    lastPracticed: date > (previous.lastPracticed || '') ? date : previous.lastPracticed || date,
  };
  return next;
}

export function lessonTestPassed(session, lessonId) {
  const targets = Object.hasOwn(LESSON_TARGET_KEYS, lessonId) && LESSON_TARGET_KEYS[lessonId];
  if (!targets || session?.interrupted || session?.status !== 'finished' || typeof session.text !== 'string' || !session.text.length
    || typeof session.typed !== 'string' || !(session.attempts > 0)
    || !(session.correctAttempts / session.attempts >= .95) || session.correctAttempts > session.attempts) return false;
  const correctKeys = [...session.text].filter((key, index) => session.typed[index] === key);
  // Count final text positions, so correcting or retyping one position cannot fill a missing target.
  return correctKeys.length >= 40 && correctKeys.length / session.text.length >= .95
    && targets.every(target => correctKeys.filter(key => key === target).length >= 2);
}
