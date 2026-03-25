/**
 * Sincroniza el estado de pago de PrintOrders con Mercado Pago y crea ReferralEarning si aplica.
 * Para pedidos donde el webhook no se ejecutó (ej. notification_url no enviada), este script
 * consulta MP por external_reference o por mpPaymentId y actualiza la base.
 *
 * Uso: npx tsx scripts/sync-print-order-payment.ts [orderId1] [orderId2] ...
 * Ejemplo: npx tsx scripts/sync-print-order-payment.ts 88 89 90 91
 *
 * Opciones:
 *   --verbose       Muestra si encontró pago en MP y estado en DB después.
 *   --force-paid    Si no se encuentra pago en MP, marca igual el pedido como PAID (útil si el pago está aprobado en MP pero la búsqueda falla por token/cuenta).
 *
 * Requiere: .env con MP_ACCESS_TOKEN y DATABASE_URL.
 * Importante: ejecutá el script con el mismo .env que usa la app (misma DB que ve la tabla de admin).
 */

import "dotenv/config";
import { getPaymentById, searchPaymentsByExternalReference } from "../lib/mercadopago";
import { feeFromTotal } from "../lib/pricing/fee-formula";
import { calculateOrderCommissions } from "../lib/services/commissionService";
import { queuePhotographerPrintOrderNotification } from "../lib/order-confirmation-email";
import { prisma } from "../lib/prisma";

type PaymentInfo = Awaited<ReturnType<typeof getPaymentById>>;

async function getPaymentForOrder(
  orderId: number,
  order: { photographerId: number | null; labId: number | null; mpPaymentId: string | null },
  verbose: boolean
): Promise<PaymentInfo | null> {
  let tokenOverride: string | undefined;
  if (order.photographerId) {
    const photographer = await prisma.user.findUnique({
      where: { id: order.photographerId },
      select: { mpAccessToken: true },
    });
    if (photographer?.mpAccessToken) tokenOverride = photographer.mpAccessToken;
  }
  if (!tokenOverride && order.labId != null) {
    const lab = await prisma.lab.findUnique({
      where: { id: order.labId },
      select: { mpAccessToken: true },
    });
    if (lab?.mpAccessToken) tokenOverride = lab.mpAccessToken;
  }

  if (verbose) {
    console.log(`  [${orderId}] Token: ${tokenOverride ? "fotógrafo/lab" : "global (MP_ACCESS_TOKEN)"}`);
  }

  // 1) Si tenemos mpPaymentId, intentar get por ID
  if (order.mpPaymentId?.trim()) {
    try {
      const pay = await getPaymentById(order.mpPaymentId.trim(), { accessTokenOverride: tokenOverride });
      if (pay.external_reference === String(orderId)) {
        if (verbose) console.log(`  [${orderId}] Pago encontrado por mpPaymentId: ${pay.id} → status=${pay.status}`);
        return pay;
      }
    } catch (e) {
      if (verbose) console.log(`  [${orderId}] getPaymentById(mpPaymentId) falló:`, (e as Error).message);
      try {
        const pay = await getPaymentById(order.mpPaymentId!.trim(), {});
        if (pay.external_reference === String(orderId)) {
          if (verbose) console.log(`  [${orderId}] Pago encontrado con token global: ${pay.id} → status=${pay.status}`);
          return pay;
        }
      } catch {
        // Seguir a búsqueda
      }
    }
  }

  // 2) Buscar por external_reference
  const ref = String(orderId);
  if (verbose) console.log(`  [${orderId}] Buscando en MP por external_reference=${ref}...`);
  for (const token of [tokenOverride, undefined]) {
    try {
      const list = await searchPaymentsByExternalReference(ref, {
        accessTokenOverride: token ?? undefined,
        dateRangeDays: 365,
      });
      if (verbose) console.log(`  [${orderId}] MP search devolvió ${list.length} resultado(s)`);
      if (list.length > 0) {
        const approved = list.find((p) => p.status === "approved");
        const chosen = approved ?? list[0];
        if (verbose) console.log(`  [${orderId}] Usando pago: id=${chosen.id} status=${chosen.status}`);
        return chosen;
      }
    } catch (e) {
      if (verbose) console.log(`  [${orderId}] Search falló:`, (e as Error).message);
      if (!token) throw e;
    }
  }
  return null;
}

