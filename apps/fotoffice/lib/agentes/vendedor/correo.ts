import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { unsubscribeHeaders } from "@/lib/mailing/context";
import { resolveUnsubscribeSecret, signUnsubscribeToken } from "@/lib/mailing/unsubscribe-token";
import { direccionBloqueada } from "./bloqueos";
import { AUTOR_VENDEDOR, PARAM_SEGUIMIENTO, REMITENTE_VENDEDOR, RESPONDER_A, URL_CLF, type PasoSalida } from "./tipos";

/**
 * Envío de los correos del Vendedor por Resend. Texto simple, de Daniel, con baja en un clic.
 *
 * Usa `sendTransactionalEmail` tal cual, cambiándole el entorno: la clave propia del Vendedor (si
 * está) y el remitente de Daniel. Así `send-email.ts` no se toca.
 *
 * Un mismo envío nunca sale dos veces: la clave de idempotencia va a Resend (que no repite un envío
 * con la misma clave dentro de las 24 h) y, si el correo ya quedó guardado, no se vuelve a mandar.
 */

export type { PasoSalida };

/** Ámbito de la baja del Vendedor en el token firmado. Una baja de una institución no vale acá. */
export const AMBITO_BAJA_VENDEDOR = "dnx-vendedor";

const RESEND_EMAILS = "https://api.resend.com/emails";
const TIEMPO_RESEND_MS = 10_000;

/** Una ruta de CLF (`/land`) o una dirección completa permitida (Muestras Fotográficas). */
export function enlaceSeguimiento(ruta: string, token: string): string {
  const base = /^https:\/\//.test(ruta) ? ruta : `${URL_CLF}${ruta}`;
  return `${base}?${PARAM_SEGUIMIENTO}=${token}`;
}

export function pieDeCorreo(urlBaja: string): string {
  return [
    "—",
    "Daniel Cuart",
    "CompraMeLaFoto · compramelafoto.com",
    "",
    `Te escribo porque tu contacto está publicado como dato comercial. Si no querés que te escriba más, respondé «baja» o entrá acá: ${urlBaja}`,
  ].join("\n");
}

/** Reemplaza `{{ENLACE}}` y `{{CURSO}}` y agrega el pie. */
export function armarTexto(cuerpo: string, enlaces: { ENLACE?: string; CURSO?: string }, urlBaja: string): string {
  let texto = cuerpo;
  for (const marcador of ["ENLACE", "CURSO"] as const) {
    const url = enlaces[marcador];
    if (url !== undefined) texto = texto.split(`{{${marcador}}}`).join(url);
  }
  return `${texto.trimEnd()}\n\n${pieDeCorreo(urlBaja)}`;
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** El texto escapado en un bloque con `pre-wrap`, con los enlaces clicables y nada más. */
export function htmlDeTexto(texto: string): string {
  const cuerpo = escapar(texto).replace(/https?:\/\/[^\s<]+/g, (crudo) => {
    // La puntuación del final (un punto o una coma) es de la oración, no de la dirección.
    const url = crudo.replace(/[.,;:!?)»]+$/, "");
    return `<a href="${url}">${url}</a>${crudo.slice(url.length)}`;
  });
  return `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px">${cuerpo}</div>`;
}

/** Enlace de baja de un clic; null si falta la dirección de la app o la clave para firmarlo. */
export function urlBajaVendedor(email: string): string | null {
  const app = appUrl();
  const secreto = resolveUnsubscribeSecret();
  if (!app || !secreto) return null;
  const t = signUnsubscribeToken({ workspaceId: AMBITO_BAJA_VENDEDOR, email }, secreto);
  return `${app}/api/correo/baja-dnx?t=${encodeURIComponent(t)}`;
}

/** `<…>` alrededor de un Message-ID, una sola vez. */
function conAngulos(id: string): string {
  const limpio = id.trim().replace(/^<+/, "").replace(/>+$/, "");
  return `<${limpio}>`;
}

type Env = Record<string, string | undefined>;

export function claveVendedor(env: Env): string | null {
  return env.VENDEDOR_RESEND_API_KEY?.trim() || env.RESEND_API_KEY?.trim() || null;
}

