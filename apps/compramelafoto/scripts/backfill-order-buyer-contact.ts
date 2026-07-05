/**
 * Backfill de buyerPhone / buyerName en pedidos de álbum PAID donde faltan datos del cliente.
 *
 * Fuentes (en orden):
 * 1. PrintOrder espejo (tag ALBUM_ORDER:{id}) → customerPhone / customerName
 * 2. Cuenta del comprador (buyerUser) → whatsapp / phone / name
 *
 * Uso:
 *   npx tsx scripts/backfill-order-buyer-contact.ts                    # dry-run, últimos 90 días
 *   npx tsx scripts/backfill-order-buyer-contact.ts --days=30          # dry-run, últimos 30 días
 *   npx tsx scripts/backfill-order-buyer-contact.ts --order-id=247     # un pedido
 *   npx tsx scripts/backfill-order-buyer-contact.ts --apply            # aplicar cambios
 *   npx tsx scripts/backfill-order-buyer-contact.ts --phone-only --apply  # solo teléfonos faltantes
 *
 * Requiere: .env con DATABASE_URL
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  resolveAlbumOrderBuyerName,
  resolveAlbumOrderBuyerPhone,
} from "../lib/orders/resolve-album-order-buyer-contact";

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const daysArg = argv.find((a) => a.startsWith("--days="));
  const orderIdArg = argv.find((a) => a.startsWith("--order-id="));
  return {
    apply: argv.includes("--apply"),
    all: argv.includes("--all"),
    phoneOnly: argv.includes("--phone-only"),
    days: daysArg ? Math.max(1, parseInt(daysArg.split("=")[1] ?? "90", 10)) : 90,
    orderId: orderIdArg ? parseInt(orderIdArg.split("=")[1] ?? "", 10) : null,
  };
}

function albumIdFromMirrorTags(tags: unknown): number | null {
  const list = Array.isArray(tags) ? tags : [];
  for (const tag of list) {
    const match = String(tag).match(/^ALBUM_ORDER:(\d+)$/);
    if (match && Number.isFinite(Number(match[1]))) return Number(match[1]);
  }
  return null;
}

type MirrorContact = {
  phone: string | null;
  name: string | null;
};

async function main() {
  const { apply, all, phoneOnly, days, orderId } = parseArgs();

  if (!apply) {
    console.log("Modo dry-run. Pasá --apply para escribir en la base.\n");
  }

  const since = all ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      isTest: false,
      ...(Number.isFinite(orderId) && orderId! > 0 ? { id: orderId! } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(phoneOnly
        ? { OR: [{ buyerPhone: null }, { buyerPhone: "" }] }
        : { OR: [{ buyerPhone: null }, { buyerPhone: "" }, { buyerName: null }, { buyerName: "" }] }),
    },
    select: {
      id: true,
      buyerEmail: true,
      buyerName: true,
      buyerPhone: true,
      createdAt: true,
      buyerUser: { select: { name: true, phone: true, whatsapp: true } },
    },
    orderBy: { id: "desc" },
    take: all || Number.isFinite(orderId) ? undefined : 2000,
  });

  if (orders.length === 0) {
    console.log("No hay pedidos PAID con buyerPhone o buyerName faltante en el rango indicado.");
    return;
  }

  const orderIds = orders.map((o) => o.id);
  const mirrors =
    orderIds.length === 0
      ? []
      : await prisma.printOrder.findMany({
          where: { OR: orderIds.map((id) => ({ tags: { has: `ALBUM_ORDER:${id}` } })) },
          select: {
            customerPhone: true,
            customerName: true,
            tags: true,
          },
        });

  const mirrorByAlbumOrderId = new Map<number, MirrorContact>();
  for (const mirror of mirrors) {
    const albumOrderId = albumIdFromMirrorTags(mirror.tags);
    if (albumOrderId == null) continue;
    mirrorByAlbumOrderId.set(albumOrderId, {
      phone: trimOrNull(mirror.customerPhone),
      name: trimOrNull(mirror.customerName),
    });
  }

  let wouldUpdate = 0;
  let wouldUpdatePhone = 0;
  let wouldUpdateName = 0;
  let updated = 0;
  let updatedPhone = 0;
  let updatedName = 0;

  console.log(
    `Pedidos candidatos: ${orders.length}` +
      (since ? ` (desde ${since.toISOString().slice(0, 10)})` : orderId ? ` (#${orderId})` : " (histórico completo)") +
      "\n"
  );
  console.log("orderId | email | phone antes → después | name antes → después | fuente");

  for (const order of orders) {
    const mirror = mirrorByAlbumOrderId.get(order.id);
    const currentPhone = trimOrNull(order.buyerPhone);
    const currentName = trimOrNull(order.buyerName);

    const resolvedPhone =
      currentPhone ??
      mirror?.phone ??
      trimOrNull(order.buyerUser?.whatsapp) ??
      trimOrNull(order.buyerUser?.phone) ??
      null;

    const resolvedName =
      currentName ??
      mirror?.name ??
      trimOrNull(order.buyerUser?.name) ??
      null;

    const patch: { buyerPhone?: string; buyerName?: string } = {};
    let source = "";

    if (!currentPhone && resolvedPhone) {
      patch.buyerPhone = resolvedPhone;
      if (mirror?.phone === resolvedPhone) source = "mirror.phone";
      else if (trimOrNull(order.buyerUser?.whatsapp) === resolvedPhone) source = "buyerUser.whatsapp";
      else source = "buyerUser.phone";
    }

    if (!currentName && resolvedName && !phoneOnly) {
      patch.buyerName = resolvedName;
      if (!source) {
        source = mirror?.name === resolvedName ? "mirror.name" : "buyerUser.name";
      } else if (mirror?.name === resolvedName) {
        source += "+mirror.name";
      } else {
        source += "+buyerUser.name";
      }
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    wouldUpdate += 1;
    if (patch.buyerPhone) wouldUpdatePhone += 1;
    if (patch.buyerName) wouldUpdateName += 1;
    console.log(
      [
        `#${order.id}`,
        order.buyerEmail || "—",
        `${currentPhone || "—"} → ${patch.buyerPhone ?? currentPhone ?? "—"}`,
        `${currentName || "—"} → ${patch.buyerName ?? currentName ?? "—"}`,
        source || "?",
      ].join(" | ")
    );

    if (apply) {
      await prisma.order.update({
        where: { id: order.id },
        data: patch,
      });
      updated += 1;
      if (patch.buyerPhone) updatedPhone += 1;
      if (patch.buyerName) updatedName += 1;
    }
  }

  const phoneCount = apply ? updatedPhone : wouldUpdatePhone;
  const nameCount = apply ? updatedName : wouldUpdateName;
  console.log(
    `\n${apply ? "Actualizados" : "Se actualizarían"}: ${apply ? updated : wouldUpdate} pedidos` +
      ` (teléfono: ${phoneCount}, nombre: ${nameCount}) de ${orders.length} candidatos.`
  );

  if (!apply && wouldUpdate > 0) {
    console.log("Ejecutá con --apply para persistir los cambios.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
