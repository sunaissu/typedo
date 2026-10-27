import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Users } from 'lucide-react';
import App from './App.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import { Dialog } from './SessionControls.jsx';
import { MAX_PROFILES, addProfile, profileStorageKey, readProfiles, renameProfile, writeProfiles } from './profiles.js';
import './profiles.css';
import { browserStorage } from './browserStorage.js';

export default function ProfilesApp({ Application = App, storage = browserStorage }) {
  const [initial, setInitial] = useState(null);
  useEffect(() => {
    let active = true;
    readProfiles(storage).then(value => { if (active) setInitial(value); });
    return () => { active = false; };
  }, [storage]);
  if (!initial) return <LoadingScreen message="Loading your profiles…" />;
  return <ProfilesWorkspace Application={Application} storage={storage} initial={initial} />;
}

function ProfilesWorkspace({ Application, storage, initial }) {
  const [saved, setSaved] = useState(initial);
  // Another tab may change the remembered default; it never switches this tab's work.
  const [activeId, setActiveId] = useState(() => saved.data.activeId);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const saveCurrentRef = useRef(null);
  const current = saved.data.profiles.find(profile => profile.id === activeId) || saved.data.profiles[0];

  async function manageProfiles(saveCurrent) {
    if (busyRef.current) return;
    busyRef.current = true;
    saveCurrentRef.current = saveCurrent;
    setBusy(true);
    setOpen(true);
    const latest = await readProfiles(storage);
    if (latest.writable && latest.data.profiles.some(profile => profile.id === activeId)) setSaved(latest);
    else if (!latest.writable) setError(latest.error);
    setRenameName((latest.data.profiles.find(profile => profile.id === activeId) || current).name);
    setNewName('');
    if (latest.writable) setError('');
    busyRef.current = false;
    setBusy(false);
  }

  async function persist(data, { switchTo = null, close = false, absentKey } = {}) {
    if (busyRef.current) return false;
    if (!saved.writable) { setError(saved.error); return false; }
    busyRef.current = true;
    setBusy(true);
    // Pausing can create one more checkpoint after the dialog opens. Keep this
    // workspace mounted if that checkpoint cannot be committed.
    if (switchTo && saveCurrentRef.current && !await saveCurrentRef.current()) {
      setError('Your current progress could not be saved. Export it from Progress before switching profiles.');
      busyRef.current = false;
      setBusy(false);
      return false;
    }
    const result = await writeProfiles(data, saved.raw, storage, { absentKey });
    if (!result.ok) {
      setError(result.error);
      if (result.conflict) {
        const latest = await readProfiles(storage);
        if (latest.writable && latest.data.profiles.some(profile => profile.id === activeId)) setSaved(latest);
      }
      busyRef.current = false;
      setBusy(false);
      return false;
    }
    setSaved({ data: result.data, raw: result.raw, writable: true, error: '' });
    if (switchTo) setActiveId(switchTo);
    if (close) setOpen(false);
    setError('');
    busyRef.current = false;
    setBusy(false);
    return true;
  }

  function switchProfile(id) {
    if (id === activeId) { setOpen(false); return; }
    persist({ ...saved.data, activeId: id }, { switchTo: id, close: true });
  }

  async function create(event) {
    event.preventDefault();
    try {
      const next = addProfile(saved.data, newName);
      // A generated identifier must never open an orphaned or unrelated saved history.
      await persist(next, { switchTo: next.activeId, close: true, absentKey: profileStorageKey(next.activeId) });
    } catch (failure) { setError(failure.message); }
  }

  async function rename(event) {
    event.preventDefault();
    try { await persist(renameProfile(saved.data, activeId, renameName)); }
    catch (failure) { setError(failure.message); }
  }

  return <>
    <Application key={activeId} storage={storage} storageKey={profileStorageKey(activeId)} profileName={current.name} onManageProfiles={manageProfiles} externalSuspended={open || busy} />
    {open && <Dialog title="Profiles in this browser" onClose={() => setOpen(false)}>
      <p className="profile-explanation">Keep separate lessons, stories, passages, and settings for people who share this browser. Profiles are not password protected and do not sync between devices.</p>
      <p className="panel-note">Export a separate progress backup from each profile. A backup contains that profile's practice, not this profile list.</p>
      <ul className="profile-list" aria-label="Choose a profile">{saved.data.profiles.map(profile => <li key={profile.id}>
        <button data-autofocus={profile.id === activeId ? true : undefined} className={profile.id === activeId ? 'current' : ''} onClick={() => switchProfile(profile.id)} disabled={profile.id !== activeId && (busy || !saved.writable)}>
          <Users size={18} aria-hidden="true" /><span><strong>{profile.name}</strong><small>{profile.id === activeId ? 'Current profile' : profile.id === 'default' ? 'Original browser history' : 'Separate progress in this browser'}</small></span>{profile.id === activeId ? <Check size={18} aria-label="Current profile" /> : <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </li>)}</ul>
      {saved.writable && <>
        <details className="profile-rename"><summary>Rename {current.name}</summary><form onSubmit={rename}><label htmlFor="rename-profile">Profile name</label><div className="profile-form-row"><input id="rename-profile" maxLength={32} value={renameName} onChange={event => setRenameName(event.target.value)} required /><button className="secondary-button" type="submit" disabled={busy}>Save name</button></div></form></details>
        {saved.data.profiles.length < MAX_PROFILES ? <form className="profile-create" onSubmit={create}>
          <label htmlFor="new-profile">New profile name</label><div className="profile-form-row"><input id="new-profile" maxLength={32} value={newName} onChange={event => setNewName(event.target.value)} placeholder="For example, Alex" required /><button className="primary-button" type="submit" disabled={busy}>Create and switch</button></div>
          <p className="panel-note">{saved.data.profiles.length} of {MAX_PROFILES} profiles used. New profiles start with empty progress.</p>
        </form> : <p className="panel-note">All {MAX_PROFILES} profile spaces are in use.</p>}
      </>}
      {(error || saved.error) && <p className="form-error" role="alert">{error || saved.error}</p>}
      {busy && <p role="status">Updating profiles…</p>}
      <button className="text-button profile-close" onClick={() => setOpen(false)}>Return to {current.name}</button>
    </Dialog>}
  </>;
}
