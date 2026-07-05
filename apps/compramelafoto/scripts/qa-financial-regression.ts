/**
 * Regresión financiera controlada — solo local/staging.
 *
 * Uso:
 *   ALLOW_FINANCIAL_QA=1 npx tsx scripts/qa-financial-regression.ts
 *
 * Requiere DATABASE_URL apuntando a local o staging (bloqueado en production salvo ALLOW_FINANCIAL_QA=1).
 */

import {
  AlbumPackAvailabilityPhase,
  AlbumPackType,
  CheckoutPaymentSource,
  EventMemberRole,
  EventMemberStatus,
  EventStatus,
  EventType,
  EventVisibility,
  EventJoinPolicy,
  AlbumMode,
  OrderItemLineOrigin,
  OrderItemType,
  OrderOrigin,
  OrderStatus,
  OrganizerCommissionAppliesTo,
  PrismaClient,
  ReferralStatus,
  Role,
} from "@prisma/client";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import {
  albumPackClientPriceArs,
  albumPackPlatformFeeArs,
} from "@/lib/album-packs/album-pack-client-price";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer } from "@/lib/event-organizer-commission-mp-checkout";
import {
  applyAndPersistSellerReferralDiscount,
  computeReferralEarningAmounts,
} from "@/lib/referral/referral-marketplace-fee";
import { createReferralEarningsForPaidSale } from "@/lib/referral/create-referral-earnings-for-paid-sale";
import { ensureEventOrganizerCommissionSnapshotForPaidOrder } from "@/lib/event-organizer-commission-snapshot";
import { createOrganizerCommissionForPaidOrder } from "@/lib/school-organizer-commission";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

const PREFIX = "FINANCIAL_QA_";
const RUN_ID = Date.now().toString(36);

const EMAILS = {
  organizer: `${PREFIX}ORGANIZER_${RUN_ID}@test.local`,
  photographer: `${PREFIX}PHOTOGRAPHER_${RUN_ID}@test.local`,
  referrer: `${PREFIX}REFERRER_${RUN_ID}@test.local`,
  schoolAdmin: `${PREFIX}SCHOOL_ADMIN_${RUN_ID}@test.local`,
  buyer: `${PREFIX}BUYER_${RUN_ID}@test.local`,
  dummyReferred: `${PREFIX}DUMMY_REFERRED_${RUN_ID}@test.local`,
};

const BASE_ARS = 10_000;
const FEE_PCT = 15;
const CLIENT_ARS = 11_500;
const FEE_GROSS = 1_500;
const ORG_PCT = 10;
const ORG_AMOUNT = 1_000;
const SCHOOL_PCT = 10;
const SCHOOL_AMOUNT = 1_000;
const REFERRAL_DISCOUNT = 500;
const REFERRAL_EARNING = 750;
const PLATFORM_NET = 750;

type CaseResult = {
  caseId: string;
  label: string;
  field: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
  ok: boolean;
};

const results: CaseResult[] = [];
const created = {
  userIds: [] as number[],
  eventIds: [] as number[],
  albumIds: [] as number[],
  schoolIds: [] as number[],
  photoIds: [] as number[],
  albumPackIds: [] as string[],
  sessionIds: [] as string[],
  draftIds: [] as string[],
  orderIds: [] as number[],
  referralCodeIds: [] as number[],
  attributionIds: [] as number[],
  referralEarningIds: [] as number[],
};

function assertCase(
  caseId: string,
  label: string,
  field: string,
  expected: string | number | boolean,
  actual: string | number | boolean
) {
  const ok =
    typeof expected === "number" && typeof actual === "number"
      ? expected === actual
      : String(expected) === String(actual);
  results.push({ caseId, label, field, expected, actual, ok });
  if (!ok) {
    console.error(`  ✗ [${caseId}] ${field}: expected ${expected}, got ${actual}`);
  }
}

function assertProductionSafe() {
  const allow =
    process.env.ALLOW_FINANCIAL_QA === "1" || process.env.ALLOW_FINANCIAL_QA === "true";
  if (process.env.NODE_ENV === "production" && !allow) {
    throw new Error(
      "Bloqueado en NODE_ENV=production. Set ALLOW_FINANCIAL_QA=1 para staging controlado."
    );
  }
  if (!allow) {
    console.warn(
      "[qa-financial] Tip: set ALLOW_FINANCIAL_QA=1 para confirmar ejecución en entorno no-prod."
    );
  }
}

