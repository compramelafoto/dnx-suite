import "server-only";
import { Prisma, prisma } from "@repo/db";
import type { sendTransactionalEmail } from "@/lib/communications/send-email";
import type { DepsTelegramApi, TecladoTelegram } from "@/lib/telegram/api";
import { cambiarEstado } from "../buscador/contactos";
import { destinoAgentes, mandarMensaje } from "../canal";
import type { DepsClaude } from "../claude";
import { anotarGasto, leerAjustesVendedor, puedeGastar } from "./ajustes";
import { normalizarDireccion, registrarBajaDireccion } from "./bloqueos";
import { tecladoRespuesta } from "./botones";
import { leerConocimiento } from "./clf";
import { armarTexto, claveVendedor, enlaceSeguimiento, enviarCorreoVendedor, urlBajaVendedor, type ResultadoEnvio } from "./correo";
import { mensajeEsperaDaniel, mensajeInteresado, mensajeSinEmparejar } from "./mensajes";
import { datosParaPrompt } from "./prompts";
import { clasificarYResponder } from "./redactor";
import {
  AUTOR_VENDEDOR, CASILLA_DANIEL, CURSO_POR_GRUPO, GRUPOS, GRUPOS_SIEMPRE_A_DANIEL, LANDING_POR_GRUPO, RESPONDER_A, ROTULO_GRUPO,
  type Grupo,
} from "./tipos";

/**
 * Las respuestas que llegan a daniel@compramelafoto.com (Resend Inbound): se leen, se emparejan con
 * su hilo, se guardan una sola vez y después se clasifican con Claude para contestar o pasárselas a
 * Daniel.
 *
 * Reglas que cuidan el bucle de correo y los reintentos:
 * - Una respuesta automática o un rebote se detecta por cabeceras y asunto ANTES de Claude, y nunca
 *   se contesta.
 * - Un correo que viene de la casilla de Daniel o de @compramelafoto.com nunca se reenvía a Gmail
 *   (sólo va el aviso por Telegram), y si viene de @compramelafoto.com tampoco se contesta.
 * - A Gmail sólo se reenvía lo que llegó a daniel@compramelafoto.com, sin marca de correo no deseado
 *   y a lo sumo `MAX_REENVIOS_POR_HORA` por hora: lo demás queda en el aviso por Telegram. Así una
 *   tanda de spam a otras casillas del dominio no sale reenviada desde nuestra dirección.
 * - Si escribe una dirección que no es la del contacto del hilo, no se contesta solo: pasa a Daniel.
 * - El mismo `email_id` de Resend se guarda una sola vez (`resendId` único) y cada entrante lo toma
 *   un solo procesador (`tomadoEn` con `updateMany` condicional).
 * - Claude sólo ve lo nuevo de la respuesta (`textoNuevo`), nunca la cita de nuestro correo.
 */

// --- Lectura del aviso y del correo -----------------------------------------------------------

export type CorreoRecibido = {
  id: string;
  /** En minúsculas y sin el nombre. */
  de: string;
  deNombre: string | null;
  para: string[];
  asunto: string;
  texto: string;
  messageId: string | null;
  inReplyTo: string | null;
  referencias: string[];
  /** Con las claves en minúsculas. */
  cabeceras: Record<string, string>;
};

const URL_RECIBIDOS = "https://api.resend.com/emails/receiving";
const TIEMPO_RESEND_MS = 10_000;

export function leerAvisoEntrante(payload: unknown): { emailId: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { type?: unknown; data?: { email_id?: unknown } | null };
  if (p.type !== "email.received") return null;
  const id = p.data?.email_id;
  return typeof id === "string" && id.trim() !== "" ? { emailId: id.trim() } : null;
}

/** `<id>`, una sola vez. */
function conAngulos(id: string): string {
  return `<${id.trim().replace(/^<+/, "").replace(/>+$/, "")}>`;
}

/** Los Message-ID de una cabecera (`In-Reply-To`, `References`), cada uno con `<…>`. */
function idsDeCabecera(valor: string | undefined | null): string[] {
  if (!valor?.trim()) return [];
  const conMarcas = valor.match(/<[^<>\s]+>/g);
  return conMarcas ?? valor.split(/\s+/).filter(Boolean).map(conAngulos);
}

function partirRemitente(from: string): { de: string; deNombre: string | null } {
  const m = /^(.*)<([^<>]+)>\s*$/.exec(from.trim());
  if (!m) return { de: from.trim().toLowerCase(), deNombre: null };
  const nombre = m[1]!.trim().replace(/^"(.*)"$/, "$1").trim();
  return { de: m[2]!.trim().toLowerCase(), deNombre: nombre || null };
}

