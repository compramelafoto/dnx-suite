import { describe, expect, it } from "vitest";
import { MAX_ONLINE_DESCRIPTION, isAcceptableImageUrl, parseListingForm } from "./listing-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, valor);
  }
  return fd;
}

// Como lo manda la pantalla: cada casilla tildada manda "on" y después su respaldo "off".
const base = { sellOnline: ["on", "off"], sellAtCounter: ["on", "off"] };

describe("parseListingForm", () => {
  it.each(["carrito", "Carrito", " checkout ", "pedido", "arrepentimiento", "términos"])(
    "rechaza la dirección reservada %j",
    (slug) => {
      expect(parseListingForm(form({ ...base, slug }))).toEqual({
        ok: false,
        error: "Esa dirección está reservada por la tienda. Elegí otra.",
      });
    },
  );

  it("una dirección que sólo empieza como una reservada sí vale", () => {
    const r = parseListingForm(form({ ...base, slug: "carrito-de-compras" }));
    expect(r.ok && r.values.slug).toBe("carrito-de-compras");
  });

  it("sin ningún canal tildado → error", () => {
    const r = parseListingForm(form({ sellOnline: "off", sellAtCounter: "off" }));
    expect(r).toEqual({ ok: false, error: "Elegí al menos un lugar donde se vende." });
  });

  it("lee los canales con el respaldo oculto después de la casilla", () => {
    const r = parseListingForm(form({ sellOnline: "off", sellAtCounter: ["on", "off"] }));
    expect(r.ok && [r.values.sellOnline, r.values.sellAtCounter]).toEqual([false, true]);
  });

  it("los campos vacíos quedan en null", () => {
    const r = parseListingForm(
      form({ ...base, slug: "", onlineTitle: "  ", onlineDescription: "", weightGrams: "", lengthCm: "", widthCm: "", heightCm: "", maxPerOrder: "" }),
    );
    expect(r).toEqual({
      ok: true,
      values: {
        sellOnline: true,
        sellAtCounter: true,
        slug: "",
        onlineTitle: null,
        onlineDescription: null,
        weightGrams: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        maxPerOrder: null,
      },
    });
  });

  it("peso que no es número → error", () => {
    const r = parseListingForm(form({ ...base, weightGrams: "abc" }));
    expect(r).toEqual({ ok: false, error: "El peso tiene que ser un número entero mayor a cero, en gramos." });
  });

  it("cero, negativos y decimales no son enteros positivos", () => {
    expect(parseListingForm(form({ ...base, lengthCm: "0" })).ok).toBe(false);
    expect(parseListingForm(form({ ...base, widthCm: "-3" })).ok).toBe(false);
    expect(parseListingForm(form({ ...base, heightCm: "2.5" })).ok).toBe(false);
    expect(parseListingForm(form({ ...base, maxPerOrder: "1e3" })).ok).toBe(false);
  });

  it("enteros positivos se guardan como números", () => {
    const r = parseListingForm(
      form({ ...base, weightGrams: "250", lengthCm: "30", widthCm: "20", heightCm: " 5 ", maxPerOrder: "3" }),
    );
    expect(r.ok && r.values).toMatchObject({ weightGrams: 250, lengthCm: 30, widthCm: 20, heightCm: 5, maxPerOrder: 3 });
  });

  it("el slug se normaliza", () => {
    const r = parseListingForm(form({ ...base, slug: "Remera Ñandú " }));
    expect(r.ok && r.values.slug).toBe("remera-nandu");
  });

  it("un slug que no tiene letras ni números → error (no se lo deja vacío en silencio)", () => {
    const r = parseListingForm(form({ ...base, slug: "¡¡!!" }));
    expect(r).toEqual({ ok: false, error: "La dirección tiene que tener al menos una letra o un número." });
  });

  it("la descripción online tiene tope", () => {
    expect(parseListingForm(form({ ...base, onlineDescription: "x".repeat(MAX_ONLINE_DESCRIPTION) })).ok).toBe(true);
    const r = parseListingForm(form({ ...base, onlineDescription: "x".repeat(MAX_ONLINE_DESCRIPTION + 1) }));
    expect(r).toEqual({ ok: false, error: "La descripción online puede tener hasta 5000 caracteres." });
  });

  it("el título online tiene tope", () => {
    const r = parseListingForm(form({ ...base, onlineTitle: "x".repeat(201) }));
    expect(r).toEqual({ ok: false, error: "El título online puede tener hasta 200 caracteres." });
  });
});

describe("isAcceptableImageUrl", () => {
  it("acepta una dirección https", () => {
    expect(isAcceptableImageUrl("https://media.fotoffice.com/fotoffice/product-gallery/ws/x.webp")).toBe(true);
  });
  it("rechaza vacío, javascript: y direcciones sin https", () => {
    expect(isAcceptableImageUrl("")).toBe(false);
    expect(isAcceptableImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAcceptableImageUrl("ftp://x/y.png")).toBe(false);
    expect(isAcceptableImageUrl(`https://x.com/${"a".repeat(2100)}`)).toBe(false);
  });
});
