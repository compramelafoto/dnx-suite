import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  presentPriceCompare,
  presentPricePhaseOperationalStatus,
  presentPromotionDiscount,
  presentPromotionError,
  presentPromotionOperationalStatus,
  presentPromotionUsage,
  presentStoreStatus,
} from "./commercial-status-presentation";

const ROOT = join(process.cwd());

describe("commercial status presentation", () => {
  it("presents phase statuses without raw enums", () => {
    const now = new Date("2026-08-01T15:00:00.000Z");
    const active = presentPricePhaseOperationalStatus(
      {
        isActive: true,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: new Date("2026-08-10T00:00:00.000Z"),
      },
      now,
    );
    assert.equal(active.label, "Vigente");
    assert.equal(looksLikeRawStatusEnum(active.label), false);

    const scheduled = presentPricePhaseOperationalStatus(
      {
        isActive: true,
        startsAt: new Date("2026-09-01T00:00:00.000Z"),
        endsAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      now,
    );
    assert.equal(scheduled.label, "Programada");

    const inactive = presentPricePhaseOperationalStatus(
      {
        isActive: false,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: new Date("2026-08-10T00:00:00.000Z"),
      },
      now,
    );
    assert.equal(inactive.label, "Desactivada");
  });

  it("shows next price struck when next is more expensive", () => {
    const compare = presentPriceCompare({
      current: {
        name: "Fase inicial",
        amount: 2_500_000,
        currency: "ARS",
        endsAt: new Date("2026-08-10T03:00:00.000Z"),
      },
      next: {
        name: "Fase general",
        amount: 3_000_000,
        currency: "ARS",
        startsAt: new Date("2026-08-11T03:00:00.000Z"),
      },
      timezone: "America/Argentina/Buenos_Aires",
    });
    assert.equal(compare.showNextStruck, true);
    assert.ok(compare.nextAmountLabel);
    assert.match(compare.helper, /tachado|próxima fase|cuesta menos/i);
  });

  it("does not strike next when it is not more expensive", () => {
    const compare = presentPriceCompare({
      current: {
        name: "Fase A",
        amount: 3_000_000,
        currency: "ARS",
        endsAt: new Date("2026-08-10T03:00:00.000Z"),
      },
      next: {
        name: "Fase B",
        amount: 2_000_000,
        currency: "ARS",
        startsAt: new Date("2026-08-11T03:00:00.000Z"),
      },
    });
    assert.equal(compare.showNextStruck, false);
  });

  it("presents discounts without PERCENTAGE/FIXED labels", () => {
    assert.match(presentPromotionDiscount("PERCENTAGE", 50).label, /50 %/);
    assert.doesNotMatch(presentPromotionDiscount("PERCENTAGE", 50).label, /PERCENTAGE/);
    assert.match(presentPromotionDiscount("FIXED_AMOUNT", 500_000).label, /descuento/i);
    assert.doesNotMatch(presentPromotionDiscount("FIXED_AMOUNT", 500_000).label, /FIXED/);
  });

  it("presents promotion usage with limits context", () => {
    const limited = presentPromotionUsage({
      activeUses: 12,
      totalUses: 15,
      totalUsageLimit: 50,
    });
    assert.equal(limited.summary, "12 de 50 usos utilizados");
    assert.match(limited.remainingLabel, /38/);

    const unlimited = presentPromotionUsage({
      activeUses: 3,
      totalUses: 3,
      totalUsageLimit: null,
    });
    assert.match(unlimited.remainingLabel, /sin límite/i);
  });

  it("humanizes promotion errors", () => {
    const expired = presentPromotionError("EXPIRED");
    assert.match(expired.title, /vigente/i);
    assert.ok(expired.nextStep.length > 5);

    const exhausted = presentPromotionError("USAGE_LIMIT");
    assert.match(exhausted.title, /límite/i);
  });

  it("presents store statuses in Spanish", () => {
    assert.equal(presentStoreStatus("DRAFT").label, "En preparación");
    assert.equal(looksLikeRawStatusEnum(presentStoreStatus("ACTIVE").label), false);
    assert.equal(presentPromotionOperationalStatus({
      isActive: true,
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: new Date("2030-01-01T00:00:00.000Z"),
      totalUsageLimit: null,
      activeUses: 0,
    }).label, "Disponible");
  });
});

describe("commercial UI source contracts", () => {
  it("precios page shows current price and struck next when applicable", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/precios/page.tsx"),
      "utf8",
    );
    assert.match(page, /Fases de precio/);
    assert.match(page, /PricePhaseCompare/);
    assert.match(page, /presentPriceCompare/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.match(page, /ConfirmSubmitButton/);
    assert.match(page, /Habilitar fase|Desactivar fase/);
    assert.doesNotMatch(page, /El backend resuelve/);
    assert.doesNotMatch(page, /Próxima subida:/);
    assert.doesNotMatch(page, />Activar</);
  });

  it("promociones page uses human labels", () => {
    const page = readFileSync(join(ROOT, "app/admin/(panel)/promociones/page.tsx"), "utf8");
    assert.match(page, /Códigos promocionales/);
    assert.match(page, /Código que utilizará el participante/);
    assert.match(page, /presentPromotionDiscount/);
    assert.match(page, /ConfirmSubmitButton/);
    assert.doesNotMatch(page, /@repo\/promotions/);
    assert.doesNotMatch(page, /% OFF/);
  });

  it("wizard shows struck next price when next is higher", () => {
    const wizard = readFileSync(
      join(ROOT, "components/public-registration/PublicRegistrationWizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /nextPricePhase/);
    assert.match(wizard, /highestPricePhase/);
    assert.match(wizard, /line-through/);
    assert.match(wizard, /Precio promocional de esta fase/);
  });

  it("does not modify price resolution logic", () => {
    const resolve = readFileSync(
      join(ROOT, "lib/pricing/domain/resolve-price-phase.ts"),
      "utf8",
    );
    assert.match(resolve, /resolveCurrentPricePhase/);
    assert.match(resolve, /nextPhase/);
  });
});
