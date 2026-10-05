import { describe, expect, it } from "vitest";
import { newPublicId } from "./access-token";
import { isWellFormedPublicId, keptReturnParams, storeOrderCookieName, storeVisibleBase } from "./order-access";

describe("storeVisibleBase", () => {
  const fotofficeOrigin = "https://fotoffice.app";

  it("en el dominio de FOTOFFICE la tienda vive bajo /w/<slug>", () => {
    expect(storeVisibleBase({ slug: "sfpr", host: "fotoffice.app", fotofficeOrigin })).toBe("/w/sfpr/tienda");
    expect(storeVisibleBase({ slug: "sfpr", host: "localhost", fotofficeOrigin })).toBe("/w/sfpr/tienda");
  });

  it("en el dominio propio de la institución, sin /w/<slug>: es lo que ve el navegador", () => {
    expect(storeVisibleBase({ slug: "sfpr", host: "sfpr.com.ar", fotofficeOrigin })).toBe("/tienda");
  });
});

describe("keptReturnParams", () => {
  it("se queda con el resultado y el pago; descarta el token y el resto de Mercado Pago", () => {
    const p = new URLSearchParams("t=secreto&pago=ok&payment_id=123&collection_id=123&preference_id=x");
    expect(keptReturnParams(p).toString()).toBe("pago=ok&payment_id=123");
  });
});

describe("isWellFormedPublicId", () => {
  it("acepta lo que genera newPublicId y rechaza lo demás", () => {
    expect(isWellFormedPublicId(newPublicId())).toBe(true);
    expect(isWellFormedPublicId("ped_../../x")).toBe(false);
    expect(isWellFormedPublicId("otra")).toBe(false);
  });
});

describe("storeOrderCookieName", () => {
  it("es la misma cookie que pone el checkout", () => {
    expect(storeOrderCookieName("ped_abc")).toBe("fo_ped_ped_abc");
  });
});
