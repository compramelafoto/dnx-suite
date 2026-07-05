/**
 * Modos de convocatoria de fotógrafos en el panel organizador (sin exponer enums crudos en UI).
 */
export type PhotographerConvocatoriaMode = "open" | "approval" | "invite_only";

/** Para invite_only: visibilidad fuera del descubrimiento público (home / cercanía). */
export type InviteListVisibility = "PRIVATE" | "UNLISTED";

export function convocatoriaModeFromEvent(
  visibility: string,
  joinPolicy: string
): { mode: PhotographerConvocatoriaMode; inviteVisibility: InviteListVisibility } {
  if (joinPolicy === "INVITE_ONLY") {
    const inviteVisibility: InviteListVisibility = visibility === "PRIVATE" ? "PRIVATE" : "UNLISTED";
    return { mode: "invite_only", inviteVisibility };
  }
  if (joinPolicy === "REQUEST") {
    return { mode: "approval", inviteVisibility: "UNLISTED" };
  }
  return { mode: "open", inviteVisibility: "UNLISTED" };
}

export function visibilityAndJoinPolicyForConvocatoria(
  mode: PhotographerConvocatoriaMode,
  inviteVisibility: InviteListVisibility
): { visibility: string; joinPolicy: string } {
  switch (mode) {
    case "open":
      return { visibility: "PUBLIC", joinPolicy: "OPEN" };
    case "approval":
      return { visibility: "PUBLIC", joinPolicy: "REQUEST" };
    case "invite_only":
      return { visibility: inviteVisibility, joinPolicy: "INVITE_ONLY" };
    default:
      return { visibility: "PUBLIC", joinPolicy: "OPEN" };
  }
}
