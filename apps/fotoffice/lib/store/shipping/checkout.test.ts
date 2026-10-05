import { describe, expect, it } from "vitest";
import {
  deliveryOptionsFromSettings,
  parseQuoteRequest,
  publicAgencies,
  publicQuoteResult,
  SHIPPING_FAILURE_MESSAGES,
  shippingFailureMessage,
} from "./checkout";

const lines = [{ productId: "p1", variantId: null, qty: 2 }];

describe("publicQuoteResult", () => {
  it("al navegador sólo le llegan el total y el servicio", () => {
    const r = publicQuoteResult({
      ok: true,
      quote: {
        method: "HOME",
        source: "CORREO_ARGENTINO",
        baseMinor: 500000,
        surchargeMinor: 50000,
        totalMinor: 550000,
        serviceName: "Correo Argentino Clásico",
        package: { weightGrams: 600, lengthCm: 30, widthCm: 20, heightCm: 10 },
        raw: { secreto: "x" },
      },
    });
    expect(r).toEqual({ ok: true, totalMinor: 550000, serviceName: "Correo Argentino Clásico" });
  });

  it("cada motivo de falla tiene su texto en castellano", () => {
    expect(publicQuoteResult({ ok: false, reason: "DISABLED" })).toEqual({
      ok: false,
      message: "Ese tipo de envío no está disponible.",
    });
    expect(publicQuoteResult({ ok: false, reason: "NO_COVERAGE" })).toEqual({
      ok: false,
      message: "Todavía no hacemos envíos a ese código postal.",
    });
    expect(publicQuoteResult({ ok: false, reason: "TOO_BIG" })).toEqual({
      ok: false,
      message: "El paquete es demasiado grande para enviar. Podés retirarlo en la sede.",
    });
    expect(publicQuoteResult({ ok: false, reason: "UNAVAILABLE" })).toEqual({
      ok: false,
      message: "No pudimos calcular el envío. Probá de nuevo o elegí retiro en la sede.",
    });
    expect(Object.keys(SHIPPING_FAILURE_MESSAGES).sort()).toEqual(["DISABLED", "NO_COVERAGE", "TOO_BIG", "UNAVAILABLE"]);
  });

  it("sin retiro en la sede no lo sugiere", () => {
    expect(publicQuoteResult({ ok: false, reason: "UNAVAILABLE" }, { pickupEnabled: false })).toEqual({
      ok: false,
      message: "No pudimos calcular el envío. Probá de nuevo en unos minutos.",
    });
    expect(shippingFailureMessage("TOO_BIG", false)).toBe("El paquete es demasiado grande para enviar.");
    expect(shippingFailureMessage("NO_COVERAGE", false)).toBe("Todavía no hacemos envíos a ese código postal.");
    expect(shippingFailureMessage("UNAVAILABLE", true)).toBe(SHIPPING_FAILURE_MESSAGES.UNAVAILABLE);
    for (const r of ["DISABLED", "NO_COVERAGE", "TOO_BIG", "UNAVAILABLE"] as const) {
      expect(shippingFailureMessage(r, false)).not.toMatch(/retir/i);
    }
  });
});

