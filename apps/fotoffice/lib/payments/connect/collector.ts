import "server-only";
import { prisma } from "@repo/db";
import { CredentialVault, createPrismaCredentialStore } from "@repo/payments";
import { createLiveMercadoPagoOAuthHttpClient } from "@repo/payments";
import { workspaceOrganizationRef } from "./constants";
import { readMpConnectConfig } from "./config";
import { sanitizeError } from "./log";
import { decideTokenUse } from "./token-freshness";

/**
 * Con quién cobra la institución.
 *
 * En dos vías el cobrador es la propia institución, así que hace falta **su** token, no el
 * de la plataforma. La vinculación por OAuth ya lo guardó cifrado en la bóveda.
 */
export type WorkspaceCollector = {
  accessToken: string;
  providerUserId: string;
};

export type CollectorResult =
  | { ok: true; collector: WorkspaceCollector }
  | { ok: false; code: CollectorProblem; message: string };

export type CollectorProblem =
  | "NOT_CONNECTED"
  | "NO_CREDENTIAL"
  | "NEEDS_RECONNECT"
  | "REFRESH_FAILED";

/** Nunca se registra el token; `sanitizeError` ya enmascara `APP_USR-*`. */
function problema(code: CollectorProblem, message: string): CollectorResult {
  return { ok: false, code, message };
}

/**
 * Devuelve el token con el que cobrar en nombre del workspace, refrescándolo si hace falta.
 *
 * Sin el refresco, los cobros se caen solos cuando el token vence y nadie entiende por qué:
 * la cuenta figura conectada, la pantalla dice que todo está bien, y MercadoPago rechaza.
 */
export async function resolveWorkspaceCollector(
  workspaceId: string,
  opciones: { now?: Date } = {},
): Promise<CollectorResult> {
  const identity = await prisma.dnxFinancialIdentity.findUnique({
    where: { organizationRef: workspaceOrganizationRef(workspaceId) },
    select: { id: true },
  });
  if (!identity) {
    return problema("NOT_CONNECTED", "Todavía no conectaste tu cuenta de MercadoPago.");
  }

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: { financialIdentityId: identity.id, provider: "MERCADOPAGO", environment: "PROD" },
    select: { id: true, providerUserId: true, credentialReference: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!account?.credentialReference || !account.providerUserId) {
    return problema("NOT_CONNECTED", "Todavía no conectaste tu cuenta de MercadoPago.");
  }
  if (account.status === "REVOKED" || account.status === "DISABLED") {
    return problema(
      "NEEDS_RECONNECT",
      "La conexión con MercadoPago fue dada de baja. Volvé a conectarla para poder cobrar.",
    );
  }

  // El cast lo exige el desajuste entre el delegado que genera Prisma y el que declara el
  // puerto de la bóveda. Es el mismo camino que ya usa `deps.ts` al guardar la credencial:
  // dos formas distintas de sortearlo serían dos cosas que arreglar el día que se arregle.
  const vault = new CredentialVault(createPrismaCredentialStore(prisma as never));

  let payload;
  try {
    payload = await vault.decryptMercadoPagoCredential(account.credentialReference);
  } catch (error) {
    console.error("[fotoffice][collector] no se pudo leer la credencial", {
      detalle: sanitizeError(error),
    });
    return problema(
      "NO_CREDENTIAL",
      "No pudimos leer las credenciales guardadas. Volvé a conectar tu cuenta de MercadoPago.",
    );
  }

  const decision = decideTokenUse({
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    hasRefreshToken: Boolean(payload.refreshToken),
    now: opciones.now ?? new Date(),
  });

  if (decision === "USE") {
    return { ok: true, collector: { accessToken: payload.accessToken, providerUserId: account.providerUserId } };
  }

  if (decision === "CANNOT_REFRESH") {
    return problema(
      "NEEDS_RECONNECT",
      "El permiso que nos diste en MercadoPago venció. Volvé a conectar tu cuenta para poder cobrar.",
    );
  }

  const config = readMpConnectConfig();
  if (!config.configured || !config.clientId || !config.clientSecret) {
    return problema(
      "NEEDS_RECONNECT",
      "La conexión con MercadoPago no está configurada en la plataforma. Escribinos.",
    );
  }

  const client = createLiveMercadoPagoOAuthHttpClient();
  if (!client.refreshAccessToken) {
    return problema("REFRESH_FAILED", "No pudimos renovar el permiso con MercadoPago.");
  }

  let renovado;
  try {
    renovado = await client.refreshAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: payload.refreshToken as string,
    });
  } catch (error) {
    // Se registra acá, donde ocurre: si no, un rechazo de MercadoPago es indistinguible de
    // un error propio y no queda rastro de por qué el cobro dejó de funcionar.
    console.error("[fotoffice][collector] MercadoPago rechazó el refresco", {
      detalle: sanitizeError(error),
    });
    return problema(
      "REFRESH_FAILED",
      "MercadoPago no renovó el permiso. Volvé a conectar tu cuenta.",
    );
  }

  // Se guarda una credencial nueva y se apunta la cuenta a ella. MercadoPago rota el refresh
  // token en cada uso: quedarse con el viejo dejaría a la institución sin poder renovar la
  // próxima vez.
  try {
    const nueva = await vault.encryptMercadoPagoCredential({
      environment: "PROD",
      payload: {
        accessToken: renovado.accessToken,
        refreshToken: renovado.refreshToken,
        providerUserId: renovado.providerUserId || account.providerUserId,
        connectedAt: payload.connectedAt ?? null,
        origin: payload.origin,
        scopes: payload.scopes ?? null,
        expiresAt: renovado.expiresIn
          ? new Date(Date.now() + renovado.expiresIn * 1000).toISOString()
          : null,
      },
    });
    await prisma.dnxPaymentAccount.update({
      where: { id: account.id },
      data: { credentialReference: nueva.id },
    });
  } catch (error) {
    console.error("[fotoffice][collector] no se pudo guardar la credencial renovada", {
      detalle: sanitizeError(error),
    });
    // El token nuevo sirve para este cobro aunque no se haya podido guardar. Frenar acá
    // convertiría un problema de persistencia en un cobro perdido.
  }

  return {
    ok: true,
    collector: {
      accessToken: renovado.accessToken,
      providerUserId: renovado.providerUserId || account.providerUserId,
    },
  };
}
