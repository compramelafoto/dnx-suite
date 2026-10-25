/** Rol normalizado de FOTOFFICE. Acepta los valores de WorkspaceRole y los legacy de MembershipRole. */
export type RolCanonico = "OWNER" | "ADMIN" | "EQUIPO" | "COLABORADOR";

const MAPA: Record<string, RolCanonico> = {
  WORKSPACE_OWNER: "OWNER",
  WORKSPACE_ADMIN: "ADMIN",
  ADMIN: "ADMIN", // legacy Membership
  STAFF: "EQUIPO",
  MEMBER: "EQUIPO", // legacy Membership
  COLLABORATOR: "COLABORADOR",
};

export function normalizarRol(role: string | null | undefined): RolCanonico | null {
  if (!role) return null;
  return MAPA[role] ?? null;
}

const ETIQUETAS: Record<RolCanonico, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  EQUIPO: "Equipo",
  COLABORADOR: "Colaborador",
};

export function etiquetaRol(role: string | null | undefined): string {
  const r = normalizarRol(role);
  return r ? ETIQUETAS[r] : "Sin acceso";
}
