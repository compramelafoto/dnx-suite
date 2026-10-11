import { describe, expect, it } from "vitest";
import {
  canBuy, offerProblems, offerPurchasable, offerTransition, parseSaleExternalReference, receiverPlan,
  saleAmounts, saleExternalReference, saleOrderTransition, salePageState, salesMode, splitProblems,
  fulfillmentTransition, deliveryOptions, offerSellingPrice, saleWindowOpen, saleClosesAt, splitExample,
  PRICE_MIN_ARS, SALE_PRICE_MAX_ARS, SALE_SPLIT_TEXT,
} from "./sales";

const base = { ventasEnVivo: false, ordersProduccion: false, mpEnv: "sandbox" as const, tokenEsDePrueba: true, faltan: [] };

describe("modos", () => {
  it("sandbox con token de prueba → TEST, aunque la llave de Muestras esté encendida", () => {
    expect(salesMode(base).mode).toBe("TEST");
    expect(salesMode({ ...base, ventasEnVivo: true, ordersProduccion: true }).mode).toBe("TEST");
  });
  it("producción exige las dos llaves y un token real", () => {
    const prod = { ...base, mpEnv: "production" as const, tokenEsDePrueba: false };
    expect(salesMode(prod).mode).toBe("OFF");
    expect(salesMode({ ...prod, ventasEnVivo: true }).motivo).toMatch(/Mercado Pago todavía no habilitó/);
    expect(salesMode({ ...prod, ordersProduccion: true }).motivo).toMatch(/apagada/);
    expect(salesMode({ ...prod, ventasEnVivo: true, ordersProduccion: true }).mode).toBe("LIVE");
    expect(salesMode({ ...prod, ventasEnVivo: true, ordersProduccion: true, tokenEsDePrueba: true }).mode).toBe("OFF");
  });
  it("con faltas → OFF y dice qué falta", () => {
    const r = salesMode({ ...base, faltan: ["MUESTRAS_CERT_PRIVATE_KEY"] });
    expect(r.mode).toBe("OFF");
    expect(r.motivo).toContain("MUESTRAS_CERT_PRIVATE_KEY");
  });
  it("quién compra", () => {
    expect(canBuy("TEST", { esSuperAdmin: false, esProbador: false })).toBe(false);
    expect(canBuy("TEST", { esSuperAdmin: false, esProbador: true })).toBe(true);
    expect(canBuy("LIVE", { esSuperAdmin: false, esProbador: false })).toBe(true);
    expect(canBuy("OFF", { esSuperAdmin: true, esProbador: true })).toBe(false);
  });
});

describe("reparto y montos", () => {
  it("tiene que sumar 85 en puntos enteros", () => {
    expect(splitProblems({ organizerBps: 2500, photographerBps: 6000 })).toEqual([]);
    expect(splitProblems({ organizerBps: 3000, photographerBps: 6000 }).join()).toMatch(/85/);
    expect(splitProblems({ organizerBps: 2550, photographerBps: 5950 }).join()).toMatch(/enteros/);
  });
  it("15 % plataforma y el redondeo cae en el fotógrafo", () => {
    const a = saleAmounts({ priceArs: 33_333, shippingArs: 0, platformFeeBps: 1500, organizerBps: 2500 });
    expect(a.priceCents).toBe(3_333_300);
    expect(a.platformCents).toBe(499_995);
    expect(a.organizerCents).toBe(833_325);
    expect(a.platformCents + a.organizerCents + a.photographerCents).toBe(a.priceCents);
  });
  it("el envío va a la organización; misma cuenta = un partner; ceros fuera", () => {
    const amounts = saleAmounts({ priceArs: 100_000, shippingArs: 8_000, platformFeeBps: 1500, organizerBps: 0 });
    const p = receiverPlan({ amounts, organizer: { userId: 1, receiverId: "r-org" }, photographer: { userId: 2, receiverId: "r-foto" } });
    expect(p.ownerCents).toBe(1_500_000);
    expect(p.partners).toEqual([
      { recipientId: "organizer", receiverId: "r-org", cents: 800_000 },
      { recipientId: "photographer", receiverId: "r-foto", cents: 8_500_000 },
    ]);
    const mismo = receiverPlan({ amounts, organizer: { userId: 1, receiverId: "r" }, photographer: { userId: 1, receiverId: "r" } });
    expect(mismo.partners).toEqual([{ recipientId: "both", receiverId: "r", cents: 9_300_000 }]);
  });
});

