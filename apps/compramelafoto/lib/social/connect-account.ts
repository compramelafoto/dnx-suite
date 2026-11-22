import {
  createMetaGraphClient,
  decryptSecret,
  encryptSecret,
  tryLoadSocialMasterKeyFromEnv,
} from "@repo/social-publisher";
import { prisma } from "@repo/db";
import { elegirCuentaInstagram, SYSTEM_USER_SCOPE, type PaginaConInstagram } from "./system-token-account";

/**
 * Conexión de la cuenta de Instagram de CompraMeLaFoto con un TOKEN DE USUARIO DEL SISTEMA
 * de Meta (2026-11-22).
 *
 * Por qué así y no con «inicio de sesión con Instagram»: Meta ya no ofrece ese inicio de
 * sesión en apps nuevas (la app «CLF Publicador» solo tiene inicio de sesión con Facebook
 * o unificado), y el motor publica contra `graph.facebook.com`, donde los tokens de
 * Instagram Login no sirven. El token del sistema es la forma que Meta recomienda para que
 * una empresa publique en su propia cuenta: se genera en el administrador comercial
 * («Apps para fotógrafos» → Usuarios del sistema), no vence y no necesita revisión de la app.
 *
 * El token lo pega una persona en Vercel (`CLF_INSTAGRAM_SYSTEM_TOKEN`); acá se lee, se
 * verifica contra Meta, se cifra con `DNX_SOCIAL_VAULT_MASTER_KEY` y se guarda en
 * `DnxSocialAccount`. Ningún camino de este archivo loguea el token.
 */

/** Aplicación dueña del permiso, igual que en `prisma-store.ts` y `worker.ts`. */
const APPLICATION = "COMPRAMELAFOTO";
const TOKEN_ENV = "CLF_INSTAGRAM_SYSTEM_TOKEN";

/** Falta configuración: nunca incluye el valor de ninguna variable, solo su nombre. */
export class InstagramConnectionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramConnectionConfigError";
  }
}

/** Sin master key no hay dónde cifrar el token: se corta acá, nunca se guarda en claro. */
function requireMasterKey(): Buffer {
  const masterKey = tryLoadSocialMasterKeyFromEnv();
  if (!masterKey) {
    throw new InstagramConnectionConfigError(
      "Falta configurar DNX_SOCIAL_VAULT_MASTER_KEY en Vercel: no se puede cifrar el token de Instagram.",
    );
  }
  return masterKey;
}

function requireSystemToken(): string {
  const token = process.env[TOKEN_ENV]?.trim();
  if (!token) {
    throw new InstagramConnectionConfigError(`Falta configurar ${TOKEN_ENV} en Vercel.`);
  }
  return token;
}

export type ConnectResult = { accountId: string; username: string | null; pageName: string | null };

/**
 * Conecta (o reconecta) la cuenta de Instagram con el token del sistema que está en
 * Vercel. Busca qué cuenta de Instagram tiene asignada el token, comprueba que Meta la
 * reconoce y guarda el token cifrado.
 */
export async function connectWithSystemToken(ownerUserId: number): Promise<ConnectResult> {
  const masterKey = requireMasterKey();
  const token = requireSystemToken();
  const graph = createMetaGraphClient();

  const paginas = await graph.request<{ data?: PaginaConInstagram[] }>(
    "/me/accounts?fields=name,instagram_business_account{id,username}",
    { accessToken: token },
  );
  const cuenta = elegirCuentaInstagram(paginas.data ?? []);
  if (!cuenta) {
    throw new InstagramConnectionConfigError(
      "El token no tiene acceso a ninguna cuenta de Instagram. Revisá que el usuario del sistema tenga asignadas la página y la cuenta de Instagram.",
    );
  }

  const encrypted = encryptSecret(token, masterKey);
  const now = new Date();
  const datos = {
    username: cuenta.username,
    displayName: cuenta.pageName,
    scopes: [SYSTEM_USER_SCOPE, "instagram_basic", "instagram_content_publish"],
    status: "ACTIVE" as const,
    // Los tokens de usuario del sistema generados con «Nunca» no vencen.
    expiresAt: null,
    lastValidatedAt: now,
    tokenCiphertext: encrypted.ciphertext,
    tokenNonce: encrypted.nonce,
    tokenAuthTag: encrypted.authTag,
  };
  const account = await prisma.dnxSocialAccount.upsert({
    where: { platform_externalAccountId: { platform: "INSTAGRAM", externalAccountId: cuenta.igUserId } },
    create: { platform: "INSTAGRAM", ownerUserId, externalAccountId: cuenta.igUserId, ...datos },
    update: datos,
  });
  await ensureClfPublishGrant(account.id);
  console.info(`[social] admin ${ownerUserId} conectó @${cuenta.username ?? cuenta.igUserId} con token del sistema`);
  return { accountId: account.id, username: account.username, pageName: cuenta.pageName };
}

/**
 * `DnxSocialAccountGrant` no tiene una unique key sobre (socialAccountId, application),
 * así que el "upsert" del permiso se hace a mano.
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
    await prisma.dnxSocialAccountGrant.update({ where: { id: existing.id }, data: { canPublish: true } });
  }
}

export type SocialTokenCheckSummary = { checked: number; ok: number; failed: number };

/**
 * Control diario (lo llama el cron `social-album-stories`): pregunta a Meta por cada
 * cuenta conectada. Si Meta rechaza el token (se revocó o se quitó un permiso), la cuenta
 * pasa a `EXPIRED`: el worker deja de intentar y el panel muestra que hay que reconectar.
 * Un error de red o de Meta (5xx) no marca nada: se vuelve a probar al otro día.
 */
export async function runSocialTokenCheck(now: Date = new Date()): Promise<SocialTokenCheckSummary> {
  const masterKey = requireMasterKey();
  const accounts = await prisma.dnxSocialAccount.findMany({
    where: {
      platform: "INSTAGRAM",
      status: "ACTIVE",
      grants: { some: { application: APPLICATION, canPublish: true } },
    },
  });
  const graph = createMetaGraphClient();
  let ok = 0;
  let failed = 0;
  for (const account of accounts) {
    if (!account.tokenCiphertext || !account.tokenNonce || !account.tokenAuthTag) {
      failed++;
      await prisma.dnxSocialAccount.update({ where: { id: account.id }, data: { status: "EXPIRED" } });
      continue;
    }
    try {
      const token = decryptSecret(
        { ciphertext: account.tokenCiphertext, nonce: account.tokenNonce, authTag: account.tokenAuthTag },
        masterKey,
      );
      await graph.request(`/${account.externalAccountId}?fields=id,username`, { accessToken: token });
      await prisma.dnxSocialAccount.update({ where: { id: account.id }, data: { lastValidatedAt: now } });
      ok++;
    } catch (error) {
      failed++;
      const retryable = (error as { retryable?: boolean } | null)?.retryable === true;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[social] el token de @${account.username ?? account.id} no pasó el control: ${msg}`);
      if (!retryable) {
        await prisma.dnxSocialAccount.update({ where: { id: account.id }, data: { status: "EXPIRED" } });
      }
    }
  }
  return { checked: accounts.length, ok, failed };
}
