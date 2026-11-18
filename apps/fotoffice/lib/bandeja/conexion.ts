import "server-only";
import { prisma } from "@repo/db";
import { MODOS_CONEXION, PAUSA_BOT_HORAS_POR_DEFECTO, type ModoConexion } from "./constantes";
import { truncarSeguro } from "./vista-previa";
import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { guardarTokenWhatsapp, hayTokenWhatsapp, leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { borrarTokenInstagram, guardarTokenInstagram, hayTokenInstagram } from "@/lib/integrations/instagram/credentials";

/**
 * Conexión de WhatsApp de una institución (§2 y §7 del diseño): modo (simulado o real), número de
 * teléfono de Meta y horas de pausa del bot. El token NO está acá: vive cifrado en el baúl de
 * integraciones (`guardarTokenWhatsapp`). Sin fila, la conexión es SIMULADA.
 */

export type Conexion = {
  workspaceId: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhone: string | null;
  modo: ModoConexion;
  pausaBotHoras: number;
  /** Instagram (mensajes directos): cuenta profesional, página de Facebook vinculada (para enviar), @usuario y si está encendido. */
  igAccountId: string | null;
  igPageId: string | null;
  igUsuario: string | null;
  igActivo: boolean;
};

export const PAUSA_MINIMA_HORAS = 1;
export const PAUSA_MAXIMA_HORAS = 72;

export const MENSAJES_CONEXION = {
  sinPermiso: "Sólo un administrador puede configurar WhatsApp.",
  datosInvalidos: "Los datos no son válidos.",
  phoneNumberId: "El identificador del número de teléfono de Meta tiene que tener sólo dígitos.",
  wabaId: "El identificador de la cuenta de WhatsApp Business tiene que tener sólo dígitos.",
  pausa: `La pausa del bot tiene que ser de ${PAUSA_MINIMA_HORAS} a ${PAUSA_MAXIMA_HORAS} horas.`,
  modo: "El modo tiene que ser simulado o real.",
  realSinDatos: "Para pasar a real hace falta el identificador del número y el token.",
  numeroEnUso: "Ese número de teléfono ya está conectado a otra institución.",
  noVerificado: "No pudimos verificar ese número con Meta: revisá el Phone number ID y el token.",
  sinSuscripcion: "Meta no aceptó mandar los mensajes de esa cuenta a FOTOFFICE: revisá el WhatsApp Business Account ID y que el token tenga permiso sobre esa cuenta.",
  sinClave: "No se pudo guardar el token: falta configurar la clave de cifrado del servidor.",
  fallo: "No se pudo guardar la configuración.",
  igSinPermiso: "Sólo un administrador puede conectar Instagram.",
  igSinToken: "Pegá el token del usuario del sistema de Meta.",
  igTokenRechazado: "Meta no aceptó ese token: revisá que sea el del usuario del sistema y que tenga acceso a la página.",
  igSinPagina: "Ese token no ve ninguna página con Instagram vinculado: dale al usuario del sistema acceso a la página de Facebook y a la cuenta de Instagram.",
  igSinSuscripcion: "Meta no aceptó mandar los mensajes de Instagram de esa página a FOTOFFICE: revisá que el token tenga permiso para administrar los mensajes de la página.",
  igEnUso: "Esa cuenta de Instagram ya está conectada a otra institución.",
} as const;

export function conexionPorOmision(workspaceId: string): Conexion {
  return {
    workspaceId, phoneNumberId: null, wabaId: null, displayPhone: null, modo: "SIMULADO", pausaBotHoras: PAUSA_BOT_HORAS_POR_DEFECTO,
    igAccountId: null, igPageId: null, igUsuario: null, igActivo: false,
  };
}

/** La conexión del workspace; sin fila, la simulada por omisión. */
export async function leerConexion(workspaceId: string): Promise<Conexion> {
  const f = await prisma.fotofficeWaConexion.findUnique({ where: { workspaceId } });
  if (!f) return conexionPorOmision(workspaceId);
  return {
    workspaceId,
    phoneNumberId: f.phoneNumberId,
    wabaId: f.wabaId,
    displayPhone: f.displayPhone,
    modo: (MODOS_CONEXION as readonly string[]).includes(f.modo) ? (f.modo as ModoConexion) : "SIMULADO",
    pausaBotHoras: f.pausaBotHoras ?? PAUSA_BOT_HORAS_POR_DEFECTO,
    igAccountId: f.igAccountId ?? null,
    igPageId: f.igPageId ?? null,
    igUsuario: f.igUsuario ?? null,
    igActivo: f.igActivo === true,
  };
}

export type DatosConexion = {
  modo?: unknown;
  phoneNumberId?: unknown;
  wabaId?: unknown;
  displayPhone?: unknown;
  pausaBotHoras?: unknown;
  /** Token nuevo. Ausente o vacío: se conserva el que había. */
  token?: unknown;
};

export type ResultadoConexion = { ok: true } | { ok: false; error: string };

const soloDigitos = (v: string) => /^\d{5,30}$/.test(v);
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type DepsConexion = {
  fetch?: typeof fetch;
  /** Por omisión, el baúl de integraciones. */
  leerToken?: (workspaceId: string) => Promise<string | null>;
};

const TIEMPO_VERIFICACION_MS = 10_000;

/**
 * Suscribe la cuenta de WhatsApp Business a la app de Meta (`POST /{waba}/subscribed_apps`). Sin
 * esto, aunque el webhook esté configurado en la app, Meta NO manda los mensajes de esa cuenta.
 * Es idempotente: se hace en cada guardado en modo real. Nunca loguea el token.
 */
async function suscribirCuentaALaApp(wabaId: string, token: string, f: typeof fetch): Promise<{ ok: true } | { ok: false; motivo: string | null }> {
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  try {
    const res = await f(`https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIEMPO_VERIFICACION_MS),
    });
    const json = (await res.json().catch(() => null)) as { success?: unknown; error?: { message?: unknown; code?: unknown } } | null;
    if (res.status === 200 && json?.success === true) return { ok: true };
    // Sólo el mensaje y el código de Meta (no traen el token): para saber qué corregir.
    const mensaje = typeof json?.error?.message === "string" ? json.error.message.replaceAll(token, "…").slice(0, 200) : null;
    const codigo = typeof json?.error?.code === "number" || typeof json?.error?.code === "string" ? String(json.error.code) : null;
    const motivo = mensaje ? `${mensaje}${codigo ? ` (código ${codigo})` : ""}` : `respuesta ${res.status}`;
    console.error("[fotoffice][whatsapp] Meta rechazó suscribir la cuenta", { status: res.status, codigo, mensaje });
    return { ok: false, motivo };
  } catch {
    return { ok: false, motivo: null };
  }
}

/** El mensaje y el código de un error de Meta, sin el token. `respuesta N` si no vino ninguno. */
function motivoDeMeta(json: { error?: { message?: unknown; code?: unknown } } | null, status: number, tokens: string[]): string {
  let mensaje = typeof json?.error?.message === "string" ? json.error.message : null;
  if (mensaje) for (const t of tokens) if (t) mensaje = mensaje.replaceAll(t, "…");
  mensaje = mensaje ? mensaje.slice(0, 200) : null;
  const codigo = typeof json?.error?.code === "number" || typeof json?.error?.code === "string" ? String(json.error.code) : null;
  return mensaje ? `${mensaje}${codigo ? ` (código ${codigo})` : ""}` : `respuesta ${status}`;
}

/**
 * Pregunta a Meta, con el token de ESTA institución, si el número existe y le pertenece. Evita que
 * una institución reclame el número de otra (el webhook resuelve el workspace por `phoneNumberId`).
 * Devuelve el número para mostrar, o `null` si no se pudo verificar. Nunca loguea el token.
 */
export async function verificarNumeroConMeta(phoneNumberId: string, token: string, f: typeof fetch): Promise<{ displayPhone: string | null } | null> {
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  try {
    const res = await f(`https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,display_phone_number`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIEMPO_VERIFICACION_MS),
    });
    if (res.status !== 200) return null;
    const json = (await res.json().catch(() => null)) as { id?: unknown; display_phone_number?: unknown } | null;
    if (!json || String(json.id ?? "") !== phoneNumberId) return null;
    return { displayPhone: typeof json.display_phone_number === "string" && json.display_phone_number ? json.display_phone_number : null };
  } catch {
    return null;
  }
}

/** Configurar WhatsApp: sólo dueño y administradores (`configurar`). */
export async function guardarConexion(ctx: CtxConsultas, datos: DatosConexion, deps: DepsConexion = {}): Promise<ResultadoConexion> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_CONEXION.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_CONEXION.datosInvalidos };

  const actual = await leerConexion(ctx.workspaceId);

  const modo = datos.modo === undefined ? actual.modo : datos.modo;
  if (!(MODOS_CONEXION as readonly unknown[]).includes(modo)) return { ok: false, error: MENSAJES_CONEXION.modo };

  const phoneNumberId = datos.phoneNumberId === undefined ? actual.phoneNumberId : texto(datos.phoneNumberId) || null;
  if (phoneNumberId && !soloDigitos(phoneNumberId)) return { ok: false, error: MENSAJES_CONEXION.phoneNumberId };

  const wabaId = datos.wabaId === undefined ? actual.wabaId : texto(datos.wabaId) || null;
  if (wabaId && !soloDigitos(wabaId)) return { ok: false, error: MENSAJES_CONEXION.wabaId };

  let displayPhone = datos.displayPhone === undefined ? actual.displayPhone : truncarSeguro(texto(datos.displayPhone), 40, false) || null;

  const pausa = datos.pausaBotHoras === undefined ? actual.pausaBotHoras : datos.pausaBotHoras;
  if (typeof pausa !== "number" || !Number.isInteger(pausa) || pausa < PAUSA_MINIMA_HORAS || pausa > PAUSA_MAXIMA_HORAS) {
    return { ok: false, error: MENSAJES_CONEXION.pausa };
  }

  const tokenNuevo = texto(datos.token);
  if (modo === "REAL") {
    const hayToken = tokenNuevo ? true : await hayTokenWhatsapp(ctx.workspaceId);
    if (!phoneNumberId || !hayToken) return { ok: false, error: MENSAJES_CONEXION.realSinDatos };
    // Pasar a real, o cambiar de número estando en real: Meta tiene que confirmar que el token es dueño del número.
    if (actual.modo !== "REAL" || phoneNumberId !== actual.phoneNumberId) {
      const token = tokenNuevo || (await (deps.leerToken ?? leerTokenWhatsapp)(ctx.workspaceId).catch(() => null));
      const verificado = token ? await verificarNumeroConMeta(phoneNumberId, token, deps.fetch ?? fetch) : null;
      if (!verificado) return { ok: false, error: MENSAJES_CONEXION.noVerificado };
      if (verificado.displayPhone) displayPhone = verificado.displayPhone;
    }
    if (wabaId) {
      const token = tokenNuevo || (await (deps.leerToken ?? leerTokenWhatsapp)(ctx.workspaceId).catch(() => null));
      const suscripcion = token ? await suscribirCuentaALaApp(wabaId, token, deps.fetch ?? fetch) : { ok: false as const, motivo: null };
      if (!suscripcion.ok) {
        return { ok: false, error: suscripcion.motivo ? `${MENSAJES_CONEXION.sinSuscripcion} Meta dijo: ${suscripcion.motivo}` : MENSAJES_CONEXION.sinSuscripcion };
      }
    }
  }

  // Primero la fila (puede chocar por número repetido); el token se guarda recién cuando la fila quedó.
  // El número sólo se guarda en REAL: en prueba queda libre para que no reserve el único de otra institución.
  const fila = { phoneNumberId: modo === "REAL" ? phoneNumberId : null, wabaId, displayPhone, modo: modo as string, pausaBotHoras: pausa };
  try {
    await prisma.fotofficeWaConexion.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...fila },
      update: fila,
    });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: false, error: MENSAJES_CONEXION.numeroEnUso };
    return { ok: false, error: MENSAJES_CONEXION.fallo };
  }
  if (tokenNuevo) {
    try {
      await guardarTokenWhatsapp(ctx.workspaceId, tokenNuevo, ctx.userId);
    } catch {
      // Sin token no se puede quedar en REAL por esta vía: se vuelve al modo anterior.
      if (modo === "REAL" && actual.modo !== "REAL") {
        await prisma.fotofficeWaConexion.update({ where: { workspaceId: ctx.workspaceId }, data: { modo: actual.modo, phoneNumberId: actual.phoneNumberId } }).catch(() => undefined);
      }
      return { ok: false, error: MENSAJES_CONEXION.sinClave };
    }
  }
  return { ok: true };
}

/** Para la pantalla de configuración: modo, si hay token usable y el número. Nunca el token. */
export async function estadoConexion(workspaceId: string): Promise<{ modo: ModoConexion; tieneToken: boolean; phoneNumberId: string | null }> {
  const c = await leerConexion(workspaceId);
  return { modo: c.modo, tieneToken: await hayTokenWhatsapp(workspaceId), phoneNumberId: c.phoneNumberId };
}

// ── Instagram (mensajes directos) ────────────────────────────────────────────────────────────────

type PaginaDeMeta = { id: string; token: string; igAccountId: string; igUsuario: string | null };

/**
 * Las páginas de Facebook que ve el token del usuario del sistema y que tienen una cuenta
 * profesional de Instagram vinculada (`GET /me/accounts`), cada una con su token de página.
 * Nunca loguea tokens.
 */
async function paginasConInstagram(token: string, f: typeof fetch): Promise<{ ok: true; paginas: PaginaDeMeta[] } | { ok: false; motivo: string | null }> {
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  try {
    const res = await f(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIEMPO_VERIFICACION_MS),
    });
    const json = (await res.json().catch(() => null)) as { data?: unknown; error?: { message?: unknown; code?: unknown } } | null;
    if (res.status !== 200 || !Array.isArray(json?.data)) {
      const motivo = motivoDeMeta(json, res.status, [token]);
      console.error("[fotoffice][instagram] Meta rechazó listar las páginas", { status: res.status });
      return { ok: false, motivo };
    }
    const paginas: PaginaDeMeta[] = [];
    for (const p of json.data as { id?: unknown; access_token?: unknown; instagram_business_account?: { id?: unknown; username?: unknown } }[]) {
      const ig = p?.instagram_business_account;
      if (typeof p?.id !== "string" || typeof p.access_token !== "string" || !p.access_token || typeof ig?.id !== "string" || !ig.id) continue;
      paginas.push({ id: p.id, token: p.access_token, igAccountId: ig.id, igUsuario: typeof ig.username === "string" && ig.username ? ig.username : null });
    }
    return { ok: true, paginas };
  } catch {
    return { ok: false, motivo: null };
  }
}

/** Suscribe la página a la app para los mensajes (`POST /{page}/subscribed_apps`), con el token de página. */
async function suscribirPaginaALaApp(pageId: string, tokenPagina: string, tokenSistema: string, f: typeof fetch): Promise<{ ok: true } | { ok: false; motivo: string | null }> {
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  try {
    const res = await f(`https://graph.facebook.com/${version}/${pageId}/subscribed_apps?subscribed_fields=messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenPagina}` },
      signal: AbortSignal.timeout(TIEMPO_VERIFICACION_MS),
    });
    const json = (await res.json().catch(() => null)) as { success?: unknown; error?: { message?: unknown; code?: unknown } } | null;
    if (res.status === 200 && json?.success === true) return { ok: true };
    const motivo = motivoDeMeta(json, res.status, [tokenPagina, tokenSistema]);
    console.error("[fotoffice][instagram] Meta rechazó suscribir la página", { status: res.status });
    return { ok: false, motivo };
  } catch {
    return { ok: false, motivo: null };
  }
}

