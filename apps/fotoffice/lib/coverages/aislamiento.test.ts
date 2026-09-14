import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ninguna consulta del módulo puede olvidarse del workspace.
 *
 * Una sola consulta sin `workspaceId` es una fuga entre instituciones: hoy nadie la usa mal,
 * y dentro de seis meses alguien la llama desde otra pantalla y la SFPR ve una solicitud de
 * FOTOPOSITIVA. No se puede verificar renderizando; se verifica sobre el código, igual que ya
 * hacen otras tres barreras del proyecto.
 */
describe("el repositorio no puede filtrar entre workspaces", () => {
  const fuente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "repository.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  /**
   * Cada bloque `prisma.<modelo>.<operación>({ ... })` del archivo.
   *
   * Se corta por `\n}` al inicio de línea de una función exportada, que es como está escrito
   * el archivo: una consulta por función.
   */
  const consultas = fuente
    .split(/export async function /)
    .slice(1)
    .map((bloque) => ({
      nombre: bloque.slice(0, bloque.indexOf("(")),
      cuerpo: bloque,
    }))
    .filter((f) => /prisma\.\w+\./.test(f.cuerpo));

  it("hay consultas que revisar (si no, este test estaría pasando de gusto)", () => {
    expect(consultas.length).toBeGreaterThanOrEqual(5);
  });

  it.each([
    "loadSettings",
    "listRequests",
    "loadRequest",
    "countRecentSubmissions",
    "findDuplicateRequest",
  ])("%s consulta por workspaceId", (nombre) => {
    const fn = consultas.find((c) => c.nombre === nombre);
    expect(fn, `no se encontró ${nombre} en repository.ts`).toBeDefined();
    expect(fn!.cuerpo).toMatch(/workspaceId/);
  });

  it("la única que no lleva workspace es la del token, y está justificada", () => {
    // El token ES la credencial: no sabe de qué institución es, y quien lo tiene ve esa
    // solicitud y ninguna otra. Si alguna vez deja de estar documentado así, este test
    // obliga a volver a pensarlo.
    const fn = consultas.find((c) => c.nombre === "findByTrackingToken");
    expect(fn).toBeDefined();
    expect(fn!.cuerpo).not.toMatch(/workspaceId/);
    const conComentarios = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "repository.ts"),
      "utf8",
    );
    expect(conComentarios).toMatch(/No filtra por workspace a propósito/);
  });
});
