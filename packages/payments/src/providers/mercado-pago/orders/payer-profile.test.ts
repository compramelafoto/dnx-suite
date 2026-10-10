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
   * MP lo aclaró el 09/10/2026: en Orders estos campos van con claves planas
   * dentro de `additional_info`, no anidados bajo `payer`. El nodo anidado
   * pertenece a la API de Payments y Orders lo rechaza.
   */
  it("usa claves planas con el prefijo payer.", () => {
    const info = buildMercadoPagoAdditionalInfoPayer({
      registrationDate: "2024-01-15T10:00:00.000-03:00",
      isPrimeUser: true,
      isFirstPurchaseOnline: false,
      authenticationType: "WEB",
      lastPurchase: "2026-09-01T10:00:00.000-03:00",
    });
    assert.deepEqual(info, {
      "payer.registration_date": "2024-01-15T10:00:00.000-03:00",
      "payer.last_purchase": "2026-09-01T10:00:00.000-03:00",
      "payer.authentication_type": "WEB",
      "payer.is_prime_user": true,
      "payer.is_first_purchase_online": false,
    });
  });

  it("no anida nada bajo una clave `payer`", () => {
    const info = buildMercadoPagoAdditionalInfoPayer({ authenticationType: "WEB" }) ?? {};
    assert.equal((info as Record<string, unknown>).payer, undefined);
  });

  it("conserva los booleanos en false, que son información válida", () => {
    const info = buildMercadoPagoAdditionalInfoPayer({
      isPrimeUser: false,
      isFirstPurchaseOnline: false,
    });
    assert.equal(info?.["payer.is_prime_user"], false);
    assert.equal(info?.["payer.is_first_purchase_online"], false);
  });

  it("devuelve undefined sin perfil y sin datos", () => {
    assert.equal(buildMercadoPagoAdditionalInfoPayer(undefined), undefined);
    assert.equal(buildMercadoPagoAdditionalInfoPayer({ firstName: "Ana" }), undefined);
  });
});

describe("buildMercadoPagoPayer — dirección", () => {
  it("manda la dirección dentro de payer, con barrio y ciudad", () => {
    const payer = buildMercadoPagoPayer("comprador@testuser.com", {
      address: {
        zipCode: "2000",
        streetName: "Córdoba",
        streetNumber: "1234",
        neighborhood: "Centro",
        city: "Rosario",
      },
    });
    assert.deepEqual(payer.address, {
      zip_code: "2000",
      street_name: "Córdoba",
      street_number: "1234",
      neighborhood: "Centro",
      city: "Rosario",
    });
  });

  it("omite la dirección cuando el perfil no la trae", () => {
    assert.equal(buildMercadoPagoPayer("c@testuser.com", { firstName: "Ana" }).address, undefined);
  });
});
