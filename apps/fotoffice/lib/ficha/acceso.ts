import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede, type AccesoEfectivo } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
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
  /** Acceso efectivo (modelo de main); `operar` se mide sobre `modulo`. */
  acceso?: AccesoEfectivo;
  modulo?: string;
  persona: PersonaRef;
};

const MODULO_POR_TIPO = {
  CLIENTE: CLIENTS_MODULE_KEY,
  SOCIO: MEMBERS_MODULE_KEY,
} as const;

/**
 * Guarda común de las acciones de la ficha: sesión, workspace activo, módulo encendido,
 * `operar` (nivel "Gestionar") en el módulo de la persona —Clientes o Socios— y persona del
 * mismo workspace. Con sólo "Ver" no hay historia: es lo que main ya hacía con la auditoría
 * del socio, que sólo veía quien gestiona. Devuelve null ante cualquier falta, sin
 * distinguir el motivo y sin redirigir. El `workspaceId` sale siempre de la sesión.
 */
export async function contextoDeFicha(persona: PersonaPedida): Promise<ContextoFicha | null> {
  return resolverContextoDeFicha(persona, "operar");
}

/**
 * Sólo para LEER las notas (Observaciones) con nivel "Ver" en el módulo de la persona: en main,
 * quien ve un socio o un cliente ve sus observaciones. No sirve para ninguna acción (crear,
 * editar, borrar, fijar, adjuntos, etiquetas, relaciones ni "Ver más"): esas usan
 * `contextoDeFicha`, que exige "Gestionar".
 */
export async function contextoDeLecturaDeNotas(persona: PersonaPedida): Promise<ContextoFicha | null> {
  return resolverContextoDeFicha(persona, "ver");
}

async function resolverContextoDeFicha(persona: PersonaPedida, capacidad: "operar" | "ver"): Promise<ContextoFicha | null> {
  if (!persona || typeof persona !== "object") return null;
  const { tipo, id } = persona;
  if (typeof tipo !== "string" || !Object.hasOwn(MODULO_POR_TIPO, tipo)) return null;
  if (typeof id !== "string" || id.length === 0 || id.length > 100) return null;

  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const modulo = MODULO_POR_TIPO[tipo];
  if (!(await isModuleEnabledForWorkspace(workspace.id, modulo))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, capacidad, modulo)) return null;

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
    role: acceso.role,
    acceso,
    modulo,
    persona: ref,
  };
}

export type ContextoBusqueda = { workspaceId: string; clientes: boolean; socios: boolean };

/**
 * Guarda de la búsqueda de personas para vincular (sin persona de partida): sesión,
 * workspace activo y `operar` en Clientes o en Socios. Sólo se busca en los módulos encendidos
 * donde además tiene nivel "Ver". Devuelve null si no puede buscar en ninguno.
 */
export async function contextoDeBusquedaDePersonas(): Promise<ContextoBusqueda | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "operar", [CLIENTS_MODULE_KEY, MEMBERS_MODULE_KEY])) return null;
  const clientes =
    puede(acceso, "ver", CLIENTS_MODULE_KEY) && (await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY));
  const socios =
    puede(acceso, "ver", MEMBERS_MODULE_KEY) && (await isModuleEnabledForWorkspace(workspace.id, MEMBERS_MODULE_KEY));
  if (!clientes && !socios) return null;
  return { workspaceId: workspace.id, clientes, socios };
}
