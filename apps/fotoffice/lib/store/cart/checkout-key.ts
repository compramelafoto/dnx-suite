import { lineKey, type LineKeyInput } from "./line-key";
import { cartStorageKey } from "./storage";

/**
 * La clave de compra (`clientIdempotencyKey`) que viaja con el checkout. Se genera UNA vez por
 * carrito y se guarda al lado del carrito: un doble clic, volver atrás o reintentar después de un
 * error mandan la misma clave, y el servidor devuelve el mismo pedido en vez de reservar dos veces.
 *
 * Si el carrito cambia (otro producto, otra cantidad, otro talle), la clave cambia: es otra compra.
 * También se renueva cuando el servidor lo pide (el pedido de esa clave ya se pagó o venció).
 */
export type StoredCheckoutKey = { key: string; sig: string };

const LARGO_MINIMO = 16;

/** Qué se compra, sin importar el orden. Precios y nombres no: los pone el servidor. */
export function checkoutLinesSignature(lines: readonly (LineKeyInput & { qty: number })[]): string {
  // `lineKey`: un producto sigue firmando `<productId>:<variantId|->` (las claves guardadas valen).
  return lines
    .map((l) => `${lineKey(l)}=${l.qty}`)
    .sort()
    .join("|");
}

export function resolveCheckoutKey(stored: unknown, sig: string, generate: () => string): StoredCheckoutKey {
  if (typeof stored === "object" && stored !== null) {
    const s = stored as Record<string, unknown>;
    if (typeof s.key === "string" && s.key.length >= LARGO_MINIMO && s.sig === sig) return { key: s.key, sig };
  }
  return { key: generate(), sig };
}

export function checkoutKeyStorageKey(workspaceSlug: string): string {
  return `${cartStorageKey(workspaceSlug)}:checkout-key`;
}

function leer(workspaceSlug: string): unknown {
  try {
    const raw = window.localStorage.getItem(checkoutKeyStorageKey(workspaceSlug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardar(workspaceSlug: string, value: StoredCheckoutKey): void {
  try {
    window.localStorage.setItem(checkoutKeyStorageKey(workspaceSlug), JSON.stringify(value));
  } catch {
    // Almacenamiento bloqueado: la clave vale igual para esta pantalla.
  }
}

/** La clave para este carrito: la guardada si es del mismo carrito, o una nueva (y la guarda). */
export function checkoutKeyFor(workspaceSlug: string, sig: string): string {
  const r = resolveCheckoutKey(leer(workspaceSlug), sig, () => crypto.randomUUID());
  guardar(workspaceSlug, r);
  return r.key;
}

/** Descarta la clave de este carrito y devuelve una nueva. */
export function renewCheckoutKey(workspaceSlug: string, sig: string): string {
  const r = { key: crypto.randomUUID(), sig };
  guardar(workspaceSlug, r);
  return r.key;
}
