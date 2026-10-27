import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3, BookOpen, CircleHelp, Clock3, Code2, Flame, Hand, House, Keyboard as KeyboardIcon, Leaf, Moon, RotateCcw, Settings2, ShieldCheck, Sparkles, Sun, Target, Type, Upload, Volume2, VolumeX, X } from 'lucide-react';
import Keyboard from './Keyboard.jsx';
import TypingCoach, { GuidanceChoice, WordProgress } from './TypingCoach.jsx';
import Lessons from './Lessons.jsx';
import Stories from './Stories.jsx';
import Start from './Start.jsx';
import PracticeLibrary from './PracticeLibrary.jsx';
import Diagnostic from './Diagnostic.jsx';
import Challenges from './Challenges.jsx';
import { KeyboardHeatmap, ResultInsights } from './ResultInsights.jsx';
import { mistakePassage, resetLearningProgress } from './resultInsights.js';
import { readSharedChallenge } from './challenges.js';
import PauseDialog, { Dialog as Modal, ConfirmRestart } from './SessionControls.jsx';
import { sanitizeLessonDrafts } from './lessonDrafts.js';
import { createWorkspaceDraft, restoreWorkspaceSession, sanitizeWorkspaceDrafts, workspaceKey } from './workspaceDrafts.js';
import { sanitizeSavedPassages } from './practiceLibrary.js';
import { STORIES, applyStoryResult } from './stories.js';
import { sanitizeStoryDrafts } from './storyDrafts.js';
import TestSetup from './TestSetup.jsx';
import { LESSON_COURSE, applyLessonResult, lessonPracticeComplete, sanitizeLessonProgress } from './lessons.js';
import { applyLessonLearningResult, getDueLessonReviews } from './lessonLearning.js';
import { LESSONS, createSession, enterKey, generateText, getPracticeRecommendation, localDay, mergeKeyStats, metrics, pauseSession, resumeSession, streak, tick, weakKeys } from './typing.js';
import { STORAGE_KEY, discardedDraftsNotice, mergeProgress, readProgress, validateProgress } from './storage.js';
import { browserStorage } from './browserStorage.js';
import { createProgressWriter, SAVE_CONFLICT_MESSAGE } from './progressWriter.js';
import { readProgressBackup, serializeProgressBackup } from './progressBackup.js';

export default function App(props) {
  return <LoadProfile key={props.storageKey || STORAGE_KEY} {...props} />;
}

function LoadProfile({ storageKey = STORAGE_KEY, storage = browserStorage, ...props }) {
  const [initial, setInitial] = useState(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    let active = true;
    readProgress(storage, storageKey).then(value => { if (active) setInitial(value); });
    return () => { active = false; };
  }, [storage, storageKey, reloadVersion]);
  if (!initial) return <main className="storage-loading" role="status">Loading your progress…</main>;
  return <Workspace key={reloadVersion} {...props} storageKey={storageKey} storage={storage} initial={initial} onReload={() => { setInitial(null); setReloadVersion(value => value + 1); }} />;
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

const modeLabel = settings => settings.mode === 'time' ? `${settings.duration}s test` : settings.mode === 'words' ? `${settings.wordCount} words` : settings.mode === 'practice' ? `${LESSONS.find(l => l.id === settings.lesson)?.title} practice` : 'Custom text';
const category = workspaceKey;
const formatSeconds = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

