import "server-only";
import { ANDREANI_INTEGRATION_KEY } from "../registry";
import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readRefreshToken,
  saveIntegration,
} from "../store";
import { requireIntegrationsMasterKey } from "../vault";
import { createAndreaniClient, type AndreaniClient, type AndreaniEnv } from "./client";
import { AndreaniError } from "./errors";
import { maskAndreaniCode, maskAndreaniUser } from "./user-message";

/**
 * Credenciales de Andreani de una institución, guardadas en `WorkspaceIntegration` con el
 * mismo baúl que Google y MiCorreo (`lib/integrations/vault.ts`), pasando por
 * `lib/integrations/store.ts`, que es la única puerta a esa tabla.
 *
 * Lo cifrado es `{ env, user, password, clientCode, contractHome, contractBranch, originBranch }`.
 * En claro quedan sólo el usuario (`accountEmail`, para que el dueño reconozca la cuenta) y el
 * código de cliente (`accountExternalId`). Nada de esto vuelve al navegador: para la pantalla
 * está `describeAndreaniConnection`, que enmascara.
 */

const PROVIDER = "ANDREANI";

type StoredSecret = {
  env: AndreaniEnv;
  user: string;
  password: string;
  clientCode: string;
  contractHome: string;
  contractBranch: string | null;
  originBranch: string | null;
};

export type AndreaniCredentialsInput = {
  env: AndreaniEnv;
  user: string;
  password: string;
  clientCode: string;
  /** Contrato de entrega a domicilio. Obligatorio: con él se valida. */
  contractHome: string;
  /** Contrato de entrega en sucursal, si la institución lo tiene. */
  contractBranch?: string | null;
  /** Sucursal donde la institución impone los paquetes, si la hay. */
  originBranch?: string | null;
  /** CP al que se hace la cotización de prueba (el de origen de la institución). */
  testPostalCode: string;
};

/** Sólo para tests: la red entra por acá. En producción se usa el `fetch` global. */
export type AndreaniDeps = { fetchImpl?: typeof fetch; now?: () => Date };

export type LoadedAndreani = {
  client: AndreaniClient;
  clientCode: string;
  contractHome: string;
  contractBranch: string | null;
  originBranch: string | null;
};

function esEnv(value: unknown): value is AndreaniEnv {
  return value === "QA" || value === "PROD";
}

