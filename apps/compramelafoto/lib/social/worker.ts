import {
  createInstagramPublishProvider,
  decryptSecret,
  fetchPublishingLimit,
  hasQuotaFor,
  nextRetryAt,
  tryLoadSocialMasterKeyFromEnv,
  type PublishAsset,
  type PublishFormat,
} from "@repo/social-publisher";
import { Prisma, prisma } from "@repo/db";
import { ALBUM_STORY_ENTITY_TYPE, isAlbumStillPublishable } from "./album-stories";
import { ALBUM_SOCIAL_CONSENT_ENTITY_TYPE, createClfSocialStore, logSocialRequest, toSocialAccount } from "./prisma-store";

const store = createClfSocialStore();

type DueStatus = "APPROVED" | "SCHEDULED" | "FAILED";
const dueStatuses: DueStatus[] = ["APPROVED", "SCHEDULED", "FAILED"];

/**
 * Mismo filtro de estado que Clickatón, más la exclusión explícita del `entityType` de
 * los borradores de permiso (Task 9). Están en DRAFT, así que el filtro de estado ya los
 * deja afuera, pero un cambio futuro de estado no debería alcanzar a publicarlos.
 */
const dueWhere = (now: Date): Prisma.DnxSocialPublishRequestWhereInput => ({
  application: "COMPRAMELAFOTO",
  entityType: { not: ALBUM_SOCIAL_CONSENT_ENTITY_TYPE },
  status: { in: dueStatuses },
  OR: [
    { status: { in: ["APPROVED", "SCHEDULED"] }, scheduleAt: null },
    { status: { in: ["APPROVED", "SCHEDULED"] }, scheduleAt: { lte: now } },
    { status: "FAILED", nextRetryAt: { lte: now } },
  ],
});

function readAssets(value: Prisma.JsonValue): PublishAsset[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is PublishAsset =>
          item !== null && typeof item === "object" && "assetId" in item && "kind" in item,
      )
    : [];
}

export type SocialPublishWorkerSummary =
  | { processed: number }
  | { processed: 0; deferred: number; reason: "QUOTA" };

/** Punto de entrada del cron: procesa la tanda pendiente respetando el cupo diario. */
export async function runSocialPublishWorker(limit = 50): Promise<SocialPublishWorkerSummary> {
  return processDueSocialPublishes(limit);
}

export async function processDueSocialPublishes(limit = 25): Promise<SocialPublishWorkerSummary> {
  const now = new Date();
  const where = dueWhere(now);

  const pendientes = await prisma.dnxSocialPublishRequest.count({ where });
  if (pendientes === 0) return { processed: 0 };

  // El cupo solo se consulta cuando hay algo para publicar: es una llamada a Meta y no
  // tiene sentido gastarla en los ciclos en que la cola está vacía.
  const limite = await consultarCupo();
  if (limite !== null && !hasQuotaFor(limite, pendientes)) {
    // Quedarse sin cupo no es un error: es esperar. No se gasta ningún intento ni se
    // marca nada como fallido, porque esto se resuelve solo en unas horas.
    console.warn(
      `[social] cupo de Instagram casi agotado (${limite.used}/${limite.total}); ` +
        `se difieren ${pendientes} publicaciones`,
    );
    return { processed: 0, deferred: pendientes, reason: "QUOTA" };
  }

  const requests = await prisma.dnxSocialPublishRequest.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const request of requests) await processSocialPublishRequest(request.id);
  return { processed: requests.length };
}

/**
 * Devuelve el cupo actual de la cuenta de CLF, o `null` si no se puede consultar (cuenta
 * no resuelta, sin token, o Meta no contesta). `null` significa "publicar igual": no
 * saber el cupo no es razón para frenar, el límite real lo aplica Meta de todas formas.
 */
async function consultarCupo() {
  const cuenta = await store.resolveAccount();
  if (!cuenta?.tokenCiphertext || !cuenta.tokenNonce || !cuenta.tokenAuthTag) return null;
  const masterKey = tryLoadSocialMasterKeyFromEnv();
  if (!masterKey) return null;
  try {
    const accessToken = decryptSecret(
      { ciphertext: cuenta.tokenCiphertext, nonce: cuenta.tokenNonce, authTag: cuenta.tokenAuthTag },
      masterKey,
    );
    return await fetchPublishingLimit(cuenta.externalAccountId, accessToken);
  } catch {
    return null;
  }
}

