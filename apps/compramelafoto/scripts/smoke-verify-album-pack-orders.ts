/**
 * Verificación read-only post smoke test — packs PRINT/MIXED de galería.
 *
 * Uso:
 *   npx tsx scripts/smoke-verify-album-pack-orders.ts --scan
 *   npx tsx scripts/smoke-verify-album-pack-orders.ts --order 12345
 *   npx tsx scripts/smoke-verify-album-pack-orders.ts --order 12345 --order 12346
 *
 * Solo lectura. No crea datos ni dispara webhooks.
 */

import { config } from "dotenv";
import { OrderItemType, OrderStatus, PrismaClient } from "@prisma/client";
import { readAlbumPackOrderSnapshotPricing } from "@/lib/album-packs/album-pack-order-snapshot-read";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

type CheckResult = { label: string; ok: boolean; detail: string };

function parseArgs(): { scan: boolean; orderIds: number[] } {
  const args = process.argv.slice(2);
  const scan = args.includes("--scan");
  const orderIds: number[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--order" && args[i + 1]) {
      const id = Number.parseInt(args[i + 1], 10);
      if (Number.isInteger(id) && id > 0) orderIds.push(id);
      i += 1;
    }
  }
  return { scan, orderIds };
}

function warnEnvironment() {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  let host = "unknown";
  try {
    host = new URL(appUrl).hostname;
  } catch {
    /* ignore */
  }
  const isProdHost =
    host.includes("compramelafoto.com") && !host.includes("preview") && !host.includes("staging");
  console.log(`[smoke-verify] APP host: ${host || "(unset)"}`);
  console.log(`[smoke-verify] MP_ENV: ${process.env.MP_ENV || "(unset)"}`);
  if (isProdHost) {
    console.warn(
      "[smoke-verify] ADVERTENCIA: APP_URL parece producción. Usá DATABASE_URL de staging para smoke tests."
    );
  }
}

function snapshotFulfillmentKind(pricingSnapshot: unknown): string | null {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") return null;
  const snap = pricingSnapshot as Record<string, unknown>;
  if (snap.fulfillmentKind === "DIGITAL" || snap.fulfillmentKind === "PRINT" || snap.fulfillmentKind === "MIXED") {
    return snap.fulfillmentKind;
  }
  const type = String(snap.type ?? "");
  if (type === "ALBUM_PACK_ORDER_V2" && typeof snap.fulfillmentKind === "string") {
    return snap.fulfillmentKind;
  }
  return null;
}

