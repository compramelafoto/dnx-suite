import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CART_MAX_ARTWORK_QTY,
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
  cartLineDetail,
  cartLineHref,
  cartLineName,
  type ArtworkCartLine,
  type CartState,
  type ProductCartLine,
} from "./index";

const line = (o: Partial<ProductCartLine> = {}): ProductCartLine => ({
  kind: "product",
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
const obra = (o: Partial<ArtworkCartLine> = {}): ArtworkCartLine => ({
  kind: "artwork",
  artworkListingId: "l1",
  printFormatId: "f1",
  slug: "atardecer",
  title: "Atardecer",
  formatName: "Copia 30 × 45",
  imageUrl: "https://r2/preview.jpg",
  unitPriceMinor: 4500000,
  qty: 1,
  ...o,
});
const empty: CartState = { version: 1, lines: [] };

describe("lineKey", () => {
  it("usa '-' sin variante", () => {
    expect(lineKey(line())).toBe("p1:-");
    expect(lineKey(line({ variantId: "v9" }))).toBe("p1:v9");
  });
  it("sin kind es un producto (pedidos y retenciones)", () => {
    expect(lineKey({ productId: "p1", variantId: null })).toBe("p1:-");
  });
  it("obra: a:<listing>:<formato>", () => {
    expect(lineKey(obra())).toBe("a:l1:f1");
    expect(lineKey(obra({ printFormatId: "f2" }))).not.toBe(lineKey(obra()));
  });
});

describe("nombre, detalle y ficha de la línea", () => {
  it("producto", () => {
    expect(cartLineName(line())).toBe("Remera");
    expect(cartLineDetail(line())).toBeNull();
    expect(cartLineDetail(line({ variantName: "M" }))).toBe("Talle M");
    expect(cartLineHref("/w/x/tienda", line())).toBe("/w/x/tienda/remera");
  });
  it("obra", () => {
    expect(cartLineName(obra())).toBe("Atardecer");
    expect(cartLineDetail(obra())).toBe("Copia 30 × 45");
    expect(cartLineHref("/w/x/tienda", obra())).toBe("/w/x/tienda/obras/atardecer");
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
  it("una obra se acota a 20 copias por formato; otro formato es otra línea", () => {
    let s = cartReducer(empty, { type: "add", line: obra({ qty: 15 }) });
    s = cartReducer(s, { type: "add", line: obra({ qty: 15 }) });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(CART_MAX_ARTWORK_QTY);
    s = cartReducer(s, { type: "setQty", key: "a:l1:f1", qty: 50 });
    expect(s.lines[0].qty).toBe(20);
    s = cartReducer(s, { type: "add", line: obra({ printFormatId: "f2" }) });
    expect(s.lines).toHaveLength(2);
  });
  it("producto y obra conviven", () => {
    let s = cartReducer(empty, { type: "add", line: line() });
    s = cartReducer(s, { type: "add", line: obra() });
    expect(s.lines.map((l) => l.kind)).toEqual(["product", "artwork"]);
    expect(cartTotals(s)).toEqual({ itemsCount: 2, subtotalMinor: 1500000 + 4500000 });
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
    expect(parseCartState({ version: 1, lines: [line(), obra()] })).toEqual({ version: 1, lines: [line(), obra()] });
  });
  it("un carrito guardado antes de las obras (sin kind) se lee como productos", () => {
    const { kind: _kind, ...viejo } = line({ variantId: "v1", variantName: "M", qty: 3 });
    void _kind;
    expect(parseCartState(JSON.parse(JSON.stringify({ version: 1, lines: [viejo] })))).toEqual({
      version: 1,
      lines: [line({ variantId: "v1", variantName: "M", qty: 3 })],
    });
  });
  it.each([
    { kind: "otra" },
    { kind: "artwork", artworkListingId: "" },
    { kind: "artwork", printFormatId: 3 },
    { kind: "artwork", qty: 21 },
    { kind: "artwork", title: null },
  ])("una obra inválida (%j) vacía el carrito", (o) => {
    expect(parseCartState({ version: 1, lines: [{ ...obra(), ...o }] })).toEqual(empty);
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
