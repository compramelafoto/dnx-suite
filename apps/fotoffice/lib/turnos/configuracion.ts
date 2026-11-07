/**
 * Validación de la configuración de turnos (por tipo y de la página). Módulo PURO: lo usan las acciones
 * de Configuración → Agenda → Tipos de cita (`configurar.ts`).
 */
import {
  DURACION_TURNO_MAX, DURACION_TURNO_MIN, MAX_DESCRIPCION, MAX_DIRECCION, MENSAJES_TURNOS, esModalidad,
  type AjustesTurnos, type Modalidad,
} from "./constantes";
import { leerFranjas, type Franja } from "./franjas";

export type ConfigTurnoTipo = {
  isBookable: boolean;
  publicDescription: string | null;
  durationMinutes: number | null;
  modality: Modalidad | null;
  address: string | null;
  franjas: Franja[];
};

type Res<T> = { ok: true; valor: T } | { ok: false; error: string };

function textoOpcional(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > max) return undefined;
  return t || null;
}

export function validarConfigTurnoTipo(v: unknown): Res<ConfigTurnoTipo> {
  if (!v || typeof v !== "object") return { ok: false, error: MENSAJES_TURNOS.datosInvalidos };
  const o = v as Record<string, unknown>;
  const isBookable = o.isBookable === true;
  const publicDescription = textoOpcional(o.publicDescription, MAX_DESCRIPCION);
  if (publicDescription === undefined) return { ok: false, error: MENSAJES_TURNOS.descripcion };
  const address = textoOpcional(o.address, MAX_DIRECCION);
  if (address === undefined) return { ok: false, error: MENSAJES_TURNOS.datosInvalidos };

  let durationMinutes: number | null = null;
  if (o.durationMinutes !== null && o.durationMinutes !== undefined && o.durationMinutes !== "") {
    const n = Number(o.durationMinutes);
    if (!Number.isInteger(n) || n < DURACION_TURNO_MIN || n > DURACION_TURNO_MAX) return { ok: false, error: MENSAJES_TURNOS.duracion };
    durationMinutes = n;
  }
  const modality = o.modality === null || o.modality === undefined || o.modality === "" ? null : esModalidad(o.modality) ? o.modality : undefined;
  if (modality === undefined) return { ok: false, error: MENSAJES_TURNOS.modalidad };
  const franjas = leerFranjas(o.franjas ?? []);
  if (franjas === null) return { ok: false, error: MENSAJES_TURNOS.franjas };

  if (isBookable) {
    if (durationMinutes === null) return { ok: false, error: MENSAJES_TURNOS.duracion };
    if (modality === null) return { ok: false, error: MENSAJES_TURNOS.modalidad };
    if (franjas.length === 0) return { ok: false, error: MENSAJES_TURNOS.sinFranjas };
    if ((modality === "ESTUDIO" || modality === "DIRECCION") && !address) return { ok: false, error: MENSAJES_TURNOS.direccion };
  }
  return { ok: true, valor: { isBookable, publicDescription, durationMinutes, modality, address, franjas } };
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function validarAjustesTurnos(v: unknown): Res<AjustesTurnos> {
  if (!v || typeof v !== "object") return { ok: false, error: MENSAJES_TURNOS.datosInvalidos };
  const o = v as Record<string, unknown>;
  const pageTitle = textoOpcional(o.pageTitle, 120);
  const pageIntro = textoOpcional(o.pageIntro, MAX_DESCRIPCION);
  if (pageTitle === undefined || pageIntro === undefined) return { ok: false, error: MENSAJES_TURNOS.descripcion };
  const cancelWindowHours = entero(o.cancelWindowHours, 0, 720);
  const bufferMinutes = entero(o.bufferMinutes, 0, 240);
  const minAdvanceHours = entero(o.minAdvanceHours, 0, 720);
  const maxAdvanceDays = entero(o.maxAdvanceDays, 1, 365);
  if (cancelWindowHours === null || bufferMinutes === null || minAdvanceHours === null || maxAdvanceDays === null) return { ok: false, error: MENSAJES_TURNOS.ajustes };
  const notifyEmail = textoOpcional(o.notifyEmail, 200);
  if (notifyEmail === undefined || (notifyEmail !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail))) return { ok: false, error: MENSAJES_TURNOS.correoAviso };
  return { ok: true, valor: { pageTitle, pageIntro, cancelWindowHours, bufferMinutes, minAdvanceHours, maxAdvanceDays, notifyEmail: notifyEmail?.toLowerCase() ?? null } };
}
