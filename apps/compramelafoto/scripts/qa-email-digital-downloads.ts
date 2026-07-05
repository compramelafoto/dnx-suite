/**
 * QA de emails de entrega digital (sin Mercado Pago).
 *
 * Uso (cleanup automático al finalizar):
 *   ALLOW_EMAIL_QA=1 npx tsx scripts/qa-email-digital-downloads.ts
 *
 * Mantener datos para probar links después:
 *   KEEP_EMAIL_QA_DATA=1 ALLOW_EMAIL_QA=1 npx tsx scripts/qa-email-digital-downloads.ts
 *
 * Limpiar datos persistentes luego:
 *   npx tsx scripts/cleanup-email-qa.ts
 *
 * Opcional (envía vía Resend si RESEND_API_KEY está configurada):
 *   ALLOW_EMAIL_QA=1 SEND_EMAIL_QA=1 npx tsx scripts/qa-email-digital-downloads.ts
 */

import {
  CheckoutPaymentSource,
  OrderItemLineOrigin,
  OrderItemType,
  OrderOrigin,
  OrderStatus,
  PrismaClient,
  Role,
} from "@prisma/client";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { queueOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { notifyClientDigitalZipReady } from "@/lib/zip-job-notifications";
import { getOrderDownloadTokens } from "@/lib/download-tokens";
import { markCompleted } from "@/lib/zip-job-queue";
import { processEmailQueue } from "@/lib/email-sender";
import {
  cleanupEmailQaData,
  EMAIL_QA_PREFIX,
  type EmailQaCreatedState,
} from "./email-qa-cleanup";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

const PREFIX = EMAIL_QA_PREFIX;
const RUN_ID = Date.now().toString(36);
const RECIPIENT = "dnxfotografia@gmail.com";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

const ZIP_PENDING_TEXT =
  "Estamos preparando tu archivo ZIP con todas las fotos. Te enviaremos un segundo email automáticamente cuando la descarga esté lista.";

function keepEmailQaData(): boolean {
  return (
    process.env.KEEP_EMAIL_QA_DATA === "1" || process.env.KEEP_EMAIL_QA_DATA === "true"
  );
}

const created: EmailQaCreatedState = {
  userIds: [] as number[],
  albumIds: [] as number[],
  photoIds: [] as number[],
  orderIds: [] as number[],
  zipJobIds: [] as string[],
  emailQueueIds: [] as number[],
};

type PersistedDownloadToken = {
  token: string;
  expiresAt: string;
  url: string;
};

type PersistedZipJob = {
  id: string;
  status: string;
  expiresAt: string | null;
  downloadUrl: string | null;
};

type PersistedCaseArtifacts = {
  caseId: string;
  orderId: number;
  downloadTokens: PersistedDownloadToken[];
  zipJobs: PersistedZipJob[];
};

const persistedArtifacts: PersistedCaseArtifacts[] = [];

type CheckResult = { caseId: string; label: string; ok: boolean; detail: string };
const checks: CheckResult[] = [];

function check(caseId: string, label: string, ok: boolean, detail: string) {
  checks.push({ caseId, label, ok, detail });
  console.log(ok ? `  ✓ [${caseId}] ${label}` : `  ✗ [${caseId}] ${label}: ${detail}`);
}

function assertEmailQaAllowed() {
  const allow =
    process.env.ALLOW_EMAIL_QA === "1" || process.env.ALLOW_EMAIL_QA === "true";
  if (process.env.NODE_ENV === "production" && !allow) {
    throw new Error(
      "Bloqueado en NODE_ENV=production. Set ALLOW_EMAIL_QA=1 para staging controlado."
    );
  }
  if (!allow) {
    console.warn("[email-qa] Tip: set ALLOW_EMAIL_QA=1 para confirmar ejecución.");
  }
}

function extractDownloadUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+\/api\/downloads\/[a-f0-9]+/gi) ?? [];
  return [...new Set(matches)];
}

async function fetchQueuedEmail(idempotencyKey: string) {
  return prisma.emailQueue.findUnique({ where: { idempotencyKey } });
}

async function recordPersistedArtifacts(
  caseId: string,
  orderId: number,
  clientTokenValue?: string | null
) {
  const tokens = await getOrderDownloadTokens(orderId);
  const downloadTokens: PersistedDownloadToken[] = tokens
    .filter((t) => t.type === "CLIENT_DIGITAL")
    .map((t) => ({
      token: t.token,
      expiresAt: t.expiresAt.toISOString(),
      url: `${APP_URL}/api/downloads/${t.token}`,
    }));

  const zipJobRows = await prisma.zipGenerationJob.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  const orderLevelToken =
    clientTokenValue ??
    tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId)?.token ??
    null;

  const zipJobs: PersistedZipJob[] = zipJobRows.map((z) => ({
    id: z.id,
    status: z.status,
    expiresAt: z.expiresAt?.toISOString() ?? null,
    downloadUrl: orderLevelToken
      ? `${APP_URL}/api/downloads/${orderLevelToken}`
      : null,
  }));

  persistedArtifacts.push({ caseId, orderId, downloadTokens, zipJobs });
}

