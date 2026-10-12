import type { Prisma } from "@prisma/client";
import { queueEmail } from "@/lib/email-queue";
import { ensureUnsubscribeToken } from "@/lib/email-marketing/unsubscribe-token";
import { prisma } from "@/lib/prisma";
import { BOT_PLATFORM, leerAlcancePiloto } from "./config";
import { registrarOutreach } from "./outreach";

/** Campañas que también salen por mail (las otras sólo viven en el globito del panel). */
export const CAMPANIAS_MAIL = ["sin_ventas", "sin_escolar"] as const;
export type CampaniaMail = (typeof CAMPANIAS_MAIL)[number];

export const MAX_MAILS_POR_CORRIDA = 50;
const DIAS_SIN_ENTRAR = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Misma base que los mails de campañas de CLF (lib/email-marketing/process-campaign-queue.ts). */
export function baseUrlMail(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com").replace(/\/+$/, "");
}

/**
 * Regla de campaña para mail, idéntica a `aplica()` de lib/bot/segmentos.ts:
 * sin_ventas = tiene álbum y no vendió; sin_escolar = vendió y nunca tuvo álbum escolar.
 */
export function campaniaMail(f: { tieneAlbum: boolean; vendio: boolean; tuvoEscolar: boolean }): CampaniaMail | null {
  if (f.tieneAlbum && !f.vendio) return "sin_ventas";
  if (f.vendio && !f.tuvoEscolar) return "sin_escolar";
  return null;
}

// Los mismos filtros que cargarDatosSegmento (lib/bot/segmentos.ts), expresados sobre User.albums.
const TIENE_ALBUM: Prisma.UserWhereInput = { albums: { some: { deletedAt: null } } };
const VENDIO: Prisma.UserWhereInput = {
  albums: { some: { orders: { some: { status: "PAID", isTest: false, totalCents: { gt: 0 } } } } },
};
const TUVO_ESCOLAR: Prisma.UserWhereInput = {
  albums: { some: { deletedAt: null, OR: [{ schoolId: { not: null } }, { mode: "SCHOOL" }] } },
};

/** Traducción a Prisma de `campaniaMail`. */
export function whereCampaniaMail(c: CampaniaMail): Prisma.UserWhereInput {
  return c === "sin_ventas" ? { AND: [TIENE_ALBUM, { NOT: VENDIO }] } : { AND: [VENDIO, { NOT: TUVO_ESCOLAR }] };
}

export type DestinatarioMail = {
  userId: number;
  email: string;
  name: string | null;
  lastLoginAt: Date | null;
  campaign: CampaniaMail;
};

function compararPorLogin(a: DestinatarioMail, b: DestinatarioMail): number {
  if (a.lastLoginAt === null && b.lastLoginAt !== null) return -1;
  if (a.lastLoginAt !== null && b.lastLoginAt === null) return 1;
  const t = (a.lastLoginAt?.getTime() ?? 0) - (b.lastLoginAt?.getTime() ?? 0);
  return t !== 0 ? t : a.userId - b.userId;
}

/**
 * Elige a quién mandarle el mail: fotógrafos con opt-in, sin baja, sin bloquear, que no entran hace 30+ días,
 * alcanzados por el bot (modo piloto) y sin fila EMAIL previa para esa campaña. Máximo 50, el que hace más
 * que no entra primero (nunca entró = primero de todos).
 */