async function createUser(email: string, role: Role, name: string, extra?: Record<string, unknown>) {
  const passwordHash = await bcrypt.hash("QaTest123456!", 8);
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      role,
      name,
      city: "Buenos Aires",
      country: "Argentina",
      mpConnectedAt: new Date(),
      mpUserId: `qa_mp_${RUN_ID}_${email}`,
      platformCommissionPercentOverride: FEE_PCT,
      ...extra,
    },
  });
  created.userIds.push(user.id);
  return user;
}

async function createPhoto(albumId: number, userId: number) {
  const photo = await prisma.photo.create({
    data: {
      albumId,
      userId,
      previewUrl: "https://placehold.co/400x300/png?text=FINANCIAL_QA",
      originalKey: `${PREFIX}photo/${RUN_ID}/${albumId}.jpg`,
      sellDigital: true,
      sellPrint: false,
    },
  });
  created.photoIds.push(photo.id);
  return photo;
}

async function createEventAlbumPack(organizerId: number, photographerId: number) {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 14);

  const event = await prisma.event.create({
    data: {
      title: `${PREFIX}EVENT_${RUN_ID}`,
      type: EventType.PUBLIC_SESSION,
      startsAt,
      latitude: -34.6037,
      longitude: -58.3816,
      city: "Buenos Aires",
      visibility: EventVisibility.PUBLIC,
      joinPolicy: EventJoinPolicy.OPEN,
      creatorId: organizerId,
      shareSlug: `${PREFIX}event_${RUN_ID}`.toLowerCase(),
      status: EventStatus.ACTIVE,
      uploadsEnabled: true,
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: ORG_PCT,
    },
  });
  created.eventIds.push(event.id);

  const album = await prisma.album.create({
    data: {
      userId: photographerId,
      title: `${PREFIX}ALBUM_EVENT_${RUN_ID}`,
      publicSlug: `${PREFIX}album_event_${RUN_ID}`.toLowerCase(),
      eventId: event.id,
      mode: AlbumMode.EVENT,
      type: EventType.PUBLIC_SESSION,
      city: "Buenos Aires",
      // isTest=false: ensureEventOrganizerCommissionSnapshotForPaidOrder no persiste comisiones en pedidos test.
      isTest: false,
      albumPackPayEnabled: true,
      enableDigitalPhotos: true,
      expiresAt: new Date(Date.now() + 365 * 86400000),
    },
  });
  created.albumIds.push(album.id);

  await prisma.eventMember.create({
    data: {
      eventId: event.id,
      userId: photographerId,
      role: EventMemberRole.PHOTOGRAPHER,
      status: EventMemberStatus.ACTIVE,
      termsAcceptedAt: new Date(),
      termsAcceptedText: PREFIX,
    },
  });

  const photo = await createPhoto(album.id, photographerId);

  const pack = await prisma.albumPack.create({
    data: {
      albumId: album.id,
      name: `${PREFIX}PACK_${RUN_ID}`,
      price: BASE_ARS,
      availabilityPhase: AlbumPackAvailabilityPhase.POST_UPLOAD,
      packType: AlbumPackType.DIGITAL,
      isActive: true,
      requiresSelection: false,
    },
  });
  created.albumPackIds.push(pack.id);

  return { event, album, photo, pack };
}

