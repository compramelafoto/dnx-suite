import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { formatearNumero } from "./formato";
import { anioEnBuenosAires, asegurarSecuencias, esClaveSecuencia, type ClaveSecuencia } from "./secuencias";

type Tx = Prisma.TransactionClient;

export type NumeroAsignado = { year: number | null; value: number; display: string };

type FilaAsignada = {
  value: number | bigint;
  year: number | bigint | null;
  prefix: string;
  withYear: boolean;
  digits: number | bigint;
};

/**
 * Consume el próximo número de la secuencia en UNA sentencia: el candado de la fila hace que dos
 * altas simultáneas nunca reciban el mismo número (la segunda espera y relee la fila ya
 * actualizada). Si la secuencia lleva año y el año cambió, arranca en 1 —o después del último
 * número de ese año, si ya había alguno (enganche de consultas viejas fechadas en otro año)—.
 * Devuelve el número consumido: `nextValue` nuevo - 1. Vacío si la secuencia no existe.
 */
function consumir(tx: Tx, workspaceId: string, key: ClaveSecuencia, anio: number) {
  return tx.$queryRaw<FilaAsignada[]>`
    /* numeracion-asignar */
    UPDATE "FotofficeSequence" AS s
    SET "nextValue" = CASE
          WHEN s."withYear" AND s."currentYear" IS DISTINCT FROM ${anio}::int THEN
            (SELECT COALESCE(MAX(r."value"), 0) FROM "FotofficeRecordNumber" r
              WHERE r."workspaceId" = s."workspaceId" AND r."sequenceKey" = s."key" AND r."year" = ${anio}::int) + 2
          ELSE s."nextValue" + 1
        END,
        "currentYear" = CASE WHEN s."withYear" THEN ${anio}::int ELSE NULL END
    WHERE s."workspaceId" = ${workspaceId} AND s."key" = ${key}
    RETURNING s."nextValue" - 1 AS "value", s."currentYear" AS "year", s."prefix", s."withYear", s."digits"`;
}

/**
 * Da número a un registro dentro de la transacción del llamador (la del alta o la del enganche):
 * si la transacción se deshace, el número no se consume. El año es el de `fecha` en Buenos Aires.
 * Si el registro ya tenía número lo devuelve sin consumir otro.
 */
export async function asignarNumero(
  tx: Tx,
  args: { workspaceId: string; key: ClaveSecuencia; entityType: string; entityId: string; fecha: Date },
): Promise<NumeroAsignado> {
  const { workspaceId, key, entityType, entityId, fecha } = args;
  if (!esClaveSecuencia(key)) throw new Error(`Secuencia desconocida: ${String(key)}`);

  const ya = await tx.fotofficeRecordNumber.findFirst({
    where: { entityType, entityId },
    select: { workspaceId: true, year: true, value: true, display: true },
  });
  if (ya) {
    if (ya.workspaceId !== workspaceId) throw new Error("El registro es de otro workspace.");
    return { year: ya.year, value: ya.value, display: ya.display };
  }

  const anio = anioEnBuenosAires(fecha);
  let [fila] = await consumir(tx, workspaceId, key, anio);
  if (!fila) {
    await asegurarSecuencias(workspaceId, tx);
    [fila] = await consumir(tx, workspaceId, key, anio);
  }
  if (!fila) throw new Error(`No se pudo crear la secuencia ${key}.`);

  const value = Number(fila.value);
  const year = fila.year === null ? null : Number(fila.year);
  const display = formatearNumero({ prefix: fila.prefix, withYear: fila.withYear, digits: Number(fila.digits) }, year, value);
  await tx.fotofficeRecordNumber.create({
    data: { workspaceId, sequenceKey: key, entityType, entityId, year, value, display },
    select: { id: true },
  });
  return { year, value, display };
}

/** Número (texto) de cada registro que lo tenga, en lote: entityId → display. */
export async function numeroDe(workspaceId: string, entityType: string, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const filas = await prisma.fotofficeRecordNumber.findMany({
    where: { workspaceId, entityType, entityId: { in: unicos } },
    select: { entityId: true, display: true },
  });
  return new Map(filas.map((f) => [f.entityId, f.display]));
}
