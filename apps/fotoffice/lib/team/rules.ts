import { puede } from "@/lib/access/policy";
import { normalizarRol } from "@/lib/access/roles";

export const TEAM_INVITATION_TTL_DAYS = 7;
export function teamInvitationExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + TEAM_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type Accion = { tipo: "CAMBIAR_ROL"; nuevoRol: string } | { tipo: "DAR_DE_BAJA" };

export function validarAccionSobreMiembro(p: {
  actorRole: string;
  objetivoRole: string;
  esUnoMismo: boolean;
  duenosRestantes: number;
  accion: Accion;
}): string | null {
  if (!puede(p.actorRole, "gestionarEquipo")) return "No tenés permiso para gestionar el equipo.";
  const actor = normalizarRol(p.actorRole);
  const objetivo = normalizarRol(p.objetivoRole);
  const nuevo = p.accion.tipo === "CAMBIAR_ROL" ? normalizarRol(p.accion.nuevoRol) : null;
  if (actor === "ADMIN" && (objetivo === "OWNER" || nuevo === "OWNER")) {
    return "Sólo un dueño puede modificar dueños o nombrar uno nuevo.";
  }
  const pierdeDueno = objetivo === "OWNER" && (p.accion.tipo === "DAR_DE_BAJA" || nuevo !== "OWNER");
  if (pierdeDueno && p.duenosRestantes <= 1) {
    return "No se puede: es el último dueño del espacio de trabajo.";
  }
  return null;
}

export function rolesOfrecidos(actorRole: string, colaboradorDisponible: boolean): string[] {
  if (!puede(actorRole, "gestionarEquipo")) return [];
  const roles = ["WORKSPACE_ADMIN", "STAFF"];
  if (colaboradorDisponible) roles.push("COLLABORATOR");
  return roles;
}
