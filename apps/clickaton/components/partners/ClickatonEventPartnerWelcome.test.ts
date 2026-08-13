import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canMountPartnerWelcomeActivation,
  isClickatonPartnerWelcomeEnabled,
} from "@repo/partners";
import {
  CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS,
  CLICKATON_EVENT_WELCOME_PLACEMENT,
} from "@/lib/public/partners-event-welcome-shared";

const here = dirname(fileURLToPath(import.meta.url));

describe("Clickatón EVENT welcome flag", () => {
  it("ausente / false / inválido ⇒ OFF", () => {
    const prev = process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
    try {
      delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
      assert.equal(isClickatonPartnerWelcomeEnabled(), false);
      process.env.CLICKATON_PARTNER_WELCOME_ENABLED = "false";
      assert.equal(isClickatonPartnerWelcomeEnabled(), false);
      process.env.CLICKATON_PARTNER_WELCOME_ENABLED = "maybe";
      assert.equal(isClickatonPartnerWelcomeEnabled(), false);
      process.env.CLICKATON_PARTNER_WELCOME_ENABLED = "true";
      assert.equal(isClickatonPartnerWelcomeEnabled(), true);
    } finally {
      if (prev === undefined) delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
      else process.env.CLICKATON_PARTNER_WELCOME_ENABLED = prev;
    }
  });
});

describe("Clickatón EVENT welcome surfaces", () => {
  it("landing pública permitida; funnel crítico bloqueado", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
        pathname: "/maratones/argentina-2026",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
        pathname: "/maratones/argentina-2026/inscripcion",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
        pathname: "/maratones/argentina-2026/inscripcion/pago/exito",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
        pathname: "/admin/sponsors",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
        pathname: "/login",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: CLICKATON_EVENT_WELCOME_PLACEMENT,
        pathname: "/tienda/checkout",
      }).ok,
      false,
    );
  });
});

describe("Clickatón EVENT welcome wiring", () => {
  it("página monta wrapper + loader; legacy MarathonSponsors intacto", () => {
    const page = readFileSync(
      join(here, "../../app/(public)/maratones/[slug]/page.tsx"),
      "utf8",
    );
    assert.match(page, /ClickatonEventPartnerWelcome/);
    assert.match(page, /loadClickatonEventWelcomeAd/);
    assert.match(page, /publicLandingAllowed/);
    assert.match(page, /MarathonDetailView/);

    const detail = readFileSync(
      join(here, "../marathon/MarathonDetailView.tsx"),
      "utf8",
    );
    assert.match(detail, /MarathonSponsors/);

    const client = readFileSync(
      join(here, "../marathon/ClickatonEventPartnerWelcome.tsx"),
      "utf8",
    );
    assert.match(client, /PartnerWelcomeInterstitial/);
    assert.match(client, /CLICKATON_EVENT_WELCOME/);
    assert.match(client, /appearDelayMs=\{CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS\}/);
    assert.equal(CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS, 1000);
    assert.match(client, /welcomeMedia/);
    assert.doesNotMatch(client, /server-only/);
  });

  it("loader server-only corta con flag OFF antes de Prisma", () => {
    const src = readFileSync(
      join(here, "../../lib/public/partners-event-welcome.ts"),
      "utf8",
    );
    assert.match(src, /server-only/);
    assert.match(src, /isClickatonPartnerWelcomeEnabled\(\)/);
    assert.match(src, /return null/);
    assert.match(src, /requireActivePartner:\s*true/);
    assert.match(src, /editionContextId/);
  });
});
