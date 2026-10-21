import { Keyboard as KeyboardIcon, ArrowUp, CornerDownLeft, Delete } from 'lucide-react';
import { FINGERS, keyGuide } from './typing.js';

const ROWS = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'delete'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter'],
  ['Left Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Right Shift'],
];

function Hand({ side, active }) {
  const ids = side === 'left' ? ['lp', 'lr', 'lm', 'li'] : ['ri', 'rm', 'rr', 'rp'];
  return <div className={`hand ${side}`} aria-hidden="true">
    <div className="fingers">{ids.map(id => <i key={id} className={`finger ${id === active ? 'lit' : ''} finger-${id}`} style={{ '--finger': FINGERS.find(f => f.id === id).color }} />)}</div>
    <div className="palm" /><i className={`thumb ${active === 'thumb' ? 'lit' : ''}`} />
    <span>{side} hand</span>
  </div>;
}

export default function Keyboard({ next, running, finished, onHide }) {
  const guide = keyGuide(next || ' ');
  return <section className="guide-card">
    <div className="section-heading"><div><KeyboardIcon size={16} /><h2>Find the right finger</h2><span className="tag">QWERTY</span></div><button className="text-button" onClick={onHide}>Hide guide</button></div>
    <div className="guide-body">
      <div className="keyboard-area">
        <div className="keyboard" aria-label="QWERTY keyboard finger guide">
          {ROWS.map((row, i) => <div className={`key-row row-${i}`} key={i}>{row.map(key => {
            const modifier = key.length > 1;
            const finger = modifier ? null : keyGuide(key).finger;
            const selected = !finished && (guide.base === key || guide.shift === key);
            return <div key={key} className={`key ${modifier ? 'modifier' : ''} ${selected ? 'next-key' : ''} ${key === 'f' || key === 'j' ? 'home-key' : ''}`} style={{ '--finger': finger?.color || '#839282' }} title={finger ? `${key.toUpperCase()}: ${finger.label}` : key}>
              {key === 'delete' ? <Delete size={15} /> : key === 'enter' ? <CornerDownLeft size={15} /> : key.includes('Shift') ? <ArrowUp size={15} /> : key}
            </div>;
          })}</div>)}
          <div className="key-row last-row"><div className="key modifier">ctrl</div><div className="key modifier">alt</div><div className={`key space ${guide.base === ' ' && !finished ? 'next-key' : ''}`} style={{ '--finger': '#839282' }}>space</div><div className="key modifier">alt</div><div className="key modifier">ctrl</div></div>
        </div>
        <div className="finger-legend">{FINGERS.filter(f => f.id !== 'thumb').map(f => <span key={f.id}><i style={{ background: f.color }} />{f.short}</span>)}</div>
      </div>
      <div className="finger-coach">
        <div className="next-instruction"><span className="next-key-label">{finished ? 'COMPLETE' : 'NEXT KEY'}</span><div><kbd style={{ '--finger': guide.finger.color }}>{finished ? '✓' : guide.base === ' ' ? '␣' : next}</kbd><span>{finished ? 'Session complete' : guide.finger.label}<small>{finished ? 'Restart for another session.' : guide.shift ? `+ ${guide.shift}` : running ? 'Use the highlighted finger' : 'Rest your fingers on ASDF JKL;'}</small></span></div></div>
        <div className="hands"><Hand side="left" active={!finished ? guide.finger.id : ''} /><Hand side="right" active={!finished ? guide.finger.id : ''} /></div>
      </div>
    </div>
    <div className="guide-note"><span className="tiny-dot" />Follow the highlighted key and finger. Return to the home row after each reach.</div>
  </section>;
}
