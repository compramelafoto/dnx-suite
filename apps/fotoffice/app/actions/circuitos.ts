"use server";

import { revalidatePath } from "next/cache";
import { puede, puedeEnContexto } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { contextoDeCircuitos, type CtxCircuitos } from "@/lib/circuitos/acceso";
import { SALIDAS } from "@/lib/circuitos/constantes";
import { asignarResponsable, cambiarVencimiento, cerrar, MENSAJES, mover, sujetoDeRecorrido } from "@/lib/circuitos/recorridos";
import { borrarTareaSuelta, crearTareaSuelta, sujetoDeTarea, tildarTarea } from "@/lib/circuitos/tareas";
import { adaptadorDe, type Adaptador, type Sujeto } from "@/lib/circuitos/sujetos";

// Archivo "use server": sólo exporta funciones async. Cada acción valida la forma de lo que
// recibe, arma el contexto (sesión + workspace + `operar`), verifica que el registro sea del
// workspace y que su módulo esté encendido, y recién ahí llama al motor.

type Falla = { ok: false; error: string };
type Resultado = { ok: true } | { ok: false; error: string; pendientes?: string[] };

const DATOS_INVALIDOS: Falla = { ok: false, error: "Los datos no son válidos." };
const SIN_ACCESO: Falla = { ok: false, error: "No tenés permiso para hacer esto." };
const MODULO_APAGADO: Falla = { ok: false, error: "Ese módulo no está activo." };
const NO_ENCONTRADO: Falla = { ok: false, error: MENSAJES.noEncontrado };

const NOTA_MAX = 2000;
const SALIDAS_VALIDAS: readonly string[] = Object.values(SALIDAS).flatMap((s) => [s.exito, s.fracaso]);

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 100;
}
function idOpcional(v: unknown): boolean {
  return v === undefined || idValido(v);
}
function notaValida(v: unknown): v is string | undefined {
  return v === undefined || (typeof v === "string" && v.length <= NOTA_MAX);
}
function booleanoOpcional(v: unknown): v is boolean | undefined {
  return v === undefined || typeof v === "boolean";
}
function usuarioValido(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}
/** Fecha como `Date` o texto ISO; `undefined` si no vino; `null` si vino mal. */
function leerFecha(v: unknown): Date | undefined | null {
  if (v === undefined) return undefined;
  const d = v instanceof Date ? v : typeof v === "string" && v.length <= 40 ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

type Preparado = { ctx: CtxCircuitos; adaptador: Adaptador; sujeto: Sujeto };

/** Contexto, pertenencia al workspace y módulo encendido. */
async function preparar(buscar: (workspaceId: string) => Promise<Sujeto | null>): Promise<Preparado | Falla> {
  const ctx = await contextoDeCircuitos();
  if (!ctx) return SIN_ACCESO;
  const sujeto = await buscar(ctx.workspaceId);
  const adaptador = sujeto ? adaptadorDe(sujeto.tipo) : null;
  if (!sujeto || !adaptador) return NO_ENCONTRADO;
  if (!puedeEnContexto(ctx, "operar", adaptador.moduleKey)) return SIN_ACCESO;
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, adaptador.moduleKey))) return MODULO_APAGADO;
  return { ctx, adaptador, sujeto };
}

function esFalla(p: Preparado | Falla): p is Falla {
  return "ok" in p;
}

function revalidar({ adaptador, sujeto }: Preparado): void {
  revalidatePath(adaptador.rutaTablero);
  revalidatePath(adaptador.rutaFicha(sujeto.id));
  revalidatePath("/dashboard");
}

const deRecorrido = (journeyId: string) => (workspaceId: string) => sujetoDeRecorrido(workspaceId, journeyId);
const deTarea = (taskId: string) => (workspaceId: string) => sujetoDeTarea(workspaceId, taskId);

export async function moverAction(datos: {
  journeyId: string;
  destinoId: string;
  nota?: string;
  forzar?: boolean;
  esperado?: Date | string;
}): Promise<Resultado> {
  if (!esObjeto(datos) || !idValido(datos.journeyId) || !idValido(datos.destinoId) || !notaValida(datos.nota) || !booleanoOpcional(datos.forzar)) {
    return DATOS_INVALIDOS;
  }
  const esperado = leerFecha(datos.esperado);
  if (esperado === null) return DATOS_INVALIDOS;
  const p = await preparar(deRecorrido(datos.journeyId));
  if (esFalla(p)) return p;
  // Pasar con tareas obligatorias pendientes es de quien puede configurar.
  const forzar = datos.forzar === true && puede(p.ctx.role, "configurar");
  const r = await mover(p.ctx, datos.journeyId, datos.destinoId, { nota: datos.nota, forzar, esperado });
  if (r.ok) revalidar(p);
  return r;
}

