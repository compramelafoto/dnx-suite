/**
 * Encola el correo del diploma para toda la edición: sólo a quienes tienen
 * diploma vigente y dirección de correo (ver `enqueueEditionDiplomaEmails`).
 * No manda nada acá — nunca dentro de la petición web. El envío real lo hace
 * el proceso automático (`processDueDiplomaEmails`, en `diploma-batch.ts`),
 * de a tandas, desde el cron — mismo criterio que la generación del diploma
 * en sí (`app/api/cron/diplomas/route.ts`).
 */
import { NextResponse } from "next/server";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { enqueueEditionDiplomaEmails } from "@/lib/diplomas/diploma-email";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  const result = await enqueueEditionDiplomaEmails(editionId);
  return NextResponse.json({ ok: true, ...result });
}
