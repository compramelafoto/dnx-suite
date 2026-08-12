/**
 * Clientes de lectura canónica para selectores welcome (admin Clickatón).
 * Sin fallback silencioso a DATABASE_URL de Clickatón para FR/CLF.
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getPartnersPublicationClient, getPartnersPublicationTargetInfo } from "./partners-publication-targets";

export const WELCOME_CONTEXT_FOTORANK_ENV = "DNX_PARTNERS_FOTORANK_DATABASE_URL";
export const WELCOME_CONTEXT_CLF_ENV = "DNX_PARTNERS_CLF_DATABASE_URL";

export type WelcomeContextDbKey = "CLICKATON" | "FOTORANK" | "CLF";

export type WelcomeContextConnectionInfo = {
  key: WelcomeContextDbKey;
  envName: string;
  configured: boolean;
  hostMasked: string | null;
  fingerprint: string | null;
  reason?: string;
};

function maskAndFingerprint(url: string): {
  hostMasked: string;
  fingerprint: string;
} | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const db = u.pathname.replace(/^\//, "").split("?")[0] || "";
    const hostMasked =
      host.length <= 8 ? `${host[0] ?? "?"}…` : `${host.slice(0, 6)}…${host.slice(-4)}`;
    const fingerprint = createHash("sha256")
      .update(`${host}|${db}`)
      .digest("hex")
      .slice(0, 12);
    return { hostMasked, fingerprint };
  } catch {
    return null;
  }
}

const frCache = globalThis as unknown as {
  welcomeFrClient?: { url: string; client: PrismaClient };
};

export function getWelcomeClickatonConnectionInfo(): WelcomeContextConnectionInfo {
  const envName = "DATABASE_URL";
  const url = process.env.DATABASE_URL?.trim() || null;
  if (!url) {
    return {
      key: "CLICKATON",
      envName,
      configured: false,
      hostMasked: null,
      fingerprint: null,
      reason: "DATABASE_URL no configurada en el admin Clickatón",
    };
  }
  const masked = maskAndFingerprint(url);
  if (!masked) {
    return {
      key: "CLICKATON",
      envName,
      configured: false,
      hostMasked: null,
      fingerprint: null,
      reason: "DATABASE_URL inválida",
    };
  }
  return {
    key: "CLICKATON",
    envName,
    configured: true,
    hostMasked: masked.hostMasked,
    fingerprint: masked.fingerprint,
  };
}

export function getWelcomeFotorankConnectionInfo(): WelcomeContextConnectionInfo {
  const envName = WELCOME_CONTEXT_FOTORANK_ENV;
  const url = process.env[envName]?.trim() || null;
  if (!url) {
    return {
      key: "FOTORANK",
      envName,
      configured: false,
      hostMasked: null,
      fingerprint: null,
      reason: `${envName} no configurada. El selector de concursos no puede usar la DB de Clickatón.`,
    };
  }
  const masked = maskAndFingerprint(url);
  if (!masked) {
    return {
      key: "FOTORANK",
      envName,
      configured: false,
      hostMasked: null,
      fingerprint: null,
      reason: `${envName} inválida`,
    };
  }
  return {
    key: "FOTORANK",
    envName,
    configured: true,
    hostMasked: masked.hostMasked,
    fingerprint: masked.fingerprint,
  };
}

export function getWelcomeClfConnectionInfo(): WelcomeContextConnectionInfo {
  const envName = WELCOME_CONTEXT_CLF_ENV;
  const pub = getPartnersPublicationTargetInfo("CLF");
  if (!pub.configured) {
    return {
      key: "CLF",
      envName,
      configured: false,
      hostMasked: null,
      fingerprint: null,
      reason: `${envName} no configurada. El selector de álbumes no puede usar la DB de Clickatón.`,
    };
  }
  const url = process.env[envName]?.trim() || "";
  const masked = maskAndFingerprint(url);
  return {
    key: "CLF",
    envName,
    configured: true,
    hostMasked: pub.hostMasked ?? masked?.hostMasked ?? null,
    fingerprint: masked?.fingerprint ?? null,
  };
}

export function listWelcomeContextConnectionInfos(): WelcomeContextConnectionInfo[] {
  return [
    getWelcomeClickatonConnectionInfo(),
    getWelcomeFotorankConnectionInfo(),
    getWelcomeClfConnectionInfo(),
  ];
}

/** Cliente Prisma canónico FotoRank (solo lectura administrativa). Fail-closed. */
export function getWelcomeFotorankClient(): PrismaClient {
  const info = getWelcomeFotorankConnectionInfo();
  if (!info.configured) {
    throw new Error(info.reason || `${WELCOME_CONTEXT_FOTORANK_ENV} no disponible`);
  }
  const url = process.env[WELCOME_CONTEXT_FOTORANK_ENV]!.trim();
  const hit = frCache.welcomeFrClient;
  if (hit && hit.url === url) return hit.client;
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  frCache.welcomeFrClient = { url, client };
  return client;
}

/** Cliente Prisma canónico CLF = mismo destino de publicación Partners. Fail-closed. */
export function getWelcomeClfClient(): PrismaClient {
  const info = getWelcomeClfConnectionInfo();
  if (!info.configured) {
    throw new Error(info.reason || `${WELCOME_CONTEXT_CLF_ENV} no disponible`);
  }
  return getPartnersPublicationClient("CLF");
}

export async function disconnectWelcomeContextClients(): Promise<void> {
  if (frCache.welcomeFrClient) {
    await frCache.welcomeFrClient.client.$disconnect().catch(() => undefined);
    frCache.welcomeFrClient = undefined;
  }
}