function Workspace({ storageKey, storage, initial, onReload, profileName, onManageProfiles, externalSuspended = false }) {
  const [progress, setProgress] = useState(initial.progress);
  const [warning, setWarning] = useState(initial.warning);
  const [saveIssue, setSaveIssue] = useState('');
  const [writer] = useState(() => createProgressWriter(storage, storageKey, initial.storedRaw));
  const [saveStatus, setSaveStatus] = useState(initial.writeBlocked ? 'unavailable' : 'saving');
  const storageAvailable = saveStatus === 'saved';
  const storageSaving = saveStatus === 'saving';
  const saveRevision = useRef(0);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [recoveryRaw, setRecoveryRaw] = useState(initial.recoveryRaw);
  const writeBlockedRef = useRef(initial.writeBlocked === true);
  const settings = progress.settings;
  const hasPractice = progress.history.length > 0 || Object.keys(progress.lessonProgress || {}).length > 0 || Object.keys(progress.storyProgress || {}).length > 0 || Object.keys(progress.storyDrafts || {}).length > 0 || Object.keys(progress.lessonDrafts || {}).length > 0 || Object.keys(progress.workspaceDrafts || {}).length > 0;
  const [session, setSession] = useState(() => restoreWorkspaceSession(progress.workspaceDrafts?.[category(settings)]) || { ...createSession(generateText(settings, progress.keyStats)), runId: crypto.randomUUID() });
  const [sharedChallenge] = useState(() => readSharedChallenge(window.location.hash));
  const [view, setView] = useState(() => sharedChallenge ? 'challenges' : settings.startView === 'type' ? 'type' : 'start');
  const [activityRequest, setActivityRequest] = useState(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [restartRequest, setRestartRequest] = useState(null);
  const [comparison, setComparison] = useState('');
  const [modal, setModal] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const resettingRef = useRef(false);
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
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const recordedRef = useRef(false);
  const audioRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  settingsRef.current = settings;

  function updateProgress(value, flush = false) {
    const next = typeof value === 'function' ? value(progressRef.current) : value;
    progressRef.current = next;
    setProgress(next);
    if (flush) persistProgress(next);
  }

  const updateSession = next => {
    sessionRef.current = next;
    setSession(next);
    if (next.status === 'finished' && !recordedRef.current) {
      recordedRef.current = true;
      const config = settingsRef.current;
      const result = { id: next.runId, date: new Date().toISOString(), mode: config.mode, label: modeLabel(config), category: category(config), interrupted: next.interrupted === true, elapsed: next.elapsed, ...metrics(next) };
      updateProgress(current => {
        if (current.history.some(run => run.id === result.id)) return current;
        const workspaceDrafts = { ...current.workspaceDrafts };
        delete workspaceDrafts[category(config)];
        return { ...current, workspaceDrafts, history: [result, ...current.history].slice(0, 500), keyStats: mergeKeyStats(current.keyStats, next.keyStats) };
      }, true);
    } else if (next.attempts > 0 && next.status !== 'finished') {
      saveWorkspace(next);
    }
  };

  function saveWorkspace(current = sessionRef.current, flush = false) {
    const draft = createWorkspaceDraft(current, settingsRef.current);
    if (!draft) return;
    const drafts = { ...progressRef.current.workspaceDrafts, [category(draft.config)]: draft };
    if (Object.keys(drafts).length > 100) setNotice('Your 100 most recent unfinished typing activities are kept. The oldest draft was replaced; completed results stay saved.');
    updateProgress(value => ({ ...value, workspaceDrafts: sanitizeWorkspaceDrafts(drafts, value.history) }), flush);
  }

  function pauseWorkspace(show = true) {
    if (sessionRef.current.status === 'finished') return;
    const next = pauseSession(sessionRef.current, settingsRef.current, performance.now(), { interrupt: ['time', 'words'].includes(settingsRef.current.mode) });
    updateSession(next);
    saveWorkspace(next, true);
    if (show && next.status !== 'finished') setPauseOpen(true);
  }

  function resumeWorkspace() {
    setPauseOpen(false);
    updateSession(resumeSession(sessionRef.current));
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  function openModal(name) {
    if (viewRef.current === 'type') pauseWorkspace(false);
    setPauseOpen(false);
    setModal(name);
  }

  function requestRestart(options = {}) {
    if (sessionRef.current.attempts && sessionRef.current.status !== 'finished') {
      pauseWorkspace(false);
      setPauseOpen(false);
      setRestartRequest(options);
    } else reset(options);
  }

  async function persistProgress(value) {
    if (resettingRef.current) return false;
    if (writeBlockedRef.current) { if (mountedRef.current) setSaveStatus('unavailable'); return false; }
    const revision = ++saveRevision.current;
    if (mountedRef.current) setSaveStatus('saving');
    const result = await writer.save(value);
    if (!mountedRef.current || revision !== saveRevision.current) return result.status === 'saved';
    setSaveStatus(result.status);
    setSaveIssue(result.message);
    return result.status === 'saved';
  }
  useEffect(() => { persistProgress(progress); }, [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.accent = settings.accent || 'blue';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0a1020' : '#f2f5fb');
  }, [settings.theme, settings.accent]);
  useEffect(() => {
    if (settings.themeRevision !== 2) updateProgress(current => ({ ...current, settings: { ...current.settings, theme: 'dark', themeRevision: 2 } }));
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
  useEffect(() => {
    if (view === 'type') {
      if (sessionRef.current.status === 'paused') setPauseOpen(true);
      else inputRef.current?.focus({ preventScroll: true });
    } else if (!['lessons', 'stories', 'start'].includes(view)) document.querySelector('main h1')?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    const pause = () => { if (viewRef.current === 'type' && sessionRef.current.status === 'running') pauseWorkspace(true); };
    const hidden = () => { if (document.visibilityState === 'hidden') pause(); };
    window.addEventListener('blur', pause);
    window.addEventListener('pagehide', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pause); window.removeEventListener('pagehide', pause); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (viewRef.current !== 'type') return;
    if (externalSuspended) pauseWorkspace(false);
    else if (sessionRef.current.status === 'paused') setPauseOpen(true);
  }, [externalSuspended]);

  function reset({ config = settingsRef.current, repeat = false, focus = true, keyStats = progressRef.current.keyStats } = {}) {
    recordedRef.current = false;
    const next = { ...createSession(repeat ? sessionRef.current.text : generateText(config, keyStats, Math.random, sessionRef.current.text)), runId: crypto.randomUUID() };
    updateProgress(current => { const workspaceDrafts = { ...current.workspaceDrafts }; delete workspaceDrafts[category(config)]; return { ...current, workspaceDrafts }; });
    setPauseOpen(false);
    sessionRef.current = next;
    setSession(next);
    if (wordsRef.current) wordsRef.current.scrollTop = 0;
    if (focus) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }
  function changeSettings(patch, restart = true) {
    if (restart && sessionRef.current.attempts && sessionRef.current.status !== 'finished') pauseWorkspace(false);
    const config = { ...settingsRef.current, ...patch };
    settingsRef.current = config;
    updateProgress(current => ({ ...current, settings: config }));
    if (restart) {
      const draft = progressRef.current.workspaceDrafts?.[category(config)];
      const restored = draft && (!Object.hasOwn(patch, 'customText') || draft.text === generateText(config)) ? restoreWorkspaceSession(draft) : null;
      if (restored) { sessionRef.current = restored; setSession(restored); recordedRef.current = false; setPauseOpen(false); }
      else reset({ config, focus: false });
    }
  }
  function navigate(target) {
    if (viewRef.current === 'type' && sessionRef.current.status !== 'finished' && sessionRef.current.attempts) pauseWorkspace(false);
    setPauseOpen(false);
    setActivityRequest(null);
    setView(target);
    setFocusMode(false);
  }
  function practiceWeak() {
    setFocusMode(false);
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
    if (event.key === 'Tab') return;
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
      if (modal || event.isComposing || event.target.closest?.('dialog')) return;
      if (view === 'type' && event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && [inputRef.current, restartRef.current].includes(event.target)) {
        event.preventDefault();
        if (!event.repeat) requestRestart();
        return;
      }
      if (view === 'type' && (event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'Enter' && [inputRef.current, restartRef.current].includes(event.target)) { event.preventDefault(); if (!event.repeat) requestRestart(); }
      if (event.key === 'Escape' && view === 'type' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest?.('select, input') && sessionRef.current.status !== 'finished') { event.preventDefault(); pauseWorkspace(); }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  });

  function exportProgress() {
    try {
      const backup = { ...progressRef.current, lastBackupAt: new Date().toISOString() };
      const blob = new Blob([serializeProgressBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `typedo-${localDay()}.json`; anchor.click();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      updateProgress(backup);
      setNotice('Progress exported. Keep the file somewhere safe.');
    } catch (error) { setNotice(error.message || 'The backup could not be downloaded. Your progress has not been changed.'); }
  }
  async function resetProfileProgress() {
    if (resettingRef.current) return;
    if (writeBlockedRef.current || saveStatus === 'conflict') {
      setResetError('Load the saved profile before resetting. Export this tab first to keep unsaved work.');
      return;
    }
    resettingRef.current = true;
    setResetBusy(true);
    setResetError('');
    // Use the same serialized CAS writer so stale tabs and pending saves cannot
    // silently overwrite newer work or resurrect data after a successful reset.
    ++saveRevision.current;
    const result = await writer.save(resetLearningProgress(progressRef.current));
    if (result.status === 'saved') { onReload(); return; }
    resettingRef.current = false;
    setResetBusy(false);
    setResetError(`Progress was not reset. ${result.message}`);
    setSaveStatus(result.status);
    setSaveIssue(result.message);
  }
  function exportOriginalSave() {
    if (typeof recoveryRaw !== 'string') return;
    const url = URL.createObjectURL(new Blob([recoveryRaw], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `typedo-original-${localDay()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Original save downloaded without changes. Keep it for recovery.');
  }
  async function importProgress(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const source = await readProgressBackup(file);
      const imported = validateProgress(source);
      const restored = mergeProgress(progressRef.current, imported);
      writeBlockedRef.current = false;
      setRecoveryRaw(null);
      setWarning('');
      updateProgress(restored);
      settingsRef.current = restored.settings;
      setCustomDraft(restored.settings.customText);
      const draft = restoreWorkspaceSession(restored.workspaceDrafts?.[category(restored.settings)]);
      if (draft) { sessionRef.current = draft; setSession(draft); recordedRef.current = false; }
      else reset({ config: restored.settings, keyStats: restored.keyStats, focus: false });
      setNotice(discardedDraftsNotice(source, imported) || 'Backup restored with your settings. Existing results were kept.');
    } catch (error) { setNotice(error instanceof SyntaxError ? 'That file is not a valid JSON backup.' : error.message); }
  }

  function completeLesson(result) {
    const { keyStats, passage, passages, practiceRound, targetKeys, attempts, correctAttempts, textLength, guided, ...run } = result;
    updateProgress(current => {
      if (current.history.some(item => item.id === run.id)) return current;
      return {
        ...current,
        history: [run, ...current.history].slice(0, 500),
        keyStats: mergeKeyStats(current.keyStats, keyStats),
        lessonProgress: applyLessonResult(current.lessonProgress || {}, result),
        lessonLearning: applyLessonLearningResult(current.lessonLearning || {}, result),
        lessonDrafts: sanitizeLessonDrafts(current.lessonDrafts, applyLessonResult(current.lessonProgress || {}, result), [run, ...current.history]),
      };
    });
  }

  function completeStory(result) {
    const { keyStats, ...run } = result;
    updateProgress(current => {
      if (current.history.some(item => item.id === run.id)) return current;
      const storyDrafts = { ...current.storyDrafts };
      delete storyDrafts[result.storyId];
      return {
        ...current,
        history: [run, ...current.history].slice(0, 500),
        keyStats: mergeKeyStats(current.keyStats, keyStats),
        storyProgress: applyStoryResult(current.storyProgress || {}, result),
        storyDrafts,
      };
    });
  }

  function completeChallenge(result) {
    const { keyStats, ...run } = result;
    updateProgress(current => current.history.some(item => item.id === run.id) ? current : { ...current, history: [run, ...current.history].slice(0, 500), keyStats: mergeKeyStats(current.keyStats, keyStats) }, true);
  }

  function useCustomText(text) {
    changeSettings({ mode: 'custom', customText: text });
    setModal(null);
    resumeWorkspace();
  }

  function saveStoryDraft(storyId, draft, { flush = false } = {}) {
    const current = progressRef.current;
    const storyDrafts = { ...current.storyDrafts };
    if (draft) storyDrafts[storyId] = draft;
    else delete storyDrafts[storyId];
    const next = { ...current, storyDrafts: sanitizeStoryDrafts(storyDrafts, current.storyProgress, current.history) };
    progressRef.current = next;
    updateProgress(next);
    if (flush) persistProgress(next);
  }

  function saveLessonDraft(lessonId, draft, { flush = false } = {}) {
    updateProgress(current => {
      const lessonDrafts = { ...current.lessonDrafts };
      if (draft) lessonDrafts[lessonId] = draft; else delete lessonDrafts[lessonId];
      return { ...current, lessonDrafts: sanitizeLessonDrafts(lessonDrafts, current.lessonProgress, current.history) };
    }, flush);
  }

  function continueActivity(request) {
    if (request.practiceWeak) { practiceWeak(); return; }
    navigate(request.view);
    setActivityRequest(request);
    if (request.view === 'type') {
      const draft = progressRef.current.workspaceDrafts?.[request.id];
      if (draft) {
        updateProgress(current => ({ ...current, settings: { ...current.settings, ...draft.config } }));
        settingsRef.current = { ...settingsRef.current, ...draft.config };
        const restored = restoreWorkspaceSession(draft);
        sessionRef.current = restored; setSession(restored); recordedRef.current = false; setPauseOpen(true);
      }
    }
  }

  function startFreshWorkspace(config) {
    navigate('type');
    settingsRef.current = config;
    updateProgress(current => ({ ...current, settings: config }));
    reset({ config });
  }

  function startQuickTest() {
    const config = { ...settingsRef.current, mode: 'time', duration: 30, punctuation: false, numbers: false };
    if (progressRef.current.workspaceDrafts?.[category(config)]) setRestartRequest({ config, startFresh: true });
    else startFreshWorkspace(config);
  }

  const lessonRecords = Object.values(sanitizeLessonProgress(progress.lessonProgress));
  const completedLessons = lessonRecords.filter(lessonPracticeComplete).length;
  const lessonStarted = lessonRecords.some(record => record.attempts > 0 || record.practiceRounds > 0 || record.practiced || record.passed);
  const currentMetrics = metrics(session);
  const finished = session.status === 'finished';
  const running = session.status === 'running';
  const todayRuns = progress.history.filter(run => localDay(new Date(run.date)) === localDay());
  const currentStreak = streak(progress.history);
  const testHistory = progress.history.filter(run => ['time', 'words'].includes(run.mode) && !run.interrupted);
  const comparisonCategory = testHistory.some(run => run.category === comparison) ? comparison : testHistory[0]?.category || category(settings);
  const comparableTests = testHistory.filter(run => run.category === comparisonCategory);
  const sortedSpeeds = comparableTests.map(run => run.wpm).sort((a, b) => a - b);
  const medianSpeed = sortedSpeeds.length ? (sortedSpeeds[Math.floor((sortedSpeeds.length - 1) / 2)] + sortedSpeeds[Math.floor(sortedSpeeds.length / 2)]) / 2 : 0;
  const best = testHistory.length ? Math.max(...testHistory.map(run => run.wpm)) : null;
  const averageAccuracy = progress.history.length ? Math.round(progress.history.reduce((sum, run) => sum + run.accuracy, 0) / progress.history.length * 10) / 10 : null;
  const weaknesses = weakKeys(progress.keyStats, 3);
  const recommendation = getPracticeRecommendation(progress.keyStats);
  const remaining = Math.max(0, Math.ceil(settings.duration - session.elapsed / 1000));
  const completion = settings.mode === 'time' ? session.elapsed / (settings.duration * 1000) : session.typed.length / session.text.length;
  const sameTests = testHistory.filter(run => run.category === category(settings));
  const isBest = finished && !session.interrupted && ['time', 'words'].includes(settings.mode) && sameTests.length > 1 && currentMetrics.wpm > Math.max(...sameTests.slice(1).map(run => run.wpm));
  let charOffset = 0;

  return <div className={`app app-shell ${focusMode ? 'focus-mode' : ''} ${settings.showLiveStats ? '' : 'hide-live-stats'}`} style={{ '--passage-size': `${settings.passageSize}px`, '--passage-line-height': settings.lineHeight }}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {view === 'type' && !finished && <button className="skip-link skip-practice" onClick={resumeWorkspace}>Return to typing</button>}
    <header className="sidebar">
      <button className="brand" onClick={() => navigate('start')} aria-label="Typedo home"><span className="brand-mark">t<span /></span><span>Typedo<span className="brand-period">.</span></span></button>
      <span className="sidebar-label">WORKSPACE</span>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={view === 'start' ? 'active' : ''} aria-current={view === 'start' ? 'page' : undefined} onClick={() => navigate('start')}><House size={18} />Start</button>
        <button className={view === 'type' ? 'active' : ''} aria-current={view === 'type' ? 'page' : undefined} onClick={() => navigate('type')}><KeyboardIcon size={18} />Type</button>
        <button className={view === 'lessons' ? 'active' : ''} aria-current={view === 'lessons' ? 'page' : undefined} onClick={() => navigate('lessons')}><BookOpen size={18} />Lessons<span className="nav-count">{LESSON_COURSE.length}</span></button>
        <button className={view === 'stories' ? 'active' : ''} aria-current={view === 'stories' ? 'page' : undefined} onClick={() => navigate('stories')}><BookOpen size={18} />Stories<span className="nav-count">{STORIES.length}</span></button>
        <button className={view === 'progress' ? 'active' : ''} aria-current={view === 'progress' ? 'page' : undefined} onClick={() => navigate('progress')}><BarChart3 size={18} />Progress</button>
      </nav>
      <button className={view === 'library' ? 'library-nav active' : 'library-nav'} onClick={() => navigate('library')}><BookOpen size={17} />Practice library</button>
      <button className="library-nav" onClick={() => navigate('challenges')}>Personal challenges</button><button className="sidebar-course" onClick={() => navigate('lessons')}><span><BookOpen size={14} />TOUCH TYPING</span><strong>{completedLessons} / {LESSON_COURSE.length} lessons completed</strong><small>Continue learning<ArrowRight size={12} /></small></button>
      <div className="sidebar-bottom">{onManageProfiles && <button disabled={!storageAvailable} title={storageSaving ? "Saving your progress…" : storageAvailable ? undefined : "Restore browser saving before switching profiles. Export your current work from Progress."} onClick={() => onManageProfiles(() => persistProgress(progressRef.current))} aria-label="Manage local profiles">Profile: {profileName}</button>}
        <button aria-label="Settings" onClick={() => openModal('settings')}><Settings2 size={17} />Settings</button>
        <button aria-label={settings.theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => changeSettings({ theme: settings.theme === 'light' ? 'dark' : 'light', themeRevision: 2 }, false)}>{settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
      </div>
      <div className="sidebar-local"><span className="tiny-dot" />{storageSaving ? 'Saving…' : storageAvailable ? 'Saved in this browser' : 'Kept for this visit'}</div>
    </header>

    <main id="main-content" tabIndex={-1}>
      {(warning || saveIssue || saveStatus === 'conflict') && <div role="status" className="warning storage-warning">
        <p>{saveStatus === 'conflict' ? SAVE_CONFLICT_MESSAGE : saveIssue || warning}</p>
        <div className="storage-warning-actions">
          {typeof recoveryRaw === 'string' && <button className="text-button" onClick={exportOriginalSave}>Download original save</button>}
          {saveStatus === 'unavailable' && !writeBlockedRef.current && <button className="text-button" onClick={() => persistProgress(progressRef.current)}>Retry saving</button>}
          {(saveIssue || saveStatus === 'conflict') && <button className="text-button" onClick={exportProgress}>Export this tab</button>}
          {(saveStatus === 'conflict' || writeBlockedRef.current) && <button className="text-button" onClick={() => openModal('storage-reload')}>Load saved progress</button>}
          {saveStatus !== 'conflict' && <button aria-label="Dismiss storage message" onClick={() => { setWarning(''); setSaveIssue(''); }}><X size={16} /></button>}
        </div>
      </div>}
      {view === 'start' ? <Start onIntroStory={() => continueActivity({ view: 'stories', id: STORIES[0].id })} onDiagnostic={() => navigate('diagnostic')} progress={progress} onContinueActivity={continueActivity} onPracticeWeak={practiceWeak} onPracticeLibrary={() => navigate('library')} onSettingsChange={patch => changeSettings(patch, false)} reviewCount={getDueLessonReviews(progress.lessonLearning || {}, progress.lessonProgress || {}).length} hasPractice={hasPractice} lessonStarted={lessonStarted} courseComplete={completedLessons === LESSON_COURSE.length} storageAvailable={storageAvailable} storageSaving={storageSaving} onLessons={() => navigate('lessons')} onTest={startQuickTest} onStories={() => navigate('stories')} onProgress={() => navigate('progress')} onRestore={() => uploadRef.current.click()} /> : view === 'type' ? <>
        <section className="intro"><div><div className="eyebrow"><span />TYPING WORKSPACE</div><h1>{settings.mode === 'practice' ? 'Word practice' : settings.mode === 'custom' ? 'Custom text' : 'Typing test'}</h1><p>Build confidence with real words. Keep the finger guide as long as you need it.</p></div><div className="daily-goal"><div className="goal-ring" style={{ '--fill': `${Math.min(1, todayRuns.reduce((sum, run) => sum + run.elapsed, 0) / (settings.dailyMinutes * 60000)) * 360}deg` }}><Leaf size={19} /></div><div><strong>Daily practice</strong><span>{Math.floor(todayRuns.reduce((sum, run) => sum + run.elapsed, 0) / 60000)} of {settings.dailyMinutes} minutes today</span></div></div></section>

        <div className="workspace-controls"><div className="mode-tabs" aria-label="Typing mode">
          <button aria-pressed={['time', 'words'].includes(settings.mode)} className={['time', 'words'].includes(settings.mode) ? 'selected' : ''} onClick={() => changeSettings({ mode: 'time' })}><Clock3 size={16} />Typing test</button>
          <button aria-pressed={settings.mode === 'practice'} className={settings.mode === 'practice' ? 'selected' : ''} onClick={() => changeSettings({ mode: 'practice' })}><Hand size={16} />Word practice</button>
          <button aria-pressed={settings.mode === 'custom'} className={settings.mode === 'custom' ? 'selected' : ''} onClick={() => changeSettings({ mode: 'custom' })}><Type size={17} />Custom text</button>
        </div><button className="text-button shortcuts-link" onClick={() => openModal('help')}><CircleHelp size={15} />Shortcuts</button></div>

        {settings.mode === 'practice' ? <div className="lesson-bar">{LESSONS.map(lesson => <button aria-pressed={settings.lesson === lesson.id} className={settings.lesson === lesson.id ? 'selected' : ''} key={lesson.id} onClick={() => changeSettings({ lesson: lesson.id })}><span>{lesson.badge}</span>{lesson.title}</button>)}</div>
          : settings.mode === 'custom' ? <div className="config-bar custom-bar"><span><Code2 size={15} />Custom passage</span><button className="text-button" onClick={() => { setCustomDraft(settings.customText); setCustomError(''); openModal('custom'); }}>Edit text<ArrowUpRight size={14} /></button></div>
          : <TestSetup settings={settings} onChange={changeSettings} />}

        <GuidanceChoice enabled={settings.guide} onChange={guide => { changeSettings({ guide }, false); }} />
        <div className="session-actions"><button className="text-button" onClick={resumeWorkspace}>{session.status === 'paused' ? 'Resume typing' : 'Return to typing'}</button>{!finished && <button className="secondary-button" onClick={() => pauseWorkspace()}>Pause <kbd>Esc</kbd></button>}</div>
        <section className={`typing-card ${focused ? 'is-focused' : ''} ${finished ? 'finished' : ''}`} aria-label="Typing workspace">
          <div className="typing-topline"><span className="language"><span className={`status-dot ${running ? 'running' : ''}`} />{settings.mode === 'practice' ? LESSONS.find(l => l.id === settings.lesson)?.subtitle : 'english'}<span className="subtle-slash">/</span>{finished ? 'session complete' : session.status === 'paused' ? 'paused' : settings.mode === 'practice' && settings.strict ? 'accuracy first' : modeLabel(settings)}</span><div className="live-metrics"><span><strong>{running || finished ? currentMetrics.wpm : '—'}</strong> wpm</span><span><strong>{running || finished ? currentMetrics.accuracy : '—'}</strong> %</span><span className="timer"><Clock3 size={14} /><strong>{settings.mode === 'time' ? remaining : formatSeconds(session.elapsed / 1000)}</strong>{settings.mode === 'time' && <small>s</small>}</span></div></div>

          {finished ? <div className="results" role="status">{session.interrupted && <p className="interrupted-note">Paused test: practice result. Start a fresh test to set a personal best.</p>}<div className="result-title"><span className="eyebrow">{isBest ? 'NEW PERSONAL BEST' : 'SESSION RESULT'}</span><h2>{isBest ? 'Personal best' : ['practice', 'custom'].includes(settings.mode) ? 'Practice complete' : 'Test complete'}</h2></div><div className="result-content"><div className="result-score"><strong>{currentMetrics.wpm}</strong><span>words per minute</span></div><div className="result-secondary"><div><strong>{currentMetrics.accuracy}%</strong><span>accuracy</span></div><div><strong>{currentMetrics.raw}</strong><span>raw wpm</span></div><div><strong>{currentMetrics.errors}</strong><span>mistakes</span></div></div><div className="result-chart"><Chart data={session.samples.map(sample => sample.wpm)} /><div><span>your pace</span><span>{(session.elapsed / 1000).toFixed(1)} seconds</span></div></div></div><div className="result-actions"><button className="primary-button" ref={restartRef} onClick={() => requestRestart()}>Go again<ArrowRight size={16} /></button><button className="secondary-button" onClick={() => requestRestart({ repeat: true })}><RotateCcw size={14} />Repeat text</button>{currentMetrics.errors > 0 && <button className="text-button" onClick={practiceWeak}>Practice weak keys<ArrowUpRight size={15} /></button>}</div><ResultInsights session={session} stats={currentMetrics} settings={settings} onPractice={() => useCustomText(mistakePassage(session.keyStats))} /></div>
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
            <textarea ref={inputRef} className="typing-input" aria-label="Typing input" aria-describedby="typing-instructions accessible-prompt" value="" onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); if (['time', 'words'].includes(settingsRef.current.mode) && sessionRef.current.status === 'running') pauseWorkspace(false); }} onPaste={event => { event.preventDefault(); setNotice('Type the text yourself. Paste is disabled during a session.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" />
            <p id="accessible-prompt" className="sr-only">Text to type: {session.text}</p>
            {!focused && !finished && <div className="focus-prompt"><button className="primary-button" onClick={resumeWorkspace}>Return to typing</button></div>}
          </div>{settings.guide && <TypingCoach next={session.text[session.typed.length]} />}</div>}
          {settings.mode === 'practice' && <WordProgress text={session.text} typed={session.typed} />}

          <div className="typing-bottomline"><span id="typing-instructions">{capsLock && !finished ? <span className="caps-warning">Caps Lock is on</span> : finished ? <><ShieldCheck size={14} />{storageSaving ? 'Saving progress…' : storageAvailable ? 'Progress saved in this browser' : 'Session complete · export to keep it'}</> : running ? settings.mode === 'practice' && settings.strict ? 'Take your time. Correct each key to continue.' : 'Timer running. Backspace to correct a character.' : <><span className="mini-caret" />{session.status === 'paused' ? 'Paused. Choose Resume typing when ready.' : focused ? 'Start typing to begin' : 'Use Return to typing to begin'}<span className="desktop-note"> · use a physical keyboard</span></>}</span><div><button className="icon-button" aria-label={settings.sound ? 'Mute key sounds' : 'Enable key sounds'} onClick={() => changeSettings({ sound: !settings.sound }, false)}>{settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button><button className="icon-button focus-button" aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'} onClick={() => setFocusMode(!focusMode)}><Target size={16} /></button><button className="restart-button" ref={finished ? undefined : restartRef} onClick={() => requestRestart()} aria-keyshortcuts="Shift+Enter" title="Restart (Shift+Enter)"><RotateCcw size={16} />Restart</button></div></div>
          <div className="typing-progress"><div style={{ width: `${Math.min(100, completion * 100)}%` }} /></div>
        </section>
        <div className="under-test"><div><kbd>Esc</kbd><span>pause</span><i /><kbd>Shift</kbd> + <kbd>Enter</kbd><span>retry</span><i /><kbd>Backspace</kbd><span>correct</span></div>{!settings.guide ? <button className="text-button" onClick={() => changeSettings({ guide: true }, false)}>Show finger guide</button> : <span className="gentle-hint">Focus on accuracy before speed.</span>}</div>

        {settings.guide && !finished && <details className="keyboard-reference"><summary>Need the whole keyboard? Open key map</summary><Keyboard next={session.text[session.typed.length]} running={running} finished={finished} /></details>}
        {settings.mode === 'practice' && <div className="practice-note"><Hand size={16} /><span>{settings.lesson === 'weak' && !weaknesses.length ? 'Keep practicing. A few completed sessions help us choose which keys need attention.' : 'The guide teaches finger placement. Your keyboard cannot report which finger you use.'}</span><button className="text-button" onClick={() => changeSettings({ strict: !settings.strict })}>{settings.strict ? '✓' : '○'} Wait for correct key</button></div>}

        {recommendation && <section className="lesson-entry practice-recommendation" aria-label="Suggested practice"><div><Target size={20} /><div><strong>{recommendation.title}</strong><p>{recommendation.description}</p><div className="recommendation-keys">{recommendation.keys.map(item => <kbd key={item.key} aria-label={`${item.key} key`}>{item.key}</kbd>)}</div></div></div>{settings.mode === 'practice' && settings.lesson === 'weak' ? <span className="recommendation-active">Practicing these keys</span> : <button onClick={practiceWeak}>Practice these keys<ArrowRight size={15} /></button>}</section>}
        <section className="lesson-entry"><div><BookOpen size={20} /><div><strong>Learn touch typing</strong><p>Short guided rounds that move forward. Accuracy tests are optional.</p></div></div><button onClick={() => navigate('lessons')}>Open lessons<ArrowRight size={15} /></button></section>
        <section className="lesson-entry"><div><BookOpen size={20} /><div><strong>Type a story</strong><p>Original comedies, one short chapter at a time.</p></div></div><button onClick={() => navigate('stories')}>Open stories<ArrowRight size={15} /></button></section>
        <div className="bottom-stats"><div><span className="stat-icon"><Flame size={18} /></span><div><strong>{currentStreak} day{currentStreak !== 1 ? 's' : ''}</strong><span>current streak</span></div></div><div><span className="stat-icon"><Award size={18} /></span><div><strong>{best === null ? 'No personal best yet' : `${best} wpm`}</strong><span>{best === null ? 'complete a test to set your best' : 'personal best · all tests'}</span></div></div><button onClick={() => navigate('progress')}><span className="stat-icon"><Activity size={18} /></span><div><strong>Session history</strong><span>{progress.history.length} completed session{progress.history.length !== 1 ? 's' : ''}</span></div><ArrowUpRight size={18} /></button></div>
      </> : view === 'lessons' ? <Lessons initialPracticeKind={activityRequest?.review ? 'review' : 'lesson'} initialLessonId={activityRequest?.view === 'lessons' ? activityRequest.id : undefined} lessonDrafts={progress.lessonDrafts || {}} onDraftChange={saveLessonDraft} storageAvailable={storageAvailable} storageSaving={storageSaving} suspended={Boolean(modal) || externalSuspended} lessonLearning={progress.lessonLearning || {}} keyStats={progress.keyStats} lessonTheme={settings.lessonTheme} lessonLength={settings.lessonLength} onPreferencesChange={patch => changeSettings(patch, false)} onStop={() => navigate('start')} guideEnabled={settings.guide} onGuideChange={guide => changeSettings({ guide }, false)} lessonProgress={progress.lessonProgress || {}} onComplete={completeLesson} onBack={() => navigate('type')} onStories={() => navigate('stories')} /> : view === 'stories' ? <Stories initialStoryId={activityRequest?.view === 'stories' ? activityRequest.id : undefined} suspended={Boolean(modal) || externalSuspended} storyDrafts={progress.storyDrafts || {}} onDraftChange={saveStoryDraft} storageAvailable={storageAvailable} storageSaving={storageSaving} guideEnabled={settings.guide} onGuideChange={guide => changeSettings({ guide }, false)} storyProgress={progress.storyProgress || {}} onComplete={completeStory} onBack={() => navigate('start')} /> : view === 'challenges' ? <Challenges initialChallenge={sharedChallenge} history={progress.history} onComplete={completeChallenge} onBack={() => navigate('start')} suspended={Boolean(modal) || externalSuspended} /> : view === 'diagnostic' ? <Diagnostic onChooseLesson={id => continueActivity({ view: 'lessons', id })} onBack={() => navigate('start')} suspended={Boolean(modal) || externalSuspended} /> : view === 'library' ? <PracticeLibrary passages={progress.savedPassages || []} onSave={savedPassages => updateProgress(current => ({ ...current, savedPassages: sanitizeSavedPassages(savedPassages) }))} onUse={(text, title) => { navigate('type'); useCustomText(text); setNotice(`Ready to practice: ${title}`); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }} /> : <>
        <section className="intro progress-intro"><div><button className="text-button back-link" onClick={() => navigate('type')}><ArrowLeft size={15} />Back to typing</button><h1 tabIndex={-1}>Your progress</h1><p>Review completed sessions and the keys you miss most.</p></div><div className="backup-buttons"><button className="secondary-button" onClick={exportProgress}><ArrowDownToLine size={15} />Export</button><button className="secondary-button" onClick={() => uploadRef.current.click()}><Upload size={15} />Restore</button></div></section>
        <div className="progress-stats">{[{ icon: Award, value: best === null ? '—' : best, unit: 'wpm', title: 'Best test speed' }, { icon: Target, value: averageAccuracy === null ? '—' : averageAccuracy, unit: '%', title: 'Average accuracy' }, { icon: KeyboardIcon, value: progress.history.length, unit: '', title: 'Sessions completed' }, { icon: Flame, value: currentStreak, unit: 'days', title: 'Current streak' }].map(({ icon: Icon, value, unit, title }) => <div key={title}><Icon size={19} /><strong>{value}<small>{unit}</small></strong><span>{title}</span></div>)}</div>
        <div className="progress-columns"><section className="panel"><div className="section-heading"><h2>Your typing pace</h2><span>{comparableTests.length} comparable tests</span></div>{testHistory.length ? <><label className="comparison-control">Compare the same test<select value={comparisonCategory} onChange={event => setComparison(event.target.value)}>{[...new Map(testHistory.map(run => [run.category, run])).values()].map(run => <option key={run.category} value={run.category}>{run.label} · {run.category.split(':')[2] === 'true' ? 'with punctuation' : 'no punctuation'} · {run.category.split(':')[3] === 'true' ? 'with numbers' : 'no numbers'}</option>)}</select></label><Chart data={comparableTests.slice(0, 20).reverse().map(run => run.wpm)} height={160} /><div className="chart-labels"><span>older</span><span>latest</span></div><p className="panel-note">Same format and settings. Paused attempts are excluded. Typical speed: {medianSpeed} wpm.</p></> : <div className="empty-chart"><Activity size={28} /><h3>No test results yet</h3><p>Finish a typing test to see your pace here.</p><button className="text-button" onClick={() => { navigate('type'); changeSettings({ mode: 'time' }); }}>Take a test<ArrowRight size={15} /></button></div>}</section><section className="panel weak-panel"><div className="section-heading"><h2>Keys to practice</h2><Sparkles size={17} /></div>{weaknesses.length ? <><p>These keys could use some attention.</p><div className="weak-keys">{weaknesses.map(item => <div key={item.key}><kbd>{item.key}</kbd><span>{Math.round((1 - item.errors / item.attempts) * 100)}%</span></div>)}</div><button className="primary-button" onClick={practiceWeak}>Practice these keys<ArrowRight size={15} /></button></> : <><div className="weak-empty"><Hand size={34} /><p>Finish a session and we’ll find the keys worth practicing.</p></div><button className="secondary-button" onClick={practiceWeak}>Try finger practice<ArrowRight size={15} /></button></>}</section></div>
        <KeyboardHeatmap stats={progress.keyStats} />
        <section className="panel history-panel"><div className="section-heading"><h2>Session history</h2><span>{progress.history.length} / 500 saved</span></div>{progress.history.length ? <div className="history-scroll"><table><thead><tr><th>Session</th><th>Speed</th><th>Accuracy</th><th>Mistakes</th><th>When</th></tr></thead><tbody>{progress.history.slice(0, 50).map(run => <tr key={run.id}><td><span className={`mode-dot ${run.mode}`} />{run.label}{run.interrupted && <span className="history-interrupted">Paused practice</span>}</td><td><strong>{run.wpm}</strong><span className="table-unit"> wpm</span></td><td>{run.accuracy}%</td><td>{run.errors}</td><td>{new Date(run.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>)}</tbody></table>{progress.history.length > 50 && <p className="panel-note">Showing the latest 50 sessions. Your export includes all saved sessions.</p>}</div> : <div className="empty-history"><KeyboardIcon size={26} /><p>No sessions yet. Start with thirty seconds.</p></div>}</section>
        <section className="panel reset-progress"><h2>Reset progress</h2><p>Start this profile again. Your settings, saved practice passages, and other profiles stay intact.</p><button className="secondary-button" onClick={() => { setResetError(''); openModal('reset-progress'); }}>Reset progress...</button></section>
        <div className="storage-note"><ShieldCheck size={17} /><p>Your progress stays in this browser. Export a backup before clearing browser data or switching devices. Restoring merges results and keeps the larger per-key totals.</p></div>
      </>}
    </main>
    <input ref={uploadRef} hidden type="file" accept=".json,application/json" onChange={importProgress} aria-label="Restore a Typedo backup" />
    <footer><span><span className="footer-mark">t.</span> Typing workspace</span><div><span><span className="tiny-dot" />{storageSaving ? 'Saving…' : storageAvailable ? 'Saved locally' : 'Session only'}</span><button onClick={() => openModal('help')}>Keyboard shortcuts<ArrowUpRight size={13} /></button></div></footer>

    {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {pauseOpen && !modal && !externalSuspended && !restartRequest && view === 'type' && <PauseDialog onResume={resumeWorkspace} onFinish={() => navigate('start')} onRestart={() => requestRestart()} interrupted={session.interrupted} storageAvailable={storageAvailable} storageSaving={storageSaving} />}
    {restartRequest && !externalSuspended && <ConfirmRestart description={restartRequest.startFresh ? "Start a fresh 30-second test? This replaces your unfinished test with these settings. Completed results stay saved." : undefined} onCancel={() => { setRestartRequest(null); if (!restartRequest.startFresh) resumeWorkspace(); }} onConfirm={() => { const options = restartRequest; setRestartRequest(null); if (options.startFresh) startFreshWorkspace(options.config); else reset(options); }} />}
    {modal === 'storage-reload' && <Modal title="Load saved progress?" onClose={() => setModal(null)}>
      <p>This replaces the work open in this tab with the saved version. Export this tab first to keep any work that could not be saved. You can restore that export afterward to merge completed results.</p>
      <div className="pause-actions"><button data-autofocus className="primary-button" onClick={exportProgress}>Export this tab</button><button className="secondary-button" onClick={onReload}>Load saved version</button><button className="text-button" onClick={() => setModal(null)}>Keep working here</button></div>
    </Modal>}
    {modal === 'reset-progress' && <Modal title="Reset this profile's progress?" onClose={() => { if (!resetBusy) setModal(null); }}>
      <p>Are you sure? This clears completed results, best scores, streaks, key statistics, lesson and story progress, and unfinished attempts for {profileName || 'this profile'}.</p>
      <p>Your settings and saved practice passages stay. Other profiles are not affected. Download a backup first if you might want to restore your progress later. There is no undo without a backup.</p>
      <div className="pause-actions"><button data-autofocus className="primary-button" disabled={resetBusy} onClick={() => setModal(null)}>Keep my progress</button><button className="secondary-button" disabled={resetBusy} onClick={exportProgress}>Download backup first</button><button className="secondary-button" disabled={resetBusy} onClick={resetProfileProgress}>{resetBusy ? 'Resetting...' : 'Yes, reset my progress'}</button></div>
      {resetError && <p className="reset-error" role="alert">{resetError}</p>}
    </Modal>}
    {modal === 'settings' && <Modal title="Practice settings" onClose={() => setModal(null)}>
      <p className="modal-description">Make the text comfortable and choose a manageable goal.</p>
      <Toggle checked={settings.theme === 'dark'} onChange={value => changeSettings({ theme: value ? 'dark' : 'light' }, false)}>Dark theme</Toggle>
      <Toggle checked={settings.guide} onChange={value => changeSettings({ guide: value }, false)}>Show the finger guide</Toggle>
      <Toggle checked={settings.startView === 'type'} onChange={value => changeSettings({ startView: value ? 'type' : 'start' }, false)}>Open directly to Type next time</Toggle>
      <Toggle checked={settings.sound} onChange={value => changeSettings({ sound: value }, false)}>Key sounds</Toggle>
      <Toggle checked={settings.showLiveStats} onChange={value => changeSettings({ showLiveStats: value }, false)}>Show speed while typing</Toggle>
      <Toggle checked={settings.strict} onChange={value => changeSettings({ strict: value })}>Correct each key before continuing in practice</Toggle>
      <div className="reading-settings"><label>Passage text size<select value={settings.passageSize} onChange={event => changeSettings({ passageSize: Number(event.target.value) }, false)}>{[24, 28, 32].map(size => <option key={size} value={size}>{size}px</option>)}</select></label>
      <label>Line spacing<select value={settings.lineHeight} onChange={event => changeSettings({ lineHeight: Number(event.target.value) }, false)}><option value={1.6}>Compact</option><option value={1.9}>Comfortable</option><option value={2.2}>Spacious</option></select></label>
      <label>Daily practice<select value={settings.dailyMinutes} onChange={event => changeSettings({ dailyMinutes: Number(event.target.value) }, false)}>{[3, 5, 10].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label>
      <label>Weekly practice days<select value={settings.weeklyDays} onChange={event => changeSettings({ weeklyDays: Number(event.target.value) }, false)}>{[1,2,3,4,5,6,7].map(value => <option key={value} value={value}>{value} days</option>)}</select></label></div>
      <p className="panel-note">Progress stays in this browser. A missed day never removes completed work.</p><button data-autofocus className="primary-button full-width" onClick={() => setModal(null)}>Done<ArrowRight size={16} /></button>
    </Modal>}
    {modal === 'help' && <Modal title="Keyboard shortcuts" onClose={() => setModal(null)}><div className="shortcut-list">
      <div><span>Pause an exercise</span><kbd>Esc</kbd></div><div><span>Move between controls</span><span><kbd>Tab</kbd> / <kbd>Shift + Tab</kbd></span></div><div><span>Activate the focused action</span><kbd>Enter</kbd></div><div><span>Retry from typing or a result</span><kbd>Shift + Enter</kbd></div><div><span>Correct the previous character</span><kbd>Backspace</kbd></div></div>
      <p>Start or Continue puts you in the typing area. Pause keeps your exact place. Choose Resume typing to return; the next character starts the clock. Restart asks before clearing unfinished work.</p><p>Ctrl/Command+Enter also restarts free typing. In lessons it retries while typing and continues from a completed block. It does not restart stories.</p>
      <h3>Finger placement</h3><p>Rest your fingers on A S D F and J K L ;. The bumps on F and J help you find home. Use either thumb for space and the opposite hand for Shift.</p>
      <details><summary>How scoring works</summary><p>Words per minute uses correct characters, including spaces, divided by five and by active elapsed minutes. Accuracy counts every attempt, including mistakes you corrected. Reading and thinking time count while the exercise is running.</p><p>Leaving a test or pausing it makes that attempt practice. It cannot set a personal best or pass an assessment. Your earlier results stay saved.</p></details>
      <p className="panel-note">Use a physical keyboard. The finger guide follows US QWERTY. Paste, held-key repeats, and composed input are excluded from exercises. The app cannot detect which finger pressed a key.</p>
    </Modal>}
    {modal === 'custom' && <Modal title="Custom practice text" onClose={() => setModal(null)}><p className="modal-description">Practice a passage, a tricky sentence, or a few lines of code.</p><label className="custom-label" htmlFor="custom-text">Practice text <span>{customDraft.length} / 1,500</span></label><textarea id="custom-text" className="custom-editor" value={customDraft} maxLength={1500} onChange={event => setCustomDraft(event.target.value)} placeholder="Type or paste your practice text here…" /><p className="panel-note">Use English letters, numbers, and standard keyboard punctuation. Line breaks become spaces.</p>{customError && <p role="alert" className="form-error">{customError}</p>}<button className="primary-button full-width" onClick={() => { if (!customDraft.trim()) { setCustomError('Add text to practice first.'); return; } if (/[^\x20-\x7e\n\r\t]/.test(customDraft)) { setCustomError('Use standard keyboard characters. Replace curly quotes, accented letters, or emoji.'); return; } useCustomText(customDraft); }}>Use this text<ArrowRight size={16} /></button></Modal>}
  </div>;
}
