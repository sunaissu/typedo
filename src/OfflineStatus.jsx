import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { appWorker, removeOfflineDownload, workerMessage } from './offline.js';

export default function OfflineStatus() {
  const production = import.meta.env.PROD;
  const [status, setStatus] = useState('idle');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const registrationRef = useRef(null);
  const mountedRef = useRef(false);
  const updatingRef = useRef(false);
  const removeListenersRef = useRef([]);
  const supported = production && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext;
  const base = production && typeof window !== 'undefined' ? new URL(import.meta.env.BASE_URL, window.location.href) : null;
  const scriptURL = base ? new URL('sw.js', base).href : '';

  async function verify(registration) {
    if (!registration?.active) return;
    try {
      const result = await workerMessage(registration.active, { type: 'OFFLINE_STATUS' });
      if (!mountedRef.current || registrationRef.current !== registration) return;
      setStatus(result.ready ? 'ready' : 'incomplete');
      setWaiting(Boolean(registration.waiting));
      if (!result.ready) setNote('The offline download is incomplete. Remove it and enable it again while online.');
    } catch {
      if (mountedRef.current && registrationRef.current === registration) { setStatus('incomplete'); setNote('Could not verify the offline download. Try again while online.'); }
    }
  }

  function watch(registration) {
    registrationRef.current = registration;
    const observeWorker = worker => {
      if (!worker) return;
      const changed = () => {
        if (!mountedRef.current) return;
        setWaiting(Boolean(registration.waiting));
        if (worker.state === 'activated') verify(registration);
        if (worker.state === 'installed' && registration.active) setWaiting(true);
        if (worker.state === 'redundant' && !registration.active) {
          setStatus('incomplete');
          setNote('The download did not finish. Check your connection and try again.');
        }
      };
      worker.addEventListener('statechange', changed);
      removeListenersRef.current.push(() => worker.removeEventListener('statechange', changed));
      changed();
    };
    const found = () => observeWorker(registration.installing);
    registration.addEventListener('updatefound', found);
    removeListenersRef.current.push(() => registration.removeEventListener('updatefound', found));
    found();
    setWaiting(Boolean(registration.waiting));
    if (registration.active) verify(registration);
    else setStatus('downloading');
  }

  useEffect(() => {
    mountedRef.current = true;
    if (!supported) return () => { mountedRef.current = false; };
    const connection = () => setOnline(navigator.onLine);
    const controllerChanged = () => {
      if (updatingRef.current) window.location.reload();
      else verify(registrationRef.current);
    };
    const offerInstall = event => { event.preventDefault(); setInstallPrompt(event); };
    const installed = () => { setInstallPrompt(null); setNote('Typedo was added to your device.'); };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', installed);
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
    navigator.serviceWorker.getRegistration(base.href).then(registration => {
      if (mountedRef.current && appWorker(registration, scriptURL)) {
        watch(registration);
        if (navigator.onLine) registration.update().catch(() => {});
      }
    }).catch(() => { if (mountedRef.current) setNote('Offline downloads are unavailable in this browser session.'); });
    return () => {
      mountedRef.current = false;
      for (const remove of removeListenersRef.current) remove();
      removeListenersRef.current = [];
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', installed);
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    };
  }, [supported, scriptURL]);

  if (!production) return null;

  async function enable() {
    setStatus('downloading');
    setNote('');
    try {
      if (status === 'incomplete' && registrationRef.current) await removeOfflineDownload(registrationRef.current);
      const registration = await navigator.serviceWorker.register(scriptURL, { scope: base.pathname, updateViaCache: 'none' });
      if (mountedRef.current) watch(registration);
    } catch {
      if (mountedRef.current) { setStatus('idle'); setNote('Offline setup failed. Check your connection and browser storage, then try again.'); }
    }
  }

  async function applyUpdate() {
    if (!registrationRef.current?.waiting) return;
    updatingRef.current = true;
    setStatus('updating');
    setNote('Refreshing Typedo after the update is ready. Your saved progress stays in this browser.');
    try {
      const result = await workerMessage(registrationRef.current.waiting, { type: 'ACTIVATE_UPDATE' });
      if (!result.activated) {
        updatingRef.current = false;
        setStatus('ready');
        setNote('Finish or pause practice in your other Typedo tabs, then close them before updating here.');
      }
    } catch {
      updatingRef.current = false;
      if (mountedRef.current) { setStatus('ready'); setNote('The update could not be applied. Your current version remains available.'); }
    }
  }

  async function remove() {
    if (!registrationRef.current) return;
    try {
      await removeOfflineDownload(registrationRef.current);
      registrationRef.current = null;
      for (const removeListener of removeListenersRef.current) removeListener();
      removeListenersRef.current = [];
      if (mountedRef.current) { setStatus('idle'); setWaiting(false); setNote('Offline files removed. Your saved practice and backups are unchanged.'); }
    } catch { if (mountedRef.current) setNote('Could not remove the offline download. Try again.'); }
  }

  async function install() {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch { setNote('Use your browser menu to add Typedo if installation is supported.'); }
    finally { setInstallPrompt(null); }
  }

  const busy = ['downloading', 'updating'].includes(status);
  return <section className="home-panel home-evidence offline-panel" aria-labelledby="offline-title">
    <div className="home-panel-heading">{online ? <Download size={20} /> : <WifiOff size={20} />}<h2 id="offline-title">Practice offline</h2></div>
    <p role="status">{!supported ? 'Offline downloads are unavailable in this browser session.' : status === 'ready' ? online ? 'Lessons, the current story library, and practice tools are downloaded for this browser.' : 'You appear to be offline. Your downloaded lessons, stories, and practice tools are ready.' : status === 'downloading' ? 'Downloading the current lessons, stories, and practice tools…' : status === 'updating' ? 'Applying the update…' : 'Download the current lessons and stories so you can return without a connection.'}</p>
    {supported && <div className="pause-actions">
      {['idle', 'incomplete'].includes(status) && <button className="secondary-button" onClick={enable} disabled={!online}>Enable offline practice<Download size={16} /></button>}
      {waiting && <button className="primary-button" onClick={applyUpdate} disabled={busy}>Refresh for update<RefreshCw size={16} /></button>}
      {registrationRef.current && !busy && <button className="text-button" onClick={remove}>Remove offline download</button>}
      {installPrompt && <button className="secondary-button" onClick={install}>Add Typedo to this device</button>}
    </div>}
    {note && <p className="home-small-note" role="status">{note}</p>}
    <p className="home-small-note">Updates wait until you choose to refresh or close all Typedo tabs. Installation depends on your browser and device. Downloaded files can be cleared by your browser; keep a backup of your progress.</p>
  </section>;
}
