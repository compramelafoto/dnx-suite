"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { guardarBorradorAuto } from "@/lib/presupuestos/borrador-automatico";
import { guardarAjustes } from "@/lib/presupuestos/ajustes";
import { borrarPropuestaModelo, guardarPropuestaModelo } from "@/lib/presupuestos/propuestas-modelo";
import type { CtxPresupuestos } from "@/lib/presupuestos/acceso";

/** Estado del formulario de Configuración → Presupuestos (`useActionState`). */
export type EstadoPresupuestosConfig = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/presupuestos";
const RUTA_PROPUESTAS = "/workspace/configuracion/presupuestos/propuestas";
const SIN_PERMISO: EstadoPresupuestosConfig = { error: "Sólo el dueño o un administrador pueden configurar los presupuestos." };
const DATOS_INVALIDOS: EstadoPresupuestosConfig = { error: "Los datos no son válidos." };
const SIN_PERMISO_PROPUESTA = { ok: false as const, error: "Sólo el dueño o un administrador pueden configurar los presupuestos." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 *
 * A diferencia de Configuración → Consultas, NO exige el módulo `quotes` encendido: los ajustes
 * se pueden dejar listos antes de encenderlo (revisión de la Task 3).
 */
async function contexto(): Promise<CtxPresupuestos | null> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function texto(fd: FormData, nombre: string): string | null {
  const v = fd.get(nombre);
  return typeof v === "string" ? v : null;
}

/** Validez, condiciones, propuesta de pago y seguimiento. `guardarAjustes` valida rangos y largos. */
export async function guardarAjustesPresupuestosAction(
  _prev: EstadoPresupuestosConfig | undefined,
  fd: FormData,
): Promise<EstadoPresupuestosConfig> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const validezDias = texto(fd, "validez");
  const seguimientoDias = texto(fd, "seguimiento");
  if (validezDias === null || seguimientoDias === null) return DATOS_INVALIDOS;
  const r = await guardarAjustes(ctx, {
    validezDias,
    condiciones: texto(fd, "condiciones"),
    propuestaPago: texto(fd, "propuestaPago"),
    seguimientoDias,
    seguimientoActivo: fd.get("seguimientoActivo") === "1",
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Ajustes guardados." };
}

/** Resultado de las acciones de la propuesta modelo (el editor las llama con datos, no con un formulario). */
export type ResultadoPropuestaModeloAction = { ok: true } | { ok: false; error: string };

/**
 * Guarda la propuesta modelo de una categoría. `guardarPropuestaModelo` valida todo: categoría y
 * plantilla del workspace, productos activos del catálogo en modo lista, topes y textos.
 */
export async function guardarPropuestaModeloAction(datos: {
  categoriaId: unknown;
  items: unknown;
  condiciones?: unknown;
  enviarSola?: unknown;
  plantillaId?: unknown;
}): Promise<ResultadoPropuestaModeloAction> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO_PROPUESTA;
  if (!datos || typeof datos !== "object") return { ok: false, error: "Los datos no son válidos." };
  const r = await guardarPropuestaModelo(ctx, {
    categoriaId: datos.categoriaId,
    items: datos.items,
    condiciones: datos.condiciones,
    enviarSola: datos.enviarSola,
    plantillaId: datos.plantillaId,
  });
  if (!r.ok) return r;
  revalidatePath(RUTA_PROPUESTAS, "layout");
  return { ok: true };
}

/** Borra la propuesta modelo de una categoría. */
export async function borrarPropuestaModeloAction(categoriaId: unknown): Promise<ResultadoPropuestaModeloAction> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO_PROPUESTA;
  const r = await borrarPropuestaModelo(ctx, categoriaId);
  if (!r.ok) return r;
  revalidatePath(RUTA_PROPUESTAS, "layout");
  return { ok: true };
}

/** Enciende o apaga el borrador automático de una categoría (la casilla del editor de la propuesta). */
export async function guardarBorradorAutoAction(categoriaId: unknown, encendido: unknown): Promise<ResultadoPropuestaModeloAction> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO_PROPUESTA;
  const r = await guardarBorradorAuto(ctx, categoriaId, encendido);
  if (!r.ok) return r;
  revalidatePath(RUTA_PROPUESTAS, "layout");
  return { ok: true };
}
