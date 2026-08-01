import {
  STORE_CART_PLATFORM,
  STORE_CART_SCHEMA_VERSION,
  STORE_CART_STORAGE_KEY,
} from "@/lib/public-store/cart/constants";
import {
  parsePersistedStoreCart,
  toStoreCartItems,
} from "@/lib/public-store/cart/schema";
import type {
  StoreCartItem,
  StoreCartPersistedState,
} from "@/lib/public-store/cart/types";

export type StoreCartStorageRead = {
  items: StoreCartItem[];
  updatedAt: string | null;
  storageAvailable: boolean;
  recovered: boolean;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStoreCartFromStorage(): StoreCartStorageRead {
  if (!canUseStorage()) {
    return {
      items: [],
      updatedAt: null,
      storageAvailable: false,
      recovered: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORE_CART_STORAGE_KEY);
    if (!raw) {
      return {
        items: [],
        updatedAt: null,
        storageAvailable: true,
        recovered: false,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(STORE_CART_STORAGE_KEY);
      return {
        items: [],
        updatedAt: null,
        storageAvailable: true,
        recovered: true,
      };
    }
    const { state, recovered } = parsePersistedStoreCart(parsed);
    if (recovered) {
      writeStoreCartToStorage(toStoreCartItems(state));
    }
    return {
      items: toStoreCartItems(state),
      updatedAt: state.updatedAt,
      storageAvailable: true,
      recovered,
    };
  } catch {
    return {
      items: [],
      updatedAt: null,
      storageAvailable: false,
      recovered: true,
    };
  }
}

export function writeStoreCartToStorage(items: StoreCartItem[]): boolean {
  if (!canUseStorage()) return false;
  const envelope: StoreCartPersistedState = {
    version: STORE_CART_SCHEMA_VERSION,
    platform: STORE_CART_PLATFORM,
    items: items.map(({ productId, variantId, quantity, addedAt }) => ({
      productId,
      variantId,
      quantity,
      addedAt,
    })),
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORE_CART_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearStoreCartStorage(): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.removeItem(STORE_CART_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