async function syncOne(
  orderId: number,
  opts: { verbose?: boolean; forcePaid?: boolean }
): Promise<{ ok: boolean; message: string }> {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      photographerId: true,
      labId: true,
      mpPaymentId: true,
      paymentStatus: true,
      pricingSnapshot: true,
      total: true,
    },
  });

  if (!order) {
    return { ok: false, message: `PrintOrder #${orderId} no existe` };
  }

  if (order.paymentStatus === "PAID") {
    // Opcional: asegurar que exista ReferralEarning si aplica (idempotente)
    const existing = await prisma.referralEarning.findFirst({
      where: { saleRef: `PRINT_ORDER:${orderId}` },
    });
    if (existing) {
      return { ok: true, message: `#${orderId} ya está PAID y tiene ReferralEarning` };
    }
    // Si está PAID pero no hay earning, crear si aplica (misma lógica abajo)
    const paymentId = order.mpPaymentId;
    if (!paymentId) {
      return { ok: true, message: `#${orderId} ya está PAID (sin mpPaymentId para crear referido)` };
    }
    const printOrderForRef = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { photographerId: true, pricingSnapshot: true, total: true },
    });
    let platformFeeCentsPrint = Number((printOrderForRef?.pricingSnapshot as any)?.marketplaceFeeCents ?? 0);
    if (platformFeeCentsPrint <= 0 && printOrderForRef?.total) {
      const snap = (printOrderForRef.pricingSnapshot ?? {}) as Record<string, unknown>;
      const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
      if (pct > 0) platformFeeCentsPrint = feeFromTotal(Number(printOrderForRef.total), pct);
    }
    if (printOrderForRef?.photographerId != null && platformFeeCentsPrint > 0) {
      const attribution = await prisma.referralAttribution.findFirst({
        where: {
          referredUserId: printOrderForRef.photographerId,
          status: "ACTIVE",
          endsAt: { gt: new Date() },
        },
        include: {
          referrerUser: {
            select: { mpUserId: true, mpConnectedAt: true },
          },
        },
      });
      const referrerHasMp = !!(attribution?.referrerUser?.mpUserId || attribution?.referrerUser?.mpConnectedAt);
      if (attribution && referrerHasMp) {
        const referralAmountCents = Math.floor(platformFeeCentsPrint * 0.5);
        const platformNetCents = platformFeeCentsPrint - referralAmountCents;
        await prisma.referralEarning.create({
          data: {
            attributionId: attribution.id,
            paymentId: String(paymentId),
            saleRef: `PRINT_ORDER:${orderId}`,
            platformFeeCents: platformFeeCentsPrint,
            referralAmountCents,
            platformNetCents,
          },
        });
        return { ok: true, message: `#${orderId} ya PAID; creado ReferralEarning faltante` };
      }
    }
    return { ok: true, message: `#${orderId} ya está PAID` };
  }

  const payment = await getPaymentForOrder(orderId, order, opts.verbose ?? false);
  if (!payment) {
    if (opts.forcePaid) {
      // Marcar como PAID sin MP (pago confirmado a mano)
      await prisma.printOrder.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          statusUpdatedAt: new Date(),
          // mpPaymentId se deja como está o null
        },
      });
      const printOrderForRef = await prisma.printOrder.findUnique({
        where: { id: orderId },
        select: { photographerId: true, pricingSnapshot: true, total: true },
      });
      let platformFeeCentsPrint = Number((printOrderForRef?.pricingSnapshot as any)?.marketplaceFeeCents ?? 0);
      if (platformFeeCentsPrint <= 0 && printOrderForRef?.total) {
        const snap = (printOrderForRef.pricingSnapshot ?? {}) as Record<string, unknown>;
        const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
        if (pct > 0) platformFeeCentsPrint = feeFromTotal(Number(printOrderForRef.total), pct);
      }
      if (printOrderForRef?.photographerId != null && platformFeeCentsPrint > 0) {
        const attribution = await prisma.referralAttribution.findFirst({
          where: {
            referredUserId: printOrderForRef.photographerId,
            status: "ACTIVE",
            endsAt: { gt: new Date() },
          },
          include: { referrerUser: { select: { mpUserId: true, mpConnectedAt: true } } },
        });
        const referrerHasMp = !!(attribution?.referrerUser?.mpUserId || attribution?.referrerUser?.mpConnectedAt);
        if (attribution && referrerHasMp) {
          const referralAmountCents = Math.floor(platformFeeCentsPrint * 0.5);
          const platformNetCents = platformFeeCentsPrint - referralAmountCents;
          await prisma.referralEarning.create({
            data: {
              attributionId: attribution.id,
              paymentId: `sync-force-${orderId}`,
              saleRef: `PRINT_ORDER:${orderId}`,
              platformFeeCents: platformFeeCentsPrint,
              referralAmountCents,
              platformNetCents,
            },
          });
        }
      }
      await calculateOrderCommissions(orderId);
      queuePhotographerPrintOrderNotification(orderId).catch(() => {});
      const updated = await prisma.printOrder.findUnique({
        where: { id: orderId },
        select: { paymentStatus: true },
      });
      return {
        ok: true,
        message: `#${orderId}: marcado PAID con --force-paid (no se encontró en MP). DB paymentStatus=${updated?.paymentStatus ?? "?"}`,
      };
    }
    return { ok: false, message: `#${orderId}: no se encontró pago en MP (external_reference=${orderId}). Usá --force-paid si el pago está aprobado en MP.` };
  }

  const status = payment.status;
  const paymentId = payment.id;

  if (status === "approved") {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        mpPaymentId: String(paymentId),
        statusUpdatedAt: new Date(),
      },
    });

    const printOrderForRef = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { photographerId: true, pricingSnapshot: true, total: true },
    });
    let platformFeeCentsPrint = Number((printOrderForRef?.pricingSnapshot as any)?.marketplaceFeeCents ?? 0);
    if (platformFeeCentsPrint <= 0 && printOrderForRef?.total) {
      const snap = (printOrderForRef.pricingSnapshot ?? {}) as Record<string, unknown>;
      const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
      if (pct > 0) platformFeeCentsPrint = feeFromTotal(Number(printOrderForRef.total), pct);
    }

    if (printOrderForRef?.photographerId != null && platformFeeCentsPrint > 0) {
      const attribution = await prisma.referralAttribution.findFirst({
        where: {
          referredUserId: printOrderForRef.photographerId,
          status: "ACTIVE",
          endsAt: { gt: new Date() },
        },
        include: {
          referrerUser: {
            select: { mpUserId: true, mpConnectedAt: true },
          },
        },
      });
      const referrerHasMp = !!(attribution?.referrerUser?.mpUserId || attribution?.referrerUser?.mpConnectedAt);
      if (attribution && referrerHasMp) {
        const referralAmountCents = Math.floor(platformFeeCentsPrint * 0.5);
        const platformNetCents = platformFeeCentsPrint - referralAmountCents;
        await prisma.referralEarning.create({
          data: {
            attributionId: attribution.id,
            paymentId: String(paymentId),
            saleRef: `PRINT_ORDER:${orderId}`,
            platformFeeCents: platformFeeCentsPrint,
            referralAmountCents,
            platformNetCents,
          },
        });
      }
    }

    await calculateOrderCommissions(orderId);
    queuePhotographerPrintOrderNotification(orderId).catch((err) =>
      console.error("Error encolando email al fotógrafo (pedido impresión):", err)
    );

    const updated = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { paymentStatus: true },
    });
    return {
      ok: true,
      message: `#${orderId}: actualizado a PAID (payment ${paymentId}). DB paymentStatus=${updated?.paymentStatus ?? "PAID"}`,
    };
  }

  if (status === "rejected" || status === "cancelled") {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: "FAILED",
        mpPaymentId: String(paymentId),
        statusUpdatedAt: new Date(),
      },
    });
    return { ok: true, message: `#${orderId}: actualizado a FAILED (${status})` };
  }

  if (status === "refunded" || status === "charged_back") {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: "REFUNDED",
        mpPaymentId: String(paymentId),
        statusUpdatedAt: new Date(),
      },
    });
    return { ok: true, message: `#${orderId}: actualizado a REFUNDED (${status})` };
  }

  return { ok: true, message: `#${orderId}: pago en MP está "${status}" – sin cambio en DB` };
}

