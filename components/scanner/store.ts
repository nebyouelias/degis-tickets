/**
 * Scanner local storage (IndexedDB).
 * Holds the pairing, the ticket manifest, local check-in state, and the queue of
 * scans waiting to sync. Everything the door needs when the network is gone.
 */

const DB_NAME = "degis-scanner";
const DB_VERSION = 1;
const STORE_META = "meta";
const STORE_TICKETS = "tickets";
const STORE_QUEUE = "queue";

export type Pairing = {
  deviceId: string;
  deviceToken: string;
  gate: string;
  event: { id: string; title: string; startsAt: string; venue: string };
  eventSecret: string;
  publicKey: string;
  stepSeconds: number;
  serverTimeOffset: number; // serverTime - clientTime at pairing
};

export type LocalTicket = {
  id: string;
  code: string;
  tier: string;
  kind: string;
  holder: string;
  status: string;
  checkedInAt: string | null;
  scannedHere?: boolean;
};

export type QueuedScan = {
  clientScanId: string;
  ticketId: string | null;
  result: string;
  scannedAt: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_TICKETS))
        db.createObjectStore(STORE_TICKETS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_QUEUE))
        db.createObjectStore(STORE_QUEUE, { keyPath: "clientScanId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// ---------- pairing ----------

export const savePairing = (p: Pairing) =>
  tx(STORE_META, "readwrite", (s) => s.put(p, "pairing"));

export const loadPairing = () =>
  tx<Pairing | undefined>(STORE_META, "readonly", (s) => s.get("pairing"));

export const clearAll = async () => {
  const db = await open();
  await Promise.all(
    [STORE_META, STORE_TICKETS, STORE_QUEUE].map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const req = db.transaction(name, "readwrite").objectStore(name).clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
};

export const saveCursor = (iso: string) =>
  tx(STORE_META, "readwrite", (s) => s.put(iso, "cursor"));

export const loadCursor = () =>
  tx<string | undefined>(STORE_META, "readonly", (s) => s.get("cursor"));

// ---------- manifest ----------

export async function saveManifest(tickets: LocalTicket[]) {
  const db = await open();
  const t = db.transaction(STORE_TICKETS, "readwrite");
  const store = t.objectStore(STORE_TICKETS);
  for (const ticket of tickets) store.put(ticket);
  return new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export const getTicket = (id: string) =>
  tx<LocalTicket | undefined>(STORE_TICKETS, "readonly", (s) => s.get(id));

export const putTicket = (ticket: LocalTicket) =>
  tx(STORE_TICKETS, "readwrite", (s) => s.put(ticket));

export const allTickets = () =>
  tx<LocalTicket[]>(STORE_TICKETS, "readonly", (s) => s.getAll());

/** Manual door lookup by the printed DGS-XXXXXX code. */
export async function findByCode(code: string): Promise<LocalTicket | null> {
  const wanted = code.trim().toUpperCase();
  const tickets = await allTickets();
  return (
    tickets.find((t) => t.code.toUpperCase() === wanted) ??
    tickets.find((t) => t.code.toUpperCase().endsWith(wanted)) ??
    null
  );
}

// ---------- scan queue ----------

export const enqueueScan = (scan: QueuedScan) =>
  tx(STORE_QUEUE, "readwrite", (s) => s.put(scan));

export const queuedScans = () =>
  tx<QueuedScan[]>(STORE_QUEUE, "readonly", (s) => s.getAll());

export async function dequeueScans(ids: string[]) {
  const db = await open();
  const t = db.transaction(STORE_QUEUE, "readwrite");
  const store = t.objectStore(STORE_QUEUE);
  for (const id of ids) store.delete(id);
  return new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
