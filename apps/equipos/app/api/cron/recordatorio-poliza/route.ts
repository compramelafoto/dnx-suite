import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { sendPortalEmail } from "@/lib/correo";
import { fechaAr } from "@/lib/inventario/formato";
import { isRenewalReminderDue, nextRenewalAnniversary } from "@/lib/informe/recordatorio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cron diario: avisa 30 días antes del aniversario de la póliza (como mucho una vez al año). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (bearer !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const base = process.env.APP_URL?.replace(/\/$/, "") ?? "";
    const candidatos = await prisma.gearOwnerSettings.findMany({
      where: { policyRenewalDate: { not: null } },
      select: {
        id: true,
        policyRenewalDate: true,
        lastRenewalReminderAt: true,
        user: { select: { email: true, name: true } },
      },
    });

    let enviados = 0;
    let fallidos = 0;
    for (const c of candidatos) {
      if (!c.policyRenewalDate || !c.user?.email) continue;
      if (!isRenewalReminderDue(c.policyRenewalDate, now, c.lastRenewalReminderAt)) continue;
      try {
        const r = await sendPortalEmail(c.user.email, "recordatorio_poliza", {
          nombre: c.user.name ?? "",
          // El próximo aniversario, no la fecha original cargada (que puede ser de años atrás).
          fecha: fechaAr(nextRenewalAnniversary(c.policyRenewalDate, now)),
          url: base ? `${base}/mi-equipo/informe` : "",
        });
        if (r.success) {
          // Sólo tras un envío exitoso: si falla, mañana se reintenta.
          await prisma.gearOwnerSettings.update({
            where: { id: c.id },
            data: { lastRenewalReminderAt: now },
          });
          enviados++;
        } else {
          fallidos++;
        }
      } catch (err) {
        fallidos++;
        console.error("[recordatorio-poliza] error con un socio:", err);
      }
    }
    return NextResponse.json({ ok: true, revisados: candidatos.length, enviados, fallidos });
  } catch (err) {
    console.error("[recordatorio-poliza] error", err);
    return NextResponse.json({ ok: false, error: "recordatorio_failed" }, { status: 500 });
  }
}
