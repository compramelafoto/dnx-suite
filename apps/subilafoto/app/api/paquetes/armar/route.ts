import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { conLatido } from "@/lib/salud/latido";
import { armarPaquete } from "@/lib/paquete/armar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Arma los paquetes que estén pendientes.
 *
 * **Uno por vuelta, a propósito.** Un casamiento puede tardar minutos y la función tiene
 * un tope de cinco: intentar dos seguidos deja el segundo cortado a la mitad. Con el cron
 * cada quince minutos, la promesa de las 24 horas sobra por mucho.
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
  const datos = await conLatido("paquetes", async () => {

    /*
      Se busca lo comprado y todavía no entregado. La condición de que no tenga ya un paquete
      armándose evita que dos vueltas del cron se pisen sobre el mismo evento: la primera lo
      deja en BUILDING y la segunda lo saltea.
    */
    const evento = await prisma.subilafotoEvent.findFirst({
      where: {
        downloadStatus: "PURCHASED",
        packages: { none: { status: { in: ["BUILDING", "READY"] } } },
      },
      orderBy: { updatedAt: "asc" },
      select: { id: true, code: true },
    });

    if (!evento) return { armados: 0 };

    const arranque = Date.now();
    const resultado = await armarPaquete(evento.id);

    return {
      evento: evento.code,
      ...resultado,
      ms: Date.now() - arranque,
    };
  });

  return NextResponse.json(datos);
}
