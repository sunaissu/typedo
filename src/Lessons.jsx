import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Circle, Clock3, Hand, Keyboard as KeyboardIcon, Pause, RotateCcw, Target, Trophy } from 'lucide-react';
import Keyboard from './Keyboard.jsx';
import TypingCoach, { GuidanceChoice, WordProgress } from './TypingCoach.jsx';
import { createSession, enterKey, mergeKeyStats, metrics, pauseSession, resumeSession, tick } from './typing.js';
import PauseDialog, { ConfirmRestart, Dialog } from './SessionControls.jsx';
import { createLessonDraft, restoreLessonSession, sanitizeLessonDrafts } from './lessonDrafts.js';
import { LESSON_COURSE, LESSON_PRACTICE_ROUNDS, applyLessonResult, lessonPracticeComplete, lessonTestPassed, nextPracticeLesson, sanitizeLessonProgress } from './lessons.js';
import { LESSON_THEMES, PRACTICE_LENGTHS, buildLessonBlock, buildLessonTestBlock, buildReviewBlock, buildCheckBlock } from './lessonPractice.js';
import { applyLessonLearningResult, getDueLessonReviews, getLessonImprovement, getLessonLearningStatus, sanitizeLessonLearning } from './lessonLearning.js';
import { getLessonFeedback, getRepeatedErrorFeedback } from './lessonFeedback.js';
import './lessons.css';

const configs = { practice: { mode: 'practice', strict: true }, test: { mode: 'custom' } };
const emptyRecords = {};
const timeLabel = elapsed => `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`;

