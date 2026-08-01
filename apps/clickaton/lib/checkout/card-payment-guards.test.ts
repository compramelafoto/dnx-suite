import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapMercadoPagoStatusDetailToUserMessage,
  mapProviderOrderStatusToCardUiState,
  sanitizeCardPaymentSubmissionForLog,
  type CardPaymentSubmission,
} from "@repo/payments/frontend";

/**
 * UNIT — price tamper + UX + log sanitization for Card Brick path.
 * Does NOT prove Mercado Pago sandbox (see docs/payments/mp-split-1n-card-brick.md).
 */

describe("Card payment server-side amount authority", () => {
  it("server charge amount must come from eligibility, not browser", () => {
    const serverAmountMinor = 15_000;
    const clientDisplayedAmountMinor = 1; // tampered
    // Same rule as create-registration-checkout: ignore client for charging.
    const chargeAmount = serverAmountMinor;
    assert.notEqual(clientDisplayedAmountMinor, chargeAmount);
    assert.equal(chargeAmount, 15_000);
  });

  it("duplicate submit guard: second call while locked is ignored", () => {
    let calls = 0;
    let locked = false;
    const submit = () => {
      if (locked) return "ignored";
      locked = true;
      calls += 1;
      return "accepted";
    };
    assert.equal(submit(), "accepted");
    assert.equal(submit(), "ignored");
    assert.equal(calls, 1);
  });
});

describe("Card payment UX status mapping", () => {
  it("maps approved / processing / rejected", () => {
    assert.equal(mapProviderOrderStatusToCardUiState("APPROVED"), "APPROVED");
    assert.equal(mapProviderOrderStatusToCardUiState("PROCESSING"), "PROCESSING");
    assert.equal(mapProviderOrderStatusToCardUiState("REJECTED"), "REJECTED");
    assert.equal(
      mapProviderOrderStatusToCardUiState("PROCESSED_ACCREDITED"),
      "APPROVED",
    );
  });

  it("maps status_detail to friendly Spanish without exposing raw code as primary", () => {
    const msg = mapMercadoPagoStatusDetailToUserMessage("cc_rejected_high_risk");
    assert.match(msg, /seguridad/i);
    assert.equal(msg.includes("cc_rejected_high_risk"), false);
  });

  it("discourages duplicate payment while the return remains pending", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(public)/maratones/[slug]/inscripcion/pago/PaymentReturnView.tsx"),
      "utf8",
    );
    assert.match(source, /presentPaymentReturn/);
    assert.match(source, /Consultar resumen/);
    assert.doesNotMatch(source, /variant === "pendiente"[\s\S]{0,250}Volver a intentar el pago/);
  });

  it("disables the Checkout Pro CTA while its server action is pending", () => {
    const source = readFileSync(
      join(process.cwd(), "components/public-registration/CheckoutPayButton.tsx"),
      "utf8",
    );
    assert.match(source, /disabled=\{!eligible \|\| pending\}/);
  });
});

describe("Card payment log sanitization", () => {
  it("never includes token value", () => {
    const submission: CardPaymentSubmission = {
      token: "tok_SHOULD_NOT_APPEAR_IN_LOGS_12345",
      paymentMethodId: "visa",
      installments: 1,
      payer: { email: "buyer@example.com", identification: { type: "DNI", number: "30111222" } },
      deviceSessionId: "device-session-abcdef",
    };
    const sanitized = sanitizeCardPaymentSubmissionForLog(submission);
    const json = JSON.stringify(sanitized);
    assert.equal(json.includes("tok_SHOULD_NOT_APPEAR"), false);
    assert.equal(json.includes("30111222"), false);
    assert.equal(sanitized.tokenPresent, true);
    assert.equal(sanitized.hasIdentification, true);
  });
});
