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

  it.each([
    "guardarAjustesContratosAction", "subirFirmaEmpresaAction", "quitarFirmaEmpresaAction",
    "crearPlantillaContratoAction", "editarPlantillaContratoAction", "eliminarPlantillaContratoAction",
  ])("%s pide `configurar` (lo mismo que la pantalla), sin exigir además Ver en Contratos", (nombre) => {
    const c = cuerpoDe(nombre);
    expect(c).toContain('contextoDeContratos("configurar")');
    expect(c).not.toContain('contextoDeContratos("ver")');
  });

  it("el editor del borrador no se remonta con cada evento (conserva sus avisos al refrescar)", async () => {
    const { readFileSync } = await import("node:fs");
    const pagina = readFileSync(new URL("../../app/(shell)/contratos/[id]/page.tsx", import.meta.url), "utf8");
    expect(pagina).not.toMatch(/<BorradorContrato[^>]*eventos/);
    expect(pagina).toContain('key={`${ficha.id}:${ficha.version?.id ?? "borrador"}`}');
  });

  it("el enlace público al PDF es absoluto (se arma con urlDelContrato), no relativo al token", async () => {
    const { readFileSync } = await import("node:fs");
    const pagina = readFileSync(new URL("../../app/w/[workspaceSlug]/contrato/[token]/page.tsx", import.meta.url), "utf8");
    expect(pagina).toContain("urlDelContrato(");
    expect(pagina).toContain("href={pdfHref}");
    expect(pagina).not.toContain("href={`${encodeURIComponent(token)}/pdf`}");
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
