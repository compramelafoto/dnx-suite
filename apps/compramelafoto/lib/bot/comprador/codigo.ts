import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { sendEmail } from "@/emails/send";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";
import { BOT_PLATFORM } from "../config";
import { marcarVerificada } from "./store";

export const CODIGO_TTL_MS = 10 * 60 * 1000;
export const CODIGO_MAX_INTENTOS = 5;
export const CODIGOS_POR_HORA = 3;
export const VERIFICACION_DURA_MS = 24 * 60 * 60 * 1000;
export const RESPUESTA_CODIGO =
  "Si hay compras con ese mail, te llegó un código de 6 números. Revisá también spam y promociones. Vence en 10 minutos.";

const UNA_HORA_MS = 60 * 60 * 1000;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MENSAJES = {
  sin_codigo: "Primero pedime un código con tu mail.",
  ya_usado: "Ese código ya se usó. Si hace falta, pedime uno nuevo.",
  vencido: "Ese código venció. Pedime uno nuevo.",
  intentos: "Hubo demasiados intentos con ese código. Pedime uno nuevo.",
  incorrecto: "Ese código no coincide. Revisalo y probá de nuevo.",
} as const;

type MotivoFallo = "sin_codigo" | "vencido" | "intentos" | "incorrecto";
type ResultadoVerificacion = { ok: true; email: string } | { ok: false; motivo: MotivoFallo; mensaje: string };

/** 6 dígitos con ceros a la izquierda, al azar criptográfico. */
export function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Hash atado a la conversación donde se pidió: el código no sirve fuera de ese navegador. */
export function hashCodigo(conversationId: string, codigo: string): string {
  return createHash("sha256").update(`${conversationId}:${codigo}`).digest("hex");
}

/**
 * Pide un código por mail. La respuesta es siempre la misma (exista o no el mail, se haya mandado o no),
 * para que nadie pueda averiguar con el bot qué mails compraron.
 */
export async function pedirCodigo(p: { conversationId: string; ipHash: string; email: string }): Promise<{ mensaje: string; enviado: boolean }> {
  const generica = (enviado: boolean) => ({ mensaje: RESPUESTA_CODIGO, enviado });
  const email = normalizeEmail(p.email);
  if (!EMAIL_VALIDO.test(email)) return generica(false);

  const desde = new Date(Date.now() - UNA_HORA_MS);
  const [porMail, porIp] = await Promise.all([
    prisma.botEmailCode.count({ where: { email, createdAt: { gte: desde } } }),
    prisma.botEmailCode.count({ where: { ipHash: p.ipHash, createdAt: { gte: desde } } }),
  ]);
  if (porMail >= CODIGOS_POR_HORA || porIp >= CODIGOS_POR_HORA) return generica(false);

  const compras = await prisma.order.count({ where: { buyerEmail: { equals: email, mode: "insensitive" }, isTest: false } });
  if (compras === 0) return generica(false);

  const codigo = generarCodigo();
  await prisma.botEmailCode.create({
    data: {
      email,
      codeHash: hashCodigo(p.conversationId, codigo),
      conversationId: p.conversationId,
      ipHash: p.ipHash,
      expiresAt: new Date(Date.now() + CODIGO_TTL_MS),
    },
  });

  // En el momento (no por la cola, que corre cada minuto): la persona está esperando en el chat.
  try {
    const r = await sendEmail({
      to: email,
      subject: "Tu código de CompraMeLaFoto",
      html: `Hola: tu código para ver tus compras en CompraMeLaFoto es <strong>${codigo}</strong>. Vence en 10 minutos. Si no lo pediste, ignorá este mail.`,
      templateKey: "BOT_CODIGO",
    });
    if (!r?.success) {
      console.error("[bot comprador] no se pudo mandar el código por mail", { conversationId: p.conversationId });
      return generica(false);
    }
  } catch (err) {
    console.error("[bot comprador] error al mandar el código por mail", { conversationId: p.conversationId, error: String((err as Error)?.message ?? err) });
    return generica(false);
  }
  return generica(true);
}

function mismoHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verifica el código. Busca el último código sin usar del navegador (`guestKey`), no sólo de la conversación actual:
 * si la conversación rotó entre pedir y verificar, el código sigue valiendo (se hashea con la conversación de la fila).
 * Marca verificada la conversación actual por 24 h.
 */
export async function verificarCodigo(p: { conversationId: string; guestKey: string; codigo: string }): Promise<ResultadoVerificacion> {
  const fallo = (motivo: MotivoFallo, mensaje: string = MENSAJES[motivo]): ResultadoVerificacion => ({ ok: false, motivo, mensaje });
  const codigo = p.codigo.replace(/\D/g, "");
  if (codigo.length !== 6) return fallo("incorrecto");

  const fila = await prisma.botEmailCode.findFirst({
    where: { usedAt: null, conversation: { is: { platform: BOT_PLATFORM, guestKey: p.guestKey, audience: "BUYER" } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, conversationId: true, codeHash: true, attempts: true, expiresAt: true },
  });
  if (!fila) return fallo("sin_codigo");
  if (fila.expiresAt.getTime() <= Date.now()) return fallo("vencido");
  if (fila.attempts >= CODIGO_MAX_INTENTOS) return fallo("intentos");

  if (!mismoHash(hashCodigo(fila.conversationId, codigo), fila.codeHash)) {
    const r = await prisma.botEmailCode.update({
      where: { id: fila.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return r.attempts >= CODIGO_MAX_INTENTOS ? fallo("intentos") : fallo("incorrecto");
  }

  const ahora = new Date();
  const usado = await prisma.botEmailCode.updateMany({ where: { id: fila.id, usedAt: null }, data: { usedAt: ahora } });
  if (usado.count !== 1) return fallo("sin_codigo", MENSAJES.ya_usado);
  await marcarVerificada(p.conversationId, fila.email, new Date(ahora.getTime() + VERIFICACION_DURA_MS));
  return { ok: true, email: fila.email };
}
