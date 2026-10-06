import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { BOOKINGS_CONFIGURE_ACTION } from "@/lib/permissions/actions";
import { BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Tres escalones:
 * - VIEW: ver la agenda y la lista de reservas. Es lo que promete la grilla de la Comisión
 *   directiva para "Ver": mirar sin tocar.
 * - MANAGE: operar — cargar una reserva por teléfono, cancelar, aprobar, rechazar y confirmar
 *   una transferencia. El STAFF de antes (sin roles) queda acá por la compatibilidad de `levels.ts`.
 * - MANAGE + `bookings.configure`: espacios, extras, tarifas y reglas. Dueño y admin la tienen
 *   siempre; el STAFF de antes, nunca (igual que hoy).
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, tieneAccion] = await Promise.all([
    getModuleLevel(user.id, workspace.id, BOOKINGS_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, BOOKINGS_MODULE_KEY, BOOKINGS_CONFIGURE_ACTION),
  ]);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  const canOperate = hasLevel(level, "MANAGE");
  // La acción sólo vale con MANAGE: `resolveModuleAction` ya lo exige, esto lo repite por las dudas.
  const canConfigure = canOperate && tieneAccion;
  return { user, workspace, level, canOperate, canConfigure };
}

/** Ver: layout, agenda y lista. */
export async function requireBookingsViewer() {
  return contextoBase();
}

/** Operar: cargar, cancelar, aprobar, rechazar y confirmar transferencias. */
export async function requireBookingsOperator() {
  const ctx = await contextoBase();
  if (!ctx.canOperate) redirect("/reservas");
  return ctx;
}

/** Configurar: espacios, extras, tarifas, reglas, cierres y calendario de cada espacio. */
export async function requireBookingsConfigurer() {
  const ctx = await contextoBase();
  if (!ctx.canConfigure) redirect("/reservas");
  return ctx;
}
