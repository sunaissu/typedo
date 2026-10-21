export const WORDS = ('the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us find little still place long world feel hand home great high small between own under last right move help play light sound word line point turn next show every near open once learn need life air change keep mother answer should call school while along might close something seem walk start always those both paper together got group often run important until children side feet car mile night sea white begin grew river four carry state head watch far father tree story left few read really name city eye never best another each set food book water room end friend house morning clear write slow train sky quiet warm happy garden through heart green road better around keep kind follow form before letter rhythm flow focus bright simple space steady practice move build fresh calm soft blue shape mind today tomorrow learn').split(' ');

export const LESSONS = [
  { id: 'home', title: 'Home row', subtitle: 'Build your foundation', keys: 'asdfghjkl;', badge: '01', words: 'asdf jkl; as df jk l; sad lad flask flash glad hall ash fall shall gas dash half glass has ask all' },
  { id: 'top', title: 'Top row', subtitle: 'Reach up, return home', keys: 'qwertyuiop', badge: '02', words: 'qw er ty ui op we were type quiet power write true try pretty upper tree tire wire route query your' },
  { id: 'bottom', title: 'Bottom row', subtitle: 'Make every reach count', keys: 'zxcvbnm', badge: '03', words: 'zx cv bn nm mix zinc calm move verb climb novel buzz vivid next maze come zone brave' },
  { id: 'all', title: 'Full keyboard', subtitle: 'Put it all together', keys: 'abcdefghijklmnopqrstuvwxyz', badge: '04' },
  { id: 'weak', title: 'Weak keys', subtitle: 'A little extra attention', keys: '', badge: '↗' },
];

export const FINGERS = [
  { id: 'lp', label: 'Left pinky', short: 'Pinky', color: '#b96d8b', keys: '`1qaz' },
  { id: 'lr', label: 'Left ring', short: 'Ring', color: '#bb8953', keys: '2wsx' },
  { id: 'lm', label: 'Left middle', short: 'Middle', color: '#a39848', keys: '3edc' },
  { id: 'li', label: 'Left index', short: 'Index', color: '#5f997e', keys: '45rtfgvb' },
  { id: 'ri', label: 'Right index', short: 'Index', color: '#5e9ca9', keys: '67yuhjnm' },
  { id: 'rm', label: 'Right middle', short: 'Middle', color: '#6d84b2', keys: '8ik,' },
  { id: 'rr', label: 'Right ring', short: 'Ring', color: '#9382b0', keys: '9ol.' },
  { id: 'rp', label: 'Right pinky', short: 'Pinky', color: '#b57a74', keys: "0-=p[]\\;'/" },
  { id: 'thumb', label: 'Either thumb', short: 'Thumb', color: '#839282', keys: ' ' },
];
const SHIFTED = { '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/' };
export function keyGuide(char = ' ') {
  const base = SHIFTED[char] || char.toLowerCase();
  const finger = FINGERS.find(f => f.keys.includes(base)) || FINGERS[8];
  const shift = Boolean(SHIFTED[char] || /^[A-Z]$/.test(char));
  return { base, finger, shift: shift ? (finger.id.startsWith('l') ? 'Right Shift' : 'Left Shift') : null };
}

export function weakKeys(stats, limit = 5) {
  return Object.entries(stats)
    .filter(([key, value]) => /^[a-z;,.]$/.test(key) && value.errors > 0)
    .sort((a, b) => (b[1].errors / b[1].attempts) - (a[1].errors / a[1].attempts) || b[1].errors - a[1].errors)
    .slice(0, limit).map(([key, value]) => ({ key, ...value }));
}

