import { createHash } from "node:crypto";

/**
 * Código anónimo estable por concurso + categoría + entry + batch.
 * No usa IDs incrementales de DB ni número público Clickatón.
 */
export function buildAnonymousJuryCode(input: {
  contestId: string;
  categoryId: string;
  entryId: string;
  batchId: string;
  categorySlug?: string | null;
}): string {
  const digest = createHash("sha256")
    .update(
      `jury-anon:v1:${input.contestId}:${input.categoryId}:${input.entryId}:${input.batchId}`,
    )
    .digest("hex");
  const n = (parseInt(digest.slice(0, 8), 16) % 9000) + 1000;
  const prefix = (input.categorySlug ?? "CAT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "CAT";
  return `${prefix}-${n}`;
}

/**
 * Los códigos anónimos de un lote entero, garantizados únicos.
 *
 * `buildAnonymousJuryCode` recortaba un hash a cuatro dígitos: 9000 valores
 * posibles. Con 270 obras en una categoría, la probabilidad de que dos choquen
 * es del 98% —el problema del cumpleaños— y en la 1ª edición chocaron a las 80:
 * el congelamiento murió con una violación de unicidad y dejó el lote a medias.
 *
 * Acá la unicidad no depende de la suerte. Las obras se ordenan por un hash
 * estable y se numeran de corrido dentro de su categoría. El orden sigue sin
 * decir nada —no es el de carga ni el de inscripción— pero dos obras no pueden
 * tener el mismo número, porque el número es la posición.
 */
export function codigosAnonimosDelLote(input: {
  contestId: string;
  batchId: string;
  entradas: Array<{ entryId: string; categoryId: string; categorySlug?: string | null }>;
}): Map<string, string> {
  const codigos = new Map<string, string>();

  const porCategoria = new Map<string, typeof input.entradas>();
  for (const e of input.entradas) {
    const grupo = porCategoria.get(e.categoryId) ?? [];
    grupo.push(e);
    porCategoria.set(e.categoryId, grupo);
  }

  for (const grupo of porCategoria.values()) {
    const ordenadas = grupo
      .map((e) => ({
        entrada: e,
        orden: createHash("sha256")
          .update(`jury-anon:v2:${input.contestId}:${input.batchId}:${e.entryId}`)
          .digest("hex"),
      }))
      .sort((a, b) => (a.orden < b.orden ? -1 : a.orden > b.orden ? 1 : 0));

    const ancho = Math.max(4, String(ordenadas.length).length);
    ordenadas.forEach((fila, i) => {
      codigos.set(fila.entrada.entryId, `${prefijo(fila.entrada.categorySlug)}-${String(i + 1).padStart(ancho, "0")}`);
    });
  }

  return codigos;
}

function prefijo(categorySlug: string | null | undefined): string {
  return (
    (categorySlug ?? "CAT")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "CAT"
  );
}

export const JURY_FORBIDDEN_IDENTITY_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "instagram",
  "instagramHandle",
  "phone",
  "documentNumber",
  "clickatonParticipantNumber",
  "originalFileName",
  "authorUserId",
  "gpsLatitude",
  "gpsLongitude",
] as const;
