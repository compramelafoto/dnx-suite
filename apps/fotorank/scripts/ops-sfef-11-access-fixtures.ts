/**
 * Fixtures ETAPA 11 — matriz de acceso (roles).
 * Solo staging (ep-round-fog). Creds → /tmp/sfef-11-creds.env
 *
 *   DATABASE_URL=...staging... \
 *   SFEF11_ALLOW_FIXTURES=1 \
 *   pnpm --filter @repo/db exec tsx apps/fotorank/scripts/ops-sfef-11-access-fixtures.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";

const KEY_LEN = 64;
const PASSWORD = `Sfef11-A-${randomBytes(3).toString("hex")}!`;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

function assertStaging() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`ABORT host no staging: ${host}`);
  }
  if (process.env.SFEF11_ALLOW_FIXTURES !== "1") {
    throw new Error("ABORT: SFEF11_ALLOW_FIXTURES=1 requerido");
  }
}

async function ensureUser(
  email: string,
  name: string,
  opts: { globalRole?: "USER" | "SUPER_ADMIN"; role?: "CUSTOMER" | "ORGANIZER" | "SUPER_ADMIN" } = {},
) {
  const globalRole = opts.globalRole ?? "USER";
  const role =
    opts.role ??
    (globalRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "CUSTOMER");
  const password = hashPassword(PASSWORD);
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password,
      role,
      globalRole,
      emailVerifiedAt: new Date(),
      province: "Santa Fe",
      country: "Argentina",
    },
    update: {
      name,
      password,
      globalRole,
      role,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true },
  });
}

async function main() {
  assertStaging();
  const runId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    include: { categories: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!contest) throw new Error("contest santa-fe-en-foco missing on staging");
  const category = contest.categories[0];
  if (!category) throw new Error("no ACTIVE category");

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing");

  let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: "SFEF11 Workspace" } });
  }

  const emails = {
    participant: `sfef11-p-${runId}@fotorank.test`,
    organizer: `sfef11-o-${runId}@fotorank.test`,
    jury: `sfef11-j-${runId}@fotorank.test`,
    partJury: `sfef11-pj-${runId}@fotorank.test`,
    orgPart: `sfef11-op-${runId}@fotorank.test`,
    orgJury: `sfef11-oj-${runId}@fotorank.test`,
    superAdmin: `sfef11-sa-${runId}@fotorank.test`,
    empty: `sfef11-empty-${runId}@fotorank.test`,
  };

  const users = {
    participant: await ensureUser(emails.participant, "SFEF11 Participant"),
    organizer: await ensureUser(emails.organizer, "SFEF11 Organizer", {
      role: "ORGANIZER",
    }),
    jury: await ensureUser(emails.jury, "SFEF11 Jury"),
    partJury: await ensureUser(emails.partJury, "SFEF11 Part+Jury"),
    orgPart: await ensureUser(emails.orgPart, "SFEF11 Org+Part", { role: "ORGANIZER" }),
    orgJury: await ensureUser(emails.orgJury, "SFEF11 Org+Jury", { role: "ORGANIZER" }),
    superAdmin: await ensureUser(emails.superAdmin, "SFEF11 SuperAdmin", {
      globalRole: "SUPER_ADMIN",
      role: "SUPER_ADMIN",
    }),
    empty: await ensureUser(emails.empty, "SFEF11 Empty"),
  };

  async function addOrgMember(userId: number) {
    await prisma.contestOrganizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: contest.organizationId,
          userId,
        },
      },
      create: {
        organizationId: contest.organizationId,
        userId,
        role: "ADMIN",
        status: "ACTIVE",
      },
      update: { role: "ADMIN", status: "ACTIVE" },
    });
  }

  async function addRegistration(userId: number, tag: string) {
    const existing = await prisma.fotorankContestRegistration.findFirst({
      where: { contestId: contest.id, participantUserId: userId },
      select: { id: true },
    });
    if (existing) return existing.id;
    const reg = await prisma.fotorankContestRegistration.create({
      data: {
        contestId: contest.id,
        categoryId: category.id,
        participantUserId: userId,
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        paymentModeSnapshot: "FREE",
        registrationNumber: `SFEF11-${tag}-${runId}`.slice(0, 32),
        rulesVersionId: rulesVersion.id,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        confirmedAt: new Date(),
        licenseAccepted: true,
        licenseAcceptedAt: new Date(),
        declaredAgeYears: 30,
        answersJson: {},
      },
    });
    return reg.id;
  }

  async function addJudge(email: string, createdByUserId: number) {
    const passwordHash = hashPassword(PASSWORD);
    const account = await prisma.fotorankJudgeAccount.upsert({
      where: { email },
      create: {
        email,
        workspaceId: workspace!.id,
        passwordHash,
        accountStatus: "ACTIVE",
      },
      update: {
        passwordHash,
        accountStatus: "ACTIVE",
      },
      select: { id: true },
    });
    const existing = await prisma.fotorankJudgeAssignment.findFirst({
      where: {
        contestId: contest.id,
        judgeAccountId: account.id,
        categoryId: category.id,
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.fotorankJudgeAssignment.create({
        data: {
          judgeAccountId: account.id,
          organizationId: contest.organizationId,
          contestId: contest.id,
          categoryId: category.id,
          assignmentType: "PRIMARY",
          assignmentStatus: "ACCEPTED",
          methodType: "CRITERIA_BASED",
          methodConfigJson: { source: "sfef11-fixture" },
          allowVoteEdit: false,
          createdByUserId,
        },
      });
    }
    return account.id;
  }

  await addRegistration(users.participant.id, "p");
  await addOrgMember(users.organizer.id);
  await addJudge(emails.jury, users.organizer.id);

  await addRegistration(users.partJury.id, "pj");
  await addJudge(emails.partJury, users.organizer.id);

  await addOrgMember(users.orgPart.id);
  await addRegistration(users.orgPart.id, "op");

  await addOrgMember(users.orgJury.id);
  await addJudge(emails.orgJury, users.organizer.id);

  const lines = [
    `# SFEF11 access fixtures ${runId}`,
    `SFEF11_RUN_ID=${runId}`,
    `SFEF11_PASSWORD=${PASSWORD}`,
    `SFEF11_PARTICIPANT_EMAIL=${emails.participant}`,
    `SFEF11_ORGANIZER_EMAIL=${emails.organizer}`,
    `SFEF11_JURY_EMAIL=${emails.jury}`,
    `SFEF11_PART_JURY_EMAIL=${emails.partJury}`,
    `SFEF11_ORG_PART_EMAIL=${emails.orgPart}`,
    `SFEF11_ORG_JURY_EMAIL=${emails.orgJury}`,
    `SFEF11_SUPER_ADMIN_EMAIL=${emails.superAdmin}`,
    `SFEF11_EMPTY_EMAIL=${emails.empty}`,
    `SFEF11_CONTEST_ID=${contest.id}`,
    `SFEF11_ORG_ID=${contest.organizationId}`,
  ];
  const out = "/tmp/sfef-11-creds.env";
  writeFileSync(out, `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        credsPath: out,
        emails: Object.fromEntries(
          Object.entries(emails).map(([k, v]) => [
            k,
            v.replace(/(.{4}).+(@.+)/, "$1***$2"),
          ]),
        ),
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
