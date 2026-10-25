import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Concurrencia real de la reserva (etapa 8, spec D21, D33): corre SÓLO contra una base de prueba
 * descartable (una rama Neon de `development` con la migración aplicada), indicada en
 * `MUESTRAS_DB_TEST_URL` (o `MUESTRAS_TEST_DATABASE_URL`). Sin esa variable se saltea.
 * Nunca apuntarla a producción. Correrla sola:
 *
 *   MUESTRAS_DB_TEST_URL=postgres://… pnpm --filter muestras exec vitest run lib/ventas/reservar.db.test.ts
 *
 * Crea una muestra, una oferta de edición limitada N = 10 y lo necesario para venderla, y al final
 * borra todo lo que creó.
 */
const URL_DE_PRUEBA = process.env.MUESTRAS_DB_TEST_URL || process.env.MUESTRAS_TEST_DATABASE_URL || "";
const habilitado = URL_DE_PRUEBA !== "" && URL_DE_PRUEBA !== process.env.DATABASE_URL;

if (!habilitado) {
  console.info("[reservar.db.test] Salteado: definí MUESTRAS_DB_TEST_URL con una base de prueba descartable (distinta de DATABASE_URL).");
}

describe.skipIf(!habilitado)("reserva concurrente contra una base real", () => {
  // Se importan después de apuntar el cliente a la base de prueba.
  let prisma: typeof import("@repo/db").prisma;
  let reservarEnTransaccion: typeof import("./reservar-tx").reservarEnTransaccion;
  const marca = randomUUID().slice(0, 8);
  const ORG = 1_900_000_000 + Math.floor(Math.random() * 1000);
  const AUTOR = ORG + 1;
  let activityId = "";
  let offerId = "";

  const entrada = (i: number) => ({
    offerId,
    delivery: "PICKUP" as const,
    comprador: { nombre: `Comprador ${i}`, email: `c${i}-${marca}@testuser.com`, telefono: null },
    direccion: null,
    nombreEnCertificado: false,
    termsVersion: "2026-10-11",
    isTest: true,
    ambienteCuenta: "SANDBOX" as const,
    ownerUserId: "999",
    publicId: `${marca}${String(i).padStart(8, "0")}`.slice(0, 16).toLowerCase().replace(/[^a-z0-9]/g, "a"),
    accessTokenHash: randomUUID(),
    idempotencyKey: randomUUID(),
  });
  const reservar = (i: number, ahora: Date) =>
    prisma.$transaction((tx) => reservarEnTransaccion(tx, entrada(i), ahora), { timeout: 60_000, maxWait: 60_000 });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_DE_PRUEBA;
    ({ prisma } = await import("@repo/db"));
    ({ reservarEnTransaccion } = await import("./reservar-tx"));
    const ahora = Date.now();
    const a = await prisma.culturalActivity.create({
      data: {
        slug: `prueba-reserva-${marca}`, type: "MUESTRA", title: `Prueba de reserva ${marca}`, description: "Prueba automática", organizersText: "Prueba",
        startsAt: new Date(ahora - 86_400_000), endsAt: new Date(ahora + 10 * 86_400_000), proposedByUserId: ORG, reviewStatus: "APPROVED",
      },
    });
    activityId = a.id;
    const aw = await prisma.culturalActivityWork.create({ data: { activityId, imageUrl: "https://example.test/x.webp", title: "Obra", authorName: "Autora", authorUserId: AUTOR } });
    const ex = await prisma.culturalExhibitor.create({ data: { activityId, userId: AUTOR, displayName: "Autora", rightsAcceptedAt: new Date() } });
    await prisma.culturalExhibitorWork.create({ data: { exhibitorId: ex.id, activityId, status: "APPROVED", title: "Obra", forSale: true, activityWorkId: aw.id } });
    await prisma.culturalSaleSetup.create({
      data: { activityId, status: "OPEN", organizerUserId: ORG, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000, splitVersion: 1, createdByUserId: ORG, pickupText: "En la sede" },
    });
    await prisma.culturalSaleAuthorTerms.create({ data: { activityId, userId: AUTOR, splitVersion: 1, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000, textVersion: "2026-10-11" } });
    for (const userId of [ORG, AUTOR]) {
      await prisma.culturalPayoutAccount.create({ data: { userId, environment: "SANDBOX", mpEmail: `u${userId}@testuser.com`, receiverId: randomUUID(), consentStatus: "ACTIVE", lastCheckedAt: new Date() } });
    }
    await prisma.culturalSaleFile.create({ data: { activityWorkId: aw.id, activityId, authorUserId: AUTOR, storageKey: `originales/${AUTOR}/x`, status: "READY", sha256: "0".repeat(64) } });
    await prisma.culturalAuthorSignature.create({ data: { userId: AUTOR, storageKey: `firmas/${AUTOR}.png` } });
    const o = await prisma.culturalWorkOffer.create({
      data: {
        activityId, activityWorkId: aw.id, authorUserId: AUTOR, format: "PRINT", editionKind: "LIMITED", editionSize: 10, priceArs: 100_000, approvedPriceArs: 100_000,
        paper: "Papel de prueba", widthCm: 30, heightCm: 40, status: "APPROVED",
      },
    });
    offerId = o.id;
  }, 60_000);

  afterAll(async () => {
    if (!prisma || !activityId) return;
    await prisma.culturalSaleOrder.deleteMany({ where: { activityId } });
    await prisma.culturalEditionCopy.deleteMany({ where: { activityId } });
    await prisma.culturalActivity.delete({ where: { id: activityId } });
    await prisma.culturalPayoutAccount.deleteMany({ where: { userId: { in: [ORG, AUTOR] } } });
    await prisma.culturalAuthorSignature.deleteMany({ where: { userId: AUTOR } });
    await prisma.$disconnect();
  }, 60_000);

  it("25 reservas a la vez sobre una edición de 10 → exactamente 10, números 1..10 sin repetir", async () => {
    const ahora = new Date();
    const r = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => reservar(i, ahora)));
    const ok = r.flatMap((x) => (x.status === "fulfilled" && x.value.ok ? [x.value] : []));
    const agotadas = r.filter((x) => x.status === "fulfilled" && !x.value.ok && x.value.error === "Se vendieron todas las copias de este formato.");
    expect(ok).toHaveLength(10);
    expect(agotadas).toHaveLength(15);
    expect(ok.map((x) => x.copyNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const filas = await prisma.culturalEditionCopy.findMany({ where: { offerId, isTest: true, kind: "COPY" } });
    expect(filas).toHaveLength(10);
    expect(new Set(filas.map((f) => f.number)).size).toBe(10);
  }, 120_000);

  it("con 3 reservas vencidas, 3 reservas nuevas reutilizan esos números; una copia anulada nunca se toma", async () => {
    const filas = await prisma.culturalEditionCopy.findMany({ where: { offerId, isTest: true, kind: "COPY" }, orderBy: { number: "asc" } });
    // Vencen la 2, la 5 y la 7; la 9 queda anulada; el resto, emitidas.
    const vencer = filas.filter((f) => [2, 5, 7].includes(f.number)).map((f) => f.id);
    await prisma.culturalEditionCopy.updateMany({ where: { id: { in: vencer } }, data: { reservedUntil: new Date(Date.now() - 60_000) } });
    await prisma.culturalEditionCopy.updateMany({ where: { offerId, isTest: true, number: 9 }, data: { status: "VOIDED", reservedUntil: null } });
    await prisma.culturalEditionCopy.updateMany({ where: { offerId, isTest: true, number: { notIn: [2, 5, 7, 9] } }, data: { status: "ISSUED", reservedUntil: null } });
    const ahora = new Date();
    const r = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => reservar(100 + i, ahora)));
    const ok = r.flatMap((x) => (x.status === "fulfilled" && x.value.ok ? [x.value] : []));
    expect(ok.map((x) => x.copyNumber).sort((a, b) => a - b)).toEqual([2, 5, 7]);
    const despues = await prisma.culturalEditionCopy.findMany({ where: { offerId, isTest: true, kind: "COPY" } });
    expect(despues).toHaveLength(10);
    expect(despues.find((f) => f.number === 9)?.status).toBe("VOIDED");
    // Los pedidos viejos de esos números vencieron y soltaron la copia.
    const viejos = await prisma.culturalSaleOrder.findMany({ where: { activityId, status: "EXPIRED" } });
    expect(viejos).toHaveLength(3);
    expect(viejos.every((p) => p.copyId == null)).toBe(true);
  }, 120_000);
});
