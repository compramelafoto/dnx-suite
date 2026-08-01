/**
 * Toggle registrationEnabled for controlled LIVE E2E window.
 * Usage:
 *   ACTION=open|close DATABASE_URL=… pnpm --filter clickaton exec tsx scripts/ops-10g1-registration-window.ts
 */
import { prisma } from "@repo/db";

const ACTION = (process.env.ACTION ?? "").trim().toLowerCase();

async function main() {
  if (ACTION !== "open" && ACTION !== "close") {
    throw new Error("ACTION must be open|close");
  }
  const enabled = ACTION === "open";
  const before = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    select: { id: true, status: true, registrationEnabled: true, isPublished: true },
  });
  if (!before) throw new Error("edition_missing");
  if (before.status === "DRAFT" && enabled) {
    throw new Error("refuse_open_while_DRAFT");
  }
  const after = await prisma.clickatonEdition.update({
    where: { id: before.id },
    data: { registrationEnabled: enabled, isPublished: true },
    select: { status: true, registrationEnabled: true, isPublished: true },
  });
  console.log(JSON.stringify({ ok: true, action: ACTION, before, after }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