const ENTIDADES: Record<string, string> = { nbsp: " ", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

/** El texto visible de un HTML: sin estilos ni etiquetas, con saltos donde había bloques. */
function htmlATexto(html: string): string {
  return html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|lt|gt|quot|#39|apos);/g, (_, e: string) => ENTIDADES[e] ?? "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const texto = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** La respuesta de `GET /emails/receiving/{id}` como `CorreoRecibido`. */
function leerCorreoRecibido(cuerpo: unknown): CorreoRecibido | { error: string } {
  if (!cuerpo || typeof cuerpo !== "object") return { error: "Resend devolvió un cuerpo vacío." };
  const r = cuerpo as Record<string, unknown>;
  const id = texto(r.id);
  const from = texto(r.from);
  if (!id || !from) return { error: "Resend devolvió un correo sin id o sin remitente." };
  const cabeceras: Record<string, string> = {};
  if (r.headers && typeof r.headers === "object") {
    for (const [k, v] of Object.entries(r.headers as Record<string, unknown>)) {
      if (typeof v === "string") cabeceras[k.toLowerCase()] = v;
    }
  }
  const messageId = texto(r.message_id)?.trim() || cabeceras["message-id"]?.trim() || null;
  const html = texto(r.html);
  return {
    id,
    ...partirRemitente(from),
    para: Array.isArray(r.to) ? r.to.filter((x): x is string => typeof x === "string") : [],
    asunto: texto(r.subject) ?? "",
    texto: texto(r.text) ?? (html ? htmlATexto(html) : ""),
    messageId: messageId ? conAngulos(messageId) : null,
    inReplyTo: idsDeCabecera(cabeceras["in-reply-to"])[0] ?? null,
    referencias: idsDeCabecera(cabeceras.references),
    cabeceras,
  };
}

/** El correo entero (el aviso de Resend no trae cuerpo ni cabeceras). Nunca lanza. */
export async function traerCorreoRecibido(
  emailId: string,
  deps: { fetch?: typeof fetch; clave?: string | null } = {},
): Promise<CorreoRecibido | { error: string }> {
  const clave = deps.clave === undefined ? claveVendedor(process.env) : deps.clave;
  if (!clave) return { error: "Falta la clave de Resend." };
  try {
    const res = await (deps.fetch ?? fetch)(`${URL_RECIBIDOS}/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(TIEMPO_RESEND_MS),
    });
    if (!res.ok) return { error: `Resend respondió ${res.status}.` };
    return leerCorreoRecibido(await res.json());
  } catch (e) {
    return { error: e instanceof Error ? `No se pudo leer el correo de Resend (${e.name}).` : "No se pudo leer el correo de Resend." };
  }
}

// --- Detección ----------------------------------------------------------------------------------

const ASUNTO_AUTOMATICO = /fuera de (la )?oficina|respuesta autom[aá]tica|out of office|automatic reply|autoreply/i;

export function esAutomatica(c: CorreoRecibido): boolean {
  const h = c.cabeceras;
  const auto = h["auto-submitted"]?.trim().toLowerCase();
  if (auto !== undefined && auto !== "no") return true;
  if ("x-autoreply" in h || "x-autorespond" in h) return true;
  if (/^(auto_reply|bulk|junk|list)$/i.test(h.precedence?.trim() ?? "")) return true;
  return ASUNTO_AUTOMATICO.test(c.asunto);
}

export function esRebote(c: CorreoRecibido): boolean {
  if (c.de.startsWith("mailer-daemon@") || c.de.startsWith("postmaster@")) return true;
  return /^multipart\/report\b/i.test(c.cabeceras["content-type"]?.trim() ?? "");
}

/** La casilla de Daniel o una del propio dominio: nunca se le reenvía a Gmail. */
function esCasillaPropia(de: string): boolean {
  return de === CASILLA_DANIEL || de.endsWith("@compramelafoto.com");
}

/** true si alguna de las direcciones de `para` es la casilla de Daniel del dominio. */
export function llegoADaniel(para: string | string[]): boolean {
  const todas = (Array.isArray(para) ? para.join(",") : para).toLowerCase();
  return todas.includes(RESPONDER_A);
}

/** Las cabeceras del correo recibido lo marcan como correo no deseado (o con virus). */
export function marcadoComoSpam(cabeceras: Record<string, string>): boolean {
  const flag = cabeceras["x-spam-flag"]?.trim().toLowerCase();
  if (flag === "yes" || flag === "true") return true;
  if (/^\s*yes\b/i.test(cabeceras["x-spam-status"] ?? "")) return true;
  // Resend recibe por Amazon SES, que deja su veredicto en estas cabeceras.
  for (const k of ["x-ses-spam-verdict", "x-ses-virus-verdict"]) {
    if (cabeceras[k]?.trim().toUpperCase() === "FAIL") return true;
  }
  return false;
}

const CITA = /^(El .+ escribió:|On .+ wrote:|-----Original Message-----|De: .+)$/m;
/** Gmail parte en dos la línea de la cita cuando es larga («… (<daniel@…>)» / «escribió:»). */
const CITA_PARTIDA = /^(El|On) .+\n[^\n]{0,80}(escribió|wrote):$/m;
export const MAX_TEXTO_NUEVO = 4000;

/** Sólo lo que escribió la persona: sin la cita de nuestro correo ni las líneas `>`. */
export function textoNuevo(texto: string): string {
  let t = texto.replace(/\r\n?/g, "\n");
  const cortes = [CITA.exec(t)?.index, CITA_PARTIDA.exec(t)?.index].filter((i): i is number => i !== undefined);
  if (cortes.length > 0) t = t.slice(0, Math.min(...cortes));
  t = t
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    .join("\n")
    .trim();
  return t.slice(0, MAX_TEXTO_NUEVO);
}

// --- Emparejamiento y registro ------------------------------------------------------------------

/** Los envíos que forman parte de la conversación (un reenvío a Daniel no es del contacto). */
const PASOS_CONVERSACION = ["PRIMERO", "RECORDATORIO", "RESPUESTA"];

export async function emparejarHilo(c: CorreoRecibido): Promise<{ hiloId: string; por: "CABECERAS" | "REMITENTE" } | null> {
  const ids = [...new Set([c.inReplyTo, ...c.referencias].filter((x): x is string => Boolean(x?.trim())).flatMap((x) => {
    const a = conAngulos(x);
    return [a, a.slice(1, -1)];
  }))];
  if (ids.length > 0) {
    const salida = await prisma.dnxVendedorCorreo.findFirst({
      where: { direccion: "SALIDA", paso: { in: PASOS_CONVERSACION }, hiloId: { not: null }, messageId: { in: ids } },
      orderBy: { creadoEn: "desc" },
      select: { hiloId: true },
    });
    if (salida?.hiloId) return { hiloId: salida.hiloId, por: "CABECERAS" };
  }
  // Por remitente, sólo si escribió a daniel@: un prospecto que escribe a otra casilla del dominio (por
  // una compra, por ejemplo) no es una respuesta comercial.
  if (!llegoADaniel(c.para)) return null;
  const contactos = await prisma.dnxContacto.findMany({ where: { claveEmail: c.de }, select: { id: true } });
  if (contactos.length === 0) return null;
  const hilo = await prisma.dnxVendedorHilo.findFirst({
    where: { contactoId: { in: contactos.map((x) => x.id) }, estado: { not: "PENDIENTE_ENVIO" } },
    orderBy: { creadoEn: "desc" },
    select: { id: true },
  });
  return hilo ? { hiloId: hilo.id, por: "REMITENTE" } : null;
}

function esUnicoRepetido(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/**
 * Guarda el correo una sola vez (un `resendId` repetido no escribe nada) y marca la respuesta en el
 * hilo y el contacto. Los rebotes y las respuestas automáticas quedan procesados acá: nunca llegan a
 * Claude ni se contestan.
 */
export async function registrarEntrante(c: CorreoRecibido, ahora: Date): Promise<{ correoId: string; hiloId: string | null; nuevo: boolean }> {
  const ya = await prisma.dnxVendedorCorreo.findUnique({ where: { resendId: c.id }, select: { id: true, hiloId: true } });
  if (ya) return { correoId: ya.id, hiloId: ya.hiloId, nuevo: false };

  const par = await emparejarHilo(c);
  const hilo = par ? await prisma.dnxVendedorHilo.findUnique({ where: { id: par.hiloId }, select: { id: true, contactoId: true } }) : null;
  const rebote = esRebote(c);
  const automatica = !rebote && esAutomatica(c);
  const nuevoTexto = textoNuevo(c.texto);

  let correoId: string;
  try {
    correoId = await prisma.$transaction(async (tx) => {
      const correo = await tx.dnxVendedorCorreo.create({
        data: {
          hiloId: hilo?.id ?? null, contactoId: hilo?.contactoId ?? null, direccion: "ENTRADA", resendId: c.id,
          messageId: c.messageId, de: c.de, para: c.para.join(", "), asunto: c.asunto, texto: nuevoTexto,
          clase: rebote ? "REBOTE" : automatica ? "AUTOMATICA" : null,
          // Sin hilo quedan para `procesarEntrantes`, que sólo avisa por Telegram (nunca los reenvía).
          procesadoEn: hilo && (rebote || automatica) ? ahora : null,
        },
        select: { id: true },
      });
      if (!hilo) return correo.id;
      const evento = await tx.dnxContactoEvento.create({
        data: {
          contactoId: hilo.contactoId, tipo: "CORREO_RECIBIDO",
          datos: { correoId: correo.id, asunto: c.asunto, texto: nuevoTexto, messageId: c.messageId }, autor: AUTOR_VENDEDOR,
        },
        select: { id: true },
      });
      await tx.dnxVendedorCorreo.update({ where: { id: correo.id }, data: { eventoId: evento.id } });
      if (automatica) {
        // No cierra ni cuenta como respuesta: sólo evita el recordatorio.
        await tx.dnxVendedorHilo.update({ where: { id: hilo.id }, data: { recordatorioCancelado: true } });
      } else if (!rebote) {
        await tx.dnxVendedorHilo.update({ where: { id: hilo.id }, data: { ultimaRespuestaEn: ahora } });
        await tx.dnxVendedorHilo.updateMany({ where: { id: hilo.id, estado: { notIn: ["BAJA", "CERRADO", "ESPERA_DANIEL"] } }, data: { estado: "RESPONDIO" } });
      }
      return correo.id;
    });
  } catch (error) {
    // Otro aviso del mismo correo lo guardó mientras tanto: es el mismo.
    if (esUnicoRepetido(error)) {
      const otro = await prisma.dnxVendedorCorreo.findUnique({ where: { resendId: c.id }, select: { id: true, hiloId: true } });
      if (otro) return { correoId: otro.id, hiloId: otro.hiloId, nuevo: false };
    }
    throw error;
  }

  if (hilo && !rebote && !automatica) {
    const contacto = await prisma.dnxContacto.findUnique({ where: { id: hilo.contactoId }, select: { estado: true } });
    if (contacto?.estado === "CONTACTADO") await cambiarEstado(hilo.contactoId, "RESPONDIO", AUTOR_VENDEDOR);
  }
  return { correoId, hiloId: hilo?.id ?? null, nuevo: true };
}

// --- Procesamiento ------------------------------------------------------------------------------

export type DepsEntrante = {
  ahora?: () => Date;
  claude?: DepsClaude;
  enviar?: typeof sendTransactionalEmail;
  telegram?: DepsTelegramApi;
  /** Para mirar las cabeceras del original antes de reenviarlo (por omisión, `traerCorreoRecibido`). */
  traerCorreo?: (resendId: string) => Promise<CorreoRecibido | { error: string }>;
};

/** Una toma más vieja que esto es de un procesador que se cortó: se puede volver a tomar. */
const TOMA_VENCE_MS = 10 * 60_000;
/** Tiempo que se deja libre antes de `hasta` para no empezar un correo que no llega a terminar. */
const MARGEN_MS = 30_000;
const POR_CORRIDA = 50;
export const MAX_RESPUESTAS_AUTOMATICAS = 3;
/** Tope de reenvíos automáticos a Gmail por hora: pasado esto, sólo el aviso por Telegram. */
export const MAX_REENVIOS_POR_HORA = 20;

export async function procesarEntrantes(o: { hasta: number }, deps: DepsEntrante = {}): Promise<{ procesados: number }> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const libre = {
    procesadoEn: null,
    OR: [{ tomadoEn: null }, { tomadoEn: { lt: new Date(ahora.getTime() - TOMA_VENCE_MS) } }],
  };
  const pendientes = await prisma.dnxVendedorCorreo.findMany({
    where: { direccion: "ENTRADA", ...libre },
    orderBy: { creadoEn: "asc" },
    take: POR_CORRIDA,
    select: { id: true },
  });
  let procesados = 0;
  for (const p of pendientes) {
    if (Date.now() > o.hasta - MARGEN_MS) break;
    // Toma condicional: si otro procesador (el webhook o el cron) ya lo tomó, éste lo saltea.
    const toma = await prisma.dnxVendedorCorreo.updateMany({ where: { id: p.id, ...libre }, data: { tomadoEn: ahora } });
    if (toma.count !== 1) continue;
    try {
      await procesarUno(p.id, ahora, o.hasta, deps);
      procesados++;
    } catch (error) {
      console.error("[agentes][vendedor] no se pudo procesar un correo entrante", {
        correoId: p.id,
        detalle: error instanceof Error ? error.message : "error desconocido",
      });
      // Queda para la próxima corrida.
      await prisma.dnxVendedorCorreo
        .updateMany({ where: { id: p.id, procesadoEn: null }, data: { tomadoEn: null } })
        .catch(() => undefined);
    }
  }
  return { procesados };
}

async function avisar(html: string, teclado: TecladoTelegram | null, deps: DepsEntrante): Promise<string | null> {
  try {
    const destino = await destinoAgentes();
    if (!destino) {
      console.error("[agentes][vendedor] no hay chat de Telegram vinculado para avisar de un correo entrante");
      return null;
    }
    const m = await mandarMensaje(destino.token, destino.chatId, html, teclado, deps.telegram ?? {});
    return m.ok ? m.resultado.messageId : null;
  } catch {
    console.error("[agentes][vendedor] no se pudo avisar por Telegram de un correo entrante");
    return null;
  }
}

/** Reenvía un entrante a la casilla de Daniel, con el contacto como responder-a. Lanza si no sale. */
export async function reenviarADaniel(correoId: string, deps: DepsEntrante = {}): Promise<void> {
  const c = await prisma.dnxVendedorCorreo.findUnique({
    where: { id: correoId },
    select: { id: true, hiloId: true, contactoId: true, de: true, para: true, asunto: true, texto: true },
  });
  if (!c) throw new Error("Vendedor: el correo a reenviar no existe");
  const r = await enviarCorreoVendedor(
    {
      hiloId: c.hiloId,
      contactoId: c.contactoId,
      para: CASILLA_DANIEL,
      asunto: `Reenviado: ${c.asunto}`,
      texto: `De: ${c.de}\nPara: ${c.para}\nAsunto: ${c.asunto}\n\n${c.texto}`,
      paso: "REENVIO",
      claveIdempotencia: `dnx-vendedor:${c.hiloId ?? "sin-hilo"}:REENVIO:${c.id}`,
      responderA: c.de,
    },
    { enviar: deps.enviar },
  );
  if (!r.ok) throw new Error(`Vendedor: no se pudo reenviar a Daniel (${r.motivo})`);
}

/**
 * Por qué un entrante NO se reenvía solo a Gmail, o null si se puede reenviar. Sólo lo que llegó a
 * daniel@, dentro del tope por hora y sin marca de correo no deseado en las cabeceras del original
 * (que se vuelven a pedir a Resend: si no se pueden leer, no se reenvía).
 */
async function motivoParaNoReenviar(correo: { resendId: string | null; para: string }, ahora: Date, deps: DepsEntrante): Promise<string | null> {
  if (!llegoADaniel(correo.para)) return `llegó a ${correo.para || "otra casilla"}, no a ${RESPONDER_A}`;
  const ultimaHora = await prisma.dnxVendedorCorreo.count({
    where: { direccion: "SALIDA", paso: "REENVIO", creadoEn: { gte: new Date(ahora.getTime() - 3_600_000) } },
  });
  if (ultimaHora >= MAX_REENVIOS_POR_HORA) return `ya reenvié ${MAX_REENVIOS_POR_HORA} correos en la última hora`;
  if (!correo.resendId) return "no pude revisar si era correo no deseado";
  const original = await (deps.traerCorreo ?? ((id: string) => traerCorreoRecibido(id)))(correo.resendId);
  if ("error" in original) return "no pude revisar si era correo no deseado";
  if (marcadoComoSpam(original.cabeceras)) return "está marcado como correo no deseado";
  return null;
}

const esGrupo = (g: string): g is Grupo => (GRUPOS as readonly string[]).includes(g);

type Entrante = {
  id: string; hiloId: string | null; resendId: string | null; de: string; para: string; asunto: string; texto: string;
  messageId: string | null; clase: string | null;
};
type Hilo = {
  id: string; contactoId: string; grupo: string; modeloId: string | null; token: string; estado: string;
  respuestasAutomaticas: number; modoManual: boolean; avisoInteresadoEn: Date | null; recordadoEn: Date | null; registradoEn: Date | null;
};

async function procesarUno(correoId: string, ahora: Date, hasta: number, deps: DepsEntrante): Promise<void> {
  const correo: Entrante | null = await prisma.dnxVendedorCorreo.findUnique({
    where: { id: correoId },
    select: { id: true, hiloId: true, resendId: true, de: true, para: true, asunto: true, texto: true, messageId: true, clase: true },
  });
  if (!correo) return;
  const marcar = (clase?: string) =>
    prisma.dnxVendedorCorreo.update({ where: { id: correo.id }, data: { procesadoEn: ahora, ...(clase ? { clase } : {}) } });
  const propia = esCasillaPropia(correo.de);

  const hilo: Hilo | null = correo.hiloId
    ? await prisma.dnxVendedorHilo.findUnique({
        where: { id: correo.hiloId },
        select: {
          id: true, contactoId: true, grupo: true, modeloId: true, token: true, estado: true, respuestasAutomaticas: true,
          modoManual: true, avisoInteresadoEn: true, recordadoEn: true, registradoEn: true,
        },
      })
    : null;
  const contacto = hilo
    ? await prisma.dnxContacto.findUnique({
        where: { id: hilo.contactoId },
        select: { id: true, nombre: true, ciudad: true, provincia: true, tipo: true, nichos: true, web: true, estado: true, email: true, claveEmail: true },
      })
    : null;

  // Sin hilo: a Gmail (salvo que venga de Daniel o del propio dominio, sea automático, no haya
  // llegado a daniel@, pase el tope por hora o sea correo no deseado) y aviso.
  if (!hilo || !contacto) {
    const motivo =
      correo.clase === "AUTOMATICA"
        ? "es una respuesta automática"
        : correo.clase === "REBOTE"
          ? "es un rebote"
          : propia
            ? "viene de tu propia casilla o de @compramelafoto.com"
            : await motivoParaNoReenviar(correo, ahora, deps);
    if (!motivo) await reenviarADaniel(correo.id, deps);
    await avisar(mensajeSinEmparejar({ de: correo.de, asunto: correo.asunto, reenviado: !motivo, motivo: motivo ?? undefined }), null, deps);
    await marcar();
    return;
  }

  const rotulo = esGrupo(hilo.grupo) ? ROTULO_GRUPO[hilo.grupo] : hilo.grupo;
  const aDaniel = async (propuesta: string | null, motivo: string) => {
    await prisma.dnxVendedorHilo.updateMany({
      where: { id: hilo.id, estado: { notIn: ["BAJA", "CERRADO"] } },
      data: { estado: "ESPERA_DANIEL", propuesta: propuesta === null ? Prisma.DbNull : { texto: propuesta, entranteId: correo.id } },
    });
    const messageId = await avisar(
      mensajeEsperaDaniel({ nombre: contacto.nombre, de: correo.de, grupo: rotulo, entrante: correo.texto, propuesta, motivo }),
      tecladoRespuesta(hilo.id, { conPropuesta: propuesta !== null }),
      deps,
    );
    // Sin el aviso nadie se entera: el correo no se marca procesado y se reintenta en la próxima corrida.
    if (!messageId) throw new Error("Vendedor: no se pudo avisar a Daniel por Telegram de una respuesta que lo espera");
    await prisma.dnxVendedorHilo.update({ where: { id: hilo.id }, data: { telegramMessageId: messageId } });
  };

  // Del propio dominio: nunca se contesta solo ni se reenvía (evita el bucle con nuestros correos).
  if (correo.de.endsWith("@compramelafoto.com")) {
    await avisar(
      mensajeEsperaDaniel({ nombre: contacto.nombre, de: correo.de, grupo: rotulo, entrante: correo.texto, propuesta: null, motivo: `Vino de ${correo.de}: no lo contesto ni lo reenvío.` }),
      null,
      deps,
    );
    await marcar();
    return;
  }

  // Hilo en manos de Daniel, cerrado o de alguien que no quiere más correos: a Gmail, sin Claude.
  if (hilo.modoManual || hilo.estado === "BAJA" || hilo.estado === "CERRADO" || contacto.estado === "NO_CONTACTAR") {
    const sinReenvio = propia ? "" : await motivoParaNoReenviar(correo, ahora, deps);
    if (sinReenvio === null) await reenviarADaniel(correo.id, deps);
    const por = hilo.modoManual ? "El hilo está en modo manual." : hilo.estado === "CERRADO" ? "El hilo estaba cerrado." : "Pidió no recibir más correos.";
    await avisar(
      mensajeEsperaDaniel({
        nombre: contacto.nombre, de: correo.de, grupo: rotulo, entrante: correo.texto, propuesta: null,
        motivo: propia ? por : sinReenvio === null ? `${por} Te lo reenvié a Gmail.` : `${por} No te lo reenvié a Gmail: ${sinReenvio}.`,
      }),
      null,
      deps,
    );
    await marcar();
    return;
  }

  if (!esGrupo(hilo.grupo)) {
    await aDaniel(null, `El hilo tiene un grupo que no conozco (${hilo.grupo}).`);
    await marcar();
    return;
  }
  const grupo = hilo.grupo;

  const [ajustes, gasto, conocimiento] = await Promise.all([leerAjustesVendedor(), puedeGastar(ahora), leerConocimiento()]);
  if (!gasto.ok || !conocimiento) {
    await aDaniel(null, !gasto.ok ? "Llegué al tope de gasto de Claude del mes." : "Todavía no tengo cargado lo que sé de CompraMeLaFoto.");
    await marcar();
    return;
  }

  const delHilo = await prisma.dnxVendedorCorreo.findMany({
    where: { hiloId: hilo.id },
    orderBy: { creadoEn: "asc" },
    select: { id: true, direccion: true, paso: true, clase: true, texto: true, messageId: true, creadoEn: true },
  });
  const conversacion = delHilo.filter(
    (x) =>
      x.id !== correo.id &&
      ((x.direccion === "SALIDA" && PASOS_CONVERSACION.includes(x.paso ?? "")) ||
        (x.direccion === "ENTRADA" && x.clase !== "AUTOMATICA" && x.clase !== "REBOTE")),
  );
  const historial = conversacion.map((x) => ({ direccion: x.direccion === "SALIDA" ? ("SALIDA" as const) : ("ENTRADA" as const), texto: x.texto }));

  // Sin chat de Telegram no hay cómo pasarle nada a Daniel: no se gasta Claude y queda para después.
  if (!(await destinoAgentes())) throw new Error("Vendedor: no hay chat de Telegram vinculado; la respuesta queda para la próxima corrida");

  const r = await clasificarYResponder(
    { contacto: datosParaPrompt(contacto), grupo, conocimiento: conocimiento.texto, historial, entrante: correo.texto },
    { ...deps.claude, hasta },
  );
  await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "CLASIFICACION", hiloId: hilo.id });
  if (!r.ok) {
    // Si falló este pedido, que lo vea Daniel; si falló el servicio o el tiempo, se reintenta después.
    if (r.falla !== "TAREA") throw new Error(`Vendedor: Claude no pudo clasificar (${r.motivo})`);
    await aDaniel(null, `No pude clasificarla: ${r.motivo}`);
    await marcar();
    return;
  }
  const v = r.valor;

  // El primer «interesado» o «capacitación» del hilo se le avisa a Daniel una sola vez.
  const interesa = v.clase === "INTERESADO" || v.clase === "CAPACITACION";
  if (interesa && hilo.avisoInteresadoEn === null) {
    const t = await prisma.dnxVendedorHilo.updateMany({ where: { id: hilo.id, avisoInteresadoEn: null }, data: { avisoInteresadoEn: ahora } });
    if (t.count === 1) {
      await avisar(
        mensajeInteresado({
          nombre: contacto.nombre, grupo: rotulo, ciudad: contacto.ciudad, resumen: v.resumen,
          registrado: hilo.registradoEn !== null, capacitacion: v.clase === "CAPACITACION" || v.quiereCapacitarse,
        }),
        null,
        deps,
      );
    }
  }

  if (v.clase === "AUTOMATICA") {
    await comoAutomatica(hilo, contacto, correo.id);
    await marcar("AUTOMATICA");
    return;
  }
  if (v.clase === "BAJA") {
    // Quien escribió no quiere más correos: su casilla queda bloqueada aunque no sea la del contacto.
    await registrarBajaDireccion(correo.de);
    const b = await cambiarEstado(contacto.id, "NO_CONTACTAR", AUTOR_VENDEDOR);
    if (!b.ok) throw new Error(`Vendedor: no se pudo pasar a NO_CONTACTAR (${b.motivo ?? "sin motivo"})`);
    await prisma.dnxVendedorHilo.updateMany({ where: { id: hilo.id, estado: { not: "BAJA" } }, data: { estado: "BAJA", cierre: "BAJA" } });
    await marcar("BAJA");
    return;
  }
  // En DELICADA, en las demás `respuesta` es obligatoria (lo valida el parser de `clasificarYResponder`).
  const propuesta = v.respuesta ?? "";
  if (v.clase === "DELICADA") {
    await aDaniel(propuesta, `Es delicada o no sé la respuesta. ${v.resumen}`);
    await marcar("DELICADA");
    return;
  }

  // INTERESADO, CAPACITACION y NO_INTERESA contestan solas, salvo que algo lo impida.
  const delContacto = [contacto.claveEmail, contacto.email].some((x) => x && normalizarDireccion(x) === normalizarDireccion(correo.de));
  const motivo =
    !delContacto
      ? `Escribió otra dirección (${correo.de}), no la del contacto: no le contesto solo.`
      : hilo.estado === "ESPERA_DANIEL"
      ? "Ya esperaba tu respuesta y te volvió a escribir."
      : interesa && GRUPOS_SIEMPRE_A_DANIEL.includes(grupo)
        ? "Las escuelas de fotografía interesadas las contestás vos: la alianza la decidís vos."
        : ajustes.pausado
          ? "El Vendedor está en pausa: no contesto nada solo."
          : null;
  if (motivo) {
    await aDaniel(propuesta, motivo);
    await marcar(v.clase);
    return;
  }

  // Reserva atómica del lugar en el tope: dos procesadores del mismo hilo no pasan los dos de 3.
  // También exige que el hilo no haya pasado a esperar a Daniel mientras tanto.
  const lugar = await prisma.dnxVendedorHilo.updateMany({
    where: { id: hilo.id, estado: { notIn: ["ESPERA_DANIEL", "BAJA", "CERRADO"] }, respuestasAutomaticas: { lt: MAX_RESPUESTAS_AUTOMATICAS } },
    data: { respuestasAutomaticas: { increment: 1 } },
  });
  if (lugar.count !== 1) {
    await aDaniel(propuesta, `Ya contesté ${MAX_RESPUESTAS_AUTOMATICAS} veces solo en este hilo, o el hilo te estaba esperando.`);
    await marcar(v.clase);
    return;
  }
  const devolverLugar = () =>
    prisma.dnxVendedorHilo.update({ where: { id: hilo.id }, data: { respuestasAutomaticas: { decrement: 1 } } });

  let envio: ResultadoEnvio;
  try {
    envio = await responder(hilo, grupo, correo, delHilo, propuesta, deps);
  } catch (error) {
    await devolverLugar();
    throw error;
  }
  if (!envio.ok) {
    await devolverLugar();
    if (envio.reintentable) throw new Error(`Vendedor: no salió la respuesta (${envio.motivo})`);
    await aDaniel(propuesta, `No pude mandar la respuesta: ${envio.motivo}`);
    await marcar(v.clase);
    return;
  }
  if (v.clase === "NO_INTERESA") {
    // Si ya era NO_CONTACTAR, `cambiarEstado` no lo toca: está bien.
    await cambiarEstado(contacto.id, "NO_INTERESA", AUTOR_VENDEDOR);
    await prisma.dnxVendedorHilo.updateMany({
      where: { id: hilo.id, estado: { notIn: ["BAJA", "CERRADO"] } },
      data: { estado: "CERRADO", cierre: "NO_INTERESA" },
    });
  }
  await marcar(v.clase);
}

/**
 * Contesta en el mismo hilo, a quien escribió, con los enlaces de seguimiento del hilo. También lo usa
 * «Enviar» desde Telegram (`modelos.ts`) para mandar la propuesta que aprobó Daniel.
 */
export async function responder(
  hilo: Pick<Hilo, "id" | "contactoId" | "modeloId" | "token">,
  grupo: Grupo,
  correo: Pick<Entrante, "id" | "de" | "asunto" | "messageId">,
  delHilo: Array<{ id: string; messageId: string | null; direccion: string; paso: string | null }>,
  respuesta: string,
  deps: DepsEntrante,
): Promise<ResultadoEnvio> {
  const urlBaja = urlBajaVendedor(correo.de);
  if (!urlBaja) return { ok: false, motivo: "Falta la dirección pública de FOTOFFICE o la clave para firmar la baja.", reintentable: false };
  const modelo = hilo.modeloId
    ? await prisma.dnxVendedorModelo.findUnique({ where: { id: hilo.modeloId }, select: { landing: true } })
    : null;
  const texto = armarTexto(
    respuesta,
    {
      ENLACE: enlaceSeguimiento(modelo?.landing ?? LANDING_POR_GRUPO[grupo], hilo.token),
      CURSO: enlaceSeguimiento(CURSO_POR_GRUPO[grupo], hilo.token),
    },
    urlBaja,
  );
  const anteriores = delHilo
    .filter((x) => x.id !== correo.id && x.messageId && !(x.direccion === "SALIDA" && x.paso === "REENVIO"))
    .map((x) => x.messageId!);
  const enHilo = correo.messageId
    ? { messageId: correo.messageId, referencias: anteriores }
    : anteriores.length > 0
      ? { messageId: anteriores[anteriores.length - 1]!, referencias: anteriores.slice(0, -1) }
      : undefined;
  const base = correo.asunto.trim() || "Tu consulta";
  return enviarCorreoVendedor(
    {
      hiloId: hilo.id,
      contactoId: hilo.contactoId,
      para: correo.de,
      asunto: enHilo || /^re:/i.test(base) ? base : `Re: ${base}`,
      texto,
      paso: "RESPUESTA",
      claveIdempotencia: `dnx-vendedor:${hilo.id}:RESPUESTA:${correo.id}`,
      enHilo,
    },
    { enviar: deps.enviar },
  );
}

/**
 * Claude dijo AUTOMATICA: se deja todo como si no hubiera respondido (igual que la detección por
 * cabeceras), con el recordatorio cancelado.
 */
async function comoAutomatica(hilo: Hilo, contacto: { id: string; estado: string }, correoId: string): Promise<void> {
  const previa = await prisma.dnxVendedorCorreo.findFirst({
    where: { hiloId: hilo.id, direccion: "ENTRADA", id: { not: correoId }, clase: { in: ["INTERESADO", "CAPACITACION", "NO_INTERESA", "BAJA", "DELICADA"] } },
    orderBy: { creadoEn: "desc" },
    select: { creadoEn: true },
  });
  await prisma.dnxVendedorHilo.update({ where: { id: hilo.id }, data: { recordatorioCancelado: true, ultimaRespuestaEn: previa?.creadoEn ?? null } });
  if (previa) return;
  await prisma.dnxVendedorHilo.updateMany({
    where: { id: hilo.id, estado: "RESPONDIO" },
    data: { estado: hilo.recordadoEn ? "RECORDADO" : "ENVIADO" },
  });
  if (contacto.estado === "RESPONDIO") await cambiarEstado(contacto.id, "CONTACTADO", AUTOR_VENDEDOR);
}
