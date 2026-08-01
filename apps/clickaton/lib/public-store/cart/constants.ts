/**
 * Constantes del carrito TIENDA (presentación + límites de abuso).
 * No hay límite de dominio previo en Clickatón — documentado aquí.
 */

/** Máximo de unidades por línea (antes de capar por stock). */
export const STORE_CART_MAX_QUANTITY_PER_LINE = 10;

/** Máximo de líneas persistidas / aceptadas en cliente. */
export const STORE_CART_MAX_LINES = 30;

/** Máximo de ítems aceptados en POST /api/store/cart/validate. */
export const STORE_CART_VALIDATE_MAX_ITEMS = 40;

/** Schema versionado de localStorage. */
export const STORE_CART_SCHEMA_VERSION = 1 as const;

export const STORE_CART_PLATFORM = "clickaton" as const;

/** Clave: dnx-store-cart:v1:clickaton */
export const STORE_CART_STORAGE_KEY = `dnx-store-cart:v${STORE_CART_SCHEMA_VERSION}:${STORE_CART_PLATFORM}`;

/** Identidad de línea cuando el producto no tiene variante. */
export const STORE_CART_DEFAULT_VARIANT_KEY = "__default__";
