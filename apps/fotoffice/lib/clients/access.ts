import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { CLIENTS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Ver el padrón y la ficha pide VIEW. Crear, editar, desactivar y enlazar con un socio pide
 * MANAGE: desactivar es reversible y de bajo riesgo —no borra nada—, así que no necesita una
 * acción sensible aparte. El STAFF de antes (sin roles) queda con MANAGE por la compatibilidad
 * de `levels.ts`, igual que hoy.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  return { user, workspace, level, canEdit: hasLevel(level, "MANAGE") };
}

/** Ver el padrón y la ficha. */
export async function requireClientsViewer() {
  return contextoBase();
}

/** Crear, editar, desactivar y enlazar con un socio. */
export async function requireClientsEditor() {
  const ctx = await contextoBase();
  if (!ctx.canEdit) redirect("/clientes");
  return ctx;
}
