export const SAVE_FAILED_MESSAGE = 'Browser storage is unavailable. Your work is kept in this tab. Retry saving or export your progress before leaving.';
export const SAVE_CONFLICT_MESSAGE = 'Another tab changed this profile. Saving is paused so neither tab overwrites the other. Export this tab\'s progress before loading the saved version.';

// Keep one transaction in flight and one latest checkpoint behind it. Every
// caller waits for its checkpoint (or a newer one) to commit before seeing Saved.
export function createProgressWriter(storage, storageKey, initialRaw) {
  let expectedRaw = initialRaw;
  let pending = null;
  let running = false;
  let conflicted = false;

  async function drain() {
    running = true;
    while (pending) {
      const checkpoint = pending;
      pending = null;
      let result;
      if (conflicted) result = { status: 'conflict', message: SAVE_CONFLICT_MESSAGE };
      else {
        try {
          const outcome = await storage.compareAndSet(storageKey, expectedRaw, checkpoint.raw);
          if (outcome !== 'saved') {
            conflicted = true;
            result = { status: 'conflict', message: SAVE_CONFLICT_MESSAGE };
          } else {
            expectedRaw = checkpoint.raw;
            result = { status: 'saved', message: '' };
          }
        } catch {
          result = { status: 'unavailable', message: SAVE_FAILED_MESSAGE };
        }
      }
      for (const resolve of checkpoint.waiters) resolve(result);
    }
    running = false;
  }

  return {
    save(progress) {
      if (conflicted) return Promise.resolve({ status: 'conflict', message: SAVE_CONFLICT_MESSAGE });
      let raw;
      try { raw = JSON.stringify(progress); }
      catch { return Promise.resolve({ status: 'unavailable', message: SAVE_FAILED_MESSAGE }); }
      return new Promise(resolve => {
        if (pending) {
          pending.raw = raw;
          pending.waiters.push(resolve);
        } else pending = { raw, waiters: [resolve] };
        if (!running) void drain();
      });
    },
  };
}
