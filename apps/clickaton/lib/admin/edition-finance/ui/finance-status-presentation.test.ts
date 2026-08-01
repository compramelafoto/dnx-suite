import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  containsForbiddenFinanceOpsJargon,
  looksLikeSensitiveFinanceText,
  presentEditionFinanceOverall,
  presentFinanceGateBlocker,
  presentMpConnectionStatus,
  presentPaymentEnvironment,
  presentReconciliationDiagnostics,
  presentWebhookReadiness,
  sanitizeFinanceErrorText,
} from "./finance-status-presentation";

const ROOT = join(process.cwd());

const baseReadiness = {
  distributionStatus: "ACTIVE" as const,
  sumOk: true,
  beneficiaryLabel: "Tammy 100%",
  paymentAccountConnected: true,
  oauthLikelyValid: true,
  accountMode: "LIVE",
  checkoutAllocationsReady: true,
  webhookReady: true,
};

describe("presentEditionFinanceOverall", () => {
  it("marks ready when gate and readiness allow payments", () => {
    const p = presentEditionFinanceOverall({
      readiness: baseReadiness,
      gate: { ok: true, mode: "LIVE", blockers: [], warnings: [] },
    });
    assert.equal(p.key, "ready");
    assert.equal(p.isReadyForPayments, true);
    assert.equal(looksLikeRawStatusEnum(p.label), false);
  });

  it("asks to connect Mercado Pago when account missing", () => {
    const p = presentEditionFinanceOverall({
      readiness: { ...baseReadiness, paymentAccountConnected: false },
      gate: { ok: false, mode: "LIVE", blockers: ["x"], warnings: [] },
    });
    assert.equal(p.key, "needs_mp");
    assert.match(p.label, /Mercado Pago/i);
    assert.equal(p.isReadyForPayments, false);
  });

  it("flags test-only configuration", () => {
    const p = presentEditionFinanceOverall({
      readiness: { ...baseReadiness, accountMode: "TEST" },
      gate: { ok: true, mode: "TEST", blockers: [], warnings: [] },
    });
    assert.equal(p.key, "test_only");
    assert.match(p.label, /prueba/i);
  });
});

describe("presentMpConnectionStatus", () => {
  it("never returns raw enums as labels", () => {
    for (const status of [
      "NOT_CONNECTED",
      "OAUTH_PENDING",
      "ACTIVE",
      "EXPIRED",
      "NEEDS_REAUTH",
      "REVOKED",
      "ERROR",
    ]) {
      const p = presentMpConnectionStatus(status);
      assert.equal(looksLikeRawStatusEnum(p.label), false, status);
      assert.equal(containsForbiddenFinanceOpsJargon(p.label), false, status);
    }
  });
});

describe("presentFinanceGateBlocker / webhook / recon", () => {
  it("translates webhook blockers", () => {
    const p = presentFinanceGateBlocker(
      "Webhook LIVE de Mercado Pago / DNX Payments no configurado.",
    );
    assert.match(p.label, /actualizaciones/i);
    assert.equal(containsForbiddenFinanceOpsJargon(p.label), false);
  });

  it("presents webhook readiness without jargon", () => {
    const bad = presentWebhookReadiness(false);
    assert.match(bad.label, /actualizaciones/i);
    assert.doesNotMatch(bad.label, /webhook/i);
  });

  it("presents reconciliation diagnostics in Spanish", () => {
    assert.equal(
      presentReconciliationDiagnostics({
        pendingPaymentOrders: 0,
        recentErrors: 0,
        lastRunAt: "2026-01-01",
      }).label,
      "Sin diferencias",
    );
    assert.match(
      presentReconciliationDiagnostics({
        pendingPaymentOrders: 2,
        recentErrors: 0,
        lastRunAt: "2026-01-01",
      }).description,
      /procesados o verificados/i,
    );
  });
});

