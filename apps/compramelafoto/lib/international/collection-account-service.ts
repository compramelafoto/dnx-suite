import { prisma } from "@/lib/prisma";
import { isInternationalEnabled } from "./flag";
import {
  resolveCollectionAccess,
  toCollectionAccountView,
  type CollectionAccess,
  type CollectionAccountView,
} from "./collection-access";
import {
  cleanCollectionSecret,
  collectionSecretLast4,
  resolveIntlPaymentsEnvironment,
  validateCollectionSecret,
  type IntlCollectionProvider,
  type IntlPaymentsEnvironment,
} from "./collection-secret";
import {
  decryptCollectionSecret,
  defaultCollectionVaultDeps,
  encryptCollectionSecret,
  isCollectionVaultConfigured,
} from "./collection-vault";
import { checkCollectionSecret, checkFailureMessage, type CollectionCheckResult } from "./collection-check";

export type CollectionServiceError = { status: 400 | 404 | 502 | 503; error: string };

type AvailableAccess = Extract<CollectionAccess, { available: true }>;

const NOT_AVAILABLE: CollectionServiceError = { status: 404, error: "No disponible." };
const VAULT_NOT_CONFIGURED: CollectionServiceError = {
  status: 503,
  error: "Los cobros internacionales todavía no están disponibles.",
};

async function resolveAccessForUser(userId: number): Promise<CollectionAccess> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } });
  return resolveCollectionAccess({
    enabled: isInternationalEnabled(),
    countryCode: user?.countryCode ?? null,
  });
}

function findActiveAccount(userId: number) {
  return prisma.clfIntlCollectionAccount.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { connectedAt: "desc" },
  });
}

function checkError(
  result: Extract<CollectionCheckResult, { ok: false }>,
  provider: IntlCollectionProvider,
): CollectionServiceError {
  return {
    status: result.reason === "INVALID_CREDENTIALS" ? 400 : 502,
    error: checkFailureMessage(result.reason, provider),
  };
}

function toEnvironment(value: string): IntlPaymentsEnvironment {
  return value === "PROD" ? "PROD" : "TEST";
}

export async function getCollectionState(
  userId: number,
): Promise<{ access: CollectionAccess; account: CollectionAccountView | null }> {
  const access = await resolveAccessForUser(userId);
  if (!access.available) return { access, account: null };
  const row = await findActiveAccount(userId);
  return { access, account: row ? toCollectionAccountView(row, access) : null };
}

export async function connectCollectionAccount(
  userId: number,
  raw: unknown,
): Promise<{ account: CollectionAccountView } | CollectionServiceError> {
  const access = await resolveAccessForUser(userId);
  if (!access.available) return NOT_AVAILABLE;

  const secret = cleanCollectionSecret(raw);
  if (!secret || secret.provider !== access.provider) {
    return { status: 400, error: "Completá las credenciales." };
  }

  const environment = resolveIntlPaymentsEnvironment();
  const invalid = validateCollectionSecret(secret, environment);
  if (invalid) return { status: 400, error: invalid };

  if (!isCollectionVaultConfigured(environment)) return VAULT_NOT_CONFIGURED;

  const check = await checkCollectionSecret(secret, environment);
  if (!check.ok) return checkError(check, secret.provider);

  const { credentialId } = await encryptCollectionSecret(secret, environment, await defaultCollectionVaultDeps());

  const now = new Date();
  // El índice único parcial admite una sola cuenta ACTIVE: primero se desactiva la anterior.
  const [, created] = await prisma.$transaction([
    prisma.clfIntlCollectionAccount.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "INACTIVE", disconnectedAt: now },
    }),
    prisma.clfIntlCollectionAccount.create({
      data: {
        userId,
        provider: secret.provider,
        environment,
        credentialId,
        secretLast4: collectionSecretLast4(secret),
        accountId: check.accountId,
        accountLabel: check.accountLabel,
        accountCountryCode: check.accountCountryCode,
        status: "ACTIVE",
        connectedAt: now,
        lastCheckedAt: now,
      },
    }),
  ]);

  return { account: toCollectionAccountView(created, access) };
}

/** Desconecta sin borrar ni revocar la credencial: queda INACTIVE y cifrada. */
export async function disconnectCollectionAccount(
  userId: number,
): Promise<{ ok: true } | CollectionServiceError> {
  await prisma.clfIntlCollectionAccount.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "INACTIVE", disconnectedAt: new Date() },
  });
  return { ok: true };
}

export async function recheckCollectionAccount(
  userId: number,
): Promise<{ account: CollectionAccountView } | CollectionServiceError> {
  const access = await resolveAccessForUser(userId);
  if (!access.available) return NOT_AVAILABLE;

  const row = await findActiveAccount(userId);
  if (!row) return { status: 404, error: "No hay una cuenta conectada." };

  const environment = toEnvironment(row.environment);
  if (!isCollectionVaultConfigured(environment)) return VAULT_NOT_CONFIGURED;

  const secret = await decryptCollectionSecret(row.credentialId, await defaultCollectionVaultDeps());
  const check = await checkCollectionSecret(secret, environment);
  if (!check.ok) return checkError(check, secret.provider);

  const updated = await prisma.clfIntlCollectionAccount.update({
    where: { id: row.id },
    data: {
      lastCheckedAt: new Date(),
      accountLabel: check.accountLabel,
      accountCountryCode: check.accountCountryCode,
    },
  });
  return { account: toCollectionAccountView(updated, access) };
}

/** Para la etapa 5: cuenta ACTIVA con el id de credencial. Nunca sale por una ruta. */
export async function getActiveCollectionAccount(userId: number): Promise<{
  id: string;
  provider: IntlCollectionProvider;
  environment: IntlPaymentsEnvironment;
  credentialId: string;
} | null> {
  const row = await findActiveAccount(userId);
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider === "PAYPAL_OWN" ? "PAYPAL_OWN" : "MERCADOPAGO_OWN",
    environment: toEnvironment(row.environment),
    credentialId: row.credentialId,
  };
}
