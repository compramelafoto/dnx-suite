import { prisma } from "@/lib/admin/db";

const OPS_SLUG_RE = /(^|-)(ops|fixture)(-|$)/i;

/**
 * Edición de Test Mode / ops fixture: permite allowDraftForOpsTest.
 * Preferencia: isOpsFixture, luego patrón de slug (ops-/fixture-), luego regs isOpsTest.
 */
export async function isOpsTestEdition(editionId: string): Promise<boolean> {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, slug: true, isOpsFixture: true },
  });
  if (!edition) return false;
  if (edition.isOpsFixture) return true;
  if (OPS_SLUG_RE.test(edition.slug)) return true;

  const opsReg = await prisma.clickatonRegistration.findFirst({
    where: { editionId, isOpsTest: true },
    select: { id: true },
  });
  return Boolean(opsReg);
}