describe("parseQuoteRequest", () => {
  it("acepta y normaliza", () => {
    expect(parseQuoteRequest({ method: "HOME", postalCode: " S2000ABC ", provinceCode: "s", lines })).toEqual({
      ok: true,
      value: { method: "HOME", postalCode: "2000", provinceCode: "S", lines },
    });
    const r = parseQuoteRequest({ method: "BRANCH", postalCode: "5000", provinceCode: "X", lines });
    expect(r.ok && r.value.method).toBe("BRANCH");
  });

  it("descarta lo que sobra de las líneas", () => {
    const r = parseQuoteRequest({
      method: "HOME",
      postalCode: "2000",
      provinceCode: "S",
      lines: [{ productId: "p1", variantId: "v1", qty: 1, unitPriceMinor: 1, name: "x" }],
    });
    expect(r.ok && r.value.lines).toEqual([{ productId: "p1", variantId: "v1", qty: 1 }]);
  });

  it("las obras se cotizan con su formato (el listing no hace falta para el peso)", () => {
    const r = parseQuoteRequest({
      method: "HOME",
      postalCode: "2000",
      provinceCode: "S",
      lines: [
        { productId: "p1", variantId: null, qty: 1 },
        { kind: "artwork", artworkListingId: "al1", printFormatId: "f1", qty: 2, unitPriceMinor: 5, name: "x" },
      ],
    });
    expect(r.ok && r.value.lines).toEqual([
      { productId: "p1", variantId: null, qty: 1 },
      { kind: "artwork", printFormatId: "f1", qty: 2 },
    ]);
    const soloObras = parseQuoteRequest({
      method: "HOME",
      postalCode: "2000",
      provinceCode: "S",
      lines: [{ kind: "artwork", artworkListingId: "al1", printFormatId: "f1", qty: 1 }],
    });
    expect(soloObras.ok).toBe(true);
  });

  it("rechaza con un mensaje para mostrar", () => {
    expect(parseQuoteRequest({ method: "PICKUP", postalCode: "2000", provinceCode: "S", lines })).toEqual({
      ok: false,
      message: "Ese tipo de envío no está disponible.",
    });
    expect(parseQuoteRequest({ method: "HOME", postalCode: "123", provinceCode: "S", lines })).toEqual({
      ok: false,
      message: "Ingresá un código postal válido (4 números, ej. 2000).",
    });
    expect(parseQuoteRequest({ method: "HOME", postalCode: "2000", provinceCode: "I", lines })).toEqual({
      ok: false,
      message: "Elegí la provincia.",
    });
    expect(parseQuoteRequest({ method: "HOME", postalCode: "2000", provinceCode: "S", lines: [] }).ok).toBe(false);
    expect(
      parseQuoteRequest({ method: "HOME", postalCode: "2000", provinceCode: "S", lines: [{ productId: "p", variantId: null, qty: 0 }] }).ok,
    ).toBe(false);
    expect(parseQuoteRequest(null).ok).toBe(false);
    expect(parseQuoteRequest("x").ok).toBe(false);
  });
});

describe("deliveryOptionsFromSettings", () => {
  const row = {
    pickupEnabled: true,
    homeDeliveryEnabled: true,
    branchDeliveryEnabled: true,
    source: "CORREO_ARGENTINO",
    tableAsFallback: false,
    handlingNote: "Despachamos en 48 h hábiles",
  };

  it("sin configuración de envíos: sólo retiro (como en la etapa 1)", () => {
    expect(deliveryOptionsFromSettings(null, false)).toEqual({ pickup: true, home: false, branch: false, handlingNote: null });
  });

  it("refleja lo activo", () => {
    expect(deliveryOptionsFromSettings(row, true)).toEqual({
      pickup: true,
      home: true,
      branch: true,
      handlingNote: "Despachamos en 48 h hábiles",
    });
    expect(deliveryOptionsFromSettings({ ...row, pickupEnabled: false, branchDeliveryEnabled: false }, true)).toMatchObject({
      pickup: false,
      home: true,
      branch: false,
    });
  });

  it("sucursal sólo con Correo Argentino", () => {
    expect(deliveryOptionsFromSettings({ ...row, source: "TABLE" }, true).branch).toBe(false);
  });

  it("si no queda ninguna forma, vuelve el retiro: nunca un checkout sin salida", () => {
    expect(
      deliveryOptionsFromSettings({ ...row, pickupEnabled: false, homeDeliveryEnabled: false, source: "TABLE" }, true),
    ).toMatchObject({ pickup: true, home: false, branch: false });
  });

  it("sucursal sólo con la conexión de Correo activa: si no, no se puede cotizar", () => {
    expect(deliveryOptionsFromSettings(row, false).branch).toBe(false);
  });

  it("domicilio con Correo desconectado: sólo si la tabla propia hace de respaldo", () => {
    expect(deliveryOptionsFromSettings(row, false).home).toBe(false);
    expect(deliveryOptionsFromSettings({ ...row, tableAsFallback: true }, false).home).toBe(true);
    // Con la tabla como fuente, la conexión de Correo no importa.
    expect(deliveryOptionsFromSettings({ ...row, source: "TABLE" }, false).home).toBe(true);
  });

  it("si Correo se desconecta y no había retiro, vuelve el retiro", () => {
    expect(deliveryOptionsFromSettings({ ...row, pickupEnabled: false }, false)).toMatchObject({
      pickup: true,
      home: false,
      branch: false,
    });
  });

  it("aviso vacío es null", () => {
    expect(deliveryOptionsFromSettings({ ...row, handlingNote: "   " }, true).handlingNote).toBe(null);
  });
});

