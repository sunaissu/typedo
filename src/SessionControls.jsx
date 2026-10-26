import { useEffect, useRef } from 'react';
import { ArrowRight, Pause, RotateCcw, X } from 'lucide-react';

export function Dialog({ title, onClose, children }) {
  const dialog = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    opener.current = document.activeElement;
    const element = dialog.current;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    const frame = requestAnimationFrame(() => (element.querySelector('[data-autofocus]') || element.querySelector('input, select, textarea, button, [href]'))?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);
  const close = event => { event.preventDefault(); event.stopPropagation(); if (!event.repeat) onClose(); };
  return <dialog ref={dialog} aria-label={title} className="session-dialog" onCancel={close} onKeyDown={event => {
    if (event.key === 'Escape') { close(event); return; }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(item => !item.disabled && !item.hidden);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export default function PauseDialog({ onResume, onFinish, onRestart, interrupted = false, storageAvailable = true, storageSaving = false }) {
  return <Dialog title="Practice paused" onClose={onResume}>
    <p className="pause-symbol"><Pause size={26} aria-hidden="true" /></p>
    <p>Your place is kept. Take your time.</p>
    <p className="panel-note">{storageSaving ? 'Saving your unfinished practice…' : storageAvailable ? 'Your unfinished practice is saved in this browser.' : 'Kept for this visit. Export your progress before closing the app.'}</p>
    {interrupted && <p className="interrupted-note">This attempt will count as practice. Start a fresh test for a personal best or assessment result.</p>}
    <div className="pause-actions"><button data-autofocus className="primary-button" onClick={onResume}>Resume typing<ArrowRight size={16} /></button><button className="secondary-button" onClick={onFinish}>Finish for now</button><button className="text-button" onClick={onRestart}><RotateCcw size={15} />Restart</button></div>
    <p className="panel-note">The clock starts again with your next typed character.</p>
  </Dialog>;
}

export function ConfirmRestart({ onCancel, onConfirm, description }) {
  return <Dialog title="Restart this attempt?" onClose={onCancel}><p>{description || 'This clears the unfinished attempt. Your completed work stays saved.'}</p><div className="pause-actions"><button data-autofocus className="primary-button" onClick={onCancel}>Keep practicing</button><button className="secondary-button" onClick={onConfirm}>Restart attempt</button></div></Dialog>;
}
