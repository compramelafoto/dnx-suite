import { describe, expect, it } from "vitest";
import { VINCULOS, carasDeVinculos, esClaveDeVinculo, esSentidoDeVinculo, etiquetaDeLaOtra, etiquetaDelVinculo } from "./vinculos";

describe("vinculos", () => {
  it("hay nueve y cada uno tiene sus dos lados en español", () => {
    expect(VINCULOS.map((v) => v.clave)).toEqual([
      "madre-padre", "pareja", "hermano", "abuelo", "tio", "proveedor", "empleado", "amigo", "otro",
    ]);
    for (const v of VINCULOS) {
      expect(v.desde.length).toBeGreaterThan(0);
      expect(v.hacia.length).toBeGreaterThan(0);
    }
  });
  it("madre-padre se lee distinto de cada lado", () => {
    expect(etiquetaDelVinculo("madre-padre", "desde")).toBe("Madre o padre");
    expect(etiquetaDelVinculo("madre-padre", "hacia")).toBe("Hijo o hija");
    expect(etiquetaDelVinculo("proveedor", "hacia")).toBe("Cliente");
    expect(etiquetaDelVinculo("tio", "hacia")).toBe("Sobrino o sobrina");
  });
  it("los simétricos se leen igual", () => {
    expect(etiquetaDelVinculo("pareja", "hacia")).toBe("Pareja");
    expect(etiquetaDelVinculo("amigo", "desde")).toBe(etiquetaDelVinculo("amigo", "hacia"));
  });
  it("otro usa el texto libre en los dos lados", () => {
    expect(etiquetaDelVinculo("otro", "desde", " Padrino ")).toBe("Padrino");
    expect(etiquetaDelVinculo("otro", "hacia", "Padrino")).toBe("Padrino");
    expect(etiquetaDelVinculo("otro", "hacia")).toBe("Otro");
  });
  it("valida claves", () => {
    expect(esClaveDeVinculo("pareja")).toBe(true);
    expect(esClaveDeVinculo("nada")).toBe(false);
    expect(esClaveDeVinculo(3)).toBe(false);
  });
});

describe("caras de los vínculos", () => {
  it("ofrece las dos caras de cada vínculo y una sola si se lee igual de los dos lados", () => {
    const textos = carasDeVinculos().map((c) => c.texto);
    expect(textos).toEqual([
      "Madre o padre", "Hijo o hija", "Pareja", "Hermano o hermana", "Abuelo o abuela", "Nieto o nieta",
      "Tío o tía", "Sobrino o sobrina", "Proveedor", "Cliente", "Empleado", "Empleador", "Amigo o amiga", "Otro",
    ]);
    expect(carasDeVinculos().find((c) => c.texto === "Madre o padre")).toMatchObject({ clave: "madre-padre", sentido: "otra-es" });
    expect(carasDeVinculos().find((c) => c.texto === "Hijo o hija")).toMatchObject({ clave: "madre-padre", sentido: "esta-es" });
    expect(new Set(carasDeVinculos().map((c) => c.valor)).size).toBe(14);
  });
  it("sentido válido", () => {
    expect(esSentidoDeVinculo("otra-es")).toBe(true);
    expect(esSentidoDeVinculo("esta-es")).toBe(true);
    expect(esSentidoDeVinculo("otro")).toBe(false);
  });
  it("la etiqueta describe a la otra persona", () => {
    // Yo soy el origen (madre): la otra es mi hija.
    expect(etiquetaDeLaOtra("madre-padre", true)).toBe("Hijo o hija");
    // La otra es el origen: es mi madre.
    expect(etiquetaDeLaOtra("madre-padre", false)).toBe("Madre o padre");
    expect(etiquetaDeLaOtra("otro", false, "Padrino")).toBe("Padrino");
  });
});
