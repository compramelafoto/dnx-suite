import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventPhotoPricingMode, PrintPricingSource } from "@/lib/prisma";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import { resolveAlbumSalesPolicyFromInput } from "@/lib/sales/resolve-album-sales-policy";

const baseTerms = {
  termsAcceptedAt: new Date("2025-01-01"),
  termsVersion: TERMS_VERSION,
};

function baseInput(
  overrides: Partial<Parameters<typeof resolveAlbumSalesPolicyFromInput>[0]> = {}
) {
  return {
    albumId: 1,
    photographerId: 10,
    album: {
      enableDigitalPhotos: true,
      enablePrintedPhotos: true,
      digitalPhotoPriceCents: 8000,
      albumProfitMarginPercent: 25,
      selectedLabId: null,
      printPricingSource: PrintPricingSource.PHOTOGRAPHER,
      pickupBy: "PHOTOGRAPHER",
      ...baseTerms,
      enableFaceBulkPurchase: false,
      faceBulkPriceCents: null,
      eventId: null,
      ...overrides.album,
    },
    photographer: {
      defaultDigitalPhotoPrice: 6000,
      profitMarginPercent: 15,
      preferredLabId: 99,
      ...overrides.photographer,
    },
    photographerSalesSettings: {
      digitalEnabled: true,
      printsEnabled: true,
      capabilities: [],
      ...overrides.photographerSalesSettings,
    },
    albumSalesSettings: overrides.albumSalesSettings ?? null,
    eventPricing: overrides.eventPricing ?? null,
    platformMinDigitalPriceArs: 5000,
    fees: { digitalMarketplacePercent: 12, printPlatformPercent: 11 },
    ...overrides,
  };
}

