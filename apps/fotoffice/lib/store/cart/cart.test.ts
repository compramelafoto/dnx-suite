import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CART_MAX_LINES,
  CART_MAX_QTY,
  cartReducer,
  cartStorageKey,
  cartTotals,
  clampQty,
  lineKey,
  loadCart,
  parseCartState,
  saveCart,
  type CartLine,
  type CartState,
} from "./index";

const line = (o: Partial<CartLine> = {}): CartLine => ({
  productId: "p1",
  variantId: null,
  slug: "remera",
  name: "Remera",
  variantName: null,
  imageUrl: null,
  unitPriceMinor: 1500000,
  qty: 1,
  ...o,
});
const empty: CartState = { version: 1, lines: [] };

describe("lineKey", () => {
  it("usa '-' sin variante", () => {
    expect(lineKey(line())).toBe("p1:-");
    expect(lineKey(line({ variantId: "v9" }))).toBe("p1:v9");
  });
});

describe("clampQty", () => {
  it("acota a 1..99 y rechaza basura", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(500)).toBe(CART_MAX_QTY);
    expect(clampQty(3.7)).toBe(3);
    expect(clampQty(Number.NaN)).toBe(1);
  });
});

describe("cartReducer", () => {
  it("agrega una línea", () => {
    const s = cartReducer(empty, { type: "add", line: line({ qty: 2 }) });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(2);
  });
  it("une la misma línea sumando y acotando", () => {
    let s = cartReducer(empty, { type: "add", line: line({ qty: 60 }) });
    s = cartReducer(s, { type: "add", line: line({ qty: 60 }) });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(99);
  });
  it("variantes distintas son líneas distintas", () => {
    let s = cartReducer(empty, { type: "add", line: line({ variantId: "a" }) });
    s = cartReducer(s, { type: "add", line: line({ variantId: "b" }) });
    expect(s.lines).toHaveLength(2);
  });
  it("no pasa del máximo de líneas", () => {
    let s = empty;
    for (let i = 0; i < CART_MAX_LINES + 5; i++) {
      s = cartReducer(s, { type: "add", line: line({ productId: `p${i}` }) });
    }
    expect(s.lines).toHaveLength(CART_MAX_LINES);
  });
  it("setQty acota; ignora valores inválidos", () => {
    let s = cartReducer(empty, { type: "add", line: line() });
    s = cartReducer(s, { type: "setQty", key: "p1:-", qty: 1000 });
    expect(s.lines[0].qty).toBe(99);
    s = cartReducer(s, { type: "setQty", key: "p1:-", qty: Number.NaN });
    expect(s.lines[0].qty).toBe(99);
  });
  it("remove, clear y replaceLines", () => {
    let s = cartReducer(empty, { type: "add", line: line() });
    expect(cartReducer(s, { type: "remove", key: "p1:-" }).lines).toHaveLength(0);
    expect(cartReducer(s, { type: "clear" }).lines).toHaveLength(0);
    s = cartReducer(s, { type: "replaceLines", lines: [line({ productId: "x", qty: 500 })] });
    expect(s.lines).toEqual([line({ productId: "x", qty: 99 })]);
  });
  it("replaceLines une duplicadas", () => {
    const s = cartReducer(empty, { type: "replaceLines", lines: [line(), line()] });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(2);
  });
});

describe("cartTotals", () => {
  it("suma unidades y subtotal", () => {
    const s: CartState = {
      version: 1,
      lines: [line({ qty: 2, unitPriceMinor: 1000 }), line({ productId: "p2", qty: 3, unitPriceMinor: 500 })],
    };
    expect(cartTotals(s)).toEqual({ itemsCount: 5, subtotalMinor: 3500 });
    expect(cartTotals(empty)).toEqual({ itemsCount: 0, subtotalMinor: 0 });
  });
});

describe("parseCartState", () => {
  it("acepta un estado válido", () => {
    expect(parseCartState({ version: 1, lines: [line()] })).toEqual({ version: 1, lines: [line()] });
  });
  it.each([null, "x", 5, [], {}, { version: 2, lines: [] }, { version: 1, lines: "no" }, { version: 1, lines: [{ productId: 1 }] }, { version: 1, lines: [line({ unitPriceMinor: -1 })] }, { version: 1, lines: [line({ qty: 0 })] }])(
    "devuelve vacío con %j",
    (raw) => {
      expect(parseCartState(raw)).toEqual(empty);
    },
  );
});

describe("storage", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("clave por institución", () => {
    expect(cartStorageKey("sfpr")).toBe("fotoffice-store-cart:v1:sfpr");
  });
  it("guarda y carga", () => {
    const s: CartState = { version: 1, lines: [line({ qty: 4 })] };
    saveCart("sfpr", s);
    expect(loadCart("sfpr")).toEqual(s);
    expect(loadCart("otra")).toEqual(empty);
  });
  it("JSON roto o esquema inválido da vacío", () => {
    store.set(cartStorageKey("sfpr"), "{no json");
    expect(loadCart("sfpr")).toEqual(empty);
    store.set(cartStorageKey("sfpr"), JSON.stringify({ version: 1, lines: [{}] }));
    expect(loadCart("sfpr")).toEqual(empty);
  });
  it("nunca lanza si localStorage falla", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("x");
        },
        setItem: () => {
          throw new Error("x");
        },
      },
    });
    expect(loadCart("sfpr")).toEqual(empty);
    expect(() => saveCart("sfpr", empty)).not.toThrow();
  });
  it("sin window no lanza", () => {
    vi.unstubAllGlobals();
    expect(loadCart("sfpr")).toEqual(empty);
    expect(() => saveCart("sfpr", empty)).not.toThrow();
  });
});
