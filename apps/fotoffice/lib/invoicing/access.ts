import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede, type AccesoEfectivo } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { INVOICING_MODULE_KEY } from "./constants";
import type { Ctx } from "./servicio";

/**
 * Quién puede qué en Facturación. Siempre en el servidor, y el workspace sale de la sesión.
 *
 * - Configurar (datos fiscales, certificado, ambiente): dueño o administrador.
 * - Emitir, conciliar y anular: «Gestionar» en el módulo (dueño y administrador lo tienen siempre;
 *   el resto, si se lo dan en Roles). Emitir es siempre una acción explícita de una persona.
 * - Ver la lista y bajar el PDF: «Ver».
 *
 * Con el módulo apagado no se consulta ninguna tabla de facturación: la migración puede no estar
 * aplicada todavía y una tabla que falta rompería la pantalla entera.
 */

export type ContextoFacturacion = {
  workspace: ActiveWorkspace;
  acceso: AccesoEfectivo;
  ctx: Ctx;
  puedeConfigurar: boolean;
  puedeEmitir: boolean;
};

/** Sin redirección: para las acciones y para saber si mostrar el botón «Facturar». */
export async function contextoFacturacion(): Promise<ContextoFacturacion | null> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, INVOICING_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "ver", INVOICING_MODULE_KEY) && !puede(acceso, "configurar")) return null;
  return {
    workspace,
    acceso,
    ctx: { workspaceId: workspace.id, actor: { userId: user.id, label: etiquetaDeUsuario(user) } },
    puedeConfigurar: puede(acceso, "configurar"),
    puedeEmitir: puede(acceso, "operar", INVOICING_MODULE_KEY),
  };
}

/** Para las pantallas: sin módulo o sin permiso, afuera. */
export async function requireFacturacion(nivel: "ver" | "emitir" | "configurar" = "ver"): Promise<ContextoFacturacion> {
  const c = await contextoFacturacion();
  if (!c) redirect("/dashboard?module=off");
  if (nivel === "emitir" && !c.puedeEmitir) redirect("/facturacion");
  if (nivel === "configurar" && !c.puedeConfigurar) redirect("/facturacion");
  return c;
}

/** ¿Mostrar «Facturar» en Ventas o Pedidos? Barato y sin tocar tablas de facturación si está apagado. */
export async function facturacionVisible(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, INVOICING_MODULE_KEY);
}
