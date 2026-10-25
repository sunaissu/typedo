import { Award, Check } from 'lucide-react';
import { backupReminderDue, getMilestones } from './milestones.js';

export default function Milestones({ progress, onSettingsChange, onProgress }) {
  const milestones = getMilestones(progress);
  const accents = [{ id: 'blue', title: 'Blue' }, ...milestones.filter(item => item.earned && item.accent).map(item => ({ id: item.accent, title: item.accent === 'forest' ? 'Forest' : 'Plum' }))];
  return <>
    <section className="home-panel milestones" aria-labelledby="milestones-title"><div className="home-panel-heading"><Award size={20} /><h2 id="milestones-title">Milestones</h2></div>
      <ul>{milestones.map(item => <li key={item.id} className={item.earned ? 'earned' : ''}><span aria-label={item.earned ? 'Completed' : 'Not yet completed'}>{item.earned ? <Check size={18} /> : <span className="milestone-empty" />}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ul>
      <label className="home-inline-field">Your color accent<select value={progress.settings?.accent || 'blue'} onChange={event => onSettingsChange?.({ accent: event.target.value })}>{accents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}{!accents.some(item => item.id === progress.settings?.accent) && progress.settings?.accent && <option value={progress.settings.accent}>Saved accent</option>}</select></label>
      <p className="home-small-note">Milestones never lock lessons or stories. Your earned progress stays yours after a break.</p>
    </section>
    {backupReminderDue(progress) && <section className="home-panel backup-reminder" aria-label="Keep a backup"><h2>Keep a copy of your progress</h2><p>Your work is saved in this browser. A backup lets you restore it if you change devices or clear browser data.</p><div className="pause-actions"><button className="secondary-button" onClick={onProgress}>Open backup controls</button><button className="text-button" onClick={() => onSettingsChange?.({ backupReminderDismissedAt: new Date().toISOString() })}>Remind me next week</button></div></section>}
  </>;
}
