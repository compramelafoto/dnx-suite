"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import {
  activarCategoria,
  crearCategoria,
  desactivarCategoria,
  moverCategoria,
  renombrarCategoria,
} from "@/lib/ficha/categorias";
import { borrarEtiqueta, cambiarColor, renombrarEtiqueta, unirEtiquetas } from "@/lib/ficha/etiquetas";

/** Estado de cada formulario de Configuración → Ficha (`useActionState`). */
export type EstadoCatalogo = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/ficha";
const SIN_PERMISO: EstadoCatalogo = { error: "Sólo el dueño o un administrador pueden cambiar la ficha." };
const DATOS_INVALIDOS: EstadoCatalogo = { error: "Los datos no son válidos." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 */
async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function campo(fd: FormData, nombre: string, max = 200): string | null {
  const v = fd.get(nombre);
  if (typeof v !== "string" || v.length === 0 || v.length > max) return null;
  return v;
}

function resultado(r: { ok: true } | { ok: false; error: string }, ok: string): EstadoCatalogo {
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok };
}

// ─── Categorías de notas ─────────────────────────────────────────────────────

export async function crearCategoriaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const nombre = campo(fd, "nombre");
  if (nombre === null) return { error: "Escribí un nombre de hasta 40 caracteres." };
  return resultado(await crearCategoria(ctx, nombre), "Categoría agregada.");
}

export async function renombrarCategoriaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const nombre = campo(fd, "nombre");
  if (id === null) return DATOS_INVALIDOS;
  if (nombre === null) return { error: "Escribí un nombre de hasta 40 caracteres." };
  return resultado(await renombrarCategoria(ctx, id, nombre), "Nombre guardado.");
}

export async function moverCategoriaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const hacia = fd.get("hacia");
  if (id === null || (hacia !== "subir" && hacia !== "bajar")) return DATOS_INVALIDOS;
  return resultado(await moverCategoria(ctx, id, hacia), "Orden guardado.");
}

export async function desactivarCategoriaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await desactivarCategoria(ctx, id), "Categoría desactivada.");
}

export async function activarCategoriaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await activarCategoria(ctx, id), "Categoría activada.");
}

// ─── Etiquetas ───────────────────────────────────────────────────────────────

export async function renombrarEtiquetaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const nombre = campo(fd, "nombre");
  if (id === null) return DATOS_INVALIDOS;
  if (nombre === null) return { error: "Escribí un nombre de hasta 40 caracteres." };
  return resultado(await renombrarEtiqueta(ctx, id, nombre), "Nombre guardado.");
}

export async function colorEtiquetaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  const color = campo(fd, "color", 20);
  if (id === null || color === null) return DATOS_INVALIDOS;
  return resultado(await cambiarColor(ctx, id, color), "Color guardado.");
}

export async function unirEtiquetasAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const origen = campo(fd, "origenId", 100);
  const destino = campo(fd, "destinoId", 100);
  if (origen === null) return DATOS_INVALIDOS;
  if (destino === null) return { error: "Elegí con qué etiqueta unirla." };
  return resultado(await unirEtiquetas(ctx, origen, destino), "Etiquetas unidas.");
}

export async function borrarEtiquetaAction(_prev: EstadoCatalogo | undefined, fd: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id", 100);
  if (id === null) return DATOS_INVALIDOS;
  return resultado(await borrarEtiqueta(ctx, id), "Etiqueta borrada.");
}
