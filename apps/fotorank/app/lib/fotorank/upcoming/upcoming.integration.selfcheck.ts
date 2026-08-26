/**
 * Selfcheck de integración de "concursos próximos" — REQUIERE base de datos.
 *
 * Verifica lo que la lógica pura no puede: idempotencia real contra la
 * restricción única, persistencia de la auditoría al cancelar, aislamiento
 * entre organizaciones e idempotencia del seed.
 *
 * Crea sus propios datos con prefijo `selfcheck-upcoming-` y los borra al final.
 * NO toca concursos existentes.
 *
 * Uso: pnpm --filter fotorank test:upcoming:integration
 *
 * Guardias: aborta si DATABASE_URL no supera `assertSafeFotoRankDatabaseUrl`.
 */
import assert from "node:assert/strict";
import { prisma } from "@repo/db";

import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";
import { CURRENT_CONSENT_VERSION } from "./consent";
import {
  buildInterestCsv,
  cancelInterest,
  getAdminInterestPanel,
  listPublicUpcomingContests,
  mergeUpcomingConfig,
  registerInterest,
  resolveServerPrice,
  transitionContestPhase,
} from "./service";

const PREFIX = "selfcheck-upcoming";
const ORG_SLUG = `${PREFIX}-org`;
const OTHER_ORG_SLUG = `${PREFIX}-other-org`;
const CONTEST_SLUG = `${PREFIX}-contest`;

const CUTOFF = new Date("2026-09-21T02:59:59.000Z"); // 20/09 23:59 ART
const BENEFIT_DEADLINE = new Date("2026-10-11T02:59:59.000Z"); // 10/10 23:59 ART

async function cleanup(contestId: string | null, userIds: number[], orgIds: string[]) {
  if (contestId) {
    await prisma.fotorankContestInterestAuditEvent.deleteMany({ where: { contestId } });
    await prisma.fotorankContestInterest.deleteMany({ where: { contestId } });
    await prisma.fotorankContestPriceTier.deleteMany({
      where: { pricePhase: { contestId } },
    });
    await prisma.fotorankContestPricePhase.deleteMany({ where: { contestId } });
    await prisma.fotorankContestScheduledCommunication.deleteMany({ where: { contestId } });
    await prisma.fotorankPlatformAuditEvent.deleteMany({ where: { contestId } });
    await prisma.fotorankContest.deleteMany({ where: { id: contestId } });
  }
  if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (orgIds.length > 0) {
    await prisma.contestOrganization.deleteMany({ where: { id: { in: orgIds } } });
  }
}

