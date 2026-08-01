import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMpErrorCodes,
  extractMpErrorMessage,
  sanitizeMpTransactionDetail,
} from "./mercado-pago-error.js";

describe("Mercado Pago error body (Orders sandbox shape)", () => {
  it("reads errors[].code/message from Orders API bodies (Imp 05)", () => {
    const body = {
      errors: [
        {
          code: "unprocessable_entity",
          message: "Post processing rejected the operation.",
        },
      ],
    };
    assert.deepEqual(extractMpErrorCodes(null, body), ["unprocessable_entity"]);
    assert.equal(
      extractMpErrorMessage(null, body, "fallback"),
      "Post processing rejected the operation.",
    );
  });

  it("reads refund_amount_exceeds from errors[]", () => {
    const body = {
      errors: [
        {
          code: "refund_amount_exceeds",
          message: "Refund amount exceeds the available amount.",
        },
      ],
    };
    assert.ok(extractMpErrorCodes(null, body).includes("refund_amount_exceeds"));
    assert.match(
      extractMpErrorMessage(null, body, "fallback"),
      /available amount/i,
    );
  });

  it("appends sanitized transaction status_detail from errors[].details", () => {
    assert.equal(
      sanitizeMpTransactionDetail("pay_01ABC: rejected_by_issuer"),
      "rejected_by_issuer",
    );
    const msg = extractMpErrorMessage(
      {
        errors: [
          {
            code: "failed",
            message: "The following transactions failed",
            details: ["pay_01X: cc_rejected_other_reason"],
          },
        ],
      },
      null,
      "fallback",
    );
    assert.match(msg, /transactions failed/i);
    assert.match(msg, /cc_rejected_other_reason/);
    assert.equal(msg.includes("pay_01X"), false);
  });
});