async function createSchoolAlbumPack(photographerId: number, schoolAdminId: number) {
  const school = await prisma.school.create({
    data: {
      ownerId: photographerId,
      name: `${PREFIX}SCHOOL_${RUN_ID}`,
      slug: `${PREFIX}school_${RUN_ID}`.toLowerCase(),
      contactEmail: EMAILS.schoolAdmin,
    },
  });
  created.schoolIds.push(school.id);

  await prisma.schoolOrganizer.create({
    data: {
      schoolId: school.id,
      userId: schoolAdminId,
      status: "ACTIVE",
    },
  });

  const album = await prisma.album.create({
    data: {
      userId: photographerId,
      title: `${PREFIX}ALBUM_SCHOOL_${RUN_ID}`,
      publicSlug: `${PREFIX}album_school_${RUN_ID}`.toLowerCase(),
      schoolId: school.id,
      isTest: true,
      albumPackPayEnabled: true,
      enableDigitalPhotos: true,
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: SCHOOL_PCT,
      organizerCommissionAppliesTo: [OrganizerCommissionAppliesTo.POST_EVENT],
      expiresAt: new Date(Date.now() + 365 * 86400000),
    },
  });
  created.albumIds.push(album.id);

  const photo = await createPhoto(album.id, photographerId);

  const pack = await prisma.albumPack.create({
    data: {
      albumId: album.id,
      name: `${PREFIX}SCHOOL_PACK_${RUN_ID}`,
      price: BASE_ARS,
      availabilityPhase: AlbumPackAvailabilityPhase.POST_UPLOAD,
      packType: AlbumPackType.DIGITAL,
      isActive: true,
      requiresSelection: false,
    },
  });
  created.albumPackIds.push(pack.id);

  return { school, album, photo, pack };
}

async function createAlbumPackOrder(params: {
  albumId: number;
  photoId: number;
  packId: string;
  packName: string;
  /** false cuando hay que persistir EventOrganizerCommission (el snapshot de prod omite isTest). */
  isTest?: boolean;
}) {
  const isTest = params.isTest ?? true;
  const marketplaceFeeCents = albumPackPlatformFeeArs(BASE_ARS, FEE_PCT);
  const totalCents = albumPackClientPriceArs(BASE_ARS, FEE_PCT);

  const order = await prisma.order.create({
    data: {
      albumId: params.albumId,
      buyerEmail: EMAILS.buyer,
      totalCents,
      status: OrderStatus.PENDING,
      origin: OrderOrigin.STANDARD_CHECKOUT,
      checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
      isTest,
      pricingSnapshot: {
        type: "ALBUM_PACK_ORDER_V1",
        packName: params.packName,
        basePriceArs: BASE_ARS,
        marketplaceFeePercent: FEE_PCT,
        marketplaceFeeCents,
        clientTotalArs: totalCents,
      },
      items: {
        create: [
          {
            photoId: params.photoId,
            productType: OrderItemType.DIGITAL,
            lineOrigin: OrderItemLineOrigin.STANDARD,
            quantity: 1,
            priceCents: totalCents,
            subtotalCents: totalCents,
          },
        ],
      },
    },
  });
  created.orderIds.push(order.id);
  return { order, marketplaceFeeCents, totalCents };
}

async function createPostEventSchoolOrder(albumId: number, photoId: number) {
  const marketplaceFeeCents = feeFromTotal(CLIENT_ARS, FEE_PCT);
  const order = await prisma.order.create({
    data: {
      albumId,
      buyerEmail: EMAILS.buyer,
      totalCents: CLIENT_ARS,
      status: OrderStatus.PENDING,
      origin: OrderOrigin.STANDARD_CHECKOUT,
      checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
      isTest: true,
      pricingSnapshot: {
        type: "STANDARD_ALBUM_CHECKOUT_V1",
        marketplaceFeePercent: FEE_PCT,
        marketplaceFeeCents,
      },
      items: {
        create: [
          {
            photoId,
            productType: OrderItemType.DIGITAL,
            lineOrigin: OrderItemLineOrigin.STANDARD,
            quantity: 1,
            priceCents: CLIENT_ARS,
            subtotalCents: CLIENT_ARS,
          },
        ],
      },
    },
  });
  created.orderIds.push(order.id);
  return { order, marketplaceFeeCents };
}

