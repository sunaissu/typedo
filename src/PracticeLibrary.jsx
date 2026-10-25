import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, FileText, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { filterPracticePassages, MAX_PASSAGE_LENGTH, MAX_SAVED_PASSAGES, normalizePassage, passageDetails, PRACTICE_TRACKS, sanitizeSavedPassages } from './practiceLibrary.js';
import './home.css';

export default function PracticeLibrary({ passages = [], onSave, onUse }) {
  const heading = useRef(null);
  const titleInput = useRef(null);
  const [track, setTrack] = useState('All');
  const [skill, setSkill] = useState('All');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [deleted, setDeleted] = useState(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const saved = sanitizeSavedPassages(passages);
  const preview = normalizePassage(rawText);
  const tracks = filterPracticePassages(PRACTICE_TRACKS, { track, skill, query });
  const savedFiltered = filterPracticePassages(saved, { skill, query });
  const resetEditor = () => { setEditingId(null); setTitle(''); setRawText(''); };
  function edit(passage) {
    setEditingId(passage.id);
    setTitle(passage.title);
    setRawText(passage.text);
    setMessage(`Editing ${passage.title}.`);
    titleInput.current?.focus();
    titleInput.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  function save(event) {
    event.preventDefault();
    if (!title.trim() || !preview.text) { setMessage('Add a name and some printable text before saving.'); return; }
    if (!editingId && saved.length >= MAX_SAVED_PASSAGES) { setMessage(`Your library holds ${MAX_SAVED_PASSAGES} passages. Remove one before adding another.`); return; }
    const passage = { id: editingId || globalThis.crypto.randomUUID(), title: title.trim().slice(0, 80), text: preview.text, updatedAt: new Date().toISOString() };
    onSave?.(sanitizeSavedPassages([passage, ...saved.filter(item => item.id !== passage.id)]));
    setMessage(`${passage.title} ${editingId ? 'updated' : 'added to your library'}.`);
    resetEditor();
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') { setMessage('Choose a plain-text .txt file. Other document formats are not supported.'); return; }
    if (file.size > 250000) { setMessage('Choose a text file smaller than 250 KB. You can also paste a short excerpt.'); return; }
    setImporting(true);
    try {
      const text = await file.text();
      if (text.includes('\0')) { setMessage('This file does not look like plain text. Export it as .txt and try again.'); return; }
      setRawText(text);
      setTitle(file.name.replace(/\.txt$/i, '').slice(0, 80));
      setEditingId(null);
      setMessage('File loaded for preview. Check the passage and choose Save passage.');
      titleInput.current?.focus();
    } catch { setMessage('That file could not be read. Try another file or paste the text.'); }
    finally { setImporting(false); }
  }
  function remove(passage) {
    onSave?.(saved.filter(item => item.id !== passage.id));
    setDeleted(passage);
    if (editingId === passage.id) resetEditor();
    setMessage(`${passage.title} removed. Undo is available below.`);
    heading.current?.focus({ preventScroll: true });
  }
  function undoDelete() {
    if (saved.length >= MAX_SAVED_PASSAGES) { setMessage('The library is full. Remove another passage before undoing.'); return; }
    onSave?.(sanitizeSavedPassages([...saved, deleted]));
    setMessage(`${deleted.title} restored to your library.`);
    setDeleted(null);
  }
  const passageCard = (passage, personal = false) => {
    const details = passageDetails(passage.text);
    return <article className="practice-passage-card" key={passage.id} aria-labelledby={`passage-${passage.id}`}>
      <div className="practice-card-meta"><span>{personal ? 'Your passage' : passage.track}</span><span>{details.words} words</span></div>
      <h3 id={`passage-${passage.id}`}>{passage.title}</h3>
      <p className="practice-passage-preview">{passage.text}</p>
      <p className="practice-key-label">{personal ? details.keys : passage.difficulty} · {details.characters} characters</p>
      <div className="practice-card-actions"><button className="secondary-button" onClick={() => onUse?.(passage.text, passage.title)}>Practise{personal ? ' passage' : ''}<ArrowRight size={15} /></button>{personal && <><button className="text-button" onClick={() => edit(passage)} aria-label={`Edit ${passage.title}`}><Pencil size={15} />Edit</button><button className="text-button" onClick={() => remove(passage)} aria-label={`Remove ${passage.title}`}><Trash2 size={15} />Remove</button></>}</div>
    </article>;
  };
  return <div className="practice-library">
    <header className="intro"><div><div className="eyebrow"><span />USEFUL EVERYDAY PRACTICE</div><h1 ref={heading} tabIndex={-1}>Make the keyboard useful.</h1><p>Practise the writing you do every day, or bring your own passage. Choose a passage with Tab and Enter to start typing.</p></div></header>
    <section className="practice-filters" aria-label="Find practice passages">
      <label>Search<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names or passage text" /></label>
      <label>Everyday track<select value={track} onChange={event => setTrack(event.target.value)}><option>All</option>{[...new Set(PRACTICE_TRACKS.map(item => item.track))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Keys to practise<select value={skill} onChange={event => setSkill(event.target.value)}>{['All', 'Letters only', 'Capitals', 'Numbers', 'Punctuation'].map(value => <option key={value}>{value}</option>)}</select></label>
    </section>
    <section aria-labelledby="everyday-practice-title"><div className="practice-section-heading"><BookOpen size={20} /><h2 id="everyday-practice-title">Everyday passages</h2><span>{tracks.length} available</span></div><div className="practice-passage-grid">{tracks.map(passage => passageCard(passage))}</div>{!tracks.length && <p className="practice-empty">No passages match those filters. Try another track or clear your search.</p>}</section>
    <section aria-labelledby="saved-practice-title"><div className="practice-section-heading"><FileText size={20} /><h2 id="saved-practice-title">Your passage library</h2><span>{saved.length} of {MAX_SAVED_PASSAGES}</span></div><p className="practice-section-help">Your passages stay with your local progress and are included in backups. Search and key filters apply here; the everyday track filter applies above.</p><div className="practice-passage-grid">{savedFiltered.map(passage => passageCard(passage, true))}</div>{!savedFiltered.length && <p className="practice-empty">{saved.length ? 'No saved passages match your search and key filters.' : 'Add something you want to get comfortable typing. A short email or paragraph is a good start.'}</p>}</section>
    <div className="practice-library-status"><p role="status">{message}</p>{deleted && <button className="text-button" onClick={undoDelete}><Undo2 size={16} />Undo remove</button>}</div>
    <section className="home-panel practice-editor" aria-labelledby="practice-editor-title">
      <div className="home-panel-heading"><Plus size={20} /><h2 id="practice-editor-title">{editingId ? 'Edit your passage' : 'Add your own passage'}</h2></div>
      <form onSubmit={save}>
        <label>Passage name<input ref={titleInput} value={title} onChange={event => setTitle(event.target.value)} maxLength={80} required placeholder="For example, a meeting update" /></label>
        <label>Text to practise<textarea value={rawText} onChange={event => setRawText(event.target.value)} rows={6} required aria-describedby="passage-preview-help" placeholder="Paste or write a passage here." /></label>
        <p id="passage-preview-help" className="home-small-note">Up to {MAX_PASSAGE_LENGTH.toLocaleString()} characters. Curly quotes, accents, dashes, and line breaks are simplified for the current keyboard exercises. Other unsupported characters are removed. Check the exact text below.</p>
        <div className="practice-import-actions"><input type="file" accept=".txt,text/plain" onChange={importFile} aria-label="Import a plain-text file" disabled={importing} /><span>{importing ? 'Reading file...' : 'A plain-text file opens here for preview before saving.'}</span></div>
        {rawText && <div className="practice-normalized-preview"><strong>Practice preview · {preview.text.length} characters</strong><p tabIndex={0} aria-label="Exact practice preview">{preview.text || 'No supported text remains. Add letters, numbers, or printable punctuation.'}</p>{preview.unsupported > 0 && <span>{preview.unsupported} unsupported {preview.unsupported === 1 ? 'character was' : 'characters were'} removed.</span>}{preview.truncated && <span>The passage is shortened to the first {MAX_PASSAGE_LENGTH.toLocaleString()} characters.</span>}{preview.changed && !preview.truncated && !preview.unsupported && <span>Spacing or characters were simplified. This is the exact passage you will practise.</span>}</div>}
        <div className="practice-editor-actions"><button className="primary-button" type="submit" disabled={importing || !preview.text || !title.trim() || (!editingId && saved.length >= MAX_SAVED_PASSAGES)}>{editingId ? 'Save changes' : 'Save passage'}</button>{editingId && <button className="secondary-button" type="button" onClick={() => { resetEditor(); setMessage('Editing cancelled. Your passage is unchanged.'); }}>Cancel editing</button>}</div>
      </form>
    </section>
  </div>;
}
