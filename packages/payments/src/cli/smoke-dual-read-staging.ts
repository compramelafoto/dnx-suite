#!/usr/bin/env node
/**
 * Staging dual-read smoke (no real payments).
 * Uses Prisma + vault against ep-divine-smoke* / clickaton_staging.
 *
 * Never prints tokens.
 */
import { PrismaClient } from "@prisma/client";
import { CredentialVault, sanitizeMpUserId } from "../credential-vault/index.js";
import { createPrismaCredentialStore } from "../infrastructure/prisma/credential-store.js";
import { createPrismaDualReadPorts } from "../infrastructure/prisma/financial-identity-ports.js";
import { resolveMercadoPagoAccountForUser } from "../dual-read/resolve-mercado-pago-account.js";
import type { FinancialIdentityFlags } from "../dual-read/flags.js";
import { assertFinancialIdentityStagingHost } from "./staging-host-gate.js";
import { disablePaymentAccountRemote } from "../infrastructure/prisma/legacy-mp-backfill-remote.js";

function flags(mode: FinancialIdentityFlags["readMode"]): FinancialIdentityFlags {
  return {
    readMode: mode,
    writeEnabled: false,
    backfillEnabled: false,
  };
}

async function main(): Promise<void> {
  const gate = assertFinancialIdentityStagingHost();
  if (!process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST) {
    throw new Error("VAULT_BLOCKED: DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST required");
  }

  const migratedUserId = Number(process.env.DNX_D4_MIGRATED_USER_ID || "0");
  const fallbackUserId = Number(process.env.DNX_D4_FALLBACK_USER_ID || "0");
  const conflictAccountId = process.env.DNX_D4_CONFLICT_ACCOUNT_ID || "";
  const rollbackAccountId = process.env.DNX_D4_ROLLBACK_ACCOUNT_ID || "";
  const phaseArg = process.argv.find((a) => a.startsWith("--phase="));
  const phase = phaseArg?.slice("--phase=".length) || "all";

  const prisma = new PrismaClient();
  const vault = new CredentialVault(
    createPrismaCredentialStore(
      prisma as unknown as import("../infrastructure/prisma/credential-store.js").EncryptedCredentialPrismaDelegate,
    ),
  );
  const ports = createPrismaDualReadPorts({
    prisma: prisma as never,
    vault,
  });

  const out: Record<string, unknown> = {
    hostPrefix: gate.host.slice(0, 28),
    database: gate.database,
  };

  try {
    if (phase === "legacy" || phase === "all") {
      if (!migratedUserId) throw new Error("DNX_D4_MIGRATED_USER_ID required");
      const legacy = await resolveMercadoPagoAccountForUser(ports, {
        userId: migratedUserId,
        environment: "TEST",
        flags: flags("LEGACY_ONLY"),
      });
      out.legacy = {
        ok: legacy.ok,
        source: legacy.source,
        code: legacy.ok ? null : legacy.code,
        usedLegacyFallback: legacy.ok ? legacy.usedLegacyFallback : null,
        mpUserIdSanitized: legacy.ok
          ? sanitizeMpUserId(legacy.mpUserId)
          : null,
      };
    }

    if (phase === "prefer" || phase === "all") {
      if (!migratedUserId) throw new Error("DNX_D4_MIGRATED_USER_ID required");
      const prefer = await resolveMercadoPagoAccountForUser(ports, {
        userId: migratedUserId,
        environment: "TEST",
        flags: flags("PREFER_FINANCIAL_IDENTITY"),
      });
      out.prefer = {
        ok: prefer.ok,
        source: prefer.source,
        code: prefer.ok ? null : prefer.code,
        usedLegacyFallback: prefer.ok ? prefer.usedLegacyFallback : null,
        mpUserIdSanitized: prefer.ok
          ? sanitizeMpUserId(prefer.mpUserId)
          : null,
        paymentAccountIdPrefix:
          prefer.ok && prefer.paymentAccountId
            ? `${prefer.paymentAccountId.slice(0, 10)}*`
            : null,
      };
    }

    if (phase === "fallback" || phase === "all") {
      if (!fallbackUserId) throw new Error("DNX_D4_FALLBACK_USER_ID required");
      const fallback = await resolveMercadoPagoAccountForUser(ports, {
        userId: fallbackUserId,
        environment: "TEST",
        flags: flags("PREFER_FINANCIAL_IDENTITY"),
      });
      out.fallback = {
        ok: fallback.ok,
        source: fallback.source,
        code: fallback.ok ? null : fallback.code,
        usedLegacyFallback: fallback.ok ? fallback.usedLegacyFallback : false,
      };
    }

    if (phase === "conflict" || phase === "all") {
      if (!migratedUserId || !conflictAccountId) {
        out.conflict = { skipped: true, reason: "missing_conflict_fixture_ids" };
      } else {
        const before = await prisma.dnxPaymentAccount.findUnique({
          where: { id: conflictAccountId },
          select: { providerUserId: true },
        });
        if (!before?.providerUserId) {
          out.conflict = { skipped: true, reason: "account_missing" };
        } else {
          await prisma.dnxPaymentAccount.update({
            where: { id: conflictAccountId },
            data: { providerUserId: "TEST_CONFLICT_DIVERGENT_ID" },
          });
          const conflict = await resolveMercadoPagoAccountForUser(ports, {
            userId: migratedUserId,
            environment: "TEST",
            flags: flags("PREFER_FINANCIAL_IDENTITY"),
          });
          await prisma.dnxPaymentAccount.update({
            where: { id: conflictAccountId },
            data: { providerUserId: before.providerUserId },
          });
          out.conflict = {
            ok: conflict.ok,
            code: conflict.ok ? null : conflict.code,
            source: conflict.source,
            blocked: !conflict.ok && conflict.code === "CONFLICT",
          };
        }
      }
    }

    if (phase === "rollback-account") {
      if (!rollbackAccountId) {
        throw new Error("DNX_D4_ROLLBACK_ACCOUNT_ID required");
      }
      await disablePaymentAccountRemote(
        prisma as never,
        rollbackAccountId,
        migratedUserId || null,
        "d4_smoke_rollback_account",
      );
      out.rollbackAccount = {
        accountIdPrefix: `${rollbackAccountId.slice(0, 10)}*`,
        status: "DISABLED",
      };
    }

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown_error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
