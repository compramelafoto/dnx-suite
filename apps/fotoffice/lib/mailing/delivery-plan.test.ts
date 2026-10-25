import { describe, expect, it } from "vitest";
import { campaignStatusFor, isPermanentFailure } from "./delivery-plan";

describe("plan de envío", () => {
  it("sólo los 4xx distintos de 429 son definitivos", () => {
    expect(isPermanentFailure("PROVIDER_REJECTED", "HTTP 422 · validation_error · bad")).toBe(true);
    expect(isPermanentFailure("PROVIDER_REJECTED", "HTTP 429 · rate_limit_exceeded")).toBe(false);
    expect(isPermanentFailure("PROVIDER_REJECTED", "HTTP 503")).toBe(false);
    expect(isPermanentFailure("INTERNAL_ERROR", "HTTP 400")).toBe(false);
    expect(isPermanentFailure("CONFIGURATION_ERROR", "Faltan variables")).toBe(false);
  });

  it("estado del envío", () => {
    expect(campaignStatusFor({ pending: 1, sending: 0, sent: 5, failed: 0 })).toBe("SENDING");
    expect(campaignStatusFor({ pending: 0, sending: 2, sent: 5, failed: 0 })).toBe("SENDING");
    expect(campaignStatusFor({ pending: 0, sending: 0, sent: 5, failed: 0 })).toBe("SENT");
    expect(campaignStatusFor({ pending: 0, sending: 0, sent: 5, failed: 1 })).toBe("FAILED");
    expect(campaignStatusFor({ pending: 0, sending: 0, sent: 0, failed: 3 })).toBe("FAILED");
    expect(campaignStatusFor({ pending: 0, sending: 0, sent: 0, failed: 0 })).toBe("SENT");
  });
});
