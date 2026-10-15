/**
 * Invita a testimoniar unos días después de cada edición.
 *
 * Corre cada hora. La clave única por edición y correo, más la clave de
 * idempotencia de la cola de correo, hacen que repetir la corrida no repita
 * ningún envío — y correr seguido es lo que hace que una tanda cortada por el
 * tope se complete en una hora y no al día siguiente.
 */
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import {
  INVITES_PER_RUN,
  inviteTestimonials,
} from "@/lib/testimonials/application/invite-testimonials";
import { selectEditionsReadyForInvites } from "@/lib/testimonials/application/invite-selection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Cada correo es una ida y vuelta a Resend: con el tope por corrida, 300s
// alcanzan de sobra y la función no muere a la mitad de una tanda.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const authorized =
    (Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1");
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const candidates = await prisma.clickatonEdition.findMany({
    where: { testimonialsEnabled: true, isOpsFixture: false },
    select: {
      id: true,
      testimonialsEnabled: true,
      testimonialInviteDelayDays: true,
      endAt: true,
      isOpsFixture: true,
    },
  });

  const ready = selectEditionsReadyForInvites(candidates, new Date());

  // El cupo es de la corrida entera, no de cada edición: lo que protege es el
  // tiempo de la función, que es uno solo.
  const limitParam = new URL(request.url).searchParams.get("limit");
  const parsed = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  let budget = Number.isFinite(parsed) && parsed > 0 ? parsed : INVITES_PER_RUN;

  const results = [];
  for (const edition of ready) {
    const outcome = await inviteTestimonials({
      editionId: edition.id,
      limit: budget,
    });
    budget -= outcome.sent + outcome.failed;
    results.push({ editionId: edition.id, ...outcome });
    if (budget <= 0) break;
  }

  return NextResponse.json({ ok: true, editions: results });
}
