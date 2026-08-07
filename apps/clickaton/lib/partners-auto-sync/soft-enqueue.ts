/** Soft-fail wrappers for post-mutation hooks. Never throw. */

export async function softEnqueuePartnerBenefitSync(
  fn: () => Promise<{ ok: boolean; reason?: string }>,
): Promise<void> {
  try {
    await fn();
  } catch {
    // never block primary flow
  }
}