describe("sensitive data guards", () => {
  it("detects and sanitizes secrets", () => {
    assert.equal(looksLikeSensitiveFinanceText("access_token=abc"), true);
    assert.equal(
      sanitizeFinanceErrorText("refresh_token leaked here"),
      "Hay un detalle técnico disponible para soporte (sin secretos en pantalla).",
    );
  });
});

describe("environment labels", () => {
  it("differentiates test and live", () => {
    assert.equal(presentPaymentEnvironment("TEST").label, "Entorno de prueba");
    assert.equal(presentPaymentEnvironment("LIVE").label, "Pagos reales");
  });
});

describe("finance UI source contracts", () => {
  it("edition finance page uses human finance presentation", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/finanzas/page.tsx"),
      "utf8",
    );
    assert.match(page, /presentEditionFinanceOverall/);
    assert.match(page, /Cuenta que recibirá los pagos/);
    assert.match(page, /Distribución de los pagos/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.match(page, /Publicar distribución/);
    assert.doesNotMatch(page, /\bOAuth\b/);
    assert.doesNotMatch(page, /\bPKCE\b/);
    assert.doesNotMatch(page, /\bcollector\b/i);
    assert.doesNotMatch(page, /Split 1:N/i);
    assert.doesNotMatch(page, /Ledger completo/);
    assert.doesNotMatch(page, /Webhook:/);
  });

  it("owner panel hides OAuth/PKCE from operational surface", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/finanzas/cuenta-owner/page.tsx"),
      "utf8",
    );
    assert.match(page, /Cuenta que recibirá los pagos/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.doesNotMatch(page, /Estado OAuth/);
    assert.doesNotMatch(page, /PKCE en authorize/);
    assert.doesNotMatch(page, /Reconectar la cuenta collector/);
  });

  it("owner panel renders an enabled-flag empty state instead of a soft 404", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/finanzas/cuenta-owner/page.tsx"),
      "utf8",
    );
    assert.match(page, /Panel de cuenta receptora no habilitado/);
    assert.match(page, /habilite la función de incorporación/i);
    assert.match(page, /adminRoutes\.financePartner/);
    assert.match(page, /\/admin\/integraciones\/diagnostico/);
    assert.doesNotMatch(page, /notFound\(\)/);
  });

  it("connect actions use concrete verbs and confirm disconnect", () => {
    const owner = readFileSync(
      join(ROOT, "components/admin/OwnerMpConnectActions.tsx"),
      "utf8",
    );
    assert.match(owner, /Conectar Mercado Pago/);
    assert.match(owner, /Volver a conectar/);
    assert.match(owner, /Desconectar cuenta/);
    assert.match(owner, /window\.confirm/);
    assert.doesNotMatch(owner, /consentimiento OAuth/);
    assert.doesNotMatch(owner, /\bPKCE\b/);

    const partner = readFileSync(
      join(ROOT, "components/admin/PartnerMpConnectActions.tsx"),
      "utf8",
    );
    assert.match(partner, /Conectar Mercado Pago/);
    assert.match(partner, /window\.confirm/);
  });

  it("distribution editor avoids recipient/ACTIVE jargon", () => {
    const editor = readFileSync(
      join(ROOT, "components/admin/EditionDistributionEditor.tsx"),
      "utf8",
    );
    assert.match(editor, /Cuenta receptora/);
    assert.match(editor, /Guardar configuración/);
    assert.match(editor, /debe sumar 100/);
    assert.doesNotMatch(editor, />Recipient</);
    assert.doesNotMatch(editor, /Guardar DRAFT/);
    assert.doesNotMatch(editor, /Agregar recipient/);
  });

  it("diagnostics translates reconciliation and keeps technical block", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/integraciones/diagnostico/page.tsx"),
      "utf8",
    );
    assert.match(page, /Verificación de pagos/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.doesNotMatch(page, />Mercado Pago OAuth</);
    assert.doesNotMatch(page, />Reconciliación de pagos</);
  });
});
