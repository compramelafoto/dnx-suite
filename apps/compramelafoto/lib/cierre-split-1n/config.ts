/**
 * Configuración de la orden productiva de cierre de homologación Split 1:N.
 *
 * Es una operación **puntual, con dinero real**: Mercado Pago pide un Order ID productivo
 * (`live_mode: true`) con owner + 2 partners para cerrar el expediente IXFS-16376.
 *
 * Por qué no se reusa `lib/homologation/mp-split-1n/`: esa superficie se bloquea a propósito
 * cuando `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` está encendida (ver
 * `assert-safe-environment.ts`). Las dos banderas son mutuamente excluyentes por diseño, y
 * está bien que lo sean — la superficie del video nunca debe poder mover dinero real. Así
 * que esto vive aparte, con sus propios frenos.
 *
 * Todo lo comercial se resuelve acá, del lado del servidor. El navegador no elige monto,
 * ni destinatarios, ni porcentajes.
 */

/** Bandera propia. No reusa la de homologación ni la de órdenes productivas. */
export const CIERRE_FLAG = "DNX_CLF_SPLIT_1N_CIERRE_PRODUCCION_ENABLED" as const;

/**
 * Tope duro de seguridad. Un error de tipeo en la variable de monto no puede cobrar más
 * que esto. $5.000 alcanza de sobra para una operación de cierre.
 */
export const MONTO_MAXIMO_CENTAVOS = 500_000;

/**
 * Monto por omisión: $3.450, una foto de $3.000 más el 15 % de la plataforma.
 *
 * Mercado Pago no fija un mínimo para esta operación de cierre; el mínimo que puede
 * aplicar es el del medio de pago (Marilyn Urrego, 2026-10-30). Lo que conviene mirar no
 * es el total sino **la porción más chica del reparto**: con $3.450, a la plataforma le
 * tocan unos $225, lo mismo que a la referidora. Un total más chico dejaría esas partes en
 * cifras donde la comisión de Mercado Pago y los mínimos del medio de pago empiezan a pesar.
 */
export const MONTO_POR_OMISION_CENTAVOS = 345_000;

export const TOKEN_ENV_CANDIDATES = [
  "DNX_MP_PLATFORM_ACCESS_TOKEN",
  "MP_ACCESS_TOKEN",
  "MERCADOPAGO_ACCESS_TOKEN",
] as const;

export type CierreConfig = {
  accessToken: string;
  tokenSource: string;
  publicKey: string;
  ownerUserId: string;
  receiverA: string;
  receiverB: string;
  totalMinor: bigint;
  payerEmailOverride: string | null;
};

export type CierreConfigError = {
  code:
    | "FLAG_APAGADA"
    | "ENTORNO_DESPLEGADO"
    | "SIN_TOKEN"
    | "TOKEN_DE_PRUEBA"
    | "SIN_PUBLIC_KEY"
    | "SIN_OWNER"
    | "SIN_RECEPTORES"
    | "RECEPTORES_REPETIDOS"
    | "MONTO_INVALIDO"
    | "MONTO_SOBRE_TOPE";
  message: string;
};

