/**
 * Bootstrap organizador sintético + fixtures UI ETAPA 06B (solo staging round-fog).
 * Escribe credenciales en /tmp/sfef-06b-creds.env (nunca en el repo).
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";

const KEY_LEN = 64;
const PASSWORD = `Sfef06b-Org-${randomBytes(4).toString("hex")}!`;

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
}

async function main() {
  assertStaging();
  const runId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const orgEmail = `sfef06b-org-${runId}@fotorank.test`;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    include: { categories: { where: { status: "ACTIVE" } } },
  });
  if (!contest) throw new Error("contest missing");

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing");

  const orgUser = await prisma.user.create({
    data: {
      email: orgEmail,
      name: "SFEF06B Organizer",
      password: hashPassword(PASSWORD),
      role: "ORGANIZER",
      province: "Santa Fe",
      country: "Argentina",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.contestOrganizationMember.create({
    data: {
      organizationId: contest.organizationId,
      userId: orgUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const bySlug = Object.fromEntries(contest.categories.map((c) => [c.slug, c.id]));

  async function makeParticipant(key: string) {
    return prisma.user.create({
      data: {
        email: `sfef06b-${key}-${runId}@fotorank.test`,
        name: `SFEF06B ${key}`,
        password: hashPassword(PASSWORD),
        province: "Córdoba",
        country: "Argentina",
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function makeEntry(opts: {
    userId: number;
    categoryId: string;
    admissionStatus:
      | "ELIGIBLE"
      | "PENDING_MANUAL_REVIEW"
      | "ADMITTED"
      | "REJECTED";
    answersJson?: object;
    deviceKind?: string;
    reasonCodes?: string[];
  }) {
    const reg = await prisma.fotorankContestRegistration.create({
      data: {
        contestId: contest.id,
        categoryId: opts.categoryId,
        participantUserId: opts.userId,
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        paymentModeSnapshot: "FREE",
        registrationNumber: `SFEF06B-${runId}-${randomBytes(2).toString("hex")}`.slice(0, 32),
        rulesVersionId: rulesVersion.id,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        confirmedAt: new Date(),
        licenseAccepted: true,
        licenseAcceptedAt: new Date(),
        declaredAgeYears: 28,
        answersJson: opts.answersJson ?? {},
      },
    });
    return prisma.fotorankContestEntry.create({
      data: {
        contestId: contest.id,
        categoryId: opts.categoryId,
        registrationId: reg.id,
        authorUserId: opts.userId,
        status: opts.admissionStatus === "REJECTED" ? "REJECTED" : "CONFIRMED",
        technicalSummaryStatus:
          opts.admissionStatus === "PENDING_MANUAL_REVIEW" ? "REQUIRES_REVIEW" : "APPROVED",
        manualReviewStatus: opts.admissionStatus === "PENDING_MANUAL_REVIEW" ? "PENDING" : "NONE",
        admissionStatus: opts.admissionStatus,
        submittedAt: new Date(),
        confirmedAt: new Date(),
        imageUrl: "",
        title: `SFEF06B ${runId}`,
        entryNumber: `SFE6B-${runId.slice(-6)}-${randomBytes(1).toString("hex")}`.toUpperCase(),
        metadataJson: {
          eligibility: {
            captureLocality: "Rosario",
            territoryConfirmedSantaFe: true,
            declaredDeviceKind: opts.deviceKind ?? "SMARTPHONE",
            gpsPresent: false,
          },
          admissionOps: {
            lastReasonCodes: opts.reasonCodes ?? [],
            rulesVersion: "santa-fe-admission-draft-v1",
          },
        },
      },
    });
  }

  const uReporter = await makeParticipant("reporter");
  const eReporter = await makeEntry({
    userId: uReporter.id,
    categoryId: bySlug["reportero-grafico"],
    admissionStatus: "PENDING_MANUAL_REVIEW",
    answersJson: {
      argraMembershipNumber: `SYNTH-ARGRA-06B-${runId}`,
      argraVerificationStatus: "PENDING_VERIFICATION",
    },
    reasonCodes: ["ARGRA_VERIFICATION_PENDING"],
  });

  const uEvidence = await makeParticipant("evidence");
  const eEvidence = await makeEntry({
    userId: uEvidence.id,
    categoryId: bySlug["fotografia-aerea"],
    admissionStatus: "PENDING_MANUAL_REVIEW",
    deviceKind: "DRONE",
    reasonCodes: ["AERIAL_DEVICE_NOT_IDENTIFIED"],
  });

  const uPro = await makeParticipant("pro");
  const ePro = await makeEntry({
    userId: uPro.id,
    categoryId: bySlug["fotografo-profesional"],
    admissionStatus: "PENDING_MANUAL_REVIEW",
    deviceKind: "SMARTPHONE",
    reasonCodes: ["PROFESSIONAL_PHONE_NOT_ALLOWED"],
  });

  const uReject = await makeParticipant("reject");
  const eReject = await makeEntry({
    userId: uReject.id,
    categoryId: bySlug["fotografo-amateur"],
    admissionStatus: "PENDING_MANUAL_REVIEW",
    reasonCodes: ["CAPTURE_DATE_BEFORE_WINDOW"],
  });

  const uAdmit = await makeParticipant("admit");
  const eAdmit = await makeEntry({
    userId: uAdmit.id,
    categoryId: bySlug["fotografo-amateur"],
    admissionStatus: "ELIGIBLE",
    deviceKind: "SMARTPHONE",
  });

  const uFreeze = await makeParticipant("freeze");
  const eFreeze = await makeEntry({
    userId: uFreeze.id,
    categoryId: bySlug["fotografo-amateur"],
    admissionStatus: "ADMITTED",
    deviceKind: "SMARTPHONE",
  });

  const credsPath = "/tmp/sfef-06b-creds.env";
  const body = [
    `SFEF_06_ORG_EMAIL=${orgEmail}`,
    `SFEF_06_ORG_PASSWORD=${PASSWORD}`,
    `SFEF_06_CONTEST_ID=${contest.id}`,
    `SFEF_06B_RUN_ID=${runId}`,
    `SFEF_06B_ENTRY_REPORTER=${eReporter.id}`,
    `SFEF_06B_ENTRY_EVIDENCE=${eEvidence.id}`,
    `SFEF_06B_ENTRY_PRO=${ePro.id}`,
    `SFEF_06B_ENTRY_REJECT=${eReject.id}`,
    `SFEF_06B_ENTRY_ADMIT=${eAdmit.id}`,
    `SFEF_06B_ENTRY_FREEZE=${eFreeze.id}`,
    `SFEF_06B_PARTICIPANT_PRO_EMAIL=${uPro.email}`,
    `SFEF_06B_PARTICIPANT_PASSWORD=${PASSWORD}`,
    `PLAYWRIGHT_BASE_URL=https://fotorank.staging.dnxsuite.com`,
  ].join("\n");
  writeFileSync(credsPath, body + "\n", { mode: 0o600 });

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        contestId: contest.id,
        orgUserId: orgUser.id,
        orgEmailDomain: "@fotorank.test",
        credsPath,
        entries: {
          reporter: eReporter.id,
          evidence: eEvidence.id,
          pro: ePro.id,
          reject: eReject.id,
          admit: eAdmit.id,
          freeze: eFreeze.id,
        },
        note: "Password only in /tmp/sfef-06b-creds.env — never commit.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
