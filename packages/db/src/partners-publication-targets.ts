/**
 * Clientes Prisma remotos para publicación Partners (InfoSpot / CLF).
 * Patrón alineado a clf-write-client: URL explícita, sin exponer al cliente.
 */
import { PrismaClient } from "@prisma/client";
import {
  PUBLICATION_ENV_BY_DB_KEY,
  type PartnerPublicationDatabaseKey,
} from "@repo/partners";

const cache = globalThis as unknown as {
  partnersPubClients?: Partial<Record<PartnerPublicationDatabaseKey, { url: string; client: PrismaClient }>>;
};

function resolveUrl(key: PartnerPublicationDatabaseKey): string | null {
  const envName = PUBLICATION_ENV_BY_DB_KEY[key];
  return process.env[envName]?.trim() || null;
}

export function getPartnersPublicationTargetInfo(key: PartnerPublicationDatabaseKey): {
  configured: boolean;
  envName: string;
  hostMasked: string | null;
} {
  const envName = PUBLICATION_ENV_BY_DB_KEY[key];
  const url = resolveUrl(key);
  if (!url) return { configured: false, envName, hostMasked: null };
  try {
    const u = new URL(url);
    return { configured: true, envName, hostMasked: `${u.hostname.slice(0, 16)}…` };
  } catch {
    return { configured: false, envName, hostMasked: null };
  }
}

export function getPartnersPublicationClient(key: PartnerPublicationDatabaseKey): PrismaClient {
  const url = resolveUrl(key);
  if (!url) {
    throw new Error(
      `DB destino ${key} no configurada. Definí ${PUBLICATION_ENV_BY_DB_KEY[key]} (server-side).`,
    );
  }
  const bag = (cache.partnersPubClients ??= {});
  const hit = bag[key];
  if (hit && hit.url === url) return hit.client;
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  bag[key] = { url, client };
  return client;
}

export async function disconnectPartnersPublicationClients(): Promise<void> {
  const bag = cache.partnersPubClients;
  if (!bag) return;
  await Promise.all(
    Object.values(bag).map(async (entry) => {
      if (entry) await entry.client.$disconnect().catch(() => undefined);
    }),
  );
  cache.partnersPubClients = {};
}
