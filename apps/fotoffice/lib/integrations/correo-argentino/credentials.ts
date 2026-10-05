import "server-only";
import { CORREO_ARGENTINO_INTEGRATION_KEY } from "../registry";
import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readRefreshToken,
  saveIntegration,
} from "../store";
import { requireIntegrationsMasterKey } from "../vault";
import { createMiCorreoClient, type MiCorreoClient, type MiCorreoEnv } from "./client";
import { MiCorreoError } from "./errors";

/**
 * Credenciales de MiCorreo de una institución, guardadas en `WorkspaceIntegration` con el
 * mismo baúl que Google (`lib/integrations/vault.ts`) y pasando por `lib/integrations/store.ts`,
 * que es la única puerta a esa tabla.
 *
 * Lo cifrado es `{ env, apiUser, apiPassword, customerId }`. La contraseña de la CUENTA
 * MiCorreo (`accountPassword`) sólo se usa una vez, para que `/users/validate` devuelva el
 * `customerId`: no se guarda, no se loguea y no sale de esta función.
 *
 * Nada de esto vuelve al navegador. Para mostrar el estado, usar `getIntegrationSummary`
 * (email de la cuenta, estado, fecha), que no incluye credenciales.
 */

const PROVIDER = "CORREO_ARGENTINO";

type StoredSecret = {
  env: MiCorreoEnv;
  apiUser: string;
  apiPassword: string;
  customerId: string;
};

export type CorreoArgentinoCredentialsInput = {
  env: MiCorreoEnv;
  apiUser: string;
  apiPassword: string;
  accountEmail: string;
  accountPassword: string;
};

/** Sólo para tests: la red entra por acá. En producción se usa el `fetch` global. */
export type CorreoArgentinoDeps = { fetchImpl?: typeof fetch; now?: () => Date };

function esEnv(value: unknown): value is MiCorreoEnv {
  return value === "TEST" || value === "PROD";
}

/**
 * Valida contra MiCorreo (token + `/users/validate`) y recién entonces guarda.
 *
 * Errores: `MiCorreoError` — `AUTH` si el usuario/clave de la API no sirven, `BUSINESS` si
 * la cuenta MiCorreo no existe o la contraseña no coincide (o faltan datos en el formulario),
 * `NETWORK`/`RATE_LIMIT`/`UNEXPECTED` según el caso. Sin clave maestra lanza
 * `IntegrationsVaultError` antes de tocar la red.
 */
export async function saveCorreoArgentinoCredentials(
  workspaceId: string,
  userId: number,
  input: CorreoArgentinoCredentialsInput,
  deps: CorreoArgentinoDeps = {},
): Promise<{ customerId: string }> {
  const apiUser = input.apiUser?.trim() ?? "";
  const accountEmail = input.accountEmail?.trim() ?? "";
  if (!esEnv(input.env) || !apiUser || !input.apiPassword || !accountEmail || !input.accountPassword) {
    throw new MiCorreoError("BUSINESS", "Faltan datos para conectar MiCorreo.");
  }
  // Sin dónde cifrar no tiene sentido ir a MiCorreo: se corta antes.
  requireIntegrationsMasterKey();

  const client = createMiCorreoClient({
    env: input.env,
    apiUser,
    apiPassword: input.apiPassword,
    ...deps,
  });
  // Siempre un token nuevo: uno en caché no prueba que ESTA clave sea correcta.
  await client.getToken({ fresh: true });
  const { customerId } = await client.validateUser(accountEmail, input.accountPassword);

  const secret: StoredSecret = { env: input.env, apiUser, apiPassword: input.apiPassword, customerId };
  await saveIntegration({
    workspaceId,
    integrationKey: CORREO_ARGENTINO_INTEGRATION_KEY,
    provider: PROVIDER,
    accountEmail,
    accountExternalId: customerId,
    // No es OAuth: no hay permisos otorgados.
    grantedScopes: [],
    // `saveIntegration` cifra este campo; para Correo es el JSON de credenciales.
    refreshToken: JSON.stringify(secret),
    connectedByUserId: userId,
  });
  return { customerId };
}

function parseSecret(texto: string): StoredSecret | null {
  try {
    const s = JSON.parse(texto) as Partial<StoredSecret>;
    if (
      esEnv(s.env) &&
      typeof s.apiUser === "string" &&
      typeof s.apiPassword === "string" &&
      typeof s.customerId === "string" &&
      s.apiUser &&
      s.apiPassword &&
      s.customerId
    ) {
      return { env: s.env, apiUser: s.apiUser, apiPassword: s.apiPassword, customerId: s.customerId };
    }
  } catch {
    // cae al null de abajo
  }
  return null;
}

/**
 * El cliente listo para cotizar, o `null` si la institución no tiene MiCorreo usable
 * (no conectó, necesita reconexión, o la credencial no se puede descifrar). Nunca lanza
 * por eso: quien cotiza decide el respaldo (E14).
 */
export async function loadCorreoArgentinoClient(
  workspaceId: string,
  deps: CorreoArgentinoDeps = {},
): Promise<{ client: MiCorreoClient; customerId: string } | null> {
  const resumen = await getIntegrationSummary(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY);
  if (!resumen || resumen.status !== "ACTIVE") return null;

  const texto = await readRefreshToken(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY).catch(() => null);
  if (!texto) return null;
  const secret = parseSecret(texto);
  if (!secret) return null;

  const client = createMiCorreoClient({
    env: secret.env,
    apiUser: secret.apiUser,
    apiPassword: secret.apiPassword,
    ...deps,
  });
  return { client, customerId: secret.customerId };
}

/**
 * ¿La institución tiene MiCorreo conectado y activo? Sólo mira el estado (no descifra nada): es
 * lo que decide si el checkout ofrece envíos que se cotizan con Correo.
 */
export async function isCorreoArgentinoActive(workspaceId: string): Promise<boolean> {
  const resumen = await getIntegrationSummary(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY);
  return resumen?.status === "ACTIVE";
}

export type CorreoArgentinoConnectionInfo = {
  status: "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT";
  accountEmail: string;
  connectedAt: Date;
  /** `null` si la credencial no se pudo descifrar. */
  env: MiCorreoEnv | null;
  /** El número de cliente entero; quien lo muestre tiene que enmascararlo. */
  customerId: string | null;
};

/**
 * Para la pantalla de configuración: estado, cuenta, ambiente y número de cliente. NUNCA el
 * usuario ni las contraseñas de la API. `null` si la institución no conectó MiCorreo.
 */
export async function describeCorreoArgentinoConnection(
  workspaceId: string,
): Promise<CorreoArgentinoConnectionInfo | null> {
  const resumen = await getIntegrationSummary(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY);
  if (!resumen) return null;
  const texto = await readRefreshToken(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY).catch(() => null);
  const secret = texto ? parseSecret(texto) : null;
  return {
    status: resumen.status,
    accountEmail: resumen.accountEmail,
    connectedAt: resumen.connectedAt,
    env: secret?.env ?? null,
    customerId: secret?.customerId ?? null,
  };
}

/**
 * Las credenciales dejaron de valer (MiCorreo contestó `AUTH`). No se borra la fila: el
 * panel tiene que mostrar que hay que reconectar. Si ya no existe, no hay nada que marcar.
 */
export async function markCorreoNeedsReconsent(workspaceId: string): Promise<void> {
  await markIntegrationNeedsReconsent(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY).catch(
    () => undefined,
  );
}

/** Borra la credencial. No hay nada que revocar del lado de Correo. */
export async function deleteCorreoArgentinoCredentials(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY);
}
