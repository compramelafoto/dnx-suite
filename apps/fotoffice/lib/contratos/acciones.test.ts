import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fuente = readFileSync(new URL("../../app/actions/contratos.ts", import.meta.url), "utf8");

function cuerpoDe(nombre: string): string {
  const i = fuente.indexOf(`export async function ${nombre}(`);
  expect(i, nombre).toBeGreaterThan(-1);
  const j = fuente.indexOf("\nexport async function ", i + 10);
  return fuente.slice(i, j === -1 ? undefined : j);
}

describe("acciones de contratos (fuente)", () => {
  it.each([
    "generarContratoAction", "editarBorradorContratoAction", "actualizarDatosContratoAction", "enviarContratoAction",
    "reenviarEnlaceContratoAction", "anularContratoAction", "marcarFirmadoEnPapelAction",
  ])("%s exige Gestionar y valida los ids", (nombre) => {
    const c = cuerpoDe(nombre);
    expect(c).toContain('contextoDeContratos("operar")');
    expect(c).toContain("esId(");
  });

  it("los correos salen con after() y nunca antes de confirmar el envío", () => {
    for (const nombre of ["enviarContratoAction", "reenviarEnlaceContratoAction"]) {
      const c = cuerpoDe(nombre);
      expect(c).toContain("after(");
      expect(c.indexOf("if (r.ok)")).toBeLessThan(c.indexOf("after("));
    }
    expect(fuente).toContain('import { after } from "next/server"');
  });
});