async function main() {
  const check = assertSafeFotoRankDatabaseUrl();
  console.log(`Base verificada: ${check.host}/${check.database}`);

  const contestsBefore = await prisma.fotorankContest.count();

  const owner = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (!owner) throw new Error("No hay usuarios en la base. Corré primero el seed principal.");

  let contestId: string | null = null;
  const createdUserIds: number[] = [];
  const createdOrgIds: string[] = [];

  try {
    // -----------------------------------------------------------------------
    // Datos de prueba
    // -----------------------------------------------------------------------
    const org = await prisma.contestOrganization.create({
      data: { name: `${PREFIX} org`, slug: ORG_SLUG, createdByUserId: owner.id },
    });
    createdOrgIds.push(org.id);

    const otherOrg = await prisma.contestOrganization.create({
      data: { name: `${PREFIX} other`, slug: OTHER_ORG_SLUG, createdByUserId: owner.id },
    });
    createdOrgIds.push(otherOrg.id);

    const contest = await prisma.fotorankContest.create({
      data: {
        organizationId: org.id,
        slug: CONTEST_SLUG,
        title: `${PREFIX} concurso`,
        shortDescription: "Bajada de prueba",
        status: "DRAFT",
        visibility: "PRIVATE",
        timezone: "America/Argentina/Buenos_Aires",
        createdByUserId: owner.id,
        rulesData: mergeUpcomingConfig(null, {
          interestBenefitCutoffAt: CUTOFF.toISOString(),
          benefitDeadlineAt: BENEFIT_DEADLINE.toISOString(),
        }) as never,
      },
    });
    contestId = contest.id;

    const user = await prisma.user.create({
      data: { email: `${PREFIX}-user@example.test`, name: "Interesado Uno" },
    });
    createdUserIds.push(user.id);

    // -----------------------------------------------------------------------
    // 1. Un concurso DRAFT no aparece públicamente ni acepta interés
    // -----------------------------------------------------------------------
    const publicWhileDraft = await listPublicUpcomingContests(50);
    assert.equal(
      publicWhileDraft.some((c) => c.id === contestId),
      false,
      "un concurso en borrador no puede aparecer en el listado público",
    );

    const draftAttempt = await registerInterest({
      contestId: contest.id,
      userId: user.id,
      consent: { contestSpecificOptIn: true, generalOptIn: false },
      now: new Date("2026-09-01T12:00:00.000Z"),
    });
    assert.equal(draftAttempt.ok, false, "en borrador no se puede registrar interés");
    assert.equal(await prisma.fotorankContestInterest.count({ where: { contestId } }), 0);

    // -----------------------------------------------------------------------
    // 2. Transición DRAFT → UPCOMING bloqueada por los gates
    // -----------------------------------------------------------------------
    const blocked = await transitionContestPhase({
      contestId: contest.id,
      organizationId: org.id,
      actorUserId: owner.id,
      target: "UPCOMING",
    });
    assert.equal(blocked.ok, false, "faltan datos obligatorios: la transición debe bloquearse");

    // Se completa lo mínimo y se fuerza la fase para probar el resto del flujo.
    await prisma.fotorankContest.update({
      where: { id: contest.id },
      data: { status: "UPCOMING", visibility: "PUBLIC" },
    });

    // -----------------------------------------------------------------------
    // 3. Ahora sí aparece públicamente con "Notificarme"
    // -----------------------------------------------------------------------
    const publicNow = await listPublicUpcomingContests(50);
    const card = publicNow.find((c) => c.id === contestId);
    assert.ok(card, "el concurso en UPCOMING debe aparecer públicamente");
    assert.equal(card.showNotifyButton, true);

    // -----------------------------------------------------------------------
    // 4. Registro idempotente
    // -----------------------------------------------------------------------
    const beforeCutoff = new Date("2026-09-01T12:00:00.000Z");
    const first = await registerInterest({
      contestId: contest.id,
      userId: user.id,
      consent: { contestSpecificOptIn: true, generalOptIn: false },
      now: beforeCutoff,
    });
    assert.equal(first.ok && first.created, true);
    assert.equal(first.ok && first.benefitEligible, true);

    const second = await registerInterest({
      contestId: contest.id,
      userId: user.id,
      consent: { contestSpecificOptIn: true, generalOptIn: false },
      now: new Date("2026-09-10T12:00:00.000Z"),
    });
    assert.equal(second.ok && second.created, false, "repetir no debe crear una fila nueva");

    const rows = await prisma.fotorankContestInterest.findMany({ where: { contestId } });
    assert.equal(rows.length, 1, "la restricción única impide duplicados");

    // Repetir no extiende la fecha del beneficio ni reescribe el registro.
    assert.equal(rows[0]!.registeredAt.getTime(), beforeCutoff.getTime());
    assert.equal(rows[0]!.benefitDeadlineAt?.getTime(), BENEFIT_DEADLINE.getTime());
    assert.equal(rows[0]!.consentVersion, CURRENT_CONSENT_VERSION);

    // Clics simultáneos tampoco duplican.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        registerInterest({
          contestId: contest.id,
          userId: user.id,
          consent: { contestSpecificOptIn: true, generalOptIn: false },
          now: new Date("2026-09-11T12:00:00.000Z"),
        }),
      ),
    );
    assert.equal(await prisma.fotorankContestInterest.count({ where: { contestId } }), 1);

    // -----------------------------------------------------------------------
    // 5. Cancelar conserva la fila y la auditoría
    // -----------------------------------------------------------------------
    const auditBefore = await prisma.fotorankContestInterestAuditEvent.count({
      where: { contestId },
    });
    assert.ok(auditBefore >= 2, "cada acción deja rastro de auditoría");

    const cancelled = await cancelInterest({ contestId: contest.id, userId: user.id });
    assert.equal(cancelled.ok, true);

    const afterCancel = await prisma.fotorankContestInterest.findUnique({
      where: { contestId_userId: { contestId: contest.id, userId: user.id } },
    });
    assert.ok(afterCancel, "cancelar no borra la fila");
    assert.equal(afterCancel.status, "CANCELLED");
    assert.ok(afterCancel.cancelledAt);

    const auditAfter = await prisma.fotorankContestInterestAuditEvent.count({
      where: { contestId },
    });
    assert.ok(auditAfter > auditBefore, "cancelar agrega auditoría y no borra la anterior");

    // -----------------------------------------------------------------------
    // 6. Precio del lado servidor
    // -----------------------------------------------------------------------
    const promo = await prisma.fotorankContestPricePhase.create({
      data: {
        contestId: contest.id,
        code: "promo",
        name: "Promo interesados",
        audience: "INTEREST_EXCLUSIVE",
        startsAt: new Date("2026-09-21T03:00:00.000Z"),
        endsAt: BENEFIT_DEADLINE,
        priority: 10,
      },
    });
    await prisma.fotorankContestPriceTier.create({
      data: { pricePhaseId: promo.id, quantity: 1, amountMinor: 4_500_000 },
    });
    const general = await prisma.fotorankContestPricePhase.create({
      data: {
        contestId: contest.id,
        code: "general",
        name: "General",
        audience: "GENERAL",
        startsAt: new Date("2026-09-21T03:00:00.000Z"),
        endsAt: BENEFIT_DEADLINE,
        priority: 100,
      },
    });
    await prisma.fotorankContestPriceTier.create({
      data: { pricePhaseId: general.id, quantity: 1, amountMinor: 5_000_000 },
    });

    const duringPromo = new Date("2026-09-25T12:00:00.000Z");

    // El interés está cancelado: no accede al beneficio.
    const cancelledPrice = await resolveServerPrice({
      contestId: contest.id,
      userId: user.id,
      quantity: 1,
      now: duringPromo,
    });
    assert.equal(cancelledPrice.ok && cancelledPrice.price.amountMinor, 5_000_000);

    // Reactivado, vuelve a acceder al precio promocional original.
    await registerInterest({
      contestId: contest.id,
      userId: user.id,
      consent: { contestSpecificOptIn: true, generalOptIn: false },
      now: duringPromo,
    });
    const promoPrice = await resolveServerPrice({
      contestId: contest.id,
      userId: user.id,
      quantity: 1,
      now: duringPromo,
    });
    assert.equal(promoPrice.ok && promoPrice.price.amountMinor, 4_500_000);
    assert.equal(promoPrice.ok && promoPrice.price.isPromotional, true);

    // Un usuario anónimo paga el general.
    const anon = await resolveServerPrice({
      contestId: contest.id,
      userId: null,
      quantity: 1,
      now: duringPromo,
    });
    assert.equal(anon.ok && anon.price.amountMinor, 5_000_000);

    // -----------------------------------------------------------------------
    // 7. Aislamiento entre organizaciones
    // -----------------------------------------------------------------------
    const foreign = await getAdminInterestPanel({
      contestId: contest.id,
      organizationId: otherOrg.id,
    });
    assert.equal(foreign, null, "otra organización no puede leer los interesados");

    const own = await getAdminInterestPanel({
      contestId: contest.id,
      organizationId: org.id,
    });
    assert.ok(own);
    assert.equal(own.stats.total, 1);
    assert.equal(own.revenue.available, false, "la recaudación exige DNX Payments");

    // El CSV no expone correo ni documento.
    const csv = buildInterestCsv(own.rows);
    assert.equal(csv.includes(`${PREFIX}-user@example.test`), false);
    assert.ok(csv.includes("Interesado Uno"));

    // -----------------------------------------------------------------------
    // 8. Ningún otro concurso fue modificado
    // -----------------------------------------------------------------------
    const contestsAfter = await prisma.fotorankContest.count();
    assert.equal(
      contestsAfter,
      contestsBefore + 1,
      "sólo debe existir el concurso creado por este selfcheck",
    );

    console.log("upcoming.integration.selfcheck.ts OK");
  } finally {
    await cleanup(contestId, createdUserIds, createdOrgIds);
    const finalCount = await prisma.fotorankContest.count();
    assert.equal(finalCount, contestsBefore, "la limpieza debe dejar la base como estaba");
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
