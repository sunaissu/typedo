export const LESSON_COURSE = [
  {
    id: 'find-home', title: 'First words', subtitle: 'Find home, then type', keys: 'F J + home row',
    focus: 'Find F and J, then follow the fingers',
    instruction: 'Feel the bumps on F and J and rest your index fingers there. Your other fingers rest on A S D and K L ;. Follow the highlighted finger to type your first words. Use either thumb for spaces.',
    fingers: ['F · left index', 'J · right index', 'Space · either thumb'],
    practiceVariants: ['a lad asks dad', 'dad adds a flask', 'a sad lad falls'],
    testVariants: ['a sad lad asks dad as a flask falls', 'dad asks a lad as a lad adds a flask', 'a lad adds a flask as dad asks a lad'],
  },
  {
    id: 'home-row', title: 'Home row', subtitle: 'A key for every finger', keys: 'A S D F J K L ;',
    focus: 'The home row',
    instruction: 'Place your left pinky, ring, middle and index on A S D F. Place your right index, middle, ring and pinky on J K L ;. Let each finger press its own key, then return to this resting position.',
    fingers: ['Left · A S D F', 'Right · J K L ;', 'Space · either thumb'],
    practiceVariants: ['a flask falls as a lad asks dad', 'dad asks a sad lad as a flask falls', 'a lad adds a flask as dad adds a flask'],
    testVariants: ['a sad lad asks dad as a lad adds a flask', 'dad asks a sad lad as a flask falls', 'a lad adds a flask as dad asks a sad lad'],
  },
  {
    id: 'center-reach', title: 'G + H', subtitle: 'Index finger reaches', keys: 'G H + home row',
    focus: 'Small index-finger reaches',
    instruction: 'Your left index reaches from F to G. Your right index reaches from J to H. Move only as far as you need, and return to F and J after each reach.',
    fingers: ['F → G · left index', 'J → H · right index', 'Keep other fingers at home'],
    practiceVariants: ['a glad lad has a flag', 'dad adds half a glass', 'a lad has a salad'],
    testVariants: ['dad has half a glass as a glad lad adds a dash', 'a lad has a salad as dad adds half a glass', 'a glad lad has a flag as dad adds a dash'],
  },
  {
    id: 'top-row', title: 'Top row', subtitle: 'Upper alphabet keys', keys: 'Q W E R T Y U I O P',
    focus: 'The top row',
    instruction: 'Reach up from home: left pinky Q, ring W, middle E, index R and T. On the right, use index Y and U, middle I, ring O, pinky P. Return to the home row between reaches.',
    fingers: ['Left · Q / W / E / R T', 'Right · Y U / I / O / P', 'Reach up, return home'],
    practiceVariants: ['we share a quiet story', 'the yellow kite flies high', 'your tea is ready'],
    testVariants: ['the sky is quiet today as we write a short story', 'we share a little tea as the yellow kite flies high', 'your dog is asleep as we read a story together'],
  },
  {
    id: 'bottom-row', title: 'Bottom row', subtitle: 'Complete the alphabet', keys: 'Z X C V B N M',
    focus: 'The bottom row',
    instruction: 'Reach down: left pinky Z, ring X, middle C, index V and B. Your right index handles N and M. Keep your wrists relaxed and return your fingers to home after each reach.',
    fingers: ['Left · Z / X / C / V B', 'Right index · N M', 'Keep your wrists relaxed'],
    practiceVariants: ['the next bus comes at noon', 'mix the cake in a big bowl', 'my bike has a new bell'],
    testVariants: ['the fox naps by the box as a lazy cat climbs a tree', 'we bring a warm cup of milk and move the blue chair', 'my new bike has a bell and a small basket for lunch'],
  },
  {
    id: 'capitals', title: 'Capitals + Shift', subtitle: 'Use the opposite hand', keys: 'Shift + A–Z',
    focus: 'Opposite-hand Shift',
    instruction: 'Hold Shift with the pinky on the opposite hand to the letter. For A, hold right Shift; for J, hold left Shift. Release Shift after the capital, and keep both hands close to home.',
    fingers: ['Left-hand letter · right Shift', 'Right-hand letter · left Shift', 'Release Shift after each capital'],
    practiceVariants: ['Mia and Ben visit Lake Park', 'June takes the Blue Line home', 'Sam meets Jo on Friday'],
    testVariants: ['On Monday Mia and Ben take the Blue Line to West Park', 'June and Sam meet Jo at Lake Park on Friday', 'Ben sends Mia a note about their trip to New York'],
  },
  {
    id: 'numbers', title: 'Number row', subtitle: 'Digits without looking', keys: '1 2 3 4 5 6 7 8 9 0',
    focus: 'The number row',
    instruction: 'Use left pinky for 1, ring for 2, middle for 3, and index for 4 and 5. Use right index for 6 and 7, middle for 8, ring for 9, and pinky for 0. Reach up gently and return home.',
    fingers: ['Left · 1 / 2 / 3 / 4 5', 'Right · 6 7 / 8 / 9 / 0', 'Slow down for a longer reach'],
    practiceVariants: ['Room 12 is ready for 3 guests', 'Buy 4 apples and 5 pears for 6 people', 'Bus 78 leaves at 9 and returns at 10'],
    testVariants: ['Order 12345 has 6 items and costs 78 dollars plus 90 cents', 'Room 204 has 3 chairs and 5 cups for our 6 guests at 7', 'Take bus 89 to gate 10 and meet 2 friends at room 34567'],
  },
  {
    id: 'punctuation', title: 'Punctuation', subtitle: 'Write complete sentences', keys: ', . ; : ? ! " \'',
    focus: 'Everyday punctuation',
    instruction: 'Use right middle for comma, right ring for period, and right pinky for semicolon, apostrophe and slash. Add left Shift for : and ?. Use right Shift with left pinky on 1 for !.',
    fingers: [', · right middle', '. · right ring', '; \' / · right pinky', 'Shift · opposite hand'],
    practiceVariants: ['"Ready?" she asks. "Let\'s go!"', 'Tea, toast, and jam. That\'s breakfast!', 'A note: "I\'m outside; bring a coat."'],
    testVariants: ['"Ready?" she asks. Yes, let\'s go! Bring a coat; it might rain. Next stop: the park.', 'Mia asks, "What\'s for lunch?" Ben smiles: "Soup!" It\'s hot; take a small sip.', '"Wait!" Jo calls. "Is this yours?" Yes, that\'s my bag; thanks. Inside: a book and lunch.'],
  },
].map(lesson => ({ ...lesson, practice: lesson.practiceVariants[0], test: lesson.testVariants[0] }));

export function generateLessonText(lessonId, stage = 'practice', random = Math.random, previousText = '') {
  const lesson = LESSON_COURSE.find(item => item.id === lessonId) || LESSON_COURSE[0];
  const variants = stage === 'test' ? lesson.testVariants : lesson.practiceVariants;
  const available = variants.filter(text => text !== previousText);
  return available[Math.floor(random() * available.length) % available.length];
}

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
