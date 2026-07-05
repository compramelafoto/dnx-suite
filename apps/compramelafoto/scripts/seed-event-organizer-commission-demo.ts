/**
 * Seed idempotente para probar comisiones de organizador de eventos (local / staging).
 *
 * Uso:
 *   npm run seed:demo-organizer-commissions
 *
 * Borrar datos demo (evento, álbum, pedido, comisión, fotos; mantiene usuarios demo):
 *   npm run seed:demo-organizer-commissions:wipe
 *
 * Producción: no ejecuta salvo ALLOW_EVENT_ORG_COMMISSION_DEMO_SEED=1.
 */

import {
  AlbumMode,
  CheckoutPaymentSource,
  EventMemberRole,
  EventMemberStatus,
  EventOrganizerCommissionPayoutMode,
  EventOrganizerCommissionStatus,
  EventType,
  EventVisibility,
  EventJoinPolicy,
  EventStatus,
  OrderStatus,
  OrderItemType,
  PrismaClient,
  Prisma,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

const ORGANIZER_EMAIL = "organizador.demo@compramelafoto.test";
const PHOTOGRAPHER_EMAIL = "fotografo.demo@compramelafoto.test";
const ADMIN_EMAIL = "admin.demo@compramelafoto.test";
const BUYER_EMAIL = "demo-org-commission-buyer@compramelafoto.test";

const DEMO_PASSWORD = "Demo123456!";

/** Slugs y marcadores estables (idempotencia). */
const DEMO_SHARE_SLUG = "demo-org-commission-event";
const DEMO_ALBUM_SLUG = "demo-org-commission-album";

const PHOTO_PREVIEW = "https://placehold.co/400x300/png?text=Demo+Org+Commission";
const PHOTO_KEY = "demo/org-commission/placeholder.jpg";

function assertSafeToRun(mode: "seed" | "wipe") {
  const allow =
    process.env.ALLOW_EVENT_ORG_COMMISSION_DEMO_SEED === "1" ||
    process.env.ALLOW_EVENT_ORG_COMMISSION_DEMO_SEED === "true";
  if (process.env.NODE_ENV === "production" && !allow) {
    throw new Error(
      `[seed-event-organizer-commission-demo] (${mode}) Bloqueado en NODE_ENV=production sin ALLOW_EVENT_ORG_COMMISSION_DEMO_SEED=1.`
    );
  }
}

async function wipeDemoData() {
  assertSafeToRun("wipe");

  const organizer = await prisma.user.findUnique({
    where: { email: ORGANIZER_EMAIL },
    select: { id: true },
  });

  const album = await prisma.album.findUnique({
    where: { publicSlug: DEMO_ALBUM_SLUG },
    select: { id: true, eventId: true },
  });

  if (!album) {
    console.log("[wipe] No hay álbum demo por slug; nada que borrar.");
    return;
  }

  const commissions = await prisma.eventOrganizerCommission.findMany({
    where: { albumId: album.id },
    select: { withdrawalRequestId: true },
  });
  const withdrawalIds = [
    ...new Set(
      commissions.map((c) => c.withdrawalRequestId).filter((id): id is number => id != null)
    ),
  ];

  const eventId = album.eventId;

  await prisma.$transaction(async (tx) => {
    await tx.eventOrganizerCommission.updateMany({
      where: { albumId: album.id },
      data: { withdrawalRequestId: null },
    });

    if (withdrawalIds.length > 0) {
      await tx.organizerCommissionWithdrawalRequest.deleteMany({
        where: { id: { in: withdrawalIds } },
      });
    }

    await tx.order.deleteMany({ where: { albumId: album.id } });
    await tx.photo.deleteMany({ where: { albumId: album.id } });

    await tx.album.delete({ where: { id: album.id } });

    if (eventId != null) {
      await tx.eventMember.deleteMany({ where: { eventId } });
      await tx.event.delete({ where: { id: eventId } });
    }
  });

  console.log("[wipe] Eliminados álbum, pedidos, comisiones, fotos, miembros y evento demo.");
  if (organizer) {
    console.log(`[wipe] Usuario organizador sigue existiendo (id=${organizer.id}).`);
  }
}

async function seedDemo() {
  assertSafeToRun("seed");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: passwordHash, role: Role.ADMIN, name: "Admin demo comisiones" },
    create: {
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: Role.ADMIN,
      name: "Admin demo comisiones",
    },
  });

  const organizer = await prisma.user.upsert({
    where: { email: ORGANIZER_EMAIL },
    update: { password: passwordHash, role: Role.ORGANIZER, name: "Organizador demo comisiones" },
    create: {
      email: ORGANIZER_EMAIL,
      password: passwordHash,
      role: Role.ORGANIZER,
      name: "Organizador demo comisiones",
    },
  });

  const photographer = await prisma.user.upsert({
    where: { email: PHOTOGRAPHER_EMAIL },
    update: { password: passwordHash, role: Role.PHOTOGRAPHER, name: "Fotógrafo demo comisiones" },
    create: {
      email: PHOTOGRAPHER_EMAIL,
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "Fotógrafo demo comisiones",
      city: "Buenos Aires",
      country: "Argentina",
    },
  });

  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 7);

  let event = await prisma.event.findFirst({
    where: { shareSlug: DEMO_SHARE_SLUG, creatorId: organizer.id },
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        title: "Evento demo — comisión organizador",
        description: "Datos generados por scripts/seed-event-organizer-commission-demo.ts",
        type: EventType.PUBLIC_SESSION,
        startsAt,
        endsAt: null,
        latitude: -34.6037,
        longitude: -58.3816,
        locationName: "Lugar demo",
        city: "Buenos Aires",
        visibility: EventVisibility.PUBLIC,
        joinPolicy: EventJoinPolicy.OPEN,
        creatorId: organizer.id,
        shareSlug: DEMO_SHARE_SLUG,
        status: EventStatus.ACTIVE,
        uploadsEnabled: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: 50,
      },
    });
  } else {
    event = await prisma.event.update({
      where: { id: event.id },
      data: {
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: 50,
        uploadsEnabled: true,
      },
    });
  }

  let album = await prisma.album.findUnique({
    where: { publicSlug: DEMO_ALBUM_SLUG },
  });

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  if (!album) {
    album = await prisma.album.create({
      data: {
        userId: photographer.id,
        title: "Álbum demo comisión organizador",
        publicSlug: DEMO_ALBUM_SLUG,
        eventId: event.id,
        mode: AlbumMode.EVENT,
        type: EventType.PUBLIC_SESSION,
        city: "Buenos Aires",
        latitude: -34.6037,
        longitude: -58.3816,
        startsAt,
        isTest: true,
        expiresAt,
        enableDigitalPhotos: true,
      },
    });
  } else {
    album = await prisma.album.update({
      where: { id: album.id },
      data: {
        eventId: event.id,
        userId: photographer.id,
        mode: AlbumMode.EVENT,
        isTest: true,
        expiresAt,
      },
    });
  }

  await prisma.eventMember.upsert({
    where: {
      eventId_userId: { eventId: event.id, userId: photographer.id },
    },
    create: {
      eventId: event.id,
      userId: photographer.id,
      role: EventMemberRole.PHOTOGRAPHER,
      status: EventMemberStatus.ACTIVE,
      termsAcceptedAt: new Date(),
      termsAcceptedText: "Demo seed",
    },
    update: {
      status: EventMemberStatus.ACTIVE,
      role: EventMemberRole.PHOTOGRAPHER,
    },
  });

  let photo = await prisma.photo.findFirst({
    where: { albumId: album.id },
    orderBy: { id: "asc" },
  });

  if (!photo) {
    photo = await prisma.photo.create({
      data: {
        albumId: album.id,
        userId: photographer.id,
        previewUrl: PHOTO_PREVIEW,
        originalKey: PHOTO_KEY,
        sellDigital: true,
        sellPrint: false,
      },
    });
  }

  let order = await prisma.order.findFirst({
    where: { albumId: album.id, buyerEmail: BUYER_EMAIL },
    orderBy: { id: "asc" },
  });

  if (!order) {
    order = await prisma.order.create({
      data: {
        albumId: album.id,
        buyerEmail: BUYER_EMAIL,
        buyerName: "Comprador demo",
        status: OrderStatus.PAID,
        totalCents: 3450,
        platformCommissionCents: 450,
        checkoutPaymentSource: CheckoutPaymentSource.SIMULATED,
        digitalDeliveredAt: new Date(),
        mpPaymentId: `demo-org-commission-mp-${Date.now()}`,
        isTest: true,
        items: {
          create: [
            {
              photoId: photo.id,
              priceCents: 3000,
              subtotalCents: 3000,
              quantity: 1,
              productType: OrderItemType.DIGITAL,
            },
          ],
        },
      },
    });
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        totalCents: 3450,
        platformCommissionCents: 450,
        checkoutPaymentSource: CheckoutPaymentSource.SIMULATED,
        digitalDeliveredAt: new Date(),
        isTest: true,
      },
    });
    const existingItem = await prisma.orderItem.findFirst({
      where: { orderId: order.id },
    });
    if (!existingItem) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          photoId: photo.id,
          priceCents: 3000,
          subtotalCents: 3000,
          quantity: 1,
          productType: OrderItemType.DIGITAL,
        },
      });
    }
    order = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  }

  const availableAt = new Date();
  availableAt.setDate(availableAt.getDate() - 2);

  await prisma.eventOrganizerCommission.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      eventId: event.id,
      organizerUserId: organizer.id,
      photographerUserId: photographer.id,
      albumId: album.id,
      organizerCommissionPercentage: 50,
      photographerBaseAmount: new Prisma.Decimal("3000"),
      platformFeeAmount: new Prisma.Decimal("450"),
      organizerCommissionAmount: new Prisma.Decimal("1500"),
      photographerNetAmount: new Prisma.Decimal("1500"),
      totalPaidAmount: new Prisma.Decimal("3450"),
      status: EventOrganizerCommissionStatus.AVAILABLE,
      availableAt,
      payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
      withdrawalRequestId: null,
    },
    update: {
      eventId: event.id,
      organizerUserId: organizer.id,
      photographerUserId: photographer.id,
      albumId: album.id,
      organizerCommissionPercentage: 50,
      photographerBaseAmount: new Prisma.Decimal("3000"),
      platformFeeAmount: new Prisma.Decimal("450"),
      organizerCommissionAmount: new Prisma.Decimal("1500"),
      photographerNetAmount: new Prisma.Decimal("1500"),
      totalPaidAmount: new Prisma.Decimal("3450"),
      status: EventOrganizerCommissionStatus.AVAILABLE,
      availableAt,
      payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
      withdrawalRequestId: null,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.log("\n✅ Seed demo comisiones organizador listo.\n");
  console.log("Usuarios (contraseña para todos: Demo123456!)");
  console.log(`  Organizador  ${ORGANIZER_EMAIL}  id=${organizer.id}`);
  console.log(`  Fotógrafo    ${PHOTOGRAPHER_EMAIL}  id=${photographer.id}`);
  console.log(`  Admin        ${ADMIN_EMAIL}  id=${admin.id}`);
  console.log("\nRecursos");
  console.log(`  Event id=${event.id}  shareSlug=${DEMO_SHARE_SLUG}`);
  console.log(`  Álbum id=${album.id}  slug=${DEMO_ALBUM_SLUG}`);
  console.log(`  Pedido id=${order.id}  comisión AVAILABLE para retiro (~ $1500 ARS)`);
  console.log("\nURLs sugeridas");
  console.log(`  Login:           ${baseUrl}/login`);
  console.log(`  Comisiones org.: ${baseUrl}/organizador/comisiones`);
  console.log(`  Retiros admin:   ${baseUrl}/admin/organizer-commission-withdrawals`);
  console.log(`  Evento público: ${baseUrl}/e/${DEMO_SHARE_SLUG}`);
  console.log("\nBorrar demo (conserva usuarios): npm run seed:demo-organizer-commissions:wipe\n");
}

async function main() {
  const wipe = process.argv.includes("--wipe");
  if (wipe) {
    await wipeDemoData();
    return;
  }
  await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
