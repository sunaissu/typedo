import { Hand, Keyboard as KeyboardIcon } from 'lucide-react';
import { FINGERS, keyGuide } from './typing.js';

export function GuidanceChoice({ enabled, onChange }) {
  return <div className="guidance-choice" role="group" aria-label="Typing assistance">
    <span>YOUR PACE</span><div>
      <button type="button" aria-pressed={enabled} onClick={() => onChange(true)}><Hand size={14} />Beginner</button>
      <button type="button" aria-pressed={!enabled} onClick={() => onChange(false)}><KeyboardIcon size={14} />Independent</button>
    </div><small>{enabled ? 'See which finger to use' : 'Type without the hands'}</small>
  </div>;
}

function CoachHand({ side, active, shift, next }) {
  const fingers = side === 'left' ? ['lp', 'lr', 'lm', 'li'] : ['ri', 'rm', 'rr', 'rp'];
  const homes = side === 'left' ? ['A', 'S', 'D', 'F'] : ['J', 'K', 'L', ';'];
  const heights = side === 'left' ? [45, 62, 70, 58] : [58, 70, 62, 45];
  const thumbActive = active === 'thumb';
  return <svg className="coach-hand" viewBox="0 0 150 155" aria-hidden="true">
    <path className="coach-palm" d="M22 77 Q20 71 28 71 H111 Q118 71 118 79 V110 Q118 141 88 141 H58 Q28 141 25 112 Z" />
    {fingers.map((id, index) => {
      const lit = active === id;
      const isShift = shift === id;
      return <g key={id} data-finger={id} className={`coach-digit ${lit ? 'active' : ''} ${isShift ? 'shift-active' : ''}`} style={{ '--digit-color': FINGERS.find(f => f.id === id).color }}>
        <rect x={22 + index * 25} y={79 - heights[index]} width="21" height={heights[index]} rx="10" />
        <text x={32.5 + index * 25} y={98 - heights[index]}>{lit ? next : isShift ? '↑' : homes[index]}</text>
        {lit && <circle cx={32.5 + index * 25} cy={68} r="3" className="coach-active-dot" />}
      </g>;
    })}
    <g className={`coach-digit coach-thumb ${thumbActive ? 'active' : ''}`} style={{ '--digit-color': 'var(--accent)' }} transform={side === 'left' ? 'translate(119 90) rotate(32)' : 'translate(20 90) rotate(-32)'}>
      <rect x="-10" y="0" width="21" height="44" rx="10" /><text x="0" y="19">{thumbActive ? '␣' : ''}</text>
    </g>
    <text className="coach-hand-label" x="73" y="154">{side.toUpperCase()} HAND</text>
  </svg>;
}

export default function TypingCoach({ next }) {
  const guide = keyGuide(next || ' ');
  const keyLabel = guide.base === ' ' ? 'Space' : next;
  const shiftFinger = guide.shift === 'Left Shift' ? 'lp' : guide.shift === 'Right Shift' ? 'rp' : null;
  return <aside className="typing-coach" aria-label="Live finger guide">
    <div className="coach-heading"><span className="tiny-dot" />YOUR NEXT MOVE</div>
    <div className="coach-cue"><kbd>{keyLabel}</kbd><div><strong>{guide.finger.label}</strong><span>{guide.shift ? `Hold ${guide.shift} with your pinky` : guide.base === ' ' ? 'A little space. Then the next word.' : 'Press the key with this finger'}</span></div></div>
    <div className="coach-hands"><CoachHand side="left" active={guide.finger.id} shift={shiftFinger} next={keyLabel} /><CoachHand side="right" active={guide.finger.id} shift={shiftFinger} next={keyLabel} /></div>
    <p className="coach-home">Find the bumps on <kbd>F</kbd> and <kbd>J</kbd>. That's home.</p>
  </aside>;
}

export function WordProgress({ text, typed }) {
  const words = text.split(' ');
  let offset = 0;
  const completed = words.filter((word, index) => {
    const start = offset;
    offset += word.length + (index < words.length - 1 ? 1 : 0);
    const boundaryCorrect = index === words.length - 1 || typed[offset - 1] === ' ';
    const startsAtBoundary = start === 0 || typed[start - 1] === ' ';
    return typed.length >= offset && startsAtBoundary && boundaryCorrect && typed.slice(start, start + word.length) === word;
  }).length;
  return <div className="word-progress" role="group" aria-label={`${completed} of ${words.length} words complete`}>
    <span><strong>{completed}</strong> / {words.length} words</span>
    <div className="word-progress-track" role="progressbar" aria-label="Words completed" aria-valuemin={0} aria-valuemax={words.length} aria-valuenow={completed}><i style={{ width: `${completed / words.length * 100}%` }} /></div>
    <small>{completed === words.length ? 'You made it.' : completed === 0 ? 'One word at a time.' : completed >= words.length / 2 ? 'Over halfway. Keep your rhythm.' : 'Each word is a little more practice.'}</small>
  </div>;
}
