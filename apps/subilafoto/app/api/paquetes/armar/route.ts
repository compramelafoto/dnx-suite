import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
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
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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

  if (!evento) return NextResponse.json({ armados: 0 });

  const arranque = Date.now();
  const resultado = await armarPaquete(evento.id);

  return NextResponse.json({
    evento: evento.code,
    ...resultado,
    ms: Date.now() - arranque,
  });
}
