import { SlidersHorizontal } from 'lucide-react';

export default function TestSetup({ settings, onChange }) {
  const timed = settings.mode === 'time';
  return <section className="session-setup" aria-label="Session setup">
    <div className="setup-heading"><SlidersHorizontal size={14} /><span>SESSION SETUP</span></div>
    <div className="setup-fields">
      <label className="setup-field"><span>Test format</span><select value={settings.mode} onChange={event => onChange({ mode: event.target.value })}>
        <option value="time">Timed test</option><option value="words">Word target</option>
      </select></label>
      <label className="setup-field"><span>{timed ? 'Duration' : 'Word target'}</span><select value={timed ? settings.duration : settings.wordCount} onChange={event => onChange(timed ? { duration: Number(event.target.value) } : { wordCount: Number(event.target.value) })}>
        {(timed ? [15, 30, 60, 120] : [10, 25, 50, 100]).map(value => <option key={value} value={value}>{value} {timed ? 'seconds' : 'words'}</option>)}
      </select></label>
      <fieldset className="setup-options"><legend>Include in text</legend>
        <label><input type="checkbox" checked={settings.numbers} onChange={event => onChange({ numbers: event.target.checked })} /><span>Numbers</span></label>
        <label><input type="checkbox" checked={settings.punctuation} onChange={event => onChange({ punctuation: event.target.checked })} /><span>Punctuation</span></label>
      </fieldset>
    </div>
  </section>;
}