function opcional(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Valida contra Andreani (token NUEVO + una cotización de prueba con el contrato de domicilio:
 * 1 bulto de 1 kg, 30×20×10 cm, valor declarado 0, al CP indicado) y recién entonces guarda.
 *
 * La cotización hace falta porque [LIVE] la tarifa con datos falsos contesta 400 igual que con
 * un token malo: el login sólo prueba usuario y clave; el código de cliente y el contrato se
 * prueban cotizando.
 *
 * Errores: `AndreaniError` — `AUTH` si usuario/clave no sirven, `BUSINESS` si faltan datos o
 * Andreani rechaza la cotización (cliente/contrato/CP), `NETWORK`/`RATE_LIMIT`/`UNEXPECTED`
 * según el caso. Sin clave maestra lanza `IntegrationsVaultError` antes de tocar la red.
 */
export async function saveAndreaniCredentials(
  workspaceId: string,
  userId: number,
  input: AndreaniCredentialsInput,
  deps: AndreaniDeps = {},
): Promise<{ testQuoteMinor: number }> {
  const user = input.user?.trim() ?? "";
  const clientCode = input.clientCode?.trim() ?? "";
  const contractHome = input.contractHome?.trim() ?? "";
  const testPostalCode = input.testPostalCode?.trim() ?? "";
  if (!esEnv(input.env) || !user || !input.password || !clientCode || !contractHome || !testPostalCode) {
    throw new AndreaniError("BUSINESS", "Faltan datos para conectar Andreani.");
  }
  const contractBranch = opcional(input.contractBranch);
  const originBranch = opcional(input.originBranch);
  // Sin dónde cifrar no tiene sentido ir a Andreani: se corta antes.
  requireIntegrationsMasterKey();

  const client = createAndreaniClient({ env: input.env, user, password: input.password, ...deps });
  // Siempre un token nuevo: uno en caché no prueba que ESTA clave sea correcta.
  await client.getToken({ fresh: true });
  const prueba = await client.quote({
    clientCode,
    contract: contractHome,
    postalCodeDestination: testPostalCode,
    originBranch,
    packages: [{ weightKg: 1, lengthCm: 30, widthCm: 20, heightCm: 10, declaredValueMinor: 0 }],
  });

  const secret: StoredSecret = {
    env: input.env,
    user,
    password: input.password,
    clientCode,
    contractHome,
    contractBranch,
    originBranch,
  };
  await saveIntegration({
    workspaceId,
    integrationKey: ANDREANI_INTEGRATION_KEY,
    provider: PROVIDER,
    accountEmail: user,
    accountExternalId: clientCode,
    // No es OAuth: no hay permisos otorgados.
    grantedScopes: [],
    // `saveIntegration` cifra este campo; para Andreani es el JSON de credenciales.
    refreshToken: JSON.stringify(secret),
    connectedByUserId: userId,
  });
  return { testQuoteMinor: prueba.priceMinor };
}

function parseSecret(texto: string): StoredSecret | null {
  try {
    const s = JSON.parse(texto) as Partial<Record<keyof StoredSecret, unknown>>;
    const user = opcional(s.user);
    const password = typeof s.password === "string" && s.password ? s.password : null;
    const clientCode = opcional(s.clientCode);
    const contractHome = opcional(s.contractHome);
    if (esEnv(s.env) && user && password && clientCode && contractHome) {
      return {
        env: s.env,
        user,
        password,
        clientCode,
        contractHome,
        contractBranch: opcional(s.contractBranch),
        originBranch: opcional(s.originBranch),
      };
    }
  } catch {
    // cae al null de abajo
  }
  return null;
}

async function readSecret(workspaceId: string): Promise<StoredSecret | null> {
  const texto = await readRefreshToken(workspaceId, ANDREANI_INTEGRATION_KEY).catch(() => null);
  return texto ? parseSecret(texto) : null;
}

/**
 * El cliente listo para cotizar con los datos de la institución, o `null` si no hay Andreani
 * usable (no conectó, necesita reconexión, o la credencial no se puede descifrar). Nunca
 * lanza por eso: quien cotiza decide el respaldo.
 */
export async function loadAndreaniClient(
  workspaceId: string,
  deps: AndreaniDeps = {},
): Promise<LoadedAndreani | null> {
  const resumen = await getIntegrationSummary(workspaceId, ANDREANI_INTEGRATION_KEY);
  if (!resumen || resumen.status !== "ACTIVE") return null;
  const secret = await readSecret(workspaceId);
  if (!secret) return null;

  const client = createAndreaniClient({ env: secret.env, user: secret.user, password: secret.password, ...deps });
  return {
    client,
    clientCode: secret.clientCode,
    contractHome: secret.contractHome,
    contractBranch: secret.contractBranch,
    originBranch: secret.originBranch,
  };
}

export type AndreaniConnectionInfo = {
  status: "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT";
  connectedAt: Date;
  /** `null` si la credencial no se pudo descifrar. */
  env: AndreaniEnv | null;
  /** Enmascarados: el usuario muestra el comienzo; códigos y contratos, los últimos 4. */
  user: string;
  clientCode: string | null;
  contractHome: string | null;
  contractBranch: string | null;
  /** El código de sucursal es público (sale del listado de sucursales): va entero. */
  originBranch: string | null;
};

/**
 * Para la pantalla de configuración. NUNCA la contraseña, y todo lo demás enmascarado.
 * `null` si la institución no conectó Andreani.
 */
export async function describeAndreaniConnection(workspaceId: string): Promise<AndreaniConnectionInfo | null> {
  const resumen = await getIntegrationSummary(workspaceId, ANDREANI_INTEGRATION_KEY);
  if (!resumen) return null;
  const secret = await readSecret(workspaceId);
  return {
    status: resumen.status,
    connectedAt: resumen.connectedAt,
    env: secret?.env ?? null,
    user: maskAndreaniUser(resumen.accountEmail),
    clientCode: secret ? maskAndreaniCode(secret.clientCode) : null,
    contractHome: secret ? maskAndreaniCode(secret.contractHome) : null,
    contractBranch: secret?.contractBranch ? maskAndreaniCode(secret.contractBranch) : null,
    originBranch: secret?.originBranch ?? null,
  };
}

/**
 * Las credenciales dejaron de valer (Andreani contestó `AUTH`). No se borra la fila: el panel
 * tiene que mostrar que hay que reconectar. Si ya no existe, no hay nada que marcar.
 */
export async function markAndreaniNeedsReconsent(workspaceId: string): Promise<void> {
  await markIntegrationNeedsReconsent(workspaceId, ANDREANI_INTEGRATION_KEY).catch(() => undefined);
}

/** Borra la credencial. No hay nada que revocar del lado de Andreani. */
export async function deleteAndreaniCredentials(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, ANDREANI_INTEGRATION_KEY);
}
