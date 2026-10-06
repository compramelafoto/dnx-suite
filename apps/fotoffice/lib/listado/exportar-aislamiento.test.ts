import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "..", "..", "app/api/listados/[clave]/exportar/route.ts"), "utf8");
const body = src.slice(src.indexOf("export async function GET"));

describe("exportar un listado", () => {
  it("el guarda corre antes de leer datos", () => {
    expect(body.indexOf("contextoDeListado")).toBeGreaterThan(-1);
    expect(body.indexOf("contextoDeListado")).toBeLessThan(body.indexOf("traerIds"));
  });
  it("no exige verDinero para todo: las columnas de plata las saca `definicionDe` (recortarPorDinero)", () => {
    expect(body).not.toMatch(/exigirCapacidad\(ctx, "verDinero"\)/);
    expect(body).toMatch(/definicionDe\(clave, ctx\)/);
    expect(readFileSync(join(__dirname, "registro.ts"), "utf8")).toMatch(/recortarPorDinero\(await l\.cargar\(ctx\), ctx\)/);
  });
  it("exige operar (Gestionar en el módulo de la lista, como la exportación de socios de main)", () =>
    expect(body).toMatch(/exigirCapacidad\(ctx, "operar"\)/));
  it("toda denegación es 404 y no redirige", () => {
    expect(body).toMatch(/status: 404/);
    expect(body).not.toMatch(/status: 40[13]|redirect\(/);
  });
  it("no lee el workspace de la dirección", () => expect(src).not.toMatch(/get\(["']workspaceId["']\)/));
  it("registra la exportación y respeta el tope", () => {
    expect(body).toMatch(/registrarActividad/);
    expect(body).toMatch(/TOPE_EXPORTACION/);
  });
  it("no se cachea ni se indexa", () => expect(body).toMatch(/no-store/));
});