describe("resolveAlbumSalesPolicyFromInput", () => {
  it("resuelve capabilities por herencia global por defecto", () => {
    const policy = resolveAlbumSalesPolicyFromInput(baseInput());
    assert.ok(policy.capabilities.effective.includes("DIGITAL_SALES"));
    assert.ok(policy.capabilities.effective.includes("PRINT_SALES"));
    assert.equal(policy.capabilities.inheritFromPhotographer, true);
  });

  it("respeta disabledCapabilities en herencia", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        albumSalesSettings: {
          inheritFromPhotographer: true,
          allowedCapabilities: [],
          disabledCapabilities: ["PRINT_SALES"],
        },
      })
    );
    assert.ok(policy.capabilities.effective.includes("DIGITAL_SALES"));
    assert.ok(!policy.capabilities.effective.includes("PRINT_SALES"));
    assert.equal(policy.capabilities.printSales, false);
  });

  it("respeta allowedCapabilities en override explícito", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        albumSalesSettings: {
          inheritFromPhotographer: false,
          allowedCapabilities: ["DIGITAL_SALES"],
          disabledCapabilities: [],
        },
      })
    );
    assert.ok(policy.capabilities.effective.includes("DIGITAL_SALES"));
    assert.ok(!policy.capabilities.effective.includes("PRINT_SALES"));
  });

  it("checkout digital sigue legacy enableDigitalPhotos", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          enableDigitalPhotos: false,
          enablePrintedPhotos: true,
          digitalPhotoPriceCents: 8000,
          albumProfitMarginPercent: 20,
        },
        albumSalesSettings: {
          inheritFromPhotographer: true,
          allowedCapabilities: [],
          disabledCapabilities: [],
        },
      })
    );
    assert.equal(policy.digital.legacyEnabled, false);
    assert.equal(policy.digital.capabilityEnabled, true);
    assert.equal(policy.digital.checkoutEnabled, false);
    assert.equal(policy.divergence.digitalLegacyVsCapability, true);
  });

  it("precio digital: álbum > default fotógrafo > mínimo plataforma", () => {
    const fromAlbum = resolveAlbumSalesPolicyFromInput(baseInput());
    assert.equal(fromAlbum.digital.legacyBasePriceArs, 8000);
    assert.equal(fromAlbum.digital.legacyBasePriceSource, "album_stored");

    const fromPhotographer = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: { digitalPhotoPriceCents: null },
      })
    );
    assert.equal(fromPhotographer.digital.legacyBasePriceArs, 6000);
    assert.equal(fromPhotographer.digital.legacyBasePriceSource, "photographer_default");

    const fromMin = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: { digitalPhotoPriceCents: null },
        photographer: { defaultDigitalPhotoPrice: null, profitMarginPercent: 15, preferredLabId: null },
      })
    );
    assert.equal(fromMin.digital.legacyBasePriceArs, 5000);
    assert.equal(fromMin.digital.legacyBasePriceSource, "platform_minimum");
  });

  it("aplica override ORGANIZER_FIXED del evento", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          eventId: 5,
          digitalPhotoPriceCents: 3000,
        },
        eventPricing: {
          photoPricingMode: EventPhotoPricingMode.ORGANIZER_FIXED,
          fixedPhotoPrice: 9000,
          minimumPhotoPrice: null,
          locksPhotographerDigitalPricing: true,
        },
      })
    );
    assert.equal(policy.digital.effectiveBasePriceArs, 9000);
    assert.equal(policy.digital.effectiveBasePriceSource, "event_fixed");
    assert.equal(policy.digital.organizerLocksPricing, true);
  });

  it("lab efectivo: selectedLabId antes que preferredLabId", () => {
    const selected = resolveAlbumSalesPolicyFromInput(
      baseInput({ album: { selectedLabId: 7 } })
    );
    assert.equal(selected.lab.effectiveLabId, 7);
    assert.equal(selected.lab.effectiveLabSource, "album_selected");

    const preferred = resolveAlbumSalesPolicyFromInput(
      baseInput({ album: { selectedLabId: null } })
    );
    assert.equal(preferred.lab.effectiveLabId, 99);
    assert.equal(preferred.lab.effectiveLabSource, "photographer_preferred");
  });

  it("margen: álbum antes que fotógrafo", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: { albumProfitMarginPercent: 30 },
        photographer: { profitMarginPercent: 10, preferredLabId: null },
      })
    );
    assert.equal(policy.print.marginPercent, 30);
    assert.equal(policy.print.marginSource, "album");

    const fallback = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: { albumProfitMarginPercent: null },
        photographer: { profitMarginPercent: 18, preferredLabId: null },
      })
    );
    assert.equal(fallback.print.marginPercent, 18);
    assert.equal(fallback.print.marginSource, "photographer");

    const zeroAlbumUsesPhotographer = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: { albumProfitMarginPercent: 0 },
        photographer: { profitMarginPercent: 18, preferredLabId: null },
      })
    );
    assert.equal(zeroAlbumUsesPhotographer.print.marginPercent, 18);
    assert.equal(zeroAlbumUsesPhotographer.print.marginSource, "photographer");
  });

  it("completitud legacy coincide con álbum bien configurado", () => {
    const policy = resolveAlbumSalesPolicyFromInput(baseInput());
    assert.equal(policy.completeness.legacyIsComplete, true);
    assert.equal(policy.completeness.canAcceptStandardCheckoutOrders, true);
    assert.equal(policy.completeness.termsOk, true);
  });

  it("completitud false sin términos", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          termsAcceptedAt: null,
          termsVersion: null,
        },
      })
    );
    assert.equal(policy.completeness.legacyIsComplete, false);
    assert.ok(policy.completeness.blockingReasons.some((r) => r.includes("Términos")));
  });

  it("completitud false sin precio digital si digital legacy on", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          enableDigitalPhotos: true,
          enablePrintedPhotos: false,
          digitalPhotoPriceCents: 0,
          albumProfitMarginPercent: 20,
        },
        photographer: { defaultDigitalPhotoPrice: null, profitMarginPercent: null, preferredLabId: null },
        platformMinDigitalPriceArs: 0,
      })
    );
    assert.equal(policy.completeness.legacyIsComplete, false);
  });

  it("impresión con lab exige pickupBy", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          enableDigitalPhotos: false,
          enablePrintedPhotos: true,
          digitalPhotoPriceCents: null,
          selectedLabId: 3,
          pickupBy: null,
          albumProfitMarginPercent: 10,
        },
      })
    );
    assert.equal(policy.print.hasPickupWhenLab, false);
    assert.equal(policy.completeness.legacyIsComplete, false);
  });

  it("face bulk solo con precio positivo", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          enableFaceBulkPurchase: true,
          faceBulkPriceCents: 25000,
        },
      })
    );
    assert.equal(policy.faceBulk.enabled, true);
    assert.equal(policy.faceBulk.basePriceArs, 25000);
  });

  it("propaga fees inyectados", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({ fees: { digitalMarketplacePercent: 8, printPlatformPercent: 9 } })
    );
    assert.equal(policy.fees.digitalMarketplacePercent, 8);
    assert.equal(policy.fees.printPlatformPercent, 9);
  });

  it("divergencia impresión legacy off / capability on", () => {
    const policy = resolveAlbumSalesPolicyFromInput(
      baseInput({
        album: {
          enablePrintedPhotos: false,
          enableDigitalPhotos: true,
        },
        photographerSalesSettings: {
          digitalEnabled: true,
          printsEnabled: true,
        },
      })
    );
    assert.equal(policy.divergence.printLegacyVsCapability, true);
    assert.equal(policy.divergence.hasAny, true);
    assert.ok(policy.divergence.summaryLines.length >= 1);
  });
});
