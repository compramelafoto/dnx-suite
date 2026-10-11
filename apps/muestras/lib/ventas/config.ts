import "server-only";
import { canBuy, salesMode, type SalesMode } from "@repo/muestras";
import { isSandboxAccessToken } from "@repo/payments/mercado-pago";

/**
 * Configuración de la venta (etapa 8, spec D1–D3). Es el ÚNICO lugar que lee las variables de la
 * venta: el resto de la app pide el modo con `leerConfigDeVentas` (sólo nombres, nunca valores) y
 * las credenciales con `credencialesDeVentas` (servidor, nunca a la pantalla ni a un log).
 *
 * El modo se calcula en cada pedido y nunca se guarda.
 */

/** Sin estas, la venta queda apagada (D3). */
export const VARIABLES_OBLIGATORIAS = [
  "MUESTRAS_MP_ENV",
  "MUESTRAS_MP_ACCESS_TOKEN",
  "MUESTRAS_MP_PUBLIC_KEY",
  "MUESTRAS_MP_OWNER_USER_ID",
  "MUESTRAS_PEDIDOS_SECRET",
  "MUESTRAS_CERT_PRIVATE_KEY",
  "MUESTRAS_CERT_KEY_ID",
  "MUESTRAS_R2_PRIVATE_BUCKET",
] as const;

type Entorno = NodeJS.ProcessEnv | Record<string, string | undefined>;

const valor = (env: Entorno, nombre: string): string | null => {
  const v = env[nombre]?.trim();
  return v ? v : null;
};

/** Mismo criterio que las llaves de `@repo/payments`: 1, true, yes u on. */
const encendida = (env: Entorno, nombre: string): boolean => ["1", "true", "yes", "on"].includes((env[nombre] ?? "").trim().toLowerCase());

function ambiente(env: Entorno): "sandbox" | "production" | null {
  const v = valor(env, "MUESTRAS_MP_ENV");
  return v === "sandbox" || v === "production" ? v : null;
}

export type ConfigDeVentas = {
  modo: SalesMode;
  /** Por qué está apagada (para el panel), o null. */
  motivo: string | null;
  /** Nombres de las variables obligatorias que faltan. */
  faltan: string[];
  mpEnv: "sandbox" | "production" | null;
  /** Ambiente de las cuentas de cobro (`CulturalPayoutAccount.environment`). */
  ambienteCuenta: "SANDBOX" | "PRODUCTION";
  /** Ids de usuario que compran en modo prueba (además del super admin). */
  probadores: Set<number>;
  /** `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`: se pueden pedir consentimientos en producción. */
  consentimientoProduccion: boolean;
  /** Optativas: el panel avisa si faltan (el barrido y la página del pedido concilian igual). */
  avisoConfigurado: boolean;
  cronConfigurado: boolean;
};

export function leerConfigDeVentas(env: Entorno = process.env): ConfigDeVentas {
  const mpEnv = ambiente(env);
  const faltan: string[] = VARIABLES_OBLIGATORIAS.filter((n) => (n === "MUESTRAS_MP_ENV" ? mpEnv == null : valor(env, n) == null));
  const token = valor(env, "MUESTRAS_MP_ACCESS_TOKEN");
  // Mercado Pago da tokens de prueba con forma `TEST-` o `APP_USR-` (usuarios de prueba), y los reales
  // son `APP_USR-`: en sandbox se acepta cualquiera de las dos; en producción, uno `TEST-` no corresponde.
  const tokenEsDePrueba = token == null || mpEnv == null ? null : mpEnv === "sandbox" ? isSandboxAccessToken(token) : token.startsWith("TEST-");
  const { mode, motivo } = salesMode({
    ventasEnVivo: encendida(env, "MUESTRAS_VENTAS_EN_VIVO"),
    ordersProduccion: encendida(env, "DNX_MP_ORDERS_1N_PRODUCTION_ENABLED"),
    mpEnv,
    tokenEsDePrueba,
    faltan,
  });
  const probadores = new Set(
    (valor(env, "MUESTRAS_VENTAS_PROBADORES") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d{1,9}$/.test(x))
      .map(Number),
  );
  return {
    modo: mode,
    motivo,
    faltan,
    mpEnv,
    ambienteCuenta: mpEnv === "production" ? "PRODUCTION" : "SANDBOX",
    probadores,
    consentimientoProduccion: encendida(env, "DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED"),
    avisoConfigurado: valor(env, "MUESTRAS_AVISO_PAGOS_SECRET") != null,
    cronConfigurado: valor(env, "CRON_SECRET") != null,
  };
}

/** En vivo compran todos; en prueba, el super admin y los probadores; apagada, nadie. */
export function puedeComprar(usuario: { id: number; esSuperAdmin: boolean } | null, config: ConfigDeVentas = leerConfigDeVentas()): boolean {
  return canBuy(config.modo, { esSuperAdmin: usuario?.esSuperAdmin ?? false, esProbador: usuario != null && config.probadores.has(usuario.id) });
}

export type CredencialesDeVentas = {
  accessToken: string | null;
  publicKey: string | null;
  ownerUserId: string | null;
  pedidosSecret: string | null;
  /** PKCS8 PEM en base64. */
  certPrivateKey: string | null;
  certKeyId: string | null;
  /** `{ kid: pem }` de claves públicas anteriores (rotación), o vacío. */
  certOldPublicKeys: Record<string, string>;
  privateBucket: string | null;
  avisoSecret: string | null;
};

/** Claves anteriores: JSON `{ "mf-2026-10": "-----BEGIN PUBLIC KEY-----…" }`. Lo que no se entiende, se ignora. */
function clavesViejas(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const x: unknown = JSON.parse(raw);
    if (typeof x !== "object" || x === null || Array.isArray(x)) return {};
    return Object.fromEntries(Object.entries(x).filter((e): e is [string, string] => typeof e[1] === "string" && e[0].length <= 64));
  } catch {
    return {};
  }
}

/** Credenciales de la venta. Sólo del servidor: nunca se mandan a la pantalla ni se registran. */
export function credencialesDeVentas(env: Entorno = process.env): CredencialesDeVentas {
  return {
    accessToken: valor(env, "MUESTRAS_MP_ACCESS_TOKEN"),
    publicKey: valor(env, "MUESTRAS_MP_PUBLIC_KEY"),
    ownerUserId: valor(env, "MUESTRAS_MP_OWNER_USER_ID"),
    pedidosSecret: valor(env, "MUESTRAS_PEDIDOS_SECRET"),
    certPrivateKey: valor(env, "MUESTRAS_CERT_PRIVATE_KEY"),
    certKeyId: valor(env, "MUESTRAS_CERT_KEY_ID"),
    certOldPublicKeys: clavesViejas(valor(env, "MUESTRAS_CERT_OLD_PUBLIC_KEYS")),
    privateBucket: valor(env, "MUESTRAS_R2_PRIVATE_BUCKET"),
    avisoSecret: valor(env, "MUESTRAS_AVISO_PAGOS_SECRET"),
  };
}
