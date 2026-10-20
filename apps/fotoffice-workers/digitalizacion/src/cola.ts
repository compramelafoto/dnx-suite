/**
 * Cola de conversión sobre `DigitalizacionGrabacion`, con SQL crudo.
 * Las fechas se pasan siempre como parámetros `Date` (columnas TIMESTAMP(3) sin zona, UTC).
 */

export type PrismaCola = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

const MIN = 60_000;
const ESPERA_TERMINADA_MIN = 15;
const ESPERA_PARTE_MIN = 30;
const TRABADA_HORAS = 6;
export const MAX_INTENTOS = 3;

/** Token de propiedad: quien tomó la grabación conoce el instante exacto de `conversionLockAt`. */
export type Tomada = { id: string; lockAt: Date };

/** Toma la siguiente grabación PENDIENTE y COMPLETA y la pasa a PROCESANDO. Devuelve su id y el token de bloqueo, o null. */
export async function tomarSiguiente(prisma: PrismaCola, ahora: Date): Promise<Tomada | null> {
  const terminadaAntes = new Date(ahora.getTime() - ESPERA_TERMINADA_MIN * MIN);
  const partesAntes = new Date(ahora.getTime() - ESPERA_PARTE_MIN * MIN);
  const filas = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='PROCESANDO', "conversionLockAt"=$1, "conversionIntentos"="conversionIntentos"+1, "conversionError"=NULL
     WHERE id = (SELECT g.id FROM "DigitalizacionGrabacion" g
       WHERE g."conversionEstado"='PENDIENTE' AND g.estado='COMPLETA' AND g."terminadaAt" <= $2
         AND NOT EXISTS (SELECT 1 FROM "DigitalizacionParte" p WHERE p."grabacionId"=g.id AND p.estado='PENDIENTE' AND p."createdAt" > $3)
       ORDER BY g."terminadaAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id`,
    ahora,
    terminadaAntes,
    partesAntes,
  );
  const id = filas[0]?.id;
  return id ? { id, lockAt: ahora } : null;
}

/** PROCESANDO hace más de 6 h: vuelve a PENDIENTE, o a ERROR si ya hizo 3 intentos. Devuelve cuántas tocó. */
export async function recuperarTrabadas(prisma: PrismaCola, ahora: Date): Promise<number> {
  const corte = new Date(ahora.getTime() - TRABADA_HORAS * 60 * MIN);
  const aError = await prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='ERROR', "conversionError"=$2
     WHERE "conversionEstado"='PROCESANDO' AND "conversionLockAt" < $1 AND "conversionIntentos" >= ${MAX_INTENTOS}`,
    corte,
    "La conversión se cortó 3 veces.",
  );
  const aPendiente = await prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='PENDIENTE'
     WHERE "conversionEstado"='PROCESANDO' AND "conversionLockAt" < $1 AND "conversionIntentos" < ${MAX_INTENTOS}`,
    corte,
  );
  return aError + aPendiente;
}

const DUENO = `"conversionEstado"='PROCESANDO' AND "conversionLockAt"=`;

/** Todas devuelven cuántas filas tocaron: 0 significa que otro worker es el dueño (o la grabación cambió). */
export async function marcarLista(
  prisma: PrismaCola,
  id: string,
  lock: Date,
  datos: { videoKey: string; videoBytes: number | bigint; videoDuracionSeg: number },
): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='LISTA', "videoKey"=$2, "videoBytes"=$3, "videoDuracionSeg"=$4, "convertidaAt"=$5, "conversionError"=NULL
     WHERE id=$1 AND ${DUENO}$6`,
    id,
    datos.videoKey,
    BigInt(datos.videoBytes),
    datos.videoDuracionSeg,
    new Date(),
    lock,
  );
}

export async function marcarError(prisma: PrismaCola, id: string, lock: Date, mensaje: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='ERROR', "conversionError"=$2 WHERE id=$1 AND ${DUENO}$3`,
    id,
    mensaje,
    lock,
  );
}

export async function marcarPartesBorradas(prisma: PrismaCola, id: string, videoKey: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "partesBorradasAt"=$2 WHERE id=$1 AND "conversionEstado"='LISTA' AND "videoKey"=$3`,
    id,
    new Date(),
    videoKey,
  );
}

export async function marcarSinImagen(prisma: PrismaCola, id: string, lock: Date): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='SIN_IMAGEN', "conversionError"=NULL WHERE id=$1 AND ${DUENO}$2`,
    id,
    lock,
  );
}

export async function marcarPartesBorradasSinImagen(prisma: PrismaCola, id: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "partesBorradasAt"=$2 WHERE id=$1 AND "conversionEstado"='SIN_IMAGEN'`,
    id,
    new Date(),
  );
}

/** Renueva el token de bloqueo; 0 filas = se perdió la propiedad. */
export async function renovarLock(prisma: PrismaCola, id: string, viejo: Date, nuevo: Date): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "DigitalizacionGrabacion" SET "conversionLockAt"=$3 WHERE id=$1 AND ${DUENO}$2`,
    id,
    viejo,
    nuevo,
  );
}

export async function estadoDeConversion(prisma: PrismaCola, id: string): Promise<string | null> {
  const f = await prisma.$queryRawUnsafe<{ conversionEstado: string | null }[]>(
    `SELECT "conversionEstado" FROM "DigitalizacionGrabacion" WHERE id=$1`,
    id,
  );
  return f[0]?.conversionEstado ?? null;
}
