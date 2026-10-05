import { describe, expect, it } from "vitest";
import { orderQuoteSummary, orderShippingView } from "./order-destination";

describe("orderShippingView", () => {
  it("retiro (o pedido de la etapa 1): null", () => {
    expect(orderShippingView({ deliveryMethod: "PICKUP", shippingMethod: null, shippingAddressJson: null, shippingAgencyJson: null })).toBeNull();
  });

  it("a domicilio: calle, piso, localidad con provincia y CP, quién recibe y teléfono", () => {
    expect(
      orderShippingView({
        deliveryMethod: "SHIPPING",
        shippingMethod: "HOME",
        shippingAddressJson: {
          recipientName: "Ana Pérez",
          street: "San Martín",
          number: "1500",
          floorApt: "3 B",
          city: "Rosario",
          provinceCode: "S",
          postalCode: "2000",
          recipientPhone: "341 555",
        },
        shippingAgencyJson: null,
      }),
    ).toEqual({
      label: "Envío a domicilio",
      lines: ["San Martín 1500, 3 B", "Rosario, Santa Fe (CP 2000)", "Recibe: Ana Pérez · 341 555"],
    });
  });

  it("a domicilio sin piso ni teléfono", () => {
    expect(
      orderShippingView({
        deliveryMethod: "SHIPPING",
        shippingMethod: "HOME",
        shippingAddressJson: { recipientName: "Ana", street: "Mitre", number: "10", floorApt: null, city: "Paraná", provinceCode: "E", postalCode: "3100", recipientPhone: null },
        shippingAgencyJson: null,
      })?.lines,
    ).toEqual(["Mitre 10", "Paraná, Entre Ríos (CP 3100)", "Recibe: Ana"]);
  });

  it("a sucursal: nombre, dirección y localidad de la sucursal", () => {
    expect(
      orderShippingView({
        deliveryMethod: "SHIPPING",
        shippingMethod: "BRANCH",
        shippingAddressJson: null,
        shippingAgencyJson: { id: "S1", name: "Sucursal Centro", address: "Córdoba 1234", city: "Rosario", postalCode: "2000", provinceCode: "S" },
      }),
    ).toEqual({ label: "Envío a sucursal", lines: ["Sucursal Centro", "Córdoba 1234", "Rosario, Santa Fe (CP 2000)"] });
  });

  it("datos rotos no rompen: muestra lo que hay", () => {
    expect(
      orderShippingView({ deliveryMethod: "SHIPPING", shippingMethod: "BRANCH", shippingAddressJson: null, shippingAgencyJson: "basura" }),
    ).toEqual({ label: "Envío a sucursal", lines: [] });
  });
});

describe("orderQuoteSummary", () => {
  it("fuente, servicio y paquete de la cotización guardada", () => {
    expect(
      orderQuoteSummary({
        method: "HOME",
        source: "CORREO_ARGENTINO",
        serviceName: "Correo Argentino a domicilio",
        package: { weightGrams: 600, lengthCm: 30, widthCm: 20, heightCm: 10 },
        raw: { x: 1 },
      }),
    ).toEqual({
      sourceLabel: "Correo Argentino (cotización en el momento)",
      serviceName: "Correo Argentino a domicilio",
      packageLine: "600 g · 30 × 20 × 10 cm",
    });
  });

  it("tabla propia y datos incompletos: muestra lo que hay", () => {
    expect(orderQuoteSummary({ source: "TABLE", package: { weightGrams: 1500 } })).toEqual({
      sourceLabel: "Tabla de precios propia",
      serviceName: null,
      packageLine: "1500 g",
    });
  });

  it("sin cotización (retiro o pedido viejo): null", () => {
    expect(orderQuoteSummary(null)).toBeNull();
    expect(orderQuoteSummary("x")).toBeNull();
  });
});
