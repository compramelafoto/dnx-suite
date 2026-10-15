"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { puedeEnContexto } from "@/lib/access/policy";
import { MENSAJES_AGENDA } from "@/lib/agenda/acceso";
import { anularCita, cambiarEstadoCita, crearCita, editarCita, moverCita, type DatosCita, type ResultadoCita } from "@/lib/agenda/citas";
import { guardarAjustesRecordatorio, type ResultadoAjustes } from "@/lib/agenda/ajustes";
import { contextoDeAgenda } from "@/lib/agenda/contexto";
import { crearCalendarioDeAgenda, type ResultadoCalendario } from "@/lib/agenda/google/calendario";
import { alCambiarCita } from "@/lib/agenda/google/hook";
import { sincronizarAgenda } from "@/lib/agenda/google/sincronizar";
import {
  agregarParticipante, editarParticipante, quitarParticipante,
  type DatosParticipante, type ResultadoParticipante, type ResultadoSimple,
} from "@/lib/agenda/participantes";
import { crearTipo, editarTipo, type ResultadoTipo, type ResultadoSimple as ResultadoSimpleTipo } from "@/lib/agenda/tipos";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { prisma } from "@repo/db";
import { buscarContactos, type ContactoEncontrado } from "@/lib/consultas/ficha";

// Archivo "use server": sólo exporta funciones async. Cada acción revisa la forma de lo que llega,
// arma el contexto (sesión + workspace de la sesión + módulo `agenda` encendido + "Gestionar" en
// Agenda) y recién ahí escribe. Cada id se valida contra el workspace en `lib/agenda`. Después de
// confirmar un cambio de una cita, se avisa a Google con `after()`, sin frenar la acción.

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

const DATOS_INVALIDOS = { ok: false, error: MENSAJES_AGENDA.datosInvalidos } as const;
const SIN_PERMISO = { ok: false, error: MENSAJES_AGENDA.sinPermiso } as const;

function revalidarAgenda(): void {
  revalidatePath("/agenda");
}

/** Revalida y avisa a Google (después de responder) de una cita que acaba de cambiar. */
function avisarCambio(workspaceId: string, citaId: string): void {
  revalidarAgenda();
  after(() => alCambiarCita(workspaceId, citaId));
}

// --- Citas ----------------------------------------------------------------------------------------

export async function crearCitaAction(datos: DatosCita): Promise<ResultadoCita> {
  if (!esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await crearCita(ctx, datos);
  if (r.ok) {
    avisarCambio(ctx.workspaceId, r.id);
    if (esId(datos.pedidoId)) revalidatePath(`/pedidos/${datos.pedidoId}`);
  }
  return r;
}

export async function editarCitaAction(citaId: string, datos: DatosCita): Promise<ResultadoCita> {
  if (!esId(citaId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarCita(ctx, citaId, datos);
  if (r.ok) avisarCambio(ctx.workspaceId, r.id);
  return r;
}

export async function moverCitaAction(citaId: string, datos: { startAt: string; endAt: string; allDay?: boolean }): Promise<ResultadoCita> {
  if (!esId(citaId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await moverCita(ctx, citaId, datos);
  if (r.ok) avisarCambio(ctx.workspaceId, r.id);
  return r;
}

export async function cambiarEstadoCitaAction(citaId: string, estado: string): Promise<ResultadoCita> {
  if (!esId(citaId) || typeof estado !== "string") return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await cambiarEstadoCita(ctx, citaId, estado);
  if (r.ok) avisarCambio(ctx.workspaceId, r.id);
  return r;
}

export async function anularCitaAction(citaId: string): Promise<ResultadoCita> {
  if (!esId(citaId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await anularCita(ctx, citaId);
  if (r.ok) avisarCambio(ctx.workspaceId, r.id);
  return r;
}

// --- Participantes --------------------------------------------------------------------------------

export async function agregarParticipanteCitaAction(citaId: string, datos: DatosParticipante): Promise<ResultadoParticipante> {
  if (!esId(citaId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await agregarParticipante(ctx, citaId, datos);
  if (r.ok) revalidarAgenda();
  return r;
}

export async function editarParticipanteCitaAction(participanteId: string, datos: { roleId?: string | null; note?: string | null }): Promise<ResultadoSimple> {
  if (!esId(participanteId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarParticipante(ctx, participanteId, { roleId: datos.roleId, note: datos.note });
  if (r.ok) revalidarAgenda();
  return r;
}

export async function quitarParticipanteCitaAction(participanteId: string): Promise<ResultadoSimple> {
  if (!esId(participanteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await quitarParticipante(ctx, participanteId);
  if (r.ok) revalidarAgenda();
  return r;
}

/**
 * Buscador de contactos para los participantes: "Gestionar" en Agenda y, además, "Ver" en Clientes
 * (regla R10: es el padrón de clientes).
 */
export async function buscarContactosAgendaAction(
  texto: string,
): Promise<{ ok: true; contactos: ContactoEncontrado[] } | { ok: false; error: string }> {
  if (typeof texto !== "string" || texto.length > 200) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return SIN_PERMISO;
  if (!puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return { ok: false, error: "Para buscar contactos necesitás permiso para ver Clientes." };
  return { ok: true, contactos: await buscarContactos(ctx.workspaceId, texto) };
}

// --- Tipos de cita (configurar) -------------------------------------------------------------------

export async function crearTipoCitaAction(datos: { name: string; color?: string | null }): Promise<ResultadoTipo> {
  if (!esObjeto(datos) || typeof datos.name !== "string") return DATOS_INVALIDOS;
  if (datos.color != null && typeof datos.color !== "string") return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await crearTipo(ctx, { name: datos.name, color: datos.color ?? undefined });
  if (r.ok) revalidarAgenda();
  return r;
}

export async function editarTipoCitaAction(
  tipoId: string,
  datos: { name?: string; color?: string; order?: number; isActive?: boolean },
): Promise<ResultadoSimpleTipo> {
  if (!esId(tipoId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await editarTipo(ctx, tipoId, datos);
  if (r.ok) revalidarAgenda();
  return r;
}

// --- Google Calendar ------------------------------------------------------------------------------

/**
 * Configuración → Agenda → «Crear calendario «<organización> Agenda»». Sólo `configurar` (lo exige lib).
 * Al crearlo, y sin frenar la respuesta, se hace la primera sincronización: las citas y entregas que ya
 * existían suben al calendario nuevo.
 */
export async function crearCalendarioAgendaAction(): Promise<ResultadoCalendario> {
  const ctx = await contextoDeAgenda("ver");
  if (!ctx) return SIN_PERMISO;
  const org = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true } });
  const r = await crearCalendarioDeAgenda(ctx, org?.name ?? "");
  if (r.ok) {
    revalidatePath("/workspace/configuracion/agenda");
    const workspaceId = ctx.workspaceId;
    after(() => sincronizarAgenda(workspaceId).then(() => undefined));
  }
  return r;
}

// --- Recordatorio al cliente (configurar) ---------------------------------------------------------

/** Configuración → Agenda → «Recordatorio al cliente»: encendido y horas de anticipación. Sólo `configurar` (lo exige lib). */
export async function guardarRecordatorioAgendaAction(datos: { activo: boolean; horas: number | string }): Promise<ResultadoAjustes> {
  if (!esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeAgenda("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await guardarAjustesRecordatorio(ctx, datos);
  if (r.ok) revalidatePath("/workspace/configuracion/agenda");
  return r;
}