export default function Lessons({ lessonProgress = emptyRecords, lessonLearning = emptyRecords, lessonDrafts = emptyRecords, initialLessonId, initialPracticeKind = 'lesson', onDraftChange, storageAvailable = true, storageSaving = false, suspended = false, keyStats = emptyRecords, lessonTheme = 'everyday', lessonLength = 'standard', onPreferencesChange, guideEnabled, onGuideChange, onComplete, onBack, onStories, onStop }) {
  const [localProgress, setLocalProgress] = useState({});
  const progress = useMemo(() => sanitizeLessonProgress({ ...lessonProgress, ...localProgress }), [lessonProgress, localProgress]);
  const [localLearning, setLocalLearning] = useState({});
  const learning = useMemo(() => sanitizeLessonLearning({ ...lessonLearning, ...localLearning }), [lessonLearning, localLearning]);
  const learningRef = useRef(learning);
  learningRef.current = learning;
  const [theme, setTheme] = useState(lessonTheme);
  const [length, setLength] = useState(lessonLength);
  const [reviewTime, setReviewTime] = useState(() => new Date());
  const [initial] = useState(() => {
    const drafts = sanitizeLessonDrafts(lessonDrafts, lessonProgress);
    const draft = drafts[initialLessonId] || (!initialLessonId && Object.values(drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]);
    const selected = LESSON_COURSE.find(item => item.id === (draft?.lessonId || initialLessonId)) || nextPracticeLesson(progress);
    return { draft, selected, drafts };
  });
  const draftsRef = useRef(initial.drafts);
  const draftChangeRef = useRef(onDraftChange);
  draftChangeRef.current = onDraftChange;
  const [practiceKind, setPracticeKind] = useState(initial.draft?.practiceKind || (initialPracticeKind === 'review' ? 'review' : 'lesson'));
  const [resultNote, setResultNote] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const initialLesson = initial.selected;
  const [overview, setOverview] = useState(!initialLesson);
  const [lessonId, setLessonId] = useState(initialLesson?.id || LESSON_COURSE.at(-1).id);
  const [stage, setStage] = useState(initial.draft?.stage || 'practice');
  const [roundIndex, setRoundIndex] = useState(() => initial.draft?.roundIndex ?? Math.min(progress[lessonId]?.practiceRounds || 0, LESSON_PRACTICE_ROUNDS - 1));
  const lessonIndex = LESSON_COURSE.findIndex(item => item.id === lessonId);
  const lesson = LESSON_COURSE[lessonIndex];
  const [block, setBlock] = useState(() => initial.draft?.block || (practiceKind === 'review' ? buildReviewBlock(lesson.id, { theme, length: 'quick', keyStats }) : buildLessonBlock(lesson.id, roundIndex, { theme, length, keyStats })));
  const [session, setSession] = useState(() => restoreLessonSession(lesson.id, initial.draft) || { ...createSession(block.text), runId: crypto.randomUUID() });
  const seenRef = useRef({ [`${lessonId}:practice`]: [session.text] });
  const [focused, setFocused] = useState(false);
  const [localGuide, setLocalGuide] = useState(true);
  const [restartAction, setRestartAction] = useState(null);
  const [shortcuts, setShortcuts] = useState(false);
  const showGuide = practiceKind === 'review' ? localGuide : guideEnabled ?? localGuide;
  const setShowGuide = value => {
    setLocalGuide(value);
    if (value) runRef.current.guided = true;
    if (practiceKind === 'lesson') onGuideChange?.(value);
  };
  const [inputNote, setInputNote] = useState('');
  const inputRef = useRef(null);
  const courseRef = useRef(null);
  const resetRef = useRef(null);
  const continueRef = useRef(null);
  const courseContinueRef = useRef(null);
  const caretRef = useRef(null);
  const viewportRef = useRef(null);
  const recordedRef = useRef(false);
  const sessionRef = useRef(session);
  const runRef = useRef({ lesson, stage, roundIndex, practiceKind, guided: initial.draft?.guided ?? (stage === 'practice' && showGuide), block });
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => { if (stage === 'practice' && showGuide) runRef.current.guided = true; }, [stage, showGuide]);

  useEffect(() => {
    const refresh = () => setReviewTime(new Date());
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  function changePreference(key, value) {
    if (key === 'lessonTheme') setTheme(value);
    else setLength(value);
    onPreferencesChange?.({ [key]: value });
  }

  function focusTyping() {
    if (sessionRef.current.status === 'paused' || sessionRef.current.status === 'finished') return;
    const input = inputRef.current;
    input?.focus({ preventScroll: true });
    const card = input?.closest('.lesson-typing-card');
    const bounds = card?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) card.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }

  useEffect(() => {
    const course = courseRef.current;
    const selected = course?.querySelector('[aria-current="step"]');
    if (selected) course.scrollLeft = Math.max(0, selected.offsetLeft - (course.clientWidth - selected.clientWidth) / 2);
  }, [lessonId]);

  function updateSession(next) {
    sessionRef.current = next;
    setSession(next);
    if (next.status !== 'finished') { checkpoint(next); return; }
    if (recordedRef.current) return;
    recordedRef.current = true;
    const run = runRef.current;
    const assessmentPassed = run.stage === 'test' && lessonTestPassed(next, run.lesson.id);
    const result = {
      id: next.runId, date: new Date().toISOString(), mode: 'lesson',
      lessonId: run.lesson.id, stage: run.stage,
      label: `${run.lesson.title} · ${run.practiceKind === 'review' ? 'review' : run.practiceKind === 'check' ? 'later check' : run.stage === 'practice' ? 'word practice' : 'test'}`,
      category: `lesson:${run.lesson.id}:${run.stage}`, elapsed: next.elapsed,
      ...metrics(next), keyStats: next.keyStats,
      passed: assessmentPassed,
      ...(run.stage === 'test' ? { assessmentPassed } : {}),
      practiceRound: run.roundIndex, passage: next.text, passages: run.block.passages,
      practiceKind: run.practiceKind, guided: run.guided, interrupted: Boolean(next.interrupted),
      attempts: next.attempts, correctAttempts: next.correctAttempts, targetKeys: run.block.targetKeys, textLength: next.text.length,
    };
    setResultNote(getLessonImprovement(learningRef.current[run.lesson.id], result) || '');
    learningRef.current = applyLessonLearningResult(learningRef.current, result);
    setLocalLearning(learningRef.current);
    setLastResult(result);
    setReviewTime(new Date());
    if (run.practiceKind === 'lesson') {
      progressRef.current = applyLessonResult(progressRef.current, result);
      setLocalProgress(current => applyLessonResult({ ...lessonProgress, ...current }, result));
    }
    completeRef.current?.(result);
    delete draftsRef.current[run.lesson.id];
    draftChangeRef.current?.(run.lesson.id, null, { flush: true });
  }

  function checkpoint(next = sessionRef.current, flush = false) {
    const run = runRef.current;
    const draft = createLessonDraft(run.lesson.id, run, next);
    if (!draft) return;
    draftsRef.current[run.lesson.id] = draft;
    draftChangeRef.current?.(run.lesson.id, draft, { flush });
  }

  function pause() {
    const current = sessionRef.current;
    if (current.status === 'finished' || current.status === 'paused') return;
    const next = pauseSession(current, configs[runRef.current.stage], performance.now(), { interrupt: runRef.current.stage === 'test' });
    updateSession(next);
    checkpoint(next, true);
  }

  function resume() {
    updateSession(resumeSession(sessionRef.current));
    requestAnimationFrame(focusTyping);
  }

  function finishForNow(action = onStop || onBack) {
    pause();
    checkpoint(sessionRef.current, true);
    action?.();
  }

  function requestRestart() {
    if (sessionRef.current.attempts && sessionRef.current.status !== 'finished') {
      pause();
      setRestartAction(() => () => start(lesson, stage, true, roundIndex, practiceKind, { replaceDraft: true }));
    } else start(lesson, stage, true, roundIndex, practiceKind, { replaceDraft: true });
  }

  useEffect(() => {
    const leave = () => { pause(); checkpoint(sessionRef.current, true); };
    const hidden = () => { if (document.hidden) leave(); };
    window.addEventListener('blur', leave);
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', hidden);
      const next = pauseSession(sessionRef.current, configs[runRef.current.stage], performance.now(), { interrupt: runRef.current.stage === 'test' });
      checkpoint(next, true);
    };
  }, []);

  useEffect(() => { if (suspended) pause(); }, [suspended]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (sessionRef.current.status === 'running') updateSession(tick(sessionRef.current, configs[runRef.current.stage], performance.now()));
    }, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { focusTyping(); }, []);
  useEffect(() => {
    if (session.status === 'finished') continueRef.current?.focus({ preventScroll: true });
  }, [session.status]);
  useEffect(() => {
    if (overview) courseContinueRef.current?.focus({ preventScroll: true });
  }, [overview]);
  useEffect(() => {
    const caret = caretRef.current;
    const viewport = viewportRef.current;
    if (caret && viewport) viewport.scrollTop = Math.max(0, caret.offsetTop - viewport.offsetTop - 55);
  }, [session.typed.length, lessonId, stage]);

  function start(nextLesson = lesson, nextStage = stage, focus = true, requestedRound, kind = practiceKind, overrides = {}) {
    if (!overrides.replaceDraft && nextLesson.id === runRef.current.lesson.id && sessionRef.current.attempts && sessionRef.current.status !== 'finished') {
      pause();
      setRestartAction(() => () => start(nextLesson, nextStage, focus, requestedRound, kind, { ...overrides, replaceDraft: true }));
      return;
    }
    if (nextLesson.id !== runRef.current.lesson.id) {
      const previous = pauseSession(sessionRef.current, configs[runRef.current.stage], performance.now(), { interrupt: runRef.current.stage === 'test' });
      checkpoint(previous, true);
      const saved = draftsRef.current[nextLesson.id];
      const restored = restoreLessonSession(nextLesson.id, saved);
      if (restored) {
        recordedRef.current = false;
        runRef.current = { lesson: nextLesson, stage: saved.stage, roundIndex: saved.roundIndex, practiceKind: saved.practiceKind, guided: saved.guided, block: saved.block };
        sessionRef.current = restored;
        setSession(restored);
        setBlock(saved.block);
        setLessonId(nextLesson.id);
        setStage(saved.stage);
        setRoundIndex(saved.roundIndex);
        setPracticeKind(saved.practiceKind);
        setOverview(false);
        setInputNote('');
        setLastResult(null);
        setResultNote('');
        return;
      }
    }
    if (overrides.replaceDraft) {
      delete draftsRef.current[nextLesson.id];
      draftChangeRef.current?.(nextLesson.id, null, { flush: true });
    }
    const record = progressRef.current[nextLesson.id];
    const nextRound = requestedRound ?? (nextLesson.id === lessonId && nextStage === stage ? roundIndex : Math.min(record?.practiceRounds || 0, LESSON_PRACTICE_ROUNDS - 1));
    recordedRef.current = false;
    const seenKey = `${nextLesson.id}:${nextStage}`;
    const recentKeys = (learningRef.current[nextLesson.id]?.samples || []).slice(-3).reduce((stats, sample) => mergeKeyStats(stats, sample.keyStats || {}), {});
    const options = { theme, length, keyStats: Object.keys(recentKeys).length ? recentKeys : keyStats, previousText: sessionRef.current.text, ...overrides };
    let nextBlock;
    if (kind === 'review') nextBlock = buildReviewBlock(nextLesson.id, { ...options, length: 'quick' });
    else if (kind === 'check') nextBlock = buildCheckBlock(nextLesson.id, options);
    else if (nextStage === 'practice') nextBlock = buildLessonBlock(nextLesson.id, nextRound, options);
    else {
      nextBlock = buildLessonTestBlock(nextLesson.id, {
        ...options,
        seenTexts: [...(record?.seenTests || []), ...(seenRef.current[seenKey] || [])],
      });
    }
    if (kind === 'review') setLocalGuide(true);
    runRef.current = { lesson: nextLesson, stage: nextStage, roundIndex: nextRound, practiceKind: kind, guided: nextStage === 'practice' && (kind === 'review' || (guideEnabled ?? localGuide)), block: nextBlock };
    const next = { ...createSession(nextBlock.text), runId: crypto.randomUUID() };
    seenRef.current[seenKey] = [...(seenRef.current[seenKey] || []), next.text, ...nextBlock.passages].slice(-50);
    sessionRef.current = next;
    setSession(next);
    setBlock(nextBlock);
    setLessonId(nextLesson.id);
    setStage(nextStage);
    setPracticeKind(kind);
    setRoundIndex(nextRound);
    setOverview(false);
    setInputNote('');
    setResultNote('');
    setLastResult(null);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    if (focus) {
      requestAnimationFrame(focusTyping);
    }
  }

  function selectRound(index) {
    const record = progressRef.current[lesson.id];
    const lastAvailable = lessonPracticeComplete(record) ? LESSON_PRACTICE_ROUNDS - 1 : Math.min(record?.practiceRounds || 0, LESSON_PRACTICE_ROUNDS - 1);
    if (stage !== 'practice' || practiceKind !== 'lesson' || !Number.isInteger(index) || index < 0 || index > lastAvailable || index === roundIndex) return;
    start(lesson, 'practice', true, index, 'lesson');
  }

  function continueLearning() {
    if (practiceKind !== 'lesson') {
      const nextLesson = nextPracticeLesson(progressRef.current);
      if (nextLesson) start(nextLesson, 'practice', true, progressRef.current[nextLesson.id]?.practiceRounds || 0, 'lesson');
      else setOverview(true);
      return;
    }
    if (stage === 'practice' && roundIndex < LESSON_PRACTICE_ROUNDS - 1) {
      start(lesson, 'practice', true, roundIndex + 1);
      return;
    }
    if (stage === 'test' && !lessonPracticeComplete(progressRef.current[lesson.id])) {
      start(lesson, 'practice', true, progressRef.current[lesson.id]?.practiceRounds || 0);
      return;
    }
    const later = LESSON_COURSE.slice(lessonIndex + 1).find(item => !lessonPracticeComplete(progressRef.current[item.id]));
    const nextLesson = later || nextPracticeLesson(progressRef.current);
    if (nextLesson && nextLesson.id !== lesson.id) start(nextLesson, 'practice');
    else setOverview(true);
  }

  function handleShortcuts(event) {
    if (overview || suspended || shortcuts || restartAction || event.isComposing || event.nativeEvent?.isComposing || event.target.closest?.('dialog, [role="dialog"]')) return;
    if (event.target.closest?.('select, input')) return;
    if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (sessionRef.current.status !== 'finished') {
        event.preventDefault(); event.stopPropagation();
        if (!event.repeat) pause();
      }
      return;
    }
    if (event.target.closest?.('select, input, button') && ![resetRef.current, continueRef.current].includes(event.target)) return;
    if (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && [inputRef.current, resetRef.current, continueRef.current].includes(event.target)) {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) requestRestart();
      return;
    }
    if (event.repeat) return;
    if (event.key === 'Enter' && sessionRef.current.status === 'finished' && ((event.ctrlKey || event.metaKey) || event.target === continueRef.current)) {
      event.preventDefault(); event.stopPropagation(); continueLearning(); return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation(); requestRestart();
    }
  }

  function handleKey(event) {
    if (event.isComposing || event.nativeEvent?.isComposing) return;
    if (event.key === 'Tab') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== 'Backspace' && !(event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))) return;
    event.preventDefault();
    if ((event.repeat && event.key !== 'Backspace') || ['finished', 'paused'].includes(sessionRef.current.status) || suspended || shortcuts || restartAction) return;
    setInputNote('');
    updateSession(enterKey(sessionRef.current, event.key, configs[runRef.current.stage], performance.now()));
  }

  const done = session.status === 'finished';
  const running = session.status === 'running';
  const paused = session.status === 'paused';
  const stats = metrics(session);
  const passed = stage === 'test' && lessonTestPassed(session, lesson.id);
  const practiceFeedback = done && stage === 'practice' ? getLessonFeedback(session.keyStats) : null;
  const repeatedError = !done && stage === 'practice' ? getRepeatedErrorFeedback(session) : null;
  const passedCount = LESSON_COURSE.filter(item => progress[item.id]?.passed).length;
  const completedCount = LESSON_COURSE.filter(item => lessonPracticeComplete(progress[item.id])).length;
  const currentProgress = progress[lesson.id];
  const completedRounds = lessonPracticeComplete(currentProgress) ? LESSON_PRACTICE_ROUNDS : currentProgress?.practiceRounds || 0;
  const currentRound = lesson.practiceRounds?.[roundIndex];
  const nextRound = lesson.practiceRounds?.[roundIndex + 1];
  const nextLesson = LESSON_COURSE.slice(lessonIndex + 1).find(item => !lessonPracticeComplete(progress[item.id])) || nextPracticeLesson(progress);
  const continueLabel = practiceKind !== 'lesson' ? 'Continue lessons' : stage === 'practice' && roundIndex < LESSON_PRACTICE_ROUNDS - 1 ? 'Next block' : stage === 'test' && !lessonPracticeComplete(currentProgress) ? 'Return to word practice' : nextLesson && nextLesson.id !== lesson.id ? 'Next lesson' : 'Finish course';
  const textCoverage = Math.round(stats.correct / session.text.length * 1000) / 10;
  const resultAccuracy = stats.accuracy === 95 && session.correctAttempts / session.attempts < .95 ? '94.9' : stats.accuracy;
  const dueReviews = useMemo(() => getDueLessonReviews(learning, progress, reviewTime), [learning, progress, reviewTime]);
  const learningStatus = getLessonLearningStatus(learning[lesson.id], reviewTime);
  const rememberedNow = practiceKind === 'check' && lastResult && learning[lesson.id]?.retainedAt === lastResult.date;
  const themeLabel = LESSON_THEMES.find(item => item.id === block.theme)?.label || 'Everyday';
  let passageStart = 0;
  let passageIndex = 0;
  while (passageIndex < block.passages.length - 1 && session.typed.length >= passageStart + block.passages[passageIndex].length + 1) {
    passageStart += block.passages[passageIndex].length + 1;
    passageIndex++;
  }
  const visibleText = block.passages[passageIndex] + (passageIndex < block.passages.length - 1 ? ' ' : '');
  let characterOffset = passageStart;
  const interruptedAssessment = stage === 'test' && session.interrupted;
  const resultHeading = interruptedAssessment ? 'Practice complete after a break' : practiceKind === 'review' ? 'Review complete' : practiceKind === 'check' ? rememberedNow ? 'Remembered on a later day' : passed ? 'Accurate check complete' : 'A little more practice will help' : stage === 'practice' ? `Block ${roundIndex + 1} complete` : passed ? 'Lesson passed' : 'Keep practicing';
  const resultDescription = interruptedAssessment ? 'Your practice is recorded. This interrupted attempt does not count as a failed check or a passed assessment. Start a fresh optional test for a pass; try a later check on another day, at least 20 hours after this rehearsal.' : practiceKind === 'review' ? 'You revisited familiar keys. Come back on another day to try them without hints. Your lesson credit is unchanged.' : practiceKind === 'check' ? rememberedNow ? 'You typed these keys accurately without hints on a later day. Another review will be ready in a few days.' : passed ? 'Good accuracy. Retention needs enough practice with every target key and a check on a later day.' : 'Try a guided review, then check again on another day. Your completed lessons stay completed.' : stage === 'practice' ? practiceFeedback ? 'You finished this block. Try a short review of the keys below, or continue when you are ready.' : nextRound ? `Next: ${nextRound.title}. Keep practising ${nextRound.keys}.` : `You finished this lesson's ${themeLabel.toLowerCase()} scene. Continue learning, try some more words, or finish here for today.` : passed ? 'You reached 95% accuracy and typed every target key correctly at least twice.' : 'Aim for 95% accuracy and final text, with at least two correct uses of every target key. You can keep learning without passing this optional test.';

  return <div className="lessons-page" onKeyDown={handleShortcuts}>
    {paused && !suspended && !shortcuts && !restartAction && <PauseDialog onResume={resume} onFinish={() => finishForNow()} onRestart={requestRestart} interrupted={Boolean(session.interrupted)} storageAvailable={storageAvailable} storageSaving={storageSaving} />}
    {restartAction && !suspended && <ConfirmRestart onCancel={() => { setRestartAction(null); resume(); }} onConfirm={() => { const action = restartAction; setRestartAction(null); action(); }} />}
    {shortcuts && !suspended && <Dialog title="Lesson keyboard shortcuts" onClose={() => setShortcuts(false)}><dl className="shortcut-list"><dt>Tab / Shift+Tab</dt><dd>Move between controls.</dd><dt>Enter / Space</dt><dd>Activate the focused control. Spaces in the exercise type normally.</dd><dt>Escape</dt><dd>Pause and keep your place, or close this dialog.</dd><dt>Shift+Enter</dt><dd>Request a restart from the exercise or its result controls.</dd><dt>Backspace</dt><dd>Correct the preceding character.</dd><dt>Ctrl/Cmd+Enter</dt><dd>Continue a finished block; otherwise request a restart.</dd></dl></Dialog>}
    <section className="lesson-intro">
      <div><button className="text-button lesson-back" onClick={() => finishForNow(onBack)}><ArrowLeft size={14} />Back to free typing</button><div className="eyebrow"><span />TOUCH TYPING / QWERTY</div><h1>Lessons<span>.</span></h1><p>One block at a time. Start typing when ready; Escape keeps your place.</p></div>
      <div className="course-summary"><div className="course-ring" style={{ '--course-fill': `${completedCount / LESSON_COURSE.length * 360}deg` }}><BookOpen size={21} /></div><div><strong>{completedCount} <span>/ {LESSON_COURSE.length} lessons completed</span></strong><p>{passedCount} optional tests passed</p><div className="course-mini-track" aria-label={`${completedCount} of ${LESSON_COURSE.length} lessons completed`}>{LESSON_COURSE.map(item => <i key={item.id} className={lessonPracticeComplete(progress[item.id]) ? 'complete' : ''} />)}</div></div></div>
    </section>

    <details className="lesson-outline"><summary>Course outline · {completedCount} of {LESSON_COURSE.length} lessons complete</summary><nav ref={courseRef} className="lesson-course" aria-label="Choose a typing lesson">{LESSON_COURSE.map((item, index) => {
      const record = progress[item.id];
      const selected = item.id === lessonId;
      return <button key={item.id} className={`lesson-course-card ${selected ? 'selected' : ''} ${lessonPracticeComplete(record) ? 'passed' : ''}`} aria-current={selected ? 'step' : undefined} onClick={() => start(item, 'practice', true, lessonPracticeComplete(record) ? 0 : undefined, 'lesson')}>
        <span className="lesson-card-top"><span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>{lessonPracticeComplete(record) ? <CheckCircle2 size={15} /> : selected ? <span className="lesson-current-dot" /> : <Circle size={13} />}</span>
        <strong>{item.title}</strong><span className="lesson-card-keys">{item.keys}</span><span className="lesson-card-status">{record?.passed ? 'Test passed' : lessonPracticeComplete(record) ? 'Practice complete' : record?.practiceRounds ? `${record.practiceRounds} / ${LESSON_PRACTICE_ROUNDS} blocks` : item.subtitle}</span>
        {learning[item.id] && <span className="lesson-retention-status">{getLessonLearningStatus(learning[item.id], reviewTime).label}</span>}
      </button>;
    })}</nav></details>

    <details className="lesson-preferences-disclosure" onToggle={event => { if (event.currentTarget.open && sessionRef.current.attempts) pause(); }}><summary>Practice preferences</summary><section className="lesson-preferences" aria-label="Lesson preferences">
      <label>Lesson theme<select aria-label="Lesson theme" value={theme} onChange={event => changePreference('lessonTheme', event.target.value)}>{LESSON_THEMES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Practice length<select aria-label="Practice length" value={length} onChange={event => changePreference('lessonLength', event.target.value)}>{PRACTICE_LENGTHS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <p>Changes apply to the next block or retry. There is no countdown. You can stop after any block.</p>
    </section></details>

    {dueReviews.length > 0 && <details className="lesson-review-disclosure"><summary>{dueReviews.length} optional {dueReviews.length === 1 ? 'review is' : 'reviews are'} ready</summary><section className="lesson-review-panel" aria-labelledby="lesson-review-title">
      <div><span className="eyebrow">A LITTLE REVIEW</span><h2 id="lesson-review-title">Start with something familiar</h2><p>{dueReviews.length} {dueReviews.length === 1 ? 'lesson is' : 'lessons are'} ready to revisit. Warm up with hints, or see what you remember without them.</p></div>
      <div className="lesson-review-list">{dueReviews.slice(0, 3).map(review => {
        const item = LESSON_COURSE.find(candidate => candidate.id === review.lessonId);
        return <div className="lesson-review-item" key={item.id}><strong>{item.title}</strong><div><button className="secondary-button" onClick={() => start(item, 'practice', true, 0, 'review')}>Review {item.title}</button><button className="text-button" onClick={() => start(item, 'test', true, 0, 'check')}>Check {item.title} without hints</button></div></div>;
      })}</div>
      <small>Reviews are optional. Completion stays separate from remembering a skill on a later day.</small>
    </section></details>}

    {overview ? <section className="course-complete" role="status"><Trophy size={34} /><h2>Course complete</h2><p>You finished {completedCount} lessons. Keep typing with real stories, or choose any lesson above to revisit it.</p>{onStories && <button className="primary-button" ref={courseContinueRef} onClick={onStories}>Try a story<BookOpen size={15} /></button>}<button className={onStories ? 'text-button' : 'primary-button'} ref={onStories ? undefined : courseContinueRef} onClick={onBack}>Back to free typing<ArrowRight size={15} /></button><small>Later reviews help you see what you remember. Your completed lessons stay completed.</small></section> : <section className="lesson-workspace" aria-labelledby="lesson-title" data-round={roundIndex} data-kind={practiceKind}>
      <div className="lesson-workspace-heading"><div><div className="lesson-overline">LESSON {String(lessonIndex + 1).padStart(2, '0')} <span>/</span> {lesson.focus}</div><h2 id="lesson-title">{lesson.title}</h2></div><p>Real words. No time limit.</p></div>

      <div className="lesson-stage-bar"><div className="lesson-stage-tabs" aria-label="Lesson stage"><button className={stage === 'practice' ? 'selected' : ''} aria-pressed={stage === 'practice'} onClick={() => start(lesson, 'practice', true, undefined, 'lesson')}><Hand size={15} /><span>Word practice</span>{currentProgress?.practiced && <Check size={13} />}</button><button className={stage === 'test' ? 'selected' : ''} aria-pressed={stage === 'test'} onClick={() => start(lesson, 'test', true, undefined, 'lesson')}><Target size={15} /><span>Optional test</span>{currentProgress?.passed && <Check size={13} />}</button></div><span className="lesson-stage-explanation">{practiceKind === 'review' ? 'Familiar keys · no new lesson credit' : practiceKind === 'check' ? 'Later check · no finger hints · 95% accuracy goal' : stage === 'practice' ? 'Three practice blocks. No test required.' : 'Guide off · mistakes count · Backspace to correct'}</span></div>
      {stage === 'practice' && practiceKind === 'lesson' && <div className="lesson-round-plan">
        <nav className="lesson-round-steps" aria-label="Lesson blocks">{lesson.practiceRounds.map((round, index) => {
          const completed = index < completedRounds;
          const locked = index > completedRounds;
          return <button type="button" key={round.title} className={`${index === roundIndex ? 'current' : ''} ${completed ? 'complete' : ''}`} aria-current={index === roundIndex ? 'step' : undefined} aria-label={`Block ${index + 1}: ${round.title}${completed ? ' (completed)' : locked ? ' (not started)' : ''}`} title={locked ? 'Finish the earlier blocks first' : round.title} disabled={locked} onClick={() => selectRound(index)}>{index + 1}{completed && <Check size={10} aria-hidden="true" />}</button>;
        })}</nav>
        <div className="lesson-round-copy"><strong>Block {roundIndex + 1} of {LESSON_PRACTICE_ROUNDS}: {currentRound?.title}</strong><span>{currentRound?.keys}{nextRound ? ` · Up next: ${nextRound.title}` : ` · ${themeLabel} scene`}</span><small>Choose a block to practise it again. Restarting an unfinished block asks first.</small></div>
        <button type="button" className="text-button previous-round" disabled={roundIndex === 0} onClick={() => selectRound(roundIndex - 1)}><ArrowLeft size={14} />Previous block</button>
      </div>}

      {practiceKind !== 'lesson' && <p className="lesson-review-context">{practiceKind === 'review' ? 'A short warmup with keys you have already learned.' : 'Try this without finger hints. A later check can show which skills stayed with you.'} <button className="text-button" onClick={continueLearning}>Back to lessons</button></p>}
      {block.adaptiveKeys.length > 0 && <p className="lesson-adaptive-note">A few extra words for {block.adaptiveKeys.map(key => key === ' ' ? 'Space' : key).join(', ')} based on keys you have missed more than once.</p>}

      {stage === 'practice' && <p className="lesson-round-instruction" id="lesson-round-instruction">{practiceKind === 'review' ? lesson.instruction : currentRound?.instruction || lesson.instruction}</p>}
      {stage === 'practice' && <GuidanceChoice enabled={showGuide} onChange={setShowGuide} />}
      {stage === 'practice' && practiceKind === 'lesson' && roundIndex === 2 && showGuide && !done && <div className="lesson-hint-choice"><span>Ready to try this scene on your own? You can bring the guide back any time.</span><button className="text-button" onClick={() => setShowGuide(false)}>Practice without hints<ArrowRight size={14} /></button></div>}
      <div className={`lesson-typing-card ${focused ? 'is-focused' : ''} ${running ? 'running' : ''}`}>
        <div className="lesson-typing-top"><span className="lesson-session-state"><i className={running ? 'running' : ''} />{done ? 'BLOCK COMPLETE' : paused ? 'PAUSED' : !running ? 'READY' : practiceKind === 'review' ? 'FAMILIAR KEYS' : practiceKind === 'check' ? 'LATER CHECK' : stage === 'practice' ? roundIndex === 2 ? `${themeLabel.toUpperCase()} SCENE` : 'WORD PRACTICE' : 'LESSON TEST'}</span><div className="lesson-live-metrics"><span><strong>{stats.accuracy}%</strong> accuracy</span><span><strong>{stats.wpm}</strong> wpm</span><span><Clock3 size={13} />{timeLabel(session.elapsed)}</span></div></div>
        {!done && <div className="lesson-passage-progress"><span aria-live="polite">Passage {passageIndex + 1} of {block.passages.length}</span><span>Part of this block · keep typing through the spaces</span></div>}
        {done ? <div className="lesson-result" role="status">
          <div className={`lesson-result-icon ${stage === 'test' && !passed ? 'retry' : ''}`}>{stage === 'practice' ? <Hand size={25} /> : passed ? <Trophy size={25} /> : <Target size={25} />}</div>
          <div className="lesson-result-copy"><h3>{resultHeading}</h3><p>{resultDescription}</p>{practiceFeedback && <div className="lesson-practice-feedback" aria-label="Practice suggestion">
              <strong>{practiceFeedback.title}</strong><p>{practiceFeedback.summary}</p>
              {practiceFeedback.keys.map(item => <p key={item.key}>{item.instruction}</p>)}
              <button className="secondary-button" onClick={() => start(lesson, 'practice', true, roundIndex, practiceKind, { length: 'quick', keyStats: session.keyStats })}>{practiceKind === 'review' ? 'Review these keys' : 'Review this block'}<RotateCcw size={14} /></button>
            </div>}{resultNote && <p className="lesson-improvement">{resultNote}</p>}<div className="lesson-result-stats"><span><strong>{resultAccuracy}%</strong> accuracy</span><span><strong>{textCoverage}%</strong> text correct</span><span><strong>{stats.wpm}</strong> wpm</span><span><strong>{stats.errors}</strong> mistakes</span></div>{learning[lesson.id] && <p className="lesson-learning-note">{learningStatus.label}{learning[lesson.id].nextReviewAt && ` · Next review ${new Date(learning[lesson.id].nextReviewAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</p>}</div>
          <div className="lesson-result-actions"><button className="primary-button" ref={continueRef} onClick={continueLearning}>{continueLabel}<ArrowRight size={15} /></button>{practiceKind === 'lesson' ? stage === 'practice' ? <><button className="text-button" onClick={() => start(lesson, 'practice', true, roundIndex, 'lesson', { length: 'extra' })}>A little more practice</button><button className="text-button" onClick={() => start(lesson, 'test', true, undefined, 'lesson')}>Take optional test</button></> : passed ? <button className="text-button" onClick={() => start(lesson, 'practice', true, undefined, 'lesson')}>Return to word practice</button> : <button className="text-button" onClick={() => start(lesson, 'test', true, undefined, 'lesson')}>Retry test</button> : practiceKind === 'check' && !passed && !interruptedAssessment && <button className="text-button" onClick={() => start(lesson, 'practice', true, 0, 'review')}>Try a guided review</button>}<button className="text-button" onClick={() => finishForNow()}>Finish for now</button></div>
        </div> : <div className={stage === 'practice' && showGuide ? 'coached-workspace' : ''}><div className={`lesson-type-surface ${!focused && running ? 'unfocused' : ''}`} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
          <div className="words-window lesson-words-window" ref={viewportRef} aria-hidden="true"><div className="words-text">{visibleText.split(' ').map((word, wordIndex, words) => {
            const startIndex = characterOffset;
            characterOffset += word.length + 1;
            return <span className="word" key={wordIndex}>{[...word + (wordIndex < words.length - 1 ? ' ' : '')].map((char, charIndex) => {
              const index = startIndex + charIndex;
              const typed = session.typed[index];
              const active = index === session.typed.length;
              return <span key={charIndex} ref={active ? caretRef : undefined} className={`char ${typed !== undefined ? typed === char ? 'correct' : 'incorrect' : ''} ${active ? 'current' : ''} ${active && session.lastWrong ? 'wrong-flash' : ''}`}>{char}</span>;
            })}</span>;
          })}</div></div>
          <textarea ref={inputRef} className="typing-input" aria-label={`${lesson.title} ${stage === 'practice' ? 'word practice' : 'test'} typing input`} aria-describedby={`lesson-input-instructions lesson-accessible-prompt${stage === 'practice' ? ' lesson-round-instruction lesson-key-feedback' : ''}`} value="" onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); if (runRef.current.stage === 'test' && sessionRef.current.attempts && sessionRef.current.status !== 'finished') pause(); }} onPaste={event => { event.preventDefault(); setInputNote('Type each key yourself. Pasting is disabled.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" />
          <p className="sr-only" id="lesson-accessible-prompt">Text to type: {session.text}</p>
          {!focused && !paused && <div className="focus-prompt"><KeyboardIcon size={17} />Tab to Resume typing to return to this passage.</div>}
        </div>{stage === 'practice' && showGuide && <TypingCoach next={session.text[session.typed.length]} />}</div>}
        {stage === 'practice' && !done && <p className="lesson-key-feedback" id="lesson-key-feedback" role="status" aria-live="polite" aria-atomic="true">{repeatedError?.message || ''}</p>}
        <WordProgress text={session.text} typed={session.typed} />
        <div className="lesson-typing-bottom"><span id="lesson-input-instructions" role={inputNote ? 'status' : undefined}>{inputNote || (done ? 'Completed runs count toward your daily practice.' : paused ? 'Paused. Your place is kept.' : running ? `${session.typed.length} / ${session.text.length} characters${stage === 'practice' && session.lastWrong ? ' · try the highlighted key again' : ''}` : focused ? 'Start typing to begin. Accuracy before speed.' : 'Use Resume typing to return to the passage. A physical keyboard is needed.')}</span><div className="session-actions">{!done && <><button className="secondary-button" onClick={pause} aria-keyshortcuts="Escape"><Pause size={15} />Pause <kbd>Esc</kbd></button>{!focused && <button className="secondary-button" onClick={paused ? resume : focusTyping}>Resume typing</button>}</>}<button className="lesson-reset" ref={resetRef} onClick={requestRestart} aria-keyshortcuts="Shift+Enter" title="Retry this block (Shift+Enter)"><RotateCcw size={15} />Restart</button><button className="text-button" onClick={() => { pause(); setShortcuts(true); }}>Shortcuts</button></div></div>
        <div className="lesson-progress-track"><i style={{ width: `${Math.min(100, session.typed.length / session.text.length * 100)}%` }} /></div>
      </div>
      <div className="lesson-run-footer"><span>{done && <><kbd>enter</kbd> continue<i /></>}<kbd>shift</kbd> + <kbd>enter</kbd> retry this block {!done && <><i /><kbd>backspace</kbd> correct</>}</span>{stage === 'practice' && !showGuide && <button className="text-button" onClick={() => setShowGuide(true)}><KeyboardIcon size={14} />Show finger guide</button>}{stage === 'test' && <span><Target size={13} />Optional · 95% goal · no time limit</span>}</div>
      {stage === 'practice' && showGuide && !done && <details className="keyboard-reference"><summary>Need the whole keyboard? Open key map</summary><Keyboard next={session.text[session.typed.length]} running={running} finished={done} /></details>}
      <details className="lesson-help"><summary>{stage === 'test' && !done ? 'About this check' : 'Finger placement and lesson goal'}</summary>{(stage !== 'test' || done) && <><p>{stage === 'practice' && practiceKind === 'lesson' ? currentRound?.instruction || lesson.instruction : lesson.instruction}</p><div className="lesson-finger-tips">{(stage === 'practice' && practiceKind === 'lesson' ? currentRound?.fingers || lesson.fingers : lesson.fingers).map(tip => <span key={tip}>{tip}</span>)}</div></>}<p>Practice moves forward after three blocks, with several passages in each. An optional test covers every target key and needs at least 40 correct characters, 95% accuracy and final text, and two correct uses of each target key. A later check uses no finger hints and needs at least 95% accuracy, enough attempts at each target key, and a gap of at least 20 hours on a different day. Completing a lesson stays separate from passing a later check. There is no speed requirement.</p>{currentProgress?.attempts > 0 && <p>{currentProgress.attempts} completed runs · {currentProgress.bestAccuracy}% best accuracy</p>}</details>
      <p className="lesson-honest-note"><Hand size={14} />The guide shows which finger to use. A keyboard cannot detect which finger you actually press with.</p>
    </section>}
  </div>;
}
