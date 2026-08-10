/**
 * ETAPA 17B — Readiness Instagram pre-voto público.
 */
import { prisma } from "@repo/db";
import { INSTAGRAM_PROVIDER_CAPABILITIES } from "./capabilities";
import { permissionsMatrix } from "./social-connection";
import { scrubSecrets } from "./token-vault";

export type InstagramReadinessReason =
  | "NO_SOCIAL_CONNECTION"
  | "CONNECTION_UNHEALTHY"
  | "MISSING_PUBLISH_PERMISSION"
  | "MISSING_METRICS_PERMISSION"
  | "PUBLICATIONS_NOT_PREPARED"
  | "CUTOFF_INCOMPATIBLE"
  | "CAROUSEL_NOT_ALLOWED_AS_UNIT"
  | "PAID_PROMOTION_POLICY";

export async function evaluateInstagramPrePublicReadiness(input: {
  contestId: string;
  organizationId: string;
  socialConnectionId?: string | null;
}) {
  const reasons: Array<{ code: InstagramReadinessReason; message: string }> = [];
  const config = await prisma.fotorankCompetitionJuryConfig.findUnique({
    where: { contestId: input.contestId },
  });
  if (!config || config.publicVoteProvider !== "INSTAGRAM") {
    return { status: "SKIP" as const, reasons, capabilities: INSTAGRAM_PROVIDER_CAPABILITIES };
  }

  if (config.publicVoteCutoffPolicy === "EXACT_PROVIDER_TIMESTAMP") {
    reasons.push({
      code: "CUTOFF_INCOMPATIBLE",
      message: "Instagram no soporta EXACT_PROVIDER_TIMESTAMP.",
    });
  }

  const conn = input.socialConnectionId
    ? await prisma.fotorankSocialConnection.findFirst({
        where: {
          id: input.socialConnectionId,
          organizationId: input.organizationId,
          connectionStatus: { not: "DISCONNECTED" },
        },
      })
    : await prisma.fotorankSocialConnection.findFirst({
        where: {
          organizationId: input.organizationId,
          provider: "INSTAGRAM",
          connectionStatus: { not: "DISCONNECTED" },
        },
        orderBy: { connectedAt: "desc" },
      });

  if (!conn) {
    reasons.push({ code: "NO_SOCIAL_CONNECTION", message: "Sin cuenta Instagram conectada." });
  } else {
    if (!["CONNECTED", "DEGRADED"].includes(conn.health)) {
      reasons.push({ code: "CONNECTION_UNHEALTHY", message: `Health=${conn.health}` });
    }
    const perms = permissionsMatrix(conn.permissionsJson);
    if (!perms.publish) {
      reasons.push({ code: "MISSING_PUBLISH_PERMISSION", message: "Falta permiso publicar." });
    }
    if (!perms.readMetrics) {
      reasons.push({ code: "MISSING_METRICS_PERMISSION", message: "Falta permiso métricas." });
    }
  }

  const rounds = await prisma.fotorankPublicVoteRound.findMany({
    where: { contestId: input.contestId, provider: "INSTAGRAM" },
    include: { publications: true },
  });
  if (rounds.length > 0) {
    const unprepared = rounds.some((r) =>
      r.publications.length === 0 ||
      r.publications.some(
        (p) => !["PREPARED", "APPROVED_FOR_PUBLICATION", "PUBLISHED"].includes(p.publicationStatus),
      ),
    );
    if (unprepared) {
      reasons.push({
        code: "PUBLICATIONS_NOT_PREPARED",
        message: "Hay publicaciones sin preparar.",
      });
    }
  }

  return {
    status: reasons.length === 0 ? ("READY" as const) : ("BLOCKED" as const),
    reasons,
    capabilities: INSTAGRAM_PROVIDER_CAPABILITIES,
    connectionId: conn?.id ?? null,
  };
}

export async function getSocialConnectionDiagnostics(connectionId: string) {
  const conn = await prisma.fotorankSocialConnection.findUnique({
    where: { id: connectionId },
  });
  if (!conn) return null;
  return scrubSecrets({
    id: conn.id,
    organizationId: conn.organizationId,
    provider: conn.provider,
    accountId: conn.accountId,
    accountUsername: conn.accountUsername,
    accountType: conn.accountType,
    connectionStatus: conn.connectionStatus,
    health: conn.health,
    permissions: permissionsMatrix(conn.permissionsJson),
    tokenReferencePrefix: conn.tokenReference.slice(0, 12) + "…",
    tokenExpiresAt: conn.tokenExpiresAt,
    lastValidatedAt: conn.lastValidatedAt,
    rateLimitState: conn.rateLimitStateJson,
  });
}
