import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ninguna consulta del módulo puede olvidarse del workspace — pero "olvidarse" quiere decir no
 * FILTRAR por él, no dejar de nombrarlo en cualquier parte de la función.
 *
 * Una sola consulta que no filtre por `workspaceId` es una fuga entre instituciones: hoy nadie
 * la usa mal, y dentro de seis meses alguien la llama desde otra pantalla y la SFPR ve una
 * solicitud de FOTOPOSITIVA. No se puede verificar renderizando; se verifica sobre el código,
 * igual que ya hacen otras tres barreras del proyecto.
 *
 * Por qué el barrido mira sólo el `where` de cada consulta y no la función entera: filtrar y
 * devolver son cosas distintas. `findByTrackingToken` le hace `select` a `workspaceId` porque
 * quien la llama lo necesita — eso es DEVOLVER el campo. Buscar `workspaceId` en el cuerpo
 * completo de la función confunde eso con FILTRAR por él, y da un falso positivo apenas alguien
 * agrega ese `select`, aunque la consulta siga sin aislar nada (que es lo único que le puede
 * hacer daño a otra institución). Por eso este test sólo mira adentro del `where`.
 *
 * El barrido es sobre TODAS las funciones que consultan prisma en `repository.ts`, detectadas
 * por código y no tipeadas a mano: una lista de nombres escrita a mano es una lista blanca — se
 * queda vieja el día que alguien agrega una consulta y se olvida de sumarla ahí, y el test sigue
 * en verde. Acá, en cambio, una consulta nueva sin `workspaceId` en su `where` entra sola al
 * barrido.
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

  /**
   * El contenido de `where: { ... }` de una consulta, o `""` si no tiene.
   *
   * No alcanza con cortar en la primera `}` que aparece después de `where:`: las consultas de
   * este archivo anidan objetos (`client: { email: ... }`, `consents: { some: { ... } }`), y esa
   * primera llave de cierre pertenece al objeto anidado, no al `where` — cortar ahí deja el
   * bloque a medias. Por eso se cuentan llaves balanceadas desde la apertura del `where` hasta
   * que la profundidad vuelve a cero: eso encierra el objeto completo sin importar cuánto anide
   * para adentro, porque en un objeto de JS/TS válido cada `{` que abre tiene su `}` que cierra.
   */
  function extraerWhere(cuerpo: string): string {
    const inicioWhere = cuerpo.indexOf("where:");
    if (inicioWhere === -1) return "";
    const apertura = cuerpo.indexOf("{", inicioWhere);
    if (apertura === -1) return "";
    let profundidad = 0;
    for (let i = apertura; i < cuerpo.length; i++) {
      if (cuerpo[i] === "{") profundidad++;
      else if (cuerpo[i] === "}") {
        profundidad--;
        if (profundidad === 0) return cuerpo.slice(apertura, i + 1);
      }
    }
    return cuerpo.slice(apertura);
  }

  it("hay consultas que revisar (si no, este test estaría pasando de gusto)", () => {
    expect(consultas.length).toBeGreaterThanOrEqual(5);
  });

  it("ninguna consulta a prisma filtra sin workspaceId en su where", () => {
    // Recorre TODAS las funciones detectadas, no una lista escrita a mano: si mañana se agrega
    // una consulta nueva sin workspaceId en su where, entra en este barrido y el test la nombra.
    // Una lista fija no lo haría: se puede olvidar agregar el nombre nuevo y el test sigue en
    // verde.
    //
    // Mira el `where`, no el cuerpo entero: que la función DEVUELVA workspaceId en un `select`
    // (como hace findByTrackingToken, para quien la llama) no dice nada sobre si FILTRA por él.
    // Sólo lo que está adentro del `where` decide si la consulta aísla entre instituciones.
    const sinAislamiento = consultas
      .filter((f) => f.nombre !== "findByTrackingToken")
      .filter((f) => !/workspaceId/.test(extraerWhere(f.cuerpo)))
      .map((f) => f.nombre);
    expect(sinAislamiento).toEqual([]);
  });

  it("la única que no filtra por workspace es la del token, y está justificada", () => {
    // El token ES la credencial: no sabe de qué institución es, y quien lo tiene ve esa
    // solicitud y ninguna otra. Si alguna vez deja de estar documentado así, este test
    // obliga a volver a pensarlo.
    //
    // Se verifica sobre el `where`, no sobre el cuerpo entero: esta función SÍ trae
    // `workspaceId` en su `select` (lo necesita quien la llama para armar la respuesta), y eso
    // está bien — devolver el campo no es lo mismo que filtrar por él, y lo único prohibido acá
    // es filtrar.
    const fn = consultas.find((c) => c.nombre === "findByTrackingToken");
    expect(fn).toBeDefined();
    expect(extraerWhere(fn!.cuerpo)).not.toMatch(/workspaceId/);
    const conComentarios = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "repository.ts"),
      "utf8",
    );
    expect(conComentarios).toMatch(/No filtra por workspace a propósito/);
  });
});
