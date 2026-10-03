import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { CASH_CONFIGURE_ACTION } from "@/lib/permissions/actions";
import { CASH_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Tres escalones:
 * - VIEW: ver el panorama, el libro, los turnos, los pases y los reportes.
 * - MANAGE: operar — abrir y cerrar turno, cargar y anular movimientos, hacer pases. Un negocio
 *   con empleados de mostrador no puede exigir que el dueño abra la caja todas las mañanas, y el
 *   arqueo ya deja registrado quién abrió y quién cerró. El STAFF de antes (sin roles) queda acá
 *   por la compatibilidad de `levels.ts`.
 * - MANAGE + `cash.configure`: cuentas, categorías y la siembra inicial. Son la configuración de
 *   la que dependen todos los reportes, y equivocarla es más caro de deshacer que un arqueo.
 *   Dueño y admin la tienen siempre; el STAFF de antes, nunca (igual que hoy).
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, tieneAccion] = await Promise.all([
    getModuleLevel(user.id, workspace.id, CASH_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, CASH_MODULE_KEY, CASH_CONFIGURE_ACTION),
  ]);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  const canOperate = hasLevel(level, "MANAGE");
  // La acción sólo vale con MANAGE: `resolveModuleAction` ya lo exige, esto lo repite por las dudas.
  const canConfigure = canOperate && tieneAccion;
  return { user, workspace, level, canOperate, canConfigure };
}

/** Ver: layout y pantallas de consulta. */
export async function requireCashViewer() {
  return contextoBase();
}

/** Operar: turnos, movimientos, anulaciones y pases. */
export async function requireCashOperator() {
  const ctx = await contextoBase();
  if (!ctx.canOperate) redirect("/caja");
  return ctx;
}

/** Configurar: cuentas, categorías, sembrar Caja y `/caja/configuracion`. */
export async function requireCashConfigurer() {
  const ctx = await contextoBase();
  if (!ctx.canConfigure) redirect("/caja");
  return ctx;
}
