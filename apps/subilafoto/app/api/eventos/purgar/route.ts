import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { DIAS_DE_RETENCION } from "@/lib/retencion/candado";
import { borrarMaterial } from "@/lib/retencion/borrar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Borra el material de los eventos cuya retención venció.
 *
 * **Pocos por vuelta.** Cada evento puede tener cientos de archivos, y el cron corre una
 * vez por día: no hay apuro. Ir de a poco también acota el daño de una equivocación —si
 * algo estuviera mal, se descubre con tres eventos borrados y no con trescientos.
 *
 * Protegida con `Authorization: Bearer <CRON_SECRET>`.
 */

/** Cuántos eventos se borran como mucho en una vuelta. */
const TOPE_POR_VUELTA = 3;

export async function GET(req: Request) {
  const rechazo = rechazoDeLlave(req);
  if (rechazo) return rechazo;

  const ahora = new Date();

  /*
    Los eventos que cerraron antes de que existiera el plazo quedaron sin `retentionUntil`,
    y el candado los frena para siempre por "sin-plazo". Se los completa desde su propio
    cierre, que es la fecha que corresponde: no se les acorta ni se les alarga la vida.

    Va en SQL porque Prisma no sabe sumar un intervalo a una columna en un `updateMany`.
    Con `make_interval` y no con un texto casteado: el parámetro viaja como número y
    Postgres no tiene que adivinarle el tipo.
  */
  const completados = await prisma.$executeRaw`
    UPDATE "SubilafotoEvent"
    SET "retentionUntil" = "closedAt" + make_interval(days => ${DIAS_DE_RETENCION})
    WHERE "closedAt" IS NOT NULL AND "retentionUntil" IS NULL AND "purgedAt" IS NULL
  `;

  const candidatos = await prisma.subilafotoEvent.findMany({
    where: { purgedAt: null, retentionUntil: { not: null, lte: ahora } },
    // El más viejo primero: es el que más tiempo lleva ocupando lugar de más.
    orderBy: { retentionUntil: "asc" },
    take: TOPE_POR_VUELTA,
    select: { id: true, code: true },
  });

  const resultados = [];
  for (const evento of candidatos) {
    const r = await borrarMaterial(evento.id, ahora);
    resultados.push({ evento: evento.code, ...r });
  }

  return NextResponse.json({
    revisados: candidatos.length,
    borrados: resultados.filter((r) => r.borrado).length,
    plazosCompletados: completados,
    resultados,
  });
}
