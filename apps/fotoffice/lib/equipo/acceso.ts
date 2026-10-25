import "server-only";
import { redirect } from "next/navigation";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { puede } from "@/lib/access/policy";
import { EQUIPO_MODULE_KEY } from "./constantes";

/**
 * Acceso al panel Equipo: sesión, espacio activo, módulo `equipo` encendido y ser dueño o
 * administrador (`puede(rol, "configurar")`, la misma regla que Configuración). Las empleadas (STAFF) nunca entran: ni con un
 * rol de la comisión, porque acá se ven horarios, jornadas y correcciones de cada una.
 */
export type CtxEquipo = { workspaceId: string; userId: number };

/** Guarda de las pantallas: redirige como el resto de los módulos. */
export async function requireEquipo(): Promise<CtxEquipo> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, EQUIPO_MODULE_KEY))) redirect("/dashboard?module=off");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "configurar")) redirect("/dashboard");
  return { workspaceId: workspace.id, userId: user.id };
}

/** Para las acciones del panel: null ante cualquier falta, sin decir el motivo. */
export async function contextoEquipo(): Promise<CtxEquipo | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, EQUIPO_MODULE_KEY))) return null;
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id };
}

/**
 * Para lo que ve cualquier persona del equipo (saludos, aviso de salida, pase de turno): sesión,
 * espacio activo y módulo encendido. No pide rol: cada pieza decide después si la persona tiene
 * ficha activa.
 */
export async function contextoPersonal(): Promise<CtxEquipo | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, EQUIPO_MODULE_KEY))) return null;
  return { workspaceId: workspace.id, userId: user.id };
}
