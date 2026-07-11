import { createHash, randomBytes, scryptSync } from "node:crypto";
import { prisma, Prisma } from "../src/client.js";

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

/** Normalización alineada con FotoRank `normalizeForAliasKey` (solo seed). */
function seedNormalizedAlias(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Catálogo maestro global + alias. Idempotente (upsert por slug / normalizedAlias).
 * Ejecutar antes de crear categorías de concurso que necesiten mapeo.
 */
async function seedFotorankGlobalMasterCatalog() {
  const masters: { name: string; slug: string }[] = [
    { name: "Retrato", slug: "retrato" },
    { name: "Paisaje", slug: "paisaje" },
    { name: "Naturaleza", slug: "naturaleza" },
    { name: "Fauna", slug: "fauna" },
    { name: "Flora", slug: "flora" },
    { name: "Macro", slug: "macro" },
    { name: "Arquitectura", slug: "arquitectura" },
    { name: "Documental", slug: "documental" },
    { name: "Fotoperiodismo", slug: "fotoperiodismo" },
    { name: "Callejera", slug: "callejera" },
    { name: "Deportes", slug: "deportes" },
    { name: "Blanco y negro", slug: "blanco-y-negro" },
    { name: "Nocturna", slug: "nocturna" },
    { name: "Viajes", slug: "viajes" },
    { name: "Conceptual", slug: "conceptual" },
    { name: "Abstracta", slug: "abstracta" },
    { name: "Drone", slug: "drone" },
    { name: "Minimalismo", slug: "minimalismo" },
    { name: "Cultura", slug: "cultura" },
    { name: "Social", slug: "social" },
    { name: "General", slug: "general" },
  ];

  const idBySlug = new Map<string, string>();
  for (const m of masters) {
    const row = await prisma.fotorankGlobalCategory.upsert({
      where: { slug: m.slug },
      update: {
        name: m.name,
        isActive: true,
        reviewStatus: "APPROVED",
        isSystem: true,
      },
      create: {
        name: m.name,
        slug: m.slug,
        isActive: true,
        reviewStatus: "APPROVED",
        isSystem: true,
      },
    });
    idBySlug.set(m.slug, row.id);
  }

  const aliasDefs: { slug: string; texts: string[] }[] = [
    { slug: "blanco-y-negro", texts: ["B&N", "BN", "ByN", "blanco y negro", "byn"] },
    { slug: "callejera", texts: ["Street", "street photography"] },
    { slug: "fauna", texts: ["Wildlife"] },
    { slug: "retrato", texts: ["Portrait", "portrait"] },
  ];

  for (const { slug, texts } of aliasDefs) {
    const gid = idBySlug.get(slug);
    if (!gid) continue;
    for (const text of texts) {
      const normalizedAlias = seedNormalizedAlias(text);
      if (!normalizedAlias) continue;
      await prisma.fotorankGlobalCategoryAlias.upsert({
        where: { normalizedAlias },
        update: { globalCategoryId: gid, aliasText: text },
        create: { globalCategoryId: gid, aliasText: text, normalizedAlias },
      });
    }
  }
}

async function linkContestCategoryToGlobalPrimary(contestCategoryId: string, globalSlug: string) {
  const g = await prisma.fotorankGlobalCategory.findUnique({ where: { slug: globalSlug } });
  if (!g) return;
  await prisma.fotorankContestCategoryGlobalCategory.upsert({
    where: {
      contestCategoryId_globalCategoryId: { contestCategoryId, globalCategoryId: g.id },
    },
    update: { isPrimary: true },
    create: { contestCategoryId, globalCategoryId: g.id, isPrimary: true },
  });
  await prisma.fotorankContestCategory.update({
    where: { id: contestCategoryId },
    data: {
      mappingIncomplete: false,
      isCustom: false,
      sourceGlobalCategoryId: g.id,
    },
  });
}

async function seedFotorankComUsers(workspaceId: string) {
  const passwordHash = hashPasswordForSeed(SEED_FT_COM_PASSWORD);
  const evalStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const evalEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fotorank.com" },
    update: { name: "Admin (seed)", password: passwordHash },
    create: {
      name: "Admin (seed)",
      email: "admin@fotorank.com",
      password: passwordHash,
    },
  });

  const organizadorUser = await prisma.user.upsert({
    where: { email: "organizador@fotorank.com" },
    update: { name: "Organizador (seed)", password: passwordHash },
    create: {
      name: "Organizador (seed)",
      email: "organizador@fotorank.com",
      password: passwordHash,
    },
  });

  const participante1 = await prisma.user.upsert({
    where: { email: "participante1@fotorank.com" },
    update: { name: "Participante 1 (seed)", password: passwordHash },
    create: {
      name: "Participante 1 (seed)",
      email: "participante1@fotorank.com",
      password: passwordHash,
    },
  });

  const participante2 = await prisma.user.upsert({
    where: { email: "participante2@fotorank.com" },
    update: { name: "Participante 2 (seed)", password: passwordHash },
    create: {
      name: "Participante 2 (seed)",
      email: "participante2@fotorank.com",
      password: passwordHash,
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
  await linkContestCategoryToGlobalPrimary(seedCategory.id, "general");

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

const COURSES_SALES_MODULE_KEY = "courses-sales";

/**
 * Fotoffice — demo «Venta de cursos»: workspaces, branding, módulo activo, docente y curso por workspace.
 */
async function seedFotofficeCoursesSalesDemo(memberUserIds: number[]) {
  const demoWorkspaces: {
    name: string;
    publicSlug: string;
    commercialName: string;
    contactEmail: string;
    teacherSlug: string;
    teacherFirst: string;
    teacherLast: string;
    specialty: string;
    courseSlug: string;
    courseTitle: string;
    courseSubtitle: string;
  }[] = [
    {
      name: "Sociedad de Fotógrafos",
      publicSlug: "sociedad-fotografos",
      commercialName: "Sociedad de Fotógrafos",
      contactEmail: "cursos@sociedadfotografos.demo",
      teacherSlug: "maria-lopez",
      teacherFirst: "María",
      teacherLast: "López",
      specialty: "Retrato e iluminación",
      courseSlug: "retrato-estudio-intensivo",
      courseTitle: "Retrato en estudio: luz y dirección",
      courseSubtitle: "Intensivo práctico para dominar esquemas clásicos y contemporáneos.",
    },
    {
      name: "DNX Estudio",
      publicSlug: "dnx-estudio",
      commercialName: "DNX Estudio",
      contactEmail: "formacion@dnxestudio.demo",
      teacherSlug: "lucas-ferrer",
      teacherFirst: "Lucas",
      teacherLast: "Ferrer",
      specialty: "Producción y edición",
      courseSlug: "workflow-lightroom",
      courseTitle: "Workflow profesional en Lightroom",
      courseSubtitle: "Organización, revelado y entrega consistente para clientes reales.",
    },
  ];

  for (const d of demoWorkspaces) {
    let ws = await prisma.workspace.findFirst({ where: { name: d.name } });
    if (!ws) {
      ws = await prisma.workspace.create({ data: { name: d.name } });
    }

    for (const uid of memberUserIds) {
      await prisma.membership.upsert({
        where: { userId_workspaceId: { userId: uid, workspaceId: ws.id } },
        update: {},
        create: { userId: uid, workspaceId: ws.id, role: "ADMIN" },
      });
    }

    await prisma.fotofficeWorkspaceBranding.upsert({
      where: { publicSlug: d.publicSlug },
      update: {
        workspaceId: ws.id,
        publicSlug: d.publicSlug,
        commercialName: d.commercialName,
        contactEmail: d.contactEmail,
        phone: "+54 11 5000-0000",
        whatsapp: "https://wa.me/5491150000000",
        instagram: "https://instagram.com/demo",
        website: "https://example.com",
      },
      create: {
        workspaceId: ws.id,
        publicSlug: d.publicSlug,
        commercialName: d.commercialName,
        contactEmail: d.contactEmail,
        phone: "+54 11 5000-0000",
        whatsapp: "https://wa.me/5491150000000",
        instagram: "https://instagram.com/demo",
        website: "https://example.com",
      },
    });

    if (d.publicSlug === "dnx-estudio") {
      await prisma.serviceLeadForm.upsert({
        where: { workspaceId_slug: { workspaceId: ws.id, slug: "xv" } },
        update: {
          workspaceId: ws.id,
          slug: "xv",
          name: "Formulario XV",
          eventType: "XV",
          formMode: "SPECIFIC",
          title: "Presupuesto para fiesta de XV",
          description: "Completá tus datos y te contactamos para armar una propuesta personalizada.",
          isActive: true,
          isDefault: true,
          configJson: {
            schemaVersion: 1,
            submitLabel: "Enviar consulta",
            successMessage:
              "¡Gracias por tu consulta! Recibimos tus datos y te vamos a contactar pronto.",
            autoReply: {
              enabled: false,
              mode: "EMAIL_TEXT",
              subject: "",
              body: "",
              linkUrl: "",
              attachmentUrl: "",
            },
            postSubmitAction: {
              type: "NONE",
              delaySeconds: 3,
              url: "",
            },
            fields: [
              {
                name: "quinceaneraName",
                label: "Nombre de la quinceañera",
                type: "text",
                required: false,
              },
              {
                name: "quinceaneraBirthDate",
                label: "Fecha de nacimiento",
                type: "date",
                required: false,
              },
              {
                name: "eventDate",
                label: "Fecha del evento",
                type: "date",
                required: false,
              },
              {
                name: "eventLocation",
                label: "Lugar / ciudad",
                type: "text",
                required: false,
              },
              {
                name: "message",
                label: "Contanos qué estás buscando",
                type: "textarea",
                required: false,
              },
            ],
          } as Prisma.InputJsonValue,
        },
        create: {
          workspaceId: ws.id,
          slug: "xv",
          name: "Formulario XV",
          eventType: "XV",
          formMode: "SPECIFIC",
          title: "Presupuesto para fiesta de XV",
          description: "Completá tus datos y te contactamos para armar una propuesta personalizada.",
          isActive: true,
          isDefault: true,
          configJson: {
            schemaVersion: 1,
            submitLabel: "Enviar consulta",
            successMessage:
              "¡Gracias por tu consulta! Recibimos tus datos y te vamos a contactar pronto.",
            autoReply: {
              enabled: false,
              mode: "EMAIL_TEXT",
              subject: "",
              body: "",
              linkUrl: "",
              attachmentUrl: "",
            },
            postSubmitAction: {
              type: "NONE",
              delaySeconds: 3,
              url: "",
            },
            fields: [
              {
                name: "quinceaneraName",
                label: "Nombre de la quinceañera",
                type: "text",
                required: false,
              },
              {
                name: "quinceaneraBirthDate",
                label: "Fecha de nacimiento",
                type: "date",
                required: false,
              },
              {
                name: "eventDate",
                label: "Fecha del evento",
                type: "date",
                required: false,
              },
              {
                name: "eventLocation",
                label: "Lugar / ciudad",
                type: "text",
                required: false,
              },
              {
                name: "message",
                label: "Contanos qué estás buscando",
                type: "textarea",
                required: false,
              },
            ],
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.serviceLeadForm.upsert({
        where: { workspaceId_slug: { workspaceId: ws.id, slug: "general" } },
        update: {
          workspaceId: ws.id,
          slug: "general",
          name: "Formulario general de presupuestos",
          eventType: "GENERAL",
          formMode: "GENERAL",
          title: "Solicitá tu presupuesto",
          description:
            "Elegí el tipo de servicio que necesitás y completá tus datos para recibir una propuesta.",
          isActive: true,
          isDefault: true,
          configJson: {
            schemaVersion: 1,
            submitLabel: "Enviar consulta",
            successMessage:
              "¡Gracias por tu consulta! Recibimos tus datos y te vamos a contactar pronto.",
            autoReply: {
              enabled: false,
              mode: "EMAIL_TEXT",
              subject: "",
              body: "",
              linkUrl: "",
              attachmentUrl: "",
            },
            postSubmitAction: {
              type: "NONE",
              delaySeconds: 3,
              url: "",
            },
            entrySelector: {
              name: "budgetType",
              label: "Solicitud de presupuesto para",
              required: true,
              options: [
                { value: "xv", label: "XV" },
                { value: "boda", label: "Boda" },
                { value: "sesion", label: "Sesión fotográfica" },
                { value: "evento-religioso", label: "Evento religioso" },
                { value: "show", label: "Show" },
                { value: "graduacion", label: "Graduación" },
                { value: "cumpleanos-adulto", label: "Cumpleaños adulto" },
              ],
            },
            forms: {
              xv: {
                eventType: "XV",
                label: "XV",
                fields: [
                  {
                    name: "quinceaneraName",
                    label: "Nombre de la quinceañera",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "quinceaneraBirthDate",
                    label: "Fecha de nacimiento",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventDate",
                    label: "Fecha del evento",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventLocation",
                    label: "Lugar / ciudad",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "message",
                    label: "Contanos qué estás buscando",
                    type: "textarea",
                    required: false,
                  },
                ],
              },
              boda: {
                eventType: "BODA",
                label: "Boda",
                fields: [
                  {
                    name: "noviaName",
                    label: "Nombre de la novia",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "novioName",
                    label: "Nombre del novio",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "civilDate",
                    label: "Fecha del civil",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "ceremonyDate",
                    label: "Fecha de la ceremonia",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "partyDate",
                    label: "Fecha de la fiesta",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventLocation",
                    label: "Lugar / ciudad",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "message",
                    label: "Contanos qué están buscando",
                    type: "textarea",
                    required: false,
                  },
                ],
              },
              sesion: {
                eventType: "SESION_FOTOGRAFICA",
                label: "Sesión fotográfica",
                fields: [
                  {
                    name: "sessionSubtype",
                    label: "Tipo de sesión",
                    type: "select",
                    required: true,
                    options: [
                      { value: "retrato-personal", label: "Retrato personal" },
                      { value: "book-profesional", label: "Book profesional" },
                      { value: "marca-personal", label: "Marca personal" },
                      { value: "familiar", label: "Familiar" },
                      { value: "pareja", label: "Pareja" },
                      { value: "embarazo", label: "Embarazo" },
                      { value: "producto", label: "Producto" },
                      { value: "otro", label: "Otro" },
                    ],
                  },
                  {
                    name: "eventDate",
                    label: "Fecha estimada",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventLocation",
                    label: "Lugar / ciudad",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "message",
                    label: "Contanos qué estás buscando",
                    type: "textarea",
                    required: false,
                  },
                ],
              },
            },
          } as Prisma.InputJsonValue,
        },
        create: {
          workspaceId: ws.id,
          slug: "general",
          name: "Formulario general de presupuestos",
          eventType: "GENERAL",
          formMode: "GENERAL",
          title: "Solicitá tu presupuesto",
          description:
            "Elegí el tipo de servicio que necesitás y completá tus datos para recibir una propuesta.",
          isActive: true,
          isDefault: true,
          configJson: {
            schemaVersion: 1,
            submitLabel: "Enviar consulta",
            successMessage:
              "¡Gracias por tu consulta! Recibimos tus datos y te vamos a contactar pronto.",
            autoReply: {
              enabled: false,
              mode: "EMAIL_TEXT",
              subject: "",
              body: "",
              linkUrl: "",
              attachmentUrl: "",
            },
            postSubmitAction: {
              type: "NONE",
              delaySeconds: 3,
              url: "",
            },
            entrySelector: {
              name: "budgetType",
              label: "Solicitud de presupuesto para",
              required: true,
              options: [
                { value: "xv", label: "XV" },
                { value: "boda", label: "Boda" },
                { value: "sesion", label: "Sesión fotográfica" },
                { value: "evento-religioso", label: "Evento religioso" },
                { value: "show", label: "Show" },
                { value: "graduacion", label: "Graduación" },
                { value: "cumpleanos-adulto", label: "Cumpleaños adulto" },
              ],
            },
            forms: {
              xv: {
                eventType: "XV",
                label: "XV",
                fields: [
                  {
                    name: "quinceaneraName",
                    label: "Nombre de la quinceañera",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "quinceaneraBirthDate",
                    label: "Fecha de nacimiento",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventDate",
                    label: "Fecha del evento",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventLocation",
                    label: "Lugar / ciudad",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "message",
                    label: "Contanos qué estás buscando",
                    type: "textarea",
                    required: false,
                  },
                ],
              },
              boda: {
                eventType: "BODA",
                label: "Boda",
                fields: [
                  {
                    name: "noviaName",
                    label: "Nombre de la novia",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "novioName",
                    label: "Nombre del novio",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "civilDate",
                    label: "Fecha del civil",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "ceremonyDate",
                    label: "Fecha de la ceremonia",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "partyDate",
                    label: "Fecha de la fiesta",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventLocation",
                    label: "Lugar / ciudad",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "message",
                    label: "Contanos qué están buscando",
                    type: "textarea",
                    required: false,
                  },
                ],
              },
              sesion: {
                eventType: "SESION_FOTOGRAFICA",
                label: "Sesión fotográfica",
                fields: [
                  {
                    name: "sessionSubtype",
                    label: "Tipo de sesión",
                    type: "select",
                    required: true,
                    options: [
                      { value: "retrato-personal", label: "Retrato personal" },
                      { value: "book-profesional", label: "Book profesional" },
                      { value: "marca-personal", label: "Marca personal" },
                      { value: "familiar", label: "Familiar" },
                      { value: "pareja", label: "Pareja" },
                      { value: "embarazo", label: "Embarazo" },
                      { value: "producto", label: "Producto" },
                      { value: "otro", label: "Otro" },
                    ],
                  },
                  {
                    name: "eventDate",
                    label: "Fecha estimada",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "eventLocation",
                    label: "Lugar / ciudad",
                    type: "text",
                    required: false,
                  },
                  {
                    name: "message",
                    label: "Contanos qué estás buscando",
                    type: "textarea",
                    required: false,
                  },
                ],
              },
            },
          } as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.workspaceFeatureModule.upsert({
      where: {
        workspaceId_moduleKey: { workspaceId: ws.id, moduleKey: COURSES_SALES_MODULE_KEY },
      },
      update: { enabled: true },
      create: {
        workspaceId: ws.id,
        moduleKey: COURSES_SALES_MODULE_KEY,
        enabled: true,
      },
    });

    await prisma.courseSalesWorkspaceSettings.upsert({
      where: { workspaceId: ws.id },
      update: {},
      create: {
        workspaceId: ws.id,
        defaultCurrency: "ARS",
        enrollmentCtaLabel: "Quiero inscribirme",
      },
    });

    const fullName = `${d.teacherFirst} ${d.teacherLast}`;
    const teacher = await prisma.courseSalesTeacher.upsert({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: d.teacherSlug } },
      update: {
        firstName: d.teacherFirst,
        lastName: d.teacherLast,
        fullName,
        shortBio: `Docente especializado en ${d.specialty}. Clases claras, ejemplos reales y feedback personalizado.`,
        longBio: `Más de 10 años de experiencia. Ha dictado talleres en distintas instituciones y acompaña a fotógrafos en su desarrollo profesional.`,
        email: `docente@${d.publicSlug}.demo`,
        specialty: d.specialty,
        experienceYears: 12,
        city: "Buenos Aires",
        country: "Argentina",
        isPublished: true,
      },
      create: {
        workspaceId: ws.id,
        firstName: d.teacherFirst,
        lastName: d.teacherLast,
        fullName,
        slug: d.teacherSlug,
        shortBio: `Docente especializado en ${d.specialty}.`,
        longBio: `Experiencia en formación y producción. Enfoque práctico y acompañamiento cercano.`,
        email: `docente@${d.publicSlug}.demo`,
        specialty: d.specialty,
        experienceYears: 12,
        city: "Buenos Aires",
        country: "Argentina",
        isPublished: true,
      },
    });

    const faq = [
      {
        q: "¿Necesito experiencia previa?",
        a: "El curso indica el nivel en la ficha. Revisá requisitos en la descripción o escribinos.",
      },
      {
        q: "¿Hay certificado?",
        a: "Si el curso incluye certificado, figura en la sección «Incluye» de esta página.",
      },
      {
        q: "¿Cómo me inscribo?",
        a: "Completá el formulario de inscripción. Te contactaremos con los siguientes pasos y medios de pago.",
      },
    ];

    const course = await prisma.courseSalesCourse.upsert({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: d.courseSlug } },
      update: {
        title: d.courseTitle,
        subtitle: d.courseSubtitle,
        shortDescription: "Curso demo generado por seed — contenido de ejemplo para Fotoffice.",
        longDescription:
          "Este curso es un ejemplo del módulo Venta de cursos. Podés reemplazar todo el contenido desde el panel del workspace. Incluye estructura de programa, objetivos y bloques de landing listos para personalizar.",
        modality: d.name.includes("DNX") ? "RECORDED" : "HYBRID",
        level: "INTERMEDIATE",
        category: d.name.includes("DNX") ? "Post-producción" : "Retrato",
        targetAudience: "Fotógrafos que quieren profesionalizar su práctica.",
        prerequisites: "Cámara reflex o mirrorless y nociones básicas de exposición.",
        objectives:
          "- Dominar los conceptos centrales del temario\n- Aplicar técnicas en ejercicios guiados\n- Dejar un proyecto o portfolio actualizado",
        durationText: d.name.includes("DNX") ? "6 horas on-demand" : "4 encuentros × 2 h",
        scheduleText: d.name.includes("DNX") ? "Acceso inmediato al material" : "Martes 18:00–20:00 (ART)",
        seats: 20,
        price: new Prisma.Decimal(d.name.includes("DNX") ? "59900" : "129900"),
        currency: "ARS",
        discountPrice: d.name.includes("DNX") ? new Prisma.Decimal("49900") : new Prisma.Decimal("109900"),
        includesCertificate: true,
        includesRecordings: d.name.includes("DNX"),
        includesDownloadables: true,
        status: "PUBLISHED",
        seoTitle: `${d.courseTitle} | ${d.commercialName}`,
        seoDescription: d.courseSubtitle,
        landingBlocksJson: { faq } as Prisma.InputJsonValue,
        teacherId: teacher.id,
      },
      create: {
        workspaceId: ws.id,
        teacherId: teacher.id,
        title: d.courseTitle,
        subtitle: d.courseSubtitle,
        slug: d.courseSlug,
        shortDescription: "Curso demo — reemplazá este texto desde el panel.",
        longDescription:
          "Descripción extendida de ejemplo. Editá objetivos, programa y medios desde Fotoffice.",
        modality: d.name.includes("DNX") ? "RECORDED" : "HYBRID",
        level: "INTERMEDIATE",
        category: d.name.includes("DNX") ? "Post-producción" : "Retrato",
        targetAudience: "Fotógrafos en crecimiento.",
        prerequisites: "Cámara y nociones básicas.",
        objectives: "- Objetivo demo uno\n- Objetivo demo dos",
        durationText: d.name.includes("DNX") ? "6 horas on-demand" : "8 horas en vivo",
        scheduleText: d.name.includes("DNX") ? "On-demand" : "Martes 18:00–20:00",
        seats: 20,
        price: new Prisma.Decimal(d.name.includes("DNX") ? "59900" : "129900"),
        currency: "ARS",
        discountPrice: d.name.includes("DNX") ? new Prisma.Decimal("49900") : new Prisma.Decimal("109900"),
        includesCertificate: true,
        includesRecordings: d.name.includes("DNX"),
        includesDownloadables: true,
        status: "PUBLISHED",
        seoTitle: `${d.courseTitle} | ${d.commercialName}`,
        seoDescription: d.courseSubtitle,
        landingBlocksJson: { faq } as Prisma.InputJsonValue,
      },
    });

    await prisma.courseSalesSection.deleteMany({ where: { courseId: course.id } });

    const s1 = await prisma.courseSalesSection.create({
      data: {
        courseId: course.id,
        title: d.name.includes("DNX") ? "Módulo 1 — Organización" : "Módulo 1 — Luz y esquemas",
        sortOrder: 0,
      },
    });
    const s2 = await prisma.courseSalesSection.create({
      data: {
        courseId: course.id,
        title: d.name.includes("DNX") ? "Módulo 2 — Revelado" : "Módulo 2 — Dirección y posing",
        sortOrder: 1,
      },
    });

    await prisma.courseSalesLesson.createMany({
      data: [
        {
          sectionId: s1.id,
          title: d.name.includes("DNX") ? "Biblioteca y copias virtuales" : "Introducción a la luz artificial",
          summary: "Conceptos y demo en vivo.",
          sortOrder: 0,
        },
        {
          sectionId: s1.id,
          title: d.name.includes("DNX") ? "Flujo de selección" : "Esquemas butterfly y loop",
          summary: "Ejercicios guiados.",
          sortOrder: 1,
        },
        {
          sectionId: s2.id,
          title: d.name.includes("DNX") ? "Curvas y color" : "Comunicación con el modelo",
          summary: "Buenas prácticas.",
          sortOrder: 0,
        },
        {
          sectionId: s2.id,
          title: d.name.includes("DNX") ? "Exportación para web e impresión" : "Producción de set simple",
          summary: "Checklist final.",
          sortOrder: 1,
        },
      ],
    });
  }

  console.log("Seed Fotoffice / courses-sales (Sociedad de Fotógrafos + DNX Estudio) aplicado.");
}

async function main() {
  /** Admin humano (local). E2E usa `admin@fotorank.local` + `AdminSeed!e2e`. */
  const adminE2ePassword = "AdminSeed!e2e";
  const adminDanielPassword = "Daniel1608$";
  const dnxDevPassword = "DevDnx1608$";
  const adminE2eHash = hashPasswordForSeed(adminE2ePassword);
  const adminDanielHash = hashPasswordForSeed(adminDanielPassword);
  const dnxDevHash = hashPasswordForSeed(dnxDevPassword);

  const user = await prisma.user.upsert({
    where: { email: "admin@fotorank.local" },
    update: { password: adminE2eHash },
    create: {
      name: "Admin Fotorank",
      email: "admin@fotorank.local",
      password: adminE2eHash,
    },
  });

  /**
   * SUPER_ADMIN Fotoffice / suite — contraseña inicial vía seed (scrypt, mismo esquema que el resto del monorepo).
   * Cambiá la contraseña tras el primer acceso en producción.
   */
  const danielUser = await prisma.user.upsert({
    where: { email: "cuart.daniel@gmail.com" },
    update: {
      password: adminDanielHash,
      name: "Daniel Cuart",
      role: "SUPER_ADMIN",
      globalRole: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
    create: {
      name: "Daniel Cuart",
      email: "cuart.daniel@gmail.com",
      password: adminDanielHash,
      role: "SUPER_ADMIN",
      globalRole: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
  });

  const sfprOwner = await prisma.user.upsert({
    where: { email: "sfprosario@gmail.com" },
    update: {
      name: "SFPR Owner",
      globalRole: "USER",
      role: "WORKSPACE_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
    create: {
      email: "sfprosario@gmail.com",
      name: "SFPR Owner",
      password: hashPasswordForSeed("SfprOwner1608$"),
      globalRole: "USER",
      role: "WORKSPACE_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
  });

  const dnxOwner = await prisma.user.upsert({
    where: { email: "dnxfotografia@gmail.com" },
    update: {
      name: "DNX Owner",
      password: hashPasswordForSeed("DnxOwner1608$"),
      globalRole: "USER",
      role: "WORKSPACE_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
    create: {
      email: "dnxfotografia@gmail.com",
      name: "DNX Owner",
      password: hashPasswordForSeed("DnxOwner1608$"),
      globalRole: "USER",
      role: "WORKSPACE_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
  });

  const dnxDevUser = await prisma.user.upsert({
    where: { email: "dev.dnx@fotoffice.local" },
    update: {
      name: "DNX Dev",
      password: dnxDevHash,
      globalRole: "USER",
      role: "WORKSPACE_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
    create: {
      email: "dev.dnx@fotoffice.local",
      name: "DNX Dev",
      password: dnxDevHash,
      globalRole: "USER",
      role: "WORKSPACE_ADMIN",
      emailVerifiedAt: new Date(),
      isBlocked: false,
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

  const [workspaceDnx, workspaceSfpr] = await Promise.all([
    prisma.workspace.upsert({
      where: { id: "ws_dnx_fotografia_seed" },
      update: { name: "DNX Fotografía" },
      create: { id: "ws_dnx_fotografia_seed", name: "DNX Fotografía" },
    }),
    prisma.workspace.upsert({
      where: { id: "ws_sfpr_seed" },
      update: { name: "SFPR" },
      create: { id: "ws_sfpr_seed", name: "SFPR" },
    }),
  ]);

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

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: dnxOwner.id, workspaceId: workspaceDnx.id },
    },
    update: {},
    create: {
      userId: dnxOwner.id,
      workspaceId: workspaceDnx.id,
      role: "ADMIN",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: dnxDevUser.id, workspaceId: workspaceDnx.id },
    },
    update: {},
    create: {
      userId: dnxDevUser.id,
      workspaceId: workspaceDnx.id,
      role: "ADMIN",
    },
  });

  // Nuevo sistema unificado: workspace memberships canónicas.
  const unifiedMemberships = [
    { userId: danielUser.id, workspaceId: workspaceDnx.id, role: "WORKSPACE_OWNER" as const },
    { userId: danielUser.id, workspaceId: workspaceSfpr.id, role: "WORKSPACE_OWNER" as const },
    { userId: sfprOwner.id, workspaceId: workspaceSfpr.id, role: "WORKSPACE_OWNER" as const },
    { userId: dnxOwner.id, workspaceId: workspaceDnx.id, role: "WORKSPACE_OWNER" as const },
    { userId: dnxDevUser.id, workspaceId: workspaceDnx.id, role: "WORKSPACE_ADMIN" as const },
  ];
  for (const row of unifiedMemberships) {
    await prisma.workspaceMembership.upsert({
      where: {
        userId_workspaceId: {
          userId: row.userId,
          workspaceId: row.workspaceId,
        },
      },
      update: { role: row.role },
      create: row,
    });
  }

  // AppAccess por workspace (ejemplos de la suite).
  const unifiedAccess = [
    // Daniel: acceso completo en DNX y SFPR
    { userId: danielUser.id, workspaceId: workspaceDnx.id, app: "FOTOFFICE" as const, appRole: "CRM_ADMIN" as const },
    { userId: danielUser.id, workspaceId: workspaceDnx.id, app: "COMPRAMELAFOTO" as const, appRole: "PHOTOGRAPHER" as const },
    { userId: danielUser.id, workspaceId: workspaceDnx.id, app: "FOTORANK" as const, appRole: "ORGANIZER_ADMIN" as const },
    { userId: danielUser.id, workspaceId: workspaceSfpr.id, app: "FOTOFFICE" as const, appRole: "CRM_ADMIN" as const },
    { userId: danielUser.id, workspaceId: workspaceSfpr.id, app: "COMPRAMELAFOTO" as const, appRole: "LAB" as const },
    { userId: danielUser.id, workspaceId: workspaceSfpr.id, app: "FOTORANK" as const, appRole: "ORGANIZER_ADMIN" as const },
    // Owners de cada workspace
    { userId: sfprOwner.id, workspaceId: workspaceSfpr.id, app: "FOTOFFICE" as const, appRole: "SALES_ADMIN" as const },
    { userId: sfprOwner.id, workspaceId: workspaceSfpr.id, app: "COMPRAMELAFOTO" as const, appRole: "LAB" as const },
    { userId: sfprOwner.id, workspaceId: workspaceSfpr.id, app: "FOTORANK" as const, appRole: "ORGANIZER_ADMIN" as const },
    { userId: dnxOwner.id, workspaceId: workspaceDnx.id, app: "FOTOFFICE" as const, appRole: "CRM_ADMIN" as const },
    { userId: dnxOwner.id, workspaceId: workspaceDnx.id, app: "COMPRAMELAFOTO" as const, appRole: "PHOTOGRAPHER" as const },
    { userId: dnxOwner.id, workspaceId: workspaceDnx.id, app: "FOTORANK" as const, appRole: "ORGANIZER_ADMIN" as const },
    // Usuario dev limpio para Fotoffice (DNX Estudio)
    { userId: dnxDevUser.id, workspaceId: workspaceDnx.id, app: "FOTOFFICE" as const, appRole: "CRM_ADMIN" as const },
  ];
  for (const row of unifiedAccess) {
    await prisma.workspaceAppAccess.upsert({
      where: {
        userId_workspaceId_app: {
          userId: row.userId,
          workspaceId: row.workspaceId,
          app: row.app,
        },
      },
      update: { enabled: true, appRole: row.appRole },
      create: {
        userId: row.userId,
        workspaceId: row.workspaceId,
        app: row.app,
        enabled: true,
        appRole: row.appRole,
      },
    });
  }

  /**
   * El seed antiguo de `Judge` / `Contest` / `Category` / `Entry` / `Score` / `Ranking` / `Diploma`
   * fue eliminado: esos modelos ya no existen en `schema.prisma`. Los datos de demo y E2E de Fotorank
   * viven en `FotorankContest`, `FotorankJudgeAccount`, etc. en la sección siguiente.
   */

  // --- Fotorank / Jurados: fixtures deterministas para demo local y E2E ---
  await seedFotorankGlobalMasterCatalog();

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
  await linkContestCategoryToGlobalPrimary(catGeneral.id, "general");
  await linkContestCategoryToGlobalPrimary(catInvite.id, "documental");

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
  await linkContestCategoryToGlobalPrimary(catDraft.id, "general");

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

  await seedFotofficeCoursesSalesDemo([user.id, danielUser.id, dnxDevUser.id]);

  const dnxEstudioBranding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: "dnx-estudio" },
    select: { workspaceId: true },
  });
  if (dnxEstudioBranding) {
    await prisma.membership.upsert({
      where: {
        userId_workspaceId: { userId: dnxDevUser.id, workspaceId: dnxEstudioBranding.workspaceId },
      },
      update: { role: "ADMIN" },
      create: {
        userId: dnxDevUser.id,
        workspaceId: dnxEstudioBranding.workspaceId,
        role: "ADMIN",
      },
    });
    await prisma.workspaceMembership.upsert({
      where: {
        userId_workspaceId: { userId: dnxDevUser.id, workspaceId: dnxEstudioBranding.workspaceId },
      },
      update: { role: "WORKSPACE_ADMIN" },
      create: {
        userId: dnxDevUser.id,
        workspaceId: dnxEstudioBranding.workspaceId,
        role: "WORKSPACE_ADMIN",
      },
    });
    await prisma.workspaceAppAccess.upsert({
      where: {
        userId_workspaceId_app: {
          userId: dnxDevUser.id,
          workspaceId: dnxEstudioBranding.workspaceId,
          app: "FOTOFFICE",
        },
      },
      update: { enabled: true, appRole: "CRM_ADMIN" },
      create: {
        userId: dnxDevUser.id,
        workspaceId: dnxEstudioBranding.workspaceId,
        app: "FOTOFFICE",
        enabled: true,
        appRole: "CRM_ADMIN",
      },
    });
  }

  await seedInfoSpotEditorialBase({
    directorUserId: danielUser.id,
    redactorUserId: dnxDevUser.id,
  });

  console.log("Seed completado correctamente.");
}

/**
 * Info Spot — settings, categorías base y roles editoriales de ejemplo.
 * Idempotente. No crea noticias ni integra CLF.
 */
async function seedInfoSpotEditorialBase(options: {
  directorUserId: number;
  redactorUserId?: number;
}) {
  const existingSettings = await prisma.infoSpotSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existingSettings) {
    await prisma.infoSpotSettings.update({
      where: { id: existingSettings.id },
      data: {
        siteName: "Info Spot",
        slogan: "Descubrí lo que está pasando cerca tuyo.",
        seoTitle: "Info Spot",
        seoDescription:
          "Medio digital argentino dedicado a la cobertura, difusión y comunicación de eventos deportivos, culturales y sociales.",
      },
    });
  } else {
    await prisma.infoSpotSettings.create({
      data: {
        siteName: "Info Spot",
        slogan: "Descubrí lo que está pasando cerca tuyo.",
        seoTitle: "Info Spot",
        seoDescription:
          "Medio digital argentino dedicado a la cobertura, difusión y comunicación de eventos deportivos, culturales y sociales.",
      },
    });
  }

  const categories: { name: string; slug: string; description: string }[] = [
    { name: "Deportes", slug: "deportes", description: "Cobertura deportiva y agenda." },
    { name: "Cultura", slug: "cultura", description: "Cultura, arte y agenda social." },
    { name: "Fotografía", slug: "fotografia", description: "Fotografía, autores y oficio." },
    { name: "Eventos", slug: "eventos", description: "Eventos cerca tuyo." },
  ];
  for (const category of categories) {
    await prisma.infoSpotCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }

  await prisma.infoSpotUserRole.upsert({
    where: { userId: options.directorUserId },
    update: {
      role: "INFOSPOT_DIRECTOR",
      canPublish: true,
      status: "ACTIVE",
    },
    create: {
      userId: options.directorUserId,
      role: "INFOSPOT_DIRECTOR",
      canPublish: true,
      status: "ACTIVE",
    },
  });

  if (options.redactorUserId && options.redactorUserId !== options.directorUserId) {
    await prisma.infoSpotUserRole.upsert({
      where: { userId: options.redactorUserId },
      update: {
        role: "INFOSPOT_REDACTOR",
        canPublish: true,
        status: "ACTIVE",
      },
      create: {
        userId: options.redactorUserId,
        role: "INFOSPOT_REDACTOR",
        canPublish: true,
        status: "ACTIVE",
      },
    });
  }

  console.log("Info Spot: settings, categorías y roles editoriales sembrados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
