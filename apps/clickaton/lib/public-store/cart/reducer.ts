import { STORE_CART_MAX_LINES } from "@/lib/public-store/cart/constants";
import { storeCartLineKey } from "@/lib/public-store/cart/line-key";
import { clampStoreCartQuantity } from "@/lib/public-store/cart/quantities";
import type { StoreCartItem, StoreCartUiState } from "@/lib/public-store/cart/types";

export type StoreCartAction =
  | {
      type: "HYDRATE";
      items: StoreCartItem[];
      storageAvailable: boolean;
      recovered: boolean;
    }
  | { type: "HYDRATE_ERROR" }
  | {
      type: "ADD_ITEM";
      productId: string;
      variantId: string | null;
      quantity: number;
      availableStock?: number;
      productLabel?: string;
      variantLabel?: string;
    }
  | { type: "REMOVE_ITEM"; lineKey: string }
  | {
      type: "UPDATE_QUANTITY";
      lineKey: string;
      quantity: number;
      availableStock?: number;
    }
  | { type: "CLEAR" }
  | {
      type: "REMOVE_LINES";
      items: Array<{ productId: string; variantId: string | null }>;
    }
  | { type: "OPEN_CART" }
  | { type: "CLOSE_CART" }
  | { type: "REPLACE_FROM_STORAGE"; items: StoreCartItem[] }
  | { type: "CLEAR_ANNOUNCE" };

export const initialStoreCartUiState: StoreCartUiState = {
  items: [],
  isCartOpen: false,
  hydrationState: "loading",
  storageAvailable: true,
  lastAddedLineKey: null,
  announceMessage: null,
};

export function storeCartReducer(
  state: StoreCartUiState,
  action: StoreCartAction,
): StoreCartUiState {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        items: action.items,
        storageAvailable: action.storageAvailable,
        hydrationState: "ready",
        announceMessage: action.recovered
          ? "Se recuperó el carrito con datos incompletos."
          : state.announceMessage,
      };
    case "HYDRATE_ERROR":
      return {
        ...state,
        items: [],
        hydrationState: "error",
        storageAvailable: false,
        announceMessage: "No se pudo cargar el carrito guardado.",
      };
    case "ADD_ITEM": {
      if (state.hydrationState !== "ready") return state;
      const clamped = clampStoreCartQuantity({
        quantity: action.quantity,
        availableStock: action.availableStock,
      });
      if (!clamped.ok && clamped.reason === "above_stock" && (action.availableStock ?? 0) <= 0) {
        return {
          ...state,
          announceMessage: "Esa opción no tiene stock disponible.",
        };
      }
      const quantity = clamped.quantity;
      const lineKey = storeCartLineKey(action.productId, action.variantId);
      const existing = state.items.find((i) => i.lineKey === lineKey);
      let nextItems: StoreCartItem[];
      if (existing) {
        const merged = clampStoreCartQuantity({
          quantity: existing.quantity + quantity,
          availableStock: action.availableStock,
        });
        nextItems = state.items.map((i) =>
          i.lineKey === lineKey ? { ...i, quantity: merged.quantity } : i,
        );
      } else {
        if (state.items.length >= STORE_CART_MAX_LINES) {
          return {
            ...state,
            announceMessage: `Podés tener hasta ${STORE_CART_MAX_LINES} productos distintos en el carrito.`,
          };
        }
        nextItems = [
          ...state.items,
          {
            productId: action.productId,
            variantId: action.variantId,
            quantity,
            addedAt: new Date().toISOString(),
            lineKey,
          },
        ];
      }
      const label = [action.productLabel, action.variantLabel]
        .filter(Boolean)
        .join(" · ");
      return {
        ...state,
        items: nextItems,
        isCartOpen: true,
        lastAddedLineKey: lineKey,
        announceMessage: label
          ? `Agregaste ${quantity} × ${label} al carrito.`
          : `Agregaste ${quantity} unidad${quantity === 1 ? "" : "es"} al carrito.`,
      };
    }
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.lineKey !== action.lineKey),
        announceMessage: "Producto eliminado del carrito.",
      };
    case "UPDATE_QUANTITY": {
      const clamped = clampStoreCartQuantity({
        quantity: action.quantity,
        availableStock: action.availableStock,
      });
      if (!clamped.ok && clamped.reason === "below_min") {
        return {
          ...state,
          items: state.items.filter((i) => i.lineKey !== action.lineKey),
          announceMessage: "Producto eliminado del carrito.",
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.lineKey === action.lineKey
            ? { ...i, quantity: clamped.quantity }
            : i,
        ),
        announceMessage: "Cantidad actualizada.",
      };
    }
    case "CLEAR":
      return {
        ...state,
        items: [],
        announceMessage: "Vaciaste el carrito.",
      };
    case "REMOVE_LINES": {
      const keys = new Set(
        action.items.map((i) => storeCartLineKey(i.productId, i.variantId)),
      );
      const next = state.items.filter((i) => !keys.has(i.lineKey));
      if (next.length === state.items.length) return state;
      return {
        ...state,
        items: next,
        announceMessage: "Se quitaron del carrito los productos ya comprados.",
      };
    }
    case "OPEN_CART":
      return { ...state, isCartOpen: true };
    case "CLOSE_CART":
      return { ...state, isCartOpen: false };
    case "REPLACE_FROM_STORAGE":
      return {
        ...state,
        items: action.items,
        hydrationState: "ready",
      };
    case "CLEAR_ANNOUNCE":
      return { ...state, announceMessage: null };
    default:
      return state;
  }
}