describe("referencia", () => {
  it("ida y vuelta, y rechaza lo ajeno", () => {
    expect(saleExternalReference("abcd1234abcd1234")).toBe("muestras-venta-abcd1234abcd1234");
    expect(parseSaleExternalReference("muestras-venta-abcd1234abcd1234")).toBe("abcd1234abcd1234");
    expect(parseSaleExternalReference("clickaton-registration-x")).toBeNull();
    expect(parseSaleExternalReference("muestras-venta-../x")).toBeNull();
  });
});

describe("ofertas", () => {
  const impresa = { format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 2, priceArs: 150_000, paper: "Hahnemühle Photo Rag 308 g", widthCm: 40, heightCm: 60 } as const;
  it("valida formatos y ediciones", () => {
    expect(offerProblems(impresa, { hasFirstSale: false })).toEqual([]);
    expect(offerProblems({ ...impresa, editionKind: "UNIQUE", editionSize: 3 }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, paper: null }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, format: "DIGITAL" }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, proofCount: 6 }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, priceArs: 999 }, { hasFirstSale: false }).length).toBeGreaterThan(0);
  });
  it("cambiar el precio de una aprobada la manda a revisión y conserva el precio aprobado", () => {
    const r = offerTransition("changePrice", { status: "APPROVED", priceArs: 100_000, approvedPriceArs: 100_000 }, { actor: "AUTHOR", newPriceArs: 120_000 });
    expect(r).toMatchObject({ ok: true, status: "PROPOSED", priceArs: 120_000, approvedPriceArs: 100_000 });
  });
  it("después de la primera venta N no sube", () => {
    const r = offerTransition("editEdition", { status: "APPROVED", editionSize: 10, firstSoldAt: new Date() }, { actor: "AUTHOR", editionSize: 12, issuedOrReserved: 3 });
    expect(r.ok).toBe(false);
  });
  it("comprable sólo con todo en regla; dice qué falta", () => {
    const ok = { setupStatus: "OPEN", activityPublished: true, offerStatus: "APPROVED", authorAcceptedVersion: 2, splitVersion: 2,
      workSellable: true, organizerConsent: "ACTIVE", authorConsent: "ACTIVE", needsFile: true, fileReady: true, signature: true, remaining: 4, authorName: "Ana" } as const;
    expect(offerPurchasable(ok)).toEqual({ ok: true });
    const r = offerPurchasable({ ...ok, authorAcceptedVersion: 1, authorConsent: "PENDING" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join(" ")).toMatch(/Ana todavía no aceptó el reparto.*Ana todavía no conectó/);
  });
});

