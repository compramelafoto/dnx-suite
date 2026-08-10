/**
 * ETAPA 17B — SocialConnection CRUD + ownership por organización.
 */
import { prisma, Prisma } from "@repo/db";
import { PublicVoteError } from "../errors";
import { mockTokenReference } from "./token-vault";
import type { MetaRateLimitState } from "./rate-limit";

export type PermissionMatrix = {
  publish: boolean;
  readMetrics: boolean;
  insights: boolean;
  webhooks: boolean;
};

export function permissionsMatrix(json: unknown): PermissionMatrix {
  const p = (json ?? {}) as Record<string, boolean>;
  return {
    publish: Boolean(p.publish),
    readMetrics: Boolean(p.readMetrics),
    insights: Boolean(p.insights),
    webhooks: Boolean(p.webhooks),
  };
}

export async function upsertMockSocialConnection(input: {
  organizationId: string;
  accountId: string;
  accountUsername: string;
  accountType?: string;
  connectedByUserId?: number;
  permissions?: PermissionMatrix;
  health?: string;
  tokenReference?: string;
  tokenExpiresAt?: Date;
}) {
  const tokenReference = input.tokenReference ?? mockTokenReference(input.accountId);
  const permissionsJson = input.permissions ?? {
    publish: true,
    readMetrics: true,
    insights: true,
    webhooks: false,
  };
  return prisma.fotorankSocialConnection.upsert({
    where: {
      organizationId_provider_accountId: {
        organizationId: input.organizationId,
        provider: "INSTAGRAM",
        accountId: input.accountId,
      },
    },
    create: {
      organizationId: input.organizationId,
      provider: "INSTAGRAM",
      accountId: input.accountId,
      accountUsername: input.accountUsername,
      accountType: input.accountType ?? "BUSINESS",
      connectionStatus: "CONNECTED",
      permissionsJson: permissionsJson as Prisma.JsonObject,
      tokenReference,
      tokenExpiresAt: input.tokenExpiresAt ?? new Date(Date.now() + 60 * 24 * 60 * 60_000),
      connectedByUserId: input.connectedByUserId ?? null,
      lastValidatedAt: new Date(),
      health: input.health ?? "CONNECTED",
    },
    update: {
      accountUsername: input.accountUsername,
      connectionStatus: "CONNECTED",
      disconnectedAt: null,
      permissionsJson: permissionsJson as Prisma.JsonObject,
      tokenReference,
      tokenExpiresAt: input.tokenExpiresAt ?? new Date(Date.now() + 60 * 24 * 60 * 60_000),
      lastValidatedAt: new Date(),
      health: input.health ?? "CONNECTED",
    },
  });
}

export async function disconnectSocialConnection(input: {
  connectionId: string;
  organizationId: string;
}) {
  const conn = await prisma.fotorankSocialConnection.findFirst({
    where: { id: input.connectionId, organizationId: input.organizationId },
  });
  if (!conn) throw new PublicVoteError("FORBIDDEN", "Conexión no encontrada.", 404);
  return prisma.fotorankSocialConnection.update({
    where: { id: conn.id },
    data: {
      connectionStatus: "DISCONNECTED",
      disconnectedAt: new Date(),
      health: "DISCONNECTED",
    },
  });
}

export async function assertOrgOwnsConnection(input: {
  organizationId: string;
  socialConnectionId: string;
}) {
  const conn = await prisma.fotorankSocialConnection.findFirst({
    where: {
      id: input.socialConnectionId,
      organizationId: input.organizationId,
      connectionStatus: { not: "DISCONNECTED" },
    },
  });
  if (!conn) {
    throw new PublicVoteError("FORBIDDEN", "La organización no posee esta conexión social.", 403);
  }
  return conn;
}

export async function setSocialConnectionHealth(input: {
  connectionId: string;
  health: string;
  rateLimitState?: MetaRateLimitState | null;
}) {
  return prisma.fotorankSocialConnection.update({
    where: { id: input.connectionId },
    data: {
      health: input.health,
      lastValidatedAt: new Date(),
      rateLimitStateJson: input.rateLimitState ?? undefined,
    },
  });
}

export async function listOrganizationSocialConnections(organizationId: string) {
  return prisma.fotorankSocialConnection.findMany({
    where: { organizationId, connectionStatus: { not: "DISCONNECTED" } },
    orderBy: { connectedAt: "desc" },
  });
}
