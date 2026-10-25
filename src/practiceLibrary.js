export const MAX_SAVED_PASSAGES = 30;
export const MAX_PASSAGE_LENGTH = 1500;

export const PRACTICE_TRACKS = [
  { id: 'short-note', title: 'A note for a friend', track: 'Everyday', difficulty: 'Letters', text: 'meet me at the park after lunch we can take a walk and find a quiet spot to read bring a book and a small snack' },
  { id: 'email-reply', title: 'A useful email reply', track: 'Emails', difficulty: 'Capitals and punctuation', text: 'Hi Sam, Thanks for the update. I have checked the draft and added a few notes. Could you send the final copy by Friday? I will review it before our meeting. Best, Alex' },
  { id: 'email-details', title: 'Confirm an appointment', track: 'Emails', difficulty: 'Numbers and symbols', text: 'Hello, I would like to confirm my appointment on 18 May at 10:30. My reference is BK-2048. Please send the details to alex@example.com. Thank you for your help.' },
  { id: 'school-plan', title: 'Plan a study session', track: 'School', difficulty: 'Capitals and punctuation', text: 'Read the next chapter and write a short summary. Choose one idea to explain in your own words. Bring your notes to class, then compare them with a partner. Leave time to ask questions.' },
  { id: 'school-data', title: 'A science notebook', track: 'School', difficulty: 'Numbers and symbols', text: 'Trial 1: 24 seeds, 18 sprouts. Trial 2: 24 seeds, 21 sprouts. Record the results on page 12. Label each cup A, B, or C. Check the plants at 08:30 and 16:00 every day.' },
  { id: 'dialogue', title: 'Make a plan', track: 'Everyday', difficulty: 'Capitals and punctuation', text: '"Are you free on Saturday?" asked Jo. "I can meet after lunch," said Lee. "Shall we try the new cafe?" "Yes, but let\'s take the bus. I still haven\'t fixed my bike."' },
  { id: 'form-details', title: 'Fill in delivery details', track: 'Forms', difficulty: 'Numbers and symbols', text: 'Name: Alex Lee. Address: 42 River Road, Unit 7. City: Fairview. Order: AB-3081. Delivery: 14 June, 09:00-12:00. Instructions: Leave the parcel at reception and ask for a receipt.' },
  { id: 'calendar', title: 'Update a calendar', track: 'Dates and numbers', difficulty: 'Numbers and symbols', text: 'Monday, 12 April: meeting at 09:15. Tuesday, 13 April: collect 3 tickets at 17:30. Friday, 16 April: train departs at 08:45 from platform 6. Return on 18 April at 19:20.' },
  { id: 'receipt', title: 'Check a receipt', track: 'Dates and numbers', difficulty: 'Numbers and symbols', text: 'Notebook: $4.50. Pens: $2.75. Folder: $1.25. Total: $8.50. Paid: $10.00. Change: $1.50. Receipt #1049. Please keep this receipt for 30 days and check every item before you leave.' },
];

export function normalizePassage(value) {
  const raw = typeof value === 'string' ? value : '';
  const converted = raw.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/\u00a0/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const unsupported = [...converted].filter(character => !/[\x20-\x7e\n\r\t]/.test(character)).length;
  const normalized = converted.replace(/[^\x20-\x7e\n\r\t]/g, '').replace(/\s+/g, ' ').trim();
  const text = normalized.slice(0, MAX_PASSAGE_LENGTH).trimEnd();
  return { text, changed: text !== raw, unsupported, truncated: normalized.length > MAX_PASSAGE_LENGTH, originalLength: raw.length };
}

export function sanitizeSavedPassages(value) {
  if (!Array.isArray(value)) return [];
  const saved = new Map();
  for (const passage of value.slice(0, 200)) {
    if (!passage || typeof passage !== 'object' || typeof passage.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(passage.id) || typeof passage.title !== 'string' || typeof passage.text !== 'string' || typeof passage.updatedAt !== 'string' || !Number.isFinite(Date.parse(passage.updatedAt))) continue;
    const title = passage.title.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
    const { text } = normalizePassage(passage.text);
    if (!title || !text) continue;
    const cleaned = { id: passage.id, title, text, updatedAt: new Date(passage.updatedAt).toISOString() };
    if (!saved.has(passage.id) || cleaned.updatedAt > saved.get(passage.id).updatedAt) saved.set(passage.id, cleaned);
  }
  return [...saved.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_SAVED_PASSAGES);
}

export function passageDetails(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const keys = ['Letters', ...(/[A-Z]/.test(text) ? ['capitals'] : []), ...(/[0-9]/.test(text) ? ['numbers'] : []), ...(/[^a-zA-Z0-9\s]/.test(text) ? ['punctuation'] : [])];
  return { words, characters: text.length, keys: keys.join(', ') };
}

export function filterPracticePassages(passages, { track = 'All', skill = 'All', query = '' } = {}) {
  const search = query.trim().toLowerCase();
  return passages.filter(passage => (track === 'All' || passage.track === track) && (skill === 'All' || (skill === 'Letters only' ? !/[^a-z\s]/.test(passage.text) : skill === 'Capitals' ? /[A-Z]/.test(passage.text) : skill === 'Numbers' ? /[0-9]/.test(passage.text) : /[^a-zA-Z0-9\s]/.test(passage.text))) && (!search || `${passage.title} ${passage.text}`.toLowerCase().includes(search)));
}
