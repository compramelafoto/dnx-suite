/**
 * Limpieza de datos de prueba EMAIL_QA_* (scripts de QA de emails digitales).
 */

import type { PrismaClient } from "@prisma/client";

export const EMAIL_QA_PREFIX = "EMAIL_QA_";

export type EmailQaCreatedState = {
  userIds: number[];
  albumIds: number[];
  photoIds: number[];
  orderIds: number[];
  zipJobIds: string[];
  emailQueueIds: number[];
};

export type EmailQaCleanupScope = "session" | "all";

async function discoverAllEmailQaIds(prisma: PrismaClient): Promise<EmailQaCreatedState> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { buyerName: { startsWith: EMAIL_QA_PREFIX } },
        { mpPaymentId: { startsWith: EMAIL_QA_PREFIX } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  const zipJobs = await prisma.zipGenerationJob.findMany({
    where: {
      OR: [
        ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
        { r2Key: { startsWith: EMAIL_QA_PREFIX } },
      ],
    },
    select: { id: true },
  });

  const users = await prisma.user.findMany({
    where: { email: { startsWith: EMAIL_QA_PREFIX } },
    select: { id: true },
  });

  const albums = await prisma.album.findMany({
    where: {
      OR: [
        { title: { startsWith: EMAIL_QA_PREFIX } },
        { publicSlug: { startsWith: EMAIL_QA_PREFIX.toLowerCase() } },
      ],
    },
    select: { id: true },
  });

  const photos = await prisma.photo.findMany({
    where: { originalKey: { startsWith: EMAIL_QA_PREFIX } },
    select: { id: true },
  });

  const emailQueueRows =
    orderIds.length || zipJobs.length
      ? await prisma.emailQueue.findMany({
          where: {
            OR: [
              ...orderIds.map((id) => ({
                idempotencyKey: `order_confirmed_album_${id}`,
              })),
              ...zipJobs.map((z) => ({
                idempotencyKey: `zip-job-${z.id}-digital-download`,
              })),
            ],
          },
          select: { id: true },
        })
      : [];

  return {
    userIds: users.map((u) => u.id),
    albumIds: albums.map((a) => a.id),
    photoIds: photos.map((p) => p.id),
    orderIds,
    zipJobIds: zipJobs.map((z) => z.id),
    emailQueueIds: emailQueueRows.map((e) => e.id),
  };
}

function mergeCreatedState(
  session: EmailQaCreatedState,
  discovered: EmailQaCreatedState
): EmailQaCreatedState {
  return {
    userIds: [...new Set([...session.userIds, ...discovered.userIds])],
    albumIds: [...new Set([...session.albumIds, ...discovered.albumIds])],
    photoIds: [...new Set([...session.photoIds, ...discovered.photoIds])],
    orderIds: [...new Set([...session.orderIds, ...discovered.orderIds])],
    zipJobIds: [...new Set([...session.zipJobIds, ...discovered.zipJobIds])],
    emailQueueIds: [...new Set([...session.emailQueueIds, ...discovered.emailQueueIds])],
  };
}

/**
 * Borra pedidos, tokens, zip jobs, fotos mock y datos relacionados EMAIL_QA_*.
 *
 * @param scope `session` — solo IDs creados en la corrida actual; `all` — todo EMAIL_QA_* en BD.
 */
export async function cleanupEmailQaData(
  prisma: PrismaClient,
  options: {
    scope?: EmailQaCleanupScope;
    created?: EmailQaCreatedState;
    /** Si true, no lanza error si quedan residuos (útil en finally tras fallo parcial). */
    softFail?: boolean;
  } = {}
): Promise<EmailQaCreatedState> {
  const scope = options.scope ?? (options.created ? "session" : "all");
  const empty: EmailQaCreatedState = {
    userIds: [],
    albumIds: [],
    photoIds: [],
    orderIds: [],
    zipJobIds: [],
    emailQueueIds: [],
  };

  let target = options.created ?? empty;
  if (scope === "all") {
    const discovered = await discoverAllEmailQaIds(prisma);
    target = mergeCreatedState(target, discovered);
  }

  console.log("\n[cleanup] Borrando datos EMAIL_QA_...");
  console.log(JSON.stringify(target, null, 2));

  const { orderIds, zipJobIds } = target;

  if (orderIds.length || zipJobIds.length || target.emailQueueIds.length) {
    await prisma.emailQueue.deleteMany({
      where: {
        OR: [
          ...(target.emailQueueIds.length ? [{ id: { in: target.emailQueueIds } }] : []),
          ...orderIds.map((id) => ({
            idempotencyKey: `order_confirmed_album_${id}`,
          })),
          ...zipJobIds.map((jobId) => ({
            idempotencyKey: `zip-job-${jobId}-digital-download`,
          })),
        ],
      },
    });

    await prisma.zipGenerationJob.deleteMany({
      where: {
        OR: [
          ...(zipJobIds.length ? [{ id: { in: zipJobIds } }] : []),
          ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
          { r2Key: { startsWith: EMAIL_QA_PREFIX } },
        ],
      },
    });

    if (orderIds.length) {
      await prisma.orderDownloadToken.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
  }

  if (target.photoIds.length) {
    await prisma.photo.deleteMany({ where: { id: { in: target.photoIds } } });
  }
  if (target.albumIds.length) {
    await prisma.album.deleteMany({ where: { id: { in: target.albumIds } } });
  }
  if (target.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: target.userIds } } });
  }

  const remainingUsers = await prisma.user.count({
    where: { email: { startsWith: EMAIL_QA_PREFIX } },
  });
  const remainingOrders = await prisma.order.count({
    where: {
      OR: [
        { buyerName: { startsWith: EMAIL_QA_PREFIX } },
        { mpPaymentId: { startsWith: EMAIL_QA_PREFIX } },
      ],
    },
  });
  const remainingPhotos = await prisma.photo.count({
    where: { originalKey: { startsWith: EMAIL_QA_PREFIX } },
  });

  console.log("[cleanup] Verificación:");
  console.log(`  users ${EMAIL_QA_PREFIX}*: ${remainingUsers}`);
  console.log(`  orders ${EMAIL_QA_PREFIX}*: ${remainingOrders}`);
  console.log(`  photos ${EMAIL_QA_PREFIX}*: ${remainingPhotos}`);

  if (!options.softFail && (remainingUsers > 0 || remainingOrders > 0 || remainingPhotos > 0)) {
    throw new Error("[cleanup] Quedaron registros EMAIL_QA_ residuales.");
  }
  console.log("[cleanup] OK.");

  return target;
}
