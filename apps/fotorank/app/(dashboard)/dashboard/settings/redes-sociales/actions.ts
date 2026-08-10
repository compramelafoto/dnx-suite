"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";
import {
  disconnectSocialConnection,
  listOrganizationSocialConnections,
  permissionsMatrix,
  upsertMockSocialConnection,
} from "../../../../lib/fotorank/public-vote/instagram/social-connection";
import { getSocialConnectionDiagnostics } from "../../../../lib/fotorank/public-vote/instagram/instagram-readiness";
import { createOAuthState, buildInstagramAuthorizeUrl } from "../../../../lib/fotorank/public-vote/instagram/oauth";

export async function getSocialConnectionsForActiveOrg() {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };

  const connections = await listOrganizationSocialConnections(resolved.org.id);
  return {
    ok: true as const,
    organizationId: resolved.org.id,
    organizationName: resolved.org.name,
    connections: connections.map((c) => ({
      id: c.id,
      accountId: c.accountId,
      accountUsername: c.accountUsername,
      accountType: c.accountType,
      connectionStatus: c.connectionStatus,
      health: c.health,
      permissions: permissionsMatrix(c.permissionsJson),
      connectedAt: c.connectedAt.toISOString(),
      lastValidatedAt: c.lastValidatedAt?.toISOString() ?? null,
      tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
    })),
  };
}

export async function disconnectInstagramConnection(connectionId: string) {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };

  await disconnectSocialConnection({
    connectionId,
    organizationId: resolved.org.id,
  });
  revalidatePath("/dashboard/settings/redes-sociales");
  return { ok: true as const };
}

export async function beginInstagramOAuthMock() {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };

  const state = createOAuthState({
    organizationId: resolved.org.id,
    userId: user.id,
  });
  const redirectUri =
    process.env.FOTORANK_INSTAGRAM_OAUTH_REDIRECT ??
    "http://localhost:3000/api/fotorank/instagram/oauth/callback";
  const url = buildInstagramAuthorizeUrl({ state, redirectUri });

  await upsertMockSocialConnection({
    organizationId: resolved.org.id,
    accountId: `mock_${resolved.org.id.slice(0, 8)}`,
    accountUsername: "clickaton.ok.mock",
    connectedByUserId: user.id,
  });

  revalidatePath("/dashboard/settings/redes-sociales");
  return { ok: true as const, authorizeUrl: url, statePrefix: state.slice(0, 8) + "…" };
}

export async function getConnectionDiagnostics(connectionId: string) {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };

  const conn = await listOrganizationSocialConnections(resolved.org.id);
  if (!conn.some((c) => c.id === connectionId)) {
    return { ok: false as const, error: "Conexión no pertenece a la organización." };
  }
  const diagnostics = await getSocialConnectionDiagnostics(connectionId);
  return { ok: true as const, diagnostics };
}