const conMotivo = (base: string, motivo: string | null) => (motivo ? `${base} Meta dijo: ${motivo}` : base);

/**
 * Conecta Instagram (§5.5 del diseño): con el token del usuario del sistema busca la página de
 * Facebook que tiene Instagram vinculado (si hay varias, la de la cuenta ya guardada o la primera),
 * la suscribe a la app y guarda la página, la cuenta y el @usuario. En el baúl queda el token de
 * PÁGINA (el que sirve para contestar), nunca el del usuario del sistema. Queda activo sólo si
 * todo salió bien. Sólo dueño y administradores.
 */
export async function conectarInstagram(ctx: CtxConsultas, datos: { token: string }, deps: { fetch?: typeof fetch } = {}): Promise<ResultadoConexion> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_CONEXION.igSinPermiso };
  const token = texto(datos?.token);
  if (!token) return { ok: false, error: MENSAJES_CONEXION.igSinToken };
  const f = deps.fetch ?? fetch;

  const lista = await paginasConInstagram(token, f);
  if (!lista.ok) return { ok: false, error: conMotivo(MENSAJES_CONEXION.igTokenRechazado, lista.motivo) };
  const actual = await leerConexion(ctx.workspaceId);
  const pagina = lista.paginas.find((p) => p.igAccountId === actual.igAccountId) ?? lista.paginas[0];
  if (!pagina) return { ok: false, error: MENSAJES_CONEXION.igSinPagina };

  const suscripcion = await suscribirPaginaALaApp(pagina.id, pagina.token, token, f);
  if (!suscripcion.ok) return { ok: false, error: conMotivo(MENSAJES_CONEXION.igSinSuscripcion, suscripcion.motivo) };

  // Primero la fila (puede chocar por cuenta repetida); el token, recién cuando la fila quedó.
  const fila = { igPageId: pagina.id, igAccountId: pagina.igAccountId, igUsuario: pagina.igUsuario, igActivo: true };
  try {
    await prisma.fotofficeWaConexion.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, modo: actual.modo, pausaBotHoras: actual.pausaBotHoras, ...fila },
      update: fila,
    });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: false, error: MENSAJES_CONEXION.igEnUso };
    return { ok: false, error: MENSAJES_CONEXION.fallo };
  }
  try {
    await guardarTokenInstagram(ctx.workspaceId, pagina.token, ctx.userId);
  } catch {
    // Sin token de página no se puede contestar: se vuelve a lo que había.
    const previo = { igPageId: actual.igPageId, igAccountId: actual.igAccountId, igUsuario: actual.igUsuario, igActivo: actual.igActivo };
    await prisma.fotofficeWaConexion.update({ where: { workspaceId: ctx.workspaceId }, data: previo }).catch(() => undefined);
    return { ok: false, error: MENSAJES_CONEXION.sinClave };
  }
  return { ok: true };
}

/** Apaga Instagram y borra el token de página. WhatsApp no cambia. Sólo dueño y administradores. */
export async function desconectarInstagram(ctx: CtxConsultas): Promise<ResultadoConexion> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_CONEXION.igSinPermiso };
  try {
    await prisma.fotofficeWaConexion.updateMany({ where: { workspaceId: ctx.workspaceId }, data: { igActivo: false } });
    await borrarTokenInstagram(ctx.workspaceId);
  } catch {
    return { ok: false, error: MENSAJES_CONEXION.fallo };
  }
  return { ok: true };
}

/** Para la pantalla: conectado (activo y con token de página) y el @usuario. Nunca el token. */
export async function estadoInstagram(workspaceId: string): Promise<{ conectado: boolean; usuario: string | null }> {
  const c = await leerConexion(workspaceId);
  return { conectado: c.igActivo && (await hayTokenInstagram(workspaceId)), usuario: c.igUsuario };
}
