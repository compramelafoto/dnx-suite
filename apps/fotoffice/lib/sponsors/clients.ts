import "server-only";
import { prisma } from "@repo/db";
import {
  getClickatonPartnersConnectionInfo,
  getClickatonPartnersPrisma,
} from "@repo/db/clickaton-partners-client";

/**
 * Con qué base habla el módulo de sponsors.
 *
 * Los sponsors viven en DNX Partners, en la base de Clickatón. Para escribir hace falta la
 * conexión acotada (`CLICKATON_PARTNERS_DATABASE_URL`); sin ella el módulo queda en modo
 * lectura y NUNCA cae a la base propia de FOTOFFICE, que también tiene tablas `DnxPartner*`
 * (el schema es compartido): escribir ahí crearía sponsors que nadie más ve.
 *
 * Para leer vale la misma regla que en Sorteos: la conexión de escritura si está (así se lee
 * lo recién escrito), si no la de sólo lectura, y si tampoco, la base propia.
 */

export type PartnersDb = typeof prisma;

export function partnersWriter(): PartnersDb | null {
  return getClickatonPartnersPrisma() as PartnersDb | null;
}

export function canWriteSponsors(): boolean {
  return getClickatonPartnersConnectionInfo().configured;
}

/** Por qué no se puede escribir, para el aviso del panel. Null si se puede. */
export function sponsorsWriteBlockedReason(): string | null {
  const info = getClickatonPartnersConnectionInfo();
  return info.configured ? null : (info.reason ?? "Falta la conexión con DNX Partners.");
}

export async function partnersReader(): Promise<PartnersDb> {
  const escritor = partnersWriter();
  if (escritor) return escritor;
  const { getClickatonReadonlyClient, isClickatonReadonlyAvailable } = await import(
    "@repo/db/clickaton-readonly-client"
  );
  if (isClickatonReadonlyAvailable()) return getClickatonReadonlyClient() as unknown as PartnersDb;
  return prisma;
}
