import type { IdentityVerificationStatus } from "@repo/db";

export type VerificationLevel = "registrado" | "telefono" | "identidad";

export function computeLevel(input: {
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  identity: {
    status: IdentityVerificationStatus;
    reverifyRequiredAt: Date | null;
  } | null;
}): VerificationLevel | "sin_correo" {
  if (!input.emailVerifiedAt) return "sin_correo";
  const phoneOk = input.phoneVerifiedAt !== null;
  const identityOk =
    input.identity?.status === "APPROVED" &&
    input.identity.reverifyRequiredAt === null;
  if (identityOk && phoneOk) return "identidad";
  if (phoneOk) return "telefono";
  return "registrado";
}
