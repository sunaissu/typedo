import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, RotateCcw } from 'lucide-react';
import { createSession, enterKey, metrics, pauseSession, resumeSession, tick } from './typing.js';
import TypingCoach from './TypingCoach.jsx';
import { ConfirmRestart, Dialog } from './SessionControls.jsx';
import { DIAGNOSTIC_TEXT, getDiagnosticRecommendation } from './diagnostic.js';
import './home.css';

const config = { mode: 'custom' };

export default function Diagnostic({ onChooseLesson, onBack, suspended = false, guideEnabled, onGuideChange }) {
  const [begun, setBegun] = useState(false);
  const [session, setSession] = useState(() => createSession(DIAGNOSTIC_TEXT));
  const [localGuide, setLocalGuide] = useState(false);
  const [usedGuide, setUsedGuide] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [note, setNote] = useState('');
  const beginRef = useRef(null);
  const inputRef = useRef(null);
  const nextRef = useRef(null);
  const sessionRef = useRef(session);
  const begunRef = useRef(begun);
  const viewportRef = useRef(null);
  const caretRef = useRef(null);
  const showGuide = guideEnabled ?? localGuide;
  const finished = session.status === 'finished';
  const paused = session.status === 'paused';
  const stats = metrics(session);
  const recommendation = getDiagnosticRecommendation(session, { guided: usedGuide });

  function update(next) { sessionRef.current = next; setSession(next); }
  function focusTyping() { requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }
  function start() {
    begunRef.current = true;
    setBegun(true);
    setRestartOpen(false);
    setUsedGuide(showGuide);
    setNote('');
    update(createSession(DIAGNOSTIC_TEXT));
    focusTyping();
  }
  function pause() {
    if (!begunRef.current || sessionRef.current.status === 'finished') return;
    update(pauseSession(sessionRef.current, config, performance.now()));
  }
  function resume() {
    setRestartOpen(false);
    update(resumeSession(sessionRef.current));
    focusTyping();
  }
  function requestRestart() {
    if (sessionRef.current.attempts && sessionRef.current.status !== 'finished') { pause(); setRestartOpen(true); }
    else start();
  }
  useEffect(() => { beginRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (begun && showGuide) setUsedGuide(true); }, [begun, showGuide]);
  useEffect(() => { if (suspended) pause(); }, [suspended]);
  useEffect(() => {
    const pauseOnBlur = () => { if (sessionRef.current.attempts) pause(); };
    const visibility = () => { if (document.hidden) pauseOnBlur(); };
    const timer = setInterval(() => {
      if (sessionRef.current.status === 'running') update(tick(sessionRef.current, config, performance.now()));
    }, 250);
    window.addEventListener('blur', pauseOnBlur);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); window.removeEventListener('blur', pauseOnBlur); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useLayoutEffect(() => {
    if (finished) { nextRef.current?.focus({ preventScroll: true }); return; }
    const viewport = viewportRef.current;
    const caret = caretRef.current;
    if (!viewport || !caret) return;
    const windowBox = viewport.getBoundingClientRect();
    const caretBox = caret.getBoundingClientRect();
    if (caretBox.bottom > windowBox.bottom - 25) viewport.scrollTop += caretBox.bottom - windowBox.bottom + 40;
    else if (caretBox.top < windowBox.top + 10) viewport.scrollTop -= windowBox.top - caretBox.top + 20;
  }, [session.typed.length, finished]);

  function handleKey(event) {
    if (suspended || event.isComposing || event.nativeEvent?.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) pause(); return; }
    if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) requestRestart(); return; }
    if (event.key !== 'Backspace' && !(event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))) return;
    event.preventDefault();
    if (event.repeat && event.key !== 'Backspace') return;
    setNote('');
    update(enterKey(sessionRef.current, event.key, config, performance.now()));
  }

  return <div className="diagnostic-page" onKeyDown={event => {
    if (event.key === 'Escape' && begun && !finished && !suspended && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent?.isComposing) { event.preventDefault(); if (!event.repeat) pause(); }
  }}>
    <header className="intro"><div><button className="text-button" onClick={onBack}><ArrowLeft size={16} />Back to Home</button><div className="eyebrow"><span />OPTIONAL STARTING CHECK</div><h1>Find a place to begin.</h1><p>A short passage can suggest a useful first lesson. Every lesson stays open, and you can always start with First words.</p></div></header>
    {!begun ? <section className="home-panel diagnostic-intro" aria-labelledby="diagnostic-intro-title"><h2 id="diagnostic-intro-title">A sample, at your own pace</h2><p>Type {DIAGNOSTIC_TEXT.length} characters with letters, capitals, numbers, and punctuation. There is no time limit or speed target. Backspace corrects your text; the original mistake still counts.</p><label className="diagnostic-guide"><input type="checkbox" checked={showGuide} onChange={event => { if (onGuideChange) onGuideChange(event.target.checked); else setLocalGuide(event.target.checked); }} />Show finger hints</label><p className="home-small-note">This check recommends practice only. It does not complete or skip lessons, award test credit, or save a result. If you leave or reload, begin again whenever you like.</p><div className="diagnostic-actions"><button ref={beginRef} className="primary-button" onClick={start}>Begin the check<ArrowRight size={16} /></button><button className="secondary-button" onClick={() => onChooseLesson?.('find-home')}>Start with First words</button></div></section> : finished ? <section className="home-panel diagnostic-results" aria-labelledby="diagnostic-result-title"><p role="status">Starting check complete. Your practice suggestion is ready.</p><h2 id="diagnostic-result-title">Try {recommendation.title}</h2><p>{recommendation.reason}</p><p>{recommendation.limitation}</p><p className="diagnostic-score"><strong>{stats.accuracy}%</strong> accuracy across {session.attempts} keystrokes</p><div className="diagnostic-actions"><button ref={nextRef} className="primary-button" onClick={() => onChooseLesson?.(recommendation.lessonId)}>Open {recommendation.title}<ArrowRight size={16} /></button>{recommendation.lessonId !== 'find-home' && <button className="secondary-button" onClick={() => onChooseLesson?.('find-home')}>Start with First words</button>}<button className="text-button" onClick={start}>Try the check again</button><button className="text-button" onClick={onBack}>Finish for now</button></div><details className="diagnostic-explanation"><summary>How this suggestion works</summary><p>We consider a group only after at least eight character positions across two different keys. Two or more mistakes with accuracy below 90% suggest that group's lesson. We choose the earliest matching lesson. With no such group, we suggest Word flow. These are simple practice rules, not a validated skill assessment.</p><p>Corrections keep the original mistakes in the count. The sample covers some keys more often than others, and a brief check can be affected by unfamiliar text or a distraction. It has no effect on your course progress.</p><ul>{recommendation.groups.map(group => <li key={group.lessonId}><strong>{group.label}</strong>: {group.errors} mistakes in {group.attempts} attempts{group.enough ? '' : ' · too little evidence'}</li>)}</ul></details></section> : <>
      <div className="diagnostic-toolbar"><span role="status">{paused ? 'Paused. Your place is kept for this check.' : session.status === 'running' ? 'Typing' : session.attempts ? 'Ready to resume' : 'Ready. Start typing to begin.'}</span><div><button className="secondary-button" onClick={paused ? resume : pause}>{paused ? 'Resume typing' : <><Pause size={16} />Pause <kbd>Esc</kbd></>}</button><button className="text-button" onClick={requestRestart}><RotateCcw size={16} />Restart</button></div></div>
      <section className={'home-panel diagnostic-workspace ' + (showGuide ? 'diagnostic-coached' : '')} aria-label="Starting check passage">
        <div className={'diagnostic-surface ' + (focused ? 'focused' : '')} onClick={() => !paused && focusTyping()}>
          <div className="diagnostic-passage words-text" ref={viewportRef} aria-hidden="true">{[...session.text].map((character, index) => <span key={index} ref={index === session.typed.length ? caretRef : undefined} className={'char ' + (index === session.typed.length ? 'current ' : '') + (session.typed[index] === undefined ? '' : session.typed[index] === character ? 'correct' : 'incorrect')}>{character}</span>)}</div>
          <textarea ref={inputRef} className="diagnostic-input" aria-label="Starting check typing input" aria-describedby="diagnostic-instructions diagnostic-prompt" value="" readOnly={paused || suspended} onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPaste={event => { event.preventDefault(); setNote('Type the passage one key at a time. Pasting is disabled.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" />
          <p className="sr-only" id="diagnostic-prompt">Text to type: {session.text}</p>
        </div>
        {showGuide && <TypingCoach next={session.text[session.typed.length]} />}
      </section>
      <p id="diagnostic-instructions" className="home-small-note">{session.typed.length} of {session.text.length} characters. Backspace corrects text. Tab moves to controls. Escape pauses. Shift+Enter requests a restart.</p>
      {note && <p role="status" className="home-small-note">{note}</p>}
      {!focused && !paused && <button className="secondary-button" onClick={focusTyping}>Return to typing</button>}
      <p className="home-small-note">This check is kept only while this screen is open. It does not add a test result or complete a lesson.</p>
    </>}
    {!suspended && (restartOpen ? <ConfirmRestart onCancel={resume} onConfirm={start} /> : paused && <Dialog title="Starting check paused" onClose={resume}><p>Your place is kept while this screen stays open. Take your time.</p><p className="panel-note">This optional check is not saved in your progress or backups. The clock stays stopped until your next typed character.</p><div className="pause-actions"><button className="primary-button" data-autofocus onClick={resume}>Resume typing<ArrowRight size={16} /></button><button className="secondary-button" onClick={onBack}>Finish for now</button><button className="text-button" onClick={requestRestart}>Restart check</button></div></Dialog>)}
  </div>;
}
