/**
 * Setup fixtures E2E placas participante (prefijo E2E_CLICKATON_CARDS_).
 *
 *   CLICKATON_E2E_PARTICIPANT_CARDS_SETUP=1 \
 *   DATABASE_URL=<ep-round-fog> \
 *   pnpm --filter clickaton e2e:clickaton-participant-cards:setup
 *
 * Solo staging (ep-round-fog). Escribe IDs en `.local/clickaton-participant-cards-e2e/`.
 * No imprime secretos ni contraseñas.
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

const PREFIX = "E2E_CLICKATON_CARDS_";
const DOMAIN = "e2e-cards.clickaton.staging.test";

const PROFILES = [
  {
    key: "A",
    email: `${PREFIX.toLowerCase()}a@${DOMAIN}`,
    name: "E2E Clickatón Participante A",
    withInstagram: true,
    withPhoto: true,
  },
  {
    key: "B",
    email: `${PREFIX.toLowerCase()}b@${DOMAIN}`,
    name: "E2E Clickatón Participante B",
    withInstagram: false,
    withPhoto: true,
  },
  {
    key: "C",
    email: `${PREFIX.toLowerCase()}c@${DOMAIN}`,
    name: "E2E Clickatón Participante C",
    withInstagram: true,
    withPhoto: false,
  },
  {
    key: "D",
    email: `${PREFIX.toLowerCase()}d@${DOMAIN}`,
    name: "E2E Clickatón Participante D",
    withInstagram: true,
    withPhoto: true,
  },
  {
    key: "admin",
    email: `${PREFIX.toLowerCase()}admin@${DOMAIN}`,
    name: "E2E Clickatón Admin Cards",
    withInstagram: false,
    withPhoto: false,
    admin: true,
  },
] as const;

function genPassword(): string {
  return `E2E!${randomBytes(12).toString("base64url")}9a`;
}

async function assertStaging(): Promise<string> {
  const url = process.env.DATABASE_URL ?? "";
  const cls = classifySmokeDatabaseUrl(url);
  if (cls.classification !== "staging" || !cls.safeForTestSmoke) {
    throw new Error(`Refusing: DATABASE_URL not staging-safe (${cls.reason})`);
  }
  if (!url.includes("ep-round-fog") || url.includes("ep-dawn-dew")) {
    throw new Error("Refusing: host fingerprint is not ep-round-fog staging");
  }
  return "ep-round-fog…";
}

async function upsertUser(input: {
  email: string;
  name: string;
  password: string;
  admin?: boolean;
}): Promise<number> {
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
        role: "CUSTOMER",
        globalRole: input.admin ? "SUPER_ADMIN" : "USER",
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    return created.id;
  }
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      password,
      globalRole: input.admin ? "SUPER_ADMIN" : "USER",
      emailVerifiedAt: new Date(),
      isBlocked: false,
    },
  });
  return existing.id;
}

async function ensurePhotoAsset(registrationId: string, editionId: string): Promise<string> {
  const key = `${PREFIX}photo_${registrationId}`;
  const existing = await prisma.dnxMediaAsset.findFirst({
    where: {
      ownerId: registrationId,
      ownerType: "REGISTRATION",
      kind: "PROFILE_ORIGINAL",
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const asset = await prisma.dnxMediaAsset.create({
    data: {
      platform: "CLICKATON",
      ownerType: "REGISTRATION",
      ownerId: registrationId,
      editionId,
      registrationId,
      kind: "PROFILE_ORIGINAL",
      storageBackend: "INLINE_DB",
      storageKey: key,
      mimeType: "image/png",
      width: 1,
      height: 1,
      bytes: tinyPng.length,
      contentHash: "e2e_fixture_photo",
      metadata: { inlineBase64: tinyPng.toString("base64"), fixture: PREFIX },
    },
    select: { id: true },
  });
  return asset.id;
}

async function ensureRegistration(input: {
  userId: number;
  email: string;
  name: string;
  withInstagram: boolean;
  withPhoto: boolean;
  sequence: number;
}): Promise<{ id: string }> {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: PILOT_EDITION_SLUG },
    select: { id: true },
  });
  if (!edition) throw new Error(`Pilot edition ${PILOT_EDITION_SLUG} missing`);
  const ticket = await prisma.clickatonTicketType.findFirst({
    where: { editionId: edition.id, code: "FREE_TEST", isActive: true },
    select: { id: true },
  });
  if (!ticket) throw new Error("FREE_TEST ticket missing on pilot edition");

  const existing = await prisma.clickatonRegistration.findFirst({
    where: { userId: input.userId, editionId: edition.id },
    select: { id: true },
  });
  const now = new Date();
  const [firstName, ...rest] = input.name.split(" ");
  const lastName = rest.join(" ") || "Fixture";
  const base = {
    firstName,
    lastName,
    email: input.email,
    documentNumber: `${PREFIX}${input.sequence}`,
    phone: "+5491100000099",
    status: "CONFIRMED" as const,
    paymentStatus: "NOT_REQUIRED" as const,
    totalAmount: 0,
    currency: "ARS",
    confirmedAt: now,
    acceptedTermsAt: now,
    acceptedImageAt: now,
    termsAcceptedAt: now,
    imageUsageConsent: true,
    socialPublicationConsent: true,
    consentAcceptedAt: now,
    consentVersion: "e2e-cards-fixture",
    termsVersion: "e2e-cards-fixture",
    instagramHandle: input.withInstagram ? `e2e_cards_${input.sequence}` : null,
    instagramHandleNormalized: input.withInstagram ? `e2e_cards_${input.sequence}` : null,
    visibleCode: String(9000 + input.sequence).padStart(4, "0"),
    sequenceNumber: 9000 + input.sequence,
  };

  let registrationId: string;
  if (existing) {
    await prisma.clickatonRegistration.update({
      where: { id: existing.id },
      data: base,
    });
    registrationId = existing.id;
  } else {
    const created = await prisma.clickatonRegistration.create({
      data: {
        editionId: edition.id,
        userId: input.userId,
        ticketTypeId: ticket.id,
        ...base,
      },
      select: { id: true },
    });
    registrationId = created.id;
  }

  if (input.withPhoto) {
    const photoId = await ensurePhotoAsset(registrationId, edition.id);
    await prisma.clickatonRegistration.update({
      where: { id: registrationId },
      data: {
        profilePhotoAssetId: photoId,
        profilePhotoStatus: "READY",
        profilePhotoSource: "USER_UPLOAD",
      },
    });
  } else {
    await prisma.clickatonRegistration.update({
      where: { id: registrationId },
      data: {
        profilePhotoAssetId: null,
        profilePhotoStatus: null,
        profilePhotoSource: null,
      },
    });
  }

  return { id: registrationId };
}

async function main() {
  if (process.env.CLICKATON_E2E_PARTICIPANT_CARDS_SETUP !== "1") {
    console.error("Set CLICKATON_E2E_PARTICIPANT_CARDS_SETUP=1 to run.");
    process.exit(1);
  }

  const hostHint = await assertStaging();
  await seedPilotEditionTest();

  const credentials: Record<
    string,
    { email: string; password: string; userId: number; registrationId?: string }
  > = {};
  const summary: Array<Record<string, unknown>> = [];
  let seq = 1;

  for (const profile of PROFILES) {
    const password = genPassword();
    const userId = await upsertUser({
      email: profile.email,
      name: profile.name,
      password,
      admin: "admin" in profile && profile.admin,
    });
    credentials[profile.key] = { email: profile.email, password, userId };

    if (profile.key !== "admin") {
      const reg = await ensureRegistration({
        userId,
        email: profile.email,
        name: profile.name,
        withInstagram: profile.withInstagram,
        withPhoto: profile.withPhoto,
        sequence: seq++,
      });
      credentials[profile.key].registrationId = reg.id;
      summary.push({
        key: profile.key,
        name: profile.name,
        registrationIdPrefix: `${reg.id.slice(0, 8)}…`,
        withInstagram: profile.withInstagram,
        withPhoto: profile.withPhoto,
      });
    } else {
      summary.push({ key: "admin", name: profile.name, role: "SUPER_ADMIN" });
    }
  }

  const outDir = join(process.cwd(), "../../.local/clickaton-participant-cards-e2e");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "credentials.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        environment: "staging",
        hostHint,
        prefix: PREFIX,
        baseUrl: "https://clickaton-staging.vercel.app",
        note: "LOCAL ONLY — gitignored. Do not commit. Rotate after QA.",
        credentials,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  writeFileSync(
    join(outDir, "ids.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        prefix: PREFIX,
        participants: summary,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        hostHint,
        prefix: PREFIX,
        profiles: summary,
        credentialsPath: ".local/clickaton-participant-cards-e2e/credentials.json",
      },
      null,
      2
    )
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
