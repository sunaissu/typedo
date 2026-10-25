import { LESSON_COURSE } from './lessons.js';

export const DIAGNOSTIC_TEXT = 'a small desk stands by a quiet window. fresh green herbs grow in bright light. we pack six blue boxes and zip five canvas bags. Quick, Maya! Bring Jo the red book. Did Sam find the map? On Monday at 09:30, take bus 42 to gate 7. On Friday at 16:25, bring 8 pens, 3 pads, and $12.50. "Can we meet at 10:45?" "Yes, I will be there!"';

export const DIAGNOSTIC_GROUPS = [
  { lessonId: 'find-home', label: 'home-row letters', keys: 'asdfjkl' },
  { lessonId: 'center-reach', label: 'G and H reaches', keys: 'gh' },
  { lessonId: 'top-row', label: 'top-row letters', keys: 'qwertyuiop' },
  { lessonId: 'bottom-row', label: 'bottom-row letters', keys: 'zxcvbnm' },
  { lessonId: 'capitals', label: 'capital letters', keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { lessonId: 'numbers', label: 'numbers', keys: '0123456789' },
  { lessonId: 'punctuation', label: 'punctuation', keys: '.,:;!?"\'$-' },
];

export function getDiagnosticRecommendation(session, { guided = false } = {}) {
  const complete = session?.status === 'finished' && session.text === DIAGNOSTIC_TEXT && typeof session.typed === 'string' && session.typed.length === DIAGNOSTIC_TEXT.length;
  const groups = DIAGNOSTIC_GROUPS.map(group => {
    const positions = [...DIAGNOSTIC_TEXT].filter(key => group.keys.includes(key)).length;
    const seenKeys = [...new Set([...DIAGNOSTIC_TEXT].filter(key => group.keys.includes(key)))];
    let attempts = 0;
    let errors = 0;
    for (const key of group.keys) {
      const stats = session?.keyStats?.[key];
      if (!stats || !Number.isSafeInteger(stats.attempts) || !Number.isSafeInteger(stats.errors) || stats.attempts < 0 || stats.errors < 0 || stats.errors > stats.attempts) continue;
      attempts += stats.attempts;
      errors += stats.errors;
    }
    const enough = complete && positions >= 8 && seenKeys.length >= 2 && attempts >= positions;
    return { ...group, positions, sampledKeys: seenKeys.length, attempts, errors, accuracy: attempts ? (attempts - errors) / attempts * 100 : null, enough };
  });
  const target = groups.find(group => group.enough && group.errors >= 2 && group.accuracy < 90);
  const enoughCoverage = complete && groups.every(group => group.enough);
  const lessonId = !enoughCoverage ? 'find-home' : target?.lessonId || 'word-flow';
  const lesson = LESSON_COURSE.find(item => item.id === lessonId);
  return {
    lessonId, title: lesson.title, complete, guided, groups,
    reason: !enoughCoverage ? 'There is not enough typing here to suggest a later starting point. First words is a gentle place to begin.' : target ? `Try ${target.label} next. This sample recorded ${target.errors} mistakes in ${target.attempts} attempts on those characters.` : 'Your sampled keys were steady enough to try connecting words. Word flow is a useful next exercise.',
    limitation: guided ? 'Finger hints were used during this check. This is a practice suggestion, not evidence of typing independently.' : 'This short sample cannot establish mastery or test every key. Choose a different lesson whenever you like.',
  };
}
