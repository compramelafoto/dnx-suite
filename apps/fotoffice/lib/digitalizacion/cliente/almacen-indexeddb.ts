import type { AlmacenCola, ParteEnCola } from "./cola";

const BASE = "fotoffice-digitalizacion";
const TABLA = "partes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLA, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pedido<T>(db: IDBDatabase, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLA, modo);
    const req = fn(tx.objectStore(TABLA));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Sólo para la grabación de VHS. Un DVD no pasa por acá: sus pedacitos ya están en el disco. */
export function almacenIndexedDb(): AlmacenCola {
  const db = abrir();
  return {
    async guardar(p: ParteEnCola) { await pedido(await db, "readwrite", (s) => s.put(p)); },
    async borrar(id: string) { await pedido(await db, "readwrite", (s) => s.delete(id)); },
    async pendientes() { return (await pedido(await db, "readonly", (s) => s.getAll())) as ParteEnCola[]; },
  };
}
