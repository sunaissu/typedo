import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3, BookOpen, CircleHelp, Clock3, Code2, Flame, Hand, Keyboard as KeyboardIcon, Leaf, Moon, RotateCcw, Settings2, ShieldCheck, Sparkles, Sun, Target, Type, Upload, Volume2, VolumeX, X } from 'lucide-react';
import Keyboard from './Keyboard.jsx';
import TypingCoach, { GuidanceChoice, WordProgress } from './TypingCoach.jsx';
import Lessons from './Lessons.jsx';
import TestSetup from './TestSetup.jsx';
import { LESSON_COURSE, applyLessonResult, sanitizeLessonProgress } from './lessons.js';
import { LESSONS, createSession, enterKey, generateText, localDay, mergeKeyStats, metrics, streak, tick, weakKeys } from './typing.js';
import { DEFAULT_SETTINGS, emptyProgress, readProgress, validateProgress, writeProgress } from './storage.js';

function initialData() {
  try { return readProgress(window.localStorage); }
  catch { return { progress: emptyProgress(), warning: 'Browser storage is unavailable. Export your progress before leaving.' }; }
}

function Toggle({ checked, onChange, children }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`toggle-row ${checked ? 'on' : ''}`}><span>{children}</span><i className="switch"><b /></i></button>;
}

function Chart({ data, height = 100 }) {
  const values = data.length ? data : [0];
  const max = Math.max(20, ...values) * 1.15;
  const points = values.map((value, i) => `${12 + i / Math.max(1, values.length - 1) * 576},${height - 12 - value / max * (height - 24)}`).join(' ');
  return <svg viewBox={`0 0 600 ${height}`} className="chart" role="img" aria-label={`Typing speed chart. ${data.length} samples, latest ${data.at(-1) || 0} words per minute.`}>
    {[0.25, 0.5, 0.75].map(y => <line key={y} x1="0" x2="600" y1={height * y} y2={height * y} stroke="currentColor" strokeOpacity=".1" strokeDasharray="3 5" />)}
    {values.length > 1 && <polygon points={`12,${height} ${points} 588,${height}`} fill="var(--accent)" opacity=".06" />}
    <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {values.length === 1 && <circle cx="12" cy={height - 12 - values[0] / max * (height - 24)} r="3" fill="var(--accent)" />}
  </svg>;
}

function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}

