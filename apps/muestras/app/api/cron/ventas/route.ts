import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { barrerVentas } from "@/lib/ventas/barrido";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Barrido de la venta cada 10 minutos (etapa 8, D29), para Vercel Cron. Sin `CRON_SECRET` responde
 * 503 y no toca nada: la reserva vence igual de forma perezosa y el pedido concilia al abrirlo.
 */
export async function GET(req: Request) {
  const rechazo = rechazoDeLlave(req);
  if (rechazo) return rechazo;
  return Response.json({ ok: true, ...(await barrerVentas(new Date())) }, { headers: { "Cache-Control": "private, no-store" } });
}
