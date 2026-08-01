import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapBrickFormDataToCardPaymentSubmission,
  sanitizeCardPaymentSubmissionForLog,
  CardPaymentSubmissionError,
} from "./map-brick-form-data.js";
import { readMercadoPagoDeviceSessionId } from "./device-session.js";
import {
  mapMercadoPagoStatusDetailToUserMessage,
  mapProviderOrderStatusToCardUiState,
} from "./status-detail-messages.js";

describe("Card Payment Brick frontend contracts", () => {
  it("maps Brick formData and ignores transaction_amount for charging contract", () => {
    const submission = mapBrickFormDataToCardPaymentSubmission(
      {
        token: "CARD_TOKEN_TEST",
        payment_method_id: "visa",
        payment_type_id: "credit_card",
        issuer_id: "123",
        installments: 3,
        transaction_amount: 999999,
        payer: { email: "buyer@testuser.com" },
      },
      "mp-device-session-abc",
    );
    assert.equal(submission.token, "CARD_TOKEN_TEST");
    assert.equal(submission.paymentMethodId, "visa");
    assert.equal(submission.installments, 3);
    assert.equal(submission.deviceSessionId, "mp-device-session-abc");
    assert.equal(submission.payer.email, "buyer@testuser.com");
    // amount from browser is not part of CardPaymentSubmission
    assert.equal("transaction_amount" in submission, false);
  });

  it("requires token and device session", () => {
    assert.throws(
      () =>
        mapBrickFormDataToCardPaymentSubmission(
          {
            token: "",
            payment_method_id: "visa",
            payer: {},
          },
          "device",
        ),
      CardPaymentSubmissionError,
    );
    assert.throws(
      () =>
        mapBrickFormDataToCardPaymentSubmission(
          {
            token: "tok",
            payment_method_id: "visa",
            payer: {},
          },
          "",
        ),
      /DEVICE_SESSION/,
    );
  });

  it("sanitizes logs without token", () => {
    const sanitized = sanitizeCardPaymentSubmissionForLog({
      token: "SUPER_SECRET_TOKEN",
      paymentMethodId: "visa",
      installments: 1,
      payer: { email: "a@b.com" },
      deviceSessionId: "device123456",
    });
    const json = JSON.stringify(sanitized);
    assert.equal(json.includes("SUPER_SECRET_TOKEN"), false);
    assert.equal(sanitized.tokenPresent, true);
    assert.equal(sanitized.DEVICE_SESSION_PRESENT, true);
    assert.equal(sanitized.deviceSessionIdLength, 12);
    assert.equal(json.includes("device123456"), false);
  });

  it("reads armor.* session key from window when MP_DEVICE_SESSION_ID absent", () => {
    const armor =
      "armor.e4fe0af40629a51c65f8a49d877548cf4ea9d84d5de74ebe401353b72e89d8637facd4f2ba0c3dcf";
    const fake = Object.create(null) as Window & { MP_DEVICE_SESSION_ID?: string };
    Object.defineProperty(fake, armor, { value: {}, enumerable: true });
    Object.defineProperty(fake, "document", {
      value: { getElementById: () => null },
    });
    assert.equal(readMercadoPagoDeviceSessionId(fake), armor);
  });

  it("reads official MP_DEVICE_SESSION_ID", () => {
    const fakeWin = {
      MP_DEVICE_SESSION_ID: "  official-device-id  ",
      document: { getElementById: () => null },
    } as unknown as Window;
    assert.equal(
      readMercadoPagoDeviceSessionId(fakeWin as never),
      "official-device-id",
    );
  });

  it("maps rejection status_detail to friendly messages", () => {
    assert.match(
      mapMercadoPagoStatusDetailToUserMessage("insufficient_amount"),
      /fondos/i,
    );
    assert.match(
      mapMercadoPagoStatusDetailToUserMessage("bad_filled_card_data"),
      /tarjeta/i,
    );
    assert.match(
      mapMercadoPagoStatusDetailToUserMessage("high_risk"),
      /seguridad/i,
    );
    assert.equal(mapProviderOrderStatusToCardUiState("PROCESSED_ACCREDITED"), "APPROVED");
    assert.equal(mapProviderOrderStatusToCardUiState("FAILED"), "REJECTED");
    assert.equal(mapProviderOrderStatusToCardUiState("OPEN"), "PROCESSING");
  });
});
