import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { STORE_CONFIGURE_ACTION } from "@/lib/permissions/actions";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "./constants";

/**
 * Control de acceso de la tienda online, siempre en el servidor. Mismo patrón que
 * `lib/cash/access.ts`: el nivel sale de `getModuleLevel`, que ya incluye si el módulo está
 * encendido para ESE workspace y qué rol tiene la persona.
 *
 * - MANAGE en `store`: operar los pedidos online (preparar, entregar, cancelar).
 * - MANAGE + `store.configure`: abrir o cerrar la tienda, el retiro, las políticas y los avisos.
 *
 * La tienda vende el catálogo y el stock de Ventas, así que sin Ventas no hay tienda. El
 * registro de módulos no tiene un campo de dependencias: la regla se hace cumplir acá, mirando
 * el nivel en `sales` (NONE = Ventas apagado para el workspace o sin acceso para la persona).
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, nivelVentas, tieneAccion] = await Promise.all([
    getModuleLevel(user.id, workspace.id, STORE_MODULE_KEY),
    getModuleLevel(user.id, workspace.id, SALES_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, STORE_MODULE_KEY, STORE_CONFIGURE_ACTION),
  ]);
  if (!hasLevel(level, "MANAGE") || !hasLevel(nivelVentas, "VIEW")) redirect("/dashboard");
  // La acción sólo vale con MANAGE: `resolveModuleAction` ya lo exige, esto lo repite por las dudas.
  const canConfigure = tieneAccion;
  return { user, workspace, canConfigure };
}

/** Operar: los pedidos online. */
export async function requireStoreOperator() {
  return contextoBase();
}

/** Configurar: `/ventas/tienda/configuracion` y su acción. */
export async function requireStoreConfigurer() {
  const ctx = await contextoBase();
  if (!ctx.canConfigure) redirect("/ventas/tienda");
  return ctx;
}
