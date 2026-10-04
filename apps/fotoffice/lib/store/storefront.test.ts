import { describe, expect, it } from "vitest";
import {
  buildStoreProductCard,
  buildStoreProductDetail,
  checkCartLines,
  maxAddableQty,
  sumReserved,
  type StorefrontProductRow,
} from "./storefront";

const dec = (s: string) => ({ toString: () => s });

const row = (o: Partial<StorefrontProductRow> = {}): StorefrontProductRow => ({
  id: "p1",
  name: "Remera interna",
  description: "Descripción del mostrador",
  priceArs: dec("15000.00"),
  tracksStock: true,
  stockQty: 5,
  imageUrl: "https://img/legacy.jpg",
  category: { id: "c1", name: "Indumentaria" },
  listing: {
    slug: "remera",
    onlineTitle: null,
    onlineDescription: null,
    sizeChartImageUrl: null,
    maxPerOrder: null,
  },
  images: [],
  variants: [],
  ...o,
});

const conTalles = (o: Partial<StorefrontProductRow> = {}) =>
  row({
    stockQty: 7,
    variants: [
      { id: "vS", name: "S", priceArs: null, stockQty: 0 },
      { id: "vM", name: "M", priceArs: dec("14000.50"), stockQty: 3 },
      { id: "vL", name: "L", priceArs: dec("16000"), stockQty: 4 },
    ],
    ...o,
  });

const sinReservas = new Map<string, number>();

describe("sumReserved", () => {
  it("suma por clave de línea y saltea productos borrados", () => {
    const m = sumReserved([
      { productId: "p1", variantId: null, qty: 2 },
      { productId: "p1", variantId: null, qty: 1 },
      { productId: "p1", variantId: "v1", qty: 4 },
      { productId: null, variantId: null, qty: 9 },
    ]);
    expect(m).toEqual(
      new Map([
        ["p1:-", 3],
        ["p1:v1", 4],
      ]),
    );
  });
});

describe("buildStoreProductCard", () => {
  it("sin talles: precio del producto, título online o nombre, imagen de respaldo", () => {
    expect(buildStoreProductCard(row(), sinReservas)).toEqual({
      productId: "p1",
      slug: "remera",
      title: "Remera interna",
      imageUrl: "https://img/legacy.jpg",
      fromPriceMinor: 1500000,
      soldOut: false,
      categoryName: "Indumentaria",
    });
  });

  it("usa el título online y la primera imagen de la galería", () => {
    const c = buildStoreProductCard(
      row({
        listing: { ...row().listing, onlineTitle: "Remera oficial" },
        images: [
          { url: "https://img/1.jpg", alt: null },
          { url: "https://img/2.jpg", alt: null },
        ],
      }),
      sinReservas,
    );
    expect(c.title).toBe("Remera oficial");
    expect(c.imageUrl).toBe("https://img/1.jpg");
  });

  it("un título online en blanco no pisa el nombre", () => {
    const c = buildStoreProductCard(row({ listing: { ...row().listing, onlineTitle: "  " } }), sinReservas);
    expect(c.title).toBe("Remera interna");
  });

  it("con talles: 'desde' es el mínimo entre los talles activos (con el heredado)", () => {
    expect(buildStoreProductCard(conTalles(), sinReservas).fromPriceMinor).toBe(1400050);
    const heredaMasBarato = conTalles({ priceArs: dec("9000") });
    expect(buildStoreProductCard(heredaMasBarato, sinReservas).fromPriceMinor).toBe(900000);
  });

  it("agotado sin talles cuando las reservas se comen el stock", () => {
    expect(buildStoreProductCard(row(), new Map([["p1:-", 5]])).soldOut).toBe(true);
    expect(buildStoreProductCard(row({ stockQty: 0 }), sinReservas).soldOut).toBe(true);
  });

  it("sin control de stock nunca está agotado", () => {
    expect(buildStoreProductCard(row({ tracksStock: false, stockQty: -3 }), sinReservas).soldOut).toBe(false);
  });

  it("con talles: agotado sólo si todos los talles lo están", () => {
    expect(buildStoreProductCard(conTalles(), sinReservas).soldOut).toBe(false);
    const reservas = new Map([
      ["p1:vM", 3],
      ["p1:vL", 10],
    ]);
    expect(buildStoreProductCard(conTalles(), reservas).soldOut).toBe(true);
  });

  it("sin categoría", () => {
    expect(buildStoreProductCard(row({ category: null }), sinReservas).categoryName).toBeNull();
  });
});