async function main() {
  const argv = process.argv.slice(2);
  const forcePaid = argv.includes("--force-paid");
  const verbose = argv.includes("--verbose");
  const ids = argv.filter((a) => a !== "--force-paid" && a !== "--verbose").map(Number).filter(Number.isFinite);

  if (ids.length === 0) {
    console.log("Uso: npx tsx scripts/sync-print-order-payment.ts [--verbose] [--force-paid] <orderId1> [orderId2] ...");
    console.log("Ejemplo: npx tsx scripts/sync-print-order-payment.ts 88 89 90 91");
    console.log("         npx tsx scripts/sync-print-order-payment.ts --verbose --force-paid 88 89 90 91");
    process.exit(1);
  }

  console.log("\n--- Sincronizar estado de pago con Mercado Pago ---\n");
  if (forcePaid) console.log("Modo --force-paid: si no se encuentra pago en MP, se marcará igual como PAID.\n");

  for (const orderId of ids) {
    try {
      const result = await syncOne(orderId, { verbose, forcePaid });
      console.log(result.ok ? "✅" : "❌", result.message);
    } catch (e) {
      console.error("❌", `#${orderId}:`, e instanceof Error ? e.message : e);
    }
  }

  // Mostrar estado final en DB para confirmar qué verá la tabla
  console.log("\n--- Estado en DB (lo que verá la tabla de admin) ---");
  for (const orderId of ids) {
    const row = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true },
    });
    console.log(`  #${orderId}: paymentStatus = ${row?.paymentStatus ?? "no existe"}`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
