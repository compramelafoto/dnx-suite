import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CARD_BRICK_PUBLIC_COPY,
  CHECKOUT_PUBLIC_COPY,
} from "./checkout-public-copy";
import { PUBLIC_CHECKOUT_FORBIDDEN_TERMS } from "./public-errors";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function assertNoForbidden(haystack: string, label: string) {
  for (const term of PUBLIC_CHECKOUT_FORBIDDEN_TERMS) {
    assert.equal(
      haystack.toLowerCase().includes(term.toLowerCase()),
      false,
      `${label} contains forbidden term: ${term}`,
    );
  }
}

describe("checkout public copy", () => {
  it("exported checkout strings avoid infrastructure jargon", () => {
    const blob = [
      CHECKOUT_PUBLIC_COPY.brickIntro("hoy"),
      CHECKOUT_PUBLIC_COPY.redirectIntro("$1", "hoy"),
      CHECKOUT_PUBLIC_COPY.redirectHint,
      CHECKOUT_PUBLIC_COPY.testBanner,
      CHECKOUT_PUBLIC_COPY.preparing,
      CHECKOUT_PUBLIC_COPY.payLive,
      CHECKOUT_PUBLIC_COPY.payTest,
      CHECKOUT_PUBLIC_COPY.freeConfirm,
      CARD_BRICK_PUBLIC_COPY.testBanner,
      CARD_BRICK_PUBLIC_COPY.loading,
      CARD_BRICK_PUBLIC_COPY.processing,
    ].join("\n");
    assertNoForbidden(blob, "CHECKOUT_PUBLIC_COPY / CARD_BRICK_PUBLIC_COPY");
    assert.match(CHECKOUT_PUBLIC_COPY.payLive, /Mercado Pago/i);
    assert.match(CARD_BRICK_PUBLIC_COPY.processing, /no .*pagar|no vuelvas a pagar/i);
  });

  it("source files of public checkout surfaces omit forbidden terms in user-facing strings", () => {
    const files = [
      "components/public-registration/CheckoutPayButton.tsx",
      "components/payments/CardPaymentBrickCheckout.tsx",
      "app/(public)/maratones/[slug]/inscripcion/resumen/[registrationId]/page.tsx",
      "app/(public)/mi-cuenta/page.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(join(root, rel), "utf8");
      // Ignore comments / imports; scan string literals roughly via quoted segments.
      const strings = src.match(/`[^`]*`|"[^"\n]{3,}"|'[^'\n]{3,}'/g) ?? [];
      const joined = strings.join("\n");
      assertNoForbidden(joined, rel);
    }
  });

  it("brick wrapper marks a controlled overflow viewport", () => {
    const src = readFileSync(
      join(root, "components/payments/CardPaymentBrickCheckout.tsx"),
      "utf8",
    );
    assert.match(src, /data-testid="card-brick-viewport"/);
    assert.match(src, /min-w-0/);
    assert.match(src, /overflow-x-auto/);
  });
});
