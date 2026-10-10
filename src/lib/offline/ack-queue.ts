"use client";

/**
 * Acknowledgements taken offline.
 *
 * An acknowledgement is the one thing an assignee does in the field, often
 * from a venue with no signal. Rather than fail the tap, the queue keeps it
 * in IndexedDB — which survives the tab being closed and the phone being
 * locked, unlike anything held in memory — and replays it when the
 * connection returns, through the ordinary authenticated server action.
 *
 * Nothing else is queued. A write that needs a server decision (publishing,
 * editing, assigning) must not be pretended into existence on a phone.
 */

const DB_NAME = "pr-os-offline";
const STORE = "pending-acks";

export type PendingAck = {
  assignmentId: string;
  assignmentVersion: number;
  eventTitle: string;
  queuedAt: string;
};

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "assignmentId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll(): Promise<PendingAck[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    return await asPromise(tx.objectStore(STORE).getAll() as IDBRequest<PendingAck[]>);
  } catch {
    return [];
  }
}

async function announce() {
  const count = (await readAll()).length;
  for (const listener of listeners) listener(count);
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function pendingAckCount(): Promise<number> {
  return (await readAll()).length;
}

export async function queueAck(ack: PendingAck): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  // keyPath is assignmentId, so a second tap replaces the first rather than
  // queueing a duplicate acknowledgement.
  await asPromise(tx.objectStore(STORE).put(ack) as unknown as IDBRequest<IDBValidKey>);
  await announce();
}

async function removeAck(assignmentId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await asPromise(tx.objectStore(STORE).delete(assignmentId) as unknown as IDBRequest<undefined>);
  await announce();
}

export type AckResult = { ok: true } | { ok: false; error: string };

/**
 * Replays everything queued. `send` is the non-redirecting server action,
 * handed in by the component so this module stays free of server imports.
 *
 * An item is removed only on a clean success. Anything else leaves it
 * queued — better a second attempt later than an acknowledgement that
 * silently never happened. The insert tolerates a duplicate, so replaying
 * one that did land is harmless.
 */
export async function flushAckQueue(
  send: (formData: FormData) => Promise<AckResult>,
): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  for (const ack of await readAll()) {
    const formData = new FormData();
    formData.set("assignmentId", ack.assignmentId);
    formData.set("assignmentVersion", String(ack.assignmentVersion));
    try {
      const result = await send(formData);
      if (!result?.ok) return;
      await removeAck(ack.assignmentId);
    } catch {
      return;
    }
  }
}