function printPersistedArtifacts() {
  console.log("\n══════════════════════════════════════════════════");
  console.log(" DATOS PERSISTENTES (KEEP_EMAIL_QA_DATA=1)");
  console.log("══════════════════════════════════════════════════");
  console.log(`RUN_ID=${RUN_ID}`);
  console.log(`Destinatario emails: ${RECIPIENT}`);
  console.log(`Limpiar luego: npx tsx scripts/cleanup-email-qa.ts`);
  console.log("");

  console.log("Entidades creadas:");
  console.log(JSON.stringify(created, null, 2));
  console.log("");

  for (const row of persistedArtifacts) {
    console.log(`── Caso ${row.caseId} ──`);
    console.log(`  orderId: ${row.orderId}`);

    if (row.downloadTokens.length === 0) {
      console.log("  download tokens: (ninguno)");
    } else {
      console.log("  download tokens:");
      for (const t of row.downloadTokens) {
        console.log(`    - token: ${t.token}`);
        console.log(`      expiresAt: ${t.expiresAt}`);
        console.log(`      url: ${t.url}`);
      }
    }

    if (row.zipJobs.length === 0) {
      console.log("  zip jobs: (ninguno)");
    } else {
      console.log("  zip jobs:");
      for (const z of row.zipJobs) {
        console.log(`    - id: ${z.id}`);
        console.log(`      status: ${z.status}`);
        console.log(`      expiresAt: ${z.expiresAt ?? "—"}`);
        if (z.downloadUrl) {
          console.log(`      downloadUrl: ${z.downloadUrl}`);
        }
      }
    }
    console.log("");
  }
}

async function cleanupEmailQaDataFromSession() {
  await cleanupEmailQaData(prisma, { scope: "session", created });
}

