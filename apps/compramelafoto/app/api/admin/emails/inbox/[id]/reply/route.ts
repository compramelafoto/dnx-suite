import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/emails/send";
import { asuntoRespuesta, cabecerasDeHilo, casillaClf, direcciones, htmlRespuesta } from "@/lib/inbound-email/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CUERPO = 20_000;

/**
 * Responde un correo recibido. Sale desde la misma casilla a la que escribió la persona (p. ej.
 * info@compramelafoto.com), con `In-Reply-To`/`References` para que quede en su misma conversación,
 * y con "Responder a" esa casilla, así la contestación vuelve a la bandeja.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { cuerpo?: unknown; asunto?: unknown };
  const cuerpo = typeof body.cuerpo === "string" ? body.cuerpo.trim() : "";
  if (!cuerpo) return NextResponse.json({ error: "Escribí la respuesta." }, { status: 400 });
  if (cuerpo.length > MAX_CUERPO) return NextResponse.json({ error: "La respuesta es demasiado larga." }, { status: 400 });

  const original = await prisma.clfInboundEmail.findUnique({ where: { id } });
  if (!original) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const destino = original.fromEmail;
  if (!direcciones(destino).length || destino.endsWith("@compramelafoto.com")) {
    return NextResponse.json({ error: "Este correo no tiene una dirección a la que responder." }, { status: 400 });
  }

  const casilla = casillaClf(direcciones(original.to), direcciones(original.cc ?? "")) ?? undefined;
  const asunto =
    typeof body.asunto === "string" && body.asunto.trim() ? body.asunto.trim().slice(0, 300) : asuntoRespuesta(original.subject);

  const r = await sendEmail({
    to: destino,
    subject: asunto,
    html: htmlRespuesta({ cuerpo, original }),
    fromEmail: casilla,
    replyTo: casilla,
    headers: cabecerasDeHilo(original),
    templateKey: "ADMIN_INBOX_REPLY",
  });

  const ahora = new Date();
  const respuesta = await prisma.clfInboundEmailReply.create({
    data: {
      inboundEmailId: id,
      to: destino,
      subject: asunto,
      body: cuerpo,
      resendId: r.success ? (r.resendId ?? null) : null,
      status: r.success ? "SENT" : "FAILED",
      error: r.success ? null : (r.error ?? "Error desconocido"),
      sentByUserId: user.id,
    },
  });
  if (!r.success) {
    return NextResponse.json({ error: "No se pudo enviar la respuesta.", detalle: r.error, respuesta }, { status: 502 });
  }
  await prisma.clfInboundEmail.update({ where: { id }, data: { repliedAt: ahora, readAt: original.readAt ?? ahora } });
  return NextResponse.json({ ok: true, respuesta });
}