export type DepsEnvio = {
  enviar?: typeof sendTransactionalEmail;
  env?: Env;
  traerMessageId?: (resendId: string) => Promise<string | null>;
};

export type EntradaEnvio = {
  hiloId: string | null;
  contactoId: string | null;
  para: string;
  asunto: string;
  texto: string;
  paso: PasoSalida;
  claveIdempotencia: string;
  enHilo?: { messageId: string; referencias: string[] };
  responderA?: string;
};

export type ResultadoEnvio = { ok: true; correoId: string } | { ok: false; motivo: string; reintentable: boolean };

/** Pasos que le escriben al contacto (no a Daniel). */
const PASOS_AL_CONTACTO: readonly PasoSalida[] = ["PRIMERO", "RECORDATORIO", "RESPUESTA"];

/** Pasos que salen una sola vez por hilo: si ya hay un correo guardado, es el mismo envío. */
const PASOS_UNICOS: readonly PasoSalida[] = ["PRIMERO", "RECORDATORIO"];

function esUnicoRepetido(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

export async function enviarCorreoVendedor(i: EntradaEnvio, deps: DepsEnvio = {}): Promise<ResultadoEnvio> {
  // «No contactar» es permanente: a ese contacto no le sale nada, aunque el hilo siga abierto. Se mira
  // el contacto del hilo y también la dirección de destino: otra ficha con el mismo correo en
  // NO_CONTACTAR, o una casilla dada de baja (aunque no sea de ningún contacto). El reenvío a Daniel
  // (REENVIO) va a su casilla, así que no se frena.
  if (PASOS_AL_CONTACTO.includes(i.paso)) {
    if (i.contactoId) {
      const c = await prisma.dnxContacto.findUnique({ where: { id: i.contactoId }, select: { estado: true } });
      if (c?.estado === "NO_CONTACTAR") return { ok: false, motivo: "NO_CONTACTAR", reintentable: false };
    }
    if (await direccionBloqueada(i.para)) return { ok: false, motivo: "NO_CONTACTAR", reintentable: false };
  }

  // Un reintento del primero o del recordatorio que ya quedó guardado no sale de nuevo.
  if (i.hiloId && PASOS_UNICOS.includes(i.paso)) {
    const ya = await prisma.dnxVendedorCorreo.findFirst({
      where: { hiloId: i.hiloId, paso: i.paso, direccion: "SALIDA" },
      select: { id: true },
    });
    if (ya) return { ok: true, correoId: ya.id };
  }

  const headers: Record<string, string> = {};
  // Respuesta automática (RFC 3834): que un autorrespondedor del otro lado no nos conteste y arme un bucle.
  if (i.paso === "RESPUESTA") headers["Auto-Submitted"] = "auto-replied";
  if (i.paso !== "REENVIO") {
    const urlBaja = urlBajaVendedor(i.para);
    if (!urlBaja) {
      return { ok: false, motivo: "Falta la dirección pública de FOTOFFICE o la clave para firmar la baja.", reintentable: false };
    }
    Object.assign(headers, unsubscribeHeaders(urlBaja));
  }
  let asunto = i.asunto;
  if (i.enHilo) {
    const messageId = conAngulos(i.enHilo.messageId);
    headers["In-Reply-To"] = messageId;
    headers.References = [...i.enHilo.referencias.map(conAngulos), messageId].join(" ");
    if (!/^re:/i.test(asunto.trim())) asunto = `Re: ${asunto}`;
  }

  const base = deps.env ?? process.env;
  const env: Env = { ...base, RESEND_API_KEY: claveVendedor(base) ?? undefined, FOTOFFICE_NOTIFICATIONS_FROM: REMITENTE_VENDEDOR };
  const enviar = deps.enviar ?? sendTransactionalEmail;
  const r = await enviar(
    {
      to: i.para,
      subject: asunto,
      text: i.texto,
      html: htmlDeTexto(i.texto),
      replyTo: i.responderA ?? RESPONDER_A,
      headers,
      idempotencyKey: i.claveIdempotencia,
    },
    { env },
  );
  if (r.status !== "SENT") return { ok: false, motivo: r.detail, reintentable: r.status !== "CONFIGURATION_ERROR" };

  let correoId: string;
  try {
    correoId = await prisma.$transaction(async (tx) => {
      const correo = await tx.dnxVendedorCorreo.create({
        data: {
          hiloId: i.hiloId, contactoId: i.contactoId, direccion: "SALIDA", paso: i.paso, resendId: r.providerId,
          de: REMITENTE_VENDEDOR, para: i.para, asunto, texto: i.texto,
        },
        select: { id: true },
      });
      // El reenvío a Daniel no se le escribió al contacto: no va a su ficha como correo enviado.
      if (i.contactoId && i.paso !== "REENVIO") {
        const evento = await tx.dnxContactoEvento.create({
          data: { contactoId: i.contactoId, tipo: "CORREO_ENVIADO", datos: { correoId: correo.id, paso: i.paso, asunto, texto: i.texto }, autor: AUTOR_VENDEDOR },
          select: { id: true },
        });
        await tx.dnxVendedorCorreo.update({ where: { id: correo.id }, data: { eventoId: evento.id } });
      }
      return correo.id;
    });
  } catch (error) {
    // Resend devolvió un envío que ya teníamos (la misma clave de idempotencia): es el mismo correo.
    if (esUnicoRepetido(error) && r.providerId) {
      const ya = await prisma.dnxVendedorCorreo.findUnique({ where: { resendId: r.providerId }, select: { id: true } });
      if (ya) return { ok: true, correoId: ya.id };
    }
    console.error("[agentes][vendedor] el correo salió pero no se pudo guardar", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    // Reintentable: con la misma clave Resend no lo manda de nuevo y devuelve el mismo id.
    return { ok: false, motivo: "El correo salió pero no se pudo guardar.", reintentable: true };
  }

  if (r.providerId) {
    const traer = deps.traerMessageId ?? ((id: string) => traerMessageIdResend(id, { clave: claveVendedor(base) }));
    try {
      const messageId = await traer(r.providerId);
      if (messageId) await prisma.dnxVendedorCorreo.update({ where: { id: correoId }, data: { messageId } });
    } catch {
      // Queda null: `completarMessageIds` lo vuelve a buscar.
    }
  }
  return { ok: true, correoId };
}

/** El `Message-ID` que Resend le puso a un envío (`message_id` de `GET /emails/{id}`), con `<…>`. */
export async function traerMessageIdResend(
  resendId: string,
  deps: { fetch?: typeof fetch; clave?: string | null } = {},
): Promise<string | null> {
  const clave = deps.clave === undefined ? claveVendedor(process.env) : deps.clave;
  if (!clave) return null;
  try {
    const res = await (deps.fetch ?? fetch)(`${RESEND_EMAILS}/${encodeURIComponent(resendId)}`, {
      headers: { Authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(TIEMPO_RESEND_MS),
    });
    if (!res.ok) return null;
    const cuerpo = (await res.json()) as { message_id?: unknown };
    return typeof cuerpo.message_id === "string" && cuerpo.message_id.trim() ? conAngulos(cuerpo.message_id) : null;
  } catch {
    return null;
  }
}

/** Completa el `messageId` de las salidas de las últimas 24 h que todavía no lo tienen. Devuelve cuántas. */
export async function completarMessageIds(
  deps: { ahora?: Date; traerMessageId?: (resendId: string) => Promise<string | null> } = {},
): Promise<number> {
  const ahora = deps.ahora ?? new Date();
  const traer = deps.traerMessageId ?? ((id: string) => traerMessageIdResend(id));
  const pendientes = await prisma.dnxVendedorCorreo.findMany({
    where: { direccion: "SALIDA", messageId: null, resendId: { not: null }, creadoEn: { gte: new Date(ahora.getTime() - 24 * 3_600_000) } },
    select: { id: true, resendId: true },
  });
  let completadas = 0;
  for (const p of pendientes) {
    if (!p.resendId) continue;
    const messageId = await traer(p.resendId).catch(() => null);
    if (!messageId) continue;
    await prisma.dnxVendedorCorreo.update({ where: { id: p.id }, data: { messageId } });
    completadas++;
  }
  return completadas;
}
