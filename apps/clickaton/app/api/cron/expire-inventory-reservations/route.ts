import { NextResponse } from "next/server";
import { expireInventoryReservations } from "@repo/db/partners-inventory-bookings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cancela las reservas de inventario publicitario que ya vencieron.
 *
 * El dominio ya las ignora al calcular disponibilidad, así que esto no cambia lo
 * que ve un vendedor. Lo que hace es liberar el lugar para la restricción de
 * exclusión de la base, que no sabe qué hora es: sin esta tarea, la pantalla
 * muestra un lugar libre y la base rechaza la venta.
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

  try {
    const expired = await expireInventoryReservations(new Date());
    return NextResponse.json({ ok: true, expired });
  } catch (err) {
    // Mientras la migración del inventario no esté aplicada no hay tabla que
    // barrer. Devolver un error cada hora sería ruido, no información.
    console.warn("[cron.expire-inventory-reservations] sin tabla de ocupación todavía", err);
    return NextResponse.json({ ok: true, expired: 0, skipped: "no_table" });
  }
}
