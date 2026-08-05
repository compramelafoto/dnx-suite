/**
 * Grant canónico de membresía a ContestOrganization (OWNER/ADMIN/…).
 *
 *   SFEF_ALLOW_ORG_MEMBER_GRANT=1 \
 *   ORG_MEMBER_EMAIL=sfprosario@gmail.com \
 *   ORG_SLUG=santa-fe-en-foco-org \
 *   ORG_MEMBER_ROLE=OWNER \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-grant-fotorank-org-member.ts
 */
import { PrismaClient, type FotorankOrganizationRole } from "@prisma/client";

const prisma = new PrismaClient();

const ALLOWED_ROLES: FotorankOrganizationRole[] = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "JUDGE",
  "VIEWER",
];

async function main() {
  if (process.env.SFEF_ALLOW_ORG_MEMBER_GRANT !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_ORG_MEMBER_GRANT=1 requerido");
  }

  const email = (process.env.ORG_MEMBER_EMAIL ?? "").trim().toLowerCase();
  const orgSlug = (process.env.ORG_SLUG ?? "").trim();
  const roleRaw = (process.env.ORG_MEMBER_ROLE ?? "OWNER").trim().toUpperCase();

  if (!email.includes("@")) throw new Error("ABORT: ORG_MEMBER_EMAIL inválido");
  if (!orgSlug) throw new Error("ABORT: ORG_SLUG requerido");
  if (!ALLOWED_ROLES.includes(roleRaw as FotorankOrganizationRole)) {
    throw new Error(`ABORT: ORG_MEMBER_ROLE inválido (${ALLOWED_ROLES.join(", ")})`);
  }
  const role = roleRaw as FotorankOrganizationRole;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`ABORT: usuario no encontrado: ${email}`);

  const org = await prisma.contestOrganization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!org) throw new Error(`ABORT: organización no encontrada: ${orgSlug}`);

  const before = await prisma.contestOrganizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true, status: true },
  });

  const member = await prisma.contestOrganizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { status: "ACTIVE", role },
    create: {
      organizationId: org.id,
      userId: user.id,
      role,
      status: "ACTIVE",
    },
    select: { role: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        organization: org,
        before,
        after: member,
        changed:
          !before || before.role !== member.role || before.status !== member.status,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
