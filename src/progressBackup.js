// Compact JSON leaves room for the bounded profile collections: 100 workspace
// drafts (100k text + typed text and 1,000 samples each), 12 lesson drafts
// (7,200 samples each), 500 results, and 64 learning samples per lesson.
// Keep one UTF-8 byte ceiling for downloads and uploads so every exported
// backup can be read back, while unusually large inputs remain bounded.
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export const BACKUP_SIZE_MESSAGE = 'Typedo backups must be 64 MiB or smaller. Your progress has not been changed.';

function checkSize(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_BACKUP_BYTES) throw new Error(BACKUP_SIZE_MESSAGE);
}

function checkTextSize(text) {
  checkSize(text.length);
  checkSize(new TextEncoder().encode(text).byteLength);
}

export function serializeProgressBackup(progress) {
  const text = JSON.stringify(progress);
  checkTextSize(text);
  return text;
}

export async function readProgressBackup(file) {
  // Check the browser's byte count before allocating or parsing file contents.
  checkSize(file.size);
  const text = await file.text();
  checkTextSize(text);
  return JSON.parse(text);
}
