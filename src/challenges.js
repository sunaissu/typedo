export const BUILTIN_CHALLENGES = [
  { title: 'The morning note', text: 'The kettle is on, the window is open, and the day is yours. Write a short list, choose one useful task, and leave a little time for a walk. A steady start can carry you a long way.' },
  { title: 'A ticket to anywhere', text: 'Your train leaves at 08:45 from platform 6. Bring ticket AB-2048, a small bag, and $25.50 for lunch. "Where are we going?" asked Jo. "Somewhere new," said Sam. "I hope they have cake!"' },
  { title: 'The tiny mystery', text: 'Someone had moved every chair in the library by one inch. Mara checked the windows, the doors, and the sleeping cat. At last she found a note: "The books asked for more legroom." The handwriting belonged to the librarian.' },
];

export function validateChallenge(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 80 || /[\u0000-\u001f\u007f]/.test(value.title) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 1500 || !/^[\x20-\x7e]+$/.test(value.text)) return null;
  return { title: value.title.trim(), text: value.text };
}

// FNV-1a identifies the exact printable passage. This is a local comparison key,
// not proof of identity, anti-cheat protection, or a security signature.
export function challengeCategory(text) {
  let hash = 14695981039346656037n;
  for (const character of text) hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n);
  return `challenge:${text.length}:${hash.toString(16).padStart(16, '0')}`;
}

export function makeChallengeLink(value, baseUrl) {
  const challenge = validateChallenge(value);
  if (!challenge) throw new Error('Use a name and 1 to 1,500 printable characters.');
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Challenge links need an http or https address.');
  url.hash = `challenge=${encodeURIComponent(JSON.stringify({ version: 1, ...challenge }))}`;
  return url.href;
}

export function readSharedChallenge(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#challenge=') || hash.length > 12000) return null;
  try {
    const value = JSON.parse(decodeURIComponent(hash.slice('#challenge='.length)));
    return value?.version === 1 ? validateChallenge(value) : null;
  } catch { return null; }
}

export function getChallengeComparison(history, challenge) {
  const category = challengeCategory(challenge.text);
  const runs = [...new Map((Array.isArray(history) ? history : []).filter(run => run && typeof run.id === 'string' && run.mode === 'custom' && run.category === category && !run.interrupted && Number.isFinite(run.wpm) && run.wpm >= 0 && Number.isFinite(run.accuracy) && run.accuracy >= 0 && run.accuracy <= 100).map(run => [run.id, run])).values()];
  const sorted = runs.map(run => run.wpm).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return { count: runs.length, bestWpm: runs.length ? Math.max(...runs.map(run => run.wpm)) : null, bestAccuracy: runs.length ? Math.max(...runs.map(run => run.accuracy)) : null, medianWpm: sorted.length >= 3 ? sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : null };
}