async function createPhotographer() {
  const passwordHash = await bcrypt.hash("QaTest123456!", 8);
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}PHOTOGRAPHER_${RUN_ID}@test.local`,
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: `${PREFIX}PHOTOGRAPHER`,
      city: "Buenos Aires",
      country: "Argentina",
    },
  });
  created.userIds.push(user.id);
  return user;
}

async function createAlbum(photographerId: number) {
  const album = await prisma.album.create({
    data: {
      userId: photographerId,
      title: `${PREFIX}ALBUM_${RUN_ID}`,
      publicSlug: `${PREFIX}album_${RUN_ID}`.toLowerCase(),
      city: "Buenos Aires",
      isTest: true,
      enableDigitalPhotos: true,
      expiresAt: new Date(Date.now() + 365 * 86400000),
    },
  });
  created.albumIds.push(album.id);
  return album;
}

async function createPhoto(albumId: number, userId: number, suffix: string) {
  const photo = await prisma.photo.create({
    data: {
      albumId,
      userId,
      previewUrl: "https://placehold.co/400x300/png?text=EMAIL_QA",
      originalKey: `${PREFIX}uploads/${RUN_ID}/${suffix}.jpg`,
      sellDigital: true,
      sellPrint: false,
    },
  });
  created.photoIds.push(photo.id);
  return photo;
}

async function createPaidOrder(params: {
  albumId: number;
  label: string;
  photoIds: number[];
  totalCents: number;
}) {
  const order = await prisma.order.create({
    data: {
      albumId: params.albumId,
      buyerEmail: RECIPIENT,
      buyerName: `${PREFIX}${params.label}`,
      totalCents: params.totalCents,
      status: OrderStatus.PAID,
      origin: OrderOrigin.STANDARD_CHECKOUT,
      checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
      isTest: true,
      mpPaymentId: `${PREFIX}sim_${RUN_ID}_${params.label}`,
      pricingSnapshot: {
        type: "EMAIL_QA_V1",
        label: params.label,
        runId: RUN_ID,
      },
      items: {
        create: params.photoIds.map((photoId) => ({
          photoId,
          productType: OrderItemType.DIGITAL,
          lineOrigin: OrderItemLineOrigin.STANDARD,
          quantity: 1,
          priceCents: Math.floor(params.totalCents / params.photoIds.length),
          subtotalCents: Math.floor(params.totalCents / params.photoIds.length),
        })),
      },
    },
  });
  created.orderIds.push(order.id);
  return order;
}

async function runCaseA(albumId: number, photographerId: number) {
  const caseId = "A";
  console.log("\n── CASO A: 1 foto digital ──");

  const photo = await createPhoto(albumId, photographerId, "single");
  const order = await createPaidOrder({
    albumId,
    label: "SINGLE",
    photoIds: [photo.id],
    totalCents: 1150,
  });

  await ensureDigitalDelivery(order.id);
  const tokens = await getOrderDownloadTokens(order.id);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
  const downloadUrl = clientToken
    ? `${APP_URL}/api/downloads/${clientToken.token}`
    : null;

  console.log(`  orderId=${order.id}`);
  console.log(`  token=${clientToken?.token ?? "—"}`);
  console.log(`  downloadUrl=${downloadUrl ?? "—"}`);
  if (clientToken?.expiresAt) {
    console.log(`  tokenExpiresAt=${clientToken.expiresAt.toISOString()}`);
  }

  await queueOrderConfirmationEmail(order.id);

  const email = await fetchQueuedEmail(`order_confirmed_album_${order.id}`);
  if (email) created.emailQueueIds.push(email.id);

  const body = `${email?.body ?? ""}\n${email?.htmlBody ?? ""}`;
  const urls = extractDownloadUrls(body);
  const hasPendingZip = body.includes(ZIP_PENDING_TEXT);

  check(caseId, "email confirmación encolado", Boolean(email), "no row in EmailQueue");
  check(caseId, "destinatario correcto", email?.to === RECIPIENT, `to=${email?.to}`);
  check(caseId, "incluye downloadUrl", urls.length > 0, `urls=${urls.length}`);
  check(
    caseId,
    "sin aviso ZIP pendiente",
    !hasPendingZip,
    "contiene texto de ZIP pendiente"
  );
  check(
    caseId,
    "token CLIENT_DIGITAL pedido",
    Boolean(clientToken),
    "sin token order-level"
  );

  if (downloadUrl && urls[0]) {
    check(
      caseId,
      "URL email coincide con token",
      urls.some((u) => u.includes(clientToken!.token)),
      urls.join(", ")
    );
  }

  console.log(`  emailQueueId=${email?.id ?? "—"} subject=${email?.subject ?? "—"}`);

  await recordPersistedArtifacts(caseId, order.id, clientToken?.token);

  return { orderId: order.id, downloadUrl, emailId: email?.id };
}

async function runCaseB(albumId: number, photographerId: number) {
  const caseId = "B";
  console.log("\n── CASO B: 2+ fotos digitales ──");

  const photo1 = await createPhoto(albumId, photographerId, "multi_1");
  const photo2 = await createPhoto(albumId, photographerId, "multi_2");
  const order = await createPaidOrder({
    albumId,
    label: "MULTI",
    photoIds: [photo1.id, photo2.id],
    totalCents: 2300,
  });

  await ensureDigitalDelivery(order.id);

  const tokens = await getOrderDownloadTokens(order.id);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);

  let zipJob = await prisma.zipGenerationJob.findFirst({
    where: { orderId: order.id, type: "ORDER_DOWNLOAD" },
    orderBy: { createdAt: "desc" },
  });

  if (!zipJob) {
    throw new Error("[B] No se creó ZipGenerationJob");
  }
  created.zipJobIds.push(zipJob.id);

  console.log(`  orderId=${order.id}`);
  console.log(`  token=${clientToken?.token ?? "—"}`);
  console.log(`  zipJobId=${zipJob.id} status=${zipJob.status}`);
  if (clientToken?.expiresAt) {
    console.log(`  tokenExpiresAt=${clientToken.expiresAt.toISOString()}`);
  }

  await queueOrderConfirmationEmail(order.id);

  const confirmEmail = await fetchQueuedEmail(`order_confirmed_album_${order.id}`);
  if (confirmEmail) created.emailQueueIds.push(confirmEmail.id);

  const confirmBody = `${confirmEmail?.body ?? ""}\n${confirmEmail?.htmlBody ?? ""}`;
  const confirmUrls = extractDownloadUrls(confirmBody);
  const hasPendingZip = confirmBody.includes(ZIP_PENDING_TEXT);

  check(caseId, "email confirmación encolado", Boolean(confirmEmail), "no row");
  check(
    caseId,
    "confirmación SIN downloadUrl",
    confirmUrls.length === 0,
    confirmUrls.join(", ") || "tiene link"
  );
  check(
    caseId,
    "confirmación CON aviso ZIP",
    hasPendingZip,
    "falta texto ZIP pendiente"
  );

  const mockR2Key = `${PREFIX}zip-jobs/${RUN_ID}/${zipJob.id}.zip`;
  zipJob = await markCompleted(zipJob.id, {
    r2Key: mockR2Key,
    zipUrl: `${APP_URL}/${mockR2Key}`,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });

  console.log(`  zipJob simulated COMPLETED r2Key=${mockR2Key}`);
  if (zipJob.expiresAt) {
    console.log(`  zipJobExpiresAt=${zipJob.expiresAt.toISOString()}`);
  }

  await notifyClientDigitalZipReady(zipJob);

  const zipEmail = await fetchQueuedEmail(`zip-job-${zipJob!.id}-digital-download`);
  if (zipEmail) created.emailQueueIds.push(zipEmail.id);

  const zipBody = `${zipEmail?.body ?? ""}\n${zipEmail?.htmlBody ?? ""}`;
  const zipUrls = extractDownloadUrls(zipBody);
  const zipDownloadUrl = clientToken
    ? `${APP_URL}/api/downloads/${clientToken.token}`
    : null;

  check(caseId, "email ZIP READY encolado", Boolean(zipEmail), "no row");
  check(caseId, "ZIP READY destinatario", zipEmail?.to === RECIPIENT, `to=${zipEmail?.to}`);
  check(caseId, "ZIP READY incluye link", zipUrls.length > 0, zipUrls.join(", ") || "sin url");
  check(
    caseId,
    "ZIP READY link agrupado (token pedido)",
    Boolean(clientToken && zipUrls.some((u) => u.includes(clientToken.token))),
    zipUrls.join(", ")
  );

  console.log(`  confirmEmailId=${confirmEmail?.id ?? "—"}`);
  console.log(`  zipReadyEmailId=${zipEmail?.id ?? "—"} subject=${zipEmail?.subject ?? "—"}`);
  console.log(`  zipDownloadUrl=${zipDownloadUrl ?? "—"}`);

  await recordPersistedArtifacts(caseId, order.id, clientToken?.token);

  return {
    orderId: order.id,
    zipJobId: zipJob!.id,
    zipDownloadUrl,
    confirmEmailId: confirmEmail?.id,
    zipEmailId: zipEmail?.id,
  };
}

async function flushEmailQueueIfRequested() {
  if (process.env.SEND_EMAIL_QA !== "1" && process.env.SEND_EMAIL_QA !== "true") {
    console.log("\n[email-qa] Emails encolados (no enviados). Para enviar: SEND_EMAIL_QA=1 + RESEND_API_KEY");
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email-qa] SEND_EMAIL_QA=1 pero falta RESEND_API_KEY — solo cola verificada.");
    return;
  }
  console.log("\n[email-qa] Enviando cola vía Resend...");
  const results = await processEmailQueue(10);
  let sent = 0;
  let failed = 0;
  for (const row of results) {
    if (!row.processed || !("status" in row)) continue;
    if (row.status === "sent") sent++;
    if (row.status === "failed") failed++;
  }
  console.log(`  sent=${sent} failed=${failed} attempted=${results.length}`);
}

function printSummaryTable() {
  console.log("\n══════════════════════════════════════════════════");
  console.log(" RESUMEN QA EMAILS DIGITALES");
  console.log("══════════════════════════════════════════════════");
  console.log(`${"Caso".padEnd(6)} | ${"Check".padEnd(32)} | Estado`);
  console.log("-".repeat(55));
  for (const c of checks) {
    console.log(`${c.caseId.padEnd(6)} | ${c.label.padEnd(32)} | ${c.ok ? "PASS" : "FAIL"}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log("-".repeat(55));
  console.log(`Total: ${checks.length - failed} PASS, ${failed} FAIL`);
  console.log(`Destinatario: ${RECIPIENT}`);
}

