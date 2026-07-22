/**
 * Dual-read bridge: FinancialIdentity vault ↔ User.mp* / Lab.mp* legacy.
 * Default mode LEGACY_ONLY — identical to historical CLF behavior.
 * Never logs tokens.
 */
import { prisma } from "@/lib/prisma";
import {
  CredentialVault,
  createPrismaCredentialStore,
  createPrismaDualReadPorts,
  loadFinancialIdentityFlags,
  resolveMercadoPagoAccountForLab,
  resolveMercadoPagoAccountForUser,
  type FinancialEnvironment,
} from "@repo/payments";

function resolveEnvironment(): FinancialEnvironment {
  const raw = process.env.DNX_FINANCIAL_IDENTITY_ENV?.trim().toUpperCase();
  if (raw === "TEST") return "TEST";
  if (raw === "PROD") return "PROD";
  return process.env.NODE_ENV === "production" ? "PROD" : "TEST";
}

function createPorts() {
  const vault = new CredentialVault(createPrismaCredentialStore(prisma as never));
  return createPrismaDualReadPorts({
    prisma: prisma as never,
    vault,
  });
}

export async function resolveUserMpAccessTokenDualRead(userId: number): Promise<{
  accessToken: string | null;
  mpUserId: string | null;
  source: string;
}> {
  const flags = loadFinancialIdentityFlags();
  if (flags.readMode === "LEGACY_ONLY") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mpAccessToken: true, mpUserId: true },
    });
    return {
      accessToken: user?.mpAccessToken ?? null,
      mpUserId: user?.mpUserId ?? null,
      source: "legacy_user",
    };
  }

  try {
    const resolved = await resolveMercadoPagoAccountForUser(createPorts(), {
      userId,
      environment: resolveEnvironment(),
      requiredCapability: "COLLECTOR",
      productKey: "compramelafoto",
      flags,
    });
    if (!resolved.ok) {
      return { accessToken: null, mpUserId: null, source: resolved.source };
    }
    return {
      accessToken: resolved.accessToken,
      mpUserId: resolved.mpUserId,
      source: resolved.source,
    };
  } catch {
    // Fail-safe: never break checkout if FI path errors — fall back to legacy.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mpAccessToken: true, mpUserId: true },
    });
    return {
      accessToken: user?.mpAccessToken ?? null,
      mpUserId: user?.mpUserId ?? null,
      source: "legacy_user_failsafe",
    };
  }
}

export async function resolveLabMpAccessTokenDualRead(labId: number): Promise<{
  accessToken: string | null;
  mpUserId: string | null;
  source: string;
}> {
  const flags = loadFinancialIdentityFlags();
  if (flags.readMode === "LEGACY_ONLY") {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { mpAccessToken: true, mpUserId: true },
    });
    return {
      accessToken: lab?.mpAccessToken ?? null,
      mpUserId: lab?.mpUserId ?? null,
      source: "legacy_lab",
    };
  }

  try {
    const resolved = await resolveMercadoPagoAccountForLab(createPorts(), {
      labId,
      environment: resolveEnvironment(),
      flags,
    });
    if (!resolved.ok) {
      return { accessToken: null, mpUserId: null, source: resolved.source };
    }
    return {
      accessToken: resolved.accessToken,
      mpUserId: resolved.mpUserId,
      source: resolved.source,
    };
  } catch {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { mpAccessToken: true, mpUserId: true },
    });
    return {
      accessToken: lab?.mpAccessToken ?? null,
      mpUserId: lab?.mpUserId ?? null,
      source: "legacy_lab_failsafe",
    };
  }
}
