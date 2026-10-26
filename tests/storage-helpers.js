import { IDBFactory } from 'fake-indexeddb';
import { createBrowserStorage } from '../src/browserStorage.js';

export function testStorage(legacy) {
  const indexedDB = new IDBFactory();
  return createBrowserStorage({ getIndexedDB: () => indexedDB, getLegacyStorage: () => legacy });
}

// IndexedDB completes on later tasks, outside React's render queue. Wait for
// observable UI state instead of assuming that act() has drained the database.
export async function settleStorage(React) {
  for (let attempt = 0; attempt < 200; attempt++) {
    await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    if (!document.querySelector('.storage-loading')
      && !document.querySelector('.sidebar-local')?.textContent.includes('Saving')) return;
  }
  throw new Error('Storage did not settle');
}