async function verifyOrder(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { id: true, productType: true, photoId: true, lineOrigin: true } },
      album: { select: { id: true, title: true, publicSlug: true } },
    },
  });

  if (!order) {
    console.log(`\n=== Order #${orderId} === NOT FOUND`);
    return;
  }

  const checks: CheckResult[] = [];
  const isPackOrder = String(order.preCompraPaymentRef ?? "").startsWith("ALBUM_PACK_DRAFT:");
  const digitalItems = order.items.filter((i) => i.productType === OrderItemType.DIGITAL);
  const printItems = order.items.filter((i) => i.productType === OrderItemType.PRINT);
  const fulfillment = snapshotFulfillmentKind(order.pricingSnapshot);

  checks.push({
    label: "Es pedido de pack galería",
    ok: isPackOrder,
    detail: order.preCompraPaymentRef ?? "(sin ref)",
  });
  checks.push({
    label: "Estado pagado o pendiente conocido",
    ok: order.status === OrderStatus.PAID || order.status === OrderStatus.PENDING,
    detail: order.status,
  });

  const printOrder = await prisma.printOrder.findFirst({
    where: { tags: { has: `ALBUM_ORDER:${orderId}` } },
    include: { items: { select: { id: true, fileKey: true, quantity: true } } },
  });

  const zipJobs = await prisma.zipGenerationJob.findMany({
    where: { orderId },
    select: { id: true, status: true, photoIds: true },
  });

  const digitalTokens = await prisma.orderDownloadToken.findMany({
    where: { orderId, type: "CLIENT_DIGITAL" },
    select: { id: true },
  });

  if (fulfillment === "PRINT") {
    checks.push({ label: "PRINT: 0 ítems DIGITAL", ok: digitalItems.length === 0, detail: `${digitalItems.length}` });
    checks.push({ label: "PRINT: ≥1 ítem PRINT", ok: printItems.length > 0, detail: `${printItems.length}` });
    checks.push({
      label: "PRINT: PrintOrder espejo",
      ok: printOrder != null && printOrder.items.length === printItems.length,
      detail: printOrder ? `${printOrder.items.length} ítems` : "no encontrado",
    });
    checks.push({
      label: "PRINT: tag ALBUM_ORDER",
      ok: printOrder?.tags.includes(`ALBUM_ORDER:${orderId}`) ?? false,
      detail: printOrder?.tags.join(", ") ?? "—",
    });
    checks.push({
      label: "PRINT: sin ZIP digital",
      ok: zipJobs.length === 0 && digitalTokens.length === 0,
      detail: `zipJobs=${zipJobs.length}, tokens=${digitalTokens.length}`,
    });
  } else if (fulfillment === "MIXED") {
    checks.push({
      label: "MIXED: ítems DIGITAL = PRINT",
      ok: digitalItems.length > 0 && digitalItems.length === printItems.length,
      detail: `${digitalItems.length} D / ${printItems.length} P`,
    });
    const digitalPhotoIds = digitalItems.map((i) => i.photoId).sort((a, b) => a - b);
    const printPhotoIds = printItems.map((i) => i.photoId).sort((a, b) => a - b);
    checks.push({
      label: "MIXED: mismas photoIds D/P",
      ok: JSON.stringify(digitalPhotoIds) === JSON.stringify(printPhotoIds),
      detail: `D=[${digitalPhotoIds.join(",")}] P=[${printPhotoIds.join(",")}]`,
    });
    checks.push({
      label: "MIXED: PrintOrder = ítems PRINT",
      ok: printOrder != null && printOrder.items.length === printItems.length,
      detail: printOrder ? `${printOrder.items.length}` : "no encontrado",
    });
    checks.push({
      label: "MIXED: ZIP o token digital esperado",
      ok: zipJobs.length > 0 || digitalTokens.length > 0 || order.status !== OrderStatus.PAID,
      detail: `zipJobs=${zipJobs.length}, tokens=${digitalTokens.length}, status=${order.status}`,
    });
  } else {
    checks.push({
      label: "DIGITAL legacy: sin PRINT",
      ok: printItems.length === 0,
      detail: `${digitalItems.length} D / ${printItems.length} P`,
    });
  }

  const pricing = readAlbumPackOrderSnapshotPricing(order.pricingSnapshot);
  const allOk = checks.every((c) => c.ok);

  console.log(`\n=== Order #${orderId} ${allOk ? "✓" : "✗"} ===`);
  console.log(`  Album: ${order.album?.title ?? "?"} (id=${order.albumId}, slug=${order.album?.publicSlug ?? "?"})`);
  console.log(`  Status: ${order.status} | fulfillment: ${fulfillment ?? "legacy/unknown"}`);
  console.log(`  Items: ${digitalItems.length} DIGITAL, ${printItems.length} PRINT`);
  if (pricing) console.log(`  Total snapshot: ${pricing.clientTotalArs} ARS cliente`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.label}: ${c.detail}`);
  }
}

async function scanRecentPackOrders(): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { preCompraPaymentRef: { startsWith: "ALBUM_PACK_DRAFT:" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      pricingSnapshot: true,
      items: { select: { productType: true } },
      album: { select: { publicSlug: true, title: true } },
    },
  });

  console.log(`\n[scan] Últimos ${orders.length} pedidos ALBUM_PACK_DRAFT:`);
  if (orders.length === 0) {
    console.log("  (ninguno encontrado en esta base)");
    return;
  }

  for (const o of orders) {
    const fk = snapshotFulfillmentKind(o.pricingSnapshot) ?? "DIGITAL?";
    const d = o.items.filter((i) => i.productType === OrderItemType.DIGITAL).length;
    const p = o.items.filter((i) => i.productType === OrderItemType.PRINT).length;
    console.log(
      `  #${o.id} ${o.status} ${fk} D=${d} P=${p} ${o.createdAt.toISOString().slice(0, 10)} album=${o.album?.publicSlug ?? "?"}`
    );
  }
  console.log("\nVerificar uno: npx tsx scripts/smoke-verify-album-pack-orders.ts --order <id>");
}

async function main() {
  warnEnvironment();
  const { scan, orderIds } = parseArgs();

  if (!scan && orderIds.length === 0) {
    console.log("Uso: --scan | --order <id> [--order <id> ...]");
    process.exit(1);
  }

  if (scan) await scanRecentPackOrders();
  for (const id of orderIds) {
    await verifyOrder(id);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
