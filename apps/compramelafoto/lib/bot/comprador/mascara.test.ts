import { describe, expect, it } from "vitest";
import { enmascararEmail, etiquetaEstadoPedido } from "./mascara";

describe("enmascararEmail", () => {
  it("deja las dos primeras letras y el dominio", () => {
    expect(enmascararEmail("juana@gmail.com")).toBe("ju***@gmail.com");
    expect(enmascararEmail("  Juana@Gmail.com ")).toBe("ju***@gmail.com");
  });
  it("usuario corto o mail inválido no se filtra", () => {
    expect(enmascararEmail("j@x.com")).toBe("j***@x.com");
    expect(enmascararEmail("sin-arroba")).toBe("tu mail");
    expect(enmascararEmail("@x.com")).toBe("tu mail");
  });
  it("sin mail → «tu mail»", () => {
    expect(enmascararEmail(null)).toBe("tu mail");
    expect(enmascararEmail(undefined)).toBe("tu mail");
    expect(enmascararEmail("")).toBe("tu mail");
  });
});

describe("etiquetaEstadoPedido", () => {
  it("las 5 etiquetas y el resto en revisión", () => {
    expect(etiquetaEstadoPedido("PAID")).toBe("pagado");
    expect(etiquetaEstadoPedido("PENDING")).toBe("pendiente de pago");
    expect(etiquetaEstadoPedido("FAILED")).toBe("rechazado");
    expect(etiquetaEstadoPedido("CANCELED")).toBe("cancelado");
    expect(etiquetaEstadoPedido("REFUNDED")).toBe("devuelto");
    expect(etiquetaEstadoPedido("OTRA")).toBe("en revisión");
  });
});