describe("publicAgencies", () => {
  it("sólo lo que se muestra y el CP, recortado, sin sucursales que no se pueden elegir", () => {
    expect(
      publicAgencies([
        { id: " A1 ", name: " Centro ", address: "Córdoba 721", city: "Rosario", postalCode: "S2000ABC" },
        { id: "", name: "Sin id", address: "x", city: "y", postalCode: "2000" },
        { id: "A2", name: "", address: "x", city: "y", postalCode: "2000" },
        { id: "A4", name: "Sin dirección", address: " ", city: "y", postalCode: "2000" },
        { id: "A5", name: "Sin CP", address: "x", city: "y", postalCode: "" },
        { id: "A3", name: "n".repeat(300), address: "a".repeat(300), city: "c", postalCode: "2000" },
      ]),
    ).toEqual([
      { id: "A1", name: "Centro", address: "Córdoba 721", city: "Rosario", postalCode: "2000" },
      { id: "A3", name: "n".repeat(200), address: "a".repeat(200), city: "c", postalCode: "2000" },
    ]);
  });
});

describe("Andreani en el checkout", () => {
  const row = {
    pickupEnabled: true,
    homeDeliveryEnabled: true,
    branchDeliveryEnabled: true,
    source: "ANDREANI",
    tableAsFallback: false,
    handlingNote: null,
  };

  it("con la conexión activa ofrece domicilio y sucursal, y marca el correo", () => {
    expect(deliveryOptionsFromSettings(row, true, { branchContract: true })).toEqual({
      pickup: true,
      home: true,
      branch: true,
      handlingNote: null,
      carrier: "ANDREANI",
    });
  });

  it("sin contrato de sucursal no ofrece sucursal", () => {
    expect(deliveryOptionsFromSettings(row, true, { branchContract: false })).toMatchObject({ home: true, branch: false });
  });

  it("desconectado: sucursal nunca; domicilio sólo con la tabla de respaldo", () => {
    expect(deliveryOptionsFromSettings(row, false, { branchContract: true })).toMatchObject({ home: false, branch: false });
    expect(deliveryOptionsFromSettings({ ...row, tableAsFallback: true }, false, { branchContract: true })).toMatchObject({
      home: true,
      branch: false,
    });
  });

  it("cotizar a sucursal sin provincia (se busca por CP); domicilio sigue pidiéndola", () => {
    expect(parseQuoteRequest({ method: "BRANCH", postalCode: "5000", provinceCode: "", lines })).toEqual({
      ok: true,
      value: { method: "BRANCH", postalCode: "5000", provinceCode: "", lines },
    });
    expect(parseQuoteRequest({ method: "BRANCH", postalCode: "5000", lines }).ok).toBe(true);
    expect(parseQuoteRequest({ method: "HOME", postalCode: "5000", provinceCode: "", lines })).toEqual({
      ok: false,
      message: "Elegí la provincia.",
    });
    expect(parseQuoteRequest({ method: "BRANCH", postalCode: "5000", provinceCode: "Ñ", lines })).toEqual({
      ok: false,
      message: "Elegí la provincia.",
    });
  });
});