describe("buildStoreProductDetail", () => {
  it("sin talles: disponible del producto y lista de talles vacía", () => {
    const d = buildStoreProductDetail(
      row({
        listing: {
          slug: "remera",
          onlineTitle: null,
          onlineDescription: "Online",
          sizeChartImageUrl: "https://img/talles.png",
          maxPerOrder: 2,
        },
        images: [{ url: "https://img/1.jpg", alt: "Frente" }],
      }),
      new Map([["p1:-", 2]]),
    );
    expect(d).toEqual({
      productId: "p1",
      slug: "remera",
      title: "Remera interna",
      description: "Online",
      categoryName: "Indumentaria",
      images: [{ url: "https://img/1.jpg", alt: "Frente" }],
      sizeChartImageUrl: "https://img/talles.png",
      maxPerOrder: 2,
      priceMinor: 1500000,
      available: 3,
      variants: [],
      soldOut: false,
    });
  });

  it("descripción del mostrador si no hay online; galería con la imagen vieja si está vacía", () => {
    const d = buildStoreProductDetail(row(), sinReservas);
    expect(d.description).toBe("Descripción del mostrador");
    expect(d.images).toEqual([{ url: "https://img/legacy.jpg", alt: null }]);
  });

  it("con talles: precio y disponible de cada uno; el producto no tiene disponible propio", () => {
    const d = buildStoreProductDetail(conTalles(), new Map([["p1:vL", 1]]));
    expect(d.available).toBeNull();
    expect(d.variants).toEqual([
      { id: "vS", name: "S", priceMinor: 1500000, available: 0 },
      { id: "vM", name: "M", priceMinor: 1400050, available: 3 },
      { id: "vL", name: "L", priceMinor: 1600000, available: 3 },
    ]);
    expect(d.priceMinor).toBe(1400050);
  });

  it("sin control de stock: disponible null (sin límite)", () => {
    const d = buildStoreProductDetail(conTalles({ tracksStock: false }), sinReservas);
    expect(d.variants.map((v) => v.available)).toEqual([null, null, null]);
  });
});

describe("maxAddableQty", () => {
  it("acota a disponible, máximo por compra y lo que ya está en el carrito", () => {
    expect(maxAddableQty({ available: null, maxPerOrder: null, inCartLine: 0, inCartProduct: 0 })).toBe(99);
    expect(maxAddableQty({ available: 4, maxPerOrder: null, inCartLine: 1, inCartProduct: 1 })).toBe(3);
    expect(maxAddableQty({ available: 10, maxPerOrder: 3, inCartLine: 0, inCartProduct: 2 })).toBe(1);
    expect(maxAddableQty({ available: 2, maxPerOrder: 3, inCartLine: 2, inCartProduct: 2 })).toBe(0);
    expect(maxAddableQty({ available: null, maxPerOrder: null, inCartLine: 98, inCartProduct: 98 })).toBe(1);
  });
});