describe("pedido y producción", () => {
  it("transiciones de pedido", () => {
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBe("PAID");
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "FAILED", paymentStatus: "rejected" }).next).toBe("REJECTED");
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "OPEN", paymentStatus: "in_process" }).next).toBeNull();
    expect(saleOrderTransition("PAID", { orderStatus: "REFUNDED", paymentStatus: "refunded" }).next).toBe("REFUNDED");
    expect(saleOrderTransition("PAID", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBeNull();
    expect(saleOrderTransition("REFUNDED", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBeNull();
    expect(saleOrderTransition("PAID_NO_COPY", { orderStatus: "REFUNDED", paymentStatus: "refunded" }).next).toBe("REFUNDED");
  });
  it("una devolución o un contracargo que llega sin haber visto el pago se registra igual (revisión)", () => {
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "REFUNDED", paymentStatus: "refunded" }).next).toBe("REFUNDED");
    expect(saleOrderTransition("EXPIRED", { orderStatus: "CHARGED_BACK", paymentStatus: "charged_back" }).next).toBe("CHARGED_BACK");
    expect(saleOrderTransition("REJECTED", { orderStatus: "REFUNDED", paymentStatus: "refunded" }).next).toBeNull();
  });
  it("el redondeo nunca deja al fotógrafo en negativo: si pasara, lanza (revisión)", () => {
    expect(() => saleAmounts({ priceArs: 1, shippingArs: 0, platformFeeBps: 50, organizerBps: 9950 })).toThrow(RangeError);
  });
  it("lo que pausó la organización no lo reanuda el autor (revisión)", () => {
    const pausada = offerTransition("pause", { status: "APPROVED" }, { actor: "ORGANIZER" });
    expect(pausada).toMatchObject({ ok: true, status: "PAUSED", pausedBy: "ORGANIZER" });
    expect(offerTransition("resume", { status: "PAUSED", approvedPriceArs: 1000, pausedBy: "ORGANIZER" }, { actor: "AUTHOR" }))
      .toEqual({ ok: false, error: "La organización pausó este formato: lo reanuda ella." });
    expect(offerTransition("resume", { status: "PAUSED", approvedPriceArs: 1000, pausedBy: "ORGANIZER" }, { actor: "ORGANIZER" }))
      .toMatchObject({ ok: true, status: "APPROVED", pausedBy: null });
    expect(offerTransition("resume", { status: "PAUSED", approvedPriceArs: 1000, pausedBy: "AUTHOR" }, { actor: "AUTHOR" })).toMatchObject({ ok: true });
  });
  it("circuito de impresión", () => {
    expect(fulfillmentTransition("PENDING", "IN_PRODUCTION", "PICKUP")).toBe(true);
    expect(fulfillmentTransition("IN_PRODUCTION", "SHIPPED", "PICKUP")).toBe(false);
    expect(fulfillmentTransition("IN_PRODUCTION", "SHIPPED", "SHIPPING")).toBe(true);
    expect(fulfillmentTransition("DELIVERED", "READY", "PICKUP")).toBe(false);
  });
  it("estado de la página", () => {
    expect(salePageState({ mode: "OFF", viewerCanBuy: false, anyOfferForSale: true, purchasableOffers: 2 })).toBe("UNAVAILABLE");
    expect(salePageState({ mode: "LIVE", viewerCanBuy: true, anyOfferForSale: false, purchasableOffers: 0 })).toBe("NOT_FOR_SALE");
    expect(salePageState({ mode: "LIVE", viewerCanBuy: true, anyOfferForSale: true, purchasableOffers: 0 })).toBe("SOLD_OUT");
    expect(salePageState({ mode: "TEST", viewerCanBuy: true, anyOfferForSale: true, purchasableOffers: 1 })).toBe("AVAILABLE");
  });
});

describe("aceptación: el reparto nunca pierde ni inventa un centavo", () => {
  it("de 1.000 a 20.000.000 en pasos irregulares, con varios repartos", () => {
    for (const organizerBps of [0, 100, 2500, 4200, 8500]) {
      for (let priceArs = PRICE_MIN_ARS; priceArs <= SALE_PRICE_MAX_ARS; priceArs += 7_919 + (priceArs % 1_013) * 97) {
        const a = saleAmounts({ priceArs, shippingArs: 0, platformFeeBps: 1500, organizerBps });
        expect(a.platformCents + a.organizerCents + a.photographerCents).toBe(a.priceCents);
        expect(a.photographerCents).toBeGreaterThanOrEqual(0);
        const p = receiverPlan({ amounts: a, organizer: { userId: 1, receiverId: "o" }, photographer: { userId: 2, receiverId: "f" } });
        expect(p.ownerCents + p.partners.reduce((t, x) => t + x.cents, 0)).toBe(a.totalCents);
      }
    }
    const tope = saleAmounts({ priceArs: SALE_PRICE_MAX_ARS, shippingArs: 1_000_000, platformFeeBps: 1500, organizerBps: 2500 });
    expect(tope.totalCents).toBeLessThan(2_147_483_647);
  });
  it("rechaza montos fuera de rango o con decimales", () => {
    expect(() => saleAmounts({ priceArs: 1000.5, shippingArs: 0, platformFeeBps: 1500, organizerBps: 0 })).toThrow();
    expect(() => saleAmounts({ priceArs: 1000, shippingArs: 0, platformFeeBps: 1500, organizerBps: 9000 })).toThrow();
  });
  it("el ejemplo del panel en pesos", () => {
    expect(splitExample(100_000, { platformFeeBps: 1500, organizerBps: 2500 })).toEqual({ plataforma: 15_000, organizacion: 25_000, fotografo: 60_000 });
  });
  it("el texto del reparto que acepta el autor", () => {
    expect(SALE_SPLIT_TEXT({ activityTitle: "Luz", platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000 }))
      .toBe("De cada venta de tus obras en Luz: plataforma 15 %, organización 25 %, vos 60 %.");
  });
});

