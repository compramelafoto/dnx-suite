import { describe, expect, it } from "vitest";
import {
  generateQuotePublicViewToken,
  hashQuotePublicViewToken,
  isQuotePublicViewTokenActive,
} from "./quote-public-token";

describe("quote-public-token", () => {
  it("genera tokens largos y únicos con hash verificable", () => {
    const first = generateQuotePublicViewToken();
    const second = generateQuotePublicViewToken();

    expect(first.token.length).toBeGreaterThanOrEqual(40);
    expect(second.token).not.toBe(first.token);
    expect(hashQuotePublicViewToken(first.token)).toBe(first.tokenHash);
  });

  it("valida token activo según revocación y expiración", () => {
    const { tokenHash } = generateQuotePublicViewToken();
    const future = new Date(Date.now() + 60_000);

    expect(
      isQuotePublicViewTokenActive({
        tokenHash,
        revokedAt: null,
        expiresAt: future,
      }),
    ).toBe(true);

    expect(
      isQuotePublicViewTokenActive({
        tokenHash,
        revokedAt: new Date(),
        expiresAt: future,
      }),
    ).toBe(false);

    expect(
      isQuotePublicViewTokenActive({
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ).toBe(false);
  });
});
