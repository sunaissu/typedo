import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CalendarDays, Check, CheckCircle2, Keyboard as KeyboardIcon, Pause, RotateCcw, Search } from 'lucide-react';
import TypingCoach, { GuidanceChoice, WordProgress } from './TypingCoach.jsx';
import { createSession, enterKey, metrics, pauseSession, resumeSession, tick } from './typing.js';
import PauseDialog, { ConfirmRestart } from './SessionControls.jsx';
import { STORIES, applyStoryResult, filterStories, getStoryChapter, sanitizeStoryProgress, storyRoute, storyWordCount } from './stories.js';
import { createStoryDraft, restoreStorySession, sanitizeStoryDrafts } from './storyDrafts.js';
import { formatStoryDate, getStoryFeature, localCalendarDate } from './storySchedule.js';
import './stories.css';

const config = { mode: 'custom' };
const emptyProgress = {};
const emptyTotals = () => ({ chapters: 0, attempts: 0, correctAttempts: 0, correct: 0, elapsed: 0 });

function FeaturedStory({ feature, onStart }) {
  const { story, kind, complete, nextChapterIndex } = feature;
  const scheduled = kind === 'scheduled';
  const dateRange = `${formatStoryDate(feature.weekStart)} - ${formatStoryDate(feature.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return <section className={`story-feature ${complete || feature.allComplete ? 'complete' : ''}`} aria-labelledby="story-feature-title">
    <div className="story-feature-copy">
      <div className="story-feature-label"><CalendarDays size={14} /><span>{scheduled ? "This week's story" : 'From the story library'}</span><span>{dateRange}</span></div>
      <h2 id="story-feature-title">{story ? story.title : 'You finished the collection.'}</h2>
      <p>{story ? story.subtitle : 'Every ending reached. Revisit a favorite below whenever you like.'}</p>
      {!scheduled && story && <p className="story-feature-note">No new edition is scheduled this week. {feature.completedChapters ? 'Pick up where you left off.' : 'There is still a story waiting for you.'}</p>}
      {scheduled && <p className="story-feature-note">A chapter a day, at your own pace. Every chapter is available now.</p>}
    </div>
    <div className="story-feature-next">
      {scheduled && <ol className="story-daily-chapters" aria-label="Suggested daily chapters">{story.chapters.map((chapter, index) => <li key={chapter.title} className={index < feature.completedChapters ? 'complete' : index === nextChapterIndex ? 'current' : ''} aria-current={index === nextChapterIndex ? 'step' : undefined}>
        <span>{formatStoryDate(feature.chapterDates[index], { weekday: 'short', day: 'numeric' })}</span><strong>{index < feature.completedChapters ? <Check size={12} aria-label="Complete" /> : index + 1}</strong>
      </li>)}</ol>}
      {story && (!complete || feature.hasDraft || feature.hasReplay) ? <>
        <span className="story-feature-chapter">{feature.hasDraft ? 'Continue chapter' : 'Your next chapter:'} {nextChapterIndex + 1}. {story.choice?.chapterIndex === nextChapterIndex && !feature.route ? 'Choose an ending' : getStoryChapter(story, nextChapterIndex, feature.route).title}</span>
        <button className="primary-button" onClick={() => onStart(story, nextChapterIndex, true)}>{feature.hasDraft || feature.completedChapters ? 'Continue this story' : 'Begin this story'}<ArrowRight size={15} /></button>
      </> : <>
        <span className="story-feature-finished"><CheckCircle2 size={15} />{story ? "This week's story is finished." : 'All stories complete.'}</span>
        {feature.nextStory ? <><span className="story-feature-chapter">Next from the library: {feature.nextStory.title}</span><button className="primary-button" onClick={() => onStart(feature.nextStory, feature.nextStoryChapterIndex, true)}>{feature.nextStoryChapterIndex || feature.nextStoryHasDraft ? 'Continue another story' : 'Start another story'}<ArrowRight size={15} /></button></> : <a className="text-button" href="#story-library">Browse your stories<ArrowRight size={14} /></a>}
      </>}
    </div>
  </section>;
}

export default function Stories({ storyProgress = emptyProgress, storyDrafts = emptyProgress, onDraftChange, storageAvailable = true, storageSaving = false, onComplete, onBack, guideEnabled, onGuideChange, initialStoryId, suspended = false }) {
  const [bookmarks, setBookmarks] = useState(() => sanitizeStoryProgress(storyProgress));
  const [drafts, setDrafts] = useState(() => sanitizeStoryDrafts(storyDrafts, storyProgress));
  const [selection, setSelection] = useState(null);
  const [session, setSession] = useState(() => createSession(''));
  const [totals, setTotals] = useState(emptyTotals);
  const [localGuide, setLocalGuide] = useState(true);
  const [focused, setFocused] = useState(false);
  const [inputNote, setInputNote] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [filters, setFilters] = useState({ query: '', genre: '', length: '', completion: '', difficulty: '' });
  const inputRef = useRef(null);
  const libraryHeadingRef = useRef(null);
  const nextRef = useRef(null);
  const libraryActionsRef = useRef({});
  const returnFocusRef = useRef(null);
  const viewportRef = useRef(null);
  const caretRef = useRef(null);
  const sessionRef = useRef(session);
  const runRef = useRef(null);
  const recordedRef = useRef(false);
  const completeRef = useRef(onComplete);
  const draftsRef = useRef(drafts);
  const draftChangeRef = useRef(onDraftChange);
  const initialStoryRef = useRef(null);
  completeRef.current = onComplete;
  draftChangeRef.current = onDraftChange;
  const showGuide = guideEnabled ?? localGuide;

  useEffect(() => setBookmarks(sanitizeStoryProgress(storyProgress)), [storyProgress]);
  useEffect(() => {
    const next = sanitizeStoryDrafts(storyDrafts, storyProgress);
    draftsRef.current = next;
    setDrafts(next);
  }, [storyDrafts]);

  function changeDraft(storyId, draft, { render = true, notify = true, flush = false } = {}) {
    if (!draft && !draftsRef.current[storyId]) return;
    const next = { ...draftsRef.current };
    if (draft) next[storyId] = draft;
    else delete next[storyId];
    draftsRef.current = next;
    if (render) setDrafts(next);
    if (notify) draftChangeRef.current?.(storyId, draft, { flush });
  }

  function pauseActiveChapter(render = true, force = false) {
    const run = runRef.current;
    const current = sessionRef.current;
    if (!run || current.status === 'finished' || (!force && !current.attempts)) return;
    const paused = pauseSession(current, config, performance.now());
    sessionRef.current = paused;
    if (render) setSession(paused);
    changeDraft(run.story.id, createStoryDraft(run.story.id, run.chapterIndex, paused), { render, flush: true });
  }

  function resumeActiveChapter() {
    setConfirmRestart(false);
    updateSession(resumeSession(sessionRef.current));
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  function requestRestart() {
    if (!runRef.current) return;
    if (sessionRef.current.attempts && sessionRef.current.status !== 'finished') {
      pauseActiveChapter();
      setConfirmRestart(true);
      return;
    }
    const { story, chapterIndex } = runRef.current;
    startChapter(story, chapterIndex, false, false);
  }

  useEffect(() => {
    if (suspended) pauseActiveChapter();
  }, [suspended]);

  useEffect(() => {
    const pause = () => pauseActiveChapter();
    const onVisibility = () => { if (document.visibilityState === 'hidden') pause(); };
    window.addEventListener('pagehide', pause);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
      pauseActiveChapter(false);
    };
  }, []);

  useEffect(() => {
    const refreshDate = () => {
      const now = new Date();
      setCalendarDate(previous => localCalendarDate(previous) === localCalendarDate(now) ? previous : now);
    };
    const timer = setInterval(refreshDate, 60000);
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshDate);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, []);

  function updateSession(next, saveDraft = false) {
    sessionRef.current = next;
    setSession(next);
    if (!runRef.current) return;
    if (next.status !== 'finished') {
      if (saveDraft) changeDraft(runRef.current.story.id, createStoryDraft(runRef.current.story.id, runRef.current.chapterIndex, next));
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;
    const { story, chapterIndex, route } = runRef.current;
    changeDraft(story.id, null, { notify: false });
    const result = {
      id: next.runId, date: new Date().toISOString(), mode: 'story',
      storyId: story.id, chapterIndex, label: `${story.title} / chapter ${chapterIndex + 1}`,
      category: `story:${story.id}`, elapsed: next.elapsed, ...metrics(next), keyStats: next.keyStats,
      ...(route ? { route } : {}),
    };
    setBookmarks(previous => applyStoryResult(previous, result));
    setTotals(previous => ({
      chapters: previous.chapters + 1, attempts: previous.attempts + next.attempts,
      correctAttempts: previous.correctAttempts + next.correctAttempts,
      correct: previous.correct + metrics(next).correct, elapsed: previous.elapsed + next.elapsed,
    }));
    completeRef.current?.(result);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (sessionRef.current.status === 'running') updateSession(tick(sessionRef.current, config, performance.now()));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session.status === 'finished') nextRef.current?.focus({ preventScroll: true });
  }, [session.status]);

  useEffect(() => {
    if (!selection) return;
    const frame = requestAnimationFrame(() => {
      if (selection.choosing) nextRef.current?.focus({ preventScroll: true });
      else if (sessionRef.current.status !== 'paused') inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selection]);

  useEffect(() => {
    if (selection) return;
    const storyId = returnFocusRef.current;
    returnFocusRef.current = null;
    if (storyId && libraryActionsRef.current[storyId]) libraryActionsRef.current[storyId].focus();
    else libraryHeadingRef.current?.focus({ preventScroll: true });
  }, [selection]);

  useEffect(() => {
    const caret = caretRef.current;
    const viewport = viewportRef.current;
    if (caret && viewport) viewport.scrollTop = Math.max(0, caret.offsetTop - viewport.offsetTop - 60);
  }, [session.typed.length, selection]);

  function startChapter(story, chapterIndex, newVisit = false, resumeDraft = true, chosenRoute) {
    if (newVisit) setTotals(emptyTotals());
    const previousRoute = runRef.current?.story.id === story.id ? runRef.current.route : undefined;
    recordedRef.current = false;
    if (!resumeDraft) changeDraft(story.id, null, { flush: true });
    const draft = resumeDraft && draftsRef.current[story.id]?.chapterIndex === chapterIndex ? draftsRef.current[story.id] : null;
    const branched = story.choice && chapterIndex >= story.choice.chapterIndex;
    const savedRoute = chosenRoute ?? draft?.route ?? (!resumeDraft ? previousRoute : undefined) ?? bookmarks[story.id]?.route;
    if (branched && !draft && !savedRoute) {
      runRef.current = null;
      sessionRef.current = createSession('');
      setSession(sessionRef.current);
      setSelection({ story, chapterIndex, choosing: true });
      setConfirmRestart(false);
      return;
    }
    const route = branched ? storyRoute(story, savedRoute) : undefined;
    runRef.current = { story, chapterIndex, ...(route ? { route } : {}) };
    const next = (draft && restoreStorySession(story.id, draft)) || { ...createSession(getStoryChapter(story, chapterIndex, route).text), runId: crypto.randomUUID(), ...(route ? { route } : {}) };
    sessionRef.current = next;
    setSession(next);
    setSelection({ story, chapterIndex, ...(route ? { route } : {}) });
    setConfirmRestart(false);
    setInputNote('');
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    if (route && !draft) changeDraft(story.id, createStoryDraft(story.id, chapterIndex, next), { flush: true });
  }

  useEffect(() => {
    if (!initialStoryId || initialStoryRef.current === initialStoryId) return;
    const story = STORIES.find(item => item.id === initialStoryId);
    if (!story) return;
    initialStoryRef.current = initialStoryId;
    const progress = sanitizeStoryProgress(storyProgress)[story.id];
    const chapterIndex = draftsRef.current[story.id]?.chapterIndex ?? progress?.replayChapter
      ?? (progress?.completedChapters < story.chapters.length ? progress.completedChapters : 0);
    startChapter(story, chapterIndex, true);
  }, [initialStoryId]);

  function returnToLibrary() {
    returnFocusRef.current = runRef.current?.story.id || selection?.story.id || null;
    pauseActiveChapter();
    sessionRef.current = createSession('');
    setSession(sessionRef.current);
    setSelection(null);
    setConfirmRestart(false);
    setFocused(false);
    runRef.current = null;
  }

  function setGuide(value) {
    setLocalGuide(value);
    onGuideChange?.(value);
  }

  function handleReaderShortcuts(event) {
    if (event.defaultPrevented || event.isComposing || event.nativeEvent?.isComposing || event.ctrlKey || event.metaKey || event.altKey || suspended || event.target.closest('dialog')) return;
    if (event.key === 'Escape' && sessionRef.current.status !== 'finished') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) pauseActiveChapter(true, true);
    } else if (event.key === 'Enter' && event.shiftKey && (event.target === inputRef.current || event.target.closest('.story-result-actions'))) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) requestRestart();
    }
  }

  function handleKey(event) {
    if (event.isComposing || event.nativeEvent?.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== 'Backspace' && !(event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))) return;
    event.preventDefault();
    if (suspended || (event.repeat && event.key !== 'Backspace') || ['finished', 'paused'].includes(sessionRef.current.status)) return;
    setInputNote('');
    const current = sessionRef.current;
    const next = enterKey(current, event.key, config, performance.now());
    updateSession(next, next.typed !== current.typed || next.attempts !== current.attempts);
  }

  const finishedStories = STORIES.filter(story => bookmarks[story.id]?.completedChapters === story.chapters.length).length;
  const completedStories = STORIES.filter(story => bookmarks[story.id]?.completedChapters === story.chapters.length);
  const visibleStories = filterStories(filters, bookmarks, drafts);
  const feature = !selection ? getStoryFeature(bookmarks, calendarDate, drafts) : null;
  if (!selection) return <div className="stories-page">
    <div className="story-intro">
      <div><button className="text-button story-back" onClick={onBack}><ArrowLeft size={14} />Back to free typing</button><div className="eyebrow"><span />TYPE SOMETHING WORTH FINISHING</div><h1 ref={libraryHeadingRef} tabIndex={-1}>Story time<span>.</span></h1><p>Choose a story and start typing. Your place is kept between visits. No time limit or pass score.</p></div>
      <div className="story-library-count"><BookOpen size={24} /><strong>{finishedStories}<span> / {STORIES.length} stories finished</span></strong></div>
    </div>
    <FeaturedStory feature={feature} onStart={startChapter} />
    <div className="story-library-note"><Bookmark size={16} /><p>Three chapters per story. Use <kbd>Tab</kbd> to choose an action and <kbd>Enter</kbd> to open it. Typing starts with the first character; <kbd>Esc</kbd> pauses. A physical keyboard is needed.</p></div>
    <section className="story-bookshelf" aria-labelledby="story-bookshelf-heading">
      <div><h2 id="story-bookshelf-heading">Your bookshelf</h2><p>{finishedStories === STORIES.length ? 'Every ending reached. Your collection is complete.' : finishedStories >= 3 ? `${finishedStories} finished stories. A growing collection of endings.` : finishedStories ? 'Your first ending is on the shelf. Choose another whenever you like.' : 'Your finished stories will appear here. One chapter is a good visit.'}</p></div>
      {completedStories.length > 0 && <ul>{completedStories.map(story => <li key={story.id}><button onClick={() => startChapter(story, drafts[story.id]?.chapterIndex ?? bookmarks[story.id]?.replayChapter ?? 0, true)}><CheckCircle2 size={15} aria-hidden="true" /><span>{story.title}</span><span className="sr-only">{drafts[story.id] || bookmarks[story.id]?.replayChapter !== undefined ? ', continue reading again' : ', read again'}</span></button></li>)}</ul>}
    </section>
    <div className="story-library-heading"><h2>All stories</h2><span>Read any story, any day.</span></div>
    <div className="story-filters" role="search" aria-label="Find a story">
      <label className="story-search">Search stories<div><Search size={17} aria-hidden="true" /><input type="search" placeholder="Title, character, or collection" value={filters.query} onChange={event => setFilters(previous => ({ ...previous, query: event.target.value }))} /></div></label>
      <label>Genre<select value={filters.genre} onChange={event => setFilters(previous => ({ ...previous, genre: event.target.value }))}><option value="">All genres</option>{[...new Set(STORIES.map(story => story.genre))].map(genre => <option key={genre}>{genre}</option>)}</select></label>
      <label>Length<select value={filters.length} onChange={event => setFilters(previous => ({ ...previous, length: event.target.value }))}><option value="">Any length</option><option value="short">Up to 300 words</option><option value="long">Over 300 words</option></select></label>
      <label>Practice level<select value={filters.difficulty} onChange={event => setFilters(previous => ({ ...previous, difficulty: event.target.value }))}><option value="">Any level</option><option>Everyday punctuation</option><option>Longer sentences</option></select></label>
      <label>Your progress<select value={filters.completion} onChange={event => setFilters(previous => ({ ...previous, completion: event.target.value }))}><option value="">All stories</option><option value="in-progress">In progress</option><option value="unstarted">Not started</option><option value="unfinished">Not finished</option><option value="finished">Finished</option></select></label>
    </div>
    <div className="story-filter-summary"><p role="status">{visibleStories.length} {visibleStories.length === 1 ? 'story' : 'stories'} found</p>{Object.values(filters).some(Boolean) && <button className="text-button" onClick={() => setFilters({ query: '', genre: '', length: '', completion: '', difficulty: '' })}>Clear filters</button>}</div>
    {visibleStories.length === 0 && <p className="story-empty">No stories match these filters. Try another genre or clear the filters to see the full library.</p>}
    <div className="story-library" id="story-library">{visibleStories.map(story => {
      const record = bookmarks[story.id];
      const completed = record?.completedChapters || 0;
      const done = completed === story.chapters.length;
      const draft = drafts[story.id];
      const replaying = record?.replayChapter !== undefined;
      const resumeIndex = draft?.chapterIndex ?? record?.replayChapter ?? (done ? 0 : completed);
      const lengths = story.choice?.routes.map(option => storyWordCount(story, option.id));
      return <article className={`story-book ${done ? 'complete' : ''}`} key={story.id}>
        <div className="story-book-top"><span>SHORT STORY {story.motif}</span>{done ? <CheckCircle2 size={17} /> : <BookOpen size={18} />}</div>
        <span className="story-genre">{story.category} · {story.collection}</span><h2>{story.title}</h2><p>{story.subtitle}</p>
        <div className="story-book-meta"><span>{lengths ? `${Math.min(...lengths)}–${Math.max(...lengths)}` : story.wordCount} words</span><span>{story.chapters.length} chapters{story.choice ? ', 2 endings' : ''}</span><span>{story.difficulty}</span></div>
        <div className="story-book-progress" aria-label={`${completed} of ${story.chapters.length} chapters complete`}>{story.chapters.map((chapter, index) => <i key={chapter.title} className={index < completed ? 'complete' : ''} />)}</div>
        <span className="story-book-status">{draft ? `${draft.typed.length} of ${draft.text.length} characters in chapter ${draft.chapterIndex + 1}. ${storageSaving ? 'Saving your place…' : storageAvailable ? 'Your place is saved.' : 'Kept for this visit.'}` : replaying ? `Reading again. Chapter ${resumeIndex + 1} is next.` : done ? 'Story complete. Worth another read?' : completed ? `${completed} chapters complete. Your place is here.` : 'Ready when you are.'}</span>
        {story.choice && (draft?.route || record?.route) && <p className="story-book-ending">{draft ? 'Chosen ending' : 'Last ending'}: {getStoryChapter(story, story.choice.chapterIndex, draft?.route || record.route).title}</p>}
        <button className="primary-button" ref={element => { libraryActionsRef.current[story.id] = element; }} onClick={() => startChapter(story, resumeIndex, true)}>{draft || replaying || (!done && completed) ? `Resume chapter ${resumeIndex + 1}` : done ? 'Read again' : 'Start story'}<ArrowRight size={15} /></button>
      </article>;
    })}</div>
    <p className={`story-storage-note ${storageAvailable ? '' : 'storage-unavailable'}`}>{storageSaving ? 'Saving your place on this device…' : storageAvailable ? 'Your place saves on this device as you type, even in the middle of a chapter.' : 'Device storage is unavailable. Your place lasts for this visit only; export a backup before closing.'} All {STORIES.length} stories are available now. Weekly features run through December 13, 2026; after that, recommendations come from this library.</p>
  </div>;

  const { story, chapterIndex, route } = selection;
  if (selection.choosing) return <div className="stories-page story-reader">
    <button className="text-button story-back" onClick={returnToLibrary}><ArrowLeft size={14} />Story library</button>
    <div className="story-reader-heading"><div><div className="eyebrow"><span />CHOOSE THE FINAL CHAPTER</div><h1>{story.title}<span>.</span></h1></div></div>
    <section className="story-choice" aria-labelledby="story-choice-heading">
      <h2 id="story-choice-heading">{story.choice.prompt}</h2>
      <p>Both choices finish the story. Your choice is kept when you begin the chapter, and you can explore the other ending on a reread.</p>
      <div className="story-choice-options">{story.choice.routes.map((option, index) => <button key={option.id} ref={index === 0 ? nextRef : undefined} className={index === 0 ? 'primary-button' : 'secondary-button'} onClick={() => startChapter(story, chapterIndex, false, false, option.id)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) startChapter(story, chapterIndex, false, false, option.id); } }}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div>
      <p className="story-honest-note"><kbd>Tab</kbd> moves between choices. <kbd>Enter</kbd> begins the selected ending. Choosing an ending does not count as completing it.</p>
      <button className="text-button" onClick={returnToLibrary}>Finish for now</button>
    </section>
  </div>;
  const chapter = getStoryChapter(story, chapterIndex, route);
  const done = session.status === 'finished';
  const storyDone = done && chapterIndex === story.chapters.length - 1;
  const running = session.status === 'running';
  const paused = session.status === 'paused';
  const stats = metrics(session);
  const visitAccuracy = totals.attempts ? Math.round(totals.correctAttempts / totals.attempts * 1000) / 10 : 100;
  const coverage = Math.round(stats.correct / session.text.length * 1000) / 10;
  const continueStory = () => storyDone ? returnToLibrary() : startChapter(story, chapterIndex + 1);
  const relatedStory = storyDone && STORIES.find(item => item.id !== story.id && item.collection === story.collection);
  let characterOffset = 0;

  return <div className="stories-page story-reader" onKeyDownCapture={handleReaderShortcuts}>
    <button className="text-button story-back" onClick={returnToLibrary}><ArrowLeft size={14} />Story library</button>
    <div className="story-reader-heading"><div><div className="eyebrow"><span />{story.category.toUpperCase()}</div><h1>{story.title}<span>.</span></h1></div><span className="story-reader-length">{storyWordCount(story, route)} words / {story.chapters.length} chapters{story.choice ? ' / two endings' : ''}</span></div>
    <ol className="story-chapters" aria-label="Story chapters">{story.chapters.map((item, index) => <li key={item.title} className={index === chapterIndex ? 'current' : index < chapterIndex ? 'complete' : ''} aria-current={index === chapterIndex ? 'step' : undefined}><span>{index < chapterIndex || (index === chapterIndex && done) ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span><strong>{story.choice?.chapterIndex === index && !route ? 'Choose an ending' : getStoryChapter(story, index, route).title}</strong></li>)}</ol>
    <div className="story-chapter-heading"><h2>Chapter {chapterIndex + 1}. {chapter.title}</h2>{!done && <button className="secondary-button" onClick={() => pauseActiveChapter(true, true)}><Pause size={15} />Pause <kbd>Esc</kbd></button>}</div>
    {!done && <GuidanceChoice enabled={showGuide} onChange={setGuide} />}
    <section className={`story-typing-card ${focused ? 'is-focused' : ''}`} aria-label={`Chapter ${chapterIndex + 1} typing practice`}>
      <div className="story-typing-top"><span className="story-session-state" role="status"><i className={running ? 'running' : ''} />{storyDone ? 'THE END' : done ? 'CHAPTER COMPLETE' : paused ? 'PAUSED' : running ? 'TYPING' : session.attempts ? 'READY TO RESUME' : 'READY TO TYPE'}</span><span className="story-accuracy"><strong>{stats.accuracy}%</strong> accuracy</span></div>
      {done ? <div className="story-result" role="status">
        <div className="story-result-icon">{storyDone ? <BookOpen size={29} /> : <Bookmark size={27} />}</div>
        <div className="story-result-copy"><h3>{storyDone ? 'You reached the end.' : 'A good place for a bookmark.'}</h3><p>{storyDone ? `All ${story.chapters.length} chapters complete. ${storageSaving ? 'Saving your story…' : storageAvailable ? 'Your story is saved as finished.' : 'Your progress is kept for this visit.'} ${route ? `Your ending: ${chapter.title}. Reread to try the other ending.` : 'Browse the library whenever you are ready.'}` : story.choice?.chapterIndex === chapterIndex + 1 ? `Chapter ${chapterIndex + 1} is complete. Next, choose what Pip and Tali do before heading home.` : `Chapter ${chapterIndex + 1} is complete. Next up: ${story.chapters[chapterIndex + 1].title}.`}</p>
          <div className="story-result-stats"><span><strong>{stats.accuracy}%</strong>chapter accuracy</span><span><strong>{coverage}%</strong>final text correct</span><span><strong>{stats.errors}</strong>typing mistakes</span></div>
          {storyDone && <p className="story-visit-summary">This visit: {totals.chapters} {totals.chapters === 1 ? 'chapter' : 'chapters'} completed, {visitAccuracy}% accuracy including saved attempts.</p>}
        </div>
        <div className="story-result-actions"><button className="primary-button" ref={nextRef} onClick={continueStory} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) continueStory(); } }}>{storyDone ? 'Choose another story' : 'Next chapter'}<ArrowRight size={15} /></button><button className="text-button" onClick={returnToLibrary}>Finish for now</button>{storyDone ? <button className="text-button" onClick={() => startChapter(story, 0, true)}><RotateCcw size={13} />Read this story again</button> : <button className="text-button" onClick={requestRestart}><RotateCcw size={13} />Retry chapter <kbd>Shift+Enter</kbd></button>}</div>
      </div> : <div className={showGuide ? 'coached-workspace' : ''}>
        <div className={`story-type-surface ${!focused && running ? 'unfocused' : ''}`} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
          <div className="words-window story-words-window" ref={viewportRef} aria-hidden="true"><div className="words-text">{session.text.split(' ').map((word, wordIndex, words) => {
            const startIndex = characterOffset;
            characterOffset += word.length + 1;
            return <span className="word" key={wordIndex}>{[...word + (wordIndex < words.length - 1 ? ' ' : '')].map((char, charIndex) => {
              const index = startIndex + charIndex;
              const typed = session.typed[index];
              const active = index === session.typed.length;
              return <span key={charIndex} ref={active ? caretRef : undefined} className={`char ${typed !== undefined ? typed === char ? 'correct' : 'incorrect' : ''} ${active ? 'current' : ''}`}>{char}</span>;
            })}</span>;
          })}</div></div>
          <textarea ref={inputRef} className="typing-input" aria-label={`${story.title}, chapter ${chapterIndex + 1} typing input`} aria-describedby="story-input-instructions story-accessible-prompt" value="" readOnly={paused || suspended} onChange={() => {}} onKeyDown={handleKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPaste={event => { event.preventDefault(); setInputNote('Type each key yourself. Pasting is disabled.'); }} onDrop={event => event.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="none" />
          <p className="sr-only" id="story-accessible-prompt">Text to type: {session.text}</p>
          {!focused && !paused && <div className="focus-prompt"><KeyboardIcon size={17} /><button className="secondary-button" onClick={() => inputRef.current?.focus({ preventScroll: true })}>Resume typing</button></div>}
        </div>
        {showGuide && <TypingCoach next={session.text[session.typed.length]} />}
      </div>}
      <WordProgress text={session.text} typed={session.typed} />
      <div className="story-typing-bottom"><span id="story-input-instructions" role={inputNote ? 'status' : undefined}>{inputNote || (done ? storageSaving ? 'Saving your completed chapter…' : storageAvailable ? 'Your completed chapter is saved on this device.' : 'Your completed chapter is kept for this visit only.' : paused ? 'Your place is kept. Resume when you are ready.' : running || session.attempts ? `${session.typed.length} / ${session.text.length} characters. Backspace to correct; Esc to pause.` : 'Type the first character to begin. Include capitals and punctuation. Tab moves to controls.')}</span>{!done && <button className="text-button" onClick={requestRestart}><RotateCcw size={13} />Restart chapter <kbd>Shift+Enter</kbd></button>}</div>
    </section>
    <div className="story-reader-footer"><span>{done ? <><kbd>enter</kbd> {storyDone ? 'choose another story' : 'next chapter'}</> : <><kbd>backspace</kbd> correct a mistake</>}</span><span className={`story-save-status ${storageAvailable ? '' : 'storage-unavailable'}`}><Bookmark size={13} />{storageSaving ? 'Saving your place…' : storageAvailable ? done ? 'Chapter saved on this device' : session.attempts ? 'Your place is saved on this device' : 'Your place saves as you type' : 'Device storage unavailable. Kept for this visit only.'}</span></div>
    {!done && <p className="story-honest-note">Mistakes count, even after you correct them. There is no pass score, so the story keeps moving.</p>}
    {relatedStory && <aside className="story-related"><p>More from {story.collection}: {relatedStory.subtitle}</p><button className="secondary-button" onClick={() => startChapter(relatedStory, drafts[relatedStory.id]?.chapterIndex ?? bookmarks[relatedStory.id]?.replayChapter ?? ((bookmarks[relatedStory.id]?.completedChapters || 0) % relatedStory.chapters.length), true)}>Open {relatedStory.title}<ArrowRight size={15} /></button></aside>}
    {!suspended && (confirmRestart ? <ConfirmRestart onCancel={resumeActiveChapter} onConfirm={() => startChapter(story, chapterIndex, false, false)} /> : paused && <PauseDialog onResume={resumeActiveChapter} onFinish={returnToLibrary} onRestart={requestRestart} storageAvailable={storageAvailable} storageSaving={storageSaving} />)}
  </div>;
}
