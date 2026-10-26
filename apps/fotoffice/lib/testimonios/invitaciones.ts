import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { TESTIMONIO_FORM_SEGMENT } from "@/lib/website/constants";
import { esTablaFaltante, type DatosTestimonio } from "./dominio";
import { crearTestimonio } from "./repositorio";

/**
 * Invitación personal a dejar un testimonio (`/w/<slug>/testimonio?t=<token>`).
 *
 * - El token son 32 bytes al azar en base64url (43 caracteres). **En la base sólo queda su hash**
 *   SHA-256: quien lea la tabla no puede armar enlaces.
 * - Vence a los 90 días y sirve **una sola vez**. Usarlo y crear el testimonio pasan en la misma
 *   transacción, y el «usarlo» es un UPDATE condicionado a que siga ENVIADA: si dos envíos llegan
 *   juntos, Postgres deja pasar uno y el otro encuentra 0 filas y no crea nada.
 * - Todo se busca con el `workspaceId` del sitio donde se abrió: un token de otro estudio no existe.
 */

export const DIAS_VIGENCIA_INVITACION = 90;
const DIA_MS = 24 * 60 * 60 * 1000;
/** 32 bytes en base64url, sin relleno. */
const FORMA_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const MENSAJE_SIN_SITIO = "El sitio todavía no tiene dirección pública: elegila en Sitio web antes de pedir testimonios.";
export const MENSAJE_FICHA_AJENA = "Ese cliente o proyecto no es de esta cuenta.";

type Db = Prisma.TransactionClient | typeof prisma;

export function nuevoTokenDeInvitacion(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDeTokenDeInvitacion(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** ¿Tiene forma de token? Lo que no la tiene ni se busca en la base. */
export function tokenDeInvitacionConForma(token: unknown): token is string {
  return typeof token === "string" && FORMA_TOKEN.test(token);
}

export function vencimientoDeInvitacion(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_VIGENCIA_INVITACION * DIA_MS);
}

function origenDeLaApp(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
}

/**
 * El enlace al formulario de testimonio, abierto o personal (con `?t=`). Con dominio propio
 * conectado va ahí; si no, bajo `/w/<slug>` en FOTOFFICE. Sin origen conocido (pruebas, local sin
 * variables) devuelve la ruta relativa.
 */
export function enlaceDeTestimonio(
  workspaceSlug: string,
  token?: string | null,
  sitio: { customDomain?: string | null; appOrigin?: string } = {},
): string {
  const consulta = token ? `?t=${encodeURIComponent(token)}` : "";
  if (sitio.customDomain) return `https://${sitio.customDomain}/${TESTIMONIO_FORM_SEGMENT}${consulta}`;
  const origen = (sitio.appOrigin ?? origenDeLaApp()).replace(/\/+$/, "");
  return `${origen}/w/${encodeURIComponent(workspaceSlug)}/${TESTIMONIO_FORM_SEGMENT}${consulta}`;
}

export type OpcionesInvitacion = {
  clientId?: string | null;
  proyectoId?: string | null;
  correo?: string | null;
  nombreSugerido?: string | null;
  detalleSugerido?: string | null;
  userId?: number | null;
  /** EMAIL | WHATSAPP | ENLACE, si ya se sabe por dónde sale. */
  canal?: "EMAIL" | "WHATSAPP" | "ENLACE" | null;
  /** Freno de duplicados del pedido automático (una por cliente y proyecto). */
  claveIdempotencia?: string | null;
  ahora?: Date;
};

function recorte(v: string | null | undefined, max: number): string | null {
  const t = v?.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Crea la invitación y devuelve el enlace (el token en claro sólo vive en ese enlace). El cliente y
 * el proyecto, si vienen, tienen que ser de este workspace. Lanza si el sitio no tiene dirección.
 */
export async function crearInvitacion(workspaceId: string, opciones: OpcionesInvitacion): Promise<{ invitacionId: string; enlace: string }> {
  const ahora = opciones.ahora ?? new Date();
  const clientId = opciones.clientId || null;
  const proyectoId = opciones.proyectoId || null;
  if (clientId) {
    const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true } });
    if (!c) throw new Error(MENSAJE_FICHA_AJENA);
  }
  if (proyectoId) {
    const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId }, select: { id: true } });
    if (!p) throw new Error(MENSAJE_FICHA_AJENA);
  }
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio?.slug && !sitio?.customDomain) throw new Error(MENSAJE_SIN_SITIO);

  const token = nuevoTokenDeInvitacion();
  const inv = await prisma.fotofficeTestimonioInvitacion.create({
    data: {
      workspaceId,
      tokenHash: hashDeTokenDeInvitacion(token),
      clientId,
      proyectoId,
      correo: recorte(opciones.correo, 254)?.toLowerCase() ?? null,
      nombreSugerido: recorte(opciones.nombreSugerido, 120),
      detalleSugerido: recorte(opciones.detalleSugerido, 160),
      estado: "ENVIADA",
      canal: opciones.canal ?? null,
      enviadaAt: ahora,
      venceAt: vencimientoDeInvitacion(ahora),
      claveIdempotencia: opciones.claveIdempotencia ?? null,
      createdByUserId: typeof opciones.userId === "number" ? String(opciones.userId) : null,
    },
    select: { id: true },
  });
  return { invitacionId: inv.id, enlace: enlaceDeTestimonio(sitio.slug ?? "", token, { customDomain: sitio.customDomain }) };
}

