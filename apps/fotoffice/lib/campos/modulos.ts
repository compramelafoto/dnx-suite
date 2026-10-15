import "server-only";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { TIPOS_REGISTRO_ACTIVOS, type TipoRegistroActivo } from "./constantes";

/**
 * El módulo de cada tipo de registro: sus campos sólo se ven y se configuran con él encendido
 * ("Más datos" en la ficha, Configuración → Campos, la línea de tiempo).
 */
export const MODULO_DE_REGISTRO: Record<TipoRegistroActivo, string> = {
  CLIENTE: CLIENTS_MODULE_KEY,
  SOCIO: MEMBERS_MODULE_KEY,
  CONSULTA: SERVICE_LEADS_MODULE_KEY,
  PROYECTO: PROJECTS_MODULE_KEY,
};

/** ¿El módulo del tipo está encendido en el workspace? Un tipo desconocido, no. */
export async function moduloDeRegistroEncendido(workspaceId: string, entityType: string): Promise<boolean> {
  const modulo = MODULO_DE_REGISTRO[entityType as TipoRegistroActivo];
  return modulo !== undefined && isModuleEnabledForWorkspace(workspaceId, modulo);
}

/** Los tipos de registro con su módulo encendido, en el orden de siempre. */
export async function tiposConModuloEncendido(workspaceId: string): Promise<TipoRegistroActivo[]> {
  const encendidos = await Promise.all(TIPOS_REGISTRO_ACTIVOS.map((t) => moduloDeRegistroEncendido(workspaceId, t)));
  return TIPOS_REGISTRO_ACTIVOS.filter((_, i) => encendidos[i]);
}

/** Puro: "a", "a y b", "a, b y c" (o con "o"). */
export function enumerar(items: string[], conjuncion: "y" | "o"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${conjuncion} ${items[items.length - 1]}`;
}
