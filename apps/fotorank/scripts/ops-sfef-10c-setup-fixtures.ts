/**
 * Fixtures E2E Production ETAPA 10C — Santa Fe en Foco (admisión + upload + emails).
 * Escribe credenciales en /tmp/sfef-10c-creds.env (nunca en el repo).
 *
 * Uso:
 *   DATABASE_URL=...prod SFEF10C_ALLOW_PRODUCTION_FIXTURES=1 \
 *     pnpm --filter @repo/db exec tsx ../../apps/fotorank/scripts/ops-sfef-10c-setup-fixtures.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import type { FotorankCheckGroup, FotorankCheckStatus } from "@prisma/client";

const KEY_LEN = 64;
const KNOWN_CONTEST_ID = "cmsf1je750005xpzcrizp52rd";
const CONTEST_SLUG = "santa-fe-en-foco";
const CREDS_PATH = process.env.SFEF10C_CREDS_PATH ?? "/tmp/sfef-10c-creds.env";
const SFEF09_CREDS_PATH = process.env.SFEF09_CREDS_PATH ?? "/tmp/sfef-09-e2e.env";
const PASSWORD = `Sfef10c-${randomBytes(4).toString("hex")}!`;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  return out;
}

function assertProduction() {
  if (process.env.SFEF10C_ALLOW_PRODUCTION_FIXTURES !== "1") {
    throw new Error("ABORT: SFEF10C_ALLOW_PRODUCTION_FIXTURES=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url || /ep-round-fog|staging|localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL no parece Production (no staging / localhost)");
  }
}

type CheckSeed = {
  checkCode: string;
  checkGroup: FotorankCheckGroup;
  status: FotorankCheckStatus;
  title: string;
  message: string;
};

async function seedChecks(entryId: string, profile: "admit" | "reject" | "evidence" | "replace") {
  const byProfile: Record<typeof profile, CheckSeed[]> = {
    admit: [
      {
        checkCode: "META_DEVICE",
        checkGroup: "METADATA",
        status: "PASS",
        title: "Dispositivo declarado",
        message: "Smartphone amateur permitido.",
      },
      {
        checkCode: "META_CAPTURE_DATE",
        checkGroup: "METADATA",
        status: "PASS",
        title: "Fecha de captura",
        message: "Dentro de la ventana del concurso.",
      },
      {
        checkCode: "CAT_TERRITORY",
        checkGroup: "CATEGORY",
        status: "PASS",
        title: "Territorio Santa Fe",
        message: "Localidad declarada válida.",
      },
    ],
    reject: [
      {
        checkCode: "META_CAPTURE_DATE",
        checkGroup: "TIMING",
        status: "FAIL",
        title: "Fecha de captura",
        message: "Captura anterior al inicio del período.",
      },
      {
        checkCode: "META_DEVICE",
        checkGroup: "METADATA",
        status: "PASS",
        title: "Dispositivo",
        message: "Smartphone.",
      },
    ],
    evidence: [
      {
        checkCode: "CAT_DEVICE",
        checkGroup: "CATEGORY",
        status: "REQUIRES_REVIEW",
        title: "Dispositivo aéreo",
        message: "Se requiere evidencia de equipo.",
      },
      {
        checkCode: "META_DEVICE",
        checkGroup: "METADATA",
        status: "WARNING",
        title: "EXIF dispositivo",
        message: "Modelo de dron no identificado en metadatos.",
      },
    ],
    replace: [
      {
        checkCode: "CAT_DEVICE",
        checkGroup: "CATEGORY",
        status: "FAIL",
        title: "Profesional + smartphone",
        message: "Categoría profesional no admite smartphone.",
      },
      {
        checkCode: "META_DEVICE",
        checkGroup: "METADATA",
        status: "PASS",
        title: "Dispositivo EXIF",
        message: "Smartphone detectado.",
      },
    ],
  };

  await prisma.fotorankContestEntryCheck.createMany({
    data: byProfile[profile].map((c) => ({ entryId, ...c })),
  });
}

async function main() {
  assertProduction();

  const executionId =
    process.env.SFEF10C_EXECUTION_ID?.trim() ||
    `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: CONTEST_SLUG },
    include: { categories: { where: { status: "ACTIVE" } } },
  });
  if (!contest) throw new Error(`contest missing slug=${CONTEST_SLUG}`);
  if (contest.id !== KNOWN_CONTEST_ID) {
    console.warn(
      JSON.stringify({
        warn: "contest id distinto al conocido",
        expected: KNOWN_CONTEST_ID,
        got: contest.id,
      }),
    );
  }

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing");

  const bySlug = Object.fromEntries(contest.categories.map((c) => [c.slug, c.id]));
  const amateurCat = bySlug["fotografo-amateur"];
  const aerialCat = bySlug["fotografia-aerea"];
  const proCat = bySlug["fotografo-profesional"];
  if (!amateurCat || !aerialCat || !proCat) throw new Error("categories missing");

  // Org sintético siempre (no reutilizar admin@ real: creds e2e09 pueden no coincidir).
  void parseEnvFile(SFEF09_CREDS_PATH);
  let orgEmail = `sfef10c-org-${executionId}@fotorank.test`;
  let orgPassword = PASSWORD;
  let orgUserId: number | null = null;
  let orgCreated = false;

  {
    const existingOrg = await prisma.user.findUnique({
      where: { email: orgEmail },
      select: { id: true },
    });
    if (existingOrg) {
      orgUserId = existingOrg.id;
      await prisma.user.update({
        where: { id: existingOrg.id },
        data: { password: hashPassword(orgPassword) },
      });
    } else {
      const orgUser = await prisma.user.create({
        data: {
          email: orgEmail,
          name: "SFEF10C Organizer",
          password: hashPassword(orgPassword),
          role: "ORGANIZER",
          province: "Santa Fe",
          country: "Argentina",
          emailVerifiedAt: new Date(),
        },
      });
      orgUserId = orgUser.id;
      orgCreated = true;
    }
    const mem = await prisma.contestOrganizationMember.findFirst({
      where: { organizationId: contest.organizationId, userId: orgUserId },
    });
    if (!mem) {
      await prisma.contestOrganizationMember.create({
        data: {
          organizationId: contest.organizationId,
          userId: orgUserId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    } else if (mem.status !== "ACTIVE") {
      await prisma.contestOrganizationMember.update({
        where: { id: mem.id },
        data: { status: "ACTIVE", role: "ADMIN" },
      });
    }
  }

  async function makeParticipant(key: string) {
    return prisma.user.create({
      data: {
        email: `sfef10c-${key}-${executionId}@fotorank.test`,
        name: `SFEF10C ${key}`,
        password: hashPassword(PASSWORD),
        province: "Córdoba",
        country: "Argentina",
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function makeRegistration(userId: number, categoryId: string) {
    return prisma.fotorankContestRegistration.create({
      data: {
        contestId: contest.id,
        categoryId,
        participantUserId: userId,
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        paymentModeSnapshot: "FREE",
        registrationNumber: `SFEF10C-${executionId}-${randomBytes(2).toString("hex")}`.slice(0, 32),
        rulesVersionId: rulesVersion.id,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        confirmedAt: new Date(),
        licenseAccepted: true,
        licenseAcceptedAt: new Date(),
        declaredAgeYears: 28,
        answersJson: {},
      },
    });
  }

  async function makeEntry(opts: {
    userId: number;
    categoryId: string;
    registrationId: string;
    admissionStatus: "ELIGIBLE" | "PENDING_MANUAL_REVIEW";
    deviceKind?: string;
    reasonCodes?: string[];
    checkProfile: "admit" | "reject" | "evidence" | "replace";
  }) {
    const entry = await prisma.fotorankContestEntry.create({
      data: {
        contestId: contest.id,
        categoryId: opts.categoryId,
        registrationId: opts.registrationId,
        authorUserId: opts.userId,
        status: "CONFIRMED",
        technicalSummaryStatus:
          opts.admissionStatus === "PENDING_MANUAL_REVIEW" ? "REQUIRES_REVIEW" : "APPROVED",
        manualReviewStatus: opts.admissionStatus === "PENDING_MANUAL_REVIEW" ? "PENDING" : "NONE",
        admissionStatus: opts.admissionStatus,
        submittedAt: new Date(),
        confirmedAt: new Date(),
        imageUrl: "",
        title: `SFEF10C ${executionId}`,
        entryNumber: `SFE10C-${executionId.slice(-6)}-${randomBytes(1).toString("hex")}`.toUpperCase(),
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
    await seedChecks(entry.id, opts.checkProfile);
    return entry;
  }

  const uUpload = await makeParticipant("upload");
  const regUpload = await makeRegistration(uUpload.id, amateurCat);

  const uAdmit = await makeParticipant("admit");
  const regAdmit = await makeRegistration(uAdmit.id, amateurCat);
  const eAdmit = await makeEntry({
    userId: uAdmit.id,
    categoryId: amateurCat,
    registrationId: regAdmit.id,
    admissionStatus: "ELIGIBLE",
    deviceKind: "SMARTPHONE",
    checkProfile: "admit",
  });

  const uReject = await makeParticipant("reject");
  const regReject = await makeRegistration(uReject.id, amateurCat);
  const eReject = await makeEntry({
    userId: uReject.id,
    categoryId: amateurCat,
    registrationId: regReject.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
    deviceKind: "SMARTPHONE",
    reasonCodes: ["CAPTURE_DATE_BEFORE_WINDOW"],
    checkProfile: "reject",
  });

  const uEvidence = await makeParticipant("evidence");
  const regEvidence = await makeRegistration(uEvidence.id, aerialCat);
  const eEvidence = await makeEntry({
    userId: uEvidence.id,
    categoryId: aerialCat,
    registrationId: regEvidence.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
    deviceKind: "DRONE",
    reasonCodes: ["AERIAL_DEVICE_NOT_IDENTIFIED"],
    checkProfile: "evidence",
  });

  const uReplacement = await makeParticipant("replacement");
  const regReplacement = await makeRegistration(uReplacement.id, proCat);
  const eReplacement = await makeEntry({
    userId: uReplacement.id,
    categoryId: proCat,
    registrationId: regReplacement.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
    deviceKind: "SMARTPHONE",
    reasonCodes: ["PROFESSIONAL_PHONE_NOT_ALLOWED"],
    checkProfile: "replace",
  });

  const body = [
    `SFEF10C_EXECUTION_ID=${executionId}`,
    `SFEF10C_CONTEST_ID=${contest.id}`,
    `SFEF10C_CONTEST_SLUG=${CONTEST_SLUG}`,
    `SFEF10C_ORG_EMAIL=${orgEmail}`,
    `SFEF10C_ORG_PASSWORD=${orgPassword}`,
    `SFEF10C_ORG_USER_ID=${orgUserId}`,
    `SFEF10C_ORG_CREATED=${orgCreated ? "1" : "0"}`,
    `SFEF10C_UPLOAD_EMAIL=${uUpload.email}`,
    `SFEF10C_UPLOAD_PASSWORD=${PASSWORD}`,
    `SFEF10C_UPLOAD_REGISTRATION_ID=${regUpload.id}`,
    `SFEF10C_ADMIT_EMAIL=${uAdmit.email}`,
    `SFEF10C_REJECT_EMAIL=${uReject.email}`,
    `SFEF10C_EVIDENCE_EMAIL=${uEvidence.email}`,
    `SFEF10C_REPLACEMENT_EMAIL=${uReplacement.email}`,
    `SFEF10C_PARTICIPANT_PASSWORD=${PASSWORD}`,
    `SFEF10C_ENTRY_ADMIT=${eAdmit.id}`,
    `SFEF10C_ENTRY_REJECT=${eReject.id}`,
    `SFEF10C_ENTRY_EVIDENCE=${eEvidence.id}`,
    `SFEF10C_ENTRY_REPLACEMENT=${eReplacement.id}`,
    `SFEF10C_JPEG_A=/tmp/sfef-10c-a.jpg`,
    `SFEF10C_JPEG_B=/tmp/sfef-10c-b.jpg`,
    `PLAYWRIGHT_BASE_URL=https://fotorank.dnxsuite.com`,
  ].join("\n");
  writeFileSync(CREDS_PATH, body + "\n", { mode: 0o600 });

  console.log(
    JSON.stringify(
      {
        ok: true,
        executionId,
        contestId: contest.id,
        contestSlug: CONTEST_SLUG,
        orgEmail,
        orgCreated,
        credsPath: CREDS_PATH,
        participants: {
          upload: uUpload.email,
          admit: uAdmit.email,
          reject: uReject.email,
          evidence: uEvidence.email,
          replacement: uReplacement.email,
        },
        entries: {
          admit: eAdmit.id,
          reject: eReject.id,
          evidence: eEvidence.id,
          replacement: eReplacement.id,
        },
        note: "Upload participant sin obra — E2E crea entry vía wizard. Passwords solo en creds env.",
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
