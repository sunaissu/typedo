import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, Keyboard, Library, ShieldCheck, Sparkles } from 'lucide-react';
import { getPracticeRecommendation } from './adaptivePractice.js';
import { getHomeDrafts, getHomeRecommendation, getPracticeSummary } from './home.js';
import './home.css';
import OfflineStatus from './OfflineStatus.jsx';
import Milestones from './Milestones.jsx';

export default function Start({ hasPractice, lessonStarted, courseComplete, reviewCount = 0, storageAvailable, storageSaving = false, onLessons, onTest, onStories, onProgress, onRestore, progress = {}, onContinueActivity, onPracticeWeak, onSettingsChange, onPracticeLibrary, onDiagnostic, onIntroStory }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const recommendation = getHomeRecommendation(progress);
  const otherDrafts = getHomeDrafts(progress).filter(draft => draft.view !== recommendation.view || draft.id !== recommendation.id);
  const summary = getPracticeSummary(progress);
  const weak = getPracticeRecommendation(progress.keyStats || {}) || { keys: [] };
  const settings = progress.settings || {};
  const dailyMinutes = settings.dailyMinutes || 5;
  const weeklyDays = settings.weeklyDays || 3;
  const remaining = Math.max(0, dailyMinutes - summary.todayMinutes);
  const continueActivity = activity => {
    if (onContinueActivity) onContinueActivity(activity);
    else if (activity.view === 'stories') onStories?.();
    else if (activity.view === 'type') onTest?.();
    else onLessons?.();
  };

  return <div className="start-page home-page">
    <section className="intro start-intro">
      <div>
        <div className="eyebrow"><span />YOUR TYPING PRACTICE</div>
        <h1 ref={heading} tabIndex={-1}>{hasPractice ? recommendation.draft ? 'Pick up where you left off.' : 'Your next step.' : 'What would you like to do?'}</h1>
        <p>{hasPractice ? 'Your next step is ready. A little practice is enough for today.' : 'Check your speed, learn the keys, or enjoy a story. No account or setup needed.'}</p>
        <p className="start-device"><Keyboard size={16} />Use Tab to move and Enter to choose. Practice needs a physical keyboard.</p>
      </div>
    </section>

    {hasPractice && <section className="start-lesson home-continue" aria-labelledby="home-continue-title">
      <div className="start-label"><BookOpen size={18} />{recommendation.draft ? 'YOUR UNFINISHED PRACTICE' : recommendation.review ? 'READY FOR A REVIEW' : 'YOUR NEXT STEP'}</div>
      <h2 id="home-continue-title">{recommendation.title}</h2>
      <p className="home-position">{recommendation.detail}</p>
      {recommendation.preview && <p className="home-draft-preview">{recommendation.preview}</p>}
      <p>{recommendation.reason}</p>
      <button className="primary-button" onClick={() => continueActivity(recommendation)}>{recommendation.action}<ArrowRight size={17} /></button>
      <span className="start-detail">{recommendation.draft ? storageSaving ? 'Saving your place…' : storageAvailable ? 'Your place is saved in this browser.' : 'Your place is kept for this visit. Export a backup before leaving.' : 'Start typing when the passage opens. Escape pauses your practice.'}</span>
    </section>}

    <div className="home-choice-grid" aria-label="Choose an activity">
      <section className={hasPractice ? 'home-choice' : 'home-choice home-choice-primary'}><Clock3 size={24} /><h2>Test my speed</h2><p>A 30-second test. Start typing when you are ready; your first key starts the clock.</p><button className={hasPractice ? 'secondary-button' : 'primary-button'} onClick={onTest}>Test my speed<ArrowRight size={16} /></button></section>
      <section className="home-choice"><Keyboard size={24} /><h2>Learn to type</h2><p>{courseComplete ? 'Revisit any lesson, with finger hints whenever you need them.' : lessonStarted ? 'Continue the course at your own pace, with no countdown.' : 'Start with the home row and a guide to the right fingers. No time limit.'}</p><button className="secondary-button" onClick={onLessons}>{courseComplete ? 'Review lessons' : lessonStarted ? 'Continue lessons' : 'Learn to type'}<ArrowRight size={16} /></button></section>
      <section className="home-choice"><BookOpen size={24} /><h2>Practise with a story</h2><p>{hasPractice ? 'Choose a story from the library. Your place is saved as you type.' : 'Begin a short story about an office with an unusual manager. Pause whenever you like.'}</p><button className="secondary-button" onClick={hasPractice ? onStories : onIntroStory || onStories}>Practise with a story<ArrowRight size={16} /></button></section>
    </div>
    {onDiagnostic && <button className="text-button home-diagnostic-link" onClick={onDiagnostic}>Not sure? Find a starting point<ArrowRight size={15} /></button>}

    {otherDrafts.length > 0 && <details className="home-unfinished">
      <summary>Other unfinished practice <span>({otherDrafts.length})</span></summary>
      <p>Most recent first. Choose any activity to return to its exact place.</p>
      <ul>{otherDrafts.map(draft => <li key={`${draft.view}:${draft.id}`}>
        <div><strong>{draft.title}</strong><p>{draft.detail}</p>{draft.preview && <p className="home-draft-preview">{draft.preview}</p>}<time dateTime={draft.updatedAt}>Last practised {new Date(draft.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
        <button className="secondary-button" onClick={() => continueActivity(draft)} aria-label={`${draft.action}: ${draft.title}`}>{draft.action}<ArrowRight size={15} /></button>
      </li>)}</ul>
    </details>}

    {hasPractice && <details className="home-more"><summary>Practice plan, progress and more</summary>
    <div className="home-plan-grid">
      <section className="home-panel" aria-labelledby="home-plan-title">
        <div className="home-panel-heading"><Clock3 size={20} /><h2 id="home-plan-title">Today's practice</h2></div>
        <label className="home-inline-field">Time for practice
          <select value={dailyMinutes} onChange={event => onSettingsChange?.({ dailyMinutes: Number(event.target.value) })}>
            {[3, 5, 10].map(minutes => <option key={minutes} value={minutes}>About {minutes} minutes</option>)}
          </select>
        </label>
        <p className="home-plan-note">{remaining === 0 ? 'You reached your time goal. Finish here, or choose something you enjoy.' : summary.todayMinutes.toFixed(1) + ' of ' + dailyMinutes + ' minutes from completed practice today. Pause time does not count.'}</p>
        <progress max={dailyMinutes} value={Math.min(dailyMinutes, summary.todayMinutes)} aria-label="Today's completed practice time" />
        <ol className="home-plan-list">
          <li><div><strong>Warm up</strong><span>{weak.keys?.length ? weak.description : 'Find a steady rhythm with familiar keys.'}</span></div><button className="text-button" onClick={weak.keys?.length && onPracticeWeak ? onPracticeWeak : onLessons}>Practise<ArrowRight size={15} /></button></li>
          <li><div><strong>{reviewCount ? 'Revisit a lesson' : 'Continue learning'}</strong><span>{reviewCount ? reviewCount + (reviewCount === 1 ? ' review is ready when you are.' : ' reviews are ready when you are.') : 'One lesson block is a useful stopping point.'}</span></div><button className="text-button" onClick={onLessons}>Lessons<ArrowRight size={15} /></button></li>
          <li><div><strong>A story, if you have time</strong><span>Enjoy a chapter or pause at any point.</span></div><button className="text-button" onClick={onStories}>Stories<ArrowRight size={15} /></button></li>
        </ol>
        <p className="home-small-note">This is a suggestion, not a checklist. Completed sessions count toward your time goal; unfinished practice counts when you finish it.</p>
      </section>

      <section className="home-panel" aria-labelledby="home-week-title">
        <div className="home-panel-heading"><CalendarDays size={20} /><h2 id="home-week-title">Your week</h2></div>
        <label className="home-inline-field">Practice day goal
          <select value={weeklyDays} onChange={event => onSettingsChange?.({ weeklyDays: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map(days => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'} a week</option>)}
          </select>
        </label>
        <p className="home-week-count"><strong>{summary.practicedDays}</strong> of {weeklyDays} practice days</p>
        <ul className="home-week-days" aria-label="Practice days this week, starting Monday">{summary.days.map(day => <li key={day.key} className={(day.practiced ? 'practiced ' : '') + (day.today ? 'today' : '')} aria-label={day.label + (day.today ? ', today' : '') + ': ' + (day.practiced ? 'practised' : 'no completed practice')}><span>{day.label}</span><span className="home-day-dot" aria-hidden="true">{day.practiced ? <Check size={16} /> : '·'}</span></li>)}</ul>
        <p>{summary.practicedDays >= weeklyDays ? 'You met your weekly goal. Your progress is yours to keep.' : 'Choose the days that work for you. A missed day does not undo what you have learned.'}</p>
        <div className="home-week-summary"><span><strong>{Math.round(summary.weekMinutes)}</strong> minutes completed</span><span><strong>{summary.chapters}</strong> {summary.chapters === 1 ? 'chapter' : 'chapters'} completed</span></div>
        <button className="text-button" onClick={onProgress}>View your progress<ArrowRight size={15} /></button>
      </section>
    </div>

    <section className="home-evidence home-panel" aria-labelledby="home-evidence-title">
      <div className="home-panel-heading"><Sparkles size={20} /><h2 id="home-evidence-title">A useful measure of progress</h2></div>
      {summary.comparable ? <><p>Your last {summary.comparable.recentCount} matching <strong>{summary.comparable.label}</strong> results have a typical accuracy of <strong>{summary.comparable.accuracy.toFixed(1)}%</strong> and speed of <strong>{Math.round(summary.comparable.wpm)} words per minute</strong>.</p><p className="home-small-note">{summary.comparable.accuracyChange !== null ? 'Typical accuracy ' + (summary.comparable.accuracyChange > 0 ? 'rose' : summary.comparable.accuracyChange < 0 ? 'fell' : 'stayed the same') + (summary.comparable.accuracyChange ? ' by ' + Math.abs(summary.comparable.accuracyChange).toFixed(1) + ' percentage points' : '') + ' compared with the previous three matching tests. ' : ''}Typical means the median. Only uninterrupted tests with the same format and settings are compared. {summary.comparable.count} matching results available.</p></> : <p>Complete three tests with the same format and settings to see a typical result here. Lessons and stories are useful practice too; their difficulty varies, so they are kept out of this comparison.</p>}
    </section>

    <button className="text-button" onClick={onPracticeLibrary || onLessons}><Library size={17} />Browse practice library<ArrowRight size={15} /></button>
    <Milestones progress={progress} onSettingsChange={onSettingsChange} onProgress={onProgress} />
    <OfflineStatus />
    </details>}
    <div className="start-notes">
      <p><ShieldCheck size={17} /><span>{storageSaving ? 'Saving your progress in this browser…' : storageAvailable ? 'No account needed. Progress stays in this browser. Export a backup from Progress to keep a copy or move to another device.' : 'Browser saving is unavailable or paused. You can practise, then export your progress before closing this page.'}</span></p>
      <button className="text-button" onClick={hasPractice ? onProgress : onRestore}>{hasPractice ? 'Back up or restore progress' : 'Restore progress from a backup'}<ArrowRight size={14} /></button>
    </div>
  </div>;
}
