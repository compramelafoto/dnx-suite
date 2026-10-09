import "server-only";
import { redirect } from "next/navigation";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede, puedeEnContexto, type AccesoEfectivo } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { REPORTS_MODULE_KEY } from "./constantes";

/**
 * Acceso a Informes (etapa 6). Todo informe, CSV y acción exige, en este orden: sesión, workspace
 * activo, módulo `reports` encendido y `verDinero` sobre `reports` (dueño o administrador, o nivel
 * Ver en el módulo). Ajustes exige además `configurar` (dueño o administrador).
 */
export type CtxInformes = {
  workspaceId: string;
  userId: number;
  userLabel: string;
  role: string | null;
  acceso: AccesoEfectivo;
};

export const MENSAJES_INFORMES = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  minimo: "El saldo mínimo tiene que ser un importe de cero o más.",
  tope: "El tope anual tiene que ser un importe mayor a cero.",
  aviso: "El porcentaje de aviso tiene que ser un número entero entre 50 y 99.",
  categoria: "La categoría puede tener hasta 20 caracteres.",
  fallo: "No se pudo guardar. Probá de nuevo.",
} as const;

export function puedeVerInformes(ctx: Pick<CtxInformes, "role" | "acceso">): boolean {
  return puedeEnContexto(ctx, "verDinero", REPORTS_MODULE_KEY);
}

export function puedeConfigurarInformes(ctx: Pick<CtxInformes, "role" | "acceso">): boolean {
  return puedeVerInformes(ctx) && puedeEnContexto(ctx, "configurar");
}

/**
 * Guarda de las PANTALLAS: redirige como las de los otros módulos (sin sesión → ingreso; sin
 * workspace → /workspace; módulo apagado → /dashboard?module=off; sin permiso → /dashboard, o
 * /informes si falta sólo `configurar`).
 */
export async function requireInformes(): Promise<{ ctx: CtxInformes }> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, REPORTS_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "verDinero", REPORTS_MODULE_KEY)) redirect("/dashboard");
  return { ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso } };
}

/** Igual que `requireInformes` y además `configurar`. */
export async function requireInformesConfigurar(): Promise<{ ctx: CtxInformes }> {
  const r = await requireInformes();
  if (!puede(r.ctx.acceso, "configurar")) redirect("/informes");
  return r;
}

/**
 * Para las acciones y el CSV (que no redirigen): `null` ante cualquier falta, sin decir el motivo.
 */
export async function contextoDeInformes(nivel: "ver" | "configurar" = "ver"): Promise<CtxInformes | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, REPORTS_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "verDinero", REPORTS_MODULE_KEY)) return null;
  if (nivel === "configurar" && !puede(acceso, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
