import { barrerAsistenciasVencidas } from "@/lib/inauguracion/limpieza";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Limpieza diaria de los datos de asistencia vencidos (D22), para Vercel Cron. Sin `CRON_SECRET`
 * responde 503 y no borra nada: la limpieza perezosa del panel sigue funcionando igual.
 */
export async function GET(req: Request) {
  const rechazo = rechazoDeLlave(req);
  if (rechazo) return rechazo;
  return Response.json({ muestras: await barrerAsistenciasVencidas(new Date(), { tope: 500 }) });
}
