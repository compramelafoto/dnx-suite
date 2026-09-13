import { NextResponse } from "next/server";
import {
  expireProposals,
  purgeExpiredProposals,
  releaseConvertedProposalLogos,
} from "@repo/db/partners-proposals";
import { deletePartnerLogo } from "@/lib/admin/partners/partner-logo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Limpieza diaria de propuestas comerciales.
 *
 * Tres pasos, en este orden:
 *
 * 1. **Marcar vencidas** las que pasaron los treinta días. No cambia lo que ve
 *    nadie —el dominio ya las trata como vencidas— pero deja el estado limpio.
 * 2. **Borrar** las vencidas hace más de una semana, con su logo. La semana de
 *    gracia existe porque una propuesta recién vencida todavía se puede querer
 *    consultar, y recuperar una fila borrada no es una opción.
 * 3. **Soltar el logo de las convertidas.** La fila se conserva como historial;
 *    el archivo ya vive como asset del sponsor y tenerlo dos veces es pagar dos
 *    veces por lo mismo.
 *
 * Los archivos se borran de a uno y los errores no cortan la tanda: una clave
 * que ya no está en R2 no debería impedir borrar las demás.
 *
 * Auth: Bearer CRON_SECRET o header de Vercel Cron.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const ok =
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const ahora = new Date();

  try {
    const vencidas = await expireProposals(ahora);
    const borradas = await purgeExpiredProposals({ now: ahora });
    const soltados = await releaseConvertedProposalLogos({ now: ahora });

    const claves = [
      ...borradas.map((p) => p.logoStorageKey).filter((k): k is string => Boolean(k)),
      ...soltados,
    ];
    let archivosBorrados = 0;
    for (const clave of claves) {
      try {
        await deletePartnerLogo(clave);
        archivosBorrados += 1;
      } catch (err) {
        console.warn("[cron.purge-proposals] no se pudo borrar el logo", clave, err);
      }
    }

    return NextResponse.json({
      ok: true,
      vencidas,
      borradas: borradas.length,
      logosSoltados: soltados.length,
      archivosBorrados,
    });
  } catch (err) {
    // Mientras la migración de propuestas no esté aplicada no hay tabla que
    // barrer. Un error diario sería ruido, no información.
    console.warn("[cron.purge-proposals] sin tabla de propuestas todavía", err);
    return NextResponse.json({ ok: true, skipped: "no_table" });
  }
}
