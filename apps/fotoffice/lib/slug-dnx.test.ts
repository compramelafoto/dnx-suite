import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SLUG_DNX, SLUG_DNX_HISTORICO, esSlugDnx } from "./slug-dnx";
import { CATEGORIAS_DNX as CATEGORIAS_CONSULTA_DNX, semillasPara } from "./consultas/constantes";

describe("esSlugDnx", () => {
  it("la dirección real de DNX en producción es dnxestudio", () => {
    expect(SLUG_DNX).toBe("dnxestudio");
    expect(esSlugDnx("dnxestudio")).toBe(true);
  });

  it("sigue aceptando la dirección histórica", () => {
    expect(SLUG_DNX_HISTORICO).toBe("dnx-estudio");
    expect(esSlugDnx("dnx-estudio")).toBe(true);
  });

  it("cualquier otra organización no es DNX", () => {
    for (const s of ["sfpr", "", null, undefined, "dnx", "dnxestudio2"]) expect(esSlugDnx(s)).toBe(false);
  });

  it("las semillas de consultas eligen las de DNX con dnxestudio", () => {
    expect(semillasPara("dnxestudio").categorias).toBe(CATEGORIAS_CONSULTA_DNX);
  });

  it("ningún archivo de la app vuelve a escribir la dirección a mano", () => {
    // La única copia del valor vive en lib/slug-dnx.ts; los demás importan la constante.
    for (const archivo of [
      "campos/semillas.ts",
      "consultas/constantes.ts",
      "circuitos/semillas/asegurar.ts",
      "ficha/categorias.ts",
      "catalogo/semillas.ts",
      "presupuestos/semillas.ts",
      "plantillas/semillas.ts",
      "workspace.ts",
    ]) {
      const fuente = readFileSync(join(__dirname, archivo), "utf8");
      expect(fuente, archivo).not.toMatch(/["'`]dnx-?estudio["'`]/);
    }
  });
});
