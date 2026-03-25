/**
 * Registrar o listar fees de plataforma no cobrados (split mal hecho en MP).
 * Uso:
 *   npx tsx scripts/register-uncollected-fee.ts list
 *   npx tsx scripts/register-uncollected-fee.ts add PRINT_ORDER 88
 *   npx tsx scripts/register-uncollected-fee.ts resolve PRINT_ORDER 88
 *
 * Para el pedido #88: el fee que no se cobró fue 173 centavos ($1,73).
 */

import { feeFromTotal } from "../lib/pricing/fee-formula";
import { prisma } from "../lib/prisma";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

async function list() {
  const pending = await prisma.uncollectedPlatformFee.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  const totalCents = pending.reduce((s, r) => s + r.amountCents, 0);
  console.log("\n--- Fees no cobrados (pendientes de recuperar) ---\n");
  if (pending.length === 0) {
    console.log("No hay registros pendientes.");
    return;
  }
  for (const r of pending) {
    console.log(`${r.orderType} #${r.orderId}: ${formatCents(r.amountCents)} | ${r.createdAt.toISOString().slice(0, 10)}${r.notes ? ` | ${r.notes}` : ""}`);
  }
  console.log("\nTotal pendiente:", formatCents(totalCents));
  console.log("");
}

async function add(orderType: string, orderIdStr: string) {
  const orderId = Number(orderIdStr);
  if (!Number.isFinite(orderId) || !["PRINT_ORDER", "ALBUM_ORDER"].includes(orderType)) {
    console.log("Uso: add PRINT_ORDER|ALBUM_ORDER <orderId>");
    return;
  }

  let amountCents = 0;
  if (orderType === "PRINT_ORDER") {
    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { total: true, pricingSnapshot: true },
    });
    if (!order) {
      console.log("PrintOrder no encontrado:", orderId);
      return;
    }
    const snap = (order.pricingSnapshot ?? {}) as Record<string, unknown>;
    const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 15) || 15;
    amountCents = Number(snap.marketplaceFeeCents ?? 0) || feeFromTotal(Number(order.total), pct);
  } else {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalCents: true, pricingSnapshot: true },
    });
    if (!order) {
      console.log("Order (álbum) no encontrado:", orderId);
      return;
    }
    const snap = (order.pricingSnapshot ?? {}) as Record<string, unknown>;
    const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 15) || 15;
    amountCents = Number(snap.marketplaceFeeCents ?? 0) || feeFromTotal(Number(order.totalCents), pct);
  }

  if (amountCents <= 0) {
    console.log("El fee calculado es 0. Revisá el pedido.");
    return;
  }

  await prisma.uncollectedPlatformFee.upsert({
    where: {
      orderType_orderId: { orderType, orderId },
    },
    create: { orderType, orderId, amountCents, status: "PENDING", notes: "Registrado por script (split mal hecho en MP)." },
    update: { amountCents, status: "PENDING" },
  });
  console.log("Registrado:", orderType, "#" + orderId, "|", formatCents(amountCents));
}

async function resolve(orderType: string, orderIdStr: string) {
  const orderId = Number(orderIdStr);
  if (!Number.isFinite(orderId)) return;
  const updated = await prisma.uncollectedPlatformFee.updateMany({
    where: { orderType, orderId, status: "PENDING" },
    data: { status: "RECOVERED", resolvedAt: new Date() },
  });
  console.log(updated.count ? "Marcado como recuperado." : "No había registro pendiente.");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "list") {
    await list();
  } else if (cmd === "add") {
    await add(process.argv[3] ?? "", process.argv[4] ?? "");
  } else if (cmd === "resolve") {
    await resolve(process.argv[3] ?? "", process.argv[4] ?? "");
  } else {
    console.log("Uso: register-uncollected-fee.ts list | add <PRINT_ORDER|ALBUM_ORDER> <id> | resolve <orderType> <id>");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