async function computeAlbumPackMpSplit(params: {
  orderId: number;
  albumId: number;
  eventId: number | null;
  photographerId: number;
  totalCents: number;
  marketplaceFeeGross: number;
  applyReferralDiscount: boolean;
}) {
  let feePlatformOnly = params.marketplaceFeeGross;
  let referralDiscount = 0;

  if (params.applyReferralDiscount) {
    const d = await applyAndPersistSellerReferralDiscount({
      sellerUserId: params.photographerId,
      marketplaceFeeCents: feePlatformOnly,
      persist: { orderType: "ALBUM_ORDER", orderId: params.orderId },
    });
    feePlatformOnly = d.marketplaceFeeCents;
    referralDiscount = d.discountCents;
  }

  const platformPercent = await resolveClientMarketplaceFeePercent({
    photographerId: params.photographerId,
    labId: null,
  });

  const marketplaceFeeMp = await buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer({
    orderId: params.orderId,
    albumId: params.albumId,
    eventId: params.eventId,
    totalPaidPesos: params.totalCents,
    extensionSurchargePesos: 0,
    platformPercent,
    marketplaceFeePlatformOnlyPesos: feePlatformOnly,
  });

  const photographerNetMp = params.totalCents - marketplaceFeeMp;

  return {
    feePlatformOnly,
    referralDiscount,
    marketplaceFeeMp,
    photographerNetMp,
    platformPercent,
  };
}

async function markOrderPaidAndRunSnapshots(orderId: number, platformCommissionCents: number) {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.PAID,
      platformCommissionCents,
      mpPaymentId: `${PREFIX}sim_${orderId}`,
    },
  });

  await ensureEventOrganizerCommissionSnapshotForPaidOrder(orderId, {
    paymentApprovedAt: new Date(),
  });
  await createOrganizerCommissionForPaidOrder({
    orderId,
    paymentId: `${PREFIX}sim_${orderId}`,
  });
}

async function getOrCreateReferralCode(userId: number) {
  const existing = await prisma.referralCode.findUnique({ where: { ownerUserId: userId } });
  if (existing) return existing;
  const code = await prisma.referralCode.create({
    data: {
      code: `${PREFIX}REF_${RUN_ID}_${userId}`,
      ownerUserId: userId,
      isActive: true,
    },
  });
  created.referralCodeIds.push(code.id);
  return code;
}

async function upsertAttribution(referrerUserId: number, referredUserId: number) {
  await prisma.referralEarning.deleteMany({
    where: { attribution: { referredUserId } },
  });
  await prisma.referralAttribution.deleteMany({ where: { referredUserId } });

  const code = await getOrCreateReferralCode(referrerUserId);
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setFullYear(endsAt.getFullYear() + 1);

  const attr = await prisma.referralAttribution.create({
    data: {
      referralCodeId: code.id,
      referrerUserId,
      referredUserId,
      startsAt: now,
      endsAt,
      status: ReferralStatus.ACTIVE,
    },
  });
  created.attributionIds.push(attr.id);
  return attr;
}

async function seedPhotographerReferralBalance(photographerId: number, amount: number) {
  const dummy = await createUser(EMAILS.dummyReferred, Role.CUSTOMER, `${PREFIX}DUMMY`);
  const attr = await upsertAttribution(photographerId, dummy.id);
  const earning = await prisma.referralEarning.create({
    data: {
      attributionId: attr.id,
      saleRef: `${PREFIX}BALANCE_SEED_${RUN_ID}`,
      platformFeeCents: amount * 2,
      referralAmountCents: amount,
      platformNetCents: amount,
    },
  });
  created.referralEarningIds.push(earning.id);
}

async function simulateReferralEarningForOrder(params: {
  orderId: number;
  photographerId: number;
  albumEventId: number | null;
  platformFeeCents: number;
  referralFeeDiscountCents: number;
}) {
  const earningAmounts = computeReferralEarningAmounts({
    grossPlatformFeeCents: params.platformFeeCents,
    referralFeeDiscountCents: params.referralFeeDiscountCents,
  });

  const saleRef = `ALBUM_ORDER:${params.orderId}`;
  const result = await createReferralEarningsForPaidSale({
    saleRef,
    orderType: "ALBUM_ORDER",
    orderId: params.orderId,
    paymentId: `${PREFIX}sim_${params.orderId}`,
    photographerUserId: params.photographerId,
    eventId: params.albumEventId,
    grossPlatformFeeCents: params.platformFeeCents,
    referralFeeDiscountCents: params.referralFeeDiscountCents,
  });

  const photographerLine = result.created.find(
    (row) => row.referralProgram === "PHOTOGRAPHER_REFERRAL"
  );
  const skippedEvent = result.skipped.some(
    (row) =>
      row.referralProgram === "PHOTOGRAPHER_REFERRAL" &&
      row.reason === "event_organizer_double_benefit"
  );

  if (photographerLine) {
    const row = await prisma.referralEarning.findFirst({
      where: { saleRef, attributionId: photographerLine.attributionId },
      select: { id: true },
    });
    if (row) created.referralEarningIds.push(row.id);
    return { created: true, skipped: false, amounts: earningAmounts, skipReason: null };
  }

  if (skippedEvent) {
    return { created: false, skipped: true, amounts: earningAmounts, skipReason: "event_organizer" };
  }

  if (!earningAmounts) {
    return { created: false, skipped: false, amounts: null as null, skipReason: "no_attribution_or_fee" };
  }

  return { created: false, skipped: false, amounts: earningAmounts, skipReason: "no_attribution_or_fee" };
}

