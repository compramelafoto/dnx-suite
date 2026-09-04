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
  it("devuelve undefined cuando no hay nada que informar", () => {
    assert.equal(buildMercadoPagoAdditionalInfoPayer(undefined), undefined);
    assert.equal(buildMercadoPagoAdditionalInfoPayer({}), undefined);
    assert.equal(
      buildMercadoPagoAdditionalInfoPayer({ authenticationType: "   " }),
      undefined,
    );
  });

  it("mapea historial y contexto con los nombres de la API", () => {
    const info = buildMercadoPagoAdditionalInfoPayer({
      registrationDate: "2025-03-01T10:00:00.000Z",
      lastPurchase: "2026-08-01T12:00:00.000Z",
      authenticationType: "Gmail",
      isPrimeUser: true,
      isFirstPurchaseOnline: false,
      address: { zipCode: "S2000", streetName: "Córdoba", streetNumber: "1234" },
    });
    assert.deepEqual(info, {
      address: { zip_code: "S2000", street_name: "Córdoba", street_number: "1234" },
      registration_date: "2025-03-01T10:00:00.000Z",
      last_purchase: "2026-08-01T12:00:00.000Z",
      authentication_type: "Gmail",
      is_prime_user: true,
      is_first_purchase_online: false,
    });
  });

  it("conserva los booleanos en false, que son información válida", () => {
    const info = buildMercadoPagoAdditionalInfoPayer({ isPrimeUser: false });
    assert.deepEqual(info, { is_prime_user: false });
  });
});
