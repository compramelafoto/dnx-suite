"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { MAX_NOMBRE_CATALOGO, type CtxConsultas } from "@/lib/consultas/catalogo";
import {
  archivarCategoria,
  borrarCategoria,
  crearCategoria,
  desarchivarCategoria,
  editarCategoria,
  reordenarCategorias,
} from "@/lib/consultas/categorias";
import { archivarOrigen, borrarOrigen, crearOrigen, desarchivarOrigen, editarOrigen, reordenarOrigenes } from "@/lib/consultas/origenes";
import { archivarRol, borrarRol, crearRol, desarchivarRol, editarRol, reordenarRoles } from "@/lib/consultas/participantes";
import { guardarAjustes } from "@/lib/consultas/ajustes";

/** Estado de cada formulario de Configuración → Consultas (`useActionState`). */
export type EstadoConsultasConfig = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/consultas";
const SIN_PERMISO: EstadoConsultasConfig = { error: "Sólo el dueño o un administrador pueden configurar las consultas." };
const DATOS_INVALIDOS: EstadoConsultasConfig = { error: "Los datos no son válidos." };
const MODULO_APAGADO: EstadoConsultasConfig = { error: "El módulo Consultas no está activo." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada; con Consultas apagado, tampoco.
 */
async function contexto(): Promise<CtxConsultas | "SIN_PERMISO" | "APAGADO"> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return "SIN_PERMISO";
  if (!(await isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY))) return "APAGADO";
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function campo(fd: FormData, nombre: string, max = 100): string | null {
  const v = fd.get(nombre);
  if (typeof v !== "string" || v.length === 0 || v.length > max) return null;
  return v;
}

/** Texto libre: "" si no vino; el catálogo decide si es válido. */
function texto(fd: FormData, nombre: string, max = MAX_NOMBRE_CATALOGO): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.slice(0, max + 1) : "";
}

function ids(fd: FormData, nombre: string, max = 1000): string[] | null {
  const v = fd.getAll(nombre);
  if (v.length > max || v.some((x) => typeof x !== "string" || x.length === 0 || x.length > 100)) return null;
  return v as string[];
}

type Catalogo = "categorias" | "origenes" | "roles";
const esCatalogo = (v: unknown): v is Catalogo => v === "categorias" || v === "origenes" || v === "roles";

const OPERACIONES = {
  categorias: {
    crear: crearCategoria, editar: editarCategoria, reordenar: reordenarCategorias,
    archivar: archivarCategoria, desarchivar: desarchivarCategoria, borrar: borrarCategoria,
  },
  origenes: {
    crear: crearOrigen, editar: editarOrigen, reordenar: reordenarOrigenes,
    archivar: archivarOrigen, desarchivar: desarchivarOrigen, borrar: borrarOrigen,
  },
  roles: {
    crear: crearRol, editar: editarRol, reordenar: reordenarRoles,
    archivar: archivarRol, desarchivar: desarchivarRol, borrar: borrarRol,
  },
} as const;

function resultado(r: { ok: true } | { ok: false; error: string }, ok: string): EstadoConsultasConfig {
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok };
}

function rechazo(ctx: "SIN_PERMISO" | "APAGADO"): EstadoConsultasConfig {
  return ctx === "SIN_PERMISO" ? SIN_PERMISO : MODULO_APAGADO;
}

// ─── Catálogos ───────────────────────────────────────────────────────────────

export async function crearItemAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const catalogo = fd.get("catalogo");
  if (!esCatalogo(catalogo)) return DATOS_INVALIDOS;
  const nombre = texto(fd, "nombre");
  const r =
    catalogo === "categorias"
      ? await crearCategoria(ctx, { nombre, grupo: texto(fd, "grupo", 30) })
      : await OPERACIONES[catalogo].crear(ctx, { nombre });
  return resultado(r, "Agregado.");
}

/** Nombre y, en categorías, grupo (sólo si vino: el selector de una categoría usada va bloqueado). */
export async function editarItemAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const catalogo = fd.get("catalogo");
  const id = campo(fd, "id");
  if (!esCatalogo(catalogo) || id === null) return DATOS_INVALIDOS;
  const nombre = texto(fd, "nombre");
  const grupo = fd.get("grupo");
  const r =
    catalogo === "categorias"
      ? await editarCategoria(ctx, id, { nombre, ...(typeof grupo === "string" ? { grupo } : {}) })
      : await OPERACIONES[catalogo].editar(ctx, id, { nombre });
  return resultado(r, "Cambios guardados.");
}

/** `orden` trae todos los activos del catálogo, en el orden nuevo. */
export async function reordenarAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const catalogo = fd.get("catalogo");
  const orden = ids(fd, "orden");
  if (!esCatalogo(catalogo) || orden === null) return DATOS_INVALIDOS;
  return resultado(await OPERACIONES[catalogo].reordenar(ctx, orden), "Orden guardado.");
}

export async function archivarItemAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const catalogo = fd.get("catalogo");
  const id = campo(fd, "id");
  if (!esCatalogo(catalogo) || id === null) return DATOS_INVALIDOS;
  return resultado(await OPERACIONES[catalogo].archivar(ctx, id), "Archivado.");
}

export async function desarchivarItemAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const catalogo = fd.get("catalogo");
  const id = campo(fd, "id");
  if (!esCatalogo(catalogo) || id === null) return DATOS_INVALIDOS;
  return resultado(await OPERACIONES[catalogo].desarchivar(ctx, id), "Desarchivado.");
}

/** Sólo si nunca se usó: el catálogo lo vuelve a comprobar dentro de la transacción. */
export async function borrarItemAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const catalogo = fd.get("catalogo");
  const id = campo(fd, "id");
  if (!esCatalogo(catalogo) || id === null) return DATOS_INVALIDOS;
  return resultado(await OPERACIONES[catalogo].borrar(ctx, id), "Borrado.");
}

// ─── Avisos ──────────────────────────────────────────────────────────────────

/** Responsable ("" = el dueño), correo y tarea. El responsable se valida contra el equipo. */
export async function guardarAvisosAction(_prev: EstadoConsultasConfig | undefined, fd: FormData): Promise<EstadoConsultasConfig> {
  const ctx = await contexto();
  if (typeof ctx === "string") return rechazo(ctx);
  const crudo = fd.get("responsable");
  if (crudo !== null && typeof crudo !== "string") return DATOS_INVALIDOS;
  let responsableUserId: number | null = null;
  if (crudo) {
    if (!/^\d{1,9}$/.test(crudo)) return DATOS_INVALIDOS;
    responsableUserId = Number(crudo);
  }
  return resultado(
    await guardarAjustes(ctx, {
      responsableUserId,
      notificarCorreo: fd.get("correo") === "1",
      crearTarea: fd.get("tarea") === "1",
    }),
    "Avisos guardados.",
  );
}