export async function cerrarAction(datos: {
  journeyId: string;
  salida: string;
  lossReasonId?: string;
  nota?: string;
  forzar?: boolean;
  esperado?: Date | string;
}): Promise<Resultado> {
  if (
    !esObjeto(datos) || !idValido(datos.journeyId) || typeof datos.salida !== "string" || !SALIDAS_VALIDAS.includes(datos.salida)
    || !idOpcional(datos.lossReasonId) || !notaValida(datos.nota) || !booleanoOpcional(datos.forzar)
  ) {
    return DATOS_INVALIDOS;
  }
  const esperado = leerFecha(datos.esperado);
  if (esperado === null) return DATOS_INVALIDOS;
  const p = await preparar(deRecorrido(datos.journeyId));
  if (esFalla(p)) return p;
  const forzar = datos.forzar === true && puede(p.ctx.role, "configurar");
  const r = await cerrar(p.ctx, datos.journeyId, datos.salida, datos.lossReasonId, datos.nota, { esperado, forzar });
  if (r.ok) revalidar(p);
  return r;
}

export async function cambiarVencimientoAction(datos: {
  journeyId: string;
  dueAt: Date | string | null;
  nota?: string;
  esperado?: Date | string;
}): Promise<Resultado> {
  if (!esObjeto(datos) || !idValido(datos.journeyId) || !notaValida(datos.nota)) return DATOS_INVALIDOS;
  const dueAt = datos.dueAt === null ? null : leerFecha(datos.dueAt);
  const esperado = leerFecha(datos.esperado);
  if (dueAt === undefined || (datos.dueAt !== null && dueAt === null) || esperado === null) return DATOS_INVALIDOS;
  const p = await preparar(deRecorrido(datos.journeyId));
  if (esFalla(p)) return p;
  const r = await cambiarVencimiento(p.ctx, datos.journeyId, dueAt, datos.nota ?? "", { esperado });
  if (r.ok) revalidar(p);
  return r;
}

export async function asignarResponsableAction(datos: { journeyId: string; userId: number | null }): Promise<Resultado> {
  if (!esObjeto(datos) || !idValido(datos.journeyId) || !(datos.userId === null || usuarioValido(datos.userId))) return DATOS_INVALIDOS;
  const p = await preparar(deRecorrido(datos.journeyId));
  if (esFalla(p)) return p;
  const r = await asignarResponsable(p.ctx, datos.journeyId, datos.userId);
  if (r.ok) revalidar(p);
  return r;
}

export async function tildarTareaAction(datos: { taskId: string; hecha: boolean }): Promise<Resultado> {
  if (!esObjeto(datos) || !idValido(datos.taskId) || typeof datos.hecha !== "boolean") return DATOS_INVALIDOS;
  const p = await preparar(deTarea(datos.taskId));
  if (esFalla(p)) return p;
  const r = await tildarTarea(p.ctx, datos.taskId, datos.hecha);
  if (r.ok) revalidar(p);
  return r;
}

export async function crearTareaAction(datos: {
  journeyId: string;
  titulo: string;
  dueAt?: Date | string | null;
  assigneeUserId?: number | null;
}): Promise<{ ok: true; id: string } | Falla> {
  if (
    !esObjeto(datos) || !idValido(datos.journeyId) || typeof datos.titulo !== "string" || datos.titulo.length > 1000
    || !(datos.assigneeUserId === undefined || datos.assigneeUserId === null || usuarioValido(datos.assigneeUserId))
  ) {
    return DATOS_INVALIDOS;
  }
  const dueAt = datos.dueAt === null ? null : leerFecha(datos.dueAt);
  if (dueAt === null && datos.dueAt !== null) return DATOS_INVALIDOS;
  const p = await preparar(deRecorrido(datos.journeyId));
  if (esFalla(p)) return p;
  const r = await crearTareaSuelta(p.ctx, datos.journeyId, { titulo: datos.titulo, dueAt: dueAt ?? null, assigneeUserId: datos.assigneeUserId ?? null });
  if (r.ok) revalidar(p);
  return r;
}

export async function borrarTareaAction(datos: { taskId: string }): Promise<Resultado> {
  if (!esObjeto(datos) || !idValido(datos.taskId)) return DATOS_INVALIDOS;
  const p = await preparar(deTarea(datos.taskId));
  if (esFalla(p)) return p;
  const r = await borrarTareaSuelta(p.ctx, datos.taskId);
  if (r.ok) revalidar(p);
  return r;
}
