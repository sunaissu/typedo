import { useState } from 'react';
import { ArrowRight, Check, Users } from 'lucide-react';
import App from './App.jsx';
import { Dialog } from './SessionControls.jsx';
import { MAX_PROFILES, addProfile, profileStorageKey, readProfiles, renameProfile, writeProfiles } from './profiles.js';
import './profiles.css';

export default function ProfilesApp({ Application = App }) {
  const [saved, setSaved] = useState(() => readProfiles());
  // Another tab may change the remembered default; it never switches this tab's work.
  const [activeId, setActiveId] = useState(() => saved.data.activeId);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [error, setError] = useState('');
  const current = saved.data.profiles.find(profile => profile.id === activeId) || saved.data.profiles[0];

  function manageProfiles() {
    const latest = readProfiles();
    if (latest.writable && latest.data.profiles.some(profile => profile.id === activeId)) setSaved(latest);
    else if (!latest.writable) setError(latest.error);
    setRenameName((latest.data.profiles.find(profile => profile.id === activeId) || current).name);
    setNewName('');
    if (latest.writable) setError('');
    setOpen(true);
  }

  function persist(data, { switchTo = null, close = false } = {}) {
    if (!saved.writable) { setError(saved.error); return false; }
    const result = writeProfiles(data, saved.raw);
    if (!result.ok) {
      setError(result.error);
      if (result.conflict) {
        const latest = readProfiles();
        if (latest.writable && latest.data.profiles.some(profile => profile.id === activeId)) setSaved(latest);
      }
      return false;
    }
    setSaved({ data: result.data, raw: result.raw, writable: true, error: '' });
    if (switchTo) setActiveId(switchTo);
    if (close) setOpen(false);
    setError('');
    return true;
  }

  function switchProfile(id) {
    if (id === activeId) { setOpen(false); return; }
    persist({ ...saved.data, activeId: id }, { switchTo: id, close: true });
  }

  function create(event) {
    event.preventDefault();
    try {
      const next = addProfile(saved.data, newName);
      // A generated identifier must never open an orphaned or unrelated saved history.
      if (window.localStorage.getItem(profileStorageKey(next.activeId)) !== null) throw new Error('That profile could not be created. Try again.');
      persist(next, { switchTo: next.activeId, close: true });
    } catch (failure) { setError(failure.message); }
  }

  function rename(event) {
    event.preventDefault();
    try { persist(renameProfile(saved.data, activeId, renameName)); }
    catch (failure) { setError(failure.message); }
  }

  return <>
    <Application key={activeId} storageKey={profileStorageKey(activeId)} profileName={current.name} onManageProfiles={manageProfiles} externalSuspended={open} />
    {open && <Dialog title="Profiles in this browser" onClose={() => setOpen(false)}>
      <p className="profile-explanation">Keep separate lessons, stories, passages, and settings for people who share this browser. Profiles are not password protected and do not sync between devices.</p>
      <p className="panel-note">Export a separate progress backup from each profile. A backup contains that profile's practice, not this profile list.</p>
      <ul className="profile-list" aria-label="Choose a profile">{saved.data.profiles.map(profile => <li key={profile.id}>
        <button data-autofocus={profile.id === activeId ? true : undefined} className={profile.id === activeId ? 'current' : ''} onClick={() => switchProfile(profile.id)} disabled={!saved.writable && profile.id !== activeId}>
          <Users size={18} aria-hidden="true" /><span><strong>{profile.name}</strong><small>{profile.id === activeId ? 'Current profile' : profile.id === 'default' ? 'Original browser history' : 'Separate progress in this browser'}</small></span>{profile.id === activeId ? <Check size={18} aria-label="Current profile" /> : <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </li>)}</ul>
      {saved.writable && <>
        <details className="profile-rename"><summary>Rename {current.name}</summary><form onSubmit={rename}><label htmlFor="rename-profile">Profile name</label><div className="profile-form-row"><input id="rename-profile" maxLength={32} value={renameName} onChange={event => setRenameName(event.target.value)} required /><button className="secondary-button" type="submit">Save name</button></div></form></details>
        {saved.data.profiles.length < MAX_PROFILES ? <form className="profile-create" onSubmit={create}>
          <label htmlFor="new-profile">New profile name</label><div className="profile-form-row"><input id="new-profile" maxLength={32} value={newName} onChange={event => setNewName(event.target.value)} placeholder="For example, Alex" required /><button className="primary-button" type="submit">Create and switch</button></div>
          <p className="panel-note">{saved.data.profiles.length} of {MAX_PROFILES} profiles used. New profiles start with empty progress.</p>
        </form> : <p className="panel-note">All {MAX_PROFILES} profile spaces are in use.</p>}
      </>}
      {(error || saved.error) && <p className="form-error" role="alert">{error || saved.error}</p>}
      <button className="text-button profile-close" onClick={() => setOpen(false)}>Return to {current.name}</button>
    </Dialog>}
  </>;
}
