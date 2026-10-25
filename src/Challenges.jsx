import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Copy, Pause, RotateCcw, Share2 } from 'lucide-react';
import { createSession, enterKey, metrics, pauseSession, resumeSession, tick } from './typing.js';
import { ConfirmRestart, Dialog } from './SessionControls.jsx';
import { normalizePassage } from './practiceLibrary.js';
import { BUILTIN_CHALLENGES, challengeCategory, getChallengeComparison, makeChallengeLink, validateChallenge } from './challenges.js';
import './home.css';

const config = { mode: 'custom' };

export default function Challenges({ history = [], onComplete, onBack, suspended = false, initialChallenge = null }) {
  const shared = validateChallenge(initialChallenge);
  const [selection, setSelection] = useState(null);
  const [inPractice, setInPractice] = useState(false);
  const [session, setSession] = useState(() => createSession(''));
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState(null);
  const headingRef = useRef(null);
  const inputRef = useRef(null);
  const linkRef = useRef(null);
  const nextRef = useRef(null);
  const viewportRef = useRef(null);
  const caretRef = useRef(null);
  const sessionRef = useRef(session);
  const runRef = useRef(null);
  const recordedRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const preview = normalizePassage(rawText);
  const custom = validateChallenge({ title, text: preview.text });
  const done = session.status === 'finished';
  const paused = session.status === 'paused';
  const stats = metrics(session);
  const comparison = selection ? getChallengeComparison(history.filter(run => run.id !== runRef.current?.id), selection) : null;

  function update(next) {
    sessionRef.current = next;
    setSession(next);
    if (next.status === 'finished' && runRef.current && !recordedRef.current) {
      recordedRef.current = true;
      const run = runRef.current;
      completeRef.current?.({ id: run.id, date: new Date().toISOString(), mode: 'custom', category: challengeCategory(run.challenge.text), label: `Challenge: ${run.challenge.title}`.slice(0, 100), ...metrics(next), elapsed: next.elapsed, keyStats: next.keyStats, interrupted: Boolean(next.interrupted) });
    }
  }
  const focusTyping = () => requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  function start(challenge) {
    const valid = validateChallenge(challenge);
    if (!valid) return;
    setSelection(valid);
    setInPractice(true);
    setRestartOpen(false);
    setPendingChallenge(null);
    setMessage('');
    runRef.current = { id: crypto.randomUUID(), challenge: valid };
    recordedRef.current = false;
    update(createSession(valid.text));
    focusTyping();
  }
  function pause() {
    if (!runRef.current || sessionRef.current.status === 'finished') return;
    update(pauseSession(sessionRef.current, config, performance.now(), { interrupt: true }));
  }
  function requestStart(challenge) {
    if (runRef.current && sessionRef.current.attempts && sessionRef.current.status !== 'finished') setPendingChallenge(challenge);
    else start(challenge);
  }
  function resume() { setRestartOpen(false); setPendingChallenge(null); setInPractice(true); update(resumeSession(sessionRef.current)); focusTyping(); }
  function requestRestart() {
    if (sessionRef.current.attempts && sessionRef.current.status !== 'finished') { pause(); setRestartOpen(true); }
    else if (runRef.current) start(runRef.current.challenge);
  }
  function browse() { pause(); setInPractice(false); setRestartOpen(false); requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true })); }
  function share(challenge) {
    try { setLink(makeChallengeLink(challenge, window.location.href)); setMessage('Link ready. It includes the passage text. Copy it only if you want others to read that text.'); }
    catch (error) { setMessage(error.message); }
  }
  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
      setMessage('Challenge link copied.');
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setMessage('Automatic copying is unavailable. The link is selected; use Ctrl+C or Command+C to copy it.');
    }
  }
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (suspended) pause(); }, [suspended]);
  useEffect(() => {
    const pauseOnBlur = () => { if (sessionRef.current.attempts) pause(); };
    const onVisibility = () => { if (document.hidden) pauseOnBlur(); };
    const timer = setInterval(() => { if (sessionRef.current.status === 'running') update(tick(sessionRef.current, config, performance.now())); }, 250);
    window.addEventListener('blur', pauseOnBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); window.removeEventListener('blur', pauseOnBlur); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  useLayoutEffect(() => {
    if (done && inPractice) { nextRef.current?.focus({ preventScroll: true }); return; }
    const viewport = viewportRef.current, caret = caretRef.current;
    if (!viewport || !caret) return;
    const box = viewport.getBoundingClientRect(), current = caret.getBoundingClientRect();
    if (current.bottom > box.bottom - 25) viewport.scrollTop += current.bottom - box.bottom + 40;
    else if (current.top < box.top + 10) viewport.scrollTop -= box.top - current.top + 20;
  }, [session.typed.length, done, inPractice]);
  function handleKey(event) {
    if (suspended || event.isComposing || event.nativeEvent?.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) pause(); return; }
    if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) requestRestart(); return; }
    if (event.key !== 'Backspace' && !(event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))) return;
    event.preventDefault();
    if (event.repeat && event.key !== 'Backspace') return;
    update(enterKey(sessionRef.current, event.key, config, performance.now()));
  }
  return <div className="diagnostic-page challenge-page" onKeyDown={event => { if (event.key === 'Escape' && inPractice && !done && !suspended && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent?.isComposing) { event.preventDefault(); if (!event.repeat) pause(); } }}>
    <style>{`.challenge-page .challenge-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:22px 0}.challenge-page .challenge-card h2{font-size:21px;margin-bottom:12px}.challenge-page .challenge-card p{font-size:15px;line-height:1.8}.challenge-page .challenge-share{margin:20px 0}.challenge-page .challenge-share label{display:grid;gap:10px;font-size:14px}.challenge-page .challenge-share input{width:100%;min-height:44px;padding:10px;background:var(--key-bg);border:1px solid var(--border);border-radius:7px;color:var(--text)}.challenge-page .challenge-score{display:flex;flex-wrap:wrap;gap:24px;margin:22px 0}.challenge-page .challenge-score strong{display:block;font-size:28px;color:var(--accent)}.challenge-page .challenge-score span{font-size:14px;color:var(--muted)}@media(max-width:700px){.challenge-page .challenge-grid{grid-template-columns:1fr}}`}</style>
    <header className="intro"><div><button className="text-button" onClick={inPractice ? browse : onBack}><ArrowLeft size={16} />{inPractice ? 'Back to challenges' : 'Back to Home'}</button><div className="eyebrow"><span> </span>YOUR OWN NEXT BEST</div><h1 ref={headingRef} tabIndex={-1}>{inPractice ? selection.title : 'A passage. Your personal challenge.'}</h1><p>Compare your own attempts on the exact same text. Accuracy comes first. There is no public ranking or time limit.</p></div></header>
    {!inPractice ? <>
      {selection && session.attempts > 0 && !done && <section className="home-panel challenge-card"><h2>Continue {selection.title}</h2><p>{session.typed.length} of {session.text.length} characters. This interrupted attempt continues as practice.</p><div className="diagnostic-actions"><button className="primary-button" onClick={resume}>Continue unfinished challenge<ArrowRight size={16} /></button></div></section>}
      {shared && <section className="home-panel challenge-card"><h2>Shared passage: {shared.title}</h2><p>{shared.text}</p><p className="home-small-note">This link contains the passage only. It does not include another person's score or identity.</p><div className="diagnostic-actions"><button className="primary-button" onClick={() => requestStart(shared)}>Start shared challenge<ArrowRight size={16} /></button></div></section>}
      <div className="challenge-grid">{BUILTIN_CHALLENGES.map(challenge => { const previous = getChallengeComparison(history, challenge); return <section className="home-panel challenge-card" key={challenge.title}><h2>{challenge.title}</h2><p>{challenge.text}</p><p className="home-small-note">{challenge.text.length} characters. {previous.count ? `Your best: ${previous.bestWpm} words per minute, best accuracy ${previous.bestAccuracy}%. ${previous.count} matching attempts.` : 'Your first attempt sets a starting point.'}</p><div className="diagnostic-actions"><button className="primary-button" onClick={() => requestStart(challenge)}>Start challenge<ArrowRight size={16} /></button><button className="text-button" onClick={() => share(challenge)}><Share2 size={16} />Create link</button></div></section>; })}</div>
      <section className="home-panel practice-editor practice-library"><div className="home-panel-heading"><h2>Create a challenge</h2></div><form onSubmit={event => { event.preventDefault(); if (custom) requestStart(custom); }}><label>Challenge name<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} required /></label><label>Passage<textarea value={rawText} onChange={event => setRawText(event.target.value)} rows={4} required /></label><p className="home-small-note">Up to 1,500 printable characters. Pasted punctuation, accents, and spacing are simplified. Review the exact text before starting or sharing.</p>{rawText && <div className="practice-normalized-preview"><strong>Exact challenge text · {preview.text.length} characters</strong><p tabIndex={0}>{preview.text || 'Add supported text to continue.'}</p>{preview.truncated && <span>Only the first 1,500 characters are included.</span>}{preview.unsupported > 0 && <span>{preview.unsupported} unsupported characters removed.</span>}</div>}<div className="diagnostic-actions"><button className="primary-button" disabled={!custom}>Start this challenge<ArrowRight size={16} /></button><button className="secondary-button" type="button" disabled={!custom} onClick={() => share(custom)}><Share2 size={16} />Create link</button></div></form></section>
    </> : done ? <section className="home-panel diagnostic-results"><p role="status">Challenge complete.</p><h2>{session.interrupted ? 'Practice completed. Your place was worth keeping.' : 'A new result for this passage.'}</h2><div className="challenge-score"><div><strong>{stats.accuracy}%</strong><span>accuracy</span></div><div><strong>{stats.wpm}</strong><span>words per minute</span></div></div>{session.interrupted ? <p>You paused or left the typing input. This result is practice and is excluded from challenge personal bests.</p> : <p>{comparison.count ? `Before this attempt, your best on this exact text was ${comparison.bestWpm} words per minute and your best accuracy was ${comparison.bestAccuracy}%.` : 'This uninterrupted attempt is your first comparison point for this exact passage.'} {comparison.medianWpm !== null ? `Typical speed across ${comparison.count} earlier matching attempts was ${comparison.medianWpm} words per minute (the median).` : ''}</p>}<div className="diagnostic-actions"><button className="primary-button" ref={nextRef} onClick={() => start(selection)}>Try the same passage<RotateCcw size={16} /></button><button className="secondary-button" onClick={browse}>Choose another challenge</button><button className="text-button" onClick={() => share(selection)}><Share2 size={16} />Create link</button><button className="text-button" onClick={onBack}>Finish for now</button></div></section> : <>
      <div className="diagnostic-toolbar"><span role="status">{paused ? 'Paused' : session.status === 'running' ? 'Typing' : session.attempts ? 'Ready to resume as practice' : 'Ready. Start typing to begin.'}</span><div><button className="secondary-button" onClick={pause}><Pause size={16} />Pause <kbd>Esc</kbd></button><button className="text-button" onClick={requestRestart}><RotateCcw size={16} />Restart</button></div></div>
      <section className="home-panel"><div className={'diagnostic-surface ' + (focused ? 'focused' : '')} onClick={() => !paused && focusTyping()}><div className="diagnostic-passage words-text" ref={viewportRef} aria-hidden="true">{[...session.text].map((character, index) => <span key={index} ref={index === session.typed.length ? caretRef : undefined} className={'char ' + (index === session.typed.length ? 'current ' : '') + (session.typed[index] === undefined ? '' : session.typed[index] === character ? 'correct' : 'incorrect')}>{character}</span>)}</div><textarea ref={inputRef} className="diagnostic-input" aria-label="Challenge typing input" aria-describedby="challenge-instructions challenge-prompt" value="" readOnly={paused || suspended} onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); if (sessionRef.current.attempts && sessionRef.current.status !== 'finished') pause(); }} onPaste={event => { event.preventDefault(); setMessage('Type the passage one key at a time. Pasting is disabled.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" /><p className="sr-only" id="challenge-prompt">Text to type: {session.text}</p></div></section>
      <p id="challenge-instructions" className="home-small-note">{session.typed.length} of {session.text.length} characters. Backspace corrects; Tab moves to controls; Escape pauses; Shift+Enter requests a restart. Pausing or leaving the typing input makes this a practice result.</p>{!focused && !paused && <button className="secondary-button" onClick={focusTyping}>Return to typing</button>}
    </>}
    {link && <section className="home-panel challenge-share"><label>This link includes the full passage text<input ref={linkRef} value={link} readOnly onFocus={event => event.target.select()} /></label><p className="home-small-note">Anyone with this link can read the text. Creating the link does not upload the passage or send it to another person.</p><div className="diagnostic-actions"><button className="secondary-button" onClick={copyLink}><Copy size={16} />Copy challenge link</button><button className="text-button" onClick={() => { setLink(''); setMessage(''); }}>Close link</button></div></section>}
    <p role="status" className="home-small-note">{message}</p><p className="home-small-note">Unfinished challenges are kept only while this screen stays open. Complete a challenge to add a result to your history.</p>
    {!suspended && pendingChallenge ? <Dialog title="Replace the unfinished challenge?" onClose={() => setPendingChallenge(null)}><p>Starting {pendingChallenge.title} clears your unfinished attempt at {selection.title}. Completed results stay in your history.</p><div className="pause-actions"><button data-autofocus className="primary-button" onClick={resume}>Keep current challenge</button><button className="secondary-button" onClick={() => start(pendingChallenge)}>Start new challenge</button></div></Dialog> : !suspended && inPractice && (restartOpen ? <ConfirmRestart onCancel={resume} onConfirm={() => start(runRef.current.challenge)} /> : paused && <Dialog title="Challenge paused" onClose={resume}><p>Your position and mistakes are kept for this visit. The timer waits for your next typed character.</p><p className="panel-note">A paused attempt counts as practice and cannot set a challenge personal best. This unfinished attempt is not saved to backups.</p><div className="pause-actions"><button data-autofocus className="primary-button" onClick={resume}>Resume typing<ArrowRight size={16} /></button><button className="secondary-button" onClick={browse}>Finish for now</button><button className="text-button" onClick={requestRestart}>Restart challenge</button></div></Dialog>)}
  </div>;
}
