import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { conLatido } from "@/lib/salud/latido";
import { DIAS_DE_RETENCION, retencionHasta } from "@/lib/retencion/candado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cierra los eventos cuya ventana ya venció.
 *
 * Cerrar es sólo cambiar el estado: **no interrumpe nada que esté en curso**.
 * Una foto que entró un minuto antes del cierre sigue su camino y se modera
 * igual — el proceso de moderación no mira el estado del evento a propósito.
 * Cortarla a mitad sería perder una foto que el invitado subió a tiempo.
 *
 * Lo que sí cambia: la puerta deja de aceptar subidas y la pantalla del salón
 * pasa a la placa de cierre.
 *
 * Protegida con `Authorization: Bearer <CRON_SECRET>`.
 */
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
  const datos = await conLatido("cierre", async () => {

    const ahora = new Date();

    /*
      La condición va en el `where` y no en un `if` después de leer: así el cierre
      es una sola escritura atómica. Si dos ejecuciones del cron se pisan, la
      segunda cambia cero filas en vez de volver a marcar `closedAt`.

      Es la misma regla que `debeCerrarse`, expresada en SQL. Los tests cubren la
      versión de TypeScript; acá lo que importa es que el borde coincida —`lte`,
      no `lt`— porque a las 12 horas exactas el evento ya terminó.
    */
    const cerrados = await prisma.subilafotoEvent.updateMany({
      where: {
        status: { in: ["ACTIVE", "SCHEDULED"] },
        deactivationAt: { not: null, lte: ahora },
      },
      /*
        El plazo de retención se fija acá y no al borrar. Si se calculara después, cambiar
        la constante movería la fecha de borrado de eventos ya cerrados —y de los correos
        que ya le prometieron esa fecha al cliente.
      */
      data: { status: "CLOSED", closedAt: ahora, retentionUntil: retencionHasta(ahora) },
    });

    return {
      cerrados: cerrados.count,
      ahora: ahora.toISOString(),
      diasDeRetencion: DIAS_DE_RETENCION,
    };
  });

  return NextResponse.json(datos);
}
