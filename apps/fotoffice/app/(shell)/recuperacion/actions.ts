"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { MAX_NOTAS, MAX_TITULO, RECUPERACION_PANEL_ROUTE } from "@/lib/recuperacion/constantes";
import { borrarCaso, crearCaso } from "@/lib/recuperacion/casos";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Abrir y borrar casos es de quien vende (MANAGE en Ventas), igual que el resto del mostrador. */
async function contexto() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return null;
  const nivel = await getModuleLevel(user.id, workspace.id, SALES_MODULE_KEY);
  if (!hasLevel(nivel, "MANAGE")) return null;
  return { user, workspace };
}

export async function crearCasoAction(titulo: string, notas: string): Promise<Resultado<{ id: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, error: "No tenés permiso para abrir casos de recuperación." };
  const t = titulo.trim().slice(0, MAX_TITULO);
  if (!t) return { ok: false, error: "Poné un nombre para el caso (por ejemplo, el del cliente)." };
  try {
    const caso = await crearCaso({ workspaceId: ctx.workspace.id, userId: ctx.user.id, titulo: t, notas: notas.trim().slice(0, MAX_NOTAS) || null });
    revalidatePath(RECUPERACION_PANEL_ROUTE);
    return { ok: true, id: caso.id };
  } catch {
    return { ok: false, error: "No se pudo abrir el caso. Probá de nuevo en un rato." };
  }
}

export async function borrarCasoAction(id: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, error: "No tenés permiso para borrar casos de recuperación." };
  try {
    const ok = await borrarCaso(ctx.workspace.id, id);
    if (!ok) return { ok: false, error: "Ese caso ya no existe." };
    revalidatePath(RECUPERACION_PANEL_ROUTE);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo borrar el caso. Probá de nuevo en un rato." };
  }
}