export async function processSocialPublishRequest(requestId: string) {
  const request = await prisma.dnxSocialPublishRequest.findUnique({
    where: { id: requestId },
    include: { socialAccount: true },
  });
  if (!request || !dueStatuses.includes(request.status as DueStatus)) return { status: "SKIPPED" as const };
  // Cinturón y tiradores: los borradores de permiso nunca deberían llegar acá (ver dueWhere).
  if (request.entityType === ALBUM_SOCIAL_CONSENT_ENTITY_TYPE) return { status: "SKIPPED" as const };

  if (request.entityType === ALBUM_STORY_ENTITY_TYPE && !(await isAlbumStillPublishable(Number(request.entityId)))) {
    await prisma.dnxSocialPublishRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", rejectionReason: "El álbum dejó de ser público o se desactivó la difusión" },
    });
    await logSocialRequest(request.id, "CANCELLED", null, { reason: "ALBUM_NOT_PUBLISHABLE" });
    return { status: "SKIPPED" as const };
  }

  const assets = readAssets(request.assets);
  if (!assets.some((asset) => asset.publicUrl)) {
    return fail(request, "ASSETS_NOT_READY", "Assets sin publicUrl", true);
  }

  // El token existe solo en el scope de esta función y nunca se loguea ni persiste.
  const masterKey = tryLoadSocialMasterKeyFromEnv();
  if (
    !masterKey ||
    !request.socialAccount.tokenCiphertext ||
    !request.socialAccount.tokenNonce ||
    !request.socialAccount.tokenAuthTag
  ) {
    return fail(request, "TOKEN_MISSING", "Credencial social no disponible", true);
  }

  const startedAt = new Date();
  const livePublish = process.env.DNX_SOCIAL_PUBLISHER_LIVE === "true";
  try {
    const accessToken = decryptSecret(
      {
        ciphertext: request.socialAccount.tokenCiphertext,
        nonce: request.socialAccount.tokenNonce,
        authTag: request.socialAccount.tokenAuthTag,
      },
      masterKey,
    );
    const provider = createInstagramPublishProvider();
    await prisma.dnxSocialPublishRequest.update({
      where: { id: request.id },
      data: { status: "PUBLISHING", attemptCount: { increment: 1 } },
    });
    // Formato, colaboradores y etiquetas viajan en metadata (sin cambios de schema). Sin
    // esto, una historia saldría como publicación en el feed.
    const meta = (request.metadata ?? {}) as {
      format?: PublishFormat;
      collaborators?: unknown;
      userTags?: unknown;
    };
    const result = await provider.publish({
      account: toSocialAccount(request.socialAccount),
      accessToken,
      caption: request.caption,
      assets,
      format: meta.format ?? "SINGLE_IMAGE",
      collaborators: Array.isArray(meta.collaborators) ? (meta.collaborators as string[]) : [],
      userTags: Array.isArray(meta.userTags) ? (meta.userTags as string[]) : [],
      dryRun: !livePublish,
    });
    if (!result.ok) throw new Error(result.errorMessage ?? result.errorCode ?? "PUBLISH_FAILED");

    const publishedAt = new Date();
    const updated = await prisma.dnxSocialPublishRequest.update({
      where: { id: request.id },
      data: {
        status: "PUBLISHED",
        publishedAt,
        externalMediaId: result.externalMediaId ?? null,
        externalPostId: result.externalPostId ?? null,
        permalink: result.permalink ?? null,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextRetryAt: null,
      },
    });
    await prisma.dnxSocialPublishAttempt.create({
      data: {
        publishRequestId: request.id,
        attemptNumber: updated.attemptCount,
        startedAt,
        finishedAt: publishedAt,
        ok: true,
        dryRun: !livePublish,
        durationMs: publishedAt.getTime() - startedAt.getTime(),
        providerRaw: (result.providerRawSanitized ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await logSocialRequest(request.id, "PUBLISHED", null, { dryRun: !livePublish });
    return { status: "PUBLISHED" as const, dryRun: !livePublish };
  } catch (error) {
    return fail(
      request,
      "PUBLISH_FAILED",
      error instanceof Error ? error.message : "Publicación fallida",
      true,
      startedAt,
      !livePublish,
    );
  }
}

async function fail(
  request: { id: string; attemptCount: number },
  code: string,
  message: string,
  retryable: boolean,
  startedAt = new Date(),
  dryRun = true,
) {
  const attemptNumber = request.attemptCount + 1;
  const finishedAt = new Date();
  await prisma.dnxSocialPublishRequest.update({
    where: { id: request.id },
    data: {
      status: "FAILED",
      lastErrorCode: code,
      lastErrorMessage: message.slice(0, 200),
      nextRetryAt: retryable ? nextRetryAt(attemptNumber) : null,
    },
  });
  await prisma.dnxSocialPublishAttempt.create({
    data: {
      publishRequestId: request.id,
      attemptNumber,
      startedAt,
      finishedAt,
      ok: false,
      dryRun,
      errorCode: code,
      errorMessage: message.slice(0, 200),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    },
  });
  await logSocialRequest(request.id, "FAILED", null, { code });
  return { status: "FAILED" as const, code };
}
