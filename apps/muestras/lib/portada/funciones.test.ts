import { describe, expect, it } from "vitest";
import { PASOS_MUESTRA } from "./funciones";

describe("pasos de la portada", () => {
  it("el concurso de FotoRank lleva su logo y dice lo que hace de verdad (etapa 7)", () => {
    const items = PASOS_MUESTRA.flatMap((p) => p.items).filter((x) => x.includes("{FOTORANK}"));
    expect(items).toEqual([
      "O traé los ganadores y preseleccionados de tu concurso de {FOTORANK}: te armamos el borrador de la muestra con sus obras.",
    ]);
  });
  it("el paso de vender dice lo que hace la etapa 8: formatos, ediciones, certificado y reparto", () => {
    const vender = PASOS_MUESTRA.find((p) => p.titulo === "Vendé copias de las obras")!;
    expect(vender.items).toContain(
      "Vendé copias digitales firmadas y copias impresas Fine Art, únicas o en edición limitada, con certificado y QR de autenticidad; el cobro se reparte solo entre la organización, el fotógrafo y la plataforma.",
    );
    // Lo que dejó de ser verdad o quedó repetido no aparece más.
    expect(vender.items).not.toContain("Copias impresas y archivos digitales.");
  });
});
