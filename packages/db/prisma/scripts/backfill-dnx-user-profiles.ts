/**
 * Backfill idempotente de DnxUserProfile desde identidad CLF / User.role.
 *
 *   pnpm --filter @repo/db exec tsx prisma/scripts/backfill-dnx-user-profiles.ts
 *
 * No toca InfoSpotUserRole ni User.role (solo lee). Crea perfiles ACTIVE con source CLF_EXISTING.
 * Marca onboarding completo para usuarios con InfoSpotUserRole ACTIVE (Directores/equipo).
 */
import { prisma } from "../../src/client.js";

async function upsertProfile(
  userId: number,
  profileType: "CUSTOMER" | "PHOTOGRAPHER" | "ORGANIZER",
) {
  await prisma.dnxUserProfile.upsert({
    where: { userId_profileType: { userId, profileType } },
    create: {
      userId,
      profileType,
      status: "ACTIVE",
      source: "CLF_EXISTING",
    },
    update: {
      status: "ACTIVE",
      source: "CLF_EXISTING",
    },
  });
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      photographerSalesSettings: { select: { id: true } },
      organizerPublicProfile: { select: { id: true } },
      infoSpotRoles: { select: { role: true, status: true } },
    },
  });

  let customer = 0;
  let photographer = 0;
  let organizer = 0;
  let onboardingMarked = 0;

  for (const user of users) {
    await upsertProfile(user.id, "CUSTOMER");
    customer += 1;

    const isPhotographer =
      user.role === "PHOTOGRAPHER" ||
      user.role === "LAB_PHOTOGRAPHER" ||
      Boolean(user.photographerSalesSettings);
    if (isPhotographer) {
      await upsertProfile(user.id, "PHOTOGRAPHER");
      photographer += 1;
    }

    const isOrganizer =
      user.role === "ORGANIZER" || Boolean(user.organizerPublicProfile);
    if (isOrganizer) {
      await upsertProfile(user.id, "ORGANIZER");
      organizer += 1;
    }

    const hasEditorial = user.infoSpotRoles.some((r) => r.status === "ACTIVE");
    if (hasEditorial || user.role === "SUPER_ADMIN") {
      await prisma.infoSpotUserPreferences.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          onboardingCompletedAt: new Date(),
        },
        update: {
          onboardingCompletedAt: new Date(),
        },
      });
      onboardingMarked += 1;
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      users: users.length,
      profiles: { customer, photographer, organizer },
      onboardingMarked,
    }),
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