export async function elegirDestinatariosMail(now: Date): Promise<DestinatarioMail[]> {
  const alcance = await leerAlcancePiloto();
  if (alcance === null || (Array.isArray(alcance) && alcance.length === 0)) return [];

  const contactados = await prisma.botOutreach.findMany({
    where: { platform: BOT_PLATFORM, channel: "EMAIL", campaign: { in: [...CAMPANIAS_MAIL] } },
    select: { userId: true, campaign: true },
  });
  const limite = new Date(now.getTime() - DIAS_SIN_ENTRAR * DIA_MS);

  const listas = await Promise.all(
    CAMPANIAS_MAIL.map(async (campaign) => {
      const yaContactados = contactados.filter((c) => c.campaign === campaign).map((c) => c.userId);
      const where: Prisma.UserWhereInput = {
        AND: [
          { role: { in: ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"] } },
          { marketingOptIn: true, unsubscribedAt: null, isBlocked: false },
          { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: limite } }] },
          ...(alcance === "todos" ? [] : [{ id: { in: alcance } }]),
          ...(yaContactados.length ? [{ id: { notIn: yaContactados } }] : []),
          whereCampaniaMail(campaign),
        ],
      };
      const users = await prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, lastLoginAt: true },
        orderBy: [{ lastLoginAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
        take: MAX_MAILS_POR_CORRIDA,
      });
      return users.map((u) => ({ userId: u.id, email: u.email, name: u.name, lastLoginAt: u.lastLoginAt, campaign }));
    }),
  );
  return listas.flat().sort(compararPorLogin).slice(0, MAX_MAILS_POR_CORRIDA);
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const TEXTOS: Record<CampaniaMail, { asunto: string; parrafo: string }> = {
  sin_ventas: {
    asunto: "Te ayudo a vender tus fotos en CompraMeLaFoto",
    parrafo:
      "vimos que todavía no vendiste fotos en CompraMeLaFoto. Ahora tenés a DNX Bot, un asistente dentro de tu panel que revisa tu álbum, te dice qué le falta para vender y lo arregla por vos (siempre con tu confirmación).",
  },
  sin_escolar: {
    asunto: "¿Hacés fotografía escolar? Te ayudamos a automatizarla",
    parrafo:
      "en CompraMeLaFoto podés vender fotografía escolar con preventa: las familias pagan antes, eligen sus fotos y vos entregás ordenado por curso. DNX Bot te acompaña paso a paso a configurarlo.",
  },
};
const BOTON = "Entrar y que DNX Bot me ayude";
const CIERRE = "Lo encontrás en tu panel, listo para ayudarte cuando entres.";

export function armarMailOutreach(p: { campaign: CampaniaMail; nombre: string | null; unsubscribeToken: string }) {
  const base = baseUrlMail();
  const t = TEXTOS[p.campaign];
  const primer = p.nombre?.trim().split(/\s+/)[0] ?? "";
  const saludo = primer ? `Hola ${primer}:` : "Hola:";
  const enlace = `${base}/fotografo/dashboard?dnxbot=${p.campaign}`;
  const baja = `${base}/unsubscribe?token=${encodeURIComponent(p.unsubscribeToken)}`;
  const body = [
    `${saludo} ${t.parrafo}`,
    "",
    `${BOTON}: ${enlace}`,
    "",
    CIERRE,
    "",
    "El equipo de CompraMeLaFoto",
    "",
    `Si no querés recibir más novedades, podés darte de baja: ${baja}`,
  ].join("\n");
  const htmlBody = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
<p style="font-size:16px;line-height:1.5;margin:0 0 20px">${escaparHtml(saludo)} ${escaparHtml(t.parrafo)}</p>
<p style="margin:0 0 20px"><a href="${escaparHtml(enlace)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${escaparHtml(BOTON)}</a></p>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px">${escaparHtml(CIERRE)}</p>
<p style="font-size:15px;margin:0 0 24px">El equipo de CompraMeLaFoto</p>
<p style="font-size:12px;color:#777777;margin:0">Si no querés recibir más novedades, podés <a href="${escaparHtml(baja)}" style="color:#777777">darte de baja</a>.</p>
</div></body></html>`;
  return { subject: t.asunto, body, htmlBody };
}

export type ResultadoMail = { candidatos: number; enviados: number; fallidos: number };

/** Encola un mail por destinatario y registra SENT/FAILED en BotOutreach (canal EMAIL). */
export async function enviarMailsOutreach(now: Date = new Date()): Promise<ResultadoMail> {
  const destinatarios = await elegirDestinatariosMail(now);
  let enviados = 0;
  let fallidos = 0;
  for (const d of destinatarios) {
    try {
      const unsubscribeToken = await ensureUnsubscribeToken(d.userId);
      const mail = armarMailOutreach({ campaign: d.campaign, nombre: d.name, unsubscribeToken });
      await queueEmail({ to: d.email, ...mail, idempotencyKey: `dnx-bot-outreach-${d.campaign}-${d.userId}` });
      await registrarOutreach({ userId: d.userId, campaign: d.campaign, channel: "EMAIL", status: "SENT" });
      enviados++;
    } catch (e) {
      console.error("[bot-outreach] no se pudo encolar el mail", { userId: d.userId, campaign: d.campaign }, e);
      fallidos++;
      try {
        await registrarOutreach({ userId: d.userId, campaign: d.campaign, channel: "EMAIL", status: "FAILED" });
      } catch (e2) {
        console.error("[bot-outreach] tampoco se pudo registrar el fallo", e2);
      }
    }
  }
  return { candidatos: destinatarios.length, enviados, fallidos };
}