describe("más reglas de la venta", () => {
  it("quién cobra el envío y qué entregas hay", () => {
    expect(deliveryOptions({ shippingEnabled: true }, "DIGITAL")).toEqual(["DIGITAL"]);
    expect(deliveryOptions({ shippingEnabled: false }, "PRINT")).toEqual(["PICKUP"]);
    expect(deliveryOptions({ shippingEnabled: true }, "PRINT")).toEqual(["PICKUP", "SHIPPING"]);
  });
  it("la venta cierra a los 30 días del cierre de la muestra", () => {
    const endsAt = new Date("2026-11-30T02:59:59.999Z");
    expect(saleClosesAt(endsAt).toISOString()).toBe("2026-12-30T02:59:59.999Z");
    expect(saleWindowOpen({ endsAt, now: new Date("2026-12-29T12:00:00Z") })).toBe(true);
    expect(saleWindowOpen({ endsAt, now: new Date("2026-12-30T03:00:00Z") })).toBe(false);
  });
  it("una oferta con cambio de precio pendiente sigue vendiendo al precio aprobado", () => {
    expect(offerSellingPrice({ status: "APPROVED", priceArs: 100_000, approvedPriceArs: 100_000 })).toBe(100_000);
    expect(offerSellingPrice({ status: "PROPOSED", priceArs: 120_000, approvedPriceArs: 100_000 })).toBe(100_000);
    expect(offerSellingPrice({ status: "PROPOSED", priceArs: 120_000, approvedPriceArs: null })).toBeNull();
    expect(offerSellingPrice({ status: "PAUSED", priceArs: 120_000, approvedPriceArs: 100_000 })).toBeNull();
    const ok = { setupStatus: "OPEN", activityPublished: true, offerStatus: "PROPOSED", approvedPriceArs: 100_000, authorAcceptedVersion: 1, splitVersion: 1,
      workSellable: true, organizerConsent: "ACTIVE", authorConsent: "ACTIVE", needsFile: true, fileReady: true, signature: true, remaining: 1, authorName: "Ana" } as const;
    expect(offerPurchasable(ok)).toEqual({ ok: true });
    expect(offerPurchasable({ ...ok, approvedPriceArs: null }).ok).toBe(false);
    expect(offerPurchasable({ ...ok, remaining: 0 })).toEqual({ ok: false, reasons: ["No quedan copias"] });
  });
  it("circuito de ofertas", () => {
    expect(offerTransition("propose", { status: "DRAFT" }, { actor: "AUTHOR" })).toMatchObject({ ok: true, status: "PROPOSED" });
    expect(offerTransition("approve", { status: "PROPOSED", priceArs: 90_000 }, { actor: "ORGANIZER" })).toMatchObject({ ok: true, status: "APPROVED", approvedPriceArs: 90_000 });
    expect(offerTransition("approve", { status: "PROPOSED" }, { actor: "AUTHOR" }).ok).toBe(false);
    expect(offerTransition("requestChanges", { status: "PROPOSED" }, { actor: "ORGANIZER", note: "" }).ok).toBe(false);
    expect(offerTransition("requestChanges", { status: "PROPOSED" }, { actor: "ORGANIZER", note: "Bajá el precio" })).toMatchObject({ ok: true, status: "CHANGES_REQUESTED", reviewNote: "Bajá el precio" });
    expect(offerTransition("pause", { status: "APPROVED" }, { actor: "AUTHOR" })).toMatchObject({ ok: true, status: "PAUSED" });
    expect(offerTransition("resume", { status: "PAUSED", approvedPriceArs: 1000 }, { actor: "ORGANIZER" })).toMatchObject({ ok: true, status: "APPROVED" });
    expect(offerTransition("reopen", { status: "WITHDRAWN", firstSoldAt: new Date() }, { actor: "AUTHOR" }).ok).toBe(false);
    expect(offerTransition("editEdition", { status: "APPROVED", editionSize: 10, firstSoldAt: new Date() }, { actor: "AUTHOR", editionSize: 2, issuedOrReserved: 3 }).ok).toBe(false);
    expect(offerTransition("editEdition", { status: "APPROVED", editionSize: 10, firstSoldAt: new Date() }, { actor: "AUTHOR", editionSize: 5, issuedOrReserved: 3 })).toMatchObject({ ok: true, editionSize: 5, status: "APPROVED" });
    expect(offerTransition("editEdition", { status: "APPROVED", editionSize: 10, firstSoldAt: null }, { actor: "AUTHOR", editionSize: 12, issuedOrReserved: 0 })).toMatchObject({ ok: true, editionSize: 12, status: "PROPOSED" });
  });
  it("cambiar la edición sin ventas obliga a re-aprobar: borra el precio aprobado", () => {
    const aprobada = { status: "APPROVED", priceArs: 100_000, approvedPriceArs: 100_000, editionSize: 10, firstSoldAt: null };
    const r = offerTransition("editEdition", aprobada, { actor: "AUTHOR", editionSize: 12, issuedOrReserved: 0 });
    expect(r).toEqual({ ok: true, status: "PROPOSED", editionSize: 12, approvedPriceArs: null });
    // Con un cambio de precio en revisión (PROPOSED con precio aprobado) también se borra: deja de venderse.
    const enRevision = { status: "PROPOSED", priceArs: 120_000, approvedPriceArs: 100_000, editionSize: 10, firstSoldAt: null };
    expect(offerTransition("editEdition", enRevision, { actor: "AUTHOR", editionSize: 5, issuedOrReserved: 0 })).toEqual({ ok: true, status: "PROPOSED", editionSize: 5, approvedPriceArs: null });
    expect(offerSellingPrice({ status: "PROPOSED", priceArs: 120_000, approvedPriceArs: null })).toBeNull();
    // Y después, volver al precio viejo ya no la re-aprueba sola.
    expect(offerTransition("changePrice", { status: "PROPOSED", priceArs: 120_000, approvedPriceArs: null }, { actor: "AUTHOR", newPriceArs: 100_000 }))
      .toMatchObject({ ok: true, status: "PROPOSED" });
  });
  it("la misma edición no cambia nada", () => {
    expect(offerTransition("editEdition", { status: "APPROVED", approvedPriceArs: 100_000, editionSize: 10, firstSoldAt: null }, { actor: "AUTHOR", editionSize: 10, issuedOrReserved: 0 }))
      .toEqual({ ok: true, status: "APPROVED", editionSize: 10 });
  });
  it("después de la primera venta el formato queda fijo", () => {
    const prev = { format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 2, priceArs: 150_000, paper: "Baryta", widthCm: 40, heightCm: 60 } as const;
    expect(offerProblems({ ...prev, paper: "Otro" }, { hasFirstSale: true, previous: prev }).join()).toMatch(/primera venta/);
    expect(offerProblems({ ...prev, priceArs: 160_000 }, { hasFirstSale: true, previous: prev })).toEqual([]);
  });
  it("un pago que llega con el pedido vencido no se pierde; los estados finales no se mueven", () => {
    expect(saleOrderTransition("EXPIRED", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBe("PAID");
    expect(saleOrderTransition("PAID", { orderStatus: "CHARGED_BACK", paymentStatus: null }).next).toBe("CHARGED_BACK");
    expect(saleOrderTransition("REJECTED", { orderStatus: "FAILED", paymentStatus: "rejected" }).next).toBeNull();
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "processed", paymentStatus: "accredited" }).next).toBe("PAID");
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "PROCESSED", paymentStatus: null }).next).toBeNull();
  });
});
