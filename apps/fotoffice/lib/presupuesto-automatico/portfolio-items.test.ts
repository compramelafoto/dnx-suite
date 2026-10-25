import { describe, expect, it } from "vitest";
import { aplicarCambio, claveDeSubidaValida, fotosParaMostrar, MAX_FOTOS_MOSTRADAS, prefijoDeSubidas, validarPortfolio } from "./portfolio-items";
import { categoriaDelTipo, fechaDelBot } from "./whatsapp-puro";

const WS = "cmv5z6qxwwmmhf0q5gp8qja1j";
const G = "ckgaleria00000001";
const F = "ckfoto0000000001";
const CLAVE = `${prefijoDeSubidas(WS)}0b9c7f2e-4d1a-4c33-9e5f-1a2b3c4d5e6f.jpg`;

describe("validarPortfolio", () => {
  it("conserva galerías, fotos y subidas válidas, en orden", () => {
    const v = validarPortfolio(WS, [
      { tipo: "GALERIA", galeriaId: G, cantidad: 6 },
      { tipo: "FOTO", galeriaId: G, fotoId: F },
      { tipo: "SUBIDA", clave: CLAVE, ancho: 2000, alto: 1333 },
    ]);
    expect(v.map((i) => i.tipo)).toEqual(["GALERIA", "FOTO", "SUBIDA"]);
  });

  it("descarta lo que no valida, los repetidos y las subidas de otro workspace", () => {
    const v = validarPortfolio(WS, [
      { tipo: "GALERIA", galeriaId: G },
      { tipo: "GALERIA", galeriaId: G, cantidad: 3 },
      { tipo: "FOTO", galeriaId: G },
      { tipo: "SUBIDA", clave: CLAVE.replace(WS, "otro-workspace") },
      { tipo: "SUBIDA", clave: `${prefijoDeSubidas(WS)}../../secreto.jpg` },
      "basura",
      null,
    ]);
    expect(v).toEqual([{ tipo: "GALERIA", galeriaId: G, cantidad: 8 }]);
    expect(validarPortfolio(WS, "no es lista")).toEqual([]);
  });

  it("la cantidad por galería queda entre 1 y 24", () => {
    expect(validarPortfolio(WS, [{ tipo: "GALERIA", galeriaId: G, cantidad: 500 }])[0]).toMatchObject({ cantidad: 24 });
    expect(validarPortfolio(WS, [{ tipo: "GALERIA", galeriaId: G, cantidad: 0 }])[0]).toMatchObject({ cantidad: 1 });
  });

  it("claves de subida", () => {
    expect(claveDeSubidaValida(WS, CLAVE)).toBe(true);
    expect(claveDeSubidaValida(WS, CLAVE.replace(".jpg", ".exe"))).toBe(false);
    expect(claveDeSubidaValida(WS, 5)).toBe(false);
  });
});

describe("aplicarCambio", () => {
  const base = validarPortfolio(WS, [{ tipo: "GALERIA", galeriaId: G, cantidad: 4 }, { tipo: "FOTO", galeriaId: G, fotoId: F }]);
  it("agrega validando, quita y mueve", () => {
    expect(aplicarCambio(WS, base, { tipo: "AGREGAR", item: { tipo: "SUBIDA", clave: CLAVE } })).toHaveLength(3);
    expect(aplicarCambio(WS, base, { tipo: "AGREGAR", item: { tipo: "FOTO", galeriaId: G, fotoId: F } })).toHaveLength(2);
    expect(aplicarCambio(WS, base, { tipo: "QUITAR", indice: 0 }).map((i) => i.tipo)).toEqual(["FOTO"]);
    expect(aplicarCambio(WS, base, { tipo: "MOVER", indice: 1, hacia: -1 }).map((i) => i.tipo)).toEqual(["FOTO", "GALERIA"]);
    expect(aplicarCambio(WS, base, { tipo: "MOVER", indice: 0, hacia: -1 })).toEqual(base);
    expect(aplicarCambio(WS, base, { tipo: "QUITAR", indice: 9 })).toEqual(base);
  });
});

describe("fotosParaMostrar", () => {
  it("saca repetidas y corta en el tope de la página", () => {
    const f = (id: string) => ({ id, miniatura: `https://x/${id}`, grande: null, ancho: null, alto: null });
    expect(fotosParaMostrar([f("a"), f("a"), f("b")]).map((x) => x.id)).toEqual(["a", "b"]);
    expect(fotosParaMostrar(Array.from({ length: 60 }, (_, i) => f(`f${i}`)))).toHaveLength(MAX_FOTOS_MOSTRADAS);
  });
});

describe("lo que dice el cliente por WhatsApp", () => {
  const CATS = [{ id: "c1", name: "15 años" }, { id: "c2", name: "Casamientos" }, { id: "c3", name: "Sesión de fotos" }];
  it("encuentra la categoría por el nombre, con o sin tildes, y entiende XV / quince", () => {
    expect(categoriaDelTipo(CATS, "casamientos")?.id).toBe("c2");
    expect(categoriaDelTipo(CATS, "SESION")?.id).toBe("c3");
    expect(categoriaDelTipo(CATS, "XV años")?.id).toBe("c1");
    expect(categoriaDelTipo(CATS, "quince años")?.id).toBe("c1");
    expect(categoriaDelTipo(CATS, "bautismo")).toBeNull();
  });
  it("la fecha sólo si es aaaa-mm-dd real", () => {
    expect(fechaDelBot("2027-03-14")?.toISOString()).toBe("2027-03-14T00:00:00.000Z");
    expect(fechaDelBot("2027-02-30")).toBeNull();
    expect(fechaDelBot("14/03/2027")).toBeNull();
  });
});
