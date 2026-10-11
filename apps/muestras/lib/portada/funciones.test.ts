import { describe, expect, it } from "vitest";
import { PASOS_MUESTRA } from "./funciones";

describe("pasos de la portada", () => {
  it("el concurso de FotoRank lleva su logo y dice lo que hace de verdad (etapa 7)", () => {
    const items = PASOS_MUESTRA.flatMap((p) => p.items).filter((x) => x.includes("{FOTORANK}"));
    expect(items).toEqual([
      "O traé los ganadores y preseleccionados de tu concurso de {FOTORANK}: te armamos el borrador de la muestra con sus obras.",
    ]);
  });
});
