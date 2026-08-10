/**
 * ETAPA 17B — InstagramPublicVoteProvider (mock HTTP; polling de like_count).
 */
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import type {
  NormalizedMetricObservation,
  ProviderHealth,
  PublicVoteProviderAdapter,
} from "../types";
import { INSTAGRAM_PROVIDER_CAPABILITIES } from "./capabilities";
import { mockGetMediaLikeCount } from "./mock-http";
import { isBackoffActive } from "./rate-limit";
import { openToken, scrubSecrets } from "./token-vault";

export type InstagramProviderErrorCode =
  | "RATE_LIMITED"
  | "TOKEN_EXPIRED"
  | "PUBLICATION_DELETED"
  | "LIKE_COUNT_HIDDEN";

export class InstagramProviderError extends Error {
  readonly code: InstagramProviderErrorCode;
  constructor(code: InstagramProviderErrorCode, message: string) {
    super(message);
    this.name = "InstagramProviderError";
    this.code = code;
  }
}

function mapHealth(connHealth: string, rateLimited: boolean): ProviderHealth {
  if (rateLimited) return "DEGRADED";
  if (connHealth === "ERROR" || connHealth === "EXPIRED") return "ERROR";
  if (connHealth === "STALE" || connHealth === "DEGRADED") return connHealth as ProviderHealth;
  return "CONNECTED";
}

export function createInstagramPublicVoteProvider(): PublicVoteProviderAdapter {
  return {
    name: "INSTAGRAM",
    async health() {
      return "CONNECTED";
    },
  };
}

export async function fetchLikeObservations(input: {
  roundId: string;
  publicCodes: string[];
  asOf: Date;
  forceEventKey?: string;
}): Promise<NormalizedMetricObservation[]> {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.roundId },
    include: {
      candidates: { where: { active: true } },
      publications: true,
      socialConnection: true,
    },
  });
  if (!round?.socialConnection) {
    throw new InstagramProviderError("TOKEN_EXPIRED", "Sin conexión social.");
  }

  const conn = round.socialConnection;
  if (isBackoffActive(conn.rateLimitStateJson as { backoffUntil?: string } | null)) {
    throw new InstagramProviderError("RATE_LIMITED", "Meta rate limit backoff activo.");
  }
  if (conn.health === "EXPIRED" || conn.tokenReference.includes("expired")) {
    throw new InstagramProviderError("TOKEN_EXPIRED", "Token expirado.");
  }

  const token = openToken(conn.tokenReference);
  if (!token) {
    throw new InstagramProviderError("TOKEN_EXPIRED", "Token inválido.");
  }

  const codeSet = new Set(input.publicCodes);
  const candidates = round.candidates.filter((c) => codeSet.has(c.publicCode));
  const observations: NormalizedMetricObservation[] = [];

  for (const cand of candidates) {
    const pub = round.publications.find((p) => p.candidateId === cand.id);
    if (!pub?.externalMediaId) continue;

    const res = await mockGetMediaLikeCount({
      mediaId: pub.externalMediaId,
      tokenReference: conn.tokenReference,
    });

    if (res.error === "RATE_LIMITED") {
      throw new InstagramProviderError("RATE_LIMITED", "Rate limited.");
    }
    if (res.error === "TOKEN_EXPIRED") {
      throw new InstagramProviderError("TOKEN_EXPIRED", "Token expirado.");
    }
    if (res.error === "PUBLICATION_DELETED") {
      throw new InstagramProviderError("PUBLICATION_DELETED", "Publicación eliminada.");
    }
    if (res.error === "LIKE_COUNT_HIDDEN") {
      throw new InstagramProviderError("LIKE_COUNT_HIDDEN", "Likes ocultos.");
    }
    if (res.like_count == null) continue;

    const eventKey = input.forceEventKey
      ? `${input.forceEventKey}:${cand.publicCode}`
      : `ig:${pub.externalMediaId}:${res.like_count}:${input.asOf.toISOString()}`;

    observations.push({
      candidatePublicCode: cand.publicCode,
      metricValue: res.like_count,
      providerObservedAt: input.asOf,
      providerMetricTimestamp: null,
      providerEventKey: eventKey,
      rawHash: createHash("sha256")
        .update(JSON.stringify(scrubSecrets({ mediaId: pub.externalMediaId, like_count: res.like_count })))
        .digest("hex")
        .slice(0, 32),
      metadata: {
        provider: "INSTAGRAM",
        mediaId: pub.externalMediaId,
        metricField: INSTAGRAM_PROVIDER_CAPABILITIES.metricField,
      },
    });
  }

  return observations;
}

export async function getInstagramProviderHealthForRound(roundId: string): Promise<ProviderHealth> {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: roundId },
    include: { socialConnection: true },
  });
  if (!round?.socialConnection) return "ERROR";
  const rateLimited = isBackoffActive(
    round.socialConnection.rateLimitStateJson as { backoffUntil?: string } | null,
  );
  return mapHealth(round.socialConnection.health, rateLimited);
}
