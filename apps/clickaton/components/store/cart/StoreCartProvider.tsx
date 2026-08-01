"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  STORE_CART_STORAGE_KEY,
  initialStoreCartUiState,
  readStoreCartFromStorage,
  storeCartReducer,
  sumStoreCartUnits,
  writeStoreCartToStorage,
  type StoreCartHydrationState,
  type StoreCartItem,
  type ValidatedStoreCart,
} from "@/lib/public-store/cart";

type StoreCartContextValue = {
  items: StoreCartItem[];
  itemCount: number;
  isCartOpen: boolean;
  hydrationState: StoreCartHydrationState;
  storageAvailable: boolean;
  announceMessage: string | null;
  lastAddedLineKey: string | null;
  validatedCart: ValidatedStoreCart | null;
  validationState: "idle" | "loading" | "ready" | "error";
  validationError: string | null;
  addItem: (input: {
    productId: string;
    variantId: string | null;
    quantity: number;
    availableStock?: number;
    productLabel?: string;
    variantLabel?: string;
  }) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (
    lineKey: string,
    quantity: number,
    availableStock?: number,
  ) => void;
  clearCart: () => void;
  /** Limpia solo líneas compradas tras PAID canónico (fingerprint + ítems). */
  clearPurchasedLines: (input: {
    commercialFingerprint: string;
    items: Array<{ productId: string; variantId: string | null }>;
  }) => void;
  hasItem: (productId: string, variantId: string | null) => boolean;
  openCart: () => void;
  closeCart: () => void;
  refreshValidation: () => Promise<void>;
  clearAnnounce: () => void;
};

const StoreCartContext = createContext<StoreCartContextValue | null>(null);

export function StoreCartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeCartReducer, initialStoreCartUiState);
  const [validatedCart, setValidatedCart] = useReducer(
    (_prev: ValidatedStoreCart | null, next: ValidatedStoreCart | null) => next,
    null,
  );
  const [validationState, setValidationState] = useReducer(
    (_p: "idle" | "loading" | "ready" | "error", n: "idle" | "loading" | "ready" | "error") => n,
    "idle",
  );
  const [validationError, setValidationError] = useReducer(
    (_p: string | null, n: string | null) => n,
    null,
  );
  const skipNextPersist = useRef(false);
  const openTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const read = readStoreCartFromStorage();
      dispatch({
        type: "HYDRATE",
        items: read.items,
        storageAvailable: read.storageAvailable,
        recovered: read.recovered,
      });
    } catch {
      dispatch({ type: "HYDRATE_ERROR" });
    }
  }, []);

  useEffect(() => {
    if (state.hydrationState !== "ready") return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    writeStoreCartToStorage(state.items);
  }, [state.items, state.hydrationState]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_CART_STORAGE_KEY) return;
      const read = readStoreCartFromStorage();
      skipNextPersist.current = true;
      dispatch({ type: "REPLACE_FROM_STORAGE", items: read.items });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const refreshValidation = useCallback(async () => {
    if (state.hydrationState !== "ready") return;
    if (state.items.length === 0) {
      setValidatedCart(null);
      setValidationState("ready");
      setValidationError(null);
      return;
    }
    setValidationState("loading");
    setValidationError(null);
    try {
      const res = await fetch("/api/store/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        cart?: ValidatedStoreCart;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.cart) {
        setValidationState("error");
        setValidationError(data.error ?? "No se pudo validar el carrito.");
        return;
      }
      setValidatedCart(data.cart);
      setValidationState("ready");

      // Aplicar ajustes de cantidad canónicos solo si difieren del estado local.
      for (const line of data.cart.lines) {
        if (
          line.status === "quantityAdjusted" &&
          line.quantity !== line.requestedQuantity
        ) {
          dispatch({
            type: "UPDATE_QUANTITY",
            lineKey: line.lineKey,
            quantity: line.quantity,
            availableStock: line.availableStock,
          });
        }
      }
    } catch {
      setValidationState("error");
      setValidationError("No se pudo validar el carrito. Reintentá.");
    }
  }, [state.hydrationState, state.items]);

  useEffect(() => {
    if (state.hydrationState !== "ready") return;
    void refreshValidation();
  }, [state.hydrationState, state.items, refreshValidation]);

  const addItem = useCallback(
    (input: {
      productId: string;
      variantId: string | null;
      quantity: number;
      availableStock?: number;
      productLabel?: string;
      variantLabel?: string;
    }) => {
      openTriggerRef.current = document.activeElement as HTMLElement | null;
      dispatch({ type: "ADD_ITEM", ...input });
    },
    [],
  );

  const value = useMemo<StoreCartContextValue>(
    () => ({
      items: state.items,
      itemCount: sumStoreCartUnits(state.items),
      isCartOpen: state.isCartOpen,
      hydrationState: state.hydrationState,
      storageAvailable: state.storageAvailable,
      announceMessage: state.announceMessage,
      lastAddedLineKey: state.lastAddedLineKey,
      validatedCart,
      validationState,
      validationError,
      addItem,
      removeItem: (lineKey) => dispatch({ type: "REMOVE_ITEM", lineKey }),
      updateQuantity: (lineKey, quantity, availableStock) =>
        dispatch({ type: "UPDATE_QUANTITY", lineKey, quantity, availableStock }),
      clearCart: () => dispatch({ type: "CLEAR" }),
      clearPurchasedLines: (input) => {
        try {
          const raw = sessionStorage.getItem("ck_store_pending_clear");
          if (!raw) return;
          const pending = JSON.parse(raw) as {
            commercialFingerprint?: string;
            items?: Array<{ productId: string; variantId: string | null }>;
          };
          if (pending.commercialFingerprint !== input.commercialFingerprint) return;
          dispatch({
            type: "REMOVE_LINES",
            items: pending.items ?? input.items,
          });
          sessionStorage.removeItem("ck_store_pending_clear");
        } catch {
          /* ignore */
        }
      },
      hasItem: (productId, variantId) =>
        state.items.some(
          (i) => i.productId === productId && i.variantId === variantId,
        ),
      openCart: () => {
        openTriggerRef.current = document.activeElement as HTMLElement | null;
        dispatch({ type: "OPEN_CART" });
      },
      closeCart: () => {
        dispatch({ type: "CLOSE_CART" });
        queueMicrotask(() => openTriggerRef.current?.focus?.());
      },
      refreshValidation,
      clearAnnounce: () => dispatch({ type: "CLEAR_ANNOUNCE" }),
    }),
    [
      state,
      validatedCart,
      validationState,
      validationError,
      addItem,
      refreshValidation,
    ],
  );

  return (
    <StoreCartContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state.announceMessage}
      </div>
    </StoreCartContext.Provider>
  );
}

export function useStoreCart(): StoreCartContextValue {
  const ctx = useContext(StoreCartContext);
  if (!ctx) {
    throw new Error("useStoreCart debe usarse dentro de StoreCartProvider.");
  }
  return ctx;
}

/** Hook seguro para zonas opcionales (header siempre envuelto). */
export function useStoreCartOptional(): StoreCartContextValue | null {
  return useContext(StoreCartContext);
}
