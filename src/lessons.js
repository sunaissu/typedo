export const LESSON_COURSE = [
  {
    id: 'find-home', title: 'F + J', subtitle: 'Index fingers and space', keys: 'F J space',
    focus: 'Your index fingers',
    instruction: 'Feel the small bumps on F and J. Rest your left index on F and your right index on J. Use either thumb for the space bar. Keep your eyes on the text.',
    fingers: ['F · left index', 'J · right index', 'Space · either thumb'],
    practice: 'fff jjj fff jjj fj fj jf jf ff jj fjf jfj ff jj fj jf',
    test: 'fj jf ff jj fjf jfj fff jjj jf fj jj ff jfj fjf fj jf',
  },
  {
    id: 'home-row', title: 'Home row', subtitle: 'A key for every finger', keys: 'A S D F J K L ;',
    focus: 'The home row',
    instruction: 'Place your left pinky, ring, middle and index on A S D F. Place your right index, middle, ring and pinky on J K L ;. Let each finger press its own key, then return to this resting position.',
    fingers: ['Left · A S D F', 'Right · J K L ;', 'Space · either thumb'],
    practice: 'asdf jkl; asdf jkl; aa ss dd ff jj kk ll ;; sad dad lad ask fall flask',
    test: 'a lad asks dad; dad asks a lad; a sad flask falls; a lad adds a flask',
  },
  {
    id: 'center-reach', title: 'G + H', subtitle: 'Index finger reaches', keys: 'G H + home row',
    focus: 'Small index-finger reaches',
    instruction: 'Your left index reaches from F to G. Your right index reaches from J to H. Move only as far as you need, and return to F and J after each reach.',
    fingers: ['F → G · left index', 'J → H · right index', 'Keep other fingers at home'],
    practice: 'fgf jhj fgf jhj gh hg glad glass dash half hall flag shall flash',
    test: 'a glad lad has a glass; a flag shall flash; dad adds half a glass',
  },
  {
    id: 'top-row', title: 'Top row', subtitle: 'Upper alphabet keys', keys: 'Q W E R T Y U I O P',
    focus: 'The top row',
    instruction: 'Reach up from home: left pinky Q, ring W, middle E, index R and T. On the right, use index Y and U, middle I, ring O, pinky P. Return to the home row between reaches.',
    fingers: ['Left · Q / W / E / R T', 'Right · Y U / I / O / P', 'Reach up, return home'],
    practice: 'aqa sws ded frf ftf jyj juj kik lol ;p; quiet type write your tower',
    test: 'we type with quiet purpose; your ideas guide the way; a little effort feels great',
  },
  {
    id: 'bottom-row', title: 'Bottom row', subtitle: 'Complete the alphabet', keys: 'Z X C V B N M',
    focus: 'The bottom row',
    instruction: 'Reach down: left pinky Z, ring X, middle C, index V and B. Your right index handles N and M. Keep your wrists relaxed and return your fingers to home after each reach.',
    fingers: ['Left · Z / X / C / V B', 'Right index · N M', 'Keep your wrists relaxed'],
    practice: 'aza sxs dcd fvf fbf jnj jmj zinc next calm move brave novel box',
    test: 'move with care; brave minds can mix new ideas; a quick brown fox jumps over the lazy dog',
  },
  {
    id: 'capitals', title: 'Capitals + Shift', subtitle: 'Use the opposite hand', keys: 'Shift + A–Z',
    focus: 'Opposite-hand Shift',
    instruction: 'Hold Shift with the pinky on the opposite hand to the letter. For A, hold right Shift; for J, hold left Shift. Release Shift after the capital, and keep both hands close to home.',
    fingers: ['Left-hand letter · right Shift', 'Right-hand letter · left Shift', 'Release Shift after each capital'],
    practice: 'Aa Jj Ff Kk Ss Ll Dd Hh We You Calm Mind Blue Sky Quiet Focus',
    test: 'Find The Key And Return Home Keep Your Hands Relaxed A Small Step Today Builds A Better Habit Tomorrow',
  },
  {
    id: 'numbers', title: 'Number row', subtitle: 'Digits without looking', keys: '1 2 3 4 5 6 7 8 9 0',
    focus: 'The number row',
    instruction: 'Use left pinky for 1, ring for 2, middle for 3, and index for 4 and 5. Use right index for 6 and 7, middle for 8, ring for 9, and pinky for 0. Reach up gently and return home.',
    fingers: ['Left · 1 / 2 / 3 / 4 5', 'Right · 6 7 / 8 / 9 / 0', 'Slow down for a longer reach'],
    practice: 'a1a s2s d3d f4f f5f j6j j7j k8k l9l ;0; 12 34 56 78 90 2026',
    test: 'Type 10 words in 30 seconds Try 5 sets of 24 keys Room 678 opens at 9 Order 12345 is ready',
  },
  {
    id: 'punctuation', title: 'Punctuation', subtitle: 'Write complete sentences', keys: ', . ; : ? ! " \'',
    focus: 'Everyday punctuation',
    instruction: 'Use right middle for comma, right ring for period, and right pinky for semicolon, apostrophe and slash. Add left Shift for : and ?. Use right Shift with left pinky on 1 for !.',
    fingers: [', · right middle', '. · right ring', '; \' / · right pinky', 'Shift · opposite hand'],
    practice: 'k,k l.l ;:; \'"\' /?/ 1!1 yes, no. Let\'s try: "One more!" Ready?',
    test: '"Ready?" she asks. Yes, let\'s begin! Take 3 slow breaths; find F and J. Focus: accuracy first, speed later.',
  },
];

const bounded = (value, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(value, max)) : 0;

export function sanitizeLessonProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const progress = {};
  for (const { id } of LESSON_COURSE) {
    const record = Object.hasOwn(value, id) ? value[id] : null;
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    progress[id] = {
      practiced: record.practiced === true,
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
  if (result?.mode !== 'lesson' || !LESSON_COURSE.some(lesson => lesson.id === result.lessonId) || !['practice', 'test'].includes(result.stage)) return next;
  const previous = next[result.lessonId] || {};
  const date = typeof result.date === 'string' && Number.isFinite(Date.parse(result.date)) ? new Date(result.date).toISOString() : previous.lastPracticed || '';
  next[result.lessonId] = {
    practiced: Boolean(previous.practiced || result.stage === 'practice'),
    passed: Boolean(previous.passed || result.stage === 'test' && result.passed === true),
    bestAccuracy: Math.max(previous.bestAccuracy || 0, bounded(result.accuracy, 100)),
    bestWpm: Math.max(previous.bestWpm || 0, bounded(result.wpm, 10000)),
    attempts: Math.min(1000000, (previous.attempts || 0) + 1),
    lastPracticed: date > (previous.lastPracticed || '') ? date : previous.lastPracticed || date,
  };
  return next;
}

export function lessonTestPassed(session) {
  return session.status === 'finished' && session.attempts > 0 && session.text.length > 0
    && session.correctAttempts / session.attempts >= 0.95
    && [...session.typed].filter((char, index) => char === session.text[index]).length / session.text.length >= 0.95;
}