const modeLabel = settings => settings.mode === 'time' ? `${settings.duration}s test` : settings.mode === 'words' ? `${settings.wordCount} words` : settings.mode === 'practice' ? `${LESSONS.find(l => l.id === settings.lesson)?.title} practice` : 'Custom text';
const category = settings => `${settings.mode}:${settings.mode === 'time' ? settings.duration : settings.mode === 'words' ? settings.wordCount : settings.mode === 'practice' ? settings.lesson : 'custom'}:${settings.punctuation}:${settings.numbers}:${settings.mode === 'practice' && settings.strict}`;
const formatSeconds = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export default function App() {
  const [initial] = useState(initialData);
  const [progress, setProgress] = useState(initial.progress);
  const [warning, setWarning] = useState(initial.warning);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const settings = progress.settings;
  const [session, setSession] = useState(() => createSession(generateText(settings, progress.keyStats)));
  const [view, setView] = useState('type');
  const [modal, setModal] = useState(null);
  const [focused, setFocused] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [customDraft, setCustomDraft] = useState(settings.customText);
  const [customError, setCustomError] = useState('');
  const inputRef = useRef(null);
  const restartRef = useRef(null);
  const wordsRef = useRef(null);
  const caretRef = useRef(null);
  const uploadRef = useRef(null);
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  const recordedRef = useRef(false);
  const audioRef = useRef(null);
  settingsRef.current = settings;

  const updateSession = next => {
    sessionRef.current = next;
    setSession(next);
    if (next.status === 'finished' && !recordedRef.current) {
      recordedRef.current = true;
      const config = settingsRef.current;
      const result = { id: crypto.randomUUID(), date: new Date().toISOString(), mode: config.mode, label: modeLabel(config), category: category(config), elapsed: next.elapsed, ...metrics(next) };
      setProgress(current => ({ ...current, history: [result, ...current.history].slice(0, 500), keyStats: mergeKeyStats(current.keyStats, next.keyStats) }));
    }
  };

  useEffect(() => {
    let message;
    try { message = writeProgress(window.localStorage, progress); }
    catch { message = 'Browser storage is unavailable. Export your progress before leaving.'; }
    setStorageAvailable(!message);
    if (message) setWarning(message);
  }, [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0a1020' : '#f2f5fb');
  }, [settings.theme]);
  useEffect(() => {
    if (settings.themeRevision !== 2) setProgress(current => ({ ...current, settings: { ...current.settings, theme: 'dark', themeRevision: 2 } }));
  }, [settings.themeRevision]);
  useEffect(() => { if (session.status === 'finished') restartRef.current?.focus({ preventScroll: true }); }, [session.status]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (sessionRef.current.status === 'running') updateSession(tick(sessionRef.current, settingsRef.current, performance.now()));
    }, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const caret = caretRef.current;
    const viewport = wordsRef.current;
    if (caret && viewport) viewport.scrollTop = Math.max(0, caret.offsetTop - viewport.offsetTop - 57);
  }, [session.typed.length]);
  useEffect(() => { if (view === 'type' && !modal) inputRef.current?.focus({ preventScroll: true }); }, [view, modal]);

  function reset({ config = settingsRef.current, repeat = false, focus = true } = {}) {
    recordedRef.current = false;
    const next = createSession(repeat ? sessionRef.current.text : generateText(config, progress.keyStats));
    sessionRef.current = next;
    setSession(next);
    if (wordsRef.current) wordsRef.current.scrollTop = 0;
    if (focus) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }
  function changeSettings(patch, restart = true) {
    const config = { ...settingsRef.current, ...patch };
    settingsRef.current = config;
    setProgress(current => ({ ...current, settings: config }));
    if (restart) reset({ config });
  }
  function navigate(target) {
    if (sessionRef.current.status === 'running') reset({ focus: false });
    setView(target);
    setFocusMode(false);
  }
  function practiceWeak() {
    setView('type');
    changeSettings({ mode: 'practice', lesson: 'weak' });
  }
  function playClick(correct) {
    if (!settingsRef.current.sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      const context = audioRef.current ||= new Audio();
      if (context.state === 'suspended') void context.resume();
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.type = 'sine'; tone.frequency.value = correct ? 680 : 160;
      gain.gain.setValueAtTime(.022, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .035);
      tone.connect(gain); gain.connect(context.destination); tone.start(); tone.stop(context.currentTime + .04);
    } catch { /* Audio is optional when a browser blocks it. */ }
  }
  function handleKey(event) {
    if (event.isComposing || event.nativeEvent.isComposing) return;
    setCapsLock(event.getModifierState?.('CapsLock') || false);
    if (event.key === 'Tab') { if (!event.shiftKey) { event.preventDefault(); restartRef.current?.focus(); } return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Backspace' || (event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))) {
      event.preventDefault();
      if ((event.repeat && event.key !== 'Backspace') || sessionRef.current.status === 'finished') return;
      const expected = sessionRef.current.text[sessionRef.current.typed.length];
      updateSession(enterKey(sessionRef.current, event.key, settingsRef.current, performance.now()));
      if (event.key !== 'Backspace') playClick(event.key === expected);
    }
  }
  useEffect(() => {
    const shortcuts = event => {
      if (modal) return;
      if (view !== 'lessons' && (event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); setView('type'); reset(); }
      if (event.key === 'Escape' && view === 'type') { setFocusMode(false); reset(); }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  });

  function exportProgress() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `typedo-${localDay()}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Progress exported. Keep the file somewhere safe.');
  }
  async function importProgress(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a backup smaller than 2 MB.');
      const imported = validateProgress(JSON.parse(await file.text()));
      setProgress(current => {
        const history = [...new Map([...current.history, ...imported.history].map(run => [run.id, run])).values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 500);
        const keyStats = { ...current.keyStats };
        for (const [key, value] of Object.entries(imported.keyStats)) keyStats[key] = { attempts: Math.max(value.attempts, keyStats[key]?.attempts || 0), errors: Math.max(value.errors, keyStats[key]?.errors || 0) };
        const lessonProgress = { ...(current.lessonProgress || {}) };
        for (const [id, incoming] of Object.entries(imported.lessonProgress || {})) {
          const existing = lessonProgress[id];
          lessonProgress[id] = existing ? {
            practiced: existing.practiced || incoming.practiced,
            passed: existing.passed || incoming.passed,
            bestAccuracy: Math.max(existing.bestAccuracy, incoming.bestAccuracy),
            bestWpm: Math.max(existing.bestWpm, incoming.bestWpm),
            attempts: Math.max(existing.attempts, incoming.attempts),
            lastPracticed: existing.lastPracticed >= incoming.lastPracticed ? existing.lastPracticed : incoming.lastPracticed,
          } : incoming;
        }
        return { ...current, settings: imported.settings, history, keyStats, lessonProgress: sanitizeLessonProgress(lessonProgress) };
      });
      settingsRef.current = imported.settings;
      setCustomDraft(imported.settings.customText);
      reset({ config: imported.settings, focus: false });
      setNotice('Backup restored with your settings. Existing results were kept.');
    } catch (error) { setNotice(error instanceof SyntaxError ? 'That file is not a valid JSON backup.' : error.message); }
  }

  function completeLesson(result) {
    const { keyStats, ...run } = result;
    setProgress(current => {
      if (current.history.some(item => item.id === run.id)) return current;
      return {
        ...current,
        history: [run, ...current.history].slice(0, 500),
        keyStats: mergeKeyStats(current.keyStats, keyStats),
        lessonProgress: applyLessonResult(current.lessonProgress || {}, result),
      };
    });
  }

  const completedLessons = Object.values(progress.lessonProgress || {}).filter(item => item.passed).length;
  const currentMetrics = metrics(session);
  const finished = session.status === 'finished';
  const running = session.status === 'running';
  const todayRuns = progress.history.filter(run => localDay(new Date(run.date)) === localDay());
  const currentStreak = streak(progress.history);
  const testHistory = progress.history.filter(run => run.mode === 'time' || run.mode === 'words');
  const best = testHistory.length ? Math.max(...testHistory.map(run => run.wpm)) : null;
  const averageAccuracy = progress.history.length ? Math.round(progress.history.reduce((sum, run) => sum + run.accuracy, 0) / progress.history.length * 10) / 10 : null;
  const weaknesses = weakKeys(progress.keyStats);
  const remaining = Math.max(0, Math.ceil(settings.duration - session.elapsed / 1000));
  const completion = settings.mode === 'time' ? session.elapsed / (settings.duration * 1000) : session.typed.length / session.text.length;
  const sameTests = progress.history.filter(run => run.category === category(settings));
  const isBest = finished && sameTests.length > 1 && currentMetrics.wpm > Math.max(...sameTests.slice(1).map(run => run.wpm));
  let charOffset = 0;

  return <div className={`app app-shell ${focusMode ? 'focus-mode' : ''}`}>
    <header className="sidebar">
      <button className="brand" onClick={() => navigate('type')} aria-label="Typedo home"><span className="brand-mark">t<span /></span><span>Typedo<span className="brand-period">.</span></span></button>
      <span className="sidebar-label">WORKSPACE</span>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={view === 'type' ? 'active' : ''} aria-current={view === 'type' ? 'page' : undefined} onClick={() => navigate('type')}><KeyboardIcon size={18} />Type</button>
        <button className={view === 'lessons' ? 'active' : ''} aria-current={view === 'lessons' ? 'page' : undefined} onClick={() => navigate('lessons')}><BookOpen size={18} />Lessons<span className="nav-count">{LESSON_COURSE.length}</span></button>
        <button className={view === 'progress' ? 'active' : ''} aria-current={view === 'progress' ? 'page' : undefined} onClick={() => navigate('progress')}><BarChart3 size={18} />Progress</button>
      </nav>
      <button className="sidebar-course" onClick={() => navigate('lessons')}><span><BookOpen size={14} />TOUCH TYPING</span><strong>{completedLessons} / {LESSON_COURSE.length} lessons passed</strong><small>Continue learning<ArrowRight size={12} /></small></button>
      <div className="sidebar-bottom">
        <button aria-label="Settings" onClick={() => setModal('settings')}><Settings2 size={17} />Settings</button>
        <button aria-label={settings.theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => changeSettings({ theme: settings.theme === 'light' ? 'dark' : 'light', themeRevision: 2 }, false)}>{settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
      </div>
      <div className="sidebar-local"><span className="tiny-dot" />Local workspace</div>
    </header>

    <main>
      {warning && <div role="status" className="warning">{warning}<button aria-label="Dismiss storage message" onClick={() => setWarning('')}><X size={16} /></button></div>}
      {view === 'type' ? <>
        <section className="intro"><div><div className="eyebrow"><span />TYPING WORKSPACE</div><h1>{settings.mode === 'practice' ? 'Word practice' : settings.mode === 'custom' ? 'Custom text' : 'Typing test'}</h1><p>Build confidence with real words. Keep the finger guide as long as you need it.</p></div><div className="daily-goal"><div className="goal-ring" style={{ '--fill': `${Math.min(1, todayRuns.length / settings.goal) * 360}deg` }}><Leaf size={19} /></div><div><strong>Daily practice</strong><span>{todayRuns.length} of {settings.goal} sessions today <span className="goal-dots">{Array.from({ length: settings.goal }, (_, i) => <i key={i} className={i < todayRuns.length ? 'done' : ''} />)}</span></span></div></div></section>

        <div className="workspace-controls"><div className="mode-tabs" aria-label="Typing mode">
          <button aria-pressed={['time', 'words'].includes(settings.mode)} className={['time', 'words'].includes(settings.mode) ? 'selected' : ''} onClick={() => changeSettings({ mode: 'time' })}><Clock3 size={16} />Typing test</button>
          <button aria-pressed={settings.mode === 'practice'} className={settings.mode === 'practice' ? 'selected' : ''} onClick={() => changeSettings({ mode: 'practice' })}><Hand size={16} />Word practice</button>
          <button aria-pressed={settings.mode === 'custom'} className={settings.mode === 'custom' ? 'selected' : ''} onClick={() => changeSettings({ mode: 'custom' })}><Type size={17} />Custom text</button>
        </div><button className="text-button shortcuts-link" onClick={() => setModal('help')}><CircleHelp size={15} />Shortcuts</button></div>

        {settings.mode === 'practice' ? <div className="lesson-bar">{LESSONS.map(lesson => <button aria-pressed={settings.lesson === lesson.id} className={settings.lesson === lesson.id ? 'selected' : ''} key={lesson.id} onClick={() => changeSettings({ lesson: lesson.id })}><span>{lesson.badge}</span>{lesson.title}</button>)}</div>
          : settings.mode === 'custom' ? <div className="config-bar custom-bar"><span><Code2 size={15} />Custom passage</span><button className="text-button" onClick={() => { setCustomDraft(settings.customText); setCustomError(''); setModal('custom'); }}>Edit text<ArrowUpRight size={14} /></button></div>
          : <TestSetup settings={settings} onChange={changeSettings} />}

        <GuidanceChoice enabled={settings.guide} onChange={guide => { changeSettings({ guide }, false); inputRef.current?.focus({ preventScroll: true }); }} />
        <section className={`typing-card ${focused ? 'is-focused' : ''} ${finished ? 'finished' : ''}`} aria-label="Typing workspace">
          <div className="typing-topline"><span className="language"><span className={`status-dot ${running ? 'running' : ''}`} />{settings.mode === 'practice' ? LESSONS.find(l => l.id === settings.lesson)?.subtitle : 'english'}<span className="subtle-slash">/</span>{finished ? 'session complete' : settings.mode === 'practice' && settings.strict ? 'accuracy first' : modeLabel(settings)}</span><div className="live-metrics"><span><strong>{running || finished ? currentMetrics.wpm : '—'}</strong> wpm</span><span><strong>{running || finished ? currentMetrics.accuracy : '—'}</strong> %</span><span className="timer"><Clock3 size={14} /><strong>{settings.mode === 'time' ? remaining : formatSeconds(session.elapsed / 1000)}</strong>{settings.mode === 'time' && <small>s</small>}</span></div></div>

          {finished ? <div className="results" role="status"><div className="result-title"><span className="eyebrow">{isBest ? 'NEW PERSONAL BEST' : 'SESSION RESULT'}</span><h2>{isBest ? 'Personal best' : settings.mode === 'practice' ? 'Practice complete' : 'Test complete'}</h2></div><div className="result-content"><div className="result-score"><strong>{currentMetrics.wpm}</strong><span>words per minute</span></div><div className="result-secondary"><div><strong>{currentMetrics.accuracy}%</strong><span>accuracy</span></div><div><strong>{currentMetrics.raw}</strong><span>raw wpm</span></div><div><strong>{currentMetrics.errors}</strong><span>mistakes</span></div></div><div className="result-chart"><Chart data={session.samples.map(sample => sample.wpm)} /><div><span>your pace</span><span>{(session.elapsed / 1000).toFixed(1)} seconds</span></div></div></div><div className="result-actions"><button className="primary-button" onClick={() => reset()}>Go again<ArrowRight size={16} /></button><button className="secondary-button" onClick={() => reset({ repeat: true })}><RotateCcw size={14} />Repeat text</button>{currentMetrics.errors > 0 && <button className="text-button" onClick={practiceWeak}>Practice weak keys<ArrowUpRight size={15} /></button>}</div></div>
          : <div className={settings.guide ? 'coached-workspace' : ''}><div className={`typing-surface ${!focused && running ? 'unfocused' : ''}`} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
            <div className="words-window" ref={wordsRef} aria-hidden="true"><div className="words-text">{session.text.split(' ').map((word, wordIndex, words) => {
              const start = charOffset;
              charOffset += word.length + 1;
              return <span className="word" key={wordIndex}>{[...word + (wordIndex < words.length - 1 ? ' ' : '')].map((char, charIndex) => {
                const index = start + charIndex;
                const typed = session.typed[index];
                const active = index === session.typed.length;
                return <span key={charIndex} ref={active ? caretRef : undefined} className={`char ${typed !== undefined ? typed === char ? 'correct' : 'incorrect' : ''} ${active ? 'current' : ''} ${active && session.lastWrong ? 'wrong-flash' : ''}`}>{char}</span>;
              })}</span>;
            })}</div></div>
            <textarea ref={inputRef} className="typing-input" aria-label="Typing input" aria-describedby="typing-instructions accessible-prompt" value="" onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPaste={event => { event.preventDefault(); setNotice('Type the text yourself. Paste is disabled during a session.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" />
            <p id="accessible-prompt" className="sr-only">Text to type: {session.text}</p>
            {!focused && running && <div className="focus-prompt"><KeyboardIcon size={18} />Click to focus. The timer is still running.</div>}
          </div>{settings.guide && <TypingCoach next={session.text[session.typed.length]} />}</div>}
          {settings.mode === 'practice' && <WordProgress text={session.text} typed={session.typed} />}

          <div className="typing-bottomline"><span id="typing-instructions">{capsLock && !finished ? <span className="caps-warning">Caps Lock is on</span> : finished ? <><ShieldCheck size={14} />{storageAvailable ? 'Progress saved in this browser' : 'Session complete · export to keep it'}</> : running ? settings.mode === 'practice' && settings.strict ? 'Take your time. Correct each key to continue.' : 'Timer running. Backspace to correct a character.' : <><span className="mini-caret" />{focused ? 'Start typing to begin' : 'Click the text to begin'}<span className="desktop-note"> · use a physical keyboard</span></>}</span><div><button className="icon-button" aria-label={settings.sound ? 'Mute key sounds' : 'Enable key sounds'} onClick={() => changeSettings({ sound: !settings.sound }, false)}>{settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button><button className="icon-button focus-button" aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'} onClick={() => setFocusMode(!focusMode)}><Target size={16} /></button><button className="restart-button" ref={restartRef} onClick={() => reset()} title="Restart (Tab, then Enter, or Ctrl+Enter)"><RotateCcw size={16} />Restart</button></div></div>
          <div className="typing-progress"><div style={{ width: `${Math.min(100, completion * 100)}%` }} /></div>
        </section>
        <div className="under-test"><div>{!finished && <><kbd>tab</kbd><span>+</span></>}<kbd>enter</kbd><span>restart</span><i /><kbd>esc</kbd><span>reset</span></div>{!settings.guide ? <button className="text-button" onClick={() => changeSettings({ guide: true }, false)}><KeyboardIcon size={14} />Show finger guide</button> : <span className="gentle-hint"><Leaf size={13} />Focus on accuracy before speed.</span>}</div>

        {settings.guide && !finished && <details className="keyboard-reference"><summary>Need the whole keyboard? Open key map</summary><Keyboard next={session.text[session.typed.length]} running={running} finished={finished} /></details>}
        {settings.mode === 'practice' && <div className="practice-note"><Hand size={16} /><span>{settings.lesson === 'weak' && !weaknesses.length ? 'Your weak keys will appear after a completed session. Start with the home row.' : 'The guide teaches finger placement. Your keyboard cannot report which finger you use.'}</span><button className="text-button" onClick={() => changeSettings({ strict: !settings.strict })}>{settings.strict ? '✓' : '○'} Wait for correct key</button></div>}

        <section className="lesson-entry"><div><BookOpen size={20} /><div><strong>Learn touch typing</strong><p>Eight lessons with finger guidance and a separate test for each.</p></div></div><button onClick={() => navigate('lessons')}>Open lessons<ArrowRight size={15} /></button></section>
        <div className="bottom-stats"><div><span className="stat-icon"><Flame size={18} /></span><div><strong>{currentStreak} day{currentStreak !== 1 ? 's' : ''}</strong><span>current streak</span></div></div><div><span className="stat-icon"><Award size={18} /></span><div><strong>{best === null ? 'No personal best yet' : `${best} wpm`}</strong><span>{best === null ? 'complete a test to set your best' : 'personal best · all tests'}</span></div></div><button onClick={() => navigate('progress')}><span className="stat-icon"><Activity size={18} /></span><div><strong>Session history</strong><span>{progress.history.length} completed session{progress.history.length !== 1 ? 's' : ''}</span></div><ArrowUpRight size={18} /></button></div>
      </> : view === 'lessons' ? <Lessons guideEnabled={settings.guide} onGuideChange={guide => changeSettings({ guide }, false)} lessonProgress={progress.lessonProgress || {}} onComplete={completeLesson} onBack={() => navigate('type')} /> : <>
        <section className="intro progress-intro"><div><button className="text-button back-link" onClick={() => navigate('type')}><ArrowLeft size={15} />Back to typing</button><h1>Your progress</h1><p>Review completed sessions and the keys you miss most.</p></div><div className="backup-buttons"><button className="secondary-button" onClick={exportProgress}><ArrowDownToLine size={15} />Export</button><button className="secondary-button" onClick={() => uploadRef.current.click()}><Upload size={15} />Restore</button><input ref={uploadRef} className="sr-only" type="file" accept=".json,application/json" onChange={importProgress} /></div></section>
        <div className="progress-stats">{[{ icon: Award, value: best === null ? '—' : best, unit: 'wpm', title: 'Best test speed' }, { icon: Target, value: averageAccuracy === null ? '—' : averageAccuracy, unit: '%', title: 'Average accuracy' }, { icon: KeyboardIcon, value: progress.history.length, unit: '', title: 'Sessions completed' }, { icon: Flame, value: currentStreak, unit: 'days', title: 'Current streak' }].map(({ icon: Icon, value, unit, title }) => <div key={title}><Icon size={19} /><strong>{value}<small>{unit}</small></strong><span>{title}</span></div>)}</div>
        <div className="progress-columns"><section className="panel"><div className="section-heading"><h2>Your typing pace</h2><span>last 20 tests</span></div>{testHistory.length ? <><Chart data={testHistory.slice(0, 20).reverse().map(run => run.wpm)} height={160} /><div className="chart-labels"><span>older</span><span>latest</span></div><p className="panel-note">Test speeds include different durations and word counts.</p></> : <div className="empty-chart"><Activity size={28} /><h3>No test results yet</h3><p>Finish a typing test to see your pace here.</p><button className="text-button" onClick={() => { navigate('type'); changeSettings({ mode: 'time' }); }}>Take a test<ArrowRight size={15} /></button></div>}</section><section className="panel weak-panel"><div className="section-heading"><h2>Keys to practice</h2><Sparkles size={17} /></div>{weaknesses.length ? <><p>These keys could use some attention.</p><div className="weak-keys">{weaknesses.map(item => <div key={item.key}><kbd>{item.key}</kbd><span>{Math.round((1 - item.errors / item.attempts) * 100)}%</span></div>)}</div><button className="primary-button" onClick={practiceWeak}>Practice these keys<ArrowRight size={15} /></button></> : <><div className="weak-empty"><Hand size={34} /><p>Finish a session and we’ll find the keys worth practicing.</p></div><button className="secondary-button" onClick={practiceWeak}>Try finger practice<ArrowRight size={15} /></button></>}</section></div>
        <section className="panel history-panel"><div className="section-heading"><h2>Session history</h2><span>{progress.history.length} / 500 saved</span></div>{progress.history.length ? <div className="history-scroll"><table><thead><tr><th>Session</th><th>Speed</th><th>Accuracy</th><th>Mistakes</th><th>When</th></tr></thead><tbody>{progress.history.slice(0, 50).map(run => <tr key={run.id}><td><span className={`mode-dot ${run.mode}`} />{run.label}</td><td><strong>{run.wpm}</strong><span className="table-unit"> wpm</span></td><td>{run.accuracy}%</td><td>{run.errors}</td><td>{new Date(run.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>)}</tbody></table>{progress.history.length > 50 && <p className="panel-note">Showing the latest 50 sessions. Your export includes all saved sessions.</p>}</div> : <div className="empty-history"><KeyboardIcon size={26} /><p>No sessions yet. Start with thirty seconds.</p></div>}</section>
        <div className="storage-note"><ShieldCheck size={17} /><p>Your progress stays in this browser. Export a backup before clearing browser data or switching devices. Restoring merges results and keeps the larger per-key totals.</p></div>
      </>}
    </main>
    <footer><span><span className="footer-mark">k.</span> Typing workspace</span><div><span><span className="tiny-dot" />{storageAvailable ? 'Saved locally' : 'Session only'}</span><button onClick={() => setModal('help')}>Keyboard shortcuts<ArrowUpRight size={13} /></button></div></footer>

    {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {modal === 'settings' && <Modal title="Workspace settings" onClose={() => setModal(null)}><p className="modal-description">Appearance, sound, and practice preferences.</p><Toggle checked={settings.theme === 'dark'} onChange={value => changeSettings({ theme: value ? 'dark' : 'light' }, false)}>Dark theme</Toggle><Toggle checked={settings.guide} onChange={value => changeSettings({ guide: value }, false)}>Show the finger guide</Toggle><Toggle checked={settings.sound} onChange={value => changeSettings({ sound: value }, false)}>Gentle key sounds</Toggle><Toggle checked={settings.strict} onChange={value => changeSettings({ strict: value })}>Wait for the correct key in practice</Toggle><div className="settings-goal"><span>Daily session goal</span><div>{[3, 5, 10].map(goal => <button aria-pressed={settings.goal === goal} className={settings.goal === goal ? 'selected' : ''} key={goal} onClick={() => changeSettings({ goal }, false)}>{goal}</button>)}</div></div><p className="panel-note">Settings and up to 500 completed sessions are saved on this browser. No account needed.</p><button className="primary-button full-width" onClick={() => setModal(null)}>Back to typing<ArrowRight size={16} /></button></Modal>}
    {modal === 'help' && <Modal title="Keyboard shortcuts" onClose={() => setModal(null)}><div className="shortcut-list"><div><span>Restart from the typing area</span><span><kbd>tab</kbd> <kbd>enter</kbd></span></div><div><span>Restart from anywhere</span><span><kbd>ctrl / ⌘</kbd> <kbd>enter</kbd></span></div><div><span>Reset and leave focus mode</span><kbd>esc</kbd></div><div><span>Correct your last character</span><kbd>backspace</kbd></div></div><h3>Finger placement</h3><p>Rest your fingers on A S D F and J K L ;. The bumps on F and J help you find home without looking. Use either thumb for space and the opposite hand for Shift.</p><p>WPM counts correct characters, including spaces, divided by five and by elapsed minutes. Accuracy counts every attempt, including corrected mistakes. The timer starts on your first character and keeps running if you leave the tab.</p><p className="panel-note">Designed for a physical keyboard with a US QWERTY finger guide. Paste, held-key repeats, and composed input are excluded from tests. The guide recommends fingers; it cannot detect which one you use.</p></Modal>}
    {modal === 'custom' && <Modal title="Custom practice text" onClose={() => setModal(null)}><p className="modal-description">Practice a passage, a tricky sentence, or a few lines of code.</p><label className="custom-label" htmlFor="custom-text">Practice text <span>{customDraft.length} / 1,500</span></label><textarea id="custom-text" className="custom-editor" value={customDraft} maxLength={1500} onChange={event => setCustomDraft(event.target.value)} placeholder="Type or paste your practice text here…" /><p className="panel-note">Use English letters, numbers, and standard keyboard punctuation. Line breaks become spaces.</p>{customError && <p role="alert" className="form-error">{customError}</p>}<button className="primary-button full-width" onClick={() => { if (!customDraft.trim()) { setCustomError('Add text to practice first.'); return; } if (/[^\x20-\x7e\n\r\t]/.test(customDraft)) { setCustomError('Use standard keyboard characters. Replace curly quotes, accented letters, or emoji.'); return; } changeSettings({ customText: customDraft }); setModal(null); }}>Use this text<ArrowRight size={16} /></button></Modal>}
  </div>;
}
