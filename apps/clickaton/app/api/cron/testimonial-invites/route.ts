/**
 * Invita a testimoniar unos días después de cada edición.
 *
 * Corre a diario. La clave única por edición y correo, más la clave de
 * idempotencia de la cola de correo, hacen que repetir la corrida no repita
 * ningún envío.
 */
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { inviteTestimonials } from "@/lib/testimonials/application/invite-testimonials";
import { selectEditionsReadyForInvites } from "@/lib/testimonials/application/invite-selection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const results = [];
  for (const edition of ready) {
    results.push({
      editionId: edition.id,
      ...(await inviteTestimonials({ editionId: edition.id })),
    });
  }

  return NextResponse.json({ ok: true, editions: results });
}