function esVerdadero(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Resuelve la configuración o explica qué falta.
 *
 * El freno de `VERCEL_ENV === "production"` es deliberado: esta pantalla está pensada para
 * correr **en local** contra credenciales productivas. Desplegar una superficie que mueve
 * dinero real, aunque esté detrás de una bandera, agrega exposición que esta operación no
 * necesita.
 */
export function resolveCierreConfig(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; config: CierreConfig } | { ok: false; error: CierreConfigError } {
  const fail = (code: CierreConfigError["code"], message: string) =>
    ({ ok: false as const, error: { code, message } });

  if (!esVerdadero(env[CIERRE_FLAG])) {
    return fail("FLAG_APAGADA", `${CIERRE_FLAG} no está encendida.`);
  }

  if ((env.VERCEL_ENV ?? "").trim().toLowerCase() === "production") {
    return fail(
      "ENTORNO_DESPLEGADO",
      "La orden de cierre se crea desde local, no desde el sitio desplegado.",
    );
  }

  let accessToken = "";
  let tokenSource = "";
  for (const name of TOKEN_ENV_CANDIDATES) {
    const value = env[name]?.trim();
    if (!value) continue;
    if (value.startsWith("TEST-")) {
      return fail(
        "TOKEN_DE_PRUEBA",
        `${name} es un token de prueba (TEST-). La orden de cierre necesita el token productivo.`,
      );
    }
    accessToken = value;
    tokenSource = name;
    break;
  }
  if (!accessToken) {
    return fail(
      "SIN_TOKEN",
      `Falta el token productivo de la plataforma: ${TOKEN_ENV_CANDIDATES.join(", ")}`,
    );
  }

  const publicKey =
    env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ||
    env.MP_PUBLIC_KEY?.trim() ||
    "";
  if (!publicKey) {
    return fail("SIN_PUBLIC_KEY", "Falta NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY productiva.");
  }

  const ownerUserId = env.DNX_CLF_SPLIT_1N_CIERRE_OWNER_USER_ID?.trim() ?? "";
  if (!ownerUserId) {
    return fail(
      "SIN_OWNER",
      "Falta DNX_CLF_SPLIT_1N_CIERRE_OWNER_USER_ID (el user_id de Mercado Pago de la cuenta cobradora).",
    );
  }

  const receiverA = env.DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_A?.trim() ?? "";
  const receiverB = env.DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_B?.trim() ?? "";
  if (!receiverA || !receiverB) {
    return fail(
      "SIN_RECEPTORES",
      "Faltan los receiver_id de los dos partners (DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_A y _B). Los devuelve prod-split-consent-invite.",
    );
  }
  if (receiverA === receiverB) {
    return fail(
      "RECEPTORES_REPETIDOS",
      "Los dos receiver_id son iguales. Mercado Pago pide 3 receptores distintos.",
    );
  }

  const montoRaw = env.DNX_CLF_SPLIT_1N_CIERRE_MONTO_CENTAVOS?.trim();
  let totalMinor = MONTO_POR_OMISION_CENTAVOS;
  if (montoRaw) {
    const parsed = Number(montoRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fail(
        "MONTO_INVALIDO",
        "DNX_CLF_SPLIT_1N_CIERRE_MONTO_CENTAVOS debe ser un entero de centavos positivo.",
      );
    }
    totalMinor = parsed;
  }
  if (totalMinor > MONTO_MAXIMO_CENTAVOS) {
    return fail(
      "MONTO_SOBRE_TOPE",
      `El monto supera el tope de seguridad ($${MONTO_MAXIMO_CENTAVOS / 100}). Revisá la variable.`,
    );
  }

  return {
    ok: true,
    config: {
      accessToken,
      tokenSource,
      publicKey,
      ownerUserId,
      receiverA,
      receiverB,
      totalMinor: BigInt(totalMinor),
      payerEmailOverride:
        env.DNX_CLF_SPLIT_1N_CIERRE_PAYER_EMAIL?.trim().toLowerCase() || null,
    },
  };
}

/**
 * Reparto del cierre, con la forma de una venta de CLF con referido: el fotógrafo cobra el
 * precio de la foto entero, y el 15 % que la plataforma recarga sobre el precio se reparte
 * mitad para la plataforma y mitad para quien refirió al fotógrafo (7,5 % y 7,5 %), como el
 * programa de referidos de fotógrafos (`REFERRAL_PROGRAM_FEE_SHARE`).
 *
 * Mercado Pago reparte sobre el total que paga el comprador, no sobre el precio: el precio
 * es 100/115 ≈ 86,96 % del total, y cada 7,5 % del precio ≈ 6,52 %. En puntos básicos sobre
 * 10.000.
 */
export const REPARTO_BPS = {
  owner: 652,
  fotografo: 8_696,
  referidor: 652,
} as const;

/**
 * ¿Quien paga también recibe parte del reparto?
 *
 * Mercado Pago pide para esta validación un tercero con tarjeta propia, distinto de los
 * receptores (Marilyn Urrego, 2026-10-30). Tiene sentido más allá del trámite: alguien
 * pagándose a sí mismo no demuestra nada sobre el reparto, y el antifraude lo rechaza.
 *
 * Los correos de los receptores no salen de nuestra base: salen de consultar el
 * consentimiento a Mercado Pago, que es la única fuente que sabe a qué cuenta pertenecen.
 */
export function pagadorTambienRecibe(
  payerEmail: string,
  correosReceptores: readonly string[],
): boolean {
  const pagador = payerEmail.trim().toLowerCase();
  if (!pagador) return false;
  return correosReceptores.some((c) => c.trim().toLowerCase() === pagador);
}
