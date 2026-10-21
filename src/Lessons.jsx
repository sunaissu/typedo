import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Circle, Clock3, Hand, Keyboard as KeyboardIcon, RotateCcw, Target, Trophy } from 'lucide-react';
import Keyboard from './Keyboard.jsx';
import TypingCoach, { GuidanceChoice, WordProgress } from './TypingCoach.jsx';
import { createSession, enterKey, metrics, tick } from './typing.js';
import { LESSON_COURSE, generateLessonText, lessonTestPassed, sanitizeLessonProgress } from './lessons.js';
import './lessons.css';

const configs = { practice: { mode: 'practice', strict: true }, test: { mode: 'custom' } };
const timeLabel = elapsed => `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`;

export default function Lessons({ lessonProgress = {}, guideEnabled, onGuideChange, onComplete, onBack }) {
  const progress = sanitizeLessonProgress(lessonProgress);
  const [lessonId, setLessonId] = useState(() => LESSON_COURSE.find(lesson => !progress[lesson.id]?.passed)?.id || LESSON_COURSE[0].id);
  const [stage, setStage] = useState('practice');
  const lessonIndex = LESSON_COURSE.findIndex(item => item.id === lessonId);
  const lesson = LESSON_COURSE[lessonIndex];
  const [session, setSession] = useState(() => createSession(generateLessonText(lesson.id, 'practice')));
  const [focused, setFocused] = useState(false);
  const [localGuide, setLocalGuide] = useState(true);
  const showGuide = guideEnabled ?? localGuide;
  const setShowGuide = value => { setLocalGuide(value); onGuideChange?.(value); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); };
  const [inputNote, setInputNote] = useState('');
  const inputRef = useRef(null);
  const courseRef = useRef(null);
  const resetRef = useRef(null);
  const caretRef = useRef(null);
  const viewportRef = useRef(null);
  const recordedRef = useRef(false);
  const sessionRef = useRef(session);
  const runRef = useRef({ lesson, stage });
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const course = courseRef.current;
    const selected = course?.querySelector('[aria-current="step"]');
    if (selected) course.scrollLeft = Math.max(0, selected.offsetLeft - (course.clientWidth - selected.clientWidth) / 2);
  }, [lessonId]);

  function updateSession(next) {
    sessionRef.current = next;
    setSession(next);
    if (next.status !== 'finished' || recordedRef.current) return;
    recordedRef.current = true;
    const run = runRef.current;
    completeRef.current?.({
      id: crypto.randomUUID(), date: new Date().toISOString(), mode: 'lesson',
      lessonId: run.lesson.id, stage: run.stage,
      label: `${run.lesson.title} · ${run.stage === 'practice' ? 'word practice' : 'test'}`,
      category: `lesson:${run.lesson.id}:${run.stage}`, elapsed: next.elapsed,
      ...metrics(next), keyStats: next.keyStats,
      passed: run.stage === 'test' && lessonTestPassed(next),
    });
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (sessionRef.current.status === 'running') updateSession(tick(sessionRef.current, configs[runRef.current.stage], performance.now()));
    }, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (session.status === 'finished') resetRef.current?.focus({ preventScroll: true });
  }, [session.status]);
  useEffect(() => {
    const caret = caretRef.current;
    const viewport = viewportRef.current;
    if (caret && viewport) viewport.scrollTop = Math.max(0, caret.offsetTop - viewport.offsetTop - 55);
  }, [session.typed.length, lessonId, stage]);

  function start(nextLesson = lesson, nextStage = stage, focus = true) {
    runRef.current = { lesson: nextLesson, stage: nextStage };
    recordedRef.current = false;
    const next = createSession(generateLessonText(nextLesson.id, nextStage, Math.random, sessionRef.current.text));
    sessionRef.current = next;
    setSession(next);
    setLessonId(nextLesson.id);
    setStage(nextStage);
    setInputNote('');
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    if (focus) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  function handleShortcuts(event) {
    if (event.isComposing || event.nativeEvent?.isComposing || event.repeat) return;
    if (((event.ctrlKey || event.metaKey) && event.key === 'Enter') || event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); start();
    }
  }

  function handleKey(event) {
    if (event.isComposing || event.nativeEvent?.isComposing) return;
    if (event.key === 'Tab') {
      if (!event.shiftKey) { event.preventDefault(); resetRef.current?.focus(); }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== 'Backspace' && !(event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))) return;
    event.preventDefault();
    if ((event.repeat && event.key !== 'Backspace') || sessionRef.current.status === 'finished') return;
    setInputNote('');
    updateSession(enterKey(sessionRef.current, event.key, configs[runRef.current.stage], performance.now()));
  }

  const done = session.status === 'finished';
  const running = session.status === 'running';
  const stats = metrics(session);
  const passed = stage === 'test' && lessonTestPassed(session);
  const passedCount = LESSON_COURSE.filter(item => progress[item.id]?.passed).length;
  const practicedCount = LESSON_COURSE.filter(item => progress[item.id]?.practiced).length;
  const currentProgress = progress[lesson.id];
  const textCoverage = Math.round(stats.correct / session.text.length * 1000) / 10;
  const resultAccuracy = stats.accuracy === 95 && session.correctAttempts / session.attempts < .95 ? '94.9' : stats.accuracy;
  let characterOffset = 0;

  return <div className="lessons-page" onKeyDown={handleShortcuts}>
    <section className="lesson-intro">
      <div><button className="text-button lesson-back" onClick={onBack}><ArrowLeft size={14} />Back to free typing</button><div className="eyebrow"><span />TOUCH TYPING / QWERTY</div><h1>Lessons<span>.</span></h1><p>Start with a few words. Add new keys as you go.</p></div>
      <div className="course-summary"><div className="course-ring" style={{ '--course-fill': `${passedCount / LESSON_COURSE.length * 360}deg` }}><BookOpen size={21} /></div><div><strong>{passedCount} <span>/ {LESSON_COURSE.length} lessons passed</span></strong><p>{practicedCount} practices completed · go at your own pace</p><div className="course-mini-track" aria-label={`${passedCount} of ${LESSON_COURSE.length} lessons passed`}>{LESSON_COURSE.map(item => <i key={item.id} className={progress[item.id]?.passed ? 'complete' : ''} />)}</div></div></div>
    </section>

    <nav ref={courseRef} className="lesson-course" aria-label="Choose a typing lesson">{LESSON_COURSE.map((item, index) => {
      const record = progress[item.id];
      const selected = item.id === lessonId;
      return <button key={item.id} className={`lesson-course-card ${selected ? 'selected' : ''} ${record?.passed ? 'passed' : ''}`} aria-current={selected ? 'step' : undefined} onClick={() => start(item, 'practice', false)}>
        <span className="lesson-card-top"><span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>{record?.passed ? <CheckCircle2 size={15} /> : selected ? <span className="lesson-current-dot" /> : <Circle size={13} />}</span>
        <strong>{item.title}</strong><span className="lesson-card-keys">{item.keys}</span><span className="lesson-card-status">{record?.passed ? 'Test passed' : record?.practiced ? 'Practice done · try the test' : item.subtitle}</span>
      </button>;
    })}</nav>

    <section className="lesson-workspace" aria-labelledby="lesson-title">
      <div className="lesson-workspace-heading"><div><div className="lesson-overline">LESSON {String(lessonIndex + 1).padStart(2, '0')} <span>/</span> {lesson.focus}</div><h2 id="lesson-title">{lesson.title}</h2></div><p>Real words. No time limit.</p></div>

      <div className="lesson-stage-bar"><div className="lesson-stage-tabs" aria-label="Lesson stage"><button className={stage === 'practice' ? 'selected' : ''} aria-pressed={stage === 'practice'} onClick={() => start(lesson, 'practice')}><Hand size={15} /><span>1. Word practice</span>{currentProgress?.practiced && <Check size={13} />}</button><button className={stage === 'test' ? 'selected' : ''} aria-pressed={stage === 'test'} onClick={() => start(lesson, 'test')}><Target size={15} /><span>2. Lesson test</span>{currentProgress?.passed && <Check size={13} />}</button></div><span className="lesson-stage-explanation">{stage === 'practice' ? 'Real words. Correct each key to continue.' : 'Guide off · mistakes count · Backspace to correct'}</span></div>

      {stage === 'practice' && <GuidanceChoice enabled={showGuide} onChange={setShowGuide} />}
      <div className={`lesson-typing-card ${focused ? 'is-focused' : ''} ${running ? 'running' : ''}`}>
        <div className="lesson-typing-top"><span className="lesson-session-state"><i className={running ? 'running' : ''} />{done ? 'SESSION COMPLETE' : stage === 'practice' ? 'WORD PRACTICE' : 'LESSON TEST'}</span><div className="lesson-live-metrics"><span><strong>{stats.wpm}</strong> wpm</span><span><strong>{stats.accuracy}%</strong> accuracy</span><span><Clock3 size={13} />{timeLabel(session.elapsed)}</span></div></div>
        {done ? <div className="lesson-result" role="status">
          <div className={`lesson-result-icon ${stage === 'test' && !passed ? 'retry' : ''}`}>{stage === 'practice' ? <Hand size={25} /> : passed ? <Trophy size={25} /> : <Target size={25} />}</div>
          <div className="lesson-result-copy"><h3>{stage === 'practice' ? 'Words complete' : passed ? 'Lesson passed' : 'Keep practicing'}</h3><p>{stage === 'practice' ? 'Ready for a new passage? Try the test without hints, or practice more words.' : passed ? 'Your accuracy and final text both reached the goal.' : 'Reach 95% on both accuracy and final text to pass. There is no time limit.'}</p><div className="lesson-result-stats"><span><strong>{resultAccuracy}%</strong> accuracy</span><span><strong>{textCoverage}%</strong> text correct</span><span><strong>{stats.wpm}</strong> wpm</span><span><strong>{stats.errors}</strong> mistakes</span></div></div>
          <div className="lesson-result-actions">{stage === 'practice' ? <button className="primary-button" onClick={() => start(lesson, 'test')}>Take lesson test<ArrowRight size={15} /></button> : passed && lessonIndex < LESSON_COURSE.length - 1 ? <button className="primary-button" onClick={() => start(LESSON_COURSE[lessonIndex + 1], 'practice')}>Next lesson<ArrowRight size={15} /></button> : passed ? <button className="primary-button" onClick={onBack}>Back to free typing<ArrowRight size={15} /></button> : <button className="primary-button" onClick={() => start()}>Try test again<RotateCcw size={15} /></button>}{stage === 'practice' && <button className="text-button" onClick={() => start()}>More words<ArrowRight size={13} /></button>}{stage === 'test' && !passed && <button className="text-button" onClick={() => start(lesson, 'practice')}>Return to word practice</button>}</div>
        </div> : <div className={stage === 'practice' && showGuide ? 'coached-workspace' : ''}><div className={`lesson-type-surface ${!focused && running ? 'unfocused' : ''}`} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
          <div className="words-window lesson-words-window" ref={viewportRef} aria-hidden="true"><div className="words-text">{session.text.split(' ').map((word, wordIndex, words) => {
            const startIndex = characterOffset;
            characterOffset += word.length + 1;
            return <span className="word" key={wordIndex}>{[...word + (wordIndex < words.length - 1 ? ' ' : '')].map((char, charIndex) => {
              const index = startIndex + charIndex;
              const typed = session.typed[index];
              const active = index === session.typed.length;
              return <span key={charIndex} ref={active ? caretRef : undefined} className={`char ${typed !== undefined ? typed === char ? 'correct' : 'incorrect' : ''} ${active ? 'current' : ''} ${active && session.lastWrong ? 'wrong-flash' : ''}`}>{char}</span>;
            })}</span>;
          })}</div></div>
          <textarea ref={inputRef} className="typing-input" aria-label={`${lesson.title} ${stage === 'practice' ? 'word practice' : 'test'} typing input`} aria-describedby="lesson-input-instructions lesson-accessible-prompt" value="" onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPaste={event => { event.preventDefault(); setInputNote('Type each key yourself. Pasting is disabled.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" />
          <p className="sr-only" id="lesson-accessible-prompt">Text to type: {session.text}</p>
          {!focused && running && <div className="focus-prompt"><KeyboardIcon size={17} />Click the text to continue. The timer is still running.</div>}
        </div>{stage === 'practice' && showGuide && <TypingCoach next={session.text[session.typed.length]} />}</div>}
        <WordProgress text={session.text} typed={session.typed} />
        <div className="lesson-typing-bottom"><span id="lesson-input-instructions" role={inputNote ? 'status' : undefined}>{inputNote || (done ? 'Completed runs count toward your daily practice.' : running ? `${session.typed.length} / ${session.text.length} characters${stage === 'practice' && session.lastWrong ? ' · try the highlighted key again' : ''}` : focused ? 'Start typing to begin. Accuracy before speed.' : 'Click the text to begin · use a physical keyboard')}</span><button className="lesson-reset" ref={resetRef} onClick={() => start()} title="Reset this run (Tab then Enter, or Ctrl/⌘+Enter within lessons)"><RotateCcw size={15} />Reset</button></div>
        <div className="lesson-progress-track"><i style={{ width: `${Math.min(100, session.typed.length / session.text.length * 100)}%` }} /></div>
      </div>
      <div className="lesson-run-footer"><span>{!done && <kbd>tab</kbd>}<kbd>enter</kbd> reset <i /><kbd>esc</kbd> reset {!done && <><i /><kbd>backspace</kbd> correct</>}</span>{stage === 'practice' && !showGuide && <button className="text-button" onClick={() => setShowGuide(true)}><KeyboardIcon size={14} />Show finger guide</button>}{stage === 'test' && <span><Target size={13} />95% goal · no time limit</span>}</div>
      {stage === 'practice' && showGuide && !done && <details className="keyboard-reference"><summary>Need the whole keyboard? Open key map</summary><Keyboard next={session.text[session.typed.length]} running={running} finished={done} /></details>}
      <details className="lesson-help"><summary>Finger placement and lesson goal</summary><p>{lesson.instruction}</p><div className="lesson-finger-tips">{lesson.fingers.map(tip => <span key={tip}>{tip}</span>)}</div><p>Pass the test with at least 95% accuracy and 95% of the final text correct. There is no speed requirement.</p>{currentProgress?.attempts > 0 && <p>{currentProgress.attempts} completed runs · {currentProgress.bestAccuracy}% best accuracy</p>}</details>
      <p className="lesson-honest-note"><Hand size={14} />The guide shows which finger to use. A keyboard cannot detect which finger you actually press with.</p>
    </section>
  </div>;
}
