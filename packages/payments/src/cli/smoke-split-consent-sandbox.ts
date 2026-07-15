/**
 * One-shot sandbox Split Consent smoke. Never prints secrets / full IDs / emails.
 * Run: pnpm --filter @repo/payments exec tsx src/cli/smoke-split-consent-sandbox.ts -- --confirm
 */
import { resolve } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  loadSandboxEnvFromProcess,
  runSandboxPreflight,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoSplitConsentAdapter,
} from "../index.js";

function redactEmail(email: string): string {
  const [u, d] = email.split("@");
  return `${(u ?? "").slice(0, 8)}…@${d ?? "?"}`;
}

function redactId(id: string): string {
  return id.length <= 8 ? "[short]" : `${id.slice(0, 8)}…`;
}

function sanitizeMessage(msg: string): string {
  return msg
    .replace(/APP_USR-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/TEST-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "[UUID]",
    )
    .replace(/TESTUSER[A-Za-z0-9]+@testuser\.com/gi, "[EMAIL]");
}

async function main(): Promise<void> {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run") || !confirm;
  const repoRoot = resolve(process.cwd(), "../..");
  const envInput = loadSandboxEnvFromProcess(process.env, { cwd: repoRoot });
  const pre = runSandboxPreflight({ ...envInput, dryRun, confirm });

  if (pre.status !== "READY") {
    console.log(
      JSON.stringify(
        {
          step: "preflight",
          status: pre.status,
          hints: pre.hints,
          credentialAudit: pre.credentialAudit,
        },
        null,
        2,
      ),
    );
    process.exitCode = 3;
    return;
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          step: "split_consent_smoke",
          status: "DRY_RUN_ONLY",
          message: "Re-run with --confirm to POST /v1/split-consent",
        },
        null,
        2,
      ),
    );
    return;
  }

  const token = envInput.accessToken!;
  const partnerEmail = envInput.partnerEmail!;
  const config = createMercadoPagoProviderConfig({
    environment: "sandbox",
    accessToken: token,
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });
  const idempotencyKey = crypto.randomUUID();
  const correlationId = crypto.randomUUID();

  const report: Record<string, unknown> = {
    step: "split_consent_smoke",
    correlationIdPrefix: correlationId.slice(0, 8),
    environment: "sandbox",
    xTestToken: true,
    forceStatus: "ACTIVE",
    partnerEmailRedacted: redactEmail(partnerEmail),
    idempotencyKeyPrefix: idempotencyKey.slice(0, 8),
  };

  try {
    // If consent already exists, list ACTIVE and reuse.
    const existing = await adapter.list({ environment: "sandbox", status: "ACTIVE" });
    const match = existing.find(
      (c) => c.sellerEmail.toLowerCase() === partnerEmail.toLowerCase(),
    );

    let receiverId: string | undefined;
    let status: string | undefined;

    if (match?.receiverId) {
      report.create = {
        mode: "REUSED_EXISTING_ACTIVE",
        status: match.status,
        receiverIdPrefix: redactId(match.receiverId),
        succeeded: match.status === "ACTIVE",
      };
      receiverId = match.receiverId;
      status = match.status;
    } else {
      const created = await adapter.invite({
        environment: "sandbox",
        sellerEmails: [partnerEmail],
        idempotencyKey,
        forceStatus: "ACTIVE",
      });
      const first = created[0];
      report.create = {
        mode: "CREATED",
        count: created.length,
        status: first?.status ?? null,
        receiverIdPrefix: first ? redactId(first.receiverId) : null,
        hasInviteUrl: Boolean(first?.inviteUrl),
        succeeded: Boolean(first?.receiverId && first.status === "ACTIVE"),
      };
      receiverId = first?.receiverId;
      status = first?.status;

      const replay = await adapter.invite({
        environment: "sandbox",
        sellerEmails: [partnerEmail],
        idempotencyKey,
        forceStatus: "ACTIVE",
      });
      report.idempotencyReplay = {
        count: replay.length,
        sameReceiver: Boolean(
          first && replay[0] && first.receiverId === replay[0].receiverId,
        ),
        status: replay[0]?.status ?? null,
      };
    }

    if (receiverId) {
      const fetched = await adapter.getConsent(receiverId);
      report.getConsent = {
        found: Boolean(fetched),
        status: fetched?.status ?? null,
        receiverMatches: fetched?.receiverId === receiverId,
        emailMatches:
          fetched?.sellerEmail?.toLowerCase() === partnerEmail.toLowerCase(),
      };

      const envPath = resolve(repoRoot, "services/dnx-mcp/.env.local");
      if (existsSync(envPath)) {
        let text = readFileSync(envPath, "utf8");
        const line = `MERCADOPAGO_TEST_PARTNER_RECEIVER_ID=${receiverId}`;
        if (/^MERCADOPAGO_TEST_PARTNER_RECEIVER_ID=/m.test(text)) {
          text = text.replace(/^MERCADOPAGO_TEST_PARTNER_RECEIVER_ID=.*$/m, line);
        } else {
          text = `${text.trimEnd()}\n${line}\n`;
        }
        writeFileSync(envPath, text);
        report.persistedReceiverEnv = true;
      }
    }

    report.overall =
      status === "ACTIVE" && receiverId ? "CONSENT_ACTIVE_OK" : "CONSENT_UNEXPECTED";
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.overall === "CONSENT_ACTIVE_OK" ? 0 : 1;
  } catch (err: unknown) {
    const e = err as { message?: string; name?: string; code?: string };
    console.log(
      JSON.stringify(
        {
          step: "split_consent_smoke",
          status: "FAILED",
          errorCode: e.code ?? e.name ?? "ERROR",
          errorMessageSanitized: sanitizeMessage(String(e.message ?? err)),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      status: "FAILED",
      error: sanitizeMessage(err instanceof Error ? err.message : String(err)),
    }),
  );
  process.exitCode = 1;
});
