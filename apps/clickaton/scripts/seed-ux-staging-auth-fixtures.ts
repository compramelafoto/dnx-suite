/**
 * Seed seguro de cuentas + edición piloto para validación UX autenticada en staging.
 *
 *   CLICKATON_SEED_UX_STAGING=1 pnpm --filter clickaton seed:ux-staging-auth
 *
 * - Solo ep-round-fog (dnx staging identity).
 * - Escribe credenciales en `.local/clickaton-ux-staging/credentials.json` (gitignored).
 * - No imprime contraseñas.
 * - No toca producción.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { hashPassword } from "@repo/auth";
import { prisma } from "@repo/db";
import { classifySmokeDatabaseUrl } from "./lib/classify-smoke-database-url";
import {
  PILOT_EDITION_SLUG,
  seedPilotEditionTest,
} from "./seed-pilot-edition-test";

const FIXTURE_TAG = "TEST UX";
const DOMAIN = "clickaton.staging.test";

const PROFILES = [
  {
    key: "admin",
    email: `ux.admin@${DOMAIN}`,
    name: `${FIXTURE_TAG} Admin Staging`,
    globalRole: "SUPER_ADMIN" as const,
    role: "CUSTOMER" as const,
  },
  {
    key: "participantConfirmed",
    email: `ux.participant.confirmed@${DOMAIN}`,
    name: `${FIXTURE_TAG} Participante Confirmado`,
    globalRole: "USER" as const,
    role: "CUSTOMER" as const,
  },
  {
    key: "participantEmpty",
    email: `ux.participant.empty@${DOMAIN}`,
    name: `${FIXTURE_TAG} Participante Sin Inscripcion`,
    globalRole: "USER" as const,
    role: "CUSTOMER" as const,
  },
  {
    key: "noPermission",
    email: `ux.noperm@${DOMAIN}`,
    name: `${FIXTURE_TAG} Sin Permisos Admin`,
    globalRole: "USER" as const,
    role: "CUSTOMER" as const,
  },
] as const;

function genPassword(): string {
  return `Ux!${randomBytes(12).toString("base64url")}9a`;
}

function maskEmail(email: string): string {
  return email.replace(/(.{3}).+(@.+)/, "$1***$2");
}

async function assertStagingDatabase(): Promise<{ hostHint: string }> {
  const url = process.env.DATABASE_URL ?? "";
  const cls = classifySmokeDatabaseUrl(url);
  if (cls.classification !== "staging" || !cls.safeForTestSmoke) {
    throw new Error(
      `Refusing seed: DATABASE_URL not staging-safe (${cls.classification}/${cls.reason})`,
    );
  }
  if (!url.includes("ep-round-fog") || url.includes("ep-dawn-dew")) {
    throw new Error("Refusing seed: host fingerprint is not ep-round-fog staging");
  }
  let hostHint = "ep-round-fog…";
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/i, "http:"));
    hostHint = u.hostname.replace(/(ep-round-fog)(-[a-z0-9]+).*/, "$1…");
  } catch {
    /* ignore */
  }
  return { hostHint };
}

async function upsertUxUser(input: {
  email: string;
  name: string;
  password: string;
  globalRole: "USER" | "SUPER_ADMIN";
  role: string;
}): Promise<{ id: number; created: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  const password = hashPassword(input.password);
  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password,
        role: input.role,
        globalRole: input.globalRole,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  }
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      password,
      globalRole: input.globalRole,
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
  });
  return { id: existing.id, created: false };
}

async function ensureConfirmedRegistration(userId: number, email: string) {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: PILOT_EDITION_SLUG },
    select: { id: true },
  });
  if (!edition) return null;

  const ticket = await prisma.clickatonTicketType.findFirst({
    where: { editionId: edition.id, code: "FREE_TEST", isActive: true },
    select: { id: true },
  });

  const existing = await prisma.clickatonRegistration.findFirst({
    where: { userId, editionId: edition.id },
    select: { id: true, status: true, paymentStatus: true, firstName: true, lastName: true },
  });
  if (existing) {
    if (!existing.firstName.trim() || !existing.lastName.trim()) {
      await prisma.clickatonRegistration.update({
        where: { id: existing.id },
        data: { firstName: "TEST UX", lastName: "Confirmado" },
      });
    }
    return existing;
  }

  if (!ticket) return null;

  const now = new Date();
  const created = await prisma.clickatonRegistration.create({
    data: {
      editionId: edition.id,
      userId,
      ticketTypeId: ticket.id,
      email,
      firstName: "TEST UX",
      lastName: "Confirmado",
      documentNumber: `UX${userId}`,
      phone: "+5491100000000",
      instagramHandle: "test_ux_confirmado",
      instagramHandleNormalized: "test_ux_confirmado",
      status: "CONFIRMED",
      paymentStatus: "APPROVED",
      totalAmount: 0,
      currency: "ARS",
      confirmedAt: now,
      acceptedTermsAt: now,
      acceptedImageAt: now,
      termsAcceptedAt: now,
      imageUsageConsent: true,
      socialPublicationConsent: true,
      consentAcceptedAt: now,
      consentVersion: "ux-staging-fixture",
      termsVersion: "ux-staging-fixture",
    },
    select: { id: true, status: true, paymentStatus: true },
  });
  return created;
}

