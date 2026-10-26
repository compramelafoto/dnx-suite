import { NextRequest, NextResponse } from "next/server";
import { z } from "@repo/dnx-bot";
import { ACCIONES_PERMITIDAS } from "@/lib/soporte/acciones-catalogo";
import { soloAdmin } from "@/lib/soporte/admin-auth";
import { responderTicket } from "@/lib/soporte/responder";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/lib/support/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Cuerpo = z.strictObject({
  mensaje: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
  acciones: z.array(z.strictObject({ herramienta: z.enum(ACCIONES_PERMITIDAS), input: z.record(z.string(), z.unknown()) })).max(3),
  idempotencyKey: z.uuid(),
  enviarIgual: z.boolean().optional(),
});

/** POST — responder el reclamo desde la ficha, aplicando (o no) las acciones preparadas. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloAdmin();
  if (!auth.ok) return auth.res;
  const ticketId = Number((await params).id);
  if (!Number.isFinite(ticketId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const cuerpo = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const r = await responderTicket({ ticketId, admin: auth.user, ...cuerpo.data });
  if (r.ok) return NextResponse.json(r);
  if ("noEncontrado" in r) return NextResponse.json(r, { status: 404 });
  return NextResponse.json(r, { status: 409 });
}
