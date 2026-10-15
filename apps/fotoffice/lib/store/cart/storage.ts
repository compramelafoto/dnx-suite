import { CART_SCHEMA_VERSION, CART_STORAGE_PREFIX } from "./constants";
import { parseCartState } from "./schema";
import type { CartState } from "./types";

export function cartStorageKey(workspaceSlug: string): string {
  return `${CART_STORAGE_PREFIX}:v${CART_SCHEMA_VERSION}:${workspaceSlug}`;
}

const empty = (): CartState => ({ version: CART_SCHEMA_VERSION, lines: [] });

export function loadCart(workspaceSlug: string): CartState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(cartStorageKey(workspaceSlug));
    if (!raw) return empty();
    return parseCartState(JSON.parse(raw));
  } catch {
    return empty();
  }
}

export function saveCart(workspaceSlug: string, state: CartState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cartStorageKey(workspaceSlug), JSON.stringify(state));
  } catch {
    // Almacenamiento lleno o bloqueado: el carrito sigue en memoria.
  }
}