describe("checkCartLines", () => {
  const catalogo = (...rows: StorefrontProductRow[]) => new Map(rows.map((r) => [r.id, r]));

  it("línea correcta: precio y datos del servidor, sin problemas", () => {
    const r = checkCartLines(catalogo(row()), [{ productId: "p1", variantId: null, qty: 2, unitPriceMinor: 1500000 }], sinReservas);
    expect(r.problems).toEqual([]);
    expect(r.lines).toEqual([
      {
        key: "p1:-",
        productId: "p1",
        variantId: null,
        slug: "remera",
        name: "Remera interna",
        variantName: null,
        imageUrl: "https://img/legacy.jpg",
        unitPriceMinor: 1500000,
        qty: 2,
        available: 5,
        maxQty: 5,
      },
    ]);
  });

  it("producto que ya no se vende: se quita y avisa con el nombre que traía", () => {
    const r = checkCartLines(catalogo(), [{ productId: "px", variantId: null, qty: 1, name: "Taza" }], sinReservas);
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual([{ key: "px:-", message: "Taza ya no está a la venta." }]);
  });

  it("producto con talles pedido sin talle, o talle inexistente: se quita", () => {
    const r = checkCartLines(
      catalogo(conTalles()),
      [
        { productId: "p1", variantId: null, qty: 1 },
        { productId: "p1", variantId: "vXL", qty: 1 },
      ],
      sinReservas,
    );
    expect(r.lines).toEqual([]);
    expect(r.problems.map((p) => p.key)).toEqual(["p1:-", "p1:vXL"]);
  });

  it("producto sin talles pedido con talle: se quita", () => {
    const r = checkCartLines(catalogo(row()), [{ productId: "p1", variantId: "v1", qty: 1 }], sinReservas);
    expect(r.lines).toEqual([]);
    expect(r.problems).toHaveLength(1);
  });

  it("agotado: se quita y avisa", () => {
    const r = checkCartLines(catalogo(conTalles()), [{ productId: "p1", variantId: "vS", qty: 1 }], sinReservas);
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual([{ key: "p1:vS", message: "Remera interna (S) se agotó." }]);
  });

  it("más que lo disponible: ajusta la cantidad y avisa", () => {
    const r = checkCartLines(
      catalogo(conTalles()),
      [{ productId: "p1", variantId: "vM", qty: 5 }],
      new Map([["p1:vM", 1]]),
    );
    expect(r.lines[0].qty).toBe(2);
    expect(r.lines[0].variantName).toBe("M");
    expect(r.problems).toEqual([{ key: "p1:vM", message: "Quedan 2 de Remera interna (M): ajustamos la cantidad." }]);
  });

  it("máximo por compra: cuenta todos los talles del producto juntos", () => {
    const r = checkCartLines(
      catalogo(conTalles({ listing: { ...row().listing, maxPerOrder: 3 } })),
      [
        { productId: "p1", variantId: "vM", qty: 2 },
        { productId: "p1", variantId: "vL", qty: 2 },
      ],
      sinReservas,
    );
    expect(r.lines.map((l) => [l.key, l.qty, l.maxQty])).toEqual([
      ["p1:vM", 2, 3],
      ["p1:vL", 1, 1],
    ]);
    expect(r.problems).toEqual([
      { key: "p1:vL", message: "Se pueden comprar hasta 3 de Remera interna por compra: ajustamos la cantidad." },
    ]);
  });

  it("máximo por compra ya cubierto: la línea sobrante se quita", () => {
    const r = checkCartLines(
      catalogo(conTalles({ listing: { ...row().listing, maxPerOrder: 2 } })),
      [
        { productId: "p1", variantId: "vM", qty: 2 },
        { productId: "p1", variantId: "vL", qty: 1 },
      ],
      sinReservas,
    );
    expect(r.lines.map((l) => l.key)).toEqual(["p1:vM"]);
    expect(r.problems[0].key).toBe("p1:vL");
  });

  it("precio cambiado: se actualiza y avisa; sin precio en la entrada no avisa", () => {
    const r = checkCartLines(catalogo(row()), [{ productId: "p1", variantId: null, qty: 1, unitPriceMinor: 1000 }], sinReservas);
    expect(r.lines[0].unitPriceMinor).toBe(1500000);
    expect(r.problems).toEqual([{ key: "p1:-", message: "El precio de Remera interna cambió: ahora es $ 15.000,00." }]);
    const sinPrecio = checkCartLines(catalogo(row()), [{ productId: "p1", variantId: null, qty: 1 }], sinReservas);
    expect(sinPrecio.problems).toEqual([]);
  });

  it("líneas repetidas se unen antes de validar", () => {
    const r = checkCartLines(
      catalogo(row()),
      [
        { productId: "p1", variantId: null, qty: 2 },
        { productId: "p1", variantId: null, qty: 2 },
      ],
      sinReservas,
    );
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(4);
  });

  it("sin control de stock: tope del carrito", () => {
    const r = checkCartLines(catalogo(row({ tracksStock: false })), [{ productId: "p1", variantId: null, qty: 99 }], sinReservas);
    expect(r.lines[0]).toMatchObject({ qty: 99, available: null, maxQty: 99 });
    expect(r.problems).toEqual([]);
  });
});
