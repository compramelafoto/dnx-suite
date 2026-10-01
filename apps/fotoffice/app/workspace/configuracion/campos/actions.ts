"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { MAX_NOMBRE_CAMPO } from "@/lib/campos/constantes";
import {
  archivarCampo,
  archivarOpcion,
  borrarCampo,
  crearCampo,
  crearOpcion,
  desarchivarCampo,
  editarCampo,
  renombrarOpcion,
  reordenarCampos,
  reordenarOpciones,
} from "@/lib/campos/definiciones";

/** Estado de cada formulario de Configuración → Campos (`useActionState`). */
export type EstadoCampos = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/campos";
const SIN_PERMISO: EstadoCampos = { error: "Sólo el dueño o un administrador pueden configurar los campos." };
const DATOS_INVALIDOS: EstadoCampos = { error: "Los datos no son válidos." };
const MODULO_APAGADO: EstadoCampos = { error: "Ese módulo no está activo." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 */
async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function campo(fd: FormData, nombre: string, max = 100): string | null {
  const v = fd.get(nombre);
  if (typeof v !== "string" || v.length === 0 || v.length > max) return null;
  return v;
}

/** Texto libre: "" si no vino; el catálogo decide si es válido. */
function texto(fd: FormData, nombre: string, max = MAX_NOMBRE_CAMPO): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.slice(0, max + 1) : "";
}

const casilla = (fd: FormData, nombre: string) => fd.get(nombre) === "1";

function ids(fd: FormData, nombre: string, max = 500): string[] | null {
  const v = fd.getAll(nombre);
  if (v.length > max || v.some((x) => typeof x !== "string" || x.length === 0 || x.length > 100)) return null;
  return v as string[];
}

/** Las consultas sólo se configuran con Captación encendida (como su pestaña). */
async function moduloApagado(workspaceId: string, entityType: string): Promise<boolean> {
  return entityType === "CONSULTA" && !(await isModuleEnabledForWorkspace(workspaceId, SERVICE_LEADS_MODULE_KEY));
}

function resultado(r: { ok: true } | { ok: false; error: string }, ok: string): EstadoCampos {
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok };
}

// ─── Campos ──────────────────────────────────────────────────────────────────

export async function crearCampoAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const entityType = campo(fd, "entityType", 20);
  if (entityType === null) return DATOS_INVALIDOS;
  if (await moduloApagado(ctx.workspaceId, entityType)) return MODULO_APAGADO;
  const tipo = texto(fd, "tipo", 20);
  // Opciones de Lista: una por renglón; los renglones vacíos no cuentan.
  const opciones = tipo === "LISTA"
    ? texto(fd, "opciones", 20_000).split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0)
    : undefined;
  return resultado(
    await crearCampo(ctx, entityType, {
      nombre: texto(fd, "nombre"),
      tipo,
      obligatorio: casilla(fd, "obligatorio"),
      enListado: casilla(fd, "enListado"),
      opciones,
    }),
    "Campo agregado.",
  );
}

export async function editarCampoAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  return resultado(
    await editarCampo(ctx, id, {
      nombre: texto(fd, "nombre"),
      tipo: texto(fd, "tipo", 20),
      obligatorio: casilla(fd, "obligatorio"),
      enListado: casilla(fd, "enListado"),
    }),
    "Cambios guardados.",
  );
}

/** `orden` trae todos los campos activos del tipo, en el orden nuevo. */
export async function reordenarCamposAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const entityType = campo(fd, "entityType", 20);
  const orden = ids(fd, "orden");
  if (entityType === null || orden === null) return DATOS_INVALIDOS;
  if (await moduloApagado(ctx.workspaceId, entityType)) return MODULO_APAGADO;
  return resultado(await reordenarCampos(ctx, entityType, orden), "Orden guardado.");
}

export async function archivarCampoAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await archivarCampo(ctx, id), "Campo archivado.");
}

export async function desarchivarCampoAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await desarchivarCampo(ctx, id), "Campo desarchivado.");
}

export async function borrarCampoAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await borrarCampo(ctx, id), "Campo borrado.");
}

// ─── Opciones de Lista ───────────────────────────────────────────────────────

export async function crearOpcionAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const campoId = campo(fd, "campoId");
  if (campoId === null) return DATOS_INVALIDOS;
  return resultado(await crearOpcion(ctx, campoId, texto(fd, "etiqueta")), "Opción agregada.");
}

export async function renombrarOpcionAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await renombrarOpcion(ctx, id, texto(fd, "etiqueta")), "Opción guardada.");
}

export async function archivarOpcionAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await archivarOpcion(ctx, id), "Opción archivada.");
}

/** `orden` trae todas las opciones activas del campo, en el orden nuevo. */
export async function reordenarOpcionesAction(_prev: EstadoCampos | undefined, fd: FormData): Promise<EstadoCampos> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const campoId = campo(fd, "campoId");
  const orden = ids(fd, "orden", 200);
  if (campoId === null || orden === null) return DATOS_INVALIDOS;
  return resultado(await reordenarOpciones(ctx, campoId, orden), "Orden guardado.");
}
