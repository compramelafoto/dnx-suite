/**
 * Integración: varias obras por inscripción, contra DB local limpia.
 *
 * Reproduce Retratos del mundo 2026: concurso SIN política de carga y
 * categorías con "Máx. archivos" 3. Antes la carga caía al default de 1.
 *
 * DATABASE_URL='postgresql://USER@localhost:5432/fotorank_test' \
 * DIRECT_URL="$DATABASE_URL" \
 *   pnpm --filter fotorank test:entries:multi-integration
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { Prisma, prisma } from "@repo/db";
import { confirmEntry, createUploadIntent, getMyEntries, processUploadedFile, EntryError } from "./index";
import { createContestRegistration, publishRulesVersion, RULES_PLACEHOLDER_MARKER } from "../registration";
import { getMyParticipationView } from "../participant-experience/load-participations";

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.log("SKIP entries-multi.integration.selfcheck: DATABASE_URL no definida");
    return false;
  }
  if (!/localhost|127\.0\.0\.1/.test(url) || /neon\.tech|amazonaws\.com|supabase\.co/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL debe ser una base local.");
  }
  return true;
}

/** Cada foto con un color distinto: si no, el control de duplicados las marca. */
async function makeJpeg(r: number): Promise<Buffer> {
  return sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r, g: 90, b: 140 } } })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function expectEntryError(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (err: unknown) => err instanceof EntryError && err.code === code);
}

async function main() {
  if (!assertLocalDb()) return;

  const suffix = Date.now().toString(36);
  const password = createHash("sha256").update(`multi-${suffix}`).digest("hex");
  const mkUser = (tag: string) =>
    prisma.user.create({ data: { email: `${tag}-multi-${suffix}@fotorank.local`, name: tag, password } });

  const organizer = await mkUser("org");
  const participant = await mkUser("part");
  const other = await mkUser("other");

  const org = await prisma.contestOrganization.create({
    data: { name: `Org multi ${suffix}`, slug: `org-multi-${suffix}`, platformFeeBps: 0, createdByUserId: organizer.id },
  });
  await prisma.contestOrganizationMember.create({
    data: { organizationId: org.id, userId: organizer.id, role: "OWNER", status: "ACTIVE" },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Retratos multi ${suffix}`,
      slug: `retratos-multi-${suffix}`,
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
      // Como Retratos del mundo 2026: nadie aplicó una política de carga.
      uploadPolicyJson: Prisma.DbNull,
    },
  });
  const category = await prisma.fotorankContestCategory.create({
    data: { contestId: contest.id, name: "Color", slug: "color", maxFiles: 3, status: "ACTIVE" },
  });
  const rules = await publishRulesVersion({
    contestId: contest.id,
    title: "Bases multi",
    content: `${RULES_PLACEHOLDER_MARKER}\n\nSelfcheck varias obras.`,
    createdByUserId: organizer.id,
    allowPlaceholder: true,
  });
  const register = (userId: number) =>
    createContestRegistration({
      contestId: contest.id,
      participantUserId: userId,
      categoryId: category.id,
      rulesVersionId: rules.id,
      rulesAccepted: true,
      licenseAccepted: true,
      declaredAgeYears: 30,
      rulesAcceptanceIp: "127.0.0.1",
      rulesAcceptanceUserAgent: "entries-multi.integration.selfcheck",
    });
  const { registration: reg } = await register(participant.id);
  await register(other.id);

  const intent = (userId: number, entryId?: string) =>
    createUploadIntent({ contestId: contest.id, participantUserId: userId, entryId });
  const upload = async (entryId: string, color: number, isReplace = false) => {
    const r = await processUploadedFile({
      contestId: contest.id,
      entryId,
      participantUserId: participant.id,
      buffer: await makeJpeg(color),
      originalFileName: `foto-${color}.jpg`,
      declaredMime: "image/jpeg",
      isReplace,
    });
    await confirmEntry({
      contestId: contest.id,
      entryId,
      participantUserId: participant.id,
      acknowledgeWarnings: true,
    });
    return r;
  };

  // 1. Un intento que nunca subió el archivo no ocupa lugar: se reusa.
  const a1 = await intent(participant.id);
  const a2 = await intent(participant.id);
  assert.equal(a2.entryId, a1.entryId, "el borrador vacío se reusa");
  assert.equal((await getMyEntries(contest.id, participant.id)).length, 0, "un borrador vacío no es una obra");

  // 2. Primera foto.
  await upload(a1.entryId, 10);

  // 3. "Agregar otra" crea una obra NUEVA, no pisa la primera.
  const b = await intent(participant.id);
  assert.notEqual(b.entryId, a1.entryId);
  await upload(b.entryId, 80);

  // 4. Reemplazar la primera, eligiéndola por id.
  const aReplace = await intent(participant.id, a1.entryId);
  assert.equal(aReplace.entryId, a1.entryId);
  const replaced = await upload(a1.entryId, 140, true);
  assert.equal(replaced.versionNumber, 2);

  // 5. Tercera foto.
  const c = await intent(participant.id);
  assert.ok(![a1.entryId, b.entryId].includes(c.entryId));
  await upload(c.entryId, 200);

  const mine = await getMyEntries(contest.id, participant.id);
  assert.deepEqual(
    mine.map((e) => e.id),
    [a1.entryId, b.entryId, c.entryId],
  );
  assert.ok(mine.every((e) => e.status === "CONFIRMED"));

  // 6. Cupo lleno: pedir otra falla con un error claro, no devuelve una obra ya enviada.
  await expectEntryError(() => intent(participant.id), "ENTRY_QUOTA_EXCEEDED");
  // ...pero reemplazar sigue permitido.
  assert.equal((await intent(participant.id, b.entryId)).entryId, b.entryId);

  // 7. No se puede apuntar a la obra de otra persona.
  const otherIntent = await intent(other.id);
  await expectEntryError(() => intent(participant.id, otherIntent.entryId), "ENTRY_NOT_FOUND");
  assert.equal((await getMyEntries(contest.id, other.id)).length, 0);

  // 8. Mis participaciones muestra el límite real y lo cargado.
  const view = await getMyParticipationView(participant.id, reg.id);
  assert.ok(view);
  assert.equal(view.maxFiles, 3);
  assert.equal(view.uploadedCount, 3);
  assert.notEqual(view.nextAction.key, "add_photo", "sin cupo no ofrece subir otra");

  const otherView = await getMyParticipationView(other.id, (await prisma.fotorankContestRegistration.findFirstOrThrow({
    where: { contestId: contest.id, participantUserId: other.id },
  })).id);
  assert.ok(otherView);
  assert.equal(otherView.uploadedCount, 0, "el borrador vacío no cuenta como cargada");

  console.log(JSON.stringify({ ok: true, contestId: contest.id, entries: mine.map((e) => e.id) }, null, 2));
  console.log("entries-multi.integration.selfcheck.ts OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
