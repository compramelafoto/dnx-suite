import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { RAFFLES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Ver la lista y entregar premios pide VIEW. Crear, anunciar, sellar, resolver y cancelar pide
 * MANAGE: son los actos que definen el resultado, y quien los hace queda con nombre y apellido
 * en la historia del sorteo.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, RAFFLES_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  return { user, workspace, level };
}

/** Ver los sorteos y entregar premios. */
export async function requireRafflesStaff() {
  return contextoBase();
}

/** Crear, anunciar, sellar, resolver, cancelar. */
export async function requireRafflesAdmin() {
  const ctx = await contextoBase();
  if (!hasLevel(ctx.level, "MANAGE")) redirect("/sorteos");
  return ctx;
}
