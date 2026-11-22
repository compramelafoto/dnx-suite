import { randomBytes } from "node:crypto";
import {
  buildInstagramAuthorizeUrl,
  decideTokenRefresh,
  decryptSecret,
  encryptSecret,
  exchangeInstagramCode,
  refreshInstagramToken,
  tryLoadSocialMasterKeyFromEnv,
  type InstagramOAuthConfig,
} from "@repo/social-publisher";
import { prisma } from "@repo/db";
import { getPublicSiteOrigin } from "@/lib/public-site-url";

/**
 * Conexión y renovación de la cuenta de Instagram de CompraMeLaFoto (Task 12).
 *
 * Es la pieza más sensible del módulo social: acá se cifra y se guarda el token que le
 * da permiso a la app de publicar en la cuenta de Instagram de la empresa. Ningún camino
 * de este archivo debe loguear el token ni el `code` de OAuth, y sin
 * `DNX_SOCIAL_VAULT_MASTER_KEY` no hay guardado posible — nunca en texto plano como
 * alternativa.
 */

/** Aplicación dueña del permiso, igual que en `prisma-store.ts` y `worker.ts`. */
const APPLICATION = "COMPRAMELAFOTO";
const CALLBACK_PATH = "/api/social/instagram/callback";

/**
 * Cookie httpOnly que guarda el `state` anti-CSRF entre `connect` y `callback`. Vive
 * acá (y no en uno de los `route.ts`) porque un módulo de rutas de Next solo debería
 * exportar handlers HTTP y config de segmento, no constantes de uso compartido.
 */
export const INSTAGRAM_OAUTH_STATE_COOKIE = "clf_ig_oauth_state";

/** Falta configuración: nunca incluye el valor de ninguna variable, solo su nombre. */
export class InstagramConnectionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramConnectionConfigError";
  }
}

function readInstagramAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const faltantes: string[] = [];
  if (!appId) faltantes.push("META_APP_ID");
  if (!appSecret) faltantes.push("META_APP_SECRET");
  if (faltantes.length > 0) {
    throw new InstagramConnectionConfigError(
      `Falta configurar ${faltantes.join(" y ")} para conectar Instagram.`,
    );
  }
  return { appId: appId as string, appSecret: appSecret as string };
}

function buildOAuthConfig(): InstagramOAuthConfig {
  const { appId, appSecret } = readInstagramAppCredentials();
  return {
    appId,
    appSecret,
    // Tiene que coincidir carácter por carácter con el que se usó para pedir el código
    // (ver comentario en `exchangeInstagramCode`), por eso se arma siempre igual acá.
    redirectUri: `${getPublicSiteOrigin()}${CALLBACK_PATH}`,
  };
}

/** Sin master key no hay dónde cifrar el token: se corta acá, nunca se guarda en claro. */
function requireMasterKey(): Buffer {
  const masterKey = tryLoadSocialMasterKeyFromEnv();
  if (!masterKey) {
    throw new InstagramConnectionConfigError(
      "Falta configurar DNX_SOCIAL_VAULT_MASTER_KEY: no se puede cifrar el token de Instagram.",
    );
  }
  return masterKey;
}

export function generateInstagramOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export type StartInstagramConnectionResult = {
  url: string;
  state: string;
};

/**
 * Arma la URL de autorización de Instagram y el `state` que la ruta debe guardar en una
 * cookie `httpOnly`. Valida la configuración antes de generar nada: si falta
 * `META_APP_ID`/`META_APP_SECRET`, la ruta puede mostrar un error claro sin llegar a
 * redirigir a Meta con una config rota.
 */
export function startInstagramConnection(userId: number): StartInstagramConnectionResult {
  const config = buildOAuthConfig();
  const state = generateInstagramOAuthState();
  // Sin datos sensibles: solo deja rastro de quién inició la conexión.
  console.info(`[social] admin ${userId} inició la conexión de la cuenta de Instagram`);
  return { url: buildInstagramAuthorizeUrl(config, state), state };
}

export type CompleteInstagramConnectionResult = {
  accountId: string;
  username: string | null;
  expiresAt: Date;
};

/**
 * Canjea el `code` de Instagram por un token de larga duración, lo cifra y deja la
 * cuenta lista para publicar.
 *
 * `ownerUserId` es el id del admin ya autenticado que la ruta de callback resolvió con
 * su propio guard — se reutiliza ese resultado en vez de volver a leer la sesión acá, y
 * es el valor que va a la columna `ownerUserId` (obligatoria) de `DnxSocialAccount`. La
 * validación del `state` contra la cookie ya la hizo la ruta antes de llamar a esta
 * función: repetirla acá sería redundante.
 */
