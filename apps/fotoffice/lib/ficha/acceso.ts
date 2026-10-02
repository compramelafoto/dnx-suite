import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { resolverPersonaPorCliente, resolverPersonaPorSocio, type PersonaRef } from "./persona";

export type PersonaPedida = { tipo: "CLIENTE" | "SOCIO"; id: string };

export type ContextoFicha = {
  workspaceId: string;
  /** Slug público del workspace ("" si no tiene). Decide las categorías iniciales de notas. */
  workspaceSlug: string;
  userId: number;
  userLabel: string;
  role: string | null;
  persona: PersonaRef;
};

const MODULO_POR_TIPO = {
  CLIENTE: CLIENTS_MODULE_KEY,
  SOCIO: MEMBERS_MODULE_KEY,
} as const;

/**
 * Guarda común de las acciones de la ficha: sesión, workspace activo, módulo encendido,
 * rol con `operar` y persona del mismo workspace. Devuelve null ante cualquier falta, sin
 * distinguir el motivo y sin redirigir. El `workspaceId` sale siempre de la sesión.
 */
export async function contextoDeFicha(persona: PersonaPedida): Promise<ContextoFicha | null> {
  if (!persona || typeof persona !== "object") return null;
  const { tipo, id } = persona;
  if (typeof tipo !== "string" || !Object.hasOwn(MODULO_POR_TIPO, tipo)) return null;
  if (typeof id !== "string" || id.length === 0 || id.length > 100) return null;

  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, MODULO_POR_TIPO[tipo]))) return null;
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "operar")) return null;

  const ref =
    tipo === "CLIENTE"
      ? await resolverPersonaPorCliente(workspace.id, id)
      : await resolverPersonaPorSocio(workspace.id, id);
  if (!ref) return null;

  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });

  return {
    workspaceId: workspace.id,
    workspaceSlug: branding?.publicSlug ?? "",
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
    persona: ref,
  };
}

export type ContextoBusqueda = { workspaceId: string; clientes: boolean; socios: boolean };

/**
 * Guarda de la búsqueda de personas para vincular (sin persona de partida): sesión,
 * workspace activo y rol con `operar`. Sólo se busca en los módulos encendidos. Devuelve
 * null si no puede buscar en ninguno.
 */
export async function contextoDeBusquedaDePersonas(): Promise<ContextoBusqueda | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "operar")) return null;
  const clientes = await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY);
  const socios = await isModuleEnabledForWorkspace(workspace.id, MEMBERS_MODULE_KEY);
  if (!clientes && !socios) return null;
  return { workspaceId: workspace.id, clientes, socios };
}
