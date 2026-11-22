import { describe, expect, it } from "vitest";
import { PASOS_MUESTRA, TEXTOS_PORTADA, pasosDeMarca } from "./funciones";

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

describe("textos de la portada por marca", () => {
  it("fotografía usa exactamente los pasos y textos de siempre", () => {
    expect(pasosDeMarca("FOTOGRAFIA")).toBe(PASOS_MUESTRA);
    expect(TEXTOS_PORTADA.FOTOGRAFIA).toEqual({
      paraQuien: "Para fotógrafos, organizadores, fotoclubes e instituciones, de la convocatoria al archivo.",
      organizadores: "¿Organizás una muestra? Cargala con sus fotos y compartila con todo el mundo.",
    });
  });
  it("arte no habla de fotógrafos, fotos ni FotoRank y mantiene los mismos pasos", () => {
    const arte = pasosDeMarca("ARTE");
    expect(arte.map((p) => p.titulo)).toEqual(PASOS_MUESTRA.map((p) => p.titulo));
    const textos = [...arte.flatMap((p) => p.items), ...Object.values(TEXTOS_PORTADA.ARTE)];
    for (const t of textos) expect(t, t).not.toMatch(/fot[oó]graf|fotos|fotoclub|\{FOTORANK\}/i);
    expect(arte.find((p) => p.titulo === "Gestioná obras y artistas")!.items).toContain("Perfil público de cada artista, con su biografía y las muestras donde expuso.");
  });
});
