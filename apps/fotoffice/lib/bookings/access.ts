import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Agenda pide VIEW; Espacios, Extras y Tarifas piden MANAGE.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, BOOKINGS_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  return { user, workspace, level };
}

/** Ver la agenda. */
export async function requireBookingsStaff() {
  return contextoBase();
}

/** Configurar espacios, extras y tarifas. */
export async function requireBookingsAdmin() {
  const ctx = await contextoBase();
  if (!hasLevel(ctx.level, "MANAGE")) redirect("/reservas");
  return ctx;
}
