"use server";

import { revalidatePath } from "next/cache";
import { resolvePortfolioAdminContext } from "@/lib/portfolio/admin-access";
import { borrarRubro, crearRubro, editarRubro, moverRubro } from "@/lib/portfolio-estudio/repositorio";
import type { Enlace } from "@/lib/portfolio-estudio/reglas";

/**
 * Administrar los rubros de Portfolios → Del estudio (spec 2026-11-15). Pide `portfolio` MANAGE
 * antes de leer nada; el workspace sale de la sesión. Etiquetar un trabajo va por
 * `guardarTrabajoAction` (quien edita el sitio).
 */

export type AccionRubro = { ok: true } | { ok: false; error: string };

const SIN_PERMISO: AccionRubro = { ok: false, error: "No tenés permiso para administrar los rubros." };

async function ejecutar(que: string, fn: (workspaceId: string) => Promise<{ ok: boolean; error?: string }>): Promise<AccionRubro> {
  const ctx = await resolvePortfolioAdminContext();
  if (!ctx) return SIN_PERMISO;
  try {
    const r = await fn(ctx.workspace.id);
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo guardar." };
    revalidatePath("/portfolios");
    return { ok: true };
  } catch (err) {
    console.error(`[fotoffice][portfolio-estudio] no se pudo ${que}:`, err);
    return { ok: false, error: "Algo falló al guardar. Probá de nuevo." };
  }
}

export async function crearRubroAction(nombre: string): Promise<AccionRubro> {
  return ejecutar("crear el rubro", (ws) => crearRubro(ws, nombre));
}

export async function editarRubroAction(id: string, datos: { nombre?: string; enlaces?: Enlace[] }): Promise<AccionRubro> {
  return ejecutar("editar el rubro", (ws) => editarRubro(ws, String(id), { nombre: datos?.nombre, enlaces: datos?.enlaces }));
}

export async function moverRubroAction(id: string, hacia: -1 | 1): Promise<AccionRubro> {
  const ctx = await resolvePortfolioAdminContext();
  if (!ctx) return SIN_PERMISO;
  if (hacia !== -1 && hacia !== 1) return { ok: false, error: "Movimiento inválido." };
  return ejecutar("mover el rubro", (ws) => moverRubro(ws, String(id), hacia));
}

export async function borrarRubroAction(id: string): Promise<AccionRubro> {
  return ejecutar("borrar el rubro", (ws) => borrarRubro(ws, String(id)));
}
