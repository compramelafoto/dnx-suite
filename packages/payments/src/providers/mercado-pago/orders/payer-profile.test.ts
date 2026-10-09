import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMercadoPagoAdditionalInfoPayer,
  buildMercadoPagoPayer,
} from "./payer-profile.js";

describe("buildMercadoPagoPayer", () => {
  it("sin perfil manda solo el email", () => {
    assert.deepEqual(buildMercadoPagoPayer("comprador@testuser.com"), {
      email: "comprador@testuser.com",
    });
  });

  it("agrega nombre, apellido, identificación y teléfono", () => {
    const payer = buildMercadoPagoPayer("c@testuser.com", {
      firstName: "Ana",
      lastName: "Gómez",
      identification: { type: "DNI", number: "30111222" },
      phone: { areaCode: "341", number: "5551234" },
    });
    assert.equal(payer.first_name, "Ana");
    assert.equal(payer.last_name, "Gómez");
    assert.deepEqual(payer.identification, { type: "DNI", number: "30111222" });
    assert.deepEqual(payer.phone, { area_code: "341", number: "5551234" });
  });

  it("omite la identificación incompleta en vez de mandarla a medias", () => {
    const payer = buildMercadoPagoPayer("c@testuser.com", {
      identification: { type: "DNI", number: "   " },
    });
    assert.equal(payer.identification, undefined);
  });

  it("no crea claves para strings vacíos", () => {
    const payer = buildMercadoPagoPayer("c@testuser.com", {
      firstName: "  ",
      lastName: "",
    });
    assert.deepEqual(payer, { email: "c@testuser.com" });
  });
});

describe("buildMercadoPagoAdditionalInfoPayer", () => {
  /**
   * Orders rechaza `additional_info` por completo. Se verificó contra sandbox
   * MLA el 07/10/2026: responde `Properties not supported ('$.additional_info'
   * - additionalProperties 'payer' not allowed)` y la orden no se crea.
   */
  it("no devuelve nada: Orders no acepta ese nodo", () => {
    assert.equal(
      buildMercadoPagoAdditionalInfoPayer({
        registrationDate: "2026-01-15T10:00:00.000-03:00",
        isPrimeUser: false,
        isFirstPurchaseOnline: true,
        authenticationType: "Gmail",
        lastPurchase: "2026-09-20T18:30:00.000-03:00",
        address: { zipCode: "2000" },
      }),
      undefined,
    );
  });

  it("tampoco devuelve nada sin perfil", () => {
    assert.equal(buildMercadoPagoAdditionalInfoPayer(undefined), undefined);
  });
});

describe("buildMercadoPagoPayer — dirección", () => {
  it("manda la dirección dentro de payer, que es donde Orders la acepta", () => {
    const payer = buildMercadoPagoPayer("comprador@testuser.com", {
      address: { zipCode: "2000", streetName: "Córdoba", streetNumber: "1234" },
    });
    assert.deepEqual(payer.address, {
      zip_code: "2000",
      street_name: "Córdoba",
      street_number: "1234",
    });
  });

  it("omite la dirección cuando el perfil no la trae", () => {
    const payer = buildMercadoPagoPayer("comprador@testuser.com", {
      firstName: "Ana",
    });
    assert.equal(payer.address, undefined);
  });
});
