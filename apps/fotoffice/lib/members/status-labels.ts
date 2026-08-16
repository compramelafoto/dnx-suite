/**
 * Coincide estructuralmente con el enum `MemberStatus` de Prisma (no se
 * importa desde `@prisma/client` acá para no depender de esa resolución
 * directa desde `apps/fotoffice`, que no lo declara como dependencia propia).
 */
export type MemberStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

/** Nunca mostrar el enum técnico al usuario. */
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  INACTIVE: "Inactivo",
};

export const MEMBER_STATUS_OPTIONS: readonly { value: MemberStatus; label: string }[] = (
  ["ACTIVE", "SUSPENDED", "INACTIVE"] as const
).map((value) => ({ value, label: MEMBER_STATUS_LABELS[value] }));

export function isMemberStatus(value: string): value is MemberStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "INACTIVE";
}