async function runCase1(ctx: Awaited<ReturnType<typeof createEventAlbumPack>>) {
  const caseId = "1";
  const label = "AlbumPack + evento colaborativo";
  const { order, marketplaceFeeCents, totalCents } = await createAlbumPackOrder({
    albumId: ctx.album.id,
    photoId: ctx.photo.id,
    packId: ctx.pack.id,
    packName: ctx.pack.name,
    isTest: false,
  });

  const split = await computeAlbumPackMpSplit({
    orderId: order.id,
    albumId: ctx.album.id,
    eventId: ctx.event.id,
    photographerId: ctx.album.userId,
    totalCents,
    marketplaceFeeGross: marketplaceFeeCents,
    applyReferralDiscount: false,
  });

  assertCase(caseId, label, "cliente", CLIENT_ARS, totalCents);
  assertCase(caseId, label, "fee bruto", FEE_GROSS, marketplaceFeeCents);
  assertCase(caseId, label, "marketplace_fee MP", 2500, split.marketplaceFeeMp);
  assertCase(caseId, label, "fotógrafo neto MP", 9000, split.photographerNetMp);

  await markOrderPaidAndRunSnapshots(order.id, FEE_GROSS);

  const eOrg = await prisma.eventOrganizerCommission.findUnique({ where: { orderId: order.id } });
  assertCase(caseId, label, "EventOrganizerCommission", ORG_AMOUNT, Number(eOrg?.organizerCommissionAmount ?? -1));
}

async function runCase2(ctx: Awaited<ReturnType<typeof createEventAlbumPack>>, photographerId: number) {
  const caseId = "2";
  const label = "AlbumPack + evento + descuento referido 500";
  await seedPhotographerReferralBalance(photographerId, REFERRAL_DISCOUNT);

  const { order, marketplaceFeeCents, totalCents } = await createAlbumPackOrder({
    albumId: ctx.album.id,
    photoId: ctx.photo.id,
    packId: ctx.pack.id,
    packName: ctx.pack.name,
    isTest: false,
  });

  const split = await computeAlbumPackMpSplit({
    orderId: order.id,
    albumId: ctx.album.id,
    eventId: ctx.event.id,
    photographerId,
    totalCents,
    marketplaceFeeGross: marketplaceFeeCents,
    applyReferralDiscount: true,
  });

  assertCase(caseId, label, "cliente", CLIENT_ARS, totalCents);
  assertCase(caseId, label, "descuento referido", REFERRAL_DISCOUNT, split.referralDiscount);
  assertCase(caseId, label, "fee efectivo", 1000, split.feePlatformOnly);
  assertCase(caseId, label, "marketplace_fee MP", 2000, split.marketplaceFeeMp);
  assertCase(caseId, label, "fotógrafo neto MP", 9500, split.photographerNetMp);

  await markOrderPaidAndRunSnapshots(order.id, FEE_GROSS);
  const eOrg = await prisma.eventOrganizerCommission.findUnique({ where: { orderId: order.id } });
  assertCase(caseId, label, "EventOrganizerCommission", ORG_AMOUNT, Number(eOrg?.organizerCommissionAmount ?? -1));
}

