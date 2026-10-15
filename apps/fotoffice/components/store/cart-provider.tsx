"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  EMPTY_CART,
  cartReducer,
  cartStorageKey,
  cartTotals,
  loadCart,
  saveCart,
  type CartAction,
  type CartLine,
  type CartState,
} from "@/lib/store/cart";

/**
 * El carrito de la tienda pública: vive en el navegador (`localStorage`, uno por institución) y
 * no en la base. Hasta finalizar la compra no se reserva nada; los precios que guarda son sólo
 * para mostrar, y el carrito y el checkout los revalidan en el servidor.
 *
 * `hydrated` evita dos errores: dibujar en el servidor un carrito que no conoce (el contador
 * aparecería en 0 y saltaría) y pisar lo guardado con el carrito vacío del primer render.
 */
type CartContextValue = {
  workspaceSlug: string;
  state: CartState;
  hydrated: boolean;
  itemsCount: number;
  subtotalMinor: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  replaceLines: (lines: CartLine[]) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

type ProviderState = { cart: CartState; hydrated: boolean };
type ProviderAction = CartAction | { type: "hydrate"; cart: CartState };

/** El carrito más si ya se leyó del navegador; los dos cambian juntos al hidratar. */
function providerReducer(s: ProviderState, a: ProviderAction): ProviderState {
  if (a.type === "hydrate") return { hydrated: true, cart: cartReducer(EMPTY_CART, { type: "replaceLines", lines: a.cart.lines }) };
  return { ...s, cart: cartReducer(s.cart, a) };
}

export function CartProvider({ workspaceSlug, children }: { workspaceSlug: string; children: ReactNode }) {
  const [{ cart: state, hydrated }, dispatch] = useReducer(providerReducer, { cart: EMPTY_CART, hydrated: false });
  // Lo que llega de otra pestaña ya está guardado: no hace falta volver a escribirlo.
  const saltearGuardado = useRef(false);

  useEffect(() => {
    dispatch({ type: "hydrate", cart: loadCart(workspaceSlug) });
  }, [workspaceSlug]);

  useEffect(() => {
    if (!hydrated) return;
    if (saltearGuardado.current) {
      saltearGuardado.current = false;
      return;
    }
    saveCart(workspaceSlug, state);
  }, [state, hydrated, workspaceSlug]);

  // Otra pestaña cambió el carrito: se sigue el cambio para no pisarlo con uno viejo.
  useEffect(() => {
    const clave = cartStorageKey(workspaceSlug);
    function alCambiar(e: StorageEvent) {
      if (e.key !== clave) return;
      saltearGuardado.current = true;
      dispatch({ type: "replaceLines", lines: loadCart(workspaceSlug).lines });
    }
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, [workspaceSlug]);

  const add = useCallback((line: CartLine) => dispatch({ type: "add", line }), []);
  const setQty = useCallback((key: string, qty: number) => dispatch({ type: "setQty", key, qty }), []);
  const remove = useCallback((key: string) => dispatch({ type: "remove", key }), []);
  const replaceLines = useCallback((lines: CartLine[]) => dispatch({ type: "replaceLines", lines }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const value = useMemo<CartContextValue>(() => {
    const t = cartTotals(state);
    return { workspaceSlug, state, hydrated, ...t, add, setQty, remove, replaceLines, clear };
  }, [workspaceSlug, state, hydrated, add, setQty, remove, replaceLines, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart se usa dentro de <CartProvider>.");
  return ctx;
}
