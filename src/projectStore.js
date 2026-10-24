// Customers' album projects are stored in IndexedDB instead of localStorage.
// localStorage holds only ~5MB per site, and projects contain photos — a
// handful of photos used to fill it, after which saves silently failed while
// the UI still said "Saved". IndexedDB typically allows hundreds of MB.
// Projects saved by the old version (in localStorage) are migrated on first load.

const DB_NAME = "miora";
const STORE = "kv";
const KEY = "projects";
const LEGACY_LOCALSTORAGE_KEY = "miora_projects";

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB blocked"));
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error || (req && req.error));
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  }));
}

function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function loadProjects() {
  let stored;
  try { stored = await run("readonly", s => s.get(KEY)); }
  catch (e) {
    console.warn("IndexedDB unavailable, falling back to localStorage:", e);
    return readLegacy() || [];
  }
  if (Array.isArray(stored)) return stored;
  // First run on this version: migrate anything saved by the old localStorage code.
  const legacy = readLegacy();
  if (Array.isArray(legacy) && legacy.length) {
    await saveProjects(legacy);
    try { localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY); } catch { /* ignore */ }
    return legacy;
  }
  return [];
}

// Resolves when the data is durably written; rejects (e.g. quota exceeded) so
// the UI can tell the customer instead of pretending it saved.
export async function saveProjects(projects) {
  try {
    await run("readwrite", s => s.put(projects, KEY));
  } catch (e) {
    // Last resort only if IndexedDB itself is unavailable (very old browsers /
    // some private modes). This throws on quota errors, which is what we want.
    if (e && e.name === "QuotaExceededError") throw e;
    if (typeof indexedDB !== "undefined" && !(e && /unavailable|blocked/i.test(e.message || ""))) throw e;
    localStorage.setItem(LEGACY_LOCALSTORAGE_KEY, JSON.stringify(projects));
  }
}

// Asks the browser not to evict this site's storage under disk pressure.
export function requestPersistentStorage() {
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}