async function runCase3(schoolCtx: Awaited<ReturnType<typeof createSchoolAlbumPack>>) {
  const caseId = "3";
  const label = "Venta escolar POST_EVENT";
  const { order, marketplaceFeeCents } = await createPostEventSchoolOrder(
    schoolCtx.album.id,
    schoolCtx.photo.id
  );

  const platformPercent = await resolveClientMarketplaceFeePercent({
    photographerId: schoolCtx.album.userId,
    labId: null,
  });
  const mpFee = await buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer({
    orderId: order.id,
    albumId: schoolCtx.album.id,
    eventId: null,
    totalPaidPesos: CLIENT_ARS,
    platformPercent,
    marketplaceFeePlatformOnlyPesos: marketplaceFeeCents,
  });

  assertCase(caseId, label, "cliente", CLIENT_ARS, order.totalCents);
  assertCase(caseId, label, "marketplace_fee MP", FEE_GROSS, mpFee);
  assertCase(caseId, label, "fotógrafo MP", 10_000, CLIENT_ARS - mpFee);

  await markOrderPaidAndRunSnapshots(order.id, FEE_GROSS);
  const sch = await prisma.organizerCommission.findUnique({ where: { orderId: order.id } });
  assertCase(caseId, label, "OrganizerCommission escolar", SCHOOL_AMOUNT, sch?.amount ?? -1);
  assertCase(caseId, label, "sin EventOrganizerCommission", false, !!(await prisma.eventOrganizerCommission.findUnique({ where: { orderId: order.id } })));
}

async function runCase4(schoolCtx: Awaited<ReturnType<typeof createSchoolAlbumPack>>) {
  const caseId = "4";
  const label = "AlbumPack escolar POST_EVENT";
  const { order, marketplaceFeeCents, totalCents } = await createAlbumPackOrder({
    albumId: schoolCtx.album.id,
    photoId: schoolCtx.photo.id,
    packId: schoolCtx.pack.id,
    packName: schoolCtx.pack.name,
  });

  const split = await computeAlbumPackMpSplit({
    orderId: order.id,
    albumId: schoolCtx.album.id,
    eventId: null,
    photographerId: schoolCtx.album.userId,
    totalCents,
    marketplaceFeeGross: marketplaceFeeCents,
    applyReferralDiscount: false,
  });

  assertCase(caseId, label, "cliente", CLIENT_ARS, totalCents);
  assertCase(caseId, label, "marketplace_fee MP", FEE_GROSS, split.marketplaceFeeMp);
  assertCase(caseId, label, "fotógrafo MP", 10_000, split.photographerNetMp);

  await markOrderPaidAndRunSnapshots(order.id, FEE_GROSS);
  const sch = await prisma.organizerCommission.findUnique({ where: { orderId: order.id } });
  assertCase(caseId, label, "OrganizerCommission escolar", SCHOOL_AMOUNT, sch?.amount ?? -1);
}

async function runCase5(
  ctx: Awaited<ReturnType<typeof createEventAlbumPack>>,
  organizerId: number,
  photographerId: number
) {
  const caseId = "5";
  const label = "Referidor = organizador evento";
  await upsertAttribution(organizerId, photographerId);

  const { order, marketplaceFeeCents, totalCents } = await createAlbumPackOrder({
    albumId: ctx.album.id,
    photoId: ctx.photo.id,
    packId: ctx.pack.id,
    packName: ctx.pack.name,
    isTest: false,
  });

  const split = await computeAlbumPackMpSplit({
    orderId: order.id,
    albumId: ctx.album.id,
    eventId: ctx.event.id,
    photographerId,
    totalCents,
    marketplaceFeeGross: marketplaceFeeCents,
    applyReferralDiscount: false,
  });

  assertCase(caseId, label, "marketplace_fee MP", 2500, split.marketplaceFeeMp);
  assertCase(caseId, label, "fotógrafo MP", 9000, split.photographerNetMp);

  await markOrderPaidAndRunSnapshots(order.id, FEE_GROSS);

  const eOrg = await prisma.eventOrganizerCommission.findUnique({ where: { orderId: order.id } });
  assertCase(caseId, label, "EventOrganizerCommission", true, !!eOrg);

  const ref = await simulateReferralEarningForOrder({
    orderId: order.id,
    photographerId,
    albumEventId: ctx.event.id,
    platformFeeCents: FEE_GROSS,
    referralFeeDiscountCents: 0,
  });

  assertCase(caseId, label, "ReferralEarning omitido", true, ref.skipped);
  assertCase(caseId, label, "ReferralEarning creado", false, ref.created);

  const earningRow = await prisma.referralEarning.findFirst({
    where: { saleRef: `ALBUM_ORDER:${order.id}` },
  });
  assertCase(caseId, label, "sin fila ReferralEarning", false, !!earningRow);
}

