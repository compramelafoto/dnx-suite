export function buildManualAccessKey(benefitId: string, userId: number): string {
  return `manual:${benefitId}:${userId}`;
}

export function buildAutomaticAccessKey(input: {
  benefitId: string;
  userId: number;
  sourceType: string;
  sourceId: string;
}): string {
  return `auto:${input.benefitId}:${input.userId}:${input.sourceType}:${input.sourceId}`;
}

export function buildPendingAccessKey(input: {
  benefitId: string;
  sourceType: string;
  sourceId: string;
}): string {
  return `pending:${input.benefitId}:${input.sourceType}:${input.sourceId}`;
}

export function normalizeEligibilityEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const t = email.trim().toLowerCase();
  return t.includes("@") ? t : null;
}
