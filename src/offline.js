export const OFFLINE_CACHE_PREFIX = 'typedo-offline-';

export function workerMessage(worker, message, timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (!worker || typeof MessageChannel === 'undefined') { reject(new Error('Offline messaging is unavailable.')); return; }
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline setup did not respond. Try again while online.')); }, timeout);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
    try { worker.postMessage(message, [channel.port2]); }
    catch (error) { clearTimeout(timer); channel.port1.close(); reject(error); }
  });
}

export function appWorker(registration, scriptURL) {
  return [registration?.active, registration?.waiting, registration?.installing].some(worker => worker?.scriptURL === scriptURL);
}

export async function removeOfflineDownload(registration, cacheStorage = caches) {
  await registration.unregister();
  for (const name of await cacheStorage.keys()) {
    if (name.startsWith(OFFLINE_CACHE_PREFIX)) await cacheStorage.delete(name);
  }
}
