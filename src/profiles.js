import { browserStorage } from './browserStorage.js';

export const PROFILE_METADATA_KEY = 'typedo:profiles:v1';
export const MAX_PROFILES = 8;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const defaultProfiles = () => ({ version: 1, activeId: 'default', profiles: [{ id: 'default', name: 'Original profile' }] });

export function profileStorageKey(id) {
  if (id === 'default') return 'typedo:v1';
  if (typeof id !== 'string' || !uuid.test(id)) throw new Error('This profile identifier is invalid.');
  return `typedo:profile:${id.toLowerCase()}:v1`;
}

export function profileName(value) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Use a name without control characters.');
  const name = value.trim().replace(/\s+/g, ' ').normalize('NFC');
  if (!name || name.length > 32) throw new Error('Use a profile name between 1 and 32 characters.');
  return name;
}

export function validateProfiles(value) {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.profiles) || value.profiles.length < 1 || value.profiles.length > MAX_PROFILES) throw new Error('The saved profile list is not supported.');
  const ids = new Set(), names = new Set();
  const profiles = value.profiles.map(item => {
    if (!record(item)) throw new Error('The saved profile list is invalid.');
    profileStorageKey(item.id);
    const id = item.id.toLowerCase();
    const name = profileName(item.name);
    if (ids.has(id) || names.has(name.toLocaleLowerCase())) throw new Error('Profile identifiers and names must be distinct.');
    ids.add(id); names.add(name.toLocaleLowerCase());
    return { id, name };
  });
  if (!ids.has('default') || typeof value.activeId !== 'string' || !ids.has(value.activeId.toLowerCase())) throw new Error('The saved profile list is incomplete.');
  return { version: 1, activeId: value.activeId.toLowerCase(), profiles };
}

export async function readProfiles(storage = browserStorage) {
  let raw = null;
  try {
    raw = await storage.getItem(PROFILE_METADATA_KEY);
    if (raw === null) return { data: defaultProfiles(), raw, writable: true, error: '' };
    return { data: validateProfiles(JSON.parse(raw)), raw, writable: true, error: '' };
  } catch {
    return { data: defaultProfiles(), raw, writable: false,
      error: raw === null ? 'The profile list cannot be saved in this browser session. Your original profile remains available.' : 'The saved profile list could not be read. Your original profile remains available, and the saved list has not been replaced.' };
  }
}

export async function writeProfiles(value, expectedRaw, storage = browserStorage, options = {}) {
  const data = validateProfiles(value);
  try {
    const raw = JSON.stringify(data);
    const result = await storage.compareAndSet(PROFILE_METADATA_KEY, expectedRaw, raw, options);
    if (result === 'conflict') {
      return { ok: false, conflict: true, error: 'The profile list changed in another tab. Review the list and try again.' };
    }
    if (result === 'occupied') return { ok: false, conflict: false, error: 'That profile could not be created. Try again.' };
    return { ok: true, data, raw };
  } catch {
    return { ok: false, conflict: false, error: 'Could not save the profile list. Your current profile is still open.' };
  }
}

export function addProfile(value, name, createId = () => crypto.randomUUID()) {
  const data = validateProfiles(value);
  if (data.profiles.length >= MAX_PROFILES) throw new Error(`This browser supports up to ${MAX_PROFILES} profiles.`);
  const next = { ...data, profiles: [...data.profiles, { id: createId(), name: profileName(name) }] };
  next.activeId = next.profiles.at(-1).id;
  return validateProfiles(next);
}

export function renameProfile(value, id, name) {
  const data = validateProfiles(value);
  if (!data.profiles.some(item => item.id === id)) throw new Error('Choose an existing profile.');
  return validateProfiles({ ...data, profiles: data.profiles.map(item => item.id === id ? { ...item, name: profileName(name) } : item) });
}
