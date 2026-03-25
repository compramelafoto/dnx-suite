import { createHash, randomBytes, scryptSync } from "node:crypto";
import { prisma } from "../src/client.js";

const KEY_LEN = 64;

function hashPasswordForSeed(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

/**
 * Usuarios @fotorank.com — testing manual Fotorank (documentación: `packages/db/README.md`).
 *
 * Contraseña en claro para todos: `123456`.
 *
 * Dos sistemas de login en la app (sin mezclar):
 * - `User` → `/login` (organizador/admin/participantes como User).
 * - `FotorankJudgeAccount` → `/jurado/login` (jurado1/jurado2).
 *
 * Fixture mínimo: org slug `seed-ft-com-organizador`, concurso `concurso-prueba-seed-ft-com`,
 * categoría `general`, jurados asignados (ACCEPTED + CRITERIA_BASED), 2 entries con autor participante*.
 *
 * IMPORTANTE — no es bcrypt: Fotorank valida con `verifyPassword` → **scrypt** (`salt:hexDigest`).
 */
const SEED_FT_COM_PASSWORD = "123456";

const SEED_SLUGS = {
  adminOrg: "seed-ft-com-admin",
  organizadorOrg: "seed-ft-com-organizador",
  contest: "concurso-prueba-seed-ft-com",
  category: "general",
} as const;

/** Misma forma que `DEFAULT_CRITERIA_BASED_METHOD_CONFIG` en Fotorank (criteriaBased.ts). */
const E2E_CRITERIA_METHOD_CONFIG = {
  type: "CRITERIA_BASED" as const,
  equalWeight: true as const,
  scale: { min: 1, max: 5, step: 1 },
  criteria: [
    { key: "technique", label: "Técnica" },
    { key: "creativity", label: "Creatividad" },
    { key: "composition", label: "Composición" },
    { key: "impact", label: "Impacto" },
  ],
};

async function seedFotorankComUsers(workspaceId: string) {
  const passwordHash = hashPasswordForSeed(SEED_FT_COM_PASSWORD);
  const evalStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const evalEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fotorank.com" },
    update: { name: "Admin (seed)", passwordHash },
    create: {
      name: "Admin (seed)",
      email: "admin@fotorank.com",
      passwordHash,
    },
  });

  const organizadorUser = await prisma.user.upsert({
    where: { email: "organizador@fotorank.com" },
    update: { name: "Organizador (seed)", passwordHash },
    create: {
      name: "Organizador (seed)",
      email: "organizador@fotorank.com",
      passwordHash,
    },
  });

  const participante1 = await prisma.user.upsert({
    where: { email: "participante1@fotorank.com" },
    update: { name: "Participante 1 (seed)", passwordHash },
    create: {
      name: "Participante 1 (seed)",
      email: "participante1@fotorank.com",
      passwordHash,
    },
  });

  const participante2 = await prisma.user.upsert({
    where: { email: "participante2@fotorank.com" },
    update: { name: "Participante 2 (seed)", passwordHash },
    create: {
      name: "Participante 2 (seed)",
      email: "participante2@fotorank.com",
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: adminUser.id, workspaceId },
    },
    update: { role: "ADMIN" },
    create: {
      userId: adminUser.id,
      workspaceId,
      role: "ADMIN",
    },
  });

  for (const u of [organizadorUser, participante1, participante2]) {
    await prisma.membership.upsert({
      where: {
        userId_workspaceId: { userId: u.id, workspaceId },
      },
      update: { role: "MEMBER" },
      create: {
        userId: u.id,
        workspaceId,
        role: "MEMBER",
      },
    });
  }

  const adminOrg = await prisma.contestOrganization.upsert({
    where: { slug: SEED_SLUGS.adminOrg },
    update: { name: "Org admin @fotorank.com (seed)" },
    create: {
      name: "Org admin @fotorank.com (seed)",
      slug: SEED_SLUGS.adminOrg,
      createdByUserId: adminUser.id,
    },
  });

  await prisma.contestOrganizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: adminOrg.id, userId: adminUser.id },
    },
    update: { status: "ACTIVE", role: "OWNER" },
    create: {
      organizationId: adminOrg.id,
      userId: adminUser.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const organizadorOrg = await prisma.contestOrganization.upsert({
    where: { slug: SEED_SLUGS.organizadorOrg },
    update: { name: "Org organizador @fotorank.com (seed)" },
    create: {
      name: "Org organizador @fotorank.com (seed)",
      slug: SEED_SLUGS.organizadorOrg,
      createdByUserId: organizadorUser.id,
    },
  });

  await prisma.contestOrganizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: organizadorOrg.id, userId: organizadorUser.id },
    },
    update: { status: "ACTIVE", role: "OWNER" },
    create: {
      organizationId: organizadorOrg.id,
      userId: organizadorUser.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const seedContest = await prisma.fotorankContest.upsert({
    where: {
      organizationId_slug: {
        organizationId: organizadorOrg.id,
        slug: SEED_SLUGS.contest,
      },
    },
    update: {
      title: "Concurso de prueba (seed @fotorank.com)",
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
    create: {
      organizationId: organizadorOrg.id,
      title: "Concurso de prueba (seed @fotorank.com)",
      slug: SEED_SLUGS.contest,
      shortDescription: "Fixture para jurados y participantes (seed).",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      createdByUserId: organizadorUser.id,
    },
  });

  const seedCategory = await prisma.fotorankContestCategory.upsert({
    where: {
      contestId_slug: {
        contestId: seedContest.id,
        slug: SEED_SLUGS.category,
      },
    },
    update: { name: "General" },
    create: {
      contestId: seedContest.id,
      name: "General",
      slug: SEED_SLUGS.category,
      sortOrder: 0,
    },
  });

  const judge1 = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jurado1@fotorank.com" },
    update: {
      passwordHash,
      accountStatus: "ACTIVE",
      workspaceId,
    },
    create: {
      workspaceId,
      email: "jurado1@fotorank.com",
      passwordHash,
      accountStatus: "ACTIVE",
    },
  });

  const judge2 = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jurado2@fotorank.com" },
    update: {
      passwordHash,
      accountStatus: "ACTIVE",
      workspaceId,
    },
    create: {
      workspaceId,
      email: "jurado2@fotorank.com",
      passwordHash,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judge1.id },
    update: {
      firstName: "Jurado",
      lastName: "Uno (seed)",
      publicSlug: "jurado-seed-ft-com-1",
      isPublic: true,
    },
    create: {
      judgeAccountId: judge1.id,
      firstName: "Jurado",
      lastName: "Uno (seed)",
      publicSlug: "jurado-seed-ft-com-1",
      isPublic: true,
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judge2.id },
    update: {
      firstName: "Jurado",
      lastName: "Dos (seed)",
      publicSlug: "jurado-seed-ft-com-2",
      isPublic: true,
    },
    create: {
      judgeAccountId: judge2.id,
      firstName: "Jurado",
      lastName: "Dos (seed)",
      publicSlug: "jurado-seed-ft-com-2",
      isPublic: true,
    },
  });

  for (const j of [judge1, judge2]) {
    await prisma.fotorankJudgeOrganizationMembership.upsert({
      where: {
        judgeAccountId_organizationId: {
          judgeAccountId: j.id,
          organizationId: organizadorOrg.id,
        },
      },
      update: { membershipStatus: "ACTIVE" },
      create: {
        judgeAccountId: j.id,
        organizationId: organizadorOrg.id,
        membershipStatus: "ACTIVE",
      },
    });
  }

  for (const j of [judge1, judge2]) {
    await prisma.fotorankJudgeAssignment.upsert({
      where: {
        judgeAccountId_contestId_categoryId: {
          judgeAccountId: j.id,
          contestId: seedContest.id,
          categoryId: seedCategory.id,
        },
      },
      update: {
        organizationId: organizadorOrg.id,
        assignmentStatus: "ACCEPTED",
        methodType: "CRITERIA_BASED",
        methodConfigJson: E2E_CRITERIA_METHOD_CONFIG as object,
        evaluationStartsAt: evalStart,
        evaluationEndsAt: evalEnd,
        allowVoteEdit: true,
        commentsVisibleToParticipants: false,
      },
      create: {
        judgeAccountId: j.id,
        organizationId: organizadorOrg.id,
        contestId: seedContest.id,
        categoryId: seedCategory.id,
        assignmentType: "PRIMARY",
        assignmentStatus: "ACCEPTED",
        methodType: "CRITERIA_BASED",
        methodConfigJson: E2E_CRITERIA_METHOD_CONFIG as object,
        evaluationStartsAt: evalStart,
        evaluationEndsAt: evalEnd,
        allowVoteEdit: true,
        commentsVisibleToParticipants: false,
        createdByUserId: organizadorUser.id,
      },
    });
  }

  const existingP1 = await prisma.fotorankContestEntry.findFirst({
    where: {
      contestId: seedContest.id,
      categoryId: seedCategory.id,
      authorUserId: participante1.id,
    },
  });
  if (!existingP1) {
    await prisma.fotorankContestEntry.create({
      data: {
        contestId: seedContest.id,
        categoryId: seedCategory.id,
        authorUserId: participante1.id,
        imageUrl: "https://placehold.co/1200x800/png?text=Participante+1",
        title: "Obra participante 1 (seed)",
      },
    });
  }

  const existingP2 = await prisma.fotorankContestEntry.findFirst({
    where: {
      contestId: seedContest.id,
      categoryId: seedCategory.id,
      authorUserId: participante2.id,
    },
  });
  if (!existingP2) {
    await prisma.fotorankContestEntry.create({
      data: {
        contestId: seedContest.id,
        categoryId: seedCategory.id,
        authorUserId: participante2.id,
        imageUrl: "https://placehold.co/1200x800/png?text=Participante+2",
        title: "Obra participante 2 (seed)",
      },
    });
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[seed @fotorank.com] Listo. Contraseña para todos: ${SEED_FT_COM_PASSWORD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /login (tabla User):
    admin@fotorank.com
    organizador@fotorank.com
    participante1@fotorank.com
    participante2@fotorank.com
  /jurado/login (tabla FotorankJudgeAccount):
    jurado1@fotorank.com
    jurado2@fotorank.com
  Fixture: org slug "${SEED_SLUGS.organizadorOrg}" · concurso "${SEED_SLUGS.contest}" · categoría "${SEED_SLUGS.category}"
  Doc: packages/db/README.md → "Usuarios @fotorank.com (testing manual en Fotorank)"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

/** Token en claro para E2E (invitación); el hash es el que guarda Prisma. */
const E2E_JUDGE_INVITE_PLAIN_TOKEN =
  "e2e0123456789abcdef0123456789abcdef0123456789ab";

async function main() {
  /** Admin humano (local). E2E usa `admin@fotorank.local` + `AdminSeed!e2e`. */
  const adminE2ePassword = "AdminSeed!e2e";
  const adminDanielPassword = "Daniel1608$";
  const adminE2eHash = hashPasswordForSeed(adminE2ePassword);
  const adminDanielHash = hashPasswordForSeed(adminDanielPassword);

  const user = await prisma.user.upsert({
    where: { email: "admin@fotorank.local" },
    update: { passwordHash: adminE2eHash },
    create: {
      name: "Admin Fotorank",
      email: "admin@fotorank.local",
      passwordHash: adminE2eHash,
    },
  });

  const danielUser = await prisma.user.upsert({
    where: { email: "cuart.daniel@gmail.com" },
    update: { passwordHash: adminDanielHash, name: "Daniel Cuart" },
    create: {
      name: "Daniel Cuart",
      email: "cuart.daniel@gmail.com",
      passwordHash: adminDanielHash,
    },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { name: "Workspace Demo" },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "Workspace Demo" },
    });
  }

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: workspace.id },
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "ADMIN",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: danielUser.id, workspaceId: workspace.id },
    },
    update: {},
    create: {
      userId: danielUser.id,
      workspaceId: workspace.id,
      role: "ADMIN",
    },
  });

  const judge1 = await prisma.judge.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: "jurado1@fotorank.local",
      },
    },
    update: {},
    create: {
      name: "María García",
      email: "jurado1@fotorank.local",
      workspaceId: workspace.id,
    },
  });

  const judge2 = await prisma.judge.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: "jurado2@fotorank.local",
      },
    },
    update: {},
    create: {
      name: "Carlos López",
      email: "jurado2@fotorank.local",
      workspaceId: workspace.id,
    },
  });

  let contest1 = await prisma.contest.findFirst({
    where: { title: "Concurso de Naturaleza 2025" },
  });
  if (!contest1) {
    contest1 = await prisma.contest.create({
      data: {
        title: "Concurso de Naturaleza 2025",
        description:
          "Captura la belleza del mundo natural. Fotografías de paisajes, fauna y flora.",
        status: "ACTIVE",
        workspaceId: workspace.id,
      },
    });
  }

  let contest2 = await prisma.contest.findFirst({
    where: { title: "Retratos en Blanco y Negro" },
  });
  if (!contest2) {
    contest2 = await prisma.contest.create({
      data: {
        title: "Retratos en Blanco y Negro",
        description:
          "Concurso de retratos artísticos en escala de grises.",
        status: "DRAFT",
        workspaceId: workspace.id,
      },
    });
  }

  const cat1a =
    (await prisma.category.findFirst({
      where: { contestId: contest1.id, name: "Paisajes" },
    })) ??
    (await prisma.category.create({
      data: { name: "Paisajes", contestId: contest1.id },
    }));
  const cat1b =
    (await prisma.category.findFirst({
      where: { contestId: contest1.id, name: "Fauna" },
    })) ??
    (await prisma.category.create({
      data: { name: "Fauna", contestId: contest1.id },
    }));
  const cat1c =
    (await prisma.category.findFirst({
      where: { contestId: contest1.id, name: "Flora" },
    })) ??
    (await prisma.category.create({
      data: { name: "Flora", contestId: contest1.id },
    }));
  const cat2a =
    (await prisma.category.findFirst({
      where: { contestId: contest2.id, name: "Retrato individual" },
    })) ??
    (await prisma.category.create({
      data: { name: "Retrato individual", contestId: contest2.id },
    }));

  await prisma.contestJudgeAssignment.upsert({
    where: {
      contestId_judgeId: { contestId: contest1.id, judgeId: judge1.id },
    },
    update: {},
    create: { contestId: contest1.id, judgeId: judge1.id },
  });
  await prisma.contestJudgeAssignment.upsert({
    where: {
      contestId_judgeId: { contestId: contest1.id, judgeId: judge2.id },
    },
    update: {},
    create: { contestId: contest1.id, judgeId: judge2.id },
  });
  await prisma.contestJudgeAssignment.upsert({
    where: {
      contestId_judgeId: { contestId: contest2.id, judgeId: judge1.id },
    },
    update: {},
    create: { contestId: contest2.id, judgeId: judge1.id },
  });

  const entryCount = await prisma.entry.count();
  if (entryCount === 0) {
    const entry1 = await prisma.entry.create({
      data: {
        title: "Amanecer en la montaña",
        authorName: "Ana Martínez",
        imageUrl: "https://placehold.co/800x600?text=Foto1",
        contestId: contest1.id,
        categoryId: cat1a.id,
      },
    });

    const entry2 = await prisma.entry.create({
      data: {
        title: "Águila en vuelo",
        authorName: "Pedro Sánchez",
        imageUrl: "https://placehold.co/800x600?text=Foto2",
        contestId: contest1.id,
        categoryId: cat1b.id,
      },
    });

    const entry3 = await prisma.entry.create({
      data: {
        title: "Bosque de otoño",
        authorName: "Laura Fernández",
        imageUrl: "https://placehold.co/800x600?text=Foto3",
        contestId: contest1.id,
        categoryId: cat1a.id,
      },
    });

    await prisma.score.createMany({
      data: [
        { entryId: entry1.id, judgeId: judge1.id, value: 8.5 },
        { entryId: entry1.id, judgeId: judge2.id, value: 9 },
        { entryId: entry2.id, judgeId: judge1.id, value: 7.5 },
        { entryId: entry2.id, judgeId: judge2.id, value: 8 },
        { entryId: entry3.id, judgeId: judge1.id, value: 9.5 },
        { entryId: entry3.id, judgeId: judge2.id, value: 9 },
      ],
      skipDuplicates: true,
    });

    await prisma.ranking.createMany({
      data: [
        { entryId: entry3.id, position: 1, score: 18.5 },
        { entryId: entry1.id, position: 2, score: 17.5 },
        { entryId: entry2.id, position: 3, score: 15.5 },
      ],
      skipDuplicates: true,
    });

    await prisma.diploma.createMany({
      data: [
        { entryId: entry1.id, status: "GENERATED" },
        { entryId: entry2.id, status: "GENERATED" },
        { entryId: entry3.id, status: "GENERATED" },
      ],
      skipDuplicates: true,
    });
  }

  // --- Fotorank / Jurados: fixtures deterministas para demo local y E2E ---
  const demoJudgePassword = "JudgeDemo!e2e";
  const inviteJudgePassword = "InviteSeed!e2e";
  const demoJudgeHash = hashPasswordForSeed(demoJudgePassword);
  const inviteJudgeHash = hashPasswordForSeed(inviteJudgePassword);
  const inviteTokenHash = createHash("sha256").update(E2E_JUDGE_INVITE_PLAIN_TOKEN).digest("hex");

  const e2eOrgSlug = "e2e-fotorank-org";
  const e2eContestSlug = "e2e-demo-contest";

  const e2eOrg = await prisma.contestOrganization.upsert({
    where: { slug: e2eOrgSlug },
    update: {
      name: "E2E Fotorank Org",
      shortDescription: "Organización de prueba E2E — perfil institucional.",
      contactEmail: "org@fotorank.local",
    },
    create: {
      name: "E2E Fotorank Org",
      slug: e2eOrgSlug,
      shortDescription: "Organización de prueba E2E — perfil institucional.",
      contactEmail: "org@fotorank.local",
      createdByUserId: user.id,
    },
  });

  await prisma.contestOrganizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: e2eOrg.id, userId: user.id },
    },
    update: { status: "ACTIVE", role: "OWNER" },
    create: {
      organizationId: e2eOrg.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await prisma.contestOrganizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: e2eOrg.id, userId: danielUser.id },
    },
    update: { status: "ACTIVE", role: "OWNER" },
    create: {
      organizationId: e2eOrg.id,
      userId: danielUser.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const e2eContest = await prisma.fotorankContest.upsert({
    where: {
      organizationId_slug: { organizationId: e2eOrg.id, slug: e2eContestSlug },
    },
    update: {
      title: "Concurso E2E Jurados",
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    create: {
      organizationId: e2eOrg.id,
      title: "Concurso E2E Jurados",
      slug: e2eContestSlug,
      status: "ACTIVE",
      visibility: "PUBLIC",
      createdByUserId: user.id,
    },
  });

  const catGeneral = await prisma.fotorankContestCategory.upsert({
    where: {
      contestId_slug: { contestId: e2eContest.id, slug: "general" },
    },
    update: { name: "General" },
    create: {
      contestId: e2eContest.id,
      name: "General",
      slug: "general",
      sortOrder: 0,
    },
  });

  const catInvite = await prisma.fotorankContestCategory.upsert({
    where: {
      contestId_slug: { contestId: e2eContest.id, slug: "categoria-invite" },
    },
    update: { name: "Categoría invitación" },
    create: {
      contestId: e2eContest.id,
      name: "Categoría invitación",
      slug: "categoria-invite",
      sortOrder: 1,
    },
  });

  const existingEntry = await prisma.fotorankContestEntry.findFirst({
    where: { contestId: e2eContest.id, categoryId: catGeneral.id },
  });
  if (!existingEntry) {
    await prisma.fotorankContestEntry.create({
      data: {
        contestId: e2eContest.id,
        categoryId: catGeneral.id,
        imageUrl: "https://placehold.co/1200x800/png?text=E2E+Photo",
        title: "Foto E2E",
        description: "Entrada de prueba para evaluación jurado.",
      },
    });
  }

  const existingInviteEntry = await prisma.fotorankContestEntry.findFirst({
    where: { contestId: e2eContest.id, categoryId: catInvite.id },
  });
  if (!existingInviteEntry) {
    await prisma.fotorankContestEntry.create({
      data: {
        contestId: e2eContest.id,
        categoryId: catInvite.id,
        imageUrl: "https://placehold.co/1200x800/png?text=E2E+Invite",
        title: "Foto invitación E2E",
      },
    });
  }

  const evalStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const evalEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const judgeDemo = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jury.demo@fotorank.local" },
    update: {
      passwordHash: demoJudgeHash,
      accountStatus: "ACTIVE",
      workspaceId: workspace.id,
    },
    create: {
      workspaceId: workspace.id,
      email: "jury.demo@fotorank.local",
      passwordHash: demoJudgeHash,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judgeDemo.id },
    update: {
      firstName: "Jurado",
      lastName: "Demo",
      publicSlug: "jurado-demo-e2e",
      isPublic: true,
      shortBio: "Jurado demo para pruebas E2E.",
      fullBioRichJson: {
        version: 1,
        blocks: [{ type: "paragraph", text: "Bio pública enriquecida (E2E)." }],
      },
    },
    create: {
      judgeAccountId: judgeDemo.id,
      firstName: "Jurado",
      lastName: "Demo",
      publicSlug: "jurado-demo-e2e",
      isPublic: true,
      shortBio: "Jurado demo para pruebas E2E.",
      fullBioRichJson: {
        version: 1,
        blocks: [{ type: "paragraph", text: "Bio pública enriquecida (E2E)." }],
      },
    },
  });

  await prisma.fotorankJudgeOrganizationMembership.upsert({
    where: {
      judgeAccountId_organizationId: {
        judgeAccountId: judgeDemo.id,
        organizationId: e2eOrg.id,
      },
    },
    update: { membershipStatus: "ACTIVE" },
    create: {
      judgeAccountId: judgeDemo.id,
      organizationId: e2eOrg.id,
      membershipStatus: "ACTIVE",
    },
  });

  const e2eAssignmentGeneralDemo = await prisma.fotorankJudgeAssignment.upsert({
    where: {
      judgeAccountId_contestId_categoryId: {
        judgeAccountId: judgeDemo.id,
        contestId: e2eContest.id,
        categoryId: catGeneral.id,
      },
    },
    update: {
      organizationId: e2eOrg.id,
      assignmentStatus: "ACCEPTED",
      methodType: "CRITERIA_BASED",
      methodConfigJson: E2E_CRITERIA_METHOD_CONFIG as object,
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
    },
    create: {
      judgeAccountId: judgeDemo.id,
      organizationId: e2eOrg.id,
      contestId: e2eContest.id,
      categoryId: catGeneral.id,
      assignmentType: "PRIMARY",
      assignmentStatus: "ACCEPTED",
      methodType: "CRITERIA_BASED",
      methodConfigJson: E2E_CRITERIA_METHOD_CONFIG as object,
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
      createdByUserId: user.id,
    },
  });

  /** Voto determinista para E2E de resultados admin (media 4 → `4.00` en la tabla). */
  const e2eEntryGeneral = await prisma.fotorankContestEntry.findFirst({
    where: { contestId: e2eContest.id, categoryId: catGeneral.id, title: "Foto E2E" },
  });
  if (e2eEntryGeneral) {
    await prisma.fotorankJudgeVote.upsert({
      where: {
        assignmentId_entryId: {
          assignmentId: e2eAssignmentGeneralDemo.id,
          entryId: e2eEntryGeneral.id,
        },
      },
      update: {
        criteriaScoresJson: { technique: 4, creativity: 5, composition: 3, impact: 4 },
        valueNumeric: null,
        valueBoolean: null,
        isFavorite: null,
        selectedRank: null,
      },
      create: {
        assignmentId: e2eAssignmentGeneralDemo.id,
        entryId: e2eEntryGeneral.id,
        criteriaScoresJson: { technique: 4, creativity: 5, composition: 3, impact: 4 },
        valueNumeric: null,
        valueBoolean: null,
        isFavorite: null,
        selectedRank: null,
      },
    });
  }

  const judgeInvite = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jury.invite@fotorank.local" },
    update: {
      passwordHash: inviteJudgeHash,
      accountStatus: "ACTIVE",
      workspaceId: workspace.id,
    },
    create: {
      workspaceId: workspace.id,
      email: "jury.invite@fotorank.local",
      passwordHash: inviteJudgeHash,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judgeInvite.id },
    update: {
      firstName: "Pendiente",
      lastName: "Invitación",
      publicSlug: "jurado-invite-e2e",
      isPublic: true,
    },
    create: {
      judgeAccountId: judgeInvite.id,
      firstName: "Pendiente",
      lastName: "Invitación",
      publicSlug: "jurado-invite-e2e",
      isPublic: true,
    },
  });

  await prisma.fotorankJudgeOrganizationMembership.upsert({
    where: {
      judgeAccountId_organizationId: {
        judgeAccountId: judgeInvite.id,
        organizationId: e2eOrg.id,
      },
    },
    update: { membershipStatus: "ACTIVE" },
    create: {
      judgeAccountId: judgeInvite.id,
      organizationId: e2eOrg.id,
      membershipStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeAssignment.upsert({
    where: {
      judgeAccountId_contestId_categoryId: {
        judgeAccountId: judgeInvite.id,
        contestId: e2eContest.id,
        categoryId: catInvite.id,
      },
    },
    update: {
      organizationId: e2eOrg.id,
      assignmentStatus: "INVITATION_SENT",
      methodType: "SCORE_1_10",
      methodConfigJson: { min: 1, max: 10, step: 1 },
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
    },
    create: {
      judgeAccountId: judgeInvite.id,
      organizationId: e2eOrg.id,
      contestId: e2eContest.id,
      categoryId: catInvite.id,
      assignmentType: "PRIMARY",
      assignmentStatus: "INVITATION_SENT",
      methodType: "SCORE_1_10",
      methodConfigJson: { min: 1, max: 10, step: 1 },
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
      createdByUserId: user.id,
    },
  });

  /**
   * Jurado distinto de `jury.invite@` (mutable tras E2E de registro por token).
   * Asignación siempre INVITATION_SENT → panel muestra «Evaluar» deshabilitado (E2E estable en paralelo).
   */
  const panelBlockedJudgePassword = "PanelBloq!e2e";
  const panelBlockedJudgeHash = hashPasswordForSeed(panelBlockedJudgePassword);
  const judgePanelBlocked = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jury.panel-bloqueado@fotorank.local" },
    update: {
      passwordHash: panelBlockedJudgeHash,
      accountStatus: "ACTIVE",
      workspaceId: workspace.id,
    },
    create: {
      workspaceId: workspace.id,
      email: "jury.panel-bloqueado@fotorank.local",
      passwordHash: panelBlockedJudgeHash,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judgePanelBlocked.id },
    update: {
      firstName: "E2E",
      lastName: "Panel bloqueado",
      publicSlug: "jurado-panel-bloqueado-e2e",
      isPublic: false,
    },
    create: {
      judgeAccountId: judgePanelBlocked.id,
      firstName: "E2E",
      lastName: "Panel bloqueado",
      publicSlug: "jurado-panel-bloqueado-e2e",
      isPublic: false,
    },
  });

  await prisma.fotorankJudgeOrganizationMembership.upsert({
    where: {
      judgeAccountId_organizationId: {
        judgeAccountId: judgePanelBlocked.id,
        organizationId: e2eOrg.id,
      },
    },
    update: { membershipStatus: "ACTIVE" },
    create: {
      judgeAccountId: judgePanelBlocked.id,
      organizationId: e2eOrg.id,
      membershipStatus: "ACTIVE",
    },
  });

  /** En General ya existe CRITERIA_BASED (jurado demo); otra asignación con SCORE_1_10 aquí rompe resultados admin (AMBIGUOUS_METHOD). */
  await prisma.fotorankJudgeAssignment.deleteMany({
    where: { judgeAccountId: judgePanelBlocked.id, contestId: e2eContest.id },
  });

  await prisma.fotorankJudgeAssignment.upsert({
    where: {
      judgeAccountId_contestId_categoryId: {
        judgeAccountId: judgePanelBlocked.id,
        contestId: e2eContest.id,
        categoryId: catInvite.id,
      },
    },
    update: {
      organizationId: e2eOrg.id,
      assignmentStatus: "INVITATION_SENT",
      methodType: "SCORE_1_10",
      methodConfigJson: { min: 1, max: 10, step: 1 },
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
    },
    create: {
      judgeAccountId: judgePanelBlocked.id,
      organizationId: e2eOrg.id,
      contestId: e2eContest.id,
      categoryId: catInvite.id,
      assignmentType: "PRIMARY",
      assignmentStatus: "INVITATION_SENT",
      methodType: "SCORE_1_10",
      methodConfigJson: { min: 1, max: 10, step: 1 },
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
      createdByUserId: user.id,
    },
  });

  /** E2E: ventana de evaluación cerrada (concurso ACTIVE, asignación ACCEPTED). */
  const windowClosedPassword = "WindowClosed!e2e";
  const windowClosedHash = hashPasswordForSeed(windowClosedPassword);
  const judgeWindowClosed = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jury.window-closed@fotorank.local" },
    update: {
      passwordHash: windowClosedHash,
      accountStatus: "ACTIVE",
      workspaceId: workspace.id,
    },
    create: {
      workspaceId: workspace.id,
      email: "jury.window-closed@fotorank.local",
      passwordHash: windowClosedHash,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judgeWindowClosed.id },
    update: {
      firstName: "E2E",
      lastName: "Ventana cerrada",
      publicSlug: "jurado-window-closed-e2e",
      isPublic: false,
    },
    create: {
      judgeAccountId: judgeWindowClosed.id,
      firstName: "E2E",
      lastName: "Ventana cerrada",
      publicSlug: "jurado-window-closed-e2e",
      isPublic: false,
    },
  });

  await prisma.fotorankJudgeOrganizationMembership.upsert({
    where: {
      judgeAccountId_organizationId: {
        judgeAccountId: judgeWindowClosed.id,
        organizationId: e2eOrg.id,
      },
    },
    update: { membershipStatus: "ACTIVE" },
    create: {
      judgeAccountId: judgeWindowClosed.id,
      organizationId: e2eOrg.id,
      membershipStatus: "ACTIVE",
    },
  });

  const evalEnded = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const evalStartedEarly = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await prisma.fotorankJudgeAssignment.deleteMany({
    where: {
      judgeAccountId: judgeWindowClosed.id,
      contestId: e2eContest.id,
      categoryId: catGeneral.id,
    },
  });
  await prisma.fotorankJudgeAssignment.create({
    data: {
      id: "e2e_assign_window_closed",
      judgeAccountId: judgeWindowClosed.id,
      organizationId: e2eOrg.id,
      contestId: e2eContest.id,
      categoryId: catGeneral.id,
      assignmentType: "PRIMARY",
      assignmentStatus: "ACCEPTED",
      methodType: "CRITERIA_BASED",
      methodConfigJson: E2E_CRITERIA_METHOD_CONFIG as object,
      evaluationStartsAt: evalStartedEarly,
      evaluationEndsAt: evalEnded,
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
      createdByUserId: user.id,
    },
  });

  /** E2E: concurso en DRAFT bloquea evaluación aunque la asignación esté aceptada. */
  const e2eDraftContestSlug = "e2e-draft-contest";
  const draftContest = await prisma.fotorankContest.upsert({
    where: {
      organizationId_slug: { organizationId: e2eOrg.id, slug: e2eDraftContestSlug },
    },
    update: {
      title: "Concurso E2E Borrador",
      status: "DRAFT",
      visibility: "PRIVATE",
    },
    create: {
      organizationId: e2eOrg.id,
      title: "Concurso E2E Borrador",
      slug: e2eDraftContestSlug,
      shortDescription: "Solo E2E — no elegible para evaluación.",
      status: "DRAFT",
      visibility: "PRIVATE",
      createdByUserId: user.id,
    },
  });

  const catDraft = await prisma.fotorankContestCategory.upsert({
    where: {
      contestId_slug: { contestId: draftContest.id, slug: "general" },
    },
    update: { name: "General" },
    create: {
      contestId: draftContest.id,
      name: "General",
      slug: "general",
      sortOrder: 0,
    },
  });

  const draftEvalPassword = "DraftEval!e2e";
  const draftEvalHash = hashPasswordForSeed(draftEvalPassword);
  const judgeDraftEval = await prisma.fotorankJudgeAccount.upsert({
    where: { email: "jury.draft-eval@fotorank.local" },
    update: {
      passwordHash: draftEvalHash,
      accountStatus: "ACTIVE",
      workspaceId: workspace.id,
    },
    create: {
      workspaceId: workspace.id,
      email: "jury.draft-eval@fotorank.local",
      passwordHash: draftEvalHash,
      accountStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeProfile.upsert({
    where: { judgeAccountId: judgeDraftEval.id },
    update: {
      firstName: "E2E",
      lastName: "Draft eval",
      publicSlug: "jurado-draft-eval-e2e",
      isPublic: false,
    },
    create: {
      judgeAccountId: judgeDraftEval.id,
      firstName: "E2E",
      lastName: "Draft eval",
      publicSlug: "jurado-draft-eval-e2e",
      isPublic: false,
    },
  });

  await prisma.fotorankJudgeOrganizationMembership.upsert({
    where: {
      judgeAccountId_organizationId: {
        judgeAccountId: judgeDraftEval.id,
        organizationId: e2eOrg.id,
      },
    },
    update: { membershipStatus: "ACTIVE" },
    create: {
      judgeAccountId: judgeDraftEval.id,
      organizationId: e2eOrg.id,
      membershipStatus: "ACTIVE",
    },
  });

  await prisma.fotorankJudgeAssignment.deleteMany({
    where: {
      judgeAccountId: judgeDraftEval.id,
      contestId: draftContest.id,
      categoryId: catDraft.id,
    },
  });
  await prisma.fotorankJudgeAssignment.create({
    data: {
      id: "e2e_assign_draft_contest",
      judgeAccountId: judgeDraftEval.id,
      organizationId: e2eOrg.id,
      contestId: draftContest.id,
      categoryId: catDraft.id,
      assignmentType: "PRIMARY",
      assignmentStatus: "ACCEPTED",
      methodType: "CRITERIA_BASED",
      methodConfigJson: E2E_CRITERIA_METHOD_CONFIG as object,
      evaluationStartsAt: evalStart,
      evaluationEndsAt: evalEnd,
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
      createdByUserId: user.id,
    },
  });

  await prisma.fotorankJudgeInvitation.upsert({
    where: { tokenHash: inviteTokenHash },
    update: {
      organizationId: e2eOrg.id,
      contestId: e2eContest.id,
      categoryId: catInvite.id,
      judgeAccountId: judgeInvite.id,
      email: "jury.invite@fotorank.local",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      invitationStatus: "SENT",
      sentByUserId: user.id,
    },
    create: {
      organizationId: e2eOrg.id,
      contestId: e2eContest.id,
      categoryId: catInvite.id,
      judgeAccountId: judgeInvite.id,
      email: "jury.invite@fotorank.local",
      tokenHash: inviteTokenHash,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      invitationStatus: "SENT",
      sentByUserId: user.id,
    },
  });

  await seedFotorankComUsers(workspace.id);

  console.log("Seed completado correctamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
