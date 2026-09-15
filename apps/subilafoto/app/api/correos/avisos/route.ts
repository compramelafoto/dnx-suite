import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { avisoQueCorresponde } from "@/lib/correos/calendario";
import { enviarAviso } from "@/lib/correos/enviar";
import { formatearPesos } from "@/lib/precios";
import { precioDeLaDescarga } from "@/lib/pagos/venta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });

/** Cuántos avisos como mucho por vuelta. Con el cron cada hora, alcanza y sobra. */
const TOPE_POR_VUELTA = 20;

/**
 * Manda los avisos posteriores al evento.
 *
 * Recorre los eventos cerrados y, para cada uno, decide si le toca alguno de los cinco
 * avisos. **Uno por evento y por vuelta**: mandar varios de una es la forma más rápida de
 * que alguien marque el correo como spam.
 *
 * Protegida con `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const ahora = new Date();
  const hace31Dias = new Date(ahora.getTime() - 31 * 24 * 60 * 60 * 1000);

  const eventos = await prisma.subilafotoEvent.findMany({
    where: {
      status: "CLOSED",
      // Más viejo que el último hito no tiene nada que recibir.
      closedAt: { not: null, gte: hace31Dias },
      // Al material ya borrado no se lo ofrece. El borrado deja el evento en `ARCHIVED`,
      // así que esto es redundante hoy; queda explícito porque el día que cambie el
      // estado, lo que no puede pasar es escribirle a alguien sobre fotos que no existen.
      purgedAt: null,
    },
    orderBy: { closedAt: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      closedAt: true,
      retentionUntil: true,
      downloadStatus: true,
      sellerProfile: { select: { displayName: true, basePriceCents: true } },
      orders: {
        where: { status: "PAID" },
        select: { buyerEmail: true, includesDownload: true },
        orderBy: { createdAt: "asc" },
      },
      emailsSent: { select: { aviso: true } },
      links: { where: { kind: "CLIENT", revokedAt: null }, select: { token: true }, take: 1 },
    },
  });

  const base = new URL(req.url).origin;
  const resumen = { revisados: eventos.length, enviados: 0, secos: 0, fallos: 0, salteados: 0 };

  for (const evento of eventos) {
    if (resumen.enviados + resumen.secos + resumen.fallos >= TOPE_POR_VUELTA) break;

    const aviso = avisoQueCorresponde({
      cierre: evento.closedAt,
      ahora,
      yaEnviados: evento.emailsSent.map((e) => e.aviso),
    });
    if (!aviso) continue;

    // El correo sale de la orden del evento: es quien lo contrató.
    const compra = evento.orders.find((o) => o.buyerEmail);
    if (!compra?.buyerEmail) {
      resumen.salteados += 1;
      continue;
    }

    /*
      El enlace del panel se crea al primer aviso y no al crear el evento: así un evento
      que nunca llega a cerrarse no deja un enlace suelto con acceso a nada.
    */
    const token =
      evento.links[0]?.token ??
      (
        await prisma.subilafotoAccessLink.create({
          data: {
            eventId: evento.id,
            kind: "CLIENT",
            token: randomBytes(24).toString("base64url"),
            label: "Panel del cliente",
          },
          select: { token: true },
        })
      ).token;

    const yaTiene =
      compra.includesDownload ||
      evento.downloadStatus === "PURCHASED" ||
      evento.downloadStatus === "DELIVERED";

    const resultado = await enviarAviso({
      eventoId: evento.id,
      aviso,
      para: compra.buyerEmail,
      datos: {
        aviso,
        nombreDelEvento: evento.name,
        vendedor: evento.sellerProfile.displayName,
        panelUrl: `${base}/cliente/${token}`,
        yaTieneLaDescarga: yaTiene,
        seBorraEl: evento.retentionUntil ? FECHA.format(evento.retentionUntil) : "en 30 días",
        precioDeLaDescarga: formatearPesos(
          precioDeLaDescarga(evento.sellerProfile.basePriceCents),
        ),
      },
    });

    if (resultado.estado === "enviado") resumen.enviados += 1;
    else if (resultado.estado === "seco") resumen.secos += 1;
    else if (resultado.estado === "fallo") resumen.fallos += 1;
    else resumen.salteados += 1;
  }

  return NextResponse.json(resumen);
}
