import { describe, expect, it } from "vitest";
import { orderShippingView } from "./order-destination";

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