async function runCase6(
  ctx: Awaited<ReturnType<typeof createEventAlbumPack>>,
  referrerId: number,
  photographerId: number
) {
  const caseId = "6";
  const label = "Referidor distinto del organizador";
  await upsertAttribution(referrerId, photographerId);

  const { order, marketplaceFeeCents, totalCents } = await createAlbumPackOrder({
    albumId: ctx.album.id,
    photoId: ctx.photo.id,
    packId: ctx.pack.id,
    packName: ctx.pack.name,
    isTest: false,
  });

  const split = await computeAlbumPackMpSplit({
    orderId: order.id,
    albumId: ctx.album.id,
    eventId: ctx.event.id,
    photographerId,
    totalCents,
    marketplaceFeeGross: marketplaceFeeCents,
    applyReferralDiscount: false,
  });

  assertCase(caseId, label, "marketplace_fee MP", 2500, split.marketplaceFeeMp);
  assertCase(caseId, label, "fotógrafo MP", 9000, split.photographerNetMp);

  await markOrderPaidAndRunSnapshots(order.id, FEE_GROSS);

  const ref = await simulateReferralEarningForOrder({
    orderId: order.id,
    photographerId,
    albumEventId: ctx.event.id,
    platformFeeCents: FEE_GROSS,
    referralFeeDiscountCents: 0,
  });

  assertCase(caseId, label, "ReferralEarning creado", true, ref.created);
  assertCase(caseId, label, "ReferralEarning monto", REFERRAL_EARNING, ref.amounts?.referralAmountCents ?? -1);
  assertCase(caseId, label, "plataforma neta", PLATFORM_NET, ref.amounts?.platformNetCents ?? -1);

  const eOrg = await prisma.eventOrganizerCommission.findUnique({ where: { orderId: order.id } });
  assertCase(caseId, label, "EventOrganizerCommission", ORG_AMOUNT, Number(eOrg?.organizerCommissionAmount ?? -1));

  const platNegative =
    (ref.amounts?.platformNetCents ?? 0) < 0 ||
    split.feePlatformOnly - (ref.amounts?.referralAmountCents ?? 0) < 0;
  assertCase(caseId, label, "sin saldo negativo plataforma", false, platNegative);
}

