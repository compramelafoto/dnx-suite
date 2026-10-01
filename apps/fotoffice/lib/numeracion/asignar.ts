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

type FilaSecuencia = { prefix: string; withYear: boolean; digits: number | bigint; currentYear: number | bigint | null };

/**
 * Toma el candado de la fila de la secuencia (espera si otra alta la tiene) y la lee. Después de
 * esto, cada sentencia de esta transacción ve todo lo que confirmaron las altas anteriores.
 */
function bloquear(tx: Tx, workspaceId: string, key: ClaveSecuencia) {
  return tx.$queryRaw<FilaSecuencia[]>`
    /* numeracion-candado */
    SELECT s."prefix", s."withYear", s."digits", s."currentYear"
    FROM "FotofficeSequence" AS s
    WHERE s."workspaceId" = ${workspaceId} AND s."key" = ${key}
    FOR UPDATE`;
}

/**
 * Consume el próximo número de la secuencia (con el candado ya tomado). Si lleva año y el año es
 * nuevo (o nunca numeró con año), arranca después del último número de ese año (1 si no hay).
 * Devuelve el número consumido: `nextValue` nuevo - 1. La última condición nunca falla con el
 * candado tomado (los años anteriores van por `siguienteDeAnioAnterior`); es una red.
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
      AND (NOT s."withYear" OR s."currentYear" IS NULL OR s."currentYear" <= ${anio}::int)
    RETURNING s."nextValue" - 1 AS "value", s."currentYear" AS "year", s."prefix", s."withYear", s."digits"`;
}

/**
 * Número para un registro de un año ANTERIOR al de la secuencia (enganche de consultas viejas):
 * último usado de ese año + 1, sin tocar la secuencia —así el contador del año corriente (y un
 * próximo número configurado) sigue intacto—. Va con el candado de la fila ya tomado, que
 * serializa las altas: el MAX se lee después de que las anteriores confirmaron.
 */
function siguienteDeAnioAnterior(tx: Tx, workspaceId: string, key: ClaveSecuencia, anio: number) {
  return tx.$queryRaw<{ value: number | bigint }[]>`
    /* numeracion-anio-anterior */
    SELECT COALESCE(MAX(r."value"), 0) + 1 AS "value"
    FROM "FotofficeRecordNumber" AS r
    WHERE r."workspaceId" = ${workspaceId} AND r."sequenceKey" = ${key} AND r."year" = ${anio}::int`;
}

async function tomarNumero(tx: Tx, workspaceId: string, key: ClaveSecuencia, anio: number): Promise<FilaAsignada | null> {
  let [sec] = await bloquear(tx, workspaceId, key);
  if (!sec) {
    await asegurarSecuencias(workspaceId, tx);
    [sec] = await bloquear(tx, workspaceId, key);
  }
  if (!sec) return null;
  if (sec.withYear && sec.currentYear !== null && anio < Number(sec.currentYear)) {
    const [r] = await siguienteDeAnioAnterior(tx, workspaceId, key, anio);
    return { value: r?.value ?? 1, year: anio, prefix: sec.prefix, withYear: true, digits: sec.digits };
  }
  const [fila] = await consumir(tx, workspaceId, key, anio);
  return fila ?? null;
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
  const fila = await tomarNumero(tx, workspaceId, key, anio);
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
