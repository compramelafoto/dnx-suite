import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { conLatido } from "@/lib/salud/latido";
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

  /*
    Envuelto en el latido. Deja una fila por cron que responde la única pregunta que
    ninguna otra tabla contesta: si esto sigue corriendo. Un cron que se detiene no
    tira error ni rompe una pantalla — las fotos simplemente dejan de moderarse.

    La tarea devuelve datos pelados y el `NextResponse.json` queda afuera: así lo que
    se anota es el resultado y no un objeto de respuesta vacío.
  */
  const datos = await conLatido("purga", async () => {

    const ahora = new Date();

    /*
      Los eventos que cerraron antes de que existiera el plazo quedaron sin `retentionUntil`,
      y el candado los frena para siempre por "sin-plazo". Se los completa desde su propio
      cierre, que es la fecha que corresponde: no se les acorta ni se les alarga la vida.

      Va en SQL porque Prisma no sabe sumar un intervalo a una columna en un `updateMany`.

      **Multiplicando un intervalo, no con `make_interval`.** Prisma manda los números de
      JavaScript como `bigint`, y `make_interval(days => bigint)` no existe: Postgres no
      baja de bigint a int para resolver qué función llamar, y tira 42883. Multiplicar no
      resuelve ninguna función, así que el tipo del parámetro deja de importar.
    */
    const completados = await prisma.$executeRaw`
      UPDATE "SubilafotoEvent"
      SET "retentionUntil" = "closedAt" + (${DIAS_DE_RETENCION} * interval '1 day')
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

    return {
      revisados: candidatos.length,
      borrados: resultados.filter((r) => r.borrado).length,
      plazosCompletados: completados,
      resultados,
    };
  });

  return NextResponse.json(datos);
}
