"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import {
  activarCircuito,
  activarMotivo,
  archivarEtapa,
  borrarEtapa,
  clonarCircuito,
  crearCircuito,
  crearEtapa,
  crearMotivo,
  desarchivarEtapa,
  editarEtapa,
  guardarReglas,
  guardarTareasModelo,
  marcarPredeterminado,
  ordenarMotivos,
  renombrarCircuito,
  renombrarMotivo,
  reordenarEtapas,
} from "@/lib/circuitos/configuracion";

/** Estado de cada formulario de Configuración → Circuitos (`useActionState`). */
export type EstadoCircuitos = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/circuitos";
const SIN_PERMISO: EstadoCircuitos = { error: "Sólo el dueño o un administrador pueden cambiar los circuitos." };
const DATOS_INVALIDOS: EstadoCircuitos = { error: "Los datos no son válidos." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 */
async function contexto() {
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, role };
}

function campo(fd: FormData, nombre: string, max = 200): string | null {
  const v = fd.get(nombre);
  if (typeof v !== "string" || v.length === 0 || v.length > max) return null;
  return v;
}

/** Texto opcional: "" si no vino (el catálogo decide si falta). */
function texto(fd: FormData, nombre: string, max = 200): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.slice(0, max + 1) : "";
}

/** Entero o NaN (el catálogo lo rechaza). */
function entero(fd: FormData, nombre: string): number {
  const v = fd.get(nombre);
  return typeof v === "string" && /^\d{1,4}$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
}

function ids(fd: FormData, nombre: string): string[] | null {
  const v = fd.getAll(nombre);
  if (v.length > 200 || v.some((x) => typeof x !== "string" || x.length === 0 || x.length > 100)) return null;
  return v as string[];
}

function resultado(r: { ok: true } | { ok: false; error: string }, ok: string): EstadoCircuitos {
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok };
}

// ─── Circuitos ───────────────────────────────────────────────────────────────

export async function crearCircuitoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  return resultado(await crearCircuito(ctx, { name: texto(fd, "nombre"), kind: texto(fd, "clase", 20) }), "Circuito creado.");
}

export async function renombrarCircuitoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await renombrarCircuito(ctx, id, texto(fd, "nombre")), "Nombre guardado.");
}

export async function clonarCircuitoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await clonarCircuito(ctx, id, texto(fd, "nombre")), "Circuito copiado.");
}

export async function activarCircuitoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const activo = fd.get("activo");
  if (id === null || (activo !== "1" && activo !== "0")) return DATOS_INVALIDOS;
  return resultado(await activarCircuito(ctx, id, activo === "1"), activo === "1" ? "Circuito activado." : "Circuito desactivado.");
}

export async function marcarPredeterminadoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await marcarPredeterminado(ctx, id), "Ahora es el predeterminado.");
}

// ─── Etapas ──────────────────────────────────────────────────────────────────

export async function crearEtapaAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const circuitId = campo(fd, "circuitoId", 100);
  if (circuitId === null) return DATOS_INVALIDOS;
  const datos = { name: texto(fd, "nombre"), days: entero(fd, "dias"), color: texto(fd, "color", 20) };
  return resultado(await crearEtapa(ctx, circuitId, datos), "Etapa agregada.");
}

export async function editarEtapaAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  const datos = {
    name: texto(fd, "nombre"),
    days: entero(fd, "dias"),
    color: texto(fd, "color", 20),
    requireTasks: fd.get("exigeTareas") === "1",
    leadStatus: texto(fd, "estadoCaptacion", 20) || null,
  };
  return resultado(await editarEtapa(ctx, id, datos), "Etapa guardada.");
}

export async function reordenarEtapasAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const circuitId = campo(fd, "circuitoId", 100);
  const orden = ids(fd, "etapa");
  if (circuitId === null || orden === null) return DATOS_INVALIDOS;
  return resultado(await reordenarEtapas(ctx, circuitId, orden), "Orden guardado.");
}

export async function archivarEtapaAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await archivarEtapa(ctx, id), "Etapa archivada.");
}

export async function desarchivarEtapaAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await desarchivarEtapa(ctx, id), "Etapa activada al final del circuito.");
}

export async function borrarEtapaAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await borrarEtapa(ctx, id), "Etapa borrada.");
}

/** Las tareas llegan como JSON `[{ title, days, required }]` desde el editor. */
export async function guardarTareasModeloAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const crudo = campo(fd, "tareas", 20_000);
  if (id === null || crudo === null) return DATOS_INVALIDOS;
  let lista: unknown;
  try {
    lista = JSON.parse(crudo);
  } catch {
    return DATOS_INVALIDOS;
  }
  return resultado(await guardarTareasModelo(ctx, id, lista), "Tareas guardadas.");
}

export async function guardarReglasAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const eventos = ids(fd, "evento");
  if (id === null || eventos === null) return DATOS_INVALIDOS;
  return resultado(await guardarReglas(ctx, id, eventos), "Avance automático guardado.");
}

// ─── Motivos de pérdida ──────────────────────────────────────────────────────

export async function crearMotivoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  return resultado(await crearMotivo(ctx, texto(fd, "nombre")), "Motivo agregado.");
}

export async function renombrarMotivoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await renombrarMotivo(ctx, id, texto(fd, "nombre")), "Nombre guardado.");
}

export async function activarMotivoAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const activo = fd.get("activo");
  if (id === null || (activo !== "1" && activo !== "0")) return DATOS_INVALIDOS;
  return resultado(await activarMotivo(ctx, id, activo === "1"), activo === "1" ? "Motivo activado." : "Motivo desactivado.");
}

export async function ordenarMotivosAction(_prev: EstadoCircuitos | undefined, fd: FormData): Promise<EstadoCircuitos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const orden = ids(fd, "motivo");
  if (orden === null) return DATOS_INVALIDOS;
  return resultado(await ordenarMotivos(ctx, orden), "Orden guardado.");
}
