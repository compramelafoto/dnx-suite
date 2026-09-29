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
  it("exige verDinero", () => expect(body).toMatch(/exigirCapacidad\(ctx, "verDinero"\)/));
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
