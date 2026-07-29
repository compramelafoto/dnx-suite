/**
 * Integración P0-06 contra DB local limpia (nunca Neon con drift).
 *
 * DATABASE_URL='postgresql://USER@localhost:5432/fotorank_p0_06_test' \
 * DIRECT_URL="$DATABASE_URL" \
 *   pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/entries/entries.integration.selfcheck.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@repo/db";
import {
  confirmEntry,
  createManualReview,
  createUploadIntent,
  getMyEntry,
  listContestEntriesForOrganizer,
  processUploadedFile,
  EntryError,
} from "./index";
import { createContestRegistration, publishRulesVersion, RULES_PLACEHOLDER_MARKER } from "../registration";
import { getContestEntryStorage } from "../storage/private-local-storage";

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.log("SKIP entries.integration.selfcheck: DATABASE_URL no definida");
    return false;
  }
  if (/neon\.tech|amazonaws\.com|supabase\.co/i.test(url)) {
    throw new Error(
      "ABORT: DATABASE_URL parece remota. Usá únicamente DB local (ej. fotorank_p0_06_test).",
    );
  }
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`ABORT: DATABASE_URL no es localhost: ${url.replace(/:[^:@/]+@/, ":***@")}`);
  }
  return true;
}

async function makeJpeg(opts?: { width?: number; height?: number; withExif?: boolean }): Promise<Buffer> {
  const width = opts?.width ?? 2400;
  const height = opts?.height ?? 1600;
  let img = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 140 },
    },
  }).jpeg({ quality: 88 });

  if (opts?.withExif !== false) {
    img = img.withMetadata({
      exif: {
        IFD0: {
          Make: "Apple",
          Model: "iPhone 15",
          Software: "iOS",
        },
      },
    });
  }

  return img.toBuffer();
}

async function main() {
  if (!assertLocalDb()) return;

  const entryDelegate = (prisma as { fotorankContestEntry?: { create?: unknown } }).fotorankContestEntry;
  if (typeof entryDelegate?.create !== "function") {
    console.log("SKIP entries.integration.selfcheck: cliente Prisma sin FotorankContestEntry");
    return;
  }

  const suffix = Date.now().toString(36);
  const password = createHash("sha256").update(`sc-${suffix}`).digest("hex");

  const organizer = await prisma.user.create({
    data: {
      email: `org-p006-${suffix}@fotorank.local`,
      name: "Org P006",
      password,
    },
  });
  const participant = await prisma.user.create({
    data: {
      email: `part-p006-${suffix}@fotorank.local`,
      name: "Part P006",
      password,
    },
  });
  const stranger = await prisma.user.create({
    data: {
      email: `stranger-p006-${suffix}@fotorank.local`,
      name: "Stranger",
      password,
    },
  });

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Org P006 ${suffix}`,
      slug: `org-p006-${suffix}`,
      platformFeeBps: 0,
      createdByUserId: organizer.id,
    },
  });
  await prisma.contestOrganizationMember.create({
    data: {
      organizationId: org.id,
      userId: organizer.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `P006 Contest ${suffix}`,
      slug: `p006-${suffix}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationPriceAmountMinor: 0,
      registrationCurrency: "ARS",
      registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-12-31T00:00:00Z"),
      submissionOpensAt: new Date("2026-01-01T00:00:00Z"),
      submissionDeadline: new Date("2026-12-31T00:00:00Z"),
      createdByUserId: organizer.id,
      uploadPolicyJson: {
        allowedMimeTypes: ["image/jpeg"],
        allowedExtensions: ["jpg", "jpeg"],
        maxFileSizeBytes: 25 * 1024 * 1024,
        minWidth: 1200,
        minHeight: 800,
        maxWidth: 12000,
        maxHeight: 12000,
        minMegapixels: 1.5,
        requireExif: false,
        requireCaptureDate: false,
        requireGps: false,
        allowEditedFiles: true,
        maxEntriesPerRegistration: 1,
        allowReplaceUntilSubmissionClose: true,
        draftConfig: true,
        notes: "BORRADOR — VALIDAR ANTES DE PRODUCCIÓN",
      },
    },
  });

  const category = await prisma.fotorankContestCategory.create({
    data: {
      contestId: contest.id,
      name: "Celular",
      slug: "celular",
      maxFiles: 1,
      status: "ACTIVE",
    },
  });

  const rules = await publishRulesVersion({
    contestId: contest.id,
    title: "Bases P006",
    content: `${RULES_PLACEHOLDER_MARKER}\n\nSelfcheck P0-06.`,
    createdByUserId: organizer.id,
    allowPlaceholder: true,
  });

  const { registration: reg } = await createContestRegistration({
    contestId: contest.id,
    participantUserId: participant.id,
    categoryId: category.id,
    rulesVersionId: rules.id,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    rulesAcceptanceIp: "127.0.0.1",
    rulesAcceptanceUserAgent: "entries.integration.selfcheck",
  });
  assert.equal(reg.status, "CONFIRMED");

  // Upload intent
  const intent = await createUploadIntent({
    contestId: contest.id,
    participantUserId: participant.id,
  });
  assert.ok(intent.entryId);
  assert.match(intent.uploadUrl, /\/upload$/);

  // Process JPEG with EXIF
  const jpeg = await makeJpeg({ withExif: true });
  const processed = await processUploadedFile({
    contestId: contest.id,
    entryId: intent.entryId,
    participantUserId: participant.id,
    buffer: jpeg,
    originalFileName: "obra.jpg",
    declaredMime: "image/jpeg",
  });
  assert.notEqual(processed.technicalSummaryStatus, "TECHNICALLY_REJECTED");
  assert.ok(["READY_TO_CONFIRM", "REQUIRES_REVIEW"].includes(processed.status) || processed.status === "READY_TO_CONFIRM");

  const mine = await getMyEntry(contest.id, participant.id);
  assert.ok(mine);
  assert.ok(mine.assets.some((a) => a.kind === "ORIGINAL" && a.isActive));
  assert.ok(mine.assets.some((a) => a.kind === "THUMBNAIL"));
  assert.ok(mine.assets.some((a) => a.kind === "JURY_PREVIEW"));
  assert.ok(mine.checks.length > 0);
  const original = mine.assets.find((a) => a.kind === "ORIGINAL" && a.isActive)!;
  assert.ok(original.sha256 && original.sha256.length === 64);
  assert.match(original.storageKey, /^fotorank\/contests\//);
  assert.equal(/@|\.com|dni/i.test(original.storageKey), false);

  // Original no es público
  const storage = getContestEntryStorage();
  assert.equal(storage.isPrivate, true);
  const signed = await storage.getSignedUrl(original.storageKey, "read", 60);
  assert.ok(signed.includes("/api/fotorank/private-asset"));
  assert.equal(signed.includes("http://public"), false);

  // Confirm (con warn si hace falta)
  const confirmed = await confirmEntry({
    contestId: contest.id,
    entryId: intent.entryId,
    participantUserId: participant.id,
    acknowledgeWarnings: processed.status === "REQUIRES_REVIEW",
  });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.ok(confirmed.entryNumber);

  // Replace → nueva versión, anterior no activa
  const jpeg2 = await makeJpeg({ width: 2500, height: 1700, withExif: false });
  const replaced = await processUploadedFile({
    contestId: contest.id,
    entryId: intent.entryId,
    participantUserId: participant.id,
    buffer: jpeg2,
    originalFileName: "obra-v2.jpg",
    declaredMime: "image/jpeg",
    isReplace: true,
  });
  assert.equal(replaced.versionNumber, 2);

  const afterReplace = await getMyEntry(contest.id, participant.id);
  assert.ok(afterReplace);
  const originals = await prisma.fotorankContestEntryAsset.findMany({
    where: { entryId: intent.entryId, kind: "ORIGINAL" },
    orderBy: { versionNumber: "asc" },
  });
  assert.equal(originals.length, 2);
  assert.equal(originals[0]!.isActive, false);
  assert.equal(originals[1]!.isActive, true);
  assert.ok(originals[0]!.replacedAt);

  // Confirmar segunda
  await confirmEntry({
    contestId: contest.id,
    entryId: intent.entryId,
    participantUserId: participant.id,
    acknowledgeWarnings: true,
  });

  // Duplicado mismo concurso (otra inscripción) → REQUIRES_REVIEW
  const participant2 = await prisma.user.create({
    data: {
      email: `part2-p006-${suffix}@fotorank.local`,
      name: "Part2",
      password,
    },
  });
  await createContestRegistration({
    contestId: contest.id,
    participantUserId: participant2.id,
    categoryId: category.id,
    rulesVersionId: rules.id,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    rulesAcceptanceIp: "127.0.0.1",
    rulesAcceptanceUserAgent: "entries.integration.selfcheck",
  });
  const intent2 = await createUploadIntent({
    contestId: contest.id,
    participantUserId: participant2.id,
  });
  const dup = await processUploadedFile({
    contestId: contest.id,
    entryId: intent2.entryId,
    participantUserId: participant2.id,
    buffer: jpeg2,
    originalFileName: "copia.jpg",
    declaredMime: "image/jpeg",
  });
  assert.equal(dup.technicalSummaryStatus, "REQUIRES_REVIEW");

  // Cross-user: stranger no ve obra
  const strangerView = await getMyEntry(contest.id, stranger.id);
  assert.equal(strangerView, null);

  await assert.rejects(
    () =>
      processUploadedFile({
        contestId: contest.id,
        entryId: intent.entryId,
        participantUserId: stranger.id,
        buffer: jpeg,
        originalFileName: "x.jpg",
        declaredMime: "image/jpeg",
      }),
    (err: unknown) => err instanceof EntryError && err.code === "FORBIDDEN",
  );

  // Organizer list
  const rows = await listContestEntriesForOrganizer({
    contestId: contest.id,
    organizerUserId: organizer.id,
  });
  assert.ok(rows.length >= 2);
  assert.ok(rows.some((r) => r.participantEmail === participant.email));

  await assert.rejects(
    () =>
      listContestEntriesForOrganizer({
        contestId: contest.id,
        organizerUserId: stranger.id,
      }),
    (err: unknown) => err instanceof EntryError && err.code === "FORBIDDEN",
  );

  // Manual review
  await createManualReview({
    contestId: contest.id,
    entryId: intent2.entryId,
    reviewerUserId: organizer.id,
    decision: "CLEARED_WARNING",
    reason: "Duplicado revisado — falsa alarma operativa",
  });

  // Confirm bloqueado con FAIL: archivo diminuto
  const tiny = await sharp({
    create: { width: 100, height: 80, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .jpeg()
    .toBuffer();
  const intentTiny = await createUploadIntent({
    contestId: contest.id,
    participantUserId: participant2.id,
  });
  // replace on intent2 entry
  const failed = await processUploadedFile({
    contestId: contest.id,
    entryId: intent2.entryId,
    participantUserId: participant2.id,
    buffer: tiny,
    originalFileName: "tiny.jpg",
    declaredMime: "image/jpeg",
    isReplace: true,
  });
  assert.equal(failed.technicalSummaryStatus, "TECHNICALLY_REJECTED");
  await assert.rejects(
    () =>
      confirmEntry({
        contestId: contest.id,
        entryId: intent2.entryId,
        participantUserId: participant2.id,
        acknowledgeWarnings: true,
      }),
    (err: unknown) => err instanceof EntryError && err.code === "CONFIRM_BLOCKED",
  );

  // Cleanup soft: leave data for inspection; print summary
  console.log(
    JSON.stringify(
      {
        ok: true,
        database: process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@"),
        contestId: contest.id,
        entryId: intent.entryId,
        registrationId: reg.id,
        duplicateEntryId: intent2.entryId,
        unusedTinyIntent: intentTiny.entryId,
      },
      null,
      2,
    ),
  );
  console.log("entries.integration.selfcheck.ts OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
