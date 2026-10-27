export const MAX_SAVED_PASSAGES = 30;
export const MAX_PASSAGE_LENGTH = 1500;

export const PRACTICE_TRACKS = [
  { id: 'work-handoff', title: 'Hand over a project', track: 'Work', difficulty: 'Capitals and punctuation', text: 'Hi Morgan, The revised files are in the shared folder. I checked the totals and marked two questions for your review. Please use the version named Final Draft, rather than the older attachment. If anything is unclear, leave a note beside the item and I will follow up tomorrow.' },
  { id: 'work-update', title: 'Write a clear progress update', track: 'Work', difficulty: 'Capitals and punctuation', text: 'The first part is complete, and the next part is ready to review. We found a missing detail in the original request, so we paused that task and asked for clarification. Our next step is to confirm the change, update the checklist, and send a short summary to the team.' },
  { id: 'email-reschedule', title: 'Reschedule politely', track: 'Emails', difficulty: 'Numbers and symbols', text: 'Hi Jamie, Could we move our call from Tuesday at 14:00 to Wednesday at 09:30? The agenda is unchanged: review the sample, agree on the next steps, and confirm the deadline. Please let me know whether the new time works for you. Thanks, Taylor' },
  { id: 'email-support', title: 'Describe a problem', track: 'Emails', difficulty: 'Numbers and symbols', text: 'Hello, I need help with order XY-4826. I received 2 notebooks, but the packing slip lists 3. The box arrived on 16 July and was sealed when I collected it. Could you check the order and explain the next step? I can provide a photo of the packing slip if needed.' },
  { id: 'everyday-directions', title: 'Give useful directions', track: 'Everyday', difficulty: 'Capitals and punctuation', text: 'Walk past the library and turn left at the corner. The entrance is beside the small garden, opposite the bakery. If you reach the bridge, you have gone too far. We will wait inside near the window. There is no rush; send a message when you arrive.' },
  { id: 'everyday-quiet', title: 'A quiet morning', track: 'Everyday', difficulty: 'Letters', text: 'the rain stopped before dawn and the street grew quiet a small bird landed on the fence while someone opened the shop across the road i made a cup of tea and sat by the window for a moment there was nothing to hurry and nowhere i needed to be' },
  { id: 'school-explain', title: 'Explain an idea', track: 'School', difficulty: 'Capitals and punctuation', text: 'A useful explanation begins with a clear question. Describe what you noticed, then give an example that someone else can check. Separate your observations from your guesses. If the evidence is incomplete, say what you still need to find out instead of pretending to know the answer.' },
  { id: 'travel-itinerary', title: 'Read a travel plan', track: 'Dates and numbers', difficulty: 'Numbers and symbols', text: 'Departure: 06:45 on 22 August. Platform: 4. Booking: TR-7052. Arrive at least 20 minutes early and keep your ticket ready. The connecting bus leaves at 09:10 from Bay 6. Hotel check-in opens at 15:00; luggage storage is available from 10:00.' },
  { id: 'work-checklist', title: 'Check before sending', track: 'Work', difficulty: 'Numbers and symbols', text: 'Checklist: 1) Check the recipient. 2) Read the subject line. 3) Confirm the dates and totals. 4) Attach the correct file. 5) Remove any private notes. The summary should explain what changed, what needs a reply, and when the next update will arrive.' },
  { id: 'forms-inventory', title: 'Record an inventory', track: 'Forms', difficulty: 'Numbers and symbols', text: 'Shelf A: 12 blue folders, 8 green folders, and 15 black pens. Shelf B: 6 boxes of paper, 4 rolls of tape, and 2 staplers. Checked by: Alex. Date: 03 September. Reorder note: add 10 blue folders and 1 box of clips to the next request.' },
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