async function cleanupFinancialQaData() {
  console.log("\n[cleanup] Resumen de entidades a borrar:");
  console.log(JSON.stringify(created, null, 2));

  const orderIds = [...created.orderIds];

  if (orderIds.length > 0) {
    await prisma.eventOrganizerCommission.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.organizerCommission.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.referralEarning.deleteMany({
      where: {
        OR: [
          { id: { in: created.referralEarningIds } },
          { saleRef: { startsWith: PREFIX } },
          { paymentId: { startsWith: PREFIX } },
        ],
      },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  if (created.draftIds.length) {
    await prisma.albumPackOrderDraft.deleteMany({ where: { id: { in: created.draftIds } } });
  }
  if (created.sessionIds.length) {
    await prisma.albumPackSelectionPhoto.deleteMany({ where: { sessionId: { in: created.sessionIds } } });
    await prisma.albumPackSelectionSession.deleteMany({ where: { id: { in: created.sessionIds } } });
  }
  if (created.albumPackIds.length) {
    await prisma.albumPack.deleteMany({ where: { id: { in: created.albumPackIds } } });
  }
  if (created.photoIds.length) {
    await prisma.photo.deleteMany({ where: { id: { in: created.photoIds } } });
  }
  if (created.albumIds.length) {
    await prisma.album.deleteMany({ where: { id: { in: created.albumIds } } });
  }
  if (created.eventIds.length) {
    await prisma.eventMember.deleteMany({ where: { eventId: { in: created.eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: created.eventIds } } });
  }
  if (created.schoolIds.length) {
    await prisma.schoolOrganizer.deleteMany({ where: { schoolId: { in: created.schoolIds } } });
    await prisma.school.deleteMany({ where: { id: { in: created.schoolIds } } });
  }
  if (created.attributionIds.length) {
    await prisma.referralAttribution.deleteMany({ where: { id: { in: created.attributionIds } } });
  }
  // Atribuciones extra por referredUserId de usuarios QA
  if (created.userIds.length) {
    await prisma.referralAttribution.deleteMany({
      where: {
        OR: [
          { referrerUserId: { in: created.userIds } },
          { referredUserId: { in: created.userIds } },
        ],
      },
    });
  }
  if (created.referralCodeIds.length) {
    await prisma.referralCode.deleteMany({ where: { id: { in: created.referralCodeIds } } });
  }
  if (created.userIds.length) {
    await prisma.referralCode.deleteMany({ where: { ownerUserId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }

  const remainingUsers = await prisma.user.count({
    where: { email: { startsWith: PREFIX } },
  });
  const remainingEvents = await prisma.event.count({
    where: { title: { startsWith: PREFIX } },
  });
  const remainingOrders = await prisma.order.count({
    where: { buyerEmail: { startsWith: PREFIX } },
  });

  console.log("[cleanup] Verificación post-borrado:");
  console.log(`  users FINANCIAL_QA_*: ${remainingUsers}`);
  console.log(`  events FINANCIAL_QA_*: ${remainingEvents}`);
  console.log(`  orders buyer FINANCIAL_QA_*: ${remainingOrders}`);

  if (remainingUsers > 0 || remainingEvents > 0 || remainingOrders > 0) {
    throw new Error("[cleanup] Quedaron registros FINANCIAL_QA_ — revisar manualmente.");
  }
  console.log("[cleanup] OK — sin registros FINANCIAL_QA_ residuales.");
}

function printResultsTable() {
  const cases = [...new Set(results.map((r) => r.caseId))];
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" TABLA DE RESULTADOS");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(
    `${"Caso".padEnd(6)} | ${"Campo".padEnd(28)} | ${"Esperado".padEnd(12)} | ${"Obtenido".padEnd(12)} | Estado`
  );
  console.log("-".repeat(80));
  for (const c of cases) {
    const rows = results.filter((r) => r.caseId === c);
    for (const r of rows) {
      console.log(
        `${r.caseId.padEnd(6)} | ${r.field.padEnd(28)} | ${String(r.expected).padEnd(12)} | ${String(r.actual).padEnd(12)} | ${r.ok ? "PASS" : "FAIL"}`
      );
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  const passed = results.filter((r) => r.ok).length;
  console.log("-".repeat(80));
  console.log(`Total: ${passed} PASS, ${failed} FAIL de ${results.length} assertions`);
  return failed;
}

async function main() {
  assertProductionSafe();
  console.log(`[qa-financial] RUN_ID=${RUN_ID} — sin pagos MP reales\n`);

  try {
    const organizer = await createUser(EMAILS.organizer, Role.ORGANIZER, `${PREFIX}ORGANIZER`);
    const photographer = await createUser(EMAILS.photographer, Role.PHOTOGRAPHER, `${PREFIX}PHOTOGRAPHER`);
    const referrer = await createUser(EMAILS.referrer, Role.PHOTOGRAPHER, `${PREFIX}REFERRER`);
    const schoolAdmin = await createUser(EMAILS.schoolAdmin, Role.CUSTOMER, `${PREFIX}SCHOOL_ADMIN`);

    const eventCtx = await createEventAlbumPack(organizer.id, photographer.id);
    const schoolCtx = await createSchoolAlbumPack(photographer.id, schoolAdmin.id);

    await runCase1(eventCtx);
    await runCase2(eventCtx, photographer.id);
    await runCase3(schoolCtx);
    await runCase4(schoolCtx);
    await runCase5(eventCtx, organizer.id, photographer.id);
    await runCase6(eventCtx, referrer.id, photographer.id);

    const failed = printResultsTable();
    if (failed > 0) {
      process.exitCode = 1;
    } else {
      console.log("\n✓ Todos los casos PASS");
    }
  } finally {
    await cleanupFinancialQaData();
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("[qa-financial] Error fatal:", err);
  try {
    await cleanupFinancialQaData();
  } catch (cleanupErr) {
    console.error("[cleanup] Error en finally:", cleanupErr);
  }
  await prisma.$disconnect();
  process.exit(1);
});
