import { describe, expect, it } from "vitest";
import {
  FEED_COLUMNS,
  buildFulfillmentCsv,
  csvCell,
  deliveryAddress,
  deliveryLabel,
  feedRow,
  garmentName,
  splitVariantName,
  type FeedItem,
} from "./feed";

function item(cambios: Partial<FeedItem> = {}, pedido: Partial<FeedItem["order"]> = {}): FeedItem {
  return {
    sku: "DNX-CFLAG-OVN-M",
    productName: "Camera Flag",
    variantName: "Oversize negra / M",
    qty: 2,
    printFileUrl: "https://drive.google.com/file/d/abc",
    imageUrl: "https://cdn.example.com/boceto.png",
    fulfillmentSentAt: null,
    ...cambios,
    order: {
      publicId: "PUB123",
      orderNumber: 17,
      // 14:05 en Buenos Aires.
      paidAt: new Date("2026-11-03T17:05:00Z"),
      buyerName: "Ana Pérez",
      buyerPhone: "341 555 1234",
      deliveryMethod: "SHIPPING",
      shippingMethod: "HOME",
      shippingAddressJson: {
        street: "Córdoba",
        number: "1234",
        floorApt: "3B",
        city: "Rosario",
        provinceCode: "S",
        postalCode: "2000",
        recipientName: "Ana Pérez",
        recipientPhone: "341 555 1234",
      },
      shippingAgencyJson: null,
      trackingNumber: null,
      ...pedido,
    },
  };
}

describe("splitVariantName y garmentName", () => {
  it("separa el modelo del talle", () => {
    expect(splitVariantName("Oversize negra / M")).toEqual({ model: "Oversize negra", size: "M" });
    expect(garmentName("Camera Flag", "Oversize negra / M")).toBe("Camera Flag — Oversize negra");
  });
  it("sin separador, todo es el talle", () => {
    expect(splitVariantName("XL")).toEqual({ model: null, size: "XL" });
    expect(garmentName("Camera Flag", "XL")).toBe("Camera Flag");
  });
  it("sin talle", () => {
    expect(splitVariantName(null)).toEqual({ model: null, size: "" });
    expect(garmentName("Taza", null)).toBe("Taza");
  });
});

describe("entrega", () => {
  it("retiro con y sin dirección del local", () => {
    const o = item({}, { deliveryMethod: "PICKUP", shippingMethod: null }).order;
    expect(deliveryLabel(o, "San Martín 100")).toBe("Retiro en San Martín 100");
    expect(deliveryLabel(o, null)).toBe("Retiro en el local");
    expect(deliveryAddress(o)).toBe("");
  });
  it("envío a domicilio en una celda", () => {
    const o = item().order;
    expect(deliveryLabel(o, null)).toBe("Envío a domicilio");
    expect(deliveryAddress(o)).toContain("Córdoba 1234, 3B");
    expect(deliveryAddress(o)).toContain("Rosario");
    expect(deliveryAddress(o)).toContain("CP 2000");
  });
  it("envío a sucursal", () => {
    const o = item(
      {},
      { shippingMethod: "BRANCH", shippingAgencyJson: { name: "Sucursal Centro", address: "Mitre 50" } },
    ).order;
    expect(deliveryLabel(o, null)).toBe("Envío a sucursal");
    expect(deliveryAddress(o)).toBe("Sucursal Centro · Mitre 50");
  });
});

describe("feedRow", () => {
  it("arma las columnas en el orden pedido", () => {
    const fila = feedRow(item({}, { trackingNumber: "360000123" }), null);
    expect(fila).toHaveLength(FEED_COLUMNS.length);
    expect(fila.slice(0, 8)).toEqual([
      "PUB123",
      "17",
      "DNX-CFLAG-OVN-M",
      "Camera Flag — Oversize negra",
      "2",
      "M",
      "https://drive.google.com/file/d/abc",
      "360000123",
    ]);
    expect(fila[8]).toBe("https://cdn.example.com/boceto.png");
    expect(fila[9]).toBe("03/11/2026 14:05");
    expect(fila[10]).toBe("Ana Pérez");
    expect(fila[14]).toBe("Pendiente");
  });
  it("marca lo que ya se pasó al productor y deja vacíos los faltantes", () => {
    const fila = feedRow(item({ sku: null, printFileUrl: null, imageUrl: null, fulfillmentSentAt: new Date() }), null);
    expect(fila[2]).toBe("");
    expect(fila[6]).toBe("");
    expect(fila[7]).toBe("");
    expect(fila[14]).toBe("Pasado al productor");
  });
});

describe("csvCell", () => {
  it("escapa comillas, comas y saltos (RFC 4180)", () => {
    expect(csvCell("simple")).toBe("simple");
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it.each(["=HYPERLINK(\"x\")", "+54 341", "-1", "@SUMA(A1)"])("neutraliza la fórmula %j", (v) => {
    expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });
});

describe("buildFulfillmentCsv", () => {
  it("encabezado y una fila por línea, con CRLF", () => {
    const csv = buildFulfillmentCsv([item(), item({ qty: 1 })], null);
    const lineas = csv.split("\r\n");
    expect(lineas[0]).toBe(FEED_COLUMNS.join(","));
    expect(lineas).toHaveLength(4); // encabezado + 2 filas + el final vacío
    expect(lineas[3]).toBe("");
  });
  it("sin pedidos, sólo el encabezado", () => {
    expect(buildFulfillmentCsv([], null)).toBe(`${FEED_COLUMNS.join(",")}\r\n`);
  });
});