export async function completeInstagramConnection(
  code: string,
  ownerUserId: number,
): Promise<CompleteInstagramConnectionResult> {
  const config = buildOAuthConfig();
  const masterKey = requireMasterKey();

  // `connected.accessToken` vive solo en esta variable local: no se loguea ni se
  // devuelve nunca. Se cifra antes de que este scope termine.
  const connected = await exchangeInstagramCode(config, code);
  const encrypted = encryptSecret(connected.accessToken, masterKey);
  const now = new Date();

  const account = await prisma.dnxSocialAccount.upsert({
    where: {
      platform_externalAccountId: {
        platform: "INSTAGRAM",
        externalAccountId: connected.externalAccountId,
      },
    },
    create: {
      platform: "INSTAGRAM",
      ownerUserId,
      externalAccountId: connected.externalAccountId,
      username: connected.username,
      scopes: connected.scopes,
      status: "ACTIVE",
      expiresAt: connected.expiresAt,
      lastValidatedAt: now,
      tokenCiphertext: encrypted.ciphertext,
      tokenNonce: encrypted.nonce,
      tokenAuthTag: encrypted.authTag,
    },
    update: {
      username: connected.username,
      scopes: connected.scopes,
      status: "ACTIVE",
      expiresAt: connected.expiresAt,
      lastValidatedAt: now,
      tokenCiphertext: encrypted.ciphertext,
      tokenNonce: encrypted.nonce,
      tokenAuthTag: encrypted.authTag,
    },
  });

  await ensureClfPublishGrant(account.id);

  return { accountId: account.id, username: account.username, expiresAt: account.expiresAt as Date };
}

/**
 * `DnxSocialAccountGrant` no tiene una unique key sobre (socialAccountId, application),
 * así que el "upsert" del permiso se hace a mano: si ya existe uno para CLF no se
 * duplica, solo se asegura que siga permitiendo publicar (por si alguna vez se hubiera
 * revocado a mano).
 */
async function ensureClfPublishGrant(socialAccountId: string): Promise<void> {
  const existing = await prisma.dnxSocialAccountGrant.findFirst({
    where: { socialAccountId, application: APPLICATION },
    select: { id: true, canPublish: true },
  });
  if (!existing) {
    await prisma.dnxSocialAccountGrant.create({
      data: { socialAccountId, application: APPLICATION, canPublish: true },
    });
    return;
  }
  if (!existing.canPublish) {
    await prisma.dnxSocialAccountGrant.update({
      where: { id: existing.id },
      data: { canPublish: true },
    });
  }
}

export type SocialTokenRefreshSummary = {
  checked: number;
  refreshed: number;
  failed: number;
  skipped: number;
};

/**
 * Recorre las cuentas de Instagram con permiso de publicar para CompraMeLaFoto y renueva
 * el token de las que están por vencer (`decideTokenRefresh`, margen de 10 días). Si
 * Meta rechaza la renovación, la cuenta pasa a `EXPIRED` y hay que reconectarla a mano
 * desde `/api/social/instagram/connect`.
 */
export async function runSocialTokenRefresh(now: Date = new Date()): Promise<SocialTokenRefreshSummary> {
  const masterKey = requireMasterKey();

  const accounts = await prisma.dnxSocialAccount.findMany({
    where: {
      platform: "INSTAGRAM",
      grants: { some: { application: APPLICATION, canPublish: true } },
    },
  });

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const account of accounts) {
    const decision = decideTokenRefresh({ createdAt: account.createdAt, expiresAt: account.expiresAt, now });
    if (decision.action !== "REFRESH") {
      skipped++;
      continue;
    }

    if (!account.tokenCiphertext || !account.tokenNonce || !account.tokenAuthTag) {
      failed++;
      console.error(`[social] cuenta de Instagram ${account.id} sin token cifrado; no se puede renovar`);
      await prisma.dnxSocialAccount.update({ where: { id: account.id }, data: { status: "EXPIRED" } });
      continue;
    }

    try {
      // El token en claro vive solo dentro de este `try`: nunca se loguea ni sale de acá.
      const accessToken = decryptSecret(
        { ciphertext: account.tokenCiphertext, nonce: account.tokenNonce, authTag: account.tokenAuthTag },
        masterKey,
      );
      const renewed = await refreshInstagramToken(accessToken);
      const encrypted = encryptSecret(renewed.accessToken, masterKey);
      await prisma.dnxSocialAccount.update({
        where: { id: account.id },
        data: {
          tokenCiphertext: encrypted.ciphertext,
          tokenNonce: encrypted.nonce,
          tokenAuthTag: encrypted.authTag,
          expiresAt: renewed.expiresAt,
          lastValidatedAt: now,
        },
      });
      refreshed++;
    } catch (error) {
      failed++;
      await prisma.dnxSocialAccount.update({ where: { id: account.id }, data: { status: "EXPIRED" } });
      console.error(
        `[social] no se pudo renovar el token de Instagram de la cuenta ${account.id} (${account.username ?? "sin usuario"})`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return { checked: accounts.length, refreshed, failed, skipped };
}
