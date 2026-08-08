import type { PhotoPromptStatus } from "./types";

const TRANSITIONS: Record<PhotoPromptStatus, readonly PhotoPromptStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ARCHIVED"],
  REJECTED: ["DRAFT"],
  ARCHIVED: ["APPROVED"],
};

export function assertTransition(
  from: PhotoPromptStatus,
  to: PhotoPromptStatus,
): void {
  const allowed = TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Transición inválida: ${from} → ${to}. Permitidas: ${allowed.join(", ") || "(ninguna)"}`,
    );
  }
}

export function canTransition(
  from: PhotoPromptStatus,
  to: PhotoPromptStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Uso comercial / edición real: solo APPROVED. */
export function canUseCommercially(status: PhotoPromptStatus): boolean {
  return status === "APPROVED";
}

/**
 * Test Mode / ops fixture: APPROVED siempre; DRAFT solo si allowDraftForOpsTest.
 * IN_REVIEW / REJECTED / ARCHIVED nunca.
 */
export function canUseInTestMode(
  status: PhotoPromptStatus,
  allowDraftForOpsTest = false,
): boolean {
  if (status === "APPROVED") return true;
  if (status === "DRAFT" && allowDraftForOpsTest) return true;
  return false;
}

export function assertAssignable(params: {
  status: PhotoPromptStatus;
  allowDraftForOpsTest?: boolean;
}): void {
  const { status, allowDraftForOpsTest = false } = params;
  if (canUseCommercially(status)) return;
  if (canUseInTestMode(status, allowDraftForOpsTest)) return;
  throw new Error(
    `No se puede asignar consigna en estado ${status}. ` +
      (status === "DRAFT"
        ? "DRAFT solo con allowDraftForOpsTest (Test Mode)."
        : "Solo APPROVED es válido en edición comercial."),
  );
}
