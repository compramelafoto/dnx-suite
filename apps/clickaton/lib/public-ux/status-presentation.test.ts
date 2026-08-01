import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeRawStatusEnum,
  presentParticipantRegistration,
  presentPaymentReturn,
  presentPaymentStatus,
  presentRegistrationStatus,
  presentWelcomeCardStatus,
} from "./status-presentation";
import {
  isUnsafePublicErrorText,
  PUBLIC_CHECKOUT_FORBIDDEN_TERMS,
  publicCheckoutError,
} from "./public-errors";

describe("presentRegistrationStatus", () => {
  it("never returns raw enums as labels", () => {
    const statuses = [
      "DRAFT",
      "PENDING_PAYMENT",
      "CONFIRMED",
      "WAITLISTED",
      "CANCELLED",
      "REFUNDED",
      "DISQUALIFIED",
      "TRANSFERRED_TO_NEXT_EDITION",
      "EXPIRED",
      "REFUND_REQUESTED",
    ] as const;
    for (const status of statuses) {
      const p = presentRegistrationStatus(status);
      assert.equal(looksLikeRawStatusEnum(p.label), false, status);
      assert.ok(p.description.length > 10);
    }
  });
});

describe("presentPaymentStatus", () => {
  it("maps processing with no-retry guidance", () => {
    const p = presentPaymentStatus("PROCESSING");
    assert.match(p.label, /verificando|procesando/i);
    assert.match(p.description + (p.nextAction ?? ""), /no .*pagar|no necesitás pagar/i);
  });

  it("never returns raw enums as labels", () => {
    for (const status of [
      "PENDING",
      "APPROVED",
      "FAILED",
      "EXPIRED",
      "CANCELLED",
      "MANUAL_REVIEW",
    ] as const) {
      const p = presentPaymentStatus(status);
      assert.equal(looksLikeRawStatusEnum(p.label), false, status);
    }
  });
});

describe("presentParticipantRegistration", () => {
  it("presents confirmed registration in Spanish", () => {
    const p = presentParticipantRegistration("CONFIRMED", "APPROVED");
    assert.equal(p.label, "Inscripción confirmada");
    assert.equal(looksLikeRawStatusEnum(p.label), false);
  });
});

describe("presentPaymentReturn", () => {
  it("approved path when displayAsApproved", () => {
    const p = presentPaymentReturn({
      variant: "exito",
      registrationStatus: "CONFIRMED",
      paymentStatus: "APPROVED",
      displayAsApproved: true,
    });
    assert.match(p.label, /confirmada/i);
  });

  it("pending warns against duplicate payment", () => {
    const p = presentPaymentReturn({
      variant: "pendiente",
      registrationStatus: "PENDING_PAYMENT",
      paymentStatus: "PROCESSING",
      displayAsApproved: false,
    });
    assert.match(p.description + (p.nextAction ?? ""), /no .*pagar|no necesitás/i);
  });

  it("rejected allows retry guidance", () => {
    const p = presentPaymentReturn({
      variant: "error",
      registrationStatus: "PENDING_PAYMENT",
      paymentStatus: "FAILED",
      displayAsApproved: false,
    });
    assert.match(p.nextAction ?? "", /intent|resumen/i);
  });

  it("unknown/exito unverified discourages duplicate payment", () => {
    const p = presentPaymentReturn({
      variant: "exito",
      registrationStatus: "PENDING_PAYMENT",
      paymentStatus: "PROCESSING",
      displayAsApproved: false,
    });
    assert.match(p.nextAction ?? p.description, /segundo pago|No realices/i);
  });
});

describe("presentWelcomeCardStatus", () => {
  it("does not expose GENERATED/FAILED enums", () => {
    assert.equal(looksLikeRawStatusEnum(presentWelcomeCardStatus("GENERATED").label), false);
    assert.equal(looksLikeRawStatusEnum(presentWelcomeCardStatus("FAILED").label), false);
    assert.equal(looksLikeRawStatusEnum(presentWelcomeCardStatus("PENDING").label), false);
  });
});

describe("publicCheckoutError", () => {
  it("token errors discourage duplicate payment", () => {
    const e = publicCheckoutError("TOKEN_EXPIRED");
    assert.match(e.nextAction ?? e.description, /No realices un nuevo pago|antes de realizar/i);
  });

  it("detects unsafe technical fragments", () => {
    assert.equal(isUnsafePublicErrorText("waiting for webhook"), true);
    assert.equal(isUnsafePublicErrorText("Pago pendiente de confirmación"), false);
  });
});

describe("PUBLIC_CHECKOUT_FORBIDDEN_TERMS", () => {
  it("lists infrastructure terms that must not appear in participant checkout copy", () => {
    assert.ok(PUBLIC_CHECKOUT_FORBIDDEN_TERMS.includes("webhook"));
    assert.ok(PUBLIC_CHECKOUT_FORBIDDEN_TERMS.includes("DNX Payments"));
    assert.ok(PUBLIC_CHECKOUT_FORBIDDEN_TERMS.includes("Split 1:N"));
  });
});
