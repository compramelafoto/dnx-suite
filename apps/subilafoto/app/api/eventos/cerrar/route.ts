import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

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
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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
    data: { status: "CLOSED", closedAt: ahora },
  });

  return NextResponse.json({ cerrados: cerrados.count, ahora: ahora.toISOString() });
}
