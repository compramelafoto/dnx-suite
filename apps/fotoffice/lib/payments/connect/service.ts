// Rutas estrechas a propósito: el barril raíz de @repo/payments arrastra todo el paquete,
// cuyos imports ESM con extensión .js no resuelve Turbopack. Estos dos módulos no tienen
// imports internos de valor (pkce solo usa node:crypto; mp-client, solo tipos).
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthStateToken,
  hashOAuthStateToken,
} from "@repo/payments/mp-oauth/pkce";
import {
  buildMercadoPagoAuthorizeUrl,
  type MercadoPagoOAuthHttpClient,
} from "@repo/payments/mp-oauth/client";
import { decryptPkceVerifier, encryptPkceVerifier } from "./crypto";
import { FOTOFFICE_PRODUCT_KEY, workspaceOrganizationRef } from "./constants";
import type { MpConnectConfig } from "./config";

/** Cuánto vive un estado OAuth antes de vencer. Diez minutos alcanza de sobra para autorizar. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type ConnectErrorCode =
  | "NOT_CONFIGURED"
  | "STATE_NOT_FOUND"
  | "STATE_ALREADY_USED"
  | "STATE_EXPIRED"
  | "STATE_WRONG_PRODUCT";

/** Error del flujo de conexión. Nunca lleva tokens ni códigos en el mensaje. */
export class ConnectError extends Error {
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConnectError";
  }
}

export type ConnectStateRecord = {
  stateHash: string;
  userId: number;
  financialIdentityId: string;
  productKey: string;
  environment: "PROD" | "TEST";
  redirectUri: string;
  codeChallenge: string | null;
  codeVerifierCiphertext: string | null;
  codeVerifierNonce: string | null;
  codeVerifierAuthTag: string | null;
  expiresAt: Date;
  usedAt?: Date | null;
  /** Workspace al que pertenece esta conexión, para poder volver a él en el callback. */
  organizationRef: string;
};

/**
 * Puerto de persistencia.
 *
 * Se define acá, y no se reusa el store de `owner-oauth`, porque aquel responde "la única
 * cuenta dueña de Clickatón" y este responde "la cuenta del workspace X": son consultas
 * distintas, no la misma con un parámetro.
 */
export type ConnectDeps = {
  config: MpConnectConfig;
  mpClient: MercadoPagoOAuthHttpClient;
  /** Clave maestra para cifrar el verificador PKCE (32 bytes en base64). */
  masterKeyBase64: string;
  now?: () => Date;
  store: {
    getOrCreateIdentity(
      organizationRef: string,
      legalName: string,
    ): Promise<{ id: string; organizationRef: string }>;
    saveState(state: ConnectStateRecord): Promise<ConnectStateRecord>;
    findStateByHash(stateHash: string): Promise<ConnectStateRecord | null>;
    markStateUsed(stateHash: string, at: Date): Promise<void>;
    saveCredential(record: {
      environment: "PROD" | "TEST";
      accessToken: string;
      refreshToken: string | null;
      expiresIn: number | null;
      providerUserId: string;
    }): Promise<{ id: string }>;
    upsertPaymentAccount(account: {
      financialIdentityId: string;
      provider: "MERCADOPAGO";
      environment: "PROD" | "TEST";
      providerUserId: string;
      credentialReference: string;
      originApp: string;
      capabilities: string[];
      status: string;
      connectedAt: Date;
      tokenFingerprint: string;
    }): Promise<{ id: string }>;
  };
};

export type StartConnectionResult = {
  authorizeUrl: string;
  /**
   * Solo para tests: permite comprobar que el verificador NO quedó en claro en la base.
   * Nunca se devuelve al navegador ni se registra en un log.
   */
  debugCodeVerifier: string;
};

/**
 * Inicia la conexión de la cuenta de MercadoPago de una institución.
 *
 * Crea la identidad financiera del workspace si todavía no existe. Esa creación es
 * deliberada —la persona pidió conectar— y nunca ocurre por visitar una pantalla: leer el
 * estado con `getWorkspaceCollectionStatus` no crea nada.
 */
