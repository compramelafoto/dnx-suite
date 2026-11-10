"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { desconectar } from "@/lib/clf/conexion";
import { sincronizarEspacio } from "@/lib/clf/sincronizar";

const RUTA = "/workspace/configuracion/compramelafoto";
const SIN_PERMISO = { ok: false as const, error: "Sólo el dueño o un administrador pueden cambiar la conexión con CompraMeLaFoto." };

/** Sesión, workspace y rol salen de la sesión. Sin `configurar` (dueño o administrador) no se hace nada. */
async function contexto() {
  const { workspace, role } = await requireActiveWorkspaceRole();
  return puede(role, "configurar") ? workspace.id : null;
}

export async function desconectarClfAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await contexto();
  if (!ws) return SIN_PERMISO;
  await desconectar(ws);
  revalidatePath(RUTA);
  return { ok: true };
}

export async function sincronizarClfAhoraAction(): Promise<{ ok: true; nuevas: number } | { ok: false; error: string }> {
  const ws = await contexto();
  if (!ws) return SIN_PERMISO;
  const r = await sincronizarEspacio(ws);
  revalidatePath(RUTA);
  revalidatePath("/ventas-clf");
  return r.error ? { ok: false, error: r.error } : { ok: true, nuevas: r.nuevas };
}