async function ensurePendingRegistration(userId: number, email: string) {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: PILOT_EDITION_SLUG },
    select: { id: true },
  });
  if (!edition) return null;
  const ticket = await prisma.clickatonTicketType.findFirst({
    where: { editionId: edition.id, code: "FREE_TEST", isActive: true },
    select: { id: true },
  });
  if (!ticket) return null;
  const existing = await prisma.clickatonRegistration.findFirst({
    where: { userId, editionId: edition.id },
    select: { id: true, status: true, paymentStatus: true, firstName: true, lastName: true },
  });
  if (existing) {
    if (!existing.firstName.trim() || !existing.lastName.trim()) {
      await prisma.clickatonRegistration.update({
        where: { id: existing.id },
        data: { firstName: "TEST UX", lastName: "Pendiente" },
      });
    }
    return existing;
  }
  const now = new Date();
  return prisma.clickatonRegistration.create({
    data: {
      editionId: edition.id, userId, ticketTypeId: ticket.id, email,
      firstName: "TEST UX", lastName: "Pendiente", documentNumber: `UXP${userId}`,
      phone: "+5491100000000", instagramHandle: "test_ux_pendiente",
      instagramHandleNormalized: "test_ux_pendiente", status: "PENDING_PAYMENT",
      paymentStatus: "PENDING", totalAmount: 0, currency: "ARS",
      acceptedTermsAt: now, acceptedImageAt: now, termsAcceptedAt: now,
      imageUsageConsent: true, socialPublicationConsent: true, consentAcceptedAt: now,
      consentVersion: "ux-staging-fixture", termsVersion: "ux-staging-fixture",
    },
    select: { id: true, status: true, paymentStatus: true },
  });
}

async function main() {
  if (process.env.CLICKATON_SEED_UX_STAGING !== "1") {
    console.error("Set CLICKATON_SEED_UX_STAGING=1 to run.");
    process.exit(1);
  }

  const db = await assertStagingDatabase();
  const pilot = await seedPilotEditionTest();

  const credentials: Record<
    string,
    { email: string; password: string; userId: number; role: string }
  > = {};
  const summary: Array<Record<string, unknown>> = [];

  for (const profile of PROFILES) {
    const password = genPassword();
    const user = await upsertUxUser({
      email: profile.email,
      name: profile.name,
      password,
      globalRole: profile.globalRole,
      role: profile.role,
    });
    credentials[profile.key] = {
      email: profile.email,
      password,
      userId: user.id,
      role: profile.globalRole,
    };
    let registration: { id: string; status: string; paymentStatus: string } | null =
      null;
    if (profile.key === "participantConfirmed") {
      registration = await ensureConfirmedRegistration(user.id, profile.email);
    } else if (profile.key === "participantEmpty") {
      registration = await ensurePendingRegistration(user.id, profile.email);
    }
    summary.push({
      key: profile.key,
      emailMasked: maskEmail(profile.email),
      userId: user.id,
      created: user.created,
      globalRole: profile.globalRole,
      registrationIdPrefix: registration ? `${registration.id.slice(0, 8)}…` : null,
      registrationStatus: registration?.status ?? null,
    });
  }

  const outDir = join(process.cwd(), "../../.local/clickaton-ux-staging");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "credentials.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        environment: "staging",
        hostHint: db.hostHint,
        baseUrl: "https://clickaton-staging.vercel.app",
        pilotSlug: pilot.slug,
        note: "LOCAL ONLY — gitignored via .local/. Do not commit. Rotate after use.",
        credentials,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        hostHint: db.hostHint,
        pilot,
        profiles: summary,
        credentialsPath: ".local/clickaton-ux-staging/credentials.json",
        cleanup:
          "Delete users with email *@clickaton.staging.test and edition slug piloto-test-11b when QA ends, or keep as labeled fixtures.",
      },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
