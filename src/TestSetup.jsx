import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

function TargetField({ timed, value, onChange }) {
  const presets = timed ? [15, 30, 60, 120] : [10, 25, 50, 100];
  const [custom, setCustom] = useState(!presets.includes(value));
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(value)); setError(''); if (!presets.includes(value)) setCustom(true); }, [value]);
  const min = timed ? 15 : 10, max = timed ? 900 : 1000;
  return <div className="setup-field">
    <label><span>{timed ? 'Duration' : 'Word target'}</span><select aria-label={timed ? 'Duration' : 'Word target'} value={custom ? 'custom' : value} onChange={event => {
      setError(''); setCustom(event.target.value === 'custom');
      if (event.target.value !== 'custom') onChange(Number(event.target.value));
    }}>{presets.map(n => <option key={n} value={n}>{n} {timed ? 'seconds' : 'words'}</option>)}<option value="custom">Custom...</option></select></label>
    {custom && <form className="custom-target" onSubmit={event => {
      event.preventDefault(); const n = Number(draft);
      if (!Number.isInteger(n) || n < min || n > max) { setError(`Enter a whole number from ${min}-${max}.`); return; }
      onChange(n); setError('');
    }} noValidate>
      <label><span>{timed ? 'Custom seconds' : 'Custom words'}</span><input type="number" min={min} max={max} step="1" value={draft} aria-invalid={!!error} aria-describedby="target-help" onChange={event => setDraft(event.target.value)} /></label>
      <button className="secondary-button" type="submit">Apply</button>
      <small id="target-help" role={error ? 'alert' : undefined}>{error || `${min}-${max} ${timed ? 'seconds' : 'words'}. Apply to use this target.`}</small>
    </form>}
  </div>;
}

export default function TestSetup({ settings, onChange }) {
  const timed = settings.mode === 'time';
  const options = [['capitalization', 'Capitalization'], ['punctuation', 'Punctuation'], ['numbers', 'Numbers'], ['symbols', 'Symbols']];
  const included = options.filter(([key]) => settings[key]).map(([, label]) => label.toLowerCase());
  return <details className="session-setup">
    <summary className="setup-heading"><SlidersHorizontal size={16} /><strong>Customize test</strong><span>{timed ? `${settings.duration} seconds` : `${settings.wordCount} words`} / {included.join(', ') || 'lowercase words'}</span></summary>
    <div className="setup-fields">
      <label className="setup-field"><span>Test format</span><select aria-label="Test format" value={settings.mode} onChange={event => onChange({ mode: event.target.value })}><option value="time">Timed test</option><option value="words">Word target</option></select></label>
      <TargetField key={settings.mode} timed={timed} value={timed ? settings.duration : settings.wordCount} onChange={value => onChange(timed ? { duration: value } : { wordCount: value })} />
      <fieldset className="setup-options"><legend>Include in text</legend>{options.map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={event => onChange({ [key]: event.target.checked })} /><span>{label}</span></label>)}</fieldset>
    </div>
    <p className="panel-note">Changes start a separate test. Your unfinished attempt stays saved. Text size, spacing, sounds and live speed are in Practice settings.</p>
  </details>;
}
