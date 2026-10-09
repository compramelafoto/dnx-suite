import "server-only";
import { prisma } from "@repo/db";
import { MODOS_CONEXION, PAUSA_BOT_HORAS_POR_DEFECTO, type ModoConexion } from "./constantes";
import { truncarSeguro } from "./vista-previa";
import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { guardarTokenWhatsapp, hayTokenWhatsapp, leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";

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
  sinClave: "No se pudo guardar el token: falta configurar la clave de cifrado del servidor.",
  fallo: "No se pudo guardar la configuración.",
} as const;

export function conexionPorOmision(workspaceId: string): Conexion {
  return { workspaceId, phoneNumberId: null, wabaId: null, displayPhone: null, modo: "SIMULADO", pausaBotHoras: PAUSA_BOT_HORAS_POR_DEFECTO };
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
 * Pregunta a Meta, con el token de ESTA institución, si el número existe y le pertenece. Evita que
 * una institución reclame el número de otra (el webhook resuelve el workspace por `phoneNumberId`).
 * Devuelve el número para mostrar, o `null` si no se pudo verificar. Nunca loguea el token.
 */
async function verificarNumeroConMeta(phoneNumberId: string, token: string, f: typeof fetch): Promise<{ displayPhone: string | null } | null> {
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
