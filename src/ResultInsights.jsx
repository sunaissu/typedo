import { useState } from 'react';
import { attemptMistakes, keyEvidence, keyLabel, resultCardLines } from './resultInsights.js';
import './resultInsights.css';

export function ResultInsights({ session, stats, settings, onPractice }) {
  const mistakes = attemptMistakes(session.keyStats);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  async function download() {
    setError(''); setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200; canvas.height = 720;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image downloads are unavailable in this browser.');
      context.fillStyle = '#0a1020'; context.fillRect(0, 0, 1200, 720);
      context.fillStyle = '#68a7ff'; context.fillRect(64, 56, 56, 6);
      const lines = resultCardLines(stats, settings, session.interrupted);
      const positions = [108, 250, 326, 386, 462, 506, 576, 654];
      lines.forEach((line, index) => {
        context.font = `${index === 1 ? 'bold 110' : index === 2 ? 'bold 44' : index === 0 ? 'bold 32' : '26'}px sans-serif`;
        context.fillStyle = index === 1 ? '#68a7ff' : index === 7 ? '#a0b2ce' : '#eef4ff';
        context.fillText(line, 64, positions[index], 1072);
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The result image could not be created. Try again.');
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'typedo-result.png'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.message || 'The result image could not be downloaded.'); }
    finally { setDownloading(false); }
  }
  return <section className="result-insights" aria-label="Result feedback">
    <h3>{mistakes.length ? 'What to practise next' : 'A clean attempt'}</h3>
    {mistakes.length ? <><p>Most missed target keys in this attempt. Correcting a mistake does not remove it from the count.</p>
      <ul className="attempt-mistakes">{mistakes.map(item => <li key={item.key}><kbd>{keyLabel(item.key)}</kbd><span>{item.errors} missed / {item.attempts} attempts</span></li>)}</ul>
      <button className="secondary-button" onClick={onPractice}>Practise these mistakes</button></> : <p>No missed keys in this attempt. Try another passage to see how consistently you can keep that accuracy.</p>}
    <div className="result-download"><button className="text-button" disabled={downloading} onClick={download}>{downloading ? 'Creating image...' : 'Download result card'}</button><small>PNG image. No name, passage text, or profile data.</small></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}

const rows = ['1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./', ' '];
export function KeyboardHeatmap({ stats }) {
  const [capitals, setCapitals] = useState(false);
  const evidence = new Map(keyEvidence(stats).map(item => [item.key, item]));
  const shifted = { '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?' };
  const displayRows = ['`', ...rows.slice(0, 1)].join('');
  return <section className="panel keyboard-heatmap" aria-label="Keyboard accuracy heatmap"><div className="section-heading"><h2>Keyboard accuracy</h2><button className="text-button" aria-pressed={capitals} onClick={() => setCapitals(!capitals)}>Shifted keys</button></div>
    <p className="panel-note">Completed sessions only. Each key needs 10 attempts before it receives a colour. Capitals and lowercase are counted separately.</p>
    <div className="heatmap-scroll"><div className="heatmap-keys">{[displayRows, ...rows.slice(1)].map((row, index) => <div className="heatmap-row" key={index}>{[...row].map(base => {
      const key = capitals ? base === '`' ? '~' : shifted[base] || base.toUpperCase() : base;
      const item = evidence.get(key), enough = item?.attempts >= 10;
      const band = !enough ? 'unknown' : item.accuracy >= 95 ? 'steady' : item.accuracy >= 80 ? 'building' : 'practice';
      const detail = !item ? 'Not enough practice yet: 0 attempts' : `${item.accuracy}% accuracy, ${item.errors} missed in ${item.attempts} attempts${enough ? '' : '. Not enough practice yet'}`;
      return <div tabIndex={0} className={`heatmap-key ${band} ${base === ' ' ? 'space' : ''}`} key={key} aria-label={`${keyLabel(key)}: ${detail}`} title={`${keyLabel(key)}: ${detail}`}><kbd>{keyLabel(key).replace('Capital ', '')}</kbd><small>{enough ? `${item.accuracy}%` : `${item?.attempts || 0}/10`}</small></div>;
    })}</div>)}</div></div>
    <p className="heatmap-legend"><span>95-100%: steady</span><span>80-94.9%: building</span><span>Below 80%: practise</span><span>Grey: fewer than 10 attempts</span></p>
  </section>;
}
