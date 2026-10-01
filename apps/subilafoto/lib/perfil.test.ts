import { describe, expect, test } from "vitest";
import { PRECIO_MAXIMO_CENTS, PRECIO_MINIMO_CENTS, aCentavos, revisarPerfil } from "./perfil";

const BUENO = {
  displayName: "Estudio Luna",
  precio: "120000",
  headline: "Fotos de casamiento en Córdoba",
  descripcion: "",
  logoUrl: "",
  brandColor: "#7C2BFF",
  termsText: "",
  publicar: true,
};

describe("el precio que escribe el fotógrafo", () => {
  test("se escribe en pesos y se guarda en centavos", () => {
    expect(aCentavos("120000")).toBe(12_000_000);
  });

  test("acepta la coma decimal, que es como se escribe acá", () => {
    expect(aCentavos("1500,50")).toBe(150_050);
    expect(aCentavos("1500.50")).toBe(150_050);
  });

  test("ignora los puntos de miles", () => {
    expect(aCentavos("120.000")).toBe(12_000_000);
  });

  test("redondea al centavo en vez de guardar una fracción", () => {
    expect(aCentavos("0,555")).toBe(56);
  });

  test("lo que no es un número no vale", () => {
    expect(aCentavos("gratis")).toBeNull();
    expect(aCentavos("")).toBeNull();
    expect(aCentavos("-100")).toBeNull();
  });
});

describe("revisar el perfil antes de guardarlo", () => {
  test("uno completo pasa", () => {
    const r = revisarPerfil(BUENO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.basePriceCents).toBe(12_000_000);
  });

  test("sin nombre no se guarda: es lo que ve el cliente", () => {
    expect(revisarPerfil({ ...BUENO, displayName: "  " })).toMatchObject({ ok: false });
  });

  test("un precio en cero no se puede publicar", () => {
    const r = revisarPerfil({ ...BUENO, precio: "0" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("precio");
  });

  test("sin precio se puede guardar el borrador, pero NO publicado", () => {
    // Guardar a medias tiene que poder: el fotógrafo escribe su ficha en dos ratos.
    const r = revisarPerfil({ ...BUENO, precio: "", publicar: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.isPublished).toBe(false);
  });

  test("un precio ridículo se frena antes de llegar a Mercado Pago", () => {
    expect(revisarPerfil({ ...BUENO, precio: "1" }).ok).toBe(false);
    expect(revisarPerfil({ ...BUENO, precio: "999999999" }).ok).toBe(false);
  });

  test("el color tiene que ser un color", () => {
    expect(revisarPerfil({ ...BUENO, brandColor: "violeta" }).ok).toBe(false);
    expect(revisarPerfil({ ...BUENO, brandColor: "" }).ok).toBe(true);
  });

  test("el logo tiene que ser una dirección https", () => {
    expect(revisarPerfil({ ...BUENO, logoUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(revisarPerfil({ ...BUENO, logoUrl: "http://x.com/a.png" }).ok).toBe(false);
    expect(revisarPerfil({ ...BUENO, logoUrl: "https://x.com/a.png" }).ok).toBe(true);
  });

  test("los textos largos se recortan en vez de rechazarse", () => {
    const r = revisarPerfil({ ...BUENO, descripcion: "a".repeat(5000) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.description!.length).toBeLessThanOrEqual(1200);
  });

  test("los límites están donde dicen", () => {
    expect(PRECIO_MINIMO_CENTS).toBe(100_000);
    expect(PRECIO_MAXIMO_CENTS).toBe(500_000_000);
  });
});
