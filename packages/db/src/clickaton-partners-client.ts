/**
 * Cliente Prisma de FOTOFFICE hacia la base de Clickatón, CON escritura, pero sólo para
 * DNX Partners. Variable: CLICKATON_PARTNERS_DATABASE_URL
 *
 * Por qué existe: los sponsors de toda la suite viven en un solo lugar, las tablas
 * `DnxPartner*` de la base de Clickatón, que es donde está su panel. Cada institución de
 * FOTOFFICE administra los suyos desde su propio panel, así que FOTOFFICE tiene que poder
 * escribir ahí. Es el mismo caso que el voto del jurado de FotoRank
 * (`clickaton-jury-client.ts`).
 *
 * Se diferencia de ese cliente en que está ACOTADO: el proxy sólo deja usar los modelos
 * `dnxPartner*` y no deja correr SQL crudo. Una conexión que puede escribir sobre las
 * inscripciones, los pagos o las obras de Clickatón no tiene por qué existir para cargar
 * el logo de un sponsor.
 */

import { PrismaClient } from "@prisma/client";

/**
 * Hosts que esta conexión NO debe apuntar nunca.
 *
 * `ep-dawn-dew-adyr8f1v` es la base de FOTOFFICE (y de FotoRank) en producción y
 * `ep-falling-darkness-aduwh0tq` la de CompraMeLaFoto. Las dos tienen tablas `DnxPartner*`
 * vacías o residuales, porque el schema es compartido: si la variable apuntara ahí, la
 * institución cargaría sponsors que nadie más ve, creyendo que están en la base común.
 */
const BLOCKED_HOST_FRAGMENTS = ["ep-dawn-dew-adyr8f1v", "ep-falling-darkness-aduwh0tq"];

const SQL_CRUDO = new Set(["$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe"]);

/** Lo que sí puede tocarse fuera de los modelos: conectar, desconectar y transacciones. */
const METODOS_DE_CLIENTE = new Set(["$connect", "$disconnect", "$transaction", "$on", "then"]);

const globalForClickatonPartners = globalThis as unknown as {
  clickatonPartnersPrisma?: PrismaClient;
};

export type ClickatonPartnersConnectionInfo = {
  configured: boolean;
  /** Host parcialmente oculto: sirve para diagnosticar sin exponer la credencial. */
  hostMasked: string | null;
  reason?: string;
};

function maskHost(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const parts = host.split(".");
    return parts.length >= 2
      ? `${parts[0]!.slice(0, 12)}…${parts.slice(-2).join(".")}`
      : `${host.slice(0, 16)}…`;
  } catch {
    return null;
  }
}

export function getClickatonPartnersConnectionInfo(): ClickatonPartnersConnectionInfo {
  const url = process.env.CLICKATON_PARTNERS_DATABASE_URL?.trim();
  if (!url) {
    return {
      configured: false,
      hostMasked: null,
      reason: "CLICKATON_PARTNERS_DATABASE_URL no está configurada",
    };
  }
  const hostMasked = maskHost(url);
  if (!hostMasked) {
    return { configured: false, hostMasked: null, reason: "CLICKATON_PARTNERS_DATABASE_URL inválida" };
  }
  if (BLOCKED_HOST_FRAGMENTS.some((f) => url.includes(f))) {
    return {
      configured: false,
      hostMasked,
      reason:
        "La URL apunta a la base de FOTOFFICE o de CompraMeLaFoto, no a la de Clickatón, que es donde viven los sponsors.",
    };
  }
  return { configured: true, hostMasked };
}

function bloqueado(nombre: string): never {
  throw new Error(
    `Conexión de DNX Partners: "${nombre}" no está permitido. Sólo los modelos dnxPartner*.`,
  );
}

/**
 * Envuelve un cliente para que sólo se puedan usar los modelos `dnxPartner*`.
 *
 * Exportada para poder probarla sin base. Se aplica también al cliente que recibe el
 * callback de `$transaction`: sin eso, una transacción sería la puerta de atrás.
 */
export function scopeToPartnerModels<T extends object>(client: T): T {
  return new Proxy(client, {
    get(obj, prop, receiver) {
      if (typeof prop === "symbol") return Reflect.get(obj, prop, receiver);
      const key = String(prop);

      if (SQL_CRUDO.has(key)) bloqueado(key);

      if (key === "$transaction") {
        const original = Reflect.get(obj, prop) as (...args: unknown[]) => unknown;
        return (arg: unknown, ...resto: unknown[]) => {
          if (typeof arg === "function") {
            return original.call(
              obj,
              (tx: object) => (arg as (tx: object) => unknown)(scopeToPartnerModels(tx)),
              ...resto,
            );
          }
          // La forma con arreglo recibe promesas ya armadas con este mismo cliente acotado.
          return original.call(obj, arg, ...resto);
        };
      }

      if (key.startsWith("dnxPartner") || METODOS_DE_CLIENTE.has(key)) {
        const value = Reflect.get(obj, prop);
        return typeof value === "function" ? value.bind(obj) : value;
      }

      bloqueado(key);
    },
  });
}

/**
 * Cliente hacia DNX Partners, o `null` si no está configurado.
 *
 * Devuelve `null` en vez de lanzar para que el panel pueda mostrar los sponsors en modo
 * lectura y explicar qué falta, en lugar de romperse entero. Quien lo usa NUNCA debe caer a
 * la base propia para escribir.
 */
export function getClickatonPartnersPrisma(): PrismaClient | null {
  const info = getClickatonPartnersConnectionInfo();
  if (!info.configured) return null;

  if (!globalForClickatonPartners.clickatonPartnersPrisma) {
    globalForClickatonPartners.clickatonPartnersPrisma = scopeToPartnerModels(
      new PrismaClient({
        datasources: { db: { url: process.env.CLICKATON_PARTNERS_DATABASE_URL!.trim() } },
      }),
    );
  }
  return globalForClickatonPartners.clickatonPartnersPrisma;
}
