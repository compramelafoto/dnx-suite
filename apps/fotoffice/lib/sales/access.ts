import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { SALES_CATALOG_ACTION } from "@/lib/permissions/actions";
import { SALES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder un link del menú es cosmético, nunca control.
 *
 * - MANAGE: vender, cargar stock y anular. Es lo que hace el mostrador todo el día, y exigir
 *   un administrador para cobrar sería absurdo. El STAFF de antes (sin roles) queda acá por la
 *   compatibilidad de `levels.ts`.
 * - MANAGE + `sales.catalog`: dar de alta un producto, tocar su precio o su costo. Cambia lo que
 *   se cobra y el margen del negocio entero. Dueño y admin la tienen siempre; el STAFF de antes,
 *   nunca (igual que cuando esto exigía ADMIN+).
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, tieneAccion] = await Promise.all([
    getModuleLevel(user.id, workspace.id, SALES_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, SALES_MODULE_KEY, SALES_CATALOG_ACTION),
  ]);
  if (!hasLevel(level, "MANAGE")) redirect("/dashboard");
  const canEditCatalog = tieneAccion;
  return { user, workspace, level, canEditCatalog };
}

export async function requireSalesStaff() {
  return contextoBase();
}

export async function requireSalesAdmin() {
  const ctx = await contextoBase();
  // "/ventas/catalogo" es donde puede estar quien vende pero no edita el catálogo.
  if (!ctx.canEditCatalog) redirect("/ventas/catalogo");
  return ctx;
}