export type InvitacionValida = {
  id: string;
  clientId: string | null;
  proyectoId: string | null;
  nombreSugerido: string | null;
  detalleSugerido: string | null;
};

export type LecturaInvitacion = { estado: "VALIDA"; inv: InvitacionValida } | { estado: "USADA" | "VENCIDA" | "INEXISTENTE" };

async function leerCon(db: Db, workspaceId: string, token: unknown, ahora: Date): Promise<LecturaInvitacion> {
  if (!tokenDeInvitacionConForma(token)) return { estado: "INEXISTENTE" };
  const fila = await db.fotofficeTestimonioInvitacion.findFirst({
    where: { tokenHash: hashDeTokenDeInvitacion(token), workspaceId },
    select: { id: true, estado: true, venceAt: true, clientId: true, proyectoId: true, nombreSugerido: true, detalleSugerido: true },
  });
  if (!fila) return { estado: "INEXISTENTE" };
  if (fila.estado === "RESPONDIDA") return { estado: "USADA" };
  if (fila.estado !== "ENVIADA" || fila.venceAt.getTime() <= ahora.getTime()) return { estado: "VENCIDA" };
  const { id, clientId, proyectoId, nombreSugerido, detalleSugerido } = fila;
  return { estado: "VALIDA", inv: { id, clientId, proyectoId, nombreSugerido, detalleSugerido } };
}

/** Para la página: si las tablas todavía no existen, el enlace no existe (nunca un error). */
export async function leerInvitacion(workspaceId: string, token: unknown, ahora: Date = new Date()): Promise<LecturaInvitacion> {
  try {
    return await leerCon(prisma, workspaceId, token, ahora);
  } catch (err) {
    if (esTablaFaltante(err)) return { estado: "INEXISTENTE" };
    throw err;
  }
}

export type ExtrasRespuesta = {
  consentimiento: boolean;
  consentimientoTexto: string;
  autorFotoUrl?: string | null;
  autorFotoKey?: string | null;
};

export type ResultadoRespuesta = { ok: true; id: string } | { ok: false; estado: "USADA" | "VENCIDA" | "INEXISTENTE" };

/**
 * Responde una invitación: la marca RESPONDIDA y crea el testimonio (PENDIENTE, origen INVITACION,
 * atado al cliente y al proyecto de la invitación) en una sola transacción. El UPDATE pide
 * `estado = ENVIADA` y que no haya vencido: si cuenta 0 filas, otro envío ganó (o venció en el
 * medio) y no se crea nada.
 */
export async function responderInvitacion(
  workspaceId: string,
  token: unknown,
  datos: DatosTestimonio,
  extras: ExtrasRespuesta,
  ahora: Date = new Date(),
): Promise<ResultadoRespuesta> {
  return prisma.$transaction(async (tx) => {
    const leida = await leerCon(tx, workspaceId, token, ahora);
    if (leida.estado !== "VALIDA") return { ok: false, estado: leida.estado };
    const marcada = await tx.fotofficeTestimonioInvitacion.updateMany({
      where: { id: leida.inv.id, workspaceId, estado: "ENVIADA", venceAt: { gt: ahora } },
      data: { estado: "RESPONDIDA", respondidaAt: ahora },
    });
    if (marcada.count === 0) return { ok: false, estado: "USADA" };
    const t = await crearTestimonio(
      workspaceId,
      datos,
      {
        origen: "INVITACION",
        consentimiento: extras.consentimiento,
        consentimientoTexto: extras.consentimientoTexto,
        clientId: leida.inv.clientId,
        proyectoId: leida.inv.proyectoId,
        invitacionId: leida.inv.id,
        autorFotoUrl: extras.autorFotoUrl ?? null,
        autorFotoKey: extras.autorFotoKey ?? null,
      },
      ahora,
      tx,
    );
    return { ok: true, id: t.id };
  });
}