async function main() {
  assertEmailQaAllowed();
  const keepData = keepEmailQaData();
  console.log(`[email-qa] RUN_ID=${RUN_ID} dest=${RECIPIENT} keepData=${keepData}\n`);

  try {
    const photographer = await createPhotographer();
    const album = await createAlbum(photographer.id);

    await runCaseA(album.id, photographer.id);
    await runCaseB(album.id, photographer.id);

    printSummaryTable();

    await flushEmailQueueIfRequested();

    if (keepData) {
      printPersistedArtifacts();
      console.log("\n[email-qa] KEEP_EMAIL_QA_DATA=1 — cleanup omitido. Links siguen activos en BD.");
    }

    const failed = checks.filter((c) => !c.ok).length;
    if (failed > 0) process.exitCode = 1;
  } finally {
    if (!keepEmailQaData()) {
      await cleanupEmailQaData(prisma, { scope: "session", created });
    }
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("[email-qa] Error fatal:", err);
  try {
    if (!keepEmailQaData()) {
      await cleanupEmailQaData(prisma, { scope: "session", created, softFail: true });
    } else {
      console.log("[email-qa] KEEP_EMAIL_QA_DATA=1 — datos conservados tras error.");
      printPersistedArtifacts();
    }
  } catch (cleanupErr) {
    console.error("[cleanup] Error:", cleanupErr);
  }
  await prisma.$disconnect();
  process.exit(1);
});

export { cleanupEmailQaData } from "./email-qa-cleanup";
export { cleanupEmailQaDataFromSession };
