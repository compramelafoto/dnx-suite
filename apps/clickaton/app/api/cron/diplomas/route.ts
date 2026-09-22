import { NextResponse } from "next/server";
import { processDueDiplomaEmails, processDueDiplomas } from "@/lib/diplomas/diploma-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/*
 * Cada diploma renderiza y sube a storage, igual que una placa: de a muchos en
 * una sola invocación se agota el tiempo de la función. El cron corre cada cinco
 * minutos, así que el backlog se despacha solo (ver app/api/cron/participant-cards).
 *
 * El mismo ciclo también despacha el correo del diploma encolado
 * (`processDueDiplomaEmails`): nunca se manda un correo dentro de una
 * petición web, sólo acá.
 */
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

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 25;
  const emailLimitParam = url.searchParams.get("emailLimit");
  const emailLimit = emailLimitParam ? Number.parseInt(emailLimitParam, 10) : 25;

  const result = await processDueDiplomas(Number.isFinite(limit) ? limit : 25);
  const emailResult = await processDueDiplomaEmails(
    Number.isFinite(emailLimit) ? emailLimit : 25
  );
  return NextResponse.json({ ok: true, ...result, email: emailResult });
}