export async function startMpConnection(
  input: { workspaceId: string; userId: number; legalName?: string },
  deps: ConnectDeps,
): Promise<StartConnectionResult> {
  const { config } = deps;
  if (!config.configured || !config.clientId || !config.redirectUri) {
    throw new ConnectError(
      "NOT_CONFIGURED",
      `Faltan variables de entorno de MercadoPago: ${config.missing.join(", ")}`,
    );
  }

  const now = deps.now?.() ?? new Date();
  const organizationRef = workspaceOrganizationRef(input.workspaceId);
  const identity = await deps.store.getOrCreateIdentity(
    organizationRef,
    input.legalName ?? organizationRef,
  );

  // PKCE: el verificador se queda del lado del servidor, cifrado; a MercadoPago solo va
  // el desafío. Así, aunque alguien intercepte el código de autorización, no puede
  // canjearlo sin el verificador.
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeS256(codeVerifier);
  const encrypted = encryptPkceVerifier(codeVerifier, deps.masterKeyBase64);

  // Al navegador va el token; a la base, solo su hash. Si alguien lee la tabla no puede
  // reconstruir el state que hace falta para completar el flujo.
  const stateToken = generateOAuthStateToken();
  const stateHash = hashOAuthStateToken(stateToken);

  await deps.store.saveState({
    stateHash,
    userId: input.userId,
    financialIdentityId: identity.id,
    productKey: FOTOFFICE_PRODUCT_KEY,
    environment: "PROD",
    redirectUri: config.redirectUri,
    codeChallenge,
    codeVerifierCiphertext: encrypted.ciphertext,
    codeVerifierNonce: encrypted.nonce,
    codeVerifierAuthTag: encrypted.authTag,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
    usedAt: null,
    organizationRef,
  });

  return {
    authorizeUrl: buildMercadoPagoAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state: stateToken,
      codeChallenge,
    }),
    debugCodeVerifier: codeVerifier,
  };
}

export type CompleteConnectionResult = {
  workspaceId: string;
  providerUserId: string;
  paymentAccountId: string;
};

/**
 * Completa la conexión con el código que devuelve MercadoPago.
 *
 * El estado se valida contra la base y se marca usado **antes** de canjear el código: un
 * state sirve una sola vez. Si se pudiera reusar, alguien que capture la URL de retorno
 * podría reconectar la cuenta cuando quisiera.
 */
export async function completeMpConnection(
  input: { code: string; state: string },
  deps: ConnectDeps,
): Promise<CompleteConnectionResult> {
  const { config } = deps;
  if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new ConnectError(
      "NOT_CONFIGURED",
      `Faltan variables de entorno de MercadoPago: ${config.missing.join(", ")}`,
    );
  }

  const now = deps.now?.() ?? new Date();
  const stateHash = hashOAuthStateToken(input.state);
  const state = await deps.store.findStateByHash(stateHash);

  if (!state) throw new ConnectError("STATE_NOT_FOUND", "El pedido de conexión no es válido.");
  if (state.usedAt) {
    throw new ConnectError("STATE_ALREADY_USED", "Este pedido de conexión ya se usó.");
  }
  if (state.productKey !== FOTOFFICE_PRODUCT_KEY) {
    // La tabla de estados es compartida con otros productos del monorepo.
    throw new ConnectError("STATE_WRONG_PRODUCT", "El pedido de conexión no es de FotoOffice.");
  }
  if (state.expiresAt.getTime() <= now.getTime()) {
    throw new ConnectError("STATE_EXPIRED", "El pedido de conexión venció. Probá de nuevo.");
  }

  await deps.store.markStateUsed(stateHash, now);

  const codeVerifier =
    state.codeVerifierCiphertext && state.codeVerifierNonce && state.codeVerifierAuthTag
      ? decryptPkceVerifier(
          {
            ciphertext: state.codeVerifierCiphertext,
            nonce: state.codeVerifierNonce,
            authTag: state.codeVerifierAuthTag,
          },
          deps.masterKeyBase64,
        )
      : null;

  const tokens = await deps.mpClient.exchangeAuthorizationCode({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code: input.code,
    redirectUri: config.redirectUri,
    codeVerifier,
  });

  // El token va a la bóveda cifrada; en la cuenta queda solo la referencia.
  const credential = await deps.store.saveCredential({
    environment: state.environment,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    providerUserId: tokens.providerUserId,
  });

  const account = await deps.store.upsertPaymentAccount({
    financialIdentityId: state.financialIdentityId,
    provider: "MERCADOPAGO",
    environment: state.environment,
    providerUserId: tokens.providerUserId,
    credentialReference: credential.id,
    originApp: FOTOFFICE_PRODUCT_KEY,
    capabilities: ["SPLIT_RECEIVER"],
    status: "ACTIVE",
    connectedAt: now,
    tokenFingerprint: fingerprint(tokens.accessToken),
  });

  const workspaceId = state.organizationRef.split(":").slice(1).join(":");
  return { workspaceId, providerUserId: tokens.providerUserId, paymentAccountId: account.id };
}

function fingerprint(token: string): string {
  // Huella no reversible, para detectar reconexiones con la misma cuenta sin guardar el token.
  return hashOAuthStateToken(token);
}
