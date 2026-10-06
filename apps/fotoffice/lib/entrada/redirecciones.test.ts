import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { REDIRECCIONES_PERMANENTES } from "./redirecciones";
import { RESERVED_SLUGS } from "./institution-shortcut";

/**
 * Resuelve una dirección con las mismas funciones que usa Next para las redirecciones de
 * `next.config.ts`: la primera regla que coincide gana y la búsqueda viaja al destino.
 */
function redirigir(pathname: string, query: Record<string, string> = {}): string | null {
  for (const regla of REDIRECCIONES_PERMANENTES) {
    const params = getPathMatch(regla.source, { removeUnnamedParams: true, strict: true })(pathname);
    if (!params) continue;
    const { parsedDestination } = prepareDestination({
      appendParamsToQuery: false,
      destination: regla.destination,
      params,
      query,
    });
    const busqueda = new URLSearchParams(parsedDestination.query as Record<string, string>).toString();
    return `${parsedDestination.pathname}${busqueda ? `?${busqueda}` : ""}`;
  }
  return null;
}

describe("Captación pasó a Consultas: las direcciones viejas siguen andando", () => {
  it("son permanentes (308)", () => {
    expect(REDIRECCIONES_PERMANENTES.every((r) => r.permanent === true)).toBe(true);
  });

  it("/captacion va al tablero de /consultas", () => {
    expect(redirigir("/captacion")).toBe("/consultas");
  });

  it("lo de abajo conserva el camino: lista, informe y la ficha", () => {
    expect(redirigir("/captacion/lista")).toBe("/consultas/lista");
    expect(redirigir("/captacion/informe")).toBe("/consultas/informe");
    expect(redirigir("/captacion/abc123")).toBe("/consultas/abc123");
  });

  it("conserva la búsqueda", () => {
    expect(redirigir("/captacion", { circuito: "c1", vencidas: "si" })).toBe("/consultas?circuito=c1&vencidas=si");
    expect(redirigir("/captacion/lista", { etapa: "s2" })).toBe("/consultas/lista?etapa=s2");
  });

  it("no toca otras direcciones parecidas", () => {
    expect(redirigir("/consultas")).toBeNull();
    expect(redirigir("/captaciones")).toBeNull();
    expect(redirigir("/dashboard/captacion")).toBeNull();
  });

  it("next.config.ts las usa y los dos nombres quedan reservados", () => {
    const config = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "next.config.ts"), "utf8");
    expect(config).toContain("return REDIRECCIONES_PERMANENTES;");
    expect(RESERVED_SLUGS.has("captacion")).toBe(true);
    expect(RESERVED_SLUGS.has("consultas")).toBe(true);
  });
});
