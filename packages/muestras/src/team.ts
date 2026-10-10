import { formatArClock, formatArDay } from "./dates";

/**
 * Equipo de una muestra (etapa 5). El dueño es quien la propuso (`proposedByUserId`) y no se
 * guarda en la tabla del equipo. Todos los permisos sobre una muestra pasan por `can`: no hay
 * otra comparación con el dueño en el código (spec D2).
 */
export const TEAM_ROLES = ["CO_ORGANIZER", "TEXT_EDITOR"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const isTeamRole = (v: unknown): v is TeamRole => (TEAM_ROLES as readonly unknown[]).includes(v);
export type ActivityRole = "OWNER" | TeamRole;

export const ACTIVITY_ROLE_LABELS: Record<ActivityRole, string> = {
  OWNER: "Responsable",
  CO_ORGANIZER: "Coorganización",
  TEXT_EDITOR: "Textos y curaduría",
};
export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  CO_ORGANIZER:
    "Edita la muestra, las obras, el montaje, las piezas y la inauguración; modera el libro de visitas y ve las estadísticas. No cancela la muestra ni maneja el equipo.",
  TEXT_EDITOR: "Edita el texto curatorial, los créditos y los textos de cada obra (título, año y técnica).",
};

export const CAPABILITIES = [
  "view", "editActivity", "editTexts", "submitForReview", "cancel", "hanging", "pieces",
  "promote", "rsvp", "stats", "guestbook", "manageTeam", "manageCall",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<ActivityRole, readonly Capability[]> = {
  OWNER: CAPABILITIES,
  CO_ORGANIZER: ["view", "editActivity", "editTexts", "submitForReview", "hanging", "pieces", "promote", "rsvp", "stats", "guestbook"],
  TEXT_EDITOR: ["view", "editTexts"],
};

export type Who = { role: ActivityRole | null; isSuperAdmin: boolean };

export function can(cap: Capability, who: Who): boolean {
  if (who.isSuperAdmin) return true;
  return who.role != null && ROLE_CAPABILITIES[who.role].includes(cap);
}

const ORDEN: readonly ActivityRole[] = ["OWNER", "CO_ORGANIZER", "TEXT_EDITOR"];
export function rolesWith(cap: Capability): ActivityRole[] {
  return ORDEN.filter((r) => ROLE_CAPABILITIES[r].includes(cap));
}

export type MemberRow = { userId: number | null; role: string; status: string };

export function activityRole(a: { proposedByUserId: number; members?: readonly MemberRow[] }, userId: number): ActivityRole | null {
  if (a.proposedByUserId === userId) return "OWNER";
  const m = a.members?.find((x) => x.userId === userId && x.status === "ACTIVE" && isTeamRole(x.role));
  return m ? (m.role as TeamRole) : null;
}

export const MEMBER_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: "Invitación pendiente",
  ACTIVE: "En el equipo",
  REVOKED: "Fuera del equipo",
};
export const MAX_TEAM_MEMBERS = 10;
export const TEAM_INVITATION_TTL_DAYS = 30;

/** `email` ya normalizado (o null si no es válido); `occupied`: invitadas + activas. */
export function teamInviteProblems(p: {
  email: string | null;
  role: unknown;
  ownerEmail: string | null;
  occupied: number;
  existing: { status: string } | null;
}): string[] {
  if (!p.email) return ["Escribí un email válido."];
  if (!isTeamRole(p.role)) return ["Elegí un rol."];
  if (p.ownerEmail && p.email === p.ownerEmail.trim().toLowerCase()) return ["Ya sos responsable de esta muestra."];
  if (p.existing?.status === "ACTIVE") return ["Esa persona ya es parte del equipo. Si querés, cambiale el rol."];
  const ocupaLugar = !p.existing || p.existing.status === "REVOKED";
  if (ocupaLugar && p.occupied >= MAX_TEAM_MEMBERS) return [`El equipo de una muestra puede tener hasta ${MAX_TEAM_MEMBERS} personas.`];
  return [];
}

export const EDIT_PARTS = ["FICHA", "TEXTOS", "MONTAJE", "INAUGURACION"] as const;
export type EditPart = (typeof EDIT_PARTS)[number];
export const EDIT_PART_LABELS: Record<EditPart, string> = {
  FICHA: "la ficha",
  TEXTOS: "los textos",
  MONTAJE: "el plano de montaje",
  INAUGURACION: "la inauguración",
};

export function lastEditText(p: { who: string | null; part: string | null; at: Date | null }): string | null {
  if (!p.who || !p.at) return null;
  const parte = (EDIT_PARTS as readonly string[]).includes(p.part ?? "") ? `, en ${EDIT_PART_LABELS[p.part as EditPart]}` : "";
  return `Último cambio: ${p.who}${parte}, el ${formatArDay(p.at)} a las ${formatArClock(p.at)}.`;
}
