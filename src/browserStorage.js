export const DATABASE_NAME = 'typedo';
export const DATABASE_VERSION = 1;
export const RECORDS_STORE = 'records';
const MIGRATIONS_STORE = 'migrations';
const LEGACY_MIGRATION = 'localStorage:v1';
const legacyKey = key => ['typedo:v1', 'keysteady:v1', 'typedo:profiles:v1'].includes(key)
  || /^typedo:profile:[0-9a-f-]+:v1$/i.test(key);

// Resolve only after commit, including for reads. A successful request can still
// belong to a transaction that later aborts (for example when storage is full).
function transaction(database, stores, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(stores, mode);
    let result, failure;
    const abort = error => { failure = error; tx.abort(); };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error('Browser storage transaction was aborted.'));
    try { work(tx, value => { result = value; }, abort); }
    catch (error) { abort(error); }
  });
}

function openDatabase(indexedDB, name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS_STORE)) db.createObjectStore(RECORDS_STORE);
      if (!db.objectStoreNames.contains(MIGRATIONS_STORE)) db.createObjectStore(MIGRATIONS_STORE);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other Typedo tabs and reload to open browser storage.'));
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
  });
}

function migrateLegacy(database, getLegacyStorage) {
  return transaction(database, [RECORDS_STORE, MIGRATIONS_STORE], 'readwrite', (tx, done, abort) => {
    const migrations = tx.objectStore(MIGRATIONS_STORE);
    const marker = migrations.get(LEGACY_MIGRATION);
    marker.onsuccess = () => {
      if (marker.result) return;
      try {
        const legacy = getLegacyStorage();
        const entries = [];
        for (let index = 0; index < legacy.length; index++) {
          const key = legacy.key(index);
          if (legacyKey(key)) {
            const raw = legacy.getItem(key);
            if (raw !== null) entries.push([key, raw]);
          }
        }
        const records = tx.objectStore(RECORDS_STORE);
        for (const [key, raw] of entries) {
          const existing = records.get(key);
          existing.onsuccess = () => {
            // Keep raw bytes, even for damaged saves, for the recovery download.
            if (existing.result === undefined) records.put(raw, key);
          };
        }
        // This marker commits atomically with every copied record. A failed
        // migration retries next visit; a completed one never reads stale copies.
        migrations.put(true, LEGACY_MIGRATION);
      } catch (error) { abort(error); }
    };
  });
}

export function createBrowserStorage({
  getIndexedDB = () => window.indexedDB,
  getLegacyStorage = () => window.localStorage,
  name = DATABASE_NAME,
} = {}) {
  let connection;
  function ready() {
    if (!connection) {
      const opening = (async () => {
        const database = await openDatabase(getIndexedDB(), name);
        const invalidate = () => { database.close(); connection = undefined; };
        database.onversionchange = invalidate;
        database.onclose = invalidate;
        try { await migrateLegacy(database, getLegacyStorage); }
        catch (error) { database.close(); throw error; }
        return database;
      })();
      connection = opening;
      opening.catch(() => { if (connection === opening) connection = undefined; });
    }
    return connection;
  }

  return {
    async getItem(key) {
      const database = await ready();
      return transaction(database, RECORDS_STORE, 'readonly', (tx, done) => {
        const request = tx.objectStore(RECORDS_STORE).get(key);
        request.onsuccess = () => done(request.result ?? null);
      });
    },
    async setItem(key, value) {
      const database = await ready();
      return transaction(database, RECORDS_STORE, 'readwrite', tx => {
        tx.objectStore(RECORDS_STORE).put(value, key);
      });
    },
    async compareAndSet(key, expected, value, { absentKey } = {}) {
      const database = await ready();
      return transaction(database, RECORDS_STORE, 'readwrite', (tx, done) => {
        const records = tx.objectStore(RECORDS_STORE);
        const current = records.get(key);
        current.onsuccess = () => {
          if ((current.result ?? null) !== expected) { done('conflict'); return; }
          const save = () => { records.put(value, key); done('saved'); };
          if (!absentKey) { save(); return; }
          const existing = records.get(absentKey);
          existing.onsuccess = () => {
            if (existing.result !== undefined) done('occupied');
            else save();
          };
        };
      });
    },
    async close() {
      const current = connection;
      connection = undefined;
      if (current) (await current.catch(() => null))?.close();
    },
  };
}

export const browserStorage = createBrowserStorage();
