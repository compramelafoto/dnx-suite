import { CART_MAX_LINES, CART_SCHEMA_VERSION } from "./constants";
import { lineKey, maxQtyForLine } from "./line-key";
import { clampQty } from "./quantities";
import type { CartAction, CartLine, CartState } from "./types";

export const EMPTY_CART: CartState = { version: CART_SCHEMA_VERSION, lines: [] };

function merge(lines: CartLine[], incoming: CartLine): CartLine[] {
  const key = lineKey(incoming);
  const i = lines.findIndex((l) => lineKey(l) === key);
  if (i >= 0) {
    const next = lines.slice();
    next[i] = { ...lines[i], qty: clampQty(lines[i].qty + incoming.qty, maxQtyForLine(lines[i])) };
    return next;
  }
  if (lines.length >= CART_MAX_LINES) return lines;
  return [...lines, { ...incoming, qty: clampQty(incoming.qty, maxQtyForLine(incoming)) }];
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add":
      return { ...state, lines: merge(state.lines, action.line) };
    case "setQty": {
      if (!Number.isFinite(action.qty)) return state;
      return {
        ...state,
        lines: state.lines.map((l) =>
          lineKey(l) === action.key ? { ...l, qty: clampQty(action.qty, maxQtyForLine(l)) } : l,
        ),
      };
    }
    case "remove":
      return { ...state, lines: state.lines.filter((l) => lineKey(l) !== action.key) };
    case "clear":
      return { ...state, lines: [] };
    case "replaceLines":
      return { ...state, lines: action.lines.reduce(merge, [] as CartLine[]) };
  }
}