export function generateText(config, stats = {}, random = Math.random) {
  const pick = list => list[Math.floor(random() * list.length) % list.length];
  if (config.mode === 'custom') return config.customText.replace(/[^\x20-\x7e\n\r\t]/g, '').trim().replace(/\s+/g, ' ').slice(0, 1500) || 'Small steps make steady progress.';
  let pool = WORDS;
  const count = config.mode === 'words' ? config.wordCount : config.mode === 'practice' ? 25 : 350;
  if (config.mode === 'practice') {
    const lesson = LESSONS.find(l => l.id === config.lesson) || LESSONS[0];
    if (lesson.words) pool = lesson.words.split(' ');
    if (lesson.id === 'weak') {
      const keys = weakKeys(stats).map(item => item.key);
      if (keys.length) {
        pool = WORDS.filter(word => keys.some(key => word.includes(key)));
        pool = [...pool, ...keys.map(key => key.repeat(3))];
      } else pool = LESSONS[0].words.split(' ');
    }
  }
  const words = Array.from({ length: count }, (_, i) => {
    let word = pick(pool);
    if (config.mode !== 'practice' && config.numbers && i % 8 === 6) word = String(Math.floor(random() * 900) + 100);
    if (config.mode !== 'practice' && config.punctuation) {
      if (i % 9 === 0) word = word[0].toUpperCase() + word.slice(1);
      if (i % 9 === 8) word += '.';
      else if (i % 5 === 3) word += ',';
    }
    return word;
  });
  return words.join(' ');
}

export function createSession(text) {
  return { text, typed: '', status: 'ready', startedAt: null, elapsed: 0, attempts: 0, correctAttempts: 0, keyStats: {}, samples: [], lastWrong: null };
}

export function metrics(session, elapsed = session.elapsed) {
  const correct = [...session.typed].filter((char, index) => char === session.text[index]).length;
  return {
    wpm: elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60000)) : 0,
    raw: elapsed > 0 ? Math.round((session.attempts / 5) / (elapsed / 60000)) : 0,
    accuracy: session.attempts ? Math.round(session.correctAttempts / session.attempts * 1000) / 10 : 100,
    correct, errors: session.attempts - session.correctAttempts,
  };
}

export function tick(session, config, now) {
  if (session.status !== 'running') return session;
  const elapsed = Math.max(0, now - session.startedAt);
  const expired = config.mode === 'time' && elapsed >= config.duration * 1000;
  const next = { ...session, elapsed: expired ? config.duration * 1000 : elapsed, status: expired ? 'finished' : 'running' };
  const second = Math.floor(next.elapsed / 1000);
  if (second > 0 && second > (next.samples.at(-1)?.second || 0)) next.samples = [...next.samples, { second, wpm: metrics(next).wpm }];
  return next;
}

export function enterKey(session, key, config, now) {
  let next = tick(session, config, now);
  if (next.status === 'finished') return next;
  if (key === 'Backspace') return { ...next, typed: next.typed.slice(0, -1), lastWrong: null };
  if (key.length !== 1 || !/^[\x20-\x7e]$/.test(key)) return next;
  if (next.startedAt === null) next = { ...next, status: 'running', startedAt: now };
  const expected = next.text[next.typed.length];
  if (expected === undefined) return next;
  const correct = key === expected;
  const statKey = expected.toLowerCase();
  const prev = next.keyStats[statKey] || { attempts: 0, errors: 0 };
  const typed = config.mode === 'practice' && config.strict && !correct ? next.typed : next.typed + key;
  if (config.mode === 'time' && next.text.length - typed.length < 100) next = { ...next, text: next.text + ' ' + generateText(config) };
  return {
    ...next, typed, attempts: next.attempts + 1, correctAttempts: next.correctAttempts + Number(correct),
    keyStats: { ...next.keyStats, [statKey]: { attempts: prev.attempts + 1, errors: prev.errors + Number(!correct) } },
    lastWrong: correct ? null : expected,
    status: config.mode !== 'time' && typed.length >= next.text.length ? 'finished' : 'running',
  };
}

export function mergeKeyStats(first, second) {
  const result = { ...first };
  for (const [key, value] of Object.entries(second)) {
    result[key] = { attempts: (result[key]?.attempts || 0) + value.attempts, errors: (result[key]?.errors || 0) + value.errors };
  }
  return result;
}

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function streak(history) {
  const days = new Set(history.map(run => localDay(new Date(run.date))));
  const day = new Date();
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (days.has(localDay(day))) { count++; day.setDate(day.getDate() - 1); }
  return count;
}
